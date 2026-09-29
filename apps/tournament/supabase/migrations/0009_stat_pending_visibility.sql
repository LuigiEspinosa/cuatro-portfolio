-- supabase/migrations/0009_stat_pending_visibility.sql — Story 3.5 (stage stats to Pending, ingest side of FR-13)
-- Logical migration 0009 — turn ON the viewer-facing half of the AD-7 two-policy Pending model on stat_row.
-- Realizes the `Pending` node of the ingest state machine from the READER's side: parsed rows already land
-- status='pending' (0007 default; RecordParse preserves it), and this migration is what makes that status
-- MEAN something to a client — a viewer now sees ONLY approved rows, an admin sees pending too, enforced at
-- the row level by RLS.
--
-- SCOPE (whole deliverable): turn ON the viewer-facing half of the AD-7 two-policy Pending model on stat_row —
--   (a) the LIVE viewer policy  stat_view USING (status='approved')  for anon + authenticated;
--   (b) the anon/authenticated SELECT *grant* that makes it (and the dormant 0007 stat_admin policy)
--       reachable. Until now stat_row had NO anon/authenticated grant, so every client read 42501'd at
--       the grant gate before RLS ran (admin/worker-only). Rows ALREADY land status='pending' (0007
--       default; RecordParse preserves it) — there is NO worker/app code in this story.
--   Two SEPARATE permissive policies, never OR'd (AD-7): Postgres ORs them (approved-for-all ∪
--   everything-for-admin), but keeping them separate means a malformed admin policy can only ADD
--   admin's own rows, never widen the viewer's approved-only set.
-- OUT OF SCOPE — do NOT add here:
--   * the Aprobar publish (status->'approved', approved_at/approved_by, advance bracket, post feed,
--     recompute leaderboards, one tx) — Story 4.6 (AD-6/AD-8). 3.5 writes NO approval.
--   * a match.state column / the Pendiente|Aprobado Spanish labels — no match table until Epic 4; the
--     match's Pending-ness is the derived aggregate of stat_row.status; the label map is Epic-5 i18n.
--   * a leaderboard view/RPC over status='approved' (AD-20) — Story 5.5. 3.5 is the base-table RLS teeth.
--   * adding stat_row to a Realtime publication (viewer ~2s nudge) — Epic 5 (Story 5.8).
--   * the stat_row(status) partial index (Epic-5 leaderboard optimization).
--   * recreating stat_admin / altering stat_row columns/RLS/service_role grants — all set in 0007.

-- (a) LIVE viewer policy: viewers (anon + authenticated) see ONLY approved rows. NO is_admin() escape
--     hatch here (AD-7) — admin Pending visibility is the SEPARATE stat_admin policy (0007). No
--     (select …) init-plan wrap needed: the qual is a plain column compare, not a function call.
create policy stat_view on public.stat_row for select to anon, authenticated
  using (status = 'approved');

-- (b) the base-table SELECT grant that makes stat_view (and the dormant stat_admin) reachable. SELECT
--     ONLY — writes stay single-writer (no anon/authenticated write grant or policy; unchanged from 0007).
grant select on public.stat_row to anon, authenticated;
