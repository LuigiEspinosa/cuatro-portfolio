#!/usr/bin/env bash
# The nightly `digital-library` backup (Story 1-8, AD-10).
#
# This replaces `/home/deploy/library-backup.sh`, which aborted on its line 13
# every night from 2026-07-31 because `cron` sets no `USER` and the script ran
# under `set -u`. The interesting part of that defect is not that it failed. It
# is that it failed halfway, wrote a perfectly good snapshot, reported failure,
# and never pruned, so the log said broken while the data was fine. A backup in
# that shape is worse than no backup, because the Operator learns to ignore it.
#
# So the contract here is that one summary line carries every stage's verdict
# and the exit status agrees with that line, on every path including the
# unexpected ones and including a signal. There is no `set -e`: every stage is
# checked by hand, and traps on EXIT, INT, TERM and HUP print the summary even
# when something nobody anticipated goes wrong. `$USER` appears nowhere;
# ownership comes from `id -u` and `id -g`.
#
# Eleven stages, in order:
#
#   1  snapshot   sqlite3 .backup, never a file copy. library.db is one 4096
#                 byte page and the whole database lives in the WAL, so `cp`
#                 would capture an empty database.
#   2  own        take the root-owned snapshot, by uid and gid, never $USER
#   3  integrity  PRAGMA integrity_check plus a schema floor, before anything
#                 leaves. A valid but empty database is what a naive copy of
#                 library.db produces, so passing integrity_check alone is not
#                 evidence of anything.
#   4  archive    tar the snapshot plus books, covers and inbox, then gzip
#   5  encrypt    gpg --symmetric AES256, because the destination is third
#                 party and the database holds a user row and a session row
#   6  size       refuse to upload above MAX_ARCHIVE_BYTES
#   7  redis      report whether the cache is still empty rather than assume it
#   8  offsite    put
#   9  roundtrip  get the object back and compare sha256
#   10 restore    a real restore from the bucket, below VERIFY_MAX_BYTES
#   11 prune      local retention across all three generations of file naming
#
# Exit codes: 0 the whole path completed, 75 (EX_TEMPFAIL) the local half
# completed and the offsite half is not configured yet, 1 anything else. 75 is
# deliberate. A local-only backup is precisely the defect AD-10 names, so a run
# that produced one has not succeeded, and the estate's own idiom is that a gate
# with no measurement is blocked rather than open.
#
# This runs from `deploy`'s crontab, as `deploy`. Everything below is written to
# work from that account, which is why `/etc/cuatro/library-backup.env` is
# root owned and group readable by `deploy` rather than mode 0600 root only.

set -uo pipefail

PROGRAM='library-backup'

# `cron` hands a job a minimal PATH. Appended rather than replaced, so a caller
# that put a directory in front of PATH still wins.
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

# The box is Etc/UTC. Set anyway so a copy of this on a box that is not UTC
# still stamps ISO 8601 UTC.
TZ=UTC
export TZ

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

CONFIG_FILE="${LIBRARY_BACKUP_CONFIG:-/etc/cuatro/library-backup.env}"

# --- the summary line ---------------------------------------------------------
#
# Declared before anything can fail, so the traps below always have something to
# print. Every value is a single token with no space in it, so the line stays
# greppable and one field can never be read as two.

v_snapshot='not-reached'
v_own='not-reached'
v_integrity='not-reached'
v_objects='0'
v_archive='none'
v_tar='not-reached'
v_bytes='0'
v_encrypt='not-reached'
v_size='not-reached'
v_redis='not-checked'
v_offsite='not-reached'
v_roundtrip='not-reached'
v_restore='not-reached'
v_prune='not-reached'

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SUMMARY_PRINTED=0
WORK=''
WORK_CREATED=0
LOCK_DIR=''
LOCK_HELD=0

print_summary() {
  local code="$1"
  [ "${SUMMARY_PRINTED}" -eq 0 ] || return 0
  SUMMARY_PRINTED=1
  printf '%s ts=%s snapshot=%s own=%s integrity=%s objects=%s archive=%s tar=%s bytes=%s encrypt=%s size=%s redis=%s offsite=%s roundtrip=%s restore=%s prune=%s exit=%s\n' \
    "${PROGRAM}" "${STARTED_AT}" "${v_snapshot}" "${v_own}" "${v_integrity}" \
    "${v_objects}" "${v_archive}" "${v_tar}" "${v_bytes}" "${v_encrypt}" \
    "${v_size}" "${v_redis}" "${v_offsite}" "${v_roundtrip}" "${v_restore}" \
    "${v_prune}" "${code}"
}

# Only ever removes a directory this run created, and only one that still looks
# like the one `mktemp` handed over. The config file is read through an
# allowlist that cannot reach WORK, and this is the second lock on the same
# door: an `rm -rf` driven by a variable is worth two guards.
release_work() {
  [ "${WORK_CREATED}" -eq 1 ] || return 0
  [ -n "${WORK}" ] || return 0
  [ -d "${WORK}" ] || return 0
  case "${WORK}" in
    */library-backup-??????) rm -rf -- "${WORK}" ;;
  esac
}

release_lock() {
  [ "${LOCK_HELD}" -eq 1 ] || return 0
  [ -n "${LOCK_DIR}" ] || return 0
  rm -rf -- "${LOCK_DIR}"
  LOCK_HELD=0
}

finish() {
  local code=$?
  print_summary "${code}"
  release_work
  release_lock
}

# Bash does not run an EXIT trap on an untrapped fatal signal, so a SIGTERM
# would otherwise leave no summary line, a scratch directory holding a plaintext
# database, and a lock nobody releases. Each signal exits with its conventional
# 128 plus signal number, which then runs the EXIT trap.
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

note() {
  printf '%s: %s\n' "${PROGRAM}" "$*"
}

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit "${2:-1}"
}

# --- configuration ------------------------------------------------------------
#
# Read before any path or knob is resolved, so a value set in the config file
# actually takes effect rather than being silently overwritten by a default.
#
# Read through an allowlist, and in a subshell with a cleared environment, so
# the file cannot reach anything else. A hand-edited config that happens to
# assign WORK, BACKUP_DIR, CONFIG_FILE or the path of an executable this script
# calls would otherwise be able to redirect the run, and the EXIT trap would
# then remove whatever WORK became. The file carries secrets and tuning. It does
# not carry paths, and it cannot.

CONFIG_ALLOWLIST='S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY BACKUP_PASSPHRASE S3_PREFIX S3_CONNECT_TIMEOUT S3_MAX_TIME LIBRARY_RETENTION_DAYS MAX_ARCHIVE_BYTES VERIFY_MAX_BYTES LIBRARY_REDIS_CONTAINER LIBRARY_REDIS_VOLUME_DIR'

# `absent` and `unreadable` are deliberately different answers. Absent is a
# state the Operator has not reached yet and the remedy is to create the file.
# Unreadable means the file exists and this account cannot read it, which is the
# shape a root only mode 0600 config takes when the job runs as `deploy`, and
# telling the Operator to create a file that already exists would send them the
# wrong way. `sudo test -e` is the second opinion, because a directory this
# account cannot traverse makes a plain `[ -e ]` indistinguishable from absence.
CONFIG_STATE='absent'
if [ -e "${CONFIG_FILE}" ] || sudo test -e "${CONFIG_FILE}" 2>/dev/null; then
  CONFIG_STATE='unreadable'
  if CONFIG_VALUES="$(
    env -i PATH="${PATH}" CUATRO_CONFIG_FILE="${CONFIG_FILE}" CUATRO_ALLOW="${CONFIG_ALLOWLIST}" \
      bash -c '
        set +u
        . "${CUATRO_CONFIG_FILE}" || exit 1
        for name in ${CUATRO_ALLOW}; do
          if [ -n "${!name+set}" ]; then printf "%s=%q\n" "${name}" "${!name}"; fi
        done
      ' 2>/dev/null
  )"; then
    eval "${CONFIG_VALUES}"
    CONFIG_STATE='readable'
  fi
fi

DATA_DIR="${LIBRARY_DATA_DIR:-/home/deploy/digital-library/data}"
BACKUP_DIR="${LIBRARY_BACKUP_DIR:-/home/deploy/backups/digital-library}"
RETENTION_DAYS="${LIBRARY_RETENTION_DAYS:-14}"
MAX_ARCHIVE_BYTES="${MAX_ARCHIVE_BYTES:-268435456}"
VERIFY_MAX_BYTES="${VERIFY_MAX_BYTES:-33554432}"
S3_PREFIX="${S3_PREFIX:-digital-library}"
S3_CLIENT="${S3_OBJECT_CLIENT:-${HERE}/s3-object.sh}"
RESTORE_VERIFY="${LIBRARY_RESTORE_VERIFY:-${HERE}/library-restore-verify.sh}"
REDIS_CONTAINER="${LIBRARY_REDIS_CONTAINER:-digital-library-redis-1}"
REDIS_VOLUME_DIR="${LIBRARY_REDIS_VOLUME_DIR:-/var/lib/docker/volumes/digital-library_redis_data/_data}"
DOCKER_TIMEOUT="${LIBRARY_DOCKER_TIMEOUT:-15}"

DB="${DATA_DIR}/library.db"

# Without `set -e`, a `-gt` against a non-numeric operand returns 2, the `if`
# reads false, and the size ceiling is bypassed while the summary still says
# `within-ceiling`. The ceiling is the entire justification for `put` buffering
# the body in memory, so it is not allowed to fail open.
require_whole_number() {
  case "$2" in
    ''|*[!0-9]*) fail "$1 must be a whole number, got: '$2'" ;;
  esac
}
require_whole_number 'LIBRARY_RETENTION_DAYS' "${RETENTION_DAYS}"
require_whole_number 'MAX_ARCHIVE_BYTES' "${MAX_ARCHIVE_BYTES}"
require_whole_number 'VERIFY_MAX_BYTES' "${VERIFY_MAX_BYTES}"
require_whole_number 'LIBRARY_DOCKER_TIMEOUT' "${DOCKER_TIMEOUT}"

# --- retention ----------------------------------------------------------------
#
# Three generations of naming have existed in this directory and the prune has
# to cover all of them, which is the second of the two bugs Story 1-7 found:
#
#   library-YYYY-MM-DD_HHMM.db.gz         the original, compressed
#   library-YYYY-MM-DD_HHMM.db            25 of these, root owned, uncompressed,
#                                         left by the failing script and matched
#                                         by no prune pattern it ever ran
#   library-YYYYMMDDTHHMMSSZ.tar.gz.gpg   this script
#
# So the pattern is `library-*` and nothing narrower, bounded to regular files
# at depth one so `backup.log` and anything an Operator parks in a subdirectory
# survive. `find -mtime +N` matches a file whose age in whole 24-hour units is
# greater than N, so with N of 14 a file is removed once it is 15 whole days
# old, not 14. Offsite retention is not done here and never will be: it is a
# bucket lifecycle rule, which is what keeps the token write-only.
prune_local() {
  local removed rc
  removed="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'library-*' \
    -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
  rc=$?
  if [ "${rc}" -ne 0 ] || [ -z "${removed}" ]; then
    v_prune='failed'
    return 1
  fi
  v_prune="removed-${removed}-aged-over-${RETENTION_DAYS}-whole-days"
  return 0
}

# --- preflight ----------------------------------------------------------------

[ -d "${DATA_DIR}" ] || fail "the store directory ${DATA_DIR} does not exist"
mkdir -p "${BACKUP_DIR}" || fail "cannot create ${BACKUP_DIR}"

# One run at a time. The record instructs the Operator to run this by hand, and
# a hand run overlapping the 03:45 cron run would share one backup directory,
# one prune and one object namespace keyed only to the second of them. `mkdir`
# is the lock because it is atomic on every filesystem this will ever see.
LOCK_DIR="${LIBRARY_BACKUP_LOCK:-${BACKUP_DIR}/.library-backup.lock}"
if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  holder="$(cat "${LOCK_DIR}/pid" 2>/dev/null)"
  # `/proc/<pid>` rather than `kill -0`, because `kill -0` cannot distinguish a
  # process that has gone from one this account may not signal, and reading the
  # second as "gone" would break the lock exactly when it matters. A lock whose
  # holder cannot be identified at all is treated as held: refusing a run is
  # recoverable, two runs sharing one prune and one object namespace is not.
  holder_alive=0
  if [ -z "${holder}" ]; then
    holder_alive=1
  elif [ -d "/proc/${holder}" ]; then
    holder_alive=1
  elif [ ! -d /proc/self ] && kill -0 "${holder}" 2>/dev/null; then
    holder_alive=1
  fi
  if [ "${holder_alive}" -eq 1 ]; then
    fail "another library-backup run (pid ${holder:-unknown}) holds ${LOCK_DIR}. Refusing to run two backups over one directory, one prune and one object namespace"
  fi
  # The holder is gone, so the lock is stale from a run that was killed before
  # its traps could release it. Taken over rather than waited on, because a
  # nightly job that silently stops running is the failure this story is about.
  note "taking over a stale lock at ${LOCK_DIR}, left by pid ${holder:-unknown}"
  rm -rf -- "${LOCK_DIR}"
  mkdir "${LOCK_DIR}" || fail "cannot create the lock directory ${LOCK_DIR}"
fi
LOCK_HELD=1
printf '%s\n' "$$" > "${LOCK_DIR}/pid" 2>/dev/null

WORK="$(mktemp -d "${TMPDIR:-/tmp}/library-backup-XXXXXX")" \
  || fail 'cannot create a working directory'
WORK_CREATED=1

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="library-${STAMP}"

# --- 1 snapshot ---------------------------------------------------------------
#
# `.backup` and not `cp`. The live store is read and never written. The busy
# timeout matters: without one, a transient lock held by the application loses
# the whole night rather than costing thirty seconds.

SNAP="${WORK}/library.db"
if ! sudo sqlite3 -cmd '.timeout 30000' "${DB}" ".backup '${SNAP}'"; then
  v_snapshot='failed'
  fail "sqlite3 .backup of ${DB} failed, so no snapshot exists to back up"
fi
[ -s "${SNAP}" ] || { v_snapshot='empty'; fail 'sqlite3 .backup produced an empty file'; }
v_snapshot='ok'

# --- 2 own --------------------------------------------------------------------
#
# The snapshot is written by root because the live database is. `$USER` is not
# set under cron and is what broke the script this replaces, so ownership is
# taken by numeric uid and gid, which are always available.

if ! sudo chown "$(id -u):$(id -g)" "${SNAP}"; then
  v_own='failed'
  fail 'cannot take ownership of the snapshot'
fi
v_own='ok'

# --- 3 integrity --------------------------------------------------------------
#
# Before anything is packed and long before anything is uploaded. Shipping a
# corrupt snapshot offsite would replace an absent backup with a false one.
#
# `integrity_check` alone is not enough. An empty SQLite file passes it, and an
# empty SQLite file is exactly what a `cp` of this store's 4096 byte main file
# produces, so the schema floor below is what distinguishes a real snapshot from
# the specific wrong answer this store invites.

if ! INTEGRITY="$(sqlite3 "${SNAP}" 'PRAGMA integrity_check;' 2>&1)"; then
  v_integrity='failed'
  fail "the snapshot would not open for PRAGMA integrity_check (${INTEGRITY}), so nothing was uploaded"
fi
if [ "${INTEGRITY}" != 'ok' ]; then
  v_integrity='failed'
  fail "the snapshot fails PRAGMA integrity_check (${INTEGRITY}), so nothing was uploaded"
fi

if ! OBJECTS="$(sqlite3 "${SNAP}" 'SELECT count(*) FROM sqlite_master;' 2>&1)"; then
  v_integrity='failed'
  fail "the snapshot would not answer a schema object count (${OBJECTS}), so nothing was uploaded"
fi
case "${OBJECTS}" in
  ''|*[!0-9]*)
    v_integrity='failed'
    fail "the snapshot answered a schema object count that is not a number (${OBJECTS}), so nothing was uploaded"
    ;;
esac
if [ "${OBJECTS}" -lt 1 ]; then
  v_integrity='failed'
  v_objects='0'
  fail 'the snapshot holds no schema objects at all, which is what a file copy of this store would produce, so nothing was uploaded'
fi
v_objects="${OBJECTS}"
v_integrity='ok'

# --- 4 archive ----------------------------------------------------------------
#
# The database plus the media tree. `books`, `covers` and `inbox` are empty
# today and `digital-library` is a book reader, so a path that backed up only
# the database would be a coverage claim with a hole in it the first time
# somebody uploads a file. Three empty directories cost nothing to include.
#
# `tar` exits 1 on "file changed as we read it", which is not corruption and not
# a reason to lose the night. It is also guaranteed to start happening the first
# time the media tree stops being empty, so it is retried once and the retry
# gets its own field in the summary rather than being hidden.

TARBALL="${WORK}/${BASE}.tar"
run_tar() {
  sudo tar -cf "${TARBALL}" -C "${WORK}" library.db -C "${DATA_DIR}" books covers inbox 2> "${WORK}/tar.err"
}

if run_tar; then
  v_tar='first-attempt'
else
  if grep -qi 'changed as we read it' "${WORK}/tar.err" 2>/dev/null; then
    note "tar reported a file changing under it, retrying once: $(tr '\n' ' ' < "${WORK}/tar.err")"
    sudo rm -f "${TARBALL}"
    if run_tar; then
      v_tar='retried-once-after-file-changed'
    else
      v_tar='retried-once-and-failed'
      v_archive='failed'
      fail "cannot archive the snapshot and the media tree under ${DATA_DIR} even after one retry: $(tr '\n' ' ' < "${WORK}/tar.err")"
    fi
  else
    v_tar='first-attempt'
    v_archive='failed'
    fail "cannot archive the snapshot and the media tree under ${DATA_DIR}: $(tr '\n' ' ' < "${WORK}/tar.err")"
  fi
fi

if ! sudo chown "$(id -u):$(id -g)" "${TARBALL}"; then
  v_archive='failed'
  fail 'cannot take ownership of the archive'
fi
if ! gzip -n -f "${TARBALL}"; then
  v_archive='failed'
  fail 'cannot gzip the archive'
fi
TARBALL="${TARBALL}.gz"
# Named for the artifact that exists right now. It becomes the `.gpg` name only
# once gpg has actually produced one, so a failed encrypt can never leave a
# summary line naming a file nobody ever wrote.
v_archive="${BASE}.tar.gz"

# --- 5 encrypt ----------------------------------------------------------------
#
# Everything that leaves this box is encrypted before it leaves, because the
# destination is a third party and the database holds a user row and a session
# row. The local artifact is encrypted too, using the same passphrase, so the
# file the round trip compares is the file that was uploaded.
#
# Without a passphrase there is nothing to encrypt with, and there is also no
# bucket to upload to, so the run is heading for the exit 75 or the
# config-unreadable path. The local archive stays as a `.tar.gz` in that case.
# That is deliberate rather than a gap: it sits on the same disk as the
# plaintext database it was taken from, so encrypting it while the source is in
# the clear would protect nothing.

ARTIFACT=''
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  ENCRYPTED="${WORK}/${BASE}.tar.gz.gpg"
  if ! printf '%s' "${BACKUP_PASSPHRASE}" | gpg --batch --yes --quiet \
    --pinentry-mode loopback --passphrase-fd 0 \
    --symmetric --cipher-algo AES256 \
    --output "${ENCRYPTED}" "${TARBALL}"; then
    v_encrypt='failed'
    fail 'gpg --symmetric failed, so nothing was uploaded'
  fi
  v_encrypt='aes256'
  v_archive="${BASE}.tar.gz.gpg"
  ARTIFACT="${ENCRYPTED}"
else
  case "${CONFIG_STATE}" in
    unreadable) v_encrypt='skipped-config-unreadable' ;;
    *) v_encrypt='skipped-no-passphrase' ;;
  esac
  ARTIFACT="${TARBALL}"
fi

LOCAL_COPY="${BACKUP_DIR}/$(basename -- "${ARTIFACT}")"
if [ -e "${LOCAL_COPY}" ]; then
  fail "an archive already exists at ${LOCAL_COPY}. Refusing to overwrite a previous run's output"
fi
if ! mv "${ARTIFACT}" "${LOCAL_COPY}"; then
  fail "cannot move the archive into ${BACKUP_DIR}"
fi
chmod 0640 "${LOCAL_COPY}" 2>/dev/null

# A hand run under `sudo` would otherwise leave a root-owned file in a directory
# `deploy` owns, which is one of the exact defects this story exists to remove.
# Nightly runs are already `deploy` and this does nothing for them.
if [ "$(id -u)" -eq 0 ]; then
  DIR_OWNER="$(stat -c '%u:%g' "${BACKUP_DIR}" 2>/dev/null)"
  if [ -n "${DIR_OWNER}" ]; then
    chown "${DIR_OWNER}" "${LOCAL_COPY}" 2>/dev/null
  fi
fi

# --- 6 size ceiling -----------------------------------------------------------
#
# `s3-object.sh put` reads the whole body into memory, on a two vCPU box that is
# serving. The ceiling is what makes that acceptable, so it is checked here
# rather than trusted to stay small.

BYTES="$(wc -c < "${LOCAL_COPY}" | tr -d ' ')"
require_whole_number 'the archive byte count' "${BYTES}"
v_bytes="${BYTES}"
if [ "${BYTES}" -gt "${MAX_ARCHIVE_BYTES}" ]; then
  v_size='over-ceiling'
  fail "the archive is ${BYTES} bytes, above the MAX_ARCHIVE_BYTES ceiling of ${MAX_ARCHIVE_BYTES} bytes, so it was not uploaded. The local copy is kept at ${LOCAL_COPY}"
fi
v_size='within-ceiling'

# --- 7 the cache --------------------------------------------------------------
#
# `digital-library_redis_data` has been empty since the volume was created and
# nothing in the archive covers it. That is a defensible exclusion only while it
# stays true, so the run checks and reports rather than the record asserting it
# once and going stale. Reported, never fatal: an unreachable Docker is not a
# reason to skip a database backup, which is exactly why the probe is bounded.
# A check the script declares non-fatal must not be able to block the run.

REDIS_DBSIZE=''
if REDIS_DBSIZE="$(timeout "${DOCKER_TIMEOUT}" docker exec "${REDIS_CONTAINER}" redis-cli DBSIZE 2>/dev/null)"; then
  REDIS_DBSIZE="${REDIS_DBSIZE//[!0-9]/}"
  if [ -z "${REDIS_DBSIZE}" ]; then
    v_redis='unparsable'
  elif [ "${REDIS_DBSIZE}" -eq 0 ]; then
    v_redis='empty'
  else
    v_redis="NON-EMPTY-dbsize-${REDIS_DBSIZE}-and-not-in-this-archive"
  fi
else
  v_redis='unreachable'
fi
if sudo test -e "${REDIS_VOLUME_DIR}/dump.rdb" 2>/dev/null; then
  v_redis="${v_redis}+dump.rdb-present-and-not-in-this-archive"
fi

# --- the offsite gate ---------------------------------------------------------
#
# Two different answers, deliberately. Absent is a state the Operator has not
# reached yet. Unreadable means the file is there and this account cannot read
# it, which is what a mode 0600 root-only config looks like to the `deploy`
# account this job actually runs as, and the remedy is completely different.

if [ "${CONFIG_STATE}" = 'unreadable' ]; then
  if ! prune_local; then
    v_offsite='config-unreadable'
    fail "the local retention prune of ${BACKUP_DIR} failed, and ${CONFIG_FILE} exists but cannot be read"
  fi
  v_offsite='config-unreadable'
  v_roundtrip='skipped'
  v_restore='skipped'
  note "the local half is complete and intact at ${LOCAL_COPY}, and there is no offsite copy."
  note "${CONFIG_FILE} exists and this account (uid $(id -u), $(id -un 2>/dev/null)) cannot read it. Do not create it again."
  note "fix it with: sudo chown root:$(id -gn 2>/dev/null) ${CONFIG_FILE} && sudo chmod 0640 ${CONFIG_FILE} && sudo chmod 0755 $(dirname -- "${CONFIG_FILE}")"
  fail 'exiting 1 because the offsite configuration exists and is unreadable, which is a misconfiguration rather than an unfinished setup'
fi

if [ "${CONFIG_STATE}" = 'absent' ]; then
  if ! prune_local; then
    v_offsite='not-configured'
    fail "the local retention prune of ${BACKUP_DIR} failed, and the offsite half is not configured"
  fi
  v_offsite='not-configured'
  v_roundtrip='skipped'
  v_restore='skipped'
  note "the local half is complete and intact at ${LOCAL_COPY}, and there is no offsite copy."
  note "to finish this, create ${CONFIG_FILE} owned root:$(id -gn 2>/dev/null) mode 0640, in a directory mode 0755, holding S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and BACKUP_PASSPHRASE. The procedure is in ops/backup-digital-library.md."
  fail 'exiting 75 because a local-only backup is the defect AD-10 names, not a success' 75
fi

MISSING=()
[ -n "${S3_ENDPOINT:-}" ] || MISSING+=('S3_ENDPOINT')
[ -n "${S3_BUCKET:-}" ] || MISSING+=('S3_BUCKET')
[ -n "${S3_ACCESS_KEY_ID:-}" ] || MISSING+=('S3_ACCESS_KEY_ID')
[ -n "${S3_SECRET_ACCESS_KEY:-}" ] || MISSING+=('S3_SECRET_ACCESS_KEY')
[ -n "${BACKUP_PASSPHRASE:-}" ] || MISSING+=('BACKUP_PASSPHRASE')
if [ "${#MISSING[@]}" -gt 0 ]; then
  v_offsite='misconfigured'
  fail "${CONFIG_FILE} exists and is readable but is missing required configuration: ${MISSING[*]}. The local copy is kept at ${LOCAL_COPY}"
fi

export S3_ENDPOINT
export S3_REGION="${S3_REGION:-auto}"
export S3_BUCKET
export S3_ACCESS_KEY_ID
export S3_SECRET_ACCESS_KEY
export BACKUP_PASSPHRASE
# So the restore verifier this run calls is the one this run was configured
# with, rather than whichever copy happens to sit beside it.
export S3_OBJECT_CLIENT="${S3_CLIENT}"
export S3_PREFIX
export LIBRARY_BACKUP_CONFIG="${CONFIG_FILE}"
export LIBRARY_BACKUP_DIR="${BACKUP_DIR}"

KEY="${S3_PREFIX}/$(basename -- "${LOCAL_COPY}")"

# --- 8 offsite ----------------------------------------------------------------

if ! UPLOADED_SHA="$(bash "${S3_CLIENT}" put "${LOCAL_COPY}" "${KEY}")"; then
  v_offsite='put-failed'
  fail "the archive could not be uploaded to ${KEY}. The local copy is kept at ${LOCAL_COPY}"
fi
v_offsite="ok-${KEY}"

# --- 9 the round trip ---------------------------------------------------------
#
# A 2xx on the PUT says the endpoint accepted the request. It does not say the
# bytes in the bucket are the bytes on this disk. So they are read back.

if ! DOWNLOADED_SHA="$(bash "${S3_CLIENT}" get "${KEY}" "${WORK}/roundtrip.bin")"; then
  v_roundtrip='get-failed'
  fail "the archive uploaded but could not be read back from ${KEY}, so the offsite copy is unproved. The local copy is kept at ${LOCAL_COPY}"
fi
if [ "${UPLOADED_SHA}" != "${DOWNLOADED_SHA}" ]; then
  v_roundtrip='sha256-mismatch'
  fail "the object at ${KEY} came back with sha256 ${DOWNLOADED_SHA} but ${UPLOADED_SHA} was uploaded. The local copy is kept at ${LOCAL_COPY}"
fi
v_roundtrip='sha256-match'

# --- 10 the real restore ------------------------------------------------------
#
# The acceptance criterion Story 1-7 could not meet: a backup proved by
# restoring it, not by an exit code. Skipped only above a ceiling, because this
# runs on a serving box and an unbounded restore is not something to start
# unattended at 03:45.

if [ "${BYTES}" -gt "${VERIFY_MAX_BYTES}" ]; then
  v_restore="skipped-over-${VERIFY_MAX_BYTES}b-ceiling"
else
  if ! bash "${RESTORE_VERIFY}" "${KEY}"; then
    v_restore='failed'
    fail "the object at ${KEY} could not be restored and read, so this backup is not proved. The local copy is kept at ${LOCAL_COPY}"
  fi
  v_restore='verified'
fi

# --- 11 retention -------------------------------------------------------------

if ! prune_local; then
  fail "the local retention prune of ${BACKUP_DIR} failed"
fi

exit 0
