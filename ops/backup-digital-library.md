# The `digital-library` backup path

The written record of how `digital-library`'s store is backed up, what is deliberately not backed
up, where the copies go, how long they live on each side, what it costs, how long a recovery takes
and how to get the data back. It is the artifact Story 1-8 delivers.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md`,
`ops/bot-mitigation.md` and `ops/capacity-measurement.md` set: every value is marked as either a
decision or an observation, and the two are never presented as the same kind of fact (NFR-9).

Governing decision: **AD-10, a declared non-Postgres store carries its own offsite backup path.**
`digital-library` (SQLite plus Redis) is the estate's one declared exception, and AD-10 calls a
declared store with no equivalent offsite path unbacked data, which is a defect. This file exists
so that the exception is no longer one.

**This build ships and installs everything that runs. It does not create the bucket.** The bucket,
its credentials and the passphrase are a vendor-console act, so the story is left awaiting the
Operator rather than reported as done. What is owed is enumerated at the end as eight imperative
actions.

## What was there before

**Do not read the prior state out of this file.** The full evidence lives in
`ops/routing-inventory.md` under "Backup coverage, per project", gathered by Story 1-7 on
2026-08-24: the 25 uncompressed snapshots, their two distinct SHA-256 contents, the
`PRAGMA integrity_check` results on two of them, the live database and WAL sizes and timestamps,
and the reconciliation against `cuatro-backup.sh`. One place to correct if any of it turns out
wrong.

Three sentences of it, because this file is unreadable without them. `/home/deploy/library-backup.sh`
aborted on its line 13 every night from 2026-07-31, because `cron` sets no `USER` and the script
ran under `set -u`. Line 12 ran first, so a valid snapshot was written every night while the log
said the run had failed, which is the worst shape a backup can be in short of not existing. The
prune never ran at all, and its pattern would not have matched the files it was leaving anyway.

**That script is now retired, not deleted:** `/home/deploy/library-backup.sh.retired-2026-08-24`,
593 bytes, unchanged. **Observed 2026-08-24T12:19Z.**

## The store

The form Epic 2 needs for the Registry `tech` array and Epic 4 needs for the rebuild.

| Item | Value | Nature |
|---|---|---|
| Application id | `digital-library` | **Observed**, `content/projects.ts:12` |
| Hostname | `library.cuatro.dev` | **Observed** |
| Box | `177.7.52.248`, Ubuntu 24.04.4, 2 vCPU, `Etc/UTC` | **Observed 2026-08-24** |
| Containers | `digital-library-web-1`, `digital-library-api-1`, `digital-library-redis-1` | **Observed 2026-08-24**, all three `Up 3 weeks (healthy)` |
| Primary store | SQLite at `/home/deploy/digital-library/data/library.db`, root owned, bind mounted into `digital-library-api-1` at `/data` | **Observed 2026-08-24** |
| Journal mode | `wal`. `library.db` is 4096 bytes, which is a single page: a header and nothing else. **The entire database lives in `library.db-wal`** | **Observed 2026-08-24**, 152472 byte WAL |
| Media tree | `data/books`, `data/covers`, `data/inbox`, all root owned, all empty | **Observed 2026-08-24** |
| Cache | `digital-library_redis_data`, Redis 7 alpine | **Observed 2026-08-24** |
| Registry `tech` | `SQLite` and `Redis` are both already correct in `content/projects.ts:23,26`. **`Hetzner VPS` at line 30 is the stale value**, and it is C-1's, not this story's, to correct | **Observed 2026-08-24** |

**The single-page main file is the reason a file copy is not an option and never was.** `cp` of
`library.db` captures an empty database, and an empty database passes `PRAGMA integrity_check`.
Everything below turns on that one fact, including why both scripts assert a schema floor rather
than trusting integrity alone.

## What is backed up, and what deliberately is not

| Item | In the archive? | Nature |
|---|---|---|
| `library.db`, as a checkpointed `sqlite3 .backup` snapshot | **Yes** | **Observed.** 90112 bytes in the 2026-08-24T12:52:13Z archive |
| `data/books` | **Yes**, as an empty directory | **Observed** |
| `data/covers` | **Yes**, as an empty directory | **Observed** |
| `data/inbox` | **Yes**, as an empty directory | **Observed** |
| `library.db-wal` and `library.db-shm` | **No**, and correctly so | **Decided.** `.backup` produces a checkpointed database, so the WAL content is already inside the snapshot. Copying the live WAL alongside a snapshot taken at a different instant would be the actual hazard |
| `digital-library_redis_data` | **No** | **Decided**, on the evidence in the next section |
| The container images and the compose file | **No** | **Decided.** They live in the `digital-library` repository, which is a different backup question with a different answer. Epic 3 owns it |
| `/home/deploy/digital-library/docker-compose.override.yml` | **No** | **Decided.** Already in the deferred ledger as an untracked, un-gitignored box-only file. It belongs in that repository's `.gitignore`, not in a database archive |

**Why the archive holds more than the database.** All three media directories are empty today and
`digital-library` is a book reader. A path that backed up only the database would be a coverage
claim with a hole in it the first time somebody uploads a file. Three empty directories cost 0
bytes of content to include, and the hole never opens. `library-restore-verify.sh` fails the run if
any of the three is missing from the archive, so this claim cannot quietly stop being true.

### The Redis verdict, with its evidence

**Redis holds nothing, has never held anything, and is not in the archive.** That exclusion is
defensible only while it stays true, so the nightly job checks it and reports what it saw rather
than this file asserting it once and going stale.

| Check | Result | Nature |
|---|---|---|
| `DBSIZE` | `0` | **Observed 2026-08-24**, twice, by Story 1-7 and again by this build |
| `INFO keyspace` | empty | **Observed 2026-08-24** (Story 1-7) |
| `appendonly` | `no` | **Observed 2026-08-24** (Story 1-7) |
| `save` | the stock `3600 1 300 100 60 10000` | **Observed 2026-08-24** (Story 1-7) |
| `/var/lib/docker/volumes/digital-library_redis_data/_data` | **an empty directory.** No `dump.rdb` has ever been written | **Observed 2026-08-24**, listing taken again by this build |
| Volume size | 0 B | **Observed 2026-08-24** (Story 1-7) |
| The verdict | Redis is a cache here, holds no durable state, and losing it costs a cold start | **Decided**, on the five rows above |

**Every nightly run re-checks both halves of it.** `redis=empty` in the summary line means `DBSIZE`
was 0 and no `dump.rdb` exists. If either changes, the field reads
`NON-EMPTY-dbsize-<n>-and-not-in-this-archive` or gains `+dump.rdb-present-and-not-in-this-archive`,
and the run still completes, because an unreachable or newly populated cache is not a reason to skip
a database backup. It is a reason for somebody to reopen this section. The probe is bounded by
`timeout`, because a check the script itself declares non-fatal must not be able to block the run
by hanging on a wedged Docker daemon. An unreachable daemon reads `redis=unreachable`.

## The method

Three committed scripts, installed to `/usr/local/sbin` mode 0755 root owned, following the
precedent Story 1-5 set with `capacity-sampler.sh`.

| Script | Role |
|---|---|
| `ops/library-backup.sh` | The nightly job. Eleven stages, one summary line |
| `ops/s3-object.sh` | An S3-compatible object client in bash: `put`, `get`, `selftest`. AWS SigV4 over `curl` and `openssl` |
| `ops/library-restore-verify.sh` | The real restore. Callable on its own, and called by the nightly job |

**Eleven stages**, in order, and what each one is for. The same eleven are listed in the header
comment of `ops/library-backup.sh` and each has a field in the summary line.

| # | Stage | What it does | Summary field |
|---|---|---|---|
| 1 | snapshot | `sudo sqlite3 -cmd '.timeout 30000' "$DB" ".backup"`. The live store is read, never written, and a transient lock costs thirty seconds rather than the night | `snapshot` |
| 2 | own | `sudo chown "$(id -u):$(id -g)"`. **Not `$USER`**, which is the expansion that broke the retired script | `own` |
| 3 | integrity | `PRAGMA integrity_check` **and** a schema object floor, before anything is packed and long before anything leaves | `integrity`, `objects` |
| 4 | archive | `tar` of the snapshot plus the three media directories, then `gzip -n`. Retried once if `tar` reports a file changing under it | `archive`, `tar` |
| 5 | encrypt | `gpg --batch --symmetric --cipher-algo AES256` | `encrypt` |
| 6 | size | Refuse to upload above `MAX_ARCHIVE_BYTES` (default 268435456) | `size`, `bytes` |
| 7 | redis | Report the cache emptiness check, bounded by `timeout` | `redis` |
| 8 | offsite | `put` to the bucket | `offsite` |
| 9 | roundtrip | `get` the object back and compare SHA-256 | `roundtrip` |
| 10 | restore | A real restore from the bucket, below `VERIFY_MAX_BYTES` (default 33554432) | `restore` |
| 11 | prune | Local retention across all three generations of file naming | `prune` |

**One summary line, and the exit status agrees with it.** This is the whole lesson of the defect
being replaced. There is no `set -e`: every stage is checked by hand, and traps on `EXIT`, `INT`,
`TERM` and `HUP` print the summary even on a path nobody anticipated, including a signal, which
bash would otherwise use to skip the `EXIT` trap entirely.

A real run, **observed 2026-08-24T12:52:13Z**, executed in the cron shape (`env -i` with no `USER`
and cron's `PATH`, as `deploy`) rather than by hand as root, because the script this story replaces
died for 25 nights on exactly that difference:

```
library-backup ts=2026-08-24T12:52:13Z snapshot=ok own=ok integrity=ok objects=23 archive=library-20260824T125213Z.tar.gz tar=first-attempt bytes=3252 encrypt=skipped-no-passphrase size=within-ceiling redis=empty offsite=not-configured roundtrip=skipped restore=skipped prune=removed-0-aged-over-14-whole-days exit=75
```

**One run at a time.** The job takes a `mkdir` lock in the backup directory, because this record
instructs the Operator to run it by hand and a hand run overlapping the 03:45 cron run would share
one backup directory, one prune and one object namespace keyed only to the second of them. A lock
whose holder is no longer in `/proc` is taken over, so a run killed before its traps could fire does
not stop the nightly job forever. A lock whose holder cannot be identified at all is treated as
held, because refusing a run is recoverable and two concurrent runs are not. The job also refuses to
overwrite an archive that already exists rather than letting `mv` replace a previous night's file.

### The three exits, and why they are different

| Exit | Summary field | What it means | What to do |
|---|---|---|---|
| 0 | `offsite=ok-...` | Everything ran, including the round trip and a real restore from the bucket | Nothing |
| 75 | `offsite=not-configured` | The config file does not exist. The local half completed and pruned | Operator actions 1 to 5 |
| 1 | `offsite=config-unreadable` | The config file exists and this account cannot read it. The local half completed and pruned | Fix the ownership, not the content. The message prints the exact `chown` and `chmod` |
| 1 | `offsite=misconfigured` | The config file is readable and a required variable is empty | Fill in the named variable |

**Why exit 75 and not exit 0 when the offsite half is unconfigured.** **Decided.** A local-only
backup is precisely the defect AD-10 names, so a run that produced one has not succeeded. The
estate's own idiom is that a gate with no measurement is `blocked`, not `open` (AD-9, and the
"Errors and failure" row of the spine's cross-cutting table). What separates this from the bug it
replaces is that every local stage completes first, the local archive is intact on disk, and the
message names the exact file to create. 75 is `EX_TEMPFAIL`, which is what this is: a condition that
a human action clears.

**Why `config-unreadable` is not `not-configured`.** A config the job cannot read is a
misconfiguration, not an unfinished setup, and telling the Operator to create a file that already
exists would send them the wrong way. The two states are distinguished with `sudo test -e` as a
second opinion, because a directory this account cannot traverse makes a plain existence test
indistinguishable from absence.

### Why a bash SigV4 client and not `restic` or `rclone`

**Decided.** AD-10 asks for a path equivalent to `pg_dump` plus restic. That is a property of the
result (encrypted, offsite, retained, restorable), not an instruction to run restic.

- The box has **no `node`, no `restic`, no `rclone` and no `age`**. **Observed 2026-08-24.**
- Adding a third-party binary to a serving two-vCPU box, unattended, to move a few kilobytes a
  night, buys dedup and snapshot management this store cannot use, at the price of an unpinned
  dependency nobody in this repository can review.
- `put` and `get` against an S3-compatible endpoint are about seventy lines of `curl` and
  `openssl`, both of which are already on the box. **Observed 2026-08-24:** `curl`, `openssl 3.0.13`,
  `sqlite3 3.45.1`, `gpg 2.4.4`, `tar`, `gzip`, `find`, `flock`, `timeout` and `od` are all present.
- The bucket stays S3-compatible, so Story 4-5 can point restic at the same bucket later without
  moving a byte.

**The signing implementation is proved, not asserted, in three layers.**
`ops/__tests__/library-backup.test.ts` holds an independent SigV4 implementation in Node, checks it
against the two vectors AWS publishes with their expected signatures (`f0e8bdb8...` for the GET
example and `98ad7217...` for the PUT example), then derives this estate's golden vector from first
principles and pins it. `s3-object.sh selftest` recomputes the same Authorization header in bash and
compares byte for byte. And a full orchestration run records every `curl` invocation's argv, so the
`Authorization` header that actually goes on the wire, the URL it goes to, and the payload hash it
covers are all checked against the reference for both the PUT and the two GETs. **Observed
2026-08-24T12:52Z on the box:** `selftest` exits 0 against the installed copy, run as `deploy`.

**Every request is bounded in time.** `--connect-timeout` and `--max-time`, because an endpoint that
accepts the connection and then stalls would otherwise hang the 03:45 job forever with no summary
line, which is the exact failure shape this story exists to remove.

**The endpoint and the bucket are validated before anything is signed.** An endpoint carrying a path,
or a bucket name holding a space or a slash, would produce a signature over one URI while curl sent
another, and that surfaces as a nightly 403 nobody reads.

**No `list` and no `delete`, deliberately.** Offsite retention is a bucket lifecycle rule set in the
console, which keeps the token's blast radius at write-only: a compromised box can add objects and
cannot remove the history that would let the estate recover from the compromise.

### The encryption path, proved on the box

The test suite stubs `gpg` as an identity copy, because the point of those cases is the
orchestration around it. That leaves the real encrypt and decrypt invocations unexercised, and a
wrong flag would then stay invisible until the first night after the Operator writes the config. So
they were run for real, on the box, in the cron shape, with a throwaway passphrase generated by
`openssl rand -hex 24` that was never written to disk and never left the process.

**Observed 2026-08-24T12:53:03.513Z to 2026-08-24T12:53:05.030Z**, using the exact invocations from
`library-backup.sh` and `library-restore-verify.sh`, under
`env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh`.

| Check | Result | Nature |
|---|---|---|
| Source archive | `library-20260824T125213Z.tar.gz`, 3252 bytes, sha256 `7adf5b37...` | **Observed** |
| Encrypt exit | `0` | **Observed** |
| Ciphertext | 3329 bytes, sha256 `3d4aa278...` | **Observed** |
| What `file` says it is | `PGP symmetric key encrypted data - AES with 256-bit key salted & iterated - SHA512` | **Observed.** The cipher and the KDF are what the flags asked for, read off the artifact rather than off the command line |
| Ciphertext differs from plaintext | yes | **Observed.** The check exists because an identity copy would otherwise look like a successful encrypt |
| Plaintext leak | none. The string `library.db` does not appear anywhere in the ciphertext | **Observed** |
| **Wrong passphrase** | **exit 2, no output file** | **Observed.** A decrypt that succeeded on the wrong passphrase would mean the passphrase was not being used |
| Decrypt exit | `0` | **Observed** |
| Round trip | **byte identical to the source archive** | **Observed**, by `cmp` |
| Unpacked | `books covers inbox library.db` | **Observed** |
| `PRAGMA integrity_check` | `ok` | **Observed** |
| Schema objects | 23 | **Observed** |
| `users` and `sessions` | 1 row each | **Observed** |
| Envelope overhead | **77 bytes**, being 3329 minus 3252 | **Observed**, at this size. It is a fixed OpenPGP header plus padding, not a percentage |

The scratch directory was removed on exit and the throwaway passphrase went nowhere.

## The concurrency verdict, settled

**Story 1-7 recorded one verdict it could not reach:** that a `sqlite3 .backup` snapshot is
consistent **under a concurrent writer**. Nothing had written to this database since 2026-08-14, so
every snapshot in the directory was taken against a quiescent file, and the claim rested on SQLite's
documentation rather than on evidence. **That is now settled by test.**

Method: a scratch WAL database in `/tmp` on the box, seeded with 2000 rows, then 600 separate
autocommit `INSERT` transactions from one connection while `sqlite3 .backup` ran against another.
Both processes `nice -n 19` and `ionice -c 3`. Nothing on the box was touched and the scratch files
were removed. **The exact UTC windows, so Story 1-6 can see them against the measurement week:**

| Run | Window | Duration |
|---|---|---|
| 1 | `2026-08-24T12:16:49.719Z` to `2026-08-24T12:16:50.040Z` | 321 ms |
| 2 | `2026-08-24T12:16:58.118Z` to `2026-08-24T12:16:58.444Z` | 326 ms |
| 3 | `2026-08-24T12:16:58.487Z` to `2026-08-24T12:16:58.800Z` | 313 ms |

Load average immediately after all three was `0.09, 0.15, 0.12`. The 15-minute figure, which is the
one AD-9's gate reads, was unmoved.

| Check | Run 1 | Run 2 | Run 3 | Nature |
|---|---|---|---|---|
| Rows before the writer started | 2000 | 2000 | 2000 | **Observed** |
| Rows after the writer finished | 2600 | 2600 | 2600 | **Observed** |
| **Rows in the snapshot** | **2093** | **2093** | **2096** | **Observed.** Strictly between, so the snapshot genuinely landed mid-sequence |
| `PRAGMA integrity_check` on the snapshot | `ok` | `ok` | `ok` | **Observed** |
| `count(*) = max(id)` on the snapshot | contiguous | contiguous | contiguous | **Observed.** The snapshot is a prefix of the writer's commit sequence with no gaps |
| Rows with a truncated value | 0 | 0 | 0 | **Observed.** No partially written row |
| Snapshot journal mode | `wal` | `wal` | `wal` | **Observed** |
| `.backup` exit status | 0 | 0 | 0 | **Observed** |

**The verdict, restated.** A `sqlite3 .backup` snapshot taken while another connection is committing
is a valid database at a real point in that connection's sequence, never a torn read. **Observed
2026-08-24**, three runs, by the method above. This supersedes the row in `ops/routing-inventory.md`
that recorded it as "inference from documentation, explicitly not observed".

## Retention

| Side | Window | Mechanism | Nature |
|---|---|---|---|
| **Local**, `/home/deploy/backups/digital-library` | **Removed once a file is 15 whole days old** | `find -maxdepth 1 -type f -name 'library-*' -mtime +14 -delete`, run by the nightly job | **Decided**, and unchanged from the retired script's intent |
| **Offsite**, the bucket | **Not set by anything in this repository** | A bucket lifecycle rule in the vendor console. **Owed by the Operator**, action 5 below | **Decided** |

**The local window is 14 in the predicate and 15 in effect, and the record says so rather than
rounding.** `find -mtime +14` matches a file whose age in whole 24-hour units is **greater than 14**,
which means 15 or more. A file that is 14 days and 23 hours old survives; one that is 15 days and
one hour old does not. That is the same arithmetic `ops/routing-inventory.md` used to reconcile
`cuatro-backup.sh`'s sixteen surviving dumps under a "14 day" policy, and
`ops/__tests__/library-backup.test.ts` pins both sides of the boundary with fixtures. The summary
field reads `removed-<n>-aged-over-14-whole-days` for the same reason.

**The prune pattern is `library-*` and nothing narrower, which is the second of Story 1-7's two
bugs.** Three generations of naming have existed in that directory:

1. `library-YYYY-MM-DD_HHMM.db.gz`, the original compressed form.
2. `library-YYYY-MM-DD_HHMM.db`, the 25 root-owned uncompressed files the failing script left,
   which its own `library-*.db.gz` prune pattern never matched.
3. `library-YYYYMMDDTHHMMSSZ.tar.gz.gpg`, this script.

Fixing only the `USER` expansion would have started deleting the `.gz` files while the 25
uncompressed ones grew without limit. `library-*` covers all three. `backup.log` and anything an
Operator parks in a subdirectory are outside it, by `-maxdepth 1 -type f` and by the prefix.

**What the first run actually removed. Observed 2026-08-24T12:18:08Z:** 11 files, being the single
`library-2026-07-30_0617.db.gz` (25 days old) and the ten `.db` files dated 2026-07-31 to
2026-08-09. Fifteen `.db` files dated 2026-08-10 to 2026-08-24 remain, and **both** of the two
distinct SHA-256 contents Story 1-7 recorded survive inside that window (`eab517fa...` on
2026-08-10 to 2026-08-14, `74aebac1...` on 2026-08-15 to 2026-08-24), so no evidence was lost.

**A failing run does not prune.** Deliberate: a run that could not prove its own backup should not
also be deleting history. The two paths that end the run without an offsite copy, `not-configured`
and `config-unreadable`, do prune, because their local half completed. Both behaviours are asserted
in the test suite rather than left as an implementation detail.

## The destination and its cost

**Decision: Cloudflare R2.** Recorded against **NFR-4**, which requires any new recurring charge to
be a named decision rather than an incidental subscription.

| Item | Value | Nature |
|---|---|---|
| Provider | Cloudflare R2, S3-compatible | **Decided** |
| Why this provider | The estate already depends on Cloudflare for all ingress (Story 1-3, `ops/bot-mitigation.md`), so this adds no vendor relationship and no new console to audit | **Decided** |
| Endpoint form | `https://<account-id>.r2.cloudflarestorage.com`, path-style addressing, scheme and host only | **Decided** |
| Region | `auto`, which is what R2 expects | **Decided** |
| **Marginal recurring cost at this volume** | **$0.00 per month** | **Decided**, from the vendor's published free tier. **Not observed:** this build did not reach the Cloudflare console, and the Operator confirms it at bucket creation (action 2 below) |
| Free tier, as published | 10 GB of storage, 1 million Class A operations per month, 10 million Class B operations per month, and no egress charge | **Decided**, unverified by this build |
| **Measured nightly object size** | **3350 bytes** | **Observed 2026-08-25T02:48:28Z**, from the first offsite run below. The projection this row replaced was about 3329 bytes, so the estimate was low by 21 bytes, or 0.6% |
| Projected operations per night | one Class A (`PUT`) and two Class B (`GET`, one for the round trip and one for the restore) | **Decided**, from the eleven stages above |
| Where it would stop being free | Storage, not operations. At roughly 30 objects retained, the free tier ends when a single nightly archive passes roughly 340 MB. Operations would need a hundred-fold increase in run frequency to matter | **Decided**, arithmetic on the two rows above |
| NFR-4 ceiling | $40 to $100 per month all-in. **Untouched** | **Decided** |
| Portability | The scripts take endpoint, region, bucket and credentials from the environment. Moving to Backblaze B2 or any other S3-compatible store changes four values and no code | **Decided** |

## Recovery objectives

Written down because "we have backups" is not an answer to "how much would we lose and how long
would it take".

| Objective | Value | Nature |
|---|---|---|
| **RPO**, the most data a failure can cost | **24 hours.** The job runs once, at 03:45 UTC | **Decided.** Tightening it means running more often, which is a capacity decision against AD-9 rather than a script change: the knobs are already there |
| **RPO today, in practice** | Nothing. Nothing has written to this database since 2026-08-14 | **Observed 2026-08-24.** True today and not a property of the design |
| **RTO**, time to a serving application from a lost box | **1 hour** | **Decided**, and dominated by the human steps: finding the object, provisioning somewhere to run, stopping the container, moving the tree, starting it |
| RTO, the mechanical part only | **1.5 seconds** for decrypt, unpack, open and integrity check at this volume | **Observed 2026-08-24T12:53:03.513Z to 12:53:05.030Z** |
| What an RTO of 1 hour assumes | That the passphrase is reachable from somewhere that is not the box, and that somebody has decrypted an object with it at least once. Operator action 7 is what makes that assumption true | **Decided** |

## The restore procedure

Two forms. Use the first to check that a backup is good, and the second when the store is actually
gone.

### Verifying a backup, which the nightly job already does for you

```
/usr/local/sbin/library-restore-verify.sh
```

Run it as `deploy`, the same account the cron job uses. With no argument it verifies the object
matching the newest local archive. Give it an object key to verify a specific night, for example
`/usr/local/sbin/library-restore-verify.sh digital-library/library-20260824T034500Z.tar.gz.gpg`.

It downloads into a `mktemp -d` scratch directory, decrypts, unpacks, opens the database, and then
**asserts** rather than prints: `PRAGMA integrity_check` must be `ok`, all three media directories
must be present, the database must hold at least one schema object and at least one table, and every
row count must be a number. A restore that printed an error and exited 0 would certify nothing while
looking like proof, so none of those values is merely displayed. The scratch directory is removed on
every exit path including a signal, because it holds a decrypted database carrying a user row and a
session row. **It never writes outside that scratch directory**, so it is safe to run against a live
box.

### Restoring for real

1. **Stop the writer, not the whole application.** `docker stop digital-library-api-1`. Nothing
   else in the compose project writes to the database.
2. **Fetch the object.** `/usr/local/sbin/s3-object.sh get digital-library/<archive> /tmp/restore.tar.gz.gpg`,
   with `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in
   the environment, or by sourcing `/etc/cuatro/library-backup.env` first. As `deploy`: the file is
   group readable by `deploy` precisely so this and the cron job both work without `sudo`.
3. **Decrypt.**
   `printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output /tmp/restore.tar.gz /tmp/restore.tar.gz.gpg`
4. **Unpack to a scratch directory first, never straight over the live tree.**
   `mkdir -p /tmp/restore && tar -xzf /tmp/restore.tar.gz -C /tmp/restore`
5. **Prove it before you trust it.** `sqlite3 /tmp/restore/library.db 'PRAGMA integrity_check;'`
   must print `ok`, `SELECT count(*) FROM sqlite_master;` must be at least 1, and
   `SELECT count(*) FROM users;` must return a plausible number. An empty database passes step one
   alone, which is why there are three checks and not one.
6. **Move the existing store aside rather than overwriting it.**
   `sudo mv /home/deploy/digital-library/data /home/deploy/digital-library/data.before-restore-<date>`
7. **Put the restored tree in place and give it back to root**, which is the owner the container
   writes as: `sudo mkdir -p /home/deploy/digital-library/data && sudo cp -a /tmp/restore/. /home/deploy/digital-library/data/ && sudo chown -R root:root /home/deploy/digital-library/data`
8. **Start the writer.** `docker start digital-library-api-1`, then check
   `https://library.cuatro.dev/` answers and the application sees its data.
9. **Remove the scratch copies**, which hold an unencrypted database:
   `rm -rf /tmp/restore /tmp/restore.tar.gz /tmp/restore.tar.gz.gpg`

**There is no `-wal` or `-shm` to restore.** The archive holds a checkpointed database, and SQLite
recreates both files on first open.

## Configuration

Everything is environment driven. The nightly job reads its secrets from one file.

**The ownership model is load-bearing, not incidental.** The cron entry lives in `deploy`'s crontab
and the job runs as `deploy`. A root-only mode 0600 config would be unreadable to it, and the job
would take the not-configured branch every night after the Operator had done everything. So the file
is **owned by root** so that `deploy` cannot rewrite it, and **group readable by `deploy`** so that
the job can read it.

| Path | Owner | Mode | Nature |
|---|---|---|---|
| `/etc/cuatro` | `root:root` | `0755` | **Decided.** Traversable, so `deploy` can reach the file inside it |
| `/etc/cuatro/library-backup.env` | `root:deploy` | `0640` | **Decided.** Root writes it, `deploy` reads it, nobody else can |

```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<bucket name>
S3_ACCESS_KEY_ID=<access key id>
S3_SECRET_ACCESS_KEY=<secret access key>
BACKUP_PASSPHRASE=<the symmetric passphrase>
```

**Nothing in that file may ever appear in this repository**, which is why the file is on the box and
this record carries only the variable names.

**What the config file may and may not set.** It is read before any path or knob is resolved, in a
subshell with a cleared environment, and only the names below are carried back out. A hand-edited
config that assigned a working directory or the path of an executable this job calls would otherwise
be able to redirect the run, and the cleanup trap would then delete whatever that variable became.
The file carries secrets and tuning. It does not carry paths, and it cannot.

| Variable | Default | May the config file set it? |
|---|---|---|
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | none | **Yes.** This is what it is for |
| `BACKUP_PASSPHRASE` | none | **Yes** |
| `S3_PREFIX` | `digital-library` | **Yes** |
| `S3_CONNECT_TIMEOUT` | `15` seconds | **Yes** |
| `S3_MAX_TIME` | `300` seconds | **Yes** |
| `LIBRARY_RETENTION_DAYS` | `14` | **Yes** |
| `MAX_ARCHIVE_BYTES` | `268435456` | **Yes** |
| `VERIFY_MAX_BYTES` | `33554432` | **Yes** |
| `LIBRARY_REDIS_CONTAINER` | `digital-library-redis-1` | **Yes** |
| `LIBRARY_REDIS_VOLUME_DIR` | `/var/lib/docker/volumes/digital-library_redis_data/_data` | **Yes** |
| `LIBRARY_BACKUP_CONFIG` | `/etc/cuatro/library-backup.env` | **No.** It is the path of the file itself |
| `LIBRARY_DATA_DIR` | `/home/deploy/digital-library/data` | **No**, environment only |
| `LIBRARY_BACKUP_DIR` | `/home/deploy/backups/digital-library` | **No**, environment only |
| `LIBRARY_BACKUP_LOCK` | `<backup dir>/.library-backup.lock` | **No**, environment only |
| `LIBRARY_DOCKER_TIMEOUT` | `15` seconds | **No**, environment only |
| **`S3_OBJECT_CLIENT`** | `<script dir>/s3-object.sh` | **No.** It names an executable the job runs, which is exactly what a config file must not be able to change |
| **`LIBRARY_RESTORE_VERIFY`** | `<script dir>/library-restore-verify.sh` | **No**, for the same reason |

`LIBRARY_RETENTION_DAYS`, `MAX_ARCHIVE_BYTES`, `VERIFY_MAX_BYTES` and `LIBRARY_DOCKER_TIMEOUT` are
validated as whole numbers at preflight and the run fails loudly if any is not. Without `set -e`, a
comparison against a non-numeric operand returns 2, the `if` reads false, and the size ceiling would
be silently bypassed while the summary still said `within-ceiling`. That ceiling is the entire
justification for `put` buffering the body in memory, so it is not allowed to fail open. A value set
to nothing at all falls back to the documented default, which fails closed rather than open.

## What is installed on the box

**Observed 2026-08-24T12:52Z.** Installed from the checkout by
`sudo install -o root -g root -m 0755`, and the checksums matched the committed files exactly, which
is the same proof-of-install Story 1-5 used for `capacity-sampler.sh`.

**These three values are held true by a test.** `ops/__tests__/library-backup.test.ts` hashes each
committed script and fails if the digest recorded here has gone stale, so a patch that is not
reinstalled and re-recorded cannot pass CI.

| Path | Mode | SHA-256 |
|---|---|---|
| `/usr/local/sbin/s3-object.sh` | `0755 root:root` | `5ab0b586249d7fbdc6483677d3a03227fea9161a217d017d1f6934fda29a0046` |
| `/usr/local/sbin/library-backup.sh` | `0755 root:root` | `6d1c25f105ec6717bb9f91b9c7e4fa7671705f730f2c91bf03760fc2df54ef5a` |
| `/usr/local/sbin/library-restore-verify.sh` | `0755 root:root` | `0c4d8502a5778bbcaeacf23eea35bf00c253d839662ede017d8be0b97583df04` |

**The crontab, after. Observed 2026-08-24T12:19Z**, `crontab -l` for `deploy`. Root still has none.

```
30 3 * * * /home/deploy/cuatro-backup.sh >> /home/deploy/backups/cuatro-tracker/backup.log 2>&1
45 3 * * * /usr/local/sbin/library-backup.sh >> /home/deploy/backups/digital-library/backup.log 2>&1
```

Two jobs, unchanged in count and schedule. Only the library job's path moved.

### The cron environment, tested rather than reasoned about

The defect being replaced was an environment defect, so every acceptance run of the replacement is
performed in that exact environment: `env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin
SHELL=/bin/sh`, with no `USER`, as `deploy`. Never as root, and never with a shell that has a login
environment behind it, because those are the two ways a hand run stops resembling the run that
actually happens at 03:45.

**Observed 2026-08-24T12:19Z**, both scripts, back to back:

| Script | Exit | Output |
|---|---|---|
| `library-backup.sh.retired-2026-08-24` | 1 | `line 13: USER: unbound variable`, and nothing else |
| `/usr/local/sbin/library-backup.sh` | 75 | The full summary line |

### The live store was not touched

**Observed 2026-08-24**, immediately before and immediately after the 12:52:13Z run. Same three
files, same sizes, same modification times to the nanosecond, same SHA-256.

| File | Bytes | mtime | SHA-256 (unchanged) |
|---|---|---|---|
| `library.db` | 4096 | `2026-07-30 06:09:04.874699875 +0000` | `d405fbc2...` |
| `library.db-wal` | 152472 | `2026-08-14 09:16:05.332957422 +0000` | `9260554e...` |
| `library.db-shm` | 32768 | `2026-08-14 09:16:05.332957422 +0000` | `0f144c60...` |

No container was restarted. **Observed 2026-08-24T12:19Z:** all three `digital-library` containers
still `Up 3 weeks (healthy)`, and `https://library.cuatro.dev/` answered.

### The archive, opened

**Observed 2026-08-24T12:18:08Z**, by unpacking `library-20260824T121808Z.tar.gz` in `/tmp`, and
again at 12:53Z through the full encrypt and decrypt path above.

```
-rw-r--r-- deploy/deploy 90112 2026-08-24 12:18 library.db
drwxr-xr-x root/root         0 2026-07-30 06:11 books/
drwxr-xr-x root/root         0 2026-07-30 06:11 covers/
drwxr-xr-x root/root         0 2026-07-30 06:11 inbox/
```

`PRAGMA integrity_check` returned `ok`. `sqlite_master` holds **23 rows, of which 11 are tables**:
`users` 1 row, `sessions` 1 row, `books_fts_config` 1, `books_fts_data` 2, and `books`,
`books_fts`, `books_fts_docsize`, `books_fts_idx`, `libraries`, `reading_progress` and
`user_libraries` all 0. The remaining 12 `sqlite_master` rows are indexes and the FTS5 shadow
structures. Story 1-7 counted the 11 tables; the summary line's `objects=23` counts every
`sqlite_master` row, which is the number the schema floor is asserted against.

**The whole of `digital-library`'s state fits in a 3252 byte file.** This is a correctness and
offsite problem, not a volume problem.

## First offsite run

**2026-08-25T02:48:28Z.** The configuration was written, the job was run in the exact shape cron
runs it, and it passed every stage. This is the run that turns named limits 1, 2 and 5 from
statements about a gap into statements about a state.

```
library-backup ts=2026-08-25T02:48:28Z snapshot=ok own=ok integrity=ok objects=23
  archive=library-20260825T024828Z.tar.gz.gpg tar=first-attempt bytes=3350 encrypt=aes256
  size=within-ceiling redis=empty offsite=ok-digital-library/library-20260825T024828Z.tar.gz.gpg
  roundtrip=sha256-match restore=verified prune=removed-0-aged-over-14-whole-days exit=0
```

| Item | Value | Nature |
|---|---|---|
| Bucket | `cuatro-backups`, not public | **Observed** |
| Object size | 3350 bytes | **Observed** |
| Round trip | `sha256-match` | **Observed** |
| Restore from the bucket | `verified`, 23 schema objects across 11 tables | **Observed** |
| Lifecycle rule | `expire-digital-library-30d`, prefix `digital-library/`, 30 days, Enabled | **Observed 2026-08-25**, set through the S3 API and read back |
| Passphrase length | 48 characters, generated on the box from `openssl rand` | **Observed** |
| Off-box decrypt | Downloaded from the bucket to the workstation, decrypted, listed `library.db`, `books/`, `covers/`, `inbox/`, both local files deleted | **Observed 2026-08-25T02:52Z** |

**The endpoint form in the row above is load-bearing, and the first attempt failed on it.** The run
at `2026-08-25T02:47:43Z` exited 1 with `offsite=put-failed`, because `S3_ENDPOINT` had been written
with the bucket appended as a path. `ops/s3-object.sh` refuses that rather than guessing, and named
the exact problem. Scheme and host only, and the bucket travels in `S3_BUCKET`.

**One half of action 7 is still owed, and it is the half that matters.** The off-box decrypt above
used the passphrase read from `/etc/cuatro/library-backup.env` over ssh, which proves the object is
decryptable away from the box. It does **not** prove the password manager holds the same value,
because no copy has been filed there yet. Until the Operator files it and repeats the decrypt from
that copy, named limit 5 stands in full.

## Named limits

Written down because a coverage claim with an unstated hole reads as coverage.

1. **There is an offsite copy, as of 2026-08-25.** Actions 1 and 3 to 6 are complete: the bucket
   exists, the config is written, the lifecycle rule is set, and the first run put a verified object
   in the bucket. What remains of the original limit is action 2, the free-tier figures, which are
   still the vendor's published numbers rather than ones read from the console.
2. **A live 200 from Cloudflare R2 has now been observed.** The first offsite run above did a real
   `PUT`, a real `GET` for the round trip, and a real restore from the bucket. The SigV4 arithmetic
   remains proved against AWS's published vectors and an independent implementation, and it is now
   also proved against the real endpoint.
3. **Nothing alerts if the nightly job starts failing.** Cron appends to
   `/home/deploy/backups/digital-library/backup.log` and nobody reads it. The exit status is
   correct and the summary line is greppable, and neither is monitored. This is the same class of
   gap that let the retired script fail for 25 nights unnoticed, and it is recorded in
   `_bmad-output/implementation-artifacts/deferred-work.md` rather than solved here, because
   `ops/monitoring.md` is another story's file.
4. **Offsite retention is set.** `expire-digital-library-30d` deletes objects under
   `digital-library/` after 30 days, observed 2026-08-25 by writing the rule and reading it back.
   The scripts still never delete an object, deliberately, so the rule is the only thing bounding
   growth and it lives in the vendor, outside this repository.
5. **The passphrase is the only thing between the bucket and the data, there is no escrow, and it is
   not yet in a password manager.** It exists in exactly one place: `/etc/cuatro/library-backup.env`
   on `177.7.52.248`. **Lose the box and every offsite object becomes unreadable**, which inverts
   the point of an offsite copy. The off-box decrypt in the first-run section proves the object
   opens away from the box, but it read the passphrase from that same file, so it cannot detect a
   password manager entry that is wrong or absent. Filing it is the single highest-value action
   outstanding in this story.
6. **Redis is not backed up.** Correct today on the evidence above, and it is a decision that
   expires the moment `DBSIZE` is not 0. The nightly job reports it; nothing enforces it.
7. **The other three projects in the estate still have no offsite backup, and two have no backup at
   all.** Story 1-8 scopes `digital-library` only. The estate-wide gap is in the deferred ledger,
   and `cuatro-backup.sh`'s claim to complement a Hostinger weekly snapshot remains an unverified
   comment in a script.
8. **`put` reads the whole body into memory.** Acceptable only because the run refuses to upload
   above `MAX_ARCHIVE_BYTES`, which is why that check exists rather than being trusted to stay
   small, and why a non-numeric ceiling fails the run instead of being ignored.
9. **The suite stubs `gpg` as an identity copy.** The real path is proved on the box instead, dated
   above, and that proof is a point-in-time observation rather than something CI re-runs. A change
   to the gpg flags would pass CI. The test asserts the exact flag list in both scripts, which
   catches the change but does not re-prove the round trip.
10. **No rendered-output or browser check is claimed anywhere in this story.** Playwright arrives in
    Story 1-10.

## Pending Operator actions

Everything an agent could do is done and committed. These eight are console and shell acts.

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Create the R2 bucket.** In the Cloudflare dashboard, R2, Create bucket. Name it something the estate will recognise, for example `cuatro-digital-library-backup`. Note the account id from the endpoint `https://<account-id>.r2.cloudflarestorage.com` | Location hint may be left automatic. Do **not** make the bucket public | _not done_ |
| 2 | **Confirm the cost line before you rely on it.** On the same page, read the current free tier for storage and for Class A and Class B operations, and correct "The destination and its cost" above if the published numbers have moved | This row exists because this build could not reach the console, and the $0.00 in that table is a decision, not an observation | _not done_ |
| 3 | **Create an API token scoped to that one bucket, with Object Read and Write and nothing else.** R2, Manage API tokens, Create API token. Copy the Access Key ID and the Secret Access Key once, because the secret is shown once. Generate a passphrase of at least 32 random characters and store all three in the password manager **before** writing them to the box | Object Read is needed as well as Write, because the round trip and the restore both read the object back. Read is not a widening of the write-only stance: the token still cannot delete | _not done_ |
| 4 | **Write the config file on the box, readable by the account that runs it.** As `deploy` on `177.7.52.248`: `sudo install -d -o root -g root -m 0755 /etc/cuatro`, then `sudo install -o root -g deploy -m 0640 /dev/null /etc/cuatro/library-backup.env`, then `sudo nano /etc/cuatro/library-backup.env` and paste the six lines under "Configuration" with the real values. Verify with `sudo stat -c '%U %G %a' /etc/cuatro/library-backup.env`, which must print `root deploy 640` | The group matters. The cron entry is in `deploy`'s crontab, so a root-only 0600 file would make every night exit 1 with `offsite=config-unreadable`. Use an editor, not `echo`, so the secret never reaches the shell history | _not done_ |
| 5 | **Set the offsite lifecycle rule.** In the bucket's Settings, Object lifecycle rules, add a rule that deletes objects under the prefix `digital-library/` after 30 days | 30 days offsite against 15 local is deliberate: the offsite copy is the one that survives losing the box, so it should outlive the local one | _not done_ |
| 6 | **Run it once in the shape cron actually runs it, and read the summary line.** As `deploy`: `env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh /usr/local/sbin/library-backup.sh`. Not `sudo`, and not from your interactive shell. It must exit **0** and the line must read `offsite=ok-digital-library/library-...`, `roundtrip=sha256-match` and `restore=verified` | The retired script died for 25 nights on precisely the difference between a hand run and a cron run, so an acceptance run that validated a different environment would prove nothing. A root run would also leave a root-owned archive in a `deploy` owned directory, which is one of the defects this story removed | _not done_ |
| 7 | **Prove the passphrase from somewhere that is not the box.** On your own machine, download one object from the bucket through the Cloudflare dashboard, then decrypt it using the passphrase **as stored in the password manager**, typed or pasted from there rather than copied off the box: `gpg --batch --pinentry-mode loopback --passphrase-fd 0 --decrypt --output restored.tar.gz <object>` and then `tar -tzf restored.tar.gz`. Delete both files afterwards | This is the only check that can catch a passphrase mistyped into the password manager. Encryption and verification on the box both read the same value from the same file, so every nightly run would stay green while the copy of record was unopenable by anybody. It is also the only thing that makes the 1 hour RTO an estimate rather than a hope | _not done_ |
| 8 | **Record the result.** Paste action 6's summary line into this file under a new "First offsite run" heading with its UTC date, replace the projected object size in "The destination and its cost" with the measured one, note action 7's outcome, and change named limits 1, 2 and 5 to describe the state that now holds | The record is the artifact. A backup path nobody wrote down is one nobody can audit | _not done_ |

**Maintaining this file.** When an action is performed, replace the cell with the ISO 8601 UTC
completion date and leave the row in place. Deletion is not used: which part of the path was
established when is what a later reader needs when a restore does not work.
