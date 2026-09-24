---
title: 'Epic 1 close: probe pin follows 32a466a, probes strip colour codes, both probes green, 1-16 and 1-19 closed, Epic 1 done'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '39ef7bc8b0d06965c165ae6ef9028deec10fbba6'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/cs-tracker-token-adoption.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1 cannot close. The adoption probe still requires `cuatro.fonts` in `assets.setup`,
which `cs-tracker`'s `32a466a` removed, so it exits 1 (DW-17, contract-adoption row 7). Both
`cs-tracker` probes exit 3 from a plain shell because Tailwind colours its `--help` banner (DW-109).
Stories 1-16 and 1-19 sit at awaiting-operator on rows the Operator has now ruled on.

**Approach:** Operator ruling 2026-09-24, one package. The pipeline pin requires `cuatro.fonts` in
`assets.build` and in `assets.deploy` ahead of `phx.digest` only. Both probes strip escape sequences
before matching the banner. Each change gets a unit case that is red on the baseline. Both probes are
re-run from a plain shell to exit 0. Every ruled row, ledger entry, spec and board row is closed where
it lives, and Epic 1 moves to done.

## Boundaries & Constraints

**Always:** Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with
a dated paragraph naming the commit and `status: done`. An ops row keeps its place and gets its
Completed cell dated. A planning document gets a dated amendment in its own style, and dated history
is never edited. Every changed behaviour has a test that fails on the baseline. No em-dash, en-dash,
double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended. Each open point is resolved from the
rulings, then from `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**
- No change in `cs-tracker`. Its `AGENTS.md` and `CLAUDE.md` are Luigi's, and there is no push,
  stash, reset or branch switch there. The probes' own plant-and-remove is their designed behaviour.
- No fix for the 38 transition or 74 hit-target findings. They are Story 8.1's.
- No new dependency, no `ci.yml` change, no `/work` baseline regenerated, no push, no pull request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Coloured banner | `--help` stdout as the 4.1.12 binary prints it with `NO_COLOR` unset (`tailwindcss ESC[34mv4.1.12ESC[39m`) | `tailwindcss v4.1.12` | baseline match reads null, exit 3 |
| Plain or absent banner | `NO_COLOR` output; empty or undefined stdout | the banner; null | Block If says "no version at all" |
| Pipeline at `32a466a` | `cuatro.fonts` in build and in deploy ahead of digest, absent from setup | PASS | N/A |
| Pipeline regressions | out of build; out of deploy; after digest; target not beside the Tailwind output | FAIL | detail names the part |

</frozen-after-approval>

## Code Map

- `ops/cs-tracker-adoption-probe.mjs`: `:1052` banner match, read again at `:1131` and `:1219` as
  `banner[1]`. The pipeline case at `:1654-1692` is inline in `probe()` and reads `mix.exs`, the
  task's `@target_rel` and `config.exs` `--output`. Pure helpers are exported, as `fontUrls` at `:644`
  and `findTailwindBinary` at `:925` are.
- `ops/daisyui-route-probe.mjs`: `:748` has the same match through the private `firstMatch` at `:280`.
- `ops/__tests__/{cs-tracker-adoption,daisyui-route}-probe.test.ts`: the graph shows these are the
  only importers. Neither pins the banner or the pipeline today (a grep for `assets.setup`,
  `cuatro.fonts` and `pipeline` finds nothing).
- Observed 2026-09-24: `cs-tracker`'s `_build/tailwind-windows-x64.exe --help` through a pipe prints
  `ESC[3mESC[1mESC[34m≈ESC[39mESC[22mESC[23m tailwindcss ESC[34mv4.1.12ESC[39m`. `cs-tracker` HEAD is
  `991d0f6`, and `mix.exs:116-128` has `assets.setup` without the task.
- The records to close are rows 2, 3 and 5 plus the § Where the compiled output lands table and the
  NO_COLOR paragraph at `:535` in `ops/cs-tracker-token-adoption.md`; the NO_COLOR paragraph at `:420`
  and row 2 in `ops/daisyui-route.md`; rows 3 and 7 in `ops/contract-adoption.md`; row 1 in
  `ops/cs-tracker-accessibility-pass.md`; and rows 3 and 4, the caveat at `:362-367` and the
  paragraph at `:521` in `ops/contract-serving.md`.
- Planning: `epics.md` Story 1.16 `:1740-1744`, Story 1.19 `:1913-1914` (S-8), Story 4.6
  `:4321-4322` ("interim mechanism"), and Story 8.1's S-8 criterion at `:4703-4707`.
- Ledger: DW-17 at `deferred-work.md:1347`, whose `reason:` is a one-line scalar that becomes a `|-`
  block, and DW-109 at `:5869`.
- Board: `sprint-status.yaml:55` (epic-1), `:128-142` (1-16 and 1-19, with their comments), and
  action items 9 and 11 at `:616-640`. The two park records are
  `.bmad-loop/operator/1-1{6,9}-*.json`, and specs 1-7, 1-8, 1-10, 1-16 and 1-19 all read
  `awaiting-operator`.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/daisyui-route-probe.test.ts`, `ops/__tests__/cs-tracker-adoption-probe.test.ts`: cases for an exported `tailwindBanner` fed the observed coloured bytes, the plain banner and no banner. Seen red first.
- [x] `ops/daisyui-route-probe.mjs`, `ops/cs-tracker-adoption-probe.mjs`: export `tailwindBanner(helpText)`, which matches after `stripVTControlCharacters`, and call it at both match sites.
- [x] `ops/cs-tracker-adoption-probe.mjs` and its test: extract `pipelineVerdict(mixExs, fontsTask, configExs)` returning `{ pass, detail }`, drop the `assets.setup` term, cover the matrix rows red on the old rule first, and have `probe()` record its result.
- [x] Run both probes from Git Bash with `NO_COLOR` unset, after `corepack pnpm build`. Both must exit 0, or the package blocks.
- [x] Ops records: close every row listed in the Code Map as ruled. Replace both NO_COLOR paragraphs with a dated note, add a dated 2026-09-24 re-run section to each probe record, and add a dated "Wired into" row.
- [x] `epics.md`: dated amendments at Stories 1.16, 1.19 and 4.6, and a dated note at Story 8.1 booking S-8, the 74 hit-target findings and the 38 transition findings.
- [x] `deferred-work.md`: dated closing paragraphs on DW-17 and DW-109 naming their fix commits, and `status: done`.
- [x] Specs 1-16 and 1-19: `status: 'done'`, plus a dated closing note naming how each parked action was resolved. Specs 1-7, 1-8 and 1-10: `status: 'done'`. `git rm` both park records.
- [x] `sprint-status.yaml`: 1-16, 1-19 and epic-1 to done, and items 9 and 11 to done, keeping every comment and adding a dated one.

**Acceptance Criteria:**
- Given the baseline probes, when the new unit cases run against them, then the coloured-banner and post-`32a466a` cases fail.
- Given this change, when `corepack pnpm test --run` runs in full, then every case passes.
- Given a plain Git Bash with no `NO_COLOR`, when each probe runs, then it exits 0 and `cs-tracker`'s `git status --porcelain` is unchanged.
- Given the closing commits, when `bmad-loop confirm --list` runs, then nothing is parked.
- Given the board, when it is read, then epic-1, 1-16 and 1-19 are done, and every earlier comment survives.

## Spec Change Log

## Design Notes

Stated assumptions, resolved without a halt:

- There was no pipeline unit case to "move". The rule becomes an exported pure verdict, and its case
  is written at the new rule.
- The escapes are stripped with `node:util`'s `stripVTControlCharacters` rather than a hand regex. It
  is stdlib (Node 16.11 and later, where CI runs 22) and it strips every CSI and OSC sequence.
- The park records are removed by hand rather than by `bmad-loop confirm`. That tool's audit text
  says every parked action "was carried out" by "a human", which is false for 1-16 action 4 and 1-19
  action 4, since the rulings re-bind both. Its `chore(operator)` subject also breaks this package's
  convention. The end state is the one the tool reaches.
- The same rulings change Story 4.6 ("the interim mechanism") and Story 1.19's S-8 criterion, so each
  gets a dated amendment beside Story 1.16's.
- `--color-secondary` cites `RESTYLE-SPEC.md` § 1 Control ("There is no filled control anywhere in
  this system") and § Family A step 2. The brief's "§ 1a" does not exist.
- The retro document stays as filed. Items 9 and 11 close on the board, as items 1 and 2 did in
  `39ef7bc`.
- `cs-tracker/AGENTS.md:36-39` at HEAD still says `assets.setup`. Luigi's uncommitted rewrite drops
  the line, so correcting it is his, listed as an operator action.
- No shipped byte moves, because the change is `ops/` and docs only. The build confirms it, so there
  is no asset-budget reading.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file and case green.
- `node ops/literal-conformance.mjs` and `corepack pnpm build`: exit 0.
- The pinned Playwright container run of `pnpm test:e2e`: green, no filter.
- `node ops/daisyui-route-probe.mjs` and `node ops/cs-tracker-adoption-probe.mjs` from Git Bash with `NO_COLOR` unset: exit 0 each.
- `bmad-loop confirm --list`: no story parked.

## Review Triage Log

### 2026-09-24, Review pass

No reviewer subagent could be spawned from this session, so the six layers ran inline, under the
Operator's authorization of a sub-agent acting as the reviewer: Blind Hunter, Edge Case Hunter,
Verification Gap, Ponytail, the ECC verification loop and Design Review.

- **patch, fixed.** The spec's nine tasks were still unticked after implementation.
- **patch, fixed.** The stale `cs-tracker` bullet was cited as `AGENTS.md:36-37`. The bullet spans
  `:36-39`, as row 7 first cited it, so the citation now reads `:36-39` in `ops/contract-adoption.md`,
  DW-17 and Design Notes.
- **reject.** The two `tailwindBanner` copies (Ponytail, `net: -11 lines possible`). Epic 1 retro
  action 10 owns the shared probe module, and the ruling asks each probe to carry its own case.
- **reject.** These parser boundaries were moved verbatim from the baseline, and none is reachable in
  `cs-tracker` today:
  - an alias list is cut at its first `]`;
  - `#` is stripped inside strings;
  - "NOT before phx.digest" is printed when the task or the digest is absent from `assets.deploy`;
  - a prerelease suffix on `v4.1.12` would pass the pin.
- **none.** The Verification Gap layer found nothing. Both call sites are exercised by the
  2026-09-24 plain-shell runs, which is the documented shape of a hand-run probe. Edge Case Hunter
  found no unhandled path in the changed hunks.
- **approve.** Design Review found no UI surface and no motion code. Its keyword hits are record
  prose about findings booked to Story 8.1 and the already-published `--ease-exit`.
- **ECC verification loop.** `corepack pnpm build` exit 0. `corepack pnpm typecheck` exit 0. Lint is
  N/A, since this repository has no lint command. `corepack pnpm test --run`: 61 files, 1,595 passed.
  `node ops/literal-conformance.mjs` exit 0. `node ops/asset-budget.mjs` exit 0, reading the DW-15
  totals byte for byte (2,851,998 on disk, 830,256 gzipped). The one-byte route moves on Next's own
  documents are the build id, so no reading is recorded. Pinned container e2e: 337 passed in 6.2 minutes, exit 0. The `/work` baseline matched and no snapshot was written.

## Suggested Review Order

**The pipeline pin follows `32a466a` (DW-17)**

- Entry point: the rule, now a pure verdict, with the `assets.setup` term gone.
  [`cs-tracker-adoption-probe.mjs:665`](../../ops/cs-tracker-adoption-probe.mjs#L665)

- `probe()` records the verdict from cs-tracker's three files.
  [`cs-tracker-adoption-probe.mjs:1708`](../../ops/cs-tracker-adoption-probe.mjs#L1708)

**The banner reads through colour codes (DW-109)**

- One stdlib strip before the version match, in each probe.
  [`cs-tracker-adoption-probe.mjs:991`](../../ops/cs-tracker-adoption-probe.mjs#L991)

- The same export in the sibling probe.
  [`daisyui-route-probe.mjs:294`](../../ops/daisyui-route-probe.mjs#L294)

- Call sites now hold the banner string rather than a match array.
  [`cs-tracker-adoption-probe.mjs:1102`](../../ops/cs-tracker-adoption-probe.mjs#L1102)
  [`daisyui-route-probe.mjs:761`](../../ops/daisyui-route-probe.mjs#L761)

**The observations that close the rows**

- The green adoption run, verbatim, and the four PASS lines that moved.
  [`cs-tracker-token-adoption.md:1009`](../../ops/cs-tracker-token-adoption.md#L1009)

- The green daisyUI run, and the +1 byte counts explained by `tokens.css`.
  [`daisyui-route.md:588`](../../ops/daisyui-route.md#L588)

- Rows 2, 3 and 5, closed as ruled.
  [`cs-tracker-token-adoption.md:1153`](../../ops/cs-tracker-token-adoption.md#L1153)

- Rows 3 and 7, and the mirror row.
  [`contract-adoption.md:798`](../../ops/contract-adoption.md#L798)
  [`cs-tracker-accessibility-pass.md:849`](../../ops/cs-tracker-accessibility-pass.md#L849)

- The Hub is final after Epic 4, and the user-agent binding.
  [`contract-serving.md:362`](../../ops/contract-serving.md#L362)
  [`contract-serving.md:542`](../../ops/contract-serving.md#L542)

**Planning amendments and closure**

- Stories 1.16, 1.19, 4.6 and 8.1, each carrying a dated amendment.
  [`epics.md:1744`](../planning-artifacts/epics.md#L1744)
  [`epics.md:1916`](../planning-artifacts/epics.md#L1916)
  [`epics.md:4326`](../planning-artifacts/epics.md#L4326)
  [`epics.md:4714`](../planning-artifacts/epics.md#L4714)

- Each parked action mapped to how it closed.
  [`spec-1-16-serve-contracts-at-https-cuatro-dev-contracts.md:494`](spec-1-16-serve-contracts-at-https-cuatro-dev-contracts.md#L494)
  [`spec-1-19-cs-tracker-adopts-the-token-contract.md:648`](spec-1-19-cs-tracker-adopts-the-token-contract.md#L648)

- DW-17 and DW-109 closing paragraphs.
  [`deferred-work.md:1347`](deferred-work.md#L1347)
  [`deferred-work.md:5882`](deferred-work.md#L5882)

- The board: epic-1, 1-16 and 1-19 done, and retro items 9 and 11.
  [`sprint-status.yaml:61`](sprint-status.yaml#L61)
  [`sprint-status.yaml:633`](sprint-status.yaml#L633)

**Peripherals**

- Red-first unit cases for the pin and the coloured banner.
  [`cs-tracker-adoption-probe.test.ts:759`](../../ops/__tests__/cs-tracker-adoption-probe.test.ts#L759)
  [`daisyui-route-probe.test.ts:501`](../../ops/__tests__/daisyui-route-probe.test.ts#L501)
