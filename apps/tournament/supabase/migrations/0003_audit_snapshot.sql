-- supabase/migrations/0003_audit_snapshot.sql
-- Logical migration 0003 — Append-only audit + snapshot convention (Story 1.4).
-- Realizes AD-17 (append-only audit_log) and creates the AD-15/AD-19 snapshot substrate
-- (stat_snapshot, stat_snapshot_row) as write-once table shells. Completes the CAP-1 substrate:
-- audit_log + snapshot tables are append-only (NO UPDATE/DELETE — neither policy NOR grant).
--
-- SCOPE (whole deliverable): create the three tables with their SOLUTION-DESIGN §3 columns,
--   the audit_log index, ENABLE+FORCE RLS, an admin-only SELECT policy on each, and
--   service_role SELECT+INSERT grants (NO update/delete). Establishes the append-only convention.
-- OUT OF SCOPE — do NOT add here (a FK to a non-existent table fails to apply):
--   * ceremony (Epic 6): do NOT add `alter table ceremony add constraint ceremony_snapshot_fk ...`.
--     stat_snapshot is created FIRST (substrate); ceremony.snapshot_id's FK to it is added in Epic 6.
--   * match (Epic 4): audit_log.target_match_id stays a plain nullable bigint with NO FK yet
--     (mirrors 0001's tournament.final_match_id deferral). Its FK to match(id) arrives in Epic 4.
--   * Snapshot CAPTURE (SERIALIZABLE ceremony-lock + INSERT population + ceremony.state gating) -> Story 6.2 (AD-15).
--   * award*/spin/verification_bundle reveal-gating (AD-22) -> Epic 6.
--   * The granted_by admin-only / no-self-grant invariant -> Story 2.4 server route (RLS can't enforce it;
--     service-role writes bypass RLS). Do NOT add a CHECK/trigger here.

-- ── audit_log (AD-17) — append-only by construction ─────────────────────────
create table audit_log (
  id              bigint generated always as identity primary key,
  tournament_id   bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  actor_steamid64 text   not null references player(steamid64),                  -- who acted; NO ACTION on delete keeps the trail intact
  action          text   not null,   -- generate_bracket|advance|mark_walkover|approve|reparse|rollback|declare_format|start_ceremony|grant_role
  target_match_id bigint,            -- nullable; FK to match(id) DEFERRED to Epic 4 (match does not exist yet)
  detail          jsonb,             -- before/after (AD-17)
  occurred_at     timestamptz not null default now()
);
create index audit_log_tournament_occurred on audit_log (tournament_id, occurred_at);

-- ── stat_snapshot (AD-15) — write-once snapshot header ──────────────────────
create table stat_snapshot (
  id             bigint generated always as identity primary key,
  tournament_id  bigint not null references tournament(id) on delete cascade,
  taken_at       timestamptz not null default now(),
  content_sha256 text not null
);
-- NOTE: ceremony.snapshot_id's FK to stat_snapshot(id) is added by the Epic-6 ceremony migration,
-- NOT here — `ceremony` does not exist at 0003.

-- ── stat_snapshot_row (AD-19) — the verifier's integer-form contract; write-once ─
create table stat_snapshot_row (
  snapshot_id    bigint not null references stat_snapshot(id) on delete cascade,
  steamid64      text   not null,
  stats_int      jsonb  not null,   -- volume ints; rate {num,den}; secondary; efficiency {num,den} (AD-19)
  h2h            jsonb,             -- per-opponent deciding values
  achievement_ts bigint,            -- integer tick/epoch-ms; published absent-sentinel if absent (AD-19)
  rounds_played  int,
  kills          int,
  idle_dq        boolean,
  primary key (snapshot_id, steamid64)
);

-- ── ENABLE + FORCE RLS on all three (the AD-7 convention 0002 established) ───
alter table audit_log         enable row level security;
alter table audit_log         force  row level security;
alter table stat_snapshot     enable row level security;
alter table stat_snapshot     force  row level security;
alter table stat_snapshot_row enable row level security;
alter table stat_snapshot_row force  row level security;

-- ── Admin-only SELECT (no viewer policy) — mirrors app_role (0002) ──────────
-- Admin surfaces read these via SERVER routes with the service key, NOT the client Data API.
-- Like app_role, these tables get NO anon/authenticated grant, so this admin-read policy is
-- DORMANT defense-in-depth (a viewer OR an admin 42501s at the table-grant gate before RLS runs).
-- The (select …) wrap makes is_admin() an init-plan (evaluated once per statement) — roadmap perf precedent.
create policy audit_admin_read    on audit_log         for select to authenticated using ((select public.is_admin()));
create policy snapshot_admin_read on stat_snapshot     for select to authenticated using ((select public.is_admin()));
create policy snaprow_admin_read  on stat_snapshot_row for select to authenticated using ((select public.is_admin()));

-- ── Grants — append-only mechanism lives HERE, not (only) in policy absence ──
-- service_role is the sole writer (AD-2/AD-17). It has BYPASSRLS, so the "no UPDATE/DELETE policy"
-- rule does NOT stop it — grants do (BYPASSRLS skips row POLICIES, never table GRANTS). Granting only
-- SELECT+INSERT (and deliberately NOT update/delete) makes these tables append-only for the privileged
-- writer too — the real teeth behind AD-17's "append-only by absence". Identity PKs (generated always
-- as identity) need NO separate sequence grant. NO anon/authenticated grant at all (admin-only).
grant select, insert on audit_log         to service_role;
grant select, insert on stat_snapshot     to service_role;
grant select, insert on stat_snapshot_row to service_role;

-- ── Writes/reads for anon/authenticated (fail-closed) ───────────────────────
-- Deliberately NO policy and NO grant of any kind for anon/authenticated on the three tables:
-- no read (admin-only), no write (append-only + admin-only). Doubly fail-closed, by construction.
