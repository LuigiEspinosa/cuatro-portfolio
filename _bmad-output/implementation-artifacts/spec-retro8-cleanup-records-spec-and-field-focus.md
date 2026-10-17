---
title: 'Epic 8 retrospective cleanup: items 54 (remainder), 56, 57, 58 and 59'
type: 'chore'
created: '2026-10-17'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-retro-2026-10-17.md', '{project-root}/ops/restyle-floor.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Epic 8 retrospective (`epic-8-retro-2026-10-17.md`) left five Cuatro-owned items open: the
`anchor-contract.test.ts` root pin still exempts every `apps/*` path (M1, item 54's remainder after R24); the board,
`ops/restyle-floor.md` and three DWs drift from the record (M3, M5, m11, item 56); `RESTYLE-SPEC.md` and `epics.md`
do not carry the 2026-10-17 rulings (m3, m4, m5, m10, item 57); `digital-library` and `list-wheel` keep a field's
focused ring square only by specificity or by a fixed list (m1, m2, item 58); and nothing checks an `ops/*.md` title
after two scripted edits broke one (M4, item 59).

**Approach:** Records and spec by the Edit tool; one root test each for items 54 and 59 inside the existing suite;
one branch per Satellite with an explicit I-11 rule and a test of the focused radius in a real browser.

**Acceptance Criteria:**
- Given the Anchor root pin, when a directory under `apps/` is neither `apps/hub` nor in `NON_HUB_APPLICATIONS`
  (finance, tracker, tournament, each with a reason), then `anchor-contract.test.ts` fails naming it; a stale entry
  fails too.
- Given AD-14, when read after R24, then it states that an application inside the Anchor reads `contracts/` directly.
- Given `ops/*.md`, when `ops/__tests__/ops-record-titles.test.ts` runs in the root suite (CI's `test` job), then
  line 1 of each is a single `# ` heading of at most 80 characters with no `|` and no `undefined`, each defect shown
  firing on a planted line; no CI job is added.
- Given `RESTYLE-SPEC.md`, when read, then it is `1.1.2` with a changelog line, carries I-12 to I-14 as ruled (R22),
  a Motion row consistent with DW-345, DW-349 and DW-354, and Q-1 (a control's ring radius) and Q-2 (a file input)
  as open rows for the Operator, undecided.
- Given `epics.md` Epic 8, when read, then dated amendments cover R2, R13, R14, R23 (and R20) and R24.
- Given the Epic 8 board block, `ops/restyle-floor.md` and AGENTS.md's description of it, when read, then no passage
  states as current what the record dates as done; DW-352 and DW-356 restate owner and trigger, DW-358 stays done.
- Given each Satellite branch, when a bare field with no rule of its own takes keyboard focus in Chrome, then its
  computed radius is `0px` while a control's ring stays `2px`; the test fails before the rule and passes after.

**Boundaries:** presentation only in the Satellites; no Registry release (item 55); no push, no PR, no box step.

</frozen-after-approval>

## Implementation Notes

**Anchor** (worktree `C:/CuatroEcosystem/cuatro-portfolio-wt-retro8-cleanup`, from `origin/dev` `9a4817c`):

- `apps/hub/app/__tests__/anchor-contract.test.ts`: `NON_HUB_APPLICATIONS` and `isNonHubApplication` beside
  `NOT_SHIPPED_ROOTS`; the root pin filters on it instead of `apps/*`, and first asserts every `apps/<dir>` is the Hub
  or named, no entry is stale, each reason is non-empty, and the predicate on planted paths (`apps/newcomer/...` false).
- `ARCHITECTURE-SPINE.md` AD-14: an "Amended 2026-10-17" bullet for R24 (the folder rule binds a Satellite; the
  tracker imports `contracts/tailwind.css`, the tournament the plain pair). Its old text was false for both.
- `ops/__tests__/ops-record-titles.test.ts`: new, in the root suite, which `ci.yml`'s `test` job runs.
- `RESTYLE-SPEC.md` 1.1.2: frontmatter `amended-2026-10-17c` (the file's changelog); I-12 in § 3, I-13 in § 5's dot
  row, I-14 in the Tabs row; the Motion row; Readings rows I-12 to I-14; § Open for the Operator with Q-1 and Q-2;
  § Recording a restyle's contract row names R24.
- `epics.md`: amendments after O-14's table (R2), on the AD-24 criterion (R24), after Story 8.4's F table (R13, R14),
  and in 8.5 (R20, R23) and 8.6 (R23).
- `ops/restyle-floor.md`: intro names 8.6 and a dated "Where it stands"; R2's decision and 8.2's heading marked
  ruled; § SM-12 per application, the vendored-version table, F-5's verdict and the two wave-2 records each get a
  dated outcome; new rows R26 and R27 (written as R25 and R26, renumbered on rebase by the verifier because the
  DW-347 and DW-351 story took R25 on `dev` first). `AGENTS.md`: its description of the file. `sprint-status.yaml`: the stale
  "BLOCKED" line and the amendment's comment. `deferred-work.md`: DW-352 and DW-356 restated (DW-358 was already
  closed by R24, `59f79ab`).

**Satellites** (each its own worktree and branch, not pushed):

- `digital-library` `C:/CuatroEcosystem/digital-library-workspace/wt-retro8-cleanup`, branch
  `fix/retro8-field-focus-radius`, `83c61f02516d842e4ab89a3de22b0b62c58b5d5d` on `dev` `9e4572d`: the I-11 rule in
  `apps/web/src/routes/layout.css`; `field-focus-radius.test.ts` loads the vendored `tokens.css` and the unlayered
  hand-fix rules into installed Chrome through `playwright-core` `1.62.1` (exact pin, no dependencies, downloads no
  browser; `ubuntu-latest` carries Chrome), tabs through bare fields and reads computed radius; DW-352's fix
  (`read` normalizes CRLF).
- `list-wheel` `C:/CuatroEcosystem/list-wheel-workspace/wt-retro8-cleanup`, branch `fix/retro8-field-focus-radius`,
  `a88a058ee647358f71fe72e358230f4f996fa499` on `main` `a1f1fce`: the I-11 rule widened from text and textarea to
  every field but the file input; `restyle.spec.ts` finds the enabled fields in both editor states and focuses bare
  fields with `focusVisible: true`, with a control at `2px` as the planted contrast.

**Real output:**

- `vitest run apps/hub/app/__tests__/anchor-contract.test.ts`: `Tests 18 passed (18)`. Planted (tournament entry
  renamed): `AssertionError: a directory under apps/ is neither the Hub nor in NON_HUB_APPLICATIONS`, then reverted.
- `vitest run ops/__tests__/ops-record-titles.test.ts`: `Tests 2 passed (2)`. Planted (`ops/routing-inventory.md`
  line 1 set to `# Routing inventoryundefined| x |`): `1 failed`, naming the file; restored.
- `corepack pnpm test --run`: `Test Files 2 failed | 79 passed (81)`, `Tests 2 failed | 1981 passed | 1 skipped
  (1984)`, the two failures `library-backup` and `postgres-backup`, WSL-bash suites (DW-135, `expected [] to have a
  length of 1 but got +0`). Re-run alone: `Test Files 2 passed (2)`, `Tests 79 passed | 1 skipped (80)`.
- `digital-library`: before the fix `field-focus-radius.test.ts` failed (`text: expected { visible: true, radius:
  '2px' } to deeply equal { visible: true, radius: '0px' }`) and `restyle-floor.test.ts` failed on this
  `core.autocrlf=true` worktree (`expected -1 to be greater than 1016`); after, `apps/web` `vitest run`: `Test Files
  21 passed (21)`, `Tests 383 passed (383)`; `typecheck`: `svelte-check found 0 errors and 0 warnings`; `vite build`
  exit 0, its CSS carries `input:not([type=file]):focus-visible,select:focus-visible,textarea:focus-visible{border-radius:var(--r-none)}`
  and the same 10 `box-shadow` occurrences as the base build. `apps/api` was not run: `better-sqlite3` and `canvas`
  native builds fail on this host, so the install used `--ignore-scripts`; the branch touches nothing in `apps/api`.
- `list-wheel` `npm test`: baseline `TOTAL: 149 SUCCESS`; new spec before the fix `TOTAL: 1 FAILED, 149 SUCCESS`
  (`<input type="search"> radius: Expected '2px' to be '0px'`, same for `select`); after `TOTAL: 150 SUCCESS`;
  `ng build` complete.

## Design Notes

**Scope.** Five items in one spec exceeds the SCOPE STANDARD's single goal and 1600 tokens. No Split or Keep answer
was relayed for this named spec; the workflow bundled the items under key `retro8-cleanup` and the Operator's relayed
message was "Yes, agree, continue.", which this run took as Keep. The verifier or the Operator may split it; the
Satellite halves are already separate branches.

**Why `playwright-core` in `digital-library`.** Its suite is jsdom, which computes no `border-radius` from a
stylesheet (probed: an empty string for every field), so a computed-style test needs a browser and the repository
has no driver. `playwright-core` driving installed Chrome is the smallest one: no transitive dependency and no
browser download. It is a new supply-chain entry for the Operator to accept or refuse at the PR.

**Not done here.** The retro's restructuring of `ops/restyle-floor.md` (folding the wave-2 tables, moving finished
rows to a log) was not asked by this task; the stale passages were dated instead. The file input stays unruled
(Q-2), so neither Satellite rule covers it. Board items 54, 56, 57, 58 and 59 are left `open` for the verifier: on a
pass, 54, 56, 57 and 59 to `done`; 58 to `in-progress` until R26 and R27 are dated.

## Verification

**Independent verifier, round 1 of 3, 2026-10-17: pass with minor findings.** Every diff read against its base
(Anchor `origin/dev` `9a4817c`, `digital-library` `origin/dev` `9e4572d`, `list-wheel` `origin/main` `a1f1fce`); each
commit is one Conventional subject with no body or trailer; no em-dash, en-dash, dash-standing double-dash or emoji in
any added line (byte grep over the three diffs).

- Root suite, `corepack pnpm test --run`: `Test Files 5 failed | 76 passed (81)`, `Tests 8 failed | 1975 passed | 1
  skipped (1984)`, all eight in the WSL-bash suites (DW-135). Re-run alone, one file each: `demo-reset` 30 passed,
  `library-backup` 59 passed, `postgres-backup` 20 passed and 1 skipped, `tournament-backup` 15 passed,
  `tracker-backup` 11 passed. `corepack pnpm typecheck` exit 0. `anchor-contract`, `ops-record-titles`,
  `contract-purity` and `registry-schema` together: 183 passed.
- Planted: an intent-to-add `apps/newcomer/x.ts` fails `anchor-contract.test.ts` with `a directory under apps/ is
  neither the Hub nor in NON_HUB_APPLICATIONS` (1 failed, 17 passed); removed, it passes. Line 1 of all 40 `ops/*.md`
  is a `# ` heading.
- `digital-library` `apps/web`: `vitest run` 21 files, 383 passed; `svelte-check` 0 errors; `vite build` done, its CSS
  carries `input:not([type=file]):focus-visible,select:focus-visible,textarea:focus-visible{border-radius:var(--r-none)}`.
  With `layout.css` reset to `dev`, `field-focus-radius.test.ts` fails (`text: expected { visible: true, radius:
  '2px' } to deeply equal { visible: true, radius: '0px' }`); restored. `apps/api` not run (native modules, untouched).
- `list-wheel`: `npm test` `TOTAL: 150 SUCCESS`; `node --test ops/deploy-remote.test.mjs` 27 passed; `ng build` done.
- Pushed both branches and opened `digital-library` PR #70 (to `dev`) and `list-wheel` PR #6 (to `main`), merged by
  neither; `ops/restyle-floor.md` R26 and R27 name them, and R28 records the Operator's ruling on Q-1 and Q-2.

Rebase onto `dev` `64b0e47` (the DW-347 and DW-351 story, which took row R25 first): the builder's commits are now
`b3338fb` (`0908471`), `303d4ab` (`866d610`) and `e947283` (`13e12ac`), whose subject still says "r25 and r26" for
the rows now numbered R26 and R27. A first push went out mid-rebase and carried `b3338fb` and `303d4ab` alone; the
records followed in the next push, never forced.

Minor findings, none blocking: (1) `input:not([type='file'])` in both Satellites also squares an input that is a
control (`submit`, `button`, `range`, `color`); neither floor renders one, and S-3 already squares a control's box,
so it is noted for Q-1's ruling rather than fixed. (2) The bundle of five items is kept as built (the builder's Keep
reading); the Satellite halves are separate PRs. (3) Board item 57 is `in-progress`, not `done` as the builder
proposed, because its "settle" half is the Operator's R28.

