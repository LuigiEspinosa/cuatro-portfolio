---
title: 'Story 5-11: Demo and identity declarations verified against reality'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: '405f310286f27c9b391645e78bf3a8ba55b82a29'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/registry-verification.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** FR-27 (accuracy) and FR-24 (behaviour): the scheduled Registry verification (Story 2.23, AD-18) checks `source`, `live` and `token_contract`, and nothing holds an entry's `demo` or `identity` to what a Visitor meets. Today no application has a working demo account or a live OIDC sign-in, so today's values must stay, and the flips Epic 5 builds toward must wait on dated observations (NFR-9, AD-12, DW-322, DW-323).

**Approach:** Give every entry a `demo` row and an `identity` row in the same job, each a provider-neutral, anonymous check of the live hostname plus, for `demo-account` and `oidc`, the dated observation in its ops record. Correct `cs-tournament`'s `demo` to `open` on today's evidence (Registry 1.8.0, DW-332). Write, unapplied, the release the Operator's live steps unlock.

## Boundaries & Constraints

**Always:** the job passes on Registry 1.8.0 today; a test shows each check failing on a declaration that overstates; no new secret, request header, dependency or trigger path; the FR-28 valve stated and tested.

**Never:** flip a value on built code alone; rule DP8 or any Operator action; touch the box, a `.env.*` file, another repository's code; publish demo credentials (DW-335).

## I/O & Edge-Case Matrix

| Declared | Passes when | Fails when |
|---|---|---|
| `demo: open` | `live` answers 2xx at the first hop | no `live`, or 3xx/4xx/5xx |
| `demo: none` | `live` answers 3xx (a sign-in wall) | no `live`, a 2xx (usable anonymously: `open`), or no answer |
| `demo: not-deployed` | no `live` | a `live` is present |
| `demo: demo-account` | its record row (DR1 to DR3) is dated and the sign-in page reached from `live` by same-origin redirects carries `demo@cuatro.dev` | no `live`, no mapped row, undated row, the chain leaves the host, or the page lacks the address |
| `identity: oidc` | its row (H3, CT5) is dated; with `live`, `/auth/session` answers 401 and `/auth/sign-in` 3xx to an `https` authorization request (`response_type=code`, `code_challenge_method=S256`, `code_challenge`, `state`, `client_id`, `redirect_uri` = origin + `/auth/callback`) | any of those absent |
| `identity: none` | no `live`, or `/auth/session` does not answer 401 | it answers 401 (an OIDC session route is serving) |
| `identity: wallet` | the entry is `maicoin`, the recorded structural exemption | any other entry, or `maicoin` declaring otherwise |
| FR-28 valve | status off `Live`, `live` removed, `demo: not-deployed`; `oidc` stands on its dated row, not probed | `demo` left `open`, `none` or `demo-account` |

</frozen-after-approval>

## Code Map

- `ops/registry-verification.mjs`: `checkEntry` (reuse the `live` answer, `get`, `classify`, `answered`), `verify` input, `main` reads records beside the module. `contract-adoption.mjs` `section`/`table`.
- `ops/__tests__/registry-verification.test.ts`: `planted`, `routesForCommittedRegistry`, `one`, the 41-check and 44-request pins, the module's import and env pins.
- `ops/identity-issuer.md` H3 and CT5 rows, `ops/demo-principal.md` DR1 to DR3 rows (`| <id> | ... | <Completed> |`).
- `contracts/registry.json`, `ops/__tests__/registry-schema.test.ts` version pin; `ops/registry-schema.md` minor rule.
- Records to amend: `ops/registry-verification.md`, `ops/demo-principal.md` (DP8, § What Stories 5.9 to 5.11 build on), `ops/estate.md` if it states the tournament's `demo`; DW-322, DW-323, DW-332 amended, DW-335 added.

## Tasks & Acceptance

**Execution:**
- [x] `ops/registry-verification.mjs`: the `demo` and `identity` rows, the observation map, the exemption.
- [x] `ops/__tests__/registry-verification.test.ts`: the matrix, overstating fixtures, valve, committed counts.
- [x] `contracts/registry.json` 1.8.0, `ops/__tests__/registry-schema.test.ts` pin.
- [x] `ops/registry-verification.md`: what is checked, the valve, the prepared release, Pending Operator actions, an observed local run.
- [x] `deferred-work.md`, `ops/demo-principal.md`, `sprint-status.yaml`.

**Acceptance Criteria:**
- AC1: Given each row of the matrix, when the job verifies a fixture entry, then it passes or fails as the row says, by name.
- AC2: Given a fixture claiming `demo-account` or `oidc` with nothing behind it, then each fails, and each half (record, live) fails alone.
- AC3: Given the committed Registry and the estate as observed today, then every check passes, planted and in one real run on this host.
- AC4: Given `cs-tournament`, then its `demo` reads `open` in Registry 1.8.0 with its evidence recorded, and the schema gate passes.
- AC5: Given the observations H3, CT5, DP5 to DP7, DR1 to DR3, DS1 to DS3 and DW-335, then the record gives the release's per-entry changes, version, order and moved pins, unapplied.
- AC6: Root suite and typecheck pass; the Hub builds.
- AC7 (Operator-pending): the release applied after those observations, and the extended job read green on a runner.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool; Checkpoint 1 answered Approve, no open question remained. The spec was about 1360 tokens when written (5441 characters before § Verification, measured, at 4 per token): under 1600, so no Split or Keep question arose. The record holds the detail (`ops/registry-verification.md` § Demo and identity declarations, § The correction, § The release the live steps unlock, Stated limits, actions 8 to 11).
- First, in its own commit `405f310` (`fix(5-10)`), the Story 5.10 verifier's two minor findings: `tag_of` in `ops/demo-reset.sh` now takes the first line of `docker ps` (newest first) through a bash expansion, no new tool; a case holds two tracker containers and names the incoming tag (mutant `tail -n 1` restored: that case fails on `0ld0ut60`; reverted, 26 of 26 and `demo-principal` 9 of 9). `ops/demo-principal.md` § The scheduler items 1 and 8 and DS2 name compose's stderr progress lines.
- Decisions the record states: `demo` rows reuse the `live` answer (no second request); `open` is 2xx, `none` is 3xx, anything else is "cannot be verified"; `demo-account` needs its DR row dated and its own sign-in page (same-origin redirects, at most 5) naming `demo@cuatro.dev`, since FR-25 puts the credentials there; `oidc` needs H3 or CT5 dated plus `/auth/session` 401 and an Authorization Code + PKCE redirect to `<origin>/auth/callback`; `none` fails on a 401 there; `wallet` is `maicoin`'s exemption alone. The observation map and exemption are constants in the module (`OBSERVED_BY`, `WALLET_EXEMPT`); the two records are read every run and a missing or doubled row exits 2. FR-28: the valve change sets `demo` to `not-deployed` (the others fail without `live`), `identity` stays, `oidc` resting on its dated row unprobed.
- `cs-tournament` corrected to `open` in Registry 1.8.0 without waiting on DP8: observed 2026-10-03T17:09:55Z, `/`, `/bracket`, `/leaderboards` all 200 anonymously; the new check run on 1.7.0's value failed it as understated. DP8 still decides participation. DW-332 closed; DW-322 and DW-323 amended (owner now action 8); DW-335 (no sign-in page names the demo account; the check requires it) and DW-336 (no daily demo sign-in, action 11's ruling) filed.
- AC1, AC2: `ops/__tests__/registry-verification.test.ts` 80 cases. Ten mutants of the new code, each killed then reverted (file `cmp`-identical after): `none` accepting a 2xx, `oidc` ignoring its row, `none` ignoring 401, the off-host check dropped, `wallet` for any entry, `not-deployed` ignoring `live`, the session status ignored, PKCE ignored, `demo-account` ignoring its row, and ignoring its page.
- AC3: planted, 73 of 73 and 52 requests. Real, on this host: `node ops/registry-verification.mjs` with `REGISTRY_VERIFICATION_TOKEN` from `gh auth token` for the one command, printed nowhere, 2026-10-03T17:13:20Z: exit 0, `# 73 of 73 checks passed`.
- AC4: `ops/__tests__/registry-schema.test.ts` and `registry-verification.test.ts` pass on 1.8.0 (182 of 182 with the schema suite).
- AC6: `corepack pnpm typecheck` exit 0; `corepack pnpm --filter hub build` exit 0, `apps/hub/public/contracts/registry.json` reads 1.8.0. `corepack pnpm test --run` on the final tree: 80 files, 1972 tests, 1965 passed, 1 skipped, 1 todo, 5 failed, every failure a case in a WSL-bash suite (DW-135); each then passed alone: `demo-reset` 26, `deploy-remote` 28, `library-backup` 59, `postgres-backup` 20 and 1 skipped. An earlier full run was slowed to hours by a WSL bash this session had left hung from a mutation run; that process was stopped and the run above is the clean one.
- Not run: anything on the box, on a runner, or against a dated observation (none exists).

## Spec Change Log

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail and the ECC verification loop applied inline, not invoked as skills. Design review skipped: no `.scss`, `.tsx` or motion.

- low, patched: a 4xx or 5xx at `live` made `open` read "overstated", blaming the declaration for an outage the `live` row already names; now "cannot be verified" (a case holds it).
- low, patched: a case pinned all five observation rows undated, so the docs-only push that dates H3 would have failed CI; the case now pins the rows' presence only.
- low, rejected: `identity: none` fails between H2 and the identity release (the host answers 401 while `main` reads `none`). By design and recorded as the red window, with H2, H3 and release 1 in one sitting.
- low, rejected: the record's curl pre-check in release step 1 follows off-host redirects; the job itself is the authority and runs on the push.
- Ponytail: two constants, two small helpers per value, no config file and no new dependency or trigger path. Lean.

## Independent verification

No independent verifier has run yet.

## Verification

**Commands:**
- `corepack pnpm vitest run ops/__tests__/registry-verification.test.ts ops/__tests__/registry-schema.test.ts`: expected: all pass.
- `corepack pnpm typecheck`, `corepack pnpm test --run`, `corepack pnpm --filter hub build`: expected: exit 0.
