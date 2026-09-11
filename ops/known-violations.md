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
without that call would be inventing a decision rather than recording one.

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
| KV-1 | The serving box compiles | AD-8 | **Open**, tolerated deliberately | 2026-08-18 | Story 3-4 (Epic 3) | _not retired_ |
| KV-2 | Four Registry `source` links resolve for nobody but the Operator | FR-10, SM-4 | **Open**, tolerated deliberately | 2026-09-02 | unassigned | _not retired_ |
| KV-3 | Two applications serve on `cuatro.dev` from outside the Registry | AD-6 | **Open**, tolerated deliberately | 2026-09-02 | unassigned | _not retired_ |
| KV-4 | Seven controls ship under the 44x44 hit-target floor | AD-19 (A-4), FR-3 | **Open**, tolerated deliberately | 2026-09-06 | Stories 2-30 and 2-32 | _not retired_ |
| KV-5 | Thirty-six elements sit past the right edge at 360px, clipped rather than absent | AD-19 (A-5), FR-3 | **Open**, tolerated deliberately | 2026-09-06 | Stories 2-31, 2-33 and 2-14 | _not retired_ |

---

## KV-1: The serving box compiles

**Scope: the Anchor's own deploy workflow, and nothing else.** AD-8 binds every deployed
application, and the three Satellites (`cs-tracker`, `cuatro-tracker`, `digital-library`) deploy
from their own repositories with their own workflows, which this repository cannot read. This
entry records the breach in `.github/workflows/deploy.yml` in `cuatro-portfolio`. Whether any
Satellite also compiles on the box is unestablished, and is claimed neither way here.

| Field | Value | Nature |
|---|---|---|
| Rule breached | **AD-8**, "Build in CI, push to GHCR; the box never compiles" | **Decision.** `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md:124-128`. AD-8 names the current `deploy.yml` a standing violation of itself until Epic 3 |
| Offending line | `docker compose --env-file .env.production up --build -d --remove-orphans` | **Observed 2026-08-18 at `6caac0b`**, by reading the file. `.github/workflows/deploy.yml:56`, inside the `appleboy/ssh-action` step that begins at `:45`. `--build` is the whole of the breach |
| What makes it fire | `push: [main]` | **Observed.** `.github/workflows/deploy.yml:4-5`. Every merge to `main` starts a deploy, and a deploy that reaches the box compiles. It does not always reach the box: the Capacity Gate at `:30-31` runs first, is blocking, and carries no `continue-on-error` and no skip condition, so a merge it refuses never gets as far as the SSH step |
| Where it compiles | The box at `177.7.52.248`, 2 vCPU | **Observed 2026-08-17** by SSH during Story 1-21 and **re-confirmed 2026-08-24** by Story 1-7, recorded in `ops/routing-inventory.md` under the heading **"The box"** (`:129-148` as of 2026-08-24). Since Story 1-21 repointed `SERVER_HOST` that day, this is the machine serving all six live hostnames |
| The risk, as research stated it | Compiling on a serving two-core box is **the estate's top unmeasured risk** | **Decision, carried from research into AD-8's `Prevents` line** and restated as forced change C-8 at `ARCHITECTURE-SPINE.md:435`. **It stays unmeasured after the measurement week closes.** The week measures serving, and both mitigations below exist precisely to keep a build out of its readings. What would measure the build cost is a timed build run on the box deliberately, outside the window, and no story has scheduled one |
| Also tracked as | Forced change **C-8** | **Decision.** `epics.md:1449`, in Story 1-9's acceptance criteria, is what names `ops/known-violations.md` as where C-8 is tracked. `epics.md:725` books C-8 to Epic 1 as a tracked item but names no file |
| Status | **Open and tolerated** | **Decision.** Whose decision and when is the `Ruled by` and `Ruled on` pair below, not this cell. Recording a violation is not fixing it |
| Ruled by | **AD-8 itself**, not a separate Operator act | **Decision.** AD-8's closing sentence at `ARCHITECTURE-SPINE.md:128` says the current `deploy.yml` "is a standing violation of this rule until then", which is the architecture tolerating the breach in advance. No separate Operator ruling was sought or given, and this register does not invent one |
| Ruled on | **2026-08-15**, the date of the architecture carrying the ruling | **Decision.** The architecture folder is `architecture-cuatro-portfolio-2026-08-15`. The date the ruling was written down in this file is a different fact and is the `Opened` cell below |
| Opened | **2026-08-18** | **Decision.** The date this entry was written, by Story 1-9 |
| Retired by | **Story 3-4**, deploy by pulling a tag with `docker-rollout` | **Decision.** `epics.md:3923-3930`, which names itself as closing C-8 and the item Story 1-9 opened. It depends on Story 3-3, which is what first puts an image in GHCR |
| Retired on | _not retired_ | Filled by Story 3-4 with an ISO 8601 UTC date. `epics.md:3962-3965` makes that an acceptance criterion of that story, and forbids deleting this entry instead |

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

**Today the compile is the smaller half of what a merge to `main` would cost, and that is the
part a reader of this entry alone would miss.** `ops/routing-inventory.md`, under the heading
**"Where the deploy goes"** (`:1479-1530` as of 2026-08-24, and the heading lost the word
"actually" when Story 1-7 rewrote and reordered the file), records the rest: the box's checkout
carries `docker-compose.yml` and
`docker/Dockerfile` modified in place, the corrected versions are committed on `dev` and not on
`main`, and `deploy.yml:55` runs
`git reset --hard origin/main` before the compose line. A deploy from `origin/main` as it stands
would discard those working files, recreate the shared-network name collisions, and contend for
the ports `cs-tracker-caddy-1` holds. **The blast radius is the whole estate, not just the
Anchor.** That hazard belongs to `ops/routing-inventory.md` and is cited rather than restated
here, but it changes how the mitigation below must be read: **avoiding a merge to `main` is
load-bearing for that reason first and for the measurement week second.** It does not stop being
load-bearing when the window closes on 2026-08-24T21:00Z. It stops when Epic 1 closes and `dev`
reaches `main`, which is the same event that expires the section cited.

### Its live interaction with the capacity measurement week

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
| Status | **Open and tolerated** | **Decision.** Recording the breach is not repairing it |
| Ruled by | **The Operator**, during Story 2-4's planning checkpoint | **Decision.** Asked whether to make the three public or record the breach, the Operator chose to record it. No separate architectural sentence tolerates this one, unlike KV-1, so the ruling is an Operator act and is cited as one |
| Ruled on | **2026-09-02** | **Decision.** The date of that checkpoint, which is also the date this entry was written. The two coincide here and are still different facts |
| Opened | **2026-09-02** | **Decision.** Written by Story 2-4 |
| Retired by | **`unassigned`** | **Decision.** No story is scheduled to change any repository's visibility. `ops/known-violations.md` admits an entry on `unassigned` precisely so a tolerated breach nobody has scheduled a fix for is written down rather than kept out. It becomes a standing question for the Operator, carried in the pending table below |
| Retired on | _not retired_ | Filled when **all three** repairable repositories have been ruled either way, each either public or recorded as permanently private, which is what pending action 5 tracks. A single ruling retires nothing on its own. `StreamVault` is already in the second category and is not one of the three |

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
| The ruling | **Excluded from the Estate and from the Registry; the two subdomains are retired** | **Decision**, taken by the Operator at Story 2-4's planning checkpoint. They predate the Ecosystem, appear in no PRD section, architecture invariant or epic, and adding them would expand the Estate's scope by a decision Story 2-4 was not chartered to take |
| Why exclusion needs a retirement to be honest | There is no `status` that admits them without rendering them | **Decision.** Both really are live, so the only truthful `status` is `Live`. **FR-35 renders `Live` and `Complete`** (`contracts/registry.schema.json:59`, `epics.md:86`), so `Complete` would render them too, and the only values that hold an entry back are `In progress` and `Archived`, each of which would be false. No truthful value keeps them out. Retiring the subdomains removes the fact that creates the breach, which is the one resolution AD-6 does not treat as omission |
| What retirement means concretely | Delete the two Cloudflare CNAME records, and the `_vercel` TXT record that verifies `future-vizion` | **Decision.** `ops/routing-inventory.md:180-181` carries both CNAMEs and `:195` the TXT record. The repositories are not archived, deleted or made private by this: only their `cuatro.dev` hostnames go. `future-vizion` also has a GitHub Pages CNAME set to the same hostname (**observed 2026-09-02** by `gh api repos/LuigiEspinosa/future-vizion/pages`), which is currently shadowed by the Vercel DNS record and should be cleared in the same pass, or Pages will re-serve the name |
| Status | **Open and tolerated** | **Decision.** The ruling is taken; the DNS change is not made. Until it is, both hostnames serve and the breach is live |
| Ruled by | **The Operator**, during Story 2-4's planning checkpoint | **Decision.** Story 1-7 declined to take it, correctly: `ops/routing-inventory.md:1605` records that this is "a Registry membership decision under AD-6, owned by Story 2-4, not by an enumeration" |
| Ruled on | **2026-09-02** | **Decision.** The date of that checkpoint |
| Opened | **2026-09-02** | **Decision.** Written by Story 2-4. The breach itself is older: it was observable on 2026-08-16, when Story 1-7 first found both hostnames in the zone |
| Retired by | **`unassigned`** | **Decision.** No story owns the DNS change. Epic 4 rebuilds the estate's routing wholesale and would incidentally settle it, but no acceptance criterion there names these two hostnames, so booking it to Epic 4 would be inventing a commitment. It is carried as an Operator action below instead |
| Retired on | _not retired_ | Filled when both hostnames stop resolving. Verify with a DNS lookup, not by loading the page: a cached certificate or a browser's HSTS state can outlive the record |

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

---

## KV-4: Seven controls ship under the 44x44 hit-target floor

**The count in this heading moved on 2026-09-08, and the index row moved with it in the same
change**, which is what this file's own rule requires of a derived row. It read thirteen from
2026-09-06 until Story 2-15 repaired the six chrome nav links and deleted their ledger row. The
count is in the heading rather than beside it because a register whose entries are titled by their
subject alone tells a reader nothing about scale, and it is the one part of a heading this file
allows to move without treating it as a rename.

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
| What is in breach | **Seven authored controls**, rendering as **9 of the 37 elements the sweep measures**: one logo link, one 404 back link, two home nav links and three home contact links | **Observed 2026-09-10** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by `getBoundingClientRect()` after fonts resolved. Every size is in `ops/hit-target-floor.md` under "The exemption ledger", per element. **Fifteen controls and 39 of 43 elements when this entry was opened**: Story 2-9 deleted the two `.project-card__links` controls, rendered six times each on `/projects`, along with the component that carried them. **Thirteen controls and 27 of 54 after that**, until Story 2-14 redirected `/projects` on 2026-09-07: no authored control was repaired or removed, and the seven chrome controls were simply rendered on two surfaces rather than three, which read **20 of 36**. **Seven controls and 8 of 28 from 2026-09-08**: Story 2-15 rebuilt the six chrome nav links to `--tap` on both axes and deleted `chrome-nav` in the same commit, so that is the first movement in this cell that is a repair rather than a deletion or a route. **Seven controls and 9 of 37 since 2026-09-10**: Story 2-16 built `/cv`, which renders the same header, so the logo link is rendered on a third surface. The authored count is unchanged and this is a route rather than a regression, which is why the heading above did not move |
| The shape of the breach | **Height, everywhere.** All seven clear the floor on width and fail on height, at 20.00 to 38.19px tall | **Observed 2026-09-08**, same method. The nearest miss is `a.error-page__back` at 108.58 x 38.19, 5.81px short. **Until 2026-09-08 one of the thirteen failed on both axes**, the chrome `Blog` link at 38.41 x 22.00, and it is the one control in the whole census that ever has; Story 2-15 removed the link rather than widening it, the header now carrying two destinations and neither of them a blog that has no route on disk. The 17.00px lower bound in the opening reading was the two card links, which are gone |
| Not in breach | The `button.work-item__header` controls at 216.00 x 88.80, the eleven Suite Directory links on `/`, the A-6 skip link Story 2-13 added, the chrome nav links Story 2-15 rebuilt, and the two intro links Story 2-16 authored on `/cv`. Twenty-two directory links until 2026-09-07, eleven on each of the two surfaces the directory rendered on, until Story 2-14 left it rendering on one. **Four accordion triggers and four nav links until 2026-09-10, eight and six since**: Story 2-16 mounted the same timeline and the same header on `/cv`, so both are rendered on one more surface | **Observed 2026-09-10.** Recorded because a register of breaches that listed every control would say nothing, and because the sweep asserts at least one measured element clears the floor so the comparison discriminates. The directory's links are the first controls in the Hub authored against the floor rather than exempted from it, and the chrome nav links are the first that were **moved** from one side of this cell to the other |
| Where it is tracked mechanically | `ops/hit-target-floor.md` § The exemption ledger, and `EXEMPTIONS` in `tests/e2e/hit-target-floor.pw.ts`, held equal in both directions by `ops/__tests__/hit-target-floor.test.ts` | **Decision.** This entry is the register; those two are the ledger the build enforces. A row deleted from the ledger without a line changed here is the one drift this file cannot see, which is why the surfaces are listed above individually rather than as a count |
| Status | **Open and tolerated** | **Decision.** Recording a breach is not fixing it. Story 2-8's boundaries forbid changing any component or stylesheet, because a repair made here would land outside the story that planned it and outside that story's own criteria |
| Ruled by | **The Operator**, at Story 2-8's planning | **Decision.** Asked how the floor should be asserted against a Hub already in breach, the Operator ruled that the sweep is universal and the known breaches are carried in a dated exemption ledger that can only shrink, rather than the sweep being scoped to what already passes. That ruling is what tolerates these fifteen. This register's admission test (`:24-36`) takes an Operator act or a sentence in the breached decision, and AD-19 carries no such sentence, so the act is cited and no sentence is invented for it |
| Ruled on | **2026-09-06** | **Decision.** The date of that planning checkpoint, which is also the date this entry was written and the date the breach was first measured. The three coincide here and are still different facts |
| Where the repairs are booked | **One of the four remaining ledger rows is booked by an acceptance criterion that names this floor; three are booked by ownership only** | **Observed 2026-09-06**, by reading `epics.md`, and re-read **2026-09-08**. Verified: `:3441-3442` requires the 404 exits at 44x44 on both axes measured in a browser (Story 2-30). Two such rows **have landed**: `:2399-2401` for the directory's two links, closed by Story 2-9, and `:2655-2658` for the chrome nav links, closed by Story 2-15 on 2026-09-08. **Not established**: no acceptance criterion in `epics.md` names the floor for the chrome **logo**, the **home nav links** or the **contact links**. Story 2-32 names `Logo` and `ContactContainer` in its title (`:3559`) and its floor criterion at `:3576-3584` is written about the **nav links**, which Story 2-15 has now repaired, so that criterion arrives at a surface already meeting it; the home nav links live in `HomeLayout.tsx`, whose redesign is Story 2-29, which names no floor criterion at all. Those three rows are booked to Story 2-32 by Story 2-8's own frozen boundaries, not by a criterion in the epic |
| Opened | **2026-09-06** | **Decision.** The date this entry was written, by Story 2-8, which is also the date the breach was first measured rather than inferred |
| Retired by | **Stories 2-30 and 2-32**, each deleting its own ledger row in the commit that repairs its surface. **Stories 2-9 and 2-15 have done so**, on 2026-09-06 and 2026-09-08 | **Decision.** The sweep makes that unavoidable: a listed element that starts clearing the floor fails as a stale row, so a story cannot repair a surface and leave the exemption behind. Story 2-9 is the demonstration that the mechanism works rather than merely being described, and Story 2-15 is the demonstration that it works on a story that had to hit it: `chrome-nav` was the row its own acceptance criteria named. The three rows with no criterion of their own are the ones most likely to be missed, and they are the reason the row above says so plainly rather than claiming uniform coverage |
| Retired on | _not retired_ | Filled when the ledger is empty. Verify by reading the ledger, not by reading a stylesheet: this is the floor `EXPERIENCE.md:731-732` says is the single easiest one to miss while appearing to be met |

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
expected. Seven remain, and the logo is one of them: Story 2-15 repaired the six nav links beside it
on 2026-09-08 and left it exactly as it was, which is what its own `closedBy` cell predicted.

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

## KV-5: Thirty-six elements sit past the right edge at 360px, clipped rather than absent

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
| What still breaches it | **The component half, on `/work` alone.** 28 elements sit outside the viewport at 360, clipped rather than absent, and the stylesheet no longer has anything to do with why | **Observed 2026-09-06** in the pinned container, after the repair, as 36 across two routes. **Narrowed 2026-09-07** by Story 2-14, which redirected `/projects` and deleted the hero that rendered eight of them, so the elements ceased to exist rather than being repaired. The census is in `ops/hit-target-floor.md` § The overflow this assertion does not cover. **Not re-read on 2026-09-10, when Story 2-16 mounted the same `WorkTimeline` on `/cv`**: every one of the 28 comes from `WorkItem.scss`, so the same overflow is very likely rendered on a second surface and "very likely" is not a measurement. The standing A-5 assertion passed on that date with `/cv` swept, so no **interactive** element's edge is outside the viewport there and no new breach is asserted. Filed as **DW-72** |
| What is actually outside the viewport | **28 elements**, all on `/work`, furthest `span.work-item__icon` at **490.67** against a 360 viewport. `/`, `/celeste` and the 404 are clean, `/` included after the Suite Directory landed on it | **Observed 2026-09-06** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by comparing **every element's right edge** against `window.innerWidth`. **Re-measured 2026-09-06** after Story 2-9, both edges this time: the count was unchanged at **36** and no element sat past the left edge on any route, so 36 was the number rather than a floor on it. **Reduced to 28 on 2026-09-07 by arithmetic rather than by measurement**: Story 2-14 deleted the `/projects` route whose eight elements, furthest `div.projects-hero__text` at **372.00**, made up the rest. There is no surface left to re-measure them on |
| Why it is invisible without measuring | On `/work` there is no clipping ancestor and the root reading is **360**, now that `overflow-x: clip` propagates to the viewport; `document.body.scrollWidth` still reports **491** there, which is a second box rather than a second answer. On `/projects`, while it existed, the eight sat 12px past the edge while `document.scrollingElement.scrollWidth` read **360**, because the hero's own `overflow: hidden` (`ProjectsHero.scss:9`) clipped them | **Observed 2026-09-06**, same method, before and after the repair. A `scrollWidth` check would have been green on `/projects` while the condition it exists to detect was present, which is why Story 2-8 asserts A-5 on element edges. That argument is kept although the route is gone: it is the reason the instrument is shaped the way it is |
| Not caught by the Story 2-8 sweep | None of the 28 is interactive, and that sweep measures interactive elements | **Decision**, recorded rather than widened. `ops/hit-target-floor.md` § What this deliberately does not assert carries it, so a green A-5 is not read as "nothing on the Hub overflows at 360" |
| Status | **Open and tolerated**, on the component half only | **Decision.** Recording a breach is not repairing it, and repairing half of one does not retire the entry. The stylesheet half is closed and the entry says where |
| Ruled by | **The Operator**, at Story 2-8's planning: `app/app.scss` is recorded, not repaired, in that story | **Decision.** The ruling is quoted in that story's frozen boundaries as a Never clause, dated. Story 2-8 ships the instrument and changes no stylesheet |
| Ruled on | **2026-09-06** | **Decision.** The date of that checkpoint, which is also the date the overflow was first measured |
| Opened | **2026-09-06** | **Decision.** Written by Story 2-8 |
| Retired by | **Stories 2-31, 2-33 and 2-14**, which between them own every one of the 36 elements this entry was opened over: 2-31 and 2-33 the 28 on `/work`, and 2-14 the 8 on `/projects`, by redirecting the route that rendered them. **Story 2-14 landed on 2026-09-07** and its eight are gone; 2-31 and 2-33 are what the entry now waits on | **Decision.** Story 2-9 landed the stylesheet half on 2026-09-06 (`epics.md:2423-2427`: "`clip` replaces `hidden`, because `hidden` breaks sticky positioning" and "widths are `100%` with container padding, never `100vw`"), and its own frozen boundaries forbade touching `WorkItem.scss` or `WorkHero.scss`. **The `/projects` eight were unowned until 2026-09-06** and are recorded that way in the table below rather than silently folded into 2-33, whose title scopes it to `WorkHero`: an entry whose closing stories do not cover its own census can never close. Story 2-22 is booked into the same block, deleting the alias layer above it |
| Retired on | _not retired_ | Half the condition is now met: `app/app.scss` no longer sets `100vw` or `overflow-x: hidden`. Fill this when no element sits outside the viewport at 360. Verify by measuring elements, not by reading `scrollWidth`, for the reason two rows above |

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
| The hero grid columns, which measure 300 inside a 216 content box because a grid item's `min-width: auto` refuses to shrink below min-content | `WorkHero.scss:1-9`, with `.container` at `width: min(80%, 1920px)` (`container.scss:2-4`) feeding it | **Story 2-33** | Open |
| The same shape in `ProjectsHero.scss:1-9`, which was the other 8 of the 36 | `ProjectsHero.scss:1-9`, same containing block | **Story 2-14**, which redirects `/projects` to `/#suite`. Nothing renders `ProjectsHero` on any route now and the eight elements ceased to exist rather than being repaired: the component, its stylesheet and the page that mounted it were deleted in the same commit as the redirect. **Assigned 2026-09-06**, having been left unowned: Story 2-9 replaced the card grid beneath the hero and its frozen boundaries forbade touching the hero, Story 2-33 is scoped to `WorkHero` by its own title, and an entry cannot retire while eight of its elements belong to nobody | **Closed 2026-09-07** |
| `.work-item__sub`'s `white-space: nowrap` in a `flex: 1` column, which pushes `.work-item__meta` to 372.38 and the icon to 490.67 | `WorkItem.scss:64` | **Story 2-31** | Open |

Whoever closes the last of those should widen the Story 2-8 sweep's A-5 arm past interactive
elements once the overflow is gone, and retire this entry.

**The measurements, the per-route breakdown and the reasoning are in
`_bmad-output/implementation-artifacts/deferred-work.md`**, filed by Story 2-8 under its own spec.
That entry is the evidence; this one is the ruling. It is cited rather than duplicated, so there is
one place to change when a figure is re-measured.

---

## Pending Operator actions

This file hands the Operator decisions it is not entitled to take. They are tracked here rather
than left in prose, in the shape `ops/capacity-measurement.md:341-350` uses.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Choose a measurement-week mitigation**, option 1 or option 2 under KV-1 | Operator | Neither is chosen here. Option 1 costs nothing under the standing merge policy. Not choosing is in effect option 1 held by habit rather than by decision, which is the state this row exists to end | _not done_ |
| 2 | **Rule on the `deploy.yml` hazards in `deferred-work.md`**: no `concurrency` group, CI not blocking the deploy, the self-serve `placements` log | Operator | Whether each is a violation admitted here or stays deferred work. Story 1-9 was scoped to KV-1 only and did not ask | _not done_ |
| 3 | **Retire KV-1 and date it** | Story 3-4 | An acceptance criterion of that story (`epics.md:3962-3965`). Fill `Retired on`, set `Status` to `Retired`, then bring the index row into line | _not done_ |
| 4 | **Mark the measurement-week section expired** | Story 1-5 close-out | Due on or after 2026-08-24T21:00Z. The rest of KV-1 stays open | _not done_ |
| 5 | **Rule on each of `cs-tracker`, `cs-tournament` and `Mutuo`**: publish it, or record that it stays private (KV-2) | Operator | Three separate calls, not one. Each turns on that repository's contents. A "stays private" ruling retires nothing on its own: it moves that entry into the same category as `StreamVault`, and KV-2 retires when all three have been ruled either way | _not done_ |
| 6 | **Retire `covidmap.cuatro.dev` and `future-vizion.cuatro.dev`** (KV-3) | Operator | Delete both Cloudflare CNAMEs and the `_vercel` TXT record. The two repositories stay public and unarchived; only the hostnames go. Verify by DNS lookup, not by loading the page | _not done_ |
| 7 | **Clear the GitHub Pages CNAME on `future-vizion`** | Operator | In the same pass as action 6. Pages holds `future-vizion.cuatro.dev` as its custom domain, shadowed today by the Vercel DNS record. Removing only the Cloudflare record leaves Pages ready to re-serve the name | _not done_ |
| 8 | **Rule on `Logo.tsx:7`, which no story listed as under the floor** | Operator | Story 2-32 names `Logo` in its title and is booked as the closer, so this is recorded rather than asked as a blocker. It is raised because the logo link is the one surface the plan did not know about, and because its effective target (a 184 x 66 image) is larger than its measured box, which is a reasonable thing to rule is not worth repairing | _not done_ |
| 9 | **Rule on whether the three ledger rows with no acceptance criterion of their own need one** (KV-4) | Operator | `chrome-logo`, `home-nav` and `home-contact` are booked to Story 2-32 by Story 2-8's boundaries rather than by any criterion in `epics.md`, and the home nav links are authored in `HomeLayout.tsx`, whose redesign is Story 2-29. Either 2-32's criteria widen to name them or 2-29 takes the home pair. Left as a question rather than answered, because moving a story's acceptance criteria is not a register's call | _not done_ |

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
