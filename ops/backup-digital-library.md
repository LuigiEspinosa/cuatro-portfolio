# The `digital-library` backup path

The written record of how `digital-library`'s store is backed up, what is deliberately not backed
up, where the copies go, how long they live on each side, what it costs, and how to get the data
back. It is the artifact Story 1-8 delivers.

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
Operator rather than reported as done. What is owed is enumerated at the end, as instructions.

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
`library.db` captures an empty database. Everything below turns on that one fact.

## What is backed up, and what deliberately is not

| Item | In the archive? | Nature |
|---|---|---|
| `library.db`, as a checkpointed `sqlite3 .backup` snapshot | **Yes** | **Observed.** 90112 bytes in the 2026-08-24T12:18:08Z archive |
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
bytes of content to include, and the hole never opens.

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
was 0 and no `dump.rdb` exists. If either changes the field reads
`NON-EMPTY-dbsize-<n>-and-not-in-this-archive` or gains `+dump.rdb-present-and-not-in-this-archive`,
and the run still completes, because an unreachable or newly populated cache is not a reason to skip
a database backup. It is a reason for somebody to reopen this section.

## The method

Three committed scripts, installed to `/usr/local/sbin` mode 0755 root owned, following the
precedent Story 1-5 set with `capacity-sampler.sh`.

| Script | Role |
|---|---|
| `ops/library-backup.sh` | The nightly job. Ten stages, one summary line |
| `ops/s3-object.sh` | An S3-compatible object client in bash: `put`, `get`, `selftest`. AWS SigV4 over `curl` and `openssl` |
| `ops/library-restore-verify.sh` | The real restore. Callable on its own, and called by the nightly job |

The stages, in order, and what each one is for:

| # | Stage | What it does | Summary field |
|---|---|---|---|
| 1 | snapshot | `sudo sqlite3 "$DB" ".backup"`. The live store is read, never written | `snapshot` |
| 2 | own | `sudo chown "$(id -u):$(id -g)"`. **Not `$USER`**, which is the expansion that broke the retired script | `own` |
| 3 | integrity | `PRAGMA integrity_check` on the snapshot, before anything is packed and long before anything leaves | `integrity` |
| 4 | archive | `tar` of the snapshot plus the three media directories, then `gzip -n` | `archive`, `bytes` |
| 5 | encrypt | `gpg --batch --symmetric --cipher-algo AES256` | `encrypt` |
| 6 | size | Refuse to upload above `MAX_ARCHIVE_BYTES` (default 268435456) | `size` |
| 7 | redis | Report the cache emptiness check | `redis` |
| 8 | offsite | `put` to the bucket | `offsite` |
| 9 | roundtrip | `get` the object back and compare SHA-256 | `roundtrip` |
| 10 | restore | A real restore from the bucket, below `VERIFY_MAX_BYTES` (default 33554432) | `restore` |
| 11 | prune | Local retention across all three generations of file naming | `prune` |

**One summary line, and the exit status agrees with it.** This is the whole lesson of the defect
being replaced. There is no `set -e`: every stage is checked by hand, and an `EXIT` trap prints the
summary even on a path nobody anticipated. A real run, **observed 2026-08-24T12:18:08Z**:

```
library-backup ts=2026-08-24T12:18:08Z snapshot=ok own=ok integrity=ok archive=library-20260824T121808Z.tar.gz bytes=3251 encrypt=skipped-no-passphrase size=within-ceiling redis=empty offsite=not-configured roundtrip=skipped restore=skipped prune=removed-11-older-than-14d exit=75
```

### Why exit 75 and not exit 0 when the offsite half is unconfigured

**Decided.** A local-only backup is precisely the defect AD-10 names, so a run that produced one has
not succeeded. The estate's own idiom is that a gate with no measurement is `blocked`, not `open`
(AD-9, and the "Errors and failure" row of the spine's cross-cutting table). What separates this
from the bug it replaces is that every local stage completes first, the local archive is intact on
disk, and the message names the exact file to create. 75 is `EX_TEMPFAIL`, which is what this is: a
condition that a human action clears.

### Why a bash SigV4 client and not `restic` or `rclone`

**Decided.** AD-10 asks for a path equivalent to `pg_dump` plus restic. That is a property of the
result (encrypted, offsite, retained, restorable), not an instruction to run restic.

- The box has **no `node`, no `restic`, no `rclone` and no `age`**. **Observed 2026-08-24.**
- Adding a third-party binary to a serving two-vCPU box, unattended, to move a few kilobytes a
  night, buys dedup and snapshot management this store cannot use, at the price of an unpinned
  dependency nobody in this repository can review.
- `put` and `get` against an S3-compatible endpoint are about seventy lines of `curl` and
  `openssl`, both of which are already on the box. **Observed 2026-08-24:** `curl`, `openssl 3.0.13`,
  `sqlite3 3.45.1`, `gpg 2.4.4`, `tar`, `gzip`, `find` and `od` are all present.
- The bucket stays S3-compatible, so Story 4-5 can point restic at the same bucket later without
  moving a byte.

**The signing implementation is proved, not asserted.** `ops/__tests__/library-backup.test.ts` holds
an independent SigV4 implementation in Node, checks it against the two vectors AWS publishes with
their expected signatures (`f0e8bdb8...` for the GET example and `98ad7217...` for the PUT example),
then derives this estate's golden vector from first principles and pins it. `s3-object.sh selftest`
recomputes the same Authorization header in bash and compares byte for byte. **Observed
2026-08-24T12:17Z on the box:** `selftest` exits 0 against the installed copy.

**No `list` and no `delete`, deliberately.** Offsite retention is a bucket lifecycle rule set in the
console, which keeps the token's blast radius at write-only: a compromised box can add objects and
cannot remove the history that would let the estate recover from the compromise.

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
| **Local**, `/home/deploy/backups/digital-library` | 14 days | `find -maxdepth 1 -type f -name 'library-*' -mtime +14 -delete`, run by the nightly job | **Decided**, and unchanged from the retired script's intent |
| **Offsite**, the bucket | **Not set by anything in this repository** | A bucket lifecycle rule in the vendor console. **Owed by the Operator**, action 4 below | **Decided** |

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
also be deleting history. The exit 75 path does prune, because its local half completed.

## The destination and its cost

**Decision: Cloudflare R2.** Recorded against **NFR-4**, which requires any new recurring charge to
be a named decision rather than an incidental subscription.

| Item | Value | Nature |
|---|---|---|
| Provider | Cloudflare R2, S3-compatible | **Decided** |
| Why this provider | The estate already depends on Cloudflare for all ingress (Story 1-3, `ops/bot-mitigation.md`), so this adds no vendor relationship and no new console to audit | **Decided** |
| Endpoint form | `https://<account-id>.r2.cloudflarestorage.com`, path-style addressing | **Decided** |
| Region | `auto`, which is what R2 expects | **Decided** |
| **Marginal recurring cost at this volume** | **$0.00 per month** | **Decided**, from the vendor's published free tier. **Not observed:** this build did not reach the Cloudflare console, and the Operator confirms it at bucket creation (action 2 below) |
| Free tier, as published | 10 GB of storage, 1 million Class A operations per month, 10 million Class B operations per month, and no egress charge | **Decided**, unverified by this build |
| Volume today | **3251 bytes per night**, one Class A operation (`PUT`) and two Class B (`GET`, one for the round trip and one for the restore) | **Observed 2026-08-24** |
| Where it would stop being free | Storage, not operations. At roughly 30 objects retained, the free tier ends when a single nightly archive passes roughly 340 MB. Operations would need a hundred-fold increase in run frequency to matter | **Decided**, arithmetic on the two rows above |
| NFR-4 ceiling | $40 to $100 per month all-in. **Untouched** | **Decided** |
| Portability | The scripts take endpoint, region, bucket and credentials from the environment. Moving to Backblaze B2 or any other S3-compatible store changes four values and no code | **Decided** |

## The restore procedure

Two forms. Use the first to check that a backup is good, and the second when the store is actually
gone.

### Verifying a backup, which the nightly job already does for you

```
sudo /usr/local/sbin/library-restore-verify.sh
```

With no argument it verifies the object matching the newest local archive. Give it an object key to
verify a specific night, for example
`sudo /usr/local/sbin/library-restore-verify.sh digital-library/library-20260824T034500Z.tar.gz.gpg`.

It downloads into a `mktemp -d` scratch directory, decrypts, unpacks, opens the database, asserts
`PRAGMA integrity_check` is `ok`, prints the schema object count and the row count of every table,
and removes the scratch directory on every exit path. **It never writes outside that scratch
directory**, so it is safe to run against a live box.

### Restoring for real

1. **Stop the writer, not the whole application.** `docker stop digital-library-api-1`. Nothing
   else in the compose project writes to the database.
2. **Fetch the object.** `sudo /usr/local/sbin/s3-object.sh get digital-library/<archive> /tmp/restore.tar.gz.gpg`,
   with `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in
   the environment, or by sourcing `/etc/cuatro/library-backup.env` first.
3. **Decrypt.**
   `printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output /tmp/restore.tar.gz /tmp/restore.tar.gz.gpg`
4. **Unpack to a scratch directory first, never straight over the live tree.**
   `mkdir -p /tmp/restore && tar -xzf /tmp/restore.tar.gz -C /tmp/restore`
5. **Prove it before you trust it.** `sqlite3 /tmp/restore/library.db 'PRAGMA integrity_check;'`
   must print `ok`, and `SELECT count(*) FROM users;` must return a plausible number.
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

Everything is environment driven. The nightly job reads its secrets from one file:

| Path | Owner | Mode | Nature |
|---|---|---|---|
| `/etc/cuatro/library-backup.env` | `root:root` | `0600` | **Decided.** Sourced by the scripts, so it is a shell fragment of `KEY=value` lines |

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

Every other knob has a default and is overridable in the environment, which is what makes the test
suite able to run the real script against a scratch directory:

| Variable | Default |
|---|---|
| `LIBRARY_BACKUP_CONFIG` | `/etc/cuatro/library-backup.env` |
| `LIBRARY_DATA_DIR` | `/home/deploy/digital-library/data` |
| `LIBRARY_BACKUP_DIR` | `/home/deploy/backups/digital-library` |
| `LIBRARY_RETENTION_DAYS` | `14` |
| `MAX_ARCHIVE_BYTES` | `268435456` |
| `VERIFY_MAX_BYTES` | `33554432` |
| `S3_PREFIX` | `digital-library` |
| `LIBRARY_REDIS_CONTAINER` | `digital-library-redis-1` |
| `LIBRARY_REDIS_VOLUME_DIR` | `/var/lib/docker/volumes/digital-library_redis_data/_data` |

## What is installed on the box

**Observed 2026-08-24T12:17Z.** Installed from the checkout at commit `ed9c816` by
`sudo install -o root -g root -m 0755`, and the checksums matched the committed files exactly,
which is the same proof-of-install Story 1-5 used for `capacity-sampler.sh`.

| Path | Mode | SHA-256 |
|---|---|---|
| `/usr/local/sbin/s3-object.sh` | `0755 root:root` | `2517803b4177306a445871eea530f24979ba34256437335f575d1cb40339905b` |
| `/usr/local/sbin/library-backup.sh` | `0755 root:root` | `a2993ec480dbb178268b02525f3568e386b6625871945114e01f012c7e4f830b` |
| `/usr/local/sbin/library-restore-verify.sh` | `0755 root:root` | `f4ef296520cc9e3847799dac12c35605ded9111a3e75ac6ab7f326e763e4b9f4` |

**The crontab, after. Observed 2026-08-24T12:19Z**, `crontab -l` for `deploy`. Root still has none.

```
30 3 * * * /home/deploy/cuatro-backup.sh >> /home/deploy/backups/cuatro-tracker/backup.log 2>&1
45 3 * * * /usr/local/sbin/library-backup.sh >> /home/deploy/backups/digital-library/backup.log 2>&1
```

Two jobs, unchanged in count and schedule. Only the library job's path moved.

### The cron environment, tested rather than reasoned about

The defect being replaced was an environment defect, so the replacement was run in that exact
environment: `env -i HOME=... LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh`, with no `USER`.
**Observed 2026-08-24T12:19Z**, both scripts, back to back:

| Script | Exit | Output |
|---|---|---|
| `library-backup.sh.retired-2026-08-24` | 1 | `line 13: USER: unbound variable`, and nothing else |
| `/usr/local/sbin/library-backup.sh` | 75 | The full summary line, `snapshot=ok own=ok integrity=ok ... prune=removed-0-older-than-14d exit=75` |

### The live store was not touched

**Observed 2026-08-24**, immediately before and immediately after the first full run. Same three
files, same sizes, same modification times to the nanosecond, same SHA-256.

| File | Bytes | mtime | SHA-256 (unchanged) |
|---|---|---|---|
| `library.db` | 4096 | `2026-07-30 06:09:04.874699875 +0000` | `d405fbc2...` |
| `library.db-wal` | 152472 | `2026-08-14 09:16:05.332957422 +0000` | `9260554e...` |
| `library.db-shm` | 32768 | `2026-08-14 09:16:05.332957422 +0000` | `0f144c60...` |

No container was restarted. **Observed 2026-08-24T12:19Z:** all three `digital-library` containers
still `Up 3 weeks (healthy)`, and `https://library.cuatro.dev/` answered.

### The archive, opened

**Observed 2026-08-24T12:18:08Z**, by unpacking `library-20260824T121808Z.tar.gz` in `/tmp`.

```
-rw-r--r-- deploy/deploy 90112 2026-08-24 12:18 library.db
drwxr-xr-x root/root         0 2026-07-30 06:11 books/
drwxr-xr-x root/root         0 2026-07-30 06:11 covers/
drwxr-xr-x root/root         0 2026-07-30 06:11 inbox/
```

`PRAGMA integrity_check` returned `ok`. `sqlite_master` holds 23 rows, of which 11 are tables:
`users` 1 row, `sessions` 1 row, `books_fts_config` 1, `books_fts_data` 2, and `books`,
`books_fts`, `books_fts_docsize`, `books_fts_idx`, `libraries`, `reading_progress` and
`user_libraries` all 0. That matches Story 1-7's reading of the old snapshots exactly, which is
independent evidence that the new archive captures the same database.

**The whole of `digital-library`'s state fits in a 3251 byte file.** This is a correctness and
offsite problem, not a volume problem.

## Named limits

Written down because a coverage claim with an unstated hole reads as coverage.

1. **There is no offsite copy yet.** Until the Operator completes actions 1 to 4, the nightly job
   exits 75 every night and the estate's only copies of `digital-library` are on the box being
   backed up. **This is the state as of 2026-08-24.**
2. **Nothing has been sent to a real S3 endpoint by this build.** The SigV4 implementation is
   proved against AWS's own published vectors and against an independent implementation, and the
   `put` and `get` paths are proved against a stub endpoint in the test suite. **A live 200 from
   Cloudflare R2 has not been observed**, and action 5 below is where it is.
3. **Nothing alerts if the nightly job starts failing.** Cron appends to
   `/home/deploy/backups/digital-library/backup.log` and nobody reads it. The exit status is
   correct and the summary line is greppable, and neither is monitored. This is the same class of
   gap that let the retired script fail for 25 nights unnoticed, and it is recorded in
   `_bmad-output/implementation-artifacts/deferred-work.md` rather than solved here, because
   `ops/monitoring.md` is another story's file.
4. **Offsite retention is set by nobody until the Operator sets it.** The scripts never delete an
   object, deliberately. If no lifecycle rule is created, objects accumulate. Nothing is lost, and
   the cost line eventually stops being $0.
5. **The passphrase is the only thing between the bucket and the data, and there is no escrow.**
   Lose it and every offsite object is unreadable. Action 3 below says where to put it.
6. **Redis is not backed up.** Correct today on the evidence above, and it is a decision that
   expires the moment `DBSIZE` is not 0. The nightly job reports it; nothing enforces it.
7. **The other three projects in the estate still have no offsite backup, and two have no backup at
   all.** Story 1-8 scopes `digital-library` only. The estate-wide gap is in the deferred ledger,
   and `cuatro-backup.sh`'s claim to complement a Hostinger weekly snapshot remains an unverified
   comment in a script.
8. **`put` reads the whole body into memory.** Acceptable only because the run refuses to upload
   above `MAX_ARCHIVE_BYTES`, which is why that check exists rather than being trusted to stay
   small.
9. **No rendered-output or browser check is claimed anywhere in this story.** Playwright arrives in
   Story 1-10.

## Pending Operator actions

Everything an agent could do is done and committed. These five are console and shell acts.

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Create the R2 bucket.** In the Cloudflare dashboard, R2, Create bucket. Name it something the estate will recognise, for example `cuatro-digital-library-backup`. Note the account id from the endpoint `https://<account-id>.r2.cloudflarestorage.com` | Location hint may be left automatic. Do **not** make the bucket public | _not done_ |
| 2 | **Confirm the cost line before you rely on it.** On the same page, read the current free tier for storage and for Class A and Class B operations, and correct the "The destination and its cost" table above if the published numbers have moved | This row exists because this build could not reach the console, and the $0.00 in that table is a decision, not an observation | _not done_ |
| 3 | **Create an API token scoped to that one bucket, with Object Read and Write and nothing else.** R2, Manage API tokens, Create API token. Copy the Access Key ID and the Secret Access Key once, because the secret is shown once. Generate a passphrase of at least 32 random characters and store all three in the password manager **before** writing them to the box | Object Read is needed as well as Write, because the round trip and the restore both read the object back. Read is not a widening of the write-only stance: the token still cannot delete | _not done_ |
| 4 | **Write the config file on the box.** As `deploy` on `177.7.52.248`: `sudo install -d -o root -g root -m 0700 /etc/cuatro`, then `sudo install -o root -g root -m 0600 /dev/null /etc/cuatro/library-backup.env`, then `sudo nano /etc/cuatro/library-backup.env` and paste the six lines under "Configuration" with the real values. Verify with `sudo stat -c '%U %G %a' /etc/cuatro/library-backup.env`, which must print `root root 600` | Use an editor, not `echo`, so the secret never reaches the shell history | _not done_ |
| 5 | **Set the offsite lifecycle rule.** In the bucket's Settings, Object lifecycle rules, add a rule that deletes objects under the prefix `digital-library/` after 30 days | 30 days offsite against 14 local is deliberate: the offsite copy is the one that survives losing the box, so it should outlive the local one | _not done_ |
| 6 | **Run it once by hand and read the summary line.** `sudo /usr/local/sbin/library-backup.sh`. It must exit **0** and the line must read `offsite=ok-digital-library/library-...`, `roundtrip=sha256-match` and `restore=verified`. Anything else, read the message above the summary line: it names what failed | This is the first live request this estate will have made to R2, and it settles named limit 2 | _not done_ |
| 7 | **Paste that summary line into this file**, under a new "First offsite run" heading with its UTC date, and change named limit 1 to say the state it describes has ended | The record is the artifact. A backup path nobody wrote down is one nobody can audit | _not done_ |

**Maintaining this file.** When an action is performed, replace the cell with the ISO 8601 UTC
completion date and leave the row in place. Deletion is not used: which part of the path was
established when is what a later reader needs when a restore does not work.
