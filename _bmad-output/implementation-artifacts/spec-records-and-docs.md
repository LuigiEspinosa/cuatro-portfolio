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
- [x] `ops/__tests__/registry-verification.test.ts`, then `ops/registry-verification.md`: move the
  pins to three private and one struck and assert no row is left to strike, red first on the
  baseline record; then strike the row and amend the counts of four. Refused in this package's
  session, applied by the orchestrator in `9336330`, and completed in fix round 1 by `7f6f837`
  (the no-row-left-to-strike assertion and the Secret row's count); see the Spec Change Log.
- [x] `components/organisms/SiteFooter/SiteFooter.tsx`: one docblock paragraph, home-only by design.
- [x] Planning documents and `README.md`: the corrections and rulings per Design Notes.
- [x] Clear the future-vizion Pages custom domain with `gh`, read back once. Refused in this
  package's session and done by the orchestrator in its own: `cname` reads `null`, GitHub removed
  the `CNAME` file in `360f9f1` on future-vizion's `main`, and action 7 is dated in `9336330`.
- [x] Records: KV-1's expiry, KV-3's note, the ops rows, routing-inventory, the ledger closings, the
  new DW entries, the board. KV-2's retirement, action 5 and DW-128's closing landed with the first
  task in `9336330`.

**Acceptance Criteria:**
- Given the baseline record, when the moved suite cases run, then each fails naming `cs-tournament`.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build and the
  unfiltered container e2e run execute, then all pass, no snapshot is written and the `/work`
  baseline is unmoved.
- Given any ref in this package, when a reader opens where it lives, then it reads closed with the
  date, the ruling and the commit, or, for KV-3 action 6, open with exact steps.

**As met, 2026-09-25.** The first criterion's edits were refused by this package's permission gate
and applied by the orchestrator in `9336330`, after which only the real-record case failed on the
baseline; fix round 1 adds the committed-Registry case's no-row-left-to-strike assertion in
`7f6f837`, and both moved cases now fail on the baseline record naming `cs-tournament`
(§ Verification). The second holds on the final tree, the container run standing from the
implementation because nothing since has touched a file the build or the browser suite reads. The
third holds, KV-3 action 6 open with exact steps and action 7 dated on `360f9f1`, though only
since fix round 2 corrected five record dates to the UTC day (Spec Change Log).

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
- **Applied by the orchestrator, 2026-09-25, after the gate refused the package.** In its own
  session, where the Operator's approval reaches, the orchestrator made both refused changes in
  `9336330`: `cs-tournament`'s row in § Sources tolerated struck, `cs-tracker` and `Mutuo` recorded
  private by decision with their scan findings, the Expected row amended to 11 by 2xx and 3
  tolerated, the suite's pins moved (`KV2_TABLE`, `STRUCK`, and `PRIVATE` derived from them, so the
  committed-Registry fixture answers `cs-tournament`'s source 200), KV-2 retired with actions 5 and
  7 dated, and DW-128 closed. It cleared the Pages custom domain with
  `gh api -X PUT repos/LuigiEspinosa/future-vizion/pages` and a null `cname`, and GitHub removed the
  `CNAME` file itself in `360f9f1` on future-vizion's `main`. GitHub dates that commit
  2026-09-25T00:02:53Z, so action 7's cell dates the clear 2026-09-25, its UTC day; the cell first
  read the host's local 2026-09-24, corrected by fix round 2. Action 6, the Cloudflare DNS deletes,
  stays the Operator's. Design Notes 3 and 8 now describe work done.
- **Fix round 1, 2026-09-25, after the verifier's stage-2 rejection.** Its failures 1 and 2 were the
  two refusals, resolved above; this round owns 3 and 4, each re-checked before anything was ticked.
  (3) This spec read `done` with tasks 1 and 4 open and the first criterion unmet. With the baseline
  record swapped in, `9336330` met half of it: the real-record `kv2Rows` case failed naming
  `cs-tournament`, but the committed-Registry case passed, since a 2xx on an unstruck row is a pass
  that says the row can be struck and nothing asserted that none was left, which matrix row 1
  requires. `7f6f837` adds that assertion and corrects the case's title, which still read 10 and 4,
  so both cases fail on the baseline and pass on the struck record; it also amends the Secret row
  (`ops/registry-verification.md:55`), the one count of four the Code Map names that `9336330`
  left. `365a38e` names the `cs-tracker` and `Mutuo` findings by type and date in the two private
  rows and KV-2's retirement paragraph, as the Boundaries and Design Note 4 require of a public
  record. DW-128's closing now names `9336330` and `ops/hub-accessibility-pass.md` row 2 names
  `ffcd8aa`, as the third criterion asks. With KV-2's records work applied, Design Note 1's
  held-back counts of four are filed as DW-139, with two sentences of § Sources tolerated found
  beside them, and the 16×27 figure the verifier found in `EXPERIENCE.md` § Chrome is DW-140.
  (4) Step 2 action 5 of `ops/anchor-token-adoption.md` cited `d3cc350`, 2-22's fix round, for the
  deletion of the alias layer; `22e5d1c` cites `201f7f2`, which deleted it from `app/app.scss`,
  corrected in place since the row had never been pushed. Every task is now ticked and every
  criterion met, so the status stays `done`.
- **Fix round 2, 2026-09-25, after the verifier's second stage-2 rejection.** Both failures are one
  error: dates written after 00:00Z on 2026-09-25 took the host's local day, 2026-09-24 (the host
  runs at UTC-5), where records take the UTC date. (1) Action 7's Completed (UTC) cell dated the
  Pages clear 2026-09-24, though GitHub dates `360f9f1` 2026-09-25T00:02:53Z and its Pages build
  00:02:56Z; the cell reads 2026-09-25 and gives the commit's time, its ruling citation unchanged,
  and the sentence above that kept the old date is corrected. (2) `9336330` wrote four stamps
  between 00:04Z and 00:06Z reading 2026-09-24: `Amended` in the Expected row
  (`ops/registry-verification.md:59`), KV-2's two `Amended` stamps (`ops/known-violations.md:246`
  and `:250`) and DW-128's `Closed`. Each now reads 2026-09-25, its row still citing the ruling of
  2026-09-24, and the heading fix round 1 gave the orchestrator's entry above reads 2026-09-25 too.
  To reach every copy of the error, not only the ones named, every date the five commits after
  00:00Z added was swept: no other write stamp reads 2026-09-24, and the event dates stay, since
  the rulings, KV-2's retirement, action 5 and `cs-tournament`'s publication (04:48Z) and strike
  all fall on 2026-09-24. Re-checking action 7's evidence also found the cell saying
  `gh api ... --jq .cname` printed `null`: that form prints an empty line, gh's rendering of a JSON
  null, and the orchestrator's read used a different filter, so the cell now says the Pages API
  read `cname` back as `null`.

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
  Log), and everything that landed is text a reader reads. *(Superseded 2026-09-25: the struck row
  landed in `9336330`, and its red-first run is under fix round 1 below.)*
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

**As run, 2026-09-25, fix round 1:**
- Red first, with `7bc305f`'s `ops/registry-verification.md` swapped in for the struck record and
  restored byte for byte afterwards: `corepack pnpm vitest run
  ops/__tests__/registry-verification.test.ts` under `9336330`'s suite failed 1 of 55, the
  real-record case (`expected [] to deeply equal [ 'LuigiEspinosa/cs-tournament' ]`), and under
  `7f6f837`'s failed 2 of 55, adding the committed-Registry case (`expected [ 'cs-tournament' ] to
  deeply equal []`). On the struck record, 55 of 55.
- `corepack pnpm typecheck`: exit 0 with the suite edit in place, and again on the final tree.
- `corepack pnpm test --run`, the whole suite: 63 files, 1,634 passed, at 00:28Z with the suite edit
  in place, and again at 00:35Z on the final tree.
- `node ops/literal-conformance.mjs` and `node ops/registry-schema.mjs`: exit 0.
- `corepack pnpm build` at `22e5d1c`: exit 0, build `-49NbpR6J4f7odCeoxWaV`.
  `node ops/asset-budget.mjs`: exit 0, 2,851,998 bytes on disk and 830,256 gzipped, the figures
  above, so no reading is filed.
- The container run is not repeated: since it ran, `9336330` and this round changed records, the
  ledger, this spec and one Vitest file, and no browser spec reads any of them.
- Re-read 2026-09-25: `gh api repos/LuigiEspinosa/future-vizion/pages --jq .cname` prints `null`,
  and `360f9f1` ("Delete CNAME") touches `CNAME` alone; `gh repo view LuigiEspinosa/cs-tournament`
  reads `PUBLIC`, and anonymous GETs answer 200 for it and 404 for `cs-tracker` and `Mutuo`;
  `git show --stat 201f7f2` rewrites `app/app.scss` (208 lines), which `d3cc350` does not touch.

**As run, 2026-09-25, fix round 2:**
- Re-read: `gh api repos/LuigiEspinosa/future-vizion/commits/360f9f1` gives author and
  committer date 2026-09-25T00:02:53Z, and `.../pages/builds` its build at 00:02:56Z;
  `gh api repos/LuigiEspinosa/future-vizion/pages` returns `"cname": null`, whose `--jq .cname`
  form prints an empty line (the reading above says `null`). The orchestrator's session transcript
  times the `gh repo edit` that published `cs-tournament` at 2026-09-24T04:48Z, the Pages `PUT` at
  2026-09-25T00:02:59Z, and the five dated edits from 00:04:10Z to 00:05:47Z.
- `corepack pnpm typecheck`: exit 0 with every record edit in place.
- `corepack pnpm test --run`, the whole suite: 63 files, 1,634 passed, at 01:13Z.
- `node ops/literal-conformance.mjs` and `node ops/registry-schema.mjs`: exit 0.
- The build and the container run are not repeated: this round changed two ops records, the
  ledger and this spec, and neither the build nor any browser spec reads them.

## Suggested Review Order

**KV-2 and KV-3: refused in this package, applied by the orchestrator, completed in fix round 1**

- `cs-tournament` struck; the two kept private carry their findings by type and date.
  [`registry-verification.md:97`](../../ops/registry-verification.md#L97)

- No KV-2 row left to strike: the assertion that makes the committed-Registry case fail first.
  [`registry-verification.test.ts:250`](../../ops/__tests__/registry-verification.test.ts#L250)

- KV-2 retired on its own condition, all three repositories ruled.
  [`known-violations.md:289`](../../ops/known-violations.md#L289)

- The Pages domain cleared on `360f9f1`; the DNS deletes stay the Operator's, as exact steps.
  [`known-violations.md:616`](../../ops/known-violations.md#L616)

- What each refusal became, and what fix round 1 added.
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
  [`deferred-work.md:7131`](deferred-work.md#L7131)

- Two more, filed in fix round 1: the counts of four KV-2 left behind, and the 16×27 figure.
  [`deferred-work.md:7207`](deferred-work.md#L7207)
