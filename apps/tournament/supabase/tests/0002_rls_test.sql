-- supabase/tests/0002_rls_test.sql
-- pgTAP proof for migration 0002 (Story 1.3): fail-closed RLS framework + helper functions.
-- Proves the framework BITES (not merely that it exists) across all five ACs. Run via: supabase test db
--   AC #1 FORCE RLS on every table              -> Section A (structural) + Section D (behavioral)
--   AC #2 two-policy, never-OR'd (realized here) -> Section B (exact policy set per table)
--   AC #3 is_admin()/jwt_steamid64() fail-closed -> Section C (claim matrix + STABLE)
--   AC #4 no client writes; service-role bypass  -> Section B (no write policy) + Section D
--   AC #5 the framework provably bites           -> Sections A–D together
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they see every
-- row regardless of policy. RLS only bites for anon/authenticated, so behavioral tests SET LOCAL ROLE
-- to those and SET LOCAL ROLE postgres back between blocks (so pgTAP's own bookkeeping runs privileged).
-- SQLSTATE 42501 = insufficient_privilege (no base GRANT and/or no permissive policy → fail closed).

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/throws_ok()/lives_ok()/policies_are() resolve unqualified, alongside our public tables.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(48);  -- 39 original + 9 from 2026-07-01 code-review patches (P1 dormancy, P2 helper matrix, P3 write-denial cells)

-- Seed a minimal, deterministic fixture as postgres (BYPASSRLS) before any role switch.
insert into player (steamid64, display_name)
  values ('76561197960287930', 'AdminPlayer'), ('76561197960287931', 'ViewerPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T1');

-- ============================================================================
-- Section A — FORCE RLS is ON for every table that exists at 0002 (AC #1)
-- relrowsecurity = ENABLE; relforcerowsecurity = FORCE (applies to the table owner too).
-- ============================================================================
select is((select relrowsecurity      from pg_class where oid = 'public.season'::regclass),     true, 'season: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.season'::regclass),     true, 'season: ROW LEVEL SECURITY is FORCED');
select is((select relrowsecurity      from pg_class where oid = 'public.tournament'::regclass), true, 'tournament: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.tournament'::regclass), true, 'tournament: ROW LEVEL SECURITY is FORCED');
select is((select relrowsecurity      from pg_class where oid = 'public.player'::regclass),     true, 'player: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.player'::regclass),     true, 'player: ROW LEVEL SECURITY is FORCED');
select is((select relrowsecurity      from pg_class where oid = 'public.app_role'::regclass),   true, 'app_role: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity  from pg_class where oid = 'public.app_role'::regclass),   true, 'app_role: ROW LEVEL SECURITY is FORCED');

-- ============================================================================
-- Section B — exact policy set per table (AC #2 realized here, AC #4 no write policy)
-- policies_are asserts the COMPLETE set: any stray write policy would fail these.
-- ============================================================================
select policies_are('public', 'season',     ARRAY['season_read'],        'season: exactly one policy (viewer read); no write policy');
select policies_are('public', 'tournament', ARRAY['tournament_read'],     'tournament: exactly one policy (viewer read); no write policy');
select policies_are('public', 'player',     ARRAY['player_read'],         'player: exactly one policy (viewer read); no write policy');
select policies_are('public', 'app_role',   ARRAY['app_role_admin_read'], 'app_role: exactly one policy (admin read); no viewer/write policy');
select policy_cmd_is('public', 'season',     'season_read',        'SELECT', 'season_read is a SELECT-only policy');
select policy_cmd_is('public', 'tournament', 'tournament_read',    'SELECT', 'tournament_read is a SELECT-only policy');
select policy_cmd_is('public', 'player',     'player_read',        'SELECT', 'player_read is a SELECT-only policy');
select policy_cmd_is('public', 'app_role',   'app_role_admin_read', 'SELECT', 'app_role_admin_read is a SELECT-only policy');

-- ============================================================================
-- Section C — helper functions, fail-closed claim matrix (AC #3)
-- auth.jwt() reads current_setting('request.jwt.claims'); is_admin() must be EXACTLY
-- coalesce(role = 'admin', false) — false on every non-admin / missing / malformed input.
-- ============================================================================
set local request.jwt.claims = '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}';
select is(public.is_admin(),       true,                 'admin claim -> is_admin() true');
select is(public.jwt_steamid64(),  '76561197960287930',  'admin claim -> jwt_steamid64() returns the steamid64');

set local request.jwt.claims = '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}';
select is(public.is_admin(), false, 'viewer claim -> is_admin() false');

set local request.jwt.claims = '{"app_metadata":{}}';
select is(public.is_admin(), false, 'app_metadata present but no role -> is_admin() false');

set local request.jwt.claims = '{}';
select is(public.is_admin(),      false, 'no app_metadata -> is_admin() false');
select is(public.jwt_steamid64(), null,  'no app_metadata -> jwt_steamid64() null');

set local request.jwt.claims = '';
select is(public.is_admin(), false, 'empty/unset claims -> is_admin() false (the fail-closed default)');

set local request.jwt.claims = '{"app_metadata":{"role":"Admin"}}';
select is(public.is_admin(), false, 'wrong-case role "Admin" -> is_admin() false (exact match, not case-folded)');

-- jwt_steamid64() across non-admin / malformed claims (role-independent: returns the id when
-- present, else null — fail-closed). Complements the admin+missing cases above (AC #3).
set local request.jwt.claims = '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}';
select is(public.jwt_steamid64(), '76561197960287931', 'viewer claim -> jwt_steamid64() returns the steamid64 (role-independent)');
set local request.jwt.claims = '{"app_metadata":{"role":"viewer"}}';
select is(public.jwt_steamid64(), null, 'app_metadata present but no steamid64 -> jwt_steamid64() null');
set local request.jwt.claims = '';
select is(public.jwt_steamid64(), null, 'empty/unset claims -> jwt_steamid64() null (fail-closed)');

-- is_admin() stays false on malformed app_metadata: a non-object app_metadata and a non-string role
-- both yield null/coerced-text via ->/->>, so coalesce(... = 'admin', false) is false (fail-closed).
set local request.jwt.claims = '{"app_metadata":"admin"}';
select is(public.is_admin(), false, 'non-object app_metadata (scalar "admin") -> is_admin() false');
set local request.jwt.claims = '{"app_metadata":{"role":123}}';
select is(public.is_admin(), false, 'non-string role (123) -> is_admin() false');

-- Structural: both helpers are STABLE (depend on the request JWT, constant within a statement)
-- and pin search_path (defense-in-depth for use inside RLS policies).
select is((select provolatile::text from pg_proc where oid = 'public.is_admin()'::regprocedure),      's', 'is_admin() is STABLE');
select is((select provolatile::text from pg_proc where oid = 'public.jwt_steamid64()'::regprocedure), 's', 'jwt_steamid64() is STABLE');
select ok((select proconfig::text like '%search_path=%' from pg_proc where oid = 'public.is_admin()'::regprocedure),      'is_admin() pins search_path');
select ok((select proconfig::text like '%search_path=%' from pg_proc where oid = 'public.jwt_steamid64()'::regprocedure), 'jwt_steamid64() pins search_path');

-- ============================================================================
-- Section D — behavioral RLS: the money tests (AC #1, #4, #5)
-- ============================================================================

-- service_role bypasses RLS (BYPASSRLS) and holds the DML grants -> full read/write.
set local role service_role;
select is((select count(*)::int from app_role), 1, 'service_role reads app_role (BYPASSRLS + grant) — the intended writer/reader');
select lives_ok(
  $$ insert into player (steamid64, display_name) values ('76561197960287888', 'SvcWrite') $$,
  'service_role inserts player (grant + BYPASSRLS) — the single-writer path'
);
set local role postgres;

-- authenticated viewer: reads reference data, but NOT app_role, and cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select is((select count(*)::int from player),     3, 'authenticated viewer reads player (2 seeded + 1 service insert)');
select is((select count(*)::int from season),     1, 'authenticated viewer reads season');
select is((select count(*)::int from tournament), 1, 'authenticated viewer reads tournament');
select throws_ok($$ select count(*) from app_role $$,
  '42501', null, 'authenticated viewer CANNOT read app_role (no grant + no viewer policy) — fail closed');
select throws_ok($$ insert into player (steamid64, display_name) values ('76561197960287777', 'Nope') $$,
  '42501', null, 'authenticated viewer CANNOT insert player (no write grant/policy) — fail closed');
select throws_ok($$ update player set display_name = 'Hacked' where steamid64 = '76561197960287930' $$,
  '42501', null, 'authenticated viewer CANNOT update player — fail closed');
select throws_ok($$ delete from player where steamid64 = '76561197960287930' $$,
  '42501', null, 'authenticated viewer CANNOT delete player — fail closed');
-- write-denial also holds on the other reference tables (not just player): AC #4 across more cells.
select throws_ok($$ insert into season (name) values ('ViewerNope') $$,
  '42501', null, 'authenticated viewer CANNOT insert season — fail closed');
select throws_ok($$ insert into tournament (season_id, name) values ((select id from season where name = 'Season 1'), 'ViewerNope') $$,
  '42501', null, 'authenticated viewer CANNOT insert tournament — fail closed');
set local role postgres;

-- authenticated ADMIN: app_role_admin_read is DORMANT by design. app_role has no base SELECT grant
-- to authenticated, so even a valid admin claim 42501s at the table-grant gate BEFORE RLS is consulted
-- — the policy's is_admin() USING clause is never reached. Admins read app_role via server routes with
-- the service key (Epic 2/4), never the client Data API. Asserting this documents the dormancy so a
-- future grant that accidentally activates the policy is a conscious, caught change.
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select throws_ok($$ select count(*) from app_role $$,
  '42501', null, 'authenticated ADMIN also CANNOT read app_role via Data API — app_role_admin_read dormant (no base grant)');
set local role postgres;

-- anon (unauthenticated public): reads reference data, but NOT app_role.
set local role anon;
select is((select count(*)::int from player), 3, 'anon reads player (public viewer surface)');
select throws_ok($$ select count(*) from app_role $$,
  '42501', null, 'anon CANNOT read app_role — fail closed');
select throws_ok($$ insert into player (steamid64, display_name) values ('76561197960287666', 'AnonNope') $$,
  '42501', null, 'anon CANNOT insert player — fail closed');
set local role postgres;

select * from finish();

rollback;
