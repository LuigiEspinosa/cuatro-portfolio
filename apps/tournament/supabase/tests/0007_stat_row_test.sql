-- supabase/tests/0007_stat_row_test.sql
-- pgTAP proof for migration 0007 (Story 3.3): the `stat_row` derived-stats table (the Parsing node).
-- Proves the stat_row slice BITES (not merely that it exists) across AC1/AC3/AC4. Run via: supabase test db
--   AC4 table + FULL column set (stat columns nullable) + status default + the CHECKs               -> Section B
--   AC3 UNIQUE(match_id, steamid64) = the re-parse idempotency key                                    -> Section B (col_is_unique + behavioral 23505)
--   AC4 demo_id NOT NULL + FK -> demo; match_id NOT NULL and NO FK to match (deferred to Epic 4)       -> Section B
--   AC1/AC4 admin-only stat_admin SELECT (dormant, mirrors demo); FORCE RLS; NO viewer stat_view yet   -> Section A + C
--   AC1 single-writer: service_role select/insert/update/DELETE; anon/authenticated no priv            -> Section C + D
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they insert
-- regardless of policy. The single-writer teeth bite at the GRANT gate, not RLS: service_role holds
-- SELECT+INSERT+UPDATE+DELETE (DELETE is granted here — UNLIKE demo — for the Story-3.6 re-parse
-- delete-missing path); anon/authenticated hold ZERO grants -> every read and write fails closed
-- (stat_row is admin/worker-only until Story 3.5's viewer policy — stat_admin is DORMANT because there
-- is no base grant to reach it). `stat_row.match_id` is a plain bigint with NO FK (match does not exist
-- yet); `stat_row.demo_id` IS a FK to demo, so this test seeds ONE demo row as the FK parent.
-- SQLSTATE: 23514 check, 23502 not-null, 23503 fk, 23505 unique, 42501 insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/has_table()/col_is_unique()/policies_are()/policy_cmd_is() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(36);

-- Seed the single FK parent as postgres (BYPASSRLS) before any role switch: stat_row.demo_id -> demo(id).
-- demo.match_id has no FK (match does not exist), so this seed needs no match/season fixture.
insert into demo (match_id, storage_key, source) values (990, 'demos/990/seed.dem', 'matchzy');

-- ============================================================================
-- Section A — the table exists + ENABLE + FORCE RLS on stat_row (AC1/AC4)
-- relrowsecurity = ENABLE; relforcerowsecurity = FORCE (applies to the table owner too).
-- (The generic catalog FORCE-guard in the 0003 test also covers this table now.)
-- ============================================================================
select has_table('public'::name, 'stat_row'::name, 'stat_row: the derived-stats table exists');
select is((select relrowsecurity     from pg_class where oid = 'public.stat_row'::regclass), true, 'stat_row: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.stat_row'::regclass), true, 'stat_row: ROW LEVEL SECURITY is FORCED');

-- ============================================================================
-- Section B — columns, defaults, CHECKs, NOT NULLs, keys (AC3/AC4). Run as postgres;
-- constraints fire regardless of RLS. Minimal valid insert is (match_id, steamid64, demo_id).
-- ============================================================================
-- Happy path: a minimal valid parsed row is accepted (and proves the table + FK resolve).
select lives_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id)
       values (990, '76561197960287930', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  'stat_row: a valid (match_id, steamid64, demo_id) parsed row is accepted'
);
-- Defaults + nullable shells land as specified.
select is((select status  from stat_row where match_id = 990 and steamid64 = '76561197960287930'), 'pending', 'stat_row: status defaults to pending (3.3 writes pending; approve is Story 3.5/4.6)');
select is((select idle_dq from stat_row where match_id = 990 and steamid64 = '76561197960287930'), false,     'stat_row: idle_dq defaults to false (Epic-5 AFK/idle shell)');
select is((select kills   from stat_row where match_id = 990 and steamid64 = '76561197960287930'), null,      'stat_row: kills is a NULL shell on a minimal row (the parser fills it; Epic-5 stat columns stay NULL)');
-- steamid64 CHECK: a non-17-digit id is rejected (AD-4 canonical-key discipline).
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id)
       values (990, '123', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23514', null, 'stat_row: a non-17-digit steamid64 is rejected by the CHECK (~ ^[0-9]{17}$)');
-- status closed-set CHECK bites on an out-of-set value.
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id, status)
       values (990, '76561197960287931', (select id from demo where storage_key = 'demos/990/seed.dem'), 'foo') $$,
  '23514', null, 'stat_row: status=foo is rejected by the closed-set CHECK (only pending/approved)');
-- demo_id NOT NULL + FK -> demo.
select throws_ok(
  $$ insert into stat_row (match_id, steamid64) values (990, '76561197960287932') $$,
  '23502', null, 'stat_row: a null demo_id is rejected by NOT NULL (every row carries its parse provenance)');
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id) values (990, '76561197960287932', 999999) $$,
  '23503', null, 'stat_row: a demo_id with no demo row is rejected by the FK -> demo(id)');
-- match_id NOT NULL, and NO FK to match (the deferred-FK proof: a match_id with no matching row inserts).
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id)
       values (null, '76561197960287932', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23502', null, 'stat_row: a null match_id is rejected by NOT NULL');
select lives_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id)
       values (888888, '76561197960287933', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  'stat_row: a match_id with NO matching match row still inserts — proves the match FK is DEFERRED to Epic 4 (no match table yet)');
-- UNIQUE(match_id, steamid64): a duplicate pair is the AD-3 re-parse key (worker upserts via ON CONFLICT).
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id) values
       (777, '76561197960287944', (select id from demo where storage_key = 'demos/990/seed.dem')),
       (777, '76561197960287944', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23505', null, 'stat_row: a duplicate (match_id, steamid64) is rejected by UNIQUE — the AD-3 re-parse idempotency key');
select col_is_unique('public'::name, 'stat_row'::name, ARRAY['match_id','steamid64']::name[],
  'stat_row: UNIQUE(match_id, steamid64) exists on exactly those columns (the ON CONFLICT target)');

-- ============================================================================
-- Section C — exact policy set + grants (AC1/AC4). policies_are asserts the COMPLETE set.
-- ============================================================================
select policies_are(
  'public', 'stat_row',
  ARRAY['stat_admin'],
  'stat_row: exactly one policy (admin read); NO viewer stat_view policy yet (Story 3.5 adds it), no write policy'
);
select policy_cmd_is('public', 'stat_row', 'stat_admin', 'SELECT', 'stat_admin is a SELECT-only policy');

-- Grants (has_table_privilege reads the grant, not RLS). service_role: SELECT/INSERT/UPDATE AND DELETE
-- (DELETE is the distinctive proof — granted here for Story-3.6 re-parse delete-missing, unlike demo);
-- anon/authenticated: nothing (admin/worker-only until Story 3.5's viewer grant).
select is(has_table_privilege('service_role',  'public.stat_row', 'SELECT'), true,  'service_role CAN SELECT stat_row');
select is(has_table_privilege('service_role',  'public.stat_row', 'INSERT'), true,  'service_role CAN INSERT stat_row (parse upsert — insert half)');
select is(has_table_privilege('service_role',  'public.stat_row', 'UPDATE'), true,  'service_role CAN UPDATE stat_row (parse upsert — ON CONFLICT DO UPDATE half)');
select is(has_table_privilege('service_role',  'public.stat_row', 'DELETE'), true,  'service_role CAN DELETE stat_row (Story-3.6 re-parse delete-missing — DELETE IS granted, unlike demo)');
select is(has_table_privilege('anon',          'public.stat_row', 'SELECT'), false, 'anon CANNOT SELECT stat_row (admin/worker-only until Story 3.5)');
select is(has_table_privilege('anon',          'public.stat_row', 'INSERT'), false, 'anon CANNOT INSERT stat_row (single-writer — fail closed)');
select is(has_table_privilege('anon',          'public.stat_row', 'UPDATE'), false, 'anon CANNOT UPDATE stat_row (fail closed)');
select is(has_table_privilege('anon',          'public.stat_row', 'DELETE'), false, 'anon CANNOT DELETE stat_row (fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'SELECT'), false, 'authenticated has NO SELECT grant on stat_row (admin-only; stat_admin is dormant until Story 3.5)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'INSERT'), false, 'authenticated CANNOT INSERT stat_row (single-writer — fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'UPDATE'), false, 'authenticated CANNOT UPDATE stat_row (fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'DELETE'), false, 'authenticated CANNOT DELETE stat_row (fail closed)');

-- ============================================================================
-- Section D — behavioral: the money tests (AC1). Uses the seeded demo row as the FK parent.
-- ============================================================================

-- service_role (the sole writer): CAN insert + update (the upsert) AND delete (Story-3.6 delete-missing).
-- The DELETE succeeding is the distinctive contrast with demo (whose write-once ceiling 42501s DELETE).
set local role service_role;
select lives_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id, kills, deaths, rounds_played)
       values (990, '76561197960287950', (select id from demo where storage_key = 'demos/990/seed.dem'), 20, 14, 24) $$,
  'service_role inserts a stat_row (grant + BYPASSRLS) — the single-writer parse path');
select lives_ok(
  $$ update stat_row set kills = 21 where match_id = 990 and steamid64 = '76561197960287950' $$,
  'service_role UPDATEs a stat_row (the ON CONFLICT DO UPDATE re-parse half — UPDATE grant is genuinely usable)');
select lives_ok(
  $$ delete from stat_row where match_id = 990 and steamid64 = '76561197960287950' $$,
  'service_role DELETEs a stat_row (Story-3.6 delete-missing — DELETE grant genuinely usable, unlike demo)');
set local role postgres;

-- authenticated viewer: no grant of any kind -> cannot read (admin-only) and cannot write (fail closed).
-- The insert uses a literal demo_id so it fails at the stat_row GRANT gate, not on a demo read.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select throws_ok($$ select count(*) from stat_row $$,
  '42501', null, 'authenticated viewer CANNOT read stat_row (no grant, admin-only) — fail closed');
select throws_ok(
  $$ insert into stat_row (match_id, steamid64, demo_id) values (990, '76561197960287999', 1) $$,
  '42501', null, 'authenticated viewer CANNOT insert stat_row (no write grant/policy) — fail closed');
set local role postgres;

-- authenticated ADMIN: stat_admin is DORMANT by design. No base SELECT grant to authenticated, so even a
-- valid admin claim 42501s at the grant gate BEFORE RLS is consulted (is_admin() never reached). Admins
-- read stat_row via server routes with the service key; Story 3.5 adds the LIVE viewer surface.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select throws_ok($$ select count(*) from stat_row $$,
  '42501', null, 'authenticated ADMIN also CANNOT read stat_row via Data API — stat_admin dormant (no base grant until Story 3.5)');
set local role postgres;

-- anon (unauthenticated public): no grant -> cannot read the admin/worker-only stat table (yet).
set local role anon;
select throws_ok($$ select count(*) from stat_row $$,
  '42501', null, 'anon CANNOT read stat_row — fail closed (Story 3.5 adds the approved-only viewer surface)');
set local role postgres;

select * from finish();

rollback;
