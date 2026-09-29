-- supabase/migrations/0023_award_catalog.sql
-- Logical migration 0023 — the award catalog (Story 6.1, FR-24 / AD-22). The FIRST Epic-6 migration.
--
-- ONE new table, `award`, and nothing else: the curated list of prize categories for a tournament, each with a
-- BUCKET (skill/clutch/weird/comedy), a CLASS (rate/volume), a DECIDING STAT drawn from a CLOSED vocabulary, a
-- DIRECTION (max/min) and its FR-21 eligibility FLOORS. Plus the three access objects that make AD-22 real:
--   (a) the table + every CHECK that makes a malformed award UNREPRESENTABLE (Task 1),
--   (b) ENABLE+FORCE RLS, an admin-only read policy, and — the actual teeth — NO anon/authenticated GRANT (Task 2),
--   (c) `award_catalog_count()`, the ONE catalog fact a viewer may learn: the integer count (Task 3),
--   (d) `curate_award_catalog()`, the audited, idempotent, replace-the-whole-catalog admin RPC (Task 4).
--
-- ⭐ AD-22 IS A GRANT, NOT A BLUR. The mock renders the locked block with the REAL award names visibly blurred
-- (mock-leaderboards.html:483-515, `filter: blur(4.5px)`) — view-source, DevTools or a screen reader defeat that
-- instantly, and AD-22 (SPINE:185-188) exists precisely to prevent "CSS blur being the only secrecy". So the
-- secrecy here is the ABSENCE OF A VIEWER READ GRANT: anon/authenticated hold NO privilege on `award` at all and
-- 42501 at the table-grant gate BEFORE RLS is ever consulted — the same posture as audit_log / app_role /
-- stat_snapshot* (0003:82-84). A viewer can learn the COUNT and nothing else, and only through the
-- `security definer` function below. The name, bucket, class, deciding stat, floors and id never reach a client.
--
-- ⚠ 6.8 WIDENS THIS; IT NEVER TIGHTENS IT. When `spin` exists, Story 6.8 adds the reveal-gated viewer policy
-- keyed on `spin.revealed_at` (the SOLUTION-DESIGN:283-296 sketch). 6.1 deliberately ships the STRICTLY-CLOSED
-- end state — stronger than the final posture — so the reveal axis is only ever an OPENING. Do not pre-build it:
-- `spin` does not exist, and a policy referencing a missing table cannot be written, only guessed at.
--
-- SQLSTATEs — 0023 RAISES NOTHING NEW. `curate_award_catalog` RETURNS every refusal as {ok:false, reason} (the
-- 0016/0017/0019/0020 convention); the only errors reachable from it are the table's own CHECKs (23514) and the
-- deferred UNIQUE (23505 at COMMIT), both of which are BACKSTOPS the RPC's guards keep it from ever tripping.
--
-- ⚠ `audit_log.action = 'curate_awards'` extends the UNCAPPED `action text` vocabulary (0003:25, NO CHECK) with
-- NO migration — the 0015/0016/0019/0020 precedent. 0003 is deliberately UNTOUCHED (never edit an applied
-- migration), and its action comment is now FIVE migrations stale; do not read it as exhaustive.
--
-- OUT OF SCOPE — do NOT add here (each has an owning story):
--   * NO `ceremony`, `spin`, `award_result`, `award_result_winner`, `verification_bundle` tables — 6.2/6.4/6.8/6.9.
--     `award` is the ONLY new table. (`stat_snapshot`/`stat_snapshot_row` already exist since 0003.)
--   * NO reveal-gating on `spin.revealed_at` (6.8) — `spin` does not exist. See ⚠ above.
--   * NO `seed_hex`/`bundle_hash`/commitment publication (6.8); NO PRNG, weights, `spin_plan`, `luck_weight_table`,
--     draw, tie ladder or pity (6.3/6.4/6.5/6.6/6.7). This migration knows nothing about HOW an award is decided.
--   * NO `ceremony_locked` guard on approve_match / rollback_match / manual_resolve_match — that is Story 6.2,
--     first-class (Epic-5 retro Action Item #2, seam flagged at 0020:46-48). See `catalog_frozen` below for the
--     HONEST PARTIAL this migration ships instead.
--   * NO change to `public.leaderboard` (0021). ⚠ 0021:50-52 declares its `24`/`20` floor literals a VALUE-PARITY
--     duplication seam with `award.floor_rounds`/`floor_kills`. Keep the values in lockstep; do NOT "fix" the
--     duplication by pointing the view at this catalog — AD-20 gives the floors ONE definition site and 0021 is it.
--   * NO worker/Go change, NO `award_reveal` timeline_feed writer (nothing is revealed yet — flagged for 6.8/6.10).
--   * NO CSRF (Epic 7, uniform across all cookie-authenticated admin POSTs).

-- ════════════════════════════════════════════════════════════════════════════
-- (a) Task 1 — the `award` table.
-- ════════════════════════════════════════════════════════════════════════════
-- Columns are EXACTLY SOLUTION-DESIGN.md:158-173 (same names, same types, same defaults, same two UNIQUEs). The
-- CHECKs below are what 6.1 adds on top, and every one of them is NAMED — ⚠ all of them raise the same 23514, so
-- a pgTAP `throws_ok` on the SQLSTATE alone would prove almost nothing (the trap the 4.3 review found across
-- three suites). The suite asserts the constraint NAME.
--
-- ⭐ WHY THE CLOSED-SET `deciding_stat` MATTERS MORE THAN IT LOOKS. An award is a PROMISE that a stat can be won.
-- An award naming a stat the system cannot resolve is a category with NO possible winner and NO error anywhere to
-- reveal it — it surfaces on stage, at the ceremony. The CHECK makes that UNREPRESENTABLE rather than merely
-- unlikely (AC1). The vocabulary is deliberately a SUPERSET of what gets seeded: it includes keys measured EMPTY
-- in the current all-1v1-wingman format (no_scope_kills, assists, flash_assists, mvps), because the format could
-- change and the schema should not need a migration when it does. The MEASUREMENT bites at the SEED
-- (lib/awards/catalog.ts's MEASURED_EMPTY assertion), not here.
create table award (
  id             bigint generated always as identity primary key,
  tournament_id  bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  name           text not null,
  bucket         text not null,
  class          text not null,
  deciding_stat  text not null,
  direction      text not null default 'max',
  secondary_stat text,                        -- FR-29 rung 1 tiebreak key (nullable)
  eff_num_key    text,                        -- FR-29 rung 2 efficiency ratio, integer keys (AD-19)
  eff_den_key    text,
  floor_rounds   int not null default 24,     -- FR-21 anti-farm floor (value-parity with 0021:56)
  floor_kills    int not null default 0,      -- 20 for rate awards (value-parity with 0021:56)
  priority       int not null,

  -- ── the four closed sets (SPINE:234 "closed-set text columns are CHECK-constrained enums") ──
  constraint award_bucket_valid    check (bucket    in ('skill', 'clutch', 'weird', 'comedy')),
  constraint award_class_valid     check (class     in ('rate', 'volume')),
  constraint award_direction_valid check (direction in ('max', 'min')),

  -- ⭐ THE DECIDING-STAT VOCABULARY. Every key resolves to a real `stat_row` column or a real `public.leaderboard`
  -- expression (0021). 6.2's snapshot carries these in AD-19 integer form ({num,den} for rates) and 6.4's Stage 2
  -- reads them, so a TYPO must be a constraint violation here, never a silently unwinnable award.
  -- ⚠ DUPLICATION SEAM, PINNED IN pgTAP: `public.award_stat_vocabulary()` below restates this same set for the
  -- RPC's typed `invalid_award` refusal (a CHECK can only raise 23514; the RPC owes a typed reason). The pgTAP
  -- suite asserts the two sets are IDENTICAL in BOTH directions, so a key added to one and not the other reddens.
  constraint award_deciding_stat_valid check (deciding_stat in (
    -- volume keys (integer totals)
    'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
    'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
    'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills',
    -- rate keys ({num, den} integer pairs — NEVER a float, AD-14/AD-19)
    'adr', 'hs_pct', 'kast_pct', 'entry_success'
  )),
  -- The same closed set, NULLABLE, for the three tiebreak keys (FR-29 rungs 1 and 2).
  constraint award_secondary_stat_valid check (secondary_stat is null or secondary_stat in (
    'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
    'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
    'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills',
    'adr', 'hs_pct', 'kast_pct', 'entry_success'
  )),
  constraint award_eff_num_key_valid check (eff_num_key is null or eff_num_key in (
    'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
    'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
    'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills',
    'adr', 'hs_pct', 'kast_pct', 'entry_success'
  )),
  constraint award_eff_den_key_valid check (eff_den_key is null or eff_den_key in (
    'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
    'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
    'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills',
    'adr', 'hs_pct', 'kast_pct', 'entry_success'
  )),

  -- ⭐ CLASS ↔ KEY COHERENCE — what makes `class` HONEST rather than decorative. A `rate` award's deciding stat
  -- must be one of the four rate keys; a `volume` award's must not be. This is precisely the discriminator 6.4's
  -- Stage 2 branches on (cross-multiply a {num,den} pair vs compare two integers), so a `class` that disagreed
  -- with its key would send the draw down the wrong arm with nothing to notice.
  --
  -- ⚠ WRITTEN AS TWO IMPLICATIONS, NOT AS A DISJUNCTION OF THE TWO LEGAL CASES. The disjunctive form
  -- (`(class='rate' and …) or (class='volume' and …)`) ALSO rejects a class outside the enum — which sounds
  -- harmless, but it means an out-of-enum class trips THIS constraint instead of `award_class_valid`, so
  -- `award_class_valid` becomes untrippable and its pgTAP test can only pass for the wrong reason (caught by the
  -- suite on the first run — exactly the overlapping-23514 trap the 4.3 review names). Each constraint now has
  -- exactly ONE responsibility: the enum is `award_class_valid`'s, the pairing is this one's, and each is
  -- independently reachable by a probe. Keep the implication form.
  constraint award_class_key_coherent check (
    (class <> 'rate'   or deciding_stat in ('adr', 'hs_pct', 'kast_pct', 'entry_success'))
    and
    (class <> 'volume' or deciding_stat not in ('adr', 'hs_pct', 'kast_pct', 'entry_success'))
  ),

  -- ⚠ NON-BLANK VIA `~ '[^[:space:]]'`, **NOT** `btrim(name) <> ''`. btrim() trims SPACES ONLY, so a lone TAB
  -- passes it — that exact bug shipped in Story 4.2 and was caught at review (0012_format_lock.sql). An award
  -- whose name is whitespace renders as an empty gold card at the ceremony.
  constraint award_name_not_blank    check (name ~ '[^[:space:]]'),
  constraint award_priority_positive check (priority > 0),
  constraint award_floors_non_negative check (floor_rounds >= 0 and floor_kills >= 0),

  constraint award_tournament_name_key unique (tournament_id, name),

  -- ⭐⭐ DEFERRABLE INITIALLY DEFERRED — LOAD-BEARING, not a style choice. A re-curation that SWAPS two awards'
  -- priorities is an ordinary edit and the first thing anyone will do. Against an IMMEDIATE unique index the
  -- intermediate state (both rows momentarily at the same priority) violates and the whole call 500s, so the
  -- admin would have to invent a three-step shuffle through a temporary priority. Deferring makes the END STATE
  -- the thing checked. A genuine duplicate still fails — just AT COMMIT (23505), which is exactly how the pgTAP
  -- negative test must be written. ⚠ It must be a table CONSTRAINT: `create unique index` cannot be deferred.
  constraint award_tournament_priority_key unique (tournament_id, priority) deferrable initially deferred
);

-- The spin order / catalog listing access path (SOLUTION-DESIGN.md:260). Distinct from the UNIQUE constraint's
-- implicit index only in that a deferrable unique constraint still builds one — this is kept because
-- SOLUTION-DESIGN names it and because the UNIQUE's index is the same shape; see the pgTAP shape assertions.
create index award_tournament_priority_idx on public.award (tournament_id, priority);

comment on table public.award is
  'FR-24 award catalog: one curated prize category per row. Identity is ADMIN-ONLY (AD-22) — anon/authenticated '
  'hold NO grant; the only fact a viewer may learn is public.award_catalog_count(). Story 6.8 opens a '
  'reveal-gated viewer policy keyed on spin.revealed_at; this migration ships the strictly-closed end state.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) Task 2 — RLS + grants: the AD-22 teeth.
-- ════════════════════════════════════════════════════════════════════════════
-- ENABLE **and** FORCE. The generic catalog guard in 0003_audit_snapshot_test.sql (Section A2) asserts that NO
-- public base table lacks FORCE — a missing FORCE reddens an EXISTING suite, by design. FORCE also makes the
-- policies apply to the table OWNER, closing the "owner quietly reads everything" gap.
alter table public.award enable row level security;
alter table public.award force  row level security;

-- Admin-only SELECT, mirroring `audit_admin_read` (0003:68) EXACTLY — including the `(select …)` wrapper, which
-- makes is_admin() an INITPLAN evaluated once per statement rather than once per row (the project-wide form).
-- ⚠ Like audit_log's, this policy is DORMANT defence-in-depth: with no table grant for `authenticated`, an admin
-- 42501s before RLS runs too. Admin surfaces read `award` through SERVER routes with the service key, never the
-- client Data API. It is here so that the day a grant IS added (6.8), the read is already correctly scoped.
create policy award_admin_read on public.award for select to authenticated using ((select public.is_admin()));

-- ⭐ THE AC4 MECHANISM: **NO anon / authenticated GRANT OF ANY KIND.** Deliberately absent, exactly as for
-- audit_log / app_role / stat_snapshot* (0003:82-84). A viewer's `select * from award` fails at the table-grant
-- gate with 42501 before a policy is consulted — the secrecy is the missing privilege, not the CSS blur.
-- service_role is the sole writer (AD-2). Unlike the append-only 0003 tables this one gets UPDATE and DELETE:
-- a catalog is CURATED (re-curation upserts and deletes-missing), which is what makes AC2's idempotency true by
-- construction. Identity PK (generated always as identity) ⇒ NO separate sequence grant (0003:77).
grant select, insert, update, delete on public.award to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (c) Task 3 — award_catalog_count: the ONE catalog fact a viewer may learn.
-- ════════════════════════════════════════════════════════════════════════════
-- It is `security definer` PRECISELY BECAUSE the caller has no grant on `award`. That is the whole point, and it
-- is also the whole danger: this function is reachable by `anon` BY DESIGN, so its body must NEVER select a
-- non-count column, and `search_path` must be pinned (a security-definer function with a loose search_path is the
-- standard privilege-escalation shape). The preamble below is byte-identical in form to the existing RPCs
-- (0017/0019/0020) — do not invent a new one.
--
-- ⛔ IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22. Returning a name, a bucket, a deciding stat or even an id
-- leaks award identity to every anonymous viewer through a function they are granted. Widening the CATALOG's
-- viewer surface is Story 6.8's job and it does it with a reveal-gated POLICY on the table, not by growing this.
create function public.award_catalog_count(p_tournament_id bigint) returns int
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select count(*)::int from public.award a where a.tournament_id = p_tournament_id;
$$;

comment on function public.award_catalog_count(bigint) is
  'AD-22: the ONLY catalog fact a non-admin may learn — how many awards exist. security definer because anon has '
  'no grant on award; the body must therefore never select a non-count column.';

-- Reachable by every client role: the locked "Posiciones de premios" block on /leaderboards renders `count`
-- generic rows from this integer alone.
revoke execute on function public.award_catalog_count(bigint) from public;
grant  execute on function public.award_catalog_count(bigint) to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (d) Task 4 — curate_award_catalog: the audited, idempotent admin command.
-- ════════════════════════════════════════════════════════════════════════════

-- The RPC's copy of the deciding-stat vocabulary, needed because a CHECK can only raise an untyped 23514 while
-- the RPC owes the admin a typed `invalid_award` refusal that has written NOTHING. ⚠ This is a DELIBERATE,
-- PINNED duplication of the `award_deciding_stat_valid` CHECK above: the pgTAP suite asserts the two sets are
-- identical in BOTH directions, so adding a key to one and not the other reddens a named test. A function cannot
-- be used inside the CHECK itself (a CHECK must be immutable over the row, and a function-backed CHECK is not
-- re-validated against existing rows on change) — so the literal list stays the constraint and this mirrors it.
create function public.award_stat_vocabulary(p_class text) returns text[]
  language sql
  immutable
  security invoker
  set search_path = ''
as $$
  select case p_class
    when 'rate' then array['adr', 'hs_pct', 'kast_pct', 'entry_success']
    when 'volume' then array[
      'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
      'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
      'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills'
    ]
    else array[
      'kills', 'deaths', 'assists', 'mvps', 'flash_assists', 'utility_damage',
      'knife_kills', 'wallbang_kills', 'through_smoke_kills', 'no_scope_kills', 'blind_kills',
      'entry_frags', 'opening_deaths', 'rounds_won', 'rounds_played', 'matches_played', 'hs_kills',
      'adr', 'hs_pct', 'kast_pct', 'entry_success'
    ]
  end;
$$;

-- Grants stated EXPLICITLY, like both sibling functions in this migration (6.1 code review — this one was
-- relying on the default). `create function` grants EXECUTE to PUBLIC, and anon/authenticated inherit from
-- PUBLIC, so "no grant line" silently means "reachable by every anonymous viewer". This function returns only
-- the static vocabulary — no award identity, so anon reachability is not an AD-22 leak — but in a migration whose
-- whole thesis is that reachability is decided by grants, the posture must be written down rather than inferred.
-- LEAST PRIVILEGE: `service_role` only. Its one caller is `curate_award_catalog` (security invoker, itself
-- granted to service_role alone), so nothing anon or authenticated has any reason to reach it.
revoke execute on function public.award_stat_vocabulary(text) from public;
grant  execute on function public.award_stat_vocabulary(text) to service_role;

-- `curate_award_catalog(tournament, actor, awards)` — DECLARATIVE, REPLACE-THE-WHOLE-CATALOG semantics: the
-- payload IS the catalog. It upserts on (tournament_id, name) and DELETES every award whose name the payload
-- omits. That is the same shape as re-parse (SPINE:232), and it is what makes AC2's idempotency true BY
-- CONSTRUCTION rather than by a de-dup check: re-sending the same 12 awards produces the same 12 rows, because
-- the end state is a pure function of the payload.
--
-- ⚠ EVERY GUARD RUNS BEFORE ANY WRITE **AND BEFORE ANY ROW LOCK** (the 4.2 lesson: a doomed call must not lock
-- rows and only then refuse). Typed refusals are RETURNED as {ok:false, reason}, never raised — the
-- 0016/0017/0019/0020 convention.
--
-- ⚠ `catalog_frozen` IS AN HONEST PARTIAL OF AD-15. The real ceremony lock needs the `ceremony` table, which does
-- not exist until Story 6.2. Testing `tournament.state in ('ceremony','closed')` is the closest true statement
-- this migration can make. Story 6.2 REPLACES this state test with the real lock (Epic-5 retro Action Item #2).
-- Do NOT invent a `ceremony_locked` column here to paper over the gap — a column 6.2 would have to migrate away
-- from is worse than a guard that is honest about what it checks.
create function public.curate_award_catalog(
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
  -- ══ GUARD 1 — no_tournament. A plain read; it takes NO lock (the next guards must be able to refuse without
  --    having locked anything).
  select t.state into v_state from public.tournament t where t.id = p_tournament_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_tournament');
  end if;

  -- ══ GUARD 2 — catalog_frozen. See the ⚠ above: the HONEST PARTIAL of AD-15 until 6.2 lands `ceremony`.
  if v_state in ('ceremony', 'closed') then
    return jsonb_build_object('ok', false, 'reason', 'catalog_frozen', 'state', v_state);
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

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default and anon/authenticated inherit from PUBLIC, so without this
-- REVOKE the catalog would be curatable straight off the Data API. Revoke first, then grant to the single writer
-- (0017:456-463 / 0019:408-415). The route's requireAdmin is the authorization gate; this is the second lock.
revoke execute on function public.curate_award_catalog(bigint, text, jsonb) from public;
grant  execute on function public.curate_award_catalog(bigint, text, jsonb) to service_role;
