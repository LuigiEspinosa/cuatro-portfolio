---
title: 'Story 3.6: Merge cuatro-tracker into apps/tracker'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '8eb98a415fe4c21dc934f4e16e1a80c1c01f6946'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-5-merge-cuatro-finance-into-apps-finance.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro-tracker` (Next.js 15, Prisma 6, BullMQ on Redis, qBittorrent) is its own repository and
serves `tracker.cuatro.dev` from containers the box builds (`cuatro-tracker-app`, `-worker`, `-migrate`),
the standing AD-8 violation. It is the second of AD-20's three merges, and the only live one.

**Approach:** Merge a `git filter-repo` rewrite of the source into `apps/tracker/` with its history, make it
the workspace `tracker` under the one root lockfile, and give it one sha-tagged image built, migrated and
checked in CI. Then write, not run, what the box needs: compose services for server, worker and migration,
a pre-cutover backup with a verified restore, and a cutover runbook whose every box step is an Operator item.

## Boundaries & Constraints

**Always:**

- The merge is `git filter-repo --to-subdirectory-filter apps/tracker` on a scratch clone, then
  `git merge --allow-unrelated-histories`; `git log --follow` works on a real file afterwards.
- One root `pnpm-lock.yaml`; `pnpm install --frozen-lockfile` passes; the Hub's build, the seven `ci.yml`
  jobs, typecheck and the unit suite stay green, and no gate weakens.
- The image is `ghcr.io/luigiespinosa/tracker:<git-sha>`, from the root pruned by
  `turbo prune tracker --docker` with `apps/tracker/Dockerfile`, pushed only after it migrated a throwaway
  database and answered `/api/ready`.
- Migrations never run on boot; `tracker-migrate` runs them before a rollout (AD-23).
- `tracker.cuatro.dev` stays the Registry's declared hostname, and the Registry is unchanged.
- Records say committed on `dev`; nothing here is live until the Epic 3 merge and the cutover.

**Never:**

- Nothing on the box, no push, no merge to `main`, no secret, no archive, no DNS, no Caddyfile edit.
- No `deploy.yml` wiring and no `ops/capacity-gate.yml` change (AD-9); no token adoption or restyle.
- No edit to `ops/deploy-remote.sh`, `image.yml`, `image-finance.yml` or the Hub's Dockerfile.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to finish
Epic 3 with the stories as written. Each answers a gap from the sources, is reversible before the cutover,
keeps every gate green, and is an Operator item):

1. **Source `main`**, equal to `dev` at `985e3c5` (131 commits). The box runs `5d49da7`; the one commit
   between is an e2e test, so the merged code carries no migration the box lacks.
2. **Id `tracker`** for workspace, image and service; `tracker-worker`, `tracker-migrate`. The Registry id
   stays `cuatro-tracker` (DW-260's split).
3. **The data stays where it serves.** The cutover replaces the app and worker containers only. Postgres,
   Redis and qBittorrent keep running in the box's `cuatro-tracker` project, reached over the external
   network `cuatro-tracker_default` by container name. One Postgres (AD-10) is Stories 4.4 and 4.8.
4. **Ingress by the existing alias.** `tracker` joins `cs-tracker_default` as `cuatro-app`, the upstream the
   box's Caddyfile proxies, so no Caddyfile changes, old and new serve the same data while both run, and
   rollback is starting the old containers again.
5. **One image, three commands:** the pruned workspace installed and built, `next start` (standalone output
   dropped), `tsx worker.ts`, and the lockfile's Prisma CLI for `tracker-migrate`.
6. **The healthcheck probes `/api/ready`**, 200 only when Postgres and Redis answer.
7. **Compose:** `tracker` and `tracker-worker` under profile `tracker`, `tracker-migrate` under `migrate`,
   tagged `${TRACKER_TAG-}`; secrets from `.env.production` prefixed `TRACKER_`.
8. **Token adoption deferred whole** (AD-14): `apps/tracker/` joins `OTHER_APPLICATIONS`; Epic 8 wave 2.
9. **The Hub's gates are the Hub's:** root `tsc` and Vitest exclude `apps/tracker`; CI's `test` job runs
   its typecheck and suite by filter.
10. **Its lockfile is folded in**; its `ioredis` override moves to the root; `lint` and `postinstall` go,
    and `build` and `typecheck` run `prisma generate` first.
11. **DW-272 closes** by a `packageExtensions` `zod` peer for `@hookform/resolvers`.
12. **Backup:** `ops/tracker-backup.sh` (`pg_dump -Fc`, per-table row counts, sha256) and
    `ops/tracker-restore-verify.sh` (restores into a throwaway Postgres with no network and requires every
    migration applied and every count equal), run with the old worker stopped. Local plus an off-box copy
    by `scp`; the offsite path is Story 4.5.
13. **Runbook:** `ops/tracker-cutover.md`, with an off-box request loop across the cutover, the sequence,
    the rollback and Pending Operator actions.
14. **Findings against Story 1.7** are filed, not worked around.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push | any branch | build, migrate a throwaway `tracker`, `/api/ready` 200, worker ready, push the sha tag | any failed step: nothing pushed |
| Hub deploy | compose with tracker, only `HUB_TAG` set | the Hub's commands exit 0; no tracker container | none needed |
| Missing tracker network | `cuatro-tracker_default` absent | only a tracker service refuses to start | compose names the network |
| Redis or Postgres down | `/api/ready` | 503 | the probe fails, a rollout keeps the old container |
| Backup | live `tracker` database | dump, counts and sha256 beside it, exit 0 | any failure: exit 1 naming it |
| Restore verify | a dump and its counts | exit 0 only if every migration applied and every count equal | a mismatch names the table; the throwaway container is always removed |
| Tracker stylesheet | a literal under `apps/tracker/` | not read | none |

</frozen-after-approval>

## Code Map

- Source `https://github.com/LuigiEspinosa/cuatro-tracker`, public, `main` = `dev` =
  `985e3c5580e150895ed68d751035c72ed5c14a0a`. Filtered scratch clone
  `<scratchpad>/epic-3/3-6/filtered` at `8b4788e63dc62e81836109704a006d3d2d680eba`, 400 files.
- `apps/tracker/` after the merge: own `pnpm-lock.yaml`, `packageManager: pnpm@10.4.1`, `pnpm.overrides`
  `ioredis 5.10.1`, `postinstall: prisma generate`, `lint: eslint`; `next.config.ts` `output: standalone`;
  `app/api/ready/route.ts` (db and redis, 1 s timeouts); `worker.ts` logs `worker.ready`; `lib/env.ts`
  validates at load unless `SKIP_ENV_VALIDATION`; `tests/setup.ts` stubs every env var; eleven migrations;
  its own `.github/workflows/ci.yml`, `docker/`, compose files and Playwright e2e.
- Models from Story 3-5: `apps/finance/Dockerfile`, `.github/workflows/image-finance.yml`,
  `docker-compose.yml` finance services, `docker/__tests__/finance-image.test.ts`, `compose.test.ts`,
  `ops/literal-conformance.mjs` `OTHER_APPLICATIONS`, `anchor-contract.test.ts` `isOtherApplication`,
  `workflow-hardening.test.ts`, root `tsconfig.json` and `vitest.config.ts` excludes, `pnpm-workspace.yaml`.
- Backup models: `ops/library-backup.sh`, `ops/library-restore-verify.sh`, `ops/backup-digital-library.md`,
  `ops/__tests__/library-backup.test.ts` (`runBash` launcher, WSL path mapping, stubs on PATH).
- Box facts from `ops/routing-inventory.md`: containers `cuatro-tracker-{app,worker,postgres,redis,qbittorrent}-1`;
  `cuatro-app` alias on `cs-tracker_default`; Caddy `reverse_proxy cuatro-app:3000`; `.env` names; the
  nightly `cuatro-backup.sh`; `ops/capacity-gate.yml` placement `cuatro-tracker`.
- Observed here: compose refuses only the service whose external network is missing.

## Tasks & Acceptance

**Execution:**

- [x] Merge: filtered clone fetched without a remote, merged subject-only, `git log --follow` proved.
- [x] Workspace: `apps/tracker/package.json` (name, scripts, no `packageManager` or `pnpm`), lockfile and
  root `pnpm-workspace.yaml`; `next.config.ts` without standalone; root excludes; `OTHER_APPLICATIONS`;
  alias-search pin; DW-272's `packageExtensions`.
- [x] Deploy unit: `apps/tracker/Dockerfile`, `.github/workflows/image-tracker.yml`, `ci.yml` tracker steps,
  `docker-compose.yml` services and network, `docker/__tests__/tracker-image.test.ts`, `compose.test.ts`
  and `workflow-hardening.test.ts` cases.
- [x] Backup: `ops/tracker-backup.sh`, `ops/tracker-restore-verify.sh`, `ops/__tests__/tracker-backup.test.ts`.
- [x] Records: `ops/tracker-cutover.md`, `ops/estate.md`, `ops/literal-conformance.md`, `AGENTS.md`,
  `README.md`, `apps/tracker/README.md`, `deferred-work.md`.

**Acceptance Criteria:**

- Given AD-20, when the merge is performed, then filter-repo ran on a scratch clone and `git log --follow`
  lists a file's source commits from `apps/tracker/`.
- Given the live subdomain, when the cutover is planned, then the runbook keeps `tracker.cuatro.dev` serving
  throughout, requested across the cutover, references `ops/routing-inventory.md`, and files its gaps
  against Story 1.7.
- Given AD-3, when the deploy unit is defined, then the image is the sha-tagged
  `ghcr.io/luigiespinosa/tracker` and the Registry still declares `tracker.cuatro.dev`.
- Given the Operator's data, when the cutover is planned, then backup and verified restore precede it in
  the runbook, both scripts are exercised here against a real Postgres, and migrations run as
  `tracker-migrate` before a rollout, never on boot.
- Given the Registry, when the merge completes, then `source` and `live` still resolve and
  `ops/registry-verification.mjs` passes.

## Implementation Notes

- The merge is its own commit, `ff2b7952d9423ac49edf3f371140fcbb1645fd8a`, subject only, parents `8eb98a4`
  (dev) and `8b4788e` (the filtered source). The filtered history keeps the source's blobs: 23 files
  were committed with CRLF there and stay so, the eleven migrations among them, since Prisma checksums a
  migration by its bytes. The Anchor's `.gitattributes` names `*.mjs`, so `eslint.config.mjs` and
  `postcss.config.mjs` renormalise to LF in the workspace commit, line endings only.
- The lockfile fold (`merge-lock.cjs` from Story 3-5 in scratch, then `pnpm install`) kept every tracker
  resolution its own lockfile named; `apps/hub` and `packages/tokens` importers are unchanged; the root
  and finance importers moved optional peers only (DW-270), plus the two peers added on purpose.
- The tracker's typecheck failed first with TS2339 on every `toBeInTheDocument`: `jest-dom/vitest`
  augmented the root's Vitest 4, not the tracker's Vitest 3. A `vitest` peer in `packageExtensions`
  fixed it, DW-272's shape, closed beside it.
- 26 of the tracker's 1,211 cases run BullMQ against a real Redis, as its own CI did, so `ci.yml`'s
  `test` job gains a Redis service. Nothing else there reads it.
- Dropping `postinstall` means `prisma generate` runs in `build`, `typecheck`, `test` and `dev` instead
  (the last two added at review, so a fresh install still tests and runs).
- `pnpm install --filter tracker` over the pruned root still installed the root importer, so the deps
  stage installs everything and the image is 2.32 GB (DW-277). Next's 0.4 GB build cache is dropped.
- Compose interpolates the whole file whichever service runs, so every tracker command on the box sets
  `HUB_TAG` too; the runbook says so. Compose checks an external network only for a service joining it
  (observed with a probe project), so the Hub's commands never need `cuatro-tracker_default`.
- `ops/__tests__/turborepo.test.ts`'s prune case now prunes four workspaces and passed Vitest's 5 s
  default on this host, so it carries a 60 s budget of its own; no assertion changed.
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_SENTRY_DSN` are build-time values the old compose
  passed at runtime, where they do nothing, and the box's `.env` sets neither, so the image is built
  without them, matching what serves today.

## Spec Change Log

## Review Triage Log

No subagents in this run: every layer ran inline in the builder's session, over the diff since the merge
commit (88 kB, the lockfile and `_bmad-output/` excluded), the merge itself checked by its own proof.
Blind Hunter floor: kB 86, sqrt 9.3 plus 1, floor 10. One pass, no loopback.

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | Blind Hunter | Dropping `postinstall` leaves `pnpm --filter tracker test` and `dev` on a fresh install with no generated client, where the source repository always had one | low: real for a developer on a fresh install; CI was safe only because the typecheck step ran first | patch: `test` and `dev` run `prisma generate` first |
| 2 | Blind Hunter | `pnpm-workspace.yaml` says no Hub job depends on Prisma's download host, but the tracker's Prisma 6 `generate` fetches its query engine there in CI's `test` job | medium: a false statement in the config a later reader trusts when CI fails on that host | patch: the comment says where the fetch happens |
| 3 | Blind Hunter | `docker-compose.yml`'s header says every service is named `anchor-*` and why; `tracker` now joins the shared network under another name | low: the rationale no longer covers the file | patch: a paragraph naming why `tracker` and `cuatro-app` are safe |
| 4 | Blind Hunter | Both per-app image workflows push a new sha tag of a private package on every push, and a 2.32 GB image may exhaust GHCR's included private storage | maybe-false, medium if true: whether GHCR bills private storage on this plan is unread | defer: DW-278, unverified, with what settles it |
| 5 | Blind Hunter | The runbook's step 1 said "six containers, `migrate` excepted", which is five | low: a wrong count in a check the Operator runs | patch |
| 6 | Blind Hunter | The runbook started the tracker services without `--profile tracker`, which the rehearsal used | low: the unrehearsed form may behave the same, but the record should give what was observed | patch |
| 7 | Blind Hunter | The worker has no healthcheck, so a crash-looping worker is silent | false as a regression: the old worker had none either (`ops/routing-inventory.md`), and the image workflow requires `worker.ready` before any push | rejected |
| 8 | Blind Hunter | Stopping the old server could reset a request in flight to it | low: the rehearsal's 1,160 requests across the stop and the rollback all answered 200, and a guard would be a drain step the old project lacks | rejected |
| 9 | Blind Hunter | `tracker-restore-verify.sh`'s summary printed `migrations=0` on an early failure, a different shape from success | low: cosmetic | patch: `not-reached`, as every other field |
| 10 | Blind Hunter | The tracker image, workflow and runbook duplicate `image-finance.yml`'s shape rather than a reusable workflow | false as waste: the steps differ (provision against `anchor-db` versus stores and a worker), and publishing reusable workflows is Epic 6's by `epics.md` | rejected |
| 11 | Edge Case | `tracker-restore-verify.sh` leaves its container if killed by SIGKILL, which no trap sees | low: not met in use; the name carries the pid and `docker ps -a` shows it | rejected |
| 12 | Edge Case | The counts are read after the dump, not in its snapshot, so a write in between fails the verification | false as a defect: the script says so and fails loudly, and the runbook stops the worker first; observed failing on a row written after the dump | rejected |
| 13 | Edge Case, claims | "Rollback is starting the old containers again": holds only while no migration ran | false: the restore-verify requires `0-pending` before step 5, and the merged code carries none (`5d49da7..985e3c5` changes one e2e spec) | rejected |
| 14 | Verification Gap | The I/O row "Hub deploy with only `HUB_TAG` set" and "missing tracker network" are held by observed commands, not by a suite | false as a gap: CI runs no compose command, and a suite that shelled out to Docker would not run on the unit gate's runner the same way; both were observed here (Verification) | rejected |
| 15 | Verification Gap | The worker's command path in compose is held against the Dockerfile only as text | false: `image-tracker.yml` runs that exact command and requires `worker.ready` before it pushes, observed here | rejected |
| 16 | Ponytail | `ops/tracker-backup.sh`'s summary line and traps are more than a one-off dump needs | false as waste: the runbook's go or no-go reads that line, and the traps remove a half-written dump of the Operator's data | rejected |
| 17 | ECC verification loop | Build (`corepack pnpm --filter hub build`), types and the full suite pass; lint N/A (no lint command, `AGENTS.md`); no secret in the diff (the workflow's placeholders guard a runner-local database) | no defect | none |
| 18 | Design Review | No `.scss` or `.tsx` outside tests changed and no motion keyword was added; two `.mjs` files changed line endings only | No UI surface in this diff. Design review skipped. | none |
| 19 | Edge Case, claims | Decision 12 and the matrix say the verification requires every migration applied; the script as first written reported a missing one and exited 0 | medium: a direct deviation from the frozen spec, which the runbook papered over by reading the summary | patch: a missing migration now fails, named, and the case asserts exit 1 and the container removed |

## Design Notes

**Oversized, kept.** The draft measured about 2,516 tokens (10,063 characters over four; 1,262 words)
against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the orchestrating workflow on 2026-09-29
as the Operator's instruction of 2026-09-28 to finish Epic 3 unattended with the stories as written, the
answer the unattended Epic 2 run used on 2026-09-23 and Stories 3.1 to 3.5 used since. The multi-goal
check found one goal: history, workspace, image and the cutover's instruments are one merge of a live
application, and each criterion is a facet of it.

**Resumed after an interruption.** This run was relaunched after a network outage. The tree was clean at
`8eb98a4` and no Story 3.6 work existed, in the tree or in scratch, so it started from the beginning.

**Open Questions, answered from the sources.** Fourteen, answered as Decisions 1 to 14 from `epics.md`
Story 3.6 and Epic 4 (Stories 4.4, 4.5 and 4.8 own one Postgres, the offsite path and the tracker's move
to the rebuilt topology), AD-3, AD-6, AD-7, AD-8, AD-9, AD-10, AD-14, AD-20 and AD-23,
`ops/routing-inventory.md`, `ops/estate.md`, `ops/capacity-gate.yml`, Story 3-5 and DW-258, DW-260,
DW-270 and DW-272, per the orchestrator's standing instruction. Each is reversible before the cutover
and is an Operator item.

**Checkpoint 1.** No human present: the builder reviewed the spec as a second reader against the READY
FOR DEVELOPMENT standard and the story text, found it actionable, and approved it.

**Why the data does not move now (Decision 3).** Moving `tracker` into `anchor-db` at the cutover would
put a dump, a restore and a write freeze on the critical path of the one live merge, with divergent
writes possible while old and new overlap; Story 4.4 moves every consumer onto one Postgres anyway, so
the tracker would move twice. Keeping the stores in place makes the cutover a container swap over
shared data, which `docker-rollout`'s own overlap already assumes, and makes rollback lossless.

**Why container names.** The new `tracker` joins two networks. `postgres` and `redis` are service names
another project could also carry on the shared network, the collision `docker-compose.yml`'s header
records for `app` and `db`; `cuatro-tracker-postgres-1`, `-redis-1` and `-qbittorrent-1` are unique on
the box.

## Verification

**Commands** (observed 2026-09-29 on this host, the tree at the story's final state):

- `corepack pnpm install --frozen-lockfile`: "Already up to date", exit 0.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: "Test Files  69 passed (69)", "Tests  1730 passed (1730)", exit 0. Two
  earlier full runs each failed two or three WSL-spawning cases and nothing else (`deploy-remote`,
  `library-backup`, and once a `tracker-backup` case at 30,137 ms, DW-135's signature); the next run
  passed whole, as `AGENTS.md` says to expect.
- `corepack pnpm --filter hub build`: exit 0, from a clean `.next`.
- `corepack pnpm --filter tracker typecheck`: "Generated Prisma Client (v6.19.2)", then `tsc` clean,
  exit 0. `corepack pnpm --filter tracker test` beside `redis:7-alpine` on `localhost:6379`:
  "Test Files  105 passed (105)", "Tests  1211 passed (1211)"; without it, 26 BullMQ cases fail on
  `ECONNREFUSED ...:6379`, which is why CI's `test` job carries the service.
- `corepack pnpm --filter finance typecheck`: exit 0 (DW-272's `zod` now resolved by peer);
  `corepack pnpm --filter finance test`: "Tests  70 passed (70)".
- `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs` ("16 applications, valid"),
  `node ops/literal-conformance.mjs` ("25 stylesheets, 21 outside the permitted set and 4 inside it"):
  exit 0. actionlint 1.7.7 (`rhysd/actionlint:1.7.7`) over `.github/workflows`: exit 0.
- `node ops/registry-verification.mjs` with a token from the local `gh` login, never printed: exit 0,
  "PASS  cuatro-tracker source resolves: https://github.com/LuigiEspinosa/cuatro-tracker answered 200
  anonymously" and "PASS  cuatro-tracker live: https://tracker.cuatro.dev answered 307".
- `docker build --file apps/tracker/Dockerfile .`: exit 0, 2.32 GB. The workflow's own `run:` steps,
  executed here in order against that image: throwaway Postgres and Redis, `migrate deploy` ("All
  migrations have been successfully applied."), `/api/ready` `{"status":"ok","db":"ok","redis":"ok"}`,
  and the worker's `"event":"worker.ready"`, each exit 0. With Redis stopped, `/api/ready` answered 503
  and the compose probe run inside the container exited 1; `/api/health` still 200. The server runs as
  `uid=1000(node)`.
- `docker build` of `apps/hub/Dockerfile` (with the two Umami arguments) and of `apps/finance/Dockerfile`
  against the new lockfile: exit 0 both; the Hub image answered `/api/health` 200 and `/` 200.
- `HUB_TAG=x docker compose config --services`: `anchor-app anchor-db anchor-umami`, exit 0; with
  `--profile migrate`: `... finance-migrate tracker-migrate`. A probe project showed compose refusing a
  missing external network only for the service that joins it ("network nonexistent-xyz declared as
  external, but could not be found" for that one, exit 0 for the other).

**Manual checks:**

- `git log --follow --format=%s -- apps/tracker/lib/env.ts` prints the same seven subjects, in order,
  as `git log --format=%s -- lib/env.ts` in the source clone.
- The backup against a real Postgres 16 holding the eleven migrations and two rows:
  `tracker-backup file=... dump=ok list=ok tables=9 rows=13 bytes=22270 sha256=7fd3ce76... exit=0`, then
  `tracker-restore-verify sha256=match restore=ok tables=9 rows=13 migrations=11-applied-0-pending exit=0`;
  after one more row was written live and the counts file said so, "User restored 1 rows, and the live
  database held 2 when the dump was taken", exit 1. No `tracker-restore-verify-*` container remained
  after either run. Rerun with the final scripts (after review made a missing migration fatal, as
  Decision 12 says) against a fresh Postgres migrated by the final image: `tracker-backup ... tables=9
  rows=12 bytes=22218 ... exit=0` and `tracker-restore-verify sha256=match restore=ok tables=9 rows=12
  migrations=11-applied-0-pending exit=0`, no container left.
- The cutover rehearsed through the real `docker-compose.yml` behind a `caddy:2` proxying `cuatro-app:3000`,
  with requests one at a time 100 ms apart: `tracker-migrate` "No pending migrations to apply.",
  `tracker` healthy, the worker ready, the stand-in old server stopped, then the rollback. 1,160
  requests, 1,160 answered 200 (`ops/tracker-cutover.md` § Rehearsed off the box says what this does
  not prove).
- `https://tracker.cuatro.dev/api/health` answered 200 and `/` 307 from this host before any of it.
