---
title: CS2 Tournament App
status: final
created: 2026-06-29
updated: 2026-06-29
---

# PRD: CS2 Tournament App
*Working title — confirm.*

## 0. Document Purpose

This PRD is the Phase-2 (Planning) requirements contract for a Counter-Strike 2 tournament web app built for a private group of ~8–16 friends. It is written for the PM (Cuatro), the downstream UX and Architecture workflows, and the developer who implements it. It builds directly on the Phase-1 artifacts and does not duplicate them: the [product brief](../../briefs/brief-cs-tournament-2026-06-29/brief.md) and its [technical addendum](../../briefs/brief-cs-tournament-2026-06-29/addendum.md), the [brainstorm intent](../../brainstorm-cs2-tournament-2026-06-29/brainstorm-intent.md), and the proven [demo-parsing research spike](../../research/technical-cs2-demo-parsing-research-2026-06-29.md) (GO verdict).

Structure: vocabulary is anchored in the **Glossary (§3)** — every Functional Requirement (FR), User Journey (UJ), and Success Metric (SM) uses those terms verbatim. Features are grouped (§4) with FRs nested and numbered globally (FR-1…FR-34) so downstream artifacts have stable references even if features are reorganized. Inferences the user did not directly confirm are tagged inline `[ASSUMPTION: …]` and collected in the **Assumptions Index (§9)**. Implementation "how" (parser library, upload transport, worker hosting, exact PRNG) lives in the companion `addendum.md`, not here — this PRD specifies capabilities, not implementation.

All Phase-1 decisions are **locked** and are not re-opened here: ~8–16 friends, double-elimination, Next.js (App Router) + Supabase + Vercel + a Go parsing worker, the demo as single source of truth, Steam OAuth identity, winners-recorded-only with no money in the app, mobile-first responsive, a one-off event on a seasons-aware schema, a MatchZy backbone with admin manual-upload fallback, and in-app scheduling parked.

## 1. Vision

A web app to run a Counter-Strike 2 tournament for a group of friends where the fun doesn't collapse the moment the two best players pull ahead. A traditional bracket crowns one champion and leaves everyone else with nothing to play for by the second round. This product splits the reward surface into **three independent reward tracks** — **Champion** (pure skill, the bracket), **Awards Roulette** (luck plus niche, demo-only stats), and **Meta-games** (predictions and participation, deferred past v1) — so that skill and luck each pay out on their own. The product's core, reusable move is to **manufacture spotlight for the players the bracket leaves behind**: nobody is mathematically out of *every* prize until the final ceremony. In v1 that spotlight comes from the Awards Roulette — including volume awards that reward simply playing more, and a guaranteed consolation for the winless; the fuller "showing up pays out" track (predictions and participation) arrives later with Meta-games.

The keystone is trust. Every number comes straight from the match's CS2 demo file, parsed automatically — **zero manual stat entry** — and that same demo is the single source of truth that doubles as the dispute referee and the seed for provably-fair award draws. The de-risking spike proved this: a real 170 MB demo parses in ~3.4 seconds and yields everything the awards need, down to knife kills, wallbangs, and through-smoke kills, each row keyed to a player's SteamID64.

v1 ships two of the three tracks — the double-elimination Champion bracket and the Awards Roulette — wired to an automated demo-ingestion spine and surfaced through a mobile-first tournament home that everyone follows from their phones, culminating in a spinning-wheel awards ceremony where even the winless are guaranteed a consolation draw. It is built as a one-off event but on a seasons-aware schema, so one good night can grow into a recurring league later without a rebuild.

## 2. Target User

### 2.1 Jobs To Be Done

- **As the early-eliminated / casual player** — keep me in the running for *something* long after my bracket run ends, so I stay glued to the event all the way to the final ceremony instead of checking out.
- **As the fragger** — give me accurate, live, trustworthy stats and a clean, visible path to the Champion title.
- **As the organizer / admin** — let me run the whole event (bracket, demo ingestion, ceremony) with near-zero manual bookkeeping and no rigging arguments to adjudicate.
- **As the spectator** — let me follow the bracket, the leaderboards, and the ceremony from my phone, wherever I am.
- **As the builder** — prove that an automated, demo-driven, provably-fair tournament tool is worth turning into a recurring league.

### 2.2 Non-Users (v1)

- **Strangers / the public.** v1 is a closed group joined by Steam OAuth against a known roster; it is not a public or open-signup tournament platform. `[ASSUMPTION: the group is private and trusted — this is why comedy/"shame" awards need no privacy controls in v1.]`
- **League / season players.** The schema is seasons-aware, but no season-persistence features ship in v1.
- **Bettors.** No money, odds, or chip economy lives in the app.
- **Native-app users.** v1 is responsive web only — no iOS/Android native app.

### 2.3 Key User Journeys

*Named-persona narratives the product enables, numbered UJ-1…UJ-5. FRs reference these inline ("realizes UJ-3").*

- **UJ-1. Theo, knocked out early, finds he's still in three races.**
  - **Persona + context:** Theo is a mid-skill player who loses both his bracket matches on night one. In a normal tournament he'd stop caring by 9pm.
  - **Entry state:** authenticated via Steam OAuth on his phone; bracket run over.
  - **Path:** opens the tournament home → the timeline feed shows his elimination *and*, below it, that approved stats now put him #1 in "knife kills" and #2 in "most generous" (deaths) → he taps through to the leaderboards.
  - **Climax:** he sees he's leading a volume award outright and is alive in two more — the Awards Roulette categories are still blurred, so any of them could be live at the ceremony. He's not out of anything.
  - **Resolution:** he stays in the group chat trash-talking and shows up for the ceremony — which sets up UJ-4.

- **UJ-2. Mara ingests a finished match without touching a spreadsheet.**
  - **Persona + context:** Mara is the organizer running the event from a laptop with her phone beside her.
  - **Entry state:** authenticated admin; a bracket match just ended on the MatchZy server.
  - **Path:** the demo lands in ingestion and parses → per-player stats appear as **pending** under that match → Mara opens the pending match, eyeballs the score and a couple of stat lines → taps **Approve**.
  - **Climax:** on approval the bracket advances the winner, the leaderboards update, and the timeline feed posts the result — live, on every viewer's screen, in seconds.
  - **Resolution:** she moves to the next match. Total hands-on time: under a couple of minutes — the loop SM-1 and SM-5 measure.

- **UJ-3. Dex disputes a score and the demo settles it.**
  - **Persona + context:** Dex insists the recorded score is wrong and is loudly accusing the admin of rigging.
  - **Entry state:** an approved match result Dex disagrees with; dispute raised in the group chat.
  - **Path:** Mara opens the match in the admin console → triggers a **re-parse** of the stored raw demo → the parsed score is identical, and the published demo hash matches the retained file.
  - **Climax:** the result is shown to resolve byte-for-byte to the demo; there's nothing to argue with.
  - **Resolution:** dispute closed against the demo, not Mara's word — what SM-3 measures.

- **UJ-4. The group watches the ceremony and nobody leaves empty-handed.**
  - **Persona + context:** the whole roster, on a shared screen and their phones, at the end of the event.
  - **Entry state:** the championship match is approved; the final demo is retained and hashed.
  - **Path:** Mara starts the **ceremony** → a spinning wheel runs each **spin**, flipping previously-blurred categories live and revealing winners → the **anti-sweep** cap keeps any one player from hoovering a single spin → players with no trophies hit the **pity roulette**.
  - **Climax:** every category flips dramatically; the winless get a guaranteed consolation; the published seed (the final demo's hash) lets any skeptic recompute the whole thing.
  - **Resolution:** champion crowned, awards handed out (token shirts, settled outside the app), event closes with everyone having won *something*.

- **UJ-5. Mara resolves a no-show cleanly.**
  - **Persona + context:** a player never shows for his match.
  - **Entry state:** a scheduled bracket match with one absent player; the grace timer running.
  - **Path:** the grace timer expires → Mara marks the absent player a **forfeit** → the present player advances.
  - **Climax:** the advancing player gets a **bye-style badge**, not a phantom stat win, and the forfeited match contributes **no stats** to either player's leaderboards.
  - **Resolution:** bracket integrity preserved without manual stat surgery — enforced by FR-9 and FR-17.

## 3. Glossary

*Downstream workflows and readers must use these terms exactly. Introducing a synonym anywhere in this PRD is a discipline violation.*

- **Demo** — a CS2 `.dem` GOTV recording of a single match (typically 50–170 MB). The single source of truth for that match: its stats, its dispute referee, and its provably-fair seed source.
- **MatchZy** — the open-source CS2 server plugin that records and auto-uploads a Demo per match. The primary ("backbone") Demo source.
- **Manual upload** — an admin uploading a Demo (or its parsed result) by hand when MatchZy auto-upload is unavailable. The fallback Demo source.
- **SteamID64** — the 64-bit Steam account identifier captured at registration via Steam OAuth. The canonical join key between a parsed stat row and a Roster entry.
- **Roster** — the set of registered Players for the tournament, each keyed by SteamID64.
- **Player** — a registered participant. **Admin** — a Player with elevated permissions (runs the event). **Viewer** — any authenticated Player or spectator with read-only access.
- **Audit log** — the append-only record of event-mutating Admin actions, each with actor and timestamp. In FR consequences, "logged" means an Audit-log entry and "flagged" means a marker on the relevant record, both observable in the Admin console.
- **Bracket** — the double-elimination structure. **Winners bracket** / **Losers bracket** / **Grand final** are its parts. **Seed** (bracket sense) — a Player's randomly-assigned starting position, recorded.
- **Match** — one Bracket contest between two Players, resolved by a Demo (or admin entry if no Demo).
- **Bye** — a Match slot with no opponent; the Player advances. A Bye yields a **badge**, never a phantom stat win.
- **Forfeit / Walkover** — a Match a Player loses by no-show or concession after the grace timer. Contributes **no stats** to either Player.
- **Grace timer** — the countdown before an absent Player's Match becomes a Forfeit.
- **Ingestion** — the pipeline that turns a Demo into per-Player stat rows. **Pending** — parsed stats awaiting Admin approval. **Approved** — stats published to leaderboards and the Timeline feed. **Re-parse** — re-running Ingestion on a retained Demo. **Rollback** — reverting an Approved Match's stats.
- **Stat row** — one Player's parsed results for one Match (keyed by `match_id` + SteamID64).
- **Derived stat** — a stat computed from the Demo event stream rather than read directly (e.g., entry frag, 1vX clutch, KAST).
- **ADR** — Average Damage per Round, using **overkill-capped** damage (each victim contributes ≤ 100 damage per round) ÷ rounds the Player played. Matches the in-game scoreboard.
- **KAST** — percentage of rounds in which the Player got a **K**ill, an **A**ssist, **S**urvived, or was **T**raded.
- **Entry frag** — the first kill of a round; the Player who dies first that round takes the **opening death**. Together they form the **opening duel**.
- **1vX clutch** — a round won while a Player is the last alive on their team against X opponents.
- **Award** — a named prize tied to a deciding stat. Each Award has a **bucket** (skill / comedy / clutch / weird-demo-only) and a **class**.
- **Award class** — **rate** (normalized per opportunity; early-eliminated Players can win) or **volume** (totals; rewards Players who played more).
- **Anti-farm threshold** — a minimum-participation floor a Player must meet to be eligible for a rate or comedy Award.
- **AFK/idle DQ** — disqualification of a Player's Match stats from Award eligibility when the Demo shows them idle for too much of that Match.
- **Awards Roulette** — the second reward track: a seeded, ceremony-revealed draw that distributes Awards.
- **Spin** — one draw event in the ceremony: a two-stage draw that selects live categories (luck) and resolves their winners (stats), under the anti-sweep cap.
- **Two-stage draw** — Stage 1 (luck, seeded) picks which Award categories are live this Spin; Stage 2 (deterministic) picks each live category's winner from the Approved stat snapshot.
- **Anti-sweep** — the one-trophy-per-Spin cap plus a hidden **luck-meter** that biases category selection toward Players with empty shelves.
- **Provably-fair seed** — the SHA-256 hash of the final (championship-deciding) Match's Demo, published; it seeds the luck stages so anyone can reproduce the ceremony.
- **Pity roulette** — a guaranteed consolation draw for any Player who finishes with zero Awards.
- **Award-tie ladder** — the fixed order that breaks ties on a deciding stat, ending in a **shared co-winner trophy**.
- **Ceremony** — the end-of-event spinning-wheel reveal that runs the Spins.
- **Timeline feed** — the tournament-home chronological feed that is the single surfaced source of truth for Bracket state, Match results, and Award reveals.

## 4. Features

### 4.1 Roster & Identity

**Description:** Players join the tournament by authenticating with Steam, which both logs them in and captures the SteamID64 that ties every later stat row back to them. The Admin manages the Roster and the registration window. Realizes UJ-1, UJ-2.

#### FR-1: Steam OAuth login

A person can authenticate with their Steam account; on success the system stores their SteamID64 and creates (or resolves to) one Roster entry.

**Consequences (testable):**
- Unauthenticated visitors cannot register or appear on the Roster.
- A canceled or failed Steam OAuth returns the user to login and creates no Roster entry.
- The same Steam account authenticating twice resolves to a single Roster entry (no duplicates).

#### FR-2: SteamID64 capture & reconciliation

The system records each Player's SteamID64 as the canonical join key and tolerates Steam display-name changes without breaking the link to their stats.

**Consequences (testable):**
- Every Roster entry has exactly one valid 64-bit SteamID64.
- A stat row whose SteamID64 matches a Roster entry joins to that Player regardless of current Steam display name.
- A parsed stat row whose SteamID64 is **not** on the Roster appears in an Admin "unreconciled stat rows" list (showing the SteamID64 and source Match) rather than being silently dropped, and is excluded from leaderboards until reconciled.

#### FR-3: Roster & registration window

The Admin can open and close registration and view/manage the Roster. `[ASSUMPTION: registration is open-join-by-Steam within the window, then closed; there is no application/approval step.]`

**Consequences (testable):**
- While registration is open, an authenticated Steam user can add themselves to the Roster.
- While registration is closed, no new Roster entries can be created except by the Admin.
- The Admin can remove a Roster entry before the Bracket is generated.

#### FR-4: Roles (Admin vs Viewer)

The system distinguishes Admin from Viewer; all event-mutating actions are Admin-only.

**Consequences (testable):**
- A Viewer cannot advance a Match, approve Ingestion, or start the Ceremony (server-enforced, not just hidden UI).
- At least one Player is an Admin; Admin status is assignable.

### 4.2 Double-Elimination Bracket

**Description:** A randomly-seeded double-elimination Bracket for 8–16 Players (and in-between counts), with a Winners bracket, a Losers bracket, and a Grand final. The Admin advances Matches by tap or drag; everyone sees updates live. Byes, no-shows, and Forfeits are handled without manual stat surgery. Realizes UJ-2, UJ-5.

#### FR-5: Random-seeded Bracket generation

The Admin can generate a double-elimination Bracket from the closed Roster using a random, recorded Seed; non-power-of-two counts produce Byes.

**Consequences (testable):**
- Bracket generation works for any Roster size from 8 to 16 inclusive.
- A Roster whose size is not a power of two yields exactly enough Byes to fill the first round; Byes are assigned by the recorded Seed, not chosen by hand.
- The Seed is stored and viewable so seeding order can be reproduced/audited.

#### FR-6: Double-elimination structure

The Bracket maintains a Winners bracket, a Losers bracket, and a Grand final, routing each Match loser into the Losers bracket until they take a second loss and are eliminated.

**Consequences (testable):**
- A Player is eliminated only after two Match losses.
- The Losers-bracket and Winners-bracket finalists meet in the Grand final.
- Every non-champion's elimination point is derivable from the Bracket state.

#### FR-7: Advance a Match (live)

The Admin can advance a Match by tapping or dragging the winner forward; the change propagates to all Viewers in real time.

**Consequences (testable):**
- Advancing a Match updates both the Winners/Losers routing and the Timeline feed.
- A connected Viewer sees the advance without a manual refresh `[ASSUMPTION: within ~2 s — see NFRs]`.
- Advancing is idempotent: re-issuing the same advance does not double-route a Player.

#### FR-8: Byes

A Bye advances a Player with a badge and creates no stats.

**Consequences (testable):**
- A Player who receives a Bye advances with a recorded Bye badge.
- A Bye produces no Stat row and contributes nothing to any leaderboard.

#### FR-9: No-show / Forfeit with grace timer

The Admin can mark a Match a Forfeit once the grace timer expires; the present Player advances.

**Consequences (testable):**
- A Forfeit can only be finalized after the grace timer elapses `[ASSUMPTION: default grace timer = 10 minutes, Admin-configurable]`.
- A forfeited Match advances the present Player and is flagged Forfeit (handled for stats by FR-17).
- A Forfeit is logged with who forfeited and when.

#### FR-10: Pre-declared Match format & tie policy

Each Match's format and overtime/tie rule is declared, stored, and enforced **before** the Match starts; no ad-hoc mid-Match changes.

**Consequences (testable):**
- A Match cannot be marked complete under a format different from the one stored before it started.
- When a Demo is present, the winner is derived from the Demo's final score; when absent, the Admin enters the result and the entry is logged as manual.
- The declared format and any manual override are visible on the Match record.

### 4.3 Demo Ingestion (pending → approve)

**Description:** Demos arrive from MatchZy (auto) or by admin Manual upload (fallback), are parsed into per-Player Stat rows, and land as Pending for Admin review before they are Approved and published. Raw Demos are retained as the dispute referee and the seed source, and Ingestion is fully re-runnable. Realizes UJ-2, UJ-3.

#### FR-11: Demo acquisition (MatchZy + manual fallback)

The system accepts a Demo for a Match from MatchZy auto-upload and, as a fallback, from Admin Manual upload.

**Consequences (testable):**
- A Demo delivered by MatchZy for a known Match enters Ingestion without Admin action.
- An Admin can Manually upload a Demo for any Match.
- Because a Demo is 50–170 MB, acquisition does **not** route the file body through a Vercel/Next.js serverless function (see Constraints & Guardrails); the transport is an Architecture decision.

#### FR-12: Parse Demo to Stat rows

The parsing worker turns a Demo into normalized per-Player Stat rows keyed by `match_id` + SteamID64.

**Consequences (testable):**
- A parsed Demo yields one Stat row per participating SteamID64.
- A conservation check holds: summed kills equal summed deaths for the Match.
- Parsing a 170 MB Demo completes well within the latency target (see SM-5); the PoC measured ~3.4 s for event-only parsing. Enabling AFK/idle detection (FR-21) adds per-tick parse cost that must stay within SM-5.

#### FR-13: Staged Pending → Approved

Parsed stats land Pending; an Admin reviews and Approves them; only Approved stats reach leaderboards, the Bracket, and the Timeline feed.

**Consequences (testable):**
- Pending stats are visible to the Admin but excluded from public leaderboards, Award eligibility, and Bracket advancement.
- On Approve, the stats publish, the relevant Match can advance, and the Timeline feed posts the result.
- Approval is Admin-only (FR-4) and recorded with who approved and when.

#### FR-14: Re-parse / rollback

An Admin can Re-parse a retained Demo and can Rollback an Approved Match's stats.

**Consequences (testable):**
- Re-parsing a Demo replaces its Stat rows without creating duplicates (idempotent on `match_id` + SteamID64).
- Rolling back an Approved Match removes its contribution from leaderboards and reverts dependent Bracket advancement, returning it to Pending or unparsed.
- Re-parse and Rollback are logged.

#### FR-15: Raw Demo retention & hash (source of truth + seed)

Every Match's raw Demo is retained in durable object storage and its SHA-256 hash is recorded.

**Consequences (testable):**
- An Approved Match has a retained raw Demo and a stored SHA-256 hash of that exact file.
- The retained Demo is byte-for-byte re-hashable to the stored value (supports dispute resolution and the provably-fair seed).
- Retention is treated as a real cost line, not a free-tier bucket (see Constraints & Guardrails).

#### FR-16: Score derivation from Demo

Where a Demo is present, the Match score is derived from it rather than entered by hand.

**Consequences (testable):**
- An ingested Match's score equals the Demo's final round tally.
- A Demo-derived score cannot be silently overridden; any manual override (FR-10) is logged and flagged.

#### FR-17: Walkover / Forfeit stat hygiene

Forfeited/Walkover Matches contribute no stats, and leaderboards normalize for Matches actually played.

**Consequences (testable):**
- A Forfeit produces no Stat row for either Player.
- Rate-class Awards (ADR, HS%, KAST, entry success) are computed only over rounds the Player actually played in completed (non-Forfeit) Matches.
- Volume-class Awards count only completed Matches; a no-show neither helps nor hurts a Player's totals.

### 4.4 Derived Stats & Leaderboards

**Description:** From each Approved Demo the system computes core stats, the "weird" demo-only stats that make the Awards Roulette possible, and Derived stats (entry frags, 1vX clutches). Anti-farm thresholds and AFK/idle DQ keep Awards honest, and leaderboards distinguish rate from volume. Realizes UJ-1.

#### FR-18: Core per-Player stats

The system computes, per Player per Match: kills, deaths, assists, ADR, HS%, MVPs, flash assists, utility (molotov/HE) damage, and KAST.

**Consequences (testable):**
- **ADR** uses overkill-capped damage (≤ 100 per victim per round) ÷ rounds played and matches the in-game scoreboard. *(Locked — see §3, Assumptions Index, and addendum.)*
- **KAST** counts a round for a Player if they got a kill, an assist, survived, or were traded, where "traded" means their killer died within `[ASSUMPTION: 5 seconds]` of the Player's death; KAST is the percentage of rounds played meeting that condition.
- **HS%** = headshot kills ÷ kills; flash assists and utility damage are read from the Demo event stream.

#### FR-19: Weird demo-only stats

The system computes the niche stats that distinguish this app: knife kills, wallbangs (penetration), through-smoke kills, no-scope kills, blind kills, and molotov/HE damage.

**Consequences (testable):**
- Each weird stat is tallied per Player per Match from native Demo events (all proven extractable in the spike).
- A weird stat with a zero count is recorded as zero, not omitted.

#### FR-20: Derived stats (entry frags, 1vX clutches)

The system derives entry frags / opening duels and 1vX clutches from the Demo event stream.

**Consequences (testable):**
- An **entry frag** is the first kill of a round after the freeze time ends `[ASSUMPTION: opening duels are measured from freeze-time end (round live), not round start]`; the first Player to die that round takes the **opening death**; **entry success rate** = entry frags ÷ (entry frags + opening deaths). Rounds with no kills produce no opening duel. Bomb/suicide deaths are not opening deaths.
- A **1vX clutch** is recorded when a Player becomes the last alive on their team (X = living opponents at that instant) and their team then wins the round by elimination **or** objective (bomb explosion, defuse, or time); clutches are recorded by X (1v1…1v5).
- Derived-stat values are reproducible from the same Demo.

#### FR-21: Anti-farm thresholds & AFK/idle DQ

The system enforces minimum-participation floors and disqualifies idle Players' Match stats from Award eligibility.

**Consequences (testable):**
- A Player is eligible for a rate-class or comedy ("worst") Award only if they meet the floor: `[ASSUMPTION: ≥ 24 rounds played]`, and HS%/rate Awards additionally require `[ASSUMPTION: ≥ 20 kills]` so a 1-kill 100% cannot win. The same floors apply to "worst" Awards so nobody farms a wooden spoon by quitting early.
- A Player flagged AFK/idle for `[ASSUMPTION: ≥ 50%]` of a Match's rounds has that Match's stats excluded from all Award eligibility (positive *and* "worst"); the affected Stat row carries a visible `idle_dq` marker (with the idle-round count) in the Admin console.
- Idle detection reads Demo activity (no movement beyond a small position epsilon and no shots/utility/damage) per round. *(Requires per-tick position tracking not exercised in the PoC — see addendum §4; this adds parse cost that must stay within SM-5.)*

#### FR-22: Rate vs volume normalization

Leaderboards present rate-class stats normalized per opportunity and volume-class stats as totals.

**Consequences (testable):**
- A rate leaderboard (e.g., ADR, HS%, entry success, KAST) ranks by the normalized value and hides Players below the eligibility floor (FR-21).
- A volume leaderboard (e.g., total kills, knife kills) ranks by totals across completed Matches.
- Each leaderboard states its class so a Viewer can tell a rate race from a volume race.

#### FR-23: Leaderboards / stat views

A Viewer can browse leaderboards and a Player's stat detail, mobile-first.

**Consequences (testable):**
- Leaderboards are usable on a phone screen without horizontal scrolling for the primary ranking.
- Only Approved stats appear; Pending and DQ'd contributions are excluded.
- A Player detail view shows their core, weird, and derived stats with the Matches behind them.

### 4.5 Awards Roulette

**Description:** The second reward track. The Admin curates an Award catalog across four buckets; categories stay blurred until the Ceremony. The Ceremony runs Spins, each a Two-stage draw (luck picks live categories, stats pick winners) under the Anti-sweep cap, all seeded by the final Demo's hash so the whole thing is reproducible. A Pity roulette guarantees nobody leaves empty-handed. Together these mechanics are how the app **manufactures spotlight for the players the bracket left behind** — the product's core move. Realizes UJ-1, UJ-4.

#### FR-24: Award catalog & buckets

The Admin curates the Award catalog before the Ceremony; each Award is assigned a bucket, a class, a deciding stat, and an eligibility floor, and stays blurred from non-Admins until its Spin.

**Consequences (testable):**
- Each Award declares its bucket (skill / comedy / clutch / weird-demo-only), class (rate / volume), deciding stat, and eligibility floor (FR-21).
- Award categories are hidden from Viewers until revealed in the Ceremony.
- The catalog and the Approved stat snapshot are locked when the Ceremony starts. `[ASSUMPTION: the comedy/"shame" bucket ships with sharp, funny framing and no privacy/opt-out controls, because the group is private — see Non-Goals.]`

#### FR-25: Two-stage draw

Each Spin selects live categories by seeded luck (Stage 1), then deterministically resolves each live category's winner from the locked stat snapshot (Stage 2).

**Consequences (testable):**
- Given the same Provably-fair seed and stat snapshot, the set of live categories per Spin and the winners are identical on every run.
- A live category's winner is the eligible Player with the best deciding-stat value; ties resolve via FR-29.
- No Award is revealed or assigned before its Spin.

#### FR-26: Anti-sweep (one-per-Spin cap + luck-meter)

Within a Spin, a Player can win at most one trophy; a hidden luck-meter biases Stage-1 category selection toward Players with empty shelves.

**Consequences (testable):**
- If a Player would deterministically win two live categories in one Spin, they receive the higher-priority one and the other passes to the next-eligible Player via FR-29.
- The luck-meter weighting is derived from the seed (reproducible) and is not shown to Players during the event.

#### FR-27: Provably-fair seed

The draw is seeded by the SHA-256 hash of the final (championship-deciding) Match's Demo, published with the results, so anyone can recompute the Ceremony.

**Consequences (testable):**
- The published seed equals the SHA-256 of the retained final Demo (FR-15), byte-for-byte verifiable.
- A client-side reproduction using the published seed, stat snapshot, and algorithm yields identical live-category selections and winners.
- The seed is fixed once the final Demo is Approved; there is no re-roll.

#### FR-28: Pity roulette

Any Player who holds zero Awards after the main Spins enters a guaranteed consolation draw.

**Consequences (testable):**
- After the Ceremony, every registered Player who was not fully AFK/idle-DQ'd holds at least one Award or a Pity consolation Award.
- The Pity draw is itself seeded and reproducible.

#### FR-29: Award-tie ladder

Ties on a deciding stat resolve by a fixed ladder ending in a shared co-winner trophy.

**Consequences (testable):**
- The ladder is applied in order: (1) better secondary relevant stat, (2) better rate/efficiency (fewer opportunities used), (3) head-to-head result where the two tied Players met in a completed Match and the deciding stat is comparable there (deterministically skipped when they never met), (4) earliest achievement timestamp, (5) shared co-winner trophy.
- The ladder is deterministic and produces identical outcomes on reproduction.
- A bottomed-out tie is recorded as a shared co-winner Award for all tied Players.

#### FR-30: Ceremony reveal

The Ceremony presents each Spin as a spinning-wheel animation with a dramatic per-category flip, on mobile and a shared screen, and is built to present well on a shared screen / stream (recap-ready).

**Consequences (testable):**
- Categories remain blurred until their Spin reveals them.
- The reveal order follows the seeded Spin sequence.
- The Ceremony outcome is replayable/linkable after the event and reproduces the same winners.

### 4.6 Tournament Home / Timeline Feed

**Description:** The tournament home is where everyone lives during the event. A chronological Timeline feed is the single surfaced source of truth — Bracket advances, Match results, and Award reveals all post there, live — and the home ties together the Bracket, leaderboards, and Ceremony surfaces. Realizes UJ-1, UJ-2.

#### FR-31: Timeline feed (single source of truth)

The Timeline feed posts Bracket advances, Approved Match results, and Award reveals in chronological order, updating live.

**Consequences (testable):**
- An Approved Match result, a Bracket advance, and an Award reveal each post an entry to the feed.
- Connected Viewers see new feed entries without a manual refresh `[ASSUMPTION: within ~2 s — see NFRs]`.
- The feed reflects only Approved events; Pending Ingestion does not post.

#### FR-32: Navigation / information architecture

The tournament home gives mobile-first navigation across the Timeline feed, the Bracket, leaderboards, and (at end of event) the Ceremony.

**Consequences (testable):**
- A Viewer can reach the Bracket, leaderboards, and feed from the home on a phone without desktop layout assumptions.
- The Ceremony surface becomes reachable when the Admin starts it.

### 4.7 Admin Console vs Viewer

**Description:** The Admin runs the event from a console that gathers the event-mutating actions; everyone else gets a clean read-only experience. Realizes UJ-2, UJ-3, UJ-5.

#### FR-33: Admin-gated actions

The Admin console exposes roster management, Bracket generation/advancement, Ingestion approval and re-parse/rollback, Match-format/tie declaration, and Ceremony control — all server-enforced as Admin-only.

**Consequences (testable):**
- Each listed action is rejected server-side for non-Admins (FR-4).
- Admin actions that mutate event state are logged with actor and timestamp.

#### FR-34: Viewer read-only mode

A Viewer has full read access to the Bracket, leaderboards, Timeline feed, and Ceremony, and no mutating capability.

**Consequences (testable):**
- A Viewer can follow the entire event end-to-end without any Admin capability appearing or succeeding.

## 5. Non-Goals (Explicit)

This product is **not** a public tournament platform, a betting/odds product, or a league system in v1. It will **not**:

- Handle money, track amounts, or process payments — winners are recorded only; prizes (token shirts) are settled outside the app.
- Model any prize-budget cap or prize-eligibility limit — `[NON-GOAL for MVP]` token prizes make it unnecessary. Anti-sweep and pity remain the accepted mitigation for award concentration (one stat-monster sweeping every trophy); with token prizes, no further cap is warranted.
- Ship a gentle/privacy mode or opt-out for comedy/"shame" Awards — `[NON-GOAL for MVP]` the group is private; this becomes a prerequisite only if the app is ever opened to the public. `[NOTE FOR PM: revisit before any non-private deployment.]`
- Do in-app scheduling, match windows, time zones, or reminders — coordinate in Discord.
- Build season-persistence features (status tiers, claimable map segments, achievement log, hall of fame) — the schema is seasons-aware, but none ship.
- Provide a Discord bot front door, a predictions/house-chips economy, MVP eye-test voting, a Player "Wrapped"/recap, or fantasy drafting — all deferred to the Meta-games track post-v1.
- Ship as a native mobile app — responsive web only.

## 6. MVP Scope

### 6.1 In Scope

- Roster + Steam OAuth with SteamID64 capture and reconciliation; Admin vs Viewer roles.
- Random-seeded double-elimination Bracket (8–16, Byes), tap/drag advance, live updates, no-show/Forfeit with grace timer, pre-declared Match format/tie policy.
- Staged Demo Ingestion (MatchZy + Manual upload, Pending → Approved, Re-parse/Rollback, raw-Demo retention + hash, Demo-derived score, Walkover stat hygiene).
- Derived Stats & leaderboards (core + weird + derived stats, anti-farm + AFK/idle DQ, rate vs volume), mobile-first.
- Awards Roulette (catalog/buckets, Two-stage draw, Anti-sweep, Provably-fair seed, Pity roulette, Award-tie ladder, Ceremony reveal).
- Tournament-home Timeline feed (single source of truth, live).
- One-off event on a seasons-aware schema.

### 6.2 Out of Scope for MVP

- The Meta-games reward track (predictions, fantasy, streaks) — deferred to v2.
- Money/prize handling and any prize-cap logic — out by decision (token prizes).
- Gentle/privacy mode for comedy Awards — out because the group is private. `[NOTE FOR PM: emotionally load-bearing only if the app goes public.]`
- In-app scheduling/reminders, Discord bot, Player Wrapped, season features — deferred.
- Fully hands-off hosted auto-ingestion may be reduced to an Admin-run local parse for v1 — a worker-hosting decision deferred to Architecture (see Open Questions).

## 7. Success Metrics

**Primary**

- **SM-1 — Zero manual stat entry.** 100% of completed (non-Forfeit) Matches have stats sourced from their Demo, with no hand-typed stat lines. Validates FR-11–FR-16, FR-18–FR-20.
- **SM-2 — Everyone stays in it.** Every registered Player has at least one live reward track (Bracket, a leaderboard position, or the guaranteed Pity draw) until the final Ceremony; zero Players finish with no shot at a prize. Validates FR-24–FR-29.
- **SM-3 — No unresolved rigging disputes.** Every contested Match resolves to its Demo and every Awards result is reproducible from the published seed; target = 0 unresolved disputes. Validates FR-14, FR-15, FR-16, FR-27.
- **SM-4 — One full event, end-to-end on the app.** Registration → champion crowning → Ceremony runs entirely in the app with no spreadsheet fallback. Binary. Validates the whole spine.

**Secondary**

- **SM-5 — Demo-to-stats latency is "soon enough."** Stats appear within minutes of a Demo landing: `[ASSUMPTION: P50 < 5 minutes, P95 < 15 minutes]`. Validates FR-11–FR-13.

**Counter-metrics (do not optimize)**

- **SM-C1 — Award credibility.** Zero Awards won by AFK/idle farming or below-floor participation slip through the DQ. Counterbalances SM-2 — spreading the fun must not reward gaming. Validates FR-21.
- **SM-C2 — Admin effort stays low.** The Admin spends less time running the tool than a spreadsheet would: `[ASSUMPTION: < ~2 minutes hands-on per Match to ingest + approve]`. Counterbalances the automation push behind SM-1/SM-5 — don't trade manual entry for manual babysitting.

## 8. Cross-Cutting NFRs

- **Performance.** Demo-to-stats latency per SM-5. Live Bracket/feed propagation to connected Viewers within `[ASSUMPTION: ~2 s]`. Parsing a 170 MB Demo completes in seconds (PoC: ~3.4 s, ~257 MB RAM).
- **Mobile-first responsiveness.** Every Viewer surface (home, feed, Bracket, leaderboards, Ceremony) is usable one-handed on a phone; Admin surfaces may assume a larger screen.
- **Reliability & re-runnability.** Ingestion is idempotent on `match_id` + SteamID64; raw Demos are retained so any Match can be Re-parsed; the parser version is pinned to survive Valve format churn.
- **Security & authorization.** Steam OAuth for identity; all event-mutating actions are server-enforced Admin-only; worker writes use a service-role path distinct from Viewer access.
- **Verifiability.** The Provably-fair seed (final Demo hash), the stat snapshot, and the draw algorithm are published so any Player can independently reproduce the Awards Ceremony; every retained Demo is re-hashable to its stored value.
- **Data.** SteamID64 is the canonical join key across Roster and stats; the schema is seasons-aware (no season features built).

## 9. Constraints & Guardrails

These shape requirements; the implementation "how" is an Architecture decision (see `addendum.md`).

- **Demo files are 50–170 MB.** They exceed both the Vercel/Next.js serverless request body cap (~4.5 MB) **and** the Supabase free-tier file cap (50 MB). Therefore a Demo body **must not** be POSTed through a Vercel function (FR-11): it goes directly to the worker or to storage via a signed/resumable upload.
- **Raw Demos must be deliberately retained** (FR-15) because they are the dispute referee *and* the provably-fair seed source. This requires real object storage and is a **real cost line**, not a free-tier bucket.
- **MatchZy backbone + Manual fallback** is the only reliable Demo source; Valve matchmaking share-codes (expire in ~7–14 days) are explicitly not relied upon.

## 10. Open Questions

1. **Award catalog content.** The exact list of Awards per bucket (and their deciding stats / floors) is Admin-curated and to be finalized before the event — a UX/content task, not a code blocker. (FR-24)
2. **Worker hosting for v1.** Local Go CLI (Admin-run per Match, zero hosting cost, proven) vs. a hosted worker (Railway ~$5/mo, Fly ~$11/mo) for fully hands-off auto-ingestion — an Architecture decision that affects whether MatchZy auto-upload is live at v1. (FR-11, §6.2)
3. **Parser-language fork.** `demoinfocs-golang` (Go, proven, most battle-tested) vs. `demoparser2` (Node/TS, stack unification) — Architecture decision. (addendum)
4. **Match format(s).** The specific CS2 format per Bracket round (e.g., MR12 + overtime rule) is set by the organizer before the event. (FR-10)
5. **Threshold tuning.** Anti-farm floors (24 rounds / 20 kills) and the AFK/idle threshold (50%) are starting defaults to validate against real event data. (FR-21)
6. **Dispute flow surface.** Proposed: disputes are raised out-of-app (Discord); the app provides the in-app *evidence* (re-parse + published hash). Confirm whether any in-app "raise dispute" affordance is wanted. (FR-14, UJ-3)
7. **Ceremony pacing.** How the catalog maps to the number and grouping of Spins is a UX decision. (FR-30)
8. **Raw-Demo retention lifecycle.** How long retained Demos are kept and any archival/deletion policy — they back dispute resolution and the provably-fair seed, so retention cannot be arbitrary; a storage-cost + Architecture decision. (FR-15)

## 11. Assumptions Index

*Every `[ASSUMPTION]` from the document, for explicit confirmation:*

- §2.2 / §4.5 FR-24 — The group is private and trusted; comedy/"shame" Awards ship with no privacy/opt-out controls.
- §4.1 FR-3 — Registration is open-join-by-Steam within a window, then closed; no application/approval step.
- §4.2 FR-7 / §4.6 FR-31 / NFRs — Live propagation target is ~2 s.
- §4.2 FR-9 — Default grace timer is 10 minutes, Admin-configurable.
- §4.4 FR-18 — ADR is overkill-capped (scoreboard-matching) — *locked, user-confirmed*; KAST trade window is 5 seconds.
- §4.4 FR-20 — Entry frag is measured from freeze-time end (round live).
- §4.4 FR-21 — Anti-farm floor = 24 rounds played; HS%/rate Awards also require 20 kills; AFK/idle DQ at ≥ 50% idle rounds.
- §4.5 FR-27 — The provably-fair seed is specifically the final (championship-deciding) Match's Demo hash.
- §4.4 FR-21 / addendum — AFK/idle DQ requires per-tick position tracking not exercised in the PoC (parsing-extension risk).
- §7 SM-5 / SM-C2 — Latency targets P50 < 5 min / P95 < 15 min; Admin effort < ~2 min per Match.
