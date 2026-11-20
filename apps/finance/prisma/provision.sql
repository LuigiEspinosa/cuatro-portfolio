-- AD-10: the finance application's own database and role, never a schema inside another application's
-- database, named `cuatro_finance` from its Registry id (AD-3). On the box the estate Postgres creates
-- them on its first start (`ops/postgres/init/10-consumers.sh`, the same name and limit, which
-- `docker/__tests__/finance-image.test.ts` holds equal), so this file is never run there.
-- `.github/workflows/image-finance.yml` runs it against a throwaway Postgres on every push, as the
-- superuser, before the migration, with psql's `-v password=...` supplying the role's password. The
-- role's CONNECTION LIMIT is the explicit ceiling: `lib/db.ts` pools five per container, and a rollout
-- runs two containers side by side.
CREATE ROLE cuatro_finance LOGIN PASSWORD :'password' CONNECTION LIMIT 10;
CREATE DATABASE cuatro_finance OWNER cuatro_finance CONNECTION LIMIT 10;
REVOKE ALL ON DATABASE cuatro_finance FROM PUBLIC;
