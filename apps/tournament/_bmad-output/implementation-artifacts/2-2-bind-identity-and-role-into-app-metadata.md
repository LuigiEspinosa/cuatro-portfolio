---
baseline_commit: 3b0f161455f85440cad75f117b62afc5813b7ae1
---

# Story 2.2: Bind identity and role into app_metadata

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want SteamID64 and role written only into `app_metadata` via the Admin API,
So that RLS can trust identity and role from the JWT and a client cannot self-escalate.

## Acceptance Criteria

**Primary ACs (verbatim from epics.md#Story-2.2, lines 346–361) — these are the contract:**

1. **(AC1 — binding rule, AD-12)** _Given_ the binding rule (AD-12), _When_ a verified player's identity and role are persisted, _Then_ `{ steamid64, role }` is written to Supabase `app_metadata` through the Admin API (service-role) only, _And_ nothing identity- or role-bearing is written to client-mutable `user_metadata`.

2. **(AC2 — role bootstrap, FR-4)** _Given_ role bootstrap, _When_ a player's SteamID64 is on the env-listed admin allowlist, _Then_ their role resolves to `admin`; otherwise it defaults to `viewer` (FR-4).

3. **(AC3 — session mint / JWT resolves)** _Given_ the binding completes, _When_ a Supabase session is minted, _Then_ the JWT carries role and SteamID64 in `app_metadata` and `is_admin()`/`jwt_steamid64()` resolve correctly.

**Derived ACs (implementation-level; required for a working, testable, secure slice — do not skip):**

4. **(AC4 — role written BEFORE the session mint)** Role is resolved and written into `app_metadata` **before** the `generateLink → verifyOtp` session mint in `establishSession()`, so the **very first** admin login's JWT already carries `role: 'admin'` (no second login/refresh required). [Ordering fact from `session.ts`: `ensureAuthUser` runs before `generateLink`.]

5. **(AC5 — existing users are backfilled, not skipped)** Because `createUser` sets `app_metadata` **only at creation**, every already-existing auth user (all Story 2.1-era logins — incl. Cuatro's live-QA user `76561198388441171`, which has `steamid64` but no `role`) is updated via `admin.auth.admin.updateUserById(...)` on the "already exists" path, writing **both** `{ steamid64, role }` so the existing `steamid64` claim is never clobbered. (This also closes 2.1's deferred "re-assert steamid64 on already-exists" gap.)

6. **(AC6 — `app_role` is the authoritative store; allowlist only bootstraps)** Role resolution reads the `app_role` table first (authoritative). If a row exists, its `role` wins (so a future Story 2.4 revoke is durable and re-login does not re-promote). If no row exists, bootstrap: `admin` iff the SteamID64 is on the allowlist, else `viewer`, and INSERT the `app_role` row (`granted_by = NULL` for a system/login-time bootstrap, `granted_at = now()`). The resolved role is then mirrored into `app_metadata` (AD-12: "role lives in `app_role` … mirrored to `app_metadata`"). **Confirmed by Cuatro (2026-07-02): write BOTH stores.**

7. **(AC7 — secrets server-only, no migration, fail-closed)** The allowlist env var is **server-only** (no `NEXT_PUBLIC_`; added to `assertNoLeakedSecrets()`), read on the Node runtime. Role resolution **defaults to `viewer`** on any ambiguity (empty/unset allowlist, malformed entry). **No migration** — `app_role`, its `service_role` DML grant, and `is_admin()`/`jwt_steamid64()` all already exist (0001/0002); `supabase/` stays untouched (pgTAP 120/120 unaffected).

8. **(AC8 — tests, injectable)** Automated tests cover: (a) allowlist parsing (comma-separated, trims whitespace, ignores blanks / non-17-digit entries); (b) `resolveRole` → `admin` for an allowlisted id, `viewer` otherwise, and **existing `app_role` row respected** (a row with `role='viewer'` stays viewer even if the id is on the allowlist — revoke durability); (c) the `app_metadata` claim written on both the create and the update/backfill path is exactly `{ steamid64, role }`. The Admin API / `app_role` read+write are **injectable/mockable** so tests never hit live Supabase.

## Tasks / Subtasks

- [ ] **Task 1 — Admin allowlist env var (AC2, AC7)**
  - [ ] Add server-only `ADMIN_STEAMIDS` to `.env.example` (names-only, per the Story 1.1 discipline) — documented as a comma-separated list of 17-digit SteamID64s.
  - [ ] Add a lazy getter `adminSteamIds()` to `lib/env.ts` (mirror the `steamApiKey`/`authNonceSecret` pattern; return `process.env.ADMIN_STEAMIDS ?? ''` so an unset var → empty allowlist → everyone `viewer`, fail-closed — do NOT `required()` it).
  - [ ] Add `NEXT_PUBLIC_ADMIN_STEAMIDS` to the `FORBIDDEN_PUBLIC_MIRRORS` list in `lib/env.ts` so a leaked client mirror fails the build.
  - [ ] Set the real value in gitignored `.env.local` for QA (include Cuatro's `76561198388441171` so the live QA can prove the `admin` path).

- [ ] **Task 2 — Pure allowlist + role resolution module `lib/auth/roles.ts` (AC2, AC6, AC7, AC8)** — `import 'server-only'` at top.
  - [ ] `parseAdminAllowlist(raw: string): Set<string>` — split on `,`, trim, drop blanks, keep only entries matching `^[0-9]{17}$` (defensive; a malformed entry must not throw). Pure, unit-tested.
  - [ ] `resolveRole(admin: SupabaseClient, steamid64: string, allowlist: Set<string>): Promise<'admin' | 'viewer'>` — (1) `select role from app_role where steamid64 = $1` via the service-role client; (2) if a row exists → return its `role` (authoritative; respects future 2.4 revokes); (3) if no row → `role = allowlist.has(steamid64) ? 'admin' : 'viewer'`, INSERT `app_role { steamid64, role, granted_by: null }` (service-role; `granted_at` defaults), return `role`. Default `'viewer'` on any read error is acceptable ONLY if it also does not silently grant admin — prefer to throw on a hard DB error so the callback's `failClosed()` catches it (no session on an indeterminate role).
  - [ ] Keep the `app_role` read/write behind the injected `admin` client so tests mock it (no live Supabase).

- [ ] **Task 3 — Extend `lib/auth/session.ts` to bind role (AC1, AC3, AC4, AC5)**
  - [ ] Change `ensureAuthUser(admin, steamid64)` → `ensureAuthUser(admin, steamid64, role)`. On the **create** branch set `app_metadata: { steamid64, role }` (both keys).
  - [ ] Add the **already-exists backfill branch**: when `isAlreadyExists(error)` is true, resolve the user id and call `admin.auth.admin.updateUserById(id, { app_metadata: { steamid64, role } })`. Pass **both** keys (the Admin API replaces `app_metadata`, it does not deep-merge — never clobber `steamid64`).
  - [ ] **Getting the existing user's id (the gotcha):** `getUserById` needs an id you don't have, and there's no clean `getUserByEmail` in `@supabase/supabase-js@2.110.0`. Cleanest path: **`generateLink({ type: 'magiclink', email })` already returns the full user object** (`data.user.id`) alongside `data.properties.hashed_token`. So the robust ordering for existing users is: `generateLink` (get `user.id` + token) → `updateUserById(user.id, { app_metadata: { steamid64, role } })` → **then** `verifyOtp(token_hash)` — the JWT is minted at `verifyOtp` from the user's **then-current** `app_metadata`, so role lands in the first JWT. Verify this minting behavior during live QA (version-sensitive, like 2.1's `verifyOtp` type). For a brand-new user, `createUser` already returns the id and the role is set at creation. (Alternative if `generateLink` ordering proves awkward: paginate `admin.auth.admin.listUsers()` and match `steamEmail(steamid64)` — fine for a small private roster.)
  - [ ] In `establishSession(admin, ssr, steamid64)`: resolve role via `resolveRole(admin, steamid64, parseAdminAllowlist(env.adminSteamIds()))` and pass it into `ensureAuthUser` — **before** `generateLink → verifyOtp`, so the minted JWT carries role on first login (AC4).
  - [ ] **Do NOT touch** `verifyOtp({ type: 'email' })` — it is the live-QA-confirmed value against `@supabase/supabase-js@2.110.0` + `@supabase/ssr@0.12.0` (2.1). Do NOT flip to `'magiclink'`.

- [ ] **Task 4 — Never write role to `user_metadata` (AC1)**
  - [ ] Confirm (and unit-assert where feasible) that role is written ONLY through `app_metadata` via the Admin API; `user_metadata` is never touched. `is_admin()`/`jwt_steamid64()` read `app_metadata` exclusively.

- [ ] **Task 5 — Tests (AC8)** with Vitest.
  - [ ] `lib/auth/roles.test.ts`: allowlist parse (comma/space/blank/non-17-digit); `resolveRole` admin vs viewer vs existing-row-respected (mock the `admin` client's `.from('app_role').select/insert`).
  - [ ] Extend `lib/auth/login-flow.test.ts` / add `session` coverage: the `app_metadata` object handed to `createUser` (create path) and `updateUserById` (backfill path) equals `{ steamid64, role }`; a non-allowlisted id yields `role: 'viewer'`.
  - [ ] Keep `npm test` green (was 30/30 after the 2.1 review) and `next build` clean.

- [ ] **Task 6 — Live QA (AC3) — the sign-off gate, mirrors 2.1**
  - [ ] With `ADMIN_STEAMIDS` containing `76561198388441171`, log in as Cuatro → confirm `auth.users.raw_app_meta_data` = `{ …, "steamid64":"76561198388441171", "role":"admin" }` and an `app_role` row `(76561198388441171, 'admin', null, …)`.
  - [ ] Confirm `is_admin()` resolves: run (as the authenticated user, or via a temporary RPC) `select public.is_admin()` → `true` for the admin; a non-allowlisted login → `role: 'viewer'`, `is_admin()` → `false`.
  - [ ] Confirm the **backfill** path: Cuatro's user already exists from 2.1 (had `steamid64`, no `role`) → after this login it carries `role` AND still `steamid64` (not clobbered).

## Dev Notes

### 🎯 Scope Boundary — 2.2 is role BINDING, not enforcement (read first)

The epics split identity/role across four stories. Stay inside 2.2:

| Concern | Story | 2.2 action |
|---|---|---|
| Write `{ steamid64, role }` to `app_metadata` via Admin API; resolve admin/viewer from the env allowlist; prove `is_admin()`/`jwt_steamid64()` resolve | **2.2** | ✅ build |
| Steam OpenID verify + `player` upsert + `app_metadata.steamid64` + session mint | **2.1** | ✅ DONE — do not re-do |
| Display-name **rename tolerance** (stats never detach on a Steam rename) | **2.3** | ❌ do not build |
| Role **enforcement** (server-gate mutations on `is_admin()`), **revoke-invalidates-session**, the **`granted_by` admin-only / no-self-grant invariant** | **2.4** | ❌ do not build |
| `roster_entry` table + registration window | **2.5** | ❌ do not build (no migration in 2.2) |

**2.2 populates and mirrors role and proves the JWT resolves. Acting on the role — gating admin routes, revoking, invalidating sessions — is entirely Story 2.4.** [Source: epics.md#Story-2.2, #Story-2.4; FR Coverage Map lines 137/140 — FR-4 split 2.2(binding)↔2.4(enforcement).]

### ⭐ Central design decision — write `app_role` table too, or `app_metadata` only?

This is the one genuine judgment call in 2.2. The three ACs only literally require the **`app_metadata`** write + allowlist + `is_admin()` proof — they do not name the `app_role` table. But **AD-12** says: _"Role lives in an `app_role` table with no client write policy and **is mirrored to `app_metadata`**."_ And `app_role` carries `granted_by`/`granted_at` provenance and an admin-read RLS policy that only make sense if rows exist.

**DECISION — CONFIRMED by Cuatro (2026-07-02): write BOTH stores, read `app_role` first.** `app_role` is the durable source of truth; `app_metadata.role` is the JWT mirror `is_admin()` reads. Resolution reads `app_role` first so a future 2.4 revoke (which sets `app_role.role='viewer'`) is durable and re-login won't re-promote an allowlisted-but-revoked admin. The allowlist only *bootstraps* the row when none exists. `granted_by = NULL` for a login-time system bootstrap (the `granted_by` admin-only/no-self-grant **invariant** is 2.4's route concern, not this login path — [[deferred-work]] re-homed it to 2.4).

_(The leaner `app_metadata`-only alternative — let 2.4's grant/revoke route be the sole `app_role` writer — was considered and declined: it diverges from AD-12's "mirrored" wording and defers revoke-durability entirely to 2.4.)_

### 🔑 The exact code seam (do not reinvent — extend `lib/auth/session.ts`)

2.1 already built the whole session-mint path. 2.2 is a surgical extension of it — there is **no** existing role/allowlist/`is_admin`-caller code anywhere (verified), so nothing to refactor away; the only thing to preserve is the existing `steamid64` claim.

Current seam ([lib/auth/session.ts](lib/auth/session.ts)):
```ts
export async function ensureAuthUser(admin: SupabaseClient, steamid64: string): Promise<void> {
  const email = steamEmail(steamid64);
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { steamid64 }, // identity claim ONLY — role is Story 2.2   ← extend to { steamid64, role }
  });
  if (error && !isAlreadyExists(error)) {
    throw new Error(`ensureAuthUser failed: ${error.message}`);
  }
  // ← 2.2 ADDS an else/already-exists branch: updateUserById(id, { app_metadata: { steamid64, role } })
}
```
Call order in `establishSession` is `ensureAuthUser` **then** `generateLink → verifyOtp`. Writing role inside `ensureAuthUser` (both branches) puts it in `app_metadata` **before** the mint → first admin login's JWT already has `role` (AC4).

**⚠️ Admin API replaces `app_metadata`; it does not deep-merge.** On the `updateUserById` backfill you MUST pass `{ steamid64, role }` (both keys) or you will wipe the existing `steamid64` claim.

### The RLS→JWT contract 2.2 must satisfy (already-built substrate — do NOT modify)

From `supabase/migrations/0002_rls.sql`, verbatim — **no migration; these already exist:**
```sql
create function public.is_admin() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)   -- fail-closed
$$;
create function public.jwt_steamid64() returns text language sql stable set search_path = '' as $$
  select auth.jwt() -> 'app_metadata' ->> 'steamid64'
$$;
```
Target claim shape: `app_metadata: { "steamid64": "<17 digits>", "role": "admin"|"viewer" }`. `is_admin()` returns true ONLY for the literal string `'admin'`. `service_role` holds `select, insert, update, delete` on `app_role` (0002 lines 77–79) and BYPASSRLS, so the `app_role` write needs **no new grant/policy/migration**.

`app_role` DDL (0001, the write target — already exists):
```sql
create table app_role (
  steamid64   text primary key references player(steamid64) on delete cascade,
  role        text not null check (role in ('admin','viewer')),   -- closed set; 23514 on violation
  granted_by  text references player(steamid64) on delete set null,
  granted_at  timestamptz not null default now()
);
```
The `steamid64` FK requires the `player` row first — 2.1's upsert already creates it earlier in the same login, so ordering is satisfied.

### ES256 / JWKS — clarification (NO custom JWT work in 2.2)

Retro action item #2 says "bind identity/role using the ES256+JWKS scheme (not legacy HS256)." **This is NOT a build task in 2.2.** Identity→principal rides **Supabase Auth ("Option A")**: the app never signs or verifies a JWT itself. Supabase mints the session JWT (the project is configured for asymmetric **ES256** signing per Story 1.1; verify via JWKS at `$SUPABASE_URL/auth/v1/.well-known/jwks.json`, no shared secret). 2.2 only sets the `role` claim through the **Admin API into `app_metadata`** exactly as 2.1 set `steamid64`; Supabase re-signs. **Do not** introduce `SUPABASE_JWT_SECRET` (HS256) verification, a custom JWT library, or any JWKS-fetch code — there is nothing to build here. [Source: 2.1 Dev Notes Tech Stack; ARCHITECTURE-SPINE.md#AD-12 is algorithm-agnostic — `is_admin()` reads `auth.jwt()` regardless of signing.]

### No `audit_log` write in 2.2

AD-17 mandates an `audit_log` row for the admin **grant_role action** (the 2.4 grant/revoke route), NOT for the login-time env-allowlist bootstrap. 2.2 writes **no** `audit_log` row. [Source: ARCHITECTURE-SPINE.md#AD-17; audit belongs to 2.4's route.]

### Security requirements (non-negotiable)

- **`app_metadata` via Admin API ONLY, never `user_metadata`** (client-mutable → self-escalation hole). `is_admin()`/`jwt_steamid64()` read `app_metadata` exclusively (AD-12).
- **Fail-closed default = `viewer`.** Unset/empty/malformed allowlist ⇒ `viewer`. Never default to `admin`; never leave `role` unset on a path that gates admin capability. On a hard DB error resolving role, fail the login closed (no session) rather than mint a session with an indeterminate role.
- **`ADMIN_STEAMIDS` is a server-only secret (AD-25):** no `NEXT_PUBLIC_`; add its mirror to `assertNoLeakedSecrets()`; Node runtime only. [Source: ARCHITECTURE-SPINE.md#AD-25.]

### Previous-story intelligence (Story 2.1 — done, live-QA'd)

- 2.1 scaffolded the app and built the session mint; `establishSession → ensureAuthUser` sets `app_metadata.steamid64` ONLY (comment: `// identity claim ONLY — role is Story 2.2`). 2.2 extends exactly this.
- 2.1's live QA (2026-07-02) confirmed `verifyOtp({ type: 'email' })` works vs `@supabase/supabase-js@2.110.0` + `@supabase/ssr@0.12.0` — **keep it**.
- 2.1 review deferred (now relevant to 2.2): `ensureAuthUser` doesn't re-assert `steamid64` on the already-exists path, and `isAlreadyExists` treats any `status===422` as "already exists" (over-broad). **2.2's `updateUserById` backfill branch is the natural place to fix the re-assert gap** (it rewrites both claims). If the backfill keys off `isAlreadyExists`, tighten the 422 match while you're here (prefer `code === 'email_exists'`). [Source: 2-1 story Review Findings.]
- Precedents 2.2 must follow: `import 'server-only'` on infra modules; single `getAdminClient()` service-role writer; lazy env getters + `assertNoLeakedSecrets()`; `runtime='nodejs'` on Admin-API routes; injectable effects for Vitest.

### Git intelligence

Recent commits: `3b0f161` (2.1 sign-off), `42f497e` (2.1 review patches — HPP fix + fail-closed callback), `ba8a881` (2.1 dev-story). The auth spine (`lib/auth/*`, `lib/supabase/admin.ts`, `lib/env.ts`, `app/auth/steam/callback/route.ts`) is the surface 2.2 touches. No DB migration since 0003; **2.2 adds none** (next migration `0004_` is earmarked for Story 2.5 `roster_entry`).

### Project Structure Notes

- **New:** `lib/auth/roles.ts` (+ `lib/auth/roles.test.ts`) — pure allowlist parse + `resolveRole`.
- **Modified:** `lib/auth/session.ts` (`ensureAuthUser` gains `role` + backfill branch; `establishSession` resolves role first), `lib/env.ts` (+`adminSteamIds()` getter + forbidden-mirror), `.env.example` (+`ADMIN_STEAMIDS` names-only). Possibly `lib/auth/login-flow.test.ts` for coverage.
- **Untouched:** `supabase/` (no migration), `app/auth/steam/*` routes (the callback already calls `establishSession(admin, ssr, steamid64)` — its signature is unchanged; role is resolved inside).
- Identifiers/code/comments English; DB `snake_case`; any user-facing copy Spanish.

### References

- [Source: epics.md#Story-2.2 (lines 340–361)] — user story + ACs (verbatim), `_Traces: FR-1, FR-4 · AD-12_`
- [Source: epics.md lines 31, 34] — FR-1 (Steam login → SteamID64), FR-4 (Roles Admin vs Viewer; event-mutating actions admin-only)
- [Source: epics.md#Story-2.4 (lines 381–398)] — the 2.2/2.4 boundary (enforcement + revoke + granted_by invariant = 2.4)
- [Source: SOLUTION-DESIGN.md#5 (lines 304–318)] — identity/auth flow; step 3 (look up `app_role`, default `viewer`, bootstrap admins from env allowlist), step 4 (write `{ steamid64, role }` to `app_metadata` via Admin API)
- [Source: SOLUTION-DESIGN.md#4 (lines 271–277)] — `is_admin()`/`jwt_steamid64()` bodies
- [Source: ARCHITECTURE-SPINE.md#AD-12 (lines 135–138)] — role in `app_role` mirrored to `app_metadata`; Admin-API only; `is_admin()` fail-closed
- [Source: ARCHITECTURE-SPINE.md#AD-25] — secrets server-only, never `NEXT_PUBLIC_*`
- [Source: ARCHITECTURE-SPINE.md#AD-17] — audit row for the admin grant_role *action* (2.4), not the login bootstrap
- [Source: supabase/migrations/0001_core_schema.sql:45-50] — `app_role` DDL (verified)
- [Source: supabase/migrations/0002_rls.sql:19-31,55,77-79] — `is_admin()`/`jwt_steamid64()` + `app_role_admin_read` + `service_role` DML grant (verified)
- [Source: lib/auth/session.ts] — the `ensureAuthUser`/`establishSession` seam 2.2 extends (verified)
- [Source: .env.example] — reserved var names; no allowlist var exists yet (2.2 adds `ADMIN_STEAMIDS`)
- [Source: 2-1-steam-openid-2-0-server-side-login.md] — 2.1 scope boundary (role→2.2), live-QA confirmation, deferred backfill/422 items

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
