-- supabase/migrations/0028_reveal_gating.sql
-- Logical migration 0028 — reveal-gating and the commitment surface (Story 6.8b, FR-24 / FR-30 /
-- FR-31 / AD-22 / AD-6 / AD-8 / AD-11 / AD-17 / SOLUTION-DESIGN §4 + §9.5).
-- The SIXTH Epic-6 migration, and the first one that OPENS anything.
--
-- ⭐ THE THESIS. Every Epic-6 migration before this one tightened, or held. `0023` shipped the
-- catalog "strictly-closed end state" on purpose; `0024` gave `ceremony` a DORMANT admin policy and
-- no grant; `0025`'s DECISION B left three tables with ZERO policies and ZERO grants and said the
-- absence WAS the point; `0027` wrote forty rows and moved no posture at all. Four shipped pgTAP
-- suites assert that closed posture today — `0023 test:329-346`, `0024 test:456-472`,
-- `0025 test:148-182` and `0027 test:1137-1155`, the last one WITH ROWS IN THE TABLES. This
-- migration is the OPENING those four were written against, and each of them is retargeted in
-- `0028_reveal_gating_test.sql` to assert the stronger claim rather than deleted.
-- `6-1:71` said it in advance: "6.1 ships the strictly-closed end state, so 6.8 is an OPENING,
-- never a tightening."
--
-- ⛔⛔ THE GRANT AND THE POLICY SHIP TOGETHER OR NOT AT ALL. `0025:51-52` is a standing instruction:
-- "Story 6.8 ADDS both halves — the grant and the policy — together." A grant without a
-- `revealed_at` policy publishes the ENTIRE unrevealed ceremony; a policy without a grant does
-- nothing at all, because `42501` fires at the table-grant gate before RLS is ever consulted
-- (`0025:350`). ⛔ Never commit an intermediate state where one exists without the other.
--
-- SQLSTATEs — 0028 declares EXACTLY ONE new code:
--   * IC911 — `ceremony_reveal_prefix`: the revealed set of a ceremony is not a dense prefix of its
--     spin order, or the spin order itself is not dense. ⭐ NEW, this story. IC901-IC910 are taken
--     (0015/0017/0018/0019/0024/0025/0027).
--   ⚠ `reveal_spin` RAISES IC911 only for genuine CORRUPTION — it is unreachable through this RPC,
--   which is the only writer of `revealed_at`. ⛔ CORRECTED AT CODE REVIEW 2026-08-08: this used to
--   say the corrupt state "can only be produced by a direct `service_role` UPDATE", and that was
--   FALSE. `persist_ceremony(p_replace => true)` was permitted while the ceremony was `spinning` and
--   reached the same end state through a supported RPC — see section (h) below, which closes it with
--   a `reveal_in_progress` refusal. A direct UPDATE is now genuinely the only remaining route.
--   Every BUSINESS refusal is RETURNED as `{ok:false, reason:'<snake_case>', …context}`,
--   the 0012/0017/0023/0024/0027 convention.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ THE TWELVE GATE SEMANTICS (R1-R12), PINNED HERE BEFORE ANYTHING IS IMPLEMENTED.
-- Each is a place where two honest implementers reading AD-22's one paragraph build a DIFFERENT
-- gate. Each is asserted by a named test in `0028_reveal_gating_test.sql`.
-- ════════════════════════════════════════════════════════════════════════════
--   R1  The grant and the policy are ONE change. (`0025:51-52`. See the ⛔ block above.)
--   R2  SELECT ONLY, to `anon` AND `authenticated`, on every one of the five tables. No INSERT /
--       UPDATE / DELETE to any client role, ever (AD-7, `0025:166-170`). The pgTAP assertion is the
--       four-verb `bool_or` matrix, never a single-verb check.
--   R3  TWO policies per table, NEVER OR'd: `<t>_viewer_read` (`to anon, authenticated`) and
--       `<t>_admin_read` (`to authenticated`). ⛔ Never
--       `using (revealed_at is not null or public.is_admin())` — `0002:95-98` explains exactly what
--       that costs: separate policies mean a malformed admin policy can only ever ADD admin's own
--       rows, while a merged one lets an admin-clause bug leak unrevealed rows to viewers.
--   R4  Every helper call is wrapped `(select public.is_admin())` — init-plan hoisting, `0002:53-55`.
--       A bare `is_admin()` in a USING clause is re-evaluated PER ROW (Supabase's own
--       `auth_rls_initplan` advisor flags it). ⛔ Do not "simplify" the wrapper away.
--   R5  `award_result_winner` may gate on its OWN `spin_id` ONLY because `0025`'s composite FK
--       `(award_result_id, spin_id) -> award_result(id, spin_id)` (`0025:63-69`) makes disagreement
--       with its parent UNREPRESENTABLE. The citation is written at the policy, because the
--       shortcut and the hole are one edit apart.
--   R6  A PITY result reveals NO catalog award. `award_id is null` on pity rows (`0026:90-91`), so
--       AC4's `exists` is naturally blind to them — asserted POSITIVELY rather than relied upon.
--   R7  The commitment is COLUMN-scoped, and the UN-granted set is the load-bearing half. A ROW
--       policy cannot hide a COLUMN. `snapshot_id`, `algorithm_version`, `spin_plan` and
--       `luck_weight_table` stay ungranted. ⚠ A column added to `ceremony` LATER is un-granted by
--       default — that is FAIL-CLOSED and correct. ⛔ Do not "fix" it with a table-wide grant.
--   R8  Reveal is FORWARD-ONLY and DENSE: the lowest unrevealed `spin_index`, one at a time.
--       `revealed_at` is never un-stamped and never back-dated. The published spin order and the
--       reveal order are the SAME order (UX-DR32/42: "the outcome and published spin order are
--       identical" on both the animated and the reduced-motion path).
--   R9  A DOUBLE reveal is a typed REFUSAL, not a silent no-op — mirroring `already_persisted`
--       (`0027:671-680`). Confirmed by Cuatro 2026-08-08 (Q4). A no-op would either write a second
--       `audit_log` + `timeline_feed` row or write none at all, and both are wrong; an admin who
--       double-taps must learn WHICH fact is true.
--   R10 The feed row and the reveal COMMIT TOGETHER or not at all (AD-6). One transaction. A feed
--       entry for an unrevealed spin is the exact spoiler AD-22 exists to prevent.
--   R11 Every new CHECK is written `(…) is true` and is NAMED — "a CHECK that can evaluate NULL is
--       SATISFIED" (`6-8a:426-431`); all CHECKs raise 23514, so pgTAP asserts the NAME.
--       ⚠ 0028 adds NO new CHECK at all (it adds grants, policies and functions), so this rule has
--       nothing to bind here. Stated rather than omitted, so its absence reads as a measurement.
--   R12 NO `security definer` on anything that mutates. `security invoker` + `set search_path = ''`.
--       Definer is reserved for anon-reachable NARROW READS and the codebase has exactly one
--       (`award_catalog_count`, `0023:199`) plus one constraint-trigger function (`0027:338`).
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ EIGHT DECISIONS. Read these before changing anything below.
-- ════════════════════════════════════════════════════════════════════════════
--
-- DECISION A — `bundle_hash` IS 6.9's, AND EPIC AC1 SHIPS **PARTIAL** WITH THE OWNER NAMED.
-- Recorded by Cuatro 2026-08-08 and re-confirmed at implementation (Q1): "6-8b publishes `seed_hex`
-- and lands the shell" means the viewer-readable COMMITMENT SURFACE, not a `verification_bundle`
-- TABLE. Every migration header agrees and they are the more specific authority — `0024:150-155`,
-- `0025:76-80`, `0027:157-158` all home the table, `bundle_sha256`, RFC-8785 canonicalization and
-- `algorithm_version` publication to 6.9. ⛔ THIS MIGRATION CREATES NO `verification_bundle` TABLE.
-- What it does instead is shape the viewer-readable `ceremony` row so 6.9 WIDENS it (one more
-- column on the grant) rather than redesigning it.
--
-- DECISION B — THE COMMITMENT IS EXPOSED BY A COLUMN-LEVEL GRANT PLUS A ROW POLICY, NOT BY A VIEW
-- AND NOT BY A NEW `security definer` RPC.
-- `SOLUTION-DESIGN:287` says "ceremony: viewer select using (state <> 'not_started'); seed/snapshot
-- exposed per ceremony.state" and leaves the COLUMN question open — a row policy cannot hide a
-- column. Three shapes were available: a view, a definer RPC, or column grants. Column grants win
-- because they are the only shape that (i) keeps the grant-plus-policy idiom this epic's migrations
-- mandate, (ii) is directly assertable with `has_column_privilege` in BOTH directions, and
-- (iii) FAILS CLOSED on a future column (R7). A definer RPC would additionally re-open exactly the
-- widening hazard `0023:196-198` warns about.
--
-- DECISION C — ⭐⭐ PUBLISH `ceremony.seed_demo_sha256`, **NEVER** `tournament.fair_seed`.
-- THE HIGHEST-VALUE INHERITED ITEM IN THIS STORY, AND IT IS NOT OBVIOUS FROM ANY OTHER SITE.
-- `6-2`'s DECISION F deliberately LOOSENED the `IC908` write-once trigger to permit `value -> NULL`
-- so `rollback_match` can un-crown, and justified that ONLY because "6.2 publishes the seed to
-- nobody before it" — then flagged it FOR 6.8 BY NAME as the story that owns publication
-- (`6-2:1143`). Publishing from `tournament.fair_seed` would therefore publish a column that a
-- rollback can quietly set back to NULL: a commitment that does not bind. Publishing from
-- `ceremony.seed_demo_sha256` makes THIS SURFACE'S commitment binding — `0027:514-554`'s
-- `assert_ceremony_transition` makes it WRITE-ONCE once non-NULL (value->different and value->NULL
-- are both IC910), and `ceremony_locked` already refuses the rollback that would try.
-- ⛔ If a later story "simplifies" this to read `tournament.fair_seed`, it re-opens 6.2's hole.
--
-- ⛔⛔ CORRECTION, CODE REVIEW 2026-08-08 — THIS BLOCK USED TO SAY THE HOLE WAS CLOSED
-- "STRUCTURALLY", AND THAT WAS FALSE. MEASURED, NOT ARGUED: `tournament.fair_seed` IS ALREADY
-- READABLE BY `anon` AND HAS BEEN SINCE `0002`. `0002:50` creates
-- `tournament_read … for select to anon, authenticated using (true)` and `0002:70` grants
-- `select on public.tournament to anon, authenticated` — a TABLE-WIDE grant, so it covers every
-- column including `fair_seed` (`0001:33`). No migration `0001`–`0028` revokes it; the only
-- `revoke` statements anywhere in this tree are `revoke execute on function`.
-- What that means, precisely, so nobody over- or under-reads it:
--   * It is NOT a secrecy leak. `tournament.fair_seed` is `= SHA-256(final demo)` (`0001:33`) — the
--     SAME value `lock_ceremony` copies into `ceremony.seed_demo_sha256` (`0024:198`). Publishing
--     the commitment is the POINT of AC1; a viewer reading the identical hash from a second column
--     learns nothing they are not entitled to.
--   * It IS a broken justification. 6.2 loosened `IC908` on the strength of "6.2 publishes the seed
--     to nobody before it", and that premise was ALREADY false when it was written. The
--     rollback-nullable copy is public alongside the write-once one, so a `rollback_match` before
--     the ceremony locks makes the anon-visible `tournament.fair_seed` go NULL while
--     `ceremony.seed_demo_sha256` (once written) holds. Two public columns, one of which can be
--     un-published. This story's surface is the binding one; the other is not.
-- ⚠ NOT CLOSED HERE, BY DECISION (Cuatro, 2026-08-08): column-scoping or revoking `tournament`'s
-- grant would change `0002`'s posture for a table this story does not own, for no secrecy gain.
-- ⭐ HOMED TO 6.9, which builds the verifier and therefore owns which column a verifier reads. The
-- fix, when it comes, is a column-scoped grant on `tournament` — NOT a change here.
--
-- DECISION D — `award_result_winner` GATES ON ITS OWN `spin_id`. See R5. Cheaper by one join and
-- safe only because of `0025`'s composite FK.
--
-- DECISION E — REVEALING THE LAST SPIN COMPLETES THE CEREMONY, IN THE SAME TRANSACTION.
-- `0027:152` says "the transition trigger below ALREADY PERMITS spinning -> complete; 6.8b writes
-- it" but does not say FROM WHERE. A separate `complete_ceremony` admin action would make AD-22's
-- "released … in full at ceremony completion" depend on an admin remembering a second button
-- mid-ceremony — the release would silently not happen. Folding it into the FINAL `reveal_spin`
-- makes completion a CONSEQUENCE of the last reveal, atomic by AD-6, and leaves exactly one legal
-- forward step through the trigger. `ceremony.completed_at` is the shell `0024:204` created and
-- NOBODY has written; this is its first writer.
--
-- DECISION F — `reveal_spin` EMITS `spin.reveal`; NOTHING IN THIS STORY CONSUMES IT.
-- `0027:1154-1157` homes the emit here by name and `SPINE:230` already fixes the event name and the
-- `ceremony:<id>` channel, so the emit is built now, in the `0013:809-845` form — post-commit by
-- construction, error-swallowing untouched, no second emitter. But `lib/realtime/status.ts`'s
-- `NUDGE_EVENTS` is the `tournament:<id>` vocabulary consumed by 5.8's viewer surfaces, and there
-- is no ceremony surface to nudge: `/ceremonia` is still the 5.7 `<Placeholder>`. ⛔ Do NOT add
-- `spin.reveal` to `NUDGE_EVENTS` and do NOT subscribe to `ceremony:<id>` — that is 6.10's, with
-- the UI that consumes it. `0024:165-167`'s standing rule holds: event names are never invented,
-- and this one is not being invented.
-- ⚠⚠ COMPLETING THIS REASONING, CODE REVIEW 2026-08-08 — "there is no surface to nudge" WAS TRUE OF
-- `/ceremonia` AND FALSE OF THE FEED, AND THE ORIGINAL ARGUMENT ONLY CONSIDERED THE FIRST.
-- `reveal_spin` inserts an `award_reveal` row into `timeline_feed`, and `timeline_feed` IS a
-- `tournament:<id>` surface that Story 5.8 already subscribes to and auto-refreshes
-- (`RealtimeNudge.tsx:95-96` opens `supabase.channel('tournament:' + id)` and binds exactly the four
-- `NUDGE_EVENTS`). None of those four fires on a reveal, so the CONSEQUENCE IS REAL AND IT IS
-- ACCEPTED: a viewer sitting on the feed during the ceremony does not see the new card until they
-- reload. The row is committed, readable and correct — only the push is missing.
-- ⭐ ACCEPTED DELIBERATELY (Cuatro, 2026-08-08) rather than fixed, because the only fix is a second
-- Broadcast under a FIFTH event name, and `0024:165-167` forbids inventing one. None of the four
-- existing names describes an award reveal. ⛔ HOMED TO 6.10, which ships the ceremony UI and can
-- add the name and its consumer together — the same commit, which is the rule.
--
-- DECISION G — THE `is_shared` DEFERRED TRIGGER BECOMES LIVE BEHAVIOUR THE MOMENT THESE POLICIES
-- LAND, AND ITS HIDDEN DEPENDENCY IS ASSERTED RATHER THAN ASSUMED.
-- `deferred-work.md:333` says the `security invoker -> definer` fix had to be decided "now, before
-- that policy exists" — THIS IS THAT POLICY. `6-8a:916` then recorded that under
-- `FORCE ROW LEVEL SECURITY` RLS applies to the table OWNER too, so `security definer` ALONE does
-- not make `assert_award_result_is_shared` see every row; what does is the owner's `BYPASSRLS`
-- attribute. `0028_reveal_gating_test.sql` asserts the owner attribute directly AND drives the
-- trigger with a viewer policy present, so the fail-open cannot return silently.
--
-- DECISION H — THIS STORY SHIPS **NO** VIEWER UI AND **NO** NEW SPANISH COPY, AND THE `detail` THE
-- FEED WRITER WRITES IS THEREFORE **DATA, NEVER COPY**.
-- AD-24 keeps every viewer string in `lib/i18n/es.ts`, and `lib/feed/model.ts:186-188` renders
-- `detail.title` / `detail.subtitle` VERBATIM — so any Spanish sentence written here would be
-- viewer copy living outside the i18n module. `reveal_spin` therefore writes only facts the
-- database already holds: the revealed award's `name` as `title`, the winner `display_name`s as
-- `subtitle`. When a branch has no such fact the KEY IS OMITTED and `model.ts`'s shipped fallbacks
-- (`es.award.teaserTitle` / `es.award.revealAtCeremony`) carry it — deliberately, and asserted in
-- both pgTAP and Vitest, never by accident. Two branches reach that path and both are recorded:
--   * a PITY spin has NO award at all (`award_id is null`, `0026:90-91`) -> no `title`;
--   * a ZERO-WINNER outcome (`no_eligible_players`) has no winner -> no `subtitle`. ⚠ Over the real
--     corpus this is the COMMON case, not an edge: 0/28 players clear the FR-21 24/20 floors, so
--     all 12 main spins resolved `no_eligible_players` (Cuatro 2026-08-08 accepted the ceremony as
--     measured; the floors slice stays owed before Epic 6 closes).
-- ⛔ KNOWN GAP, HOMED TO 6.10, RECORDED RATHER THAN PAPERED OVER: the shipped fallback copy was
-- written for a PRE-ceremony teaser, and `TimelineFeed.tsx:107` additionally hard-codes a
-- "Se revela en la ceremonia" pill on every award card. Both read wrong on an already-revealed
-- pity prize. 6.10 owns the ceremony strings AND that card; this story may not touch either
-- (`0028` adds no i18n key and `app/(viewer)/**` stays byte-untouched).
--
-- ════════════════════════════════════════════════════════════════════════════
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO `verification_bundle` table, NO `bundle_sha256`/`bundle_hash`, NO RFC-8785
--     canonicalization, NO `algorithm_version` publication -> 6.9 (DECISION A).
--     ⚠ `ceremony.luck_weight_table` stays MUTABLE after the freeze (`deferred-work.md:361`) — this
--     migration publishes `seed_hex` while that outcome-affecting input is still editable. NOT
--     closed here; 6.9 hashes these bytes and owns it.
--   * NO ceremony UI, wheel, trophy shelf, verify strip or i18n string -> 6.10. `/ceremonia` stays
--     the 5.7 `<Placeholder>`; `LockedAwards.tsx` keeps rendering from `award_catalog_count`.
--   * ⛔ NO WIDENING OF `award_catalog_count` BY A SINGLE COLUMN. `0023:196-198`: "IF YOU EVER WIDEN
--     THIS, YOU HAVE BROKEN AD-22 … Widening the CATALOG's viewer surface is Story 6.8's job and it
--     does it with a reveal-gated POLICY on the table, not by growing this." That is exactly what
--     `award_viewer_read` below is. The count stays the only PRE-reveal catalog fact.
--   * NO golden vector -> 6.11. `0027:159-161`: "roulette/vectors/README.md gives 6.8 no gate."
--   * NO production entry point for `worker/ceremony.Run`, which still has zero callers (Cuatro
--     2026-08-08, Q3: out of scope here). The QA harness is its only caller.
--   * NO change to `public.leaderboard` (0021) or to its `24`/`20` FR-21 floor literals, and NO
--     change to `lib/awards/catalog.ts`. Story 6.8b MEASURES eligibility again — 0 of 28 clear
--     them, the SIXTH story in a row — and moves nothing.
--   * NO Go / worker change. NO new npm package, no new Go module.
--   * NO `spin.reveal` consumer (DECISION F). NO second Broadcast emitter anywhere.
--   * NO CSRF (Epic 7, uniform across all cookie-authenticated admin POSTs).
--   * NO edit to ANY applied migration 0001-0027. The three RPCs AC7 guards change ONLY by
--     `create or replace` HERE, with their bodies copied forward verbatim.
--
-- ⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 / 0024:173-181 / 0025:92-101 /
-- 0026:62-71 / 0027:169-178). Stated EXPLICITLY rather than left absent, because every Epic-6
-- migration carries this section and a missing one reads as an oversight: **THERE IS NO
-- CLEAN-APPLY HAZARD IN 0028.** The trap is specific to an IMMEDIATE VALIDATED CHECK meeting a
-- database that already holds a violating row, and `supabase db reset` structurally cannot catch it
-- because it rebuilds from empty. This migration adds ZERO constraints of any kind — it adds
-- GRANTs, POLICIES, one new FUNCTION and three `create or replace`s, none of which validate
-- existing rows. It applies identically to an empty database and to one holding a full ceremony.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) AC2 — `spin`: the reveal axis itself.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ THIS IS THE GATE THE OTHER THREE LEAN ON. `spin.revealed_at` is AD-22's reveal axis
-- (`0025:115`), and `award_result` / `award_result_winner` / `award` all resolve their own
-- visibility by asking about a SPIN. Their policy subqueries read `public.spin` as the CALLING
-- role, so they need both this grant and this policy to be present — which is another way of
-- saying R1 is not merely a convention here, it is a functional dependency.
--
-- ⚠ RLS stays ENABLE + FORCE (set by `0025:133-134`, and the generic Section-A2 catalog guard in
-- `0003_audit_snapshot_test.sql` reddens if either is ever lost). Only SELECT is granted — never a
-- data-writing verb, to either client role (R2).
grant select on public.spin to anon, authenticated;

-- R3 — two policies, never OR'd, in the `0002:87-98` house form. That block names this story:
-- "When a staged table lands (stat_row -> Epic 3; reveal-gated award*/spin -> Epic 6), it MUST
-- expose staged rows with TWO SEPARATE policies, never OR'd into one."
create policy spin_viewer_read on public.spin for select to anon, authenticated
  using (revealed_at is not null);

create policy spin_admin_read on public.spin for select to authenticated
  using ((select public.is_admin()));

comment on policy spin_viewer_read on public.spin is
  'AD-22 (Story 6.8b): a viewer sees a spin — its spin_index, its kind and its live_award_ids — '
  'from the moment reveal_spin stamps revealed_at, and never one row earlier. It deliberately does '
  'NOT expose an unrevealed spin''s live_award_ids, which ARE AD-22''s "per-spin live-category '
  'sets"; the same secrecy is why ceremony.spin_plan stays ungranted. SELECT only, never a write.';

comment on policy spin_admin_read on public.spin is
  'The AD-7 admin half, SEPARATE and never OR''d with the viewer policy (0002:95-98): kept apart so '
  'a malformed admin clause can only ever ADD admin''s own rows, never widen the viewer''s '
  'revealed-only set. (select public.is_admin()) is the mandatory init-plan wrap (0002:53-55).';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) AC3 — `award_result`: gated through the PARENT spin.
-- ════════════════════════════════════════════════════════════════════════════
-- Neither `award_result` nor `award_result_winner` has a `revealed_at` of its own, and
-- `SOLUTION-DESIGN:286` says so: "gate on the parent spin.revealed_at".
--
-- ⚠⚠ WHAT THE PLANNER ACTUALLY DOES — MEASURED, AND IT IS **NOT** THE PER-ROW INDEX PROBE THE
-- STORY'S AC3 ANTICIPATED. This comment is the corrected version; the assumption it replaces was
-- written first and `explain (costs off)` under `set local role anon` refuted it:
--
--     Seq Scan on award_result
--       Filter: (ANY (spin_id = (hashed SubPlan 2).col1))
--       SubPlan 2 ->  Seq Scan on spin s
--                       Filter: ((revealed_at IS NOT NULL) AND (revealed_at IS NOT NULL))
--
-- Postgres does not evaluate this `exists` once per row against `award_result_spin_award_key`. It
-- PULLS IT UP into a HASHED SUBPLAN — it builds the set of revealed `spin.id`s ONCE and hash-probes
-- it per row. So the correct statement is: the gate costs ONE scan of `spin` per statement plus a
-- hash lookup per row, and the `(spin_id, award_id)` unique index is simply not what makes it cheap.
-- That is a BETTER plan than the one that was assumed, and it is why no index is added — but the
-- reason had to be measured, not asserted.
-- ⛔ Do not add an index here "to be safe": nothing in the measured plan would use it.
--
-- ⭐ NOTE THE DOUBLED PREDICATE IN THAT FILTER — it is not a planner artefact, it is the proof that
-- an RLS policy's subquery is ITSELF RLS-filtered. One `revealed_at is not null` is this policy's;
-- the other is `spin_viewer_read` applying to the calling role inside the subquery. The gate is
-- therefore enforced TWICE over, and the two spellings agree by construction.
grant select on public.award_result to anon, authenticated;

-- ⛔ THE OUTER COLUMN IS QUALIFIED, AND THAT IS A CODE-REVIEW FIX (2026-08-08), NOT A TIDY-UP.
-- This was `where s.id = spin_id`. An unqualified name resolves to the INNERMOST scope that has it,
-- so it reaches `award_result.spin_id` only because `public.spin` happens to have no column of that
-- name. Give `spin` a `spin_id` column and the SAME TEXT means `s.id = s.spin_id` — uncorrelated with
-- the outer row, so a single revealed spin makes the `exists` TRUE for EVERY award_result in the
-- database. That is mutant M05, and it is a total leak of the unrevealed ceremony.
--
-- ⚠⚠ HOW BIG THIS HAZARD ACTUALLY IS — MEASURED, BECAUSE THE FIRST VERSION OF THIS COMMENT
-- OVERSTATED IT. A policy's `USING` clause is stored as a RESOLVED parse tree (`pg_policy.polqual` is
-- a `pg_node_tree` of Var nodes with fixed varno/varattno), NOT as text. So an ALREADY-CREATED policy
-- does NOT silently rebind when `spin` later gains a column — the binding was fixed at CREATE time.
-- Proof, from this database: both spellings render IDENTICALLY through `pg_get_expr` as
-- `(s.id = award_result.spin_id)`, because the Var resolved to the outer table either way.
-- ⭐ SO THE REAL EXPOSURE IS AT (RE-)CREATION TIME, AND IT IS NARROW BUT REAL: a later migration that
-- copies this policy TEXT forward — the `create or replace` idiom this epic uses constantly, and
-- which section (g) and section (h) of this very file both use — would re-resolve it against
-- whatever `spin` looks like THEN. Migrations replay in order, so a plain `supabase db reset` always
-- builds this policy against the 0027-era `spin` and is safe; a copy-paste into a future migration is
-- not. The qualifier costs nothing and removes the class at the source, which is where the copy is
-- made from.
-- ⚠ Section J asserts what the CATALOG can actually prove — that the resolved gate CORRELATES with
-- the outer table (an `s.id = s.id` mutant reddens 5 tests). It cannot prove which spelling the
-- source used, because Postgres has already normalised that away. Do not add an assertion claiming
-- otherwise; it would pass for both forms.
create policy award_result_viewer_read on public.award_result for select to anon, authenticated
  using (
    exists (
      select 1 from public.spin s
       where s.id = award_result.spin_id and s.revealed_at is not null
    )
  );

create policy award_result_admin_read on public.award_result for select to authenticated
  using ((select public.is_admin()));

comment on policy award_result_viewer_read on public.award_result is
  'AD-22 (Story 6.8b): an award_result is visible exactly when its PARENT spin is revealed '
  '(SOLUTION-DESIGN:286) — the table carries no revealed_at of its own. The subquery reads '
  'public.spin as the CALLING role, so it depends on spin_viewer_read AND on spin''s SELECT grant '
  'both being present: the two halves 0025:51-52 requires together are here a functional '
  'dependency, not just a convention.';

comment on policy award_result_admin_read on public.award_result is
  'AD-7 / 0002:87-98 (Story 6.8b): the admin half, SEPARATE and never OR''d into the viewer clause. '
  'Kept apart so that a malformed admin predicate can only ever ADD admin''s own rows — merging them '
  'into using (exists (...) or is_admin()) would make an is_admin() regression leak every UNREVEALED '
  'result to anon. Deliberately exposes NOTHING extra to a viewer: it names only `authenticated`, so '
  'anon is not addressed by it at all.';

-- ════════════════════════════════════════════════════════════════════════════
-- (c) AC3 — `award_result_winner`: gated on its OWN denormalized `spin_id` (R5 / DECISION D).
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐⭐ THE CITATION IS AT THE SITE BECAUSE THE SHORTCUT AND THE HOLE ARE ONE EDIT APART.
-- `award_result_winner.spin_id` is DENORMALIZED from its parent, so gating on it rather than
-- joining through `award_result` saves a join — and would be a HOLE if a child could carry a
-- `spin_id` its parent disagrees with. It cannot: `0025:63-69` (0025-COMPOSITE-FK) gave
-- `award_result` a redundant `unique (id, spin_id)` precisely so this child's FK could be COMPOSITE
-- — `foreign key (award_result_id, spin_id) references award_result (id, spin_id)` (`0025:217-219`)
-- — which makes disagreement UNREPRESENTABLE at every isolation level.
-- ⛔ IF THAT COMPOSITE FK IS EVER DROPPED, THIS POLICY SILENTLY BECOMES A HOLE: a winner row
-- carrying a revealed spin's id could expose a winner belonging to an unrevealed one. Drop the FK
-- and this `using` clause must become a join through `award_result` in the same commit.
--
-- ⚠ THE PLAN IS THE SAME HASHED-SUBPLAN SHAPE `award_result`'s is (see the measured `explain`
-- there): `Seq Scan on award_result_winner / Filter: (ANY (spin_id = (hashed SubPlan 2).col1))`.
-- `award_result_winner_spin_key unique (spin_id, winner_entry_id)` (`0025:247`) leads on `spin_id`
-- and is NOT what the planner reaches for. No new index — measured, not assumed.
grant select on public.award_result_winner to anon, authenticated;

-- ⛔ THE OUTER COLUMN IS QUALIFIED — same code-review fix as `award_result_viewer_read` above, same
-- reason, and read that block for the full argument. `s.id = spin_id` binds outward only by the
-- accident that `public.spin` has no `spin_id` column of its own.
create policy award_result_winner_viewer_read on public.award_result_winner for select to anon, authenticated
  using (
    exists (
      select 1 from public.spin s
       where s.id = award_result_winner.spin_id and s.revealed_at is not null
    )
  );

create policy award_result_winner_admin_read on public.award_result_winner for select to authenticated
  using ((select public.is_admin()));

comment on policy award_result_winner_viewer_read on public.award_result_winner is
  'AD-22 (Story 6.8b): gates on this row''s OWN denormalized spin_id rather than joining through '
  'award_result — legitimate ONLY because 0025:63-69''s COMPOSITE FK (award_result_id, spin_id) -> '
  'award_result(id, spin_id) makes a child disagreeing with its parent unrepresentable. If that FK '
  'is ever dropped this gate becomes a hole and must be rewritten as a join in the same commit.';

comment on policy award_result_winner_admin_read on public.award_result_winner is
  'AD-7 / 0002:87-98 (Story 6.8b): the admin half, SEPARATE and never OR''d into the viewer clause — '
  'same rule and same reason as award_result_admin_read. It names only `authenticated`, so it cannot '
  'widen anon''s set whatever its predicate evaluates to, and it deliberately exposes no winner of an '
  'unrevealed spin to a viewer.';

-- ════════════════════════════════════════════════════════════════════════════
-- (d) AC4 — `award`: the CATALOG opens per-award, through the awkward join.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ `award` HAS NO LINK TO `spin` AT ALL. Its only path to the reveal axis is
-- `award_result.award_id`, and `0026:90-91` made that column NULLABLE so a pity row can omit it. So
-- the gate is a two-hop `exists`: an award becomes viewer-readable exactly when it has been DECIDED
-- in a REVEALED spin.
--
-- R6 — A PITY RESULT REVEALS NO CATALOG AWARD, AND THAT FALLS OUT OF THE JOIN RATHER THAN BEING
-- SPECIAL-CASED. A pity row has `award_id is null`, so `ar.award_id = award.id` is NULL for it,
-- which is not TRUE, so it selects nothing. That is correct (a consolation prize is not a category
-- — `0026:104-113`) and it is asserted POSITIVELY in pgTAP rather than relied upon, because
-- "NULLs are DISTINCT" arithmetic is exactly the class of reasoning this epic keeps paying for.
--
-- ⚠⚠ THIS IS THE ONE GATE THE STORY SINGLED OUT AS HAVING NO INDEX BEHIND IT — AND THE MEASUREMENT
-- SHOWS IT IS NOT ACTUALLY THE ODD ONE OUT. The probe is `award_result.award_id`, and no index
-- carries that column in a usable leading position (`award_result_spin_award_key` is
-- `(spin_id, award_id)` and leads on `spin_id`; the whole list is `stat_row_approved_idx`,
-- `award_tournament_priority_idx` at `0023:156`, and the constraint-backed uniques). But
-- `explain (costs off)` under `set local role anon` shows the planner treats all three the same way
-- — it hoists every one of these `exists` clauses into a hashed SubPlan:
--
--     Seq Scan on award
--       Filter: (ANY (id = (hashed SubPlan 6).col1))
--       SubPlan 6 ->  Hash Join
--                       Hash Cond: (ar.spin_id = s_1.id)
--                       ->  Seq Scan on award_result ar
--                             Filter: (ANY (spin_id = (hashed SubPlan 5).col1))
--                             SubPlan 5 -> Seq Scan on spin s
--                                            Filter: ((revealed_at IS NOT NULL) AND (revealed_at IS NOT NULL))
--                       ->  Hash -> Seq Scan on spin s_1
--                                     Filter: ((revealed_at IS NOT NULL) AND (revealed_at IS NOT NULL))
--
-- One hash join of the revealed results against the revealed spins, built ONCE per statement, then
-- a hash probe per award row. ⛔ NO INDEX IS ADDED, and the decision is now recorded on evidence
-- rather than on the "12 awards over 40 results is small" hand-wave it started as: an
-- `award_result(award_id)` index would not appear in this plan at any of the sizes this table ever
-- reaches, and it would be pure write cost on a table `persist_ceremony` rewrites wholesale under
-- `p_replace`. The corpus-scale re-measurement (40 spins / 40 results / 12 awards) is in the story's
-- Completion Notes; the plan shape does not change.
grant select on public.award to anon, authenticated;

create policy award_viewer_read on public.award for select to anon, authenticated
  using (
    exists (
      select 1
        from public.award_result ar
        join public.spin s on s.id = ar.spin_id
       where ar.award_id = award.id
         and s.revealed_at is not null
    )
  );

comment on policy award_viewer_read on public.award is
  'FR-24 / AD-22 (Story 6.8b): an award''s IDENTITY — its name, bucket, class, deciding stat and '
  'floors — becomes viewer-readable exactly when it has been decided in a REVEALED spin, and not '
  'one moment earlier. This is the "reveal-gated POLICY on the table" 0023:196-198 named as the '
  'correct mechanism and contrasted with widening award_catalog_count, which stays untouched and '
  'stays the ONLY pre-reveal catalog fact. A pity result (award_id is null) reveals nothing here.';

-- ⭐ AND `award_admin_read` STOPS BEING DORMANT. `0023:174-176` created it as defence-in-depth and
-- said so: "with no table grant for `authenticated`, an admin 42501s before RLS runs too … It is
-- here so that the day a grant IS added (6.8), the read is already correctly scoped." This is that
-- day, and the grant above is what makes it live for the first time. It is NOT re-created here —
-- `0023:177` already ships it in exactly the right form — and the pgTAP suite asserts it now
-- actually returns rows for an admin instead of 42501ing.

-- ════════════════════════════════════════════════════════════════════════════
-- (e) AC1 — `ceremony`: THE COMMITMENT SURFACE (DECISION B + DECISION C + R7).
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ AD-22 GATES THIS TABLE BY A DIFFERENT PREDICATE FROM THE OTHER FOUR, AND READING THAT
-- CAREFULLY IS THE WHOLE OF AC1. `ARCHITECTURE-SPINE.md:188` names TWO predicates in one sentence:
-- catalog metadata, per-spin live-category sets and results are invisible "until their spin
-- (spin.revealed_at)"; but "the seed/snapshot are gated on **ceremony.state**". So the commitment
-- is not reveal-gated at all — it is published UP FRONT, the moment the ceremony stops being
-- `not_started`, which is exactly what makes it a COMMITMENT: bytes fixed before any outcome is
-- known (`SPINE:222-223`, SOLUTION-DESIGN §9.5 `:431-438`).
--
-- ⛔⛔ THE COLUMN GRANT IS NOT A STYLE CHOICE — A ROW POLICY CANNOT HIDE A COLUMN (R7).
-- `ceremony_viewer_read` alone would publish the WHOLE row, including:
--   * `spin_plan`     — ⭐ it names each spin's candidate award POOL. Publishing it up front hands a
--                       viewer the shape of every unrevealed spin; it IS the "per-spin
--                       live-category sets" AD-22 gates BY NAME. This single column is why a
--                       table-wide grant would break AD-22 outright.
--   * `snapshot_id`   — the pointer to the frozen inputs every winner is computable from.
--   * `luck_weight_table` — Stage-1's published weights; outcome-affecting.
--   * `algorithm_version` — 6.9's shell, published with the bundle it belongs to.
-- ⚠ A COLUMN ADDED TO `ceremony` LATER IS UN-GRANTED BY DEFAULT. That is FAIL-CLOSED and correct.
-- ⛔ Do not "fix" a future 42501 on a new column by promoting this to a table-wide grant — add the
-- column to the list below, deliberately, with the story that publishes it.
--
-- ⚠⚠ AND THIS CHANGES HOW `ceremony` MUST BE QUERIED OVER THE DATA API. PostgREST's default
-- `select=*` asks for EVERY column, so an anon request for `ceremony` 42501s on the ungranted ones
-- even though the ROW is visible. THAT FAILURE IS THE GATE WORKING, NOT A BUG — any reader must
-- name the granted columns explicitly. Both branches are proven in the story's Completion Notes
-- (explicit columns -> 200 with the commitment; `select=*` -> refused) so the distinction is on the
-- record before someone "fixes" it the wrong way.
create policy ceremony_viewer_read on public.ceremony for select to anon, authenticated
  using (state <> 'not_started');

-- ⛔ NO TABLE-WIDE GRANT ON `ceremony`. The four columns NOT named here are the load-bearing half.
-- ⭐ DECISION C — `seed_demo_sha256` IS THE PUBLISHED SEED, published under the contract name
-- `seed_hex` (`6-2:246`: "6.2 freezes fair_seed and names it seed_hex in the server contract"),
-- and it is read from HERE and never from `tournament.fair_seed`, whose IC908 trigger was
-- deliberately loosened to permit value -> NULL so rollback_match can un-crown (`6-2:1143`).
-- `assert_ceremony_transition` (`0027:514-554`) makes this column write-once once non-NULL, so the
-- published bytes cannot change after commitment. `tournament.fair_seed`'s cannot promise that.
grant select (id, tournament_id, state, seed_demo_sha256, started_at, completed_at)
  on public.ceremony to anon, authenticated;

comment on policy ceremony_viewer_read on public.ceremony is
  'AD-22 commit-then-publish (Story 6.8b, AC1): the ceremony row becomes viewer-readable the moment '
  'it leaves not_started — the seed/snapshot axis is ceremony.state, NOT spin.revealed_at '
  '(SPINE:188 names both predicates in one sentence). ⛔ The ROW policy is only half the gate: a '
  'row policy cannot hide a column, so a COLUMN-LEVEL grant (DECISION B) publishes exactly '
  'state + seed_demo_sha256 + started_at + completed_at and leaves snapshot_id, spin_plan, '
  'luck_weight_table and algorithm_version UNGRANTED. spin_plan in particular names each spin''s '
  'candidate award pool — publishing it would hand a viewer every unrevealed spin''s shape.';

-- ════════════════════════════════════════════════════════════════════════════
-- (f) AC5/AC6/AC8 — `reveal_spin`: the admin command that turns the axis.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ ONE SPIN, IN PUBLISHED ORDER, AUDITED, AND IT NUDGES. The full house RPC form (`6-2:186-201`,
-- and `persist_ceremony` at `0027:600-1169` is the shape being copied): `security invoker` +
-- `set search_path = ''` + every reference schema-qualified · an UNLOCKED existence peek that must
-- not lock · the locks in canonical order · a re-read under the lock · EVERY GUARD BEFORE ANY
-- WRITE, each returned as a typed `{ok:false, reason:'<snake_case>', …context}` · genuine
-- corruption RAISED with IC911 + a hint · the literal separator comment · exactly ONE audit_log row
-- with before/after · `revoke execute … from public` then `grant execute … to service_role`.
--
-- ⚠⚠ LOCK ORDER — a SUBSET of `persist_ceremony`'s, in the SAME RELATIVE ORDER: tournament, then
-- ceremony (`0027:583-589`). `lock_ceremony` takes match -> stat_row -> tournament and touches
-- `ceremony` while holding all three (`0024:429-450, 813`). Taking `ceremony` FIRST here "because
-- it is the subject" would invert the pair against both and build the exact 40P01 ABBA deadlock
-- 0024's DECISION E exists to prevent. ⛔ Do not reorder these two statements.
--
-- ⭐ THE CLOSED REFUSAL-REASON SET, DECLARED ONCE, HERE, AND MIRRORED IN `lib/ceremony/reveal.ts`:
--     no_ceremony · ceremony_not_spinning · no_such_spin · already_revealed · out_of_order ·
--     unknown_actor
-- ⚠ The pgTAP suite reads this set out of the function's own `prosrc` rather than comparing it to a
-- literal copied beside it — 6.8a's review found a "closed set" test asserting "against a
-- hand-copied duplicate of itself", the project's signature defect at its seventh occurrence.
--
-- ⭐ AC5 — OUT-OF-ORDER REVEALS ARE REFUSED (R8). UX-DR32/42 requires "the outcome and published
-- spin order are identical" on BOTH the animated and the reduced-motion path, and a reveal axis
-- that can be walked out of order is not an order at all. `p_spin_index` must be the LOWEST
-- unrevealed index of the ceremony — no skipping ahead, no going back.
--
-- ⭐ AC6 — REVEALING THE HIGHEST `spin_index` COMPLETES THE CEREMONY IN THE SAME TRANSACTION
-- (DECISION E), through `assert_ceremony_transition`, as ONE legal forward step.
--
-- ⭐ AC8 — AND IT WRITES THE `award_reveal` FEED ROW THAT HAS BEEN UNOWNED SINCE `0017:109`
-- (`0024:170`, `deferred-work.md:81`). FR-31 (`prd.md:415`): "An Approved Match result, a Bracket
-- advance, and an Award reveal EACH POST AN ENTRY to the feed." `timeline_feed.entry_type` has
-- admitted `'award_reveal'` since 0017 with NO writer, and 5.6 already built and tested the reader
-- branch and the gold rail node. This is the writer. R10: it is in the SAME transaction as the
-- stamp, so the entry CANNOT exist before its reveal — that ordering is the spoiler AD-22 exists to
-- prevent, and making it one insert rather than a projection is what makes progressive release real.
create function public.reveal_spin(
  p_ceremony_id bigint,
  p_spin_index  int,
  p_actor       text
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_tournament   bigint;
  v_state        text;
  v_total        int;
  v_max_index    int;
  v_revealed     int;
  v_max_revealed int;
  v_spin_id      bigint;
  v_kind         text;
  v_revealed_at  timestamptz;
  v_titles       text;
  v_subtitles    text;
  v_award_count  int;
  v_winner_count int;
  v_now          timestamptz;
  v_complete     boolean := false;
  v_after_state  text;
  v_detail       jsonb;
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
  select c.state into v_state from public.ceremony c where c.id = p_ceremony_id;

  -- ══ 2. GUARDS — every one of them before ANY write, each RETURNED with its context keys.

  -- ⛔ THE NULL RE-CHECK IS A REAL RACE, NOT A FORMALITY — `0027:654-664` measured it. The peek at
  -- step 1 is deliberately UNLOCKED, so the ceremony can be deleted (via its tournament, which
  -- cascades) between the peek and the lock at 1b. `perform … for update` does not raise on zero
  -- rows, so the re-read at 1c leaves v_state NULL — and `NULL <> 'spinning'` is NULL, not TRUE, so
  -- the next guard would NOT fire and control would fall through to a wrong diagnosis. Three-valued
  -- logic turns a vanished row into a lie unless this line is here.
  if v_state is null then
    return jsonb_build_object('ok', false, 'reason', 'no_ceremony', 'ceremony_id', p_ceremony_id);
  end if;

  -- Only a ceremony that is actually RUNNING can reveal. `locked` means persist_ceremony has not
  -- run (there are no spins to reveal); `complete` means every spin is already out; `not_started`
  -- means the snapshot was never even captured.
  if v_state <> 'spinning' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_not_spinning',
                              'ceremony_state', v_state, 'ceremony_id', p_ceremony_id);
  end if;

  -- ══ 2b. THE REVEAL LEDGER, read ONCE under the lock. Four facts, one scan.
  select count(*)::int,
         coalesce(max(s.spin_index), 0),
         count(*) filter (where s.revealed_at is not null)::int,
         coalesce(max(s.spin_index) filter (where s.revealed_at is not null), 0)
    into v_total, v_max_index, v_revealed, v_max_revealed
    from public.spin s
   where s.ceremony_id = p_ceremony_id;

  -- ⛔⛔ IC911 — GENUINE CORRUPTION, AND THE ONLY THING IN THIS FUNCTION THAT RAISES.
  -- R8 says the reveal axis is FORWARD-ONLY AND DENSE, and this function is the only writer of
  -- `revealed_at` anywhere in the codebase — so the revealed set is a PREFIX {1..k} by construction
  -- and the spin set is dense 1..N by `persist_ceremony`'s own `spin_index_not_dense` guard
  -- (`0027:744-757`). Reaching either branch below means somebody UPDATEd `spin.revealed_at`
  -- directly with the service key, which is representable (service_role holds UPDATE, `0025:358`)
  -- and would mean the audience has already seen an award out of published order — UX-DR32/42's
  -- guarantee is broken and cannot be repaired by continuing.
  -- ⚠ THERE USED TO BE A SECOND ROUTE, AND THIS GUARD WAS BLIND TO IT (code review, 2026-08-08).
  -- `persist_ceremony(p_replace => true)` was legal while `spinning`; it deleted every spin and
  -- rewrote `revealed_at` NULL, leaving the revealed set {} over a dense 1..N — a PERFECTLY VALID
  -- prefix, so neither branch below fired while published `award_reveal` feed rows still named
  -- awards from the deleted run. Section (h) closes that with a `reveal_in_progress` refusal. ⛔ The
  -- lesson generalises: this pair of tests detects a BROKEN prefix, never a prefix that was legally
  -- reset out from under an audience. Do not treat it as a completeness check.
  -- ⚠ WHY `max = count` IS A SOUND PREFIX TEST HERE AND NOT IN GENERAL: `spin_ceremony_index_key
  -- unique (ceremony_id, spin_index)` (`0025:123`) makes the indexes DISTINCT, so {1,1,3} — the
  -- shape that defeats a max/count pair in `0027:724-725` — is unrepresentable. Over a distinct
  -- subset of the POSITIVE integers, max = count holds if and only if the subset is {1..count}.
  -- ⛔ THE POSITIVITY IS AN ASSUMPTION, NOT A CONSTRAINT, AND SAYING SO IS A CODE-REVIEW FIX
  -- (2026-08-08). This block used to claim the theorem for "a distinct subset of 1..N" without
  -- naming what bounds it below. The unique index enforces DISTINCTNESS ONLY; nothing in `0025` or
  -- `0026` carries a `spin_index > 0` CHECK, and `0028` adds no CHECK at all (R11). So indexes
  -- {-5, 0, 3} give count = 3 and max = 3 and the DENSITY half does not fire. What still catches
  -- that shape in practice is the PREFIX half plus `out_of_order`: with nothing revealed, the guard
  -- below computes an expected index of 1, no spin 1 exists, and the call is refused rather than
  -- writing. So the gate holds — but it holds for a different reason than the sentence above used
  -- to give, and a load-bearing proof that is wrong is worse than one that is narrow.
  -- ⭐ The durable fix is a `check (spin_index > 0) is true` on `spin`, which belongs with a
  -- migration that owns that table. Recorded, not smuggled in here.
  if v_max_index <> v_total or v_max_revealed <> v_revealed then
    raise exception
      using errcode = 'IC911',
            message = 'ceremony ' || p_ceremony_id || ' reveal order is corrupt — ' ||
                      v_total || ' spins with max index ' || v_max_index || ', ' ||
                      v_revealed || ' revealed with max index ' || v_max_revealed ||
                      ' (the revealed set must be a dense prefix of a dense spin order)',
            hint    = 'reveal_spin is the ONLY writer of spin.revealed_at and it walks the axis '
                      'forward one dense step at a time (R8); a hole means the column was written '
                      'directly with the service key, and the published spin order UX-DR32/42 '
                      'guarantees has already been broken';
  end if;

  -- ══ 2c. THE TARGET SPIN — read, not inferred. Asking the row for its own `revealed_at` rather
  --    than deducing it from the ledger is what makes the `already_revealed` test read its evidence.
  select s.id, s.kind, s.revealed_at
    into v_spin_id, v_kind, v_revealed_at
    from public.spin s
   where s.ceremony_id = p_ceremony_id and s.spin_index = p_spin_index;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_spin',
                              'spin_index', p_spin_index, 'total_spins', v_total);
  end if;

  -- ⭐ R9 / Q4 (Cuatro, 2026-08-08) — A DOUBLE REVEAL REFUSES; IT IS NOT IDEMPOTENT.
  -- Mirrors `already_persisted` (`0027:671-680`). AD-8's idempotency stance and 4.3's idempotent
  -- conditional advance genuinely cut the other way, so the choice is recorded rather than assumed:
  -- an ok-reply would have to either write a SECOND audit_log + timeline_feed row (asserting a
  -- reveal that never happened, into two append-only surfaces) or write NEITHER while claiming
  -- success. A typed refusal tells the admin which fact is true and writes nothing.
  if v_revealed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_revealed',
                              'spin_index', p_spin_index, 'revealed_at', v_revealed_at);
  end if;

  -- ⭐ AC5 / R8 — THE ORDER IS THE ORDER. Given the prefix invariant proven at 2b, the lowest
  -- unrevealed index is exactly `v_revealed + 1`. The expected index travels in the refusal so the
  -- admin (and 6.10's UI) learns what to press instead of guessing.
  if p_spin_index <> v_revealed + 1 then
    return jsonb_build_object('ok', false, 'reason', 'out_of_order',
                              'spin_index', p_spin_index,
                              'expected_spin_index', v_revealed + 1,
                              'revealed_spins', v_revealed, 'total_spins', v_total);
  end if;

  -- ⭐ THE ACTOR IS RESOLVED BEFORE THE WRITE, NOT DISCOVERED AT THE AUDIT INSERT — 6.8a's review
  -- fixed exactly this in persist_ceremony (`0027:979-991`). `audit_log.actor_steamid64` is
  -- `not null references player(steamid64)` (`0003:24`), so a NULL would raise 23502 and an unknown
  -- id 23503 — after the spin had been stamped and the feed row written. AD-6 would still hold (the
  -- transaction rolls back), but it would be the one refusal class here that is not pre-write.
  if p_actor is null or not exists (
    select 1 from public.player p where p.steamid64 = p_actor
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_actor',
                              'actor', coalesce(p_actor, '<null>'));
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──

  -- `now()` is transaction-stable, so the stamp on the spin, the ceremony's completed_at, the feed
  -- row's occurred_at default and the audit row's occurred_at default are all the SAME instant.
  v_now := now();

  -- ══ 3. THE STAMP. One spin. This is the entire observable effect of the command: four policies
  --    above resolve their visibility from this column, so this single UPDATE is what flips a spin,
  --    its results, its winners and its award into view.
  update public.spin
     set revealed_at = v_now
   where id = v_spin_id;

  -- ══ 4. AC8 — THE `award_reveal` FEED ROW, in this same transaction (R10).
  --
  -- ⛔⛔ THIS IS `timeline_feed`'s SECOND WRITER EVER, AND `0017`'s SAFETY ARGUMENT NAMES THE FIRST
  -- ONE BY NAME — SO IT HAS TO BE RE-MADE HERE. CODE-REVIEW ADDITION, 2026-08-08.
  -- `0017:136` opens the feed to everyone with `create policy timeline_view on public.timeline_feed
  -- for select to anon, authenticated using (true)` — a BLANKET `using (true)`, no gate at all — and
  -- `0017:127-136` justifies it precisely: "it is SAFE BY CONSTRUCTION because a row is only ever
  -- written POST-approval, inside approve_match, AFTER the stat rows are already `approved` … There
  -- is no pending row to leak. So the blanket using (true) is correct HERE for a reason that must be
  -- written down." That reason stops being the whole truth at this line: `approve_match` is no
  -- longer the only writer.
  -- ⭐ THE ARGUMENT STILL HOLDS, AND HERE IS THE SECOND HALF OF IT. This insert is INSIDE the same
  -- transaction as the `revealed_at` stamp above (R10 / AD-6), so the feed row and the reveal become
  -- visible together or neither does — there is no window in which an ungated reader can see a card
  -- for a spin that is still unrevealed, which is exactly the "no pending row to leak" property
  -- `0017` bought for approvals. ⛔ THAT ATOMICITY IS THE WHOLE SAFETY ARGUMENT for putting an
  -- ungated row on a `using (true)` table. Moving this insert out of the transaction, deferring it to
  -- a job, or writing it before the stamp re-opens the exact spoiler AD-22 exists to prevent.
  --
  -- ⚠ DECISION H — DATA, NEVER COPY. `lib/feed/model.ts:186-188` renders `detail.title` and
  -- `detail.subtitle` VERBATIM, so a Spanish sentence written here would be viewer copy living
  -- outside the one i18n module AD-24 mandates. What is written is therefore only what the database
  -- already holds — award names and player display names — and a branch with no such fact OMITS the
  -- key so model.ts's shipped fallback carries it, deliberately and asserted.
  --
  -- ⚠ `string_agg` RETURNS NULL OVER ZERO ROWS, AND THAT IS THE MECHANISM, NOT AN ACCIDENT.
  -- It is also the trap 6.8a's review found four times (`string_agg` SKIPS NULLs), so note what is
  -- being aggregated: `award.name` is `not null` (`0023`) and `player.display_name` is `not null`
  -- (`0001:40`), so no row can contribute a NULL and a NULL result means EXACTLY "no rows".
  --
  -- ⚠ A SPIN MAY DECIDE MORE THAN ONE AWARD. `spin.live_award_ids` is a SET, so `award_result` is
  -- 1..N per spin and both aggregates are joined with ' · '. Over the measured corpus it is 1:1
  -- (40 spins / 40 results), which is why the rendered card reads as a single award.
  select string_agg(a.name, ' · ' order by a.priority), count(*)::int
    into v_titles, v_award_count
    from public.award_result ar
    join public.award a on a.id = ar.award_id
   where ar.spin_id = v_spin_id;

  select string_agg(pl.display_name, ' · ' order by pl.display_name), count(*)::int
    into v_subtitles, v_winner_count
    from public.award_result_winner w
    join public.roster_entry re on re.id = w.winner_entry_id
    join public.player pl on pl.steamid64 = re.steamid64
   where w.spin_id = v_spin_id;

  -- ⚠ THE KEY IS OMITTED, NOT SET TO NULL. `jsonb_build_object('title', null)` produces a JSON
  -- null, and `typeof d.title === 'string'` is false for it too — so both spellings degrade
  -- identically today. The ABSENT key is chosen because it is what the `{title?, subtitle?}`
  -- contract (`lib/feed/model.ts:128-131`) actually declares, and because pgTAP can then assert the
  -- two branches apart by key PRESENCE rather than by a null that reads like a bug.
  -- The four context keys are ignored by `toCardModel` (it reads only title/subtitle) and exist so
  -- every branch is self-describing and assertable: which spin, what kind, how many of each.
  v_detail := jsonb_build_object(
                'spin_index',   p_spin_index,
                'kind',         v_kind,
                'award_count',  v_award_count,
                'winner_count', v_winner_count
              )
              || case when v_titles is not null
                      then jsonb_build_object('title', v_titles)
                      else '{}'::jsonb end
              || case when v_subtitles is not null
                      then jsonb_build_object('subtitle', v_subtitles)
                      else '{}'::jsonb end;

  -- `target_match_id` stays NULL: an award reveal is not about a bracket node, and 5.6's card links
  -- to /leaderboards rather than to a match (`lib/feed/model.ts:196`).
  insert into public.timeline_feed (tournament_id, entry_type, occurred_at, detail)
  values (v_tournament, 'award_reveal', v_now, v_detail);

  -- ══ 5. AC6 / DECISION E — THE LAST REVEAL COMPLETES THE CEREMONY, ATOMICALLY.
  -- ⭐ `0027:152`: "The transition trigger below ALREADY PERMITS spinning -> complete; 6.8b writes
  -- it." This is that write, and it goes through `ceremony_transition_valid` as ONE legal forward
  -- step — the trigger still refuses complete -> spinning, spinning -> locked and every skip with
  -- IC910. `completed_at` is the shell `0024:204` created and nobody has written until now.
  -- ⚠ The comparison is against `max(spin_index)`, not against `count(*)`: they are equal here only
  -- because 2b just PROVED the spin order dense, and saying so is the difference between a guard
  -- and a coincidence.
  if p_spin_index = v_max_index then
    update public.ceremony
       set state        = 'complete',
           completed_at = v_now
     where id = p_ceremony_id;
    v_complete := true;
  end if;

  v_after_state := case when v_complete then 'complete' else v_state end;

  -- ══ 6. EXACTLY ONE audit_log row (AD-17), with before/after in `detail`.
  -- ⚠ `'reveal_spin'` JOINS THE VOCABULARY WITH NO MIGRATION: `audit_log.action` is uncapped `text`
  -- with NO CHECK (`0003:25` is a documentation comment, not a constraint) — the same precedent
  -- 4.2's `begin_grace`/`resume_match` and 4.3 took (`0015:141-144`).
  -- ⚠ EVERY key below is asserted in pgTAP BY CONTENT: 6.8a's review found "the audit_log row was
  -- asserted by ZERO tests in a migration whose own comment said EVERY key below is asserted".
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    v_tournament,
    p_actor,
    'reveal_spin',
    jsonb_build_object(
      'before', jsonb_build_object(
                  'ceremony_state', v_state,
                  'revealed_spins', v_revealed,
                  'revealed_at',    null
                ),
      'after',  jsonb_build_object(
                  'ceremony_state',    v_after_state,
                  'ceremony_id',       p_ceremony_id,
                  'spin_id',           v_spin_id,
                  'spin_index',        p_spin_index,
                  'kind',              v_kind,
                  'revealed_at',       v_now,
                  'revealed_spins',    v_revealed + 1,
                  'total_spins',       v_total,
                  'awards',            v_award_count,
                  'winners',           v_winner_count,
                  'ceremony_complete', v_complete
                )
    )
  );

  -- ══ 7. THE BROADCAST, POST-COMMIT BY CONSTRUCTION — the `0013:809-845` pattern, and the ONLY
  --    Broadcast pattern in this codebase.
  --
  --    `realtime.send` INSERTS a row into `realtime.messages` inside THIS transaction and Realtime
  --    ships it off the replication slot, so nothing is delivered unless this transaction COMMITS
  --    and a rollback discards the message together with the reveal that would have caused it. The
  --    emit cannot outrun its own commit.
  --
  --    Channel and event are FIXED BY THE SPINE, not chosen here: `SPINE:230` names `spin.reveal`
  --    in the vocabulary and `ceremony:<id>` in the channel list, and `0024:165-167` is the standing
  --    rule that event names are "server-authored, named by semantic change" and NEVER invented.
  --    ⚠ `<id>` IS THE CEREMONY ID, not the tournament id — `tournament:<id>` already carries the
  --    tournament axis, and a viewer can now learn the ceremony id from the `ceremony` row this
  --    same migration publishes, so the channel is discoverable from a published read alone (AD-11).
  --    `private => false` — `ceremony:<id>` is "public once started" (`SPINE:133`), and this emit
  --    only ever fires while the ceremony is `spinning`.
  --
  --    ⚠ DO NOT "FIX" THE ERROR SWALLOWING. `realtime.send` wraps its INSERT in
  --    `EXCEPTION WHEN OTHERS -> RAISE WARNING`, so a Realtime hiccup can NEVER abort a reveal. That
  --    is correct and it IS AD-11: Broadcast is a NUDGE, never the source of truth. The reveal is a
  --    ROW STATE (`spin.revealed_at`), so every viewer surface stays fully reconstructable from a
  --    published-state read alone and a client re-fetches on reconnect.
  --
  --    ⚠ DO NOT BUILD A SECOND EMITTER, and DO NOT add `spin.reveal` to `lib/realtime/status.ts`'s
  --    NUDGE_EVENTS — that list is the `tournament:<id>` vocabulary 5.8's surfaces consume, and the
  --    consumer for this one is 6.10's, with the UI that needs it (DECISION F).
  perform realtime.send(
    jsonb_build_object(
      'ceremony_id',       p_ceremony_id,
      'tournament_id',     v_tournament,
      'spin_id',           v_spin_id,
      'spin_index',        p_spin_index,
      'kind',              v_kind,
      'revealed_spins',    v_revealed + 1,
      'total_spins',       v_total,
      'ceremony_complete', v_complete
    ),
    'spin.reveal',
    'ceremony:' || p_ceremony_id::text,
    false
  );

  return jsonb_build_object(
    'ok',                true,
    'ceremony_id',       p_ceremony_id,
    'spin_id',           v_spin_id,
    'spin_index',        p_spin_index,
    'kind',              v_kind,
    'revealed_at',       v_now,
    'revealed_spins',    v_revealed + 1,
    'total_spins',       v_total,
    'awards',            v_award_count,
    'winners',           v_winner_count,
    'ceremony_state',    v_after_state,
    'ceremony_complete', v_complete
  );
end;
$$;

comment on function public.reveal_spin(bigint, int, text) is
  'FR-24/FR-30/FR-31 + AD-22/AD-6/AD-17 (Story 6.8b): reveals ONE spin of a running ceremony by '
  'stamping spin.revealed_at, which is what flips that spin, its award_results, its winners and '
  'its award into the viewer''s reach through 0028''s four reveal-gated policies. In the SAME '
  'transaction it writes the award_reveal timeline_feed row (unowned since 0017:109), exactly one '
  'reveal_spin audit_log row, and — when the spin is the ceremony''s highest index — '
  'ceremony.state = complete + completed_at, as one legal forward step through '
  'assert_ceremony_transition (DECISION E). Reveals are FORWARD-ONLY and DENSE: p_spin_index must '
  'be the lowest unrevealed index (out_of_order otherwise) and a second reveal of the same spin '
  'REFUSES with already_revealed rather than being idempotent (R9, Cuatro 2026-08-08). Business '
  'refusals are RETURNED as {ok:false, reason:...}: no_ceremony, ceremony_not_spinning, '
  'no_such_spin, already_revealed, out_of_order, unknown_actor. IC911 is RAISED only for genuine '
  'corruption — a revealed set that is not a dense prefix, which only a direct service-key UPDATE '
  'of revealed_at can produce. Emits one spin.reveal Broadcast on ceremony:<id> (SPINE:230).';

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- ⚠ LOAD-BEARING, NOT DECORATION. `create function` grants EXECUTE to PUBLIC and anon/authenticated
-- INHERIT from PUBLIC, so without this REVOKE a viewer could reveal a spin straight off the Data
-- API — i.e. spoil the ceremony with an anonymous POST. It is `security invoker` and a viewer holds
-- no UPDATE grant on `spin`, so the write would fail anyway; but a defence that depends on a
-- different grant check is not a defence. Revoke first, then grant to the single writer
-- (`0017:456-463` / `0023:529-530` / `0024:885-889` / `0027:1183-1188`).
revoke execute on function public.reveal_spin(bigint, int, text) from public;
grant  execute on function public.reveal_spin(bigint, int, text) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (g) AC7 — `ceremony_locked` finally reaches the grace and bind RPCs.
--     CLOSES deferred-work.md:280.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ THE ITEM, VERBATIM (`deferred-work.md:280`): "begin_match_grace, resume_match and
-- bind_match_demo gate on match state only and carry no ceremony guard, so after the lock they
-- still churn match state and push timeline_feed entries … feed activity landing on the viewer
-- WHILE THE AUDIENCE IS WATCHING THE CEREMONY, describing a bracket the frozen snapshot says is
-- settled." Intended home: 6.8, "it owns the judgement about what the audience may see
-- mid-ceremony". `0024:2195-2199` said the same thing when it guarded `mark_walkover` and
-- deliberately left these three: "none can move final_match_id, so none can falsify a committed
-- seed. What they CAN do post-lock is churn match state and push timeline_feed entries while the
-- audience is watching the ceremony — a viewer-integrity concern … owned by Story 6.8." Confirmed
-- with Cuatro (2026-08-03). This story publishes the ceremony to the audience, so this is the
-- moment the concern stops being theoretical.
--
-- ⚠⚠ EACH BODY IS `0015`/`0016`'s, COPIED FORWARD **VERBATIM**, WITH EXACTLY ONE ADDITION: the
-- `ceremony_locked` typed refusal, before any write, in `mark_walkover`'s 6.2 form
-- (`0024:2246-2251`) byte-for-byte in shape. ⛔ NEVER EDIT `0015` OR `0016`. The diff of each
-- replaced body against its original is pasted in the story's Completion Notes and contains only
-- the intended change — the rule 6.8a followed for `assert_award_result_is_shared`, and the reason
-- its review could verify the delta was "exactly four things and nothing else".
--
-- ⚠ THE GUARD READS `ceremony` WITHOUT LOCKING IT, exactly as `mark_walkover` does
-- (`0024:2201-2203`): it runs UNDER the row lock each RPC has already taken on `match`, which is
-- the same lock `lock_ceremony` takes FIRST (`0024:429-450`), so the two genuinely serialize and
-- this is not a TOCTOU. ⛔ Do not hoist it above that lock and do not add a `for update` — a
-- `ceremony` lock taken here would be OUT of canonical order against both lock_ceremony and
-- persist_ceremony and is the 40P01 ABBA shape.
--
-- ⚠ `coalesce(v_cstate, 'not_started')` IS THE THREE-VALUED-LOGIC GUARD, NOT A STYLE CHOICE. A
-- tournament with NO ceremony row yields NULL, and `NULL <> 'not_started'` is NULL — which an `if`
-- reads as FALSE, so the guard would correctly not fire; but the coalesce makes that reading
-- explicit rather than accidental, and it is what `mark_walkover` already carries.

-- ── (g1) begin_match_grace — 0015:145-208's body + the guard ────────────────
create or replace function public.begin_match_grace(
  p_match_id        bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17); see DECISION E above
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m      record;
  v_grace  int;
  v_cstate text;                   -- ⭐ 6.8b — the ceremony lock state, read under the match lock
begin
  select m.id, m.tournament_id, m.state, m.competitor_a, m.competitor_b
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ⭐ AD-15 / AD-22 — ceremony_locked (Story 6.8b, AC7; closes deferred-work.md:280). Starting a
  -- grace clock after the lock churns match state and pushes viewer-visible activity describing a
  -- bracket the frozen snapshot says is settled — while the audience is watching the ceremony.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_m.tournament_id;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
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

-- NO grants re-issued: `create or replace` with the same signature (bigint, text) keeps 0015's
-- EXECUTE matrix intact — the same note 0024:2177-2178 made for curate_award_catalog.

-- ── (g2) resume_match — 0015:218-263's body + the guard ─────────────────────
create or replace function public.resume_match(
  p_match_id        bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17); see DECISION E above
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m      record;
  v_cstate text;                   -- ⭐ 6.8b — the ceremony lock state, read under the match lock
begin
  select m.id, m.tournament_id, m.state, m.awaiting_grace_since
    into v_m
    from public.match m
   where m.id = p_match_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_match');
  end if;

  -- ⭐ AD-15 / AD-22 — ceremony_locked (Story 6.8b, AC7; closes deferred-work.md:280). Resuming a
  -- match after the lock returns it to `declared`, re-opening a bracket the ceremony has already
  -- frozen and committed a seed against.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_m.tournament_id;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
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

-- ── (g3) bind_match_demo — 0016:135-287's body + the guard ──────────────────
-- ⚠⚠ THE GUARD GOES **AFTER** THE IDEMPOTENCY SHORT-CIRCUIT, AND THAT PLACEMENT IS DELIBERATE —
-- it is the ONE thing that differs from mark_walkover's "ceremony_locked first" ordering, so it is
-- stated rather than left to be discovered as an inconsistency.
-- `0016:174-185` argues at length that the already-bound branch MUST precede the state guard
-- because "turning a dropped HTTP response into a permanent, misleading error" is worse than the
-- refusal it replaces — and that branch performs NO WRITE AT ALL; it is "a no-op confirmation, not
-- an action", and it deliberately writes no second audit row. Putting `ceremony_locked` ahead of it
-- would make a retry of a bind that ALREADY SUCCEEDED before the lock start failing afterwards,
-- which is exactly the failure 0016 designed that branch to prevent. The guard still precedes every
-- WRITE, which is what "before any write" means.
create or replace function public.bind_match_demo(
  p_match_id        bigint,
  p_demo_id         bigint,
  p_actor_steamid64 text   -- the acting admin — logged to audit_log (AD-17)
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_m      record;
  v_d      record;
  v_stats  int;
  v_bound  int;
  v_cstate text;                   -- ⭐ 6.8b — the ceremony lock state, read under the match lock
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

  -- ⭐ AD-15 / AD-22 — ceremony_locked (Story 6.8b, AC7; closes deferred-work.md:280). A bind after
  -- the lock flips the match to `pending` and makes 4.6b's publish possible, so it churns match
  -- state and pushes timeline_feed entries at a viewer who is watching the ceremony. Placed after
  -- the idempotency short-circuit, which writes nothing — see the block above this function.
  select c.state into v_cstate from public.ceremony c where c.tournament_id = v_m.tournament_id;
  if coalesce(v_cstate, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);
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

-- ════════════════════════════════════════════════════════════════════════════
-- (h) CODE REVIEW 2026-08-08 — `persist_ceremony`: refuse a re-persist MID-REVEAL.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ 0027:600-1169's BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE ADDITION: the
-- `reveal_in_progress` typed refusal, before any write. The full argument for why it has to exist
-- is written at the guard itself; the short version is that `p_replace => true` was legal while the
-- ceremony was `spinning`, and it un-revealed published spins while their `award_reveal` feed rows
-- — which are ungated (`0017:136`) and append-only — stayed visible, publishing award identities
-- ahead of their reveal.
-- ⛔ Do NOT edit 0027. This is a `create or replace` in THIS file, the same discipline (g) follows
-- for begin_match_grace / resume_match / bind_match_demo and 6.8a followed for
-- assert_award_result_is_shared. The diff of this body against 0027's is pasted in 6-8b's
-- Completion Notes: 44 insertions, 1 deletion, and the deletion is the `create` keyword itself.
-- ⚠ NO revoke/grant is re-issued below, and that is correct rather than an omission: `create or
-- replace` PRESERVES a function's existing privileges, and 0027:1187-1188 already revoked EXECUTE
-- from public and granted it to service_role. Re-issuing would be harmless but would imply the
-- grants had been lost, which they have not.

create or replace function public.persist_ceremony(
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
  v_revealed      int;   -- 6.8b code review: spins of this ceremony already REVEALED
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

  -- ⛔⛔ reveal_in_progress — ADDED BY STORY 6.8b'S CODE REVIEW (2026-08-08). THIS GUARD, ITS
  -- `v_revealed` DECLARATION AND THIS COMMENT ARE THE **ONLY** DIFFERENCES BETWEEN THIS BODY AND
  -- `0027:600-1169`. Verified by diff; see 6-8b's Completion Notes.
  --
  -- WHAT IT PREVENTS. `p_replace => true` deletes every spin of the ceremony and rewrites them with
  -- `revealed_at` NULL (`0027:1011-1016`, `:1049-1054`), and the state guard above admits `spinning`
  -- — which is exactly the state a ceremony is in WHILE 6.8b's `reveal_spin` is walking it. So a
  -- re-persist mid-ceremony was legal, and it did three things at once:
  --   (1) the viewer's visible set silently RETRACTED, because `revealed_at` went back to NULL on
  --       rows anon could already read through 0028's four reveal-gated policies;
  --   (2) the `award_reveal` `timeline_feed` rows written by the reveals SURVIVED — `timeline_feed`
  --       is append-only and `timeline_view` is `using (true)` (`0017:136`) — so anon kept reading
  --       `detail.title`, i.e. the AWARD NAMES, for a run that no longer existed. If the new run
  --       then placed any of those awards in a LATER spin, their identity had been published BEFORE
  --       their reveal: the precise spoiler AD-22 and R10 exist to prevent;
  --   (3) re-revealing wrote a SECOND `award_reveal` row for the same `spin_index`, which the feed
  --       renders as a duplicate card.
  -- ⚠ AND IC911 COULD NOT SEE ANY OF IT. After the replace the revealed set is {} over a dense
  -- 1..N, which satisfies the prefix invariant perfectly — so `reveal_spin` carried on as if nothing
  -- had happened. ⛔ 0028's own header claim that a broken reveal order "can only be produced by a
  -- direct service_role UPDATE" was therefore FALSE, and it is corrected at that site too.
  --
  -- WHY A TYPED REFUSAL RATHER THAN A CASCADE-BLOCKING TRIGGER: the house convention is that a
  -- business rule is RETURNED as {ok:false, reason} and only genuine corruption RAISES, and the
  -- operator needs to be told WHICH fact is true (the ceremony is mid-reveal) rather than getting a
  -- 23503 from a delete they did not know they were making. Re-persisting after the ceremony is
  -- COMPLETE is refused by the `ceremony_not_locked` guard above, so this covers the one live gap.
  -- ⚠ `count(*)` cannot return NULL, so the `coalesce` is belt to that suspenders — kept because
  -- this epic has paid for a NULL-valued guard condition being read as FALSE four separate times.
  select count(*) into v_revealed
    from public.spin s
   where s.ceremony_id = p_ceremony_id and s.revealed_at is not null;

  if coalesce(v_revealed, 0) > 0 then
    return jsonb_build_object(
      'ok', false, 'reason', 'reveal_in_progress',
      'revealed_spins', v_revealed,
      'existing_spins', v_n,
      'hint', 'this ceremony is mid-reveal; re-persisting would un-reveal published spins while their award_reveal feed rows remain visible'
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

-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED, AND IT HAS TO BE. `create or replace` PRESERVES the existing
-- `pg_description` entry, so 0027:1171-1181's text would have survived unchanged and would now
-- describe a function with one more refusal than it lists — precisely the stale-comment class this
-- epic's migrations are written against. This is 0027's comment with the `reveal_in_progress`
-- sentence added and nothing else altered.
comment on function public.persist_ceremony(bigint, jsonb, text, boolean) is
  'FR-25/26/28/29 + AD-6 (Story 6.8a): persists one whole ceremony run — every spin, award_result '
  'and award_result_winner — in ONE transaction, or none of it. Validates the producer''s payload '
  'rather than trusting it: every award_id is re-resolved against this tournament''s frozen catalog '
  'and every steamid64 against its ACTIVE roster. Publishes ceremony.spin_plan and advances state '
  'locked -> spinning in the same transaction, so the plan and the rows cannot disagree. '
  '⛔ revealed_at is written NULL on every spin — 6.8b stamps it. p_replace deletes the prior run '
  '(cascading to results and winners) and writes the new one in the same transaction; without it a '
  'second call refuses with already_persisted. ⛔ AND WITH IT, a call refuses with '
  'reveal_in_progress once ANY spin of the ceremony is revealed (Story 6.8b code review, '
  '2026-08-08): re-persisting mid-ceremony un-revealed published spins while their award_reveal '
  'timeline_feed rows stayed visible, publishing award identities ahead of their reveal. '
  'Business refusals are RETURNED as '
  '{ok:false, reason:...}; the anti-sweep UNIQUE is deliberately NOT guarded, because 0025 requires '
  'a producer bug to fail loudly rather than be handled.';

-- ── The RESTRICTIVE-policy question, answered explicitly rather than left unaddressed ─────────
-- ⚠ Postgres OR's PERMISSIVE policies together, so an AND of two axes must either live inside ONE
-- `using` clause or be expressed with a RESTRICTIVE policy. That is MOOT for all five tables here:
-- none of them carries a `status` column, so reveal-state is their ONLY viewer axis and there is no
-- second axis to AND with. `spin`/`award_result`/`award_result_winner`/`award` are children of a
-- ceremony that only exists once the snapshot is frozen, and `ceremony` itself is gated on its own
-- `state`. ⛔ If a status-like axis is ever added to any of these, `<t>_viewer_read` must gain the
-- predicate INSIDE its own `using` clause — adding a second permissive policy would WIDEN, not
-- narrow, which is the trap AD-7 and 0002:87-98 are written against.
