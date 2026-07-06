-- supabase/migrations/0004_roster.sql
-- Logical migration 0004 — Roster slice (Story 2.5).
-- Realizes FR-3 roster membership + the AD-7 two-policy read. roster_entry is the FIRST table
-- to REALIZE the two-policy convention migration 0002 forecast (0002:87-98) — its `status`
-- column ('active'/'removed') is the staging column ('approved'/'pending' in the forecast).
--
-- SCOPE: the roster_entry table ONLY, per SOLUTION-DESIGN §3 (lines 83-91): surrogate id PK;
--        tournament_id FK -> tournament ON DELETE CASCADE; steamid64 FK -> player ON DELETE
--        RESTRICT; nullable bracket_seed SHELL; status closed-set soft-delete; registered_at;
--        unique(tournament_id, steamid64) + ENABLE/FORCE RLS + the two SELECT policies (viewer
--        active-only + admin) + explicit grants (anon/authenticated SELECT; service_role
--        SELECT/INSERT/UPDATE — deliberately NO DELETE = the soft-delete ceiling).
-- OUT OF SCOPE — do NOT add here:
--   * bracket_seed POPULATION (Epic 4 bracket generation). The column is a nullable shell only,
--     exactly like 0001's tournament.final_match_id / fair_seed placeholder columns.
--   * a match table + any match -> roster_entry FK (Epic 4 owns that direction) — NO forward FK
--     from roster_entry to a table that does not exist yet.
--   * the tournament.state open/close TRANSITION — the closed-set states already exist since
--     0001 (registration_open/_closed/bracket_live/ceremony/closed); open/close is a service-role
--     UPDATE the admin route performs at runtime, NOT a DDL change. No ALTER here.
--   * any anon/authenticated WRITE policy — all writes go through the service role behind a
--     server route (AD-2 single writer, SPINE:295). Fail-closed by policy + grant absence.
--   * admin/viewer UI (backend-first, Decision 5).

-- ── roster_entry (FR-3) — the tournament<->player membership set ─────────────
create table roster_entry (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,       -- AD-18 scope; drop the roster when the event is deleted
  steamid64     text   not null references player(steamid64) on delete restrict,   -- AD-4 canonical key (text, never bigint); a rostered player cannot be hard-deleted out from under the roster
  bracket_seed  int,                                                               -- nullable SHELL; populated at bracket generation (Epic 4) — mirrors 0001's final_match_id / fair_seed placeholder columns
  status        text not null default 'active'
                check (status in ('active','removed')),                            -- soft-delete (Decision 2): 'removed' hides from the viewer read, keeps the admin/history row
  registered_at timestamptz not null default now(),
  unique (tournament_id, steamid64)                                                -- one roster entry per (event, player); the reactivate-on-conflict key the enroll/add path upserts on
);

-- ── ENABLE + FORCE RLS (the AD-7 convention 0002/0003 established) ───────────
-- FORCE is non-negotiable: the generic catalog FORCE-guard in the 0003 test (lines 54-60) asserts
-- NO public base table may have FORCE off, so it now covers roster_entry too and fails loudly here
-- if this is omitted. FORCE does not affect BYPASSRLS roles — service_role still bypasses.
alter table roster_entry enable row level security;
alter table roster_entry force  row level security;

-- ── The AD-7 two-policy read (realized here for the first time; never OR'd) ──
-- 0002 (87-98) forecast this exact shape for a future staged table. roster_entry realizes it:
--   * viewer sees ONLY status='active' rows (a 'removed' player disappears from every viewer
--     surface — this is AC3's "reflected to all surfaces");
--   * admin additionally sees everything (incl. 'removed') via is_admin().
-- The two policies are kept SEPARATE (Postgres OR's them at eval time), never merged into
-- `using (status='active' or is_admin())`. Separation means a malformed admin policy can only
-- ever ADD admin's own rows — it can never widen the viewer's active-only set.
--
-- Unlike app_role (0002) / audit_log (0003) whose admin_read policy is DORMANT (those tables have
-- NO base grant, so even an admin 42501s at the grant gate before RLS runs), roster_entry HAS a
-- base SELECT grant to anon/authenticated (below), so BOTH policies are LIVE: the admin_read
-- genuinely OR's the 'removed' rows in for an admin caller. The (select …) wrap makes is_admin()
-- an init-plan (evaluated once per statement) — the roadmap perf precedent.
create policy roster_entry_viewer_read on public.roster_entry
  for select to anon, authenticated using (status = 'active');
create policy roster_entry_admin_read on public.roster_entry
  for select to authenticated using ((select public.is_admin()));

-- ── Grants (always-revoked Data API default — config.toml auto_expose_new_tables unset) ──
-- Without explicit grants a new table has ZERO privileges for anon/authenticated/service_role
-- (retro action item #3 / framework precedent a). So:
--   * anon/authenticated get SELECT only — viewer surfaces + Realtime read the active roster
--     directly, exactly like player/tournament in 0002. No write grant (writes also fail closed by
--     policy absence — belt AND suspenders).
grant select on public.roster_entry to anon, authenticated;
--   * service_role (the single server-side writer, AD-2) gets SELECT/INSERT/UPDATE — enroll/add is
--     an upsert (INSERT + on-conflict UPDATE), removal is a status UPDATE. Deliberately NO DELETE:
--     removal is soft-delete, so even the privileged writer cannot hard-delete a roster row. The
--     grant is the teeth (the same append-only-by-grant lesson as 0003's audit/snapshot tables);
--     the 0004 pgTAP proves service_role DELETE 42501s.
grant select, insert, update on public.roster_entry to service_role;

-- ── Writes for anon/authenticated (fail-closed) ─────────────────────────────
-- Deliberately NO insert/update/delete policy for anon/authenticated on roster_entry. With FORCE
-- RLS + no permissive write policy + no write grant, every client write fails closed. The
-- self-enroll / admin add / admin remove paths all write via the service role behind a server
-- route (requireUser / requireAdmin gated) — a player can only enroll THEMSELVES (the id comes
-- from the verified session, never a client insert). This preserves the SPINE:295 invariant.
