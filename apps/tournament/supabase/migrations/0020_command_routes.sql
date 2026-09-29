-- supabase/migrations/0020_command_routes.sql
-- Logical migration 0020 — the audit-and-gating COMPLETENESS slice (Story 4.9, AC1/AC2). The LAST of Epic 4.
--
-- ⚠ THIS MIGRATION DOES NOT "BUILD audit_log" — that shipped in 0003 (Story 1.4), and every match-mutating RPC
-- (0011–0019) already writes an audit_log row and every admin route already re-verifies is_admin(). Story 4.9's
-- two epic ACs are, read per-route, ALREADY TRUE at HEAD. The SCHEMA work this migration owns is the TWO genuine
-- gaps AC2 leaves open, plus nothing else:
--   (a) DECISION B — DROP `audit_log.tournament_id`'s NOT NULL. AD-17 names `grant_role` as an audited action;
--       AD-18 makes a role event-global (v1 has one tournament, but a role grant is not scoped to it). The two
--       collide against 0003:23's `not null`. Dropping it is a WIDENING: append-only is untouched (no update/
--       delete grant or policy is added), every existing row keeps its tournament_id, and the only new shape it
--       permits is an event-global row (tournament_id IS NULL) — written by `setRole` (grant_role, TS layer,
--       lib/auth/roles.ts) and by `accept_anomaly` below (an unbound anomalous demo has no tournament).
--   (b) DELIVERABLE 3 — the `accept_anomaly` RPC. The `Anomalous → Pending` admin decision Story 3.4 AC2
--       requires and 0008:17-20 explicitly homed to "Epic 4 (audited admin routes, AD-8)" — ORPHANED between
--       Epic 3 and Epic 4 ever since. `bind_match_demo` (0016) REFUSES an anomalous demo, so this is the missing
--       unblock step: anomalous demo → admin accepts (LOGGED) → pending → now bindable → bind → approve.
--
-- ⚠ `audit_log.action = 'accept_anomaly'` and `= 'grant_role'` extend the UNCAPPED `action text` vocabulary
-- (0003:25, no CHECK) with NO migration — the 0015 (`begin_grace`/`resume_match`) and 0016 (`bind_demo`)
-- precedent. 0003 is deliberately UNTOUCHED (never edit an applied migration). ⚠ 0003:25's vocabulary comment is
-- now THREE migrations stale; do not read it as exhaustive. The SHIPPED audited-admin-action set is:
--   generate_bracket · declare_format · advance · mark_walkover · begin_grace · resume · bind_demo · approve ·
--   rollback · manual_score · grant_role · accept_anomaly
-- ⚠ `re-parse` (AD-17's list) has NO Next.js admin route — it is worker/CLI-driven (Story 3.6); its audit trail
-- lives on the worker path, not app/api/admin. Its absence from the route surface is correct, not a gap.
--
-- SQLSTATEs — 0020 RAISES NOTHING NEW. `accept_anomaly` RETURNS every refusal as {ok:false, reason} (the 0016/
-- 0017 convention). It touches only `demo` (a single-row lock + one UPDATE) and `audit_log` (one INSERT); it
-- trips no trigger and calls no other RPC, so it can surface no custom SQLSTATE.
--
-- OUT OF SCOPE — do NOT add here (each has an owning story / a standing decision):
--   * NO new table, NO new column. One widening (tournament_id nullable) + one new RPC + its grant. That is all.
--   * NO manual-resolution UNDO / forfeit UNDO forward-tools (DECISION E) — substantial NEW rollback_match-family
--     RPC work (widen the state guard + un-seat dependent advances), a different concern than audit/gating. →
--     a dedicated Epic-4 follow-up / the Epic-4 retro's call. Logged in deferred-work.md.
--   * NO change to advance_match's five bare P0001 raises (DECISION F) — it has no direct route/lib caller (only
--     internal RPC callers, which convert its {ok:false} to distinct codes); its bare-P0001 paths are genuine
--     bracket corruption that legitimately 500. The "4.9's central map" rationale presumes a caller that does
--     not exist.
--   * NO competitor-column write-once trigger (DECISION H) — 4.7 shipped the AD-8 allowlist-flag approach; a
--     second mechanism would be redundant.
--   * NO accept-anomaly BIND / APPROVE / idle_dq (DECISION G/D). accept_anomaly flips ONLY demo.validation_state.
--     The mock's enabled-`Aprobar`-beside-the-banner and its idle_dq second branch (FR-21/Story 5.4) are traps,
--     NOT honoured here. Binding is 4.6a; approving is 4.6b.
--   * NO ceremony-lock gate. AD-15 (SPINE:153): Story 6.2 must add a `ceremony_locked` guard to approve_match /
--     rollback_match / manual_resolve_match (`ceremony` does not exist until Epic 6). accept_anomaly does NOT
--     publish, so it is not in that set. Seam flagged in deferred-work.md, NOT built.
--   * NO CSRF (Epic 7 — uniform across all cookie-authenticated admin POSTs, deferred-work.md 4.1 review).
--   * NO editing 0003 (audit_log's append-only grant/policy posture stays exactly as shipped; re-proven in the
--     0020 pgTAP suite AFTER this widening).

-- ════════════════════════════════════════════════════════════════════════════
-- (a) DECISION B — audit_log.tournament_id becomes NULLABLE (event-global admin actions).
-- ════════════════════════════════════════════════════════════════════════════
-- A WIDENING, not a weakening. The NOT NULL was the only thing standing between AD-17 ("grant_role writes an
-- audit_log row") and AD-18 ("a role is event-global"). Dropping it changes NO grant and NO policy, so the
-- append-only teeth (0003:72-84 — service_role holds SELECT+INSERT only, no update/delete grant; no update/
-- delete policy) are untouched. Every existing audit row keeps its tournament_id. The only NEW shape permitted
-- is tournament_id IS NULL — for an admin action that genuinely belongs to no single tournament.
alter table public.audit_log alter column tournament_id drop not null;
comment on column public.audit_log.tournament_id is
  'AD-18 scope. NULLABLE since 0020 (Story 4.9): event-global admin actions have no single tournament — grant_role (a role is event-global, AD-18) and an accept_anomaly on an UNBOUND anomalous demo (no match → no tournament). Every match-scoped action still passes a real tournament_id; NULL is only the event-global shape.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) DELIVERABLE 3 — accept_anomaly: the Anomalous → Pending admin decision (Story 3.4 AC2), LOGGED.
-- ════════════════════════════════════════════════════════════════════════════
-- The missing unblock step in the ingest→publish pipeline. `demo.validation_state` (0008:41-43) is the ingest
-- ANOMALY axis, deliberately ORTHOGONAL to `stat_row.status`'s publish axis (0008:32). The worker HOLDS a demo
-- by stamping `validation_state='anomalous'` (Story 3.4); `bind_match_demo` (0016:225-227) then REFUSES to bind
-- a held demo. accept_anomaly is the admin's explicit, audited decision to clear the hold — the ONLY thing that
-- makes an anomalous demo bindable (and therefore, eventually, approvable).
--
-- It is a small `security invoker` RPC (mirrors bind_match_demo's shape — the simplest sibling: a single-row
-- lock, one UPDATE, one audit row; NO whole-bracket lock, NO advance, touches no `match` row). Typed refusals
-- RETURNED (the 0016/0017 convention), both guards BEFORE any write:
--   * bad_demo    — no such demo.
--   * not_anomalous — the demo is not `anomalous` (already pending, or never held). Also gives AC2 idempotency:
--     a second accept of an already-accepted demo returns not_anomalous, having written nothing.
-- On success: flip validation_state → 'pending' + stamp validated_at; write ONE `accept_anomaly` audit row
-- (event-global — an unbound anomalous demo has no match and thus no tournament → tournament_id NULL, enabled by
-- (a) above; target_match_id NULL for the same reason; real before/after + the anomaly_reasons that held it).
-- Return {ok:true, demo_id, validation_state:'pending'}.
--
-- ⚠ SCOPE (DECISION G/D): this flips ONLY validation_state. It does NOT touch stat_row.status, does NOT set
-- idle_dq, does NOT auto-bind or auto-approve. It makes the demo BINDABLE; the admin then binds (4.6a) and
-- approves (4.6b) through the existing path.
create function public.accept_anomaly(
  p_demo_id         bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17); NOT NULL + FK to player (0003:24)
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_d record;
begin
  -- ══ 1. THE DEMO, under a single-row lock so its state cannot move under us between read and write.
  select d.id, d.validation_state, d.anomaly_reasons
    into v_d
    from public.demo d
   where d.id = p_demo_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_demo');
  end if;

  -- ══ 2. GUARD — only an anomalous demo can be accepted. A pending demo has nothing to accept; refusing here
  --    (rather than no-op succeeding) also gives AC2 idempotency: a second accept → not_anomalous, no 2nd row.
  if v_d.validation_state <> 'anomalous' then
    return jsonb_build_object('ok', false, 'reason', 'not_anomalous', 'validation_state', v_d.validation_state);
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 3. CLEAR THE HOLD — validation_state → pending, stamp validated_at (mirrors the worker's clean-validate
  --    stamp, 0008:37). anomaly_reasons is left as-is: it is the historical record of WHY it was held, and the
  --    audit row below captures it too. The Story-3.5 publish axis (stat_row.status) is untouched (0008:32).
  update public.demo
     set validation_state = 'pending',
         validated_at     = now()
   where id = p_demo_id;

  -- ══ 4. THE AUDIT ROW (AD-17). `action='accept_anomaly'` extends the uncapped vocabulary with NO migration.
  --    EVENT-GLOBAL: an unbound anomalous demo has no match (target_match_id NULL) and thus no tournament
  --    (tournament_id NULL — the shape (a) above just enabled). The "who" is p_actor_steamid64 (a real player,
  --    0003:24); before/after capture the transition; anomaly_reasons records what held it.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    null,
    p_actor_steamid64,
    'accept_anomaly',
    null,
    jsonb_build_object(
      'demo_id',         p_demo_id,
      'before',          jsonb_build_object('validation_state', 'anomalous'),
      'after',           jsonb_build_object('validation_state', 'pending'),
      'anomaly_reasons', v_d.anomaly_reasons
    )
  );

  return jsonb_build_object('ok', true, 'demo_id', p_demo_id, 'validation_state', 'pending');
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE it would be callable straight off the Data API. It is SECURITY INVOKER (a viewer would 42501 at
-- the demo UPDATE anyway), but a defence that depends on a later grant check is not a defence: revoke first,
-- then grant to the single writer. The route's requireAdmin is the authorization gate; this is the second lock
-- on the same door (0016:289-296). The 0020 pgTAP suite asserts this holds as part of the AC1 grant matrix SET.
revoke execute on function public.accept_anomaly(bigint, text) from public;
grant  execute on function public.accept_anomaly(bigint, text) to service_role;
