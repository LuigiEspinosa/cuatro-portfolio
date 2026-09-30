#!/usr/bin/env bash
# Prove a tracker backup by restoring it (Story 3-6, AD-23).
#
#   tracker-restore-verify.sh <path/to/tracker-<stamp>.dump>
#
# A green `pg_dump` says a file was written, not that the data comes back, so this restores the dump
# `ops/tracker-backup.sh` wrote into a throwaway Postgres and reads it. It requires, in order:
#
#   - the dump's sha256 still equal to the one written beside it
#   - `pg_restore --exit-on-error` to finish into an empty database
#   - the restored tables to be exactly the tables the counts file names, each with the same row count
#   - every migration directory under `apps/tracker/prisma/migrations` applied, and not rolled back, in
#     the restored `_prisma_migrations`, so the image the cutover runs finds its schema already current
#     and its `tracker-migrate` applies nothing to the live database. Each one missing is named first.
#
# The throwaway container has no network, publishes nothing and is removed on every exit path, a signal
# included, because it holds a copy of the Operator's data. The live database is never touched.
#
# Exit codes: 0 the restore was proved, 1 anything else. The last line is one summary.

set -uo pipefail

PROGRAM='tracker-restore-verify'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${TRACKER_MIGRATIONS_DIR:-${HERE}/../apps/tracker/prisma/migrations}"
IMAGE="${TRACKER_VERIFY_IMAGE:-postgres:16-alpine}"
SCRATCH="tracker-restore-verify-$$"

v_sha256='not-reached'
v_restore='not-reached'
v_tables='0'
v_rows='0'
v_migrations='not-reached'
STARTED=0

finish() {
  local code=$?
  # `--volumes` too: the image declares a VOLUME for its data directory, so without it the restored copy
  # outlives the container as an anonymous volume (Story 4-8 found the 2026-09-29 run's on the box).
  [ "${STARTED}" -eq 1 ] && docker rm --force --volumes "${SCRATCH}" > /dev/null 2>&1
  printf '%s sha256=%s restore=%s tables=%s rows=%s migrations=%s exit=%s\n' \
    "${PROGRAM}" "${v_sha256}" "${v_restore}" "${v_tables}" "${v_rows}" "${v_migrations}" "${code}"
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
  docker exec "${SCRATCH}" psql -h 127.0.0.1 -U tracker -d tracker -v ON_ERROR_STOP=1 -At -c "$1"
}

DUMP="${1:-}"
[ -n "${DUMP}" ] || fail 'usage: tracker-restore-verify.sh <path/to/tracker-<stamp>.dump>'
[ -s "${DUMP}" ] || fail "${DUMP} is missing or empty"
[ -s "${DUMP}.counts" ] || fail "${DUMP}.counts is missing or empty, so there is nothing to compare the restore with"
[ -s "${DUMP}.sha256" ] || fail "${DUMP}.sha256 is missing or empty"
[ -d "${MIGRATIONS_DIR}" ] || fail "cannot find the migrations at ${MIGRATIONS_DIR}"

# --- the checksum ---------------------------------------------------------------
if ! ( cd -- "$(dirname -- "${DUMP}")" && sha256sum --check --status -- "$(basename -- "${DUMP}").sha256" ); then
  v_sha256='mismatch'
  fail "${DUMP} no longer matches ${DUMP}.sha256"
fi
v_sha256='match'

# --- the throwaway Postgres -----------------------------------------------------
docker run --detach --name "${SCRATCH}" --network none \
  --env POSTGRES_DB=tracker --env POSTGRES_USER=tracker --env POSTGRES_PASSWORD=throwaway \
  "${IMAGE}" > /dev/null || fail "cannot start a throwaway ${IMAGE}"
STARTED=1

# Over TCP, never the socket: on a fresh volume the image runs a bootstrap server on the socket alone,
# which a socket check reports ready before the real one starts (`docker-compose.yml`, anchor-db).
ready=0
for _ in $(seq 1 60); do
  if docker exec "${SCRATCH}" pg_isready -h 127.0.0.1 -U tracker -d tracker > /dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "${ready}" -eq 1 ] || fail "the throwaway Postgres did not become ready in 60 s"

# --- the restore ----------------------------------------------------------------
if ! docker exec -i "${SCRATCH}" pg_restore -h 127.0.0.1 -U tracker -d tracker --exit-on-error < "${DUMP}"; then
  v_restore='failed'
  fail "${DUMP} did not restore"
fi
v_restore='ok'

# --- the tables and their rows --------------------------------------------------
RESTORED="$(restored_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")" \
  || fail 'cannot list the restored tables'
EXPECTED="$(cut -f1 < "${DUMP}.counts" | LC_ALL=C sort)"
if [ "$(printf '%s\n' "${RESTORED}" | LC_ALL=C sort)" != "${EXPECTED}" ]; then
  fail "the restored tables are not the tables the counts file names: restored [$(echo ${RESTORED})], expected [$(echo ${EXPECTED})]"
fi

while IFS=$'\t' read -r table expected; do
  [ -n "${table}" ] || continue
  count="$(restored_sql "SELECT count(*) FROM public.\"${table}\"")" || fail "cannot count the restored ${table}"
  [ "${count}" = "${expected}" ] || fail "${table} restored ${count} rows, and the live database held ${expected} when the dump was taken"
  v_tables=$(( v_tables + 1 ))
  v_rows=$(( v_rows + count ))
done < "${DUMP}.counts"

# --- the migrations -------------------------------------------------------------
APPLIED="$(restored_sql "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")" \
  || fail 'the restored database has no readable _prisma_migrations, so it is not the schema the tracker migrates'
[ -n "${APPLIED}" ] || fail 'the restored _prisma_migrations records no applied migration'
applied=0
pending=0
for dir in "${MIGRATIONS_DIR}"/*/; do
  [ -d "${dir}" ] || continue
  name="$(basename -- "${dir}")"
  if grep -qxF -- "${name}" <<< "${APPLIED}"; then
    applied=$(( applied + 1 ))
  else
    pending=$(( pending + 1 ))
    printf '%s: migration %s is not applied in the backup\n' "${PROGRAM}" "${name}" >&2
  fi
done
[ $(( applied + pending )) -gt 0 ] || fail "no migration directory under ${MIGRATIONS_DIR}"
v_migrations="${applied}-applied-${pending}-pending"
[ "${pending}" -eq 0 ] \
  || fail "${pending} migration(s) this checkout carries are not applied in the backup, so the cutover's tracker-migrate would change the live schema"

exit 0
