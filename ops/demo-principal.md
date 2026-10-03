# The demo principal

The one definition of Demo Access's principal (AD-13, FR-25, FR-26): who it is, how each participating
application derives it, the ownership scope its rows live in, and what no application lets anyone do to
it. It is the artifact Story 5.8 delivers. Story 5.9 (one `demo:reset` and baseline fixture per
application), Story 5.10 (the host scheduler) and Story 5.11 (the Registry's `demo` values verified) build
on it and do not restate it.

This file is a record, not Registry data. Every value is marked as a decision or an observation (NFR-9).
Times are UTC.

**Written 2026-10-03, committed on `dev`. Nothing here is live.** The code is on each repository's working
branch and demo access is off in every application until the Operator turns it on (§ Pending Operator
actions). No account named `demo@cuatro.dev` exists anywhere yet, the issuer included, and no Registry
entry changes in this story: every `demo` value stays as `ops/registry-inputs.md` § `demo` records it
until Story 5.11 verifies the change against a working account.

## Contents

1. [The contract](#the-contract)
2. [Who participates](#who-participates)
3. [Each participant](#each-participant)
4. [What Stories 5.9 to 5.11 build on](#what-stories-59-to-511-build-on)
5. [By hand](#by-hand)
6. [Demo principal run](#demo-principal-run)
7. [Pending Operator actions](#pending-operator-actions)

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
| `cs-tournament` (`apps/tournament`) | `Live`, `none` | no, pending ruling DP8 | Its whole web surface, `app/(viewer)`, is public and reads anonymously; only `app/api/admin/*` commands need a sign-in, and they are the Operator's console, as Umami's is. It does not require authentication of a Visitor, so FR-25 does not reach it, and its `demo: none` reads as inaccurate (DW-332, for Story 5.11) |
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

### `cs-tracker` (its repository, branch `dev`, commits `8109599` and `e782b4c`)

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

## What Stories 5.9 to 5.11 build on

- **Delete by owner** is emptying the scope: every table in schema `demo` (`cuatro-tracker`, `cs-tracker`),
  and every demo-scope library with its books, files and reading progress (`digital-library`).
- **The principal survives its reset**: in `cuatro-tracker` and `digital-library` the account is a row the
  reset must keep or recreate with the Operator's credentials; in `cs-tracker` it is not a row at all.
- **The baseline fixture** lands in the scope: `cs-tracker`'s demo catalog is empty until its fixture seeds
  one, since the `demo` schema holds its own `items` and prices and the Owner's daily catalog and price
  workers write only `public`. Its ids come from the `demo` schema's own sequences, so an item id can name
  an Owner item and a demo item at once; PubSub topics keyed by item id (`prices:item:<id>`) reach both
  scopes' views, which re-read their own scope. Seeding demo ids from a range the Owner's never reach keeps
  a pushed price from showing on the wrong item. Oban's table stays in `public` (its migration runs at
  Oban's default prefix, observed after `migrate_demo` on the suite's database), so the demo's sync-button state reads the Owner's sync jobs' times; the sync itself is withheld.
- **The scheduler** runs each application's reset from the host, outside its containers (AD-13, Story 5.10).
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
   loses a connection.
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
   demo store (or let Story 5.9's fixture create it); then set `TRACKER_DEMO_ENABLED=true` in
   `.env.production` and roll the tracker. Check: the demo account signs in and sees an empty library, the
   Owner's sees his, and `/admin` answers 404 to the demo account.
7. **DP7. Bring `digital-library`'s branch into its `dev`, then `main`**, the repository it deploys from (the
   box builds it, DW-308), after reading its CI on the branch. Then, in its admin, create the user
   `demo@cuatro.dev` (not an administrator) with the DP2 password, create a library, revoke your own grant on
   it (creating a library grants its creator), and grant it to the demo user. Check: signed in as the demo
   user, `/api/libraries` lists that library alone; as yourself, it is gone from your list.
8. **DP8. Rule on `cs-tournament`.** Options: (a) not a participant: its Visitor surface is public, so its
   Registry `demo` becomes `open` in Story 5.11 (DW-332); (b) a participant: a demo administrator scoped to
   demo seasons, which needs an owner on `season` and every admin command and RLS policy scoped by it, its
   migrations applied to Supabase by hand (DW-291). **Recommendation: (a)**, because FR-25 binds an application
   that requires authentication of a Visitor and this one requires none.

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
| DP7 | **Merge `digital-library`'s branch, deploy it, create the demo user and its library** | After DP2 | _not done_ |
| DP8 | **Rule on `cs-tournament`'s participation** | DW-332 | _not done_ |

Story 5.8 is done when DP1 to DP7 are dated and DP8 is ruled.
