# PRD Quality Review: Cuatro Ecosystem

Rubric: `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
Reviewed: 2026-08-15 · Stakes: launch-grade · Shape: chain-top (feeds `bmad-architecture`)

## Overall verdict

The PRD is decision-dense and strategically coherent: it has a real thesis, names its trade-offs with what was given up, and §12 does genuinely uncomfortable work by surfacing six places the product framing collides with the settled research rather than smoothing them. The weakness is entirely mechanical and entirely late-arriving, the §2.3 User Journeys were written against an eight-app suite and were never updated when FR-35 cut the rendered suite to six, so the most downstream-consumed section of the document now describes a product the rest of the document does not specify. That is a **high**-severity downstream-usability defect in a chain-top PRD, and it is cheap to fix.

## Decision-readiness: strong

Decisions are stated as decisions. §4.5 refuses the obvious dodge on cross-app identity and states both halves of the honest answer ("it serves a real need, for exactly one person" / "and it is a demonstration, deliberately"): the PRD prompt explicitly asked for a decision rather than a drift, and this is a decision. §12.3 corrects its own earlier overstatement in place rather than quietly deleting it, which is the behaviour a reader needs to trust the rest.

Trade-offs name what was given up: §5.2 concedes that keeping three tracker implementations costs real weeks that merging would save; §9.2 marks the identity deferral as "emotionally load-bearing" rather than burying it; FR-35's rationale states plainly that the taxonomy's *rendering* is being scoped rather than pretending nothing was lost.

Open Questions are genuinely open: Q1 (capacity), Q9 (two unconfirmed statuses) and Q10 (whether four applications ever get built) have no answer smuggled into the next sentence, and Q10 explicitly names archiving as a legitimate outcome rather than assuming the optimistic path.

### Findings
- **low** Non-Goal cross-reference is imprecise (§8): "The portfolio-value re-ranking question … has been resolved (§13, and `addendum.md`)" points at §13, but §13 contains no portfolio-value entry; the resolution lives in `addendum.md` §A only. *Fix:* drop the §13 reference.

## Substance over theater: strong

Three personas, each of which drives decisions traceable in the document: Daniela drives NFR-5, FR-3, SM-C1 and the entire FR-35 ratio argument; Marcus drives FR-10, FR-21 and SM-3; Cuatro drives NFR-1, FR-31 and the honest half of §4.5. None is decorative.

NFRs carry product-specific thresholds rather than boilerplate: NFR-3 names the actual ceiling and the gating mechanism, NFR-9 states a preference order that resolves real conflicts, NFR-10 gives the reason ("automation without users is automation without feedback"). No "must be scalable/secure/reliable" filler.

The Vision could not swap into another PRD: it is specific to this estate, this claim and this audience.

### Findings
*(none)*

## Strategic coherence: strong

The thesis is one sentence in the user's own words and the document is genuinely organised around it. Feature priority follows from it rather than from ease: FR-35 cuts visible scope *against* the temptation to look busy, §9.2 defers the technically interesting work (identity) because it delivers nothing to the primary persona, and §10.2 explicitly re-orders the research's engineering sequence on product grounds.

Counter-metrics are the strongest part of §11 and are doing real work rather than performing balance: SM-C2 refuses entry count as a growth target, which directly counterbalances the §5 estate-shrinking decision; SM-C4 states which metric wins in a conflict rather than leaving it to judgement.

### Findings
- **medium** SM-2 validates an out-of-MVP requirement (§11): SM-2 lists FR-25 (Demo Access) among what it validates, but FR-25 is deferred in §9.2. At MVP the metric cannot be satisfied for any application requiring authentication. *Fix:* drop FR-25 from SM-2's validates list, or mark the FR-25 portion as v2.

## Done-ness clarity: adequate

Every FR carries at least one testable consequence, and several are unusually good: FR-3 names an actual viewport (360 px), FR-35 specifies the filter must be declarative over Status rather than a hand-maintained list (which is the difference between an honest taxonomy and a display hack), FR-6 makes contract validation fail the build.

Adjective-only requirements are largely absent. Two soften below the bar.

### Findings
- **medium** FR-2 has an unmeasurable consequence (§4.1): "Marcus's path: arrive, skip narrative, reach suite: costs at most one interaction" is a persona restatement, not a test; the preceding bullet already carries the real condition. *Fix:* delete the bullet or restate as a measurable navigation-depth bound.
- **medium** FR-26 leaves its core term undefined (§4.6): "Demo state returns to a usable baseline without manual Operator intervention" specifies neither what baseline nor within what window. §13 Q3 correctly routes the *mechanism* to architecture, but the *bound* belongs here. *Fix:* add a reset-interval bound, or state explicitly that the bound is architecture's to set and why.
- **low** FR-4's second consequence is hard to falsify (§4.1): "without listing framework names as its primary content" is a judgement call with no threshold.

## Scope honesty: strong

Non-Goals do real work and include the hard one: §8 rules out per-app feature work, which is exactly the boundary that would otherwise erode. §9.2 de-scopes in the open with reasons attached to each item, and the `[NOTE FOR PM]` on the four unbuilt applications states the uncomfortable consequence directly: *nothing in this PRD causes these four to get finished.*

Open-items density is appropriate for launch stakes on a chain-top PRD: 8 live Open Questions, 10 indexed assumptions, 3 `[NOTE FOR PM]` callouts. Two questions are closed in place with strikethrough rather than deleted, preserving numbering for downstream references, correct.

### Findings
- **low** Assumptions Index ordering is non-monotonic (§15): entries run §4.2, §4.3, §4.4, §4.5, §4.8, §5, §9.2, §5.1, §5.3, §11, §12.3. Every inline `[ASSUMPTION]` does round-trip, so this is presentation only. *Fix:* sort by section.

## Downstream usability: thin

This is the dimension that fails, and it fails for one identifiable reason: **§2.3 was written against an eight-application suite and never revised when FR-35 reduced the rendered suite to six.** The Glossary, the FRs and §5.1 are internally consistent with each other; the User Journeys are consistent with an earlier draft. Because UJs are the section UX and architecture source-extract most heavily, and because FRs cite them by ID as their justification, the drift propagates.

Concretely: the Glossary defines **Tracker Family** as three implementations and FR-11 names exactly three, but §1 says "four trackers in four different languages" and UJ-1 has Daniela noticing "the four Trackers … labelled as one family in four languages." Worse, `poketracker-go` is `In progress` per §5.1 and therefore **not rendered** per FR-35, so the rendered family is two, and UJ-2's beat where Marcus "opens `poketracker-go`" describes an application a Visitor cannot reach.

Everything else in this dimension is sound: FR/UJ/SM IDs are unique, cross-references resolve, sections stand alone, and every UJ has a named protagonist carrying context inline.

### Findings
- **high** UJ-1 contradicts FR-35 on suite size and tracker count (§2.3): "a directory of eight running applications" contradicts §5.1's "first public Suite Directory renders six entries"; "the four Trackers … as one family in four languages" contradicts the Glossary and FR-11, which both say three. *Fix:* six applications; three trackers, of which two are rendered at MVP, or drop the count from the tracker beat entirely.
- **high** UJ-2 has Marcus opening an unrendered application (§2.3): he "opens `poketracker-go`, and does it again," but that application is `In progress` and excluded from the Suite Directory by FR-35, so the journey's central verification beat cannot occur. *Fix:* swap to `digital-library` or `list-wheel`, both `Live` and on different frameworks, which preserves the polyglot-verification point.
- **medium** UJ-4 states a sibling count that no longer holds (§2.3): "sees seven sibling applications" against six rendered entries, one of which is the Hub. *Fix:* remove the number.
- **medium** §1 Vision states "four trackers in four different languages" (§1): same drift as UJ-1, in the paragraph most likely to be quoted verbatim onto the site. *Fix:* three trackers.
- **medium** FR-13 does not say whether the Suite Switcher is curated (§4.3): it requires listing "every other application in the Ecosystem," which reads as the full App Registry, while FR-35 curates the Suite Directory. Two surfaces render the same data under different rules and the PRD does not say so. *Fix:* state that the switcher applies the same Status filter as FR-35, or state deliberately that it does not.
- **medium** FR-11's rendering consequence is unsatisfiable at MVP (§4.2): "The Suite Directory renders the family as a labelled group" of three, but only two are rendered. *Fix:* state that the family renders whichever members pass the FR-35 filter, and that the framing line stands regardless of count.
- **low** "stack" is used where the Glossary term is `tech` (§4.1 FR-3, §2.3 UJ-1): mild synonym drift on a field name downstream will bind to.

## Shape fit: adequate

The chain-top shape is right and the UJ density is justified: this is a visitor-facing product whose entire purpose is how two named audiences experience it, so named-protagonist journeys are load-bearing rather than overhead. Brownfield handling is a strength, existing routes, the real `ProjectEntry` shape and the actual stack are cited accurately from the repository rather than assumed.

The one shape strain: §5 has grown into a substantial estate-disposition register with three subsections and two tables, sitting between the Features and the NFRs. It reads more like a reference appendix than a step in the argument, and a reader looking for MVP scope passes through fifteen rows of repository disposition to reach it.

### Findings
- **low** §5 placement interrupts the argument (§5): consider whether the disposition table belongs in `addendum.md` with §5 retaining only the 15→8 statement and the tracker framing. Not a defect; a readability judgement for the author.

## Mechanical notes

- **§0 states the FR range as "FR-1…FR-34"**: stale since FR-35 was added. Must be corrected; it is the first factual claim in the document.
- **§5 subsection order is 5.1 → 5.3 → 5.2.** `5.3 list-wheel` was inserted before `5.2 On the Trackers`.
- **§12 item order is 12.1, 12.2, 12.3, 12.7, 12.4, 12.5, 12.6.** 12.7 was appended mid-list.
- **§11 secondary metric order is SM-6, SM-7, SM-11, SM-8, SM-9, SM-10.** SM-11 was inserted mid-list.
- **FR-35 is positioned between FR-5 and FR-6.** Sanctioned by the template (IDs are global and stable, not positional) and deliberate: it belongs next to FR-5, which it modifies. Worth an inline note so a reader does not read it as an error.
- **Glossary round-trip is clean.** Every defined term is used consistently in FRs, UJs and SM definitions, with the `tech`/"stack" exception noted above.
- **All FR, UJ, NFR and SM IDs are unique.** No duplicates, no unresolved cross-references. Numbering gaps are all deliberate (closed Open Questions retained by number, FR-35 out of position).
