-- supabase/tests/0019_manual_score_test.sql
-- pgTAP proof for migration 0019 (Story 4.8): the manual score override — the manual side of FR-16 (AD-5/AD-23).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   Grant matrix: service_role = true; anon/authenticated = false                                       -> A
--   AC1  THE FORMAT BACKSTOP: manual_resolve on an UNLOCKED match -> format_not_declared (the guard fires
--        first); a raw update to state='manual_resolved' on an unlocked match trips 23514 (the CHECK behind it) -> B
--   AC1  THE PLAIN NO-DEMO MANUAL (flagship): a declared, format-locked, seated match -> manual_resolve(16,14,
--        false) -> score set, score_source='admin_manual', manual_override=false, winner=higher seat,
--        state='manual_resolved', the downstream seat advanced, ONE manual_score audit row (real before/after),
--        ONE match_result timeline_feed entry flagged admin_manual, demo_id still NULL                   -> C
--   AC2  THE EMIT + single-writer: exactly ONE match.manual_resolved per success; a SECOND resolve of the now-
--        manual_resolved match -> not_manual_resolvable; a raw flip manual_resolved -> forfeit/void/bye -> IC904;
--        mark_walkover on a manual_resolved match -> not_awaiting (the real walkover path refuses it too)   -> D
--   AC1  THE TIE + UNDETERMINED + B-WINS: score_a=score_b -> tied; an unseated node -> undetermined; a
--        score_b > score_a resolution -> winner = the b-seat (the `else` branch of the winner CASE)        -> E
--   AC1  ⭐⭐ THE AUDITED OVERRIDE (load-bearing): bind a demo -> `pending` (demo_id set); resolve without the
--        flag -> override_required; WITH it -> success, manual_override=true, ONE manual_score audit row, the
--        demo's stat rows left UNpublished (DECISION E), demo_id still bound, the winner advanced             -> F
--   AC1  ⭐⭐ nothing_to_override + the match_manual_override_audited MUTATION MATRIX: override=true on a no-demo
--        match -> nothing_to_override; a raw admin_manual override with NO audit row -> IC907; the same with a
--        MISMATCHED `after` payload -> IC907; a LATER raw score edit of an already-overridden row -> IC907 (the
--        silent-override hole is closed for service_role — at the transition AND on later edits, AD-5)        -> G
--   AC2  single-writer precedence: manual_resolve on a committed resolved/forfeit/bye -> not_manual_resolvable -> H
--   crown: a manual resolution of the GF-deciding row sets tournament.final_match_id                        -> I
--
-- ⚠ MUTATION-TESTED BY EXECUTION (the standing 4.1–4.7 lesson — deferred-work.md). A manual resolution has
-- several effects and each is a way to be blind. Each defect below was injected into the SHIPPED 0019 objects
-- via create-or-replace against the committed DB, and this file re-run over psql. The counts marked [OBSERVED]
-- were run on 2026-07-19; a green suite after any is a blind suite; fix the test, not the mutation:
--   * neuter the AD-5 override gate (`override_required` -> `if false and …`)  -> [OBSERVED] 2 RED: #24 (F1 override_required
--        gone) + #25 (F2 cascades — the demo-bound match got silently resolved, so the real override is now not_manual_resolvable)
--   * neuter the trigger's audit-row EXISTS (`if false`)                       -> [OBSERVED] 2 RED: #29/#30 (G2 no-audit + G3
--        mismatched-payload raw overrides both COMMIT instead of raising IC907 — the silent-override hole reopens)
--   * skip the advance (`v_adv := {ok:true, advanced:0, champion:null}`)       -> [OBSERVED] 4 RED: #12 (C7 winners/4 seat) +
--        #31 (F8 override winners/4 seat) + #39 (I2 final_match_id crown) + #40 (I3 champion) — every downstream effect vanishes
--   * drop the trigger's `after`-payload match (existence-only EXISTS)         -> [predicted] G3 RED (a mismatched payload passes)
--   * drop the trigger's later-edit WHEN disjunct (B)                          -> [predicted] G4 RED (a raw score
--        rewrite of an ALREADY-overridden row commits instead of raising IC907 — "set once, edit many" reopens)
--   * invert the winner CASE / "always competitor_a"                           -> [predicted] E3 RED (the b-wins probe)
--   * skip the state='manual_resolved' write                                   -> [predicted] C2 + the advance's result gate RED
--   * skip the manual_override=true write on the override branch               -> [predicted] F3 RED + the trigger's WHEN never fires
--   * make not_manual_resolvable a no-op (always proceed)                      -> [predicted] D3/H RED (a terminal gets re-resolved)
--   * skip the timeline_feed insert / skip the emit                            -> [predicted] C11 / D1 RED
-- ⚠ The winner-derivation `else competitor_b` branch is exercised by Section E's b-wins probe (score_b > score_a
--   -> winner = the b-seat): an "always competitor_a" mutation of 0019's winner CASE reddens E3. C6 pins the
--   a-wins direction, E3 the b-wins one — both derivation directions are covered (added at code review 2026-07-19).
--
-- An 8-player field (a power of two — NO structural byes/voids) is used so every driven match is DETERMINED.
-- Binds are driven through 4.6a's REAL bind_match_demo, so the `pending`, demo-bound override shape is genuinely
-- produced. Raw-INSERT probe tournaments isolate the not_manual_resolvable terminal states (TPROBE) and the
-- final_match_id crown (TCROWN) without driving a whole bracket to those states.
--
-- SQLSTATE: IC906 = advance-refused rollback (unreachable in a well-formed bracket, exactly as approve's IC903);
-- IC907 = the override-audit gate (exercised raw in Section G); 23514 = the CHECK backstops (exercised in B/G).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 3 + B 2 + C 11 + D 7 + E 3 + F 8 + G 4 + H 3 + I 3 = 44.
select plan(44);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 8 field players, four tournaments.
--   TMAN   — 8-player bracket. The format backstop + the flagship plain manual + the emit/AC2 + tie/undetermined.
--   TOVR   — 8-player bracket. The ⭐⭐ audited override + nothing_to_override + the IC907 mutation matrix.
--   TPROBE — raw rows in three terminal states (resolved/forfeit/bye), for the not_manual_resolvable AC2 half.
--   TCROWN — a raw grand-final (reset) row, format-locked + seated, for the final_match_id crown branch.
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TMAN'), ('TOVR'), ('TPROBE'), ('TCROWN')) as v(n);

-- TMAN + TOVR roster the 8 players; TPROBE + TCROWN roster 2 (for their raw rows).
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TMAN', 'TOVR');
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 2) as i
 where t.name in ('TPROBE', 'TCROWN');

update tournament set state = 'registration_closed' where name in ('TMAN', 'TOVR');

-- ── Helpers (mirroring 0013/0014/0015/0016/0017/0018 — reuse, never hand-derive) ──
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

create function pg_temp.feed_ct(tgt bigint, et text) returns int language sql stable as $fn$
  select count(*)::int from public.timeline_feed where target_match_id = tgt and entry_type = et
$fn$;

create function pg_temp.msgs(tname text, ev text) returns int language sql stable as $fn$
  select count(*)::int from realtime.messages
   where topic = 'tournament:' || pg_temp.tid(tname)::text and event = ev
$fn$;

create function pg_temp.demo_id(tag text) returns bigint language sql stable as $fn$
  select id from public.demo where demo_sha256 = repeat(tag, 64)
$fn$;

-- The complete 8-player double-elim skeleton (golden snapshot of lib/bracket/generate.ts after Story 4.4;
-- verbatim from 0018_rollback_match_test.sql).
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

-- Generate the two real brackets (as the default superuser, before the role switch — mirrors 0018).
insert into rpc_log
select v.tag,
       public.generate_bracket(pg_temp.tid(v.tag), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds(v.tag, 8), pg_temp.matches8(v.tag))
  from (values ('TMAN'), ('TOVR')) as v(tag);

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'TMAN') <> 15 then
    raise exception 'fixture: TMAN did not commit 15 rows';
  end if;
end $$;

-- ── The TOVR override demo + its parsed stat rows. The players are incidental (a manual score derives the
-- winner from the SEATS, not the demo — bind_match_demo checks only count>0 + non-anomalous, never the seats). ──
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state) values
  (9500, 'demos/9500.dem', 'matchzy', repeat('m', 64), 'pending');
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9500, '76561197960287801', pg_temp.demo_id('m'), 20, 12, 29, 16),
  (9500, '76561197960287802', pg_temp.demo_id('m'), 12, 20, 29, 13);

-- ── TPROBE — three raw rows in the three terminal states manual_resolve must REFUSE (not_manual_resolvable).
-- Winners/losers rows need their routing edges DECLARED (match_routing_complete) but not pointing anywhere real
-- (the CHECK cannot prove an edge points somewhere). resolved needs format_locked; forfeit/bye do not (AD-9). ──
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   competitor_a, competitor_b, winner_entry, format, tie_policy, format_locked,
                   winner_to_bracket, winner_to_slot, winner_to_side,
                   loser_to_bracket, loser_to_slot, loser_to_side)
values
  (pg_temp.tid('TPROBE'), 'winners', 'Winners R1', 90, 'resolved',
   pg_temp.re('TPROBE', 1), pg_temp.re('TPROBE', 2), pg_temp.re('TPROBE', 1), 'mr12', 'ot_mr3', true,
   'winners', 99, 'a', 'losers', 99, 'a'),
  (pg_temp.tid('TPROBE'), 'winners', 'Winners R1', 91, 'forfeit',
   pg_temp.re('TPROBE', 1), pg_temp.re('TPROBE', 2), pg_temp.re('TPROBE', 1), null, null, false,
   'winners', 98, 'a', 'losers', 98, 'a'),
  (pg_temp.tid('TPROBE'), 'winners', 'Winners R1', 92, 'bye',
   pg_temp.re('TPROBE', 1), null, pg_temp.re('TPROBE', 1), null, null, false,
   'winners', 97, 'a', 'losers', 97, 'a');

-- ── TCROWN — a raw declared grand-final (reset) row: format-locked + seated + no demo. A manual resolution of
-- it derives a winner and advance_match crowns them (the reset row is terminal — winner_to is null). This
-- isolates the final_match_id branch without driving a whole bracket to a champion (mirrors 0018's TCROWN). ──
insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order, state,
                   competitor_a, competitor_b, format, tie_policy, format_locked)
values (pg_temp.tid('TCROWN'), 'grand_final', 'Grand Final (reset)', 0, 2, 'declared',
        pg_temp.re('TCROWN', 1), pg_temp.re('TCROWN', 2), 'mr12', 'ot_mr3', true);

-- ⚠ realtime.messages is RANGE-partitioned on inserted_at by a Realtime BACKGROUND JOB, and realtime.send
-- swallows its own errors — a missing partition would make the emit fail SILENTLY. Make the precondition true
-- (0013/0017/0018's pattern) rather than trust the job. Rolled back with everything.
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

-- Everything below runs as SERVICE_ROLE — the sole writer (AD-2). This exercises the grants and is how the RPCs
-- are actually invoked (SECURITY INVOKER wrappers behind requireAdmin).
set local role service_role;

-- Lock TOVR's format now (a real bulk declare). TMAN is DELIBERATELY LEFT UNLOCKED for Section B's backstop.
insert into rpc_log select 'fmtTOVR', public.declare_match_format(pg_temp.tid('TOVR'), null, 'mr12', 'ot_mr3', '76561197960287930', false);

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — the grant matrix (3)
-- ════════════════════════════════════════════════════════════════════════════
select has_function('public'::name, 'manual_resolve_match'::name,
  ARRAY['bigint','integer','integer','text','boolean']::name[],
  'manual_resolve_match(bigint, int, int, text, boolean) exists — approve_match''s manual sibling, callable inside a larger txn');
select ok(
  has_function_privilege('service_role', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE'),
  'A: service_role CAN execute manual_resolve_match (the sole writer, AD-2/AD-8)');
select ok(
  not has_function_privilege('anon', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute manual_resolve_match — the REVOKE bit (a viewer cannot hand-score)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC1 THE FORMAT BACKSTOP (TMAN is still unlocked here) (2)
-- ════════════════════════════════════════════════════════════════════════════
-- The guard returns first (a typed refusal); the CHECK behind it is proven separately by a raw write.
select is(
  (select public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 0), 16, 14, '76561197960287930', false)->>'reason'),
  'format_not_declared',
  'AC1: manual_resolve on an UNLOCKED match -> format_not_declared (the guard fires before the 23514 backstop)');
select throws_ok(
  $$ update public.match
        set score_a = 16, score_b = 14, score_source = 'admin_manual',
            winner_entry = pg_temp.comp('TMAN', 'winners', 0, 'a'), state = 'manual_resolved'
      where id = pg_temp.mid('TMAN', 'winners', 0) $$,
  '23514', null,
  'AC1: a raw update to state=manual_resolved on an unlocked match trips 23514 (match_live_requires_locked_format) — the CHECK is the backstop the guard sits in front of');

-- Now lock TMAN's format for the remaining sections (the real bulk declare).
insert into rpc_log select 'fmtTMAN', public.declare_match_format(pg_temp.tid('TMAN'), null, 'mr12', 'ot_mr3', '76561197960287930', false);

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC1 ⭐ THE PLAIN NO-DEMO MANUAL (flagship): score, advance, log, feed (11)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log select 'manTMAN0', public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 0), 16, 14, '76561197960287930', false);

select is((select (r->>'ok')::boolean from rpc_log where tag = 'manTMAN0'), true,
  'AC1 ⭐ manual_resolve of a declared, format-locked, seated match SUCCEEDS (Live/Declared -> ManualResolved, AD-5)');
select is((select state from match where id = pg_temp.mid('TMAN', 'winners', 0)), 'manual_resolved',
  'AC1 ⭐ the match state is `manual_resolved`');
select ok(
  (select score_a = 16 and score_b = 14 from match where id = pg_temp.mid('TMAN', 'winners', 0)),
  'AC1 ⭐ score_a=16 / score_b=14 — the hand-entered score is the score of record');
select is((select score_source from match where id = pg_temp.mid('TMAN', 'winners', 0)), 'admin_manual',
  'AC1 ⭐ score_source=`admin_manual` (AD-5 single discriminator — this is the hand-entered badge)');
select is((select manual_override from match where id = pg_temp.mid('TMAN', 'winners', 0)), false,
  'AC1 ⭐ manual_override=false — a NO-DEMO match has nothing to override (AD-5''s demo_id-IS-NULL disjunct)');
select is((select winner_entry from match where id = pg_temp.mid('TMAN', 'winners', 0)), pg_temp.comp('TMAN', 'winners', 0, 'a'),
  'AC1 ⭐ winner_entry = the higher-score seat (score_a > score_b -> competitor_a)');
select is(pg_temp.comp('TMAN', 'winners', 4, 'a'), pg_temp.comp('TMAN', 'winners', 0, 'a'),
  'AC1 ⭐ the winner''s downstream seat (Winners R2 side a) is now SEATED — the advance ran (assert the SEAT, the 4.3 lesson)');
select is((select demo_id from match where id = pg_temp.mid('TMAN', 'winners', 0)), null::bigint,
  'AC1 ⭐ demo_id is STILL NULL — a no-demo manual resolution binds nothing');
select is(pg_temp.audit_ct(pg_temp.mid('TMAN', 'winners', 0), 'manual_score'), 1,
  'AC1/AD-17: exactly ONE `manual_score` audit row (who + when) for the resolution');
select ok(
  (select detail->'before'->>'state' = 'declared'
      and detail->'after'->>'state' = 'manual_resolved'
      and (detail->'after'->>'score_a')::int = 16
      and (detail->'after'->>'manual_override')::boolean = false
      and (detail->>'override')::boolean = false
     from audit_log where target_match_id = pg_temp.mid('TMAN', 'winners', 0) and action = 'manual_score'),
  'AC1/AD-17: the manual_score row carries a REAL before/after — before {declared}, after {manual_resolved, 16, override:false}');
select ok(
  pg_temp.feed_ct(pg_temp.mid('TMAN', 'winners', 0), 'match_result') = 1
  and (select detail->>'score_source' = 'admin_manual' and (detail->>'manual_override')::boolean = false
         from timeline_feed where target_match_id = pg_temp.mid('TMAN', 'winners', 0) and entry_type = 'match_result'),
  'AC1/DECISION D: exactly ONE `match_result` timeline_feed entry, flagged score_source=admin_manual / manual_override=false');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — AC2 THE EMIT + single-writer precedence (5)
-- ════════════════════════════════════════════════════════════════════════════
select is(pg_temp.msgs('TMAN', 'match.manual_resolved'), 1,
  'AC2 ⭐ exactly ONE `match.manual_resolved` Broadcast on tournament:<id> per success (minted name, DECISION F — SPINE:230 specifies none)');
select ok(
  (select payload->>'state' = 'manual_resolved' and (payload->>'score_a')::int = 16
      and (payload->>'manual_override')::boolean = false
     from realtime.messages
    where topic = 'tournament:' || pg_temp.tid('TMAN')::text and event = 'match.manual_resolved'),
  'AC2: the emit payload CARRIES the semantic change — the new state + the score (a viewer re-fetches corrected truth)');
select is(
  (select public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 0), 16, 14, '76561197960287930', false)->>'reason'),
  'not_manual_resolvable',
  'AC2 ⭐ a SECOND resolve of the now-`manual_resolved` match -> not_manual_resolvable (a committed manual result is single-writer)');
select throws_ok(
  $$ update public.match set state = 'forfeit' where id = pg_temp.mid('TMAN', 'winners', 0) $$,
  'IC904', null,
  'AC2 ⭐ a raw flip manual_resolved -> forfeit is refused IC904 (AD-23: Resolved and Forfeit cannot coexist)');
select throws_ok(
  $$ update public.match set state = 'void' where id = pg_temp.mid('TMAN', 'winners', 0) $$,
  'IC904', null,
  'AC2 ⭐ …and manual_resolved -> void is refused IC904 too (the other terminal-flip direction)');
select throws_ok(
  $$ update public.match set state = 'bye' where id = pg_temp.mid('TMAN', 'winners', 0) $$,
  'IC904', null,
  'AC2 ⭐ …and manual_resolved -> bye is refused IC904 too — the third terminal-flip direction (Task 4''s enumeration completed)');
-- The REAL walkover command path, not just a raw state flip: mark_walkover reads state first and refuses anything
-- off the grace clock with `not_awaiting` (0015:324) — so a hand-scored match can never be walked over.
select is(
  (select public.mark_walkover(pg_temp.mid('TMAN', 'winners', 0), '76561197960287930', pg_temp.comp('TMAN', 'winners', 0, 'a'))->>'reason'),
  'not_awaiting',
  'AC2 ⭐ the REAL mark_walkover path refuses a manual_resolved match (not_awaiting) — a forfeit cannot coexist with a hand-scored result');

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — AC1 THE TIE + UNDETERMINED guards (2)
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 1), 15, 15, '76561197960287930', false)->>'reason'),
  'tied',
  'AC1: score_a = score_b -> tied (a draw has no winner and cannot advance a double-elim bracket)');
-- Winners R2 slot 4: side a is seated (from winners/0's resolution), side b is still NULL (winners/1 unresolved).
select is(
  (select public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 4), 16, 14, '76561197960287930', false)->>'reason'),
  'undetermined',
  'AC1: an unseated node (one competitor NULL) -> undetermined (no winner to derive)');
-- b-wins — the `else v_m.competitor_b` branch of the winner CASE (0019:273). Every OTHER driven case has
-- score_a > score_b, so this seated, format-locked, no-demo match resolved 14-16 is the ONLY probe that reddens
-- an "always competitor_a" mutation of the derivation. winners/2 is seeded (re 2 vs re 7), untouched until now.
insert into rpc_log select 'manTMAN2b', public.manual_resolve_match(pg_temp.mid('TMAN', 'winners', 2), 14, 16, '76561197960287930', false);
select is((select winner_entry from match where id = pg_temp.mid('TMAN', 'winners', 2)), pg_temp.comp('TMAN', 'winners', 2, 'b'),
  'AC1: score_b > score_a -> winner_entry = the B seat (the `else competitor_b` branch — both derivation directions now covered)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — AC1 ⭐⭐ THE AUDITED OVERRIDE (the load-bearing case): bind -> pending -> override (8)
-- ════════════════════════════════════════════════════════════════════════════
-- Bind a demo to TOVR winners/0 so the match is `pending` with demo_id set — the FR-16 dispute-correction shape.
insert into rpc_log select 'bindOVR0', public.bind_match_demo(pg_temp.mid('TOVR', 'winners', 0), pg_temp.demo_id('m'), '76561197960287930');
do $$ begin
  if (select (r->>'ok')::boolean from rpc_log where tag = 'bindOVR0') is not true then
    raise exception 'fixture: TOVR winners/0 bind did not succeed (reason=%)',
      (select r->>'reason' from rpc_log where tag = 'bindOVR0');
  end if;
end $$;

select is(
  (select public.manual_resolve_match(pg_temp.mid('TOVR', 'winners', 0), 16, 14, '76561197960287930', false)->>'reason'),
  'override_required',
  'AC1 ⭐⭐ a demo is bound and the override flag is OFF -> override_required (discarding a demo-derived score demands the explicit flag — AD-5)');

insert into rpc_log select 'manOVR0', public.manual_resolve_match(pg_temp.mid('TOVR', 'winners', 0), 16, 14, '76561197960287930', true);
select is((select (r->>'ok')::boolean from rpc_log where tag = 'manOVR0'), true,
  'AC1 ⭐⭐ WITH the override flag -> SUCCEEDS (the audited override half of AD-5)');
select ok(
  (select manual_override = true and state = 'manual_resolved'
     from match where id = pg_temp.mid('TOVR', 'winners', 0)),
  'AC1 ⭐⭐ manual_override=true and state=`manual_resolved` on the overridden match');
select ok(
  (select score_source = 'admin_manual' and score_a = 16 and score_b = 14
     from match where id = pg_temp.mid('TOVR', 'winners', 0)),
  'AC1 ⭐⭐ score_source=admin_manual + the hand-entered 16-14 replace the demo-derived score');
select ok(
  pg_temp.audit_ct(pg_temp.mid('TOVR', 'winners', 0), 'manual_score') = 1
  and (select (detail->>'override')::boolean = true and (detail->'after'->>'manual_override')::boolean = true
         from audit_log where target_match_id = pg_temp.mid('TOVR', 'winners', 0) and action = 'manual_score'),
  'AC1 ⭐⭐ exactly ONE `manual_score` audit row, override=true — the PRECONDITION the trigger matched (DECISION C)');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TOVR', 'winners', 0) and status <> 'pending'), 0,
  'AC1 ⭐⭐ the demo''s stat rows are STILL every-one `pending` — an override does NOT publish the demo''s stats (DECISION E)');
select isnt((select demo_id from match where id = pg_temp.mid('TOVR', 'winners', 0)), null,
  'AC1 ⭐⭐ demo_id is STILL bound — the demo stays as evidence (AD-1), the override just discarded its SCORE');
select is(pg_temp.comp('TOVR', 'winners', 4, 'a'), pg_temp.comp('TOVR', 'winners', 0, 'a'),
  'AC1 ⭐⭐ the overridden match''s winner is seated downstream — the advance ran on the manual result too');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — AC1 ⭐⭐ nothing_to_override + the match_manual_override_audited MUTATION MATRIX (3)
-- ════════════════════════════════════════════════════════════════════════════
-- These are the assertions AD-5's audit clause exists for: a raw service_role override with no (or a wrong)
-- audit row is refused, closing the silent-override hole score_source_guard alone leaves open.
select is(
  (select public.manual_resolve_match(pg_temp.mid('TOVR', 'winners', 1), 16, 14, '76561197960287930', true)->>'reason'),
  'nothing_to_override',
  'AC1 ⭐ override=true on a NO-DEMO match -> nothing_to_override (a mis-set flag surfaces an admin mistake)');
-- (a) a raw admin_manual override with NO manual_score audit row -> IC907 (the hole closed for service_role).
select throws_ok(
  $$ update public.match
        set score_source = 'admin_manual', manual_override = true, score_a = 16, score_b = 14,
            winner_entry = pg_temp.comp('TOVR', 'winners', 2, 'a'), state = 'manual_resolved'
      where id = pg_temp.mid('TOVR', 'winners', 2) $$,
  'IC907', null,
  'AC1 ⭐⭐ a raw admin_manual override with NO manual_score audit row -> IC907 (match_manual_override_audited bites service_role)');
-- (b) the same WITH a mismatched `after` payload (wrong score_a) -> IC907 (the row must describe the exact result).
insert into audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
values (pg_temp.tid('TOVR'), '76561197960287930', 'manual_score', pg_temp.mid('TOVR', 'winners', 3),
  jsonb_build_object(
    'after', jsonb_build_object('state', 'manual_resolved', 'score_source', 'admin_manual',
             'score_a', 99, 'score_b', 14, 'winner_entry', pg_temp.comp('TOVR', 'winners', 3, 'a'),
             'manual_override', true),
    'override', true));
select throws_ok(
  $$ update public.match
        set score_source = 'admin_manual', manual_override = true, score_a = 16, score_b = 14,
            winner_entry = pg_temp.comp('TOVR', 'winners', 3, 'a'), state = 'manual_resolved'
      where id = pg_temp.mid('TOVR', 'winners', 3) $$,
  'IC907', null,
  'AC1 ⭐⭐ an admin_manual override whose audit row describes a DIFFERENT score (99 vs 16) -> IC907 (the `after` payload is matched, not just row existence)');
-- (c) a LATER raw score edit of an ALREADY-overridden row (TOVR winners/0 was overridden in Section F). The edit
-- leaves score_source + manual_override untouched, so match_terminal_state_guard ignores it (state stays
-- manual_resolved) and score_source_guard still passes — but the WHEN clause's (B) disjunct re-fires the audit
-- gate, and no manual_score row describes score_a=99, so it is refused IC907. This is the "set once, edit many"
-- hole the trigger hardening closes (code review 2026-07-19); dropping disjunct (B) reddens exactly this.
select throws_ok(
  $$ update public.match set score_a = 99 where id = pg_temp.mid('TOVR', 'winners', 0) $$,
  'IC907', null,
  'AC1 ⭐⭐ a LATER raw score edit of an already-overridden row -> IC907 (the audit-row gate holds on every edit, not just the override transition — set once, edit many closed)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section H — AC2 single-writer precedence: a manual score cannot coexist with a committed result (3)
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select public.manual_resolve_match(pg_temp.mid('TPROBE', 'winners', 90), 16, 14, '76561197960287930', false)->>'reason'),
  'not_manual_resolvable',
  'AC2: manual_resolve on a committed `resolved` (demo) match -> not_manual_resolvable (a hand score cannot coexist with a demo result)');
select is(
  (select public.manual_resolve_match(pg_temp.mid('TPROBE', 'winners', 91), 16, 14, '76561197960287930', false)->>'reason'),
  'not_manual_resolvable',
  'AC2: manual_resolve on a committed `forfeit` match -> not_manual_resolvable (Resolved and Forfeit cannot coexist)');
select is(
  (select public.manual_resolve_match(pg_temp.mid('TPROBE', 'winners', 92), 16, 14, '76561197960287930', false)->>'reason'),
  'not_manual_resolvable',
  'AC2: manual_resolve on a `bye` walkover -> not_manual_resolvable (a bye is a committed, unplayed result)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section I — final_match_id CROWN (TCROWN raw GF-reset probe) (3)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log select 'manCrown', public.manual_resolve_match(pg_temp.mid('TCROWN', 'grand_final', 0, 2), 16, 9, '76561197960287930', false);
select ok(
  (select (r->>'ok')::boolean from rpc_log where tag = 'manCrown')
  and (select state = 'manual_resolved' from match where id = pg_temp.mid('TCROWN', 'grand_final', 0, 2)),
  'crown ⭐ a manual resolution of the GF-deciding row SUCCEEDS and lands manual_resolved');
select is((select final_match_id from tournament where name = 'TCROWN'), pg_temp.mid('TCROWN', 'grand_final', 0, 2),
  'crown ⭐ tournament.final_match_id points at the GF row — the manual result crowned the champion (the inverse of 4.7''s un-crown)');
select is((select (r->>'champion')::bigint from rpc_log where tag = 'manCrown'), pg_temp.comp('TCROWN', 'grand_final', 0, 'a', 2),
  'crown ⭐ the RETURN reports champion = the winner (score_a > score_b -> competitor_a)');

select * from finish();
rollback;
