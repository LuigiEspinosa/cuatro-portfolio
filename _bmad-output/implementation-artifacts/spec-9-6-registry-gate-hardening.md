---
title: 'Story 9-6: refuse duplicate keys in the Registry, and move registry-verification.yml to Node 24'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `ops/registry-schema.mjs` parses both contract files with `JSON.parse`, which silently keeps the last of
two equal keys, so a Registry entry carrying `status` twice validates the surviving value while the editor flags the
duplicate (DW-28); `ops/registry-schema.md` has no stated-limit row for it. `registry-verification.yml` is the last
workflow on Node 22, held there by `STILL_ON_NODE_22` in `ops/__tests__/workflow-hardening.test.ts` (DW-251).

**Approach:** Per `epic-9-plan-2026-10-18.md` row 6: a scanner run after a successful parse refuses any object that
carries one key twice, in either file, naming the file, the pointer and the line; the record gains a stated-limit
row for what the refusal still does not cover. `registry-verification.yml` moves to `node-version: 24`, its pin in
`registry-verification.test.ts` follows, its record's Runner row is amended, and the `STILL_ON_NODE_22` exception is
deleted so every workflow is held to Node 24.

</frozen-after-approval>

## Implementation Notes

- Context: Epic 9 has no `epics.md` entry or `epic-9-context.md`; as in 9-1 and 9-2, the plan and the triage are the
  context. Route `oneshot`: no intent gap, nothing irreversible, seven files. The plan bundles the two ledger halves
  as one story, and the no-new-deferred-work ruling forbids a split, so both are kept.
- `ops/registry-schema.mjs` `duplicateKey(text)`: a structural scanner run inside `inspect()`'s `parse` after
  `JSON.parse` accepts the text (BOM already stripped), so it tracks frames and never validates. Keys are compared
  decoded with `JSON.parse` of the raw token. A hit makes `parse` return an error with `duplicate: true`; the
  `unparsed` stage carries that flag (typedef widened) and `report()` prints `<file> carries a duplicate key:
  <pointer> carries the key "<k>" twice (line n).` plus three lines of cause, instead of "is not JSON". Both files
  are scanned; the schema's pointer reads `(the schema root)` through the existing `inSchema`. Reused
  `escapeToken`, `where`, `inSchema`, `q`; no dependency added; `contracts/` untouched.
- Not a fifth rule beyond the schema, and the green line is unchanged: those rules run on the parsed instance, and a
  duplicate never reaches that stage. Recorded in `ops/registry-schema.md`.
- `ops/registry-schema.md`: a Decision paragraph after the byte order mark one, a stated-limit row ("A duplicate key
  is refused by this gate and by no other reader"), and the case counts (102 to 107, the refusal block 50 to 55).
- DW-251: `registry-verification.yml` `node-version: 24`; `registry-verification.test.ts` pin and title follow;
  `workflow-hardening.test.ts` loses `STILL_ON_NODE_22` and its branch, so every workflow is held to `STACK_NODE`;
  `ops/registry-verification.md` Runner row amended 2026-10-18. `node ops/registry-verification.mjs` on this host's
  Node v24.15.0, token from `gh auth token` for the one run and printed nowhere: exit 0, `# 75 of 75 checks passed`.
- Sprint-status sync skipped: the orchestrator's push step owns `sprint-status.yaml`.

### Planted failures

Each new assertion was broken once on purpose with the module edited in place, the file re-run, and the module
restored from a copy (107 passed after).

| Assertion | Plant | Failure observed |
|---|---|---|
| duplicated `status`: `ok` false | `const twice = null;` (scanner off) | `AssertionError: a duplicated key validated: JSON.parse kept the last and the gate never saw the first: expected true to be false` |
| duplicated `status`: exact message | `else top.index += 0;` (array index never advances); `duplicate: true` set false; line `+ 1`; key upper-cased | `AssertionError: expected 'registry schema: REFUSED\n  AD-4: con...' to contain 'contracts/registry.json carries a dup...'` (each of the four plants) |
| duplicated `required` in the schema: `ok` false | scanner off | `AssertionError: expected true to be false // Object.is equality` |
| duplicated `required`: exact message | `where(twice.pointer)` for both files; duplicate reported as syntax; line `+ 1` | `AssertionError: expected 'registry schema: REFUSED\n  AD-4: con...' to contain 'contracts/registry.schema.json carrie...'` |
| key holding a newline, escaped once | report re-applies `printable(file.error)`; scanner off | `AssertionError: expected 'registry schema: REFUSED\n  AD-4: con...' to contain 'carries the key "a\nb" twice'` |
| two spellings of `$schema`: `ok` false | `const key = text.slice(i + 1, end);` (raw compare); scanner off | `AssertionError: expected true to be false // Object.is equality` |
| two spellings: message | key upper-cased | `AssertionError: expected 'registry schema: REFUSED\n  AD-4: con...' to contain 'carries the key "$schema" twice'` |
| positive control: `ok` true | `if (top?.keys) {` (every string read as a key) | `x and accepts one key name used once in each of two objects, or as a value beside itself` (12 cases in the file failed under this plant) |
| `registry-verification.yml` held to 24 (workflow-hardening, `STILL_ON_NODE_22` gone) | workflow put back to `node-version: 22` | `AssertionError: registry-verification.yml pins a Node other than the stack's 24: expected [ '22' ] to deeply equal []` |
| `registry-verification.test.ts` pin | same | `AssertionError: expected '  registry-verification:\n    runs-on...' to match /^\s+node-version: 24$/m` |

### Tests run

- `corepack pnpm vitest --run ops/__tests__/registry-schema.test.ts`: 107 passed (102 at base).
- `corepack pnpm vitest --run ops/__tests__/workflow-hardening.test.ts ops/__tests__/registry-verification.test.ts`:
  128 passed.
- `corepack pnpm test --run`: 82 files, 1985 passed, 1 skipped, 6 failed, all six in WSL-spawning suites
  (`demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`) at about 30 s each with empty output, DW-135's
  shape. Re-run of those four files: 137 passed, 1 skipped, 0 failed.
- `corepack pnpm typecheck`: exit 0. `node ops/registry-schema.mjs`: green, 16 applications.
- No `apps/*` change, so no per-app suite.

## Review Triage Log

- Blind Hunter: not run. This sub-agent has no tool to launch a context-free reviewer, so the layer fell to an inline
  self-review of the diff, which is not independent.
- medium, patched: the duplicate-key refusal re-applied `printable()` to an error already escaped piece by piece, so
  a key holding an escape printed with its backslash doubled. Fixed; guarded by the newline case, planted.
- low, patched: a duplicate in the schema named its pointer `(the document root)`, the Registry's wording, where the
  module says `(the schema root)` for the schema. Fixed through `inSchema`; the schema case pins it, planted.
- low, rejected: the green line does not say duplicate keys were checked. A duplicate never reaches the stage the
  line describes, and a new clause would move every pinned copy of the line for no new refusal; the record says it.

## Ledger closures

DW-28:

**Closed 2026-10-18 by Story 9-6-registry-gate-hardening** (`c39ec14613e7a806f8a529e9b447bb52941b39a2`,
`ops/registry-schema.mjs:duplicateKey`): the gate scans both contract files after `JSON.parse` accepts them and
refuses any object carrying one key twice, keys compared decoded, naming the file, the object's pointer, the key and
the line, before the schema is applied. Five planted cases in `ops/__tests__/registry-schema.test.ts` hold it (a
Registry entry, the schema, a key holding a newline, two spellings of one key, and a positive control).
`ops/registry-schema.md` records the decision and the stated-limit row "A duplicate key is refused by this gate and
by no other reader".

DW-251:

**Closed 2026-10-18 by Story 9-6-registry-gate-hardening** (`ebc14299cfe98ce0edeb69ce1265190325cc392f`,
`.github/workflows/registry-verification.yml`): the scheduled Registry check sets up Node 24, the third and last
half. `STILL_ON_NODE_22` is deleted from `ops/__tests__/workflow-hardening.test.ts`, so every workflow's `setup-node`
is held to Node 24 with no exception, and `ops/__tests__/registry-verification.test.ts` pins the 24. The record's
Runner row is amended. Run locally on Node v24.15.0 the script passed 75 of 75 checks; the first runner observation
is the push of this workflow file to `dev`, which its `paths` trigger runs.

No action items are named by this story.

## Independent verifier

Independent verifier: PASS on round 2, 2026-10-18, separate agent; tests: all runs in the story worktree at
`a7a6271` (4 commits on `origin/dev`, rebased since to `2b138bb`). `corepack pnpm vitest --run` on registry-schema,
workflow-hardening, registry-verification and contract-purity: 4 files, 296 passed, 0 failed. `node
ops/registry-schema.mjs`: green, 16 applications, success line unchanged. `corepack pnpm typecheck`: no errors.
`corepack pnpm test --run` (full root suite): 82 files, 1988 passed, 1 skipped, 3 failed, all three WSL-spawning suites
(demo-reset, tournament-backup, tracker-backup, the DW-135 flake), which passed 56 of 56 on re-run. The verifier's own
plant (replacing `duplicateKey(body)` with `null`) failed 4 of 107 registry-schema cases (the entry, schema,
control-character and two-spellings cases) while the positive control stayed green; the file was restored and the tree
left clean. An edge probe against the real contracts through the exported `inspect` and `report` confirmed a duplicate
in the last entry is reported at /applications/15, line 178; a BOM with CRLF gives the same report; the clean Registry
with CRLF passes; a nested duplicate gets /zz/1; a key holding / and ~ escapes as /a~1b~0c; a string ending in an
escaped backslash is handled; equal key names in sibling and nested objects give no false positive. No per-app suite
or container e2e ran, since nothing under `apps/` or `tests/e2e` changed.
