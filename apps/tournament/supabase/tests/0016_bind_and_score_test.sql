-- supabase/tests/0016_bind_and_score_test.sql
-- pgTAP proof for migration 0016 (Story 4.6a): bind a demo to the match it decided + the demo-derived score.
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC3  THE BIND (flagship): `declared -> pending` AND `live -> pending`; ALL THREE FKs populated
--        (match.demo_id, demo.match_id, and EVERY stat_row.match_id for that demo — the COUNT, not one
--        row); the `bind_demo` audit row. Nothing else in the codebase can produce `pending`.         -> A/B
--   AC2  THE 4.5 HAND-OFF (0015:55-56 assigned this round-trip here BY NAME): binding to a committed
--        forfeit / bye / void is REFUSED `not_bindable` and the match is UNCHANGED. 4.5 could only
--        install the terminal guard; this is the writer that proves it.                                 -> C
--   ⭐   THE 23514 MAP (deferred-work.md:136, OPEN since Story 4.2 — four stories): an unlocked-format
--        match binds to a TYPED `format_not_declared`, never a raw check_violation.                     -> D
--   AC1  the demo-derived score: stat_row.rounds_won carries the per-player tally, and Σrounds_won ==
--        rounds_played (FR-16's conservation, at the DB layer).                                         -> H
--   +    DECISION H `anomalous` / `no_stats` refusals; idempotency + already_bound; bad_match/bad_demo.
--                                                                                                 -> E/F/G
--   AD-8 the EXECUTE grant matrix (service_role only) — the REVOKE, not just the GRANT.             -> I
--
-- ⚠ MUTATION-TESTED BY EXECUTION, NOT BY ASSERTION (the standing 4.1/4.2/4.3 lesson — deferred-work.md:141:
-- "4.3 mutation-tested AC1 and shipped the identical hole on AC2; deleting the result gate left all 79
-- assertions green"). Each defect below was injected into the SHIPPED bind_match_demo body, the function
-- re-applied to a live DB, and this file re-run. The assertion numbers are the OBSERVED failures:
--   * remove the `update stat_row set match_id` write            -> RED  4: tests 5, 7, 9, 12
--   * remove the `state = 'pending'` write                       -> RED  2: tests 2, 11
--   * neuter the `not_bindable` guard (`if false and …`)         -> RED  3: tests 13, 15, 17 (the AC2 round-trip)
--   * neuter the `anomalous` guard                               -> RED  4: tests 21, 22, 23, 24
--   * neuter the `format_locked` guard                           -> RED  1: test 19
--   * drop the idempotent short-circuit                          -> RED  2: tests 25, 26
--   * scope the stat_row write by matchzy_match_id, not demo_id  -> RED  5: tests 5, 6, 7, 9, 36
-- ⚠⚠ THE NUMBERS ABOVE ARE STALE FOR SECTIONS C AND H — the 2026-07-16 code review changed both fixtures and
-- renumbered (H gained a non-vacuity gate; a new Section I follows it). Re-run and re-record the five
-- unaffected mutations before trusting their numbers. The `not_bindable` mutation WAS re-run — see below.
--
--   * RE-RUN 2026-07-16, neuter `not_bindable` (`if false and …`) -> the suite ABORTS at the Section C
--     forfeit probe with `ERROR: match <id>: state forfeit is TERMINAL (AD-23) … CONTEXT: PL/pgSQL function
--     public.match_terminal_state_guard() line 4 at RAISE`. **OBSERVED, not inferred** — the whole point of
--     the correction below. That abort is 4.5's IC901 firing on the state write, which is what the old
--     header CLAIMED happened and could not have. It now does, because the probe reaches the write.
--
-- ⚠⚠ CODE-REVIEW CORRECTION (2026-07-16) — THE PREVIOUS HEADER MADE A CLAIM THAT WAS FALSE, AND IT IS
-- INSTRUCTIVE. It read: "neutering `not_bindable` reddens 13/15/17 but NOT 14/16/18 — because 4.5's
-- match_terminal_state_guard RAISES IC901 on the state write and rolls the bind back… the mutation
-- demonstrates the second lock holding when the first is removed." **IC901 could not fire.** The Section C
-- probes were format-UNLOCKED (`format_locked` defaults false, 0010:58) and bound D4 ("deliberately NO
-- rows"), so with `not_bindable` neutered control returned `format_not_declared` at the NEXT guard — or
-- `no_stats` at the one after — and NEVER reached the first UPDATE. Nothing was rolled back. 14/16/18 stayed
-- green because the FORMAT guard refused first: they were exactly the "tests that merely track 13/15/17"
-- the header denied they were. The RED set was real; the mechanism was INFERRED, not diagnosed — the
-- opposite of the discipline DECISION L applied. **A mutation's OBSERVED reds do not license a story about
-- WHY.** Fixed below rather than re-worded: the forfeit probe now genuinely isolates the state guard.
--
-- ⚠ AND ONE HALF OF IT CANNOT BE ISOLATED, BY CONSTRUCTION — SO IT IS SAID, NOT PAPERED OVER.
--   * FORFEIT: a real forfeit was `declared` FIRST (its format declared + latched through the RPC) and only
--     then walked over, so `format_locked = true` is its NORMAL shape — the old fixture's unlocked forfeit
--     was the unrepresentative one. It is now inserted locked and bound with D6 (which HAS rows), so
--     `not_bindable` is the ONLY guard standing between it and the write. Neuter it and the UPDATE runs and
--     IC901 fires for real — which ABORTS this transaction rather than reddening a test, because pgTAP
--     cannot catch a raise. That abort IS the demonstration; it is not a green suite. **CONFIRMED BY
--     EXECUTION at the review** (the raise is quoted in the mutation list above): the two locks on AD-23's
--     door really are independent, and the second one really does hold when the first is removed — which is
--     what the old header asserted on no evidence and is now true on evidence.
--   * BYE / VOID: these are set by GENERATION, before any format is declared, and 0012:379-388 REFUSES a
--     declare onto a non-`declared` row ("one route call could irreversibly lock a format onto a
--     bye/void/forfeit row"). So their format is unlocked FOREVER and no fixture can honestly isolate them —
--     `format_not_declared` will always be the second refusal waiting. For those two, `not_bindable` is
--     proven by the REASON STRING alone (13/17), which is still a real assertion: it pins WHICH guard fired.
--
-- ⭐ AND IT EARNED ITS KEEP — THE LAST MUTATION WAS GREEN AT FIRST, ON THIS SUITE. The original fixture gave
-- the scope-probe demo (D5) its OWN external id, which made "scope by demo_id" and "scope by
-- matchzy_match_id" behaviourally IDENTICAL — so a real defect passed 36/36. The FIXTURE was fixed (D5 now
-- shares D1's matchzy_match_id, which 0006's `unique(matchzy_match_id, demo_sha256)` explicitly permits and a
-- re-upload actually produces), never the mutation and never the assertion. This is deferred-work.md:141's
-- lesson caught BEFORE the review instead of by it.
-- A green suite after any of those is a blind suite — fix the test, not the mutation.
--
-- An 8-player field (a power of two — NO structural byes/voids) is used for the driven binds so every match
-- is DETERMINED and `declared`. The terminal-state probes (Section C) are raw-INSERTed into a separate
-- no-bracket tournament (TGUARD), exactly as 0015's Section F does — `match_live_requires_locked_format`
-- (0012:123-126) EXCLUDES bye/void/forfeit, so those rows are representable unlocked.
--
-- ⚠ FIXTURE NOTE — formats are locked through the REAL declare_match_format RPC, never a raw UPDATE.
-- `match_format_audited` (0012:220-239) REFUSES any change to format_locked without its authorizing audit
-- row in the same transaction. A raw `update match set format_locked = true` is exactly what that gate
-- exists to stop (0010_match_test.sql learned this at the 4.2 code review). This is not a workaround —
-- it is the only legitimate path, and using it keeps the fixture honest.
--
-- SQLSTATE: 4.6a RAISES NOTHING. Every refusal here is a RETURNED {ok:false, reason}.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 9 + B 3 + C 6 + D 2 + E 4 + F 7 + G 2 + H 4 + I 3 = 40.
select plan(40);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin, 8 field players, two tournaments.
--   TBIND  — 8-player bracket. Every driven bind + refusal path.
--   TGUARD — no bracket: the raw-INSERT target for the terminal-state probes (Section C).
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 8) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, 'registration_open'
  from (values ('TBIND'), ('TGUARD')) as v(n);

insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 8) as i
 where t.name in ('TBIND', 'TGUARD');

update tournament set state = 'registration_closed' where name = 'TBIND';

-- ── Helpers (mirroring 0013/0014/0015 — reuse, never hand-derive) ────────────
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

create function pg_temp.audit_ct(tgt bigint, act text) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt and action = act
$fn$;
create function pg_temp.audit_all(tgt bigint) returns int language sql stable as $fn$
  select count(*)::int from public.audit_log where target_match_id = tgt
$fn$;

-- Rows of a demo that are bound to a given bracket match.
create function pg_temp.bound_rows(m bigint) returns int language sql stable as $fn$
  select count(*)::int from public.stat_row where match_id = m
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

-- Generate the real bracket (as the default superuser, before the role switch — mirrors 0014/0015).
insert into rpc_log
select 'gen', public.generate_bracket(pg_temp.tid('TBIND'), '76561197960287930',
                                      '{"algorithm":"fisher-yates"}'::jsonb,
                                      pg_temp.seeds('TBIND', 8), pg_temp.matches8('TBIND'));

do $$ begin
  if (select (r->>'match_count')::int from rpc_log where tag = 'gen') <> 15 then
    raise exception 'fixture: TBIND did not commit 15 rows';
  end if;
end $$;

-- ── The demos + their parsed stat rows ──────────────────────────────────────
-- D1  the clean, decided demo bound in Section A. 15 rounds, 9-6 — the REAL cuatro-luisito shape (verified
--     against the actual demo at Story 4.6a Task 1: …171 won 9, …714 won 6).
-- D2  a second clean demo (Section B's live->pending bind).
-- D3  ANOMALOUS (held by the 3.4 validation gate) — DECISION H.
-- D4  clean but produced ZERO stat rows.
-- D5  ⭐ THE SCOPE PROBE — A SECOND DEMO FOR THE **SAME** matchzy_match_id AS D1 (9001).
--     This is NOT contrived: 0006's dedup key is `unique(matchzy_match_id, demo_sha256)`, so a re-upload of
--     the same MatchZy match with DIFFERENT bytes legitimately creates a second demo row sharing the external
--     id. That is exactly what makes `matchzy_match_id` the WRONG scope for the bind's stat_row write, and
--     `demo_id` (the row's provenance, 0007:39) the right one. Its rows must survive D1's bind untouched.
--     ⚠ THE MUTATION TEST FOUND THIS: the first cut of this fixture gave D5 its own external id (9005), which
--     made the demo_id-scoped and matchzy-scoped writes BEHAVIOURALLY IDENTICAL — so M7 (scope by
--     matchzy_match_id) left the suite fully GREEN. The fixture was blind; the mutation is now caught by both
--     A5 and A6.
-- D6  ⭐ THE ISOLATING PROBE for Section C's forfeit (added at the 2026-07-16 code review). Clean, unbound,
--     and it HAS stat rows — so when it is offered to a format-LOCKED forfeit, `not_bindable` is the ONLY
--     guard left between the call and the write. The old fixture offered D4 (no rows) to an unlocked match,
--     which meant two later guards would have refused it anyway and the test could not isolate anything.
insert into demo (matchzy_match_id, storage_key, source, demo_sha256, validation_state) values
  (9001, 'demos/9001.dem',  'matchzy', repeat('a', 64), 'pending'),
  (9002, 'demos/9002.dem',  'matchzy', repeat('b', 64), 'pending'),
  (9003, 'demos/9003.dem',  'matchzy', repeat('c', 64), 'anomalous'),
  (9004, 'demos/9004.dem',  'matchzy', repeat('d', 64), 'pending'),
  (9001, 'demos/9001b.dem', 'matchzy', repeat('e', 64), 'pending'),
  (9006, 'demos/9006.dem',  'matchzy', repeat('f', 64), 'pending');

-- Keyed on the sha256, NOT the external id: D1 and D5 deliberately SHARE matchzy_match_id 9001, so the
-- external id no longer identifies a demo (which is the whole point of the D5 probe).
create function pg_temp.demo_id(tag text) returns bigint language sql stable as $fn$
  select id from public.demo where demo_sha256 = repeat(tag, 64)
$fn$;

-- D1's rows: the FR-16 tally, 9 + 6 = 15 == rounds_played.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9001, '76561197960287801', pg_temp.demo_id('a'), 10, 6, 15, 9),
  (9001, '76561197960287802', pg_temp.demo_id('a'),  6, 10, 15, 6);
-- D2's rows.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9002, '76561197960287803', pg_temp.demo_id('b'), 13, 9, 21, 12),
  (9002, '76561197960287804', pg_temp.demo_id('b'),  9, 13, 21, 9);
-- D3 (anomalous) has rows — so the `anomalous` refusal cannot pass for `no_stats`'s reason.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9003, '76561197960287805', pg_temp.demo_id('c'), 5, 5, 10, 5);
-- D4: deliberately NO rows.
-- D5's row: SHARES D1's external id 9001 (a different steamid, so stat_row's unique(matchzy_match_id,
-- steamid64) is satisfied) — a bind scoped by the external id would sweep this row into D1's match.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9001, '76561197960287806', pg_temp.demo_id('e'), 1, 1, 4, 2);
-- D6's rows: a clean 7-6 over 13. Its ONLY job is to get Section C's forfeit probe past the `no_stats`
-- guard, so that the state guard is the one thing refusing the bind.
insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won) values
  (9006, '76561197960287807', pg_temp.demo_id('f'), 8, 7, 13, 7),
  (9006, '76561197960287808', pg_temp.demo_id('f'), 7, 8, 13, 6);

-- ── Lock the formats through the REAL RPC (see the fixture note in the header) ──
set local role service_role;
insert into rpc_log
select 'declare', public.declare_match_format(pg_temp.tid('TBIND'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
set local role postgres;

-- TBIND winners/1 is driven to `live` for Section B. Legal now that its format is locked.
update match set state = 'live' where id = pg_temp.mid('TBIND', 'winners', 1);

-- ── The terminal-state probes (Section C) — raw INSERTs into TGUARD, no bracket ──
-- Built on the `losers` arm (a winner edge, NO loser edge), exactly as 0015's Section F builds them: 4.3's
-- match_routing_complete makes an edgeless row UNREPRESENTABLE (a brick), so a fixture must declare a legal
-- exit. The edge targets a deliberately NON-EXISTENT slot 999 (the 0010/0012 precedent) — nothing advances
-- these rows, so the edge is never resolved; it exists only to satisfy the CHECK honestly.
-- An unlocked format is legal here: match_live_requires_locked_format EXCLUDES bye/void/forfeit (0012:118).
--
-- ⭐ THE FORFEIT PROBE IS INSERTED FORMAT-LOCKED (code review 2026-07-16), and that is REALISM, not a
-- workaround. A real forfeit reaches that state as `declared` -> (grace) -> `forfeit`, and its format was
-- declared + LATCHED while it was still `declared` — the latch is permanent, so `format_locked = true` is a
-- forfeit's normal shape. The old fixture's unlocked forfeit was the unrepresentative one, and it silently
-- cost the suite its AC2 isolation (the format guard would have refused the bind anyway).
-- Set by raw INSERT because BOTH format triggers are UPDATE-only (`match_format_lock` before update,
-- 0012:154-156; `match_format_audited` after update, 0012:220-223) and 0012:379-388 REFUSES a declare onto a
-- non-`declared` row — so there is no RPC path to a locked forfeit, and an INSERT trips no gate.
-- Bye/Void stay unlocked: they are set by GENERATION, before any declare, and can never be locked at all.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, competitor_a, competitor_b, winner_entry,
                   winner_to_bracket, winner_to_slot, winner_to_side, format, tie_policy, format_locked)
values
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Bye',     90, 'bye',     pg_temp.re('TGUARD', 1), null, pg_temp.re('TGUARD', 1), 'losers', 999, 'a', null,   null,     false),
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Forfeit', 91, 'forfeit', pg_temp.re('TGUARD', 2), pg_temp.re('TGUARD', 3), pg_temp.re('TGUARD', 2), 'losers', 999, 'a', 'mr12', 'ot_mr3', true),
  (pg_temp.tid('TGUARD'), 'losers', 'Guard Void',    92, 'void',    null, null, null, 'losers', 999, 'a', null,   null,     false);

-- Everything below runs as SERVICE_ROLE — the sole writer (AD-2). This exercises the grants, and it is how
-- bind_match_demo is actually invoked (a SECURITY INVOKER wrapper behind requireAdmin).
set local role service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — AC3 ⭐ THE FLAGSHIP: declared -> pending, all three FKs, the audit row (9)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log
select 'bindA', public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 0), pg_temp.demo_id('a'), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'bindA'), true,
  'AC3 ⭐ bind_match_demo on a `declared` match with a clean parsed demo SUCCEEDS');

select is((select state from match where id = pg_temp.mid('TBIND', 'winners', 0)), 'pending',
  'AC3 ⭐ the match is now `pending` — the state NOTHING in this codebase could produce before Story 4.6a, and the one 4.6b''s Aprobar and 4.7''s rollback both require');

select is((select demo_id from match where id = pg_temp.mid('TBIND', 'winners', 0)), pg_temp.demo_id('a'),
  'AC3 FK 1/3: match.demo_id points at the demo that decided it (NULL on every row since 0010)');

select is((select match_id from demo where id = pg_temp.demo_id('a')), pg_temp.mid('TBIND', 'winners', 0),
  'AC3 FK 2/3: demo.match_id points BACK at the bracket match (the association SPINE:469 deferred to build time)');

-- ⚠ The COUNT, not one row: a bind that moved only the first stat_row would pass a single-row assertion.
select is(pg_temp.bound_rows(pg_temp.mid('TBIND', 'winners', 0)), 2,
  'AC3 FK 3/3: EVERY stat_row this demo produced is bound to the match — the COUNT (2), not merely one row');

-- The SCOPE proof: the write is `where demo_id = p_demo_id`. A bind scoped by matchzy_match_id, or with the
-- WHERE dropped, would sweep an unrelated demo's rows into this match.
select ok((select count(*) = 1 from stat_row where demo_id = pg_temp.demo_id('e') and match_id is null),
  'AC3: …and ONLY that demo''s rows — an unrelated demo''s stat_row is UNTOUCHED (the write is scoped by demo_id, the row''s provenance)');

select is((select (r->>'stat_rows_bound')::int from rpc_log where tag = 'bindA'), 2,
  'AC3: the reply reports the stat_row count it actually bound (the admin/queue''s evidence)');

select is((select r->>'idempotent' from rpc_log where tag = 'bindA'), 'false',
  'AC3: a FIRST bind is not flagged idempotent');

select ok(
  (select count(*)::int from audit_log
    where target_match_id = pg_temp.mid('TBIND', 'winners', 0)
      and action = 'bind_demo'
      and actor_steamid64 = '76561197960287930'
      and (detail->>'demo_id')::bigint = pg_temp.demo_id('a')
      and (detail->>'matchzy_match_id')::bigint = 9001
      and (detail->>'stat_rows_bound')::int = 2
      and detail->>'from_state' = 'declared') = 1,
  'AD-17: exactly ONE `bind_demo` audit row naming the ACTOR (who) + every detail key — demo_id, the EXTERNAL matchzy_match_id, the rows bound, and the state it came from');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC3: the lifecycle's literal `Live -> Pending: demo parsed` (3)
-- ════════════════════════════════════════════════════════════════════════════
insert into rpc_log
select 'bindB', public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 1), pg_temp.demo_id('b'), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'bindB'), true,
  'AC3: bind_match_demo on a `live` match SUCCEEDS — the lifecycle''s literal `Live -> Pending: demo parsed` (SPINE:309)');
select is((select state from match where id = pg_temp.mid('TBIND', 'winners', 1)), 'pending',
  'AC3: …and the live match is now `pending`');
select ok(
  (select m.demo_id = pg_temp.demo_id('b') from match m where m.id = pg_temp.mid('TBIND', 'winners', 1))
  and (select d.match_id = pg_temp.mid('TBIND', 'winners', 1) from demo d where d.id = pg_temp.demo_id('b'))
  and pg_temp.bound_rows(pg_temp.mid('TBIND', 'winners', 1)) = 2,
  'AC3: …with all three FKs populated on the live path too (the bind accepts declared OR live — DECISION A)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC2 ⭐ THE 4.5 HAND-OFF: a terminal match REFUSES the bind (6)
-- ════════════════════════════════════════════════════════════════════════════
-- AD-23: "once Forfeit/Bye is committed, a demo that later arrives is archived for evidence (AD-1) but
-- produces NO stat_row and does not flip the match." Retention already archives it (3.1/3.2) and 4.5's
-- IC901 guard already refuses the flip — this is the third half, which 0015:55-56 handed here BY NAME:
-- the BIND ITSELF must refuse. A typed refusal beats a raised trigger for the admin, and the guard must not
-- be the only defense.
create function pg_temp.guard_mid(pos text) returns bigint language sql stable as $fn$
  select m.id from public.match m join public.tournament t on t.id = m.tournament_id
   where t.name = 'TGUARD' and m.bracket_position = pos
$fn$;

-- ⭐ THE ISOLATING PROBE: a format-LOCKED forfeit offered a CLEAN demo that HAS rows (D6). Every other guard
-- passes, so `not_bindable` is the only thing standing between this call and the `state='pending'` write —
-- which is what makes 13/14 an honest test of THAT guard rather than of whichever guard happens to be next.
-- Remove the guard and the UPDATE runs and 4.5's IC901 fires for real (aborting this transaction, since
-- pgTAP cannot catch a raise). See the header for why bye/void below cannot be isolated the same way.
select is((select public.bind_match_demo(pg_temp.guard_mid('Guard Forfeit'), pg_temp.demo_id('f'), '76561197960287930')->>'reason'), 'not_bindable',
  'AC2 ⭐ a late demo for a committed FORFEIT is REFUSED (not_bindable) — the AD-23 round-trip 4.5 could only install the guard for. ISOLATED: the format is locked and the demo has rows, so no other guard could have refused it');
select ok(
  (select state = 'forfeit' and demo_id is null from match where id = pg_temp.guard_mid('Guard Forfeit'))
  and pg_temp.audit_all(pg_temp.guard_mid('Guard Forfeit')) = 0,
  'AC2 ⭐ …and the forfeited match is UNCHANGED — still `forfeit`, no demo bound, and the refusal wrote NO audit row');

select is((select public.bind_match_demo(pg_temp.guard_mid('Guard Bye'), pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'not_bindable',
  'AC2: a demo arriving for a committed BYE is REFUSED (a bye is won unplayed — there is no demo to decide it)');
select ok(
  (select state = 'bye' and demo_id is null from match where id = pg_temp.guard_mid('Guard Bye'))
  and pg_temp.audit_all(pg_temp.guard_mid('Guard Bye')) = 0,
  'AC2: …and the bye match is UNCHANGED');

select is((select public.bind_match_demo(pg_temp.guard_mid('Guard Void'), pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'not_bindable',
  'AC2: a demo for a VOID node is REFUSED (nothing can ever reach it)');
select ok(
  (select state = 'void' and demo_id is null from match where id = pg_temp.guard_mid('Guard Void'))
  and pg_temp.audit_all(pg_temp.guard_mid('Guard Void')) = 0,
  'AC2: …and the void match is UNCHANGED');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — ⭐ THE 23514 MAP (deferred-work.md:136, OPEN since Story 4.2) (2)
-- ════════════════════════════════════════════════════════════════════════════
-- "Whoever lands `declared -> live` inherits an opaque check_violation… Intended home: 4.5, 4.6, or the
-- Epic-5 admin console." 4.5 declined it (it never lands a played state). 4.6a lands `pending`, so it
-- inherits it — and discharges it as a TYPED refusal rather than a raw 23514 inside a 500.
-- TGUARD's rows are unlocked; give one a bindable `declared` state to isolate the format guard from the
-- state guard.
set local role postgres;
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, competitor_a, competitor_b,
                   winner_to_bracket, winner_to_slot, winner_to_side)
values (pg_temp.tid('TGUARD'), 'losers', 'Guard Unlocked', 93, 'declared', pg_temp.re('TGUARD', 4), pg_temp.re('TGUARD', 5),
        'losers', 999, 'a');
set local role service_role;

select is((select public.bind_match_demo(pg_temp.guard_mid('Guard Unlocked'), pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'format_not_declared',
  '⭐ 23514 MAP: binding a match whose format is NOT declared returns a TYPED `format_not_declared` — the admin is told to declare the format first, never handed a raw check_violation in a 500 (closes deferred-work.md:136, open since Story 4.2)');
select ok(
  (select state = 'declared' and demo_id is null from match where id = pg_temp.guard_mid('Guard Unlocked')),
  '⭐ 23514 MAP: …and the guard fires BEFORE any write — the match is untouched, so the CHECK is never even reached');

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — DECISION H `anomalous` + `no_stats` (4)
-- ════════════════════════════════════════════════════════════════════════════
select is((select public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 2), pg_temp.demo_id('c'), '76561197960287930')->>'reason'), 'anomalous',
  'DECISION H: an ANOMALOUS demo (held by the 3.4 validation gate) cannot be bound — a held demo does not publish. (D3 HAS stat rows, so this cannot pass for no_stats'' reason.)');
select ok(
  (select state = 'declared' and demo_id is null from match where id = pg_temp.mid('TBIND', 'winners', 2))
  and (select match_id is null from demo where id = pg_temp.demo_id('c')),
  'DECISION H: …and nothing was written — the match is untouched and the held demo is still unbound');

select is((select public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 2), pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'no_stats',
  'a demo that produced NO stat_row decided nothing -> no_stats');
select ok(
  (select state = 'declared' and demo_id is null from match where id = pg_temp.mid('TBIND', 'winners', 2)),
  '…and the match is untouched');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — idempotency + already_bound (7)
-- ════════════════════════════════════════════════════════════════════════════
-- Re-bind the EXACT pair Section A bound.
insert into rpc_log
select 'rebind', public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 0), pg_temp.demo_id('a'), '76561197960287930');

select is((select (r->>'ok')::boolean from rpc_log where tag = 'rebind'), true,
  'IDEMPOTENT: re-binding the SAME (match, demo) pair returns ok — a retried request (a dropped HTTP response) is safe');
select is((select r->>'idempotent' from rpc_log where tag = 'rebind'), 'true',
  'IDEMPOTENT: …and is FLAGGED as such, so a caller can tell "I bound it" from "it was already bound"');
-- ⭐ THE DECIDED ASSERTION (the story required this be decided, not left ambiguous): NO second audit row.
-- The idempotent path performs NO write, so recording a second `bind_demo` would assert a binding that never
-- happened — and audit_log is append-only (AD-17), so the phantom would be permanent.
select is(pg_temp.audit_ct(pg_temp.mid('TBIND', 'winners', 0), 'bind_demo'), 1,
  'IDEMPOTENT ⭐ …and writes NO second audit row — still exactly ONE `bind_demo` row (it changed nothing; audit_log is append-only, so a phantom row would be permanent)');

select is((select public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 0), pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'already_bound',
  'already_bound: binding a DIFFERENT demo to an already-bound match is REFUSED — never a silent re-point (re-pointing is Story 4.7''s audited rollback)');
select is((select demo_id from match where id = pg_temp.mid('TBIND', 'winners', 0)), pg_temp.demo_id('a'),
  'already_bound: …and the original demo is STILL bound — nothing was re-pointed');

select is((select public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 3), pg_temp.demo_id('a'), '76561197960287930')->>'reason'), 'already_bound',
  'already_bound: binding an already-bound DEMO to a different match is REFUSED (the guard is symmetric — a demo is evidence for exactly one match)');
select ok(
  (select match_id = pg_temp.mid('TBIND', 'winners', 0) from demo where id = pg_temp.demo_id('a'))
  and (select state = 'declared' and demo_id is null from match where id = pg_temp.mid('TBIND', 'winners', 3)),
  'already_bound: …and neither side moved — the demo still points at its original match, and the target match is untouched');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — the existence guards (2)
-- ════════════════════════════════════════════════════════════════════════════
select is((select public.bind_match_demo(999999, pg_temp.demo_id('d'), '76561197960287930')->>'reason'), 'bad_match',
  'bind_match_demo on a nonexistent match -> bad_match');
select is((select public.bind_match_demo(pg_temp.mid('TBIND', 'winners', 3), 999999, '76561197960287930')->>'reason'), 'bad_demo',
  'bind_match_demo with a nonexistent demo -> bad_demo');

-- ════════════════════════════════════════════════════════════════════════════
-- Section H — AC1: the demo-derived score rides the row (4)
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ HONEST SCOPE. The DERIVATION (RoundEnd -> rounds_won) is the Go parser's and is proven against 14 REAL
-- demos at Task 1 / Task 6 — pgTAP cannot parse a .dem. What is proven HERE is the column's contract: it
-- exists, it is nullable like every other stat shell, it survives the bind, and FR-16's conservation holds
-- over it. The 4.6b Aprobar maps these per-player tallies onto match.score_a/score_b (DECISION B).
select col_is_null('public', 'stat_row', 'rounds_won',
  'AC1: stat_row.rounds_won is NULLABLE — like every other stat shell (0007:41-47). NULL says "not derived" (a row parsed before 4.6a) rather than lying with a 0');

-- ⚠ Scoped by demo_id (provenance), NOT matchzy_match_id: D5 deliberately shares D1's external id, so the
-- external id does not identify a demo's rows. That is the same distinction the bind's write turns on.
select results_eq(
  $$select steamid64, rounds_won from public.stat_row
     where demo_id = (select id from public.demo where demo_sha256 = repeat('a', 64)) order by steamid64$$,
  $$values ('76561197960287801'::text, 9), ('76561197960287802'::text, 6)$$,
  'AC1: the per-player demo-derived tally rides the AD-4 steamid64 key — 9-6, the REAL cuatro-luisito score verified against the actual demo at Task 1');

-- ⚠⚠ NON-VACUITY GATE (added at the 2026-07-16 code review — READ THIS BEFORE TOUCHING THE TEST BELOW).
-- The conservation assertion is scoped `where match_id = M` on BOTH sides, and pgTAP's is() compares with
-- IS NOT DISTINCT FROM. So on a match with NOTHING bound, sum() and max() are both NULL over the empty set
-- and `is(NULL, NULL)` PASSES — the flagship FR-16 assertion self-passing on exactly the breakage it exists
-- to catch. This is not hypothetical: the mutation log at the top of this file records "remove the `update
-- stat_row set match_id` write -> RED 4: tests 5, 7, 9, 12" and test 36 IS ABSENT, though its entire subject
-- is `match_id = M`. Three independent review layers caught it; the recorded mutation had already proved it
-- and it was read past. That is deferred-work.md's mutation-blindness lesson recurring INSIDE the file that
-- quotes it. Assert the set is non-empty FIRST — then the equality below is about conservation, not NULLs.
select isnt(
  (select sum(rounds_won)::int from stat_row where match_id = pg_temp.mid('TBIND', 'winners', 0)),
  null,
  'AC1/FR-16 ⭐ NON-VACUITY: the bound tally set is NOT empty — without this gate the conservation assertion below passes as is(NULL, NULL) on a match with nothing bound (the exact defect tests 5/7/9/12 catch and this one silently did not)');

-- FR-16 (prd.md:272): "An ingested Match's score equals the Demo's final round tally."
select is(
  (select sum(rounds_won)::int from stat_row where match_id = pg_temp.mid('TBIND', 'winners', 0)),
  (select max(rounds_played)::int from stat_row where match_id = pg_temp.mid('TBIND', 'winners', 0)),
  'AC1/FR-16 ⭐ CONSERVATION, at the bound match: Σrounds_won == rounds_played (9 + 6 == 15). This is the property the real parser satisfies on 14/14 real demos');

-- ════════════════════════════════════════════════════════════════════════════
-- Section I — AD-8: the EXECUTE grant matrix (3)
-- ════════════════════════════════════════════════════════════════════════════
-- Added at the 2026-07-16 code review. 0016's header argues the REVOKE/GRANT at length ("without this REVOKE
-- it would be callable straight off the Data API… a defence that depends on a later grant check is not a
-- defence") and cites 0012:480-487 as its precedent — but nothing asserted it, so DELETING the revoke left
-- the suite fully green. 0011/0012/0013 all pin their grant matrix this way; 0016 had simply dropped the
-- convention it was citing. The role switch above proves the GRANT that exists; only this proves the REVOKE.
select is(has_function_privilege('service_role', 'public.bind_match_demo(bigint,bigint,text)', 'EXECUTE'), true,
  'AD-8: service_role — the single writer (AD-2) and the only role the route ever calls with — CAN execute bind_match_demo');
select is(has_function_privilege('anon', 'public.bind_match_demo(bigint,bigint,text)', 'EXECUTE'), false,
  'AD-8: anon CANNOT execute bind_match_demo — CREATE FUNCTION grants EXECUTE to PUBLIC by default and anon inherits it, so without 0016''s explicit REVOKE this RPC would be callable straight off the Data API');
select is(has_function_privilege('authenticated', 'public.bind_match_demo(bigint,bigint,text)', 'EXECUTE'), false,
  'AD-8: authenticated CANNOT execute it either — a logged-in NON-admin must not be able to bind a demo by calling the RPC directly, bypassing the route''s requireAdmin gate');

select finish();
rollback;

