-- supabase/migrations/0010_match.sql
-- Logical migration 0010 — the `match` table (Story 4.1, AC2/AC3 + D1).
-- The bracket substrate: one row per bracket node (Winners + Losers + Grand-Final), pre-created in
-- full at generation. Two-loss elimination is DERIVED from bracket edges, never a stored flag
-- (SOLUTION-DESIGN §7 L359). This is also the table FOUR earlier migrations have been waiting on:
-- every deferred `-> match(id)` FK is closed HERE (D1), as 0005/0007's headers promised.
--
-- SCOPE (whole deliverable): create `match` per SOLUTION-DESIGN §3 (lines 110-139) with the FULL
--   column set (score/format/demo columns are created now, POPULATED by later stories — the same
--   "full column set up front" precedent as 0005 demo / 0007 stat_row); the `match (tournament_id,
--   bracket)` index (§3 L259); the slot-uniqueness index; the AD-5 score_source_guard CHECK; the
--   structural CHECKs (gf_order domain, winner-is-a-participant, distinct competitors); the FOUR
--   deferred inbound FKs (D1) — which requires SEPARATING the external ingest id from the bracket
--   match id, see below; ENABLE+FORCE RLS; an admin-only dormant SELECT policy; and
--   `grant select, insert, update on match to service_role` (deliberately NO DELETE — matches are
--   never hard-deleted, only state-transitioned).
-- OUT OF SCOPE — do NOT add here (each has an owning story; building it now is scope creep):
--   * the `generate_bracket` RPC + the roster-lock trigger -> migration 0011 (same story, next slice).
--   * format/tie_policy DECLARATION + format_locked=true (AD-10) -> Story 4.2. The columns exist
--     here; 4.1 leaves them NULL/false (the DDL defaults).
--   * idempotent conditional advance (`WHERE slot IS NULL OR = winner`) -> Story 4.3.
--   * the Grand-Final RESET row (gf_order=2, AD-21) -> Story 4.4. 4.1 creates only gf_order=1.
--   * awaiting_grace / forfeit / the 10-min grace timer (AD-9/AD-23) -> Story 4.5. 4.1 creates only
--     STRUCTURAL byes (no opponent because of an odd field), never no-show forfeits.
--   * score_a/score_b/score_source population + state='resolved' (the Aprobar txn) -> Story 4.6;
--     manual_override -> Story 4.8. The score_source_guard CHECK is created WITH the table anyway —
--     it is a structural invariant (AD-5), harmless while score_source IS NULL.
--   * BINDING a demo to the match it decided (`demo.match_id`) -> Story 4.6 (Aprobar). This migration
--     creates the column + FK; it is NULL for every row until 4.6 populates it. See D1 below.
--   * the anon/authenticated SELECT grant + the viewer bracket policy -> Epic 5 (the Spanish viewer
--     surface). `match` is admin/worker-only this slice — mirror demo/stat_row, NOT roster_entry.

-- ── FK target for the tournament-scoped competitor FKs below ─────────────────
-- roster_entry.id is already the PK, but a COMPOSITE fk (tournament_id, competitor) needs a composite
-- UNIQUE to point at. Redundant as a constraint, load-bearing as an FK target.
alter table public.roster_entry add constraint roster_entry_tournament_id_uniq unique (tournament_id, id);

-- ── match (AD-8/AD-9/AD-21) — one row per bracket node ───────────────────────
-- competitor_a/b + winner_entry reference roster_entry, NOT player: matches join to the SEEDED ROSTER,
-- so a display_name rename never orphans a bracket (AD-4 — display_name is never a join key). They are
-- keyed on (tournament_id, …) so a match can only ever seat a player from ITS OWN event — a plain
-- `references roster_entry(id)` would happily let a T1 match seat a T2 player.
-- No ON DELETE action on those three: NO ACTION (the default) is checked at end-of-statement, so a
-- `delete from tournament` still reaps its own match rows via CASCADE in the same statement, while a
-- bare roster_entry delete is blocked. roster_entry has no DELETE grant anyway (soft-delete).
create table match (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  bracket       text not null check (bracket in ('winners','losers','grand_final')),
  bracket_position text not null,        -- human LABEL ("Winners R1"), never a running number (SPINE L229)
  bracket_slot  int not null,            -- structural routing index (0-based within its bracket)
  gf_order      int,                     -- 1 = GF, 2 = GF-reset (AD-21, Story 4.4); NULL otherwise
  competitor_a  bigint,
  competitor_b  bigint,
  winner_entry  bigint,
  format        text,                    -- declared + locked BEFORE start (AD-10) -> Story 4.2
  tie_policy    text,                    -- -> Story 4.2
  format_locked boolean not null default false,                                -- -> Story 4.2
  -- 'bye'  = a WALKOVER: only one competitor can ever reach this node, so it is won unplayed (AD-9).
  -- 'void' = NOTHING can ever reach it: both feeders were byes, so neither produced a loser. Emitted
  --          only on a non-power-of-two field; never played, advances nobody. Both are set by
  --          generation (lib/bracket/generate.ts) and both create NO stat_row — there is no demo and
  --          therefore no reachable stat-write path (AD-9).
  state         text not null default 'declared'
                check (state in ('declared','awaiting_grace','live','bye','void','forfeit','pending','resolved','manual_resolved','rolled_back')),
  score_a       int,                     -- -> Story 4.6 (demo_derived) / 4.8 (admin_manual)
  score_b       int,
  score_source  text check (score_source in ('demo_derived','admin_manual')),  -- AD-5 single discriminator
  manual_override boolean not null default false,                              -- -> Story 4.8
  demo_id       bigint references demo(id),                                    -- the demo that decided this match (Story 4.6)
  created_at    timestamptz not null default now(),

  -- A match may only seat players from its OWN tournament (see the header note above).
  constraint match_competitor_a_fk foreign key (tournament_id, competitor_a) references roster_entry(tournament_id, id),
  constraint match_competitor_b_fk foreign key (tournament_id, competitor_b) references roster_entry(tournament_id, id),
  constraint match_winner_entry_fk foreign key (tournament_id, winner_entry) references roster_entry(tournament_id, id),

  -- gf_order EXISTS iff this is a grand-final row, and then it is 1 (GF) or 2 (the AD-21 reset, 4.4).
  -- Without this a 'winners' row could carry gf_order=1 (and then NOT collide, under the coalesce
  -- index below, with a NULL-gf_order winners row in the same slot => two matches in one slot), and a
  -- THIRD grand_final row with a NULL gf_order would fold to 0 and coexist with 1 and 2.
  -- ⚠ `gf_order is not null and …` is load-bearing: a bare `gf_order in (1,2)` evaluates to NULL when
  -- gf_order IS NULL, and a CHECK passes on NULL — so the third-GF-row hole would stay wide open.
  constraint match_gf_order_guard check (
    case
      when bracket = 'grand_final' then gf_order is not null and gf_order in (1, 2)
      else gf_order is null
    end
  ),
  -- The winner must be one of the two competitors. Generation itself writes winner_entry (for byes),
  -- so this is the one write path where a routing bug would otherwise land silently.
  -- ⚠ `is not distinct from` (not `=`): with both competitors NULL, `winner = competitor_a` is NULL,
  -- and NULL passes a CHECK — a match could be "won" by someone who was never in it.
  constraint match_winner_is_competitor check (
    winner_entry is null
    or winner_entry is not distinct from competitor_a
    or winner_entry is not distinct from competitor_b
  ),
  -- Nobody plays themselves.
  constraint match_distinct_competitors check (
    competitor_a is null or competitor_b is null or competitor_a <> competitor_b
  )
);

-- ── Slot uniqueness — the structural key (SOLUTION-DESIGN §3 L131) ───────────
-- SOLUTION-DESIGN writes this as `unique (tournament_id, bracket, bracket_slot, coalesce(gf_order,0))`
-- INSIDE create table. That is pseudo-SQL: a Postgres UNIQUE *table constraint* accepts only bare
-- column names — an expression (coalesce) requires a UNIQUE *INDEX*. Same semantics, so the intent is
-- realized faithfully here: coalesce(gf_order,0) folds the NULL gf_order of every non-GF row to 0 so
-- NULLs collide (a plain UNIQUE would treat every NULL as distinct and enforce NOTHING on the ~29
-- non-GF rows), while the two GF rows stay distinct on 1 vs 2 (AD-21, Story 4.4).
create unique index match_slot_uniq
  on public.match (tournament_id, bracket, bracket_slot, coalesce(gf_order, 0));

-- The bracket read path filters by (tournament, bracket) — the Epic-5 viewer surface and 4.3's
-- advance both walk one bracket of one event (§3 L259).
create index match_tournament_bracket_idx on public.match (tournament_id, bracket);

-- ── AD-5 score-source guard — created WITH the table (structural invariant) ──
-- The single discriminator: a demo-derived score REQUIRES the demo that produced it; an admin_manual
-- score is only legitimate when there is no demo at all, or an explicit audited override was taken.
-- Scores are set in 4.6/4.8 — this CHECK is inert while score_source IS NULL, and is created now so
-- those stories cannot land a score that violates AD-5.
alter table public.match add constraint score_source_guard check (
  score_source is null
  or (score_source = 'demo_derived' and demo_id is not null)
  or (score_source = 'admin_manual'  and (demo_id is null or manual_override = true))
);

-- ════════════════════════════════════════════════════════════════════════════
-- D1 — the FOUR deferred inbound `-> match(id)` FKs. THIS IS THAT MOMENT.
-- ════════════════════════════════════════════════════════════════════════════
-- Four tables have carried a `bigint` match pointer with the FK explicitly deferred "to Epic 4 / when
-- the match table lands" (0001:32, 0003:26, 0005:26, 0007:37 — 0007's header even says "Epic 4 adds
-- BOTH stat_row_match_fk and the pending demo_match_fk"). Closing all four here is D1 / retro action
-- epic-3 #3.
--
-- ⚠ BUT `demo.match_id` AND `stat_row.match_id` NEVER HELD A `match.id`. Both were created as free-
-- floating `bigint not null`, and every writer supplies an EXTERNAL ingest id, not a bracket node:
-- the Go worker uses MatchZy's `MatchZy-MatchId` header (worker/ingest/server.go) and the CLI's
-- `--match <id>` (worker/ingest/cli.go); the app's manual-upload notify takes any positive integer
-- (lib/ingest.ts). Simply FK-ing that column would 23503 every demo ingest and every parse — the whole
-- Epic-3 pipeline — because those ids name no match and never will.
--
-- So the two concerns are SEPARATED, which is what they always were:
--   * `matchzy_match_id` — the EXTERNAL id the ingest path supplies (MatchZy's game-server matchid, the
--     CLI's --match, or the operator's id on a manual upload). Free-floating by nature. This is a RENAME
--     of the existing column, deliberately: a rename carries the AD-3 idempotency keys with it, so
--     0006's `unique (match_id, demo_sha256)` and 0007's `unique (match_id, steamid64)` keep working on
--     exactly the values they have always deduped on. (ADDING a new column and nulling the old one would
--     have silently DESTROYED both: NULLs are DISTINCT in a UNIQUE, so demo dedup would stop deduping and
--     every re-parse would insert duplicate rows instead of upserting.)
--   * `match_id` — the BRACKET node this demo/stat_row belongs to. NULLABLE, FK'd here, and NULL for
--     every row until Story 4.6 (Aprobar) binds a demo to the match it decided. That binding is 4.6's
--     job (it is the story that knows which match a demo is evidence for); 4.1 lands the column + the FK.
--
-- ON DELETE follows the spine's referential convention (SPINE L234: RESTRICT for a source-of-truth,
-- CASCADE for a derived child).
alter table public.demo rename column match_id to matchzy_match_id;
comment on column public.demo.matchzy_match_id is
  'The EXTERNAL ingest id (MatchZy game-server matchid / CLI --match / operator id on a manual upload). NOT a match(id). Carries the AD-3 dedup key unique(matchzy_match_id, demo_sha256) from 0006.';
--   * demo -> RESTRICT: a demo is EVIDENCE (source-of-truth, write-once, no DELETE grant). It must
--     never be silently destroyed by a match delete — the delete is refused instead. NOTE the practical
--     consequence, which is intended: once 4.6 binds a demo to a match, `delete from tournament` will be
--     REFUSED (23503) — its CASCADE reaches `match`, and RESTRICT fires immediately because nothing
--     cascades `demo`. Tournaments are not deleted in v1; evidence outliving the bracket is the point.
alter table public.demo
  add column match_id bigint,
  add constraint demo_match_fk foreign key (match_id) references public.match(id) on delete restrict;
comment on column public.demo.match_id is
  'The bracket match this demo decided. NULL until Story 4.6 (Aprobar) binds it.';

alter table public.stat_row rename column match_id to matchzy_match_id;
comment on column public.stat_row.matchzy_match_id is
  'The EXTERNAL ingest id the parse was keyed on. NOT a match(id). Carries the AD-3 re-parse key unique(matchzy_match_id, steamid64) from 0007.';
--   * stat_row -> CASCADE: a stat_row is a DERIVED child of the match (re-parsable from the demo).
alter table public.stat_row
  add column match_id bigint,
  add constraint stat_row_match_fk foreign key (match_id) references public.match(id) on delete cascade;
comment on column public.stat_row.match_id is
  'The bracket match these stats belong to. NULL until Story 4.6 (Aprobar) binds the parent demo.';

-- The 0008 `unreconciled_stat_row` view (the AD-4 left-join) selects stat_row's match column. Renaming
-- the base column silently rewrites the view's internal reference but LEAVES ITS OUTPUT COLUMN NAMED
-- `match_id` — which would now be a lie: the value it exposes is the external ingest id. Rename the view's
-- output too, so the surface says what it holds. (The view keeps the same rows and the same grant.)
alter view public.unreconciled_stat_row rename column match_id to matchzy_match_id;

--   * the two NULLABLE BACK-POINTERS -> SET NULL, never CASCADE. audit_log is APPEND-ONLY (AD-17):
--     CASCADE here would let a match delete cascade-WIPE audit history (the exact hazard recorded in
--     deferred-work.md §"code review of story-1.4"). SET NULL keeps the audit row and merely forgets
--     its target. Note SET NULL is executed by the RI system with the FK owner's rights, so it works
--     despite service_role holding no UPDATE grant on audit_log — the append-only grant ceiling is
--     not a barrier to referential integrity. In practice neither fires: `match` has no DELETE grant.
alter table public.tournament
  add constraint tournament_final_match_fk foreign key (final_match_id) references public.match(id) on delete set null;
alter table public.audit_log
  add constraint audit_log_target_match_fk foreign key (target_match_id) references public.match(id) on delete set null;

-- The Epic-5 read path walks a match's stats; index the new FK (the renamed matchzy index stays too).
create index stat_row_bracket_match_idx on public.stat_row (match_id);

-- ── ENABLE + FORCE RLS (the AD-7 convention 0002/0003/0004/0005/0007 established) ──
-- FORCE is non-negotiable: the generic catalog FORCE-guard in the 0003 test (Section A2) asserts NO
-- public base table may have FORCE off, so it now covers `match` too and fails loudly here if omitted.
-- FORCE does not affect BYPASSRLS roles — service_role still bypasses.
alter table public.match enable row level security;
alter table public.match force  row level security;

-- ── Admin-only SELECT (no viewer policy yet) — mirrors demo (0005)/stat_row (0007) ──
-- `match` is admin/worker-only this slice: like demo/stat_row it gets NO anon/authenticated base
-- grant, so this admin-read policy is DORMANT defense-in-depth (even a valid admin claim 42501s at
-- the table-grant gate before RLS runs). Epic 5 adds the LIVE viewer policy + the anon/authenticated
-- SELECT grant when the Spanish bracket surface lands. The (select …) wrap makes is_admin() an
-- init-plan (evaluated once per statement) — the established perf precedent.
create policy match_admin_read on public.match for select to authenticated using ((select public.is_admin()));

-- ── Grants — the single writer + the no-hard-delete ceiling live HERE ────────
-- service_role is the sole writer (AD-2). It has BYPASSRLS, so the admin-only policy does not stop it
-- — the GRANT is what governs it. SELECT+INSERT+UPDATE: INSERT creates the whole bracket at
-- generation (0011's RPC); UPDATE is how every later story moves a match (advance 4.3, GF 4.4,
-- forfeit 4.5, approve 4.6, rollback 4.7, manual score 4.8). Deliberately NO DELETE: a match is never
-- hard-deleted, only state-transitioned (a rolled-back match becomes state='rolled_back', it does not
-- vanish — the bracket's history is the audit trail). The absent DELETE grant is the teeth (the same
-- append-only-by-grant lesson as 0003's audit tables / 0004's soft-delete / 0005's write-once demo);
-- the 0010 pgTAP proves the service_role DELETE 42501s. Identity PK needs NO separate sequence grant.
grant select, insert, update on public.match to service_role;

-- ── Reads/writes for anon/authenticated (fail-closed) ───────────────────────
-- Deliberately NO grant of any kind for anon/authenticated on `match` this slice: no read (admin-only
-- until Epic 5's viewer bracket), no write (single-writer). Doubly fail-closed, by construction —
-- mirrors demo (0005) / stat_row (0007).
