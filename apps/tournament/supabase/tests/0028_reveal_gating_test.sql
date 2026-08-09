-- supabase/tests/0028_reveal_gating_test.sql
-- pgTAP proof for migration 0028 (Story 6.8b): the ceremony becomes VISIBLE, on the reveal axis and
-- only on it (FR-24 / FR-30 / FR-31 · AD-22 · AD-6 · AD-7 · AD-11 · AD-17).
-- Run via: supabase test db. Runs inside a transaction and rolls back.
--
--   AC1  the COMMITMENT surface: the row policy AND the column grant, both directions   -> Section A
--   AC2/AC3/AC4  ⭐ THE WALK — the visible set equals the revealed prefix EXACTLY        -> Section B
--   AC5  reveal_spin's typed refusals, one named test per reason, + IC911 corruption     -> Section C
--   AC6  the last reveal completes the ceremony; IC910 still refuses every backward step -> Section D
--   R3   two policies, never OR'd — the property 0002:95-98 actually buys                -> Section E
--   AC4/R6  a pity reveal exposes NO catalog award; award_admin_read stops being dormant -> Section F
--   —    DECISION G: the is_shared definer trigger's BYPASSRLS dependency, asserted       -> Section G
--   AC7  ceremony_locked reaches begin_match_grace / resume_match / bind_match_demo       -> Section H
--   AC5/AC8  the audit row and the award_reveal feed row, asserted BY CONTENT             -> Section I
--   —    ⭐ GUARD THE GUARDS: every closed set READ FROM ITS SOURCE, never from a literal -> Section J
--
-- ⚠⚠ WHY THE CORE ASSERTION IS A WALK AND NOT A SNAPSHOT. A single "after the reveal, anon sees the
-- row" test passes just as happily against `using (true)`. What AD-22 actually claims is an
-- EQUALITY that holds at every step: the visible set IS the revealed prefix — one row more is
-- exactly as much a failure as one row fewer. Section B therefore reveals spins 1..4 one at a time
-- and pins all four tables' anon-visible counts after each, against a catalog that deliberately
-- holds TWO awards no spin ever decides, so "one row more" is representable and would be caught.
--
-- ⚠ EVERY `reveal_spin` REFUSAL GOES THROUGH `pg_temp.probe_reveal`, which catches `when others` and
-- returns the SQLSTATE as text. Without it a mutant that RAISES where the shipped function RETURNS
-- would abort the whole transaction and take every later test with it — the file would go red in a
-- way that says nothing about which guard broke (the 6.1 pattern, `6-2-...md:139`).
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action
-- Item #3), with a CONTROL PASS on unmutated source first. The matrix is in the story's Completion
-- Notes.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- ⚠⚠ THE PER-SECTION COUNTS BELOW ARE THE ONLY MECHANISM FOR SPOTTING AN ASSERTION ADDED OR LOST
-- WITHOUT THE PLAN BEING UPDATED, and 6.8a's review found TWO of its banners contradicting its own
-- plan block (the file still passed, because `plan()` counts only the total — which is exactly how a
-- stale banner survives). Every number below was derived by COUNTING the assertion calls in the
-- section, not by hand, and the accounting is restated in the story's Completion Notes.
--
-- ⛔⛔ THE BANNERS BELOW AND THE PER-SECTION BANNERS IN THE BODY WERE RECONCILED AT CODE REVIEW
-- 2026-08-08, BECAUSE THREE OF THEM DID NOT MATCH AND THE MECHANISM ABOVE THEREFORE DID NOT WORK.
-- Measured: the body's banners read B (7), C (12), J (6) against actual counts of 10, 11 and 7, and
-- summed to 73 against `select plan(76)`. The suite still PASSED, exactly as the paragraph above
-- predicts a stale banner will. Section A's itemisation also read "table-wide SELECT still FALSE (5)"
-- for what is ONE assertion, so A's breakdown summed to 23 rather than 19. Every number here and in
-- the body was re-counted from the assertion calls after the review's patches landed.
--
-- plan(84) = A 19 + B 11 + C 11 + D 6 + E 4 + F 3 + G 2 + H 5 + I 11 + J 9 + K 3:
--   A 19 — the posture, OPENED: the exact policy set on each of the five tables (5) · both client
--          roles hold SELECT on all four reveal-gated tables (1) · NEITHER holds I/U/D on any of
--          them (1) · all five still ENABLE+FORCE (1) · all five viewer policies exist and every one
--          is a SELECT policy (1) · the viewer/admin role split is anon+authenticated vs
--          authenticated (1) · all five admin policies exist and every one carries the (select …)
--          init-plan wrap (1) · reveal_spin is security INVOKER (1) · its EXECUTE matrix (2: not the
--          client roles, yes service_role) · ⭐ ceremony's COLUMN gate in BOTH directions: table-wide
--          SELECT still FALSE (1) · any-column SELECT TRUE (1) · all six commitment columns granted
--          (1) · NONE of the four secret columns granted (1) · no any-column I/U/D (1).
--   B 11 — ⭐ THE WALK: the anon-visible 4-tuple at k=0,1,2,3 (4) · the three accepted reveals that
--          move it (3) · the commitment row IS readable at k=0, seed included (the bytes are public
--          before any outcome is — that is what makes it a commitment) · ⭐ the SAME row asked for
--          with `select *` is REFUSED 42501 (DECISION B's other half) · an authenticated NON-admin
--          sees exactly what anon sees, on all four tables · ⭐ a `not_started` ceremony is INVISIBLE
--          to anon — the row on the FALSE side of `state <> 'not_started'`, without which that
--          predicate is indistinguishable from `using (true)` (a T8 mutant survived on exactly this).
--   C 11 — every typed refusal through the probe: no_ceremony · ceremony_not_spinning from `locked` ·
--          no_such_spin · already_revealed · out_of_order skipping ahead · out_of_order carries
--          expected_spin_index · unknown_actor on NULL · unknown_actor on an unknown id · ⭐ IC911 on
--          a non-prefix revealed set · ⭐ IC911 on a non-dense spin order · a refusal writes NOTHING
--          (spin/feed/audit all unmoved). (`ceremony_not_spinning` from `complete` is in D, where the
--          completion that produces it is proven.)
--   D  6 — the final reveal is accepted · ceremony.state is `complete` after it · completed_at was
--          written and equals the reveal stamp · a COMPLETE ceremony then refuses
--          ceremony_not_spinning · IC910 still refuses complete->spinning · and the skip
--          locked->complete. (has_trigger is in J.)
--   E  4 — R3, both halves. (a) with the ADMIN policy replaced by a deliberately broken
--          `using (true)`, anon still sees exactly the revealed prefix · and the blast radius is
--          exactly the role that policy named (authenticated sees all 4). ⚠ Those two prove ROLE
--          SCOPING, not separation — `spin_admin_read` names `authenticated`, so they hold for ANY
--          body of it. (b) ⭐ CODE-REVIEW ADDITION: the same regression OR'd INTO the VIEWER policy
--          publishes all 4 spins to anon (the merge's cost, MEASURED) · and moved back into a
--          separate admin policy it publishes none. THAT pair is the property 0002:95-98 buys, and
--          before the review it had no behavioural test at all — T8's M09 was killed by DDL.
--   F  3 — a PITY reveal adds ZERO award rows (R6, asserted positively) · an ADMIN now reads ALL
--          five awards — award_admin_read is LIVE for the first time (0023:174-176) · an admin reads
--          UNREVEALED spins too.
--   G  2 — assert_award_result_is_shared's owner carries rolbypassrls · the trigger still counts the
--          TRUE winner set with a viewer policy present (it raises IC909 on a drifting row).
--   H  5 — begin_match_grace / resume_match / bind_match_demo each refuse `ceremony_locked` (3) ·
--          begin_match_grace still WORKS when no ceremony is locked (the positive control) ·
--          ⭐ bind_match_demo's idempotent no-op branch still answers ok under the lock, because it
--          writes nothing and 0016:174-185 requires a retry not to become a permanent error.
--   I 11 — exactly one timeline_feed row per reveal · all are award_reveal on the right tournament ·
--          the main+winner detail EXACTLY · the zero-winner detail OMITS subtitle · the pity detail
--          OMITS title · the shared detail joins BOTH winners · exactly one audit row per reveal ·
--          the audit before/after key sets EXACTLY · the final audit row records the completion ·
--          audit_log stays invisible to anon · the feed rows ARE visible to anon.
--   J  9 — ⭐ the refusal set read from reveal_spin's OWN prosrc · the granted column set for BOTH
--          client roles read from information_schema.column_privileges · the policy set read from
--          pg_policy · the three AC7 RPCs are still security INVOKER · ⭐ all three CHILD gates exist
--          and still carry their own `revealed_at` predicate (the T8 mutation pass proved no
--          behavioural test can — the gate is enforced twice) · ⭐ both child gates reference their
--          OWN table's spin_id, QUALIFIED (M05's class, unreachable behaviourally) · the trigger
--          ceremony_transition_valid still exists by name · the emit names `spin.reveal` on
--          `ceremony:` and emits exactly once, counted with comments stripped · ⭐ one `v_now` feeds
--          both `revealed_at` and `completed_at` (an in-transaction equality cannot see this).
--   K  3 — ⭐ CODE-REVIEW SECTION: persist_ceremony refuses `reveal_in_progress` on a mid-reveal
--          ceremony · it wrote nothing · and a ceremony with zero revealed spins is NOT refused by
--          that guard (the positive control that keeps the first assertion non-vacuous).
select plan(84);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into season (name) values ('Season 1');

insert into player (steamid64, display_name) values
  ('76561198000000011', 'Ana'),
  ('76561198000000022', 'Beto'),
  ('76561198000000033', 'Caro'),
  ('76561198000000044', 'Dani');

-- ⭐ THE WALK'S TOURNAMENT. Four spins, chosen so the cumulative visible set moves DIFFERENTLY on
-- each of the four tables and a single wrong join cannot satisfy all five checkpoints:
--   spin 1  main  · award A · 1 winner    -> +1 spin +1 result +1 winner +1 award
--   spin 2  main  · award B · 0 winners   -> +1 spin +1 result +0 winner +1 award   (no_eligible_players)
--   spin 3  main  · award C · 2 winners   -> +1 spin +1 result +2 winner +1 award   (FR-29 rung 5, shared)
--   spin 4  pity  · NO award · 1 winner   -> +1 spin +1 result +1 winner +0 award   (⭐ R6)
-- …and TWO further awards, 'Fantasma' and 'Espectro', that no spin ever decides, so "the viewer sees
-- one row MORE than the revealed prefix" is representable and would redden Section B/F rather than
-- being unfalsifiable. Five in the catalog, three ever decided, three ever visible to a viewer.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TW');

insert into roster_entry (tournament_id, steamid64)
select (select id from tournament where name = 'TW'), s
  from (values ('76561198000000011'), ('76561198000000022'),
               ('76561198000000033'), ('76561198000000044')) as v(s);

insert into award (tournament_id, name, bucket, class, deciding_stat, priority) values
  ((select id from tournament where name = 'TW'), 'Cuchillero', 'weird', 'volume', 'knife_kills',    1),
  ((select id from tournament where name = 'TW'), 'Muralla',    'skill', 'volume', 'wallbang_kills', 2),
  ((select id from tournament where name = 'TW'), 'Cegador',    'weird', 'volume', 'flash_assists',  3),
  ((select id from tournament where name = 'TW'), 'Fantasma',   'weird', 'volume', 'no_scope_kills', 4),
  ((select id from tournament where name = 'TW'), 'Espectro',   'skill', 'volume', 'entry_frags',    5);

insert into stat_snapshot (tournament_id, content_sha256)
  values ((select id from tournament where name = 'TW'), repeat('a', 64));

-- ⭐ INSERTED ALREADY `spinning` WITH THE FROZEN COLUMNS SET — the exact state `persist_ceremony`
-- leaves behind (`0027:1101-1104`), which is reveal_spin's only legal entry point. `spin_plan` and
-- `luck_weight_table` carry real values so Section A's "these columns are NOT granted" assertions
-- are denying access to something rather than to a NULL.
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id, algorithm_version,
                      spin_plan, luck_weight_table, started_at)
  values ((select id from tournament where name = 'TW'), 'spinning',
          '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
          (select id from stat_snapshot limit 1), 'inclusivcup-roulette-1.0.0',
          '[{"spin_index":1,"pool":["1","2","3"]}]'::jsonb, array[8, 4, 2, 1], now());

-- ⭐⭐ THE WALK'S SPINS ARE INSERTED **LAST**, AFTER EVERY OTHER CEREMONY'S, AND THAT ORDERING IS
-- LOAD-BEARING — IT IS NOT TIDINESS. Both `spin.id` and `award_result.id` are `generated always as
-- identity` starting at 1, so inserting the walk's four spins here would give them ids 1-4 and its
-- four award_results ids 1-4 TOO. Under that coincidence a gate written `where s.id = id` — the
-- WRONG column, `award_result`'s own id instead of its `spin_id` — selects exactly the right spin by
-- accident, and the whole walk passes against a policy that is joining on nonsense.
-- ⚠ MEASURED, NOT IMAGINED: the T8 mutation pass applied precisely that mutation (M05) and it
-- SURVIVED this file until the fixture was re-ordered. Deferring these four inserts to after TL/TC/
-- TD/TO gives the walk's spins ids 8-11 against award_result ids 1-4, so the two can no longer be
-- confused, and M05 now reddens Section B. ⛔ Do not "tidy" these inserts back up next to their
-- ceremony.
-- ── the SECOND ceremony: still `locked`, so Section C can reach ceremony_not_spinning ────────────
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TL');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'TL'), 'locked', repeat('b', 64),
          (select id from stat_snapshot limit 1));

-- ── the THIRD ceremony: a CORRUPT reveal order, the only input that reaches IC911 ────────────────
-- ⚠ Reachable ONLY by writing `spin.revealed_at` directly, which is exactly what IC911 exists to
-- detect: reveal_spin is the sole writer of that column and walks the axis forward one dense step at
-- a time, so a revealed set of {2} with 1 unrevealed cannot be produced through the RPC.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TC');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'TC'), 'spinning', repeat('c', 64),
          (select id from stat_snapshot limit 1));
insert into spin (ceremony_id, spin_index, kind, revealed_at)
select (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TC'),
       ix, 'main', ra
  from (values (1, null::timestamptz), (2, now())) as v(ix, ra);

-- ── the FOURTH ceremony: a NON-DENSE spin order, the other IC911 branch ──────────────────────────
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TD');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'TD'), 'spinning', repeat('d', 64),
          (select id from stat_snapshot limit 1));
insert into spin (ceremony_id, spin_index, kind)
select (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TD'),
       ix, 'main'
  from (values (1), (3)) as v(ix);   -- index 2 missing: max(4) <> count

-- ── the FIFTH ceremony: three UNREVEALED spins, so "skipping ahead" is representable ─────────────
-- ⚠⚠ IT NEEDS ITS OWN CEREMONY, AND THAT IS A FINDING RATHER THAN A PREFERENCE. By the time Section
-- C runs, the walk's ceremony has spins 1-3 revealed and only index 4 left — which IS the next
-- index, so a call naming it is legally in order and returns `ok`. The first cut of this file
-- asserted out_of_order against exactly that call and the suite told me it had revealed the spin
-- instead. To prove out_of_order at all, an unrevealed GAP must exist ahead of the index asked for.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TO');
insert into ceremony (tournament_id, state, seed_demo_sha256, snapshot_id)
  values ((select id from tournament where name = 'TO'), 'spinning', repeat('f', 64),
          (select id from stat_snapshot limit 1));
insert into spin (ceremony_id, spin_index, kind)
select (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TO'),
       ix, 'main'
  from (values (1), (2), (3)) as v(ix);

-- ⭐ …and NOW the walk's four spins, deliberately last (see the ⭐⭐ note above): ids 8-11, well
-- clear of the award_result ids 1-4 they must never be confused with.
insert into spin (ceremony_id, spin_index, kind)
select (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TW'),
       ix, k
  from (values (1, 'main'), (2, 'main'), (3, 'main'), (4, 'pity')) as v(ix, k);

-- ── ⭐⭐ A `not_started` CEREMONY — ADDED AT CODE REVIEW 2026-08-08, AND IT CLOSES A SURVIVING
--    MUTANT. `ceremony_viewer_read` is `using (state <> 'not_started')`, but EVERY ceremony in these
--    fixtures was `locked` or `spinning`, so the predicate was TRUE for all of them and widening it to
--    `using (true)` was behaviourally IDENTICAL over the whole file. Measured: that mutation
--    (T8's missing row for the AC1 commitment gate — the author's table never ran it) SURVIVED with
--    83/83 green. Without a row on the FALSE side of a predicate, asserting the predicate is not
--    possible. This is that row.
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TN');
insert into ceremony (tournament_id, state)
  values ((select id from tournament where name = 'TN'), 'not_started');

-- ── the SIXTH tournament: NO ceremony at all, for Section H's positive control ────────────────────
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TF');
insert into roster_entry (tournament_id, steamid64)
select (select id from tournament where name = 'TF'), s
  from (values ('76561198000000011'), ('76561198000000022')) as v(s);

-- Re-derived rather than hardcoded, and SCOPED BY NAME rather than `limit 1` — the correction 0025's
-- and 0026's reviews both made to their own views (`0027:159-177`).
create temporary view f as
select
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TW') as walk_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TL') as locked_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TC') as corrupt_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TD') as sparse_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TO') as order_ceremony,
  (select c.id from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TN') as unstarted_ceremony,
  (select id from tournament where name = 'TW')                        as walk_tournament,
  (select id from tournament where name = 'TF')                        as free_tournament,
  (select id from award where name = 'Cuchillero')                     as aw1,
  (select id from award where name = 'Muralla')                        as aw2,
  (select id from award where name = 'Cegador')                        as aw3,
  (select id from award where name = 'Fantasma')                       as aw4,
  (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
    where t.name = 'TW' and re.steamid64 = '76561198000000011')         as ana,
  (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
    where t.name = 'TW' and re.steamid64 = '76561198000000022')         as beto,
  (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
    where t.name = 'TW' and re.steamid64 = '76561198000000033')         as caro,
  (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
    where t.name = 'TW' and re.steamid64 = '76561198000000044')         as dani;

create temporary view sp as
select s.spin_index, s.id
  from spin s where s.ceremony_id = (select walk_ceremony from f);

-- ── the four spins' results and winners ──────────────────────────────────────
insert into award_result (spin_id, kind, award_id, outcome_kind, is_pity, is_shared) values
  ((select id from sp where spin_index = 1), 'main', (select aw1 from f), 'winner',              false, false),
  ((select id from sp where spin_index = 2), 'main', (select aw2 from f), 'no_eligible_players', false, false),
  ((select id from sp where spin_index = 3), 'main', (select aw3 from f), 'shared',              false, true),
  ((select id from sp where spin_index = 4), 'pity', null,                'winner',              true,  false);

insert into award_result_winner (award_result_id, spin_id, winner_entry_id) values
  ((select ar.id from award_result ar where ar.spin_id = (select id from sp where spin_index = 1)),
   (select id from sp where spin_index = 1), (select ana from f)),
  ((select ar.id from award_result ar where ar.spin_id = (select id from sp where spin_index = 3)),
   (select id from sp where spin_index = 3), (select beto from f)),
  ((select ar.id from award_result ar where ar.spin_id = (select id from sp where spin_index = 3)),
   (select id from sp where spin_index = 3), (select caro from f)),
  ((select ar.id from award_result ar where ar.spin_id = (select id from sp where spin_index = 4)),
   (select id from sp where spin_index = 4), (select dani from f));

-- ⚠⚠ THE FIXTURE IS PROVEN WELL-FORMED RIGHT HERE, AND THEN THE DECLARED MODE IS RESTORED.
-- `award_result_is_shared_consistent` / `award_result_winner_is_shared_consistent` are
-- `deferrable initially deferred` (`0025:335-343`), so they fire at COMMIT — and this file NEVER
-- commits. Without forcing them once, a fixture whose `is_shared` or `outcome_kind` cardinality was
-- wrong would sail through every assertion below and the walk would be measuring a shape the real
-- writer could not produce. ⚠ `set constraints` is TRANSACTION-scoped, not statement-scoped (the
-- trap 6.8a's own fix got wrong the first time, taking its suite from 68/68 to 6 failures), so the
-- declared default is restored immediately afterwards for everything that follows.
set constraints public.award_result_is_shared_consistent,
                public.award_result_winner_is_shared_consistent immediate;
set constraints public.award_result_is_shared_consistent,
                public.award_result_winner_is_shared_consistent deferred;

-- ⚠ THE PROBES. reveal_spin RETURNS its business refusals, so a passing test could read the reason
-- directly — but a MUTANT that raises instead would abort the transaction and redden every later
-- test for an unrelated reason. These wrappers turn any raise into a readable value, so the mutation
-- pass gets one named failure instead of a cascade.
create function pg_temp.probe_reveal_raw(p_ceremony bigint, p_index int, p_actor text)
returns jsonb language plpgsql as $$
begin
  return public.reveal_spin(p_ceremony, p_index, p_actor);
exception when others then
  return jsonb_build_object('raised', sqlstate);
end;
$$;

create function pg_temp.probe_reveal(p_ceremony bigint, p_index int, p_actor text)
returns text language sql as $$
  select case
           when r ? 'raised'                        then 'raised:' || (r ->> 'raised')
           when coalesce((r ->> 'ok')::boolean, false) then 'ok'
           else coalesce(r ->> 'reason', '<no-reason>')
         end
    from pg_temp.probe_reveal_raw(p_ceremony, p_index, p_actor) r;
$$;

-- ⚠⚠ WHY EVERY ROLE-SCOPED READ GOES THROUGH A HELPER INSTEAD OF A BARE `set local role anon`.
-- The fixture ids live in the temporary view `f`, and a TEMPORARY view is owned by `postgres` and is
-- NOT readable by `anon` — a `set local role anon; select … from f` block dies with 42501 on the
-- FIXTURE rather than on the thing under test, which would have been a test that fails for a reason
-- that has nothing to do with AD-22. So the id is resolved by the CALLER (as postgres, where `f` is
-- readable), interpolated into the statement, and only then is the role switched. Measured, not
-- theorised: `create temporary view tv …; set local role anon; select * from tv` → 42501.
--
-- ⭐ AND THE EXCEPTION HANDLER IS LOAD-BEARING TWICE OVER: it restores the role so one 42501 cannot
-- cascade through every later section, AND it makes a REFUSAL an assertable VALUE — which is what
-- lets the `select *`-on-ceremony case below assert the column gate firing rather than abort the file.
create function pg_temp.as_role(p_role text, p_claims text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', coalesce(p_claims, ''), true);
  begin
    execute p_sql into v;
  exception when others then
    v := 'raised:' || sqlstate;
  end;
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return v;
end;
$$;

-- The anon-visible 4-tuple, as ONE comparable string. A tuple rather than four separate assertions
-- because the CLAIM is a joint equality — "the visible set is the revealed prefix" — and four
-- independent numbers let a reviewer lose track of which checkpoint drifted.
-- ⚠ SCOPED TO ONE CEREMONY, DELIBERATELY. An unscoped `count(*)` also counts the CORRUPT ceremony's
-- pre-revealed spin (the IC911 fixture), which is a real revealed row and would make k=0 read
-- `1/0/0/0`. That is the gate answering correctly about a different ceremony — so the walk names its
-- own.
-- ⭐⭐ THE SPIN IDS ARE RESOLVED AS **POSTGRES**, BEFORE THE ROLE SWITCH, AND THE COUNTS THEN JOIN
-- NOTHING. THIS IS A CORRECTION THE T8 MUTATION PASS FORCED, AND IT MATTERS.
-- The first version scoped each child count with `join public.spin s on s.id = ar.spin_id where
-- s.ceremony_id = …`. That join reads `spin` AS ANON, so it is itself reveal-gated — which means the
-- child counts could never exceed what `spin` was already exposing. A leak in `award_result`'s OWN
-- policy was therefore INVISIBLE to the walk: mutant M05 (the gate joining on the wrong column,
-- which Postgres resolves to the inner scope as `s.id = s.id`, i.e. "is ANY spin revealed") made
-- every award_result readable and the walk still printed 0/0/0/0, because the masking join found no
-- visible spin to hang them off.
-- ⛔ SO THE MEASUREMENT MUST NOT PASS THROUGH A GATED TABLE. The id list is captured under the
-- privileged role and inlined as an array, so each count observes exactly one policy — the one it
-- is about — and a leak in any single table is attributable to that table.
-- ⭐⭐ THE EXCEPTION HANDLER IS A CODE-REVIEW FIX (2026-08-08), AND ITS ABSENCE WAS THE SAME DEFECT
-- THE COMMENT ABOVE `as_role` WARNS ABOUT — in the helper that is called at five checkpoints.
-- This function ran four counts under `set local role anon` with no handler at all. Any of them
-- raising — i.e. a MISSING GRANT, which is half of R1 and precisely what a mutation pass deletes —
-- propagated out, aborted the transaction with the role still `anon`, and took every later section
-- with it. The four most important mutants would each have produced an unreadable cascade instead of
-- one named red line. Now a refusal is a VALUE (`raised:42501`) that reddens exactly the checkpoint
-- it happened at, the role is always restored, and the sections after it still run.
--
-- ⚠ ROLE-PARAMETERISED, ALSO A CODE-REVIEW FIX. The "an authenticated non-admin sees exactly what
-- anon sees" assertion in Section B used to compare the authenticated role's counts to a HARDCODED
-- literal, over two of the four tables — so it asserted a number, not an EQUALITY, and a stray
-- `to authenticated using (true)` policy on `award_result_winner` would have leaked every winner of
-- every unrevealed spin without reddening the one test whose message is "signing in reveals
-- nothing". Both sides are now computed by this same function over all four tables.
create function pg_temp.role_counts(p_role text, p_claims text, p_ceremony bigint, p_tournament bigint)
returns text language plpgsql as $$
declare t text; ids bigint[];
begin
  -- Resolved as POSTGRES, before the switch, and the counts below then JOIN NOTHING — see the block
  -- above: a join through `spin` is itself reveal-gated and would mask a leak in a child's own policy.
  select array_agg(s.id) into ids from public.spin s where s.ceremony_id = p_ceremony;
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', coalesce(p_claims, ''), true);
  begin
    select (select count(*) from public.spin s               where s.id      = any (ids))::text || '/' ||
           (select count(*) from public.award_result ar      where ar.spin_id = any (ids))::text || '/' ||
           (select count(*) from public.award_result_winner w where w.spin_id = any (ids))::text || '/' ||
           (select count(*) from public.award a where a.tournament_id = p_tournament)::text
      into t;
  exception when others then
    t := 'raised:' || sqlstate;
  end;
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return t;
end;
$$;

-- The anon 4-tuple — the walk's instrument. A thin wrapper so every existing checkpoint reads the
-- same as before while both roles now go through one implementation.
create function pg_temp.anon_counts(p_ceremony bigint, p_tournament bigint)
returns text language plpgsql as $$
begin
  return pg_temp.role_counts('anon', null, p_ceremony, p_tournament);
end;
$$;

-- ============================================================================
-- Section A — the posture, OPENED. Grants, policies, FORCE, and the column gate  (19)
-- ============================================================================
-- ⭐ THIS SECTION IS THE MIRROR IMAGE OF THE FOUR SUITES THIS STORY RETARGETS. They asserted an
-- ABSENCE ("no viewer can read this"); these assert the OPENING is exactly the intended shape and
-- nothing wider. R1 is why every one of them checks the grant AND the policy.

select policies_are('public', 'spin', array['spin_viewer_read', 'spin_admin_read'],
  'spin: exactly TWO policies — the reveal-gated viewer read and the separate admin read (R3)');
select policies_are('public', 'award_result',
  array['award_result_viewer_read', 'award_result_admin_read'],
  'award_result: exactly TWO policies, gated through the PARENT spin (AC3)');
select policies_are('public', 'award_result_winner',
  array['award_result_winner_viewer_read', 'award_result_winner_admin_read'],
  'award_result_winner: exactly TWO policies, gated on its OWN spin_id (DECISION D / R5)');
select policies_are('public', 'award', array['award_admin_read', 'award_viewer_read'],
  'award: 0023''s admin read is JOINED by the reveal-gated viewer read — an opening, never a tightening (6-1:71)');
select policies_are('public', 'ceremony', array['ceremony_admin_read', 'ceremony_viewer_read'],
  'ceremony: 0024''s admin read is joined by the commitment policy, gated on ceremony.state (AC1)');

-- R2 — SELECT only, to BOTH client roles, on all four reveal-gated tables.
select is(
  (select bool_and(has_table_privilege(r, t, 'SELECT'))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.spin', 'public.award_result', 'public.award_result_winner',
                       'public.award']) t),
  true,
  'R2: BOTH client roles hold SELECT on all four reveal-gated tables — the grant half of 0025:51-52');

-- ⚠ THE FOUR-VERB MATRIX MINUS SELECT, NOT A SINGLE-VERB CHECK. `has_table_privilege`, never a row
-- count over `information_schema.role_table_grants`: Supabase's project-wide default privileges hand
-- anon/authenticated REFERENCES/TRIGGER/TRUNCATE on EVERY new public table, so a bare grant count is
-- 3 for a table nobody granted anything on (`0025 test:157-161` records exactly this).
select is(
  (select bool_or(has_table_privilege(r, t, p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.spin', 'public.award_result', 'public.award_result_winner',
                       'public.award']) t,
          unnest(array['INSERT', 'UPDATE', 'DELETE']) p),
  false,
  'R2: NEITHER client role holds INSERT/UPDATE/DELETE on ANY of the four — the opening is SELECT-only');

select is(
  (select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
    where oid in ('public.spin'::regclass, 'public.award_result'::regclass,
                  'public.award_result_winner'::regclass, 'public.award'::regclass,
                  'public.ceremony'::regclass)),
  true,
  'all FIVE tables are still ENABLE + FORCE — ⛔ 0028 opens a read, it does not weaken the row gate');

-- ⚠ THE POPULATION IS COUNTED ALONGSIDE THE VIOLATIONS, AND THAT IS A CODE-REVIEW FIX (2026-08-08).
-- This was a bare "count the violations, assert 0", which is TRUE whenever the `where` clause matches
-- NOTHING — the same empty-set trap this file's TS siblings guard with a
-- `toBeGreaterThanOrEqual(6)` before comparing. Rename every `_viewer_read` policy in a later
-- migration and the violation count stays 0 while the property goes entirely unmeasured. The
-- `total|violations` form cannot pass vacuously: the 5 has to be there too.
select is(
  (select count(*)::int::text || '|' ||
          count(*) filter (where polcmd <> 'r')::int::text
     from pg_policy
    where polname like '%\_viewer\_read'
      and polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                       'public.award_result_winner'::regclass, 'public.award'::regclass,
                       'public.ceremony'::regclass)),
  '5|0', 'all FIVE viewer policies exist and every one is a SELECT policy — no client role gets a data-writing policy');

-- R3 — the ROLE split is the other half of "two policies, never OR'd": the viewer policy names both
-- client roles, the admin policy names only `authenticated` (anon can never be an admin).
select is(
  (select string_agg(distinct
            (select string_agg(rolname, '+' order by rolname) from pg_roles
              where oid = any (p.polroles)), ' | '
            order by (select string_agg(rolname, '+' order by rolname) from pg_roles
                       where oid = any (p.polroles)))
     from pg_policy p
    where p.polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                         'public.award_result_winner'::regclass, 'public.award'::regclass,
                         'public.ceremony'::regclass)),
  'anon+authenticated | authenticated',
  'R3: viewer policies name anon+authenticated, admin policies name authenticated ONLY — exactly two role sets');

-- R4 — the init-plan wrap. A bare `is_admin()` in a USING clause is re-evaluated PER ROW (Supabase's
-- own auth_rls_initplan advisor flags it); `(select public.is_admin())` is hoisted into an InitPlan
-- evaluated once per statement. Read from the CATALOG's rendered expression, not from the file.
-- ⚠ POPULATION ALONGSIDE VIOLATIONS — same code-review fix as the viewer-policy count above, same
-- reason: "EVERY admin policy is wrapped" was satisfied by there being no admin policies at all.
select is(
  (select count(*)::int::text || '|' ||
          -- ⚠ THE RENDERED FORM IS `( SELECT is_admin() AS is_admin)` — note the space after the paren
          -- and the absent `public.` qualification. Matched loosely on purpose: what is being asserted
          -- is the InitPlan WRAP, not pg_get_expr's whitespace.
          count(*) filter (where pg_get_expr(polqual, polrelid) !~ '\(\s*SELECT\s+is_admin')::int::text
     from pg_policy
    where polname like '%\_admin\_read'
      and polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                       'public.award_result_winner'::regclass, 'public.award'::regclass,
                       'public.ceremony'::regclass)),
  '5|0', 'R4: all FIVE admin policies exist and EVERY one carries the (select public.is_admin()) init-plan wrap (0002:53-55)');

select is((select prosecdef from pg_proc where proname = 'reveal_spin'), false,
  'R12: reveal_spin is security INVOKER — definer is reserved for anon-reachable narrow reads (0023:196-198)');

select is(
  (select bool_or(has_function_privilege(r, 'public.reveal_spin(bigint, int, text)', 'EXECUTE'))
     from unnest(array['anon', 'authenticated', 'public']) r),
  false,
  '⭐ NEITHER client role nor PUBLIC may EXECUTE reveal_spin — without the revoke a viewer could spoil the ceremony off the Data API');
select is(
  has_function_privilege('service_role', 'public.reveal_spin(bigint, int, text)', 'EXECUTE'),
  true, 'reveal_spin is EXECUTEable by service_role — the single writer (AD-8)');

-- ⭐⭐ THE COLUMN GATE, IN BOTH DIRECTIONS (AC1 / DECISION B / R7).
-- ⚠ `has_table_privilege` STAYS FALSE and that is the DESIGN, not an oversight: a column-level grant
-- is not a table-level one. A reader who checks only that primitive would conclude `ceremony` is
-- still closed, which is why all four assertions below exist together.
select is(
  (select bool_or(has_table_privilege(r, 'public.ceremony', 'SELECT'))
     from unnest(array['anon', 'authenticated']) r),
  false,
  '⭐ DECISION B: NO table-wide SELECT on ceremony for either client role — the grant is COLUMN-scoped');
select is(
  (select bool_and(has_any_column_privilege(r, 'public.ceremony', 'SELECT'))
     from unnest(array['anon', 'authenticated']) r),
  true,
  '⭐ …but BOTH roles do hold SELECT on SOME column — the commitment is genuinely published (AC1)');
select is(
  (select bool_and(has_column_privilege(r, 'public.ceremony', c, 'SELECT'))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['id', 'tournament_id', 'state', 'seed_demo_sha256',
                       'started_at', 'completed_at']) c),
  true,
  'AC1: all SIX commitment columns are granted to both client roles — incl. seed_demo_sha256 as seed_hex (DECISION C)');
select is(
  (select bool_or(has_column_privilege(r, 'public.ceremony', c, 'SELECT'))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['snapshot_id', 'algorithm_version', 'spin_plan', 'luck_weight_table']) c),
  false,
  '⛔ R7: NONE of snapshot_id / algorithm_version / spin_plan / luck_weight_table is granted — spin_plan names every unrevealed spin''s pool');
-- ⚠ DELETE IS DELIBERATELY CHECKED WITH THE TABLE-LEVEL PRIMITIVE, NOT THE COLUMN ONE, AND THAT IS
-- NOT AN INCONSISTENCY: PostgreSQL has NO column-level DELETE privilege at all (column grants admit
-- only SELECT/INSERT/UPDATE/REFERENCES), so `has_any_column_privilege(…, 'DELETE')` is not a
-- weaker check — it raises "unrecognized privilege type". Measured, not assumed.
select is(
  (select bool_or(has_any_column_privilege(r, 'public.ceremony', p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['INSERT', 'UPDATE']) p)
  or (select bool_or(has_table_privilege(r, 'public.ceremony', 'DELETE'))
        from unnest(array['anon', 'authenticated']) r),
  false,
  'R2 on ceremony: no client role holds INSERT/UPDATE on ANY column, nor DELETE on the table — the commitment is read-only');

-- ============================================================================
-- Section B — ⭐ THE WALK: the visible set IS the revealed prefix, at every step  (11)
-- ============================================================================
-- Counts are `spin/award_result/award_result_winner/award`. The catalog holds FIVE awards and only
-- three are ever decided, so the final `3` is a positive proof that the gate does not leak the two
-- undecided ones — "one row more" is representable here and would fail this test.

select is(pg_temp.anon_counts((select walk_ceremony from f), (select walk_tournament from f)), '0/0/0/0',
  '⭐ k=0: with FORTY-plus rows present and ZERO revealed, a viewer sees NOTHING on any of the four tables');

-- ⭐ THE COMMITMENT IS ALREADY PUBLIC AT k=0, AND THAT IS THE POINT OF AD-22's SECOND PREDICATE.
-- The seed is readable before a single outcome is — bytes fixed before anything is known is what
-- makes it a COMMITMENT rather than a disclosure (SPINE:222-223).
select is(
  pg_temp.as_role('anon', null, format(
    'select c.state || '' | '' || c.seed_demo_sha256 from public.ceremony c where c.id = %s',
    (select walk_ceremony from f))),
  'spinning | 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c',
  '⭐ AC1: at k=0 an ANON viewer already reads ceremony.state and the published seed — commit-then-publish');

-- ⭐⭐ AND THE SAME ROW, ASKED FOR WITH `select *`, IS REFUSED — the half of DECISION B that a
-- reviewer will otherwise meet as a bug report. PostgREST's default `select=*` asks for EVERY column,
-- so an anon request for `ceremony` 42501s on the UNGRANTED ones even though the ROW is visible.
-- ⛔ THAT FAILURE IS THE GATE WORKING. Pinned here so nobody "fixes" it with a table-wide grant.
select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from (select * from public.ceremony c where c.id = %s) q',
    (select walk_ceremony from f))),
  'raised:42501',
  '⭐ DECISION B: `select *` on the SAME visible row is REFUSED (42501) — a reader must name the granted columns');

-- ⭐⭐ THE OTHER SIDE OF AD-22's SECOND PREDICATE, AND A CODE-REVIEW ADDITION (2026-08-08).
-- `ceremony_viewer_read` is `using (state <> 'not_started')`, and the assertion above only ever
-- exercises the TRUE side of that predicate — every ceremony in these fixtures was `locked` or
-- `spinning`. So the gate was never distinguished from `using (true)`: mutating it to exactly that
-- (the T8 row for the AC1 commitment gate, which the author's matrix never ran) left the file 83/83
-- GREEN. ⛔ A PREDICATE WITH NO ROW ON ITS FALSE SIDE IS NOT BEING TESTED. `unstarted_ceremony` is
-- that row, and this is the assertion that makes the `<> 'not_started'` load-bearing:
-- a tournament whose ceremony has not begun publishes NOTHING, not even its own existence.
select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from public.ceremony c where c.id = %s', (select unstarted_ceremony from f))),
  '0',
  '⭐⭐ AC1: a `not_started` ceremony is INVISIBLE to anon — the commitment is published when the ceremony locks, never before (this is what `<> ''not_started''` buys over `using (true)`)');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 1, '76561198000000011'), 'ok',
  'reveal 1 (main, one winner) is accepted');
select is(pg_temp.anon_counts((select walk_ceremony from f), (select walk_tournament from f)), '1/1/1/1',
  '⭐ k=1: exactly the revealed prefix — one spin, its result, its winner, its award. Not one row more');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 2, '76561198000000011'), 'ok',
  'reveal 2 (main, ZERO winners — the common case at the shipped FR-21 floors) is accepted');
select is(pg_temp.anon_counts((select walk_ceremony from f), (select walk_tournament from f)), '2/2/1/2',
  '⭐ k=2: the winner count does NOT move — a no_eligible_players reveal exposes a result with no winner');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 3, '76561198000000011'), 'ok',
  'reveal 3 (main, SHARED — FR-29 rung 5 co-winners) is accepted');
select is(pg_temp.anon_counts((select walk_ceremony from f), (select walk_tournament from f)), '3/3/3/3',
  '⭐ k=3: BOTH co-winners appear at once — the 1..N child shape, not a single winner column');

-- (the k=4 tuple lands in Section F, where the pity claim it proves is stated)

-- An authenticated NON-admin is a viewer, not a half-admin: identical visibility.
-- ⭐ CODE-REVIEW FIX 2026-08-08 — THIS IS NOW AN EQUALITY, OVER ALL FOUR TABLES.
-- It used to compare the authenticated role's `spin`/`award` counts to the literal '3/3': it never
-- evaluated the anon side at all, so it asserted a NUMBER while its message claims an EQUALITY, and
-- it did not look at `award_result` or `award_result_winner`. A stray
-- `award_result_winner_signed_in_read … to authenticated using (true)` would have published every
-- winner of every UNREVEALED spin to any logged-in viewer and left this test — the one whose message
-- is "signing in reveals nothing" — green. Both sides are now measured, over all four gated tables.
select is(
  pg_temp.role_counts('authenticated',
                      '{"app_metadata":{"role":"viewer","steamid64":"76561198000000022"}}',
                      (select walk_ceremony from f), (select walk_tournament from f)),
  pg_temp.role_counts('anon', null,
                      (select walk_ceremony from f), (select walk_tournament from f)),
  'an authenticated NON-admin sees exactly what anon sees, on ALL FOUR gated tables — signing in reveals nothing (AD-22)');

-- ============================================================================
-- Section C — reveal_spin's typed refusals, one named test per reason  (11)
-- ============================================================================
-- ⚠ THE REASON STRING IS ASSERTED, NOT MERELY "SOME ERROR". A test that only checks `ok=false`
-- passes when the wrong guard fires, which is precisely how an out-of-order reveal could be reported
-- as `already_revealed` and nobody would notice.

select is(pg_temp.probe_reveal(999999, 1, '76561198000000011'), 'no_ceremony',
  'no_ceremony: an id that names no ceremony is refused at the unlocked peek, before any lock');

select is(pg_temp.probe_reveal((select locked_ceremony from f), 1, '76561198000000011'),
  'ceremony_not_spinning',
  'ceremony_not_spinning: a ceremony still `locked` has no persisted run to reveal');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 9, '76561198000000011'), 'no_such_spin',
  'no_such_spin: an index this ceremony does not have');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 1, '76561198000000011'),
  'already_revealed',
  '⭐ R9: a DOUBLE reveal REFUSES with already_revealed — it is not idempotent (Cuatro, 2026-08-08)');

-- ⚠ AGAINST A CEREMONY WITH NOTHING REVEALED YET, so index 3 genuinely skips 1 and 2 (see the
-- fixture note — asking the WALK's ceremony for index 4 would be legally in order and would reveal).
select is(pg_temp.probe_reveal((select order_ceremony from f), 3, '76561198000000011'), 'out_of_order',
  '⭐ AC5: skipping ahead is REFUSED — the published spin order IS the reveal order (UX-DR32/42)');

select is(
  (pg_temp.probe_reveal_raw((select order_ceremony from f), 3, '76561198000000011')
     ->> 'expected_spin_index'),
  '1',
  'out_of_order carries expected_spin_index as CONTEXT, so the caller learns what to press instead of guessing');

-- ⚠ THE INDEX IS THE CORRECT ONE IN BOTH CALLS, DELIBERATELY. `unknown_actor` is the LAST guard, so
-- naming an out-of-order index here would have been refused earlier and these two tests would have
-- passed for the wrong reason — the exact "asserted ok=false, not the reason" trap this section
-- exists to avoid.
select is(pg_temp.probe_reveal((select order_ceremony from f), 1, null), 'unknown_actor',
  'unknown_actor: a NULL actor is refused BEFORE any write (audit_log.actor_steamid64 is NOT NULL, 0003:24)');
select is(pg_temp.probe_reveal((select order_ceremony from f), 1, '76561198000000099'), 'unknown_actor',
  'unknown_actor: an actor with no player row is refused before any write, not discovered at the audit insert');

-- ⭐⭐ IC911 — GENUINE CORRUPTION, RAISED. Both branches.
select is(pg_temp.probe_reveal((select corrupt_ceremony from f), 1, '76561198000000011'),
  'raised:IC911',
  '⭐ IC911: a revealed set that is NOT a dense prefix ({2} with 1 unrevealed) is CORRUPTION — reveal_spin is the only writer of revealed_at');
select is(pg_temp.probe_reveal((select sparse_ceremony from f), 1, '76561198000000011'),
  'raised:IC911',
  '⭐ IC911: a spin order that is not dense (indexes {1,3}) is refused too — persist_ceremony guarantees density');

-- ⚠ AND A REFUSAL WRITES NOTHING. Every guard above ran; the world must be exactly where the walk
-- left it. This is the assertion that would catch a guard placed AFTER a write.
select is(
  (select (select count(*) from public.spin where revealed_at is not null
             and ceremony_id = (select walk_ceremony from f))::text || '/' ||
          (select count(*) from public.timeline_feed
             where tournament_id = (select walk_tournament from f))::text || '/' ||
          (select count(*) from public.audit_log where action = 'reveal_spin')::text),
  '3/3/3',
  '⭐ EIGHT refusals and TWO raises later, nothing moved: 3 revealed spins, 3 feed rows, 3 audit rows');

-- ============================================================================
-- Section D — AC6: the last reveal COMPLETES the ceremony; IC910 still refuses backward  (6)
-- ============================================================================
select is(pg_temp.probe_reveal((select walk_ceremony from f), 4, '76561198000000011'), 'ok',
  'reveal 4 (the PITY spin, and the ceremony''s highest index) is accepted');

select is(
  (select c.state from public.ceremony c where c.id = (select walk_ceremony from f)),
  'complete',
  '⭐ AC6/DECISION E: revealing the HIGHEST spin_index moved ceremony.state spinning -> complete, in the same transaction');

-- ⚠ WHAT THIS DOES AND DOES NOT PROVE — CORRECTED AT CODE REVIEW 2026-08-08. The `is not null` half
-- is real: `completed_at` was written, and its message used to also claim "the SAME instant as the
-- final reveal" as if the equality proved it. It does not. `now()` is TRANSACTION-START-STABLE and
-- this whole file is one transaction, so the two stamps are equal here whether or not `reveal_spin`
-- threads a single `v_now` — replace both writes with bare `now()` calls and this stays green. The
-- equality is kept (it still kills a `clock_timestamp()`-shaped mutant, and a NULL completed_at), and
-- the CODE-level claim it used to overstate is asserted properly in Section J, from `prosrc`.
select is(
  (select (c.completed_at is not null and c.completed_at = s.revealed_at)
     from public.ceremony c
     join public.spin s on s.ceremony_id = c.id and s.spin_index = 4
    where c.id = (select walk_ceremony from f)),
  true,
  '⭐ completed_at was WRITTEN — 0024:204''s shell, unwritten by anybody until now — and it carries the final reveal''s stamp (that the two come from ONE now() is Section J''s, not this transaction''s to prove)');

select is(pg_temp.probe_reveal((select walk_ceremony from f), 4, '76561198000000011'),
  'ceremony_not_spinning',
  'ceremony_not_spinning: a COMPLETE ceremony has nothing left to reveal — the state guard, from the other side');

-- ⚠ THE FOUR-ARGUMENT FORM. pgTAP's THREE-argument `throws_ok(sql, errcode, text)` reads the third
-- argument as the expected MESSAGE, not as the description — so the 3-arg spelling reported
-- "threw IC910: <my description>" and FAILED while the trigger was behaving perfectly. NULL in the
-- message slot asserts the SQLSTATE only, which is what AC6 asks for.
select throws_ok(
  format('update public.ceremony set state = ''spinning'' where id = %s', (select walk_ceremony from f)),
  'IC910', null,
  'AC6: the transition trigger still refuses complete -> spinning (backward) with IC910');
select throws_ok(
  format('update public.ceremony set state = ''complete'' where id = %s', (select locked_ceremony from f)),
  'IC910', null,
  'AC6: the transition trigger still refuses the SKIP locked -> complete with IC910');

-- ============================================================================
-- Section E — R3: two policies, never OR'd — the property 0002:95-98 buys  (4)
-- ============================================================================
-- ⭐⭐ THE POINT IS NOT THAT TWO POLICIES EXIST. It is that a BROKEN admin clause cannot widen the
-- viewer's set. `0002:95-98`: "Merging them into `using (status = 'approved' or is_admin())` would
-- let an admin-clause bug leak unapproved rows to viewers." So the test BREAKS the admin policy as
-- badly as it can — `using (true)` — and asserts the viewer's set is untouched. Under the merged
-- form this would expose all four spins to anon; under the separate form it exposes nothing new,
-- because `spin_admin_read` does not name `anon` at all.
-- ⚠ Ceremony is complete now, so all four spins are revealed. To keep this test meaningful the
-- fixture temporarily un-reveals two of them — a direct write no RPC would make, done here purely
-- to recreate a partially-revealed world under a broken admin policy.
update public.spin set revealed_at = null
 where ceremony_id = (select walk_ceremony from f) and spin_index in (3, 4);

drop policy spin_admin_read on public.spin;
create policy spin_admin_read on public.spin for select to authenticated using (true);

select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from public.spin s where s.ceremony_id = %s', (select walk_ceremony from f))),
  '2',
  '⭐ R3: with the admin policy BROKEN to `using (true)`, anon STILL sees exactly the 2 revealed spins — separate policies cannot leak');

select is(
  pg_temp.as_role('authenticated',
    '{"app_metadata":{"role":"viewer","steamid64":"76561198000000022"}}',
    format('select count(*)::text from public.spin s where s.ceremony_id = %s',
           (select walk_ceremony from f))),
  '4',
  '…and the blast radius of the broken clause is EXACTLY the role it named: authenticated sees all 4, anon still 2');

-- restore the shipped admin policy; the two spins stay UN-revealed for the merge demonstration below
drop policy spin_admin_read on public.spin;
create policy spin_admin_read on public.spin for select to authenticated
  using ((select public.is_admin()));

-- ⭐⭐ THE TWO ASSERTIONS BELOW ARE A CODE-REVIEW ADDITION (2026-08-08), AND THEY ARE THE ONES THAT
-- ACTUALLY TEST R3. THE TWO ABOVE DO NOT, AND SAYING SO IS THE POINT.
-- `spin_admin_read` is declared `to authenticated`, and `anon` is not `authenticated` — so "break the
-- admin policy, anon is unaffected" holds for ANY body of that policy: `true`, `false`, anything. It
-- restates a Postgres invariant (a policy scoped to a role other than mine does not apply to me),
-- not a property of this migration. ⛔ THE MERGE R3 FORBIDS CAN ONLY LIVE IN `spin_viewer_read`,
-- WHICH THOSE TWO NEVER TOUCH: ship
-- `spin_viewer_read … using (revealed_at is not null or (select public.is_admin()))` and every
-- assertion in this file stayed green. T8 corroborates it — mutant M09 ("the two spin policies
-- MERGED") is recorded as killed by the MIGRATION FAILING TO APPLY, i.e. by DDL, never observed
-- behaviourally. So R3 had no behavioural test at all. These two give it one.
--
-- The realistic defect is not "the admin clause is `true`" — it is `is_admin()` returning TRUE for a
-- caller who is not an admin (an empty-claims regression in a helper this file does not own). That is
-- what `pg_temp.broken_is_admin` models, and it goes in the VIEWER policy, where a merge would put it.
create function pg_temp.broken_is_admin() returns boolean language sql stable as $$ select true $$;

drop policy spin_viewer_read on public.spin;
create policy spin_viewer_read on public.spin for select to anon, authenticated
  using (revealed_at is not null or (select pg_temp.broken_is_admin()));

select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from public.spin s where s.ceremony_id = %s', (select walk_ceremony from f))),
  '4',
  '⭐⭐ R3, THE COST OF MERGING, MEASURED: with the admin clause OR''d INTO the viewer policy, one is_admin() regression publishes all 4 spins to anon — 2 of them UNREVEALED');

-- restore the shipped viewer policy, then prove the same regression is contained by separation
drop policy spin_viewer_read on public.spin;
create policy spin_viewer_read on public.spin for select to anon, authenticated
  using (revealed_at is not null);
drop policy spin_admin_read on public.spin;
create policy spin_admin_read on public.spin for select to authenticated
  using ((select pg_temp.broken_is_admin()));

select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from public.spin s where s.ceremony_id = %s', (select walk_ceremony from f))),
  '2',
  '⭐⭐ …and with the IDENTICAL regression in a SEPARATE admin policy, anon still sees exactly the 2 revealed spins — that difference IS what 0002:95-98 buys');

-- restore the shipped policies and the revealed state before the sections that follow
drop policy spin_admin_read on public.spin;
create policy spin_admin_read on public.spin for select to authenticated
  using ((select public.is_admin()));
update public.spin set revealed_at = now()
 where ceremony_id = (select walk_ceremony from f) and spin_index in (3, 4);

-- ============================================================================
-- Section F — R6: a pity reveal exposes NO award; award_admin_read goes LIVE  (3)
-- ============================================================================
-- ⭐ k=4, the checkpoint Section B deliberately left for here, because the claim it proves is R6's.
select is(pg_temp.anon_counts((select walk_ceremony from f), (select walk_tournament from f)), '4/4/4/3',
  '⭐⭐ R6 / k=4: the PITY reveal added a spin, a result and a winner but ZERO awards — a consolation prize is not a category (0026:104-113). And 3 of 5 awards, never the two undecided ones');

-- ⭐ 0023:174-176 created `award_admin_read` DORMANT: "with no table grant for `authenticated`, an
-- admin 42501s before RLS runs too … It is here so that the day a grant IS added (6.8), the read is
-- already correctly scoped." This is that day, and this is the assertion that it actually works.
select is(
  pg_temp.as_role('authenticated',
    '{"app_metadata":{"role":"admin","steamid64":"76561198000000011"}}',
    format('select count(*)::text from public.award a where a.tournament_id = %s',
           (select walk_tournament from f))),
  '5',
  '⭐ award_admin_read is LIVE for the first time: an admin reads ALL FIVE awards, including the two no spin ever decided');
select is(
  pg_temp.as_role('authenticated',
    '{"app_metadata":{"role":"admin","steamid64":"76561198000000011"}}',
    format('select count(*)::text from public.spin s where s.ceremony_id = %s',
           (select walk_ceremony from f))),
  '4',
  'an admin reads unrevealed spins too — the admin axis is is_admin(), never revealed_at');

-- ============================================================================
-- Section G — DECISION G: the is_shared trigger's BYPASSRLS dependency, with a policy present  (2)
-- ============================================================================
-- ⚠⚠ `deferred-work.md:333` said the security invoker -> definer fix had to be decided "now, before
-- that policy exists". THIS FILE IS THE FIRST ONE WHERE THAT POLICY EXISTS. 6.8a's review then found
-- the deeper half: under FORCE ROW LEVEL SECURITY, RLS applies to the table OWNER too, so
-- `security definer` ALONE does not make the function see every row — the owner's BYPASSRLS
-- attribute is what does. Reassign ownership to a role without it and the fix silently reverts to
-- the deferred-work.md:333 FAIL-OPEN with every behavioural test still green.
select ok(
  (select r.rolbypassrls
     from pg_proc p
     join pg_roles r on r.oid = p.proowner
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_award_result_is_shared'),
  '⭐ DECISION G: assert_award_result_is_shared is owned by a BYPASSRLS role — under FORCE RLS, security definer alone would still be fail-open');

-- …and the behavioural half: with the viewer policies now in place, the trigger must still count the
-- TRUE winner set. A shared result whose winners were reduced to one is a drift IC909 must catch —
-- and the reduced row belongs to a REVEALED spin, so an RLS-filtered count would still see it and
-- pass. Deleting a winner from spin 3 makes is_shared=true disagree with count(*)=1.
select throws_ok($$
  delete from public.award_result_winner w
   using public.spin s
   where w.spin_id = s.id and s.spin_index = 3
     and w.winner_entry_id = (select re.id from public.roster_entry re
                               join public.tournament t on t.id = re.tournament_id
                              where t.name = 'TW' and re.steamid64 = '76561198000000033');
  set constraints public.award_result_winner_is_shared_consistent immediate;
$$,
  'IC909', null,
  '⭐ the is_shared trigger still counts the TRUE winner set with a viewer policy present — a drifting row raises IC909');

-- ============================================================================
-- Section H — AC7: ceremony_locked reaches the grace and bind RPCs  (5)
-- ============================================================================
-- ⭐ CLOSES `deferred-work.md:280`, which 0024:2195-2199 deliberately left open: these three "can do
-- post-lock is churn match state and push timeline_feed entries while the audience is watching the
-- ceremony — a viewer-integrity concern … owned by Story 6.8." This story publishes the ceremony to
-- the audience, so the concern stops being theoretical here.
-- ⚠ `bracket = 'losers'`, not 'winners': `match_routing_complete` requires a winners-bracket row to
-- carry BOTH winner_to_* and loser_to_* routing, while a losers row carries only the winner edge.
-- The 0016 fixture makes the same choice for the same reason.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   competitor_a, competitor_b, winner_to_bracket, winner_to_slot, winner_to_side)
values ((select walk_tournament from f), 'losers', 'Reveal Grace', 81, 'declared',
        (select ana from f), (select beto from f), 'losers', 999, 'a'),
       ((select walk_tournament from f), 'losers', 'Reveal Resume', 82, 'awaiting_grace',
        (select caro from f), (select dani from f), 'losers', 998, 'a');
update match set awaiting_grace_since = now()
 where tournament_id = (select walk_tournament from f) and bracket_slot = 82;

insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state)
values (9681, 'demos/9681.dem', 'matchzy', repeat('e', 64), 'pending');

select is(
  (public.begin_match_grace(
     (select id from match where tournament_id = (select walk_tournament from f) and bracket_slot = 81),
     '76561198000000011') ->> 'reason'),
  'ceremony_locked',
  '⭐ AC7: begin_match_grace refuses ceremony_locked — no new grace clock while the audience watches the ceremony');

select is(
  (public.resume_match(
     (select id from match where tournament_id = (select walk_tournament from f) and bracket_slot = 82),
     '76561198000000011') ->> 'reason'),
  'ceremony_locked',
  '⭐ AC7: resume_match refuses ceremony_locked — resuming would re-open a bracket the snapshot froze');

select is(
  (public.bind_match_demo(
     (select id from match where tournament_id = (select walk_tournament from f) and bracket_slot = 81),
     (select id from demo where matchzy_match_id = 9681),
     '76561198000000011') ->> 'reason'),
  'ceremony_locked',
  '⭐ AC7: bind_match_demo refuses ceremony_locked — a bind flips the match to pending and makes 4.6b''s publish possible');

-- ⭐ THE DELIBERATE ORDERING EXCEPTION, ASSERTED SO IT READS AS A DECISION RATHER THAN AN OVERSIGHT.
-- bind_match_demo's already-bound branch precedes the ceremony guard because it performs NO WRITE
-- and `0016:174-185` requires that a retried bind not "turn a dropped HTTP response into a
-- permanent, misleading error". So under the lock a retry of a bind that already succeeded is still
-- an ok no-op — while the WRITING path above is refused.
update match set demo_id = (select id from demo where matchzy_match_id = 9681)
 where tournament_id = (select walk_tournament from f) and bracket_slot = 82;
update demo set match_id = (select id from match
                             where tournament_id = (select walk_tournament from f) and bracket_slot = 82)
 where matchzy_match_id = 9681;
select is(
  (public.bind_match_demo(
     (select id from match where tournament_id = (select walk_tournament from f) and bracket_slot = 82),
     (select id from demo where matchzy_match_id = 9681),
     '76561198000000011') ->> 'idempotent'),
  'true',
  '⭐ …but bind_match_demo''s already-bound NO-OP branch still answers ok under the lock — it writes nothing (0016:174-185)');

-- The positive control: a tournament with NO ceremony row is unaffected. `coalesce(v_cstate,
-- 'not_started')` is what makes the NULL case fire correctly rather than by three-valued accident.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   competitor_a, competitor_b, winner_to_bracket, winner_to_slot, winner_to_side)
values ((select free_tournament from f), 'losers', 'Free R1', 1, 'declared',
        (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
          where t.name = 'TF' and re.steamid64 = '76561198000000011'),
        (select re.id from roster_entry re join tournament t on t.id = re.tournament_id
          where t.name = 'TF' and re.steamid64 = '76561198000000022'),
        'losers', 999, 'a');
select is(
  (public.begin_match_grace(
     (select id from match where tournament_id = (select free_tournament from f)),
     '76561198000000011') ->> 'ok'),
  'true',
  'the positive control: with NO ceremony row at all, begin_match_grace still works — the guard adds a refusal, it does not break the RPC');

-- ============================================================================
-- Section I — AC8/AC5: the feed row and the audit row, asserted BY CONTENT  (11)
-- ============================================================================
-- ⚠⚠ 6.8a's review found "the audit_log row was asserted by ZERO tests in a migration whose own
-- comment said EVERY key below is asserted in pgTAP." reveal_spin writes an audit row AND a feed
-- row, so both are asserted here by CONTENT and by EXACT KEY SET from the start.

select is((select count(*)::int from public.timeline_feed
            where tournament_id = (select walk_tournament from f)),
  4, 'AC8: exactly ONE timeline_feed row per reveal — four reveals, four rows, no projection');

select is(
  (select bool_and(entry_type = 'award_reveal') from public.timeline_feed
    where tournament_id = (select walk_tournament from f)),
  true,
  'AC8: every one is entry_type = award_reveal — the type 0017:109 has carried with NO writer since Epic 4');

select is(
  (select detail::text from public.timeline_feed
    where tournament_id = (select walk_tournament from f) and detail ->> 'spin_index' = '1'),
  '{"kind": "main", "title": "Cuchillero", "subtitle": "Ana", "spin_index": 1, "award_count": 1, "winner_count": 1}'::jsonb::text,
  '⭐ AC8: the main+winner detail EXACTLY — the award name as title, the winner display name as subtitle (DECISION H: data, never copy)');

select is(
  (select (detail ? 'title')::text || '/' || (detail ? 'subtitle')::text || '/' || (detail ->> 'title')
     from public.timeline_feed
    where tournament_id = (select walk_tournament from f) and detail ->> 'spin_index' = '2'),
  'true/false/Muralla',
  '⭐ AC8: a ZERO-WINNER reveal keeps the award name and OMITS subtitle — model.ts''s shipped fallback carries it, deliberately');

select is(
  (select (detail ? 'title')::text || '/' || (detail ? 'subtitle')::text || '/' || (detail ->> 'subtitle')
     from public.timeline_feed
    where tournament_id = (select walk_tournament from f) and detail ->> 'spin_index' = '4'),
  'false/true/Dani',
  '⭐ AC8/R6: the PITY reveal OMITS title — there is no catalog award to name — and states its winner');

select is(
  (select detail ->> 'subtitle' from public.timeline_feed
    where tournament_id = (select walk_tournament from f) and detail ->> 'spin_index' = '3'),
  'Beto · Caro',
  'AC8: co-winners are joined by the WRITER, so the 1..N child shape reaches the card as one string');

select is((select count(*)::int from public.audit_log where action = 'reveal_spin'),
  4, 'AC5/AD-17: exactly ONE audit_log row per accepted reveal — never one per attempt');

select is(
  (select (select string_agg(k, ',' order by k) from jsonb_object_keys(detail -> 'before') k)
          || ' | ' ||
          (select string_agg(k, ',' order by k) from jsonb_object_keys(detail -> 'after') k)
     from public.audit_log where action = 'reveal_spin' and detail #>> '{after,spin_index}' = '1'),
  'ceremony_state,revealed_at,revealed_spins | awards,ceremony_complete,ceremony_id,ceremony_state,kind,revealed_at,revealed_spins,spin_id,spin_index,total_spins,winners',
  '⭐ the audit row''s before/after KEY SETS exactly — a typo in any one of them would NULL that key with the tests still green (the 4.2 trap)');

select is(
  (select detail #>> '{after,ceremony_state}' || '/' || (detail #>> '{after,ceremony_complete}')
     from public.audit_log where action = 'reveal_spin' and detail #>> '{after,spin_index}' = '4'),
  'complete/true',
  '⭐ AC6: the FINAL reveal''s audit row records the completion it caused — one action, one row, both facts');

-- ⚠ `raised:42501` is the RIGHT answer here, not `0`: audit_log has NO anon grant at all (0003:82-84),
-- so a viewer is refused at the table-grant gate before RLS is consulted. Asserting the refusal is
-- stronger than asserting an empty count, which a table-wide grant plus a restrictive policy would
-- also produce.
select is(pg_temp.as_role('anon', null, 'select count(*)::text from public.audit_log'),
  'raised:42501',
  'audit_log stays admin-only — 0028 opened the ceremony, not the log (0003:82-84 untouched)');
select is(
  pg_temp.as_role('anon', null, format(
    'select count(*)::text from public.timeline_feed tf where tf.tournament_id = %s',
    (select walk_tournament from f))),
  '4',
  'AC8: the feed rows ARE viewer-readable — 0017''s timeline_feed policy is what makes progressive release visible');

-- ============================================================================
-- Section J — ⭐ GUARD THE GUARDS: every closed set READ FROM ITS SOURCE  (9)
-- ============================================================================
-- ⭐⭐ THE PROJECT'S SIGNATURE DEFECT, AT ITS SEVENTH OCCURRENCE (`6-8a:909`: "`if
-- len(inputReachable) != 6` measures the size of a map literal written two lines above it, and
-- nothing in the test reads `ceremony.go`"). Every assertion in this section reads its evidence out
-- of the CATALOG or out of the function's own `prosrc` — never out of a literal copied beside it.

select is(
  (select array_agg(distinct m[1] order by m[1])
     from pg_proc p,
          regexp_matches(
            (select string_agg(l, e'\n')
               from regexp_split_to_table(p.prosrc, e'\n') l
              where l !~ '^\s*--'),
            '''reason'',\s*''([a-z_]+)''', 'g') m
    where p.proname = 'reveal_spin' and p.pronamespace = 'public'::regnamespace),
  array['already_revealed', 'ceremony_not_spinning', 'no_ceremony', 'no_such_spin',
        'out_of_order', 'unknown_actor'],
  '⭐ the closed refusal set, read from reveal_spin''s OWN prosrc with comment lines stripped — a seventh reason added to the SQL reddens here and in lib/ceremony/reveal.test.ts');

-- ⚠ BOTH CLIENT ROLES, AND THAT IS A CODE-REVIEW FIX (2026-08-08). This filtered `grantee = 'anon'`
-- only. R7's whole claim is that a column added to `ceremony` LATER is un-granted BY DEFAULT and that
-- this assertion is what catches anyone breaking it — but 6.9 is named, in this very migration, as the
-- story that widens this row. A later `grant select (bundle_sha256) on public.ceremony to
-- authenticated` left the anon array untouched (green), was not in the four-secret-column list
-- (green), and `has_any_column_privilege` was already true (green): a column published to every
-- signed-in user with nothing reddening, in the file whose entire subject is column-scoped
-- publication. The grantee is now part of the asserted value, so a grant to EITHER role shows up.
select is(
  (select string_agg(grantee || ':' || column_name, ' ' order by grantee || ':' || column_name)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'ceremony'
      and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'),
  'anon:completed_at anon:id anon:seed_demo_sha256 anon:started_at anon:state anon:tournament_id '
  'authenticated:completed_at authenticated:id authenticated:seed_demo_sha256 '
  'authenticated:started_at authenticated:state authenticated:tournament_id',
  '⭐ AC1/R7: the GRANTED column set for BOTH client roles, read from information_schema rather than from the migration text — a column granted to EITHER role reddens here');

select is(
  (select string_agg(polrelid::regclass::text || '.' || polname, ',' order by
                     polrelid::regclass::text || '.' || polname)
     from pg_policy
    where polrelid in ('public.spin'::regclass, 'public.award_result'::regclass,
                       'public.award_result_winner'::regclass, 'public.award'::regclass,
                       'public.ceremony'::regclass)),
  'award.award_admin_read,award.award_viewer_read,award_result.award_result_admin_read,'
  'award_result.award_result_viewer_read,award_result_winner.award_result_winner_admin_read,'
  'award_result_winner.award_result_winner_viewer_read,ceremony.ceremony_admin_read,'
  'ceremony.ceremony_viewer_read,spin.spin_admin_read,spin.spin_viewer_read',
  '⭐ the EXACT policy set across all five tables, read from pg_policy — this is the assertion 0027 test:1137-1155 becomes');

select is(
  (select bool_or(prosecdef) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('begin_match_grace', 'resume_match', 'bind_match_demo')),
  false,
  'R12: the three AC7 RPCs are STILL security INVOKER after their create-or-replace — the guard was the only change');

-- ⭐⭐ THE T8 MUTATION PASS FOUND THIS GAP AND IT IS A REAL ONE, RECORDED RATHER THAN PAPERED OVER.
-- Deleting `and s.revealed_at is not null` from `award_result_viewer_read` (M04) or from
-- `award_viewer_read` (M07) left EVERY behavioural test in this file GREEN. The reason is not a weak
-- suite — it is that the gate is enforced TWICE. A policy's subquery is itself RLS-filtered, so
-- `select 1 from public.spin s where s.id = spin_id` already sees ONLY revealed spins courtesy of
-- `spin_viewer_read`; the child's own predicate is belt to that suspenders. The doubled predicate is
-- visible in the measured plan (`Filter: ((revealed_at IS NOT NULL) AND (revealed_at IS NOT NULL))`,
-- pasted in 0028's award_result comment).
-- ⚠ SO NO BEHAVIOURAL TEST CAN KILL THOSE TWO MUTANTS, AND SAYING SO IS THE POINT: a viewer role
-- cannot be made to bypass `spin_viewer_read`, which is exactly what would be needed to observe the
-- child gate alone. What CAN be asserted is that the redundancy still EXISTS — because it stops
-- being redundant the moment anyone edits `spin_viewer_read`. This reads the predicate out of the
-- CATALOG, so deleting it from the migration reddens here even though behaviour would not move.
-- ⚠ POPULATION ALONGSIDE VIOLATIONS — code-review fix, same empty-set trap as Section A's two counts.
-- `polname in (…)` matching NOTHING made this 0, and the guard the comment above calls "the only
-- thing that can catch its deletion" would have passed after a rename.
select is(
  (select count(*)::int::text || '|' ||
          count(*) filter (where pg_get_expr(polqual, polrelid) not like '%revealed_at%')::int::text
     from pg_policy
    where polname in ('award_result_viewer_read', 'award_result_winner_viewer_read',
                      'award_viewer_read')),
  '3|0',
  '⭐ all THREE child gates exist and every one still carries its OWN `revealed_at` predicate — defence in depth behind spin_viewer_read, and the only thing that can catch its deletion (T8 mutants M04/M07)');

-- ⭐⭐ CODE-REVIEW ADDITION 2026-08-08 — THE CHILD GATES CORRELATE WITH THE **OUTER** TABLE.
-- Both gates were written `where s.id = spin_id`, an UNQUALIFIED name that reaches
-- `award_result.spin_id` only because `public.spin` has no column of that name; give `spin` one and
-- the same text means `s.id = s.spin_id`, uncorrelated, TRUE for every child row the moment any spin
-- is revealed. That is mutant M05. The policies now qualify the outer column.
-- ⛔⛔ AND HERE IS WHAT THIS ASSERTION CAN AND CANNOT DO, MEASURED RATHER THAN ASSUMED — THE FIRST
-- VERSION OF THIS COMMENT CLAIMED MORE THAN THE CATALOG CAN DELIVER, AND A MUTATION RUN CAUGHT IT.
--   * It CANNOT detect the source spelling. `polqual` is a RESOLVED parse tree, not text, so both
--     spellings render identically through `pg_get_expr` as `(s.id = award_result.spin_id)`. Reverting
--     the migration to the unqualified form left this assertion — and the whole file — GREEN.
--     ⛔ SURVIVOR, RECORDED. Do not "strengthen" this into a spelling check; there is nothing left in
--     the catalog to check. The qualifier's value is at the SOURCE, where a future migration copies
--     the text forward and re-resolves it against a `spin` that may have changed.
--   * It CAN detect a gate that does not correlate at all, which is the leak itself rather than the
--     typo that causes it. Measured: mutating both gates to `s.id = s.id` reddens FIVE tests in this
--     file, this one among them (the rendered expression stops containing the outer reference).
select is(
  (select count(*)::int::text || '|' ||
          count(*) filter (
            where pg_get_expr(polqual, polrelid) like '%' || polrelid::regclass::text || '.spin_id%'
          )::int::text
     from pg_policy
    where polname in ('award_result_viewer_read', 'award_result_winner_viewer_read')),
  '2|2',
  '⭐ both CHILD gates exist and both RESOLVE against their own table''s spin_id — a gate that stopped correlating with the outer row (M05''s `s.id = s.id`) reddens here');

select has_trigger('public', 'ceremony', 'ceremony_transition_valid',
  'AC6: 0027''s forward-only transition trigger is still installed BY NAME — 0028 writes through it, it does not replace it');

-- ⚠ COMMENT LINES ARE STRIPPED BEFORE COUNTING — code-review fix. `prosrc` includes the body's
-- comments, so this counted PROSE as well as code: a future `-- see the 'spin.reveal' contract in
-- SPINE:230` would have made it 2/1 and reddened a test whose message reads as an architectural
-- violation. It passed today only because the surrounding block happens to use backticks rather than
-- quotes. The refusal-set assertion at the top of this section already strips them; so does this now.
select is(
  (select (select count(*)::int from regexp_matches(src, '''spin\.reveal''', 'g'))::text || '/' ||
          (select count(*)::int from regexp_matches(src, '''ceremony:''', 'g'))::text
     from (select string_agg(l, e'\n') as src
             from pg_proc p, regexp_split_to_table(p.prosrc, e'\n') l
            where p.proname = 'reveal_spin' and p.pronamespace = 'public'::regnamespace
              and l !~ '^\s*--') q),
  '1/1',
  '⭐ DECISION F: EXACTLY ONE emit in the CODE (comments stripped), naming the SPINE:230 event `spin.reveal` on the `ceremony:<id>` channel — event names are never invented and there is never a second emitter');

-- ⭐ CODE-REVIEW ADDITION — `completed_at` AND `revealed_at` COME FROM ONE VARIABLE, AND ONLY THE
-- SOURCE CAN PROVE IT. Section D asserts `c.completed_at = s.revealed_at`, but `now()` is
-- TRANSACTION-START-STABLE and this whole file is one transaction, so that equality is guaranteed by
-- the harness whether or not the function threads a single stamp: replace both writes with a bare
-- `now()` and Section D stays green. What actually makes the two stamps identical in production is
-- that `reveal_spin` computes `v_now := now()` once and writes it to both columns. That is a
-- source-shape claim, so it is asserted as one, exactly as M04/M07 are above.
select is(
  (select (select count(*)::int from regexp_matches(src, 'v_now\s*:=\s*now\(\)', 'g'))::text || '|' ||
          (select count(*)::int from regexp_matches(src, 'revealed_at\s*=\s*v_now', 'g'))::text || '|' ||
          (select count(*)::int from regexp_matches(src, 'completed_at\s*=\s*v_now', 'g'))::text
     from (select string_agg(l, e'\n') as src
             from pg_proc p, regexp_split_to_table(p.prosrc, e'\n') l
            where p.proname = 'reveal_spin' and p.pronamespace = 'public'::regnamespace
              and l !~ '^\s*--') q),
  '1|1|1',
  '⭐ AC6: ONE `v_now := now()` feeds BOTH `revealed_at` and `completed_at` — the "same instant" claim is a property of the CODE, which an in-transaction equality cannot distinguish from a property of the harness');

-- ============================================================================
-- Section K — CODE REVIEW 2026-08-08: persist_ceremony refuses MID-REVEAL  (3)
-- ============================================================================
-- ⛔⛔ THE HOLE THIS CLOSES. `persist_ceremony`'s state guard admits `spinning` (`0027:666`), which is
-- exactly the state a ceremony is in while `reveal_spin` walks it, and `p_replace => true` then
-- deleted every spin and rewrote `revealed_at` NULL. The viewer's set retracted, but the
-- `award_reveal` `timeline_feed` rows SURVIVED — append-only, and `timeline_view` is `using (true)`
-- (`0017:136`) — so anon kept reading award NAMES for a run that no longer existed, ahead of any
-- reveal in the new run. IC911 was blind: {} over a dense 1..N is a perfectly valid prefix.
-- 0028 section (h) replaces the function with a `reveal_in_progress` typed refusal.
create function pg_temp.probe_persist(p_ceremony bigint, p_replace boolean) returns text
language plpgsql as $$
declare r jsonb;
begin
  -- Same shape as pg_temp.probe_reveal: a RAISING mutant must redden a named test, never abort the file.
  select public.persist_ceremony(p_ceremony, '{"spins":[],"spin_plan":[]}'::jsonb,
                                 '76561198000000011', p_replace) into r;
  return case when coalesce((r ->> 'ok')::boolean, false) then 'ok'
              else coalesce(r ->> 'reason', '<no-reason>') end;
exception when others then
  return 'raised:' || sqlstate;
end;
$$;

-- ⚠ THE FIXTURE HAS TO BE `spinning`, AND FINDING THAT OUT COST A RED TEST — WORTH RECORDING.
-- The first version of this section pointed at `walk_ceremony`, which Section D has by then driven to
-- `complete`. `persist_ceremony`'s EXISTING state guard (`0027:666`, `not in ('locked','spinning')`)
-- fires first and returns `ceremony_not_locked`, so the new guard was never reached. That is the
-- correct behaviour — a COMPLETE ceremony was already protected — and it narrows what this guard is
-- actually for: the `spinning` window, which is the ONLY state that is both re-persistable and
-- mid-reveal. `corrupt_ceremony` is `spinning` with spin 2 revealed and spin 1 not, which is exactly
-- the shape the guard keys on (it counts revealed spins; it does not care about prefix-ness — IC911
-- owns that, and owns it in `reveal_spin`, not here).
select is(pg_temp.probe_persist((select corrupt_ceremony from f), true), 'reveal_in_progress',
  '⭐⭐ persist_ceremony REFUSES p_replace on a `spinning` ceremony that already has a revealed spin — the un-reveal that left published award_reveal feed rows orphaned');

select is(
  (select count(*) filter (where s.revealed_at is not null)::int::text || '/' || count(*)::int::text
     from public.spin s where s.ceremony_id = (select corrupt_ceremony from f)),
  '1/2',
  '…and it wrote NOTHING: both spins still present and the revealed one still revealed (the guard precedes every write, including the p_replace DELETE)');

-- ⚠ THE POSITIVE CONTROL, so the refusal above is not passing because persist_ceremony refuses
-- everything. `order_ceremony` is also `spinning` and also has spins, and differs in EXACTLY the one
-- fact this guard reads: none of them is revealed. It must get past the guard to some other outcome.
-- ⛔ Without this, dropping the guard's `> 0` and refusing unconditionally would still be "killed" by
-- the assertion above — a test that cannot tell a scoped guard from a blanket one.
select isnt(pg_temp.probe_persist((select order_ceremony from f), true), 'reveal_in_progress',
  '…and a `spinning` ceremony with spins but ZERO revealed is NOT refused by this guard — it is scoped to the hole it closes, not to p_replace in general');

select * from finish();
rollback;
