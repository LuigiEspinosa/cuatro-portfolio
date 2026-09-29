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
-- FORCE makes RLS apply to the table owner (postgres) too, closing the "owner reads everything"
-- gap. It does NOT affect BYPASSRLS roles: Supabase's service_role still bypasses (AC #4).
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

-- ── Base-table grants (RLS is the row gate, GRANT is the table gate — need BOTH) ──
-- Supabase's current default no longer auto-exposes new `postgres`-created tables to the Data API
-- roles (config.toml `auto_expose_new_tables` is unset = the always-revoked cloud default the remote
-- also uses). Verified against this DB: without the grants below, anon/authenticated/service_role
-- hold ZERO privileges on the 0001 tables. So the grants are made EXPLICIT in the migration itself —
-- they then apply identically local and remote (no config divergence, deprecation-proof).
--
-- Viewers (anon/authenticated): SELECT ONLY, and ONLY on the world-readable reference tables.
-- display_name + avatar are public Steam data; season/tournament names + state are public event info.
-- No write grant (writes also fail-closed by policy absence — belt AND suspenders). app_role gets NO
-- anon/authenticated grant at all → doubly fail-closed (no grant + no viewer policy); the
-- app_role_admin_read policy stands as defense-in-depth precedent for any future authenticated grant.
grant select on public.season     to anon, authenticated;
grant select on public.tournament to anon, authenticated;
grant select on public.player     to anon, authenticated;

-- service_role is the single server-side writer (AD-2): the auth-binding flow (Epic 2) upserts
-- player/app_role and admin command routes (Epic 4) mutate season/tournament, all via the service
-- key. BYPASSRLS lets it skip row policies but NOT table GRANTs, so it needs explicit DML here.
-- This establishes the convention every later migration reuses: grant service_role its tables.
grant select, insert, update, delete
  on public.season, public.tournament, public.player, public.app_role
  to service_role;

-- ── Writes (AC #4) ──────────────────────────────────────────────────────────
-- Deliberately NO insert/update/delete policy for anon/authenticated on ANY of the four tables.
-- With FORCE RLS + no permissive write policy, every client write fails closed regardless of any
-- base DML grant. The auth-binding flow (Epic 2, service-role) upserts player/app_role; service-role
-- bypasses RLS via BYPASSRLS (FORCE removes only the *table-owner* exemption, not BYPASSRLS). No policy needed.

-- ── Two-policy, never-OR'd convention (AC #2) — for LATER staged-data migrations ─
-- No table in scope at 0002 has a `status` column, so there is nothing to stage here (do NOT invent
-- one). When a staged table lands (stat_row → Epic 3; reveal-gated award*/spin → Epic 6), it MUST
-- expose staged rows with TWO SEPARATE policies, never OR'd into one:
--     create policy <t>_viewer_read on public.<t> for select to anon, authenticated
--       using (status = 'approved');
--     create policy <t>_admin_read  on public.<t> for select to authenticated
--       using ((select public.is_admin()));
-- Separate policies are OR'd by Postgres at eval time, but keeping them SEPARATE means a malformed
-- admin policy can only ever ADD admin's own rows — it can never widen the viewer's approved-only set.
-- Merging them into `using (status = 'approved' or is_admin())` would let an admin-clause bug leak
-- unapproved rows to viewers. This is the framework precedent Story 1.3 establishes.
