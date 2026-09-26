# Known violations

The written record of what the Ecosystem is knowingly running in breach of its own settled
decisions: which rule is broken, where the breach lives in source, why it is tolerated rather
than repaired now, and what closes it. A tolerated breach and an unnoticed one look identical
from outside. This file is what makes them different.

Written during Story 1-9 on **2026-08-18** (ISO 8601 UTC).

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md` and
`ops/bot-mitigation.md` set: every value is marked as either a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). That marking binds the prose here
as well as the table cells: a claim in a paragraph carries its Nature, and where it was gathered
rather than decided, the method that gathered it.

**Story ids are written hyphenated**, as `Story 1-9` and `Story 3-4`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids
dotted, as `Story 1.9`. They are the same stories, and this file uses the hyphenated form
throughout so that one spelling finds every mention.

## What belongs here, and what does not

An entry here meets all three tests:

1. A named architecture decision, functional requirement or non-functional requirement forbids
   what the system does today.
2. The system does it anyway, and a recorded ruling says it may continue, with a reason. The
   ruling can be an Operator act or a sentence in the breached decision itself. The entry says
   which, and when, in its `Ruled by` and `Ruled on` cells, and never presents the date it was
   written down here as the date it was ruled.
3. Something retires it. Normally that is a named story. Where no story is planned, the entry is
   still admitted with **`Retired by: unassigned`**, because a tolerated breach nobody has
   scheduled a fix for is the most important kind to have written down, not a reason to keep it
   out. `unassigned` is then a standing question for the Operator, and the entry carries it as
   one rather than as a gap.

Everything else is deferred work and belongs in
`_bmad-output/implementation-artifacts/deferred-work.md`: findings surfaced incidentally, real
but not yet weighed, with no ruling that they are tolerated. The distinction is the ruling, not
the severity. `deferred-work.md` currently holds several `deploy.yml` hazards of its own (no
`concurrency` group on the workflow, CI not blocking the deploy, the `placements` log being
self-serve). **None of them is recorded here.** Whether any of those is a violation rather than
deferred work is the Operator's call and no story has taken it, so promoting one into this file
without that call would be inventing a decision rather than recording one. **Ruled 2026-09-24**,
Operator ruling 2026-09-24, Pending Operator action 2: none of the three is admitted here. The
`concurrency` hazard is fixed (DW-93); CI not blocking the deploy closes when the eight checks are
made required on `main` at the Epic 2 merge (done 2026-09-25, DW-172); the self-serve `placements` log is tolerated while one
Operator merges every change to `main`.

Entries are numbered `KV-n` and never renumbered. A retired entry stays, with its closing story
and date, so the register reads as a history rather than a to-do list.

**The status vocabulary is exactly two words.** `Open` means the breach is live and tolerated.
`Retired` means it no longer exists in the running system, and the entry then carries the ISO
8601 UTC date it was retired on and the story that retired it. There is no third value. A breach
that stops being tolerated without being fixed is still `Open`, with its reason cell rewritten.

**The index below is derived, not authoritative.** Every cell in it restates a field from the
entry's own table further down. When a status changes, edit the entry's `Status`, `Retired by`
and `Retired on` cells first, then bring this row into line. The entry is the single place to
edit, and this row is the copy.

| Id | Violation | Rule breached | Status | Opened | Retired by | Retired on |
|---|---|---|---|---|---|---|
| KV-1 | The serving box compiles | AD-8 | **Open**, tolerated deliberately | 2026-08-18 | Story 3-4 (Epic 3) for the Anchor's half; Story 4-3 (Epic 4) for the `list-wheel` half, since 2026-09-13 | _not retired_ |
| KV-2 | Four Registry `source` links resolve for nobody but the Operator | FR-10, SM-4 | **Retired** | 2026-09-02 | The Operator's rulings of 2026-09-24 | 2026-09-24 |
| KV-3 | Two applications serve on `cuatro.dev` from outside the Registry | AD-6 | **Retired** | 2026-09-02 | Operator ruling 2026-09-25, by Registry membership | 2026-09-26 |
| KV-4 | No control ships under the 44x44 hit-target floor | AD-19 (A-4), FR-3 | **Retired** | 2026-09-06 | Story 2-32 | 2026-09-23 |
| KV-5 | No element sits past either viewport edge at 360px | AD-19 (A-5), FR-3 | **Retired** | 2026-09-06 | Story 2-33 | 2026-09-23 |
| KV-6 | Zero z-index literals, zero depth tells, zero clipped rings, zero synthesised weights and zero routes with no level-1 heading ship on the Hub | UX-DR44, UX-DR45 (`epics.md:665-676`), A-1 and A-7 (`EXPERIENCE.md:760,766`), the hallmark floor `epics.md:3053-3061` | **Retired** | 2026-09-13 | Story 2-33 | 2026-09-23 |
| KV-7 | Two `Live` Registry members serve from Vercel, outside the Cloudflare proxy | AD-26, AD-17b | **Open**, accepted as standing | 2026-09-26 | nobody, by decision | _not to be retired_ |
| KV-8 | Two rendered applications are exempt from the restyle | AD-25, SM-6, SM-12 | **Open**, accepted as standing | 2026-09-26 | nobody, by decision | _not to be retired_ |

---

## KV-1: The serving box compiles

**Scope: two deploy workflows, the Anchor's own and `list-wheel`'s, and nothing else.** AD-8
binds every deployed application, and the three Satellites (`cs-tracker`, `cuatro-tracker`,
`digital-library`) deploy from their own repositories with their own workflows, which this
repository cannot read. This entry records the breach in `.github/workflows/deploy.yml` in
`cuatro-portfolio` and, **since 2026-09-13**, in `.github/workflows/deploy.yml` in
`LuigiEspinosa/list-wheel`, which Story 2-25 authored as a mirror of the Anchor's and which the
Operator ruled tolerated on the same terms that day. That the three Satellites also build on the
box is observed (`_bmad-output/implementation-artifacts/deferred-work.md`, the Story 1-7 entry
of 2026-08-24, "four projects out of four") and not ruled, so it is not admitted here: the
discriminator is the ruling, and no story has taken it for them.

**Why the second half is in this entry and not a KV-6.** It is the same rule, the same line, the
same box and the same closer shape: one compose `up --build` over SSH on a merge to `main`. A
second entry would have said everything this one says with a different id, and the two halves
retire separately in any case, each on its own row below.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-8**, "Build in CI, push to GHCR; the box never compiles" | **Decision.** `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md:124-128`. AD-8 names the current `deploy.yml` a standing violation of itself until Epic 3 |
| Offending line | `docker compose --env-file .env.production up --build -d --remove-orphans` | **Observed 2026-08-18 at `6caac0b`**, by reading the file. `.github/workflows/deploy.yml:56`, inside the `appleboy/ssh-action` step that begins at `:45`. `--build` is the whole of the breach. **Amended 2026-09-24:** the line moved, unchanged, into `ops/deploy-remote.sh:57`, which the SSH step, now at `deploy.yml:80`, runs on the box, and which is the deploy key's forced command once `ops/contract-serving.md` Pending Operator action 7 is done (DW-94, `b0aeaff`). Same `--build`, same breach. **Amended 2026-09-25:** at `ops/deploy-remote.sh:60` since DW-131's guard (`6e9a216`) |
| Offending line, the `list-wheel` half | `docker compose up --build -d --remove-orphans`, run in `/home/deploy/list-wheel` | **Observed 2026-09-13 at `4155be6`** (merged to that repository's `main` as `11f15cb`), by reading the file. `.github/workflows/deploy.yml:71` in `LuigiEspinosa/list-wheel`, inside the `appleboy/ssh-action` step that begins at `:60`; fired by `push: [main]` at `:3-5`; the Capacity Gate step at `:43-44` runs before it, blocking, with no `continue-on-error` and no `if:`, and reads the gate from this repository's `main` by sparse checkout (`:19-24`). Same `--build`, same breach. The workflow's own comment at `:56-59` names this entry and its closer. **The first run through it**, `https://github.com/LuigiEspinosa/list-wheel/actions/runs/34771823648` at 17:31Z, compiled on the box for 27 s (`npm ci` 18.6 s, `npm run build` 6.3 s), and `uptime` read `0.43, 0.23, 0.14` at 17:32:05Z against `0.09, 0.09, 0.09` before the run: the one-minute figure is the build's tail. That is a timed build on the serving box of the kind the row two below says no story had scheduled, taken incidentally by a placement rather than deliberately, outside any measurement window, and it is recorded in `ops/capacity-threshold.md` beside the charge Step 2 made for this application. **Amended 2026-09-24:** the line moved, unchanged, into that repository's `ops/deploy-remote.sh`, which its SSH step runs on the box and which is its key's forced command once `ops/contract-serving.md` Pending Operator action 9 is done, and the comment naming this entry moved with it (`list-wheel` commit `30e5e8b`, DW-90 and DW-94, pushed by the session that verifies that package). A `test` job the deploy needs now runs first, the gate still runs before the SSH step, and a push that changes only Markdown no longer fires it (DW-93). Same `--build`, same breach |
| What makes it fire | `push: [main]` | **Observed.** `.github/workflows/deploy.yml:4-5`. Every merge to `main` starts a deploy, and a deploy that reaches the box compiles. It does not always reach the box: the Capacity Gate at `:30-31` runs first, is blocking, and carries no `continue-on-error` and no skip condition, so a merge it refuses never gets as far as the SSH step. **Amended 2026-09-24** (DW-93, `b0aeaff`): a push to `main` that changes only Markdown no longer fires it (`paths-ignore`, `:9-10`), `workflow_dispatch` on `main` does (`:13`), one run at a time; the gate is at `:64-65` and still runs before the SSH step |
| Where it compiles | The box at `177.7.52.248`, 2 vCPU | **Observed 2026-08-17** by SSH during Story 1-21 and **re-confirmed 2026-08-24** by Story 1-7, recorded in `ops/routing-inventory.md` under the heading **"The box"** (`:129-148` as of 2026-08-24). Since Story 1-21 repointed `SERVER_HOST` that day, this is the machine serving all six live hostnames; **seven from 2026-09-13**, when Story 2-25 placed `list-wheel` there |
| The risk, as research stated it | Compiling on a serving two-core box is **the estate's top unmeasured risk** | **Decision, carried from research into AD-8's `Prevents` line** and restated as forced change C-8 at `ARCHITECTURE-SPINE.md:435`. **It stays unmeasured after the measurement week closes.** The week measures serving, and both mitigations below exist precisely to keep a build out of its readings. What would measure the build cost is a timed build run on the box deliberately, outside the window, and no story has scheduled one |
| Also tracked as | Forced change **C-8** | **Decision.** `epics.md:1449`, in Story 1-9's acceptance criteria, is what names `ops/known-violations.md` as where C-8 is tracked. `epics.md:725` books C-8 to Epic 1 as a tracked item but names no file |
| Status | **Open and tolerated** | **Decision.** Whose decision and when is the `Ruled by` and `Ruled on` pair below, not this cell. Recording a violation is not fixing it |
| Ruled by | **AD-8 itself**, not a separate Operator act | **Decision.** AD-8's closing sentence at `ARCHITECTURE-SPINE.md:128` says the current `deploy.yml` "is a standing violation of this rule until then", which is the architecture tolerating the breach in advance. No separate Operator ruling was sought or given, and this register does not invent one |
| Ruled on | **2026-08-15**, the date of the architecture carrying the ruling | **Decision.** The architecture folder is `architecture-cuatro-portfolio-2026-08-15`. The date the ruling was written down in this file is a different fact and is the `Opened` cell below |
| Ruled by, the `list-wheel` half | **The Operator**, on 2026-09-13, recorded in `_bmad-output/implementation-artifacts/spec-2-25-relocate-list-wheel-onto-a-cuatro-dev-subdomain.md` under Design Notes, "Why the build is on the box and not in CI", and in that spec's Spec Change Log | **Decision.** AD-8's own sentence tolerates the Anchor's `deploy.yml` and nothing else, so the second workflow needed a ruling of its own. Asked whether `list-wheel` should build in CI and push to GHCR, which would have met AD-8 for that one application, or mirror the Anchor's shape and widen this breach, the Operator chose the mirror: one small, rare compile (`list-wheel` changed three times in 2026) rather than a second deploy shape the estate would carry until Epic 4 rewrote it. The spec's Design Notes paragraph is the durable record of the ruling; no separate clarification artifact exists |
| Ruled on, the `list-wheel` half | **2026-09-13** | **Decision.** The date of that ruling, which is also the date the workflow was written, merged and first run, and the date this half was written down here. The four coincide and are still different facts |
| Opened | **2026-08-18** | **Decision.** The date this entry was written, by Story 1-9. The `list-wheel` half was added on 2026-09-13 by Story 2-25 and the entry keeps its original date |
| Retired by | **Story 3-4**, deploy by pulling a tag with `docker-rollout` | **Decision.** `epics.md:3923-3930`, which names itself as closing C-8 and the item Story 1-9 opened. It depends on Story 3-3, which is what first puts an image in GHCR. This closes the Anchor's half only |
| Retired by, the `list-wheel` half | **Story 4-3**, which moves `list-wheel` onto the rebuilt proxy | **Decision.** `epics.md:4213-4218`: it depends on Story 4-2 and on Story 2-25, and addendum §G names `list-wheel` the natural first candidate for the new topology because it verifies static serving with no runtime in the way. Story 3-4 cannot close this half: its GHCR path is built for this repository's applications, and `list-wheel` deploys from its own. The half retires when that repository's deploy no longer runs `--build` on the box, whichever story lands the image, and Story 4-3 is the one booked for it |
| Retired on | _not retired_ | Filled by Story 3-4 with an ISO 8601 UTC date. `epics.md:3962-3965` makes that an acceptance criterion of that story, and forbids deleting this entry instead. **Since 2026-09-13 the entry has two halves and retires when the later of them does**: Story 4-3 writes its own date beside Story 3-4's for the `list-wheel` half, and the `Status` cell moves to `Retired` only when both are filled |

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

**The `list-wheel` half, added 2026-09-13, is tolerated for a different reason.** The Turborepo
argument above does not apply to it: `list-wheel` is a separate repository and always will be.
What applied was the choice between opening a second deploy shape (CI build, GHCR image, a pull
on the box) for one static application, and mirroring the Anchor's shape so the estate carries
one deploy mechanism until Epic 4 rewrites it. The Operator chose the mirror. The compile it adds
is one `ng build` on a merge to that repository's `main`, which is rare, and its first run is
timed in the table above. It retires with Story 4-3, not with Story 3-4.

**Today the compile is the smaller half of what a merge to `main` would cost, and that is the
part a reader of this entry alone would miss.** `ops/routing-inventory.md`, under the heading
**"Where the deploy goes"** (`:1479-1530` as of 2026-08-24, and the heading lost the word
"actually" when Story 1-7 rewrote and reordered the file), records the rest: the box's checkout
carries `docker-compose.yml` and
`docker/Dockerfile` modified in place, the corrected versions are committed on `dev` and not on
`main`, and `deploy.yml:55` runs
`git reset --hard origin/main` before the compose line (**amended 2026-09-24**: the reset is now
`ops/deploy-remote.sh`'s, to the pushed sha rather than to `origin/main`, DW-93). A deploy from
`origin/main` as it stands would discard those working files, recreate the shared-network name collisions, and contend for
the ports `cs-tracker-caddy-1` holds. **The blast radius is the whole estate, not just the
Anchor.** That hazard belongs to `ops/routing-inventory.md` and is cited rather than restated
here, but it changes how the mitigation below must be read: **avoiding a merge to `main` is
load-bearing for that reason first and for the measurement week second.** It does not stop being
load-bearing when the window closes on 2026-08-24T21:00Z. It stops when Epic 1 closes and `dev`
reaches `main`, which is the same event that expires the section cited.

### Its live interaction with the capacity measurement week

**Expired 2026-08-24T21:00Z.** The window closed with no deploy inside it: `main` stayed at
`54d3a0d` until the Epic 1 merge of 2026-08-27, `gh run list --workflow deploy.yml` shows a failed
run on 2026-08-16 and the next on 2026-08-27 (re-read 2026-09-24), and `ops/capacity-measurement.md`
Pending Operator action 4 recorded "None did" at 2026-08-25T00:33:34Z. So mitigation 1 below held by
fact rather than by choice, and nothing in this section constrains a merge. Marked 2026-09-24 on the
Operator ruling of that day, for the Story 1-5 close-out that owned it (Pending Operator action 4).
The rest of KV-1 stays open.

**This section expires at 2026-08-24T21:00Z**, when the measurement window closes. After that
instant nothing in it constrains a merge, and the reason to keep avoiding one is the paragraph
above rather than anything here. Whoever closes Story 1-5 should mark this section expired
rather than leave it reading as a live constraint. The rest of KV-1 stays open until Story 3-4.

**The measurement week is running on exactly the two cores a deploy would compile on.**
**Observed 2026-08-18T02:24Z**, gathered by SSH to `deploy@177.7.52.248` during Story 1-9's
code-map pass, running the timer check `ops/capacity-measurement.md` sets out under "The
mid-week check": timer `active`, `Result=success`, 5138 rows.

| Field | Value | Nature |
|---|---|---|
| Window ends | **2026-08-24T21:00Z** | **Decision.** `ops/capacity-measurement.md:239`, under "Close-out procedure", which puts close-out on or after that instant. That file's Pending Operator action 2 reads `_running_`, while `_bmad-output/implementation-artifacts/sprint-status.yaml:71` records `1-5-capacity-measurement-week: done`. Both readings are reported here and neither is adjudicated: another story's status is not KV-1's to settle |
| What contaminates the readings | Any build **overlapping** any minute before the window ends | **Decision.** A build started at 2026-08-24T20:50Z and still running at 21:05Z contaminates the window as surely as one started on day two. The test is overlap, not start time, because the sampler writes a row a minute and it is the covered minutes that carry the cost |
| Effect of a deploy inside the window | A large CPU peak attributed to `cuatro-portfolio-anchor-app-1` | **Already recorded, not restated here.** `ops/capacity-measurement.md`, under "What this week will not claim", the bullet beginning "`deploy.yml` still builds on the serving box" (`:331-336` as of 2026-08-18) |
| Why it matters | A threshold derived from a build minute is a threshold about the build, not about serving | **Decision**, at the same citation. Story 1-6 reads that threshold |
| Close-out obligation | The close-out must say whether any such build fell inside the week | **Decision, owned by `ops/capacity-measurement.md`**: the same bullet, plus its Pending Operator actions row 4, "Note whether any deploy to `main` landed inside the week" (`:349` as of 2026-08-18). This register cites it and does not duplicate it, so there is one place to change when the week closes |

**Line numbers into `ops/capacity-measurement.md` will drift, and the headings will not.** That
file's own close-out procedure pastes a generated summary block into it, which moves everything
below the paste. Both citations above therefore name a heading or a row description first and
give the line number, dated, second. If a line number stops landing, follow the heading and
re-date the citation rather than dropping it.

**The two mitigations, neither of them chosen here.** Choosing one is an Operator decision, and
this story records the options rather than taking them:

1. **Avoid a merge to `main` before 2026-08-24T21:00Z.** This costs nothing under the standing
   merge policy, since Epic 1 is not close to complete. It is defeated by a direct push to
   `main` or by a hotfix merged ahead of the epic close, which is the same live risk
   `ops/routing-inventory.md` already names for a different reason, under the heading **"Where
   the deploy goes"** in the paragraph beginning "In the normal flow this cannot fire"
   (`:1517-1520` as of 2026-08-24). **This mitigation
   does not expire with the window**, for the estate-wide reason given above.
2. **Annotate the affected readings.** Let a deploy happen and mark the minutes it covered, so
   the threshold is derived from the serving samples rather than from the build. This is the
   fallback when option 1 is broken by an incident rather than by choice.

**No merge freeze on `main` is requested by this story**, because a freeze is a policy the
Operator sets, not one a register imposes.

### The naming question, both halves

The story that opened this item was written on 2026-08-16, when the workflow step read "Deploy
to Hetzner" and `SERVER_HOST` still pointed at the box being decommissioned. **Story 1-21
closed that half on 2026-08-17.** The record below was written against 2026-08-18 and each row now
carries its own date, because the third half moved later than the other two.

| Half | State, dated per row | Owner |
|---|---|---|
| The deploy step name | **Resolved 2026-08-17.** The step at `.github/workflows/deploy.yml:45` is named **"Deploy over SSH to SERVER_HOST"**. It names no provider, because the workflow cannot verify which provider the secret resolves to | Story 1-21, closed |
| `SERVER_HOST` | **Resolved 2026-08-17.** Repointed to `177.7.52.248`, the box the rest of the estate serves from. `ops/routing-inventory.md` carries it under the heading **"Where the deploy goes"**, in the two rows `SERVER_HOST before 2026-08-17` and `SERVER_HOST after` (`:1489-1490` as of 2026-08-24) | Story 1-21, closed |
| The `tech` array value | **Open on 2026-08-18. Committed fixed on `dev` 2026-09-04, and it lands when Epic 2 merges to `main`.** Story 2.7 deleted `content/projects.ts` whole and repointed the Hub at `contracts/registry.json`, so the file carrying `'Hetzner VPS'` no longer exists. The stale value was never copied across: the Registry's `digital-library` entry lists `SvelteKit`, `Fastify`, `SQLite`, `Redis`, `BullMQ` and `Docker`, and no entry in it names Hetzner. This was the last stale Hetzner claim in the estate's source | Story 2.7. It was retired rather than corrected, which is what `ops/registry-inputs.md:152-156` says should happen to it. Serving still shows the old page until the epic merges, so this is not closed on a deploy the way the two rows above are |

**The hazard of deploying into the decommissioned box is closed.** Until 2026-08-17 a merge to
`main` would have deployed into a box that was down, and done it with `--build` on a machine
being decommissioned. `SERVER_HOST` no longer resolves there, and nothing of the estate's points
at `95.216.143.251` any more (`ops/routing-inventory.md`, under the heading **"The address the
estate left"**, the `Estate exposure` row, `:1532-1551` as of 2026-08-24). That hazard is not
live and must not be repeated as though it were.

**The live hazard is a sharper version of the same risk.** The deploy now reaches the box that
serves all six hostnames and that the measurement week is running on. The blast radius grew when
the target was corrected, which is the right trade and still a cost worth naming.

---

## KV-2: Four Registry `source` links resolve for nobody but the Operator

**Four links, three of them repairable.** The count in the heading is the breach; the count in
the repair below is three, because `StreamVault` is ruled permanently private. Both numbers are
correct and they are not the same number.

**Scope: repository visibility, and nothing else.** This entry is about whether an anonymous reader
can open the `source` link the Registry will carry. It makes no claim about what those repositories
contain, whether they are maintained, or whether their applications run.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **FR-10**, the drill-through path, and **SM-4**, every Registry link resolves | **Decision.** FR-10 requires every entry without exception to carry a `source` resolving to a repository, `Archived` entries and the Hub's own included. `epics.md:2208-2211` states it as Story 2-5's acceptance. A private repository returns 404 to an anonymous reader, so the link exists and does not resolve |
| Offending repositories | `cs-tracker`, `cs-tournament`, `Mutuo` | **Observed 2026-09-02** by `gh repo list LuigiEspinosa --json name,visibility,isArchived`. All three read `PRIVATE`. Their applications are `Live`, `Live` and `In progress` respectively, so this is not a question about archived code |
| Excluded from repair, not from the breach | `StreamVault` | **Decision.** It is also `PRIVATE`, observed in the same call, and it is deliberately so: a personal tool the Operator does not intend to publish. It still carries a `source` the Registry requires and that source still will not resolve. Naming it here is the honest form; omitting it would make this entry read as a complete list of unresolving links when it is not. **It is not a candidate for the repair below** |
| What the Registry will carry | A `source` per entry regardless | **Decision.** AD-5 makes `source` required with no exception, so Story 2-5 authors these four links knowing three are repairable and one is not. The alternative, omitting the field, is forbidden by the schema Story 2-3 shipped and would fail the blocking `registry-schema` job |
| Why it is not repaired here | Making a repository public is a GitHub console action with consequences this story cannot weigh | **Decision.** Story 2-4 confirms values; it performs no console action and takes no view on whether any of these three should be published. `cs-tournament` and `Mutuo` may carry credentials, client material or third-party integration keys, and `ops/contract-adoption.md:182` already records that the four private repositories cannot carry a required status check on the current GitHub plan. Publishing one is the Operator's call on its contents, not a Registry chore |
| Status | **Retired** 2026-09-24 | **Decision.** Recording the breach is not repairing it. **Amended 2026-09-25** (Operator ruling 2026-09-24): all three repairable repositories are now ruled, one published and two kept private by decision, which is the retirement condition below |
| Ruled by | **The Operator**, during Story 2-4's planning checkpoint | **Decision.** Asked whether to make the three public or record the breach, the Operator chose to record it. No separate architectural sentence tolerates this one, unlike KV-1, so the ruling is an Operator act and is cited as one |
| Ruled on | **2026-09-02** | **Decision.** The date of that checkpoint, which is also the date this entry was written. The two coincide here and are still different facts |
| Opened | **2026-09-02** | **Decision.** Written by Story 2-4 |
| Retired by | **The Operator's rulings of 2026-09-24** (pending action 5) | **Amended 2026-09-25**: retired by ruling, not by a story. Before that: **`unassigned`**. **Decision.** No story is scheduled to change any repository's visibility. `ops/known-violations.md` admits an entry on `unassigned` precisely so a tolerated breach nobody has scheduled a fix for is written down rather than kept out. It becomes a standing question for the Operator, carried in the pending table below |
| Retired on | **2026-09-24** | Filled when **all three** repairable repositories have been ruled either way, each either public or recorded as permanently private, which is what pending action 5 tracks. A single ruling retires nothing on its own. `StreamVault` is already in the second category and is not one of the three |

### What a reader should not conclude from this entry

**This is not a statement that the Registry is broken.** SM-4 is a success measure over published
links. This entry exists so that Story 2-5 authors those four `source` values knowing what they do,
rather than discovering it when someone clicks one.

**Amended 2026-09-03: the breach is committed, and becomes live when Epic 2 merges.** This section
read "the Registry is `applications: []` until Story 2-5, so nothing is currently failing it".
Story 2-5 has run: fourteen entries are authored on `dev`, four carrying a `source` that returns 404
for an anonymous Visitor.

**The distinction matters and is the reason this paragraph is worded carefully.** The estate merges
to `main` at the end of each epic, and `cuatro.dev` deploys from `main` on every push, so nothing
Story 2-5 wrote is served yet. SM-4 is a success measure over **published** links, so it is not
breached today. It will be, without any further edit, the moment Epic 2 merges. The ruling and the
remedy are both unchanged; what changed is that the cost is now committed rather than hypothetical,
and the last moment to reverse it is that merge. Recorded rather than rewritten, because this section
was explicitly written to be revisited at this point.

**Nor is it a statement that these three should be public.** The breach is recorded; the remedy is
not chosen. There are two remedies and this entry picks neither: publish the repository, or rule
that it stays private and accept a permanently unresolving `source` for that entry, as
`StreamVault` already does.

**Noted 2026-09-12 by Story 2.23: the four repositories now have a parsed copy that a job reads.**
`ops/registry-verification.md` § Sources tolerated to answer 404 anonymously carries one row per
repository named here, and `ops/registry-verification.mjs`, the scheduled Registry verification,
parses that table on every run: an anonymous 404 on a repository in it is `PASS ... tolerated by
KV-2`, and on any other repository a failure. Two consequences. A "publish it" ruling under pending
action 5 also strikes that repository's row there (Ruling cell prefixed `Struck YYYY-MM-DD`), and the
job says so itself the first time the repository answers 2xx anonymously; a "stays private" ruling
changes the row's Ruling text and nothing else. And the copy is held to this entry by nothing
mechanical: a repository added here without a row there fails the job as a public repository gone
private, and a row there without a ruling here tolerates a breach nobody recorded, so the two are
edited together by hand. The unit suite pins the four rows as they stand today.

**Retired 2026-09-24 on the Operator's rulings of that day.** The Operator ruled to scan each
repository's full history for secrets and publish the clean ones. gitleaks 8.30.1 ran over every
commit on every ref of full mirrors, beside a read of every sensitive path ever added.
`cs-tournament` was clean (its one hit is a file hash in a BMAD manifest) and was **published**; it
answers 200 anonymously, and its row in `ops/registry-verification.md` is struck. `cs-tracker` (two
hits, its dev and test `secret_key_base` values, both committed 2026-05-23) and `Mutuo` (a Twilio
API key and a JWT committed 2021-04-16, and hard-coded test passwords from 2021) stay **private by
decision**, their rows carrying those reasons by finding type and date, as this public record must;
publishing either waits on the Operator's own review of its findings, and the Twilio
key should be revoked if it is still live. With all three ruled, the breach stands only where the
Operator chose it, like `StreamVault`, so the entry retires.

---

## KV-3: Two applications serve on `cuatro.dev` from outside the Registry

**Scope: the two hostnames named below.** `analytics.cuatro.dev` is not in scope: it serves
self-hosted Umami, which is infrastructure this estate runs rather than an application the Registry
describes, and Story 2-4 ruled it out on that ground. `ad-analysis.cuatro.dev` is not in scope
either: it is **NXDOMAIN, observed 2026-09-02**, so nothing serves and there is no breach to record.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-6**, Registry membership is by application, not by repository | **Decision.** `ARCHITECTURE-SPINE.md:112`. AD-6's operative clause is that no application is ever dropped by omission. Two applications serving on the estate's own domain, in no Estate row and in no planning artifact, are dropped by exactly that |
| Offending hostnames | `covidmap.cuatro.dev`, `future-vizion.cuatro.dev` | **Observed 2026-09-02** by HTTPS request: both return 200. Both resolve to Vercel and neither is served by the box. Recorded first by Story 1-7 at `ops/routing-inventory.md:453-454` as observed absences, and handed to Story 2-4 at `:1605` as an AD-6 membership decision |
| Their repositories | `LuigiEspinosa/covidmap` (Vue, default branch `master`) and `LuigiEspinosa/future-vizion` (HTML) | **Observed 2026-09-02** by `gh repo list LuigiEspinosa --limit 100 --json name,visibility,isArchived,primaryLanguage,pushedAt,homepageUrl`, and the default branch separately by `gh api repos/LuigiEspinosa/<id>`. Both public, neither archived, last pushed 2026-04-13 and 2026-04-11. **The shorter three-field call cited elsewhere in this file returns none of the language, push-date or default-branch values**, and is not what gathered them |
| The ruling | **Excluded from the Estate and from the Registry; the two subdomains are retired** | **Decision**, taken by the Operator at Story 2-4's planning checkpoint. They predate the Ecosystem, appear in no PRD section, architecture invariant or epic, and adding them would expand the Estate's scope by a decision Story 2-4 was not chartered to take. **Reversed 2026-09-25** by Operator ruling 2026-09-25: both are listed in the Registry, as `Live` in 1.5.0, and admitted to the Estate; the subdomains are not retired |
| Why exclusion needs a retirement to be honest | There is no `status` that admits them without rendering them | **Decision.** Both really are live, so the only truthful `status` is `Live`. **FR-35 renders `Live` and `Complete`** (`contracts/registry.schema.json:59`, `epics.md:86`), so `Complete` would render them too, and the only values that hold an entry back are `In progress` and `Archived`, each of which would be false. No truthful value keeps them out. Retiring the subdomains removes the fact that creates the breach, which is the one resolution AD-6 does not treat as omission |
| What retirement means concretely | Delete the two Cloudflare CNAME records, and the `_vercel` TXT record that verifies `future-vizion` | **Decision.** `ops/routing-inventory.md:180-181` carries both CNAMEs and `:195` the TXT record. The repositories are not archived, deleted or made private by this: only their `cuatro.dev` hostnames go. `future-vizion` also has a GitHub Pages CNAME set to the same hostname (**observed 2026-09-02** by `gh api repos/LuigiEspinosa/future-vizion/pages`), which is currently shadowed by the Vercel DNS record and should be cleared in the same pass, or Pages will re-serve the name. **Amended 2026-09-25** (Operator ruling 2026-09-24): Vercel leaves the estate, so the two Vercel projects behind these names go too, **after** the DNS records and never before, so no name is ever left pointing at a deleted project. `ops/estate.md` § The Vercel decommission orders it: these three records are step 1, the two projects step 2. KV-3 retires on step 1's lookup; step 2 follows it and does not gate it |
| Status | **Retired** 2026-09-26, by membership | **Decision.** Operator ruling 2026-09-25 reversed the 2026-09-02 exclusion: `covidmap` and `future-vizion` are `Live` entries in `contracts/registry.json` from Registry 1.5.0 and rows in `ops/estate.md`, so neither application is dropped by omission and AD-6 holds. The later of the two readings this entry's own table allowed, "a later ruling lists them in the Registry", is the one taken. The published copy at `https://cuatro.dev/contracts/registry.json` reads 1.4.0 until the next merge to `main` deploys; AD-6 is a rule about the Registry of record, which is the committed file. Both hostnames keep serving from Vercel, and what that leaves in breach is **KV-7**. Before that, from earlier on 2026-09-25: **Open and accepted as standing.** Operator decision 2026-09-25: both stay live for sentimental value, so the DNS records and the two Vercel projects are kept and the retirement will not be made. The breach of AD-6 is therefore permanent unless a later ruling lists them in the Registry or retires them. Epic 4's routing rebuild should leave both names resolving to Vercel, which still holds |
| Ruled by | **The Operator**, during Story 2-4's planning checkpoint | **Decision.** Story 1-7 declined to take it, correctly: `ops/routing-inventory.md:1605` records that this is "a Registry membership decision under AD-6, owned by Story 2-4, not by an enumeration" |
| Ruled on | **2026-09-02** | **Decision.** The date of that checkpoint |
| Opened | **2026-09-02** | **Decision.** Written by Story 2-4. The breach itself is older: it was observable on 2026-08-16, when Story 1-7 first found both hostnames in the zone |
| Retired by | **Operator ruling 2026-09-25**, by Registry membership, landed by the `registry-1-5-0` package (`_bmad-output/implementation-artifacts/spec-registry-1-5-0.md`). Was **nobody, by decision** (2026-09-25), and `unassigned` before that | **Decision.** Retired by admitting the two applications, not by the DNS deletion this cell used to wait on. Before that: No story owns the DNS change. Epic 4 rebuilds the estate's routing wholesale and would incidentally settle it, but no acceptance criterion there names these two hostnames, so booking it to Epic 4 would be inventing a commitment. It is carried as an Operator action below instead |
| Retired on | **2026-09-26** | The UTC date the two entries were committed to the Registry of record. The condition this cell carried, "filled when both hostnames stop resolving", is superseded: both still resolve and serve by the Operator's choice, **observed 2026-09-26** by `nslookup <name> 1.1.1.1` (`216.198.79.1` and `64.29.17.1` for each) and by `curl -sI` (200, `Server: Vercel`). Was _not to be retired_ (Operator decision 2026-09-25) |

### The count consequence, stated because its absence is the surprising part

**This ruling is what holds the Estate's counts steady against these two applications**, and that
is worth saying plainly because a reader who finds two live applications excluded may expect the
numbers to have moved. Neither was ever counted in either figure and this ruling does not add
them, so neither figure moves **on account of KV-3**. Had the Operator ruled the other way, both
would have gained two, and the sentence beginning "The 11 repositories at this waypoint are"
would have had to move with them, which `ops/contract-adoption.mjs` parses and two tables in
`ops/contract-adoption.md` are held equal to.

**The application count did fall on 2026-09-02, for an unrelated reason, and this entry is not
it.** It went from 15 to 14 when `apple-music-workspace` was ruled out of the Estate, having no
repository at all. That is recorded under Counts in `ops/estate.md`. The repository count at the
waypoint is unchanged at 11. A reader who arrives here looking for why the count moved is in the
wrong entry.

**Citations into `ops/estate.md` name their sentence, not a line number**, because this change
inserted roughly forty lines above the parsed sentence and moved it. `ops/known-violations.md`
already prescribes exactly that repair for drifting citations.

**Amended 2026-09-26: the Operator did rule the other way, on 2026-09-25, and both figures moved.**
Operator ruling 2026-09-25 listed both applications in the Registry, so the application count went
from 14 to 16 and the repository count at the waypoint from 11 to 13, and the sentence now reads "The
13 repositories at this waypoint are", with `ops/contract-adoption.mjs` and both tables in
`ops/contract-adoption.md` moved with it. The paragraphs above are left as written: they were true
of the 2026-09-02 ruling.

### Retired 2026-09-26 by membership

The 2026-09-02 ruling excluded both applications and planned to retire their hostnames, and the
Operator's first decision of 2026-09-25 kept the hostnames and left the breach standing. His second
decision that day, Operator ruling 2026-09-25, listed both in the Registry. That is the resolution
AD-6 names, membership, and it needs no DNS change: `covidmap` and `future-vizion` are `Live` entries
in Registry 1.5.0, validated by the blocking `registry-schema` gate, checked by the scheduled Registry
verification, and rendered by the Suite Directory, which FR-35 requires of a `Live` entry and which
this entry's "why exclusion needs a retirement" row had named as the reason no truthful status could
keep them out. Pending Operator action 6 and `ops/estate.md` § The Vercel decommission steps 1 and 2
are superseded by listing and will not be done. Serving two `Live` members from Vercel, outside the
Cloudflare proxy, is a different breach of different rules and is **KV-7**.

---

## KV-7: Two `Live` Registry members serve from Vercel, outside the Cloudflare proxy

**Scope: `covidmap.cuatro.dev` and `future-vizion.cuatro.dev`, and the two rules below.** Opened on
the day KV-3 retired, because listing both as `Live` makes them the estate's running applications,
and two rules that bind every live `cuatro.dev` hostname do not hold for them.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-26**, TLS terminates at Cloudflare and every live `cuatro.dev` hostname is proxied with Full (strict), the origin presenting a Cloudflare Origin CA certificate; and **AD-17b**, bot mitigation is live on every live subdomain before the Suite Directory ships (NFR-7) | **Decision.** `ARCHITECTURE-SPINE.md` § AD-26 and § AD-17. A DNS-only record never reaches Cloudflare's proxy, so neither Full (strict) nor the zone's bot rules (`ops/bot-mitigation.md`) apply to what it serves |
| Offending hostnames | `covidmap.cuatro.dev`, `future-vizion.cuatro.dev` | **Observed 2026-09-26** by `nslookup <name> 1.1.1.1`: each answers `216.198.79.1` and `64.29.17.1`, Vercel's addresses and not Cloudflare's; and by `curl -sI https://<name>/`: 200 with `Server: Vercel` and an `X-Vercel-Id`, no `cf-ray`. The zone carries both as DNS-only CNAMEs to `vercel-dns-017.com` (`ops/routing-inventory.md` § The whole zone) and each presents a single-name Let's Encrypt certificate that Vercel renews (`ops/routing-inventory.md` § the certificate table, observed 2026-08-24) |
| Why it is newly an entry, and older than it | Both hostnames have been DNS-only since at least 2026-08-16, when Story 1-7 first found them, so the two rules have never held for them | **Decision.** While KV-3 planned to retire both names, the breach was set to end with them and nothing recorded it separately. The keep-live decision and the listing of 2026-09-25 made it standing, and the Suite Directory now links both, which is the surface AD-17b exists to protect |
| The ruling | **Tolerated**: both stay exactly where they are, served by Vercel, their DNS records and Vercel projects untouched | **Decision**, by the Operator in session on 2026-09-25: first the decision to keep both live for sentimental value (recorded in `bc698f8`), then Operator ruling 2026-09-25, which listed them and said both stay where they serve. It is a deliberate exception to the Operator ruling of 2026-09-24 that removed Vercel from the estate, and the later ruling is the one in force |
| Why it is tolerable | Neither host reaches the box | **Decision.** AD-26 prevents a silently broken ACME renewal on the origin, and AD-17b and NFR-7 protect the box's two cores from crawlers the Directory attracts. Vercel renews both certificates and absorbs both hosts' traffic, so neither failure lands on the estate's hardware. What is lost is uniformity: these two are the only live `cuatro.dev` names Cloudflare does not front |
| What it does not cover | FR-31 and AD-7 | **Decision.** FR-31 requires every `Live` application to be monitored externally, and no monitor watches either host (**observed 2026-09-26** by UptimeRobot `list-monitors`: eight monitors, none on either name). No ruling tolerates that and two monitors close it, so it is not admitted here: it is DW-248 and a Pending Operator action in `ops/monitoring.md`. AD-7 and AD-8 describe applications placed on the box in Epics 3 and 4, and no plan places these two there. **Amended 2026-09-26:** both are monitored since then (804092499, 804092500, DW-248 closed), so FR-31 now holds for them |
| Status | **Open and accepted as standing.** Operator ruling 2026-09-26: both stay DNS-only on Vercel rather than being proxied, since Vercel advises against a proxy in front of it; the two rules stay unmet for these hosts by choice (Pending Operator action 10) | **Decision** |
| Ruled by | **The Operator**, in session | **Decision.** An Operator act, cited as Operator ruling 2026-09-25 |
| Ruled on | **2026-09-25** | **Decision** |
| Opened | **2026-09-26** | **Decision.** Written by the `registry-1-5-0` package, the UTC day it committed the two entries |
| Retired by | **nobody, by decision** (Operator ruling 2026-09-26; was `unassigned`) | **Decision.** It retires when both hostnames are proxied through Cloudflare with Full (strict) and covered by the zone's bot rules, or when both leave `Live`. No story plans either, so it is a standing question for the Operator, carried as Pending Operator action 10 below |
| Retired on | _not to be retired_ (Operator ruling 2026-09-26) | Filled when neither hostname is DNS-only, verified by `nslookup` answering Cloudflare addresses and a `cf-ray` on the response, or when neither entry is `Live` |

## KV-8: Two rendered applications are exempt from the restyle

**Scope: `covidmap` and `future-vizion`, rendered in the Suite Directory since Registry 1.5.0.**

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-25**, a restyle exists for every application the Suite Directory renders, gated by the Registry `status` alone, with no second list and no judgement call; and with it **SM-6** (token adoption, 100% of rendered entries) and **SM-12** (component-level coherence, every rendered application) | **Decision.** `ARCHITECTURE-SPINE.md` § AD-25; PRD § 9. An exemption is exactly the second list AD-25 forbids |
| Offending applications | `covidmap` (Nuxt, Vue) and `future-vizion` (static HTML, jQuery), both `Live` on Vercel | **Observed 2026-09-26**: neither vendors `cuatro-contracts/` or renders the Restyle Specification's vocabulary |
| The ruling | **Exempt from Epic 8's restyle and from token adoption**: both stay as they are | **Decision**, by the Operator in session on 2026-09-26 (DW-250), following the 2026-09-25 decisions to keep both live for sentimental value and to list them. The architecture is not amended; the exemption is recorded here instead |
| What it costs | SM-6 and SM-12 read below 100% for as long as both are rendered, and a Visitor leaving the Hub for either sees its own pre-Ecosystem styling | **Decision.** Stated so the metrics are read with it |
| Status | **Open and accepted as standing** | **Decision** |
| Ruled by | **The Operator**, in session | **Decision.** Cited as Operator ruling 2026-09-26 |
| Ruled on | **2026-09-26** | **Decision** |
| Opened | **2026-09-26** | **Decision** |
| Retired by | **nobody, by decision** | **Decision.** It would retire if either application is restyled, leaves `Live` and `Complete`, or AD-25 is amended to admit exemptions |
| Retired on | _not to be retired_ (Operator ruling 2026-09-26) | **Decision** |

---

## KV-4: No control ships under the 44x44 hit-target floor

**Retired on 2026-09-23 by Story 2-32**, which rebuilt the chrome logo as a text wordmark held to the
floor and deleted `chrome-logo`, the ledger's last row, in the same commit. The heading reads none
since then, and the table below keeps its history, as this file's rule for a retired entry asks.

**The count in this heading moved on 2026-09-08 and again on 2026-09-11, and the index row moved
with it in the same change each time**, which is what this file's own rule requires of a derived
row. It read thirteen from 2026-09-06 until Story 2-15 repaired the six chrome nav links and
deleted their ledger row, and seven from then until Story 2-17 replaced the 404's back link with
two exits built to the floor and deleted `error-back`. The count is in the heading rather than
beside it because a register whose entries are titled by their subject alone tells a reader
nothing about scale, and it is the one part of a heading this file allows to move without treating
it as a rename.

**Scope: what the Hub renders, measured.** This entry is about controls that exist and are too
small, on the surfaces the Hub serves as HTML. It makes no claim about surfaces Epic 2 has
not built yet, and none about the Satellites, whose own controls this repository cannot measure.

**This entry exists because something now measures the floor.** Until 2026-09-06 the breach was
real and invisible: `ops/rendered-output-harness.md` recorded the floor as deliberately unasserted,
nothing in the repository measured a hit target, and `--tap` shipped in the contract with zero
consumers. Story 2-8 installed the instrument and this is the first reading it produced.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-19**, the accessibility floor, booked as **A-4** at `EXPERIENCE.md:763` and binding on **FR-3**. Its pointer half is stated at `EXPERIENCE.md:727-732`: a minimum target of 44x44px **on the interactive element itself**, as `min-height: var(--tap)` plus `display: inline-flex`, and never as vertical padding on a plain inline element | **Decision.** `ARCHITECTURE-SPINE.md`, AD-19. `epics.md:2334-2342` is where Story 2-8 is required to assert it rather than claim it |
| What is in breach | **Nothing, since 2026-09-23: 0 of the 39 elements the sweep measures.** Story 2-32 replaced the logo raster with a text wordmark whose link holds `min-block-size` and `min-inline-size` at `--tap`, so it clears the floor on both axes on `/work`, `/cv` and the 404, and the sweep reported `chrome-logo` stale in the commit that repaired it. Until then: **one authored control**, rendering as **3 of the 39 elements the sweep measures**: the logo link, on `/work`, `/cv` and the 404 | **Observed 2026-09-23** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, the sweep green with the ledger empty. **Observed 2026-09-21** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by `getBoundingClientRect()` after fonts resolved, which is the method every reading in this cell was taken by. Every size is in `ops/hit-target-floor.md` under "The exemption ledger", per element. **Fifteen controls and 39 of 43 elements when this entry was opened**: Story 2-9 deleted the two `.project-card__links` controls, rendered six times each on `/projects`, along with the component that carried them. **Thirteen controls and 27 of 54 after that**, until Story 2-14 redirected `/projects` on 2026-09-07: no authored control was repaired or removed, and the seven chrome controls were simply rendered on two surfaces rather than three, which read **20 of 36**. **Seven controls and 8 of 28 from 2026-09-08**: Story 2-15 rebuilt the six chrome nav links to `--tap` on both axes and deleted `chrome-nav` in the same commit, so that is the first movement in this cell that is a repair rather than a deletion or a route. **Seven controls and 9 of 37 from 2026-09-10**: Story 2-16 built `/cv`, which renders the same header, so the logo link is rendered on a third surface. The authored count was unchanged and that was a route rather than a regression, which is why the heading above did not move then. **Six controls and 8 of 39 since 2026-09-11**: Story 2-17 replaced the 404's back link with the header's two destinations built to `--tap` on both axes and deleted `error-back` in the same commit, the second movement in this cell that is a repair. The sweep measures two elements more, the footer link on `/` and the second exit on the 404, and both clear the floor. **One control and 3 of 39 since 2026-09-21**: Story 2-29 rebuilt `HomeLayout.scss` and gave both hero link groups `min-block-size: var(--tap)` on a flex box, deleting `home-nav` and `home-contact` in the same commit, the third movement in this cell that is a repair and the first made by a story whose own criteria never named this floor. What is left is the logo link, rendered on three surfaces |
| The shape of the breach | **Height, and now only height on one control.** The logo link clears the floor on width and fails on height, at 184.00 x 20.00, 24px short | **Observed 2026-09-08**, same method, re-read **2026-09-11** and again **2026-09-21**. The nearest miss was `a.error-page__back` at 108.58 x 38.19, 5.81px short, until Story 2-17 replaced it; it was then the home pair and the contact links at 23.00, 21px short, until Story 2-29 took all five past the floor on 2026-09-21, which leaves the logo as both the nearest and the furthest miss because it is the only one left. **Until 2026-09-08 one of the thirteen failed on both axes**, the chrome `Blog` link at 38.41 x 22.00, and it is the one control in the whole census that ever has; Story 2-15 removed the link rather than widening it, the header now carrying two destinations and neither of them a blog that has no route on disk. The 17.00px lower bound in the opening reading was the two card links, which are gone |
| Not in breach | The `button.work-item__header` controls at 216.00 x 88.80, the eleven Suite Directory links on `/`, the A-6 skip link Story 2-13 added, the chrome nav links Story 2-15 rebuilt, the two intro links Story 2-16 authored on `/cv`, the footer link to `/celeste` and the two 404 exits Story 2-17 authored. Twenty-two directory links until 2026-09-07, eleven on each of the two surfaces the directory rendered on, until Story 2-14 left it rendering on one. **Four accordion triggers and four nav links until 2026-09-10, eight and six since**: Story 2-16 mounted the same timeline and the same header on `/cv`, so both are rendered on one more surface | **Observed 2026-09-11.** Recorded because a register of breaches that listed every control would say nothing, and because the sweep asserts at least one measured element clears the floor so the comparison discriminates. The directory's links are the first controls in the Hub authored against the floor rather than exempted from it, and the chrome nav links are the first that were **moved** from one side of this cell to the other; the 404 exits are the second, and the first to be moved by a story other than the one the ledger row named |
| Where it is tracked mechanically | `ops/hit-target-floor.md` § The exemption ledger, and `EXEMPTIONS` in `tests/e2e/hit-target-floor.pw.ts`, held equal in both directions by `ops/__tests__/hit-target-floor.test.ts` | **Decision.** This entry is the register; those two are the ledger the build enforces. A row deleted from the ledger without a line changed here is the one drift this file cannot see, which is why the surfaces are listed above individually rather than as a count |
| Status | **Retired** | **Decision.** Retired on 2026-09-23, when the ledger emptied: nothing on the Hub measures under the floor, and a new breach fails the sweep unless the Operator rules to tolerate it and a row is written. Open and tolerated from 2026-09-06 until then: recording a breach is not fixing it, and Story 2-8's boundaries forbid changing any component or stylesheet, because a repair made there would have landed outside the story that planned it and outside that story's own criteria |
| Ruled by | **The Operator**, at Story 2-8's planning | **Decision.** Asked how the floor should be asserted against a Hub already in breach, the Operator ruled that the sweep is universal and the known breaches are carried in a dated exemption ledger that can only shrink, rather than the sweep being scoped to what already passes. That ruling is what tolerates these fifteen. This register's admission test (`:24-36`) takes an Operator act or a sentence in the breached decision, and AD-19 carries no such sentence, so the act is cited and no sentence is invented for it |
| Ruled on | **2026-09-06** | **Decision.** The date of that planning checkpoint, which is also the date this entry was written and the date the breach was first measured. The three coincide here and are still different facts |
| Where the repairs are booked | **The one remaining ledger row is not booked by an acceptance criterion that names this floor; it is booked by ownership only.** Two of the three were until 2026-09-21, when Story 2-29 repaired the home pair without a criterion either | **Observed 2026-09-06**, by reading `epics.md`, re-read **2026-09-08**, and re-read **2026-09-11**. Verified: `:3441-3442` requires the 404 exits at 44x44 on both axes measured in a browser (Story 2-30), and **that row landed early**: Story 2-17 built the exits to the floor on 2026-09-11 because writing two new links under it would have been a new breach this register has no shape for, so Story 2-30's criterion arrives at a surface already meeting it, as Story 2-32's nav criterion did. Two other such rows **had landed** before it: `:2399-2401` for the directory's two links, closed by Story 2-9, and `:2655-2658` for the chrome nav links, closed by Story 2-15 on 2026-09-08. **Not established**: no acceptance criterion in `epics.md` names the floor for the chrome **logo**, which is the one row left. It named none for the **home nav links** or the **contact links** either, and that is why they were booked here by ownership until Story 2-29 repaired them on 2026-09-21. Story 2-32 names `Logo` and `ContactContainer` in its title (`:3559`) and its floor criterion at `:3576-3584` is written about the **nav links**, which Story 2-15 has now repaired; the home nav links lived in `HomeLayout.tsx`, whose redesign is Story 2-29, which named no floor criterion at all. `chrome-logo` is booked to Story 2-32 by Story 2-8's own frozen boundaries, not by a criterion in the epic. **Amended 2026-09-21 by Story 2-29, whose own criteria name no hit-target floor either, so it is a second demonstration of what this cell records: a row moved because the sweep made it move, not because a criterion asked.** The two rows it deleted moved for different reasons, which the audit of that story separated. `home-nav` was **forced**: setting the hero links in the display face at `--t-xl` pushed the first nav link to 296.00 x 68.75, the sweep reported that row stale, and a row cannot go half stale. `home-contact` was **elective**: nothing made the three contact links clear the floor, and `min-block-size: var(--tap)` on them was a choice. **Operator ruling of 2026-09-21**: keep both, so all five hero links hold `min-block-size: var(--tap)` and both rows stay deleted, and pending action 9 is answered for the home pair and open for `chrome-logo` alone. **`chrome-logo` is untouched and is still booked to Story 2-32 by ownership alone**, which is the part of action 9 that is still open. **Closed 2026-09-23 by Story 2-32**, which took the row as booked: its criterion that "every other control" declares the floor through `--tap` reaches the wordmark, so a floor criterion named it after all |
| Opened | **2026-09-06** | **Decision.** The date this entry was written, by Story 2-8, which is also the date the breach was first measured rather than inferred |
| Retired by | **Story 2-32**, which deleted the one ledger row left, `chrome-logo`, in the commit that repaired its surface, on 2026-09-23. **Stories 2-9, 2-15, 2-17 and 2-29 have deleted theirs**, on 2026-09-06, 2026-09-08, 2026-09-11 and 2026-09-21; Story 2-30 was named here until the third of those, and left the list because Story 2-17 deleted `error-back` ahead of it. Story 2-29 is the one that deleted rows nothing had booked to it, and the two halves of that are different: `home-nav` went because the sweep failed it as stale, which is the mechanism working rather than the plan, and `home-contact` went on the Operator's ruling of 2026-09-21, nothing having forced it. Both are recorded under "Where the repairs are booked" above | **Decision.** The sweep makes that unavoidable: a listed element that starts clearing the floor fails as a stale row, so a story cannot repair a surface and leave the exemption behind. Story 2-9 is the demonstration that the mechanism works rather than merely being described, Story 2-15 is the demonstration that it works on a story that had to hit it, `chrome-nav` being the row its own acceptance criteria named, and Story 2-17 is the demonstration that it works on a story the row did not name: the sweep would have failed `error-back` as stale the moment the exits met the floor, whichever story built them. The three rows with no criterion of their own are the ones most likely to be missed, and they are the reason the row above says so plainly rather than claiming uniform coverage |
| Retired on | **2026-09-23** | **Observed.** The ledger is empty in `ops/hit-target-floor.md` and in `EXEMPTIONS`, and the sweep passed against it in the pinned image. Filled when the ledger emptied, verified by reading the ledger rather than a stylesheet: this is the floor `EXPERIENCE.md:731-732` says is the single easiest one to miss while appearing to be met |

### The one surface nobody had counted

**`Logo.tsx:7` was not on the list of surfaces this breach was expected to have.** **Observed
2026-09-06**, by sweeping rather than by reading. Story 2-8's own code map named four surfaces, and
the sweep found five. The logo link is a plain inline `<a>` around a 184 x 66 image, so the
element's own box is the 20px text line box while the image paints past the bottom of it. A finger
lands on the image and activates the link, so the effective target is larger than the measured one,
and AD-19 is nonetheless about the element itself.

This is the argument for a universal sweep rather than a list of surfaces someone remembered, and
it is recorded here rather than only in `ops/hit-target-floor.md` because it changed what this
entry counted when it opened: fifteen controls, not the fourteen a reader of the plan would have
expected. Seven remained after Story 2-15 repaired the six nav links beside it on 2026-09-08 and
left it exactly as it was, which is what its own `closedBy` cell predicted, and six remain after
Story 2-17 repaired the 404's exits on 2026-09-11: the logo is still one of them, rendered on that
surface too.

### What a reader should not conclude from this entry

**This is not a statement that the floor is unenforced.** It is enforced from 2026-09-06, on every
route, and a new or regressed control that is too small fails the build on arrival. What is
tolerated is a closed list of surfaces that were already in breach when the instrument was
installed, each with a story that closes it.

**Nor is it the whole of AD-19.** `.lighthouserc.js:15` still asserts accessibility at 0.95 with
severity error and was not touched by Story 2-8 (**observed 2026-09-06** by
`git diff --stat 9f71fba -- .lighthouserc.js`, which was empty). Contrast, focus order and the
manual pass are separate instruments with separate owners, and `ops/hit-target-floor.md` § What
this deliberately does not assert lists what the sweep leaves to them. A-4's **independently
addressable** clause was among them, because it is a statement about two boxes rather than one and
nothing on the shipped Hub put two targets on one line at 360 wide. Story 2-9's directory does,
and the clause is asserted from 2026-09-06 in the same spec file.

### Maintaining the ledger this entry counts

Not an Operator action, so it is not in the table at the foot of this file: that table hands the
Operator decisions this register is not entitled to take, and this is work the closing stories
already own. It is written here instead, beside the count it keeps true.

**A repair moves four things and a change to fewer than four is a defect:**

1. the row in `ops/hit-target-floor.md` § The exemption ledger,
2. the entry in `EXEMPTIONS` in `tests/e2e/hit-target-floor.pw.ts`,
3. the surface named in the "What is in breach" cell above, and
4. **the KV-4 index row at the top of this file**, whose count and closing stories
   `ops/__tests__/hit-target-floor.test.ts` pins as literals.

The first two are held equal by that suite; the third and fourth are prose and are the reason the
surfaces are listed individually above rather than as a bare number. The per-surface counts in
`ops/hit-target-floor.md` § The surfaces swept move with them, since deleting a control changes what
the sweep measures.

**The last story to land retires the entry**: fill `Retired on`, set `Status` to `Retired`, and
bring the index row into line.

---

## KV-5: No element sits past either viewport edge at 360px

**Retired on 2026-09-23 by Story 2-33**, which rebuilt the `/work` hero, the last half this entry was
open on, and widened the Story 2-8 sweep's A-5 arm past interactive elements in the same commit, as the
paragraph under the halves table asked: `tests/e2e/hit-target-floor.pw.ts` now reads every element
with a box on every surface, both edges, and read none past either in the pinned image. **The heading
read "Thirty-six elements sit past the right edge at 360px, clipped rather than absent" until then**,
its count unmoved since Story 2-14 made it twenty-eight (DW-57, DW-66): it states what holds now, the
shape KV-4 took on retiring, and the table below keeps the history.

**Scope: horizontal overflow at AD-19's width, measured on elements.** This entry is about A-5's
no-horizontal-scroll half. The Status half of A-5 is not in scope and is not in breach either:
Story 2-10 asserted it on 2026-09-06 in `tests/e2e/status-mark.pw.ts`, and every rendered mark fits
its own box at 360 with no clipping, no ellipsis and no wrap. The count, the boxes and the routes
that reading covers are in `ops/status-mark-axes.md`, and are deliberately not restated here: a
number copied into this entry is a number that rots the day an entry is added to the Registry.

**Why this is a violation and not deferred work.** This register's discriminator (`:38-45`) is the
ruling, not the severity. An Operator ruling exists, dated, tolerating the breach; a named story
closes it; and the condition is measured rather than suspected. That is the admission test, and it
is met. It would have sat in `deferred-work.md` only if nobody had ruled on it.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-19**, booked as **A-5** at `EXPERIENCE.md:764` and binding on **FR-3**: no horizontal scroll at 360px. **`DESIGN.md:558-559`** states the mechanism it requires: `html, body { overflow-x: clip }` globally, `clip` rather than `hidden` because `hidden` breaks sticky positioning, and widths `100%` with container padding, never `100vw` | **Decision.** `ARCHITECTURE-SPINE.md`, AD-19 |
| Offending lines | **Repaired 2026-09-06 by Story 2-9.** `app/app.scss` shipped `width: 100vw` with `overflow-x: hidden` on `body` and `overflow: hidden` on the home route, two rules broken in one block. It now ships `width: 100%`, `min-height` in place of `height: 100vh`, and `html, body { overflow-x: clip }`, with the home-route rule removed. `HomeLayout.scss` lost the `@media (max-width: 767px) { overflow: auto }` that overrode it, which would otherwise have set `overflow-x` back to `auto` on the home route at exactly the width A-5 is measured at | **Observed 2026-09-06 at `9f71fba`** by reading the file, and **re-read 2026-09-06** after the repair |
| What still breaches it | **Nothing, since 2026-09-23.** Story 2-33 rebuilt `WorkHero.scss` token-native, a `minmax(0, 1fr)` column at 360 where the 2023 grid's `1fr` track took its content's minimum as its floor, and the widened sweep reads no element of any kind past either edge on `/`, `/work`, `/cv`, `/celeste` or the 404 at 360, which is what the entry was waiting on. Until then: **The component half, on `/work` alone.** 28 elements sit outside the viewport at 360, clipped rather than absent, and the stylesheet no longer has anything to do with why | **Observed 2026-09-06** in the pinned container, after the repair, as 36 across two routes. **Narrowed 2026-09-07** by Story 2-14, which redirected `/projects` and deleted the hero that rendered eight of them, so the elements ceased to exist rather than being repaired. The census is in `ops/hit-target-floor.md` § The overflow this assertion does not cover. **Not re-read on 2026-09-10, when Story 2-16 mounted the same `WorkTimeline` on `/cv`**: every one of the 28 comes from `WorkItem.scss`, so the same overflow is very likely rendered on a second surface and "very likely" is not a measurement. The standing A-5 assertion passed on that date with `/cv` swept, so no **interactive** element's edge is outside the viewport there and no new breach is asserted. Filed as **DW-72**. **Re-read 2026-09-23 by Story 2-31 on both surfaces**, after that story rebuilt `WorkItem.scss` so the meta line wraps: `/work` **10**, every one of them the hero's, and `/cv` **0**. **Re-read again 2026-09-23 by Story 2-32: `/work` 0 and `/cv` 0.** That story rebuilt `.container` from `min(80%, 1920px)` to `min(100%, 1920px)` at `--page-pad`, the width `DESIGN.md` names as what made the 360 floor fail, and the hero's ten elements sit inside the viewport with the canvas mounted: nothing on the whole page is measured past an edge. Its retirement is due and is filed as DW-116 for the story that owns the act. The component half this entry books to Story 2-31 is closed; the hero's is Story 2-33's, and DW-67 and DW-72 close on the reading |
| What is actually outside the viewport | **None, on any of the five surfaces, since 2026-09-23**, read by `outsideTheViewport` in `tests/e2e/hit-target-floor.pw.ts` in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, every element with a box against both edges, the run printing `0 element(s) of any kind past an edge` for each. Until then: **28 elements**, all on `/work`, furthest `span.work-item__icon` at **490.67** against a 360 viewport. `/`, `/celeste` and the 404 are clean, `/` included after the Suite Directory landed on it | **Observed 2026-09-06** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by comparing **every element's right edge** against `window.innerWidth`. **Re-measured 2026-09-06** after Story 2-9, both edges this time: the count was unchanged at **36** and no element sat past the left edge on any route, so 36 was the number rather than a floor on it. **Reduced to 28 on 2026-09-07 by arithmetic rather than by measurement**: Story 2-14 deleted the `/projects` route whose eight elements, furthest `div.projects-hero__text` at **372.00**, made up the rest. There is no surface left to re-measure them on. **10 since 2026-09-23**, all on `/work` and all the hero's, each at [72.00, 372.00]: `div.work-hero__text` and the five elements inside it (the Plate mark and its two cells, the heading, the meta line) and `div.work-hero__canvas-wrap` with the two wrappers and the canvas inside it. `/cv` is clean. **Observed 2026-09-23** in the pinned image by `tests/e2e/plate-mark-and-work-item.pw.ts`, which measures both edges of every element with a box on both routes at 360, asserts that none inside `.work-timeline` is past either, and prints the whole-page census on every run |
| Why it is invisible without measuring | On `/work` there is no clipping ancestor and the root reading is **360**, now that `overflow-x: clip` propagates to the viewport; `document.body.scrollWidth` still reports **491** there, which is a second box rather than a second answer. On `/projects`, while it existed, the eight sat 12px past the edge while `document.scrollingElement.scrollWidth` read **360**, because the hero's own `overflow: hidden` (`ProjectsHero.scss:9`) clipped them | **Observed 2026-09-06**, same method, before and after the repair. A `scrollWidth` check would have been green on `/projects` while the condition it exists to detect was present, which is why Story 2-8 asserts A-5 on element edges. That argument is kept although the route is gone: it is the reason the instrument is shaped the way it is |
| Not caught by the Story 2-8 sweep | **Caught since 2026-09-23.** Story 2-33 widened the sweep's A-5 arm to every element with a box, so a non-interactive element past an edge fails the build, shown on two planted blocks the interactive arm cannot see. Until then: None of the 28 is interactive, and that sweep measures interactive elements | **Decision**, recorded rather than widened until the overflow was gone, then widened. `ops/hit-target-floor.md` § What this deliberately does not assert carried it, so a green A-5 was not read as "nothing on the Hub overflows at 360" |
| Status | **Retired** | **Decision.** Retired on 2026-09-23, when the last half closed and the instrument was widened to see the whole of the condition. Open and tolerated from 2026-09-06 until then: recording a breach is not repairing it, and repairing half of one does not retire the entry |
| Ruled by | **The Operator**, at Story 2-8's planning: `app/app.scss` is recorded, not repaired, in that story | **Decision.** The ruling is quoted in that story's frozen boundaries as a Never clause, dated. Story 2-8 ships the instrument and changes no stylesheet |
| Ruled on | **2026-09-06** | **Decision.** The date of that checkpoint, which is also the date the overflow was first measured |
| Opened | **2026-09-06** | **Decision.** Written by Story 2-8 |
| Retired by | **Story 2-33**, which rebuilt the hero and widened the sweep on 2026-09-23, the last of **Stories 2-31, 2-33 and 2-14**, which between them owned every one of the 36 elements this entry was opened over: 2-31 and 2-33 the 28 on `/work`, and 2-14 the 8 on `/projects`, by redirecting the route that rendered them. **Story 2-14 landed on 2026-09-07** and its eight are gone; **Story 2-31 landed its half on 2026-09-23** and the timeline measures no element past either edge on `/work` or `/cv`; 2-33 was what the entry waited on, and it landed on 2026-09-23 | **Decision.** Story 2-9 landed the stylesheet half on 2026-09-06 (`epics.md:2423-2427`: "`clip` replaces `hidden`, because `hidden` breaks sticky positioning" and "widths are `100%` with container padding, never `100vw`"), and its own frozen boundaries forbade touching `WorkItem.scss` or `WorkHero.scss`. **The `/projects` eight were unowned until 2026-09-06** and are recorded that way in the table below rather than silently folded into 2-33, whose title scopes it to `WorkHero`: an entry whose closing stories do not cover its own census can never close. Story 2-22 is booked into the same block, deleting the alias layer above it |
| Retired on | **2026-09-23** | **Observed.** No element sits outside the viewport at 360 on any surface, read by the widened sweep in the pinned image, element by element and not by `scrollWidth`. As first written: half the condition is now met: `app/app.scss` no longer sets `100vw` or `overflow-x: hidden`. Fill this when no element sits outside the viewport at 360. **That holds since 2026-09-23**, measured by `tests/e2e/plate-mark-and-work-item.pw.ts` in the pinned image on `/work` and `/cv`, and the retirement is left to the act the paragraph below the table names (DW-116). Verify by measuring elements, not by reading `scrollWidth`, for the reason two rows above |

### The two halves, and what happened when the first one landed

**Replacing `hidden` with `clip` on a tree that still overflows was expected to be worse than the
state that shipped before it.** **Decision, 2026-09-06.** The reasoning was that it would turn a
clipped page into one with real horizontal scroll, which A-5 forbids outright.

**That reading was wrong, and it was measured rather than argued.** **Observed 2026-09-06** in the
pinned container, on all five surfaces: `overflow-x: clip` clips exactly as `hidden` did, and what
it additionally does not do is make the element a scroll container. `document.scrollingElement.scrollWidth`
reads 360 against a 360 viewport on every route, `/work` included, where it read 491 before. So the
two halves did not have to land together after all, and the stylesheet half landed alone.

| Half | Where | Owner | State |
|---|---|---|---|
| The stylesheet | `app/app.scss`, plus the mobile override in `HomeLayout.scss` | **Story 2-9** (`epics.md:2423-2427`) | **Landed 2026-09-06** |
| The hero grid columns, which measure 300 inside a 216 content box because a grid item's `min-width: auto` refuses to shrink below min-content | `WorkHero.scss:1-9`, with `.container` at `width: min(80%, 1920px)` (`container.scss:2-4`) feeding it | **Story 2-33** | **Measured closed 2026-09-23 by Story 2-32**, whose container feeds the hero a wider box: the whole-page census reads no element past either edge on `/work` at 360. The hero's own stylesheet is untouched and is still Story 2-33's, and retiring this entry is filed as DW-116. **Closed 2026-09-23 by Story 2-33**: `WorkHero.scss` is rebuilt on `minmax(0, 1fr)` columns that cannot be held open by their content, and the entry is retired |
| The same shape in `ProjectsHero.scss:1-9`, which was the other 8 of the 36 | `ProjectsHero.scss:1-9`, same containing block | **Story 2-14**, which redirects `/projects` to `/#suite`. Nothing renders `ProjectsHero` on any route now and the eight elements ceased to exist rather than being repaired: the component, its stylesheet and the page that mounted it were deleted in the same commit as the redirect. **Assigned 2026-09-06**, having been left unowned: Story 2-9 replaced the card grid beneath the hero and its frozen boundaries forbade touching the hero, Story 2-33 is scoped to `WorkHero` by its own title, and an entry cannot retire while eight of its elements belong to nobody | **Closed 2026-09-07** |
| `.work-item__sub`'s `white-space: nowrap` in a `flex: 1` column, which pushes `.work-item__meta` to 372.38 and the icon to 490.67 | `WorkItem.scss:59` | **Story 2-31** | **Closed 2026-09-23**: the meta line wraps in a column that can shrink, and no element of the timeline sits past either edge at 360 on `/work` or `/cv`, asserted in `tests/e2e/plate-mark-and-work-item.pw.ts` |

Whoever closes the last of those should widen the Story 2-8 sweep's A-5 arm past interactive
elements once the overflow is gone, and retire this entry. **Done 2026-09-23 by Story 2-33** (DW-116).

**The measurements, the per-route breakdown and the reasoning are in
`_bmad-output/implementation-artifacts/deferred-work.md`**, filed by Story 2-8 under its own spec.
That entry is the evidence; this one is the ruling. It is cited rather than duplicated, so there is
one place to change when a figure is re-measured.

---

## KV-6: Zero z-index literals, zero depth tells, zero clipped rings, zero synthesised weights and zero routes with no level-1 heading ship on the Hub

**Retired on 2026-09-23 by Story 2-33**, which deleted the ledger's last two rows in the commit that
repaired their files: `z-work-hero` with `WorkHero.scss`, rebuilt against the contract with no
`z-index` at all, and `gradient-work-ground` with `app/app.scss`'s `body#work` rule, deleted with the
cybercore literal under it. The built CSS carries no `z-index` literal and no depth tell since (the
sweep's tally "observed nothing" over twelve built stylesheets in the pinned image), and the heading
reads zero in each kind, which is what `ops/__tests__/hub-accessibility-pass.test.ts` holds it to.
The history is below, kept.

**The counts in this heading are the ledger's sums per kind of row, read off the built
stylesheets and the rendered routes, and the index row moves with them in the same change**,
which is what this file's own rule requires of a derived row and what
`ops/__tests__/hub-accessibility-pass.test.ts` holds: it sums `ops/hub-accessibility-pass.md` § The
exemption ledger per `Check` and fails the build unless this heading and the index row carry each
sum spelled out. Zero `z-index` literals and zero depth tells since 2026-09-23, when Story 2-33
deleted the last two rows. Until then two `z-index` literals (`2` twice; **three until 2026-09-23**, when Story 2-30
rebuilt the 404 and its `2` left with `error-page.scss`; **six until 2026-09-21**, when Story
2-29 rebuilt `HomeLayout.scss` and its `20`, `5` and `3` left with it; **seven until 2026-09-14**,
when Story 2-28 rewrote `ScanlineOverlay.scss`'s `10` as `var(--z-raised)`); two
depth tells (`linear-gradient(` two; **four until 2026-09-23**, when the 404's grid pair left with
Story 2-30's rebuild, the fifth of the rebuilds to land; **six until 2026-09-21**, when the home
ground's grid pair left with Story 2-29's rebuild, the third of the rebuilds to land; **eight until 2026-09-14**, when
Story 2-28 deleted the raster,
its `radial-gradient(` vignette and its `repeating-linear-gradient(` scanlines, the second of the
rebuilds to land; **fifteen until earlier the same day**, when Story 2-27 deleted `glitch-text.scss`
and the seven `text-shadow` steps of its loop with it, the first of the seven rebuilds to land; the
entry read seventeen from 2026-09-13 until the review pass of that day, an arithmetic slip the suite
now makes impossible, and the "What is in breach" cell below went on reading seventeen against a
heading that said fifteen until Story 2-27 corrected it); zero Tab stops whose ring
is clipped within its reach (**one until 2026-09-23**, the skip-link, by the viewport's edge, until
Story 2-32 parked it one ring-reach inside the corner; **six until 2026-09-21**, the two
home nav links and the three contact links having been clipped by their panels' `clip-path` until
Story 2-29 padded those panels without moving a polygon); zero elements whose weight the browser
synthesises (**two until 2026-09-23**, `.work-item__initiative`, one per route on `/work` and `/cv`,
when Story 2-31 rebuilt `WorkItem.scss` and the line stopped asking Geist Mono for a weight the face
does not publish, the fourth of the rebuilds to land); and zero routes with no level-1 heading in
their accessibility tree (**one until 2026-09-23**, the 404, whose numeral and title were paragraphs,
until Story 2-30 gave it the display entrance as its one `<h1>`). The count is in the heading rather than
beside it for the reason KV-4 gives: a register whose entries are titled by their subject alone
tells a reader nothing about scale, and it is the one part of a heading this file allows to move
without treating it as a rename.

**Scope: what the Hub's build ships and what its routes render.** This entry is about the text of
`.next/static/chunks/*.css`, the computed `font-weight` of visible text, the geometry of the focus
ring under a real Tab, and the accessibility tree's headings on the five routes the Hub serves as
HTML. It makes no claim about the Satellites, whose builds this repository cannot read.

**This entry exists because something now sweeps for these.** Until 2026-09-13 the breach was
real and invisible: `epics.md:3053-3061` treats the hallmark anti-patterns as a conformance floor,
UX-DR44 calls an ad-hoc `z-index` a defect, A-1 asks for a visible ring on every interactive
element and A-7 for one `<h1>` per document, and nothing in the repository read the built CSS,
the ring's geometry or the tree for any of it. Story 2-26 installed the instrument and this is
the first reading it produced; its review pass the same day added the clipped rings and the
missing heading, which the first reading had not looked for.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **UX-DR44** (`epics.md:665-669`): no shadows at all, no gradients anywhere, six named z-levels only and an ad-hoc `z-index` is a defect. **UX-DR45** (`:670-676`): no synthesised bold. Both are treated as a conformance floor by Story 2-26's own criteria at `epics.md:3053-3061` and `:3050-3051` | **Decision.** `epics.md`. The contract declares seven levels, not six (`contracts/tokens.css:129-135`); the sweep derives the set from the contract and the miscount is recorded as a finding in `ops/hub-accessibility-pass.md`, not repeated here |
| What is in breach | **Nothing, since 2026-09-23.** Story 2-33 rebuilt `WorkHero.scss`, whose two `2`s had stacked the hero's text and canvas over a scrim Story 2-28 took off the hero, with no `z-index` at all, and deleted `body#work`, the cybercore ground and its grid pair, so the `/work` surface paints the base rule. Until then: **Two z-index literals** in one file: `WorkHero.scss` `2` twice. Three in two files until 2026-09-23: `error-page.scss`'s `2`, on the 404's content wrapper, left with Story 2-30, which deleted the file and wrote `Error404.scss` with no `z-index` at all. Six in three files until 2026-09-21: `HomeLayout.scss`'s `20`, `5` and `3` left with Story 2-29, the `20` by the deletion of a rule no markup matched and the other two as `var(--z-raised)` and `var(--z-base)`. Seven in four files until 2026-09-14: `ScanlineOverlay.scss`'s `10`, which equalled `--z-raised` by value and resolved to nothing, became `var(--z-raised)` with Story 2-28. **Two depth tells** in one file: the cybercore grid as two `linear-gradient` images on `app/app.scss`'s `body#work`. Four in two files until 2026-09-23: `error-page.scss`'s `.error-page` pair left with Story 2-30, deleted rather than tokenised, the rebuilt surface painting no ground of its own over the base rule's `var(--black-color)`. Six in three files until 2026-09-21: `HomeLayout.scss`'s `body[id='']` pair left with Story 2-29, deleted rather than tokenised, its ground now `var(--token-bg)`. Eight in four files until 2026-09-14: `ScanlineOverlay.scss`'s `radial-gradient` vignette and `repeating-linear-gradient` scanlines left with Story 2-28. Fifteen in five files until earlier that day: the seven `text-shadow` steps of `glitch-text.scss`'s glitch loop left with Story 2-27 (this cell read "seventeen" from 2026-09-13 until that story, the slip the heading's paragraph records). **No clipped ring** since 2026-09-23: Story 2-32 parked the skip-link one ring-reach inside the viewport's corner, the offset and the stroke summed from their roles, and the sweep reads its ring whole. One until then: the skip-link was parked at `inset-block-start: 0; inset-inline-start: 0` (`SkipLink.scss:33-34` as it stood), so when it was revealed its top and left ring sat past the viewport's edge. Six until 2026-09-21, all on `/`: `.home-panel--nav` and `.home-panel--contact` carried a `clip-path: polygon(...)` bounded by their own border box and no padding, and the two `a.nav-link` and three `.contact-container a` sat flush with the panel's edges, so a 2px ring at 3px offset painted on one or two sides only; Story 2-29 gave `.home-panel` `padding: var(--s-sm)`, 12px, which clears both the ring's reach and the 10px notch, and kept the four polygons byte for byte. **Zero synthesised weights.** Two until 2026-09-23: `WorkItem.scss` asked Geist Mono for `600` on `.work-item__initiative` and the face publishes `400`, on `/work` and on `/cv`; Story 2-31 rebuilt the file against the contract, the line sets no weight of its own, and the `weight` check has no ledger row left. **Zero routes with no level-1 heading.** One until 2026-09-23: the 404 rendered its numeral and its title as `<p>` (`Error404.tsx:62-68` as it stood), so its accessibility tree carried no heading at all; Story 2-30 rebuilt the surface with the display entrance as its one `<h1>`, and the `heading` check has no ledger row left | **Observed 2026-09-13** in `mcr.microsoft.com/playwright:v1.62.1-noble`, by reading the built stylesheets as text, every visible text's computed `font-weight` against `contracts/fonts.css`, every Tab stop's box against its clipping ancestors and the document's edge within the ring's reach, and `getByRole('heading', { level: 1 })` per route. Every occurrence is a row in `ops/hub-accessibility-pass.md` § The exemption ledger |
| Not in breach | Every `z-index` written as `var(--z-*)`: `header.scss` at `--z-sticky`, `SkipLink.scss` at `--z-tooltip`, `SkipControl.scss` at `--z-raised`. No `box-shadow` and no `conic-gradient(` anywhere. Every other visible text on the five routes computes a weight inside its family's published range, or is set in a family the contract does not publish and is listed as a finding rather than judged. The other 33 Tab stops paint their ring whole, the Directory heading rings whole when the skip control moves focus to it, and the other four routes carry exactly one level-1 heading (every route since 2026-09-23, when the 404 gained its `<h1>` with Story 2-30) | **Observed 2026-09-13**, same run. Recorded because a register of breaches that listed every declaration would say nothing |
| Where it is tracked mechanically | `ops/hub-accessibility-pass.md` § The exemption ledger, and `EXEMPTIONS` in `tests/e2e/accessibility-floor.pw.ts`, held equal in both directions by `ops/__tests__/hub-accessibility-pass.test.ts`. The sweep tallies every occurrence per value, property, function, selector or route and holds the sum of the rows' counts equal to it, so an unlisted tell, a stale row and a count that moved each fail naming what moved; the same suite holds every row's cited source lines to carrying the tell, and this heading and the index row to the ledger's sums | **Decision.** This entry is the register; those two are the ledger the build enforces. A row deleted from the ledger without a line changed here is the one drift this file cannot see, which is why the files are listed above individually rather than as a count |
| Status | **Retired** | **Decision.** Retired on 2026-09-23, when the ledger emptied. Open and tolerated from 2026-09-13 until then: recording a breach is not fixing it. Story 2-26's boundaries forbid any restyle, z-index re-levelling or gradient removal in the eight stylesheets Stories 2-27 to 2-34 rebuild, because a repair made here would land outside the story that planned it |
| Ruled by | **The Operator**, at Story 2-26's planning | **Decision.** Asked how the sweeps should be asserted against a Hub already in breach, the Operator ruled for the Story 2-8 mechanism again: the sweep is universal and the known breaches are carried in one dated exemption ledger that can only shrink, with one register entry, rather than the sweep being scoped to what already passes. This register's admission test (`:24-36`) takes an Operator act or a sentence in the breached decision, and UX-DR44 carries no sentence tolerating a literal, so the act is cited and no sentence is invented for it |
| Ruled on | **2026-09-13** | **Decision.** The date of that planning checkpoint, which is also the date this entry was written and the date the breach was first measured. The three coincide here and are still different facts |
| Where the repairs are booked | **By ownership of the file, not by a criterion naming the tell.** Story 2-27 rebuilt `GlitchText` (`glitch-text.scss`, deleted with its row on 2026-09-14), Story 2-28 rebuilt `ScanlineOverlay` (`ScanlineOverlay.scss`, rewritten with its three rows deleted on 2026-09-14), Story 2-29 rebuilt `HomeLayout` (`HomeLayout.scss`, rewritten with its six rows deleted on 2026-09-21), Story 2-30 rebuilt `Error404` (`error-page.scss`, deleted with its three rows on 2026-09-23), Story 2-31 rebuilt `WorkItem` (`WorkItem.scss`, rewritten with its row deleted on 2026-09-23), Story 2-33 `WorkHero` (`WorkHero.scss`) and, by ownership of the `/work` surface, `app/app.scss`'s `body#work` block. The clipped home rings were Story 2-29's with the panels that clipped them, and closed with them on 2026-09-21; the 404's missing heading was Story 2-30's with the surface, and closed with it on 2026-09-23. **The skip-link's clipped ring was booked to Story 2-32 by ownership of the top-of-page chrome alone, and closed with that story on 2026-09-23**, the KV-4 precedent for a row booked by ownership and not by a criterion: `SkipLink` was built by Story 2-13, which is `done`, no redesign story names it, and Story 2-32 is the one that rebuilds the header, the logo and the contact links that sit at the top of every surface. **Not established**: no acceptance criterion in `epics.md` names a `z-index`, a shadow, a gradient, a clipped ring or the 404's heading for any of the seven; each is booked because its story rebuilds the file token-native and a token-native rebuild has no literal to keep. *(Corrected 2026-09-23 by Story 2-30, for its own two: its criteria at `epics.md:3391-3393` do name the 404's one `<h1>` and its ground with no grid overlay, so `heading-404` and `gradient-error-ground` were booked by criterion as well as by ownership; the `z-index` row was by ownership alone.)* | **Observed 2026-09-13**, by reading `epics.md:3069` onwards. The skip-link booking is flagged in Story 2-26's completion report for the Operator to confirm or reassign |
| Opened | **2026-09-13** | **Decision.** The date this entry was written, by Story 2-26, which is also the date the breach was first measured rather than inferred |
| Retired by | **Story 2-33**, the last to land, on 2026-09-23, deleting `z-work-hero` and `gradient-work-ground` in the commit that rebuilt the hero and deleted `body#work`. Story 2-32 went sixth, on 2026-09-23, deleting `clip-skip-link` with the repair of the skip link's parking, which leaves the ledger with no `clip` row. Story 2-27 was the seventh and went first, on 2026-09-14, deleting `shadow-glitch-loop` with `glitch-text.scss`; Story 2-28 went second, the same day, deleting `z-scanline`, `gradient-scanline-vignette` and `gradient-scanline-lines` with the raster; Story 2-29 went third, on 2026-09-21, deleting `z-home-overlay`, `z-home-panel`, `z-home-gem`, `gradient-home-ground`, `clip-home-nav` and `clip-home-contact` with the home surface, which is the largest single movement this entry has recorded; Story 2-31 went fourth, on 2026-09-23, deleting `weight-work-initiative` with `WorkItem.scss`, which leaves the ledger with no `weight` row at all; Story 2-30 went fifth, later on 2026-09-23, deleting `z-error-content`, `gradient-error-ground` and `heading-404` with the 404, which leaves it with no `heading` row either | **Decision.** The sweep makes that unavoidable: a row whose tell the built CSS no longer carries fails as stale, so a story cannot repair a file and leave the exemption behind. Story 2-9, Story 2-15 and Story 2-17 are KV-4's demonstrations that the mechanism works; this entry copies it, and Story 2-27 is its first |
| Retired on | **2026-09-23** | **Observed.** The ledger is empty in `ops/hub-accessibility-pass.md` and in `EXEMPTIONS`, and the sweep passed against it in the pinned image. As first written: filled when the ledger is empty. Verify by reading the ledger, not a stylesheet: the sweep reads what ships, and `ScanlineOverlay.scss`'s `10` was, until Story 2-28 rewrote it on 2026-09-14, the case where a stylesheet read as compliant and the build did not |

### Maintaining the ledger this entry counts

Not an Operator action, so it is not in the table at the foot of this file: this is work the
closing stories already own. It is written here instead, beside the count it keeps true.

**A repair moves four things and a change to fewer than four is a defect:**

1. the row in `ops/hub-accessibility-pass.md` § The exemption ledger,
2. the entry in `EXEMPTIONS` in `tests/e2e/accessibility-floor.pw.ts`,
3. the file named in the "What is in breach" cell above, and
4. **the KV-6 heading and index row at the top of this file**, whose counts and closing stories
   `ops/__tests__/hub-accessibility-pass.test.ts` holds against the ledger's own rows.

The first two are held equal by that suite; the suite reads the closing stories off the ledger and
holds both this entry and the index row to naming every one of them and no other, and sums the
ledger per kind of row and holds the heading and the index row to carrying each sum spelled out;
the third is prose and is the reason the files are listed individually above rather than as a bare
number.

**The last story to land retires the entry**: fill `Retired on`, set `Status` to `Retired`, and
bring the index row into line.

---

## Pending Operator actions

This file hands the Operator decisions it is not entitled to take. They are tracked here rather
than left in prose, in the shape `ops/capacity-measurement.md:341-350` uses.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Choose a measurement-week mitigation**, option 1 or option 2 under KV-1 | Operator | Neither is chosen here. Option 1 costs nothing under the standing merge policy. Not choosing is in effect option 1 held by habit rather than by decision, which is the state this row exists to end | **2026-08-25, moot.** No mitigation was chosen and none was needed: the window closed at 2026-08-24T21:00Z with no deploy inside it, so option 1 held by fact. `ops/capacity-measurement.md` Pending Operator action 4 recorded "None did" at 2026-08-25T00:33:34Z, and `gh run list --workflow deploy.yml` shows a failed run on 2026-08-16 and the next on 2026-08-27, none between (re-read 2026-09-24). Closed on the Operator ruling of 2026-09-24; the expiry line heads § Its live interaction with the capacity measurement week |
| 2 | **Rule on the `deploy.yml` hazards in `deferred-work.md`**: no `concurrency` group, CI not blocking the deploy, the self-serve `placements` log | Operator | Whether each is a violation admitted here or stays deferred work. Story 1-9 was scoped to KV-1 only and did not ask | **2026-09-24.** Operator ruling 2026-09-24: none of the three is admitted here. **No `concurrency` group**: fixed by DW-93 in `b0aeaff`, a `deploy` group that queues rather than cancels, and the box reset to the pushed sha rather than to `origin/main`. **CI not blocking the deploy**: closes when the eight checks, the seven `ci.yml` jobs and Lighthouse, are made required on `main` at the Epic 2 merge, since `main` takes a change only through a pull request with admins included; its ledger entry stays open until the setting is observed. **Observed 2026-09-25T08:22:04Z:** all eight required, `strict` false (DW-172 closed). **The self-serve `placements` log**: tolerated while one Operator merges every change to `main`, which makes widening the gate a reviewed act; it reopens with a second person who can merge. The three Story 1-4 ledger entries carry the same dispositions |
| 3 | **Retire KV-1 and date it** | Story 3-4 | An acceptance criterion of that story (`epics.md:3962-3965`). Fill `Retired on`, set `Status` to `Retired`, then bring the index row into line. **Since 2026-09-13 the entry has a `list-wheel` half that Story 4-3 retires**, so whichever of the two lands second is the one that sets `Status`; the first fills its own date and leaves the entry `Open`. No new action is added for the second half: the ruling that tolerates it is taken, and its closer is booked | _not done_ |
| 4 | **Mark the measurement-week section expired** | Story 1-5 close-out | Due on or after 2026-08-24T21:00Z. The rest of KV-1 stays open | **2026-09-24.** The expiry line heads § Its live interaction with the capacity measurement week, written on the Operator ruling of that day; the window closed at 2026-08-24T21:00Z with no deploy inside it. The rest of KV-1 stays open |
| 5 | **Rule on each of `cs-tracker`, `cs-tournament` and `Mutuo`**: publish it, or record that it stays private (KV-2) | Operator | Three separate calls, not one. Each turns on that repository's contents. A "stays private" ruling retires nothing on its own: it moves that entry into the same category as `StreamVault`, and KV-2 retires when all three have been ruled either way | **2026-09-24.** Ruled per repository on the Operator's ruling of that day (scan the full history, publish the clean ones): `cs-tournament` published after a clean gitleaks scan, answering 200 anonymously; `cs-tracker` and `Mutuo` kept private by decision because the scan found secrets in their histories. Each ruling is in `ops/registry-verification.md` § Sources tolerated, and KV-2 retired the same day |
| 6 | **Retire `covidmap.cuatro.dev` and `future-vizion.cuatro.dev`** (KV-3) | Operator | Delete both Cloudflare CNAMEs and the `_vercel` TXT record. The two repositories stay public and unarchived; only the hostnames go. Verify by DNS lookup, not by loading the page. **Exact steps, written 2026-09-24:** Cloudflare dashboard, zone `cuatro.dev`, DNS, Records: delete the CNAME `covidmap` (target `b1f36414641d604e.vercel-dns-017.com`, DNS only), the CNAME `future-vizion` (target `75207fd2296392d3.vercel-dns-017.com`, DNS only) and the TXT `_vercel` (content beginning `vc-domain-verify=future-vizion.cuatro.dev,`), the three rows `ops/routing-inventory.md` § The whole zone, all 26 records lists. After the 600 s TTL, `nslookup covidmap.cuatro.dev 1.1.1.1` and `nslookup future-vizion.cuatro.dev 1.1.1.1` must each answer that the name does not exist, and `nslookup -type=TXT _vercel.cuatro.dev 1.1.1.1` must find no record. Then KV-3's `Retired on` takes the date of that lookup, its index row follows, and this row is dated. **Superseded 2026-09-26 by listing** (Operator ruling 2026-09-25): KV-3 retired by membership, and no record is deleted. **Re-read 2026-09-24:** both names still resolve to Vercel, `covidmap` to `64.29.17.1` and `216.198.79.1`, `future-vizion` to `216.198.79.65` and `64.29.17.65`, and the TXT answers. **Amended 2026-09-25** (Operator ruling 2026-09-24): Vercel leaves the estate, and this is the first step of its decommission. The two Vercel projects behind these names are deleted only after this lookup answers, as `ops/estate.md` § The Vercel decommission step 2 sets out, so no name is ever left pointing at a deleted project; the row stays the Operator's until the lookup. **Re-read 2026-09-25:** both names resolve to `64.29.17.65` and `216.198.79.65` and answer 200 from Vercel, and the TXT answers | **2026-09-26, superseded by listing.** Operator ruling 2026-09-25 put both applications in the Registry as `Live` (1.5.0), which retired KV-3 by membership. The three records stay, and deleting them now would break two published `live` URLs. Not performed, and never to be |
| 7 | **Clear the GitHub Pages CNAME on `future-vizion`** | Operator | In the same pass as action 6. Pages holds `future-vizion.cuatro.dev` as its custom domain, shadowed today by the Vercel DNS record. Removing only the Cloudflare record leaves Pages ready to re-serve the name. **2026-09-24: still open, and the Operator's.** The records-and-docs package's `gh` call to clear it was refused by its permission gate and was not retried. Re-read that day by `gh api repos/LuigiEspinosa/future-vizion/pages`: `cname` `future-vizion.cuatro.dev`, a legacy build from `main` at `/`, and `main` carries a 24-byte `CNAME` file. **Exact steps:** GitHub, `LuigiEspinosa/future-vizion`, Settings, Pages, Custom domain, Remove. If the `CNAME` file is still on `main` afterwards, delete it in the same pass, so a later rebuild cannot restore the name. Then `gh api repos/LuigiEspinosa/future-vizion/pages --jq .cname` prints `null`, and this row takes that date | **2026-09-25.** Cleared by the orchestrator in its own session on the Operator's ruling of 2026-09-02, re-approved 2026-09-24: `gh api -X PUT repos/LuigiEspinosa/future-vizion/pages` with `{"cname": null}`, after which the Pages API read `cname` back as `null`, and GitHub removed the `CNAME` file itself in commit `360f9f1` ("Delete CNAME", 2026-09-25T00:02:53Z) on `future-vizion`'s `main`. Action 6's DNS deletes are still the Operator's |
| 8 | **Rule on `Logo.tsx:7`, which no story listed as under the floor** | Operator | Story 2-32 names `Logo` in its title and is booked as the closer, so this is recorded rather than asked as a blocker. **Overtaken 2026-09-23**: Story 2-32 repaired the link rather than leaving it for a ruling, so the question whether it was worth repairing has no subject left; the cell below stays `_not done_` because no ruling was made, and the Operator may close it. It is raised because the logo link is the one surface the plan did not know about, and because its effective target (a 184 x 66 image) is larger than its measured box, which is a reasonable thing to rule is not worth repairing | **2026-09-23, moot**, closed on the Operator ruling of 2026-09-24. Story 2-32 rebuilt the logo as a text wordmark held to the floor (`18f7a9d`), so whether `Logo.tsx:7` was worth repairing needed no ruling: `tests/e2e/hit-target-floor.pw.ts` records `chrome-logo` leaving the ledger that day, and KV-4 retired with it |
| 9 | **Rule on whether the three ledger rows with no acceptance criterion of their own need one** (KV-4) | Operator | `chrome-logo`, `home-nav` and `home-contact` are booked to Story 2-32 by Story 2-8's boundaries rather than by any criterion in `epics.md`, and the home nav links are authored in `HomeLayout.tsx`, whose redesign is Story 2-29. Either 2-32's criteria widen to name them or 2-29 takes the home pair. Left as a question rather than answered, because moving a story's acceptance criteria is not a register's call. **2026-09-21: 2-29 took the home pair and repaired it.** `home-nav` was forced by the instrument: its display step took the first nav link past the floor, the sweep reported that row stale, and a row cannot go half stale. `home-contact` was not forced, and was ruled rather than derived. **Operator ruling of 2026-09-21, taken after the audit of Story 2-29 separated the two rows.** `home-nav` was **forced**: the display step alone took the first nav link to 296.00 x 68.75 and the sweep reported the row stale, and a row cannot go half stale. `home-contact` was **elective**: nothing made those three links clear the floor, and setting `min-block-size` on them was a choice. The Operator ruled to keep both, so all five hero links hold `min-block-size: var(--tap)` and both rows stay deleted, and ruled Pending Operator action 9 answered by Story 2-29 for the home pair, open for `chrome-logo` alone. So the question is **answered for the home pair** and **stays open for `chrome-logo`**, which is Story 2-32's by ownership alone and is untouched. The cell below stays `_not done_` deliberately: this file reserves a date for an action that is performed, and two of its three rows are not the whole of it. **2026-09-23: the third row closed too**, when Story 2-32 took `chrome-logo` as booked and repaired it, so no row with no criterion of its own is left to rule on; the cell stays `_not done_` because the Operator made no ruling, and it is theirs to close | **2026-09-23, moot**, closed on the Operator ruling of 2026-09-24. All three rows the question named were repaired, `home-nav` and `home-contact` by Story 2-29 and `chrome-logo` by Story 2-32 (`18f7a9d`), and KV-4 retired on 2026-09-23, so no row without a criterion of its own is left to rule on |
| 10 | **Rule on KV-7**: proxy `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` through Cloudflare, or accept both DNS-only as standing | Operator | Proxying is the Cloudflare dashboard's orange cloud on each CNAME, which puts both under the zone's bot rules and Cloudflare's edge certificate; Vercel's own documentation advises against a proxy in front of it, so the choice is not free. Accepting it records a date here and moves KV-7's `Retired by` from `unassigned` to "nobody, by decision". Either way, nothing in this repository changes | **2026-09-26.** Ruled by the Operator in session: accept both DNS-only as standing; no proxy is turned on and nothing in this repository changes. KV-7 reads open and accepted as standing, retired by nobody, by decision |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the
ISO 8601 UTC completion date and leave the row in place. Deletion is not used, here or anywhere
else in this file: which breach was tolerated over which period, and on whose ruling, is exactly
what a later reader needs when a decision is questioned. A retired entry keeps its full table
with `Status: Retired` and a `Retired on` date, and `epics.md:3962-3965` makes that binding on
Story 3-4 rather than optional.

**When a citation drifts.** Every line number in this file was verified on 2026-08-18 against
the working tree as this file was committed, which is `6caac0b` plus this story's own two files.

**Amended 2026-08-24.** Story 1-7 rewrote and reordered `ops/routing-inventory.md`, which
invalidated every line-number citation into it that this file carried: `:24-29`, `:166`,
`:170-171`, `:177-187`, `:185-187` and `:202-209`. Each has been amended in place rather than
deleted, and each now **names the heading first and gives the dated line number second**, which
is the shape the note above about `ops/capacity-measurement.md` already prescribes. One heading
changed its text as well as its position: "Where the deploy actually goes" is now "Where the
deploy goes", and the amended citations say so. No citation into any other file was affected,
and no other cell in this file was touched.

A citation that no longer lands is amended in place: follow the
heading or the quoted text, write the new line number, and re-date the cell. Do not delete the
citation and do not leave a number that points at the wrong line, because a citation that drifts
silently is worse than none. Amend the cell rather than rewriting the entry, so the entry's
history stays readable.
