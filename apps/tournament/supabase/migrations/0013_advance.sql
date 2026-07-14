-- supabase/migrations/0013_advance.sql
-- Logical migration 0013 — the idempotent conditional advance (Story 4.3, AC1 + AC2 + AC3 + D1-D4).
--
-- ONE migration because it is ONE concern: making a RESULT flow to its CONSEQUENCES. 4.1 built the
-- skeleton (every node, every competitor slot NULL) and 4.2 froze each node's rules. This is the slice
-- that turns a static skeleton into a tournament that can actually reach a champion.
--
-- ⭐ WHY THE ROUTING EDGES MOVE INTO THE DATABASE (D1). Today the double-elim routing exists ONLY in
-- TypeScript (lib/bracket/generate.ts — winnersWinnerTarget / winnersLoserTarget / losersWinnerTarget)
-- and `match` carries NO edge columns at all. But the advance must run INSIDE Story 4.6's Aprobar
-- transaction — SOLUTION-DESIGN §8 (L372-374) lists it as step (3) of ONE transaction — and a plpgsql
-- transaction cannot call back out to TypeScript to ask where a winner goes. So the DATABASE must know
-- the edges. Generation EMITS them (from the very functions 4.1 exported "precisely so 4.3 consumes them
-- rather than re-deriving", generate.ts:31), this migration STORES them, and `advance_match` FOLLOWS
-- POINTERS. The routing therefore keeps exactly ONE implementation, in TypeScript, where it is
-- exhaustively unit-tested. There is no `index ^ 1` anywhere in this file, and there must never be.
--
-- ⭐ WHY THE EDGES ARE STRUCTURE (bracket/slot/gf_order/side) AND NOT `winner_to_match_id bigint`.
-- Generation INSERTs every row in ONE statement, so no row has an `id` yet when its neighbours are
-- written. A match_id edge would force a second, post-INSERT resolution pass — and then the completeness
-- CHECK below could not be an ordinary immediate CHECK (it would have to become a deferred constraint
-- trigger). The structural key is ALREADY UNIQUE (`match_slot_uniq` on (tournament_id, bracket,
-- bracket_slot, coalesce(gf_order,0)), 0010:112-113), so an edge resolves to a row with one indexed
-- lookup. Simpler, and it keeps the CHECK honest.
--
-- SCOPE (whole deliverable):
--   (a) D1 — eight nullable routing columns on `match` + the `match_routing_complete` CHECK that makes a
--       bracket row with no way out UNREPRESENTABLE. A row with no outbound edge is a BRICK: nothing can
--       ever advance out of it, and `match` has NO DELETE grant (0010:227), so it is unrecoverable.
--   (b) D1 — `create or replace generate_bracket(...)`: the SAME signature, and the ONLY change is that
--       the INSERT now also reads the eight edge keys from each p_matches element.
--   (c) AC1/AC2/D2/D3/D4 — `advance_match(...)`: the conditional (AC1), result-gated (AC2),
--       loser-dropping (D2), bye-cascading (D3), audited (D4) advance, plus its `match_place_competitor`
--       helper — the ONE place the AC1 predicate is written.
--   (d) AC3 — the post-commit Broadcast, via `realtime.send()` from inside the advance.
-- OUT OF SCOPE — do NOT add here (each has an owning story; building it now is scope creep):
--   * `audit_log.action = 'advance'` needs NO migration: `action` is uncapped text and `advance` is
--     already the enumerated vocabulary (0003:25, SOLUTION-DESIGN:251, AD-17). Same as 4.2's declare_format.
--   * ⚠ ANY standalone advance ROUTE or "Avanzar" button. AD-8 (SPINE:115-118) makes the advance a
--     CONSEQUENCE of a result transition (Aprobar / Forfeit / Bye), "NEVER an independent button that
--     races publish", and the epic's AC2 restates it verbatim. `advance_match` is granted to service_role
--     and is called from INSIDE 4.5's and 4.6's own transactions. There is no app/api/admin/advance route,
--     and adding one would break AC2. (PRD FR-7 and EXPERIENCE:87 describe a tap/drag control; the
--     architecture deliberately overrode them — the affordance, if built, IS the result-entry action.)
--   * the `declared -> live` transition — still unowned (4.2 flagged it). The advance reads a TERMINAL
--     result state; it never sets `live`.
--   * the Grand-Final RESET row (gf_order=2, AD-21) -> Story 4.4. 4.3 treats the single gf_order=1 row as
--     terminal: its winner is the champion. ⚠ 4.4 WIDENS the grand_final arm of match_routing_complete —
--     see the note on the constraint.
--   * forfeit / awaiting_grace / the grace timer / mark_walkover -> Story 4.5. This story ACCEPTS
--     state='forfeit' as an advanceable result; it does not CREATE it.
--   * Aprobar / the demo-derived score / state='resolved' / demo binding -> Story 4.6. The advance writes
--     NO score and NO state (except a walkover's winner_entry): it READS a result someone else committed.
--   * rollback / un-advance -> Story 4.7. `slot_taken` is the REFUSAL that points at it — there is
--     deliberately no force-overwrite escape hatch (AD-8: "re-routing a different winner requires an
--     explicit rollback first", SOLUTION-DESIGN §7 L357-358).
--   * `tournament.final_match_id` — left DORMANT. Which row is the LAST grand-final row is 4.4's question
--     (the reset row), and writing it now would be wrong for exactly the field 4.4 exists to handle.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) D1 — the routing edges. The bracket DAG, as STRUCTURE.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.match
  add column winner_to_bracket  text,
  add column winner_to_slot     int,
  add column winner_to_gf_order int,
  add column winner_to_side     text,
  add column loser_to_bracket   text,
  add column loser_to_slot      int,
  add column loser_to_gf_order  int,
  add column loser_to_side      text;

comment on column public.match.winner_to_bracket is
  'Routing edge (D1): where this match''s WINNER goes, as the structural key (bracket, bracket_slot, gf_order) + side. Resolved through match_slot_uniq. NULL only on the grand-final row, whose winner is the champion. Emitted by lib/bracket/generate.ts — never re-derived in SQL.';
comment on column public.match.loser_to_bracket is
  'Routing edge (D1): where this match''s LOSER drops. NULL on a `losers` row — and that ABSENCE *is* two-loss elimination (FR-6, SOLUTION-DESIGN:359: "derived from bracket edges, never a stored flag"). NULL on the grand-final row (its loser is the runner-up).';

-- Closed-set text, the SPINE:234 convention (mirrors `match.bracket` / `match.state` at 0010:49,64-65).
alter table public.match add constraint match_winner_to_side_check   check (winner_to_side  in ('a','b'));
alter table public.match add constraint match_loser_to_side_check    check (loser_to_side   in ('a','b'));
alter table public.match add constraint match_winner_to_bracket_check check (winner_to_bracket in ('winners','losers','grand_final'));
alter table public.match add constraint match_loser_to_bracket_check  check (loser_to_bracket  in ('winners','losers','grand_final'));

-- AN EDGE IS ALL-OR-NOTHING. Half an edge — a bracket with no slot, or a slot with no side — resolves to
-- nothing (or, worse, to the WRONG row), and `advance_match` would raise on a bracket that had already
-- been committed. `bracket` is the discriminator the CHECK below keys on, so the other two must track it
-- exactly. (gf_order is NOT part of this: it is NULL for a winners/losers target and non-NULL for a
-- grand-final one — see the separate guard below, which mirrors the table's own match_gf_order_guard.)
alter table public.match add constraint match_winner_edge_shape check (
  (winner_to_bracket is null) = (winner_to_slot is null)
  and (winner_to_bracket is null) = (winner_to_side is null)
);
alter table public.match add constraint match_loser_edge_shape check (
  (loser_to_bracket is null) = (loser_to_slot is null)
  and (loser_to_bracket is null) = (loser_to_side is null)
);

-- An edge's gf_order EXISTS iff it targets a grand-final row — the exact mirror of match_gf_order_guard
-- (0010:84-89) applied to the DESTINATION. Without it, an edge to ('grand_final', 0, NULL) would resolve
-- through `coalesce(gf_order,0) = 0` and match NOTHING (every GF row is 1 or 2), so a structurally
-- complete bracket would still dead-end at the final. Make it unrepresentable rather than raise at
-- advance time — the bracket is already committed by then, and there is no DELETE grant to undo it.
alter table public.match add constraint match_winner_edge_gf_order check (
  case when winner_to_bracket = 'grand_final' then winner_to_gf_order is not null
       else winner_to_gf_order is null end
);
alter table public.match add constraint match_loser_edge_gf_order check (
  case when loser_to_bracket = 'grand_final' then loser_to_gf_order is not null
       else loser_to_gf_order is null end
);

-- ⭐ THE TEETH OF D1. Each arm is exactly that bracket's structural truth:
--   * EVERY `winners` row has a winner edge AND a loser-drop edge. The drop is what fills the Losers
--     bracket — without it the LB never receives anybody, the Grand Final's side B never fills, and NO
--     TOURNAMENT CAN EVER COMPLETE (while every winner-only test still passes green). This constraint is
--     what makes that bug unshippable rather than merely unlikely.
--   * a `losers` row has a winner edge and NO loser edge. The ABSENCE is the two-loss rule (FR-6): a
--     Losers loser is eliminated, and elimination is DERIVED from the edges, never stored as a flag.
--   * the `grand_final` row has NEITHER: its winner is the CHAMPION and goes nowhere; its loser is the
--     runner-up.
--
-- ⚠ STORY 4.4 MUST WIDEN THE grand_final ARM. The AD-21 reset row (gf_order=2) means the gf_order=1 row
-- gains a CONDITIONAL winner edge (-> the reset, iff the LB survivor won it). When 4.4's suite goes red
-- here, that is this constraint doing its job — widen the arm, do not weaken the CHECK.
alter table public.match add constraint match_routing_complete check (
  case bracket
    when 'winners' then winner_to_bracket is not null and loser_to_bracket is not null
    when 'losers'  then winner_to_bracket is not null and loser_to_bracket is null
    else /* grand_final */ winner_to_bracket is null  and loser_to_bracket is null
  end
);

-- ════════════════════════════════════════════════════════════════════════════
-- (b) D1 — generation persists the edges.
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `create or replace` with an IDENTICAL signature (bigint, text, jsonb, jsonb, jsonb) PRESERVES the
-- existing EXECUTE grants (0011:335-336). So this must NOT be a drop-and-recreate, and the grants must
-- NOT be re-issued. Everything below is 0011's function copied forward VERBATIM except the INSERT at
-- step 7, which now also reads the eight edge keys. Every guard, the FOR UPDATE, the roster re-check, the
-- bad_skeleton count and the audit row are unchanged — re-read 0011:139-327 alongside this.
--
-- The caller sends each edge as a NESTED OBJECT — `winner_to: {bracket, slot, gf_order, side} | null` —
-- so a JSON `null` edge yields SQL NULL on every key, which is exactly what the losers/grand_final arms of
-- match_routing_complete want. That CHECK is now what rejects a caller who omits the edges; no extra
-- assertion is needed inside this function.
create or replace function public.generate_bracket(
  p_tournament_id   bigint,
  p_actor_steamid64 text,
  p_bracket_seed    jsonb,   -- the RAW draw (algorithm + permutation), recorded in the audit detail (AD-17)
  p_seeds           jsonb,   -- [{"roster_entry_id":123,"seed":1}, …] — the positions 1..N
  p_matches         jsonb    -- the COMPLETE skeleton: winners + losers + the one grand_final row, WITH EDGES
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_state       text;
  v_actual_ids  bigint[];
  v_claimed_ids bigint[];
  v_positions   int[];
  v_field       int;
  v_bracket     int;
  v_expected    int;
  v_matches     int;
begin
  -- 1. SERIALIZE on the tournament row. This lock is the spine of the whole story: it makes the state
  --    check + the roster re-read + every write one indivisible step, AND it is the lock the roster
  --    trigger's FOR KEY SHARE collides with (D3).
  select t.state
    into v_state
    from public.tournament t
   where t.id = p_tournament_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_tournament');
  end if;

  -- 2. SINGLE-SHOT (D2). A second generate on a live bracket is REFUSED, never duplicated.
  if v_state = 'bracket_live' then
    return jsonb_build_object('ok', false, 'reason', 'already_live');
  end if;
  if v_state <> 'registration_closed' then
    return jsonb_build_object('ok', false, 'reason', 'not_closed', 'state', v_state);
  end if;

  -- 2b. A tournament still 'registration_closed' but ALREADY holding match rows is a corrupt state no
  --     legitimate path produces. Refuse cleanly rather than let step 7 abort on match_slot_uniq (23505).
  if exists (select 1 from public.match m where m.tournament_id = p_tournament_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_live');
  end if;

  -- 3. OPTIMISTIC CONCURRENCY. Under the lock, assert the active roster is STILL exactly the set that was
  --    seeded. If an add/remove slipped in, the computed bracket is stale — refuse rather than commit it.
  select coalesce(array_agg(r.id order by r.id), '{}')
    into v_actual_ids
    from public.roster_entry r
   where r.tournament_id = p_tournament_id
     and r.status = 'active';

  select coalesce(array_agg((e->>'roster_entry_id')::bigint order by (e->>'roster_entry_id')::bigint), '{}')
    into v_claimed_ids
    from jsonb_array_elements(p_seeds) as e;

  if v_actual_ids is distinct from v_claimed_ids then
    return jsonb_build_object('ok', false, 'reason', 'roster_changed');
  end if;

  -- 4. FIELD BOUNDS (AC1). Only reachable by a DIRECT RPC call — which is why it is here: the DB is the
  --    authority, not the caller.
  v_field := coalesce(array_length(v_actual_ids, 1), 0);
  if v_field < 8 or v_field > 16 then
    return jsonb_build_object('ok', false, 'reason', 'bad_field_count', 'field_size', v_field);
  end if;

  -- 5. THE PAYLOAD IS NOT TRUSTED.
  --
  --    5a. p_seeds must be a PERMUTATION of 1..N. Step 3 compared only the id SET; the `seed` values are
  --        written straight into roster_entry.bracket_seed (no CHECK, no UNIQUE).
  select coalesce(array_agg((e->>'seed')::int order by (e->>'seed')::int), '{}')
    into v_positions
    from jsonb_array_elements(p_seeds) as e;

  if v_positions is distinct from (select array_agg(g order by g) from generate_series(1, v_field) as g) then
    return jsonb_build_object('ok', false, 'reason', 'bad_seeds');
  end if;

  --    5b. p_matches must be the COMPLETE skeleton: B-1 winners + B-2 losers + 1 grand-final = 2B-2 rows.
  --        Without this, `p_matches = '[]'` inserts nothing, step 8 still flips the state to
  --        'bracket_live', step 9 still audits, and the function returns ok:true — leaving a live
  --        tournament with NO bracket and no DELETE grant on `match` to clean up. Unrecoverable.
  v_bracket := 8;
  while v_bracket < v_field loop
    v_bracket := v_bracket * 2;
  end loop;
  v_expected := 2 * v_bracket - 2;

  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) <> v_expected then
    return jsonb_build_object(
      'ok', false, 'reason', 'bad_skeleton',
      'expected', v_expected,
      'received', case when jsonb_typeof(p_matches) = 'array' then jsonb_array_length(p_matches) else null end
    );
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- 6. Record the draw: each active entry's seed POSITION 1..N (AC1).
  --    ⚠ ORDERING IS LOAD-BEARING: this UPDATE fires the D3 roster-lock trigger, which rejects roster
  --    writes once state='bracket_live'. It MUST run BEFORE step 8 flips the state.
  update public.roster_entry r
     set bracket_seed = s.seed
    from (
      select (e->>'roster_entry_id')::bigint as id,
             (e->>'seed')::int               as seed
        from jsonb_array_elements(p_seeds) as e
    ) s
   where r.id = s.id
     and r.tournament_id = p_tournament_id;

  -- 7. The bracket itself: every row at once, NOW INCLUDING ITS ROUTING EDGES (D1 — the only change in
  --    this function). `m -> 'winner_to' ->> 'bracket'` yields SQL NULL both when the edge is JSON `null`
  --    (the grand-final row, and every losers row's loser edge) and when the key is absent — and
  --    match_routing_complete is what turns the SECOND case into a hard refusal (23514) instead of a
  --    silently un-advanceable bracket.
  insert into public.match (
    tournament_id, bracket, bracket_position, bracket_slot, gf_order,
    competitor_a, competitor_b, winner_entry, state,
    winner_to_bracket, winner_to_slot, winner_to_gf_order, winner_to_side,
    loser_to_bracket,  loser_to_slot,  loser_to_gf_order,  loser_to_side
  )
  select
    p_tournament_id,
    m->>'bracket',
    m->>'bracket_position',
    (m->>'bracket_slot')::int,
    (m->>'gf_order')::int,
    (m->>'competitor_a')::bigint,
    (m->>'competitor_b')::bigint,
    (m->>'winner_entry')::bigint,
    m->>'state',
    m -> 'winner_to' ->> 'bracket',
    (m -> 'winner_to' ->> 'slot')::int,
    (m -> 'winner_to' ->> 'gf_order')::int,
    m -> 'winner_to' ->> 'side',
    m -> 'loser_to'  ->> 'bracket',
    (m -> 'loser_to' ->> 'slot')::int,
    (m -> 'loser_to' ->> 'gf_order')::int,
    m -> 'loser_to'  ->> 'side'
  from jsonb_array_elements(p_matches) as m;
  get diagnostics v_matches = row_count;

  -- Belt and braces: the count was validated on the way in, so a mismatch here is impossible without a
  -- Postgres bug. Assert it anyway — this is the row that flips a tournament live.
  if v_matches <> v_expected then
    raise exception 'generate_bracket: inserted % match rows, expected %', v_matches, v_expected;
  end if;

  -- 8. The state transition the whole story exists to make.
  update public.tournament
     set state = 'bracket_live'
   where id = p_tournament_id;

  -- 9. The audit row, INSIDE the transaction (AD-17).
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    p_tournament_id,
    p_actor_steamid64,
    'generate_bracket',
    jsonb_build_object(
      'before',       'registration_closed',
      'after',        'bracket_live',
      'field_size',   v_field,
      'bracket_size', v_bracket,
      'match_count',  v_matches,
      'bracket_seed', p_bracket_seed   -- the raw draw: algorithm + the full seed permutation
    )
  );

  return jsonb_build_object(
    'ok', true, 'field_size', v_field, 'bracket_size', v_bracket, 'match_count', v_matches
  );
end;
$$;

-- NO grants re-issued: `create or replace` with the same signature keeps 0011:335-336 intact.

-- ════════════════════════════════════════════════════════════════════════════
-- (c1) AC1 — the conditional write. The ONE place this predicate is written.
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⭐ THIS FUNCTION *IS* ACCEPTANCE CRITERION 1. SOLUTION-DESIGN §7 (L357): *"Advance (FR-7): admin-only,
-- server-gated, IDEMPOTENT — `SET occupant = winner WHERE slot IS NULL OR occupant = winner`."*
--
--   row_count = 1 -> the entry was PLACED, **or it was already exactly this entry** (a replay). BOTH are
--                    success, and that is the whole of the idempotency: it falls straight out of the
--                    predicate, with no version counter, no "already advanced" flag and no read-then-write
--                    race. A double-tap cannot double-route.
--   row_count = 0 -> the slot holds a DIFFERENT player. The caller REFUSES (`slot_taken`) and does not
--                    overwrite: *"Re-routing a different winner requires an explicit rollback first"*
--                    (AD-8 / §7 L357-358). Rollback is Story 4.7.
--
-- It is factored out because it is called from FOUR places (winner, loser, and both of their bye
-- cascades), and re-writing the predicate four times is how one of them ends up wrong.
--
-- `p_walkover` (D3): when the destination is a `bye` node, the arrival WINS IT UNPLAYED — and the winner
-- must be seated in the SAME UPDATE as the competitor, because `match_winner_is_competitor` (0010:94-98)
-- requires the winner to ALREADY be a competitor of the row. Two separate statements would violate that
-- CHECK on the first one. This is not a micro-optimization; it is the only legal way to write it.
create function public.match_place_competitor(
  p_dest     bigint,
  p_side     text,     -- 'a' | 'b' — the edge's side
  p_entry    bigint,
  p_walkover boolean   -- the destination is a `bye` node: crown the arrival in the same statement (D3)
) returns boolean
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_placed int;
begin
  -- Fail closed on a bad side rather than let the CASE's else-branch silently mean 'b'. Unreachable from
  -- an edge (match_winner_to_side_check / match_loser_to_side_check), but this is a callable function.
  if p_side is null or p_side not in ('a', 'b') then
    raise exception 'match_place_competitor: side must be ''a'' or ''b'', got %', coalesce(p_side, 'NULL');
  end if;

  update public.match d
     set competitor_a = case when p_side = 'a'  then p_entry else d.competitor_a end,
         competitor_b = case when p_side = 'b'  then p_entry else d.competitor_b end,
         winner_entry = case when p_walkover    then p_entry else d.winner_entry end
   where d.id = p_dest
     -- ⭐ AC1, verbatim: "WHERE slot IS NULL OR = winner". Written ONCE, for whichever side the edge names.
     and (
       case when p_side = 'a' then d.competitor_a else d.competitor_b end is null
       or case when p_side = 'a' then d.competitor_a else d.competitor_b end = p_entry
     );

  get diagnostics v_placed = row_count;
  return v_placed = 1;
end;
$$;

revoke execute on function public.match_place_competitor(bigint, text, bigint, boolean) from public;
grant  execute on function public.match_place_competitor(bigint, text, bigint, boolean) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (c2) AC1/AC2/AC3 + D2/D3/D4 — advance_match: the whole story.
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⭐ AC2 — "CONSEQUENCE, NOT CONTROL", AS A MECHANISM RATHER THAN A COMMENT. This function REFUSES to
-- advance a match that has not produced a RESULT. `declared` / `live` / `awaiting_grace` / `pending` have
-- no result yet — and `pending` is the one AD-8 names by hand: advancing a Pending match is PRECISELY the
-- "advance racing the publish" the whole decision exists to prevent (FR-13 excludes Pending stats from
-- bracket advancement, prd.md:245-246). `rolled_back` advances nobody either — un-advancing is 4.7's job.
-- Because the ONLY way in is a committed result, there is nothing for an independent control to race.
--
-- ⭐ D2 — THE LOSER DROP IS PART OF THE ADVANCE. AC1 says only the word "winner", and a bracket in which
-- only winners advance cannot complete a single event: every Losers node stays empty forever, the Grand
-- Final's side B never fills, and not one tournament reaches a champion — while every winner-only test
-- stays green. The loser is NOT a stored column: it is "the competitor who is not winner_entry", which is
-- NULL exactly when the match had one competitor (a bye). That single expression handles Bye, Forfeit and
-- Resolved uniformly. A Losers-bracket loser has no loser edge (by construction) and is ELIMINATED — the
-- absence of the edge IS the two-loss rule (FR-6).
--
-- ⭐ D3 — THE BYE CASCADE, and it is the NORMAL path, not a corner case. On a non-power-of-two field some
-- Losers nodes can only ever receive ONE competitor (`state='bye'`, a walkover) because their feeder was a
-- bye and a bye has no loser. The standing 11-player live-QA fixture is 30 rows of which TEN are
-- bye/void. When a player arrives at a `bye` node they have WON IT, unplayed — so it is set as won and the
-- advance CONTINUES from it, or the Losers bracket stalls at the first walkover waiting for an opponent
-- who can never arrive (generate.ts:33-38, addressed to this story in capitals).
--
-- ⭐ EVERY GUARD BEFORE ANY WRITE — AND THAT IS WHY THIS IS TWO PASSES. A typed refusal RETURNS; it does
-- not raise, so it does NOT roll the transaction back. If the winner were placed and the loser drop then
-- hit `slot_taken`, the caller would get `{ok:false}` while a partial advance sat committed underneath it.
-- So PASS 1 walks the whole cascade READ-ONLY (taking FOR UPDATE on every row it resolves, so the plan
-- cannot go stale) and validates every placement; PASS 2 applies them. A refusal from pass 1 has written
-- NOTHING. (This is the 0011/0012 convention, and here it is load-bearing rather than stylistic.)
--
-- LOCK ORDER / DEADLOCKS: every lock is taken in TOPOLOGICAL order (a node before its successors), because
-- that is the only direction the DAG is walked. Two concurrent advances therefore acquire their shared
-- locks in the same relative order and cannot form a cycle.
create function public.advance_match(
  p_match_id        bigint,
  p_actor_steamid64 text,
  p_emit            boolean default true   -- AD-11: 4.6 folds the advance into its own single Broadcast
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m      record;
  v_src    record;
  v_dest   record;
  v_edge   record;
  v_task   jsonb;
  v_todo   jsonb := '[]'::jsonb;   -- queue of nodes to advance FROM: [{src, winner, loser}]
  v_plan   jsonb := '[]'::jsonb;   -- the validated, ordered placements: [{match_id, entry, side, walkover}]
  v_loser  bigint;
  v_occ    bigint;
  v_walk   boolean;
  v_champ  bigint;
  v_iter   int := 0;
  v_hops   int;
begin
  -- ══ 1. THE SOURCE. Locked, so its result and its edges cannot move under us.
  select m.id, m.tournament_id, m.state, m.winner_entry, m.competitor_a, m.competitor_b
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 2. AC2 — THE RESULT GATE. No result, no consequence.
  --    `void` falls here too (it can never be played: nothing arrives, nothing leaves), as do `declared`,
  --    `live`, `awaiting_grace`, `pending` and `rolled_back` — see the header for why `pending` matters most.
  if v_m.state not in ('bye', 'forfeit', 'resolved', 'manual_resolved') then
    return jsonb_build_object('ok', false, 'reason', 'not_resolved', 'state', v_m.state);
  end if;

  -- A result without a winner is not a result. (This is also what keeps an un-walked Losers `bye` node —
  -- state='bye', competitors still NULL — from "advancing" nobody into the next round.)
  if v_m.winner_entry is null then
    return jsonb_build_object('ok', false, 'reason', 'not_resolved', 'state', v_m.state);
  end if;

  -- ══ 3. D2 — THE LOSER. Not a column: the competitor who is not the winner. NULL for a bye (one
  --    competitor), non-NULL for a forfeit / resolved / manual_resolved. `match_winner_is_competitor`
  --    (0010:94-98) guarantees the winner really is one of the two, so this cannot pick a stranger.
  v_loser := case when v_m.competitor_a = v_m.winner_entry then v_m.competitor_b else v_m.competitor_a end;

  v_todo := jsonb_build_array(
    jsonb_build_object('src', v_m.id, 'winner', v_m.winner_entry, 'loser', v_loser)
  );

  -- ══ 4. PASS 1 — PLAN THE WHOLE CASCADE, READ-ONLY. Any refusal here has written nothing.
  --    An explicit bounded worklist, never open recursion: a `while true` inside an admin transaction is
  --    an infinite loop, and the cap turns a routing cycle into a loud failure instead of a hang.
  while jsonb_array_length(v_todo) > 0 loop
    v_iter := v_iter + 1;
    if v_iter > 32 then
      -- Generous by an order of magnitude: a 16-bracket's longest walkover chain is under 10 hops.
      -- Getting here means the persisted edges contain a CYCLE, which generation cannot produce.
      raise exception
        'advance_match: hop cap exceeded advancing match % — the persisted routing edges contain a cycle',
        p_match_id;
    end if;

    v_task := v_todo -> 0;
    v_todo := v_todo - 0;

    select m2.winner_to_bracket, m2.winner_to_slot, m2.winner_to_gf_order, m2.winner_to_side,
           m2.loser_to_bracket,  m2.loser_to_slot,  m2.loser_to_gf_order,  m2.loser_to_side
      into v_src
      from public.match m2
     where m2.id = (v_task->>'src')::bigint;

    -- NEVER A SILENT NO-OP (lib/roster.ts:180-182) — but the Grand Final is the ONE legitimate
    -- "advanced nobody": it has no outbound edge (match_routing_complete), so its winner is the CHAMPION.
    -- Checked HERE rather than at the source, so it covers both a direct advance of the GF and a walkover
    -- that cascades INTO it — one place, no special case.
    if v_src.winner_to_bracket is null then
      v_champ := (v_task->>'winner')::bigint;
    end if;

    -- Both edges of this node, uniformly. The winner always travels; the loser travels only if there IS
    -- one (NULL for a bye) and there is somewhere for them to go (a Losers loser is ELIMINATED — D2).
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
      -- Resolve the structural edge to a row through match_slot_uniq (0010:112-113) — one indexed lookup.
      -- FOR UPDATE: the plan built here is applied in pass 2, so every row it depends on must be held.
      select d.id, d.state, d.winner_entry, d.competitor_a, d.competitor_b, d.winner_to_bracket
        into v_dest
        from public.match d
       where d.tournament_id            = v_m.tournament_id
         and d.bracket                  = v_edge.b
         and d.bracket_slot             = v_edge.slot
         and coalesce(d.gf_order, 0)    = coalesce(v_edge.gf, 0)
         for update;

      if not found then
        -- match_routing_complete guarantees the edge EXISTS; it cannot guarantee it POINTS somewhere real.
        -- A dangling edge is a generation bug, and it is not something to paper over.
        raise exception
          'advance_match: match % has a %-edge to (%,%,%) but no such match row exists in tournament %',
          (v_task->>'src')::bigint, v_edge.kind, v_edge.b, v_edge.slot, v_edge.gf, v_m.tournament_id;
      end if;

      if v_dest.state = 'void' then
        -- IMPOSSIBLE BY CONSTRUCTION: a void node has ZERO possible arrivals (generate.ts:428) — both of
        -- its feeders were byes, so neither ever produces a loser. Reaching one means the routing is
        -- broken. Raise; do not paper over it.
        raise exception
          'advance_match: match % routed a % into VOID node % — the bracket routing is broken',
          (v_task->>'src')::bigint, v_edge.kind, v_dest.id;
      end if;

      -- ⭐ AC1, evaluated as a READ (we hold the row's lock, so what we see is what pass 2 will write to).
      v_occ := case when v_edge.side = 'a' then v_dest.competitor_a else v_dest.competitor_b end;

      if v_occ is not null and v_occ <> v_edge.entry then
        -- A DIFFERENT player already holds this seat. Refuse — never overwrite. Nothing has been written.
        return jsonb_build_object(
          'ok', false, 'reason', 'slot_taken',
          'match_id', v_dest.id, 'side', v_edge.side, 'occupant', v_occ, 'entry', v_edge.entry
        );
      end if;

      -- ⭐ D3 — a `bye` destination is a WALKOVER: the arrival wins it unplayed.
      v_walk := (v_dest.state = 'bye');

      if v_walk and v_dest.winner_entry is not null and v_dest.winner_entry <> v_edge.entry then
        -- Unreachable in a well-formed bracket (a bye node has exactly one possible arrival, and the seat
        -- check above would already have caught a different occupant) — but a winner is a competitor, so
        -- if these ever disagree the row is corrupt. Fail closed rather than crown the wrong player.
        return jsonb_build_object(
          'ok', false, 'reason', 'slot_taken',
          'match_id', v_dest.id, 'side', v_edge.side, 'occupant', v_dest.winner_entry, 'entry', v_edge.entry
        );
      end if;

      v_plan := v_plan || jsonb_build_object(
        'match_id', v_dest.id,
        'entry',    v_edge.entry,
        'side',     v_edge.side,
        'walkover', v_walk
      );

      if v_walk then
        -- …and the advance CONTINUES from it. A walkover has no loser (nobody was beaten), so the chain
        -- carries only a winner. It ends at a `declared` node (which waits for its real opponent) or at
        -- the Grand Final (whose winner is the champion — detected at the top of the loop).
        v_todo := v_todo || jsonb_build_object(
          'src', v_dest.id, 'winner', v_edge.entry, 'loser', null
        );
      end if;
    end loop;
  end loop;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 5. PASS 2 — APPLY. Every destination is already locked and already validated.
  v_hops := jsonb_array_length(v_plan);

  for v_task in select * from jsonb_array_elements(v_plan) loop
    if not public.match_place_competitor(
             (v_task->>'match_id')::bigint,
              v_task->>'side',
             (v_task->>'entry')::bigint,
             (v_task->>'walkover')::boolean
           ) then
      -- Impossible: pass 1 took FOR UPDATE on this exact row and found the seat free (or already ours).
      -- If the predicate fails now, the lock did not hold what we think it held — abort loudly.
      raise exception
        'advance_match: destination % side % was taken after validation — this should be unreachable under FOR UPDATE',
        (v_task->>'match_id')::bigint, v_task->>'side';
    end if;
  end loop;

  -- ══ 6. D4 — THE AUDIT ROW, INSIDE THE TRANSACTION (AD-17). ONE row per CALL, not per hop: a bye
  --    cascade is a single admin consequence and reads as one. `action='advance'` needs NO migration —
  --    it is already the enumerated vocabulary (0003:25). `target_match_id` is the SOURCE match.
  --
  --    A REPLAY WRITES A SECOND ROW, DELIBERATELY. The audit is a log of admin ACTIONS, not of state
  --    deltas — and a silent second call is exactly the double-tap AD-8 worries about, so it is worth
  --    seeing. The bracket is unchanged either way; that is AC1's idempotency, and it is asserted.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'advance',
    p_match_id,
    jsonb_build_object(
      'winner_entry', v_m.winner_entry,
      'loser_entry',  v_loser,
      'hops',         v_plan,
      'champion',     v_champ
    )
  );

  -- ══ 7. AC3 — THE BROADCAST, POST-COMMIT BY CONSTRUCTION.
  --
  --    `realtime.send` INSERTS A ROW INTO `realtime.messages` inside THIS transaction, and Realtime ships
  --    it off the replication slot. So nothing is delivered unless this transaction COMMITS, and a
  --    rollback discards the message together with the advance that would have caused it. THE EMIT CANNOT
  --    OUTRUN ITS OWN COMMIT — which is strictly stronger than a TypeScript "emit after the RPC returns",
  --    which can emit for a transaction that then fails, or lose the nudge if the process dies post-commit.
  --
  --    Channel and event naming are FIXED BY THE SPINE, not chosen here: topic `tournament:<id>`, event
  --    named by the semantic change (SPINE:230, AD-11:130-133). `private => false` — `tournament:<id>` is
  --    the PUBLIC channel.
  --
  --    ⚠ DO NOT "FIX" THE ERROR SWALLOWING. `realtime.send` wraps its INSERT in `EXCEPTION WHEN OTHERS ->
  --    RAISE WARNING`, so a Realtime hiccup can NEVER abort an advance. That is correct, and it IS AD-11:
  --    Broadcast is a NUDGE, never the source of truth. Every viewer surface is reconstructable from a
  --    published read alone, and a client re-fetches on reconnect (Story 5.8).
  --
  --    `p_emit` exists for ONE reason (AD-6/AD-11): *"ONE Broadcast carries the semantic change so the
  --    four effects of AD-6 stay atomic on the wire"*. When Story 4.6's Aprobar calls this INSIDE its own
  --    transaction it may fold the advance into its single `match.approved` message and pass
  --    `p_emit => false`. It defaults to TRUE so an advance is never silently unannounced.
  --    ⚠ DO NOT BUILD A SECOND EMITTER ANYWHERE.
  if coalesce(p_emit, true) and v_hops > 0 then
    perform realtime.send(
      jsonb_build_object(
        'tournament_id', v_m.tournament_id,
        'match_id',      p_match_id,
        'winner_entry',  v_m.winner_entry,
        'loser_entry',   v_loser,
        'champion',      v_champ,
        'hops',          v_plan
      ),
      'bracket.advanced',
      'tournament:' || v_m.tournament_id::text,
      false
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'advanced', v_hops, 'champion', v_champ, 'hops', v_plan
  );
end;
$$;

-- ── EXECUTE grants — service-role-only (AD-8) ────────────────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so this REVOKE
-- is LOAD-BEARING, not decoration: without it the advance would be callable straight off the Data API by
-- any visitor. Revoke first, then grant to the single writer (0011:329-336, 0012:480-487).
--
-- There is NO route to gate — and that is AC2, not an omission. `advance_match` is called from INSIDE
-- Story 4.5's forfeit transaction and Story 4.6's Aprobar transaction; it is never an independent control.
revoke execute on function public.advance_match(bigint, text, boolean) from public;
grant  execute on function public.advance_match(bigint, text, boolean) to service_role;
