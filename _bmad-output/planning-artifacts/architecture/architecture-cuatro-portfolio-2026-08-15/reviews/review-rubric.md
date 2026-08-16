# Rubric walker — good-spine checklist

Run 2026-08-15 against `ARCHITECTURE-SPINE.md`. Deterministic lint: 0 findings.

## Verdict

Sound in structure and coverage; one **critical** defect where an AD asserts a property that
contradicts the UX spine it inherits, plus three gaps where a whole cross-cutting requirement
has no home.

## Checklist

| Criterion | Verdict |
| --- | --- |
| Fixes the real divergence points for epics | strong |
| Every AD's Rule enforceable, and prevents its stated divergence | **one critical, two weak** |
| Nothing under Deferred lets two units diverge | pass |
| Named tech verified-current | pass, with one stale runtime (see R-6) |
| Ratifies rather than contradicts the brownfield codebase | strong — names the live violations explicitly (C-8, C-9) |
| Covers the driving spec's capabilities | **two NFRs unhoused** |
| Every dimension the altitude owns is decided/deferred/open | pass — operational envelope covered |

## Findings

### R-1 — CRITICAL. AD-19's greyscale assertion contradicts the UX Status mark spec

AD-19 requires CI to assert that "the four `status` values differ in `border-style`."
`EXPERIENCE.md` § Status mark is explicit that `Live` and `Complete` are **both `1px solid`**
and differ only by a 4px dot — "any implementation that drops the dot breaks FR-7 while
appearing to satisfy it."

So the assertion as written **fails a correct implementation and passes a broken one**. It is
the identical failure mode the UX validation report named: asserting a property adjacent to
the real one. The spine reproduced the very defect it cites.

*Fix:* bind the assertion to the UX spec's three structural axes (dot presence, solid vs
dashed, border presence) rather than restating one axis.

### R-2 — HIGH. NFR-8 (first-party data only) has no home

Nothing in the spine prevents a Satellite adding a third-party analytics script. Two Satellites
could legitimately choose differently and one would breach a cross-cutting NFR silently. The
topology diagram shows Umami but no rule binds it.

*Fix:* a Consistency Conventions row.

### R-3 — MEDIUM. NFR-4 (cost ceiling) has no invariant

$40–100/mo all-in is a hard constraint. AD-9 names the overflow price but nothing binds
marginal spend generally, and identity + monitoring + overflow are all recurring.

*Fix:* a Consistency Conventions row making new recurring spend a gated decision.

### R-4 — MEDIUM. Internal contradiction on image tags

Consistency Conventions says "Never `latest` on the box." The Stack table pins Umami at
`postgresql-latest`, which is the running configuration today.

*Fix:* scope the rule to estate applications and state the Umami exception, or pin Umami.

### R-5 — MEDIUM. AD-4's build-time fetch has an unstated consequence

Fetching the Registry at build time means a Registry change reaches a Satellite **only on that
Satellite's next rebuild**. That is the right trade (it protects Anchor CPU and NFR-2), but it
is unstated, and FR-13's "adding an entry causes it to appear in every switcher" reads as
instant propagation.

*Fix:* state the staleness explicitly and accept it.

### R-6 — MEDIUM. Node 22 is in maintenance, not Active LTS

CI and the Dockerfile run Node 22. Node 22's active support ended 2025-10-21; it is in
maintenance to 2027-04-30. Node 24 is Active LTS today (to 2026-10-20), and Node 26 becomes
LTS on 2026-10-28 — inside AD-22's staleness window.

*Fix:* pin Node 24 and let AD-22 carry the 26 decision.

### R-7 — LOW. AD-3's derivation is stated but unchecked

Nothing verifies that the image, compose service, router and database actually match the
Registry id. Accepted: the divergence is visible the moment a deploy fails, and a checker
costs more than it saves at eight applications.
