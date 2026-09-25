---
title: 'Vercel leaves the estate: cs-tournament Complete in Registry 1.4.0, and every record that says something runs on Vercel today corrected'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '738251e83f4ae93c7a9baa3960c3202c67e517aa'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Nothing deploys to Vercel any more (Operator ruling 2026-09-24), yet the Registry
publishes `cs-tournament` as `Live` at `https://inclusivcup.vercel.app` with `Vercel` in its `tech`,
and the estate's records say three things run there today: that entry, and `covidmap.cuatro.dev` and
`future-vizion.cuatro.dev` (KV-3). The records are misinformation, and nobody has written down the
safe order in which the Vercel side is taken apart.

**Approach:** One package, as ruled. `cs-tournament` becomes `Complete` with no `live` URL and no
`Vercel`, `contract_version` moves to `1.4.0` (a value change is a minor), and every suite and pin
that reads the committed Registry moves with it, each moved expectation shown red first. Every
record that states something runs on Vercel today takes a dated amendment; dated history stays as
written. The decommission is written as ordered Pending Operator actions: the two `cuatro.dev`
CNAMEs and the `_vercel` TXT, then the `covidmap` and `future-vizion` Vercel projects, then the
`inclusivcup` project only after the Epic 2 merge has deployed.

## Boundaries & Constraints

**Always:**
- Every changed behaviour has a test that fails without the change, and each moved expectation is
  seen red before it moves. The final tree is green on typecheck, the whole unit suite, the literal
  gate, the build, `node ops/registry-schema.mjs` and the unfiltered container e2e run.
- Records take the UTC date (2026-09-25) and cite "Operator ruling 2026-09-24". An ops Pending
  Operator row gets its Completed cell dated and stays; a planning document gets a dated amendment
  in its own style, never a silent rewrite.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended; each open question is resolved from the
ruling, then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md` in that order, and stated under
Design Notes.

**Never:**
- No edit to dated history: the research documents, `ops/registry-inputs.md` (frozen), `CHANGELOG.md`,
  spec files, closed ledger entries, dated observation rows, and the Geist font's attribution to
  Vercel (`packages/fonts`, `contracts/fonts`, `ops/font-contract.md`).
- No change to the schema, the gate's rules, the premise copy, or any Registry value beyond
  `cs-tournament`'s and `contract_version`. No new test pinning an entry's field values.
- No push, no pull request, no console act: DNS, Vercel and GitHub settings are the Operator's.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Directory on `/` | final tree | six rows; `cs-tournament` last, `Complete`, no dot, its Source link alone; the head reads `5 running` | N/A |
| Registry gate | final tree | exit 0 at `1.4.0`, fourteen applications | N/A |
| Verification job, planted fetcher | committed Registry | 34 checks: 14 exists, 14 resolves (11 by 200, 3 tolerated), 5 live (3 by 3xx), 1 token | one failing source reads `33 of 34` |
| Hit-target sweep | `/` at 360 x 800 | found 17, skipped 0, measured 17 | the old pin of 18 fails naming `/` |
| KV-3 names | Operator deletes the three records | both names NXDOMAIN and no `_vercel` TXT; KV-3 retires; then the two projects go | no project is deleted while a name still points at it |
| `inclusivcup` | Epic 2 merge deployed | the served Registry no longer names it; then the project goes; the URL answers 404 `DEPLOYMENT_NOT_FOUND` | deleting first breaks production's live link and the daily job on `main` |

</frozen-after-approval>

## Code Map

- `contracts/registry.json:3` version; `:53-62` `cs-tournament`. Read by `lib/registry.ts:26` and
  `ops/registry-verification.mjs`; copied to `public/contracts/` by the build.
- `components/organisms/SuiteDirectory/SuiteDirectory.tsx:187` the count, `{entries.length} running`
  over the rendered set; `:99` "Nothing is `Complete` today". A `Complete` row already draws Source
  only (`:135-163`), proved over a fixture.
- Suites that read the committed Registry: `ops/__tests__/registry-schema.test.ts:246-259` (the
  `1.3.0` pin); `ops/__tests__/registry-verification.test.ts:235-277,307-333` (35 checks, 6 live);
  `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx:105-109` (count), `:254-266`
  (every non-Hub row two links), `:410` (a Complete describe titled "which the committed Registry does
  not hold"); `lib/__tests__/registry.test.ts:224-229` (`orderByStatus` a no-op on the committed file).
- `tests/e2e/hit-target-floor.pw.ts:138` `SURFACES` pins `/` at 18, held equal to
  `ops/hit-target-floor.md:98` by `ops/__tests__/hit-target-floor.test.ts`.
- Stale "nothing is `Complete`" comments: `lib/registry.ts:106,273`; `lib/__tests__/registry.test.ts:200,728`;
  `tests/e2e/status-mark.pw.ts:24-26,769`; `ops/status-mark-axes.md:55`.
- Records: `ops/estate.md:147-170,194-203,261-299`; `ops/known-violations.md:317,615`;
  `ops/routing-inventory.md:227-230,523,534-539`; `ops/registry-verification.md:59,82-84,183`;
  `ops/bot-mitigation.md:80-84`; `ops/capacity-threshold.md:131-133,336-338,371`;
  `ops/monitoring.md:358-365`; `ops/registry-schema.md:193`.
- Planning: `epics.md:4167-4213` (Story 3.7), `:4993-5007` (Story 8.6); `prd.md:603,816`;
  `EXPERIENCE.md:1065`; `ARCHITECTURE-SPINE.md:465`; `sprint-status.yaml:496` (the 3-7 key).
- Evidence, observed 2026-09-25: `inclusivcup.vercel.app`, `covidmap.cuatro.dev`,
  `future-vizion.cuatro.dev` and `future-vizion.vercel.app` (same ETag as the `cuatro.dev` name)
  answer 200 `server: Vercel`; both names resolve to `64.29.17.65` and `216.198.79.65` and the TXT
  answers; `covidmap.vercel.app` and `cs-tournament.vercel.app` are other owners' projects; a missing
  deployment answers 404 `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`; UptimeRobot `list-monitors` holds 8
  monitors, none on a Vercel URL.

## Tasks & Acceptance

**Execution:**
- [x] Tests first: move the version pin and the verification counts, run them on the baseline (red),
  change the Registry, then run the Directory and library suites to see the old count, two-link and
  no-op expectations go red on the new data before each moves.
- [x] `contracts/registry.json`: `1.4.0`; `cs-tournament` `Complete`, no `live`, no `Vercel`, `demo`
  `not-deployed`.
- [x] `SuiteDirectory.tsx`: count `Live` rows only; the stale comments per the Code Map.
- [x] `hit-target-floor.pw.ts` and `ops/hit-target-floor.md`: move `/` to what the container sweep
  prints, in one commit.
- [x] Records and planning amendments per the Code Map and Design Notes; `capacity-threshold` row 3
  dated; the decommission in `ops/estate.md`; DW-244 and DW-245 filed.
- [x] Verify per § Verification.

**Acceptance Criteria:**
- Given the baseline tree, when the moved cases run, then each fails for the reason it names.
- Given the final tree, when every command in § Verification runs, then each passes and the `/work`
  baseline is unmoved.
- Given `git grep -i vercel`, when each hit is read, then none states that something of the estate
  runs on Vercel today without a dated amendment beside it, outside the history the Never list keeps.

## Spec Change Log

- **Review, 2026-09-25, loop 0.** No subagent could be spawned in this session, so the six layers ran
  inline, as the Operator's authorisation of a sub-agent reviewer allows and as the Registry 1.2.0 and
  process-and-upkeep packages did; the child prompts were not written out as files. No intent gap and
  no bad-spec finding, so no loopback. Three patches, all in `3b30e7e`: `lib/registry.ts`'s header
  still counted eight entries without a `live` URL, nine now, so the count is dropped (blind pass);
  the status-mark case titled "holds for the three values the filter never renders" was false once a
  `Complete` row reached the page, and the comment this package wrote inside it said so, so it is
  retitled with its held row in `ops/status-mark-axes.md` (blind pass); `ops/hub-accessibility-probe.mjs`
  said twice that only `Live` reaches the shipped page (verification-gap pass, tracing the consumers of
  the Status values). Nothing new deferred: the premise's "Everything below is running right now" was
  already DW-244. Rejected: a `Complete` entry that keeps a URL draws a live link the count omits
  (decided, Design Note 3, and unreachable from the committed Registry); the count case discriminates
  only while a rendered entry is not `Live` (true today, and every committed-data case in the file
  shares that shape); the Cloudflare edge cache can hold production's Registry for up to two hours
  after the deploy (decommission step 3's check then waits, the safe direction). Ponytail: lean
  already. Design layer: one surface, `SuiteDirectory.tsx`, whose change is the count's value, with no
  type, hover or motion touched; approve. ECC verification loop: build, types and tests as § Verification
  records; lint N/A, there being no lint command (`AGENTS.md`).

## Design Notes

Assumptions, resolved unattended:

1. **Split or Keep: Keep.** The token count check found this spec at about 2,700 tokens (10,707
   characters over four), against the SCOPE STANDARD's 1600. The answer came from the orchestrator,
   relaying the Operator's ruling of 2026-09-24 that Vercel's removal is one package
   (`operator-rulings-2026-09-23.md` § Vercel removal); the run did not answer for itself.
2. **`demo` moves to `not-deployed`.** Not in the ruling's list, and required by it: FR-27 says the
   declaration is accurate, and the Operator's `demo` ruling of 2026-09-02 reads `none` as deployed
   with no demo and `not-deployed` as nothing running. The ruling says it runs nowhere until Epic 3.
   Same minor.
3. **The count counts `Live` only** (`EXPERIENCE.md` § UI strings: "Real count. Never a rounded or
   aspirational figure"; § Status mark: only `Live` means clickable right now; § Registry Entry:
   `Complete` has no live link). The word and its place are unchanged. A `Complete` entry that keeps
   a URL is not counted either, which under-promises (NFR-9).
4. **The premise stays verbatim.** `EXPERIENCE.md` § The premise fixes it word for word and no document
   offers other copy, so "Everything below is running right now" is filed for a copy ruling before
   the Epic 2 merge (DW-244) rather than rewritten.
5. **The decommission lives in `ops/estate.md`**, whose disposition table carries each application's
   hosting and which already has § Pending Operator actions; `ops/routing-inventory.md` holds only the
   `cuatro.dev` zone and says it holds no `live` value for `cs-tournament`. Step 1 cites KV-3's action 6
   for its exact steps rather than copying them.
6. **Tests assert rules, not values** (Registry 1.2.0, Design Note 6). The pins that move are the ones
   that already read committed state: the version, the verification counts, the swept surface.
7. **Story 3.7** keeps its key and title: the amendment says the leaving is done, supersedes the last
   criterion, and retargets the bcrypt criterion's trigger to the placement on the box. Story 8.6 waits
   on the merge alone.
8. **The confirming `registry-verification` push run** follows the push, which is not this run's.
9. **Asset budget.** `/` is not prerendered and the tool does not fetch it; `/cv` still reads six
   rendered entries. A reading is filed only if a measured byte moves.
10. **Found while reading, filed not fixed.** PRD § 5.1's `Status today` column also holds three
    other superseded values (`apple-music-workspace`, `cuatro-finance`'s assumption, `list-wheel` on
    GitHub Pages), none of them Vercel's: DW-245. Only the `cs-tournament` row is amended here.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs` and `node ops/registry-schema.mjs`: exit 0 each.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0; a dated reading only if a
  measured byte moves.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes, no snapshot written.

**As run, 2026-09-25:**
- Red first, in three stages. With the moved version pin and verification counts on the baseline
  Registry, `corepack pnpm vitest --run ops/__tests__/registry-schema.test.ts
  ops/__tests__/registry-verification.test.ts`: 7 failed, 150 passed (157), the pin reading `1.3.0`
  and six verification cases reading 35 checks where 34 were expected. With the Registry at `1.4.0`
  and the count expectation moved, the component still counting every rendered row,
  `corepack pnpm vitest --run components/organisms/SuiteDirectory lib/__tests__/registry.test.ts
  app/__tests__/page.test.tsx`: 3 failed, 144 passed (147): the count case (`Unable to find an
  element with the text: 5 running`), the old two-destinations case (`cs-tournament does not carry 2
  links`) and the old one-status case over the committed file. The hit-target sweep in the pinned
  image against the old pin: 1 failed, 16 passed, printing `/: found 17, skipped 0, measured 17` with
  the other four surfaces unchanged.
- `fa34f09` and `24a9cc3`: before each, `corepack pnpm test --run` read 63 files and 1,634 passed;
  typecheck, `node ops/literal-conformance.mjs` and `node ops/registry-schema.mjs` exit 0 on each, the
  gate at 14 applications.
- The final tree, `3b30e7e`: typecheck exit 0; `corepack pnpm test --run` 63 files, 1,634 passed in
  84 s; both gates exit 0; `corepack pnpm build` exit 0, build `iGvuoWh3B0tt5JTdYfF9E`, with
  `public/contracts/registry.json` equal to the committed file; the unfiltered container run 337
  passed in 7.3 min, exit 0, no snapshot written and the `/work` baseline unmoved (337 in 7.2 min on
  `24a9cc3`, before the review patches).
- `node ops/asset-budget.mjs` exit 0 on each build, no measured input dirty. No measured byte moved,
  so no reading is filed: every chunk and every prerendered document is the size the DW-15 reading
  records (2,851,998 on disk and 830,256 gzipped in `.next/static/chunks`; documents 21,402, 22,662,
  14,780, 18,101 and 9,578), and each route's gzipped line sits within 6 bytes of it on the first
  build (`1_wvNKPWKNVkNZ3YGSTmm`) and within 2 on the final one: the build id inside each document,
  every document being the same length on disk.
- Matrix audit: rows 1 to 4 are held by the cases above, each seen passing in these runs: the count,
  the rows and the links in `SuiteDirectory.test.tsx`, the dot reconciled with the `Live` marks in
  `tests/e2e/status-mark.pw.ts`, the gate, the planted-fetcher suite and the sweep. Rows 5 and 6 are
  the Operator's console acts, which no repository test can exercise, so each is held by the
  confirming command written into its step (`ops/estate.md` § The Vercel decommission, KV-3's action
  6), against the before-state observed on 2026-09-25: both names answering 200 from Vercel and the
  TXT present, `inclusivcup.vercel.app` answering 200, production serving Registry 1.1.0 with that URL.
- Not run here: the `registry-verification` job on a runner, which fires on the push this run does not
  make; its run joins `ops/registry-verification.md` § Observed runs and should read
  `# 34 of 34 checks passed`.

## Suggested Review Order

**The Registry leaves Vercel**

- Entry point: `cs-tournament` goes `Complete`, loses its URL and `Vercel`, not deployed.
  [`registry.json:53`](../../contracts/registry.json#L53)

- One minor for every value change, under the split version rule.
  [`registry.json:3`](../../contracts/registry.json#L3)

**The Directory stays honest about it**

- The count counts `Live` rows only: a real count, never an aspirational one.
  [`SuiteDirectory.tsx:189`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L189)

- The count case, red on the old formula over the new data.
  [`SuiteDirectory.test.tsx:105`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L105)

- A row with no URL keeps its Source link alone.
  [`SuiteDirectory.test.tsx:258`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L258)

**The decommission, in its safe order**

- DNS first, then two projects, `inclusivcup` last, after the merge deploys.
  [`estate.md:316`](../../ops/estate.md#L316)

- KV-3's DNS row now orders the project deletions after its lookup.
  [`known-violations.md:615`](../../ops/known-violations.md#L615)

- The disposition row, amended with what it read before.
  [`estate.md:159`](../../ops/estate.md#L159)

**Current state corrected, history kept**

- Story 3.7: the leaving is done; the merge and the placement stay.
  [`epics.md:4214`](../planning-artifacts/epics.md#L4214)

- Story 8.6 now waits on the merge alone.
  [`epics.md:5021`](../planning-artifacts/epics.md#L5021)

- PRD § 5.1's row struck and amended; its other stale rows filed.
  [`prd.md:612`](../planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md#L612)

- Capacity row 3 closed: nothing runs to measure until Story 3.7.
  [`capacity-threshold.md:377`](../../ops/capacity-threshold.md#L377)

- The verification job now expects 34 checks, 5 of them `live`.
  [`registry-verification.md:59`](../../ops/registry-verification.md#L59)

**Peripherals**

- The version pin that moved with the Registry.
  [`registry-schema.test.ts:262`](../../ops/__tests__/registry-schema.test.ts#L262)

- The planted-fetcher counts, 35 to 34.
  [`registry-verification.test.ts:235`](../../ops/__tests__/registry-verification.test.ts#L235)

- The swept surface, moved to what the pinned image printed.
  [`hit-target-floor.pw.ts:138`](../../tests/e2e/hit-target-floor.pw.ts#L138)

- The one-status order case, moved from the committed file to a fixture.
  [`registry.test.ts:224`](../../lib/__tests__/registry.test.ts#L224)

- The status-mark case retitled, with its held record row.
  [`status-mark.pw.ts:769`](../../tests/e2e/status-mark.pw.ts#L769)

- DW-244, the premise copy for the Operator before the merge.
  [`deferred-work.md:7655`](deferred-work.md#L7655)
