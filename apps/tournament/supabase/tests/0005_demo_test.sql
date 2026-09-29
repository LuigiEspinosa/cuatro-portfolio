-- supabase/tests/0005_demo_test.sql
-- pgTAP proof for migration 0005 (Story 3.1): the `demo` acquisition table (the Acquiring node).
-- Proves the demo slice BITES (not merely that it exists) across AC4/AC6/AC7. Run via: supabase test db
--   AC6 table columns + shells (sha256/parser_version nullable) + the three CHECKs             -> Section B
--   AC6 admin-only read policy (dormant, mirrors audit_log) + FORCE RLS                          -> Section A + C
--   AC7 single-writer: service_role select/insert/update, NO delete; anon/authenticated no priv  -> Section C + D
--   AC6 UNIQUE(matchzy_match_id, demo_sha256) is NOT added yet (deferred to Story 3.2)                    -> Section B (behavioral)
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they insert
-- regardless of policy. The single-writer teeth bite at the GRANT gate, not RLS: service_role holds
-- SELECT+INSERT+UPDATE but NOT DELETE (write-once ceiling) -> its DELETE 42501s. anon/authenticated hold
-- ZERO grants -> every read and write fails closed (demo is admin/worker-only, like audit_log — the
-- admin_read policy is DORMANT because there is no base grant to reach it). `demo.matchzy_match_id` is the
-- EXTERNAL ingest id (MatchZy's game-server matchid / the CLI's --match) and deliberately carries NO FK —
-- it names no bracket node and never did. The real `demo.match_id -> match(id)` FK is added by migration
-- 0010 on a SEPARATE nullable column (NULL until Story 4.6 binds it), and is proven in 0010's suite. So
-- this test still needs NO match fixture rows.
-- SQLSTATE: 23514 check, 23502 not-null, 23505 unique, 42501 insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/policies_are()/policy_cmd_is() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(38);

-- ============================================================================
-- Section A — ENABLE + FORCE RLS on demo (AC6/AC7)
-- relrowsecurity = ENABLE; relforcerowsecurity = FORCE (applies to the table owner too).
-- (The generic catalog FORCE-guard in the 0003 test also covers this table now.)
-- ============================================================================
select is((select relrowsecurity     from pg_class where oid = 'public.demo'::regclass), true, 'demo: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.demo'::regclass), true, 'demo: ROW LEVEL SECURITY is FORCED');

-- ============================================================================
-- Section B — columns, shells, defaults, CHECKs, NOT NULLs (AC6). Run as postgres; constraints
-- fire regardless of RLS. Minimal valid insert is (matchzy_match_id, storage_key, source).
-- ============================================================================
-- Happy path: a minimal valid acquisition row is accepted.
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (1, 'demos/1/aaa.dem', 'matchzy') $$,
  'demo: a valid (matchzy_match_id, storage_key, source) acquisition row is accepted'
);
-- Defaults land as specified.
select is((select storage_backend  from demo where storage_key = 'demos/1/aaa.dem'), 'r2',            'demo: storage_backend defaults to r2');
select is((select retention_class  from demo where storage_key = 'demos/1/aaa.dem'), 'event_archive', 'demo: retention_class defaults to event_archive');
select is((select parse_generation from demo where storage_key = 'demos/1/aaa.dem'), 1,               'demo: parse_generation defaults to 1');
-- The two shells are NULL on an acquisition row (Story 3.2 sets sha256; Story 3.3 sets parser_version).
select is((select demo_sha256    from demo where storage_key = 'demos/1/aaa.dem'), null, 'demo: demo_sha256 is a NULL shell at acquisition (Story 3.2 backfills it)');
select is((select parser_version from demo where storage_key = 'demos/1/aaa.dem'), null, 'demo: parser_version is a NULL shell at acquisition (Story 3.3 backfills it)');
-- The three CHECK constraints reject out-of-set values.
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (1, 'demos/1/bad.dem', 'foo') $$,
  '23514', null, 'demo: source=foo is rejected by the closed-set CHECK');
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, storage_backend) values (1, 'demos/1/bad.dem', 'matchzy', 's3') $$,
  '23514', null, 'demo: storage_backend=s3 is rejected by the closed-set CHECK');
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, retention_class) values (1, 'demos/1/bad.dem', 'matchzy', 'forever') $$,
  '23514', null, 'demo: retention_class=forever is rejected by the closed-set CHECK');
-- …and accept every in-set enum value.
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, storage_backend) values (2, 'demos/2/sb.dem', 'matchzy', 'supabase') $$,
  'demo: storage_backend=supabase is accepted (AD-16 swap-ready backend)');
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, retention_class) values (2, 'demos/2/ps.dem', 'matchzy', 'permanent_seed') $$,
  'demo: retention_class=permanent_seed is accepted');
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (2, 'demos/2/mu.dem', 'manual_upload') $$,
  'demo: source=manual_upload is accepted');
-- NOT NULL on matchzy_match_id and storage_key.
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (null, 'demos/x/n.dem', 'matchzy') $$,
  '23502', null, 'demo: a null matchzy_match_id is rejected by NOT NULL');
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (3, null, 'matchzy') $$,
  '23502', null, 'demo: a null storage_key is rejected by NOT NULL');
-- FLIPPED CANARY (Story 3.2): migration 0006 added UNIQUE(matchzy_match_id, demo_sha256), so two rows sharing
-- (matchzy_match_id, demo_sha256) now 23505. This assertion started life as a `lives_ok` (a canary for premature
-- dedup); it flipped to `throws_ok` the day 0006 landed. NULL-sha256 rows still insert (see Section B
-- above + the 0006 suite) because NULLs are distinct — the manual path is unaffected.
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, demo_sha256) values
       (9, 'demos/9/one.dem', 'matchzy', 'dupsha'),
       (9, 'demos/9/two.dem', 'matchzy', 'dupsha') $$,
  '23505', null,
  'demo: UNIQUE(matchzy_match_id, demo_sha256) now rejects a duplicate (matchzy_match_id, sha256) — Story 3.2');

-- ============================================================================
-- Section C — exact policy set + grants (AC6/AC7). policies_are asserts the COMPLETE set.
-- ============================================================================
select policies_are(
  'public', 'demo',
  ARRAY['demo_admin_read'],
  'demo: exactly one policy (admin read); no viewer policy, no write policy (admin/worker-only, mirrors audit_log)'
);
select policy_cmd_is('public', 'demo', 'demo_admin_read', 'SELECT', 'demo_admin_read is a SELECT-only policy');

-- Grants (has_table_privilege reads the grant, not RLS). service_role: SELECT/INSERT/UPDATE but NOT
-- DELETE (the write-once retention ceiling — the distinctive proof); anon/authenticated: nothing.
select is(has_table_privilege('service_role',  'public.demo', 'SELECT'), true,  'service_role CAN SELECT demo');
select is(has_table_privilege('service_role',  'public.demo', 'INSERT'), true,  'service_role CAN INSERT demo (record acquisition)');
select is(has_table_privilege('service_role',  'public.demo', 'UPDATE'), true,  'service_role CAN UPDATE demo (Story 3.2/3.3 backfill sha256/parser_version + parse_generation bump)');
select is(has_table_privilege('service_role',  'public.demo', 'DELETE'), false, 'service_role CANNOT DELETE demo (write-once retention ceiling — the grant is the teeth)');
select is(has_table_privilege('anon',          'public.demo', 'SELECT'), false, 'anon CANNOT SELECT demo (admin/worker-only)');
select is(has_table_privilege('anon',          'public.demo', 'INSERT'), false, 'anon CANNOT INSERT demo (fail closed)');
select is(has_table_privilege('anon',          'public.demo', 'UPDATE'), false, 'anon CANNOT UPDATE demo (fail closed)');
select is(has_table_privilege('anon',          'public.demo', 'DELETE'), false, 'anon CANNOT DELETE demo (fail closed)');
select is(has_table_privilege('authenticated', 'public.demo', 'SELECT'), false, 'authenticated has NO SELECT grant on demo (admin-only; demo_admin_read is dormant)');
select is(has_table_privilege('authenticated', 'public.demo', 'INSERT'), false, 'authenticated CANNOT INSERT demo (fail closed)');
select is(has_table_privilege('authenticated', 'public.demo', 'UPDATE'), false, 'authenticated CANNOT UPDATE demo (fail closed)');
select is(has_table_privilege('authenticated', 'public.demo', 'DELETE'), false, 'authenticated CANNOT DELETE demo (fail closed)');

-- ============================================================================
-- Section D — behavioral: the money tests (AC6/AC7)
-- ============================================================================

-- service_role (the sole writer): CAN insert + update (the 3.2/3.3 backfill); CANNOT delete (write-once
-- 42501 at the grant gate) — the retention ceiling bites even the privileged writer.
set local role service_role;
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, size_bytes) values (100, 'demos/100/svc.dem', 'matchzy', 170000000) $$,
  'service_role inserts a demo acquisition row (grant + BYPASSRLS) — the single-writer acquire path');
select lives_ok(
  $$ update demo set demo_sha256 = 'backfilled' where storage_key = 'demos/100/svc.dem' $$,
  'service_role UPDATEs demo (the Story 3.2 sha256 backfill — UPDATE grant is genuinely usable)');
select throws_ok(
  $$ delete from demo where storage_key = 'demos/100/svc.dem' $$,
  '42501', null, 'service_role CANNOT DELETE demo — write-once ceiling bites even the writer (no delete grant)');
set local role postgres;

-- authenticated viewer: no grant of any kind -> cannot read (admin-only) and cannot write (fail closed).
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select throws_ok($$ select count(*) from demo $$,
  '42501', null, 'authenticated viewer CANNOT read demo (no grant, admin-only) — fail closed');
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source) values (200, 'demos/200/v.dem', 'manual_upload') $$,
  '42501', null, 'authenticated viewer CANNOT insert demo (no write grant/policy) — fail closed');
set local role postgres;

-- authenticated ADMIN: demo_admin_read is DORMANT by design. No base SELECT grant to authenticated, so
-- even a valid admin claim 42501s at the grant gate BEFORE RLS is consulted (is_admin() never reached).
-- Admins read demo via server routes with the service key (Epic 5 evidence view). Documents the dormancy.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select throws_ok($$ select count(*) from demo $$,
  '42501', null, 'authenticated ADMIN also CANNOT read demo via Data API — demo_admin_read dormant (no base grant)');
set local role postgres;

-- anon (unauthenticated public): no grant -> cannot read the admin/worker-only acquisition table.
set local role anon;
select throws_ok($$ select count(*) from demo $$,
  '42501', null, 'anon CANNOT read demo — fail closed');
set local role postgres;

select * from finish();

rollback;
