---
title: 'Process and upkeep: AD-22 gains four re-checks, accepted limits closed, ledger ids assigned, oversized-spec rule, AGENTS.md refreshed'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_commit: '935df2651b87bd1063004a700834406f69ba6efe'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/contract-adoption.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Five ops rows ask for a re-check "on the settled-inputs schedule" that AD-22's fixed
list does not name, so none has a schedule. DW-82, DW-14, `ops/font-contract.md` row 4,
`ops/token-contract.md` rows 4 and 5 and `ops/contract-adoption.md` row 6 wait on decisions now
taken. The ledger has 99 entries with no id and 51 with no status. The oversized-spec warning has
no rule behind it (Epic 1 retro action 12), and the `AGENTS.md` managed block was last verified on
2026-08-28 (retro action 14, and two ledger entries booked to that refresh).

**Approach:** Operator ruling 2026-09-24, one package. One dated AD-22 clause names the four
re-checks with their narrower triggers; the sweep and the two pin checks run once now and are
recorded. The accepted limits and the folded rows close where they live. Ids and statuses are given
in place and every open or statusless entry is checked against the tree. The oversized rule
becomes a Build persistent fact. `bmad-project-context` refreshes the block.

## Boundaries & Constraints

**Always:** Records take the UTC date (2026-09-25) and cite "Operator ruling 2026-09-24". An ops
row keeps its place and its Completed cell is dated. A planning document takes a dated amendment
in the style it already uses. No existing DW id moves and no ledger entry is deleted. The policy
table keeps one row per repository and, where a value moved, writes the old value and its date
beside the new one. No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything
written.

**Ask First:** nothing gates this run; it is unattended. Each open point is resolved from the
rulings, then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**
- No fonts release: no edit under `contracts/`, `packages/fonts/` or to any contract listing pin.
- No repository setting changed anywhere: the sweep is read-only GETs. No edit in the `cs-tracker`,
  `list-wheel` or `digital-library` checkouts. No push, no pull request.
- No fix for an open entry outside this package's refs: the audit sets ids, statuses and
  evidence-backed closures only. The `AGENTS.md` § Dependency automation policy stays byte-identical.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Id-less entry | a `- source_spec:` entry with no `id:` line | `id: DW-n` as its second line, n from 141 upward in file order | N/A |
| Statusless entry | no `status:` line | `status: open`, or `status: done` with a dated closing note naming its evidence | N/A |
| Open entry resolved in fact | the tree or a dated record shows it fixed or superseded | `status: done` and a closing note citing file:line or commit | N/A |
| Open entry not resolved | anything else, or state only the box or an Operator can show | left as it is | N/A |
| Oversized spec, any run | Build's token count exceeds 1600 | halts at CHECKPOINT 1 for the Operator's Split or Keep; an orchestrator may relay the Operator's answer for that named spec; the spec records answer, count and source | never answered by the run itself |

</frozen-after-approval>

## Code Map

- `ARCHITECTURE-SPINE.md:217` AD-22 Rule: dated "added" clauses, the last 2026-09-24 (DW-85), ending
  "Nothing outside that list re-opens". `epics.md:4281-4284` Story 4.1's 2026-09-24 amendment lists
  the scope's growth; Story 3.3 is `:3958-3999`.
- `ops/contract-adoption.md`: policy sentence `:176-181`; § The estate, observed `:227-271` (table
  header parsed by `policyRows`, `ops/contract-adoption.mjs:203-222`, estate held by
  `assertEstateCovered`); paragraph `:273-283`; limits `:779`, `:784`; actions 4 to 6 `:803-805`;
  maintenance rule `:809-822`. Sweep raw answers: scratchpad `pu-sweep.json`, 2026-09-25T02:03:02Z
  to 02:06:01Z.
- `ops/cs-tracker-accessibility-pass.md:850` row 2, the mirror of contract-adoption row 4.
- `ops/font-contract.md`: limits `:459` (Linux tuning, row 4) and `:466` (DW-82); rows 3 and 4
  `:477-478`. Pins: `packages/fonts/sources.json`; the subset pipeline `packages/fonts/subset.py:150-250`.
- `ops/tailwind-adapter.md:585` row 2; pins `package.json:38,51`; `TAILWIND_NAMESPACES` in
  `packages/tokens/build.mjs`.
- `ops/token-contract.md:582-583` rows 4 and 5, context `:482-555`.
- `ops/cs-tracker-token-adoption.md:769-787` Stated limits, where DW-14's acceptance goes.
- `_bmad-output/implementation-artifacts/deferred-work.md`: header `:1-4` says "Append only"; DW-14
  `:1283`; DW-82 `:5016`; the registry-inputs pointer entry `:1817`; the two-sources entry `:2344`;
  DW-139 `:7206`. Closure style: a dated paragraph in the `evidence: |-` or `reason: |-` block, or a
  `note: |-` field where evidence is a plain scalar, then `status: done`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:635-642`, `:671-677`, `:690-696`: retro
  actions 8, 12 and 14, closed by a dated comment above each, as actions 1 to 5 were.
- `_bmad/custom/bmad-build.toml:49-54` `persistent_facts`; the token check it binds is step 2
  instruction 6 of the rendered Build workflow.
- `AGENTS.md:1-148` managed block, provenance `Verified 2026-08-28 against c490f33`;
  `ops/__tests__/contract-adoption.test.ts:440-455` pins the policy section after the block.
  Evidence for the new lines: `app/__tests__/anchor-contract.test.ts:112-116,1140-1172` (the two
  sources, `app/scss/_index.scss` and `lib/registry.ts`, and the Registry pair);
  `.github/workflows/deploy.yml:83-85` (`SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`).

## Tasks & Acceptance

**Execution:**
- [x] `ARCHITECTURE-SPINE.md`: one clause "added 2026-09-25 (Operator ruling 2026-09-24)" naming the
  accessibility probe (after Story 8.1 and on any Tailwind or daisyUI bump reaching `cs-tracker`),
  the automation-policy sweep (when a repository gains a workflow or an automation configuration),
  the upstream font pins (before any regeneration of the published faces) and the Tailwind pin with
  `TAILWIND_NAMESPACES` (on any bump); `epics.md` Story 4.1 gains one dated sentence. The rows
  need a schedule the spine owns.
- [x] `ops/contract-adoption.md`: the sweep's cells per the maintenance rule, dated amendments to the
  paragraph at `:273`, the policy sentence and the limits at `:779` and `:784`; rows 4 (scope half),
  5 and 6 dated. Rulings 1 and 4.
- [x] `ops/cs-tracker-accessibility-pass.md`: row 2 scope half, re-run left open. Mirror.
- [x] `ops/font-contract.md`, `ops/tailwind-adapter.md`: font row 3 with the three-face check, row 4
  accepted, DW-82's limit row amended; Tailwind row 2 with the pin reading. Rulings 1 and 2.
- [x] `ops/token-contract.md`, `epics.md` Story 3.3: rows 4 and 5 closed to a dated Story 3.3 note. Ruling 3.
- [x] `ops/cs-tracker-token-adoption.md`: a Stated limits row for DW-14, accepted. Ruling 2.
- [x] `deferred-work.md`: dated header note; ids DW-141 upward; statuses; the audit; closures of
  DW-82, DW-14 and the two `AGENTS.md` entries; new entries for what this package finds; a dated
  narrowing note on DW-139. Rulings 2, 6 and 7.
- [x] `_bmad/custom/bmad-build.toml`: the oversized rule as a persistent fact. Ruling 5.
- [x] `AGENTS.md`: `bmad-project-context` refresh: keep the alias-layer line and the Registry
  pointers, add the host-move line (all three secrets together) and the two-sources line, state the
  current suite size, re-verify every other line. Ruling 7.
- [x] `sprint-status.yaml`: retro actions 8, 12 and 14 done, each with a dated comment.

**Acceptance Criteria:**
- Given the spine, when AD-22 is read, then one clause dated 2026-09-25 names the four re-checks and
  their triggers, and the rule still ends "Nothing outside that list re-opens".
- Given the five scope rows, when read, then each is dated with its scope half, the three checks run
  now carry what they observed, and the accessibility probe's re-run stays open.
- Given the ledger, when scanned, then every entry carries one id and one status, the ids run from
  DW-1 with no gap and no duplicate, and DW-1 to DW-140 sit where they did.
- Given the Build workflow rendered by `render_skill.py`, when its persistent facts are read, then
  the oversized rule is among them, where the baseline render has none.
- Given the refreshed `AGENTS.md`, when diffed, then only the block moved, and it carries the four
  lines ruling 7 names.
- Given the verification set, when it runs, then typecheck, the full Vitest suite, literal
  conformance, the build and the pinned-container e2e run pass with no filter, and no shipped byte moves.

## Spec Change Log

## Design Notes

**Stated assumptions.** Keep at both split prompts, step 1's multi-goal check and step 2's token
check (about 2,800 tokens by characters over four, against 1600): the Operator ruled this one
package, and the orchestrator relayed that answer, which is recorded here as the new rule asks. The
cost is a long spec for one implementer, accepted because the investigation and the implementation
are held by the same session. Ids start at DW-141, the next free id: DW-123 to DW-140 were
filed by later packages after the brief counted at `9bf4f20`. The pin re-check covers all three
faces, since row 3 names both upstream pins and Geist Mono shares Geist's repository; the ruling
names Geist Mono because upstream moved there. Rows whose check also ran now (contract-adoption 5,
font 3, Tailwind 2) close in full, as `ops/daisyui-route.md` action 2 did on 2026-09-23. The sweep
re-observed the sentence DW-139 names in `ops/contract-adoption.md`, whose trigger is "the next pass
over" that file, so that one takes a dated amendment; the `AGENTS.md` policy section and
`ops/registry-verification.md` stay DW-139's. The oversized rule has no committed test: the rendered
workflow is the observable, checked at the baseline and after. No halt needed `DESIGN.md`,
`EXPERIENCE.md` or `RESTYLE-SPEC.md`: nothing here renders.

**Found while investigating, filed rather than fixed.** DW-240: the shipped
`contracts/fonts/geist-mono-latin.woff2` carries the 69 programming ligatures Geist 1.7.0 put under
`liga`, and upstream's fix ships only in its release zip, so the pinned repository path is
byte-identical at `main` (no fonts release, by the ruling). DW-241: Build's four ledger templates
append entries with no `id:` or `status:`, so the numbering this package gave decays unless a
persistent fact holds it, a rule nobody has ruled. DW-242: `epics.md`'s requirements inventory
still gives AD-22's 2026-08-15 list as the whole scope.

## Verification

**Commands:**
- `corepack pnpm typecheck`, expecting exit 0.
- `corepack pnpm test --run`, expecting every file to pass (the baseline was 1634 in 63 files at `935df26`).
- `node ops/literal-conformance.mjs`, expecting exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`, expecting exit 0 and no shipped byte moved.
- The pinned container run from `AGENTS.md`, with no filter, expecting every test to pass.
- `uv run _bmad/scripts/render_skill.py` for bmad-build, then a search of its `workflow.md` for the
  rule, expecting it absent at the baseline and present after.
- The ledger scan (scratchpad `pu-ledger-scan.mjs`), expecting none without an id, none without a
  status, no duplicate and no gap.
- A punctuation sweep over every added line, expecting no em-dash, en-dash, spaced `--` or emoji.

## Review Triage Log

### 2026-09-25, Review pass

Six layers over `935df26..` plus this spec, each in its own `claude -p` session at this session's
model, because this sub-agent has no Agent tool, the separate-session fallback the retro-3 package
also used. The Blind Hunter ran with no tools; the Edge Case Hunter and the Verification Gap layer
could read files; the Ponytail layer could invoke its skill; the ECC verification loop ran after the
container e2e run had finished, so its build could not rewrite `public/contracts/` under a running
server, with only the build, typecheck and test commands allowed. The Design Review layer skipped
itself: no surface and no motion token in the added lines. The Verification Gap layer found none.
The ECC loop reported build, types and tests passing, 1634 of 1634, and one citation to correct.

- intent_gap: 0
- bad_spec: 0
- patch: 17 (high 0, medium 1, low 16)
- defer: 1 (DW-243)
- reject: 25
- addressed_findings:
  - `[medium]` `[patch]` The stated limit "A required status check holds nowhere, and cannot hold in
    four repositories" still counted four private repositories after the sweep read three; it takes a
    dated amendment, as the policy sentence did.
  - `[low]` `[patch]` That limit's sibling rows: "one day's, by one token" still pointed at action 5
    as pending, and "`cs-tracker`'s adoption is not on the remote" contradicted the re-observed remote
    at `32a466a`; both are dated.
  - `[low]` `[patch]` The `AGENTS.md` e2e line now says the first `-v` names the checkout under test,
    and the generated-files line no longer claims the drift jobs catch a hand edit of a binary.
  - `[low]` `[patch]` The oversized fact names its halt as the plan checkpoint's first question, the
    ruling's word, and the ledger header says the next free id is one above the highest.
  - `[low]` `[patch]` DW-10's closure says its 7.03:1 is a design pair, DW-14's names the sweep that
    would see automation arrive, DW-240 records the zip's URL, both full digests and the CSS
    `content` sweep, DW-241 names the unit case as the other closer, and DW-139 cites `:181-183`.
  - `[low]` `[patch]` The DW-82 limit row retires its trigger and takes the Decision nature; the
    Tailwind row cites `dd490c5`, where the namespace list and the 4.3.3 pin arrived together.
  - `[low]` `[patch]` The verdict paragraph's amendment was cut to what it adds, the sweep paragraph
    lists every call it made, and the spec's verification list lost a broken wrap.

Deferred, 1: DW-243, the sweep and font-check scripts AD-22 now schedules are not committed.
Rejected, 25: the spec untracked and resultless mid-review (this commit carries both); AD-22's
`Binds:` line and its long sentence (the 2026-09-23 and 2026-09-24 clauses have the same shape);
DW-10's pre-existing `location:` and truncated reason; DW-178 closed with the `README.md` residual
its own text called debt only; the split Completed cells (the adoption record's 2026-09-23 row set
that precedent); Story 3.3's note not being a criterion (the ruling asked for a note); cited line
numbers drifting; DW-135 and DW-210 left unlinked (unproven as one flake); a stale `.next` volume
(the harness rebuilds each run); the loop's halted state, a relayed answer's provenance, a renamed
spec's answer and the token method (Build's own, not this fact's); DW-240's detector and its
`cs-tracker` sweep (stated as not done); rows 4 and 5 closed before Story 3.3 (the ruling); a
nonstandard status (the scan reports it); and seven Ponytail cuts that would remove what the rulings
or the records' own maintenance rules require.

## Result

Verified 2026-09-25. `corepack pnpm typecheck`: exit 0 at `5ce9b1a`, and again at `4aba120` by the
ECC layer. `corepack pnpm test --run`: 1634 of 1634 in 63 files, 80.9 s at the baseline `935df26`,
91.7 s at `5ce9b1a` and 88.6 s at `4aba120`. `node ops/literal-conformance.mjs`: exit 0.
`corepack pnpm build`: exit 0, `published 11 files at /contracts/`; `node ops/asset-budget.mjs`: the
chunk totals match the committed reading to the byte (2,851,998 on disk, 830,256 gzipped, narrative
619,351), and `/work` and `/cv` read 1 and 2 bytes heavier, the build id inside the document, so no
reading was filed. The pinned container e2e run with no filter: 337 passed in 8.3 minutes, exit 0,
on `5ce9b1a`'s tree; no e2e spec reads a file the review round changed. The render check: the
baseline render carries no oversized fact, and the render after `4aba120` carries it. The ledger
scan: 243 entries, DW-1 to DW-243 with no gap and no duplicate, every entry statused, DW-1 to DW-140
in their old order and DW-141 to DW-239 ascending in file order. The punctuation sweep: no hit but
the pre-existing CLI token `pnpm test -- --coverage` in a rewritten table row.

Commits: `2ec24c1` (AD-22), `0c88b5b` (the oversized fact), `79dccf7` (ids, statuses and the
audit), `9dfd37c` (the `AGENTS.md` refresh), `ad52501` (the ops records and Story 3.3), `5ce9b1a`
(the package's ledger closures and the board), `4aba120` (the review round), and this record commit.

## Suggested Review Order

**The schedule the rulings added**

- One dated clause; four re-checks, each with the trigger its row asked for.
  [`ARCHITECTURE-SPINE.md:217`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L217)

- The sweep, run once: what moved, and the method a rebuild needs.
  [`contract-adoption.md:262`](../../ops/contract-adoption.md#L262)

- `cs-tournament`'s row: the one required-check cell that moved.
  [`contract-adoption.md:280`](../../ops/contract-adoption.md#L280)

- The font pins: Geist Mono changes, Geist and Bricolage do not.
  [`font-contract.md:452`](../../ops/font-contract.md#L452)

- The five scope rows, dated; the accessibility re-run stays open.
  [`contract-adoption.md:821`](../../ops/contract-adoption.md#L821)
  [`cs-tracker-accessibility-pass.md:850`](../../ops/cs-tracker-accessibility-pass.md#L850)
  [`font-contract.md:492`](../../ops/font-contract.md#L492)
  [`tailwind-adapter.md:585`](../../ops/tailwind-adapter.md#L585)

**The ledger, numbered and audited**

- The header states the in-place migration and what still holds.
  [`deferred-work.md:6`](deferred-work.md#L6)

- The first id given, with the first found-resolved closure below it.
  [`deferred-work.md:14`](deferred-work.md#L14)

- What the package filed: the Geist Mono ligatures, the templates, the tooling.
  [`deferred-work.md:7551`](deferred-work.md#L7551)
  [`deferred-work.md:7636`](deferred-work.md#L7636)

**The agent block**

- The host-move audit and the two sources, beside the other guards.
  [`AGENTS.md:123`](../../AGENTS.md#L123)
  [`AGENTS.md:158`](../../AGENTS.md#L158)

- The suite size, and the container command a host run cannot replace.
  [`AGENTS.md:55`](../../AGENTS.md#L55)
  [`AGENTS.md:69`](../../AGENTS.md#L69)

**Accepted limits and folded rows**

- DW-14 as a stated limit, closed in the ledger on the ruling.
  [`cs-tracker-token-adoption.md:788`](../../ops/cs-tracker-token-adoption.md#L788)
  [`deferred-work.md:1469`](deferred-work.md#L1469)

- Rows 4 and 5 point at Story 3.3, which carries the note.
  [`token-contract.md:582`](../../ops/token-contract.md#L582)
  [`epics.md:3999`](../planning-artifacts/epics.md#L3999)

**Process**

- The oversized rule, orchestrated runs included.
  [`bmad-build.toml:54`](../../_bmad/custom/bmad-build.toml#L54)

- Retro actions 8, 12 and 14 closed with their commits.
  [`sprint-status.yaml:635`](sprint-status.yaml#L635)
