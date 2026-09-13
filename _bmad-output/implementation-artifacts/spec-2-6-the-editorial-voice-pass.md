---
title: 'Story 2.6: The editorial voice pass'
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: '4b71ae29ff77509ea61fea622d39aca4d40f3d47'
review_loop_iteration: 1
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Story 2-5 authored fourteen `description` values under a ruling that deferred their
confirmation to this story, and three of them are refuted by the thing they describe: `cs-tracker`
names an application that does not exist, `cuatro-tracker` names a model the schema does not have,
and `cuatro-portfolio` contradicts the Registry it is an entry in. Five more end with the same
sentence. Underneath all of it, FR-8 is asserted by nothing: the contract lives as prose in a schema
annotation no rule reads, so entry fifteen ships four sentences of marketing green.

**Approach:** Confirm all fourteen against a recorded source of record, correct what the evidence
refutes, and add the mechanizable half of FR-8 as a fourth rule in the registry-schema gate, beside
the three Story 2-5 added and demonstrated the same way.

## Boundaries & Constraints

**Always:**

- **The governing wording is `EXPERIENCE.md:234-240`**, which wins any behaviour question. It bans
  six adjectives ("powerful", "seamless", "cutting-edge", "modern", "beautiful", "blazing"); the PRD
  names three and `epics.md:2254-2255` follows EXPERIENCE.md. Its fourth rule is "Leads with the
  thing itself"; "not with a category" is the PRD's gloss at `prd.md:238`, not normative text.
  UX-DR38 exists only at `epics.md:614-616` and nowhere in the UX artifacts.
- **Two punctuation rules apply to different things and do not conflict.** A `description` is a
  product string and takes typeset `—`, `…` and curly quotes, never `"`, `--` or `...`. Prose written
  into this repository (this spec, the `ops/` records, the commit subject) takes no dash at all.
  `DESIGN.md:492-497` states the reconciliation; cite it, or the next reader reads UX-DR38 as
  contradicting `AGENTS.md:23-25`.
- **Evidence ladder, recorded per entry**: the local checkout of the deployed code first, then the
  project guide under `C:\Development\<project>\`, then nothing. Name the tier that settled each of
  the fourteen. For a deployed application the checkout is the software that is running; four of the
  six sit behind a login and no demo account exists in the estate until Story 5.8.
- Every new gate rule is demonstrated failing against a fixture removed in the same story, and
  carries standing cases in `ops/__tests__/registry-schema.test.ts`.
- **The green line enumerates rather than counts** (`ops/registry-schema.md:343-347`). A fourth rule
  extends the clause list or leaves a visible gap.
- Where `ops/registry-inputs.md` and the Registry disagree, the Registry is what ships and the record
  is what should have caught it (`ops/registry-inputs.md:447-449`).

**Ask First:**

- Any change to `tech`, `status`, `live`, `source`, `demo`, `identity`, `family` or `absorbed_into`.
  Those are `ops/registry-inputs.md`'s values and changing one is a change to that record.
- Moving `contract_version`. Story 2-5 moved it to `1.1.0` by ruling; a text-only pass may not need a
  bump and the field's own description says a value change is a minor one.
- Mechanizing any rule that needs judgement: "leads with the thing itself", "no invented number", or
  a status-synonym word list. Each would refuse honest prose.
- Adding a dependency to `ops/registry-schema.mjs`, or a CI job.

**Never:**

- Do not edit `content/projects.ts`. Its description is the register FR-8 forbids and Story 2.7
  retires the file whole, so editing it now is work thrown away (`ops/registry-inputs.md:152-153`).
- Do not edit `app/`, `components/`, `public/`, `packages/` or `tests/`. Nothing rendered changes
  here; the Hub still reads the TypeScript module until Story 2.7.
- Do not add a file under `contracts/`. Three committed listings pin that folder path by path and a
  new file fails all three at once (`AGENTS.md:129-137`).
- Do not lowercase a `source` URL to match an `id`. Four of them would 404
  (`ops/registry-inputs.md:370-373`).
- Do not retire stated limit 7 of `ops/registry-schema.md` (`:443`, "the gate says nothing about
  whether an entry is true"). An editorial rule constrains form, never truth, and the limit survives
  this story. Reword it so it does not read as contradicting the new rule.
- Do not repair `list-wheel`'s `tech` or any other non-description defect found on the way. Record it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The committed pair | Fourteen corrected descriptions against the four-rule gate | exit 0, and the green line names the editorial rule | N/A |
| A four-sentence description | Any entry whose `description` carries four sentence terminators | REFUSED, naming the pointer, the count and FR-8 | The rule FR-8 states as "Never four" |
| A banned adjective | `description` carrying one of the six as a **whole word**, any case | REFUSED, **naming the text it matched**, not the stem it matched against | FR-8 bans six words by name. `"modernization"` and `"trailblazing"` are honest prose and pass; `"blazingly"` passing with them is the accepted cost, because a gate that refuses honest prose is switched off rather than read |
| First person | `description` carrying `i`, `we`, `us`, `our`, `ours`, `my`, `mine`, `me`, `myself` or `ourselves` at a word boundary | REFUSED on the same rule | `"Wednesday"` and `"we"` must not collide, nor `"four"` and `"our"`: word boundaries, never substrings |
| Untypeset punctuation | `name` or `description` carrying `"`, `--` or `...` | REFUSED, naming the form and its typeset replacement | **Human-readable copy only.** UX-DR38 governs what a Visitor reads. A `source` or `live` URL, an `id`, a `family` or an `absorbed_into` is machine-readable: an em dash inside a URL breaks the link, so refusing one for a double hyphen demands a repair that 404s the entry, which `epics.md:2271` cannot have meant |
| A terminator the other half mandates | `description` ending in `…`, or in a terminator followed by a closing curly quote or bracket | Counted as a sentence and **passes** | The two halves of one rule may never contradict each other on a shape the rule itself forces the author to write |
| A conforming description | The corrected fourteen, and the suite's own `entry()` fixture | Passes, adding no violation | The positive control: every standing case in the file runs through that fixture |

</frozen-after-approval>

## Code Map

- `contracts/registry.json`: the deliverable. Fourteen `description` values. The three refuted are
  `:31` (`cs-tracker`), `:19` (`cuatro-tracker`) and `:8` (`cuatro-portfolio`). The repeated closing
  sentence is at `:77`, `:87`, `:97`, `:107` and `:118`. `:138` (`tcg-tracker`) states an intent in
  the present tense where its sibling `:149` (`connect-four-react`) already words the same
  relationship as intent. **Every other field is read only.**
- `ops/registry-schema.mjs`: `:880-910` `lonelyFamilies`, the shortest of the three rules and the
  shape to copy: returns `Violation[]` with `schema: null`, a short `rule` name, a `detail` citing an
  FR, and `note: BEYOND_THE_SCHEMA`. `:786-790` `applicationsOf` and `:802-806` `fieldOf` are the
  helpers a fourth rule reuses; both return `null` so a type defect stays the schema's to report.
  `:988-993` the array the new rule joins. `:55-57` `BEYOND_THE_SCHEMA`, whose text says "the three
  rules" and moves again. `:1116-1119` the green line. `:38-40` the only imports; add none.
- `contracts/registry.schema.json`: `:53-57` the `description` node, `type` and `minLength: 1` and an
  annotation asserted by nothing. It is the string the gate prints as the third line of every
  refusal, so it teaches the author. `maxLength` is **not** in the implemented keyword set
  (`ops/registry-schema.mjs:241-265`) and adding it to the schema is itself a refusal.
- `ops/__tests__/registry-schema.test.ts`: `:76-87` the `entry()` fixture, whose own `description` at
  `:80` feeds all 87 cases and must pass the new rule. `:89-91` `envelope()`, `:93-94` `against()`.
  `:666-682` the representative structural-rule case. `:684-704` the all-rules-in-one-run case, which
  asserts `'4 violations'` and moves. **Hazard:** any existing fixture that overrides `description`
  now risks a second violation and a changed count; check every override before adding cases.
  `:110` the committed-Registry block, where "every shipped description conforms" belongs.
  `:1248` the CI wiring block; no job is added, so its job-name set does not move.
- `ops/registry-schema.md`: `:191` "The three rules beyond the schema", the heading, its `:193`
  sentence and the `:201-205` table. `:283` the 2026-09-03 demonstration, the precedent to follow:
  plant, run, quote verbatim, restore, verify by SHA-256, quote the new pass line. `:443` stated
  limit 7. `:398-404` and `:413-420` the case-count tables. `:459` pending action 5, which names this
  story's window.
- `ops/registry-inputs.md`: `:456-460` the source of each of the fourteen descriptions. `:462-484`
  the three contradictions and the ruling handing them here. `:486-491` the repeated sentence.
  `:399-400` stated limit 6, which this story's evidence ladder narrows rather than closes.
  `:447-449` the precedence when this record and the Registry disagree.
- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md:229-258`:
  **read only.** FR-8 verbatim, the six drafts, and the `digital-library` non-grandfathering clause.
- `.../ux-designs/.../DESIGN.md:491-497`: **read only.** The typeset rule and its reconciliation with
  the house writing rule.
- `_bmad-output/implementation-artifacts/deferred-work.md`: `:1717-1736` the entry Story 2-5 filed
  for this story, which closes here. `:1738-1756` the thin `tech` arrays, which do not.

**Evidence located, by tier.** Local checkout: `cs-tracker` (`C:\CuatroEcosystem\cs-tracker-workspace`,
contexts `catalog`/`inventory`/`wishlist`/`prices`, no match or player anywhere), `cuatro-tracker`
(`prisma/schema.prisma`, `enum MediaType` of five types on a release-date timeline),
`digital-library`, `cs-tournament` (use the route tree, its README is stale), `list-wheel`,
`cuatro-portfolio`, `connect-four-react`. Guide only: `cuatro-finance`, `streamvault`, `maicoin`,
`mutuo`, `lumen`, and `poketracker-go` (its guide is an unconverted binary `.docx`; the workspace
`CLAUDE.md` is the readable substitute and confirms the shipped text). Nothing: `tcg-tracker`, whose
tree holds no product evidence at all.

## Tasks & Acceptance

**Execution:**

- [x] `contracts/registry.json`: correct the three refuted descriptions against the checkout that
      settled each, cut the repeated closing sentence from the five entries carrying it, reword
      `tcg-tracker` as intent, and bring all fourteen to FR-8's shape. Change no other field.
- [x] `ops/registry-schema.mjs`: add the editorial rule beside `lonelyFamilies`, exported by name,
      asserting only the mechanizable half: one to three sentences, the six adjectives, first person,
      and the three untypeset forms. ~~The punctuation half reads every Registry string~~ **superseded
      at the review: the punctuation half reads `name` and `description`**, per the Change Log entry
      below; the rest reads `description`. Each refusal names what it found. Reword
      `BEYOND_THE_SCHEMA` and extend the green line's clause list. Import nothing new.
- [x] `ops/__tests__/registry-schema.test.ts`: one refusal case per matrix row, a positive control, a
      case asserting the shipped fourteen conform, and the all-rules-in-one-run case updated. Check
      every existing `description` override first: a fixture that now trips two rules changes a count
      another case asserts.
- [x] `ops/registry-schema.md`: retitle the section for four rules, add the table row, re-run the
      demonstration against a fixture exercising the new rule and record its output with today's
      date, keeping both prior runs as history. Reword stated limit 7 so form and truth are
      distinguished. Update the case-count tables. Close pending action 5 or record why it stays open.
- [x] `ops/registry-inputs.md`: record the per-entry check and the tier that settled it, resolve the
      three contradictions with the evidence, and narrow stated limit 6 to what the ladder actually
      establishes. Do not restate the descriptions; the Registry is what ships.
- [x] `deferred-work.md`: flip the entry at `:1717-1736` to `status: done`, and file what this pass
      found and may not fix, `list-wheel`'s `RxJS` against a signals-first README among it.

**Acceptance Criteria:**

- Given `node ops/registry-schema.mjs`, when it runs against the committed tree, then it exits 0 and
  its green line names four rules rather than three.
- Given each of the fourteen descriptions, when it is read against `EXPERIENCE.md:234-240`, then it is
  one to three sentences, carries none of the six adjectives and no first person, and leads with the
  thing itself.
- Given `cs-tracker`, `cuatro-tracker`, `cuatro-portfolio` and `tcg-tracker`, when each is read
  against the evidence recorded for it, then it states what that evidence supports and nothing more.
- Given the five entries that shared a closing sentence, when they are read together, then no
  description restates what `status` and `demo` already carry on the same entry, and no sentence
  appears verbatim on more than one entry.
- Given `corepack pnpm test --run`, when it runs, then it passes, and `registry-schema.test.ts`
  carries a failing-then-passing case for each row of the matrix.
- Given `git status --porcelain`, when it is read, then nothing under `app/`, `components/`,
  `content/`, `public/`, `packages/` or `tests/` has changed, no file was added under `contracts/`,
  and no dependency was added.

## Spec Change Log

- **2026-09-03, review.** All three layers converged on one defect and two of them proved it by running
  the module: **the rule refuses the punctuation its own other half mandates.** A `description` ending
  in `…`, or in a terminator followed by a closing curly quote, counts as zero sentences and is refused
  citing "never four", while the punctuation half forces the author to write exactly those forms. No
  wording satisfies both. The frozen matrix never considered the interaction, so a row was added fixing
  the resolution: the two halves of one rule may never contradict each other on a shape the rule itself
  mandates. **KEEP:** the code-point technique in `UNTYPESET`, which lets one source file carry a rule
  about a character `AGENTS.md` forbids it to contain.
- **2026-09-03, review.** Three matrix rows were written as examples and implemented as definitions,
  which is the spec's fault rather than the implementer's. The first-person set was the literal four
  words the row listed, so `us`, `me` and `mine` shipped through a rule advertised as banning first
  person. The adjective row said "any case" and got substring matching, which refuses `modernization`
  and `trailblazing`, and reports the banned stem rather than the text it matched, contradicting this
  spec's own Design Note that a gate which cannot name what it found teaches nothing. **Renegotiated
  with the Operator**: whole-word matching, naming the matched text, with `blazingly` passing as the
  accepted cost. **KEEP:** state a matrix input as the rule's definition or as an example, never
  ambiguously, when the row is the only place the rule's breadth is written down.
- **2026-09-03, review.** The typeset rule read every string in the Registry, `source` and `live` URLs
  included, so a repository whose name carries a double hyphen is an **unfixable refusal**: the gate
  demands an em dash and this spec separately forbids altering a `source` URL. Nothing fails today,
  which is what makes it a trap rather than a bug. **Renegotiated with the Operator**: the rule reads
  `name` and `description` only. `epics.md:2271`'s "every string" governs copy a Visitor reads, and
  cannot have meant identifiers, because the repair it demands would 404 the entry.
- **2026-09-03, review.** Nine ordinary patches, of which two matter. The green line's new clauses are
  printed by `report()` unconditionally while the rule is wired into `inspect()`, so the positive
  control stays green with the rule unwired: the enumerated-line argument is defeated by its own
  implementation, and the record's "6 of the 8 went red" is really 5 of 8. And the underrun branch
  prints `0 sentence(s) ... says "never four"`, citing a rule the value did not break.
- **2026-09-03, review iteration 1 applied.** All thirteen findings addressed. The four rule
  definitions were corrected against the amended matrix and each correction was confirmed by running
  the module before and after. The nine corrected descriptions are byte-identical to the reviewed
  version, verified by SHA-256, whose digest is the one the demonstration records. Two
  findings were answered by recording rather than by code, as the review allowed: the straight single
  quote stays out of `UNTYPESET`, because the frozen matrix names three forms and widening a refusal
  past the row authorising it is how a gate starts refusing what nobody agreed to; and the
  repeated-sentence check stays a suite-only assertion, because a fifth rule is not what the matrix
  authorises. Both are now stated limits in `ops/registry-schema.md`. One finding was fixed
  structurally rather than by adding a case: `RULES_BEYOND_THE_SCHEMA` pairs each rule's function with
  the clause it contributes and `inspect()` reports the clauses of the rules it ran, so unwiring a rule
  now takes its clause off the green line and **10 cases go red instead of 5**. The fixture
  demonstration was re-planted, re-run and re-recorded from the real output.

**2026-09-03, implementation.** No change to the frozen intent. Three decisions taken inside its
boundaries, each recorded where a reader of the estate will find it rather than only here:

- **`contract_version` was not moved.** It is on the Ask First list, no Operator was reachable
  mid-flight, and the safe answer to an Ask First is the status quo. Filed as pending Operator action
  6 in `ops/registry-schema.md` and as a `deferred-work.md` entry.
- **`contracts/registry.schema.json` was not touched.** The Code Map's note that the `description`
  annotation "teaches the author" reads as an invitation to expand it, and the Verification section
  requires `git status --porcelain -- contracts/` to show exactly one modified path. The Verification
  section wins. The annotation still states FR-8 in summary and still asserts nothing, which is what
  an annotation does; the gate is what asserts now.
- **`lumen` and `connect-four-react` were not edited**, though both restate their `status`. Neither
  is in the set the Execution list names, neither shares a sentence with anything, and the acceptance
  criterion on restatement is scoped to the five entries that shared a closing sentence. Filed rather
  than fixed.

## Design Notes

**Why the sentence counter is honest here and would not be in general.** Counting terminators is a
naive way to count sentences: an abbreviation or a version number breaks it. It is safe against this
field precisely because FR-8 bans the thing that would break it. "The stack is the `tech` field's
job", so `Next.js` and `v1.2` cannot appear in a `description` without already being a defect. State
that dependency where the rule is documented, because it is the reason the rule can be trusted and
the reason it must never be lifted onto another field.

**Why the banned-word half cannot be a schema rule.** `not` with a `pattern` is implemented and would
bind, but the validator compiles patterns with no flags, so a case-insensitive list needs character
classes, and `not`'s refusal says only "this value matches a shape the schema forbids here". An
editorial gate that cannot name the word it found teaches nothing. The three existing rules live
outside the schema for the same reason.

**Why form and not truth.** The rule cannot know that `cs-tracker` tracks skins rather than matches;
that took a checkout. Stated limit 7 stays true and this story is the proof of it: every defect worth
finding here was found by a person reading a claim against its source, and none of them would have
turned the gate red. The rule stops the cheap regressions so the expensive check stays affordable.

## Verification

**Commands:**

- `node ops/registry-schema.mjs`: exits 0, green line naming four rules. Run it before the suite: it
  names the offending JSON Pointer where a test failure reports only an expectation.
- `corepack pnpm test --run`: passes. Expect roughly 898 cases plus the new ones.
- `node -e "const r=require('./contracts/registry.json');r.applications.forEach(a=>console.log(a.id,(a.description.match(/[.!?](\s|$)/g)||[]).length))"`:
  every count is 1, 2 or 3.
- `git status --porcelain -- contracts/`: exactly one modified path and no untracked one.

**Manual checks:**

- Read the fourteen in one pass, in file order, as a reader of the Directory would. The repeated
  sentence was invisible entry by entry and obvious in a column.
- Confirm the demonstration output in `ops/registry-schema.md` was pasted from a real run and that
  the fixture is gone from the tree afterwards, by the digest.

## Suggested Review Order

**The decision that shaped the rest: what a gate may and may not assert**

- Each rule paired with the green-line clause it earns, so deleting one takes its clause.
  [`registry-schema.mjs:1163`](../../ops/registry-schema.mjs#L1163)

- The fourth rule itself. Form only: it cannot know that a description lies.
  [`registry-schema.mjs:1059`](../../ops/registry-schema.mjs#L1059)

- Stated limit 7 survives this story and says why. Truth is still nobody's rule.
  [`registry-schema.md:641`](../../ops/registry-schema.md#L641)

**Where the review changed the rule, and the argument each time**

- Sentence end allows the closing punctuation the other half mandates. They contradicted.
  [`registry-schema.mjs:988`](../../ops/registry-schema.mjs#L988)

- Whole word, naming the text matched. Substring refused "modernization" and "trailblazing".
  [`registry-schema.mjs:932`](../../ops/registry-schema.mjs#L932)

- Ten pronouns, longest first. Four shipped, so "us", "me" and "mine" passed.
  [`registry-schema.mjs:956`](../../ops/registry-schema.mjs#L956)

- Typeset punctuation reads copy only. On a URL it demanded a repair that 404s.
  [`registry-schema.mjs:1010`](../../ops/registry-schema.mjs#L1010)

**The deliverable, which no gate could have found**

- Named an application that does not exist: no match or player anywhere in `lib/`.
  [`registry.json:31`](../../contracts/registry.json#L31)

- Named no medium, against a schema of five on one release-date timeline.
  [`registry.json:19`](../../contracts/registry.json#L19)

- Claimed the Hub lists what is running, refuted by the Registry it sits in.
  [`registry.json:8`](../../contracts/registry.json#L8)

- The per-entry evidence and the tier that settled each of the fourteen.
  [`registry-inputs.md:522`](../../ops/registry-inputs.md#L522)

**The demonstration, and the record of what the gate now holds**

- Planted, run, quoted verbatim, restored by digest. The third such run.
  [`registry-schema.md:457`](../../ops/registry-schema.md#L457)

- Four rules where there was one in August. The table gains its row.
  [`registry-schema.md:195`](../../ops/registry-schema.md#L195)

**Peripherals**

- The shipped fourteen asserted against the rule, sharing its sentence definition.
  [`registry-schema.test.ts:158`](../../ops/__tests__/registry-schema.test.ts#L158)

- The banned word refused by the author's own capitalisation, with honest prose passing.
  [`registry-schema.test.ts:844`](../../ops/__tests__/registry-schema.test.ts#L844)

- A URL carrying a double hyphen passes; a `name` carrying three periods does not.
  [`registry-schema.test.ts:914`](../../ops/__tests__/registry-schema.test.ts#L914)

- Filed, not fixed: a description and `absorbed_into` can contradict, and nothing reads both.
  [`deferred-work.md:1816`](deferred-work.md#L1816)
