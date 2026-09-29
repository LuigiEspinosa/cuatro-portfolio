-- supabase/migrations/0017_aprobar_publish.sql
-- Logical migration 0017 — the atomic "Aprobar" publish (Story 4.6b, AC1/AC2/AC3).
--
-- ONE migration because it is ONE concern: the single admin act that turns a `pending`, demo-bound match into
-- PUBLISHED truth — in ONE transaction (AD-6). Everything here exists to make that one transaction atomic and
-- to make the states it touches honest.
--
-- ⭐ THE PICTURE (why a story whose three ACs read as pure integration is not pure integration). §8
-- (SOLUTION-DESIGN:370-375) states the transaction's four effects: (1) flip the stat rows to `approved`; (2)
-- write the demo-derived score + `state='resolved'`; (3) advance the bracket idempotently; (4) post one
-- `timeline_feed` entry + "recompute leaderboards". Two of those four are not integration:
--   * `timeline_feed` DOES NOT EXIST and was never designed — the string appears exactly once in the whole
--     repo (SOLUTION-DESIGN:374, prose). This migration CREATES it (DECISION C). It is the first table since
--     Epic 1 with no shell to inherit, and 4.6b is the ONLY feed writer in the whole 51-story plan.
--   * "recompute leaderboards" is a NO-OP and building anything VIOLATES AD-20 (DECISION E). AD-20
--     (SPINE:175-178) resolved adversarial H3 to "one SQL view/RPC over status='approved' rows", whose own
--     text says AD-6's "recompute" then "reduces to 'no extra write'". Step (1)'s status flip IS the
--     recompute; the leaderboard is Story 5.5's, in a later epic. NOTHING is built for it here.
--
-- WHAT IT BUILDS:
--   (a) DECISION C — `timeline_feed`: the post-approval activity feed (FR-31). Append-only like audit_log,
--       ordered by `id` (NOT occurred_at — an atomic Aprobar stamps every entry with the same now()).
--   (b) hand-off #3 — `score_source_guard` TIGHTENED so a score cannot exist without a provenance
--       (`score_a=16, score_b=14, score_source=NULL` passes TODAY; this closes it).
--   (c) DECISION G — `match_terminal_state_guard` EXTENDED with a new rule (IC904) so a committed
--       `resolved`/`manual_resolved` cannot be flipped to `bye`/`forfeit`/`void`. Makes AD-23's "Resolved and
--       Forfeit cannot coexist" true BY CONSTRUCTION IN BOTH DIRECTIONS. ⚠ NOT the same as adding `resolved`
--       to the terminal set — that would block Story 4.7's `Resolved -> Pending` rollback (SPINE:312 / FR-14).
--   (d) DECISION J — `approve_match(match, actor)`: the §8 transaction as a REUSABLE RPC (AD-3 needs it
--       callable from inside 3.6/4.7's re-parse-republish), not route-local logic. Plus its service-role grant.
--
-- ⭐⭐ THE LOAD-BEARING HAND-OFF (deferred-work.md, "if Story 4.6's Aprobar writes the score/demo/state, calls
-- advance_match, receives slot_taken, and commits anyway, the result is a resolved match with a score and no
-- advance"). `approve_match` writes the score + `state='resolved'` then CALLS advance_match in the SAME
-- transaction. advance_match RETURNS `{ok:false}` (it does NOT raise) — so `approve_match` RAISES `IC903` on
-- `{ok:false}`, rolling the whole publish back. ⚠ Do NOT change advance_match's RETURN contract (0015:381:
-- "4.6 depends on its RETURN semantics") — mirror 4.5's `mark_walkover` (0015:280-415), the code-reviewed
-- template for this exact shape.
--
-- ⭐⭐ TWO INTEGRITY GUARDS re-homed here BY NAME from 4.6a's code review (2026-07-16): a binding EXISTING does
-- not mean it is VALID. 4.6a binds (match, demo) on the admin's say-so and verifies nothing about the demo's
-- relationship to the match. Both gaps are nearly free once the seats are resolved, so `approve_match` closes
-- them in its guard list: `wrong_demo` (every stat_row's player must be one of the two seats — found LIVE at
-- 4.6a's BAR, binding a demo between two OTHER people was accepted) and `demo_mismatch` (every stat_row.demo_id
-- must equal match.demo_id — data-integrity M5, re-uploads legitimately create a second demo sharing one
-- matchzy_match_id, so a re-parse can leave the score derived from one demo while the evidence link names
-- another).
--
-- SQLSTATEs (the 4.5/4.6a convention — NEVER a bare P0001, deferred-work.md "P0001 is PL/pgSQL's GENERIC
-- exception code" owned by lib/match/format.ts):
--   * IC901 — the AD-23 terminal guard, existing rule (a flip OUT of bye/forfeit/void). 4.5's.
--   * IC902 — mark_walkover's advance-refused rollback. 4.5's.
--   * IC903 — approve_match's advance-refused rollback (advance_match returned {ok:false}). ⭐ NEW, this story.
--   * IC904 — the AD-23 terminal guard, NEW rule (a flip resolved/manual_resolved -> bye/forfeit/void).
--             ⭐ NEW, this story (DECISION G).
--   * 23514 — score_source_guard / match_live_requires_locked_format (a check_violation). Not raised here;
--             mapped by lib/match/approve.ts to `format_not_declared` (mirrors 4.6a's bind).
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * NO score DERIVATION, NO parser change, NO `bind_match_demo` — all 4.6a's. If demo_id is NULL, refuse
--     `not_bound`; do NOT bind. `stat_row.rounds_won` already carries the derived tally.
--   * NO leaderboard anything (DECISION E; Story 5.5 owns the slice, epics.md:913). The status flip IS the
--     recompute (AD-20). ⚠ REFRESH MATERIALIZED VIEW takes an ACCESS EXCLUSIVE lock and the CONCURRENTLY
--     variant cannot run in a transaction block at all — either would collide with AD-6's one-transaction rule.
--   * NO feed READ surface / UI / i18n (Story 5.6 disclaims the write and points HERE; Epic 5 owns Spanish).
--   * NO `bracket_advance` timeline entry (DECISION D) — the enum provisions it, but its writer must ALSO
--     cover 4.3's cascades and 4.5's forfeit/bye advances (paths this story does not own, shipped before the
--     table existed), so it lands uniformly in one place. Logged in deferred-work.md.
--   * NO rollback / un-advance / `Deshacer` (Story 4.7) — `resolved -> pending` is DELIBERATELY still allowed
--     here (the IC904 rule blocks only resolved -> bye/forfeit/void).
--   * NO manual score / manual_override (4.8 — and do NOT touch manual_override; score_source_guard reads it).
--   * NO changes to advance_match / generate_bracket / mark_walkover — call, don't rewrite. NO shared
--     command-route helper (4.9). NO CSRF (Epic 7).
--   * NO ceremony-lock gate. ⚠ AD-15 (SPINE:153) + data-integrity M3 want `tournament.ceremony_locked_at`
--     checked by Aprobar, but `ceremony` does not exist until Epic 6 — Story 6.2 must add that check to
--     whatever `approve_match` ships here. Seam flagged, NOT built.
--   * `audit_log.action = 'approve'` is already the enumerated vocabulary (0003:25, uncapped text, no CHECK) —
--     NO migration, and 0003 is UNTOUCHED (never edit an applied migration).
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 — READ BEFORE CHANGING THE score_source_guard TIGHTENING).
-- An immediate validated CHECK cannot apply to a DB that already holds a violating row, and `supabase db
-- reset` structurally CANNOT catch that (it rebuilds from empty). Verified by grep that NOTHING writes a score
-- today: the only `score_a`/`score_source` occurrences in supabase/migrations are this guard's own definition
-- and comments (0010:124-128, 0012:70) — every match row has score_a AND score_source NULL, and
-- `(null is null) = (null is null)` is TRUE, so the tightened conjunct holds for every existing row. The
-- score writer is `approve_match`, created BELOW in this same migration, after the constraint exists.
--
-- ⚠ ANON EXPOSURE NOTE (deferred-work.md, "approved_by becomes anon-readable the moment you write it").
-- 0009:35 grants SELECT on stat_row to anon/authenticated column-blind, and stat_view exposes every
-- status='approved' row — so writing `approved_by` here makes the acting admin's steamid64 anon-readable. This
-- was deferred on "nothing is exposed today"; this story makes it live. Accepted for this casual private
-- group (per Cuatro); noted, not re-litigated.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) DECISION C — timeline_feed: the post-approval activity feed (FR-31).
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ NO SHELL TO INHERIT. This table does not exist and was never designed — one prose mention
-- (SOLUTION-DESIGN:374), no DDL, no ERD entity, no RLS. The NAME is the one thing specified. 4.6b is the ONLY
-- feed writer in the whole plan (epics.md:167), and Story 5.6 owns the READ surface, so the entry_type model
-- must be general enough for all three FR-31 event types even though THIS story writes only `match_result`.
--
-- ⚠ `id` IS THE ORDERING KEY, NOT occurred_at. An atomic Aprobar stamps every entry it writes with the SAME
-- now(), so occurred_at alone renders nondeterministically. The UX demands "Newest-first" (EXPERIENCE:85,109);
-- the identity `id` is a monotonic, deterministic order (and what a future two-entry render — DECISION D — will
-- need). occurred_at stays for display ("hace 0:51"), never for ordering.
create table timeline_feed (
  id              bigint generated always as identity primary key,   -- ⭐ ALSO the deterministic ordering key
  tournament_id   bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  entry_type      text not null check (entry_type in ('match_result','bracket_advance','award_reveal')),  -- FR-31's three
  occurred_at     timestamptz not null default now(),                -- for DISPLAY only — NEVER the sort key (see above)
  target_match_id bigint references match(id) on delete set null,    -- never CASCADE: a feed is history (0010:189-194)
  detail          jsonb not null                                     -- what the feed card renders (5.6)
);
comment on table public.timeline_feed is
  'FR-31 post-approval activity feed. Append-only (like audit_log): a rollback (4.7) posts a CORRECTING entry, it never edits history. ORDER BY id desc — an atomic Aprobar stamps every row with the same occurred_at, so occurred_at cannot be the sort key. The READ surface is Story 5.6; 4.6b is the only writer (match_result).';

-- The newest-first read (Story 5.6): filter by tournament, order by id desc.
create index timeline_feed_tournament_idx on public.timeline_feed (tournament_id, id desc);

-- ── ENABLE + FORCE RLS ───────────────────────────────────────────────────────
-- ⚠ FORCE is non-negotiable: the generic catalog FORCE-guard in the 0003 test (Section A2) asserts NO public
-- base table may have FORCE off (cited at 0005:42-43, 0007:57-58, 0010:204-205), so it now covers
-- timeline_feed too and fails loudly here if omitted. FORCE does not affect BYPASSRLS roles — service_role
-- still bypasses.
alter table public.timeline_feed enable row level security;
alter table public.timeline_feed force  row level security;

-- ── The viewer policy — EXPLICIT, and its safety REASONED (AD-7 / data-integrity H2) ──
-- AD-7 (SPINE:113): "No status-less table is left ungated"; data-integrity H2 names status-less CHILD tables
-- as the leak class (a table with no `status` column can't be filtered to approved-only rows). timeline_feed
-- has no `status` — but it is SAFE BY CONSTRUCTION because a row is only ever written POST-approval, inside
-- approve_match, AFTER the stat rows are already `approved` (FR-31 prd.md:417: "The feed reflects only
-- Approved events; Pending Ingestion does not post"). There is no pending row to leak. So the blanket
-- `using (true)` is correct HERE for a reason that must be written down — a bare `using (true)` with no
-- justification is exactly what H2 warns about.
create policy timeline_view on public.timeline_feed for select to anon, authenticated using (true);

-- ── Grants — a read surface for everyone, an APPEND-ONLY ceiling for the writer ──
-- anon/authenticated: SELECT only (the 5.6 feed read). service_role: SELECT + INSERT, deliberately NO
-- UPDATE / NO DELETE — append-only like audit_log (0003:68,78-84). A correction (4.7) posts a NEW correcting
-- entry; history is never edited or erased. The absent UPDATE/DELETE grants are the teeth (the 0003 test
-- proves the service_role UPDATE/DELETE 42501s). Identity PK needs no separate sequence grant.
grant select on public.timeline_feed to anon, authenticated;
grant select, insert on public.timeline_feed to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (b) hand-off #3 — TIGHTEN score_source_guard: a score REQUIRES a provenance.
-- ════════════════════════════════════════════════════════════════════════════
-- TODAY `score_a=16, score_b=14, score_source=NULL` PASSES 0010's guard: the `score_source is null` disjunct
-- short-circuits the whole thing TRUE, so a score with no provenance slips through (deferred-work.md, "the
-- score_source_guard permits a score with NO provenance"; ⚠ its citation 0010:77-81 is STALE — the guard is at
-- 0010:124-128). AD-5 makes score_source THE single discriminator, so a score MUST name where it came from.
-- Drop + re-add, adding ONE conjunct that ties the two together. ⚠ AD-5's three disjuncts are kept VERBATIM —
-- this ADDS a conjunct, it does not rewrite AD-5.
alter table public.match drop constraint score_source_guard;
alter table public.match add constraint score_source_guard check (
  (
    score_source is null
    or (score_source = 'demo_derived' and demo_id is not null)
    or (score_source = 'admin_manual'  and (demo_id is null or manual_override = true))
  )
  -- ⭐ hand-off #3 (+ code review 2026-07-18): a score exists IFF its provenance does — on BOTH columns. Closes
  -- the score-with-no-provenance hole. Binding score_a AND score_b (not score_a alone) makes the invariant hold
  -- for every writer, present and future — approve_match (4.6b) and the manual score (4.8) always write score_a
  -- WITH score_b and score_source together — rather than resting on writer discipline (a half-written
  -- `score_a=null, score_b=5, score_source=null` no longer slips through the score_a-only check).
  and (score_a is null) = (score_source is null)
  and (score_b is null) = (score_source is null)
);

-- ════════════════════════════════════════════════════════════════════════════
-- (c) DECISION G — EXTEND the AD-23 terminal guard: resolved cannot become a walkover.
-- ════════════════════════════════════════════════════════════════════════════
-- deferred-work.md homes AD-23's asymmetry here: 4.5 blocks bye/forfeit/void -> anything (IC901), but nothing
-- blocks the OTHER direction. AD-23's claim is that `Resolved` (demo) and `Forfeit` (admin) CANNOT COEXIST —
-- a claim about those two STATES, not about immutability. So add a SECOND rule: a committed
-- resolved/manual_resolved cannot be flipped to bye/forfeit/void. Distinct SQLSTATE IC904 so lib/match can
-- classify it apart from IC901.
--
-- ⚠⚠ DO NOT "fix" this by adding `resolved` to the FIRST rule's terminal set. The lifecycle (SPINE:312) has
-- `Resolved --> Pending: rollback [AD-8]` and FR-14 (prd.md:255) says rollback returns a match "to Pending or
-- unparsed" — so `resolved -> pending` MUST stay allowed or Story 4.7 is blocked entirely. This is the EXACT
-- trap the 4.3 review already caught once ("a naive write-once trigger would BLOCK 4.7, which must
-- legitimately un-seat competitors"). The pgTAP pins `resolved -> pending` with a lives_ok so a future
-- "helpful" tightening goes RED.
--
-- ⚠ The FIRST rule is kept BYTE-IDENTICAL to 0015:114-118 (a `bye` DESTINATION seat via
-- match_place_competitor leaves state='bye' unchanged and must still pass — `new.state is distinct from
-- old.state` is the discriminator). `create or replace`: the 0015 trigger already binds this function.
create or replace function public.match_terminal_state_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  -- Rule 1 (4.5, IC901) — a committed bye/forfeit/void is terminal: no flip OUT of it. BYTE-IDENTICAL to 0015.
  if old.state in ('bye', 'forfeit', 'void') and new.state is distinct from old.state then
    raise exception
      'match %: state % is TERMINAL (AD-23) — a committed bye/forfeit/void is the single arbiter and cannot be flipped by a later demo/result', old.id, old.state
      using errcode = 'IC901',
            hint = 'A late demo for a committed forfeit/bye is archived for evidence (AD-1) but never changes the match. Un-advancing a terminal row is Story 4.7 (an audited override).';
  end if;
  -- Rule 2 (4.6b, IC904, DECISION G) — the OTHER direction of AD-23: a committed demo result cannot be
  -- overwritten by an admin walkover. Blocks ONLY resolved/manual_resolved -> bye/forfeit/void; leaves
  -- resolved -> pending (4.7 rollback) and every other transition alone.
  if old.state in ('resolved', 'manual_resolved') and new.state in ('bye', 'forfeit', 'void') then
    raise exception
      'match %: state % is a committed demo result (AD-23) — Resolved and Forfeit cannot coexist, so it cannot be flipped to %', old.id, old.state, new.state
      using errcode = 'IC904',
            hint = 'A resolved match already has a demo-derived result. Forfeiting/voiding it would land two conflicting outcomes. Reverting a resolved match is Story 4.7 (Resolved -> Pending rollback), which this guard deliberately still allows.';
  end if;
  return new;
end;
$$;

-- No REVOKE: a `returns trigger` function cannot be invoked as a normal call and PostgREST does not expose it,
-- so PUBLIC's default EXECUTE is not a reachable surface (0015:128-129 posture, unchanged).

-- ════════════════════════════════════════════════════════════════════════════
-- (d) DECISION J — approve_match: the §8 atomic Aprobar, as a reusable RPC.
-- ════════════════════════════════════════════════════════════════════════════
-- The whole publish, in ONE transaction (AD-6), as an RPC (NOT route-local logic) because AD-3 (SPINE:93)
-- needs the entire revert->reparse->republish to run as a single transaction that CALLS this — Story 3.6/4.7
-- would be unimplementable if the Aprobar lived in TypeScript. It must also be callable from inside another
-- transaction, exactly as advance_match is from mark_walkover.
--
-- ⚠⚠ LOCK ORDER (mirrors mark_walkover 0015:297-317, and advance_match 0014:382-400). This WRITES the match
-- row and THEN calls advance_match, which locks the WHOLE bracket in canonical id order. Writing the match
-- first would lock it OUT of that order and could deadlock a concurrent advance (the 4.3 40P01). So take the
-- SAME ordered whole-bracket lock UP FRONT, before the first write.
--
-- ⚠ ORDERING IS LOAD-BEARING: flip state='resolved' BEFORE advancing (advance_match's result gate refuses
-- `pending` BY NAME, 0014:414-425); score_source_guard needs demo_id already bound (0010:124-128, satisfied by
-- 4.6a); ONE emit, after commit, by construction (advance with p_emit=>false, then one realtime.send here).
create function public.approve_match(
  p_match_id        bigint,
  p_actor_steamid64 text
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tid      bigint;
  v_m        record;
  v_seat_a   text;      -- competitor_a's steamid64 (AD-4 canonical key)
  v_seat_b   text;      -- competitor_b's steamid64
  v_score_a  int;
  v_score_b  int;
  v_winner   bigint;
  v_loser    bigint;
  v_sha      text;
  v_approved int;
  v_adv      jsonb;
  v_before   jsonb;
begin
  -- ══ 1. WHICH BRACKET? An UNLOCKED peek — it must not lock, because the next statement takes every lock in
  --    canonical order and a lock ahead of it would be OUT of order (the 4.3 deadlock). `match` has NO DELETE
  --    grant (0010:227), so the row cannot vanish between this read and the lock.
  select m.tournament_id into v_tid from public.match m where m.id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ══ 1b. EVERY LOCK, IN ONE STATEMENT, IN CANONICAL (id) ORDER — mirrors advance_match / mark_walkover.
  perform 1
     from public.match m
    where m.tournament_id = v_tid
    order by m.id
      for update;

  -- ══ 1c. NOW read the source under the lock; its state cannot move under us.
  select m.id, m.tournament_id, m.state, m.demo_id, m.competitor_a, m.competitor_b,
         m.bracket_position, m.score_a, m.score_b, m.score_source
    into v_m
    from public.match m
   where m.id = p_match_id;

  -- ══ 2. GUARDS — all of them before any write (the 0012 convention), typed refusals RETURNED.

  -- not_pending — the state 4.6a's bind produces. Nothing else is approvable; a resolved/forfeit/bye row is
  -- refused here (the AD-23 terminal guard is the second lock, not the only one).
  if v_m.state <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending', 'state', v_m.state);
  end if;

  -- not_bound — score_source_guard REQUIRES demo_id for a demo_derived score (0010:124-128). If it is NULL the
  -- match was never bound: REFUSE, do NOT bind here (binding is 4.6a's job).
  if v_m.demo_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_bound');
  end if;

  -- Resolve the seats: competitor_a/b (roster_entry id) -> roster_entry.steamid64 (0004:29).
  select r.steamid64 into v_seat_a from public.roster_entry r where r.id = v_m.competitor_a;
  select r.steamid64 into v_seat_b from public.roster_entry r where r.id = v_m.competitor_b;

  -- ══ 2b. ⭐⭐ demo_mismatch (data-integrity M5, re-homed from 4.6a). Every stat_row bound to this match must
  --    belong to the SAME demo the match names. A re-upload creates a second demo sharing one
  --    matchzy_match_id (0006 key: unique(matchzy_match_id, demo_sha256)), and upsertStatRows conflicts on
  --    (matchzy_match_id, steamid64) setting demo_id = excluded.demo_id — so a re-parse can leave
  --    match.demo_id = D_a while every stat_row.demo_id = D_b, i.e. a score derived from one demo while the
  --    evidence link names another. Refuse rather than publish that.
  if exists (
    select 1 from public.stat_row s
     where s.match_id = p_match_id and s.demo_id is distinct from v_m.demo_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'demo_mismatch');
  end if;

  -- ══ 2c. ⭐⭐ wrong_demo (re-homed from 4.6a — found LIVE at its BAR). Every stat_row's player must be one of
  --    the two seated competitors. If the demo is between other people, the seat mapping has no answer; this
  --    catches the partial/superset overlap `bad_score` would miss. `is distinct from` handles a NULL seat
  --    (an undetermined match) correctly — an empty seat flags every row and refuses here.
  if exists (
    select 1 from public.stat_row s
     where s.match_id = p_match_id
       and s.steamid64 is distinct from v_seat_a
       and s.steamid64 is distinct from v_seat_b
  ) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_demo');
  end if;

  -- ══ 2d. THE SCORE, via the seats. stat_row.rounds_won is the FR-16 per-player tally (4.6a) — map it onto
  --    score_a/score_b through the competitor seats, where the bracket knowledge lives (SOLUTION-DESIGN:373).
  select s.rounds_won into v_score_a
    from public.stat_row s where s.match_id = p_match_id and s.steamid64 = v_seat_a;
  select s.rounds_won into v_score_b
    from public.stat_row s where s.match_id = p_match_id and s.steamid64 = v_seat_b;

  -- bad_score — a tally MISSING or NULL for either competitor. ⚠ rounds_won is NULLABLE and every row parsed
  -- before 0016 has it NULL, so test for NULL, not merely for an absent row (4.6a's no_stats counts row
  -- EXISTENCE, never the tally).
  if v_score_a is null or v_score_b is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_score');
  end if;

  -- tied (DECISION K) — a genuine draw means tie_policy='draw', which has NO winner_entry; advance_match's
  -- gate (0014:423-425) refuses a winnerless result anyway, and a draw genuinely cannot advance a double-elim
  -- bracket. Refuse loudly rather than crown arbitrarily.
  if v_score_a = v_score_b then
    return jsonb_build_object('ok', false, 'reason', 'tied', 'score_a', v_score_a, 'score_b', v_score_b);
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  v_winner := case when v_score_a > v_score_b then v_m.competitor_a else v_m.competitor_b end;
  v_loser  := case when v_winner = v_m.competitor_a then v_m.competitor_b else v_m.competitor_a end;
  select d.demo_sha256 into v_sha from public.demo d where d.id = v_m.demo_id;
  v_before := jsonb_build_object(
    'state', v_m.state, 'score_source', v_m.score_source, 'score_a', v_m.score_a, 'score_b', v_m.score_b
  );

  -- ══ 3. §8 STEP 1 — publish the stat rows. Plus AC1's FOURTH clause (FR-13 prd.md:247, "recorded with who
  --    approved and when"): approved_by + approved_at. Scoped by match_id (4.6a's bind made that possible).
  update public.stat_row
     set status      = 'approved',
         approved_at = now(),
         approved_by = p_actor_steamid64
   where match_id = p_match_id;
  get diagnostics v_approved = row_count;

  -- ══ 4. §8 STEP 2 — the score + state. score_source='demo_derived' (AD-5); winner_entry = the higher tally's
  --    seat; state='resolved'. ⚠ demo_id is already set (4.6a), so score_source_guard is satisfied; format is
  --    locked (a pending match required it, 0012:123-126), so match_live_requires_locked_format passes.
  update public.match
     set score_a      = v_score_a,
         score_b      = v_score_b,
         score_source = 'demo_derived',
         winner_entry = v_winner,
         state        = 'resolved'
   where id = p_match_id;

  -- ══ 5. §8 STEP 3 — the idempotent advance, FOLDED into our single emit. p_emit => false (AD-11): the
  --    advance does NOT emit its own bracket.advanced; approve_match emits ONE match.approved below.
  v_adv := public.advance_match(p_match_id, p_actor_steamid64, false);

  -- ⭐⭐ HONOR {ok:false} — THE LOAD-BEARING HAND-OFF. advance_match RETURNS a typed refusal (e.g. slot_taken)
  -- rather than raising; if we committed anyway the result is a resolved, scored match with no advance — the
  -- exact partial state the two-pass design exists to prevent. RAISE (distinct IC903) to roll the WHOLE
  -- publish back. Do NOT change advance_match to raise — 4.6 depends on its RETURN semantics (0015:381).
  if not coalesce((v_adv->>'ok')::boolean, false) then
    raise exception
      'approve_match: advance refused (%) — the whole publish is rolled back so a resolved, scored match never commits without its advance (AD-6/AD-8)', coalesce(v_adv->>'reason', 'unknown')
      using errcode = 'IC903',
            hint = 'The winner''s destination seat is held by a different player. Un-routing it is Story 4.7 (rollback); until then the Aprobar cannot commit.';
  end if;

  -- ══ 6. §8 STEP 4 — ONE timeline_feed entry (DECISION D — match_result; bracket_advance is provisioned but
  --    written elsewhere). detail carries what the feed card renders (mock-home.html:577-591 + the aria-live
  --    "Resultado aprobado: Dex venció a Theo 16-13"). ⚠ NO leaderboard refresh (DECISION E — the status flip
  --    IS the recompute, AD-20).
  insert into public.timeline_feed (tournament_id, entry_type, target_match_id, detail)
  values (
    v_m.tournament_id,
    'match_result',
    p_match_id,
    jsonb_build_object(
      'winner_entry',     v_winner,
      'loser_entry',      v_loser,
      'score_a',          v_score_a,
      'score_b',          v_score_b,
      'bracket_position', v_m.bracket_position,
      'demo_sha256',      v_sha
    )
  );

  -- ══ 7. THE AUDIT ROW (AD-17, action='approve' — already enumerated, no migration). ⭐ Carry a REAL
  --    before/after (hand-off #6 — the sibling `advance` row has none). An Aprobar therefore writes TWO audit
  --    rows: this one + advance_match's `advance` row — two distinct admin consequences.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  values (
    v_m.tournament_id,
    p_actor_steamid64,
    'approve',
    p_match_id,
    jsonb_build_object(
      'before',             v_before,
      'after',              jsonb_build_object('state', 'resolved', 'score_source', 'demo_derived',
                                               'score_a', v_score_a, 'score_b', v_score_b, 'winner_entry', v_winner),
      'stat_rows_approved', v_approved
    )
  );

  -- ══ 8. ⭐ AC2 — THE SINGLE EMIT, POST-COMMIT BY CONSTRUCTION. realtime.send INSERTS into realtime.messages
  --    inside THIS transaction; Realtime ships it off the replication slot only on commit — so the emit cannot
  --    outrun its own commit (0013:809-819). ONE Broadcast carries the semantic change (AD-11); the event name
  --    `match.approved` is SPECIFIED (SPINE:230), not invented. Mirror advance_match's shape (0013:839-851).
  perform realtime.send(
    jsonb_build_object(
      'tournament_id', v_m.tournament_id,
      'match_id',      p_match_id,
      'winner_entry',  v_winner,
      'loser_entry',   v_loser,
      'score_a',       v_score_a,
      'score_b',       v_score_b,
      'advanced',      v_adv->'advanced',
      'champion',      v_adv->'champion'
    ),
    'match.approved',
    'tournament:' || v_m.tournament_id::text,
    false
  );

  return jsonb_build_object(
    'ok',                 true,
    'stat_rows_approved', v_approved,
    'score_a',            v_score_a,
    'score_b',            v_score_b,
    'winner_entry',       v_winner,
    'advanced',           v_adv->'advanced',
    'champion',           v_adv->'champion'
  );
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE it would be callable straight off the Data API. It is SECURITY INVOKER (a viewer would 42501 at
-- the first write anyway), but a defence that depends on a later grant check is not a defence: revoke first,
-- then grant to the single writer. The route's requireAdmin is the authorization gate; this is the second lock
-- on the same door (0012:480-487).
revoke execute on function public.approve_match(bigint, text) from public;
grant  execute on function public.approve_match(bigint, text) to service_role;
