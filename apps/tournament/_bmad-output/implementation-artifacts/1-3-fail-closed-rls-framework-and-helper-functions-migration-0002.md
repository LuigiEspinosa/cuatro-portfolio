---
baseline_commit: c1bfd76db90ce1a28376cfbff1898ddd25b4b67f
---

# Story 1.3: Fail-closed RLS framework and helper functions (migration 0002)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want row-level security enabled and forced on every table with fail-closed admin/viewer helpers,
so that viewers can only ever read approved data and a malformed policy fails closed rather than open.

## Acceptance Criteria

1. **FORCE RLS on every existing table (AD-7).** Migration 0002 runs both `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` on every table that exists at 0002 time — i.e. the four created by migration 0001: `season`, `tournament`, `player`, `app_role`. (Tables created by later migrations enable+force RLS in their own migration, following the convention this story establishes.)

2. **Two-policy rule established, never OR'd (AD-7).** For any table exposing *staged* data, the viewer policy is `USING (status = 'approved')` and the admin-visibility policy is a **separate** `USING (is_admin())` policy — the two are **never** combined into one OR'd policy, so a malformed admin policy cannot widen viewer access. **No table in scope at 0002 has a `status` column**, so this rule is realized here as (a) the documented convention every later staged-data migration follows, and (b) concrete per-table SELECT policies on the four identity/scope tables. 0002 must **not** invent a `status` column on any of the four.

3. **Fail-closed helper functions (AD-12).** `is_admin()` and `jwt_steamid64()` are created and read **only** from `auth.jwt() -> 'app_metadata'`. `is_admin()` is exactly `COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)` — it returns `false` (never NULL) when the role claim is missing, absent, or not the exact string `'admin'`. Both are `STABLE`.

4. **No client write policies; service-role bypasses (AD-2 as substrate).** No `anon`/`authenticated` role holds any INSERT/UPDATE/DELETE policy on any of the four tables; with FORCE RLS + no permissive write policy, every client write fails closed. The service-role key bypasses RLS (Postgres `BYPASSRLS` role attribute) — **no** service-role policy is created; the auth-binding flow (Epic 2) and the worker (Epic 3+) write via the service-role.

5. **Clean apply + the framework provably bites (CAP-1 success bar).** Applied on top of 0001 to a fresh database, migration 0002 applies with zero errors, and a test suite proves: `relforcerowsecurity` is true on all four tables; `is_admin()`/`jwt_steamid64()` resolve correctly for admin / viewer / missing / malformed claims (fail-closed); a `viewer` can read the reference tables but **not** `app_role`; client writes are denied; the service-role bypasses.

_Traces: AD-7, AD-12, AD-17 · NFR-Security · [Source: epics.md#Story 1.3] · [Source: SPEC.md#CAP-1 success] · [Source: SOLUTION-DESIGN.md#4. RLS policies (migration 0002)]_

---

## Dev Notes

> **Read this whole section before writing any SQL.** The single most important thing to understand: the `SOLUTION-DESIGN §4` code block titled "RLS policies (migration 0002)" is a **forward-looking illustration of the whole-roadmap framework** — it writes policies on `stat_row`, `spin`, `audit_log`, `stat_snapshot_row`, etc. **Those tables do not exist yet.** Copying that block verbatim into `0002_rls.sql` will **fail to apply** (`relation "stat_row" does not exist`). This story's real, applyable deliverable is: **the two reusable helper functions + ENABLE/FORCE RLS + concrete SELECT policies on the four tables that exist** (`season`, `tournament`, `player`, `app_role`), plus establishing the convention every later migration reuses. The dev agent will have only this file — everything needed is here.

### What this story is (and is not)

- **This is migration 0002, layered on 0001.** At apply time the database contains exactly the four identity/scope tables from `supabase/migrations/0001_core_schema.sql`: `season`, `tournament`, `player`, `app_role`. Nothing else.
- **In scope (the entire deliverable):**
  1. Two `STABLE` SQL helper functions in `public`: `is_admin()` and `jwt_steamid64()`, reading only from `auth.jwt() -> 'app_metadata'`.
  2. `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on all four existing tables.
  3. Concrete SELECT policies: world-readable reference data (`season`, `tournament`, `player`) for viewers; `app_role` admin-only (fail-closed, no viewer SELECT).
  4. **No** INSERT/UPDATE/DELETE policy for `anon`/`authenticated` anywhere.
  5. A pgTAP suite proving all of the above bites.
- **Explicitly OUT of scope (do NOT do these here):**
  - **Policies on tables that don't exist yet.** `stat_row`, `demo`, `match`, `roster_entry`, `audit_log`, `stat_snapshot`, `stat_snapshot_row`, `award`, `award_result`, `award_result_winner`, `ceremony`, `spin`, `verification_bundle` — each gets its ENABLE/FORCE RLS + policies in the migration that **creates** it (Story 1.4 for audit/snapshot; Epic 3 for demo/stat_row; Epic 4 for match; Epic 6 for award*/ceremony/spin/bundle), reusing the `is_admin()`/`jwt_steamid64()` helpers this story defines. Writing them now is the #1 way to break the apply.
  - **Inventing a `status` column** on any of the four tables to "satisfy" the two-policy rule. None of them is staged data; the `status='approved'` pattern applies to `stat_row` (Epic 3) and reveal-gated tables (Epic 6), not here.
  - **The Steam login / `app_metadata` binding / session logic** → Epic 2. This story assumes the JWT *will* carry `app_metadata.{role,steamid64}`; it only reads that contract, never mints it.
  - **The `granted_by` admin-only / no-self-grant invariant** (deferred from Story 1.2 to "Story 1.3"). RLS **cannot** enforce it here — `app_role` is written exclusively by the service-role, which bypasses RLS; a CHECK/trigger can't cheaply prove "grantor is an admin." Its correct home is the Epic 2 grant/revoke **server route** (Story 2.4), which re-verifies `is_admin()` before writing. **Do not add a CHECK/trigger for it in 0002.** See the closing note flagged for Cuatro.
  - **Role-revoke session invalidation** (AD-12: revoking re-mints `app_metadata` and forces a token refresh) → that is application/Admin-API behavior in Epic 2, not a migration.

### The exact DDL (authoritative for this story)

Derived from `SOLUTION-DESIGN §4` (the helper functions are verbatim; the per-table policies are the concrete realization for the four tables that exist, which the design block does not spell out — see the "one genuine decision" note below). **Use these definitions unless you hit a concrete apply-time error;** if you deviate, document why in the Dev Agent Record.

```sql
-- supabase/migrations/0002_rls.sql
-- Logical migration 0002 — Fail-closed RLS framework + helper functions (Story 1.3).
-- Realizes AD-7 (FORCE RLS everywhere; two-policy, never-OR'd), AD-12 (is_admin/jwt_steamid64
-- fail-closed, read only from app_metadata). Establishes the RLS convention every later migration reuses.
--
-- SCOPE: the two reusable helper functions + ENABLE/FORCE RLS + concrete SELECT policies on the
--        FOUR tables that exist at 0002 (season, tournament, player, app_role). NO write policy for
--        anon/authenticated on any table (service-role bypasses RLS).
-- OUT OF SCOPE — do NOT add here (these tables DO NOT EXIST at 0002; policies on them fail to apply):
--   stat_row/demo/match/roster_entry -> Epic 2/3/4; audit_log/stat_snapshot* -> Story 1.4;
--   award*/ceremony/spin/verification_bundle -> Epic 6. Each ENABLEs+FORCEs RLS in ITS OWN migration,
--   reusing is_admin()/jwt_steamid64() defined below. The SOLUTION-DESIGN §4 block is the whole-roadmap
--   illustration, NOT a literal 0002 — copying it verbatim references non-existent tables.

-- ── Helper functions (AD-12) ────────────────────────────────────────────────
-- STABLE (result constant within a statement; depends on request JWT, so NOT immutable).
-- search_path pinned to '' as defense-in-depth for functions used inside RLS policies
-- (auth.jwt() is already schema-qualified; ->, ->>, coalesce resolve from pg_catalog).
create function public.is_admin() returns boolean
  language sql stable
  set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create function public.jwt_steamid64() returns text
  language sql stable
  set search_path = ''
as $$
  select auth.jwt() -> 'app_metadata' ->> 'steamid64'
$$;

-- ── ENABLE + FORCE RLS on every table that exists at 0002 (AC #1) ────────────
alter table public.season     enable row level security;
alter table public.season     force  row level security;
alter table public.tournament enable row level security;
alter table public.tournament force  row level security;
alter table public.player     enable row level security;
alter table public.player     force  row level security;
alter table public.app_role   enable row level security;
alter table public.app_role   force  row level security;

-- ── SELECT policies (AC #1: "explicit viewer policy OR no viewer SELECT at all") ─
-- Reference / scope data is world-readable: display_name + avatar are public Steam data,
-- season/tournament names + state are public event info; no sensitive columns. Viewer
-- surfaces (Epic 5, incl. Realtime subscriptions) read these directly.
create policy season_read     on public.season     for select to anon, authenticated using (true);
create policy tournament_read on public.tournament for select to anon, authenticated using (true);
create policy player_read     on public.player     for select to anon, authenticated using (true);

-- app_role is sensitive (who is admin): NO viewer SELECT. Admin-only visibility; the (select …)
-- wrap lets the planner cache is_admin() per-statement (init-plan) — the roadmap perf precedent.
create policy app_role_admin_read on public.app_role for select to authenticated using ((select public.is_admin()));

-- ── Writes (AC #4) ──────────────────────────────────────────────────────────
-- Deliberately NO insert/update/delete policy for anon/authenticated on ANY of the four tables.
-- With FORCE RLS + no permissive write policy, every client write fails closed. The auth-binding
-- flow (Epic 2, service-role) upserts player/app_role; service-role bypasses RLS via BYPASSRLS
-- (FORCE removes only the *table-owner* exemption, not the BYPASSRLS attribute). No policy needed.
```

**DDL rationale / guardrails:**
- **`is_admin()` is copied verbatim from `SOLUTION-DESIGN §4` and is load-bearing.** The `COALESCE(…, false)` is the fail-closed core: no JWT → `auth.jwt()` is NULL → `false`; no `app_metadata`/`role` → NULL → `false`; any role that isn't exactly `'admin'` (including `'Admin'`, `' admin'`, `'viewer'`) → `false`. It reads the **JWT, not the `app_role` table** — the JWT (minted server-side into `app_metadata`) is the RLS read-source; the table is the write-time source. This is the single authoritative definition used by both RLS **and** every server route's `is_admin()` re-check (AD-8). [SOLUTION-DESIGN §4:272-274 · AD-12]
- **`STABLE`, not `IMMUTABLE`** — the result depends on the request JWT (request context), constant within one statement. `IMMUTABLE` would be wrong (and would let the planner over-cache). [SOLUTION-DESIGN §4:272,275]
- **`set search_path = ''`** on both functions: hygiene for SQL functions invoked inside RLS policies (prevents search-path shenanigans), and it clears Supabase's `function_search_path_mutable` advisor. `auth.jwt()` is fully schema-qualified so it still resolves; operators come from `pg_catalog`. The design sketch omits this — it is a recommended one-line hardening + roadmap precedent, functionally identical.
- **`(select public.is_admin())` in the `app_role` policy** vs the sketch's bare `is_admin()`: functionally identical; the `(select …)` wrap triggers an init-plan so the JWT is decoded once per statement instead of per row. Immaterial on a 16-row table, but it sets the precedent for `stat_row` (Epic 3) where it matters. Per current Supabase RLS perf guidance. [https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]
- **FORCE vs service-role:** `FORCE ROW LEVEL SECURITY` makes RLS apply to the **table owner** (`postgres`) too — closing the "owner reads everything" gap. It does **not** affect `BYPASSRLS` roles. Supabase's `service_role` has `BYPASSRLS`, so it still bypasses under FORCE — which is exactly AC #4's "service-role key bypasses RLS." Superusers also always bypass (so a bare `psql`/`supabase test db` superuser session sees all rows — RLS behavioral tests must `set local role authenticated`/`anon`, see Testing). [AC #4 · AD-2]
- **Two-policy, never OR'd (AC #2)** is realized two ways here: (a) as the **documented convention** for future staged tables (viewer `USING (status='approved')` and admin `USING (is_admin())` as *separate* policies — a malformed admin policy can't widen the viewer's row set); and (b) concretely, `app_role` gets an admin-only SELECT and the reference tables get a viewer SELECT — never a single `viewer_condition OR is_admin()` policy. Do not merge policies.
- **`to anon, authenticated` / `to authenticated`** scoping is explicit for clarity; `postgres` and `service_role` bypass regardless. A row is readable only if the role has **both** a base table GRANT and a passing policy — Supabase's default privileges already grant DML on `public` tables to `anon`/`authenticated`, so RLS (policy presence/absence) is the real gate.

### Migration tooling & file naming — follow the 0001 precedent

Established in Story 1.2 (do not re-decide): Supabase CLI **v2.109.0**, project **linked** (`supabase/.temp/linked-project.json` → ref `ufnumdqrhyvijreoyrxf`, project `inclusivcup`, us-east-1, free tier, **Postgres engine 17** `17.6.1.127`). `supabase/config.toml` already exists (`major_version = 17`).

- **Filename:** `supabase/migrations/0002_rls.sql` — matches the spine's source-tree note ("`0001 core schema; 0002 RLS`") and the sequential convention 1.2 set. Hand-create it (don't use `supabase migration new`, which emits a timestamp prefix). It sorts lexicographically **after** `0001_core_schema.sql`, so `db reset`/`db push` replay 0001 then 0002. Add a header comment marking it "logical migration 0002" + the OUT-OF-SCOPE note (see the DDL block).
- **Test file:** `supabase/tests/0002_rls_test.sql` (pgTAP), run via `supabase test db`. Reuse 1.2's proven harness pattern verbatim: `begin; create extension if not exists pgtap with schema extensions; set local search_path = extensions, public; select plan(N); … select * from finish(); rollback;`.
- **`auth.jwt()` dependency — verify on the Supabase stack, NOT bare Postgres.** `auth.jwt()` and the `anon`/`authenticated`/`service_role` roles are **Supabase-provided** (seeded into the local `supabase start`/`db reset` DB and the remote). Migration 0002 references `auth.jwt()`, so it applies cleanly on Supabase local/remote but **would error on a throwaway vanilla Postgres** (like the PG 18.4 cluster used to spot-check 0001 in the 1.2 review — that trick won't work here). Verify 0002 via `supabase db reset` + `supabase test db` only.

### Testing / "done" standard

Primary gate (AC #5): **0001 then 0002 apply cleanly to a fresh DB** — `supabase db reset` (Docker-backed local, DB-only stack as in 1.2) replays both migrations with zero errors. Then a pgTAP suite proves the framework bites (not just that it exists). Keep it proportionate (casual private-friends event) but cover every AC. Suggested `supabase/tests/0002_rls_test.sql` assertions — pick a `plan(N)` to match:

- **Structural — FORCE RLS is on (AC #1):** for each of `season`, `tournament`, `player`, `app_role`, assert `relrowsecurity` **and** `relforcerowsecurity` are `true` in `pg_class` (e.g. `is((select relforcerowsecurity from pg_class where oid = 'public.player'::regclass), true, '…')`). 8 assertions.
- **Policy shape (AC #2, #4):** use pgTAP `policies_are('public','app_role', ARRAY['app_role_admin_read'])` (and equivalents) to prove each table has exactly the intended policies and **no write policy exists** anywhere. Optionally `policy_cmd_is(...)` to assert each is `SELECT`.
- **Helper functions, fail-closed (AC #3)** — set the claim GUC and assert (`auth.jwt()` reads `current_setting('request.jwt.claims', true)`):
  - `set local request.jwt.claims = '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}';` → `is_admin()` = `true`; `jwt_steamid64()` = `'76561197960287930'`.
  - `… "role":"viewer" …` → `is_admin()` = `false`.
  - `'{"app_metadata":{}}'` (no role) → `is_admin()` = `false`.
  - `'{}'` (no app_metadata) → `is_admin()` = `false`; `jwt_steamid64()` = `NULL`.
  - `set local request.jwt.claims = ''` / unset → `is_admin()` = `false` (the true fail-closed default).
  - `… "role":"Admin" …` (wrong case) → `is_admin()` = `false` (exact-match, mirrors 1.2's closed-set discipline).
- **Behavioral RLS — the money tests (AC #1, #4):** switch role inside the transaction (`set local role authenticated` / `anon` / `service_role`; `reset role` — or `set local role postgres` — between blocks so pgTAP's own functions run as superuser). Seed a row or two as superuser first.
  - As `authenticated` (viewer claim): `SELECT count(*)` from `player`/`season`/`tournament` returns the seeded rows (viewer **can** read reference data); `SELECT count(*) from app_role` returns **0** (viewer **cannot** read the role table — fail-closed). *(If your local base-GRANTs make the `app_role` read raise `42501` instead of returning 0, that is an acceptable stronger fail-closed outcome — assert with `throws_ok(…, '42501')` instead.)*
  - As `authenticated`: `INSERT INTO player …` is denied — `throws_ok($$ … $$, '42501', …)` (new row violates RLS / no permissive INSERT policy). (UPDATE/DELETE affect 0 rows rather than error, since no row is visible to them — a `results_eq`/row-count assertion is fine if you want to cover them.)
  - As `service_role`: `SELECT count(*) from app_role` returns the seeded rows (**service-role bypasses** FORCE RLS via BYPASSRLS — AC #4).
- **Idempotent re-verify:** after any change, `supabase db reset` (clean apply) + `supabase test db` (expect all green). Capture the pass count in the Dev Agent Record, as 1.2 did.

If pgTAP role-switching proves fiddly for a slice, the structural + policy-shape + helper-fn assertions are the guaranteed-robust core (they alone evidence ACs #1–#4); the behavioral role tests are the convincing complement — include them if they run clean.

### Optional: close the RLS-less window on the remote (coordinate with Cuatro)

Story 1.2 **deliberately did not push 0001 to the linked remote**, to avoid a live RLS-less window, and logged: land 0001 on the remote **together with 0002** in this story. Now that 0002 turns RLS on, pushing both is safe. If Cuatro wants the remote in sync: `supabase db push` applies 0001 + 0002 to ref `ufnumdqrhyvijreoyrxf` (`SUPABASE_DB_PASSWORD` is in gitignored `.env.local`); confirm both rows land in `supabase_migrations.schema_migrations`. This is an outward-facing action on the production project — **confirm before pushing**; local verification (`db reset` + `test db`) is the story's actual gate and is sufficient for "done." If not pushing now, the remote stays empty until the first app deploy, which is fine.

### Project Structure Notes

- New paths this story adds: `supabase/migrations/0002_rls.sql`, `supabase/tests/0002_rls_test.sql`. Both under the planned `supabase/migrations/` + `supabase/tests/` shared-contract slice — not gitignored, **commit them**. [ARCHITECTURE-SPINE.md#Structural Seed — `supabase/migrations/ # 0001 core schema …; 0002 RLS policies — shared contract`]
- No conflicts with the planned layout (`app/`, `lib/`, `worker/`, `roulette/` arrive in later epics; none touched here).
- **Scope judgment logged for the reviewer:** the concrete SELECT policies for the four tables (world-read `season`/`tournament`/`player`; admin-only `app_role`) are **not spelled out in `SOLUTION-DESIGN §4`** (that block illustrates the framework on future tables). They are the recommended realization of AD-7's per-table posture for the four tables that exist. See the flagged decision below — a reviewer/Cuatro may prefer the stricter "no viewer SELECT on any of the four" variant.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Fail-closed RLS framework and helper functions (migration 0002)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation & Schema — success bar: every table ENABLE+FORCE with explicit viewer policy or none]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#4. RLS policies (migration 0002) — is_admin()/jwt_steamid64() verbatim + two-policy sketch]
- [Source: ARCHITECTURE-SPINE.md#AD-7 — Viewers read approved-only; FORCE RLS; two policies never OR'd; per-table default-deny]
- [Source: ARCHITECTURE-SPINE.md#AD-12 — Identity & role bound in app_metadata; is_admin() fail-closed; RLS reads only auth.jwt()->'app_metadata']
- [Source: ARCHITECTURE-SPINE.md#AD-2 — Single-writer: no anon/authenticated write policy on event tables; worker writes via service-role]
- [Source: ARCHITECTURE-SPINE.md#AD-17 — Append-only-by-absence convention (applied when audit/snapshot tables land in Story 1.4)]
- [Source: ARCHITECTURE-SPINE.md#Structural Seed — supabase/migrations/ 0002 RLS policies shared contract]
- [Source: _bmad-output/specs/spec-cs-tournament/SPEC.md#CAP-1 success — every table ENABLE+FORCE, explicit viewer policy or no viewer SELECT; no NEXT_PUBLIC_* secret]
- [Source: _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#FR-4 Roles — Viewer cannot mutate (server-enforced); NFR-Security — all mutations admin-only, worker uses service-role]
- [Source: supabase/migrations/0001_core_schema.sql — the four tables 0002 protects]
- [Source: supabase/tests/0001_core_schema_test.sql — pgTAP harness pattern to reuse]
- [Source: _bmad-output/implementation-artifacts/1-2-identity-and-scope-schema-migration-0001.md — CLI/linked-project facts, naming precedent, RLS-less-window handoff]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — granted_by invariant (re-homed to Epic 2 route, see below)]

### Previous story intelligence (Story 1.2 — done)

- **The four tables 0002 protects (exact shapes, from `0001_core_schema.sql`):** `season(id bigint identity PK, name text not null unique, created_at)`; `tournament(id, season_id not null → season restrict, name, state CHECK closed-set default 'registration_open', format_default, final_match_id, fair_seed, created_at, unique(season_id,name))`; `player(steamid64 text PK CHECK ~ '^[0-9]{17}$', display_name not null, avatar_url, created_at)`; `app_role(steamid64 text PK → player cascade, role CHECK in ('admin','viewer'), granted_by text → player on delete set null, granted_at)`. None has a `status` column.
- **pgTAP harness that works locally (reuse it):** `create extension if not exists pgtap with schema extensions; set local search_path = extensions, public;` then `plan()/lives_ok()/throws_ok()/is()` resolve unqualified against `public` tables, all inside `begin … rollback`. 1.2's suite is 30/30 assertions.
- **Local verify path (Docker present):** 1.2 ran a **DB-only** stack — `supabase start -x edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector` — so only `supabase_db_cs-tournament` runs. Fine for 0002 too. **Caveat:** excluding `gotrue` does **not** remove the `auth` schema or `auth.jwt()` (those are migrations/seed, present after `db reset`), so helper-function tests still work DB-only.
- **The `granted_by` invariant was routed to "Story 1.3" but belongs elsewhere** — see the OUT-of-scope note. RLS can't enforce it (service-role writes bypass RLS). Re-home to Epic 2's grant/revoke route (Story 2.4). Flagged below.
- **Full `supabase test db` was un-run at the end of 1.2** (Docker was down when the second review landed; the +UNIQUE assertions were verified on a standalone PG 18.4, the rest were 19/19 earlier). When you spin up Docker for 0002, it's worth confirming **0001's** suite is green (expect 30/30) before layering 0002 — cheap regression insurance.
- 1.1/1.2 dev agent: `claude-opus-4-8` via `bmad-dev-story`. This story writes **no** secrets and no `NEXT_PUBLIC_*` vars — pure SQL — so 1.1's secrets discipline is not at risk; introduce no env usage.

### Git intelligence

- **Baseline commit:** `c1bfd76` (`fix(db): unique season/tournament names + dup-name tests (Story 1.2 second review)`). History so far is all planning docs + the 0001 schema slice and its two review passes — **0002 is the second code slice**, and it **sets the RLS-framework precedent** (helper-fn definitions, ENABLE/FORCE style, two-policy discipline, per-table policy naming) that Story 1.4 and every later epic's migration will copy. Get the helper-function definitions and the never-OR'd discipline exactly right.
- **Suggested commit style** (matches repo history): `feat(db): fail-closed RLS framework + is_admin/jwt_steamid64 helpers (migration 0002, Story 1.3)`.

### Latest tech information (verified July 2026)

- **Supabase RLS perf — wrap function calls in a subquery:** `USING ((select is_admin()))` causes an init-plan so the JWT is evaluated once per statement, not per row. Applies to `auth.jwt()`/`auth.uid()`-style calls. Adopted for the `app_role` policy above; sets the precedent for high-row tables (`stat_row`). [https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]
- **`auth.jwt()`** returns the decoded JWT claims as `jsonb` (backed by `current_setting('request.jwt.claims', true)`); `-> 'app_metadata' ->> 'role'` navigates object→text. `app_metadata` is server-set (Admin API) and trusted for authz; `user_metadata` is client-mutable and must never be read by RLS (AD-12). [https://supabase.com/docs/guides/database/postgres/row-level-security]
- **Postgres 17 (remote engine 17.6.1):** `alter table … force row level security` and `create policy … to <role> using (…)` are standard; `set search_path = ''` on a `language sql` function is supported. FORCE affects the table owner but not `BYPASSRLS` roles (`service_role`) or superusers.

## Tasks / Subtasks

- [x] **Task 1: Create the migration file** (AC: 1–4)
  - [x] Hand-create `supabase/migrations/0002_rls.sql` (sequential name; sorts after `0001_core_schema.sql`).
  - [x] Add the header comment: "logical migration 0002" + the explicit OUT-OF-SCOPE note (no policies on not-yet-existing tables; SOLUTION-DESIGN §4 is the whole-roadmap illustration, not a literal 0002).
- [x] **Task 2: Helper functions** (AC: 3)
  - [x] `create function public.is_admin() returns boolean language sql stable set search_path = '' as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) $$;` (verbatim from SOLUTION-DESIGN §4).
  - [x] `create function public.jwt_steamid64() returns text language sql stable set search_path = '' as $$ select auth.jwt() -> 'app_metadata' ->> 'steamid64' $$;`.
- [x] **Task 3: ENABLE + FORCE RLS on the four existing tables** (AC: 1)
  - [x] `season`, `tournament`, `player`, `app_role` — each `enable` **and** `force row level security`. (Do not touch tables that don't exist.)
- [x] **Task 4: SELECT policies + no write policies** (AC: 2, 4)
  - [x] World-read: `season_read`, `tournament_read`, `player_read` — `for select to anon, authenticated using (true)`.
  - [x] Admin-only: `app_role_admin_read` — `for select to authenticated using ((select public.is_admin()))`. No viewer SELECT on `app_role`.
  - [x] Create **no** INSERT/UPDATE/DELETE policy for `anon`/`authenticated` on any table. Do **not** create a `status` column. Do **not** OR the viewer/admin conditions into one policy.
  - [x] **[Dev addition — see Completion Notes]** Explicit base-table GRANTs: `select` on the three reference tables to `anon, authenticated`; `select,insert,update,delete` on all four to `service_role`. Needed because `auto_expose_new_tables` is OFF (always-revoked default) → Data API roles held ZERO privileges, so viewer reads (AC #5) and the service-role writer/bypass (AC #4, AD-2) would otherwise `42501`.
- [x] **Task 5: pgTAP proof** (AC: 1, 3, 4, 5)
  - [x] Add `supabase/tests/0002_rls_test.sql`: FORCE-RLS structural asserts (×4 tables), policy-shape asserts (`policies_are`, no write policy), helper-fn fail-closed asserts (admin/viewer/missing/empty/wrong-case), and behavioral role-switch asserts (viewer reads reference tables, cannot read `app_role`, cannot write; service_role bypasses). Reuse 1.2's harness. Set `plan(N)`. → **`plan(39)`**.
- [x] **Task 6: Verify clean apply + tests** (AC: 5)
  - [x] `supabase db reset` (Docker, DB-only stack) — 0001 then 0002 apply with zero errors; confirmed 0001's suite still 30/30.
  - [x] `supabase test db` — all green; **69/69** (0001: 30, 0002: 39). Recorded in Dev Agent Record.
  - [ ] *(Optional, confirm with Cuatro first — outward-facing)* `supabase db push` to land 0001 + 0002 on the linked remote (closes the deferred RLS-less window); confirm both rows in `supabase_migrations.schema_migrations`. **DEFERRED — outward-facing; awaiting Cuatro's go-ahead (see Completion Notes).**
- [x] **Task 7: Commit** (AC: 1–5)
  - [x] Commit `supabase/migrations/0002_rls.sql` + `supabase/tests/0002_rls_test.sql`. Do **not** commit `.env.local` / `supabase/.temp/`.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-8` via `bmad-dev-story`.

### Debug Log References

- Local stack: Supabase CLI **v2.109.0**, DB-only (Postgres 17.6, port 54322). Docker Desktop was down at start; launched it, engine `29.5.3` came up, DB container already present.
- **Empirical grant probe (the pivotal finding).** After a clean `db reset`, `has_table_privilege(...)` showed the Data API roles held **zero** privileges on the 0001 tables: `anon`/`authenticated`/`service_role` all `false` for SELECT/INSERT on every table. Confirmed `config.toml`'s `auto_expose_new_tables` is unset (the new "always-revoked" cloud default the remote also uses), so nothing auto-grants new `postgres`-created tables. `service_role` has `rolbypassrls=t` — but BYPASSRLS skips row *policies*, **not** table GRANTs — so without explicit grants it `42501`s on every table (breaking AC #4's service-role read/write and the roadmap single-writer model, AD-2).
- **Helper-fn claim matrix** verified inside a transaction (psql autocommit swallows `SET LOCAL` outside one): admin→`true`+steamid; viewer→`false`; `{"app_metadata":{}}`→`false`; `{}`→`false`+null steamid; `''`→`false`+null (confirmed `auth.jwt()` uses `nullif(current_setting(...),'')::jsonb`, so empty/unset → NULL, not an error); `"Admin"`→`false`.
- **Role-switch test mechanics** de-risked before writing the suite: `postgres` can `set local role authenticated|anon|service_role`; pgTAP `is()/lives_ok()/throws_ok()/policies_are()/policy_cmd_is()` all run correctly across role switches; `service_role` INSERT into an identity-PK table needs **no** explicit sequence grant.
- **Gate:** `supabase db reset` (0001→0002, zero errors) + `supabase test db` → **PASS, Files=2, Tests=69** (0001: 30/30 regression-green; 0002: 39/39). Re-ran reset+test end-to-end on the exact on-disk files to confirm the pristine path.

### Completion Notes List

Implemented migration 0002 exactly per the story's authoritative DDL (helper functions copied verbatim; ENABLE+FORCE RLS on the four existing tables; concrete SELECT policies — world-read `season`/`tournament`/`player`, admin-only `app_role`; **no** write policy, **no** `status` column, **no** OR'd policy), plus the documented two-policy-never-OR'd convention for future staged tables. All five ACs proven green.

**One reasoned deviation from the DDL (the story explicitly permits documented deviations): explicit base-table GRANTs were added.** The story's Dev Notes assumed "Supabase's default privileges already grant DML on public tables to anon/authenticated" — but this project runs the current always-revoked default (`auto_expose_new_tables` off), so the Data API roles had **no** privileges at all. Without grants, viewers could not read the reference tables (fails AC #5) and `service_role` could neither read nor write (fails AC #4's bypass and the AD-2 single-writer path). I added, in the migration:
- `grant select on season, tournament, player to anon, authenticated;` (viewers read reference data; no write grant — writes stay fail-closed by policy absence *and* grant absence).
- `grant select, insert, update, delete on {season,tournament,player,app_role} to service_role;` (the single server-side writer; BYPASSRLS handles row visibility, the grant handles table access).
- `app_role` gets **no** `anon`/`authenticated` grant → doubly fail-closed (no grant + no viewer policy); the `app_role_admin_read` policy stands as defense-in-depth precedent.

Why grants-in-migration rather than flipping `auto_expose_new_tables = true`: explicit grants apply **identically local and remote** (no config drift, no false local confidence), are **deprecation-proof** (the flag is removed 2026-10-30), and extend the story's own per-migration-responsibility convention (each migration owns its RLS *and* its grants). RLS remains the row gate; the grant is the table gate — both required, which is strictly more fail-closed. **This sets the grant convention every later migration reuses — reviewers should confirm they're comfortable with it, as it's a framework-precedent decision the story did not pre-specify.**

Behavioral note: because `app_role` has no `authenticated` grant, its admin-read policy is currently *dormant* (a viewer `42501`s before RLS is even consulted — the story flags this as the "acceptable stronger fail-closed" outcome). That's intended: admin surfaces read `app_role` via server routes using the service key, not the client Data API.

**Deferred / flagged for Cuatro:**
- **Optional remote push NOT done** (Task 6, outward-facing). Story 1.2 deliberately left 0001 off the linked remote to avoid a live RLS-less window; now that 0002 turns RLS on, `supabase db push` would safely land 0001+0002 on ref `ufnumdqrhyvijreoyrxf`. Awaiting explicit go-ahead before touching the production project. Local `db reset`+`test db` is the story's actual gate and is green.
- **`granted_by` admin-only / no-self-grant invariant** stays OUT of scope (correctly): RLS can't enforce it (service-role writes bypass RLS). Its home is the Epic 2 grant/revoke route (Story 2.4), which re-checks `is_admin()` before writing. No CHECK/trigger added here.

### File List

- `supabase/migrations/0002_rls.sql` (new) — helper functions `is_admin()`/`jwt_steamid64()`, ENABLE+FORCE RLS on the four tables, SELECT policies, base-table grants, two-policy convention doc.
- `supabase/tests/0002_rls_test.sql` (new) — pgTAP suite, `plan(39)`.
- `_bmad-output/implementation-artifacts/1-3-fail-closed-rls-framework-and-helper-functions-migration-0002.md` (modified) — status, task checkboxes, Dev Agent Record.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — 1-3 → in-progress → review.

### Change Log

- 2026-07-01 — Story 1.3 implemented: migration 0002 (fail-closed RLS framework + `is_admin()`/`jwt_steamid64()` helpers) + pgTAP proof. Added explicit base-table grants (documented deviation) because the project's always-revoked Data-API default left the roles ungranted. Verified: clean apply 0001→0002, `supabase test db` 69/69 (0001 30/30, 0002 39/39). Status → review. Remote push deferred pending Cuatro's confirmation.
