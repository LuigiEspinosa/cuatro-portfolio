---
title: 'Story 9-10: commit the AD-22 sweep and font-pin check'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c88cb7d22ef3aebafa8d3893569ba0e6200b7d91'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AD-22 schedules the estate automation-policy sweep (`ops/contract-adoption.md` § The estate, observed) and the upstream font-pin check (`ops/font-contract.md` § The upstream pins), and both ran on 2026-09-25 and 2026-09-30 from scratchpad scripts that were never committed, so every refresh rebuilds its tooling from prose and risks counting differently (DW-243).

**Approach:** One committed module, `ops/ad22-refresh.mjs`, with two subcommands, `sweep` and `font-pins`, that make the calls the two records list through `gh api` and print a dated JSON report; a unit suite drives both through a planted `gh` and fetcher; both records name the command and the suite holds that they do.

## Boundaries & Constraints

**Always:** read only (GET through `gh api`, anonymous raw downloads); every expected status is named (200, 204, 403, 404), and any other answer, a truncated tree or a pinned download that no longer matches its sha256 is a defect, exit 2, never a quiet "none"; the estate list comes from `estateNames` over `ops/estate.md` and the configuration list from `AUTOMATION_CONFIGS`, never a second copy; the sweep's counting rule is condition 1's patterns over blobs, with `tsconfig.*` excluded, as the 2026-09-30 sweep did by reading. Each new assertion is planted.

**Never:** a CI job or workflow change (the scripts call the GitHub API with the Operator's token and run by hand), a verdict cell derived by the script (the "CI runs it" and "Real test suite" cells stay held by reading), a rewrite of the policy or pin tables, a fontTools subset of a newer binary (that is DW-240's), anything under `contracts/`, a new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sweep, clean repo | planted answers: repo 200, configs 404, protection 404, tree with tests, a `tsconfig.spec.json` | row with blob and test-shaped counts (tsconfig excluded), configs `[]`, bot PRs 0, protection 404 | N/A |
| Sweep, automation present | `renovate.json` 200, `package.json` with a `renovate` key, a `dependabot[bot]` PR | row names both configs and counts 1 bot PR | N/A |
| Sweep, auth broken | 401 on any call | exit 2 naming the endpoint | defect |
| Font pins, nothing moved | head file bytes equal the pin | exit 0, each pin `moved: false` | N/A |
| Font pins, upstream moved | head bytes differ | exit 1, that pin `moved: true` with its head sha256 | finding |
| Font pins, control broken | pinned url bytes differ from `sources.json` | exit 2 | defect |

</frozen-after-approval>

## Code Map

- `ops/contract-adoption.mjs`: reuse `estateNames`, `AUTOMATION_CONFIGS`, `PACKAGE_JSON_KEY`; unchanged.
- `ops/registry-verification.mjs:678-760`: the `beside`, `main` returning `{code, message}`, and `sameFile` direct-invocation guard pattern to copy.
- `packages/fonts/sources.json`: `families[].source` and `.licenceSource` carry `url` (raw.githubusercontent at a commit), `bytes`, `sha256`; two licence entries share one url.
- `ops/contract-adoption.md:251-312` § The estate, observed, and Pending Operator action 5 (`:955`): the call list the sweep reproduces; gets a paragraph naming the command.
- `ops/font-contract.md:452-475` § The upstream pins: the 2026-09-30 method (last commit touching the path, compare, releases, head sha256); gets a paragraph naming the command.
- `ops/__tests__/ops-record-titles.test.ts`: guards line 1 of each record; line 1 untouched.

## Tasks & Acceptance

**Execution:**
- [x] `ops/ad22-refresh.mjs`: `gh` seam (`spawnSync('gh', ['api','-i',endpoint])`, status line and JSON body), `isTestShaped`, `sweepRepository(name, gh)`, `fontPins(sources)`, `checkPin(pin, gh, fetchBytes)`, `main(argv, gh, fetchBytes)`.
- [x] `ops/__tests__/ad22-refresh.test.ts`: the matrix rows, plus both records naming their command.
- [x] `ops/contract-adoption.md`, `ops/font-contract.md`: a dated paragraph naming the command and the suite.

**Acceptance Criteria:**
- Given this host with `gh` logged in, when `node ops/ad22-refresh.mjs sweep` and `font-pins` run, then each prints a report over the ten repositories and the five pinned files, and the unchanged repositories reproduce their 2026-09-30 cells.
- Given the root suite, when `corepack pnpm test -- --run` runs, then the new file passes without a network.

## Implementation Notes

- Implemented directly in this session at `91e7813c7f232f6fb19e4a29937cc58dba5272d0`: this workflow sub-agent has no agent tool, so no implementation subagent could be launched.
- One module rather than two (`ops/ad22-refresh.mjs sweep|font-pins`): both checks share the `gh api -i` seam and the status rule, and the font check reads `packages/fonts/sources.json` from `ops/` as `registry-verification.mjs` reads its inputs, by `beside`. `packages/fonts` stays without a `package.json`.
- The sweep adds two calls the record's list implies but does not spell: `branches/<default>` for the head sha each row cites, and pages of pull requests past 100 (none reaches it today, largest 44).
- A `403` is accepted only with GitHub's "Upgrade to GitHub Pro" message (review row 1), so a rate limit or a missing scope on the protection, rules or rulesets endpoints exits 2 rather than reading as "not available".
- `font-pins` compares at the head sha, not the branch name, so the head download and `compare/<pin>...<head>` read the same commit.
- Live runs from this host as `LuigiEspinosa` (reports kept outside the repository, in the session scratchpad): `font-pins` 2026-10-18T22:22:32Z to 22:22:58Z, exit 0, control held for all five files, every pinned path's last commit still its pin, every head file identical. `sweep` 22:23:08Z to 22:26:25Z, exit 0, and again after the review patch 22:34:31Z to 22:37:08Z, exit 0, the private repositories' plan 403s accepted. Control against the 2026-09-30 table, repositories whose branch did not move: `covidmap` 39 blobs and 0 test-shaped, `future-vizion` 28 and 0, `MaiCoin` 1 test-shaped, `Mutuo` 7 and 0, `StreamVault` 1 and 0, `poketracker-go` 1 and 0, all equal. The Anchor reads 14 required checks, matching AGENTS.md's count since 2026-10-06. The policy table was not re-gathered (Never list); what moved is in the report for the Operator.

### Planted failures

Each assertion failed once on a single mutation of `ops/ad22-refresh.mjs` or a record, then was restored (the module from a scratch copy, compared with `cmp`; the records by Edit) and the file passed.

- P1 `parseResponse`: header split `/\r?\n\r?\n/` changed to `/\n\n/`: `× reads the status line and the JSON body of gh api -i`, `AssertionError: expected { status: 404, body: null } to deeply equal { status: 404, …(1) }`, `Tests 1 failed | 10 passed (11)`.
- P2 tsconfig exclusion removed: `× counts condition 1 patterns and excludes a tsconfig` (`AssertionError: expected true to be false`) and `× reports a clean repository without a verdict`, `Tests 2 failed | 9 passed (11)`.
- P3 `renovateKey` forced `false`: `AssertionError: expected [ 'renovate.json' ] to deeply equal [ 'renovate.json', …(1) ]`, `Tests 1 failed | 10 passed (11)`.
- P4 `BOTS = []`: `AssertionError: expected +0 to be 1`, `Tests 1 failed | 10 passed (11)`.
- P5 soft-fail regex replaced by `/never-matches/`: `× reports a clean repository without a verdict`, `Tests 1 failed | 10 passed (11)`.
- P6 status check disabled (`if (false)`): `× exits 2 naming the endpoint when a call answers an unexpected status`, `AssertionError: expected 'sweep: Cannot read properties of null…' to contain 'repos/LuigiEspinosa/demo/vulnerabilit…'`, `Tests 1 failed | 10 passed (11)`.
- P7 truncation guard disabled: `× refuses a truncated tree`, `AssertionError: expected [Function] to throw an error`, `Tests 1 failed | 10 passed (11)`.
- P8 `moved` forced `false`: `× exits 1 and names the new hash when upstream moved the file`, `AssertionError: expected +0 to be 1`, `Tests 1 failed | 10 passed (11)`.
- P9 control disabled: `× exits 2 when the pinned url no longer reproduces its recorded bytes`, `AssertionError: expected +0 to be 2`, `Tests 1 failed | 10 passed (11)`.
- P10 the command dropped from both records (`node ops/ad22-refresh.mjs` with no subcommand): `× contract-adoption.md names the sweep command`, `× font-contract.md names the font-pins command`, `AssertionError: expected '# Contract adoption, the automation p…' to contain '`node ops/ad22-refresh.mjs sweep`'`, 2 failed in the file.
- P11 (review row 1) `|| !planRefusal` removed: `× reads a plan 403 as not available, and any other 403 as a defect`, `AssertionError: expected [Function] to throw an error`, `Tests 1 failed | 11 passed (12)`; and the plan pattern replaced by `/never/`: the same case, `Error: repos/LuigiEspinosa/demo/branches/main/protection answered 403, expected 200 or 403 or 404`, `Tests 1 failed | 11 passed (12)`.

## Review Triage Log

Every layer ran inline in this session (no agent tool to launch reviewer subagents from a workflow sub-agent). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | edge-case | A `403` from a rate limit or a missing scope on protection, rules or rulesets would read as the plan's "not available" | medium | Real: `call` allowed 403 on those three endpoints by status alone. Patched: a 403 passes only with the "Upgrade to GitHub Pro" message; planted P11; live sweep re-run exit 0 |
| 2 | edge-case | A `package.json` over 1 MB comes back from the contents API with empty `content`, so `JSON.parse` throws | false as a defect | It exits 2 naming the error, never a wrong "no key"; no estate `package.json` is near that size |
| 3 | edge-case | An empty repository's tree answers 409 | false as a defect | Exit 2 naming the endpoint; every estate repository holds at least one blob (live run) |
| 4 | blind | `fetch` has no timeout | low, rejected | A hand-run check; a hang is visible to the person running it, and a timeout adds a parameter for a case not met |
| 5 | verification-gap | `latestRelease` with a 200 answer and `rules`/`rulesets` with 200 bodies are not asserted by a planted case | low, rejected | Field reads with no logic; both shapes were exercised by the live runs (`v1.8.1`; `protect-main`, 2 rules on `digital-library`) |
| 6 | verification-gap | The records' "first run" sentences rest on runs no test repeats | no defect | They are dated observations, reproduced twice in this session (two sweep runs, two font runs) |
| 7 | ponytail | `inputs` parameter on `main` exists only for tests | false as waste | It is the seam that keeps the suite off `ops/estate.md`'s real ten names and the network, the `registry-verification.mjs` pattern. "Lean already. Ship." |
| 8 | verification-loop | Hub build | n/a | No Hub source or build input changed. `corepack pnpm typecheck` exit 0; `corepack pnpm test -- --run` 85 files, 2009 passed, 4 skipped (2013); lint N/A (no lint command, see AGENTS.md); no secret in the diff |
| 9 | design | No `.scss` or `.tsx` outside tests changed and no motion keyword was added | n/a | No UI surface in this diff. Design review skipped. |

## Independent verifier

pending: no independent verifier has run on this story. A separate agent must run it and record its verdict here.

## Ledger closures

**DW-243:** **Closed 2026-10-18 by Story 9-10-commit-ad22-sweep-scripts** (`91e7813`, `ops/ad22-refresh.mjs`: `sweepRepository`, `checkPin`): the estate automation-policy sweep and the upstream font-pin check are committed as one module with two subcommands, `node ops/ad22-refresh.mjs sweep` and `node ops/ad22-refresh.mjs font-pins`, which `ops/contract-adoption.md` § The estate, observed (and its Pending Operator action 5) and `ops/font-contract.md` § The upstream pins now name. The sweep makes the record's calls over the ten names `ops/estate.md` gives and counts test-shaped blobs by condition 1's patterns with `tsconfig.*` excluded, the rule the 2026-09-30 sweep applied by reading; the font check holds each pinned url to its recorded sha256 as its control before weighing the file at the upstream head. Any unexpected status, a non-plan `403` or a truncated tree exits 2. `ops/__tests__/ad22-refresh.test.ts` drives both through a planted `gh` and downloader, every assertion planted, and holds both records naming their command. First run 2026-10-18: both exit 0, and the six repositories whose default branch had not moved reproduced their 2026-09-30 counts.

Action items: none named for this story.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `91e7813`):
- `corepack pnpm vitest run ops/__tests__/ad22-refresh.test.ts`: `Tests 12 passed (12)`.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test -- --run`: `Test Files 85 passed (85)`, `Tests 2009 passed | 4 skipped (2013)`; no WSL-bash flake this run.
- `node ops/ad22-refresh.mjs font-pins`: exit 0. `node ops/ad22-refresh.mjs sweep`: exit 0 (twice). `node ops/ad22-refresh.mjs`: usage, exit 2.
- No `apps/*` file changed, so no per-application suite was due.
