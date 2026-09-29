-- supabase/migrations/0011_bracket_generation.sql
-- Logical migration 0011 — atomic bracket generation + the roster lock (Story 4.1, D2 + D3 + AC1).
--
-- TWO concerns, one story, and they are deliberately in the SAME migration because they are two halves
-- of one lock: `generate_bracket` takes `FOR UPDATE` on the tournament row, and the roster-lock trigger
-- takes `FOR KEY SHARE` on it. Those two modes CONFLICT, which is precisely what closes the TOCTOU
-- window (D3) — shipping one without the other would leave the race open.
--
-- SCOPE (whole deliverable):
--   (a) D2 — `generate_bracket(...)`: the app's FIRST atomic admin transaction. `supabase-js` cannot do
--       multi-statement transactions, and a half-built bracket is NOT recoverable by retry (unlike every
--       existing write, which is idempotent — see the writeAudit note in lib/roster.ts:52-55), so a
--       SQL function is genuinely required, not a stylistic choice (AD-6). It seeds roster_entry.
--       bracket_seed, inserts every match row, flips tournament.state -> 'bracket_live' and appends the
--       audit row, ALL in one transaction. Typed refusals, never exceptions, for expected outcomes.
--       ⭐ This is the pattern Story 4.6 (Aprobar) reuses — and 4.9 generalizes into a helper.
--   (b) D3 — `roster_entry_lock_guard()` + its BEFORE INSERT OR UPDATE trigger: the write-side state
--       predicate that closes the roster-lock TOCTOU (retro epic-2 #7 / epic-3 #3, deferred-work.md
--       §"code review of 2-5"). Homed HERE because this migration introduces the first concurrent
--       `bracket_live` writer — i.e. the writer that makes the window exploitable at all.
-- OUT OF SCOPE — do NOT add here:
--   * `audit_log.action='generate_bracket'` needs NO migration: `action` is uncapped `text` (0003:25
--     already enumerates generate_bracket in its comment) and 0003 granted service_role INSERT.
--   * the idempotent conditional advance (4.3), the GF-reset row (4.4), forfeit/grace (4.5),
--     Aprobar (4.6), rollback (4.7), manual score (4.8), the reusable command-route helper (4.9).
--   * any anon/authenticated EXECUTE grant — the RPC is service-role-only (AD-8); the route's
--     requireAdmin is the authorization gate, and this grant is the second lock on the same door.

-- ════════════════════════════════════════════════════════════════════════════
-- (b) D3 — the roster lock. Defined FIRST so it is already armed when (a) runs.
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE BUG THIS CLOSES. `adminAddPlayer`/`removePlayer` (lib/roster.ts) read tournament.state, then
-- write roster_entry in a SEPARATE statement; `enrollSelf` has no state check at all. Between the read
-- and the write, a bracket generation can commit — and the player joins a roster that is already drawn.
-- `supabase-js` cannot express a correlated `WHERE EXISTS (SELECT 1 FROM tournament …)` on a
-- roster_entry write, so the guard cannot live in the query. It lives here, and it covers ALL THREE
-- write paths at once with no route or lib changes.
--
-- WHY `FOR KEY SHARE` AND NOT A BARE READ. A bare `SELECT state` would still be a TOCTOU: it could read
-- 'registration_closed' a microsecond before generation commits. `FOR KEY SHARE` CONFLICTS with the
-- `FOR UPDATE` that generate_bracket holds on the same tournament row, so a roster write that races an
-- in-flight generation BLOCKS on it, and (under READ COMMITTED, via EvalPlanQual) re-reads the row it
-- was waiting on — now committed as 'bracket_live' — and is rejected. The window is genuinely closed,
-- not merely narrowed. When generate_bracket calls this trigger itself (it updates bracket_seed), it
-- already holds FOR UPDATE on that row: a transaction never blocks on its own lock, so this is a no-op.
--
-- WHY A TRIGGER AND NOT RLS/A GRANT: service_role has BYPASSRLS, so no policy can stop the privileged
-- writer — but BYPASSRLS does NOT skip triggers. This bites the single writer too, which is the point.

-- The predicate itself, factored out so the trigger can apply it to BOTH ends of a tournament move.
-- SECURITY INVOKER + fail-closed: if the caller cannot see the tournament row at all, v_state is NULL
-- and we REJECT. Failing closed on an unreadable parent is the safe direction (the alternative, SECURITY
-- DEFINER, would add a privilege-escalation surface for no benefit). The two real callers — service_role
-- and postgres — both hold SELECT+UPDATE on tournament (0002), which `FOR KEY SHARE` requires;
-- anon/authenticated hold no roster_entry write grant, so this trigger is unreachable for them anyway.
create function public.roster_entry_assert_mutable(p_tournament_id bigint) returns void
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_state text;
begin
  select t.state
    into v_state
    from public.tournament t
   where t.id = p_tournament_id
     for key share;   -- conflicts with generate_bracket's FOR UPDATE => a racing write blocks, then loses

  if v_state is null then
    -- The parent is either absent or invisible to this caller, and we cannot tell which. Absent is the
    -- FK's business and it would raise 23503 momentarily anyway — but INVISIBLE is ours: RI checks run
    -- with the constraint owner's rights and BYPASS RLS, so a row this caller cannot see would still
    -- satisfy the FK and slip a roster write past the lock entirely. Fail closed, under the FK's own
    -- SQLSTATE so the two indistinguishable cases report identically.
    raise exception 'roster_entry: tournament % does not exist or is not readable', p_tournament_id
      using errcode = '23503';
  end if;

  if v_state not in ('registration_open', 'registration_closed') then
    raise exception
      'roster_entry: tournament % is locked (state=%) — the roster freezes once the bracket is generated',
      p_tournament_id, v_state
      using errcode = 'P0001', hint = 'Roll the bracket back before changing the roster.';
  end if;
end;
$$;

create function public.roster_entry_lock_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  -- STAY IN OUR LANE. A BEFORE ROW trigger runs BEFORE the NOT NULL / CHECK / FK constraints, so it can
  -- MASK them: guarding a NULL tournament_id here would report "no such tournament" for what is really a
  -- NOT NULL violation, and the caller would get the wrong SQLSTATE (23503 instead of 23502). Nullability
  -- is the column constraint's job. Short-circuit and let it speak. (Caught by 0004_roster_test test 10.)
  if new.tournament_id is null then
    return new;
  end if;

  -- BOTH ENDS OF A MOVE. Checking only NEW would let a seeded entry be moved OUT of a frozen roster into
  -- a still-open event: NEW's tournament is mutable, so the guard would pass — while the live bracket's
  -- match rows still reference that entry by id. The origin must be mutable too.
  if tg_op = 'UPDATE' and old.tournament_id is distinct from new.tournament_id then
    perform public.roster_entry_assert_mutable(old.tournament_id);
  end if;

  perform public.roster_entry_assert_mutable(new.tournament_id);

  return new;
end;
$$;

-- INSERT OR UPDATE only — deliberately NOT DELETE. Roster removal is a soft-delete (an UPDATE to
-- status='removed', which IS covered); a hard DELETE is impossible anyway (0004 grants no DELETE), and
-- a tournament CASCADE delete must stay able to reap its roster rows.
create trigger roster_entry_lock
  before insert or update on public.roster_entry
  for each row execute function public.roster_entry_lock_guard();

-- ════════════════════════════════════════════════════════════════════════════
-- (a) D2 — generate_bracket: the atomic admin transaction.
-- ════════════════════════════════════════════════════════════════════════════
--
-- SPLIT OF LABOUR: TypeScript COMPUTES (lib/bracket/generate.ts — the double-elim routing, exhaustively
-- unit-tested), this function PERSISTS. It is deliberately thin: it re-validates every precondition
-- under the lock and writes. It does not re-derive the bracket, so there is no second implementation of
-- the routing to drift out of sync — but "thin" is NOT "trusting": the caller's payload is checked for
-- shape and size before a single row is written (see steps 4-5). The DB is the authority, not the caller.
--
-- REFUSALS ARE RETURNED, NOT RAISED. Every expected outcome (wrong state, stale roster, bad field size,
-- malformed payload) returns a typed `{ok:false, reason}` the route maps to an HTTP status — the repo's
-- typed-refusal-union convention (lib/roster.ts). Crucially, EVERY guard runs BEFORE ANY WRITE, so a
-- refusal commits nothing. Only a genuine infrastructure fault raises, and that aborts the whole
-- transaction — never a half bracket.
create function public.generate_bracket(
  p_tournament_id   bigint,
  p_actor_steamid64 text,
  p_bracket_seed    jsonb,   -- the RAW draw (algorithm + permutation), recorded in the audit detail (AD-17)
  p_seeds           jsonb,   -- [{"roster_entry_id":123,"seed":1}, …] — the positions 1..N
  p_matches         jsonb    -- the COMPLETE skeleton: winners + losers + the one grand_final row
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

  -- 2. SINGLE-SHOT (D2). A second generate on a live bracket is REFUSED, never duplicated. Checked
  --    before the generic state check so the caller gets the precise reason ("already done", which is
  --    retry-safe information) rather than a vague "wrong state".
  if v_state = 'bracket_live' then
    return jsonb_build_object('ok', false, 'reason', 'already_live');
  end if;
  if v_state <> 'registration_closed' then
    return jsonb_build_object('ok', false, 'reason', 'not_closed', 'state', v_state);
  end if;

  -- 2b. A tournament that is still 'registration_closed' but ALREADY holds match rows is a corrupt
  --     state no legitimate path produces (a future rollback story could). The state flag alone is a
  --     weak single-shot key; the rows themselves are the strong one. Refuse cleanly rather than let
  --     step 6 abort on match_slot_uniq (23505), which would surface as an untyped 500.
  if exists (select 1 from public.match m where m.tournament_id = p_tournament_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_live');
  end if;

  -- 3. OPTIMISTIC CONCURRENCY. The caller generated from a roster it read BEFORE this lock existed. Under
  --    the lock, assert the active roster is STILL exactly the set that was seeded. If an add/remove
  --    slipped in between, the computed bracket is stale — refuse rather than commit a bracket that does
  --    not match the field. (Checked BEFORE the field-count guard: a mismatched input makes any statement
  --    about that input untrustworthy, so "your view is stale, re-read" is the logically prior answer.)
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

  -- 4. FIELD BOUNDS (AC1). The lib enforces this too, so this is only reachable by a DIRECT RPC call
  --    (bypassing the route) — which is exactly why it is here: the DB is the authority, not the caller.
  v_field := coalesce(array_length(v_actual_ids, 1), 0);
  if v_field < 8 or v_field > 16 then
    return jsonb_build_object('ok', false, 'reason', 'bad_field_count', 'field_size', v_field);
  end if;

  -- 5. THE PAYLOAD IS NOT TRUSTED. Both arrays are caller-supplied and, until here, entirely unchecked.
  --
  --    5a. p_seeds must be a PERMUTATION of 1..N. Step 3 compared only the id SET; the `seed` values
  --        themselves were never looked at, and they are written straight into roster_entry.bracket_seed
  --        (which carries no CHECK and no UNIQUE). Without this, a payload with duplicate seeds, an
  --        omitted `seed` key (-> every bracket_seed NULL), or out-of-range positions would pass every
  --        guard and COMMIT — silently voiding AC1's "the positions are the reproducible artifact".
  select coalesce(array_agg((e->>'seed')::int order by (e->>'seed')::int), '{}')
    into v_positions
    from jsonb_array_elements(p_seeds) as e;

  if v_positions is distinct from (select array_agg(g order by g) from generate_series(1, v_field) as g) then
    return jsonb_build_object('ok', false, 'reason', 'bad_seeds');
  end if;

  --    5b. p_matches must be the COMPLETE skeleton for this field. A double-elim bracket of size B has
  --        B-1 winners + B-2 losers + 1 grand-final = 2B-2 rows, where B is the next power of two >= N.
  --        Without this, `p_matches = '[]'` inserts nothing, step 7 still flips the state to
  --        'bracket_live', step 8 still audits, and the function returns ok:true — leaving a live
  --        tournament with NO bracket, a roster frozen by the D3 trigger, a retry refused as
  --        already_live, and no DELETE grant on `match` to clean up. Unrecoverable. The UNIQUE index is
  --        NOT a backstop for this: it catches duplicate slots, never OMITTED ones.
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

  -- 6. Record the draw: each active entry's seed POSITION 1..N (AC1). This is the reproducible artifact
  --    — the whole bracket is a pure function of these positions.
  --
  --    ⚠ ORDERING IS LOAD-BEARING: this UPDATE fires the D3 roster-lock trigger, which rejects roster
  --    writes once state='bracket_live'. It therefore MUST run BEFORE step 8 flips the state. Moving the
  --    flip earlier would make generation reject its own seeding. (The trigger's FOR KEY SHARE on the
  --    tournament row is a no-op here: this transaction already holds FOR UPDATE on it from step 1.)
  update public.roster_entry r
     set bracket_seed = s.seed
    from (
      select (e->>'roster_entry_id')::bigint as id,
             (e->>'seed')::int               as seed
        from jsonb_array_elements(p_seeds) as e
    ) s
   where r.id = s.id
     and r.tournament_id = p_tournament_id;

  -- 7. The bracket itself: every row at once (AC2/AC3). A NULL gf_order for non-GF rows and NULL
  --    competitor slots for everything Story 4.3 will fill both fall out of ->> returning SQL NULL on a
  --    JSON null. The table's CHECKs + UNIQUE index reject a malformed row; the count check above (5b)
  --    rejects a short one.
  insert into public.match (
    tournament_id, bracket, bracket_position, bracket_slot, gf_order,
    competitor_a, competitor_b, winner_entry, state
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
    m->>'state'
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

  -- 9. The audit row, INSIDE the transaction (AD-17). This is a strict improvement on lib/roster.ts's
  --    writeAudit, which necessarily runs AFTER its primary write (safe only because that write is
  --    idempotent). Here the audit cannot survive a rolled-back bracket, nor go missing from a committed
  --    one. `action` needs no migration — audit_log.action is uncapped text (0003).
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

-- ── EXECUTE grants — the RPC is service-role-only (AD-8) ─────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC — so
-- without this REVOKE the function would be callable straight off the Data API by any visitor. It is
-- SECURITY INVOKER (a viewer would 42501 at the first write anyway), but a defence that depends on a
-- later grant check is not a defence: revoke first, then grant to the single writer. The route's
-- `requireAdmin` is the authorization gate; this is the second lock on the same door.
revoke execute on function public.generate_bracket(bigint, text, jsonb, jsonb, jsonb) from public;
grant  execute on function public.generate_bracket(bigint, text, jsonb, jsonb, jsonb) to service_role;

-- The lock predicate is an internal helper of the trigger, not an API. The trigger runs as the invoking
-- role, so the role must be able to execute it — but nothing should be able to CALL it directly off the
-- Data API. Revoke PUBLIC, grant only the roles that actually write roster_entry.
revoke execute on function public.roster_entry_assert_mutable(bigint) from public;
grant  execute on function public.roster_entry_assert_mutable(bigint) to service_role;
