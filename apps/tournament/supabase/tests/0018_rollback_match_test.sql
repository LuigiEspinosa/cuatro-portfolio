-- supabase/tests/0018_rollback_match_test.sql
-- pgTAP proof for migration 0018 (Story 4.7): the atomic rollback of an Approved match (FR-14 / AD-8).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC1  THE ATOMIC REVERT (flagship): approve M, then rollback_match(M) — every stat_row -> pending
--        (+ approved_at/approved_by cleared); score/winner/source NULL; state='pending'; the winner's
--        downstream seat un-seated; the loser's Losers seat un-seated; ONE `rollback` audit row with a real
--        before/after + the reverted plan; demo_id STILL bound (re-approvable)                          -> B
--   AC2  THE EMIT + IDEMPOTENCY: exactly ONE match.rolled_back per success; a SECOND rollback is not_resolved
--        (nothing written, no second audit row, no second emit); a never-approved pending -> not_resolved;
--        a bad id -> bad_match                                                                          -> C
--   AC1  RE-APPROVABLE ROUND-TRIP: after a clean rollback, approve_match(M) SUCCEEDS again (resolved ->
--        pending -> resolved) — proving `pending` is genuinely re-approvable (DECISION A)               -> D
--   AC1  ⭐⭐ THE AD-8 FLAG (the single most important assertion): approve M (winner seated into D), drive D to
--        its OWN resolved on its own demo, then rollback_match(M) -> REFUSED downstream_active; `blocking`
--        lists D; NOTHING reverted or unpublished; zero emit                                            -> E
--   AC1  THE TRANSITIVE WALKOVER CASCADE: on an 11-player field, approve a match whose loser dropped through a
--        `bye` Losers node and cascaded; roll back and assert EVERY node un-walked (winner_entry back to NULL,
--        downstream seats NULL) — the transitive half                                                   -> F
--   AC1  ⭐⭐ THE AD-8 FLAG over a FORFEIT downstream (code review 2026-07-19): approve into D, drive D to a
--        committed `forfeit` (Story 4.5 grace->walkover), then rollback the upstream -> REFUSED
--        downstream_active. `forfeit` is the OTHER advanceable committed state Section E's `resolved` case
--        does not cover; the pre-patch denylist forgot it                                                -> H
--   un-crown: roll back a GF-deciding row -> tournament.final_match_id is NULL again                    -> G
--   Grant matrix: service_role = true; anon/authenticated = false                                       -> A
--
-- ⚠ MUTATION-TESTED BY EXECUTION (the standing 4.1/4.2/4.3/4.6b lesson — deferred-work.md:141). A rollback has
-- several effects and each is a way to be blind. Each defect below was injected into the SHIPPED rollback_match
-- body, the function re-applied via create-or-replace, and this file re-run. The counts are OBSERVED
-- (2026-07-18), not inferred — a green suite after any is a blind suite; fix the test, not the mutation:
--   * neuter the AD-8 flag (`if false and …`)             -> Section E RED (the downstream_active refusal vanishes; M gets unpublished)
--   * skip the pass-2 un-seat (empty the plan loop)       -> B6/B7 + F3/F4/F6 RED (downstream seats stay seated)
--   * skip the walkover winner_entry clear                -> F5 RED (the bye node stays crowned)
--   * drop the transitive continuation (never enqueue)    -> F6 RED (the cascade's second hop is not un-seated)
--   * skip the stat-status flip (STEP 5b)                 -> B4/B5 RED (rows stay approved)
--   * skip the score/state clear (STEP 5a)                -> B2/B3 + D RED (still resolved; re-approve fails not_pending)
--   * skip the final_match_id clear (STEP 5c)             -> G1/G2 RED (champion stays crowned)
--   * make not_resolved a no-op (always proceed)          -> C3/C4 RED (a second rollback double-writes)
--   * restore the pre-patch denylist flag (state in       -> Section H RED (a `forfeit` downstream is no longer
--     resolved/manual_resolved/pending/live/awaiting_grace)   flagged; rollback un-seats it / winners/0 unpublishes)
--
-- An 8-player field (a power of two — NO structural byes/voids) is used for the happy/flag paths so every driven
-- match is DETERMINED; an 11-player field (bracketSize 16, 5 byes) drives the walkover cascade (its skeleton is
-- the golden snapshot generate_bracket accepts today — never hand-fixtured). Binds are driven through 4.6a's
-- REAL bind_match_demo and approvals through 4.6b's REAL approve_match, so the `resolved` state rolled back is
-- genuinely produced. A raw-INSERT TCROWN tournament isolates the final_match_id un-crown branch.
--
-- SQLSTATE: IC905 = rollback_match's own raises (hop-cap cycle / pass-2 lock-invariant) — genuine corruption,
-- not exercised here (they are unreachable in a well-formed bracket, exactly as advance_match's bare raises are).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 3 + B 11 + C 8 + D 2 + E 9 + F 8 + G 3 + H 6 = 50.
select plan(50);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 11 field players, five tournaments.
--   TAP    — 8-player bracket. The flagship revert + the emit/idempotency + the re-approvable round-trip.
--   TFLAG  — 8-player bracket. The ⭐⭐ AD-8 downstream flag over a `resolved` downstream (its own bracket).
--   TFORF  — 8-player bracket. The ⭐⭐ AD-8 downstream flag over a `forfeit` downstream (code review 2026-07-19).
--   TCASC  — 11-player bracket. The transitive walkover cascade.
--   TCROWN — no bracket: a raw resolved grand-final row + final_match_id, for the un-crown branch.
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 11) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TAP'), ('TFLAG'), ('TFORF'), ('TCASC'), ('TCROWN')) as v(n);

-- TAP + TFLAG + TFORF roster the first 8 players; TCASC rosters all 11; TCROWN rosters 2 (for the raw GF row).
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TAP', 'TFLAG', 'TFORF');
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 11) as i
 where t.name = 'TCASC';
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 2) as i
 where t.name = 'TCROWN';

update tournament set state = 'registration_closed' where name in ('TAP', 'TFLAG', 'TFORF', 'TCASC');

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

create function pg_temp.comp(tname text, br text, slot int, side text, gf int default 0) returns bigint language sql stable as $fn$
  select case when side = 'a' then m.competitor_a else m.competitor_b end
    from public.match m join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = br and m.bracket_slot = slot
     and coalesce(m.gf_order, 0) = coalesce(gf, 0)
$fn$;

create function pg_temp.audit_ct(tgt bigint, act text) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt and action = act
$fn$;

create function pg_temp.msgs(tname text, ev text) returns int language sql stable as $fn$
  select count(*)::int from realtime.messages
   where topic = 'tournament:' || pg_temp.tid(tname)::text and event = ev
$fn$;

create function pg_temp.demo_id(tag text) returns bigint language sql stable as $fn$
  select id from public.demo where demo_sha256 = repeat(tag, 64)
$fn$;

-- The complete 8-player double-elim skeleton (golden snapshot of lib/bracket/generate.ts after Story 4.4).
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

-- The REAL 11-player skeleton (a golden snapshot of generateBracket()'s output — bracketSize 16, 5 byes;
-- 15 winners + 14 losers + 2 GF = 31 rows). Verbatim from 0013_advance_test.sql:192-232 (post-4.4). The
-- walkover cascade lives in the losers block: losers/0 = 'bye' <- fed by W-R1 s0 (a bye: NO loser) and W-R1 s1
-- (a real match: ONE loser arrives), so a loser dropping into losers/0 wins it unplayed and cascades onward.
create function pg_temp.matches11(t text) returns jsonb language sql stable as $fn$
  select jsonb_agg(jsonb_build_object(
           'bracket', v.b, 'bracket_position', v.p, 'bracket_slot', v.sl, 'gf_order', v.gf,
           'competitor_a', v.ca, 'competitor_b', v.cb, 'winner_entry', v.we, 'state', v.st,
           'winner_to', v.wt, 'loser_to', v.lt))
    from (values
      ('winners', 'Winners R1', 0, null::int, pg_temp.re(t, 1), null::bigint, pg_temp.re(t, 1), 'bye', pg_temp.edge('winners', 8, null, 'a'), pg_temp.edge('losers', 0, null, 'a')),
      ('winners', 'Winners R1', 1, null::int, pg_temp.re(t, 8), pg_temp.re(t, 9), null::bigint, 'declared', pg_temp.edge('winners', 8, null, 'b'), pg_temp.edge('losers', 0, null, 'b')),
      ('winners', 'Winners R1', 2, null::int, pg_temp.re(t, 4), null::bigint, pg_temp.re(t, 4), 'bye', pg_temp.edge('winners', 9, null, 'a'), pg_temp.edge('losers', 1, null, 'a')),
      ('winners', 'Winners R1', 3, null::int, pg_temp.re(t, 5), null::bigint, pg_temp.re(t, 5), 'bye', pg_temp.edge('winners', 9, null, 'b'), pg_temp.edge('losers', 1, null, 'b')),
      ('winners', 'Winners R1', 4, null::int, pg_temp.re(t, 2), null::bigint, pg_temp.re(t, 2), 'bye', pg_temp.edge('winners', 10, null, 'a'), pg_temp.edge('losers', 2, null, 'a')),
      ('winners', 'Winners R1', 5, null::int, pg_temp.re(t, 7), pg_temp.re(t, 10), null::bigint, 'declared', pg_temp.edge('winners', 10, null, 'b'), pg_temp.edge('losers', 2, null, 'b')),
      ('winners', 'Winners R1', 6, null::int, pg_temp.re(t, 3), null::bigint, pg_temp.re(t, 3), 'bye', pg_temp.edge('winners', 11, null, 'a'), pg_temp.edge('losers', 3, null, 'a')),
      ('winners', 'Winners R1', 7, null::int, pg_temp.re(t, 6), pg_temp.re(t, 11), null::bigint, 'declared', pg_temp.edge('winners', 11, null, 'b'), pg_temp.edge('losers', 3, null, 'b')),
      ('winners', 'Winners R2', 8, null::int, pg_temp.re(t, 1), null::bigint, null::bigint, 'declared', pg_temp.edge('winners', 12, null, 'a'), pg_temp.edge('losers', 5, null, 'b')),
      ('winners', 'Winners R2', 9, null::int, pg_temp.re(t, 4), pg_temp.re(t, 5), null::bigint, 'declared', pg_temp.edge('winners', 12, null, 'b'), pg_temp.edge('losers', 4, null, 'b')),
      ('winners', 'Winners R2', 10, null::int, pg_temp.re(t, 2), null::bigint, null::bigint, 'declared', pg_temp.edge('winners', 13, null, 'a'), pg_temp.edge('losers', 7, null, 'b')),
      ('winners', 'Winners R2', 11, null::int, pg_temp.re(t, 3), null::bigint, null::bigint, 'declared', pg_temp.edge('winners', 13, null, 'b'), pg_temp.edge('losers', 6, null, 'b')),
      ('winners', 'Winners R3', 12, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('winners', 14, null, 'a'), pg_temp.edge('losers', 11, null, 'b')),
      ('winners', 'Winners R3', 13, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('winners', 14, null, 'b'), pg_temp.edge('losers', 10, null, 'b')),
      ('winners', 'Winners R4', 14, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('grand_final', 0, 1, 'a'), pg_temp.edge('losers', 13, null, 'b')),
      ('losers', 'Losers R1', 0, null::int, null::bigint, null::bigint, null::bigint, 'bye', pg_temp.edge('losers', 4, null, 'a'), null::jsonb),
      ('losers', 'Losers R1', 1, null::int, null::bigint, null::bigint, null::bigint, 'void', pg_temp.edge('losers', 5, null, 'a'), null::jsonb),
      ('losers', 'Losers R1', 2, null::int, null::bigint, null::bigint, null::bigint, 'bye', pg_temp.edge('losers', 6, null, 'a'), null::jsonb),
      ('losers', 'Losers R1', 3, null::int, null::bigint, null::bigint, null::bigint, 'bye', pg_temp.edge('losers', 7, null, 'a'), null::jsonb),
      ('losers', 'Losers R2', 4, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 8, null, 'a'), null::jsonb),
      ('losers', 'Losers R2', 5, null::int, null::bigint, null::bigint, null::bigint, 'bye', pg_temp.edge('losers', 8, null, 'b'), null::jsonb),
      ('losers', 'Losers R2', 6, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 9, null, 'a'), null::jsonb),
      ('losers', 'Losers R2', 7, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 9, null, 'b'), null::jsonb),
      ('losers', 'Losers R3', 8, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 10, null, 'a'), null::jsonb),
      ('losers', 'Losers R3', 9, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 11, null, 'a'), null::jsonb),
      ('losers', 'Losers R4', 10, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 12, null, 'a'), null::jsonb),
      ('losers', 'Losers R4', 11, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 12, null, 'b'), null::jsonb),
      ('losers', 'Losers R5', 12, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('losers', 13, null, 'a'), null::jsonb),
      ('losers', 'Losers R6', 13, null::int, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('grand_final', 0, 1, 'b'), null::jsonb),
      ('grand_final', 'Grand Final', 0, 1, null::bigint, null::bigint, null::bigint, 'declared', pg_temp.edge('grand_final', 0, 2, 'b'), pg_temp.edge('grand_final', 0, 2, 'a')),
      ('grand_final', 'Grand Final (reset)', 0, 2, null::bigint, null::bigint, null::bigint, 'declared', null::jsonb, null::jsonb)
    ) as v(b, p, sl, gf, ca, cb, we, st, wt, lt)
$fn$;

create temp table rpc_log (tag text primary key, r jsonb);
grant select, insert on rpc_log to service_role;

-- Generate the three real brackets (as the default superuser, before the role switch — mirrors 0017).
insert into rpc_log
select v.tag,
       public.generate_bracket(pg_temp.tid(v.tag), '76561197960287930',
                               '{"algorithm":"fisher-yates"}'::jsonb,
                               pg_temp.seeds(v.tag, v.n), v.m)
  from (values ('TAP', 8, pg_temp.matches8('TAP')),
               ('TFLAG', 8, pg_temp.matches8('TFLAG')),
               ('TFORF', 8, pg_temp.matches8('TFORF')),
               ('TCASC', 11, pg_temp.matches11('TCASC'))) as v(tag, n, m);

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'TAP') <> 15 then
    raise exception 'fixture: TAP did not commit 15 rows';
  end if;
  if (select (r->>'match_count')::int from rpc_log where tag = 'TCASC') <> 31 then
    raise exception 'fixture: TCASC did not commit 31 rows';
  end if;
end $$;

-- ── The demos + their parsed stat rows (the FR-16 tally rides stat_row.rounds_won) ──
-- All seats are (…78NN). D-tags name the tournament + slot. matchzy ids are cosmetic here.
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state) values
  (9101, 'demos/9101.dem', 'matchzy', repeat('a', 64), 'pending'),  -- TAP winners/0: …01 vs …08, a wins 16-13
  (9102, 'demos/9102.dem', 'matchzy', repeat('b', 64), 'pending'),  -- TAP winners/1: …04 vs …05 (bound-only, for the never-approved-pending probe)
  (9201, 'demos/9201.dem', 'matchzy', repeat('c', 64), 'pending'),  -- TFLAG winners/0: …01 vs …08, a wins
  (9202, 'demos/9202.dem', 'matchzy', repeat('d', 64), 'pending'),  -- TFLAG winners/1: …04 vs …05, a wins
  (9204, 'demos/9204.dem', 'matchzy', repeat('e', 64), 'pending'),  -- TFLAG winners/4: …01 vs …04, a wins
  (9301, 'demos/9301.dem', 'matchzy', repeat('f', 64), 'pending'),  -- TCASC W-R1 s1: …08 vs …09, a (…08) wins
  (9401, 'demos/9401.dem', 'matchzy', repeat('g', 64), 'pending'),  -- TFORF winners/0: …01 vs …08, a wins
  (9402, 'demos/9402.dem', 'matchzy', repeat('h', 64), 'pending');  -- TFORF winners/1: …04 vs …05, a wins

-- D 9101: TAP winners/0 (a=…01 wins 16, b=…08 wins 13).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9101, '76561197960287801', pg_temp.demo_id('a'), 20, 12, 29, 16),
  (9101, '76561197960287808', pg_temp.demo_id('a'), 12, 20, 29, 13);
-- D 9102: TAP winners/1 seats (…04/…05) — bound only, scores incidental.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9102, '76561197960287804', pg_temp.demo_id('b'), 16, 10, 26, 16),
  (9102, '76561197960287805', pg_temp.demo_id('b'), 10, 16, 26, 10);
-- D 9201: TFLAG winners/0 (a=…01 wins).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9201, '76561197960287801', pg_temp.demo_id('c'), 20, 12, 29, 16),
  (9201, '76561197960287808', pg_temp.demo_id('c'), 12, 20, 29, 13);
-- D 9202: TFLAG winners/1 (a=…04 wins).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9202, '76561197960287804', pg_temp.demo_id('d'), 16, 10, 26, 16),
  (9202, '76561197960287805', pg_temp.demo_id('d'), 10, 16, 26, 10);
-- D 9204: TFLAG winners/4 (seats …01 [from winners/0] + …04 [from winners/1]; a=…01 wins).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9204, '76561197960287801', pg_temp.demo_id('e'), 16,  8, 24, 16),
  (9204, '76561197960287804', pg_temp.demo_id('e'),  8, 16, 24,  8);
-- D 9301: TCASC W-R1 s1 (a=…08 wins 16, b=…09 loses 9 — the loser …09 drops into the losers/0 bye cascade).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9301, '76561197960287808', pg_temp.demo_id('f'), 18, 11, 25, 16),
  (9301, '76561197960287809', pg_temp.demo_id('f'), 11, 18, 25,  9);
-- D 9401: TFORF winners/0 (a=…01 wins) — seats …01 into winners/4 side a.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9401, '76561197960287801', pg_temp.demo_id('g'), 20, 12, 29, 16),
  (9401, '76561197960287808', pg_temp.demo_id('g'), 12, 20, 29, 13);
-- D 9402: TFORF winners/1 (a=…04 wins) — seats …04 into winners/4 side b (so winners/4 is a DETERMINED matchup).
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9402, '76561197960287804', pg_temp.demo_id('h'), 16, 10, 26, 16),
  (9402, '76561197960287805', pg_temp.demo_id('h'), 10, 16, 26, 10);

-- ── Lock the formats through the REAL RPC (0016's fixture note: match_format_audited refuses a raw latch) ──
set local role service_role;
insert into rpc_log select 'fmtTAP',   public.declare_match_format(pg_temp.tid('TAP'),   null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log select 'fmtTFLAG', public.declare_match_format(pg_temp.tid('TFLAG'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log select 'fmtTFORF', public.declare_match_format(pg_temp.tid('TFORF'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log select 'fmtTCASC', public.declare_match_format(pg_temp.tid('TCASC'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
set local role postgres;

-- ── The raw resolved GF row for TCROWN (the un-crown probe). A scoreless demo-less `resolved` row is
-- structurally valid (score_source_guard passes on all-null; match_live_requires_locked_format needs only
-- format_locked), so it isolates the final_match_id branch without driving a whole bracket to a champion. ──
insert into match (tournament_id, bracket, bracket_position, bracket_slot, gf_order, state,
                   competitor_a, competitor_b, winner_entry, format, tie_policy, format_locked)
values (pg_temp.tid('TCROWN'), 'grand_final', 'Grand Final (reset)', 0, 2, 'resolved',
        pg_temp.re('TCROWN', 1), pg_temp.re('TCROWN', 2), pg_temp.re('TCROWN', 1), 'mr12', 'ot_mr3', true);
update tournament set final_match_id = pg_temp.mid('TCROWN', 'grand_final', 0, 2) where name = 'TCROWN';

-- ⚠ realtime.messages is RANGE-partitioned on inserted_at by a Realtime BACKGROUND JOB, and realtime.send
-- swallows its own errors — a missing partition would make the emit fail SILENTLY. Make the precondition true
-- (0013/0017's pattern) rather than trust the job. Rolled back with everything.
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

-- Everything below runs as SERVICE_ROLE — the sole writer (AD-2). This exercises the grants and is how the
-- RPCs are actually invoked (SECURITY INVOKER wrappers behind requireAdmin).
set local role service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — the grant matrix (3)
-- ════════════════════════════════════════════════════════════════════════════
select has_function('public'::name, 'rollback_match'::name, ARRAY['bigint','text']::name[],
  'rollback_match(bigint, text) exists — the inverse of approve_match, callable inside a re-parse-republish txn');
select ok(
  has_function_privilege('service_role', 'public.rollback_match(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute rollback_match (the sole writer, AD-2/AD-8)');
select ok(
  not has_function_privilege('anon', 'public.rollback_match(bigint, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.rollback_match(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute rollback_match — the REVOKE bit (a viewer cannot roll back)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC1 ⭐ THE ATOMIC REVERT (flagship): approve then rollback, whole publish undone (11)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log select 'bindTAP0', public.bind_match_demo(pg_temp.mid('TAP', 'winners', 0), pg_temp.demo_id('a'), '76561197960287930');
insert into rpc_log select 'apTAP0', public.approve_match(pg_temp.mid('TAP', 'winners', 0), '76561197960287930');
do $$ begin
  if (select (r->>'ok')::boolean from rpc_log where tag = 'apTAP0') is not true then
    raise exception 'fixture: TAP winners/0 approve did not succeed (reason=%)',
      (select r->>'reason' from rpc_log where tag = 'apTAP0');
  end if;
end $$;

-- Bind TAP winners/1 too (pending, NOT approved) — the never-approved-pending probe used in Section C.
insert into rpc_log select 'bindTAP1', public.bind_match_demo(pg_temp.mid('TAP', 'winners', 1), pg_temp.demo_id('b'), '76561197960287930');

insert into rpc_log select 'rbTAP0', public.rollback_match(pg_temp.mid('TAP', 'winners', 0), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'rbTAP0'), true,
  'AC1 ⭐ rollback_match on the Approved match SUCCEEDS');
select is((select state from match where id = pg_temp.mid('TAP', 'winners', 0)), 'pending',
  'AC1 ⭐ the match state is back to `pending` (Resolved -> Pending: rollback, DECISION A)');
select ok(
  (select score_a is null and score_b is null and score_source is null and winner_entry is null
     from match where id = pg_temp.mid('TAP', 'winners', 0)),
  'AC1 ⭐ score_a/score_b/score_source/winner_entry are ALL null — the demo-derived score was un-published');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TAP', 'winners', 0) and status <> 'pending'), 0,
  'AC1 ⭐ every stat_row for the match flipped back to `pending` — ZERO left non-pending (this IS FR-14''s leaderboard removal)');
select is(
  (select count(*)::int from stat_row
     where match_id = pg_temp.mid('TAP', 'winners', 0)
       and (approved_at is not null or approved_by is not null)), 0,
  'AC1 ⭐ approved_at / approved_by were cleared on every row (the who/when of the undone approval)');
select is(pg_temp.comp('TAP', 'winners', 4, 'a'), null::bigint,
  'AC1 ⭐ the winner''s downstream seat (Winners R2 side a) is now NULL — the dependent advance was REVERTED (assert the SEAT, the 4.3 lesson)');
select is(pg_temp.comp('TAP', 'losers', 0, 'a'), null::bigint,
  'AC1 ⭐ the loser''s Losers seat (Losers R1 side a) is now NULL — the loser drop was reverted too');
select isnt((select demo_id from match where id = pg_temp.mid('TAP', 'winners', 0)), null,
  'AC1 ⭐ demo_id is STILL bound — the demo is evidence (AD-1); the match is re-approvable, unbinding is not rollback''s job');
select is(pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 0), 'rollback'), 1,
  'AC1/AD-17: exactly ONE `rollback` audit row (who + when) for the rollback');
select ok(
  (select detail->'before'->>'state' = 'resolved'
      and (detail->'before'->>'score_a')::int = 16
      and detail->'after'->>'state' = 'pending'
      and detail->'after'->>'score_a' is null
      and (detail->>'stat_rows_unpublished')::int = 2
      and jsonb_array_length(detail->'reverted') = 2
     from audit_log where target_match_id = pg_temp.mid('TAP', 'winners', 0) and action = 'rollback'),
  'AC1/AD-17: the rollback row carries a REAL before/after — before {resolved, 16}, after {pending, null}, rows-unpublished=2, and the 2-item reverted plan');
select is(
  (select jsonb_array_length(r->'reverted') from rpc_log where tag = 'rbTAP0'), 2,
  'AC1 ⭐ the RETURN reports the two reverted advances (the winner seat + the loser drop)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC2 ⭐ THE EMIT + IDEMPOTENCY (8)
-- ════════════════════════════════════════════════════════════════════════════
select is(pg_temp.msgs('TAP', 'match.rolled_back'), 1,
  'AC2 ⭐ exactly ONE `match.rolled_back` Broadcast on tournament:<id> per successful rollback (minted name, DECISION G — SPINE:230 specifies none)');
select ok(
  (select payload->>'state' = 'pending' and jsonb_array_length(payload->'reverted') = 2
     from realtime.messages
    where topic = 'tournament:' || pg_temp.tid('TAP')::text and event = 'match.rolled_back'),
  'AC2: the emit payload CARRIES the semantic change — the new `pending` state + the reverted plan (a viewer re-fetches corrected truth)');

-- Idempotency: a SECOND rollback of the now-`pending` match is refused, writes nothing, emits nothing.
insert into rpc_log select 'rbTAP0b', public.rollback_match(pg_temp.mid('TAP', 'winners', 0), '76561197960287930');
select is((select r->>'reason' from rpc_log where tag = 'rbTAP0b'), 'not_resolved',
  'AC2 ⭐ a SECOND rollback of the now-`pending` match returns not_resolved (idempotent — re-applying is a clean no-op)');
select is(pg_temp.audit_ct(pg_temp.mid('TAP', 'winners', 0), 'rollback'), 1,
  'AC2 ⭐ the refused second rollback wrote NO second audit row — still exactly ONE (a green here after neutering not_resolved is a blind suite)');
select is(pg_temp.msgs('TAP', 'match.rolled_back'), 1,
  'AC2 ⭐ …and NO second emit — still exactly ONE match.rolled_back');
select ok(
  (select state = 'pending' from match where id = pg_temp.mid('TAP', 'winners', 0))
  and pg_temp.comp('TAP', 'winners', 4, 'a') is null,
  'AC2: the refused second rollback changed NOTHING — still pending, the downstream seat still NULL');

-- not_resolved on a never-approved `pending` match (winners/1 was bound but never approved).
select is((select public.rollback_match(pg_temp.mid('TAP', 'winners', 1), '76561197960287930')->>'reason'), 'not_resolved',
  'AC2: rollback on a never-approved `pending` match (bound, not published) -> not_resolved — there is nothing to unpublish');
-- bad_match on a non-existent id.
select is((select public.rollback_match(999999999, '76561197960287930')->>'reason'), 'bad_match',
  'AC2: rollback on a non-existent match -> bad_match');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — AC1 ⭐ THE RE-APPROVABLE ROUND-TRIP: resolved -> pending -> resolved (2)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log select 'reapTAP0', public.approve_match(pg_temp.mid('TAP', 'winners', 0), '76561197960287930');
select is((select (r->>'ok')::boolean from rpc_log where tag = 'reapTAP0'), true,
  'AC1 ⭐ approve_match SUCCEEDS again after the rollback — proving `pending` is genuinely re-approvable (DECISION A pins the target state)');
select ok(
  (select state = 'resolved' from match where id = pg_temp.mid('TAP', 'winners', 0))
  and pg_temp.comp('TAP', 'winners', 4, 'a') = pg_temp.re('TAP', 1),
  'AC1 ⭐ the round-trip closed: state `resolved` again and the winner is re-seated downstream (resolved -> pending -> resolved)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — AC1 ⭐⭐ THE AD-8 FLAG (the single most important assertion): refuse, never cascade (9)
-- ════════════════════════════════════════════════════════════════════════════
-- Drive TFLAG: approve winners/0 (winner …01 -> winners/4 side a) + winners/1 (winner …04 -> winners/4 side b),
-- then approve winners/4 on its OWN demo -> resolved. Now rollback winners/0 must REFUSE (winners/4 stands on
-- its own demo, AD-8) and change nothing.
insert into rpc_log select 'bindF0', public.bind_match_demo(pg_temp.mid('TFLAG', 'winners', 0), pg_temp.demo_id('c'), '76561197960287930');
insert into rpc_log select 'bindF1', public.bind_match_demo(pg_temp.mid('TFLAG', 'winners', 1), pg_temp.demo_id('d'), '76561197960287930');
insert into rpc_log select 'apF0', public.approve_match(pg_temp.mid('TFLAG', 'winners', 0), '76561197960287930');
insert into rpc_log select 'apF1', public.approve_match(pg_temp.mid('TFLAG', 'winners', 1), '76561197960287930');
insert into rpc_log select 'bindF4', public.bind_match_demo(pg_temp.mid('TFLAG', 'winners', 4), pg_temp.demo_id('e'), '76561197960287930');
insert into rpc_log select 'apF4', public.approve_match(pg_temp.mid('TFLAG', 'winners', 4), '76561197960287930');
do $$ begin
  if (select (r->>'ok')::boolean from rpc_log where tag = 'apF4') is not true then
    raise exception 'fixture: TFLAG winners/4 approve did not succeed (state=%)',
      (select r->>'reason' from rpc_log where tag = 'apF4');
  end if;
end $$;

insert into rpc_log select 'rbF0', public.rollback_match(pg_temp.mid('TFLAG', 'winners', 0), '76561197960287930');

select is((select r->>'reason' from rpc_log where tag = 'rbF0'), 'downstream_active',
  'AC1 ⭐⭐ rollback of winners/0 is REFUSED `downstream_active` — its winner''s seat is held by winners/4, which stands on its OWN demo (AD-8)');
select ok(
  (select (b->>'match_id')::bigint = pg_temp.mid('TFLAG', 'winners', 4) and b->>'state' = 'resolved'
     from jsonb_array_elements((select r->'blocking' from rpc_log where tag = 'rbF0')) as b),
  'AC1 ⭐⭐ `blocking` names winners/4 (state resolved) — the admin is told exactly which downstream to roll back first (leaf-first)');
select is((select state from match where id = pg_temp.mid('TFLAG', 'winners', 0)), 'resolved',
  'AC1 ⭐⭐ NOTHING was unpublished — winners/0 is STILL `resolved` (the refusal wrote nothing)');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TFLAG', 'winners', 0) and status <> 'approved'), 0,
  'AC1 ⭐⭐ winners/0''s stat rows are STILL every-one `approved` — the refusal did not touch them');
select is((select state from match where id = pg_temp.mid('TFLAG', 'winners', 4)), 'resolved',
  'AC1 ⭐⭐ the downstream winners/4 is UNTOUCHED — still `resolved` (AD-8''s named hazard, "silently un-publishing unrelated matches", did NOT happen)');
select is(pg_temp.comp('TFLAG', 'winners', 4, 'a'), pg_temp.re('TFLAG', 1),
  'AC1 ⭐⭐ winners/4 side a STILL holds winners/0''s winner — the seat was NOT un-seated by the refused rollback');
select is(pg_temp.comp('TFLAG', 'losers', 0, 'a'), pg_temp.re('TFLAG', 8),
  'AC1 ⭐⭐ even the auto-revertable loser drop (Losers R1 side a) was left ALONE — a flagged rollback reverts NOTHING (two-pass: refuse before any write)');
select is(pg_temp.msgs('TFLAG', 'match.rolled_back'), 0,
  'AC2 ⭐ ZERO match.rolled_back on a REFUSED rollback (the emit is post-write, never on a refusal)');
select is(pg_temp.audit_ct(pg_temp.mid('TFLAG', 'winners', 0), 'rollback'), 0,
  'AC1 ⭐⭐ ZERO `rollback` audit row for the refused rollback — a refusal is not an action');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — AC1 ⭐ THE TRANSITIVE WALKOVER CASCADE (the assertion "transitively" exists for) (8)
-- ════════════════════════════════════════════════════════════════════════════
-- TCASC W-R1 s1 (…08 vs …09): approve it (…08 wins). The loser …09 drops into losers/0 (a `bye`) and wins it
-- unplayed, then CASCADES on to losers/4 (declared). Rolling back W-R1 s1 must un-walk BOTH hops.
insert into rpc_log select 'bindC1', public.bind_match_demo(pg_temp.mid('TCASC', 'winners', 1), pg_temp.demo_id('f'), '76561197960287930');
insert into rpc_log select 'apC1', public.approve_match(pg_temp.mid('TCASC', 'winners', 1), '76561197960287930');
do $$ begin
  if (select (r->>'ok')::boolean from rpc_log where tag = 'apC1') is not true then
    raise exception 'fixture: TCASC winners/1 approve did not succeed (reason=%)',
      (select r->>'reason' from rpc_log where tag = 'apC1');
  end if;
  -- Precondition of the whole section: the loser really did cascade through the losers/0 bye onward to losers/4.
  if pg_temp.comp('TCASC', 'losers', 4, 'a') is null then
    raise exception 'fixture: the walkover cascade did not reach losers/4 — the cascade precondition is unmet';
  end if;
end $$;

insert into rpc_log select 'rbC1', public.rollback_match(pg_temp.mid('TCASC', 'winners', 1), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'rbC1'), true,
  'AC1 ⭐ rollback of the cascade-source match SUCCEEDS');
select is((select state from match where id = pg_temp.mid('TCASC', 'winners', 1)), 'pending',
  'AC1 ⭐ the source match is back to `pending`');
select is(pg_temp.comp('TCASC', 'winners', 8, 'b'), null::bigint,
  'AC1 ⭐ the winner''s Winners-R2 seat is un-seated (the direct advance reverted)');
select is(pg_temp.comp('TCASC', 'losers', 0, 'b'), null::bigint,
  'AC1 ⭐ the `bye` node the loser walked into (Losers R1 side b) is un-seated');
select is((select winner_entry from match where id = pg_temp.mid('TCASC', 'losers', 0)), null::bigint,
  'AC1 ⭐⭐ the walkover CROWN on that bye node is un-walked — winner_entry back to NULL (skip the winner_entry clear and this reddens)');
select is(pg_temp.comp('TCASC', 'losers', 4, 'a'), null::bigint,
  'AC1 ⭐⭐ THE TRANSITIVE HOP: the node the walkover cascaded ONTO (Losers R2 side a) is also un-seated — this is what "transitively" means (drop the continuation and this reddens)');
select ok(
  (select state = 'pending' from match where id = pg_temp.mid('TCASC', 'winners', 1))
  and (select demo_id is not null from match where id = pg_temp.mid('TCASC', 'winners', 1))
  and (select count(*)::int from stat_row where match_id = pg_temp.mid('TCASC', 'winners', 1) and status <> 'pending') = 0,
  'AC1: the source match is pending, its demo still bound, its stat rows all back to pending');
select is(
  (select jsonb_array_length(r->'reverted') from rpc_log where tag = 'rbC1'), 3,
  'AC1 ⭐ the reverted plan has THREE entries — the winner seat + the bye walkover + the transitive hop');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — final_match_id UN-CROWN (TCROWN raw probe) (3)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log select 'rbCrown', public.rollback_match(pg_temp.mid('TCROWN', 'grand_final', 0, 2), '76561197960287930');
select is((select (r->>'uncrowned')::boolean from rpc_log where tag = 'rbCrown'), true,
  'un-crown ⭐ rollback of the GF-deciding row reports uncrowned=true');
select is((select final_match_id from tournament where name = 'TCROWN'), null::bigint,
  'un-crown ⭐ tournament.final_match_id is NULL again — a rolled-back deciding row un-crowns the champion (inverse of advance_match''s crown)');
select is((select state from match where id = pg_temp.mid('TCROWN', 'grand_final', 0, 2)), 'pending',
  'un-crown ⭐ the GF row itself is back to `pending`');

-- ════════════════════════════════════════════════════════════════════════════
-- Section H — AC1 ⭐⭐ THE AD-8 FLAG over a FORFEIT downstream (code review 2026-07-19) (6)
-- ════════════════════════════════════════════════════════════════════════════
-- Section E drove a `resolved` downstream. `forfeit` is the OTHER committed, advanceable state (Story 4.5):
-- mark_walkover writes state='forfeit' + winner_entry and advances, exactly like an approve. It MUST be flagged
-- too, never auto-un-seated — the pre-patch flag was a DENYLIST that omitted `forfeit`, so a forfeit downstream
-- fell through to the un-seat branch (either tripping match_winner_is_competitor -> 500, or silently mutilating
-- a committed forfeit match — AD-8's named hazard). Drive TFORF: approve winners/0 (…01 -> winners/4 side a) +
-- winners/1 (…04 -> winners/4 side b, so winners/4 is a DETERMINED matchup), then grace-then-forfeit winners/4
-- (…04 no-shows, …01 wins the walkover -> winners/4 = forfeit). Rolling back winners/0 must REFUSE.
insert into rpc_log select 'bindH0', public.bind_match_demo(pg_temp.mid('TFORF', 'winners', 0), pg_temp.demo_id('g'), '76561197960287930');
insert into rpc_log select 'bindH1', public.bind_match_demo(pg_temp.mid('TFORF', 'winners', 1), pg_temp.demo_id('h'), '76561197960287930');
insert into rpc_log select 'apH0', public.approve_match(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930');
insert into rpc_log select 'apH1', public.approve_match(pg_temp.mid('TFORF', 'winners', 1), '76561197960287930');
insert into rpc_log select 'graceH4', public.begin_match_grace(pg_temp.mid('TFORF', 'winners', 4), '76561197960287930');
-- Backdate the clock past the configured period so mark_walkover's grace gate is satisfied (mirrors 0015's
-- fixture pattern; grace_period_seconds defaults to 600, so 20 minutes ago is elapsed).
update match set awaiting_grace_since = now() - interval '20 minutes'
 where id = pg_temp.mid('TFORF', 'winners', 4);
insert into rpc_log select 'forfH4', public.mark_walkover(pg_temp.mid('TFORF', 'winners', 4), '76561197960287930', pg_temp.re('TFORF', 1));
do $$ begin
  if (select state from public.match where id = pg_temp.mid('TFORF', 'winners', 4)) <> 'forfeit' then
    raise exception 'fixture: TFORF winners/4 did not reach forfeit (state=%, grace=%, forf=%)',
      (select state from public.match where id = pg_temp.mid('TFORF', 'winners', 4)),
      (select r->>'reason' from rpc_log where tag = 'graceH4'),
      (select r->>'reason' from rpc_log where tag = 'forfH4');
  end if;
end $$;

insert into rpc_log select 'rbH0', public.rollback_match(pg_temp.mid('TFORF', 'winners', 0), '76561197960287930');

select is((select r->>'reason' from rpc_log where tag = 'rbH0'), 'downstream_active',
  'AC1 ⭐⭐ rollback of winners/0 is REFUSED `downstream_active` — its winner''s seat is held by winners/4, a COMMITTED forfeit (Story 4.5) standing on its own result (AD-8)');
select ok(
  (select (b->>'match_id')::bigint = pg_temp.mid('TFORF', 'winners', 4) and b->>'state' = 'forfeit'
     from jsonb_array_elements((select r->'blocking' from rpc_log where tag = 'rbH0')) as b),
  'AC1 ⭐⭐ `blocking` names winners/4 with state=`forfeit` — the forfeit state is FLAGGED, not auto-reverted (the denylist->allowlist fix, code review 2026-07-19)');
select is((select state from match where id = pg_temp.mid('TFORF', 'winners', 0)), 'resolved',
  'AC1 ⭐⭐ NOTHING was unpublished — winners/0 is STILL `resolved` (the refusal wrote nothing)');
select is(
  (select count(*)::int from stat_row where match_id = pg_temp.mid('TFORF', 'winners', 0) and status <> 'approved'), 0,
  'AC1 ⭐⭐ winners/0''s stat rows are STILL every-one `approved` — the refusal did not touch them');
select is((select state from match where id = pg_temp.mid('TFORF', 'winners', 4)), 'forfeit',
  'AC1 ⭐⭐ the downstream forfeit is UNTOUCHED — still `forfeit`, its competitor NOT un-seated (AD-8''s "silently un-publishing unrelated matches" did NOT happen)');
select is(pg_temp.audit_ct(pg_temp.mid('TFORF', 'winners', 0), 'rollback'), 0,
  'AC1 ⭐⭐ ZERO `rollback` audit row for the refused rollback — a refusal is not an action');

select * from finish();
rollback;
