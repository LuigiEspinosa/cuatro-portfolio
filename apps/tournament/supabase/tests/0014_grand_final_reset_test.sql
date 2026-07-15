-- supabase/tests/0014_grand_final_reset_test.sql
-- pgTAP proof for migration 0014 (Story 4.4): the grand-final RESET as two ordered match rows (AD-21).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC1  the reset row is representable: gf_order=2 inserts cleanly; the widened arm accepts a gf_order=1
--        row carrying the reset edges and still refuses a terminal gf_order=2 row that carries any    -> A
--   AC2  NO RESET when side A (the Winners champion) wins game 1 — champion outright, gf_order=2 stays
--        empty, final_match_id = the gf_order=1 row                                                   -> B (TGFA)
--   AC2  ⭐ THE RESET: side B (the Losers survivor) wins game 1 -> both route into gf_order=2, no champion
--        yet; then gf_order=2 resolves -> the champion is the LAST GF row's winner, on a DIFFERENT row  -> B (TRESET)
--   AC3  AD-8 conditional advance applies PER ROW: each GF row is advanced by the same advance_match,
--        and a replay is an idempotent no-op that still writes its audit row                            -> C
--
-- ⭐ THE FLAGSHIP CLAIM (AD-21, closing adversarial hole H4): the champion slot is a DIFFERENT column on a
-- DIFFERENT row across the two games, so it is NEVER overwritten in place. Assertion B20 proves that
-- literally: gf_order=1.winner_entry and gf_order=2.winner_entry are distinct rows with distinct winners.
--
-- ⚠ MUTATION-TESTED (the 4.1/4.2/4.3 standing lesson): deleting the AD-21 GF-1 conditional in advance_match
-- (0014, the `if v_m.bracket='grand_final' and v_m.gf_order=1 and v_m.winner_entry=v_m.competitor_a` block)
-- turns THIS suite RED in BOTH directions — a side-A win would then route into the reset (B6/B7/B8/B9 red:
-- advanced 2 not 0, no champion, reset seated, final_match_id unset), and the side-B reset path (B10-B19)
-- is what proves a side-B win MUST route. A green suite after that mutation would be a blind suite.
--
-- ⚠ Seating the grand-final rows by hand here is a FIXTURE, not a feature: Story 4.6 owns the Aprobar
-- result that seats the WB/LB finalists into gf_order=1. This suite proves the MECHANISM from the GF down,
-- exactly as 0013 Section K seats its champion by hand.
--
-- An 8-player field (a power of two — NO byes/voids) is used deliberately: the AD-21 mechanism lives
-- entirely in the two grand-final rows, and an 8-field keeps the surrounding skeleton uncluttered.
--
-- SQLSTATE: 23514 = a CHECK (incl. match_routing_complete, match_gf_order_guard).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 5 + B (TGFA 5 + TRESET-1 6 + TRESET-2 4 + literal 1) + C 3 = 5 + 16 + 3 = 24.
select plan(24);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 8 field players, three tournaments.
--   TGFA   — side A wins game 1 (no reset). Its own bracket.
--   TRESET — side B wins game 1 -> the reset. Its own bracket (a separate one, so TGFA's crown cannot
--            leak into TRESET's final_match_id assertions).
--   TCHK   — no bracket: the raw-INSERT target for the guard probes (Section A).
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TGFA'), ('TRESET'), ('TCHK')) as v(n);

insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TGFA', 'TRESET');

update tournament set state = 'registration_closed' where name in ('TGFA', 'TRESET');

-- ── Helpers (mirroring 0013's) ──────────────────────────────────────────────
create function pg_temp.tid(tname text) returns bigint language sql stable as $fn$
  select id from public.tournament where name = tname
$fn$;

create function pg_temp.re(tname text, n int) returns bigint language sql stable as $fn$
  select r.id
    from public.roster_entry r
    join public.tournament t on t.id = r.tournament_id
   where t.name = tname and r.status = 'active'
   order by r.steamid64
  offset (n - 1) limit 1
$fn$;

create function pg_temp.seeds(tname text, n int) returns jsonb language sql stable as $fn$
  select jsonb_agg(jsonb_build_object('roster_entry_id', pg_temp.re(tname, s), 'seed', s))
    from generate_series(1, n) as s
$fn$;

create function pg_temp.edge(b text, sl int, gf int, side text) returns jsonb language sql immutable as $fn$
  select jsonb_build_object('bracket', b, 'slot', sl, 'gf_order', gf, 'side', side)
$fn$;

-- gf_order IS PART OF THE KEY (0013's landmine, now live): grand_final has TWO rows, so a lookup that
-- ignored gf_order would match both. coalesce(gf_order,0) keys the same identity match_slot_uniq does.
create function pg_temp.mid(tname text, br text, slot int, gf int default 0) returns bigint language sql stable as $fn$
  select m.id
    from public.match m
    join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = br and m.bracket_slot = slot
     and coalesce(m.gf_order, 0) = coalesce(gf, 0)
$fn$;

create function pg_temp.comp(tname text, br text, slot int, side text, gf int default 0) returns bigint language sql stable as $fn$
  select case when side = 'a' then m.competitor_a else m.competitor_b end
    from public.match m
    join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = br and m.bracket_slot = slot
     and coalesce(m.gf_order, 0) = coalesce(gf, 0)
$fn$;

create function pg_temp.audits_for(tname text, src bigint) returns int language sql stable as $fn$
  select count(*)::int
    from public.audit_log a
    join public.tournament t on t.id = a.tournament_id
   where t.name = tname and a.action = 'advance' and a.target_match_id = src
$fn$;

-- The complete 8-player double-elim skeleton, slot-for-slot as lib/bracket/generate.ts emits it AFTER
-- Story 4.4: 7 winners + 6 losers + 2 grand_final (gf_order 1 WITH the reset edges, gf_order 2 terminal) =
-- 15 rows (2*8-1). A golden snapshot of generateBracket() output, edges included — never hand-derived.
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
      -- AD-21: gf_order=1 carries the two conditional reset edges; gf_order=2 is the terminal reset row.
      ('grand_final', 'Grand Final', 0, 1, null::bigint, null::bigint, pg_temp.edge('grand_final', 0, 2, 'b'), pg_temp.edge('grand_final', 0, 2, 'a')),
      ('grand_final', 'Grand Final (reset)', 0, 2, null::bigint, null::bigint, null::jsonb, null::jsonb)
    ) as v(b, p, sl, gf, ca, cb, wt, lt)
$fn$;

create temp table rpc_log (tag text primary key, r jsonb);
grant select, insert on rpc_log to service_role;

-- Generate both brackets through the REAL RPC, then FREEZE their formats (a 'resolved' result cannot even
-- be fixtured without a locked format — match_live_requires_locked_format, 0012). The bulk declare locks
-- all 14 `declared` rows, INCLUDING BOTH grand-final rows (gf_order 1 and 2), so the fixtures below can seat
-- 'resolved' results on them.
insert into rpc_log
select v.tag,
       public.generate_bracket(pg_temp.tid(v.tag), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds(v.tag, 8), pg_temp.matches8(v.tag))
  from (values ('TGFA'), ('TRESET')) as v(tag);

insert into rpc_log
select 'fmt_' || v.tag,
       public.declare_match_format(pg_temp.tid(v.tag), null, 'mr12', 'ot_mr3', '76561197960287930', false)
  from (values ('TGFA'), ('TRESET')) as v(tag);

-- Sanity: both generations landed the 2B-1 skeleton with the reset row.
-- (kept out of the plan — a bare guard, not a scored assertion)
do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'TGFA') <> 15 then
    raise exception 'fixture: TGFA did not commit 15 rows';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — AC1: the reset row is representable, and the widened arm still has teeth (5)
-- ════════════════════════════════════════════════════════════════════════════
set local role service_role;

select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values (pg_temp.tid('TCHK'), 'grand_final', 'Grand Final (reset)', 0, 2) $$,
  'AC1: a gf_order=2 grand-final row inserts cleanly (terminal, no edges — its winner is the champion)');

select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order)
       values (pg_temp.tid('TCHK'), 'grand_final', 'GF (bogus)', 1, 3) $$,
  '23514', 'new row for relation "match" violates check constraint "match_gf_order_guard"',
  'AC1: gf_order=3 is REFUSED by match_gf_order_guard — AD-21 has EXACTLY two ordered grand-final rows');

select lives_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order,
                        winner_to_bracket, winner_to_slot, winner_to_gf_order, winner_to_side,
                        loser_to_bracket,  loser_to_slot,  loser_to_gf_order,  loser_to_side)
       values (pg_temp.tid('TCHK'), 'grand_final', 'Grand Final', 2, 1,
               'grand_final', 0, 2, 'b', 'grand_final', 0, 2, 'a') $$,
  'AC1/AD-21: the widened arm ACCEPTS a gf_order=1 row carrying the two reset edges (-> grand_final gf_order=2)');

select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order,
                        winner_to_bracket, winner_to_slot, winner_to_side)
       values (pg_temp.tid('TCHK'), 'grand_final', 'GF reset (bad)', 3, 2, 'winners', 9, 'a') $$,
  '23514', 'new row for relation "match" violates check constraint "match_routing_complete"',
  'AC1/AD-21: a terminal gf_order=2 row carrying ANY edge is still REFUSED — the widening did not weaken the CHECK');

-- ⭐ BOTH-OR-NEITHER (code-review patch): the two reset edges are a PAIR. A HALF-edged gf_order=1 row — a
-- winner edge to the reset but NO loser edge — is a brick: if side B wins, the loser (the WB champion) is
-- dropped with nowhere to go and the reset stalls `declared` forever. The winners arm requires BOTH edges;
-- so must this one. (Not reachable via generateBracket(), which always emits both — this pins the DB-level
-- backstop against a hand-built RPC payload, which is the constraint's whole charter.)
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order,
                        winner_to_bracket, winner_to_slot, winner_to_gf_order, winner_to_side)
       values (pg_temp.tid('TCHK'), 'grand_final', 'GF (half-edged)', 4, 1,
               'grand_final', 0, 2, 'b') $$,
  '23514', 'new row for relation "match" violates check constraint "match_routing_complete"',
  'AC1/AD-21: an ASYMMETRIC gf_order=1 row (a winner reset edge but NO loser edge) is REFUSED — the reset edges are BOTH-or-NEITHER, exactly as the winners arm requires both');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B (TGFA) — AC2: side A (the Winners champion) wins game 1 -> NO reset (5)
-- ════════════════════════════════════════════════════════════════════════════
-- gf_order=1's competitor_a is ALWAYS the Winners champion (0 losses). If THEY win, they are undefeated ->
-- champion outright. The AD-21 conditional crowns them and follows NEITHER reset edge.
update match
   set competitor_a = pg_temp.re('TGFA', 1), competitor_b = pg_temp.re('TGFA', 2),
       state = 'resolved', winner_entry = pg_temp.re('TGFA', 1)          -- side A wins
 where id = pg_temp.mid('TGFA', 'grand_final', 0, 1);

insert into rpc_log values
  ('gfa', public.advance_match(pg_temp.mid('TGFA', 'grand_final', 0, 1), '76561197960287930'));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'gfa'), true,
  'AC2: advancing gf_order=1 after side A wins SUCCEEDS');
select is((select (r->>'advanced')::int from rpc_log where tag = 'gfa'), 0,
  'AC2 ⭐ advanced = 0: side A is the undefeated Winners champion, so the AD-21 conditional crowns them and follows NEITHER reset edge — no reset');
select is((select (r->>'champion')::bigint from rpc_log where tag = 'gfa'), pg_temp.re('TGFA', 1),
  'AC2: the champion is side A (competitor_a), reported as a distinct POSITIVE outcome');
select ok(
  (select competitor_a is null and competitor_b is null and winner_entry is null and state = 'declared'
     from match where id = pg_temp.mid('TGFA', 'grand_final', 0, 2)),
  'AC2 ⭐ the reset row (gf_order=2) is STILL empty and `declared` — side A winning outright never seats it');
select is((select final_match_id from tournament where id = pg_temp.tid('TGFA')), pg_temp.mid('TGFA', 'grand_final', 0, 1),
  'AC2/DECISION A: tournament.final_match_id = the gf_order=1 row (the LAST GF row played — side A won it outright)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B (TRESET) — AC2: side B (the Losers survivor) wins game 1 -> THE RESET (6 + 4 + 1)
-- ════════════════════════════════════════════════════════════════════════════
-- gf_order=1's competitor_b is the Losers survivor (1 loss). Their win hands A its first loss and forces
-- the reset: the winner (B) travels to gf_order=2 side b, the loser (A) to gf_order=2 side a.
update match
   set competitor_a = pg_temp.re('TRESET', 1), competitor_b = pg_temp.re('TRESET', 2),
       state = 'resolved', winner_entry = pg_temp.re('TRESET', 2)        -- side B wins
 where id = pg_temp.mid('TRESET', 'grand_final', 0, 1);

insert into rpc_log values
  ('reset1', public.advance_match(pg_temp.mid('TRESET', 'grand_final', 0, 1), '76561197960287930'));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'reset1'), true,
  'AC2: advancing gf_order=1 after side B wins SUCCEEDS');
select is((select (r->>'advanced')::int from rpc_log where tag = 'reset1'), 2,
  'AC2 ⭐ advanced = 2: side B forced the reset — BOTH competitors are routed into gf_order=2 (winner + loser)');
select is((select r->>'champion' from rpc_log where tag = 'reset1'), null,
  'AC2 ⭐ NO champion yet — the reset must be PLAYED first; gf_order=1 is not terminal when side B wins');
select is((select final_match_id from tournament where id = pg_temp.tid('TRESET')), null::bigint,
  'AC2/DECISION A: final_match_id is still NULL — nobody has been crowned');
select is(pg_temp.comp('TRESET', 'grand_final', 0, 'b', 2), pg_temp.re('TRESET', 2),
  'AC2 ⭐ the reset seats the game-1 WINNER (side B) on the reset''s side b');
select is(pg_temp.comp('TRESET', 'grand_final', 0, 'a', 2), pg_temp.re('TRESET', 1),
  'AC2 ⭐ …and the game-1 LOSER (the WB champion, side A) on the reset''s side a — re-seated for a decider');

-- Now PLAY the reset. Its winner is the champion (terminal edgeless row). Let the WB champion (A) recover.
update match
   set state = 'resolved', winner_entry = pg_temp.re('TRESET', 1)        -- A wins the reset
 where id = pg_temp.mid('TRESET', 'grand_final', 0, 2);

insert into rpc_log values
  ('reset2', public.advance_match(pg_temp.mid('TRESET', 'grand_final', 0, 2), '76561197960287930'));

select is((select (r->>'ok')::boolean from rpc_log where tag = 'reset2'), true,
  'AC2: advancing the resolved gf_order=2 reset row SUCCEEDS');
select is((select (r->>'advanced')::int from rpc_log where tag = 'reset2'), 0,
  'AC2: advanced = 0 — the reset row is terminal (edgeless), its winner is the champion');
select is((select (r->>'champion')::bigint from rpc_log where tag = 'reset2'), pg_temp.re('TRESET', 1),
  'AC2 ⭐ the champion is whoever resolved the LAST GF row (gf_order=2) — here A recovered from the reset');
select is((select final_match_id from tournament where id = pg_temp.tid('TRESET')), pg_temp.mid('TRESET', 'grand_final', 0, 2),
  'AC2/DECISION A: final_match_id now = the gf_order=2 reset row — "the last GF row played"');

-- ⭐⭐ THE FLAGSHIP (AD-21): the champion slot was NEVER overwritten in place. gf_order=1's winner and the
-- champion live on DIFFERENT rows with DIFFERENT winners — which is the entire reason AD-21 uses two rows
-- rather than writing one destination slot twice (the H4 double-route AD-8's guard could not have told from
-- a legitimate reset).
select ok(
  pg_temp.mid('TRESET', 'grand_final', 0, 1) <> pg_temp.mid('TRESET', 'grand_final', 0, 2)
  and (select winner_entry from match where id = pg_temp.mid('TRESET', 'grand_final', 0, 1)) = pg_temp.re('TRESET', 2)
  and (select winner_entry from match where id = pg_temp.mid('TRESET', 'grand_final', 0, 2)) = pg_temp.re('TRESET', 1)
  and pg_temp.re('TRESET', 2) <> pg_temp.re('TRESET', 1),
  'AC2 ⭐⭐ gf_order=1.winner_entry (B) and gf_order=2.winner_entry (the champion, A) are DISTINCT winners on DISTINCT rows — the champion slot was never overwritten in place (AD-21, closing H4)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC3: AD-8 conditional advance applies PER ROW; a replay is an idempotent no-op (3)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log values
  ('reset2_replay', public.advance_match(pg_temp.mid('TRESET', 'grand_final', 0, 2), '76561197960287930'));

select ok(
  (select (r->>'ok')::boolean from rpc_log where tag = 'reset2_replay')
  and (select (r->>'advanced')::int from rpc_log where tag = 'reset2_replay') = 0
  and (select (r->>'champion')::bigint from rpc_log where tag = 'reset2_replay') = pg_temp.re('TRESET', 1),
  'AC3: re-advancing the reset row is an idempotent no-op — same champion, advanced 0, ok true (AD-8 per row)');
select is((select winner_entry from match where id = pg_temp.mid('TRESET', 'grand_final', 0, 2)), pg_temp.re('TRESET', 1),
  'AC3: the replay changed nothing — the reset row''s winner is unchanged (the champion slot is stable)');
select is(pg_temp.audits_for('TRESET', pg_temp.mid('TRESET', 'grand_final', 0, 2)), 2,
  'AC3/D4: the replay DID write a SECOND `advance` audit row — the audit logs admin ACTIONS, not state deltas (a silent double-tap is exactly what AD-8 wants visible)');

select * from finish();
rollback;
