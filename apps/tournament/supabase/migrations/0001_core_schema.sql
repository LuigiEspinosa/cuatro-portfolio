-- supabase/migrations/0001_core_schema.sql
-- Logical migration 0001 — Identity & Scope (Story 1.2).
-- Realizes AD-4 (SteamID64 canonical key), AD-18 (seasons-aware scope), AD-12 (app_role shape).
--
-- SCOPE: identity/scope tables ONLY (season, tournament, player, app_role) + their
--        CHECK / closed-set / PK / FK constraints.
-- OUT OF SCOPE (deferred, do NOT add here):
--   * RLS ENABLE + FORCE and any CREATE POLICY  -> migration 0002 (Story 1.3).
--     AC #3 "no client write policy" is satisfied BY ABSENCE — 0001 creates no policy at all.
--   * is_admin() / jwt_steamid64() helper functions -> Story 1.3.
--   * roster_entry -> Story 2.5; demo/stat_row -> Epic 3; match -> Epic 4;
--     audit_log/snapshot* -> Story 1.4/Epic 4; award*/ceremony/spin -> Epic 6.
--   * tournament.final_match_id's FK to match(id) (match table does not exist yet) and
--     tournament.fair_seed's write-once trigger/population (AD-13, Epic 4/6) — columns are
--     defined here as plain nullable columns only; their behavior arrives later.
--
-- Order matters for FKs: season -> tournament (season_id); player -> app_role (steamid64).

create table season (
  id          bigint generated always as identity primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table tournament (
  id             bigint generated always as identity primary key,
  season_id      bigint not null references season(id) on delete restrict,   -- AD-18: every event scopes under a season
  name           text not null,
  state          text not null default 'registration_open'
                 check (state in ('registration_open','registration_closed','bracket_live','ceremony','closed')),
  format_default text,
  final_match_id bigint,   -- nullable NOW; FK to match(id) added in the Epic-4 match migration (match table does not exist yet)
  fair_seed      text,     -- nullable NOW; = SHA-256(final demo). Write-once trigger + population is AD-13 / Epic 4-6, NOT here
  created_at     timestamptz not null default now()
);

create table player (
  steamid64     text primary key check (steamid64 ~ '^[0-9]{17}$'),   -- AD-4 canonical join key; text, never bigint (JS precision)
  display_name  text not null,                                        -- MUTABLE, cosmetic, NEVER a join key
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table app_role (                          -- event-global in v1 (per-season role scoping deferred, AD-18)
  steamid64   text primary key references player(steamid64) on delete cascade,   -- PK => UNIQUE + NOT NULL: one role per player
  role        text not null check (role in ('admin','viewer')),                  -- AD-12 closed set
  granted_by  text references player(steamid64) on delete set null,             -- who granted (nullable audit pointer; NULLed if the grantor player is deleted, never blocks the delete)
  granted_at  timestamptz not null default now()
);
