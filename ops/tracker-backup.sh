#!/usr/bin/env bash
# The tracker's pre-cutover backup (Story 3-6, AD-23).
#
# Run on the box, as `deploy`, before `ops/tracker-cutover.md` swaps the containers that serve
# tracker.cuatro.dev, and before anything else in that runbook touches the tracker. It writes three
# files beside each other and nothing else:
#
#   tracker-<stamp>.dump          pg_dump -Fc of database `tracker`, taken inside the Postgres container
#   tracker-<stamp>.dump.counts   every table in `public` with its row count, read right after the dump
#   tracker-<stamp>.dump.sha256   the dump's sha256, in `sha256sum` form
#
# A dump is not a backup until it has been restored, so `ops/tracker-restore-verify.sh` restores it into
# a throwaway Postgres and requires every count equal. The counts are read after the dump rather than in
# its snapshot, so the runbook stops the old worker first and the Operator writes nothing meanwhile; a
# write in between makes the verification fail loudly, never pass wrongly.
#
# The nightly `~/cuatro-backup.sh` keeps writing its own dumps to the same directory under another
# name (`cuatro-*.dump`), and its prune never matches these.
#
# Exit codes: 0 the three files are written, 1 anything else. One summary line carries every stage's
# verdict on every path, a signal included, as `ops/library-backup.sh` does, and a failed run removes
# what it half wrote.

set -uo pipefail

PROGRAM='tracker-backup'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
TZ=UTC
export TZ

CONTAINER="${TRACKER_DB_CONTAINER:-cuatro-tracker-postgres-1}"
BACKUP_DIR="${TRACKER_BACKUP_DIR:-/home/deploy/backups/cuatro-tracker}"

v_dump='not-reached'
v_list='not-reached'
v_tables='0'
v_rows='0'
v_bytes='0'
v_sha256='not-reached'
DUMP=''
DONE=0

finish() {
  local code=$?
  if [ "${DONE}" -ne 1 ] && [ -n "${DUMP}" ]; then
    rm -f -- "${DUMP}" "${DUMP}.partial" "${DUMP}.counts" "${DUMP}.sha256"
  fi
  printf '%s file=%s dump=%s list=%s tables=%s rows=%s bytes=%s sha256=%s exit=%s\n' \
    "${PROGRAM}" "${DUMP:-none}" "${v_dump}" "${v_list}" "${v_tables}" "${v_rows}" "${v_bytes}" "${v_sha256}" "${code}"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit 1
}

# One query against the live database, unaligned and tuples only, so its output is data.
live_sql() {
  docker exec "${CONTAINER}" psql -U tracker -d tracker -v ON_ERROR_STOP=1 -At -c "$1"
}

[ "$(docker inspect --format '{{.State.Running}}' "${CONTAINER}" 2>/dev/null)" = 'true' ] \
  || fail "${CONTAINER} is not running, so there is nothing to back up"
mkdir -p -- "${BACKUP_DIR}" || fail "cannot create ${BACKUP_DIR}"

DUMP="${BACKUP_DIR}/tracker-$(date -u +%Y%m%dT%H%M%SZ).dump"
[ -e "${DUMP}" ] && { DUMP=''; fail 'a dump with this second'"'"'s name already exists; run it again'; }

# --- the dump -------------------------------------------------------------------
if ! docker exec "${CONTAINER}" pg_dump -U tracker -d tracker -Fc > "${DUMP}.partial"; then
  v_dump='failed'
  fail "pg_dump of tracker in ${CONTAINER} failed"
fi
[ -s "${DUMP}.partial" ] || { v_dump='empty'; fail 'pg_dump wrote nothing'; }
mv -- "${DUMP}.partial" "${DUMP}" || fail "cannot move the dump into ${BACKUP_DIR}"
chmod 0600 "${DUMP}" 2>/dev/null
v_dump='ok'
v_bytes="$(wc -c < "${DUMP}" | tr -d ' ')"

# The archive's own table of contents, read by the server's pg_restore, so a truncated write is caught
# here and not at the restore.
if ! docker exec -i "${CONTAINER}" pg_restore --list > /dev/null < "${DUMP}"; then
  v_list='unreadable'
  fail 'the dump is not an archive pg_restore can read'
fi
v_list='ok'

# --- the counts -----------------------------------------------------------------
TABLES="$(live_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")" \
  || fail 'cannot list the tables of tracker'
[ -n "${TABLES}" ] || fail 'tracker holds no tables, so this is not the database the tracker serves from'

: > "${DUMP}.counts" || fail "cannot write ${DUMP}.counts"
while IFS= read -r table; do
  [ -n "${table}" ] || continue
  count="$(live_sql "SELECT count(*) FROM public.\"${table}\"")" || fail "cannot count ${table}"
  case "${count}" in
    ''|*[!0-9]*) fail "${table} answered a row count that is not a number: ${count}" ;;
  esac
  printf '%s\t%s\n' "${table}" "${count}" >> "${DUMP}.counts"
  v_tables=$(( v_tables + 1 ))
  v_rows=$(( v_rows + count ))
done <<< "${TABLES}"

# --- the checksum ---------------------------------------------------------------
( cd -- "${BACKUP_DIR}" && sha256sum -- "$(basename -- "${DUMP}")" ) > "${DUMP}.sha256" \
  || { v_sha256='failed'; fail 'cannot checksum the dump'; }
v_sha256="$(cut -d' ' -f1 < "${DUMP}.sha256")"

DONE=1
exit 0
