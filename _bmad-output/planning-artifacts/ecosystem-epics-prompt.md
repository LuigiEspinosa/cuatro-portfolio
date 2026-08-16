# Epics & Stories prompt — Cuatro Ecosystem

Drafted 2026-08-15, after `bmad-deep-recon` → `bmad-prd` → `bmad-ux` →
`bmad-architecture`. Paste the block below into a **fresh** Claude Code session opened
at `c:\Development\cuatro-portfolio`.

Next after this: `bmad-sprint-planning`, which produces the `sprint-status.yaml` that
`bmad-loop` has been waiting on since setup.

---

/bmad-create-epics-and-stories

## The four inputs

All under `_bmad-output/planning-artifacts/`:

| Doc | Path | What it fixes |
|---|---|---|
| **Architecture** | `architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md` | **Read first.** AD-1…AD-23, the Capability → Architecture Map, and § Contradictions and Forced Changes |
| **PRD** | `prds/prd-cuatro-portfolio-2026-08-15/prd.md` + `addendum.md` | FR-1…FR-35, NFRs, estate (§5), MVP scope (§9), sequencing (§10), metrics (§11) |
| **UX** | `ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` + `EXPERIENCE.md` | Token contract with real values, SCSS migration path, seams inventory, accessibility floor, § Open Items |
| **Research** | `research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md` | Steps 0–8 and the evidence behind every settled call |

The **Capability → Architecture Map** in the spine already assigns every capability to
an epic and to the ADs that govern it. Use it as the skeleton; your job is to turn it
into stories with acceptance criteria, not to re-cut the epics.

## The seven epics, already fixed

| Epic | Content | State |
|---|---|---|
| **1** | Research Steps 0–2 — archive three shells, uptime + cert monitoring, bot mitigation, capacity week, token contract published, Anchor + `cs-tracker` adoption | **Unblocked today. I intend to start immediately.** |
| **2** | Product layer — Registry as product, Suite Directory, front-door reshape, link verification, Hub analytics, `list-wheel` relocation |  |
| **3** | Anchor merge (Hub move, then three merges in fixed order) + build in CI → GHCR |  |
| **4** | Greenfield VPS rebuild — Traefik, one Postgres, `docker-rollout` |  |
| **5** | Identity (Clerk/OIDC) + Demo Access |  |
| **6** | Token distribution machinery — **deferred, earned by three real hand-copied changes** |  |
| **7** | WSL2 relocation — developer machine only, no ecosystem invariant |  |

**Epic 1 must be fully specified with concrete, executable stories.** Later epics may
stay coarser — but see the prerequisites below, several of which are cheap discovery
work that belongs in Epic 1 even though it serves Epic 4.

## Forced changes you must apply — do not cut stories against the original FRs

The architecture explicitly forces four PRD changes (spine § Contradictions). Stories
must reflect the **corrected** requirements:

- **C-3 → FR-5.** The Registry's unit is the **application**, not the repository
  (AD-6). Archived and absorbed applications keep entries, so the Registry count and
  the eight-repository Estate count are deliberately different. FR-5's third
  consequence bullet is reworded.
- **C-4 → FR-6.** `demo` is **required with an explicit value including `none`**, not
  optional. Same for `identity`.
- **C-5 → FR-6.** Two new required fields: **`identity`** (AD-12) and
  **`token_contract`** (AD-16). The latter is what makes the scheduled drift check
  possible.
- **C-6 → addendum §C.1.** `content/projects.ts` is **retired, not promoted**.
  `contracts/registry.json` is hand-authored JSON validated by
  `contracts/registry.schema.json` in CI. A TypeScript module cannot satisfy FR-12 for
  an Elixir or Go consumer.

Also correct in the epic breakdown:

- **C-7.** Playwright is **not** installed — `@playwright/test` appears only as a
  transitive entry in `pnpm-lock.yaml`, not in `package.json`. AD-19's accessibility
  floor therefore *adds* Playwright. That is real setup cost in Epic 2, not free.

## A correction I need to flag

**C-1 — I passed you an over-broad claim in the architecture prompt.** I wrote that
`digital-library` "runs on SQLite, not Postgres — the Registry entry is wrong,"
sourced from the UX validation report. The architecture checked it: committed
`content/projects.ts` **already lists `SQLite` correctly**. The only stale value is
`Hetzner VPS`. Scope any Registry-correction story to that, and do not carry the
broader claim forward.

**C-2 is the real finding underneath it, and it is worse.** `digital-library` is
SQLite + Redis, so the `pg_dump` + restic design covers **none** of its data. A live
application currently has no backup path in any input document. AD-10 requires the
exemption to carry its own offsite path — that needs a story, and it is not
Epic 4 work, because the data is live now.

## Prerequisites that are stories, not assumptions

- **C-9 — the deployed routing table exists nowhere in source.** `docker/Caddyfile`
  routes only `cuatro.dev` and `analytics.cuatro.dev`, yet `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev` and `library.cuatro.dev` all resolve. How they reach the box is
  currently unknown. Epic 4 must preserve four subdomains it cannot enumerate from
  source, so **enumerating them on the box is a prerequisite of Epic 4, not a task
  inside it.** Put that discovery in Epic 1 — it is cheap and it de-risks the rebuild.
- **C-8 — the box compiles today.** `.github/workflows/deploy.yml` runs
  `docker compose up --build -d` over SSH, and its step is still named "Deploy to
  Hetzner". Research calls building on a serving two-core box the top unmeasured risk.
  AD-8 marks this a **standing violation until Epic 3** — make that explicit as a
  tracked item so it is not silently tolerated.
- **AD-17 — three prerequisite gates, each a blocking predecessor.** Model these as
  real dependencies between stories, not as prose. AD-9's Capacity Gate **defaults to
  blocked**, so any story that places a new workload on the box depends on the
  measurement week completing with a written threshold.

## Open items to convert into stories or explicit deferrals

From the UX run (`EXPERIENCE.md` § Open Items). **O-7 is already closed** —
`cs-tracker` is on `{:phoenix, "~> 1.8.7"}` with Tailwind v4 + daisyUI, so it takes the
adapter route (AD-15). The rest are live:

| Item | What it blocks |
|---|---|
| **O-3** | daisyUI `@plugin` `var()` support — a ten-minute scratch `mix phx.new` test, fallback is plain `[data-theme]` CSS. **Blocks Epic 1 Step 2, seam S-9.** AD-15 says the Phoenix route carries both paths — the story is to determine which one is live |
| O-1 | Six Registry descriptions are drafts from inferred behaviour — confirm each against the software. Epic 2 |
| O-2 | Narrative bundle weight is **estimated, not measured**. Epic 2, SM-C5 |
| O-4 | `cuatro-finance` and `cs-tournament` real Status — assumed. Changes the composition of the first six rendered entries. Epic 2 |
| O-5 | `list-wheel`'s hostname (`wheel.cuatro.dev` is a placeholder). Epic 2 |
| O-6 | `--confillia-normal` retargeting reads acceptably. Migration step 5 |
| O-8 | 44×44px hit-target floor **measured in a browser**, not read off CSS. Epic 2 |
| O-9 | Greyscale render check of the Status taxonomy. Epic 2 |

Also fold in the four small repository defects the UX run found — `aria-hidden` on the
only `<h1>` at `WorkHero.tsx:39`, `boder:` at `WorkItem.scss:84`, `Dev. 2025` →
`Dec.` at `work.ts:18`, and `Celeste.tsx` mutating the DOM to hide the header. Small,
but they should not evaporate.

## How I want the stories cut

- **Sized for `bmad-build`** — each story implementable and reviewable in one focused
  session. These will be driven by `bmad-loop`, so a story that needs a human decision
  mid-flight is a story that will escalate. Split those.
- **Acceptance criteria that name the governing AD** — the spine's ADs are the
  invariants; a story that satisfies its AC but violates an AD is a defect the loop
  should catch.
- **Verification-first where the architecture demands assertion over claim.** AD-19
  says the accessibility floor is *asserted, not claimed*. The UX validation report's
  lesson was that every critical finding was "a place where the document asserted a
  property it did not actually implement." Stories that claim conformance without a
  check are the failure mode to design out.
- **Dependencies explicit**, especially across the three AD-17 gates and the Capacity
  Gate.
- **Every step leaves a working system** (NFR-2, AD-20). Four subdomains are live and
  must stay live. AD-20 also fixes the Epic 3 merge order — Hub first, then the three.

## Constraints

- Solo maintainer, indefinitely. 2 vCPU / 8 GB VPS, capacity **unproven**; SM-C4 wins
  every conflict with any other metric.
- One environment. No staging, and none is introduced (AD-21) — so every CI gate is
  blocking and none may be downgraded to a warning.
- Live today and must stay live: `cuatro.dev`, `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev`, `library.cuatro.dev`.

## Non-goals

- Per-App Layer feature work in any application (PRD §8)
- Building the token distribution machinery (Epic 6 is deferred; shape is fixed)
- Building the four `In progress` applications — archiving them is a legitimate outcome
- Anything in the spine's § Deferred list

## What I want out of it

An epics-and-stories breakdown that `bmad-sprint-planning` can gate and turn into
`sprint-status.yaml`, with Epic 1 detailed enough that I can start it the moment this
run finishes.

Flag any story you cannot write because an input is genuinely ambiguous — I would
rather have an explicit gap than an invented acceptance criterion.
