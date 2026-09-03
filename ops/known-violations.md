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
closed that half on 2026-08-17.** The record below is what is true on 2026-08-18.

| Half | State on 2026-08-18 | Owner |
|---|---|---|
| The deploy step name | **Resolved 2026-08-17.** The step at `.github/workflows/deploy.yml:45` is named **"Deploy over SSH to SERVER_HOST"**. It names no provider, because the workflow cannot verify which provider the secret resolves to | Story 1-21, closed |
| `SERVER_HOST` | **Resolved 2026-08-17.** Repointed to `177.7.52.248`, the box the rest of the estate serves from. `ops/routing-inventory.md` carries it under the heading **"Where the deploy goes"**, in the two rows `SERVER_HOST before 2026-08-17` and `SERVER_HOST after` (`:1489-1490` as of 2026-08-24) | Story 1-21, closed |
| The `tech` array value | **Open.** `content/projects.ts:30` still lists `'Hetzner VPS'` in `digital-library`'s `tech` array. This is the **one surviving stale Hetzner claim** in the estate's source | **FR-9, in Epic 2.** `epics.md:109-114` narrows FR-9 to exactly this one value. Not this story's to correct, and not a file this story touches |

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
