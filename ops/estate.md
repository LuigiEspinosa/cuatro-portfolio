# The Estate

The written record of every application under Ecosystem governance: its disposition, its
Status, and where its code lives when the code has moved.

This file is a record, not Registry data. The App Registry is hand authored
`contracts/registry.json`, schema validated in CI, and it arrives in Epic 2 under AD-4.
Epic 2 authors its entries from this file. Nothing here is a published contract surface.

Governing decision: **AD-6, Registry membership is by application, not by repository.**
The Registry's unit is the application. An application that has been archived or absorbed
keeps its entry, with `absorbed_into` naming where its code now lives. No application is
ever dropped by omission.

Source of truth for every row below: PRD section 5.1, Disposition of every repository, in
`_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md`.

## Counts

Recorded **2026-08-16** (ISO 8601 UTC). **Re-examined 2026-09-02 by story
`2-4-confirm-the-assumed-statuses-hostnames-and-tech-values`. The repository count is
unchanged. The application count fell from 15 to 14.**

| Count | Value | Nature of the figure |
|---|---|---|
| Repository count under Ecosystem governance | **11** | **Decided waypoint, not an observation.** The observed figure is **12** as of 2026-09-02, stated exactly for the first time. One archive action is outstanding. See Pending Operator actions. |
| Application count in the Estate record | **14** | Fixed by this record. By AD-6 it does not fall as repositories are archived, and it did not fall for that reason here: one row was never an application. See below |

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
must not reconcile one number against the other.

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
| After absorption | **11** | `connect-four-react` absorbed into the Anchor | not yet |
| End state | 8 | `cuatro-finance`, `cuatro-tracker`, `cs-tournament` merged into the Anchor | not yet |

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

The 11 repositories at this waypoint are `cuatro-portfolio`, `cuatro-finance`,
`cuatro-tracker`, `cs-tournament`, `cs-tracker`, `digital-library`, `list-wheel`,
`StreamVault`, `MaiCoin`, `poketracker-go` and `Mutuo`.

## Disposition of every application

Fourteen applications. The Status column is the Status recorded in PRD section 5.1, except
where story 2-4 confirmed it on 2026-09-02 and it differs. For the three applications whose
Status reads `Archived`, that is the decided disposition: two are archived in fact and
`connect-four-react` is not yet. See Pending Operator actions below.

**Amended 2026-09-02.** `apple-music-workspace` was a fifteenth row here and was removed,
because no repository of that name exists under this owner and no conforming Registry entry
could be authored for it. The reasoning is under Counts above.

| Application | Disposition | Status | `absorbed_into` | Registry treatment |
|---|---|---|---|---|
| `cuatro-portfolio` | Anchor | `Live` | n/a | The Hub itself; rendered |
| `Lumen` | Archive: empty shell | `Archived` | n/a | In Registry, not rendered |
| `tcg-tracker` | Archive, then fold as a domain inside `cuatro-tracker` | `Archived` | `cuatro-tracker` | In Registry, not rendered |
| `connect-four-react` | Absorb: playable demo in the Hub | `Archived` | `cuatro-portfolio` | In Registry; not rendered as a directory entry, and not rendered as an embedded demo at MVP either. It will surface as the embedded demo (PRD section 4.7) only once FR-29 is taken up, and FR-29 is deferred to v2. See the note below. |
| `cuatro-finance` | Merge into the Anchor | `In progress` | n/a today, see note below | Not rendered until Live |
| `cuatro-tracker` | Merge into the Anchor | `Live`: `tracker.cuatro.dev` | n/a today, see note below | Rendered; Tracker Family member |
| `cs-tournament` | Merge into the Anchor, and migrate off external PaaS | `Live`: `inclusivcup.vercel.app` | n/a today, see note below | Rendered |
| `cs-tracker` | Satellite: Elixir/LiveView | `Live`: `cs-tracker.cuatro.dev` | n/a | Rendered; Tracker Family; identity demonstration partner (FR-21) |
| `digital-library` | Satellite: Svelte/Fastify | `Live`: `library.cuatro.dev` | n/a | Rendered |
| `list-wheel` | Satellite: Angular | `Live`: on GitHub Pages, relocating to `wheel.cuatro.dev`, which does not resolve yet | n/a | Rendered; see PRD section 5.3. **The Registry's `live` stays the GitHub Pages URL until Story 2-25 routes the subdomain**: `ops/registry-inputs.md` |
| `StreamVault` | Satellite: Python/Vue | `In progress`: early scaffolding | n/a | In Registry, not rendered until Live |
| `MaiCoin` | Satellite: Solidity/Web3 | `In progress`: early scaffolding | n/a | Not rendered; declared non-participating in identity (FR-24) |
| `poketracker-go` | Satellite: Go | `In progress`: early scaffolding | n/a | Not rendered; Tracker Family |
| `Mutuo` | Satellite | `In progress`: early scaffolding | n/a | Not rendered; already carries demo accounts, a pre-existing asset for FR-25 |

End state is the Anchor plus seven Satellites: `cs-tracker`, `digital-library`,
`StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` and `list-wheel`.

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

**The consequence for the first public Suite Directory is that there is none.** Both answers
leave the six rendered entries exactly as they were: `cuatro-finance` at `In progress` was
never going to render, and `cs-tournament` at `Live` renders, which is what the assumption
already predicted. The six are `cuatro-portfolio`, `cuatro-tracker`, `cs-tournament`,
`cs-tracker`, `digital-library` and `list-wheel`.

**Where the confirmed Registry field values live.** This file states disposition. The values
Story 2.5 transcribes into `contracts/registry.json`, which is `status`, `live`, `tech`,
`demo` and `identity` for all fourteen applications with the method or reason behind each, are
in **`ops/registry-inputs.md`**. Read that file before authoring a Registry entry, not this one.

### `connect-four-react`, absorbed with its code still in place

`connect-four-react` is recorded as `absorbed_into: cuatro-portfolio`, and **its code has
not moved.** FR-29, the playable half of the absorption, is deferred to v2 in PRD section
9. Until FR-29 is taken up there is no copy of the game inside the Anchor.

The consequence for Epic 2 is direct: **Epic 2 authors this application's `source` against
the archived `connect-four-react` repository,** exactly as it does for `tcg-tracker`. The
archived repository stays publicly readable so that link keeps resolving.

**The obligation to carry `absorbed_into` today is AD-6's**, which keeps an archived or
absorbed application in the Registry with `absorbed_into` naming where its code now lives.
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
which is the single outstanding action.

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
