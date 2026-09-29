-- supabase/fixtures/live-qa-seed.sql
-- Standing live-QA fixture — season + tournament + active roster for ingest live-QA.
-- Closes Epic-2 retro action #4 / Epic-3 retro action #1 ("operationalize the standing fixture").
--
-- WHY THIS IS NOT supabase/seed.sql:
--   seed.sql auto-runs on every `supabase db reset` and PERSISTS. The pgTAP suites
--   (`supabase test db`) seed their own 'Season 1' inside rolled-back test transactions; a
--   persisted 'Season 1' would 23505 against `season.name`'s UNIQUE the next time a test inserts
--   it. So this fixture (a) lives OUTSIDE seed.sql and is applied by hand per live-QA session, and
--   (b) uses a DISTINCT season name ('Live-QA Season') that never collides with the test fixtures.
--
-- HOW TO APPLY — against the LOCAL Supabase stack (live-QA runs local per the Story-3.1
-- IPv6/pooler finding; the hosted DB now needs the DATABASE_URL pooler override):
--   supabase start   # if the stack isn't already up
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/fixtures/live-qa-seed.sql
--
-- Idempotent: safe to re-run (every insert is ON CONFLICT DO NOTHING). Survives until the next
-- `supabase db reset` (it is not part of the migration/seed pipeline) — re-apply after a reset.
--
-- The two SteamID64s are the `cuatro-luisito.dem` duelists used across 3.3/3.4/3.6/3.8 live-QA, so a
-- `worker ingest cuatro-luisito.dem` reconciles cleanly — the roster gate passes and the parse lands
-- `validation_state='pending'` instead of being held `anomalous` on an `unreconciled` id.

begin;

-- 1. Season — distinct name so it never collides with the pgTAP 'Season 1' fixture (season.name is UNIQUE).
insert into public.season (name)
values ('Live-QA Season')
on conflict (name) do nothing;

-- 2. Tournament under it. 'registration_closed' = roster is set / pre-bracket
--    (ingest live-QA does not need bracket_live; the worker's RosterReader is state-agnostic).
insert into public.tournament (season_id, name, state)
select s.id, 'Live-QA Cup', 'registration_closed'
from public.season s
where s.name = 'Live-QA Season'
on conflict (season_id, name) do nothing;

-- 3. The two QA players (the cuatro-luisito.dem duelists). display_name is cosmetic (never a join key).
insert into public.player (steamid64, display_name)
values
  ('76561198388441171', 'Live-QA Player A'),
  ('76561199176839714', 'Live-QA Player B')
on conflict (steamid64) do nothing;

-- 4. Active roster entries linking both players to the Live-QA Cup (what the ingest roster gate reads).
insert into public.roster_entry (tournament_id, steamid64, status)
select t.id, v.steamid64, 'active'
from public.tournament t
join public.season s on s.id = t.season_id
cross join (values ('76561198388441171'), ('76561199176839714')) as v(steamid64)
where s.name = 'Live-QA Season' and t.name = 'Live-QA Cup'
on conflict (tournament_id, steamid64) do nothing;

commit;

-- Verify what landed:
--   select s.name as season, t.name as tournament, t.state,
--          array_agg(r.steamid64 order by r.steamid64) filter (where r.status='active') as active_roster
--   from public.season s
--   join public.tournament t on t.season_id = s.id
--   left join public.roster_entry r on r.tournament_id = t.id
--   where s.name = 'Live-QA Season'
--   group by 1, 2, 3;

-- Teardown (removes ONLY this fixture; roster_entry cascades from the tournament delete — 0004 ON DELETE CASCADE):
--   delete from public.tournament t using public.season s
--     where t.season_id = s.id and s.name = 'Live-QA Season' and t.name = 'Live-QA Cup';
--   delete from public.season where name = 'Live-QA Season';
--   -- player rows are shared identity — leave them, or remove if they are pure QA identities:
--   -- delete from public.player where steamid64 in ('76561198388441171', '76561199176839714');
