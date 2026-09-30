#!/usr/bin/env bash
# Prove estate Postgres dumps by restoring them (Story 4-5, AD-10).
#
#   postgres-restore-verify.sh <path/to/pg-<database>-<stamp>.dump>...
#
# A green `pg_dump` says a file was written, not that the data comes back, so this restores what
# `ops/postgres-backup.sh` wrote into one throwaway Postgres of the instance's own major and reads it. For
# each dump it requires, in order:
#
#   - the dump's sha256 still equal to the one written beside it (checked for every dump before anything
#     starts)
#   - `pg_restore --exit-on-error` to finish into an empty database of the dump's name, owners and grants
#     skipped, since the throwaway has none of the consumer roles
#   - the restored tables to be exactly the tables the counts file names, each with the same row count;
#     the first that differs is named with its database
#
# The throwaway container has no network, publishes nothing and is removed with its volume on every exit
# path, a signal included, because it holds a copy of the estate's data. The live instance is never
# touched, so this is safe to run beside it.
#
# Exit codes: 0 every dump was proved, 1 anything else. The last line is one summary.

set -uo pipefail

PROGRAM='postgres-restore-verify'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

# The instance's image (`ops/postgres/compose.yml`), so the restore runs on the major that wrote the dump.
IMAGE='postgres:18.6-trixie'
SCRATCH="postgres-restore-verify-$$"

COUNTS_SQL="SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE' ORDER BY 1"

v_dumps='0'
v_sha256='not-reached'
v_restore='not-reached'
v_tables='0'
v_rows='0'
STARTED=0

# shellcheck disable=SC2329 # invoked by the EXIT trap
finish() {
  local code=$?
  [ "${STARTED}" -eq 1 ] && docker rm --force --volumes "${SCRATCH}" > /dev/null 2>&1
  printf '%s dumps=%s sha256=%s restore=%s tables=%s rows=%s exit=%s\n' \
    "${PROGRAM}" "${v_dumps}" "${v_sha256}" "${v_restore}" "${v_tables}" "${v_rows}" "${code}"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit 1
}

restored_sql() {
  docker exec "${SCRATCH}" psql -X -h 127.0.0.1 -U postgres -d "$1" -v ON_ERROR_STOP=1 -At -F $'\t' -c "$2"
}

[ "$#" -gt 0 ] || fail 'usage: postgres-restore-verify.sh <path/to/pg-<database>-<stamp>.dump>...'

# --- the files and their checksums ------------------------------------------------
for dump in "$@"; do
  name="$(basename -- "${dump}")"
  [[ "${name}" =~ ^pg-([a-z_][a-z0-9_]*)-[0-9]{8}T[0-9]{6}Z\.dump$ ]] \
    || fail "${name} is not named pg-<database>-<stamp>.dump"
  [ -s "${dump}" ] || fail "${dump} is missing or empty"
  [ -f "${dump}.counts" ] || fail "${dump}.counts is missing, so there is nothing to compare the restore with"
  [ -s "${dump}.sha256" ] || fail "${dump}.sha256 is missing or empty"
  if ! ( cd -- "$(dirname -- "${dump}")" && sha256sum --check --status -- "${name}.sha256" ); then
    v_sha256='mismatch'
    fail "${dump} no longer matches ${dump}.sha256"
  fi
done
v_sha256='match'

# --- the throwaway Postgres -----------------------------------------------------
docker run --detach --name "${SCRATCH}" --network none --env POSTGRES_PASSWORD=throwaway \
  "${IMAGE}" > /dev/null || fail "cannot start a throwaway ${IMAGE}"
STARTED=1

# Over TCP, never the socket: on a fresh volume the image runs a bootstrap server on the socket alone,
# which a socket check reports ready before the real one starts.
ready=0
for _ in $(seq 1 90); do
  if docker exec "${SCRATCH}" pg_isready -h 127.0.0.1 -U postgres -d postgres > /dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "${ready}" -eq 1 ] || fail 'the throwaway Postgres did not become ready in 90 s'

# --- each restore, its tables and their rows ---------------------------------------
for dump in "$@"; do
  name="$(basename -- "${dump}")"
  db="${name#pg-}"
  db="${db%-*}"
  docker exec "${SCRATCH}" createdb -h 127.0.0.1 -U postgres "${db}" || fail "cannot create ${db} in the throwaway"
  if ! docker exec -i "${SCRATCH}" pg_restore -h 127.0.0.1 -U postgres -d "${db}" --no-owner --no-acl --exit-on-error < "${dump}"; then
    v_restore="failed-${db}"
    fail "${dump} did not restore"
  fi

  RESTORED="$(restored_sql "${db}" "${COUNTS_SQL}")" || fail "cannot count the restored ${db}"
  if [ "$(cut -f1 <<< "${RESTORED}" | LC_ALL=C sort)" != "$(cut -f1 < "${dump}.counts" | LC_ALL=C sort)" ]; then
    fail "${db}: the restored tables are not the tables the counts file names: restored [$(cut -f1 <<< "${RESTORED}" | tr '\n' ' ')], expected [$(cut -f1 < "${dump}.counts" | tr '\n' ' ')]"
  fi
  while IFS=$'\t' read -r table expected; do
    [ -n "${table}" ] || continue
    count="$(awk -F '\t' -v t="${table}" '$1 == t { print $2; exit }' <<< "${RESTORED}")"
    [ "${count}" = "${expected}" ] \
      || fail "${db}: ${table} restored ${count} rows, and the live database held ${expected} when the dump was taken"
    v_tables=$(( v_tables + 1 ))
    v_rows=$(( v_rows + count ))
  done < "${dump}.counts"
  v_dumps=$(( v_dumps + 1 ))
done
v_restore='ok'

exit 0
