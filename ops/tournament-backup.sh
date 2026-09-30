#!/usr/bin/env bash
# The tournament store's nightly dump (Epic 3 retrospective action 4, AD-10).
#
# The tournament's data lives in Supabase Cloud, the declared exception to AD-10's one Postgres on the
# box (DW-280). This is its copy off Supabase's side: run on the box as `deploy` by cron at 03:45 UTC
# (`ops/tournament-placement.md` § Backup), it dumps the store through the session pooler from a
# throwaway `postgres:17-alpine` client and writes three files beside each other:
#
#   tournament-<stamp>.dump          pg_dump -Fc of the schemas `public` and `supabase_migrations`
#   tournament-<stamp>.dump.counts   every table in those schemas with its row count, read right after
#   tournament-<stamp>.dump.sha256   the dump's sha256, in `sha256sum` form
#
# `supabase_migrations` rides along because it holds the migration ledger, and
# `ops/tournament-restore-verify.sh` proves the restore by comparing that ledger with the checkout's
# migrations as well as every count. The counts are read after the dump, not in its snapshot, so a write
# in between makes that verification fail loudly, never pass wrongly.
#
# The database URL is read from the env file the Hub's compose project uses, never `source`d, and reaches
# the client container through its environment, so it never appears in a process list or a docker log.
#
# Retention: after a good dump, `tournament-*` files older than 14 whole days (`find -mtime +14`, the
# estate's arithmetic in `ops/backup-digital-library.md` § Retention) are removed. Nothing else in the
# directory is touched, the `pre-migrations-*` dump of the placement included.
#
# Exit codes: 0 the three files are written and the prune ran, 1 anything else. One summary line carries
# every stage's verdict on every path, a signal included, and a failed run removes what it half wrote.

set -uo pipefail
umask 077

PROGRAM='tournament-backup'
PATH="${PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
TZ=UTC
export TZ

ENV_FILE="${TOURNAMENT_ENV_FILE:-/home/deploy/cuatro-portfolio/.env.production}"
BACKUP_DIR="${TOURNAMENT_BACKUP_DIR:-/home/deploy/backups/cs-tournament}"
IMAGE="${TOURNAMENT_CLIENT_IMAGE:-postgres:17-alpine}"
# A pooler that accepts the connection and then stalls would hang the job forever with no summary.
DOCKER_TIMEOUT="${TOURNAMENT_DOCKER_TIMEOUT:-600}"
RETENTION_DAYS=14

v_dump='not-reached'
v_list='not-reached'
v_tables='0'
v_rows='0'
v_bytes='0'
v_sha256='not-reached'
v_prune='not-reached'
DUMP=''
DONE=0

finish() {
  local code=$?
  if [ "${DONE}" -ne 1 ] && [ -n "${DUMP}" ]; then
    rm -f -- "${DUMP}" "${DUMP}.partial" "${DUMP}.counts" "${DUMP}.sha256"
  fi
  printf '%s ts=%s file=%s dump=%s list=%s tables=%s rows=%s bytes=%s sha256=%s prune=%s exit=%s\n' \
    "${PROGRAM}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${DUMP:-none}" "${v_dump}" "${v_list}" "${v_tables}" \
    "${v_rows}" "${v_bytes}" "${v_sha256}" "${v_prune}" "${code}"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit 1
}

# A one-shot client against the store. The URL is in this shell's environment and `-e` names it without
# a value, so docker copies it into the container and no argv carries it. `sslmode=require` in the URL
# wins; PGSSLMODE is the floor for a URL without one.
client() {
  timeout "${DOCKER_TIMEOUT}" docker run --rm -i \
    -e TOURNAMENT_DATABASE_URL -e PGSSLMODE=require -e PGCONNECT_TIMEOUT=30 \
    "${IMAGE}" sh -c "$1"
}

# --- the URL --------------------------------------------------------------------
[ -r "${ENV_FILE}" ] || fail "cannot read ${ENV_FILE}"
line="$(grep -m1 '^TOURNAMENT_DATABASE_URL=' -- "${ENV_FILE}")" \
  || fail "${ENV_FILE} has no TOURNAMENT_DATABASE_URL line"
url="${line#TOURNAMENT_DATABASE_URL=}"
url="${url%$'\r'}"
case "${url}" in
  \"*\") url="${url#\"}"; url="${url%\"}" ;;
  \'*\') url="${url#\'}"; url="${url%\'}" ;;
esac
case "${url}" in
  postgres://*|postgresql://*) ;;
  *) fail "TOURNAMENT_DATABASE_URL in ${ENV_FILE} is not a postgres URL" ;;
esac
TOURNAMENT_DATABASE_URL="${url}"
export TOURNAMENT_DATABASE_URL
unset line url

mkdir -p -m 0700 -- "${BACKUP_DIR}" || fail "cannot create ${BACKUP_DIR}"

DUMP="${BACKUP_DIR}/tournament-$(date -u +%Y%m%dT%H%M%SZ).dump"
[ -e "${DUMP}" ] && { DUMP=''; fail 'a dump with this second'"'"'s name already exists; run it again'; }

# --- the dump -------------------------------------------------------------------
if ! client 'exec pg_dump --dbname="${TOURNAMENT_DATABASE_URL}" -Fc -n public -n supabase_migrations' \
  < /dev/null > "${DUMP}.partial"; then
  v_dump='failed'
  fail 'pg_dump of the tournament store failed'
fi
[ -s "${DUMP}.partial" ] || { v_dump='empty'; fail 'pg_dump wrote nothing'; }
mv -- "${DUMP}.partial" "${DUMP}" || fail "cannot move the dump into ${BACKUP_DIR}"
v_dump='ok'
v_bytes="$(wc -c < "${DUMP}" | tr -d ' ')"

# The archive's own table of contents, so a truncated write is caught here and not at a restore.
if ! client 'exec pg_restore --list > /dev/null' < "${DUMP}"; then
  v_list='unreadable'
  fail 'the dump is not an archive pg_restore can read'
fi
v_list='ok'

# --- the counts -----------------------------------------------------------------
# One query for every table, so the store is read once. The same query reads the restore.
COUNTS_SQL="SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema IN ('public', 'supabase_migrations') AND table_type = 'BASE TABLE' ORDER BY 1"
COUNTS="$(printf '%s\n' "${COUNTS_SQL}" | client 'exec psql "${TOURNAMENT_DATABASE_URL}" -v ON_ERROR_STOP=1 -At -F "|"')" \
  || fail 'cannot count the tables of the store'
[ -n "${COUNTS}" ] || fail 'the store holds no tables, so this is not the database the tournament serves from'

: > "${DUMP}.counts" || fail "cannot write ${DUMP}.counts"
while IFS='|' read -r table count; do
  [ -n "${table}" ] || continue
  case "${count}" in
    ''|*[!0-9]*) fail "${table} answered a row count that is not a number: ${count}" ;;
  esac
  printf '%s\t%s\n' "${table}" "${count}" >> "${DUMP}.counts"
  v_tables=$(( v_tables + 1 ))
  v_rows=$(( v_rows + count ))
done <<< "${COUNTS}"
grep -q $'^supabase_migrations\\.schema_migrations\t' "${DUMP}.counts" \
  || fail 'the store has no supabase_migrations.schema_migrations, so the dump carries no migration ledger'

# --- the checksum ---------------------------------------------------------------
( cd -- "${BACKUP_DIR}" && sha256sum -- "$(basename -- "${DUMP}")" ) > "${DUMP}.sha256" \
  || { v_sha256='failed'; fail 'cannot checksum the dump'; }
v_sha256="$(cut -d' ' -f1 < "${DUMP}.sha256")"

DONE=1

# --- the prune ------------------------------------------------------------------
# Only after a good dump, so a failing night never deletes the last good copy.
if ! removed="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'tournament-*' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"; then
  v_prune='failed'
  fail "the retention prune of ${BACKUP_DIR} failed"
fi
v_prune="removed-${removed}-aged-over-${RETENTION_DAYS}-whole-days"

exit 0
