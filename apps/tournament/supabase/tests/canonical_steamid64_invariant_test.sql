-- supabase/tests/canonical_steamid64_invariant_test.sql
-- pgTAP proof for Story 2.3 — canonical SteamID64 key + display-name rename tolerance (AD-4, FR-2).
-- Proves TWO things the app relies on but which add NO migration (0001's `player` is already correct):
--   AC3 — a display_name rename preserves identity: the steamid64 PK is unchanged (still exactly
--         one row), created_at is untouched (no re-creation), and every row that links by steamid64
--         (an app_role FK'd on it + a non-FK stat_snapshot_row carrying it) stays attached.
--   AC4 — the canonical-key invariant holds for EVERY table, not just today's: player's PK is exactly
--         (steamid64), and no PRIMARY KEY / UNIQUE / FOREIGN KEY constraint or UNIQUE index anywhere
--         in schema `public` keys on `display_name`. A forward-looking catalog guard (Epic-1 precedent,
--         mirrors 0003's generic FORCE-guard): a future roster_entry (2.5) or stat_row (Epic 3) that
--         tried to key/join on display_name would fail this suite the moment it lands.
--   AC6 — a transient-outage re-login (the 17-digit placeholder written with ON CONFLICT DO
--         NOTHING) preserves an EXISTING player's good display_name/avatar_url, yet still creates
--         a row for a BRAND-NEW player (login must succeed). Behavioral proof of upsertPlayer's
--         null-profile branch — the app-layer test only proves the call shape, not the DB outcome.
-- Runs inside a transaction and rolls back — no data persists.
--
-- Catalog notes: pg_constraint.contype p=PRIMARY KEY, u=UNIQUE, f=FOREIGN KEY, x=EXCLUDE; conkey =
-- the constraint's own columns (referencing side), confkey = the referenced columns (an FK's target).

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/has_pk()/finish() resolve unqualified, alongside our public tables.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(13);

-- ============================================================================
-- AC3 — rename tolerance: UPDATE display_name preserves identity + all links
-- ============================================================================
-- Seed a player with a SENTINEL created_at (NOT now()) so "unchanged" is genuinely provable:
-- a re-creation would reset created_at to the transaction clock, never leave it at 2020-01-01.
insert into player (steamid64, display_name, created_at)
  values ('76561197960287930', 'OldName', '2020-01-01T00:00:00Z');
-- A role FK'd on steamid64 — the "link preserved" proof (today's only real FK into player).
insert into app_role (steamid64, role) values ('76561197960287930', 'admin');
-- A non-FK, stat-style row carrying the SAME steamid64 as a *captured value* (its PK is
-- (snapshot_id, steamid64); steamid64 has NO FK, per AD-4's unreconciled left-join design) —
-- the perfect demonstration that a non-FK linkage survives a rename too. Needs a stat_snapshot
-- parent (→ tournament → season). Inserted as the session role (BYPASSRLS) like 0003's seed.
insert into season (name) values ('S1');
insert into tournament (season_id, name)
  values ((select id from season where name = 'S1'), 'T1');
insert into stat_snapshot (tournament_id, content_sha256)
  values ((select id from tournament where name = 'T1'), 'sha-1');
insert into stat_snapshot_row (snapshot_id, steamid64, stats_int)
  values ((select id from stat_snapshot where content_sha256 = 'sha-1'), '76561197960287930', '{}'::jsonb);

-- The rename: a Steam persona change → next sign-in issues a cosmetic UPDATE keyed on steamid64.
update player set display_name = 'NewName' where steamid64 = '76561197960287930';

select is(
  (select count(*)::int from player where steamid64 = '76561197960287930'),
  1,
  'AC3: after a rename there is still exactly ONE player row for that steamid64 (not re-keyed/duplicated)'
);
select is(
  (select display_name from player where steamid64 = '76561197960287930'),
  'NewName',
  'AC3: the rename actually updated display_name (the UPDATE is not a vacuous no-op)'
);
select is(
  (select created_at from player where steamid64 = '76561197960287930'),
  '2020-01-01T00:00:00Z'::timestamptz,
  'AC3: created_at is UNCHANGED by the rename (row updated in place, never re-created)'
);
select is(
  (select role from app_role where steamid64 = '76561197960287930'),
  'admin',
  'AC3: the FK-linked app_role row still resolves by steamid64 after the rename'
);
select is(
  (select count(*)::int from stat_snapshot_row where steamid64 = '76561197960287930'),
  1,
  'AC3: the non-FK stat_snapshot_row (steamid64 as a captured value) stays attached after the rename'
);

-- ============================================================================
-- AC4 — canonical-key catalog guard: display_name is NEVER a join key, anywhere
-- ============================================================================
select has_pk('public', 'player', 'AC4: player has a primary key');

select is(
  (select array_agg(a.attname::text order by a.attname)
     from pg_constraint c
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.player'::regclass and c.contype = 'p'),
  ARRAY['steamid64'],
  'AC4: player primary key is EXACTLY (steamid64) — display_name is not part of the PK'
);

select is(
  (select count(*)::int
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where n.nspname = 'public'
      and c.contype in ('p', 'u', 'f', 'x')
      and a.attname = 'display_name'),
  0,
  'AC4: no PRIMARY KEY / UNIQUE / FK / EXCLUDE constraint in public keys on a display_name column (referencing side)'
);

select is(
  (select count(*)::int
     from pg_constraint c
     join pg_class rt on rt.oid = c.confrelid
     join pg_namespace rn on rn.oid = rt.relnamespace
     join pg_attribute a on a.attrelid = c.confrelid and a.attnum = any(c.confkey)
    where rn.nspname = 'public'
      and c.contype = 'f'
      and a.attname = 'display_name'),
  0,
  'AC4: no FOREIGN KEY in public references a display_name column (referenced side)'
);

-- NOTE (residual, Epic-5-deferred): this guard checks unique indexes whose column appears in
-- pg_index.indkey. An EXPRESSION unique index (e.g. `create unique index ... on t(lower(display_name))`)
-- stores the column in pg_index.indexprs with attnum=0, so it would slip past this attnum join.
-- No such object exists today; detecting it needs a pg_get_indexdef text scan — left for a later pass.
select is(
  (select count(*)::int
     from pg_index i
     join pg_class t on t.oid = i.indrelid
     join pg_namespace n on n.oid = t.relnamespace
     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where n.nspname = 'public'
      and i.indisunique
      and a.attname = 'display_name'),
  0,
  'AC4: no UNIQUE index in public includes a display_name column'
);

-- ============================================================================
-- AC6 — an unhydrated re-login (placeholder + ON CONFLICT DO NOTHING) must PRESERVE an
-- existing player's good cosmetic values, yet still create a row for a brand-new player.
-- This is the behavioral proof of upsertPlayer's null-profile branch; the Vitest suite only
-- asserts the call shape ({ onConflict, ignoreDuplicates:true }), so prove the DB outcome here.
-- ============================================================================
-- An existing player with GOOD cosmetic values (from a prior hydrated login).
insert into player (steamid64, display_name, avatar_url)
  values ('76561198388441171', 'GoodName', 'https://good/avatar.jpg');

-- The transient-outage re-login: the app writes the 17-digit placeholder with ON CONFLICT DO
-- NOTHING (upsertPlayer's `ignoreDuplicates: true` branch). It must NOT touch the existing row.
insert into player (steamid64, display_name, avatar_url)
  values ('76561198388441171', '76561198388441171', null)
  on conflict (steamid64) do nothing;

select is(
  (select display_name from player where steamid64 = '76561198388441171'),
  'GoodName',
  'AC6: an unhydrated re-login (ON CONFLICT DO NOTHING) does NOT overwrite a stored good display_name with the placeholder'
);
select is(
  (select avatar_url from player where steamid64 = '76561198388441171'),
  'https://good/avatar.jpg',
  'AC6: an unhydrated re-login does NOT null a stored good avatar_url'
);

-- A BRAND-NEW player logging in unhydrated still gets a (placeholder) row — login must succeed.
insert into player (steamid64, display_name, avatar_url)
  values ('76561198000000042', '76561198000000042', null)
  on conflict (steamid64) do nothing;
select is(
  (select display_name from player where steamid64 = '76561198000000042'),
  '76561198000000042',
  'AC6: a brand-new unhydrated player still gets a placeholder row (login succeeds, DO NOTHING inserts when no conflict)'
);

select * from finish();

rollback;
