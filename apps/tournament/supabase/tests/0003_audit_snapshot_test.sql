-- supabase/tests/0003_audit_snapshot_test.sql
-- pgTAP proof for migration 0003 (Story 1.4): append-only audit_log + write-once snapshot substrate.
-- Proves the append-only convention BITES (not merely that it exists) across all four ACs. Run via: supabase test db
--   AC #1 append-only by construction (INSERT-not-UPDATE/DELETE grant) -> Section C (grants) + Section D (behavioral)
--   AC #2 ENABLE+FORCE, admin-only SELECT, no write/viewer policy       -> Section A + Section B + Section D
--   AC #3 clean apply of the full substrate set                         -> the migration applying at all (db reset) + Section A
--   AC #4 convention generalized + provably bites (catalog FORCE-guard) -> Section A2 + Sections C/D
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they see/insert
-- regardless of policy. Append-only bites at the GRANT gate, not RLS: service_role holds SELECT+INSERT
-- but NOT UPDATE/DELETE, so its UPDATE/DELETE 42501s. anon/authenticated hold ZERO grants -> every read
-- and write fails closed. SET LOCAL ROLE switches identity; SET LOCAL ROLE postgres back between blocks
-- (so pgTAP's own bookkeeping runs privileged). SQLSTATE 42501 = insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/policies_are()/policy_cmd_is() resolve unqualified,
-- alongside our public tables.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(38);

-- Seed a minimal, deterministic fixture as postgres (BYPASSRLS) before any role switch.
-- audit_log.tournament_id + stat_snapshot.tournament_id -> tournament; audit_log.actor_steamid64 -> player.
-- Seed one stat_snapshot so the service_role stat_snapshot_row insert (Section D) has a valid FK parent.
insert into player (steamid64, display_name)
  values ('76561197960287930', 'AdminPlayer'), ('76561197960287931', 'ViewerPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T1');
insert into stat_snapshot (tournament_id, content_sha256)
  values ((select id from tournament where name = 'T1'), 'seedsha');

-- ============================================================================
-- Section A — ENABLE + FORCE RLS on all three append-only tables (AC #2)
-- relrowsecurity = ENABLE; relforcerowsecurity = FORCE (applies to the table owner too).
-- ============================================================================
select is((select relrowsecurity      from pg_class where oid = 'public.audit_log'::regclass),         true, 'audit_log: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.audit_log'::regclass),         true, 'audit_log: ROW LEVEL SECURITY is FORCED');
select is((select relrowsecurity      from pg_class where oid = 'public.stat_snapshot'::regclass),     true, 'stat_snapshot: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.stat_snapshot'::regclass),     true, 'stat_snapshot: ROW LEVEL SECURITY is FORCED');
select is((select relrowsecurity      from pg_class where oid = 'public.stat_snapshot_row'::regclass), true, 'stat_snapshot_row: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.stat_snapshot_row'::regclass), true, 'stat_snapshot_row: ROW LEVEL SECURITY is FORCED');

-- ============================================================================
-- Section A2 — generic catalog FORCE-guard (AC #4; the deferred Story 1.3 item, homed here)
-- No base table in public may have FORCE off. Covers all seven tables that exist after 0003 and
-- fails loudly if ANY future migration adds a table and forgets `force row level security`.
-- ============================================================================
select is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity = false),
  0,
  'every public base table FORCEs RLS (generic catalog guard — a future table that forgets FORCE fails here)'
);

-- ============================================================================
-- Section B — exact policy set per table (AC #2: admin-only SELECT, NO write policy)
-- policies_are asserts the COMPLETE set: any stray write/viewer policy would fail these.
-- ============================================================================
select policies_are('public', 'audit_log',         ARRAY['audit_admin_read'],    'audit_log: exactly one policy (admin read); no write/viewer policy');
select policies_are('public', 'stat_snapshot',     ARRAY['snapshot_admin_read'], 'stat_snapshot: exactly one policy (admin read); no write/viewer policy');
select policies_are('public', 'stat_snapshot_row', ARRAY['snaprow_admin_read'],  'stat_snapshot_row: exactly one policy (admin read); no write/viewer policy');
select policy_cmd_is('public', 'audit_log',         'audit_admin_read',    'SELECT', 'audit_admin_read is a SELECT-only policy');
select policy_cmd_is('public', 'stat_snapshot',     'snapshot_admin_read', 'SELECT', 'snapshot_admin_read is a SELECT-only policy');
select policy_cmd_is('public', 'stat_snapshot_row', 'snaprow_admin_read',  'SELECT', 'snaprow_admin_read is a SELECT-only policy');

-- ============================================================================
-- Section C — append-only at the GRANT layer (AC #1, #4) — the distinctive proof
-- service_role may INSERT but NOT UPDATE/DELETE (append-only ceiling for the privileged writer);
-- authenticated has NO SELECT grant (admin-only). has_table_privilege reads the grant, not RLS.
-- ============================================================================
select is(has_table_privilege('service_role', 'public.audit_log',         'INSERT'), true,  'service_role CAN INSERT audit_log');
select is(has_table_privilege('service_role', 'public.audit_log',         'UPDATE'), false, 'service_role CANNOT UPDATE audit_log (append-only)');
select is(has_table_privilege('service_role', 'public.audit_log',         'DELETE'), false, 'service_role CANNOT DELETE audit_log (append-only)');
select is(has_table_privilege('service_role', 'public.stat_snapshot',     'INSERT'), true,  'service_role CAN INSERT stat_snapshot');
select is(has_table_privilege('service_role', 'public.stat_snapshot',     'UPDATE'), false, 'service_role CANNOT UPDATE stat_snapshot (append-only)');
select is(has_table_privilege('service_role', 'public.stat_snapshot',     'DELETE'), false, 'service_role CANNOT DELETE stat_snapshot (append-only)');
select is(has_table_privilege('service_role', 'public.stat_snapshot_row', 'INSERT'), true,  'service_role CAN INSERT stat_snapshot_row');
select is(has_table_privilege('service_role', 'public.stat_snapshot_row', 'UPDATE'), false, 'service_role CANNOT UPDATE stat_snapshot_row (append-only)');
select is(has_table_privilege('service_role', 'public.stat_snapshot_row', 'DELETE'), false, 'service_role CANNOT DELETE stat_snapshot_row (append-only)');
select is(has_table_privilege('authenticated', 'public.audit_log',         'SELECT'), false, 'authenticated has NO SELECT grant on audit_log (admin-only)');
select is(has_table_privilege('authenticated', 'public.stat_snapshot',     'SELECT'), false, 'authenticated has NO SELECT grant on stat_snapshot (admin-only)');
select is(has_table_privilege('authenticated', 'public.stat_snapshot_row', 'SELECT'), false, 'authenticated has NO SELECT grant on stat_snapshot_row (admin-only)');

-- ============================================================================
-- Section D — behavioral: the money tests (AC #1, #2)
-- ============================================================================

-- service_role (sole writer): CAN insert all three; CANNOT update/delete (append-only 42501 at grant gate).
set local role service_role;
select lives_ok(
  $$ insert into audit_log (tournament_id, actor_steamid64, action)
       values ((select id from tournament where name = 'T1'), '76561197960287930', 'generate_bracket') $$,
  'service_role inserts audit_log (grant + BYPASSRLS) — the single-writer append path'
);
select lives_ok(
  $$ insert into stat_snapshot (tournament_id, content_sha256)
       values ((select id from tournament where name = 'T1'), 'svcsha') $$,
  'service_role inserts stat_snapshot (grant + BYPASSRLS)'
);
select lives_ok(
  $$ insert into stat_snapshot_row (snapshot_id, steamid64, stats_int)
       values ((select id from stat_snapshot where content_sha256 = 'seedsha'), '76561197960287930', '{}'::jsonb) $$,
  'service_role inserts stat_snapshot_row (grant + BYPASSRLS)'
);
select throws_ok(
  $$ update audit_log set action = 'tampered' where tournament_id is not null $$,
  '42501', null, 'service_role CANNOT UPDATE audit_log — append-only bites even for the writer');
select throws_ok(
  $$ delete from audit_log where tournament_id is not null $$,
  '42501', null, 'service_role CANNOT DELETE audit_log — append-only bites even for the writer');
select throws_ok(
  $$ update stat_snapshot_row set kills = 999 where snapshot_id is not null $$,
  '42501', null, 'service_role CANNOT UPDATE stat_snapshot_row — snapshot rows are write-once');
select throws_ok(
  $$ delete from stat_snapshot where id is not null $$,
  '42501', null, 'service_role CANNOT DELETE stat_snapshot — snapshot header is write-once');
set local role postgres;

-- authenticated viewer: no grant of any kind -> cannot read (admin-only) and cannot write (fail closed).
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select throws_ok($$ select count(*) from audit_log $$,
  '42501', null, 'authenticated viewer CANNOT read audit_log (no grant, admin-only) — fail closed');
select throws_ok($$ select count(*) from stat_snapshot $$,
  '42501', null, 'authenticated viewer CANNOT read stat_snapshot (no grant, admin-only) — fail closed');
select throws_ok($$ select count(*) from stat_snapshot_row $$,
  '42501', null, 'authenticated viewer CANNOT read stat_snapshot_row (no grant, admin-only) — fail closed');
select throws_ok(
  $$ insert into audit_log (tournament_id, actor_steamid64, action)
       values ((select id from tournament where name = 'T1'), '76561197960287931', 'grant_role') $$,
  '42501', null, 'authenticated viewer CANNOT insert audit_log (no write grant/policy) — fail closed');
set local role postgres;

-- authenticated ADMIN: admin_read policies are DORMANT by design. No base SELECT grant to authenticated,
-- so even a valid admin claim 42501s at the grant gate BEFORE RLS is consulted (is_admin() never reached).
-- Admins read audit/snapshot via server routes with the service key (Epic 4/6). Documents the dormancy.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select throws_ok($$ select count(*) from audit_log $$,
  '42501', null, 'authenticated ADMIN also CANNOT read audit_log via Data API — audit_admin_read dormant (no base grant)');
set local role postgres;

-- anon (unauthenticated public): no grant -> cannot read the admin-only trail.
set local role anon;
select throws_ok($$ select count(*) from audit_log $$,
  '42501', null, 'anon CANNOT read audit_log — fail closed');
set local role postgres;

select * from finish();

rollback;
