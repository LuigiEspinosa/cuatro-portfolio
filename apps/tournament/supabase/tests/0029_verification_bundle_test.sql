-- supabase/tests/0029_verification_bundle_test.sql
-- pgTAP proof for migration 0029 (Story 6.9a): the ceremony acquires a DOCUMENT and a COMMITMENT,
-- and the document can never run ahead of the reveals (FR-27 / FR-30 · AD-22 · AD-6 · AD-7 · AD-17).
-- Run via: supabase test db. Runs inside a transaction and rolls back.
--
--   AC1  the bundle's posture: two never-OR'd policies AND the column grant, both directions -> Section A
--   AC1/AC6  ⭐ THE WALK — the SERVED set equals the revealed prefix EXACTLY, at every k       -> Section B
--   AC4  publish_bundle's typed refusals, one named test each                                 -> Section C
--   AC4  reveal_spin refuses bundle_not_published, with the positive control that ends it     -> Section D
--   AC10.1  luck_weight_table is FROZEN once the ceremony leaves not_started (IC910)           -> Section E
--   AC10.2  tournament publishes EIGHT of its NINE columns; fair_seed is the one omission      -> Section F
--   AC10.3/4  spin.label + bytes_consumed are WRITTEN; the two new CHECKs by NAME              -> Section G
--   DECISION I  the commitment is immutable once written (IC912)                               -> Section H
--   AC4  the audit row, asserted BY CONTENT                                                    -> Section I
--   —    ⭐ GUARD THE GUARDS: every closed set READ FROM ITS SOURCE, never from a literal      -> Section J
--   AC4  award_revealed_twice, with a REAL duplicate-award fixture                             -> Section K
--
-- ⚠⚠ WHY THE CORE ASSERTION IS A WALK AND NOT A SNAPSHOT. A single "after the reveal the bundle
-- shows the spin" test passes just as happily against a projection that serves everything. What
-- DECISION B actually claims is an EQUALITY that holds at every step: the served spin set IS the
-- revealed prefix — one entry MORE is exactly as much a failure as one fewer, and "one more" is the
-- direction that spoils a ceremony. Section B therefore reveals every spin one at a time and pins the
-- served counts after each, against a catalog that deliberately holds TWO awards no spin ever
-- decides, so "one entry more" is REPRESENTABLE and would be caught rather than being unfalsifiable.
--
-- ⚠⚠ FIVE INDEPENDENT CEREMONIES, AND THAT IS NOT TIDINESS. `reveal_spin` now refuses until a bundle
-- is published and `publish_bundle` refuses once one exists, so a ceremony can be in exactly ONE of
-- these test's states at a time. Driving every section off one fixture would mean most assertions ran
-- against a COMPLETE ceremony and passed by returning `ceremony_not_spinning` — fourteen green tests
-- measuring one guard. That is precisely the vacuity 6.8b's review found and `6-8b:921` names.
--
-- ⚠ EVERY REFUSAL GOES THROUGH A `pg_temp.probe_*` HELPER, which catches `when others` and returns
-- the SQLSTATE as text. Without it a mutant that RAISES where the shipped function RETURNS would
-- abort the whole transaction and take every later test with it — the file would go red in a way that
-- says nothing about which guard broke (the 6.1 pattern, `6-2:139`).
--
-- ⚠ MUTATION-TESTED BY EXECUTION before review (the standing project rule + Epic-5 retro Action
-- Item #3), with a CONTROL PASS on unmutated source first. The matrix is in the story's Completion
-- Notes, survivors included.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

-- ⚠⚠ THE PER-SECTION COUNTS BELOW ARE THE ONLY MECHANISM FOR SPOTTING AN ASSERTION ADDED OR LOST
-- WITHOUT THE PLAN BEING UPDATED, and it only works if they RECONCILE. 6.8b's review measured its
-- banners summing to 73 against `select plan(76)` — and the suite still PASSED, because `plan()`
-- counts only the total. Every number below was derived by COUNTING the assertion calls in the
-- section, and the accounting is restated in the story's Completion Notes.
--
-- ⚠ THE FIRST DRAFT OF THIS BANNER READ `plan(89)` WITH A 21 AND B 13, AND IT WAS WRONG BY TWO —
-- caught because pgTAP reports "planned 89 but ran 91", which is the ONLY way a miscounted banner
-- ever surfaces. 6.8b's suite summed to 73 against `plan(76)` and PASSED, because `plan()` compares
-- only the total and a stale per-section banner costs nothing. The numbers below were re-derived by
-- COUNTING the assertion calls per section after that failure, not by adjusting the total to match.
--
--   A 22 — the table exists (1) · its column set EXACTLY (1) · ENABLE + FORCE (2) · the exact policy
--          set by name (1) · both are SELECT policies (1) · the viewer role split (1) · the admin
--          policy carries the (select …) init-plan wrap (1) · ⭐ the COLUMN gate in BOTH directions
--          for BOTH client roles: table-wide SELECT FALSE (2) · any-column SELECT TRUE (2) · all
--          seven published columns granted (2) · NONE of the four secret columns granted (2) · no
--          any-column write (2) · service_role holds select+insert+update (1) and NO delete (1) ·
--          the two functions' security mode (1) · their EXECUTE matrix (1).
--   B 14 — ⭐ THE WALK: persist (1) · publish (1) · the commitment IS served at k=0 (1) · ZERO
--          spin_plan and ZERO awards served at k=0 (2) · `pity` is ABSENT, not blanked (1) · the four
--          accepted reveals (4) · the served counts after reveals 1, 2 and 3 (3) · and the full
--          document at `complete`, identical to the stored payload (1). [6 + 4 + 3 + 1 = 14]
--   C 15 — every typed refusal through the probe on an INDEPENDENT ceremony: no_ceremony ·
--          ceremony_not_spinning while `locked` · non_ascii_payload · bundle_mismatch ·
--          payload_shape (not JSON) · payload_shape (wrong key set) · payload_shape (describes
--          ANOTHER ceremony) · seed_mismatch · algo_version_mismatch · unknown_actor on NULL ·
--          unknown_actor on an unknown id · reveal_in_progress (1) · every refusal wrote NOTHING (1)
--          · ⭐ the positive control that a well-formed bundle IS accepted (1) · already_published (1).
--   D  6 — reveal_spin refuses bundle_not_published on a spinning, persisted, UNPUBLISHED ceremony ·
--          it wrote nothing (no revealed_at, no feed row) · ⭐ the SAME call succeeds once the bundle
--          is published — the positive control without which the first assertion holds for ANY body
--          of the guard · and the refusal names the ceremony. ⭐⭐ PLUS the two added after T8's M05
--          SURVIVED: four bundle rows exist, three published and one STAGED (1), and anon sees
--          exactly the three (1) — the row on the viewer policy's FALSE side, without which
--          `using (true)` is unkillable.
--   E  4 — IC910 on a luck_weight_table edit while `spinning` · the message names the column · the
--          same edit is PERMITTED while `not_started` (the row on the predicate's FALSE side, without
--          which the freeze is indistinguishable from an unconditional one) · and an unrelated
--          ceremony UPDATE is still permitted (the freeze is not a column allowlist — 0027's
--          DECISION 4).
--   F  7 — tournament has exactly NINE columns (1) · anon holds NO table-wide SELECT (1) · anon holds
--          SELECT on all EIGHT published columns (1) · anon does NOT hold it on fair_seed (1) · the
--          same two facts for `authenticated` (2) · ⭐ grace_period_seconds specifically is still
--          granted (1) — the 0015-after-0002 column whose omission silently kills the 4.5 timer.
--   G  8 — spin.label and spin.bytes_consumed exist (2) · persist_ceremony WROTE a label on every
--          spin (1) and the right bytes on spin 1 (1) · the pity stream is attributed to the FIRST
--          consolation spin only (1) · spin_index_positive refuses 0 BY NAME (1) ·
--          spin_bytes_consumed_non_negative refuses -1 BY NAME (1) · ⭐ and ADMITS NULL (1) — the
--          disjunct without which this migration could not apply to a non-empty spin table at all.
--   H  5 — IC912 on rewriting payload_canonical · on rewriting bundle_sha256 · on un-publishing ·
--          a no-op re-write of the SAME value is PERMITTED (the `is distinct from` half) · and
--          released_at NULL -> value is permitted once.
--   I  4 — exactly one publish_bundle audit row · its before/after key sets EXACTLY (2) · and its
--          after block carries the COMMITTED hash, not the claimed one.
--   J  6 — ⭐ the refusal set read from publish_bundle's OWN prosrc · the granted column set read
--          from information_schema.column_privileges for BOTH client roles · the policy set read from
--          pg_policy · ⭐ verification_bundle_read's owner carries rolbypassrls · ⭐⭐ `ceremony`'s
--          granted column array is UNCHANGED — the positive proof of DECISION E · and `ceremony`'s
--          column set is unchanged, so bundle_sha256 did NOT land there.
--   K  2 — award_revealed_twice on a real duplicate-award fixture · and it wrote nothing.
--
-- ⛔⛔ RECONCILED BY THE 6.9a CODE REVIEW, AND THE FAILURE IT FOUND IS THE ONE THIS BLOCK EXISTS TO
-- PREVENT. The suite shipped with `plan(93)` and an accounting line that was CORRECT, against body
-- banners reading A 21, B 13 and D 4 — which sum to 89, with a third number (91) in the probe-helper
-- comment. The accounting block had been re-derived after 6.8b's failure and the BANNERS HAD NOT, so
-- the file's own claim that "the per-section counts are the ONLY mechanism for spotting an assertion
-- added or lost, and it only works if they RECONCILE" was false at the moment of commit, and
-- Completion Notes ⓶T5's "the accounting RECONCILES" was false with it. `plan()` compares only the
-- total, so nothing went red.
--   ⚠ THE COUNTS BELOW WERE MACHINE-COUNTED, not re-read: every `select <pgtap-assertion>(` in the
--   body, grouped by section banner. `throws_like` is an assertion and was missing from the first
--   hand count — which is precisely how A and G were mis-tallied in the first place.
--   ⛔ If you add or remove an assertion, change BOTH this line and the section's banner, or the
--   mechanism is gone again.
--
-- The delta from 93 to 109 is this review's own work: B +5 (the served set asserted BY IDENTITY not
-- only by cardinality, the two identity guards only TB can express with their wrote-nothing check, and the FOUR the mutation pass forced: TB gained a SECOND pity spin so the partial-reveal window exists at all, and winless truncation is asserted inside it),
-- C +2 (the two length-preserving identity guards), D +3 (the positive control split into two statements
-- so it no longer depends on `||` operand evaluation order, plus the bundle_published guard and its wrote-nothing check), E +1 (weights changed in the SAME statement
-- as the lock), G +1 (the two new spin columns' anon grant surface, read from information_schema).
-- plan(109) = A 22 + B 23 + C 17 + D 9 + E 5 + F 7 + G 9 + H 5 + I 4 + J 6 + K 2:
select plan(109);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into season (name) values ('Season 1');

insert into player (steamid64, display_name) values
  ('76561198000000011', 'Ana'),
  ('76561198000000022', 'Beto'),
  ('76561198000000033', 'Caro'),
  ('76561198000000044', 'Dani');

-- One builder for five near-identical tournaments. Each gets its own roster, catalog, snapshot and
-- `locked` ceremony, so the sections cannot interfere through shared state.
create function pg_temp.make_tournament(p_name text, p_seed text, p_awards int) returns void
language plpgsql as $$
declare v_t bigint; v_s bigint;
begin
  insert into public.tournament (season_id, name)
    values ((select id from public.season where name = 'Season 1'), p_name)
    returning id into v_t;

  insert into public.roster_entry (tournament_id, steamid64)
  select v_t, s from (values ('76561198000000011'), ('76561198000000022'),
                             ('76561198000000033'), ('76561198000000044')) as v(s);

  insert into public.award (tournament_id, name, bucket, class, deciding_stat, priority)
  select v_t, v.n, v.b, 'volume', v.d, v.p
    from (values ('Cuchillero', 'weird', 'knife_kills',    1),
                 ('Muralla',    'skill', 'wallbang_kills', 2),
                 ('Cegador',    'weird', 'flash_assists',  3),
                 ('Fantasma',   'weird', 'no_scope_kills', 4),
                 ('Espectro',   'skill', 'entry_frags',    5)) as v(n, b, d, p)
   where v.p <= p_awards;

  insert into public.stat_snapshot (tournament_id, content_sha256)
    values (v_t, p_seed) returning id into v_s;

  insert into public.stat_snapshot_row (snapshot_id, steamid64, stats_int, h2h, achievement_ts,
                                        rounds_played, kills, idle_dq)
  select v_s, v.sid,
         jsonb_build_object('volume', jsonb_build_object('knife_kills', v.k),
                            'rate', jsonb_build_object('adr',
                              jsonb_build_object('num', 1234, 'den', 10))),
         '{}'::jsonb, null, 12, 5, false
    from (values ('76561198000000011', 3), ('76561198000000022', 2),
                 ('76561198000000033', 1), ('76561198000000044', 0)) as v(sid, k);

  insert into public.ceremony (tournament_id, state, seed_demo_sha256, snapshot_id, started_at)
    values (v_t, 'locked', p_seed, v_s, now());
end;
$$;

-- ⭐ THE WALK'S TOURNAMENT (TB). Four spins, chosen so the served set moves DIFFERENTLY on each axis
-- and a single wrong join cannot satisfy all five checkpoints:
--   spin 1  main  · award A · 1 winner
--   spin 2  main  · award B · 0 winners  (no_eligible_players — the COMMON case at the shipped floors)
--   spin 3  main  · award C · 2 winners  (FR-29 rung 5, shared)
--   spin 4  pity  · NO award · 1 winner  (the consolation, whose draw lives in the `pity` key)
-- …and TWO further awards, 'Fantasma' and 'Espectro', that no spin ever decides.
select pg_temp.make_tournament('TB',  repeat('b', 64), 5);
select pg_temp.make_tournament('TB2', repeat('c', 64), 1);   -- Section C, the refusals
select pg_temp.make_tournament('TB3', repeat('d', 64), 1);   -- Section D, the reveal guard
select pg_temp.make_tournament('TB4', repeat('e', 64), 1);   -- Section K, the duplicate award
select pg_temp.make_tournament('TB5', repeat('f', 64), 1);   -- Section E, the freeze

-- TB5's ceremony is rewound to `not_started` so Section E has a row on the predicate's FALSE side.
-- ⚠ Done by DELETE + INSERT rather than by UPDATE: `assert_ceremony_transition` refuses every
-- backward step with IC910, which is the trigger this section is about to test.
delete from ceremony where tournament_id = (select id from tournament where name = 'TB5');
insert into ceremony (tournament_id, state) values
  ((select id from tournament where name = 'TB5'), 'not_started');

-- ⚠ FIXTURE IDS ARE RE-DERIVED BY NAME THROUGH A VIEW, never by `limit 1` — the house rule since 6.1.
-- A `limit 1` without an ORDER BY is a coin flip the day a second row exists, and every one of these
-- ids is a join key three sections lean on.
create temporary view f as
select t.name,
       t.id                                                            as tournament_id,
       c.id                                                            as ceremony_id,
       c.snapshot_id                                                   as snapshot_id,
       c.seed_demo_sha256                                              as seed_hex,
       (select a.id from award a where a.tournament_id = t.id and a.priority = 1) as award_a,
       (select a.id from award a where a.tournament_id = t.id and a.priority = 2) as award_b,
       (select a.id from award a where a.tournament_id = t.id and a.priority = 3) as award_c
  from tournament t
  join ceremony c on c.tournament_id = t.id;

create temporary view admin_sid as select '76561198000000011'::text as sid;

-- ── helpers ──────────────────────────────────────────────────────────────────
--
-- ⚠ `pg_temp.probe_*` EXISTS SO A **RAISING** MUTANT REDDENS ONE NAMED TEST INSTEAD OF ABORTING THE
-- TRANSACTION. Every refusal below is supposed to be RETURNED; a mutant that turns one into a RAISE
-- would otherwise kill the transaction and take all 109 assertions with it, which reads as "everything
-- broke" rather than "this guard broke".
create function pg_temp.probe_publish(p_ceremony bigint, p_payload text, p_sha text, p_actor text)
returns text language plpgsql as $$
declare r jsonb;
begin
  select public.publish_bundle(p_ceremony, p_payload, p_sha, p_actor) into r;
  if coalesce((r ->> 'ok')::boolean, false) then return 'ok'; end if;
  return coalesce(r ->> 'reason', '<no reason>');
exception when others then
  return 'RAISED:' || sqlstate;
end;
$$;

-- ⭐ Added by the 6.9a code review, for the `bundle_published` guard it added to persist_ceremony.
create function pg_temp.probe_persist(p_ceremony bigint, p_run jsonb, p_actor text, p_replace boolean)
returns text language plpgsql as $$
declare r jsonb;
begin
  select public.persist_ceremony(p_ceremony, p_run, p_actor, p_replace) into r;
  if coalesce((r ->> 'ok')::boolean, false) then return 'ok'; end if;
  return coalesce(r ->> 'reason', '<no reason>');
exception when others then
  return 'RAISED:' || sqlstate;
end;
$$;

create function pg_temp.probe_reveal(p_ceremony bigint, p_index int, p_actor text)
returns text language plpgsql as $$
declare r jsonb;
begin
  select public.reveal_spin(p_ceremony, p_index, p_actor) into r;
  if coalesce((r ->> 'ok')::boolean, false) then return 'ok'; end if;
  return coalesce(r ->> 'reason', '<no reason>');
exception when others then
  return 'RAISED:' || sqlstate;
end;
$$;

-- The number of entries the PROJECTION serves — the two numbers the walk turns on. ⚠ `-1` on absence
-- rather than 0: "the key is missing" and "the key is an empty array" are different facts, and B2
-- turns on exactly that difference.
create function pg_temp.served_spins(p_ceremony bigint) returns int language sql stable as $$
  select coalesce(jsonb_array_length(
    public.verification_bundle_read(p_ceremony) -> 'bundle' -> 'spin_plan'), -1);
$$;
create function pg_temp.served_awards(p_ceremony bigint) returns int language sql stable as $$
  select coalesce(jsonb_array_length(
    public.verification_bundle_read(p_ceremony) -> 'bundle' -> 'awards'), -1);
$$;

-- One main spin's run payload, parameterised so four ceremonies can share it.
create function pg_temp.one_spin_run(p_ceremony bigint) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'seed_hex', (select seed_hex from f where ceremony_id = p_ceremony),
    'spin_plan', jsonb_build_array(jsonb_build_object(
      'spin', 1, 'pool', jsonb_build_array((select award_a from f where ceremony_id = p_ceremony)::text),
      'live_count', 1)),
    'spins', jsonb_build_array(jsonb_build_object(
      'spin_index', 1, 'kind', 'main', 'label', 'inclusivcup/v1/stage1/spin/1',
      'bytes_consumed', 2,
      'live_award_ids', jsonb_build_array((select award_a from f where ceremony_id = p_ceremony)::text),
      'results', jsonb_build_array(jsonb_build_object(
        'award_id', (select award_a from f where ceremony_id = p_ceremony)::text,
        'outcome_kind', 'winner', 'deciding_value', '3',
        'winners', jsonb_build_array('76561198000000011'))))));
$$;

-- The BUNDLE the commitment is taken over. ⚠ Built FROM THE DATABASE, exactly as the Go builder is,
-- so a change to the fixtures cannot leave the document describing a ceremony that no longer exists.
--
-- ⛔⛔ THESE BYTES ARE **NOT** RFC-8785 CANONICAL, AND THE 6.9a CODE REVIEW ASKS YOU TO READ THAT
-- AS A DELIBERATE SCOPE BOUNDARY RATHER THAN A BUG. `jsonb::text` emits `{"a": 1, "b": 2}` — a
-- space after every `:` and `,`, and jsonb's own length-then-byte key order — which violates
-- §3.2.1 (no insignificant whitespace) and §3.2.3 (UTF-16 code-unit key order).
--
-- ⚠ AND `publish_bundle` ACCEPTS THEM, because it verifies that `sha256(p_payload)` equals
-- `p_bundle_sha256` and that the DOCUMENT is well-formed — it does NOT and CANNOT verify that the
-- bytes are canonical: there is no JCS canonicalizer in PL/pgSQL, and writing a second one in a
-- fourth runtime would be a fourth thing to keep in step. Canonicality is the PRODUCER's
-- obligation, proven by the gate-4 vector across the three runtimes that do implement it.
--
-- ⛔ THE CONSEQUENCE, STATED SO NOBODY MISTAKES THIS SUITE FOR A CANONICALITY PROOF: a producer
-- that emitted correctly-hashed but non-canonical bytes would publish successfully here, and every
-- viewer re-canonicalizing the served document would compute a different SHA-256 and be told the
-- ceremony was rigged. Nothing in SQL can catch that. What catches it is
-- `TestCanonEndToEndBundleRow` and its Vitest mirror, which canonicalize the REAL published
-- document and compare bytes — so if you weaken those, this boundary has no cover at all.
create function pg_temp.bundle_text(p_ceremony bigint) returns text language sql stable as $$
  select jsonb_build_object(
    'algo_version', 'inclusivcup-roulette-1.0.0',
    'seed_hex', (select c.seed_demo_sha256 from public.ceremony c where c.id = p_ceremony),
    'luck', jsonb_build_object('weight_table',
      to_jsonb((select c.luck_weight_table from public.ceremony c where c.id = p_ceremony))),
    'spin_plan', (
      select jsonb_agg(
               jsonb_build_object('spin', s.spin_index, 'kind', s.kind,
                                  'label', s.label, 'bytes_consumed', s.bytes_consumed)
               || case when s.kind = 'main'
                       then jsonb_build_object('live_count', 1,
                              'pool', s.live_award_ids, 'live', s.live_award_ids,
                              'weights', jsonb_build_array(100), 'total_weight', 100,
                              'draws', jsonb_build_array())
                       else '{}'::jsonb end
               order by s.spin_index)
        from public.spin s where s.ceremony_id = p_ceremony),
    'awards', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 -- ⛔ NO `name` — DECISION N, ratified at the 6.9a code review (2026-08-09). The
                 -- fixture carried `a.name` while the Go builder deliberately omits it, so the two
                 -- documents had different shapes and this suite could never have caught the
                 -- difference. Dropped so the fixture models what the producer actually publishes.
                 'award_id', a.id::text, 'bucket', a.bucket, 'class', a.class,
                 'deciding_stat', a.deciding_stat, 'direction', a.direction,
                 'floor_rounds', a.floor_rounds, 'floor_kills', a.floor_kills,
                 'priority', a.priority,
                 'outcome_kind', ar.outcome_kind, 'is_shared', ar.is_shared, 'is_pity', ar.is_pity,
                 'winners', coalesce((select jsonb_agg(re.steamid64 order by re.steamid64)
                                        from public.award_result_winner w
                                        join public.roster_entry re on re.id = w.winner_entry_id
                                       where w.award_result_id = ar.id), '[]'::jsonb))
               order by a.priority)
        from public.award_result ar
        join public.spin s on s.id = ar.spin_id
        join public.award a on a.id = ar.award_id
       where s.ceremony_id = p_ceremony), '[]'::jsonb),
    -- ⛔ DERIVED FROM THE PITY SPINS, NOT HARD-CODED — corrected by the 6.9a code review. This block
    -- was a fixed literal naming ONE consolation winner, while four of the five fixture ceremonies
    -- (TB2/TB3/TB4/TB5, built by `one_spin_run`) have NO pity spin at all. The document therefore
    -- claimed a consolation phase those ceremonies never had, and nothing noticed until
    -- `publish_bundle` gained a guard that bounds `reveal_order` against the real pity-spin count.
    -- ⚠ That is the fixture failing the principle stated four lines above it — "built FROM THE
    -- DATABASE, exactly as the Go builder is, so a change to the fixtures cannot leave the document
    -- describing a ceremony that no longer exists". It now honours it.
    -- ⚠ `winless` and `reveal_order` are the SAME set here (a permutation of itself is a legal
    -- permutation); the ORDERING difference between them is the engine's business, not this
    -- fixture's, and Section B asserts the projection's truncation separately.
    'pity', jsonb_build_object(
      'label', 'inclusivcup/v1/pity',
      'winless', coalesce((
        select jsonb_agg(re.steamid64 order by re.steamid64)
          from public.spin s
          join public.award_result ar on ar.spin_id = s.id
          join public.award_result_winner w on w.award_result_id = ar.id
          join public.roster_entry re on re.id = w.winner_entry_id
         where s.ceremony_id = p_ceremony and s.kind = 'pity'), '[]'::jsonb),
      'reveal_order', coalesce((
        select jsonb_agg(re.steamid64 order by s.spin_index)
          from public.spin s
          join public.award_result ar on ar.spin_id = s.id
          join public.award_result_winner w on w.award_result_id = ar.id
          join public.roster_entry re on re.id = w.winner_entry_id
         where s.ceremony_id = p_ceremony and s.kind = 'pity'), '[]'::jsonb),
      'draws', '[]'::jsonb,
      'bytes_consumed', coalesce((
        select sum(s.bytes_consumed)::int from public.spin s
         where s.ceremony_id = p_ceremony and s.kind = 'pity'), 0)),
    'players', (
      select jsonb_agg(
               jsonb_build_object('steamid64', r.steamid64,
                                  'rounds_played', r.rounds_played::text,
                                  'kills', r.kills::text,
                                  'idle_dq', r.idle_dq,
                                  'achievement_ts', '-1')
               order by r.steamid64)
        from public.stat_snapshot_row r
       where r.snapshot_id = (select c.snapshot_id from public.ceremony c where c.id = p_ceremony))
  )::text;
$$;

-- ⭐ Publish a DELIBERATELY MANGLED document and return its typed reason. It re-hashes the mangled
-- bytes, so `bundle_mismatch` can never be why a caller's assertion passes — every such row must
-- fail on the guard it is named for. Added by the 6.9a code review with the identity guards.
create function pg_temp.publish_mangled(p_ceremony bigint, p_doc jsonb) returns text
  language sql volatile as $$
  select pg_temp.probe_publish(
           p_ceremony, p_doc::text,
           encode(sha256(convert_to(p_doc::text, 'UTF8')), 'hex'),
           (select sid from admin_sid));
$$;

create function pg_temp.bundle_sha(p_ceremony bigint) returns text language sql stable as $$
  select encode(sha256(convert_to(pg_temp.bundle_text(p_ceremony), 'UTF8')), 'hex');
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — the posture this migration OPENS. 22 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select has_table('public', 'verification_bundle', 'verification_bundle exists (AC1)');

-- ⚠ EXACT, so a speculatively added column reddens here rather than shipping ungranted and unnoticed
-- — the same discipline `0024_test:430-435` applies to `ceremony`.
select columns_are('public', 'verification_bundle',
  array['id', 'tournament_id', 'ceremony_id', 'snapshot_id', 'seed_demo_sha256',
        'algorithm_version', 'bundle_sha256', 'payload_canonical', 'payload',
        'published_at', 'released_at'],
  'verification_bundle carries EXACTLY the AC1 columns');

select is((select relrowsecurity from pg_class where oid = 'public.verification_bundle'::regclass),
  true, 'verification_bundle has RLS ENABLED');
select is((select relforcerowsecurity from pg_class where oid = 'public.verification_bundle'::regclass),
  true, 'verification_bundle has RLS FORCED (the owner is not exempt)');

select is(
  (select array_agg(polname order by polname) from pg_policy
    where polrelid = 'public.verification_bundle'::regclass),
  array['verification_bundle_admin_read', 'verification_bundle_viewer_read']::name[],
  'EXACTLY two policies, read from pg_policy — never OR''d into one (0002:87-98)');

select is(
  (select count(*)::int from pg_policy
    where polrelid = 'public.verification_bundle'::regclass and polcmd = 'r'),
  2, 'both policies are SELECT policies');

select is(
  (select array_agg(ro.rolname order by ro.rolname)
     from pg_policy p, unnest(p.polroles) r(oid) join pg_roles ro on ro.oid = r.oid
    where p.polrelid = 'public.verification_bundle'::regclass
      and p.polname = 'verification_bundle_viewer_read'),
  array['anon', 'authenticated']::name[],
  'the VIEWER policy names anon + authenticated');

select matches(
  (select pg_get_expr(polqual, polrelid) from pg_policy
    where polrelid = 'public.verification_bundle'::regclass
      and polname = 'verification_bundle_admin_read'),
  'SELECT is_admin',
  'the admin policy carries the (select …) init-plan wrap');

-- ⭐ THE COLUMN GATE, IN BOTH DIRECTIONS, FOR BOTH CLIENT ROLES. `6-8b:920` recorded that its
-- equivalent guard covered `anon` ONLY, so a grant to `authenticated` was invisible to it. Closed here.
select is(has_table_privilege('anon', 'public.verification_bundle', 'SELECT'), false,
  'anon holds NO table-wide SELECT on verification_bundle');
select is(has_table_privilege('authenticated', 'public.verification_bundle', 'SELECT'), false,
  'authenticated holds NO table-wide SELECT on verification_bundle');

select is(has_any_column_privilege('anon', 'public.verification_bundle', 'SELECT'), true,
  'anon DOES hold a column-scoped SELECT (the grant exists at all)');
select is(has_any_column_privilege('authenticated', 'public.verification_bundle', 'SELECT'), true,
  'authenticated DOES hold a column-scoped SELECT');

select is(
  (select bool_and(has_column_privilege('anon', 'public.verification_bundle', c, 'SELECT'))
     from unnest(array['id', 'tournament_id', 'ceremony_id', 'algorithm_version',
                       'bundle_sha256', 'published_at', 'released_at']) c),
  true, 'anon reads all SEVEN published columns — the commitment is public the instant it exists');
select is(
  (select bool_and(has_column_privilege('authenticated', 'public.verification_bundle', c, 'SELECT'))
     from unnest(array['id', 'tournament_id', 'ceremony_id', 'algorithm_version',
                       'bundle_sha256', 'published_at', 'released_at']) c),
  true, 'authenticated reads all SEVEN published columns');

-- ⛔ THE LOAD-BEARING HALF. `payload` and `payload_canonical` are the whole document; `snapshot_id`
-- points at the frozen inputs every winner is computable from.
select is(
  (select bool_or(has_column_privilege('anon', 'public.verification_bundle', c, 'SELECT'))
     from unnest(array['payload', 'payload_canonical', 'snapshot_id', 'seed_demo_sha256']) c),
  false, 'anon reads NONE of the four secret columns — the CONTENT is not published with the hash');
select is(
  (select bool_or(has_column_privilege('authenticated', 'public.verification_bundle', c, 'SELECT'))
     from unnest(array['payload', 'payload_canonical', 'snapshot_id', 'seed_demo_sha256']) c),
  false, 'authenticated reads NONE of the four secret columns');

-- ⚠ DELETE IS NOT A COLUMN-LEVEL PRIVILEGE IN POSTGRESQL — `has_any_column_privilege(…, 'DELETE')`
-- raises `unrecognized privilege type`, which aborts the transaction rather than failing one test.
-- Only INSERT, UPDATE, SELECT and REFERENCES are column-scopable, so DELETE is checked at the TABLE
-- level where it actually lives. (Measured, not assumed: the first draft of this file used the
-- column form and took the whole suite down with it.)
select is(
  (select bool_or(has_any_column_privilege('anon', 'public.verification_bundle', p))
     from unnest(array['INSERT', 'UPDATE']) p)
  or has_table_privilege('anon', 'public.verification_bundle', 'DELETE'),
  false, 'anon holds NO write privilege on any column, and no DELETE on the table');
select is(
  (select bool_or(has_any_column_privilege('authenticated', 'public.verification_bundle', p))
     from unnest(array['INSERT', 'UPDATE']) p)
  or has_table_privilege('authenticated', 'public.verification_bundle', 'DELETE'),
  false, 'authenticated holds NO write privilege on any column, and no DELETE on the table');

select is(
  (select bool_and(has_table_privilege('service_role', 'public.verification_bundle', p))
     from unnest(array['SELECT', 'INSERT', 'UPDATE']) p),
  true, 'service_role holds select+insert+update (the sole writer, AD-2)');
select is(has_table_privilege('service_role', 'public.verification_bundle', 'DELETE'), false,
  'service_role holds NO DELETE — a commitment is not deleted (0024:250-253''s posture)');

select is(
  (select array_agg(p.prosecdef order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('publish_bundle', 'verification_bundle_read')),
  array[false, true],
  'publish_bundle is security INVOKER; verification_bundle_read is DEFINER (B11/DECISION C)');

select is(
  array[
    has_function_privilege('anon', 'public.publish_bundle(bigint,text,text,text)', 'EXECUTE'),
    has_function_privilege('service_role', 'public.publish_bundle(bigint,text,text,text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.verification_bundle_read(bigint)', 'EXECUTE')],
  array[false, true, true],
  'publish_bundle is service-role-only; the projection is anon-reachable BY DESIGN');

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — ⭐ THE WALK, on ceremony TB. 23 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select lives_ok(
  format($$ select public.persist_ceremony(%s, %L::jsonb, %L, false) $$,
    (select ceremony_id from f where name = 'TB'),
    jsonb_build_object(
      'seed_hex', (select seed_hex from f where name = 'TB'),
      'spin_plan', jsonb_build_array(
        jsonb_build_object('spin', 1, 'live_count', 1, 'pool', jsonb_build_array(
          (select award_a from f where name = 'TB')::text,
          (select award_b from f where name = 'TB')::text,
          (select award_c from f where name = 'TB')::text)),
        jsonb_build_object('spin', 2, 'live_count', 1, 'pool', jsonb_build_array(
          (select award_b from f where name = 'TB')::text,
          (select award_c from f where name = 'TB')::text)),
        jsonb_build_object('spin', 3, 'live_count', 1, 'pool', jsonb_build_array(
          (select award_c from f where name = 'TB')::text))),
      'spins', jsonb_build_array(
        jsonb_build_object('spin_index', 1, 'kind', 'main',
          'label', 'inclusivcup/v1/stage1/spin/1', 'bytes_consumed', 2,
          'live_award_ids', jsonb_build_array((select award_a from f where name = 'TB')::text),
          'results', jsonb_build_array(jsonb_build_object(
            'award_id', (select award_a from f where name = 'TB')::text,
            'outcome_kind', 'winner', 'deciding_value', '3',
            'winners', jsonb_build_array('76561198000000011')))),
        jsonb_build_object('spin_index', 2, 'kind', 'main',
          'label', 'inclusivcup/v1/stage1/spin/2', 'bytes_consumed', 2,
          'live_award_ids', jsonb_build_array((select award_b from f where name = 'TB')::text),
          'results', jsonb_build_array(jsonb_build_object(
            'award_id', (select award_b from f where name = 'TB')::text,
            'outcome_kind', 'no_eligible_players', 'winners', jsonb_build_array()))),
        jsonb_build_object('spin_index', 3, 'kind', 'main',
          'label', 'inclusivcup/v1/stage1/spin/3', 'bytes_consumed', 1,
          'live_award_ids', jsonb_build_array((select award_c from f where name = 'TB')::text),
          'results', jsonb_build_array(jsonb_build_object(
            'award_id', (select award_c from f where name = 'TB')::text,
            'outcome_kind', 'shared', 'deciding_value', '1', 'tie_ladder_exit_step', 5,
            'winners', jsonb_build_array('76561198000000022', '76561198000000033')))),
        jsonb_build_object('spin_index', 4, 'kind', 'pity',
          'label', 'inclusivcup/v1/pity', 'bytes_consumed', 3,
          'live_award_ids', jsonb_build_array(),
          'results', jsonb_build_array(jsonb_build_object(
            'outcome_kind', 'winner', 'winners', jsonb_build_array('76561198000000044')))),
        -- ⭐⭐ A **SECOND** PITY SPIN, ADDED BY THE 6.9a CODE REVIEW'S MUTATION PASS, AND THE REASON
        -- IS THE WHOLE POINT OF RUNNING ONE. The review changed `verification_bundle_read` to
        -- TRUNCATE `winless` to the revealed prefix (Cuatro's call: the old code served it whole
        -- beside a truncated `reveal_order`, so the last consolation winner was one set-subtraction
        -- away). With ONE pity spin that change is STRUCTURALLY UNTESTABLE: before its reveal the
        -- whole `pity` block is absent, and after it the ceremony is complete and the FULL document
        -- is released — the partial window `0 < revealed < total` never exists. The mutation pass
        -- proved it: reverting the truncation SURVIVED 105 green assertions. Two pity spins open
        -- that window, and the assertion below occupies it.
        -- ⚠ `bytes_consumed` 0, and that is the CORRECT modelling rather than a convenience to keep
        -- Section G's total at 8: FR-28 draws the whole consolation order from ONE stream, so the
        -- byte cost belongs to the spin that OPENED it. 6.8a's code review fixed exactly the
        -- opposite defect — every pity spin carrying the whole stream's total, making
        -- sum(bytes_consumed) report 28 x 27 = 756 for a 27-byte stream — and Section G asserts the
        -- attribution. A second pity spin with a non-zero count would re-introduce it.
        jsonb_build_object('spin_index', 5, 'kind', 'pity',
          'label', 'inclusivcup/v1/pity', 'bytes_consumed', 0,
          'live_award_ids', jsonb_build_array(),
          'results', jsonb_build_array(jsonb_build_object(
            'outcome_kind', 'winner', 'winners', jsonb_build_array('76561198000000011')))))
    )::text,
    (select sid from admin_sid)),
  'the run persists — four spins, and the walk is taken over them');

-- ⭐⭐ TWO IDENTITY GUARDS FROM THE 6.9a CODE REVIEW, RUN HERE AND NOT IN SECTION C, because TB is
-- the only fixture on which either is REPRESENTABLE: four spins (so a duplicate can exist without
-- breaking the count) and one pity spin (so there is a consolation order to permute). They run
-- BEFORE the publish below, while TB is still spinning, persisted and uncommitted.
select is(
  pg_temp.publish_mangled(
    (select ceremony_id from f where name = 'TB'),
    jsonb_set(pg_temp.bundle_text((select ceremony_id from f where name = 'TB'))::jsonb,
              '{spin_plan}',
              (select jsonb_agg(first_entry)
                 from (select (pg_temp.bundle_text((select ceremony_id from f where name = 'TB'))::jsonb
                               -> 'spin_plan' -> 0) as first_entry
                         from generate_series(1, (select count(*)::int from spin s
                                                   where s.ceremony_id = (select ceremony_id from f where name = 'TB')))
                      ) t))),
  'payload_shape',
  '⭐ payload_shape when spin_plan repeats ONE spin to fill the count — the length matched the '
  'ceremony exactly and every entry named a real spin, so nothing but a uniqueness test could see it');

select is(
  pg_temp.publish_mangled(
    (select ceremony_id from f where name = 'TB'),
    jsonb_set(pg_temp.bundle_text((select ceremony_id from f where name = 'TB'))::jsonb,
              -- ⚠ TWO entries, matching TB's TWO pity spins. A one-element array would trip the
              -- LENGTH guard instead and the row would pass for the wrong reason — which is exactly
              -- what happened when the second pity spin was added: the mutation pass immediately
              -- showed the permutation guard SURVIVING. One legitimate member, one stranger.
              '{pity,reveal_order}',
              jsonb_build_array('76561198000000044', '76561198000000888'))),
  'payload_shape',
  '⭐ payload_shape when pity.reveal_order is not a permutation of pity.winless — SAME LENGTH as '
  'the pity spins, and INVISIBLE to byte accounting (draws and bytes_consumed stay identical, '
  'deferred-work.md:335), so only the set comparison catches it');

select is(
  (select count(*)::int from verification_bundle
    where ceremony_id = (select ceremony_id from f where name = 'TB')),
  0, 'the two refusals above wrote NOTHING — TB is still uncommitted');

select is(
  pg_temp.probe_publish((select ceremony_id from f where name = 'TB'),
    pg_temp.bundle_text((select ceremony_id from f where name = 'TB')),
    pg_temp.bundle_sha((select ceremony_id from f where name = 'TB')),
    (select sid from admin_sid)),
  'ok', 'publish_bundle commits the document and its hash BEFORE the first reveal');

select is(
  (public.verification_bundle_read((select ceremony_id from f where name = 'TB')) ->> 'bundle_sha256'),
  pg_temp.bundle_sha((select ceremony_id from f where name = 'TB')),
  'k=0: the COMMITMENT is served the instant it is published — that is what makes it a commitment');

select is(pg_temp.served_spins((select ceremony_id from f where name = 'TB')), 0,
  'k=0: ZERO spin_plan entries are served — the content is not published with the hash');
select is(pg_temp.served_awards((select ceremony_id from f where name = 'TB')), 0,
  'k=0: ZERO award entries are served');

-- ⭐ ABSENT, NOT BLANKED (B2). A `null` or a "redacted" placeholder would leak
-- cardinality-by-position: a viewer would learn exactly how many spins remain and where the gaps are.
select is(
  (public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
     -> 'bundle' ? 'pity'),
  false, 'k=0: `pity` is ABSENT from the served object, not present-and-empty (B2)');

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB'), 1,
                               (select sid from admin_sid)), 'ok', 'reveal 1 is accepted');
select is(pg_temp.served_spins((select ceremony_id from f where name = 'TB')), 1,
  'k=1: EXACTLY one spin_plan entry — one more would be a spoiler, one fewer a regression');

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB'), 2,
                               (select sid from admin_sid)), 'ok', 'reveal 2 is accepted');
select is(pg_temp.served_awards((select ceremony_id from f where name = 'TB')), 2,
  'k=2: exactly the TWO awards those spins decided — never the two the catalog never used');

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB'), 3,
                               (select sid from admin_sid)), 'ok', 'reveal 3 is accepted');
select is(pg_temp.served_spins((select ceremony_id from f where name = 'TB')), 3,
  'k=3: three spin_plan entries — the pity spin is still ABSENT');

-- ⛔⛔ IDENTITY, NOT ONLY CARDINALITY — ADDED BY THE 6.9a CODE REVIEW. Every checkpoint above is
-- `jsonb_array_length(...)`, and AC12 asks for "the served set EQUALS the revealed prefix exactly".
-- A count is not a set: a projection whose `exists` subquery matched on the wrong join key — serving
-- spin 4's entry at k=1, or award C's at k=2 — yields the IDENTICAL counts and passes all five
-- checkpoints. Nothing anywhere read `(e ->> 'spin')` or `(e ->> 'award_id')` out of the served
-- array, so substitution was invisible while inflation was not. These read the ids back.
select is(
  (select array_agg((e ->> 'spin')::int order by (e ->> 'spin')::int)
     from jsonb_array_elements(
            public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
              -> 'bundle' -> 'spin_plan') e),
  array[1, 2, 3],
  '⭐ k=3: the served spin_plan is EXACTLY spins {1,2,3} BY INDEX — not merely three of something');

select is(
  (select array_agg(e ->> 'award_id' order by e ->> 'award_id')
     from jsonb_array_elements(
            public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
              -> 'bundle' -> 'awards') e),
  (select array_agg(x order by x) from unnest(array[
     (select award_a from f where name = 'TB')::text,
     (select award_b from f where name = 'TB')::text,
     (select award_c from f where name = 'TB')::text]) x),
  '⭐ k=3: the served awards are EXACTLY the three awards those spins decided, BY ID — re-derived '
  'from the fixture rather than counted');

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB'), 4,
                               (select sid from admin_sid)), 'ok',
  'reveal 4 (the FIRST pity spin) is accepted — one consolation spin still unrevealed');

-- ⭐⭐ THE PARTIAL PITY WINDOW: one consolation revealed of two. This is the only moment the
-- truncation is observable, and the mutation pass is what proved the assertion was missing —
-- reverting `winless` to whole SURVIVED a fully green suite.
-- ⛔ Served whole, `winless` would be BOTH consolation winners while `reveal_order` carried one, and
-- the unrevealed winner would be `winless MINUS reveal_order`: a spoiler computed by subtraction,
-- returning no unrevealed entry, invisible to every cardinality-shaped check in this file.
select is(
  (select jsonb_array_length(
            public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
              -> 'bundle' -> 'pity' -> 'winless')),
  1,
  '⭐⭐ k=4 of 5: `winless` is TRUNCATED to the ONE revealed consolation — served whole it would '
  'name the unrevealed winner by set subtraction against reveal_order');

select is(
  (select public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
     -> 'bundle' -> 'pity' -> 'winless' -> 0),
  '"76561198000000044"'::jsonb,
  'and it is the winner whose spin WAS revealed, by identity — not merely one entry of something');

select is(
  (select public.verification_bundle_read((select ceremony_id from f where name = 'TB'))
     -> 'bundle' -> 'pity' ? 'bytes_consumed'),
  false,
  'bytes_consumed is WITHHELD until the pity phase is fully revealed — a whole-stream measurement '
  'has no honest partial value');

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB'), 5,
                               (select sid from admin_sid)), 'ok',
  'reveal 5 (the last consolation) is accepted, and it COMPLETES the ceremony');

-- ⭐⭐ THE ONE MOMENT THE SERVED DOCUMENT HASHES TO THE COMMITMENT. This is what "verify" means, and
-- it is asserted against the STORED payload rather than against a re-rendered copy.
select is(
  (public.verification_bundle_read((select ceremony_id from f where name = 'TB')) -> 'bundle'),
  (select b.payload from public.verification_bundle b
    where b.ceremony_id = (select ceremony_id from f where name = 'TB')),
  'at complete the FULL document is served, identical to the stored payload');

-- ════════════════════════════════════════════════════════════════════════════
-- Section C — publish_bundle's typed refusals, on ceremony TB2. 17 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select is(pg_temp.probe_publish(999999, '{}', repeat('0', 64), (select sid from admin_sid)),
  'no_ceremony', 'no_ceremony on an id that does not exist');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'), '{}', repeat('0', 64),
                                (select sid from admin_sid)),
  'ceremony_not_spinning', 'a LOCKED ceremony refuses before anything is parsed');

-- ⚠ THE PERSIST IS A FIXTURE STEP, NOT AN ASSERTION, and it is called bare for that reason: wrapping
-- it in `lives_ok` would add a test the plan does not budget for. Section B already proves
-- `persist_ceremony` lives; here it only has to put TB2 into `spinning` so the refusals are reachable.
select public.persist_ceremony(
  (select ceremony_id from f where name = 'TB2'),
  pg_temp.one_spin_run((select ceremony_id from f where name = 'TB2')),
  (select sid from admin_sid), false);

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            'Cegador' || chr(233),
            encode(sha256(convert_to('Cegador' || chr(233), 'UTF8')), 'hex'),
            (select sid from admin_sid)),
  'non_ascii_payload',
  'non_ascii_payload — the teeth deferred-work.md:265-266 never had (award.name accepts U+200B)');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'), '{"a":1}',
                                repeat('0', 64), (select sid from admin_sid)),
  'bundle_mismatch', 'bundle_mismatch — B9: the RPC re-derives the hash and refuses a claim');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'), 'not json at all',
            encode(sha256(convert_to('not json at all', 'UTF8')), 'hex'),
            (select sid from admin_sid)),
  'payload_shape', 'payload_shape on a payload that is not JSON (the cast is inside its own block)');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'), '{"a":1}',
            encode(sha256(convert_to('{"a":1}', 'UTF8')), 'hex'), (select sid from admin_sid)),
  'payload_shape', 'payload_shape on a document that is not the seven specced keys');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB')),
            (select sid from admin_sid)),
  'payload_shape',
  'payload_shape when the document describes ANOTHER ceremony''s spins — counted against the DB');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            replace(pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
                    repeat('c', 64), repeat('9', 64)),
            encode(sha256(convert_to(replace(
              pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
              repeat('c', 64), repeat('9', 64)), 'UTF8')), 'hex'),
            (select sid from admin_sid)),
  'seed_mismatch', 'seed_mismatch when the document names a seed the ceremony did not freeze');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            replace(pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
                    'inclusivcup-roulette-1.0.0', 'inclusivcup-roulette-2.0.0'),
            encode(sha256(convert_to(replace(
              pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
              'inclusivcup-roulette-1.0.0', 'inclusivcup-roulette-2.0.0'), 'UTF8')), 'hex'),
            (select sid from admin_sid)),
  'algo_version_mismatch', 'algo_version_mismatch on a MAJOR this database does not implement');

-- ⭐⭐ TWO OF THE FOUR IDENTITY GUARDS ADDED BY THE 6.9a CODE REVIEW. Both documents below used to
-- PUBLISH: the count guards compared two integers and nothing joined the payload's contents back to
-- the database. ⚠ Each mangle PRESERVES THE ARRAY LENGTH, deliberately — a shorter array would trip
-- the pre-existing cardinality guard and the row would pass for the WRONG REASON, proving nothing
-- about the identity check it is named for.
-- ⚠ The other two (duplicated spin, and `reveal_order` not a permutation) live in Section B, because
-- neither is REPRESENTABLE on TB2: it has one spin and no pity spin, so a duplicate cannot exist
-- without breaking the count, and there is no consolation phase to permute.

-- (1) A PLAYER WHO IS NOT IN THE FROZEN SNAPSHOT. `players` is served ungated to anon, so a
-- fabricated roster would be the verifier's whole view of who played.
select is(
  pg_temp.publish_mangled(
    (select ceremony_id from f where name = 'TB2'),
    jsonb_set(pg_temp.bundle_text((select ceremony_id from f where name = 'TB2'))::jsonb,
              '{players}',
              -- ⚠ DISTINCT invented ids, one per element (`…777` + ordinal). An earlier version
              -- gave every entry the SAME id, which meant the guard's DUPLICATE branch caught it
              -- and the mutation pass showed the identity branch SURVIVING — the row passed for a
              -- neighbouring reason. Distinct ids leave the not-in-the-snapshot branch as the only
              -- thing that can fire.
              (select jsonb_agg(jsonb_set(t.e, '{steamid64}',
                                          to_jsonb('7656119800000' || lpad(t.ord::text, 4, '0')))
                                order by t.ord)
                 from jsonb_array_elements(
                        pg_temp.bundle_text((select ceremony_id from f where name = 'TB2'))::jsonb
                        -> 'players') with ordinality as t(e, ord)))),
  'payload_shape',
  '⭐ payload_shape when a players entry is not in the frozen snapshot — SAME LENGTH and DISTINCT '
  'ids, so neither the cardinality guard nor the duplicate branch can be what caught it');

-- (2) AN AWARD THIS CEREMONY DID NOT DECIDE. This one had a live consequence: the projection joins
-- served awards on award_id, so an unjoinable id serves ZERO awards forever behind a valid hash.
select is(
  pg_temp.publish_mangled(
    (select ceremony_id from f where name = 'TB2'),
    jsonb_set(pg_temp.bundle_text((select ceremony_id from f where name = 'TB2'))::jsonb,
              '{awards}',
              (select jsonb_agg(jsonb_set(e, '{award_id}', '"999999"'::jsonb))
                 from jsonb_array_elements(
                        pg_temp.bundle_text((select ceremony_id from f where name = 'TB2'))::jsonb
                        -> 'awards') e))),
  'payload_shape',
  '⭐ payload_shape when an awards entry names an award this ceremony did not decide — SAME LENGTH; '
  'it would have published and then served no awards at all, permanently');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB2')), null),
  'unknown_actor', 'unknown_actor on a NULL actor');
select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB2')), '76561198000000099'),
  'unknown_actor', 'unknown_actor on a steamid64 that is not a player');

-- ⛔⛔ `reveal_in_progress` IS REACHABLE ONLY THROUGH A DIRECT SERVICE-KEY UPDATE, AND SAYING SO IS
-- THE HONEST FORM. `reveal_spin` refuses until a bundle is published and `publish_bundle` refuses once
-- one exists, so the ORDINARY paths can never produce a revealed spin with no bundle — `already_
-- published` would fire first. What remains is the same shape IC911 exists for: somebody wrote
-- `spin.revealed_at` directly (service_role holds UPDATE on `spin`, `0025:358`). The guard is
-- defence-in-depth against exactly that, and driving it any other way would be testing a path that
-- cannot exist.
update spin set revealed_at = now()
 where ceremony_id = (select ceremony_id from f where name = 'TB2') and spin_index = 1;

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB2')),
            (select sid from admin_sid)),
  'reveal_in_progress',
  'reveal_in_progress — a commitment chosen after an outcome is public commits to nothing');

update spin set revealed_at = null
 where ceremony_id = (select ceremony_id from f where name = 'TB2') and spin_index = 1;

select is(
  (select count(*)::int from public.verification_bundle b
    where b.ceremony_id = (select ceremony_id from f where name = 'TB2')),
  0, 'every refusal above wrote NOTHING — no bundle row exists for TB2');

-- ⭐ THE POSITIVE CONTROL. Without it every refusal above would hold just as well for a function that
-- refused everything — which is the shape 6.8b's reviewer found surviving a `using (true)` mutation.
select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB2')),
            (select sid from admin_sid)),
  'ok', 'the positive control: a well-formed bundle IS accepted');

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB2'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB2')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB2')),
            (select sid from admin_sid)),
  'already_published', 'already_published — the commitment is SINGULAR');

-- ════════════════════════════════════════════════════════════════════════════
-- Section D — reveal_spin refuses before the commitment exists, on TB3. 9 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select public.persist_ceremony(
  (select ceremony_id from f where name = 'TB3'),
  pg_temp.one_spin_run((select ceremony_id from f where name = 'TB3')),
  (select sid from admin_sid), false);

select is(pg_temp.probe_reveal((select ceremony_id from f where name = 'TB3'), 1,
                               (select sid from admin_sid)),
  'bundle_not_published',
  'reveal_spin refuses on a spinning, persisted, UNPUBLISHED ceremony (AC4)');

select is(
  (select count(*)::int from spin s
    where s.ceremony_id = (select ceremony_id from f where name = 'TB3')
      and s.revealed_at is not null),
  0, 'the refusal wrote nothing — no spin was stamped');

select is(
  (select public.reveal_spin((select ceremony_id from f where name = 'TB3'), 1,
                             (select sid from admin_sid)) ->> 'ceremony_id')::bigint,
  (select ceremony_id from f where name = 'TB3'),
  'the refusal names the ceremony it refused for');

-- ⭐ THE POSITIVE CONTROL: the SAME reveal succeeds once the bundle is published — without it the
-- guard above holds for any body of it.
--
-- ⛔⛔ SPLIT INTO TWO STATEMENTS BY THE 6.9a CODE REVIEW. It was one assertion:
--
--     select is(probe_publish(…) || '/' || probe_reveal(…), 'ok/ok', …);
--
-- and it REQUIRED the left operand to run first, because the reveal only succeeds after the
-- publish. Both operands are volatile PL/pgSQL calls with transactional side effects, and
-- PostgreSQL does not promise left-to-right evaluation of `||` — a rule migration 0029 states
-- about itself, which is why every type-then-length pair in `publish_bundle` is NESTED rather than
-- `or`-ed. Evaluated right-first this yields 'ok/bundle_not_published': a red test, with a
-- misleading message, on the single assertion that proves this guard is not unconditional.
-- Sequencing them as separate statements is free and makes the order a fact rather than a hope.
select is(
  pg_temp.probe_publish((select ceremony_id from f where name = 'TB3'),
    pg_temp.bundle_text((select ceremony_id from f where name = 'TB3')),
    pg_temp.bundle_sha((select ceremony_id from f where name = 'TB3')),
    (select sid from admin_sid)),
  'ok',
  '⭐ THE POSITIVE CONTROL, step 1: the bundle publishes on this very ceremony');

-- ⛔⛔ THE `bundle_published` GUARD, EXERCISED AT THE ONLY MOMENT IT IS REACHABLE — added by the
-- 6.9a code review, which found the highest-severity fix of the whole review shipping with NO TEST.
--
-- TB3 is, right now, the one state that reaches it: PUBLISHED (step 1, just above) and with ZERO
-- reveals (step 2 has not run yet). That window is exactly the hole. `reveal_in_progress` sits
-- earlier in the same function and CANNOT fire here — publishing requires zero reveals, so a
-- published-and-unrevealed ceremony passes straight through it — which is why `p_replace => true`
-- used to delete and rewrite every spin the immutable `bundle_sha256` describes, leaving the
-- commitment binding a run that never happened and `already_published` blocking any correct
-- re-issue. ⚠ Placed BETWEEN the two positive-control steps deliberately: one line later the
-- reveal lands and `reveal_in_progress` masks this guard forever.
select is(
  pg_temp.probe_persist((select ceremony_id from f where name = 'TB3'),
                        pg_temp.one_spin_run((select ceremony_id from f where name = 'TB3')),
                        (select sid from admin_sid), true),
  'bundle_published',
  '⭐⭐ persist_ceremony REFUSES a re-persist once the commitment is published — the case '
  'reveal_in_progress structurally cannot catch, because publishing requires zero reveals');

select is(
  (select count(*)::int from spin s
    where s.ceremony_id = (select ceremony_id from f where name = 'TB3')),
  1, 'and it wrote nothing — TB3''s spin survived the refused replace');

select is(
  pg_temp.probe_reveal((select ceremony_id from f where name = 'TB3'), 1,
                       (select sid from admin_sid)),
  'ok',
  '⭐ THE POSITIVE CONTROL, step 2: the SAME reveal that refused above now SUCCEEDS — so '
  'bundle_not_published is the commitment gate and not an unconditional refusal');

-- ⭐⭐ THE ROW ON THE VIEWER POLICY'S **FALSE** SIDE — ADDED BECAUSE T8's M05 SURVIVED WITHOUT IT.
--
-- This is 6.8b's reviewer finding, arriving in this story instead of after it: `ceremony_viewer_read`
-- "survived being widened to `using (true)` with 84/84 green, because every fixture ceremony sat on
-- one side of the predicate." Every assertion above reads a bundle that IS published, so widening
-- `using (published_at is not null)` to `using (true)` changed nothing any of them could see, and the
-- mutation pass measured exactly that. The migration's own comment claimed "the pgTAP suite puts a row
-- on that FALSE side" — and until now it did not.
--
-- ⚠ A STAGED bundle (published_at NULL) is the only shape that distinguishes the two policies. Nothing
-- in this story WRITES one — `publish_bundle` stamps the column in the same INSERT — which is
-- precisely why the suite has to, and why `published_at` is nullable at all (see the column's comment
-- in 0029: written `not null` first, the planner PROVED the qual and deleted it, making the policy
-- literally equivalent to `using (true)`).
insert into verification_bundle (tournament_id, ceremony_id, snapshot_id, seed_demo_sha256,
                                 algorithm_version, bundle_sha256, payload_canonical, payload,
                                 published_at)
select t.id, c.id, (select s.id from stat_snapshot s where s.tournament_id = t.id),
       repeat('f', 64), 'inclusivcup-roulette-1.0.0', repeat('a', 64), '{}', '{}'::jsonb,
       null
  from tournament t join ceremony c on c.tournament_id = t.id
 where t.name = 'TB5';

select is((select count(*)::int from verification_bundle), 4,
  'four bundle rows exist: three published (TB, TB2, TB3) and one STAGED');

set local role anon;
select is((select count(*)::int from public.verification_bundle), 3,
  '⭐⭐ anon sees exactly the THREE PUBLISHED bundles — the staged row is INVISIBLE. Without this row '
  'the viewer policy has no FALSE side and `using (true)` is UNKILLABLE (T8/M05, measured).');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- Section E — AC10.1, the luck_weight_table freeze. 5 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select throws_ok(
  format($$ update public.ceremony set luck_weight_table = array[9,8,7] where id = %s $$,
         (select ceremony_id from f where name = 'TB')),
  'IC910',
  null,
  'IC910 refuses a luck_weight_table edit once the ceremony has left not_started (AC10.1)');

select throws_like(
  format($$ update public.ceremony set luck_weight_table = array[9,8,7] where id = %s $$,
         (select ceremony_id from f where name = 'TB')),
  '%luck_weight_table is FROZEN%',
  'the refusal names the column, so a reader learns WHICH freeze fired');

-- ⭐ THE ROW ON THE PREDICATE'S FALSE SIDE. Without it the state-conditional freeze is
-- indistinguishable from an unconditional one — the exact hole 6.8b's reviewer found, where every
-- fixture ceremony sat on one side of `state <> 'not_started'`.
select lives_ok(
  format($$ update public.ceremony set luck_weight_table = array[9,8,7] where id = %s $$,
         (select id from ceremony where tournament_id = (select id from tournament where name = 'TB5'))),
  'a not_started ceremony may still be tuned (SPEC:97 — "tuning stays reproducible")');

-- ⛔⛔ THE EDIT BUNDLED INTO THE LOCK TRANSITION — ADDED BY THE 6.9a CODE REVIEW, WHICH FOUND ONE
-- STATEMENT'S WORTH OF DAYLIGHT IN THE PREDICATE. It keyed on `old.state` alone, so a SINGLE
-- statement moving `not_started -> locked` AND changing the weights passed both the state machine
-- (one legal forward step) and the freeze (`old.state = 'not_started'`) — the ceremony entered
-- `locked` with inputs that had just moved, and AD-15's "the inputs have stopped moving from
-- `locked` onward" was quietly false.
--
-- ⚠ THE `lives_ok` ABOVE COULD NOT CATCH THIS: it edits a ceremony that STAYS `not_started`, so it
-- exercises `old.state = new.state = 'not_started'` and never the combined move. That is why this
-- row is a genuinely new case and not a second spelling of the same one.
-- ⚠ `array[7,7,7]`, NOT `array[9,8,7]` — AND THE DIFFERENCE IS THE TEST. The `lives_ok` immediately
-- above has already written `array[9,8,7]` to this very ceremony, so re-writing the same value makes
-- `new.luck_weight_table is distinct from old.luck_weight_table` FALSE, the freeze correctly does not
-- fire, the legal `not_started -> locked` step succeeds, and the assertion reports "caught: no
-- exception" — a green-looking guard proving nothing. Measured, not reasoned about: this test failed
-- exactly that way on its first run.
select throws_ok(
  format($$ update public.ceremony set state = 'locked', luck_weight_table = array[7,7,7]
             where id = %s and state = 'not_started' $$,
         (select id from ceremony where tournament_id = (select id from tournament where name = 'TB5'))),
  'IC910',
  null,
  '⭐ IC910 refuses weights changed IN THE SAME STATEMENT as the lock — the freeze reads BOTH '
  'old.state and new.state, so it cannot be stepped around by bundling the edit into the move');

-- ⚠ THE FREEZE IS NOT A COLUMN ALLOWLIST (0027's DECISION 4): every other writable column must stay
-- writable, or `lock_ceremony`, `persist_ceremony`, `reveal_spin` and `publish_bundle` all break.
select lives_ok(
  format($$ update public.ceremony set completed_at = now() where id = %s $$,
         (select ceremony_id from f where name = 'TB')),
  'an unrelated ceremony column is still writable after the freeze');

-- ════════════════════════════════════════════════════════════════════════════
-- Section F — AC10.2, `tournament` stops publishing fair_seed. 7 assertions.
-- ════════════════════════════════════════════════════════════════════════════
-- ⛔⛔ THE COLUMN COUNT IS ASSERTED FIRST, AND IT IS THE POINT. `tournament` has NINE columns and
-- `grace_period_seconds` arrived at `0015:76`, AFTER `0002:70`'s table-wide grant — so a naive "copy
-- 0001's list" enumerates eight, omits it, and silently kills Story 4.5's MM:SS grace countdown with
-- nothing red anywhere. If a TENTH column ever lands, this reddens before the grant can go stale.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament'),
  9, 'tournament has exactly NINE columns — the number AC10.2''s enumeration depends on');

select is(has_table_privilege('anon', 'public.tournament', 'SELECT'), false,
  'anon holds NO table-wide SELECT on tournament (the tree''s first revoke … on table)');
select is(has_table_privilege('authenticated', 'public.tournament', 'SELECT'), false,
  'authenticated holds NO table-wide SELECT on tournament');

select is(
  (select bool_and(has_column_privilege('anon', 'public.tournament', c, 'SELECT'))
     from unnest(array['id', 'season_id', 'name', 'state', 'format_default',
                       'final_match_id', 'created_at', 'grace_period_seconds']) c),
  true, 'anon still reads all EIGHT published tournament columns');
select is(
  (select bool_and(has_column_privilege('authenticated', 'public.tournament', c, 'SELECT'))
     from unnest(array['id', 'season_id', 'name', 'state', 'format_default',
                       'final_match_id', 'created_at', 'grace_period_seconds']) c),
  true, 'authenticated still reads all EIGHT published tournament columns');

-- ⭐ THE 4.5 GRACE TIMER'S COLUMN, ASSERTED ON ITS OWN. It is inside the `bool_and` above too, but a
-- named assertion is what makes a failure say WHICH column broke rather than "one of eight".
select is(has_column_privilege('anon', 'public.tournament', 'grace_period_seconds', 'SELECT'), true,
  'grace_period_seconds is STILL granted — the 0015-after-0002 column AC10.2 is most likely to drop');

select is(
  array[has_column_privilege('anon', 'public.tournament', 'fair_seed', 'SELECT'),
        has_column_privilege('authenticated', 'public.tournament', 'fair_seed', 'SELECT')],
  array[false, false],
  'fair_seed is the ONE omission — the rollback-nullable copy stops being public (deferred-work.md:370)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section G — AC10.3/AC10.4, the two provenance columns and the two CHECKs. 9 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select has_column('public', 'spin', 'label', 'spin.label exists (DECISION F)');
select has_column('public', 'spin', 'bytes_consumed', 'spin.bytes_consumed exists (DECISION F)');

-- ⭐ THE WRITER IS WHAT AC10.3 IS ABOUT. `0027:1025-1032` carried both on the wire and persisted
-- neither; these two assertions are the proof that stopped being true.
select is(
  (select count(*)::int from spin s
    where s.ceremony_id = (select ceremony_id from f where name = 'TB') and s.label is null),
  0, 'persist_ceremony wrote a label on EVERY spin — none was left NULL');

select is(
  (select s.bytes_consumed from spin s
    where s.ceremony_id = (select ceremony_id from f where name = 'TB') and s.spin_index = 1),
  2::bigint, 'persist_ceremony wrote the payload''s bytes_consumed VERBATIM (reproduced, never re-derived)');

-- ⚠ FR-28 draws the WHOLE consolation order from ONE stream, so the run total lands on the FIRST
-- consolation spin and zero on the rest — stamping each with the total made `sum(bytes_consumed)`
-- report 28 x 27 = 756 bytes for a 27-byte stream (6.8a code review). One pity spin here, so the sum
-- over the ceremony is the honest whole-ceremony figure: 2 + 2 + 1 + 3 = 8.
select is(
  (select sum(s.bytes_consumed)::bigint from spin s
    where s.ceremony_id = (select ceremony_id from f where name = 'TB')),
  8::bigint, 'sum(bytes_consumed) is the whole-ceremony figure, not a per-spin duplication');

select throws_like(
  format($$ insert into public.spin (ceremony_id, spin_index, kind) values (%s, 0, 'main') $$,
         (select ceremony_id from f where name = 'TB5')),
  '%spin_index_positive%',
  'spin_index_positive refuses index 0 BY NAME — the theorem IC911 rests on is now a constraint');

select throws_like(
  format($$ insert into public.spin (ceremony_id, spin_index, kind, bytes_consumed)
            values (%s, 1, 'main', -1) $$,
         (select ceremony_id from f where name = 'TB5')),
  '%spin_bytes_consumed_non_negative%',
  'spin_bytes_consumed_non_negative refuses a negative count BY NAME');

-- ⭐⭐ THE ASSERTION THAT PROVES THE MIGRATION CAN APPLY AT ALL. `(NULL >= 0) is true` is FALSE, so
-- the naive R11 form would have refused every row that predates 0029 — the migration would pass a
-- fresh `supabase db reset` and FAIL against the QA corpus. The `is null or` disjunct is what makes
-- this row legal, and this is what proves the disjunct is there.
select lives_ok(
  format($$ insert into public.spin (ceremony_id, spin_index, kind, bytes_consumed)
            values (%s, 2, 'main', null) $$,
         (select ceremony_id from f where name = 'TB5')),
  'a NULL bytes_consumed is ADMITTED — the disjunct without which 0029 cannot apply to a non-empty spin table');

-- ⛔⛔ THE TWO NEW `spin` COLUMNS ARE ANON-READABLE, AND THAT IS NOW A DECISION RATHER THAN AN
-- ACCIDENT — ADDED BY THE 6.9a CODE REVIEW. `0028:248` grants `select on public.spin` TABLE-WIDE,
-- so `label` and `bytes_consumed` became readable by anon on every revealed spin the instant this
-- migration applied. That is almost certainly what we want — both are bundle-published provenance
-- for spins that are already public — but it happened BY DEFAULT, and it is the exact inverse of
-- the fail-closed property this migration asserts twice ("A COLUMN ADDED TO THIS TABLE LATER IS
-- UN-GRANTED BY DEFAULT"). That claim is true of `verification_bundle` and `ceremony`, which hold
-- COLUMN grants, and false of `spin`, which this migration widens. Section G previously asserted
-- only that the columns exist and are written; nothing pinned who can read them.
-- ⚠ Read from `information_schema.column_privileges`, never from a literal beside the assertion.
select is(
  -- ⚠ `::text` on every information_schema column: they are `sql_identifier`, not `text`, and
  -- pgTAP's `is()` resolves no overload for `sql_identifier[]` vs `text[]`.
  (select array_agg(distinct cp.grantee::text order by cp.grantee::text)
     from information_schema.column_privileges cp
    where cp.table_schema = 'public' and cp.table_name = 'spin'
      and cp.column_name::text in ('label', 'bytes_consumed')
      and cp.privilege_type::text = 'SELECT'
      and cp.grantee::text in ('anon', 'authenticated')),
  array['anon', 'authenticated'],
  '⭐ spin.label and spin.bytes_consumed ARE readable by both client roles, via 0028''s table-wide '
  'grant — recorded as a decision, because unlike verification_bundle this table has no column grant '
  'and therefore does NOT fail closed on a column added later');

-- ════════════════════════════════════════════════════════════════════════════
-- Section H — DECISION I, the commitment is immutable. IC912. 5 assertions.
-- ════════════════════════════════════════════════════════════════════════════
select throws_ok(
  format($$ update public.verification_bundle set payload_canonical = '{"tampered":true}'
            where ceremony_id = %s $$, (select ceremony_id from f where name = 'TB')),
  'IC912', null,
  'IC912 refuses a rewrite of the hashed bytes — a commitment that can be rewritten is not one');

select throws_ok(
  format($$ update public.verification_bundle set bundle_sha256 = repeat('0', 64)
            where ceremony_id = %s $$, (select ceremony_id from f where name = 'TB')),
  'IC912', null,
  'IC912 refuses a rewrite of the commitment itself');

select throws_ok(
  format($$ update public.verification_bundle set published_at = null where ceremony_id = %s $$,
         (select ceremony_id from f where name = 'TB')),
  'IC912', null,
  'IC912 refuses UN-publishing — a retraction of a hash viewers have already read');

-- ⚠ THE `is distinct from` HALF: an idempotent re-write of the SAME value is a no-op, not an error,
-- exactly as `assert_ceremony_transition` and `tournament_fair_seed_write_once` behave.
select lives_ok(
  format($$ update public.verification_bundle b set bundle_sha256 = b.bundle_sha256
            where b.ceremony_id = %s $$, (select ceremony_id from f where name = 'TB')),
  'a no-op re-write of the same value is PERMITTED (the is-distinct-from half)');

select lives_ok(
  format($$ update public.verification_bundle set released_at = now() where ceremony_id = %s $$,
         (select ceremony_id from f where name = 'TB')),
  'released_at NULL -> value is permitted once (DECISION K names its writer)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section I — the audit row, BY CONTENT. 4 assertions.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ 6.8a's review found "the audit_log row was asserted by ZERO tests in a migration whose own
-- comment said EVERY key below is asserted". These four are that comment made true.
select is(
  (select count(*)::int from audit_log
    where action = 'publish_bundle'
      and tournament_id = (select tournament_id from f where name = 'TB')),
  1, 'EXACTLY one publish_bundle audit row per accepted call (AD-17)');

select is(
  (select array_agg(k order by k) from audit_log a,
        jsonb_object_keys(a.detail -> 'before') k
    where a.action = 'publish_bundle'
      and a.tournament_id = (select tournament_id from f where name = 'TB')),
  array['algorithm_version', 'ceremony_state', 'published'],
  'the audit BEFORE block carries exactly its three keys');

select is(
  (select array_agg(k order by k) from audit_log a,
        jsonb_object_keys(a.detail -> 'after') k
    where a.action = 'publish_bundle'
      and a.tournament_id = (select tournament_id from f where name = 'TB')),
  array['algorithm_version', 'awards', 'bundle_id', 'bundle_sha256', 'ceremony_id', 'ceremony_state',
        'main_spins', 'payload_bytes', 'players', 'published_at', 'seed_hex', 'snapshot_id',
        'spins'],
  'the audit AFTER block carries exactly its thirteen keys');

-- ⭐ THE COMMITTED HASH, NOT THE CLAIMED ONE. `publish_bundle` stores and audits the value it
-- DERIVED; auditing the caller's claim would record an assertion rather than a fact.
select is(
  (select a.detail -> 'after' ->> 'bundle_sha256' from audit_log a
    where a.action = 'publish_bundle'
      and a.tournament_id = (select tournament_id from f where name = 'TB')),
  (select b.bundle_sha256 from verification_bundle b
    where b.ceremony_id = (select ceremony_id from f where name = 'TB')),
  'the audit row records the DERIVED hash, and it equals the stored commitment');

-- ════════════════════════════════════════════════════════════════════════════
-- Section J — ⭐ GUARD THE GUARDS. 6 assertions.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐⭐ THE REFUSAL SET READS ITS OWN EVIDENCE. `6-8a:909` is the project's signature defect at its
-- seventh occurrence: "`if len(inputReachable) != 6` measures the size of a map literal written two
-- lines above it". This reads `publish_bundle`'s `prosrc` and compares the set it actually returns
-- against the set declared here — ⛔ a literal copied beside the assertion would measure nothing.
select is(
  (select array_agg(distinct m[1] order by m[1])
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace,
          regexp_matches(p.prosrc, '''reason'',\s*''([a-z_]+)''', 'g') m
    where n.nspname = 'public' and p.proname = 'publish_bundle'),
  array['algo_version_mismatch', 'already_published', 'award_revealed_twice', 'bundle_mismatch',
        'ceremony_not_spinning', 'no_ceremony', 'no_spins', 'non_ascii_payload', 'payload_shape',
        'reveal_in_progress', 'seed_mismatch', 'seed_missing', 'snapshot_missing', 'unknown_actor'],
  'publish_bundle''s refusal set, read from its OWN prosrc, is exactly the fourteen declared');

select is(
  (select array_agg(distinct column_name::text order by column_name::text)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'verification_bundle'
      and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'),
  array['algorithm_version', 'bundle_sha256', 'ceremony_id', 'id', 'published_at',
        'released_at', 'tournament_id'],
  'the granted column set, read from information_schema, is exactly the seven published ones');

select is(
  (select array_agg(polname order by polname) from pg_policy
    where polrelid = 'public.verification_bundle'::regclass),
  array['verification_bundle_admin_read', 'verification_bundle_viewer_read']::name[],
  'the policy set, read from pg_policy, is exactly the two — never merged into one');

-- ⚠⚠ THE DEFINER'S HIDDEN DEPENDENCY, ASSERTED RATHER THAN ASSUMED (`0027:323-331`). Under FORCE ROW
-- LEVEL SECURITY, `security definer` ALONE does not make the projection see every row — the OWNER's
-- BYPASSRLS is what does. On ownership reassignment it would silently start serving less than it
-- should, with every behavioural test still green.
select is(
  (select r.rolbypassrls from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_roles r on r.oid = p.proowner
    where n.nspname = 'public' and p.proname = 'verification_bundle_read'),
  true,
  'verification_bundle_read''s OWNER carries rolbypassrls — without it the definer fix fails open');

-- ⭐⭐ DECISION E's POSITIVE PROOF. `0028:91-92` anticipated that 6.9 would widen `ceremony`'s grant
-- by one column; under DECISION A that column lives on `verification_bundle` instead, so `ceremony`'s
-- grant must be BYTE-IDENTICAL to what 0028 left. ⚠ This assertion is VACUOUS for this story by
-- construction — the story's mutation pass is what proves it non-vacuous, by mutating a widening
-- grant in for BOTH anon and authenticated and watching each redden.
select is(
  (select array_agg(distinct column_name::text order by column_name::text)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'ceremony'
      and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'),
  array['completed_at', 'id', 'seed_demo_sha256', 'started_at', 'state', 'tournament_id'],
  '⭐ ceremony''s granted columns are UNCHANGED — 0029 did not widen them (DECISION E)');

select columns_are('public', 'ceremony',
  array['id', 'tournament_id', 'state', 'seed_demo_sha256', 'snapshot_id', 'algorithm_version',
        'spin_plan', 'luck_weight_table', 'started_at', 'completed_at'],
  'ceremony''s column set is unchanged — bundle_sha256 did NOT land there (DECISION A)');

-- ════════════════════════════════════════════════════════════════════════════
-- Section K — award_revealed_twice, on TB4. 2 assertions.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐⭐ CLOSES deferred-work.md:362 WITH A REAL FIXTURE. `award_result_spin_award_key` is
-- `unique (spin_id, award_id)` — PER SPIN — so the same trophy decided in TWO spins of one ceremony
-- is REPRESENTABLE, and `0027:136-140` homed the cross-check to "6.9, which hashes these bytes and
-- would catch it in the bundle". This builds exactly that ceremony.
select public.persist_ceremony(
  (select ceremony_id from f where name = 'TB4'),
  jsonb_build_object(
    'seed_hex', (select seed_hex from f where name = 'TB4'),
    'spin_plan', jsonb_build_array(
      jsonb_build_object('spin', 1, 'live_count', 1,
        'pool', jsonb_build_array((select award_a from f where name = 'TB4')::text)),
      jsonb_build_object('spin', 2, 'live_count', 1,
        'pool', jsonb_build_array((select award_a from f where name = 'TB4')::text))),
    'spins', jsonb_build_array(
      jsonb_build_object('spin_index', 1, 'kind', 'main',
        'label', 'inclusivcup/v1/stage1/spin/1', 'bytes_consumed', 2,
        'live_award_ids', jsonb_build_array((select award_a from f where name = 'TB4')::text),
        'results', jsonb_build_array(jsonb_build_object(
          'award_id', (select award_a from f where name = 'TB4')::text,
          'outcome_kind', 'winner', 'deciding_value', '3',
          'winners', jsonb_build_array('76561198000000011')))),
      jsonb_build_object('spin_index', 2, 'kind', 'main',
        'label', 'inclusivcup/v1/stage1/spin/2', 'bytes_consumed', 2,
        'live_award_ids', jsonb_build_array((select award_a from f where name = 'TB4')::text),
        'results', jsonb_build_array(jsonb_build_object(
          'award_id', (select award_a from f where name = 'TB4')::text,
          'outcome_kind', 'winner', 'deciding_value', '2',
          'winners', jsonb_build_array('76561198000000022')))))),
  (select sid from admin_sid), false);

select is(pg_temp.probe_publish((select ceremony_id from f where name = 'TB4'),
            pg_temp.bundle_text((select ceremony_id from f where name = 'TB4')),
            pg_temp.bundle_sha((select ceremony_id from f where name = 'TB4')),
            (select sid from admin_sid)),
  'award_revealed_twice',
  '⭐ one trophy decided in TWO spins of one ceremony is CAUGHT, not merely noted (deferred-work.md:362)');

select is(
  (select count(*)::int from public.verification_bundle b
    where b.ceremony_id = (select ceremony_id from f where name = 'TB4')),
  0, 'award_revealed_twice wrote nothing');

select finish();
rollback;
