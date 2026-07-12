-- supabase/migrations/0008_demo_validation.sql
-- Logical migration 0008 — Validation & anomaly gate slice (Story 3.4).
-- Realizes the `Validating → (Anomalous | Pending)` span of the ingest state machine: after a fresh parse
-- writes the per-player rows (Story 3.3), the worker computes three gates (Σkills==Σdeaths, ≥1 stat row,
-- roster reconciliation) and — on any failure — HOLDS the match by stamping `demo.validation_state =
-- 'anomalous'` with machine-readable reasons (AD-2 single writer sets the flag; never silent). This
-- migration adds the columns that hold the outcome + the admin-only unreconciled left-join surface.
--
-- SCOPE (whole deliverable):
--   (a) ALTER `demo` — the Validating-node anomaly-hold axis: `validation_state ('pending'|'anomalous')`,
--       `anomaly_reasons jsonb`, `validated_at timestamptz`. The worker sets these on the SAME `demo` row
--       it already stamps `parser_version` (Story 3.3) — AD-2 single writer; service_role already holds
--       UPDATE on `demo` from 0005, so NO new grant. RLS unchanged (demo is ENABLE+FORCE + admin-only read).
--   (b) CREATE the admin-only `unreconciled_stat_row` view = the Story-2.6 DATA SURFACE (AD-4 left-join):
--       every `stat_row` whose `steamid64` is not on the ACTIVE roster. security_invoker=on; service_role
--       SELECT grant only (NO anon/authenticated) — mirrors stat_row/demo (admin reads via a server route).
-- OUT OF SCOPE — do NOT add here:
--   * the admin accept-anomaly (`Anomalous → Pending`) + Aprobar publish (`Pending → Approved`) command
--     routes — Epic 4 (audited admin routes, AD-8; Aprobar = Story 4.6). 0008 only SETS the flag the
--     worker owns; the app-side decisions consume it later.
--   * the Story-2.6 admin reconcile UI / one-tap linkage affordance / any CLIENT Data-API access to the
--     view — the app-surface epic. 0008 ships only the data surface (reconcile stays mechanical: Story
--     2.5's adminAddPlayer path re-joins orphaned rows via the shared FK-less steamid64 key).
--   * the viewer `stat_view USING (status='approved')` policy + the anon/authenticated SELECT grant (the
--     two-policy Pending-visibility model) — Story 3.5. The anomaly axis and the publish axis are orthogonal.
--   * demo_match_fk / stat_row_match_fk + match→tournament scoping of the roster read + this view — Epic 4
--     (no `match` table until then; v1 is single-tournament, so the active roster is the whole set).
--   * a `demo.validation_state` index — a friends tournament is tens of matches; skip it (optional
--     Epic-5/ops optimization if the held-list query ever matters).

-- ── (a) demo: the ingest anomaly-hold axis (distinct from stat_row.status's publish axis) ─────
-- Two orthogonal axes now live on the pipeline: `demo.validation_state` (this ingest hold axis) and
-- `stat_row.status` (the Story-3.5 publish axis, pending/approved). They must not be conflated (AD-7):
--   'pending'   + validated_at IS NULL  = parsed, not yet validated
--   'pending'   + validated_at set      = validated & clean (may proceed toward Approved — Epic 4)
--   'anomalous'                         = a gate failed; HELD for admin accept (Epic 4), reasons in jsonb
-- The worker stamps all three in the SAME transaction that upserts the stat rows + stamps parser_version
-- (all-or-nothing). NO new grant: service_role already holds UPDATE on `demo` from 0005 (that grant covers
-- new columns). RLS is untouched — `demo` stays ENABLE+FORCE with the dormant admin-only SELECT policy.
alter table public.demo
  add column validation_state text not null default 'pending'
    check (validation_state in ('pending','anomalous')),
  add column anomaly_reasons  jsonb,
  add column validated_at      timestamptz;

-- ── (b) unreconciled_stat_row (AD-4 / FR-2) — the Story-2.6 admin data surface ────────────────
-- Every stat_row whose steamid64 is NOT on the ACTIVE roster (the AD-4 "unreconciled list (left-join),
-- never silently dropped"). stat_row.steamid64 is deliberately non-FK, so a parsed-but-unrostered id is
-- insertable (Story 3.3 writes it) and surfaces HERE rather than being dropped. Reconciliation is
-- MECHANICAL: adding that steamid64 to the roster (Story 2.5's adminAddPlayer) makes the row drop out of
-- this view automatically via the shared key — no rewrite.
--
-- security_invoker=on => the CALLER's grants + RLS apply (not the view owner's): service_role (BYPASSRLS)
-- reads the underlying stat_row/roster_entry; anon/authenticated 42501 at the view grant gate below (fail
-- closed), exactly like stat_row/demo. Admin reads it via a service-role SERVER route (the Epic-5 admin UI
-- consumes it that way) — NO client Data-API grant. The join is on steamid64 ALONE because v1 is
-- single-tournament (no match→tournament link until Epic 4, which will then scope both this view and the
-- worker's roster read to the match's tournament).
create view public.unreconciled_stat_row with (security_invoker = on) as
  select s.match_id, s.steamid64, s.demo_id
  from public.stat_row s
  left join public.roster_entry r
    on r.steamid64 = s.steamid64 and r.status = 'active'
  where r.id is null;

-- Grant SELECT to the single reader that is allowed to see it (service_role, behind a server route).
-- Deliberately NO anon/authenticated grant — admin/worker-only until an app-surface story exposes it
-- (mirrors the stat_row/demo fail-closed default). A view is not a base table, so the 0003 generic
-- FORCE-guard (relkind='r') does not cover it; access is governed by this grant + security_invoker.
grant select on public.unreconciled_stat_row to service_role;
