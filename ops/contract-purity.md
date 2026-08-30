# The contract-purity gate

The written record of `ops/contract-purity.mjs` and the `contract-purity` job in
`.github/workflows/ci.yml`: what the gate checks and what it deliberately does not, the job's
properties and how far its blocking reach actually goes, the five refusals that are stricter than
AD-1's own regular expression with the reason for each, the probe demonstration with its output
verbatim, which standing cases hold the failure paths permanently, the stated limits, and the work
this file hands the Operator.

Written during Story 1-14 on **2026-08-25** (ISO 8601 UTC), against baseline commit `b1e02da`. The
figures and the refusal set below are as at the story's third review pass, on the same date.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md` and `ops/tailwind-adapter.md`
set: every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and
every date is ISO 8601 UTC.

## Why the gate exists at all

AD-1 says CI fails if any file under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`. AD-21 lists
"`contracts/` purity (AD-1)" among the gates that may never become warnings. `AGENTS.md:64-66` tells
every agent working in this repository that the rule is enforced, in those words.

**None of it was true before this story.** **Observed 2026-08-25** by reading
`.github/workflows/ci.yml` at `b1e02da`: the file carried four jobs and none of them was a purity
check. The only thing holding the boundary was the pinned nine-path list in
`packages/tokens/__tests__/tokens-contract.test.ts:881-897` and its two siblings, which fail on a
`.ts` under `contracts/` as a side effect of the list no longer matching, and which say nothing
about AD-1 to whoever reads the failure. The published surface is complete at v1.0.0 and Stories
1.16, 1.19 and 2.5 vendor it into other repositories, so the boundary needed a gate of its own
before the folder is consumed estate-wide.

## What the gate checks, and what it deliberately does not

| It checks | It does not check | Nature |
|---|---|---|
| Every file under `contracts/`, at any depth, against AD-1's extension rule | The contents of a file. A `tokens.css` full of JavaScript passes, and so does a file with no extension at all | **Decision.** AD-1's rule is about extensions, and a consumer decides what to do with a `.css` by its name. Both gaps are stated limits below |
| That the surface was actually read: a missing directory, an unreadable one, a directory under it that cannot be listed, and an empty one are all refusals | Anything about `packages/`, `app/` or the rest of the repository | **Decision.** One rule, one gate. The generator's location is asserted by `tokens-contract.test.ts` |
| That no entry under the surface is a link, the surface root included | What a vendored copy in another repository contains | **Decision.** AD-16 gives that job to a scheduled check reading the `Contract vX.Y.Z` header |
| The committed tree on the runner | What `https://cuatro.dev/contracts/` serves. That path does not exist yet and is Story 1.16 | **Decision.** Stated limit below |

## The job

`.github/workflows/ci.yml` gained one job, `contract-purity`. The `test`, `tokens-contract`,
`fonts-contract` and `rendered-output` jobs were not modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. The job itself carries no `continue-on-error`, no `|| true`, no `if:` and no soft exit, so a violation is a red job on every push and every pull request | **Decision.** AD-21, which names `contracts/` purity in its list of gates that may never become warnings, and `AGENTS.md` under "Policy" |
| **How far that reach goes** | A red job stops **nothing mechanically today**. GitHub holds a merge only on a **required status check**, and `.github/workflows/deploy.yml` fires on the same push to `main` with no `needs:` and no `workflow_run:`, so a red purity job does not hold a deploy either | **Observed 2026-08-25** for the deploy half, by reading both workflow files. The required-check half is a repository setting no command on this host can read; `spec-1-6`'s deferred finding records that the existing jobs are not required checks, and nothing in this story made `contract-purity` one. Stated here rather than implied. Pending Operator action 2 |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-25.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift. A standing case asserts the job declares no `on:` of its own |
| Position | After `fonts-contract`, before `rendered-output` | **Decision.** Jobs run in parallel, so the position is a reader convenience. The standing case pins the five job names as a set that happens to be ordered |
| Runner | `ubuntu-latest`, Node 22 through `setup-node` | **Decision.** The Node major that every other job in the file pins |
| Installs | Nothing. No `pnpm/action-setup`, no `pnpm install`, no pnpm cache | **Decision.** The checker imports only `node:` builtins, which `deploy.yml:13-31` already does for the Capacity Gate. It means the boundary is still reported on the run where `pnpm install --frozen-lockfile` fails, which is the run where a hurried fix is most likely to reach for the published folder, and it makes this the fastest job in the file |
| Ceiling | `timeout-minutes: 5` | **Decision.** Checkout, `setup-node` and a walk of nine files. Half the ceiling of the two contract jobs, which install first. Pinned by a standing case, because a figure this file states and nothing asserts is a figure that drifts |
| Command | `node ops/contract-purity.mjs`, with no argument and no `env:` | **Decision.** See "Nothing redirects it" below. A standing case pins the whole command line and asserts the job carries exactly one `run:` step, a second pins the two action steps beside it so a fourth step cannot appear in the one job that installs nothing, and a third holds the absence of a workflow-wide `env:`, which would reach this job while its own block stayed empty |
| Lines added to `ci.yml` | 35 added, **0 removed** | **Observed 2026-08-25** by `git diff --numstat b1e02da -- .github/workflows/ci.yml` |
| Parsed shape | The whole file still parses, and the job carries exactly `runs-on`, `timeout-minutes` and three steps: no `env`, no `if`, no `continue-on-error`, no `on` | **Observed 2026-08-25** by loading the file with the `js-yaml` already in the pnpm store as a transitive entry. The parse is a one-time reading, not a standing check: adding a YAML parser as a declared dependency to assert it would cost more than it holds, and the standing cases read the file as text. The three-step half is no longer a one-time reading: the third review pass added the case that pins the two action steps, since the `run:` case held one of the three and nothing held the others |
| The four existing jobs | Byte-identical to `b1e02da` | **Observed 2026-08-25**, by extracting each job block from `git show b1e02da:.github/workflows/ci.yml` and comparing it case-sensitively against the same block of the edited file, and corroborated by the 0 removed lines above |

## Nothing redirects it

No environment variable and no argument selects the directory the checker opens. The surface is
fixed in the source and resolved beside the module, so the checker works from any working directory
and no caller can point it somewhere else.

That is not a stylistic choice. `ci.yml:53-64` and `:113-124` had to pin two build inputs to the
empty string on each of the two contract jobs precisely to close that hole for the drift gate: a
redirected rebuild leaves `git status -- contracts/` clean and holds the gate green over real drift.
A redirectable purity gate has a worse version of the same hole, because a check that reads a
directory nobody published is green over anything.

Three standing cases hold it: one spawns the checker with a scratch surface carrying a probe as its
argument and requires exit 0 anyway, one asserts the module's own source contains no `process.env`
and reads no `process.argv` position other than `[1]`, which is the script path the invoked-directly
guard compares, and one asserts the job's `run:` line is the whole command with nothing appended.

The environment has a second door, and the third review pass closed it. `process.env` is the name
the case above knew, and `import { env } from 'node:process'` spells none of it: the specifier is a
`node:` builtin, so it passes the imports case too, and `env.ANYTHING` then reads the runner's
environment freely. The specifier itself is what the case now forbids, since nothing this checker
does needs `node:process` at all. A workflow-wide `env:` is the same hole one level out, on the
file rather than on the job, and is held by its own case.

**A refusal records its verdict before it writes.** **Decision.** `process.exit` runs inside the
write callback, deliberately: on a pipe, which is what a runner gives this process, exiting before
the flush truncates the refusal and leaves a red step with nothing explaining why. But a stream torn
down before that callback fires never calls it, and a process that then falls off the end of the
module exits 0. On a refusal that is the gate failing open on the one path that reports a violation,
so `process.exitCode` carries the verdict and the callback only decides when to leave. Found by the
third review pass and held by a case reading the module's source, because tearing a runner's stderr
down between the write and its callback is not something a portable spawn arranges.

**The injected directory reader is not a hole in that, and it is worth being exact about why.**
**Decision.** `inspect(directory, read)` takes an optional reader that lists one directory, on the
`main(argv, readFile = readFileSync)` precedent in `ops/capacity-gate.mjs`. It decides **how** a
directory is listed, never **which** directory is read: the path comes from `main`, which takes no
parameters at all. It exists because two of the checker's refusals cannot be constructed portably on
both a Windows authoring host and a Linux runner, a directory that refuses to be listed needing
`chmod` and an entry that is neither file nor directory needing `mkfifo`, and a refusal with no
standing case is a refusal that quietly stops working. Both are demonstrated below. The CI path
passes no reader, five standing cases run the real binary end to end, and one case asserts the
reader is handed exactly the directories the walk reached and no others.

## The five refusals stricter than AD-1's regular expression

AD-1 fixes a lower bound. A check may refuse more but never less, and **none of the five can turn a
violation into a pass**, which is the property that makes them safe to add. Each is recorded here
with its reason, as the story's boundaries require.

The applied pattern and the quoted one are built from a single list of extensions rather than
written out twice, so the two can never disagree while every refusal claims the applied rule
contains the quoted one. A standing case asserts that containment directly, over every extension
AD-1 names and both letter cases, which is the property the lower-bound argument actually rests on.

| Refusal | Why it is stricter | Nature |
|---|---|---|
| **The extension rule is applied case insensitively.** `contracts/probe.TS` fails | A case-insensitive checkout on macOS or on Windows serves `probe.TS` to a bundler as TypeScript, while AD-1's literal pattern reads it as a novel extension and lets it through | **Decision.** The authoring host for this contract is Windows |
| **A name Win32 strips back to an executable one fails.** `contracts/probe.ts.` and `contracts/probe.ts ` both fail, named for what they resolve to | Win32 strips trailing dots and spaces from a file name, so a checkout there serves `probe.ts.` as `probe.ts`. The rule is applied to the served name as well as the written one. The refusal says which of the two it is, so an operator is not left comparing two strings that look identical | **Decision**, same lower-bound argument as the case-insensitive match |
| **`.mts` and `.cts` fail**, named as extensions AD-1 does not list | Both are TypeScript that Node executes directly, and `tsconfig.json:34-41` puts `**/*.mts` in this repository's own program, so a `contracts/build.mts` is precisely the artifact AD-1 exists to keep out of the published surface while its literal pattern reads the name as a novel extension. The refusal says the rule does not name the extension and why it is refused anyway, rather than claiming a match AD-1 never made | **Decision.** Found by the second review pass. It is the same lower-bound argument as the two rows above, applied to the extension list rather than to how a name is served |
| **Any link under the surface fails**, named as an unresolvable publication | A link named `data.css` pointing at `packages/tokens/build.mjs` publishes executable code that the extension rule cannot see. AD-14 has the folder vendored by copy into seven repositories under the fixed name `cuatro-contracts/`, where a link resolves to something else or to nothing. The surface root being a link is refused for the same reason rather than followed | **Decision.** The root case is the one a trailing path separator silences on POSIX; see the mutation table |
| **A missing, unreadable or empty surface fails**, and so does a directory under it that cannot be listed | The failure mode of a purity gate is a green run over a tree nobody opened. A green run has to mean the surface was read, so the checker prints the number of files it read and refuses at zero. One level down is the same failure with a smaller blast radius: with `contracts/fonts/` unlistable and the three CSS files readable, a checker that swallowed the error would print "3 files, none executable" and exit 0 | **Decision.** Story 1-13 found four checks that could pass over nothing, and this is the same class |

One smaller refusal follows from the fifth and is noted rather than tabled: an entry that is
neither a file nor a directory nor a link is a refusal, because it is published and is not something
a consumer can read and parse.

**The refusal's closing advice follows the finding, not the count.** **Decision.** Only an
executable file is something to move under `packages/` and publish the output of. A link, a socket
and a directory that would not list are refusals too, and the first draft told an operator to move
all three under `packages/` and publish what they generate, which is an instruction none of them can
follow. Each finding now carries whether it is the extension rule firing, the header says "breaks
that rule" only when every finding does, and a standing case holds both wordings. The all-executable
wording is unchanged, which is why the probe output quoted below is still verbatim.

The third review pass found that claim was held more narrowly than it read. The case built two
fixtures whose findings were all of one kind, and `every` and `some` agree on a homogeneous set, so
rewriting the header test as `some` left the whole suite green while a refusal carrying a probe
beside a link told the link to go generate something. Flipping the per-finding flag on the socket or
on the unlistable directory survived the same way, because those two cases asserted only their path
and their reason. A mixed refusal now has a fixture of its own, and both of those cases assert the
wording they are entitled to as well as the wording they are not.

**Characters that forge or disguise a line are escaped where the message is built.** **Decision.**
A file named `evil\ncontracts/nothing-to-see-here: fine.ts` would otherwise forge a line inside the
refusal that reads like the checker's own prose, and could push the real offender out of an
operator's view. Five classes are escaped: the C0 controls and DEL; the C1 controls, U+0080 to
U+009F, which a terminal reads as escape sequence introducers and which a code point test that only
knew about the C0 range walked straight past; U+2028 and U+2029, which terminate a line for a
JavaScript reader and for some log viewers; the bidirectional overrides and isolates, which reorder
how a name is drawn so that `probe.ts` can be shown to an operator as a name with no executable
extension at all; and the code points drawn as nothing at all, the soft hyphen, the Arabic letter
mark, U+200B to U+200D and the byte order mark, which let two different published paths render as
one string in a log. The last two classes were added by the third review pass, which found that the
first draft of this paragraph claimed a name could not be drawn as something other than what it is
while four ways of doing exactly that were unescaped.

**Only the untrusted half of a reason is escaped, and the line is drawn on purpose.** **Decision.**
A finding's reason is this module's own prose in every branch but one: the unlistable-directory
refusal ends with whatever `code()` returned, which falls back to an error's own message when the
error carries no `code`, and a newline in that text forges a line exactly as one in a path does. It
is escaped where it is built, rather than where the message is assembled, because every other reason
quotes AD-1's expression and a blanket escape would print the rule an operator is being sent to with
a doubled backslash. Both halves have a case.

**The escaping is injective**, which is the property that makes it worth having and which the first
draft did not have: a backslash is escaped too, so a name written with a literal backslash and an
`n` cannot print as the same string as one carrying a real newline. Any path with no backslash and
no escaped code point, which is every path a consumer would ever publish, prints unchanged byte for
byte, and the probe output below is the check on that.

## The probe demonstration

A gate never observed to fail is not known to work. The probe was planted, run, its output recorded
here, and removed. **No probe exists in the tree at this story's closing commit**, which is why its
output lives in this file.

### The gate refusing

| Field | Value | Nature |
|---|---|---|
| The probe | `contracts/probe.ts`, one exported constant | **Decision.** The exact file AD-1 names first and the one `AGENTS.md:64-66` warns an agent against creating |
| Result | The job's command exited **1** and wrote the refusal to stderr, naming AD-1 and the path | **Observed 2026-08-25** on the Windows 11 development host, by running `node ops/contract-purity.mjs` against the working tree. Re-run and re-recorded after the review pass, which changed how the closing instruction is worded and wrapped |
| Removed | Yes | **Observed**, confirmed by `git status --porcelain --ignored=matching -- contracts/` being empty and the checker exiting 0 again |

The command's output, quoted verbatim:

```
contract purity: REFUSED
  AD-1: contracts/ is the published surface. A contract is an artifact a consumer in any
  estate language uses without executing Anchor-authored code, so CI fails on any file
  under contracts/ matching \.(ts|js|tsx|jsx|mjs|cjs)$. Generators live in packages/, which is
  never published.
  1 path under contracts/ breaks that rule:
    contracts/probe.ts: executable code, matching AD-1's \.(ts|js|tsx|jsx|mjs|cjs)$
  Move it under packages/, which is never published, and publish what
  it generates instead. A published folder is vendored by copy into
  seven repositories (AD-16), so nothing under it may need a runtime to be useful.
```

And the same command against the committed surface, which is the other half of what makes the
refusal meaningful:

```
contract purity: read contracts/, 9 files, none executable and no link (AD-1).
```

### What else the same probe fails, and why that is the intended state

`corepack pnpm test --run` was also run while the probe existed. **Observed 2026-08-25**, re-run at
the third review pass: **9 cases in 4 files failed**, out of 492. The same nine as at the second
pass: the six cases that pass added since read a scratch tree, the workflow file or the checker's
own source, so none of them sees a probe.

| File | Cases | What they read |
|---|---|---|
| `ops/__tests__/contract-purity.test.ts` | 5 | The committed surface passing, in process and through the binary, including the three subprocess cases that prove the real read path |
| `packages/tokens/__tests__/tokens-contract.test.ts` | 2 | The pinned nine-path published list, and the generator-out-of-the-surface case |
| `packages/fonts/__tests__/fonts-contract.test.ts` | 1 | The second pinned nine-path list |
| `packages/tokens/__tests__/tailwind-adapter.test.ts` | 1 | Its own executable assertion over the surface |

**Two independent readers of one rule is the intended state**, not duplication to be collapsed.
**Decision.** The pinned lists catch a file that appears under `contracts/` with a perfectly innocent
extension, which purity does not; purity catches an executable file at any depth in a surface the
lists have not been widened for, and says AD-1 while doing it. Importing the checker into
`tokens-contract.test.ts` would give one point of failure for two readings, so it was not done and
no line of those three test files was touched by this story.

## What holds the failure paths permanently

`ops/__tests__/contract-purity.test.ts` carries **61 cases**, one per row of the story's I/O matrix
plus one per refusal no matrix row names plus the wiring cases, and it sits inside the
already-blocking `test` job. A probe proves the gate could fail on 2026-08-25; these are what keep it
able to fail after a later edit. Every refusal case runs against a scratch tree under `tmpdir()`, so
a test run never mutates the committed `contracts/`.

**Every one of them was mutation-verified**, which is the only way to know an assertion is not a
green assertion left behind. **Observed 2026-08-25**: forty-three mutations were applied one at a
time to `ops/contract-purity.mjs` and `.github/workflows/ci.yml`, the file's suite was run against
each, and each mutation was restored afterwards. Forty-two were caught by the suite on this host.
The other one is the POSIX-only mutation, marked in the table and expanded under it. Twelve rows
were added by the second review pass and eleven by the third, each together with the cases that
catch them.

A caveat on the method, recorded because the third pass was where it bit. A mutation applied by
string replacement against a file whose line endings do not match the anchor replaces nothing and
reports as **survived** when it was never applied at all. `.gitattributes` pins `*.mjs` to LF and
names no `*.yml`, so the two files here take different anchors on a Windows host. Three of the
eleven rows below read as survivors on their first run for exactly that reason and were caught once
applied. A mutation that reports survived is worth re-checking against the file before it is
believed.

| What was broken | Mutation applied | Result |
|---|---|---|
| The case-insensitive match | The `i` flag removed from `EXECUTABLE` | **Caught.** 2 cases failed |
| The applied rule contains the quoted rule | `EXECUTABLE` written as a second literal that differs from `RULE` | **Caught** |
| The Win32 trailing strip | The name compared as written rather than as served | **Caught** |
| The link refusal | The per-entry link branch short-circuited | **Caught** |
| The empty-surface refusal | The zero-files refusal short-circuited | **Caught** |
| The unreadable-surface refusal | An unreadable surface returned as a clean one | **Caught** |
| The unlistable-directory refusal | The `readdir` catch replaced with a bare `return` | **Caught.** 2 cases failed |
| The surface named once | The root finding's path set back to `contracts`, printing `contracts/contracts` | **Caught** |
| The not-a-file refusal | The `!entry.isFile()` branch replaced with a `continue` | **Caught** |
| Every offender is reported | Only the first finding reported | **Caught** |
| The findings are sorted | `findings.sort()` skipped | **Caught**, by the case that lists a reversed directory |
| Control characters are escaped | Every code point printed as itself | **Caught** |
| The job is blocking | `continue-on-error: true` added to the job | **Caught** |
| The job is unconditional | `if: github.ref == 'refs/heads/main'` added to the step | **Caught** |
| The job runs the checker | The `run:` replaced with `echo purity` | **Caught** |
| The job runs it with no argument | `contracts` appended to the `run:` line | **Caught** |
| The job carries no `env:` | An `env:` block added to the step | **Caught** |
| The job's ceiling | `timeout-minutes` moved from 5 to 15 | **Caught** |
| The job exists | The whole job block deleted from `ci.yml` | **Caught** |
| The linked surface root is refused | `main()` resolving the surface with a trailing separator again | **Not caught on Windows.** See below |
| `.mts` and `.cts` are refused | The two extensions removed from the applied list | **Caught.** 2 cases failed |
| The Win32 trailing space, as opposed to the trailing dot | `WIN32_TRAILING` narrowed from `/[. ]+$/` to `/[.]+$/` | **Caught.** This is the mutation that survived the first review pass, which had a fixture for the dot and none for the space |
| The invoked-directly guard fails closed | The `realpathSync` fallback set back to `return false` | **Caught** |
| A backslash is escaped, so the escaping is injective | The backslash branch of `printable` removed | **Caught** |
| A line separator or a bidirectional override is escaped | Both code point tests removed from `printable` | **Caught** |
| The closing advice follows the finding | `allExecutable` pinned to `true` | **Caught** |
| A directory whose name matches the rule is walked, not refused | The rule applied to a directory entry as well | **Caught** |
| No dependency is reached by any route | `await import('js-yaml')` added to the module | **Caught** |
| The job is not skipped by another job's failure | `needs: test` added to the job | **Caught** |
| The job's runner | `runs-on` moved to `ubuntu-24.04` | **Caught** |
| The job's Node major | `node-version` moved to 20 | **Caught** |
| The job runs on the runner rather than in a container | `container: node:22` added to the job | **Caught** |
| A refusal's verdict outlives a lost write callback | The `process.exitCode` assignment removed, leaving `process.exit` in the callback alone | **Caught** |
| The error text in a reason is escaped | `printable(code(error))` narrowed back to `code(error)` | **Caught** |
| The C1 controls are escaped | The C1 test removed from `printable` | **Caught** |
| A code point drawn as nothing is escaped | The zero-width test removed from `printable` | **Caught** |
| The closing advice follows the finding, in a mixed refusal | `allExecutable` rewritten from `every` to `some` | **Caught.** This is the mutation that survived the second review pass, which had two homogeneous fixtures and no mixed one |
| A non-regular entry is not the extension rule firing | The socket finding's `executable` flag flipped to `true` | **Caught** |
| An unlistable directory is not the extension rule firing | The directory finding's `executable` flag flipped to `true` | **Caught** |
| The job set is read whatever a job is named | A job named `E2E-Extra` added to `ci.yml` | **Caught.** It survived until the job-id pattern stopped assuming lower case, and it is the worse half of that gap: the block reader would have swallowed such a job into the one above it |
| The job carries no fourth step | `- uses: pnpm/action-setup@v4` added to the purity job | **Caught** |
| No workflow-wide environment reaches the job | A top-level `env:` added to `ci.yml` | **Caught** |
| The environment is unreachable by any route | `import { env } from 'node:process'` added to the module | **Caught** |

**The one mutation this host cannot demonstrate.** `main()` resolves the surface as
`../contracts`, with no trailing separator, and that is load-bearing on the runner and invisible
here. On a POSIX filesystem a trailing slash forces resolution of the final component, so
`lstat("contracts/")` reports the **target** of a linked surface root rather than the link, and the
refusal the table above calls deliberate could never fire. Windows does not behave that way, so the
mutation leaves this host green.

It was therefore run where it matters. **Observed 2026-08-25** in
`mcr.microsoft.com/playwright:v1.62.1-noble` (Node v24.18.1), against a scratch tree whose
`contracts` is a symbolic link to a sibling directory holding one CSS file:

```
--- committed form (no trailing slash) ---
  contracts/ could not be read: it is a link, and the published surface must be the committed directory.
exit=1
--- mutated form (trailing slash) ---
contract purity: read contracts/, 1 file, none executable and no link (AD-1).
exit=0
```

The standing case `refuses a linked surface root through its own entry point, not only through
inspect()` runs on both hosts and is the thing that keeps this from coming back; the container run
above is what proves the case is not vacuous on the platform CI uses.

A positive control sits beside all of them: the committed surface must pass, counted with Node's own
recursive walk rather than with the checker's, so the refusal cases cannot all be passing on a
harness that is broken in some other way.

## The suite

| Figure | Value | Nature |
|---|---|---|
| Files under `contracts/` | **9** | **Observed 2026-08-25**, printed by the checker itself |
| Cases added | **61**, all in `ops/__tests__/contract-purity.test.ts` | **Observed 2026-08-25** at the third review pass, counted per file by Vitest. It was 43 at the first and 55 at the second |
| Whole suite | **492 passed, 22 files** by `corepack pnpm test --run`, up from the 431 in 21 files Story 1-13 recorded | **Observed 2026-08-25** at the third review pass, on the development host. No browser started |
| Typecheck | Pass, with the new test file inside the program | **Observed 2026-08-25** by `corepack pnpm typecheck`. `tsconfig.json:34-41` puts `**/*.ts` in the program, and the `.mjs` checker carries JSDoc types for it |
| Checker dependencies | None. `node:fs`, `node:path` and `node:url`, and no `node:process` | **Decision**, asserted by two standing cases reading the module's own source: one pins every static import specifier to `node:`, and one closes the other routes, a dynamic `import()`, `createRequire` and a bare `require()`. The job installs nothing, so a package reached at runtime is not a slow job but a crash on exactly the run the no-install argument exists to cover. `node:process` is refused separately and for a different reason: it is a builtin, so neither case would object, and it is the door to the environment that spells no `process.env` |

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **A red job holds no merge and no deploy on its own** | The job fails, and nothing mechanical follows from that failure until `contract-purity` is a required status check on `main`. `deploy.yml` fires on the same push with no `needs:`, so a deploy proceeds beside a red CI run. That is true of all five jobs in the file and is recorded for the other four in `spec-1-6`'s deferred findings | **Observed 2026-08-25** for the deploy half, by reading the two workflow files. Pending Operator action 2 |
| The gate reads the committed tree on a runner, not what is served | `https://cuatro.dev/contracts/` does not exist yet and is Story 1.16. A file added to the served folder on the box, or a link at the serving path, is invisible here | **Decision.** Pending Operator action 3 |
| It says nothing about the seven vendored copies | AD-16 gives that job to a scheduled check reading the `Contract vX.Y.Z` header across those repositories, which is Story 1.20 and Epic 2 | **Decision** |
| It is an extension rule, so a `.css` file containing JavaScript passes | That is AD-1's rule, deliberately: a consumer decides what to do with a file by its name, and widening this into a content sniffer would make the gate an opinion rather than a boundary | **Decision** |
| **A file with no extension at all passes too** | `contracts/build` carrying a shebang matches nothing in `\.(ts\|js\|tsx\|jsx\|mjs\|cjs)$`, and refusing every extensionless file would refuse a `LICENSE` or a `README` that a later story may well publish. It is the same boundary as the row above: the rule is about what a name claims, not about what a file holds | **Decision** |
| **Two names that differ only in case are not refused** | `contracts/tokens.css` beside a `contracts/Tokens.css` collide on the case-insensitive checkout the case-insensitive match above exists for, and one of the two silently loses in a vendored copy. Refusing a collision is a different rule from AD-1's, about what a folder holds rather than what a name claims, and AD-16 gives cross-repository publication to a scheduled check. Named here because the argument for the first stricter refusal is the argument that makes this gap worth writing down | **Decision.** Found by the second review pass |
| The empty-surface refusal can only fire on a working tree, never on a fresh clone | Git does not track an empty directory, so a commit that deletes every published file deletes the folder too, and the missing-directory refusal is what fires instead. Both are refusals, which is the point; the distinction only matters when reading a log | **Observed 2026-08-25**, by reasoning about git's index and confirmed by the two standing cases |
| The workflow wiring is asserted inside the `test` job | If the `test` job were ever narrowed or removed, the assertions that the purity job still exists and is still blocking would go with it. The job itself would keep running; nothing would notice if it stopped | **Decision**, inherited from the same shape in `ops/__tests__/capacity-gate.test.ts` |
| The job has never run on a GitHub runner | Everything recorded here was observed by running the job's own command locally against the committed tree, and the one POSIX-specific behaviour in the container above | **Observed 2026-08-25.** Pending Operator action 1 |
| Two refusals are exercised through an injected directory reader rather than through a real filesystem | An unlistable directory needs `chmod` and a non-regular entry needs `mkfifo`, neither of which exists on the Windows authoring host. The alternative was a case that skips itself where the published folder is authored. The reader lists a directory and selects none, and five cases run the real binary | **Decision**, with the mechanism stated above |
| The invoked-directly guard's fallback is asserted on the module's source, not by running it | Reaching it needs a path the operating system will not resolve while still being the script Node just executed, which no portable call arranges on both hosts. The property the case pins is the one that matters: the fallback compares the two paths and never answers `false`, because a guard that decides it was not invoked directly runs nothing and exits 0, which is the gate failing open | **Decision.** Found by the second review pass, which is also when the fallback stopped being a `false` |
| The link refusal falls back to a directory junction where a file symlink is not permitted | A Windows host without Developer Mode refuses a file symlink. The case then links a dedicated empty directory instead, which `lstat` reports as a link just the same, rather than skipping itself. File symlinks are permitted on this host, so the primary fixture is the one that ran here | **Observed 2026-08-25** |

## The surface is eleven files from 2026-08-29

**Observed 2026-08-29**, Story 2-3. `node ops/contract-purity.mjs` now reports
`read contracts/, 11 files, none executable and no link (AD-1)`. The nine in the probe output above
were the token contract; the two added are `contracts/registry.json` and
`contracts/registry.schema.json`, the App Registry and its schema (AD-4). Both are JSON, so the
extension rule is unaffected and nothing in this gate changed. The figure `9` in the table under
"The suite" is left in place with its own date, as this file's maintenance rule requires.

**They are the first hand-authored files on the published surface.** Everything else under
`contracts/` is generated. That does not weaken AD-1, which is about what a consumer executes rather
than about who wrote the file, and it is why `packages/tokens/build.mjs:3-5` was corrected in the
same story: it claimed nothing under `contracts/` is hand-edited.

**One case in `ops/__tests__/contract-purity.test.ts` moved.** The job-set case pinned five job
names, and `ci.yml` now carries six: `registry-schema` was added after `contract-purity` and is the
Registry's own blocking gate. No other line of that file was touched, and the case that holds the
existing jobs' steps is unchanged. `ops/registry-schema.md` is the new job's record.

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here rather
than left in prose, in the shape `ops/token-contract.md`, `ops/font-contract.md`,
`ops/tailwind-adapter.md` and `ops/rendered-output-harness.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real run of the `contract-purity` job**, from the Actions run summary | Operator | The job has only ever run as a local command. The runner figure and the real behaviour of `setup-node` without a cache are unknown until it runs once. Same shape as the actions Stories 1-11 and 1-13 left open for their own jobs | _not done_ |
| 2 | **Make `contract-purity` a required status check on `main`**, in the branch protection settings | Operator | Until it is, AD-21's "blocking" means the job goes red and nothing stops. A merge is not held, and `deploy.yml` fires on the same push with no `needs:`, so a deploy is not held either. The same is true of the four existing jobs, so this is worth doing for all five in one sitting; the purity gate is the one that guards a folder seven repositories copy | _not done_ |
| 3 | **When Story 1.16 serves `contracts/` at `https://cuatro.dev/contracts/`, confirm the served path is the committed folder and not a link to it** | Operator | This gate refuses a link under the surface in the repository and cannot see one on the box. A serving path that is a link is the same defect one deploy further along | _not done_ |
| 4 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Still open from Stories 1-10, 1-12 and 1-13, and this story moves it again. `AGENTS.md:52-53` describes CI as "typecheck and tests only" against a file that now has five jobs. `AGENTS.md:64-66` states the purity rule as a fact, which this story finally makes true, so that line is now correct and was not edited | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.
