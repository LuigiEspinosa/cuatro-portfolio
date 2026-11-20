---
title: 'Story 9-18: fix the tournament tsc errors and remove its inert files'
type: 'chore'
created: '2026-10-18'
status: 'in-review'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '563ea93168ce147e44b2f89dc47597d51aa5b9cc'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `tsc -p tsconfig.json` over `apps/tournament` reports 21 errors, all in nine `lib/**/*.test.ts` files, so the workspace's `typecheck` runs through `tsconfig.typecheck.json`, which excludes every test (DW-282). The workspace also carries delivery files from its source repository that nothing here runs: `docs/`, `vercel.json`, `eslint.config.mjs`, the throwaway `worker/cmd/qa54` harness, and READMEs describing a kickoff phase and a Railway host (DW-283).

**Approach:** Fix the nine test files' stale fixture shapes and mock typings without changing what any test asserts, delete `tsconfig.typecheck.json` and point `typecheck` at `tsconfig.json`, delete the four inert paths, and replace the READMEs' stale source-repository sections with a note on where the application and its worker now run.

</frozen-after-approval>

## Implementation Notes

- Implemented directly in this session at `3268f02f2d23477eb333c75811886cbe71bfb205`: this workflow sub-agent has no agent tool, so no implementation or reviewer subagent could be launched. Epic 9 has no `epic-9-context.md`; the plan and the triage are the context, as in 9-4 and 9-6.
- The 21 errors and their fixes, each type-level or a stale fixture, none changing a test's verdict on the code it covers:
  - `admin/route-coverage.test.ts`: `e.parentPath ?? e.path` to `e.parentPath`. `Dirent.path` left `@types/node` 24; `parentPath` exists on every Node this runs on (CI and the image are Node 24, engines `>=20.9`, `parentPath` since 20.12, and the suite never ran on older).
  - `auth/session.test.ts`, `ceremony/verification.test.ts`: the `createUser` and `select` mocks take a typed parameter, so `mock.calls[0][0]` is not an index into an empty tuple.
  - `awards/catalog.test.ts`: the caller-supplied `SeedAward` fixture lacked `secondaryStat`, `effNumKey`, `effDenKey` (added by Story 6.5), and the expected payload passed only because `toEqual` ignores `undefined` keys. Both now carry the three fields, so the case asserts the full projection.
  - `ceremony/reveal-model.test.ts`: seven calls passed `revealedSpins` and `totalSpins`, fields `RevealModelInput` no longer has and `buildRevealView` ignored; removed, `complete: true` kept.
  - `roulette/end-to-end.test.ts`, `roulette/stage1.test.ts`: `p.h2h!` and `c.shelf!` on optional vector fields. Runtime is unchanged: an absent field still throws in `Object.keys`.
  - `roulette/ladder.test.ts`: `efficiency?.[numKey]`, and a string-shaped pair returns `false` from the claim check. On the named row that fails `claim` loudly, as the throw from `BigInt(undefined)` did; on any other row it no longer crashes the uniqueness filter.
  - `roulette/prng.test.ts`: `fromHex` returns `Uint8Array<ArrayBuffer>`, which Web Crypto's `BufferSource` accepts.
- `tsconfig.typecheck.json` is deleted and `typecheck` is `tsc --noEmit -p tsconfig.json`, the same file `next build` reads, so CI's `Tournament type check` step now covers the tests. `ci.yml` is unchanged.
- Deleted: `docs/` (an environment inventory template naming Vercel and Railway, plus `.gitkeep`), `vercel.json`, `eslint.config.mjs`, `worker/cmd/qa54/main.go` (its own header calls it a throwaway harness "deleted after sign-off"). Nothing imports, builds or pins any of them (searched across the tree, the workflows, `turbo.json` and every test).
- Kept, justified:
  - `eslint` and `eslint-config-next` in `apps/tournament/package.json` devDependencies. `pnpm --filter tournament remove` was tried: it rewrote peer-resolution keys for the other workspaces' ESLint packages in `pnpm-lock.yaml` (51 lines out, 24 in, including a `@typescript-eslint/parser` 8.57.2 to 8.57.1 shift under another importer), which reaches the tracker and finance images. Reverted; the two packages are inert without a config and stay for a lockfile story to drop (returned to the Operator).
  - `.gitignore`'s `docs/ops/*.local.md` and `.vercel/` lines: the first still keeps a local inventory with real refs out of git if one exists in a checkout.
  - The comment in `worker/ingest/parse.go:877` that names "THE BAR (qa54)": a dated history reference, not a pointer anyone follows.
- READMEs: `apps/tournament/README.md` keeps its Anchor note and the vision, and drops the "Kickoff / planning phase" status, the Vercel and Railway stack table and the links into the deleted `_bmad-output/` tree. `worker/README.md` gains a note that the worker never reached Railway, is imaged as `tournament-worker` and placed with no public hostname (DW-287); its body is left as the source repository wrote it.

### Planted failures

- P1, `catalog.test.ts` (the fixture's new fields): `toCuratePayload` changed to `secondary_stat: a.decidingStat`: `× maps every award, argument by argument, into the RPC snake_case shape`, `× projects a caller-supplied catalog too (the seam the tests and the route share)`, `-     "secondary_stat": "adr",` / `+     "secondary_stat": "kills",`, `Tests  2 failed | 39 passed (41)`. Restored with `git checkout`, `Tests  41 passed (41)`.
- P2, same case: `eff_den_key: a.effNumKey`: the same two cases, `-     "eff_den_key": "deaths",` / `+     "eff_den_key": "kills",`, `Tests  2 failed | 39 passed (41)`. Restored.
- P3, `typecheck` now reaches test files: a scratch `lib/planted-9-18.test.ts` holding `const planted: number = 'not a number'`: `corepack pnpm --filter tournament typecheck` printed `lib/planted-9-18.test.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.`, exit 2. Under the deleted `tsconfig.typecheck.json` that file was excluded. Removed.

No other assertion was added: the remaining edits are typings, and the seven `reveal-model` calls lost two fields the function never read.

## Review Triage Log

Every layer ran inline in this session (no agent tool). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | edge-case | `ladder.test.ts` now returns `false` on a string pair instead of throwing | false as a defect | `claim` (`ladder.test.ts:991`) requires the named row's check to be `true`, so a malformed named row still fails; other rows were never meant to match |
| 2 | edge-case | `parentPath` is undefined on Node below 20.12 | false | CI `node-version: 24`, image `node:24-slim`, workstation 24.15.0 |
| 3 | blind | The eslint devDependencies are now orphaned | low, kept | Removing them churns other workspaces' lockfile entries (Implementation Notes); returned to the Operator |
| 4 | blind | `parse.go:877` still names `qa54` | low, kept | Dated history, not a pointer (Implementation Notes) |
| 5 | verification-gap | Does `next build` still pass now that `tsconfig.json` is clean? | no defect | `tsconfig.json` and `next.config.ts` are unchanged and the image builds through them; a stricter clean file cannot add a build error. Image (tournament) on the pushed sha confirms |
| 6 | ponytail | Diff is deletions plus type-only test edits | Lean already. Ship. | net: -571 lines |
| 7 | verification-loop | Hub build | n/a | No Hub source or build input changed. Root `corepack pnpm typecheck` exit 0; root suite and per-app suites in Verification; lint N/A (no lint command, see AGENTS.md); no secret in the diff |
| 8 | design | No `.scss` or non-test `.tsx` changed and no motion keyword added | n/a | No UI surface in this diff. Design review skipped. |

## Independent verifier

Independent verifier: PASS on round 1, 2026-10-18, separate agent; tests: all runs in the story worktree at `02294a7` (before the rebase onto `928e32e`, which touched nothing under `apps/tournament`).
- Baseline check: the nine test files put back to their `origin/dev` versions, `npx tsc --noEmit -p tsconfig.json` in `apps/tournament` reported 21 `error TS`, matching the builder's claim. Restored from HEAD and re-run: exit 0, no errors.
- `corepack pnpm --filter tournament typecheck` (now `tsc --noEmit -p tsconfig.json`): exit 0.
- `corepack pnpm typecheck` (root): exit 0.
- `corepack pnpm --filter tournament test`: 58 of 58 files passed, 1988 of 1988 tests passed.
- `go vet ./...` and `go test -count=1 ./...` in `apps/tournament/worker`: vet clean, all 7 packages ok (uncached run).
- `corepack pnpm test -- --run` (full root suite): 4 of 86 files failed, 82 passed; tests 2026 passed, 4 failed, 4 skipped. The four failing files are all WSL-bash suites (`demo-reset`, `library-backup`, `postgres-backup`, `tournament-backup`), the known DW-135 flake. Re-run alone: 4 of 4 files passed, 131 tests passed, 1 skipped.
- The verifier's own planted failure: in `lib/awards/catalog.ts` line 451, `eff_num_key` changed to read `a.effDenKey`. `catalog.test.ts` went to 2 failed and 39 passed, one of them the caller-supplied case whose fixture this story completed. Restored with `git checkout`: 41 of 41 passed, worktree clean.
- No container e2e run: no Hub rendered output and nothing under `tests/e2e` changed.

The verifier raised for the Operator: whether a lockfile story should drop the `eslint` and `eslint-config-next` devDependencies, and a check that Image (tournament) is green on the pushed sha, since CI's `Tournament type check` now covers test files.

## Ledger closures

**DW-282:** **Closed 2026-10-18 by Story 9-18-tournament-inert-files-and-tsc** (`3268f02`, `apps/tournament/package.json`: `typecheck`): `tsc --noEmit -p tsconfig.json` over `apps/tournament` is clean. The 21 errors in nine `lib/**/*.test.ts` files were stale fixture shapes and mock typings, fixed without changing any test's verdict: the caller-supplied `SeedAward` fixture in `awards/catalog.test.ts` now carries the three FR-29 rung keys and asserts their projection, `revealedSpins` and `totalSpins` are gone from `reveal-model.test.ts`, `Dirent.path` became `parentPath`, the Supabase mocks take typed parameters, and `fromHex` returns a `Uint8Array<ArrayBuffer>`. `tsconfig.typecheck.json` is deleted and `typecheck` reads `tsconfig.json`, so CI's `Tournament type check` covers the tests; a planted type error in a test file fails it (exit 2).

**DW-283:** **Closed 2026-10-18 by Story 9-18-tournament-inert-files-and-tsc** (`01f9c98`, `apps/tournament`): `docs/`, `vercel.json`, `eslint.config.mjs` and `worker/cmd/qa54` are deleted; nothing built, imported or pinned them. The README drops the source repository's kickoff status, hosting table and links into its `_bmad-output/` tree (the BMAD trees went at `8440372`), and the worker README notes that the worker never reached Railway and is placed beside the tournament with no public hostname. The `eslint` and `eslint-config-next` devDependencies stay: dropping them rewrites other workspaces' lockfile entries, which is a lockfile change outside this story.

Action items: none named for this story.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `3268f02`):
- `npx tsc --noEmit -p tsconfig.json` in `apps/tournament`: 21 `error TS` lines at the baseline, 0 after.
- `corepack pnpm --filter tournament typecheck`: exit 0.
- `corepack pnpm --filter tournament test`: `Test Files  58 passed (58)`, `Tests  1988 passed (1988)`.
- `go vet ./... && go test ./...` in `apps/tournament/worker`: vet clean; `worker`, `awards`, `ceremony`, `config`, `db`, `ingest`, `store` all `ok`.
- `corepack pnpm typecheck` (root): exit 0.
- `corepack pnpm test -- --run` (root): `Test Files  2 failed | 84 passed (86)`, `Tests  2 failed | 2028 passed | 4 skipped (2034)`, the two failures in the WSL-bash suites `library-backup` and `tournament-backup` (DW-135). Re-run alone: `Test Files  2 passed (2)`, `Tests  81 passed (81)`.
