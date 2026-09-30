#!/bin/sh
# One database and one role per consumer (Story 4-4, AD-10). The image runs this once, on an empty volume,
# as the superuser, before the server accepts network connections. Each role owns its database, carries
# its CONNECTION LIMIT on both, and is the only role besides the superuser that may connect to it:
# `REVOKE ALL ... FROM PUBLIC` takes CONNECT away from everyone else.
#
# The table `CONSUMERS` below is the budget `ops/postgres.md` § The budget states and
# `ops/__tests__/postgres-init.test.ts` parses: name, connection limit, the variable holding the role's
# password. Names follow AD-3 (the Registry id, hyphens as underscores); `umami` has no Registry id.
# Adding a consumer is one line here, one row there, and one variable in the env file.
set -eu

# name, CONNECTION LIMIT, the variable holding the role's password.
CONSUMERS='umami 25 UMAMI_DB_PASSWORD
cuatro_tracker 20 CUATRO_TRACKER_DB_PASSWORD
cs_tracker 25 CS_TRACKER_DB_PASSWORD
cuatro_finance 10 CUATRO_FINANCE_DB_PASSWORD'

# Every variable is checked before any statement runs. The image skips this directory on any later start
# once the cluster exists, so a failure midway restarts into a healthy server holding half the consumers;
# failing first leaves none, which `ops/postgres.md` § First start catches and undoes.
# ponytail: the healthcheck does not count consumers; the runbook's first-start check does.
missing=0
while read -r name limit variable; do
  if [ -z "$(printenv "$variable" || true)" ]; then
    echo "10-consumers.sh: $variable is unset or empty; no database for $name" >&2
    missing=1
  fi
done <<EOF_CONSUMERS
$CONSUMERS
EOF_CONSUMERS
[ "$missing" -eq 0 ] || exit 1

# The maintenance databases too: a consumer role reaches its own database and nothing else, not even an
# empty `postgres`. The superuser keeps its access; CREATE DATABASE copies `template1` without connecting.
psql -v ON_ERROR_STOP=1 --no-psqlrc --username "${POSTGRES_USER:-postgres}" --dbname postgres \
  -c 'REVOKE CONNECT ON DATABASE postgres, template1 FROM PUBLIC'

while read -r name limit variable; do
  password=$(printenv "$variable")
  # Values reach SQL only as psql variables, quoted by psql (`:"name"`, `:'password'`), never spliced.
  psql -v ON_ERROR_STOP=1 --no-psqlrc --username "${POSTGRES_USER:-postgres}" --dbname postgres \
    -v name="$name" -v limit="$limit" -v password="$password" <<'SQL'
CREATE ROLE :"name" LOGIN PASSWORD :'password' CONNECTION LIMIT :limit;
CREATE DATABASE :"name" OWNER :"name" CONNECTION LIMIT :limit;
REVOKE ALL ON DATABASE :"name" FROM PUBLIC;
SQL
  echo "10-consumers.sh: database and role $name, connection limit $limit"
done <<EOF_CONSUMERS
$CONSUMERS
EOF_CONSUMERS
