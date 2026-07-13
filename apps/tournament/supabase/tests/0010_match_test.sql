-- supabase/tests/0010_match_test.sql
-- pgTAP proof for migration 0010 (Story 4.1): the `match` table + the FOUR deferred -> match(id) FKs.
-- Proves the match slice BITES (not merely that it exists) across AC2/AC3/D1. Run via: supabase test db
--   AC2 double-elim structure is REPRESENTABLE: bracket closed-set, slot uniqueness (incl. the
--       coalesce(gf_order,0) fold that keeps NULL gf_orders from colliding-by-NULL)  -> Section B
--   AC3 the two structural bye states are first-class ('bye' walkover, 'void' unreachable) -> Section B
--   AC2 the structural CHECKs bite: gf_order domain, winner-is-a-participant, distinct
--       competitors, and competitors confined to the match's OWN tournament             -> Section B
--   D1  all four deferred FKs exist, BITE, carry the right ON DELETE action — AND do not
--       break demo/stat_row ingest, because they sit on a NEW nullable column           -> Section C
--   Convention FORCE RLS + the admin/worker-only grant matrix (NO DELETE)               -> Sections A/D/E
-- Runs inside a transaction and rolls back — no data persists.
--
-- ⚠ THE D1 SUBTLETY THIS SUITE PINS. `demo.match_id`/`stat_row.match_id` never held a match(id): every
-- ingest writer supplies an EXTERNAL id (MatchZy's game-server matchid / the CLI's --match). 0010 renamed
-- that column to `matchzy_match_id` (carrying 0006's and 0007's AD-3 dedup keys with it) and added a
-- SEPARATE nullable `match_id` that IS FK'd. Section C proves BOTH halves: the FK bites a bogus match id,
-- AND a demo still inserts with no match_id at all — because if it did not, every demo ingest would 23503.
--
-- WHY role-switching: postgres (this session) has BYPASSRLS, so it seeds/constraint-tests directly.
-- RLS + grants only bite for anon/authenticated/service_role. `match`'s DISTINCTIVE proof vs
-- roster_entry (0004): match is ADMIN/WORKER-ONLY (mirrors demo/stat_row) — it has NO
-- anon/authenticated grant, so its admin-read policy is DORMANT (even a valid admin claim 42501s at
-- the grant gate before RLS runs), and service_role holds SELECT/INSERT/UPDATE but NOT DELETE:
-- a match is never hard-deleted, only state-transitioned. SQLSTATE: 23514 check, 23502 not-null,
-- 23503 FK, 23505 unique, 42501 insufficient_privilege.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(68);

-- ── Fixture (as postgres, bypasses RLS) ─────────────────────────────────────
-- T1 = the constraint/behavioral playground. T2 = the FK/ON-DELETE playground.
-- Both tournaments keep the default state 'registration_open' — the 0011 roster-lock trigger (added
-- by the very next migration) rejects roster_entry writes in a non-mutable state, so the roster
-- inserts below MUST target a mutable tournament. They do.
insert into player (steamid64, display_name)
  values ('76561197960287930', 'AdminPlayer'),
         ('76561197960287931', 'PlayerB'),
         ('76561197960287932', 'PlayerC');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T1'),
         ((select id from season where name = 'Season 1'), 'T2');
insert into roster_entry (tournament_id, steamid64)
  values ((select id from tournament where name = 'T1'), '76561197960287931'),
         ((select id from tournament where name = 'T1'), '76561197960287932'),
         -- A T2 entry, so the cross-tournament competitor guard has a REAL foreign entry to reject
         -- (an id that exists, just not in this match's event — the case a plain roster_entry(id) FK
         -- would have happily accepted).
         ((select id from tournament where name = 'T2'), '76561197960287932');

-- The FK/ON-DELETE fixture in T2:
--   M_ANCHOR (slot 900) <- demo D1 references it via the NEW match_id (RESTRICT: deleting it is REFUSED)
--   M_DEL    (slot 901) <- a stat_row (CASCADE), an audit_log row (SET NULL) and
--                          tournament.final_match_id (SET NULL) all point at it.
--   The stat_row's demo_id points at D1 (which lives on M_ANCHOR), so deleting M_DEL is NOT blocked
--   by the demo RESTRICT — that isolation is what lets one delete prove CASCADE + both SET NULLs.
-- Note both rows carry matchzy_match_id (NOT NULL, the external ingest id) AND match_id (the FK).
-- Story 4.6 is what populates match_id in production; here we set it by hand to exercise the FK.
insert into match (tournament_id, bracket, bracket_position, bracket_slot)
  values ((select id from tournament where name = 'T2'), 'winners', 'Winners R1', 900),
         ((select id from tournament where name = 'T2'), 'winners', 'Winners R1', 901);
insert into demo (matchzy_match_id, match_id, storage_key, source)
  values (900900,
          (select id from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 900),
          'r2://qa/anchor.dem', 'manual_upload');
insert into stat_row (matchzy_match_id, match_id, steamid64, demo_id)
  values (901901,
          (select id from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 901),
          '76561197960287931',
          (select id from demo where storage_key = 'r2://qa/anchor.dem'));
insert into audit_log (tournament_id, actor_steamid64, action, target_match_id)
  values ((select id from tournament where name = 'T2'), '76561197960287930', 'test_target',
          (select id from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 901));
update tournament
   set final_match_id = (select id from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 901)
 where name = 'T2';

-- ============================================================================
-- Section A — structure: FORCE RLS + the two indexes (4 assertions)
-- ============================================================================
select is((select relrowsecurity      from pg_class where oid = 'public.match'::regclass), true, 'match: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.match'::regclass), true, 'match: ROW LEVEL SECURITY is FORCED (the 0003 generic catalog guard also covers this now)');
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'match' and indexname = 'match_slot_uniq'),
  1, 'match: the slot-uniqueness index exists (SOLUTION-DESIGN §3 L131 realized as a UNIQUE INDEX — a table constraint cannot hold coalesce())');
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'match' and indexname = 'match_tournament_bracket_idx'),
  1, 'match: the (tournament_id, bracket) read index exists (§3 L259)');

-- ============================================================================
-- Section B — the DDL constraints BITE (29 assertions). Run as postgres on T1.
-- ============================================================================
-- Happy path + the three column defaults.
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 1) $$,
  'match: a minimal (tournament, bracket, position, slot) row is accepted'
);
select is((select state           from match where tournament_id = (select id from tournament where name='T1') and bracket_slot = 1 and bracket = 'winners'), 'declared', 'match: state defaults to declared (4.1 creates every real match declared)');
select is((select format_locked   from match where tournament_id = (select id from tournament where name='T1') and bracket_slot = 1 and bracket = 'winners'), false,     'match: format_locked defaults to false (the AD-10 lock is Story 4.2)');
select is((select manual_override from match where tournament_id = (select id from tournament where name='T1') and bracket_slot = 1 and bracket = 'winners'), false,     'match: manual_override defaults to false (Story 4.8 owns the override)');

-- Closed-set CHECKs bite.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, state)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 20, 'finished') $$,
  '23514', null, 'match: state=finished (out of the 10-value closed set) is rejected by the CHECK'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'consolation', 'Nope', 21) $$,
  '23514', null, 'match: bracket=consolation is rejected — only winners|losers|grand_final exist'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 22, 'guessed') $$,
  '23514', null, 'match: score_source=guessed is rejected — AD-5 admits only demo_derived|admin_manual'
);
-- NOT NULLs bite.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'winners', null, 23) $$,
  '23502', null, 'match: a null bracket_position is rejected by NOT NULL (the label is structural)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', null) $$,
  '23502', null, 'match: a null bracket_slot is rejected by NOT NULL (the routing index is structural)'
);
-- Outbound FKs bite.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values (999999, 'winners', 'Winners R1', 24) $$,
  '23503', null, 'match: a non-existent tournament_id is rejected by the FK'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, competitor_a)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 25, 999999) $$,
  '23503', null, 'match: competitor_a must be a real roster_entry (AD-4 — matches join the seeded roster, never player/display_name)'
);
-- The competitor FK is COMPOSITE (tournament_id, competitor) -> roster_entry(tournament_id, id): a
-- match may only seat players from ITS OWN event. A plain roster_entry(id) FK would accept this row.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, competitor_a)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 28,
               (select id from roster_entry where tournament_id = (select id from tournament where name = 'T2'))) $$,
  '23503', null, 'match: a competitor from ANOTHER tournament is rejected (the composite FK confines a match to its own roster)'
);

-- AC3: the two structural bye states are first-class.
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, competitor_a, winner_entry)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 2, 'bye',
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931'),
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931')) $$,
  'match: state=bye with one competitor who is the winner is accepted (AC3 — a walkover advances a player, no opponent)'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, state)
       values ((select id from tournament where name = 'T1'), 'losers', 'Losers R1', 6, 'void') $$,
  'match: state=void with NO competitors is accepted (AC3 — a Losers node both of whose feeders were byes; never played, advances nobody)'
);

-- gf_order EXISTS iff the row is a grand_final, and is then 1 or 2. Without this a winners row could
-- carry gf_order=1 and dodge the slot-uniqueness fold, and a NULL-gf_order grand_final could be a THIRD
-- GF row. The `gf_order is not null and …` half matters: a bare IN would evaluate to NULL, and a CHECK
-- PASSES on NULL.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 29, 1) $$,
  '23514', null, 'match: a non-grand_final row carrying gf_order is rejected (it would dodge the coalesce(gf_order,0) slot fold)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values ((select id from tournament where name = 'T1'), 'grand_final', 'GF (no order)', 7, null) $$,
  '23514', null, 'match: a grand_final row with a NULL gf_order is rejected (it would fold to 0 and coexist with the real GF 1 and reset 2)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values ((select id from tournament where name = 'T1'), 'grand_final', 'GF (bogus)', 8, 3) $$,
  '23514', null, 'match: gf_order=3 is rejected — AD-21 has exactly two grand-final rows'
);

-- The winner must have actually been in the match. Generation writes winner_entry itself (byes), so a
-- routing bug would otherwise land silently. `is not distinct from` matters: with both competitors NULL,
-- `winner = competitor_a` is NULL, and a CHECK passes on NULL.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, competitor_a, winner_entry)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 30,
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931'),
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287932')) $$,
  '23514', null, 'match: a winner_entry who is neither competitor is rejected (you cannot win a match you were not in)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, winner_entry)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 31,
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931')) $$,
  '23514', null, 'match: a winner_entry with NO competitors at all is rejected (the NULL-passes-a-CHECK trap)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, competitor_a, competitor_b)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 32,
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931'),
               (select id from roster_entry where tournament_id = (select id from tournament where name='T1') and steamid64 = '76561197960287931')) $$,
  '23514', null, 'match: a player cannot be seated against themselves (competitor_a <> competitor_b)'
);

-- The AD-5 score_source_guard: the two illegal shapes bite, the three legal shapes live.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source, score_a, score_b)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 26, 'demo_derived', 16, 14) $$,
  '23514', null, 'score_source_guard: demo_derived with demo_id IS NULL is rejected (a demo-derived score REQUIRES the demo)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source, demo_id)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 27, 'admin_manual',
               (select id from demo where storage_key = 'r2://qa/anchor.dem')) $$,
  '23514', null, 'score_source_guard: admin_manual WITH a demo and manual_override=false is rejected (silently overriding evidence is the exact AD-5 hazard)'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source, demo_id, manual_override)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 3, 'admin_manual',
               (select id from demo where storage_key = 'r2://qa/anchor.dem'), true) $$,
  'score_source_guard: admin_manual WITH a demo IS allowed once manual_override=true (the audited escape hatch — Story 4.8)'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 4, 'admin_manual') $$,
  'score_source_guard: admin_manual with NO demo is allowed (nothing to contradict)'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, score_source, demo_id)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1', 5, 'demo_derived',
               (select id from demo where storage_key = 'r2://qa/anchor.dem')) $$,
  'score_source_guard: demo_derived WITH its demo is allowed (the Story-4.6 Aprobar shape)'
);

-- Slot uniqueness — including the coalesce(gf_order,0) fold. This is the assertion that would
-- silently pass with a naive UNIQUE(...gf_order): Postgres treats every NULL as distinct, so a plain
-- UNIQUE would enforce NOTHING on the ~29 non-GF rows of a real bracket.
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R1 (dup)', 1) $$,
  '23505', null, 'match: a duplicate (tournament, winners, slot 1) with NULL gf_order is rejected — coalesce(gf_order,0) folds the NULLs so they COLLIDE'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'losers', 'Losers R1', 1) $$,
  'match: the same bracket_slot in a DIFFERENT bracket is allowed (slots are scoped per bracket)'
);
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order) values
       ((select id from tournament where name = 'T1'), 'grand_final', 'Grand Final',         0, 1),
       ((select id from tournament where name = 'T1'), 'grand_final', 'Grand Final (Reset)', 0, 2) $$,
  'match: the two AD-21 grand-final rows share slot 0 and differ only by gf_order 1 vs 2 (Story 4.4 headroom)'
);
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values ((select id from tournament where name = 'T1'), 'grand_final', 'GF (dup)', 0, 1) $$,
  '23505', null, 'match: a duplicate grand_final (slot 0, gf_order 1) is rejected'
);

-- ============================================================================
-- Section C — D1: the four deferred -> match(id) FKs (16 assertions). Runs on T2.
-- ============================================================================
-- The two FKs the 0005/0007 headers named by constraint name ("Epic 4 adds BOTH").
select is((select count(*)::int from pg_constraint where conname = 'demo_match_fk'     and contype = 'f'), 1, 'D1: demo_match_fk exists (promised in the 0005 header, deferred since Story 3.1)');
select is((select count(*)::int from pg_constraint where conname = 'stat_row_match_fk' and contype = 'f'), 1, 'D1: stat_row_match_fk exists (promised in the 0007 header, deferred since Story 3.3)');

-- ⭐ THE FK SITS ON A NEW, NULLABLE COLUMN — and it MUST, or the FK would break every ingest. The
-- ingest writers supply an EXTERNAL id (matchzy_match_id), never a match(id); the bracket binding is
-- Story 4.6's. These two assertions are the reason the whole Epic-3 pipeline still runs.
select col_is_null('public', 'demo',     'match_id', 'D1: demo.match_id is NULLABLE — an acquired demo names no bracket match until Story 4.6 binds it');
select col_is_null('public', 'stat_row', 'match_id', 'D1: stat_row.match_id is NULLABLE — a parsed row names no bracket match until Story 4.6 binds it');
select lives_ok(
  $$ insert into demo (matchzy_match_id, storage_key, source)
       values (777777, 'r2://qa/ingest-path.dem', 'matchzy') $$,
  'D1: a demo still ingests with NO match_id at all — the FK does NOT break the MatchZy/CLI acquisition path (this is what FK-ing the old column would have destroyed)'
);
select is((select matchzy_match_id from demo where storage_key = 'r2://qa/ingest-path.dem'), 777777::bigint,
  'D1: the external ingest id is preserved verbatim in matchzy_match_id (it carries 0006''s AD-3 dedup key)');

-- All four BITE: a match pointer that names no match is impossible.
select throws_ok(
  $$ insert into demo (matchzy_match_id, match_id, storage_key, source) values (1, 999999, 'r2://qa/orphan.dem', 'matchzy') $$,
  '23503', null, 'D1: a demo whose match_id names no match is rejected (demo_match_fk bites)'
);
select throws_ok(
  $$ insert into stat_row (matchzy_match_id, match_id, steamid64, demo_id)
       values (1, 999999, '76561197960287932', (select id from demo where storage_key = 'r2://qa/anchor.dem')) $$,
  '23503', null, 'D1: a stat_row whose match_id names no match is rejected (stat_row_match_fk bites)'
);
select throws_ok(
  $$ update tournament set final_match_id = 999999 where name = 'T1' $$,
  '23503', null, 'D1: tournament.final_match_id must name a real match (the 0001 deferral is closed)'
);
select throws_ok(
  $$ insert into audit_log (tournament_id, actor_steamid64, action, target_match_id)
       values ((select id from tournament where name = 'T2'), '76561197960287930', 'bogus', 999999) $$,
  '23503', null, 'D1: audit_log.target_match_id must name a real match (the 0003 deferral is closed)'
);

-- ON DELETE semantics (SPINE L234: RESTRICT source-of-truth, CASCADE derived child, SET NULL back-pointer).
-- RESTRICT: a demo is EVIDENCE — deleting the match it records is REFUSED, never a silent cascade-wipe.
select throws_ok(
  $$ delete from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 900 $$,
  '23503', null, 'D1 RESTRICT: deleting a match that a demo references is REFUSED (demo is source-of-truth evidence — never cascade-destroyed)'
);
-- The other three actions, proven by ONE delete of M_DEL (no demo points at it, so RESTRICT is silent).
select lives_ok(
  $$ delete from match where tournament_id = (select id from tournament where name = 'T2') and bracket_slot = 901 $$,
  'D1: deleting a match with no demo succeeds (its stat_row CASCADEs; its two back-pointers SET NULL)'
);
select is((select count(*)::int from stat_row), 0,
  'D1 CASCADE: the match''s stat_row is gone (a stat_row is a DERIVED child — re-parsable from the demo)');
select is((select count(*)::int from audit_log where action = 'test_target'), 1,
  'D1 SET NULL: the audit_log row SURVIVES the match delete (AD-17 append-only — CASCADE here would have cascade-WIPED audit history)');
select is((select target_match_id from audit_log where action = 'test_target'), null,
  'D1 SET NULL: the surviving audit row merely FORGETS its target (target_match_id is now NULL)');
select is((select final_match_id from tournament where name = 'T2'), null,
  'D1 SET NULL: tournament.final_match_id is NULLed, not cascade-deleted with the match');

-- ============================================================================
-- Section D — the exact policy set + the grant matrix (14 assertions)
-- ============================================================================
select policies_are(
  'public', 'match',
  ARRAY['match_admin_read'],
  'match: exactly ONE policy — the dormant admin-only read. No viewer policy (the Spanish bracket surface is Epic 5); no write policy (single-writer).'
);
select policy_cmd_is('public', 'match', 'match_admin_read', 'SELECT', 'match_admin_read is a SELECT-only policy');

-- service_role: SELECT/INSERT/UPDATE but NOT DELETE — the distinctive proof. A match is never
-- hard-deleted, only state-transitioned (a rolled-back match becomes state='rolled_back').
select is(has_table_privilege('service_role',  'public.match', 'SELECT'), true,  'service_role CAN SELECT match');
select is(has_table_privilege('service_role',  'public.match', 'INSERT'), true,  'service_role CAN INSERT match (bracket generation creates every row)');
select is(has_table_privilege('service_role',  'public.match', 'UPDATE'), true,  'service_role CAN UPDATE match (advance 4.3 / GF 4.4 / forfeit 4.5 / approve 4.6 / rollback 4.7)');
select is(has_table_privilege('service_role',  'public.match', 'DELETE'), false, 'service_role CANNOT DELETE match (no-hard-delete ceiling — the grant is the teeth)');
-- anon/authenticated: NOTHING at all this slice (admin/worker-only — mirrors demo/stat_row-at-0007).
select is(has_table_privilege('anon',          'public.match', 'SELECT'), false, 'anon CANNOT SELECT match (no viewer bracket until Epic 5 — fail closed)');
select is(has_table_privilege('anon',          'public.match', 'INSERT'), false, 'anon CANNOT INSERT match (fail closed)');
select is(has_table_privilege('anon',          'public.match', 'UPDATE'), false, 'anon CANNOT UPDATE match (fail closed)');
select is(has_table_privilege('anon',          'public.match', 'DELETE'), false, 'anon CANNOT DELETE match (fail closed)');
select is(has_table_privilege('authenticated', 'public.match', 'SELECT'), false, 'authenticated CANNOT SELECT match (the admin_read policy is DORMANT — no base grant to reach it)');
select is(has_table_privilege('authenticated', 'public.match', 'INSERT'), false, 'authenticated CANNOT INSERT match (fail closed — writes go via the service role)');
select is(has_table_privilege('authenticated', 'public.match', 'UPDATE'), false, 'authenticated CANNOT UPDATE match (fail closed)');
select is(has_table_privilege('authenticated', 'public.match', 'DELETE'), false, 'authenticated CANNOT DELETE match (fail closed)');

-- ============================================================================
-- Section E — behavioral: the grants bite for real callers (5 assertions). On T1.
-- ============================================================================
set local role service_role;
select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot)
       values ((select id from tournament where name = 'T1'), 'winners', 'Winners R2', 10) $$,
  'service_role inserts a match (grant + BYPASSRLS) — the single-writer generation path'
);
select lives_ok(
  $$ update match set state = 'live'
       where tournament_id = (select id from tournament where name = 'T1') and bracket = 'winners' and bracket_slot = 10 $$,
  'service_role UPDATEs a match state (the advance/approve/rollback path)'
);
select throws_ok(
  $$ delete from match where tournament_id = (select id from tournament where name = 'T1') and bracket = 'winners' and bracket_slot = 10 $$,
  '42501', null,
  'service_role CANNOT DELETE match — the no-hard-delete ceiling bites even the privileged writer (no delete grant)'
);
set local role postgres;

-- Even a valid ADMIN claim 42501s at the table-grant gate before RLS runs: match_admin_read is
-- DORMANT defense-in-depth this slice (admins read the bracket through a service-role server route).
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"76561197960287930"}}', true);
select throws_ok(
  $$ select count(*) from match $$,
  '42501', null,
  'authenticated ADMIN CANNOT read match — no base grant, so the admin policy never even runs (dormant, mirrors demo/audit_log)'
);
set local role postgres;

set local role anon;
select throws_ok(
  $$ select count(*) from match $$,
  '42501', null,
  'anon CANNOT read match — fail closed (the public bracket surface arrives in Epic 5)'
);
set local role postgres;

select * from finish();

rollback;
