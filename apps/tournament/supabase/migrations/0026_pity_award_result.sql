-- supabase/migrations/0026_pity_award_result.sql
-- Logical migration 0026 — a pity `award_result` has NO award (Story 6.7, FR-28 / AD-14 / SM-2 /
-- SOLUTION-DESIGN §9.4 / ARCHITECTURE-SPINE.md:221). The FOURTH Epic-6 migration, and the smallest.
--
-- ⭐ THE THESIS, IN ONE SENTENCE. FR-28's consolation prize is not a CATEGORY — it has no deciding
-- stat, no bucket and no direction — so a pity `award_result` has no `award` row to point at, and
-- the schema should make "which award was it?" UNREPRESENTABLE rather than answered wrong.
--
-- WHY THIS MIGRATION EXISTS AT ALL. `0025:146-147` declares
--
--     award_id bigint NOT NULL constraint award_result_award_fk references award(id) on delete restrict
--
-- and `0025:81-82` homes the pity row's CONTENT to Story 6.7 while noting that "nothing writes one
-- here". Story 6.7 is that story, and it found the column's NOT NULL to be the one thing standing
-- between the resolver and a writable pity result. The catalog cannot supply a thirteenth row: it is
-- pinned at EXACTLY twelve by `lib/awards/catalog.test.ts:33-34` with priorities exactly 1..12
-- (`:56-58`), `award.priority` is UNIQUE (`0023:150`), and `curate_award_catalog` DELETES any award
-- the payload omits (`0023:448-453`, "the payload IS the catalog") — so a consolation row added to
-- the catalog would be retired by the next curate, taking `on delete restrict` down with it.
--
-- ⚠⚠ THE THREE SHAPES WERE WEIGHED AND THE CHOICE IS CUATRO'S (2026-08-07), NOT THIS MIGRATION'S:
--   (a) a THIRTEENTH catalog award — rejected. It requires editing `lib/awards/catalog.ts`, and it
--       must satisfy `award_bucket_valid` / `award_class_valid` / `award_deciding_stat_valid`
--       (`0023:79-89`), for which a consolation prize has no honest values. It would also be spun by
--       Stage 1 unless the spin plan learned to exclude it.
--   (c) a CATALOG-INDEPENDENT row — a `pity_award` table, or a reserved `award` row that
--       `curate_award_catalog` is taught to leave alone. Rejected as the largest change of the
--       three, and one that teaches the DELETE-MISSING curator an exception.
--   (b) THIS ONE — `award_id` becomes NULLABLE, guarded so only a pity row may omit it. Chosen as
--       the smallest change that keeps the catalog at exactly twelve and `lib/awards/**` untouched.
--
-- ⭐ AND IT DEFUSES A SECOND-ORDER TRAP RATHER THAN INHERITING ONE. Under (a) or (c), once a pity
-- `award_result` existed, a later re-curate that dropped that award would HARD-FAIL on
-- `on delete restrict`. With `award_id` NULL on every pity row there is no reference to restrict,
-- so the ceremony's consolation results and the catalog's lifecycle stop being coupled at all.
--
-- SQLSTATEs — 0026 declares NO new code. The one new constraint is an ordinary CHECK (23514), named,
-- and the pgTAP suite asserts the NAME rather than the bare code (the 4.3 trap: every CHECK raises
-- 23514, so a `throws_ok` on the SQLSTATE alone proves almost nothing).
--
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO INSERT of any pity `spin` or `award_result` row, NO writer RPC, NO `spin_index` allocation,
--     NO `revealed_at` gating, NO `ceremony.state` transition -> 6.8. This lands the SHAPE only, and
--     NOTHING WRITES A ROW IN THIS STORY. The resolver that decides WHO wins is
--     `worker/awards/pity.go` + `lib/roulette/pity.ts`; it touches no database at all (DECISION B —
--     the browser verifier must reproduce the draw from the published bundle alone).
--   * NO reveal-gated RLS policy and NO grant to anon/authenticated -> 6.8. 0025's DECISION B holds:
--     these tables are fail-closed twice over and 6.8 WIDENS them, never tightens.
--   * NO `verification_bundle`, NO `bundle_sha256`, NO canonicalization -> 6.9. ⚠ Note and leave the
--     collision: `pity` IS a published bundle key (SOLUTION-DESIGN:433) and is therefore
--     outcome-affecting for `bundle_sha256`. RECORDED here; canonicalizing it is 6.9's.
--   * NO ceremony UI, wheel, trophy shelf, `ronda de consolación` or i18n string -> 6.10.
--   * NO change to `public.leaderboard` (0021) or to its `24`/`20` FR-21 floor literals. ⛔⛔ Story
--     6.7 MEASURES eligibility again — 0 of 28 players clear them, the FOURTH story in a row — and
--     moves nothing. See the escalation in the story's Completion Notes: at the shipped floors the
--     winless set is the ENTIRE roster, so pity is not a safety net but the whole prize
--     distribution. That is a product decision (`deferred-work.md:269`), not a migration's to take.
--   * NO change to `award`, `spin`, `award_result_winner`, `ceremony`, or any applied migration.
--     `award_result.award_id` loses its NOT NULL below; its type, its FK and its ON DELETE are
--     0025's and are untouched.
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 / 0024:173-181 / 0025:92-101 — READ
-- BEFORE CHANGING THE CHECK BELOW). An immediate validated CHECK cannot apply to a database that
-- already holds a violating row, and `supabase db reset` structurally CANNOT catch that, because it
-- rebuilds from empty. Two independent facts make this one safe:
--   1. `award_result` is EMPTY EVERYWHERE. 0025 created it four days ago and declared in its own
--      table comment that "nothing writes a row here until Story 6.8"; no migration, RPC, trigger or
--      application path inserts one, and this story adds no writer either.
--   2. EVEN IF IT WERE NOT, the CHECK is satisfied by every row that could exist under the OLD
--      schema: `award_id` was NOT NULL, so `award_id is not null` holds for all of them and the
--      disjunction is true regardless of `is_pity`. No existing row can violate it.
--
-- ⚠ SAID PRECISELY, BECAUSE THE EARLIER WORDING HAD IT BACKWARDS (6.7 code review). It read "the
-- constraint STRICTLY WIDENS what is legal", which is not what either statement does: a CHECK can
-- only ever NARROW, and it is the `drop not null` that widens. This migration is a widening followed
-- by a partial re-narrowing, and the NET effect is a strict widening — `{is_pity, award_id}` pairs
-- legal before are all still legal, plus the pity/NULL pair. Getting the attribution right matters
-- because a reader who believes the CHECK is the widening half will eventually drop it as redundant.
--
-- ⚠ THE STATEMENT ORDER IS MOOT AND THE EARLIER NOTE OVERSOLD IT. Both statements run in ONE
-- transaction, so no other session ever observes the intermediate state and neither order is safer.
-- For the record, the intermediate state of the order shipped here is the PERMISSIVE one (a NULLable
-- column with no guard yet); adding the CHECK first would be the restrictive one. Written down so
-- nobody re-derives a safety argument that the transaction already provides.

-- ════════════════════════════════════════════════════════════════════════════
-- `award_result.award_id` — NULL means "this is the consolation prize"
-- ════════════════════════════════════════════════════════════════════════════

alter table public.award_result
  alter column award_id drop not null;

-- ⛔⛔ WRITTEN AS A TOTAL EXPRESSION WITH AN EXPLICIT `is true` WRAPPER, AND THAT IS NOT DECORATION.
-- A CHECK whose expression evaluates to NULL is SATISFIED — Story 6.6 shipped
-- `luck_weight_table_valid` accepting an empty table on exactly that, because `array_ndims` returns
-- NULL for `array[]::int[]`. Today neither operand here can be NULL (`is_pity` is `boolean not null
-- default false` and `x is not null` is itself never NULL), so the wrapper changes nothing about
-- what this constraint accepts. It exists so that the day somebody makes `is_pity` nullable, this
-- fails LOUDLY instead of silently admitting every row.
alter table public.award_result
  add constraint award_result_award_or_pity
  check (((is_pity or award_id is not null)) is true);

comment on column public.award_result.award_id is
  'The catalog award this result crowned, or NULL for a PITY result (FR-28). '
  '⭐ NULL is the CONSOLATION prize and is legal ONLY when is_pity — award_result_award_or_pity '
  '(0026) enforces the pairing. A pity prize is not a category: it has no deciding stat, no bucket '
  'and no direction, so there is no `award` row that honestly describes it, and the catalog is '
  'pinned at exactly twelve with curate_award_catalog retiring anything the payload omits. '
  '⚠ The converse is deliberately NOT constrained: a pity row carrying a real award_id stays '
  'representable, because naming the consolation prize is a product decision Story 6.10 may yet '
  'take and a biconditional here would pre-empt it. What the CHECK forbids is the case that is '
  'always wrong — a NON-pity result with no award. Nothing writes a row here until Story 6.8.';

comment on constraint award_result_award_or_pity on public.award_result is
  'FR-28 (Story 6.7): only a pity result may omit its award. Every main-spin result names the '
  'catalog award it crowned; a consolation prize names none, because none of the twelve describes '
  'it. ⛔ Written as `((...)) is true` so a NULL expression can never be read as SATISFIED — the '
  'defect 0025''s first luck_weight_table_valid shipped with.';
