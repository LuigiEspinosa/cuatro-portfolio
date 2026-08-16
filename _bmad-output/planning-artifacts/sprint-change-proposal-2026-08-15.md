---
title: "Sprint Change Proposal: satellite and Anchor restyling scope change"
status: approved
created: 2026-08-15
approved: 2026-08-15
approved_by: Cuatro
project: cuatro-portfolio
trigger: Operator decision, 2026-08-15
scope_classification: Major
source_prompt: _bmad-output/planning-artifacts/ecosystem-correct-course-prompt.md
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - AGENTS.md
---

# Sprint Change Proposal: every rendered application gets a visual restyle

## 0. The one-paragraph answer

The change is affordable, and it is affordable because it is mostly a **substitution, not an
addition**. Redesigning the Hub's components token-native *replaces* four of the seven SCSS
migration steps rather than adding to them: two stories are deleted outright, one is replaced by
a CI gate that is cheaper and permanent, and two survive with new triggers. Epic 1 is untouched
and can start today, unchanged, including Story 1.1. The real new cost is per-Satellite, and it
is bounded by a single new rule: **an application earns a restyle when the Suite Directory
renders it, and never before.** That rule spends nothing on the four unbuilt applications, keeps
archiving them a free outcome, and reuses the estate's own FR-35 filter rather than introducing a
second list. Nothing here reopens the shared component library, and a new invariant, AD-24, exists
specifically to keep the restyle programme from drifting into one.

---

## 1. Issue Summary

### 1.1 The trigger

**Operator decision, 2026-08-15.** Every application gets a visual restyle, not just token
adoption. Recorded in `ecosystem-correct-course-prompt.md`. This is a deliberate scope expansion
made with the cost stated, not a discovery during implementation. No story revealed it, because no
story has opened: `sprint-status.yaml` shows all 82 actionable stories at `backlog`.

The decision has two halves:

1. **The Hub's own components rebuilt token-native.** `GlitchText`, `ScanlineOverlay`, `HudLabel`,
   `HomeLayout`, `Error404` and the rest of the cybercore surfaces are redesigned against the token
   contract rather than migrated through the seven SCSS steps.
2. **Each Satellite visually restyled in its own framework** as it adopts the contract, so the
   suite reads as one product at the component level and not only at the token level.

**Issue category:** new requirement from the stakeholder, which happens to also be a strategic
sharpening of an existing one. It does not arise from a failed approach or a technical limitation.

### 1.2 What the change contradicts, precisely

| Artifact | Location | The collision |
|---|---|---|
| PRD | §8 Non-Goals | "Not feature work inside individual applications. This PRD covers the Ecosystem Layer only." Restyling `digital-library` is work inside `digital-library`. |
| PRD | §9.1 In Scope | Scopes token adoption by "the Anchor and at least one other Live application", not a restyle programme. |
| PRD | §9.2 Out of Scope | The four `In progress` applications are excluded, but the exclusion is written about *building* them, not about *restyling* them. Silent on the case this change creates. |
| PRD | §3 Glossary | "Per-App Layer, feature work inside any individual application. Explicitly out of scope." Restyle has no defined term at all. |
| Architecture | AD-14 | Adoption is defined as vendoring the folder, importing the right file, and nine hand-fix lines. That is a contract adoption, not a redesign. |
| Architecture | AD-19 | Requires exactly one application, `cs-tracker`, to be measured by hand against the accessibility floor after adoption. |
| Epics | Stories 2.18 to 2.22 | Five stories that exist to move the *current* stylesheets onto tokens. Most of that motion is wasted if the components are being rewritten. |
| UX | `EXPERIENCE.md` § Component Patterns | Specifies the *new* Suite components only. The cybercore components being redesigned have no design specification anywhere. |
| Success metrics | SM-6 | Counts applications rendering from shared tokens, target at least 2. Counts consumption, which is now the floor rather than the goal. |

### 1.3 The invariant that does not move, restated so nothing below can be misread

**AD-2 and contracts-federate still hold.** Every restyle is native, in that application's own
framework, consuming the same tokens. No shared component library. The evidence has not changed:
Google defunded Material Web (2024-06), GitHub retired Primer ViewComponents (2026-02), Adobe
maintains parallel implementations with no consolidation plan. Nothing in this proposal puts
component code across the Turborepo boundary, and §6.2 adds an invariant whose only job is to keep
it that way.

---

## 2. Impact Analysis

### 2.1 The distinction this change forces into the vocabulary

Everything downstream depends on holding two things apart that the plan currently calls by one
name.

| Term | Means | Delivers | Measured by |
|---|---|---|---|
| **Contract adoption** | Vendor `cuatro-contracts/`, import the right file, apply the nine hand-fix lines (UX-DR46). Mechanical, roughly an afternoon. | "Reads as one author." Same palette, type scale, spacing rhythm. | FR-18, SM-6 |
| **Visual restyle** | Rebuild the application's presentation layer against the token contract in its own framework, so its components carry the suite's own vocabulary rather than its framework's defaults. | "Reads as one product." | FR-36 to FR-38, SM-12 (new) |

The plan as written delivers the first and calls it done. The Operator now wants the second. The
first stays exactly where it is, because it is Epic 1's acceptance condition and the whole reason
Epic 1 is standalone.

### 2.2 Epic impact

| Epic | Impact | Verdict |
|---|---|---|
| **Epic 1** (20 stories) | **None.** Every story survives verbatim. 1.17 adds the contract. 1.18 aliases, and the alias layer is *more* load-bearing under this change, not less: it is what keeps the fifteen un-redesigned stylesheets coherent while the redesign proceeds. 1.19 remains the nine-line adoption. 1.20 records the version. | **Unblocked and unchanged. Start today.** |
| **Epic 2** (26 stories) | Substantial. Two stories deleted, one replaced by a CI gate, two resequenced or retargeted, eight added. Epic 2 becomes 31 stories. The epic's goal and acceptance moment are unchanged. | Modify scope |
| **Epic 3** (8 stories) | Indirect. AD-20 forbids the merge steps from doing anything else, so the two rendered merge targets (`cuatro-tracker`, `cs-tournament`) cannot be restyled inside their merge stories. Their restyle becomes Epic 8 wave 2, gated on Epic 3. | Dependency added, no story changed |
| **Epic 4** (11 stories) | None. Restyling adds no serving load and touches no infrastructure. | No change |
| **Epic 5** (11 stories) | None. | No change |
| **Epic 6** (4 stories) | Weakly positive. The `--token-scrim` addition proposed in §4.3 is a real hand-copied token change and counts as one of the three that earn Epic 6. | No change, trigger advances |
| **Epic 7** (2 stories) | None. | No change |
| **Epic 8** (new, 6 stories) | New. Satellite and merged-app restyling, gated by FR-38. Runs after Epic 2. | Add |

### 2.3 Story impact, in detail

**Deleted outright (2):**

- **Story 2.18** (migration step 3, retire the violet hairlines). Its four hairline replacements
  live in `WorkItem.scss` and `ProjectCard.scss`. `ProjectCard` is retired by Story 2.14 with
  `/projects`, and `WorkItem` is redesigned. There is nothing left for the story to do.
- **Story 2.21** (migration step 6, rename the call sites). A stylesheet rewritten against
  `--token-*` has no call sites to rename. This is the clearest waste the change removes: the
  story exists only to undo the aliasing done in 1.18, component by component, on files that are
  being replaced.

**Replaced (1):**

- **Story 2.19** (migration step 4, sweep the colour literals) becomes **Story 2.34, the FR-17
  conformance gate.** Most of its 28 lines sit in files being redesigned, which absorb their own
  literals. The residue is `celeste.scss` and whatever a future commit reintroduces. A one-time
  hand sweep cannot hold that; a blocking CI grep can, and it is strictly cheaper for a solo
  maintainer. This converts a task into an invariant.

**Survive with changed triggers (2):**

- **Story 2.20** (migration step 5, swap the type) survives unchanged in content and **moves to the
  front of the restyle sequence**. Redesigning a component against `--f-display` while Monument
  Extended is still the shipped face means designing against a face about to be deleted. Every
  redesign story depends on it.
- **Story 2.22** (migration step 7, delete the aliases) survives, retargeted. Its trigger moves from
  "step 6 complete" to "the last Hub component redesigned", and its acceptance changes from
  "visually identical to the pre-deletion build" to "no rule references an alias name, and the
  Story 2.34 gate passes."

**Untouched, and deliberately so (2):**

- **Story 1.17** (step 1, add the contract) and **Story 1.18** (step 2, alias). FR-18 is measured on
  these and Epic 1's standalone claim rests on them. The prompt was right to flag them. They are
  not merely safe to leave alone, they become *more* necessary: 1.18's alias layer is the scaffold
  that keeps the site coherent across eight redesign stories, which is exactly the "every step
  leaves a working system" guarantee AD-20 demands.

**Added (14):** eight Hub redesign stories in Epic 2 (2.27 to 2.34), six restyle stories in Epic 8.
Enumerated in §5.

### 2.4 Artifact conflicts

| Artifact | Change required | Severity |
|---|---|---|
| `prd.md` §3 Glossary | Add **Visual Restyle**; amend **Per-App Layer** | Small |
| `prd.md` §8 | Reword the per-app non-goal with a bounded presentation carve-out | **Load-bearing** |
| `prd.md` §9.1 / §9.2 | Move Anchor restyle into MVP; state explicitly that unrendered applications are not restyled | **Load-bearing** |
| `prd.md` §4.4 | Add FR-36, FR-37, FR-38 | Additive |
| `prd.md` §11 | Amend SM-6; add SM-12, SM-C6; confirm SM-C2 to SM-C5 | Medium |
| `prd.md` §10 | Add Epic 8 to the sequencing table | Small |
| `prd.md` §13 Q10 | Restyle cost is new input to the archive-or-build decision | Note |
| `ARCHITECTURE-SPINE.md` AD-14 | Clarify what "all-or-nothing" binds | **Forced change** |
| `ARCHITECTURE-SPINE.md` AD-19 | Extend the manual accessibility pass from `cs-tracker` to every restyled application | **Forced change, real cost** |
| `ARCHITECTURE-SPINE.md` AD-21 | Add the FR-17 conformance grep to the blocking gate list | Small |
| `ARCHITECTURE-SPINE.md` | Add AD-24 (restyle is native) and AD-25 (restyle follows visibility) | Additive |
| `ARCHITECTURE-SPINE.md` binds | Add EPIC-8, FR-36 to FR-38 | Small |
| `DESIGN.md` § Migrating the Anchor | Rewrite the seven-step sequence as two steps plus a redesign programme | **Load-bearing** |
| `DESIGN.md` § `tokens.css` | Add `--token-scrim`, conditional on §4.3 | Medium, contract v1.1.0 |
| `EXPERIENCE.md` § Component Patterns | **Specify the redesigned cybercore components. They have no design contract today.** | **Largest artifact gap** |
| `EXPERIENCE.md` § Open Items | Retire O-12 items 1 and 2 into the redesign pass; keep item 3 open as accessibility | Medium |
| New UX deliverable | **The Restyle Specification**: the component vocabulary, framework-agnostic | New artifact |
| `epics.md` | All of §5 below | Large |
| `sprint-status.yaml` | Regenerate per §7 | Mechanical |
| `AGENTS.md` `bmad:context` | Three pitfall lines change; refresh after Epic 1 as the existing reminder already says | Small |

### 2.5 Technical impact

- **Serving load: none.** Restyling changes bytes served, not CPU consumed. SM-C4 and AD-9 are
  untouched by this decision. This is one of the few places the change is genuinely free, and it is
  worth saying plainly given how much of this plan is capacity-shaped.
- **Asset weight: net negative, probably favourable.** UX-DR49's 140 KB non-3D budget binds every
  redesign story. Story 2.20 deletes three font binaries, which is the offset. If GlitchText loses
  its aberration keyframes (§4.3), that is a further reduction. Each redesign story is measured
  against SM-C5.
- **CI: one gate added** (the FR-17 conformance grep), blocking per AD-21.
- **Contract version: 1.0.0 in Epic 1, 1.1.0 in Epic 2** if `--token-scrim` lands. A value addition
  is a minor bump under AD-16, so no migration is forced on any consumer. Note a small blind spot:
  AD-18's drift check compares a Satellite's declaration against its own vendored file, so a
  Satellite trailing the contract by a minor version is invisible to it by design. That was
  harmless when the contract never changed. It is worth knowing now that it will.
- **No new infrastructure, no new recurring cost, no new dependency.**

---

## 3. Recommended Approach

**Selected path: Direct Adjustment, hybrid shape.** Modify stories and epics within the existing
plan; add one epic; change no architectural decision that this change does not force.

**Rollback was evaluated and is not applicable.** No story has started; there is nothing to revert.

**MVP Review was evaluated and is partially adopted.** The MVP is not reduced. It is *redrawn*: the
Anchor's restyle moves into MVP because it substitutes for work already in MVP, and Satellite
restyle sits immediately after MVP as Epic 8 rather than inside it. The first public Suite Directory
does not wait on seven repositories.

**Rationale.** Three things make Direct Adjustment right here:

1. **The Hub half is a substitution, not an addition.** Four of seven migration steps were going to
   tokenize values in files that would then be rewritten. Deleting that motion pays for most of the
   redesign.
2. **The plan already contains the gate this change needs.** FR-35 filters what the Suite Directory
   renders. Reusing that same filter to decide what gets restyled costs nothing to build, cannot
   drift from the Registry, and answers the unbuilt-four question mechanically rather than by
   judgement.
3. **Epic 1 survives untouched**, so the change costs zero delay. That is unusual for a scope
   expansion and is the strongest argument for accepting it now rather than after Epic 1 ships.

**Effort:** Medium for the Hub (net near zero against the deleted stories, plus a genuine UX
specification pass that does not exist today). Medium-to-high per Satellite, three applications in
wave 1, three frameworks, no shared code by construction.

**Risk:** Medium. The two real risks are named and mitigated in §6.

**Timeline:** No delay to Epic 1. Epic 2 grows by roughly five net stories. Epic 8 adds a phase
between Epic 2 and Epic 3 that did not exist. Epic 3 onward is unchanged in content.

---

## 4. The six decisions the prompt asked for

### 4.1 PRD §8 and §9

**Decision: restyling stops being a non-goal, and the non-goal is narrowed rather than deleted.**
The boundary moves from the *repository* line to the *behaviour* line. Restyling changes how an
application looks. It never changes what it does. That preserves everything §8's non-goal was
actually protecting, which is unbounded per-application feature scope leaking into an ecosystem-layer
plan.

**§3 Glossary, add:**

> **Visual Restyle:** rebuilding an application's presentation layer (colour, type, spacing,
> borders, focus, motion, component form) against the Token Contract, in that application's own
> framework, so it carries the Ecosystem's component vocabulary rather than its framework's
> defaults. Never changes behaviour, routes, data, or feature set. Distinct from Token Adoption,
> which is the mechanical act of consuming the contract.

**§3 Glossary, amend Per-App Layer.** Current text:

> **Per-App Layer** — feature work inside any individual application. Explicitly out of scope (§9).

Proposed:

> **Per-App Layer:** feature work inside any individual application: behaviour, routes, data model,
> feature set. Explicitly out of scope (§8). Visual Restyle is not Per-App Layer work, because
> visual coherence is a property of the Ecosystem that only per-application work can deliver.

**§8 Non-Goals, amend the fourth bullet.** Current text:

> - **Not feature work inside individual applications.** This PRD covers the Ecosystem Layer only.
>   What `digital-library` does with EPUB metadata is Per-App Layer and out of scope.

Proposed:

> - **Not feature work inside individual applications.** This PRD covers the Ecosystem Layer only.
>   What `digital-library` does with EPUB metadata is Per-App Layer and out of scope.
>   **Presentation is the single bounded exception.** An application the Suite Directory renders is
>   visually restyled against the Token Contract, natively in its own framework (FR-36, FR-38),
>   because visual coherence is an Ecosystem property that no ecosystem-layer artifact can deliver
>   on its own. A restyle changes how an application looks and never what it does. Any change that
>   alters behaviour, adds a screen, or touches the domain model remains Per-App Layer and remains
>   out of scope.

**§8, also amend the shared-library bullet** to close the door this change pushes on. Current text:

> - **Not a shared component library.** Contracts federate; implementations do not. No
>   cross-framework component package will be built, and this is a decision rather than a deferral.

Proposed, adding one sentence:

> - **Not a shared component library.** Contracts federate; implementations do not. No
>   cross-framework component package will be built, and this is a decision rather than a deferral.
>   **The restyle programme does not reopen this.** Seven applications implementing the same
>   component vocabulary is expected duplication, not an argument for extraction; the vocabulary
>   federates as a written specification (AD-24), never as code.

**§9.1 In Scope, amend one line and add one.** Replace:

> - Design Tokens adopted by the Anchor and at least one other Live application on a different
>   framework (FR-16 – FR-18).

with:

> - Design Tokens adopted by the Anchor and at least one other Live application on a different
>   framework (FR-16 to FR-18). This remains the FR-18 acceptance condition and is satisfied by
>   adoption alone.
> - **The Anchor's own components rebuilt token-native** (FR-37), replacing migration steps 3, 4, 6
>   and 7 rather than adding to them.

**§9.2 Out of Scope for MVP, add one bullet and amend one.** Add:

> - **Restyling any application the Suite Directory does not render.** FR-38 gates restyle on the
>   same declarative Status filter FR-35 already applies. An unrendered application is not restyled,
>   and no restyle story exists for it. Restyling an invisible surface returns nothing to any
>   Visitor and spends the Operator, who is the estate's scarcest resource.

Amend the existing four-applications bullet to close its silence:

> - **Building the four `In progress` applications** ... They hold entries in the App Registry and
>   stay unrendered until genuinely ready (FR-35), **and being unrendered they are also not
>   restyled (FR-38). Archiving one remains a legitimate outcome and now also permanently closes its
>   restyle obligation.**

**Where restyling lands, stated plainly:**

| Surface | Phase | Why |
|---|---|---|
| The Anchor (the Hub) | **MVP**, Epic 2 | It replaces work already in MVP. Not restyling it is not cheaper. |
| `cs-tracker`, `digital-library`, `list-wheel` | **Immediately post-MVP**, Epic 8 wave 1 | Live, rendered, three frameworks, the strongest polyglot proof available |
| `cuatro-tracker`, `cs-tournament` | Epic 8 wave 2, gated on Epic 3 | Rendered, so FR-38 applies, but AD-20 forbids restyling inside a merge step |
| `StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo`, `cuatro-finance` | **Never, until FR-38 opens** | Unrendered. No story exists. |

MVP therefore ships at "reads as one author" across the estate and "reads as one product" on the
Hub. Epic 8 closes the remainder. That distinction is exactly what FR-18 and FR-36 now separate,
and it means the first public Suite Directory is never blocked on seven repositories.

### 4.2 Do Stories 2.18 to 2.22 collapse?

**Yes, mostly. Two of the seven steps survive untouched in Epic 1, two are deleted, one is replaced
by a permanent gate, and two survive with new triggers.**

| Step | Story | Verdict | Reasoning |
|---|---|---|---|
| 1. Add the contract | **1.17** | **Survives unchanged** | Adds files, consumes nothing, byte-identical output. Epic 1. FR-18 measured on it. Untouched. |
| 2. Alias the old names | **1.18** | **Survives unchanged** | Epic 1, FR-17, and the moment the Hub joins the family. Under this change it also becomes the scaffold that keeps fifteen stylesheets coherent across eight redesign stories. More necessary, not less. |
| 3. Retire the violet hairlines | **2.18** | **Deleted** | Four replacements across two files. `ProjectCard.scss` retires with Story 2.14. `WorkItem.scss` is redesigned. Nothing left. |
| 4. Sweep the colour literals | **2.19** | **Replaced by 2.34** | Redesigned files absorb their own literals. The residue plus future regressions are held by a blocking CI grep, which is cheaper and permanent. |
| 5. Swap the type | **2.20** | **Survives, resequenced first** | The font layer is global and must precede every redesign, or components are designed against faces about to be deleted. |
| 6. Rename the call sites | **2.21** | **Deleted outright** | A rewritten stylesheet has no call sites to rename. Pure waste under redesign. |
| 7. Delete the aliases | **2.22** | **Survives, retargeted** | The alias block still has to go. Trigger moves from "step 6 done" to "last Hub component redesigned". |

**On the prompt's warning about steps 1 and 2:** confirmed and honoured. Neither is touched. Both
remain in Epic 1, both keep their acceptance criteria verbatim, and FR-18 remains satisfied by them
alone. The only edit anywhere near them is to *other* stories' `Depends on` lines.

### 4.3 The three O-12 items

The prompt's reading is correct and the proposal follows it exactly.

**Item 1, GlitchText's red and cyan aberration, `glitch-text.scss:33` to `:68`.** Dissolves into a
redesign decision (Story 2.27). **Recommendation: the aberration goes.** O-10 decided the contract
palette wins, § Rules says one accent, and a documented exception on one of the Hub's most visible
components undermines the contract at exactly the point a reviewer looks. The component is rebuilt
as a token-native glitch using offsets in `--token-accent`, `--token-accent-muted` and
`--token-text`. This is a design call, not a dev call, and it belongs in the UX pass named in §6.4,
not in the story.

**Item 2, ScanlineOverlay's pure blacks, `ScanlineOverlay.scss:6`, `:16`, `:17`.** Dissolves *only
if* the redesign drops the darkening layer. If any darkening layer survives, "nothing is pure" still
bars `#000` and a named role is required. **Recommendation: add `--token-scrim` to the contract**
and redesign against it. Consequences, all small and all worth stating:

- The contract moves to **v1.1.0**. A value addition is a minor bump under AD-16, so no consumer is
  forced to migrate.
- Story 1.20's recorded version (`1.0.0`) stays correct for `cs-tracker` at the time it was written.
  AD-18's drift check compares a Satellite's declaration against its own vendored file, so nothing
  false-alarms.
- It is the first real exercise of AD-16's change process, on the cheapest possible change, months
  before anything expensive depends on it going smoothly. That is a benefit, not a cost.
- It counts as one of the three hand-copied token changes that earn Epic 6.

**Item 3, the decorative numeral at `error-page.scss:28`.** **Does not dissolve, exactly as the
prompt says.** Whether a large decorative numeral is redundant to the visible 404 message, and
therefore `aria-hidden`, is an accessibility question that survives any redesign. It becomes a
binding acceptance criterion on Story 2.30 rather than an open item: confirm redundancy to a screen
reader, apply `aria-hidden`, and only then is `--token-accent-muted` (ornament only, 2.74:1) the
correct role. If it is not redundant it is text, `--token-accent-muted` is forbidden, and it needs a
role clearing 4.5:1.

### 4.4 New epic, or new stories inside existing epics?

**Decision: hybrid. The Hub's redesign folds into Epic 2. Satellite restyling becomes Epic 8.**

**Why the Hub goes in Epic 2, not a new epic.** Epic 2 already rebuilds the Hub's front door, and
every component it introduces (Registry Entry row, Status mark, premise block, framework band, nav)
was already specified token-native in `EXPERIENCE.md`. Those were never going through the seven
steps. What the change adds is redesigning the *inherited* cybercore surfaces that Epic 2 was going
to migrate instead. Same epic, same files, same acceptance moment ("Daniela lands and the Hub reads
as one product"). Splitting them into two epics would put two epics on the same files with a
dependency running between them, for no gain.

**Why Satellites become Epic 8, not distribution.** Distributing per-Satellite restyle into the
epics that already touch each Satellite would scatter the work across Epics 1, 2 and 4, tie a UI
restyle to an infrastructure migration in Epic 4, and violate AD-20's "one shipped step with nothing
else changing" for both Epic 3's merges and Epic 4's host moves. It would also leave the programme
with no acceptance condition, which is the one thing an epic exists to provide. Restyling has
exactly one: every rendered application carries the suite's component vocabulary.

**Epic 8 is numbered 8 and executes after Epic 2.** Epic numbers in this plan are not execution
order already: Epic 7 is independent of everything. Renumbering to insert an epic would churn all 82
keys in `sprint-status.yaml` for no benefit. The execution position is declared instead.

**Proposed execution order:** Epic 1, Epic 2, **Epic 8 wave 1**, Epic 3, **Epic 8 wave 2**, Epic 4,
Epic 5, Epic 6, Epic 7 (independent throughout).

### 4.5 Sequencing against the estate

**The gate does the work.** FR-38 ties restyle to Suite Directory rendering, which FR-35 already
governs by a declarative Status rule. No second list, no judgement call, no new mechanism.

**Wave 1, after Epic 2, in this order:**

1. **`cs-tracker` (Elixir, Phoenix LiveView, Tailwind v4, daisyUI).** First, because it is the only
   Satellite already on the contract from Story 1.19, so its restyle is the smallest delta in the
   estate rather than a standing start. It is also the hardest framework and the one where the seams
   bite (S-8, LiveView DOM patching interrupting transitions). Failing here is cheapest first.
2. **`digital-library` (Svelte, SvelteKit, Fastify).** Second, because it is the entry a Visitor is
   most likely to open from the Directory, it is a second framework, and it has not adopted yet so
   this story is adopt plus restyle in two shipped steps.
3. **`list-wheel` (Angular, static).** Third, coupled to its relocation (Story 2.25) but **never in
   the same commit**, per AD-20. Relocate, verify, restyle. It is the smallest surface in the estate
   and it is already being touched, so a second visit costs more than the restyle does.

Three applications, three frameworks, three live subdomains. That is the strongest polyglot proof
available and it is the same set that already renders.

**Wave 2, after Epic 3:** `cuatro-tracker` and `cs-tournament`. Both render in the first public
Suite Directory and both therefore earn a restyle under FR-38, but both become `apps/*` in Epic 3
and AD-20 forbids their merge steps from carrying anything else. Their restyle waits for the merge
and then ships as its own step. **This was not named in the prompt and is flagged as a gap it did
not cover.**

**The four unbuilt applications: no restyle, no story, no placeholder.** `StreamVault`, `MaiCoin`,
`poketracker-go` and `Mutuo` are unrendered by FR-35 and therefore unrestyled by FR-38. Epic 8
carries a rule for them, not four stories. The trigger is precise: when an application's Registry
`status` becomes `Live` or `Complete` and it begins rendering, a restyle story is created then and
only then. `cuatro-finance` sits in the same bucket.

**Stated head-on, as the prompt asked:** restyling an unbuilt, unrendered application is work with
no Visitor-visible return, and this proposal spends nothing on it. It also makes the §13 Q10
decision cheaper rather than harder, in a way worth recording: **every unbuilt application that
later becomes Live now imports a restyle as well as feature work.** Archiving one closes both
obligations permanently. That is new information for a decision the PRD explicitly left to the
Operator, and it tilts §F.3's argument slightly further toward archiving.

### 4.6 Success metrics

**SM-6, amended.** Current text targets a count, at least 2. Under a restyle programme a count is
wrong in both directions: it understates the goal and it can be satisfied by adoption alone, which
is now the floor. Raising the number would be worse, because it turns SM-6 into a growth metric and
walks straight into SM-C2.

> **SM-6, Token adoption breadth.** Share of applications rendered in the Suite Directory that
> consume the shared Token Contract. Target **100% of rendered entries**, continuously. Validates
> FR-16, FR-18, FR-38.
> *A share, not a count. Adding a rendered application that has not adopted lowers this metric,
> so it cannot be improved by growing the estate.*

**SM-12, new.**

> **SM-12, Component-level coherence.** Per rendered application, binary: does it render the
> Ecosystem's component vocabulary (Status mark border discipline, hairline separators, unfilled
> buttons, the focus ring, no shadows, no gradients, accent under 3% of viewport) rather than its
> framework's defaults? Target: yes for every rendered application. Verified by UX-DR41's four
> manual checks plus a greyscale render, recorded per application. Validates FR-36, FR-37.

**SM-C6, new. This is the counter-metric the change requires.**

> **SM-C6, Applications restyled but not rendered.** Counterbalances SM-12 and the pull toward
> polishing surfaces nobody reaches. **Target zero, always.** A restyle that precedes rendering
> spends the Operator on an invisible surface. This is FR-38 expressed as a number.

**Counter-metrics checked against the change, as the prompt asked:**

- **SM-C2 (Registry Entry count) does not conflict. It is strengthened.** Making SM-6 a share of
  rendered entries means every additional rendered entry adds restyle debt. Growing the estate to
  look busy now costs measurably more than it did. SM-C2 stays exactly as written and bites harder.
- **SM-C3 (applications wired to cross-app identity) does not conflict.** It counterbalances SM-9,
  which is about identity, and restyling wires no identity. But it does not cover the equivalent
  restyle risk, which is why SM-C6 is added rather than SM-C3 being stretched.
- **SM-C4 (VPS load average) is untouched.** Restyling adds no serving load. It still wins every
  conflict; it just does not have one here.
- **SM-C5 (Hub asset weight) now binds the redesign.** Every Hub redesign story is measured against
  UX-DR49's 140 KB non-3D budget. Story 2.20's deletion of three font binaries is the offset, and
  dropping GlitchText's aberration keyframes is a further reduction. Net expected favourable, but it
  must be measured, not assumed.
- **SM-11 (Suite Directory strength, target 6) is unchanged.**

### 4.7 The impact on `sprint-status.yaml`

**Epic 1 can start now, unchanged. All twenty stories survive verbatim.** Story 1.1 can open today
without waiting for a single line of this proposal to be implemented.

Confirmed story by story: 1.1 to 1.16 are estate archiving, the three AD-17 gates, capacity
measurement, routing enumeration, the `digital-library` backup gap, the tracked AD-8 violation,
Playwright installation, and the three contract-publication stories plus the CI boundary check, the
daisyUI route test and contract serving. None touches component styling. 1.17 adds files and changes
nothing. 1.18's acceptance criteria are untouched; only its *lifetime* changes, and that is an edit
to Story 2.22's dependency, not to 1.18. 1.19 remains the nine-line adoption, which still satisfies
FR-18 and SM-6 on its own. 1.20 records the version and the automation policy.

The 82 actionable stories become **93**: Epic 1 unchanged at 20, Epic 2 from 26 to 31, Epics 3 to 7
unchanged at 8 + 11 + 11 + 4 + 2, plus Epic 8 at 6.

---

## 5. Detailed Change Proposals

### 5.1 PRD, three new Functional Requirements in §4.4

```
#### FR-36: Visual restyle is what adoption means for a rendered application

An application the Suite Directory renders carries the Ecosystem's component vocabulary in its own
framework, not only the Ecosystem's token values. Realizes UJ-1, UJ-2, UJ-4.

Consequences (testable):
- The application's own components (its controls, its rows, its separators, its focus treatment,
  its status affordances) follow the Ecosystem's component specification rather than its
  framework's or component library's defaults.
- The restyle is implemented natively. No application imports a component, a class-name library, or
  any file from the Anchor other than the vendored cuatro-contracts/ folder.
- A restyle changes presentation only. Behaviour, routes, data and feature set are untouched, and a
  restyle that changes any of them is out of scope by PRD §8.
- Verified by SM-12's per-application check, not by asserting that the token file is imported.

#### FR-37: The Anchor's components are token-native by construction

The Hub's own components are built against the Token Contract rather than migrated onto it.

Consequences (testable):
- No component stylesheet in the Anchor consumes a transitional alias once its component has been
  redesigned.
- No colour, spacing or type literal exists outside contracts/ and _print.scss, enforced by a
  blocking CI check rather than by a one-time sweep.
- The transitional alias layer introduced at migration step 2 has a named removal condition (the
  last redesigned component) and is deleted when it is met.
- Seam S-1 stands: the Three.js narrative's colours are JS values and remain a declared exception.

#### FR-38: Restyle follows visibility

An application earns a restyle when the Suite Directory renders it, and never before.

Consequences (testable):
- The trigger is FR-35's existing declarative Status filter. No second list is maintained.
- No restyle work item exists for an application with Status In progress or Archived. SM-C6 targets
  zero, always.
- An application becoming Live or Complete creates a restyle obligation at that moment, and
  archiving it instead closes that obligation permanently.
- The Operator can determine, from the Registry alone, which applications owe a restyle.
```

### 5.2 Architecture, two forced changes and two new invariants

**AD-14, forced change.** The phrase "adoption is all-or-nothing" acquires a second meaning it
cannot carry. It was written about the *contract files*: import all three or none, because a
half-imported contract mints half a system. Read as "restyle wholly or not at all" it contradicts
AD-20, because a restyle is inherently incremental and AD-20 requires every step to leave a working
system. Add to AD-14's rule:

> All-or-nothing binds the **contract import**, not the restyle. A restyle proceeds component by
> component and reaches the Visitor as one merge; intermediate commits live on a branch, and CI's
> blocking gates (AD-21) apply to them unchanged. In the Anchor, the step-2 alias layer is what
> keeps un-redesigned components coherent meanwhile, which is why that layer survives until the last
> redesign lands.

**AD-19, forced change with a real cost.** Current text ends: "After token adoption, `cs-tracker` is
measured once by hand against the same floor and the result recorded." Replace `cs-tracker` with
**every restyled application**. That is three manual passes in wave 1 and two more in wave 2, rather
than one. The cost is real, it is not avoidable (a restyle can lower contrast, break a focus ring,
or shrink a hit target in ways no CI job on the Anchor can see), and it is named rather than
absorbed.

**AD-21, small change.** Add the FR-17 conformance grep to the enumerated list of blocking gates,
alongside typecheck, unit tests, Registry schema validation, `contracts/` purity, the Playwright
floor and Lighthouse accessibility.

**AD-24, new. This is the invariant that protects AD-2 from the pressure this change creates.**

```
### AD-24: Restyle is native, and the component vocabulary federates as a specification, never as code

- Binds: FR-36, FR-37, FR-38, Epic 8, all Satellites and all apps/*
- Prevents: the restyle programme producing exactly the shared component library AD-2 and PRD §8
  rule out. This is the first configuration of the estate in which that argument has a real
  premise, and the evidence against it has not changed: Google defunded Material Web (2024-06),
  GitHub retired Primer ViewComponents (2026-02), Adobe maintains parallel implementations with no
  consolidation plan.
- Rule: Each application implements the component vocabulary in its own framework, from the written
  Restyle Specification. No Satellite imports a component, a class-name library, a stylesheet other
  than its vendored cuatro-contracts/ folder, or any packages/* artifact from the Anchor. The same
  component recurring across three or more applications is evidence that the specification should
  be better, never that a package should exist. AD-1's CI purity check is unchanged and still holds
  the boundary. If a corrected plan implies shared component code crossing the Turborepo boundary,
  the plan is mis-scoped, not the rule.
```

**AD-25, new.**

```
### AD-25: A restyle exists only for an application the Suite Directory renders

- Binds: FR-38, Epic 8, SM-C6, PRD §9.2
- Prevents: the Operator, who is the estate's scarcest resource, being spent on surfaces no Visitor
  reaches
- Rule: An application earns a restyle when its Registry status becomes Live or Complete and it
  therefore passes FR-35's filter. The gate is that same declarative rule; no second list is
  maintained and no judgement call is made at the moment judgement is least reliable. A restyle
  work item for an unrendered application is a defect. Archiving an unbuilt application is a
  legitimate and permanent way to close its restyle obligation.
```

**Spine frontmatter:** add `EPIC-8` to `binds`, and extend the FR range to `FR-1..FR-38`.

**Capability to Architecture Map:** add rows for Epic 2 Hub redesign (AD-14, AD-19, AD-24), Epic 8
wave 1 and wave 2 (AD-14, AD-19, AD-20, AD-24, AD-25).

### 5.3 UX, the largest gap and the new deliverable

**The gap, stated plainly: `EXPERIENCE.md` § Component Patterns specifies the Suite Directory's new
components and nothing else.** `GlitchText`, `ScanlineOverlay`, `HudLabel`, `HomeLayout` and
`Error404` have no design contract anywhere in the planning chain. Under the old plan that was fine,
because those components were being *migrated*, and a migration needs a mapping table rather than a
design. Under this change they are being *redesigned*, and a redesign story with no design
specification is a dev story making design decisions. That is precisely the failure O-12 exists to
prevent, generalised to eight more components.

**Required before Epic 2's redesign stories open:**

1. **`EXPERIENCE.md` § Component Patterns gains an entry per redesigned Hub component**, at the same
   depth as the existing Registry Entry and Status mark entries.
2. **A new deliverable, the Restyle Specification.** The component vocabulary stated
   framework-agnostically: what a control, a row, a separator, a focus treatment, a status
   affordance and a heading are in this system, expressed so an Elixir, Svelte, Angular, Vue or
   React implementation can each be written from it independently. This artifact is the thing AD-24
   says federates *instead of* code. Without it, seven restyles drift and the "one product" claim
   fails at the third application.
3. **`DESIGN.md` § Migrating the Anchor § Sequence** rewritten: steps 1 and 2 survive, step 5 moves
   to the front of the redesign, steps 3, 4 and 6 are struck, step 7 is retargeted.
4. **`DESIGN.md` § `tokens.css`** gains `--token-scrim` if §4.3's recommendation is accepted.
   Contract to v1.1.0.
5. **`EXPERIENCE.md` § Open Items:** O-12 items 1 and 2 close into the redesign pass; item 3 stays
   open and becomes an acceptance criterion on Story 2.30. O-11 (`--accent-glow`) is unaffected.

### 5.4 Epic 2, eight new stories

Numbering continues from 2.26. **Existing numbers are not reshuffled**; 2.18, 2.19 and 2.21 become
holes so that no story key in `sprint-status.yaml` changes meaning.

| # | Story | Governing ADs | Depends on | Notes |
|---|---|---|---|---|
| 2.27 | Redesign `GlitchText` token-native | AD-14, AD-19, AD-24 | 1.18, 2.20 | Closes O-12 item 1. Recommendation: the red and cyan aberration is dropped, not excepted |
| 2.28 | Redesign `ScanlineOverlay` token-native, add `--token-scrim` | AD-14, AD-16, AD-19, AD-24 | 1.18, 2.20 | Closes O-12 item 2. Contract to v1.1.0. First real exercise of AD-16 |
| 2.29 | Redesign `HomeLayout` token-native | AD-14, AD-19, AD-24 | 1.18, 2.20, 2.12 | Largest single surface. Seam S-1 stands for the 3D scene |
| 2.30 | Redesign `Error404` token-native | AD-14, AD-19, AD-24 | 1.18, 2.20, 2.17 | **Carries O-12 item 3 as a binding AC**: confirm the numeral is redundant to a screen reader and `aria-hidden` before `--token-accent-muted` is permitted |
| 2.31 | Redesign `WorkItem` and `HudLabel` token-native | AD-14, AD-19, AD-24 | 1.18, 2.20 | Absorbs the whole of deleted Story 2.18 |
| 2.32 | Redesign the chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container` | AD-14, AD-19, AD-24 | 2.15, 2.20 | After 2.15's nav reshape, never inside it |
| 2.33 | Redesign `WorkHero` and `WorkTimeline` token-native | AD-14, AD-19, AD-24 | 2.16, 2.20 | `WorkTimeline` is reused unchanged in structure by 2.16 (UX-DR28); this restyles it |
| 2.34 | FR-17 conformance: no colour literal outside the contract | AD-14, AD-21 | 2.27 to 2.33 | Replaces deleted Story 2.19. A **blocking CI grep**, plus `celeste.scss`'s two literals. `_print.scss` explicitly excluded |

**Amended existing stories:**

- **2.20:** content unchanged; `Depends on` unchanged (1.12, 1.18); add a note that it now precedes
  every redesign story and is the first of the restyle sequence.
- **2.22:** `Depends on` changes from 2.21 to 2.33. Third acceptance criterion changes from
  "visually identical to the pre-deletion build" to "no rule anywhere references an alias name, and
  Story 2.34's gate passes."
- **2.25:** add a note that `list-wheel`'s restyle is Epic 8 Story 8.3 and ships as a separate step
  after relocation is verified, per AD-20.
- **2.2:** add the Hub redesign to what the asset-budget measurement covers, so SM-C5 has a
  baseline before eight stories change the CSS.

**Epic 2 header amendments:** FRs covered gains FR-37; "Also carries" gains the Hub component
redesign and the closure of O-12 items 1 and 2; the O-12 blocking note is rewritten, since the
stories it blocked no longer exist.

### 5.5 Epic 8, new

```
### Epic 8: Every rendered application reads as one product

After Epic 8 a Visitor moving between the Hub and any application in the Suite Directory finds not
just the same palette and type scale but the same component vocabulary: the same separators, the
same unfilled controls, the same focus ring, the same status discipline. The polyglot claim stops
resting on a shared file and starts resting on a shared specification implemented five times, which
is the harder and more interesting version of it.

FRs covered: FR-36, FR-38. FR-37 is Epic 2's.
Governing ADs: AD-14, AD-16, AD-19, AD-20, AD-24, AD-25
Execution position: wave 1 after Epic 2; wave 2 after Epic 3.
Blocked by: Epic 2, which must first produce the Hub's component vocabulary and the Restyle
Specification. Restyling a Satellite toward a target that does not exist yet is guesswork.
Standalone: yes. Each story ships one application and leaves every other application untouched.
```

| # | Story | Wave | Depends on | Notes |
|---|---|---|---|---|
| 8.1 | `cs-tracker` visual restyle (Phoenix LiveView, Tailwind v4, daisyUI) | 1 | 1.19, Epic 2 | Smallest delta, already adopted. Carries seam S-8 (`phx-update="ignore"`). Manual AD-19 pass recorded |
| 8.2 | `digital-library` adopts the contract and is restyled (SvelteKit) | 1 | Epic 2 | Two shipped steps: adopt with the nine hand-fix lines, verify, then restyle. Non-Tailwind consumer, imports the plain pair |
| 8.3 | `list-wheel` visual restyle (Angular, static) | 1 | 2.25, Epic 2 | Separate shipped step after relocation is verified, never the same commit (AD-20) |
| 8.4 | Record the restyle floor and the per-application coherence check | 1 | 8.1, 8.2, 8.3 | SM-12 evidence per application: UX-DR41's four manual checks plus the greyscale render. The Story 1.20 equivalent for restyle |
| 8.5 | `cuatro-tracker` visual restyle | 2 | Epic 3 Story 3.6 | Rendered, so FR-38 applies. Tailwind consumer inside the Turborepo after the merge |
| 8.6 | `cs-tournament` visual restyle | 2 | Epic 3 Story 3.7 | Rendered, so FR-38 applies. Restyle after the Vercel exit, not during it |

**Recorded as a rule, not as stories:** no restyle work item exists for `StreamVault`, `MaiCoin`,
`poketracker-go`, `Mutuo` or `cuatro-finance`. FR-38 and AD-25 create one at the moment any of them
begins rendering in the Suite Directory. SM-C6 targets zero restyles ahead of that moment.

---

## 6. Where this change strains a settled decision

Surfaced rather than worked around, as the prompt required. Two are real, two are cheap, and none
is fatal.

### 6.1 AD-2 survives, but it stops being easy, and that is new

Under token-only adoption there was never a reason to share components, because nothing was being
built twice. Under a restyle programme the same eight or nine components (status affordance, entry
row, hairline separator, unfilled control, focus ring, nav) get implemented in HEEx, Svelte,
Angular, React and Vue. **That is genuine five-fold duplication, and it is the first configuration
of this estate in which the shared-library argument has a real premise rather than a hypothetical
one.**

The decision still holds. The evidence has not changed, no library spans these five frameworks, and
the estate has one maintainer who would own it. But the decision now needs a defence rather than a
restatement, and AD-24 is that defence: the vocabulary federates as a written specification, which
is *why* the Restyle Specification in §5.3 is a required deliverable and not documentation polish.
**If that artifact is not written, this is the decision that breaks first**, because the pressure to
extract a package rises exactly when five hand-written implementations start drifting.

### 6.2 AD-14's "all-or-nothing" cannot mean two things at once

Detailed in §5.2. Read as binding the restyle rather than the contract import, AD-14 and AD-20
contradict each other outright: one would forbid a partially restyled application, the other
requires every step to ship working. The proposed clarification resolves it, and the resolution is
the reason Story 1.18's alias layer must survive.

### 6.3 FR-18 must not be redefined, and this is the load-bearing "do not touch"

It would be tempting to raise FR-18's bar now that "reads as one product" is the goal. **Do not.**
FR-18 is Epic 1's acceptance condition and the entire basis of Epic 1's standalone claim. If FR-18
comes to mean "restyled", Epic 1 becomes blocked on Epic 8, which is blocked on Epic 2, and the
foundation epic stops delivering visible value on its own. That would put PRD §14's highest-severity
risk (the Operator abandoning mid-migration, mitigated by "Epic 1 delivers visible value in its own
right") back on the table for no gain.

FR-18 stays as written and stays satisfied by adoption alone. The stronger claim is measured by
FR-36 and SM-12. This separation is the single most important structural decision in this proposal.

### 6.4 Two smaller items

- **AD-18's drift check has a blind spot that now matters.** It compares a Satellite's declaration
  against its own vendored file, so a Satellite trailing the contract by a minor version passes. That
  was harmless when the contract never changed. With `--token-scrim` it will change. Not a defect and
  not urgent, but the Operator has no signal for "who is behind", and it is cheaper to know that now
  than to discover it at the third token change.
- **O-12 is not fully closed by this change**, and the prompt was right about which part survives.
  Item 3, the `error-page.scss:28` numeral, is an accessibility question that no redesign answers. It
  moves from an open item to a binding acceptance criterion on Story 2.30, which is a better place
  for it than a blocking note on two stories that no longer exist.

---

## 7. Implementation Handoff

### 7.1 Change scope classification: **Major**

It amends the PRD's non-goals and MVP scope, adds three FRs, forces changes to two ADs, adds two
ADs, deletes or replaces three stories, adds fourteen, creates an epic and requires a new UX
deliverable. This is a replan, not a backlog reshuffle.

### 7.2 Routing, in order

| # | Recipient | Deliverable | Blocks |
|---|---|---|---|
| 1 | **`bmad-prd` (update intent)** | §3 glossary, §8 non-goals, §9.1 and §9.2 scope, FR-36 to FR-38 in §4.4, §10 sequencing table, §11 metrics, a §13 Q10 note | Everything below |
| 2 | **`bmad-architecture` (update intent)** | AD-14 and AD-19 forced changes, AD-21 gate list, new AD-24 and AD-25, frontmatter binds, Capability map rows | Epics regeneration |
| 3 | **`bmad-ux`** | The `EXPERIENCE.md` component entries, the **Restyle Specification**, `DESIGN.md` sequence rewrite, `--token-scrim`, O-12 disposition | **Epic 2's redesign stories cannot open without this** |
| 4 | **`bmad-create-epics-and-stories`** | Epic 2 story deltas, Epic 8, full acceptance criteria for stories 2.27 to 2.34 and 8.1 to 8.6 | Sprint regeneration |
| 5 | **`bmad-sprint-planning`** | Regenerate `sprint-status.yaml` per §7.3 | Development |
| 6 | **`bmad-project-context` (refresh)** | Three `AGENTS.md` pitfall lines change (the O-12 hold, the migration-step sequence, the `--accent-dim` per-call-site rule). The existing pre-Epic-2 reminder already covers the timing | Before Epic 2 |

**None of this blocks Epic 1.** Story 1.1 can open today.

### 7.3 `sprint-status.yaml` regeneration instructions

- **Epic 1: no change.** All twenty keys stay exactly as they are.
- **Epic 2:** remove `2-18-migration-step-3-retire-the-violet-hairlines`,
  `2-19-migration-step-4-sweep-the-colour-literals`, and
  `2-21-migration-step-6-rename-the-call-sites`. Add eight keys for 2.27 to 2.34. **Do not renumber
  2.20, 2.22 to 2.26**; the holes are deliberate so no existing key changes meaning.
- **Epics 3 to 7: no change.**
- **Epic 8: new**, six keys, `epic-8: backlog` plus `epic-8-retrospective: optional`.
- **Add an execution-order comment** recording that Epic 8 wave 1 runs after Epic 2 and wave 2 after
  Epic 3, since epic numbers are not execution order in this plan.
- Actionable stories move from 82 to 93.

### 7.4 Success criteria for this change being correctly implemented

1. Epic 1 opened and progressed without waiting on any artifact edit above.
2. PRD §8 states the presentation carve-out and its boundary, and §9.2 states that unrendered
   applications are not restyled.
3. The Restyle Specification exists before Story 2.27 opens.
4. No `packages/*` artifact and no component file is imported by any Satellite. AD-1's CI purity
   check still passes unchanged.
5. SM-C6 reads zero throughout: no application is restyled before the Suite Directory renders it.
6. FR-18 is still satisfied by Story 1.19 alone, and Epic 1's standalone claim is intact.
7. Story 2.34's conformance grep is a blocking CI gate, not a warning (AD-21).

---

## 8. Checklist record

| Section | Item | Status | Finding |
|---|---|---|---|
| 1 Trigger | 1.1 Triggering story | **N/A** | No story has started; all 82 are `backlog`. Trigger is an Operator decision, not an implementation discovery |
| | 1.2 Core problem | **Done** | New stakeholder requirement, deliberate scope expansion |
| | 1.3 Evidence | **Done** | Nine specific artifact collisions listed in §1.2 |
| 2 Epic impact | 2.1 Current epic completable | **Done** | Epic 1 yes, unchanged. Epic 2 needs modification |
| | 2.2 Epic-level changes | **Done** | Modify Epic 2, add Epic 8 |
| | 2.3 Remaining epics | **Done** | Epic 3 gains a dependency. Epics 4 to 7 unaffected |
| | 2.4 Obsolete or new epics | **Done** | None obsolete. Epic 8 added |
| | 2.5 Order or priority | **Done** | Epic 8 inserts between Epic 2 and Epic 3 in execution order; numbering unchanged to avoid churn |
| 3 Artifacts | 3.1 PRD conflicts | **Action-needed** | §8, §9.1, §9.2, §3, §4.4, §10, §11, §13 |
| | 3.2 Architecture conflicts | **Action-needed** | AD-14 and AD-19 forced; AD-21 amended; AD-24 and AD-25 added |
| | 3.3 UI/UX conflicts | **Action-needed** | Largest gap: no design contract for the components being redesigned. New deliverable required |
| | 3.4 Other artifacts | **Action-needed** | One CI gate added. `AGENTS.md` refresh already scheduled pre-Epic-2. No infra, deploy or monitoring change |
| 4 Path forward | 4.1 Direct Adjustment | **Viable** | Effort medium, risk medium. **Selected** |
| | 4.2 Rollback | **Not viable** | Nothing has started |
| | 4.3 MVP Review | **Viable, partially adopted** | MVP redrawn, not reduced |
| | 4.4 Recommendation | **Done** | Hybrid: Direct Adjustment plus a bounded MVP redraw |
| 5 Proposal | 5.1 to 5.5 | **Done** | §1 to §7 above |
| 6 Handoff | 6.1 to 6.3 | **Action-needed** | Awaiting Operator approval |
| | 6.4 `sprint-status.yaml` | **Action-needed** | Instructions in §7.3 |
| | 6.5 Next steps | **Done** | §7.2 |
