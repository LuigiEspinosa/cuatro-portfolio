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
# unexpected ones. There is no `set -e`: every stage is checked by hand and an
# EXIT trap prints the summary even when something nobody anticipated goes
# wrong. `$USER` appears nowhere; ownership comes from `id -u` and `id -g`.
#
# Stages, in order:
#
#   snapshot   sqlite3 .backup, never a file copy. library.db is one 4096 byte
#              page and the whole database lives in the WAL, so `cp` would
#              capture an empty database.
#   own        take the root-owned snapshot, by uid and gid rather than $USER
#   integrity  PRAGMA integrity_check on the snapshot, before anything leaves
#   archive    tar the snapshot plus books, covers and inbox, then gzip
#   encrypt    gpg --symmetric AES256, because the destination is third party
#              and the database holds a user row and a session row
#   size       refuse to upload above MAX_ARCHIVE_BYTES
#   redis      report whether the cache is still empty rather than assume it
#   offsite    put, then get the object back and compare sha256
#   restore    a real restore from the bucket, below VERIFY_MAX_BYTES
#   prune      local retention across all three generations of file naming
#
# Exit codes: 0 the whole path completed, 75 (EX_TEMPFAIL) the local half
# completed and the offsite half is not configured yet, 1 anything else. 75 is
# deliberate. A local-only backup is precisely the defect AD-10 names, so a run
# that produced one has not succeeded, and the estate's own idiom is that a gate
# with no measurement is blocked rather than open.

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

DB="${DATA_DIR}/library.db"

# --- the summary line ---------------------------------------------------------
#
# Every value is a single token with no space in it, so the line stays greppable
# and one field can never be read as two.

v_snapshot='not-reached'
v_own='not-reached'
v_integrity='not-reached'
v_archive='none'
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

print_summary() {
  local code="$1"
  [ "${SUMMARY_PRINTED}" -eq 0 ] || return 0
  SUMMARY_PRINTED=1
  printf '%s ts=%s snapshot=%s own=%s integrity=%s archive=%s bytes=%s encrypt=%s size=%s redis=%s offsite=%s roundtrip=%s restore=%s prune=%s exit=%s\n' \
    "${PROGRAM}" "${STARTED_AT}" "${v_snapshot}" "${v_own}" "${v_integrity}" \
    "${v_archive}" "${v_bytes}" "${v_encrypt}" "${v_size}" "${v_redis}" \
    "${v_offsite}" "${v_roundtrip}" "${v_restore}" "${v_prune}" "${code}"
}

finish() {
  local code=$?
  print_summary "${code}"
  if [ -n "${WORK}" ] && [ -d "${WORK}" ]; then
    rm -rf -- "${WORK}"
  fi
}
trap finish EXIT

note() {
  printf '%s: %s\n' "${PROGRAM}" "$*"
}

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit "${2:-1}"
}

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
# survive. Offsite retention is not done here and never will be: it is a bucket
# lifecycle rule, which is what keeps the token write-only.
prune_local() {
  local removed rc
  removed="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'library-*' \
    -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
  rc=$?
  if [ "${rc}" -ne 0 ] || [ -z "${removed}" ]; then
    v_prune='failed'
    return 1
  fi
  v_prune="removed-${removed}-older-than-${RETENTION_DAYS}d"
  return 0
}

# --- preflight ----------------------------------------------------------------

[ -d "${DATA_DIR}" ] || fail "the store directory ${DATA_DIR} does not exist"
mkdir -p "${BACKUP_DIR}" || fail "cannot create ${BACKUP_DIR}"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/library-backup-XXXXXX")" \
  || fail 'cannot create a working directory'

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="library-${STAMP}"

# --- snapshot -----------------------------------------------------------------
#
# `.backup` and not `cp`. The live store is read and never written.

SNAP="${WORK}/library.db"
if ! sudo sqlite3 "${DB}" ".backup '${SNAP}'"; then
  v_snapshot='failed'
  fail "sqlite3 .backup of ${DB} failed, so no snapshot exists to back up"
fi
[ -s "${SNAP}" ] || { v_snapshot='empty'; fail 'sqlite3 .backup produced an empty file'; }
v_snapshot='ok'

# The snapshot is written by root because the live database is. `$USER` is not
# set under cron and is what broke the script this replaces, so ownership is
# taken by numeric uid and gid, which are always available.
if ! sudo chown "$(id -u):$(id -g)" "${SNAP}"; then
  v_own='failed'
  fail 'cannot take ownership of the snapshot'
fi
v_own='ok'

# --- integrity ----------------------------------------------------------------
#
# Before anything is packed and long before anything is uploaded. Shipping a
# corrupt snapshot offsite would replace an absent backup with a false one.

INTEGRITY="$(sqlite3 "${SNAP}" 'PRAGMA integrity_check;' 2>&1)"
if [ "${INTEGRITY}" != 'ok' ]; then
  v_integrity='failed'
  fail "the snapshot fails PRAGMA integrity_check (${INTEGRITY}), so nothing was uploaded"
fi
v_integrity='ok'

# --- archive ------------------------------------------------------------------
#
# The database plus the media tree. `books`, `covers` and `inbox` are empty
# today and `digital-library` is a book reader, so a path that backed up only
# the database would be a coverage claim with a hole in it the first time
# somebody uploads a file. Three empty directories cost nothing to include.

TARBALL="${WORK}/${BASE}.tar"
if ! sudo tar -cf "${TARBALL}" -C "${WORK}" library.db -C "${DATA_DIR}" books covers inbox; then
  v_archive='failed'
  fail "cannot archive the snapshot and the media tree under ${DATA_DIR}"
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
v_archive="${BASE}.tar.gz.gpg"

# --- encrypt ------------------------------------------------------------------
#
# Everything that leaves this box is encrypted before it leaves, because the
# destination is a third party and the database holds a user row and a session
# row. The local artifact is encrypted too, using the same passphrase, so the
# file the round trip compares is the file that was uploaded.
#
# Without a passphrase there is nothing to encrypt with, and there is also no
# bucket to upload to, so the run is heading for the exit 75 path. The local
# archive stays as a `.tar.gz` in that case. That is deliberate rather than a
# gap: it sits on the same disk as the plaintext database it was taken from, so
# encrypting it while the source is in the clear would protect nothing.

ARTIFACT=''
if [ -f "${CONFIG_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${CONFIG_FILE}" || fail "cannot read ${CONFIG_FILE}"
fi

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
  ARTIFACT="${ENCRYPTED}"
else
  v_encrypt='skipped-no-passphrase'
  v_archive="${BASE}.tar.gz"
  ARTIFACT="${TARBALL}"
fi

LOCAL_COPY="${BACKUP_DIR}/$(basename -- "${ARTIFACT}")"
if ! mv "${ARTIFACT}" "${LOCAL_COPY}"; then
  fail "cannot move the archive into ${BACKUP_DIR}"
fi
chmod 0640 "${LOCAL_COPY}" 2>/dev/null

# --- size ceiling -------------------------------------------------------------
#
# `s3-object.sh put` reads the whole body into memory, on a two vCPU box that is
# serving. The ceiling is what makes that acceptable, so it is checked here
# rather than trusted to stay small.

BYTES="$(wc -c < "${LOCAL_COPY}" | tr -d ' ')"
v_bytes="${BYTES:-0}"
if [ "${BYTES:-0}" -gt "${MAX_ARCHIVE_BYTES}" ]; then
  v_size='over-ceiling'
  fail "the archive is ${BYTES} bytes, above the MAX_ARCHIVE_BYTES ceiling of ${MAX_ARCHIVE_BYTES} bytes, so it was not uploaded. The local copy is kept at ${LOCAL_COPY}"
fi
v_size='within-ceiling'

# --- the cache ----------------------------------------------------------------
#
# `digital-library_redis_data` has been empty since the volume was created and
# nothing in the archive covers it. That is a defensible exclusion only while it
# stays true, so the run checks and reports rather than the record asserting it
# once and going stale. Reported, never fatal: an unreachable Docker is not a
# reason to skip a database backup.

REDIS_DBSIZE=''
if REDIS_DBSIZE="$(docker exec "${REDIS_CONTAINER}" redis-cli DBSIZE 2>/dev/null)"; then
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

if [ ! -f "${CONFIG_FILE}" ]; then
  prune_local
  v_offsite='not-configured'
  v_roundtrip='skipped'
  v_restore='skipped'
  note "the local half is complete and intact at ${LOCAL_COPY}, and there is no offsite copy."
  note "to finish this, create ${CONFIG_FILE} root owned mode 0600 holding S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and BACKUP_PASSPHRASE. The procedure is in ops/backup-digital-library.md."
  fail "exiting 75 because a local-only backup is the defect AD-10 names, not a success" 75
fi

MISSING=()
[ -n "${S3_ENDPOINT:-}" ] || MISSING+=('S3_ENDPOINT')
[ -n "${S3_BUCKET:-}" ] || MISSING+=('S3_BUCKET')
[ -n "${S3_ACCESS_KEY_ID:-}" ] || MISSING+=('S3_ACCESS_KEY_ID')
[ -n "${S3_SECRET_ACCESS_KEY:-}" ] || MISSING+=('S3_SECRET_ACCESS_KEY')
[ -n "${BACKUP_PASSPHRASE:-}" ] || MISSING+=('BACKUP_PASSPHRASE')
if [ "${#MISSING[@]}" -gt 0 ]; then
  v_offsite='misconfigured'
  fail "${CONFIG_FILE} exists but is missing required configuration: ${MISSING[*]}"
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

if ! UPLOADED_SHA="$(bash "${S3_CLIENT}" put "${LOCAL_COPY}" "${KEY}")"; then
  v_offsite='put-failed'
  fail "the archive could not be uploaded to ${KEY}. The local copy is kept at ${LOCAL_COPY}"
fi
v_offsite="ok-${KEY}"

# --- the round trip -----------------------------------------------------------
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

# --- the real restore ---------------------------------------------------------
#
# The acceptance criterion Story 1-7 could not meet: a backup proved by
# restoring it, not by an exit code. Skipped only above a ceiling, because this
# runs on a serving box and an unbounded restore is not something to start
# unattended at 03:45.

if [ "${BYTES:-0}" -gt "${VERIFY_MAX_BYTES}" ]; then
  v_restore="skipped-over-${VERIFY_MAX_BYTES}b-ceiling"
else
  if ! bash "${RESTORE_VERIFY}" "${KEY}"; then
    v_restore='failed'
    fail "the object at ${KEY} could not be restored and read, so this backup is not proved. The local copy is kept at ${LOCAL_COPY}"
  fi
  v_restore='verified'
fi

# --- retention ----------------------------------------------------------------

if ! prune_local; then
  fail "the local retention prune of ${BACKUP_DIR} failed"
fi

exit 0
