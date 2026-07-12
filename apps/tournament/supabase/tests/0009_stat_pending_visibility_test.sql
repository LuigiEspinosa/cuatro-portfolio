-- supabase/tests/0009_stat_pending_visibility_test.sql
-- pgTAP proof for migration 0009 (Story 3.5): the AD-7 two-policy Pending-visibility model on stat_row.
-- Proves the viewer model BITES (not merely that the policy/grant exist) across AC2/AC3/AC4.
-- Run via: supabase test db
--   AC2/AC4 the policy set is now {stat_admin, stat_view}; stat_view is SELECT to {anon,authenticated};
--           its USING references status/approved and NOT is_admin (the never-OR'd guarantee)      -> Section A
--   AC2/AC4 the grant matrix: anon+authenticated now hold SELECT (no write); service_role unchanged -> Section B
--   AC3     BEHAVIORAL row-level filtering: anon + authenticated-viewer see approved-ONLY; the
--           authenticated-admin (is_admin()) sees pending too                                      -> Section C
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they see every row
-- regardless of policy. The viewer teeth bite for non-BYPASSRLS roles under FORCE RLS: anon + authenticated
-- read through the SELECT grant (0009) and RLS then filters — stat_view USING (status='approved') for
-- everyone, plus the SEPARATE stat_admin USING (is_admin()) that ORs in ALL rows for an admin claim. Kept
-- as two permissive policies (AD-7): Postgres ORs them, so a malformed admin policy could only ADD admin's
-- own rows, never widen the viewer's approved-only set. is_admin() is driven by request.jwt.claims via
-- set_config (app_metadata.role). `stat_row.demo_id` is a FK to demo, so we seed ONE demo FK parent;
-- `match_id` is a plain bigint (no FK), mirroring the 0007/0008 seeding.
-- SQLSTATE: n/a here (this suite proves visibility, not fail-closed writes — that stays in 0007).

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/policies_are()/policy_cmd_is() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(23);

-- Seed as postgres (BYPASSRLS) before any role switch: one demo FK parent, then two stat_rows sharing a
-- match_id — one 'approved' (…930, viewer-visible), one 'pending' (…931, default; admin-only).
insert into demo (match_id, storage_key, source) values (444, 'demos/pending/vis.dem', 'matchzy');
insert into stat_row (match_id, steamid64, demo_id, status) values
  (444, '76561197960287930', (select id from demo where storage_key = 'demos/pending/vis.dem'), 'approved');  -- viewer-visible
insert into stat_row (match_id, steamid64, demo_id) values
  (444, '76561197960287931', (select id from demo where storage_key = 'demos/pending/vis.dem'));  -- status defaults to 'pending' (admin-only)

-- ============================================================================
-- Section A — the policy set + stat_view's shape (AC2/AC4). The two-SEPARATE-policies, never-OR'd model.
-- ============================================================================
select policies_are(
  'public', 'stat_row',
  ARRAY['stat_admin','stat_view'],
  'stat_row: exactly two SELECT policies — stat_admin (0007, is_admin) + stat_view (0009, approved-only); kept SEPARATE (AD-7)'
);
select policy_cmd_is('public', 'stat_row', 'stat_view', 'SELECT', 'stat_view is a SELECT-only policy');
select ok(
  (select roles from pg_policies where schemaname = 'public' and tablename = 'stat_row' and policyname = 'stat_view')
    @> ARRAY['anon','authenticated']::name[],
  'stat_view applies to both anon and authenticated (the viewer roles)');
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'stat_row' and policyname = 'stat_view') ~ 'approved',
  'stat_view USING references status=''approved'' (viewers see approved-only)');
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'stat_row' and policyname = 'stat_view') !~ 'is_admin',
  'stat_view USING has NO is_admin() escape hatch — admin visibility is the SEPARATE stat_admin policy, never OR''d in (AD-7)');

-- ============================================================================
-- Section B — the grant matrix (AC2/AC4). has_table_privilege reads the grant, not RLS.
-- anon + authenticated now hold SELECT (0009); still NO write. service_role unchanged (0007).
-- ============================================================================
select is(has_table_privilege('anon',          'public.stat_row', 'SELECT'), true,  'anon HAS SELECT on stat_row (0009 viewer grant — RLS stat_view then filters to approved-only)');
select is(has_table_privilege('anon',          'public.stat_row', 'INSERT'), false, 'anon CANNOT INSERT stat_row (single-writer — no write grant/policy)');
select is(has_table_privilege('anon',          'public.stat_row', 'UPDATE'), false, 'anon CANNOT UPDATE stat_row (fail closed)');
select is(has_table_privilege('anon',          'public.stat_row', 'DELETE'), false, 'anon CANNOT DELETE stat_row (fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'SELECT'), true,  'authenticated HAS SELECT on stat_row (0009 viewer grant)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'INSERT'), false, 'authenticated CANNOT INSERT stat_row (single-writer — fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'UPDATE'), false, 'authenticated CANNOT UPDATE stat_row (fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'DELETE'), false, 'authenticated CANNOT DELETE stat_row (fail closed)');
select is(has_table_privilege('service_role',  'public.stat_row', 'SELECT'), true,  'service_role CAN SELECT stat_row (unchanged from 0007)');
select is(has_table_privilege('service_role',  'public.stat_row', 'INSERT'), true,  'service_role CAN INSERT stat_row (unchanged — the single-writer parse path)');
select is(has_table_privilege('service_role',  'public.stat_row', 'UPDATE'), true,  'service_role CAN UPDATE stat_row (unchanged — ON CONFLICT DO UPDATE)');
select is(has_table_privilege('service_role',  'public.stat_row', 'DELETE'), true,  'service_role CAN DELETE stat_row (unchanged — Story-3.6 delete-missing)');

-- ============================================================================
-- Section C — the money tests (AC3): row-level visibility under FORCE RLS for non-BYPASSRLS roles.
-- ============================================================================

-- anon (no JWT claims ⇒ is_admin() = false): sees ONLY the approved row via stat_view; pending is invisible.
set local role anon;
select is((select count(*)::int from stat_row), 1,
  'anon sees exactly 1 stat_row (approved-only) — the pending row is filtered out by RLS, not by convention');
select is((select count(*)::int from stat_row where status = 'pending'), 0,
  'anon sees ZERO pending stat_rows (Pending is invisible to viewers — the row-level teeth)');
select is((select steamid64 from stat_row), '76561197960287930',
  'anon sees the APPROVED row''s steamid64 (…930) and only it');
set local role postgres;

-- authenticated non-admin viewer (role=viewer ⇒ is_admin() = false): same as anon — approved-only.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select is((select count(*)::int from stat_row), 1,
  'authenticated non-admin viewer sees exactly 1 stat_row (approved-only) — same as anon, is_admin() is false');
set local role postgres;

-- authenticated ADMIN (role=admin ⇒ is_admin() = true): sees BOTH rows (stat_admin ORs in all rows).
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select is((select count(*)::int from stat_row), 2,
  'authenticated ADMIN sees BOTH stat_rows (approved + pending) via stat_admin OR''d with stat_view');
select is((select count(*)::int from stat_row where status = 'pending'), 1,
  'authenticated ADMIN sees the PENDING row (admin Pending visibility — the reviewer surface)');
set local role postgres;

select * from finish();

rollback;
