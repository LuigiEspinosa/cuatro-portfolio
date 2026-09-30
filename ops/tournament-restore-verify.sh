#!/usr/bin/env bash
# Prove a tournament store dump by restoring it (Epic 3 retrospective action 4, AD-10).
#
#   tournament-restore-verify.sh <path/to/tournament-<stamp>.dump>
#
# A green `pg_dump` says a file was written, not that the data comes back, so this restores the dump
# `ops/tournament-backup.sh` wrote into a throwaway Postgres 17 and reads it. It requires, in order:
#
#   - the dump's sha256 still equal to the one written beside it
#   - `pg_restore --exit-on-error` to finish into an empty database
#   - the restored tables to be exactly the tables the counts file names, each with the same row count
#   - every migration file under `apps/tournament/supabase/migrations` recorded in the restored
#     `supabase_migrations.schema_migrations`, by the version Supabase takes from its name (the digits
#     before the first `_`). Each one missing is named first.
#
# The store is Supabase's, so the dump names three roles Supabase provides (`anon`, `authenticated`,
# `service_role`, in its row level security policies). They are created in the throwaway first, and the
# restore skips owners and grants, which name Supabase's own administrative roles. Function bodies that
# call Supabase's `auth` and `realtime` schemas restore unchecked, as `pg_restore` always restores them.
#
# The throwaway container has no network, publishes nothing and is removed on every exit path, a signal
# included, because it holds a copy of the tournament's data. The store is never touched.
#
# Exit codes: 0 the restore was proved, 1 anything else. The last line is one summary.

set -uo pipefail

PROGRAM='tournament-restore-verify'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${TOURNAMENT_MIGRATIONS_DIR:-${HERE}/../apps/tournament/supabase/migrations}"
IMAGE="${TOURNAMENT_VERIFY_IMAGE:-postgres:17-alpine}"
SCRATCH="tournament-restore-verify-$$"

v_sha256='not-reached'
v_restore='not-reached'
v_tables='0'
v_rows='0'
v_migrations='not-reached'
STARTED=0

finish() {
  local code=$?
  [ "${STARTED}" -eq 1 ] && docker rm --force "${SCRATCH}" > /dev/null 2>&1
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
  docker exec "${SCRATCH}" psql -h 127.0.0.1 -U postgres -d tournament -v ON_ERROR_STOP=1 -At -F '|' -c "$1"
}

DUMP="${1:-}"
[ -n "${DUMP}" ] || fail 'usage: tournament-restore-verify.sh <path/to/tournament-<stamp>.dump>'
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
# Marked before the run: `docker run` can create the container and then fail to start it, and a signal
# can land before the next line, and either would otherwise leave a copy of the data behind.
STARTED=1
docker run --detach --name "${SCRATCH}" --network none \
  --env POSTGRES_DB=tournament --env POSTGRES_PASSWORD=throwaway \
  "${IMAGE}" > /dev/null || fail "cannot start a throwaway ${IMAGE}"

# Over TCP, never the socket: on a fresh volume the image runs a bootstrap server on the socket alone,
# which a socket check reports ready before the real one starts (`docker-compose.yml`, anchor-db).
ready=0
for _ in $(seq 1 60); do
  if docker exec "${SCRATCH}" pg_isready -h 127.0.0.1 -U postgres -d tournament > /dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "${ready}" -eq 1 ] || fail "the throwaway Postgres did not become ready in 60 s"

# A dump taken with `-n public` creates that schema itself, so the empty one the image made goes first.
restored_sql 'DROP SCHEMA public; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN' > /dev/null \
  || fail 'cannot prepare the throwaway Postgres for the restore'

# --- the restore ----------------------------------------------------------------
if ! docker exec -i "${SCRATCH}" pg_restore -h 127.0.0.1 -U postgres -d tournament \
  --exit-on-error --no-owner --no-privileges < "${DUMP}"; then
  v_restore='failed'
  fail "${DUMP} did not restore"
fi
v_restore='ok'

# --- the tables and their rows --------------------------------------------------
# The query `ops/tournament-backup.sh` counted the store with.
COUNTS_SQL="SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema IN ('public', 'supabase_migrations') AND table_type = 'BASE TABLE' ORDER BY 1"
RESTORED="$(restored_sql "${COUNTS_SQL}" | tr '|' '\t')" || fail 'cannot count the restored tables'
if [ "$(cut -f1 <<< "${RESTORED}" | LC_ALL=C sort)" != "$(cut -f1 < "${DUMP}.counts" | LC_ALL=C sort)" ]; then
  fail "the restored tables are not the tables the counts file names: restored [$(cut -f1 <<< "${RESTORED}" | tr '\n' ' ')], expected [$(cut -f1 < "${DUMP}.counts" | tr '\n' ' ')]"
fi

while IFS=$'\t' read -r table expected; do
  [ -n "${table}" ] || continue
  count="$(awk -F '\t' -v t="${table}" '$1 == t { print $2 }' <<< "${RESTORED}")"
  [ "${count}" = "${expected}" ] || fail "${table} restored ${count} rows, and the store held ${expected} when counted right after the dump"
  v_tables=$(( v_tables + 1 ))
  v_rows=$(( v_rows + count ))
done < "${DUMP}.counts"

# --- the migrations -------------------------------------------------------------
APPLIED="$(restored_sql 'SELECT version FROM supabase_migrations.schema_migrations')" \
  || fail 'the restored database has no readable supabase_migrations.schema_migrations'
[ -n "${APPLIED}" ] || fail 'the restored supabase_migrations.schema_migrations records no migration'
applied=0
pending=0
for file in "${MIGRATIONS_DIR}"/*.sql; do
  [ -f "${file}" ] || continue
  name="$(basename -- "${file}")"
  version="${name%%_*}"
  if grep -qxF -- "${version}" <<< "${APPLIED}"; then
    applied=$(( applied + 1 ))
  else
    pending=$(( pending + 1 ))
    printf '%s: migration %s is not in the backup'"'"'s ledger\n' "${PROGRAM}" "${name}" >&2
  fi
done
[ $(( applied + pending )) -gt 0 ] || fail "no migration file under ${MIGRATIONS_DIR}"
v_migrations="${applied}-applied-${pending}-pending"
[ "${pending}" -eq 0 ] \
  || fail "${pending} migration(s) this checkout carries are not in the backup's ledger, so the store is behind the code (DW-291)"

exit 0
