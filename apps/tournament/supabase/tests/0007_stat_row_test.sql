-- supabase/tests/0007_stat_row_test.sql
-- pgTAP proof for migration 0007 (Story 3.3): the `stat_row` derived-stats table (the Parsing node).
-- Proves the stat_row slice BITES (not merely that it exists) across AC1/AC3/AC4. Run via: supabase test db
--   AC4 table + FULL column set (stat columns nullable) + status default + the CHECKs               -> Section B
--   AC3 UNIQUE(matchzy_match_id, steamid64) = the re-parse idempotency key                                    -> Section B (col_is_unique + behavioral 23505)
--   AC4 demo_id NOT NULL + FK -> demo; matchzy_match_id NOT NULL and NO FK (it is the EXTERNAL ingest id) -> Section B
--   AC1/AC4 stat_admin SELECT policy + FORCE RLS; the policy set is {stat_admin, stat_view} post-0009      -> Section A + C
--   AC1 single-writer: service_role select/insert/update/DELETE; anon/authenticated SELECT-only (no write) -> Section C + D
-- Runs inside a transaction and rolls back — no data persists.
--
-- NOTE (post-Story-3.5): this file runs against the fully-migrated (0001→0009) schema, so it reflects the
-- world AFTER 0009 added the viewer model: the policy set is now {stat_admin, stat_view} and anon/
-- authenticated hold a SELECT grant. This suite proves the TABLE STRUCTURE + the SINGLE-WRITER grant
-- (service_role writes; anon/authenticated cannot write); the row-level VISIBILITY teeth (viewer sees
-- approved-only, admin sees pending too) are owned by supabase/tests/0009_stat_pending_visibility_test.sql.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they insert
-- regardless of policy. The single-writer teeth bite at the GRANT gate, not RLS: service_role holds
-- SELECT+INSERT+UPDATE+DELETE (DELETE is granted here — UNLIKE demo — for the Story-3.6 re-parse
-- delete-missing path); anon/authenticated hold only SELECT (0009) and NO write grant -> every write fails
-- closed (the single-writer invariant is unchanged). `stat_row.matchzy_match_id` is a plain bigint with NO FK (match does not exist
-- yet); `stat_row.demo_id` IS a FK to demo, so this test seeds ONE demo row as the FK parent.
-- SQLSTATE: 23514 check, 23502 not-null, 23503 fk, 23505 unique, 42501 insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/has_table()/col_is_unique()/policies_are()/policy_cmd_is() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(33);

-- Seed the single FK parent as postgres (BYPASSRLS) before any role switch: stat_row.demo_id -> demo(id).
-- demo.matchzy_match_id has no FK (match does not exist), so this seed needs no match/season fixture.
insert into demo (matchzy_match_id, storage_key, source) values (990, 'demos/990/seed.dem', 'matchzy');

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
-- constraints fire regardless of RLS. Minimal valid insert is (matchzy_match_id, steamid64, demo_id).
-- ============================================================================
-- Happy path: a minimal valid parsed row is accepted (and proves the table + FK resolve).
select lives_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id)
       values (990, '76561197960287930', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  'stat_row: a valid (matchzy_match_id, steamid64, demo_id) parsed row is accepted'
);
-- Defaults + nullable shells land as specified.
select is((select status  from stat_row where matchzy_match_id = 990 and steamid64 = '76561197960287930'), 'pending', 'stat_row: status defaults to pending (3.3 writes pending; approve is Story 3.5/4.6)');
select is((select idle_dq from stat_row where matchzy_match_id = 990 and steamid64 = '76561197960287930'), false,     'stat_row: idle_dq defaults to false (Epic-5 AFK/idle shell)');
select is((select kills   from stat_row where matchzy_match_id = 990 and steamid64 = '76561197960287930'), null,      'stat_row: kills is a NULL shell on a minimal row (the parser fills it; Epic-5 stat columns stay NULL)');
-- steamid64 CHECK: a non-17-digit id is rejected (AD-4 canonical-key discipline).
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id)
       values (990, '123', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23514', null, 'stat_row: a non-17-digit steamid64 is rejected by the CHECK (~ ^[0-9]{17}$)');
-- status closed-set CHECK bites on an out-of-set value.
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id, status)
       values (990, '76561197960287931', (select id from demo where storage_key = 'demos/990/seed.dem'), 'foo') $$,
  '23514', null, 'stat_row: status=foo is rejected by the closed-set CHECK (only pending/approved)');
-- demo_id NOT NULL + FK -> demo.
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64) values (990, '76561197960287932') $$,
  '23502', null, 'stat_row: a null demo_id is rejected by NOT NULL (every row carries its parse provenance)');
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id) values (990, '76561197960287932', 999999) $$,
  '23503', null, 'stat_row: a demo_id with no demo row is rejected by the FK -> demo(id)');
-- matchzy_match_id is the EXTERNAL ingest id: NOT NULL, and deliberately carries NO FK to `match`. It
-- names a MatchZy game-server matchid, never a bracket node, so an arbitrary value MUST still insert —
-- that is the whole reason migration 0010 renamed it instead of FK-ing it (FK-ing this column would
-- 23503 every demo ingest and every parse). The real `stat_row.match_id -> match(id)` FK lives on a
-- SEPARATE nullable column added by 0010, and is proven to bite in 0010's suite.
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id)
       values (null, '76561197960287932', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23502', null, 'stat_row: a null matchzy_match_id is rejected by NOT NULL');
select lives_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id)
       values (888888, '76561197960287933', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  'stat_row: an arbitrary matchzy_match_id (an external MatchZy id, naming no bracket match) still inserts — it carries no FK, by design');
-- UNIQUE(matchzy_match_id, steamid64): a duplicate pair is the AD-3 re-parse key (worker upserts via ON CONFLICT).
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id) values
       (777, '76561197960287944', (select id from demo where storage_key = 'demos/990/seed.dem')),
       (777, '76561197960287944', (select id from demo where storage_key = 'demos/990/seed.dem')) $$,
  '23505', null, 'stat_row: a duplicate (matchzy_match_id, steamid64) is rejected by UNIQUE — the AD-3 re-parse idempotency key');
select col_is_unique('public'::name, 'stat_row'::name, ARRAY['matchzy_match_id','steamid64']::name[],
  'stat_row: UNIQUE(matchzy_match_id, steamid64) exists on exactly those columns (the ON CONFLICT target)');

-- ============================================================================
-- Section C — exact policy set + grants (AC1/AC4). policies_are asserts the COMPLETE set.
-- ============================================================================
select policies_are(
  'public', 'stat_row',
  ARRAY['stat_admin','stat_view'],
  'stat_row: exactly two SELECT policies (stat_admin from 0007 + stat_view added by 0009); no write policy'
);
select policy_cmd_is('public', 'stat_row', 'stat_admin', 'SELECT', 'stat_admin is a SELECT-only policy');

-- Grants (has_table_privilege reads the grant, not RLS). service_role: SELECT/INSERT/UPDATE AND DELETE
-- (DELETE is the distinctive proof — granted here for Story-3.6 re-parse delete-missing, unlike demo);
-- anon/authenticated: SELECT only (granted by 0009's viewer model); still NO write grant (single-writer).
select is(has_table_privilege('service_role',  'public.stat_row', 'SELECT'), true,  'service_role CAN SELECT stat_row');
select is(has_table_privilege('service_role',  'public.stat_row', 'INSERT'), true,  'service_role CAN INSERT stat_row (parse upsert — insert half)');
select is(has_table_privilege('service_role',  'public.stat_row', 'UPDATE'), true,  'service_role CAN UPDATE stat_row (parse upsert — ON CONFLICT DO UPDATE half)');
select is(has_table_privilege('service_role',  'public.stat_row', 'DELETE'), true,  'service_role CAN DELETE stat_row (Story-3.6 re-parse delete-missing — DELETE IS granted, unlike demo)');
select is(has_table_privilege('anon',          'public.stat_row', 'SELECT'), true,  'anon HAS the SELECT grant on stat_row (granted by 0009''s viewer model; RLS stat_view then filters to approved-only)');
select is(has_table_privilege('anon',          'public.stat_row', 'INSERT'), false, 'anon CANNOT INSERT stat_row (single-writer — fail closed)');
select is(has_table_privilege('anon',          'public.stat_row', 'UPDATE'), false, 'anon CANNOT UPDATE stat_row (fail closed)');
select is(has_table_privilege('anon',          'public.stat_row', 'DELETE'), false, 'anon CANNOT DELETE stat_row (fail closed)');
select is(has_table_privilege('authenticated', 'public.stat_row', 'SELECT'), true,  'authenticated HAS the SELECT grant on stat_row (granted by 0009''s viewer model; stat_view/stat_admin then govern which rows)');
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
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played)
       values (990, '76561197960287950', (select id from demo where storage_key = 'demos/990/seed.dem'), 20, 14, 24) $$,
  'service_role inserts a stat_row (grant + BYPASSRLS) — the single-writer parse path');
select lives_ok(
  $$ update stat_row set kills = 21 where matchzy_match_id = 990 and steamid64 = '76561197960287950' $$,
  'service_role UPDATEs a stat_row (the ON CONFLICT DO UPDATE re-parse half — UPDATE grant is genuinely usable)');
select lives_ok(
  $$ delete from stat_row where matchzy_match_id = 990 and steamid64 = '76561197960287950' $$,
  'service_role DELETEs a stat_row (Story-3.6 delete-missing — DELETE grant genuinely usable, unlike demo)');
set local role postgres;

-- authenticated viewer: SELECT is now granted (0009), but no WRITE grant/policy -> writes still fail closed.
-- The row-level READ visibility (anon/authenticated viewer see approved-only; admin sees pending too) is
-- the AD-7 viewer model 0009 introduces — proven behaviorally in supabase/tests/0009_stat_pending_visibility_test.sql.
-- The insert uses a literal demo_id so it fails at the stat_row INSERT-grant gate, not on a demo read.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, steamid64, demo_id) values (990, '76561197960287999', 1) $$,
  '42501', null, 'authenticated viewer CANNOT insert stat_row (SELECT granted by 0009 but NO write grant/policy) — writes still fail closed');
set local role postgres;

select * from finish();

rollback;
