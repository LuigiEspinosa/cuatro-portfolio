---
title: 'Records and docs: the mechanical planning corrections, the small rulings recorded, the already-done rows closed, KV-2 and KV-3 applied'
type: 'chore'
created: '2026-09-24'
status: 'done'
baseline_commit: '5c8a074931179f36afa77081d5328c1af54e4b83'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Seventeen planning lines contradict the contract, a measurement or a ruling (DW-96-z,
DW-45, L1688, daisyui-route 1, DW-79, L2226, L2238, L2269, L2441, L2511, L2352, asset-budget 1,
font-contract 1, tailwind-adapter 1, token-contract 1, retro 4, retro 5). Six small rulings sit
unrecorded (DW-96's F-14, the premise count, SiteFooter's mount, URL case, DW-47, DW-50). Sixteen ops
rows and one retro action are done in fact and still read `_not done_` or open. KV-2 is ruled for all
three repositories and KV-3's Pages domain is ruled cleared, and neither record says so.

**Approach:** Operator ruling 2026-09-24, one package. Each correction is a dated amendment in its
document's own style at the places its brief names. The rulings land as written: tech arrays stay
`--t-3xs`; the premise names no count; SiteFooter is home-only by design; Hub URLs are case-sensitive
while config redirects fold case; DW-47 and DW-50 accepted. KV-2 as executed: `cs-tournament`
published, its tolerated row struck and the suite's pins moved; `cs-tracker` and `Mutuo` private by
decision; KV-2 retires, closing DW-128. KV-3: clear the Pages custom domain with `gh`; the DNS deletes
stay Luigi's. Every ref closes where it lives.

## Boundaries & Constraints

**Always:**

- The one behaviour change, `cs-tournament` no longer tolerated, has a suite case that fails on the
  baseline record for the reason it names.
- Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with a dated
  paragraph naming the commit and one `status: done`; an ops Pending Operator row gets its Completed
  cell dated and stays; a planning document gets a dated amendment in its own style that keeps the
  superseded words readable, never a silent rewrite. Amendments sit inside existing lines where they
  can, so line citations into those files do not drift further.
- Each "already done" row is re-checked against its evidence before it is dated.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written. No credential
  from any repository is quoted, and the public records name finding types, not file paths.

**Ask First:** nothing gates this run. It is unattended; each open decision is resolved from the
rulings, then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md` in that order, under Design Notes.

**Never:**

- No edit beyond the places each brief names; a further stale copy found is filed as a new DW entry.
- No edit to the frozen body of `ops/registry-inputs.md`, to dated readings, or to spec files.
- No Cloudflare, box or `cs-tracker` action; no edit to `cs-tracker`, `list-wheel` or
  `digital-library` checkouts; no push, no pull request, no retry of a denied action by another route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed Registry | 14 entries, `cs-tournament` struck, three rows tolerated | 35 checks pass: 11 sources by 2xx, 3 tolerated, none "can be struck" | N/A |
| Struck, then private | `cs-tournament` answers 404 anonymously | fails naming it: no KV-2 row tolerates it | the job goes red |
| Real record | the four KV-2 rows | `cs-tournament` struck, three not, each with a ruling and a date | parser throws on a malformed table |
| Pages clear refused | `gh api` denied or erroring | nothing retried; action 7 stays open with exact steps for Luigi | reported in the result |

</frozen-after-approval>

## Code Map

- `ops/registry-verification.md:86-113` KV-2 table and its striking rule; `:55,59` Secret and
  Expected rows count four. Parsed by `kv2Rows` (`ops/registry-verification.mjs:76-93`); a struck row
  tolerates nothing (`:372`).
- `ops/__tests__/registry-verification.test.ts:88-89` `PRIVATE` pin, `:147` fixture 404s,
  `:229-251` committed-Registry case, `:728-735` real-record case.
- `ops/known-violations.md:66-68` index; `:152-193` KV-1 week section; `:221-281` KV-2; `:283-315`
  KV-3; `:588-598` actions 1 to 9. Tests pin KV-4 and KV-5 only (`ops/__tests__/hit-target-floor.test.ts:769-831`).
- `components/organisms/SiteFooter/SiteFooter.tsx:6-35` docblock; mounted only at `app/page.tsx:79`.
- `README.md:84-118` § Routing; `next.config.js` redirects fold case (DW-56 measured it).
- `DESIGN.md` (ux dir): `:325` 1.13:1; `:460` opsz; `:482-483` scale rows; `:555` px claim;
  `:579`, `:1365` six z-levels; `:658-663` inline padding; `:1060` `--radius-DEFAULT`.
- `EXPERIENCE.md`: `:97`, `:122`, `:672` /recommendation; `:276-279` premise; `:946-947`,
  `:979-982` Unmeasured; `:1063-1066` O-2 to O-5.
- `epics.md`: `:542`, `:2523` plate tracking; `:570`, `:2631`, `:2751`, `:2759`, `:3598`
  ProjectCard; `:671`, `:3078` six z-levels; `:755` FR-17; `:818` O-3; `:969` Twenty stories;
  `:1560` px; `:2349-2355` Story 2.8; `:2724-2729` Story 2.17; `:3624`, `:3631-3632` Story 2.32.
- `prd.md:814`, `:816` Q7 and Q9. `ARCHITECTURE-SPINE.md:172` AD-15 Binds, `:465` hostnames.
- Ops rows: `ops/anchor-token-adoption.md:789,792` (step 2's 5, 8) and `:1035,1037` (1, 3);
  `ops/contract-purity.md` 1, 3; `ops/registry-schema.md` 1; `ops/font-contract.md` 1, 2;
  `ops/token-contract.md` 1, 2; `ops/tailwind-adapter.md` 1, 3, 4; `ops/daisyui-route.md` 1;
  `ops/asset-budget.md` 1, 5; `ops/hub-accessibility-pass.md` F-14, F-17, rows 1, 2;
  `ops/routing-inventory.md:482-483,493,498,518,532,1809,1896`.
- Ledger: DW-45, DW-47, DW-50, DW-56, DW-74, DW-79, DW-96, DW-128, and the no-id entries on
  routing-inventory's handovers, O-4/O-5/Q9, inline padding, 16x27, Story 2.8's departures,
  ProjectCard, 1.13:1, plate tracking, the premise's fifteen, SiteFooter. Board: `sprint-status.yaml`
  action items 4, 5, 13.
- Evidence re-read 2026-09-24: runs 33103987782 (98 s, 39 passed, contract-anchor 10 to 15 and
  anchor-aliases 1 to 9 green), 32930827956 (contract-purity 6 s), 33434472577 and 33550154642
  (registry-schema 10 s), 32858478445 (fonts-contract 17 s), 32801557172 (tokens-contract 17 s),
  32882858751 (74 s, 21 passed); deploys 33104210047, 34728299598, 34777712895; no deploy between
  2026-08-16 and 2026-08-27; `gh repo view`: `cs-tournament` PUBLIC (anonymous 200), `cs-tracker`
  and `Mutuo` PRIVATE (404); future-vizion Pages `cname future-vizion.cuatro.dev`, legacy build from
  `main` with a committed `CNAME`; both KV-3 names still resolve to Vercel.

## Tasks & Acceptance

**Execution:**
- [ ] `ops/__tests__/registry-verification.test.ts`, then `ops/registry-verification.md`: move the
  pins to three private and one struck and assert no row is left to strike, red first on the
  baseline record; then strike the row and amend the counts of four. **Withdrawn, see the Spec
  Change Log.**
- [x] `components/organisms/SiteFooter/SiteFooter.tsx`: one docblock paragraph, home-only by design.
- [x] Planning documents and `README.md`: the corrections and rulings per Design Notes.
- [ ] Clear the future-vizion Pages custom domain with `gh`, read back once. **Refused, see the Spec
  Change Log;** action 7 carries the Operator's exact steps instead.
- [x] Records: KV-1's expiry, KV-3's note, the ops rows, routing-inventory, the ledger closings, the
  new DW entries, the board. KV-2's retirement is withdrawn with the first task.

**Acceptance Criteria:**
- Given the baseline record, when the moved suite cases run, then each fails naming `cs-tournament`.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build and the
  unfiltered container e2e run execute, then all pass, no snapshot is written and the `/work`
  baseline is unmoved.
- Given any ref in this package, when a reader opens where it lives, then it reads closed with the
  date, the ruling and the commit, or, for KV-3 action 6, open with exact steps.

## Spec Change Log

- **Implementation, 2026-09-24: the permission gate refused two of the package's actions, and the
  human's side of this unattended run withdrew them rather than route around the refusal.**
  (1) Moving the registry-verification suite's pins to `cs-tournament` struck was refused twice, once
  as "Auto-Mode Bypass" and once as "Create Public Surface", after two of the four edits had applied;
  those two were reversed, so the suite and `ops/registry-verification.md` are as the baseline left
  them. The refusal is read as covering the outcome, so KV-2's whole application is withdrawn from
  this run and handed to Luigi: the struck row, the moved pins, KV-2's retirement, known-violations
  action 5 and DW-128 stay as they were. The first acceptance criterion and matrix rows 1 to 3 go
  with it, unimplemented, and the scan reports were not re-read either. (2) The one `gh` call that
  would clear the Pages custom domain was refused as "DNS / Domain / Cert Changes" and not retried;
  matrix row 4 is what happened, and known-violations action 7 now carries the Operator's exact
  steps, in the Settings page. **KEEP:** everything else in the package is unaffected by either and
  was built as specified. Design Notes 3, 4 and 8 describe work that did not happen and are kept as
  the plan was; the four-private counts of Design Note 1 are not filed as a DW entry, since they
  belong to KV-2's withdrawn records work.
- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows and the Registry
  package did. No intent gap and no bad-spec finding. Three patches, all cosmetic, in records: a
  line break inside a sentence in DW-136, an over-long line in DW-137, and known-violations action
  6 citing routing-inventory's heading by a shortened name (blind pass). Edge-case pass: no unhandled
  path; the case policy's trailing-slash edge is already in `README.md` § Routing. Verification-gap
  pass: no behaviour changed, the one code edit being a comment, and the two parsed records
  (`ops/known-violations.md`, `ops/hub-accessibility-pass.md`) stay green under their suites.
  Ponytail: lean. Design layer: `SiteFooter.tsx` changed in a comment alone, nothing to judge,
  approve. ECC verification loop: build, types and tests as § Verification records, lint N/A. No
  new ledger entry from the review.

## Design Notes

Assumptions, resolved unattended:

1. **Brief places only.** Four further copies found stay as they are and are filed: the inline-padding
   mechanism in `EXPERIENCE.md`, `RESTYLE-SPEC.md` and two more `epics.md` lines; 1.13:1 in
   `EXPERIENCE.md`, `epics.md` and the spine; `/recommendation` still placed or listed as surviving
   (PRD FR-1, UX-DR28, UX-DR35, three criteria, one of them Epic 3's); four-private counts in
   `AGENTS.md` and `ops/contract-adoption.md`.
2. **`ops/registry-inputs.md` is not edited** although L1688's brief asks: the L1744 ruling froze its
   body the same day, and `:286` already records O-5 closed on 2026-09-02.
3. **KV-2 retires on its own condition** (all three ruled), which the entry set on 2026-09-02 and the
   ruling invokes, while three links still 404 by decision; the entry says so.
4. **Findings named by type.** The repository is public, so KV-2 names the kinds and dates of the
   `cs-tracker` and `Mutuo` findings from the rulings file, not paths; the scan reports were not
   re-read (the permission system refused), the rulings file is the source.
5. **Dates.** O-3 closed 2026-08-25 (Story 1-15); O-4, O-5, Q9 2026-09-02 (Story 2-4); O-2 2026-08-29
   (Story 2-2); Q7 2026-08-15, shipped by Story 2-13 on 2026-09-07. Moot rows take the day the
   subject went and the day of closing.
6. **`epics.md:5067`** ("Epic 1's twenty keys") stays: that appendix is dated 2026-08-15, before Story
   1.21 existed. The mockup `.plate` tracking stays: the spines win over mocks.
7. **Code blocks** take the amendment as a trailing comment on the same line (`DESIGN.md:1060`,
   `EXPERIENCE.md:97`).
8. **KV-3's Pages clear** may commit the removal of the `CNAME` file on future-vizion's `main`, as
   the Settings button can for a branch build; recorded with the sha GitHub writes.
9. **Commits**: the suite with its record; the SiteFooter docblock; the planning documents and README;
   then the records, which name the first three.
10. **Oversized, kept.** About 2,700 tokens against the 1,600 guide, and more than one goal by the
    scope standard. Both prompts were answered Keep, since the Operator ruled this one package; the
    risk is context rot, met by the Code Map anchoring every line and the briefs holding the wording.
11. **Already dated elsewhere.** `ops/backup-digital-library.md` rows 1 to 8 were dated by the retro-3
    package (`5c8a074`) before this one opened; they are re-read and left as they are.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0; a dated reading only if a shipped
  byte moves.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes, no snapshot written.

**As run, 2026-09-24:**
- No red-first run exists: the one behaviour change, the struck KV-2 row, was withdrawn (Spec Change
  Log), and everything that landed is text a reader reads.
- `corepack pnpm typecheck`: exit 0 before `2327d75` and again on the final tree.
- `corepack pnpm test --run`, the whole suite: 63 files, 1,634 passed, at 23:36Z with every record
  edit in place, and again at 23:45Z after the review's three patches.
- `node ops/literal-conformance.mjs`: exit 0, twice. `node ops/registry-schema.mjs`: exit 0.
- `corepack pnpm build`: exit 0, build `X2HTKloYztF9HPZkOhx48`, `/` still `ƒ` (DW-50's closing
  reads it). `node ops/asset-budget.mjs`: exit 0 and no shipped byte moved, so no reading is filed:
  18 `.js` and 13 `.css` chunks at 2,851,998 bytes on disk and 830,256 gzipped, and every document
  (`/work` 21,402, `/cv` 22,662, `/celeste` 14,780, `/_not-found` 18,101, `/_global-error` 9,578)
  the length the DW-15 reading records, each route's wire total within 3 bytes of it, which is the
  build id inside each document.
- The unfiltered container run, the task's command verbatim: 337 passed in 6.2 minutes, exit 0, no
  failure, no retry, no snapshot written, and `git status` showed nothing under `tests/` after it.

## Suggested Review Order

**The two refusals, and what the Operator now holds**

- KV-3's Pages domain stays open; the Operator's exact Settings steps replace the refused call.
  [`known-violations.md:604`](../../ops/known-violations.md#L604)

- The DNS deletes, written as exact steps with the re-read of both names.
  [`known-violations.md:603`](../../ops/known-violations.md#L603)

- Why KV-2's records work is withdrawn rather than routed around.
  [`spec-records-and-docs.md`](spec-records-and-docs.md#spec-change-log)

**The rulings, where each now lives**

- Tech arrays stay 11px: the scale table moves, the build does not.
  [`DESIGN.md:482`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L482)

- The premise names no count; the page derives it from the Registry.
  [`EXPERIENCE.md:276`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L276)

- Case policy in one sentence, closing DW-74 and DW-56.
  [`README.md:120`](../../README.md#L120)

- SiteFooter home-only by design, said where the next reader looks.
  [`SiteFooter.tsx:13`](../../components/organisms/SiteFooter/SiteFooter.tsx#L13)

**The mechanical corrections, each a dated note beside the old words**

- The one mechanism correction: padding grows the box, not the line.
  [`DESIGN.md:658`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L658)

- Open items O-2 to O-5 struck with their closing stories and dates.
  [`EXPERIENCE.md:1063`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L1063)

- FR-17 respelled 1 / 2, the retro's action 4.
  [`epics.md:755`](../planning-artifacts/epics.md#L755)

- PRD Q7 and Q9 struck in the shape Q2 and Q6 already use.
  [`prd.md:814`](../planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md#L814)

**Records closed as already done**

- KV-1's measurement week marked expired, closing actions 1 and 4.
  [`known-violations.md:154`](../../ops/known-violations.md#L154)

- The moot appearance checks and first CI runs, each with its run id.
  [`anchor-token-adoption.md:1035`](../../ops/anchor-token-adoption.md#L1035)

- Routing-inventory's handovers now point at KV-3, dated.
  [`routing-inventory.md:482`](../../ops/routing-inventory.md#L482)

**Peripherals**

- DW-96's closing, one of seventeen ledger closings in the same shape.
  [`deferred-work.md:5586`](deferred-work.md#L5586)

- Three stale copies the briefs did not name, filed rather than fixed.
  [`deferred-work.md:7123`](deferred-work.md#L7123)
