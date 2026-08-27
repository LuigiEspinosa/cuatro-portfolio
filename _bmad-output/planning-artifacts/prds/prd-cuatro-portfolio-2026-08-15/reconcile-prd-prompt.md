# Reconciliation: `ecosystem-prd-prompt.md` against `prd.md` + `addendum.md`

Source: `_bmad-output/planning-artifacts/ecosystem-prd-prompt.md`

## The eight requested outputs

| # | Asked for | Delivered | Verdict |
|---|---|---|---|
| 1 | Purpose and audience in one paragraph the author would put on the site | §1 Vision, ¶1 and ¶3 | **Covered**: but see gap G1 |
| 2 | The visitor experience at `cuatro.dev` and what makes it a suite | §4.1, FR-1 – FR-4 | **Covered**: see gap G2 |
| 3 | The app registry as a product: entry contract, editorial voice, status taxonomy | §4.2, FR-5 – FR-12, FR-35 | **Covered, strongest section** |
| 4 | Cross-app identity: what it's for and honestly whether justified | §4.5 preamble, FR-20 – FR-24 | **Covered**: both halves stated plainly |
| 5 | Scope boundary: ecosystem layer vs per-app work | Glossary (Ecosystem Layer / Per-App Layer), §8, §9.2 | **Covered** |
| 6 | Success criteria checkable without users | §11, FR-31 – FR-34 | **Covered and improved**: see G3 |
| 7 | Estate decision recorded unambiguously, 8-vs-11 resolved | §5, §5.1 | **Covered** |
| 8 | Explicit sequencing alignment with research Steps 0–8, Steps 0–2 as first epic | §10 | **Covered** |

## The interrogation the prompt demanded

The prompt required the portfolio-value ranking to be pushed until a real answer came, then for the implied option to be stated directly "rather than rationalizing the existing pick."

**Done.** Interrogation ran before any drafting; the crossover threshold was computed precisely (≈51.5%, not the report's loose "roughly 50%") and put to the author as *is portfolio value worth more than the other four criteria combined?* The answer relocated portfolio value rather than lowering it, and the record (including the counter-argument the research never scored) is in `addendum.md` §A. The technical pick survived on reasoning, not on deference.

## The five "genuinely unresolved" questions

| Prompt question | Where answered |
|---|---|
| What does a visitor actually experience? What makes it read as a suite? | §4.1, §4.4, FR-4 |
| What is the app registry *editorially*? Who is an entry written for, what does status mean to a reader? | FR-6, FR-7, FR-8 |
| Is there a suite switcher, and what does it do? | §4.3, FR-13 – FR-15; UJ-4 supplies its justification |
| What does one login buy the user, given no real users? | §4.5: real need for one person, plus stated demonstration |
| What is the ecosystem's narrative? Commit. | §1: committed in the author's own words |

## Gaps

**G1: the "one paragraph I'd put on the site" is not isolated.** *(low)*
The prompt asked for a paragraph the author would be willing to publish. §1 is three paragraphs and ¶1 carries internal-planning detail ("Fifteen scattered personal repositories become eight") that would not appear on a public site. The publishable statement is embedded rather than extractable, and FR-4 requires a premise statement on the homepage without supplying candidate copy.
*Suggested:* not a PRD defect, copy is UX/content work. Worth noting so the downstream run does not assume §1 ¶1 is site-ready.

**G2: "what makes it read as a suite rather than a list of links" is answered by accumulation, not directly.** *(low)*
The answer is distributed across FR-1 (narrative resolves into it), FR-4 (premise stated), FR-11 (family grouping), FR-18 (shared visual identity) and FR-13 (switcher). Each is right; no single place states the mechanism as a claim. A reader looking for the answer must assemble it.

**G3: the prompt's constraint was corrected, not merely satisfied.** *(informational)*
The prompt instructed: "no real users … the PRD should not assume feedback loops that don't exist." The PRD instead establishes that a feedback loop *does* exist at the Hub layer (self-hosted Umami, real recruiter visitors) and confines the no-signal constraint to the Per-App Layer. This is a deliberate deviation from an instruction, argued in §12.1, flagged here so it is a visible choice rather than a quiet one.

**G4, one prompt constraint is under-served.** *(low)*
"Hardware … Do not scope anything that assumes headroom." §12.3 recalibrated the load estimate *downward* (eight applications → five or six) using new information. The recalibration is honest and the Capacity Gate still binds, but downward revision of a risk is the direction the prompt warned about. Mitigated by FR-33 and by §12.3 stating explicitly that "smaller than the worst case is not the same as known to fit."

## Qualitative content the FR structure could have dropped: checked

- **"In the spirit of Google Suite or Adobe Suite"**: survives verbatim in §1.
- **"One person built a coherent polyglot platform"**: survives as the thesis, in the author's words.
- **"Six frameworks under one visual identity is either a coherence failure or the entire point"**: survives as the committed position in §1 ¶2 and §4.4.
- **"I value stack variety: deliberate, not accidental debt"**: survives in §1 ¶2, §5.2 and §8.
- **Tone/voice for product-generated text**: the prompt did not specify site voice, and the PRD specifies editorial voice only for Registry descriptions (FR-8). Hub copy voice is unspecified and belongs to UX.
