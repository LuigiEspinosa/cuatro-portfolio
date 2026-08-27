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
# Everything it reads is asserted, not printed. A count that comes back as an
# error message, a database with no schema in it, or a database with no tables
# in it all fail the run. That floor exists because `PRAGMA integrity_check`
# passes on a valid empty database, and a valid empty database is exactly what a
# naive `cp` of this store's 4096 byte main file produces, so integrity alone
# would certify the one wrong answer this store invites.
#
# Callable on its own, and called by `library-backup.sh` as its last check
# before the nightly run is allowed to report success.
#
#   library-restore-verify.sh                 verify the newest local archive's object
#   library-restore-verify.sh <object-key>    verify that object
#
# Configuration comes from the environment when `library-backup.sh` invokes it,
# and from LIBRARY_BACKUP_CONFIG when it is run by hand. It needs the same five
# S3 variables `s3-object.sh` needs, plus BACKUP_PASSPHRASE.
#
# Everything it writes lives inside one `mktemp -d` scratch directory that is
# removed on every exit path, including a signal, because that directory holds
# a decrypted database carrying a user row and a session row.
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
SCRATCH_CREATED=0

cleanup() {
  [ "${SCRATCH_CREATED}" -eq 1 ] || return 0
  [ -n "${SCRATCH}" ] || return 0
  [ -d "${SCRATCH}" ] || return 0
  case "${SCRATCH}" in
    */library-restore-??????) rm -rf -- "${SCRATCH}" ;;
  esac
}

# Bash does not run an EXIT trap on an untrapped fatal signal, so without these
# a SIGTERM would leave a decrypted plaintext database on disk.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

say() {
  printf '%s: %s\n' "${PROGRAM}" "$*"
}

die() {
  printf '%s: %s\n' "${PROGRAM}" "$*" >&2
  exit 1
}

# Read through the same allowlist `library-backup.sh` uses, in a subshell with a
# cleared environment, so a hand-edited config cannot redirect this script's own
# paths or its scratch directory. Skipped entirely when the caller has already
# put the values in the environment, which is what the nightly job does.
CONFIG_ALLOWLIST='S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY BACKUP_PASSPHRASE S3_PREFIX S3_CONNECT_TIMEOUT S3_MAX_TIME'

if [ -z "${BACKUP_PASSPHRASE:-}" ] && { [ -e "${CONFIG_FILE}" ] || sudo test -e "${CONFIG_FILE}" 2>/dev/null; }; then
  if ! CONFIG_VALUES="$(
    env -i PATH="${PATH}" CUATRO_CONFIG_FILE="${CONFIG_FILE}" CUATRO_ALLOW="${CONFIG_ALLOWLIST}" \
      bash -c '
        set +u
        . "${CUATRO_CONFIG_FILE}" || exit 1
        for name in ${CUATRO_ALLOW}; do
          if [ -n "${!name+set}" ]; then printf "%s=%q\n" "${name}" "${!name}"; fi
        done
      ' 2>/dev/null
  )"; then
    die "${CONFIG_FILE} exists and cannot be read by this account (uid $(id -u)). It should be owned root:$(id -gn 2>/dev/null) mode 0640 in a directory mode 0755"
  fi
  eval "${CONFIG_VALUES}"
fi

[ -n "${BACKUP_PASSPHRASE:-}" ] || die "BACKUP_PASSPHRASE is not set, so nothing can be decrypted. Set it in ${CONFIG_FILE}"
[ -f "${S3_CLIENT}" ] || die "cannot find the object client at ${S3_CLIENT}"

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
SCRATCH_CREATED=1

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
    die "media directory ${dir} is missing from the archive, so the coverage this record claims is not what was uploaded"
  fi
done

# --- open and read ------------------------------------------------------------
#
# The point of the whole story, and the reason every value below is asserted
# rather than printed. A restore that printed `schema objects: Error: ...` and
# then exited 0 would certify nothing while looking like proof.

if ! integrity="$(sqlite3 "${db}" 'PRAGMA integrity_check;' 2>&1)"; then
  die "the restored database would not open for PRAGMA integrity_check: ${integrity}"
fi
if [ "${integrity}" != 'ok' ]; then
  die "the restored database fails PRAGMA integrity_check: ${integrity}"
fi
say 'PRAGMA integrity_check ok'

if ! objects="$(sqlite3 "${db}" 'SELECT count(*) FROM sqlite_master;' 2>&1)"; then
  die "the restored database would not answer a schema object count: ${objects}"
fi
case "${objects}" in
  ''|*[!0-9]*) die "the restored database answered a schema object count that is not a number: ${objects}" ;;
esac
if [ "${objects}" -lt 1 ]; then
  die 'the restored database holds no schema objects at all, which is what a file copy of this store would produce rather than a backup of it'
fi
say "schema objects: ${objects}"

if ! tables="$(sqlite3 "${db}" "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;" 2>&1)"; then
  die "the restored database would not list its tables: ${tables}"
fi

table_count=0
while IFS= read -r table; do
  [ -n "${table}" ] || continue
  table_count=$(( table_count + 1 ))
  if ! count="$(sqlite3 "${db}" "SELECT count(*) FROM \"${table}\";" 2>&1)"; then
    die "the restored database holds a table it cannot read, ${table}: ${count}"
  fi
  case "${count}" in
    ''|*[!0-9]*) die "the restored table ${table} answered a row count that is not a number: ${count}" ;;
  esac
  say "table ${table}: ${count} rows"
done <<< "${tables}"

if [ "${table_count}" -lt 1 ]; then
  die 'the restored database holds no tables, so there is nothing in it to restore'
fi

say "restore verified from the bucket for ${KEY}: ${objects} schema objects across ${table_count} tables"
exit 0
