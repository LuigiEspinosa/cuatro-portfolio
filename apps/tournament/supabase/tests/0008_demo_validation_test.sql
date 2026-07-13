-- supabase/tests/0008_demo_validation_test.sql
-- pgTAP proof for migration 0008 (Story 3.4): the demo validation-hold columns + the unreconciled_stat_row
-- view (the Validating node). Proves the schema teeth BITE (not merely that they exist) across AC2/AC3/AC4.
-- Run via: supabase test db
--   AC2/AC4 demo.validation_state default/NOT NULL/CHECK + anomaly_reasons/validated_at jsonb+nullable  -> Section A
--   AC2     service_role CAN stamp the anomaly outcome (the worker write path is genuinely usable)       -> Section B
--   AC3/AC4 unreconciled_stat_row row logic (unrostered appears / active does not / removed still appears) -> Section C
--   AC3/AC4 the view grant matrix (service_role SELECT only; anon/authenticated fail closed) + invoker     -> Section D + E
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they read/write
-- regardless of RLS. The teeth bite at the GRANT gate: service_role holds UPDATE on demo (0005 — the
-- worker anomaly-stamp path) and SELECT on the view (0008); anon/authenticated hold NO grant on either the
-- view (admin/worker-only, like stat_row/demo) -> every read fails closed. The view is security_invoker=on,
-- so the caller's grants + BYPASSRLS apply. `demo.matchzy_match_id`/`stat_row.matchzy_match_id` are plain bigints with NO
-- FK (no match table yet); `stat_row.demo_id` IS a FK to demo, and roster_entry.steamid64 is a FK to
-- player, so Section C seeds the player→season→tournament→roster_entry chain + one demo FK parent.
-- SQLSTATE: 23514 check, 23502 not-null, 42501 insufficient_privilege.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/ok()/throws_ok()/lives_ok()/col_is_null() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(28);

-- ============================================================================
-- Section A — the three demo validation columns: default, NOT NULL, CHECK, nullability (AC2/AC4).
-- Run as postgres; constraints fire regardless of RLS.
-- ============================================================================
-- A minimal acquisition row: validation_state defaults, the other two are NULL (parsed, not yet validated).
insert into demo (matchzy_match_id, storage_key, source) values (700, 'demos/val/a.dem', 'matchzy');
select is((select validation_state from demo where storage_key = 'demos/val/a.dem'), 'pending',
  'demo: validation_state defaults to pending (parsed, not yet validated / validated-clean; NOT the held state)');
select ok((select anomaly_reasons from demo where storage_key = 'demos/val/a.dem') is null,
  'demo: anomaly_reasons is NULL on a fresh row (no reasons until a gate fails)');
select ok((select validated_at from demo where storage_key = 'demos/val/a.dem') is null,
  'demo: validated_at is NULL until the worker validates (validated_at IS NULL distinguishes not-yet-validated from validated-clean)');
select col_is_null('public', 'demo', 'anomaly_reasons',
  'demo: anomaly_reasons is NULLABLE (NULL when clean; the jsonb reasons array only when anomalous)');
select col_is_null('public', 'demo', 'validated_at',
  'demo: validated_at is NULLABLE (set to now() at validation time)');
select col_type_is('public', 'demo', 'anomaly_reasons', 'jsonb',
  'demo: anomaly_reasons is jsonb (the machine-readable [{gate,detail}] reasons array)');
select col_type_is('public', 'demo', 'validated_at', 'timestamp with time zone',
  'demo: validated_at is timestamptz (the validation timestamp)');
-- NOT NULL: an explicit null on validation_state is rejected (the column is not-null with a default).
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, validation_state) values (701, 'demos/val/nn.dem', 'matchzy', null) $$,
  '23502', null, 'demo: an explicit null validation_state is rejected by NOT NULL');
-- CHECK: an out-of-set value is rejected; 'anomalous' (the held state) is accepted.
select throws_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, validation_state) values (702, 'demos/val/bad.dem', 'matchzy', 'bogus') $$,
  '23514', null, 'demo: validation_state=bogus is rejected by the closed-set CHECK (only pending/anomalous)');
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source, validation_state) values (703, 'demos/val/anom.dem', 'matchzy', 'anomalous') $$,
  'demo: validation_state=anomalous is accepted (the held state the worker stamps on a gate failure)');

-- ============================================================================
-- Section B — the worker write path is genuinely usable (AC2): service_role stamps the anomaly outcome
-- (validation_state + anomaly_reasons jsonb + validated_at) on the demo row in one UPDATE. NO new grant
-- was added — this proves the 0005 UPDATE grant already covers the new columns.
-- ============================================================================
set local role service_role;
select lives_ok(
  $$ update demo
       set validation_state = 'anomalous',
           anomaly_reasons  = '[{"gate":"conservation","detail":"Σkills=16 Σdeaths=15 delta=1"}]'::jsonb,
           validated_at     = now()
     where storage_key = 'demos/val/a.dem' $$,
  'service_role stamps the anomaly outcome on demo (validation_state + anomaly_reasons + validated_at) — the worker write path, no new grant');
set local role postgres;
select is((select validation_state from demo where storage_key = 'demos/val/a.dem'), 'anomalous',
  'demo: the worker UPDATE set validation_state=anomalous (the hold flag persists)');
select is((select anomaly_reasons #>> '{0,gate}' from demo where storage_key = 'demos/val/a.dem'), 'conservation',
  'demo: anomaly_reasons round-trips as a jsonb array of {gate,detail} (the machine-readable reasons)');
select ok((select validated_at from demo where storage_key = 'demos/val/a.dem') is not null,
  'demo: validated_at is stamped by the worker (now() on validation)');

-- ============================================================================
-- Section C — unreconciled_stat_row row logic (AC3/AC4). Seed the FK chain, then assert the left-join.
-- …930 is on the ACTIVE roster (must NOT appear); …931 is on the roster but 'removed' (must STILL appear —
-- removed ≠ active); …932 has no roster row at all (must appear — the classic unreconciled id).
-- ============================================================================
insert into player (steamid64, display_name)
  values ('76561197960287930', 'ActiveRostered'),
         ('76561197960287931', 'RemovedRostered');
insert into season (name) values ('S1');
insert into tournament (season_id, name) values ((select id from season where name = 'S1'), 'T1');
insert into roster_entry (tournament_id, steamid64, status) values
  ((select id from tournament where name = 'T1'), '76561197960287930', 'active'),
  ((select id from tournament where name = 'T1'), '76561197960287931', 'removed');
insert into demo (matchzy_match_id, storage_key, source) values (555, 'demos/val/view.dem', 'matchzy');
insert into stat_row (matchzy_match_id, steamid64, demo_id) values
  (555, '76561197960287930', (select id from demo where storage_key = 'demos/val/view.dem')),  -- active-rostered
  (555, '76561197960287931', (select id from demo where storage_key = 'demos/val/view.dem')),  -- removed-rostered
  (555, '76561197960287932', (select id from demo where storage_key = 'demos/val/view.dem'));   -- unrostered

select is(
  (select count(*)::int from pg_views where schemaname = 'public' and viewname = 'unreconciled_stat_row'),
  1, 'unreconciled_stat_row: the admin data-surface view exists');
select is((select count(*)::int from unreconciled_stat_row), 2,
  'unreconciled_stat_row: exactly 2 rows unreconciled (removed + unrostered); the active-rostered id is excluded, no dupes');
select is((select count(*)::int from unreconciled_stat_row where steamid64 = '76561197960287932'), 1,
  'unreconciled_stat_row: an id with NO roster entry APPEARS (the classic unreconciled left-join id — AD-4)');
select is((select count(*)::int from unreconciled_stat_row where steamid64 = '76561197960287930'), 0,
  'unreconciled_stat_row: an ACTIVE-rostered id does NOT appear (it reconciles on the active-status join)');
select is((select count(*)::int from unreconciled_stat_row where steamid64 = '76561197960287931'), 1,
  'unreconciled_stat_row: a REMOVED-roster id STILL appears (the join is status=active; removed ≠ active — a soft-removed player is unreconciled)');
select is(
  (select demo_id from unreconciled_stat_row where steamid64 = '76561197960287932'),
  (select id from demo where storage_key = 'demos/val/view.dem'),
  'unreconciled_stat_row: the row exposes demo_id provenance (the parse that produced the orphaned stat)');
select is((select matchzy_match_id from unreconciled_stat_row where steamid64 = '76561197960287932'), 555::bigint,
  'unreconciled_stat_row: the row exposes matchzy_match_id (the admin one-tap reconcile surface: matchzy_match_id + steamid64 + demo_id)');

-- ============================================================================
-- Section D — the view grant matrix (AC3/AC4). service_role SELECT only; anon/authenticated fail closed.
-- has_table_privilege reads the grant (a view is a relation), not RLS.
-- ============================================================================
select is(has_table_privilege('service_role',  'public.unreconciled_stat_row', 'SELECT'), true,
  'service_role CAN SELECT unreconciled_stat_row (admin reads it via a service-role server route)');
select is(has_table_privilege('anon',          'public.unreconciled_stat_row', 'SELECT'), false,
  'anon CANNOT SELECT unreconciled_stat_row (admin/worker-only — NO client Data-API grant, fail closed)');
select is(has_table_privilege('authenticated', 'public.unreconciled_stat_row', 'SELECT'), false,
  'authenticated CANNOT SELECT unreconciled_stat_row (admin/worker-only — the app-surface epic exposes it, not 3.4)');

-- ============================================================================
-- Section E — security_invoker + behavioral fail-closed (AC3/AC4).
-- ============================================================================
-- The view is security_invoker=on so the caller's privileges (not the owner's) govern underlying access —
-- defense-in-depth so a future anon grant still cannot read tables anon lacks. Assert the reloption is set.
select ok(
  (select array_to_string(reloptions, ',') from pg_class where relname = 'unreconciled_stat_row' and relkind = 'v') ~ 'security_invoker=(on|true)',
  'unreconciled_stat_row: created WITH (security_invoker = on) — the caller''s grants/RLS apply');

-- service_role (grant + BYPASSRLS under the invoker) genuinely reads the 2 unreconciled rows.
set local role service_role;
select is((select count(*)::int from unreconciled_stat_row), 2,
  'service_role genuinely reads the unreconciled rows through the view (grant + BYPASSRLS apply under security_invoker)');
set local role postgres;

-- anon/authenticated: no grant on the view -> 42501 at the view grant gate before any underlying read.
set local role anon;
select throws_ok($$ select count(*) from unreconciled_stat_row $$,
  '42501', null, 'anon CANNOT read unreconciled_stat_row — fail closed at the view grant gate');
set local role postgres;

set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"viewer","steamid64":"76561197960287931"}}', true);
select throws_ok($$ select count(*) from unreconciled_stat_row $$,
  '42501', null, 'authenticated CANNOT read unreconciled_stat_row — fail closed (admin/worker-only until an app-surface story)');
set local role postgres;

select * from finish();

rollback;
