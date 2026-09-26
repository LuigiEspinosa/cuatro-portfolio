# The Estate

The written record of every application under Ecosystem governance: its disposition, its
Status, and where its code lives when the code has moved.

This file is a record, not Registry data. The App Registry is hand authored
`contracts/registry.json`, schema validated in CI, and it arrives in Epic 2 under AD-4.
Epic 2 authors its entries from this file. Nothing here is a published contract surface.

Governing decision: **AD-6, Registry membership is by application, not by repository.**
The Registry's unit is the application. An application that has been archived or absorbed
keeps its entry, with `absorbed_into` naming the application it has been, or is set to be,
folded into (AD-6 as widened on 2026-09-24 by Operator ruling, from "where its code now
lives"). No application is ever dropped by omission.

Source of truth for every row below: PRD section 5.1, Disposition of every repository, in
`_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md`.

## Counts

Recorded **2026-08-16** (ISO 8601 UTC). **Re-examined 2026-09-02 by story
`2-4-confirm-the-assumed-statuses-hostnames-and-tech-values`. The repository count is
unchanged. The application count fell from 15 to 14.** **Re-examined 2026-09-26 on Operator ruling
2026-09-25**, which listed `covidmap` and `future-vizion` in the Registry: both figures rose by two,
the repository count at the waypoint from 11 to 13 and the application count from 14 to 16.

| Count | Value | Nature of the figure |
|---|---|---|
| Repository count under Ecosystem governance | **13** | **Decided waypoint, not an observation.** The observed figure is **14** as of 2026-09-26: the **12** stated exactly on 2026-09-02, plus `covidmap` and `future-vizion`, both public and neither archived, **observed 2026-09-26** by `gh api repos/LuigiEspinosa/<name>`. One archive action is outstanding. See Pending Operator actions. **Was 11** until 2026-09-26 (Operator ruling 2026-09-25) |
| Application count in the Estate record | **16** | Fixed by this record. By AD-6 it does not fall as repositories are archived, and it did not fall for that reason here: one row was never an application. See below. **Was 14** until 2026-09-26, when the two applications KV-3 had kept out were admitted (Operator ruling 2026-09-25) |

**Why the application count fell, and why AD-6 is not weakened by it.** `apple-music-workspace`
was removed from this record on **2026-09-02**, by an Operator ruling. It has no repository,
re-confirmed that day by a full account listing, and it is a local script rather than a
deployed application. AD-5 requires `source` on every Registry entry and FR-10 requires it to
resolve, so no conforming entry could ever have been authored for it.

**This is not an application being dropped by omission, which AD-6 forbids.** AD-6 protects
applications that exist and have stopped running, keeping their entries with `absorbed_into`
naming where the code went. It does not oblige this record to carry a row that was entered
from PRD section 5.1 on an assumption nobody had checked. Confirming that assumption is what
story 2-4 exists to do, and this is the one row it confirmed false. The removal is recorded
here rather than done silently, which is the distinction AD-6 actually cares about.

**Why the re-examination did not move the figures further, which is worth stating because it
nearly did.** Story 2-4 found two applications serving on `cuatro.dev` that appear in no row
of this record, `covidmap` and `future-vizion`, and both have real public repositories.
Admitting them would have added two to each figure. The Operator ruled them **out** of the
Estate and out of the Registry on 2026-09-02, and their subdomains are to be retired instead.
That ruling, its reasoning and the DNS work it requires are **KV-3** in
`ops/known-violations.md`.

**Amended 2026-09-26: the figures did move, by the ruling that reversed that one.** On 2026-09-25 the
Operator first kept both hostnames live on Vercel for sentimental value, then ruled them into the
Registry (Operator ruling 2026-09-25). Both are `Live` entries in Registry 1.5.0 and rows in the
disposition table below, and each figure gained exactly the two this paragraph said admitting them
would add. KV-3 retired by membership, not by DNS deletion, and the DNS work above will not be done.
The paragraph is left as written because it was true of 2026-09-02.

Two further candidates were considered and are not in either figure, for different reasons.
`analytics.cuatro.dev` serves self-hosted Umami, which is infrastructure this estate runs
rather than an application the Registry describes. `ad-analysis.cuatro.dev` is NXDOMAIN on an
archived repository, so nothing serves and there is nothing to admit.

**What the repository count counts:** the number of **non-archived** repositories under
Ecosystem governance. Archiving does not delete a repository. An archived repository stays
in the GitHub account and keeps its Registry entry under AD-6; it simply stops counting
toward SM-7. That definition is what makes 11 a figure a later reader can check rather
than a number to take on trust.

**These two numbers are deliberately different, and neither validates the other.** A
mismatch between them is the design, not a defect. Repository count measures how many
repositories the Operator carries. Application count measures how many applications the
Registry describes. AD-6 keeps archived and absorbed applications in the Registry
precisely so that the count of entries does not fall as the count of repositories does. A
later reader who finds 11 in one place and 14 in another has found the intended state, and
must not reconcile one number against the other. **Amended 2026-09-26**: the two numbers are 13
and 16 since the Operator ruling of 2026-09-25, and the same holds of them.

### 11 against the MVP target

SM-7, Estate size, targets **12 repositories at MVP** and 8 at end state. The recorded
count is 11.

**11 satisfies the MVP target of 12 rather than missing it.** SM-7 is a ceiling on the
number of repositories carried, not a quota to fill, and the end state target of 8 shows
the direction of travel is downward. 11 is below 12 and therefore ahead of the target, not
short of it. A later reader must not read the gap between 11 and 12 as an error.

**On the second apparent mismatch, against PRD section 9.1.** That section scopes MVP as
"Estate reduction to the 12-repository waypoint: three empty shells archived", which is
three archived and 12, while this record reaches 11. The epic is the tie break and it
directs 11 (`epics.md`, Story 1.1, third acceptance block). The difference is
`connect-four-react`, whose PRD section 5 disposition is Absorb, and archiving it is
exactly what turns the 12 waypoint into the 11 waypoint. Both documents describe the same
timeline at different points. This record sits at 11. A later reader hitting the section
9.1 wording has already found the answer here.

**Amended 2026-09-26: the waypoint is 13, and 13 is over SM-7's MVP ceiling of 12.** The Operator
ruling of 2026-09-25 admitted `covidmap` and `future-vizion`, two public repositories that predate
the Ecosystem, so the waypoint count rose from 11 to 13 and the observed count from 12 to 14. The
argument above, that 11 is under a ceiling rather than short of a quota, now cuts the other way: 13
is one over the ceiling, and it stays over it after `connect-four-react` is archived. The ruling wins
over the target, and SM-C2's warning against adding entries to fill the grid does not describe it:
both are real applications serving on the estate's own domain, admitted to end an AD-6 breach.
Whether SM-7's MVP figure moves, or either repository is archived, is the Operator's to rule and is
filed as DW-249.

**Amended 2026-09-02, and the coincidence here is a trap.** Both documents now say *three*
archive actions, and they are not the same three. PRD section 9.1 counts three empty shells,
one of which is `apple-music-workspace` and does not exist. This record counts three real
archives: two empty shells, `Lumen` and `tcg-tracker`, plus the absorbed
`connect-four-react`, which is not a shell. Story 1.1 was written to archive four
repositories and could only ever have archived three. It is `done` and is not reopened by
this: the archives it performed were the real ones, and the fourth was never performable.

### The waypoint sequence

14 to 8 is the decision. 12 and 11 are sequenced stations on the way, not competing
decisions.

**The Count column is governed repositories that are not archived**, which is the definition
under "What the repository count counts" above. A row is reached when its change has been
performed, not when it was decided.

| Point in sequence | Count | What changed | Reached |
|---|---|---|---|
| Start | 14 | n/a | superseded |
| After archiving | 12 | `Lumen` and `tcg-tracker` archived | **yes, by 2026-09-02** |
| After listing | 14 | `covidmap` and `future-vizion` admitted by Operator ruling 2026-09-25 | **yes, 2026-09-26** |
| After absorption | **13** | `connect-four-react` absorbed into the Anchor | not yet |
| End state | 10 | `cuatro-finance`, `cuatro-tracker`, `cs-tournament` merged into the Anchor | not yet |

**Amended 2026-09-26.** The `After listing` row is new, and the two rows below it each carry two more
than they did (11 and 8 until that date): the ruling admitted two repositories and changed nothing
about the absorption or the merge. **The end state reads 10, not SM-7's 8**, because nothing yet
decides whether `covidmap` and `future-vizion` are part of it; that is DW-249 with the MVP figure.

**The estate sits on the second row today**, at an observed 12. The first row is labelled `Start`
rather than `Today` for that reason: it was true until the two archives landed and is now
history.

**The two 12s in this file are different numbers and it is a coincidence that they match.** One
is SM-7's MVP target of 12 repositories, discussed above as a ceiling. The other is the observed
count on this row. That they are equal today says nothing: the target is a decision about what
the estate may carry, the row is an observation of what it does carry, and the estate is heading
to 8 regardless.

**Amended 2026-09-02.** This table read `15` today and named three repositories in the
archiving row, the third being `apple-music-workspace`. That repository does not exist, so
the starting figure counted one repository too many and the archiving step claimed one
archive too many. Both errors cancelled, which is why **every waypoint below the first is
unchanged**: 14 less two archives is the same 12 that 15 less three gave. The end state of 8
never moved. Only the starting count and the archiving row were wrong, and a reader comparing
this table against PRD section 5's "15, 12, 11 and 8" should expect the first number to
differ and the rest to agree.

The 13 repositories at this waypoint are `cuatro-portfolio`, `cuatro-finance`,
`cuatro-tracker`, `cs-tournament`, `cs-tracker`, `digital-library`, `list-wheel`,
`StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo`, `covidmap` and `future-vizion`.

**Amended 2026-09-26 (Operator ruling 2026-09-25).** The sentence named 11 and ended at `Mutuo`.
`ops/contract-adoption.mjs` parses it and pins its count, and both tables in
`ops/contract-adoption.md` carry a row for each name, the two new ones observed that day by the same
`gh api` sweep the record describes.

## Disposition of every application

Sixteen applications (fourteen until 2026-09-26). The Status column is the Status recorded in PRD
section 5.1, except where story 2-4 confirmed it on 2026-09-02 and it differs, and for the two rows
the Operator ruling of 2026-09-25 added, which PRD section 5.1 does not carry. For the three applications whose
Status reads `Archived`, that is the decided disposition: two are archived in fact and
`connect-four-react` is not yet. See Pending Operator actions below.

**Amended 2026-09-02.** `apple-music-workspace` was a fifteenth row here and was removed,
because no repository of that name exists under this owner and no conforming Registry entry
could be authored for it. The reasoning is under Counts above.

**Amended 2026-09-13 by Story 2-25.** The `list-wheel` row read `Live`: on GitHub Pages,
relocating to `wheel.cuatro.dev`, which does not resolve yet. The hostname resolves and serves
since 2026-09-13: the container `list-wheel-list-wheel-1` was placed on the box through the
Capacity Gate (AD-9) at 17:31:32Z, the shared Caddy gained its site block at 17:36:54Z, the
proxied `A` record was created at 17:37:10Z, `https://wheel.cuatro.dev/` answered 200 through
Cloudflare at 17:37Z, and UptimeRobot monitor 803983277 read UP from its first check at
17:38:14Z. The values are in `ops/routing-inventory.md` § What Story 2-25 changed, and the
Registry's `live` moved in the same story (`ops/registry-inputs.md`). GitHub Pages served the
application until that date; its URL became a redirect page to the new hostname as the
story's last step, after the new hostname was verified serving (`gh-pages` `52698eb`,
2026-09-13T18:25:47Z), so the old link never dies (PRD section 5.3).

**Amended 2026-09-25 by Operator ruling 2026-09-24.** The `cs-tournament` row read `Merge into the
Anchor, and migrate off external PaaS` and `Live`: `inclusivcup.vercel.app`. The ruling removed
Vercel from the estate, and nothing deploys there any more: the entry is `Complete` in Registry
1.4.0, with no `live` value, no `Vercel` in its `tech` and `demo` `not-deployed`, and it runs
nowhere until Story 3.7 merges it into the Anchor and places it on the box. `Complete` renders
(FR-35), so it keeps its row in the Suite Directory with its Source link, the repository being public
since 2026-09-24 (KV-2). The Vercel deployment still answered on 2026-09-25 and is deleted last,
after the Epic 2 merge has deployed, because production's Registry links it until then: § The Vercel
decommission, under Pending Operator actions.

**Amended 2026-09-26 by Operator ruling 2026-09-25.** Two rows are added at the foot of the table,
`covidmap` and `future-vizion`, which the Operator ruled out of the Estate on 2026-09-02 (KV-3) and
into it and the Registry on 2026-09-25. Both are `Live` in Registry 1.5.0 and both **stay on Vercel by
Operator choice**, the keep-live decision of 2026-09-25, their DNS records and Vercel projects
untouched. That is a deliberate exception to the ruling of 2026-09-24 that removed Vercel from the
estate, and what it leaves in breach is KV-7 in `ops/known-violations.md`.

| Application | Disposition | Status | `absorbed_into` | Registry treatment |
|---|---|---|---|---|
| `cuatro-portfolio` | Anchor | `Live` | n/a | The Hub itself; rendered |
| `Lumen` | Archive: empty shell | `Archived` | n/a | In Registry, not rendered |
| `tcg-tracker` | Archive, then fold as a domain inside `cuatro-tracker` | `Archived` | `cuatro-tracker` | In Registry, not rendered |
| `connect-four-react` | Absorb: playable demo in the Hub | `Archived` | `cuatro-portfolio` | In Registry; not rendered as a directory entry, and not rendered as an embedded demo at MVP either. It will surface as the embedded demo (PRD section 4.7) only once FR-29 is taken up, and FR-29 is deferred to v2. See the note below. |
| `cuatro-finance` | Merge into the Anchor | `In progress` | n/a today, see note below | Not rendered until Live |
| `cuatro-tracker` | Merge into the Anchor | `Live`: `tracker.cuatro.dev` | n/a today, see note below | Rendered; Tracker Family member |
| `cs-tournament` | Merge into the Anchor | `Complete`: deployed nowhere by the estate since the Operator ruling of 2026-09-24, until Story 3.7 places it on the box. `Live` at `inclusivcup.vercel.app` until then | n/a today, see note below | Rendered |
| `cs-tracker` | Satellite: Elixir/LiveView | `Live`: `cs-tracker.cuatro.dev` | n/a | Rendered; Tracker Family; identity demonstration partner (FR-21) |
| `digital-library` | Satellite: Svelte/Fastify | `Live`: `library.cuatro.dev` | n/a | Rendered |
| `list-wheel` | Satellite: Angular | `Live`: `wheel.cuatro.dev` since 2026-09-13. On GitHub Pages until that date; the old URL became a redirect page to the new hostname as the story's last step (`gh-pages` `52698eb`, 2026-09-13T18:25:47Z) | n/a | Rendered; see PRD section 5.3. **The Registry's `live` is `https://wheel.cuatro.dev` from Story 2-25**: `ops/registry-inputs.md` |
| `StreamVault` | Satellite: Python/Vue | `In progress`: early scaffolding | n/a | In Registry, not rendered until Live |
| `MaiCoin` | Satellite: Solidity/Web3 | `In progress`: early scaffolding | n/a | Not rendered; declared non-participating in identity (FR-24) |
| `poketracker-go` | Satellite: Go | `In progress`: early scaffolding | n/a | Not rendered; Tracker Family |
| `Mutuo` | Satellite | `In progress`: early scaffolding | n/a | Not rendered; already carries demo accounts, a pre-existing asset for FR-25 |
| `covidmap` | Stay Live on Vercel by Operator choice (Operator ruling 2026-09-25); predates the Ecosystem | `Live`: `covidmap.cuatro.dev`, served by Vercel | n/a | Rendered since Registry 1.5.0; KV-7 |
| `future-vizion` | Stay Live on Vercel by Operator choice (Operator ruling 2026-09-25); predates the Ecosystem | `Live`: `future-vizion.cuatro.dev`, served by Vercel | n/a | Rendered since Registry 1.5.0; KV-7 |

End state is the Anchor plus seven Satellites: `cs-tracker`, `digital-library`,
`StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` and `list-wheel`. **Amended 2026-09-26:**
`covidmap` and `future-vizion` are neither Satellites nor merge candidates; whether they belong to the
end state is undecided (DW-249).

### The two `[ASSUMPTION: ...]` Statuses are resolved

**Resolved 2026-09-02 by story `2-4-confirm-the-assumed-statuses-hostnames-and-tech-values`.**
Until that date both cells carried their PRD section 5.1 Status verbatim, as
`[ASSUMPTION: built, not deployed]` and `[ASSUMPTION: Live on Vercel]`, and neither mapped to
a valid Registry status: AD-5 accepts exactly `Live`, `Complete`, `In progress` and
`Archived`, and assumption text is none of them. The table above now carries the confirmed
values.

**No Status cell in this file carries assumption text any more.** It survives only as quoted
history in the `Was` column below, which is deliberate: this record does not delete what it
supersedes, for the same reason `ops/known-violations.md` keeps retired entries. A search for
`[ASSUMPTION:` will therefore still match here, and every match is a quotation of a value that
is no longer in force.

| Application | Was | Is | What settled it |
|---|---|---|---|
| `cuatro-finance` | `[ASSUMPTION: built, not deployed]` | **`In progress`** | An Operator ruling on 2026-09-02, against evidence. The `dev` branch carries 98 blobs of a real Next.js and Prisma application, so "built" is closer to true than the default branch suggests, but nothing is deployed: `finance.cuatro.dev` is NXDOMAIN despite the repository's own homepage field claiming it. The Operator ruled the application early stage, which is `In progress` |
| `cs-tournament` | `[ASSUMPTION: Live on Vercel]` | **`Live`** at `inclusivcup.vercel.app` | Observation, confirmed by the Operator. The hostname returns 200 and the repository is a substantial polyglot codebase. The assumption was right; it had simply never been checked |

**Amended 2026-09-25.** The `Is` cell for `cs-tournament` is the answer of 2026-09-02 and stays as
that day's. The Operator ruling of 2026-09-24 removed Vercel from the estate, and the entry is
`Complete` from Registry 1.4.0 (the disposition table above). The six rendered entries below do not
move, since `Complete` renders as `Live` does.

**The consequence for the first public Suite Directory is that there is none.** Both answers
leave the six rendered entries exactly as they were: `cuatro-finance` at `In progress` was
never going to render, and `cs-tournament` at `Live` renders, which is what the assumption
already predicted. The six are `cuatro-portfolio`, `cuatro-tracker`, `cs-tournament`,
`cs-tracker`, `digital-library` and `list-wheel`.

**Where the confirmed Registry field values live.** This file states disposition. The values
Story 2.5 transcribed into `contracts/registry.json` on **2026-09-03**, which are `status`, `live`,
`source`, `tech`, `demo` and `identity` for all fourteen applications with the method or reason
behind each, are in **`ops/registry-inputs.md`**. Read that file before authoring a Registry entry,
not this one.

**The Registry now exists and is the authority over both files.** `contracts/registry.json` carries
fourteen entries, one per row of the disposition table below. Where it and this record disagree, the
Registry is what ships and is what a consumer reads; this file is what should have caught it. **The
two are held equal by nothing**, which is stated limit 1 of `ops/registry-inputs.md` and was
deliberately left open on 2026-09-03, so a row added here and not there stays invisible.

**Amended 2026-09-24, by Operator ruling.** `contracts/registry.json` is the only source of
Registry values, and `ops/registry-inputs.md` is frozen as a dated record of how they were first
chosen: author an entry against the Registry and its schema, and read that record only for a
value's history. Its stated limit 1 closed with the freeze. The disposition table below is not a
copy of Registry values, but it lists the same fourteen applications, and nothing holds the two
lists equal. **Amended 2026-09-26:** sixteen on both sides since Registry 1.5.0 (Operator ruling
2026-09-25), and still nothing holds them equal.

### `connect-four-react`, absorbed with its code still in place

`connect-four-react` is recorded as `absorbed_into: cuatro-portfolio`, and **its code has
not moved.** FR-29, the playable half of the absorption, is deferred to v2 in PRD section
9. Until FR-29 is taken up there is no copy of the game inside the Anchor.

The consequence for Epic 2 is direct: **Epic 2 authors this application's `source` against
the archived `connect-four-react` repository,** exactly as it does for `tcg-tracker`. The
archived repository stays publicly readable so that link keeps resolving.

**The obligation to carry `absorbed_into` today is AD-6's**, which keeps an archived or
absorbed application in the Registry with `absorbed_into` naming the application it has been,
or is set to be, folded into (widened on 2026-09-24 from "where its code now lives").
FR-30, which states the same idea as a product requirement, is deferred to v2 alongside
FR-29 (PRD section 9, "Embedded Connect Four (FR-29 to FR-30): v2"), so it is future
intent here and not a live requirement. The field names the decided destination; it does
not assert that a file has moved.

### `tcg-tracker`, folded on paper only

`tcg-tracker` is recorded as `absorbed_into: cuatro-tracker`. It folds in as a domain
inside the Tracker rather than staying a repository, because it is empty and folding is
nearly free (PRD section 5.2).

**The fold has not happened, and its code has not moved.** As with `connect-four-react`,
`absorbed_into` records a decided destination rather than a completed move, so
**Epic 2 authors this application's `source` against the archived `tcg-tracker`
repository** and that link resolves there today.

### The three merge candidates carry no `absorbed_into` today

`cuatro-finance`, `cuatro-tracker` and `cs-tournament` are the end state merge into the
Anchor, which takes the Estate from 11 to 8. That merge is deferred beyond MVP, their code
has not moved, and each stays rendered under its own application id. PRD section 5.1
deliberately assigns them no `absorbed_into`, and this record follows it. They acquire one
when the merge actually lands, and not before.

## Pending Operator actions

Archiving a repository is a GitHub console action outside this repository. Of the four
actions recorded on 2026-08-16, **two have been performed** and **one dissolved**: only
`connect-four-react` is outstanding. **No repository state was changed by any session that
wrote this file**, here or on 2026-08-16: the two archives were Operator acts, observed
afterwards.

| Repository | Action | Constraint |
|---|---|---|
| `connect-four-react` | Archive on GitHub | Must stay publicly readable |

The `apple-music-workspace` row is gone rather than struck, because the action dissolved
rather than completing: there is no repository to archive, and the application was removed
from this record on 2026-09-02. Nothing is owed on it.

`connect-four-react` stays **public**, not private. AD-6 keeps its Registry entry, and SM-4
requires every Registry link to resolve, so making an archived repository private would
break its `source` link. Archived and read only is the target state. Deleted, renamed or
private is not. The same constraint governed `Lumen` and `tcg-tracker`, and the observation
below confirms both were archived public rather than made private.

**The count of 11 above is the decided waypoint, not the observed GitHub state, and the two
still differ.** The observed count of non-archived repositories under Ecosystem governance is
**12**, as of 2026-09-02. It reaches the decided 11 when `connect-four-react` is archived,
which is the single outstanding action. **Amended 2026-09-26:** 13 decided and 14 observed since the
Operator ruling of 2026-09-25 admitted `covidmap` and `future-vizion`; the one outstanding action
is unchanged.

**That figure can be stated exactly for the first time**, which it could not be on
2026-08-16. The obstacle then was that `apple-music-workspace` could not be located, so the
governed set itself was not fully confirmed and no exact observation could be claimed. That
obstacle is gone: the application was ruled out of the Estate on 2026-09-02, so the governed
set is now fourteen repositories, all of them located, of which `Lumen` and `tcg-tracker` are
archived. 14 less 2 is the 12 above, and it is an observation rather than a decision. This
record still makes no claim about repositories outside the governed set.

**Maintaining this section.** When an Operator action is performed, strike its row from the
table above, then re-gather the observed-state table below and re-date it. A pending row
carrying a stale date is not evidence that the action is still outstanding, only evidence
that nobody has looked since that date.

### The Vercel decommission, in its safe order

**Superseded in part 2026-09-26 by listing** (Operator ruling 2026-09-25): `covidmap` and
`future-vizion` are Registry members that stay on Vercel, so steps 1 and 2 have nothing to retire and
are closed as superseded, not performed. Step 3 was performed. The text below is as written on
2026-09-25.

**Written 2026-09-25 on the Operator ruling of 2026-09-24**, which removed Vercel from the estate:
nothing deploys there any more. Three Vercel projects still serve, **observed 2026-09-25** by HTTPS
request, each answering 200 with `server: Vercel`: the two behind `covidmap.cuatro.dev` and
`future-vizion.cuatro.dev` (KV-3 in `ops/known-violations.md`), and the one behind
`inclusivcup.vercel.app`, which was `cs-tournament`'s `live` until Registry 1.4.0. Every step is the
Operator's, this machine holding no Cloudflare or Vercel console access, and each is confirmed by
the name or the URL no longer answering. **The order is the point**: no name is ever left pointing
at a deleted project, and production never links a URL that has stopped answering.

| # | Action | Owner | Exact steps, and the confirmation | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Delete the `covidmap` and `future-vizion` CNAMEs and the `_vercel` TXT** in zone `cuatro.dev` | Operator | KV-3's Pending Operator action 6 in `ops/known-violations.md` names the three records exactly. Confirmed after the 600 s TTL, when `nslookup covidmap.cuatro.dev 1.1.1.1` and `nslookup future-vizion.cuatro.dev 1.1.1.1` each answer that the name does not exist and `nslookup -type=TXT _vercel.cuatro.dev 1.1.1.1` finds no record. That lookup retires KV-3, and this row takes the same date | **Superseded 2026-09-26 by listing.** Operator ruling 2026-09-25 put both applications in the Registry as `Live` (1.5.0), which retired KV-3 by membership, so there is no hostname to retire and this step will never be taken. Before that: **Not to be done.** Operator decision 2026-09-25: both stay live for sentimental value, so the DNS records and the two Vercel projects are kept and the retirement will not be made (KV-3 stays open as a standing exception) |
| 2 | **Delete the two Vercel projects behind those names**, only once step 1's lookups answer | Operator | Vercel dashboard: open the project that lists `covidmap.cuatro.dev` under Settings, Domains, note the `.vercel.app` domain listed beside it, then Settings, Advanced, Delete Project; the same for the project that lists `future-vizion.cuatro.dev`, whose `.vercel.app` domain answered at `https://future-vizion.vercel.app` on 2026-09-25 with the same ETag as the `cuatro.dev` name. **`covidmap.vercel.app` is another owner's project**, observed that day, and says nothing about this one. Confirmed when each noted `.vercel.app` URL answers 404 with `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` to `curl -sI <url>`, and when `curl -s -o /dev/null -w "%{http_code}" --resolve covidmap.cuatro.dev:443:64.29.17.65 https://covidmap.cuatro.dev/`, and the same for `future-vizion.cuatro.dev`, no longer prints 200. The `--resolve` form reaches Vercel's edge after the DNS records are gone; it printed 200 for `covidmap` on 2026-09-25 | **Superseded 2026-09-26 by listing**, for the same ruling: both projects serve Registry `live` URLs, so deleting either would break a published link and turn the scheduled Registry verification red. Before that: **Not to be done**, for the same decision: step 1 is not taken, so the projects stay |
| 3 | **Delete the Vercel project behind `inclusivcup.vercel.app`**, only after the Epic 2 merge to `main` has deployed | Operator | Until that deploy, production serves Registry 1.1.0, which links the URL (**observed 2026-09-25** at `https://cuatro.dev/contracts/registry.json`), and the scheduled `registry-verification` run on `main` checks it daily, so deleting it first breaks a live link and turns that run red. First confirm the deploy: `curl -s https://cuatro.dev/contracts/registry.json` reads `"contract_version": "1.4.0"` or later and contains no `inclusivcup`. Then Vercel dashboard, the project that lists `inclusivcup.vercel.app` under Settings, Domains, then Settings, Advanced, Delete Project. Confirmed when `curl -sI https://inclusivcup.vercel.app` answers 404 with `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`; it answered 200 on 2026-09-25 | **2026-09-25.** Deleted by the Operator after the Epic 2 merge deploy (run 36156753065, `bd21c5d`); production's `https://cuatro.dev/contracts/registry.json` read `"contract_version": "1.4.0"` with no `inclusivcup` beforehand. At 16:41:13Z `https://inclusivcup.vercel.app` answered 404 with `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` |

**No monitor changes with any of it.** **Observed 2026-09-25** by UptimeRobot `list-monitors`: eight
monitors, every one on a `cuatro.dev` host and none on a Vercel URL, as the ruling's own check of
2026-09-24 found.

**Maintaining this table.** When a step is performed, replace its `_not done_` cell with the ISO
8601 UTC date of the check that confirmed it, and leave the row in place, unlike the archive table
above: which name went before which project is what a later reader needs if a name is ever found
pointing at nothing.

### Observed GitHub state, 2026-09-02

Re-gathered by story `2-4-confirm-the-assumed-statuses-hostnames-and-tech-values`, replacing
the 2026-08-16 reading. Read only, gathered with one
`gh repo list LuigiEspinosa --limit 100 --json name,visibility,isArchived` call, which
enumerates the account rather than probing names one at a time. That is why the absence of
`apple-music-workspace` below is a stronger claim than it was on 2026-08-16.

**Scope of this check: archive state and visibility for all fourteen governed repositories.**
Nothing here is evidence about what any repository contains. **The table below shows only the
four that had outstanding archive actions**, because those are the rows that changed; the
visibility finding for all fourteen is the paragraph after it, and no repository outside the
governed set is claimed either way.

| Repository | Found | Visibility | Archived | Change since 2026-08-16 |
|---|---|---|---|---|
| `Lumen` | yes | public | **yes** | **Archived.** Action performed between 2026-08-16 and 2026-09-02 |
| `tcg-tracker` | yes | public | **yes** | **Archived.** Action performed between 2026-08-16 and 2026-09-02 |
| `connect-four-react` | yes | public | no | none. Still outstanding |
| `apple-music-workspace` | **no** | n/a | n/a | none. Still not found |

**The exact archive dates are not recoverable and are not claimed.** The GitHub API returns
`archived_at: null` for both, and both carry `updated_at: 2026-08-16T07:42Z`, which is the same
day the earlier reading found them **un**archived. That timestamp is therefore not safe evidence
of when the archive landed, so the bound above is the honest one: after the 2026-08-16 reading
and by the 2026-09-02 one. Whoever performs the remaining `connect-four-react` archive should
record the date at the time, because it cannot be recovered afterwards.

**`apple-music-workspace` has no repository under owner `LuigiEspinosa`, re-confirmed
2026-09-02.** A full account listing of 31 repositories contains no repository under that
name or any similar one. Two readings, sixteen days apart, by different methods, agree.

**This was a Registry problem and not only an archive problem, and it is now settled.** AD-5
requires `source` on every entry with no exception and FR-10 requires it to resolve, so an
application with no repository could never have been given a conforming entry, and Story 2.5
would have hit that on its first pass. Put to the Operator on **2026-09-02** with three
options, publish a repository, keep the row with a knowingly broken `source`, or drop the
application, **the ruling was to drop it.** The application count moved from 15 to 14 and the
row is gone from the disposition table. The reasoning is under Counts above.

**The repository count is untouched by that ruling**, which is the part likely to be
misread. `apple-music-workspace` was never among the eleven repositories at the waypoint, so
removing the application changes no repository figure and does not touch the sentence naming
those eleven. It changes the starting count in the waypoint sequence only, from 15 to 14,
and every station after the first is unchanged.

**Visibility, re-checked 2026-09-02 and no longer carried over from Story 1.1.** Four
repositories are private: `cs-tracker`, `cs-tournament`, `Mutuo` and `StreamVault`. That is
the same four named on 2026-08-16, now verified by the account listing rather than inherited.
Every Registry `source` link must resolve for an anonymous Visitor, so all four are a live
breach of FR-10 and SM-4. It is recorded as **KV-2** in `ops/known-violations.md`, with
`StreamVault` named there as deliberately private and excluded from repair. Read that entry
rather than re-deriving the problem here.

**Noted 2026-09-26: two repositories joined the governed set** (Operator ruling 2026-09-25).
`LuigiEspinosa/covidmap` (default branch `master`) and `LuigiEspinosa/future-vizion` (default branch
`main`) are both public and neither is archived, **observed 2026-09-26** by
`gh api repos/LuigiEspinosa/<name>`. The paragraphs above describe the fourteen of 2026-09-02 and are
left as written.

## Planned, and not yet an application

**Nothing in this section is an Estate application, is counted anywhere in this file, or is
eligible for a Registry entry.** It exists so that a decided intention is written down rather
than remembered. An entry here graduates into the disposition table above on the day a
repository exists for it, and not before. Until then it changes no count: the governed set
stays fourteen repositories, the waypoint stays eleven, and the Registry stays at fourteen
entries. **Amended 2026-09-26:** sixteen repositories, a waypoint of thirteen and sixteen entries
since the Operator ruling of 2026-09-25, and this section still changes none of them.

**Why the bar is a repository and not an idea.** AD-5 accepts exactly `Live`, `Complete`,
`In progress` and `Archived`, and a thing not yet started is none of them. `source` is
required on every Registry entry with no exceptions and must resolve to a repository rather
than a profile page. `apple-music-workspace` is the precedent: it held a disposition row here
until 2026-09-02 and was removed precisely because no repository of that name exists and no
conforming Registry entry could be authored for it. Recording a planned application in the
disposition table would repeat that error deliberately.

| Planned application | Concept | Platform | Recorded | Ruled by |
|---|---|---|---|---|
| Habit RPG, name undecided | A role-playing game layer over habit tracking, covering both habits to build and habits to quit. `habitica.com` is the stated reference for the RPG framing; the quitting half is the part that reference does not cover and is the reason for building rather than adopting | iOS | **2026-09-06** | **Decision.** The Operator, asked where a not-yet-started application belongs, chose this record over a Registry entry and over a product brief |

**What is not decided.** No name, no repository, no stack, no scope, no position in the epic
sequence, and no relationship to the Tracker Family, which already holds `cuatro-tracker`,
`cs-tracker`, `tcg-tracker` and `poketracker-go` and is the obvious place to ask whether this
belongs. None of that is inferred here, because this record states disposition and does not
invent it.

**The next step, when it is taken.** A product brief defining the quit-habit mechanic, since
that is the half no reference product supplies. Then a repository, then a row in the
disposition table, then a Registry entry authored in `contracts/registry.json` (against
`ops/registry-inputs.md` until that record was frozen on 2026-09-24). It is an
iOS application, so it is the first in the Estate that is not served from the box and not
reachable by a hostname, which the Registry's `live` and `demo` fields are both shaped around.
That is a real modelling question and it is open, not answered.
