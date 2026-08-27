# Sprint Planning prompt: Cuatro Ecosystem

Drafted 2026-08-15, after `bmad-deep-recon` → `bmad-prd` → `bmad-ux` →
`bmad-architecture` → `bmad-create-epics-and-stories`. Paste the block below into a
**fresh** Claude Code session opened at `c:\Development\cuatro-portfolio`.

This is the last required planning gate. After it: `bmad-project-context`, then
`bmad-loop run` on Epic 1.

---

/bmad-sprint-planning

## What this run is gating

`_bmad-output/planning-artifacts/epics.md`: 94 stories across 7 epics, 2,669 lines.
It is the output of a five-stage planning chain and it has **not been reviewed by any
lens**, unlike every other artifact it derives from. Treat the readiness gate as the
first adversarial read this document has had.

Supporting inputs, in the order the epics themselves cite them:

- `architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`
  AD-1…AD-23. Every story names its governing AD.
- `prds/prd-cuatro-portfolio-2026-08-15/prd.md` + `addendum.md`: FR-1…FR-35, NFRs
- `ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` + `EXPERIENCE.md`
- `research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md`

## The gate matters more than usual here: say PASS, CONCERNS or FAIL plainly

These stories will be executed by **`bmad-loop`, largely unattended**. That changes the
cost of a weak story: it burns an automated session, may produce wrong code against a
green test, and escalates for a human anyway. A story that a person would muddle
through is a story the loop will stall on.

So weight the gate toward: **can an automated dev session finish this without asking a
human a question?** Anything that needs a judgement call mid-flight should come back as
a split or a CONCERN, not a pass.

Specific things I want checked rather than assumed:

1. **Story sizing for one focused session.** Epics 1–3 are fully specified; 4–7 carry
   titles and goals only, deliberately (AD-22 forces a refresh check before Epic 4's
   first story opens). Gate Epics 1–3 hard. Do not fail Epics 4–7 for missing AC,
   that absence is an argued decision, not an oversight.

2. **The dependency graph is real.** Three AD-17 gates and the AD-9 Capacity Gate are
   modelled as blocking predecessors. **AD-9 defaults to blocked.** Verify no story
   that places a workload on the box can open before the measurement week completes
   with a written threshold in `ops/capacity-gate.yml`. Verify Epic 2 is genuinely
   blocked by AD-17a (monitoring) and AD-17b (bot mitigation).

3. **AD-20's fixed order in Epic 3**: Hub to `apps/hub` alone as its own shipped step,
   then `cuatro-finance`, then `cuatro-tracker`, then `cs-tournament`. One shipped and
   verified step each. Confirm the stories encode that order as dependencies.

4. **Operator-action stories.** Several Epic 1 stories are actions in a web console or
   on the box: archiving repositories, buying a monitor, adding Cloudflare rules,
   reading `docker stats`. They commit a record under `ops/` so acceptance is written
   against an artifact rather than "you did a thing in a dashboard." Confirm that
   pattern holds everywhere it needs to, and that an automated session can actually
   verify each one. **Flag any story where the loop would have to take the Operator's
   word for it.**

5. **Acceptance criteria that assert rather than claim.** AD-19 requires the
   accessibility floor be *asserted, not claimed*. The UX validation report's finding
   was that every one of its six criticals was "a place where the document asserted a
   property it did not actually implement": the contrast matrix was right because it
   was computed, the 44px floor was wrong because it was asserted. **Any AC that
   states a property without a check is the failure mode to catch here.**

6. **The four blocking open items** carried into stories: O-3 (daisyUI `var()`
   support, gates Epic 1's `cs-tracker` adoption), C-2 (`digital-library` SQLite +
   Redis has no backup path: live data, no coverage), C-9 (routing enumeration,
   prerequisite of Epic 4, done in Epic 1), C-8 (the box compiles today; standing AD-8
   violation tracked until Epic 3). Confirm each is a real story with real acceptance,
   not a note.

## Then produce the tracking

`sprint-status.yaml` at `_bmad-output/implementation-artifacts/`, which
`bmad-loop` reads. This file is currently **absent** and is the main reason
`bmad-loop validate` fails today.

**Epic 1 is what runs first and is unblocked now**: sequence it so the loop can start
there immediately. Its standalone value is real and does not depend on any later epic:
external uptime monitoring (SM-5), two applications on shared tokens across the
JS/Elixir boundary (SM-6), Estate down to 12 repositories (SM-7), and a written
capacity threshold.

## Constraints the plan must respect

- **Solo maintainer.** One person, one session at a time. Parallel-work assumptions are
  wrong here.
- **One environment, no staging** (AD-21). Every CI gate is blocking; none may be
  downgraded to a warning.
- **Four subdomains live throughout:** `cuatro.dev`, `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev`, `library.cuatro.dev`. Every step leaves a working system
  (NFR-2, AD-20).
- **Capacity unproven**: 2 vCPU / 8 GB. SM-C4 (VPS load average) wins every conflict
  with any other metric.

## What I want out of it

1. A clear **PASS / CONCERNS / FAIL** with the reasoning, not a hedge.
2. `sprint-status.yaml` generated and valid, with Epic 1 ready to open.
3. If the verdict is CONCERNS or FAIL: **name the specific stories**, so I can point
   `bmad-review` at those rather than at all 94.
4. Anything you think is a genuine gap in the planning chain: this is the last gate
   before code gets written by an automated loop, and I would rather hear it now.
