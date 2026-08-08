-- supabase/tests/0027_ceremony_run_test.sql
-- pgTAP proof for migration 0027 (Story 6.8a): the ceremony RUNS, the rows EXIST, and they cannot
-- lie about themselves (FR-25/26/28/29 · AD-6 · AD-13 · AD-15 · AD-19 · AD-22).
-- Run via: supabase test db. Runs inside a transaction and rolls back.
--
--   AC5  the is_pity ⇄ spin.kind bind, refused in BOTH directions, BY NAME        -> Section B
--   AC6  ceremony.state forward-only + the two write-once columns (IC910)          -> Section C
--   AC7  outcome_kind's closed set, the never-persisted `tie`, the rate pair,
--        and the nullif(exit_step, 0) mapping                                      -> Section D
--   AC3  persist_ceremony: every typed refusal, before any write                   -> Section E
--   AC1/AC4/AC8  the happy path, the pity shape, the plan, and p_replace           -> Section F
--   —    the is_shared trigger under a NON-BYPASSRLS role (deferred-work.md:333)   -> Section G
--   AC9  ⭐ THE POSTURE HAS NOT MOVED — asserted WITH ROWS PRESENT                 -> Section H
--
-- ⚠⚠ WHY CONSTRAINT NAMES, NOT BARE SQLSTATES. Every CHECK raises the same 23514, so a `throws_ok`
-- on the code alone would pass for the wrong reason — the trap the 4.3 review found across three
-- suites and 6.1 re-hit. Every negative test below asserts the CONSTRAINT NAME in the message.
--
-- ⚠ EVERY `persist_ceremony` REFUSAL GOES THROUGH `pg_temp.probe_persist`, which catches `when
-- others` and returns the SQLSTATE as text. Without it a mutant that RAISES where the shipped
-- function RETURNS would abort the whole transaction and take every later test with it — the file
-- would go red in a way that says nothing about which guard broke (the 6.1 pattern, `6-2-...md:139`).
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action
-- Item #3), with a CONTROL PASS on unmutated source first. The matrix is in the story's Completion
-- Notes.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- ⚠⚠ THE PER-SECTION COUNTS BELOW AND THE BANNER ON EACH SECTION ARE THE ONLY MECHANISM FOR SPOTTING
-- AN ASSERTION ADDED OR LOST WITHOUT THE PLAN BEING UPDATED, AND TWO OF THEM WERE WRONG BEFORE THE
-- 6.8a CODE REVIEW (Section E's banner said 12 against 15 assertions; Section G's said 2 against 4).
-- The file still passed, because `plan()` counts the total — which is exactly how a stale banner
-- survives. Both are now derived by counting the assertion calls in the file rather than by hand.
--
-- plan(103) = A 16 + B 6 + C 17 + D 10 + E 29 + F 17 + G 7 + H 1, accounted for section by section:
--   A 14 — shape: spin_id_kind_key exists AND is unique · award_result.kind exists · is NOT NULL ·
--          award_result_spin_kind_fk targets spin · award_result_is_pity_matches_kind exists by name
--          and carries the IS TRUE wrapper · outcome_kind exists and is NOT NULL ·
--          award_result_outcome_kind_valid names exactly the five OutcomeKinds ·
--          award_result_outcome_kind_not_tie exists · deciding_num/deciding_den are NULLABLE ·
--          ⭐ the four pre-existing indexes are asserted UNIQUE, not merely present — the gap
--          deferred-work.md:334 records (`has_index` does not assert uniqueness) · persist_ceremony
--          exists and is security INVOKER.
--   B  6 — ⭐ THE FLAGSHIP: is_pity=true on a kind='main' spin is REFUSED BY NAME · is_pity=false on
--          a kind='pity' spin is REFUSED BY NAME (both directions, AC5's explicit requirement) ·
--          both LEGAL pairings insert (the positive controls) · a kind that disagrees with its own
--          spin is refused by the COMPOSITE FK, not by the CHECK · ⭐ the second-order repair: a
--          main-spin result can no longer omit its award, so award_result_spin_award_key bounds a
--          main spin again.
--   C 12 — every LEGAL transition (not_started->locked, locked->spinning, spinning->complete) ·
--          every BACKWARD step refused (4) · every SKIP refused (2) · snapshot_id write-once ·
--          seed_demo_sha256 write-once · re-writing the SAME value is a no-op.
--   D 10 — the outcome_kind CHECK refuses an unknown value BY NAME · admits all four persistable
--          values (4 lives_ok) · ⭐ refuses 'tie' by its OWN constraint name · the deciding-pair
--          CHECK refuses a half pair BY NAME · admits a complete pair · ⭐ the nullif(v,0) mapping:
--          the engine's 0 sentinel lands as SQL NULL, and a real rung lands as itself.
--   E 15 — persist_ceremony's typed refusals, ALL FIFTEEN, each via the probe: no_ceremony ·
--          ceremony_not_locked · ⭐ snapshot_missing · ⭐ seed_missing · ⭐ invalid_ladder_exit_step ·
--          seed_mismatch · no_spins · no_spin_plan · spin_index_not_dense · invalid_spin_kind ·
--          unknown_award · unknown_player · invalid_outcome_kind · outcome_kind_tie ·
--          winner_cardinality. ⭐ The three starred rows exist BECAUSE THE MUTATION PASS FOUND THEM
--          UNCOVERED — deleting each of those guards left all 65 other tests green, because every
--          fixture already satisfied the precondition the guard exists to check.
--   F  6 — ⭐ the happy path commits · it wrote the expected row counts · revealed_at is NULL on
--          EVERY spin · ceremony.spin_plan and state='spinning' were published by the same call ·
--          a second call WITHOUT p_replace refuses `already_persisted` · a second call WITH
--          p_replace replaces atomically and the audit row records both counts.
--   G  4 — ⭐ the is_shared trigger under a role WITHOUT BYPASSRLS that cannot SELECT the rows it
--          wrote: a drifting row still raises IC909 (it FAILED OPEN before 0027 made the function
--          security definer) · a correct row still commits (the positive control) · ⭐ AC7's
--          cardinality branch driven DIRECTLY at the trigger, by SQLSTATE and by message pattern —
--          added because the mutation pass found it uncovered: every path through persist_ceremony is
--          stopped by the RPC's own winner_cardinality guard, so deleting the trigger branch left the
--          suite green even though service_role can reach the table without the RPC.
--   H  1 — ⭐ AC9: with rows in all four tables, neither anon nor authenticated holds ANY of the four
--          data verbs on ANY of them, the policy set is still exactly 0023's dormant
--          award.award_admin_read, and all four are still ENABLE+FORCE.
select plan(103);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T8');

insert into player (steamid64, display_name) values
  ('76561198000000011', 'Ana'),
  ('76561198000000022', 'Beto'),
  ('76561198000000033', 'Caro');

insert into roster_entry (tournament_id, steamid64)
select (select id from tournament where name = 'T8'), s
  from (values ('76561198000000011'), ('76561198000000022'), ('76561198000000033')) as v(s);

insert into award (tournament_id, name, bucket, class, deciding_stat, priority) values
  ((select id from tournament where name = 'T8'), 'Cuchillero', 'weird', 'volume', 'knife_kills', 1),
  ((select id from tournament where name = 'T8'), 'Muralla',    'skill', 'volume', 'wallbang_kills', 2);

insert into stat_snapshot (tournament_id, content_sha256)
  values ((select id from tournament where name = 'T8'),
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

-- ⭐ THE CEREMONY IS INSERTED ALREADY `locked` WITH ITS SNAPSHOT AND SEED FROZEN — the exact state
-- `lock_ceremony` leaves behind, which is persist_ceremony's only legal entry point. Inserted rather
-- than produced by calling lock_ceremony, because that RPC needs a whole approved bracket and this
-- file is about what happens AFTER it.
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'T8'), 'locked',
          '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
          (select id from stat_snapshot limit 1));

-- A SECOND ceremony, left at `not_started`, so Section C can walk the state machine forward without
-- disturbing the one Sections E/F persist into.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T9');
insert into ceremony (tournament_id) values ((select id from tournament where name = 'T9'));

-- ⚠⚠ A THIRD CEREMONY HOLDS THE CONSTRAINT-SHAPE SPINS, AND THAT SEPARATION IS LOAD-BEARING.
-- `persist_ceremony`'s `already_persisted` guard counts `spin` rows for the target ceremony, so
-- hanging Sections B/D/G's probe spins off the SAME ceremony Sections E/F persist into would make the
-- writer refuse `already_persisted` before it ever reached the code those sections test — and the
-- row-count assertions would then have compared 0 against 0.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T10');
insert into ceremony (tournament_id) values ((select id from tournament where name = 'T10'));

insert into spin (ceremony_id, spin_index, kind) values
  ((select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T10'), 90, 'main'),
  ((select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T10'), 91, 'pity');

-- ⭐⭐ TWO HALF-READY CEREMONIES, ADDED BY THE MUTATION PASS. Deleting persist_ceremony's
-- `snapshot_missing` and `seed_missing` refusals left the whole suite GREEN, because every ceremony
-- in this file already had both — the guards were untested, not merely under-tested. These two rows
-- are the only inputs that can reach them: `locked` with one half of AD-13/AD-15 still absent, which
-- is exactly the state a partially-completed lock would leave.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T11');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'T11'), 'locked', repeat('d', 64), null);

insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T12');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'T12'), 'locked', null,
          (select id from stat_snapshot limit 1));

-- ⭐ A VIRGIN CEREMONY FOR THE FREEZE'S PERMISSIVE DIRECTION (Story 6.8a code review). Section C
-- proved value->NULL, value->different and value->same, but nothing ever wrote a snapshot or a seed
-- into a ceremony that had NEITHER — so a mutant dropping the `old.<col> is not null and` prefix from
-- both write-once guards survived the whole section, and that mutant BREAKS `lock_ceremony`, whose
-- entire job is exactly this NULL -> value transition (`0024:815-819`).
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T13');
insert into ceremony (tournament_id) values ((select id from tournament where name = 'T13'));

-- Re-derived rather than hardcoded, and SCOPED BY NAME rather than `limit 1` — the correction 0025's
-- and 0026's reviews both made to their own views.
create temporary view f as
select
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T8') as ceremony_id,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T9') as fresh_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T10') as shape_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T11') as no_snapshot_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T12') as no_seed_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T13') as virgin_ceremony,
  (select id from tournament where name = 'T13')                       as other_tournament,
  (select id from tournament where name = 'T8')                        as tournament_id,
  (select id from spin where spin_index = 90)                          as main_spin,
  (select id from spin where spin_index = 91)                          as pity_spin,
  (select id from award where name = 'Cuchillero')                     as aw1,
  (select id from award where name = 'Muralla')                        as aw2,
  (select id from roster_entry where steamid64 = '76561198000000011')  as ana,
  (select id from roster_entry where steamid64 = '76561198000000022')  as beto,
  (select id from roster_entry where steamid64 = '76561198000000033')  as caro;

-- ⚠ THE PROBE. persist_ceremony RETURNS its business refusals, so a passing test could read the
-- reason directly — but a MUTANT that raises instead would abort the transaction and redden every
-- later test for an unrelated reason. This wrapper turns any raise into a readable value, so the
-- mutation pass gets one named failure instead of a cascade.
create function pg_temp.probe_persist(
  p_ceremony bigint, p_run jsonb, p_actor text, p_replace boolean default false
) returns text language plpgsql as $$
declare r jsonb;
begin
  r := public.persist_ceremony(p_ceremony, p_run, p_actor, p_replace);
  if coalesce((r ->> 'ok')::boolean, false) then
    return 'ok';
  end if;
  return coalesce(r ->> 'reason', 'no_reason');
exception when others then
  return 'raised:' || sqlstate;
end;
$$;

-- The canonical well-formed run: two main spins (one winner, one no_eligible_players) and one pity
-- spin carrying exactly one consolation winner. Built from `f` so an id change cannot silently
-- retarget it.
create function pg_temp.run_payload() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'seed_hex', '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
    'spin_plan', jsonb_build_array(
      jsonb_build_object('spin', 1, 'pool',
        jsonb_build_array((select aw1 from f)::text, (select aw2 from f)::text), 'live_count', 1),
      jsonb_build_object('spin', 2, 'pool',
        jsonb_build_array((select aw2 from f)::text), 'live_count', 1)
    ),
    'spins', jsonb_build_array(
      jsonb_build_object(
        'spin_index', 1, 'kind', 'main', 'label', 'inclusivcup/v1/stage1/spin/1',
        'bytes_consumed', 1,
        'live_award_ids', jsonb_build_array((select aw1 from f)::text),
        'results', jsonb_build_array(jsonb_build_object(
          'award_id', (select aw1 from f)::text, 'outcome_kind', 'winner',
          'deciding_value', '7', 'tie_ladder_exit_step', 0,
          'winners', jsonb_build_array('76561198000000011')))
      ),
      jsonb_build_object(
        'spin_index', 2, 'kind', 'main', 'label', 'inclusivcup/v1/stage1/spin/2',
        'bytes_consumed', 1,
        'live_award_ids', jsonb_build_array((select aw2 from f)::text),
        'results', jsonb_build_array(jsonb_build_object(
          'award_id', (select aw2 from f)::text, 'outcome_kind', 'no_eligible_players',
          'tie_ladder_exit_step', 0, 'winners', jsonb_build_array()))
      ),
      jsonb_build_object(
        'spin_index', 3, 'kind', 'pity', 'label', 'inclusivcup/v1/pity', 'bytes_consumed', 2,
        'live_award_ids', jsonb_build_array(),
        'results', jsonb_build_array(jsonb_build_object(
          'award_id', null, 'outcome_kind', 'winner', 'tie_ladder_exit_step', 0,
          'winners', jsonb_build_array('76561198000000022')))
      )
    )
  );
$$;

-- ============================================================================
-- Section A — the shape 0027 lands, and the UNIQUE assertions 0025's suite owed  (16)
-- ============================================================================
select has_index('public', 'spin', 'spin_id_kind_key',
  'spin: the redundant unique (id, kind) exists — the composite-FK target that makes the bind expressible');
select index_is_unique('public', 'spin', 'spin_id_kind_key',
  'spin_id_kind_key is genuinely UNIQUE — a non-unique index cannot be an FK target at all');

select has_column('public', 'award_result', 'kind',
  'award_result.kind exists — spin.kind denormalized so the bind can be declarative');
select col_not_null('public', 'award_result', 'kind',
  'award_result.kind is NOT NULL with no default — a result always knows which kind of spin it is on');
select is(
  (select confrelid::regclass::text from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_spin_kind_fk'),
  'spin',
  'award_result_spin_kind_fk really targets spin — a COMPOSITE FK on (spin_id, kind), not a second single-column one');

select isnt(
  (select conname::text from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_is_pity_matches_kind'),
  null,
  'award_result_is_pity_matches_kind exists BY NAME — every CHECK raises 23514, so the name is what Section B can assert');
select matches(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_is_pity_matches_kind'),
  'IS TRUE',
  '⭐ the bind carries the IS TRUE wrapper — a CHECK whose expression is NULL is SATISFIED, the defect 0025''s first luck_weight_table_valid shipped with');

select col_not_null('public', 'award_result', 'outcome_kind',
  'award_result.outcome_kind is NOT NULL — every result records what it concluded, and a DEFAULT would be a fabricated answer');
-- ⭐ THE CLOSED SET IS ASSERTED AS THE ENGINE'S FIVE, re-derived from the constraint definition rather
-- than transcribed. `OutcomeKind` (worker/awards/stage2.go:226-243) is the contract 6.9's bundle
-- canonicalizes against; a sixth added on one side alone must redden here.
-- ⛔⛔ A SET EQUALITY, NOT A HIT COUNT, AND THE DIFFERENCE IS THE WHOLE ASSERTION (Story 6.8a code
-- review). This previously counted how many of five EXPECTED literals appeared in the constraint
-- definition and asserted the answer was 5 — which is satisfied by a constraint naming six, or ten.
-- The "no more" half of its own description was untested, and adding 'bonus' to the CHECK left it
-- green while `assert_award_result_is_shared`'s cardinality arms fell open on the new value. Reading
-- the literals OUT of the definition and comparing the SET is what makes a sixth value red.
select is(
  (select array_agg(m[1] order by m[1])
     from regexp_matches(
            (select pg_get_constraintdef(oid) from pg_constraint
              where conrelid = 'public.award_result'::regclass
                and conname = 'award_result_outcome_kind_valid'),
            '''([a-z_]+)''', 'g') as m),
  array['no_awardable_value', 'no_eligible_players', 'shared', 'tie', 'winner']::text[],
  'award_result_outcome_kind_valid names EXACTLY the five OutcomeKind values — no more and no fewer, asserted as a set');
select isnt(
  (select conname::text from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_outcome_kind_not_tie'),
  null,
  '⭐ award_result_outcome_kind_not_tie is its OWN constraint — "not a legal kind" and "not a legal PERSISTED kind" are different facts and need two names');

select col_is_null('public', 'award_result', 'deciding_num',
  'deciding_num is NULLABLE — a volume award fills deciding_value instead (DECISION 3)');
select col_is_null('public', 'award_result', 'deciding_den',
  'deciding_den is NULLABLE — the other half of the same pair');

-- ⭐⭐ THE GAP `deferred-work.md:334` RECORDS, CLOSED. 0025's suite asserted these three with
-- `has_index`, which proves an index EXISTS and says nothing about whether it is UNIQUE — so a
-- migration that replaced any of them with a plain index would have left that suite green while
-- silently removing the constraint it was testing. This asserts the property that matters.
-- ⛔⛔ COUNTED, NOT `bool_and`-ED, AND SCOPED TO `public` (Story 6.8a code review). `bool_and` over a
-- filtered set returns TRUE when a name is ABSENT — so dropping `award_result_winner_result_key`,
-- which DECISION 5 keeps PURELY for this index, left the assertion green. It also named the wrong
-- four: `deferred-work.md:334` records `award_result_winner_result_key` plus "the other three
-- has_index calls", which are `spin_ceremony_index_key` (`0025:131`), `award_result_spin_award_key`
-- (`:206`) and `award_result_id_spin_key` (`:210`) — and `spin_ceremony_index_key` was the one
-- silently swapped out. And without a `relnamespace` filter, a same-named index in ANY schema
-- participated. Counting rows that are BOTH present AND unique catches all three failures at once.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_index i on i.indexrelid = c.oid
    where n.nspname = 'public'
      and i.indisunique
      and c.relname in ('spin_ceremony_index_key', 'award_result_spin_award_key',
                        'award_result_id_spin_key', 'award_result_winner_result_key',
                        'award_result_winner_spin_key')),
  5,
  '⭐ all five pre-0027 indexes are PRESENT and genuinely UNIQUE — has_index asserted neither (deferred-work.md:334)');

-- ⭐ LEAST PRIVILEGE ON BOTH NEW TRIGGER FUNCTIONS. 0027 revoked PUBLIC execute on
-- `assert_award_result_is_shared` and — until the 6.8a code review — not on
-- `assert_ceremony_transition`, though the stated rationale ("a trigger function does not need an
-- EXECUTE grant to FIRE") is independent of `security definer` and applies to both.
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('assert_award_result_is_shared', 'assert_ceremony_transition')
      and has_function_privilege('public', p.oid, 'execute')),
  0,
  '⭐ NEITHER new trigger function is executable by PUBLIC — create function grants it and anon/authenticated inherit');

-- ⭐⭐ THE `security definer` FIX DEPENDS ON THE OWNER'S BYPASSRLS, AND THAT IS NOW ASSERTED RATHER
-- THAN ASSUMED (Story 6.8a code review). `award_result` and `award_result_winner` are FORCE ROW LEVEL
-- SECURITY, and FORCE — unlike plain ENABLE — applies RLS to the table OWNER too. So `security
-- definer` ALONE does not let this function see every row; what does is the owner role's BYPASSRLS
-- attribute. If ownership is ever reassigned to a role without it, the function silently reverts to
-- the deferred-work.md:333 FAIL-OPEN with Section G still green, because Section G runs as postgres.
select ok(
  (select r.rolbypassrls
     from pg_proc p
     join pg_roles r on r.oid = p.proowner
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_award_result_is_shared'),
  '⭐ assert_award_result_is_shared is owned by a BYPASSRLS role — under FORCE RLS, security definer alone would still be fail-open');

select is(
  (select prosecdef from pg_proc where proname = 'persist_ceremony'),
  false,
  'persist_ceremony is security INVOKER — definer is reserved for anon-reachable narrow reads (0023:196-198)');

-- ============================================================================
-- Section B — ⭐ AC5: is_pity and spin.kind cannot disagree, in BOTH directions  (6)
-- ============================================================================
select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select main_spin from f), 'main', (select aw1 from f), 'no_eligible_players', true)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_is_pity_matches_kind"',
  '⭐ DIRECTION 1: is_pity=true on a kind=''main'' spin is REFUSED by name — the state deferred-work.md:357 measured as representable');

-- ⚠ THIS ROW NAMES AN AWARD ON PURPOSE, and the first draft did not — which made it violate TWO
-- constraints at once (`award_result_award_or_pity` fires on is_pity=false + a NULL award) and
-- therefore assert a constraint name by luck of OID order. 0026 leaves "a pity result that DOES name
-- an award" deliberately representable, so this row breaks EXACTLY the bind under test.
select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select pity_spin from f), 'pity', (select aw1 from f), 'no_eligible_players', false)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_is_pity_matches_kind"',
  '⭐ DIRECTION 2: is_pity=false on a kind=''pity'' spin is REFUSED by name — AC5 requires BOTH directions, not one');

select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select main_spin from f), 'main', (select aw1 from f), 'no_eligible_players', false)$$,
  'the legal MAIN pairing inserts — the positive control, without which both refusals above could pass for the wrong reason');

select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select pity_spin from f), 'pity', null, 'no_eligible_players', true)$$,
  'the legal PITY pairing inserts — the other positive control');

-- ⚠ A `kind` THAT DISAGREES WITH ITS OWN SPIN IS REFUSED BY THE COMPOSITE FK, NOT BY THE CHECK, and
-- the two are different mechanisms doing different halves of the job. The CHECK binds `is_pity` to
-- `kind`; the FK binds `kind` to the SPIN. Without the FK a writer could satisfy the CHECK with a
-- self-consistent lie (kind='pity', is_pity=true) on a main spin.
select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select main_spin from f), 'pity', null, 'no_eligible_players', true)$$,
  '23503',
  'insert or update on table "award_result" violates foreign key constraint "award_result_spin_kind_fk"',
  '⭐ a self-consistent LIE — kind=''pity'' on a kind=''main'' spin — is refused by the COMPOSITE FK, which is the half the CHECK cannot do');

-- ⭐⭐ THE SECOND-ORDER REPAIR deferred-work.md:357 is really about. Because a main-spin row is now
-- forced to be non-pity, 0026's award_result_award_or_pity forces it to name an award — so
-- award_result_spin_award_key bounds a main spin's results again instead of being defeated by
-- NULL-distinctness. Before 0027, unlimited award-less rows could accumulate inside one main spin.
select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select main_spin from f), 'main', null, 'no_eligible_players', false)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_award_or_pity"',
  '⭐ a MAIN-spin row can no longer omit its award, so the (spin, award) UNIQUE bounds a main spin again — the second-order hole deferred-work.md:357 measured');

delete from public.award_result;

-- ============================================================================
-- Section C — AC6: ceremony.state advances by MECHANISM (IC910)  (17)
-- ============================================================================
-- ⚠ EVERY TRANSITION IS EXERCISED ON THE `T9` CEREMONY, which starts at not_started and is touched by
-- nothing else in this file.
select lives_ok($$
  update public.ceremony set state = 'locked' where id = (select fresh_ceremony from f)$$,
  'not_started -> locked is LEGAL (this is lock_ceremony''s own transition)');
select lives_ok($$
  update public.ceremony set state = 'spinning' where id = (select fresh_ceremony from f)$$,
  'locked -> spinning is LEGAL (persist_ceremony''s transition, Story 6.8a)');
select lives_ok($$
  update public.ceremony set state = 'complete' where id = (select fresh_ceremony from f)$$,
  'spinning -> complete is LEGAL — 0027 permits it so Story 6.8b can write it without a migration');

select throws_ok($$
  update public.ceremony set state = 'spinning' where id = (select fresh_ceremony from f)$$,
  'IC910', null,
  '⭐ complete -> spinning is REFUSED — backward is the direction deferred-work.md:277 is about');
select throws_ok($$
  update public.ceremony set state = 'not_started' where id = (select fresh_ceremony from f)$$,
  'IC910', null,
  '⭐⭐ complete -> not_started is REFUSED — this is the exact statement that re-opened all four ceremony_locked guards AND catalog_frozen');
select throws_like($$
  update public.ceremony set state = 'not_started' where id = (select fresh_ceremony from f)$$,
  '%advances forward one step at a time%',
  '…and IC910''s MESSAGE names the rule, so another raise reusing the code would not satisfy this pair');

select throws_ok($$
  update public.ceremony set state = 'locked' where id = (select fresh_ceremony from f)$$,
  'IC910', null,
  'complete -> locked is REFUSED — backward by two steps is still backward');

-- The T8 ceremony is still `locked`; skipping forward is refused from there.
select throws_ok($$
  update public.ceremony set state = 'complete' where id = (select ceremony_id from f)$$,
  'IC910', null,
  '⭐ locked -> complete is REFUSED — forward, but SKIPPING spinning, which would publish a ceremony that never ran');

-- ⚠ `not_started -> spinning` is the other skip, and it needs a ceremony still at not_started — T10's,
-- which Sections B/D/G use only for their spin rows and never move.
select throws_ok($$
  update public.ceremony set state = 'spinning' where id = (select shape_ceremony from f)$$,
  'IC910', null,
  'not_started -> spinning is REFUSED — a ceremony cannot spin without having locked its snapshot first');

-- ── the two WRITE-ONCE columns ───────────────────────────────────────────────
select throws_ok($$
  update public.ceremony set snapshot_id = null where id = (select ceremony_id from f)$$,
  'IC910', null,
  '⭐ snapshot_id is WRITE-ONCE (AD-15): clearing a frozen snapshot is refused — every spin is a pure function of it');
select throws_ok($$
  update public.ceremony set seed_demo_sha256 = repeat('b', 64) where id = (select ceremony_id from f)$$,
  'IC910', null,
  '⭐ seed_demo_sha256 is WRITE-ONCE (AD-13 "published, never re-rolled"): re-keying it draws a different ceremony with nothing else looking wrong');

-- ⚠ THE NO-OP HALF, and it is not decoration: `tournament_fair_seed_write_once` permits
-- value -> THE SAME value for the same reason, and a guard that refused an idempotent re-write would
-- make a re-run of any writer that names the column impossible.
select lives_ok($$
  update public.ceremony
     set seed_demo_sha256 = '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
         snapshot_id      = (select id from stat_snapshot limit 1)
   where id = (select ceremony_id from f)$$,
  'writing the SAME frozen values back is a NO-OP, not an IC910 — an idempotent re-write is not a re-roll');

-- ── C2. THE THREE THINGS SECTION C DID NOT COVER (Story 6.8a code review). ───

-- ⭐⭐ THE PERMISSIVE DIRECTION. AC6 asks for proof "in both directions" and only the refusing one was
-- taken. Both write-once guards are `if old.<col> is not null and …`, so NULL -> value must LIVE —
-- and a mutant dropping that prefix survived all twelve of Section C's assertions while breaking
-- `lock_ceremony`, the only shipped ceremony writer, whose whole job is this transition.
select lives_ok($$
  update public.ceremony
     set state            = 'locked',
         seed_demo_sha256 = repeat('e', 64),
         snapshot_id      = (select id from stat_snapshot limit 1),
         started_at       = now()
   where id = (select virgin_ceremony from f)$$,
  '⭐⭐ AC6, the OTHER direction: NULL -> value is the FREEZE, not a violation of it — and this is lock_ceremony''s exact four-column statement (0024:815-819)');

-- ⭐ THE THIRD GUARDED FACT, WHICH HAD NO TEST AT ALL. DECISION 4 names three: the state machine, the
-- two write-once columns, and `tournament_id`. Only the first two were asserted.
select throws_ok($$
  update public.ceremony set tournament_id = (select other_tournament from f)
   where id = (select ceremony_id from f)$$,
  'IC910', null,
  '⭐ tournament_id is IMMUTABLE (AD-18 scope) — re-pointing a ceremony would silently re-scope every spin, result and winner under it');

-- ⛔⛔ THE FIVE IC910 RAISE SITES ARE DISTINGUISHED BY MESSAGE, NOT ONLY BY SQLSTATE. This file's own
-- header states the rule — "a shared error code makes tests pass for the wrong reason" — and then
-- applied it to the CHECKs and abandoned it for the trigger: six of Section C's assertions pinned
-- `IC910` and nothing else, so a mutant collapsing all five raises into one, or firing the
-- state-machine branch for a write-once update, satisfied every one of them.
select throws_like($$
  update public.ceremony set snapshot_id = null where id = (select ceremony_id from f)$$,
  '%snapshot_id is WRITE-ONCE%',
  '⭐ the snapshot refusal is the SNAPSHOT raise — a mutant that reported the state-machine message here would have passed the old SQLSTATE-only assertion');
select throws_like($$
  update public.ceremony set seed_demo_sha256 = repeat('f', 64)
   where id = (select ceremony_id from f)$$,
  '%seed_demo_sha256 is WRITE-ONCE%',
  '⭐ the seed refusal is the SEED raise, told apart from the snapshot one by message');
select throws_like($$
  update public.ceremony set tournament_id = (select other_tournament from f)
   where id = (select ceremony_id from f)$$,
  '%cannot move between tournaments%',
  '⭐ the scope refusal is the TOURNAMENT raise — four of the five sites now have their own named proof');


-- ============================================================================
-- Section D — AC7: outcome_kind, the never-persisted tie, and the rate pair  (10)
-- ============================================================================
select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind)
  values ((select main_spin from f), 'main', (select aw1 from f), 'winner_ish')$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_outcome_kind_valid"',
  'an outcome_kind outside the engine''s five is REFUSED, and the CONSTRAINT NAME says which check caught it');

select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind)
  values ((select main_spin from f), 'main', (select aw1 from f), 'tie')$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_outcome_kind_not_tie"',
  '⭐ DECISION 2: ''tie'' is in the VOCABULARY and is never PERSISTED — refused by its own constraint, because the FR-29 ladder always resolves a tie first');

select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind)
  values ((select main_spin from f), 'main', (select aw1 from f), 'winner')$$,
  'outcome_kind ''winner'' inserts');
select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind)
  values ((select main_spin from f), 'main', (select aw2 from f), 'no_eligible_players')$$,
  'outcome_kind ''no_eligible_players'' inserts — the kind EVERY main spin resolves at the shipped FR-21 floors');
select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select pity_spin from f), 'pity', null, 'no_awardable_value', true)$$,
  'outcome_kind ''no_awardable_value'' inserts — DECISION E''s zero carve-out, a DIFFERENT fact from no_eligible_players');
select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity)
  values ((select pity_spin from f), 'pity', null, 'shared', true)$$,
  'outcome_kind ''shared'' inserts — FR-29 rung 5''s designed terminal outcome');

delete from public.award_result;

select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, deciding_num)
  values ((select main_spin from f), 'main', (select aw1 from f), 'winner', 5)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_deciding_pair_complete"',
  'HALF a rate pair is REFUSED — {num:5, den:null} is not a rate value, it is a corrupted one, and it would still render as something');

select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, deciding_num, deciding_den)
  values ((select main_spin from f), 'main', (select aw1 from f), 'winner', 5, 0)$$,
  'a COMPLETE pair inserts — including den = 0, which is CORRECT and reachable (stage2.go:136-137), not a defect to coalesce away');

delete from public.award_result;

-- ⛔⛔ THE `0025:162-174` CALLOUT, PROVEN AT THE SEAM. The engine's `LadderExitNone` is the integer 0
-- and the column's "no rung" is SQL NULL; 30 of the 36 result rows in antisweep-resolve.json carry
-- `"ladder_exit_step": 0`, so a writer that inserted the engine's value verbatim would violate
-- award_result_ladder_exit_step_valid on the overwhelmingly common row. These two prove the writer
-- maps it, in both directions, over the REAL RPC rather than over a hand-written INSERT.
-- ⚠ ASSERTED THROUGH THE PROBE, NOT WITH `lives_ok`. `persist_ceremony` RETURNS its refusals, so a
-- `lives_ok` here would pass just as happily on `{ok:false, reason:…}` — a green test for a run that
-- wrote nothing at all, which would then make every count in Section F assert 0 = 0.
select is(pg_temp.probe_persist(
    (select ceremony_id from f), pg_temp.run_payload(), '76561198000000011', false),
  'ok',
  'the writer ACCEPTS a well-formed run — carrying the engine''s 0 exit-step sentinel on every row');
select is(
  (select count(*)::int from public.award_result ar
     join public.spin s on s.id = ar.spin_id
    where s.ceremony_id = (select ceremony_id from f)
      and ar.tie_ladder_exit_step is not null),
  0,
  '⭐ nullif(exit_step, 0): the engine''s 0 landed as SQL NULL on every row — Go''s LadderExitNone and TS''s omitted key are now the SAME spelling');

-- ============================================================================
-- Section F — AC1/AC4/AC8: what the run actually wrote, and the replace path  (17)
-- ============================================================================
-- ⚠ SECTION D's LAST TEST ALREADY PERSISTED THE CANONICAL RUN, deliberately — asserting over it here
-- rather than persisting a second time keeps the row counts unambiguous.
select is(
  (select count(*)::int from public.spin where ceremony_id = (select ceremony_id from f)
     and spin_index between 1 and 3),
  3,
  'AC1: three spins written — two main and one pity, dense from spin_index 1');
select is(
  (select count(*)::int from public.spin s
    where s.ceremony_id = (select ceremony_id from f)
      and s.kind = 'pity' and s.spin_index = 3
      and (select count(*) from public.award_result ar
            where ar.spin_id = s.id and ar.award_id is null
              and ar.is_pity and not ar.is_shared) = 1
      and (select count(*) from public.award_result_winner w
            where w.spin_id = s.id) = 1),
  1,
  '⭐ AC4: pity persisted as its OWN spin carrying ONE award-less result — Story 6.7''s recorded answer (N spins, one winner each), not one shared spin');
select is(
  (select count(*)::int from public.spin
    where ceremony_id = (select ceremony_id from f)
      and spin_index between 1 and 3 and revealed_at is not null),
  0,
  '⭐⭐ AC9/AC3: revealed_at is NULL on EVERY spin the writer wrote — 6.8a makes the rows exist, 6.8b stamps them');
select is(
  (select jsonb_array_length(spin_plan) from public.ceremony where id = (select ceremony_id from f)),
  2,
  'AC1: ceremony.spin_plan was published by the SAME call that wrote the rows, so the plan and the rows cannot disagree');
select is(
  (select state from public.ceremony where id = (select ceremony_id from f)),
  'spinning',
  'AC1: ceremony.state advanced locked -> spinning in the same transaction');

-- ⭐ T4's "MAP, DO NOT ASSUME" FOR `live_award_ids`, WHICH NOTHING READ BEFORE (Story 6.8a code
-- review). The producer's award ids are STRINGS; the column holds `award.id` BIGINTs. No test read
-- the column back after a persist, so a mutant writing `'[]'::jsonb` unconditionally — or dropping
-- the `order by ord` that makes DRAW order the stored order (`0025:127-129`) — survived the suite.
select is(
  (select live_award_ids from public.spin
    where ceremony_id = (select ceremony_id from f) and spin_index = 1),
  jsonb_build_array((select aw1 from f)),
  '⭐ live_award_ids holds the MAPPED bigint, not the producer''s string — and is not empty');

-- ⭐⭐ THE AUDIT ROW, ASSERTED AS A WHOLE OBJECT. 0027's own comment says "EVERY key below is asserted
-- in pgTAP: the 4.2 review found a suite asserting ONE key while a typo in any other would have
-- NULLed the whole payload with the tests still green" — and until the 6.8a code review the string
-- `audit_log` did not appear ANYWHERE in this file. Not one key. Comparing the whole `detail` object
-- is what makes that comment true: rename any key, drop any key, or change any value and this reddens.
select is(
  (select count(*)::int from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)),
  1,
  '⭐ AD-17: EXACTLY ONE audit row per successful run — not zero, not one per spin');
select is(
  (select detail from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)),
  jsonb_build_object(
    'before', jsonb_build_object(
      'ceremony_state', 'locked', 'spins', 0, 'replaced', false),
    'after', jsonb_build_object(
      'ceremony_state', 'spinning',
      'ceremony_id',    (select ceremony_id from f),
      'seed_hex',       '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
      'snapshot_id',    (select id from stat_snapshot limit 1),
      'spins',          3, 'results', 3, 'winners', 2, 'deleted_spins', 0)),
  '⭐⭐ the audit detail carries EVERY before/after key with the right value — a typo in any one of them would have shipped green');
select is(
  (select actor_steamid64 from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)),
  '76561198000000011',
  'the audit row records the ACTOR the RPC was called with');

-- ⭐ AC8 — a second run refuses, and then replaces atomically when told to.
select is(pg_temp.probe_persist((select ceremony_id from f), pg_temp.run_payload(),
                                '76561198000000011', false),
  'already_persisted',
  '⭐ AC8: a second run WITHOUT p_replace refuses with a typed reason rather than appending or 23505-ing');

-- ⭐⭐ THE SUCCESSFUL `p_replace` PATH, WHICH NO COMMITTED TEST EXERCISED (Story 6.8a code review).
-- Every other `p_replace => true` call in this file is a probe that REFUSES, so the `delete from
-- public.spin` branch, `v_deleted`, and the `before.spins` / `after.deleted_spins` keys were dead to
-- the suite — AC8's "records both the deleted and the written counts" rested entirely on THE BAR
-- harness, which the story deleted. It is also the one branch in the RPC that can destroy committed
-- rows, which is the last branch that should be untested.
--
-- ⚠ THE REPLACEMENT PAYLOAD REVERSES SPIN 1's `live_award_ids` ON PURPOSE, so this one call also
-- proves DRAW ORDER IS PRESERVED rather than sorted: [aw2, aw1] is descending by id, so a mutant that
-- dropped `order by ord` (or sorted) would write [aw1, aw2] and redden the next assertion.
-- ⚠ AND IT CARRIES A REAL FR-29 RUNG, which closes the other half of the `nullif(v, 0)` claim. Every
-- result in `run_payload()` carries `tie_ladder_exit_step: 0`, so the Section D assertion above —
-- "the engine's 0 landed as SQL NULL on every row" — is satisfied by an implementation that writes
-- `null` UNCONDITIONALLY. The plan comment claims both directions ("and a real rung lands as itself")
-- and only one was ever asserted. Rung 3 here is what makes the mapping, rather than a constant,
-- the thing under test.
select is(pg_temp.probe_persist(
    (select ceremony_id from f),
    jsonb_set(
      jsonb_set(pg_temp.run_payload(), '{spins,0,live_award_ids}',
                jsonb_build_array((select aw2 from f)::text, (select aw1 from f)::text)),
      '{spins,0,results,0,tie_ladder_exit_step}', '3'::jsonb),
    '76561198000000011', true),
  'ok',
  '⭐ AC8: a second run WITH p_replace succeeds — deleting the prior run and writing the new one in ONE transaction');
select is(
  (select ar.tie_ladder_exit_step from public.award_result ar
     join public.spin s on s.id = ar.spin_id
    where s.ceremony_id = (select ceremony_id from f) and s.spin_index = 1),
  3,
  '⭐⭐ nullif(exit_step, 0), THE OTHER DIRECTION: a real FR-29 rung lands as ITSELF — the half a payload of all-zeroes can never prove');
select is(
  (select count(*)::int from public.spin where ceremony_id = (select ceremony_id from f)),
  3,
  '⭐ AC8: the replace REPLACED — three spins after, not six, so the delete and the insert were the same transaction');
select is(
  (select live_award_ids from public.spin
    where ceremony_id = (select ceremony_id from f) and spin_index = 1),
  jsonb_build_array((select aw2 from f), (select aw1 from f)),
  '⭐ DRAW order is the STORED order (0025:127-129) — the descending pair came back descending, so nothing sorted it');
select is(
  (select count(*)::int from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)),
  2,
  'the replace wrote its OWN single audit row — one per call, still not one per spin');
select is(
  (select detail from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)
    order by id desc limit 1),
  jsonb_build_object(
    'before', jsonb_build_object(
      'ceremony_state', 'spinning', 'spins', 3, 'replaced', true),
    'after', jsonb_build_object(
      'ceremony_state', 'spinning',
      'ceremony_id',    (select ceremony_id from f),
      'seed_hex',       '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
      'snapshot_id',    (select id from stat_snapshot limit 1),
      'spins',          3, 'results', 3, 'winners', 2, 'deleted_spins', 3)),
  '⭐⭐ AC8: the audit row records BOTH counts — 3 deleted and 3 written — which is the AC''s literal requirement');

-- ⭐⭐ THE CROSS-RPC REGRESSION 0027 INTRODUCES, PINNED HERE BECAUSE THIS IS THE FIRST POINT THE
-- CEREMONY IS ACTUALLY `spinning` (Story 6.8a code review). `persist_ceremony` leaves every
-- successful run at `spinning`, and `lock_ceremony`'s `on conflict do update` sets `state = 'locked'`
-- — so re-locking a ceremony that has already spun is now `spinning -> locked`, BACKWARD, and raises
-- IC910 where before 0027 it silently succeeded. Refusing is the CORRECT AD-15 posture and is the
-- substance of `deferred-work.md:277`, but 0027 changes a SHIPPED RPC's failure mode and nothing
-- exercised it. The suite cannot call `lock_ceremony` (it needs a whole approved bracket), so this
-- drives the statement its conflict arm performs.
select throws_like($$
  update public.ceremony set state = 'locked', started_at = now()
   where id = (select ceremony_id from f)$$,
  '%advances forward one step at a time%',
  '⭐⭐ re-locking a ceremony that has already SPUN is refused — the new lock_ceremony failure mode 0027 creates, and it is the intended one');

-- ============================================================================
-- Section E — AC3: every typed refusal, and every one of them BEFORE any write  (29)
-- ============================================================================
-- ⚠ RUN AFTER F ON PURPOSE: the ceremony is now `spinning` with rows in it, which is the state a
-- re-run actually meets. Each probe below passes p_replace => true so that `already_persisted` is not
-- the reason every one of them reports — that would make eleven tests pass for one reason.
select is(pg_temp.probe_persist(999999, pg_temp.run_payload(), '76561198000000011', true),
  'no_ceremony', 'no_ceremony: an id that names nothing refuses before it locks anything');

select is(pg_temp.probe_persist(
    (select fresh_ceremony from f), pg_temp.run_payload(), '76561198000000011', true),
  'ceremony_not_locked',
  'ceremony_not_locked: the T9 ceremony is ''complete'', which is not a state a run may be written into');

-- ⭐⭐ THESE THREE WERE ADDED BY THE MUTATION PASS, WHICH FOUND THEIR GUARDS UNTESTED. Deleting each
-- of the three refusals below left all 65 other tests green — the classic "the fixture already
-- satisfies the precondition, so the guard never runs" gap.
select is(pg_temp.probe_persist((select no_snapshot_ceremony from f), pg_temp.run_payload(),
                                '76561198000000011', true),
  'snapshot_missing',
  '⭐ snapshot_missing: a ceremony with no AD-19 snapshot has no frozen input for the run to be a function OF — refused before any lock is taken on its rows');

select is(pg_temp.probe_persist((select no_seed_ceremony from f), pg_temp.run_payload(),
                                '76561198000000011', true),
  'seed_missing',
  '⭐ seed_missing: a ceremony with no frozen seed cannot have produced these bytes (AD-13) — and the guard runs AFTER snapshot_missing, which the row above pins by having a snapshot');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,tie_ladder_exit_step}', '7'::jsonb),
    '76561198000000011', true),
  'invalid_ladder_exit_step',
  '⭐ invalid_ladder_exit_step: FR-29 has exactly five rungs, and a value outside 1..5 that is not the engine''s 0 sentinel would otherwise arrive as a bare 23514 on award_result_ladder_exit_step_valid');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{seed_hex}', to_jsonb(repeat('c', 64))),
    '76561198000000011', true),
  'seed_mismatch',
  '⭐ seed_mismatch: the seed the producer drew from must BE the seed the ceremony froze — otherwise these rows describe a different ceremony and nothing later can tell');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins}', '[]'::jsonb), '76561198000000011', true),
  'no_spins', 'no_spins: an empty run is a refusal, never a zero-row success');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spin_plan}', '[]'::jsonb), '76561198000000011', true),
  'no_spin_plan', 'no_spin_plan: 0024:201''s shell must be filled by the same call that writes the rows');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,spin_index}', '7'::jsonb), '76561198000000011', true),
  'spin_index_not_dense',
  '⭐ spin_index_not_dense: the indexes must be exactly 1..N — asserted as a SET, so {1,1,3} refuses too');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,kind}', '"bonus"'::jsonb), '76561198000000011', true),
  'invalid_spin_kind', 'invalid_spin_kind: 0025:119''s closed set, refused with a reason rather than a 23514');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,award_id}', '"999999"'::jsonb),
    '76561198000000011', true),
  'unknown_award',
  '⭐ unknown_award: every award id is re-resolved against THIS tournament''s frozen catalog — the payload is validated, not trusted');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,winners}', '["76561198000009999"]'::jsonb),
    '76561198000000011', true),
  'unknown_player',
  '⭐ unknown_player: every steamid64 must map to an ACTIVE roster_entry — a soft-removed entry cannot be crowned');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,outcome_kind}', '"winner_ish"'::jsonb),
    '76561198000000011', true),
  'invalid_outcome_kind', 'invalid_outcome_kind: the engine''s closed set, refused with a reason');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,outcome_kind}', '"tie"'::jsonb),
    '76561198000000011', true),
  'outcome_kind_tie',
  '⭐ outcome_kind_tie: a persisted tie means the FR-29 ladder was skipped — the admin gets a reason, not a bare 23514');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,winners}', '[]'::jsonb),
    '76561198000000011', true),
  'winner_cardinality',
  '⭐ winner_cardinality: outcome_kind and the winner count are the same fact twice, and a ''winner'' with nobody is the shape IC909 would otherwise catch only at COMMIT');

-- ── E2. THE REFUSALS THE 6.8a CODE REVIEW FOUND UNTESTED. ────────────────────
-- Two of them (`spin_index_missing`, `pity_award_shape`) were SHIPPED guards with no probe at all,
-- while this section's own header claimed "ALL FIFTEEN" against a set of eighteen — so the mutation
-- pass structurally could not have covered them. `pity_award_shape` is the worse of the two: it is
-- the ONLY enforcer of its rule, because `0026` deliberately leaves "a pity result that DOES name an
-- award" representable in the schema.
select is(pg_temp.probe_persist((select ceremony_id from f),
    pg_temp.run_payload() #- '{spins,0,spin_index}', '76561198000000011', true),
  'spin_index_missing',
  '⭐ spin_index_missing: a spin with no index at all refuses HERE, not as a 23502 in the write loop');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,2,results,0,award_id}',
              to_jsonb((select aw1 from f)::text)), '76561198000000011', true),
  'pity_award_shape',
  '⭐ pity_award_shape: a consolation result names NO award (0026) — and this RPC is the ONLY thing that enforces it, because the schema deliberately does not');

-- ── E3. THE SQL THREE-VALUED-LOGIC FAIL-OPENS, EACH PINNED AT ITS OWN SITE. ──
-- ⛔⛔ ALL THREE OF THESE USED TO PASS VALIDATION. `string_agg` SKIPS NULL inputs and `jsonb ? NULL`
-- is NULL, so a guard whose WHERE clause selected the offending row still aggregated to NULL and
-- reported nothing. The consequences differed and the middle one is the worst:
--   * a null `kind` reached a bare 23502 on spin.kind mid-write;
--   * a null element in `live_award_ids` COMMITTED, as `[null]`, with {ok:true} — silent corruption;
--   * a null element in `winners` reached a bare 23502 AFTER spins and results were inserted.
select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,kind}', 'null'::jsonb), '76561198000000011', true),
  'invalid_spin_kind',
  '⭐⭐ a NULL spin kind is caught by the guard whose WHERE clause names it — string_agg used to swallow it and let the write proceed');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,live_award_ids}', '[null]'::jsonb),
    '76561198000000011', true),
  'unknown_award',
  '⭐⭐ a NULL element in live_award_ids REFUSES — it used to COMMIT as [null] with ok:true, the only silent-corruption path in the writer');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,winners}', '[null]'::jsonb),
    '76561198000000011', true),
  'unknown_player',
  '⭐⭐ a NULL element in winners REFUSES before the write, rather than 23502-ing after the spin and result rows are already in');

-- ── E4. SHAPE AND CAST GUARDS THAT USED TO RAISE INSTEAD OF REFUSING. ────────
-- `coalesce(x -> 'k', '[]')` does NOT neutralise a jsonb null (it is a scalar, not SQL NULL), and a
-- `::int` cast is not a guard. Both used to escape as 22023 / 22P02 where the contract promises a
-- typed reason — and the Go caller normalises any raise to an untyped `write_failed`.
select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,spin_index}', '"one"'::jsonb),
    '76561198000000011', true),
  'invalid_spin_index',
  '⭐ invalid_spin_index: a non-integral index refuses — the density check''s ::int cast used to raise 22P02 from inside the guard');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results}', '{}'::jsonb), '76561198000000011', true),
  'invalid_payload_shape',
  '⭐ invalid_payload_shape: `results` as an OBJECT refuses — jsonb_array_elements used to raise 22023 on it');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,winners}', 'null'::jsonb),
    '76561198000000011', true),
  'invalid_payload_shape',
  '⭐⭐ a key present with JSON null is NOT a missing key — coalesce passes the scalar null straight through, which is what used to raise');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results}', '[]'::jsonb), '76561198000000011', true),
  'spin_without_results',
  '⭐ spin_without_results: a spin that concluded nothing used to persist as a childless spin row with ok:true — no_spins guards an empty RUN, this guards an empty SPIN');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spin_plan,0,pool}', '["999999"]'::jsonb),
    '76561198000000011', true),
  'unknown_plan_award',
  '⭐ unknown_plan_award: spin_plan is the ONE field published verbatim, and its pools are now resolved against the frozen catalog like every other award id');

select is(pg_temp.probe_persist((select ceremony_id from f),
    jsonb_set(pg_temp.run_payload(), '{spins,0,results,0,deciding_num}', '"5"'::jsonb),
    '76561198000000011', true),
  'invalid_deciding_pair',
  '⭐ invalid_deciding_pair: half a rate pair used to arrive as a bare 23514 on the constraint THIS migration adds, from inside the INSERT');

select is(pg_temp.probe_persist((select ceremony_id from f), pg_temp.run_payload(),
                                '76561198000009999', true),
  'unknown_actor',
  '⭐ unknown_actor: the actor is resolved BEFORE the write — an unknown one used to 23503 at the audit insert, after every row had been written');

-- ── E5. ⭐⭐ THE SECTION'S HEADLINE PROPERTY, WHICH NOTHING ASSERTED. ──────────
-- "every one of them BEFORE any write" is this section's title and was, until the 6.8a code review,
-- carried by NO assertion whatsoever. Every probe above returns a reason string; move any guard below
-- the `-- Past this line everything writes` separator and every one of them returns the IDENTICAL
-- string and stays green.
--
-- ⛔ AND THE OMISSION WAS ACTIVELY DANGEROUS HERE, because every probe in this section passes
-- `p_replace => true` — so the FIRST write a mis-ordered guard would reach is
-- `delete from public.spin where ceremony_id = …`, silently destroying the three rows Section F
-- persisted, with nothing downstream to notice. These two assertions are that missing test.
select is(
  (select count(*)::int from public.spin where ceremony_id = (select ceremony_id from f)),
  3,
  '⭐⭐ AC3: after 24 refusals each passing p_replace => true, Section F''s three spins are STILL THERE — every guard really does run before the delete');
select is(
  (select count(*)::int from public.audit_log
    where action = 'run_ceremony' and tournament_id = (select tournament_id from f)),
  2,
  '⭐⭐ AC3: and not one refusal wrote an audit row — a refused run leaves no trace at all');

-- ============================================================================
-- Section G — ⭐ the is_shared trigger under a role WITHOUT BYPASSRLS  (7)
-- ============================================================================
-- ⛔⛔ THE BUG THIS PROVES FIXED (deferred-work.md:333). Before 0027 the trigger function was
-- `security invoker` and ran against FORCE-RLS tables with ZERO policies, so for a role without
-- BYPASSRLS its `select ar.is_shared … where ar.id = target` found NOTHING — and the
-- `if not found then continue` branch read that as "the parent was deleted", SKIPPING the assertion
-- entirely. It FAILED OPEN, and was safe only because the sole writer holds BYPASSRLS. 6.8b adds the
-- viewer policy, so the fix is taken before it exists.
--
-- ⚠ THE SETUP IS WHAT MAKES THIS DISCRIMINATING. The temporary role gets INSERT policies and NO
-- SELECT policy, which is precisely the visibility the shipped tables give a non-superuser today. A
-- `security invoker` function is blind here; a `security definer` one is not. `lastval()` stands in
-- for `RETURNING id`, which would itself require a SELECT policy.
-- ⚠ `postgres` IS NOT A SUPERUSER ON SUPABASE (it holds BYPASSRLS, which is what makes the shipped
-- writer safe today and is exactly what this role must NOT have), so it cannot `set role` into a role
-- it is not a member of. The grant is what makes the switch below legal.
create role pgtap_nobypass nologin;
-- ⚠ `postgres` BY NAME, NOT `current_user`. The `to current_user` spelling crashed the backend on
-- this Postgres build (measured, 2026-08-08); the explicit name is also what every other grant in
-- this suite uses.
grant pgtap_nobypass to postgres;
grant usage on schema public to pgtap_nobypass;
grant insert on public.award_result, public.award_result_winner to pgtap_nobypass;
-- ⚠ THE SEQUENCE GRANT IS FOR `lastval()`, NOT FOR THE INSERT. An identity column needs no sequence
-- grant to be written (`0003:77` says so, and it stays true) — but reading back the id it generated
-- does, and `lastval()` is what stands in for `RETURNING id` here precisely because RETURNING would
-- need a SELECT policy, which is the visibility this test must withhold.
grant select on sequence public.award_result_id_seq to pgtap_nobypass;
create policy tmp_ins_ar  on public.award_result       for insert to pgtap_nobypass with check (true);
create policy tmp_ins_arw on public.award_result_winner for insert to pgtap_nobypass with check (true);

-- ⚠ THE IDS ARE RESOLVED BEFORE THE ROLE SWITCH, into plpgsql variables. Reading `f` after
-- `set local role` would read it as the blind role, and the point of the test is that the WRITE is
-- blind — not that the fixture lookup is.
select throws_ok($q$
  do $x$
  declare r bigint; v_spin bigint; v_aw bigint; v_ana bigint;
  begin
    select main_spin, aw1, ana into v_spin, v_aw, v_ana from f;
    set local role pgtap_nobypass;
    set constraints all deferred;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values (v_spin, 'main', v_aw, 'winner', false, true);
    r := lastval();
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, v_spin, v_ana);
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  'IC909', null,
  '⭐⭐ a DRIFTING row still raises IC909 when written by a role that cannot SELECT it — under the old security invoker function the parent was invisible, `not found` was read as "deleted", and the drift committed SILENTLY');

select lives_ok($q$
  do $x$
  declare r bigint; v_spin bigint; v_aw bigint; v_beto bigint;
  begin
    select main_spin, aw1, beto into v_spin, v_aw, v_beto from f;
    set local role pgtap_nobypass;
    set constraints all deferred;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values (v_spin, 'main', v_aw, 'winner', false, false);
    r := lastval();
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, v_spin, v_beto);
    -- ⚠ THE CONSTRAINT IS CHECKED WHILE STILL WEARING THE BLIND ROLE — that is the whole point; the
    -- reset comes after. (In the throws_ok twin above the raise rolls the SET LOCAL back for us;
    -- here the block SUCCEEDS, so the role would otherwise leak into the rest of the transaction and
    -- pgTAP's own `ok()` would 42883 as a role with no EXECUTE on the extension.)
    set constraints all immediate;
    reset role;
  end
  $x$
$q$,
  'a CORRECT row written by the same blind role still COMMITS — the positive control, without which the refusal above is satisfied by a trigger that refuses everything');

reset role;
drop policy tmp_ins_ar  on public.award_result;
drop policy tmp_ins_arw on public.award_result_winner;

-- ⭐⭐ AC7's CARDINALITY RULE, DRIVEN DIRECTLY AT THE TRIGGER — and it exists because the mutation
-- pass found it uncovered. `persist_ceremony` refuses `winner_cardinality` before it writes (Section
-- E), so every path THROUGH THE RPC is caught by the RPC — which means deleting the trigger's
-- cardinality branch left the whole suite green. The branch is not redundant: `service_role` holds
-- INSERT on `award_result` directly and BYPASSRLS, so a writer that is not this RPC reaches the table
-- with nothing else in the way. A guard whose only test goes through a different guard is not tested.
select throws_ok($q$
  do $x$
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select main_spin from f), 'main', (select aw2 from f), 'winner', false, false);
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  'IC909', null,
  '⭐ outcome_kind=''winner'' with ZERO winner rows raises IC909 at the deferred check — the kind and the cardinality are the same fact, enforced where a non-RPC writer also meets it');
select throws_like($q$
  do $x$
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select main_spin from f), 'main', (select aw2 from f), 'winner', false, false);
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  '%the outcome kind and the winner cardinality are the same fact%',
  '…and its MESSAGE names the cardinality rule, not the is_shared one — the two branches are distinguishable, so neither can pass for the other');

-- ⭐⭐ THE FAIL-CLOSED `else` ARM (Story 6.8a code review, DECISION 6). The cardinality `if` chain used
-- to have no fallthrough, so ANY outcome_kind it did not name satisfied the assertion at ANY winner
-- count. The migration defended that omission on the grounds that `tie` is already unrepresentable —
-- but `tie` was never the fail-open case; an unknown SIXTH value was, and the same file's
-- `assert_ceremony_transition` reasons the opposite way about the identical situation.
--
-- ⚠ THE VOCABULARY CHECK IS DROPPED FIRST, INSIDE THIS ROLLED-BACK TRANSACTION, AND THAT IS THE ONLY
-- WAY TO REACH THE ARM. A sixth value cannot otherwise be represented — which is exactly why the
-- branch was untestable and stayed uncovered. Dropping the CHECK simulates the future migration that
-- widens the set, and the assertion is that the trigger REFUSES rather than waving it through.
-- ⛔ It is dropped AFTER Section A has already asserted the constraint's exact five-value definition,
-- and the whole file rolls back, so nothing outside this transaction sees it.
alter table public.award_result drop constraint award_result_outcome_kind_valid;

select throws_like($q$
  do $x$
  begin
    set constraints all deferred;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select main_spin from f), 'main', (select aw2 from f), 'bonus', false, false);
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  '%does not know how to check%',
  '⭐⭐ an UNKNOWN outcome_kind is REFUSED by the trigger rather than silently satisfying it — the fail-open the if-chain had with no else, closed the way assert_ceremony_transition already did it');

alter table public.award_result
  add constraint award_result_outcome_kind_valid
  check ((outcome_kind in (
    'winner', 'tie', 'no_eligible_players', 'no_awardable_value', 'shared'
  )) is true);

-- ── G2. THE DEFERRED-ASSERTION SEAM, BOTH HALVES (Story 6.8a code review, T4's ⚠ subtask). ──
--
-- `persist_ceremony` writes an `award_result` and only THEN its winner rows, so the is_shared /
-- cardinality assertion must be DEFERRED across that gap — and it ends by forcing it IMMEDIATE so the
-- `{ok:true}` it returns is a value the database has already agreed to. `set constraints` is
-- TRANSACTION-scoped, which is what makes both halves need a test of their own.

-- ⭐ HALF ONE: the function normalises the mode ON ENTRY, so an ambient IMMEDIATE set by the CALLER
-- cannot make it raise on its own perfectly good rows. The mutation pass found this uncovered.
set constraints public.award_result_is_shared_consistent,
                public.award_result_winner_is_shared_consistent immediate;
select is(pg_temp.probe_persist((select ceremony_id from f), pg_temp.run_payload(),
                                '76561198000000011', true),
  'ok',
  '⭐ persist_ceremony survives an ambient IMMEDIATE constraint mode — it defers on entry rather than depending on what the caller left behind');
set constraints public.award_result_is_shared_consistent,
                public.award_result_winner_is_shared_consistent deferred;

-- ⭐⭐ HALF TWO: the assertion really does run BEFORE the function returns. This cannot be shown with
-- a drifting row, because the RPC derives `is_shared` from the winner count and validates the
-- cardinality itself — by construction it never writes a row IC909 would reject. So the trigger
-- function is swapped for one that ALWAYS raises, which makes the ORDERING the only variable:
--   * with the `set constraints … immediate` in place, the raise happens INSIDE persist_ceremony and
--     the probe reports `raised:IC909`;
--   * without it, the deferred check waits for COMMIT — which never comes in pgTAP — so the function
--     returns `ok` and the caller is told a run committed that had not been judged yet.
-- ⛔ DELIBERATELY THE LAST THING IN THIS SECTION, and the function is NOT restored: Section H reads
-- only privileges and policies, and the whole file rolls back.
create or replace function public.assert_award_result_is_shared() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception using errcode = 'IC909', message = 'pgtap: forced deferred failure';
end;
$$;

select is(pg_temp.probe_persist((select ceremony_id from f), pg_temp.run_payload(),
                                '76561198000000011', true),
  'raised:IC909',
  '⭐⭐ a deferred IC909 surfaces FROM persist_ceremony, not after it has already returned ok and written its audit row — T4''s warning, discharged');

-- ============================================================================
-- Section H — ⭐ AC9: the posture has NOT moved, asserted WITH ROWS PRESENT  (1)
-- ============================================================================
-- ⭐⭐ THE FIRST TIME THIS ASSERTION HAS EVER BEEN MADE AGAINST NON-EMPTY TABLES. 0025 asserted the
-- same shape over tables that had never held a row, so it could not distinguish "a viewer sees
-- nothing because the posture is closed" from "a viewer sees nothing because there is nothing".
-- Sections D-G have now written spins, results and winners; the answer must be identical.
-- ⚠ THE EXPECTED POLICY SET IS `award.award_admin_read` AND NOTHING ELSE, and that is not a leak.
-- `0023:179-215` created it as DORMANT defence-in-depth: `authenticated` holds NO grant on `award`,
-- so an admin 42501s before RLS is ever consulted. Asserting the exact SET rather than "zero policies"
-- is what lets this test say "unchanged" honestly — a bare zero-count assertion would have been FALSE
-- against the shipped schema, and rewriting it to exclude `award` would have quietly stopped covering
-- the one of the four tables that already carries a policy.
select is(
  (select
     (select bool_or(has_table_privilege(r, t, p))
        from unnest(array['anon', 'authenticated']) r,
             unnest(array['public.spin', 'public.award_result', 'public.award_result_winner',
                          'public.award']) t,
             unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p)::text
     || ' | ' ||
     coalesce((select string_agg(polrelid::regclass::text || '.' || polname, ',' order by 1)
                 from pg_policy
                where polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                                   'public.award_result_winner'::regclass, 'public.award'::regclass)),
              '<none>')
     || ' | ' ||
     (select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
       where oid in ('public.spin'::regclass, 'public.award_result'::regclass,
                     'public.award_result_winner'::regclass, 'public.award'::regclass))::text),
  'false | award.award_admin_read | true',
  '⭐⭐ AC9 WITH ROWS PRESENT: no client role holds any data verb on any of the four tables, the policy set is still exactly 0023''s dormant award_admin_read, and all four are ENABLE+FORCE — 6.8a moved no posture');

select * from finish();
rollback;
