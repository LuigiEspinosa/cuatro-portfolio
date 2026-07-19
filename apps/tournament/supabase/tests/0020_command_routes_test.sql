-- supabase/tests/0020_command_routes_test.sql
-- pgTAP proof for migration 0020 (Story 4.9): the audit-and-gating COMPLETENESS slice (AC1/AC2 as SETS).
-- Run via: supabase test db. Runs inside a transaction and rolls back — no data persists.
--
--   AC1  THE GRANT MATRIX AS A SET: every admin-mutating command RPC grants EXECUTE to service_role ONLY
--        (anon/authenticated = false) — the AD-8 "second lock" proven for the whole command surface, not one
--        RPC at a time. A NEW command RPC that forgets its revoke reddens here.                          -> A
--   AC2  APPEND-ONLY RE-CONFIRMED after the tournament_id widening: audit_log has NO update/delete grant to
--        any role and NO update/delete policy; service_role KEEPS select+insert; anon/authenticated stay fully
--        fail-closed; and a raw service_role insert with tournament_id=NULL now SUCCEEDS (the event-global
--        enabler).                                                                                        -> B
--   AC2  accept_anomaly BEHAVIOUR (DELIVERABLE 3): an anomalous demo -> pending + validated_at + ONE
--        event-global accept_anomaly audit row (real before/after); a second accept -> not_anomalous with NO
--        phantom 2nd row; a missing demo -> bad_demo.                                                     -> C
--   AC2  grant_role SCHEMA ENABLEMENT (DECISION B): audit_log.tournament_id is now NULLABLE (schema + runtime),
--        so setRole's event-global grant_role row is insertable (CONTENT proven in roles.test.ts).      -> B5/B6
--
-- ⚠ MUTATION-TESTED BY EXECUTION (the standing 4.1–4.8 lesson — deferred-work.md). Each 0020 effect is a way to
-- be blind; each defect below was injected via create-or-replace / alter / grant against the committed DB and
-- this file re-run over psql on 2026-07-19. A green suite after any is a blind suite; fix the test, not the
-- mutation. [OBSERVED] were run this session; [predicted] is the one remaining derivable case:
--   * neuter accept_anomaly's REVOKE (grant execute to public) -> [OBSERVED] test 22 RED (the A accept_anomaly anon/auth row)
--   * RE-ADD `alter audit_log alter tournament_id set not null` -> [OBSERVED] tests 27 + 28 RED (B5 col_is_null schema +
--        B6 runtime null insert). ⚠ B5 is placed BEFORE B6 deliberately: run AFTER B6, its schema read is stale-snapshotted
--        by B6's caught NOT-NULL failure in the same transaction and passes green — proven by isolating col_is_null, which
--        goes `not ok` under NOT NULL. Before B6, both halves of the widening redden.
--   * grant UPDATE on audit_log to service_role              -> [OBSERVED] test 23 RED (B append-only teeth broken)
--   * drop accept_anomaly's audit INSERT                     -> [OBSERVED] tests 31/32/34 RED (C3 count / C4 detail / C6 phantom)
--   * skip accept_anomaly's not_anomalous guard              -> [OBSERVED] tests 33/34 RED (C5 idempotent refusal + C6 phantom 2nd row)
--   * skip accept_anomaly's validation_state flip            -> [predicted] C2 RED (state stays anomalous)
--
-- SQLSTATE: none raised here — accept_anomaly RETURNS every refusal; 23502 would fire only if the widening were
-- undone (exercised as a mutation, not in the shipped suite).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- plan: A 22 + B 6 (incl. the tournament_id-nullable schema check) + C 7 = 35.
select plan(35);

-- ════════════════════════════════════════════════════════════════════════════
-- Fixture: an admin player + two demos (one held/anomalous, one clean/pending).
-- ════════════════════════════════════════════════════════════════════════════
insert into player (steamid64, display_name) values ('76561197960287930', 'AdminPlayer');

insert into demo (matchzy_match_id, storage_key, source, validation_state, anomaly_reasons)
  values (9001, 'demos/4-9/anom.dem', 'matchzy', 'anomalous',
          '[{"gate":"conservation","detail":"sum_kills=16 sum_deaths=15 delta=1"}]'::jsonb);
insert into demo (matchzy_match_id, storage_key, source, validation_state)
  values (9002, 'demos/4-9/clean.dem', 'matchzy', 'pending');

-- Helpers (mirroring 0016/0017/0018/0019 — reuse, never hand-derive).
create function pg_temp.did(skey text) returns bigint language sql stable as $fn$
  select id from public.demo where storage_key = skey
$fn$;
create function pg_temp.admin() returns text language sql immutable as $fn$
  select '76561197960287930'::text
$fn$;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — AC1: the grant matrix as a SET. Every admin-mutating command RPC is service_role-only EXECUTE.
-- Enumerated BY NAME (not a catalog sweep — that would drag in trigger-guard functions; the enumerated list IS
-- the AD-8/AD-17 command surface, and keeping it here is the point: a new command RPC must be added to it).
-- ⚠ There is no `begin_grace` — Story 4.9's list said "begin_match_grace, …, begin_grace" but 0016 defines no
-- such function; the grace RPCs are begin_match_grace + resume_match (0015). Corrected here (DELIVERABLE 5).
-- ════════════════════════════════════════════════════════════════════════════
select ok(has_function_privilege('service_role', 'public.generate_bracket(bigint, text, jsonb, jsonb, jsonb)', 'EXECUTE'),
  'A: service_role CAN execute generate_bracket');
select ok(not has_function_privilege('anon', 'public.generate_bracket(bigint, text, jsonb, jsonb, jsonb)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.generate_bracket(bigint, text, jsonb, jsonb, jsonb)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute generate_bracket');

select ok(has_function_privilege('service_role', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE'),
  'A: service_role CAN execute declare_match_format');
select ok(not has_function_privilege('anon', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.declare_match_format(bigint, bigint[], text, text, text, boolean)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute declare_match_format');

select ok(has_function_privilege('service_role', 'public.advance_match(bigint, text, boolean)', 'EXECUTE'),
  'A: service_role CAN execute advance_match');
select ok(not has_function_privilege('anon', 'public.advance_match(bigint, text, boolean)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.advance_match(bigint, text, boolean)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute advance_match');

select ok(has_function_privilege('service_role', 'public.begin_match_grace(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute begin_match_grace');
select ok(not has_function_privilege('anon', 'public.begin_match_grace(bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.begin_match_grace(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute begin_match_grace');

select ok(has_function_privilege('service_role', 'public.resume_match(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute resume_match');
select ok(not has_function_privilege('anon', 'public.resume_match(bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.resume_match(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute resume_match');

select ok(has_function_privilege('service_role', 'public.mark_walkover(bigint, text, bigint)', 'EXECUTE'),
  'A: service_role CAN execute mark_walkover');
select ok(not has_function_privilege('anon', 'public.mark_walkover(bigint, text, bigint)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.mark_walkover(bigint, text, bigint)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute mark_walkover');

select ok(has_function_privilege('service_role', 'public.bind_match_demo(bigint, bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute bind_match_demo');
select ok(not has_function_privilege('anon', 'public.bind_match_demo(bigint, bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.bind_match_demo(bigint, bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute bind_match_demo');

select ok(has_function_privilege('service_role', 'public.approve_match(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute approve_match');
select ok(not has_function_privilege('anon', 'public.approve_match(bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.approve_match(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute approve_match');

select ok(has_function_privilege('service_role', 'public.rollback_match(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute rollback_match');
select ok(not has_function_privilege('anon', 'public.rollback_match(bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.rollback_match(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute rollback_match');

select ok(has_function_privilege('service_role', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE'),
  'A: service_role CAN execute manual_resolve_match');
select ok(not has_function_privilege('anon', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.manual_resolve_match(bigint, integer, integer, text, boolean)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute manual_resolve_match');

-- ⭐ the NEW one — accept_anomaly must join the service_role-only set (the mutation "grant execute to public" reddens this).
select ok(has_function_privilege('service_role', 'public.accept_anomaly(bigint, text)', 'EXECUTE'),
  'A: service_role CAN execute accept_anomaly (the sole writer, AD-2/AD-8)');
select ok(not has_function_privilege('anon', 'public.accept_anomaly(bigint, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.accept_anomaly(bigint, text)', 'EXECUTE'),
  'A: neither anon nor authenticated can execute accept_anomaly — a viewer cannot clear a hold');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — AC2: append-only teeth RE-CONFIRMED after the tournament_id widening (0003:72-84's posture holds).
-- ════════════════════════════════════════════════════════════════════════════
-- B1: the privileged writer has NO update/delete — append-only lives in the GRANT, not just the policy (0003).
select ok(not has_table_privilege('service_role', 'public.audit_log', 'UPDATE')
      and not has_table_privilege('service_role', 'public.audit_log', 'DELETE'),
  'B: service_role has NEITHER UPDATE nor DELETE on audit_log (append-only by grant absence, post-widening)');

-- B2: it STILL has the append + admin-read grants — the widening changed no grant.
select ok(has_table_privilege('service_role', 'public.audit_log', 'INSERT')
      and has_table_privilege('service_role', 'public.audit_log', 'SELECT'),
  'B: service_role KEEPS insert+select on audit_log (append + admin-read intact after the widening)');

-- B3: no update/delete/all POLICY exists (the second layer of the append-only teeth).
select is(
  (select count(*)::int from pg_policies
     where schemaname = 'public' and tablename = 'audit_log' and cmd in ('UPDATE', 'DELETE', 'ALL')),
  0,
  'B: audit_log has NO update/delete/all policy (only the admin-only SELECT policy from 0003)');

-- B4: anon/authenticated remain fully fail-closed — no insert/update/delete of any kind.
select ok(not has_table_privilege('anon', 'public.audit_log', 'INSERT')
      and not has_table_privilege('anon', 'public.audit_log', 'UPDATE')
      and not has_table_privilege('anon', 'public.audit_log', 'DELETE')
      and not has_table_privilege('authenticated', 'public.audit_log', 'INSERT')
      and not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  'B: anon/authenticated have NO write of any kind on audit_log (fail-closed, unchanged)');

-- B5 (schema): ⭐ the tournament_id NOT NULL is GONE (DECISION B / grant_role schema enablement). This is the
-- SCHEMA-metadata half of the widening; it MUST precede the runtime null-insert below, because that insert's
-- caught subtransaction failure (when the mutation re-adds NOT NULL) leaves the catalog snapshot such that a
-- later col_is_null reads stale — so the schema assertion is placed here, where it reddens cleanly under the
-- "re-add NOT NULL" mutation. (The row's CONTENT is proven in lib/auth/roles.test.ts.)
select col_is_null('public', 'audit_log', 'tournament_id',
  'B: audit_log.tournament_id is NULLABLE (0020 widening — event-global admin actions have no single tournament)');

-- B6: ⭐ THE WIDENING AT RUNTIME — a raw service_role insert with tournament_id=NULL now SUCCEEDS (the
-- event-global enabler for grant_role + an unbound-demo accept_anomaly). If the NOT NULL were still present this
-- would 23502.
set local role service_role;
select lives_ok(
  $$ insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
     values (null, '76561197960287930', 'grant_role', null,
             '{"target":"76561197960287931","before":{"role":null},"after":{"role":"admin"}}'::jsonb) $$,
  'B: an event-global audit row (tournament_id NULL) is INSERTABLE by service_role (the NOT NULL is gone)');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — AC2: accept_anomaly behaviour (DELIVERABLE 3). Run as postgres (the RPC is security invoker; the
-- grant matrix in A proves anon/authenticated cannot reach it).
-- ════════════════════════════════════════════════════════════════════════════
-- C1: accept the held demo -> ok:true.
select is(
  (public.accept_anomaly(pg_temp.did('demos/4-9/anom.dem'), pg_temp.admin())->>'ok'),
  'true',
  'C1: accept_anomaly on an anomalous demo returns ok:true');

-- C2: the hold is cleared — validation_state -> pending AND validated_at stamped.
select ok(
  (select validation_state = 'pending' and validated_at is not null
     from public.demo where storage_key = 'demos/4-9/anom.dem'),
  'C2: the demo is now validation_state=pending with validated_at set (the hold is cleared)');

-- C3: exactly ONE event-global accept_anomaly audit row for this demo (tournament_id + target_match_id NULL).
select is(
  (select count(*)::int from public.audit_log
     where action = 'accept_anomaly'
       and (detail->>'demo_id')::bigint = pg_temp.did('demos/4-9/anom.dem')
       and tournament_id is null and target_match_id is null),
  1,
  'C3: exactly ONE event-global accept_anomaly audit row (tournament_id + target_match_id NULL)');

-- C4: that row's before/after describe the real transition + carry the demo_id and the anomaly_reasons.
select ok(
  (select detail->'before'->>'validation_state' = 'anomalous'
      and detail->'after'->>'validation_state' = 'pending'
      and (detail->>'demo_id')::bigint = pg_temp.did('demos/4-9/anom.dem')
      and detail->'anomaly_reasons' is not null
     from public.audit_log
    where action = 'accept_anomaly'
      and (detail->>'demo_id')::bigint = pg_temp.did('demos/4-9/anom.dem')),
  'C4: the accept_anomaly audit detail has real before/after (anomalous->pending) + demo_id + anomaly_reasons');

-- C5: a SECOND accept of the now-pending demo -> not_anomalous (idempotency: nothing more to accept).
select is(
  (public.accept_anomaly(pg_temp.did('demos/4-9/anom.dem'), pg_temp.admin())->>'reason'),
  'not_anomalous',
  'C5: a second accept_anomaly on the now-pending demo -> not_anomalous (idempotent)');

-- C6: and it wrote NO phantom second row — still exactly one.
select is(
  (select count(*)::int from public.audit_log
     where action = 'accept_anomaly'
       and (detail->>'demo_id')::bigint = pg_temp.did('demos/4-9/anom.dem')),
  1,
  'C6: the refused second accept wrote NO second audit row (append-only stays honest)');

-- C7: a non-existent demo -> bad_demo (guarded before any write).
select is(
  (public.accept_anomaly(999999999, pg_temp.admin())->>'reason'),
  'bad_demo',
  'C7: accept_anomaly on a non-existent demo -> bad_demo');

select finish();
rollback;
