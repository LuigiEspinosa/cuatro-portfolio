-- supabase/tests/0026_pity_award_result_test.sql
-- pgTAP proof for migration 0026 (Story 6.7): a pity `award_result` has NO award
-- (FR-28 / AD-14 / SM-2). Run via: supabase test db. Runs inside a transaction and rolls back.
--
--   Q1   `award_result.award_id` is NULLABLE, and the FK it carries is 0025's, untouched  -> Section A
--   Q1   ⭐ THE FLAGSHIP: a PITY result may omit its award; a MAIN-spin result may NOT     -> Section B
--   Q1   the CHECK is TOTAL — no input makes its expression NULL, so none is silently
--        SATISFIED (the defect 0025's first luck_weight_table_valid shipped with)          -> Section C
--   —    0025's own guarantees still hold over a NULL award_id: the (spin, award) UNIQUE,
--        the IC909 is_shared trigger and the anti-sweep UNIQUE all still bite               -> Section D
--
-- ⚠⚠ WHY CONSTRAINT NAMES, NOT BARE SQLSTATES. Every CHECK raises the same 23514, so a `throws_ok`
-- on the code alone would pass for the wrong reason — the trap the 4.3 review found across three
-- suites and 6.1 re-hit. Every negative test below asserts the CONSTRAINT NAME in the message.
--
-- ⚠ NOTHING WRITES A PITY ROW IN PRODUCTION YET. The resolver that decides WHO wins is
-- `worker/awards/pity.go` + `lib/roulette/pity.ts` and it touches no database at all; the writer is
-- Story 6.8's. These fixtures are the first pity rows that have ever existed, and they exist only
-- to prove the shape admits them.
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action
-- Item #3). The matrix and its observed red counts are in the story's Completion Notes.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan(18) = A 4 + B 5 + C 3 + D 6, accounted for section by section:
--   A 4 — `award_id` is nullable now · the FK still exists and still points at award(id) · its ON
--         DELETE is still RESTRICT (0026 widened the NULLability and nothing else) · the new CHECK
--         exists by name.
--   B 5 — ⭐ a pity result with a NULL award INSERTS · a main-spin result with a NULL award is
--         23514 naming award_result_award_or_pity · a main-spin result WITH an award inserts (the
--         positive control, without which the refusal above passes for the wrong reason) · a pity
--         result WITH a real award_id is still permitted (the converse is deliberately unconstrained
--         — see the column comment) · UPDATEing a legal pity row to is_pity = false is refused, so
--         the guard is not insert-only.
--   C 3 — `is_pity` is NOT NULL (the operand that could otherwise make the expression NULL) · the
--         constraint's expression text really carries the `IS TRUE` wrapper · a row with
--         is_pity = false AND award_id = NULL is refused rather than admitted-by-NULL, which is the
--         behaviour the wrapper protects.
--   D 6 — over a NULL award_id: two pity results in ONE spin coexist (the (spin, award) UNIQUE does
--         NOT collapse them, because NULLs are distinct in a UNIQUE) · ⭐ …and that same UNIQUE
--         STILL BITES over a non-NULL award_id, without which the whole section would be satisfied
--         by a schema with the index dropped (added by the 6.7 code review) · IC909 still forces
--         is_shared to match the winner count on a pity result, asserted as SQLSTATE + ⭐ message
--         pattern (the code alone was the file's one un-named negative test) · the anti-sweep UNIQUE
--         still refuses the same player twice in one pity spin · a sole-winner pity result commits
--         cleanly.
select plan(18);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'T7');

insert into player (steamid64, display_name) values
  ('76561198000000011', 'Ana'),
  ('76561198000000022', 'Beto');

insert into roster_entry (tournament_id, steamid64)
select (select id from tournament where name = 'T7'), s
  from (values ('76561198000000011'), ('76561198000000022')) as v(s);

-- ⚠ TWO awards, not one (6.7 code review). `aw2` exists so Section D's negative control — that
-- `award_result_spin_award_key` still bites over a NON-NULL award_id — can insert BOTH of its rows
-- itself instead of colliding with the main-spin result Section B inserts on `aw1`. A test that
-- depends on another section's fixture for its meaning is the coupling that section was fixed for.
insert into award (tournament_id, name, bucket, class, deciding_stat, priority) values
  ((select id from tournament where name = 'T7'), 'Cuchillero', 'weird', 'volume', 'knife_kills', 1),
  ((select id from tournament where name = 'T7'), 'Granadero', 'weird', 'volume', 'utility_damage', 2);

insert into ceremony (tournament_id) values ((select id from tournament where name = 'T7'));

-- ⚠ Spin 13 is the FIRST pity spin index by convention only — `spin_index` allocation is Story
-- 6.8's and nothing here depends on the number. What matters is `kind = 'pity'`, which 0025:119
-- already admits.
insert into spin (ceremony_id, spin_index, kind) values
  ((select id from ceremony limit 1), 1,  'main'),
  ((select id from ceremony limit 1), 13, 'pity'),
  ((select id from ceremony limit 1), 14, 'pity');

-- Re-derived rather than hardcoded, so a fixture edit cannot silently retarget a test. Scoped to T7
-- BY NAME rather than `limit 1`, which is the correction 0025's code review made to its own view.
create temporary view f as
select
  (select c.id from ceremony c
     join tournament t on t.id = c.tournament_id
    where t.name = 'T7')                                                 as ceremony_id,
  (select id from spin where spin_index = 1)                             as main_spin,
  (select id from spin where spin_index = 13)                            as pity_spin,
  (select id from spin where spin_index = 14)                            as pity_spin2,
  (select id from award where name = 'Cuchillero')                       as aw1,
  (select id from award where name = 'Granadero')                        as aw2,
  (select id from roster_entry where steamid64 = '76561198000000011')    as ana,
  (select id from roster_entry where steamid64 = '76561198000000022')    as beto;

-- ============================================================================
-- Section A — the shape 0026 changed, and the three it did NOT  (4)
-- ============================================================================
select col_is_null('public', 'award_result', 'award_id',
  'award_result.award_id is NULLABLE — FR-28''s consolation prize is not a category and has no award row to point at');

select fk_ok('public', 'award_result', 'award_id', 'public', 'award', 'id',
  'award_result.award_id still references award(id) — 0026 widened the NULLability and nothing else');

-- ⭐ THE ON DELETE BEHAVIOUR IS RE-ASSERTED RATHER THAN ASSUMED. `alter column ... drop not null`
-- cannot change it, but this is the one property of the column a careless `drop constraint /
-- re-add` would silently lose, and losing it would let a re-curate delete an award out from under a
-- crowned result.
-- ⚠ SCOPED BY `conrelid` (6.7 code review). Constraint names are unique per RELATION, not per
-- schema, so an unscoped `where conname = ...` returns more than one row the moment any other table
-- carries the same name — and a scalar subquery then raises 21000 "more than one row returned by a
-- subquery", failing for a reason unrelated to what is being tested. The `isnt(...)` assertion three
-- lines below already scoped correctly; these two did not, which made it an inconsistency rather
-- than a convention.
select is(
  (select confdeltype::text from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_award_fk'),
  'r',
  'award_result_award_fk is still ON DELETE RESTRICT — a catalog re-curate can never orphan a crowned result');

select isnt(
  (select conname::text from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_award_or_pity'),
  null,
  'award_result_award_or_pity exists by NAME — every CHECK raises 23514, so the name is what the negative tests below can assert');

-- ============================================================================
-- Section B — ⭐ the pairing itself  (5)
-- ============================================================================
-- ⚠ `kind` AND `outcome_kind` ARE SUPPLIED EXPLICITLY FROM HERE DOWN (migration 0027, Story 6.8a).
-- Both are NOT NULL with NO DEFAULT. `kind` must equal the parent spin's or 0027's composite FK
-- `award_result_spin_kind_fk` refuses; `outcome_kind` is one of the engine's five OutcomeKinds, and
-- every fixture below carries the kind that MATCHES ITS OWN WINNER COUNT — `winner` where exactly one
-- `award_result_winner` row follows, `no_eligible_players` where none does — so that the widened
-- IC909 cardinality rule is satisfied for the right reason rather than by never being fired.
select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
  values ((select pity_spin from f), 'pity', null, 'no_eligible_players', true, false)$$,
  '⭐ a PITY result with NO award INSERTS — this is the whole point of 0026, and the row it makes possible is Story 6.8''s to write for real');

select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
  values ((select main_spin from f), 'main', null, 'no_eligible_players', false, false)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_award_or_pity"',
  '⭐ a MAIN-spin result with NO award is REFUSED — the case that is always wrong, and the CONSTRAINT NAME says which check caught it');

select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
  values ((select main_spin from f), 'main', (select aw1 from f), 'no_eligible_players', false, false)$$,
  'a main-spin result WITH its award inserts — the positive control, without which the refusal above could pass for the wrong reason');

-- ⚠ THE CONVERSE IS DELIBERATELY NOT CONSTRAINED, and this row is what records that as behaviour
-- rather than as prose. A biconditional (`award_id is null = is_pity`) would be stricter and would
-- pre-empt a product decision Story 6.10 may yet take — naming the consolation prize. What 0026
-- forbids is only the case that is always wrong.
select lives_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
  values ((select pity_spin2 from f), 'pity', (select aw1 from f), 'no_eligible_players', true, false)$$,
  'a PITY result that DOES name an award stays representable — the pairing is one-directional on purpose (see the column comment)');

-- ⭐ NOT INSERT-ONLY. A CHECK constraint is re-evaluated on UPDATE, and a guard that only held at
-- insert time would let a writer create a legal row and then break it underneath itself.
--
-- ⚠⚠ RETARGETED BY MIGRATION 0027, AND THE ORIGINAL CASE IS NOW UNREACHABLE RATHER THAN UNTESTED.
-- This assertion used to flip a legal PITY row to `is_pity = false` and expect
-- `award_result_award_or_pity`. Under 0027 that same statement ALSO violates
-- `award_result_is_pity_matches_kind` (a pity spin's result may not be non-pity), and Postgres does
-- not guarantee WHICH of two violated CHECKs it names — so the test would have been asserting a
-- constraint name by luck of constraint OID order, which is precisely the "passes for the wrong
-- reason" trap this file's header is about. The UPDATE below breaks EXACTLY ONE constraint: a
-- main-spin row keeps `kind='main'` and `is_pity=false` (so the 0027 bind is satisfied) while losing
-- its award, which only `award_result_award_or_pity` can refuse. The original CLAIM — that the guard
-- bites on UPDATE and not only on INSERT — is preserved unchanged; only the route to it moved.
select throws_ok($$
  update public.award_result set award_id = null
   where spin_id = (select main_spin from f) and award_id is not null$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_award_or_pity"',
  'clearing a legal main-spin result''s award is REFUSED — the guard bites on UPDATE, not only on INSERT');

-- ============================================================================
-- Section C — the CHECK is TOTAL: no NULL expression, therefore none silently SATISFIED  (3)
-- ============================================================================
-- ⛔⛔ THE LESSON 0025 PAID FOR. A CHECK whose expression evaluates to NULL is SATISFIED, and 0025's
-- first `luck_weight_table_valid` accepted an empty table on exactly that (`array_ndims` returns
-- NULL for `array[]::int[]`). These three assert the property from both ends: the operand that could
-- go NULL cannot, and the wrapper that would catch it anyway is really there.
select col_not_null('public', 'award_result', 'is_pity',
  'is_pity is NOT NULL — the one operand in the CHECK that could otherwise make the whole expression NULL, which SQL reads as SATISFIED');

select matches(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.award_result'::regclass
      and conname = 'award_result_award_or_pity'),
  'IS TRUE',
  '⭐ the constraint really carries the IS TRUE wrapper — it is what makes a future NULLable is_pity fail LOUDLY instead of admitting every row');

select throws_ok($$
  insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
  values ((select main_spin from f), 'main', null, 'no_eligible_players', default, false)$$,
  '23514',
  'new row for relation "award_result" violates check constraint "award_result_award_or_pity"',
  'the column DEFAULT (is_pity = false) plus a NULL award is REFUSED — a writer that simply omits is_pity gets the strict behaviour, not the lenient one');

-- ============================================================================
-- Section D — 0025's guarantees still bite over a NULL award_id  (4)
-- ============================================================================
-- ⭐ THE QUESTION THIS SECTION ANSWERS: 0026 made a column NULLable that a UNIQUE and a trigger both
-- read. In SQL, NULLs are DISTINCT in a UNIQUE index — so `unique (spin_id, award_id)` stops
-- collapsing pity rows, which is exactly what Cuatro's answer to Question 2 needs (N pity spins, one
-- winner each) but is a real behaviour change worth proving rather than assuming.
-- ⚠ SELF-CONTAINED, AND IT USED TO DEPEND ON SECTION B SIXTY LINES ABOVE (6.7 code review). This
-- assertion said "TWO pity results coexist" while inserting exactly ONE row — it only meant "two"
-- because Section B had already inserted one onto `pity_spin` for an unrelated purpose. Retarget or
-- delete that insert and this test would still have passed green while proving nothing, since a
-- single insert into an empty spin trivially succeeds. Both rows are now inserted HERE, in one
-- statement, so the claim is carried by the test that makes it.
select lives_ok($q$
  do $x$
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin from f), 'pity', null, 'no_eligible_players', true, false);
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin from f), 'pity', null, 'no_eligible_players', true, false);
  end
  $x$
$q$,
  '⭐ TWO pity results with a NULL award coexist in ONE spin — NULLs are DISTINCT in a UNIQUE, so award_result_spin_award_key does not collapse them');

-- ⭐⭐ THE NEGATIVE CONTROL THE SECTION WAS MISSING (6.7 code review). Everything above proves the
-- (spin, award) UNIQUE does NOT bite over NULLs. Nothing proved it still bites over a REAL award —
-- so the whole section was satisfied by a schema with the index DROPPED ENTIRELY, which is the
-- "passes for the wrong reason" trap this file's own header is about. Section B got a positive
-- control for exactly this reason ("without which the refusal above could pass for the wrong
-- reason"); Section D did not.
select throws_ok($q$
  do $x$
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select main_spin from f), 'main', (select aw2 from f), 'no_eligible_players', false, false);
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select main_spin from f), 'main', (select aw2 from f), 'no_eligible_players', false, false);
  end
  $x$
$q$,
  '23505',
  'duplicate key value violates unique constraint "award_result_spin_award_key"',
  '⭐ …and it STILL BITES over a non-NULL award_id — one award appears at most once per spin, so the NULL-distinctness above is a property of NULLs and not of a dropped index');

-- IC909 is 0025's deferred trigger asserting `is_shared = (winner count > 1)`. It reads the winner
-- rows, not the award, so a NULL award_id must not exempt a pity result from it.
select throws_ok($q$
  do $x$
  declare r bigint;
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin2 from f), 'pity', null, 'winner', true, true)
      returning id into r;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, (select pity_spin2 from f), (select ana from f));
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  -- ⚠ THE `null` MESSAGE SLOT IS DELIBERATE HERE, AND IT IS THE FILE'S ONE EXEMPTION FROM THE HEADER
  -- RULE — now stated rather than silent (6.7 code review). The rule twelve lines from the top
  -- exists because every CHECK raises the SAME 23514, so a bare SQLSTATE proves nothing about WHICH
  -- guard fired. IC909 is the opposite case: 0025 declares it as EXACTLY ONE new code for exactly
  -- one trigger (`0025:26-28`), so the SQLSTATE is already as discriminating as a constraint name.
  -- ⛔ AND AN EXACT MESSAGE IS NOT AVAILABLE: the trigger interpolates the row's SERIAL id and the
  -- live winner count into the text (`0025:316-320`), so `throws_ok`'s exact-match slot cannot be
  -- used at all. The message BODY is pinned by the `throws_like` assertion immediately below, which
  -- is what actually closes the "passes for the wrong reason" gap.
  'IC909', null,
  'a PITY result is still bound by award_result_is_shared_consistent — a sole winner flagged is_shared cannot commit just because its award is NULL');

-- ⭐ THE MESSAGE BODY, PINNED BY PATTERN (6.7 code review). `throws_ok` above asserts the SQLSTATE
-- and `throws_like` here asserts the prose, because no single pgTAP call can do both when the text
-- is interpolated. Together they are the equivalent of the constraint-name assertion the header
-- requires: another `raise` reusing IC909 would satisfy the code but not this.
select throws_like($q$
  do $x$
  declare r bigint;
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin2 from f), 'pity', null, 'winner', true, true)
      returning id into r;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, (select pity_spin2 from f), (select beto from f));
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  '%is_shared is DERIVED from the winner count%',
  '⭐ …and IC909''s MESSAGE names the rule, so another raise reusing the code would not satisfy this pair');

select throws_ok($q$
  do $x$
  declare r1 bigint; r2 bigint;
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin2 from f), 'pity', null, 'winner', true, false) returning id into r1;
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin2 from f), 'pity', null, 'winner', true, false) returning id into r2;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r1, (select pity_spin2 from f), (select beto from f));
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r2, (select pity_spin2 from f), (select beto from f));
  end
  $x$
$q$,
  '23505',
  'duplicate key value violates unique constraint "award_result_winner_spin_key"',
  '⭐ FR-26''s anti-sweep UNIQUE still bites inside a PITY spin — one player cannot take two consolation prizes in one spin, NULL award or not');

select lives_ok($q$
  do $x$
  declare r bigint;
  begin
    insert into public.award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared)
      values ((select pity_spin2 from f), 'pity', null, 'winner', true, false) returning id into r;
    insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
      values (r, (select pity_spin2 from f), (select ana from f));
    set constraints public.award_result_is_shared_consistent immediate;
  end
  $x$
$q$,
  'the shape Story 6.8 will actually write COMMITS: one pity spin, one award_result with a NULL award, one winner, is_shared = false');

select * from finish();
rollback;
