---
title: 'DW-244: the homepage premise names every address below as running, not everything below'
type: 'bugfix'
created: '2026-09-25'
status: 'done'
baseline_commit: '760a3a61bd9e98b32880b4932c3233ed475e2fba'
review_loop_iteration: 1
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The premise on `/` says "Everything below is running right now", and since Registry
1.4.0 the Directory below it renders `cs-tournament` as `Complete`, running nowhere, so the page the
Epic 2 merge ships states something false (DW-244, the retrospective's merge condition (1)). No test
reads the claim against the rows, which is how every suite stayed green (retrospective E1).

**Approach:** Set the Operator's words (Operator ruling 2026-09-25): "[N] personal projects became
one suite. Every address below is running right now, so open one and you are using the real thing,
not looking at a picture of it." `[N]` stays derived as it is. Pin the words in the premise unit
test, add the E1 case holding every address the Directory draws to a `Live` row, amend
`EXPERIENCE.md`, and close the refs.

## Boundaries & Constraints

**Always:** every new assertion seen red first, its planted failure recorded beside it; records take
2026-09-25 and cite "Operator ruling 2026-09-25"; a planning document gets a dated amendment in its
own style; new comments cite code by symbol or test name, never by line number; no em-dash, en-dash,
double hyphen standing in for a dash, or emoji.

**Ask First:** nothing gates this unattended run. Each open question is resolved from the ruling,
then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:** no change to how `[N]` is derived, to the Directory count (stays `Live` rows only,
`5 running`), to `cs-tournament`'s `demo` (stays `not-deployed`), to the footer line, or to any
Registry value; no edit to dated history (specs, the retrospective's existing text, ledger evidence,
the 2026-08-15 mockups); no push, no pull request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Premise on `/` | committed Registry, 14 entries | `Fourteen personal projects became one suite. Every address below is running right now, so open one and you are using the real thing, not looking at a picture of it.` | N/A |
| Old words | `PREMISE` as at baseline | the copy case fails, printing both strings | N/A |
| An address on a row that is not `Live` | a rendered `Complete` entry carrying `live` | the E1 case fails naming the status | N/A |

</frozen-after-approval>

## Code Map

- `components/organisms/Premise/Premise.tsx`: `PREMISE`, the copy from "became" on, and its doc
  comment citing `EXPERIENCE.md:276-277`; the docblock paragraph "Nothing on this block states a fact
  of its own", which E1 found false of the running claim. `CvIntro.tsx` cites `Premise.tsx:55` and
  `:91-110`, so every edit above the render keeps the line count.
- `components/organisms/Premise/__tests__/Premise.test.tsx`: `opening()` composes `[N]` and its
  noun; no case pins the words. `SiteFooter.test.tsx`, `CvIntro.test.tsx` and
  `app/cv/__tests__/page.test.tsx` cite its lines, so no import line is added, and the header calls
  the source-scan block the last, so new cases go just before it.
- `components/organisms/SuiteDirectory/SuiteDirectory.tsx`: `SuiteDirectoryRow`, exported for
  planted rows, draws `.suite-directory__live` for any non-Hub entry with a `live` URL, the status on
  `.suite-directory__status[data-status]`. The schema lets a `Complete` entry carry `live`.
- `EXPERIENCE.md` § The premise, FR-4: the quote and its italic 2026-09-24 amendment. Code cites
  later lines of this file, so the edit keeps the line count.
- PRD FR-4, `epics.md` FR-4 and Story 2.11 state the constraints, never the sentence: no amendment.
- Records: `deferred-work.md` DW-244; `sprint-status.yaml` `epic-2-retro-item-1-...`;
  `epic-2-retro-2026-09-25.md`, appended to only.

## Tasks & Acceptance

**Execution:**
- [x] `Premise.test.tsx`: before the source-scan block, the exact-copy case, the E1 case over
  `renderedApplications` (a rendered entry carrying `live` must be `Live`), and its control, an entry
  with an address planted `Complete`. See the copy case red on the baseline, and the E1 case red with
  `cs-tournament` given a `live` URL in a scratch edit of the Registry, reverted.
- [x] `Premise.tsx`: the new `PREMISE`; comments say why "every address" and that a test holds it.
- [x] `EXPERIENCE.md`: the new quote in place and an italic dated amendment giving the reason.
- [x] Records: close DW-244 with the defaults and the commit; close retro item 1; append the merge
  condition note to the retrospective; file DW-246 for the footer count the ruling did not name.

**Acceptance Criteria:**
- Given the baseline `PREMISE`, when the new cases run, then the copy case fails.
- Given a rendered `Complete` entry with a `live` URL, when the E1 case runs, then it fails.
- Given the final tree, when § Verification runs, then every command passes and the `/work` baseline
  is unmoved.

## Spec Change Log

- **Review, 2026-09-25, loop 0.** No subagent could be spawned in this session, so the six layers ran
  inline, as the Operator's authorisation of a sub-agent reviewer allows and as the vercel-removal and
  Registry 1.2.0 packages did; the child prompts were not written out as files. Three patches, in
  `ce146fe` and the records commit: the E1 case's title said "draws" while it reads the entries, now
  "holds every rendered entry that carries an address to Live" (blind pass); the `Premise` docblock
  sentence "a test holds both the band's names, the estate's declared list, and the copy's one claim"
  parsed as three items, now two sentences (blind pass); the `sprint-status.yaml` comment called the
  premise's count a stated default, which the ruling itself set (blind pass). Rejected: a `live: ''`
  entry would fail the E1 case though its row draws nothing (the schema's `live` pattern refuses it
  first, and the case fails closed); the pin restating the copy (that is what a pin is). Edge-case
  and verification-gap passes: nothing further. Ponytail: lean already. Design layer: copy only, no
  type, hover or motion change; approve. ECC loop: build, types and tests pass, lint N/A, no secret in
  an added line.
- **Bad spec, loop 1, 2026-09-25.** Finding: the implementation deviates from this spec's task and
  Design Note 1, which read the E1 case over `<SuiteDirectory />`, and from the Code Map, which put
  the new cases at the end. Amended: Code Map, the first task and Design Note 1, now the data reading
  before the source-scan block. Known-bad states avoided: an import line for the Directory moves
  `Premise.test.tsx` lines that `SiteFooter.test.tsx`, `CvIntro.test.tsx` and
  `app/cv/__tests__/page.test.tsx` cite; a block after the source-scan block makes the header's "The
  last block reads the six files" false; a markup read ties the premise suite to the Directory's class
  names. KEEP: the block as committed in `87981a0` and `ce146fe`, its helper, its control and its
  placement. Re-deriving from the amended sections reproduces that code byte for byte (one hunk, no
  import line), so the code was checked against them rather than reverted and re-applied, and the
  second review pass ran over the amended spec with no new finding.

## Design Notes

1. **The claim is held against the rows.** "Every address below" is true while only `Live` rows
   draw one. `SuiteDirectoryRow` draws an address from `live` alone, so the E1 case reads the
   rendered entries rather than the markup: stricter by the Hub, whose row draws none, and free of the
   Directory's class names. A Registry edit that breaks the claim fails the suite, not the page.
2. **The mockups stay.** `key-screens.html` and `directions-4.html` are the 2026-08-15 reference
   renders; the 2026-09-24 amendment left their `Fifteen` too.
3. **The footer's count is filed, not settled.** Retro item 1 asked for the page's three counts; the
   ruling named two. The footer counts rendered rows and estate-wide languages: DW-246, owner the
   Operator. It does not bind the Epic 2 merge, the line being true of what each figure counts.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0; a dated reading only if a
  measured byte moves against the baseline build's reading.
- The pinned container `pnpm test:e2e`, no filter: every case passes, no snapshot written.

## Suggested Review Order

**The copy**

- The ruled words from "became" on; `[N]` and its noun still come from the Registry's length.
  [`Premise.tsx:68`](../../components/organisms/Premise/Premise.tsx#L68)

- Why every address and not everything, with the ruling named.
  [`Premise.tsx:62`](../../components/organisms/Premise/Premise.tsx#L62)

- The docblock now names the test that keeps the running claim from going stale unseen.
  [`Premise.tsx:19`](../../components/organisms/Premise/Premise.tsx#L19)

**The guard (retrospective E1)**

- The one shape that makes the claim false: an entry with an address that is not `Live`.
  [`Premise.test.tsx:213`](../../components/organisms/Premise/__tests__/Premise.test.tsx#L213)

- The E1 case, red when `cs-tournament` was given a `live` URL.
  [`Premise.test.tsx:225`](../../components/organisms/Premise/__tests__/Premise.test.tsx#L225)

- Its planted control, so an empty result is a measurement.
  [`Premise.test.tsx:240`](../../components/organisms/Premise/__tests__/Premise.test.tsx#L240)

- The copy pin, red on the old sentence.
  [`Premise.test.tsx:216`](../../components/organisms/Premise/__tests__/Premise.test.tsx#L216)

**The records**

- The source of the words, amended in place with the dated reason.
  [`EXPERIENCE.md:279`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L279)

- DW-244 closed, with the two defaults recorded unchanged.
  [`deferred-work.md:7707`](deferred-work.md#L7707)

- The footer's count, filed for the Operator; it does not bind the merge.
  [`deferred-work.md:7744`](deferred-work.md#L7744)

- Retrospective action 1 closed, and merge condition (1) noted as met.
  [`sprint-status.yaml:717`](sprint-status.yaml#L717)
  [`epic-2-retro-2026-09-25.md:561`](epic-2-retro-2026-09-25.md#L561)
