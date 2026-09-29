-- AD-10: the finance application's own database and role in the Anchor's Postgres, never a schema
-- inside another application's database. Run once, as the superuser, before the first
-- `finance-migrate`, with psql's `-v password=...` supplying the role's password. The role's
-- CONNECTION LIMIT is the explicit ceiling: `lib/db.ts` pools five per container, and a rollout runs
-- two containers side by side. `.github/workflows/image-finance.yml` runs this file against a
-- throwaway Postgres on every push.
CREATE ROLE finance LOGIN PASSWORD :'password' CONNECTION LIMIT 10;
CREATE DATABASE finance OWNER finance CONNECTION LIMIT 10;
REVOKE ALL ON DATABASE finance FROM PUBLIC;
