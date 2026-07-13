-- supabase/tests/0011_bracket_generation_test.sql
-- pgTAP proof for migration 0011 (Story 4.1): the generate_bracket RPC (D2) + the roster-lock trigger (D3).
-- Proves BOTH halves BITE. Run via: supabase test db
--   D2/AC1 one atomic txn: seeds bracket_seed, inserts every match COLUMN, flips state, audits  -> Section B
--   AC3    the two structural bye states PERSIST: a 'bye' walkover keeps its winner, a 'void' node
--          keeps no competitors at all                                                          -> Section B2
--   D2     SINGLE-SHOT + every guard: a refusal is atomic-NOTHING, and the payload is NOT trusted -> Section C
--   D3     the roster freezes at bracket_live for INSERT and UPDATE, on every write path, and at
--          BOTH ENDS of a tournament move                                                       -> Section D
--   D2/D3  the grant matrix genuinely permits the single writer, and the trigger bites it too    -> Section E
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY the RPC's refusals are RETURNED, not raised: every guard runs BEFORE any write, so a refusal
-- commits nothing and the caller gets a typed reason to map to HTTP. Sections B/C therefore assert both
-- halves of each refusal: the right reason came back AND nothing was written.
--
-- ⚠ SECTION B ASSERTS COLUMN VALUES, NOT JUST ROW COUNTS. Counting rows would let a broken JSONB
-- extraction (say `m->>'competitorA'`) NULL every competitor while the suite stayed green. The RPC's
-- entire job is to land the payload's columns faithfully, so the columns are what get asserted.
--
-- The Section-B payload is a HAND-WRITTEN 8-player skeleton (7 winners + 6 losers + 1 GF = 14 rows,
-- slots numbered exactly as lib/bracket/generate.ts numbers them). That is deliberate: it independently
-- cross-checks the TypeScript slot arithmetic against a human-derived bracket. The RPC itself is
-- routing-agnostic — it persists what it is given, having first checked the payload's SHAPE; the
-- double-elim ROUTING is owned by lib/bracket/generate.test.ts.
--
-- ⚠ WHAT THIS SUITE CANNOT PROVE. The D3 lock-conflict claim (the trigger's FOR KEY SHARE conflicts with
-- generation's FOR UPDATE, so a racing roster write BLOCKS and then loses) is a two-session property, and
-- pgTAP runs in one session — every assertion below sees already-committed state. Section A2 therefore
-- pins the lock MODES at the source level, so a silent downgrade to a bare SELECT (which would reopen the
-- TOCTOU while every behavioural assertion here stayed green) turns the suite RED. The true interleaving
-- is proven at live-QA with two real sessions.
--
-- SQLSTATE: P0001 = the trigger's roster-locked refusal; 23502 not-null; 23503 fk; 42501 insufficient_privilege.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(65);

-- ── Fixture ─────────────────────────────────────────────────────────────────
-- One tournament per scenario. IMPORTANT: the D3 trigger is already armed by this migration, so every
-- roster_entry seed below must land while its tournament is still MUTABLE. TLIVE is therefore seeded as
-- registration_open and only THEN flipped to bracket_live (the trigger is on roster_entry, not on
-- tournament, so the flip itself is unguarded — serializing it is generate_bracket's job).
-- …93x = the admin + the players the Section-D trigger tests try to add (they must EXIST, or a
-- `lives_ok` roster insert would 23503 on the player FK instead of exercising the trigger).
insert into player (steamid64, display_name)
select '7656119796028793' || i::text, 'Extra ' || i
  from generate_series(0, 9) as i;
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
-- …78xx = the tournament fields.
insert into player (steamid64, display_name)
select '765611979602878' || lpad(i::text, 2, '0'), 'Field ' || i
  from generate_series(1, 40) as i;

insert into season (name) values ('Season 1');
insert into tournament (season_id, name, state)
select (select id from season where name = 'Season 1'), v.n, v.s
  from (values
    ('TGEN',   'registration_open'),  -- 8 active -> the happy path (flipped to _closed below)
    ('TBYE',   'registration_open'),  -- 9 active -> a 16-bracket with byes + a void node (Section B2)
    ('TOPEN',  'registration_open'),  -- 8 active, stays open -> not_closed
    ('TSTALE', 'registration_open'),  -- 8 active -> roster_changed (we lie about the seed set)
    ('TSMALL', 'registration_open'),  -- 3 active -> bad_field_count
    ('TSKEL',  'registration_open'),  -- 8 active -> bad_skeleton (we send an empty p_matches)
    ('TSEED',  'registration_open'),  -- 8 active -> bad_seeds (we send duplicate seed positions)
    ('TSVC',   'registration_open'),  -- 8 active -> the service_role end-to-end run
    ('TLIVE',  'registration_open'),  -- 2 active, flipped to bracket_live -> the D3 trigger
    ('TMUT',   'registration_open')   -- the D3 mutable-state control
  ) as v(n, s);

-- Roster: 8 active in each 8-field tournament, 9 in TBYE, 3 in TSMALL, 2 in TLIVE.
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t
 cross join generate_series(1, 8) as i
 where t.name in ('TGEN', 'TOPEN', 'TSTALE', 'TSKEL', 'TSEED', 'TSVC');
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(1, 9) as i
 where t.name = 'TBYE';
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(11, 13) as i
 where t.name = 'TSMALL';
insert into roster_entry (tournament_id, steamid64, status)
select t.id, '765611979602878' || lpad(i::text, 2, '0'), 'active'
  from tournament t cross join generate_series(21, 22) as i
 where t.name = 'TLIVE';

-- Now put each tournament in the state its scenario needs (roster seeding is done).
update tournament set state = 'registration_closed'
 where name in ('TGEN', 'TBYE', 'TSTALE', 'TSMALL', 'TSKEL', 'TSEED', 'TSVC');
update tournament set state = 'bracket_live' where name = 'TLIVE';

-- ── Payload helpers ─────────────────────────────────────────────────────────
-- pg_temp.re(n) = the n-th active roster entry of a tournament (deterministic by steamid64) — i.e. "the
-- entry that drew seed n". The draw itself is TypeScript's; here we only need a stable, valid seed set.
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

create function pg_temp.tid(tname text) returns bigint language sql stable as $fn$
  select id from public.tournament where name = tname
$fn$;

-- The complete 8-player double-elim skeleton, slot-for-slot as lib/bracket/generate.ts emits it:
--   winners slots 0-3 = R1 (seeded 1v8 / 4v5 / 2v7 / 3v6), 4-5 = R2, 6 = R3 (Winners Final)
--   losers  slots 0-1 = R1, 2-3 = R2, 4 = R3, 5 = R4 (Losers Final)
--   grand_final slot 0, gf_order 1  (the AD-21 reset row, gf_order=2, is Story 4.4's — NOT here)
-- An 8-field is a power of two, so it has NO byes: every row is 'declared'. Byes are Section B2's.
create function pg_temp.matches8(tname text) returns jsonb language sql stable as $fn$
  select jsonb_agg(jsonb_build_object(
           'bracket', v.b, 'bracket_position', v.p, 'bracket_slot', v.sl, 'gf_order', v.gf,
           'competitor_a', v.ca, 'competitor_b', v.cb, 'winner_entry', null::bigint, 'state', 'declared'))
    from (values
      ('winners',     'Winners R1',  0, null::int, pg_temp.re(tname, 1), pg_temp.re(tname, 8)),
      ('winners',     'Winners R1',  1, null::int, pg_temp.re(tname, 4), pg_temp.re(tname, 5)),
      ('winners',     'Winners R1',  2, null::int, pg_temp.re(tname, 2), pg_temp.re(tname, 7)),
      ('winners',     'Winners R1',  3, null::int, pg_temp.re(tname, 3), pg_temp.re(tname, 6)),
      ('winners',     'Winners R2',  4, null::int, null::bigint,         null::bigint),
      ('winners',     'Winners R2',  5, null::int, null::bigint,         null::bigint),
      ('winners',     'Winners R3',  6, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R1',   0, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R1',   1, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R2',   2, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R2',   3, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R3',   4, null::int, null::bigint,         null::bigint),
      ('losers',      'Losers R4',   5, null::int, null::bigint,         null::bigint),
      ('grand_final', 'Grand Final', 0, 1,         null::bigint,         null::bigint)
    ) as v(b, p, sl, gf, ca, cb)
$fn$;

-- A 9-player field: bracketSize 16, so 2*16-2 = 30 rows and SEVEN byes. This payload exists to prove the
-- RPC PERSISTS the bye/void shapes — the only genuinely new column shapes this story writes. Winners R1
-- slot 0 is the one real match (seed 1 v seed 9); slots 1-7 are byes carrying their lone competitor AND
-- their winner_entry. Losers slot 0 is 'void' (both its Winners feeders were byes, so no loser can ever
-- arrive) and slot 1 is a 'bye' walkover. The ROUTING that decides which nodes those are is
-- lib/bracket/generate.ts's job and is tested there; here we only prove the columns land.
create function pg_temp.matches16(tname text) returns jsonb language sql stable as $fn$
  select jsonb_agg(x)
    from (
      -- Winners R1, slots 0-7: slot 0 real, slots 1-7 byes (winner_entry = the lone competitor).
      select jsonb_build_object(
               'bracket', 'winners', 'bracket_position', 'Winners R1', 'bracket_slot', s, 'gf_order', null::int,
               'competitor_a', pg_temp.re(tname, s + 1),
               'competitor_b', case when s = 0 then pg_temp.re(tname, 9) else null::bigint end,
               'winner_entry', case when s = 0 then null::bigint else pg_temp.re(tname, s + 1) end,
               'state',        case when s = 0 then 'declared' else 'bye' end
             ) as x
        from generate_series(0, 7) as s
      union all
      -- Winners R2/R3/R4, slots 8-14: empty, declared.
      select jsonb_build_object(
               'bracket', 'winners', 'bracket_position', 'Winners R' || v.r, 'bracket_slot', v.s, 'gf_order', null::int,
               'competitor_a', null::bigint, 'competitor_b', null::bigint, 'winner_entry', null::bigint,
               'state', 'declared')
        from (values (8,2),(9,2),(10,2),(11,2),(12,3),(13,3),(14,4)) as v(s, r)
      union all
      -- Losers, slots 0-13: slot 0 void, slot 1 a bye walkover, the rest declared.
      select jsonb_build_object(
               'bracket', 'losers', 'bracket_position', 'Losers', 'bracket_slot', s, 'gf_order', null::int,
               'competitor_a', null::bigint, 'competitor_b', null::bigint, 'winner_entry', null::bigint,
               'state', case when s = 0 then 'void' when s = 1 then 'bye' else 'declared' end)
        from generate_series(0, 13) as s
      union all
      select jsonb_build_object(
               'bracket', 'grand_final', 'bracket_position', 'Grand Final', 'bracket_slot', 0, 'gf_order', 1,
               'competitor_a', null::bigint, 'competitor_b', null::bigint, 'winner_entry', null::bigint,
               'state', 'declared')
    ) as t
$fn$;

-- ============================================================================
-- Section A — the objects exist + the EXECUTE grant matrix (8 assertions)
-- ============================================================================
select has_function('public'::name, 'generate_bracket'::name,
  ARRAY['bigint','text','jsonb','jsonb','jsonb']::name[],
  'generate_bracket(bigint, text, jsonb, jsonb, jsonb) exists — the app''s first atomic admin transaction');
select has_function('public'::name, 'roster_entry_assert_mutable'::name, ARRAY['bigint']::name[],
  'roster_entry_assert_mutable(bigint) exists — the D3 lock predicate, applied to BOTH ends of a tournament move');
select has_trigger('public'::name, 'roster_entry'::name, 'roster_entry_lock'::name,
  'roster_entry_lock: the D3 BEFORE INSERT OR UPDATE trigger is armed on roster_entry');

-- The RPC is service-role-only (AD-8). CREATE FUNCTION grants EXECUTE to PUBLIC by default, and
-- anon/authenticated INHERIT from PUBLIC — so without the explicit REVOKE any visitor could call this
-- straight off the Data API. These assertions are what prove the REVOKE actually landed.
select is(has_function_privilege('service_role',  'public.generate_bracket(bigint,text,jsonb,jsonb,jsonb)', 'EXECUTE'), true,
  'service_role CAN execute generate_bracket (the single server-side writer — AD-2)');
select is(has_function_privilege('anon',          'public.generate_bracket(bigint,text,jsonb,jsonb,jsonb)', 'EXECUTE'), false,
  'anon CANNOT execute generate_bracket — the default PUBLIC grant was REVOKED (fail closed)');
select is(has_function_privilege('authenticated', 'public.generate_bracket(bigint,text,jsonb,jsonb,jsonb)', 'EXECUTE'), false,
  'authenticated CANNOT execute generate_bracket — a logged-in viewer cannot draw the bracket off the Data API');
select is(has_function_privilege('anon',          'public.roster_entry_assert_mutable(bigint)', 'EXECUTE'), false,
  'anon CANNOT execute the lock predicate directly either — it is the trigger''s internal helper, not an API');
-- PUBLIC is a pseudo-role (not in pg_roles), so has_function_privilege cannot name it — read the ACL
-- directly instead: aclexplode reports the PUBLIC grantee as oid 0.
select is(
  (select count(*)::int
     from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.generate_bracket(bigint,text,jsonb,jsonb,jsonb)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC holds NO execute grant on generate_bracket (the CREATE FUNCTION default really is REVOKED, not merely shadowed)');

-- ============================================================================
-- Section A2 — the LOCK MODES are what the design claims (2 assertions)
-- ============================================================================
-- The entire D3 argument is that the trigger's FOR KEY SHARE conflicts with generation's FOR UPDATE, so a
-- roster write racing an in-flight generate BLOCKS on the lock and then loses. That interleaving needs two
-- sessions and cannot be exercised here. What CAN be pinned is the modes themselves: downgrade either one
-- (FOR KEY SHARE -> a bare SELECT, or FOR UPDATE -> a plain read) and the TOCTOU silently reopens while
-- every behavioural assertion in this file stays green. These two assertions are what make that loud.
select matches(
  (select prosrc from pg_proc where oid = 'public.generate_bracket(bigint,text,jsonb,jsonb,jsonb)'::regprocedure),
  'for update',
  'D3: generate_bracket really serializes the tournament row with FOR UPDATE (not a bare SELECT)');
select matches(
  (select prosrc from pg_proc where oid = 'public.roster_entry_assert_mutable(bigint)'::regprocedure),
  'for key share',
  'D3: the roster lock really takes FOR KEY SHARE (which CONFLICTS with FOR UPDATE) — a bare SELECT here would reopen the TOCTOU');

-- ============================================================================
-- Section B — the happy path: ONE call does all four writes, COLUMNS AND ALL (20 assertions)
-- ============================================================================
create temp table gen as
select public.generate_bracket(
         pg_temp.tid('TGEN'),
         '76561197960287930',
         '{"algorithm":"fisher-yates","field_size":8,"bracket_size":8,"bye_seeds":[]}'::jsonb,
         pg_temp.seeds('TGEN', 8),
         pg_temp.matches8('TGEN')
       ) as r;

select is((select r ->> 'ok'           from gen), 'true', 'generate_bracket: a registration_closed 8-field draw SUCCEEDS');
select is((select r ->> 'field_size'   from gen), '8',    'generate_bracket: reports the field size it committed');
select is((select r ->> 'bracket_size' from gen), '8',    'generate_bracket: reports the bracket size it derived under the lock (8 -> 8)');
select is((select r ->> 'match_count'  from gen), '14',   'generate_bracket: reports 14 rows ACTUALLY inserted (GET DIAGNOSTICS ROW_COUNT, not the caller''s array length)');

-- (1) bracket_seed recorded — AC1's "a random bracket_seed is recorded". Every ACTIVE entry gets a
--     position, and the positions are exactly 1..N (a permutation, not a partial or duplicated set).
select is((select count(*)::int from roster_entry where tournament_id = pg_temp.tid('TGEN') and bracket_seed is not null), 8,
  'AC1: all 8 active roster entries have a bracket_seed recorded');
select is((select array_agg(bracket_seed order by bracket_seed) from roster_entry where tournament_id = pg_temp.tid('TGEN')),
  ARRAY[1,2,3,4,5,6,7,8],
  'AC1: the recorded seeds are exactly the positions 1..8 — a permutation, no gaps and no duplicates');

-- (2) the bracket itself — row counts…
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TGEN')), 14,
  'AC2: all 14 match rows are inserted in the one transaction');
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners'), 7,
  'AC2: the full Winners skeleton is pre-created (bracketSize-1 = 7)');
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'losers'), 6,
  'AC2: the full Losers skeleton is pre-created (bracketSize-2 = 6) — the two-loss route exists from the start');
select is((select gf_order from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'grand_final'), 1,
  'AC2: exactly one Grand Final row, gf_order=1 (the AD-21 reset row is Story 4.4''s)');

-- …and the COLUMN VALUES. This is the block that catches a broken JSONB extraction: with `m->>'competitorA'`
-- every competitor would land NULL and every count above would STILL pass.
select is(
  (select competitor_a from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot = 0),
  pg_temp.re('TGEN', 1),
  'D2: competitor_a of Winners R1 slot 0 is the entry that drew seed 1 — the payload''s competitors actually LAND (not NULL)');
select is(
  (select competitor_b from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot = 0),
  pg_temp.re('TGEN', 8),
  'D2: competitor_b of Winners R1 slot 0 is the entry that drew seed 8 (the standard 1v8 pairing)');
select is(
  (select bracket_position from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot = 0),
  'Winners R1',
  'D2: bracket_position lands as the human LABEL from the payload (SPINE L229 — never a running number)');
select is(
  (select state from match where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot = 0),
  'declared',
  'D2: state lands from the payload (an 8-field is a power of two — no byes, everything declared)');
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot <= 3
      and (competitor_a is null or competitor_b is null)),
  0,
  'D2: ALL FOUR Winners-R1 matches got BOTH competitors — the whole seeded field landed, not just the first row');
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TGEN') and bracket = 'winners' and bracket_slot between 4 and 6
      and (competitor_a is not null or competitor_b is not null)),
  0,
  'D2: every LATER Winners slot is empty — a JSON null extracts to SQL NULL, and Story 4.3''s advance fills them');

-- (3) the state transition + (4) the audit row — all in the SAME transaction.
select is((select state from tournament where id = pg_temp.tid('TGEN')), 'bracket_live',
  'D2: tournament.state is flipped registration_closed -> bracket_live');
select is((select count(*)::int from audit_log where tournament_id = pg_temp.tid('TGEN') and action = 'generate_bracket'), 1,
  'AD-17: exactly one generate_bracket audit row, written INSIDE the transaction (never orphaned from the bracket)');
select is((select detail #>> '{bracket_seed,algorithm}' from audit_log where tournament_id = pg_temp.tid('TGEN') and action = 'generate_bracket'),
  'fisher-yates',
  'AD-17: the audit detail carries the RAW DRAW (p_bracket_seed) — the traceability artifact AC1 asks for');
select is((select detail ->> 'match_count' from audit_log where tournament_id = pg_temp.tid('TGEN') and action = 'generate_bracket'),
  '14',
  'AD-17: the audit records the count actually committed, not the count requested');

-- ============================================================================
-- Section B2 — AC3: the bye + void shapes PERSIST (6 assertions). A 9-field -> a 16-bracket.
-- ============================================================================
-- These are the only genuinely NEW column shapes Story 4.1 writes, and nothing else in this suite exercises
-- them: an 8-field has no byes at all, so matches8 above could never have caught a bye that failed to land.
create temp table genbye as
select public.generate_bracket(
         pg_temp.tid('TBYE'), '76561197960287930',
         '{"algorithm":"fisher-yates","field_size":9,"bracket_size":16,"bye_seeds":[1,2,3,4,5,6,7]}'::jsonb,
         pg_temp.seeds('TBYE', 9),
         pg_temp.matches16('TBYE')
       ) as r;

select is((select r ->> 'ok'           from genbye), 'true', 'AC3: a 9-player (non-power-of-two) field generates');
select is((select r ->> 'bracket_size' from genbye), '16',   'AC3: a 9-field is drawn into a 16-bracket (the DB derives this itself, under the lock)');
select is((select r ->> 'match_count'  from genbye), '30',   'AC3: 30 rows = 2*16-2 (15 winners + 14 losers + 1 GF) — the full skeleton, byes and all');
select is(
  (select count(*)::int from match where tournament_id = pg_temp.tid('TBYE') and state = 'bye'),
  8,
  'AC3: the bye rows PERSIST with state=bye (7 Winners walkovers + 1 Losers walkover)');
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBYE') and bracket = 'winners' and state = 'bye'
      and (winner_entry is null or winner_entry is distinct from competitor_a or competitor_b is not null)),
  0,
  'AC3: every Winners bye carries its lone competitor AS the winner and has NO opponent — the player is advanced, unplayed (AD-9)');
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBYE') and state = 'void'
      and (competitor_a is not null or competitor_b is not null or winner_entry is not null)),
  0,
  'AC3: the void Losers node persists with NO competitors and NO winner — both its feeders were byes, so nothing can ever arrive');

-- ============================================================================
-- Section C — refusals: single-shot, the state/roster guards, and the UNTRUSTED PAYLOAD.
-- Every refusal must write NOTHING. (15 assertions)
-- ============================================================================
-- SINGLE-SHOT (D2): the very same call again, now that TGEN is live.
create temp table gen2 as
select public.generate_bracket(
         pg_temp.tid('TGEN'), '76561197960287930', '{}'::jsonb,
         pg_temp.seeds('TGEN', 8), pg_temp.matches8('TGEN')
       ) as r;
select is((select r ->> 'reason' from gen2), 'already_live',
  'D2 SINGLE-SHOT: a second generate on a live bracket is REFUSED with already_live');
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TGEN')), 14,
  'D2 SINGLE-SHOT: …and it did NOT duplicate the bracket — still exactly 14 rows (the whole point)');

-- Wrong state: registration is still open.
create temp table gen3 as
select public.generate_bracket(
         pg_temp.tid('TOPEN'), '76561197960287930', '{}'::jsonb,
         pg_temp.seeds('TOPEN', 8), pg_temp.matches8('TOPEN')
       ) as r;
select is((select r ->> 'reason' from gen3), 'not_closed',
  'generate_bracket: a still-OPEN registration is refused (close the roster first)');
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TOPEN')), 0,
  'generate_bracket: the not_closed refusal wrote NO match rows (every guard precedes every write)');
select is((select state from tournament where id = pg_temp.tid('TOPEN')), 'registration_open',
  'generate_bracket: the not_closed refusal did NOT flip the state');

-- No such tournament.
select is(
  (select public.generate_bracket(999999, '76561197960287930', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb) ->> 'reason'),
  'bad_tournament',
  'generate_bracket: an unknown tournament_id is refused with bad_tournament');

-- OPTIMISTIC CONCURRENCY: the seed set does not match the roster that actually exists under the lock.
-- (Simulates a roster add/remove landing between the caller's read and the RPC's FOR UPDATE.)
create temp table gen4 as
select public.generate_bracket(
         pg_temp.tid('TSTALE'), '76561197960287930', '{}'::jsonb,
         pg_temp.seeds('TSTALE', 7),   -- 7 of the 8 actual entries: a stale view of the field
         pg_temp.matches8('TSTALE')
       ) as r;
select is((select r ->> 'reason' from gen4), 'roster_changed',
  'D2: a seed set that does not match the ACTIVE roster under the lock is refused with roster_changed');
select is((select count(*)::int from match where tournament_id = pg_temp.tid('TSTALE')), 0,
  'D2: the roster_changed refusal wrote NO match rows');
select is((select count(*)::int from roster_entry where tournament_id = pg_temp.tid('TSTALE') and bracket_seed is not null), 0,
  'D2: the roster_changed refusal recorded NO bracket_seed either — a refusal is atomic-nothing, not partial');

-- Field bounds (AC1): only reachable by a DIRECT RPC call, since the lib refuses first. That is exactly
-- why the guard is in the DB: the caller is not the authority.
select is(
  (select public.generate_bracket(pg_temp.tid('TSMALL'), '76561197960287930', '{}'::jsonb,
                                  pg_temp.seeds('TSMALL', 3), '[]'::jsonb) ->> 'reason'),
  'bad_field_count',
  'AC1: a 3-player field is refused with bad_field_count (the 8..16 floor is enforced in the DB, not just the lib)');

-- ⭐ THE PAYLOAD IS NOT TRUSTED. Without these guards an empty p_matches would insert nothing, still flip
-- the state to bracket_live, still audit, and still return ok:true — leaving a LIVE tournament with NO
-- bracket, a roster frozen by the trigger, a retry refused as already_live, and no DELETE grant on `match`
-- to clean up. Unrecoverable. The slot-uniqueness index is no backstop: it catches duplicate rows, never
-- MISSING ones.
create temp table gen5 as
select public.generate_bracket(
         pg_temp.tid('TSKEL'), '76561197960287930', '{}'::jsonb,
         pg_temp.seeds('TSKEL', 8),
         '[]'::jsonb                    -- an EMPTY skeleton for a valid, closed, 8-player field
       ) as r;
select is((select r ->> 'reason' from gen5), 'bad_skeleton',
  'D2: an incomplete p_matches is REFUSED (an 8-field needs exactly 2*8-2 = 14 rows)');
select is((select state from tournament where id = pg_temp.tid('TSKEL')), 'registration_closed',
  'D2: the bad_skeleton refusal did NOT flip the state — this is the assertion that stands between a typo and an unrecoverable tournament');
select is((select count(*)::int from roster_entry where tournament_id = pg_temp.tid('TSKEL') and bracket_seed is not null), 0,
  'D2: the bad_skeleton refusal recorded NO bracket_seed');
select is((select count(*)::int from audit_log where tournament_id = pg_temp.tid('TSKEL')), 0,
  'D2: the bad_skeleton refusal wrote NO audit row (the guard precedes every write, audit included)');

-- p_seeds must be a PERMUTATION of 1..N. The roster_changed guard only compares the id SET, so without
-- this the seed VALUES are written to roster_entry.bracket_seed unchecked — and bracket_seed carries no
-- CHECK and no UNIQUE. Duplicate positions would silently void AC1's "the positions are the artifact".
select is(
  (select public.generate_bracket(
            pg_temp.tid('TSEED'), '76561197960287930', '{}'::jsonb,
            (select jsonb_agg(jsonb_build_object('roster_entry_id', pg_temp.re('TSEED', s), 'seed', 1))
               from generate_series(1, 8) as s),   -- every entry claims seed 1
            pg_temp.matches8('TSEED')) ->> 'reason'),
  'bad_seeds',
  'AC1: a p_seeds whose positions are not a permutation of 1..N is REFUSED (here: eight entries all claiming seed 1)');

-- ============================================================================
-- Section D — D3: the roster-lock trigger BITES (11 assertions)
-- ============================================================================
-- The window this closes: adminAddPlayer/removePlayer read tournament.state, then write roster_entry in
-- a SEPARATE statement; enrollSelf never checked the state at all. Until this story there was no writer
-- that flipped the state, so the race was unexploitable. generate_bracket IS that writer.

-- TGEN was JUST generated by Section B — it is genuinely bracket_live now. This is the real scenario.
select throws_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287931') $$, pg_temp.tid('TGEN')),
  'P0001', null,
  'D3: enrollSelf/adminAddPlayer CANNOT add a player to a tournament whose bracket was just generated (the trigger rejects the INSERT)');
select throws_ok(
  format($$ update roster_entry set status = 'removed' where tournament_id = %s $$, pg_temp.tid('TGEN')),
  'P0001', null,
  'D3: removePlayer CANNOT soft-remove a player once the bracket is live (the trigger rejects the UPDATE — removal is an UPDATE, so it IS covered)');

-- The same, on a tournament that was bracket_live from the start (not via generation).
select throws_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287932') $$, pg_temp.tid('TLIVE')),
  'P0001', null,
  'D3: a roster INSERT into any bracket_live tournament is rejected');
select throws_ok(
  format($$ update roster_entry set status = 'removed' where tournament_id = %s $$, pg_temp.tid('TLIVE')),
  'P0001', null,
  'D3: a roster UPDATE on any bracket_live tournament is rejected');

-- BOTH ENDS OF A MOVE. Guarding only NEW.tournament_id would let a seeded entry be moved OUT of a frozen
-- roster into a still-open event — NEW is mutable, so the guard would pass — while the live bracket's
-- match rows still reference that entry by id.
select throws_ok(
  format($$ update roster_entry set tournament_id = %s
             where tournament_id = %s and steamid64 = '76561197960287821' $$,
         pg_temp.tid('TSMALL'), pg_temp.tid('TLIVE')),
  'P0001', null,
  'D3: an entry CANNOT be moved OUT of a bracket_live roster into a mutable one — the ORIGIN is checked too, not just the destination');
select lives_ok(
  format($$ update roster_entry set tournament_id = %s
             where tournament_id = %s and steamid64 = '76561197960287801' $$,
         pg_temp.tid('TSMALL'), pg_temp.tid('TOPEN')),
  'D3: a move between two MUTABLE tournaments still LIVES (the origin check does not over-reach)');

-- …and it does NOT over-reach: both MUTABLE states still accept roster writes (the lock is a lock, not a freeze).
select lives_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287933') $$, pg_temp.tid('TMUT')),
  'D3: a roster INSERT while registration_open still LIVES (the trigger does not over-reach)');
select lives_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287934') $$, pg_temp.tid('TSMALL')),
  'D3: a roster INSERT while registration_CLOSED still LIVES — an admin may add after close (prd.md:150), and the lock must not break that');

-- Every non-mutable state is locked, not just bracket_live.
update tournament set state = 'ceremony' where name = 'TMUT';
select throws_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287935') $$, pg_temp.tid('TMUT')),
  'P0001', null,
  'D3: ceremony (and by the same predicate, closed) is locked too — the guard is the mutable-state whitelist, not a bracket_live special case');

-- The trigger must not MASK the column constraints. A BEFORE ROW trigger runs BEFORE NOT NULL / FK, so a
-- careless guard reports its own error for what is really a constraint violation and the caller gets the
-- wrong SQLSTATE. (This is not hypothetical: the first cut of this trigger did exactly that, and
-- 0004_roster_test test 10 caught it.) The trigger owns the LOCK; the column owns its own validity.
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64) values (null, '76561197960287937') $$,
  '23502', null,
  'D3: a NULL tournament_id still reports NOT NULL (23502) — the trigger short-circuits rather than masking the column constraint');
select throws_ok(
  $$ insert into roster_entry (tournament_id, steamid64) values (999999, '76561197960287937') $$,
  '23503', null,
  'D3: a non-existent tournament_id still reports the FK SQLSTATE (23503) — fail-closed, and indistinguishable from an RLS-hidden parent by design');

-- ============================================================================
-- Section E — the privileged writer: the grants genuinely work, and the trigger bites it too
-- (3 assertions)
-- ============================================================================
set local role service_role;
-- The whole transaction as the REAL caller: SELECT+UPDATE tournament (the FOR UPDATE lock), UPDATE
-- roster_entry (which fires the trigger, whose FOR KEY SHARE needs UPDATE on tournament too), INSERT
-- match, INSERT audit_log, EXECUTE the function AND its lock-predicate helper. If ANY grant in that chain
-- were missing this 42501s.
select is(
  (select public.generate_bracket(
            pg_temp.tid('TSVC'), '76561197960287930',
            '{"algorithm":"fisher-yates"}'::jsonb,
            pg_temp.seeds('TSVC', 8), pg_temp.matches8('TSVC')) ->> 'ok'),
  'true',
  'service_role executes the ENTIRE generate_bracket transaction end-to-end — the 0002/0004/0010/0011 grant matrix genuinely permits the single writer');
select is((select state from tournament where id = pg_temp.tid('TSVC')), 'bracket_live',
  'service_role''s generation committed: TSVC is bracket_live');

-- The teeth: BYPASSRLS lets service_role skip row POLICIES, but it does NOT skip TRIGGERS. The roster
-- lock therefore bites the privileged writer too — which is the only reason it is a real guard at all
-- (every roster write in this app goes through the service role).
select throws_ok(
  format($$ insert into roster_entry (tournament_id, steamid64) values (%s, '76561197960287936') $$, pg_temp.tid('TSVC')),
  'P0001', null,
  'D3: the trigger rejects even SERVICE_ROLE once the bracket is live — BYPASSRLS skips policies, never triggers (this is what makes the guard real)');
set local role postgres;

select * from finish();

rollback;
