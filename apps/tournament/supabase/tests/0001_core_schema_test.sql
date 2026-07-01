-- supabase/tests/0001_core_schema_test.sql
-- pgTAP constraint-proof for migration 0001 (Story 1.2).
-- Proves the CHECK / closed-set / PK / FK constraints actually BITE — not just that
-- the happy path inserts. Run via: supabase test db
-- Evidences AC #1 (SteamID64 canonical key + regex), AC #3 (app_role closed set + PK + FK),
-- AC #4 (constraints in place). Runs inside a transaction and rolls back — no data persists.
--
-- SQLSTATE reference: 23514 = check_violation, 23502 = not_null_violation,
--                     23503 = foreign_key_violation, 23505 = unique_violation.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/lives_ok()/throws_ok()/is() resolve unqualified, alongside our public tables.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(19);

-- ============================================================================
-- player.steamid64 — AD-4 canonical key: text + CHECK (~ '^[0-9]{17}$')
-- ============================================================================
select lives_ok(
  $$ insert into player (steamid64, display_name) values ('76561197960287930', 'ValidPlayer') $$,
  'player: a 17-digit numeric steamid64 is accepted'
);
select throws_ok(
  $$ insert into player (steamid64, display_name) values ('7656119796028793', 'TooShort') $$,
  '23514', null,
  'player: a 16-digit steamid64 is rejected by the CHECK'
);
select throws_ok(
  $$ insert into player (steamid64, display_name) values ('765611979602879300', 'TooLong') $$,
  '23514', null,
  'player: an 18-digit steamid64 is rejected by the CHECK'
);
select throws_ok(
  $$ insert into player (steamid64, display_name) values ('7656119abc0287930', 'NonNumeric') $$,
  '23514', null,
  'player: a 17-char steamid64 containing letters is rejected by the CHECK'
);
select throws_ok(
  $$ insert into player (steamid64, display_name) values ('76561197960287933', null) $$,
  '23502', null,
  'player: a null display_name is rejected by NOT NULL'
);

-- two more valid players for the app_role / FK tests below
select lives_ok(
  $$ insert into player (steamid64, display_name) values ('76561197960287931', 'PlayerB') $$,
  'player: a second valid player is accepted'
);
select lives_ok(
  $$ insert into player (steamid64, display_name) values ('76561197960287932', 'PlayerC') $$,
  'player: a third valid player is accepted'
);

-- ============================================================================
-- app_role — AD-12 closed set {admin,viewer}, PK on steamid64, FK to player
-- ============================================================================
select lives_ok(
  $$ insert into app_role (steamid64, role) values ('76561197960287930', 'admin') $$,
  'app_role: role=admin is accepted'
);
select lives_ok(
  $$ insert into app_role (steamid64, role) values ('76561197960287931', 'viewer') $$,
  'app_role: role=viewer is accepted'
);
select throws_ok(
  $$ insert into app_role (steamid64, role) values ('76561197960287932', 'superadmin') $$,
  '23514', null,
  'app_role: role=superadmin is rejected by the closed-set CHECK'
);
select throws_ok(
  $$ insert into app_role (steamid64, role) values ('76561197960287930', 'viewer') $$,
  '23505', null,
  'app_role: a duplicate steamid64 is rejected by the PK'
);
select throws_ok(
  $$ insert into app_role (steamid64, role) values ('99999999999999999', 'viewer') $$,
  '23503', null,
  'app_role: a role for a non-existent player is rejected by the FK'
);

-- ============================================================================
-- season + tournament — AD-18 seasons-aware scope
-- ============================================================================
select lives_ok(
  $$ insert into season (name) values ('Season 1') $$,
  'season: a season row is accepted'
);
select lives_ok(
  $$ insert into tournament (season_id, name)
     values ((select id from season where name = 'Season 1'), 'T1') $$,
  'tournament: a row under a valid season is accepted'
);
select is(
  (select state from tournament where name = 'T1'),
  'registration_open',
  'tournament: state defaults to registration_open'
);
select throws_ok(
  $$ insert into tournament (season_id, name, state)
     values ((select id from season where name = 'Season 1'), 'TBad', 'foo') $$,
  '23514', null,
  'tournament: an invalid state is rejected by the closed-set CHECK'
);
select throws_ok(
  $$ insert into tournament (season_id, name) values (null, 'TNull') $$,
  '23502', null,
  'tournament: a null season_id is rejected by NOT NULL'
);
select throws_ok(
  $$ insert into tournament (season_id, name) values (999999, 'TMissing') $$,
  '23503', null,
  'tournament: a non-existent season_id is rejected by the FK'
);

-- ON DELETE RESTRICT: a season referenced by a tournament cannot be deleted
select throws_ok(
  $$ delete from season where name = 'Season 1' $$,
  '23503', null,
  'season: delete is blocked while a tournament references it (ON DELETE RESTRICT)'
);

select * from finish();

rollback;
