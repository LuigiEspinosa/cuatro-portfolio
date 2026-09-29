-- supabase/tests/0021_leaderboard_test.sql
-- pgTAP proof for migration 0021 (Story 5.5): the single normalized `leaderboard` view (AD-20). Proves the
-- view's teeth BITE — not merely that it exists — across AC1/AC3/AC4/AC5/AC6/AC7/AC9. Run via: supabase test db
--   AC1/AC3    view exists + security_invoker=on + the public SELECT grant matrix                     -> Section A
--   AC4/AC5/AC6 rate = Σnum/Σden (multi-match, sum-then-divide), floors cumulative, display_name join  -> Section B
--   AC7/AC9    idle_dq excluded from totals; NULL stat cols coalesce (row survives); 0-opp ratio → NULL -> Section B
--   AC3        a `pending` row is excluded from the aggregate for an admin/service caller AND invisible
--              to an anon viewer; an approved row aggregates for a viewer (behavioral role switch)      -> Section C
-- Runs inside a transaction and rolls back — no data persists.
--
-- WHY role-switching: postgres (this session) and service_role both have BYPASSRLS. Under the view's
-- security_invoker=on the CALLER's RLS on stat_row applies: an anon viewer rides the 0009 stat_view policy
-- `using (status='approved')`, so a pending row is invisible to them at the base table. A service_role
-- caller (BYPASSRLS) CAN see pending rows through the base table, so the view's EXPLICIT `where
-- status='approved'` is the belt-and-suspenders that still keeps pending out of the aggregate (AC3).
-- FK parents: stat_row.demo_id -> demo (one seeded demo, reused as provenance for every row);
-- stat_row.matchzy_match_id is a plain bigint (NOT NULL, no FK) so each row uses a distinct value to satisfy
-- UNIQUE(matchzy_match_id, steamid64); match_id is left NULL (nullable). player rows feed the display_name join.
-- The floors are CUMULATIVE (per-tournament), NEVER per-match — a 1v1 wingman match is ≤~22 rounds.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so plan()/is()/ok()/
-- throws_ok()/lives_ok() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(32);

-- ============================================================================
-- Seed (as postgres / BYPASSRLS, before any role switch).
--   P_A …901 — TWO approved non-idle matches: multi-match rate arithmetic + eligible_rate=true + name join
--   P_B …902 — ONE approved match, 15 cumulative rounds (<24): meets_round_floor=false, eligible_rate=false
--   P_C …903 — one approved non-idle (kills=10) + one approved idle_dq=true (kills=100): idle EXCLUDED
--   P_D …904 — one approved (kills=10) + one PENDING (kills=90): pending excluded from aggregate, player kept
--   P_E …905 — one approved "pre-Epic-5-shaped" row: only rounds_played+deaths set, all else NULL → coalesce
--   P_F …906 — one PENDING-only row: a viewer never sees it (absent entirely)
--   P_G …907 — one approved match, 23 rounds (<24) + EXACTLY 20 kills (=floor): isolates the KILL floor —
--             meets_kill_floor=true (20>=20 boundary), meets_round_floor=false, eligible_rate=false
--   P_H …908 — one approved match with rounds_played=0: the rounds denominator is 0 → adr & kast_pct NULL
--             via nullif(...,0) (the divide-by-zero guard on the *rounds* denominator, untested before)
--   P_I …909 — one approved match that is idle_dq=true and nothing else: an idle-ONLY player VANISHES
--             (zero rows), the resolved AC7 posture — same as forfeit/bye hygiene (AC8/AD-9), never a ghost row
-- ============================================================================
insert into player (steamid64, display_name) values
  ('76561197960287901', 'Alpha'),
  ('76561197960287902', 'Bravo'),
  ('76561197960287903', 'Charlie'),
  ('76561197960287904', 'Delta'),
  ('76561197960287905', 'Echo'),
  ('76561197960287906', 'Foxtrot'),
  ('76561197960287907', 'Golf'),
  ('76561197960287908', 'Hotel'),
  ('76561197960287909', 'India');

insert into demo (matchzy_match_id, storage_key, source) values (5000, 'demos/lb/seed.dem', 'matchzy');

-- P_A match 1 & 2 (approved, not idle). ADR: 1600/20=80.0 and 1400/18=77.78 per-round — sum-then-divide is
-- 3000/38=78.947, which is NOT the 78.89 average of the two per-match ADRs (the multi-match proof).
-- entry: 5/8 and 1/6 per match; sum-then-divide is 6/14=0.4286, NOT the 0.3958 average of the two ratios.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq,
   rounds_played, kills, deaths, assists, adr_damage, kast_rounds, hs_kills, mvps, flash_assists,
   utility_damage, knife_kills, wallbang_kills, through_smoke_kills, no_scope_kills, blind_kills,
   entry_frags, opening_deaths)
values
  (9001, '76561197960287901', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false,
   20, 15, 10, 3, 1600, 14, 8, 2, 1, 200, 0, 1, 0, 0, 1, 5, 3),
  (9002, '76561197960287901', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false,
   18, 12, 11, 2, 1400, 13, 5, 1, 0, 150, 1, 0, 1, 0, 0, 1, 5);

-- P_B: one approved match, 15 rounds cumulative (below the 24 floor), 25 kills (above the 20 floor) — so
-- ONLY the round floor fails, isolating meets_round_floor=false -> eligible_rate=false.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9003, '76561197960287902', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 15, 25, 12, 1300, 11, 6, 4, 3);

-- P_C: one real match (kills=10, 20 rounds) + one idle_dq'd match (kills=100, 22 rounds). The idle row must
-- NOT add to totals or matches_played (AC7) — if it leaked, kills_total would be 110 and matches_played 2.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9004, '76561197960287903', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 20, 10, 12, 1200, 12, 4, 3, 4),
  (9005, '76561197960287903', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', true,  22, 100, 1, 9999, 22, 90, 20, 0);

-- P_D: one approved (kills=10) + one PENDING (kills=90). The pending contribution must be excluded from the
-- aggregate (AC3) while the player is still present via the approved row.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9006, '76561197960287904', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 24, 10, 12, 1200, 12, 4, 3, 4),
  (9007, '76561197960287904', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'pending',  false, 24, 90, 1,  9999, 24, 88, 20, 0);

-- P_E: a "pre-Epic-5-shaped" approved row — only rounds_played (24) and deaths (5) set; kills and every
-- Epic-5 stat column NULL. A bare SUM tolerates NULL, but WHERE col>0 / ORDER BY / a ratio would drop or
-- error on this player — coalesce(...,0) keeps it in with kills_total=0, and nullif(kills_total,0) makes
-- hs_pct NULL (0-opportunity), never a divide-by-zero (AC9).
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, deaths)
values
  (9008, '76561197960287905', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 24, 5);

-- P_F: a PENDING-only player — a viewer must never see them at all.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9009, '76561197960287906', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'pending', false, 22, 77, 5, 1500, 20, 10, 8, 6);

-- P_G: 23 rounds (below the 24 floor) + EXACTLY 20 kills (the 20 floor boundary). Isolates the kill floor:
-- meets_kill_floor must be true at the >= boundary while meets_round_floor is false — so a broken kill-floor
-- literal/operator (e.g. >=→> or 20→24) is caught, and eligible_rate stays false on the failing round floor.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9010, '76561197960287907', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 23, 20, 10, 1500, 15, 7, 5, 5);

-- P_H: a single approved row with rounds_played=0 → rounds_played_total=0. Exercises the *rounds* denominator
-- guard: adr and kast_pct must be NULL via nullif(rounds_played_total,0), never a division-by-zero (before this,
-- only the HS%/kills denominator was driven to 0 — the shared rounds denominator was asserted only by comment).
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9011, '76561197960287908', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', false, 0, 5, 3, 100, 3, 2, 1, 1);

-- P_I: an idle-ONLY player — their sole approved row is idle_dq=true. Resolved AC7 posture (code review
-- 2026-07-27): the row is filtered by `idle_dq=false`, the player has no contributing rows, and so VANISHES
-- from the view entirely (zero rows) — the same "matches actually played" hygiene as forfeit/bye (AC8/AD-9),
-- NOT a zeroed ghost row. Locks that behavior against a regression that would resurrect the player.
insert into stat_row
  (matchzy_match_id, steamid64, demo_id, status, idle_dq, rounds_played, kills, deaths, adr_damage, kast_rounds, hs_kills, entry_frags, opening_deaths)
values
  (9012, '76561197960287909', (select id from demo where storage_key = 'demos/lb/seed.dem'), 'approved', true, 22, 30, 2, 2000, 20, 15, 10, 2);

-- ============================================================================
-- Section A — existence, security_invoker, the public grant matrix (AC1/AC3).
-- ============================================================================
select is(
  (select count(*)::int from pg_views where schemaname = 'public' and viewname = 'leaderboard'),
  1, 'leaderboard: the single normalized standings view exists (AD-20 one owner)');

select ok(
  (select array_to_string(reloptions, ',') from pg_class where relname = 'leaderboard' and relkind = 'v') ~ 'security_invoker=(on|true)',
  'leaderboard: created WITH (security_invoker = on) — the caller''s RLS on stat_row applies (fail-closed viewer security)');

select is(has_table_privilege('anon',          'public.leaderboard', 'SELECT'), true,
  'anon CAN SELECT leaderboard (public viewer surface, unlike service_role-only unreconciled_stat_row)');
select is(has_table_privilege('authenticated', 'public.leaderboard', 'SELECT'), true,
  'authenticated CAN SELECT leaderboard (public viewer surface)');
select is(has_table_privilege('service_role',  'public.leaderboard', 'SELECT'), true,
  'service_role CAN SELECT leaderboard (server routes read it too)');

-- ============================================================================
-- Section B — aggregation correctness as postgres (AC4/AC5/AC6/AC7/AC9). Constraints/aggregation fire
-- regardless of RLS here; the security behavior is Section C.
-- ============================================================================
-- AC4 rate, multi-match: ADR = Σadr_damage / Σrounds = 3000/38. Round both sides to 4dp to compare numerics
-- by value. This is NOT (80.0 + 77.78)/2 = 78.89 — sum-then-divide, never an average of per-match ratios.
select is(
  (select round(adr, 4) from leaderboard where steamid64 = '76561197960287901'),
  round(3000::numeric / 38, 4),
  'leaderboard: ADR = Σdamage/Σrounds cumulatively (3000/38, multi-match) — sum-then-divide, not avg-of-ratios');
-- AC4 rate: entry success = Σentry / (Σentry + Σopening) = 6/14. Per-match ratios were 5/8 & 1/6 (avg 0.3958);
-- 6/14 = 0.4286 proves the sum-then-divide again, this time over differing per-match denominators.
select is(
  (select round(entry_success, 4) from leaderboard where steamid64 = '76561197960287901'),
  round(6::numeric / 14, 4),
  'leaderboard: entry_success = Σentry/(Σentry+Σopening) (6/14) — divides over summed opportunities');
-- AC6 eligibility: 38 rounds ≥ 24 and 27 kills ≥ 20 → eligible.
select is((select eligible_rate from leaderboard where steamid64 = '76561197960287901'), true,
  'leaderboard: a player over both cumulative floors (38 rounds, 27 kills) is eligible_rate=true');
-- The display_name LEFT JOIN resolves under the seeded player row (degrades to NULL, never errors, if absent).
select is((select display_name from leaderboard where steamid64 = '76561197960287901'), 'Alpha',
  'leaderboard: display_name resolves via the LEFT JOIN player (security_invoker rides the caller''s player read)');

-- AC6 cumulative round floor: 15 cumulative rounds (< 24) → meets_round_floor false → eligible_rate false,
-- EVEN THOUGH kills (25) clear the 20 floor. Proves the floor is cumulative and round-gated, not per-match.
select is((select meets_round_floor from leaderboard where steamid64 = '76561197960287902'), false,
  'leaderboard: 15 cumulative rounds is below the 24 floor → meets_round_floor=false (cumulative, never per-match)');
select is((select eligible_rate from leaderboard where steamid64 = '76561197960287902'), false,
  'leaderboard: below the round floor → eligible_rate=false even with kills over the 20 floor');

-- AC7 idle exclusion: the idle_dq=true match (kills=100) contributes NOTHING — totals and matches_played
-- reflect only the one real match (kills=10, 1 match), never 110 / 2.
select is((select kills_total from leaderboard where steamid64 = '76561197960287903'), 10::bigint,
  'leaderboard: an idle_dq=true match is excluded from totals (kills_total=10, not 110) — per-match exclusion, not a ban');
select is((select matches_played from leaderboard where steamid64 = '76561197960287903'), 1::bigint,
  'leaderboard: an idle_dq=true match does not count toward matches_played (1, not 2)');

-- AC9 NULL-safety: the pre-Epic-5-shaped row (kills/adr/... NULL) does NOT vanish — it appears with
-- coalesced zeros, and its 0-kill HS denominator yields a NULL ratio, never a divide error.
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287905'), 1,
  'leaderboard: a NULL-stat (pre-Epic-5) row still appears — coalesce(...,0) keeps the player from vanishing');
select is((select kills_total from leaderboard where steamid64 = '76561197960287905'), 0::bigint,
  'leaderboard: a NULL kills column coalesces to 0 in the total (not NULL, which would drop the player)');
select ok((select hs_pct from leaderboard where steamid64 = '76561197960287905') is null,
  'leaderboard: a 0-opportunity HS denominator yields NULL via nullif(...,0) — no division-by-zero error');

-- ── Review patches (code review 2026-07-27) — close the mutation-survivor coverage gaps ─────────────
-- AC4 KAST%: the ONE rate column with zero prior coverage. Σkast_rounds/Σrounds = 27/38, sum-then-divide.
select is(
  (select round(kast_pct, 4) from leaderboard where steamid64 = '76561197960287901'),
  round(27::numeric / 38, 4),
  'leaderboard: KAST% = Σkast_rounds/Σrounds cumulatively (27/38, multi-match) — the previously-untested rate column');

-- AC6 kill floor, isolated + at the exact boundary. P_G: 23 rounds (round floor fails) + EXACTLY 20 kills.
select is((select meets_kill_floor from leaderboard where steamid64 = '76561197960287907'), true,
  'leaderboard: EXACTLY 20 cumulative kills meets the kill floor (>= boundary) — kill floor isolated from the round floor');
select is((select meets_round_floor from leaderboard where steamid64 = '76561197960287907'), false,
  'leaderboard: 23 cumulative rounds is below the 24 floor → meets_round_floor=false (independent of the passing kill floor)');
select is((select eligible_rate from leaderboard where steamid64 = '76561197960287907'), false,
  'leaderboard: meeting the kill floor alone does NOT make eligible_rate true when the round floor fails');
-- AC6 exact round-floor boundary: P_D has EXACTLY 24 approved rounds (its pending row is excluded) → true.
select is((select meets_round_floor from leaderboard where steamid64 = '76561197960287904'), true,
  'leaderboard: EXACTLY 24 cumulative rounds meets the round floor (>= boundary), pending row excluded from the sum');
-- AC6 kill floor false side: P_C's one real match is 10 kills (<20) → meets_kill_floor=false.
select is((select meets_kill_floor from leaderboard where steamid64 = '76561197960287903'), false,
  'leaderboard: 10 cumulative kills is below the 20 kill floor → meets_kill_floor=false');

-- AC9 rounds-denominator guard (adr & kast share it). P_H: rounds_played_total=0 → both NULL, never a div error.
select ok((select adr from leaderboard where steamid64 = '76561197960287908') is null,
  'leaderboard: a 0-round ADR denominator yields NULL via nullif(rounds_played_total,0) — no division-by-zero');
select ok((select kast_pct from leaderboard where steamid64 = '76561197960287908') is null,
  'leaderboard: a 0-round KAST denominator yields NULL via nullif(rounds_played_total,0) — no division-by-zero');

-- AC4/AC9 entry opportunity denominator. P_E (pre-Epic-5-shaped): entry_frags+opening_deaths both NULL→0.
select is((select entry_opportunities from leaderboard where steamid64 = '76561197960287905'), 0::bigint,
  'leaderboard: a 0-opportunity player has entry_opportunities=0 (coalesced) — not NULL, keeps the volume total honest');
select ok((select entry_success from leaderboard where steamid64 = '76561197960287905') is null,
  'leaderboard: a 0-opportunity entry_success yields NULL via nullif(Σentry+Σopening,0) — no division-by-zero');

-- AC7 (resolved) idle-ONLY player vanishes: P_I's sole row is idle_dq=true → filtered out → zero rows.
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287909'), 0,
  'leaderboard: an idle-ONLY player produces zero leaderboard rows (idle_dq filter) — vanishes like forfeit/bye (AC8/AD-9), not a zeroed ghost row');

-- ============================================================================
-- Section C — security behavioral (AC3). The pending row is excluded from the aggregate for an admin/service
-- caller (explicit filter, belt-and-suspenders) AND invisible to an anon viewer (RLS); an approved row
-- aggregates for a viewer.
-- ============================================================================
-- service_role (BYPASSRLS) CAN see the base pending row — the view's EXPLICIT `where status='approved'` is
-- what still keeps it out of P_D's aggregate (kills_total=10, not 100), and the player is still present.
set local role service_role;
select is((select kills_total from leaderboard where steamid64 = '76561197960287904'), 10::bigint,
  'leaderboard: a pending row is excluded from the aggregate even for a service caller (explicit where status=approved — AC3 belt-and-suspenders)');
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287904'), 1,
  'leaderboard: the player still appears via their approved row (only the pending contribution is dropped)');
set local role postgres;

-- anon viewer: rides the stat_view RLS (approved-only). Sees P_A's aggregate; never sees the pending-only P_F.
set local role anon;
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287901'), 1,
  'leaderboard: an anon viewer sees an approved-only player''s aggregate (security_invoker reaches the stat_view grant + RLS)');
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287906'), 0,
  'leaderboard: an anon viewer never sees a pending-only player (RLS + explicit filter — no pending leak)');
select is((select count(*)::int from leaderboard where steamid64 = '76561197960287905'), 1,
  'leaderboard: the NULL-stat approved player is visible to an anon viewer too (coalesce keeps them in for the audience)');
set local role postgres;

select * from finish();

rollback;
