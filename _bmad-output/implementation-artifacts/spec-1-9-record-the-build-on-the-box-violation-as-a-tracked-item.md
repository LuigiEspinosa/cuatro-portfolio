---
title: 'Record the build-on-the-box violation as a tracked item'
type: 'chore'
created: '2026-08-18'
status: 'in-progress'
baseline_commit: '6caac0bc686355fded2181ad9c26a58ec867747e'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.github/workflows/deploy.yml'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The estate's top unmeasured risk, a serving two-core box that compiles, is real today and written down nowhere an Operator would look for a violation. `.github/workflows/deploy.yml:56` runs `docker compose --env-file .env.production up --build -d --remove-orphans` over SSH, AD-8 calls that a standing violation until Epic 3, and the only traces are a pitfall line inside the machine-managed `bmad:context` block, one table row in `ops/routing-inventory.md`, and prose in planning documents nobody deploys from. There is no violations register under `ops/`, so a tolerated breach is indistinguishable from an unnoticed one.

**Approach:** Create `ops/known-violations.md`, a register in the shape `ops/estate.md` and `ops/monitoring.md` already set, carrying one entry: the AD-8 breach, its citation, why it is tolerated rather than fixed now, its live interaction with the capacity measurement week running until 2026-08-24T21:00Z, and the two "Hetzner" naming claims with the story that owns each. The violation is recorded, never fixed.

## Boundaries & Constraints

**Always:**
- Every value is marked as a decision or an observation, and the two are never presented as the same kind of fact (NFR-9).
- The record states what is true on 2026-08-18, not what `epics.md` described on 2026-08-16. Story 1-21 repointed `SERVER_HOST` and renamed the deploy step on 2026-08-17, so a record repeating the story's original framing would be wrong on the day it lands.
- Citations are verified against the working tree at `6caac0b` and carry file and line, rather than being quoted from a planning document.
- Dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, no body and no trailer.

**Ask First:**
- Before recording any violation other than AD-8. `deferred-work.md` holds several `deploy.yml` hazards (no `concurrency` group, CI not blocking the deploy, `placements` self-serve). Which of those are violations rather than deferred work is the Operator's call, not this story's.
- Before asking for a merge freeze on `main`. This story records that a deploy distorts the measurement week and names the options; choosing one is an Operator decision.

**Never:**
- Never edit `.github/workflows/deploy.yml`. Recording a violation is not fixing it, and AD-8 puts the fix in Epic 3 behind GHCR images that do not exist yet.
- Never edit `content/projects.ts`. The stale `Hetzner VPS` value is FR-9's, corrected in Epic 2.
- Never edit the `bmad:context` block in `AGENTS.md` by hand. Its pitfall line already names this story and is replaced by a `/bmad-project-context` refresh.
- Never touch the box, the running sampler, `ops/capacity-gate.yml`, or `ops/capacity-measurement.md`.
- Never state that the step name "Deploy to Hetzner" or the deploy-into-the-decommissioned-box hazard is still live. Both were closed on 2026-08-17.

</frozen-after-approval>

## Code Map

Gathered 2026-08-18 against `6caac0b`, working tree clean apart from the sprint board.

- `.github/workflows/deploy.yml:56` -- the offending line, `docker compose --env-file .env.production up --build -d --remove-orphans`, inside the `appleboy/ssh-action` step. **The step at `:45` is now named "Deploy over SSH to SERVER_HOST"**, not "Deploy to Hetzner": Story 1-21 renamed it. `:4-5` is the `push: [main]` trigger, which is what makes any merge a deploy.
- `ARCHITECTURE-SPINE.md:124-128` -- AD-8, including the closing sentence naming `deploy.yml` a standing violation until Epic 3. `:435` is C-8, the same fact as a contradiction between every document and the running system.
- `epics.md:1435-1475` -- Story 1.9's four ACs. `:3927-3929` is Story 3.4, which retires the violation. `:109-114` is FR-9, narrowed to exactly one stale value. `:725` tracks C-8.
- `content/projects.ts:30` -- `'Hetzner VPS'` in `digital-library`'s `tech` array. The surviving half of the naming question, Epic 2's to correct.
- `ops/routing-inventory.md:153-179` -- "Where the deploy actually goes": `SERVER_HOST` repointed to `177.7.52.248` on 2026-08-17, and a deploy-mechanism row that already says "tracked in Story 1-9". The prose below it owns the separate stale-`main` hazard, which the register cites rather than restates.
- `ops/capacity-measurement.md:331-336` -- already states a merge compiles Next.js on the two cores being measured and that close-out must say whether a build fell inside the week. `:239` bounds the window: close-out on or after 2026-08-24T21:00Z. Week confirmed live 2026-08-18T02:24Z, timer `active`, `Result=success`, 5138 rows.
- `AGENTS.md:78-81` -- the existing pitfall line, inside the `bmad:context` markers at `:1` and `:114`. Read-only here.
- `ops/monitoring.md`, `ops/estate.md`, `ops/bot-mitigation.md` -- the conventions to follow: a provenance line naming story and date, tables with a `Nature` column, dated amendment paragraphs.

## Tasks & Acceptance

**Execution:**
- [ ] `ops/known-violations.md` -- create the register. A short preamble stating what belongs here and what belongs in `deferred-work.md` instead, then one entry, `KV-1: the serving box compiles`, covering: the rule breached and its citation; the offending file and line; the risk in the words research used; why it is tolerated rather than fixed now (fixing it early builds the CI-to-GHCR path twice, once against today's single-app layout and once after the Epic 3 merge); what retires it and when; the measurement-week interaction with its mitigation options and its end date; and the naming question, both halves, each against its owning story.
- [ ] `ops/routing-inventory.md` -- add one pointer sentence below the "Where the deploy actually goes" table, naming `ops/known-violations.md` as where the AD-8 breach is now tracked. A register nobody can reach from the file they are already reading is not a tracked item.

**Acceptance Criteria:**
- Given AD-8 names the current deploy a standing violation, when `ops/known-violations.md` is read, then it names the violation, cites `.github/workflows/deploy.yml` and the exact line that carries `--build`, names AD-8 as the rule breached and Epic 3's Story 3.4 as what retires it, and records why it is tolerated now rather than fixed.
- Given the capacity measurement week runs until 2026-08-24T21:00Z on the same two cores a deploy would compile on, when the record is read, then it states that a deploy during the week distorts the readings, names the mitigation as either avoiding a merge to `main` before that date or annotating the affected readings, and cites the close-out obligation in `ops/capacity-measurement.md` rather than restating it.
- Given Story 1-21 repointed `SERVER_HOST` and renamed the deploy step on 2026-08-17, when the record describes the naming question, then it states that resolved outcome with its date, records that the hazard of deploying into the decommissioned box is closed, and names `content/projects.ts:30` as the one surviving stale Hetzner claim against FR-9 in Epic 2.
- Given recording a violation is not fixing it, when the story closes, then `.github/workflows/deploy.yml`, `content/projects.ts` and `AGENTS.md` are byte-identical to `6caac0b`.

## Design Notes

**Why a register rather than a line in an existing record.** The breach is stated in four places and tracked in none: a pitfall line a `/bmad-project-context` refresh rewrites, a table cell about deploy targets, an architecture document, and an epics file. None is where an Operator looks to ask what is knowingly broken right now. Epic 2 and Epic 3 each inherit part of this file, so it needs a stable name and a shape a second entry can join without restructuring.

**Why the story's own ACs are partly historical.** `epics.md:1460-1472` was written on 2026-08-16, when the step read "Deploy to Hetzner" and `SERVER_HOST` pointed at the box being decommissioned. Story 1-21 closed both on 2026-08-17. The honest record of the naming question is that resolution plus the one claim that survives, not a re-narration of a hazard that no longer exists. The live hazard has moved: the deploy now reaches the box the measurement week is running on, a sharper version of the same risk, and that is what the entry leads with.

## Verification

**Commands:**
- `git diff --stat 6caac0b -- .github/workflows/deploy.yml content/projects.ts AGENTS.md`. Expected: empty output.
- `corepack pnpm test --run`. Expected: the suite at `6caac0b`, unchanged and passing. No code is touched.
- `corepack pnpm typecheck`. Expected: pass.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, run against a positive control carrying all three forbidden forms so it cannot pass vacuously (the trap recorded in `spec-1-5`, finding 5).

**Manual checks:**
- Re-read `.github/workflows/deploy.yml` at the moment of writing and confirm the cited line number still lands on the `docker compose` line, since a citation that drifts is worse than none.
- Confirm every date in the record is ISO 8601 UTC and that each entry line is marked observation or decision.
