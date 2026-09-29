-- supabase/tests/0004_roster_test.sql
-- pgTAP proof for migration 0004 (Story 2.5): roster_entry + FORCE RLS + the AD-7 two-policy read.
-- Proves the roster slice BITES (not merely that it exists) across AC2/AC3/AC4. Run via: supabase test db
--   AC2 roster_entry created, UNIQUE(tournament_id, steamid64) under FORCE RLS  -> Section A + Section B
--   AC3 removal reflected to all surfaces (viewer sees only active); locked...  -> Section D (behavioral)
--   AC4 FORCE + AD-7 two-policy + explicit grants (soft-delete: NO delete grant) -> Sections A/C/D
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session, superuser) bypasses RLS, so it seeds/constraint-tests
-- directly. RLS only bites for anon/authenticated; service_role has BYPASSRLS + the DML grants.
-- roster_entry's DISTINCTIVE proof vs 0003's append-only tables: it HAS a base SELECT grant, so the
-- two-policy read is LIVE — a viewer sees only 'active' rows while an admin sees 'active'+'removed'.
-- Soft-delete is enforced at the GRANT layer: service_role holds INSERT+UPDATE but NOT DELETE, so
-- even the privileged writer's DELETE 42501s. SQLSTATE: 23514 check, 23502 not-null, 23503 FK,
-- 23505 unique, 42501 insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/policies_are()/policy_cmd_is() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(38);

-- Seed a minimal, deterministic fixture as postgres (bypasses RLS) before any role switch.
-- roster_entry.tournament_id -> tournament; roster_entry.steamid64 -> player. Two tournaments:
-- T1 for the behavioral read tests (starts empty), T2 for the constraint + delete tests.
insert into player (steamid64, display_name)
  values ('76561197960287930', 'AdminPlayer'),
         ('76561197960287931', 'ViewerPlayer'),
         ('76561197960287932', 'PlayerC');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T1'),
         ((select id from season where name = 'Season 1'), 'T2');

-- ============================================================================
-- Section A — ENABLE + FORCE RLS on roster_entry (AC4)
-- relrowsecurity = ENABLE; relforcerowsecurity = FORCE (applies to the table owner too).
-- (The generic catalog FORCE-guard in the 0003 test also covers this table now.)
-- ============================================================================
select is((select relrowsecurity     from pg_class where oid = 'public.roster_entry'::regclass), true, 'roster_entry: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.roster_entry'::regclass), true, 'roster_entry: ROW LEVEL SECURITY is FORCED');

-- ============================================================================
-- Section B — the DDL constraints BITE (AC2). Run as postgres; constraints fire regardless of RLS.
-- Persistent inserts live on T2 so the cascade delete at the end of this section wipes them,
-- leaving T1 clean for the behavioral read tests in Section D.
-- ============================================================================
-- Happy path + status default.
select lives_ok(
  $$ insert into roster_entry (tournament_id, steamid64)
       values ((select id from tournament where name = 'T2'), '76561197960287932') $$,
  'roster_entry: a valid (tournament, player) row is accepted'
);
select is(
  (select status from roster_entry
     where tournament_id = (select id from tournament where name = 'T2') and steamid64 = '76561197960287932'),
  'active',
  'roster_entry: status defaults to active'
);
-- UNIQUE(tournament_id, steamid64) bites.
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64)
       values ((select id from tournament where name = 'T2'), '76561197960287932') $$,
  '23505', null,
  'roster_entry: a duplicate (tournament_id, steamid64) is rejected by UNIQUE'
);
-- status closed-set CHECK bites on an out-of-set value and on a case variant.
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64, status)
       values ((select id from tournament where name = 'T2'), '76561197960287931', 'foo') $$,
  '23514', null,
  'roster_entry: status=foo is rejected by the closed-set CHECK'
);
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64, status)
       values ((select id from tournament where name = 'T2'), '76561197960287931', 'Active') $$,
  '23514', null,
  'roster_entry: status=Active (wrong case) is rejected by the closed-set CHECK (exact match, not case-folded)'
);
-- steamid64 FK bites (non-existent player) and tournament_id FK bites (non-existent tournament).
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64)
       values ((select id from tournament where name = 'T2'), '99999999999999999') $$,
  '23503', null,
  'roster_entry: a steamid64 with no player row is rejected by the FK'
);
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64) values (999999, '76561197960287931') $$,
  '23503', null,
  'roster_entry: a non-existent tournament_id is rejected by the FK'
);
-- NOT NULL on tournament_id.
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64) values (null, '76561197960287931') $$,
  '23502', null,
  'roster_entry: a null tournament_id is rejected by NOT NULL'
);
-- ON DELETE RESTRICT: a rostered player cannot be hard-deleted (…932 is rostered in T2).
select throws_ok(
  $$ delete from player where steamid64 = '76561197960287932' $$,
  '23503', null,
  'roster_entry: deleting a rostered player is blocked (steamid64 FK is ON DELETE RESTRICT)'
);
-- ON DELETE CASCADE: deleting the tournament removes its roster rows.
select lives_ok(
  $$ delete from tournament where name = 'T2' $$,
  'tournament: delete succeeds and cascades to roster_entry (tournament_id FK is ON DELETE CASCADE)'
);
select is(
  (select count(*)::int from roster_entry where steamid64 = '76561197960287932'),
  0,
  'roster_entry: the rostered row is cascade-deleted when its tournament is deleted'
);

-- ============================================================================
-- Section C — exact policy set + grants (AC4). policies_are asserts the COMPLETE set.
-- ============================================================================
select policies_are(
  'public', 'roster_entry',
  ARRAY['roster_entry_viewer_read', 'roster_entry_admin_read'],
  'roster_entry: exactly the two AD-7 read policies (viewer active-only + admin); no write policy'
);
select policy_cmd_is('public', 'roster_entry', 'roster_entry_viewer_read', 'SELECT', 'roster_entry_viewer_read is a SELECT-only policy');
select policy_cmd_is('public', 'roster_entry', 'roster_entry_admin_read',  'SELECT', 'roster_entry_admin_read is a SELECT-only policy');

-- Grants (has_table_privilege reads the grant, not RLS). service_role: SELECT/INSERT/UPDATE but
-- NOT DELETE (the soft-delete ceiling — the distinctive proof); anon/authenticated: SELECT only.
select is(has_table_privilege('service_role',  'public.roster_entry', 'SELECT'), true,  'service_role CAN SELECT roster_entry');
select is(has_table_privilege('service_role',  'public.roster_entry', 'INSERT'), true,  'service_role CAN INSERT roster_entry (enroll/add)');
select is(has_table_privilege('service_role',  'public.roster_entry', 'UPDATE'), true,  'service_role CAN UPDATE roster_entry (reactivate + soft-delete)');
select is(has_table_privilege('service_role',  'public.roster_entry', 'DELETE'), false, 'service_role CANNOT DELETE roster_entry (soft-delete ceiling — the grant is the teeth)');
select is(has_table_privilege('anon',          'public.roster_entry', 'SELECT'), true,  'anon CAN SELECT roster_entry (public viewer surface, filtered to active by policy)');
select is(has_table_privilege('anon',          'public.roster_entry', 'INSERT'), false, 'anon CANNOT INSERT roster_entry (fail closed)');
select is(has_table_privilege('anon',          'public.roster_entry', 'UPDATE'), false, 'anon CANNOT UPDATE roster_entry (fail closed)');
select is(has_table_privilege('anon',          'public.roster_entry', 'DELETE'), false, 'anon CANNOT DELETE roster_entry (fail closed)');
select is(has_table_privilege('authenticated', 'public.roster_entry', 'SELECT'), true,  'authenticated CAN SELECT roster_entry (viewer surface, filtered to active by policy)');
select is(has_table_privilege('authenticated', 'public.roster_entry', 'INSERT'), false, 'authenticated CANNOT INSERT roster_entry (fail closed — writes go via the service role)');
select is(has_table_privilege('authenticated', 'public.roster_entry', 'UPDATE'), false, 'authenticated CANNOT UPDATE roster_entry (fail closed)');
select is(has_table_privilege('authenticated', 'public.roster_entry', 'DELETE'), false, 'authenticated CANNOT DELETE roster_entry (fail closed)');

-- ============================================================================
-- Section D — behavioral: the money tests (AC2, AC3, AC4). Operates on T1 (empty so far).
-- ============================================================================

-- service_role (the sole writer): inserts an active + a removed row (the UPDATE-to-removed path is
-- the soft-delete), and its DELETE 42501s (no grant) — the soft-delete ceiling bites the writer too.
set local role service_role;
select lives_ok(
  $$ insert into roster_entry (tournament_id, steamid64, status)
       values ((select id from tournament where name = 'T1'), '76561197960287930', 'active') $$,
  'service_role inserts an active roster_entry (grant + BYPASSRLS) — the single-writer enroll path'
);
select lives_ok(
  $$ insert into roster_entry (tournament_id, steamid64, status)
       values ((select id from tournament where name = 'T1'), '76561197960287931', 'active') $$,
  'service_role inserts a second active roster_entry'
);
select lives_ok(
  $$ update roster_entry set status = 'removed'
       where tournament_id = (select id from tournament where name = 'T1') and steamid64 = '76561197960287931' $$,
  'service_role UPDATEs a row to status=removed (soft-delete — the grant permits UPDATE)'
);
select throws_ok(
  $$ delete from roster_entry where tournament_id = (select id from tournament where name = 'T1') $$,
  '42501', null,
  'service_role CANNOT DELETE roster_entry — soft-delete ceiling bites even the privileged writer (no delete grant)'
);
set local role postgres;

-- authenticated viewer: the two-policy read gives ONLY the active row (the 'removed' one is hidden —
-- AC3 "reflected to all surfaces"); every write 42501s (no grant/policy — fail closed).
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select is(
  (select count(*)::int from roster_entry where tournament_id = (select id from tournament where name = 'T1')),
  1,
  'authenticated viewer reads ONLY the active roster row (roster_entry_viewer_read hides the removed one)'
);
select is(
  (select steamid64 from roster_entry where tournament_id = (select id from tournament where name = 'T1')),
  '76561197960287930',
  'authenticated viewer: the one visible row is the ACTIVE player (…930), never the removed …931'
);
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64)
       values ((select id from tournament where name = 'T1'), '76561197960287932') $$,
  '42501', null,
  'authenticated viewer CANNOT insert roster_entry (no write grant/policy) — fail closed');
select throws_ok(
  $$ update roster_entry set status = 'removed' where steamid64 = '76561197960287930' $$,
  '42501', null,
  'authenticated viewer CANNOT update roster_entry — fail closed');
set local role postgres;

-- authenticated ADMIN: unlike app_role/audit_log (dormant admin policy — no base grant), roster_entry
-- HAS a base SELECT grant, so roster_entry_admin_read is LIVE and OR's the removed row in — an admin
-- sees BOTH the active and the removed row.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select is(
  (select count(*)::int from roster_entry where tournament_id = (select id from tournament where name = 'T1')),
  2,
  'authenticated ADMIN reads BOTH rows (active + removed) — roster_entry_admin_read OR''s in the removed row (LIVE, not dormant)'
);
set local role postgres;

-- anon (unauthenticated public): sees only the active row (viewer policy; the admin policy is
-- `to authenticated`, so it never applies to anon).
set local role anon;
select is(
  (select count(*)::int from roster_entry where tournament_id = (select id from tournament where name = 'T1')),
  1,
  'anon reads ONLY the active roster row (public viewer surface; admin policy does not apply to anon)'
);
set local role postgres;

select * from finish();

rollback;
