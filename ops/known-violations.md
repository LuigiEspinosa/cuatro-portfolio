# Known violations

The written record of what the Ecosystem is knowingly running in breach of its own settled
decisions: which rule is broken, where the breach lives in source, why it is tolerated rather
than repaired now, and what closes it. A tolerated breach and an unnoticed one look identical
from outside. This file is what makes them different.

Written during Story 1-9 on **2026-08-18** (ISO 8601 UTC).

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md` and
`ops/bot-mitigation.md` set: every value is marked as either a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9).

## What belongs here, and what does not

An entry here meets all three tests:

1. A named architecture decision, functional requirement or non-functional requirement forbids
   what the system does today.
2. The system does it anyway, and the Operator has decided to let it, with a reason.
3. A named story retires it.

Everything else is deferred work and belongs in
`_bmad-output/implementation-artifacts/deferred-work.md`: findings surfaced incidentally, real
but not yet weighed, with no ruling that they are tolerated. The distinction is the ruling, not
the severity. `deferred-work.md` currently holds several `deploy.yml` hazards of its own (no
`concurrency` group on the workflow, CI not blocking the deploy, the `placements` log being
self-serve). **None of them is recorded here.** Whether any of those is a violation rather than
deferred work is the Operator's call and no story has taken it, so promoting one into this file
without that call would be inventing a decision rather than recording one.

Entries are numbered `KV-n` and never renumbered. A retired entry stays, with its closing story
and date, so the register reads as a history rather than a to-do list.

| Id | Violation | Rule breached | Status | Retired by |
|---|---|---|---|---|
| KV-1 | The serving box compiles | AD-8 | **Open**, tolerated deliberately | Story 3.4 (Epic 3) |

---

## KV-1: The serving box compiles

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-8**, "Build in CI, push to GHCR; the box never compiles" | **Decision.** `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md:124-128`. AD-8 names the current `deploy.yml` a standing violation of itself until Epic 3 |
| Offending line | `docker compose --env-file .env.production up --build -d --remove-orphans` | **Observed 2026-08-18 at `6caac0b`.** `.github/workflows/deploy.yml:56`, inside the `appleboy/ssh-action` step that begins at `:45`. `--build` is the whole of the breach |
| What makes it fire | `push: [main]` | **Observed.** `.github/workflows/deploy.yml:4-5`. Every merge to `main` is a deploy, and every deploy is a compile |
| Where it compiles | The box at `177.7.52.248`, 2 vCPU | **Observed 2026-08-17.** `ops/routing-inventory.md:24-29`. Since Story 1-21 repointed `SERVER_HOST` on 2026-08-17 this is the machine serving all six live hostnames |
| The risk, as research stated it | Compiling on a serving two-core box is **the estate's top unmeasured risk** | **Decision, carried from research into AD-8's `Prevents` line** and restated as forced change C-8 at `ARCHITECTURE-SPINE.md:435`. It is unmeasured, not unmeasurable: the measurement week below is what would measure it |
| Also tracked as | Forced change **C-8** | **Decision.** `epics.md:725` books C-8 as a tracked item in Epic 1, which is this file |
| Status | **Open and tolerated** | **Decision, 2026-08-18.** Recording a violation is not fixing it |
| Retired by | **Story 3.4**, deploy by pulling a tag with `docker-rollout` | **Decision.** `epics.md:3923-3930`, which names itself as closing C-8 and the item Story 1.9 opened. It depends on Story 3.3, which is what first puts an image in GHCR |

### Why it is tolerated rather than fixed now

Fixing it early means building the CI-to-GHCR path twice: once against today's single-app
layout, and again after the Epic 3 merge turns this repository into a Turborepo of four
applications. AD-8 does not describe one image built from the repository root. It requires a
build context of the **repository root narrowed by `turbo prune --docker`** with the Dockerfile
at `apps/<id>/Dockerfile`, one image per application id, and `docker-rollout` against services
carrying real healthchecks and no `container_name` or published `ports`. None of those inputs
exists yet. A CI-to-GHCR path written today would be written against a layout that Epic 3
deletes, and the second version would be the one that ships.

The cost of waiting is a compile on the serving box on each merge to `main`. The Operator's
standing policy is that `main` is merged only when an epic completes, so that cost is paid a
handful of times per epic rather than per commit. That is the trade, and it is taken knowingly.

### Its live interaction with the capacity measurement week

**The measurement week is running on exactly the two cores a deploy would compile on.**
Confirmed live **2026-08-18T02:24Z**: timer `active`, `Result=success`, 5138 rows.

| Field | Value | Nature |
|---|---|---|
| Window ends | **2026-08-24T21:00Z** | **Decision.** `ops/capacity-measurement.md:239`. Close-out runs on or after that instant, and until then Story 1-5 is awaiting the week rather than done |
| Effect of a deploy inside the window | A large CPU peak attributed to `cuatro-portfolio-anchor-app-1` | **Already recorded, not restated here.** `ops/capacity-measurement.md:331-336` states that a merge to `main` during the week compiles Next.js on the two cores being measured |
| Why it matters | A threshold derived from a build minute is a threshold about the build, not about serving | **Decision**, at the same citation. Story 1-6 reads that threshold |
| Close-out obligation | The close-out must say whether any such build fell inside the week | **Decision, owned by `ops/capacity-measurement.md`**, at `:331-336` and as Pending Operator action 4 at `:349`. This register cites it and does not duplicate it, so there is one place to change when the week closes |

**The two mitigations, neither of them chosen here.** Choosing one is an Operator decision, and
this story records the options rather than taking them:

1. **Avoid a merge to `main` before 2026-08-24T21:00Z.** This costs nothing under the standing
   merge policy, since Epic 1 is not close to complete. It is defeated by a direct push to
   `main` or by a hotfix merged ahead of the epic close, which is the same live risk
   `ops/routing-inventory.md:182-184` already names for a different reason.
2. **Annotate the affected readings.** Let a deploy happen and mark the minutes it covered, so
   the threshold is derived from the serving samples rather than from the build. This is the
   fallback when option 1 is broken by an incident rather than by choice.

**No merge freeze on `main` is requested by this story**, because a freeze is a policy the
Operator sets, not one a register imposes.

### The naming question, both halves

The story that opened this item was written on 2026-08-16, when the workflow step read "Deploy
to Hetzner" and `SERVER_HOST` still pointed at the box being decommissioned. **Story 1-21
closed that half on 2026-08-17.** The record below is what is true on 2026-08-18.

| Half | State on 2026-08-18 | Owner |
|---|---|---|
| The deploy step name | **Resolved 2026-08-17.** The step at `.github/workflows/deploy.yml:45` is named **"Deploy over SSH to SERVER_HOST"**. It names no provider, because the workflow cannot verify which provider the secret resolves to | Story 1-21, closed |
| `SERVER_HOST` | **Resolved 2026-08-17.** Repointed to `177.7.52.248`, the box the rest of the estate serves from. `ops/routing-inventory.md:158` carries the row and `:167-168` records the repoint as done | Story 1-21, closed |
| The `tech` array value | **Open.** `content/projects.ts:30` still lists `'Hetzner VPS'` in `digital-library`'s `tech` array. This is the **one surviving stale Hetzner claim** in the estate's source | **FR-9, in Epic 2.** `epics.md:109-114` narrows FR-9 to exactly this one value. Not this story's to correct, and not a file this story touches |

**The hazard of deploying into the decommissioned box is closed.** Until 2026-08-17 a merge to
`main` would have deployed into a box that was down, and done it with `--build` on a machine
being decommissioned. `SERVER_HOST` no longer resolves there, and nothing of the estate's points
at `95.216.143.251` any more (`ops/routing-inventory.md:199-206`). That hazard is not live and
must not be repeated as though it were.

**The live hazard is a sharper version of the same risk.** The deploy now reaches the box that
serves all six hostnames and that the measurement week is running on. The blast radius grew when
the target was corrected, which is the right trade and still a cost worth naming.
