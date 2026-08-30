---
title: 'Story 2.3: The Registry schema and its blocking CI gate'
type: 'feature'
created: '2026-08-29'
status: 'in-progress'
baseline_commit: '3251f2bd40b4b290e2e935c53cc15405e05b2891'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** AD-4 makes `contracts/registry.json` the only Registry and AD-21 lists "Registry schema
validation" among the gates that may never become a warning. Neither the schema, the file, nor the
gate exists. Story 2.5 authors one entry per Estate application and Story 2.7 has the Hub import the
result, so the shape has to be fixed and mechanically enforced before the entries are written, not
after: a malformed entry that ships is inherited by every consumer in every estate language.

**Approach:** Author `contracts/registry.schema.json` as JSON Schema draft-07 fixing AD-5's entry
shape, seed `contracts/registry.json` as an envelope carrying `$schema`, `contract_version` and an
empty application list, and add a blocking `registry-schema` job to `.github/workflows/ci.yml` that
runs a zero-dependency validator under `ops/`. The published surface grows from nine files to
eleven, and three committed listings plus one probe already assert the number nine, so they move in
this story too.

## Boundaries & Constraints

**Always:**

- The schema is the contract and the validator implements a **fixed keyword set**. Any keyword in
  the schema that the validator does not implement is a **refusal**, checked before any instance is
  read. A validator that silently ignores a keyword is green over the rule it never applied.
- A missing, unreadable or unparseable schema or registry file is a refusal, never a pass, and an
  empty application list is not one: zero entries is a fact about the data, and Story 2.5 is what
  changes it. Same reasoning `ops/contract-purity.mjs` records for an empty surface.
- Every violation in a run is reported, not just the first, each naming its instance location as a
  JSON Pointer and the rule that rejected it. Output is sorted, so two runs over one tree print one
  string.
- Zero dependencies, `node:` builtins only, both paths fixed in the source and resolved beside the
  module: no environment variable and no argument selects what is read. The job installs nothing, so
  the Registry is still validated on the run where `pnpm install --frozen-lockfile` fails.
- Draft-07 with `definitions`, and no `format` keyword anywhere: the editor and the gate have to
  agree on every assertion, and `format` is the one keyword whose strength differs between them.
- `$schema` on `contracts/registry.json` is **required by the schema itself** with a fixed value, so
  deleting the editor's hook is a red build rather than a silent loss of AD-4's authoring half.
- Uniqueness of `id` across entries cannot be expressed in draft-07. The gate enforces it as one
  named structural rule **beyond** the schema, and says so in the refusal, in the source and in the
  record. The editor will not catch it, which is a stated limit.

**Ask First:**

- Any change to the four `status` values, or to the value sets `demo` and `identity` accept, beyond
  what AD-5, AD-12 and FR-27 fix.
- Authoring any real application entry, or a `description`, `tech` array or `status` for a real
  application. Those are Stories 2.4, 2.5 and 2.6.
- Any change to the `cs-tracker` verbatim-copy comparison beyond narrowing its source side to the
  nine token-contract paths.
- Adding any dependency, `ajv` included.

**Never:**

- Do not put `minItems: 1` on the application list. The envelope this story ships carries zero
  entries and would fail its own gate. Record the tightening as work for Story 2.5.
- Do not touch `content/projects.ts`, the Hub, any component, or anything under `app/`, `public/` or
  `packages/tokens/tokens/`. Story 2.7 retires the TypeScript module.
- Do not make the job conditional, `continue-on-error`, or non-blocking, and do not modify the five
  existing jobs (AD-21).
- Do not vendor `registry.json` into `cs-tracker` or change how a Satellite obtains it. AD-4 has
  Satellites fetch it over HTTPS at build time; AD-14's folder is the token contract only.
- Do not run the Playwright suite or regenerate a baseline. Nothing rendered changes.
- Do not derive a hostname from an id anywhere in the schema (AD-3). `live` is a free URL field.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal run | the shipped envelope, zero entries | one line naming the file, the entry count and the schema, exit 0 | N/A |
| Missing file | schema or registry absent | refusal naming the path and what it must carry | exit 1 |
| Unparseable | a trailing comma in either file | refusal naming which file and the parser's own message | exit 1 |
| Unsupported keyword | the schema gains `oneOf` | refusal naming the keyword and its schema location, before any instance is read | exit 1 |
| `live` conditional | `status: Live` with no `live`; `status: Archived` with `live` | refusal at the entry's pointer, naming which half of FR-6/FR-28 failed | exit 1 |
| Fifth status | `"status": "Retired"` | refusal listing the four permitted values | exit 1 |
| Absent declaration | entry without `demo` or without `identity` | refusal stating absence is not a permitted way to say "not applicable" (AD-5) | exit 1 |
| Unknown field | entry carrying `"licence"` | refusal naming the field, `additionalProperties: false` | exit 1 |
| Duplicate id | two entries sharing an `id` | refusal naming the id and both indexes, marked as the rule beyond the schema | exit 1 |
| Missing `$schema` | envelope without it | refusal, because AD-4's editor hook is required | exit 1 |
| Several at once | three entries each broken differently | every violation in one run, sorted by pointer | exit 1 |

</frozen-after-approval>

## Code Map

- `ops/contract-purity.mjs`: the model to follow end to end. Exported pure functions (`inspect`,
  `report`, `main`), fixed surface resolved beside the module (`:425`), refusal text carrying the
  governing AD, `process.exitCode` set before the write and `process.exit` inside the write callback
  (`:447-461`), and the `invokedDirectly` guard with its `sameFile` fallback that never answers "no".
- `ops/__tests__/contract-purity.test.ts`: the test idiom. Scratch trees under `tmpdir()` (`:57-60`),
  a positive control that reads the committed surface (`:143-149`), a case per refusal, and a block
  that spawns the real binary. `:189` already lists `registry.json` as a non-executable name.
- `.github/workflows/ci.yml:144-177`: the `contract-purity` job, which the new job copies: no
  `pnpm/action-setup`, no install, no cache, Node 22, `timeout-minutes: 5`, one `run:` step, no
  `env:`, no `on:` of its own. `:31-88` shows the two drift jobs, which are not touched.
- `ops/contract-purity.md`: the record's shape. Preamble naming the story, date and baseline commit;
  every value marked **Observed** with its method or **Decision** with its reason; a job table
  (`:47-59`); "Nothing redirects it" (`:61-75`); probe output verbatim (`:205`).
- `packages/tokens/__tests__/tokens-contract.test.ts:881-897` and
  `packages/fonts/__tests__/fonts-contract.test.ts:780-796`: two hard-pinned nine-path listings of
  the real `contracts/`, each also asserting nothing published is executable. Both go to eleven.
- `ops/__tests__/cs-tracker-adoption-probe.test.ts:98-137`: `CONTRACT_PATHS`, the third pinned
  listing, asserted against the real folder by `fileList` and `hashTree`.
- `ops/cs-tracker-adoption-probe.mjs:277-303`, `:1039-1042`, and `CONTRACT_FILE_COUNT = 9`: the
  verbatim-copy case hashes the **whole** `contracts/` tree against `cs-tracker`'s vendored
  `cuatro-contracts/`. Its source side narrows to the nine token-contract paths, or the probe
  permanently reports two files a Satellite must never vendor.
- `packages/tokens/build.mjs:4-5`: "nothing under `contracts/` is hand-edited: this file is the only
  thing that writes it". False once this story lands. `:326-327` and `:630` show it writes named
  files into `contracts/` and never cleans the directory, so the two JSON files survive a rebuild
  and the `tokens-contract` drift job stays green.
- `packages/contracts-serve/publish.mjs:203-290`: copies the whole surface with no allowlist, so
  both new files are served at `/contracts/` with no change here.
  `tests/e2e/contract-serving.pw.ts:77-97` enumerates the surface at runtime and already expects
  `application/json`, so the e2e spec needs no edit.
- `ops/estate.md`: every application and its disposition. Read only in this story; it is the input
  Story 2.5 transcribes.
- `content/projects.ts:1-8`: the shape being replaced (`id`, `name`, `description`, `tech`,
  `github?`, `live?`). Read only. Note `github` becomes `source` and is required.
- `AGENTS.md:32-38` ("20 records"), `:74-76` (the AD-1 line), `:88-127` (pitfalls).

## Tasks & Acceptance

**Execution:**

- [ ] `contracts/registry.schema.json`, new: draft-07, `$id`
      `https://cuatro.dev/contracts/registry.schema.json`. Envelope requires `$schema` (const
      `./registry.schema.json`), `contract_version` (`^\d+\.\d+\.\d+$`) and `applications`, with
      `additionalProperties: false`. An entry requires `id`, `name`, `description`, `status`, `tech`,
      `source`, `demo`, `identity`; permits `live`, `family`, `absorbed_into`, `token_contract`;
      forbids anything else. `status` enum of four, `identity` enum of three, `demo` enum of four,
      `id`/`family`/`absorbed_into` kebab-case, `source`/`live` `^https://`, `tech` a non-empty
      unique array of non-empty strings. Two `allOf` `if`/`then` members carry the `live` condition.
      Every enum value carries a `description` saying what it means.
- [ ] `contracts/registry.json`, new: `$schema`, `contract_version: "1.0.0"`, `applications: []`.
- [ ] `ops/registry-schema.mjs`, new: read both files, refuse on any keyword outside the implemented
      set, validate, apply the duplicate-`id` rule, and report every violation with its pointer.
      Exported pure functions plus `main()`; the CLI half copies `contract-purity.mjs` exactly.
- [ ] `ops/__tests__/registry-schema.test.ts`, new: a case per matrix row against scratch fixtures, a
      positive control that validates the committed pair, a case pinning the implemented keyword set
      against the keywords the shipped schema actually uses (so a schema edit cannot outrun the
      validator), and a subprocess block running the real binary. Cover the `ci.yml` job the way
      `contract-purity.test.ts` does: the command line, the absence of `env:`, `on:` and
      `continue-on-error`, and the job-name set.
- [ ] `.github/workflows/ci.yml`: add one `registry-schema` job after `contract-purity`, modelled on
      it. Nothing else in the file changes.
- [ ] `ops/registry-schema.md`, new: the record. Why the gate exists (AD-4, AD-21, and that neither
      the file nor the check existed at the baseline commit); what it checks and what it does not; the
      job table; "Nothing redirects it"; the dialect and `format` decisions; the value sets with the
      requirement each answers; the demonstration, which is the gate run against a deliberately
      malformed `registry.json` with its output verbatim and the fixture removed in the same story;
      stated limits (empty list, `minItems`, duplicate ids invisible to the editor, the vendored-copy
      narrowing); and the work handed to the Operator.
- [ ] `packages/tokens/__tests__/tokens-contract.test.ts` and
      `packages/fonts/__tests__/fonts-contract.test.ts`: both listings gain
      `contracts/registry.json` and `contracts/registry.schema.json`, sorted.
- [ ] `ops/cs-tracker-adoption-probe.mjs` and `ops/__tests__/cs-tracker-adoption-probe.test.ts`: the
      walk cases assert the eleven-file surface; the verbatim-copy comparison narrows its source side
      to the nine token-contract paths, named in one exported constant with the AD-4 reason beside
      it, and refuses if any of the nine is absent from `contracts/` so the comparison cannot shrink
      silently. `CONTRACT_FILE_COUNT` keeps meaning the token contract's nine.
- [ ] `ops/cs-tracker-token-adoption.md` and `ops/contract-purity.md`: one dated paragraph each,
      appended, recording that the published surface is eleven files from this story and that the
      vendored comparison is the token contract's nine.
- [ ] `packages/tokens/build.mjs:4-5`: correct the comment. It is the only thing that writes the
      three stylesheets; two hand-authored JSON files now sit beside them.
- [ ] `AGENTS.md`: 21 records with `registry-schema.md` named; the AD-1 line notes the Registry pair
      as the published surface's only hand-authored files; one pitfall line saying three committed
      listings pin the contents of `contracts/` and a file added there fails all three.

**Acceptance Criteria:**

- Given the committed `contracts/registry.json`, when `node ops/registry-schema.mjs` runs from any
  working directory, then it exits 0, names both files and the entry count, and prints nothing that
  differs between a Windows checkout and an Ubuntu runner.
- Given a deliberately malformed `registry.json`, when the gate runs, then it exits 1 and the run's
  verbatim output is in `ops/registry-schema.md`, and the fixture is absent from the working tree at
  the end of the story.
- Given `.github/workflows/ci.yml`, when the `registry-schema` job is read, then it is blocking,
  installs nothing, carries no `env:`, no `if:`, no `on:` and no `continue-on-error`, and the five
  pre-existing jobs are byte-identical to the baseline commit.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when both run, then both pass with
  the new test file included and with no `.next/` directory required.
- Given `corepack pnpm build`, when it completes, then `public/contracts/registry.json` and
  `public/contracts/registry.schema.json` exist and `git status --porcelain -- contracts/` is empty
  after `corepack pnpm tokens:build` and `corepack pnpm fonts:build`.
- Given the diff for this story, when it is read, then nothing under `app/`, `components/`,
  `public/`, `content/`, `packages/tokens/tokens/` or `tests/` has changed, and no dependency was
  added to `package.json`.

## Spec Change Log

- **2026-08-29, implementation.** The Execution list names three committed listings that assert the
  number nine. A fourth committed assertion moves with this story and the list does not name it:
  `ops/__tests__/contract-purity.test.ts:1015` pins the `ci.yml` job names as a five-element set, and
  the new job makes it six. One line changed there, nothing else in that file, and the change is
  recorded in the dated paragraph this story appends to `ops/contract-purity.md`. Without it
  `corepack pnpm test --run` cannot pass, which the Acceptance Criteria require.
- **2026-08-29, implementation.** "Every enum value carries a `description`" is met with
  `enumDescriptions`, VS Code's own parallel-array annotation, rather than with `oneOf` plus one
  `const` per value. The matrix names `oneOf` as the unsupported-keyword refusal, so the draft-07
  idiom for per-value descriptions is barred by the same story. The validator implements
  `enumDescriptions` as an annotation and holds it to one description per enum member, so the claim
  is mechanically true. Recorded in `ops/registry-schema.md` under the dialect and as a stated limit.

## Design Notes

**Draft-07, not 2020-12.** The gate and the editor have to agree, and draft-07 is the dialect every
editor and every language's validator implements fully. `definitions` rather than `$defs` follows
from it. `format` is left out entirely for the same reason: it is annotation-only in some validators
and an assertion in others, so `source` and `live` are constrained by `pattern` instead.

**`demo` is a closed set of four**, because AD-5 requires an explicit value and FR-27 names three
categories: `demo-account` (usable with `demo@cuatro.dev`, AD-13), `open` (usable with no
authentication), `not-deployed`, and `none` (deployed, no demo access offered). An object with a mode
and a URL was the alternative and is deferred: Story 2.4 records Mutuo's pre-existing demo accounts,
and FR-25 is where a richer shape would earn itself.

**The envelope ships with zero entries** so the gate has a real instance from its first run rather
than a check that passes over nothing. It is not a claim that the Estate is empty: `applications` is
`[]` and Story 2.5 fills it. The cost is `minItems: 1` cannot be set yet, which is the one entry
rule the schema deliberately leaves open, recorded as such.

**Why the validator lives in `ops/` rather than `packages/`.** It generates nothing and has no
inputs to build from; it produces a verdict, like `contract-purity.mjs`, `capacity-gate.mjs` and
`contract-adoption.mjs`, each of which sits in `ops/` beside its record. AD-1 is satisfied either
way, since neither directory is published.

**The `cs-tracker` narrowing is forced, not opportunistic.** The probe today asserts the vendored
folder is a verbatim copy of the whole `contracts/` tree. AD-4 has Satellites fetch the Registry over
HTTPS at build time and AD-14's `cuatro-contracts/` folder is the token contract, so the moment the
Registry lands under `contracts/` the probe would report two files a Satellite must never vendor.

## Verification

**Commands:**

- `node ops/registry-schema.mjs`: exit 0, and the same output when run from `ops/`.
- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: passes, at 738 tests plus the new file's cases, with the three updated
  listings green.
- `corepack pnpm tokens:build` then `corepack pnpm fonts:build`, then `git status --porcelain
  --ignored=matching -- contracts/`: empty, which is what the two drift jobs read.
- `corepack pnpm build`: succeeds and publishes eleven files at `/contracts/`.
- `node ops/contract-purity.mjs`: exit 0, reading eleven files.
- `node ops/cs-tracker-adoption-probe.mjs`: the verbatim-copy case still passes against the vendored
  nine. If `cs-tracker` is not checked out beside this repository, record that the case could not run
  rather than reporting it green.
- `git status --short`: only the files this story names.

**Manual checks:**

- Open `contracts/registry.json` in VS Code, paste an entry with `status: "Live"` and no `live`, and
  confirm the editor marks it. That is AD-4's authoring half, which no CLI here can assert.
- Read the gate's output against a fixture breaking three rules at once and confirm all three are
  named, with pointers, in one run.
