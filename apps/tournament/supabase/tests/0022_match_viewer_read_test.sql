-- supabase/tests/0022_match_viewer_read_test.sql
-- pgTAP proof for migration 0022 (Story 5.7, AC1): `match` becomes viewer-readable. Proves the viewer
-- read PATH bites — a real anon caller can SELECT a bracket row and CANNOT write one — without regressing
-- the 0010 admin/single-writer posture. Run via: supabase test db
--   AC1  the two SEPARATE policies coexist (admin_read + viewer_read, never one OR'd) + viewer is SELECT  -> Section A
--   AC1  the grant matrix: anon/authenticated gain SELECT ONLY; service_role SELECT/INSERT/UPDATE, no DELETE -> Section B
--   AC1  behavioral — an anon caller SEES a real bracket row (using(true) exposes it) and every write 42501s -> Section C
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they seed directly.
-- RLS + grants only bite for anon/authenticated. This suite's DISTINCTIVE proof vs 0010's (which asserted
-- anon CANNOT read match) is the INVERSION: after 0022, anon CAN read `match` (count = 1 over the seeded
-- row, proving using(true) returns it rather than filtering it) but still cannot write it. SQLSTATE 42501 =
-- insufficient_privilege (the grant gate, hit before RLS runs on a write anon has no grant for).
--
-- ⚠ Every pgTAP file runs against the FINAL migrated schema. `match` carries the 0013 routing-edge columns
-- (winner_to_*/loser_to_*) and 0013's match_routing_complete CHECK, so the seed row below declares a legal
-- exit (pointing at a non-existent slot 999 — the CHECK's contract is that a row DECLARES an exit, not that
-- it resolves; mirrors the 0010 fixture note).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(18);

-- ── Fixture (as postgres, bypasses RLS) — one real bracket row the anon read can return ─────────────
insert into season (name) values ('S22');
insert into tournament (season_id, name)
  values ((select id from season where name = 'S22'), 'T22');
insert into match (tournament_id, bracket, bracket_position, bracket_slot,
                   winner_to_bracket, winner_to_slot, winner_to_side,
                   loser_to_bracket, loser_to_slot, loser_to_side)
  values ((select id from tournament where name = 'T22'), 'winners', 'Winners R1', 0,
          'winners', 999, 'a', 'losers', 999, 'a');

-- ============================================================================
-- Section A — the two-policy shape (AD-7): admin_read is untouched, viewer_read is added (2 assertions)
-- ============================================================================
select policies_are(
  'public', 'match',
  ARRAY['match_admin_read', 'match_viewer_read'],
  'match: exactly TWO policies now — the dormant admin read (0010, untouched) + the NEW viewer read. Two SEPARATE policies, never OR''d (AD-7).'
);
select policy_cmd_is('public', 'match', 'match_viewer_read', 'SELECT',
  'match_viewer_read is a SELECT-only policy (viewers never write — FR-34)');

-- ============================================================================
-- Section B — the grant matrix after 0022 (12 assertions)
-- ============================================================================
-- anon/authenticated: SELECT is now GRANTED (the whole point of this migration); every write stays ungranted.
select is(has_table_privilege('anon',          'public.match', 'SELECT'), true,  'anon CAN now SELECT match (Epic-5 viewer bracket — the 0010 deferral is closed)');
select is(has_table_privilege('anon',          'public.match', 'INSERT'), false, 'anon still CANNOT INSERT match (read-only viewer — fail closed)');
select is(has_table_privilege('anon',          'public.match', 'UPDATE'), false, 'anon still CANNOT UPDATE match (read-only viewer — fail closed)');
select is(has_table_privilege('anon',          'public.match', 'DELETE'), false, 'anon still CANNOT DELETE match (read-only viewer — fail closed)');
select is(has_table_privilege('authenticated', 'public.match', 'SELECT'), true,  'authenticated CAN now SELECT match (same viewer read grant)');
select is(has_table_privilege('authenticated', 'public.match', 'INSERT'), false, 'authenticated still CANNOT INSERT match (writes go via the service role — AD-2)');
select is(has_table_privilege('authenticated', 'public.match', 'UPDATE'), false, 'authenticated still CANNOT UPDATE match (fail closed)');
select is(has_table_privilege('authenticated', 'public.match', 'DELETE'), false, 'authenticated still CANNOT DELETE match (fail closed)');
-- service_role: UNCHANGED from 0010 — SELECT/INSERT/UPDATE, and deliberately NO DELETE (no-hard-delete ceiling).
select is(has_table_privilege('service_role',  'public.match', 'SELECT'), true,  'service_role SELECT is unchanged (single writer)');
select is(has_table_privilege('service_role',  'public.match', 'INSERT'), true,  'service_role INSERT is unchanged (generation)');
select is(has_table_privilege('service_role',  'public.match', 'UPDATE'), true,  'service_role UPDATE is unchanged (advance/approve/rollback)');
select is(has_table_privilege('service_role',  'public.match', 'DELETE'), false, 'service_role still has NO DELETE (a match is state-transitioned, never hard-deleted — 0022 does not add one)');

-- ============================================================================
-- Section C — behavioral: an anon caller reads the bracket, and cannot write it (4 assertions)
-- ============================================================================
set local role anon;
-- using(true) EXPOSES the row — count = 1 proves the policy returns the seeded match rather than filtering it.
select is((select count(*)::int from match), 1,
  'anon SEES the seeded bracket row through match_viewer_read using(true) — the read path is LIVE (Story 5.7 bracket surface)');
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot,
                        winner_to_bracket, winner_to_slot, winner_to_side,
                        loser_to_bracket, loser_to_slot, loser_to_side)
       values ((select id from tournament where name = 'T22'), 'winners', 'Winners R1', 1,
               'winners', 999, 'a', 'losers', 999, 'a') $$,
  '42501', null, 'anon CANNOT INSERT match — no write grant (fail closed at the grant gate before RLS runs)'
);
select throws_ok(
  $$ update match set bracket_position = 'hacked' where tournament_id = (select id from tournament where name = 'T22') $$,
  '42501', null, 'anon CANNOT UPDATE match — read-only viewer surface (FR-34)'
);
select throws_ok(
  $$ delete from match where tournament_id = (select id from tournament where name = 'T22') $$,
  '42501', null, 'anon CANNOT DELETE match — read-only viewer surface (FR-34)'
);
set local role postgres;

select * from finish();

rollback;
