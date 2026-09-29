-- supabase/migrations/0016_bind_and_score.sql
-- Logical migration 0016 — bind a parsed demo to the match it decided + carry the demo-derived score
-- (Story 4.6a, AC1/AC2/AC3).
--
-- ONE migration because it is ONE concern: making the demo and the match know about each other. The score
-- rides along because it is the same fact — a demo's round tally is only a MATCH score once the demo is bound
-- to a match.
--
-- ⭐ WHAT THIS CLOSES. `match.demo_id` (0010:70), `demo.match_id` (0010:168) and `stat_row.match_id`
-- (0010:178) have existed since 0010, nullable and FK'd, NULL on every row, each commented with "Story 4.6
-- binds it" BY NAME. Nothing in this codebase could put a match into `pending`, and nothing could tell a demo
-- which match it belonged to. Those were the same gap. This closes it.
--
-- WHAT IT BUILDS:
--   (a) AC1 — `stat_row.rounds_won`: the per-player demo-derived round tally (FR-16). The Go worker writes it
--       on every parse/re-parse (worker/ingest/parse.go's events.RoundEnd handler).
--       ⚠ PER-PLAYER, NOT score_a/score_b — DECISION B. `a`/`b` name the MATCH's competitor seats and the
--       worker cannot resolve them: at parse time NO bracket row is associated with the demo at all (the
--       bind below is a later admin act), it holds only the EXTERNAL matchzy_match_id, and competitor_a is a
--       roster_entry_id reachable only through the bracket. AD-2 agrees but does not do this work on its own
--       — it governs who WRITES, not what the worker KNOWS (the "match-agnostic BY AD-2 DESIGN" shorthand
--       was corrected at the 2026-07-16 code review; the decision stands, its citation was overstated).
--       Story 4.6b maps the tally onto the seats inside the
--       Aprobar transaction, where the bracket knowledge lives (SOLUTION-DESIGN:373 puts the score write
--       there anyway). It is also the only shape that satisfies the UX: the admin "eyeballs the derived
--       score" in the ingest queue BEFORE approving (EXPERIENCE.md:44,209) — a score computed only inside
--       Aprobar could never be seen before Aprobar.
--   (b) AC2/AC3 — `bind_match_demo(match, demo, actor)`: the three-way binding 0010 assigns here by name, and
--       the `Declared|Live -> Pending` transition. Typed refusals RETURNED (the 0012 convention), every guard
--       BEFORE any write. Plus its service-role-only EXECUTE grant.
--
-- ⭐ WHY THE BIND IS WHAT LANDS `pending` (DECISION A). The lifecycle's `Live -> Pending` is triggered by
-- "demo parsed" (SPINE:309) — but AD-2 (SPINE:88) forbids the worker touching `match` while explicitly
-- placing "the accept-anomaly and approve decisions (FR-13) … on the app side, never the worker". So the
-- app-side act that REALIZES "demo parsed" is the binding — which 0010:153-155 already assigns to this story.
-- The bind therefore accepts `declared` OR `live`. THE CLINCHER IS STORY 4.7: the lifecycle (SPINE:312) and
-- FR-14 (prd.md:255) both say a rollback returns a match TO `Pending` — so `pending` must be reachable or 4.7
-- has nowhere to land. 4.6a does NOT claim `declared -> live` (still unowned -> the Epic-5 admin console).
--
-- ⚠ CITATIONS INTO deferred-work.md ARE BY ITEM TITLE, NOT BY LINE (code-review fix, 2026-07-16). That file
-- grows at the TOP (newest section first), so every `deferred-work.md:NNN` reference rots on the next story —
-- and this story's own 15-line prepend invalidated the four line numbers this header originally carried
-- (:136 -> :151, :141 -> :156, :109 -> :124, :127 -> :142), in the same commit that wrote them. A migration
-- is immutable once applied, so a line citation inside one cannot ever be corrected. Titles are stable.
--
-- ⭐ THE 23514 MAP, CLOSED AFTER FOUR STORIES (deferred-work.md, "Nothing in TypeScript maps 23514").
-- "Whoever lands `declared -> live`
-- inherits an opaque check_violation … Intended home: 4.5, 4.6, or the Epic-5 admin console." 4.5 declined it
-- (it never lands a played state). 4.6a LANDS `pending`, so it inherits it: `match_live_requires_locked_format`
-- (0012:123-126) refuses `pending` unless `format_locked`. This RPC guards `format_locked` EXPLICITLY and
-- returns a typed `format_not_declared`, so the admin is told "declare the format first" instead of getting a
-- raw 23514 inside a 500. The CHECK remains the backstop; the guard is the UX.
--
-- SQLSTATEs — 4.6a RAISES NOTHING NEW. Every refusal is RETURNED as {ok:false, reason}. The codes this RPC
-- can surface are all raised by code it CALLS or constraints it TRIPS, and each is already owned:
--   * IC901 — 4.5's match_terminal_state_guard (0015:108-126), if a terminal row were ever flipped. Cannot
--     fire through this RPC: `not_bindable` refuses a terminal state first, BY DESIGN (AC2) — the guard is
--     the second lock, not the only one. lib/match/bind.ts maps it to `terminal` anyway (fail-safe, not dead
--     code: 4.7's rollback will add an un-seat path).
--   * 23514 — 0012's match_live_requires_locked_format, mapped to `format_not_declared` (above).
--   ⚠ NEVER a bare P0001 (deferred-work.md, "P0001 is PL/pgSQL's GENERIC exception code") — that code is
--   lib/match/format.ts's, and this RPC raises nothing at all. (⚠ The `:127` this originally cited was
--   never the P0001 item — it is the `score_source_guard` item. The wrong number was inherited from 4.5's
--   note and propagated into four artifacts before the 4.6a review caught it. Another reason to cite titles.)
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * `match.score_a`/`score_b`/`score_source` — Story 4.6b. SOLUTION-DESIGN:373 puts the score write inside
--     the Aprobar transaction, and `score_source_guard` (0010:124-128) FORBIDS a demo_derived score before
--     `demo_id` is set — which is precisely what this migration makes possible. 4.6a persists the DERIVATION
--     (stat_row.rounds_won); 4.6b maps it to the seats and writes the score.
--   * `state='resolved'`, the advance, `timeline_feed`, the Broadcast emit — ALL Story 4.6b.
--   * NO `score_source_guard` tightening and NO AD-23 `IC904` half — both land in 4.6b WITH the writer that
--     can prove them. A guard shipped before its writer is an untested backstop, which is exactly how
--     deferred-work.md's mutation-blindness lesson ("4.3 mutation-tested AC1 and shipped the identical hole
--     on AC2") happens.
--   * NO `declared -> live` (unowned -> Epic-5 console). NO accept-anomaly route (`Anomalous -> Pending`):
--     0008:18-19 assigns it to "Epic 4 … Aprobar = Story 4.6" but NO Epic-4 AC mentions it and 4.9's route
--     list (epics.md:812) omits it — it is ORPHANED between Epic 3 and Epic 4. Logged in deferred-work.md;
--     DECISION H refuses an anomalous demo here rather than silently publishing a held one.
--   * NO rollback / re-point of a bound demo (4.7). NO manual score (4.8). NO shared command-route helper
--     (4.9). NO CSRF (Epic 7). NO Epic-5 stat enrichment — `rounds_won` and nothing else; assists/ADR/HS%/
--     KAST/weird/derived stay NULL shells (0007:41-47).
--   * `audit_log.action = 'bind_demo'` needs NO migration — `action` is uncapped `text` with NO CHECK, so
--     0003:25's list is DOCUMENTATION, not a constraint (the 0015:141-144 precedent, which added
--     `begin_grace`/`resume_match` the same way). 0003 is deliberately UNTOUCHED — never edit an applied
--     migration. ⚠ 0003:25's vocabulary comment is now TWO migrations stale; do not read it as exhaustive.
--
-- ⚠⚠ A REAL BEHAVIOUR CHANGE LANDS WITH THIS MIGRATION, AND IT IS INTENDED (0010:162-166 predicted it BY
-- NAME): `demo.match_id` is ON DELETE RESTRICT. Once a demo is bound to a match, `delete from tournament`
-- starts being REFUSED (23503) — its CASCADE reaches `match`, and RESTRICT fires because nothing cascades
-- `demo`. Tournaments are not deleted in v1, and "evidence outliving the bracket is the point". Nothing to do
-- — but it becomes TRUE the first time this RPC runs, so it is stated here rather than discovered later.
--
-- ⚠ CLEAN-APPLY NOTE (the 0015:65-67 precedent). Everything here is safe on a DB that already holds a
-- bracket: ONE nullable column and ONE new function. No 0013-style backfill trap — there is no existing row
-- this migration can invalidate, because every match/demo/stat_row it touches is NULL on those columns today.
--
-- ⚠ FORWARD-SCOPE NOTE FOR WHOEVER PICKS UP AD-18 (deferred-work.md, "The worker cannot scope its reads to
-- a tournament" / the AD-18 forward-scope item). worker/db/db.go:361-364 flags:
-- "when Epic 4 links match->tournament, scope BOTH this read and the unreconciled_stat_row view to the
-- match's tournament." THIS MIGRATION CREATES THAT LINK (stat_row.match_id -> match.tournament_id). Acting on
-- it is out of scope here (deferred-work.md:109 homes it to Epic 4 generally) — but the link now exists, so
-- the scoping is now BUILDABLE. v1 is single-tournament (AD-18), so nothing is wrong today.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) AC1 — the demo-derived round tally, per player.
-- ════════════════════════════════════════════════════════════════════════════
-- Nullable, like every other stat shell (0007:41-47): a row parsed before this migration has no tally, and
-- NULL says "not derived" rather than lying with a 0. The worker re-derives it on every parse/re-parse.
--
-- It rides the AD-4 `steamid64` key, which is deliberately NOT an FK (SPINE:98, SOLUTION-DESIGN:144): a
-- parsed-but-unrostered id lands in the unreconciled left-join rather than being dropped. Do NOT add an FK.
alter table public.stat_row add column rounds_won int;
comment on column public.stat_row.rounds_won is
  'FR-16 demo-derived score: rounds this player won, tallied from the demo''s events.RoundEnd by the Go worker (the single writer, AD-2). PER-PLAYER by design — Story 4.6b maps it onto match.score_a/score_b via the competitor seats, because the worker is match-agnostic (AD-2) and cannot know which player is competitor_a. NULL = not derived (e.g. parsed before Story 4.6a).';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) AC2/AC3 — bind_match_demo: the three-way binding + Declared|Live -> Pending.
-- ════════════════════════════════════════════════════════════════════════════
-- The demo->match association was an OPEN architectural question deferred to build time (SPINE:469: "a
-- MatchZy-provided match identifier vs admin pre-registration of the slot … decide at build"). This is that
-- moment, and it is decided as an EXPLICIT ADMIN ACTION taking (match_id, demo_id) — DECISION C. There is no
-- automatic join to infer: `matchzy_match_id` is a GAME-SERVER id with no relationship to a bracket node, so
-- no join exists or can exist. The admin already opens the match to eyeball the score (EXPERIENCE:209), so
-- naming the match costs nothing.
--
-- ⚠ LOCK DISCIPLINE — READ BEFORE CHANGING. This takes TWO single-row locks (the match, then the demo) and
-- NOTHING else. It does NOT call advance_match and touches no other bracket row, so it cannot form a cycle
-- with advance_match's ordered whole-bracket lock (a deadlock needs each party to hold one lock and want
-- another; advance_match never wants a `demo` lock). The begin_match_grace precedent (0015:134-136).
--   * DO NOT take the whole-bracket lock here — it is not needed, and 4.6b does need it.
--   * The match-then-demo ORDER matters and is shared with the Go worker's parse transaction, which locks
--     `demo` (stampDemo) before `stat_row` (upsertStatRows) — this RPC also touches demo before stat_row, so
--     a concurrent re-parse and bind queue rather than deadlock.
create function public.bind_match_demo(
  p_match_id        bigint,
  p_demo_id         bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17)
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m     record;
  v_d     record;
  v_stats int;
  v_bound int;
begin
  -- ══ 1. THE MATCH, under a single-row lock (see the lock discipline note above).
  select m.id, m.tournament_id, m.state, m.demo_id, m.format_locked
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 2. THE DEMO, likewise. Locked AFTER the match — always this order.
  select d.id, d.match_id, d.matchzy_match_id, d.validation_state
    into v_d
    from public.demo d
   where d.id = p_demo_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_demo');
  end if;

  -- ══ 3. GUARDS — all of them before any write (the 0012 convention).

  -- ── IDEMPOTENCY, FIRST. This pair is ALREADY bound to each other: the caller's intent is already true, so
  --    report success and write NOTHING. This MUST precede the state guard: a bound match is `pending` (or
  --    `resolved`, once 4.6b approves it), and the state guard below would otherwise refuse a retry of a bind
  --    that already succeeded — turning a dropped HTTP response into a permanent, misleading error.
  --
  --    ⚠ NO SECOND AUDIT ROW, DELIBERATELY (asserted in pgTAP — the story required this be decided, not left
  --    ambiguous). This path performs NO write; it is a no-op confirmation, not an action. A retried request
  --    writing a second `bind_demo` row would assert a second binding that never happened, and audit_log is
  --    append-only (AD-17) — the phantom would be permanent. This is NOT in tension with 4.3's "a replay DOES
  --    write a second audit row": advance_match's replay RE-EXECUTES its idempotent writes (a real, repeated
  --    action), whereas this short-circuits at the guard having changed nothing. `idempotent` is returned so a
  --    caller can tell the two apart.
  if v_m.demo_id = p_demo_id and v_d.match_id = p_match_id then
    return jsonb_build_object('ok', true, 'match_id', p_match_id, 'demo_id', p_demo_id,
                              'state', v_m.state, 'idempotent', true, 'stat_rows_bound', 0);
  end if;

  -- ── A DIFFERENT pair is already bound to one side or the other: REFUSE, never silently re-point.
  --    Re-pointing a bound demo is Story 4.7's rollback (an audited un-bind), not a side effect of a bind.
  if v_m.demo_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_bound', 'bound_demo_id', v_m.demo_id);
  end if;
  if v_d.match_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_bound', 'bound_match_id', v_d.match_id);
  end if;

  -- ── ⭐ AC2 — THE TERMINAL REFUSAL (AD-23). "Once Forfeit/Bye is committed, a demo that later arrives is
  --    archived for evidence (AD-1) but produces NO stat_row and does not flip the match." Two of that AC's
  --    three halves already ship: retention (AD-1, Stories 3.1/3.2) archives the demo, and 4.5's
  --    match_terminal_state_guard (IC901) refuses the flip. THIS is the third: the bind itself must REFUSE.
  --    A typed refusal beats a raised trigger for the admin — and the guard must not be the only defense
  --    (0015:55-56 handed this round-trip here BY NAME; 4.5 could only install the guard, never prove it).
  --    The same clause refuses `pending`/`resolved`/`manual_resolved`/`rolled_back`/`awaiting_grace`: only a
  --    match that is declared or live can receive its deciding demo.
  if v_m.state not in ('declared', 'live') then
    return jsonb_build_object('ok', false, 'reason', 'not_bindable', 'state', v_m.state);
  end if;

  -- ── THE 23514 MAP (deferred-work.md:136, inherited here — see the header). match_live_requires_locked_format
  --    (0012:123-126) refuses state='pending' unless format_locked. Guard it EXPLICITLY so the admin gets a
  --    typed "declare the format first" instead of an opaque check_violation inside a 500. The CHECK stays the
  --    backstop that binds every writer; this is the UX in front of it.
  if not v_m.format_locked then
    return jsonb_build_object('ok', false, 'reason', 'format_not_declared');
  end if;

  -- ── DECISION H — a HELD demo does not publish. demo.validation_state (0008:41-43) is the ingest ANOMALY
  --    axis and is deliberately ORTHOGONAL to stat_row.status's publish axis (0008:32) — so this is a
  --    one-line guard, not a conflation of the two. The accept-anomaly route that would clear the hold is
  --    ORPHANED (see the header + deferred-work.md); until it has a home, an anomalous demo is refused rather
  --    than bound, because binding it is what makes 4.6b's publish possible.
  if v_d.validation_state = 'anomalous' then
    return jsonb_build_object('ok', false, 'reason', 'anomalous');
  end if;

  -- ── A demo that produced no stat rows decided nothing. (A zero-player parse also trips the worker's
  --    empty_stats gate -> 'anomalous', so this is belt-and-braces; it also catches a demo whose rows were
  --    deleted by a re-parse revert.)
  select count(*) into v_stats from public.stat_row s where s.demo_id = p_demo_id;
  if v_stats = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_stats');
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 4. THE BINDING — all three FKs, plus the AC3 transition.
  --    match_format_audited (0012:220-239) does NOT fire: it is keyed on the format columns and this UPDATE
  --    touches neither. match_terminal_state_guard (IC901) does not fire either — `declared`/`live` are not
  --    terminal. score_source_guard (0010:124-128) is satisfied: score_source stays NULL (4.6b writes it).
  update public.match
     set demo_id = p_demo_id,
         state   = 'pending'
   where id = p_match_id;

  update public.demo
     set match_id = p_match_id
   where id = p_demo_id;

  -- Every stat_row this demo produced now belongs to the bracket match too. Scoped by demo_id (the row's
  -- provenance, 0007:39) — NOT by matchzy_match_id, which is the external ingest id and could collide across
  -- events. data-integrity M5 (review-data-integrity.md:285-314) wants stat_row.demo_id asserted equal to
  -- match.demo_id at APPROVE time; that assertion is 4.6b's, and this write is what makes it possible.
  update public.stat_row
     set match_id = p_match_id
   where demo_id = p_demo_id;
  get diagnostics v_bound = row_count;

  -- ══ 5. THE AUDIT ROW (AD-17). `action='bind_demo'` extends the uncapped vocabulary with NO migration (see
  --    the header). The "who" is p_actor_steamid64 (NOT NULL with an FK to player, 0003:24 — the actor must
  --    be a real player); the "when" is occurred_at's now() default.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'bind_demo',
    p_match_id,
    jsonb_build_object(
      'demo_id',           p_demo_id,
      'matchzy_match_id',  v_d.matchzy_match_id,
      'stat_rows_bound',   v_bound,
      'from_state',        v_m.state
    )
  );

  return jsonb_build_object(
    'ok',              true,
    'match_id',        p_match_id,
    'demo_id',         p_demo_id,
    'state',           'pending',
    'idempotent',      false,
    'stat_rows_bound', v_bound
  );
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE it would be callable straight off the Data API. It is SECURITY INVOKER (a viewer would 42501 at
-- the first write anyway), but a defence that depends on a later grant check is not a defence: revoke first,
-- then grant to the single writer. The route's requireAdmin is the authorization gate; this is the second
-- lock on the same door (0012:480-487).
revoke execute on function public.bind_match_demo(bigint, bigint, text) from public;
grant  execute on function public.bind_match_demo(bigint, bigint, text) to service_role;
