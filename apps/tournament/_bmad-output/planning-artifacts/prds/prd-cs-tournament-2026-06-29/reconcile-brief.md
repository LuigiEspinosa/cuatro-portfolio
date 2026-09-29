---
title: "Input Reconciliation — Brief/Brainstorm → PRD"
status: draft
created: 2026-06-29
updated: 2026-06-29
---

# Input Reconciliation: Brief + Brainstorm → PRD

Checks that nothing important from the **product brief** and **brainstorm intent** was silently dropped from the just-authored **PRD**. Reviewer note: this is a coverage audit, not a rewrite. Gaps are flagged with location + severity; no fixes proposed.

**Inputs:**
- Brief: `briefs/brief-cs-tournament-2026-06-29/brief.md`
- Brainstorm intent: `brainstorm-cs2-tournament-2026-06-29/brainstorm-intent.md`
- PRD: `prds/prd-cs-tournament-2026-06-29/prd.md`

---

## Faithful coverage summary

The PRD carries the great majority of the brief/brainstorm forward, and frequently *upgrades* loose intent into testable FRs. Confirmed faithful:

**Three-reward-track thesis & spine.** Carried verbatim in §1 Vision and §0: Champion + Awards Roulette in v1, Meta-games deferred. The "two best players pull ahead / nobody is mathematically out until the final ceremony" thesis is stated in §1 and operationalized as **SM-2** ("Everyone stays in it"). Track 3 (Meta-games) is correctly deferred in §5 Non-Goals and §6.2.

**Demo-as-keystone, one-artifact-three-jobs.** §1, §3 Glossary (Demo), FR-15 (retention + hash), FR-16 (score derivation), FR-27 (seed). The "stats source + dispute referee + RNG seed" framing is intact.

**Provably-fair draw as a *trust/anti-rigging* feature.** FR-27, SM-3, NFR Verifiability, and UJ-3 (Dex) all preserve the "rigging *accusations* are the real threat" insight from both inputs.

**Steam OAuth triple-win.** FR-1, FR-2, §3, NFR Security. Identity + SteamID64 join key + reconciliation surface all present (FR-2 even adds the "unreconciled row surfaced, not dropped" consequence).

**Awards Roulette mechanics** are the most thoroughly transcribed section — four buckets (FR-24), two-stage draw (FR-25), one-per-spin + luck-meter anti-sweep (FR-26), rate/volume classes (FR-22, §3), anti-farm + AFK/idle DQ (FR-21), provably-fair seed = final-demo hash (FR-27), spinning-wheel ceremony (FR-30), pity roulette (FR-28), award-tie ladder with shared co-winner (FR-29). The "blurred/mystery until ceremony" hook is in FR-24, FR-25, FR-30 and dramatized in UJ-1/UJ-4.

**Bracket scope.** Double-elim, random recorded seed, tap/drag advance, live updates, auto-byes ("bye is a badge, not a phantom stat win"), no-show/forfeit + grace timer — FR-5..FR-10, FR-17. Faithful, including the bye-badge nuance.

**Staged ingestion.** MatchZy + manual fallback (FR-11), pending→approve (FR-13), re-parse/rollback (FR-14), score-from-demo (FR-16). Faithful.

**Brief "Out" list** maps cleanly to §5 Non-Goals / §6.2: money-out, scheduling parked, season-persistence schema-only, Discord bot, predictions/chips, MVP eye-test vote, Wrapped, fantasy, gentle/privacy mode.

**Locked decisions** (§0, §9) all preserved and not re-litigated: 8–16, double-elim, Next.js+Supabase+Vercel+Go worker, demo-as-truth, Steam OAuth, winners-only/no-money, mobile-first, one-off-on-seasons-aware-schema, MatchZy+manual, scheduling parked. The Go-vs-Node parser fork is correctly held open as an Architecture decision (Open Q3), not decided.

**Brief Success Criteria → Success Metrics:** zero manual entry→SM-1; everyone stays in→SM-2; no unresolved rigging→SM-3; one full event end-to-end→SM-4; demo-to-stats latency→SM-5. All five mapped. Anti-farm-credibility added as counter-metric SM-C1; admin-effort as SM-C2. Strong.

**Brainstorm "edge cases & fairness rules":** tie-break-before-match (FR-10), award-tie ladder + co-winner (FR-29), walkover stat hygiene (FR-17). Three of five carried. (Remaining two — prize-budget cap, gentle mode — were *consciously* cut by locked decision; see gaps for nuance.)

---

## Gaps

### G1 — "Manufacture spotlight for non-winners" as a named reusable capability — MEDIUM
- **Both inputs** elevate "manufacture spotlight for non-winners" to a *strategic insight / reusable capability* (brief "What Makes This Different" bullet 4; brainstorm "Key strategic insights"). The brainstorm explicitly ties it to pity-roulette today AND Wrapped/nominations/achievements later — it's framed as the product's underlying move, not a feature.
- **PRD status:** The *mechanics* exist (pity roulette FR-28, anti-sweep luck-meter FR-26 bias toward empty shelves), but the PRD never names the unifying capability or its forward-reuse story. The "one move applied in many places" framing is dropped.
- **Where it should live:** §1 Vision or §4.5 Description, and/or the Vision/forward-looking note.
- **Severity rationale:** Mechanically covered, so v1 is unaffected; but the *soul-level* product thesis ("we manufacture spotlight") is flattened into individual features. Medium because it's strategic-intent loss, not scope loss.

### G2 — Emotional/qualitative tone of the Awards Ceremony as "drama" — LOW/MEDIUM
- **Brainstorm** describes the ceremony as "a literal spinning-wheel reveal… **dramatic** per-category flip, **recap- and stream-ready**." Brief calls it the "spinning-wheel ceremony." The *feel* — drama, theatre, stream/recap-readiness — is part of the product's payoff moment.
- **PRD status:** FR-30 captures "spinning-wheel animation with a dramatic per-category flip" and "replayable/linkable after the event" (the recap/stream-ready intent partially survives). But "stream-ready" as an explicit quality and the emotional weight of the ceremony as the event's *climax* are thin — reduced to animation mechanics. UJ-4 narrative does carry some drama ("every category flips dramatically").
- **Where it should live:** §4.5 Description and/or FR-30 consequences; possibly an NFR for the ceremony surface.
- **Severity rationale:** Low-to-medium. The word "dramatic" and replay/link survive, so it's not fully dropped — but "stream-ready / recap-ready" as a deliberate quality target is effectively gone.

### G3 — Prize-budget cap per player — LOW (consciously cut, but verify the cut is intended)
- **Brainstorm** lists "**Prize-budget cap per player** — limit how many awards count toward the real prize budget so a stat-monster can't hoover all prizes" as a fairness rule to specify in the PRD.
- **PRD status:** Explicitly cut — §5 and §6.2 mark prize-cap logic `[NON-GOAL for MVP]`, reasoning "token prizes make it unnecessary (anti-sweep and pity still spread trophies for fun)." This is a *defensible, deliberate* decision flowing from the locked "winners-only, money-out" decision.
- **Where it should live:** Already addressed in §5 Non-Goals.
- **Severity rationale:** LOW — not a silent drop; it's a reasoned cut. Flagged only so the parent confirms the brainstorm's anti-hoover concern is genuinely neutralized by anti-sweep+pity (it largely is, for *fun*; the *real-money* hoover concern is moot once money is out). No action likely needed.

### G4 — Gentle/privacy mode framing: "required before any public shame award ships" — LOW (faithful, with a subtle softening)
- **Brief "Out" list** is emphatic: gentle/privacy mode is parked *but* "**required before any public 'shame' award ships**." Brainstorm lists "Opt-in visibility / gentle mode… to prevent privacy harm."
- **PRD status:** Faithfully carried in §5 and §6.2 with `[NOTE FOR PM: revisit before any non-private deployment]` and "emotionally load-bearing only if the app goes public." This matches intent.
- **Severity rationale:** LOW / essentially faithful. Minor nuance: brief's trigger is "before any public *shame award* ships"; PRD reframes trigger as "non-private *deployment*." Slightly different boundary (a public shame award vs. opening the whole app), but same spirit. Flag only for precision.

### G5 — "Luck + skill + showing up" three-way framing — LOW (present but compressed)
- **Brief** Executive Summary: "Skill, luck, and just showing up each pay out separately." This three-way framing (skill=Champion, luck=Roulette, showing-up=participation/Meta) is the emotional core of why all three tracks exist.
- **PRD status:** §1 says "skill, luck, and simply showing up each pay out on their own" — **faithful**. But note: "showing up" maps primarily to the *Meta-games* track, which is **deferred**. In v1 only skill (Champion) and luck (Roulette) literally pay out; "showing up" is served only indirectly (pity roulette, volume awards, leaderboard presence). The PRD's §1 phrasing could read as promising a v1 payout for "showing up" that is really a v2 (Meta-games) feature.
- **Where it should live:** §1 Vision — worth a reviewer check that the "showing up pays out" promise is clearly satisfied in v1 by pity-roulette/volume-awards, not silently dependent on deferred Meta-games.
- **Severity rationale:** LOW — the framing is present; the risk is a subtle over-promise, not a drop.

### G6 — "Demo-to-stats latency 'soon enough' / within minutes" qualitative softness — LOW (faithful, hardened)
- **Brief** success criterion is deliberately soft: "'soon enough' — stats appear within minutes." 
- **PRD status:** SM-5 hardens this to `P50 < 5 min / P95 < 15 min` (tagged ASSUMPTION, listed in Open Q / Assumptions). This is an *improvement*, not a gap — flagged only to confirm the parent is comfortable that a brief "soft" target was made concrete (it's tagged as an assumption to confirm, so the process is correct).
- **Severity rationale:** LOW — faithful + hardened, properly tagged.

### G7 — Discord as the coordination/dispute surface — LOW (implicit, mostly fine)
- **Brief & brainstorm** repeatedly position Discord as where the group *already* lives (coordination, scheduling, the dispute argument itself). Brief: "coordinate in Discord." Brainstorm vision: Discord bot as "real front door."
- **PRD status:** Discord bot correctly deferred (§5). Coordination-in-Discord acknowledged in §5 ("coordinate in Discord"). UJ-3 and Open Q6 correctly assume disputes are *raised* in Discord with the app supplying evidence. Faithful.
- **Severity rationale:** LOW — no real gap. Noted for completeness; the dispute-surface boundary is explicitly an Open Question (Q6), which is the right treatment.

### G8 — Forfeit *leaderboard normalization* phrasing vs. brainstorm "normalize for games actually played" — LOW (faithful)
- **Brainstorm:** "normalize leaderboards for games actually played."
- **PRD:** FR-17 + FR-22 carry this precisely (rate awards over rounds actually played; volume over completed matches). Faithful — no gap.

---

## Bottom line

No **high-severity** scope drops. Every brief "In (v1)" item has matching FR coverage, all five brief success criteria map to SMs, and all locked decisions are preserved and not re-litigated. The notable losses are **qualitative/strategic, not functional**: the "manufacture spotlight for non-winners" reusable-capability framing (G1, medium) and the ceremony's "drama / stream-ready" emotional payoff (G2, low-medium). Two brainstorm fairness rules (prize-cap, gentle mode) are *consciously and defensibly* cut by locked decisions, not silently dropped (G3, G4). One phrasing in §1 ("showing up pays out") risks lightly over-promising a deferred-track benefit in v1 (G5).
