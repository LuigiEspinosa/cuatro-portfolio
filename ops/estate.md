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

| Count | Value |
|---|---|
| Repository count under Ecosystem governance | **11** |
| Application count in the Estate record | **15** |

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
| `connect-four-react` | Absorb: playable demo in the Hub | `Archived` | `cuatro-portfolio` | In Registry; surfaces as the embedded demo (PRD section 4.7), not as a directory entry |
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

### `connect-four-react`, absorbed with its code still in place

`connect-four-react` is recorded as `absorbed_into: cuatro-portfolio`, and **its code has
not moved.** FR-29, the playable half of the absorption, is deferred to v2 in PRD section
9. Until FR-29 is taken up there is no copy of the game inside the Anchor.

The consequence for Epic 2 is direct: **Epic 2 authors this application's `source` against
the archived `connect-four-react` repository,** exactly as it does for `tcg-tracker`. The
archived repository stays publicly readable so that link keeps resolving. FR-30 requires
absorption to be recorded rather than hidden, and `absorbed_into` is what records it. The
field names the decided destination; it does not assert that a file has moved.

### `tcg-tracker`

`tcg-tracker` is recorded as `absorbed_into: cuatro-tracker`. It folds in as a domain
inside the Tracker rather than staying a repository, because it is empty and folding is
nearly free (PRD section 5.2). Its `source` also resolves to its archived repository.

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

**The count of 11 above is the decided waypoint, not the observed GitHub state.** Until
these four actions are performed the account still carries 15 repositories. This record
states the decision; it does not yet claim the observation. NFR-9 puts honesty above
completeness, so the gap is written down rather than rounded away.

### Observed GitHub state, 2026-08-16

Read only, gathered with `gh repo view` against owner `LuigiEspinosa`.

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

`cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo` are private today. That is out of
scope for this record and is Epic 2's problem, where every Registry `source` link must
resolve for an anonymous Visitor.
