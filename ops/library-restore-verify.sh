#!/usr/bin/env bash
# Prove a `digital-library` backup by restoring it (Story 1-8, AD-10).
#
# AD-10 calls a declared non-Postgres store without an equivalent offsite path
# unbacked data. The path Story 1-7 found was worse than that: a script that
# exited non-zero every night while quietly writing a perfectly good snapshot,
# which is indistinguishable from a broken one and teaches the Operator to
# ignore the log. So a green exit is not evidence here. This script is the
# evidence: it pulls the object back out of the bucket, decrypts it, unpacks it,
# opens the database and reads it.
#
# Callable on its own, and called by `library-backup.sh` as its last check
# before the nightly run is allowed to report success.
#
#   library-restore-verify.sh                 verify the newest local archive's object
#   library-restore-verify.sh <object-key>    verify that object
#
# Configuration comes from the environment, or from LIBRARY_BACKUP_CONFIG when
# this is run by hand. It needs the same five S3 variables `s3-object.sh` needs,
# plus BACKUP_PASSPHRASE.
#
# Everything it writes lives inside one `mktemp -d` scratch directory that is
# removed on every exit path, successful or not. It never writes to the live
# store, to the backup directory, or anywhere else.
#
# Exit codes: 0 the restore was proved, 1 anything else.

set -uo pipefail

PROGRAM='library-restore-verify'

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

CONFIG_FILE="${LIBRARY_BACKUP_CONFIG:-/etc/cuatro/library-backup.env}"
BACKUP_DIR="${LIBRARY_BACKUP_DIR:-/home/deploy/backups/digital-library}"
S3_PREFIX="${S3_PREFIX:-digital-library}"
S3_CLIENT="${S3_OBJECT_CLIENT:-${HERE}/s3-object.sh}"

SCRATCH=''

cleanup() {
  if [ -n "${SCRATCH}" ] && [ -d "${SCRATCH}" ]; then
    rm -rf -- "${SCRATCH}"
  fi
}
trap cleanup EXIT

say() {
  printf '%s: %s\n' "${PROGRAM}" "$*"
}

die() {
  printf '%s: %s\n' "${PROGRAM}" "$*" >&2
  exit 1
}

# The config file is sourced rather than parsed, which is why it must be root
# owned and mode 0600 on the box. It is a shell fragment of KEY=value lines and
# it is the one place the passphrase and the bucket credentials exist.
if [ -f "${CONFIG_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${CONFIG_FILE}" || die "cannot read ${CONFIG_FILE}"
fi

[ -n "${BACKUP_PASSPHRASE:-}" ] || die "BACKUP_PASSPHRASE is not set, so nothing can be decrypted. Set it in ${CONFIG_FILE}"
[ -x "${S3_CLIENT}" ] || [ -f "${S3_CLIENT}" ] || die "cannot find the object client at ${S3_CLIENT}"

export S3_ENDPOINT="${S3_ENDPOINT:-}"
export S3_REGION="${S3_REGION:-auto}"
export S3_BUCKET="${S3_BUCKET:-}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}"

# --- which object -------------------------------------------------------------

KEY="${1:-}"
if [ -z "${KEY}" ]; then
  newest="$(ls -1t "${BACKUP_DIR}"/library-*.tar.gz.gpg 2>/dev/null | head -1)"
  [ -n "${newest}" ] || die "no object key was given and no library-*.tar.gz.gpg exists under ${BACKUP_DIR}"
  KEY="${S3_PREFIX}/$(basename -- "${newest}")"
  say "no key given, so verifying the newest local archive's object: ${KEY}"
fi

# --- scratch ------------------------------------------------------------------

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/library-restore-XXXXXX")" \
  || die 'cannot create a scratch directory'

archive="${SCRATCH}/archive.tar.gz.gpg"
plain="${SCRATCH}/archive.tar.gz"
tree="${SCRATCH}/tree"

# --- download -----------------------------------------------------------------

if ! bash "${S3_CLIENT}" get "${KEY}" "${archive}" > "${SCRATCH}/download.sha256"; then
  die "the object ${KEY} could not be downloaded, so this backup is not proved"
fi
say "downloaded ${KEY} ($(wc -c < "${archive}" | tr -d ' ') bytes, sha256 $(cat "${SCRATCH}/download.sha256"))"

# --- decrypt ------------------------------------------------------------------

if ! printf '%s' "${BACKUP_PASSPHRASE}" | gpg --batch --yes --quiet \
  --pinentry-mode loopback --passphrase-fd 0 \
  --decrypt --output "${plain}" "${archive}"; then
  die "the object ${KEY} downloaded but would not decrypt, so this backup is not restorable"
fi
say 'decrypted'

# --- unpack -------------------------------------------------------------------

mkdir -p "${tree}" || die 'cannot create the scratch tree'
if ! tar -xzf "${plain}" -C "${tree}"; then
  die "the object ${KEY} decrypted but would not unpack"
fi

db="${tree}/library.db"
[ -f "${db}" ] || die "the archive unpacked but holds no library.db, so it is not a backup of the store"

for dir in books covers inbox; do
  if [ -d "${tree}/${dir}" ]; then
    say "media directory ${dir} present, $(find "${tree}/${dir}" -type f | wc -l | tr -d ' ') files"
  else
    say "media directory ${dir} MISSING from the archive"
  fi
done

# --- open and read ------------------------------------------------------------
#
# The point of the whole story. `integrity_check` on a file that was never
# opened proves nothing about the file the backup would be restored from, so it
# is run here, on the copy that came back out of the bucket.

integrity="$(sqlite3 "${db}" 'PRAGMA integrity_check;' 2>&1)"
if [ "${integrity}" != 'ok' ]; then
  die "the restored database fails PRAGMA integrity_check: ${integrity}"
fi
say 'PRAGMA integrity_check ok'

objects="$(sqlite3 "${db}" 'SELECT count(*) FROM sqlite_master;' 2>&1)"
say "schema objects: ${objects}"

tables="$(sqlite3 "${db}" "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;" 2>&1)"
while IFS= read -r table; do
  [ -n "${table}" ] || continue
  # A row count is tolerant on purpose. An FTS5 shadow table needs the module
  # compiled in, and a restore that proved every ordinary table and could not
  # read one virtual table is still a proved restore, so this reports rather
  # than aborts.
  if count="$(sqlite3 "${db}" "SELECT count(*) FROM \"${table}\";" 2>&1)"; then
    say "table ${table}: ${count} rows"
  else
    say "table ${table}: not readable (${count})"
  fi
done <<< "${tables}"

say "restore verified from the bucket for ${KEY}"
exit 0
