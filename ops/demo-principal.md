# The demo principal

The one definition of Demo Access's principal (AD-13, FR-25, FR-26): who it is, how each participating
application derives it, the ownership scope its rows live in, and what no application lets anyone do to
it. It is the artifact Story 5.8 delivers. Story 5.9 adds § The reset, the one definition of `demo:reset`
and the baseline fixture per application. Story 5.10 (the host scheduler) and Story 5.11 (the Registry's
`demo` values verified) build on both and do not restate them.

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
5. [What Stories 5.9 to 5.11 build on](#what-stories-59-to-511-build-on)
6. [By hand](#by-hand)
7. [Demo principal run](#demo-principal-run)
8. [Pending Operator actions](#pending-operator-actions)

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
| `cs-tournament` (`apps/tournament`) | `Live`, `none` | no, pending ruling DP8 | Its whole web surface, `app/(viewer)`, is public and reads anonymously. Two things sign in: the `app/api/admin/*` commands, the Operator's console as Umami's is; and a player, who signs in with Steam (`app/auth/steam/*`, the footer link on `app/(viewer)/page.tsx`) only to enroll their own SteamID64 in the open tournament (`POST /api/roster/enroll` behind `requireUser`). Viewing requires no authentication, and the one Visitor sign-in proves a Steam account, which `demo@cuatro.dev` cannot be, and writes a real roster entry. So FR-25 does not reach it, and its `demo: none` reads as inaccurate (DW-332, for Story 5.11) |
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
  by the commands in § The reset, item 7.
- **The Registry** moves an entry to `demo-account` only once its account works (Story 5.11, FR-27).

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
   distinct from every Operator credential, kept in the gitignored `.env` as `DEMO_PASSWORD` until Story 5.11
   publishes it on each sign-in surface (FR-25: obtainable from the application's own sign-in surface).
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
   Registry `demo` becomes `open` in Story 5.11 (DW-332); (b) a participant: a demo administrator scoped to
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

## Demo principal run

_Not yet run._ Each step above is written here with the UTC time and what was observed, never a credential.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| DP1 | **Answer whether `demo@cuatro.dev` needs a real mailbox** | A question, not a decision this story made | _not done_ |
| DP2 | **Decide the demo credentials** and whether the issuer's sign-up stays closed | Kept in the gitignored `.env` | _not done_ |
| DP3 | **Create `demo@cuatro.dev` at the issuer** and record its subject as `CS_TRACKER_OIDC_DEMO_SUB` | After `ops/identity-issuer.md` actions 1 to 7 and H3 | _not done_ |
| DP4 | **Rule on the connection budget** with demo on | DW-331 | _not done_ |
| DP5 | **Turn `cs-tracker`'s demo on** and check both scopes | After DP3, DP4 and CT3 | _not done_ |
| DP6 | **Turn the tracker's demo on** and check both scopes | After DP2, DP4 | _not done_ |
| DP7 | **Merge `digital-library`'s branch, deploy it, create the demo user** (Story 5.9: the reset creates its library) | After DP2 and DR4 | _not done_ |
| DP8 | **Rule on `cs-tournament`'s participation** | DW-332 | _not done_ |
| DR1 | **Run the tracker's reset live, twice, and observe it** | After DP6 | _not done_ |
| DR2 | **Run `cs-tracker`'s reset live, twice, and observe it** | After DP5 | _not done_ |
| DR3 | **Run `digital-library`'s reset live, twice, and observe it** | After DP7 | _not done_ |
| DR4 | **Rule on the demo principal's uploads** | DW-333, DW-334; before DP7 creates the demo user | _not done_ |

Story 5.8 is done when DP1 to DP7 are dated and DP8 is ruled. Story 5.9 is done when DR1 to DR3 are dated
and DR4 is ruled.
