---
title: 'Registry 1.2.0: version rule split, absorbed_into widened, two tech arrays filled, one description trimmed, one source of truth'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '594e3eb746622c48ceff358a6b1fbbc9c273746f'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Twelve open Registry ledger entries and one ops row. `contract_version` sat at `1.1.0` through two stories of value
changes because its one rule made every editorial fix a minor bump (L1905, `ops/registry-schema.md`
action 6). `absorbed_into` says the code "now lives" where neither fold has happened (L1873).
`tcg-tracker`'s description has no source (L1946). Two `tech` arrays omit what their code runs
(L1968). Lumen's description restates `Archived` (L1927). Every value lives twice, in the Registry
and in `ops/registry-inputs.md`, held equal by nothing (L1744). Planning text states the pre-narrowing
id rule (L1724) and a stale hostname count (L2003); a test comment is stale (L1988, DW-29). The
verification job's history (DW-84) and its 60-day restart (DW-85) are undecided.

**Approach:** Operator ruling 2026-09-24, one package. Split the version rule (wording-only edit
patch, other value change minor, field rename or removal major) into AD-5 and the schema text, and
move the Registry to `1.2.0`. Widen `absorbed_into` to "has been, or is set to be, folded into" in
AD-6, the schema and the gate's refusals. `poketracker-go` gains `Python` and `discord.py`, `mutuo`
gains `PostgreSQL`, each proven from its repository by file and commit; Lumen drops "and it is
archived". `contracts/registry.json` becomes the only source of Registry values and
`ops/registry-inputs.md` is frozen under a dated banner. DW-84 is accepted; AD-22 gains the
verification dispatch, mitigating DW-85. Each ref closes where it lives.

## Boundaries & Constraints

**Always:**

- Every changed behaviour has a test that fails on the baseline tree for the reason it names.
- The `registry-schema` gate and the registry-verification unit suite stay green; `node
  ops/registry-schema.mjs` exits 0 on the final tree.
- Every `tech` array stays within six values; `tcg-tracker`'s description and connect-four-react's
  "retired as a standalone application" clause are unchanged.
- Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with a dated
  paragraph naming the commit and one `status: done`; an ops Pending Operator row gets its Completed
  cell dated and stays; a planning document gets a dated amendment in its own style, never a silent
  rewrite; dated history (spec files, demonstration output, the frozen record's body) is not edited.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written. No credential
  from any repository read is quoted anywhere.

**Ask First:** nothing gates this run. It is unattended; each open decision is resolved from the
rulings, then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md` in that order, and stated under
Design Notes.

**Never:**

- No new gate rule, no change to the schema's shape, keywords or value sets, and no Registry value
  beyond the four the rulings name plus `contract_version`.
- No pin of a `tech` array or a description's text in a test: that is the second copy ruling 6 removes.
- No edit to `cs-tracker`, `list-wheel` or `digital-library` checkouts; no push, no pull request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed pair | final tree | gate green at `1.2.0`, 14 applications | N/A |
| Version refused | `contract_version: "1.0"` | refusal prints the node's three-way rule | named by `/contract_version` |
| Fold refused | `absorbed_into` dangling or self | refusal names "has been, or is set to be, folded into" | named by pointer |
| Archived restates | an `Archived` description saying "archived" | the committed-pair case fails naming the id | a planted entry is caught |
| Directory | `/` at any width | the six rendered entries unchanged; the three edited entries held by FR-35 | N/A |

</frozen-after-approval>

## Code Map

- `contracts/registry.json:3` version; `:109` poketracker-go `tech`; `:120` mutuo `tech`; `:128` lumen
  `description`. Read only by `lib/registry.ts:26` (the Hub) and `ops/registry-verification.mjs:35`.
- `contracts/registry.schema.json:18` `contract_version` description, `:115` `absorbed_into`; the gate
  prints the rejecting node's description in every schema refusal.
- `ops/registry-schema.mjs:811-863` `danglingAbsorbedInto`: docblock and the two refusal strings
  saying "now lives". No test pins them.
- `ops/__tests__/registry-schema.test.ts:217-233` the `1.1.0` pin; `:157-215` the committed-descriptions
  case (the new Archived case goes beside it); `:742-758` the two fold refusals; `:1046-1053` the
  version refusal. 99 cases at baseline.
- Comments: `lib/registry.ts:106` (v1.1.0), `lib/__tests__/registry.test.ts:31` (registry-inputs as the
  values' subject), `tests/e2e/contract-serving.pw.ts:66-72` (DW-29).
- Planning: `ARCHITECTURE-SPINE.md:98` (AD-3 count), `:111` (AD-5), `:117` (AD-6), `:213` (AD-22),
  `:249,253` (conventions rows); `epics.md:299-301` (AD-5 summary), `:2114-2115` (Story 2.3),
  `:2203-2207` (Story 2.5), `:4248-4251` (Story 4.1 restates AD-22's list).
- Records: `ops/registry-inputs.md:1-19` (banner), `:414-423` (stated limit 1); `AGENTS.md:40`;
  `ops/estate.md:12,205-214,227,375`; `ops/registry-schema.md:10-16,45,187,188,214,625,647,671`;
  `ops/registry-verification.md:126-129,146-157,167-168,191`; `ops/monitoring.md:650-659`.
- Ledger `deferred-work.md`: L1724, L1744, L1873, L1905, L1927, L1946, L1968, L1988, L2003, DW-29
  (`:1579`), DW-84 (`:4776`), DW-85 (`:4800`).
- Evidence, read 2026-09-24 by `gh api`: poketracker-go `dev` at `67dc1826a12c1b54e69c76516711d51d180379ba`
  holds `bot/requirements.txt` (`discord.py==2.6.4`, since `3f1ea4c`) and eight `.py` files under `bot/`,
  `bot/parser.py` among them, and no `pubspec.yaml`. Mutuo `main` at
  `abd3b2dab616d3ad9037e2be9e4511fae789eb10` holds `docker-compose.yml` with a `postgres` service on
  `postgres:16-alpine` (since `4cd0f3a`), `drizzle-kit` scripts in `package.json`, and `DATABASE_URL`
  in `.env.example`.

## Tasks & Acceptance

**Execution:**
- [x] Tests first, red on the baseline: the version pin, the two schema-description cases, the two
  refusal-wording assertions, the Archived case with a planted control.
- [x] `contracts/registry.schema.json`, `ops/registry-schema.mjs`: the split rule and the widened
  fold, in the schema text and the refusals, because the gate teaches the rule when it refuses.
- [x] `contracts/registry.json`: the two arrays, Lumen's trim, `1.2.0`.
- [x] The three comments per the Code Map.
- [x] Records and planning amendments per Design Notes; the ledger closings; DW-128.
- [x] Verify per § Verification.

**Acceptance Criteria:**
- Given the baseline tree, when the new and moved cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build, the
  registry-schema gate and the unfiltered container e2e run execute, then all pass and the `/work`
  baseline is unmoved.
- Given `ops/registry-inputs.md`, when a reader opens it, then its first paragraph says it is frozen
  on 2026-09-24, that `contracts/registry.json` is the only source, and where the same-day changes are.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding. Four patches, all to records: `ops/registry-schema.md`'s live case count and two
  of its category rows still read 99, 7 and 9 (blind pass); the demonstration output there quotes
  the pre-ruling fold refusals with no note that they changed (verification-gap pass, a record that
  should have adopted the new wording); Story 4.1's amendment read awkwardly, and the L1744 closing
  called the banner's items "differences" where one is a confirmation (blind pass). Rejected: a test
  pinning the two `tech` arrays or Lumen's text (the second copy ruling 6 removes, Design Notes 6);
  naming enum narrowing in the version rule (the ruling's three-way split is the rule); citing AD-5
  beside AD-16 in the schema text (kept as the node read); relabelling the frozen record's body
  (Design Notes 1). Edge-case pass: no unhandled path in the changed hunks. Ponytail: lean. Design
  layer: no UI surface in this diff. ECC verification loop: build, types and tests as § Verification
  records, lint N/A. No new ledger entry from the review.

## Design Notes

Assumptions, resolved unattended:

1. **Freeze first.** The value changes land under ruling 6, so their evidence lives here and in the
   ledger closings, not in the frozen tables. The banner names the day's differences once, as dated
   facts, and closes stated limit 1; the body is not relabelled.
2. **`tcg-tracker`'s source** is the Operator's confirmation of 2026-09-24, written in the banner
   beside the table row that says "Nothing" and in the L1946 closing.
3. **Array order.** poketracker-go keeps its backend first, then the bot: `Go, PostgreSQL, pgx, sqlc,
   Python, discord.py`. Mutuo's store follows its ORM, as `cuatro-tracker`'s does: `Bun, Vue, Drizzle
   ORM, PostgreSQL, Caddy, Docker`. Redis is in Mutuo's compose too and is not added: the ruling names
   PostgreSQL, and a seventh value breaks the guide.
4. **One minor.** `1.2.0` covers Story 2-25's `list-wheel` `live` and `tech` and this package's arrays;
   Lumen's trim is a patch by the new rule and rides in the same bump.
5. **The gate's refusals change too.** They cite AD-6 and say "now lives"; AD-3's 2026-09-03 narrowing
   set the precedent that the gate must not teach a superseded rule at refusal time.
6. **Tests assert rules, not values.** The Archived case reads the status word only, so
   connect-four-react's "retired" stays, and Live and Complete are out of it (honest uses of "live"
   are why the gate has no status-synonym rule, `ops/registry-schema.md`).
7. **Counts dropped, not updated**: spine AD-3, `ops/registry-schema.md:187`, epics Stories 2.3 and 2.5.
   `ops/routing-inventory.md:468` stays: it is dated and scoped to `cuatro.dev` hosts.
8. **DW-85**: Story 4.1 restates AD-22's list as "exactly", so it gets a dated pointer to the spine's
   list; without it the mitigation the closing claims would not run.
9. **DW-84**: no new reading; September's exists and October's falls due in early November.
10. **The Directory** renders from the committed file (AD-4). None of the three edited entries is
    `Live` or `Complete`, so the six rendered rows, the counts and the framework band do not move.
11. **Figures.** `ops/registry-schema.md` gains dated "Cases in the file" and "failing on the
    pre-ruling tree" rows beside the 99 of 2026-09-03, per its re-measure rule, and its live count
    and two category rows carry the new figures with the old ones beside them.
12. **Found while reading, filed not fixed (DW-128).** `cs-tournament` answers `PUBLIC` to `gh repo
    view` since the KV-2 ruling of 2026-09-24, while `ops/registry-verification.md`'s tolerated table
    and its suite's pins still hold it private. Striking the row is KV-2's records work.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/registry-schema.mjs` and `node ops/literal-conformance.mjs`: exit 0 each.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0; a dated reading only if shipped
  bytes move.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes, no snapshot written.

**As run, 2026-09-24:**
- Red on the baseline, in two stages. With the schema and the gate as at `594e3eb`,
  `corepack pnpm vitest --run ops/__tests__/registry-schema.test.ts`: 4 failed, 97 passed (101), the
  two node cases and the two fold refusals, each on the missing wording. With the Registry at
  `1.1.0`: 2 failed, 100 passed (102), the Archived case naming `lumen` and the pin reading `1.1.0`.
- One commit per ruling group, each verified before it was made: `5cea4f7` typecheck exit 0, unit 60
  files and 1,568 passed, gate exit 0; `d9dbff6` typecheck exit 0, unit 60 files and 1,569 passed,
  gate exit 0 at 14 applications; `2e011d6` typecheck exit 0, `lib/__tests__/registry.test.ts` 77
  passed.
- The final tree, every record edit in place: typecheck exit 0; `corepack pnpm test --run` 60 files,
  1,569 passed; `node ops/literal-conformance.mjs` exit 0; `node ops/registry-schema.mjs` exit 0;
  `corepack pnpm build` exit 0, build `ItbPKwdYwIftnky0DPOSJ`, `public/contracts/registry.json` equal
  to the committed file at `1.2.0`.
- `node ops/asset-budget.mjs` exit 0 at `2e011d6`, no measured input dirty. No shipped byte moved, so
  no reading is filed: every chunk and every prerendered document is the size the DW-121 reading
  records (2,851,997 on disk and 830,259 gzipped in `.next/static/chunks`; documents 21,402, 22,662,
  14,780, 18,101 and 9,578), and each route's gzipped line sits within 2 bytes of it, which is the
  build id inside each document. `/` renders the same six rows, and no client chunk carries the
  Registry.
- The unfiltered container run, the task's command verbatim, with every change in the tree: 337
  passed, 0 failed, 6.1 minutes, exit 0, the `/work` baseline unmoved and no snapshot written.
- The review's four patches touched records alone, none of which a suite or the build reads.

## Suggested Review Order

**The version rule, split three ways (L1905, action 6)**

- Entry point: the rule the editor shows and the gate prints beside a refused version
  [`registry.schema.json:18`](../../contracts/registry.schema.json#L18)

- AD-5 states it, with the old wording quoted and dated
  [`ARCHITECTURE-SPINE.md:113`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L113)

- One minor for every value change since 1.1.0
  [`registry.json:3`](../../contracts/registry.json#L3)

**`absorbed_into` widened (L1873)**

- The node now covers a fold that is intent; `source` says where code sits
  [`registry.schema.json:115`](../../contracts/registry.schema.json#L115)

- The gate's two refusals teach the same meaning at refusal time
  [`registry-schema.mjs:848`](../../ops/registry-schema.mjs#L848)

- AD-6 amended, dated, no data change
  [`ARCHITECTURE-SPINE.md:120`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L120)

**Registry values (L1968, L1927)**

- poketracker-go gains the bot's Python and discord.py, proven on `dev`
  [`registry.json:109`](../../contracts/registry.json#L109)

- Mutuo gains its compose file's PostgreSQL; Redis left out by the ruling
  [`registry.json:120`](../../contracts/registry.json#L120)

- Lumen stops restating Archived
  [`registry.json:128`](../../contracts/registry.json#L128)

**One source of truth (L1744, L1946)**

- The freeze banner: Registry wins, limit 1 closed, the day's changes named
  [`registry-inputs.md:3`](../../ops/registry-inputs.md#L3)

- The ledger closing, with what the ruling does not reach
  [`deferred-work.md:1786`](deferred-work.md#L1786)

**DW-84 and DW-85**

- AD-22's fixed scope gains the dispatch-and-confirm clause
  [`ARCHITECTURE-SPINE.md:216`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L216)

- The monthly reading accepted as the history, with today's observation
  [`registry-verification.md:161`](../../ops/registry-verification.md#L161)

**Peripherals**

- The Archived case, reading the status word alone, beside planted controls
  [`registry-schema.test.ts:217`](../../ops/__tests__/registry-schema.test.ts#L217)

- The node cases for the version rule and the fold meaning
  [`registry-schema.test.ts:422`](../../ops/__tests__/registry-schema.test.ts#L422)

- Story 2.5's narrowed id criterion and the dropped count
  [`epics.md:2207`](../planning-artifacts/epics.md#L2207)

- DW-128, the KV-2 row a public repository still holds
  [`deferred-work.md:6545`](deferred-work.md#L6545)
