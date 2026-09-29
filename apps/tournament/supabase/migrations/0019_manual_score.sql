-- supabase/migrations/0019_manual_score.sql
-- Logical migration 0019 — the manual score override (Story 4.8, AC1/AC2). The MANUAL half of FR-16.
--
-- ONE migration because it is ONE concern: the single admin act that publishes a HAND-ENTERED result — a
-- demo-less match resolved from two typed-in numbers, OR an audited override of a demo whose score is wrong —
-- in ONE transaction (AD-6). This is the manual sibling of 4.6b's Aprobar: 3.7/4.6a-b shipped the demo-derived
-- side of FR-16; this ships the admin-entered, audited side.
--
-- ⭐ THE PICTURE. `manual_resolve_match` is `approve_match` (0017:235-454) with the score TYPED IN by an admin
-- instead of read off a demo, landing `manual_resolved` instead of `resolved`. It serves TWO AD-5 shapes, keyed
-- by the state↔demo_id correlation (DECISION A):
--   * a NO-DEMO match (`demo_id IS NULL`, sitting in `declared`/`live`) -> a PLAIN manual score
--     (`manual_override=false`); AD-5's `(demo_id IS NULL)` disjunct — nothing to contradict.
--   * a DEMO-BOUND match (`demo_id IS NOT NULL`, sitting in `pending` — the state bind_match_demo always
--     produces, incl. after a 4.7 rollback) -> an AUDITED OVERRIDE (`p_override=true`, `manual_override=true`)
--     that DISCARDS the demo's score; AD-5's `(manual_override=true AND a matching audit_log row exists)`
--     disjunct — the FR-16 dispute-correction.
-- In one whole-bracket-locked transaction it guards everything BEFORE the first write (the AD-5 rule, the format
-- lock, a tie, an undetermined seat), writes the audit row FIRST (the PRECONDITION for the override gate, exactly
-- as declare_match_format writes its row before the format UPDATE), writes the score + `state='manual_resolved'`,
-- folds in `advance_match(..., false)` honouring `{ok:false}` with a distinct RAISE (IC906), posts ONE
-- `match_result` `timeline_feed` entry, and emits ONE Broadcast post-commit.
--
-- ⭐⭐ THE ONE GENUINELY NEW MECHANISM: `match_manual_override_audited` — `match_format_audited` (0012:191-239)
-- REBORN for the SCORE. `score_source_guard` (0010:124-128, tightened 0017:155-169) already enforces AD-5's
-- `manual_override=true` half for a demo-bound `admin_manual` score — but it says NOTHING about the audit row.
-- A raw `service_role` UPDATE (`score_source='admin_manual', manual_override=true`, NO audit row) passes
-- score_source_guard TODAY. That is the exact silent-override hole AD-5 (SPINE:100-103) + FR-16/FR-10 (*"logged
-- and flagged"*, prd.md:273,216) exist to close, and it is the SAME hole match_format_audited closes for the
-- format. So the new constraint trigger requires: when a match GAINS an `admin_manual` override, a `manual_score`
-- audit_log row written by THIS transaction, DESCRIBING THIS EXACT RESULT, must already exist — for every writer,
-- `service_role` and `postgres` included. RAISE IC907 if absent.
--
-- WHAT IT BUILDS:
--   (a) DECISION C — `match_manual_override_audited` (a constraint trigger) + `match_manual_override_audit_guard()`:
--       AD-5's "matching audit_log row" clause enforced STRUCTURALLY (not by RPC discipline). ~40 lines.
--   (b) DECISION B — `manual_resolve_match(match, score_a, score_b, actor, override)`: the manual sibling of
--       approve_match, as a REUSABLE `security invoker` RPC (AD-3 needs it composable inside a larger txn), plus
--       its service-role-only EXECUTE grant.
-- NO new table, NO new column — `score_source`/`manual_override` have existed since 0010 (0010:66-69).
--
-- SQLSTATEs (the 4.5/4.6a/4.6b/4.7 convention — NEVER a bare P0001, deferred-work.md: P0001 is PL/pgSQL's GENERIC
-- exception owned by lib/match/format.ts):
--   * IC906 — manual_resolve_match's advance-refused rollback (advance_match returned {ok:false}). ⭐ NEW, this
--     story. Mirrors approve_match's IC903: a scored-but-unadvanced match must never commit. -> `advance_refused`.
--   * IC907 — match_manual_override_audited: an `admin_manual` override with NO matching manual_score audit row.
--     ⭐ NEW, this story (DECISION C). Genuine silent-override attempt; SHOULD never surface via the RPC (it
--     writes the row) -> lib maps it to `override_not_audited`/500 as the honest report if it ever does.
--   * 23514 — score_source_guard / match_live_requires_locked_format (a check_violation). Not raised here; the
--     RPC's guards return first. The RPC writes rows that satisfy both CHECKs by construction.
--   ⚠ NOT raised/owned here: P0001 (format.ts), IC901/IC902 (walkover.ts), IC903/IC904 (approve.ts), IC905
--     (rollback.ts). lib/match/manual-score.ts must NOT map those — mapping them would hijack another lib.
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * NO manual-resolution ROLLBACK / undo (DECISION H). rollback_match (4.7) refuses `manual_resolved` with
--     `not_resolved` (0018:144-147), deliberately leaving the inverse to a future slice — widen rollback_match
--     or add a sibling RPC (most naturally 4.9). Logged in deferred-work.md. A mis-entered manual score has NO
--     undo path today; refusing is still correct.
--   * NO `stat_row` write / NO leaderboard anything (DECISION E; Story 5.5 owns the view). A no-demo match has
--     zero stat rows; an override deliberately does NOT publish the demo's rows (they contradict the manual
--     score). The `match` row IS the published result. The Story-5.5 view (status='approved' rows) correctly
--     sees no stats for a manual match.
--   * NO feed READ surface / UI / i18n (Epic 5 / Story 5.6). The admin's manual-entry FORM is Epic 5's console.
--   * NO `declared -> live` transition (still unowned -> Epic-5 console). We accept `declared`/`live`/`pending`
--     as SOURCE states (DECISION A); we never CREATE `live`.
--   * NO changes to approve_match / rollback_match / advance_match / bind_match_demo / mark_walkover — mirror
--     them, never rewrite them. NO shared command-route helper (4.9). NO CSRF (Epic 7).
--   * NO ceremony-lock gate. ⚠ AD-15 (SPINE:153): a manual resolution after ceremony-lock is the same class of
--     concern as an approve/rollback after it. `ceremony` does not exist until Epic 6 — Story 6.2 must add a
--     `ceremony_locked` guard to manual_resolve_match too (alongside approve_match/rollback_match). Seam flagged
--     in deferred-work.md, NOT built.
--   * `audit_log.action = 'manual_score'` extends the uncapped `action` vocabulary (0003:25, no CHECK) with NO
--     migration (the bind_demo/begin_grace precedent, 0016:83-86). 0003 is UNTOUCHED (never edit an applied
--     migration).

-- ════════════════════════════════════════════════════════════════════════════
-- (a) DECISION C — match_manual_override_audited: no admin_manual OVERRIDE without its audit row.
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE MECHANISM, IN ONE SENTENCE: a match cannot GAIN an `admin_manual` override (score_source='admin_manual'
-- AND manual_override=true) unless a `manual_score` audit_log row for THAT match, written by THIS transaction,
-- ALREADY DESCRIBES the resulting score. `manual_resolve_match` satisfies it by writing the audit row first;
-- nothing else in the codebase can satisfy it by accident. This is match_format_audited (0012:191-239) rebuilt
-- for the score — same shape, same reasoning, same teeth.
--
-- WHY `occurred_at = transaction_timestamp()` AND NOT `xmin = pg_current_xact_id()`. Copied verbatim from
-- 0012:166-173: a plpgsql caller with an EXCEPTION block runs its body in a SUBtransaction, so the audit row's
-- `xmin` would be the SUBtransaction's xid while `pg_current_xact_id()` returns the TOP-level xid — the check
-- would falsely REJECT a legal call. A future re-parse-republish will call this RPC inside a larger transaction,
-- so that is not hypothetical. `transaction_timestamp()` (= `now()`) is fixed at transaction start and IDENTICAL
-- across every subtransaction of it, and is exactly what `audit_log.occurred_at` defaults to (0003:28). It cannot
-- match a row from any EARLIER transaction, which is the reuse this must prevent.
--
-- WHY THE `after` PAYLOAD IS MATCHED, NOT JUST THE ROW'S EXISTENCE (0012:175-190). An audit row authorizes
-- exactly the ONE change it describes — not an open window for the rest of the transaction. Matching the score
-- (score_a/score_b/winner_entry/score_source) plus `override=true` is one half of closing the "set once, edit
-- many" weakness: a mismatched `after` (e.g. a wrong score_a) fails the gate. The OTHER half is the trigger's
-- WHEN clause re-firing on a LATER edit of an already-overridden row (disjunct (B) below) — without it the gate
-- would be a one-shot at the override transition, and a raw score rewrite afterwards would never be re-checked.
-- The pgTAP mutation matrix (Section G) pins each `after` key AND the later-edit refusal, which is what keeps a
-- future typo in `jsonb_build_object` — or a dropped WHEN disjunct — from quietly unlocking this gate.
create function public.match_manual_override_audit_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.audit_log a
     where a.target_match_id = new.id
       and a.action          = 'manual_score'
       and a.occurred_at     = transaction_timestamp()
       and  a.detail -> 'after' ->> 'score_source'            is not distinct from new.score_source
       and (a.detail -> 'after' ->> 'score_a')::int           is not distinct from new.score_a
       and (a.detail -> 'after' ->> 'score_b')::int           is not distinct from new.score_b
       and (a.detail -> 'after' ->> 'winner_entry')::bigint   is not distinct from new.winner_entry
       and (a.detail            ->> 'override')::boolean       = true
  ) then
    raise exception
      'match %: an admin_manual override requires a manual_score audit_log row, written by THIS transaction, describing THIS result (AD-5) — the audit row is the PRECONDITION, not the receipt', new.id
      using errcode = 'IC907',
            hint = 'Use manual_resolve_match(...). It writes the audit row before the update, in one transaction. There is no unaudited override path — not for service_role, not for postgres.';
  end if;
  return null;   -- AFTER trigger: the return value is ignored
end;
$$;

-- Fires when a match GAINS an admin_manual override (manual_override flips false -> true alongside score_source
-- -> admin_manual — disjunct (A)), AND on any LATER edit that rewrites the score/winner of an ALREADY-overridden
-- row (disjunct (B)). The (B) disjunct is what makes the audit-row requirement hold for EVERY edit of the scored
-- result, not just the one-shot transition — closing "set once, edit many" exactly as match_format_audited does
-- for a later format edit of a locked row (0012:232). A properly-audited re-resolve still passes: it writes its
-- matching audit row first, so the guard's EXISTS finds it. ⚠ The `demo_id IS NULL` PLAIN-manual case does NOT
-- set manual_override=true, so the trigger does NOT fire for it — CORRECT: there is no demo to disagree with, so
-- AD-5 attaches the audit-row requirement only to the manual_override=true branch. The plain row is still logged
-- by the RPC, just not trigger-gated.
--
-- ⚠⚠ `after update` ONLY, exactly like match_format_audited (0012:220-246, deliberately INSERT-unguarded). The
-- 0010/0012 raw-INSERT fixtures that set manual_override=true AT INSERT TIME (0010_match_test.sql:303-311) must
-- NOT trip this — and they do not, because they are INSERTs and this trigger is UPDATE-only. Do NOT gate INSERT:
-- generate_bracket creates every match with score_source NULL, and a row born with an override is a fixture, not
-- a reachable app path.
--
-- `is distinct from` on both columns (0012:228-233): both are nullable, and `new.x <> old.x` evaluates to NULL —
-- not true — whenever either side is NULL, so a NULL-side transition would slip straight through a bare `<>`.
create constraint trigger match_manual_override_audited
  after update on public.match
  deferrable initially immediate
  for each row
  when (
    new.score_source = 'admin_manual'
    and new.manual_override = true
    and (
      -- (A) the row GAINS the override — false -> true, or score_source flips to admin_manual.
      old.score_source   is distinct from new.score_source
      or old.manual_override is distinct from new.manual_override
      -- (B) a LATER edit REWRITES the scored result of an ALREADY-overridden row. Without this the gate is
      --     "set once, edit many": a raw `update match set score_a=99` that leaves score_source+manual_override
      --     untouched slips through un-audited (match_terminal_state_guard only blocks state flips, not a
      --     score-only edit that keeps state='manual_resolved'). This is the second disjunct match_format_audited
      --     carries for a later format edit of a locked row (0012:232).
      or (old.manual_override
          and (new.score_a      is distinct from old.score_a
            or new.score_b      is distinct from old.score_b
            or new.winner_entry is distinct from old.winner_entry))
    )
  )
  execute function public.match_manual_override_audit_guard();

-- No REVOKE: a `returns trigger` function cannot be invoked as a normal call (Postgres refuses: "trigger
-- functions can only be called as triggers") and PostgREST does not expose it, so PUBLIC's default EXECUTE is
-- not a reachable surface. Same posture as match_format_audit_guard (0012:248-251).

-- ════════════════════════════════════════════════════════════════════════════
-- (b) DECISION B — manual_resolve_match: the manual sibling of the §8 Aprobar, as a reusable RPC.
-- ════════════════════════════════════════════════════════════════════════════
-- A reusable RPC (NOT route-local logic) because it takes the whole-bracket lock and CALLS advance_match, so it
-- must be composable inside a larger transaction and callable in canonical lock order — exactly as approve_match
-- and rollback_match are (DECISION B; the 4.6b/4.7 hard constraint).
--
-- ⚠⚠ LOCK ORDER (byte-identical to approve_match 0017:265-271, rollback_match 0018:128-133, advance_match
-- 0014:392-400). This WRITES the match row and THEN calls advance_match, which locks the WHOLE bracket in
-- canonical id order. Writing the match first would lock it OUT of that order and could deadlock a concurrent
-- advance (the 4.3 40P01). Take the SAME ordered whole-bracket lock UP FRONT, before the first write.
--
-- ⚠ ORDERING IS LOAD-BEARING: flip state='manual_resolved' + winner_entry BEFORE advancing (advance_match's
-- result gate refuses non-result states BY NAME but ACCEPTS `manual_resolved`, 0014:417 + requires winner_entry,
-- 0014:423); the audit row is written BEFORE the match UPDATE (DECISION C's gate is the PRECONDITION);
-- score_source_guard needs score_a + score_b + score_source (+ manual_override in the override case) written
-- TOGETHER (0017:155-169); ONE emit, after commit, by construction (advance with p_emit=>false, then one
-- realtime.send here).
create function public.manual_resolve_match(
  p_match_id        bigint,
  p_score_a         int,
  p_score_b         int,
  p_actor_steamid64 text,
  p_override        boolean
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tid       bigint;
  v_m         record;
  v_winner    bigint;
  v_loser     bigint;
  v_is_over   boolean;    -- TRUE iff this is an audited override of a bound demo (demo_id IS NOT NULL)
  v_sha       text;
  v_adv       jsonb;
  v_before    jsonb;
  v_detail    jsonb;
begin
  -- ══ 1. WHICH BRACKET? An UNLOCKED peek — it must not lock, because the next statement takes every lock in
  --    canonical order and a lock ahead of it would be OUT of order (the 4.3 deadlock). `match` has NO DELETE
  --    grant (0010:227), so the row cannot vanish between this read and the lock.
  select m.tournament_id into v_tid from public.match m where m.id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 1b. EVERY LOCK, IN ONE STATEMENT, IN CANONICAL (id) ORDER — mirrors approve_match / rollback_match.
  perform 1
     from public.match m
    where m.tournament_id = v_tid
    order by m.id
      for update;

  -- ══ 1c. NOW read the source under the lock; its state cannot move under us.
  select m.id, m.tournament_id, m.state, m.demo_id, m.competitor_a, m.competitor_b,
         m.score_source, m.format_locked, m.bracket_position, m.score_a, m.score_b, m.winner_entry
    into v_m
    from public.match m
   where m.id = p_match_id;

  -- ══ 2. GUARDS — all of them before any write (the 0012/0017 convention), typed refusals RETURNED.

  -- not_manual_resolvable — the two AD-5 source shapes (DECISION A): `declared`/`live` are the no-demo shape;
  -- `pending` is the demo-bound override shape. Everything else is refused — which is what makes AC2 true (a
  -- manual score can never coexist with a committed resolved/forfeit/bye/manual_resolved/rolled_back result;
  -- correcting an already-`resolved` match is 4.7 rollback -> `pending` -> override).
  if v_m.state not in ('declared', 'live', 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'not_manual_resolvable', 'state', v_m.state);
  end if;

  -- undetermined — an unseated bracket node has no winner to derive (match_winner_is_competitor 0010:94-98
  -- would reject a winner that is not one of the two seats anyway).
  if v_m.competitor_a is null or v_m.competitor_b is null then
    return jsonb_build_object('ok', false, 'reason', 'undetermined');
  end if;

  -- format_not_declared — match_live_requires_locked_format (0012:123-126) forces format_locked for
  -- `manual_resolved`, so a manual resolution on an unlocked match trips 23514. Guard it EXPLICITLY (the CHECK
  -- is the backstop, the typed refusal is the UX) exactly as bind_match_demo does (0016:216-218). Never fires
  -- on a `pending` match — `pending` already required a lock.
  if not v_m.format_locked then
    return jsonb_build_object('ok', false, 'reason', 'format_not_declared');
  end if;

  -- bad_score — a hand-entered tally that is NULL or negative. The route validates too; the RPC is the authority.
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_score');
  end if;

  -- tied — a draw has no winner_entry and cannot advance a double-elim bracket (mirror approve_match's
  -- DECISION K, 0017:337-342). Refuse loudly rather than crown arbitrarily.
  if p_score_a = p_score_b then
    return jsonb_build_object('ok', false, 'reason', 'tied', 'score_a', p_score_a, 'score_b', p_score_b);
  end if;

  -- ⭐ THE AD-5 RULE (DECISION C), branching on demo_id. The state↔demo_id correlation holds exactly:
  -- declared/live ⟺ demo_id IS NULL; pending ⟺ demo_id IS NOT NULL (incl. a rolled-back match whose demo stays
  -- bound). So:
  --   * demo_id IS NOT NULL and NOT p_override -> override_required: a demo is bound; discarding its
  --     demo-derived (pending) score demands the explicit audited-override flag (the FR-16 dispute-correction).
  --   * demo_id IS NULL and p_override -> nothing_to_override: a mis-set override flag on a no-demo match
  --     surfaces an admin mistake (surgical, like declare_match_format's override_needs_ids).
  if v_m.demo_id is not null and not coalesce(p_override, false) then
    return jsonb_build_object('ok', false, 'reason', 'override_required');
  end if;
  if v_m.demo_id is null and coalesce(p_override, false) then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_override');
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- The two clean cases, keyed by demo_id: demo bound => audited override (manual_override=true, trigger-gated);
  -- no demo => plain manual (manual_override=false, not gated). After the guards, v_is_over ≡ p_override.
  v_is_over := (v_m.demo_id is not null);

  v_winner := case when p_score_a > p_score_b then v_m.competitor_a else v_m.competitor_b end;
  v_loser  := case when v_winner = v_m.competitor_a then v_m.competitor_b else v_m.competitor_a end;
  v_before := jsonb_build_object(
    'state', v_m.state, 'score_source', v_m.score_source,
    'score_a', v_m.score_a, 'score_b', v_m.score_b, 'winner_entry', v_m.winner_entry
  );

  -- ══ 3. THE AUDIT ROW — WRITTEN FIRST, BECAUSE IT IS THE PRECONDITION FOR THE OVERRIDE GATE, NOT THE RECEIPT
  --    (DECISION C — mirror declare_match_format 0012:430-453). match_manual_override_audited (above) refuses
  --    the step-4 UPDATE for an override that does not already have this row from THIS transaction. `action=
  --    'manual_score'` extends the uncapped vocabulary with no migration. The `after` payload is exactly what
  --    step 4 writes; `override` is matched by the gate. Always written — the PLAIN case is logged too (FR-16
  --    "logged"), it is simply not trigger-gated (manual_override stays false).
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'manual_score',
    p_match_id,
    jsonb_build_object(
      'before',   v_before,
      'after',    jsonb_build_object(
                    'state', 'manual_resolved', 'score_source', 'admin_manual',
                    'score_a', p_score_a, 'score_b', p_score_b, 'winner_entry', v_winner,
                    'manual_override', v_is_over
                  ),
      'override', v_is_over
    )
  );

  -- ══ 4. THE MATCH WRITE — score + provenance + state, in ONE UPDATE (score_source_guard needs all three score
  --    columns + the flag together, 0017:155-169). score_source='admin_manual' (AD-5); manual_override=true IFF
  --    overriding a bound demo; winner_entry = the higher-score seat; state='manual_resolved'. ⚠ demo_id is
  --    UNTOUCHED — a demo, if present, stays bound as evidence (AD-1).
  update public.match
     set score_a         = p_score_a,
         score_b         = p_score_b,
         score_source    = 'admin_manual',
         manual_override = v_is_over,
         winner_entry    = v_winner,
         state           = 'manual_resolved'
   where id = p_match_id;

  -- ══ 5. FOLD IN THE ADVANCE, into our single emit. p_emit => false (AD-11): the advance does NOT emit its own
  --    bracket.advanced; manual_resolve_match emits ONE match.manual_resolved below.
  v_adv := public.advance_match(p_match_id, p_actor_steamid64, false);

  -- ⭐⭐ HONOR {ok:false} — advance_match RETURNS a typed refusal (e.g. slot_taken) rather than raising; if we
  -- committed anyway the result is a manual_resolved, scored match with no advance — the exact partial state the
  -- two-pass design exists to prevent. RAISE (distinct IC906) to roll the WHOLE manual resolution back. Do NOT
  -- change advance_match to raise — it returns by contract (mirror approve_match's IC903, 0017:381-386).
  if not coalesce((v_adv->>'ok')::boolean, false) then
    raise exception
      'manual_resolve_match: advance refused (%) — the whole resolution is rolled back so a scored, manual_resolved match never commits without its advance (AD-6/AD-8)', coalesce(v_adv->>'reason', 'unknown')
      using errcode = 'IC906',
            hint = 'The winner''s destination seat is held by a different player. Un-routing it is Story 4.7 (rollback); until then the manual resolution cannot commit.';
  end if;

  -- ══ 6. ONE timeline_feed entry (DECISION D — the enum already carries `match_result` from 4.6b; a manual
  --    resolution IS a match result, so match_result fits exactly). detail carries the render fields; demo_sha256
  --    only when a demo is bound (an override). ⚠ NO leaderboard refresh (DECISION E — a manual match publishes
  --    no stats; the `match` row IS the result).
  v_detail := jsonb_build_object(
    'winner_entry',     v_winner,
    'loser_entry',      v_loser,
    'score_a',          p_score_a,
    'score_b',          p_score_b,
    'bracket_position', v_m.bracket_position,
    'score_source',     'admin_manual',
    'manual_override',  v_is_over
  );
  if v_m.demo_id is not null then
    select d.demo_sha256 into v_sha from public.demo d where d.id = v_m.demo_id;
    v_detail := v_detail || jsonb_build_object('demo_sha256', v_sha);
  end if;

  insert into public.timeline_feed (tournament_id, entry_type, target_match_id, detail)
  values (v_m.tournament_id, 'match_result', p_match_id, v_detail);

  -- ══ 7. ⭐ THE SINGLE EMIT, POST-COMMIT BY CONSTRUCTION (AD-11). realtime.send INSERTS into realtime.messages
  --    inside THIS transaction; Realtime ships it off the replication slot only on commit — so the emit cannot
  --    outrun its own commit (0017:424-442 shape). SPINE:230's vocabulary lists match.approved/bracket.advanced/
  --    spin.reveal but NO manual event, so `match.manual_resolved` is MINTED here (DECISION F — the posture 4.7
  --    took for match.rolled_back). The payload carries the new state + score + advance so a viewer re-fetches
  --    corrected truth. Public channel tournament:<id>.
  perform realtime.send(
    jsonb_build_object(
      'tournament_id',   v_m.tournament_id,
      'match_id',        p_match_id,
      'state',           'manual_resolved',
      'winner_entry',    v_winner,
      'loser_entry',     v_loser,
      'score_a',         p_score_a,
      'score_b',         p_score_b,
      'manual_override', v_is_over,
      'advanced',        v_adv->'advanced',
      'champion',        v_adv->'champion'
    ),
    'match.manual_resolved',
    'tournament:' || v_m.tournament_id::text,
    false
  );

  return jsonb_build_object(
    'ok',           true,
    'state',        'manual_resolved',
    'score_a',      p_score_a,
    'score_b',      p_score_b,
    'winner_entry', v_winner,
    'override',     v_is_over,
    'advanced',     v_adv->'advanced',
    'champion',     v_adv->'champion'
  );
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE it would be callable straight off the Data API. It is SECURITY INVOKER (a viewer would 42501 at
-- the first write anyway), but a defence that depends on a later grant check is not a defence: revoke first,
-- then grant to the single writer. The route's requireAdmin is the authorization gate; this is the second lock
-- on the same door (0017:456-463).
revoke execute on function public.manual_resolve_match(bigint, int, int, text, boolean) from public;
grant  execute on function public.manual_resolve_match(bigint, int, int, text, boolean) to service_role;
