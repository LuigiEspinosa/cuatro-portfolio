# The demo principal

The one definition of Demo Access's principal (AD-13, FR-25, FR-26): who it is, how each participating
application derives it, the ownership scope its rows live in, and what no application lets anyone do to
it. It is the artifact Story 5.8 delivers. Story 5.9 adds § The reset, the one definition of `demo:reset`
and the baseline fixture per application. Story 5.10 adds § The scheduler, the one host-level job that runs
those resets. Story 5.11 (the Registry's `demo` values verified) builds on all three and does not restate them.

This file is a record, not Registry data. Every value is marked as a decision or an observation (NFR-9).
Times are UTC.

**Written 2026-10-03, committed on `dev`. Nothing here is live.** The code is on each repository's working
branch and demo access is off in every application until the Operator turns it on (§ Pending Operator
actions). No account named `demo@cuatro.dev` exists anywhere yet, the issuer included, and no Registry
entry changes in this story: every `demo` value stays as `ops/registry-inputs.md` § `demo` records it
until Story 5.11 verifies the change against a working account. Story 5.9's resets, committed the same day
(`cs-tracker` on `dev`, `digital-library` on `story-5-8-demo-principal`), have run against scratch stores
only, never against the estate (DR1 to DR3).

## Contents

1. [The contract](#the-contract)
2. [Who participates](#who-participates)
3. [Each participant](#each-participant)
4. [The reset](#the-reset)
5. [The scheduler](#the-scheduler)
6. [What Stories 5.9 to 5.11 build on](#what-stories-59-to-511-build-on)
7. [By hand](#by-hand)
8. [Demo principal run](#demo-principal-run)
9. [Pending Operator actions](#pending-operator-actions)

## The contract

Decisions, each held in every participant by its own suite (§ Each participant).

1. **The principal is `demo@cuatro.dev`**, in every participating application, written once per stack as
   that stack's constant and never chosen by the stack. `ops/__tests__/demo-principal.test.ts` holds the
   one in this repository equal to this record; `cs-tracker` and `digital-library` are separate repositories
   (AD-2), so their own suites pin the same literal and cannot see this file.
2. **It is derived, never invented.** An application that signs in through the estate's issuer derives the
   principal from the issuer: it is the subject the issuer assigns to the account `demo@cuatro.dev`, which
   the Operator reads once that account exists and supplies as a variable, exactly as the Owner's subject was
   supplied in Story 5.4. So the code needs no value from the issuer until then. An application with
   accounts of its own derives it from the address: the account whose email is `demo@cuatro.dev`, compared
   trimmed and lowercased.
3. **Every demo row is owned by it, in a scope of its own.** Each application has exactly one demo
   ownership scope, and every row the demo principal can create, read or change lives inside it. No row the
   Operator's identity owns is ever inside it, and no demo row is ever outside it. Deleting by owner (Story
   5.9) is emptying that scope.
4. **No one reaches across the boundary**, the Operator's identity included. A request resolves to one
   scope, from its principal, before it reads anything; a demo principal whose scope is unavailable is
   refused, never served from the Operator's scope.
5. **The Operator's side effects are withheld from it.** Anything that acts on the Operator's own
   accounts or scope (a sync from his Steam account, a job the worker runs against his store, an admin
   surface) is refused to the demo principal.
6. **It cannot be deleted, and its credentials cannot be changed, from inside the application.** No route,
   action or code path in a participant deletes it, makes it an administrator, or writes its password or
   address. Its credentials change only where the Operator holds them: at the issuer, or in the
   application's store by hand.
7. **Off is today.** Each application turns demo access on with its own variable or account (§ Each
   participant). With it off, every principal other than the demo address is served exactly as before, and
   the demo address owns nothing and cannot sign in.

## Who participates

Decided from the sources, not assumed. FR-25 binds "every application with Status `Live` that requires
authentication"; AD-12 and FR-24 exempt `MaiCoin` structurally (`identity: wallet`); `ops/registry-inputs.md`
§ `demo` lists the deployed entries a login gates as `cuatro-tracker`, `cs-tracker`, `digital-library` and
`cs-tournament`, and the `open` ones as usable with no authentication. Registry 1.7.0, read 2026-10-03:

| Registry id | `status`, `demo` | Participates | Why |
|---|---|---|---|
| `cuatro-tracker` (`apps/tracker`) | `Live`, `none` | **yes** | Every route but sign-in sits behind `next-auth` (`middleware.ts`) |
| `cs-tracker` | `Live`, `none` | **yes** | Every route sits behind the Owner allowlist; it signs in through the issuer since Story 5.4 |
| `digital-library` | `Live`, `none` | **yes** | Every library route sits behind its own sign-in |
| `cs-tournament` (`apps/tournament`) | `Live`, `none` | no, pending ruling DP8 | Its whole web surface, `app/(viewer)`, is public and reads anonymously. Two things sign in: the `app/api/admin/*` commands, the Operator's console as Umami's is; and a player, who signs in with Steam (`app/auth/steam/*`, the footer link on `app/(viewer)/page.tsx`) only to enroll their own SteamID64 in the open tournament (`POST /api/roster/enroll` behind `requireUser`). Viewing requires no authentication, and the one Visitor sign-in proves a Steam account, which `demo@cuatro.dev` cannot be, and writes a real roster entry. So FR-25 does not reach it, and its `demo: none` reads as inaccurate (DW-332, for Story 5.11). **Corrected 2026-10-03 by Story 5.11:** Registry 1.8.0 reads `open`, on the host's anonymous answers (`ops/registry-verification.md` § The correction); DP8 still decides participation |
| `cuatro-portfolio` (`apps/hub`) | `Live`, `open` | no | It signs in since Story 5.3, but gates nothing and owns no row |
| `list-wheel`, `covidmap`, `future-vizion` | `Live`, `open` | no | No authentication |
| `maicoin` | `In progress`, `not-deployed` | no, structurally | `identity: wallet`: no user record for an issuer to own (AD-12) |
| `cuatro-finance` and the other `In progress` or `Archived` entries | `not-deployed` | no | Nothing is deployed for a Visitor to reach (FR-25 binds `Live`) |

Three participants, three stacks: Next.js with Prisma and `next-auth`, Elixir with Ecto and the issuer, and
Fastify with SQLite.

## Each participant

The same shape in each: one module holding the address and recognising it; one function that resolves a
principal to its scope and refuses the demo principal rather than fall back; the gates calling it before any
read; the Operator's side effects withheld; and a suite case for each clause of § The contract.

### `cuatro-tracker` (`apps/tracker`, this repository, `dev`)

- **Principal:** `lib/demo-principal.ts` (`DEMO_PRINCIPAL`, `isDemoPrincipal`, imports nothing, so
  `middleware.ts` reads it). Derived from the address: an account in the tracker's own `User` table.
- **Scope:** the Postgres schema `demo` in the tracker's own database `cuatro_tracker`, same role (AD-10),
  through a second Prisma client whose URL is `DATABASE_URL` with `schema=demo` and `connection_limit=1`
  (`lib/demo-store.ts`, `storeFor`). The demo principal's own `User` row lives there too, so the Operator's
  store holds no demo identity. Every migration applies to it unchanged: none qualifies a name with
  `public`.
- **Gates:** `lib/scoped-db.ts` (`scopedDb`) answers the signed-in principal's store, and every request path
  reads through it; `lib/__tests__/demo-principal.test.ts` fails any module that imports the Operator's
  store directly, except the store itself, sign-in (whose lookups go through `storeFor`), `/api/ready`, the
  worker and its jobs, and the admin surfaces. Sign-in looks each address up in its own store only
  (`lib/auth.ts`).
- **Withheld:** `/admin` and `/api/admin/*` answer 404 to the demo principal (`middleware.ts`, and
  `app/admin/layout.tsx` behind it): import, merge and the similarity scan enqueue jobs the worker runs
  against the Operator's store.
- **Undeletable, unchangeable:** no application code writes a `User`, `Account`, `Session` or
  `VerificationToken` (a case scans `app/`, `lib/`, `components/` and `worker.ts`), and sign-in is
  credentials only with JWT sessions, so no provider creates or links a user.
- **Switch:** `DEMO_ENABLED=true` (`lib/env.ts`), mapped from `TRACKER_DEMO_ENABLED` in
  `docker-compose.yml`, empty by default. Off, the demo address cannot sign in and owns nothing.

### `cs-tracker` (its repository, branch `dev`, commits `8109599`, `e782b4c` and `5927991`)

- **Principal:** `lib/cs_tracker/demo_principal.ex`. Derived from the issuer: `CS_TRACKER_OIDC_DEMO_SUB`, the
  subject the issuer assigns to `demo@cuatro.dev`, read as the Owner's was (CT2 in `ops/identity-issuer.md`).
  It counts only with OIDC configured and only when it is not the Owner's subject, so the Owner can never be
  the demo principal. `CsTracker.Auth.OIDC.admitted?/1` admits it beside the Owner at the callback, the
  session route and both gates.
- **Scope:** the Postgres schema `demo` in `cs-tracker`'s own database, same role (AD-10): a second instance
  of `CsTracker.Repo`, `CsTracker.DemoRepo`, started only while demo access is on, whose connections search
  `demo,public`. `CsTracker.Release.migrate_demo/0` creates the schema and runs every migration through such
  a connection, so each migration's unqualified names, raw SQL included, land in `demo`; the `pg_trgm`
  operator class still resolves from `public`. The test helper runs it before every suite.
- **Gates:** the HTTP plug and the LiveView `on_mount` put the principal's repo on the process
  (`DemoPrincipal.put_repo/1`); the endpoint puts the Owner's back at the start of every request, because
  Bandit serves a connection's requests in one process.
- **Withheld:** the manual Steam sync (`InventoryLive`, "Sync is not available in the demo.") and, on an
  item view, the Recently-Viewed push and the on-view price refresh, which both act on the Owner's scope.
  The Recently-Viewed list is one in-memory cache with no scope, the Owner's alone, so the dashboard's
  Recently-Viewed strip reads none of it for the demo principal (`DashboardLive.recent_items/1`, `5927991`, held by
  a case in `test/cs_tracker/demo_principal_test.exs`, fix round 1).
- **Shown, accepted:** the dashboard's status line and `InventoryLive`'s sync button show the demo principal
  the Owner's sync metadata: the last sync time and cooldown (`Inventory.cooldown_status/0`, read from
  Oban's `public.oban_jobs`, see § What Stories 5.9 to 5.11 build on) and the Steam breaker state
  (`Inventory.breaker_status/0`, one rate limiter in the application's memory, keyed by nothing). Accepted
  as job metadata, not an owned row: neither names an item, a mark, a wishlist entry or a price, the
  demo principal can start no sync, and the breaker describes Steam's limit on the box, which binds both
  principals alike. A later story that wants the demo to read "Never synced" scopes `cooldown_status/0`
  by principal.
- **Undeletable, unchangeable:** `cs-tracker` holds no account: the principal is a subject at the issuer
  named by configuration. A case holds that no Ecto schema has an identity or credential field and that the
  only `DELETE` route is the sign-out.
- **Switch:** `CS_TRACKER_OIDC_DEMO_SUB`, unset by default (`config/runtime.exs`, `docs/deployment.md`).

### `digital-library` (its repository, branch `story-5-8-demo-principal` off `dev`, commit `4d7bea0`)

The Operator's own checkout holds uncommitted edits on `dev`, so the work sits on a branch of its own in the
worktree `digital-library-workspace/digital-library-5-8`, based on `origin/dev` at `162f14a`, for the
Operator to merge into `dev` (DP7).

- **Principal:** `apps/api/src/acl.ts` (`DEMO_PRINCIPAL`, `isDemoPrincipal`). Derived from the address: the
  account in `users` whose email is `demo@cuatro.dev`.
- **Scope:** the libraries the demo principal holds in `user_libraries`. A library enters the scope only when
  granted to the demo principal while no one else holds it or has reading progress in it, and no one else is
  ever granted one in it (`grantAccess` throws `ScopeError`, the admin route answers 409). The demo
  principal's grant is never revoked (`revokeAccess` throws, 409), so a demo library leaves the scope only by
  being deleted, never still holding what the demo principal wrote. Books and reading progress belong to
  their library's scope.
- **Gates:** `hasAccess` refuses anyone across the boundary before the admin bypass, so the Operator's
  administrator reaches no demo library and the demo principal no other; the admin's library list and
  allowed ids leave the demo scope out; an admin's book delete in it answers 404.
- **Undeletable, unchangeable:** `UserRepository.delete` throws for it and the admin route answers 403;
  `UserRepository.create` refuses it as an administrator, the first-run seed included, and the admin route
  answers 400; no source runs `UPDATE users`.
- **Switch:** the account itself. Without a `demo@cuatro.dev` account every path is as before, held by a case.

## The reset

`demo:reset`, defined once here (AD-13, FR-26, Story 5.9) and implemented in each participant to this
definition. Decisions, each held in every participant by its own suite against a real store: Postgres for
the two Postgres stacks, a SQLite file and real directories for `digital-library`.

1. **It deletes by owner, which is emptying the scope.** Every row in the participant's demo scope, and in
   `digital-library` every file those rows name (uploads and covers), is deleted. The scope is addressed by
   an explicit key and never by a search path: the demo store (`cuatro-tracker`), names qualified `demo.`
   or carrying the `demo` prefix (`cs-tracker`, so a missing demo table fails rather than resolving to
   `public`), the fixture library's id (`digital-library`).
2. **It never touches anything else.** Not one Operator row or file, which a suite case per stack proves by
   seeding the Operator's rows beside the demo's, under the same ids where the stack allows it, and comparing
   them before and after. Not the principal's own account: its row and password are kept as they are
   (`cuatro-tracker` and `digital-library`; `cs-tracker` has none), and so are its sessions in
   `digital-library`. `cuatro-tracker`'s sessions are stateless JWTs (`lib/auth.ts`, strategy `jwt`, sign-in
   by credentials only), so its reset empties the adapter's `Account`, `Session` and `VerificationToken`
   tables with the rest of the scope and no signed-in Visitor is signed out by it. Not a row a migration writes
   (`cs-tracker`'s `schema_migrations` and `steam_rate_limit_state`). And it never migrates: the scope's
   schema is migrated as a discrete step before a rollout (AD-23, DP5 and DP6), and a reset against an
   unmigrated scope fails.
3. **A fixture is a file committed in the application's own repository** that states every row the scope
   holds after a reset other than the principal's own, with fixed ids and fixed times, so two resets leave
   identical rows. Every table of the scope is classified by a suite case as reset or structural, so a table
   a later migration adds fails that case until it is placed: `cuatro-tracker` against `Prisma.ModelName`,
   `cs-tracker` against `information_schema` for schema `demo`, and `digital-library` against
   `sqlite_master`, where each table classified reset must reach `libraries` by `ON DELETE CASCADE`
   (`users` and `sessions` are the principal's, the `books_fts` tables structural). Where ids come from a sequence, the fixture's
   sit where the Operator's never reach and the reset moves each sequence just past them (`cs-tracker`, § 8).
4. **It is one transaction.** A fault applies nothing; `digital-library` writes its files after the rows
   commit, so a fault there leaves rows whose files the next reset rewrites.
5. **It is idempotent**: a second reset leaves the scope identical, row for row and byte for byte, sequences
   included, and equal to the fixture. Proven by each stack's suite running it twice and comparing.
6. **Off or absent, it does nothing.** With demo access off, or no demo principal, it reports `skipped`,
   exits 0 and reads nothing from the Operator's scope and writes nothing anywhere. `cuatro-tracker`'s off
   is `DEMO_ENABLED` unset, and its absent is no `demo@cuatro.dev` row in schema `demo`; `cs-tracker`'s off
   and absent are one state, `CS_TRACKER_OIDC_DEMO_SUB` unset or equal to the Owner's; `digital-library`'s
   is no `demo@cuatro.dev` account.
7. **It runs from the host**, as `docker compose run --rm --no-deps <service> <command>` in the
   application's compose project: a one-shot container from the serving image with the serving container's
   environment and volumes, which exits when the reset does. Nothing runs inside a serving container and no
   timer stays alive in one, so Story 5.10's host scheduler calls exactly these commands:

   | Participant | Directory on the box | Command |
   |---|---|---|
   | `cuatro-tracker` | `/home/deploy/cuatro-portfolio` | `docker compose --env-file .env.production --profile tracker run --rm --no-deps tracker node node_modules/tsx/dist/cli.mjs scripts/demo-reset.ts` |
   | `cs-tracker` | `/home/deploy/cs-tracker` | `docker compose run --rm --no-deps app /app/bin/cs_tracker eval 'CsTracker.Release.demo_reset()'` |
   | `digital-library` | `/home/deploy/digital-library` (its box-only `docker-compose.override.yml` merges in, as it does for the serving `api`) | `docker compose run --rm --no-deps api node apps/api/dist/demo-reset.js` |

   The tracker's command needs `HUB_TAG` and `TRACKER_TAG` exported first, as every compose command against
   `docker-compose.yml` does (AGENTS.md, DW-310).
8. **Exit codes and output.** Exactly one line. On stdout and exit 0: `demo:reset <registry-id> reset
   rows=<n>` (the fixture rows written) or `demo:reset <registry-id> skipped: <reason>`. On stderr and exit
   1: `demo:reset <registry-id> failed: <reason>`, having applied nothing, where the reason is the error's
   class and driver code or the reset's own refusal, never a driver message, which can quote a row. No line
   names a credential.

Per participant:

- **`cuatro-tracker`**: `apps/tracker/lib/demo-reset.ts`, `scripts/demo-reset.ts`, fixture
  `apps/tracker/prisma/demo-fixture.json` (six media items, six entries); suite
  `lib/__tests__/demo-reset.test.ts`, whose Postgres cases run in CI's `test` job against a Postgres
  service and fail there rather than skip. It builds the demo client from `lib/demo-scope.ts` and never loads
  the Operator's store, whose module starts a Redis client. The principal's `User` row is never created by
  the reset: DP6 creates it, and until then the reset answers `skipped`.
- **`cs-tracker`**: `CsTracker.DemoReset`, `CsTracker.Release.demo_reset/0`, fixture
  `priv/demo/fixture.json` (four items, their prices, two ownership marks, two wishlist entries); suite
  `test/cs_tracker/demo_reset_test.exs`. **Item ids:** the demo schema's sequences start where the Owner's
  do, and `prices:item:<id>` and `inventory:updates` carry ids to every view whatever its scope, so the
  fixture's items take ids from 900000001 and the reset moves each demo sequence past its fixture rows. It
  reads the Owner's largest item id, and refuses (exit 1) once it reaches 900000000, where the two ranges
  would meet. The Owner's catalog is tens of thousands of items.
- **`digital-library`**: `apps/api/src/demo-reset.ts`, fixture `apps/api/src/demo-fixture.ts` (one library,
  three public-domain books as one-page PDFs built byte for byte from the committed text, since the image
  ships `dist` alone); suite `src/__tests__/demo-reset.test.ts`. **The reset creates the scope's library**,
  `demo-library`, and grants it to the demo principal, so DP7 creates no library by hand. A library an
  administrator granted the demo principal can hold the Operator's books (a grant needs only that no one else
  holds it or has read in it), so the reset refuses (exit 1, nothing applied) while the scope holds any
  library but `demo-library`, and while `demo-library` exists outside the scope. **The admin's container
  routes are accepted administration**, the Story 5.8 verifier's minor finding: `GET`, `PATCH` and `DELETE
  /api/admin/libraries/:id` and `GET .../users` reach a demo library's row (name, description, holders) and
  delete it, never its books, files or reading (`hasAccess`), and deleting is the only way a library leaves
  the scope, which is the way out of the refusal above (a suite case). A rename lasts until the next reset.
  **Uploads (DW-333):** the reset removes every upload and its cover with the library's rows. Whether the
  demo principal may upload at all is ruling DR4.

## The scheduler

The one host-level job that runs § The reset (AD-13, FR-26, Story 5.10). Decisions, each held by
`ops/__tests__/demo-reset.test.ts` unless marked otherwise. **Nothing here is installed on the box**: the
install is DS1 to DS3, by hand, after each participant's demo access is on.

| File | Role |
|---|---|
| `ops/demo-reset.sh` | The scheduler. Runs the due participants one after another under a lock, then one summary line |
| `ops/demo-reset.schedule` | Each participant's interval in minutes, or `off`. Committed: `60` for all three |
| `ops/demo-reset.cron` | The one cron line, installed byte for byte as `/etc/cron.d/cuatro-demo-reset` |

1. **On the host, outside every application container.** cron on the box runs the scheduler, which runs
   each participant's command from § The reset item 7, word for word, in that participant's directory: a
   one-shot container that exits when its reset does. No application keeps a timer, so a CPU-bound box pays
   for a reset only while one runs. For the tracker it reads `HUB_TAG` and `TRACKER_TAG` from the serving
   `anchor-app` and `tracker` containers' images (`docker ps`, the form `ops/tracker-cutover.md` uses), so
   the one-shot runs the image the tracker serves; while a rollout holds two containers of a service it takes
   the newest, the first line `docker ps` lists, so the tag is the incoming image; with either not running, the tracker fails and the
   others still run. A case compares the commands the scheduler runs with this record's table.
2. **Hourly by default, per participant.** The cron line fires every 15 minutes. A participant is due on a
   tick whose minute since the epoch, rounded down to 15, is a multiple of its interval: `60` runs at minute
   0 of every hour (UTC), `120` at every even hour, `1440` at 00:00. The phase needs no state file, and a
   tick missed while the box was down is not made up: the next one due runs. The interval is a multiple of
   15 from 15 to 1440. **Decision, 2026-10-03:** every participant hourly, which AD-13 names. A Visitor's
   changes then last until the next full hour at most, so a second Visitor the same day finds the fixture
   unless they arrive within that hour; a shorter interval narrows the window at a cost § What a run costs
   gives. Minute 0 is clear of the nightly jobs at 03:15 and 03:45.
3. **One participant at a time, and each one's failure is its own.** A participant that exits non-zero, or
   outlives its timeout (240 s, then killed 10 s later), is named in the summary's `failed=` and the run
   exits 1; every other due participant still runs. Three that each hang still end inside one tick.
   Killing `docker compose run --rm` ends the client and leaves its container running (observed 2026-10-03,
   Docker Compose v5.5.1: exit 124, the one-off still `Up` 3 s later), which would keep the reset's
   connection and transaction past the lock. So on a timeout the scheduler removes the one-off containers of
   that participant's service (compose's `oneoff`, `service` and `project.working_dir` labels) that were not
   there before it ran, and no other.
4. **Never two runs at once.** `flock -n` on `/home/deploy/demo-reset/.demo-reset.lock`: a run that finds it
   held starts nothing and exits 1 with `lock=held`. The lock belongs to the open descriptor, so a run killed
   outright (a reboot, `kill -9`) releases it, and a lock file left behind never blocks the next run. A
   by-hand reset goes through the scheduler (`ops/demo-reset.sh <registry-id>`, which runs that participant
   now whatever its interval) so the lock covers it; a participant's command typed by hand does not take it.
5. **`off` costs nothing but its line.** A participant `off` in the schedule makes no `docker` call at all,
   and prints `demo:reset <registry-id> skipped: off in ops/demo-reset.schedule` on the hourly ticks only.
   A participant whose own demo access is off but whose schedule still names an interval costs one
   one-shot container, which prints the application's own `skipped` line (§ The reset item 6; its cost is
   in § What a run costs). So turning a participant's demo off is two changes: its switch, and `off` here.
6. **The schedule is committed, never typed on the box.** The box reads `ops/demo-reset.schedule` and runs
   `ops/demo-reset.sh` from its checkout at `/home/deploy/cuatro-portfolio`, which the deploy resets to `main`,
   so a merged change to either takes effect at the next deploy. A schedule that names an unknown id, leaves a
   participant out, names one twice, or gives an interval off the rule runs nothing and exits 1
   (`schedule=invalid`): a schedule nobody can read must not run half of itself.
7. **DW-318 does not repeat here.** cron runs the checkout's script, never an installed copy. The one copy
   the box holds, the cron file, is compared on every run with `ops/demo-reset.cron` (`cmp`); while they
   differ, or while it is absent, every run still resets and exits 1 naming it (`cron=differs`,
   `cron=absent`). A deploy that replaces the script while a run reads it is safe: git writes a new file, and
   the running bash keeps the one it opened (observed 2026-10-03 with `git reset --hard` under a running
   script: a new inode, and the run finished on the old text).
8. **DW-315 does repeat here, and is filed there.** Every run that did anything appends one line to
   `/home/deploy/demo-reset/demo-reset.log`, each participant's own line before it:
   `demo-reset ts=<UTC> tick=<HH:MM> lock=ok schedule=ok cron=match ran=3 off=0 failed=none exit=0`. A tick on
   which nothing is due writes nothing, so with the committed schedule a line lands every hour and an hour
   without one is a scheduler that stopped. `docker compose run` without a TTY also writes its own progress
   lines to stderr (`Container ... Creating`, `Created`, observed 2026-10-03 by the Story 5.10 verifier), and
   the cron line sends stderr to the log, so those lines sit beside each participant's one line; read a run
   by its `demo:reset` and `demo-reset` lines. Nothing reads the log yet: the same gap as the three backup
   logs, amended into DW-315 so its reader covers all four.
9. **One connection at a time.** Runs never overlap and participants run in turn, so at most one reset
   connection is open in the estate at any moment, and each role sees the one Story 5.9 counted (DP4,
   DW-331).
10. **Only tools the box runs.** Beside bash: `docker`, `flock`, `timeout`, `date`, `dirname`, `mkdir`,
    `cmp`, `tail` and `cut`. Each but `cmp` is run on the box every night by `ops/postgres-backup.sh` since
    2026-10-01 (`exit=0`, `ops/postgres-backup.md` § First scheduled run); `cmp` printed `installed` on the
    box in that record's install step 3; `date -u -d @<seconds>` is GNU coreutils, the box's Ubuntu 24.04.4.
    The suite runs every case with a PATH holding only these and the `docker` stub, so a tool the box lacks
    fails there. The cron file sets `PATH=/usr/bin:/bin`, and DS1 checks the four that are not coreutils
    resolve on it.

### What a run costs

**Observed 2026-10-03 on the authoring workstation, not on the box.** Each participant's real image, built
from the commits Story 5.9 left (`cuatro-portfolio` `dev` at `9d703bc` with `apps/tracker/Dockerfile`,
`cs-tracker` `dev` `dcd35ee`, `digital-library` `story-5-8-demo-principal` `6ae8df2` with
`apps/api/Dockerfile`), tagged `epic5-scratch-*`, ran its reset command as a one-shot `docker run --rm`
against scratch stores: `postgres:18.6-trixie` holding `cuatro_tracker` and `cs_tracker` migrated as DP5 and
DP6 migrate them (`public` and `demo`), the principal's `User` row in the tracker's, and a migrated SQLite
file holding the demo user in a volume. Docker Desktop 29.8.1, a WSL2 VM of 8 vCPU. CPU is the VM's whole
busy time from `/proc/stat` across the run (dockerd and containerd included), with 0.26 s per 10 s of idle
VM beside it. `docker compose`'s own parse of the compose file, which the box adds per participant, is not
in these figures.

| Run | Its line | Wall | VM CPU |
|---|---|---|---|
| `cuatro-tracker`, three runs | `reset rows=12` | 1.26 to 1.47 s | 1.35 to 1.66 s |
| `cs-tracker`, three runs | `reset rows=12` | 1.31 to 1.42 s | 2.11 to 2.28 s |
| `digital-library`, three runs | `reset rows=5` | 0.92 to 0.96 s | 0.89 to 0.96 s |
| **One full run, the three back to back, twice** | the three lines | **3.45 and 3.61 s** | **4.17 and 4.63 s** |
| `cuatro-tracker`, its own switch off | `skipped: demo access is off` | 1.48 s | 1.42 s |
| `cs-tracker`, its own switch off | `skipped: demo access is off` | 1.21 s | 1.54 s |

**Against the Capacity Gate (load15 0.60 on 2 vCPU, `ops/capacity-threshold.md`). Derived, not observed on
the box.** An hourly run is about 4.6 CPU-seconds an hour, 0.13% of one core averaged over the hour. load15
is an exponential average the kernel updates every 5 s with a weight of 1 - e^(-5/900), about 0.0055 per
sample, so a burst of a few seconds adds to it once or twice: even if the box's cores were three times
slower than this workstation's, about 14 CPU-seconds keeping both of its cores busy for 7 s, two samples
at 2 runnable add about 0.02 to load15, decaying over the following quarter hour. The box's recorded
load15 ran 0.05 to 0.27 across the measurement week and read 0.26 to 0.30 during the backup install
(`ops/postgres-backup.md` § First run); a reset adds a few hundredths at most, under a tenth of the
headroom. The application's own `off` costs a container start, 1.4 to 1.5 CPU-seconds each, which is
why `off` in the schedule exists (item 5). DS3 reads the real figure after a run on the box.

**Connections, counted from Postgres's own log** (`log_connections`, `log_disconnections`) on the same
scratch instance: one tracker reset opened 1 connection to `cuatro_tracker`, one `cs-tracker` reset 1 to
`cs_tracker`, each closed before the run ended, and with each application's switch off each opened 0.
That is the one per running reset DP4 counts (DW-331), and item 9 keeps it to one in the estate at a time.

Every scratch container, network and volume was removed by the harness's exit trap, and the three
`epic5-scratch-*` images afterwards.

## What Stories 5.9 to 5.11 build on

- **Delete by owner** is emptying the scope: every table in schema `demo` (`cuatro-tracker`, `cs-tracker`),
  and every demo-scope library with its books, files and reading progress (`digital-library`). Built by Story
  5.9, § The reset.
- **The principal survives its reset**: in `cuatro-tracker` and `digital-library` the account is a row the
  reset keeps with the Operator's credentials; in `cs-tracker` it is not a row at all.
- **The baseline fixture** lands in the scope: `cs-tracker`'s demo catalog is empty until its fixture seeds
  one, since the `demo` schema holds its own `items` and prices and the Owner's daily catalog and price
  workers write only `public`. The id overlap this section recorded for Story 5.9 is closed by § The reset,
  `cs-tracker`. Oban's table stays in `public` (its migration runs at Oban's default prefix, observed after
  `migrate_demo` on the suite's database), so the demo's sync-button state reads the Owner's sync jobs'
  times; the sync itself is withheld.
- **The scheduler** runs each application's reset from the host, outside its containers (AD-13, Story 5.10),
  by the commands in § The reset, item 7: § The scheduler.
- **The Registry** moves an entry to `demo-account` only once its account works (Story 5.11, FR-27). The scheduled
  Registry verification holds that: a `demo-account` entry needs its DR row here dated and its own sign-in page
  naming `demo@cuatro.dev`, and the release that moves the three participants is written, unapplied, in
  `ops/registry-verification.md` § The release the live steps unlock (its actions 8 and 9).

## By hand

In order, after `ops/identity-issuer.md` actions 1 to 7 (the issuer exists) for the `cs-tracker` steps. From
the workstation in Git Bash, and on the box from a file under `set -euo pipefail` (AGENTS.md), never piped
into `ssh`. No step prints a credential.

1. **DP1. Answer whether `demo@cuatro.dev` needs a real mailbox.** The issuer may send a verification code to
   the address when the account is created, and `cuatro.dev` has no mail service recorded in this repository.
   Options: (a) a forwarding address at the domain's registrar or Cloudflare Email Routing to the Operator's
   inbox (a DNS change: MX and SPF records); (b) create the account from the issuer's dashboard as its
   administrator, if the dashboard creates a user without a verification step; (c) a mailbox with a provider (a
   new account and, at most providers, a cost against NFR-4). **Recommendation: (b), with (a) only if the
   dashboard asks for a code**, since (b) needs no DNS change and no new account. Whether the dashboard asks
   was not observed by this story, which had no account. Write the answer here.
2. **DP2. Decide the demo credentials.** One password for the issuer account and the two local accounts,
   distinct from every Operator credential, kept in the gitignored `.env` as `DEMO_PASSWORD` until each
   application publishes it on its own sign-in surface (FR-25: obtainable from the application's own sign-in
   surface). **Amended 2026-10-03 by Story 5.11:** no participant's sign-in page names the account yet, and
   building that in three repositories is DW-335's; Story 5.11's verification refuses `demo-account` until it does.
   Decide too whether the issuer's sign-up stays closed, so no one else can claim the address.
3. **DP3. Create `demo@cuatro.dev` at the issuer** with that password, and read its subject: sign in to the
   Hub as it and open `https://cuatro.dev/auth/session` (after `ops/identity-issuer.md` H3). Write the subject
   into the local `.env` as `CS_TRACKER_OIDC_DEMO_SUB`; it is Operator data, never committed.
4. **DP4. Rule on the connection budget** (`ops/postgres.md` § The budget). With demo on, each server
   container adds connections its role's limit was not sized for: the tracker's demo client holds at most 1
   (opened on the first demo request; the worker never opens it), so two servers across a rollout add 2 to a
   budget sized exactly at the limit, 20; `cs-tracker`'s `DemoRepo` holds 2 from boot, so two containers add
   4 to a role whose limit, 25, was sized for two containers at `POOL_SIZE=10` plus the migrator. Options:
   (a) raise the limits to 22 and 29 with `ALTER ROLE` and `ALTER DATABASE` on the box, and the budget table
   and `ops/postgres/10-consumers.sh` in the same change (DW-331); (b) lower `POOL_SIZE` to 8 in
   `cs-tracker`'s env file and set the tracker's `connection_limit` to 3, keeping both limits. **Recommendation:
   (a)**, since the four limits then sum to 86, under the 97 the budget allows, and nothing that serves today
   loses a connection. Story 5.9 adds one each while a reset runs: its one-shot container opens one
   connection (the tracker's demo client at `connection_limit=1`, `cs-tracker`'s `with_repo` at `pool_size:
   1`), and none while demo access is off. So (a) becomes 23 and 30, summing to 88.
5. **DP5. Turn `cs-tracker`'s demo on**, after DP3, DP4 and `cs-tracker`'s `dev` reaching `main`
   (`ops/identity-issuer.md` CT3's rollout): on the box in `/home/deploy/cs-tracker`, run the release's demo
   migration with the `migrate` service's image, `docker compose --profile migrate run --rm migrate
   ./cs_tracker eval 'CsTracker.Release.migrate_demo()'` from the release's `bin` directory (as `bin/migrate`
   runs `CsTracker.Release.migrate`; check the image's working directory first), then add `CS_TRACKER_OIDC_DEMO_SUB` to
   its `.env` without printing it, and roll the app. Check: signed in as the demo account,
   `https://cs-tracker.cuatro.dev/auth/session` answers 200 with its subject, `/inventory` lists nothing of the
   Owner's, and the Owner's own session still shows his inventory.
6. **DP6. Turn the tracker's demo on**, after DP2 and DP4: migrate the schema with the tracker's image,
   `docker compose --env-file .env.production --profile migrate run --rm -e DATABASE_URL="$demo_url"
   tracker-migrate`, where `demo_url` is the tracker's `DATABASE_URL` with `&schema=demo` appended (built on
   the box from `.env.production` without printing it); create the account in the demo schema with
   `docker compose --env-file .env.production --profile tracker run --rm -e DEMO_ENABLED=true -e
   DEMO_PASSWORD tracker node -e "..."` hashing `DEMO_PASSWORD` with `bcryptjs` and inserting through the
   demo store (the reset never creates it, § The reset); then set `TRACKER_DEMO_ENABLED=true` in
   `.env.production` and roll the tracker. Check: the demo account signs in and sees an empty library, the
   Owner's sees his, and `/admin` answers 404 to the demo account. Then DR1 fills the library.
7. **DP7. Bring `digital-library`'s branch into its `dev`, then `main`**, the repository it deploys from (the
   box builds it, DW-308), after reading its CI on the branch and after ruling DR4. Then, in its admin, create
   the user `demo@cuatro.dev` (not an administrator) with the DP2 password, and nothing else: the reset
   creates the demo library and grants it (Story 5.9, § The reset), and grant the demo user no library by
   hand, which makes the reset refuse. Then DR3. Check: signed in as the demo user, `/api/libraries` lists
   `Demo library` alone; as yourself, it is absent from your list.
8. **DP8. Rule on `cs-tournament`.** Options: (a) not a participant: its Visitor surface is public, so its
   Registry `demo` becomes `open` in Story 5.11 (DW-332; **done 2026-10-03 on observation, Registry 1.8.0,
   so (a) changes nothing further**); (b) a participant: a demo administrator scoped to
   demo seasons, which needs an owner on `season` and every admin command and RLS policy scoped by it, its
   migrations applied to Supabase by hand (DW-291). The surface to rule on: viewing needs no sign-in; a player
   signs in with Steam (`app/auth/steam/*`, linked from the Viewer's footer) only to enroll their own SteamID64
   through `POST /api/roster/enroll` (`requireUser`) while a tournament is open; the admin commands are the
   Operator's. **Recommendation: (a)**, because FR-25 binds an application that requires authentication of a
   Visitor to use it, and here a Visitor uses everything anonymously. The one Visitor sign-in proves a Steam
   account, which `demo@cuatro.dev` cannot be, and a demo enrollment would be a row in the live roster, not a
   demo scope.

9. **DR1. Run the tracker's reset live**, after DP6, from `/home/deploy/cuatro-portfolio` on the box with
   `HUB_TAG` and `TRACKER_TAG` exported to the serving values (`docker inspect` on the serving `tracker`
   container names its tag): the `cuatro-tracker` command in § The reset, twice. Check: each run prints
   `demo:reset cuatro-tracker reset rows=12` and exits 0; signed in as the demo account, the library shows the
   six fixture titles; a title added as the demo account is gone after the next run; the Owner's library is
   as it was (his item count before and after).
10. **DR2. Run `cs-tracker`'s reset live**, after DP5, from `/home/deploy/cs-tracker`: the `cs-tracker`
    command in § The reset, twice. Check: each run prints `demo:reset cs-tracker reset rows=12` and exits 0;
    signed in as the demo account, `/inventory` shows the two fixture marks and the wishlist its two entries;
    a mark added as the demo account is gone after the next run; the Owner's inventory is as it was.
11. **DR3. Run `digital-library`'s reset live**, after DP7, from `/home/deploy/digital-library`: the
    `digital-library` command in § The reset, twice. Check: each run prints `demo:reset digital-library
    reset rows=5` and exits 0; signed in as the demo user, `Demo library` lists the three fixture books and
    each opens; anything uploaded as the demo user is gone, file included (`ls data/books/demo-library`
    lists three PDFs), after the next run; your own libraries are as they were.
12. **DR4. Rule on the demo principal's uploads (DW-333).** Every Visitor shares the one account, so an
    upload is served to the next Visitor until the next reset, from `library.cuatro.dev`, a public write
    surface under a published credential. Options: (a) accept that window, which Story 5.10's schedule
    bounds (hourly by default), the reset removing each upload with its cover; (b) refuse uploads to the demo
    principal (`POST /api/libraries/:libraryId/books` answering 403 for it, one guard and a case in
    `digital-library`), the fixture's books carrying the demo; (c) keep uploads but bound them (size, format)
    and keep the window. **Recommendation: (b)**: the hourly window bounds how long a file is served, not
    what it is, and reading, search and progress, which are the application, all work on the fixture. (b) also
    closes DW-334, since a demo upload is what reaches the Operator's book through the duplicate check.
13. **DS1. Install the scheduler**, after DR1 to DR3 (each participant's demo on and its reset observed) and
    after `main` carries Story 5.10. On the box as `deploy`, from a file under `set -euo pipefail`:
    ```
    cd /home/deploy/cuatro-portfolio
    git log -1 --format=%H -- ops/demo-reset.sh
    env -i PATH=/usr/bin:/bin sh -c 'command -v docker flock timeout cmp'
    install -d -m 0700 /home/deploy/demo-reset
    sudo install -o root -g root -m 0644 ops/demo-reset.cron /etc/cron.d/cuatro-demo-reset
    cmp ops/demo-reset.cron /etc/cron.d/cuatro-demo-reset && echo installed
    ```
    The `git log` must print a commit (Story 5.10 is on `main`); `command -v` must print four paths; the last
    line must print `installed`. The cron file goes by `install` from the checkout, never typed. If the box's
    `docker` is not under `/usr/bin` or `/bin`, stop: the cron file's `PATH` is a change to commit first.
    Cron picks the file up within a minute, so the first scheduled run is the next full hour. To stop it:
    `sudo rm /etc/cron.d/cuatro-demo-reset`.
14. **DS2. One run by hand, in cron's shape**, at a minute that is not a multiple of 15, so the scheduled
    run does not meet it at the lock:
    ```
    uptime
    env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh /home/deploy/cuatro-portfolio/ops/demo-reset.sh cuatro-tracker cs-tracker digital-library; echo "exit=$?"
    uptime
    ```
    It must print `demo:reset cuatro-tracker reset rows=12`, `demo:reset cs-tracker reset rows=12`,
    `demo:reset digital-library reset rows=5`, then a summary ending `cron=match ran=3 off=0 failed=none
    exit=0`, and `exit=0`. Compose's own progress lines (`Container ... Creating`, `Created`) appear on
    stderr beside each participant's line, since the run has no TTY; they are expected and are not the
    participant's output. Record both `uptime` readings.
15. **DS3. Read the first unattended day**, the next day: `grep '^demo-reset ' /home/deploy/demo-reset/demo-reset.log`
    must show one line per hour since DS1, each ending `exit=0`; and `uptime` read at minute 1 of an hour,
    within the minute after a run, against the gate's load15 0.60. Write both here. A line with `exit=1`
    names its cause: `failed=<id>` (read that participant's line above it), `cron=differs` (repeat DS1's
    `install`), `lock=held` (a run outlived 15 minutes).

## Demo principal run

Each step above is written here with the UTC time and what was observed, never a credential.

**DP2, 2026-10-06, by the Operator.** The demo password is chosen, distinct from every Operator credential,
and kept in the local `.env` as `DEMO_PASSWORD` only. **Sign-up stays closed:** Clerk's Hobby plan names the
setting Access mode, with Waitlist (a public form for strangers), Invite-only, and Open (an allowlist is a Pro
feature); the Operator ruled **Invite-only**, so accounts exist only when the Operator creates or invites
them.

**DP1, 2026-10-06, answered (b): no mailbox is needed.** The Operator created `demo@cuatro.dev` from the
issuer's dashboard (Users, Create user) with that password, and its address shows **verified** with no mail
sent. The first sign-in as it was then refused a password-only entry: "You're signing in from a new device.
We're asking for verification to keep your account secure." That is Clerk's **Device Trust**, which "treats
every new device as untrusted until the user has verified their identity with a second factor"
(`https://clerk.com/docs/guides/secure/client-trust.md`, read 2026-10-06T06:19Z), an instance-wide switch
under Protect, Rules, with no per-user exception. Every Visitor arrives on a new device and cannot read the
demo mailbox, so Demo Access through the issuer was impossible with it on.

**Ruled 2026-10-06 by the Operator: Device Trust off** for the production instance, the Operator's account
included. Weighed: sign-up is invite-only and the instance holds two accounts; every application admits only
the Owner's subject or the demo principal; a stuffed Operator password would reach nothing but the Operator's
own sign-in, which a long unique password covers. Turned off by the Operator; the demo sign-in at
`https://cuatro.dev/auth/sign-in` then went through **without a code** (06:21Z). Alternatives not taken:
keeping it and dropping `cs-tracker`'s demo (which signs in through the issuer), or aliasing the mailbox, which
lets the Operator through but never a Visitor.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| DP1 | **Answer whether `demo@cuatro.dev` needs a real mailbox** | A question, not a decision this story made | 2026-10-06. Answered (b): created from the dashboard, verified without mail; no mailbox needed once Device Trust is off; § Demo principal run |
| DP2 | **Decide the demo credentials** and whether the issuer's sign-up stays closed | Kept in the gitignored `.env` | 2026-10-06. Password chosen, in the local `.env` only; sign-up closed as Access mode Invite-only; § Demo principal run |
| DP3 | **Create `demo@cuatro.dev` at the issuer** and record its subject as `CS_TRACKER_OIDC_DEMO_SUB` | After `ops/identity-issuer.md` actions 1 to 7 and H3 | _not done_ |
| DP4 | **Rule on the connection budget** with demo on | DW-331 | 2026-10-06T06:07:51Z. Ruled (a), with the reset's connection: `cuatro_tracker` 20 to 23 and `cs_tracker` 25 to 30, role and database, on the box (read before and after) and in `ops/postgres/init/10-consumers.sh` and `ops/postgres.md`; the four limits sum to 88 of 97. Set first to 22 and 29 at 06:06:54Z, the reset's connection overlooked, and corrected within a minute |
| DP5 | **Turn `cs-tracker`'s demo on** and check both scopes | After DP3, DP4 and CT3 | _not done_ |
| DP6 | **Turn the tracker's demo on** and check both scopes | After DP2, DP4 | _not done_ |
| DP7 | **Merge `digital-library`'s branch, deploy it, create the demo user** (Story 5.9: the reset creates its library) | After DP2 and DR4 | _not done_ |
| DP8 | **Rule on `cs-tournament`'s participation** | DW-332 | 2026-10-06. Ruled (a): not a participant; its Registry `demo` already reads `open` (1.8.0), so nothing further changes |
| DR1 | **Run the tracker's reset live, twice, and observe it** | After DP6 | _not done_ |
| DR2 | **Run `cs-tracker`'s reset live, twice, and observe it** | After DP5 | _not done_ |
| DR3 | **Run `digital-library`'s reset live, twice, and observe it** | After DP7 | _not done_ |
| DR4 | **Rule on the demo principal's uploads** | DW-333, DW-334; before DP7 creates the demo user | _not done_ |
| DS1 | **Install the scheduler's cron file** from the checkout | After DR1 to DR3 and Story 5.10 on `main` | _not done_ |
| DS2 | **Run the scheduler once by hand, in cron's shape, and observe it** | After DS1 | _not done_ |
| DS3 | **Read the first unattended day** of `demo-reset.log` and the load after a run | The day after DS1 | _not done_ |

Story 5.8 is done when DP1 to DP7 are dated and DP8 is ruled. Story 5.9 is done when DR1 to DR3 are dated
and DR4 is ruled. Story 5.10 is done when DS1 to DS3 are dated.
