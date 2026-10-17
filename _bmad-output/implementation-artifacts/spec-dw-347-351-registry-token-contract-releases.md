---
title: 'DW-347 and DW-351: adoption observations, then Registry 1.11.0 token_contract releases'
type: 'chore'
created: '2026-10-17'
status: 'in-review'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/ops/contract-adoption.md', '{project-root}/ops/registry-verification.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `list-wheel` (Story 8.3, R6) and `digital-library` (Story 8.2, R9) vendor Contract 2.0.0 on their `main`
and serve it live, but `ops/contract-adoption.md` still reads `not adopted` for both and the Registry declares no
`token_contract` for either, so the scheduled verification cannot see the adoptions (epic 8 retro M5, item 55).

**Approach:** First commit: a dated observation of each adoption, read off each repository's `main` through `gh api`
and off the live stylesheet, in the adopted-versions table. Second commit: Registry 1.11.0 (a value change, so a minor
by `ops/registry-schema.md`) giving both entries `token_contract: "2.0.0"`, every pin moved, DW-347 and DW-351 closed,
and the promotion to `main` recorded as a dated Pending row.

</frozen-after-approval>

## Acceptance Criteria

- Given each Satellite's `main`, when `cuatro-contracts/tokens.css` is read through `gh api` at the fixed path, then
  line 2 reads `Contract v2.0.0` and the dated row in `ops/contract-adoption.md` names that path, version and commit.
- Given the observation commit, when the Registry release commit follows it, then `contracts/registry.json` reads
  `contract_version` `1.11.0` and both entries `token_contract` `2.0.0`.
- Given the release, when `node ops/registry-schema.mjs`, the Registry suites and the full root suite run, then all pass.
- Given the release, when `node ops/registry-verification.mjs` runs with a token, then it reads 75 of 75, both new rows
  passing on `Contract v2.0.0`.
- Given the release is on `dev` only, then `ops/restyle-floor.md` R25 records the Operator's promotion with the
  post-deploy check of `https://cuatro.dev/contracts/registry.json`.

## Implementation Notes

**Observation commit** (`93869b4`, `docs(dw-347-351): observe list-wheel and digital-library adopting contract 2.0.0 on main`):

- Read 2026-10-17T12:59:03Z: `list-wheel` `main` `a1f1fce657b9a3379b80f8f5c830c428565078d6`, `digital-library` `main`
  `1ca5091d4d614a8608c7a8147ae7583dfd9d4f22`; each `tokens.css` line 2 `Contract v2.0.0`; each folder's nine blob
  hashes equal the Anchor's nine `contracts/` token-contract paths (verbatim). Consumption: `angular.json` `styles`
  (`list-wheel`), `apps/web/src/routes/layout.css` `@import`s (`digital-library`).
- Live 12:59:25Z: both stylesheets carry `--token-bg`, `--c-paper: oklch(12% .011 288)` and 2.0.0's `--ease-exit`
  `cubic-bezier(.33, 1, .68, 1)`; the minifier strips the header comment, so the live half is by value, not header.
- `ops/contract-adoption.md`: both adopted-versions rows replaced, earlier value kept in the Nature cell; a dated
  paragraph records that neither adoption is a propagation event (a first adoption, as `3f37cce`), count stays 1.
- `ops/__tests__/registry-verification.test.ts`: the real-records `vendoredTarget` case pinned "every other entry to no
  target", so it moves in this commit to resolve the four recorded adopters.

**Release commit:** `contracts/registry.json` to 1.11.0 with the two fields; `ops/__tests__/registry-schema.test.ts`
version pin; `ops/__tests__/registry-verification.test.ts` committed-Registry case plants the two contents routes and
moves 73 to 75 checks, 54 to 56 requests, 4 to 6 contents calls, 1 to 3 `token_contract` rows;
`ops/registry-verification.md` expected-count amendment; `ops/restyle-floor.md` summary cells and R25; DW-347 and
DW-351 closed in `deferred-work.md`. `ops/registry-schema.md`'s version history row stops at 1.7.0 and 1.8.0 to 1.10.0
did not extend it either, so it was left. The board item (`epic-8-retro-item-55`) is left `open` for the verifier.

**Test output (real):**

```
node ops/registry-schema.mjs
registry schema: read contracts/registry.json against contracts/registry.schema.json, 16 applications, valid, ... (AD-4, AD-5).
exit 0

REGISTRY_VERIFICATION_TOKEN from gh auth token (printed nowhere), node ops/registry-verification.mjs, 2026-10-17T13:06:46Z
PASS  cs-tracker token_contract: the Registry declares 2.0.0 and LuigiEspinosa/cs-tracker:assets/css/cuatro-contracts/tokens.css@main reads Contract v2.0.0
PASS  digital-library token_contract: the Registry declares 2.0.0 and LuigiEspinosa/digital-library:apps/web/src/lib/cuatro-contracts/tokens.css@main reads Contract v2.0.0
PASS  list-wheel token_contract: the Registry declares 2.0.0 and LuigiEspinosa/list-wheel:src/styles/cuatro-contracts/tokens.css@main reads Contract v2.0.0
# 75 of 75 checks passed
exit 0

corepack pnpm vitest run (registry-verification, registry-schema, contract-adoption, apps/hub registry)
 Test Files  4 passed (4)
      Tests  290 passed (290)

corepack pnpm test --run
 Test Files  7 failed | 73 passed (80)
      Tests  22 failed | 1959 passed | 1 skipped (1982)
```

The 22 failures were all in the seven WSL-bash suites (DW-135), each at about 30 s. Re-run alone, one file at a time:
demo-reset 30 passed, deploy-remote 28, library-backup 59, postgres-backup 20 passed and 1 skipped, postgres-init 17,
tournament-backup 15, tracker-backup 11. `corepack pnpm typecheck` exit 0.

**Review:** no independent reviewer subagent ran inside this build. The workflow's independent verifier reviews it next.

## Verification

