-- supabase/tests/0015_walkover_grace_test.sql
-- pgTAP proof for migration 0015 (Story 4.5): bye/forfeit walkover with a grace timer (AD-9 / AD-23).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC2  the grace GATE: begin_match_grace stamps the clock; mark_walkover BEFORE the period elapses is
--        REFUSED (grace_active) and the match is UNCHANGED; after it elapses the forfeit succeeds, the
--        winner advances, the absent loser drops, and TWO audit rows are written                       -> A/B/C
--   AC1  zero-stats: a forfeit / bye creates NO stat_row, and the terminal guard makes a flip to a
--        stats-bearing state impossible                                                                -> C/F
--   AC3  the AD-23 terminal-state guard: a committed forfeit/bye/void cannot be flipped (IC901); a bye
--        DESTINATION seat (state stays 'bye') is still ALLOWED                                          -> F
--   ⭐   THE {ok:false} ROLLBACK (the 4.3 hand-off): a forfeit whose winner's seat is TAKEN raises IC902
--        and rolls the WHOLE forfeit back — the source stays awaiting_grace, no winner, no audit         -> G
--   +    begin_match_grace / resume_match guards (not_startable / not_ready / not_awaiting / bad_*)     -> A/D/E
--
-- ⚠ MUTATION-TESTED (the 4.1/4.2/4.3 standing lesson). Verified by hand during Story 4.5 dev:
--   * neuter the grace gate (`if false and now() < v_deadline`)      -> B1 goes RED (forfeit-before-elapse
--     is no longer refused).
--   * neuter the terminal guard (`if false and old.state in (…)`)     -> F1/F2/F3 go RED.
--   * turn the {ok:false} RAISE into a swallow (proceed past it)       -> G1 goes GREEN-when-it-should-RED
--     and G2/G3/G4 go RED (a partial forfeit would commit).
-- A green suite after any of those is a blind suite — fix the test, not the mutation.
--
-- An 8-player field (a power of two — NO structural byes/voids) is used for the driven forfeit so the
-- matchup is DETERMINED (both seats filled), which is what a no-show forfeit requires. The synthetic
-- bye/void rows for the terminal-guard probes live in a separate no-bracket tournament (TGUARD).
--
-- SQLSTATE: IC901 = match_terminal_state_guard; IC902 = mark_walkover's advance-refused rollback.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 6 + B 2 + C 10 + D 2 + E 5 + F 5 + G 4 = 34.
select plan(34);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 8 field players, three tournaments.
--   TFORF  — 8-player bracket. The driven grace + forfeit path.
--   TROLL  — 8-player bracket. The {ok:false} slot_taken rollback (its own bracket, so no bleed).
--   TGUARD — no bracket: the raw-INSERT target for the terminal-guard probes (Section F).
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TFORF'), ('TROLL'), ('TGUARD')) as v(n);

insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TFORF', 'TROLL', 'TGUARD');

update tournament set state = 'registration_closed' where name in ('TFORF', 'TROLL');

-- ── Helpers (mirroring 0013/0014) ───────────────────────────────────────────
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

-- audit rows keyed by the (globally unique) target match id + action.
create function pg_temp.audit_ct(tgt bigint, act text) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt and action = act
$fn$;
create function pg_temp.audit_all(tgt bigint) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt
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

-- Generate both real brackets (as the default superuser, before the role switch — mirrors 0014).
insert into rpc_log
select v.tag,
       public.generate_bracket(pg_temp.tid(v.tag), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds(v.tag, 8), pg_temp.matches8(v.tag))
  from (values ('TFORF'), ('TROLL')) as v(tag);

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'TFORF') <> 15 then
    raise exception 'fixture: TFORF did not commit 15 rows';
  end if;
end $$;

-- Everything below runs as SERVICE_ROLE — the sole writer (AD-2). This exercises the grants, and it is how
-- 4.5's RPCs are actually invoked (SECURITY INVOKER wrappers behind requireAdmin).
set local role service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — AC2: begin_match_grace enters the clock, and its guards bite (5)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log values
  ('begin0', public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930'));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'begin0'), true,
  'AC2: begin_match_grace on a determined `declared` matchup SUCCEEDS');
select ok(
  (select state = 'awaiting_grace' and awaiting_grace_since is not null
     from match where id = pg_temp.mid('TFORF', 'winners', 0)),
  'AC2: the match is now `awaiting_grace` with the server clock (awaiting_grace_since) STAMPED');

-- DECISION E was OVERRULED at code review (2026-07-15): starting the grace clock is the countdown to a
-- forfeit, so it is audited too. `action` carries no CHECK, so `begin_grace` needs no migration.
select ok(
  (select count(*)::int from audit_log
    where target_match_id = pg_temp.mid('TFORF', 'winners', 0)
      and action = 'begin_grace'
      and actor_steamid64 = '76561197960287930'
      and (detail->>'grace_period_seconds')::int = 600
      and detail->>'awaiting_grace_since' is not null) = 1,
  'AD-17 (DECISION E overruled): begin_match_grace writes exactly ONE `begin_grace` audit row naming the ACTOR (who) + the clock stamp and the period LIVE at start');

select is((select public.begin_match_grace(999999, '76561197960287930')->>'reason'), 'bad_match',
  'begin_match_grace on a nonexistent match -> bad_match');
select is((select public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930')->>'reason'), 'not_startable',
  'begin_match_grace RE-CALLED on an already-`awaiting_grace` match -> not_startable (NEVER a silent re-stamp of the clock)');
select is((select public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 5), '76561197960287930')->>'reason'), 'not_ready',
  'begin_match_grace on a match with an EMPTY seat (an undetermined WR2 slot) -> not_ready (a grace timer is for a determined matchup, not a structural bye)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC2 ⭐ THE GRACE GATE: a forfeit BEFORE the period elapses is refused (2)
-- ════════════════════════════════════════════════════════════════════════════
-- The clock was just stamped (now()), grace_period_seconds defaults to 600, so the period has NOT elapsed.
insert into rpc_log values
  ('early', public.mark_walkover(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930', pg_temp.re('TFORF', 1)));

select is((select r->>'reason' from rpc_log where tag = 'early'), 'grace_active',
  'AC2 ⭐ mark_walkover BEFORE the grace period elapses is REFUSED (grace_active) — the server-side timer, un-bypassable');
-- ⚠ audit_all is 1, NOT 0: Section A's begin_grace row legitimately exists (DECISION E overruled at code
-- review). The property under test is that the REFUSAL wrote nothing — so pin `mark_walkover` = 0 AND the
-- total at exactly the one pre-existing row, which still catches a refusal that leaks any audit row.
select ok(
  (select state = 'awaiting_grace' and winner_entry is null from match where id = pg_temp.mid('TFORF', 'winners', 0))
  and pg_temp.audit_ct(pg_temp.mid('TFORF', 'winners', 0), 'mark_walkover') = 0
  and pg_temp.audit_all(pg_temp.mid('TFORF', 'winners', 0)) = 1,
  'AC2 ⭐ …and the match is UNCHANGED — still awaiting_grace, no winner, and the refusal wrote NO mark_walkover row (only Section A''s begin_grace row remains)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC1/AC2: the grace period elapses -> the forfeit advances the bracket (10)
-- ════════════════════════════════════════════════════════════════════════════
-- Backdate the clock past the configured period (server-side; the gate reads grace_period_seconds LIVE).
update match set awaiting_grace_since = now() - interval '20 minutes'
 where id = pg_temp.mid('TFORF', 'winners', 0);

insert into rpc_log values
  ('forfeit', public.mark_walkover(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930', pg_temp.re('TFORF', 1)));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'forfeit'), true,
  'AC2: after the grace period elapses, mark_walkover SUCCEEDS');
select is((select (r->>'advanced')::int from rpc_log where tag = 'forfeit'), 2,
  'AC2: advanced = 2 — the forfeit is a NORMAL double-elim loss: the present winner advances AND the absent loser drops (DECISION F)');
select is((select state from match where id = pg_temp.mid('TFORF', 'winners', 0)), 'forfeit',
  'AC1/AC3: the match state is now `forfeit` (a terminal structural result)');
select is((select winner_entry from match where id = pg_temp.mid('TFORF', 'winners', 0)), pg_temp.re('TFORF', 1),
  'AC1: the PRESENT player (competitor_a) is the winner — advanced with a structural result, no stats');
select is(pg_temp.comp('TFORF', 'winners', 4, 'a'), pg_temp.re('TFORF', 1),
  'AC2: the present winner ADVANCED — seated into the Winners R2 destination (winner_to edge)');
select is(pg_temp.comp('TFORF', 'losers', 0, 'a'), pg_temp.re('TFORF', 8),
  'AC2/DECISION F: the ABSENT player DROPPED to the Losers bracket (loser_to edge) — the Winners no-show keeps their second-bracket life');
select is(pg_temp.audit_ct(pg_temp.mid('TFORF', 'winners', 0), 'mark_walkover'), 1,
  'AC2/FR-9: exactly ONE `mark_walkover` audit row (who + when) was written for the forfeit');
select is(pg_temp.audit_ct(pg_temp.mid('TFORF', 'winners', 0), 'advance'), 1,
  'AC2: …and exactly ONE `advance` audit row (from advance_match) — a forfeit is TWO distinct admin consequences');
select ok(
  (select detail->>'forfeiting_entry' = pg_temp.re('TFORF', 8)::text and detail->>'winner_entry' = pg_temp.re('TFORF', 1)::text
     from audit_log where target_match_id = pg_temp.mid('TFORF', 'winners', 0) and action = 'mark_walkover'),
  'FR-9: the mark_walkover audit detail records the forfeiting (absent) entry AND the winner (present) entry');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TFORF', 'winners', 0)), 0,
  'AC1 ⭐ zero-stats: a forfeit creates NO stat_row (there is no reachable stat-write path — stats come only from a demo parse, and a forfeit has no demo)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — mark_walkover guards: bad_winner + bad_match (2)
-- ════════════════════════════════════════════════════════════════════════════
-- Put WR1 slot 3 (competitors re(3), re(6)) on an ELAPSED clock, then forfeit with a NON-competitor.
insert into rpc_log values
  ('begin3', public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 3), '76561197960287930'));
update match set awaiting_grace_since = now() - interval '20 minutes'
 where id = pg_temp.mid('TFORF', 'winners', 3);

select is((select public.mark_walkover(pg_temp.mid('TFORF', 'winners', 3), '76561197960287930', pg_temp.re('TFORF', 5))->>'reason'), 'bad_winner',
  'mark_walkover with a winner_entry that is NOT one of the two seated competitors -> bad_winner');
select is((select public.mark_walkover(999999, '76561197960287930', pg_temp.re('TFORF', 1))->>'reason'), 'bad_match',
  'mark_walkover on a nonexistent match -> bad_match');

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — AC2 / DECISION C: resume_match returns awaiting_grace -> DECLARED (4)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log values
  ('begin2', public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 2), '76561197960287930'));

insert into rpc_log values
  ('resume2', public.resume_match(pg_temp.mid('TFORF', 'winners', 2), '76561197960287930'));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'resume2'), true,
  'AC2: resume_match on an awaiting_grace match SUCCEEDS (the absent player arrived)');
select ok(
  (select state = 'declared' and awaiting_grace_since is null from match where id = pg_temp.mid('TFORF', 'winners', 2)),
  'AC2/DECISION C: resume returns the match to `declared` (NOT `live` — 4.5 does not claim declared->live) and CLEARS the clock');
-- DECISION E overruled at code review (2026-07-15): the resume is audited too, and its detail carries the
-- clock stamp the UPDATE nulled — so (grace_started_at, occurred_at) bounds the whole no-show episode.
select ok(
  (select count(*)::int from audit_log
    where target_match_id = pg_temp.mid('TFORF', 'winners', 2)
      and action = 'resume_match'
      and actor_steamid64 = '76561197960287930'
      and detail->>'grace_started_at' is not null) = 1,
  'AD-17 (DECISION E overruled): resume_match writes exactly ONE `resume_match` audit row naming the ACTOR + the grace_started_at it cleared');

select is((select public.resume_match(pg_temp.mid('TFORF', 'winners', 2), '76561197960287930')->>'reason'), 'not_awaiting',
  'resume_match on a match that is NOT awaiting_grace -> not_awaiting');
select is((select public.resume_match(999999, '76561197960287930')->>'reason'), 'bad_match',
  'resume_match on a nonexistent match -> bad_match');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — AC3 ⭐ the AD-23 terminal-state guard: a committed result cannot be flipped (5)
-- ════════════════════════════════════════════════════════════════════════════
-- Synthetic bye / void rows in TGUARD (losers arm: a declared winner_to edge, no loser edge). The forfeit
-- row is the REAL one from Section C — proving a genuinely committed forfeit is un-flippable.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   winner_to_bracket, winner_to_slot, winner_to_side)
values
  (pg_temp.tid('TGUARD'), 'losers', 'Losers R1', 0, 'bye',  'losers', 5, 'a'),
  (pg_temp.tid('TGUARD'), 'losers', 'Losers R1', 1, 'void', 'losers', 5, 'a');

select throws_ok(
  format($$ update match set state = 'resolved' where id = %s $$, pg_temp.mid('TFORF', 'winners', 0)),
  'IC901', null,
  'AC3 ⭐ a committed FORFEIT cannot be flipped to `resolved` — IC901 (AD-23: Resolved and Forfeit cannot coexist)');
select throws_ok(
  format($$ update match set state = 'pending' where id = %s $$, pg_temp.mid('TGUARD', 'losers', 0)),
  'IC901', null,
  'AC3 ⭐ a committed BYE cannot be flipped out of its terminal state — IC901');
select throws_ok(
  format($$ update match set state = 'resolved' where id = %s $$, pg_temp.mid('TGUARD', 'losers', 1)),
  'IC901', null,
  'AC3 ⭐ a VOID cannot be flipped to a played state — IC901');

-- The guard fires ONLY on a state change OUT of terminal. Seating a `bye` DESTINATION (4.3's walkover
-- cascade: competitor + winner set, state STAYS `bye`) MUST still be allowed.
select lives_ok(
  format($$ select public.match_place_competitor(%s, 'a', %s, true) $$, pg_temp.mid('TGUARD', 'losers', 0), pg_temp.re('TGUARD', 1)),
  'AC3: seating a `bye` destination via match_place_competitor (state stays `bye`) is ALLOWED — the guard binds the FLIP, not the walkover seat');
select ok(
  (select state = 'bye' and winner_entry = pg_temp.re('TGUARD', 1) from match where id = pg_temp.mid('TGUARD', 'losers', 0)),
  'AC1/AC3: the walkover seat crowned the arrival (winner_entry set) while the state stayed the terminal `bye` — no stat path, no flip');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — ⭐⭐ THE {ok:false} ROLLBACK (the 4.3 hand-off): a refused advance rolls the forfeit back (4)
-- ════════════════════════════════════════════════════════════════════════════
-- Engineer a slot_taken: pre-occupy the forfeit winner's DESTINATION seat (Winners R2 side a) with a
-- DIFFERENT player, then forfeit. advance_match returns {ok:false, slot_taken}; mark_walkover MUST raise
-- (IC902) and roll the WHOLE forfeit back.
update match set competitor_a = pg_temp.re('TROLL', 4) where id = pg_temp.mid('TROLL', 'winners', 4);

insert into rpc_log values
  ('rollbegin', public.begin_match_grace(pg_temp.mid('TROLL', 'winners', 0), '76561197960287930'));
update match set awaiting_grace_since = now() - interval '20 minutes'
 where id = pg_temp.mid('TROLL', 'winners', 0);

select throws_ok(
  format($$ select public.mark_walkover(%s, '76561197960287930', %s) $$,
         pg_temp.mid('TROLL', 'winners', 0), pg_temp.re('TROLL', 1)),
  'IC902', null,
  'AC ⭐⭐ mark_walkover whose winner''s destination seat is TAKEN RAISES (IC902) — a forfeit that could not advance must not commit');
select is((select state from match where id = pg_temp.mid('TROLL', 'winners', 0)), 'awaiting_grace',
  '⭐⭐ ROLLBACK: the source match is STILL `awaiting_grace` — the forfeit was rolled back entirely');
select is((select winner_entry from match where id = pg_temp.mid('TROLL', 'winners', 0)), null::bigint,
  '⭐⭐ ROLLBACK: no winner was seated on the source — the forfeit state-write was undone with the transaction');
-- ⚠ audit_all is 1, NOT 0: `rollbegin`'s begin_grace row was committed by a SEPARATE statement before the
-- raise and correctly SURVIVES the rollback (DECISION E overruled at code review). The rollback property is
-- that NEITHER consequence of the forfeit landed — so pin both actions at 0 and the total at the one
-- surviving pre-existing row.
select ok(
  pg_temp.audit_ct(pg_temp.mid('TROLL', 'winners', 0), 'mark_walkover') = 0
  and pg_temp.audit_ct(pg_temp.mid('TROLL', 'winners', 0), 'advance') = 0
  and pg_temp.audit_all(pg_temp.mid('TROLL', 'winners', 0)) = 1,
  '⭐⭐ ROLLBACK: neither the mark_walkover row nor the advance row committed — only the begin_grace row from the grace start survives');

select * from finish();
rollback;
