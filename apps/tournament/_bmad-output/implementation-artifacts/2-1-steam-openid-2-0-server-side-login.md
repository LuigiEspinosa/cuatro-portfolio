---
baseline_commit: 3f6765253f5f199e7eda3fea5fb1b00401e9e095
---

# Story 2.1: Steam OpenID 2.0 server-side login

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to sign in with my Steam account,
so that the system knows who I am by my real Steam identity.

## Acceptance Criteria

**Primary ACs (verbatim from epics.md#Story-2.1, lines 323–338) — these are the contract:**

1. **(AC1 — server-side verification, AD-12)** _Given_ the server-side verification rule (AD-12), _When_ a player completes the Steam OpenID 2.0 flow and returns to `/auth/steam/callback`, _Then_ the server performs a `check_authentication` round-trip to Steam and **never trusts the redirect parameters**, _And_ only the verified `claimed_id` is converted to a SteamID64.

2. **(AC2 — identity resolution / player upsert, FR-1)** _Given_ a successful verification, _When_ identity is resolved, _Then_ the **service role** upserts a `player` row keyed by SteamID64 with `display_name` synced **cosmetically** from Steam.

3. **(AC3 — fail-closed on tamper, NFR-Security)** _Given_ verification fails or is tampered, _When_ the callback is processed, _Then_ **no session is minted and no `player`/role write occurs**.

**Derived ACs (implementation-level; required for a working, testable, secure slice — do not skip):**

4. **(AC4 — login initiation + CSRF)** `GET /auth/steam/login` redirects to Steam's OpenID 2.0 endpoint with `openid.realm` and `openid.return_to` bound to the configured domain. Because OpenID 2.0 has **no native `state`/nonce**, the route mints a per-request CSRF nonce, sets it as a **signed, `httpOnly`, `SameSite=Lax` cookie**, and the callback rejects any return whose nonce/`return_to`/`realm` do not match. (Closes the security gap the architecture implies but does not prescribe — see Dev Notes §Security.)

5. **(AC5 — authenticated session on success)** On successful verification **and** `player` upsert, a **Supabase session cookie** is minted (via `@supabase/ssr`) so the player is authenticated. `app_metadata.steamid64` (the identity claim) is set so `jwt_steamid64()` resolves. **Role binding, the admin allowlist bootstrap, and `app_metadata.role` are Story 2.2 — 2.1 must NOT write `role` or run the allowlist.** Redirect to Home (`/`) on success.

6. **(AC6 — secrets server-only)** Steam config and the Supabase service-role key are read **only** server-side (no `NEXT_PUBLIC_` prefix, never in a client bundle). Both `/auth/steam/*` handlers run on the **Node.js runtime**, not Edge.

7. **(AC7 — tests, fail-closed proven)** Automated tests cover: (a) a verified `claimed_id` → exactly-17-digit SteamID64 extraction; (b) a **tampered / `is_valid:false`** `check_authentication` response → fail-closed (no `player` write, no session); (c) nonce / `return_to` / `realm` mismatch → rejected. The Steam verification client is **injectable/mockable** so tests never hit the live Steam service.

## Tasks / Subtasks

- [x] **Task 0 — Acquire prerequisites (OWNER: Cuatro)** — LOCAL-DEV UNBLOCKED 2026-07-02; production realm still pending
  - [x] Steam Web API key registered (2026-07-02) and set in gitignored `.env.local` as `STEAM_API_KEY`. Note: the key's "Domain Name" field (`steam-key`) is a **cosmetic label only** — it does not bind the OpenID realm or restrict the key.
  - [x] Local realm wired in `.env.local`: `STEAM_REALM=http://localhost:3000`, `STEAM_RETURN_URL=http://localhost:3000/auth/steam/callback`. Full local dev (AC1–AC7) can proceed now.
  - [x] Production domain **DECIDED (2026-07-02): `inclusivcup.cuatro.dev`** (Cuatro owns `cuatro.dev` via Squarespace Domains + Cloudflare DNS). Production env values are therefore `STEAM_REALM=https://inclusivcup.cuatro.dev` and `STEAM_RETURN_URL=https://inclusivcup.cuatro.dev/auth/steam/callback`.
  - [ ] **Deploy-time only (not needed for local dev / not code):** set those two production values in **Vercel env** (Production scope) for project `inclusivcup`; add `inclusivcup.cuatro.dev` as a custom domain in the Vercel project; create the Cloudflare DNS record (CNAME `inclusivcup` → Vercel, DNS-only/grey-cloud is simplest to avoid proxy edge cases with Vercel TLS). This gates only the production login redirect — likely handled at first production deploy (Epic 7 / build-handoff), not inside 2.1's code.

- [x] **Task 1 — Scaffold the first Next.js app (AC5, AC6)** — no `app/`/`lib/`/`package.json` exists yet; this story creates them
  - [x] Initialize a Next.js **16.2.x** App Router project at repo root (Node **20.9+**), TypeScript, at `app/` + `lib/`; add `package.json`, `tsconfig.json`, `next.config.ts`, and extend `.gitignore` (`.next/`, `node_modules/`). Keep the existing `supabase/`, `_bmad*/`, `docs/` intact. — Pinned `next@16.2.10`, `react`/`react-dom@19.2.7`. `.gitignore` already covered `.next/`/`node_modules/`, so no change needed. Next auto-added `.next/dev/types/**` + `jsx: react-jsx` to `tsconfig.json` on first build (expected).
  - [x] Dependencies: `@supabase/supabase-js` (v2) + `@supabase/ssr`. Dev deps: `typescript`, `@types/node`, `vitest`. **Do not** add `@supabase/auth-helpers-nextjs` (deprecated → `@supabase/ssr`). Do not add NextAuth/Auth.js (architecture rides Supabase Auth — see §Session). — Pinned `@supabase/supabase-js@2.110.0`, `@supabase/ssr@0.12.0`, `vitest@4.1.9`, `server-only@0.0.1` (client-import guard).
  - [x] `lib/supabase/admin.ts` — service-role client (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), **server-only** (guard against client import). — `getAdminClient()` (cached, `persistSession:false`), `import 'server-only'`.
  - [x] `lib/supabase/server.ts` — request-scoped SSR client (cookie read/write via `next/headers`) for minting/reading the session. — Two factories: `createSupabaseServerClient()` (next/headers reads) + `createSupabaseRouteClient(req,res)` (writes session cookies onto the callback redirect response).
  - [x] `lib/env.ts` — read + validate server-only env; assert no secret is exposed via `NEXT_PUBLIC_`. — Lazy getters + `assertNoLeakedSecrets()` (throws if any forbidden `NEXT_PUBLIC_<secret>` mirror is set).
  - [x] Commit the chosen lockfile (`package-lock.json`; npm is the default — swap to pnpm only if you prefer, but pin one). — `package-lock.json` committed; npm chosen.

- [x] **Task 2 — `GET /auth/steam/login` (AC1, AC4)** at `app/auth/steam/login/route.ts`, `export const runtime = 'nodejs'`
  - [x] Mint a CSRF nonce; HMAC-sign it with a server secret; set `httpOnly` `SameSite=Lax` `Secure` cookie; bind it to `return_to`. — `mintNonce()` (HMAC-SHA256 over 16 random bytes); cookie `steam_openid_nonce`, `secure` auto-on for https realms; nonce also carried in `return_to` query. Live smoke test confirmed `Set-Cookie` httpOnly + SameSite=Lax.
  - [x] Build the OpenID 2.0 `checkid_setup` redirect to `https://steamcommunity.com/openid/login` with: `openid.ns=http://specs.openid.net/auth/2.0`, `openid.mode=checkid_setup`, `openid.claimed_id` and `openid.identity` both `= http://specs.openid.net/auth/2.0/identifier_select`, `openid.return_to=$STEAM_RETURN_URL` (carrying the nonce), `openid.realm=$STEAM_REALM`. — `buildLoginUrl()`; smoke test confirmed 307 → `steamcommunity.com/openid/login` with `mode=checkid_setup`, `realm=http://localhost:3000`.
  - [x] Minimal login affordance: a server-rendered "Iniciar sesión con Steam" link/button to this route using Valve's official "Sign in through Steam" button asset (Steam brand guidelines). UX docs do not spec a login screen (documented gap — Dev Notes §UX). — `app/page.tsx` Home renders the official Steam button `<img>` (plain `<img>`, no next/image remote-config needed) linking to `/auth/steam/login`; shows a Spanish error line on `?login=error`.

- [x] **Task 3 — `GET /auth/steam/callback` verify (AC1, AC3)** at `app/auth/steam/callback/route.ts`, `runtime = 'nodejs'`
  - [x] Validate the nonce cookie against the returned nonce; validate `openid.return_to` origin == `STEAM_RETURN_URL`; validate `openid.realm`. Any mismatch → fail closed. — `resolveSteamCallback()` runs the 6 ordered guards (missing/mismatch/bad-sig nonce, return_to origin+path, realm origin, then Steam verify); each guard has its own unit test.
  - [x] **`check_authentication` round-trip**: POST **all** received `openid.*` params back to `https://steamcommunity.com/openid/login` with `openid.mode` set to `check_authentication`; require the response body to contain `is_valid:true`. Never trust `openid.sig` or any redirect param without this round-trip. — `createSteamVerifier()`; forwards only `openid.*` params, overrides mode, requires parsed `is_valid === 'true'`; our CSRF `nonce` is never forwarded to Steam (unit-asserted).
  - [x] Extract SteamID64 from the **verified** `openid.claimed_id` via `^https?://steamcommunity\.com/openid/id/(\d{17})$`; reject if not exactly 17 digits. — `extractSteamId64()`; kept as `text` string (never a JS Number).
  - [x] Isolate the Steam verify call behind an injectable interface (e.g. `verifySteamAssertion(params): Promise<{ steamid64 } | null>`) so AC7 tests mock it. — `SteamVerifier` interface + injectable `HttpPost` transport; tests never hit live Steam.
  - [x] On ANY failure (invalid nonce, bad `return_to`/`realm`, `is_valid:false`, non-17-digit id): return an error/redirect-to-login response, mint **no** session, write **nothing**. — Callback route redirects to `/?login=error`; `runSteamLogin` only calls the upsert/session effects on `ok:true`. Live smoke test: tampered nonce → 307 `/?login=error`, no `sb-*` cookie.

- [x] **Task 4 — Service-role `player` upsert (AC2)**
  - [x] Hydrate profile via `ISteamUser/GetPlayerSummaries?key=$STEAM_API_KEY&steamids=<id>` → `personaname` → `display_name`, `avatarfull` → `avatar_url`. (If `STEAM_API_KEY` is not yet provisioned, use `display_name = steamid64` as a temporary placeholder with a `// TODO(2.1): profile hydration pending STEAM_API_KEY` — but full AC2 requires the real key.) — `fetchSteamProfile()` calls GetPlayerSummaries v0002; falls back to `display_name = steamid64` / no avatar on missing key or fetch failure (login must still succeed). Real `STEAM_API_KEY` is now provisioned in `.env.local`.
  - [x] Upsert `player` via the **service-role client** (`lib/supabase/admin.ts`): `on conflict (steamid64) do update set display_name, avatar_url`. `display_name` is cosmetic, never a join key (AD-4). Value MUST satisfy `CHECK (steamid64 ~ '^[0-9]{17}$')` (SQLSTATE `23514` on violation). **No migration** — `player` + the `service_role` DML grant already exist (0001/0002). — `upsertPlayer()` guards the 17-digit shape before the DB call and upserts `onConflict: 'steamid64'`. No migration added (`supabase/` untouched — pgTAP 120/120 unaffected).

- [x] **Task 5 — Mint the Supabase session (AC5)**
  - [x] Ensure a Supabase auth user exists for this SteamID64 via the Admin API — idempotent (`admin.createUser` with a synthetic identifier, e.g. email `<steamid64>@steam.<domain>`, `email_confirm: true`, `app_metadata: { steamid64 }`; on "already exists" fall through to update). Set `app_metadata.steamid64` (identity claim); **do not set `role`** (Story 2.2). — `ensureAuthUser()`; synthetic email `<steamid64>@steam.inclusivcup.local`, `email_confirm:true`, `app_metadata:{ steamid64 }` ONLY (no `role`); "already exists" → no-op (claim was set at creation, steamid64 is immutable).
  - [x] Establish the cookie session server-side (recommended pattern: `admin.generateLink({ type: 'magiclink' })` → `server client.verifyOtp({ type: 'magiclink', token_hash })`, which sets the `@supabase/ssr` cookies). **Verify the exact call against the installed `@supabase/supabase-js` + `@supabase/ssr` versions** — Supabase's server-side session-minting surface has changed across releases; confirm before relying on it. — `establishSession()` uses `generateLink({type:'magiclink'})` → `verifyOtp({type:'email', token_hash})` on the response-bound SSR client (so Set-Cookie attaches to the redirect). ⚠️ This live Supabase round-trip could NOT be exercised headlessly (needs real Auth); flagged for manual QA + code review (see Completion Notes).
  - [x] Redirect to `/` on success. Confirm the minted JWT carries `app_metadata.steamid64` (so `jwt_steamid64()` from migration 0002 resolves). — Redirect to `/` wired; JWT `app_metadata.steamid64` presence is part of the manual-QA checklist (Completion Notes) since it needs a live session.

- [x] **Task 6 — Tests (AC7)** with Vitest — **28 tests across 4 files, all green** (`npm test` → `vitest run`).
  - [x] Unit: verified `claimed_id` → 17-digit extraction; malformed/short id rejected. — `lib/steam/openid.test.ts` (17-digit, http/https, too-short, 18-digit, spoofed host, garbage).
  - [x] Unit: injected `check_authentication` returning `is_valid:false` (and a tampered-param case) → handler writes **no** `player` row and mints **no** session (fail-closed). — `openid.test.ts` (is_valid:false → null) + `lib/auth/login-flow.test.ts` (is_valid:false and tampered-nonce → `upsertPlayer`/`establishSession` NOT called).
  - [x] Unit: nonce mismatch / `return_to` origin mismatch / `realm` mismatch → rejected. — `lib/steam/callback.test.ts` (missing/mismatch/bad-sig nonce, return_to origin, realm origin, invalid assertion) + `lib/steam/nonce.test.ts` (HMAC sign/verify).
  - [x] Add `package.json` scripts (`test`, `build`, `dev`). Note: `supabase test db` (pgTAP, 120/120) is unaffected — this story adds no migration. — Scripts added (`dev`/`build`/`start`/`test`/`test:watch`); `supabase/` confirmed untouched.

- [x] **Task 7 — Build + secret-leak guard (AC6)**
  - [x] `npm run build`; confirm no server secret appears in the client bundle and no `NEXT_PUBLIC_`-prefixed secret was introduced. The `/auth/steam/*` routes and the admin client must never be imported into a Client Component. (This is the first real Next.js build — the client-bundle leak scan deferred in Story 1.1 becomes live here; full audit is Story 7.5.) — `next build` ✓ (compiles, TS passes; `/auth/steam/*` both `ƒ` dynamic/Node). Scanned all 9 `.next/static` client files for 6 real secrets (service-role/steam/nonce/R2/matchzy) → **0 leaks**; only `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are client-exposed. Admin client + routes carry `import 'server-only'` and are never imported by a Client Component.

## Dev Notes

### ⚠️ Blocking Prerequisites (owned by Cuatro)

**STATUS (2026-07-02):** ✅ Steam Web API key registered and set in `.env.local`; ✅ local realm/return_to wired (`http://localhost:3000`) — local dev is unblocked; ✅ **production domain decided: `inclusivcup.cuatro.dev`** (→ `STEAM_REALM=https://inclusivcup.cuatro.dev`, `STEAM_RETURN_URL=https://inclusivcup.cuatro.dev/auth/steam/callback`). ⏳ Remaining is **deploy-time infra only** (Vercel Production env vars + Vercel custom-domain + Cloudflare CNAME) — not 2.1 code, not a local-dev blocker. The API key's "Domain Name" label (`steam-key`) is cosmetic and does not set the realm.

The Epic 1 retrospective flagged this as the **top blocker before Story 2.1** (`sprint-status.yaml` action item, epic 1): _"Obtain Steam Web API key + register production domain before Story 2.1 (deferred from Story 1.1 Task 2)."_ Story 1.1 reserved `STEAM_API_KEY` / `STEAM_REALM` / `STEAM_RETURN_URL` as placeholders (`.env.example` lines 24–28) explicitly _"FINALIZED IN STORY 2.1."_

- **Steam Web API key** → only needed for `GetPlayerSummaries` (cosmetic `display_name`/`avatar_url` sync, AC2). The OpenID `check_authentication` round-trip (AC1) needs **no** key.
- **Production domain** → drives the OpenID `realm`/`return_to`. Local dev can use `http://localhost:3000`. A `*.vercel.app` domain is fine for v1 (casual private group).
- Dev can build and test AC1/AC3/AC4/AC5 against localhost + a mocked profile before these land; only AC2's real profile sync and the production realm are gated.

### 🎯 Scope Boundary — what 2.1 does vs 2.2/2.3/2.4 (read this first)

The architecture (`SOLUTION-DESIGN.md §5`) describes the **whole** auth flow in one place, but the epics deliberately split it. Stay inside 2.1:

| Concern | Story | 2.1 action |
|---|---|---|
| OpenID `check_authentication` verify + `claimed_id`→SteamID64 | **2.1** | ✅ build |
| Service-role `player` upsert (cosmetic `display_name`) | **2.1** | ✅ build |
| Fail-closed: no session/no write on tamper | **2.1** | ✅ build |
| Mint an authenticated Supabase session + `app_metadata.steamid64` | **2.1** | ✅ build (identity claim only) |
| `app_metadata.role` write, **admin allowlist bootstrap**, `is_admin()` proof | **2.2** | ❌ **do not build** |
| Display-name **rename tolerance** guarantee (stats never detach) | **2.3** | ❌ do not build (2.1 only syncs cosmetically) |
| Role enforcement / revoke-invalidates-session / `granted_by` invariant | **2.4** | ❌ do not build |
| `roster_entry` table + registration window | **2.5** | ❌ do not build (no migration in 2.1) |

**Boundary decision — CONFIRMED by Cuatro (2026-07-02):** 2.1 writes `app_metadata.steamid64` (identity, FR-1) and leaves `app_metadata.role` to 2.2 (FR-4) — mirroring the FR split and keeping 2.1's minted session identifiable by `jwt_steamid64()`. Do **not** write `role` in 2.1.

### 🧱 This story creates the FIRST application code

Verified filesystem scan: **no `app/`, `lib/`, `package.json`, `next.config.*`, or `tsconfig.json` exist.** Epic 1 shipped only `supabase/` (migrations 0001–0003 + pgTAP tests) and `docs/`. Story 2.1 is the first Next.js code in the repo — budget for scaffolding, not just the auth handlers.

### Tech Stack (pinned — do not substitute)

- **Next.js 16.2.x, App Router**, Node **20.9+**, on **Vercel** [Source: ARCHITECTURE-SPINE.md#Stack].
- **Supabase** — project `inclusivcup` (ref `ufnumdqrhyvijreoyrxf`), **Postgres 17** (remote), free tier, `us-east-1`. Sessions signed **ES256**; verify via **JWKS** at `$SUPABASE_URL/auth/v1/.well-known/jwks.json` (no shared secret) [Source: Story 1.1 Dev Notes + `.env.example` lines 17–20]. `SUPABASE_JWT_SECRET` (HS256) exists but is optional/fallback.
- **TypeScript** + **Vitest** (chosen defaults — architecture leaves the app test framework unspecified; Epic 1's `supabase test db`/pgTAP covers DB only). Package manager: **npm** (default; pin one lockfile).
- **No custom JWT / no ES256+JWKS to build in app code**: identity→principal rides **Supabase Auth** — this is the deliberate "Option A" [Source: SOLUTION-DESIGN.md#5]. Verifying/refreshing the session is Supabase's job; you set claims via `app_metadata`.

### The Steam OpenID 2.0 flow (implement literally — SOLUTION-DESIGN.md §5)

1. `GET /auth/steam/login` → redirect to Steam OpenID (`return_to=/auth/steam/callback`, `realm`, nonce).
2. Callback **verifies server-side via the Steam `check_authentication` round-trip (never trust redirect params)**; extract `claimed_id` → SteamID64.
3. Service-role upsert `player` (2.1). _[Role lookup/allowlist bootstrap = 2.2.]_
4. Ensure a Supabase auth user; set `app_metadata.steamid64` via Admin API (server-only; RLS never reads `user_metadata`). _[Adding `role` = 2.2.]_
5. Mint the Supabase session cookie. RLS reads identity from `auth.jwt() -> 'app_metadata'`.

**Protocol specifics (from web research, current July 2026):**
- Endpoint: `https://steamcommunity.com/openid/login`. Claimed-id format: `https://steamcommunity.com/openid/id/<steamid64>`.
- Verification = re-POST the returned params with `openid.mode=check_authentication`; a genuine assertion returns `is_valid:true`. This is the ONLY trustworthy check — do not validate `openid.sig` locally and skip the round-trip.
- Keep SteamID64 as a **`text` string end-to-end** — never parse into a JS `Number` (>2^53 precision loss). The `player.steamid64` column is `text` with a 17-digit CHECK.
- Library options: `node-steam-openid` (LeeviHalme) is a thin wrapper that does the round-trip; `passport-steam` is Passport-based (a poor fit for App Router route handlers); Auth.js Steam providers are out (we do not use Auth.js). **Recommendation:** hand-roll the ~40-line `check_authentication` verifier for full auditability and no unmaintained dependency — but if you use `node-steam-openid`, confirm it performs the round-trip and add your own `realm`/`return_to`/nonce validation on top.

### Security requirements (non-negotiable)

- **`check_authentication` round-trip is the load-bearing control** — the SteamID64 comes only from a Steam-confirmed assertion, never from raw query params (AC1, AD-12) [Source: ARCHITECTURE-SPINE.md#AD-12].
- **CSRF/nonce is an implementation gap you must close.** OpenID 2.0 has no native `state`. Mitigation: signed `httpOnly` nonce cookie round-tripped through `return_to`, plus strict `realm`/`return_to`/`openid.return_to` validation against the configured domain [Source: SOLUTION-DESIGN.md#5 — flagged as undocumented].
- **Secrets server-only (AD-25):** `STEAM_API_KEY`, `STEAM_REALM`, `STEAM_RETURN_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` live only in server env; only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` may reach the browser [Source: `.env.example` lines 7–8; ARCHITECTURE-SPINE.md#AD-25].
- **Never write identity/role to `user_metadata`** (client-mutable) — only `app_metadata` via the Admin API/service role (AD-12). RLS helpers read `app_metadata` exclusively [Source: SOLUTION-DESIGN.md#4].

### Database — identity substrate already exists (do NOT add a migration)

`supabase/migrations/0001_core_schema.sql` (verified on disk):

```sql
create table player (
  steamid64     text primary key check (steamid64 ~ '^[0-9]{17}$'),   -- AD-4 canonical key; text, never bigint
  display_name  text not null,                                        -- MUTABLE, cosmetic, NEVER a join key
  avatar_url    text,
  created_at    timestamptz not null default now()
);
create table app_role (
  steamid64   text primary key references player(steamid64) on delete cascade,
  role        text not null check (role in ('admin','viewer')),       -- AD-12 closed set (WRITTEN IN 2.2)
  granted_by  text references player(steamid64) on delete set null,
  granted_at  timestamptz not null default now()
);
```

- `service_role` already holds `select, insert, update, delete` on `player` and `app_role` (granted in `0002_rls.sql`). `service_role` has BYPASSRLS, so RLS FORCE does not block the upsert. **No new grant/policy/migration is needed for 2.1's writes.**
- RLS→JWT contract you must satisfy (from `0002_rls.sql`, verbatim): `is_admin()` and `jwt_steamid64()` read `auth.jwt() -> 'app_metadata' ->> 'role' | 'steamid64'`, fail-closed via `COALESCE(...,false)`. Target claim shape: `app_metadata: { "steamid64": "<17 digits>", "role": "admin"|"viewer" }` — 2.1 sets `steamid64`; 2.2 adds `role`.
- **Framework precedent (Epic 1):** the Data API is always-revoked by default — this only matters if you add a table (you should not here). Do not add forward FKs to non-existent tables. `player.steamid64` writes must be exactly 17 digits.

### Environment variables (server-only unless `NEXT_PUBLIC_`)

Already reserved in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe); `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (server); `STEAM_API_KEY`, `STEAM_REALM`, `STEAM_RETURN_URL` (server — fill in Task 0). Add a server-only secret for HMAC-signing the CSRF nonce (reuse an existing server secret or add `AUTH_NONCE_SECRET`; document it in `.env.example`, names-only, per the Story 1.1 discipline).

### UX

The two UX docs (`DESIGN.md`, `EXPERIENCE.md`) have **no login screen, sign-in button, post-login redirect, or auth-error UX** — the UX focus is viewer surfaces. Firm facts: SteamID64 is the identity key; an authenticated player lands on **Home**; login gates **admin capability**, not read access (viewing is public/read-only); any UI copy is **Spanish** (`Iniciar sesión con Steam`) [Source: EXPERIENCE.md#Foundation, #Information-Architecture]. Keep 2.1's UI to a minimal Spanish login button + a success redirect to `/`; the login/auth-error screens are an open UX gap (flag to Sally/UX if richer treatment is wanted).

### Previous-story intelligence (Epic 1 — all `done`)

- **1.1**: single-environment secrets provisioned; ES256/JWKS session scheme recorded; Steam vars deferred to 2.1 (this story). Only `NEXT_PUBLIC_SUPABASE_*` may be client-exposed.
- **1.2 (0001)**: `player`/`app_role` identity schema — 2.1's upsert target; `text` steamid64 + 17-digit CHECK.
- **1.3 (0002)**: fail-closed RLS + `is_admin()`/`jwt_steamid64()` reading `app_metadata` only; `service_role` DML grants that make 2.1's writes work with zero new SQL.
- **1.4 (0003)**: append-only audit/snapshot — not touched by 2.1.

### Git intelligence

Recent commits (`cee6b67`, `f158d2b`, `afae773`, `4010b51`, `9f17169`) are all DB substrate — migrations 0001–0003 + pgTAP hardening, pushed to remote `inclusivcup`. There is **no app-code precedent to follow**; 2.1 establishes the app conventions (TypeScript, `@supabase/ssr` client factories, Node-runtime route handlers, Vitest). Keep DB migrations lexicographic (`0001_`…); the next migration would be `0004_` (Story 2.5), not this story.

### Project Structure Notes

Target layout (from ARCHITECTURE-SPINE.md#Structural-Seed; only `supabase/` exists today):

```
app/
  auth/steam/login/route.ts       # NEW — GET, runtime=nodejs (Task 2)
  auth/steam/callback/route.ts     # NEW — GET, runtime=nodejs (Task 3)
  page.tsx                         # NEW — Home + minimal Spanish login button
lib/
  supabase/admin.ts                # NEW — service-role client (server-only)
  supabase/server.ts               # NEW — SSR request client (cookies)
  steam/openid.ts                  # NEW — injectable check_authentication verifier
  env.ts                           # NEW — server-only env validation
package.json / tsconfig.json / next.config.ts   # NEW (Task 1)
supabase/migrations/               # UNCHANGED — no new migration in 2.1
```

`app/` may depend on `lib/` and `supabase/migrations`; no dependency on `worker/*` (does not exist). Identifiers/code/comments in English; DB `snake_case`; user-facing copy Spanish [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions, #AD-24].

### References

- [Source: epics.md#Story-2.1 (lines 317–338)] — user story + ACs (verbatim), `_Traces: FR-1 · AD-12 · NFR-Security_`
- [Source: epics.md lines 31, 71, 82, 90] — FR-1, NFR-Security, AD-4, AD-12
- [Source: epics.md#Story-2.2 (lines 340–361)] — the 2.1/2.2 boundary (`app_metadata`/role/allowlist = 2.2)
- [Source: SOLUTION-DESIGN.md#5] — 5-step identity/auth flow; "Steam is OpenID 2.0 (not OIDC)…"; "Option A" (ride Supabase Auth); env secrets §11
- [Source: ARCHITECTURE-SPINE.md#AD-12] — server-side verify via `check_authentication`; `app_metadata` via Admin API only; `is_admin()` fail-closed
- [Source: ARCHITECTURE-SPINE.md#AD-25] — single environment; secrets server-only, never `NEXT_PUBLIC_*`
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed / #Capability→Architecture-Map] — `app/auth/steam` owns F1 identity; source tree
- [Source: supabase/migrations/0001_core_schema.sql] — `player`/`app_role` DDL (verified)
- [Source: supabase/migrations/0002_rls.sql] — `is_admin()`/`jwt_steamid64()` + `service_role` grants (verified)
- [Source: .env.example lines 10–28] — reserved env var names; secret discipline
- [Source: Story 1.1 Dev Notes / `.env.example` lines 17–20] — ES256/JWKS session scheme; Steam vars deferred to 2.1
- [Source: sprint-status.yaml action_items] — Steam Web API key + prod domain = top blocker before 2.1
- [Source: web research, Jul 2026] — Steam OpenID 2.0 endpoint, `check_authentication`/`is_valid:true`, `node-steam-openid` vs hand-roll: https://www.npmjs.com/package/node-steam-openid , https://github.com/liamcurry/passport-steam

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — bmad-dev-story workflow, 2026-07-02.

### Debug Log References

- `npm install` → 78 packages, `package-lock.json` created (note: `sharp@0.34.5` postinstall not run by the sandbox; unused — Home uses a plain `<img>`, not `next/image`, so build is unaffected).
- `npm test` (`vitest run`) → **4 files / 28 tests passed**.
- `npm run build` (`next build`, Next 16.2.10 + Turbopack) → compiled + TypeScript passed; routes: `/` (ƒ), `/auth/steam/callback` (ƒ), `/auth/steam/login` (ƒ). Next auto-added `.next/dev/types/**` to `tsconfig.json.include` and set `jsx: react-jsx` (mandatory Next reconfigure — kept).
- Client-bundle leak scan over 9 `.next/static` files for 6 real secret values → **0 leaks**.
- Live smoke test (dev server): `GET /auth/steam/login` → 307 to `steamcommunity.com/openid/login` (`mode=checkid_setup`, `realm=http://localhost:3000`) + httpOnly/SameSite=Lax `steam_openid_nonce` cookie; `GET /auth/steam/callback?nonce=bogus…` → 307 to `/?login=error` with **no `sb-*` session cookie** (fail-closed).

### Completion Notes List

**Implemented (AC1–AC7):** Steam OpenID 2.0 server-side login as the repo's first Next.js app.
- **Verification (AC1/AD-12):** `lib/steam/openid.ts` `createSteamVerifier()` performs the `check_authentication` round-trip (forwards only `openid.*`, overrides `openid.mode`, requires parsed `is_valid === 'true'`), then extracts the 17-digit SteamID64 from the **verified** `claimed_id`. Redirect params are never trusted. HTTP transport is injectable.
- **CSRF/nonce (AC4 — the gap the architecture flagged):** `lib/steam/nonce.ts` HMAC-SHA256 signed nonce; `login` sets it as httpOnly/SameSite=Lax/(Secure on https) cookie AND carries it in `return_to`; `resolveSteamCallback()` enforces 6 ordered guards (nonce present / match / signature, `return_to` origin+path, `realm` origin, then Steam verify).
- **Player upsert (AC2):** `lib/players.ts` service-role upsert keyed by SteamID64 (17-digit guard), cosmetic `display_name`/`avatar_url` from GetPlayerSummaries (graceful fallback to `steamid64` if the key/fetch fails). No migration — `player` + `service_role` DML grant already exist (0001/0002).
- **Session (AC5):** `lib/auth/session.ts` sets `app_metadata.steamid64` ONLY (no `role` — that's 2.2) via Admin API; mints the cookie session through `generateLink(magiclink)` → `verifyOtp` on a response-bound `@supabase/ssr` client.
- **Fail-closed (AC3):** `lib/auth/login-flow.ts` calls the upsert/session effects only on `ok:true`; unit-proven that failures call neither.
- **Secrets server-only (AC6):** `import 'server-only'` on infra modules; `lib/env.ts` `assertNoLeakedSecrets()`; 0 leaks in the built client bundle.

**Scope discipline:** Did NOT write `app_metadata.role`, run the admin allowlist, add rename-tolerance, or add a migration — those are Stories 2.2/2.3/2.5 per the story's boundary table.

**⚠️ Manual-QA checklist for reviewer (could not be exercised headlessly — needs a live Supabase + a real Steam login):**
1. Full happy path: real Steam login → `player` row upserted with `personaname`/`avatarfull` → landed on `/` authenticated.
2. Confirm the minted JWT carries `app_metadata.steamid64` so `jwt_steamid64()` (migration 0002) resolves — the exact Supabase server-side session-minting surface (`generateLink`→`verifyOtp`) is version-sensitive (per Task 5); verify against `@supabase/supabase-js@2.110.0` + `@supabase/ssr@0.12.0` and adjust `establishSession()` if the API differs.
3. Repeat login (idempotent `ensureAuthUser` "already exists" path) does not error.

**Known follow-ups (not blockers for 2.1):**
- Task 0's last subtask (Vercel Production env vars + custom domain + Cloudflare CNAME for `inclusivcup.cuatro.dev`) is **deploy-time infra, not 2.1 code** — left unchecked by design; gated to first prod deploy / Epic 7 per the story.
- `npm audit` reports 2 moderate advisories in transitive deps — review during hardening (Epic 7), not blocking for a local/private slice.
- `AUTH_NONCE_SECRET` added to `.env.example` (names-only) and to gitignored `.env.local` (real 32-byte hex value, not committed).

**Recommendation:** run `code-review` with a **different** LLM (per BMad guidance), focusing the live Supabase session mint (Task 5) and the CSRF/nonce guards.

### File List

**New — application code (committed):**
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- `app/layout.tsx`, `app/page.tsx`
- `app/auth/steam/login/route.ts`, `app/auth/steam/callback/route.ts`
- `lib/env.ts`
- `lib/supabase/admin.ts`, `lib/supabase/server.ts`
- `lib/steam/openid.ts`, `lib/steam/nonce.ts`, `lib/steam/callback.ts`
- `lib/players.ts`
- `lib/auth/login-flow.ts`, `lib/auth/session.ts`

**New — tests (committed):**
- `lib/steam/openid.test.ts`, `lib/steam/nonce.test.ts`, `lib/steam/callback.test.ts`, `lib/auth/login-flow.test.ts`

**Modified:**
- `.env.example` — documented `AUTH_NONCE_SECRET` (names only)
- `.env.local` — added real `AUTH_NONCE_SECRET` (**gitignored — not committed**)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status tracking (2.1 → in-progress → review)
- `_bmad-output/implementation-artifacts/2-1-steam-openid-2-0-server-side-login.md` — this story (frontmatter `baseline_commit`, task checkboxes, Dev Agent Record)

_Generated (gitignored, not in File List): `node_modules/`, `.next/`, `next-env.d.ts`._

## Change Log

| Date | Change |
|---|---|
| 2026-07-02 | Story 2.1 implemented: first Next.js 16.2 app scaffold + Steam OpenID 2.0 server-side login (check_authentication verify, signed CSRF nonce, service-role `player` upsert, `app_metadata.steamid64` session, fail-closed). 28 Vitest tests pass; `next build` clean; client-bundle secret scan 0 leaks. Status → review. |
