-- supabase/tests/0025_ceremony_results_test.sql
-- pgTAP proof for migration 0025 (Story 6.6): the ceremony RESULT tables, FR-26's anti-sweep
-- constraint, and the luck-meter's shipped VALUES (FR-26 / AD-14 / review-data-integrity.md M1).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC2  `spin` / `award_result` / `award_result_winner` shape, named CHECKs, FORCE RLS, NO
--        policy and NO anon/authenticated grant, service_role CRUD                    -> Sections A, B
--   AC2  ⭐ THE FLAGSHIP: unique (spin_id, winner_entry_id) REJECTS a second trophy for one player
--        in one spin, and PERMITS the same player in a DIFFERENT spin                 -> Section C
--   AC2  M1's FK-consistency: a child spin_id cannot disagree with its award_result's -> Section D
--   AC2  M1's `is_shared` cannot drift, in BOTH directions, from BOTH tables (IC909)  -> Section E
--   AC2  the declared ON DELETE behaviour, incl. the delete-prior-on-rerun contract   -> Section F
--   AC3  `ceremony.luck_weight_table` stops being a SHELL: default, backfill, and the shape CHECK
--        that machine-enforces FR-26's three rules                                    -> Section G
--
-- ⚠⚠ WHY CONSTRAINT NAMES, NOT BARE SQLSTATES. Every CHECK raises the same 23514 and every UNIQUE
-- the same 23505, so a `throws_ok` on the code alone would pass for the wrong reason — the trap the
-- 4.3 review found across three suites and 6.1 re-hit. Every negative test below asserts the
-- CONSTRAINT NAME in the message.
--
-- ⚠ WHY THE DEFERRED TRIGGER TESTS USE AN EXPLICIT SAVEPOINT-LESS BLOCK. `award_result_is_shared_
-- consistent` is DEFERRABLE INITIALLY DEFERRED, so it fires at COMMIT — not at the statement. A
-- `throws_ok` around the INSERT alone would pass vacuously (nothing raises there). Each drift test
-- therefore wraps the write AND a `set constraints ... immediate`, which is what forces the deferred
-- check to run inside the assertion.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they read and
-- write regardless of policy. AD-22 bites at the GRANT gate: anon/authenticated hold ZERO grants on
-- all three tables and there is no policy either, so a viewer 42501s before RLS is consulted.
-- Fixtures are built as postgres; the grant assertions name the roles directly.
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action
-- Item #3). The matrix and its observed red counts are in the story's Completion Notes.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan(68) = A 14 + B 11 + C 6 + D 3 + E 9 + F 5 + G 20, accounted for section by section:
--   A 14 — `spin`: shape 5 (table · PK · columns_are · the ceremony FK · the (ceremony,index) UNIQUE
--          by name) · the kind CHECK by name 2 (both legal values live · an illegal one refused) ·
--          RLS 3 (enabled · forced · ZERO policies) · grants 4 (anon none · authenticated none ·
--          service_role has all four verbs · no other role holds any).
--   B 11 — `award_result` 7 (table · columns_are · the spin FK cascade · the award FK restrict ·
--          the (spin,award) UNIQUE by name · the redundant (id,spin_id) UNIQUE by name · the
--          ladder-exit CHECK refuses 6 and admits NULL/1/5) and `award_result_winner` 4 (table ·
--          columns_are · the (result,winner) UNIQUE by name · RLS forced on both).
--   C  6 — ⭐ the anti-sweep UNIQUE: a well-formed pair of trophies to two players inserts (positive
--          control) · a SECOND trophy for the SAME player in the SAME spin is 23505 naming
--          award_result_winner_spin_key · nothing was written · the same player in a DIFFERENT spin
--          is PERMITTED · a co-winner pair (two players, one award_result) is permitted · the
--          constraint is per SPIN and not per award_result (proved by the co-winner row above).
--   D  3 — a child whose spin_id disagrees with its award_result's is refused by the COMPOSITE FK ·
--          the agreeing row inserts · the refusal names award_result_winner_result_fk.
--   E  9 — is_shared drift: sole winner with is_shared=true -> IC909 · two co-winners with
--          is_shared=false -> IC909 · no winners with is_shared=true -> IC909 · flipping is_shared
--          on an existing correct row -> IC909 · deleting one of two co-winners without clearing the
--          flag -> IC909 · ⭐ MOVING one of two co-winners to another award_result -> IC909 (the
--          SOURCE parent is re-checked, added at code review) · and the three LEGAL shapes commit
--          cleanly (sole/false, pair/true, none/false).
--   F  5 — deleting a `spin` cascades to award_result and to award_result_winner · deleting an
--          award_result cascades to its winners · deleting a roster_entry that holds a trophy is
--          RESTRICTED · deleting an `award` that has a result is RESTRICTED · the
--          delete-prior-on-rerun round trip succeeds.
--   G 20 — luck_weight_table: the constraint exists BY NAME 1 · the CHECK expression 1 · the column
--          default is the shipped table 1 · every existing ceremony row was backfilled 1 · the
--          BACKFILLED row (T6, scoped by name — not `limit 1`) is the shipped table 1 · NULL is
--          still legal 1 · a valid re-tuned table is accepted 1 · the CHECK refuses 9 shapes, each
--          by constraint name (empty · a zero entry · a negative entry · non-decreasing · equal
--          adjacent · ⭐ ONE-ENTRY · ⭐ two-DIMENSIONAL · ⭐ subscripts not starting at 1 · a NULL
--          entry — the last four added at code review, each covering a CHECK branch that had no
--          test) · the helper function is IMMUTABLE 1 · the helper accepts the shipped table (the
--          positive control) 1 · shelf 0 indexes the heaviest entry 1 · the stored table is
--          strictly decreasing, re-derived from the column rather than transcribed 1.
select plan(68);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T6');

insert into player (steamid64, display_name) values
  ('76561198000000011', 'Ana'),
  ('76561198000000022', 'Beto'),
  ('76561198000000033', 'Caro');

insert into roster_entry (tournament_id, steamid64)
select (select id from tournament where name = 'T6'), s
  from (values ('76561198000000011'), ('76561198000000022'), ('76561198000000033')) as v(s);

insert into award (tournament_id, name, bucket, class, deciding_stat, priority) values
  ((select id from tournament where name = 'T6'), 'Cuchillero', 'weird',  'volume', 'knife_kills', 1),
  ((select id from tournament where name = 'T6'), 'Muralla',    'skill',  'volume', 'wallbang_kills', 2);

insert into ceremony (tournament_id) values ((select id from tournament where name = 'T6'));

insert into spin (ceremony_id, spin_index, kind) values
  ((select id from ceremony limit 1), 1, 'main'),
  ((select id from ceremony limit 1), 2, 'main');

-- Handy lookups, re-derived rather than hardcoded so a fixture edit cannot silently retarget a test.
--
-- ⚠ `ceremony_id` IS SCOPED TO T6 BY NAME, NOT `limit 1`. This is a VIEW, so every reference
-- re-evaluates — and Section G inserts a SECOND ceremony (T7's, to prove the column DEFAULT applies
-- to fresh rows). From that point on a bare `limit 1` has no defined row, so every later `f`
-- reference could silently retarget to the wrong ceremony. The code review caught it.
create temporary view f as
select
  (select c.id from ceremony c
     join tournament t on t.id = c.tournament_id
    where t.name = 'T6')                                                                as ceremony_id,
  (select id from spin where spin_index = 1)                                            as spin1,
  (select id from spin where spin_index = 2)                                            as spin2,
  (select id from award where name = 'Cuchillero')                                      as aw1,
  (select id from award where name = 'Muralla')                                         as aw2,
  (select id from roster_entry where steamid64 = '76561198000000011')                   as ana,
  (select id from roster_entry where steamid64 = '76561198000000022')                   as beto,
  (select id from roster_entry where steamid64 = '76561198000000033')                   as caro;

-- ============================================================================
-- Section A — `spin`: shape, the closed set, RLS, grants  (14)
-- ============================================================================
select has_table('public', 'spin', 'spin: the table exists');
select has_pk('public', 'spin', 'spin: has a primary key');
select columns_are('public', 'spin',
  array['id', 'ceremony_id', 'spin_index', 'kind', 'live_award_ids', 'revealed_at'],
  'spin: EXACTLY SOLUTION-DESIGN.md:205-213''s six columns — no more (6.8 widens BEHAVIOUR, not shape)');
select fk_ok('public', 'spin', 'ceremony_id', 'public', 'ceremony', 'id',
  'spin: ceremony_id references ceremony(id)');
select has_index('public', 'spin', 'spin_ceremony_index_key',
  'spin: unique (ceremony_id, spin_index) exists by name');

select lives_ok($$
  insert into public.spin (ceremony_id, spin_index, kind)
  values ((select ceremony_id from f), 99, 'pity')$$,
  'spin_kind_valid: ''pity'' is a legal kind (SOLUTION-DESIGN:209 declares the set; Story 6.7 writes one)');
select throws_ok($$
  insert into public.spin (ceremony_id, spin_index, kind)
  values ((select ceremony_id from f), 98, 'bonus')$$,
  '23514', 'new row for relation "spin" violates check constraint "spin_kind_valid"',
  'spin_kind_valid: a kind outside main/pity is REFUSED, and the CONSTRAINT NAME says which check');

select is((select relrowsecurity     from pg_class where oid = 'public.spin'::regclass), true,
  'spin: ROW LEVEL SECURITY is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.spin'::regclass), true,
  'spin: ROW LEVEL SECURITY is FORCED (the 0003 Section-A2 catalog guard also covers this)');
-- ⭐ DECISION B — ZERO policies on ALL THREE, deliberately. The viewer axis is reveal-gated on
-- `revealed_at` and its shape is Story 6.8's design; pre-building half of it would be guessing.
select is(
  (select count(*)::int from pg_policy
    where polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                       'public.award_result_winner'::regclass)),
  0,
  'all three tables: NO RLS policy at all — 6.8 adds the reveal-gated read AND its grant together (DECISION B)');

-- ⚠ `has_table_privilege`, NOT a row count over `information_schema.role_table_grants`, and 0024
-- uses the same primitive for the same reason: Supabase's project-wide default privileges hand
-- anon/authenticated REFERENCES/TRIGGER/TRUNCATE on EVERY new public table, so a bare grant count is
-- 3 for a table nobody granted anything on. What AD-22 is about is the four DATA verbs, and those
-- are what these assert.
select is(has_table_privilege('anon', 'public.spin', 'SELECT'), false,
  'AD-22: anon has NO SELECT on spin — a viewer sees no unrevealed spin, and there is no policy to consult either');
select is(
  (select bool_or(has_table_privilege(r, t, p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.spin', 'public.award_result', 'public.award_result_winner']) t,
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  false,
  'neither client role holds ANY of the four data verbs on ANY of the three tables — fail-closed at the grant gate');
select is(
  (select bool_and(has_table_privilege('service_role', t, p))
     from unnest(array['public.spin', 'public.award_result', 'public.award_result_winner']) t,
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  true,
  'service_role holds all four verbs on all three — DELETE included, because delete-prior-on-rerun needs it');
select is(
  (select bool_and(relforcerowsecurity)
     from pg_class
    where oid in ('public.award_result'::regclass, 'public.award_result_winner'::regclass)),
  true,
  'award_result and award_result_winner FORCE RLS too (the 0003 Section-A2 catalog guard also covers them)');

-- ============================================================================
-- Section B — `award_result` + `award_result_winner`: shape and closed sets  (11)
-- ============================================================================
select has_table('public', 'award_result', 'award_result: the table exists');
select columns_are('public', 'award_result',
  array['id', 'spin_id', 'award_id', 'deciding_value', 'is_pity', 'is_shared', 'tie_ladder_exit_step'],
  'award_result: EXACTLY SOLUTION-DESIGN.md:215-224''s seven columns');
select fk_ok('public', 'award_result', 'spin_id', 'public', 'spin', 'id',
  'award_result: spin_id references spin(id)');
select fk_ok('public', 'award_result', 'award_id', 'public', 'award', 'id',
  'award_result: award_id references award(id)');
select has_index('public', 'award_result', 'award_result_spin_award_key',
  'award_result: unique (spin_id, award_id) exists by name');
-- ⭐ DECISION D's enabler. It is redundant on its own and load-bearing as the target of the child's
-- COMPOSITE foreign key; Section D is what proves it bites.
select has_index('public', 'award_result', 'award_result_id_spin_key',
  'award_result: the redundant unique (id, spin_id) exists — DECISION D''s composite-FK target');

select throws_ok($$
  insert into public.award_result (spin_id, award_id, tie_ladder_exit_step)
  values ((select spin1 from f), (select aw1 from f), 6)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_ladder_exit_step_valid"',
  'award_result_ladder_exit_step_valid: a rung outside 1..5 is REFUSED — FR-29 has exactly five');
select lives_ok($$
  insert into public.award_result (spin_id, award_id, tie_ladder_exit_step)
  values ((select spin2 from f), (select aw2 from f), null)$$,
  'award_result_ladder_exit_step_valid: NULL is legal — it means no ladder was involved');

select has_table('public', 'award_result_winner', 'award_result_winner: the table exists');
select columns_are('public', 'award_result_winner',
  array['id', 'award_result_id', 'spin_id', 'winner_entry_id'],
  'award_result_winner: EXACTLY SOLUTION-DESIGN.md:226-233''s four columns, spin_id included');
select has_index('public', 'award_result_winner', 'award_result_winner_result_key',
  'award_result_winner: unique (award_result_id, winner_entry_id) exists by name');

-- ============================================================================
-- Section C — ⭐ THE FLAGSHIP: unique (spin_id, winner_entry_id)  (6)
-- ============================================================================
-- Clear the Section-B probe rows so this section starts from a known state.
delete from public.award_result;
delete from public.spin where spin_index in (98, 99);

-- Spin 1: two awards, two DIFFERENT players. The positive control — without it, every assertion
-- below is satisfiable by a schema that refuses all inserts.
insert into public.award_result (id, spin_id, award_id, is_shared)
  overriding system value
  values (default, (select spin1 from f), (select aw1 from f), false);
insert into public.award_result (spin_id, award_id, is_shared)
  values ((select spin1 from f), (select aw2 from f), false);

select lives_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, ar.spin_id, (select ana from f)
    from public.award_result ar
   where ar.spin_id = (select spin1 from f) and ar.award_id = (select aw1 from f)$$,
  'the positive control: a first trophy inserts cleanly');

select lives_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, ar.spin_id, (select beto from f)
    from public.award_result ar
   where ar.spin_id = (select spin1 from f) and ar.award_id = (select aw2 from f)$$,
  'a SECOND award in the same spin going to a DIFFERENT player is fine — the cap is per PLAYER');

-- ⭐⭐ THE CONSTRAINT THAT MUST NEVER FIRE IN PRODUCTION, FIRING HERE.
select throws_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, ar.spin_id, (select ana from f)
    from public.award_result ar
   where ar.spin_id = (select spin1 from f) and ar.award_id = (select aw2 from f)$$,
  '23505',
  'duplicate key value violates unique constraint "award_result_winner_spin_key"',
  '⭐ FR-26/AD-14: a SECOND trophy for the SAME player in the SAME spin is REJECTED by name');

select is((select count(*)::int from public.award_result_winner
            where spin_id = (select spin1 from f) and winner_entry_id = (select ana from f)), 1,
  'the refusal wrote nothing — Ana still holds exactly one trophy in spin 1');

-- ⭐ THE OTHER HALF, and it is what makes the constraint PER SPIN rather than global.
insert into public.award_result (spin_id, award_id, is_shared)
  values ((select spin2 from f), (select aw1 from f), false);
select lives_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, ar.spin_id, (select ana from f)
    from public.award_result ar
   where ar.spin_id = (select spin2 from f)$$,
  '⭐ the SAME player in a DIFFERENT spin is PERMITTED — the cap is one trophy per spin, not per ceremony');

-- A genuine FR-29 rung-5 co-win: ONE award_result, TWO winner rows, two different players. It is the
-- shape that makes a per-award_result UNIQUE unable to express the rule at all.
insert into public.award_result (spin_id, award_id, is_shared)
  values ((select spin2 from f), (select aw2 from f), true);
select lives_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, ar.spin_id, v.e
    from public.award_result ar,
         (values ((select beto from f)), ((select caro from f))) as v(e)
   where ar.spin_id = (select spin2 from f) and ar.award_id = (select aw2 from f)$$,
  'a SHARED co-win writes TWO winner rows under ONE award_result — "co-winners all count"');

-- ============================================================================
-- Section D — DECISION D: the child's spin_id cannot disagree with its parent's  (3)
-- ============================================================================
-- ⚠ THE FIXTURE IS CHOSEN SO THE COMPOSITE FK IS THE **ONLY** THING THAT CAN REFUSE. The parent is
-- spin 2's `Cuchillero` result; the child claims spin 1 and Caro, who holds NOTHING in spin 1 — so
-- neither UNIQUE is in play and a failure can only come from `award_result_winner_result_fk`. An
-- earlier draft used a player who already held a spin-2 trophy and the ANTI-SWEEP unique fired
-- first, which would have made this row pin the wrong constraint entirely.
select throws_ok($$
  insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
  select ar.id, (select spin1 from f), (select caro from f)
    from public.award_result ar
   where ar.spin_id = (select spin2 from f) and ar.award_id = (select aw1 from f)$$,
  '23503',
  'insert or update on table "award_result_winner" violates foreign key constraint "award_result_winner_result_fk"',
  '⭐ DECISION D: a denormalized spin_id that DISAGREES with its award_result''s is unrepresentable');

select is((select count(*)::int from public.award_result_winner
            where winner_entry_id = (select caro from f) and spin_id = (select spin1 from f)), 0,
  'the refusal wrote nothing — Caro still holds no trophy in spin 1');

select is(
  (select confrelid::regclass::text from pg_constraint
    where conname = 'award_result_winner_result_fk'),
  'award_result',
  'award_result_winner_result_fk really targets award_result (a COMPOSITE FK, not a second single-column one)');

-- ============================================================================
-- Section E — DECISION C: `is_shared` cannot drift (IC909)  (9)
-- ============================================================================
-- ⚠ EVERY CASE BELOW FORCES THE DEFERRED TRIGGER TO RUN with `set constraints ... immediate`. The
-- constraint is DEFERRABLE INITIALLY DEFERRED precisely so a writer can insert the result before its
-- winners; a test that only asserted on the INSERT would pass while asserting nothing.
select throws_ok($q$
  do $x$
  declare r bigint;
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select spin1 from f), (select aw1 from f) , true)
      on conflict (spin_id, award_id) do update set is_shared = true
      returning id into r;
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  'IC909', null,
  '⭐ M1(1): a SOLE winner with is_shared=true raises IC909 at the deferred check');

select throws_ok($q$
  do $x$
  begin
    set constraints all deferred;
    update public.award_result set is_shared = false
     where spin_id = (select spin2 from f) and award_id = (select aw2 from f);
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  'IC909', null,
  '⭐ M1(1): TWO co-winners with is_shared=false raises IC909 — the flag may not drift downward either');

select throws_ok($q$
  do $x$
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select spin1 from f), (select aw1 from f), true)
      on conflict (spin_id, award_id) do update set is_shared = true;
    delete from public.award_result_winner
     where award_result_id = (select id from public.award_result
                               where spin_id = (select spin1 from f)
                                 and award_id = (select aw1 from f));
    set constraints public.award_result_winner_is_shared_consistent immediate;
  end
  $x$
$q$,
  'IC909', null,
  'M1(1): NO winners with is_shared=true raises IC909 — an award nobody won is not shared');

select throws_ok($q$
  do $x$
  begin
    set constraints all deferred;
    delete from public.award_result_winner
     where spin_id = (select spin2 from f)
       and winner_entry_id = (select caro from f);
    set constraints all immediate;
  end
  $x$
$q$,
  'IC909', null,
  'M1(1): removing one of two co-winners without clearing is_shared raises IC909 — the DELETE side fires too');

-- ⭐⭐ THE MOVE-A-WINNER CASE, ADDED AT CODE REVIEW — and the one the first trigger missed entirely.
-- Re-parenting one co-winner of a SHARED award to a different award_result changes the count on BOTH
-- sides, but the trigger only ever looked at `new.award_result_id`. The SOURCE was left holding one
-- winner row with is_shared still true — `is_shared` drifted, IC909 never fired, and that is exactly
-- the M1(1) failure the trigger exists to close. Neither unique constraint catches it: the
-- (award_result_id, winner_entry_id) key sees no duplicate and the anti-sweep key sees no second
-- trophy in the spin.
select throws_ok($q$
  do $x$
  declare dst bigint;
  begin
    set constraints all deferred;
    insert into public.spin (ceremony_id, spin_index, kind)
      values ((select ceremony_id from f), 9, 'main');
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select id from public.spin where spin_index = 9), (select aw1 from f), false)
      returning id into dst;
    update public.award_result_winner
       set award_result_id = dst,
           spin_id         = (select id from public.spin where spin_index = 9)
     where spin_id = (select spin2 from f)
       and winner_entry_id = (select caro from f);
    set constraints all immediate;
  end
  $x$
$q$,
  'IC909', null,
  '⭐ M1(1): MOVING one of two co-winners to another award_result raises IC909 — the SOURCE parent is re-checked, not just the destination');

-- …and the three LEGAL shapes commit cleanly, or every assertion above is satisfied by a trigger
-- that refuses everything (6-4a's untyped-refusal lesson, at the database).
--
-- ⚠ THIS CONTROL NOW WRITES. It used to be a bare `set constraints all deferred; … all immediate;`
-- with no DML, and `SET CONSTRAINTS ALL IMMEDIATE` fires only PENDING deferred trigger events — a
-- constraint trigger does not re-validate existing rows. With nothing written, what it fired
-- depended entirely on which events happened to still be queued after a long run of rolled-back
-- `throws_ok` subtransactions; if the queue was empty it passed having asserted NOTHING. A positive
-- control that can be satisfied by a trigger which never runs defeats its own purpose. It now
-- touches a legal row so the trigger provably fires and provably allows it.
select lives_ok($q$
  do $x$
  begin
    set constraints all deferred;
    -- A no-op-in-value UPDATE that is still a real row event: it re-asserts the sole/false shape.
    update public.award_result
       set is_shared = false
     where spin_id = (select spin1 from f)
       and award_id = (select aw1 from f);
    set constraints all immediate;
  end
  $x$
$q$,
  'the CURRENT state (sole/false + pair/true + a sole/false in spin 2) satisfies the trigger — the positive control, and it FIRES the trigger rather than relying on a queue that may be empty');

select lives_ok($q$
  do $x$
  declare r bigint;
  begin
    set constraints all deferred;
    insert into public.spin (ceremony_id, spin_index, kind)
      values ((select ceremony_id from f), 7, 'main');
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select id from public.spin where spin_index = 7), (select aw1 from f), false)
      returning id into r;
    set constraints all immediate;
  end
  $x$
$q$,
  'an award with NO winners and is_shared=false is legal (no_eligible_players / no_awardable_value)');

select lives_ok($q$
  do $x$
  declare r bigint;
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select id from public.spin where spin_index = 7), (select aw2 from f), true)
      returning id into r;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, (select id from public.spin where spin_index = 7), (select ana from f)),
             (r, (select id from public.spin where spin_index = 7), (select beto from f));
    set constraints all immediate;
  end
  $x$
$q$,
  'the writer''s natural order — result first, then its two winners — is legal because the check is DEFERRED');

select is((select is_shared from public.award_result
            where spin_id = (select id from public.spin where spin_index = 7)
              and award_id = (select aw2 from f)), true,
  'and the shared row really is stored as shared');

-- ============================================================================
-- Section F — the declared ON DELETE behaviour  (5)
-- ============================================================================
select lives_ok($$
  delete from public.spin where spin_index = 7$$,
  'deleting a spin cascades to its award_result rows (on delete cascade)');
select is((select count(*)::int from public.award_result_winner arw
            join public.spin s on s.id = arw.spin_id where s.spin_index = 7), 0,
  '…and on to their award_result_winner rows');

-- ⚠ THE CONSTRAINT NAME, NOT A BARE 23503 — these two passed `null` for the expected message and
-- therefore violated this file's own header rule. `roster_entry` and `award` are each referenced by
-- several tables in this schema, so a `23503` raised by an UNRELATED foreign key satisfied the
-- assertion and neither test proved anything about `award_result_winner`'s or `award_result`'s
-- `on delete restrict`. The code review measured it.
select throws_ok($$
  delete from public.roster_entry where id = (select ana from f)$$,
  '23503',
  'update or delete on table "roster_entry" violates foreign key constraint "award_result_winner_entry_fk" on table "award_result_winner"',
  'deleting a roster_entry that holds a trophy is RESTRICTED — a trophy may not become an orphan');

select throws_ok($$
  delete from public.award where id = (select aw1 from f)$$,
  '23503',
  'update or delete on table "award" violates foreign key constraint "award_result_award_fk" on table "award_result"',
  'deleting an award that has a result is RESTRICTED (SOLUTION-DESIGN:218''s on delete restrict)');

-- ⭐ THE DELETE-PRIOR-ON-RERUN CONTRACT, EXERCISED. With unique (spin_id, winner_entry_id) in place,
-- a re-run that does NOT clean up hard-fails on insert — so the round trip is the mechanism, not a
-- recommendation.
select lives_ok($q$
  do $x$
  declare r bigint;
  begin
    set constraints all deferred;
    delete from public.award_result where spin_id = (select spin1 from f);
    insert into public.award_result (spin_id, award_id, is_shared)
      values ((select spin1 from f), (select aw1 from f), false) returning id into r;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, (select spin1 from f), (select ana from f));
    set constraints all immediate;
  end
  $x$
$q$,
  '⭐ delete-prior-on-rerun: re-running a spin after deleting its prior results re-inserts cleanly');

-- ============================================================================
-- Section G — AC3: `ceremony.luck_weight_table` stops being a SHELL  (20)
-- ============================================================================
-- ⚠ `has_check('public','ceremony', …)` USED TO STAND HERE AND COULD NOT FAIL: it asserts only that
-- the table has AT LEAST ONE check constraint, and `ceremony` is a pre-existing 0024 table that has
-- several. Dropping `ceremony_luck_weight_table_valid` entirely left it green while its description
-- claimed the opposite. Replaced with the assertion it was pretending to be — the constraint exists,
-- BY NAME, on this table.
select is(
  (select count(*)::int from pg_constraint
    where conname = 'ceremony_luck_weight_table_valid'
      and conrelid = 'public.ceremony'::regclass
      and contype = 'c'),
  1,
  'ceremony: the luck_weight_table CHECK exists on this table, by name');
select is(
  (select pg_get_expr(conbin, conrelid) from pg_constraint
    where conname = 'ceremony_luck_weight_table_valid'),
  '(luck_weight_table_valid(luck_weight_table) IS TRUE)',
  'ceremony_luck_weight_table_valid is the shape guard, by name');

-- ⚠ ASSERTED SEMANTICALLY, NOT BY THE RENDERED `column_default` STRING. Postgres normalises the
-- literal (`ARRAY[100, 40, 16, 6, 2, 1]`, not the `'{…}'::integer[]` form it was written in), so a
-- text comparison pins the deparser rather than the value. Inserting a FRESH ceremony row also
-- proves something the backfill test cannot: that the DEFAULT applies to rows created from now on,
-- which is the half Story 6.8's writer will actually rely on.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T7');
insert into ceremony (tournament_id) values ((select id from tournament where name = 'T7'));
select is(
  (select luck_weight_table from public.ceremony
    where tournament_id = (select id from tournament where name = 'T7')),
  array[100, 40, 16, 6, 2, 1],
  'a FRESH ceremony row takes SOLUTION-DESIGN §9.2''s own table by DEFAULT — the VALUES Story 6.6 ships');

select is((select count(*)::int from public.ceremony where luck_weight_table is null), 0,
  'the SHELL 0024 created is BACKFILLED — no ceremony row is left without a luck table');

-- ⚠ SCOPED TO T6, THE BACKFILLED ROW. This said `limit 1` with no ORDER BY while TWO ceremony rows
-- existed — T6's, populated by the BACKFILL, and T7's, populated by the column DEFAULT. The test
-- titled "the backfilled value" could therefore be reading the DEFAULT row and re-testing the
-- previous assertion. It passed only because both mechanisms happen to write the same six integers,
-- i.e. it could not distinguish the two things it claimed to assert.
select is((select c.luck_weight_table from public.ceremony c
             join tournament t on t.id = c.tournament_id where t.name = 'T6'),
  array[100, 40, 16, 6, 2, 1],
  'the BACKFILLED value (T6, written by the backfill — not the DEFAULT) is the shipped table');

-- ⭐ RE-DERIVED FROM THE COLUMN, NOT TRANSCRIBED: the two properties FR-26 actually depends on.
select is((select c.luck_weight_table[1] from public.ceremony c
             join tournament t on t.id = c.tournament_id where t.name = 'T6'),
  (select max(v) from public.ceremony c, unnest(c.luck_weight_table) as v),
  '⭐ shelf 0 indexes entry 1, and entry 1 IS the heaviest — FR-26''s bias, re-derived from the stored table');
select is(
  (select count(*)::int from public.ceremony c,
        generate_subscripts(c.luck_weight_table, 1) as i
    where i > 1 and c.luck_weight_table[i] >= c.luck_weight_table[i - 1]),
  0,
  '⭐ the stored table is STRICTLY DECREASING — re-derived, so a re-tuned table cannot silently invert the bias');

select lives_ok($$
  update public.ceremony set luck_weight_table = null$$,
  'NULL is still legal — 0024''s nullability is untouched and an un-run ceremony has no table');
select lives_ok($$
  update public.ceremony set luck_weight_table = array[50, 20, 5]$$,
  'a re-tuned but VALID table is accepted — the column is organizer config, not a constant');

select throws_ok($$
  update public.ceremony set luck_weight_table = array[]::int[]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  'an EMPTY table is refused — there is no index 0 to give the empty shelf');
select throws_ok($$
  update public.ceremony set luck_weight_table = array[100, 0, 16]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  'a ZERO entry is refused — it makes a candidate unpickable while it still occupies the cumulative walk');
select throws_ok($$
  update public.ceremony set luck_weight_table = array[100, -5]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  'a NEGATIVE entry is refused — every weight is a count');
select throws_ok($$
  update public.ceremony set luck_weight_table = array[10, 40]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  '⭐ a NON-DECREASING table is refused — it would invert FR-26''s bias toward the empty shelf, and nothing downstream would look wrong');
select throws_ok($$
  update public.ceremony set luck_weight_table = array[40, 40]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  'EQUAL adjacent entries are refused too — "strictly" decreasing, not merely non-increasing');

-- ⭐⭐ FOUR SHAPES THE GUARD REFUSES AND NOTHING EXERCISED, ADDED AT CODE REVIEW. Each corresponds to
-- a branch of `luck_weight_table_valid` that had no test, and for two of them I traced the
-- fallthrough: with the branch removed the value is ACCEPTED, so these are not decoration.
select throws_ok($$
  update public.ceremony set luck_weight_table = array[100]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  '⭐ a ONE-ENTRY table is refused — "strictly decreasing" is VACUOUS over a single element, so every other rule passes while the meter clamps every shelf to index 0 and FR-26''s bias is silently OFF');

select throws_ok($$
  update public.ceremony set luck_weight_table = array[[100, 40], [16, 6]]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  '⭐ a TWO-DIMENSIONAL array is refused — `int[]` does not constrain dimensionality, and without the array_ndims branch `unnest` FLATTENS it so every element passes while `t[i]` on a 2-D array yields NULL and the decreasing check silently succeeds');

select throws_ok($$
  update public.ceremony set luck_weight_table = '[0:2]={100,40,16}'::int[]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  '⭐ a table whose subscripts do not start at 1 is refused — FR-26 indexes `table[shelf + 1]`, and without the array_lower branch only the last pair is ever compared');

select throws_ok($$
  update public.ceremony set luck_weight_table = array[100, null, 16]$$,
  '23514',
  'new row for relation "ceremony" violates check constraint "ceremony_luck_weight_table_valid"',
  'a NULL entry is refused — the `v is null` half of the element check, which only the `v <= 0` half was exercising');

select is((select provolatile::text from pg_proc
            where proname = 'luck_weight_table_valid'
              and pronamespace = 'public'::regnamespace), 'i',
  'luck_weight_table_valid is IMMUTABLE — a CHECK may only call an immutable function');
select ok(
  (select public.luck_weight_table_valid(array[100, 40, 16, 6, 2, 1])),
  'the helper accepts the shipped table — the positive control, without which every refusal above passes for the wrong reason');

select * from finish();
rollback;
