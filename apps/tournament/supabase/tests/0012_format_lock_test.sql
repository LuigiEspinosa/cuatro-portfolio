-- supabase/tests/0012_format_lock_test.sql
-- pgTAP proof for migration 0012 (Story 4.2): the AD-10 format lock. Run via: supabase test db
--   D3   the override flag exists ON THE RECORD and is NULL until an override happens      -> Section A
--   AC1  a match cannot reach a PLAYED state with an unlocked format — and the four NEVER-
--        PLAYED states are still reachable without one (the exclusions are pinned)         -> Section B
--   AC1  a lock must lock something REAL (NULL / blank / TAB format or tie_policy)         -> Section C
--   AC2  the SILENT EDIT IS IMPOSSIBLE — proven against `service_role`, the writer that
--        actually exists: the frozen columns, the LATCH, the unaudited first declare, the
--        forged D3 flag, AND the forged GUC that the first cut of 0012 was gated on        -> Section D
--   AC2  the audited override WORKS, flags the record (D3), and lands the audit row        -> Section E
--   AC2  an audit row authorizes exactly the ONE change it describes — not an open window  -> Section F
--   D2   BULK declare locks exactly the `declared` rows and leaves bye/void untouched      -> Section G
--   AC2  every refusal returns its typed reason AND WRITES NOTHING                         -> Section H
--   AD-8 the EXECUTE grant matrix (service_role only)                                      -> Section I
-- Runs inside a transaction and rolls back — no data persists.
--
-- ⚠ WHY SECTION D RUNS AS `service_role` AND NOT `postgres`. That is the ENTIRE POINT of D1. service_role
-- holds UPDATE on `match` (0010:227) and has BYPASSRLS, so no policy and no route-level discipline can
-- stop a future story's `update match set format = …`. BYPASSRLS skips POLICIES; it never skips TRIGGERS.
-- A test that only proved the lock bites `postgres` would prove nothing about the writer this app has.
--
-- ⚠ SECTION D CARRIES THE CODE-REVIEW REGRESSION PINS. The first cut of 0012 gated the override on a
-- transaction-local GUC (`inclusivcup.format_override`). That is a PGC_USERSET placeholder — ANY role can
-- arm it — so the review executed a two-line silent edit as service_role and it COMMITTED with zero audit
-- rows. The gate is now the AUDIT ROW itself, and D4/D5/D6/D7 pin every hole that cut had open.
--
-- ⚠ SECTIONS E/G ASSERT COLUMN VALUES, NOT ROW COUNTS. Story 4.1's code review found its suite "proved
-- materially less than it claimed" because it asserted row COUNTS — a broken JSONB key would have NULLed
-- every column with the suite fully green. So the audit row's `detail` is asserted down to BOTH keys of
-- BOTH halves of its before/after payload, not merely its existence and not merely `format`.
--
-- SQLSTATE: 23514 = the CHECK constraints (Sections B/C); P0001 = a trigger's refusal (Sections D/F).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: 63 at implementation -> 78 after the code review (2026-07-13). +15: Section C +1 (the TAB that
-- `btrim()` let through), Section D +4 (the forged GUC, the unaudited raw declare, and forging/erasing the
-- D3 flag), Section E +4 (the before/after payload asserted on tie_policy and format_locked, not just
-- format), Section F +1 (the GUC no-leak test becomes the stronger "an audit row authorizes exactly the
-- change it describes" — plus the badge-erase half), Section G +1 (the badge-FORGE half), Section H +5
-- (`not_declarable`, `not_overridable`, a TAB `bad_format`, and the two nothing-was-written halves they
-- need). Exact assertion-accounting is a standing convention.
--
-- The two ⭐⭐ assertions (F2, G10) were found by the post-patch LIVE RUN, not by this suite: a transaction
-- that had legitimately declared a match could still forge/erase that match's D3 badge on the back of its
-- own audit row. Written here so the suite catches it next time instead of the human gate.
select plan(78);

-- ── Fixture (as postgres, bypasses RLS) ─────────────────────────────────────
-- No roster_entry is needed: match competitors are nullable, and this story is about the format columns,
-- not the bracket edges. A `player` IS needed — audit_log.actor_steamid64 has an FK to it (0003:24).
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
insert into season (name) values ('Season 1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'Season 1'), 'TFMT'),    -- the CHECK/trigger/override playground
         ((select id from season where name = 'Season 1'), 'TBULK'),   -- the D2 bulk-declare bracket
         ((select id from season where name = 'Season 1'), 'TOTHER');  -- a foreign event -> `bad_match`

create function pg_temp.tid(tname text) returns bigint language sql stable as $fn$
  select id from public.tournament where name = tname
$fn$;

-- The match at (tournament, winners-slot). Every fixture row below is a 'winners' row, so the slot alone
-- names it unambiguously (match_slot_uniq guarantees that).
create function pg_temp.mid(tname text, slot int) returns bigint language sql stable as $fn$
  select m.id
    from public.match m
    join public.tournament t on t.id = m.tournament_id
   where t.name = tname and m.bracket = 'winners' and m.bracket_slot = slot
$fn$;

-- TFMT — one row per scenario, so each assertion is independent of the others' mutations.
--   1 = unlocked            -> Section C's CHECK tests; Section D's UNAUDITED RAW DECLARE refusal
--   2 = locked              -> Section A (the flag is NULL); Section B (the played states, once locked)
--   3 = unlocked            -> Section B: the four NEVER-PLAYED states stay reachable while unlocked
--   4 = locked              -> Section D: the silent edit, the latch, the forged GUC, the forged D3 flag
--   5 = unlocked            -> Section D (a PRE-lock format is still free); Section H (bad_format /
--                              not_overridable)
--   6 = locked              -> Sections E/F: the audited override, and the authorizes-exactly-one proof
--   7 = locked              -> Section H: `already_locked`
--   8 = locked + OVERRIDDEN -> Section D: ERASING the D3 flag is refused. It carries a stamped
--        (at INSERT)           format_overridden_at but NO audit row in this transaction, which is exactly
--                              the shape of a match overridden by some EARLIER transaction.
--        (INSERT is deliberately unguarded — see 0012. Only UPDATE is gated, so a fixture may be born locked.)
--
-- ⚠ STORY 4.3 (D1): every `winners` row now carries ROUTING EDGES. Migration 0013's
-- `match_routing_complete` CHECK makes a bracket row with no way out UNREPRESENTABLE, and these fixtures
-- are hand-built match rows, not generated brackets — so they must declare an exit like any other row.
-- The target (slot 999) is deliberately non-existent: the CHECK's contract is that a row DECLARES an
-- exit, not that the exit resolves (there is no self-FK). Nothing in this suite advances these rows.
-- It also keeps this suite HONEST: a routing-CHECK violation is 23514, the same SQLSTATE the format
-- CHECKs below assert — so a fixture without edges would let those tests pass for the wrong reason.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state, format, tie_policy, format_locked, format_overridden_at,
                   winner_to_bracket, winner_to_slot, winner_to_side, loser_to_bracket, loser_to_slot, loser_to_side)
select pg_temp.tid('TFMT'), 'winners', 'Winners R1', v.slot, 'declared', v.fmt, v.tie, v.locked, v.ovr,
       'winners', 999, 'a', 'losers', 999, 'a'
  from (values
    (1, null,   null,     false, null::timestamptz),
    (2, 'mr12', 'ot_mr3', true,  null),
    (3, null,   null,     false, null),
    (4, 'mr12', 'ot_mr3', true,  null),
    (5, null,   null,     false, null),
    (6, 'mr12', 'ot_mr3', true,  null),
    (7, 'mr12', 'ot_mr3', true,  null),
    (8, 'mr12', 'ot_mr3', true,  now())
  ) as v(slot, fmt, tie, locked, ovr);

-- TBULK — a bracket-shaped field for D2: 4 playable nodes + the never-played rows generation emits.
-- Slots 5/6 are 'bye' walkovers and slot 7 is a 'void' node (both feeders were byes) — exactly what
-- Story 4.1 generates for a non-power-of-two field, and exactly what the bulk declare must NOT touch.
-- Slot 5 doubles as Section H's `not_declarable` target: the TARGETED path must refuse it too, which is
-- the bug the review found (the first cut filtered `state = 'declared'` on the BULK path only, so one
-- route call could irreversibly lock a format onto a bye — and the LATCH made that unrecoverable).
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   winner_to_bracket, winner_to_slot, winner_to_side, loser_to_bracket, loser_to_slot, loser_to_side)
select pg_temp.tid('TBULK'), 'winners', 'Winners R1', v.slot, v.st,
       'winners', 999, 'a', 'losers', 999, 'a'
  from (values
    (1, 'declared'), (2, 'declared'), (3, 'declared'), (4, 'declared'),
    (5, 'bye'), (6, 'bye'), (7, 'void')
  ) as v(slot, st);

-- TOTHER — a single match in a DIFFERENT event. Targeting it from TFMT must be refused `bad_match`.
insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                   winner_to_bracket, winner_to_slot, winner_to_side, loser_to_bracket, loser_to_slot, loser_to_side)
  values (pg_temp.tid('TOTHER'), 'winners', 'Winners R1', 1, 'declared',
          'winners', 999, 'a', 'losers', 999, 'a');

-- The RPC returns jsonb. Capture each call ONCE (calling it twice would double-write) and assert against
-- the captured reply. Created as postgres and GRANTed, because Sections E/G/H invoke the RPC as
-- service_role — which owns no temp schema of its own here.
create temp table rpc_log (tag text primary key, r jsonb);
grant insert, select on rpc_log to service_role;

-- ============================================================================
-- Section A — D3: the override flag exists on the record (3 assertions)
-- ============================================================================
select has_column('public', 'match', 'format_overridden_at',
  'match: format_overridden_at exists — FR-10 requires the override be visible ON THE MATCH RECORD, not only in audit_log (D3)');
select col_type_is('public', 'match', 'format_overridden_at', 'timestamp with time zone',
  'match: format_overridden_at is timestamptz (WHEN the override happened, not merely that it did)');
select is(
  (select format_overridden_at from match where id = pg_temp.mid('TFMT', 2)),
  null::timestamptz,
  'match: format_overridden_at is NULL on a declared-but-never-overridden match (NULL = never overridden)'
);

-- ============================================================================
-- Section B — AC1: `match_live_requires_locked_format` bites (13 assertions)
-- ============================================================================
-- The teeth. No route owns the `declared -> live` transition yet (no Epic-4 story claims it), so the
-- guard is proven where it actually lives: against ANY writer, at the SQL layer.

-- An UNLOCKED match cannot reach any PLAYED state.
select throws_ok(
  $$ update match set state = 'live' where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: an UNLOCKED match cannot go LIVE — the format must be declared and frozen BEFORE the match starts'
);
select throws_ok(
  $$ update match set state = 'pending' where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: an UNLOCKED match cannot reach pending (a played match that never had a declared format)'
);
select throws_ok(
  $$ update match set state = 'resolved' where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: an UNLOCKED match cannot reach resolved'
);
select throws_ok(
  $$ update match set state = 'manual_resolved' where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: an UNLOCKED match cannot reach manual_resolved (Story 4.8 inherits a lock it cannot bypass)'
);
-- The CHECK is a TABLE constraint, so it constrains INSERT too — not merely the UPDATE path.
-- (Edges supplied so the ONLY thing this row can violate is match_live_requires_locked_format — see the
-- fixture note: match_routing_complete raises the same 23514 and would otherwise mask it.)
select throws_ok(
  $$ insert into match (tournament_id, bracket, bracket_position, bracket_slot, state,
                        winner_to_bracket, winner_to_slot, winner_to_side,
                        loser_to_bracket, loser_to_slot, loser_to_side)
       values (pg_temp.tid('TFMT'), 'winners', 'Winners R9', 99, 'live',
               'winners', 999, 'a', 'losers', 999, 'a') $$,
  '23514', null,
  'AC1: a match cannot be INSERTED straight into live with no locked format (the CHECK binds every writer, not just UPDATEs)'
);

-- A LOCKED match moves through the played states freely. (Same row, cycled — the state column carries no
-- transition CHECK; what is being proven is that the FORMAT gate is satisfied, not the lifecycle order.
-- None of these touch a format column, so `match_format_audited` is a no-op for them — which is exactly
-- what keeps Story 4.3/4.5/4.6's writes ungated.)
select lives_ok(
  $$ update match set state = 'live' where id = pg_temp.mid('TFMT', 2) $$,
  'AC1: a LOCKED match goes live — this is the whole point: declare first, then play'
);
select lives_ok(
  $$ update match set state = 'pending' where id = pg_temp.mid('TFMT', 2) $$,
  'AC1: a LOCKED match reaches pending'
);
select lives_ok(
  $$ update match set state = 'resolved' where id = pg_temp.mid('TFMT', 2) $$,
  'AC1: a LOCKED match reaches resolved'
);
select lives_ok(
  $$ update match set state = 'manual_resolved' where id = pg_temp.mid('TFMT', 2) $$,
  'AC1: a LOCKED match reaches manual_resolved'
);

-- ⭐ THE EXCLUSIONS ARE DELIBERATE — PIN THEM. bye/void/forfeit/awaiting_grace are NEVER PLAYED and
-- produce zero stats (AD-9). A regression that "helpfully" tightened the CHECK to cover them would make
-- Story 4.1's already-generated bye/void rows unrepresentable and would block Story 4.5's forfeit path
-- outright — while every assertion above stayed green. These four turn that regression RED.
select lives_ok(
  $$ update match set state = 'bye' where id = pg_temp.mid('TFMT', 3) $$,
  'AC1 exclusion: a BYE needs no format — it is a walkover, never played (AD-9). Story 4.1 generates these.'
);
select lives_ok(
  $$ update match set state = 'void' where id = pg_temp.mid('TFMT', 3) $$,
  'AC1 exclusion: a VOID node needs no format — nothing can ever reach it (AD-9)'
);
select lives_ok(
  $$ update match set state = 'forfeit' where id = pg_temp.mid('TFMT', 3) $$,
  'AC1 exclusion: a FORFEIT needs no format — it is a no-show walkover, never played (Story 4.5)'
);
select lives_ok(
  $$ update match set state = 'awaiting_grace' where id = pg_temp.mid('TFMT', 3) $$,
  'AC1 exclusion: awaiting_grace needs no format — the 10-min grace timer runs BEFORE a match is played (Story 4.5)'
);

-- ============================================================================
-- Section C — AC1: `match_format_lock_complete` — a lock must lock something REAL (5 assertions)
-- ============================================================================
-- Without this, `format_locked = true` with `format = NULL` would sail through the live-gate CHECK above
-- while having declared NOTHING. The lock would be a lie.
--
-- These all target slot 1, and every one of them FAILS — so slot 1 stays UNLOCKED, which is what Section D
-- needs it for. (There is no `lives_ok` here any more: a raw declaration is now refused by
-- `match_format_audited` regardless of how complete it is — see D5 — and "the CHECK permits the real thing"
-- is proven by every successful RPC call in Sections E and G.)
select throws_ok(
  $$ update match set format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: format_locked=true with a NULL format is REJECTED — a lock that locks nothing is not a lock'
);
select throws_ok(
  $$ update match set format = '   ', tie_policy = 'ot_mr3', format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: format_locked=true with a BLANK format is REJECTED (whitespace is not a declaration)'
);
-- ⭐ THE TAB. `btrim(x)` with no second argument trims SPACES ONLY, so the first cut's `btrim(format) <> ''`
-- happily accepted E'\t' and latched it PERMANENTLY. `~ '[^[:space:]]'` is what actually means "non-blank".
select throws_ok(
  $$ update match set format = E'\t', tie_policy = 'ot_mr3', format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: format_locked=true with a TAB format is REJECTED — btrim() trims SPACES ONLY, so a tab used to sail through and latch forever'
);
select throws_ok(
  $$ update match set format = 'mr12', tie_policy = null, format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: format_locked=true with a NULL tie_policy is REJECTED — AD-10 freezes BOTH, not just the format'
);
select throws_ok(
  $$ update match set format = 'mr12', tie_policy = '', format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  '23514', null,
  'AC1: format_locked=true with a BLANK tie_policy is REJECTED'
);

-- ============================================================================
-- Section D — AC2/D1: the silent edit is IMPOSSIBLE, as service_role (9 assertions)
-- ============================================================================
set local role service_role;

select throws_ok(
  $$ update match set format = 'mr8' where id = pg_temp.mid('TFMT', 4) $$,
  'P0001', null,
  'AC2/D1: service_role CANNOT silently edit a locked format — BYPASSRLS skips policies, NEVER triggers. This is the writer that actually exists.'
);
select throws_ok(
  $$ update match set tie_policy = 'draw' where id = pg_temp.mid('TFMT', 4) $$,
  'P0001', null,
  'AC2/D1: service_role CANNOT silently edit a locked tie_policy either — AD-10 freezes both columns'
);
-- ⭐ THE LATCH. Without it the silent edit is trivially reachable as unlock -> edit -> relock, leaving no
-- audit trace at all: the audited-change gate would never even see a locked row.
select throws_ok(
  $$ update match set format_locked = false where id = pg_temp.mid('TFMT', 4) $$,
  'P0001', null,
  'AC2/D1: format_locked is a LATCH — there is no unlock, so the unlock->edit->relock bypass is CLOSED'
);

-- ⭐⭐ THE CODE-REVIEW REGRESSION PIN. The first cut of 0012 gated the override on this exact GUC, and the
-- review executed precisely these two statements as service_role: the silent edit COMMITTED, with zero
-- audit rows. A dotted custom GUC is a PGC_USERSET placeholder — any role can arm it, including the one the
-- guard exists to constrain. The gate is now the AUDIT ROW, so arming a flag buys nothing. If someone ever
-- reintroduces a GUC-gated override, this assertion goes RED.
set local inclusivcup.format_override = 'on';
select throws_ok(
  $$ update match set format = 'FORGED' where id = pg_temp.mid('TFMT', 4) $$,
  'P0001', null,
  'AC2/D1 ⭐: arming the old inclusivcup.format_override GUC by hand changes NOTHING — the gate is the audit row, not a flag any role can mint for itself'
);
set local inclusivcup.format_override = 'off';

-- ⭐ THE UNAUDITED FIRST DECLARE. Both rules of the first cut keyed on `old.format_locked`, so the
-- false -> true transition was wide open: a raw UPDATE latched a format permanently with no audit row, no
-- actor and no RPC — and the row then read as legitimately declared (format_overridden_at IS NULL = "never
-- overridden"). Slot 1 is unlocked and this declaration is COMPLETE and CHECK-valid; it is refused anyway,
-- because it is not audited.
select throws_ok(
  $$ update match set format = 'mr12', tie_policy = 'ot_mr3', format_locked = true where id = pg_temp.mid('TFMT', 1) $$,
  'P0001', null,
  'AC2/D1 ⭐: even a COMPLETE, CHECK-valid raw DECLARATION is refused — a format cannot be locked without a declare_format audit row from the same transaction'
);

-- ⭐ D3'S FLAG IS ITSELF GUARDED. Nothing protected it in the first cut: service_role could forge an
-- override badge onto a never-overridden match, or NULL an existing one away, in silence. "Visible ON THE
-- MATCH RECORD" (FR-10) is not satisfied by a column any writer can quietly rewrite.
select throws_ok(
  $$ update match set format_overridden_at = now() where id = pg_temp.mid('TFMT', 4) $$,
  'P0001', null,
  'D3: FORGING the override flag onto a never-overridden match is refused — writes to format_overridden_at are audited too'
);
select throws_ok(
  $$ update match set format_overridden_at = null where id = pg_temp.mid('TFMT', 8) $$,
  'P0001', null,
  'D3: ERASING the override flag from an overridden match is refused — the record-side flag is as tamper-evident as the audit row'
);

-- STAY IN LANE: the trigger must be a NO-OP for every write that is not a format write, or it would break
-- Story 4.3 (winner_entry), 4.5 (state) and 4.6 (score_*) the moment they ship.
select lives_ok(
  $$ update match set score_a = 16, score_b = 14 where id = pg_temp.mid('TFMT', 4) $$,
  'AC2: the trigger does NOT gate unrelated columns — a locked match still takes its score (4.6), winner (4.3) and state (4.5)'
);
-- A PRE-lock format is not frozen — freezing is what `format_locked` MEANS. (This also leaves slot 5 with
-- format = 'mr8' and format_locked = false, which Section H's refusals rely on.)
select lives_ok(
  $$ update match set format = 'mr8' where id = pg_temp.mid('TFMT', 5) $$,
  'AC2: an UNLOCKED match''s format is still freely editable — the trigger guards the LOCK, not the column'
);

set local role postgres;

-- ============================================================================
-- Section E — AC2/D3: the audited override works, flags the record, and audits (17 assertions)
-- ============================================================================
-- The override is the ONLY way a frozen format changes. It runs as service_role — the real writer — and it
-- must leave three traces: the new values, the D3 flag on the record, and the AD-17 audit row.
set local role service_role;
insert into rpc_log
select 'override', public.declare_match_format(
  pg_temp.tid('TFMT'),
  array[pg_temp.mid('TFMT', 6)],
  'mr8', 'draw',
  '76561197960287930',
  true
);
set local role postgres;

select is((select r->>'ok'              from rpc_log where tag = 'override'), 'true',
  'AC2: the audited override on a FROZEN match SUCCEEDS — a change is permitted, but only through this door');
select is((select (r->>'declared')::int from rpc_log where tag = 'override'), 1,
  'AC2: the override reports exactly the 1 match it changed');
select is((select r->>'override'        from rpc_log where tag = 'override'), 'true',
  'AC2: the reply says override=true — the caller is told this was an override, not a first declare');

select is((select format     from match where id = pg_temp.mid('TFMT', 6)), 'mr8',
  'AC2: the override actually CHANGED the frozen format (mr12 -> mr8)');
select is((select tie_policy from match where id = pg_temp.mid('TFMT', 6)), 'draw',
  'AC2: the override actually CHANGED the frozen tie_policy (ot_mr3 -> draw)');
select is((select format_locked from match where id = pg_temp.mid('TFMT', 6)), true,
  'AC2: the match is STILL LOCKED after the override — an override never unlocks (a correction, not an escape hatch)');
-- ⭐ D3: "the declared format and any manual override are visible ON THE MATCH RECORD" (prd.md:216).
select isnt((select format_overridden_at from match where id = pg_temp.mid('TFMT', 6)), null::timestamptz,
  'D3: format_overridden_at is STAMPED — the override is FLAGGED ON THE RECORD, not only in audit_log (FR-10 / EXPERIENCE:122)');

-- The audit row (AD-17). ⚠ ASSERT ITS COLUMN VALUES, NOT ITS EXISTENCE — the 4.1 review's headline lesson
-- was that a suite asserting only counts stays fully green through a broken JSONB payload. The code review
-- of THIS story found the same lesson half-learned: only `format` was asserted, so a typo in any of the
-- other four jsonb_build_object keys would have NULLed the payload with the suite green. All six now.
select is(
  (select count(*)::int from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  1,
  'AD-17: EXACTLY ONE declare_format audit row was written — the override is audited, in the same transaction'
);
select is(
  (select target_match_id from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  pg_temp.mid('TFMT', 6),
  'AD-17: the audit row populates target_match_id — the FIRST rows in the codebase to do so (0003:26 deferred its FK to Epic 4; 4.1 closed it)'
);
select is(
  (select actor_steamid64 from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  '76561197960287930',
  'AD-17: the audit row records WHO overrode the format'
);
select is(
  (select detail -> 'before' ->> 'format' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'mr12',
  'AD-17: detail.before carries the REAL prior format (mr12) — a broken JSONB key would NULL this while a count-only assertion stayed green'
);
select is(
  (select detail -> 'before' ->> 'tie_policy' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'ot_mr3',
  'AD-17: detail.before carries the prior tie_policy too — AD-10 freezes BOTH columns, so BOTH must be in the before/after'
);
select is(
  (select detail -> 'before' ->> 'format_locked' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'true',
  'AD-17: detail.before records that the match WAS ALREADY LOCKED — that is what makes this an override rather than a declaration'
);
select is(
  (select detail -> 'after' ->> 'format' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'mr8',
  'AD-17: detail.after carries the new format (mr8) — before/after, as AD-17 requires'
);
select is(
  (select detail -> 'after' ->> 'tie_policy' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'draw',
  'AD-17: detail.after carries the new tie_policy (draw) — and this key is LOAD-BEARING: match_format_audited matches the UPDATE against it'
);
select is(
  (select detail -> 'after' ->> 'format_locked' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'true',
  'AD-17: detail.after records that the match stays LOCKED — also load-bearing: the gate matches the UPDATE against this key'
);
select is(
  (select detail ->> 'override' from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  'true',
  'AD-17: detail.override flags this as an override rather than a first declaration'
);

-- ============================================================================
-- Section F — AC2: an audit row authorizes exactly the ONE change it describes (2 assertions)
-- ============================================================================
-- ⭐ THE MOST IMPORTANT ASSERTIONS IN THIS FILE, and they replace the first cut's "the GUC did not leak"
-- test with something strictly stronger. `match_format_audited` matches the UPDATE against the audit row's
-- `after` payload — so the row that authorized (mr8, draw) authorizes ONLY (mr8, draw). We are still in the
-- very same transaction as the override above, and the audit row is right there, and these edits are STILL
-- refused. Without the payload match, an audit row would be an open window for the rest of the transaction
-- (exactly the "set once, edit many" weakness the old GUC's set_config(…,'off') reset existed to close) —
-- and Story 4.6 WILL call this RPC inside a larger transaction.
set local role service_role;
select throws_ok(
  $$ update match set format = 'mr12' where id = pg_temp.mid('TFMT', 6) $$,
  'P0001', null,
  'AC2 ⭐: an audit row authorizes exactly the change it DESCRIBES — a second, different edit of the same match in the SAME transaction is still refused'
);
-- ⭐⭐ FOUND BY THE POST-PATCH LIVE RUN, NOT BY THIS SUITE — which is exactly why it is pinned here now.
-- Section D proves the D3 badge cannot be erased on a match with NO audit row in this transaction. That is
-- the easy half. The HARD half is a transaction that legitimately declared/overrode the match and then
-- tries to tamper with the badge on the back of its own audit row. The gate ties the badge to the row that
-- authorized it — `detail.override = true` <=> `format_overridden_at IS NOT NULL` — so the override's own
-- audit row cannot license un-flagging the record it just flagged.
select throws_ok(
  $$ update match set format_overridden_at = null where id = pg_temp.mid('TFMT', 6) $$,
  'P0001', null,
  'D3 ⭐: the override''s OWN audit row does not license ERASING the badge it just stamped — not even in the same transaction'
);
set local role postgres;

-- ============================================================================
-- Section G — D2: the BULK declare (9 assertions)
-- ============================================================================
-- An 11-player field is 30 match rows (4.1 live-QA, verified). A per-match-only API would need 30 HTTP
-- calls before the first match could start — so `p_match_ids => NULL` declares the whole tournament.
set local role service_role;
insert into rpc_log
select 'bulk', public.declare_match_format(
  pg_temp.tid('TBULK'), null, 'mr12', 'ot_mr3', '76561197960287930', false
);
set local role postgres;

select is((select r->>'ok'              from rpc_log where tag = 'bulk'), 'true',
  'D2: the bulk declare succeeds with no match_ids at all — one call declares the whole tournament');
select is((select (r->>'declared')::int from rpc_log where tag = 'bulk'), 4,
  'D2: it declared exactly the 4 `declared` rows — NOT the 2 byes and NOT the void node');
select is((select r->>'override'        from rpc_log where tag = 'bulk'), 'false',
  'D2: a first declaration is NOT an override');

select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBULK') and format_locked and format = 'mr12' and tie_policy = 'ot_mr3'),
  4,
  'D2: all 4 playable matches are now LOCKED with the declared format+tie_policy (column values, not just a count of touched rows). This is also the proof that match_format_lock_complete PERMITS a real declaration.'
);
-- ⭐ ASSERT BOTH HALVES. The bulk path must not touch what is never played (AD-9) — a bye/void row with a
-- locked format would be harmless noise today and a lie on the Epic-5 match card tomorrow.
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBULK') and state in ('bye', 'void') and format_locked),
  0,
  'D2: NOT ONE bye/void row was locked — they are never played (AD-9), so they are naturally excluded by `state = declared`'
);
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBULK') and state in ('bye', 'void') and format is not null),
  0,
  'D2: the bye/void rows still carry NO format at all — the bulk declare left them completely untouched'
);
-- D3, the other direction: a FIRST declare is not an override, so the flag must stay clean.
select is(
  (select count(*)::int from match
    where tournament_id = pg_temp.tid('TBULK') and format_overridden_at is not null),
  0,
  'D3: a first declaration leaves format_overridden_at NULL — the flag means OVERRIDDEN, not "has a format"'
);
select is(
  (select count(*)::int from audit_log
    where tournament_id = pg_temp.tid('TBULK') and action = 'declare_format'),
  4,
  'AD-17: ONE declare_format audit row PER MATCH (4), not one row for the whole batch — the audit is match-scoped'
);
select is(
  (select count(*)::int from audit_log
    where tournament_id = pg_temp.tid('TBULK') and action = 'declare_format' and target_match_id is null),
  0,
  'AD-17: every bulk audit row names its match in target_match_id — none left NULL'
);
-- ⭐⭐ THE OTHER HALF OF THE LIVE-RUN FINDING, AND THE ONE THAT ACTUALLY BIT. A first declare's audit row
-- says `override: false`, so it authorizes a row whose `format_overridden_at` IS NULL — and nothing else.
-- It therefore cannot be used, even by the transaction that wrote it, to FORGE an override badge onto a
-- match that was merely declared. (The pre-fix gate matched only format/tie_policy/format_locked, so this
-- exact UPDATE COMMITTED on the live database while this suite stayed green.)
set local role service_role;
select throws_ok(
  $$ update match set format_overridden_at = now() where id = pg_temp.mid('TBULK', 1) $$,
  'P0001', null,
  'D3 ⭐: a first declare''s OWN audit row (override:false) cannot license FORGING an override badge onto that match — not even in the same transaction'
);
set local role postgres;

-- ============================================================================
-- Section H — every refusal returns its typed reason AND WRITES NOTHING (16 assertions)
-- ============================================================================
-- The 0011 convention: expected outcomes are RETURNED as typed reasons, never raised — and every guard
-- runs BEFORE any write, so a refusal commits nothing.
set local role service_role;
insert into rpc_log
select 'bad_tournament', public.declare_match_format(
  999999, null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log
select 'bad_match', public.declare_match_format(
  pg_temp.tid('TFMT'), array[pg_temp.mid('TOTHER', 1)], 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log
select 'already_locked', public.declare_match_format(
  pg_temp.tid('TFMT'), array[pg_temp.mid('TFMT', 7)], 'mr8', 'draw', '76561197960287930', false);
insert into rpc_log
select 'override_needs_ids', public.declare_match_format(
  pg_temp.tid('TFMT'), null, 'mr8', 'draw', '76561197960287930', true);
-- TBULK is now fully locked by Section G, so the bulk target set resolves to EMPTY. Idempotent and HONEST:
-- a re-run refuses rather than silently reporting success over zero rows.
insert into rpc_log
select 'no_eligible_matches', public.declare_match_format(
  pg_temp.tid('TBULK'), null, 'mr12', 'ot_mr3', '76561197960287930', false);
insert into rpc_log
select 'bad_format', public.declare_match_format(
  pg_temp.tid('TFMT'), array[pg_temp.mid('TFMT', 5)], '   ', 'ot_mr3', '76561197960287930', false);
-- ⭐ The TAB — the value `btrim()` used to wave through, at the RPC layer this time.
insert into rpc_log
select 'bad_format_tab', public.declare_match_format(
  pg_temp.tid('TFMT'), array[pg_temp.mid('TFMT', 5)], E'\t', 'ot_mr3', '76561197960287930', false);
-- ⭐ The TARGETED path must apply the same state filter the BULK path does. The first cut did not, so one
-- route call could lock a format onto a bye — irreversibly, because format_locked is a latch.
insert into rpc_log
select 'not_declarable', public.declare_match_format(
  pg_temp.tid('TBULK'), array[pg_temp.mid('TBULK', 5)], 'mr12', 'ot_mr3', '76561197960287930', false);
-- ⭐ `override => true` must actually be overriding something. The first cut never checked, so an override
-- of a never-declared match stamped format_overridden_at and wrote an `override:true` audit row for what
-- was really a first declaration — inverting the very flag Epic 5 reads off the record.
insert into rpc_log
select 'not_overridable', public.declare_match_format(
  pg_temp.tid('TFMT'), array[pg_temp.mid('TFMT', 5)], 'mr8', 'draw', '76561197960287930', true);
set local role postgres;

select is((select r->>'reason' from rpc_log where tag = 'bad_tournament'), 'bad_tournament',
  'refusal: a tournament that does not exist -> bad_tournament (404)');
select is((select r->>'reason' from rpc_log where tag = 'bad_match'), 'bad_match',
  'refusal: a match id from ANOTHER tournament -> bad_match. The whole call fails; it never partially applies (4.1''s review lesson).');
select is((select r->>'reason' from rpc_log where tag = 'already_locked'), 'already_locked',
  'refusal: re-declaring a LOCKED match without override -> already_locked (409). This IS the silent edit, refused at the RPC.');
select is((select r->>'reason' from rpc_log where tag = 'override_needs_ids'), 'override_needs_ids',
  'refusal: override=true with NO match_ids -> override_needs_ids. An override is surgical; you cannot bulk-override a whole bracket by accident.');
select is((select r->>'reason' from rpc_log where tag = 'no_eligible_matches'), 'no_eligible_matches',
  'refusal: a re-run of the bulk declare -> no_eligible_matches (409). Never a silent no-op.');
select is((select r->>'reason' from rpc_log where tag = 'bad_format'), 'bad_format',
  'refusal: a blank format -> bad_format (422). The DB is the authority even on a direct RPC call that skipped the TS catalog.');
select is((select r->>'reason' from rpc_log where tag = 'bad_format_tab'), 'bad_format',
  'refusal ⭐: a TAB format -> bad_format. btrim() trims spaces only; the RPC guard now uses ~ ''[^[:space:]]'' like the CHECK.');
select is((select r->>'reason' from rpc_log where tag = 'not_declarable'), 'not_declarable',
  'refusal ⭐: TARGETING a bye row -> not_declarable (409). The targeted path enforces the same `state = declared` contract the bulk path does — without this, one call latched a format onto a never-played match, forever.');
select is((select r->>'reason' from rpc_log where tag = 'not_overridable'), 'not_overridable',
  'refusal ⭐: override=true on a NEVER-LOCKED match -> not_overridable (409). An override must actually override something, or format_overridden_at becomes a lie.');

-- ⭐ AND NOTHING WAS WRITTEN. Nine refusals, zero side effects.
select is(
  (select count(*)::int from audit_log
    where tournament_id = pg_temp.tid('TFMT') and action = 'declare_format'),
  1,
  'refusals write NOTHING: TFMT still has exactly the ONE audit row from the Section-E override — not one refusal appended a row'
);
select is(
  (select count(*)::int from audit_log
    where tournament_id = pg_temp.tid('TBULK') and action = 'declare_format'),
  4,
  'refusals write NOTHING: TBULK still has exactly the 4 audit rows from the Section-G bulk declare'
);
select is((select format from match where id = pg_temp.mid('TFMT', 7)), 'mr12',
  'refusals write NOTHING: the already_locked match kept its original format (the refused override changed nothing)');
select is((select format from match where id = pg_temp.mid('TOTHER', 1)), null::text,
  'refusals write NOTHING: the foreign match was never touched — bad_match refused BEFORE any write');
select is((select format from match where id = pg_temp.mid('TFMT', 5)), 'mr8',
  'refusals write NOTHING: the bad_format target kept the value Section D gave it — a blank/tab format wrote nothing');
select is(
  (select count(*)::int from match
    where id = pg_temp.mid('TBULK', 5) and state = 'bye' and format_locked = false and format is null),
  1,
  'refusals write NOTHING ⭐: the not_declarable BYE is still unlocked and format-less — the refusal did not half-apply a permanent latch'
);
select is(
  (select format_overridden_at from match where id = pg_temp.mid('TFMT', 5)),
  null::timestamptz,
  'refusals write NOTHING ⭐: the not_overridable target was NOT stamped — a refused override does not forge the D3 flag'
);

-- ============================================================================
-- Section I — AD-8: the EXECUTE grant matrix (3 assertions)
-- ============================================================================
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default and anon/authenticated inherit it — so the REVOKE
-- in the migration is load-bearing, not decoration. Without it the RPC would be callable straight off the
-- Data API by any visitor.
select is(
  has_function_privilege('service_role', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE'),
  true,
  'AD-8: service_role CAN execute declare_match_format — it is the single writer'
);
select is(
  has_function_privilege('anon', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE'),
  false,
  'AD-8: anon CANNOT execute declare_match_format — the REVOKE from PUBLIC bites (fail closed)'
);
select is(
  has_function_privilege('authenticated', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE'),
  false,
  'AD-8: authenticated CANNOT execute declare_match_format — requireAdmin is the gate, this grant is the second lock on the same door'
);

select * from finish();

rollback;
