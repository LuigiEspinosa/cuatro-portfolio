# The registry-schema gate

The written record of `contracts/registry.schema.json`, `ops/registry-schema.mjs` and the
`registry-schema` job in `.github/workflows/ci.yml`: why the gate exists, what it checks and what it
deliberately does not, the job's properties and how far its blocking reach actually goes, the
dialect and `format` decisions, the value sets with the requirement each answers, the one rule
applied beyond the schema, the demonstration with its output verbatim, which standing cases hold the
failure paths permanently, the stated limits, and the work this file hands the Operator.

Written during Story 2-3 on **2026-08-29** (ISO 8601 UTC), against baseline commit `3251f2b`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/contract-purity.md`, `ops/token-contract.md` and `ops/font-contract.md`
set: every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and
every date is ISO 8601 UTC.

## Why the gate exists at all

AD-4 makes `contracts/registry.json` the estate's only App Registry: authored by hand, carrying
`$schema` so an editor validates while the entries are written, with `contracts/registry.schema.json`
fixing the shape and CI failing the build on a malformed entry. AD-21 lists "Registry schema
validation" among the gates that may never become warnings. FR-6 says validation of the entry
contract fails the build.

**None of it existed before this story.** **Observed 2026-08-29** at `3251f2b`: neither
`contracts/registry.json` nor `contracts/registry.schema.json` was in the tree, and
`.github/workflows/ci.yml` carried five jobs, none of them a Registry check. The shape had to be
fixed and mechanically enforced **before** the entries are written, not after: Story 2.5 authors one
entry per Estate application and Story 2.7 has the Hub import the result, and a malformed entry that
ships is inherited by every consumer in every estate language.

## What the gate checks, and what it deliberately does not

| It checks | It does not check | Nature |
|---|---|---|
| Every entry against AD-5's shape: the eight required fields, the four optional ones, the three closed value sets, the kebab-case and `https://` patterns, and both halves of the `live` condition | Whether a `live` or `source` URL resolves | **Decision.** FR-32 gives link verification to a scheduled job, which is Story 2.23. A gate on a runner asserting a URL resolves would fail on a network blip |
| That no two entries share an `id`, as one named rule **beyond** the schema | Whether an id matches a repository that exists | **Decision.** AD-3 derives every other identifier from the id; a repository sweep is a different check with a different failure mode |
| That every keyword in the schema is one this validator implements, before the Registry is read at all | Any dialect feature outside the implemented set | **Decision.** A validator that silently ignores a keyword is green over the rule it never applied. The set is listed below |
| That both files exist, parse, and were actually read | The served copy at `https://cuatro.dev/contracts/registry.json` | **Decision.** The gate reads the committed tree on a runner. Stated limit below |
| Nothing about the entries' truth: a `description` that lies, a `tech` array naming a framework the application does not use, or a `status` that is out of date all pass | | **Decision.** The schema is a shape, not an audit. FR-32's scheduled job and the Operator are what keep the values honest |

## The job

`.github/workflows/ci.yml` gained one job, `registry-schema`, placed after `contract-purity`. The
`test`, `tokens-contract`, `fonts-contract`, `contract-purity` and `rendered-output` jobs were not
modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. The job carries no `continue-on-error`, no `\|\| true`, no `if:`, no `needs:` and no soft exit, so a malformed Registry is a red job on every push and every pull request | **Decision.** AD-21, which names Registry schema validation in its list of gates that may never become warnings, and `AGENTS.md` under "Policy" |
| **How far that reach goes** | A red job stops **nothing mechanically today**. GitHub holds a merge only on a **required status check**, and `.github/workflows/deploy.yml` fires on the same push to `main` with no `needs:` and no `workflow_run:`, so a red Registry job does not hold a deploy either | **Observed 2026-08-29** for the deploy half, by reading both workflow files. The required-check half is a repository setting no command on this host can read. The same is true of all six jobs; `ops/contract-purity.md`'s Operator action 2 already asks for it and this story adds a sixth job to that sitting. Pending Operator action 2 |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-29.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift. A standing case asserts the job declares no `on:` of its own |
| Position | After `contract-purity`, before `rendered-output` | **Decision.** Jobs run in parallel, so the position is a reader convenience. Two standing cases now pin the six job names as a set that happens to be ordered, one in this story's suite and the pre-existing one in `ops/__tests__/contract-purity.test.ts` |
| Runner | `ubuntu-latest`, Node 22 through `setup-node` | **Decision.** The Node major every other job in the file pins |
| Installs | Nothing. No `pnpm/action-setup`, no `pnpm install`, no pnpm cache | **Decision.** The validator imports only `node:` builtins and adds no dependency, `ajv` included, so the Registry is still validated on the run where `pnpm install --frozen-lockfile` fails. Same argument as `contract-purity`, whose job block this one copies |
| Ceiling | `timeout-minutes: 5` | **Decision.** Checkout, `setup-node`, two file reads and a walk of one envelope. The same ceiling as `contract-purity`, and pinned by a standing case, because a figure this file states and nothing asserts is a figure that drifts |
| Command | `node ops/registry-schema.mjs`, with no argument and no `env:` | **Decision.** See "Nothing redirects it" below. A standing case pins the whole command line and asserts the job carries exactly one `run:` step, a second pins the two action steps beside it, and a third holds the absence of a workflow-wide `env:` |
| Lines added to `ci.yml` | 34 added, **0 removed** | **Observed 2026-08-29** by `git diff --numstat 3251f2b -- .github/workflows/ci.yml` |
| The five existing jobs | Byte-identical to `3251f2b` | **Observed 2026-08-29**, by comparing the first 178 lines of the file case-sensitively against the same lines of `git show 3251f2b:.github/workflows/ci.yml`, which is everything through the `contract-purity` job's `run:` line, and the tail from `rendered-output:` onward against the baseline's tail. Corroborated by the 0 removed lines above |

## Nothing redirects it

No environment variable and no argument selects which files the validator opens. Both paths are
fixed in the source and resolved beside the module, so the gate works from any working directory and
no caller can point it at a file that happens to be valid.

That is not a stylistic choice, and `ops/contract-purity.md` records why at length: `ci.yml:53-64`
and `:113-124` had to pin two build inputs empty on each of the two contract jobs precisely to close
that hole for the drift gate. A redirectable Registry gate has the same shape of hole, because a
check that validates a file nobody published is green over anything.

Four standing cases hold it: one spawns the gate with a scratch directory carrying an invalid
Registry as its argument and requires exit 0 anyway, one asserts the module's own source contains no
`process.env`, no `node:process` import and no `process.argv` position other than `[1]`, one asserts
the job's `run:` line is the whole command with nothing appended, and one asserts the module reaches
for no dependency by a static import, a dynamic `import()`, `createRequire` or a bare `require()`.

**A refusal records its verdict before it writes.** **Decision**, inherited whole from
`ops/contract-purity.mjs`: `process.exit` runs inside the write callback so a pipe cannot truncate
the refusal, and `process.exitCode` carries the verdict so a stream torn down before that callback
fires cannot leave the process falling off the end of the module and exiting 0. Held by a case
reading the module's source, for the reason that record gives.

**The invoked-directly guard never answers "no" when it cannot tell**, for the same reason and with
the same `realpathSync` fallback, held by its own case.

## What is escaped, and what is not

**Everything that reaches a refusal from outside this module is escaped**, on the reasoning
`ops/contract-purity.md` sets out under "Characters that forge or disguise a line": a value carrying
a newline forges a line that reads like this gate's own prose and can push the real violation out of
an operator's view, and a bidirectional override or a zero-width character lets two different values
be drawn identically in a log.

Three things reach a refusal from outside: a **Registry value**, quoted through `show()`; a
**pointer**, built from Registry and schema property names; and a **parser or filesystem message**.
The story's review pass found the second and third of those printed raw, so a schema carrying a
property name with a newline forged a line the first was protected against. All three now go through
the escaping. **A violation's detail is deliberately not escaped as a whole**, because it is this
module's own prose assembled around already-escaped parts, and a blanket escape would print a quoted
`pattern` with a doubled backslash: the one string an operator is being sent to the schema to
compare. That is the same line `ops/contract-purity.md` draws under "Only the untrusted half of a
reason is escaped", and both halves have a case.

**The two escapers share one predicate.** `printable()` and the `escapeInvisible()` that `show()`
uses differ only in what they do to a backslash: `JSON.stringify` has already escaped the backslash
and the C0 range by the time `show()` runs, so doubling them there would print every authored newline
as `\\n`, which is noise rather than safety. They disagreed about exactly one character before the
review pass, U+007F, which `JSON.stringify` does not escape either, so a DEL in an id reached the log
as itself. One shared `HIDES` predicate now decides which code points are dangerous, and a standing
case runs ten of them, DEL and a C0 control included.

**The quoting is injective up to truncation, and not past it.** A value longer than 120 code points
is cut, so two values agreeing on their first 120 print identically. That is a deliberate trade: a
hand-authored `id` or URL that long is already the defect. The cut is by **code point** rather than
by UTF-16 code unit, because a cut by code unit can land between the halves of an astral character
and emit a lone surrogate, which is a code point neither escaper describes and no terminal draws.
Both properties have a case.

## The dialect, and why `format` appears nowhere

**Draft-07, not 2020-12.** **Decision.** The gate and the editor have to agree, and draft-07 is the
dialect every editor and every language's validator implements fully. `definitions` rather than
`$defs` follows from it. A Satellite in Elixir, Go or Python that wants to validate the Registry it
fetched can reach for a draft-07 validator in its own language and get the same answers.

**No `format` keyword anywhere.** **Decision.** `format` is annotation-only in some validators and
an assertion in others, so the editor and the gate would disagree about what the schema asserts.
`source` and `live` are constrained by `pattern: "^https://"` instead, which every validator applies
identically. A standing case asserts the string `"format"` appears nowhere in the schema, and the
validator refuses the keyword by name with that reason in the refusal.

**The validator implements a fixed keyword set, and anything outside it is a refusal.** **Decision.**
The set, exported as `KEYWORDS` and pinned by a standing case:

```
$id, $ref, $schema, additionalProperties, allOf, const, definitions, description, else,
enum, enumDescriptions, if, items, minItems, minLength, not, pattern, properties, required,
then, title, type, uniqueItems
```

Six of those assert nothing and are implemented by knowing that: `$id`, `$schema`, `title`,
`description`, `definitions` as a container, and `enumDescriptions`. The audit runs **before the
Registry is parsed**, so a schema carrying an unimplemented keyword can never produce a verdict about
an instance, and a standing case plants a keyword and a violation together and requires the keyword
to be what is reported.

Three smaller refusals follow from the same argument and are noted rather than tabled. A `$ref`
carrying siblings is refused, because draft-07 discards every sibling of `$ref` and the schema would
read as though those rules bound while nothing applied them. A subschema that is not an object,
which includes draft-07's legal boolean schemas, is refused because this validator applies no rule
to one. And **an `if` carrying neither `then` nor `else` is refused**, because the condition is
evaluated and its answer discarded: the schema reads as though it still carried a rule while
asserting nothing. That last one is the keyword audit's own argument one level down, and it guards
exactly the two members that carry the `live` condition, where deleting a `then` in an edit would
otherwise leave both halves looking intact.

**A leading byte order mark is stripped before either file is parsed.** **Decision.** `JSON.parse`
throws on a U+FEFF, so a valid Registry saved by an editor on the Windows host these files are
authored on would read as malformed with a message about position 0 that says nothing about a
character its author cannot see. Only a leading one is stripped; a U+FEFF anywhere else is inside a
string value, where it is escaped when quoted. Both halves have a case.

**`enumDescriptions` is VS Code's own annotation**, and it is here because draft-07 has no other way
to say what an enum value means. The idiom would be `oneOf` with one `const` and one `description`
per value, and `oneOf` is deliberately outside the implemented set: it is the keyword the story's
matrix names as the refusal case, and implementing a branch combinator would mean this gate deciding
which branch's message to print. `enumDescriptions` asserts nothing in either reader. The audit holds
it to one description per enum member, so "every enum value carries a description" is mechanically
true rather than a claim about the author's care.

## The value sets, and the requirement each answers

| Field | Values | Requirement | Nature |
|---|---|---|---|
| `status` | `Live`, `Complete`, `In progress`, `Archived` | AD-5 fixes exactly these four. FR-35 renders the first two and holds the other two | **Decision**, transcribed from AD-5 |
| `identity` | `oidc`, `wallet`, `none` | AD-12: every entry carries one, absence is not a permitted value. `MaiCoin` is `wallet` and structurally exempt, not unimplemented | **Decision**, transcribed from AD-12 |
| `demo` | `demo-account`, `open`, `not-deployed`, `none` | FR-27 names three categories: usable with a Demo Account, usable without authentication, not deployed. `none` is the fourth, deployed with no demo access offered, which C-10 and FR-27's `MaiCoin` bullet both need | **Decision.** The one value set this story adds to rather than transcribes, and it is recorded as such |
| `live`, `source` | `^https://[^\s/]+(/\S*)?$` | AD-3: **no hostname is derived from an id**. Three live hostnames already diverge from their ids, so the Registry is the only mapping and the host is free. What the pattern does fix is that there **is** a host and that the value carries no whitespace | **Decision**, from AD-3. The pattern was `^https://` until the story's review pass, which is an anchor and nothing else: it accepted the bare scheme `"https://"`, `"https:// "`, and a value with an embedded space or newline. `source` is FR-6's drill-through to the code and `live` is what FR-28 says must resolve, so a hostless value passing the gate is the Registry lying in the one field a reader clicks. Nine values, four accepted and five refused, have standing cases |
| `contract_version`, `token_contract` | `^\d+\.\d+\.\d+$` | AD-5's envelope version and AD-16's adopted token contract version | **Decision** |

**`demo` is a closed set of four rather than an object with a mode and a URL.** **Decision.** An
object was the alternative and is deferred: Story 2.4 records Mutuo's pre-existing demo accounts, and
FR-25 is where a richer shape would earn itself. Widening `demo` later is a Registry minor bump, and
narrowing it is not, which is the asymmetry that makes starting closed the cheap direction.

## The one rule beyond the schema

**Uniqueness of `id` across entries cannot be expressed in draft-07.** The gate enforces it as one
named structural rule beyond the schema. The refusal says so in those words, naming the id and both
indexes, and the exported constant carrying that sentence is asserted by a standing case so the
refusal cannot quietly stop admitting it.

**The editor will not catch it**, which is a stated limit rather than an oversight: AD-4's authoring
half is the editor validating while the entries are written, and this is the one rule that half does
not cover. AD-3 makes the id the name every other identifier is derived from, so two entries sharing
one is two applications claiming the same GHCR image, the same compose service, the same Traefik
router and the same Postgres database.

## The demonstration

A gate never observed to fail is not known to work. A deliberately malformed `contracts/registry.json`
was planted, the gate run, its output recorded here, and the file restored. **No fixture exists in
the tree at this story's closing commit**, which is why its output lives in this file.

| Field | Value | Nature |
|---|---|---|
| The fixture | Three entries breaking **six** rules between them: a `Live` entry with no `live`; an entry carrying `"status": "Retired"` and a `"licence"` field and no `demo`, which is three; and an `Archived` entry carrying a `live` URL and repeating the first entry's id, which is two | **Decision.** One entry per class of refusal the matrix names, in one file, because "every violation in a run" is the claim being demonstrated. The count is six and the output below lists six |
| Result | The job's command exited **1** and wrote the refusal to stderr, naming all six violations by JSON Pointer, in sorted order, each with the rule that rejected it | **Observed 2026-08-29** on the Windows 11 development host, by running `node ops/registry-schema.mjs` against the working tree |
| Removed | Yes | **Observed**, confirmed by the gate exiting 0 again against the committed envelope |

The command's output, quoted verbatim:

```
registry schema: REFUSED
  AD-4: contracts/registry.json is the estate's only App Registry, and
  contracts/registry.schema.json fixes its shape, so CI validates it and a malformed
  entry cannot ship. AD-21 makes this gate blocking rather than a warning: there is one
  environment and no staging, and the Registry is read by every consumer in every estate
  language, so nothing downstream catches what it lets through.
  6 violations in contracts/registry.json, by JSON Pointer:
    /applications/0: "live" is required here and is absent
      rule: required, at #/definitions/application/allOf/0/then/required
      FR-6 and AD-5, first half: "live" is required when "status" is Live. An entry the Suite Directory renders as running has to say where it runs.
    /applications/1: "demo" is required here and is absent
      rule: required, at #/definitions/application/required
      What a Visitor can do with this application before they click (FR-27). Required with an explicit value: absence is never a permitted way to say "not applicable" (AD-5).
    /applications/1/licence: "licence" is not a field this schema defines, and additionalProperties is false here. The fields it defines are "id", "name", "description", "status", "tech", "source", "demo", "identity", "live", "family", "absorbed_into", "token_contract"
      rule: additionalProperties, at #/definitions/application/additionalProperties
      One Registry entry (AD-5): eight required fields, four optional ones, and nothing else. additionalProperties is false, so a field a consumer cannot rely on never reaches one.
    /applications/1/status: "Retired" is not one of the 4 permitted values: "Live", "Complete", "In progress", "Archived"
      rule: enum, at #/definitions/application/properties/status/enum
      The application's lifecycle state (FR-7). Exactly one of four strings; the Suite Directory renders Live and Complete and holds the other two (FR-35).
    /applications/2: this value matches a shape the schema forbids here
      rule: not, at #/definitions/application/allOf/1/then/not
      FR-6 and FR-28, second half: "live" is forbidden when "status" is Archived. An application taken offline loses its URL in the same change, so no entry ever presents a "live" URL that does not resolve.
    /applications/2/id: the id "cs-tracker" is already carried by /applications/0 (AD-3: one id per application)
      rule: unique id
      Uniqueness across entries cannot be expressed in draft-07, so this is the one rule this gate applies beyond the schema, and the editor will not catch it.
  Fix the entries, or renegotiate the shape in contracts/registry.schema.json and in
  AD-5. A malformed entry that ships is inherited by every consumer in every estate language.
```

And the same command against the committed envelope, which is the other half of what makes the
refusal meaningful:

```
registry schema: read contracts/registry.json against contracts/registry.schema.json, 0 applications, valid, no duplicate id (AD-4, AD-5).
```

**Every message a violation carries comes out of the schema.** **Decision.** The second and third
lines of each violation are the rule's own JSON Pointer and the `description` of the schema node
that rejected the value, or, for a missing required field, the `description` of the field that is
absent. That is why AD-5's "absence is never a permitted way to say not applicable" reaches an
operator's log: it is written once, in `contracts/registry.schema.json`, where the editor shows it to
an author too.

## The published surface is now eleven files

`contracts/` was nine files and is eleven. **Observed 2026-08-29** by `node ops/contract-purity.mjs`,
which prints, verbatim:

```
contract purity: read contracts/, 11 files, none executable and no link (AD-1).
```

and by `corepack pnpm build`, after which `public/contracts/` holds the same eleven.

**The two new files are the only hand-authored things on the published surface.** Everything else
under `contracts/` is generated by `packages/tokens/build.mjs` or `packages/fonts/build.mjs`. Those
generators name the files they write and never clean the directory, so the JSON pair survives a
rebuild and both drift jobs stay green: **Observed 2026-08-29** by running `corepack pnpm tokens:build`
and `corepack pnpm fonts:build` and reading `git status --porcelain --ignored=matching -- contracts/`,
which reports the two files as added and nothing else. The comment at `packages/tokens/build.mjs:3-5`
claimed nothing under `contracts/` is hand-edited and was corrected in this story.

Three committed listings pin the contents of `contracts/`, and all three moved:
`packages/tokens/__tests__/tokens-contract.test.ts`, `packages/fonts/__tests__/fonts-contract.test.ts`
and `ops/__tests__/cs-tracker-adoption-probe.test.ts`.

**The `cs-tracker` verbatim-copy comparison narrowed, and the narrowing is forced.** AD-4 has
Satellites fetch `registry.json` over HTTPS at **build** time, and AD-14's `cuatro-contracts/` folder
is the token contract, so the moment the Registry landed under `contracts/` a whole-tree comparison
would have reported two files a Satellite must never vendor. `ops/cs-tracker-adoption-probe.mjs` now
takes its **source** side from `TOKEN_CONTRACT_PATHS`, the nine token-contract paths named in one
exported constant with that reason beside it, and refuses if any of the nine is absent from
`contracts/` so the comparison cannot shrink silently. The **vendored** side is still hashed whole,
so a file a Satellite added to its own folder is still reported as extra. `CONTRACT_FILE_COUNT` keeps
meaning the token contract's nine and is now derived from that list rather than written as a literal.

## What holds the failure paths permanently

`ops/__tests__/registry-schema.test.ts` carries **79 cases**, one per row of the story's I/O matrix
plus one per refusal no matrix row names plus the wiring cases, and it sits inside the
already-blocking `test` job. The demonstration above proves the gate could fail on 2026-08-29; these
are what keep it able to fail after a later edit. Every refusal case is built from strings or from a
scratch tree under `tmpdir()`, so a test run never mutates the committed pair.

| What the block holds | Cases |
|---|---|
| The committed pair validates, and an empty list is data rather than a refusal | 4 |
| The dialect, the value sets, the URL pattern, the keyword set and the enum descriptions | 9 |
| Every refusal the matrix names, plus the escaping, the truncation, the byte order mark and the sorting | 36 |
| The pure parts: pointers on every violation, the audit, `else`, the schema form of `additionalProperties`, the uncountable-Registry refusal, the duplicate-id rule | 10 |
| The gate as the job runs it, through the real binary | 11 |
| The `ci.yml` wiring | 9 |

| Figure | Value | Nature |
|---|---|---|
| Cases added | **79** in `ops/__tests__/registry-schema.test.ts`, plus **6** in `ops/__tests__/cs-tracker-adoption-probe.test.ts` for the narrowing | **Observed 2026-08-29** at the review pass, counted per file by Vitest. It was 68 and 4 before that pass |
| Whole suite | **890 passed, 34 files** by `corepack pnpm test --run`, from 805 in 33 files before this story | **Observed 2026-08-29** at the review pass, on the development host. No browser started. The before figure is the after figure less the 85 cases this story added, rather than a second measured run. `AGENTS.md` stated 738 in 32 files, which was already stale at this story's baseline, and was corrected to the measured figure by this story |
| Typecheck | Pass, with the new test file inside the program | **Observed 2026-08-29** by `corepack pnpm typecheck`. `tsconfig.json:34-41` puts `**/*.ts` in the program, and the `.mjs` gate carries JSDoc types for it |
| Gate dependencies | None. `node:fs`, `node:path` and `node:url`, and no `node:process` | **Decision**, asserted by three standing cases reading the module's own source |

**A positive control sits beside all of them**: the committed pair must validate, and the shipped
schema must pass its own keyword audit, so the refusal cases cannot all be passing on a harness that
is broken in some other way.

**The keyword set is asserted twice, in two directions.** One case pins `KEYWORDS` as a literal, so a
widening is deliberate. A second walks the shipped schema with a collector written in the test rather
than with the module's own audit, pins the keywords it actually uses as a literal, and requires every
one of them to be in `KEYWORDS`. That is what stops a schema edit outrunning the validator: the
module's own audit would catch it at runtime, and these two catch it in the suite, where the failure
names the keyword.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **A red job holds no merge and no deploy on its own** | The job fails, and nothing mechanical follows until `registry-schema` is a required status check on `main`. `deploy.yml` fires on the same push with no `needs:`, so a deploy proceeds beside a red CI run. That is true of all six jobs in the file | **Observed 2026-08-29** by reading the two workflow files. Pending Operator action 2 |
| **The application list is empty, and `minItems` is deliberately absent** | The envelope this story ships carries zero entries, so `minItems: 1` would fail its own gate. Zero entries is a fact about the data, not a claim that the Estate is empty. **Story 2.5 tightens it** when it writes the entries, and that tightening is the one entry rule this schema knowingly leaves open | **Decision**, and asserted by a standing case so the absence is recorded rather than assumed |
| **Only two status combinations are constrained, and the enum descriptions must not imply more** | AD-5 fixes exactly two: `live` is required when `status` is `Live`, and forbidden when it is `Archived`. Everything else validates, and three combinations are worth naming because a reader will expect otherwise. **A `Complete` entry carrying a `live` URL validates**, which is why that value's description no longer says "not deployed": it said so while the schema enforced nothing of the kind. **A `Live` entry declaring `demo: not-deployed` validates**, though the two read as a contradiction. **An `Archived` entry declaring `demo: open` validates**, though it has no `live` URL to open. A schema may not claim more than it enforces, and tightening any of the three is a change to AD-5 rather than to this file | **Decision.** Found by the story's review pass, which is also when the `Complete` description was corrected |
| **Duplicate ids are invisible to the editor** | The rule cannot be expressed in draft-07, so AD-4's authoring half does not cover it. An author writing a second entry with an id they already used sees nothing until CI runs | **Decision**, stated above and in the refusal itself |
| **The gate says nothing about whether an entry is true** | A `description` that lies, a stale `status`, a `tech` array naming the wrong framework and a `live` URL that does not resolve all validate. FR-32's scheduled link check is Story 2.23 | **Decision** |
| **It reads the committed tree on a runner, not what is served** | A file changed at `https://cuatro.dev/contracts/registry.json` on the box, without a commit, is invisible here. The same limit `ops/contract-purity.md` records for its own gate | **Decision** |
| **The vendored comparison no longer covers the whole published surface** | `ops/cs-tracker-adoption-probe.mjs` compares the token contract's nine paths against `cs-tracker`'s vendored folder. Nothing compares the served `registry.json` against what a Satellite fetched, because a Satellite fetches it at build time and vendors nothing | **Decision**, forced by AD-4 and AD-14. Recorded above |
| **`enumDescriptions` is not a JSON Schema keyword** | It is VS Code's own annotation. An editor that does not implement it shows no per-value description, and every validator ignores it. Nothing asserts on it in either reader, so the cost of it being ignored is a missing hint and never a missing rule | **Decision** |
| **The schema is applied by a validator written here, not by `ajv`** | Adding a dependency was refused: the job installs nothing on purpose, so a package specifier reached at runtime is a crash on exactly the run the no-install argument exists to cover. The cost is that the implemented set is small and a keyword outside it is a refusal rather than a rule | **Decision.** The story's boundaries forbid adding a dependency, `ajv` included |
| **The job has never run on a GitHub runner** | Everything recorded here was observed by running the job's own command locally against the committed tree | **Observed 2026-08-29.** Pending Operator action 1 |
| **The editor half has not been observed** | AD-4's authoring half is an editor validating while the entries are written, and no CLI on this host can assert that VS Code marks a bad entry as it is typed. What is asserted here is that the hook is wired: `$schema` is required on the envelope with a fixed value, so deleting it is a red build. Whether an editor honours it is unobserved | **Observed 2026-08-29** for the hook, by a standing case. The editor's behaviour is **not observed at all**. Pending Operator action 5 |

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real run of the `registry-schema` job**, from the Actions run summary | Operator | The job has only ever run as a local command. Same shape as the action `ops/contract-purity.md` left open for its own job | _not done_ |
| 2 | **Make `registry-schema` a required status check on `main`**, in the branch protection settings | Operator | Until it is, AD-21's "blocking" means the job goes red and nothing stops. `ops/contract-purity.md`'s action 2 asks for the same thing for the other five jobs, and this is the sixth: they are worth doing in one sitting | _not done_ |
| 3 | **When Story 2.5 fills the application list, tighten `applications` with `minItems: 1`** | Story 2.5 | The one entry rule this schema deliberately leaves open. It cannot be set while the envelope is empty, and it should not be left open once it is not | _not done_ |
| 4 | **When a Satellite starts fetching `https://cuatro.dev/contracts/registry.json`, confirm it validates what it fetched** | Operator | This gate validates the committed file. A Satellite fetching at build time is reading a served copy, and nothing here sees that copy. Draft-07 was chosen precisely so a Satellite in any language can run the same schema | _not done_ |
| 5 | **Confirm AD-4's authoring half in the editor**: open `contracts/registry.json` in VS Code, paste an entry with `"status": "Live"` and no `live`, and check that the editor marks it before anything is saved | Operator | Half of AD-4 is the editor validating while entries are written, and no command on this host can assert it. Worth doing once before Story 2.5 writes the real entries, because that is the story where the editor half either saves time or is discovered not to work | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.
