-- supabase/migrations/0027_ceremony_run.sql
-- Logical migration 0027 — the ceremony RUN: the rows EXIST, and they cannot lie about themselves
-- (Story 6.8a, FR-25 / FR-26 / FR-28 / FR-29 / AD-6 / AD-14 / AD-15 / AD-19 / SOLUTION-DESIGN §9.2).
-- The FIFTH Epic-6 migration, and the first one that writes a row.
--
-- ⭐ THE THESIS. `0023`-`0026` built four tables that NOTHING HAS EVER WRITTEN TO — `0025`'s own table
-- comments say so twice ("Nothing writes a row here until Story 6.8") and `0024:201` created
-- `ceremony.spin_plan` as a shell "written by NOBODY". An unwritten table's constraints are
-- untested claims. This migration lands the WRITER, and with it the invariants that only become
-- reachable once rows exist: an `award_result` cannot disagree with its spin about whether it is a
-- consolation prize, a `ceremony` cannot walk its state machine backwards, and the outcome a row
-- records is the outcome the producer actually produced.
--
-- ⛔⛔ THE ACCESS POSTURE DOES NOT MOVE, AND THAT IS THIS MIGRATION'S OTHER HALF. `spin`,
-- `award_result`, `award_result_winner` and `award` still hold ZERO grants to `anon`/`authenticated`
-- and ZERO viewer policies; every one stays ENABLE+FORCE; `revealed_at` is written NULL on every row.
-- `0025:51` is a standing instruction — "⛔ Story 6.8 ADDS both halves — the grant and the policy —
-- together" — and it is honoured by 6.8b adding them together, not by 6.8a adding half of one. What
-- 6.8a buys is that the "a viewer gets 42501" assertion is finally made against NON-EMPTY tables.
--
-- WHAT IT BUILDS:
--   (a) `spin` gains `unique (id, kind)` so a child can carry a COMPOSITE FK to it.
--   (b) `award_result` gains a denormalized `kind`, that composite FK, and the CHECK that binds
--       `is_pity` to it — closing `deferred-work.md:357`.
--   (c) `award_result` gains `outcome_kind` + `deciding_num`/`deciding_den` — closing
--       `deferred-work.md:307`'s two spellings of "no rung" and giving a zero-winner row a reason.
--   (d) `assert_award_result_is_shared` becomes `security definer` and learns the outcome-kind
--       cardinality rule — closing `deferred-work.md:333`'s FAIL-OPEN.
--   (e) `ceremony` gains a forward-only transition trigger and write-once freeze columns — closing
--       `deferred-work.md:277`.
--   (f) `persist_ceremony` — the writer RPC. One transaction, or none of it (AD-6).
--
-- SQLSTATEs — 0027 declares EXACTLY ONE new code:
--   * IC910 — `ceremony_transition_valid`: an illegal `ceremony` state transition, or an attempt to
--     re-write a write-once column. ⭐ NEW, this story. IC901-IC909 are taken
--     (0015/0017/0018/0019/0024/0025).
--   ⚠ `persist_ceremony` RAISES IC910 only for genuine CORRUPTION. Every BUSINESS refusal is
--   RETURNED as `{ok:false, reason:'<snake_case>', …context}` — the 0012/0017/0023/0024 convention.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ NAMING NOTE — 0025's IN-FILE DECISION LETTERS COLLIDE WITH STORY 6.6's, AND THIS FILE REFERS
-- TO THEM BY UNAMBIGUOUS NAME RATHER THAN BY LETTER (closes `deferred-work.md:337`).
-- ════════════════════════════════════════════════════════════════════════════
-- `deferred-work.md:337` records that `0025`'s in-file DECISIONS A-D mean different things from
-- story 6.6's DECISIONS A-D, so "DECISION D" alone is ambiguous depending on which document the
-- reader arrived from. `0025` is APPLIED and must not be edited, so the renumbering is done HERE, in
-- the cross-references, exactly as Task 3 directs. Throughout this file:
--
--   0025-TABLES-ARE-6.6's  = 0025's "DECISION A" (`0025:34-42`) — 6.6 lands the table SHAPE, 6.8 widens.
--   0025-NO-POLICY-YET     = 0025's "DECISION B" (`0025:44-52`) — no RLS policy, no grant, both together at 6.8.
--   0025-IS-SHARED-ASSERTED= 0025's "DECISION C" (`0025:54-61`) — `is_shared` kept and asserted at COMMIT.
--   0025-COMPOSITE-FK      = 0025's "DECISION D" (`0025:63-69`) — the FK-consistency check is DECLARATIVE.
--
-- Story 6.6's own A-D (the anti-sweep pass's decisions) are NOT referenced in this file at all, so no
-- letter below can be read against the wrong document.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ SIX DECISIONS. Read these before changing anything below.
-- ════════════════════════════════════════════════════════════════════════════
--
-- DECISION 1 — THE `is_pity` ⇄ `spin.kind` BIND IS DECLARATIVE, NOT A TRIGGER, AND IT REPAIRS A
-- SECOND-ORDER HOLE AS A SIDE EFFECT.
-- `deferred-work.md:357` names both mechanisms and prefers this one; `0025` chose declarative twice
-- (0025-COMPOSITE-FK and the anti-sweep UNIQUE) and this file does not break that. `award_result`
-- carries a denormalized `kind`, a COMPOSITE FK `(spin_id, kind) -> spin(id, kind)`, and
-- `check ((is_pity = (kind = 'pity')) is true)`. Postgres then makes disagreement unrepresentable at
-- every isolation level, with no function to get wrong and no ordering to reason about.
-- ⭐⭐ AND THE SECOND-ORDER CONSEQUENCE IS THE ONE THAT MATTERS. `deferred-work.md:357` records that
-- because NULLs are DISTINCT in a UNIQUE, `award_result_spin_award_key` (`0025:178`) stopped bounding
-- a main spin's results AT ALL once `0026` made `award_id` nullable — unlimited award-less "pity"
-- rows could accumulate inside one `kind='main'` spin. With this bind: a row on a main spin has
-- `kind='main'`, therefore `is_pity=false`, therefore `award_result_award_or_pity` (`0026`) forces
-- `award_id IS NOT NULL`, therefore the (spin, award) UNIQUE bounds it again. The hole closes by
-- construction rather than by a second constraint.
--
-- DECISION 2 — A PERSISTED `tie` IS UNREPRESENTABLE **AND** REFUSED, AND BOTH HALVES ARE DELIBERATE.
-- Task 3 asks for one or the other and for the choice to be stated. It is both:
--   * `award_result_outcome_kind_valid` admits EXACTLY the five `OutcomeKind` values
--     (`stage2.go:226-243`), because that closed set is the contract 6.9's bundle canonicalizes
--     against and narrowing it here would make the column and the engine disagree about the
--     vocabulary; and
--   * `award_result_outcome_kind_not_tie` — a SEPARATE, SEPARATELY-NAMED CHECK — refuses the one
--     member that is never a final answer. `AwardAssignment.Outcome` "can never be KindTie: every tie
--     goes through the ladder" (`sweep.go:124-127`), so a persisted `tie` is a PRODUCER bug.
--   * …and `persist_ceremony` ALSO returns a typed `{ok:false, reason:'outcome_kind_tie'}` before it
--     writes anything, because an admin who hits this deserves a reason rather than a 23514.
-- Two CHECKs rather than one narrower CHECK: the vocabulary and the persistence rule are different
-- facts, and a suite that asserts constraint NAMES can only tell them apart if they have two names.
--
-- DECISION 3 — THE RATE PAIR IS STORED AS TWO INTEGERS, NEVER DIVIDED (Cuatro, 2026-08-08).
-- `DecidingValue` carries `{Class, Value, Num, Den}` (`stage2.go:278`) and AD-14/AD-19 are
-- integer-only end to end: `0024:690-691` "refuses to divide them, because a `numeric` quotient is
-- not reproducible across two runtimes". The alternative weighed and rejected was writing
-- `num::numeric / den::numeric` into the existing `deciding_value`: exact in SQL, but it cannot
-- ROUND-TRIP to the pair 6.9's bundle must publish. So `deciding_value` keeps carrying the VOLUME
-- magnitude and the two new columns carry the RATE pair. ⛔ Both remain DISPLAY ONLY
-- (`0025:149-151`, SOLUTION-DESIGN:219) — nothing re-derives a winner from them.
--
-- DECISION 4 — THE `ceremony` TRANSITION TRIGGER GUARDS THE STATE MACHINE AND THE TWO FROZEN
-- COLUMNS; IT IS **NOT** A COLUMN ALLOWLIST, AND THAT DIVERGES FROM ONE READING OF THE TASK.
-- Task 3 suggests permitting "exactly those columns to move, and nothing else", reading `0024:251`'s
-- "6.4/6.8 need UPDATE for state/spin_plan". ⛔ A `state`+`spin_plan`-only allowlist BREAKS THE ONLY
-- SHIPPED CEREMONY WRITER: `lock_ceremony`'s `on conflict do update` sets `state`,
-- `seed_demo_sha256`, `snapshot_id` AND `started_at` in one statement (`0024:815-819`), and `0025:450`
-- backfills `luck_weight_table`. It would also pre-refuse 6.9's `algorithm_version` and 6.8b's
-- `completed_at`, both of which `0024:200` declares as shells for exactly those stories.
-- So what is enforced is AC6 as WRITTEN, which is the substance of `deferred-work.md:277`:
--   * `state` moves only FORWARD, one step at a time: not_started -> locked -> spinning -> complete.
--     Never backward, never skipping. A no-op UPDATE that does not touch `state` is unaffected.
--   * `snapshot_id` and `seed_demo_sha256` are WRITE-ONCE once non-NULL (NULL->value freezes,
--     value->same-value is a no-op, value->different and value->NULL are IC910).
--   * `tournament_id` is immutable — it is the AD-18 scope key, and moving a ceremony between
--     tournaments would silently re-point every spin under it.
-- Everything else stays writable, which is what keeps `0024` and `0025` working and what 6.8b/6.9
-- need. `deferred-work.md:277`'s actual complaint — "`update ceremony set state='not_started'`
-- re-opens all four `ceremony_locked` guards and `catalog_frozen`" — is closed exactly.
--
-- DECISION 5 — `award_result_winner_result_key` STAYS, AND ITS JUSTIFICATION IS REWRITTEN.
-- `deferred-work.md:334` is correct that it can never REFUSE anything: 0025-COMPOSITE-FK forces every
-- child's `spin_id` to equal its parent's, so two rows sharing `award_result_id` necessarily share
-- `spin_id` and `award_result_winner_spin_key` fires first. Task 3 permits "drop it or document why
-- it stays". ⭐ IT STAYS, FOR A REASON THAT IS NOT THE ONE `0025` GAVE: it is the INDEX that
-- `assert_award_result_is_shared`'s `count(*) … where w.award_result_id = target_id` scans, and that
-- function now runs on every winner row of every ceremony. Dropping the constraint would drop the
-- index with it and leave the hot path on a sequential scan. Recorded as a comment on the constraint
-- below so the next reader finds the real reason attached to the object rather than in a story file.
--
-- DECISION 6 — THE CODE-REVIEW DECISIONS (Cuatro, 2026-08-08, adversarial review of 6.8a).
-- Three ambiguities the review surfaced, resolved by Cuatro rather than by the reviewer:
--   * ⭐ THE CARDINALITY TRIGGER FAILS CLOSED ON AN UNKNOWN OUTCOME KIND. `assert_award_result_is_
--     shared`'s `if` chain gains an `elsif … not in (…) then raise` arm. This file previously argued
--     BOTH sides of this — the AC7 block defended omitting the arm while `assert_ceremony_transition`
--     added exactly that arm eighty lines later — and the fail-closed convention wins in both. The
--     vocabulary test is re-cut to assert the constraint definition names EXACTLY five values, since
--     counting how many of five EXPECTED literals appear can never see a sixth.
--   * ⭐ `spin_plan[].pool` AWARD IDS ARE RESOLVED against the frozen catalog like every other award
--     id, closing the gap between this function's "VALIDATED, NOT TRUSTED" thesis and the one field
--     it published verbatim. Ceremony-WIDE award uniqueness (the UNIQUE is per spin, so the same
--     trophy twice in one ceremony is representable) is NOT added here — homed to 6.9, which hashes
--     these bytes and would catch it in the bundle. Recorded in `deferred-work.md`.
--   * ⭐ `label` / `bytes_consumed` STAY ON THE WIRE AND STAY UNPERSISTED, documented at the write
--     loop below rather than left as an unexplained omission. Columns homed to 6.9's
--     `verification_bundle`. The per-pity-spin duplication of the run total is fixed producer-side.
-- The review also closed a family of SQL three-valued-logic fail-opens (`string_agg` skipping NULLs,
-- `jsonb ? NULL`, `NULL not in (…)`, `coalesce` not neutralising a jsonb null) and moved four casts
-- back in front of the write boundary. Each is commented at its own site with what it used to do.
--
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO grant to anon/authenticated and NO reveal-gated RLS policy on `award` / `spin` /
--     `award_result` / `award_result_winner` -> 6.8b. 0025-NO-POLICY-YET holds: both halves together.
--   * NO `reveal_spin` RPC, NO stamping of `revealed_at`, NO `ceremony.state -> 'complete'` -> 6.8b.
--     ⭐ The transition trigger below ALREADY PERMITS `spinning -> complete`; 6.8b writes it.
--   * NO `seed_hex` commitment surface, NO viewer-readable `ceremony` row -> 6.8b.
--   * NO `ceremony_locked` extension to `begin_match_grace` / `resume_match` / `bind_match_demo`
--     (`deferred-work.md:280`) -> 6.8b.
--   * NO `award_reveal` `timeline_feed` writer (`0024:170`) -> 6.8b.
--   * NO `verification_bundle`, NO `bundle_sha256`/`bundle_hash`, NO RFC-8785 canonicalization, NO
--     `algorithm_version` publication -> 6.9. `ceremony.algorithm_version` stays the shell 0024 made.
--   * NO TypeScript ceremony orchestrator and NO new golden vector -> 6.9 / 6.11. 6.8a ships the
--     orchestrator in Go ONLY (Cuatro, 2026-08-08); `roulette/vectors/README.md` gives 6.8 no gate.
--   * NO ceremony UI, wheel, trophy shelf or i18n string -> 6.10. `/ceremonia` stays 5.7's <Placeholder>.
--   * NO change to `public.leaderboard` (0021) or to its `24`/`20` FR-21 floor literals, and NO change
--     to `lib/awards/catalog.ts`. ⛔⛔ Story 6.8a MEASURES eligibility again — 0 of 28 players clear
--     them, the FIFTH story in a row — and moves nothing (DECISION C, Cuatro, 2026-08-08). See the
--     escalation in the story's Completion Notes: this is the story where that zero becomes ROWS.
--   * NO edit to ANY applied migration 0001-0026. Shipped functions change only by
--     `create or replace` HERE, and the shipped constraint trigger is dropped and recreated HERE.
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 / 0024:173-181 / 0025:92-101 /
-- 0026:62-71 — READ BEFORE CHANGING ANY CHECK BELOW). An immediate validated CHECK cannot apply to a
-- database that already holds a violating row, and `supabase db reset` structurally CANNOT catch that
-- because it rebuilds from empty. Every new constraint here is safe for one measured reason:
-- `spin`, `award_result` and `award_result_winner` are EMPTY IN EVERY DATABASE THAT EXISTS. `0025`
-- created them declaring "nothing writes a row here until Story 6.8", `0026` added no writer, and
-- this migration is the first writer — which is also why `award_result.kind` and
-- `award_result.outcome_kind` can be added `NOT NULL` with NO DEFAULT at all (see the note on each).
-- `ceremony` is NOT empty, which is why the transition trigger is a BEFORE UPDATE trigger (it can
-- only judge a transition, never an existing row) rather than a CHECK.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) `spin` gains the redundant UNIQUE that makes a composite child FK expressible.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ REDUNDANT BY DESIGN, exactly as `award_result_id_spin_key` is (0025-COMPOSITE-FK, `0025:180-184`).
-- `id` is already the primary key, so `(id, kind)` adds no new uniqueness — it exists ONLY so
-- `award_result` can carry `foreign key (spin_id, kind) references spin (id, kind)`, which is what
-- makes a result's denormalized `kind` unable to disagree with its own spin's.
alter table public.spin
  add constraint spin_id_kind_key unique (id, kind);

comment on constraint spin_id_kind_key on public.spin is
  'REDUNDANT BY DESIGN (Story 6.8a, DECISION 1): `id` is already the PK, so this adds no uniqueness. '
  'It exists solely as the target of award_result''s COMPOSITE FK on (spin_id, kind) — the same '
  'declarative shape 0025 used to stop award_result_winner.spin_id disagreeing with its parent''s. '
  'Dropping it makes the is_pity/kind bind unrepresentable.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) `award_result.kind` — the bind that closes deferred-work.md:357.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ `NOT NULL` WITH NO DEFAULT, AND THE ABSENCE OF A DEFAULT IS THE DESIGN. A `default 'main'` would
-- be SAFE here — the composite FK below turns a wrong value into a loud 23503 rather than a silent
-- row — but it would still let a writer omit the one column this section exists to make explicit.
-- `0026`'s Section C makes the same argument for `is_pity`'s default in the other direction ("a
-- writer that simply omits is_pity gets the strict behaviour, not the lenient one"). The table is
-- empty in every database, so `NOT NULL` applies cleanly with nothing to backfill.
alter table public.award_result
  add column kind text not null;

alter table public.award_result
  add constraint award_result_spin_kind_fk
  foreign key (spin_id, kind) references public.spin (id, kind) on delete cascade;

-- ⛔⛔ WRITTEN AS `(…) IS TRUE`, AND THAT IS NOT DECORATION. A CHECK whose expression evaluates to
-- NULL is SATISFIED — `0025`'s first `luck_weight_table_valid` accepted an empty table on exactly
-- that, and `0026` fixed it the same way. Neither operand can be NULL today (`kind` and `is_pity` are
-- both NOT NULL), so the wrapper changes nothing about what this accepts; it exists so the day
-- somebody makes either column nullable, this fails LOUDLY instead of admitting every row.
alter table public.award_result
  add constraint award_result_is_pity_matches_kind
  check (((is_pity = (kind = 'pity'))) is true);

comment on column public.award_result.kind is
  'DENORMALIZED FROM spin.kind, and its ONLY purpose is the bind (Story 6.8a, DECISION 1). A unique '
  'index cannot span a join, so the spin''s kind has to be ON this row for '
  'award_result_is_pity_matches_kind to be expressible at all — the same reasoning that put spin_id '
  'on award_result_winner. award_result_spin_kind_fk is what keeps it honest: it cannot disagree '
  'with its own spin. ⭐ Closing deferred-work.md:357 also repairs a SECOND-ORDER hole — a main-spin '
  'row is now forced to carry a non-NULL award_id (via 0026''s award_result_award_or_pity), so '
  'award_result_spin_award_key bounds a main spin''s results again instead of being defeated by '
  'NULL-distinctness.';

comment on constraint award_result_is_pity_matches_kind on public.award_result is
  'FR-28 (Story 6.8a): is_pity and its parent spin.kind are the SAME FACT and may not disagree. A '
  'consolation result lives on a kind=''pity'' spin and nowhere else; a category result lives on a '
  'kind=''main'' spin and nowhere else. Enforced declaratively (composite FK + this CHECK) rather '
  'than by trigger, per deferred-work.md:357''s stated preference and 0025''s precedent.';

-- ════════════════════════════════════════════════════════════════════════════
-- (c) `award_result.outcome_kind` + the integer-form rate pair.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ WHY A ZERO-WINNER ROW NEEDS A REASON. Before this column, an `award_result` with no
-- `award_result_winner` rows could be `no_eligible_players` (nobody cleared the FR-21 floors) or
-- `no_awardable_value` (DECISION E's zero carve-out) and the schema could not tell them apart — two
-- completely different facts for 6.10's reveal copy and for 6.9's bundle. At the SHIPPED FR-21 floors
-- this is not hypothetical: 0 of 28 players clear `24`/`20`, so every main spin resolves
-- `no_eligible_players` and the honest ceremony record is twelve zero-winner rows. A record that
-- could not say WHY would be a record of nothing.
--
-- ⚠ `NOT NULL` WITH NO DEFAULT, and here the absence is load-bearing rather than stylistic: unlike
-- `kind`, a wrong `outcome_kind` is NOT caught by any FK. A default would be a fabricated answer that
-- commits silently. Safe to add because the table is empty everywhere (see the clean-apply note).
alter table public.award_result
  add column outcome_kind text not null;

-- The closed set is EXACTLY `OutcomeKind` (`stage2.go:226-243`) — five values, no more and no fewer.
-- ⚠ NAMED, because every CHECK raises 23514 and the pgTAP suite asserts the NAME (the 4.3 trap).
alter table public.award_result
  add constraint award_result_outcome_kind_valid
  check ((outcome_kind in (
    'winner', 'tie', 'no_eligible_players', 'no_awardable_value', 'shared'
  )) is true);

-- ⛔ DECISION 2 — `tie` IS IN THE VOCABULARY AND IS NEVER A PERSISTED ANSWER. `sweep.go:124-127`:
-- the outcome a spin produces "can never be KindTie: every tie goes through the ladder, which returns
-- KindWinner or KindShared". A persisted `tie` therefore means the producer skipped the FR-29 ladder,
-- which would change every drawn byte from that spin onward. Its own name, so a suite asserting
-- constraint names can tell "not a legal outcome kind" from "not a legal PERSISTED outcome kind".
alter table public.award_result
  add constraint award_result_outcome_kind_not_tie
  check (((outcome_kind <> 'tie')) is true);

-- DECISION 3 — the integer-form rate pair. Nullable: a `volume` award fills `deciding_value` and
-- leaves both of these NULL; a `rate` award fills these and leaves `deciding_value` NULL.
alter table public.award_result add column deciding_num bigint;
alter table public.award_result add column deciding_den bigint;

-- ⚠ THE PAIR IS ALL-OR-NOTHING. One half without the other is not a rate value, it is a corrupted
-- one — and `{num: 5, den: null}` would render as something rather than refusing.
alter table public.award_result
  add constraint award_result_deciding_pair_complete
  check (((deciding_num is null) = (deciding_den is null)) is true);

comment on column public.award_result.outcome_kind is
  'FR-25 (Story 6.8a): WHAT this award concluded, from the engine''s closed OutcomeKind set '
  '(worker/awards/stage2.go:226-243). ⭐ It is what makes a ZERO-WINNER row legible: '
  'no_eligible_players (nobody cleared the FR-21 floors) and no_awardable_value (DECISION E''s zero '
  'carve-out) are different facts with different reveal copy, and without this column they were the '
  'same empty row. ⛔ ''tie'' is in the vocabulary because the engine''s type is, but is never '
  'persisted — award_result_outcome_kind_not_tie refuses it, because the FR-29 ladder always '
  'resolves a tie before it reaches a row.';

comment on column public.award_result.deciding_num is
  'AD-19 integer-form rate pair, numerator (Story 6.8a, DECISION 3). A rate award''s deciding value '
  'is {num, den} and is NEVER pre-divided — 0024:690-691 refuses to divide because a numeric '
  'quotient is not reproducible across two runtimes, and a divided value cannot round-trip to the '
  'pair Story 6.9''s bundle publishes. A volume award leaves this NULL and fills deciding_value '
  'instead. ⛔ DISPLAY ONLY, like deciding_value (SOLUTION-DESIGN:219).';

comment on column public.award_result.deciding_den is
  'AD-19 integer-form rate pair, denominator. See deciding_num. ⚠ A den of 0 is CORRECT and '
  'reachable (worker/awards/stage2.go:136-137), not a defect to coalesce away.';

-- ════════════════════════════════════════════════════════════════════════════
-- (d) `assert_award_result_is_shared` — the FAIL-OPEN fixed, and the cardinality rule added.
-- ════════════════════════════════════════════════════════════════════════════
-- ⛔⛔ THE BUG BEING FIXED (`deferred-work.md:333`). The shipped function is `security invoker` and
-- runs against tables that are `FORCE ROW LEVEL SECURITY` with ZERO policies. Under an invoking role
-- without BYPASSRLS:
--   * `select ar.is_shared … where ar.id = target_id` finds NOTHING, and the `if not found then
--     continue` branch reads that as "the parent was deleted in this transaction" — so the assertion
--     is SKIPPED rather than failed. It conflates INVISIBLE with DELETED.
--   * `count(*)` over an RLS-filtered child set returns a FILTERED count, so even a visible parent is
--     asserted against the wrong number.
-- It has been safe only because the sole writer is `service_role`, which has BYPASSRLS. 6.8b adds the
-- viewer policy; the fix is taken NOW, before that policy exists, exactly as Task 3 directs.
--
-- ⭐ `security definer` IS THE RIGHT TOOL HERE AND IT IS NOT A WIDENING. The house rule
-- (`0023:196-198`) reserves definer for "anon-reachable narrow reads" and warns that widening one
-- "has broken AD-22". This is neither: it is a CONSTRAINT TRIGGER function, unreachable from the Data
-- API, whose entire job is to count rows the caller is not otherwise reading. Running it as the owner
-- makes it see the true state of the two tables it asserts over — a FAIL-CLOSED fix, not an exposure.
-- `set search_path = ''` (was `= public`) and every reference schema-qualified, per the definer rule.
--
-- ⚠⚠ AND THE FIX DEPENDS ON THE OWNER'S `BYPASSRLS`, WHICH IS WORTH STATING BECAUSE IT IS NOT
-- OBVIOUS (Story 6.8a code review). `award_result` and `award_result_winner` are FORCE ROW LEVEL
-- SECURITY, and FORCE — unlike plain ENABLE — applies RLS to the table OWNER as well. So
-- `security definer` ALONE does not make this function see every row; what does is that the owner
-- role carries the `BYPASSRLS` attribute. On this platform migrations are applied as `postgres`,
-- which has it, and Section G of the pgTAP suite proves the mechanism end to end by driving the
-- trigger as a NON-BYPASSRLS role. ⛔ If this function is ever reassigned to an owner without
-- BYPASSRLS it reverts to the deferred-work.md:333 fail-open with the suite still green, so the
-- suite now asserts the owner attribute directly rather than relying on it silently.
--
-- ⭐ WIDENED WITH THE OUTCOME-KIND CARDINALITY RULE (AC7). A CHECK cannot count child rows, so
-- "winner/shared ⇒ at least one winner row" has to live here, next to the count it already takes.
-- ⚠⚠ THE `is_shared` CHECK RUNS FIRST, DELIBERATELY. `0025`'s pgTAP pins IC909's MESSAGE by pattern
-- ('%is_shared is DERIVED from the winner count%'), and a row that is wrong in both ways must keep
-- reporting the `is_shared` fact so that suite keeps testing what it says it tests.
create or replace function public.assert_award_result_is_shared() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_ids bigint[];
  target_id  bigint;
  flag       boolean;
  okind      text;
  n          int;
begin
  -- BOTH PARENTS ON AN UPDATE, NOT JUST THE NEW ONE — 0025's own correction, preserved verbatim in
  -- behaviour: moving one co-winner to a DIFFERENT award_result changes the count on both sides.
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
    -- NULL-SAFE: `where ar.id = null` silently matches nothing rather than erroring.
    continue when target_id is null;

    -- ⭐ NOW GENUINELY MEANS "THE PARENT WAS DELETED IN THIS TRANSACTION". Under `security definer`
    -- the owner sees every row, so `not found` can no longer mean "invisible under RLS" — which is
    -- what made this branch fail OPEN.
    select ar.is_shared, ar.outcome_kind
      into flag, okind
      from public.award_result ar
     where ar.id = target_id;
    if not found then
      continue;
    end if;

    select count(*) into n
      from public.award_result_winner w
     where w.award_result_id = target_id;

    -- ── 0025-IS-SHARED-ASSERTED, unchanged and FIRST (see the note above). ──
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

    -- ── AC7 (Story 6.8a): the OUTCOME KIND and the winner count are the same fact twice. ──
    -- ⚠ `tie` is absent from the arms below because award_result_outcome_kind_not_tie makes it
    -- unrepresentable (DECISION 2).
    -- ⭐⭐ THE `else` ARM IS A GUARD, NOT DEAD CODE, AND THIS FILE PREVIOUSLY ARGUED BOTH SIDES
    -- (Story 6.8a code review, DECISION 6). The earlier comment defended omitting it on the grounds
    -- that `tie` is already unrepresentable — but `tie` was never the fail-open case. An UNKNOWN
    -- SIXTH VALUE was: an `if` chain with no fallthrough silently SATISFIES the assertion for any
    -- outcome_kind it does not name, at ANY winner count. The moment a sixth member joins
    -- `award_result_outcome_kind_valid` — which `0027`'s own header anticipates, since that closed
    -- set is the engine/DB contract 6.9 canonicalizes against — the new value would pass with zero,
    -- one or fifty winner rows. `assert_ceremony_transition` sixty lines below reasons the opposite
    -- way about the identical situation ("Unreachable while ceremony_state_valid holds; present
    -- because this function must fail closed if it ever does not"), and that is the convention this
    -- file now follows in BOTH triggers.
    if (okind in ('winner')          and n <> 1)
       or (okind in ('shared')       and n < 2)
       or (okind in ('no_eligible_players', 'no_awardable_value') and n <> 0) then
      raise exception
        using errcode = 'IC909',
              message = 'award_result ' || target_id || ' records outcome_kind=' || okind ||
                        ' with ' || n || ' winner row(s) — the outcome kind and the winner '
                        'cardinality are the same fact and may not disagree',
              hint    = 'winner = exactly 1; shared = 2 or more (FR-29 rung 5); '
                        'no_eligible_players / no_awardable_value = 0';
    elsif okind not in ('winner', 'shared', 'no_eligible_players', 'no_awardable_value') then
      raise exception
        using errcode = 'IC909',
              message = 'award_result ' || target_id || ' records outcome_kind=' || okind ||
                        ', which this assertion does not know how to check against its ' || n ||
                        ' winner row(s) — refusing rather than passing an unchecked outcome',
              hint    = 'an outcome kind added to award_result_outcome_kind_valid must also be '
                        'given a cardinality rule in assert_award_result_is_shared';
    end if;
  end loop;
  return null;
end;
$$;

comment on function public.assert_award_result_is_shared() is
  '0025-IS-SHARED-ASSERTED + AC7 (Story 6.8a): asserts award_result.is_shared = '
  '(count(award_result_winner) > 1) AND that outcome_kind agrees with the same count, at COMMIT, '
  'from both sides. Raises IC909. ⭐ security DEFINER since 0027 (deferred-work.md:333): under FORCE '
  'RLS with zero policies the invoker form conflated "parent deleted" with "parent invisible" and '
  'counted an RLS-filtered child set — it failed OPEN, and was safe only because the sole writer '
  'holds BYPASSRLS. 6.8b adds the viewer policy, so the fix is taken before it exists.';

-- LEAST PRIVILEGE on a `security definer` function (the 6.1 code-review lesson, restated at
-- 0024:372-377): `create function` grants EXECUTE to PUBLIC and anon/authenticated inherit it. A
-- trigger function does not need an EXECUTE grant to FIRE, so revoking costs nothing and closes the
-- direct-call path entirely.
revoke execute on function public.assert_award_result_is_shared() from public;

-- ⚠ THE CONSTRAINT TRIGGER IS RECREATED, NOT ALTERED, because a trigger's column list cannot be
-- changed in place. Same name, same deferral, same timing — plus `outcome_kind` in the UPDATE OF
-- list, without which flipping ONLY the outcome kind would slip past the rule added above.
drop trigger award_result_is_shared_consistent on public.award_result;
create constraint trigger award_result_is_shared_consistent
  after insert or update of is_shared, outcome_kind on public.award_result
  deferrable initially deferred
  for each row execute function public.assert_award_result_is_shared();

-- DECISION 5 — the subsumed UNIQUE stays, with its real justification attached to the object.
comment on constraint award_result_winner_result_key on public.award_result_winner is
  '⚠ THIS CONSTRAINT CAN NEVER REFUSE ANYTHING, and that is recorded rather than hidden '
  '(deferred-work.md:334, resolved by Story 6.8a as DECISION 5). 0025''s composite FK forces every '
  'child''s spin_id to equal its parent''s, so two rows sharing award_result_id necessarily share '
  'spin_id and award_result_winner_spin_key fires first. ⭐ IT IS KEPT FOR ITS INDEX, not for its '
  'uniqueness: assert_award_result_is_shared counts winners by award_result_id on every row of every '
  'ceremony, and dropping the constraint would drop the only index supporting that scan.';

-- ════════════════════════════════════════════════════════════════════════════
-- (e) `ceremony` — AD-15 by MECHANISM instead of by comment (deferred-work.md:277).
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐⭐ WHY A TRIGGER AND NOT A POLICY OR A REVOKE. `service_role` has BYPASSRLS, so a row POLICY
-- cannot hold this line — the same argument `tournament_fair_seed_write_once` makes at `0024:269-273`.
-- And "just don't grant UPDATE" is not available either: `0024:250-251` grants UPDATE deliberately
-- because 6.4/6.8 need `state` and `spin_plan` to move. A BEFORE UPDATE trigger binds every writer
-- including `service_role` and `postgres`.
--
-- ⚠ THE ORDER OF THE STATES IS DATA, NOT A CHAIN OF `if`s. `array_position` over the ordered set
-- gives "forward by exactly one" in a single comparison, and a fifth state added to
-- `ceremony_state_valid` without being added here would produce a NULL position and be REFUSED — the
-- fail-closed direction.
create or replace function public.assert_ceremony_transition() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  states text[] := array['not_started', 'locked', 'spinning', 'complete'];
  old_at int;
  new_at int;
begin
  -- ── 1. The state machine: forward, one step, never backward, never skipping. ──
  if new.state is distinct from old.state then
    old_at := array_position(states, old.state);
    new_at := array_position(states, new.state);

    -- A state outside the declared order is refused rather than passed through. Unreachable while
    -- `ceremony_state_valid` holds; present because this function must fail closed if it ever does not.
    if old_at is null or new_at is null then
      raise exception
        using errcode = 'IC910',
              message = 'ceremony ' || old.id || ' transition ' || coalesce(old.state, '<null>') ||
                        ' -> ' || coalesce(new.state, '<null>') || ' names a state outside the '
                        'declared order (not_started, locked, spinning, complete)',
              hint    = 'a state added to ceremony_state_valid must also be added to '
                        'assert_ceremony_transition''s ordered array';
    end if;

    if new_at <> old_at + 1 then
      raise exception
        using errcode = 'IC910',
              message = 'ceremony ' || old.id || ' cannot move ' || old.state || ' -> ' || new.state ||
                        ' — the AD-15 state machine advances forward one step at a time',
              hint    = 'legal transitions are not_started -> locked -> spinning -> complete; going '
                        'backward would re-open the four ceremony_locked guards and catalog_frozen '
                        'after the snapshot was captured (deferred-work.md:277)';
    end if;
  end if;

  -- ── 2. The two frozen columns: WRITE-ONCE once non-NULL. ──
  -- ⚠ THE `is distinct from` FORM PERMITS value -> THE SAME VALUE as a no-op, exactly as
  -- `tournament_fair_seed_write_once` does (`0024:275-279`), so an idempotent re-write is not an
  -- error. What is refused is value -> a DIFFERENT value and value -> NULL.
  if old.snapshot_id is not null and new.snapshot_id is distinct from old.snapshot_id then
    raise exception
      using errcode = 'IC910',
            message = 'ceremony ' || old.id || ' snapshot_id is WRITE-ONCE (AD-15) and is already ' ||
                      old.snapshot_id || ' — refusing to change it to ' ||
                      coalesce(new.snapshot_id::text, '<null>'),
            hint    = 'the AD-19 snapshot is the frozen input every spin is a pure function of; '
                      're-pointing it would invalidate every persisted result';
  end if;

  if old.seed_demo_sha256 is not null and new.seed_demo_sha256 is distinct from old.seed_demo_sha256 then
    raise exception
      using errcode = 'IC910',
            message = 'ceremony ' || old.id || ' seed_demo_sha256 is WRITE-ONCE (AD-13) and is ' ||
                      'already frozen — refusing to change it',
            hint    = 'AD-13 is "published, never re-rolled"; a re-keyed seed draws a different '
                      'ceremony from the same catalog with nothing else looking wrong';
  end if;

  -- ── 3. The AD-18 scope key is immutable. ──
  if new.tournament_id is distinct from old.tournament_id then
    raise exception
      using errcode = 'IC910',
            message = 'ceremony ' || old.id || ' cannot move between tournaments (AD-18 scope)',
            hint    = 'every spin, result and winner under this ceremony is scoped by it; '
                      're-pointing the ceremony would silently re-scope all of them';
  end if;

  return new;
end;
$$;

comment on function public.assert_ceremony_transition() is
  'AD-15/AD-13 by MECHANISM (Story 6.8a, DECISION 4 — closes deferred-work.md:277). Permits only '
  'not_started -> locked -> spinning -> complete, one step forward at a time; freezes snapshot_id '
  'and seed_demo_sha256 write-once once non-NULL; pins tournament_id. Raises IC910. ⚠ It is NOT a '
  'column allowlist: lock_ceremony (0024:815-819) legitimately sets state, seed_demo_sha256, '
  'snapshot_id and started_at in one statement, and 0025 backfills luck_weight_table, so an '
  'allowlist of state+spin_plan would break the only shipped ceremony writer.';

-- LEAST PRIVILEGE, applied to BOTH new trigger functions rather than one (Story 6.8a code review).
-- The rationale stated on `assert_award_result_is_shared` above — "a trigger function does not need
-- an EXECUTE grant to FIRE, so revoking costs nothing and closes the direct-call path entirely" — is
-- entirely independent of `security definer` and applies verbatim here. Revoking on one and not the
-- other would read as a deliberate distinction to the next author, and there is none.
revoke execute on function public.assert_ceremony_transition() from public;

create trigger ceremony_transition_valid
  before update on public.ceremony
  for each row execute function public.assert_ceremony_transition();

comment on trigger ceremony_transition_valid on public.ceremony is
  'The AD-15 state machine, enforced. Before 0027, `update ceremony set state = ''not_started''` '
  're-opened all four ceremony_locked guards AND catalog_frozen after the snapshot was captured — '
  '"in a migration whose stated thesis is not by convention, by mechanism, these two are '
  'convention" (deferred-work.md:277).';

-- ════════════════════════════════════════════════════════════════════════════
-- (f) `persist_ceremony` — the writer. One transaction, or none of it (AD-6).
-- ════════════════════════════════════════════════════════════════════════════
-- The whole ceremony, in ONE transaction: take the locks in canonical order, re-read the world under
-- them, VALIDATE THE PRODUCER'S PAYLOAD (never trust it), refuse with a typed reason having written
-- NOTHING, then write every spin, result and winner, publish the spin plan, advance
-- `ceremony.state` locked -> spinning, and write exactly one audit row.
--
-- ⚠⚠ LOCK ORDER — `tournament` then `ceremony`, and it is chosen against `lock_ceremony`'s.
-- `lock_ceremony` takes `match` (id order) -> `stat_row` (id order) -> `tournament`, and then touches
-- `ceremony` through its `on conflict do update` while holding all three (`0024:429-450, 813`). This
-- function's lock set is a SUBSET taken in the SAME RELATIVE ORDER — tournament before ceremony — so
-- the two can queue behind each other but can never form the 40P01 cycle the 4.3 review measured.
-- ⛔ Do NOT lock `ceremony` first "because it is the subject": that inverts the pair against
-- `lock_ceremony` and is precisely the ABBA deadlock DECISION E of 0024 exists to prevent.
--
-- ⭐ THE PAYLOAD IS VALIDATED, NOT TRUSTED. It arrives from `worker/awards`, which is a pure producer
-- with no database access — so every id in it is a STRING the producer was handed, and every one of
-- them is re-resolved here against the frozen catalog and the live roster. A writer that trusted the
-- payload would be a writer that lets a producer bug become a persisted ceremony.
--
-- ⛔ ONE THING IS DELIBERATELY **NOT** GUARDED: the anti-sweep UNIQUE. `0025:224-247` is explicit —
-- "⛔ THIS CONSTRAINT MUST NEVER FIRE. If it does, the producer is broken, and the constraint's job
-- is to say so loudly instead of shipping a ceremony that contradicts its own published rule."
-- A guard here would convert that loud failure into a polite refusal and hide a producer defect.
create function public.persist_ceremony(
  p_ceremony_id bigint,
  p_run         jsonb,
  p_actor       text,
  p_replace     boolean default false
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tournament    bigint;
  v_state         text;
  v_snapshot      bigint;
  v_seed          text;
  v_awards        jsonb;   -- award.id::text -> award.id, this tournament's FROZEN catalog
  v_roster        jsonb;   -- steamid64      -> roster_entry.id, active entries only
  v_spins         jsonb;
  v_plan          jsonb;
  v_n             int;
  v_bad           text;
  v_deleted       int := 0;
  v_spin_rows     int := 0;
  v_result_rows   int := 0;
  v_winner_rows   int := 0;
  v_spin          jsonb;
  v_result        jsonb;
  v_winner        text;
  v_spin_id       bigint;
  v_result_id     bigint;
  v_kind          text;
  v_okind         text;
  v_exit          int;
begin
  -- ══ 1. AN UNLOCKED PEEK — existence and scope only. It must NOT lock: the statements below take
  --    the locks in canonical order and a lock taken ahead of them would be OUT of order.
  select c.tournament_id into v_tournament
    from public.ceremony c where c.id = p_ceremony_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_ceremony', 'ceremony_id', p_ceremony_id);
  end if;

  -- ══ 1b. THE LOCKS, IN CANONICAL ORDER (see the note above): tournament, then ceremony.
  perform 1 from public.tournament t where t.id = v_tournament for update;
  perform 1 from public.ceremony  c where c.id = p_ceremony_id  for update;

  -- ══ 1c. NOW read the world under the lock; nothing can move under us.
  select c.state, c.snapshot_id, c.seed_demo_sha256
    into v_state, v_snapshot, v_seed
    from public.ceremony c where c.id = p_ceremony_id;

  -- ══ 2. GUARDS — every one of them before ANY write, each RETURNED with its context keys.

  -- ── 2a. The ceremony itself is ready. ───────────────────────────────────────────────────────
  -- ⛔⛔ THE NULL CHECK IS A REAL RACE, NOT A FORMALITY, AND WITHOUT IT THE FUNCTION LIED.
  -- The peek at 1 is deliberately UNLOCKED (taking a lock there would be out of canonical order), so
  -- the ceremony can be deleted — via its tournament, which cascades — between the peek and the lock
  -- at 1b. Neither `perform … for update` raises when it matches zero rows, so the re-read at 1c
  -- leaves all three variables NULL. `NULL not in ('locked','spinning')` evaluates to NULL, the
  -- branch is NOT taken, and control fell through to the snapshot check — handing the operator
  -- `snapshot_missing` for a ceremony that no longer exists, a reason they would act on by re-running
  -- `lock_ceremony`. Three-valued logic turned a vanished row into a wrong diagnosis.
  if v_state is null then
    return jsonb_build_object('ok', false, 'reason', 'no_ceremony', 'ceremony_id', p_ceremony_id);
  end if;

  if v_state not in ('locked', 'spinning') then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_not_locked', 'ceremony_state', v_state);
  end if;

  select count(*) into v_n from public.spin s where s.ceremony_id = p_ceremony_id;
  if v_n > 0 and not p_replace then
    -- ⭐ AC8 — a second run REFUSES rather than appending. `spin_ceremony_index_key` would refuse the
    -- duplicate index anyway, but as a 23505 with no explanation; this says what happened and what
    -- flag would change it.
    return jsonb_build_object(
      'ok', false, 'reason', 'already_persisted',
      'existing_spins', v_n,
      'hint', 'pass p_replace => true to delete the prior run and write this one in the same transaction'
    );
  end if;

  if v_snapshot is null then
    return jsonb_build_object('ok', false, 'reason', 'snapshot_missing');
  end if;
  if v_seed is null then
    return jsonb_build_object('ok', false, 'reason', 'seed_missing');
  end if;

  -- ⛔ THE SEED THE PRODUCER DREW FROM MUST BE THE SEED THE CEREMONY FROZE. Every byte of the run is
  -- a pure function of it (AD-13/AD-14), so a mismatch means these rows describe a different
  -- ceremony than the one this row commits to — undetectable later, because the rows themselves look
  -- perfectly well-formed.
  if p_run ->> 'seed_hex' is distinct from v_seed then
    return jsonb_build_object(
      'ok', false, 'reason', 'seed_mismatch',
      'ceremony_seed_hex', v_seed, 'run_seed_hex', p_run ->> 'seed_hex'
    );
  end if;

  -- ── 2b. The payload's own shape. ───────────────────────────────────────────────────────────
  v_spins := p_run -> 'spins';
  v_plan  := p_run -> 'spin_plan';

  -- ⛔⛔ NESTED, NOT `or`, AND THAT IS NOT STYLE. PostgreSQL DOES NOT PROMISE left-to-right
  -- evaluation of `or`, so `jsonb_typeof(x) is distinct from 'array' or jsonb_array_length(x) = 0`
  -- may evaluate the SECOND operand first and raise 22023 "cannot get array length of a scalar" on
  -- a non-array — from inside the guard whose whole job is to RETURN a typed reason. Every
  -- type-then-length pair in this function is nested for that reason.
  if jsonb_typeof(v_spins) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'no_spins',
                              'spins_type', coalesce(jsonb_typeof(v_spins), 'absent'));
  end if;
  if jsonb_array_length(v_spins) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_spins', 'spins_type', 'empty_array');
  end if;
  if jsonb_typeof(v_plan) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'no_spin_plan',
                              'spin_plan_type', coalesce(jsonb_typeof(v_plan), 'absent'));
  end if;
  if jsonb_array_length(v_plan) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_spin_plan', 'spin_plan_type', 'empty_array');
  end if;

  -- ⭐ DENSE AND 1-BASED, asserted as a SET EQUALITY rather than as a max/count pair. `count = max`
  -- is satisfied by {1,1,3}; this is not.
  select count(*) into v_n from jsonb_array_elements(v_spins) e
   where (e ->> 'spin_index') is null;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'reason', 'spin_index_missing', 'spins', v_n);
  end if;

  -- ⚠ THE TEXT IS PROVEN INTEGRAL BEFORE ANY `::int` RUNS. The density check below casts twice, and
  -- a cast is not a guard: `"one"` raises 22P02 and `99999999999` raises 22003, both from inside the
  -- guard that was supposed to return `spin_index_not_dense`. The pattern also pins 1-BASED
  -- (leading digit 1-9, so `0` and `-1` are refused here rather than silently failing the set
  -- equality) and bounds the width to 9 digits, which cannot overflow int4.
  select string_agg(distinct e ->> 'spin_index', ',') into v_bad
    from jsonb_array_elements(v_spins) e
   where (e ->> 'spin_index') !~ '^[1-9][0-9]{0,8}$';
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_spin_index', 'spin_indexes', v_bad);
  end if;

  if exists (
    select 1
      from generate_series(1, jsonb_array_length(v_spins)) g
     where g not in (select (e ->> 'spin_index')::int from jsonb_array_elements(v_spins) e)
  ) or exists (
    select (e ->> 'spin_index')::int as ix
      from jsonb_array_elements(v_spins) e
     group by 1 having count(*) > 1
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'spin_index_not_dense',
      'expected', jsonb_build_object('from', 1, 'to', jsonb_array_length(v_spins))
    );
  end if;

  -- ⛔⛔ `coalesce(…, '<null>')` INSIDE THE AGGREGATE IS LOAD-BEARING, NOT DECORATION, AND ITS
  -- ABSENCE WAS A REAL FAIL-OPEN. `string_agg` SKIPS NULL INPUTS. Aggregating a bare `e ->> 'kind'`
  -- over rows selected BECAUSE that expression is NULL yields NULL whenever every offender is null,
  -- so `v_bad is not null` is false and the guard whose own WHERE clause names `is null` as the
  -- offence lets it straight through — to a bare 23502 on `spin.kind` in the middle of the write
  -- phase, which the Go caller then reports as an untyped `write_failed`. Every `string_agg` guard
  -- in this function now carries the wrapper, for exactly this reason.
  select string_agg(distinct coalesce(e ->> 'kind', '<null>'), ',') into v_bad
    from jsonb_array_elements(v_spins) e
   where (e ->> 'kind') is null or (e ->> 'kind') not in ('main', 'pity');
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_spin_kind', 'kinds', v_bad);
  end if;

  -- ── 2b'. THE ARRAY-SHAPED CHILDREN, PROVEN BEFORE ANYTHING ITERATES THEM. ──────────────────
  -- ⛔⛔ `coalesce(x -> 'k', '[]'::jsonb)` DOES NOT DEFEND AGAINST A JSON NULL, WHICH IS THE WHOLE
  -- REASON THIS SECTION EXISTS. `'{"k":null}'::jsonb -> 'k'` is the jsonb SCALAR null, NOT SQL NULL,
  -- so `coalesce` passes it through unchanged and `jsonb_array_elements` raises 22023 "cannot
  -- extract elements from a scalar". A MISSING key is SQL NULL and coalesce does handle that — so
  -- the old code tolerated an absent key while RAISING on a null one, which is exactly backwards
  -- from what a validating writer should do. Proving the shape here is what makes every
  -- `coalesce(…, '[]')` below honest.
  -- ⚠ ONE REASON WITH A `field` CONTEXT KEY rather than four near-identical reasons: the admin needs
  -- to know WHICH field, and `PersistReasons` stays a set a reader can hold in their head.
  select string_agg(distinct x.field, ',') into v_bad
    from (
      select 'results' as field
        from jsonb_array_elements(v_spins) e
       where jsonb_typeof(e -> 'results') is distinct from 'array'
      union all
      select 'live_award_ids'
        from jsonb_array_elements(v_spins) e
       where e ? 'live_award_ids' and jsonb_typeof(e -> 'live_award_ids') is distinct from 'array'
      union all
      select 'spin_plan.pool'
        from jsonb_array_elements(v_plan) pe
       where pe ? 'pool' and jsonb_typeof(pe -> 'pool') is distinct from 'array'
    ) x;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload_shape', 'fields', v_bad);
  end if;

  -- `winners` is checked separately because reaching it requires `results` to already be an array.
  select count(*) into v_n
    from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
   where res ? 'winners' and jsonb_typeof(res -> 'winners') is distinct from 'array';
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload_shape', 'fields', 'winners');
  end if;

  -- ⭐ A SPIN THAT CONCLUDED NOTHING IS NOT A SPIN. Without this, a spin element carrying an empty
  -- `results` array persists a `spin` row with zero `award_result` children, advances
  -- `ceremony.state`, and returns `{ok:true}` — a spin that revealed nothing and can never say why.
  -- `no_spins` guards an empty RUN; this guards an empty SPIN, which nothing guarded before.
  select count(*) into v_n
    from jsonb_array_elements(v_spins) e
   where jsonb_array_length(e -> 'results') = 0;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'reason', 'spin_without_results', 'spins', v_n);
  end if;

  -- ── 2c. Resolve the two id spaces the producer only knows as STRINGS. ──────────────────────
  -- ⭐ MAP, DO NOT ASSUME. `worker/awards` never touches a database, so its `award_id` is whatever
  -- string the caller handed it and its `steamid64` is a decimal string. Both are re-resolved here
  -- against THIS tournament's frozen catalog and its ACTIVE roster — an award from another
  -- tournament, or a soft-removed roster entry, refuses rather than crowning somebody who is not in
  -- the tournament.
  select coalesce(jsonb_object_agg(a.id::text, a.id), '{}'::jsonb) into v_awards
    from public.award a where a.tournament_id = v_tournament;

  select coalesce(jsonb_object_agg(r.steamid64, r.id), '{}'::jsonb) into v_roster
    from public.roster_entry r
   where r.tournament_id = v_tournament and r.status = 'active';

  -- ⛔⛔ `x.aid IS NULL` IS AN OFFENCE IN ITS OWN RIGHT, AND OMITTING IT WAS A SILENT-CORRUPTION
  -- FAIL-OPEN. `jsonb ? NULL` is NULL, so `not (v_awards ? NULL)` is NULL and the row is filtered
  -- OUT of the guard's own result set. A JSON `null` element inside `live_award_ids` therefore
  -- passed validation, and the write then evaluated `(v_awards -> NULL)::text::bigint` to NULL,
  -- which `jsonb_agg` — which is NOT strict — happily aggregated into the stored array. The row
  -- committed as `live_award_ids: [null]` with `{ok:true}` and no constraint anywhere to catch it.
  -- The `coalesce(…, '<null>')` in the aggregate is the same `string_agg`-skips-NULL fix as above.
  select string_agg(distinct coalesce(x.aid, '<null>'), ',') into v_bad
    from (
      select res ->> 'award_id' as aid
        from jsonb_array_elements(v_spins) sp,
             jsonb_array_elements(sp -> 'results') res
       where (res ->> 'award_id') is not null
      union all
      select lid #>> '{}'
        from jsonb_array_elements(v_spins) sp,
             jsonb_array_elements(coalesce(sp -> 'live_award_ids', '[]'::jsonb)) lid
    ) x
   where x.aid is null or not (v_awards ? x.aid);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_award', 'award_ids', v_bad);
  end if;

  -- ⭐ THE SPIN PLAN'S POOLS ARE RESOLVED TOO (Story 6.8a code review, DECISION 6). `spin_plan` is
  -- the ONE field this function publishes VERBATIM (`update … set spin_plan = v_plan` below), and
  -- until now its only validation was "is a non-empty array" — so a payload naming another
  -- tournament's awards in its pools was written into the ceremony row unchallenged, in a function
  -- whose stated thesis is "THE PAYLOAD IS VALIDATED, NOT TRUSTED". Same id space, same catalog,
  -- same treatment as every other award id in the run.
  select string_agg(distinct coalesce(x.aid, '<null>'), ',') into v_bad
    from (
      select pid #>> '{}' as aid
        from jsonb_array_elements(v_plan) pe,
             jsonb_array_elements(coalesce(pe -> 'pool', '[]'::jsonb)) pid
    ) x
   where x.aid is null or not (v_awards ? x.aid);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_plan_award', 'award_ids', v_bad);
  end if;

  -- Same NULL-element fail-open as `unknown_award`, with a louder failure mode: a null winner
  -- reached `(v_roster -> NULL)::text::bigint` as a NULL `winner_entry_id` and raised a bare 23502
  -- AFTER the spin and result rows for this ceremony had already been inserted.
  select string_agg(distinct coalesce(w #>> '{}', '<null>'), ',') into v_bad
    from jsonb_array_elements(v_spins) sp,
         jsonb_array_elements(sp -> 'results') res,
         jsonb_array_elements(coalesce(res -> 'winners', '[]'::jsonb)) w
   where (w #>> '{}') is null or not (v_roster ? (w #>> '{}'));
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_player', 'steamid64s', v_bad);
  end if;

  -- ── 2d. Every result's own shape, checked over the WHOLE run before any of it is written. ──
  select string_agg(distinct coalesce(res ->> 'outcome_kind', '<null>'), ',') into v_bad
    from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
   where coalesce(res ->> 'outcome_kind', '<null>') not in
         ('winner', 'tie', 'no_eligible_players', 'no_awardable_value', 'shared');
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_outcome_kind', 'outcome_kinds', v_bad);
  end if;

  -- ⭐ DECISION 2 — a persisted `tie` is a PRODUCER bug, and it gets a reason rather than a 23514.
  -- `award_result_outcome_kind_not_tie` would refuse it anyway; this is what tells the admin why.
  if exists (
    select 1 from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
     where res ->> 'outcome_kind' = 'tie'
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'outcome_kind_tie',
      'hint', 'the FR-29 ladder resolves every tie before it reaches a row (worker/awards/sweep.go:124-127); '
              'a persisted tie means the ladder was skipped'
    );
  end if;

  -- The outcome kind and the winner cardinality are the same fact twice — refused HERE with a reason,
  -- and asserted again at COMMIT by IC909 for any writer that does not come through this function.
  if exists (
    select 1
      from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
     cross join lateral (
       select jsonb_array_length(coalesce(res -> 'winners', '[]'::jsonb)) as n
     ) c
     where (res ->> 'outcome_kind' = 'winner' and c.n <> 1)
        or (res ->> 'outcome_kind' = 'shared' and c.n < 2)
        or (res ->> 'outcome_kind' in ('no_eligible_players', 'no_awardable_value') and c.n <> 0)
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'winner_cardinality',
      'hint', 'winner = exactly 1 winner; shared = 2 or more; no_eligible_players / '
              'no_awardable_value = 0'
    );
  end if;

  -- ⭐ AC4/AC5 — a result's award and its spin's kind are bound. Refused with a reason here;
  -- `award_result_is_pity_matches_kind` and `award_result_award_or_pity` make it unrepresentable.
  if exists (
    select 1 from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
     where (sp ->> 'kind' = 'pity' and (res ->> 'award_id') is not null)
        or (sp ->> 'kind' = 'main' and (res ->> 'award_id') is null)
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'pity_award_shape',
      'hint', 'a consolation result names NO award (0026) and lives only on a kind=pity spin; a '
              'category result always names one and lives only on a kind=main spin'
    );
  end if;

  -- ⛔⛔ THE `0025:162-174` CALLOUT, HONOURED. The engine's `LadderExitNone` is the integer 0 and the
  -- column's "no rung" is SQL NULL, so the writer maps `nullif(v, 0)`. What is validated here is the
  -- value AFTER that mapping: anything outside 1..5 that is not the 0 sentinel is a producer bug and
  -- would otherwise arrive as a bare 23514 on `award_result_ladder_exit_step_valid`.
  if exists (
    select 1 from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
     where nullif(coalesce((res ->> 'tie_ladder_exit_step')::int, 0), 0) not between 1 and 5
       and nullif(coalesce((res ->> 'tie_ladder_exit_step')::int, 0), 0) is not null
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'invalid_ladder_exit_step',
      'hint', 'the FR-29 rungs are 1..5; the engine''s 0 means "no ladder ran" and is mapped to NULL'
    );
  end if;

  -- ⛔ THE DECIDING VALUES WERE THE LAST PAYLOAD FIELDS WHOSE CASTS RAN PAST THE WRITE BOUNDARY.
  -- `(res ->> 'deciding_num')::bigint` sat inside the INSERT, so a half pair raised a bare 23514 on
  -- `award_result_deciding_pair_complete` — the constraint THIS migration adds — a non-numeric
  -- raised 22P02 and an over-bigint value 22003, every one of them mid-write. Every other
  -- constraint 0027 adds carries a matching pre-write typed refusal; now these do too.
  -- ⚠ THE NULL BEHAVIOUR IS DELIBERATE. `!~` on a NULL yields NULL, and `false or NULL` is NULL, so
  -- an all-NULL row (a `no_eligible_players` result, the common case at the shipped FR-21 floors) is
  -- correctly NOT selected. What the first operand catches is the HALF pair, where both sides of the
  -- `<>` are `is null` tests and can never themselves be NULL. Widths are bounded to what bigint and
  -- numeric accept, so the casts below cannot overflow.
  if exists (
    select 1 from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
     where ((res ->> 'deciding_num') is null) <> ((res ->> 'deciding_den') is null)
        or (res ->> 'deciding_num')   !~ '^-?[0-9]{1,18}$'
        or (res ->> 'deciding_den')   !~ '^-?[0-9]{1,18}$'
        or (res ->> 'deciding_value') !~ '^-?[0-9]{1,38}(\.[0-9]{1,18})?$'
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'invalid_deciding_pair',
      'hint', 'DECISION 3: a rate award carries BOTH deciding_num and deciding_den as integers and '
              'neither alone; a volume award carries deciding_value and neither of the pair'
    );
  end if;

  -- ⭐ THE ACTOR IS RESOLVED BEFORE THE WRITE, NOT DISCOVERED AT THE AUDIT INSERT.
  -- `audit_log.actor_steamid64` is `not null references player(steamid64)` (`0003:24`), so a NULL
  -- raised 23502 and an unknown id 23503 — at step 6, after every spin, result and winner row had
  -- been inserted and after `ceremony.state` had advanced. AD-6 still held (the transaction rolls
  -- back), but it was the one refusal class in this function that was not pre-write, directly
  -- against the section header two hundred lines above: "every one of them before ANY write".
  if p_actor is null or not exists (
    select 1 from public.player p where p.steamid64 = p_actor
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'unknown_actor', 'actor', coalesce(p_actor, '<null>')
    );
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──

  -- ⚠⚠ THE ASSERTION MODE IS NORMALISED ON ENTRY, BECAUSE `set constraints` IS TRANSACTION-SCOPED.
  -- The write phase below inserts an `award_result` and only THEN its `award_result_winner` rows, so
  -- the is_shared/cardinality assertion MUST be deferred while it runs — a row is legitimately
  -- "winner with 0 winners" for the microsecond between those two inserts. The triggers are declared
  -- `deferrable initially deferred` (`0025:335-343`), so that is the default — but this function ends
  -- by forcing them IMMEDIATE (see 5b), and `set constraints` persists for the REST OF THE
  -- TRANSACTION. A second call in the same transaction — which is exactly what `p_replace` is for,
  -- and exactly what the pgTAP suite does — would therefore run with the mode the FIRST call left
  -- behind and raise IC909 on its own perfectly good rows. Restoring the declared default here makes
  -- the function idempotent with respect to the ambient mode instead of depending on it.
  set constraints public.award_result_is_shared_consistent,
                  public.award_result_winner_is_shared_consistent deferred;

  -- ══ 3. AC8 — the prior run, deleted in the SAME transaction. The FK cascades take
  --    `award_result` and `award_result_winner` with it (`0025:141, 210, 219`), and DELETE is granted
  --    on all three precisely for this (`0025:353-360`).
  if p_replace then
    with gone as (
      delete from public.spin s where s.ceremony_id = p_ceremony_id returning 1
    )
    select count(*) into v_deleted from gone;
  end if;

  -- ══ 4. THE SPINS, THEIR RESULTS AND THEIR WINNERS.
  --
  -- ⚠ A LOOP, NOT A SET-BASED INSERT, AND THE REASON IS THE ID MAPPING. Each `award_result` needs its
  -- parent `spin`'s generated id and each `award_result_winner` needs its parent `award_result`'s, and
  -- a pity spin's results carry a NULL `award_id` so `(spin_id, award_id)` is not a usable natural key
  -- to join back on. The volume is one ceremony — twelve main spins plus one pity spin per winless
  -- player — so clarity wins over cleverness here.
  -- ⚠ THE PAYLOAD CARRIES `label` AND `bytes_consumed` PER SPIN AND THIS FUNCTION DELIBERATELY DOES
  -- NOT PERSIST THEM (Story 6.8a code review, DECISION 6). They are PROVENANCE: `label` is the
  -- domain-separation key 6.9's verifier re-opens each stream by, and `bytes_consumed` is measured
  -- from the stream rather than re-derived. Both belong in 6.9's `verification_bundle`, which owns
  -- the shape a verifier reads — adding two columns to `spin` now would pre-empt that decision for
  -- the sake of data nothing yet reads. They are carried on the wire so 6.9 does not have to
  -- re-plumb the producer, and they are validated by nothing here precisely because nothing here
  -- depends on them. ⛔ Do NOT read them into a write without moving that decision to 6.9 first.
  for v_spin in select e from jsonb_array_elements(v_spins) e loop
    v_kind := v_spin ->> 'kind';

    insert into public.spin (ceremony_id, spin_index, kind, live_award_ids, revealed_at)
    values (
      p_ceremony_id,
      (v_spin ->> 'spin_index')::int,
      v_kind,
      -- The producer's award STRING ids, mapped to `award.id` bigints. DRAW order is preserved,
      -- which IS reveal order (`0025:127-129`, `stage1.go:269-274`).
      coalesce(
        (select jsonb_agg((v_awards -> (lid #>> '{}'))::text::bigint order by ord)
           from jsonb_array_elements(coalesce(v_spin -> 'live_award_ids', '[]'::jsonb))
                with ordinality as a(lid, ord)),
        '[]'::jsonb
      ),
      -- ⛔ `revealed_at` IS WRITTEN NULL, EXPLICITLY AND VISIBLY, AND THERE IS NO COLUMN DEFAULT.
      -- 6.8a makes the rows EXIST with the access posture UNMOVED; Story 6.8b's `reveal_spin` RPC is
      -- what stamps this, one spin at a time, and the reveal-gated policy keys on it. A row written
      -- with a timestamp here would be visible the instant 6.8b adds the grant — before anyone
      -- pressed anything.
      null
    )
    returning id into v_spin_id;
    v_spin_rows := v_spin_rows + 1;

    for v_result in select e from jsonb_array_elements(v_spin -> 'results') e loop
      v_okind := v_result ->> 'outcome_kind';
      v_exit  := nullif(coalesce((v_result ->> 'tie_ladder_exit_step')::int, 0), 0);

      insert into public.award_result (
        spin_id, kind, award_id, outcome_kind,
        deciding_value, deciding_num, deciding_den,
        is_pity, is_shared, tie_ladder_exit_step
      )
      values (
        v_spin_id,
        v_kind,
        (v_awards -> (v_result ->> 'award_id'))::text::bigint,
        v_okind,
        (v_result ->> 'deciding_value')::numeric,
        (v_result ->> 'deciding_num')::bigint,
        (v_result ->> 'deciding_den')::bigint,
        -- DERIVED FROM THE SPIN, NEVER TAKEN FROM THE PAYLOAD. `award_result_is_pity_matches_kind`
        -- would refuse a disagreement anyway; deriving it means the payload cannot even propose one.
        (v_kind = 'pity'),
        -- Likewise derived from the winner count, which is what IC909 asserts at COMMIT.
        (jsonb_array_length(coalesce(v_result -> 'winners', '[]'::jsonb)) > 1),
        v_exit
      )
      returning id into v_result_id;
      v_result_rows := v_result_rows + 1;

      for v_winner in
        select w #>> '{}' from jsonb_array_elements(coalesce(v_result -> 'winners', '[]'::jsonb)) w
      loop
        insert into public.award_result_winner (award_result_id, spin_id, winner_entry_id)
        values (v_result_id, v_spin_id, (v_roster -> v_winner)::text::bigint);
        v_winner_rows := v_winner_rows + 1;
      end loop;
    end loop;
  end loop;

  -- ══ 5. THE CEREMONY ROW — the plan and the state, written by the SAME statement that wrote the
  --    rows, so `ceremony.spin_plan` and the `spin` rows can never disagree about the ceremony they
  --    describe. `locked -> spinning` is one step forward; a re-run under p_replace is already
  --    `spinning`, and `new.state is distinct from old.state` is then false, so the transition
  --    trigger correctly treats it as a no-op rather than a repeated transition.
  update public.ceremony
     set spin_plan = v_plan,
         state     = 'spinning'
   where id = p_ceremony_id;

  -- ══ 5b. ⚠⚠ THE DEFERRED ASSERTION IS FORCED TO RUN *HERE* — BEFORE THE AUDIT ROW AND BEFORE THE
  --    RETURN. This discharges T4's own warning, which was still outstanding.
  -- `award_result_is_shared_consistent` and `award_result_winner_is_shared_consistent` are
  -- `deferrable initially deferred` (`0025:335-343`), so they fire at COMMIT. Without this line the
  -- ordering was: write every row -> write an audit row claiming N spins / M results / K winners ->
  -- return `{ok:true}` -> and only THEN let IC909 judge what was written. A caller inside an explicit
  -- transaction (`begin; select persist_ceremony(…); commit;` from psql, or a future admin route on
  -- a pgx.Tx) therefore read a SUCCESS payload and then had COMMIT fail underneath it. Forcing the
  -- constraints immediate here puts the assertion in front of both the audit row and the return, so
  -- the value this function reports is a value the database has already agreed to.
  -- ⛔ An IC909 raised here is CORRUPTION, exactly as it is at COMMIT: the `winner_cardinality` and
  -- `outcome_kind` guards above already refused every payload-shaped cause with a typed reason, so
  -- reaching this line means a writer bypassed them.
  set constraints public.award_result_is_shared_consistent,
                  public.award_result_winner_is_shared_consistent immediate;

  -- …and the declared default is restored, so a caller that keeps writing in this transaction after
  -- us meets the mode `0025` declared rather than the one we needed for one statement.
  set constraints public.award_result_is_shared_consistent,
                  public.award_result_winner_is_shared_consistent deferred;

  -- ══ 6. EXACTLY ONE audit_log row (AD-17), with before/after in `detail`.
  -- ⚠ EVERY key below is asserted in pgTAP: the 4.2 review found a suite asserting ONE key while a
  -- typo in any other would have NULLed the whole payload with the tests still green.
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    v_tournament,
    p_actor,
    'run_ceremony',
    jsonb_build_object(
      'before', jsonb_build_object(
                  'ceremony_state', v_state,
                  'spins',          v_deleted,
                  'replaced',       p_replace
                ),
      'after',  jsonb_build_object(
                  'ceremony_state', 'spinning',
                  'ceremony_id',    p_ceremony_id,
                  'seed_hex',       v_seed,
                  'snapshot_id',    v_snapshot,
                  'spins',          v_spin_rows,
                  'results',        v_result_rows,
                  'winners',        v_winner_rows,
                  'deleted_spins',  v_deleted
                )
    )
  );

  -- ⚠ NO REALTIME EMIT, DELIBERATELY, and for the reason `0024:867-871` gives: SPINE:230's vocabulary
  -- is `match.approved` / `bracket.advanced` / `spin.reveal`, event names are "server-authored, named
  -- by semantic change" and never invented, and NOTHING a viewer can see has changed here — the rows
  -- are invisible until 6.8b's reveal. `spin.reveal` is 6.8b's to emit, per spin.

  return jsonb_build_object(
    'ok',             true,
    'ceremony_state', 'spinning',
    'ceremony_id',    p_ceremony_id,
    'spins',          v_spin_rows,
    'results',        v_result_rows,
    'winners',        v_winner_rows,
    'deleted_spins',  v_deleted
  );
end;
$$;

comment on function public.persist_ceremony(bigint, jsonb, text, boolean) is
  'FR-25/26/28/29 + AD-6 (Story 6.8a): persists one whole ceremony run — every spin, award_result '
  'and award_result_winner — in ONE transaction, or none of it. Validates the producer''s payload '
  'rather than trusting it: every award_id is re-resolved against this tournament''s frozen catalog '
  'and every steamid64 against its ACTIVE roster. Publishes ceremony.spin_plan and advances state '
  'locked -> spinning in the same transaction, so the plan and the rows cannot disagree. '
  '⛔ revealed_at is written NULL on every spin — 6.8b stamps it. p_replace deletes the prior run '
  '(cascading to results and winners) and writes the new one in the same transaction; without it a '
  'second call refuses with already_persisted. Business refusals are RETURNED as '
  '{ok:false, reason:...}; the anti-sweep UNIQUE is deliberately NOT guarded, because 0025 requires '
  'a producer bug to fail loudly rather than be handled.';

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE a viewer could persist a ceremony straight off the Data API. Revoke first, then grant
-- to the single writer (0017:456-463 / 0023:529-530 / 0024:885-889).
revoke execute on function public.persist_ceremony(bigint, jsonb, text, boolean) from public;
grant  execute on function public.persist_ceremony(bigint, jsonb, text, boolean) to service_role;
