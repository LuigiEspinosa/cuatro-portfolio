---
title: 'Token contract 2.0.0: Tailwind spacing keys renamed, exit curve retargeted, container-width gate, palette held in sRGB, cs-tracker re-vendored locally'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '48db1a43b5e7de702628f2b58cf433efa2349ca6'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/contract-adoption.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The published adapter names its spacing keys `--spacing-2xs` to `--spacing-3xl`, so in
every Tailwind consumer `max-w-md` compiles to `var(--s-md)`, 16px, not 28rem (DW-15, retro action
1), and nothing pins what `max-w-*` resolves to (DW-19, retro action 2). The published `--ease-exit`
is an ease-in (DW-103). The `oklch()` downlevelling row asks for a decision (anchor row 2). Contract
1.0.0 is recorded everywhere as the current version.

**Approach:** Operator ruling 2026-09-24, one package, Contract 2.0.0 (an AD-16 MAJOR, no alias
window). Rename the eight keys to `--spacing-s-*`; retarget `--ease-exit` to
`cubic-bezier(0.33, 1, 0.68, 1)`; add a Node gate compiling the adapter with the pinned
`tailwindcss`, red on 1.0.0 first; add a tokens-contract case holding the palette to sRGB; move every
pin and record; re-vendor `cs-tracker` as one local commit of its contract folder; the Hub renders
unchanged.

## Boundaries & Constraints

**Always:**

- `DESIGN.md` first (both suites compare against its blocks), then the DTCG source and the map, then
  `tokens:build` and `fonts:build`, never a hand edit under `contracts/`.
- Every changed behaviour has a test that fails on the baseline tree for the reason it names.
- Records take the UTC date and cite "Operator ruling 2026-09-24"; a ledger entry closes with a dated
  paragraph naming the commit and one `status: done`; an ops row keeps its place with its Completed
  cell dated; a planning document gets a dated amendment in its own style; dated history is not edited.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended; each open decision is resolved from the
rulings, then `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**

- No alias for an old key, no other key, token name or palette value changed, no new dependency, no
  `ci.yml` job added or renamed.
- In `cs-tracker`: nothing staged but `assets/css/cuatro-contracts/`, never `AGENTS.md` or `CLAUDE.md`,
  no push, stash, reset or branch switch. `list-wheel` and `digital-library` untouched.
- No push and no pull request here; no `/work` baseline regenerated.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gate on 1.0.0 | adapter as at baseline | eight cases red, each rule reading `var(--s-<size>)` | names the size and the value read |
| Gate on 2.0.0 | regenerated adapter | `max-w-2xs` to `max-w-3xl` read `var(--container-*)` at 18rem to 48rem | N/A |
| Renamed utility | `p-s-md` in the harness fixture | computes `--s-md`, bound to the token | named by the e2e probe |
| Exit curve | published `--ease-exit` | `cubic-bezier(0.33, 1, 0.68, 1)`, initial slope above linear | the old ease-in fails the case |
| Gamut | a planted `oklch(90% 0.3 288)` | refused, naming the channel | admitted exceptions only by name and reading |
| Re-vendor | `cs-tracker` folder at 2.0.0 | probe copy and version cases PASS; pipeline case stays red (DW-17) | recorded verbatim |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`: `:151`
  frontmatter `ease-exit`; `:239-242` palette prose (the sRGB sentence goes after it); `:868` block
  header `Contract v1.0.0`; `:986` `--ease-exit`; `:1040` adapter block `--spacing-lg`, the one spacing
  key `tailwind-adapter.test.ts:505-515` compares; `:1079-1083` Versioning rename and rollout bullets.
- `packages/tokens/theme-map.json` space section (`--spacing-2xs`..`--spacing-3xl`);
  `packages/tokens/tokens/motion.json:16` `ease.exit`; `packages/tokens/package.json:3` version.
  `build.mjs` reads the version for all three headers (`fonts/build.mjs:88-104` for `fonts.css`); its
  `NAMESPACE_TOKENS` already admits `--s-` under `--spacing-`.
- Pins: `tokens-contract.test.ts:641-652` (`'1.0.0'`, the `Contract v1.0.0` message);
  `tailwind-adapter.test.ts:157-164` `EXPECTED_MAPPINGS`; `ops/__tests__/contract-adoption.test.ts:281-287`
  ledger `0 today`; `ops/__tests__/registry-schema.test.ts:248-256` `1.2.0`;
  `registry-verification.test.ts:795-803` holds the Registry's `cs-tracker` `token_contract` equal to the
  record's row, and the probe holds that row equal to the vendored header.
- New gate: `ops/__tests__/tailwind-container.test.ts`. Prototype observed 2026-09-24 against the 1.0.0
  adapter with `tailwindcss` 4.3.3's `compile()`: every `max-w-<size>` rule read `var(--s-<size>)` and no
  `--container-*` was emitted, 0.1 s, no CLI, no scratch tree. Widths: `node_modules/tailwindcss/theme.css:334-341`.
- Gamut evidence, 2026-09-24, Ottosson's OKLab matrices cross-checked with `colorjs.io` 0.5.2: ten
  palette values sit inside sRGB; `--c-accent-bright` `oklch(76% 0.145 288)` reads linear blue 1.0762
  (in-gamut chroma at that L and h is 0.1304) and `--c-focus` `oklch(84% 0.130 288)` 1.2628 (0.0841).
- `e2e/contract-tailwind.pw.ts` derives its probes from the map: no edit. No Hub stylesheet reads a
  spacing key or `--ease-exit` (`git grep`, 2026-09-24); the Hub is Sass.
- `cs-tracker` at `ae34619`, one ahead of `origin/main`, `AGENTS.md` and `CLAUDE.md` modified by the
  Operator. Uses `max-w-md` (`dashboard_live.ex:252`) and `max-w-sm` (`core_components.ex:519,581`),
  no named spacing utility, no `--ease-*`. `token_contract_test.exs:342` pins `Contract v1.0.0`; 26
  tests, 0 failures at baseline against a throwaway `postgres:16`. Probe at baseline: 19 cases, 18
  PASS, the pipeline case red.
- Records: `ops/contract-adoption.md` `:50-51`, `:63-64`, `:317-326`, ledger `:709-712`, limit
  `:768`, actions `:776-784`; `ops/token-contract.md` `:20-25`, `:151-161`; `ops/tailwind-adapter.md`
  `:31-44`, `:94-102`, `:242-254`, `:506`; `ops/cs-tracker-token-adoption.md:41-78`;
  `ops/anchor-token-adoption.md:196-201`, `:1031`; `ops/registry-schema.md:193`; `contracts/registry.json:3,39`.
- Planning: spine AD-16 (`ARCHITECTURE-SPINE.md:176-180`); `epics.md:3586-3587` (2.31 note),
  `:4705-4711` (8.1 version criterion); `review-apple-design-2026-09-15.md:85-89` (A-4 contract note);
  `AGENTS.md:94-97` pitfall.
- Refs: ledger DW-15 (`deferred-work.md:1262`), DW-19 (`:1349`), DW-103 (`:5624`); `sprint-status.yaml:545-562`
  action items 1 and 2; `ops/anchor-token-adoption.md` action 2.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/tailwind-container.test.ts`: write the gate and run it on the baseline, red first, per the ruling.
- [x] `DESIGN.md`: the adapter line, the block header and `--ease-exit` (both places), the palette sentence and the Versioning amendment, since the suites read it as their oracle.
- [x] `theme-map.json`, `motion.json`, `packages/tokens/package.json`: the rename, the curve and `2.0.0`; then `tokens:build` and `fonts:build`.
- [x] `tokens-contract.test.ts`, `tailwind-adapter.test.ts`: move the pins; add the exit-curve case and the gamut case with a planted control.
- [x] `cs-tracker`: copy the nine token-contract paths, commit that folder alone, run its token contract test.
- [x] `contracts/registry.json`, `registry-schema.test.ts`: `cs-tracker` `token_contract` `2.0.0` and the envelope `1.3.0`, after the re-vendor commit.
- [x] Records, planning amendments, ledger closings, DW-129 and the two action items, per Design Notes.
- [x] Verify per § Verification.

**Acceptance Criteria:**
- Given the baseline tree, when the new and moved cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build and the
  unfiltered container e2e run, then all pass, the `/work` baseline is unmoved and no snapshot is written.
- Given `cs-tracker` after its commit, when the adoption probe runs with `NO_COLOR=1`, then the copy and
  version cases pass and only the pipeline case fails.
- Given `ops/contract-adoption.md`, when a reader opens it, then the published version is 2.0.0, the
  ledger carries one event naming both commits, and the Operator's push and deploy are a pending action.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding. Three patches. The gate held only the eight sizes the old keys shadowed, so a
  spacing key added later at `3xs` or `4xl` to `7xl` would pass it (blind pass): widened to Tailwind's
  whole scale, a superset of the matrix row, shown 8 failed and 5 passed on the 1.0.0 adapter and 13
  passed on 2.0.0. The palette amendment's lead sentence stated a universal its next sentence broke
  (blind pass): reworded as the rule it is. The versioning table's new adapter row sat after the
  rollout row rather than beside the rename it refines: moved. Rejected: pinning `w-*`, `min-w-*` and
  `basis-*` too (one cause, and `max-w-*` sees it); epsilon on the gamut bound (no value sits near an
  edge); the stale mockup curves (Design Notes 8); `epic-2-context.md`'s "Epic 2 does not move it", a
  compiled cache rebuilt when its sources change. Edge-case pass: every unhandled input fails loudly
  inside a case. Ponytail: lean. Design layer: no surface changed; the one motion change is the
  ruled `--ease-exit`, an ease-out, which the animation standard asks for on an exit. ECC verification
  loop: build, types and tests as § Verification records, lint N/A. No new ledger entry from the review.

## Design Notes

Assumptions, resolved unattended:

1. **Rename scope.** The eight scale keys only; `--spacing-page-pad` and `--spacing-tap` collide with
   no container key and stay. 55 mappings stay 55.
2. **No alias window** (ruling): AD-16's deprecate, migrate, remove is waived for this release by a
   dated spine amendment; the ledger row's deprecated-names cell says so.
3. **The gate** uses `tailwindcss`'s own `compile()` with a `loadStylesheet` resolver rather than the
   CLI, because the CLI needs a scratch tree inside the repository. Widths are literal, as Tailwind
   4.3.3 publishes them, so a bump that moves one is a reviewed line.
4. **The palette rule's premise was false**, found by this package: two values are outside sRGB.
   `DESIGN.md` is the value authority and ruling 6 has the Hub render unchanged, so no value moves.
   The case holds every other value inside 0 to 1 and admits the two by name at their readings, so no
   third can join and neither can drift; DW-129 carries the value decision. Anchor row 2 closes on the
   decision, pointing at DW-129, and its "no token outside sRGB" claim gets a dated correction.
5. **Registry**: runbook step 5 moves `token_contract` with the re-vendor commit; AD-5 makes that a
   minor, `1.3.0`. The push-triggered verification run reads `cs-tracker`'s remote `main` at 1.0.0 and
   fails until the Operator pushes: the step 6 window, recorded as expected. The verification suite's
   committed-Registry block plants `cs-tracker`'s header, so that plant moves to the declared 2.0.0 in
   the same commit; its synthetic cases keep 1.0.0.
6. **Notify** (step 3) is the ledger row and the Pending Operator action; no work item is written into
   `cs-tracker`'s workspace tracker, which the ruling does not reach.
7. **`cs-tracker` leftovers** the ruling keeps out of the commit: the pin at `token_contract_test.exs:342`
   and the `app.css` comment naming v1.0.0, both in the Operator's action.
8. **Mockups** keep the old curve; `DESIGN.md` wins on conflict with them.
9. **`AGENTS.md`**: the DW-15 pitfall is deleted, being false from this commit.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0; a dated reading if shipped bytes move.
- The pinned container `pnpm test:e2e`, no filter: every case passes, no snapshot written.
- `NO_COLOR=1 node ops/cs-tracker-adoption-probe.mjs`: copy and version cases PASS, pipeline FAIL only.
- `mix test test/cs_tracker_web/token_contract_test.exs` in `cs-tracker`: result recorded.

**As run, 2026-09-24:**
- Scope: the spec runs past 1600 tokens; the split prompt was answered Keep, as the Operator ruled one
  package.
- Red on the baseline. The gate on the 1.0.0 adapter at 14:42:15Z: 8 failed (8), each rule reading
  `var(--s-<size>)`; widened by the review, 8 failed and 5 passed (13) on the same adapter. The
  exit-curve case on the 1.0.0 `tokens.css`: failed, "opens at slope 0, which is an ease-in". With the
  bump built and the pins unmoved: 4 failed, the record's version line, the two version pins in
  `tokens-contract.test.ts` and `EXPECTED_MAPPINGS`. With the Registry at 2.0.0 and the planted header
  unmoved: 5 failed in `registry-verification.test.ts`, each on the mismatch.
- `cs-tracker`: `991d0f6` stages the vendored folder alone (three files moved); `AGENTS.md` and
  `CLAUDE.md` untouched and unstaged, nothing pushed. Its token contract file against a throwaway
  `postgres:16`: 26 tests, 0 failures before the copy and 26 tests, 1 failure after, the `:342` pin.
  Its own Tailwind 4.1.12 compiles `max-w-md` and `max-w-sm` to `var(--container-md)` and
  `var(--container-sm)`.
- Commits, each verified before it was made: `40591cd` typecheck exit 0, unit 61 files and 1,580
  passed, literal and purity gates exit 0; `ae7ffb2` registry gate exit 0, unit 61 files and 1,580
  passed, typecheck exit 0; `1a94020`, the review's widening of the gate, by the final-tree run below.
- `corepack pnpm build` exit 0 at `ae7ffb2`, build `8lYebNNfgiclmtAUbcLF_`, `public/contracts/` at
  v2.0.0. `node ops/asset-budget.mjs` exit 0, no measured input dirty: every route 1 to 7 bytes lighter
  gzipped, the global stylesheet's curve, filed as a dated reading in `ops/asset-budget.md`.
- `NO_COLOR=1 node ops/cs-tracker-adoption-probe.mjs` at 14:59:08Z: 19 cases, 18 PASS, 1 FAIL; the copy
  and version cases pass at 2.0.0, and the one FAIL is the pipeline case (DW-17), as at baseline.
- The unfiltered container run, the task's command verbatim, at `ae7ffb2` with the records in the
  tree: 337 passed, 6.1 minutes, exit 0, the `/work` baseline matched and no snapshot written; the
  adapter probe minted `p-s-2xs` to `p-s-3xl` at 4px to 96px.
- The final tree: typecheck exit 0; `corepack pnpm test --run` 61 files, 1,585 passed; literal,
  registry-schema and contract-purity gates exit 0; `tokens:build` and `fonts:build` leave
  `contracts/` clean.

## Suggested Review Order

**The rename (DW-15)**

- Entry point: the eight keys under names no Tailwind namespace shares
  [`tailwind.css:76`](../../contracts/tailwind.css#L76)

- The map they are generated from; `--spacing-page-pad` and `--spacing-tap` stay
  [`theme-map.json:94`](../../packages/tokens/theme-map.json#L94)

- The authored block the adapter suite compares against, amended and dated
  [`DESIGN.md:1059`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L1059)

- AD-16 waives the alias window for this release, dated
  [`ARCHITECTURE-SPINE.md:181`](../planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md#L181)

**The gate (DW-19)**

- Tailwind's own `compile()` over one `@import`, no CLI, no scratch tree
  [`tailwind-container.test.ts:54`](../../ops/__tests__/tailwind-container.test.ts#L54)

- The whole container scale, literal, so a Tailwind bump is a reviewed line
  [`tailwind-container.test.ts:38`](../../ops/__tests__/tailwind-container.test.ts#L38)

- The red-first transcript and the adopter's own compile
  [`tailwind-adapter.md:265`](../../ops/tailwind-adapter.md#L265)

**The exit curve (DW-103)**

- The published value, one byte longer, the CSS form of `power2.out`
  [`tokens.css:125`](../../contracts/tokens.css#L125)

- Holds the opening slope above linear, red on 1.0.0
  [`tokens-contract.test.ts:925`](../../packages/tokens/__tests__/tokens-contract.test.ts#L925)

**The palette rule, and why it admits two**

- Two values were already outside sRGB; admitted by name and reading only
  [`tokens-contract.test.ts:837`](../../packages/tokens/__tests__/tokens-contract.test.ts#L837)

- The rule in the palette section, the two named, DW-129 pointed at
  [`DESIGN.md:249`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L249)

- The value decision left for the Operator, with the in-gamut chroma for each
  [`deferred-work.md:6608`](deferred-work.md#L6608)

**Propagation (runbook steps 1 to 6)**

- The ledger's first event: both commits, the probe, the window
  [`contract-adoption.md:729`](../../ops/contract-adoption.md#L729)

- What the Operator does next in `cs-tracker`, step by step
  [`contract-adoption.md:803`](../../ops/contract-adoption.md#L803)

- The Registry follows the re-vendor, and the envelope takes a minor
  [`registry.json:39`](../../contracts/registry.json#L39)

- The verification suite's planted header moves with the declaration
  [`registry-verification.test.ts:84`](../../ops/__tests__/registry-verification.test.ts#L84)

**Peripherals**

- The version pin, with the reason beside it
  [`tokens-contract.test.ts:647`](../../packages/tokens/__tests__/tokens-contract.test.ts#L647)

- The adapter's pinned mapping list
  [`tailwind-adapter.test.ts:161`](../../packages/tokens/__tests__/tailwind-adapter.test.ts#L161)

- The ledger pin moved to 1
  [`contract-adoption.test.ts:287`](../../ops/__tests__/contract-adoption.test.ts#L287)

- Story 8.1's version criterion, amended
  [`epics.md:4716`](../planning-artifacts/epics.md#L4716)

- The anchor record's action 2, dated and closed on the ruling
  [`anchor-token-adoption.md:1036`](../../ops/anchor-token-adoption.md#L1036)
