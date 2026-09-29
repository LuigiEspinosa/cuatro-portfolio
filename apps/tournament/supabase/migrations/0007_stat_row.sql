-- supabase/migrations/0007_stat_row.sql
-- Logical migration 0007 — Parse → stat_row slice (Story 3.3).
-- Realizes the `Parsing` node of the ingest state machine: the Go worker parses a retained .dem into
-- normalized per-player rows and is now the single writer (AD-2) of BOTH `demo` (0005/0006) and
-- `stat_row`. This migration creates the target table + the AD-3 idempotency key; the worker upserts
-- into it via ON CONFLICT (match_id, steamid64) DO UPDATE.
--
-- SCOPE (whole deliverable): create `stat_row` per SOLUTION-DESIGN §3 with the FULL column set (every
--   stat column NULLABLE — the parser fills only kills/deaths/rounds_played this slice, Epic 5 enriches
--   with NO further migration); UNIQUE(match_id, steamid64) = the AD-3 re-parse key; demo_id FK -> demo
--   (provenance: the parse that produced the row); steamid64 text CHECK (~ 17-digit) and NOT a FK (AD-4
--   unreconciled left-join); ENABLE+FORCE RLS; an admin-only `stat_admin` SELECT policy (dormant, mirrors
--   demo/audit_log); grant select/insert/update/DELETE on stat_row to service_role.
-- OUT OF SCOPE — do NOT add here:
--   * stat_row_match_fk (Epic 4): `match` does not exist yet, so `match_id` is a plain `bigint not null`
--     with NO forward FK — mirrors demo.match_id (0005) / tournament.final_match_id (0001) /
--     audit_log.target_match_id (0003). Epic 4 adds BOTH stat_row_match_fk and the pending demo_match_fk.
--   * the viewer `stat_view USING (status='approved')` policy + the anon/authenticated SELECT grant, i.e.
--     the two-policy Pending-visibility model (Story 3.5). 3.3 ships admin-only visibility (like demo).
--   * demo.parser_version NOT NULL (Decision 3): parser_version is a property of the PARSE — an
--     acquired-but-unparsed demo (the admin manual path; a transiently-queued MatchZy row once Story 3.8
--     splits acquire from parse) legitimately keeps it NULL. Same reasoning that kept demo_sha256 nullable
--     in 3.2. The worker stamps it via UPDATE demo SET parser_version=$1 on parse; it STAYS nullable.
--   * the rich stat columns (assists, ADR, HS%, MVPs, flash/utility, KAST, weird/derived, AFK-idle) are
--     CREATED (nullable) here but POPULATED by Epic 5 (Stories 5.1–5.4). 3.3's parser leaves them NULL.
--   * delete-missing SteamIDs + parse_generation bump on re-parse (Story 3.6): the DELETE grant lands
--     here (so 3.6 needs no grant migration) but the delete-missing logic is 3.6's.
--   * validation / anomaly gate (Σkills==Σdeaths, roster reconciliation, `Anomalous` hold) — Story 3.4.
--     3.3 writes rows unconditionally; `status` takes its 'pending' default.

-- ── stat_row (AD-2 single writer, AD-3 key) — one row per (match, SteamID64) ──
-- The whole SOLUTION-DESIGN §3 column set is created up front (nullable stat shells) so Epic 5's richer
-- derivation only widens the parser, never the schema — exactly how 0005 created `demo` with nullable
-- sha256/parser_version shells.
create table stat_row (
  id            bigint generated always as identity primary key,
  match_id      bigint not null,                                  -- FK -> match(id) DEFERRED to Epic 4 (no match table yet); plain bigint like demo.match_id
  steamid64     text not null check (steamid64 ~ '^[0-9]{17}$'),  -- AD-4 canonical join key; NOT a FK (a parsed-but-unrostered id lands in the unreconciled left-join, never dropped)
  demo_id       bigint not null references demo(id) on delete restrict,  -- provenance: the parse that produced this row (raw demo is write-once; restrict keeps rows honest)
  status        text not null default 'pending' check (status in ('pending','approved')),  -- AD-7; 3.3 writes 'pending', the approve decision is Story 3.5/4.6
  kills int, deaths int, assists int,                             -- 3.3 fills kills/deaths; assists is an Epic-5 shell
  adr_damage int, rounds_played int,                              -- 3.3 fills rounds_played; ADR is computed in the Epic-5 leaderboard view from adr_damage
  hs_kills int, mvps int, flash_assists int, utility_damage int,  -- Epic-5 core shells (FR-18)
  kast_rounds int,                                                -- Epic-5 core shell (FR-18)
  knife_kills int, wallbang_kills int, through_smoke_kills int, no_scope_kills int, blind_kills int,  -- Epic-5 weird shells (FR-19)
  entry_frags int, opening_deaths int, clutches jsonb,            -- Epic-5 derived shells (FR-20)
  idle_dq boolean not null default false, idle_round_count int,   -- Epic-5 AFK/idle shells (FR-21)
  approved_at timestamptz, approved_by text references player(steamid64),  -- set at Story-3.5/4.6 approval (approved_by -> the canonical player key)
  unique (match_id, steamid64)                                    -- AD-3; re-parse = INSERT … ON CONFLICT (match_id, steamid64) DO UPDATE
);

-- The leaderboard/read path filters by match; index it now. (The `stat_row (status)` partial index in
-- SOLUTION-DESIGN §3 is an Epic-5 leaderboard optimization — add it there, not here.)
create index stat_row_match_idx on public.stat_row (match_id);

-- ── ENABLE + FORCE RLS (the AD-7 convention 0002/0003/0004/0005 established) ──
-- FORCE is non-negotiable: the generic catalog FORCE-guard in the 0003 test asserts NO public base table
-- may have FORCE off, so it now covers `stat_row` too and fails loudly here if omitted. FORCE does not
-- affect BYPASSRLS roles — service_role (and the direct owner/worker connection) bypass it.
alter table public.stat_row enable row level security;
alter table public.stat_row force  row level security;

-- ── Admin-only SELECT (no viewer policy yet) — mirrors demo (0005)/audit_log (0003) ─
-- stat_row is admin/worker-only for now: like demo it gets NO anon/authenticated base grant, so this
-- admin-read policy is DORMANT defense-in-depth (even a valid admin claim 42501s at the table-grant gate
-- before RLS runs). Story 3.5 adds the LIVE viewer policy `stat_view USING (status='approved')` + the
-- anon/authenticated SELECT grant (the two-policy Pending model). The (select …) wrap makes is_admin()
-- an init-plan (evaluated once per statement) — the perf precedent from demo/roster.
create policy stat_admin on public.stat_row for select to authenticated using ((select public.is_admin()));

-- ── Grants — the single writer + the re-parse DELETE live HERE ────────────────
-- service_role is the sole writer (AD-2). It has BYPASSRLS, so the admin-only policy does not stop it —
-- the GRANT is what governs it. It gets SELECT+INSERT+UPDATE (upsert = insert + on-conflict update) AND
-- DELETE: unlike `demo` (write-once, no delete), stat_row is DERIVED and re-parsable — Story 3.6's
-- re-parse deletes SteamIDs absent from a fresh parse, so the DELETE grant lands now (3.6 needs no grant
-- migration). Identity PK (generated always as identity) needs NO separate sequence grant.
grant select, insert, update, delete on public.stat_row to service_role;

-- ── Writes/reads for anon/authenticated (fail-closed) ───────────────────────
-- Deliberately NO grant of any kind for anon/authenticated on `stat_row` this slice: no read (admin-only
-- until Story 3.5's viewer policy), no write (single-writer). Doubly fail-closed, by construction —
-- mirrors demo (0005). Story 3.5 adds the anon/authenticated SELECT grant when the Pending model lands.
