-- supabase/migrations/0024_ceremony_lock_snapshot.sql
-- Logical migration 0024 — the fair_seed freeze + the immutable ceremony snapshot (Story 6.2,
-- FR-27 / AD-13 / AD-15 / AD-19). The SECOND Epic-6 migration.
--
-- ⭐ THE THESIS. Everything Epic 6 decides — every spin, every winner, every tiebreak — must be a pure
-- function of two frozen things: a SEED nobody can re-roll, and a SNAPSHOT nobody can edit. This migration
-- is where both stop being mutable. `tournament.fair_seed` gets a shape CHECK and a write-once TRIGGER and
-- is frozen inside the very transaction that crowns the champion; `ceremony` is created and, in one audited
-- RPC under ordered row locks, the AD-19 integer-form snapshot is captured and the four mutating admin
-- commands start refusing with `ceremony_locked`. After `lock_ceremony()` returns, the inputs to the draw
-- are physically incapable of changing — not by convention, by mechanism.
--
-- WHAT IT BUILDS:
--   (a) Task 1 — `ceremony` (SOLUTION-DESIGN.md:175-185 verbatim) + the `ceremony_snapshot_fk` that
--       0003:11-12 deferred to Epic 6 BY NAME + RLS/grants; `tournament_fair_seed_hex` CHECK; the
--       `tournament_fair_seed_write_once` BEFORE-UPDATE trigger (IC908).
--   (b) Task 2 — `create or replace approve_match(...)`: 0017's body plus the AD-13 freeze (and (d)'s guard).
--   (c) Task 3 — `lock_ceremony(tournament, actor)`: the lock + the AD-19 capture, one transaction (AD-6).
--   (d) Task 4 — the `ceremony_locked` typed refusal on approve_match / rollback_match /
--       manual_resolve_match, and the REAL lock behind `curate_award_catalog`'s `catalog_frozen`.
--   Plus `snapshot_efficiency_form(volume, rate)` — the ONE definition site of AD-19's efficiency `{num,den}`.
--
-- SQLSTATEs — 0024 declares EXACTLY ONE new code:
--   * IC908 — `tournament_fair_seed_write_once`: an attempt to CHANGE a non-NULL `fair_seed`. ⭐ NEW, this
--     story. AD-13's "never re-rolled" made MECHANISM-enforced. IC901-IC907 are taken (0015/0017/0018/0019).
--   `lock_ceremony` RAISES NOTHING of its own — every refusal is RETURNED as {ok:false, reason} (the
--   0016/0017/0019/0020/0023 convention).
--
-- ⚠ `audit_log.action = 'start_ceremony'` is ALREADY the enumerated vocabulary (0003:25 — uncapped `text`
-- with NO CHECK), so there is NO vocabulary migration and 0003 stays byte-identical (never edit an applied
-- migration).
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ FIVE DECISIONS. Read these before changing anything below.
-- ════════════════════════════════════════════════════════════════════════════
--
-- DECISION A — "SERIALIZABLE ceremony-lock" (AD-15, SPINE:153) SHIPS AS THIS CODEBASE'S PESSIMISTIC ORDERED
-- ROW-LOCK, NOT AS AN ISOLATION-LEVEL CHANGE. Two facts make the literal reading unbuildable AND undesirable:
--   (1) `set transaction isolation level serializable` CANNOT be issued inside a PL/pgSQL function — it is
--       already inside a transaction — and every RPC in this codebase is a PL/pgSQL function.
--   (2) SERIALIZABLE does not BLOCK anything. It detects conflicts and raises 40001 on one transaction
--       AFTERWARDS. What the AC actually demands is "blocks further approves/re-parses for that tournament
--       during capture", and BLOCKING is exactly what `for update` gives.
-- So: ordered `for update` locks DURING the capture + the persistent `ceremony_locked` typed refusal AFTER
-- it. Together they satisfy AD-15's intent completely. This deviation is written down HERE so a reviewer
-- reads it rather than discovers it.
-- ⚠ THREE CITATIONS CORRECTED AT CODE REVIEW (2026-08-03). The engineering call above stands unchanged and
-- was endorsed by the review; the supporting evidence as originally written did not. For the record, because
-- a reader is meant to be able to trust an absolute:
--   * it said "`SERIALIZABLE` appears ZERO times in this codebase". It appears at 0003:15 — in the very
--     comment that names this story: "Snapshot CAPTURE (SERIALIZABLE ceremony-lock …) -> Story 6.2 (AD-15)".
--     Comments only, so the substantive point (no isolation-level change exists anywhere) survives intact.
--   * it cited 0011:160 and 0013:202 as instances of the `order by id for update` multi-row pattern. They
--     are SINGLE-ROW `select … from public.tournament … for update` — a different (and also valid) idiom.
--     The genuine multi-row ordered-lock precedents are 0017:265-270 and 0023:434.
--   * it said all four sites are "already commented 'SERIALIZE on the tournament row'". Only 0011 and 0013
--     say that. 0017:265 says "EVERY LOCK, IN ONE STATEMENT, IN CANONICAL (id) ORDER"; 0023:434 locks the
--     AWARD rows, not the tournament row.
--
-- DECISION B — THE SNAPSHOT CAPTURES THE FULL 0023 VOCABULARY SUPERSET, NOT TODAY'S CATALOG KEYS.
-- `award.secondary_stat` / `eff_num_key` / `eff_den_key` exist as columns (0023:71-73) but the 6.1 seed
-- leaves them NULL deliberately — the FR-29 rungs are Story 6.5's decisions to make. A snapshot keyed off
-- TODAY's catalog would be silently unusable the moment 6.5 fills a rung, and `stat_snapshot_row` is
-- WRITE-ONCE (0003:78-80), so there is no repair path short of a whole new ceremony. Every one of the 21
-- vocabulary keys is therefore captured, in integer form. The cost is a slightly larger jsonb; the
-- alternative is an unrecoverable contract break two stories out.
--
-- DECISION C — `achievement_ts` IS A DOCUMENTED PROXY, NOT A REAL ACHIEVEMENT TIME. FR-29 rung 4
-- (prd.md:393) wants "earliest achievement timestamp". NOTHING in `stat_row` carries a per-achievement
-- time — the parser records no per-event timestamps. Confirmed with Cuatro (2026-08-03): ship
-- `min(epoch_ms(stat_row.approved_at))` over the player's CONTRIBUTING approved rows, with the published
-- absent-sentinel **-1**. It is deterministic, monotone and fully verifiable from the published bundle.
-- It is NOT semantically "when they achieved it" and the column comment below says so plainly rather than
-- implying a precision that does not exist.
--
-- ⛔⭐ TWO LIMITATIONS FOUND AT CODE REVIEW (2026-08-03) THAT WERE NOT KNOWN AT SIGN-OFF. Both were put to
-- Cuatro, who confirmed the field ships unchanged and DOCUMENTED. Do not "fix" either one here:
--
--   (1) ⛔ IT CANNOT SEPARATE DUEL OPPONENTS, AND NO MATCH-LEVEL COLUMN CAN. `approve_match` stamps
--       `approved_at = now()` — the TRANSACTION timestamp — on every stat_row of the match in ONE statement,
--       so both competitors of a 1v1 wingman duel get a byte-identical value. `min()` over them means any two
--       players whose EARLIEST match was against each other tie exactly — precisely the pairs a
--       head-to-head-adjacent ladder reaches rung 4 for. ⚠ This is STRUCTURAL, not a choice of source: the
--       discarded alternative `min(match.id)` ties identically (both players share the match) and would also
--       publish a bracket coordinate as a timestamp, since `generate_bracket` creates every row at once.
--       In a duel, both players' "earliest achievement" IS the same duel.
--       ⛔⛔ THEREFORE STORY 6.5 MUST CARRY A DETERMINISTIC TERMINAL RUNG (it has a seeded PRNG for exactly
--       this). Rung 4 is GUARANTEED to fail for the most common tie shape in a 1v1 bracket. This is a named
--       blocker on 6.5, recorded in deferred-work.md — not a caveat.
--
--   (2) IT TRACKS ADMIN APPROVAL ORDER. `approved_at` is wall-clock at the moment an admin presses Aprobar,
--       so the rung-4 ordering is a function of operator behaviour inside a ceremony whose premise (FR-27) is
--       that a skeptic can verify nobody influenced it. Judged acceptable: exploiting it needs an admin to
--       pre-plan approval order against a tie they cannot yet see, in a private friends' tournament. The
--       non-manipulable alternative costs chronological meaning AND does not fix (1).
--       ⚠ SECOND-ORDER CONSEQUENCE: because the value is wall-clock, re-ingesting the same demos yields
--       different `achievement_ts` values and therefore a different `content_sha256`. The capture is
--       reproducible FROM THE STORED ROWS, never from the corpus — which matters to 6.11's golden vector.
--
-- DECISION D — ⚠ `rounds_won` IS THE ONE VOCABULARY KEY `public.leaderboard` DOES NOT EXPOSE, AND 6.2 SUMS
-- IT HERE. The 0023 deciding-stat vocabulary includes `rounds_won` (0023:93); `public.leaderboard` (0021)
-- exposes every other key's integer form but has no `rounds_won_total` — verified by reading 0021:62-131.
-- Three options, all bad in different ways: omit it (DECISION B says a missing key becomes unusable the
-- moment 6.5 names it, with no repair path); change 0021; or sum it here. 6.2 sums it here, in the SAME
-- tournament-scoped CTE that already has to touch
-- `stat_row` directly for `h2h`, `achievement_ts` and the snapshot-level `idle_dq` — none of which the
-- leaderboard can answer either — and with the SAME predicate the leaderboard uses (`status='approved' and
-- idle_dq=false`, 0021:87-88). This is NOT a second standings aggregate: no rate, no floor, no
-- normalization is recomputed. ⚠ SEAM FOR 6.4/6.5: if `rounds_won` is ever wanted on a viewer board, the
-- fix is to add `rounds_won_total` to 0021 and point this at it — do not grow a second aggregate here.
--
-- ⚠ JUSTIFICATION CORRECTED AT CODE REVIEW (2026-08-03). The "change 0021" option was originally dismissed
-- as "explicitly out of scope". It is not: the Dev-Notes boundary reads "Any change to `public.leaderboard`
-- or the `24`/`20` FLOOR LITERALS (0021:50-56). They are a deliberate value-parity duplicate of
-- `award.floor_*`; 6.4/6.5 own the FLOORS question." That boundary is about the floors — adding a summed
-- integer column touches neither a floor nor the value-parity duplicate, so the boundary was read more
-- broadly than it was written in order to license this deviation. The DECISION ITSELF STANDS on its own
-- merits (AD-20's Prevents clause is about two drifting standings sources applying floors or rate-vs-volume
-- normalization unevenly, and this recomputes neither), but the honest cost is stated plainly: the
-- `status='approved' and idle_dq=false` predicate is now HAND-COPIED from 0021:87-88 and nothing enforces
-- that the two stay in lockstep. Same class of unenforced duplication as `entry_success`'s denominator,
-- which is spelled out as `entry_frags + opening_deaths` here and as `entry_opportunities` at 0021:108
-- (verified equal at review — but, again, by inspection only).
--
-- DECISION E — ⚠⚠ THE LOCK ORDER IS `match` → `stat_row` → `tournament`, DELIBERATELY, AND THAT IS *NOT*
-- TOURNAMENT-FIRST. Taking the tournament row first would create a textbook ABBA deadlock with
-- `approve_match`, which locks every `match` row up front (0017:266-270) and only LATER writes
-- `tournament.final_match_id` from inside `advance_match` (0014:601-605) — i.e. approve holds match and
-- wants tournament while a tournament-first lock_ceremony would hold tournament and want match. That is the
-- exact 4.3 40P01 the whole canonical-order convention exists to prevent, and unlike `generate_bracket`
-- (0011:163-167, which DOES lock tournament first) these two CAN run concurrently — approve and
-- ceremony-lock both live in `bracket_live`. The stated benefit of locking the tournament row is preserved
-- in full: `tournament.state` / `final_match_id` / `fair_seed` are RE-READ under the lock before any guard.
-- ⚠ CORRECTED AT CODE REVIEW (2026-08-03): this block used to claim the re-read "closes the weakness
-- `curate_award_catalog`'s lock-free `catalog_frozen` read has". IT DID NOT, AND COULD NOT. A lock taken
-- HERE cannot close a race that lives in a DIFFERENT function which took no lock at all — curate read
-- `ceremony.state` lock-free and only locked `award` ~120 lines later, and `lock_ceremony` never locks
-- `award`, so the two shared zero conflicts and a curation could commit a full catalog rewrite AFTER the
-- snapshot was captured. What the re-read actually closes is the weakness in LOCK_CEREMONY'S OWN reads,
-- which is worth having and is all it ever did. Curate's half is fixed where it lives: GUARD 1 there now
-- takes the tournament row `for update`, so the two functions genuinely serialize.
--
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO `spin`, `award_result`, `award_result_winner`, `verification_bundle` tables -> 6.4 / 6.5 / 6.8 / 6.9.
--     `ceremony` is the ONLY new table. (`stat_snapshot`/`stat_snapshot_row` have existed since 0003.)
--   * NO PRNG, HMAC, `uniform_int`, rejection sampling, weighted pick, `luck_weight_table` POPULATION,
--     `spin_plan` content, draw, FR-29 tie ladder, anti-sweep or pity -> 6.3-6.7. `algorithm_version`,
--     `spin_plan` and `luck_weight_table` land as SHELLS here — created, never written by this story, the
--     same shell precedent 0003 set for `stat_snapshot`.
--   * NO viewer-facing seed/bundle publication, NO `bundle_hash`, NO commitment surface, NO reveal-gated RLS
--     axis on `award`/`spin`/`award_result` -> 6.8. 6.2 freezes `fair_seed` and names it `seed_hex` in the
--     SERVER contract; it publishes NOTHING to anon. `ceremony` ships with no anon/authenticated grant.
--   * NO RFC-8785 canonical JSON and NO `bundle_sha256` -> 6.9. ⚠ `stat_snapshot.content_sha256` written
--     here is a CAPTURE-INTEGRITY hash ONLY — it proves the captured bytes are the bytes. It is NOT the
--     published commitment hash and 6.9 must NOT inherit its recipe as a constraint.
--   * NO ceremony UI, wheel or reduced-motion parity -> 6.10. `/ceremonia` stays the 5.7 <Placeholder>.
--   * NO golden vectors -> 6.11 (but AD-19 requires 6.11's end-to-end vector be projected from a REAL
--     captured snapshot — Story 6.2 Task 5's dump is the artifact it will use).
--   * NO change to `public.leaderboard` (0021) or to its `24`/`20` floor literals (0021:50-56). They are a
--     deliberate value-parity duplicate of `award.floor_*`; 6.4/6.5 own the floors question. 6.2 MEASURES
--     eligibility and records it; it does not move a floor.
--   * NO Go / worker change. `demo.demo_sha256` ALREADY IS lowercase-hex SHA-256 of the canonical .dem
--     bytes, computed once at ingest (worker/ingest/ingest.go:66-70) and re-verified on every re-parse
--     (worker/ingest/reparse.go:52-84). Do NOT re-hash anything.
--   * NO realtime emit. SPINE:230 names `match.approved`, `bracket.advanced`, `spin.reveal` — there is NO
--     `ceremony.locked` in the specified vocabulary and event names are "server-authored, named by semantic
--     change", never invented. The gap is recorded for 6.8/6.10.
--   * NO `accept_anomaly` guard — 0020:46-48 explicitly excludes it from the ceremony-locked set.
--   * NO un-freeze of `fair_seed` on rollback (see the ⚠ at approve_match), NO forfeit-undo path, NO
--     `award_reveal` timeline_feed writer (still unowned across all of Epic 6 — flagged again for 6.8/6.10).
--   * NO CSRF (Epic 7, uniform across all cookie-authenticated admin POSTs).
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 — READ BEFORE CHANGING `tournament_fair_seed_hex`).
-- An immediate validated CHECK cannot apply to a database that already holds a violating row, and
-- `supabase db reset` structurally CANNOT catch that (it rebuilds from empty). Verified by grep that NOTHING
-- writes `fair_seed` today: across the whole repo the only occurrences in `supabase/migrations` are 0001:14
-- and 0001:33 (the column definition and its own deferral comment), 0004:15 and 0014:597 (comments), and
-- `lib/bracket/generate.test.ts:343` is a LIVE regression asserting bracket generation never touches it. So
-- every existing row has `fair_seed IS NULL`, the `fair_seed is null or …` disjunct holds for all of them,
-- and the immediate validated CHECK applies cleanly. The first writer is `approve_match`, replaced BELOW in
-- this same migration, after the constraint exists.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 1 — the `ceremony` table.
-- ════════════════════════════════════════════════════════════════════════════
-- Columns are EXACTLY SOLUTION-DESIGN.md:175-185 — same names, same types, same defaults, same four-value
-- state set. Every CHECK is NAMED: all CHECKs raise the same 23514, so a pgTAP `throws_ok` on the SQLSTATE
-- alone would prove almost nothing (the trap the 4.3 review found across three suites and 6.1 re-hit). The
-- suite asserts the constraint NAME.
--
-- ⚠ `algorithm_version`, `spin_plan` and `luck_weight_table` are SHELLS — created here, written by NOBODY in
-- this story (6.9 / 6.4+6.8 / 6.6 respectively). Exactly the shell precedent 0003 set for `stat_snapshot`:
-- the table shape arrives once so a later story widens behaviour, never the schema.
create table ceremony (
  id                bigint generated always as identity primary key,
  tournament_id     bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  state             text not null default 'not_started',
  seed_demo_sha256  text,                 -- = tournament.fair_seed, frozen at lock (AD-13)
  snapshot_id       bigint,               -- ceremony_snapshot_fk below; immutable (AD-15)
  algorithm_version text,                 -- SHELL — Story 6.9 writes 'inclusivcup-roulette-1.0.0'
  spin_plan         jsonb,                -- SHELL — Stories 6.4 / 6.8
  luck_weight_table int[],                -- SHELL — Story 6.6
  started_at        timestamptz,
  completed_at      timestamptz,

  constraint ceremony_state_valid check (state in ('not_started', 'locked', 'spinning', 'complete')),

  -- ONE ceremony per tournament in v1 (AD-18 scope). Also what makes lock_ceremony's insert-or-update
  -- expressible as a single ON CONFLICT statement rather than a read-then-branch race.
  constraint ceremony_tournament_key unique (tournament_id)
);

-- ⭐ THE STATEMENT 0003 DEFERRED TO EPIC 6 BY NAME. 0003:11-12: "ceremony (Epic 6): do NOT add
-- `alter table ceremony add constraint ceremony_snapshot_fk ...`. stat_snapshot is created FIRST
-- (substrate); ceremony.snapshot_id's FK to it is added in Epic 6." This is that statement, and this is
-- that migration. ⚠ NO `on delete` clause — deliberately NO ACTION: `stat_snapshot` has no DELETE grant for
-- ANY role (0003:79), so the referenced row is undeletable by construction; a cascade would describe a path
-- that cannot exist.
alter table public.ceremony
  add constraint ceremony_snapshot_fk foreign key (snapshot_id) references public.stat_snapshot(id);

comment on table public.ceremony is
  'AD-15 ceremony state machine, one row per tournament. state not_started -> locked (Story 6.2, this '
  'migration) -> spinning -> complete (6.4/6.8). `locked` is the moment the snapshot is captured and the '
  'four mutating admin RPCs start returning ceremony_locked. algorithm_version/spin_plan/luck_weight_table '
  'are SHELLS written by later Epic-6 stories, never by 6.2. Admin-only: anon/authenticated hold NO grant '
  '(AD-22); Story 6.8 WIDENS this with the reveal-gated axis — it never tightens it.';

-- ── ENABLE + FORCE RLS ───────────────────────────────────────────────────────
-- FORCE is non-negotiable: the generic catalog FORCE-guard in 0003_audit_snapshot_test.sql (Section A2)
-- asserts that NO public base table lacks FORCE, so it now covers `ceremony` too and fails loudly here if
-- omitted. FORCE also makes the policies apply to the table OWNER, closing the "owner quietly reads
-- everything" gap. FORCE does not affect BYPASSRLS roles — service_role still bypasses.
alter table public.ceremony enable row level security;
alter table public.ceremony force  row level security;

-- Admin-only SELECT, mirroring `audit_admin_read` (0003:68) byte-for-byte INCLUDING the `(select …)`
-- wrapper, which makes is_admin() an INITPLAN evaluated once per statement rather than once per row.
-- ⚠ Like audit_log's and award's, this policy is DORMANT defence-in-depth: with no table grant for
-- `authenticated`, even an admin 42501s before RLS runs. Admin surfaces read `ceremony` through SERVER
-- routes with the service key, never the client Data API. It is here so that the day a grant IS added
-- (6.8's reveal-gated widening), the read is already correctly scoped.
create policy ceremony_admin_read on public.ceremony for select to authenticated using ((select public.is_admin()));

-- ⭐ NO anon / authenticated GRANT OF ANY KIND — deliberately absent, exactly as for audit_log / app_role /
-- stat_snapshot* (0003:82-84) and `award` (0023:179-185). 6.2 ships the STRICTLY-CLOSED end state; 6.8
-- WIDENS it with the reveal-gated policy keyed on `spin.revealed_at`. Do not pre-build that: `spin` does not
-- exist, and a policy referencing a missing table cannot be written, only guessed at.
--
-- service_role (the sole writer, AD-2) gets SELECT + INSERT + UPDATE and deliberately NO DELETE: a ceremony
-- is not deleted, it advances through its states, and 6.4/6.8 need UPDATE for `state`/`spin_plan`. Identity
-- PK (generated always as identity) needs NO separate sequence grant (0003:77).
grant select, insert, update on public.ceremony to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 1 — `tournament.fair_seed` gets its teeth: the shape CHECK + the write-once trigger.
-- ════════════════════════════════════════════════════════════════════════════
-- 0001:33 created `fair_seed` as a plain nullable `text` and said so: "Write-once trigger + population is
-- AD-13 / Epic 4-6, NOT here". This is Epic 6, and this is that trigger.
--
-- The shape CHECK is exactly what review-data-integrity.md:371-379 (L2) asked for: `fair_seed` is a 64-char
-- LOWERCASE hex digest and `roster_entry.bracket_seed` is an `int` seeding POSITION (0004:30) — AD-13's
-- "never reused for each other" is already true BY TYPE, and this keeps it that way while making a
-- malformed digest unrepresentable. Lowercase only, because `demo.demo_sha256` is written lowercase by Go
-- (`hex.EncodeToString`) and a case-insensitive column would make two spellings of one seed possible.
alter table public.tournament
  add constraint tournament_fair_seed_hex check (fair_seed is null or fair_seed ~ '^[0-9a-f]{64}$');

-- ⭐⭐ AD-13's "published, never re-rolled", MADE MECHANISM-ENFORCED. A policy cannot hold this line:
-- `service_role` has BYPASSRLS, so it skips row POLICIES entirely — and unlike the 0003 append-only tables
-- there is no "just don't grant UPDATE" option here, because `tournament` legitimately needs UPDATE (state,
-- final_match_id, format_default). A BEFORE UPDATE trigger is what remains, and it binds every writer
-- including service_role and postgres.
--
-- ⚠⚠ THE WHEN CLAUSE PERMITS THREE THINGS ON PURPOSE, AND ALL THREE ARE PINNED IN pgTAP:
--   * `NULL -> value` — the freeze itself. `old.fair_seed is not null` is false, so the trigger never fires.
--   * `value -> the SAME value` — `new.fair_seed is distinct from old.fair_seed` is false, so re-writing the
--     identical hash is a NO-OP, not an IC908. This matters: a 4.7 rollback of the championship match clears
--     `tournament.final_match_id` (0018:347-350), so a rollback-then-re-approve re-runs the freeze path.
--     Refusing that would make an ordinary dispute correction impossible.
--   * ⭐ `value -> NULL` — the UN-FREEZE, and the reason `new.fair_seed is not null` is in the WHEN clause.
--     See the DECISION below; `rollback_match` is the only caller and it clears the seed only when it
--     un-crowns the champion.
--
-- ⭐⭐ DECISION F (code review, 2026-08-03) — AD-13's "published, never re-rolled" BINDS AT PUBLICATION,
-- NOT AT FIRST WRITE. As shipped, write-once bound at the first write, and that produced a defect: rollback
-- clears `final_match_id` but kept `fair_seed`, so a final that was re-decided the other way (manual override
-- + the AD-21 reset crowning GF2) left the seed naming a demo that was no longer championship-deciding —
-- reported as `fair_seed_frozen: true`, accepted by `lock_ceremony`, copied into `ceremony.seed_demo_sha256`,
-- and UNCORRECTABLE because IC908 refused the fix. Binding at publication is safe and strictly stronger:
--   (1) 6.2 publishes the seed to NOBODY — no anon grant anywhere, admin-only responses and the audit row
--       (AD-22); publication is Story 6.8's surface.
--   (2) after the lock, `rollback_match` is refused with `ceremony_locked`, so the seed CANNOT change once
--       the ceremony exists to publish it.
-- Therefore a seed can only ever move while it is still unpublished AND the championship is still in dispute
-- — which is exactly when it SHOULD move. ⚠ 6.8 must not weaken (2): the `ceremony_locked` guard on
-- `rollback_match` is what makes this rule true. `lock_ceremony`'s `seed_stale` refusal is the belt to this
-- braces — it catches a divergence that arises by any route the un-freeze does not cover.
-- Only a genuine CHANGE of one frozen seed to a DIFFERENT one raises. That is the whole rule, and nothing more.
create function public.tournament_fair_seed_write_once() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  raise exception
    'tournament %: fair_seed is WRITE-ONCE (AD-13) — it was frozen as % and cannot be re-rolled to %',
    old.id, old.fair_seed, new.fair_seed
    using errcode = 'IC908',
          hint = 'The fairness seed is SHA-256 of the championship-deciding demo, frozen inside the transaction that crowns the champion. Re-rolling it would invalidate every verification bundle already derived from it. Two things this trigger DELIBERATELY allows: re-writing the IDENTICAL hash (a rollback-then-re-approve of the same final), and clearing it to NULL (rollback_match un-crowning the champion, DECISION F — the seed is unpublished until the ceremony locks, and after the lock rollback is refused with ceremony_locked).';
end;
$$;

-- The WHEN clause is where the rule lives; the function body only ever runs for a genuine re-roll.
create trigger tournament_fair_seed_write_once
  before update on public.tournament
  for each row
  when (old.fair_seed is not null
        and new.fair_seed is not null                      -- ⭐ DECISION F: value -> NULL is the un-freeze
        and new.fair_seed is distinct from old.fair_seed)
  execute function public.tournament_fair_seed_write_once();

-- No REVOKE: a `returns trigger` function cannot be invoked as a normal call (Postgres refuses: "trigger
-- functions can only be called as triggers") and PostgREST does not expose it, so PUBLIC's default EXECUTE
-- is not a reachable surface. Same posture as match_terminal_state_guard (0017:216-217).

comment on column public.tournament.fair_seed is
  'AD-13 fairness seed = lowercase-hex SHA-256 of the championship-deciding demo bytes (= demo.demo_sha256 '
  'of the demo bound to tournament.final_match_id). Frozen INSIDE the approve_match transaction that crowns '
  'the champion; published as seed_hex. WRITE-ONCE by trigger (IC908) BINDING AT PUBLICATION, not at first '
  'write (DECISION F): NULL->value, value->same-value and value->NULL (rollback_match un-crowning) are '
  'allowed; changing one frozen seed to a DIFFERENT one is refused. The seed reaches no viewer until Story '
  '6.8, and after the ceremony locks rollback_match is refused with ceremony_locked — so it can only move '
  'while unpublished and the championship is still in dispute. Structurally distinct from '
  'roster_entry.bracket_seed, which is an int seeding POSITION and never a digest.';

-- ════════════════════════════════════════════════════════════════════════════
-- snapshot_efficiency_form — the ONE definition site of AD-19's efficiency {num,den}.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ WHY THIS EXISTS AT ALL. AD-19 names four blocks: volume ints, rate {num,den}, "the secondary stat", and
-- "the efficiency {num,den}". Under DECISION B we do not know WHICH keys 6.5 will name for the secondary or
-- efficiency rungs, so both blocks must be able to answer for ANY of the 21 vocabulary keys:
--   * `secondary` is just `volume || rate` — every key in its CLASS-SHAPED form (an int for a volume key, a
--     {num,den} pair for a rate key), so a rung-1 lookup is one key access.
--   * `efficiency` is every key in the UNIFORM {num,den} form: a volume key `k` with value `v` becomes
--     `{"num": v, "den": 1}`, a rate key keeps its natural pair. That is what makes an FR-29 rung-2
--     efficiency ratio (`eff_num_key` / `eff_den_key`, two arbitrary vocabulary keys) resolvable by pure
--     INTEGER CROSS-MULTIPLICATION with no class branching and no division — which is precisely AD-14's
--     "all decision arithmetic is integer-only; rates compared by cross-multiplication; no floats".
-- Deriving both blocks from `volume` and `rate` rather than restating 21 keys twice more is also what keeps
-- the four blocks from drifting apart: there is exactly one place a key can be added.
create function public.snapshot_efficiency_form(p_volume jsonb, p_rate jsonb) returns jsonb
  language sql
  immutable
  security invoker
  set search_path = ''
as $$
  select coalesce(
           (select jsonb_object_agg(e.k, jsonb_build_object('num', e.v, 'den', 1))
              from jsonb_each(coalesce(p_volume, '{}'::jsonb)) as e(k, v)),
           '{}'::jsonb
         )
         || coalesce(p_rate, '{}'::jsonb);
$$;

comment on function public.snapshot_efficiency_form(jsonb, jsonb) is
  'AD-19 efficiency block: every deciding-stat key in the UNIFORM {num,den} integer form (a volume int v '
  'becomes {"num":v,"den":1}; a rate key keeps its natural pair), so an FR-29 rung-2 ratio over any two '
  'vocabulary keys resolves by integer cross-multiplication with no division and no class branching '
  '(AD-14). The ONE definition site — do not restate the shape at a call site.';

-- LEAST PRIVILEGE, stated explicitly (the 6.1 code-review lesson): `create function` grants EXECUTE to
-- PUBLIC and anon/authenticated inherit from PUBLIC, so "no grant line" silently means "reachable by every
-- anonymous viewer". Its one caller is `lock_ceremony` (security invoker, itself granted to service_role
-- alone), so nothing anon or authenticated has any reason to reach it.
revoke execute on function public.snapshot_efficiency_form(jsonb, jsonb) from public;
grant  execute on function public.snapshot_efficiency_form(jsonb, jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (c) Task 3 — lock_ceremony: the lock + the AD-19 capture, in ONE transaction.
-- ════════════════════════════════════════════════════════════════════════════
-- The whole ceremony lock, in ONE transaction (AD-6): take every row lock in canonical order, re-read the
-- world under it, refuse with a typed reason if anything is not ready (having written NOTHING), then
-- capture the snapshot, transition `ceremony.state` not_started -> locked and `tournament.state` ->
-- 'ceremony', and write exactly one audit row.
--
-- ⚠⚠ LOCK ORDER — SEE **DECISION E** IN THE HEADER. `match` (canonical id order) -> `stat_row` (canonical
-- id order) -> `tournament`. NOT tournament-first: that would be an ABBA deadlock against approve_match.
--
-- ⚠ ORDERING IS LOAD-BEARING, TWICE OVER:
--   (1) EVERY guard runs before ANY write (the 0012/0017/0023 convention), and every business refusal is
--       RETURNED as {ok:false, reason, …context}, never raised.
--   (2) ⛔ `content_sha256` IS COMPUTED **BEFORE** THE HEADER INSERT, NOT UPDATED AFTER IT. `stat_snapshot`
--       is append-only BY GRANT (0003:79 grants SELECT+INSERT only, service_role included, because
--       BYPASSRLS skips row POLICIES but never table GRANTS) — an `update stat_snapshot set content_sha256`
--       would 42501. So: build the row set into `v_rows` ONCE, render and hash it, insert the header WITH
--       the hash, then expand the SAME `v_rows` into `stat_snapshot_row`. Getting this order wrong is the
--       single most likely way this function fails. If you ever find yourself needing an UPDATE on
--       `stat_snapshot`, the design is wrong.
create function public.lock_ceremony(
  p_tournament_id bigint,
  p_actor         text
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_t          record;
  v_cstate     text;
  v_roster     int;
  v_rows       jsonb;
  v_payload    text;
  v_content    text;
  v_snapshot   bigint;
  v_rowcount   int;
  v_eligible   int;
  v_final_sha  text;    -- ⭐ review: demo_sha256 of the demo bound to final_match_id (seed_stale / why)
  v_final_demo bigint;  -- ⭐ review: that match's demo_id — NULL means no demo was ever bound
begin
  -- ══ 1. AN UNLOCKED PEEK — existence only. It must NOT lock: the next statements take every lock in
  --    canonical order and a lock taken ahead of them would be OUT of order (the 4.3 40P01 deadlock).
  --    `tournament` has no DELETE grant for service_role, so the row cannot vanish between here and the lock.
  perform 1 from public.tournament t where t.id = p_tournament_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_tournament');
  end if;

  -- ══ 1b. EVERY LOCK, IN CANONICAL ORDER (DECISION E). This IS the AC's "SERIALIZABLE ceremony-lock"
  --    (DECISION A): while these locks are held, no concurrent approve_match / rollback_match /
  --    manual_resolve_match can proceed for this tournament — every one of them opens by locking the whole
  --    bracket in the same order, so they queue behind us and can never form a cycle.
  perform 1
     from public.match m
    where m.tournament_id = p_tournament_id
    order by m.id
      for update;

  -- ⚠ `for update of s` — lock the stat_row rows ONLY. The joined `match` rows are already held from the
  -- statement above, in canonical id order; naming `s` keeps this statement's lock set explicit rather than
  -- resting on "re-locking a row we already hold is a no-op".
  perform 1
     from public.stat_row s
     join public.match m on m.id = s.match_id
    where m.tournament_id = p_tournament_id
    order by s.id
      for update of s;

  -- The tournament row LAST, and only now (DECISION E).
  perform 1 from public.tournament t where t.id = p_tournament_id for update;

  -- ══ 1c. NOW read the world under the lock; nothing can move under us. Reading `tournament.state`,
  --    `final_match_id` and `fair_seed` HERE — under the row lock — is what closes the weakness that
  --    curate_award_catalog's lock-free `catalog_frozen` read has.
  select t.state, t.final_match_id, t.fair_seed
    into v_t
    from public.tournament t
   where t.id = p_tournament_id;

  -- A tournament with no ceremony row has never started one: that is `not_started` by definition.
  select coalesce(c.state, 'not_started') into v_cstate
    from public.ceremony c where c.tournament_id = p_tournament_id;
  v_cstate := coalesce(v_cstate, 'not_started');

  -- ══ 2. GUARDS — every one of them before any write, each RETURNED with its context keys.

  -- already_locked — AC2's idempotency answer. A second lock of a locked/spinning/complete ceremony writes
  -- nothing and says so; it never captures a second snapshot over the first.
  if v_cstate <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'already_locked', 'ceremony_state', v_cstate);
  end if;

  -- not_bracket_live — `ceremony` is reachable only from `bracket_live` (0001:29-30's closed set). A
  -- registration-phase or already-closed tournament has no championship to lock.
  if v_t.state <> 'bracket_live' then
    return jsonb_build_object('ok', false, 'reason', 'not_bracket_live', 'state', v_t.state);
  end if;

  -- champion_undecided — `final_match_id` is written by advance_match ONLY on a crown (0014:601-605). No
  -- champion means no championship-deciding demo, which means no seed.
  if v_t.final_match_id is null then
    return jsonb_build_object('ok', false, 'reason', 'champion_undecided');
  end if;

  -- Resolve what the seed OUGHT to be: the hash of the demo bound to the match that actually crowned. Both
  -- the `seed_unavailable` context and the `seed_stale` guard below read from this one lookup. Under the
  -- tournament + whole-bracket locks already held, so nothing can move it.
  select m.demo_id, d.demo_sha256
    into v_final_demo, v_final_sha
    from public.match m
    left join public.demo d on d.id = m.demo_id
   where m.id = v_t.final_match_id;

  -- ⛔ seed_unavailable — THE FAIL-CLOSED POINT FOR AN UNHASHED OR DEMO-LESS FINAL. approve_match
  -- deliberately does NOT refuse the championship approve when the seed cannot be resolved (refusing to
  -- publish the final because a hash is missing is a far worse failure); it records the outcome in its audit
  -- detail and commits. THIS is where that becomes an error, because a ceremony without a seed is not a
  -- ceremony — every spin is a pure function of it (AD-13/AD-14).
  -- ⭐ review 2026-08-03: SAY WHICH WALL THE ADMIN HIT. "seed_unavailable" alone sent them looking for a
  -- hashing bug when the real answer was "this final was never bound to a demo at all" (a walkover or a
  -- plain manual resolution) — a different problem with a different remedy, and one that is TERMINAL for
  -- the ceremony rather than fixable. `demo_unhashed` is the recoverable one: re-ingest the demo.
  if v_t.fair_seed is null then
    return jsonb_build_object(
      'ok', false, 'reason', 'seed_unavailable',
      'final_match_id', v_t.final_match_id,
      'why', case when v_final_demo is null then 'no_demo_bound' else 'demo_unhashed' end
    );
  end if;

  -- ⛔⭐ seed_stale — THE SEED NAMES A DEMO THAT IS NO LONGER CHAMPIONSHIP-DECIDING (code review, 2026-08-03).
  -- DECISION F's un-freeze on rollback removes the state at source; this is the belt to that braces, because
  -- it catches a divergence arrived at by ANY route, including ones nobody has thought of yet. Publishing a
  -- seed that is not SHA-256(final demo) would make `ceremony.seed_demo_sha256`'s own contract false and hand
  -- Story 6.9's verifier a mismatch it cannot explain — and the snapshot is write-once, so refusing is the
  -- only safe answer. `v_final_sha is null` is NOT stale: that is the `demo_unhashed` case, and a seed frozen
  -- earlier from a demo whose hash later went missing is still the right seed.
  if v_final_sha is not null and v_final_sha <> v_t.fair_seed then
    return jsonb_build_object(
      'ok', false, 'reason', 'seed_stale',
      'final_match_id', v_t.final_match_id,
      'seed_hex', v_t.fair_seed,
      'final_demo_sha256', v_final_sha
    );
  end if;

  -- no_roster — nobody to snapshot.
  select count(*) into v_roster
    from public.roster_entry r
   where r.tournament_id = p_tournament_id and r.status = 'active';
  if v_roster = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_roster');
  end if;

  -- ══ 2b. BUILD THE ROW SET (a pure SELECT — it writes nothing, so it belongs above the write line).
  --
  -- ⭐⭐ ONE stat_snapshot_row PER ROSTERED PLAYER — **not** one per player who has approved stats. A
  -- rostered player with zero approved rows still gets a row, zero-filled. Story 6.7's pity draw enumerates
  -- "every non-fully-DQ'd player with an empty shelf"; if the snapshot omits the winless, pity structurally
  -- cannot reach them, and the snapshot is write-once so there is no second chance.
  --
  -- ⚠ `status = 'active'` only. A soft-removed roster entry (0004:31-32) is not in the tournament, and
  -- letting it win an award would contradict every viewer surface, which filters the same way.
  --
  -- ⭐ ORDERED BY BYTE-LEX `steamid64` (`collate "C"`), which is Story 6.4's Stage-2 iteration order
  -- (epics.md:1070). The capture order and therefore the hash are deterministic and locale-independent —
  -- the database's default collation must NEVER be able to change a published digest.
  with roster as (
    select r.steamid64
      from public.roster_entry r
     where r.tournament_id = p_tournament_id
       and r.status = 'active'
  ),
  -- The CONTRIBUTING rows: this tournament, approved, non-idle — byte-identical predicates to the
  -- leaderboard's own base scan (0021:86-89), so anything summed here agrees with it by construction.
  contrib as (
    select s.match_id, s.steamid64, s.approved_at, s.rounds_won,
           s.kills, s.deaths, s.assists, s.mvps, s.flash_assists, s.utility_damage,
           s.knife_kills, s.wallbang_kills, s.through_smoke_kills, s.no_scope_kills, s.blind_kills,
           s.entry_frags, s.opening_deaths, s.rounds_played, s.hs_kills,
           s.adr_damage, s.kast_rounds
      from public.stat_row s
      join public.match m on m.id = s.match_id
     where m.tournament_id = p_tournament_id
       and s.status  = 'approved'
       and s.idle_dq = false
  ),
  -- EVERY approved row, idle INCLUDED — the snapshot-level `idle_dq` needs both counts (see below).
  all_approved as (
    select s.steamid64, s.idle_dq
      from public.stat_row s
      join public.match m on m.id = s.match_id
     where m.tournament_id = p_tournament_id
       and s.status = 'approved'
  ),
  -- The two facts `public.leaderboard` structurally cannot answer, plus DECISION D's `rounds_won`.
  own as (
    select c.steamid64,
           sum(coalesce(c.rounds_won, 0)) as rounds_won_total,   -- DECISION D
           min(c.approved_at)             as first_approved_at   -- DECISION C
      from contrib c
     group by c.steamid64
  ),
  -- ⚠⚠ `idle_dq` MEANS SOMETHING DIFFERENT AT THIS LAYER, AND IT IS EASY TO INVERT BY ACCIDENT.
  -- On `stat_row` it is PER-MATCH (0007:47) and `public.leaderboard` already excludes idle matches
  -- (0021:88). In the SNAPSHOT it means **FULLY DQ'd**: true iff the player has AT LEAST ONE approved
  -- stat_row and EVERY one of them is idle. A player with a mix contributes their non-idle matches and is
  -- FALSE. A rostered player with zero approved rows is FALSE with zero stats — they are winless, not
  -- disqualified, and 6.7's pity draw must still be able to reach them.
  dq as (
    select a.steamid64,
           count(*)                             as approved_rows,
           count(*) filter (where a.idle_dq)    as idle_rows
      from all_approved a
     group by a.steamid64
  ),
  -- ── h2h (AD-19 / FR-29 rung 3, prd.md:393) — per-opponent deciding values over the matches the two
  --    players SHARED. Both sides come from `contrib`, so both are approved and non-idle by construction.
  --    ⚠ The whole first tournament is 1v1 wingman (confirmed by Cuatro, 2026-07-21 — the same fact behind
  --    Story 5.2a), so every match has exactly two players and this join is dense and cheap. Do NOT build
  --    for a 5v5 shape that does not exist.
  h2h_pair as (
    select ca.steamid64 as me,
           cb.steamid64 as opp,
           jsonb_build_object(
             'kills',               sum(coalesce(ca.kills, 0)),
             'deaths',              sum(coalesce(ca.deaths, 0)),
             'assists',             sum(coalesce(ca.assists, 0)),
             'mvps',                sum(coalesce(ca.mvps, 0)),
             'flash_assists',       sum(coalesce(ca.flash_assists, 0)),
             'utility_damage',      sum(coalesce(ca.utility_damage, 0)),
             'knife_kills',         sum(coalesce(ca.knife_kills, 0)),
             'wallbang_kills',      sum(coalesce(ca.wallbang_kills, 0)),
             'through_smoke_kills', sum(coalesce(ca.through_smoke_kills, 0)),
             'no_scope_kills',      sum(coalesce(ca.no_scope_kills, 0)),
             'blind_kills',         sum(coalesce(ca.blind_kills, 0)),
             'entry_frags',         sum(coalesce(ca.entry_frags, 0)),
             'opening_deaths',      sum(coalesce(ca.opening_deaths, 0)),
             'rounds_won',          sum(coalesce(ca.rounds_won, 0)),
             'rounds_played',       sum(coalesce(ca.rounds_played, 0)),
             'matches_played',      count(*),
             'hs_kills',            sum(coalesce(ca.hs_kills, 0))
           ) as vol,
           jsonb_build_object(
             'adr',           jsonb_build_object('num', sum(coalesce(ca.adr_damage, 0)),
                                                 'den', sum(coalesce(ca.rounds_played, 0))),
             'kast_pct',      jsonb_build_object('num', sum(coalesce(ca.kast_rounds, 0)),
                                                 'den', sum(coalesce(ca.rounds_played, 0))),
             'hs_pct',        jsonb_build_object('num', sum(coalesce(ca.hs_kills, 0)),
                                                 'den', sum(coalesce(ca.kills, 0))),
             'entry_success', jsonb_build_object('num', sum(coalesce(ca.entry_frags, 0)),
                                                 'den', sum(coalesce(ca.entry_frags, 0))
                                                        + sum(coalesce(ca.opening_deaths, 0)))
           ) as rat
      from contrib ca
      join contrib cb
        on cb.match_id  = ca.match_id
       and cb.steamid64 <> ca.steamid64
      -- ⭐ review 2026-08-03: BOTH SIDES MUST BE ON THE ACTIVE ROSTER. `contrib` is scoped by tournament but
      -- NOT by roster, so without this a soft-removed entry (0004:31-32) whose matches were already approved
      -- appeared as an opponent key in every other player's map while `parts` — driven from `roster` — wrote
      -- no row for them. That put opponent keys in a WRITE-ONCE artifact that resolve to no snapshot identity,
      -- and 6.5's rung-3 lookup would chase them. Filtering `ca` too is redundant (the LEFT JOIN from `roster`
      -- already drops it) but keeps the CTE honest read on its own.
      join roster ra on ra.steamid64 = ca.steamid64
      join roster rb on rb.steamid64 = cb.steamid64
     group by ca.steamid64, cb.steamid64
  ),
  h2h_json as (
    select p.me, jsonb_object_agg(p.opp, p.vol || p.rat) as h2h
      from h2h_pair p
     group by p.me
  ),
  -- ── The per-player parts. ⭐ THE AGGREGATE COMES FROM `public.leaderboard` (AD-20: standings have exactly
  --    ONE normalization site and nothing hand-rolls a second), LEFT JOINed FROM `roster` so a zero-stat
  --    player survives the join instead of vanishing from the snapshot.
  --    ⭐⭐ ONLY THE INTEGER COLUMNS ARE SELECTED. The view exposes both halves of every rate; `adr`,
  --    `kast_pct`, `hs_pct` and `entry_success` are PRE-DIVIDED `numeric` and AD-19 forbids them in the
  --    snapshot outright. This is the measured answer to Epic-5 retro Action Item #1.
  --    ⚠ SEAM: `public.leaderboard` is tournament-BLIND by construction (0021:86-89 groups every approved
  --    non-idle stat_row by steamid64 with no tournament predicate). In v1 there is exactly one tournament
  --    (AD-18), so it coincides exactly with the tournament-scoped CTEs above. The day a second tournament
  --    exists, 0021 must gain the scope — do not "fix" it by hand-rolling the aggregate here.
  parts as (
    select ro.steamid64,
           jsonb_build_object(
             'kills',               coalesce(lb.kills_total, 0),
             'deaths',              coalesce(lb.deaths_total, 0),
             'assists',             coalesce(lb.assists_total, 0),
             'mvps',                coalesce(lb.mvps_total, 0),
             'flash_assists',       coalesce(lb.flash_assists_total, 0),
             'utility_damage',      coalesce(lb.utility_damage_total, 0),
             'knife_kills',         coalesce(lb.knife_kills_total, 0),
             'wallbang_kills',      coalesce(lb.wallbang_kills_total, 0),
             'through_smoke_kills', coalesce(lb.through_smoke_kills_total, 0),
             'no_scope_kills',      coalesce(lb.no_scope_kills_total, 0),
             'blind_kills',         coalesce(lb.blind_kills_total, 0),
             'entry_frags',         coalesce(lb.entry_frags_total, 0),
             'opening_deaths',      coalesce(lb.opening_deaths_total, 0),
             'rounds_won',          coalesce(o.rounds_won_total, 0),      -- DECISION D
             'rounds_played',       coalesce(lb.rounds_played_total, 0),
             'matches_played',      coalesce(lb.matches_played, 0),
             'hs_kills',            coalesce(lb.hs_kills_sum, 0)
           ) as vol,
           -- The four AD-19 rate pairs, from 0021's INTEGER halves only:
           --   adr           = adr_damage_sum  / rounds_played_total      (0021:69,66)
           --   kast_pct      = kast_rounds_sum / rounds_played_total      (0021:70,66)
           --   hs_pct        = hs_kills_sum    / kills_total              (0021:71,67)
           --   entry_success = entry_frags_total / entry_opportunities    (0021:84,108)
           -- ⚠ A `den` of 0 is CORRECT and must be preserved, not coalesced away: it means "no opportunity",
           -- which the integer-only consumer resolves as ineligible/undefined. Dividing here is the bug.
           jsonb_build_object(
             'adr',           jsonb_build_object('num', coalesce(lb.adr_damage_sum, 0),
                                                 'den', coalesce(lb.rounds_played_total, 0)),
             'kast_pct',      jsonb_build_object('num', coalesce(lb.kast_rounds_sum, 0),
                                                 'den', coalesce(lb.rounds_played_total, 0)),
             'hs_pct',        jsonb_build_object('num', coalesce(lb.hs_kills_sum, 0),
                                                 'den', coalesce(lb.kills_total, 0)),
             'entry_success', jsonb_build_object('num', coalesce(lb.entry_frags_total, 0),
                                                 'den', coalesce(lb.entry_opportunities, 0))
           ) as rat,
           coalesce(hj.h2h, '{}'::jsonb) as h2h,
           -- DECISION C — the documented proxy, with the PUBLISHED absent-sentinel -1.
           coalesce(trunc(extract(epoch from o.first_approved_at) * 1000)::bigint, -1) as achievement_ts,
           -- ⚠ NEVER NULL. A NULL propagates through every comparison and would silently drop the player —
           -- the exact hazard 0021 already coalesces against (0021:59-61).
           coalesce(lb.rounds_played_total, 0) as rounds_played,
           coalesce(lb.kills_total, 0)         as kills,
           coalesce(d.approved_rows > 0 and d.idle_rows = d.approved_rows, false) as idle_dq
      from roster ro
      left join public.leaderboard lb on lb.steamid64 = ro.steamid64
      left join own       o  on o.steamid64  = ro.steamid64
      left join dq        d  on d.steamid64  = ro.steamid64
      left join h2h_json  hj on hj.me        = ro.steamid64
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'steamid64',      p.steamid64,
               'stats_int',      jsonb_build_object(
                                   'volume',     p.vol,
                                   'rate',       p.rat,
                                   'secondary',  p.vol || p.rat,
                                   'efficiency', public.snapshot_efficiency_form(p.vol, p.rat)
                                 ),
               'h2h',            p.h2h,
               'achievement_ts', p.achievement_ts,
               'rounds_played',  p.rounds_played,
               'kills',          p.kills,
               'idle_dq',        p.idle_dq
             )
             order by p.steamid64 collate "C"
           ),
           '[]'::jsonb
         )
    into v_rows
    from parts p;

  v_rowcount := jsonb_array_length(v_rows);

  -- empty_snapshot — unreachable while `no_roster` passes (one row per active roster entry), guarded anyway:
  -- a header with no rows is not a snapshot, and `content_sha256` over nothing is not a commitment.
  if v_rowcount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_snapshot');
  end if;

  -- ══ 2c. THE CONTENT HASH — computed BEFORE the header insert (see the ⛔ in the function header).
  --
  -- THE RECIPE, EXACTLY, so an offline verifier can reproduce it byte-for-byte:
  --   * rows in byte-lex `steamid64` order (the order `v_rows` was aggregated in);
  --   * each row rendered as seven fields in this FIXED order, separated by U+001E (RECORD SEPARATOR):
  --       steamid64 · stats_int::text · h2h::text · achievement_ts · rounds_played · kills · idle_dq
  --   * rows joined by U+001D (GROUP SEPARATOR);
  --   * `sha256` of the UTF-8 encoding of that string, lowercase hex.
  -- The two separators CANNOT occur in the payload: `steamid64` is 17 digits, the scalars are integers and
  -- `true`/`false`, and jsonb's own text output escapes every control character as ``/``. jsonb
  -- also normalizes object keys into its own sorted order, so `::text` is canonical for a given value —
  -- which is what makes this hash stable without an external canonicalizer.
  --
  -- ⚠ THIS IS **NOT** `bundle_sha256`. RFC-8785 canonical JSON and the published up-front commitment hash
  -- are Story 6.9's (epics.md:1164). This digest proves the captured bytes are the bytes and NOTHING more;
  -- 6.9 must not inherit it as a constraint.
  select string_agg(
           (e ->> 'steamid64')
             || chr(30) || (e -> 'stats_int')::text
             || chr(30) || (e -> 'h2h')::text
             || chr(30) || (e ->> 'achievement_ts')
             || chr(30) || (e ->> 'rounds_played')
             || chr(30) || (e ->> 'kills')
             || chr(30) || (e ->> 'idle_dq'),
           chr(29) order by a.ord
         )
    into v_payload
    from jsonb_array_elements(v_rows) with ordinality as a(e, ord);

  v_content := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

  -- How many rostered players clear BOTH FR-21 floors, read from the ONE definition site (0021:126-128).
  -- Recorded in the audit row and returned: Story 6.2's job is to hand 6.4/6.5 the MEASURED eligibility
  -- picture, not to move a floor.
  select count(*) into v_eligible
    from public.roster_entry r
    join public.leaderboard lb on lb.steamid64 = r.steamid64
   where r.tournament_id = p_tournament_id
     and r.status = 'active'
     and lb.eligible_rate;

  -- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──

  -- ══ 3. THE SNAPSHOT HEADER — with its hash already computed. Append-only by grant; never updated.
  insert into public.stat_snapshot (tournament_id, content_sha256)
  values (p_tournament_id, v_content)
  returning id into v_snapshot;

  -- ══ 4. THE ROWS — expanded from the SAME `v_rows` the hash was taken over, so the digest and the stored
  --    rows cannot disagree. `with ordinality` is not needed: the PK is (snapshot_id, steamid64) and the
  --    ORDER is already baked into the hash, not into the physical rows.
  insert into public.stat_snapshot_row
    (snapshot_id, steamid64, stats_int, h2h, achievement_ts, rounds_played, kills, idle_dq)
  select v_snapshot,
         e ->> 'steamid64',
         e ->  'stats_int',
         e ->  'h2h',
         (e ->> 'achievement_ts')::bigint,
         (e ->> 'rounds_played')::int,
         (e ->> 'kills')::int,
         (e ->> 'idle_dq')::boolean
    from jsonb_array_elements(v_rows) e;

  -- ══ 5. THE CEREMONY ROW. `on conflict` on the one-per-tournament UNIQUE: a `not_started` row created by a
  --    future admin surface is transitioned in place, and a first lock creates it. The `already_locked`
  --    guard above means the update arm can only ever see a `not_started` row.
  insert into public.ceremony (tournament_id, state, seed_demo_sha256, snapshot_id, started_at)
  values (p_tournament_id, 'locked', v_t.fair_seed, v_snapshot, now())
  on conflict on constraint ceremony_tournament_key do update
    set state            = 'locked',
        seed_demo_sha256 = excluded.seed_demo_sha256,
        snapshot_id      = excluded.snapshot_id,
        started_at       = excluded.started_at
    -- ⭐ review 2026-08-03: THE PREDICATE IS THE MECHANISM; the guard above is only the convention. Today the
    -- `already_locked` guard plus the tournament row lock make this arm reachable only for a `not_started`
    -- row — but that rests on every future ceremony writer taking the same lock, which 6.4 (`spinning`) and
    -- 6.8 (`complete`) are under no obligation to do. Without this WHERE, the day one does not, this
    -- statement silently overwrites a live ceremony's `snapshot_id` and `seed_demo_sha256`.
    where public.ceremony.state = 'not_started';

  -- ══ 6. ⚠ THE TOURNAMENT STATE — AND ITS LIVE VIEWER CONSEQUENCE. `tournament.state = 'ceremony'` is read
  --    by `ceremonyUnlocked()` (lib/feed/read.ts:83-89) and lib/realtime/status.ts:44, so the Ceremonia nav
  --    tab UNLOCKS and the live pill flips to `final` the moment this commits. `/ceremonia` is still the 5.7
  --    <Placeholder> and that is CORRECT — Story 6.10 fills it. This is also what keeps 6.1's
  --    `catalog_frozen` coherent (it tests this state too). Confirmed with Cuatro (2026-08-03): the lock and
  --    the tab-unlock are ONE admin step, not two.
  --    ⚠ This UPDATE fires `tournament_fair_seed_write_once`'s WHEN clause evaluation and passes it trivially
  --    — `fair_seed` is not in the SET list, so `new.fair_seed is distinct from old.fair_seed` is false.
  update public.tournament
     set state = 'ceremony'
   where id = p_tournament_id;

  -- ══ 7. EXACTLY ONE audit_log row (AD-17). `action='start_ceremony'` is ALREADY the enumerated vocabulary
  --    (0003:25, uncapped `text` with NO CHECK) so there is NO migration and 0003 stays untouched.
  --    ⚠ EVERY key below is asserted in pgTAP: the 4.2 review found a suite asserting ONE key while a typo
  --    in any other would have NULLed the whole payload with the tests still green.
  --    ⚠ The actor is whatever the caller passed — the ROUTE is what guarantees it is the verified session
  --    (handleAdminCommand threads gate.steamid64, never the body).
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    p_tournament_id,
    p_actor,
    'start_ceremony',
    jsonb_build_object(
      'before', jsonb_build_object(
                  'ceremony_state',   'not_started',
                  'tournament_state', v_t.state
                ),
      'after',  jsonb_build_object(
                  'ceremony_state',   'locked',
                  'tournament_state', 'ceremony',
                  'snapshot_id',      v_snapshot,
                  'content_sha256',   v_content,
                  'seed_hex',         v_t.fair_seed,
                  'row_count',        v_rowcount,
                  'eligible_count',   v_eligible
                )
    )
  );

  -- ⚠ NO REALTIME EMIT, DELIBERATELY. SPINE:230's vocabulary is `match.approved` / `bracket.advanced` /
  -- `spin.reveal`; there is no `ceremony.locked` in it, and event names are "server-authored, named by
  -- semantic change" — never invented. (0018/0019 did mint `match.rolled_back`/`match.manual_resolved`, but
  -- each was the ONLY signal a viewer had that published truth had changed; here the viewer already learns
  -- the change from `tournament.state`, which lib/realtime/status.ts:44 keys on.) Recorded for 6.8/6.10.

  return jsonb_build_object(
    'ok',             true,
    'ceremony_state', 'locked',
    'snapshot_id',    v_snapshot,
    'content_sha256', v_content,
    'seed_hex',       v_t.fair_seed,
    'row_count',      v_rowcount,
    'eligible_count', v_eligible
  );
end;
$$;

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default and anon/authenticated inherit from PUBLIC, so without
-- this REVOKE the ceremony would be lockable straight off the Data API. Revoke first, then grant to the
-- single writer (0017:456-463 / 0023:529-530). The route's requireAdmin is the authorization gate; this is
-- the second lock on the same door.
revoke execute on function public.lock_ceremony(bigint, text) from public;
grant  execute on function public.lock_ceremony(bigint, text) to service_role;

-- ── AD-19 column comments — REQUIRED BY Task 3b, and missing until the code review found them absent ──────
-- Task 3b says of the sentinel "must be stated in a column comment and in Completion Notes" and of `idle_dq`
-- "write this reasoning into a column comment; it is the kind of definition that gets silently inverted by
-- the next reader." Both were written into Completion Notes only. `stat_snapshot_row` carried NO column
-- comment anywhere in the repo (0003 created the table without them). They belong here, next to the writer.
comment on column public.stat_snapshot_row.achievement_ts is
  'FR-29 rung 4. Integer epoch MILLISECONDS, with the PUBLISHED ABSENT-SENTINEL -1 (a rostered player with no '
  'contributing approved row). A DOCUMENTED PROXY, not a real achievement time: it is '
  'min(stat_row.approved_at) over the player''s contributing rows (DECISION C) — the parser records no '
  'per-event timestamps. TWO LIMITATIONS, both deliberate and both structural: (1) approve_match stamps the '
  'TRANSACTION timestamp on every stat_row of a match at once, so both competitors of a 1v1 duel tie EXACTLY '
  '— rung 4 cannot separate two players whose earliest match was against each other, and no match-level '
  'column can (min(match.id) ties identically); Story 6.5 must therefore carry a deterministic TERMINAL rung. '
  '(2) It tracks admin approval order, so re-ingesting the same demos changes it — the capture is '
  'reproducible from the STORED ROWS, never from the corpus.';

comment on column public.stat_snapshot_row.idle_dq is
  '⚠ MEANS SOMETHING DIFFERENT FROM stat_row.idle_dq — do not propagate the per-match reading here. On '
  'stat_row it is PER-MATCH (0007:47). In the SNAPSHOT it means FULLY DQ''d: true iff the player has AT LEAST '
  'ONE approved stat_row and EVERY one of them is idle. A player with a MIX contributes their non-idle '
  'matches and is FALSE (in lockstep with public.leaderboard, which excludes idle matches at 0021:88). A '
  'rostered player with ZERO approved rows is FALSE with zero stats — they are winless, not disqualified, and '
  'Story 6.7''s pity draw must still be able to reach them. Inverting this to ANY-idle would disqualify '
  'anyone who ever went AFK once.';

comment on column public.stat_snapshot_row.h2h is
  'FR-29 rung 3. {"<opponent_steamid64>": {<flat volume-union-rate form>}} over the matches the two players '
  'SHARED (both rows approved and non-idle). ⚠ AN ABSENT OPPONENT KEY IS THE SKIP SIGNAL — "they never met" '
  'is ABSENCE, never a zero, because a zero would silently become a real comparison. Both sides are '
  'restricted to the ACTIVE roster, so every opponent key resolves to a stat_snapshot_row in the same '
  'snapshot.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b)+(d) Task 2 + Task 4 — approve_match: the AD-13 freeze + the ceremony_locked guard.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ THIS IS 0017:235-463's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY TWO ADDITIONS AND NOTHING ELSE:
--   (1) the `ceremony_locked` typed refusal, alongside the existing guards, before any write (Task 4);
--   (2) the AD-13 `fair_seed` freeze, placed AFTER the advance and before the audit row (Task 2).
-- Do NOT edit 0017 (never edit an applied migration) and do NOT refactor, re-order or "improve" anything
-- else here — the review diffs this against 0017 and any unexplained delta is a finding.
--
-- ⭐⭐ THE PLACEMENT OF THE FREEZE IS LOAD-BEARING. It goes AFTER `advance_match` (step 5) because
-- advance_match is what CROWNS the champion and writes `tournament.final_match_id` (0014:601-605, whose own
-- comment says "AD-13's fair_seed = SHA-256(final demo) needs this to know which demo is championship-
-- deciding"). Freeze before the advance and `final_match_id` is still NULL, so the freeze silently never
-- fires on the one match it exists for.
--
-- ⚠ THE GRAND-FINAL RESET (AD-21) NEEDS NO SPECIAL CASE. `final_match_id` is written by whichever of the two
-- `gf_order` rows actually crowned the champion — gf_order=1's id when side A wins outright, gf_order=2's
-- when the reset resolves (0014:595-605) — so "which demo is the final one" has exactly ONE answer by
-- construction. The PRD leaves this ambiguous (prd.md:373 says only "the final (championship-deciding)
-- Match"); 0014 resolves it. Pinned here because this is where the next reader will look.
--
-- ⚠ A ROLLBACK OF THE FROZEN FINAL DOES **NOT** UN-FREEZE THE SEED. rollback_match clears
-- `tournament.final_match_id` (0018:347-350) but deliberately never touches `fair_seed`: AD-13 is
-- "published, never re-rolled", and the IC908 trigger is what makes that true rather than a convention. A
-- re-approve of the same final therefore finds `fair_seed` already set, writes nothing, and reports
-- `fair_seed_frozen: true` with the byte-identical `seed_hex`. Pinned in pgTAP in both directions.
create or replace function public.approve_match(
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
  v_cstate   text;      -- ⭐ 6.2 — the ceremony lock state, read under the lock
  v_final    bigint;    -- ⭐ 6.2 — tournament.final_match_id, re-read after the advance
  v_seed     text;      -- ⭐ 6.2 — tournament.fair_seed, re-read after the advance
  v_seed_hex text;      -- ⭐ 6.2 — the frozen seed reported back (null when unavailable)
  v_seed_ok  boolean := false;   -- ⭐ 6.2 — is this tournament's seed frozen after this call?
  v_seed_why text;               -- ⭐ 6.2 — 'not_final' | 'demo_unhashed' when it is not
  v_seed_new boolean := false;   -- ⭐ 6.2 — did THIS call perform the write?
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

  -- ⭐ 6.2 / AD-15 — ceremony_locked. The seam 0017:74-76 flagged and did not build ("Story 6.2 must add
  -- that check to whatever approve_match ships here"), now real. Read UNDER the whole-bracket lock taken
  -- above, never before it. Once the snapshot is captured the ceremony decides from frozen bytes, so a late
  -- approve must not silently change the leaderboards the audience is comparing the ceremony against.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_tid;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
  end if;

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

  -- ══ 5b. ⭐⭐ 6.2 / AD-13 — FREEZE tournament.fair_seed. Placed HERE and nowhere else (see the ⭐⭐ in the
  --    header): advance_match has just crowned the champion and written `final_match_id`, and the audit row
  --    below must be able to report the outcome.
  --
  --    THE RULE, EXACTLY: re-read `final_match_id`/`fair_seed` under the lock we already hold; freeze ONLY
  --    when final_match_id is non-NULL **and** equals THIS match **and** fair_seed is still NULL. Nothing
  --    else triggers a freeze. The value is `demo.demo_sha256` of the demo bound to this match — already
  --    lowercase-hex SHA-256 of the canonical .dem bytes, computed once in Go at ingest
  --    (worker/ingest/ingest.go:66-70) and re-verified on every re-parse (worker/ingest/reparse.go:52-84).
  --    ⛔ DO NOT RE-HASH ANYTHING. DO NOT TOUCH THE WORKER.
  --
  --    ⛔ `demo.demo_sha256` IS NULLABLE and this must not raise. The admin manual-upload path never hashes
  --    (0006:12-15), and a manual_resolved final has no demo at all. Refusing the CHAMPIONSHIP approve
  --    because a hash is missing would be a far worse failure than a missing seed, so we record the outcome
  --    honestly and commit. The FAIL-CLOSED POINT is lock_ceremony's `seed_unavailable` refusal, not here.
  select t.final_match_id, t.fair_seed into v_final, v_seed
    from public.tournament t where t.id = v_m.tournament_id;

  if v_final is distinct from p_match_id then
    v_seed_why := 'not_final';                     -- the ordinary, overwhelmingly common case
  elsif v_seed is not null then
    v_seed_hex := v_seed;                          -- already frozen (a rollback-then-re-approve of the final)
    v_seed_ok  := true;
  else
    -- v_sha is demo.demo_sha256 for v_m.demo_id, already resolved above for the feed entry.
    if v_sha is null then
      -- ⭐ review 2026-08-03: 'demo_unhashed' UNCONDITIONALLY. The old `case when v_m.demo_id is null then
      -- 'no_demo'` arm was DEAD CODE: the not_bound guard above already returned for a NULL demo_id, ~120
      -- lines earlier and unconditionally, so approve_match can never reach here without a bound demo. Worse
      -- than dead — it made the demo-less final LOOK handled here when in truth such a final can never be
      -- approved at all; it is resolved by hand or by walkover, and THOSE are the paths that must freeze
      -- (manual_resolve_match now does) or fail closed at lock_ceremony's `no_demo_bound`.
      v_seed_why := 'demo_unhashed';
    else
      update public.tournament set fair_seed = v_sha where id = v_m.tournament_id;
      v_seed_hex := v_sha;
      v_seed_ok  := true;
      v_seed_new := true;
    end if;
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
  --    ⭐ 6.2 adds the seed outcome, ALWAYS, so the freeze (or its absence) is on the audited record rather
  --    than inferred from the tournament row afterwards.
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
      'stat_rows_approved', v_approved,
      'fair_seed_frozen',   v_seed_ok,
      'fair_seed_wrote',    v_seed_new,
      'fair_seed_reason',   v_seed_why,
      'seed_hex',           v_seed_hex
    )
  );

  -- ══ 8. ⭐ AC2 — THE SINGLE EMIT, POST-COMMIT BY CONSTRUCTION. realtime.send INSERTS into realtime.messages
  --    inside THIS transaction; Realtime ships it off the replication slot only on commit — so the emit cannot
  --    outrun its own commit (0013:809-819). ONE Broadcast carries the semantic change (AD-11); the event name
  --    `match.approved` is SPECIFIED (SPINE:230), not invented. Mirror advance_match's shape (0013:839-851).
  --    ⚠ 6.2 does NOT add the seed to the Broadcast: the payload is a public-channel nudge and the seed is a
  --    server-side fact until Story 6.8 publishes the commitment (AD-22).
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

  -- ⭐ 6.2 EXTENDS THE RETURN PAYLOAD, ADDITIVELY. No existing key is renamed or removed, or 4.6b's callers
  -- (lib/match/approve.ts) and its pgTAP break.
  return jsonb_build_object(
    'ok',                 true,
    'stat_rows_approved', v_approved,
    'score_a',            v_score_a,
    'score_b',            v_score_b,
    'winner_entry',       v_winner,
    'advanced',           v_adv->'advanced',
    'champion',           v_adv->'champion',
    'fair_seed_frozen',   v_seed_ok,
    'seed_hex',           v_seed_hex
  );
end;
$$;

-- NO grants re-issued: `create or replace` with the same signature (bigint, text) keeps 0017:462-463 intact.

-- ════════════════════════════════════════════════════════════════════════════
-- (d) Task 4 — rollback_match: the ceremony_locked guard.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ 0018:92-398's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE ADDITION: the `ceremony_locked` typed
-- refusal, before any write, alongside the existing `not_resolved`. 0018:67-70 flagged this seam by name
-- ("Story 6.2 must add a `ceremony_locked` guard to rollback_match ... exactly as it must for
-- approve_match"). Do NOT edit 0018.
create or replace function public.rollback_match(
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
  v_cstate     text;                   -- ⭐ 6.2 — the ceremony lock state, read under the lock
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

  -- ⭐ 6.2 / AD-15 — ceremony_locked. The seam 0018:67-70 flagged and did not build. Read UNDER the
  -- whole-bracket lock taken above, never before it. A rollback after the snapshot is captured would remove
  -- a contribution from the live leaderboards while the ceremony still decides from the frozen bytes — the
  -- exact divergence AD-15 exists to prevent.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_tid;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
  end if;

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
  --
  --     ⭐⭐ 6.2 + code review 2026-08-03 (DECISION F) — THE SEED IS CLEARED WITH THE CROWN, IN THE SAME
  --     STATEMENT. The shipped version deliberately kept `fair_seed` here, reasoning that AD-13 is "published,
  --     never re-rolled". That reasoning had a hole: un-crowning without un-freezing lets `fair_seed` and
  --     `final_match_id` DISAGREE, and a final re-decided the other way (manual override + the AD-21 reset
  --     crowning GF2) then publishes the hash of a demo that is no longer championship-deciding — silently,
  --     reported as `fair_seed_frozen: true`, and UNCORRECTABLE because IC908 refused the fix.
  --     Clearing it here makes the invariant hold at all times: `fair_seed` is non-NULL IFF a champion is
  --     crowned and their demo is hashed. A re-approve of the SAME final re-freezes the byte-identical hash,
  --     so the ordinary dispute correction is unchanged in observable behaviour.
  --     ⚠ WHY THIS IS NOT THE RE-ROLL AD-13 FORBIDS: the seed reaches no viewer until Story 6.8 (6.2 grants
  --     anon nothing), and once the ceremony locks, THIS FUNCTION IS REFUSED with `ceremony_locked` before
  --     any write. So the seed can only move while it is still unpublished and the championship is still in
  --     dispute. 6.8 must not weaken that guard — it is what makes this safe. See the DECISION F block at the
  --     write-once trigger.
  update public.tournament
     set final_match_id = null,
         fair_seed      = null
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

-- NO grants re-issued: `create or replace` with the same signature (bigint, text) keeps 0018:406-407 intact.

-- ════════════════════════════════════════════════════════════════════════════
-- (d) Task 4 — manual_resolve_match: the ceremony_locked guard.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ 0019:193-406's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE ADDITION: the `ceremony_locked` typed
-- refusal, before any write, alongside the existing `not_manual_resolvable`. 0019:68-71 flagged this seam by
-- name ("Story 6.2 must add a `ceremony_locked` guard to manual_resolve_match too"). Do NOT edit 0019.
create or replace function public.manual_resolve_match(
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
  v_final     bigint;     -- ⭐ review — tournament.final_match_id, re-read after the advance
  v_seed      text;       -- ⭐ review — tournament.fair_seed, re-read after the advance
  v_seed_hex  text;       -- ⭐ review — the frozen seed when this call froze (or found) one
  v_seed_ok   boolean := false;
  v_seed_new  boolean := false;
  v_seed_why  text;       -- ⭐ review — 'not_final' | 'no_demo' | 'demo_unhashed' when it is not frozen
  v_adv       jsonb;
  v_before    jsonb;
  v_detail    jsonb;
  v_cstate    text;       -- ⭐ 6.2 — the ceremony lock state, read under the lock
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

  -- ⭐ 6.2 / AD-15 — ceremony_locked. The seam 0019:68-71 flagged and did not build. Read UNDER the
  -- whole-bracket lock taken above, never before it. A hand-entered result after the snapshot is captured is
  -- the same class of concern as a late approve: it changes the live standings while the ceremony decides
  -- from frozen bytes.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_tid;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
  end if;

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
  --    (DECISION C — mirror declare_match_format 0012:430-453). match_manual_override_audited (0019) refuses
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

  -- ══ 5b. ⭐⭐ AD-13 — FREEZE tournament.fair_seed (added at code review, 2026-08-03).
  --
  --    WHY THIS BLOCK EXISTS. As shipped, the freeze lived ONLY in approve_match — but this function calls
  --    `advance_match` too (just above), so it CROWNS CHAMPIONS and writes `tournament.final_match_id` while
  --    never touching `fair_seed`. `lock_ceremony` then refused `seed_unavailable` FOREVER, with no repair
  --    path anywhere in the product: approve needs `pending`, rollback needs `resolved`, this function needs
  --    `declared`/`live`/`pending`, and `manual_resolved` is terminal until Story 4.8. A hand-resolved final
  --    therefore bricked the entire Awards Roulette for that tournament.
  --
  --    ⭐ THE CASE THAT MADE IT A DEFECT RATHER THAN A DESIGN CHOICE: the AUDITED OVERRIDE (`p_override`,
  --    `demo_id IS NOT NULL`, the FR-16 dispute correction). There a REAL, HASHED, championship-deciding demo
  --    IS bound — the seed is sitting right there — and the shipped code discarded it purely because the
  --    freeze had been written into the wrong function. Task 2 anticipated the DEMO-LESS manual final and
  --    routed it to `seed_unavailable` deliberately; it did not anticipate this shape.
  --
  --    Confirmed with Cuatro (2026-08-03): freeze here; keep failing closed for the genuinely demo-less
  --    routes (plain manual, mark_walkover) — an ADMIN-SETTABLE seed was rejected as a bigger hole than the
  --    dead-end it would close. The guard is byte-identical in shape to approve_match's.
  select t.final_match_id, t.fair_seed into v_final, v_seed
    from public.tournament t where t.id = v_m.tournament_id;

  if v_final is distinct from p_match_id then
    v_seed_why := 'not_final';                     -- the ordinary case: this was not the crowning
  elsif v_seed is not null then
    v_seed_hex := v_seed;                          -- already frozen (re-resolving an already-decided final)
    v_seed_ok  := true;
  else
    -- ⚠ Unlike approve_match, a NULL demo_id IS reachable here — that is the plain (non-override) manual
    -- resolution, and it is exactly the demo-less case that must fail closed at lock_ceremony rather than
    -- write a NULL seed. So both arms are live and `no_demo` is NOT dead code in this function.
    select d.demo_sha256 into v_sha from public.demo d where d.id = v_m.demo_id;
    if v_sha is null then
      v_seed_why := case when v_m.demo_id is null then 'no_demo' else 'demo_unhashed' end;
    else
      update public.tournament set fair_seed = v_sha where id = v_m.tournament_id;
      v_seed_hex := v_sha;
      v_seed_ok  := true;
      v_seed_new := true;
    end if;
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
    'champion',     v_adv->'champion',
    -- ⭐ review 2026-08-03 — ADDITIVE ONLY, mirroring approve_match's payload (0024:1205-1206). No existing
    -- key is renamed or removed, so 0019's callers and its pgTAP are unaffected.
    -- ⚠ WHY THE FREEZE OUTCOME IS NOT ALSO IN THE AUDIT `detail` HERE, unlike approve_match: this function
    -- writes its audit row FIRST, on purpose — `match_manual_override_audited` (0019) refuses the step-4
    -- UPDATE unless that row already exists in THIS transaction, so the row necessarily precedes the advance
    -- and therefore the freeze. Appending a second audit row would break the one-row-per-command shape. The
    -- seed change is still fully traceable: `tournament.fair_seed` moves NULL -> value exactly once, and
    -- lock_ceremony's `start_ceremony` row records the value it locked.
    'fair_seed_frozen', v_seed_ok,
    'fair_seed_wrote',  v_seed_new,
    'fair_seed_reason', v_seed_why,
    'seed_hex',         v_seed_hex
  );
end;
$$;

-- NO grants re-issued: `create or replace` with the same signature (bigint, int, int, text, boolean) keeps
-- 0019:414-415 intact.

-- ════════════════════════════════════════════════════════════════════════════
-- (d) Task 4 — curate_award_catalog: `catalog_frozen` gets the REAL lock behind it.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ 0023:274-523's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE CHANGE: GUARD 2's state test. 0023:269-273
-- says in so many words that this is 6.2's to replace ("`catalog_frozen` IS AN HONEST PARTIAL OF AD-15. The
-- real ceremony lock needs the `ceremony` table, which does not exist until Story 6.2. … Story 6.2 REPLACES
-- this state test with the real lock"). Do NOT edit 0023.
--
-- ⚠ THE REFUSAL STRING STAYS `catalog_frozen`. It is in lib/awards/curate.ts:51-59's trusted-reason Set and
-- app/api/admin/awards/route.ts:33-42 maps it to 409; changing it breaks both, plus 0023's pgTAP Section F.
-- Only what it TESTS changes.
--
-- ⚠ BOTH DISJUNCTS ARE KEPT, DELIBERATELY. A ceremony row past `not_started` is the real lock; but
-- `tournament.state = 'closed'` with no ceremony row must STILL freeze the catalog (a closed event is over,
-- whether or not anyone ran a ceremony). Dropping the state half would quietly re-open a closed event's
-- catalog, so this is a STRICT WIDENING of 0023's guard, never a replacement of its coverage.
create or replace function public.curate_award_catalog(
  p_tournament_id bigint,
  p_actor         text,
  p_awards        jsonb
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  c_max_awards constant int := 64;   -- a sane cap; the seed catalog is 12 and a ceremony of >64 spins is absurd
  v_state    text;
  v_cstate   text;                   -- ⭐ 6.2 — the ceremony lock state
  v_n        int;
  v_e        jsonb;
  v_name     text;
  v_bucket   text;
  v_class    text;
  v_stat     text;
  v_dir      text;
  v_sec      text;
  v_effn     text;
  v_effd     text;
  v_prio     numeric;
  v_fr       numeric;
  v_fk       numeric;
  v_names    text[]  := array[]::text[];
  v_prios    numeric[] := array[]::numeric[];
  v_before   jsonb;
  v_after    jsonb;
begin
  -- ══ GUARD 1 — no_tournament. ⭐⭐ NOW UNDER `for update`, CHANGED AT CODE REVIEW (2026-08-03).
  --
  --    0023 read this row lock-free and said so, and 6.2 as shipped kept that ("still lock-free, exactly as
  --    0023 designed it") while ALSO claiming in its header that taking the tournament lock in lock_ceremony
  --    "closes the weakness curate_award_catalog's lock-free catalog_frozen read has". That claim was FALSE,
  --    and the review proved why: `lock_ceremony` locks `match`, `stat_row` and `tournament`; this function
  --    locked only `award`, and only ~120 lines later. The two transactions shared ZERO lock conflicts, so:
  --
  --      T1 curate reads ceremony_state = 'not_started' -> passes GUARD 2
  --      T2 lock_ceremony runs to completion and COMMITS (snapshot captured, inputs frozen)
  --      T1 then takes its `award` lock and rewrites the catalog
  --
  --    — the award catalog replaced AFTER the ceremony's inputs were frozen, which is precisely what
  --    `catalog_frozen` exists to prevent and precisely the AD-15 divergence 0023 deferred to this story.
  --
  --    Taking the tournament row here makes GUARD 2 real: `lock_ceremony` takes the SAME row `for update`
  --    (0024's step 1b), so the two now serialize and whichever loses re-reads committed state.
  --    ⚠ LOCK ORDER IS SAFE — this function's order becomes `tournament` -> `award`. Nothing else wants both:
  --    lock_ceremony and approve_match never touch `award`; this function never touches `match`/`stat_row`.
  --    No cycle is introduced (verified against 0011/0014/0017/0018/0019/0024).
  --    ⚠ It costs ONE row lock on a call that may still refuse — a deliberate, narrow departure from 0023's
  --    "a doomed call must not lock rows" (the 4.2 lesson). Correctness of the freeze outranks it, and a
  --    nonexistent tournament still locks nothing at all.
  select t.state into v_state from public.tournament t where t.id = p_tournament_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_tournament');
  end if;

  -- ══ GUARD 2 — catalog_frozen. ⭐ 6.2: the REAL AD-15 lock, replacing 0023's honest partial. A ceremony past
  --    `not_started` means the snapshot is captured and the spin order is decided from it — re-curating the
  --    catalog underneath that would change which awards exist after the draw was fixed. The
  --    `tournament.state` half is KEPT (see the ⚠ in the header): a closed event freezes with or without a
  --    ceremony row. ⭐ Both halves are now read UNDER the tournament row lock GUARD 1 took — see the long
  --    note there for why the lock-free version was a live TOCTOU against `lock_ceremony`.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = p_tournament_id;
  if coalesce(v_cstate, 'not_started') <> 'not_started' or v_state in ('ceremony', 'closed') then
    return jsonb_build_object(
      'ok', false, 'reason', 'catalog_frozen',
      'state', v_state, 'ceremony_state', coalesce(v_cstate, 'not_started')
    );
  end if;

  -- ══ GUARD 3 — empty_catalog. A catalog of zero awards is never a legitimate curation; it is a malformed body
  --    or a mistake, and "replace everything with nothing" would silently wipe a curated catalog.
  if p_awards is null or jsonb_typeof(p_awards) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'empty_catalog');
  end if;
  v_n := jsonb_array_length(p_awards);
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_catalog');
  end if;

  -- ══ GUARD 4 — too_many_awards.
  if v_n > c_max_awards then
    return jsonb_build_object('ok', false, 'reason', 'too_many_awards', 'count', v_n, 'max', c_max_awards);
  end if;

  -- ══ GUARD 5/6/7 — per-element validity, then duplicate name / duplicate priority WITHIN the payload.
  --    ⚠ Numbers are checked via jsonb_typeof + a numeric compare rather than a bare `::int` cast: a cast of
  --    "12abc" raises 22P02, which would surface as an opaque 500 where a malformed award is a typed refusal.
  for v_e in select * from jsonb_array_elements(p_awards) loop
    if jsonb_typeof(v_e) <> 'object' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'not_an_object');
    end if;

    v_name   := v_e ->> 'name';
    v_bucket := v_e ->> 'bucket';
    v_class  := v_e ->> 'class';
    v_stat   := v_e ->> 'deciding_stat';
    v_dir    := coalesce(v_e ->> 'direction', 'max');
    v_sec    := v_e ->> 'secondary_stat';
    v_effn   := v_e ->> 'eff_num_key';
    v_effd   := v_e ->> 'eff_den_key';

    -- Non-blank name, the SAME `~ '[^[:space:]]'` test the CHECK uses (a TAB is not a name — the 4.2 bug).
    -- ⚠ `coalesce(jsonb_typeof(...), '')` IS LOAD-BEARING, NOT DEFENSIVE NOISE (6.1 code review): `v_e -> 'name'`
    -- on an object with NO `name` key is SQL NULL, `jsonb_typeof` is STRICT so it returns NULL, `NULL <> 'string'`
    -- is NULL, and PL/pgSQL treats a NULL IF as FALSE. Without the coalesce an element that simply OMITS the key
    -- falls through EVERY guard below and dies at the INSERT with 23502 — an opaque 500 where a malformed payload
    -- is owed a typed refusal. The optional floors already gate on `v_e ? 'key'`; these two REQUIRED fields are
    -- the ones that must not.
    if coalesce(jsonb_typeof(v_e -> 'name'), '') <> 'string' or v_name !~ '[^[:space:]]' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'name');
    end if;
    if v_bucket is null or v_bucket not in ('skill', 'clutch', 'weird', 'comedy') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'bucket', 'name', v_name);
    end if;
    if v_class is null or v_class not in ('rate', 'volume') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'class', 'name', v_name);
    end if;
    if v_stat is null or not (v_stat = any (public.award_stat_vocabulary(null))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'deciding_stat', 'name', v_name);
    end if;
    if v_dir not in ('max', 'min') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'direction', 'name', v_name);
    end if;
    -- Class ↔ key coherence, mirroring award_class_key_coherent: this is what keeps `class` honest, and 6.4's
    -- Stage 2 branches on it. A rate award over a volume key would be cross-multiplied as a ratio that has no
    -- denominator.
    if not (
      (v_class = 'rate'   and v_stat = any (public.award_stat_vocabulary('rate')))
      or
      (v_class = 'volume' and v_stat = any (public.award_stat_vocabulary('volume')))
    ) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'class_key_mismatch', 'name', v_name);
    end if;
    -- The three optional tiebreak keys: NULL or a vocabulary key. Anything else is a typo that would otherwise
    -- reach 6.5's ladder as an unresolvable rung.
    if v_sec is not null and not (v_sec = any (public.award_stat_vocabulary(null))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'secondary_stat', 'name', v_name);
    end if;
    if v_effn is not null and not (v_effn = any (public.award_stat_vocabulary(null))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'eff_num_key', 'name', v_name);
    end if;
    if v_effd is not null and not (v_effd = any (public.award_stat_vocabulary(null))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'eff_den_key', 'name', v_name);
    end if;

    -- priority: a POSITIVE int4. int4 is the column type, so a value above INT4_MAX would raise 22003 (an opaque
    -- 500) rather than the typed refusal a malformed payload deserves.
    -- Same NULL-fallthrough trap as `name` above: an element with no `priority` key must refuse, not reach the
    -- INSERT as a NULL (which would also poison `v_prios`, disabling duplicate-priority detection for every
    -- later element via `NULL = any(...)`).
    if coalesce(jsonb_typeof(v_e -> 'priority'), '') <> 'number' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'priority', 'name', v_name);
    end if;
    v_prio := (v_e ->> 'priority')::numeric;
    if v_prio <> trunc(v_prio) or v_prio < 1 or v_prio > 2147483647 then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'priority', 'name', v_name);
    end if;

    -- floors: NON-NEGATIVE int4, defaulted exactly as the column defaults (24 / 0) when omitted.
    if v_e ? 'floor_rounds' and jsonb_typeof(v_e -> 'floor_rounds') <> 'number' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'floor_rounds', 'name', v_name);
    end if;
    if v_e ? 'floor_kills' and jsonb_typeof(v_e -> 'floor_kills') <> 'number' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'floor_kills', 'name', v_name);
    end if;
    v_fr := coalesce((v_e ->> 'floor_rounds')::numeric, 24);
    v_fk := coalesce((v_e ->> 'floor_kills')::numeric, 0);
    if v_fr <> trunc(v_fr) or v_fr < 0 or v_fr > 2147483647
       or v_fk <> trunc(v_fk) or v_fk < 0 or v_fk > 2147483647 then
      return jsonb_build_object('ok', false, 'reason', 'invalid_award', 'detail', 'floors', 'name', v_name);
    end if;

    -- duplicate_name / duplicate_priority WITHIN the payload. Caught here, before any write, so the deferrable
    -- UNIQUE never has to raise at COMMIT for an app-path call — the constraint stays a backstop for raw writers.
    if v_name = any (v_names) then
      return jsonb_build_object('ok', false, 'reason', 'duplicate_name', 'name', v_name);
    end if;
    if v_prio = any (v_prios) then
      return jsonb_build_object('ok', false, 'reason', 'duplicate_priority', 'priority', v_prio::int);
    end if;
    v_names := v_names || v_name;
    v_prios := v_prios || v_prio;
  end loop;

  -- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──

  -- Lock the tournament's existing catalog in canonical (id) order before the first write.
  perform 1 from public.award a where a.tournament_id = p_tournament_id order by a.id for update;

  -- The BEFORE half of the AD-17 audit payload, read UNDER the lock.
  select jsonb_build_object(
           'count', count(*),
           'awards', coalesce(jsonb_agg(jsonb_build_object(
                       'name', a.name, 'bucket', a.bucket, 'class', a.class,
                       'deciding_stat', a.deciding_stat, 'direction', a.direction, 'priority', a.priority
                     ) order by a.priority), '[]'::jsonb)
         )
    into v_before
    from public.award a
   where a.tournament_id = p_tournament_id;

  -- DELETE-MISSING first: the payload IS the catalog, so an award the payload omits is retired. Doing it BEFORE
  -- the upsert also frees any priority the removed rows held (belt-and-braces — the deferred UNIQUE would tolerate
  -- the overlap anyway, which is exactly why it is deferred).
  delete from public.award a
   where a.tournament_id = p_tournament_id
     and not (a.name = any (v_names));

  -- UPSERT on (tournament_id, name). ⚠ The arbiter is the IMMEDIATE `award_tournament_name_key`; a DEFERRED
  -- unique constraint cannot be an ON CONFLICT arbiter, which is a second reason the deferral lives on PRIORITY
  -- and not on name.
  insert into public.award (
    tournament_id, name, bucket, class, deciding_stat, direction,
    secondary_stat, eff_num_key, eff_den_key, floor_rounds, floor_kills, priority
  )
  select
    p_tournament_id,
    e ->> 'name',
    e ->> 'bucket',
    e ->> 'class',
    e ->> 'deciding_stat',
    coalesce(e ->> 'direction', 'max'),
    e ->> 'secondary_stat',
    e ->> 'eff_num_key',
    e ->> 'eff_den_key',
    -- ⚠ `trunc(…::numeric)::int`, NOT a bare `::int` (6.1 code review). jsonb stores numbers as `numeric` and
    -- PRESERVES SCALE, so `'{"priority":1.0}'::jsonb ->> 'priority'` is the TEXT `'1.0'` — and `'1.0'::int` raises
    -- 22P02, because int4in rejects a decimal point. The guards above validate via `::numeric` (where
    -- `trunc(1.0) = 1.0` passes), so a bare cast here made the WRITE convert differently from the CHECK and turned
    -- an accepted payload into an opaque 500. Converting the same way in both places is the fix; `trunc` is a
    -- no-op on any value the guards let through, and that is exactly why it is safe.
    coalesce(trunc((e ->> 'floor_rounds')::numeric)::int, 24),
    coalesce(trunc((e ->> 'floor_kills')::numeric)::int, 0),
    trunc((e ->> 'priority')::numeric)::int
  from jsonb_array_elements(p_awards) e
  on conflict on constraint award_tournament_name_key do update
    set bucket         = excluded.bucket,
        class          = excluded.class,
        deciding_stat  = excluded.deciding_stat,
        direction      = excluded.direction,
        secondary_stat = excluded.secondary_stat,
        eff_num_key    = excluded.eff_num_key,
        eff_den_key    = excluded.eff_den_key,
        floor_rounds   = excluded.floor_rounds,
        floor_kills    = excluded.floor_kills,
        priority       = excluded.priority;

  -- The AFTER half.
  select jsonb_build_object(
           'count', count(*),
           'awards', coalesce(jsonb_agg(jsonb_build_object(
                       'name', a.name, 'bucket', a.bucket, 'class', a.class,
                       'deciding_stat', a.deciding_stat, 'direction', a.direction, 'priority', a.priority
                     ) order by a.priority), '[]'::jsonb)
         )
    into v_after
    from public.award a
   where a.tournament_id = p_tournament_id;

  -- ══ EXACTLY ONE audit_log row per ACCEPTED call (AD-17). `action='curate_awards'` extends the uncapped
  --    vocabulary with no migration. ⚠ The actor is whatever the caller passed — the ROUTE is what guarantees it
  --    is the verified session (handleAdminCommand threads gate.steamid64, never the body).
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    p_tournament_id,
    p_actor,
    'curate_awards',
    jsonb_build_object('before', v_before, 'after', v_after)
  );

  return jsonb_build_object(
    'ok', true,
    'count', (v_after ->> 'count')::int,
    'before_count', (v_before ->> 'count')::int
  );
end;
$$;

-- NO grants re-issued: `create or replace` with the same signature (bigint, text, jsonb) keeps 0023:529-530
-- intact.

-- ════════════════════════════════════════════════════════════════════════════
-- (d5) CODE REVIEW 2026-08-03 — mark_walkover: the ceremony_locked guard.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ 0015:280-415's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE ADDITION: the `ceremony_locked` typed
-- refusal, before any write, alongside the existing `not_awaiting` / `grace_active` / `bad_winner`.
-- Do NOT edit 0015.
--
-- ⭐ WHY THIS IS HERE AND THE OTHER TWO 0015 RPCs ARE NOT. The story scoped the guard to four RPCs
-- deliberately. The review found `mark_walkover` is a FIFTH that must be in the set, for a reason none of the
-- other unguarded RPCs share: it calls `advance_match` (0015:375), so it CROWNS CHAMPIONS and can write a NEW
-- `tournament.final_match_id` AFTER the ceremony has locked and the seed has been committed into
-- `ceremony.seed_demo_sha256`. That falsifies an already-published commitment, and the snapshot is write-once
-- so there is no repair. It is reachable: the AD-21 reset creates BOTH `gf_order` rows, so an unplayed
-- `gf_order = 2` row can sit in `declared`/`awaiting_grace` after `gf_order = 1` crowned.
--
-- `begin_match_grace`, `resume_match` and `bind_match_demo` are DELIBERATELY still unguarded here: none can
-- move `final_match_id`, so none can falsify a committed seed. What they CAN do post-lock is churn match
-- state and push `timeline_feed` entries while the audience is watching the ceremony — a viewer-integrity
-- concern, recorded in deferred-work.md and owned by Story 6.8, which owns the reveal surface and the
-- judgement about what the audience may see mid-ceremony. Confirmed with Cuatro (2026-08-03).
--
-- ⚠ THE GUARD READS UNDER THE LOCK THE RPC ALREADY TAKES (step 1b's ordered whole-bracket `match` lock),
-- which is the SAME lock `lock_ceremony` takes first — so the two genuinely serialize and this read cannot be
-- a TOCTOU. Do not hoist it above 1b.
create or replace function public.mark_walkover(
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
  v_cstate   text;                   -- ⭐ review — the ceremony lock state, read under the lock
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

  -- ⭐ AD-15 — ceremony_locked. A forfeit can crown a champion, and a crown after the lock rewrites
  -- `final_match_id` out from under a seed that is already committed and (post-6.8) published.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_tid;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
  end if;

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

-- NO grants re-issued: `create or replace` with the same signature (bigint, text, bigint) keeps 0015:427-428
-- intact.
