# Reconciliation: research report against `prd.md` + `addendum.md`

Source: `_bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/`
(`research.md`, `brief.md`, `provisional-verdict.md`)

## Downstream bindings the research declared

The research names four consumers and what each should take. Three are this PRD's business.

| Research binding | Consumes | Status |
|---|---|---|
| **Product brief** | The estate decision and the tracker-family framing | **Carried**: §5, §5.1, §5.2, FR-11. The `15→11` figure is resolved as a waypoint (§5) |
| **Roadmap / epics** | Steps 0–8, Steps 0–2 as the first epic | **Carried**: §10, with Epic 1 = Steps 0–2 exactly as specified |
| **Risk register** | Capacity gate at Step 1; certificate-age alerting; the no-error-signal problem | **Carried**: §14 rows 1, 2, 5; FR-31, FR-33 |
| **Architecture spine** | Contracts-federate principle; VPS topology table; OIDC + per-app-session shape | **Partially carried, by design**: the principle is in §1 and `addendum.md` §D; OIDC session shape in FR-20; the topology table is technical and stays in `addendum.md` §C for architecture to consume directly |

## Standing rules from the research

| Rule | Where honoured |
|---|---|
| No Renovate automerge unless a project has a real test suite | NFR-10, FR-19 |
| The app registry ships only after the bot filter | NFR-7, FR-12 note, §10.1, §12.4: **promoted to hard prerequisite** |
| Alert on certificate *age*, not just expiry (64-day lifetimes Feb 2027, 45-day Feb 2028) | FR-31, SM-10, §14 |
| Do not adopt `wal-g` on current evidence | **Not carried.** Purely technical, no product surface. Architecture should read it from the research directly |

## Per-project calls

All fifteen dispositions carried verbatim into §5.1. The research's tracker verdict: "one product *family* with four implementations", not one product and not four products: is carried in §5.2 and the Glossary, adjusted to **three** surviving implementations because `tcg-tracker` folds. Wording differs from the research; substance does not.

## Where the PRD deliberately departs from the research

Each is argued in §12 rather than applied silently.

1. **§12.1: "no real users" is scoped to the Per-App Layer.** The research treats the absence of an error signal as absolute. The Hub has real Visitors and pre-existing self-hosted analytics. This is the largest departure and it is what makes §11 possible.
2. **§12.2: the Anchor is outside the Tailwind cluster.** The research's token contract assumes a Tailwind consumer; `cuatro-portfolio` is SCSS. No substantive conflict, but Step 2 lands somewhere the research did not picture.
3. **§12.4: bot mitigation promoted.** The research demoted it to "a cheap experiment worth running first" on evidence-quality grounds; the product framing re-promotes it on exposure grounds without disputing the evidence critique.
4. **§12.5: a product epic inserted between Steps 2 and 3.** A gap in the research's scope rather than a contradiction; the research was explicitly technical.
5. **§12.7: `list-wheel` on GitHub Pages** is outside the research's estate model entirely.

## Research findings the PRD does not use, and why

- **Traefik vs Caddy, Postgres shape, `docker-rollout`, restic, GHCR builds, the outgrow threshold**: deployment mechanism. Correctly absent from a capabilities PRD; summarised in `addendum.md` §C for architecture.
- **D4 dev environment / WSL2 relocation**: Operator ergonomics with no product surface. Named in §9.2 and §10 Step 8 only.
- **Railway pricing detail (~$77/mo full, $15–30/mo for two heavy apps)**: carried as the named overflow path in §7 and FR-33 without reproducing the arithmetic; full figures in `addendum.md` §C.4.
- **The research's own methodological self-criticism** (asymmetric two-source bar, 85% of sources unre-checked, rows [26][27][50][53][60] carrying no URL), not a product concern, but see gap G2 below.

## Gaps

**G1: the research's confidence qualifications did not travel.** *(medium)*
The research repeatedly flags where it is weakest: source layout rests on "this run's weakest evidence" with **zero published study** on solo-maintainer repo layout; the devcontainer call rests on an evidence *absence*; the capacity figure is medium-low confidence. The PRD treats all settled inputs as uniformly firm. That is defensible (they *are* settled, and §8 makes re-deciding them a non-goal) but architecture reading only this PRD would not know which foundations are soft.
*Suggested:* `addendum.md` §D already carries the solo-maintainer-evidence caveat. The capacity confidence is carried in §7 and §12.3. The devcontainer caveat is not carried anywhere; it is low-stakes.

**G2: the research's refresh date is not recorded in the PRD.** *(low)*
The report sets `refresh_after: 2026-11-15` and states a selection report older than two quarters should be refreshed before acting on it. Steps 5–8 of §10 will plausibly execute after that date against decisions this PRD treats as settled. Nothing in the PRD tells a future reader the inputs have a shelf life.
*Suggested:* one line in §0 or §13 naming the refresh date.

**G3: `Mutuo`'s existing demo accounts are noted but unused.** *(low)*
The research records that `Mutuo` already has demo accounts. §5.1 no longer mentions this and §4.6 treats Demo Access as uniformly new work. Minor, and `Mutuo` is `In progress` so it is not near-term, but it is a pre-existing asset the Demo Access feature could have credited.

**G4, two load-bearing research citations are unverified, and the PRD depends on one.** *(low)*
The research flags rows **[53]** (why nginx is cut) and **[60]** (why subdomains beat paths) as carrying no captured URL, and asks that both be re-located before either conclusion is treated as settled. The PRD assumes subdomain routing throughout (§5.3, NFR-2, the whole `cuatro.dev` addressing model). The assumption is also the incumbent, so the practical risk is nil, but the PRD inherits an explicitly flagged claim without noting it.
