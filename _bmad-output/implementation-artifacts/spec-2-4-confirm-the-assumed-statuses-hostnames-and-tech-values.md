---
title: 'Story 2.4: Confirm the assumed Statuses, hostnames and `tech` values'
type: 'chore'
created: '2026-09-02'
status: 'done'
baseline_commit: 'd3be1562e9fe04a8a594bc8ca44dd185c68aebf7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Four assumptions stand between Story 2.5 and a Registry it can transcribe rather than
adjudicate. `ops/estate.md:90` and `:92` carry `[ASSUMPTION: ...]` Statuses that map to none of AD-5's
four values, `wheel.cuatro.dev` is a placeholder borrowed from the UX mocks, `content/projects.ts:30`
still claims `Hetzner VPS`, and the four `In progress` applications have no decided `identity` or
`demo`. Story 1-7 additionally handed this story the AD-6 membership question for three hostnames
that serve on `cuatro.dev` and appear in no Estate row.

**Approach:** Gather the evidence, record the Operator's rulings in a new `ops/registry-inputs.md`
that Story 2.5 transcribes, close `ops/estate.md`'s assumption cells and re-date its observed state,
and open two `ops/known-violations.md` entries for the breaches these decisions knowingly leave
standing.

## Boundaries & Constraints

**Always:**

- Every value is marked **Observed** with its method and an ISO 8601 UTC date, or **Decision** with
  its reason. NFR-9 puts honesty above completeness, and this is the idiom `ops/estate.md`,
  `ops/known-violations.md` and `ops/routing-inventory.md` already set.
- **Read the branch that carries the code.** `cuatro-finance`, `StreamVault` and `poketracker-go`
  hold only `LICENSE` on `main` and develop on `dev`; `MaiCoin`, `cuatro-tracker`, `digital-library`
  and `connect-four-react` also carry a `dev`; `covidmap`'s default is `master`. A `tech` array read
  off a default branch is wrong, and GitHub's language stats are computed from that branch.
- These eight rulings are settled and are transcribed, not re-decided:

  | # | Ruling |
  |---|---|
  | 1 | `cuatro-finance` is **`In progress`**. Operator: early stage, barely started |
  | 2 | `cs-tournament` is **`Live`** at `https://inclusivcup.vercel.app` |
  | 3 | `list-wheel`'s chosen hostname is **`wheel.cuatro.dev`**, which Story 2.25 routes. Its `live` carries `https://luigiespinosa.github.io/list-wheel/` until then, because a Registry link must resolve on every commit (SM-4) |
  | 4 | `covidmap` and `future-vizion` get **no** Estate row and **no** Registry entry; their subdomains are retired. `analytics.cuatro.dev` is infrastructure, not an application. `ad-analysis.cuatro.dev` is already NXDOMAIN on an archived repository |
  | 5 | `tech` is recorded at the granularity the epic fixes for `digital-library`: framework, store and runtime, roughly six values, comparable across entries |
  | 6 | `identity` is `wallet` for `MaiCoin` and `none` for every other application; each unbuilt or archived application carries a not-deployed `demo`; `Mutuo`'s pre-existing demo accounts are recorded for FR-25. **Renegotiated 2026-09-02**, see below |
  | 7 | The private `source` links are recorded as a violation, not repaired |
  | 8 | The counts are restated. Ruling 4 holds the repository count at 11; the application count is **14**. **Renegotiated 2026-09-02**, see below |

  **Rulings 6 and 8 were renegotiated with the Operator during implementation on 2026-09-02**, and
  are recorded above as amended rather than as first written. This block is human-owned and was
  changed only because the human changed it. Ruling 6 originally said "the other three
  `In progress` applications", which stopped partitioning the set once ruling 1 made
  `cuatro-finance` a fifth; the Operator then settled `identity` and `demo` for **all** fourteen,
  not just the unbuilt ones. Ruling 8 originally asserted 15 applications; the Operator ruled
  `apple-music-workspace` out of the Estate, having no repository, and the count became 14. The
  Spec Change Log carries both exchanges in full.

- `status` values come only from AD-5's four. `demo` and `identity` come only from the closed sets
  `ops/registry-schema.md` records, and every application carries both explicitly, `none` included.

**Ask First:**

- Any Status, hostname, `tech` value, `demo` or `identity` not settled by the eight rulings above.
- Any change to the counts, or to the eleven-name sentence the parser reads.
- Making a private repository public, or performing any GitHub console action.

**Never:**

- Do not edit `content/projects.ts`. The stale `Hetzner VPS` is **recorded for correction**, not
  corrected: Story 2.7 retires that file whole, and `ops/known-violations.md:173` already books the
  value to Epic 2 and calls it "not a file this story touches". `SQLite` at `:23` is correct (C-1).
- Do not author `contracts/registry.json`, any entry in it, or any `description`. Stories 2.5 and 2.6.
- **Do not reword `ops/estate.md:73-75`, "The 11 repositories at this waypoint are ...", and do not
  put a `.` inside it.** `estateNames()` regexes that sentence to the first period and throws unless
  it yields exactly eleven backticked names.
- Do not give `covidmap` or `future-vizion` an Estate row, a Registry entry, or a `status` chosen to
  keep them out of the Suite Directory. Rendering is a declarative rule over `status` (**FR-35**,
  which renders `Live` and `Complete`; this bullet cited FR-8 and the citation was corrected at
  review, leaving the instruction unchanged), so a status picked for layout is a lie in the field
  the rule reads.
- Do not add a dependency, a CI job, or a test holding this record against `contracts/registry.json`.
  The Registry is `applications: []` until Story 2.5, so such a check would assert over nothing.
- Do not run the Playwright suite or regenerate a baseline. Nothing rendered changes.

</frozen-after-approval>

## Code Map

- `ops/estate.md`: the file this story resolves. `:83-99` the disposition table, whose `Status` cells
  at `:90` (`cuatro-finance`) and `:92` (`cs-tournament`) carry the assumption text; `:104-114` the
  section stating both are unresolved, which this story closes and must not merely delete; `:151-184`
  Pending Operator actions, whose own maintenance rule is "strike the row, re-gather, re-date";
  `:186-207` the observed GitHub state, dated **2026-08-16** and now stale in three ways.
  **`:73-75` is machine-parsed. Leave it byte-identical.**
- `ops/contract-adoption.mjs:27-30` (`ESTATE_COUNT = 11`, `ESTATE_SENTENCE`) and `:223-232`
  (`estateNames`, which throws on any count but eleven). `ops/__tests__/contract-adoption.test.ts:240`
  is the test that fails if the sentence moves. This is the only parser over `ops/estate.md`.
- `ops/contract-adoption.md`: reusable evidence gathered 2026-08-27, not to be re-gathered blindly.
  `:236` records `list-wheel` as Angular with Karma and four component specs; `:223` counts 58 Vitest
  files under `cs-tournament`'s `lib/`; `:65-69` and `:231` give per-repository blob counts. **`:729`
  is the stated limit this story closes**: "Three repositories have a `dev` branch that was not
  inspected". Its two tables are held equal to the estate sentence by `assertEstateCovered`, so they
  move only if the sentence does, which ruling 8 says it does not.
- `ops/known-violations.md`: `:22-48` the three tests an entry must meet, and the line that deferred
  work belongs in `deferred-work.md` instead; `:47-53` the `KV-n` numbering and the two-word status
  vocabulary; `:60-62` the derived index; `:66-87` KV-1's field table, the shape to copy;
  `:193-198` Pending Operator actions. KV-1 stays untouched.
- `ops/routing-inventory.md`: the three handovers, each naming this story. `:453-454` `covidmap` and
  `future-vizion` as observed absences; `:487-489` `list-wheel`, `cs-tournament` and `cuatro-finance`
  having no hostname in the zone; `:501-506` the reconciliation; `:1605` the AD-6 membership decision.
  `:180-181` and `:307-308` show both subdomains are Vercel CNAMEs, which is what a retirement edits.
- `ops/registry-schema.md`: the closed value sets `demo` (`demo-account`, `open`, `not-deployed`,
  `none`) and `identity` (`oidc`, `wallet`, `none`), with the requirement each answers.
- `content/projects.ts:16-32`: **read only.** The fifteen-value `tech` array ruling 5 narrows, and
  the stale value at `:30`.
- `AGENTS.md:32-39`: the "21 records" line and the record listing, which gains one.
- `_bmad-output/planning-artifacts/epics.md:2132-2176`: Story 2.4's four acceptance blocks.

## Tasks & Acceptance

**Execution:**

- [x] `ops/registry-inputs.md`, new: the record Story 2.5 transcribes. A preamble naming the story,
      the date and the baseline commit, and saying it is a record rather than Registry data. One row
      per application for all fourteen, giving `status`, `live` (or why there is none), `source`,
      `tech`, `demo`, `identity`, each cell marked Observed with method or Decision with reason. A
      section per ruling 1, 2 and 3 carrying the evidence that settled it. A section stating **what
      changes in the first public Suite Directory: nothing**, because `cuatro-finance` at
      `In progress` was never rendered and `cs-tournament` at `Live` was already assumed so, and
      naming the six. A section on ruling 4 giving the exclusion reason and the retirement it
      requires. Sections settling what `identity` and `demo` mean. Stated limits: the `tech`
      granularity is a judgement, the two empty shells' arrays are Decisions, `Mutuo` and
      `list-wheel` have no `dev` branch, and nothing yet holds this record equal to
      `contracts/registry.json`, which Story 2.5 owns.
- [x] `ops/estate.md`: replace both assumption cells with the ruled Statuses; rewrite the
      "unresolved" section to record that both are resolved, by which story and on what evidence,
      rather than deleting it; re-gather and re-date the observed GitHub state, which now shows
      `Lumen` and `tcg-tracker` archived and `connect-four-react` still not; strike the completed
      rows from Pending Operator actions; remove `apple-music-workspace` and restate the
      application count from 15 to 14 with its reasoning, carrying the correction through the
      waypoint sequence, the PRD 9.1 reconciliation and the disposition heading; state the observed
      repository count exactly for the first time. Point at `ops/registry-inputs.md` as the
      confirmed source. **Leave `:73-75` alone.**
- [x] `ops/known-violations.md`: add **KV-2**, four non-resolving `source` links, on `cs-tracker`,
      `cs-tournament` and `Mutuo` plus the permanently private `StreamVault`, breaching FR-10 and
      SM-4, ruled by the Operator on 2026-09-02, retired by publishing the three repairable ones;
      and **KV-3**, `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` serving outside the
      Registry in breach of AD-6, retired by the subdomain retirements. Both in KV-1's field shape,
      both added to the index, both with their Operator actions in the pending table.
- [x] `AGENTS.md`: 22 records, with `registry-inputs.md` named and described in one clause.

**Acceptance Criteria:**

- Given `ops/registry-inputs.md`, when it is read, then all fourteen applications carry a `status`
  from AD-5's four, a `demo` and an `identity` from the closed sets, and a `tech` array, and every
  cell is marked Observed with a method or Decision with a reason.
- Given `corepack pnpm test --run`, when it runs, then it passes, and
  `contract-adoption.test.ts:240` is green, which is what proves the eleven-name sentence survived
  the edits to `ops/estate.md`.
- Given `ops/estate.md`, when it is searched, then no Status cell in the disposition table carries
  `[ASSUMPTION:`, its observed-state section carries a 2026-09-02 date, and `git diff` shows
  `:73-75` unchanged. The string survives elsewhere in the file as quoted history, which the file
  says it is doing and which its record-rather-than-delete idiom requires.
- Given `ops/known-violations.md`, when KV-2 and KV-3 are read, then each meets all three admission
  tests at `:22-48`, carries a `Retired by` that is a named story or `unassigned`, and its index row
  restates its own table. KV-1's cells are unchanged.
- Given the diff for this story, when it is read, then nothing under `app/`, `components/`,
  `content/`, `contracts/`, `public/`, `packages/` or `.github/` has changed, and no dependency was
  added.

## Spec Change Log

- **2026-09-02, implementation.** The Estate's application count fell from 15 to 14, which ruling 8
  did not anticipate and the Tasks did not describe. `apple-music-workspace` has no repository under
  this owner, re-confirmed by a full account listing, so AD-5's required `source` and FR-10's
  requirement that it resolve could never both be met for it. Put to the Operator with three options
  and ruled: drop the application. The correction cascades further than the count cell, and all of it
  is inside `ops/estate.md`: the waypoint sequence read `15` today and named three archives including
  a repository that does not exist, so the starting figure was one too high and the archiving step
  one too many; **those two errors cancel, which is why every waypoint below the first is unchanged**
  at 12, 11 and 8. The PRD 9.1 reconciliation also needed a note, because both documents now say
  three archive actions and they are not the same three. The eleven-name sentence is untouched:
  `apple-music-workspace` was never among the eleven, verified by `estateNames()` still returning 11.
- **2026-09-02, implementation.** Ruling 1 made `cuatro-finance` a **fifth** `In progress`
  application, where `epics.md:2170` and forced change C-10 anticipated four, so ruling 6's "the
  other three" no longer partitioned the set. Settled by the `identity` ruling below rather than by
  a separate decision, since it falls out the same way: `none` and `not-deployed`.
- **2026-09-02, implementation.** The spec settled `identity` and `demo` only for the four
  `In progress` applications, which left both fields undecided for the six `Live` and three
  `Archived` ones, while the first acceptance criterion requires every application to carry both.
  Two Operator rulings closed it. **`identity` declares participation in the Ecosystem scheme, not
  mechanism**, so everything is `none` until Epic 5 except `MaiCoin` at `wallet`, even though four
  applications authenticate today by Steam OpenID 2.0, next-auth, Supabase and better-auth
  respectively. The alternative reading was rejected because the three-value enum cannot express
  those mechanisms, and adopting it would have required widening AD-5 and the schema Story 2-3
  shipped. **No application offers a demo account yet**, so `demo` is `open` for the two
  unauthenticated surfaces, `none` for the four gated ones and `not-deployed` for the rest. Both
  rulings are recorded in `ops/registry-inputs.md` with the cases most likely to be challenged
  named explicitly.
- **2026-09-02, implementation.** `Lumen` and `tcg-tracker` contain no code at all, and the schema
  requires `tech` to be a non-empty array, so neither could be left blank and neither could be
  observed. Ruled: record from the repository's own description and mark it a Decision rather than an
  observation. `Lumen`'s description names a purpose and a platform but no stack, and its array says
  exactly that. `tcg-tracker` has no description either and the sub-question went unanswered, so its
  array is `cuatro-tracker`'s, on the reasoning that PRD section 5.2 folds it in as a domain inside
  that application. **That is the weakest value in the record and is flagged as such in its stated
  limits**, for the Operator to overwrite.
- **2026-09-02, implementation.** Two deliberate deviations from the Tasks, both to avoid duplicating
  a fact across two files. The Task had `ops/estate.md` carry the two subdomain retirements as its
  own Operator actions; they are cited to KV-3 instead, because `ops/known-violations.md` already
  establishes that a register cites rather than restates so there is one place to change. And
  `ops/registry-inputs.md` gained a `source` column beyond the five fields the Task named, because
  four of those links do not resolve and Story 2.5 authors them regardless, so the record would have
  been incomplete for its one consumer without it.
- **2026-09-02, implementation.** The third acceptance criterion required that no `[ASSUMPTION:`
  remain in `ops/estate.md`, and that is not what the story should want. The file's idiom is to
  record rather than delete what it supersedes, as `ops/known-violations.md` does with retired
  entries, so the resolved section quotes both old values in a `Was` column deliberately. The
  criterion is narrowed to what it meant: no **Status cell** carries assumption text. A sentence in
  `ops/estate.md` claiming the text was "gone from this file" was false once that table existed and
  is corrected to say where it survives and why. **The verification that first reported this clean
  was itself faulty**, a `Select-String -SimpleMatch` whose pattern carried a regex escape, so it
  searched for a literal backslash and matched nothing. Re-run without it, four occurrences appear.
- **2026-09-02, implementation.** KV-2's title says four links, not three. The breach is four
  non-resolving `source` links; the repair is three, because `StreamVault` is ruled permanently
  private. Both numbers are correct and the entry now says so rather than letting the heading imply
  the smaller one is the whole problem.

- **2026-09-02, review.** Three parallel review layers found four factual errors in records whose
  only value is that their claims are true. All four are corrected in place rather than by
  loopback, because the deliverables' conclusions survived: **(1)** the render rule is FR-35 and
  renders `Live` **and** `Complete`, not `Live` alone; the spec's Design Note, KV-3 and
  `ops/registry-inputs.md` all asserted the narrower rule and all cited FR-8, which is a different
  requirement. **The KV-3 conclusion is strengthened, not weakened**: with `Complete` also
  rendering, there is genuinely no truthful status that hides the two applications, where before
  the argument had to lean on "would be a false value". **(2)** KV-3 still said the application
  count stays 15 after the count fell to 14 in the same change, so two records shipped together
  disagreed on the number this story exists to confirm. **(3)** FR-11 at `epics.md:2216` is
  explicit that `tcg-tracker` does **not** carry `family`; the handover told Story 2.5 to author
  it. **(4)** the record said six repositories keep `main` at a bare `LICENSE` when only three do,
  which overstated the trap in the section teaching it. Also corrected: a stale `ops/estate.md:73-75`
  citation, now that the parsed sentence moved to `:117`, replaced by naming the sentence rather
  than its line, which is the repair `ops/known-violations.md` already prescribes.
- **2026-09-02, review.** One claim went the other way from the review's reading and is worth
  keeping straight. `ops/contract-adoption.md:729`'s stated limit is about whether a **Dependabot
  or Renovate configuration** sits on those three `dev` branches, deliberately scoped to the
  default branch because that is where an unattended merge lands. Story 2-4 read the same branches
  for their **manifests**. Two questions, one tree, and neither answers the other, so the record's
  claim to "close that limit" was the thing that was wrong and is now corrected. The limit stands.
- **2026-09-02, review.** The `id` conflict is the finding that matters most and it is neither
  patched nor loop-backed: AD-3 asserts an id is lowercase kebab-case **and** equal to its
  repository name, and `Lumen`, `StreamVault`, `MaiCoin` and `Mutuo` make those two halves
  contradict. The blocking `registry-schema` gate enforces the first. **It is pre-existing rather
  than caused by this change**, so it is filed in `deferred-work.md` and recorded as stated limit 0,
  but it is the one mid-flight decision Story 2-4 was supposed to remove from Story 2-5 and did
  not. The `source` values are spelled with real repository capitalisation so the drill-through
  link is correct whichever way the ruling goes. **KEEP:** do not "fix" this by lowercasing the
  `source` URLs; four of them would then 404.
- **2026-09-02, review.** Four findings were deferred rather than patched, all outside this story's
  four-file scope: `ops/routing-inventory.md` still carries four handovers to this story as open
  questions plus one citation this change falsified, the O-4 / O-5 / PRD Q9 registers were never
  marked closed, the `AGENTS.md` pointer sits inside the managed block a refresh will drop, and no
  check holds `ops/estate.md`'s fourteen rows equal to `ops/registry-inputs.md`'s.

## Design Notes

**Why a new record rather than more of `ops/estate.md`.** `estate.md` states disposition: what each
application is for and where its code lives. This story produces the Registry's *field values*, which
is a different question with a different lifetime, and it is parsed by a module that is deliberately
brittle about that file's wording. Story 2.5 wants one file to transcribe, and `ops/` already puts
each investigation in its own record beside the thing it describes.

**Why the `tech` arrays cannot be read from GitHub's language stats.** They are computed from the
default branch, and three of these repositories keep `main` at a bare `LICENSE` while `dev` carries
the whole application: `cuatro-finance`, `StreamVault` and `poketracker-go`. Three more carry a `dev`
without `main` being empty. `cuatro-finance` reports `{}` and 1 blob on `main`, and 98 blobs of
Next.js, Prisma and Docker on `dev`. Reading the default branch is what makes ruling 1 look like
`Archived` instead of `In progress`, and it is the single likeliest way to get this story wrong.

**Why ruling 4 is an exclusion rather than a status choice.** Both applications really are live, so
the only honest `status` for them is `Live`. **FR-35 renders `Live` and `Complete`**
(`contracts/registry.schema.json:59`), so `Complete` would render them too, and the only two values
that would hold them back, `In progress` and `Archived`, are both false. There is therefore no
truthful value that admits them to the Registry while keeping the first public directory at six.
Retiring the two subdomains closes the AD-6 breach by removing the fact that creates it, rather than
by omission, which is the one resolution AD-6 forbids.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. The `contract-adoption` suite is the real check here.
- `node -e "import('./ops/contract-adoption.mjs').then(m=>console.log(m.estateNames(require('fs').readFileSync('ops/estate.md','utf8')).length))"`:
  prints `11`. Run it after editing `ops/estate.md` and before running the suite, because its throw
  names the fault directly where the test only reports a failed expectation.
- `git diff -U0 -- ops/estate.md | Select-String '^[+-].*waypoint are'`: no output, proving the
  sentence is untouched. **`-U0` and the `^[+-]` anchor are both required**: without them the
  sentence prints as an unchanged context line and a passing check reads as a failure.
- `git status --short`: seven entries, being the four files this story names plus
  `sprint-status.yaml` (the board sync this workflow performs), `deferred-work.md` (the review's
  deferred findings) and the spec file itself.
- `git status --porcelain | Select-String '^\s*[MADRC?]+\s+(app|components|content|contracts|public|packages|\.github)/'`:
  no output, which is the last acceptance criterion stated as a command.

**Manual checks:**

- Re-read each `tech` array against the manifest on the branch that holds the code, and confirm the
  branch is named in the cell's method. A cell citing `main` for `cuatro-finance`, `StreamVault` or
  `poketracker-go` is the failure this story exists to avoid, because those three hold nothing but a
  `LICENSE` there.
- Confirm every `source` in the record resolves anonymously, or is named in KV-2. Sign out of GitHub,
  or use a private window: a link that resolves for the Operator is not evidence for SM-4.

## Suggested Review Order

**The one thing to rule on before Story 2.5 runs**

- AD-3's two halves contradict for four mixed-case repositories. Rule before 2.5 runs.
  [`registry-inputs.md:335`](../../ops/registry-inputs.md#L335)

**The values Story 2.5 transcribes, which is the point of the story**

- Status, hostname and whether each `source` resolves for a stranger.
  [`registry-inputs.md:58`](../../ops/registry-inputs.md#L58)

- `tech`, `demo` and `identity` for all fourteen, in one table.
  [`registry-inputs.md:89`](../../ops/registry-inputs.md#L89)

- Which branch each array was read from. Three repositories keep `main` at a bare `LICENSE`.
  [`registry-inputs.md:108`](../../ops/registry-inputs.md#L108)

- The three arrays with no manifest behind them, and the weakest value in the record.
  [`registry-inputs.md:146`](../../ops/registry-inputs.md#L146)

**The two rulings most likely to be challenged**

- Why four applications with login screens all read `identity: none`.
  [`registry-inputs.md:274`](../../ops/registry-inputs.md#L274)

- Why `MaiCoin` is `wallet` rather than `none`, when FR-24 calls it non-participating.
  [`registry-inputs.md:283`](../../ops/registry-inputs.md#L283)

**The assumptions, and the answer that turned out to be "nothing changes"**

- `cuatro-finance`: the evidence cuts both ways and both halves are recorded.
  [`registry-inputs.md:173`](../../ops/registry-inputs.md#L173)

- Hostname chosen, but 2.5 must not author it yet. A recorded deviation from the epic.
  [`registry-inputs.md:209`](../../ops/registry-inputs.md#L209)

- The six rendered entries are unchanged, and the render rule is two values, not one.
  [`registry-inputs.md:232`](../../ops/registry-inputs.md#L232)

**Two breaches opened, and one count that moved**

- KV-2: four `source` links, three of them repairable.
  [`known-violations.md:190`](../../ops/known-violations.md#L190)

- KV-3: why exclusion needed a subdomain retirement to be honest.
  [`known-violations.md:228`](../../ops/known-violations.md#L228)

- The application count fell to 14, and why that is not AD-6 being weakened.
  [`estate.md:29`](../../ops/estate.md#L29)

- The waypoint table was wrong in two places that cancelled.
  [`estate.md:96`](../../ops/estate.md#L96)

- The assumption text survives as quoted history, deliberately.
  [`estate.md:166`](../../ops/estate.md#L166)
