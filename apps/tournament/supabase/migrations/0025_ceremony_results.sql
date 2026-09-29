-- supabase/migrations/0025_ceremony_results.sql
-- Logical migration 0025 — the ceremony RESULT tables + FR-26's anti-sweep constraint, and the
-- luck-meter's shipped VALUES (Story 6.6, FR-26 / AD-14 / SOLUTION-DESIGN §9.4 /
-- reviews/review-data-integrity.md M1). The THIRD Epic-6 migration.
--
-- ⭐ THE THESIS. Anti-sweep — "at most one trophy per player per spin" — is enforced by a PURE
-- PRODUCER-SIDE pass (`worker/awards/sweep.go` + `lib/roulette/sweep.ts`), because the browser
-- verifier at Story 6.9 must reproduce the whole ceremony FROM THE BUNDLE ALONE
-- (SOLUTION-DESIGN:448-449 — "the JS verifier needs NOTHING outside the bundle; if it does, the
-- bundle is incomplete"). A trigger-enforced anti-sweep would be unreproducible in a browser and is
-- therefore the wrong mechanism. What the schema owes is a SECOND LINE: `review-data-integrity.md`
-- M1 measured that "a producer bug (or a re-run that doesn't clean prior rows) could award the same
-- player two trophies in one spin ... with nothing in the schema to catch it". This migration is
-- that nothing, removed. ⛔ `unique (spin_id, winner_entry_id)` MUST NEVER FIRE — if it does, the
-- producer is broken, and the constraint's job is to say so loudly instead of shipping a ceremony
-- that contradicts its own published rule.
--
-- WHAT IT BUILDS:
--   (a) `spin`, `award_result`, `award_result_winner` — SOLUTION-DESIGN.md:205-233 verbatim, plus
--       M1's three fixes: the denormalized `award_result_winner.spin_id` that makes the anti-sweep
--       UNIQUE expressible, a COMPOSITE foreign key so that `spin_id` cannot disagree with its
--       parent's, and a deferred constraint trigger asserting `is_shared = (winner count > 1)`.
--   (b) The luck-meter's shipped VALUES: `ceremony.luck_weight_table`'s column DEFAULT, a shape
--       CHECK that machine-enforces FR-26's three rules, and a backfill of the SHELL 0024 created.
--
-- SQLSTATEs — 0025 declares EXACTLY ONE new code:
--   * IC909 — `award_result_is_shared_consistent`: `is_shared` disagrees with the number of
--     `award_result_winner` rows. ⭐ NEW, this story. IC901-IC908 are taken (0015/0017/0018/0019/0024).
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ FOUR DECISIONS. Read these before changing anything below.
-- ════════════════════════════════════════════════════════════════════════════
--
-- DECISION A — THESE THREE TABLES ARE STORY 6.6's, AND THAT REVERSES 0024's OWN OUT-OF-SCOPE NOTE.
-- `0024:144` homes `spin` / `award_result` / `award_result_winner` to "6.4 / 6.5 / 6.8 / 6.9", while
-- Story 6-4b's and Story 6.5's scope boundaries both home the anti-sweep CONSTRAINT to 6.6 — and the
-- constraint cannot exist without the tables. Cuatro resolved it (2026-08-07) by taking 0024's own
-- shell precedent in its own words (`0024:191-193`: "the table shape arrives once so a later story
-- widens behaviour, never the schema"): **6.6 lands the table SHAPE plus the anti-sweep constraint;
-- 6.8 WIDENS it with the reveal-gated RLS axis, the commitment surface and the writer.** The cost is
-- accepted deliberately: NOTHING WRITES A ROW TO ANY OF THESE THREE TABLES IN THIS STORY. They land
-- empty, they are proven by pgTAP fixtures, and the first production writer is 6.8's.
--
-- DECISION B — NO RLS POLICY, ON ANY OF THE THREE, AND THE ABSENCE IS THE POINT.
-- This is NOT the `ceremony` pattern: 0024 created a DORMANT `ceremony_admin_read` policy because
-- the shape of an admin read was already known. Here it is not — the viewer axis is
-- REVEAL-GATED on `spin.revealed_at` (AD-22, SOLUTION-DESIGN:283-288), and its exact shape is Story
-- 6.8's design, not something to guess at one story early. RLS is ENABLED and FORCED (the generic
-- catalog guard in `0003_audit_snapshot_test.sql` Section A2 requires it of every public base table,
-- and FORCE also closes the "owner quietly reads everything" gap), and with ZERO policies plus ZERO
-- grants to anon/authenticated the tables are fail-closed twice over. ⛔ Story 6.8 ADDS both halves —
-- the grant and the policy — together. It never has to tighten anything here.
--
-- DECISION C — `is_shared` IS KEPT AND ASSERTED, RATHER THAN DROPPED AND COMPUTED ON READ.
-- M1 offers both. Kept, because SOLUTION-DESIGN:221 declares the column and Story 6.8 renders from
-- it on stage, and a read-time `count(*)` would put a correlated subquery on the reveal path. What
-- makes it honest is the DEFERRED CONSTRAINT TRIGGER below: `is_shared` is checked against
-- `count(award_result_winner) > 1` at COMMIT, on both tables, so the intermediate states a real
-- writer necessarily passes through (insert the result, then its winners) are legal while the END
-- STATE is not allowed to drift. An IMMEDIATE check would make the correct insert order impossible
-- and force the writer into a shuffle, exactly as 0023 found for the priority UNIQUE.
--
-- DECISION D — THE `spin_id` FK-CONSISTENCY CHECK M1 ASKS FOR IS DECLARATIVE, NOT A TRIGGER.
-- `award_result_winner.spin_id` is denormalized purely so `unique (spin_id, winner_entry_id)` can
-- exist at all, which means it can DISAGREE with its own `award_result`'s `spin_id` — and a row that
-- disagreed would silently exempt itself from the anti-sweep constraint, i.e. defeat the entire
-- purpose of the denormalization. `award_result` therefore carries a redundant `unique (id, spin_id)`
-- and the child's FK is COMPOSITE. Postgres then makes disagreement unrepresentable, at every
-- isolation level, with no trigger to get wrong and no ordering to reason about.
--
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO INSERT, UPDATE or DELETE of any `spin` / `award_result` / `award_result_winner` row, NO
--     writer RPC, NO `spin.live_award_ids` content, NO `spin_plan` content or shape, NO
--     `revealed_at` gating logic, NO `ceremony.state` transition -> 6.8. This story lands the SHAPE.
--   * NO reveal-gated RLS policy and NO grant to anon/authenticated -> 6.8 (DECISION B).
--   * NO `verification_bundle`, NO `bundle_sha256`, NO RFC-8785 canonicalization, NO
--     `algorithm_version` publication -> 6.9. ⚠ Note the collision and leave it: the column is
--     `ceremony.luck_weight_table`, the spine calls it `luck.weight_table` and the bundle key is
--     `luck` — three names for one parameter, and the bundle key is outcome-affecting for
--     `bundle_sha256`. RECORDED here; canonicalizing it is 6.9's.
--   * NO pity `spin` row content and NO consolation award -> 6.7. `spin.kind` admits 'pity' because
--     SOLUTION-DESIGN:209 declares the closed set; nothing writes one here.
--   * NO ceremony UI, wheel, trophy shelf or i18n string -> 6.10. `/ceremonia` stays 5.7's
--     <Placeholder>.
--   * NO change to `public.leaderboard` (0021) or to its `24`/`20` FR-21 floor literals. Story 6.6
--     MEASURES eligibility again (0/28 clear them) and moves nothing — the fourth story in a row to
--     do so.
--   * NO change to `award`, `roster_entry`, `ceremony`'s existing columns, or ANY applied migration.
--     `ceremony.luck_weight_table` gains a DEFAULT and a CHECK below; its type and nullability are
--     0024's and are untouched.
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 / 0024:173-181 — READ BEFORE CHANGING
-- `ceremony_luck_weight_table_valid`). An immediate validated CHECK cannot apply to a database that
-- already holds a violating row, and `supabase db reset` structurally CANNOT catch that (it rebuilds
-- from empty). `luck_weight_table` is a SHELL that 0024 created and explicitly declared unwritten by
-- anybody ("`algorithm_version`, `spin_plan` and `luck_weight_table` are SHELLS — created here,
-- written by NOBODY in this story", 0024:191-193), and Story 6.6 is the first writer. So every
-- existing row has `luck_weight_table IS NULL`, the `t is null` disjunct holds for all of them, and
-- the CHECK applies cleanly. The CHECK is added BEFORE the default and the backfill deliberately, so
-- the values this migration writes are themselves validated by the constraint it just installed.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 6 — `spin`: one wheel-turn of the ceremony.
-- ════════════════════════════════════════════════════════════════════════════
-- Columns are EXACTLY SOLUTION-DESIGN.md:205-213 — same names, same types, same closed set. Every
-- CHECK is NAMED: all CHECKs raise the same 23514, so a pgTAP `throws_ok` on the SQLSTATE alone would
-- prove almost nothing (the trap the 4.3 review found across three suites and 6.1 re-hit). The suite
-- asserts the constraint NAME.
create table spin (
  id             bigint generated always as identity primary key,
  ceremony_id    bigint not null references ceremony(id) on delete cascade,   -- AD-18 scope
  spin_index     int not null,
  kind           text not null,
  live_award_ids jsonb,                 -- Stage-1 luck output; CONTENT is 6.8's (out of scope above)
  revealed_at    timestamptz,           -- the AD-22 reveal-gating axis; the POLICY is 6.8's

  -- The closed set (SPINE:234 "closed-set text columns are CHECK-constrained enums"). 'pity' is
  -- declared because SOLUTION-DESIGN:209 declares it; Story 6.7 is what writes one.
  constraint spin_kind_valid check (kind in ('main', 'pity')),

  -- ⭐ ONE ROW PER (ceremony, index). This is also what makes a re-run of spin N an UPDATE-or-replace
  -- rather than an append — see the delete-prior-on-rerun contract on `award_result` below.
  constraint spin_ceremony_index_key unique (ceremony_id, spin_index)
);

comment on table public.spin is
  'AD-14 / FR-25: one wheel-turn of the awards ceremony. `live_award_ids` is Stage 1''s seeded '
  'weighted pick in DRAW order (which is the REVEAL order, EXPERIENCE.md:162-173) and `revealed_at` '
  'is AD-22''s reveal-gating axis — both are written by Story 6.8, never by 6.6, which lands only '
  'the shape. Admin-only by the ABSENCE of any anon/authenticated grant AND of any policy: 6.8 '
  'WIDENS this with the reveal-gated read, it never tightens it.';

alter table public.spin enable row level security;
alter table public.spin force  row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 6 — `award_result`: what ONE live award concluded in ONE spin.
-- ════════════════════════════════════════════════════════════════════════════
create table award_result (
  id                   bigint generated always as identity primary key,
  spin_id              bigint not null references spin(id) on delete cascade,
  -- ⚠ NAMED, not left to Postgres's `<table>_<column>_fkey` autogeneration. The pgTAP suite asserts
  -- the CONSTRAINT NAME in every negative test's message (every FK violation is the same 23503), and
  -- an auto-named constraint forces the test to either hard-code a generated name or drop the
  -- assertion to a bare code — which is what it did, and what the code review caught.
  award_id             bigint not null
    constraint award_result_award_fk references award(id) on delete restrict,

  -- ⛔ DISPLAY ONLY, NEVER AN INPUT TO RESOLUTION (SOLUTION-DESIGN:219). `worker/awards/stage2.go`
  -- carries the identical warning on the type: the winner is a function of the frozen snapshot, and
  -- a rendered value that disagreed with it would be a display bug, never a different result.
  deciding_value       numeric,
  is_pity              boolean not null default false,
  -- DERIVED from the winner count, and ASSERTED against it — see DECISION C and the trigger below.
  is_shared            boolean not null default false,
  tie_ladder_exit_step int,

  -- The FR-29 rungs are a closed set of five, and NULL means "no ladder was involved". Story 6.5
  -- measured that a ladder reaching the RIGHT player by the WRONG rung ships a false explanation to
  -- the audience, so the column is constrained rather than left an open `int`.
  --
  -- ⛔⛔ THE WRITER MUST MAP THE ENGINE'S `0` TO SQL `NULL`. THIS IS A CONTRACT, NOT A CONVENTION,
  -- AND IT IS STATED HERE BECAUSE 6.8 OWNS THE WRITER AND WOULD OTHERWISE DISCOVER IT AS A 23514.
  -- Both runtimes carry an ALWAYS-PRESENT exit step whose no-ladder value is the integer ZERO
  -- (`LadderExitNone = 0` in `stage2.go`; the same sentinel in `lib/roulette`), and 30 of the 36
  -- result rows in `antisweep-resolve.json` carry `"ladder_exit_step": 0`. A writer that inserts the
  -- engine's value verbatim therefore violates this CHECK on the overwhelmingly common row.
  --
  -- ⚠ WHY NULL RATHER THAN WIDENING THE CHECK TO `between 0 and 5`: NULL is SQL's own spelling of
  -- "this does not apply", it is what makes `count(tie_ladder_exit_step)` and `where
  -- tie_ladder_exit_step is not null` mean "awards a ladder actually decided", and a magic zero
  -- inside the database would be a FOURTH spelling of "no rung" on top of the three
  -- `deferred-work.md:307` already tracks. The mapping belongs at the seam, once, in the writer:
  --     tie_ladder_exit_step := nullif(outcome.ladder_exit_step, 0)
  constraint award_result_ladder_exit_step_valid
    check (tie_ladder_exit_step is null or tie_ladder_exit_step between 1 and 5),

  constraint award_result_spin_award_key unique (spin_id, award_id),

  -- ⭐ DECISION D — REDUNDANT BY DESIGN. It exists ONLY so `award_result_winner` can carry a
  -- COMPOSITE foreign key on (award_result_id, spin_id), which is what makes a child's denormalized
  -- `spin_id` unable to disagree with its parent's. Without it the denormalization — whose entire
  -- purpose is the anti-sweep UNIQUE — could be silently defeated one row at a time.
  constraint award_result_id_spin_key unique (id, spin_id)
);

comment on table public.award_result is
  'FR-25/FR-29: one live award''s outcome within one spin. `is_shared` is DERIVED from the number '
  'of award_result_winner rows and is asserted against it at COMMIT by '
  'award_result_is_shared_consistent (IC909), closing review-data-integrity.md M1(1). '
  '⛔ DELETE-PRIOR-ON-RERUN IS A CONTRACT, NOT ADVICE: re-running a spin MUST delete that spin''s '
  'prior award_result rows (which cascade to award_result_winner) BEFORE re-inserting. With '
  'unique (spin_id, winner_entry_id) in place a re-run that does not clean up HARD-FAILS on insert '
  'rather than accumulating, so the contract is enforced rather than documented. '
  'Nothing writes a row here until Story 6.8.';

alter table public.award_result enable row level security;
alter table public.award_result force  row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 6 — `award_result_winner`: 1..N rows = the co-winner shape (FR-29.5).
-- ⭐⭐ THE POINT OF THIS MIGRATION IS THE SECOND UNIQUE BELOW.
-- ════════════════════════════════════════════════════════════════════════════
create table award_result_winner (
  id              bigint generated always as identity primary key,
  award_result_id bigint not null,
  -- ⭐ DENORMALIZED FROM award_result, AND ITS ONLY PURPOSE IS THE ANTI-SWEEP UNIQUE. A unique index
  -- cannot span a join, so the spin has to be ON this row for the constraint to be expressible at
  -- all (review-data-integrity.md:185-189 says exactly that). DECISION D is what keeps it honest.
  spin_id         bigint not null references spin(id) on delete cascade,
  -- ⚠ NAMED for the same reason as `award_result_award_fk` above: the suite asserts constraint names.
  winner_entry_id bigint not null
    constraint award_result_winner_entry_fk references roster_entry(id) on delete restrict,

  -- DECISION D — the COMPOSITE parent FK. `on delete cascade` mirrors the single-column FK
  -- SOLUTION-DESIGN:228 declares; the second column is what makes disagreement unrepresentable.
  constraint award_result_winner_result_fk
    foreign key (award_result_id, spin_id)
    references award_result (id, spin_id) on delete cascade,

  -- One row per (result, player): a co-winner is listed once.
  constraint award_result_winner_result_key unique (award_result_id, winner_entry_id),

  -- ⭐⭐ FR-26 / AD-14, DB-ENFORCED (SPINE:234): AT MOST ONE TROPHY PER PLAYER PER SPIN.
  --
  -- ⛔ THIS CONSTRAINT MUST NEVER FIRE. Anti-sweep is enforced in the pure producer pass, which
  -- removes an already-assigned player from every LATER candidate set BEFORE Stage 2 runs — so a
  -- shared co-winner set cannot contain an already-assigned player BY CONSTRUCTION rather than by
  -- defensive trimming (review-data-integrity.md M1(3)).
  --
  -- ⚠ THE SCOPE OF "BY CONSTRUCTION", STATED EXACTLY, because the first version of this comment
  -- overstated it and the code review caught that. It holds for every outcome the pass BUILDS:
  -- `ResolveStage2` only ever sees the reduced candidate set, so it cannot return a player who is
  -- already holding a trophy this spin. The FR-29 ladder, however, is an INJECTED PORT (6.9's
  -- browser verifier reimplements it), and a port is not construction — so the pass now also CHECKS
  -- every winner it gets back for membership in the set the award actually competed over, in both
  -- runtimes, before anyone is assigned. Construction covers the producer's own arithmetic; the
  -- membership check covers the port; this constraint covers the writer. Three lines, named.
  --
  -- This is the second line: M1(2) measured
  -- that a producer bug, or a re-run that failed to clean prior rows, could award one player two
  -- trophies in one spin "with nothing in the schema to catch it". Now there is.
  --
  -- ⚠ IT IS PER SPIN, NOT PER AWARD_RESULT, and that is the whole shape: one award can legitimately
  -- hand out SEVERAL trophies (FR-29's rung 5 shares), so the per-result UNIQUE above cannot express
  -- the rule. "Co-winners all count" (SOLUTION-DESIGN:427).
  constraint award_result_winner_spin_key unique (spin_id, winner_entry_id)
);

comment on table public.award_result_winner is
  '1..N rows per award_result = the FR-29.5 co-winner shape. `spin_id` is denormalized from the '
  'parent for ONE reason: unique (spin_id, winner_entry_id) — FR-26/AD-14''s "at most one trophy '
  'per player per spin", DB-enforced (SPINE:234). It is a BACKSTOP that must never fire: the '
  'producer pass (worker/awards/sweep.go, lib/roulette/sweep.ts) removes an assigned player from '
  'every later candidate set before Stage 2 runs, so the violation is impossible by construction. '
  'The composite FK to award_result (id, spin_id) is what stops a row exempting itself from the '
  'constraint by carrying a spin_id its parent disagrees with. Nothing writes a row here until '
  'Story 6.8.';

alter table public.award_result_winner enable row level security;
alter table public.award_result_winner force  row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 6 — DECISION C: `is_shared` cannot drift.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ A DEFERRED CONSTRAINT TRIGGER, ON BOTH TABLES, CHECKED AT COMMIT. A real writer necessarily
-- passes through an intermediate state where the result row exists and its winners do not, so an
-- IMMEDIATE check would make the only sane insert order illegal and force a shuffle — the same
-- reasoning `award_tournament_priority_key` is DEFERRABLE for (0023:144-150). What is checked is the
-- END STATE, which is the thing M1 is about.
--
-- ⚠ IT RETURNS EARLY WHEN THE PARENT IS GONE. A DELETE of an `award_result` cascades to its winners
-- and fires this trigger for each removed child; at COMMIT the parent no longer exists, and asserting
-- a flag on a row that was deliberately deleted would make every legal delete-prior-on-rerun fail.
create or replace function public.assert_award_result_is_shared() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_ids bigint[];
  target_id  bigint;
  flag       boolean;
  n          int;
begin
  -- ⚠ BOTH PARENTS ON AN UPDATE, NOT JUST THE NEW ONE. The first version took `new.award_result_id`
  -- alone, and the code review measured what that misses: moving one co-winner of a shared award to
  -- a DIFFERENT award_result (`update award_result_winner set award_result_id = B where ... = A`)
  -- leaves A holding one winner row with is_shared still true, and the trigger only ever looked at
  -- B. IC909 never fired and `is_shared` had drifted — which is precisely the M1(1) failure this
  -- function exists to close. A row that moves changes the count on BOTH sides, so both are asserted.
  if tg_table_name = 'award_result' then
    if tg_op = 'DELETE' then target_ids := array[old.id]; else target_ids := array[new.id]; end if;
  elsif tg_op = 'DELETE' then
    target_ids := array[old.award_result_id];
  elsif tg_op = 'UPDATE' then
    target_ids := array[old.award_result_id, new.award_result_id];
  else
    target_ids := array[new.award_result_id];
  end if;

  foreach target_id in array target_ids loop
    -- ⚠ NULL-SAFE: a nullable FK on either side would make `array[old, new]` carry a NULL, and
    -- `where ar.id = null` silently matches nothing rather than erroring.
    continue when target_id is null;

    select ar.is_shared into flag from public.award_result ar where ar.id = target_id;
    if not found then
      -- the parent was deleted in this same transaction; there is nothing to assert
      continue;
    end if;

    select count(*) into n from public.award_result_winner w where w.award_result_id = target_id;

    if flag <> (n > 1) then
      raise exception
        using errcode = 'IC909',
              message = 'award_result ' || target_id || ' has is_shared=' || flag ||
                        ' with ' || n || ' winner row(s) — is_shared is DERIVED from the winner '
                        'count and may not drift from it (review-data-integrity.md M1)',
              hint    = 'a sole winner is is_shared=false; two or more co-winners (FR-29 rung 5) is '
                        'is_shared=true; an award with no winner (no_eligible_players / '
                        'no_awardable_value) is is_shared=false';
    end if;
  end loop;
  return null;
end;
$$;

comment on function public.assert_award_result_is_shared() is
  'DECISION C (Story 6.6): asserts award_result.is_shared = (count(award_result_winner) > 1) at '
  'COMMIT, from both sides. Closes review-data-integrity.md M1(1) — the boolean is a derived '
  'denormalization and nothing constrained it to agree. Raises IC909.';

create constraint trigger award_result_is_shared_consistent
  after insert or update of is_shared on public.award_result
  deferrable initially deferred
  for each row execute function public.assert_award_result_is_shared();

create constraint trigger award_result_winner_is_shared_consistent
  after insert or update or delete on public.award_result_winner
  deferrable initially deferred
  for each row execute function public.assert_award_result_is_shared();

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 6 — Grants: service_role ONLY (AD-2 single writer).
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ NO anon / authenticated GRANT OF ANY KIND, deliberately absent, exactly as for audit_log /
-- app_role / stat_snapshot* (0003:82-84), `award` (0023:179-185) and `ceremony` (0024:245-253). With
-- no grant a viewer 42501s before RLS is even consulted, and with no policy it would fail there too.
-- Story 6.8 adds the grant AND the reveal-gated policy together (DECISION B).
--
-- ⚠ DELETE IS GRANTED HERE, unlike on `ceremony` (0024 withheld it deliberately). The
-- delete-prior-on-rerun contract on `award_result` REQUIRES it: with
-- unique (spin_id, winner_entry_id) in place, a re-run that does not first delete the spin's prior
-- results hard-fails on insert, so DELETE is the mechanism that makes a re-run possible at all. The
-- FK cascades do the rest.
grant select, insert, update, delete on public.spin                to service_role;
grant select, insert, update, delete on public.award_result        to service_role;
grant select, insert, update, delete on public.award_result_winner to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (b) Task 5 — the luck-meter's VALUES: `ceremony.luck_weight_table` stops being a SHELL.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ WHY THE VALUES LIVE HERE AND NOWHERE ELSE. FR-26's luck meter indexes this table by the
-- winner's trophy-shelf size: `luck_weight_table[min(shelf, table_max)]`, empty shelf ⇒ heaviest
-- (SOLUTION-DESIGN:406-411). Both engine halves validate the table's SHAPE and are forbidden from
-- SEEDING one — `worker/awards/stage1.go:224-227` says so in as many words ("its VALUES are
-- organizer config and belong to 6.6/6.8; this file validates its SHAPE and never seeds one"), and
-- `lib/roulette` must not read a database at all. So the single definition site is this column, and
-- an organizer can re-tune the ceremony's underdog bias without a code change.
--
-- ⚠ THE VALUES ARE SOLUTION-DESIGN §9.2's OWN EXAMPLE TABLE (`:409`), adopted deliberately by Cuatro
-- (2026-08-07) rather than sized to the measured shelf ceiling, and the reachability measurement is
-- recorded in the story's Completion Notes rather than narrated here. `table_max` is 5, so a shelf of
-- 5 means one player holding five trophies — which is exactly the sweep FR-26 exists to dampen. A
-- table whose tail is rarely reached is not wrong; shipping it while calling it measured would be.
--
-- ⛔ THE CHECK IS THE SAME THREE RULES `validateWeightTable` ENFORCES IN BOTH RUNTIMES, and each
-- clause earns its place there and here:
--   * a NON-DECREASING table INVERTS FR-26's bias — the meter would favour the player who already
--     holds the most trophies, which is the exact opposite of the underdog rule, and nothing
--     downstream would look wrong;
--   * a `0` or negative entry makes a candidate unpickable while it still occupies the cumulative
--     walk, so the pool silently shrinks with no refusal anywhere;
--   * an empty table has no index 0 to give the empty shelf.
-- Enforcing them at the one place the values live means a hand-edited row cannot publish a ceremony
-- whose luck meter runs backwards.
-- ⚠⚠ WRITTEN AS A TOTAL `case`, NOT AS A CHAIN OF `and`s, AND THE pgTAP SUITE IS WHY. The first
-- draft was `t is null or (array_ndims(t) = 1 and …)`, which ACCEPTED AN EMPTY TABLE: `array_ndims`
-- and `array_length` both return NULL for `array[]::int[]`, so the whole conjunction evaluated to
-- NULL, and a CHECK whose expression is NULL is SATISFIED. The one shape most obviously fatal to
-- FR-26 — no index 0 to give the empty shelf — was the one shape the guard let through, and it
-- looked completely correct. Every branch below therefore `coalesce`s to a concrete value and the
-- function can only return true or false.
create or replace function public.luck_weight_table_valid(t int[]) returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when t is null                                            then true
    when coalesce(array_ndims(t), 0) <> 1                     then false
    when coalesce(array_lower(t, 1), 0) <> 1                  then false
    -- ⚠⚠ TWO ENTRIES, NOT ONE — AND THIS IS THE CLAUSE THE CODE REVIEW ADDED. A single-entry table
    -- passes every OTHER rule here and in both runtimes' `validateWeightTable`: "strictly
    -- decreasing" is VACUOUSLY true when there is no pair to compare, so `generate_subscripts`
    -- yields only `i = 1` and the `i > 1` predicate never runs. `array[100]` was therefore a legal
    -- luck weight table that clamps EVERY shelf to index 0, gives every candidate the same weight,
    -- and turns FR-26's underdog bias silently OFF with nothing red anywhere.
    --
    -- ⛔ THE ENGINE STILL ACCEPTS IT, DELIBERATELY. `validateWeightTable`'s accepted domain is
    -- 6-4b's shipped Stage-1 contract and narrowing it is a cross-cutting change to a refusal
    -- surface pinned in `stage1-pick.json` — out of this story's scope. The refusal belongs where
    -- the VALUES live, which is this column: the engine validates a SHAPE, the database validates
    -- the ORGANIZER CONFIG. The anchor asserts both halves of that split so it is a stated rule
    -- rather than a gap (`generate_vectors.py`, next to `_assert_weight_bias`).
    when coalesce(array_length(t, 1), 0) < 2                  then false
    when exists (select 1 from unnest(t) as v where v is null or v <= 0) then false
    when exists (
      select 1 from generate_subscripts(t, 1) as i where i > 1 and t[i] >= t[i - 1]
    )                                                         then false
    else true
  end
$$;

comment on function public.luck_weight_table_valid(int[]) is
  'FR-26''s luck weight table: AT LEAST TWO entries, 1-based, strictly DECREASING, every entry > 0. '
  'The three shape rules worker/awards/stage1.go''s validateWeightTable and lib/roulette/stage1.ts''s '
  'enforce at resolution time, enforced here at the one place the VALUES live — PLUS the >= 2 rule, '
  'which is this column''s alone: a one-entry table is a legal SHAPE (strictly-decreasing is vacuous '
  'over a single element) but not a usable luck meter, because it clamps every shelf to index 0 and '
  'turns FR-26''s bias off silently. The engine validates a shape; the database validates the '
  'organizer config (Story 6.6, added at code review).';

-- ⛔ `IS TRUE`, NOT A BARE CALL, AND IT IS BELT AND BRACES RATHER THAN DECORATION. A CHECK whose
-- expression evaluates to NULL is SATISFIED, so a future edit that reintroduced a NULL-propagating
-- branch into the function above would silently reopen exactly the hole the pgTAP suite just found.
-- With `is true`, a NULL result is a REFUSAL — the guard fails closed rather than open.
alter table public.ceremony
  add constraint ceremony_luck_weight_table_valid
  check (public.luck_weight_table_valid(luck_weight_table) is true);

alter table public.ceremony
  alter column luck_weight_table set default array[100, 40, 16, 6, 2, 1];

-- The backfill: 0024 created the column as a SHELL written by nobody, so every existing row is NULL.
-- Guarded on `is null` anyway — a backfill that silently overwrote an organizer's tuned table would
-- change every drawn byte of that ceremony.
update public.ceremony set luck_weight_table = default where luck_weight_table is null;

comment on column public.ceremony.luck_weight_table is
  'FR-26 luck meter: integer weight per candidate award = luck_weight_table[min(shelf(provisional '
  'winner), table_max)], so an EMPTY shelf draws the HEAVIEST weight (SOLUTION-DESIGN §9.2). '
  'Strictly decreasing positive integers, heaviest first — enforced by '
  'ceremony_luck_weight_table_valid. Values shipped by Story 6.6 = SOLUTION-DESIGN §9.2''s own '
  'example table [100, 40, 16, 6, 2, 1] (table_max 5). ORGANIZER CONFIG: both engine halves take it '
  'as an injected parameter, validate its shape and never seed one, so it can be re-tuned here '
  'without a code change. ⚠ It is outcome-affecting — every drawn byte of a ceremony depends on it — '
  'and Story 6.9 publishes it in the verification bundle under the key `luck`.';
