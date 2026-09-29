-- supabase/migrations/0018_rollback_match.sql
-- Logical migration 0018 — the atomic rollback of an Approved match (Story 4.7, AC1/AC2/AC3).
--
-- ONE migration because it is ONE concern: the single admin act that UNPUBLISHES a demo-derived Approved
-- match — reverting its dependent bracket advances first, in ONE transaction (AD-6 inverted). This is the
-- rollback side of FR-14 (the re-parse side is Story 3.6, already shipped).
--
-- ⭐ THE PICTURE. `rollback_match` is `approve_match` (0017:235-454) run BACKWARDS. approve took a `pending`,
-- demo-bound match and, atomically: (1) flipped its stat rows to `approved`; (2) wrote the demo-derived score
-- + `state='resolved'`; (3) called `advance_match` (seated the winner downstream, dropped the loser to Losers,
-- walked any bye cascade); (4) posted a `timeline_feed` entry; (5) wrote an `approve` audit row; (6) emitted
-- one `match.approved`. This undoes each, in REVERSE — but step (3) does not reverse by symmetry. When approve
-- seated M's winner into a downstream slot, that slot may since have been filled from the other side and
-- PLAYED and Approved on its own demo. AD-8 (SPINE:115-118) forbids un-publishing THAT match as a side effect:
-- *"reverts dependent advances transitively before unpublishing, AND flags — never auto-reverts — a downstream
-- match already approved on its own demo."* Its Prevents names the hazard verbatim: *"a rollback silently
-- un-publishing unrelated matches."* So the reverse cascade is a two-pass, READ-ONLY-then-APPLY walk — mirroring
-- `advance_match`'s worklist so the routing lives in ONE place (D1) — whose planning pass, if it meets ANY
-- downstream seat that is beyond purely-structural, RETURNS `{ok:false, reason:'downstream_active'}` having
-- written nothing. Only when every dependent seat is still `declared`/`bye`/`void` do we un-seat them, then
-- unpublish M back to `pending`.
--
-- WHAT IT BUILDS:
--   (d) DECISION B — `rollback_match(match, actor)`: the inverse of the §8 Aprobar, as a REUSABLE RPC (AD-3
--       needs the re-parse-republish, 3.6/future, to run revert->reparse->republish as ONE transaction that
--       CALLS this), not route-local logic. Plus its service-role grant. NO new table, NO new column, NO new
--       trigger (contrast 4.6b, which had to create timeline_feed) — one function + one grant.
--
-- ⭐ DECISION A — THE HEADLINE: the rolled-back match returns to `state='pending'`, NOT `state='rolled_back'`.
-- The codebase contradicts itself: 0010:222-224 + 0012:118-122 say a rolled-back match becomes
-- `state='rolled_back'` (and the value is in the closed set, 0010:65, with advance_match handling it, 0014:416)
-- — BUT the authoritative match+ingest lifecycles (SPINE:294,312: `Resolved --> Pending: rollback`), FR-14
-- (prd:255 *"returning it to Pending or unparsed"*), and the actual shipped code all pin `pending`: 0016:37,
-- 0017:181, and decisively 0017_aprobar_publish_test.sql:418-422 which asserts `resolved -> pending` LIVES
-- under the label *"proves Story 4.7's rollback is NOT blocked."* We are the caller that finally rides that
-- allowance. Landing `pending` makes the match cleanly RE-APPROVABLE (the demo stays bound — the FR-14
-- dispute-correction flow, EXPERIENCE:223) and closes the deferred-work.md:21 re-bind item for free (a
-- rolled-back match is indistinguishable from a fresh `pending` one, which 4.6a already handles). `rolled_back`
-- is left reserved as superseded intent; the two stale comments (0010:222-224, 0012:118-122) are not edited
-- here (never edit an applied migration) — they are reconciled in Completion Notes.
--
-- SQLSTATEs (the 4.5/4.6a/4.6b convention — NEVER a bare P0001, deferred-work.md: P0001 is PL/pgSQL's GENERIC
-- exception owned by lib/match/format.ts):
--   * IC905 — rollback_match's OWN raises: the hop-cap cycle (a routing cycle generation cannot produce) and
--     the pass-2 lock-invariant violation (a row moved under the canonical lock). ⭐ NEW, this story. Genuine
--     corruption, mapped to write_failed/500 — NOT a typed refusal (mirrors advance's P0001 posture,
--     deferred-work.md:41).
--   * IC901/IC902 (4.5's), IC903/IC904 (4.6b's) are NOT raised here and NOT mapped by lib/match/rollback.ts.
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * NO re-parse (Story 3.6 — the ingest side of FR-14, already shipped). Rollback is UN-PUBLISH ONLY; it
--     never re-derives rows from the demo, and it does NOT touch demo/demo_sha256/storage_key (AD-1: rollback
--     touches only DERIVED rows). The demo stays bound (re-approvable).
--   * NO manual_resolved rollback (Story 4.8 owns the manual writer AND its inverse — DECISION C). 4.7 refuses
--     manual_resolved with `not_resolved`.
--   * NO timeline_feed write (DECISION D). timeline_feed.entry_type is ('match_result','bracket_advance',
--     'award_reveal') — none fits a rollback — and no reader exists (5.6). The rollback is LOGGED via the AD-17
--     audit row (action='rollback'), which IS FR-14's "logged" requirement. The correcting feed entry is
--     deferred to the uniform feed-writer that 4.6b DECISION D also deferred bracket_advance to.
--   * NO leaderboard anything (DECISION E; Story 5.5 owns the view). The leaderboard is one view over
--     status='approved' rows (SPINE:178) — flipping the stat rows back to `pending` IS the removal (FR-14's
--     "removes its contribution from leaderboards"). REFRESH MATERIALIZED VIEW in-txn would violate AD-6.
--   * NO demo un-bind — the demo stays bound so the match is re-approvable. Re-pointing a bound demo to a
--     DIFFERENT demo is a separate audited action, not rollback.
--   * NO changes to advance_match / approve_match / mark_walkover / bind_match_demo — invert their EFFECTS,
--     never rewrite them. NO shared command-route helper (4.9). NO CSRF (Epic 7).
--   * NO ceremony-lock gate. ⚠ AD-15 (SPINE:153) wants the ceremony lock to block approves/re-parses; a
--     rollback after ceremony-lock is the same class of concern, but `ceremony` does not exist until Epic 6 —
--     Story 6.2 must add a `ceremony_locked` guard to rollback_match (a typed refusal before the first write),
--     exactly as it must for approve_match (deferred-work.md:9). Seam flagged, NOT built.
--   * `audit_log.action = 'rollback'` is already the enumerated vocabulary (0003:25, uncapped text, no CHECK;
--     SOLUTION-DESIGN:251; AD-17 SPINE:163) — NO migration, and 0003 is UNTOUCHED (never edit an applied
--     migration).

-- ════════════════════════════════════════════════════════════════════════════
-- (d) DECISION B — rollback_match: the inverse of the §8 Aprobar, as a reusable RPC.
-- ════════════════════════════════════════════════════════════════════════════
-- The whole un-publish, in ONE transaction (AD-6), as an RPC (NOT route-local logic) because AD-3 (SPINE:93)
-- needs the entire revert->reparse->republish to run as a single transaction that CALLS this — Story 3.6/4.7's
-- re-parse-republish would be unimplementable if the revert lived in TypeScript. It must also be callable from
-- inside another transaction, exactly as advance_match is from mark_walkover / approve_match.
--
-- ⚠⚠ LOCK ORDER (byte-identical to approve_match 0017:265-271 and advance_match 0014:396-400). The reverse
-- cascade reads and writes many rows of the bracket; take EVERY lock in canonical id order UP FRONT, before the
-- first write, or reproduce the 4.3 40P01 deadlock.
--
-- ⚠ ORDERING IS LOAD-BEARING (AC1 "dependent advances are reverted transitively BEFORE unpublishing"): PLAN the
-- whole revert read-only (pass 1) and detect the AD-8 flag; if it fires, RETURN having written nothing. Only
-- after pass 1 proves the revert clean do you (pass 2) un-seat the dependent advances, THEN unpublish M
-- (score/state -> pending), THEN un-approve its stat rows, THEN clear final_match_id if it was the deciding
-- row; then the audit row; then ONE emit, post-commit by construction.
create function public.rollback_match(
  p_match_id        bigint,
  p_actor_steamid64 text
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tid        bigint;
  v_m          record;
  v_winner     bigint;
  v_loser      bigint;
  v_src        record;
  v_dest       record;
  v_edge       record;
  v_task       jsonb;
  v_todo       jsonb := '[]'::jsonb;   -- worklist of nodes to revert FROM: [{src, winner, loser}]
  v_plan       jsonb := '[]'::jsonb;   -- validated un-seats: [{match_id, side, entry, walkover}]
  v_blocking   jsonb := '[]'::jsonb;   -- the AD-8 flag: downstream seats that stand on their own state
  v_occ        bigint;
  v_is_walk    boolean;
  v_iter       int := 0;
  v_unseat     int;
  v_unpub      int;
  v_uncrowned  int;
  v_before     jsonb;
begin
  -- ══ 1. WHICH BRACKET? An UNLOCKED peek — it must not lock, because the next statement takes every lock in
  --    canonical order and a lock ahead of it would be OUT of order (the 4.3 deadlock). `match` has NO DELETE
  --    grant (0010:227), so the row cannot vanish between this read and the lock.
  select m.tournament_id into v_tid from public.match m where m.id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 1b. EVERY LOCK, IN ONE STATEMENT, IN CANONICAL (id) ORDER — mirrors approve_match / advance_match.
  perform 1
     from public.match m
    where m.tournament_id = v_tid
    order by m.id
      for update;

  -- ══ 1c. NOW read the source under the lock; its state cannot move under us.
  select m.id, m.tournament_id, m.state, m.winner_entry, m.competitor_a, m.competitor_b,
         m.demo_id, m.score_a, m.score_b, m.score_source
    into v_m
    from public.match m
   where m.id = p_match_id;

  -- ══ 2. GUARDS — all before any write (the 0012/0017 convention), typed refusals RETURNED.

  -- not_resolved — only a demo-derived Approved match is rollback-able here. `manual_resolved` is Story 4.8's
  -- to invert (DECISION C); pending/declared/bye/forfeit/void have nothing to unpublish. ⚠ THIS IS ALSO AC2's
  -- IDEMPOTENCY: a SECOND rollback of a now-`pending` match returns not_resolved having written nothing —
  -- re-applying is a clean no-op (DECISION E). (A distinct manual_resolved guard is folded in here: the state
  -- is simply not 'resolved'.)
  if v_m.state <> 'resolved' then
    return jsonb_build_object('ok', false, 'reason', 'not_resolved', 'state', v_m.state);
  end if;

  -- A `resolved` match with NO winner is not a rollback-able result — mirror advance_match:423-425. Without
  -- this, a null winner would derive a BOGUS loser below (v_loser := competitor_a) and half-revert the loser
  -- drop while skipping the (null-entry) winner edge. Unreachable today (approve always writes a winner;
  -- DECISION K refuses ties), guarded defensively exactly as the sibling advance path does. (code review 2026-07-19)
  if v_m.winner_entry is null then
    return jsonb_build_object('ok', false, 'reason', 'not_resolved', 'state', v_m.state);
  end if;

  -- Recompute M's winner + loser — NOT stored columns, exactly as advance_match derives them (0014:430).
  -- match_winner_is_competitor (0010:94-98) guarantees the winner really is one of the two seats.
  v_winner := v_m.winner_entry;
  v_loser  := case when v_m.competitor_a = v_winner then v_m.competitor_b else v_m.competitor_a end;

  v_todo := jsonb_build_array(
    jsonb_build_object('src', v_m.id, 'winner', v_winner, 'loser', v_loser)
  );

  -- ══ 3. PASS 1 — PLAN THE REVERT, READ-ONLY (mirror advance_match:447-573). Recompute M's advance edges and
  --    follow them through match_slot_uniq exactly as advance_match seated them; classify each destination seat
  --    that still holds OUR entry. A refusal here has written NOTHING. An explicit bounded worklist, never open
  --    recursion — the cap turns a routing cycle into a loud failure instead of a hang.
  while jsonb_array_length(v_todo) > 0 loop
    v_iter := v_iter + 1;
    if v_iter > 32 then
      -- Generous by an order of magnitude (advance_match:452-458): a 16-bracket's longest walkover chain is
      -- under 10 hops. Getting here means the persisted edges contain a CYCLE, which generation cannot produce.
      raise exception
        'rollback_match: hop cap exceeded reverting match % — the persisted routing edges contain a cycle',
        p_match_id
        using errcode = 'IC905';
    end if;

    v_task := v_todo -> 0;
    v_todo := v_todo - 0;

    -- The edges OUT of this src node (where advance_match sent this node's winner + loser).
    select m2.winner_to_bracket, m2.winner_to_slot, m2.winner_to_gf_order, m2.winner_to_side,
           m2.loser_to_bracket,  m2.loser_to_slot,  m2.loser_to_gf_order,  m2.loser_to_side
      into v_src
      from public.match m2
     where m2.id = (v_task->>'src')::bigint;

    -- A MISS HERE MUST NOT BE SILENT — every worklist row is one we hold under the canonical lock, so it cannot
    -- miss; if it ever did, fail closed rather than skip a revert (advance_match:469-478 posture).
    if not found then
      raise exception
        'rollback_match: worklist referenced match % but it no longer exists (tournament %)',
        (v_task->>'src')::bigint, v_tid
        using errcode = 'IC905';
    end if;

    -- Both edges of this node, uniformly (mirror advance_match:491-502). The winner always travelled; the loser
    -- travelled only if there WAS one (NULL for a walkover continuation) and there was somewhere to go.
    for v_edge in
      select e.ord, e.kind, e.b, e.slot, e.gf, e.side, e.entry
        from (values
          (1, 'winner', v_src.winner_to_bracket, v_src.winner_to_slot, v_src.winner_to_gf_order,
              v_src.winner_to_side, (v_task->>'winner')::bigint),
          (2, 'loser',  v_src.loser_to_bracket,  v_src.loser_to_slot,  v_src.loser_to_gf_order,
              v_src.loser_to_side,  (v_task->>'loser')::bigint)
        ) as e(ord, kind, b, slot, gf, side, entry)
       where e.b is not null
         and e.entry is not null
       order by e.ord
    loop
      -- Resolve the structural edge to a row through match_slot_uniq (0010:112-113) — one indexed lookup. NO
      -- FOR UPDATE here: step 1b already holds EVERY row in canonical id order, so this row is locked and the
      -- plan cannot go stale. Taking a lock here is the 4.3 deadlock.
      select d.id, d.state, d.winner_entry, d.competitor_a, d.competitor_b
        into v_dest
        from public.match d
       where d.tournament_id         = v_m.tournament_id
         and d.bracket               = v_edge.b
         and d.bracket_slot          = v_edge.slot
         and coalesce(d.gf_order, 0) = coalesce(v_edge.gf, 0);

      if not found then
        -- match_routing_complete guarantees the edge EXISTS; a dangling edge is a generation bug (advance:515).
        raise exception
          'rollback_match: match % has a %-edge to (%,%,%) but no such match row exists in tournament %',
          (v_task->>'src')::bigint, v_edge.kind, v_edge.b, v_edge.slot, v_edge.gf, v_m.tournament_id
          using errcode = 'IC905';
      end if;

      -- The seat this edge named (what advance_match wrote into).
      v_occ := case when v_edge.side = 'a' then v_dest.competitor_a else v_dest.competitor_b end;

      -- If the seat does NOT hold OUR entry (a different player, or already NULL): skip. Someone already
      -- reverted it, it was never ours, or the advance never reached here. This is the idempotency half — a
      -- replay finds the seats already cleared and touches nothing.
      if v_occ is null or v_occ <> v_edge.entry then
        continue;
      end if;

      -- ⭐⭐ THE AD-8 FLAG (DECISION F). The seat holds our entry — it is a dependent advance. The safe-to-
      --    auto-revert set is EXACTLY the purely-structural states {declared, bye, void}; EVERYTHING ELSE is
      --    flagged. Written as an ALLOWLIST (not a denylist) deliberately: a denylist of the "played/committed"
      --    states silently mis-handles any state it forgets, and the states that are DESTRUCTIVE to un-seat are:
      --    resolved/manual_resolved (approved on its own demo — AD-8's literal case), pending (bound to its own
      --    demo), live (in progress), awaiting_grace (awaiting a forfeit decision), and — the one a denylist
      --    dropped (code review 2026-07-19) — forfeit (a COMMITTED walkover result that advanced its own winner,
      --    Story 4.5; un-seating it either trips match_winner_is_competitor or orphans its downstream advance).
      --    rolled_back is covered for free too (dead under DECISION A, but never mis-handled). Flag it into
      --    `blocking` and (below) refuse the whole rollback, leaf-first. Stricter than the letter of AD-8,
      --    strictly safer: it can NEVER "silently un-publish unrelated matches" (AD-8's named hazard).
      if v_dest.state not in ('declared', 'bye', 'void') then
        v_blocking := v_blocking || jsonb_build_object('match_id', v_dest.id, 'state', v_dest.state);
        continue;
      end if;

      -- {declared, bye, void} — auto-revertable. A `bye` node holding our entry is a WALKOVER we won (advance
      -- crowned us there, winner_entry = our entry), so the un-seat must ALSO clear winner_entry, and the
      -- advance CONTINUED from it — enqueue its own winner_to edge so the transitive cascade un-walks (AC1's
      -- "transitively"). A `declared`/`void` node carries no crown of ours; un-seat the competitor only.
      v_is_walk := (v_dest.state = 'bye');

      v_plan := v_plan || jsonb_build_object(
        'match_id', v_dest.id,
        'side',     v_edge.side,
        'entry',    v_edge.entry,
        'walkover', v_is_walk
      );

      if v_is_walk then
        -- A walkover has no loser (nobody was beaten), so the continuation carries only a winner — the same
        -- shape advance_match enqueued when it walked the cascade forward (0014:568-570).
        v_todo := v_todo || jsonb_build_object(
          'src', v_dest.id, 'winner', v_edge.entry, 'loser', null
        );
      end if;
    end loop;
  end loop;

  -- ══ 3b. ⭐⭐ THE AD-8 REFUSAL. If ANY dependent seat stood on its own state, refuse the WHOLE rollback now —
  --    nothing has been written. The admin rolls the downstream one back first (leaf-first). `blocking` names
  --    exactly which matches to address.
  if jsonb_array_length(v_blocking) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'downstream_active', 'blocking', v_blocking);
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 4. PASS 2 — APPLY THE REVERT (mirror advance_match:577-593). Un-seat conditionally — the inverse of
  --    match_place_competitor (0013:475-497): `competitor_<side> = null WHERE = our_entry`. The `= our_entry`
  --    predicate is what makes a replay a no-op (AC2). Assert each un-seat hit the row it should: a 0-row where
  --    we expected 1 means the lock did not hold what pass 1 saw — RAISE (advance_match:589-591 posture).
  for v_task in select * from jsonb_array_elements(v_plan) loop
    update public.match d
       set competitor_a = case when (v_task->>'side') = 'a'      then null else d.competitor_a end,
           competitor_b = case when (v_task->>'side') = 'b'      then null else d.competitor_b end,
           winner_entry = case when (v_task->>'walkover')::boolean then null else d.winner_entry end
     where d.id = (v_task->>'match_id')::bigint
       and (case when (v_task->>'side') = 'a' then d.competitor_a else d.competitor_b end)
             = (v_task->>'entry')::bigint;
    get diagnostics v_unseat = row_count;
    if v_unseat <> 1 then
      raise exception
        'rollback_match: expected to un-seat entry % from match % side % but % row(s) matched — the lock did not hold what pass 1 saw',
        (v_task->>'entry')::bigint, (v_task->>'match_id')::bigint, v_task->>'side', v_unseat
        using errcode = 'IC905';
    end if;
  end loop;

  -- ══ 5. UN-PUBLISH M — the reverse of approve_match's steps 2 then 1.
  v_before := jsonb_build_object(
    'state', v_m.state, 'score_source', v_m.score_source,
    'score_a', v_m.score_a, 'score_b', v_m.score_b, 'winner_entry', v_winner
  );

  -- 5a. §8 STEP 2 inverted — clear the score + state -> `pending` (DECISION A). ⚠ score_source_guard (tightened,
  --     0017:155-169) requires (score_a is null) = (score_source is null) on BOTH columns — clear all three
  --     together or trip 23514. `demo_id` STAYS BOUND (the match is re-approvable; unbinding is not rollback's
  --     job — the demo is still the evidence, AD-1). state resolved -> pending rides the terminal guard's
  --     deliberate allowance (0017:180-185).
  update public.match
     set score_a      = null,
         score_b      = null,
         score_source = null,
         winner_entry = null,
         state        = 'pending'
   where id = p_match_id;

  -- 5b. §8 STEP 1 inverted — un-approve the stat rows -> `pending`, clear the who/when. This IS FR-14's
  --     "removes its contribution from leaderboards" (DECISION E): the Story-5.5 view reads status='approved',
  --     so this flip removes the rows from it. NO leaderboard code — the flip IS the removal (AD-20).
  update public.stat_row
     set status      = 'pending',
         approved_at = null,
         approved_by = null
   where match_id = p_match_id;
  get diagnostics v_unpub = row_count;

  -- 5c. If M was the deciding row, un-crown the champion (the inverse of advance_match:601-605). service_role
  --     holds UPDATE on tournament. Idempotent: only fires when final_match_id currently points at M.
  update public.tournament
     set final_match_id = null
   where id = v_tid
     and final_match_id = p_match_id;
  get diagnostics v_uncrowned = row_count;

  -- ══ 6. THE AUDIT ROW (AD-17, action='rollback' — already enumerated, no migration). A REAL before/after +
  --    the reverted plan. This is FR-14's "logged" requirement (DECISION D — the feed correction is deferred).
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'rollback',
    p_match_id,
    jsonb_build_object(
      'before',                v_before,
      'after',                 jsonb_build_object('state', 'pending', 'score_source', null,
                                                  'score_a', null, 'score_b', null, 'winner_entry', null),
      'stat_rows_unpublished', v_unpub,
      'reverted',              v_plan,
      'uncrowned',             v_uncrowned > 0
    )
  );

  -- ══ 7. ⭐ THE SINGLE EMIT, POST-COMMIT BY CONSTRUCTION (AD-11). realtime.send INSERTS into realtime.messages
  --    inside THIS transaction; Realtime ships it off the replication slot only on commit — so the emit cannot
  --    outrun its own commit (0017:424-442 shape). ONE Broadcast carries the semantic change; SPINE:230's
  --    vocabulary lists match.approved/bracket.advanced/spin.reveal but NO rollback event, so `match.rolled_back`
  --    is MINTED here (DECISION G) — the payload carries the reverted plan + the new `pending` state so a viewer
  --    re-fetches corrected truth (AD-11: a Broadcast is a nudge). Public channel tournament:<id>.
  perform realtime.send(
    jsonb_build_object(
      'tournament_id', v_m.tournament_id,
      'match_id',      p_match_id,
      'state',         'pending',
      'reverted',      v_plan,
      'uncrowned',     v_uncrowned > 0
    ),
    'match.rolled_back',
    'tournament:' || v_m.tournament_id::text,
    false
  );

  return jsonb_build_object(
    'ok',                    true,
    'state',                 'pending',
    'stat_rows_unpublished', v_unpub,
    'reverted',              v_plan,
    'uncrowned',             v_uncrowned > 0
  );
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE it would be callable straight off the Data API. It is SECURITY INVOKER (a viewer would 42501 at
-- the first write anyway), but a defence that depends on a later grant check is not a defence: revoke first,
-- then grant to the single writer. The route's requireAdmin is the authorization gate; this is the second lock
-- on the same door (0017:456-463).
revoke execute on function public.rollback_match(bigint, text) from public;
grant  execute on function public.rollback_match(bigint, text) to service_role;
