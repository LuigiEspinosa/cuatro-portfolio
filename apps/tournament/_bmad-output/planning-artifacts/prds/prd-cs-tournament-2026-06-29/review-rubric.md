# PRD Quality Review — CS2 Tournament App

## Overall verdict

This is a strong, decision-ready PRD that punches above its hobby stakes: it has a real thesis (split the reward surface so nobody is mathematically out of *every* prize), the pinned stat and fairness rules are genuinely implementable rather than hand-waved, and the FR consequences are unusually testable. What holds up: glossary discipline, ID continuity, the provably-fair mechanism, and honest scope fencing. What's at risk is small and mechanical — a handful of FR consequences still lean on soft verbs ("surfaced to the Admin," "flagged for Admin review"), one Award-tie ladder rung is underspecified for determinism, and the Assumptions Index has two minor roundtrip leaks. None of these block downstream UX/Architecture work; they're polish items a single editing pass closes.

## Decision-readiness — strong

Decisions are stated as decisions, not buried. §0 explicitly lists Phase-1 locks and refuses to re-open them; the ADR convention is marked *(Locked — see §3, Assumptions Index, and addendum)* at FR-18 and again as **LOCKED** in the addendum risk register (#5) with the consequence spelled out ("do not change post-launch or all ADR Awards break"). Trade-offs name what was given up: the worker-hosting question (Open Question 2, §6.2) states the local-CLI choice *costs* the MatchZy auto-upload happy path at v1 — that's a real trade surfaced honestly, not smoothed to neutral. The Open Questions are actually open (e.g., OQ6 "Confirm whether any in-app 'raise dispute' affordance is wanted" is a genuine ask, not rhetorical). The `[NOTE FOR PM]` callouts sit at real tensions (the gentle-mode/comedy-award fork, L451/L473), not safe checkpoints.

One soft spot: the comedy/"shame" Award decision is load-bearing for group dynamics and is asserted twice as fine because "the group is private" — defensible at these stakes, but it's the one place the PRD bets on a social assumption without a fallback, and it leans on it rather than acknowledging the bet could be wrong even within a private group.

### Findings
- **low** Comedy-award social risk stated as settled (§4.5 FR-24, §5) — "sharp, funny framing and no privacy/opt-out controls" is justified only by privacy; within an 8–16-person friend group a single bruised ego is still possible. The `[NOTE FOR PM]` only flags the *public* deployment risk. *Fix:* one line acknowledging the in-group social risk is accepted by the organizer, not just deferred to a hypothetical public launch.

## Substance over theater — strong

Almost no furniture. The five JTBD entries (§2.1) each map to shipped features, and the personas in the UJs (Theo, Mara, Dex) each *drive* something — Theo motivates the rate/volume split and blurred categories, Dex motivates re-parse + hash, Mara motivates the pending→approve flow. The Vision (§1) is not swappable boilerplate: "three independent reward tracks" and "nobody is mathematically out of *every* prize until the final ceremony" is a specific, falsifiable product bet, and it's directly measured by SM-2. The NFRs (§8) carry product-specific numbers (170 MB demo, ~3.4 s, ~257 MB RAM, ~2 s propagation) rather than "must be scalable." The differentiation ("weird demo-only stats" — knife kills, wallbangs, through-smoke) is earned by the research spike, not template-filled.

The one mild theater risk is persona count discipline — there are five JTBD personas plus five UJ protagonists, but they collapse to ~3 real actors (early-eliminated player, admin/organizer, fragger/spectator), so it stays under the rubric's "more than four personas" red flag in substance even if the surface count is higher.

### Findings
*(none material)*

## Strategic coherence — strong

The PRD has a clear thesis and the features follow from it. The reward-track split is the spine: every feature group serves "keep everyone in it AND keep it trustworthy." Prioritization follows the thesis, not ease — the Meta-games track (predictions, fantasy) is explicitly deferred (§5, §6.2) precisely because it's *not* load-bearing for the v1 bet, while the harder demo-ingestion + provably-fair ceremony work is in scope because it *is*. Success Metrics validate the thesis rather than measuring activity: SM-2 measures "everyone has a live track," SM-3 measures dispute-resolvability — there's no DAU/MAU vanity tell. Counter-metrics are present and well-chosen (SM-C1 award credibility counterbalances SM-2's "spread the fun"; SM-C2 admin effort counterbalances the automation push). MVP scope kind is coherently an "experience" build with matching scope logic.

### Findings
*(none material)*

## Done-ness clarity — adequate

This is the dimension carrying the most residual risk, though it's still good. The overwhelming majority of FRs have at least one genuinely testable consequence — many have crisp ones an engineer can write a test against directly: FR-12's conservation check ("summed kills equal summed deaths"), FR-25's determinism ("same seed and snapshot → identical live categories and winners on every run"), FR-1's "same Steam account authenticating twice resolves to a single Roster entry." The pinned stat rules are concrete: ADR (overkill-capped ≤100/victim/round ÷ rounds played), KAST (5-second trade window), entry success rate formula, 1vX clutch resolution by elimination *or* objective, and the anti-farm floors (≥24 rounds, ≥20 kills, ≥50% idle) are all implementable as written.

The gaps are soft-verb consequences that don't state a *testable* outcome:
- FR-2: an unreconciled stat row is "surfaced to the Admin as unreconciled rather than silently dropped" — "surfaced" is the only verb; what state/UI/flag constitutes "surfaced" is untestable as written.
- FR-21: an AFK-flagged Match "is flagged for Admin review" — same issue; no observable condition.
- FR-29 rung (3) "head-to-head if applicable" — "if applicable" is an undefined branch; for a determinism guarantee (the FR's own consequence #2) every rung must resolve unambiguously, and "if applicable" leaves when-it-applies unspecified.
- FR-10 / FR-16 lean on "logged and flagged" repeatedly without ever defining what a "flag" is observable as.

These are not "handles gracefully" hand-waves at the level the rubric most fears (there is no "reasonable performance" / "user-friendly" anywhere — checked), but they are the residue of that pattern and will cost a story-writer a clarifying question each.

### Findings
- **medium** Soft-verb consequences not testable (FR-2, FR-21) — "surfaced to the Admin as unreconciled" and "flagged for Admin review" name no observable state. *Fix:* tie each to a concrete consequence, e.g. "appears in an Admin 'unreconciled rows' queue and is excluded from leaderboards until resolved."
- **medium** Award-tie ladder rung 3 underspecified vs. its own determinism claim (§4.5 FR-29) — "head-to-head if applicable" leaves the applicability condition undefined, yet consequence #2 promises "identical outcomes on reproduction." *Fix:* define when head-to-head applies (both tied Players met in a completed Match) and what happens when it doesn't (skip to rung 4), so the ladder is total.
- **low** "Logged and flagged" used as a consequence without defining "flag" (FR-10, FR-16, FR-9, FR-14) — acceptable shorthand but repeated. *Fix:* one Glossary line defining the audit-log/flag shape, then the FRs inherit it.
- **low** FR-21 idle detection acknowledged unproven inline and in addendum §4 — good honesty, but the FR states the detection rule as if shippable. *Fix:* already partially handled by the addendum risk note; consider an explicit `[NOTE FOR PM]` that this FR's consequence is contingent on the Architecture spike confirming parse cost stays within SM-5.

## Scope honesty — strong

Omissions are explicit and do real work. §5 Non-Goals is a genuine fence (no money, no prize cap, no gentle mode, no scheduling, no season features, no Discord bot, no native app), and the `[NON-GOAL for MVP]` callouts sit exactly where a reader might silently assume the feature exists (prize-cap, gentle-mode). §6.2 honestly de-scopes the MatchZy auto-ingestion happy path to "may be reduced to an Admin-run local parse for v1" rather than pretending it's settled. The `[ASSUMPTION]` tags are on real inferences (registration model, grace-timer default, thresholds) and are mostly indexed. Open-items density is appropriate to stakes: 7 Open Questions + ~12 assumptions + 2 PM notes is high in absolute terms but every one is a tuning/UX/Architecture item, not a "we don't know what we're building" gap — correct for a hobby PRD feeding two more phases.

### Findings
- **low** Prize-cap appears in both Non-Goals (§5) and Out-of-Scope (§6.2) — mild duplication, not contradiction; both say the same thing. *Fix:* none required; harmless redundancy that aids each section's standalone readability.

## Downstream usability — strong

This PRD is built to be source-extracted, and it shows. The Glossary (§3) is thorough and the rest of the document genuinely uses its terms verbatim — Demo, Stat row, Pending/Approved, Forfeit/Walkover, Anti-sweep, Pity roulette, Award-tie ladder all appear consistently capitalized across FRs, UJs, SMs, and NFRs. FR/UJ/SM IDs are contiguous and unique (FR-1..FR-34 with no gaps or dupes; UJ-1..UJ-5; SM-1..SM-5 + SM-C1/SM-C2). Cross-references resolve: every "Validates FR-X" range lands inside FR-1..FR-34, every inline "FR-N" pointer (FR-4, FR-9, FR-10, FR-15, FR-17, FR-21, FR-29) resolves to a real FR. Each UJ has a named protagonist carrying context inline (no floating UJs). Sections read standalone via Glossary terms rather than "see above." The addendum cleanly maps its tables back to FRs ("maps to FR-18, FR-19, FR-20"), so Architecture can pull mechanism without re-deriving requirements.

### Findings
- **low** UJ→FR/SM back-references are inconsistent in form (§2.3) — UJ-2 says "Realizes UJ-2's SM-1 and SM-5" (a UJ referencing its own number is slightly circular phrasing), UJ-5 says "Realizes UJ-5's FR-9 and FR-17," while UJ-1 says "Realizes UJ-4." Mixed targets (SM vs FR vs UJ) and the self-referential phrasing make the convention fuzzy. *Fix:* standardize to "Validated by SM-x / realized by FR-y"; UJ-1's "Realizes UJ-4" reads as a forward-narrative link, which is fine but should be visually distinct from the FR/SM trace.

## Shape fit — strong

The shape matches the product. This is a consumer-ish multi-actor experience (players, admin, spectators) with meaningful UX, so the named-protagonist UJs are load-bearing and correctly present — not over-formalized. Rigor is calibrated light for hobby/friends stakes (no enterprise security model, no SLA tables, NFRs stated as targets-to-validate rather than contractual bounds), while the substance bar stays high where it matters — the technically meaty parts (demo ingestion, derived stats, provably-fair ceremony) get full FR treatment. It's chain-top (feeds UX → Architecture → stories), and downstream usability is correspondingly strong (see above). Nothing is forced: no compliance-traceability theater, no UJ density for a single-operator tool, no missing UJs for a consumer surface.

### Findings
*(none material)*

## Mechanical notes

- **Glossary drift:** None material. Spot-checked Demo, Stat row, Forfeit/Walkover, Anti-sweep, Pity roulette, Spin, Two-stage draw, Award class — all used verbatim and consistently capitalized across §2–§9. Minor: "weird demo-only stats" (§4.4) vs Glossary "weird-demo-only" bucket label (§3) — hyphenation differs but reads as the same concept; not a synonym drift, just punctuation. *Lowest priority.*
- **ID continuity:** Clean. FR-1..FR-34 contiguous, unique, no gaps/dupes. UJ-1..UJ-5 complete. SM-1..SM-5 + SM-C1/SM-C2 complete. All "Validates FR-…" ranges and inline "FR-N" cross-refs resolve within range. No broken "Validates FR-X."
- **Assumptions Index roundtrip — two minor leaks:**
  1. *Inline tag without its own index entry:* FR-24 (L351) carries a distinct inline `[ASSUMPTION: the comedy/"shame" bucket ships … no privacy/opt-out controls …]` at §4.5. The index folds this into the §2.2 entry ("comedy/'shame' Awards ship with no privacy/opt-out controls"), so the *content* is indexed but the §4.5/FR-24 *location* is not separately listed. Borderline-acceptable (same assumption, two sites) but a strict roundtrip would cite both.
  2. *Index entry without an inline `[ASSUMPTION]` tag:* The index line "§4.4 FR-20 — Entry frag is measured from freeze-time end (round live)" has no corresponding inline `[ASSUMPTION]` — FR-20's consequence (L309) states "first kill of a round after the freeze time ends" as plain fact, untagged. The index claims an assumption the body asserts as settled. *Fix:* either tag the FR-20 freeze-time phrasing inline, or drop it from the index if it's now locked.
  - All other inline tags (registration model, ~2 s propagation ×3, grace timer, KAST 5 s, ≥24 rounds, ≥20 kills, ≥50% idle, P50/P95 latency, <2 min admin effort) roundtrip correctly, several legitimately consolidated into combined index lines.
- **UJ protagonist naming:** Every UJ has a named protagonist (Theo, Mara, Dex, "the group," Mara) carrying context inline. UJ-4's protagonist is "the whole roster" rather than an individual — acceptable for a ceremony-wide moment, but it's the one UJ without a single named lead.
- **Required sections:** All present for the stakes/type — Vision, Target User, Glossary, Features/FRs, Non-Goals, MVP Scope, Success Metrics, NFRs, Constraints, Open Questions, Assumptions Index, plus a well-scoped technical addendum. No missing sections.
