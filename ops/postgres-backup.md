# The estate Postgres backup

How the estate's one PostgreSQL instance (`ops/postgres.md`, Story 4-4) is backed up: a nightly
`pg_dump` of every consumer database, an offsite copy with restic, and a proof by restore on every run.
It is the artifact Story 4-5 delivers under AD-10 ("Backups are `pg_dump` on cron plus restic
offsite"), and the precondition `ops/postgres.md` § Moving a consumer names before any consumer moves
(DW-301).

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Nothing here has run on the box. Written 2026-09-30, committed on `dev`.** The authoring session read
the box (`crontab -l`, `ls /etc/cuatro`, `df`, `command -v`, `docker ps`, listings of
`/home/deploy/backups`, at 2026-09-30T11:51:43Z) and wrote nothing to it. The Operator runs § Install
and first run as `deploy` and dates each Pending Operator action at the end.

## What this covers, and what it leaves alone

| Store | Covered here? | Nature |
|---|---|---|
| Every database of `postgres-estate-postgres-1` except `postgres` and the templates: today `umami`, `cuatro_tracker`, `cs_tracker`, `cuatro_finance` (all empty until their stories move them) | **Yes.** Listed from `pg_database` on every run, so a consumer added later is covered without an edit | Decision |
| `digital-library` (SQLite and Redis) | **No, and unchanged.** Its own path, `ops/backup-digital-library.md` (Story 1-8), keeps its scripts, its bucket, its write-only token and its 30 day lifecycle rule. `pg_dump` covers none of its data (AD-10's declared exception), and Story 4.9 carries that path onto the rebuilt topology as it is | Decision |
| The three Postgres 16 containers still serving (`cuatro-portfolio-anchor-db-1`, `cuatro-tracker-postgres-1`, `cs-tracker-db-1`) | **No.** Each is backed up, or not, as today (`ops/routing-inventory.md` § Backup coverage): `~/cuatro-backup.sh` dumps the tracker nightly, nothing dumps Umami's or `cs-tracker`'s. Each consumer's move (4.7, 4.8, 4.10) brings its data under this job; DW-301 carries repointing or retiring the old backups | Decision |
| The tournament store (Supabase) | **No.** `ops/tournament-backup.sh`, unchanged | Decision |

**Point-in-time recovery stays deferred.** **Decision, 2026-09-30, from the epic.** The loss window is
the time since the last nightly dump, at most 24 hours. WAL archiving, a base backup chain and a
`pg_basebackup` schedule would narrow it to minutes at the price of a second backup system, a
continuously growing archive and a restore procedure nobody has rehearsed. Nothing in the estate today
writes data whose last day could not be re-entered or lived without (analytics events, a personal media
tracker, a self-hosted tracker). Revisit when a consumer writes something whose loss window `pg_dump`
frequency cannot cover; the first cheaper step is running this job more often, which is a capacity
decision against AD-9, not a script change.

## Restic, and its own bucket

**Decision, 2026-09-30, the Operator may overrule.** The estate's Postgres goes offsite with restic,
not with `ops/s3-object.sh`, and into a bucket of its own in the same Cloudflare R2 account.

The library's decision stands for the library and is not re-opened here
(`ops/backup-digital-library.md` § Why a bash SigV4 client and not `restic` or `rclone`): a few
kilobytes a night, one object, a token meant to be write-only, and no third-party binary on the host.
This store differs on each point:

- **AD-10 names restic** for Postgres, and the result it asks for (encrypted, offsite, retained,
  restorable, checked) is what restic does in four commands: `backup`, `forget --prune`, `check`,
  `restore`. The SigV4 client has no listing, no deletion and no integrity check, so retention and
  verification would be new bash.
- **Nothing is installed on the host.** restic runs from its official image, `restic/restic:0.19.1`,
  pinned exact (0.19.1 is the settled version, re-checked 2026-09-30 in
  `ops/settled-inputs-refresh.md`), through the Docker the box already runs. The library's objection, an
  unpinned binary on a serving box, does not arise. Observed 2026-09-30: the box has no `restic`, and has
  `flock`, `timeout` and `sha256sum`.
- **Retention needs deletion.** `forget --prune` deletes packs, so its token must delete. An R2 token is
  scoped to buckets, not to prefixes, so a deleting token on `cuatro-backups` could remove the library's
  history, which the library's record keeps out of reach (and DW-134 is still closing). A second bucket,
  suggested `cuatro-postgres-backups`, keeps that blast radius where it is: no new vendor, no new
  console, $0 at this volume.

## The method

Two committed scripts, installed beside each other in `/home/deploy/` as `ops/tournament-backup.sh` is.

| Script | Role |
|---|---|
| `ops/postgres-backup.sh` | The nightly job: dumps, offsite, retention, restore, prune. One summary line |
| `ops/postgres-restore-verify.sh` | The proof by restore. Called by the nightly job, and callable by hand on any dump |

**The stages, in order.**

| # | Stage | What it does | Summary field |
|---|---|---|---|
| 1 | lock | `flock -n` on `.postgres-backup.lock` in the backup directory, so a hand run never overlaps the cron run | none; a held lock fails the run |
| 2 | list | `pg_database`, every database that allows connections, not a template and not `postgres`. A name outside AD-3's shape is refused rather than written into a file name | `databases` |
| 3 | dump | Per database: a `psql` session opens `REPEATABLE READ, READ ONLY` and exports its snapshot; `pg_dump -Fc --snapshot` takes that snapshot; the same session then counts every table in every non-system schema; `pg_restore --list` reads the archive back; `sha256sum` | `dumps`, `tables`, `rows`, `bytes` |
| 4 | config | `/etc/cuatro/postgres-backup.env`: absent, unreadable, or missing `RESTIC_REPOSITORY` or `RESTIC_PASSWORD` | `offsite` |
| 5 | repository | `restic cat config`: exit 10 is a repository that does not exist, anything else non-zero one that cannot be reached | `offsite` |
| 6 | backup | `restic backup --json --host estate-postgres --tag estate-postgres` of this night's files, and only those | `offsite=ok-<snapshot>` |
| 7 | forget | `restic forget --host estate-postgres --tag estate-postgres --group-by host,tags --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune` | `forget` |
| 8 | check | `restic check`, the repository's structure and every snapshot's tree | `check` |
| 9 | roundtrip | `restic restore <this snapshot>` into a scratch directory; every `.sha256` and `.counts` must equal the local one | `roundtrip` |
| 10 | restore | `postgres-restore-verify.sh` on the dumps that came back from the repository | `restore` |
| 11 | prune | `find -maxdepth 1 -type f -name 'pg-*' -mtime +14 -delete` | `prune` |

**Why the counts are read inside the dump's snapshot.** `ops/tracker-backup.sh` reads its counts right
after the dump, which is correct for a run whose writers the runbook stopped. This job runs nightly
against live consumers, and Umami writes on every page view, so counts read after the dump would fail
the night whenever one landed in between. Counting in the transaction whose snapshot `pg_dump` took
means both describe one instant, and a mismatch is a real fault (§ Rehearsed off the box, the writer
run).

**The files.** In `/home/deploy/backups/estate-postgres`, mode 0600, per database and night:
`pg-<database>-<stamp>.dump`, `.dump.counts` (`schema.table`, a tab, the count) and `.dump.sha256`.
restic's cache is `.restic-cache` in the same directory; the scratch restore directory is created there
and removed on every exit path, as is the `mktemp -d` directory holding the counting session's two FIFOs.

**The restore proof.** `postgres-restore-verify.sh` checks every dump's checksum first, starts one
throwaway `postgres:18.6-trixie` (the instance's image, so the restore runs on the major that wrote the
dump) with `--network none`, restores each dump into a database of its name with `--no-owner --no-acl
--exit-on-error`, and requires the restored tables to be exactly the counted ones with every count
equal. The first difference is named with its database and table. The container is removed with its
volume on every path, a signal included, because it holds the estate's data.

### The exits

| Exit | Summary | What it means | What to do |
|---|---|---|---|
| 0 | `offsite=ok-<snapshot> ... roundtrip=sha256-match restore=verified` | Everything ran, and the dumps that came back from the repository restored with every count equal | Nothing |
| 75 | `offsite=not-configured ... restore=verified-local` | The env file does not exist. The dumps are written, verified from local disk, and pruned | Pending Operator actions 2 to 5 |
| 1 | `offsite=config-unreadable` | The env file exists and `deploy` cannot read it. The message prints the `chown` and `chmod` | Fix the ownership |
| 1 | `offsite=misconfigured` | `RESTIC_REPOSITORY` or `RESTIC_PASSWORD` is empty | Fill in the named variable |
| 1 | `offsite=not-initialized` | The repository does not exist | § Install and first run, step 4 |
| 1 | `offsite=unreachable`, `backup-failed`, `forget=failed`, `check=failed`, `roundtrip=...`, `restore=failed` | The named stage failed; its stderr says why | Read the log. If it says the repository is locked by a run that was killed (a timeout, a reboot), clear it with `docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env restic/restic:0.19.1 --no-cache unlock` |
| 1 | `dumps=failed-<database>` | A dump failed. This run's files are removed; earlier nights are untouched | Read the log |

**Exit 75 for a local-only night** follows `ops/backup-digital-library.md` § The three exits: a copy on
the box it protects is the defect AD-10 names, so it is not a success, and every local stage completes
first. **A failure after the dumps keeps them**: a broken offsite never costs the local copy, and only a
fully proved or not-configured night prunes.

**The env file reaches restic alone.** It is passed by `docker --env-file`, which the Docker client reads,
so the script never sources it and it cannot set a path, a command or a knob of this job; it sets
environment in the restic container only. Docker takes each line as `NAME=value` with nothing stripped:
no quotes, no `export`.

## Retention

| Side | Window | Nature |
|---|---|---|
| **Local**, `/home/deploy/backups/estate-postgres` | `pg-*` removed once 15 whole days old (`-mtime +14`, the arithmetic of `ops/backup-digital-library.md` § Retention), only after a proved or not-configured night | Decision |
| **Offsite**, the restic repository | `--keep-daily 14 --keep-weekly 8 --keep-monthly 6`, grouped by host and tag: two weeks of nights, two months of weeks, half a year of months | Decision |

**Grouped by host and tag, not by paths**, because every night's paths carry its stamp: restic's default
grouping would make each snapshot its own group, each the newest of its group, and nothing would ever be
forgotten. **restic keeps the oldest snapshot while a policy has unused slots** (reason `oldest daily
snapshot`, observed 2026-09-30 below), so in the first months the first night stays beside the policy's
picks; that is restic 0.19.1's behaviour, not a script choice.

## The destination and its cost

| Item | Value | Nature |
|---|---|---|
| Provider | Cloudflare R2, the account the library already uses | Decision |
| Bucket | its own, suggested `cuatro-postgres-backups`, not public | Decision (§ Restic, and its own bucket) |
| Repository | `s3:https://<account-id>.r2.cloudflarestorage.com/<bucket>` | Decision; **not yet observed against R2** (Pending Operator action 5 proves it) |
| Volume | The tracker's database dumps to 22,310 bytes (`tracker-20260929T210552Z.dump`, observed 2026-09-30); every other consumer database is empty until its move. restic deduplicates and compresses, so a year of the retention above is well under 1 GB | Observed and derived |
| **Marginal cost** | **$0.00 a month**: R2's free tier is 10 GB-month of storage, 1 million Class A and 10 million Class B operations a month (as `ops/backup-digital-library.md` § The destination and its cost read it, 2026-08-27) | Derived |
| NFR-4 ceiling | $40 to $100 a month all-in. **Untouched** | Decision |

## Recovery objectives

| Objective | Value | Nature |
|---|---|---|
| RPO | **24 hours**, one run at 03:15 | Decision; § What this covers gives the PITR deferral |
| RTO, a lost database | **1 hour**, dominated by the human steps below | Decision |
| RTO, the mechanical part | seconds at today's volume: the whole nightly run, two databases, dumps, restic, a restore and a verify, took 10 s on the authoring host | Observed 2026-09-30 |

## Configuration

| Path | Owner | Mode | Nature |
|---|---|---|---|
| `/etc/cuatro/postgres-backup.env` | `root:deploy` | `0640` | Decision: root writes it, `deploy` (the cron account) reads it, as `library-backup.env` beside it |

Outside every checkout, so no `git` operation can add it, and no deploy's `git reset --hard` touches it.

```
RESTIC_REPOSITORY=s3:https://<account-id>.r2.cloudflarestorage.com/<bucket>
RESTIC_PASSWORD=<the repository password, filed in the password manager first>
AWS_ACCESS_KEY_ID=<the R2 access key id of the token scoped to that bucket>
AWS_SECRET_ACCESS_KEY=<its secret access key>
AWS_DEFAULT_REGION=auto
```

**Nothing in that file may appear in this repository.** Losing `RESTIC_PASSWORD` loses every snapshot:
restic encrypts the repository with it and nothing else opens it.

Environment only, never the file: `POSTGRES_BACKUP_CONTAINER` (default `postgres-estate-postgres-1`),
`POSTGRES_BACKUP_DIR` (default `/home/deploy/backups/estate-postgres`), `POSTGRES_BACKUP_CONFIG` (the
file's path), `POSTGRES_RESTIC_LOCAL_REPO` (a repository on local disk, bind mounted at its own path;
empty for R2) and `POSTGRES_BACKUP_TIMEOUT` (per step, default 1800 s). The two images are pinned in the
scripts, not configurable: `restic/restic:0.19.1`, and the instance's own `postgres:18.6-trixie` for the
restore, which `ops/__tests__/postgres-backup.test.ts` holds equal to `ops/postgres/compose.yml`.

## Rehearsed off the box

Run 2026-09-30 on the authoring host (Windows 11, Docker 29.8.1), on the committed scripts but for three
lines: review then turned three unused overrides (`POSTGRES_RESTIC_IMAGE`, `POSTGRES_RESTORE_VERIFY`,
`POSTGRES_VERIFY_IMAGE`) into the constants they defaulted to, the values this run used. A throwaway
`postgres:18.6-trixie` named `pg45-live` (`PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) on
x86_64-pc-linux-gnu`) holding `cuatro_tracker` (`pg_trgm`, `public.media` 1000 rows with a trigram index,
`public.user` 2 rows) and `umami` (`public.website_event` 250 rows, `analytics.session` 3 rows, and a
procedure that inserts and commits one row every 20 ms). The scripts ran in a `docker:29-cli` container
with bash, coreutils and util-linux and the host's Docker socket, so every container they start is a
sibling on the same daemon, **as a user `deploy`** (uid 1001, gid 1001, plus the socket's group) under
`env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh`, the shape cron runs it (the
image's `docker` is in `/usr/local/bin`, which the script adds to `PATH`). The env file was
`root:deploy 0640` with a throwaway `RESTIC_PASSWORD` of 48 hex characters from `/dev/urandom`, never
printed, and a repository on local disk; restic ran from `restic/restic:0.19.1`, the official image
(pulled `sha256:136600b6...`); restic is not installed on the host. Everything was removed afterwards (§
Cleaned up). The outputs below are that run's, 2026-09-30T12:12:11Z to 12:13:31Z, cut only where marked.

**No env file:**

```
postgres-backup: /tmp/pg45proof/etc/absent.env does not exist; the local dumps are written and verified, nothing left the box (ops/postgres-backup.md § Pending Operator actions)
postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1255 exit=0
postgres-backup ts=2026-09-30T12:12:16Z databases=2 dumps=ok tables=4 rows=1255 bytes=12846 offsite=not-configured forget=skipped check=skipped roundtrip=skipped restore=verified-local prune=removed-0-aged-over-14-whole-days exit=75
-rw------- 1 1001 1001 8037 Sep 30 12:12 pg-cuatro_tracker-20260930T121211Z.dump
-rw------- 1 1001 1001   32 Sep 30 12:12 pg-cuatro_tracker-20260930T121211Z.dump.counts
-rw------- 1 1001 1001  106 Sep 30 12:12 pg-cuatro_tracker-20260930T121211Z.dump.sha256
-rw------- 1 1001 1001 4809 Sep 30 12:12 pg-umami-20260930T121211Z.dump
-rw------- 1 1001 1001   45 Sep 30 12:12 pg-umami-20260930T121211Z.dump.counts
-rw------- 1 1001 1001   97 Sep 30 12:12 pg-umami-20260930T121211Z.dump.sha256
public.media	1000
public.user	2
analytics.session	3
public.website_event	250
```

**An env file `deploy` cannot read** (`root:root 0600`), then **an env file and no repository**:

```
postgres-backup: /tmp/pg45proof/etc/unreadable.env exists and this account cannot read it: sudo chown root:deploy /tmp/pg45proof/etc/unreadable.env && sudo chmod 0640 /tmp/pg45proof/etc/unreadable.env
postgres-backup ts=2026-09-30T12:12:17Z databases=2 dumps=ok tables=4 rows=1255 bytes=12846 offsite=config-unreadable forget=not-reached check=not-reached roundtrip=not-reached restore=not-reached prune=not-reached exit=1
Fatal: repository does not exist: unable to open config file: stat /tmp/pg45proof/repo/config: no such file or directory
Is there a repository at the following location?
/tmp/pg45proof/repo
postgres-backup: the restic repository does not exist: run ops/postgres-backup.md § Install and first run, step 4 (restic init)
postgres-backup ts=2026-09-30T12:12:19Z databases=2 dumps=ok tables=4 rows=1255 bytes=12846 offsite=not-initialized forget=not-reached check=not-reached roundtrip=not-reached restore=not-reached prune=not-reached exit=1
files kept: 18
```

Eighteen files: all three nights' dumps kept although two nights failed offsite. An earlier draft
removed a night's whole dumps when its offsite half failed, so a broken repository would have left the
box with no fresh local copy either; a rehearsal at 11:56:38Z found it.

**`restic init` in the runbook's form, then three nights, the second with the writer committing
throughout.** The live count moved from 292 to 713 during the second night; its dump and counts agree on
298, and the restore from the repository proved them:

```
created restic repository <id> at /tmp/pg45proof/repo
postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1255 exit=0
postgres-backup ts=2026-09-30T12:12:32Z databases=2 dumps=ok tables=4 rows=1255 bytes=12846 offsite=ok-46a6fa95 forget=ok check=ok roundtrip=sha256-match restore=verified prune=removed-0-aged-over-14-whole-days exit=0
live before: 292
postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1303 exit=0
postgres-backup ts=2026-09-30T12:12:42Z databases=2 dumps=ok tables=4 rows=1303 bytes=13058 offsite=ok-594aadf2 forget=ok check=ok roundtrip=sha256-match restore=verified prune=removed-0-aged-over-14-whole-days exit=0
live after: 713
analytics.session	3
public.website_event	298
postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1792 exit=0
postgres-backup ts=2026-09-30T12:12:53Z databases=2 dumps=ok tables=4 rows=1792 bytes=15190 offsite=ok-8595daf4 forget=ok check=ok roundtrip=sha256-match restore=verified prune=removed-0-aged-over-14-whole-days exit=0
```

**Forget.** The second night, `594aadf2`, was forgotten and pruned by the third night's run.
`snapshots`, then `forget --dry-run` with the same policy for the reasons (cut at 100 columns):

```
ID        Time                 Host             Tags             Size
---------------------------------------------------------------------------
46a6fa95  2026-09-30 12:12:25  estate-postgres  estate-postgres  12.818 KiB
8595daf4  2026-09-30 12:12:46  estate-postgres  estate-postgres  15.107 KiB
---------------------------------------------------------------------------
2 snapshots
Applying Policy: keep 14 daily, 8 weekly, 6 monthly snapshots
keep 2 snapshots:
ID        Time                 Host             Tags             Reasons                  Paths
46a6fa95  2026-09-30 12:12:25  estate-postgres  estate-postgres  oldest daily snapshot    /tmp/pg45p
                                                                 oldest weekly snapshot   /tmp/pg45p
                                                                 oldest monthly snapshot  /tmp/pg45p
8595daf4  2026-09-30 12:12:46  estate-postgres  estate-postgres  daily snapshot           /tmp/pg45p
                                                                 weekly snapshot          /tmp/pg45p
                                                                 monthly snapshot         /tmp/pg45p
```

**`restic check`, then a restore by hand and its verify** (the restore's file list cut):

```
create exclusive lock for repository
load indexes
check all packs
check snapshots, trees and blobs
[0:00] 100.00%  2 / 2 snapshots
no errors were found
restoring snapshot b6f72dd1 of [the six files] at 2026-09-30 12:13:02.35543294 +0000 UTC by @estate-postgres to /restore
Summary: Restored 9 files/dirs (15.376 KiB) in 0:00
postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1856 exit=0
volumes before=393 after=393; verify containers left: 0
```

(`b6f72dd1` is the prune night's snapshot below; the hand restore ran after it.) The verify's container
went with its volume: the daemon's volume count did not move.

**A row planted after the dump.** A copy of the newest `cuatro_tracker` night; one row inserted into the
live `public.user`; that table's line in the copy's `.counts` rewritten with the live count, which is
what a count read after the write would hold (this job counts inside the snapshot, so the rewrite is the
only way to reach the path). The copy's `.counts` before and after, then the verify:

```
public.media	1000
public.user	3
public.media	1000
public.user	4
postgres-restore-verify: cuatro_tracker: public.user restored 3 rows, and the live database held 4 when the dump was taken
postgres-restore-verify dumps=0 sha256=match restore=not-reached tables=1 rows=1000 exit=1
verify containers left: 0
```

(The live table held 3 because an earlier attempt of this step, whose copy directory the harness could
not create, had already inserted row 3; this attempt planted row 4.)

**The prune**, with fixtures `pg-umami-20260914T031500Z.dump` aged 16 days,
`pg-umami-20260917T031500Z.dump` aged 13 and `backup.log` aged 30:

```
postgres-backup ts=2026-09-30T12:13:10Z databases=2 dumps=ok tables=4 rows=1856 bytes=15465 offsite=ok-b6f72dd1 forget=ok check=ok roundtrip=sha256-match restore=verified prune=removed-1-aged-over-14-whole-days exit=0
ls: cannot access '/tmp/pg45proof/backups/pg-umami-20260914T031500Z.dump': No such file or directory
/tmp/pg45proof/backups/backup.log
/tmp/pg45proof/backups/pg-umami-20260917T031500Z.dump
```

**Found by the rehearsals and the suite, fixed before the run above.** A counting session held as a bash
`coproc` lost its read descriptor when bash reaped the finished `psql`, which the suite hit under load
(`"${rfd}": Bad file descriptor`); the session now runs over a pair of FIFOs in a `mktemp -d` directory
that the exit trap removes. A run started in the same second as the one before it refuses rather than
overwrite (`... already exists; run it again`, exit 1, observed 12:06:19Z) and leaves the earlier run's
files, as `ops/tracker-backup.sh` does.

### Cleaned up

2026-09-30T12:13:41Z: `docker rm -f -v pg45-live pg45-runner`, and the proof directory (dumps, the
repository, both env files, the restored and planted copies) removed from the Docker VM's `/tmp`.
Afterwards no container named `pg45*` or `postgres-restore-verify*` existed, the proof directory was gone,
and the daemon's volume count was 392, one fewer than while `pg45-live` and its volume ran. The pulled
images (`postgres:18.6-trixie`, `restic/restic:0.19.1`, `docker:29-cli`) hold no data and were kept.

## Install and first run

As `deploy` on `177.7.52.248`, in order. **Preconditions:** `main` carries this story (Pending Operator
action 1) and `ops/postgres.md` § The placement has run, so `postgres-estate-postgres-1` is healthy.

1. **The bucket and its token.** In the Cloudflare dashboard, R2: create a bucket, suggested
   `cuatro-postgres-backups`, not public; create an API token scoped to that bucket alone with Object
   Read and Write (restic's `forget --prune` deletes). Generate the repository password in the password
   manager (at least 32 random characters) and file it, with the token, **before** writing any to the
   box.
2. **The env file**, written with an editor so no secret reaches the shell history:
   ```
   sudo install -o root -g deploy -m 0640 /dev/null /etc/cuatro/postgres-backup.env
   sudo nano /etc/cuatro/postgres-backup.env
   sudo stat -c '%U %G %a' /etc/cuatro/postgres-backup.env
   ```
   Paste the five lines of § Configuration with the real values. The `stat` must print `root deploy 640`.
   Skip the `install` if the file already exists: it would empty it.
3. **The scripts**, from the checkout:
   ```
   cd /home/deploy/cuatro-portfolio
   install -m 0700 ops/postgres-backup.sh ops/postgres-restore-verify.sh /home/deploy/
   cmp ops/postgres-backup.sh ~/postgres-backup.sh && cmp ops/postgres-restore-verify.sh ~/postgres-restore-verify.sh && echo installed
   install -d -m 0700 /home/deploy/backups/estate-postgres
   docker pull restic/restic:0.19.1
   ```
   It must print `installed`.
4. **Initialize the repository**, once:
   ```
   docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env restic/restic:0.19.1 --no-cache init
   ```
   It must print `created restic repository ... at s3:...`.
5. **Three runs in the shape cron runs it**, and read each summary line:
   ```
   for n in 1 2 3; do uptime; env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh /home/deploy/postgres-backup.sh; echo "exit=$?"; done
   docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env restic/restic:0.19.1 --no-cache snapshots --compact
   ```
   Every run must exit 0 with `offsite=ok-`, `forget=ok`, `check=ok`, `roundtrip=sha256-match` and
   `restore=verified`, and `snapshots` must list **2**: the third run's forget removed the second, which
   proves the token can delete. `databases=4` before any consumer has moved.
6. **The cron line**, the fourth in `deploy`'s crontab:
   ```
   ( crontab -l; echo '15 3 * * * /home/deploy/postgres-backup.sh >> /home/deploy/backups/estate-postgres/backup.log 2>&1' ) | crontab -
   crontab -l
   ```
   It must list four jobs: `30 3` `cuatro-backup.sh`, `45 3` `library-backup.sh`, `45 3`
   `tournament-backup.sh` and `15 3` `postgres-backup.sh`. 03:15 is a minute no other job uses.
7. **Prove the password from somewhere that is not the box**, as `ops/backup-digital-library.md` action
   7 did: on the workstation, with the password pasted from the password manager and the token's keys,
   `restic -r s3:https://<account-id>.r2.cloudflarestorage.com/<bucket> snapshots` must list the
   snapshots (restic from its image or a release binary; nothing is written).

**What to record here**, under a dated "First run" heading: the three summary lines, `snapshots`,
`crontab -l`, the `uptime` readings, and the outcome of step 7; then date Pending Operator actions 2 to
5. **If a step fails**, record its line and stderr, leave the cron line uninstalled, and file a DW entry.

## Restoring for real

A lost or corrupted consumer database, from the newest good night:

1. **Stop the consumer's writers** (its server and worker), as its own runbook names them.
2. **Fetch the night**, from local disk if the box survived (`/home/deploy/backups/estate-postgres`), or
   from the repository into a scratch directory:
   ```
   install -d -m 0700 /home/deploy/pg-restore
   docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env -v /home/deploy/pg-restore:/restore restic/restic:0.19.1 --no-cache restore latest --host estate-postgres --tag estate-postgres --target /restore
   ```
3. **Prove it before trusting it**: `/home/deploy/postgres-restore-verify.sh <the dump>` must end
   `restore=ok ... exit=0`.
4. **Restore into an emptied database as the consumer's role**, by the three statements of
   `ops/postgres/init/10-consumers.sh` after a `dropdb`, then `ops/postgres.md` § Moving a consumer,
   step 3's `pg_restore --no-owner --no-acl --exit-on-error` as the role.
5. **Start the writers**, check the hostname, and `rm -rf /home/deploy/pg-restore`.

## Named limits

1. **Nothing alerts on a failing night.** The summary line is greppable and the exit status is right;
   nothing reads `backup.log`. The same gap as the library's named limit 3.
2. **The R2 half is unobserved.** The repository form, `AWS_DEFAULT_REGION=auto` and the token's delete
   right are proved only by § Install and first run, step 5.
3. **`check` reads structure, not every byte.** The nightly restore reads back the night it sent in full,
   so every snapshot is read once; older packs are not re-read. `restic check --read-data` by hand
   re-reads all of them.
4. **The nightly verify starts a Postgres on the box.** About ten seconds at today's volume, at 03:15;
   the load average wins any conflict (SM-C4), so a growing database makes this a figure to re-read.
5. **The repository password exists in two places**, the env file and the password manager, and losing
   both loses every snapshot.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Merge the commit carrying the two scripts and this record into `main`** and let the Deploy run | The box checkout is `main` | _not done_ |
| 2 | **Confirm or overrule the decisions above**: restic from `restic/restic:0.19.1`, its own R2 bucket, the retention, 03:15, and PITR deferred | The spec's Design Notes carry the reasoning | _not done_ |
| 3 | **§ Install and first run, steps 1 and 2**: the bucket, the token, the password filed, the env file | Console and editor | _not done_ |
| 4 | **Steps 3 to 6**: install, `restic init`, three runs, the cron line | After `ops/postgres.md` § The placement | _not done_ |
| 5 | **Step 7, and the record**: the password proved off the box, the "First run" heading written | | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
