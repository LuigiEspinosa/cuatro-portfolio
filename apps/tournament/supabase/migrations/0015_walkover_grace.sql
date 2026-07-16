-- supabase/migrations/0015_walkover_grace.sql
-- Logical migration 0015 — bye/forfeit walkover with a server-enforced grace timer (Story 4.5, AC1/AC2/AC3).
--
-- ONE migration because it is ONE concern: the NO-SHOW FORFEIT path (a determined matchup where one player
-- is physically absent) and the AD-23 guard that makes a committed bye/forfeit/void the single arbiter.
--
-- ⭐ WHAT THIS STORY DOES NOT BUILD. The BYE half of AC1 already ships end-to-end: 4.1 seats + pre-advances
-- Winners-R1 structural byes (generate.ts), 4.3's cascade walks Losers `bye` nodes straight through, and
-- advance_match ALREADY accepts `state in ('bye','forfeit',…)` as advanceable and drops the loser uniformly
-- (0014:417,430). There is NO reachable stat-write path for a bye (stats come ONLY from the worker's demo
-- parse; a bye has no demo). So AC1's bye path is a PROOF obligation (see the pgTAP), not new code, and
-- advance_match / generate_bracket are NOT touched here.
--
-- WHAT IT DOES BUILD:
--   (a) DECISION A — `tournament.grace_period_seconds` (default 600 = 10 min, per-tournament configurable,
--       FR-9 "Admin-configurable"; SPINE:471 "grace timer … tournament config").
--   (b) DECISION B — `match.awaiting_grace_since`: the server grace clock, stamped when a match enters
--       `awaiting_grace`. The forfeit gate reads `now() >= awaiting_grace_since + grace_period_seconds` —
--       server-enforced, NEVER client-trusted. (The EXPERIENCE MM:SS countdown, Epic 5, renders this stamp.)
--   (c) AC3 — `match_terminal_state_guard` (BEFORE UPDATE): once `state in ('bye','forfeit','void')` the STATE
--       is TERMINAL (AD-23), so a later Aprobar/demo (4.6) physically cannot flip it to a stats-bearing state.
--       "Resolved and Forfeit cannot coexist" becomes true BY CONSTRUCTION.
--   (d) AC2 — `begin_match_grace` (declared -> awaiting_grace) + `resume_match` (awaiting_grace -> DECLARED,
--       DECISION C) + `mark_walkover` (awaiting_grace -> forfeit; server grace gate; forfeit = a NORMAL
--       double-elim loss routed through advance_match UNCHANGED, DECISION F). Plus their service-role grants.
--       ALL THREE are audited (AD-17): `begin_grace` / `resume_match` / `mark_walkover` — DECISION E was
--       overruled at code review (2026-07-15), so the whole no-show episode has a who + when, not just its
--       terminal forfeit.
--
-- ⭐⭐ THE LOAD-BEARING HAND-OFF (three prior code reviews flagged Story 4.5 BY NAME, deferred-work.md:137).
-- `mark_walkover` writes `state='forfeit' + winner_entry` then CALLS advance_match in the SAME transaction.
-- advance_match RETURNS `{ok:false, reason:'slot_taken'}` (it does not raise) when a destination seat is held
-- by a different player — and if `mark_walkover` committed anyway, the result is a forfeit with NO advance:
-- the exact partial state the two-pass design exists to prevent. So `mark_walkover` RAISES on `{ok:false}`,
-- rolling the whole forfeit back. Do NOT change advance_match's RETURN contract (4.6 relies on it).
--
-- DECISION D — 4.5's trigger + RPC raises use DISTINCT custom SQLSTATEs, NEVER bare `P0001`:
--   * IC901 — the AD-23 terminal-state guard (a flip out of a terminal state was refused).
--   * IC902 — mark_walkover's advance-refused rollback (advance_match returned {ok:false}).
-- lib/match/format.ts maps ANY `P0001` from its RPC to `already_locked` (deferred-work.md:127); a second
-- `match` trigger raising `P0001` would be exactly that ambiguity. Distinct codes keep format.ts unambiguous
-- and let lib/match/walkover.ts classify these refusals precisely.
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * `audit_log.action = 'mark_walkover'` needs NO migration — `action` is uncapped text and the string is
--     already the enumerated vocabulary (0003:25, AD-17), exactly like `advance`/`declare_format`. The same
--     holds for `begin_grace`/`resume_match` (added at code review — DECISION E overruled), which EXTEND that
--     vocabulary: `action` carries no CHECK, so 0003:25's list is documentation, not a constraint.
--   * NO `declared -> live` / `live` / `pending` transition (still unowned; 4.6 / Epic-5). `resume_match`
--     goes to `declared` (DECISION C), so 4.5 never lands a "played" state, never trips
--     `match_live_requires_locked_format`, and does NOT inherit the 23514 "declare the format first" map.
--   * NO changes to advance_match / generate_bracket / the format lock CHECKs. The forfeit is a normal loss
--     (DECISION F); `match_live_requires_locked_format` (0012:117-126) ALREADY excludes forfeit/awaiting_grace
--     by name — verified, not re-touched.
--   * NO Aprobar / demo-derived score / demo->match binding (4.6). 4.5 installs + proves the terminal guard
--     the 4.6 binding will hit; the "a late demo is archived but never flips" round-trip is 4.6's.
--   * NO rollback / un-advance (4.7). The terminal guard binds the FLIP; a legitimate exit from a terminal
--     state needs 4.7's audited-override seam — flagged, not built (same shape as deferred-work.md:136).
--   * NO UI / i18n / MM:SS countdown / leaderboard normalization (Epic 5) — this migration ships only DATA.
--   * NO shared command-route helper / central SQLSTATE map (4.9), NO CSRF (Epic 7). advance_match's five
--     bare P0001 raises stay put (4.9's job) — 4.5 only owes its OWN raises a distinct code.
--   * A DOUBLE no-show (BOTH players absent) is UNHANDLED here — the AC covers "one player absent". A
--     void-a-match / double-forfeit path is a future story / an admin manual-resolve (DECISION F).
--
-- ⚠ CLEAN-APPLY NOTE. Unlike 0013, everything added here is safe on a DB that already holds a bracket: two
-- columns with a default / nullable, and a trigger that fires ONLY on a state-change OUT of a terminal value
-- (so it cannot retroactively fail any existing row). No 0013-style backfill trap.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) DECISION A — the grace period, per tournament.
-- ════════════════════════════════════════════════════════════════════════════
-- 600 = 10 minutes (AD-9 default). Per-tournament so FR-9's "Admin-configurable" needs no migration per
-- change; `> 0` because a zero/negative grace would make the forfeit gate a no-op. Existing tournament
-- INSERTs are unaffected — the column defaults.
alter table public.tournament
  add column grace_period_seconds int not null default 600 check (grace_period_seconds > 0);
comment on column public.tournament.grace_period_seconds is
  'AD-9 grace timer: seconds a no-show match sits in awaiting_grace before an admin may mark W.O. Default 600 (10 min), per-tournament configurable (FR-9). Read live by mark_walkover''s server-side elapsed gate.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) DECISION B — the grace clock, on the match.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.match add column awaiting_grace_since timestamptz;
comment on column public.match.awaiting_grace_since is
  'AD-9 grace clock: when the no-show grace period started (stamped now() on entering awaiting_grace, cleared on resume). mark_walkover''s elapsed check is now() >= awaiting_grace_since + grace_period_seconds — server-enforced, NEVER client-trusted. The Epic-5 MM:SS countdown renders this stamp.';

-- ════════════════════════════════════════════════════════════════════════════
-- (c) AC3 — the AD-23 terminal-state guard. A committed bye/forfeit/void is the single arbiter.
-- ════════════════════════════════════════════════════════════════════════════
-- Once `state in ('bye','forfeit','void')` the STATE is terminal (SPINE lifecycle: `Bye -> [*]`,
-- `Forfeit -> [*]`; `void` is never played). This trigger REJECTS any UPDATE that changes `state` OUT of a
-- terminal value — so a later Aprobar (4.6) physically cannot flip a committed forfeit/bye to
-- resolved/pending. AD-23's "Resolved and Forfeit cannot coexist; the match row is the single arbiter and
-- its transition guards prevent two writers landing both" becomes true BY CONSTRUCTION.
--
-- ⚠ FIRE ONLY ON A STATE CHANGE OUT OF TERMINAL. `match_place_competitor` UPDATEs a `bye` DESTINATION row
-- (it seats competitor_* + winner_entry while `state` STAYS 'bye') during 4.3's walkover cascade — that write
-- MUST pass. `new.state is distinct from old.state` is the discriminator: a walkover seat leaves `state`
-- unchanged and is allowed; only a TRANSITION AWAY FROM terminal is rejected. (Same shape as 0012's
-- format-latch guard: bind the transition out of the frozen state, not every write while in it.)
--
-- ⚠ DISTINCT SQLSTATE (DECISION D): IC901, never bare P0001 — keeps lib/match/format.ts's P0001 mapping
-- unambiguous and lets lib/match/walkover.ts classify this refusal as a typed `terminal`.
--
-- Note for the reviewer + deferred-work.md: like 0013's competitor-write item (deferred-work.md:136), this
-- guard binds the FLIP, but Story 4.7 (rollback / un-advance) will need an audited-override seam to
-- legitimately leave a terminal state. Flag; do NOT build it now.
create function public.match_terminal_state_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if old.state in ('bye', 'forfeit', 'void') and new.state is distinct from old.state then
    raise exception
      'match %: state % is TERMINAL (AD-23) — a committed bye/forfeit/void is the single arbiter and cannot be flipped by a later demo/result', old.id, old.state
      using errcode = 'IC901',
            hint = 'A late demo for a committed forfeit/bye is archived for evidence (AD-1) but never changes the match. Un-advancing a terminal row is Story 4.7 (an audited override).';
  end if;
  return new;
end;
$$;

create trigger match_terminal_state_guard
  before update on public.match
  for each row execute function public.match_terminal_state_guard();

-- No REVOKE: a `returns trigger` function cannot be invoked as a normal call and PostgREST does not expose
-- it, so PUBLIC's default EXECUTE is not a reachable surface (same posture as 0012's guard functions).

-- ════════════════════════════════════════════════════════════════════════════
-- (d1) AC2 — begin_match_grace: declared -> awaiting_grace, stamp the clock.
-- ════════════════════════════════════════════════════════════════════════════
-- Typed refusals RETURNED (the 0011/0012 convention), every guard BEFORE the write. Single-row FOR UPDATE
-- only — it takes exactly ONE lock and waits for nothing else, so it cannot form a cycle with advance_match's
-- ordered whole-bracket lock (a deadlock needs each party to hold one lock and want another).
--
-- ⭐ AUDITED (DECISION E OVERRULED at code review 2026-07-15). This RPC was originally un-audited on the
-- reasoning that FR-9 mandates logging only the forfeit and that a grace start is a reversible non-result.
-- Overruled by Cuatro: the grace clock IS the countdown to a forfeit, so who started it — and when — is
-- logged. Needs NO migration: `audit_log.action` is uncapped `text` with NO CHECK (0003:25 is a DOCUMENTATION
-- comment listing the vocabulary, not a constraint), so `begin_grace`/`resume_match` EXTEND that vocabulary
-- exactly the way `mark_walkover` reuses it. ⚠ 0003:25's comment does not list these two — it is the
-- canonical vocabulary note and is now one migration stale; do not read it as exhaustive.
create function public.begin_match_grace(
  p_match_id        bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17); see DECISION E above
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m     record;
  v_grace int;
begin
  select m.id, m.tournament_id, m.state, m.competitor_a, m.competitor_b
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- Only a `declared` match can enter the grace clock. A re-call on an already-`awaiting_grace` match is a
  -- typed refusal here (NOT a silent re-stamp — re-stamping would RESET the clock, a foot-gun), and a
  -- played/terminal match is refused too. (DECISION E's idempotency stance: refuse, do not re-stamp.)
  if v_m.state <> 'declared' then
    return jsonb_build_object('ok', false, 'reason', 'not_startable', 'state', v_m.state);
  end if;

  -- A grace timer is for a DETERMINED matchup with one absentee — not an unfilled slot (that shape is a
  -- structural `bye`, already handled by generation/advance).
  if v_m.competitor_a is null or v_m.competitor_b is null then
    return jsonb_build_object('ok', false, 'reason', 'not_ready');
  end if;

  update public.match
     set state                = 'awaiting_grace',
         awaiting_grace_since = now()
   where id = p_match_id;

  -- THE AUDIT ROW (AD-17, DECISION E as overruled). The "who" is p_actor_steamid64, the "when" is
  -- occurred_at's now() default; the detail records the deadline the admin implied by starting the clock
  -- (the stamp + the period LIVE at start), so the row is self-describing even if the tournament's
  -- grace_period_seconds is reconfigured later. `now()` is transaction-stable, so this stamp is exactly the
  -- one written to the match above.
  select t.grace_period_seconds into v_grace
    from public.tournament t
   where t.id = v_m.tournament_id;

  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'begin_grace',
    p_match_id,
    jsonb_build_object(
      'awaiting_grace_since', now(),
      'grace_period_seconds', v_grace
    )
  );

  return jsonb_build_object('ok', true, 'match_id', p_match_id, 'awaiting_grace_since', now());
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- (d2) AC2 — resume_match: awaiting_grace -> DECLARED (DECISION C), clear the clock.
-- ════════════════════════════════════════════════════════════════════════════
-- The absent player arrived: return the match to its well-defined pre-grace `declared` state — NOT `live`.
-- 4.5 deliberately does NOT claim the unowned `declared -> live` transition (4.2 flagged it) nor its 23514
-- obligation; the normal Declared -> Live -> Pending -> Resolved path is Epic-5 / 4.6. AUDITED (DECISION E
-- OVERRULED at code review 2026-07-15 — see begin_match_grace's header for the reasoning + the `action`
-- vocabulary note). Single-row lock (see begin_match_grace).
create function public.resume_match(
  p_match_id        bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17); see DECISION E above
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m record;
begin
  select m.id, m.tournament_id, m.state, m.awaiting_grace_since
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  if v_m.state <> 'awaiting_grace' then
    return jsonb_build_object('ok', false, 'reason', 'not_awaiting', 'state', v_m.state);
  end if;

  -- awaiting_grace -> declared is allowed by match_terminal_state_guard (awaiting_grace is NOT terminal).
  update public.match
     set state                = 'declared',
         awaiting_grace_since = null
   where id = p_match_id;

  -- THE AUDIT ROW (AD-17, DECISION E as overruled). Read v_m.awaiting_grace_since BEFORE the UPDATE nulls it
  -- (it is already in v_m, captured under the lock) so the row records how long the field actually waited —
  -- the pair (grace_started_at, occurred_at) is the whole no-show episode.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'resume_match',
    p_match_id,
    jsonb_build_object('grace_started_at', v_m.awaiting_grace_since)
  );

  return jsonb_build_object('ok', true, 'match_id', p_match_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- (d3) AC1/AC2/AC3 — mark_walkover: the forfeit.
-- ════════════════════════════════════════════════════════════════════════════
-- awaiting_grace -> forfeit; seat the PRESENT player as winner; advance (via advance_match, UNCHANGED);
-- audit. The forfeit is a NORMAL double-elim loss (DECISION F): the present player wins, the absent player
-- drops via the standard loser edge (Winners no-show keeps their Losers life; a Losers no-show is eliminated
-- — the two-loss rule, derived from edges). So advance_match needs ZERO changes and emits the SOLE
-- `bracket.advanced` broadcast (AD-11 — do NOT add a second emitter).
--
-- ⚠⚠ LOCK ORDER — READ BEFORE CHANGING. This RPC WRITES the source row (state='forfeit') and THEN calls
-- advance_match, which locks the WHOLE bracket in canonical id order. If we wrote the source first, we would
-- lock that one row OUT of canonical order and could deadlock a concurrent advance_match (the exact 4.3
-- deadlock). So mark_walkover takes the SAME ordered whole-bracket lock advance_match takes, UP FRONT, before
-- its first write. Both operations then acquire the bracket in the same order and can queue but never form a
-- cycle. advance_match re-taking those locks later is a no-op (already held, same transaction).
create function public.mark_walkover(
  p_match_id        bigint,
  p_actor_steamid64 text,
  p_winner_entry    bigint
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tid      bigint;
  v_m        record;
  v_grace    int;
  v_deadline timestamptz;
  v_loser    bigint;
  v_adv      jsonb;
begin
  -- ══ 1. WHICH BRACKET? An UNLOCKED peek that learns exactly one thing: the tournament. It must not lock,
  --    because the very next statement takes every lock in canonical order (0014:382-390). `match` has NO
  --    DELETE grant, so the row cannot vanish between this read and the lock.
  select m.tournament_id into v_tid from public.match m where m.id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 1b. EVERY LOCK, IN ONE STATEMENT, IN CANONICAL (id) ORDER — mirrors advance_match (0014:392-400).
  --    This is what keeps mark_walkover's pre-advance write from deadlocking a concurrent advance.
  perform 1
     from public.match m
    where m.tournament_id = v_tid
    order by m.id
      for update;

  -- ══ 1c. Now read the source under the lock; its state cannot move under us.
  select m.id, m.tournament_id, m.state, m.competitor_a, m.competitor_b, m.awaiting_grace_since
    into v_m
    from public.match m
   where m.id = p_match_id;

  -- ══ 2. GUARDS — all of them before any write (0012 convention).

  -- You may only forfeit a match ON the grace clock. A `declared` match must go through begin_match_grace
  -- first — this is what makes the timer UN-BYPASSABLE (you cannot forfeit a match that never started its
  -- grace period).
  if v_m.state <> 'awaiting_grace' then
    return jsonb_build_object('ok', false, 'reason', 'not_awaiting', 'state', v_m.state);
  end if;

  -- ══ 2b. THE GRACE GATE (AC2) — the "only after the grace timer elapses" teeth, server-side, reading the
  --    tournament's configured period LIVE (DECISION B). BOTH inputs are non-NULL here by construction
  --    (begin_match_grace stamps the clock on entry and resume_match clears it WITH the state;
  --    grace_period_seconds is NOT NULL DEFAULT 600 behind a NOT NULL tournament_id FK) — but guard BOTH
  --    anyway, symmetrically: a NULL on EITHER side makes v_deadline NULL, and `now() < NULL` is NULL, not
  --    true, so the gate would fail OPEN rather than closed. (Code review 2026-07-15: the v_grace half of
  --    this guard was missing — the reasoning below applied to only one of the two NULL sources.)
  select t.grace_period_seconds into v_grace
    from public.tournament t
   where t.id = v_m.tournament_id;

  if v_m.awaiting_grace_since is null or v_grace is null then
    -- Unreachable in a well-formed lifecycle; fail closed rather than skip the gate.
    return jsonb_build_object('ok', false, 'reason', 'grace_active');
  end if;

  v_deadline := v_m.awaiting_grace_since + make_interval(secs => v_grace);
  if now() < v_deadline then
    return jsonb_build_object('ok', false, 'reason', 'grace_active', 'grace_ends_at', v_deadline);
  end if;

  -- ══ 2c. THE WINNER must be one of this match's two seated competitors (the PRESENT player). The loser (the
  --    absent player) is the OTHER competitor — computed exactly as advance_match does (0014:430).
  if p_winner_entry is null
     or (p_winner_entry is distinct from v_m.competitor_a
         and p_winner_entry is distinct from v_m.competitor_b) then
    return jsonb_build_object('ok', false, 'reason', 'bad_winner');
  end if;

  v_loser := case when v_m.competitor_a = p_winner_entry then v_m.competitor_b else v_m.competitor_a end;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 3. Seat the present player as winner and land the terminal forfeit state.
  --    match_terminal_state_guard ALLOWS awaiting_grace -> forfeit (awaiting_grace is not terminal); it only
  --    blocks LEAVING a terminal state. match_winner_is_competitor (0010:94-98) is satisfied — both seats are
  --    filled and the winner is one of them. The format lock does NOT bite: 'forfeit' is excluded from
  --    match_live_requires_locked_format (0012:118), and this UPDATE touches no format column so
  --    match_format_audited does not fire.
  update public.match
     set state        = 'forfeit',
         winner_entry = p_winner_entry
   where id = p_match_id;

  -- ══ 4. ADVANCE — routes the present winner forward and drops the absent loser (D2), and emits the SOLE
  --    bracket.advanced broadcast (AD-11). advance_match re-locks the already-held bracket rows (no-op) and
  --    RETURNS a typed refusal rather than raising.
  v_adv := public.advance_match(p_match_id, p_actor_steamid64);

  -- ══ 5. ⭐ HONOR {ok:false} — THE 4.3 HAND-OFF (deferred-work.md:137). A refused advance (e.g. slot_taken:
  --    the present winner's destination seat is held by a DIFFERENT player) RAISES here, rolling the WHOLE
  --    forfeit back. A forfeit that did not advance must never commit — that partial state is exactly what
  --    the two-pass design exists to prevent. Distinct SQLSTATE IC902 (DECISION D) so the lib classifies it.
  --    Do NOT change advance_match to raise instead — 4.6 depends on its RETURN semantics.
  if not coalesce((v_adv->>'ok')::boolean, false) then
    raise exception
      'mark_walkover: forfeit advance refused (%) — rolled back so a forfeit is never committed without its advance (AD-8)', coalesce(v_adv->>'reason', 'unknown')
      using errcode = 'IC902',
            hint = 'The present winner''s destination seat is held by a different player. Un-routing it is Story 4.7 (rollback); until then the forfeit cannot commit.';
  end if;

  -- ══ 6. THE AUDIT ROW (AD-17, FR-9 "logged who + when"). `action='mark_walkover'` needs NO migration — it
  --    is already the enumerated vocabulary (0003:25). `occurred_at` (the "when") defaults to now(); the
  --    actor (the "who") is p_actor_steamid64. A forfeit therefore writes TWO audit rows — this one +
  --    advance_match's `advance` row — two distinct admin consequences.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'mark_walkover',
    p_match_id,
    jsonb_build_object(
      'winner_entry',         p_winner_entry,
      'forfeiting_entry',     v_loser,
      'grace_started_at',     v_m.awaiting_grace_since,
      'grace_period_seconds', v_grace
    )
  );

  return jsonb_build_object(
    'ok',               true,
    'forfeiting_entry', v_loser,
    'winner_entry',     p_winner_entry,
    'advanced',         v_adv->'advanced',
    'champion',         v_adv->'champion'
  );
end;
$$;

-- ── EXECUTE grants — the three RPCs are service-role-only (AD-8) ─────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so
-- without this REVOKE these would be callable straight off the Data API. They are SECURITY INVOKER (a viewer
-- would 42501 at the first write anyway), but a defence that depends on a later grant check is not a defence:
-- revoke first, then grant to the single writer. The route's requireAdmin is the authorization gate; this is
-- the second lock on the same door (0012:480-487).
revoke execute on function public.begin_match_grace(bigint, text)         from public;
grant  execute on function public.begin_match_grace(bigint, text)         to service_role;
revoke execute on function public.resume_match(bigint, text)              from public;
grant  execute on function public.resume_match(bigint, text)              to service_role;
revoke execute on function public.mark_walkover(bigint, text, bigint)     from public;
grant  execute on function public.mark_walkover(bigint, text, bigint)     to service_role;
