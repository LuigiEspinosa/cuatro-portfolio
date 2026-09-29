-- supabase/tests/0017_aprobar_publish_test.sql
-- pgTAP proof for migration 0017 (Story 4.6b): the atomic "Aprobar" publish (AD-6 / FR-13 / FR-31).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC1  THE ATOMIC PUBLISH (flagship): one approve_match on a bound `pending` match, in ONE transaction —
--        every stat_row -> approved (+ approved_at / approved_by stamped); the demo-derived score mapped to
--        the RIGHT seats (a transpose is the bug this catches); score_source='demo_derived'; state='resolved';
--        the winner ARRIVED at its destination seat; exactly ONE timeline_feed row; TWO audit rows (approve +
--        advance), the approve row carrying a real before/after                                          -> A
--   AC2  THE EMIT: exactly ONE match.approved on tournament:<id> and ZERO bracket.advanced (proving the
--        advance ran with p_emit => false), on the PUBLIC channel                                        -> B
--   AC3  THE FEED: anon CAN read the row (the policy); service_role CANNOT UPDATE/DELETE it (append-only)  -> C
--   AD-23 BOTH WAYS: approve on a committed forfeit -> not_pending; a raw forfeit->resolved flip -> IC901
--        (4.5's rule, still holds); a raw resolved->forfeit flip -> IC904 (this story's half); ⭐ a raw
--        resolved->pending flip -> LIVES (proves Story 4.7's rollback is NOT blocked)                    -> D
--   hand-off #3  score_source_guard TIGHTENED: score with NULL provenance is now REFUSED (23514)         -> E
--   THE GUARDS: tied / not_pending / not_bound / wrong_demo / demo_mismatch / bad_score                  -> F
--   ⭐⭐ THE {ok:false} ROLLBACK (the single most important assertion): a slot_taken advance RAISES IC903 and
--        the WHOLE publish rolls back — still pending, NO score, NO approved row, NO feed, NO audit         -> G
--
-- ⚠ MUTATION-TESTED BY EXECUTION (the standing 4.1/4.2/4.3 lesson — deferred-work.md: "4.3 mutation-tested AC1
-- and shipped the identical hole on AC2; deleting the result gate left all 79 assertions green"). A FOUR-effect
-- story has FOUR ways to be blind. Each defect below was injected into the SHIPPED approve_match body / the
-- migration objects, the object re-applied to the live DB via create-or-replace, and this file re-run. The
-- counts are OBSERVED (2026-07-18), not inferred — a green suite after any is a blind suite; fix the test, not
-- the mutation:
--   * remove the stat_row status flip (STEP 1)              -> 3 RED  (A7/A8 + the audit before/after)
--   * remove the score write (STEP 2)                       -> 3 RED  (A3 source, A4/A5 the scores)
--   * TRANSPOSE score_a/score_b                             -> 2 RED  (A4/A5 — the seat-orientation catcher)
--   * remove the timeline_feed insert (STEP 4)              -> 5 RED  (A10/A11/A12 + C1 anon-read + the shape)
--   * swallow the {ok:false} RAISE (proceed past IC903)     -> 6 RED  (all of Section G — the partial publish commits)
--   * flip p_emit => false to true in the advance call      -> 1 RED  (B2 — a bracket.advanced appears on the wire)
--   * neuter the IC904 terminal rule (`if false and …`)     -> 2 RED  (Section D — resolved->forfeit no longer refused)
--   * neuter the score_source_guard conjunct (migration)    -> 1 RED  (E1 — a score with no provenance is allowed again)
--   * crown competitor_a always / b-wins score transpose    -> RED   (Section H — the mirror orientation; added by the
--                                                                     2026-07-18 code review, which found only the a-wins
--                                                                     orientation was ever driven)
--
-- An 8-player field (a power of two — NO structural byes/voids) is used so every driven match is DETERMINED.
-- The terminal-state probes (Section D) and the not_bound probe (Section F) are raw-INSERTed into a separate
-- no-bracket tournament (TGUARD), exactly as 0015/0016 do. Binds are driven through 4.6a's REAL
-- bind_match_demo (never hand-built) so the `pending` state is genuine.
--
-- SQLSTATE: IC901/IC902 = 4.5's; IC903 = approve_match's advance-refused rollback; IC904 = the AD-23
-- resolved->forfeit half; 23514 = score_source_guard.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 16 + B 4 + C 5 + D 4 + E 2 + F 7 + G 6 + H 6 = 50.
select plan(50);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 8 field players, three tournaments.
--   TAP    — 8-player bracket. The driven approve + every RPC refusal path.
--   TROLL  — 8-player bracket. The {ok:false} slot_taken rollback (its own bracket, so no bleed).
--   TGUARD — no bracket: the raw-INSERT target for the AD-23 probes + the not_bound / score-guard probes.
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TAP'), ('TROLL'), ('TGUARD')) as v(n);

insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TAP', 'TROLL', 'TGUARD');

update tournament set state = 'registration_closed' where name in ('TAP', 'TROLL');

-- ── Helpers (mirroring 0013/0014/0015/0016 — reuse, never hand-derive) ───────
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

create function pg_temp.comp(tname text, br text, slot int, side text, gf int default 0) returns bigint language sql stable as $fn$
  select case when side = 'a' then m.competitor_a else m.competitor_b end
    from public.match m join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = br and m.bracket_slot = slot
     and coalesce(m.gf_order, 0) = coalesce(gf, 0)
$fn$;

create function pg_temp.audit_ct(tgt bigint, act text) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt and action = act
$fn$;
create function pg_temp.audit_all(tgt bigint) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt
$fn$;

-- timeline_feed rows for a given match; realtime.messages on a tournament's public channel.
create function pg_temp.feed_ct(m bigint) returns int language sql stable as $fn$
  select count(*)::int from public.timeline_feed where target_match_id = m
$fn$;
create function pg_temp.msgs(tname text, ev text) returns int language sql stable as $fn$
  select count(*)::int from realtime.messages
   where topic = 'tournament:' || pg_temp.tid(tname)::text and event = ev
$fn$;

create function pg_temp.guard_mid(pos text) returns bigint language sql stable as $fn$
  select m.id from public.match m join public.tournament t on t.id = m.tournament_id
   where t.name = 'TGUARD' and m.bracket_position = pos
$fn$;

-- The complete 8-player double-elim skeleton, slot-for-slot as lib/bracket/generate.ts emits it after
-- Story 4.4 (a golden snapshot, edges included — never hand-derived). 7 winners + 6 losers + 2 GF = 15.
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

create temp table rpc_log (tag text primary key, r jsonb);
grant select, insert on rpc_log to service_role;

-- Generate both real brackets (as the default superuser, before the role switch — mirrors 0014/0015/0016).
insert into rpc_log
select v.tag,
       public.generate_bracket(pg_temp.tid(v.tag), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds(v.tag, 8), pg_temp.matches8(v.tag))
  from (values ('TAP'), ('TROLL')) as v(tag);

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'TAP') <> 15 then
    raise exception 'fixture: TAP did not commit 15 rows';
  end if;
end $$;

-- ── The demos + their parsed stat rows (the FR-16 tally rides stat_row.rounds_won) ──
-- D1  the clean, decided demo approved in Section A. Seats a(…801)=16, b(…808)=13 — DISTINCT tallies so a
--     score transpose is DETECTABLE (A4/A5). matchzy 9001.
-- Dw  ⭐ the WRONG-DEMO probe (F4): a clean demo whose two players (…806/…807) are NOT the seats of the match
--     it gets bound to (TAP winners/1 = …804/…805). bind_match_demo does not verify this (4.6a); approve does.
-- Dn  ⭐ the BAD-SCORE probe (F6): seats of TAP winners/3 (…803/…806), but …806's rounds_won is NULL (a
--     pre-0016 row shape). no_stats passes (2 rows exist); bad_score must still catch the NULL tally.
-- Dm  ⭐ the DEMO-MISMATCH probe (F5): seats of TAP winners/2 (…802/…807). After binding, its rows' demo_id is
--     re-pointed to Dx (a re-parse), so match.demo_id != stat_row.demo_id (data-integrity M5).
-- Dx  a bare second demo (no rows) — the re-pointed provenance target for F5.
-- Dt  the {ok:false} ROLLBACK demo (Section G): seats of TROLL winners/0 (…801/…808), a wins. matchzy 9020.
-- Db  ⭐ the b-WINS orientation demo (Section H, code-review 2026-07-18): seats of TROLL winners/2 (…802/…807),
--     b WINS 16-11 — the mirror of every a-wins path above. matchzy 9014.
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state) values
  (9001, 'demos/9001.dem', 'matchzy', repeat('a', 64), 'pending'),
  (9010, 'demos/9010.dem', 'matchzy', repeat('w', 64), 'pending'),
  (9011, 'demos/9011.dem', 'matchzy', repeat('n', 64), 'pending'),
  (9012, 'demos/9012.dem', 'matchzy', repeat('m', 64), 'pending'),
  (9013, 'demos/9013.dem', 'matchzy', repeat('x', 64), 'pending'),
  (9014, 'demos/9014.dem', 'matchzy', repeat('b', 64), 'pending'),
  (9020, 'demos/9020.dem', 'matchzy', repeat('t', 64), 'pending');

create function pg_temp.demo_id(tag text) returns bigint language sql stable as $fn$
  select id from public.demo where demo_sha256 = repeat(tag, 64)
$fn$;

-- D1: seats of TAP winners/0 (a=…801, b=…808) — 16-13, a wins.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9001, '76561197960287801', pg_temp.demo_id('a'), 20, 12, 29, 16),
  (9001, '76561197960287808', pg_temp.demo_id('a'), 12, 20, 29, 13);
-- Dw: two REAL players who are NOT TAP winners/1's seats (…804/…805).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9010, '76561197960287806', pg_temp.demo_id('w'), 16, 14, 30, 16),
  (9010, '76561197960287807', pg_temp.demo_id('w'), 14, 16, 30, 14);
-- Dn: seats of TAP winners/3 (a=…803, b=…806) — b's tally is NULL (the pre-0016 shape bad_score must catch).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9011, '76561197960287803', pg_temp.demo_id('n'), 10, 6, 15, 9),
  (9011, '76561197960287806', pg_temp.demo_id('n'),  6, 10, 15, null);
-- Dm: seats of TAP winners/2 (a=…802, b=…807).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9012, '76561197960287802', pg_temp.demo_id('m'), 16, 11, 27, 16),
  (9012, '76561197960287807', pg_temp.demo_id('m'), 11, 16, 27, 11);
-- Dx: deliberately NO rows.
-- Dt: seats of TROLL winners/0 (a=…801, b=…808) — 16-13, a wins (so the winner routes to winner_to).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9020, '76561197960287801', pg_temp.demo_id('t'), 20, 12, 29, 16),
  (9020, '76561197960287808', pg_temp.demo_id('t'), 12, 20, 29, 13);
-- Db: seats of TROLL winners/2 (a=…802, b=…807) — 11-16, b WINS (the mirror orientation for Section H).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9014, '76561197960287802', pg_temp.demo_id('b'), 11, 16, 27, 11),
  (9014, '76561197960287807', pg_temp.demo_id('b'), 16, 11, 27, 16);

-- ── Lock the formats through the REAL RPC (0016's fixture note: match_format_audited refuses a raw latch) ──
set local role service_role;
insert into rpc_log
select 'declareTAP', public.declare_match_format(pg_temp.tid('TAP'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log
select 'declareTROLL', public.declare_match_format(pg_temp.tid('TROLL'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
set local role postgres;

-- ── The AD-23 / not_bound raw probes into TGUARD (no bracket) — 0015/0016 Section F pattern ──
-- An unlocked format is legal for bye/void (match_live_requires_locked_format EXCLUDES them, 0012:118). The
-- forfeit is inserted format-LOCKED (a real forfeit's normal shape — declared+latched before the walkover;
-- 0016's correction). The `pending` not_bound probe MUST be format-locked (a pending row requires it,
-- 0012:123-126). The winner_to edge targets a non-existent slot 999 (nothing advances these) so
-- match_routing_complete is satisfied honestly.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, competitor_a, competitor_b, winner_entry,
                   winner_to_bracket, winner_to_slot, winner_to_side, format, tie_policy, format_locked, demo_id)
values
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Forfeit', 91, 'forfeit', pg_temp.re('TGUARD', 2), pg_temp.re('TGUARD', 3), pg_temp.re('TGUARD', 2), 'losers', 999, 'a', 'mr12', 'ot_mr3', true,  null),
  -- a `pending` row with NO demo bound — impossible via bind_match_demo (which sets demo_id WITH pending), so
  -- it is raw-built to isolate approve_match's not_bound guard. Format-locked (pending requires it).
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Pending', 92, 'pending', pg_temp.re('TGUARD', 4), pg_temp.re('TGUARD', 5), null,           'losers', 999, 'a', 'mr12', 'ot_mr3', true,  null),
  -- a `declared`, UNLOCKED row for the score_source_guard probe (Section E). Its score/source are written raw.
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Score',   93, 'declared', pg_temp.re('TGUARD', 6), pg_temp.re('TGUARD', 7), null,          'losers', 999, 'a', null,   null,     false, null);

-- Section G setup: pre-occupy the TROLL winners/0 winner's DESTINATION seat (Winners R2 side a) with a
-- DIFFERENT player, so the Aprobar's fold-in advance returns slot_taken (0015 Section G pattern).
update match set competitor_a = pg_temp.re('TROLL', 4) where id = pg_temp.mid('TROLL', 'winners', 4);

-- ⚠ realtime.messages is RANGE-partitioned on inserted_at; its partitions are made by a Realtime BACKGROUND
-- JOB, and realtime.send swallows its own errors (EXCEPTION WHEN OTHERS -> WARNING). If today's partition were
-- missing the emit would fail SILENTLY and Section B would go red for a reason unrelated to this story. Make
-- the suite's own precondition true (0013's pattern) rather than trust the job. Rolled back with everything.
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

-- Everything below runs as SERVICE_ROLE — the sole writer (AD-2). This exercises the grants, and it is how
-- approve_match / bind_match_demo are actually invoked (SECURITY INVOKER wrappers behind requireAdmin).
set local role service_role;

-- ── Drive the binds through 4.6a's REAL RPC (never hand-build `pending`) ─────
insert into rpc_log select 'bind0',  public.bind_match_demo(pg_temp.mid('TAP', 'winners', 0), pg_temp.demo_id('a'), '76561197960287930');
insert into rpc_log select 'bind1',  public.bind_match_demo(pg_temp.mid('TAP', 'winners', 1), pg_temp.demo_id('w'), '76561197960287930');
insert into rpc_log select 'bind2',  public.bind_match_demo(pg_temp.mid('TAP', 'winners', 2), pg_temp.demo_id('m'), '76561197960287930');
insert into rpc_log select 'bind3',  public.bind_match_demo(pg_temp.mid('TAP', 'winners', 3), pg_temp.demo_id('n'), '76561197960287930');
insert into rpc_log select 'bindT',  public.bind_match_demo(pg_temp.mid('TROLL', 'winners', 0), pg_temp.demo_id('t'), '76561197960287930');
insert into rpc_log select 'bind2T', public.bind_match_demo(pg_temp.mid('TROLL', 'winners', 2), pg_temp.demo_id('b'), '76561197960287930');

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — AC1 ⭐ THE ATOMIC PUBLISH (flagship): one Aprobar, the whole publish (16)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log
select 'approve0', public.approve_match(pg_temp.mid('TAP', 'winners', 0), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'approve0'), true,
  'AC1 ⭐ approve_match on a bound `pending` match SUCCEEDS');
select is((select state from match where id = pg_temp.mid('TAP', 'winners', 0)), 'resolved',
  'AC1 ⭐ the match state is now `resolved` (Pending -> Resolved: Aprobar)');
select is((select score_source from match where id = pg_temp.mid('TAP', 'winners', 0)), 'demo_derived',
  'AC1 ⭐ score_source = demo_derived (AD-5: when a demo exists, demo_derived is the score of record)');
-- ⭐ THE SEAT-ORIENTATION CATCHER: seat a (…801) won 16, seat b (…808) won 13. A transpose reddens A4/A5.
select is((select score_a from match where id = pg_temp.mid('TAP', 'winners', 0)), 16,
  'AC1 ⭐ score_a = 16 — competitor_a''s (…801''s) rounds_won, mapped to the RIGHT seat (a transposed score is the bug this catches)');
select is((select score_b from match where id = pg_temp.mid('TAP', 'winners', 0)), 13,
  'AC1 ⭐ score_b = 13 — competitor_b''s (…808''s) rounds_won, mapped to the RIGHT seat');
select is((select winner_entry from match where id = pg_temp.mid('TAP', 'winners', 0)), pg_temp.re('TAP', 1),
  'AC1 ⭐ winner_entry = the higher-tally seat (competitor_a, the …801 entry)');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TAP', 'winners', 0) and status <> 'approved'), 0,
  'AC1 ⭐ every stat_row for the match flipped to `approved` — ZERO left non-approved (the COUNT, not one row)');
select is(
  (select count(*)::int from stat_row
     where match_id = pg_temp.mid('TAP', 'winners', 0)
       and (approved_at is null or approved_by <> '76561197960287930')), 0,
  'AC1 (FR-13 4th clause) ⭐ every approved row is stamped with WHO (approved_by = the admin) and WHEN (approved_at)');
select is(pg_temp.comp('TAP', 'winners', 4, 'a'), pg_temp.re('TAP', 1),
  'AC1 ⭐ the winner ARRIVED — seated into the Winners R2 destination (assert the SEAT, not just advanced''s count — the 4.3 lesson)');
select is(pg_temp.feed_ct(pg_temp.mid('TAP', 'winners', 0)), 1,
  'AC1/AC3 ⭐ exactly ONE timeline_feed row was posted for the Aprobar (FR-31, singular per §8)');
select is(
  (select entry_type from timeline_feed where target_match_id = pg_temp.mid('TAP', 'winners', 0)), 'match_result',
  'AC1/AC3: the feed entry is a `match_result` (DECISION D — bracket_advance is provisioned but written elsewhere)');
select ok(
  (select (detail->>'winner_entry')::bigint = pg_temp.re('TAP', 1)
      and (detail->>'loser_entry')::bigint  = pg_temp.re('TAP', 8)
      and (detail->>'score_a')::int = 16 and (detail->>'score_b')::int = 13
     from timeline_feed where target_match_id = pg_temp.mid('TAP', 'winners', 0)),
  'AC3: the feed detail carries what the card renders — winner/loser entries + the 16-13 score');
select ok(
  (select detail->>'bracket_position' = 'Winners R1' and detail->>'demo_sha256' = repeat('a', 64)
     from timeline_feed where target_match_id = pg_temp.mid('TAP', 'winners', 0)),
  'AC3: …plus the bracket_position label and the demo_sha256 provenance (the evidence link the card shows)');
select is(pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 0), 'approve'), 1,
  'AC1/AD-17: exactly ONE `approve` audit row (who + when) for the Aprobar');
select is(pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 0), 'advance'), 1,
  'AC1: …and exactly ONE `advance` audit row (from the folded-in advance_match) — an Aprobar is TWO distinct consequences');
select ok(
  (select detail->'before'->>'state' = 'pending'
      and detail->'before'->>'score_source' is null
      and detail->'after'->>'state' = 'resolved'
      and (detail->'after'->>'score_a')::int = 16
      and (detail->>'stat_rows_approved')::int = 2
     from audit_log where target_match_id = pg_temp.mid('TAP', 'winners', 0) and action = 'approve'),
  'AC1/AD-17 (hand-off #6): the approve row carries a REAL before/after — before {pending, no source}, after {resolved, 16}, and the rows-approved count');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC2 ⭐ THE EMIT: one match.approved, ZERO bracket.advanced, right payload (4)
-- ════════════════════════════════════════════════════════════════════════════
-- realtime.send writes into realtime.messages IN this transaction; the whole suite rolls back, which is itself
-- the proof that the emit cannot outrun its own commit (0013's Section I reasoning).
select is(pg_temp.msgs('TAP', 'match.approved'), 1,
  'AC2 ⭐ exactly ONE `match.approved` Broadcast on tournament:<id> — the event name is SPECIFIED (SPINE:230), not invented');
select is(pg_temp.msgs('TAP', 'bracket.advanced'), 0,
  'AC2 ⭐⭐ ZERO `bracket.advanced` — the folded-in advance ran with p_emit => false, so the four AD-6 effects stay atomic on the wire (one Broadcast, AD-11). Flip p_emit to true and this reddens');
select is(
  (select bool_and(private = false) from realtime.messages
    where topic = 'tournament:' || pg_temp.tid('TAP')::text and event = 'match.approved'),
  true, 'AC2: the topic is the PUBLIC channel tournament:<id> (AD-11) — private => false');
-- ⭐ The Broadcast must CARRY the right change, not merely exist (a garbled payload reddens HERE, not just the
-- count — mirrors 0013's champion-payload assertion). Read the emitted payload directly (0013:749 pattern).
select ok(
  (select (payload->>'winner_entry')::bigint = pg_temp.re('TAP', 1)
      and (payload->>'loser_entry')::bigint  = pg_temp.re('TAP', 8)
      and (payload->>'score_a')::int = 16 and (payload->>'score_b')::int = 13
     from realtime.messages
    where topic = 'tournament:' || pg_temp.tid('TAP')::text and event = 'match.approved'),
  'AC2 ⭐ the match.approved payload CARRIES the semantic change — winner/loser entries + the 16-13 score in the right seats (a mutation that garbles the emit body reddens this)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC3 ⭐ THE FEED: anon reads it; service_role cannot edit history (5)
-- ════════════════════════════════════════════════════════════════════════════
-- Behavioral: an anon client CAN SELECT the row (the timeline_view policy + the anon grant), while the writer
-- cannot UPDATE or DELETE it (the append-only grant ceiling — the 0003 audit_log precedent).
-- ⚠ Under `anon` we must NOT call pg_temp.mid() — it reads `match`, which anon has no grant on. Exactly ONE
-- feed row exists at this point (Section A's Aprobar), so counting the whole anon-visible table proves the
-- policy (anon sees the row) without touching match.
set local role anon;
select is((select count(*)::int from timeline_feed), 1,
  'AC3 ⭐ an ANON client CAN read the feed row (timeline_view USING (true) + the anon SELECT grant) — the feed is public. Safe because a row is only ever written post-approval (FR-31)');
set local role service_role;

select throws_ok(
  format($$ update timeline_feed set detail = '{}'::jsonb where target_match_id = %s $$, pg_temp.mid('TAP', 'winners', 0)),
  '42501', null,
  'AC3 ⭐ service_role CANNOT UPDATE timeline_feed — append-only bites even for the writer (a correction posts a NEW entry; 4.7)');
select throws_ok(
  format($$ delete from timeline_feed where target_match_id = %s $$, pg_temp.mid('TAP', 'winners', 0)),
  '42501', null,
  'AC3 ⭐ service_role CANNOT DELETE timeline_feed — history is never erased (the audit_log 0003 ceiling)');
-- The grant layer behind the behaviour (has_table_privilege reads the grant, not RLS).
select ok(
  has_table_privilege('anon', 'public.timeline_feed', 'SELECT')
  and not has_table_privilege('anon', 'public.timeline_feed', 'INSERT'),
  'AC3: anon has SELECT but NOT INSERT on timeline_feed (a read surface, never a write one)');
select ok(
  has_table_privilege('service_role', 'public.timeline_feed', 'INSERT')
  and not has_table_privilege('service_role', 'public.timeline_feed', 'UPDATE')
  and not has_table_privilege('service_role', 'public.timeline_feed', 'DELETE'),
  'AC3: service_role has INSERT but NOT UPDATE/DELETE — the append-only ceiling at the grant layer');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — AD-23 BOTH WAYS: Resolved and Forfeit cannot coexist (4)
-- ════════════════════════════════════════════════════════════════════════════
-- approve on a committed forfeit is refused at the RPC guard (not_pending) — a terminal row is not approvable.
select is((select public.approve_match(pg_temp.guard_mid('Guard Forfeit'), '76561197960287930')->>'reason'), 'not_pending',
  'AD-23: approve_match on a committed FORFEIT is refused `not_pending` (the RPC guard; the AD-23 trigger is the second lock)');
-- 4.5's IC901 rule still holds (forfeit -> resolved is blocked at the trigger).
select throws_ok(
  format($$ update match set state = 'resolved' where id = %s $$, pg_temp.guard_mid('Guard Forfeit')),
  'IC901', null,
  'AD-23 ⭐ a committed forfeit CANNOT be flipped to `resolved` — IC901 (4.5''s rule, unchanged)');
-- ⭐ THIS STORY'S HALF: resolved -> forfeit is blocked by the NEW IC904 rule (Section A left winners/0 resolved).
select throws_ok(
  format($$ update match set state = 'forfeit' where id = %s $$, pg_temp.mid('TAP', 'winners', 0)),
  'IC904', null,
  'AD-23 ⭐⭐ the OTHER direction: a committed `resolved` result CANNOT be flipped to `forfeit` — IC904 (DECISION G, this story''s half). Neuter the rule and this reddens');
-- ⭐⭐ THE 4.7 GUARANTEE: resolved -> pending (rollback) is DELIBERATELY still allowed. A future "helpful"
-- tightening that added `resolved` to the terminal set would redden THIS and block Story 4.7 entirely.
select lives_ok(
  format($$ update match set state = 'pending' where id = %s $$, pg_temp.mid('TAP', 'winners', 0)),
  'AD-23 ⭐⭐ resolved -> pending is STILL ALLOWED (the lifecycle''s `Resolved --> Pending: rollback`, FR-14) — this proves Story 4.7 is NOT blocked. The trap the 4.3 review caught once');

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — hand-off #3: score_source_guard TIGHTENED (2)
-- ════════════════════════════════════════════════════════════════════════════
-- A score with NULL provenance PASSED 0010's guard today (the `score_source is null` disjunct short-circuits
-- TRUE). The tightened conjunct `(score_a is null) = (score_source is null)` closes it. ⚠ This assertion did
-- not exist before this story. `Guard Score` is a declared, unlocked TGUARD row (so no other guard interferes).
select throws_ok(
  format($$ update match set score_a = 16, score_b = 14 where id = %s $$, pg_temp.guard_mid('Guard Score')),
  '23514', null,
  'hand-off #3 ⭐ a score with NO score_source is now REFUSED (23514) — a score MUST name its provenance (AD-5). Neuter the conjunct and this reddens');
-- Non-vacuity: a legitimate score WITH a source is still allowed (admin_manual, demo_id null — 4.8's shape).
select lives_ok(
  format($$ update match set score_a = 16, score_b = 14, score_source = 'admin_manual' where id = %s $$, pg_temp.guard_mid('Guard Score')),
  'hand-off #3: …but a score WITH its provenance is allowed — the conjunct ties them together, it does not forbid scores');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — THE RPC GUARDS: every typed refusal, before any write (7)
-- ════════════════════════════════════════════════════════════════════════════
-- tied (DECISION K) — engineer equal tallies on a fresh bound match: raw-set winners/3's two rows equal, then
-- approve. (winners/3's b tally is NULL from Dn; set BOTH to 12 so the ONLY refusal left is `tied`.)
set local role postgres;
update stat_row set rounds_won = 12 where match_id = pg_temp.mid('TAP', 'winners', 3);
set local role service_role;
insert into rpc_log select 'tied', public.approve_match(pg_temp.mid('TAP', 'winners', 3), '76561197960287930');
select is((select r->>'reason' from rpc_log where tag = 'tied'), 'tied',
  'F tied (DECISION K): a drawn score (score_a = score_b) is REFUSED — a draw has no winner_entry and cannot advance a double-elim bracket');
select ok(
  (select state = 'pending' and score_a is null and score_source is null from match where id = pg_temp.mid('TAP', 'winners', 3))
  and (select count(*)::int from stat_row where match_id = pg_temp.mid('TAP', 'winners', 3) and status = 'approved') = 0
  and pg_temp.feed_ct(pg_temp.mid('TAP', 'winners', 3)) = 0
  and pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 3), 'approve') = 0
  and pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 3), 'advance') = 0,
  'F tied: …and NOTHING was written — still pending, no score, no approved row, no feed, and NO approve/advance audit row (the fixture''s bind_demo + declare_format rows are untouched)');

-- not_pending — a declared match (TAP losers/0, still undetermined/declared) is not approvable.
select is((select public.approve_match(pg_temp.mid('TAP', 'losers', 0), '76561197960287930')->>'reason'), 'not_pending',
  'F not_pending: approve on a `declared` match is refused (only 4.6a''s `pending` is approvable)');
-- not_bound — the raw `pending` TGUARD row with demo_id NULL (impossible via bind_match_demo, which sets both).
select is((select public.approve_match(pg_temp.guard_mid('Guard Pending'), '76561197960287930')->>'reason'), 'not_bound',
  'F not_bound: a `pending` match with NO demo bound is refused — approve refuses, it does NOT bind (that is 4.6a''s job)');
-- wrong_demo — TAP winners/1 was bound Dw, whose players (…806/…807) are NOT its seats (…804/…805).
select is((select public.approve_match(pg_temp.mid('TAP', 'winners', 1), '76561197960287930')->>'reason'), 'wrong_demo',
  'F wrong_demo ⭐ (re-homed from 4.6a): the bound demo''s players are not the two seats — refused. Found LIVE at 4.6a''s BAR; 4.6a binds on the admin''s say-so and verifies nothing');
-- demo_mismatch — re-point winners/2's bound rows to Dx (a re-parse), so match.demo_id != stat_row.demo_id.
set local role postgres;
update stat_row set demo_id = pg_temp.demo_id('x') where match_id = pg_temp.mid('TAP', 'winners', 2);
set local role service_role;
select is((select public.approve_match(pg_temp.mid('TAP', 'winners', 2), '76561197960287930')->>'reason'), 'demo_mismatch',
  'F demo_mismatch ⭐ (data-integrity M5): every stat_row.demo_id must equal match.demo_id — a re-parse repointed provenance, so the score would derive from one demo while the evidence link names another. Refused');
-- bad_score — TAP winners/3 was bound Dn (…806''s rounds_won is NULL) — but Section F tied set them to 12. Use
-- winners/1''s Dw? No — that''s wrong_demo. Re-null one of winners/3''s tallies to isolate bad_score.
set local role postgres;
update stat_row set rounds_won = null where match_id = pg_temp.mid('TAP', 'winners', 3) and steamid64 = '76561197960287806';
set local role service_role;
select is((select public.approve_match(pg_temp.mid('TAP', 'winners', 3), '76561197960287930')->>'reason'), 'bad_score',
  'F bad_score: a competitor''s rounds_won is NULL (the pre-0016 shape) — refused. ⚠ rounds_won is NULLABLE, so bad_score tests for NULL, not merely an absent row');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — ⭐⭐ THE {ok:false} ROLLBACK: the single most important assertion (6)
-- ════════════════════════════════════════════════════════════════════════════
-- TROLL winners/0 was bound Dt (a wins). Its winner''s destination (Winners R2 side a) was pre-occupied with a
-- DIFFERENT player, so the folded-in advance returns {ok:false, slot_taken} — approve_match RAISES IC903 and
-- the WHOLE publish rolls back. Swallow the RAISE and G1 goes green-when-it-should-red and G2..G6 redden.
select throws_ok(
  format($$ select public.approve_match(%s, '76561197960287930') $$, pg_temp.mid('TROLL', 'winners', 0)),
  'IC903', null,
  'G ⭐⭐ approve_match whose winner''s destination seat is TAKEN RAISES (IC903) — a resolved, scored match must never commit without its advance (the load-bearing hand-off)');
select is((select state from match where id = pg_temp.mid('TROLL', 'winners', 0)), 'pending',
  'G ⭐⭐ ROLLBACK: the match is STILL `pending` — the state write was undone with the transaction');
select ok(
  (select score_a is null and score_b is null and score_source is null and winner_entry is null
     from match where id = pg_temp.mid('TROLL', 'winners', 0)),
  'G ⭐⭐ ROLLBACK: NO score, NO score_source, NO winner_entry — the publish''s score write was rolled back');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TROLL', 'winners', 0) and status = 'approved'), 0,
  'G ⭐⭐ ROLLBACK: NO stat_row was approved — every row is still `pending`');
select is(pg_temp.feed_ct(pg_temp.mid('TROLL', 'winners', 0)), 0,
  'G ⭐⭐ ROLLBACK: NO timeline_feed row was posted');
select ok(
  pg_temp.audit_ct(pg_temp.mid('TROLL', 'winners', 0), 'approve') = 0
  and pg_temp.audit_ct(pg_temp.mid('TROLL', 'winners', 0), 'advance') = 0,
  'G ⭐⭐ ROLLBACK: neither an `approve` nor an `advance` audit row committed — the whole publish rolled back (the fixture''s bind_demo + declare_format rows are untouched)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section H — AC1 ⭐ THE b-WINS ORIENTATION (the mirror of Section A) — code review 2026-07-18 (6)
-- ════════════════════════════════════════════════════════════════════════════
-- Every driven approve above has seat A win 16-13, so the winner-selection `else v_m.competitor_b` branch and a
-- b-wins score orientation were NEVER exercised — a mutation that always crowns competitor_a (or a b-wins
-- transpose) survived green, a blind spot in a four-effect story. TROLL winners/2 (seats a=…802, b=…807) was
-- bound Db (11-16, b WINS). Approve it and assert the MIRROR: winner_entry is competitor_b; score_a is the
-- LOSER seat's 11 (score_a is the a-seat's score, never "the winner's"); and the winner arrives at its OWN
-- destination (Winners R2 slot 5 side a — winners/2's winner_to), not seat A's.
insert into rpc_log
select 'approveB', public.approve_match(pg_temp.mid('TROLL', 'winners', 2), '76561197960287930');
select is((select (r->>'ok')::boolean from rpc_log where tag = 'approveB'), true,
  'H ⭐ approve_match on the b-wins match SUCCEEDS');
select is((select state from match where id = pg_temp.mid('TROLL', 'winners', 2)), 'resolved',
  'H ⭐ the b-wins match is now `resolved`');
select is((select winner_entry from match where id = pg_temp.mid('TROLL', 'winners', 2)), pg_temp.re('TROLL', 7),
  'H ⭐⭐ winner_entry = competitor_b (the …807 seat) — the `else v_m.competitor_b` branch; a mutation that always crowns competitor_a reddens HERE');
select is((select score_a from match where id = pg_temp.mid('TROLL', 'winners', 2)), 11,
  'H ⭐ score_a = 11 — competitor_a''s (…802''s) rounds_won, mapped to its seat even though it LOST (score_a is the a-seat''s score, never "the winner''s")');
select is((select score_b from match where id = pg_temp.mid('TROLL', 'winners', 2)), 16,
  'H ⭐ score_b = 16 — competitor_b''s (…807''s) winning tally, in the RIGHT seat (a b-wins transpose reddens this)');
select is(pg_temp.comp('TROLL', 'winners', 5, 'a'), pg_temp.re('TROLL', 7),
  'H ⭐ the b-wins winner ARRIVED — seated into its OWN Winners R2 destination (slot 5 side a), not seat A''s (assert the seat, not just advanced''s count — the 4.3 lesson)');

select * from finish();
rollback;
