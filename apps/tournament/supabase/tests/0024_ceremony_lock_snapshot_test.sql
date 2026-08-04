-- supabase/tests/0024_ceremony_lock_snapshot_test.sql
-- pgTAP proof for migration 0024 (Story 6.2): the fair_seed freeze + the immutable ceremony snapshot
-- (FR-27 / AD-13 / AD-15 / AD-19). Run via: supabase test db. Runs inside a transaction and rolls back.
--
--   AC1  `ceremony` shape, every named CHECK bites, FORCE RLS, NO anon/authenticated grant,
--        ceremony_snapshot_fk exists                                                              -> Section A
--   AC1  fair_seed: the hex CHECK refuses non-hex/wrong-length/UPPERCASE; the write-once trigger
--        raises IC908 on a CHANGE; NULL->value succeeds; value->SAME value is a NO-OP             -> Section B
--   AC1/AC2/AC3/AC5  ⭐ THE FLAGSHIP: a REAL crowning freezes the seed inside approve_match, then
--        lock_ceremony captures the snapshot, transitions both states and returns the contract     -> Section C
--   AC2  one test per typed refusal, each proving NOTHING WAS WRITTEN                             -> Section D
--   AC2  the audit row: exactly one, action='start_ceremony', correct actor, EVERY detail key      -> Section E
--   AC2  write-once teeth: as service_role, UPDATE/DELETE on both snapshot tables -> 42501         -> Section F
--   AC2  the four `ceremony_locked` guards, each proving the refusal wrote nothing                 -> Section G
--   AC3/AC5  the AD-19 row shape on the REAL captured rows, incl. an independent re-hash           -> Section H
--
-- ⚠⚠ WHY CONSTRAINT NAMES, NOT BARE SQLSTATES. Every CHECK raises the same 23514, so a `throws_ok` on the code
-- alone would pass for the wrong reason — the trap the 4.3 review found across three suites and 6.1 re-hit.
-- Every negative test below asserts the CONSTRAINT NAME in the message.
--
-- ⚠ WHY A REAL CROWNING AND NOT A PRE-SET final_match_id. The freeze re-reads `tournament.final_match_id`
-- AFTER the `advance_match` call, and the whole point of that placement is that advance is what WRITES it
-- (0014:601-605). A fixture that pre-set `final_match_id` would still pass with the freeze moved ABOVE the
-- advance — i.e. it would not catch the one mis-ordering the story calls load-bearing. So TCER drives a
-- genuine 8-player double-elim to its grand final and approves the championship match for real.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS, so they read/write
-- regardless of policy. AD-22 bites at the GRANT gate: anon/authenticated hold ZERO grants on `ceremony` and
-- the snapshot tables, so a viewer 42501s before a policy is consulted. Fixtures are built as postgres; every
-- RPC is driven as service_role (its real caller), which also exercises the grants. SQLSTATE 42501 =
-- insufficient_privilege.
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action Item #3). The
-- full matrix and its OBSERVED red counts are recorded in the story's Completion Notes.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan(94) = A 16 + B 9 + C 15 + D 10 + E 11 + F 4 + G 10 + H 19, accounted for section by section:
--   A 16 — `ceremony`: shape 6 (table · PK · columns_are · state default · the tournament FK · the deferred
--          ceremony_snapshot_fk) · constraints 3 (state CHECK by name · all four states live ·
--          one-per-tournament UNIQUE by name) · RLS/policy 3 (enabled · forced · policies_are) ·
--          grants 4 (anon none · neither client role any verb · service_role S/I/U · NO delete).
--   B  9 — fair_seed: hex CHECK 3 (uppercase · wrong length · non-hex char) · the trigger exists 1 ·
--          NULL->value 1 · value->same value 1 · value->different = IC908 1 · the value is unchanged after
--          the refusal 1 · an unrelated tournament UPDATE does not trip it 1.
--   C 15 — the freeze 4 (approve returns fair_seed_frozen · seed_hex = the demo's sha256 ·
--          tournament.fair_seed = that hash · final_match_id = the GF, i.e. the crowning really happened) ·
--          the lock 11 (ok · exactly one header · content_sha256 round-trips · it is 64-hex · one row per
--          ACTIVE roster player · row_count matches · eligible_count · ceremony.state ·
--          ceremony.seed_demo_sha256 · ceremony.snapshot_id · tournament.state).
--   D 10 — six reachable refusals (no_tournament · not_bracket_live · champion_undecided · seed_unavailable ·
--          no_roster · already_locked) · 4 "nothing was written" proofs (still exactly one header · no
--          snapshot rows · no ceremony rows · empty_snapshot is guard-ordered behind no_roster).
--   E 11 — exactly one start_ceremony row · the actor · 2 `before` keys · 7 `after` keys.
--   F  4 — as service_role: UPDATE/DELETE on stat_snapshot and on stat_snapshot_row -> 42501.
--   G 10 — approve/rollback/manual each refuse `ceremony_locked` (3) · curate refuses `catalog_frozen` on the
--          CEREMONY half and names the cause (2) · curate still refuses on the `closed` TOURNAMENT-STATE half
--          with no ceremony row (1) · nothing written: match state · winner_entry · zero awards · zero audit rows (4).
--   H 19 — the four stats_int blocks + their key sets 5 · integer-form 4 (every volume leaf · every rate pair ·
--          adr's exact {num,den} · the uniform efficiency form) · the winless row 2 · h2h 3 (present · ABSENT ·
--          empty) · idle_dq 4 (fully-DQ'd · winless · the MIXED player · what the mixed player contributes) ·
--          the independent content_sha256 re-hash 1.
--   I 22 — ⭐ ADDED AT CODE REVIEW 2026-08-03 (five surviving reviewer mutations + the four decisions):
--          DECISION D's rounds_won 2 (the real sum · contributing rows only) · DECISION C's achievement_ts 2
--          (min not max · contrib not all_approved) · h2h roster filter 2 (removed opponent absent · active
--          opponent still present) · the freeze CONDITION 2 (a real NON-final approve says not_final · and
--          leaves fair_seed NULL) · the crowning freeze + DECISION F 4 (seed_hex is the GF's demo ·
--          tournament.fair_seed holds it · rollback UN-FREEZES · re-approve reproduces it byte-identically) ·
--          demo_unhashed 3 (the approve still succeeds · says demo_unhashed · leaves fair_seed NULL) ·
--          lock_ceremony's seed refusals 3 (seed_stale · it wrote nothing · seed_unavailable's `why`) ·
--          the manual-resolution freeze 2 (it froze · the value is that demo's hash) · mark_walkover 2
--          (ceremony_locked · wrote nothing).
-- 16+9+15+10+11+4+10+19+22 = 116.
select plan(116);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture.
--   TCER   — the 8-player bracket driven to a REAL crowning, then locked. The flagship.
--   TNBL   — registration_open: the not_bracket_live refusal.
--   TUND   — bracket_live, no champion: the champion_undecided refusal.
--   TSEED  — bracket_live, crowned, fair_seed NULL: the seed_unavailable refusal (AD-13's fail-closed point).
--   TNOR   — bracket_live, crowned, seeded, ZERO active roster: the no_roster refusal.
--   TLOCK  — no bracket; a RAW `locked` ceremony row + one raw match: the four ceremony_locked guards.
--   TCLOSED— state='closed' with NO ceremony row: proves curate's tournament-state disjunct is still live.
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, v.s
  from (values
    ('TCER',    'registration_open'),
    ('TNBL',    'registration_open'),
    ('TUND',    'bracket_live'),
    ('TSEED',   'bracket_live'),
    ('TNOR',    'registration_open'),   -- flipped to bracket_live below, AFTER its roster rows are seeded
    ('TLOCK',   'registration_open'),
    ('TCLOSED', 'closed')
  ) as v(n, s);

-- ── Helpers (mirroring 0013/0014/0015/0016/0017 — reuse, never hand-derive) ──
create function pg_temp.tid(tname text) returns bigint language sql stable as $fn$
  select id from public.tournament where name = tname
$fn$;

create function pg_temp.re(tname text, n int) returns bigint language sql stable as $fn$
  select r.id from public.roster_entry r
    join public.tournament t on t.id = r.tournament_id
   where t.name = tname and r.status = 'active'
   order by r.steamid64 offset (n - 1) limit 1
$fn$;

create function pg_temp.seeds(tname text, n int) returns jsonb language sql stable as $fn$
  select jsonb_agg(jsonb_build_object('roster_entry_id', pg_temp.re(tname, s), 'seed', s))
    from generate_series(1, n) as s
$fn$;

create function pg_temp.edge(b text, sl int, gf int, side text) returns jsonb language sql immutable as $fn$
  select jsonb_build_object('bracket', b, 'slot', sl, 'gf_order', gf, 'side', side)
$fn$;

create function pg_temp.mid(tname text, br text, slot int, gf int default 0) returns bigint language sql stable as $fn$
  select m.id from public.match m
    join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = br and m.bracket_slot = slot
     and coalesce(m.gf_order, 0) = coalesce(gf, 0)
$fn$;

create function pg_temp.demo_id(tag text) returns bigint language sql stable as $fn$
  select id from public.demo where demo_sha256 = repeat(tag, 64)
$fn$;

-- The snapshot row for one player, from the ONE captured snapshot.
create function pg_temp.snap(sid text) returns public.stat_snapshot_row language sql stable as $fn$
  select r.* from public.stat_snapshot_row r
    join public.stat_snapshot s on s.id = r.snapshot_id
   where s.tournament_id = pg_temp.tid('TCER') and r.steamid64 = sid
$fn$;

-- The 8-player double-elim skeleton, slot-for-slot as lib/bracket/generate.ts emits it after Story 4.4 —
-- copied VERBATIM from 0017_aprobar_publish_test.sql:137-159 (a golden snapshot, never hand-derived).
create function pg_temp.matches8(t text) returns jsonb language sql stable as $fn$
  select jsonb_agg(jsonb_build_object(
           'bracket', v.b, 'bracket_position', v.p, 'bracket_slot', v.sl, 'gf_order', v.gf,
           'competitor_a', v.ca, 'competitor_b', v.cb, 'winner_entry', null::bigint, 'state', 'declared',
           'winner_to', v.wt, 'loser_to', v.lt))
    from (values
      ('winners', 'Winners R1', 0, null::int, pg_temp.re(t, 1), pg_temp.re(t, 8), pg_temp.edge('winners', 4, null, 'a'), pg_temp.edge('losers', 0, null, 'a')),
      ('winners', 'Winners R1', 1, null::int, pg_temp.re(t, 4), pg_temp.re(t, 5), pg_temp.edge('winners', 4, null, 'b'), pg_temp.edge('losers', 0, null, 'b')),
      ('winners', 'Winners R1', 2, null::int, pg_temp.re(t, 2), pg_temp.re(t, 7), pg_temp.edge('winners', 5, null, 'a'), pg_temp.edge('losers', 1, null, 'a')),
      ('winners', 'Winners R1', 3, null::int, pg_temp.re(t, 3), pg_temp.re(t, 6), pg_temp.edge('winners', 5, null, 'b'), pg_temp.edge('losers', 1, null, 'b')),
      ('winners', 'Winners R2', 4, null::int, null::bigint, null::bigint, pg_temp.edge('winners', 6, null, 'a'), pg_temp.edge('losers', 3, null, 'b')),
      ('winners', 'Winners R2', 5, null::int, null::bigint, null::bigint, pg_temp.edge('winners', 6, null, 'b'), pg_temp.edge('losers', 2, null, 'b')),
      ('winners', 'Winners R3', 6, null::int, null::bigint, null::bigint, pg_temp.edge('grand_final', 0, 1, 'a'), pg_temp.edge('losers', 5, null, 'b')),
      ('losers', 'Losers R1', 0, null::int, null::bigint, null::bigint, pg_temp.edge('losers', 2, null, 'a'), null::jsonb),
      ('losers', 'Losers R1', 1, null::int, null::bigint, null::bigint, pg_temp.edge('losers', 3, null, 'a'), null::jsonb),
      ('losers', 'Losers R2', 2, null::int, null::bigint, null::bigint, pg_temp.edge('losers', 4, null, 'a'), null::jsonb),
      ('losers', 'Losers R2', 3, null::int, null::bigint, null::bigint, pg_temp.edge('losers', 4, null, 'b'), null::jsonb),
      ('losers', 'Losers R3', 4, null::int, null::bigint, null::bigint, pg_temp.edge('losers', 5, null, 'a'), null::jsonb),
      ('losers', 'Losers R4', 5, null::int, null::bigint, null::bigint, pg_temp.edge('grand_final', 0, 1, 'b'), null::jsonb),
      ('grand_final', 'Grand Final', 0, 1, null::bigint, null::bigint, pg_temp.edge('grand_final', 0, 2, 'b'), pg_temp.edge('grand_final', 0, 2, 'a')),
      ('grand_final', 'Grand Final (reset)', 0, 2, null::bigint, null::bigint, null::jsonb, null::jsonb)
    ) as v(b, p, sl, gf, ca, cb, wt, lt)
$fn$;

-- Rosters. ⚠ TNOR is deliberately left with NO ACTIVE entries (its two rows are soft-removed) — that is the
-- no_roster probe, and it also proves the guard counts `status='active'` rather than raw rows.
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TCER', 'TNBL');
insert into roster_entry (tournament_id, steamid64, status)
select pg_temp.tid('TNOR'), '765611979602878' || lpad(i::text, 2, '0'), 'removed'
  from generate_series(1, 2) as i;

-- ⭐ code review 2026-08-03 — a SOFT-REMOVED TCER entry that still has approved rows (its stat_rows go in
-- with the other extra rows below). Two jobs: it is the h2h roster-filter probe (Section I), and it gives
-- …804 a SECOND contributing row so min-vs-max on achievement_ts becomes discriminating. Seeded HERE, while
-- TCER is still registration_open, because roster_entry_lock_guard freezes the roster once it goes live.
insert into player (steamid64, display_name) values ('76561197960287809', 'Removed Player');
insert into roster_entry (tournament_id, steamid64, status)
values (pg_temp.tid('TCER'), '76561197960287809', 'removed');

-- ⚠ The roster freezes once a tournament is live (roster_entry_lock_guard), so TNOR's soft-removed rows are
-- seeded while it is still registration_open and the state is flipped afterwards.
update tournament set state = 'bracket_live' where name = 'TNOR';
update tournament set state = 'registration_closed' where name = 'TCER';

create temp table rpc_log (tag text primary key, r jsonb);
grant select, insert on rpc_log to service_role;

-- ⭐⭐ THE PROBE WRAPPERS (the 6.1 pattern, 0023_award_catalog_test.sql:98-105), DEFINED UP HERE because the
-- FIXTURE ITSELF goes through them. AC2 requires typed refusals to be RETURNED, never raised. Calling an RPC
-- directly meant that if a guard were REMOVED, a CHECK or trigger would RAISE instead, psql would abort the
-- whole transaction, and NO NAMED TEST would print `not ok` — the suite failed, but it could not say WHICH
-- rule was gone. (The mutation pass found exactly that: an over-tight `fair_seed` trigger aborted the file at
-- the fixture's own approve and produced ZERO named failures.) These turn a raise into the value
-- `RAISED`/`<sqlstate>`, so a broken rule reddens the named tests that own it. The EXCEPTION block also runs
-- the call in a SUBTRANSACTION, so a raising mutant still writes nothing — which keeps the "no refusal wrote
-- anything" assertions honest rather than accidentally true.
create function pg_temp.lock_c(p_tid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.lock_ceremony(p_tid, '76561197960287930');
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

create function pg_temp.approve(p_mid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.approve_match(p_mid, '76561197960287930');
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

create function pg_temp.rollback_m(p_mid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.rollback_match(p_mid, '76561197960287930');
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

create function pg_temp.manual(p_mid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.manual_resolve_match(p_mid, 16, 14, '76561197960287930', true);
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

create function pg_temp.curate(p_tid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.curate_award_catalog(p_tid, '76561197960287930', jsonb_build_array(
    jsonb_build_object('name','Probe','bucket','skill','class','volume','deciding_stat','kills','priority',1)
  ));
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

insert into rpc_log
select 'genTCER',
       public.generate_bracket(pg_temp.tid('TCER'), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds('TCER', 8), pg_temp.matches8('TCER'));

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'genTCER') <> 15 then
    raise exception 'fixture: TCER did not commit 15 rows';
  end if;
end $$;

-- Lock every format in one audited call (0016's fixture note: match_format_audited refuses a raw latch).
insert into rpc_log
select 'declareTCER', public.declare_match_format(pg_temp.tid('TCER'), null, 'mr12', 'ot_mr3', '76561197960287930', false);

-- ⚠ realtime.messages is RANGE-partitioned on inserted_at; its partitions are made by a Realtime BACKGROUND
-- JOB, and realtime.send swallows its own errors. Make the suite's own precondition true (0013/0017 pattern).
do $$
declare v_d date := current_date;
begin
  if not exists (
    select 1 from pg_class c
      join pg_inherits i on i.inhrelid = c.oid
     where i.inhparent = 'realtime.messages'::regclass
       and c.relname = 'messages_' || to_char(v_d, 'YYYY_MM_DD')
  ) then
    execute format(
      'create table realtime.messages_%s partition of realtime.messages for values from (%L) to (%L)',
      to_char(v_d, 'YYYY_MM_DD'), v_d::timestamp, (v_d + 1)::timestamp
    );
  end if;
end $$;

-- ⭐ WALK THE BRACKET TO THE GRAND FINAL, side A always winning. Every step is a raw resolve + the REAL
-- advance_match (the 0013/0014 fixture pattern) — the point of this suite is the FREEZE and the CAPTURE, not
-- re-proving the advance. The GRAND FINAL is the only match approved for real, below.
-- The order is the dependency order: a node is resolved only once both its seats are filled.
--   W0..W3 -> L0,L1 -> W4,W5 -> L2,L3 -> W6 -> L4 -> L5 -> (GF1, approved for real)
-- With side A always winning, GF1's seats are …801 (winners champion) and …808 (losers survivor).
do $$
declare
  v_step record;
  v_id   bigint;
  v_r    jsonb;
begin
  for v_step in
    select * from (values
      ('winners', 0), ('winners', 1), ('winners', 2), ('winners', 3),
      ('losers', 0), ('losers', 1),
      ('winners', 4), ('winners', 5),
      ('losers', 2), ('losers', 3),
      ('winners', 6),
      ('losers', 4),
      ('losers', 5)
    ) as s(br, slot)
  loop
    v_id := pg_temp.mid('TCER', v_step.br, v_step.slot);
    update public.match set state = 'resolved', winner_entry = competitor_a where id = v_id;
    v_r := public.advance_match(v_id, '76561197960287930', false);
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'fixture: advance of % % refused: %', v_step.br, v_step.slot, v_r;
    end if;
  end loop;
end $$;

-- ── The championship demo + its parsed rows. …801 wins 16-14 (side a -> the AD-21 outright crown).
--    …801 clears BOTH FR-21 floors (30 rounds / 25 kills); …808 clears rounds but not kills — so
--    `eligible_count` lands on 1, a NON-ZERO that proves the field is computed and not hard-coded.
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state) values
  (8001, 'demos/8001.dem', 'matchzy', repeat('c', 64), 'pending'),
  (8002, 'demos/8002.dem', 'matchzy', repeat('d', 64), 'pending'),
  (8003, 'demos/8003.dem', 'matchzy', repeat('e', 64), 'pending'),
  (8004, 'demos/8004.dem', 'matchzy', repeat('a', 64), 'pending'),
  (8005, 'demos/8005.dem', 'matchzy', repeat('b', 64), 'pending');

insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won,
                      hs_kills, adr_damage, kast_rounds, entry_frags, opening_deaths, knife_kills)
values
  (8001, '76561197960287801', pg_temp.demo_id('c'), 25, 14, 30, 16, 10, 2400, 22, 6, 4, 1),
  (8001, '76561197960287808', pg_temp.demo_id('c'), 15, 25, 30, 14,  3, 1500, 12, 4, 6, 0);

set local role service_role;
insert into rpc_log select 'bindGF',
  public.bind_match_demo(pg_temp.mid('TCER', 'grand_final', 0, 1), pg_temp.demo_id('c'), '76561197960287930');
-- ⭐⭐ THE REAL CROWNING. advance_match writes tournament.final_match_id here, and the freeze — placed AFTER
-- the advance — is what reads it. This one call is Section C's whole subject.
-- ⚠ Through the PROBE, not directly: a mutant that makes the freeze RAISE (an over-tight write-once trigger
-- is the obvious one) must redden Section C's NAMED tests, not abort the whole file with zero diagnosis.
insert into rpc_log select 'approveGF', pg_temp.approve(pg_temp.mid('TCER', 'grand_final', 0, 1));
set local role postgres;

-- ── Extra APPROVED rows, inserted AFTER the championship approve (a pre-existing row for a non-seat player
--    would have tripped approve_match's `wrong_demo` guard). They give the snapshot the shapes AD-19 must
--    survive: an h2h pair, a FULLY-DQ'd player, a player whose only opponent was idle, and two winless
--    players with no rows at all (…806, …807).
insert into stat_row (matchzy_match_id, match_id, steamid64, demo_id, status, approved_at, approved_by,
                      kills, deaths, rounds_played, rounds_won, hs_kills, adr_damage, kast_rounds,
                      entry_frags, opening_deaths, idle_dq)
values
  -- 8002 on Winners R1 slot 1: …803 vs …804, both live -> a real h2h pair.
  (8002, pg_temp.mid('TCER','winners',1), '76561197960287803', pg_temp.demo_id('d'), 'approved',
   timestamptz '2026-08-01 10:00:00+00', '76561197960287930', 12, 9, 21, 11, 5, 1400, 15, 3, 2, false),
  (8002, pg_temp.mid('TCER','winners',1), '76561197960287804', pg_temp.demo_id('d'), 'approved',
   timestamptz '2026-08-01 10:00:00+00', '76561197960287930',  9, 12, 21, 10, 2, 1100, 11, 2, 3, false),
  -- 8003 on Winners R1 slot 2: …802 is idle on its ONLY row (fully DQ'd); …805 is live but its only
  -- opponent is idle, so …805's h2h must be EMPTY without …805 itself being excluded.
  (8003, pg_temp.mid('TCER','winners',2), '76561197960287802', pg_temp.demo_id('e'), 'approved',
   timestamptz '2026-08-01 11:00:00+00', '76561197960287930',  1, 18, 19,  2, 0, 200, 3, 0, 5, true),
  (8003, pg_temp.mid('TCER','winners',2), '76561197960287805', pg_temp.demo_id('e'), 'approved',
   timestamptz '2026-08-01 11:00:00+00', '76561197960287930', 18,  1, 19, 17, 7, 2000, 16, 5, 1, false),
  -- ⭐⭐ THE MIXED PLAYER (added after the mutation pass, which found this case UNCOVERED: an ANY-idle
  --    implementation of the snapshot-level `idle_dq` passed every assertion). …807 has TWO approved rows —
  --    one idle, one live. The snapshot rule is ALL-idle, so …807 must come out `idle_dq = false` AND
  --    contribute only the LIVE match's numbers (the idle match is excluded from the aggregate, 0021:88).
  (8004, pg_temp.mid('TCER','winners',3), '76561197960287807', pg_temp.demo_id('a'), 'approved',
   timestamptz '2026-08-01 12:00:00+00', '76561197960287930',  0, 16, 17,  1, 0,  100,  1, 0, 4, true),
  (8005, pg_temp.mid('TCER','winners',0), '76561197960287807', pg_temp.demo_id('b'), 'approved',
   timestamptz '2026-08-01 13:00:00+00', '76561197960287930',  4,  8, 12,  5, 1,  600,  7, 1, 2, false);

-- ⭐ code review 2026-08-03 — the SOFT-REMOVED …809 sharing an approved match with the ACTIVE …804.
-- …809 must appear in NOBODY's h2h (they have no snapshot row), and …804 now has TWO contributing rows
-- (10:00 and 15:00) so `achievement_ts` can tell min from max. Section I asserts both.
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state)
values (8006, 'demos/8006.dem', 'matchzy', repeat('1', 64), 'pending');
insert into stat_row (matchzy_match_id, match_id, steamid64, demo_id, status, approved_at, approved_by,
                      kills, deaths, rounds_played, rounds_won, hs_kills, adr_damage, kast_rounds,
                      entry_frags, opening_deaths, idle_dq)
values
  (8006, pg_temp.mid('TCER','winners',4), '76561197960287804', pg_temp.demo_id('1'), 'approved',
   timestamptz '2026-08-01 15:00:00+00', '76561197960287930',  7, 11, 18,  8, 2,  900, 10, 2, 3, false),
  (8006, pg_temp.mid('TCER','winners',4), '76561197960287809', pg_temp.demo_id('1'), 'approved',
   timestamptz '2026-08-01 15:00:00+00', '76561197960287930', 11,  7, 18, 10, 4, 1300, 13, 3, 2, false);

-- TSEED / TNOR need a crowned tournament shape without a bracket of their own. `tournament.final_match_id`
-- carries no FK (0001:32 deferred it and Epic 4 never added one), but pointing it at a REAL match keeps the
-- fixture honest. TNOR is seeded at INSERT so the write-once trigger (BEFORE UPDATE) is not involved.
update tournament set final_match_id = pg_temp.mid('TCER', 'grand_final', 0, 1) where name in ('TSEED', 'TNOR');
-- ⚠ Swallowed, for the same reason the approve above is probed: this is a FIRST freeze (NULL -> value), which
-- the write-once trigger must permit. A mutant that refuses it should redden Section B's named tests and the
-- no_roster probe — never abort the file before a single assertion has run.
-- ⚠ The value must be demo 'c''s hash, NOT an arbitrary one: TNOR's final_match_id points at TCER's grand
-- final, and lock_ceremony's `seed_stale` guard (added at code review) fires BEFORE `no_roster`. An
-- arbitrary seed here would make TNOR refuse seed_stale and silently stop probing no_roster at all.
do $$ begin
  update public.tournament set fair_seed = repeat('c', 64) where name = 'TNOR';
exception when others then null;
end $$;

-- TLOCK: one raw match + a RAW `locked` ceremony row. The four guards read `ceremony.state` and nothing else,
-- so this isolates them completely from the capture. The match is `resolved` so the rollback probe reaches
-- its guard, and the guard fires BEFORE `not_pending` / `not_resolved` / `not_manual_resolvable` — which is
-- exactly what "before any write" means here.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   winner_to_bracket, winner_to_slot, winner_to_side, loser_to_bracket, loser_to_slot,
                   loser_to_side, format, tie_policy, format_locked)
values (pg_temp.tid('TLOCK'), 'winners', 'Lock Probe', 0, 'resolved',
        'winners', 999, 'a', 'losers', 999, 'a', 'mr12', 'ot_mr3', true);
insert into ceremony (tournament_id, state, seed_demo_sha256, started_at)
values (pg_temp.tid('TLOCK'), 'locked', repeat('9', 64), now());

-- ============================================================================
-- Section A — `ceremony`: the specced shape, the named CHECKs, RLS and the ABSENT viewer grant (AC1/AC2).
-- ============================================================================
select has_table('public', 'ceremony', 'ceremony: the AD-15 ceremony-state table exists');
select col_is_pk('public', 'ceremony', 'id', 'ceremony: identity PK on id');

-- SOLUTION-DESIGN.md:175-185 verbatim — a renamed, dropped or SPECULATIVELY ADDED column reddens here. The
-- three shells (algorithm_version / spin_plan / luck_weight_table) are part of the specced shape and are
-- created by 6.2 but written by 6.9 / 6.4+6.8 / 6.6.
select columns_are('public', 'ceremony', array[
  'id', 'tournament_id', 'state', 'seed_demo_sha256', 'snapshot_id',
  'algorithm_version', 'spin_plan', 'luck_weight_table', 'started_at', 'completed_at'
], 'ceremony: exactly the SOLUTION-DESIGN.md:175-185 columns — no more, no fewer');

select col_default_is('public', 'ceremony', 'state', 'not_started',
  'ceremony: state defaults to not_started (a row that exists has not started a ceremony)');

select fk_ok('public', 'ceremony', 'tournament_id', 'public', 'tournament', 'id',
  'ceremony.tournament_id references tournament(id) (AD-18 scope)');
-- ⭐ THE STATEMENT 0003:11-12 DEFERRED TO EPIC 6 BY NAME. Its absence is what 0003 could not add.
select fk_ok('public', 'ceremony', 'snapshot_id', 'public', 'stat_snapshot', 'id',
  'ceremony_snapshot_fk: ceremony.snapshot_id references stat_snapshot(id) — the FK 0003:11-12 deferred BY NAME to Epic 6');

select throws_ok($$
  insert into public.ceremony (tournament_id, state)
  values ((select id from public.tournament where name = 'TNBL'), 'halfway')$$,
  '23514', 'new row for relation "ceremony" violates check constraint "ceremony_state_valid"',
  'ceremony_state_valid: a state outside the four-value set is REFUSED (asserted BY NAME — every CHECK raises 23514)');

select lives_ok($$
  insert into public.ceremony (tournament_id, state)
  values ((select id from public.tournament where name = 'TNBL'), 'complete')$$,
  'ceremony_state_valid: every one of the four specced states is ACCEPTED (the CHECK is not over-tight)');

select throws_ok($$
  insert into public.ceremony (tournament_id, state)
  values ((select id from public.tournament where name = 'TNBL'), 'not_started')$$,
  '23505', 'duplicate key value violates unique constraint "ceremony_tournament_key"',
  'ceremony_tournament_key: a SECOND ceremony for one tournament is REFUSED (one ceremony per tournament, AD-18 v1 scope)');
delete from ceremony where tournament_id = (select id from tournament where name = 'TNBL');

select is((select relrowsecurity from pg_class where oid = 'public.ceremony'::regclass), true,
  'ceremony: row level security is ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.ceremony'::regclass), true,
  'ceremony: row level security is FORCED (the 0003 catalog guard asserts no public base table lacks it)');
select policies_are('public', 'ceremony', array['ceremony_admin_read'],
  'ceremony: exactly ONE policy — the admin read. No viewer policy (6.8 opens the reveal axis; 6.2 ships the closed end state)');

-- ⭐ THE AD-22 MECHANISM, asserted as an ABSENCE: a viewer 42501s at the table-grant gate before RLS runs.
select is(has_table_privilege('anon', 'public.ceremony', 'SELECT'), false,
  'AD-22: anon has NO SELECT on ceremony — the seed and the snapshot pointer never reach a viewer');
select is(
  (select bool_or(has_table_privilege(r, 'public.ceremony', p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  false, 'AD-22: NEITHER client role holds ANY privilege on ceremony (all four verbs, both roles)');
select is(
  (select bool_and(has_table_privilege('service_role', 'public.ceremony', p))
     from unnest(array['SELECT', 'INSERT', 'UPDATE']) p),
  true, 'ceremony: service_role holds SELECT+INSERT+UPDATE (6.4/6.8 advance `state` and write `spin_plan`)');
select is(has_table_privilege('service_role', 'public.ceremony', 'DELETE'), false,
  'ceremony: service_role has NO DELETE — a ceremony advances through its states, it is never deleted');

-- ============================================================================
-- Section B — fair_seed: the hex CHECK and the IC908 write-once trigger (AC1).
-- ============================================================================
-- ⚠ LOWERCASE ONLY. demo.demo_sha256 is written lowercase by Go's hex.EncodeToString; a case-insensitive
-- column would make two spellings of one seed possible, and the seed is a published commitment.
select throws_ok($$
  update public.tournament set fair_seed = upper(repeat('ab', 32)) where name = 'TNBL'$$,
  '23514', 'new row for relation "tournament" violates check constraint "tournament_fair_seed_hex"',
  'tournament_fair_seed_hex: an UPPERCASE digest is REFUSED (asserted BY NAME)');
select throws_ok($$
  update public.tournament set fair_seed = repeat('a', 63) where name = 'TNBL'$$,
  '23514', 'new row for relation "tournament" violates check constraint "tournament_fair_seed_hex"',
  'tournament_fair_seed_hex: a 63-char digest is REFUSED (SHA-256 is exactly 64 hex chars)');
select throws_ok($$
  update public.tournament set fair_seed = repeat('z', 64) where name = 'TNBL'$$,
  '23514', 'new row for relation "tournament" violates check constraint "tournament_fair_seed_hex"',
  'tournament_fair_seed_hex: a non-hex character is REFUSED');

select has_trigger('public', 'tournament', 'tournament_fair_seed_write_once',
  'tournament_fair_seed_write_once: the BEFORE UPDATE trigger exists (a POLICY cannot hold this line — service_role has BYPASSRLS)');

-- NULL -> value: the freeze itself. The trigger's WHEN clause (old.fair_seed is not null) never fires.
select lives_ok($$
  update public.tournament set fair_seed = repeat('ab', 32) where name = 'TNBL'$$,
  'fair_seed: NULL -> a valid digest SUCCEEDS — this is the freeze, and the trigger must not block it');

-- ⚠ value -> the SAME value must be a NO-OP, not an IC908. A 4.7 rollback of the championship match clears
-- final_match_id but deliberately leaves fair_seed set, so a rollback-then-re-approve re-runs the freeze
-- path against an already-frozen seed. Refusing that would make an ordinary dispute correction impossible.
select lives_ok($$
  update public.tournament set fair_seed = repeat('ab', 32) where name = 'TNBL'$$,
  'fair_seed: re-writing the IDENTICAL digest is a NO-OP, not IC908 (the rollback-then-re-approve path)');

-- ⚠ The 4-arg form with a NULL expected message: the raise interpolates the tournament's identity id, which
-- is not stable across runs. The SQLSTATE is the contract here, and it is a CUSTOM code (IC908) rather than a
-- shared 23514 — so unlike the CHECKs above, the code alone identifies exactly this guard.
select throws_ok($$
  update public.tournament set fair_seed = repeat('cd', 32) where name = 'TNBL'$$,
  'IC908'::text, null::text,
  'fair_seed: CHANGING a frozen digest raises IC908 — AD-13''s "never re-rolled", MECHANISM-enforced');

select is((select fair_seed from tournament where name = 'TNBL'), repeat('ab', 32),
  'fair_seed: the refused re-roll left the ORIGINAL digest intact (the raise is not merely cosmetic)');

-- An unrelated UPDATE of the same row must not trip the trigger — lock_ceremony writes tournament.state on a
-- row whose fair_seed is already frozen, so a WHEN clause that keyed on "the row changed" would deadlock the
-- whole feature.
select lives_ok($$
  update public.tournament set format_default = 'mr12' where name = 'TNBL'$$,
  'fair_seed: an UPDATE that does not touch fair_seed does not trip the trigger (lock_ceremony writes tournament.state on a frozen row)');

-- ============================================================================
-- Section C — ⭐ THE FLAGSHIP: the real crowning freezes the seed; lock_ceremony captures (AC1/AC2/AC3/AC5).
-- ============================================================================
select is((select r->>'fair_seed_frozen' from rpc_log where tag = 'approveGF'), 'true',
  'AC1 ⭐ approving the CHAMPIONSHIP match reports fair_seed_frozen — the freeze fired inside the approve transaction');
select is((select r->>'seed_hex' from rpc_log where tag = 'approveGF'), repeat('c', 64),
  'AC1 ⭐ seed_hex IS the championship demo''s demo_sha256, byte-identical — nothing is re-hashed (the Go worker computed it once at ingest)');
select is((select fair_seed from tournament where name = 'TCER'), repeat('c', 64),
  'AC1 ⭐ tournament.fair_seed holds that same digest');
select is((select final_match_id from tournament where name = 'TCER'), pg_temp.mid('TCER', 'grand_final', 0, 1),
  'AC1 ⭐ final_match_id = the grand final — the crowning REALLY happened, so the freeze read a value advance_match had just written (not a fixture)');

set local role service_role;
insert into rpc_log select 'lock', pg_temp.lock_c(pg_temp.tid('TCER'));
set local role postgres;

select is((select r->>'ok' from rpc_log where tag = 'lock'), 'true',
  'AC2 ⭐ lock_ceremony SUCCEEDS on a crowned, seeded, rostered bracket_live tournament');
select is((select count(*)::int from stat_snapshot where tournament_id = pg_temp.tid('TCER')), 1,
  'AC2 ⭐ exactly ONE stat_snapshot header was written');
select is(
  (select content_sha256 from stat_snapshot where tournament_id = pg_temp.tid('TCER')),
  (select r->>'content_sha256' from rpc_log where tag = 'lock'),
  'AC3 the stored content_sha256 is the one the RPC returned (the header carries its hash, never an UPDATE after the fact)');
select ok(
  (select r->>'content_sha256' from rpc_log where tag = 'lock') ~ '^[0-9a-f]{64}$',
  'AC3 content_sha256 is lowercase 64-hex');
-- ⭐ ONE ROW PER ACTIVE ROSTER PLAYER — not one per player with approved stats. 6.7's pity draw enumerates
-- the winless; if the snapshot omitted them, pity could structurally never reach them, and the table is
-- write-once so there is no second chance.
select is(
  (select count(*)::int from stat_snapshot_row r join stat_snapshot s on s.id = r.snapshot_id
    where s.tournament_id = pg_temp.tid('TCER')), 8,
  'AC3 ⭐ exactly 8 snapshot rows — ONE PER ACTIVE ROSTER PLAYER, including the two with no approved stats at all');
select is((select (r->>'row_count')::int from rpc_log where tag = 'lock'), 8,
  'AC2 the returned row_count matches what was written');
select is((select (r->>'eligible_count')::int from rpc_log where tag = 'lock'), 1,
  'AC4 eligible_count = 1 — computed from public.leaderboard''s FR-21 floors (0021:126-128), not hard-coded');
select is((select state from ceremony where tournament_id = pg_temp.tid('TCER')), 'locked',
  'AC2 ⭐ ceremony.state is now `locked`');
select is((select seed_demo_sha256 from ceremony where tournament_id = pg_temp.tid('TCER')), repeat('c', 64),
  'AC2 ceremony.seed_demo_sha256 carries the frozen seed (AD-13)');
select is(
  (select c.snapshot_id from ceremony c where c.tournament_id = pg_temp.tid('TCER')),
  (select s.id from stat_snapshot s where s.tournament_id = pg_temp.tid('TCER')),
  'AC2 ceremony.snapshot_id points at the header written in the SAME transaction (AD-6)');
select is((select state from tournament where name = 'TCER'), 'ceremony',
  'AC2 tournament.state is now `ceremony` — the state lib/feed/read.ts''s ceremonyUnlocked() and lib/realtime/status.ts key on');

-- ============================================================================
-- Section D — every reachable typed refusal, each proving NOTHING WAS WRITTEN (AC2).
-- ============================================================================
set local role service_role;
insert into rpc_log select 'r_noT',   pg_temp.lock_c(999999999);
insert into rpc_log select 'r_nbl',   pg_temp.lock_c(pg_temp.tid('TNBL'));
insert into rpc_log select 'r_und',   pg_temp.lock_c(pg_temp.tid('TUND'));
insert into rpc_log select 'r_seed',  pg_temp.lock_c(pg_temp.tid('TSEED'));
insert into rpc_log select 'r_nor',   pg_temp.lock_c(pg_temp.tid('TNOR'));
insert into rpc_log select 'r_again', pg_temp.lock_c(pg_temp.tid('TCER'));
set local role postgres;

select is((select r->>'reason' from rpc_log where tag = 'r_noT'), 'no_tournament',
  'refusal: an unknown tournament -> no_tournament');
select is((select r->>'reason' from rpc_log where tag = 'r_nbl'), 'not_bracket_live',
  'refusal: a registration-phase tournament -> not_bracket_live');
select is((select r->>'reason' from rpc_log where tag = 'r_und'), 'champion_undecided',
  'refusal: no final_match_id -> champion_undecided (nobody has been crowned, so there is no deciding demo)');
select is((select r->>'reason' from rpc_log where tag = 'r_seed'), 'seed_unavailable',
  '⛔ refusal: crowned but fair_seed NULL -> seed_unavailable — THE fail-closed point for an unhashed or demo-less final (approve deliberately commits without it)');
select is((select r->>'reason' from rpc_log where tag = 'r_nor'), 'no_roster',
  'refusal: zero ACTIVE roster entries -> no_roster (soft-removed rows do not count)');
select is((select r->>'reason' from rpc_log where tag = 'r_again'), 'already_locked',
  'refusal: re-locking a locked ceremony -> already_locked (AC2 idempotency: it never captures a second snapshot over the first)');

-- ⭐ NOTHING WAS WRITTEN. TCER's single header is still single, and no refused tournament grew a snapshot,
-- a snapshot row or a ceremony.
select is((select count(*)::int from stat_snapshot), 1,
  'refusals: exactly ONE stat_snapshot exists in the whole database — every refusal (including the re-lock) wrote no header');
select is(
  (select count(*)::int from stat_snapshot_row r join stat_snapshot s on s.id = r.snapshot_id
    where s.tournament_id <> pg_temp.tid('TCER')), 0,
  'refusals: no snapshot ROWS were written for any refused tournament');
select is(
  (select count(*)::int from ceremony c join tournament t on t.id = c.tournament_id
    where t.name in ('TNBL', 'TUND', 'TSEED', 'TNOR')), 0,
  'refusals: no ceremony row was created for any refused tournament (a refusal is not a partial start)');
-- ⚠ `empty_snapshot` is a DEFENSIVE BACKSTOP with no reachable probe today: the row set is exactly one row
-- per ACTIVE roster entry, so a zero-row build implies a zero-active roster, and `no_roster` is checked
-- FIRST. Asserting the ORDERING is the honest test — it is what makes empty_snapshot unreachable, and it
-- reddens the day someone re-orders the guards or lets the row set diverge from the roster count.
-- ⛔⭐ code review 2026-08-03 — WHAT USED TO BE HERE WAS A VERBATIM DUPLICATE of the `no_roster` assertion
-- above: same expression, different description, claiming to test "guard ordering". A duplicate reddens
-- exactly when its twin reddens and never independently, so it padded plan(94) by one and proved nothing.
-- THIS is the property that actually makes `empty_snapshot` unreachable, and it CAN redden on its own:
-- TNOR has roster rows — they are merely all soft-removed — so if the `no_roster` count ever stopped
-- filtering on `status = 'active'`, TNOR would sail past that guard and the row set (which IS filtered)
-- would come back empty, making `empty_snapshot` reachable after all. Asserting that raw rows EXIST is what
-- pins the divergence between "rows" and "active rows" that the unreachability argument rests on.
select is(
  (select count(*)::int from roster_entry where tournament_id = pg_temp.tid('TNOR')), 2,
  'empty_snapshot is unreachable BECAUSE no_roster counts ACTIVE rows only — TNOR has 2 raw roster rows (both soft-removed), so a guard that counted raw rows would fall through to an empty row set instead');

-- ============================================================================
-- Section E — the AD-17 audit row: exactly one, and EVERY detail key asserted (AC2).
-- ============================================================================
-- ⚠ EVERY key, not one of them: the 4.2 review found a suite asserting a single key while a typo in any
-- other would have NULLed the whole payload with the tests still green.
select is(
  (select count(*)::int from audit_log where tournament_id = pg_temp.tid('TCER') and action = 'start_ceremony'), 1,
  'AD-17: exactly ONE start_ceremony audit row (one per accepted call — the refusals above added none)');
select is(
  (select actor_steamid64 from audit_log where tournament_id = pg_temp.tid('TCER') and action = 'start_ceremony'),
  '76561197960287930',
  'AD-17: the actor is the acting admin (the route threads gate.steamid64, never the body)');

create function pg_temp.audit_detail() returns jsonb language sql stable as $fn$
  select detail from public.audit_log
   where tournament_id = pg_temp.tid('TCER') and action = 'start_ceremony'
$fn$;

select is(pg_temp.audit_detail() -> 'before' ->> 'ceremony_state', 'not_started',
  'audit detail: before.ceremony_state = not_started');
select is(pg_temp.audit_detail() -> 'before' ->> 'tournament_state', 'bracket_live',
  'audit detail: before.tournament_state = bracket_live (read UNDER the lock, before the write)');
select is(pg_temp.audit_detail() -> 'after' ->> 'ceremony_state', 'locked',
  'audit detail: after.ceremony_state = locked');
select is(pg_temp.audit_detail() -> 'after' ->> 'tournament_state', 'ceremony',
  'audit detail: after.tournament_state = ceremony');
select is(
  (pg_temp.audit_detail() -> 'after' ->> 'snapshot_id')::bigint,
  (select id from stat_snapshot where tournament_id = pg_temp.tid('TCER')),
  'audit detail: after.snapshot_id names the header actually written');
select is(
  pg_temp.audit_detail() -> 'after' ->> 'content_sha256',
  (select content_sha256 from stat_snapshot where tournament_id = pg_temp.tid('TCER')),
  'audit detail: after.content_sha256 matches the header');
select is(pg_temp.audit_detail() -> 'after' ->> 'seed_hex', repeat('c', 64),
  'audit detail: after.seed_hex is the frozen seed');
select is((pg_temp.audit_detail() -> 'after' ->> 'row_count')::int, 8,
  'audit detail: after.row_count = 8');
select is((pg_temp.audit_detail() -> 'after' ->> 'eligible_count')::int, 1,
  'audit detail: after.eligible_count = 1 — the measured eligibility picture is ON the audited record');

-- ============================================================================
-- Section F — the write-once teeth. As service_role: UPDATE/DELETE on both snapshot tables -> 42501 (AC2).
-- ============================================================================
-- 0003:73-77 spells out why the GRANT is the mechanism and the policy is not: service_role has BYPASSRLS, so
-- it skips row POLICIES entirely — but never table GRANTS. 0003's own suite proves this; it is RE-ASSERTED
-- here so that 0024, which is the first migration to WRITE these tables, cannot regress it.
set local role service_role;
select throws_ok($$update public.stat_snapshot set content_sha256 = repeat('0', 64)$$, '42501',
  'permission denied for table stat_snapshot',
  'AD-15 ⭐ as service_role, UPDATE on stat_snapshot is REFUSED 42501 — which is why lock_ceremony hashes BEFORE inserting the header');
select throws_ok($$delete from public.stat_snapshot$$, '42501',
  'permission denied for table stat_snapshot',
  'AD-15 as service_role, DELETE on stat_snapshot is REFUSED 42501');
select throws_ok($$update public.stat_snapshot_row set kills = 0$$, '42501',
  'permission denied for table stat_snapshot_row',
  'AD-15 ⭐ as service_role, UPDATE on stat_snapshot_row is REFUSED 42501 — the captured contract cannot be edited, by anyone');
select throws_ok($$delete from public.stat_snapshot_row$$, '42501',
  'permission denied for table stat_snapshot_row',
  'AD-15 as service_role, DELETE on stat_snapshot_row is REFUSED 42501');
set local role postgres;

-- ============================================================================
-- Section G — the four `ceremony_locked` guards, each proving the refusal wrote nothing (AC2).
-- ============================================================================
-- TLOCK carries a RAW `locked` ceremony row and one raw `resolved` match. Each guard is read UNDER the lock
-- the RPC already takes and fires BEFORE that RPC's own state guard — so a `resolved` match refuses
-- ceremony_locked rather than `not_pending`, which is exactly what "before any write" buys.
set local role service_role;
insert into rpc_log select 'g_appr', pg_temp.approve(pg_temp.mid('TLOCK', 'winners', 0));
insert into rpc_log select 'g_roll', pg_temp.rollback_m(pg_temp.mid('TLOCK', 'winners', 0));
insert into rpc_log select 'g_man',  pg_temp.manual(pg_temp.mid('TLOCK', 'winners', 0));
insert into rpc_log select 'g_cur',  pg_temp.curate(pg_temp.tid('TLOCK'));
insert into rpc_log select 'g_cur2', pg_temp.curate(pg_temp.tid('TCLOSED'));
set local role postgres;

select is((select r->>'reason' from rpc_log where tag = 'g_appr'), 'ceremony_locked',
  'AD-15 ⭐ approve_match refuses `ceremony_locked` once the ceremony is locked (the seam 0017:74-76 flagged and deferred to 6.2)');
select is((select r->>'reason' from rpc_log where tag = 'g_roll'), 'ceremony_locked',
  'AD-15 ⭐ rollback_match refuses `ceremony_locked` (the seam 0018:67-70 flagged)');
select is((select r->>'reason' from rpc_log where tag = 'g_man'), 'ceremony_locked',
  'AD-15 ⭐ manual_resolve_match refuses `ceremony_locked` (the seam 0019:68-71 flagged)');
-- ⚠ THE REASON STRING STAYS `catalog_frozen`. lib/awards/curate.ts:51-59 has it in its trusted-reason Set and
-- app/api/admin/awards/route.ts:33-42 maps it to 409; changing it would break both plus 0023's Section F.
-- What changed is only what it TESTS — TLOCK is `registration_open`, so ONLY the ceremony half can fire here.
select is((select r->>'reason' from rpc_log where tag = 'g_cur'), 'catalog_frozen',
  'AD-15 ⭐ curate_award_catalog refuses `catalog_frozen` on a REGISTRATION_OPEN tournament whose ceremony is locked — the real lock replaced 0023''s honest partial');
select is((select r->>'ceremony_state' from rpc_log where tag = 'g_cur'), 'locked',
  'curate: the refusal names the ceremony state that caused it (a `catalog_frozen` with no cause is unactionable)');
-- ⚠ BOTH DISJUNCTS ARE KEPT. A `closed` event with NO ceremony row must STILL freeze its catalog; dropping
-- the tournament-state half would quietly re-open it.
select is((select r->>'reason' from rpc_log where tag = 'g_cur2'), 'catalog_frozen',
  'curate: a CLOSED tournament with NO ceremony row is still frozen — the tournament-state disjunct is kept, so this is a strict WIDENING of 0023''s guard');

select is((select state from match where tournament_id = pg_temp.tid('TLOCK')), 'resolved',
  'ceremony_locked: the refused approve/rollback/manual left the match state untouched');
select is((select winner_entry from match where tournament_id = pg_temp.tid('TLOCK')), null::bigint,
  'ceremony_locked: …and wrote no winner (manual_resolve_match refuses BEFORE its audit row, which is its first write)');
select is((select count(*)::int from award where tournament_id in (pg_temp.tid('TLOCK'), pg_temp.tid('TCLOSED'))), 0,
  'ceremony_locked: the refused curations wrote NO award rows');
select is(
  (select count(*)::int from audit_log
    where tournament_id in (pg_temp.tid('TLOCK'), pg_temp.tid('TCLOSED'))), 0,
  'ceremony_locked: not one of the four refusals wrote an audit row (every guard runs before any write)');

-- ============================================================================
-- Section H — the AD-19 row shape, on the REAL captured rows (AC3/AC5).
-- ============================================================================
-- The 0023 closed-set vocabulary, restated here deliberately: this suite must be able to fail INDEPENDENTLY
-- of the migration's own function. `award_stat_vocabulary()` is used as the comparison SOURCE precisely
-- because DECISION B says the snapshot captures the whole vocabulary — so a key added to the catalog and
-- forgotten in the capture reddens HERE, before 6.5 discovers it as an unresolvable rung.
select is(
  (select array(select jsonb_object_keys((pg_temp.snap('76561197960287801')).stats_int) order by 1)),
  array['efficiency', 'rate', 'secondary', 'volume'],
  'AD-19: stats_int carries exactly the four specced blocks — volume · rate · secondary · efficiency');

select set_eq(
  $$select jsonb_object_keys((pg_temp.snap('76561197960287801')).stats_int -> 'volume')$$,
  $$select unnest(public.award_stat_vocabulary('volume'))$$,
  'AD-19/DECISION B: the `volume` block carries EVERY volume vocabulary key — not just the keys today''s catalog names (the snapshot is write-once; 6.5 fills rungs later)');
select set_eq(
  $$select jsonb_object_keys((pg_temp.snap('76561197960287801')).stats_int -> 'rate')$$,
  $$select unnest(public.award_stat_vocabulary('rate'))$$,
  'AD-19: the `rate` block carries all four rate keys');
select set_eq(
  $$select jsonb_object_keys((pg_temp.snap('76561197960287801')).stats_int -> 'secondary')$$,
  $$select unnest(public.award_stat_vocabulary(null))$$,
  'AD-19: the `secondary` block answers for the WHOLE vocabulary (FR-29 rung 1''s key is 6.5''s to choose)');
select set_eq(
  $$select jsonb_object_keys((pg_temp.snap('76561197960287801')).stats_int -> 'efficiency')$$,
  $$select unnest(public.award_stat_vocabulary(null))$$,
  'AD-19: the `efficiency` block answers for the WHOLE vocabulary (FR-29 rung 2''s two keys are 6.5''s to choose)');

-- ⭐⭐ THE INTEGER-FORM CONTRACT, ASSERTED BY INSPECTION OF THE CAPTURED jsonb — Epic-5 retro Action Item #1's
-- success criterion. A pre-divided `numeric` from public.leaderboard (adr / kast_pct / hs_pct /
-- entry_success) would land here as a non-integer number and redden.
select is(
  (select count(*)::int
     from public.stat_snapshot_row r
     join public.stat_snapshot s on s.id = r.snapshot_id,
          lateral jsonb_each(r.stats_int -> 'volume') as e(k, v)
    where s.tournament_id = pg_temp.tid('TCER')
      -- ⭐ code review 2026-08-03: the ORIGINAL predicate was `(v::text)::numeric <> trunc(...)`, which a
      -- pre-divided numeric that happens to be INTEGRAL passes — `adr_damage_sum 2400 / rounds 30` renders as
      -- `80.0000000000000000`, is `number`, and equals its own trunc. jsonb PRESERVES SCALE, so the honest
      -- test of "this is an integer, not a division result" is the TEXT FORM, not the numeric value.
      and (coalesce(jsonb_typeof(v), '') <> 'number' or v::text !~ '^-?[0-9]+$')),
  0, 'AD-19 ⭐ EVERY `volume` leaf across EVERY captured row is an INTEGER IN ITS TEXT FORM — no pre-divided numeric slipped in, not even an integral-valued one');
select is(
  (select count(*)::int
     from public.stat_snapshot_row r
     join public.stat_snapshot s on s.id = r.snapshot_id,
          lateral jsonb_each(r.stats_int -> 'rate') as e(k, v)
    where s.tournament_id = pg_temp.tid('TCER')
      -- ⛔⭐ code review 2026-08-03 — THIS ASSERTION WAS BLIND, AND A REVIEWER MUTATION PROVED IT: renaming
      -- the `den` key to `den_x` in the capture left the WHOLE suite green (94 ok / 0 red). Why: `jsonb_typeof`
      -- is STRICT, so a MISSING key gives SQL NULL, the conjunction collapses to NULL, `not NULL` is NULL, and
      -- the WHERE excludes the row — count(*) = 0 and the test passes on exactly the malformation it names.
      -- This is the trap the migration itself documents as load-bearing (0023:349-357 / 0024's own header) and
      -- that was not applied here. `coalesce(jsonb_typeof(...), '')` is the fix, on every leg.
      -- The `::text` regex (rather than a trunc compare) additionally catches an integral-valued pre-divided
      -- numeric, since jsonb preserves scale.
      and not (coalesce(jsonb_typeof(v), '') = 'object'
               and coalesce(jsonb_typeof(v -> 'num'), '') = 'number'
               and coalesce(jsonb_typeof(v -> 'den'), '') = 'number'
               and (v -> 'num')::text ~ '^-?[0-9]+$'
               and (v -> 'den')::text ~ '^-?[0-9]+$')),
  0, 'AD-19 ⭐ EVERY `rate` value is a {num,den} pair of INTEGERS — never a bare scalar, never a float, and never a pair MISSING one of its two keys (AD-14 cross-multiplication)');
select is(
  (pg_temp.snap('76561197960287801')).stats_int -> 'rate' -> 'adr',
  jsonb_build_object('num', 2400, 'den', 30),
  'AD-19: adr = {num: adr_damage_sum, den: rounds_played_total} — 0021''s INTEGER halves, never its pre-divided `adr` column');
-- The uniform efficiency form: a volume key v becomes {num:v, den:1}, so an FR-29 rung-2 ratio over ANY two
-- vocabulary keys resolves by integer cross-multiplication with no class branching and no division.
select is(
  (pg_temp.snap('76561197960287801')).stats_int -> 'efficiency' -> 'kills',
  jsonb_build_object('num', 25, 'den', 1),
  'AD-19: a VOLUME key in the `efficiency` block is {num: v, den: 1} — the uniform integer form 6.5''s rung-2 cross-multiplies');

-- ⭐ THE WINLESS PLAYER. …806 was rostered and never played. Their row must exist, zero-filled, with the
-- PUBLISHED absent-sentinel — 6.7's pity draw enumerates exactly these players.
select is(
  (select array[(pg_temp.snap('76561197960287806')).rounds_played, (pg_temp.snap('76561197960287806')).kills]),
  array[0, 0],
  'AD-19 ⭐ a rostered player with ZERO approved rows still gets a row, zero-filled (never NULL — a NULL propagates through every comparison and would silently drop them)');
select is((pg_temp.snap('76561197960287806')).achievement_ts, -1::bigint,
  'AD-19 ⭐ achievement_ts uses the PUBLISHED absent-sentinel -1 when the player has no contributing row (DECISION C — a documented proxy, not a real achievement time)');

-- ⭐ h2h: absence IS the FR-29 rung-3 "they never met" signal, and it must be absence, never a zero.
select ok(
  (pg_temp.snap('76561197960287801')).h2h ? '76561197960287808',
  'AD-19 h2h: …801''s map HAS the opponent they actually played (the grand final)');
select ok(
  not ((pg_temp.snap('76561197960287801')).h2h ? '76561197960287803'),
  'AD-19 ⭐ h2h: a player they NEVER met is ABSENT — absence is the rung-3 skip signal, and a zero would silently become a real comparison');
select is((pg_temp.snap('76561197960287805')).h2h, '{}'::jsonb,
  'AD-19 h2h: a player whose ONLY opponent was idle-DQ''d has an EMPTY map — the idle match contributes to nobody''s head-to-head');

-- ⚠⚠ idle_dq INVERTS ITS MEANING AT THIS LAYER. On stat_row it is per-match; in the snapshot it means FULLY
-- DQ'd (at least one approved row and EVERY one idle). Getting this backwards would either disqualify the
-- winless or let a fully-idle player win a trophy.
select is((pg_temp.snap('76561197960287802')).idle_dq, true,
  'AD-19 ⭐ idle_dq = TRUE for a player whose every approved row is idle — "fully DQ''d", not the per-match flag');
select is((pg_temp.snap('76561197960287806')).idle_dq, false,
  'AD-19 ⭐ idle_dq = FALSE for the winless player with NO rows — they are winless, not disqualified, and 6.7''s pity must still reach them');
-- ⭐⭐ THE ANY-vs-ALL CATCHER (this pair exists because the mutation pass found the case uncovered: an
-- ANY-idle implementation passed every other assertion in this suite).
select is((pg_temp.snap('76561197960287807')).idle_dq, false,
  'AD-19 ⭐⭐ idle_dq = FALSE for a player with a MIX of idle and live rows — the rule is ALL-idle, not ANY-idle; an ANY reading would disqualify anyone who ever went AFK once');
select is(
  (select array[(pg_temp.snap('76561197960287807')).rounds_played, (pg_temp.snap('76561197960287807')).kills]),
  array[12, 4],
  'AD-19 ⭐⭐ …and that mixed player contributes ONLY their live match (12 rounds / 4 kills) — the idle match is excluded from the aggregate, in lockstep with 0021:88');

-- ⭐⭐ THE CAPTURE-INTEGRITY HASH, RE-COMPUTED INDEPENDENTLY FROM THE STORED ROWS. This is the assertion that
-- makes `content_sha256` mean something: the stored bytes ARE the hashed bytes, in byte-lex steamid64 order,
-- under the exact recipe the migration documents. A drift between the hash input and the insert — the single
-- most likely way this function goes quietly wrong — reddens here.
-- ⚠ This is NOT bundle_sha256: RFC-8785 canonicalization and the published commitment are Story 6.9's.
select is(
  (select content_sha256 from stat_snapshot where tournament_id = pg_temp.tid('TCER')),
  (select encode(sha256(convert_to(string_agg(
            r.steamid64
              || chr(30) || r.stats_int::text
              || chr(30) || r.h2h::text
              || chr(30) || r.achievement_ts::text
              || chr(30) || r.rounds_played::text
              || chr(30) || r.kills::text
              || chr(30) || case when r.idle_dq then 'true' else 'false' end,
            chr(29) order by r.steamid64 collate "C"), 'UTF8')), 'hex')
     from public.stat_snapshot_row r
     join public.stat_snapshot s on s.id = r.snapshot_id
    where s.tournament_id = pg_temp.tid('TCER')),
  'AC3 ⭐⭐ content_sha256 re-computed from the STORED rows matches the header — the digest covers exactly the bytes that were written, in byte-lex steamid64 order');

-- ============================================================================
-- Section I — CODE REVIEW 2026-08-03. Everything below exists because a reviewer-independent mutation pass
-- found FIVE SURVIVORS in six mutations, or because a decision taken at review added new behaviour.
--
-- The survivors, and what now kills each:
--   `rounds_won` -> literal 0 ................ I1 / I2   (DECISION D was captured but never asserted)
--   `achievement_ts` min -> max .............. I3        (only the -1 sentinel had been pinned)
--   `contrib` -> `all_approved` for the ts ... I4
--   freeze condition -> `if false` ........... I7 / I8   (the fixture made exactly ONE approve, and it was
--                                                          the final, so mis-CONDITIONING was invisible)
--   `demo_unhashed` guard removed ............ I13-I15   (no fixture demo was unhashed)
-- ============================================================================

-- ── Bracket builder, so the three new lifecycle tournaments cost ~3 lines each instead of ~30.
create function pg_temp.mkbracket(tname text, p_off int) returns void language plpgsql as $fn$
declare v_r jsonb;
begin
  insert into public.season (name) select 'S-' || tname
   where not exists (select 1 from public.season where name = 'S-' || tname);
  insert into public.tournament (season_id, name, state)
  values ((select id from public.season where name = 'S-' || tname), tname, 'registration_open');

  insert into public.player (steamid64, display_name)
  select '765611979602878' || lpad((p_off + i)::text, 2, '0'), tname || ' P' || i
    from generate_series(1, 8) as i;
  insert into public.roster_entry (tournament_id, steamid64, status)
  select pg_temp.tid(tname), '765611979602878' || lpad((p_off + i)::text, 2, '0'), 'active'
    from generate_series(1, 8) as i;

  update public.tournament set state = 'registration_closed' where name = tname;

  v_r := public.generate_bracket(pg_temp.tid(tname), '76561197960287930',
                                 '{"algorithm":"fisher-yates"}'::jsonb,
                                 pg_temp.seeds(tname, 8), pg_temp.matches8(tname));
  if (v_r->>'match_count')::int <> 15 then
    raise exception 'fixture: % did not commit 15 rows (%)', tname, v_r;
  end if;
  perform public.declare_match_format(pg_temp.tid(tname), null, 'mr12', 'ot_mr3', '76561197960287930', false);
end;
$fn$;

-- Raw-resolve + REAL advance every pre-GF node, in dependency order, skipping any already settled (TFRZ
-- approves winners/0 for real BEFORE this runs). Mirrors the TCER walk exactly.
create function pg_temp.walkgf(tname text) returns void language plpgsql as $fn$
declare v_step record; v_id bigint; v_r jsonb;
begin
  for v_step in
    select * from (values
      ('winners', 0), ('winners', 1), ('winners', 2), ('winners', 3),
      ('losers', 0), ('losers', 1),
      ('winners', 4), ('winners', 5),
      ('losers', 2), ('losers', 3),
      ('winners', 6),
      ('losers', 4), ('losers', 5)
    ) as s(br, slot)
  loop
    v_id := pg_temp.mid(tname, v_step.br, v_step.slot);
    if (select m.state from public.match m where m.id = v_id) = 'declared' then
      update public.match set state = 'resolved', winner_entry = competitor_a where id = v_id;
      v_r := public.advance_match(v_id, '76561197960287930', false);
      if not coalesce((v_r->>'ok')::boolean, false) then
        raise exception 'fixture: % advance of % % refused: %', tname, v_step.br, v_step.slot, v_r;
      end if;
    end if;
  end loop;
end;
$fn$;

-- Insert the two stat_rows a match's SEATED competitors need, so approve_match's wrong_demo guard is satisfied.
create function pg_temp.seatrows(p_mid bigint, p_mz int, p_demo bigint) returns void language plpgsql as $fn$
begin
  insert into public.stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won,
                               hs_kills, adr_damage, kast_rounds, entry_frags, opening_deaths)
  select p_mz, r.steamid64, p_demo,
         case when seat = 1 then 20 else 10 end, case when seat = 1 then 10 else 20 end,
         26, case when seat = 1 then 14 else 12 end,
         5, 1800, 18, 5, 4
    from (select m.competitor_a as re, 1 as seat from public.match m where m.id = p_mid
          union all
          select m.competitor_b, 2 from public.match m where m.id = p_mid) s
    join public.roster_entry r on r.id = s.re;
end;
$fn$;

create function pg_temp.walkover(p_mid bigint) returns jsonb language plpgsql as $probe$
begin
  return public.mark_walkover(p_mid, '76561197960287930',
           (select competitor_a from public.match where id = p_mid));
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'RAISED', 'detail', sqlstate);
end;
$probe$;

-- ── TFRZ — the full freeze lifecycle: a non-final approve, the crowning freeze, the DECISION F un-freeze on
--    rollback, and the re-approve that must reproduce the byte-identical hash.
select pg_temp.mkbracket('TFRZ', 10);
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state)
values (8101, 'demos/8101.dem', 'matchzy', repeat('2', 64), 'pending'),
       (8102, 'demos/8102.dem', 'matchzy', repeat('3', 64), 'pending');

-- A REAL approve of a match that is NOT the final. final_match_id is still NULL here, so the freeze must not
-- fire. ⛔ This is the mutation-E probe: `if false then` makes the freeze fall through to the else arm and
-- seize THIS match's demo hash as the tournament's fairness seed.
select pg_temp.seatrows(pg_temp.mid('TFRZ','winners',0), 8101, pg_temp.demo_id('2'));
set local role service_role;
insert into rpc_log select 'frzBindW0',
  public.bind_match_demo(pg_temp.mid('TFRZ','winners',0), pg_temp.demo_id('2'), '76561197960287930');
insert into rpc_log select 'frzApproveW0', pg_temp.approve(pg_temp.mid('TFRZ','winners',0));
set local role postgres;
-- Captured HERE, not at assertion time: the grand final is approved further down and legitimately sets it.
create temp table frz_after_w0 as
  select fair_seed from tournament where name = 'TFRZ';

select pg_temp.walkgf('TFRZ');
select pg_temp.seatrows(pg_temp.mid('TFRZ','grand_final',0,1), 8102, pg_temp.demo_id('3'));
set local role service_role;
insert into rpc_log select 'frzBindGF',
  public.bind_match_demo(pg_temp.mid('TFRZ','grand_final',0,1), pg_temp.demo_id('3'), '76561197960287930');
insert into rpc_log select 'frzApproveGF', pg_temp.approve(pg_temp.mid('TFRZ','grand_final',0,1));
set local role postgres;
create temp table frz_seed as
  select fair_seed from tournament where name = 'TFRZ';   -- the seed as frozen by the crowning

set local role service_role;
insert into rpc_log select 'frzRollback', pg_temp.rollback_m(pg_temp.mid('TFRZ','grand_final',0,1));
set local role postgres;
create temp table frz_after_rb as
  select fair_seed from tournament where name = 'TFRZ';   -- DECISION F: cleared with the crown

set local role service_role;
insert into rpc_log select 'frzReapprove', pg_temp.approve(pg_temp.mid('TFRZ','grand_final',0,1));
set local role postgres;

-- ── TUNH — the championship demo carries NO hash (the admin manual-upload path, 0006:12-15). The approve must
--    still SUCCEED (refusing the crowning over a missing hash is the worse failure) and must NOT write a NULL
--    seed. ⛔ This is the mutation-F probe.
select pg_temp.mkbracket('TUNH', 20);
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state)
values (8201, 'demos/8201.dem', 'manual_upload', null, 'pending');  -- 0006:12-15: this path never hashes
select pg_temp.walkgf('TUNH');
select pg_temp.seatrows(pg_temp.mid('TUNH','grand_final',0,1), 8201,
                        (select id from demo where matchzy_match_id = 8201));
set local role service_role;
insert into rpc_log select 'unhBindGF',
  public.bind_match_demo(pg_temp.mid('TUNH','grand_final',0,1),
                         (select id from demo where matchzy_match_id = 8201), '76561197960287930');
insert into rpc_log select 'unhApproveGF', pg_temp.approve(pg_temp.mid('TUNH','grand_final',0,1));
set local role postgres;

-- ── TMAN — a HAND-RESOLVED championship with a real, hashed demo bound (the FR-16 audited override). Before
--    the review this crowned a champion and silently discarded a seed it was holding, leaving lock_ceremony
--    refusing `seed_unavailable` forever with no repair path anywhere in the product.
select pg_temp.mkbracket('TMAN', 30);
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state)
values (8301, 'demos/8301.dem', 'matchzy', repeat('4', 64), 'pending');
select pg_temp.walkgf('TMAN');
select pg_temp.seatrows(pg_temp.mid('TMAN','grand_final',0,1), 8301, pg_temp.demo_id('4'));
set local role service_role;
insert into rpc_log select 'manBindGF',
  public.bind_match_demo(pg_temp.mid('TMAN','grand_final',0,1), pg_temp.demo_id('4'), '76561197960287930');
insert into rpc_log select 'manResolveGF', pg_temp.manual(pg_temp.mid('TMAN','grand_final',0,1));
set local role postgres;

-- ── TSTALE / TWHY — raw shapes for lock_ceremony's two new/《sharpened》seed refusals. No bracket needed: the
--    guards read tournament.final_match_id and resolve the demo from it.
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TSTALE'), ('TWHY')) as v(n);
insert into roster_entry (tournament_id, steamid64, status)
select pg_temp.tid(v.n), '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from (values ('TSTALE'), ('TWHY')) as v(n) cross join generate_series(1, 2) as i;
update tournament set state = 'bracket_live' where name in ('TSTALE', 'TWHY');

insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, demo_id,
                   winner_to_bracket, winner_to_slot, winner_to_side, loser_to_bracket, loser_to_slot,
                   loser_to_side, format, tie_policy, format_locked)
values
  -- TSTALE's "final": a real match bound to a HASHED demo whose hash is NOT the tournament's frozen seed.
  (pg_temp.tid('TSTALE'), 'winners', 'Stale Final', 0, 'resolved', pg_temp.demo_id('c'),
   'winners', 998, 'a', 'losers', 998, 'a', 'mr12', 'ot_mr3', true),
  -- TWHY's "final": NO demo was ever bound — the walkover / plain-manual shape.
  (pg_temp.tid('TWHY'), 'winners', 'No Demo Final', 0, 'resolved', null,
   'winners', 997, 'a', 'losers', 997, 'a', 'mr12', 'ot_mr3', true);

update tournament set final_match_id = (select id from match where bracket_position = 'Stale Final'),
                      fair_seed = repeat('7', 64)          -- valid hex, but NOT demo 'c''s hash
 where name = 'TSTALE';
update tournament set final_match_id = (select id from match where bracket_position = 'No Demo Final')
 where name = 'TWHY';

set local role service_role;
insert into rpc_log select 'r_stale', pg_temp.lock_c(pg_temp.tid('TSTALE'));
insert into rpc_log select 'r_why',   pg_temp.lock_c(pg_temp.tid('TWHY'));
insert into rpc_log select 'r_walkover', pg_temp.walkover(
  (select id from match where tournament_id = pg_temp.tid('TLOCK')));
set local role postgres;

-- ── I1/I2 — DECISION D's hand-summed `rounds_won`, the ONE volume key not sourced from public.leaderboard.
select is(((pg_temp.snap('76561197960287801')).stats_int -> 'volume' ->> 'rounds_won')::int, 16,
  'DECISION D ⭐ rounds_won carries its REAL summed value (…801 won 16 rounds in the grand final) — a mutant returning 0 used to pass the whole suite');
select is(((pg_temp.snap('76561197960287807')).stats_int -> 'volume' ->> 'rounds_won')::int, 5,
  'DECISION D ⭐ rounds_won sums only CONTRIBUTING rows — the mixed player …807 gets the live match''s 5, never the idle match''s 1 (the 0021:87-88 predicate, hand-copied and now pinned)');

-- ── I3/I4 — DECISION C's `achievement_ts`. Only the -1 sentinel had a test; the VALUE had none.
select is((pg_temp.snap('76561197960287804')).achievement_ts,
          (trunc(extract(epoch from timestamptz '2026-08-01 10:00:00+00') * 1000))::bigint,
  'DECISION C ⭐ achievement_ts is the MINIMUM over contributing rows — …804 has rows at 10:00 and 15:00 and must report 10:00 (a max() mutant used to pass)');
select is((pg_temp.snap('76561197960287807')).achievement_ts,
          (trunc(extract(epoch from timestamptz '2026-08-01 13:00:00+00') * 1000))::bigint,
  'DECISION C ⭐ achievement_ts reads CONTRIBUTING rows, not every approved row — …807''s idle 12:00 row is excluded and the live 13:00 row is the answer');

-- ── I5/I6 — h2h is restricted to the ACTIVE roster on BOTH sides.
select ok(
  not ((pg_temp.snap('76561197960287804')).h2h ? '76561197960287809'),
  'AD-19 ⭐ h2h EXCLUDES a soft-removed opponent — …809 shares an approved match with …804 but has no snapshot row, and a write-once artifact must not carry opponent keys that resolve to nobody');
select ok(
  (pg_temp.snap('76561197960287804')).h2h ? '76561197960287803',
  'AD-19 h2h still HAS the active opponent …804 actually played — the roster filter did not empty the map');

-- ── I7/I8 — the freeze CONDITION. mutation: `if v_final is distinct from p_match_id` -> `if false`.
-- ⚠ Read from the AUDIT row, not the return payload: `fair_seed_reason` is deliberately audit-only (the
-- return carries just fair_seed_frozen + seed_hex). Asserting the audited record is the stronger test —
-- it pins AD-17's "the freeze, or its absence, is on the record" as well as the condition itself.
select is(
  (select detail->>'fair_seed_reason' from audit_log
    where action = 'approve' and target_match_id = pg_temp.mid('TFRZ','winners',0)), 'not_final',
  'AD-13 ⛔ a REAL approve of a NON-final match records not_final — the freeze is conditioned on the crowning, not on "any approve" (the fixture''s single-approve blind spot, now covered)');
select is((select fair_seed from frz_after_w0), null,
  'AD-13 ⛔⭐ …and tournament.fair_seed is STILL NULL after that non-final approve — THE mutation-E probe: a freeze that fires on any approve would have seized winners/0''s demo hash as the fairness seed, and every other assertion in this suite would still have passed');

-- ── I9..I12 — the crowning freeze, then DECISION F's un-freeze on rollback, then the re-approve.
select is((select r->>'seed_hex' from rpc_log where tag = 'frzApproveGF'), repeat('3', 64),
  'AD-13 the crowning approve freezes the GRAND FINAL demo''s hash (not winners/0''s, which was approved first)');
select is((select fair_seed from frz_seed), repeat('3', 64),
  'AD-13 tournament.fair_seed holds that hash after the crowning');
select is((select fair_seed from frz_after_rb), null,
  'DECISION F ⭐⭐ rolling back the final UN-FREEZES the seed — fair_seed and final_match_id can never disagree, so a re-decided championship cannot publish a superseded demo''s hash');
select is((select r->>'seed_hex' from rpc_log where tag = 'frzReapprove'), repeat('3', 64),
  'DECISION F ⭐ re-approving the same final re-freezes the BYTE-IDENTICAL hash and no IC908 fires — the ordinary dispute correction still works');

-- ── I13..I15 — mutation F: the demo_unhashed arm.
select is((select (r->>'ok')::boolean from rpc_log where tag = 'unhApproveGF'), true,
  'AD-13 ⛔ an UNHASHED championship demo does NOT refuse the approve — refusing to publish the final over a missing hash is the far worse failure');
select is(
  (select detail->>'fair_seed_reason' from audit_log
    where action = 'approve' and target_match_id = pg_temp.mid('TUNH','grand_final',0,1)), 'demo_unhashed',
  'AD-13 ⛔ …and the audit row says so honestly (mutation: delete the `if v_sha is null` guard and this arm vanishes — the else branch then writes fair_seed = NULL and reports frozen:true)');
select is((select fair_seed from tournament where name = 'TUNH'), null,
  'AD-13 ⛔⭐ …and fair_seed is left NULL rather than "successfully" written as NULL — the hex CHECK permits NULL and the write-once trigger does not fire on a first write, so nothing else would have caught this');

-- ── I16..I18 — lock_ceremony's seed refusals.
select is((select r->>'reason' from rpc_log where tag = 'r_stale'), 'seed_stale',
  'AD-13 ⭐ lock_ceremony REFUSES when the frozen seed is not the current final''s demo hash — publishing it would make ceremony.seed_demo_sha256''s own contract false, uncorrectably');
select is(
  (select count(*)::int from ceremony c join tournament t on t.id = c.tournament_id where t.name = 'TSTALE'), 0,
  'seed_stale wrote nothing — no ceremony row, exactly like every other refusal');
select is((select r->>'why' from rpc_log where tag = 'r_why'), 'no_demo_bound',
  'seed_unavailable SAYS WHICH WALL: "no demo was ever bound" (terminal — a walkover or plain manual final) is a different problem from "bound but unhashed" (recoverable — re-ingest)');

-- ── I19/I20 — the manual-resolution freeze.
select is((select (r->>'fair_seed_frozen')::boolean from rpc_log where tag = 'manResolveGF'), true,
  'AD-13 ⭐⭐ a HAND-RESOLVED championship with a bound, hashed demo FREEZES the seed — before the review this crowned a champion and threw the seed away, bricking the ceremony permanently');
select is((select fair_seed from tournament where name = 'TMAN'), repeat('4', 64),
  'AD-13 ⭐ …and the frozen value is that demo''s hash');

-- ── I21/I22 — mark_walkover joins the guarded set.
select is((select r->>'reason' from rpc_log where tag = 'r_walkover'), 'ceremony_locked',
  'AD-15 ⭐ mark_walkover refuses once the ceremony is locked — it calls advance_match, so it can CROWN and rewrite final_match_id out from under an already-committed seed');
select is((select state from match where tournament_id = pg_temp.tid('TLOCK')), 'resolved',
  'AD-15 mark_walkover''s refusal wrote nothing — the match state is untouched');

select * from finish();
rollback;
