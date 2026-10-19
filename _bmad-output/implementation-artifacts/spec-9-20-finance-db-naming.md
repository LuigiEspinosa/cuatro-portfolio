---
title: "Story 9-20: rename finance's database and role to cuatro_finance"
type: 'chore'
created: '2026-10-18'
status: 'in-review'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '721930597e9011d27c108c650a91e515d9b9da0f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The estate Postgres already holds finance's database and role as `cuatro_finance` (AD-3, `ops/postgres/init/10-consumers.sh`), but `apps/finance/prisma/provision.sql`, `image-finance.yml` and both finance services in `docker-compose.yml` still name `finance` in `anchor-db`, a store whose container and volume Story 4-11 removed and whose declaration survives only because finance names it (DW-300).

**Approach:** Rename the role and database to `cuatro_finance` in `provision.sql` and the image workflow's throwaway URL, point `finance` and `finance-migrate` at `estate-postgres:5432/cuatro_finance` on the `estate-postgres` network with the estate's password variable, then remove the orphaned `anchor-db` service and `postgres_data` volume declarations, and correct the records that say the declaration stays for finance. Finance is placed nowhere, so no box step follows.

</frozen-after-approval>

## Implementation Notes

- Implemented directly in this session at `81adf0ae2a8afc1762522dabe67c4ba45a619225`: this workflow sub-agent has no agent tool, so no implementation or reviewer subagent could be launched. Epic 9 has no `epic-9-context.md`; the plan and the triage are the context, as in 9-4, 9-6 and 9-18. Token count, Open Questions and open inferences: the spec is under 1600 tokens before this section, and no I-n reading was taken.
- **No box step.** Finance is placed nowhere (AD-9, DW-269): nothing a deploy runs starts `finance` or `finance-migrate`, and `ops/deploy-remote.sh` rolls `anchor-app` and runs `anchor-app-migrate` alone. The box already holds `cuatro_finance` (created by `ops/postgres/init/10-consumers.sh` at the estate Postgres's first start, 2026-09-30, `ops/postgres.md` § Placement run), and `cuatro-portfolio-anchor-db-1` with its volume `cuatro-portfolio_postgres_data` went at `ops/caddy-retirement.md` step 12 on 2026-10-01, so removing the declaration leaves no orphan container or volume behind at the next deploy.
- `apps/finance/prisma/provision.sql`: role and database `cuatro_finance`, the same `CONNECTION LIMIT 10` and `REVOKE ... FROM PUBLIC` the estate init applies. Kept, not retired: `image-finance.yml` still provisions its throwaway Postgres with it before the migration, and the header now says it never runs on the box.
- `.github/workflows/image-finance.yml`: the throwaway `DATABASE_URL` names `cuatro_finance` (user and database). The step name is pinned by `finance-image.test.ts` and unchanged.
- `docker-compose.yml`: `finance` and `finance-migrate` read `postgresql://cuatro_finance:${CUATRO_FINANCE_DB_PASSWORD-}@estate-postgres:5432/cuatro_finance` and join `estate-postgres` (declared external already), with no `depends_on`, as the tracker's services do. The password variable is the estate env file's own name, `CUATRO_FINANCE_DB_PASSWORD`, following `CUATRO_TRACKER_DB_PASSWORD`; the old `FINANCE_DB_PASSWORD` is gone. The `anchor-db` service and the top-level `volumes: postgres_data` are removed: finance was their last reader, so the file no longer interpolates `POSTGRES_PASSWORD` (its unset warning is gone from `docker compose config`).
- Comments and records that stated the old shape: `apps/finance/lib/db.ts` (role name), the tournament block's comment and the Umami test's comment, `ops/tracker-restore-verify.sh` and `ops/tournament-restore-verify.sh` (their TCP-readiness comment pointed at `anchor-db`'s healthcheck, now `ops/postgres/compose.yml`'s), `ops/postgres.md` (the retirement paragraph and the budget row), `ops/routing-inventory.md` (the box after Epic 4), `ops/caddy-retirement.md` (a dated note under "`anchor-db`'s declaration stays"), `ops/estate.md` (a dated amendment to finance's "Data (AD-10)" bullet, and the DW-269 row's planning tense made past) and `ops/contract-serving.md` ("What a deploy no longer does" names `anchor-umami` alone). The last two were added after the independent verifier's round 1 found them still stating the old shape. Line 1 of every record untouched.
- `ops/__tests__/deploy-remote.test.ts`: the docker stub's `config --services` list drops `anchor-db`, matching what the real file now lists. No assertion changed.
- Left alone: `apps/finance/docker-compose.yml` (local development only, `POSTGRES_DB: finance`; DW-271 owns retiring it) and `apps/finance/.env.example` (unread by rule). Returned to the Operator below.

### Planted failures

Each run: `corepack pnpm vitest --run docker/__tests__/compose.test.ts docker/__tests__/finance-image.test.ts`, the plant applied by a scratch script and the file restored byte for byte after.

- P1, `compose.test.ts:276` (finance services on `estate-postgres`): `finance-migrate`'s network changed to `default`: `AssertionError: expected '  finance-migrate:\n    image: ghcr.i…' to match /^ {4}networks:\n {6}estate-postgres:$/m`, `Tests  1 failed | 39 passed (40)`.
- P2, `compose.test.ts:279` (no `anchor-db` service): an `anchor-db:` service re-added: `AssertionError: expected true to be false // Object.is equality`, `Tests  1 failed | 39 passed (40)`.
- P3, `compose.test.ts:280` (no `postgres_data` volume): `volumes:\n  postgres_data:` re-added: `AssertionError: expected 'name: cuatro-portfolio\nservices:\n  …' not to match /^ {2}postgres_data:$/m`, `Tests  1 failed | 39 passed (40)`. (First written as "no top-level `volumes:`", planted the same way, then narrowed in review so a future volume elsewhere does not trip it; re-planted after the narrowing.)
- P4, `compose.test.ts:277` (services never name `anchor-db`): `depends_on: anchor-db` added to `finance`: `AssertionError: expected '  finance:\n    image: ghcr.io/luigie…' not to contain 'anchor-db'`, `Tests  1 failed | 39 passed (40)`.
- P5, `compose.test.ts:271` (the changed `DATABASE` constant): `finance`'s URL put back to `postgresql://finance:${FINANCE_DB_PASSWORD-}@anchor-db:5432/finance`: `AssertionError: expected [ '  finance:', …(16) ] to deeply equal ArrayContaining{…}` and the P4 line, `Tests  2 failed | 38 passed (40)`.
- P6, `finance-image.test.ts:97` (REVOKE): the `REVOKE` line removed: `expected '-- AD-10: the finance application\'s …' to match /^REVOKE ALL ON DATABASE cuatro_finan…/m`, `Tests  1 failed | 39 passed (40)`.
- P7, `finance-image.test.ts:106` (provision equals the estate init): `10-consumers.sh`'s limit set to 12: `AssertionError: expected [ 'cuatro_finance', '10' ] to deeply equal [ 'cuatro_finance', '12' ]`, `Tests  1 failed | 39 passed (40)`.
- P8, `finance-image.test.ts:95` and `:106` (role name): `CREATE ROLE finance`: `to match /^CREATE ROLE cuatro_finance LOGIN PA…/m`, `expected [ 'finance', '10' ] to deeply equal [ 'cuatro_finance', '10' ]`, and the pool case `expected 10 to be less than or equal to NaN`, `Tests  3 failed | 37 passed (40)`.
- P9, `finance-image.test.ts:86` (workflow URL): the throwaway URL put back to `finance`: `to match /^ {6}DATABASE_URL: postgresql:\/\/cu…/`, `Tests  1 failed | 39 passed (40)`.
- P10, `finance-image.test.ts:105` (the init line exists): the init's line renamed to `finance 10 FINANCE_DB_PASSWORD`: `AssertionError: expected undefined to be defined`, `Tests  1 failed | 39 passed (40)`.
- P11, `finance-image.test.ts:96` (database name): `CREATE DATABASE finance OWNER`: `to match /^CREATE DATABASE cuatro_finance OWNE…/m`, `Tests  1 failed | 39 passed (40)`.

Restored after each: `Tests  40 passed (40)`; `ops/postgres/init/10-consumers.sh` is not in the diff.

## Review Triage Log

Every layer ran inline in this session (no agent tool). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | edge-case | `finance` now joins `estate-postgres` alone and leaves the project's `default` network | false as a defect | Nothing else on `default` serves finance; `estate-postgres` is not `internal` (`ops/postgres/compose.yml`), so egress is unchanged; a placement adds its ingress network |
| 2 | blind | "No top-level `volumes:`" would fail a future story that adds any volume, with a message that does not say why | low, patched | Narrowed to `postgres_data` (P3 re-planted) |
| 3 | blind | Removing `anchor-db` removes `caddy-retirement.md` step 12's rollback | false as a defect | Step 12 ran 2026-10-01 05:58Z and its volume is gone; the rollback's remaining half (restore the offsite dump into a fresh container) is recorded in the dated note, and nothing reads that data |
| 4 | blind | `POSTGRES_PASSWORD` in the box's `.env.production` is now unread | low, Operator's | `caddy-retirement.md` Operator action 6 already defers that line to the clean start "once finance no longer names `anchor-db`"; that condition now holds. Returned below |
| 5 | blind | `apps/finance/docker-compose.yml` still creates a local `finance` database | low, other surface | Local development only, owned by DW-271; returned below |
| 6 | verification-gap | Does the CI image job still provision and migrate? | no defect in repo | The job's URL, the provision file and the step order are held by `finance-image.test.ts`; `psql -v password=...` against `cuatro_finance` is the same statement shape as before. Image (finance) on the pushed sha confirms |
| 7 | ponytail | `provision.sql` duplicates the estate init's three statements | kept | CI needs it for the throwaway database; the new case holds the two equal instead of adding a shared generator |
| 8 | verification-loop | Hub build | n/a | No Hub source or build input changed. Root typecheck exit 0; suites in Verification; lint N/A (AGENTS.md); no secret in the diff |
| 9 | design | No `.scss`, `.tsx` or motion change | n/a | Design review skipped |

## Independent verifier

**Independent verifier:** PASS on round 2, 2026-10-18, separate agent; tests: all runs on the story worktree at
`dcfbc4d` (three commits over `origin/dev`, before the rebase that made the fix commit `2a05323`).
- Compose config: `export HUB_TAG="$(git rev-parse HEAD)"; docker compose --env-file <empty file> --profile finance
  --profile migrate config --format json`: exit 0, the only warning `UMAMI_APP_SECRET` (the empty env file).
  `finance` and `finance-migrate` both resolve `DATABASE_URL=postgresql://cuatro_finance:@estate-postgres:5432/cuatro_finance`,
  networks `[estate-postgres]`, no `depends_on`; no top-level `volumes`; services `anchor-app anchor-umami
  anchor-umami-migrate finance finance-migrate tracker-migrate tracker-migrate-demo`.
- `corepack pnpm typecheck` (root): exit 0. `corepack pnpm --filter finance typecheck`: exit 0.
- `corepack pnpm --filter finance test -- --run`: 5 files, 70 tests passed.
- `corepack pnpm test -- --run`, full root suite: 4 files failed, 83 passed (87); 4 failed, 2026 passed, 9 skipped
  (2039 tests). All 4 failures were DW-135 WSL-bash stalls (`deploy-remote`, `demo-reset`, `library-backup`,
  `postgres-backup`, "WSL did not answer" at about 30s); the four together again stalled in other cases; each alone
  passed: `deploy-remote` 28/28, `demo-reset` 30/30, `library-backup` 66/66, `postgres-backup` 20 passed, 1 skipped.
- Verifier's plants, each restored with `git checkout`, the worktree clean before and after: `provision.sql`'s
  `CREATE ROLE` limit set to 11 failed `finance-image.test.ts` 2 of 10 (`expected [ 'cuatro_finance', '11' ] to
  deeply equal [ 'cuatro_finance', '10' ]`); `finance-migrate`'s `estate-postgres` network replaced by
  `depends_on: anchor-db` failed `compose.test.ts` 1 of 30 ("reaches cuatro_finance on the estate-postgres network,
  and nothing declares anchor-db any more"). Restored, the two files passed 40/40.
- Also checked: nothing under `contracts/`, and `ci.yml`, `deferred-work.md` and `sprint-status.yaml` untouched; no
  em-dash, en-dash, dash-standing double hyphen or emoji on any added line; three single-line Conventional subjects;
  the remaining `anchor-db` mentions in `ops/` are dated history and `docker-compose.yml` names it no more; the
  DW-300 closure matches the diff; the spec states no box step, since finance is placed nowhere.

## Ledger closures

**DW-300:** **Closed 2026-10-18 by Story 9-20-finance-db-naming** (`2a05323`, `docker-compose.yml`: `finance`, `finance-migrate`): finance's role and database are `cuatro_finance` everywhere the repository names them. Both services read `postgresql://cuatro_finance:${CUATRO_FINANCE_DB_PASSWORD-}@estate-postgres:5432/cuatro_finance` and join `estate-postgres`, `apps/finance/prisma/provision.sql` creates `cuatro_finance` with the limit and `REVOKE` the estate init applies (a case in `docker/__tests__/finance-image.test.ts` holds the two equal), and `image-finance.yml`'s throwaway URL names it. Finance was `anchor-db`'s last reader, so that service and its `postgres_data` volume are removed from `docker-compose.yml`; the container and volume had already gone at `ops/caddy-retirement.md` step 12. Finance is placed nowhere, so no box step followed; the estate Postgres has held `cuatro_finance` since 2026-09-30.

Action items: none named for this story.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `81adf0a`):
- `export HUB_TAG="$(git rev-parse HEAD)"; docker compose --env-file <empty file> --profile finance --profile migrate config --format json`: exit 0; `finance` and `finance-migrate` resolve `DATABASE_URL` to `postgresql://cuatro_finance:@estate-postgres:5432/cuatro_finance`, networks `[ 'estate-postgres' ]`, no `depends_on`; no top-level volumes; services `anchor-app anchor-umami anchor-umami-migrate finance finance-migrate tracker-migrate tracker-migrate-demo`. The same command on the baseline file warned `The "POSTGRES_PASSWORD" variable is not set`; now only `UMAMI_APP_SECRET` warns (the empty env file).
- `corepack pnpm typecheck` (root): exit 0.
- `corepack pnpm --filter finance typecheck`: exit 0.
- `corepack pnpm --filter finance test -- --run`: `Test Files  5 passed (5)`, `Tests  70 passed (70)`.
- `corepack pnpm test -- --run` (root): `Test Files  2 failed | 85 passed (87)`, `Tests  2 failed | 2033 passed | 4 skipped (2039)`, the two failures in the WSL-bash suites `library-backup` and `postgres-backup` at about 30 seconds (DW-135). Re-run alone: `Test Files  2 passed (2)`, `Tests  86 passed | 1 skipped (87)`.
- After the review narrowing: `compose.test.ts`, `finance-image.test.ts`, `deploy-remote.test.ts`: `Test Files  3 passed (3)`, `Tests  68 passed (68)`.
