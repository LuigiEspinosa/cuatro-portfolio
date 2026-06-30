---
title: Technical Input Reconciliation — PRD vs Phase-1 Inputs
status: draft
created: 2026-06-29
updated: 2026-06-29
---

# Technical Input Reconciliation

**Purpose:** Verify that the technical depth and flagged open items in the Phase-1 brief addendum and the demo-parsing research spike were faithfully converted into the new PRD (`prd.md`) and its addendum (`addendum.md`). This is a coverage audit — it finds GAPS, it does not propose rewrites.

**Inputs checked:**
1. Brief addendum — `briefs/brief-cs-tournament-2026-06-29/addendum.md`
2. Research spike — `research/technical-cs2-demo-parsing-research-2026-06-29.md`
3. PRD — `prds/prd-cs-tournament-2026-06-29/prd.md`
4. PRD addendum — `prds/prd-cs-tournament-2026-06-29/addendum.md`

---

## Faithful Coverage Summary

The conversion is, overall, strong and disciplined. The following Phase-1 items are correctly carried forward:

**Phase-1 "OPEN / needs PRD definition" items — almost all landed as concrete rules:**
- **Entry frag** → concrete rule in FR-20: first kill after freeze-time end; opening death = first to die; entry success = entry frags ÷ (entry frags + opening deaths); bomb/suicide deaths excluded. Glossary + Assumptions Index §4.4 cover it.
- **1vX clutch** → concrete rule in FR-20: last alive on team, round won by elim OR objective (bomb/defuse/time), recorded by X (1v1–1v5).
- **Anti-farm thresholds** → concrete defaults in FR-21: ≥ 24 rounds; HS%/rate Awards additionally ≥ 20 kills; applied to "worst"/comedy Awards too. Flagged tunable in Open Question 5.
- **AFK/idle DQ** → FR-21: DQ at ≥ 50% idle rounds, idle = no movement beyond epsilon + no shots/utility/damage; flagged as needing per-tick tracking unproven in PoC (addendum §4, Assumptions Index, FR-21 inline note).
- **ADR convention** → LOCKED as overkill-capped (≤100/victim/round) matching scoreboard; FR-18, Glossary, Assumptions Index (marked user-confirmed), addendum risk #5.
- **KAST** → defined in FR-18 + Glossary; trade window = 5 s assumption; routed as derived stat in addendum §3.
- **Tie-break policy (pre-declared, per match)** → FR-10: format + overtime/tie rule declared/stored/enforced before match, no ad-hoc mid-match changes.
- **Award-tie ladder** → FR-29: explicit 5-step ladder ending in shared co-winner trophy; Glossary defines it.
- **Walkover/forfeit stat hygiene** → FR-17 + FR-9 + Glossary: forfeits yield no stat rows; leaderboards normalize for matches played; rate vs volume both addressed.

**Pipeline constraints — fully represented:**
- Vercel 4.5 MB body cap, Supabase 50 MB file cap, and deliberate raw-demo retention all appear in §9 Constraints & Guardrails, FR-11, FR-15, and addendum §2. The "MatchZy → Vercel API → Supabase" broken-path correction is preserved verbatim in addendum §2.

**Risk register — all 6 carried forward:** addendum §6 reproduces the full 6-item register (Valve churn, demo storage cost, parser fork, derived-stats spec'ing, ADR convention, demo-acquisition-needs-a-server) with likelihood/impact, mitigation, and PRD tie-ins.

**Parser-language fork + worker-hosting deferral — correctly routed, not silently decided:** Open Questions 2 (worker hosting) and 3 (parser fork) keep both as Architecture decisions; addendum §1 and §2 preserve the decision criteria; PRD §0 explicitly says the parser library/worker hosting lives in the addendum, and §3 of the locked-decisions list does NOT pre-pick a parser.

**Proven parser capabilities — all present in stats FRs:** knife kills, wallbangs, through-smoke, no-scope, blind kills, flash assists, MVP, utility/molotov/HE damage all appear in FR-18/FR-19, and the addendum §3 field table preserves the proven `demoinfocs-golang` field/method names with confirmed-vs-derive status.

**No proven/unproven contradictions of substance** in the headline claims: the PRD correctly calls the weird stats "proven extractable in the spike" (FR-19) and flags AFK/idle position-tracking as unproven (FR-21, addendum §4). The "~3.4 s / ~257 MB RAM" PoC numbers are reproduced accurately.

---

## Gaps List

### GAP 1 — Prize-budget cap is dropped to a Non-Goal; the Phase-1 "OPEN" item is arguably resolved-by-decision, but the demotion is a real scope change worth flagging
- **Severity:** Medium
- **What's missing:** The brief addendum §5 lists "**Prize-budget cap per player** — limit how many awards count toward the prize budget so one stat-monster can't hoover everything" as an edge-case rule to *specify in the PRD*. The PRD instead **declines** it: §5 Non-Goals and §6.2 say "Model any prize-budget cap … `[NON-GOAL for MVP]` token prizes make it unnecessary." This is a legitimate decision (no money in app), but it is a *reversal* of a Phase-1 "to-spec" item rather than a conversion. The Phase-1 concern (one player hoovering all awards) is only partially absorbed by anti-sweep/pity, which spread *trophies* but do not cap *prize-eligible* wins. No Open Question logs the residual.
- **Where it should live:** Already in §5/§6.2 as a NON-GOAL — acceptable, but the decision is silent on the original "stat-monster hoovers everything" worry beyond anti-sweep. Consider an Open Question or one-line note that the prize-cap concern is consciously delegated to anti-sweep + pity, not separately enforced. Low-cost to close.

### GAP 2 — Gentle/opt-out "shame" mode: the Phase-1 input said "REQUIRED before any such award ships publicly"; PRD makes it a Non-Goal. Faithfully captured, but verify the conditional is preserved (it is) — minor wording risk
- **Severity:** Low
- **What's missing:** Brief addendum §5 wording is strong: gentle mode is "**required** before any such award ships publicly, to prevent privacy harm." The PRD demotes to Non-Goal (§5, §6.2) but **does** preserve the conditional ("becomes a prerequisite only if the app is ever opened to the public" + `[NOTE FOR PM: revisit before any non-private deployment.]`). This is faithful. The only residual gap: the PRD nowhere states that the *comedy/shame awards ship live by default in v1* is the thing the gate is protecting against — it is implied via the private-group assumption (§2.2, FR-24). No action strictly required; logged for completeness.
- **Where it should live:** Covered in §5/§6.2/§2.2/FR-24. No gap of substance; included only because the Phase-1 language was emphatic ("required") and a reader skimming Non-Goals could miss the public-deployment trigger.

### GAP 3 — Demo size "well within latency target" claim vs. AFK/idle per-tick cost is internally tensioned but not cross-checked in SM-5
- **Severity:** Medium
- **What's missing:** FR-12 says parsing a 170 MB demo "completes well within the latency target (PoC ~3.4 s)." But the PoC's 3.4 s was **event-only** parsing; the addendum §4 correctly warns that AFK/idle detection "adds parse cost (per-tick sampling vs. event-only)" and is **unproven**. The PRD's SM-5 latency assumption (P50 < 5 min / P95 < 15 min) has huge headroom, so this is unlikely to bite — but FR-12's "PoC measured ~3.4 s" is quietly conflated with the full (position-tracking) parse the product actually needs. The addendum §4 flags it for Architecture (confirm added parse time stays within SM-5); the PRD body does not cross-reference that caveat at FR-12.
- **Where it should live:** Addendum §4 already owns it. A one-clause cross-reference at FR-12 or NFR Performance ("the ~3.4 s figure is event-only; per-tick AFK tracking adds cost — see addendum §4") would close the loop. Low effort.

### GAP 4 — Raw-demo retention duration / lifecycle is unspecified
- **Severity:** Low
- **What's missing:** Both Phase-1 inputs treat raw-demo retention as a deliberate, costed line (brief addendum §2/§6 risk 2; spike Q4/risk 2). The PRD captures *that demos are retained* (FR-15, §9, addendum risk #2) and that storage is a cost line — but neither doc states **how long** demos are retained, or whether they can be archived/discarded after the season closes. The spike even floats "worker owns the demo (parse then archive/discard)" as an option. Because the demo is also the provably-fair seed source and dispute referee, a retention-duration decision has product consequences (a discarded demo breaks re-parse and seed re-verification). It is neither a concrete rule nor a logged Open Question.
- **Where it should live:** Either §9 Constraints (a retention-duration guardrail) or Open Questions (Architecture/cost decision). Currently absent from both.

### GAP 5 — `demoparser2` field-name "reported, not first-hand verified" status is dropped from the PRD addendum's field table
- **Severity:** Low
- **What's missing:** The spike Q3 table carries two columns — verified `demoinfocs-golang` fields **and** *reported* `demoparser2` fields — and is careful to mark the latter "reported." The PRD addendum §3 keeps only the `demoinfocs-golang` column (fine, since Go is the proven path), but the parser-fork (addendum §1, Open Question 3) keeps `demoparser2` alive as a real alternative. If Architecture picks `demoparser2`, the PRD-side docs no longer carry the caveat that its field names were never first-hand verified and must be re-confirmed. The spike's verification note covers this generally, and addendum §7 reproduces it — so it is *not* lost, just less specific. Minor.
- **Where it should live:** Addendum §1 (parser fork) could note "if `demoparser2` is chosen, its field mapping is web-research-only and must be PoC-verified." Verification note §7 partially covers it.

### GAP 6 — Demo-acquisition fallback chain loses the Valve MM share-code "last resort" tier nuance
- **Severity:** Low
- **What's missing:** The brief addendum §3 and spike Q1 define a **three-tier** acquisition stance: MatchZy backbone → admin manual upload fallback → Valve MM share-codes as an explicit *last resort* (with the 7–14 day expiry caveat). The PRD collapses this to two tiers (MatchZy + Manual upload) and treats share-codes only as something "explicitly not relied upon" (§9). That is a defensible simplification, but the *option* of share-codes as an emergency manual path (an admin pulls their own demo via share-code, then manual-uploads) is silently removed rather than logged as out-of-scope. Manual upload (FR-11) could still ingest such a demo, so nothing is broken — but the explicit "last resort" tier is gone.
- **Where it should live:** §9 already names share-code expiry; a half-sentence that manual upload can still accept a share-code-sourced demo (without relying on it) would preserve the Phase-1 tiering. Optional.

---

## Net Assessment

No **high-severity** gaps. Every Phase-1 "OPEN / needs PRD definition" item is either a concrete rule or a logged Open Question — none fell through silently. Pipeline constraints, the full 6-item risk register, the parser fork, the worker-hosting deferral, and every proven parser capability are faithfully carried. No document falsely claims an unproven capability is proven (the AFK/idle position-tracking caveat is correctly preserved as the one open parsing-extension risk).

The medium items are tighten-ups rather than omissions:
- **GAP 1** (prize cap demoted from to-spec → Non-Goal without logging the residual concern),
- **GAP 3** (FR-12's 3.4 s is event-only; the AFK/idle parse-cost caveat lives only in the addendum),
- **GAP 4** (retention *duration* unspecified anywhere).

The low items (GAPs 2, 5, 6) are wording/traceability nuances, not capability loss.
