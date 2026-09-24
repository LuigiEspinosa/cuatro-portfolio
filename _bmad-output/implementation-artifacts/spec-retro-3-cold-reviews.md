---
title: 'Retro 3: cold reviews of Story 1-8 (offsite backup) and Story 1-16 (contract publish), the other follow-up recommendations closed'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: 'f55424551077c5b0c0221bbc06c146850c3e57d8'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/backup-digital-library.md'
  - '{project-root}/ops/contract-serving.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1 retrospective action 3 is open: Stories 1-1, 1-8, 1-10, 1-16 and 1-19 each end
with `followup_review_recommended: true`, and nothing records it. Two carry code where a quiet defect
deletes or loses something: Story 1-8's offsite backup (`ops/library-backup.sh`, `ops/s3-object.sh`,
`ops/library-restore-verify.sh`) and Story 1-16's publish step (`packages/contracts-serve/publish.mjs`,
which removes a computed path recursively).

**Approach:** Operator ruling 2026-09-24, one package. Cold-review both with `bmad-code-review` over
each story's baseline through the commit that closed it, patch every real defect with a case that
fails on the baseline, and file the rest as DW entries. Close the recommendations of 1-1, 1-10 and
1-19 as superseded by use with a dated reason each, and those of 1-8 and 1-16 with the review's
result, then mark retro action 3 done. A backup-script fix reaches the box only through a new
Pending Operator action. DW-4, DW-5, DW-7, DW-13 and DW-18 stay as they are.

## Boundaries & Constraints

**Always:** Records take the UTC date and cite "Operator ruling 2026-09-24". Ledger entries are
appended, never edited. An ops row keeps its place and its Completed cell is dated. A record's dated
history is amended, never rewritten. Every changed behaviour has a case that fails on the baseline.
Decided state is never written as observed (NFR-9): the box runs the 2026-08-24 install until the
Operator reinstalls. No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything
written.

**Ask First:** nothing gates this run; it is unattended. Each open point is resolved from the
rulings, then from `DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**
- No SSH to the box and no change on it. No edit in `cs-tracker`, `list-wheel` or `digital-library`.
- No new dependency, no `ci.yml` change, no `/work` baseline regenerated, no push, no pull request.
- No change to DW-4, DW-5, DW-7, DW-13 or DW-18, and no fix for what DW-132 to DW-134 file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Config timeouts | the config sets `S3_CONNECT_TIMEOUT=7` and `S3_MAX_TIME=77` | the put, the round trip, the restore and a hand-run restore verify all call `curl` with 7 and 77 | N/A |
| Zero timeout | `S3_MAX_TIME=0` or `S3_CONNECT_TIMEOUT=0` | refused naming the variable, before any request | exit 1 |
| Signing | any put or get | no `openssl` argv carries key material, and the signature equals the Node reference, for a 64 character secret too | N/A |
| Linked `public/` | `public` is a directory link to the root, so `public/contracts` is the source on disk | refused as one path containing the other; the source keeps every file | throws, exit 1 |
| Live lock holder | the lock's `pid` names a running process | refused, lock kept, no archive | exit 1 |
| Config naming paths | the config sets `S3_OBJECT_CLIENT`, `LIBRARY_BACKUP_DIR` and `WORK` | ignored: the environment's client runs and the archive lands in the environment's directory | N/A |
| Over the verify ceiling | the archive is larger than `VERIFY_MAX_BYTES` | `restore=skipped-over-<n>b-ceiling`, exit 0, one PUT and one GET | N/A |

</frozen-after-approval>

## Code Map

- The reviews' own record: `spec-1-8-...md` and `spec-1-16-...md` § Follow-up review, 2026-09-24 (12
  and 10 patch items, every dismissal with its reason), and DW-132 to DW-134 in `deferred-work.md`.
- `ops/s3-object.sh`: `hmac_hex` `:105-109` hands the key to `openssl` as `-macopt hexkey:`, and the
  chain at `:136-140` starts from `AWS4` plus the secret; `:192-195` accept any whole number of seconds.
- `ops/library-backup.sh`: the config is read through the allowlist and `eval`ed unexported
  `:174-186`; the export block `:546-557` omits both timeouts; the lock `:257-283`; the verify ceiling
  `:591-593`. `ops/library-restore-verify.sh:80-103` has the same read and export list.
- `ops/__tests__/library-backup.test.ts`: `runBash` `:117-140`, `STUBS` `:195-331`, `makeBox`
  `:349-401`, `writeConfig` `:403-414`, `referenceSign` `:163-177`, `curlCalls` `:443-467`. The record
  pin `:1412-1426` asserts that the first table row naming `/usr/local/sbin/<name>` holds the committed
  digest.
- `ops/backup-digital-library.md`: intro `:17-20`, exits `:157`, retention `:286`, restore step 2
  `:379-382`, config rule `:427-428`, installed table `:473-477`, first offsite run `:545-550`, named
  limit 1 `:583-586`, Pending Operator actions `:645-662` with their maintenance rule.
- `packages/contracts-serve/publish.mjs`: `contains()` `:147-151` compares `resolve()` output, used at
  `:207`, before `host.remove(destination)` at `:254`.
- `packages/contracts-serve/__tests__/contracts-serve.test.ts`: helpers `:66-117` (`withRoot`,
  `surfaceWith`, `destinationIn`, `treeOf`, `refusalFrom`, `linkDirectory`); containment cases
  `:335-375`; `every refusal` pins ten `:530-611`; invoked-directly `:715-737`; second copy `:885-912`.
- `docker/__tests__/runner-stage.test.ts`: the build check is a substring `:139-144`; the planted
  negative at `:188-194` asserts on its own filtered string.
- `ops/contract-serving.md`: `:42` live state, `:62` `docker/` claim and file count, `:288` refusal
  row 1, `:379` consumers row, `:382` Windows row, `:799` invalidation row.
  `tests/e2e/contract-serving.pw.ts` logs each served path's observed status and type.
- `spec-1-1-...md`, `spec-1-10-...md`, `spec-1-19-...md`: `followup_review_recommended: true`; 1-1's
  `operator_actions_completed_on` is the precedent for a dated closure key. `sprint-status.yaml:583-591`
  holds action 3.

## Tasks & Acceptance

**Execution:**
- [x] `ops/s3-object.sh`: build HMAC-SHA256 on `openssl dgst -sha256` over a pipe (RFC 2104, a key
  over the 64 byte block hashed first), and require both timeouts to be at least 1. A key in argv is
  readable in `/proc/<pid>/cmdline` by every account on the box, and `--max-time 0` is no limit.
- [x] `ops/library-backup.sh`, `ops/library-restore-verify.sh`: export `S3_CONNECT_TIMEOUT` and
  `S3_MAX_TIME` beside the other S3 values, since the record documents both as config settings.
- [x] `ops/__tests__/library-backup.test.ts`: one case per backup row of the matrix, the signing case
  through an `openssl` wrapper that records argv, plus a 64 character secret checked against the
  reference. The record pin reads the Committed column exactly and fails when a script's Installed
  digest differs with no open Pending Operator row naming it.
- [x] `ops/backup-digital-library.md`: date rows 1 to 8, add row 9 (reinstall the three scripts, with
  verification and rollback steps), split the installed table into Committed and Installed, and amend
  the intro, the exit 0 row, the retention row, restore step 2, the config rule, the first offsite run
  line and named limit 1, each dated.
- [x] `packages/contracts-serve/publish.mjs`: compare containment on physical paths, the real path of
  the deepest existing ancestor, so a link cannot steer the recursive removal into the source.
- [x] `packages/contracts-serve/__tests__/contracts-serve.test.ts`: the linked `public/` case, the
  invoked-directly case through a linked directory on every host, and a second-copy search that also
  matches identical bytes, with a planted renamed copy.
- [x] `docker/__tests__/runner-stage.test.ts`: one `RUN`-line predicate for the real check and two
  planted negatives, the line removed and the line commented out.
- [x] `ops/contract-serving.md`: the six corrections spec-1-16's findings name, with the JSON types
  quoted from this package's container run.
- [x] Specs 1-1, 1-10, 1-19: `followup_review_closed_on: '2026-09-24'` and a dated closing section with
  the reason. Specs 1-8 and 1-16: the same key, their patch items checked, the outcome and the commit.
- [x] `sprint-status.yaml`: action 3 to `done`, with a dated comment.

**Acceptance Criteria:**
- Given each patch, when its new case runs against the baseline code, then it fails, and it passes on
  the package.
- Given the committed scripts differ from the box, when `ops/backup-digital-library.md` is read, then
  every Installed cell still shows the 2026-08-24 digest and date, and Pending Operator action 9 carries
  the exact reinstall, verification and rollback steps.
- Given the ruling, when the package lands, then all five specs carry a dated closure of their
  recommendation, retro action 3 reads done, and DW-4, DW-5, DW-7, DW-13 and DW-18 are unchanged.
- Given the verification set, when it runs, then typecheck, the full Vitest suite, literal
  conformance, the build and the pinned-container e2e run with no filter all pass.

## Spec Change Log

## Design Notes

**HMAC without argv.** `printf -v` builds the padded key's `\xHH` escapes inside the shell, and the
bytes reach `openssl dgst -sha256` on a pipe, inner hash then outer. `AWS4` plus a 64 character
secret is 68 bytes, past the block, so it takes the hash-the-key branch AWS's 40 character example
never reaches; R2 secret access keys are 64 hex characters, which is why the new case signs with one.

**Physical containment.** `realpathSync.native` of the deepest existing ancestor, the missing tail
re-appended, because the destination often does not exist yet. On Windows it also folds case.

**The record pin.** Held as it was, it could pass only by writing an uninstalled digest as installed,
or stay red until the Operator reinstalls. It now pins the Committed column exactly and holds any
difference from the Installed column to an open Pending Operator row naming that script.

**Closing a recommendation.** `followup_review_recommended: true` stays in each spec as the record
of what its dev pass recommended, and `followup_review_closed_on` beside it is the dated closure, on
the precedent of spec 1-1's `operator_actions_completed_on`. A reader counting open recommendations
reads the two together.

**Stated assumptions.** Keep at the split prompt: the Operator ruled one package. The review layers
ran in Codex and in fresh `claude -p` sessions, because this sub-agent has no Agent tool, which is the
code-review workflow's separate-session fallback; Codex's read-only sandbox refused to read the layer
instructions, so three layers ran in Claude. No halt needed `DESIGN.md`, `EXPERIENCE.md` or
`RESTYLE-SPEC.md`: nothing here renders.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes, the new cases among them.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0, and no shipped byte moves.
- The pinned container run in `AGENTS.md`, no filter: all pass, with eleven observed contract-serving
  types in its output.
- `bash ops/s3-object.sh selftest`: the golden vector matches byte for byte.
- The punctuation sweep over every written file, with a positive control: no hit.

## Review Triage Log

### 2026-09-24, Review pass

Six layers over `f554245..` plus this spec. The Blind Hunter ran in Codex, alone, after a first
Codex run ended with no output while Claude sessions were closing beside it; the other five ran in
fresh `claude -p` sessions, the ECC verification loop with only the build, typecheck and test
commands allowed. The design layer skipped itself: no surface, and its one motion match was the word
`lenis` in a dismissal list. The ECC loop reported build, types and tests passing, 1634 of 1634.

- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 0, medium 3, low 7)
- defer: 0
- reject: 15
- addressed_findings:
  - `[medium]` `[patch]` The record pin counted any numbered `_not done_` row in the whole file as the
    open reinstall action, so an unrelated open row could excuse a stale install. Scoped to the
    Pending Operator actions section, and the Installed cell must now carry a dated observation.
  - `[medium]` `[patch]` Action 9's backup step overwrote `.pre-2026-09-24` on a retry, which after a
    partial install would replace the only rollback copy with the new script, and a failed
    `install` could leave a mixed set. The copy is now kept if present, the install stops at the first
    failure, and the rollback covers steps 3 to 6 and ends on a `sha256sum` check.
  - `[medium]` `[patch]` Action 3's completed cell claimed the row as written, and the token's
    permission set was never read and the passphrase was filed after it reached the box. The cell now
    names both departures.
  - `[low]` `[patch]` The byte-level second-copy search read every tracked path, so a tracked file
    deleted in the working tree crashed the case with `ENOENT`. A candidate that is not a file is
    matched by name alone, and the planted case carries one.
  - `[low]` `[patch]` `bytes_escaped` was a seven line loop where `sed` on a pipe is one line and
    keeps the hex out of argv just the same (Ponytail).
  - `[low]` `[patch]` The runner-stage planted negative restated the predicate's regex; one
    `BUILD_LINE` now serves both (Ponytail).
  - `[low]` `[patch]` The second-copy helper took a `read` parameter only because the tracked paths
    were relative; they are resolved first now (Ponytail).
  - `[low]` `[patch]` The retention row marked a rule that was set and read back as Decided only.
  - `[low]` `[patch]` The contract-serving invalidation row still read as a future arrival; it now
    stands for a twelfth file.
  - `[low]` `[patch]` Design Notes did not say how `followup_review_closed_on` and the kept flag are
    read together.

The commit placeholders three layers flagged were the known substitution made at commit time, below.
Rejected, 15: the spec left `in-review` and its Verification listing commands without output (this
step sets `done`, and the results are below); DW-134 naming no interim mitigation (the console is
the Operator's); the reviews not naming their patch commits (they do below); a timeout with no upper
bound, or with digits past a bash integer (an explicit setting, refused either way); `realpathSync`
failing for a reason other than `ENOENT` (the removal cannot pass where the resolution could not);
a link swapped between the check and the removal (no concurrent actor at build time); `pnpm build`
inside a `RUN` line's comment, or on a continued line (deliberate or loud); an empty tracked file
matching an empty contract file (no contract file is empty); a missing timeout flag giving a
confusing message (the sibling case names it); `openssl` outside `/usr/bin` for the wrapper (every
signing case already needs it there); the one-line `%0*d` padding (it pads a 64 byte key with a
stray `0`); and the sprint-status comment's length (house style).

## Result

Verified 2026-09-24 on the final tree. `corepack pnpm typecheck`: exit 0. `corepack pnpm test --run`:
63 files and 1634 cases passing on the last run, and on four of the six full runs made on the patched
tree. The other two each failed two cases that spawn WSL's bash. The one captured had
`ops/__tests__/deploy-remote.test.ts` "deploys from a checkout that has no script yet" and this
suite's unchanged "refuses a key holding a space" each get an empty answer after 30 seconds, and the
next run passed. That reads as the host's WSL rather than the code, since CI runs native bash, and it
is DW-135. `node ops/literal-conformance.mjs`: exit 0. `corepack pnpm
build`: exit 0, `published 11 files at /contracts/`. `node ops/asset-budget.mjs`: the chunk totals
match the DW-15 reading to the byte (2,851,998 on disk, 830,256 gzipped, narrative 619,351), and
`/work`'s line read 2 and then 1 byte heavier on two builds, which is the build id inside the document,
so no reading was filed.
`bash ops/s3-object.sh selftest`: matches byte for byte in Git Bash and in WSL's bash 5.1. The
pinned container e2e run with no filter: 337 passed in 6.0 minutes on the final tree, and 337 in 6.3
minutes before the review patches, with the eleven served types quoted in `ops/contract-serving.md`.

Commits: `852f9e1` (the backup scripts, their suite and record), `abf3114` (the publish
step, its two suites and record), and this record commit.

## Suggested Review Order

**The publish cannot delete what it publishes**

- Entry point: containment on disk, so a linked `public/` cannot aim the removal at `contracts/`.
  [`publish.mjs:169`](../../packages/contracts-serve/publish.mjs#L169)

- Where a path is on disk, for a destination that often does not exist yet.
  [`publish.mjs:144`](../../packages/contracts-serve/publish.mjs#L144)

- The case that deleted the source on the baseline.
  [`contracts-serve.test.ts:397`](../../packages/contracts-serve/__tests__/contracts-serve.test.ts#L397)

**The backup's secret stays off argv**

- HMAC on a pipe; the long-key branch is the one R2 secrets take.
  [`s3-object.sh:119`](../../ops/s3-object.sh#L119)

- The wrapper that records every `openssl` argv, and the 64 character secret.
  [`library-backup.test.ts:650`](../../ops/__tests__/library-backup.test.ts#L650)

**The config's timeouts reach the client, and a zero is refused**

- Exported beside the other S3 values, in the job and in the verifier.
  [`library-backup.sh:555`](../../ops/library-backup.sh#L555)
  [`library-restore-verify.sh:106`](../../ops/library-restore-verify.sh#L106)

- At least 1, since `--max-time 0` is no limit.
  [`s3-object.sh:227`](../../ops/s3-object.sh#L227)

**The record can say what the box runs**

- Committed and Installed, both digests, until action 9.
  [`backup-digital-library.md:498`](../../ops/backup-digital-library.md#L498)

- The reinstall, with a kept copy and a rollback.
  [`backup-digital-library.md:699`](../../ops/backup-digital-library.md#L699)

- The pin that holds a difference to an open action.
  [`library-backup.test.ts:1598`](../../ops/__tests__/library-backup.test.ts#L1598)

**Checks that could not fail, now able to**

- Live lock holder, allowlist and verify ceiling, each seen red with its guard removed.
  [`library-backup.test.ts:1337`](../../ops/__tests__/library-backup.test.ts#L1337)
  [`library-backup.test.ts:1356`](../../ops/__tests__/library-backup.test.ts#L1356)
  [`library-backup.test.ts:1481`](../../ops/__tests__/library-backup.test.ts#L1481)

- A `RUN` line, not a comment, and a planted negative through the same predicate.
  [`runner-stage.test.ts:46`](../../docker/__tests__/runner-stage.test.ts#L46)

- Invoked through a linked directory, so the Linux runner sees the paths differ.
  [`contracts-serve.test.ts:756`](../../packages/contracts-serve/__tests__/contracts-serve.test.ts#L756)

- Copies matched by bytes as well as names.
  [`contracts-serve.test.ts:114`](../../packages/contracts-serve/__tests__/contracts-serve.test.ts#L114)

**The records**

- The eleven served types, observed.
  [`contract-serving.md:152`](../../ops/contract-serving.md#L152)

- The operator rows dated from their evidence.
  [`backup-digital-library.md:685`](../../ops/backup-digital-library.md#L685)
