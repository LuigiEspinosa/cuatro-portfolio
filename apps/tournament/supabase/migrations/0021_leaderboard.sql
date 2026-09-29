-- supabase/migrations/0021_leaderboard.sql
-- Logical migration 0021 — the single normalized leaderboard (Story 5.5, AD-20).
--
-- ONE object because there is ONE standings aggregate in the whole system: a PLAIN, always-live
-- `security_invoker=on` VIEW over `stat_row WHERE status='approved'`. It is the ONLY place the FR-21
-- anti-farm floors and the FR-22 rate-vs-volume classing are computed — no component hand-rolls a second
-- aggregate (AD-20 "one owner, one normalization site, one shape").
--
-- ⭐ WHY A PLAIN VIEW AND NOTHING ELSE (the decision was pre-made, firsthand-verified):
--   * Epic-4 retro Action Item #2 requires this leaderboard to be a view over status='approved' so 4.6b
--     Aprobar's "recompute leaderboards" stays a correct NO-OP — zero revision to approve_match.
--   * 0017_aprobar_publish.sql:15-18,390-391 (DECISION E): the status flip IS the recompute; the leaderboard
--     is Story 5.5's. 0018_rollback_match.sql:60-63,336-337: the flip back to 'pending' IS the removal.
--     Because THIS view reads live off status='approved', both are true by construction (AC2).
--   * A REFRESH MATERIALIZED VIEW in-txn would take an ACCESS EXCLUSIVE lock and VIOLATE AD-6/AD-20 —
--     so this is NOT a matview, and there is NO REFRESH anywhere.
--   * Scale is 8–16 players / a private audience; the app filters/orders/hides per board client-side off
--     this wide per-player view, so no runtime parameter justifies an RPC. One owner, one shape.
--
-- SCOPE (whole deliverable):
--   (a) CREATE view public.leaderboard (security_invoker=on) — one row per steamid64, cumulative across
--       that player's contributing approved, non-idle matches. Applies the FR-21 floors + FR-22 classing
--       in exactly this one place. grant select to anon, authenticated, service_role (public viewer surface,
--       unlike the service_role-only unreconciled_stat_row).
--   (b) CREATE the stat_row(steamid64) WHERE status='approved' partial index earmarked at 0007:52-54 /
--       0009:24 to support the per-player aggregation.
-- OUT OF SCOPE — do NOT add here:
--   * NO materialized view, NO REFRESH — a plain live view (see ⭐ above); an in-txn REFRESH violates AD-6/AD-20.
--   * NO RPC / function — the app expresses all board filtering/ordering client-side; nothing needs a runtime arg.
--   * NO change to approve_match (0017) or rollback_match (0018) — their "recompute leaderboards" is a
--     comment-only NO-OP (DECISION E, verified) and this view is what makes that correct (AC2). Zero revision owed.
--   * NO touch to award.floor_* / verification_bundle — those are Epic 6 (award catalog). The 24/20 floor
--     literals here are value-parity duplicates flagged as an Epic-6 seam, not reads of award columns.
--   * NO clutch aggregate/board — over the all-1v1 wingman format clutches are structurally {} for everyone
--     (Don Clutch retired in 5.3). This view does not reference the clutches column at all.
--   * NO worker / app / lib / .ts change — a pure DB slice; the read surfaces that consume it are Stories 5.6/5.7.
--   * NO grant/policy change to `player` — the display_name LEFT JOIN rides the caller's existing player
--     read (0002:51,71 give anon/authenticated SELECT + RLS using(true)); under security_invoker it simply
--     resolves the name, and would degrade to a NULL name (not an error) if that ever changed. Out of scope.

-- ── (a) leaderboard — the single normalized standings aggregate (AD-20) ────────────────────────
-- security_invoker=on => the CALLER's RLS on stat_row applies (viewers ride the 0009 stat_view policy
-- `using (status='approved')`; a pending row is never visible to them). The explicit `status='approved'`
-- in the base scan is belt-and-suspenders: it keeps the aggregate correct even for admin/service_role
-- callers who CAN see pending rows through the stat_admin policy (AC3). A pending row never contributes.
-- `idle_dq = false` excludes AFK/idle-DQ'd contributions entirely (AC7) — per-MATCH exclusion (parallels
-- forfeit/bye hygiene, AD-9), never a per-player ban: a player's non-idle matches still count.
create view public.leaderboard with (security_invoker = on) as
with thresholds as (
  -- FR-21 anti-farm floors as the ONLY definition site (AD-20). value-parity with award.floor_rounds
  -- default 24 / floor_kills "20 for rate/HS boards" (SOLUTION-DESIGN.md:168-169). ⚠ Epic-6 duplication
  -- seam: when the award.floor_* columns land, these two literals and those defaults must stay in lockstep.
  -- The floors are CUMULATIVE across a player's contributing matches, NEVER per-match — a 1v1 wingman match
  -- is ≤~22 rounds, so a per-match ≥24 gate would DQ everyone (SM-C1 inverted; the "reads 0 because these
  -- are duels" trap).
  select 24 as floor_rounds, 20 as floor_kills
),
agg as (
  -- One row per player. Every int stat is coalesced NULL→0 BEFORE summing so a row parsed before Epic
  -- 5/5.3/5.4 (which carries SQL NULL in the Epic-5 columns until its demo is re-parsed — expected, not a
  -- backfill) cannot silently drop the player through SUM/ORDER BY/WHERE (deferred-work.md:9, homed here).
  select
    s.steamid64,
    count(*)                                     as matches_played,
    -- rate denominators (per-round opportunity) + the volume totals that double as floor inputs
    sum(coalesce(s.rounds_played, 0))            as rounds_played_total,   -- ADR & KAST denom; ≥24 round floor
    sum(coalesce(s.kills, 0))                    as kills_total,           -- HS% denom; ≥20 kill floor
    -- rate numerators
    sum(coalesce(s.adr_damage, 0))               as adr_damage_sum,
    sum(coalesce(s.kast_rounds, 0))              as kast_rounds_sum,
    sum(coalesce(s.hs_kills, 0))                 as hs_kills_sum,
    -- volume totals (cumulative sums; no floor hiding)
    sum(coalesce(s.deaths, 0))                   as deaths_total,
    sum(coalesce(s.assists, 0))                  as assists_total,
    sum(coalesce(s.mvps, 0))                     as mvps_total,
    sum(coalesce(s.flash_assists, 0))            as flash_assists_total,
    sum(coalesce(s.utility_damage, 0))           as utility_damage_total,
    sum(coalesce(s.knife_kills, 0))              as knife_kills_total,
    sum(coalesce(s.wallbang_kills, 0))           as wallbang_kills_total,
    sum(coalesce(s.through_smoke_kills, 0))      as through_smoke_kills_total,
    sum(coalesce(s.no_scope_kills, 0))           as no_scope_kills_total,
    sum(coalesce(s.blind_kills, 0))              as blind_kills_total,
    -- entry-success ratio inputs (also exposed as volume totals)
    sum(coalesce(s.entry_frags, 0))              as entry_frags_total,
    sum(coalesce(s.opening_deaths, 0))           as opening_deaths_total
  from public.stat_row s
  where s.status = 'approved'
    and s.idle_dq = false
  group by s.steamid64
)
select
  -- ── identity ──────────────────────────────────────────────────────────────────────────────────
  a.steamid64,
  p.display_name,                               -- LEFT JOIN player; NULL if the caller cannot read player (see header) — degrades, never errors
  a.matches_played,
  a.rounds_played_total,
  a.kills_total,
  -- ── rate boards (FR-22 "por oportunidad"): Σnumerator / nullif(Σdenominator, 0). Sum-then-divide —
  --    NEVER an average of per-match ratios. nullif guards a 0-opportunity player → NULL ratio (rendered
  --    "sin datos" / ineligible upstream), never a division error (AC9). Numerator cast to numeric so the
  --    division is real, not integer (Σ of int is bigint; bigint/bigint would floor). ──────────────
  a.adr_damage_sum,
  a.adr_damage_sum::numeric  / nullif(a.rounds_played_total, 0)                as adr,        -- Σadr_damage / Σrounds
  a.kast_rounds_sum,
  a.kast_rounds_sum::numeric / nullif(a.rounds_played_total, 0)                as kast_pct,   -- Σkast_rounds / Σrounds
  a.hs_kills_sum,
  a.hs_kills_sum::numeric    / nullif(a.kills_total, 0)                        as hs_pct,     -- Σhs_kills / Σkills
  (a.entry_frags_total + a.opening_deaths_total)                              as entry_opportunities,
  a.entry_frags_total::numeric
    / nullif(a.entry_frags_total + a.opening_deaths_total, 0)                 as entry_success, -- Σentry / (Σentry + Σopening)
  -- ── volume boards (FR-22 "totales", no floor hiding) ────────────────────────────────────────────
  a.deaths_total,
  a.assists_total,
  a.mvps_total,
  a.flash_assists_total,
  a.utility_damage_total,
  a.knife_kills_total,
  a.wallbang_kills_total,
  a.through_smoke_kills_total,
  a.no_scope_kills_total,
  a.blind_kills_total,
  a.entry_frags_total,
  a.opening_deaths_total,
  -- ── eligibility flags (FR-21) — the app reads these; it never re-derives the floors (AD-20 single site).
  --    CUMULATIVE over the player's contributing matches (see thresholds comment). ──────────────────
  (a.rounds_played_total >= t.floor_rounds)                                   as meets_round_floor,
  (a.kills_total        >= t.floor_kills)                                     as meets_kill_floor,   -- rate/HS boards only
  (a.rounds_played_total >= t.floor_rounds and a.kills_total >= t.floor_kills) as eligible_rate
from agg a
cross join thresholds t
left join public.player p on p.steamid64 = a.steamid64;

-- Public viewer surface: grant SELECT to every client role. Unlike the admin/worker-only
-- unreconciled_stat_row (service_role only), the leaderboard is what the audience reads. A view is not a
-- base table, so the 0003 generic FORCE-guard does not cover it; access = this grant + security_invoker
-- reaching the base-table stat_view RLS (0009). It is NEVER security_definer.
grant select on public.leaderboard to anon, authenticated, service_role;

-- ── (b) the earmarked per-player partial index (0007:52-54 / 0009:24) ──────────────────────────
-- The leaderboard aggregation scans stat_row filtered status='approved' and groups by steamid64. This
-- partial index (approved rows only) sizes exactly to that access path. Distinct from stat_row_match_idx
-- (matchzy_match_id) and stat_row_bracket_match_idx (match_id) — a different column and a WHERE predicate.
create index stat_row_approved_idx on public.stat_row (steamid64) where status = 'approved';
