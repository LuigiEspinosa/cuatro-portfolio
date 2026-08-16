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

Recorded **2026-08-16** (ISO 8601 UTC).

| Count | Value | Nature of the figure |
|---|---|---|
| Repository count under Ecosystem governance | **11** | **Decided waypoint, not an observation.** None of the four archive actions has been performed yet. See Pending Operator actions. |
| Application count in the Estate record | **15** | Fixed by this record, and by AD-6 it does not fall as repositories are archived |

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
later reader who finds 11 in one place and 15 in another has found the intended state, and
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
three archived and 12, while this record says four archived and 11. The epic is the tie
break and it directs 11: Story 1.1 archives four repositories and its third acceptance
block requires the count to be recorded as 11 (`epics.md`, Story 1.1). The difference is
`connect-four-react`, whose PRD section 5 disposition is Absorb, and archiving it is
exactly what turns the 12 waypoint into the 11 waypoint. Both documents describe the same
timeline at different points, as PRD section 5 says of 15, 12, 11 and 8. This record sits
at 11. A later reader hitting the section 9.1 wording has already found the answer here.

### The waypoint sequence

15 to 8 is the decision. 12 and 11 are sequenced stations on the way, not competing
decisions.

| Point in sequence | Count | What changed |
|---|---|---|
| Today | 15 | n/a |
| After archiving | 12 | `Lumen`, `tcg-tracker`, `apple-music-workspace` archived |
| After absorption | **11** | `connect-four-react` absorbed into the Anchor |
| End state | 8 | `cuatro-finance`, `cuatro-tracker`, `cs-tournament` merged into the Anchor |

The 11 repositories at this waypoint are `cuatro-portfolio`, `cuatro-finance`,
`cuatro-tracker`, `cs-tournament`, `cs-tracker`, `digital-library`, `list-wheel`,
`StreamVault`, `MaiCoin`, `poketracker-go` and `Mutuo`.

## Disposition of every application

Fifteen applications. The Status column is the Status recorded in PRD section 5.1. For the
four applications whose Status reads `Archived`, that is the decided disposition and not
yet the observed GitHub state: see Pending Operator actions below.

| Application | Disposition | Status | `absorbed_into` | Registry treatment |
|---|---|---|---|---|
| `cuatro-portfolio` | Anchor | `Live` | n/a | The Hub itself; rendered |
| `Lumen` | Archive: empty shell | `Archived` | n/a | In Registry, not rendered |
| `apple-music-workspace` | Archive: empty shell | `Archived` | n/a | In Registry, not rendered |
| `tcg-tracker` | Archive, then fold as a domain inside `cuatro-tracker` | `Archived` | `cuatro-tracker` | In Registry, not rendered |
| `connect-four-react` | Absorb: playable demo in the Hub | `Archived` | `cuatro-portfolio` | In Registry; not rendered as a directory entry, and not rendered as an embedded demo at MVP either. It will surface as the embedded demo (PRD section 4.7) only once FR-29 is taken up, and FR-29 is deferred to v2. See the note below. |
| `cuatro-finance` | Merge into the Anchor | `[ASSUMPTION: built, not deployed]` | n/a today, see note below | Rendered once deployed |
| `cuatro-tracker` | Merge into the Anchor | `Live`: `tracker.cuatro.dev` | n/a today, see note below | Rendered; Tracker Family member |
| `cs-tournament` | Merge into the Anchor, and migrate off external PaaS | `[ASSUMPTION: Live on Vercel]` | n/a today, see note below | Rendered |
| `cs-tracker` | Satellite: Elixir/LiveView | `Live`: `cs-tracker.cuatro.dev` | n/a | Rendered; Tracker Family; identity demonstration partner (FR-21) |
| `digital-library` | Satellite: Svelte/Fastify | `Live`: `library.cuatro.dev` | n/a | Rendered |
| `list-wheel` | Satellite: Angular | `Live`: on GitHub Pages, relocating to the VPS | n/a | Rendered; see PRD section 5.3 |
| `StreamVault` | Satellite: Python/Vue | `In progress`: early scaffolding | n/a | In Registry, not rendered until Live |
| `MaiCoin` | Satellite: Solidity/Web3 | `In progress`: early scaffolding | n/a | Not rendered; declared non-participating in identity (FR-24) |
| `poketracker-go` | Satellite: Go | `In progress`: early scaffolding | n/a | Not rendered; Tracker Family |
| `Mutuo` | Satellite | `In progress`: early scaffolding | n/a | Not rendered; already carries demo accounts, a pre-existing asset for FR-25 |

End state is the Anchor plus seven Satellites: `cs-tracker`, `digital-library`,
`StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` and `list-wheel`.

### The two `[ASSUMPTION: ...]` Statuses are unresolved

`cuatro-finance` and `cs-tournament` carry their PRD section 5.1 Status verbatim, and in
both cases that text is an open assumption rather than a fact. Neither maps to a valid
Registry status: AD-5 accepts exactly `Live`, `Complete`, `In progress` and `Archived`,
and assumption text is none of them.

Story `2-4-confirm-the-assumed-statuses-hostnames-and-tech-values` resolves both.
**Epic 2 must not author a Registry status by reading through the assumption text**, and
must take the confirmed value from that story instead.

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

Archiving a repository is a GitHub console action outside this repository. **No repository
state was changed by the session that wrote this file.** The four actions below are
outstanding.

| Repository | Action | Constraint |
|---|---|---|
| `Lumen` | Archive on GitHub | Must stay publicly readable |
| `apple-music-workspace` | Archive on GitHub | Must stay publicly readable; owner unconfirmed, see below |
| `tcg-tracker` | Archive on GitHub | Must stay publicly readable |
| `connect-four-react` | Archive on GitHub | Must stay publicly readable |

All four stay **public**, not private. AD-6 keeps their Registry entries, and SM-4 requires
every Registry link to resolve, so making an archived repository private would break its
`source` link. Archived and read only is the target state. Deleted, renamed or private is
not.

**The count of 11 above is the decided waypoint, not the observed GitHub state.** None of
the four archive actions has been performed. The observed count of non-archived
repositories under Ecosystem governance is therefore still the pre-archive figure, not 11,
and it stays there until all four are archived.

That observed figure cannot be stated exactly yet. The table below found only three of the
four, because `apple-music-workspace` could not be located under this owner, so the
governed set itself is not fully confirmed. It becomes exact once that repository's owner
or real name is resolved. This record states the decision; it does not yet claim the
observation, and it does not make any claim about repositories outside the governed set.
NFR-9 puts honesty above completeness, so the gap is written down rather than rounded away.

**Maintaining this section.** When an Operator action is performed, strike its row from the
table above, then re-gather the observed-state table below and re-date it. A pending row
carrying a stale date is not evidence that the action is still outstanding, only evidence
that nobody has looked since that date.

### Observed GitHub state, 2026-08-16

Read only, gathered with `gh repo view` against owner `LuigiEspinosa`.

**Scope of this check: only the four retired repositories were checked on 2026-08-16.** The
other eleven applications in the disposition table were not verified against GitHub, so
nothing below is evidence about their visibility, their archive state or their existence.

| Repository | Found | Visibility | Archived |
|---|---|---|---|
| `Lumen` | yes | public | no |
| `tcg-tracker` | yes | public | no |
| `connect-four-react` | yes | public | no |
| `apple-music-workspace` | **no** | n/a | n/a |

**`apple-music-workspace` could not be located under owner `LuigiEspinosa` on 2026-08-16.**
`gh repo view` returned no repository under that name, and a full listing of the account
showed no repository with a similar name. Before archiving it, the Operator must confirm
either its real owner or its real name. This matters beyond the archive action: the Estate
record counts fifteen applications and Epic 2 authors a Registry entry with a resolving
`source` for each one, so an application whose repository cannot be found would silently
break both the count and SM-4.

One observation carried over from Story 1.1's spec, gathered separately on 2026-08-16 and
**not re-verified by the four-repository check above**: `cs-tracker`, `cs-tournament`,
`StreamVault` and `Mutuo` were private at that time. That is out of scope for this record
and is Epic 2's problem, where every Registry `source` link must resolve for an anonymous
Visitor. Epic 2 should re-check it rather than rely on this line.
