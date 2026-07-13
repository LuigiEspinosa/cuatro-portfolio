-- supabase/fixtures/live-qa-bracket-seed.sql
-- Live-QA fixture for BRACKET GENERATION (Story 4.1, Task 9).
--
-- WHY A SECOND FIXTURE. The standing live-qa-seed.sql seeds the two `cuatro-luisito.dem` duelists — a
-- 2-player roster, which is correct for INGEST live-QA but **insufficient for generation**: AC1's floor
-- is 8. This fixture seeds an 11-player field in its OWN season, so the two fixtures never collide and
-- either can be applied independently.
--
-- WHY ELEVEN. 11 is deliberately NOT a power of two: bracketSize = 16, so the draw must hand out
-- 16 - 11 = 5 BYES (AC3) — the trickiest acceptance criterion, and the one unit tests alone should never
-- be trusted to close. A field of 8 or 16 would generate a bye-free bracket and quietly skip AC3.
-- Expected shape: 15 winners + 14 losers + 1 grand-final = 30 match rows, 5 byes on the top 5 seeds.
--
-- HOW TO APPLY — against the LOCAL Supabase stack:
--   supabase db reset    # REQUIRED FIRST TIME on a DB with pre-4.1 data — see the caveat below
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/fixtures/live-qa-bracket-seed.sql
--
-- MIGRATION-APPLY (Story 4.1 D1). Migration 0010 closes the four deferred `-> match(id)` FKs, but it does
-- NOT put them on the columns the ingest paths write: `demo.match_id`/`stat_row.match_id` never held a
-- match(id) (they hold MatchZy's game-server id), so 0010 RENAMES those to `matchzy_match_id` and adds the
-- FK on a NEW, nullable `match_id` that stays NULL until Story 4.6 binds a demo to the match it decided.
-- Consequence: 0010 applies cleanly to a database holding 3.x demo/stat_row rows, and demo ingest keeps
-- working after it. (A plain `supabase db reset` is still the cleanest way to start a live-QA run.)
--
-- ⚠ IDEMPOTENT ONLY BEFORE THE BRACKET IS GENERATED. Every insert is ON CONFLICT DO NOTHING, but that does
-- NOT make step 4 re-runnable once `generate_bracket` has flipped the tournament to `bracket_live`: the D3
-- roster-lock trigger is a BEFORE INSERT trigger, and a BEFORE trigger fires BEFORE the conflict is
-- detected — so even an insert that would have been a pure no-op raises P0001 and aborts the transaction.
-- That is correct (it IS a write to a frozen roster), but it means: to re-run this fixture after a
-- generation, either `supabase db reset`, or run the teardown at the foot of this file first.
--
-- NOTE the tournament lands in 'registration_closed': that is the ONLY state generate_bracket accepts
-- (AC1 — "generate from the CLOSED roster").
--
-- ⚠ DO NOT RUN `supabase test db` WITH THIS (OR live-qa-seed.sql) APPLIED. 0002_rls_test asserts
-- ABSOLUTE row counts (`count(*) from player = 3`, `season = 1`, `tournament = 1`, `app_role = 1`), so
-- ANY persisted fixture fails it. This is a pre-existing property of that suite, not of this fixture —
-- live-qa-seed.sql already breaks the same assertions (and collides with canonical_steamid64's player
-- insert). The flow is: `supabase db reset` -> `supabase test db` for the suites, and
-- `supabase db reset` -> apply a fixture -> live-QA. One DB cannot serve both.
-- [Candidate cleanup for a later story: scope 0002_rls_test's counts to its own seeded names.]

begin;

-- 1. A distinct season, so this never collides with the pgTAP 'Season 1' fixtures or the ingest fixture's
--    'Live-QA Season' (season.name is UNIQUE).
insert into public.season (name)
values ('Live-QA Bracket Season')
on conflict (name) do nothing;

-- 2. The tournament, already CLOSED — the roster is set and the bracket is ready to be drawn.
insert into public.tournament (season_id, name, state)
select s.id, 'Live-QA Bracket Cup', 'registration_closed'
  from public.season s
 where s.name = 'Live-QA Bracket Season'
on conflict (season_id, name) do nothing;

-- 3. Eleven players. Reserved-looking ids in the 7656119796028860x range so they cannot collide with the
--    ingest fixture's two real duelists or the pgTAP suites' …9602879xx fixtures.
insert into public.player (steamid64, display_name)
select '765611979602886' || lpad(i::text, 2, '0'), 'Bracket QA Player ' || i
  from generate_series(1, 11) as i
on conflict (steamid64) do nothing;

-- 4. The ACTIVE roster — the field generate_bracket will draw from. (An inactive/removed entry is NOT
--    seeded: the lib filters status='active', and the RPC re-asserts that same set under its lock.)
insert into public.roster_entry (tournament_id, steamid64, status)
select t.id, p.steamid64, 'active'
  from public.tournament t
  join public.season s on s.id = t.season_id
 cross join (
   select '765611979602886' || lpad(i::text, 2, '0') as steamid64 from generate_series(1, 11) as i
 ) p
 where s.name = 'Live-QA Bracket Season' and t.name = 'Live-QA Bracket Cup'
on conflict (tournament_id, steamid64) do nothing;

-- 5. An admin to act as the audit row's actor (audit_log.actor_steamid64 -> player, and it must be a real
--    admin for the route's requireAdmin gate).
insert into public.player (steamid64, display_name)
values ('76561197960288699', 'Bracket QA Admin')
on conflict (steamid64) do nothing;
insert into public.app_role (steamid64, role)
values ('76561197960288699', 'admin')
on conflict (steamid64) do nothing;

commit;

-- Verify what landed (expect: registration_closed, 11 active, 0 seeded, 0 matches):
--   select t.id, t.name, t.state,
--          count(*) filter (where r.status = 'active')        as active_roster,
--          count(*) filter (where r.bracket_seed is not null) as seeded,
--          (select count(*) from public.match m where m.tournament_id = t.id) as matches
--   from public.tournament t
--   join public.season s on s.id = t.season_id
--   left join public.roster_entry r on r.tournament_id = t.id
--   where s.name = 'Live-QA Bracket Season'
--   group by t.id, t.name, t.state;

-- Teardown. roster_entry + match + audit_log all CASCADE from the tournament delete. Run as `postgres`
-- (the psql connection above already is): `demo` has no DELETE grant, so service_role cannot do this.
--
-- ⚠ ONE CAVEAT, and it is deliberate. `demo.match_id -> match(id)` is ON DELETE **RESTRICT** (a demo is
-- EVIDENCE — a match delete must never silently destroy it). RESTRICT is checked immediately and fires
-- even when the referencing row is being removed by a cascade in the same statement. So once Story 4.6
-- binds a demo to one of this tournament's matches, the tournament delete below will be REFUSED (23503)
-- until those demo rows are cleared first. It works today because 4.1 never populates demo.match_id.
-- Tournaments are not deleted in v1; evidence outliving the bracket is the intended trade.
--
--   -- (only needed once Story 4.6 binds demos to matches)
--   -- delete from public.demo d using public.match m, public.tournament t, public.season s
--   --   where d.match_id = m.id and m.tournament_id = t.id and t.season_id = s.id
--   --     and s.name = 'Live-QA Bracket Season';
--   delete from public.tournament t using public.season s
--     where t.season_id = s.id and s.name = 'Live-QA Bracket Season';
--   delete from public.season where name = 'Live-QA Bracket Season';
--   delete from public.app_role where steamid64 = '76561197960288699';
--   delete from public.player where steamid64 like '765611979602886%';
