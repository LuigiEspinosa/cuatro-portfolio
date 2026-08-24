---
title: 'An offsite backup path for digital-library'
type: 'feature'
created: '2026-08-24'
status: 'awaiting-operator'
baseline_commit: 'ed9c816c1d4efac219b385aaad2d71fb355c20d6'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
operator_actions:
  - 'Create a Cloudflare R2 bucket, not public, and note the account id from its endpoint https://<account-id>.r2.cloudflarestorage.com.'
  - 'Read the current R2 free tier for storage and for Class A and Class B operations, and correct the cost table in ops/backup-digital-library.md if the published numbers have moved, because this build could not reach the console and the $0.00 there is a decision rather than an observation.'
  - 'Create an R2 API token scoped to that one bucket with Object Read and Write and nothing else, generate a passphrase of at least 32 random characters, and store the Access Key ID, the Secret Access Key and the passphrase in the password manager before writing any of them to the box.'
  - 'Write /etc/cuatro/library-backup.env on 177.7.52.248 owned root:deploy mode 0640 inside /etc/cuatro owned root:root mode 0755, holding S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and BACKUP_PASSPHRASE, using an editor rather than echo so the secret never reaches the shell history. The group must be deploy, because the cron entry runs as deploy and a root-only 0600 file makes every night exit 1 with offsite=config-unreadable.'
  - 'Add an object lifecycle rule to the bucket that deletes objects under the prefix digital-library/ after 30 days, because the scripts never delete an object and offsite retention exists nowhere else.'
  - 'Run the job once in the shape cron runs it, as deploy: env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh /usr/local/sbin/library-backup.sh. Not sudo and not from an interactive shell. It must exit 0 with offsite=ok-digital-library/library-..., roundtrip=sha256-match and restore=verified.'
  - 'From a machine that is not the box, download one object from the bucket and decrypt it with the passphrase as stored in the password manager, then list the archive, then delete both files. This is the only check that catches a passphrase mistyped into the password manager, because encryption and verification on the box both read the same value from the same file.'
  - 'Paste the summary line from the first offsite run into ops/backup-digital-library.md under a First offsite run heading with its UTC date, replace the projected object size in the cost table with the measured one, record the outcome of the off-box decrypt, and update named limits 1, 2 and 5 to describe the state that now holds.'
deferred:
  - summary: >-
      No cron job on the box has its exit status monitored by anything, which is the actual
      reason the library-backup.sh failure survived 25 nights. Fixing one script does not
      fix it.
    evidence: |-
      Observed 2026-08-24. Both `deploy` crontab jobs append stdout and stderr to a log
      under `/home/deploy/backups/<project>` and nothing reads either log. There is no
      `MAILTO`, no local MTA was observed, and `ops/monitoring.md`'s probes are external
      HTTP and certificate checks against hostnames, which cannot see a backup job at all.
      This story makes the signal correct rather than visible: the new job emits exactly one
      greppable summary line and an exit status that agrees with it, so a monitor now has
      something unambiguous to read, and nothing reads it. The cheap closure is the same
      shape as the off-box certificate-age check already in the ledger. It is
      `ops/monitoring.md`'s file and another story's decision.
    location: 'ops/backup-digital-library.md'
    severity: medium
  - summary: >-
      The box now runs two backup idioms, and `cuatro-backup.sh` is the one still
      uncommitted, unencrypted, untested and local only. The three scripts this story
      committed would cover it with a change of source command.
    evidence: |-
      Observed 2026-08-24. `/home/deploy/cuatro-backup.sh` is still an uncommitted script on
      the box running `pg_dump -U tracker -Fc tracker` at 03:30 with its own inline prune.
      Story 1-7 verified its retention arithmetic reconciles, so it works, and it still has
      the same three defects this story was written to remove from its sibling: no copy
      leaves the box, nothing is encrypted, and no committed test covers it. `ops/s3-object.sh`
      and `ops/library-restore-verify.sh` are deliberately generic about what they move.
      Pointing the same path at `pg_dump` output needs a Postgres flavoured restore check and
      nothing else. Not done here because this story's boundaries name `digital-library` and
      only `digital-library`, and because the same argument applies to `cs-tracker`'s and the
      Anchor's Postgres, neither of which has any backup at all. That is one story, not three.
    location: 'ops/backup-digital-library.md'
    severity: medium
  - summary: >-
      No CI job reads a shell script, so a syntax error in any committed `ops/*.sh` is caught
      by nothing until it runs on the box at 03:45.
    evidence: |-
      `.github/workflows/ci.yml` runs `pnpm typecheck` and `pnpm test --run` and nothing else,
      and `tsconfig.json:34-41` excludes shell scripts from typecheck entirely. This story's
      suite reads the scripts as text and executes them through stubs, which catches a great
      deal, but `bash -n` and the punctuation sweep are both commands a person ran once by
      hand. The repository has carried committed shell scripts since Story 1-5 and the gap is
      older than this story, so it is not this story's defect. A `bash -n` step over
      `ops/*.sh` is one line, and AD-21 makes it blocking if it is added at all. Adding a CI
      job is a scope decision for a story that owns CI rather than one that owns a backup.
    location: '.github/workflows/ci.yml'
    severity: medium
  - summary: >-
      Both backup logs on the box grow without bound and nothing truncates them, and the new
      job deliberately writes more per run than the one it replaces.
    evidence: |-
      Observed 2026-08-24. Both `deploy` crontab entries append to
      `/home/deploy/backups/<project>/backup.log`, no logrotate stanza covers either path, and
      the retention prune is correctly scoped to `library-*` so it can never remove the log
      beside the archives. The volumes are small, one line per night per job, so this is a
      slow leak rather than a risk, and it predates this story: `cuatro-backup.sh` has the
      same shape. Recorded because the same closure covers both jobs and because the entry
      about nothing monitoring the exit status would naturally be solved by whatever reads
      these files.
    location: 'ops/backup-digital-library.md'
    severity: low
---

<intent-contract>

## Intent

**Problem:** `digital-library` is AD-10's declared non-Postgres exception and its only backup is
`/home/deploy/library-backup.sh`, an uncommitted script that has aborted on line 13 every night
since 2026-07-31 (`USER: unbound variable` under `set -u` in cron), so nothing is compressed,
nothing is pruned, every snapshot is root-owned, and every copy sits on the box it protects.
AD-10 calls a declared store with no equivalent offsite path unbacked data, which is a defect.

**Approach:** Replace it with a committed, tested backup path: a checkpointed SQLite snapshot plus
the media directories, encrypted, pushed to an S3-compatible bucket outside the VPS, and proved by
a real restore rather than by an exit code. The bucket, its credentials and its passphrase are a
vendor-console act, so this build ships and installs everything that runs and leaves the
credential half to the Operator.

## Boundaries & Constraints

**Always:**
- The live store is read, never written. The snapshot is taken with `sqlite3 .backup`, never a file
  copy: `library.db` is one 4096-byte page and the entire database lives in the WAL, so a file copy
  captures an empty database.
- Every artifact that leaves the box is encrypted before it leaves. Offsite storage is third-party
  and the database holds a user row and a session row.
- Decided state is never written as observed state (NFR-9). Each claim in the record is marked as
  one or the other, and a verdict that was not tested says so.
- Fail closed and loudly. A run that cannot reach the offsite half exits non-zero: a green exit
  would assert coverage the estate does not have. The pre-existing bug is not that the script
  failed, it is that it failed halfway and reported nothing usable.
- Dates are ISO 8601 UTC. The box is `Etc/UTC`.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and
  no emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The box at `177.7.52.248` cannot be reached, or `deploy`'s passwordless sudo has gone.
- Closing the story would require writing to `/home/deploy/digital-library/data` or restarting any
  `digital-library` container.

**Never:**
- Never install a package or a third-party binary on the box. No `restic`, no `rclone`, no `apt`.
  Everything the nightly job runs is committed here and reviewed here.
- Never write `ops/capacity-gate.yml`, `ops/capacity-measurement.md`, the shared
  `/home/deploy/cs-tracker/Caddyfile`, the `DOCKER-USER` chain, or `_bmad-output/.../sprint-status.yaml`.
- Never generate sustained artificial load. The capacity measurement week closes 2026-08-24T21:00Z
  on this box. The concurrency proof is a sub-second scratch database, nice'd, and its exact UTC
  window is recorded so Story 1-6 can see it.
- Never put a credential, a passphrase or a bucket name that is a secret into the repository.
- Never delete an object offsite from a script. Offsite retention is a bucket lifecycle rule, which
  keeps the token's blast radius at write-only.
- Never claim a rendered-output or browser check. Playwright arrives in Story 1-10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Signed request | Fixed key, secret, date, region, host, key and payload hash | Authorization header equals the golden SigV4 vector, byte for byte | N/A |
| Unsafe object key | Key holding a space, `..`, or a leading `/` | Refused before any network call, naming the key | Exit non-zero, no request made |
| Missing credential | Config present, `SECRET_ACCESS_KEY` empty | Names the missing variable | Exit non-zero, no request made |
| Non-2xx from the endpoint | Endpoint answers 403 | Names the method, the key and the status | Exit non-zero, no partial output file left |
| Offsite not configured | No config file on disk | Local snapshot, verify, archive and prune all complete, then one line naming the file the Operator must create | Exit 75, local half intact |
| Snapshot fails its integrity check | `PRAGMA integrity_check` returns anything but `ok` | Run aborts before anything is uploaded | Exit non-zero, no object written |
| Round trip disagrees | Object downloads with a different SHA-256 than was uploaded | Run fails after the upload rather than reporting success | Exit non-zero, local copy kept |
| Archive over the size ceiling | Archive larger than `MAX_ARCHIVE_BYTES` | Refuses to upload, names both sizes | Exit non-zero, local copy kept |
| Redis stops being empty | `DBSIZE` non-zero or a `dump.rdb` in the volume | Summary line reports it rather than staying silent | Reported, run continues |
| Retention prune | Files older than the window, in all three generations of naming | Only `library-*` files under the backup directory older than the window are removed | N/A |

</intent-contract>

## Code Map

Gathered 2026-08-24 over SSH as `deploy@177.7.52.248` against `ed9c816`, read-only.

- **Reaching the box.** The Windows OpenSSH client holds no key for it. Every command runs through
  WSL as `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 '<command>'`. `wslpath` mangles Windows paths
  passed from PowerShell, so use the `/mnt/c/...` form directly. `deploy` is in `docker` and `sudo`
  with passwordless sudo (verified `sudo -n true`).
- **What the box has, verified 2026-08-24:** `sqlite3`, `gpg` (2.4.x, `--batch --symmetric` verified
  round trip), `zstd`, `curl`, `openssl 3.0.13` (`dgst -sha256 -mac HMAC -macopt hexkey:` verified),
  `tar`. **No `node`, no `restic`, no `rclone`, no `age`.** Ubuntu 24.04.4, 2 vCPU, 80 GB free.
- **The store.** `/home/deploy/digital-library/data`, root-owned, bind-mounted into
  `digital-library-api-1` at `/data`. `library.db` 4096 bytes mtime 2026-07-30T06:09:04Z,
  `library.db-wal` 152472 bytes mtime 2026-08-14T09:16:05Z, `library.db-shm` 32768 bytes.
  `books`, `covers` and `inbox` all exist and are all 0 bytes.
- **Redis holds nothing and never has.** Verified 2026-08-24: `DBSIZE` 0, `INFO keyspace` empty,
  `appendonly no`, `save` at the stock `3600 1 300 100 60 10000`, and
  `/var/lib/docker/volumes/digital-library_redis_data/_data` is an empty directory, so no `dump.rdb`
  has ever been written. That is the evidence the record's cache verdict rests on.
- **The script being replaced:** `/home/deploy/library-backup.sh`, uncommitted, 17 lines. Line 12
  `sudo sqlite3 "$DB" ".backup '$OUT'"` runs; line 13 `sudo chown "$USER:$USER" "$OUT"` aborts under
  `set -u` because cron sets no `USER`. Prune pattern is `library-*.db.gz`, which matches none of the
  25 uncompressed `.db` files it has been leaving since 2026-07-31.
- **`crontab -l` for `deploy` holds exactly two jobs**, `cuatro-backup.sh` at 03:30 and
  `library-backup.sh` at 03:45, both appending to a log under `/home/deploy/backups/<project>`.
  Root has no crontab.
- `ops/routing-inventory.md:1205-1336`: Story 1-7's read-only pass. Carries the full evidence:
  the 25 files, their two distinct SHA-256 contents, the `PRAGMA integrity_check` results, the
  reconciliation against `cuatro-backup.sh`, and the one verdict it could not reach, that a snapshot
  is consistent under a **concurrent writer**. That is this story's to settle. Do not duplicate that
  evidence here; add a dated pointer to it.
- `_bmad-output/implementation-artifacts/deferred-work.md`: two entries this story answers, both
  from spec 1-7: the `library-backup.sh` failure and the estate-wide absence of any offsite copy.
  Append the resolution rather than editing them.
- **Install precedent:** Story 1-5 put `capacity-sampler.sh` in `/usr/local/sbin` from a checkout and
  proved the install by `sha256sum` against the committed file. `/usr/local/sbin` already holds
  `cf-origin-firewall.sh` (Story 1-3) and the sampler.
- **Test precedent:** `ops/__tests__/capacity-summary.test.ts` reads `ops/capacity-sampler.sh` itself
  and asserts its schema literal, because a shell script is the one artifact `tsconfig.json:34-41`
  cannot typecheck. `vitest.config.ts` has no `include` filter, so a new file under `ops/__tests__/`
  is collected with no config edit.
- **Bash is reachable from the test runner on both platforms**, verified 2026-08-24 by spawning
  `bash` from Node on this host: it resolves to `C:\WINDOWS\system32\bash.exe`, which is WSL's bash,
  and reads a script and a working directory given as `/mnt/c/...` paths. CI is `ubuntu-latest`,
  where the same spawn needs no path mapping. WSL here has `openssl 3.0.2` and **no `sqlite3`**, so
  tests that exercise the backup orchestration stub the box binaries on `PATH`.
- `.gitattributes:14` already pins `*.sh` to LF, which is what keeps a fresh clone from handing
  `scp` a CRLF script.
- Read-only sources: `epics.md:1396-1431` (this story), `ARCHITECTURE-SPINE.md:136` (AD-10),
  `:255` (NFR-4's recorded-decision rule), `:423` (C-2).

## Tasks & Acceptance

**Execution:**
- `ops/s3-object.sh`: an S3-compatible object client in bash: `put`, `get`, `selftest`. AWS
  SigV4 over `curl` and `openssl`, payload-signed single request, headers `host`,
  `x-amz-content-sha256`, `x-amz-date`. Validates the object key against `^[A-Za-z0-9._/-]+$` with
  no `..` and no leading `/` before any network call. `selftest` recomputes the golden vector and
  compares. No `list` and no `delete`: retention offsite is a lifecycle rule.
- `ops/library-backup.sh`: the nightly job. Stages in order: snapshot with
  `sudo sqlite3 "$DB" ".backup"`, take ownership with `id -u`/`id -g` rather than `$USER`,
  `PRAGMA integrity_check` on the snapshot, tar the snapshot plus `books`, `covers` and `inbox`,
  gzip, `gpg --batch --symmetric --cipher-algo AES256`, size ceiling check, `put`, `get` the object
  back and compare SHA-256, deep restore verification below the verify ceiling, local prune across
  all three naming generations, and one summary line carrying every stage's verdict. Reports the
  Redis emptiness check rather than assuming it. Exits 75 with the remedy named when the config file
  is absent, after the local stages have completed.
- `ops/library-restore-verify.sh`: the real restore, callable on its own and called by the nightly
  job. Takes an object key, or defaults to the newest local archive's key. Downloads into a scratch
  directory, decrypts, untars, opens the database, asserts `PRAGMA integrity_check` is `ok`, prints
  the schema object count and the row count of every table, and removes the scratch directory.
  Never writes outside the scratch directory.
- `ops/__tests__/library-backup.test.ts`: one case per matrix row. A Node reference implementation
  of SigV4 derives the expected signature from first principles and pins the golden vector, and the
  bash implementation is executed against the same inputs, so a change to either without the other
  fails. Orchestration cases run `ops/library-backup.sh` against a `PATH` of stubs for `sqlite3`,
  `sudo`, `gpg`, `docker` and `curl`, in a scratch directory.
- Box install: three scripts to `/usr/local/sbin` mode 0755, `sha256sum` matched against the
  committed files, `selftest` run and recorded, crontab repointed at the installed path, and
  `/home/deploy/library-backup.sh` renamed to `.retired-2026-08-24` rather than deleted.
- Concurrency proof, settling Story 1-7's open verdict: on a scratch WAL database in `/tmp`, run a
  writer while `sqlite3 .backup` runs, then integrity-check and row-count the result. Nice'd,
  sub-second, its UTC window recorded.
- `ops/backup-digital-library.md` is the record: what is backed up and what is deliberately not,
  the Redis verdict with its evidence, the method and why it is not `restic`, the offsite provider
  and its recurring cost as a named decision against NFR-4, the restore procedure, the store and its
  path in the form Epic 2 needs for the Registry `tech` array and Epic 4 needs for the rebuild, the
  Operator actions still owed, and the named limits.
- `ops/routing-inventory.md`: one dated pointer in the backup coverage section to the new record,
  so a reader landing on Story 1-7's evidence is not left with a verdict that has since changed.
  Nothing else in that file is touched.
- `_bmad-output/implementation-artifacts/deferred-work.md`: append the resolution of the two 1-7
  entries this story closes, and append anything this build finds that belongs to no story.

**Acceptance Criteria:**
- Given AD-10 requires the declared exception to carry its own offsite path, when the record is
  read, then the store, the method, the destination, the retention on both sides and the recurring
  cost are all written down, and every value is marked observed or decided.
- Given the estate learned from Story 1-7 that a backup reporting failure while working is worse
  than one that is simply broken, when the nightly job runs, then it emits exactly one summary line
  naming every stage's verdict, and its exit status agrees with that line.
- Given the Operator half cannot be performed by an agent, when the build finishes, then everything
  that runs is committed and installed, the story is left awaiting the Operator rather than reported
  as done, and what is owed is enumerated as imperative instructions.
- Given Story 1-7 could not establish that `sqlite3 .backup` is consistent under a concurrent
  writer, when this story closes, then that verdict is settled by a test against a scratch database
  and recorded with its evidence, or the record states plainly that it is still untested.

## Spec Change Log

## Review Triage Log

### 2026-08-24, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 25: (high 3, medium 14, low 8)
- defer: 2: (high 0, medium 2, low 0)
- reject: 2: (high 0, medium 0, low 2)
- addressed_findings:
  - `[high]` `[patch]` The offsite half could never run. The record's Operator action created the
    config root-owned 0600 inside a 0700 directory while the cron entry runs as `deploy`, so every
    night would have taken the not-configured branch and exited 75 after the Operator had done
    everything. Ownership model changed to `0755` on the directory and `root:deploy` `0640` on the
    file, and an unreadable config is now a distinct reported state rather than an absent one.
  - `[high]` `[patch]` Acceptance validated the wrong execution context. Operator action 6 ran the
    job under `sudo` as root while cron runs it as `deploy`, which is the exact mismatch that hid
    the failure this story replaces. Every box run and the acceptance step now use the cron shape,
    and a root run no longer leaves root-owned archives in the backup directory.
  - `[high]` `[patch]` The restore proved almost nothing. Only `PRAGMA integrity_check` was
    asserted; the schema and row counts were printed and never read, so a valid but empty database,
    which is exactly what a naive `cp` of this store produces, passed as verified. The verifier now
    asserts every value it reads, and the same schema floor was added to the snapshot stage.
  - `[medium]` `[patch]` `operator_actions` was missing from the spec frontmatter, so the owed work
    existed only as a table in the ops record. Added as eight imperative strings.
  - `[medium]` `[patch]` No timeouts on `curl` or on the Redis `docker exec` probe, so a stalled
    endpoint or a wedged daemon hung the nightly job with no summary line.
  - `[medium]` `[patch]` A non-numeric size ceiling or retention window failed open: with no
    `set -e` the comparison returned 2, the condition read false, and the summary still recorded
    `within-ceiling`. All four numeric knobs are validated at preflight.
  - `[medium]` `[patch]` `prune_local` was called bare on the exit-75 path, so a failed prune broke
    the story's central contract that the summary line and the exit status agree.
  - `[medium]` `[patch]` Only `EXIT` was trapped, and bash does not run an `EXIT` trap on an
    untrapped fatal signal, so a `SIGTERM` left the verifier's decrypted plaintext database behind.
  - `[medium]` `[patch]` No single-instance guard, while the record instructs the Operator to run
    the job by hand. Added, with a refusal to overwrite an existing archive.
  - `[medium]` `[patch]` The config was sourced with `.`, so a stray assignment could clobber the
    scratch path the `EXIT` trap removes. It is now read through an allowlist in a cleared
    environment and cannot set any path or executable.
  - `[medium]` `[patch]` `S3_ENDPOINT` and `S3_BUCKET` were unvalidated, so a typo produced a
    signed URI disagreeing with the request and a nightly 403 nobody reads.
  - `[medium]` `[patch]` `tar` exits 1 on "file changed as we read it", which would have aborted
    the whole backup the first time the media tree stopped being empty. Retried once, then fails.
  - `[medium]` `[patch]` No busy timeout on `sqlite3 .backup`, so a transient lock lost the night.
  - `[medium]` `[patch]` Four factual errors in the record: five actions announced above seven,
    two wrong action cross-references in the named limits, and ten stages above a table of eleven.
  - `[medium]` `[patch]` The cost table presented a local unencrypted archive size as an observed
    offsite volume, which is a projection under this record's own NFR-9 discipline.
  - `[medium]` `[patch]` The two variables that redirect a run to a different executable appeared
    in no table, and the config was sourced after half the knobs it looked able to set had resolved.
  - `[medium]` `[patch]` The `curl` stub discarded headers, so no test observed the request
    carrying the signature: deleting the `Authorization` header left every case green. The stub now
    records full argv and three cases assert the header against the Node reference.
  - `[medium]` `[patch]` Implemented branches with no test: misconfigured, unreadable config,
    unreachable Redis, no-prune-on-failure, newline and empty keys, bad endpoint and bucket.
  - `[medium]` `[patch]` Nothing tied the committed scripts to the hashes recorded as installed.
    A test now hashes each script against the record's pins, so drift fails the suite.
  - `[medium]` `[patch]` The real `gpg` encrypt and decrypt had never executed anywhere: the suite
    stubs it and the first box run had no passphrase. Proved on the box under the cron shape with a
    throwaway passphrase, including that a wrong passphrase fails.
  - `[low]` `[patch]` Prose double dashes throughout the new files, against a repository rule, and
    a punctuation sweep that passed over them. Sweep rebuilt to catch a prose dash without flagging
    a CLI flag, and checked against a control.
  - `[low]` `[patch]` The append-only ledger lost its trailing newline, so the next entry would
    have concatenated onto the last line, and the resolution entry named what it closed by position.
  - `[low]` `[patch]` Retention was described as 14 days while `find -mtime +14` removes at 15.
  - `[low]` `[patch]` The suite inherited the `jsdom` environment, resolved paths through
    `__dirname`, and left roughly twenty scratch roots per run behind, some holding an unencrypted
    fixture database.
  - `[low]` `[patch]` The summary named a `.tar.gz.gpg` artifact before encryption was attempted,
    so a `gpg` failure reported a file that never existed.
  - `[low]` `[patch]` The unsafe-key suite carried a comment describing a newline case it did not
    run, which reads as coverage.
  - `[low]` `[patch]` No way for the Operator to detect a passphrase mistyped into the password
    manager, since encryption and verification both read the same value from the same file on the
    same box. Added as an off-box Operator action, with an RPO and an RTO for the store.

## Design Notes

**Why a bash SigV4 client and not `restic` or `rclone`.** AD-10 asks for a path equivalent to
`pg_dump` plus restic, which is a property of the result (encrypted, offsite, retained, restorable),
not a requirement to run restic. The box has no `node` and no package manager story: adding a
third-party binary to a serving two-vCPU box, unattended, to move 90 KB a night, buys dedup and
snapshot management this store cannot use and costs an unpinned dependency nobody can review here.
`put` and `get` against an S3-compatible endpoint are about seventy lines of `curl` and `openssl`,
they are committed, they are tested, and the bucket stays S3-compatible, so Story 4-5 can point
restic at the same bucket later without moving the data.

**Why Cloudflare R2.** The estate already depends on Cloudflare for all ingress (Story 1-3), so this
adds no vendor relationship and no new console to audit. 10 GB of storage and Class A operations are
free at this volume, against an archive of roughly 90 KB a night, so the marginal recurring cost is
zero and NFR-4's ceiling is untouched. The record carries that as a named decision with the volume
at which it would stop being free. The scripts take the endpoint, region and bucket from the
environment, so a decision to use Backblaze B2 or any other S3-compatible store changes four values
and no code.

**Why the archive holds more than the database.** `books`, `covers` and `inbox` are empty today and
`digital-library` is a book reader, so a path that backs up only the database is a coverage claim
with a hole in it the first time somebody uploads a file. Including three empty directories costs
nothing now and means the hole never opens.

**Why exit 75 rather than exit 0 when the offsite half is unconfigured.** The estate's own idiom is
that a gate with no measurement is `blocked`, not `open`. A local-only backup is precisely the
defect AD-10 names, so a run that produced one has not succeeded. What separates this from the bug
it replaces is that every local stage completes first and the message names the exact file to
create.

## Verification

**Commands:**
- `corepack pnpm test --run`, expected: the suite at `ed9c816` plus the new file, all passing.
- `corepack pnpm typecheck`, expected: pass.
- `bash -n ops/s3-object.sh ops/library-backup.sh ops/library-restore-verify.sh`, expected: clean parse.
- `bash ops/s3-object.sh selftest`, expected: the golden vector matches, exit 0.
- On the box, `sha256sum` of each installed script against the committed file, expected: identical.
- On the box, one full run with no config file, expected: local stages complete, summary line
  reports `offsite=not-configured`, exit 75, and the backup directory holds a fresh archive.
- The concurrency proof on a scratch database, expected: `integrity_check` `ok` and a row count
  consistent with a point in the writer's sequence, never a torn read.
- Punctuation sweep over every file written, using regex escapes rather than literal characters,
  run against a positive control carrying all three forbidden characters so it cannot pass vacuously.

**Manual checks:**
- Confirm `/home/deploy/digital-library/data` is byte-identical after the build: same three files,
  same sizes, same mtimes.
- Confirm `crontab -l` holds two jobs and the library one points at `/usr/local/sbin`.

## Auto Run Result

Status: awaiting-operator
Blocking condition: none. The story is finished as far as an agent can take it. The remaining
acceptance depends on a Cloudflare console act and a credential, which are enumerated in the
frontmatter `operator_actions` and, with their evidence columns, in `ops/backup-digital-library.md`.

**What was implemented.** `digital-library`'s backup was replaced rather than repaired. The
uncommitted `/home/deploy/library-backup.sh`, which had aborted on `USER: unbound variable` every
night since 2026-07-31, is retired to `.retired-2026-08-24` and the `deploy` crontab now runs a
committed job at the same 03:45. A run takes a checkpointed `sqlite3 .backup` snapshot of the live
store, asserts its integrity and that it holds a schema, archives it with the `books`, `covers` and
`inbox` trees, encrypts it with AES256, pushes it to an S3-compatible bucket, downloads it back and
compares SHA-256, restores it into a scratch directory and asserts what came back is a real
database, prunes locally, and emits one summary line whose every field carries a verdict and whose
exit status agrees with it. Offsite is unconfigured today, so the job completes its local half and
exits 75 rather than reporting a success the estate does not have.

**Files changed.**
- `ops/s3-object.sh`: an S3-compatible `put`, `get` and `selftest` in bash over `curl` and
  `openssl`, SigV4 payload-signed, with key, endpoint and bucket validation before any request.
- `ops/library-backup.sh`: the nightly job, eleven stages, one summary line, single-instance guard.
- `ops/library-restore-verify.sh`: the real restore, every value asserted rather than printed.
- `ops/__tests__/library-backup.test.ts`: 53 cases, one describe per matrix row plus the branches
  found at review, running the real scripts against stubbed box binaries.
- `ops/backup-digital-library.md`: the record. Method, the Redis cache verdict with its evidence,
  the R2 cost decision against NFR-4, retention on both sides, RPO and RTO, the restore procedure,
  the store in the form Epic 2's Registry `tech` array and Epic 4's rebuild need it, nine named
  limits, and the Operator actions with an evidence column.
- `ops/routing-inventory.md`: one dated pointer from Story 1-7's backup coverage section.
- `_bmad-output/implementation-artifacts/deferred-work.md`: the resolution of the two Story 1-7
  entries this story inherited, plus what this build found that belongs to no story.
- `vitest.setup.ts`: its DOM shim is guarded so a node-environment test file can opt out.

**Review findings.** Four layers ran in parallel against the diff. 25 patches applied, 0 intent
gaps, 0 spec defects, 2 deferred, 2 rejected. The three that mattered: the config ownership the
record prescribed would have made the offsite half exit 75 forever after the Operator finished
every action; the acceptance step ran the job as root while cron runs it as `deploy`, which is the
same context mismatch that hid the original failure for 25 nights; and the restore verified nothing,
since it asserted only `PRAGMA integrity_check`, which passes on the empty database a naive `cp` of
this store produces. Full triage above.

**Follow-up review recommended: true.** Patched this pass: high 3, medium 14, low 8. Any high
patched finding sets the flag on its own.

**Verification.** `corepack pnpm test --run`: 215 tests in 17 files, all pass. `corepack pnpm
typecheck`: pass. `bash -n` clean on all three scripts. `bash ops/s3-object.sh selftest`: the golden
SigV4 vector matches byte for byte, and the Node reference in the suite reproduces both vectors AWS
publishes before deriving it. On the box: the three installed scripts hash identically to the
committed files (`6d1c25f1`, `5ab0b586`, `0c4d8502`); a cron-shaped run at 2026-08-24T12:52:13Z
completed every local stage and exited 75; the live store is byte-identical, `library.db` still
`d405fbc2...` with its mtime unchanged; all three containers healthy and `library.cuatro.dev`
serving. Story 1-7's open verdict is settled: three timed runs on a scratch WAL database put the
snapshot strictly mid-writer-sequence with contiguous ids and `integrity_check ok`, so
`sqlite3 .backup` is consistent under a concurrent writer, observed rather than read off
documentation. The real `gpg` path was proved on the box under the cron shape with a throwaway
passphrase, including that a wrong passphrase fails, because the suite necessarily stubs it.

**Residual risks.**
1. No offsite copy exists yet. Until the eight Operator actions are done, `digital-library` still
   has only local snapshots, which is the AD-10 defect narrowed rather than closed.
2. No live request has ever been made to Cloudflare R2 by this estate. The signature is proved
   against AWS's published vectors and the request against a recorded stub argv; a real 200 is
   Operator action 6.
3. The R2 free-tier figures are marked Decided, not Observed. Operator action 2 corrects them.
4. The suite stubs `gpg`, so the box proof is point-in-time. A change to those invocations fails the
   flag-set test but does not re-prove the round trip, which needs a manual re-run.
5. Nothing monitors the job's exit status, which is why the original failure survived 25 nights.
   Deferred, because it is `ops/monitoring.md`'s file.
