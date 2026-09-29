-- supabase/tests/0023_award_catalog_test.sql
-- pgTAP proof for migration 0023 (Story 6.1): the FR-24 award catalog and its AD-22 teeth. Proves the
-- constraints BITE — not merely that they exist — across AC1/AC2/AC4. Run via: supabase test db
--   AC1  table shape + EVERY named CHECK refuses its own malformation                        -> Section A
--   AC1  the vocabulary CHECK and award_stat_vocabulary() agree in BOTH directions           -> Section A3
--   AC4  ENABLE+FORCE RLS, the admin policy, and the ABSENT anon/authenticated grant         -> Section B
--   AC4  as anon: `select * from award` 42501s while award_catalog_count() returns the count -> Section C
--   AC1/AC2 curate_award_catalog: happy path, idempotent re-run, PRIORITY SWAP, delete-missing,
--        and one test per typed refusal proving NOTHING WAS WRITTEN                          -> Section D
--   AC2  exactly one audit row per accepted call, correct actor, EVERY detail key asserted   -> Section E
--   AC2  catalog_frozen on state='ceremony'                                                  -> Section F
-- Runs inside a transaction and rolls back — no data persists.
--
-- ⚠⚠ WHY CONSTRAINT NAMES, NOT SQLSTATES. Every CHECK on `award` raises the SAME 23514, so a `throws_ok` on the
-- code alone would pass for the wrong reason — the trap the 4.3 review found across three suites. Every negative
-- test below asserts the CONSTRAINT NAME in the message, so a probe that trips a DIFFERENT constraint reddens.
--
-- ⚠ WHY THE DEFERRED UNIQUE NEEDS A SUBTRANSACTION. `award_tournament_priority_key` is DEFERRABLE INITIALLY
-- DEFERRED, so a genuine duplicate does not raise at the INSERT — it raises at COMMIT. pgTAP runs the whole file
-- in ONE transaction that must roll back, so the negative test wraps its probe in a plpgsql block whose
-- `set constraints ... immediate` forces the check at that point (the standard way to observe a deferred
-- violation without committing). The POSITIVE test — a swap that would violate an immediate index — needs no
-- such machinery: it simply succeeds, which is the whole point of the deferral.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they read/write
-- regardless of policy. AD-22 bites at the GRANT gate, not RLS: anon/authenticated hold ZERO grants on `award`,
-- so a viewer 42501s before a policy is ever consulted. SET LOCAL ROLE switches identity; SET LOCAL ROLE postgres
-- back between blocks (so pgTAP's own bookkeeping runs privileged). SQLSTATE 42501 = insufficient_privilege.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan(113) = A 37 (shape 8 · CHECKs 18 · UNIQUEs 6 · vocabulary parity 5) + B 10 (RLS/grants) + C 11 (the AD-22
-- pair + both functions' posture + award_stat_vocabulary's grants) + D 37 (happy path 6 · idempotency 3 · swap 3 ·
-- delete-missing 4 · 20 typed refusals · the one "nothing was written" count) + E 10 (the audit row, every detail
-- key) + F 5 (catalog_frozen) + G 3 (integral JSON decimals are accepted, not 22P02'd).
--
-- ⚠ The A breakdown was mis-stated as `CHECKs 19 · parity 4` before the 6.1 code review; the errors cancelled, so
-- the section total and the plan number were both right and nothing reddened. Corrected here because the standing
-- rule is that the plan be ACCOUNTED FOR, and an accounting that does not reconcile to the file is not one.
--
-- ⭐ 111 -> 113 BY STORY 6.8b (AC9). Section B gains TWO: the four-verb `bool_or` split into a
-- writing-verbs-only refusal plus an explicit "both roles hold SELECT" (0028 grants SELECT, so the
-- old combined check could no longer say both things), and a new pin that `award_catalog_count` was
-- NOT widened — the one prohibition (`0023:196-198`) that 6.8b was most tempted to break. Section C's
-- 42501 became a zero-row count: same claim, stronger form. See the ⭐⭐ blocks at each site.
select plan(113);

-- ============================================================================
-- Seed (as postgres / BYPASSRLS, before any role switch).
--   TCUR   — the working catalog tournament (registration_open)
--   TFROZE — state='ceremony': the catalog_frozen guard
--   TOTHER — a second live tournament: proves the catalog is SCOPED (a curate never touches a neighbour)
-- ============================================================================
insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, v.s
  from (values
    ('TCUR',   'registration_open'),
    ('TFROZE', 'ceremony'),
    ('TOTHER', 'registration_open')
  ) as v(n, s);

insert into player (steamid64, display_name) values
  ('76561197960287930', 'AdminPlayer'),
  ('76561197960287931', 'OtherAdmin');

-- Handy locals-as-a-view so every section can name a tournament without repeating the subselect. ⚠ NOT used
-- inside the `set local role anon` block: a temp view is owned by this session's postgres role and anon holds no
-- grant on it. The anon block reads `tournament` directly, which anon CAN select (0002:grant select on tournament).
create temporary view t as
  select (select id from tournament where name = 'TCUR')   as cur,
         (select id from tournament where name = 'TFROZE') as froze,
         (select id from tournament where name = 'TOTHER') as other;

-- A 12-award payload built from the shipped seed catalog's SHAPE (lib/awards/catalog.ts). It is restated here
-- deliberately: the TS constant is the app's definition site, and this suite must be able to fail INDEPENDENTLY
-- of it — a pgTAP file that imported the app's catalog could not catch a DB-side regression on its own.
create temporary view seed_payload as
select jsonb_build_array(
  jsonb_build_object('name','Máquina de Frags',   'bucket','skill', 'class','volume','deciding_stat','kills',              'direction','max','floor_rounds',24,'floor_kills',0, 'priority',1),
  jsonb_build_object('name','Rey del Daño',       'bucket','skill', 'class','rate',  'deciding_stat','adr',                'direction','max','floor_rounds',24,'floor_kills',20,'priority',2),
  jsonb_build_object('name','Puntería Quirúrgica','bucket','skill', 'class','rate',  'deciding_stat','hs_pct',             'direction','max','floor_rounds',24,'floor_kills',20,'priority',3),
  jsonb_build_object('name','Cabeza de Martillo', 'bucket','skill', 'class','volume','deciding_stat','hs_kills',           'direction','max','floor_rounds',24,'floor_kills',0, 'priority',4),
  jsonb_build_object('name','Rey del Duelo',      'bucket','clutch','class','rate',  'deciding_stat','entry_success',      'direction','max','floor_rounds',24,'floor_kills',20,'priority',5),
  jsonb_build_object('name','A Cuchillo',         'bucket','weird', 'class','volume','deciding_stat','knife_kills',        'direction','max','floor_rounds',24,'floor_kills',0, 'priority',6),
  jsonb_build_object('name','Atraviesa-muros',    'bucket','weird', 'class','volume','deciding_stat','wallbang_kills',     'direction','max','floor_rounds',24,'floor_kills',0, 'priority',7),
  jsonb_build_object('name','Fantasma del Humo',  'bucket','weird', 'class','volume','deciding_stat','through_smoke_kills','direction','max','floor_rounds',24,'floor_kills',0, 'priority',8),
  jsonb_build_object('name','Justicia Ciega',     'bucket','weird', 'class','volume','deciding_stat','blind_kills',        'direction','max','floor_rounds',24,'floor_kills',0, 'priority',9),
  jsonb_build_object('name','Manos de Piedra',    'bucket','weird', 'class','volume','deciding_stat','utility_damage',     'direction','max','floor_rounds',24,'floor_kills',0, 'priority',10),
  jsonb_build_object('name','El Más Generoso',    'bucket','comedy','class','volume','deciding_stat','deaths',             'direction','max','floor_rounds',24,'floor_kills',0, 'priority',11),
  jsonb_build_object('name','El Inofensivo',      'bucket','comedy','class','rate',  'deciding_stat','adr',                'direction','min','floor_rounds',24,'floor_kills',20,'priority',12)
) as awards;

-- ⭐⭐ THE REFUSAL PROBE (added after the mutation pass — it found a real weakness in this suite). AC2 requires
-- typed refusals to be RETURNED, never raised. Calling the RPC directly meant that if a guard were REMOVED, the
-- table's own CHECK would RAISE instead, psql would abort the whole transaction, and NO NAMED TEST would print
-- `not ok` — the suite failed, but it could not say WHICH guard was gone. Routing every probe through this
-- wrapper turns a raise into the value `RAISED`/`<sqlstate>`, so a missing guard reddens the ONE named test that
-- owns it. The EXCEPTION block also runs the call in a subtransaction, so a raising mutant still writes nothing —
-- which keeps the "no refusal wrote anything" assertion honest rather than accidentally true.
create function pg_temp.curate(p_tid bigint, p_awards jsonb) returns jsonb
  language plpgsql as $probe$
begin
  return public.curate_award_catalog(p_tid, '76561197960287930', p_awards);
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

-- ============================================================================
-- Section A — the table exists with the specced shape, and EVERY CHECK bites BY NAME (AC1).
-- ============================================================================
select has_table('public', 'award', 'award: the FR-24 catalog table exists');
select col_is_pk('public', 'award', 'id', 'award: identity PK on id');

-- The SOLUTION-DESIGN:158-173 column set, verbatim — a renamed or dropped column reddens here.
select columns_are('public', 'award', array[
  'id', 'tournament_id', 'name', 'bucket', 'class', 'deciding_stat', 'direction',
  'secondary_stat', 'eff_num_key', 'eff_den_key', 'floor_rounds', 'floor_kills', 'priority'
], 'award: exactly the SOLUTION-DESIGN.md:158-173 columns — no more, no fewer');

select col_default_is('public', 'award', 'direction',    'max', 'award: direction defaults to max');
select col_default_is('public', 'award', 'floor_rounds', '24',  'award: floor_rounds defaults to 24 (FR-21; value-parity with 0021:56)');
select col_default_is('public', 'award', 'floor_kills',  '0',   'award: floor_kills defaults to 0 (20 is set per rate award)');
select has_index('public', 'award', 'award_tournament_priority_idx',
  'award: the (tournament_id, priority) index exists (SOLUTION-DESIGN.md:260)');

-- The FK cascades with its tournament (AD-18 scope).
select fk_ok('public', 'award', 'tournament_id', 'public', 'tournament', 'id',
  'award.tournament_id references tournament(id)');

-- ── A1. Each CHECK refuses ITS OWN malformation, asserted by CONSTRAINT NAME (see the ⚠⚠ header note). ──
select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'Probe', 'skill', 'volume', 'kills', 1)$$,
  'award: a well-formed award inserts (the positive control for Section A1)');
select is((select count(*)::int from award where tournament_id = (select cur from t)), 1,
  'award: the probe row landed (a vacuous Section A1 would otherwise pass on an empty table)');
delete from award where tournament_id = (select cur from t);

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'BadBucket', 'legendary', 'volume', 'kills', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_bucket_valid"',
  'award_bucket_valid: a bucket outside skill/clutch/weird/comedy is REFUSED');

-- ⚠ THIS PROBE IS THE REASON award_class_key_coherent IS WRITTEN AS TWO IMPLICATIONS (0023's note): under the
-- disjunctive form an out-of-enum class tripped COHERENCE, leaving award_class_valid untrippable and this test
-- green for the wrong constraint. Asserting the NAME is what surfaced it.
select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'BadClass', 'skill', 'quantity', 'kills', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_class_valid"',
  'award_class_valid: a class outside rate/volume is REFUSED (by the ENUM check, not by coherence)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, direction, priority)
  values ((select cur from t), 'BadDir', 'skill', 'volume', 'kills', 'sideways', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_direction_valid"',
  'award_direction_valid: a direction outside max/min is REFUSED');

-- ⭐ THE CENTRAL CHECK: a deciding stat the system cannot resolve is UNREPRESENTABLE, not merely unlikely.
select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'BadStat', 'skill', 'volume', 'kils', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_deciding_stat_valid"',
  'award_deciding_stat_valid: a TYPO''d deciding stat is REFUSED (an award with no resolvable stat cannot exist)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, secondary_stat, priority)
  values ((select cur from t), 'BadSecondary', 'skill', 'volume', 'kills', 'not_a_key', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_secondary_stat_valid"',
  'award_secondary_stat_valid: a secondary_stat outside the vocabulary is REFUSED (FR-29 rung 1)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, eff_num_key, priority)
  values ((select cur from t), 'BadEffNum', 'skill', 'volume', 'kills', 'not_a_key', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_eff_num_key_valid"',
  'award_eff_num_key_valid: an eff_num_key outside the vocabulary is REFUSED (FR-29 rung 2)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, eff_den_key, priority)
  values ((select cur from t), 'BadEffDen', 'skill', 'volume', 'kills', 'not_a_key', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_eff_den_key_valid"',
  'award_eff_den_key_valid: an eff_den_key outside the vocabulary is REFUSED');

-- NULL is legal for all three tiebreak keys (they are optional rungs) — the CHECKs must not over-reach.
select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, secondary_stat, eff_num_key, eff_den_key, priority)
  values ((select cur from t), 'NullTiebreaks', 'skill', 'volume', 'kills', null, null, null, 1)$$,
  'award: NULL secondary_stat/eff_num_key/eff_den_key are legal (the FR-29 rungs are optional)');
delete from award where tournament_id = (select cur from t);

-- ⭐ CLASS ↔ KEY COHERENCE — what makes `class` honest and what 6.4's Stage 2 branches on. Both directions.
select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'RateOverVolumeKey', 'skill', 'rate', 'kills', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_class_key_coherent"',
  'award_class_key_coherent: a RATE award over a VOLUME key is REFUSED (Stage 2 would cross-multiply a missing denominator)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'VolumeOverRateKey', 'skill', 'volume', 'adr', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_class_key_coherent"',
  'award_class_key_coherent: a VOLUME award over a RATE key is REFUSED');

select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, floor_kills, priority)
  values ((select cur from t), 'RateOverRateKey', 'skill', 'rate', 'adr', 20, 1)$$,
  'award_class_key_coherent: a RATE award over a RATE key is ACCEPTED (the coherence rule is not a blanket ban)');
delete from award where tournament_id = (select cur from t);

-- ⚠ A TAB IS NOT A NAME. `btrim(name) <> ''` trims SPACES ONLY and would let this through — the exact bug that
-- shipped in Story 4.2 and was caught at review. `~ '[^[:space:]]'` is what actually bites.
select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), E'\t', 'skill', 'volume', 'kills', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_name_not_blank"',
  'award_name_not_blank: a lone TAB is REFUSED (btrim() would have passed it — the 4.2 bug)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), '   ', 'skill', 'volume', 'kills', 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_name_not_blank"',
  'award_name_not_blank: an all-spaces name is REFUSED');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'ZeroPriority', 'skill', 'volume', 'kills', 0)$$,
  '23514', 'new row for relation "award" violates check constraint "award_priority_positive"',
  'award_priority_positive: priority 0 is REFUSED (priorities are 1..n)');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, floor_rounds, priority)
  values ((select cur from t), 'NegFloor', 'skill', 'volume', 'kills', -1, 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_floors_non_negative"',
  'award_floors_non_negative: a negative floor_rounds is REFUSED');

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, floor_kills, priority)
  values ((select cur from t), 'NegKillFloor', 'skill', 'volume', 'kills', -5, 1)$$,
  '23514', 'new row for relation "award" violates check constraint "award_floors_non_negative"',
  'award_floors_non_negative: a negative floor_kills is REFUSED');

-- ── A2. The two UNIQUEs. Name is IMMEDIATE; priority is DEFERRED (see the ⚠ header note). ──
insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
values ((select cur from t), 'Dup', 'skill', 'volume', 'kills', 1);

select throws_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'Dup', 'weird', 'volume', 'knife_kills', 2)$$,
  '23505', 'duplicate key value violates unique constraint "award_tournament_name_key"',
  'award_tournament_name_key: a duplicate (tournament, name) is REFUSED IMMEDIATELY (it is the upsert arbiter)');

-- The SAME name in a DIFFERENT tournament is fine — the UNIQUE is scoped, never global.
select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select other from t), 'Dup', 'skill', 'volume', 'kills', 1)$$,
  'award_tournament_name_key: the same name in a DIFFERENT tournament is accepted (the UNIQUE is scoped)');

-- The deferred priority UNIQUE: a genuine duplicate does NOT raise at INSERT…
select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  values ((select cur from t), 'DupPrio', 'weird', 'volume', 'knife_kills', 1)$$,
  'award_tournament_priority_key: a duplicate priority does NOT raise at INSERT — the constraint is DEFERRED');

-- …it raises when the constraint is forced to check, which is exactly what COMMIT would do.
select throws_ok($q$set constraints public.award_tournament_priority_key immediate$q$,
  '23505', 'duplicate key value violates unique constraint "award_tournament_priority_key"',
  'award_tournament_priority_key: a genuine duplicate priority IS refused — at COMMIT time (deferred, not absent)');

delete from award where name in ('Dup', 'DupPrio');

-- ⭐⭐ THE POSITIVE HALF: a SWAP of two priorities succeeds in ONE statement. Against an IMMEDIATE unique index
-- the intermediate state violates and the whole call 500s; deferring makes the END STATE the thing checked. This
-- is the first edit anyone will make, so it is pinned here as well as over the RPC (Section D).
insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority) values
  ((select cur from t), 'SwapA', 'skill', 'volume', 'kills',  1),
  ((select cur from t), 'SwapB', 'weird', 'volume', 'deaths', 2);
select lives_ok($$
  update public.award set priority = 3 - priority
   where tournament_id = (select cur from t) and name in ('SwapA', 'SwapB')$$,
  'award_tournament_priority_key: a PRIORITY SWAP succeeds in one statement (the whole reason the UNIQUE is DEFERRABLE)');
select is(
  (select priority from award where tournament_id = (select cur from t) and name = 'SwapA'), 2,
  'award: the swap actually landed (SwapA is now priority 2) — the lives_ok above is not vacuous');
delete from award where tournament_id in ((select cur from t), (select other from t));

-- ── A3. The vocabulary CHECK and award_stat_vocabulary() agree in BOTH directions (the pinned duplication). ──
-- Direction 1: every key the FUNCTION offers must be accepted by the CHECK.
select lives_ok($$
  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  select (select cur from t), 'V-' || k, 'skill',
         case when k = any (public.award_stat_vocabulary('rate')) then 'rate' else 'volume' end,
         k, row_number() over (order by k)
    from unnest(public.award_stat_vocabulary(null)) k$$,
  'vocabulary parity: EVERY key award_stat_vocabulary() offers is accepted by award_deciding_stat_valid');
select is((select count(*)::int from award where tournament_id = (select cur from t)),
  array_length(public.award_stat_vocabulary(null), 1),
  'vocabulary parity: one row landed per vocabulary key (the insert above is not silently empty)');
delete from award where tournament_id = (select cur from t);

-- Direction 2: every key the CHECK names must be offered by the FUNCTION. Parsed straight out of the constraint
-- definition, so a key added to the CHECK and forgotten in the function reddens HERE rather than surfacing as an
-- unreachable `invalid_award` refusal for a perfectly legal award.
select set_eq(
  $$select unnest(public.award_stat_vocabulary(null))$$,
  $$select m[1]
      from pg_constraint c,
           lateral regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''::text', 'g') m
     where c.conname = 'award_deciding_stat_valid'$$,
  'vocabulary parity: the CHECK''s literal set and award_stat_vocabulary() are IDENTICAL in both directions');

-- rate ∪ volume must be the whole vocabulary and the two halves must be DISJOINT, or class↔key is undecidable.
select set_eq(
  $$select unnest(public.award_stat_vocabulary(null))$$,
  $$select unnest(public.award_stat_vocabulary('rate')) union select unnest(public.award_stat_vocabulary('volume'))$$,
  'vocabulary parity: rate ∪ volume is exactly the full vocabulary');
select is(
  (select count(*)::int from unnest(public.award_stat_vocabulary('rate')) r
    where r = any (public.award_stat_vocabulary('volume'))),
  0, 'vocabulary parity: the rate and volume halves are DISJOINT (class↔key coherence is decidable)');

-- ============================================================================
-- Section B — RLS posture: ENABLE + FORCE, the admin policy, and the ABSENT viewer grant (AC4).
-- ============================================================================
select is((select relrowsecurity from pg_class where oid = 'public.award'::regclass), true,
  'award: row level security is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.award'::regclass), true,
  'award: row level security is FORCED (the 0003 catalog guard asserts no public base table lacks it)');

-- ⭐⭐ RETARGETED BY STORY 6.8b (AC9). WHAT THIS BLOCK USED TO CLAIM, AND WHY THE NEW CLAIM IS
-- STRONGER. Until migration 0028 it asserted an ABSENCE — "policies_are = {award_admin_read}" and
-- "NEITHER client role holds ANY privilege on award (all four verbs)". 6.1 shipped that strictly
-- closed end state ON PURPOSE so that 6.8 would be "an OPENING, never a tightening" (`6-1:71`), and
-- these lines are the assertion that opening had to move. ⛔ NOTHING WAS DELETED: each claim below
-- is the same claim, narrowed. "No viewer policy" becomes "exactly ONE viewer policy, and it is the
-- reveal-gated one"; "no privilege at all" becomes "SELECT and ONLY SELECT" — which is a strictly
-- harder thing to satisfy, because a table-wide `grant all` would now fail where before it could
-- only fail the coarse four-verb check. The reveal-gating BEHAVIOUR (a name reaches a viewer only
-- at its spin) is proven in `0028_reveal_gating_test.sql` Section B, against a real walk.
select policies_are('public', 'award', array['award_admin_read', 'award_viewer_read'],
  'award: exactly TWO policies — 0023''s admin read PLUS 0028''s reveal-gated viewer read. No write policy, ever');
select policy_cmd_is('public', 'award', 'award_admin_read', 'SELECT',
  'award_admin_read: is a SELECT policy (a catalog is never client-writable)');

-- ⭐ THE AC4 MECHANISM, NOW ASSERTED AS A BOUNDED PRESENCE. The grant exists — that is 0028's whole
-- job — so the secrecy has moved from the MISSING GRANT to the reveal-gated POLICY, exactly as
-- `0023:196-198` said it must ("Widening the CATALOG's viewer surface is Story 6.8's job and it does
-- it with a reveal-gated POLICY on the table, not by growing award_catalog_count").
select is(has_table_privilege('anon', 'public.award', 'SELECT'), true,
  'AD-22 after 0028: anon HAS SELECT on award — the secrecy is now award_viewer_read''s revealed-spin predicate');
select is(has_table_privilege('authenticated', 'public.award', 'SELECT'), true,
  'AD-22 after 0028: authenticated has SELECT too — the same reveal gate applies to a signed-in non-admin');
select is(
  (select bool_or(has_table_privilege(r, 'public.award', p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['INSERT', 'UPDATE', 'DELETE']) p),
  false, 'AD-22: NEITHER client role holds any WRITING verb on award — the opening is SELECT-only (0028 R2)');
select is(
  (select bool_and(has_table_privilege(r, 'public.award', 'SELECT'))
     from unnest(array['anon', 'authenticated']) r),
  true, 'AD-22: …and BOTH client roles hold SELECT — the grant half of 0025:51-52, which ships WITH the policy');

-- ⛔ AND THE COUNT RPC WAS NOT WIDENED BY A SINGLE COLUMN (Story 6.8b AC4). `0023:196-198` is a
-- standing prohibition, and 6.8b is the story most tempted to break it. Read from the catalog rather
-- than from this file's memory of what the body says.
select is(
  (select pg_get_function_result(oid) from pg_proc
    where proname = 'award_catalog_count' and pronamespace = 'public'::regnamespace),
  'integer',
  '⛔ award_catalog_count still returns a bare integer — 6.8b opened the TABLE, it did not grow the count (0023:196-198)');

-- service_role is the sole writer, and unlike the append-only 0003 tables it holds UPDATE+DELETE: a catalog is
-- CURATED (upsert + delete-missing), which is what makes the replace-the-whole-catalog idempotency possible.
select is(
  (select bool_and(has_table_privilege('service_role', 'public.award', p))
     from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  true, 'award: service_role holds SELECT+INSERT+UPDATE+DELETE (the sole writer; a catalog is curated, not append-only)');

-- ============================================================================
-- Section C — the ONE fact a viewer may learn. As anon: the count works, the rows do not (AC4).
-- ============================================================================
-- Curate a real catalog first so the count has something to count.
select is(
  (select pg_temp.curate((select cur from t), (select awards from seed_payload)) ->> 'ok'),
  'true', 'curate_award_catalog: the 12-award seed catalog is accepted');

select is(has_function_privilege('anon', 'public.award_catalog_count(bigint)', 'EXECUTE'), true,
  'award_catalog_count: anon CAN execute it (it is the viewer''s only catalog read)');
select is(has_function_privilege('anon', 'public.curate_award_catalog(bigint,text,jsonb)', 'EXECUTE'), false,
  'curate_award_catalog: anon CANNOT execute it (service_role only — AD-8)');
select is(has_function_privilege('authenticated', 'public.curate_award_catalog(bigint,text,jsonb)', 'EXECUTE'), false,
  'curate_award_catalog: authenticated CANNOT execute it either (the route''s requireAdmin is the gate, this is the second lock)');
-- ⚠ award_stat_vocabulary was the one function in this migration relying on the DEFAULT grant (6.1 code review).
-- `create function` grants EXECUTE to PUBLIC and anon/authenticated inherit from PUBLIC, so "no grant line" is not
-- a neutral omission — it silently means "reachable by everyone". Now revoked to service_role, and PINNED, so the
-- posture is asserted rather than inferred.
select is(
  (select bool_or(has_function_privilege(r, 'public.award_stat_vocabulary(text)', 'EXECUTE'))
     from unnest(array['anon', 'authenticated']) r),
  false, 'award_stat_vocabulary: NEITHER client role can execute it (least privilege — its only caller is the RPC)');
select is(has_function_privilege('service_role', 'public.award_stat_vocabulary(text)', 'EXECUTE'), true,
  'award_stat_vocabulary: service_role CAN execute it (curate_award_catalog is security invoker and needs it)');
select is(
  (select prosecdef from pg_proc where oid = 'public.award_catalog_count(bigint)'::regprocedure), true,
  'award_catalog_count: is SECURITY DEFINER (it must be — the caller has no grant on award)');
select ok(
  exists (select 1
            from pg_proc p, unnest(p.proconfig) c
           where p.oid = 'public.award_catalog_count(bigint)'::regprocedure
             and c like 'search_path=%'),
  'award_catalog_count: pins search_path (a loose search_path on an anon-reachable security-definer function is the escalation shape)');

-- ⚠ A PROBE, NOT A BARE READ — CODE-REVIEW FIX 2026-08-08. The retarget below replaced a
-- `throws_ok(…)`, which CANNOT abort the file, with a bare `count(*)` under `set local role anon`.
-- If the grant on `award` is ever missing — which is exactly the R1 half this retarget exists to
-- prove, and exactly what a mutation pass deletes — that bare read raises 42501, aborts the
-- transaction, and takes the `award_catalog_count` pair below with it: a cascade of unexplained
-- failures instead of one named red line. The new form is stronger about BEHAVIOUR and was weaker
-- about FAILURE ISOLATION; this helper restores the second without giving up the first, the same way
-- 0028's `pg_temp.as_role` does.
create function pg_temp.as_anon(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  set local role anon;
  begin
    execute p_sql into v;
  exception when others then
    v := 'raised:' || sqlstate;
  end;
  set local role postgres;
  return v;
end;
$$;

set local role anon;
-- ⭐⭐ THE AC4 PAIR. These two assertions together ARE AD-22 at the DB layer.
--
-- ⭐⭐ RETARGETED BY STORY 6.8b (AC9), AND THIS IS THE SHARPEST OF THE FOUR RETARGETS. It used to be
-- `throws_ok(… , '42501', 'permission denied for table award')`: with NO grant, a viewer was refused
-- at the table gate before RLS was ever consulted, and that refusal WAS the secrecy (`6-1:37-40` —
-- "the secrecy is the ABSENT GRANT, not the blur"). Migration 0028 adds the grant, so that door is
-- now open — and the claim it protected is preserved in a STRONGER form: the query succeeds and
-- returns ZERO ROWS. Nothing in this suite has ever revealed a spin, so `award_viewer_read`'s
-- `exists (… s.revealed_at is not null)` is false for all twelve curated awards.
-- ⛔⛔ AND HERE IS EXACTLY HOW MUCH THAT ZERO PROVES — NARROWED AT CODE REVIEW 2026-08-08, BECAUSE
-- THE CLAIM WRITTEN HERE WAS TOO BROAD. It used to say the zero proves "the door is open AND THE GATE
-- BEHIND IT HOLDS". It does not, in THIS suite: there is no `ceremony`, no `spin` and no
-- `award_result` row anywhere in these fixtures, so `award_viewer_read`'s `exists (… join spin …)`
-- is false because its FROM clause is EMPTY, not because the `revealed_at` predicate discriminated
-- anything. Delete `and s.revealed_at is not null` from the policy and this assertion still returns
-- 0 and stays green. What it DOES catch, and what the retarget is genuinely for, is a widening to
-- `using (true)` — 12 rows against 0 — and the fact that the grant now exists at all.
-- ⭐ THE DISCRIMINATING PROOF LIVES WHERE THE FIXTURES CAN CARRY IT: 0028_reveal_gating_test.sql's
-- Section B walks a real ceremony one reveal at a time and asserts the visible set equals the
-- revealed prefix exactly, and its Section J reads the `revealed_at` predicate back out of pg_policy.
select is(pg_temp.as_anon('select count(*)::text from public.award'), '0',
  'AD-22 after 0028: as ANON, `select * from award` now passes the GRANT gate and returns ZERO rows — the grant is present and no award is exposed without a revealed spin (0023:196-198''s named mechanism)');
select is(public.award_catalog_count((select id from tournament where name = 'TCUR')), 12,
  'AD-22: as ANON, award_catalog_count() returns 12 — the count is the ONLY catalog fact a viewer may learn');
select is(public.award_catalog_count((select id from tournament where name = 'TOTHER')), 0,
  'award_catalog_count: an un-curated tournament counts 0 (the viewer renders NOTHING, never `Premio 1 de 0`)');
set local role postgres;

-- ============================================================================
-- Section D — curate_award_catalog: idempotency, the swap, delete-missing, and every typed refusal (AC1/AC2).
-- ============================================================================
select is((select count(*)::int from award where tournament_id = (select cur from t)), 12,
  'curate: the happy path wrote exactly 12 rows');
select is(
  (select array_agg(priority order by priority)::int[] from award where tournament_id = (select cur from t)),
  array[1,2,3,4,5,6,7,8,9,10,11,12],
  'curate: priorities are exactly 1..12, each once');
select is(
  (select count(distinct bucket)::int from award where tournament_id = (select cur from t)), 4,
  'curate: all four buckets are represented (the clutch bucket is refilled after the Don Clutch retirement)');
select is(
  (select direction from award where tournament_id = (select cur from t) and name = 'El Inofensivo'), 'min',
  'curate: the direction column round-trips (the one min-direction award landed as min, not the default max)');
select is(
  (select floor_kills from award where tournament_id = (select cur from t) and name = 'Rey del Daño'), 20,
  'curate: a rate award carries floor_kills=20 (FR-21; the payload''s value, not the column default)');
select is(
  (select floor_kills from award where tournament_id = (select cur from t) and name = 'Máquina de Frags'), 0,
  'curate: a volume award carries floor_kills=0');

-- ⭐ IDEMPOTENCY (AC2). Re-sending the SAME catalog produces the SAME 12 rows and no duplicate — true by
-- construction (replace-the-whole-catalog), not by a de-dup check.
select is(
  (select pg_temp.curate((select cur from t), (select awards from seed_payload)) ->> 'count'),
  '12', 'curate: an identical re-post returns count 12');
select is((select count(*)::int from award where tournament_id = (select cur from t)), 12,
  'curate: an identical re-post leaves exactly 12 rows — no duplicate (idempotent by construction)');

-- The catalog is SCOPED: curating TCUR never touched TOTHER.
select is((select count(*)::int from award where tournament_id = (select other from t)), 0,
  'curate: a neighbouring tournament''s catalog is untouched (AD-18 scope)');

-- ⭐⭐ THE PRIORITY SWAP OVER THE RPC — the deferrable UNIQUE proven over the real command path, not just DDL.
select is(
  (select pg_temp.curate(
     (select cur from t),
     (select jsonb_agg(
        case when e ->> 'name' = 'Máquina de Frags' then jsonb_set(e, '{priority}', '2')
             when e ->> 'name' = 'Rey del Daño'     then jsonb_set(e, '{priority}', '1')
             else e end)
        from jsonb_array_elements((select awards from seed_payload)) e)) ->> 'ok'),
  'true', 'curate: a SWAPPED priority pair is ACCEPTED (the deferrable UNIQUE, over the real RPC)');
select is(
  (select priority from award where tournament_id = (select cur from t) and name = 'Máquina de Frags'), 2,
  'curate: the swap landed — Máquina de Frags is now priority 2');
select is(
  (select priority from award where tournament_id = (select cur from t) and name = 'Rey del Daño'), 1,
  'curate: …and Rey del Daño is now priority 1');

-- ⭐ DELETE-MISSING — the payload IS the catalog. A shorter payload retires the omitted awards.
select is(
  (select pg_temp.curate(
     (select cur from t),
     (select jsonb_agg(e) from jsonb_array_elements((select awards from seed_payload)) with ordinality x(e, ord)
       where ord <= 3)) ->> 'count'),
  '3', 'curate: a 3-award payload reports count 3 (declarative replace-the-whole-catalog)');
select is((select count(*)::int from award where tournament_id = (select cur from t)), 3,
  'curate: delete-missing retired the 9 omitted awards — the payload IS the catalog');
select is(
  (select bool_and(name in ('Máquina de Frags', 'Rey del Daño', 'Puntería Quirúrgica'))
     from award where tournament_id = (select cur from t)),
  true, 'curate: exactly the three payload awards survive (not an arbitrary three)');

-- Restore the full catalog for the audit section.
select is(
  (select pg_temp.curate((select cur from t), (select awards from seed_payload)) ->> 'before_count'),
  '3', 'curate: the reply reports the BEFORE count (3) as well as the after — the re-curation evidence');

-- ── D2. Every typed refusal is RETURNED (never raised) AND WRITES NOTHING. ──
-- Each probe runs against TCUR, which holds 12 rows; the row count must be unchanged after every refusal.
select is(
  (select pg_temp.curate(999999999, (select awards from seed_payload)) ->> 'reason'),
  'no_tournament', 'curate refusal: an unknown tournament returns no_tournament (RETURNED, not raised)');

select is(
  (select pg_temp.curate((select cur from t), '[]'::jsonb) ->> 'reason'),
  'empty_catalog', 'curate refusal: an empty array returns empty_catalog — "replace everything with nothing" is never a curation');
select is(
  (select pg_temp.curate((select cur from t), null) ->> 'reason'),
  'empty_catalog', 'curate refusal: a NULL payload returns empty_catalog');
select is(
  (select pg_temp.curate((select cur from t), '{"name":"x"}'::jsonb) ->> 'reason'),
  'empty_catalog', 'curate refusal: a non-array payload returns empty_catalog');

select is(
  (select pg_temp.curate((select cur from t),
     (select jsonb_agg(jsonb_build_object('name', 'A' || g, 'bucket', 'skill', 'class', 'volume',
                                          'deciding_stat', 'kills', 'priority', g))
        from generate_series(1, 65) g)) ->> 'reason'),
  'too_many_awards', 'curate refusal: 65 awards returns too_many_awards (the cap is 64)');

select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','Same','bucket','skill','class','volume','deciding_stat','kills','priority',1),
     jsonb_build_object('name','Same','bucket','weird','class','volume','deciding_stat','deaths','priority',2)
   )) ->> 'reason'),
  'duplicate_name', 'curate refusal: two awards sharing a name returns duplicate_name');

select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','One','bucket','skill','class','volume','deciding_stat','kills','priority',1),
     jsonb_build_object('name','Two','bucket','weird','class','volume','deciding_stat','deaths','priority',1)
   )) ->> 'reason'),
  'duplicate_priority', 'curate refusal: two awards sharing a priority returns duplicate_priority (BEFORE the deferred UNIQUE could raise at COMMIT)');

-- invalid_award, one probe per malformation — `detail` names WHICH field, so a guard that fired for the wrong
-- reason cannot pass. This is the RPC-side twin of Section A1's constraint-name discipline.
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name', E'\t', 'bucket','skill','class','volume','deciding_stat','kills','priority',1)
   )) ->> 'detail'),
  'name', 'curate refusal: a TAB name returns invalid_award/name (the same ~ [^[:space:]] rule as the CHECK)');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','legendary','class','volume','deciding_stat','kills','priority',1)
   )) ->> 'detail'),
  'bucket', 'curate refusal: a bad bucket returns invalid_award/bucket');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','quantity','deciding_stat','kills','priority',1)
   )) ->> 'detail'),
  'class', 'curate refusal: a bad class returns invalid_award/class');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kils','priority',1)
   )) ->> 'detail'),
  'deciding_stat', 'curate refusal: a TYPO''d deciding stat returns invalid_award/deciding_stat');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','rate','deciding_stat','kills','priority',1)
   )) ->> 'detail'),
  'class_key_mismatch', 'curate refusal: a rate award over a volume key returns invalid_award/class_key_mismatch');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills','direction','sideways','priority',1)
   )) ->> 'detail'),
  'direction', 'curate refusal: a bad direction returns invalid_award/direction');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills','priority','one')
   )) ->> 'detail'),
  'priority', 'curate refusal: a NON-NUMERIC priority returns invalid_award/priority — never a 22P02 cast error');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills','priority',0)
   )) ->> 'detail'),
  'priority', 'curate refusal: priority 0 returns invalid_award/priority');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills','floor_rounds',-1,'priority',1)
   )) ->> 'detail'),
  'floors', 'curate refusal: a negative floor returns invalid_award/floors');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills','secondary_stat','nope','priority',1)
   )) ->> 'detail'),
  'secondary_stat', 'curate refusal: a bad secondary_stat returns invalid_award/secondary_stat');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array('"not_an_object"'::jsonb)
   ) ->> 'detail'),
  'not_an_object', 'curate refusal: a non-object array element returns invalid_award/not_an_object');

-- ⭐⭐ THE OMITTED-KEY PAIR (6.1 code review). Every probe above supplies all keys with a BAD VALUE; none omitted a
-- key, and that is what hid the defect. `v_e -> 'missing'` is SQL NULL, `jsonb_typeof` is STRICT so it returns
-- NULL, `NULL <> 'string'` is NULL, and PL/pgSQL treats a NULL IF as FALSE — so an element missing `name` or
-- `priority` used to fall through EVERY guard and die at the INSERT with 23502 (an opaque 500). A guard that only
-- catches malformed VALUES is not a guard against a malformed PAYLOAD.
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('bucket','skill','class','volume','deciding_stat','kills','priority',1)
   )) ->> 'detail'),
  'name', 'curate refusal: an award that OMITS the name key returns invalid_award/name (never a 23502 at the INSERT)');
select is(
  (select pg_temp.curate((select cur from t), jsonb_build_array(
     jsonb_build_object('name','X','bucket','skill','class','volume','deciding_stat','kills')
   )) ->> 'detail'),
  'priority', 'curate refusal: an award that OMITS the priority key returns invalid_award/priority (never a 23502 at the INSERT)');

-- ⭐⭐ AND NOTHING WAS WRITTEN. Every refusal above ran against a tournament holding 12 awards; if any of them
-- had partially applied, this count would have moved. This ONE assertion is what makes "a typed refusal that has
-- written nothing" (AC2) true for the whole block above.
select is((select count(*)::int from award where tournament_id = (select cur from t)), 12,
  'curate: after EVERY typed refusal above, the catalog still holds exactly its 12 rows — no refusal wrote anything');

-- ============================================================================
-- Section E — the audit row (AC2, AD-17). Exactly one per accepted call, correct actor, EVERY detail key.
-- ============================================================================
-- Accepted calls so far against TCUR: seed(1) + identical re-post(2) + swap(3) + 3-award(4) + restore(5).
select is((select count(*)::int from audit_log where action = 'curate_awards' and tournament_id = (select cur from t)), 5,
  'audit: exactly ONE curate_awards row per ACCEPTED call — five accepted calls, five rows (refusals wrote none)');

select is((select count(distinct actor_steamid64)::int from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t)), 1,
  'audit: every row carries the single acting admin');
select is((select actor_steamid64 from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  '76561197960287930', 'audit: the actor is the SteamID64 the RPC was called with (the route passes the verified session, never the body)');

-- ⚠ ASSERT EVERY KEY OF THE DETAIL PAYLOAD. Story 4.2's review found a suite that asserted ONE key while a typo
-- in any other would have NULLed the whole jsonb_build_object with the tests still green.
select is((select detail -> 'before' ->> 'count' from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  '3', 'audit detail: before.count is the pre-call row count (3, from the delete-missing state)');
select is((select detail -> 'after' ->> 'count' from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  '12', 'audit detail: after.count is the post-call row count (12)');
select is((select jsonb_array_length(detail -> 'before' -> 'awards') from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  3, 'audit detail: before.awards lists the 3 pre-call awards');
select is((select jsonb_array_length(detail -> 'after' -> 'awards') from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  12, 'audit detail: after.awards lists all 12 post-call awards');
-- ⚠ The `order by … limit 1` MUST be inside a subquery: applied at the outer level it would limit the EXPANDED
-- key rows, not the audit rows, and the assertion would silently compare a one-key set (caught on the first run).
select set_eq(
  $$select jsonb_object_keys(d) from (
      select detail d from audit_log
       where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1) x$$,
  $$values ('before'), ('after')$$,
  'audit detail: the payload has EXACTLY the before/after keys (AD-17) — no key silently missing, none extra');
select set_eq(
  $$select jsonb_object_keys(d -> 'after' -> 'awards' -> 0) from (
      select detail d from audit_log
       where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1) x$$,
  $$values ('name'), ('bucket'), ('class'), ('deciding_stat'), ('direction'), ('priority')$$,
  'audit detail: EVERY per-award key is present (a typo in any one would have NULLed the whole payload)');
select is((select detail -> 'after' -> 'awards' -> 0 ->> 'name' from audit_log
             where action = 'curate_awards' and tournament_id = (select cur from t) order by id desc limit 1),
  'Máquina de Frags', 'audit detail: after.awards is ordered by priority (award 1 first)');

-- ============================================================================
-- Section F — catalog_frozen: the honest partial of AD-15 until Story 6.2 lands the real ceremony lock (AC2).
-- ============================================================================
select is(
  (select pg_temp.curate((select froze from t), (select awards from seed_payload)) ->> 'reason'),
  'catalog_frozen', 'curate refusal: a tournament in state=ceremony returns catalog_frozen');
select is((select count(*)::int from award where tournament_id = (select froze from t)), 0,
  'curate: the catalog_frozen refusal wrote NOTHING (no rows on the frozen tournament)');
select is((select count(*)::int from audit_log where action = 'curate_awards' and tournament_id = (select froze from t)), 0,
  'curate: the catalog_frozen refusal wrote no audit row either (a refused call is not an admin action to log)');

update tournament set state = 'closed' where name = 'TFROZE';
select is(
  (select pg_temp.curate((select froze from t), (select awards from seed_payload)) ->> 'reason'),
  'catalog_frozen', 'curate refusal: a CLOSED tournament also returns catalog_frozen (both terminal states seal the catalog)');

update tournament set state = 'bracket_live' where name = 'TFROZE';
select is(
  (select pg_temp.curate((select froze from t), (select awards from seed_payload)) ->> 'ok'),
  'true', 'curate: a bracket_live tournament is still curatable (the freeze is not a blanket ban — awards are curated DURING the event)');

-- ============================================================================
-- Section G — integral JSON decimals are ACCEPTED, not 22P02'd (6.1 code review).
-- ============================================================================
-- jsonb stores numbers as `numeric` and PRESERVES SCALE, so `1.0` round-trips through `->>` as the TEXT '1.0'.
-- The guards validate via `::numeric` (trunc(1.0) = 1.0 passes), so a bare `::int` in the INSERT raised 22P02 on a
-- payload the RPC had already accepted — an opaque 500 where the guard's own comment promises a typed refusal.
-- `1.0` IS a valid integer, so the correct behaviour is to ACCEPT it and store 1, which is what these pin.
-- Runs against TFROZE, whose row counts are no longer asserted, so it cannot perturb the sections above.
select is(
  (select pg_temp.curate((select froze from t), jsonb_build_array(
     jsonb_build_object('name','Entero Decimal','bucket','skill','class','volume','deciding_stat','kills',
                        'priority', 1.0, 'floor_rounds', 24.0, 'floor_kills', 0.0)
   )) ->> 'ok'),
  'true', 'curate: an integral JSON decimal (1.0 / 24.0 / 0.0) is ACCEPTED — never an opaque 22P02 cast error');
select is(
  (select priority from award where tournament_id = (select froze from t) and name = 'Entero Decimal'), 1,
  'curate: a priority sent as 1.0 is stored as the integer 1 (the write converts the same way the guard validated)');
select is(
  (select floor_rounds from award where tournament_id = (select froze from t) and name = 'Entero Decimal'), 24,
  'curate: a floor sent as 24.0 is stored as the integer 24');

select * from finish();

rollback;


