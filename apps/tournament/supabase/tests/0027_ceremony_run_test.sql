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

-- plan(68) = A 14 + B 6 + C 12 + D 10 + E 15 + F 6 + G 4 + H 1, accounted for section by section:
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
select plan(68);

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

-- Re-derived rather than hardcoded, and SCOPED BY NAME rather than `limit 1` — the correction 0025's
-- and 0026's reviews both made to their own views.
create temporary view f as
select
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T8') as ceremony_id,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T9') as fresh_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T10') as shape_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T11') as no_snapshot_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'T12') as no_seed_ceremony,
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
-- Section A — the shape 0027 lands, and the UNIQUE assertions 0025's suite owed  (14)
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
select is(
  (select count(*)::int from unnest(array['winner', 'tie', 'no_eligible_players',
                                          'no_awardable_value', 'shared']) v
    where pg_get_constraintdef(
            (select oid from pg_constraint
              where conrelid = 'public.award_result'::regclass
                and conname = 'award_result_outcome_kind_valid')) like '%''' || v || '''%'),
  5,
  'award_result_outcome_kind_valid names all five OutcomeKind values — no more and no fewer');
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
select is(
  (select bool_and(i.indisunique)
     from pg_class c join pg_index i on i.indexrelid = c.oid
    where c.relname in ('award_result_spin_award_key', 'award_result_id_spin_key',
                        'award_result_winner_result_key', 'award_result_winner_spin_key')),
  true,
  '⭐ all four pre-0027 indexes are genuinely UNIQUE — has_index alone never asserted that (deferred-work.md:334)');

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
-- Section C — AC6: ceremony.state advances by MECHANISM (IC910)  (12)
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
-- Section F — AC1/AC4/AC8: what the run actually wrote, and the replace path  (6)
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

-- ⭐ AC8 — a second run refuses, and then replaces atomically when told to.
select is(pg_temp.probe_persist((select ceremony_id from f), pg_temp.run_payload(),
                                '76561198000000011', false),
  'already_persisted',
  '⭐ AC8: a second run WITHOUT p_replace refuses with a typed reason rather than appending or 23505-ing');

-- ============================================================================
-- Section E — AC3: every typed refusal, and every one of them BEFORE any write  (12)
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

-- ============================================================================
-- Section G — ⭐ the is_shared trigger under a role WITHOUT BYPASSRLS  (2)
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
