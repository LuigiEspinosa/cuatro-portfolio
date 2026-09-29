---
title: Input-Reconciliation Review — ARCHITECTURE-SPINE.md (InclusivCup)
reviewer: input-reconciliation reviewer (pre-handoff gate)
date: 2026-06-30
target: ../ARCHITECTURE-SPINE.md
verdict: CONCERNS
sources-reconciled:
  - prds/prd-cs-tournament-2026-06-29/prd.md
  - prds/prd-cs-tournament-2026-06-29/addendum.md
  - ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md
  - ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md
  - briefs/brief-cs-tournament-2026-06-29/brief.md
---

# Input-Reconciliation Review — InclusivCup Architecture Spine

## Verdict: CONCERNS

The spine is strong and faithful on the *technical* invariants — demo-as-truth, single-writer
derivation, idempotent ingestion, atomic Aprobar, SteamID64 join key, RLS-gated approved-only
reads, the deterministic HMAC-SHA256 fairness pipeline, the integer-only/cross-multiplication
locked stats conventions (ADR overkill-capped, KAST 5s window), the FR-21 floors (24 rounds / 20
kills / ≥50% idle DQ), pity, anti-sweep, the FR-29 tie ladder, and the Vercel-bypass storage
abstraction. Those land cleanly and are not re-litigated here.

What did NOT land are several *quiet* requirements — a tone/secrecy mechanic, an accessibility
rule, an exact-string registry, and an explicit prohibition — that the UX and PRD treat as
load-bearing but the AD structure either omits, demotes below the invariant line, or under-specifies.
One is severity-high (award secrecy is a data-access invariant the spine never states). The rest are
medium: they are *implied* by adjacent invariants but not *named*, which at a pre-handoff gate is
exactly the failure mode that lets a builder ship the implied-but-unstated thing wrong.

None of the findings are contradictions of the inputs; they are omissions / under-specifications at
the invariant level. Hence CONCERNS, not FAIL. The technical spine does not need rework — it needs
~3 invariants added or promoted and 1 explicit prohibition recorded.

---

## Findings

### F1 — [HIGH] Blurred-until-spin award secrecy is not an architecture invariant; it is left as a client cosmetic

**Inputs.** This is one of the product's core mechanics, stated repeatedly:
- PRD FR-24: "Award categories are hidden from Viewers until revealed in the Ceremony"; the catalog
  "stays blurred from non-Admins until its Spin."
- PRD FR-30: "Categories remain blurred until their Spin reveals them."
- PRD SM-2 / UJ-1 / Vision: keeping every race alive depends on viewers *not knowing which stat
  feeds which award* until the reveal.
- UX EXPERIENCE State Patterns ("Blurred-until-ceremony"): "A Viewer can lead a *stat* (e.g. knife
  kills) without knowing which Award it feeds — keeping every race alive to the ceremony."
- UX Interaction Primitives + DESIGN `{components.blurred-lock}`: "7px blur + lock glyph … **No gold
  leaks through the blur.**"

**What the spine does.** AD-7 ("Viewers read approved-only, enforced at the row level") gates
**`stat_row.status = 'approved'`**. The `blurred-lock` is a 7px CSS blur in DESIGN.md. The ERD has
`ceremony.state ∈ {not_started|locked|spinning|complete}` and `spin`/`award_result` tables, but **no
per-result reveal-gating column** (e.g. `award_result.revealed_at`) and **no RLS invariant** that
withholds the `award` catalog, `award_result`, and `spin` rows from viewers until the row's spin
fires.

**Why it's a drop, not a nit.** A 7px CSS blur is bypassable in devtools / by reading the network
payload in one second. The *secrecy* must be enforced at the data-access layer — the unrevealed
award identities and their resolved winners must not be sent to a viewer client at all. AD-7's
approved-only rule is about *Pending stats*, a different concern; it does not cover *future award
identities/results that are already computed but not yet revealed*. The spine therefore has no
invariant preventing the single most spoiler-sensitive payload in the product from leaking over the
`ceremony:{id}` channel or a published read. This silently undercuts FR-24, FR-30, and SM-2.

There is also a subtlety the spine must resolve: AD-15 freezes the snapshot and AD-14 makes the
*whole* ceremony a pure function of the published bundle — so **the winners are deterministically
knowable the instant the seed (final demo hash) is published**, which is *before* the ceremony plays
out. The "Verificar la ceremonia" bundle, if published at ceremony-lock, contains every winner. The
secrecy invariant must reconcile "publish the bundle so it's verifiable" with "don't reveal winners
before their spin" — most likely: the full verification bundle publishes only *after* the ceremony
completes (or per-spin, incrementally), and the pre-reveal `award_result` rows are RLS-hidden from
viewers until `ceremony.state` advances past their spin. The spine does not address this tension at
all.

**Fix.** Add an invariant (e.g. AD-19 "Award identities and results are reveal-gated"):
`award`, `award_result`, `award_result_winner`, and the verification bundle are not viewer-readable
until the owning spin is revealed (and the full bundle not until the ceremony completes); enforce via
RLS keyed on `ceremony.state` / a per-`award_result.revealed_at`, never via client-side blur.
Cross-reference it from AD-11 (the `ceremony:{id}` Broadcast must carry only already-revealed
results) and from the Provably-Fair section (bundle-publication timing).

---

### F2 — [MEDIUM] Reduced-motion ceremony determinism (identical seeded *order*, not just outcome) is not stated as an invariant

**Inputs.** UX EXPERIENCE Accessibility Floor flags this as **CRITICAL**: "When
`prefers-reduced-motion` is set, the wheel does **not** spin and `{components.reveal-flip}` does
**not** animate: the category resolves and the winner's name appears directly in gold … The *outcome
and order are identical* to the animated path — only the motion is removed." Flow 4's failure path
repeats it: "winners resolve directly in gold **in the identical seeded order**." PRD FR-30: "The
reveal order follows the seeded Spin sequence."

**What the spine does.** AD-14 makes winners deterministic and mentions "seeded reveal order via the
pity stream" for pity specifically. AD-15 freezes the snapshot. AD-11 says every viewer surface is
reconstructable from published state. The `spin_plan` is published in the bundle. So the *order* is
derivable in principle.

**Why it's a drop.** Determinism of *outcome* is well-covered; determinism of *reveal order as a
seeded, published artifact that the reduced-motion path renders identically* is never named. The
spine never states (a) that the per-spin sequence/order is itself part of the seeded, reproducible
contract for the main spins (only pity's reveal order is called out), nor (b) the accessibility
invariant that the reduced-motion path is the *same computation with animation removed*, sharing one
code path so the two can never diverge. This is precisely the kind of quiet a11y rule that gets
implemented as a separate "static" rendering branch and silently drifts. At a gate, "it's implied by
AD-14" is not the same as "it's pinned."

**Fix.** Extend AD-14 (or add a one-line invariant): the main-spin reveal **sequence/order** is a
seeded artifact published in the bundle alongside winners; the animated and reduced-motion ceremonies
consume the identical resolved sequence (one source of truth, motion is presentation-only), so order
and outcome are identical under `prefers-reduced-motion`. Note it in the Provably-Fair bundle list
(the spin order should be a verifiable field) and reference the a11y rule.

---

### F3 — [MEDIUM] "No in-app raise-dispute button" (evidence-only disputes, OQ-6) is never recorded as a prohibition

**Inputs.** The UX bans this explicitly and repeatedly:
- EXPERIENCE IA (Evidence view): "**Read-only, evidence-only** — there is no in-app raise-dispute
  button (OQ-6); disputes are raised out-of-app in Discord and settled here."
- EXPERIENCE Interaction Primitives "Banned everywhere": "an in-app raise-dispute button (OQ-6 —
  evidence-only)."
- EXPERIENCE Provably-Fair + Inspiration ("Rejected — an in-app dispute button").
- DESIGN `{components.evidence-block}`: "**No raise-dispute button** (OQ-6)."
- PRD OQ-6 + UJ-3 + SM-3: disputes resolve to the demo via re-parse + published hash, raised
  out-of-app.

**What the spine does.** AD-1 lists "disputes" in its Binds and frames disputes as evidence-resolved
("disputes resolved by an admin's word instead of evidence"). The admin command routes are
enumerated as approve / advance / forfeit / reparse / rollback (correctly *excluding* a dispute
action), and the topology shows the offline verify path. So the spine *behaves* consistently with
evidence-only.

**Why it's a drop.** The spine never states the *prohibition*. The absence of a dispute route in a
list is not the same as an invariant saying "there is no dispute-mutation surface; disputes are
evidence-only, resolved out-of-app." A downstream builder reading the spine could reasonably add a
"flag dispute" or "open dispute" affordance/route believing it harmless — nothing in the spine
forbids it, and AD-8 ("admin-only mutations") would even bless an admin dispute route. This is a
designed *non-feature* that the spine should lock the same way it locks "no money stored" and "no
season features."

**Fix.** Add a one-line invariant or a "Designed non-features (locked)" note: disputes are
evidence-only (OQ-6) — re-parse + re-hashable demo + reproducible seed are the dispute resolution;
there is **no** in-app raise/flag-dispute mutation route or affordance on any surface (viewer or
admin). The evidence block is read content, not a control.

---

### F4 — [MEDIUM] Spanish-UI invariant is demoted from an invariant to a convention-table aside

**Inputs.** The Spanish UI is a hard product invariant, not a styling preference:
- EXPERIENCE Foundation: "Rationale prose is English; **every UI string is Spanish** (the product
  ships in Spanish)."
- EXPERIENCE Voice and Tone + DESIGN Brand: "The product UI ships in **Spanish**."
- The Voice table mandates Glossary terms verbatim and bans English/system-voice phrasings.

**What the spine does.** Consistency Conventions / Naming line: "Spanish UI strings centralized in one
i18n module (exact, load-bearing); identifiers/code/comments and this spine in English." `app/` and
F5 are tagged "(Spanish, mobile-first)."

**Why it's a (lesser) drop.** The intent is present and correct — the spine deliberately stays in
English and points UI strings to one i18n module, which is the right structural call. But "every
viewer string is Spanish" is buried as a half-clause inside a naming-conventions cell, alongside
table-casing rules. For a product where shipping an English string is a visible product defect, this
deserves invariant status (it is a divergence-class rule: an English label leaking to a viewer is
exactly the kind of consistency break the spine exists to prevent). As written, it is easy for a
builder to treat as advisory.

**Fix.** Promote to a short invariant (e.g. "All viewer-facing copy is Spanish, sourced from the one
i18n module; the module is the single registry of the exact load-bearing strings; no inline
viewer-facing English literals"). Keep the English-for-code/spine half. Optionally point the module
at the EXPERIENCE Voice table as the canonical source.

---

### F5 — [MEDIUM] The exact load-bearing strings are asserted to exist but never enumerated or anchored

**Inputs.** EXPERIENCE Voice and Tone: "**Transparency strings are load-bearing and fixed:**
'Verificado desde el demo' … 'Sembrado por el demo final · reproducible' … 'Verificar la ceremonia'
… 'Aprobado' · 'Pendiente'." These are exact strings the UX pins.

**What the spine carries.** Only **"Verificar la ceremonia"** appears verbatim (topology label,
`lib/roulette` comment, Provably-Fair heading). The DB uses English enum values `status =
'pending' | 'approved'` (correct for code), whose Spanish *renderings* are "Pendiente"/"Aprobado" —
but the spine never states that mapping. "Verificado desde el demo" and "Sembrado por el demo final ·
reproducible" appear nowhere. The Naming line asserts the i18n module holds strings that are "exact,
load-bearing" but does not enumerate them or name the registry of record.

**Why it's a drop.** The spine claims exactness without locating it. There is no pointer telling a
builder *which* strings are load-bearing-exact (vs. freely translatable), where they live, or that
`status` enum values must render to the fixed "Pendiente"/"Aprobado" and not some synonym. The risk:
a builder renders `'approved'` as "Procesado ✓" (explicitly on the UX *Don't* list) or paraphrases
the seed/provenance strings, breaking the trust microcopy the whole fairness story rides on.

**Fix.** In the i18n invariant (F4), state that the EXPERIENCE Voice "load-bearing and fixed" strings
are exact constants in the i18n module — minimally enumerate the five: "Verificar la ceremonia",
"Verificado desde el demo", "Sembrado por el demo final · reproducible", "Pendiente", "Aprobado" —
and pin the enum→label mapping `status='pending'→"Pendiente"`, `status='approved'→"Aprobado"`.

---

## Verified-as-honored (no action)

These load-bearing inputs the spine *does* honor at the invariant level — recorded so the gate is
auditable:

- **Mobile-first viewer surfaces / desktop admin.** Honored. Source tree + F5 tag `app/` viewer reads
  as "(Spanish, mobile-first)"; the spine's scope and capability map keep admin command routes
  distinct. (Note: the *exact* breakpoints / two-pane ~1080px admin shell / 44px tap targets live in
  DESIGN+EXPERIENCE and are correctly left out of the spine — that is altitude-appropriate, not a
  drop. The mobile-first/desktop-admin split itself is present.)
- **"Everyone stays in it / nobody leaves empty-handed" (SM-2, pity).** Honored. AD-14 + the Pity
  bullet make "every non-fully-DQ'd player with an empty shelf gets a guaranteed consolation award"
  an *invariant outcome*; anti-sweep (≤1 trophy/player/spin) is pinned. The intent is structurally
  enforced. (The only adjacent gap is F1 — keeping the *races visibly alive* depends on the secrecy
  invariant, so SM-2's "until the final ceremony" clause partly rides on F1.)
- **Locked stats conventions.** Honored and explicit: ADR overkill-capped + KAST 5s trade window are
  in the Data & formats convention row and AD-bound; FR-21 floors (≥24 rounds; ≥20 kills for
  rate/HS%; idle-DQ) appear in AD-9/AD-14/Stage-2 and the `award.floor_*` / `stat_row.idle_dq` ERD.
  AFK/idle ≥50% threshold is correctly deferred as tunable config while the *DQ mechanism* is pinned.
- **Reduced-motion outcome determinism (the outcome half).** Honored via AD-14/AD-15 (the seeded,
  snapshot-frozen, client-reproducible draw). Only the *order-as-published-artifact + a11y same-path*
  half is under-specified — see F2.
- **Provably-fair seed = final demo hash, distinct from bracket seed, no re-roll.** Honored (AD-13).
- **Evidence-resolved disputes (the mechanism).** Honored (AD-1 + re-parse/rollback + re-hashable
  demo + reproducible seed). Only the *prohibition* of an in-app dispute button is unstated — see F3.

---

## Summary table

| # | Severity | Item | Disposition |
|---|---|---|---|
| F1 | HIGH | Blurred-until-spin award secrecy from viewers | Omitted as an invariant; left as client-side CSS blur. Add reveal-gating RLS invariant + resolve bundle-publication-timing vs. AD-14/AD-15. |
| F2 | MEDIUM | Reduced-motion: identical seeded *reveal order* (not just outcome) | Under-specified. Pin spin order as a seeded/published artifact + one-code-path a11y rule. |
| F3 | MEDIUM | Evidence-only disputes — no in-app raise-dispute button (OQ-6) | Prohibition never recorded. Add as a locked non-feature. |
| F4 | MEDIUM | Spanish-UI invariant | Demoted to a convention-table aside. Promote to an invariant. |
| F5 | MEDIUM | Exact load-bearing strings | Asserted-exact but not enumerated/anchored; only 1 of 5 present. Enumerate + pin enum→label mapping. |

All five are omissions/under-specifications, not contradictions. Recommended gate disposition:
**CONCERNS — address F1 before handoff (data-access invariant); F2–F5 are one added invariant + one
promoted invariant + one enumeration, all low-effort and non-structural.**
