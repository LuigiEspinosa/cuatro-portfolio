#!/usr/bin/env bash
# The estate Postgres's nightly backup (Story 4-5, AD-10).
#
# Run on the box as `deploy` by cron at 03:15 UTC (`ops/postgres-backup.md` § The cron line). It dumps every
# consumer database of the one instance Story 4-4 placed and writes, for each, three files beside each other:
#
#   pg-<database>-<stamp>.dump          pg_dump -Fc, taken inside the instance's container
#   pg-<database>-<stamp>.dump.counts   every table with its row count, read inside the dump's own snapshot
#   pg-<database>-<stamp>.dump.sha256   the dump's sha256, in `sha256sum` form
#
# The counts are read in the same REPEATABLE READ transaction whose snapshot `pg_dump --snapshot` uses, so
# a consumer writing through the night (Umami writes on every page view) never makes the counts and the
# dump disagree. `ops/postgres-restore-verify.sh` restores each dump into a throwaway Postgres and requires
# every count equal.
#
# Offsite is restic, run from its official image pinned below, so nothing is installed on the host. With
# `/etc/cuatro/postgres-backup.env` in place the run sends this night's files to the repository, forgets
# by the retention below, checks the repository, restores this snapshot into a scratch directory, compares
# every checksum with the local one, and verifies the restored dumps. Without it, the local dumps are
# verified instead and the run exits 75. The env file reaches only the restic container, by
# `docker --env-file`: it is never sourced, so it cannot set a path or a command here.
#
# Retention: local `pg-*` files older than 14 whole days (`find -mtime +14`, as
# `ops/backup-digital-library.md` § Retention reckons it), only after a run whose local half is proved.
# Offsite: 14 daily, 8 weekly, 6 monthly snapshots, grouped by host and tag.
#
# Exit codes: 0 everything ran and the restore from the repository was verified; 75 the env file does not
# exist and the local half ran and was verified; 1 anything else. One summary line carries every stage's
# verdict on every path, a signal included. A failed dump stage removes the files this run wrote; once every
# dump is whole, a later failure keeps them, so a broken offsite never costs the local copy.

set -uo pipefail
umask 077

PROGRAM='postgres-backup'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
TZ=UTC
export TZ

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${POSTGRES_BACKUP_CONTAINER:-postgres-estate-postgres-1}"
BACKUP_DIR="${POSTGRES_BACKUP_DIR:-/home/deploy/backups/estate-postgres}"
CONFIG="${POSTGRES_BACKUP_CONFIG:-/etc/cuatro/postgres-backup.env}"
RESTIC_IMAGE='restic/restic:0.19.1'
# A repository on local disk is bind-mounted at its own path. Empty for the R2 repository.
LOCAL_REPO="${POSTGRES_RESTIC_LOCAL_REPO:-}"
VERIFY="${HERE}/postgres-restore-verify.sh"
# A daemon or an endpoint that accepts and then stalls would otherwise hang the job with no summary.
STEP_TIMEOUT="${POSTGRES_BACKUP_TIMEOUT:-1800}"
RETENTION_DAYS=14
TAG='estate-postgres'
KEEP=(--keep-daily 14 --keep-weekly 8 --keep-monthly 6)

COUNTS_SQL="SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE' ORDER BY 1"

v_databases='0'
v_dumps='not-reached'
v_tables='0'
v_rows='0'
v_bytes='0'
v_offsite='not-reached'
v_forget='not-reached'
v_check='not-reached'
v_roundtrip='not-reached'
v_restore='not-reached'
v_prune='not-reached'
RUN_FILES=()
DUMPS=()
DONE=0
SCRATCH=''
FIFOS=''

# shellcheck disable=SC2329 # invoked by the EXIT trap
finish() {
  local code=$?
  if [ "${DONE}" -ne 1 ] && [ "${#RUN_FILES[@]}" -gt 0 ]; then
    rm -f -- "${RUN_FILES[@]}"
  fi
  [ -n "${SCRATCH}" ] && rm -rf -- "${SCRATCH}"
  [ -n "${FIFOS}" ] && rm -rf -- "${FIFOS}"
  printf '%s ts=%s databases=%s dumps=%s tables=%s rows=%s bytes=%s offsite=%s forget=%s check=%s roundtrip=%s restore=%s prune=%s exit=%s\n' \
    "${PROGRAM}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${v_databases}" "${v_dumps}" "${v_tables}" "${v_rows}" \
    "${v_bytes}" "${v_offsite}" "${v_forget}" "${v_check}" "${v_roundtrip}" "${v_restore}" "${v_prune}" "${code}"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit 1
}

case "${STEP_TIMEOUT}" in ''|0|*[!0-9]*) fail 'POSTGRES_BACKUP_TIMEOUT must be a whole number of seconds above 0' ;; esac

# restic from its image, as this account, seeing the backup directory read-only and its cache read-write.
restic_run() {
  local mounts=(-v "${BACKUP_DIR}:${BACKUP_DIR}:ro" -v "${BACKUP_DIR}/.restic-cache:/cache")
  [ -n "${LOCAL_REPO}" ] && mounts+=(-v "${LOCAL_REPO}:${LOCAL_REPO}")
  [ -n "${SCRATCH}" ] && mounts+=(-v "${SCRATCH}:/restore")
  timeout "${STEP_TIMEOUT}" docker run --rm --user "$(id -u):$(id -g)" --env-file "${CONFIG}" \
    -e RESTIC_CACHE_DIR=/cache "${mounts[@]}" "${RESTIC_IMAGE}" "$@" < /dev/null
}

# --- preflight ------------------------------------------------------------------
if ! mkdir -p -- "${BACKUP_DIR}/.restic-cache" || ! chmod 0700 -- "${BACKUP_DIR}"; then
  fail "cannot create ${BACKUP_DIR}"
fi
exec 9> "${BACKUP_DIR}/.postgres-backup.lock" || fail "cannot open the lock in ${BACKUP_DIR}"
flock -n 9 || fail 'another run holds the lock; this one did nothing'
[ "$(docker inspect --format '{{.State.Running}}' "${CONTAINER}" 2>/dev/null)" = 'true' ] \
  || fail "${CONTAINER} is not running, so there is nothing to back up"

DATABASES="$(timeout "${STEP_TIMEOUT}" docker exec "${CONTAINER}" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At \
  -c "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate AND datname <> 'postgres' ORDER BY 1")" \
  || fail "cannot list the databases of ${CONTAINER}"
[ -n "${DATABASES}" ] || fail "${CONTAINER} holds no consumer database, so this is not the estate's instance"
while IFS= read -r db; do
  [[ "${db}" =~ ^[a-z_][a-z0-9_]*$ ]] || fail "database name ${db} is not an AD-3 name, so it cannot name a file"
done <<< "${DATABASES}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FIFOS="$(mktemp -d)" || fail "cannot make a directory for the psql session"

# --- the dumps ------------------------------------------------------------------
# One psql session per database holds a REPEATABLE READ transaction open; pg_dump takes its exported
# snapshot, and the counts are read in that transaction afterwards, so both see the same instant.
dump_one() {
  local db="$1" dump="${BACKUP_DIR}/pg-$1-${STAMP}.dump" snapshot='' line='' ended=0 wfd rfd pid count table
  [ -e "${dump}" ] && { printf '%s: %s already exists; run it again\n' "${PROGRAM}" "${dump}" >&2; return 1; }
  RUN_FILES+=("${dump}" "${dump}.partial" "${dump}.counts" "${dump}.sha256")
  # A pair of FIFOs rather than `coproc`: bash closes a coprocess's descriptors when it reaps it, which can
  # land before the last count is read.
  rm -f -- "${FIFOS}/in" "${FIFOS}/out"
  mkfifo -m 0600 -- "${FIFOS}/in" "${FIFOS}/out" || return 1
  timeout "${STEP_TIMEOUT}" docker exec -i "${CONTAINER}" psql -X -q -U postgres -d "${db}" -v ON_ERROR_STOP=1 -At -F $'\t' \
    < "${FIFOS}/in" > "${FIFOS}/out" &
  pid=$!
  exec {wfd}> "${FIFOS}/in" {rfd}< "${FIFOS}/out"
  printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;' 'SELECT pg_export_snapshot();' >&"${wfd}"
  IFS= read -r -t 120 snapshot <&"${rfd}"
  if [[ ! "${snapshot}" =~ ^[0-9A-F]+-[0-9A-F]+-[0-9]+$ ]]; then
    printf '%s: %s exported no snapshot\n' "${PROGRAM}" "${db}" >&2
    exec {wfd}>&- {rfd}<&-
    return 1
  fi
  if ! timeout "${STEP_TIMEOUT}" docker exec "${CONTAINER}" pg_dump -U postgres -d "${db}" -Fc --snapshot="${snapshot}" > "${dump}.partial" \
    || [ ! -s "${dump}.partial" ]; then
    printf '%s: pg_dump of %s failed or wrote nothing\n' "${PROGRAM}" "${db}" >&2
    exec {wfd}>&- {rfd}<&-
    return 1
  fi
  printf '%s;\n' "${COUNTS_SQL}" >&"${wfd}"
  printf '%s\n' '\echo __end_of_counts__' 'COMMIT;' >&"${wfd}"
  exec {wfd}>&-
  : > "${dump}.counts" || { exec {rfd}<&-; return 1; }
  while IFS= read -r -t "${STEP_TIMEOUT}" line <&"${rfd}"; do
    [ "${line}" = '__end_of_counts__' ] && { ended=1; break; }
    table="${line%%$'\t'*}"
    count="${line#*$'\t'}"
    case "${count}" in
      ''|*[!0-9]*)
        printf '%s: %s answered a row count that is not a number: %s\n' "${PROGRAM}" "${db}.${table}" "${count}" >&2
        exec {rfd}<&-
        return 1 ;;
    esac
    printf '%s\t%s\n' "${table}" "${count}" >> "${dump}.counts"
    v_tables=$(( v_tables + 1 ))
    v_rows=$(( v_rows + count ))
  done
  exec {rfd}<&-
  wait "${pid}" 2>/dev/null
  [ "${ended}" -eq 1 ] || { printf '%s: the counts of %s did not complete\n' "${PROGRAM}" "${db}" >&2; return 1; }

  mv -- "${dump}.partial" "${dump}" || return 1
  if ! timeout "${STEP_TIMEOUT}" docker exec -i "${CONTAINER}" pg_restore --list > /dev/null < "${dump}"; then
    printf '%s: %s is not an archive pg_restore can read\n' "${PROGRAM}" "${dump}" >&2
    return 1
  fi
  ( cd -- "${BACKUP_DIR}" && sha256sum -- "$(basename -- "${dump}")" ) > "${dump}.sha256" || return 1
  v_bytes=$(( v_bytes + $(wc -c < "${dump}") ))
  DUMPS+=("${dump}")
}

while IFS= read -r db; do
  v_databases=$(( v_databases + 1 ))
  if ! dump_one "${db}"; then
    v_dumps="failed-${db}"
    fail "the dump of ${db} failed; this run's files are removed and earlier nights are untouched"
  fi
done <<< "${DATABASES}"
v_dumps='ok'
# Every dump is whole from here, so a later failure keeps them: a broken offsite must never cost the
# local copy. Only a failed dump stage removes what this run wrote.
DONE=1

# --- offsite ----------------------------------------------------------------------
if [ ! -e "${CONFIG}" ]; then
  v_offsite='not-configured'
  v_forget='skipped'; v_check='skipped'; v_roundtrip='skipped'
  printf '%s: %s does not exist; the local dumps are written and verified, nothing left the box (%s)\n' \
    "${PROGRAM}" "${CONFIG}" 'ops/postgres-backup.md § Pending Operator actions' >&2
  "${VERIFY}" "${DUMPS[@]}" || { v_restore='failed-local'; fail 'the local dumps did not verify'; }
  v_restore='verified-local'
  OUTCOME=75
else
  [ -r "${CONFIG}" ] || { v_offsite='config-unreadable'; fail "${CONFIG} exists and this account cannot read it: sudo chown root:$(id -gn) ${CONFIG} && sudo chmod 0640 ${CONFIG}"; }
  for name in RESTIC_REPOSITORY RESTIC_PASSWORD; do
    grep -q "^${name}=." -- "${CONFIG}" || { v_offsite='misconfigured'; fail "${CONFIG} sets no ${name}"; }
  done
  restic_run cat config > /dev/null
  case $? in
    0) ;;
    10) v_offsite='not-initialized'; fail 'the restic repository does not exist: run ops/postgres-backup.md § Install and first run, step 4 (restic init)' ;;
    *) v_offsite='unreachable'; fail 'restic cannot open the repository' ;;
  esac

  json="$(restic_run backup --json --host "${TAG}" --tag "${TAG}" "${DUMPS[@]}" "${DUMPS[@]/%/.counts}" "${DUMPS[@]/%/.sha256}")" \
    || { v_offsite='backup-failed'; fail 'restic backup failed'; }
  snapshot_id="$(grep -o '"snapshot_id":"[0-9a-f]\{64\}"' <<< "${json}" | tail -n 1 | cut -d'"' -f4)"
  [ -n "${snapshot_id}" ] || { v_offsite='backup-failed'; fail 'restic backup reported no snapshot id'; }
  v_offsite="ok-${snapshot_id:0:8}"

  restic_run forget --host "${TAG}" --tag "${TAG}" --group-by host,tags "${KEEP[@]}" --prune > /dev/null \
    || { v_forget='failed'; fail 'restic forget failed'; }
  v_forget='ok'
  restic_run check > /dev/null || { v_check='failed'; fail 'restic check found a problem in the repository'; }
  v_check='ok'

  # The snapshot comes back into a scratch directory the restic container writes as this account.
  SCRATCH="$(mktemp -d "${BACKUP_DIR}/.restore.XXXXXX")" || fail 'cannot make a scratch directory'
  restic_run restore "${snapshot_id}" --target /restore > /dev/null \
    || { v_roundtrip='restore-failed'; fail 'restic restore of this snapshot failed'; }
  RESTORED=()
  for dump in "${DUMPS[@]}"; do
    back="${SCRATCH}${dump}"
    for suffix in '' .counts .sha256; do
      [ -f "${back}${suffix}" ] || { v_roundtrip='missing'; fail "the snapshot lacks ${dump}${suffix}"; }
    done
    if ! cmp -s -- "${dump}.sha256" "${back}.sha256" || ! cmp -s -- "${dump}.counts" "${back}.counts"; then
      v_roundtrip='mismatch'
      fail "${dump} came back from the repository different"
    fi
    RESTORED+=("${back}")
  done
  v_roundtrip='sha256-match'
  "${VERIFY}" "${RESTORED[@]}" || { v_restore='failed'; fail 'the dumps restored from the repository did not verify'; }
  v_restore='verified'
  OUTCOME=0
fi


# --- the prune ------------------------------------------------------------------
if ! removed="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'pg-*' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"; then
  v_prune='failed'
  fail "the retention prune of ${BACKUP_DIR} failed"
fi
v_prune="removed-${removed}-aged-over-${RETENTION_DAYS}-whole-days"

exit "${OUTCOME}"
