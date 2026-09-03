---
title: 'Story 2.5: Author `contracts/registry.json`'
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: 'd21f0c7b4735cac88c1ce47c4bf403f8419a140b'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `contracts/registry.json` is `applications: []`. Story 2-3 shipped the schema and its
blocking gate, Story 2-4 confirmed every field value into `ops/registry-inputs.md`, and the Registry
itself is still empty, so the estate's only App Registry describes nothing. Two rules the schema
deliberately left open are due in the same change: `applications` has no `minItems`, so an edit that
empties the Registry ships green (DW-26), and `absorbed_into` and `family` are unchecked references
(DW-27).

**Approach:** Transcribe the fourteen entries from `ops/registry-inputs.md`, tighten the schema and
the gate in the same commit that first makes both tightenings true, and record the Operator's AD-3
id ruling where AD-3 is stated so the spine and the shipped file agree.

## Boundaries & Constraints

**Always:**

- **Transcribe from `ops/registry-inputs.md`.** It is the confirmed record Story 2-4 wrote for this
  story, and its Handover section is the task list. Not `ops/estate.md`, which states disposition,
  and not `content/projects.ts`, which is stale and retired by Story 2.7.
- Fourteen entries, one per application, archived and absorbed included (AD-6). The entry count and
  the repository count are different numbers, 14 and 11, and neither validates the other.
- These five Operator rulings of 2026-09-03 are settled and are transcribed, not re-decided:

  | # | Ruling |
  |---|---|
  | 1 | **AD-3's second half narrows.** An id is the lowercase kebab-case form of its repository name, so `Lumen`, `StreamVault`, `MaiCoin` and `Mutuo` get ids `lumen`, `streamvault`, `maicoin` and `mutuo`. No repository is renamed and the `id` pattern is unchanged. This closes stated limit 0 of `ops/registry-inputs.md` |
  | 2 | **`source` keeps the repository's real capitalisation**, so all four still resolve. Never rebuild a `source` from an `id` |
  | 3 | **All fourteen `description` values are authored now**, to FR-8's shape. The six `EXPERIENCE.md:247-252` drafts go in verbatim; the other eight are written to the same contract. Story 2.6 confirms them against running software |
  | 4 | **DW-26 and DW-27 land here.** `minItems: 1`, and referential rules for `absorbed_into` and `family` |
  | 5 | **`token_contract` is set on `cs-tracker` only**, at `1.0.0`, and omitted everywhere else. The Anchor publishes the contract and vendors nothing, so it has no `cuatro-contracts/tokens.css` header to verify against |

- `name` is the display name a reader sees, never the id. The six entries at
  `EXPERIENCE.md:247-252` take that table's Entry column verbatim; the other eight take the
  repository's own capitalisation (`Lumen`, `StreamVault`, `MaiCoin`, `Mutuo`) or the title-cased
  reading of the id, so `cuatro-portfolio` is `Cuatro Ecosystem` and `tcg-tracker` is `TCG Tracker`.
- `status`, `live`, `source`, `tech`, `demo` and `identity` come only from
  `ops/registry-inputs.md`'s two tables. `list-wheel`'s `live` is the GitHub Pages URL, not
  `wheel.cuatro.dev`: that is a recorded deviation from `epics.md:2155-2156` and Story 2.25 owns the
  change.
- A description of an application that has never run states what it is for, never behaviour anyone
  observed. NFR-9 puts honesty above completeness.
- Every new gate rule is demonstrated failing against a fixture that is removed in the same story,
  and carries a standing case in `ops/__tests__/registry-schema.test.ts`.

**Ask First:**

- Any `status`, `live`, `source`, `tech`, `demo` or `identity` value that `ops/registry-inputs.md`
  does not already state, and any change to the fourteen-application set.
- Any change to AD-3 beyond ruling 1's narrowing, and any change to the `id`, `live` or `source`
  patterns in `contracts/registry.schema.json`.
- Adding a dependency to `ops/registry-schema.mjs`, `ajv` included, or adding a CI job.

**Never:**

- Do not edit `content/projects.ts`, `app/`, `components/`, `public/`, `packages/` or `tests/`. The
  Hub still reads the TypeScript module until Story 2.7, and nothing rendered changes here.
- Do not author a `description` that is four sentences, uses first person, or carries a superlative:
  `EXPERIENCE.md:234-240` names "powerful", "seamless", "cutting-edge", "modern", "beautiful" and
  "blazing" specifically.
- Do not give `family` to `tcg-tracker`. `epics.md:2216` is explicit: it is `Archived` with
  `absorbed_into`, which is a different relationship from family membership.
- Do not repair the four private `source` links or make any repository public. They are **KV-2**,
  ruled tolerated, and are authored as they are.
- Do not add a check holding `ops/registry-inputs.md` equal to `contracts/registry.json`. Considered
  and deferred by the Operator on 2026-09-03; it stays stated limit 1 of that record.
- Do not add a file under `contracts/`. Three committed listings pin that folder path by path and a
  new file fails all three at once (`AGENTS.md:129-137`). Both files this story edits already exist.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The committed pair | Fourteen entries against the tightened schema | exit 0, `14 applications, valid` | N/A |
| The Registry is emptied | `applications: []` | REFUSED, naming `/applications` and the `minItems` rule | Was a pass before this story; the inversion is the point of DW-26 |
| `absorbed_into` names nothing | An entry with `absorbed_into: ghost-app` | REFUSED, naming the pointer, the missing id, and the rule as beyond the schema | Draft-07 cannot express it |
| An entry absorbs itself | `id` and `absorbed_into` equal | REFUSED on the same rule | A self-reference resolves and is still wrong |
| A family of one | Exactly one entry carries a given `family` | REFUSED, naming the value and the one index holding it | A grouping key that groups nothing is a typo in one of two entries |
| Two entries share an id | Unchanged from Story 2-3 | REFUSED, still naming both indexes | The pre-existing structural rule keeps its message |

</frozen-after-approval>

## Code Map

- `contracts/registry.json`: the deliverable. Today the four-line envelope at `:1-5`. `$schema` is
  unchanged and `applications` is filled. `contract_version` moved `1.0.0` to `1.1.0` at the review
  pass, by Operator ruling; see the Spec Change Log.
- `contracts/registry.schema.json`: `:20-24` the `applications` array, which gains `minItems: 1` and
  loses the sentence at `:22` saying no `minItems` is set yet. `:30-39` the eight required fields;
  `:42-45` the `id` pattern that ruling 1 leaves alone; `:106-115` `family` and `absorbed_into`,
  whose descriptions gain the reference rule. **Read only otherwise:** widening a pattern is Ask
  First.
- `ops/registry-inputs.md`: the record to transcribe. `:60-75` status, `live` and `source` for all
  fourteen; `:77-82` the capitalisation rule for `source`; `:91-106` `tech`, `demo` and `identity`;
  `:335-350` stated limit 0, the AD-3 conflict ruling 1 closes; `:388-417` the Handover, which names
  `absorbed_into`, `family`, the `minItems` tightening and KV-2.
- `ops/registry-schema.mjs`: `:52-54` `BEYOND_THE_SCHEMA`, whose text says "the one rule this gate
  applies beyond the schema" and stops being true here. `:745-773` `duplicateIds`, the shape to copy
  for the new rules, exported and asserted by name. `:851` the line that composes `validate` with
  the structural rules, which the new ones join. `:42-43` fixed paths; nothing is redirectable.
- `ops/__tests__/registry-schema.test.ts`: **three standing cases invert here.** `:118-128` asserts
  `applications` is `[]` and `minItems` is undefined; `:130-137` asserts an empty list passes with
  `0 applications`; `:109-116` reads the entry count. `:75-85` the `entry()` fixture and `:88-89`
  `envelope()`, which every new case reuses. `:585-594` the duplicate-id case, which pins
  `BEYOND_THE_SCHEMA` verbatim. `:256-305` and `:307-338` pin the keyword set: `minItems` is already
  in both lists, so no keyword changes.
- `ops/registry-schema.md`: `:187-198` "The one rule beyond the schema", now three rules.
  `:200-249` the demonstration, whose quoted output carries the old sentence and the
  `0 applications` pass line. `:331` the stated limit saying `minItems` is deliberately absent.
  `:348` pending action 3, owned by this story.
- `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`:
  `:98` AD-3's rule sentence, "equal to its repository name", which ruling 1 narrows. `:248` restates
  the same rule in the conventions table and moves with it.
- `_bmad-output/implementation-artifacts/deferred-work.md`: `:1443-1460` DW-26, `:1462-1480` DW-27,
  and `:1555-1577` the AD-3 entry Story 2-4 filed. All three close here. Format is
  `status: open` to `status: done`, following DW-30 at `:1554`.
- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md:229-258`:
  **read only.** FR-8's contract and the six drafts.
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:592-618`: **read
  only.** Section 5.1's dispositions, the material behind the other eight descriptions.

## Tasks & Acceptance

**Execution:**

- [x] `contracts/registry.json`: author the fourteen entries. Ids lowercase kebab-case per ruling 1;
      `source` at real capitalisation per ruling 2; `status`, `live`, `tech`, `demo` and `identity`
      transcribed from `ops/registry-inputs.md`. `family: tracker-family` on `cuatro-tracker`,
      `cs-tracker` and `poketracker-go` only. `absorbed_into` on `tcg-tracker` (`cuatro-tracker`) and
      `connect-four-react` (`cuatro-portfolio`). `token_contract: "1.0.0"` on `cs-tracker` only.
      Descriptions per ruling 3. Envelope unchanged.
- [x] `contracts/registry.schema.json`: add `minItems: 1` to `applications` and rewrite its
      description to say why it is set now rather than why it is absent. Extend the `family` and
      `absorbed_into` descriptions with the reference rule the gate now applies.
- [x] `ops/registry-schema.mjs`: reword `BEYOND_THE_SCHEMA` for three rules rather than one, and add
      the reference and family rules beside `duplicateIds`, exported by name, each naming its rule in
      the refusal. Add nothing else and import nothing new.
- [x] `ops/__tests__/registry-schema.test.ts`: rewrite the three inverted cases so each asserts the
      new truth and says why it changed, and add one standing case per new matrix row.
- [x] `ops/registry-schema.md`: retitle and rewrite "The one rule beyond the schema" for three;
      re-run the demonstration against a fixture exercising the two new rules and record its output
      with today's date, keeping the 2026-08-29 run as history; move the `minItems` row out of Stated
      limits into the record of what the schema now asserts; close pending action 3 with its UTC date.
- [x] `ops/registry-inputs.md`: rewrite stated limit 0 as resolved, recording ruling 1, its date, the
      two alternatives rejected and that `source` capitalisation is deliberate. Note in the Handover
      that the transcription happened and on what commit.
- [x] `ARCHITECTURE-SPINE.md`: narrow AD-3's rule at `:98` and the conventions row at `:248` to the
      lowercase kebab-case form of the repository name, with a dated clause recording the ruling and
      the four applications that forced it. Change nothing else in the file.
- [x] `deferred-work.md`: flip DW-26, DW-27 and the AD-3 entry to `status: done`, each with one line
      naming this story. Do not touch any other entry.

**Acceptance Criteria:**

- Given `node ops/registry-schema.mjs`, when it runs against the committed tree, then it exits 0 and
  prints `14 applications, valid, no duplicate id`.
- Given `contracts/registry.json`, when it is read, then every entry carries the eight required
  fields, exactly three carry `family`, exactly two carry `absorbed_into`, one carries
  `token_contract`, and every `id` matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Given each of the fourteen entries, when its `status`, `live`, `source`, `tech`, `demo` and
  `identity` are compared cell by cell against `ops/registry-inputs.md:60-106`, then they agree, and
  the four `source` links KV-2 names are present and unrepaired.
- Given every `description`, when each is read, then it is one to three sentences, carries no
  superlative and no first person, leads with the thing itself, and the six at `EXPERIENCE.md:247-252`
  appear verbatim.
- Given `corepack pnpm test --run`, when it runs, then it passes, and `registry-schema.test.ts`
  carries a failing-then-passing case for each of `minItems`, a dangling reference, a self-reference
  and a family of one.
- Given `git status --porcelain`, when it is read, then nothing under `app/`, `components/`,
  `content/`, `public/`, `packages/` or `tests/` has changed, no file was added under `contracts/`,
  and no dependency was added.

## Spec Change Log

- **2026-09-03, implementation.** The spec pointed at `prd.md:592-618` for the eight descriptions it
  had to author, and that source does not contain them. PRD section 5.1 gives a disposition and a
  stack per application and says nothing about what any of them does for a person, which is the one
  thing FR-8 asks for. Four entries (`streamvault`, `maicoin`, `poketracker-go`, `mutuo`) had no
  usable material anywhere in the repository, and the work halted rather than inventing one.
  **The Operator supplied the real source**: a per-project architecture guide under
  `C:\Development\<project>\`, outside this repository. Seven of the eight descriptions now come
  from those guides, compressed to FR-8's shape, and `ops/registry-inputs.md` records which source
  each of the fourteen came from. `tcg-tracker` is the only entry with no source behind its
  description, which is the same position its `tech` array is already in.
- **2026-09-03, implementation.** Ruling 3 was made before anyone had compared the six
  `EXPERIENCE.md` drafts against their repositories, and **two of them contradict theirs**.
  `cs-tracker`'s repository says "Personal CS2 skins tracker, single-user, local-only" where the
  draft says it tracks "matches and player statistics"; `cuatro-tracker`'s says it is a media
  tracker for "movies, TV shows, anime, manga, and video games" where the draft says "collections
  and what is still missing from them". Put to the Operator and ruled: **ship both verbatim as the
  ruling says, and record the contradiction for Story 2.6**, on the ground that 2.6 confirms
  against the running software and GitHub metadata is a weaker source than either the draft or the
  application. Both are named in `ops/registry-inputs.md` so 2.6 starts there.
- **2026-09-03, implementation.** The Code Map predicted three standing cases would invert and
  **a fourth did**. `registry-schema.test.ts:509` asserts the byte-order-mark path passes and
  checked for `0 applications` against the committed file, so it broke on the entry count rather
  than on anything about an invisible character. It now matches `\d+ applications, valid`, which is
  the same choice the first case already made and which keeps adding an application from being a
  failure in an unrelated case.
- **2026-09-03, implementation.** `minItems: 1` falsified a sentence in the gate's own refusal text,
  which no task named. The missing-file branch told an operator that "an empty application list is
  not that: zero entries is a fact about the data, and Story 2.5 is what changes it." Story 2.5 did
  change it, so the sentence was describing the opposite of the behaviour it shipped beside. It now
  says an empty list is a refusal too and that this branch means zero **bytes** were read.
- **2026-09-03, implementation.** The green line said "no duplicate id" while the gate applied one
  rule beyond the schema. With three, a pass claiming less than the run actually checked is the
  same defect as a gate green over a rule it never applied, so it now reads "no duplicate id, every
  reference resolves". The AC quoting the old phrase still holds: it is a substring of the new one.
- **2026-09-03, implementation.** `family` is deliberately **not** held to naming an existing entry,
  though DW-27 grouped it with `absorbed_into` as a reference. `tracker-family` is the id of none of
  its three members, and nothing in FR-11 makes a family key a reference to an application, so the
  rule is "a value is shared" rather than "a value resolves". Recorded in `ops/registry-schema.md`
  as its own note, because it is the obvious next tightening and it would be wrong.
- **2026-09-03, implementation.** Three `tech` arrays look thin beside their project guides and
  **none was changed**, because changing one is a change to `ops/registry-inputs.md` and Ask First.
  `poketracker-go`'s guide names Flutter and a Python Discord bot beside the Go backend; `Mutuo`'s
  names PostgreSQL, which is in neither its array nor the record's store list; `Lumen`'s names
  Tauri, Rust and React for a repository holding no code, which is why its array is right to stay
  `Markdown · WSL2`. The arrays were read from real manifests and a guide is a plan, so the record
  is probably correct and the discrepancy is still worth the next reader's attention. Recorded in
  `ops/registry-inputs.md`.

- **2026-09-03, review.** All three review layers independently found the same defect, and it is the
  one that mattered: **`contracts/registry.schema.json`'s `id` description still said an id is
  "equal to its repository name"**, the exact half ruling 1 narrowed. The spec's Code Map named
  "`:42-45` the `id` pattern that ruling 1 leaves alone", which is true of the pattern and silent
  about the description beside it, and the same task did update the `family` and `absorbed_into`
  descriptions. It is not inert prose: `registry-schema.mjs` prints a schema node's `description` as
  the third line of every violation, so refusing `"id": "StreamVault"` would have quoted the
  superseded rule back at the author, for the exact repository the ruling was made about. It is also
  on the published surface that other estate languages validate against, which is the copy licensing
  a consumer to rebuild `source` from `id` and give four entries a 404. Patched rather than
  loop-backed: the ruling is frozen and unambiguous, so there was exactly one correct sentence to
  write, and re-deriving nine verified files to fix it would have been disproportionate.
  **KEEP:** the `id` description must state the operation *and* the "never rebuild `source` from an
  id" consequence, because that is the only place a consumer outside this repository can read it.
- **2026-09-03, review.** The AD-3 narrowing as first written was circular ("lowercase kebab-case,
  being the lowercase kebab-case form of its repository name") and did not decide `streamvault`
  against `stream-vault`, so it left open the very question it was ruled to close. Reworded to the
  operation actually applied: the repository name lowercased, keeping exactly the hyphens it already
  carries and adding none. **KEEP:** state it as an operation, never as a name for a convention.
- **2026-09-03, review.** Two reviewers flagged `contract_version` staying at `1.0.0` while the file
  went from an empty envelope to fourteen entries and gained `minItems`. The field's own description
  says a value change is a minor bump, and AD-4 has Satellites fetching this file at build time with
  no other signal. Put to the Operator and **ruled: bump to `1.1.0`**. The spec's task said "envelope
  unchanged", which was written to mean `$schema` and the file's shape rather than its version.
- **2026-09-03, review.** Six verification gaps were closed with cases rather than prose. The one
  worth naming: **ruling 2 had no test at all.** "Never rebuild a `source` from an `id`" lived only
  in three prose files, and a later "make the URLs consistent" edit would have lowercased four
  `source` values, given each a 404 and left the gate and the whole suite green, since no pattern
  constrains capitalisation and FR-32's link check is Story 2.23. A case now pins the four literal
  URLs and the general rule. Also added: `BEYOND_THE_SCHEMA` asserted on the two refusals that
  carried it unpinned, a `lonelyFamilies` wrong-type case matching its sibling's, and one case
  exercising all three structural rules in a single run.
- **2026-09-03, review.** Four records outside the spec's Code Map were falsified by this change and
  are corrected: `ops/known-violations.md`'s KV-2 said "the Registry is `applications: []` until
  Story 2-5, so nothing is currently failing it" when four non-resolving `source` links now ship;
  `ops/contract-adoption.md` twice said `token_contract` "does not exist yet"; `ops/estate.md` spoke
  of the transcription in the future tense; and `ops/registry-schema.md`'s pending action 5 asked to
  be done "before Story 2.5 writes the real entries". None was in scope, all four were made wrong
  here, and this estate's whole idiom is that a record claiming something false is the defect.
- **2026-09-03, review.** `connect-four-react`'s description asserted "It is archived" while
  `ops/registry-inputs.md` records that the repository is **not** archived yet, observed 2026-09-02.
  `status: Archived` is the decided disposition; the description stated it as an observed property.
  Reworded to "retired as a standalone application". This is precisely the class of error Story
  2-4's review found four of, in records whose only value is that their claims are true.
- **2026-09-03, review.** Two claims this story made about its own demonstration were not true as
  written and are fixed: fixture B's quoted output was three lines and only two were recorded, and
  the restoration digest was elided to `FF80DCDA...814D1CB5`, which no later reader can re-check,
  in a sentence whose whole point was that the restoration is checkable. The demonstration was
  re-run against the final tree and the full digest recorded.
- **2026-09-03, review.** Eight findings were deferred rather than patched, all filed in
  `deferred-work.md` rather than only in `ops/`, which is DW-26's own argument applied to this
  story's leftovers. The two that matter most: **`epics.md:2202-2204` still states this story's
  acceptance as "each id matches its repository name exactly"**, which four shipped entries
  deliberately do not satisfy, so the spine and the epic now disagree and the epic is what the
  remaining Epic 2 stories are specced from; and **the `token_contract` value has nothing holding it
  equal to the vendored header**, so `ops/contract-adoption.md`'s runbook step 5 is the only thing
  keeping them in step and nothing turns red if it is skipped.

## Design Notes

**Why the ids move and the repositories do not.** AD-3 asserts two things that cannot both hold for
`Lumen`, `StreamVault`, `MaiCoin` and `Mutuo`. Every identifier AD-3 derives from an id (GHCR image,
compose service, Traefik router, Postgres role, Clerk client) is already lowercase in practice, so
narrowing the second half costs nothing downstream, while renaming four repositories breaks three
`source` links that already do not resolve for other reasons. Ruling 2 is what keeps the drill-through
correct: `id` and `source` are now deliberately different strings for those four, and a later reader
who "fixes" that by lowercasing the URLs gives four entries a 404.

**Why an empty Registry has to become a refusal.** The gate's own argument is that a green run must
mean something was read. That held while zero entries was the honest state of a file nobody had
authored. Once fourteen entries exist, an edit that empties the array is a Registry that describes
nothing, and the Hub renders an empty Suite Directory from a green build. The case at `:130-137`
therefore does not get deleted: it gets inverted, and keeps its comment explaining that the
distinction between "a missing file" and "zero entries" was real and is now spent.

**Why a family of one is a refusal rather than a warning.** `family` groups; a value carried by a
single entry means the second member was misspelled or dropped, which is exactly the class of defect
draft-07 cannot see and the editor will not catch. The same argument justified the duplicate-id rule,
and DW-27 records that it belongs beside it.

## Verification

**Commands:**

- `node ops/registry-schema.mjs`: exits 0, printing `14 applications`. Run it before the suite: its
  refusal names the offending JSON Pointer where a test failure only reports an expectation.
- `corepack pnpm test --run`: passes. `registry-schema.test.ts` is the real check.
- `node -e "const r=require('./contracts/registry.json');console.log(r.applications.length,r.applications.filter(a=>a.family).length,r.applications.filter(a=>a.absorbed_into).length,r.applications.filter(a=>a.token_contract).length)"`:
  prints `14 3 2 1`.
- `git status --porcelain | Select-String '^\s*[MADRC?]+\s+(app|components|content|public|packages|tests)/'`:
  no output, which is the last acceptance criterion as a command.
- `git status --porcelain -- contracts/`: exactly two modified paths and no untracked one.

**Manual checks:**

- Re-read each entry against `ops/registry-inputs.md` cell by cell rather than by memory of the
  table. Transcription is this story's entire job and a wrong `tech` value is an FR-9 defect.
- Confirm the demonstration output recorded in `ops/registry-schema.md` was pasted from a real run of
  this story's fixture and that the fixture is gone from the tree afterwards.

## Suggested Review Order

**The one decision that shaped everything else: AD-3's narrowing**

- The ruling in full, with both rejected alternatives and why each lost.
  [`registry-inputs.md:336`](../../ops/registry-inputs.md#L336)

- The spine amended to match. An operation, not a name for a convention.
  [`ARCHITECTURE-SPINE.md:99`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L99)

- The published schema's own `id` prose. All three reviewers found this stale.
  [`registry.schema.json:46`](../../contracts/registry.schema.json#L46)

- Where it bites: `id` and `source` deliberately differ. Lowercasing these 404s them.
  [`registry.json:85`](../../contracts/registry.json#L85)

**The deliverable**

- Fourteen entries. Compare cell by cell against `ops/registry-inputs.md`, not by memory.
  [`registry.json:5`](../../contracts/registry.json#L5)

- `contract_version` moved to 1.1.0 at review, by ruling. The only signal a Satellite gets.
  [`registry.json:3`](../../contracts/registry.json#L3)

- Which source each of the fourteen descriptions came from, and the three weakest.
  [`registry-inputs.md:443`](../../ops/registry-inputs.md#L443)

**The gate, now three rules instead of one**

- The two new rules, and why draft-07 can express neither.
  [`registry-schema.mjs:823`](../../ops/registry-schema.mjs#L823)

- A family of one is a refusal: the field cannot mean a group of one.
  [`registry-schema.mjs:880`](../../ops/registry-schema.mjs#L880)

- Where they compose with the schema pass, and the shared sentence all three carry.
  [`registry-schema.mjs:991`](../../ops/registry-schema.mjs#L991)

- `minItems: 1`, the tightening DW-26 booked for this story.
  [`registry.schema.json:22`](../../contracts/registry.schema.json#L22)

**What the gate deliberately does not do, which is the part worth arguing with**

- The rule reads one hop. A chain passes, and a two-entry cycle passes.
  [`registry-schema.md:217`](../../ops/registry-schema.md#L217)

- `minItems` is a partial mitigation: fourteen entries cut to one still validates.
  [`registry-schema.md:191`](../../ops/registry-schema.md#L191)

**Records this change falsified elsewhere, all outside the spec's scope**

- KV-2 said nothing was failing SM-4 yet. Four broken `source` links now ship.
  [`known-violations.md:220`](../../ops/known-violations.md#L220)

- The runbook step that keeps `token_contract` honest, and nothing turns red if it is skipped.
  [`contract-adoption.md:407`](../../ops/contract-adoption.md#L407)

**Peripherals**

- The demonstration re-run, with the full digest proving the fixtures are gone.
  [`registry-schema.md:283`](../../ops/registry-schema.md#L283)

- The case that stops a future refactor 404ing four `source` links.
  [`registry-schema.test.ts:153`](../../ops/__tests__/registry-schema.test.ts#L153)

- An empty list inverted from a pass to a refusal, keeping the reason it was once right.
  [`registry-schema.test.ts:139`](../../ops/__tests__/registry-schema.test.ts#L139)

- All three structural rules in one run, so none can mask another.
  [`registry-schema.test.ts:684`](../../ops/__tests__/registry-schema.test.ts#L684)
