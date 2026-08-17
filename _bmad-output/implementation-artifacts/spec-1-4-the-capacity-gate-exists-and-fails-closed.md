---
title: 'The Capacity Gate exists and fails closed'
type: 'feature'
created: '2026-08-17'
status: 'done'
baseline_commit: '55133ecee7c115e2b46cdd2a3db16a618adfd359'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/routing-inventory.md'
  - '{project-root}/ops/estate.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** AD-9 requires a machine-readable Capacity Gate that refuses new placement until a threshold is measured. Nothing exists: `ops/capacity-gate.yml` is absent, and `deploy.yml` is one SSH step that names no application id, so placing an application on this two vCPU box is a judgement call with nothing to check it against. Stories 1-5 and 1-6 both write into a file that does not yet exist.

**Approach:** Create `ops/capacity-gate.yml` with `status: blocked` and no threshold, plus a dependency-free Node checker that `deploy.yml` runs as a blocking pre-flight step ahead of the SSH step. The fabricated-id failure is proven by a live run and kept permanently as a unit test rather than as a planted probe that gets deleted.

## Boundaries & Constraints

**Always:**
- The check fails closed. A missing file, an unreadable file, an unrecognised line, an unknown or duplicated key, or an unknown `status` value all exit non-zero. Absence of evidence is never read as permission.
- An id already in `placements` always passes, so NFR-2 is never traded against the gate (AD-9).
- The gate step is blocking: no `continue-on-error`, no warning form, no conditional skip (AD-21).
- `threshold` stays empty. A number written here today would be a guess dressed as a requirement (PRD section 15, FR-33's assumption).
- `cuatro.dev` deploys from `main` on every push and must keep doing so. The gate is inserted ahead of the SSH step and changes nothing about how the deploy itself runs (AD-20).
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, with no body and no trailer.
- Decided state is never written as observed state (NFR-9).

**Ask First:**
- Before adding any dependency, runtime or dev. The deploy path currently installs nothing and that is the reason the checker is dependency-free.
- Before editing the SSH step itself. Inserting steps ahead of it is in scope; changing what it runs is Story 1-9 and Epic 3.

**Never:**
- Never write a value into `measured_at`, `baseline`, `reading` or `threshold`. Story 1-5 measures and Story 1-6 opens the gate.
- Never set `status` to anything but `blocked` in this story.
- Never place the checker under `contracts/`, which admits no executable file (AD-1).
- Never touch `contracts/`, `content/projects.ts`, or any line of `sprint-status.yaml` other than this story's own.
- Never add a lint invocation to CI: there is no working lint command until a story lands a flat config.
- Never claim a rendered-output or browser check. Playwright arrives in Story 1-10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Incumbent deploys | `node ops/capacity-gate.mjs cuatro-portfolio` | Exit 0, one confirming line naming the id | N/A |
| New id refused | `node ops/capacity-gate.mjs list-wheel` | Exit 1, message names `ops/capacity-gate.yml`, the `blocked` status, and the ids that would pass | N/A |
| No id given | `node ops/capacity-gate.mjs` | Exit 1, usage line | Fail closed |
| Gate file missing | File deleted or renamed | Exit 1 naming the path it looked for | Fail closed |
| Unparseable line | Tab indentation, unknown key, duplicate key | Exit 1 naming the line number and the offending text | Fail closed |
| Open without a threshold | `status: open`, `threshold` empty | Exit 1: a gate cannot be open on an unmeasured box | Fail closed |
| Open with a threshold | `status: open`, `threshold` set (Story 1-6's state) | Exit 0 for any id | N/A |
| Unknown status | `status: unblocked` | Exit 1 naming the accepted values | Fail closed |

</frozen-after-approval>

## Code Map

Gathered 2026-08-17 against `55133ec`. Nothing in `ops/` is read by any process today, so this story creates the first ops file with a machine consumer.

- `ops/capacity-gate.yml`: new, the artifact AD-9 names. Exactly seven top-level keys. A leading comment carries what a key cannot: why Umami and Postgres are absent from `placements`.
- `ops/capacity-gate.mjs`: new, plain ESM, zero dependencies, so the deploy runner needs a checkout and node and nothing else. Exports the reader and the evaluator for the test, and runs the CLI only when invoked directly.
- `ops/__tests__/capacity-gate.test.ts`: new, matching the established layout (`app/api/health/__tests__/route.test.ts`). Covers every matrix row above, using fixture strings rather than the committed file where the case is a malformed one.
- `.github/workflows/deploy.yml:23-34`: the SSH step is the whole job today and **there is no checkout**. Gains `actions/checkout@v4`, `actions/setup-node@v4` pinned to 22 to match `ci.yml:19`, and the gate step, all ahead of the SSH step.
- `.github/workflows/ci.yml:25-29`: runs `pnpm typecheck` and `pnpm test --run`. The new tests are collected with no edit to this file.
- `vitest.config.ts:7-11`: jsdom, `globals: true`, no `include` filter, so `ops/__tests__` is picked up automatically.
- `tsconfig.json:34-41`: includes `**/*.ts`, `**/*.tsx` and `**/*.mts`, not `.mjs`. The checker is therefore not typechecked; its test is, and that is where the contract is asserted.
- **The four ids, with evidence.** `ops/routing-inventory.md:43-50` maps each live hostname to its container and `:139-144` lists the four compose projects on the box: `cuatro-portfolio`, `cs-tracker`, `cuatro-tracker`, `digital-library`. Umami and Postgres run there too and are infrastructure, not Estate applications (`ops/estate.md:83-99`). `www.cuatro.dev` is a 301 with nothing behind it.
- **The overflow value** is fixed by AD-9: managed hosting (Railway), two heavy applications, $15 to $30 per month, inside NFR-4's $40 to $100 ceiling.
- Read-only sources: `epics.md:1233-1269` (this story), `ARCHITECTURE-SPINE.md:130-134` (AD-9), `:202-206` (AD-21).

## Tasks & Acceptance

**Execution:**
- [x] `ops/capacity-gate.yml`: create it with exactly `measured_at`, `baseline`, `threshold`, `reading`, `status`, `overflow` and `placements`. `status: blocked`, the four measurement keys empty, `overflow` naming the decided path, `placements` listing the four ids on the box with the date each was observed running.
- [x] `ops/capacity-gate.mjs`: write the strict reader and the evaluator. The reader accepts only the shape this file has and throws on anything else. The evaluator returns a pass or a refusal, and the refusal text names the gate file and the status.
- [x] `ops/__tests__/capacity-gate.test.ts`: one test per matrix row. The fabricated-id case is the planted probe AD-21 asks for, kept as a test so a later reader can rerun it.
- [x] `.github/workflows/deploy.yml`: add checkout, node 22, and the blocking gate step naming `cuatro-portfolio`, all ahead of the SSH step. Comment why the gate runs before the deploy rather than after.

**Acceptance Criteria:**
- Given AD-9 fixes the gate's shape, when `ops/capacity-gate.yml` is created, then it carries exactly the seven keys, `status` reads `blocked`, `threshold` is empty, and `overflow` names the managed hosting path inside NFR-4's ceiling.
- Given AD-21 forbids an advisory gate, when `deploy.yml` is read, then the gate step sits ahead of the SSH step, carries no `continue-on-error` and no skip condition, and a failure of it stops the deploy.
- Given a reviewer needs to confirm the gate is real rather than decorative, when the checker is run against a fabricated id, then it exits non-zero, the message names `ops/capacity-gate.yml` and the `blocked` status, and that run's verbatim output is pasted into this spec's Spec Change Log.
- Given NFR-2 is never traded against the gate, when the Anchor deploys, then `cuatro-portfolio` passes because it is in `placements`, and no live hostname changes behaviour.

## Spec Change Log

### Execution findings, 2026-08-17

**1. The probe demonstration, run verbatim.** `node ops/capacity-gate.mjs list-wheel`, exit code 1:

```
capacity gate: REFUSED
  ops/capacity-gate.yml has status: blocked, and placements does not list "list-wheel".
  Unproven capacity fails closed (AD-9). Story 1-5 measures the box, Story 1-6 writes the
  threshold and opens the gate. Until then no new application id may be placed.
  Ids that pass today: cuatro-portfolio, cs-tracker, cuatro-tracker, digital-library
  If it has to ship before then, the decided overflow is managed hosting (Railway).
```

`node ops/capacity-gate.mjs cuatro-portfolio` exits 0 in the same session, so the refusal is the
gate discriminating rather than the checker being broken. The probe is kept as a test rather than
deleted, so a later reader can rerun it instead of trusting it.

**2. The module's own file read does not work under Vitest, and the tests are built around that.**
`import.meta.url` resolves to a vite URL rather than a `file:` one in the test runner, so
`readFileSync(new URL(...))` throws `The URL must be of scheme file`. It works correctly under
plain node, which is what `deploy.yml` runs, and that path is verified by the live runs above.
Every test that exercises `main` therefore injects a reader, and the committed gate file is read
from `process.cwd()`. Found by the test run, not by review.

**3. The checker is not typechecked, so its test carries the contract.** `tsconfig.json` includes
`.ts`, `.tsx` and `.mts`, not `.mjs`. The first typecheck failed with seven `Property does not
exist on type '{}'` errors, because TypeScript inferred the parser's return type from
`const gate = {}`. JSDoc `@typedef` annotations on the exported functions fix it without moving
the file to TypeScript, which would have cost the zero-install property the design rests on.

**4. `AGENTS.md` says the suite is 38 tests. It was 56 before this story.** The line is stale
rather than wrong about anything load-bearing, and that block is managed by
`bmad-project-context`, so it is left alone here rather than edited into an unrelated diff.

### Review findings, 2026-08-17

Three review layers ran against the diff. No finding reached the spec: the frozen I/O matrix
already specifies exit codes per row, so every gap was an implementation shortfall rather than a
spec one. Patches applied, all verified.

**5. The gate's binding to CI was asserted by nothing, and this repository has shipped that exact
defect before.** Every test asserted the `{ allowed, message }` object returned by `evaluate` and
`main`, while GitHub Actions can only see the process exit code. Under Vitest the direct-invocation
branch never runs, so inverting `process.exit(result.allowed ? 0 : 1)` left the suite green and the
gate approving everything it should refuse. Commit `cb22d36` retired an inverted health monitor for
the same reason. Closed with `spawnSync` cases that run the real binary against the real file and
assert exit status and stream. Both regressions are now demonstrated caught rather than argued
against: inverting the exit code fails 4 tests, forcing the direct-invocation guard false fails 3.

**6. The direct-invocation guard was fail-open in a fail-closed design.** A path comparison miss
(symlinked checkout, loader wrapper, case difference) made the module load, print nothing, and exit
0, which the workflow reads as a pass. Now compared through `realpathSync`, and pinned by the
mutation check above.

**7. The refusal message could be truncated exactly where it matters.** `process.exit` fired
immediately after `stream.write`, and on a pipe, which is what a CI runner supplies, the write can
still be in flight. A failing step with no explanation is close to useless, so the exit now happens
in the write callback.

**8. Two sources of truth for the gate's own path.** `GATE_PATH` was used in every message while
the read used a separate hardcoded filename literal, so a rename could have broken the Anchor's
deploy while CI stayed green and the refusal named a file the checker never opened. Both now derive
from one constant.

**9. The file's own comment claimed more than the reader delivered.** The header says the reader
"refuses anything it does not recognise", but nested keys were unvalidated: `overflow` accepted any
key at all, and every AD-9 field could be renamed with only one incidental assertion noticing. Now
validated against a known key set, with `path` and `provider` required because the refusal message
reads them. Writing a claim the code does not honour is the decided-as-observed failure NFR-9
forbids, in miniature.

**10. Smaller hardening, each with a test.** `key in obj` walked the prototype chain, so a key named
`constructor` was refused as a duplicate it was not. A byte order mark would have read as
indentation and blocked every deploy. `threshold: '  '` would have opened the gate. A non-`Error`
throw printed `undefined` as the reason, a non-string argv crashed instead of refusing, and every
throw from the checker was reported as a malformed gate file, sending the reader to fix a file that
was fine. `GateError` is now exported and only it is caught as a rejected gate.

**11. The AD-21 acceptance criterion was backed only by a human reading YAML.** Nothing pinned the
workflow's hardcoded id to `placements`, and a later `continue-on-error: true` would have landed
green. Three tests now read `deploy.yml` as data: the id it names must be in `placements`, the gate
must precede the SSH step, and no step may carry `continue-on-error` or `if:`. The first version of
that test failed on my own comment, which discusses `continue-on-error` by name, so the assertions
read the workflow's instructions with comment lines stripped.

**12. Six findings were real but not this story's to fix**, and are recorded in
`deferred-work.md`: the gate reaches only the Anchor's deploy and not the placements AD-9 exists to
gate, `status: open` has no threshold comparison for Story 1-6 to inherit, a red CI does not stop a
deploy, `placements` is self-serve with no `CODEOWNERS`, `deploy.yml` has no `concurrency` group,
and the capacity gate has no estate or AGENTS.md record.

## Design Notes

**Why a hand-written reader and not a YAML library.** Adding `yaml` would make the deploy step depend on `pnpm install --frozen-lockfile`, which is a minute of install and a full `node_modules` on the runner for one file read, in the one workflow that must not become fragile. The reader instead accepts exactly the shape this file has, one level of nesting at most, and throws on anything it does not recognise: an unknown key, a duplicate key, a tab, an unexpected indent. That is not a general parser and must not grow into one. Its failure mode is the correct one for this story, because every parse failure is a refusal.

**Why `placements` holds four application ids and not six hostnames.** The gate governs placement of applications, and `www` is a redirect while `analytics` is Umami, which is infrastructure the Estate record does not carry as an application. Listing hostnames would make the first genuinely new placement indistinguishable from an incumbent gaining a second hostname, which is exactly the distinction the story exists to draw.

**Why `status: open` with an empty `threshold` is rejected.** Nothing else stops a future editor from flipping one word and opening a gate on an unmeasured box. AD-9 ties the open state to a written threshold, so the checker enforces that pairing now rather than trusting Story 1-6 to arrive intact.

## Verification

**Commands:**
- `node ops/capacity-gate.mjs cuatro-portfolio`. Expected: exit 0.
- `node ops/capacity-gate.mjs list-wheel`. Expected: exit 1, and the message names the gate file and `blocked`. This is the probe demonstration and its output goes in the Spec Change Log.
- `node ops/capacity-gate.mjs`. Expected: exit 1, usage.
- `corepack pnpm test --run`. Expected: the 56 tests that existed before this story plus the new file, all passing. Observed: 102 across 15 files.
- `corepack pnpm typecheck`. Expected: pass. The test file is typechecked, the `.mjs` is not.
- Two mutation checks, each written into the checker, run, and reverted: invert the exit code mapping, and force the direct-invocation guard false so the process becomes a silent no-op. Expected: the suite fails both times. Observed: 4 and 3 failures respectively.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, checked against a positive control so it cannot pass vacuously.

**Manual checks:**
- Read `.github/workflows/deploy.yml` top to bottom and confirm step order, and that the SSH step's script is byte-identical to before.
- Confirm `ops/capacity-gate.yml` has no eighth top-level key and no threshold value.

## Suggested Review Order

**What makes the gate bind, and what would make it decorative**

- The whole gate reduces to this exit code. Everything else is advisory.
  [`capacity-gate.mjs:281`](../../ops/capacity-gate.mjs#L281)

- Blocking step, ahead of the SSH deploy. A gate after the fact is a record.
  [`deploy.yml:30`](../../.github/workflows/deploy.yml#L30)

- The refusal itself: names the file, the status, the passing ids, and the overflow.
  [`capacity-gate.mjs:198`](../../ops/capacity-gate.mjs#L198)

- Runs the real binary. Inverting the exit code above fails 4 of these.
  [`capacity-gate.test.ts:108`](../../ops/__tests__/capacity-gate.test.ts#L108)

**Failing closed, which is the property the story is named for**

- `status: blocked`, and a threshold left empty rather than guessed.
  [`capacity-gate.yml:27`](../../ops/capacity-gate.yml#L27)

- Open plus an empty threshold is refused, so one edited word cannot open the gate.
  [`capacity-gate.mjs:179`](../../ops/capacity-gate.mjs#L179)

- Only a rejected gate is reported as one. A checker defect escapes as itself.
  [`capacity-gate.mjs:231`](../../ops/capacity-gate.mjs#L231)

- Nested keys validated, so the file's claim about its reader is actually true.
  [`capacity-gate.mjs:73`](../../ops/capacity-gate.mjs#L73)

**The four incumbents, so continuity is never traded for the gate**

- Applications, not hostnames. Umami and Postgres are infrastructure.
  [`capacity-gate.yml:34`](../../ops/capacity-gate.yml#L34)

**Peripherals**

- The reader itself: strict by construction, and never to grow into a YAML parser.
  [`capacity-gate.mjs:92`](../../ops/capacity-gate.mjs#L92)

- The workflow read as data, since nothing executes it before `main`.
  [`capacity-gate.test.ts:141`](../../ops/__tests__/capacity-gate.test.ts#L141)

- What the reader tolerates: CRLF, a byte order mark, quoted values.
  [`capacity-gate.test.ts:251`](../../ops/__tests__/capacity-gate.test.ts#L251)
