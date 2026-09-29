-- supabase/migrations/0029_verification_bundle.sql
-- Logical migration 0029 — the verification bundle and the published commitment
-- (Story 6.9a, FR-27/FR-30, AD-22/AD-24).
--
-- ⭐⭐ THE THESIS, IN ONE PARAGRAPH. A ceremony is "provably fair" only if there is a single document
-- whose bytes were fixed BEFORE the first outcome was known, and a hash of those bytes that a viewer
-- read before the first spin. This migration creates that document (`verification_bundle`), the RPC
-- that publishes it having RE-DERIVED its hash rather than trusting the producer's
-- (`publish_bundle`), and the reveal-gated PROJECTION that serves it progressively so the same
-- document can never spoil an unrevealed winner (`verification_bundle_read`). One document, hashed
-- once, released in pieces — see DECISION B, which everything else here hangs off.
--
-- ── SQLSTATEs ────────────────────────────────────────────────────────────────
-- IC901-IC911 are TAKEN (walkover, approve, rollback, manual-score, fair-seed write-once, ceremony
-- transition, reveal-order corruption). ⭐ THIS MIGRATION OWNS **IC912** and raises it in exactly one
-- place: `assert_bundle_immutable`, when a committed commitment is edited (section (b)). Every
-- BUSINESS refusal in this file is RETURNED as `{ok:false, reason:'<snake_case>'}`; only genuine
-- corruption raises, which is the house rule since 0017.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ DECISIONS. Read before changing anything below. Each names its deciding human and date.
-- ════════════════════════════════════════════════════════════════════════════
--
-- DECISION A — THE TABLE IS CREATED HERE, FROM `SOLUTION-DESIGN:235-245`, ADAPTED (Cuatro,
-- 2026-08-08). Six migrations home it to 6.9 by name and `0028:90` says outright "⛔ THIS MIGRATION
-- CREATES NO `verification_bundle` TABLE". The sketch is marked "intent; not final SQL" (`:49`), and
-- the adaptations are: `ceremony_id` gains a UNIQUE (one bundle per ceremony — the commitment is
-- SINGULAR or it is not a commitment); `payload_canonical text` + `payload jsonb` are added, because
-- the sketch has neither and without the bytes there is nothing to serve or re-hash; `published_url`
-- is DROPPED (nothing in this build serves a static asset — there is no `public/` directory and no
-- storage read anywhere in the tree); `released_at` is added for DECISION B's full release.
--
-- DECISION B — ⭐⭐ THE CENTRAL ONE: ONE DOCUMENT, HASHED ONCE, SERVED AS A REVEAL-GATED PROJECTION.
-- `epics.md:1164` says the bundle contains `spin_plan`/`awards`/`players` and publishes
-- `bundle_sha256` UP FRONT. `0028:474-477` says publishing `spin_plan` up front "would break AD-22
-- outright", because it names every unrevealed spin's candidate pool. BOTH ARE TRUE, and
-- `SPINE:223` reconciles them: the HASH commits at ceremony start; the CONTENT releases
-- progressively per spin and in full at completion.
--
--   | when                          | served                                                |
--   |-------------------------------|-------------------------------------------------------|
--   | published_at set, 0 reveals   | bundle_sha256 + algo_version, seed_hex, luck, players |
--   | after reveal k                | + spin_plan[revealed], awards decided by them,
--   |                               |   pity truncated to the revealed consolations         |
--   | ceremony.state = 'complete'   | the FULL document, verbatim                           |
--
-- ⚠ THE COST, STATED PLAINLY (Cuatro, 2026-08-08, Question 3): between publication and completion a
-- viewer CANNOT bind the served prefix to `bundle_sha256`, because a prefix is a different document
-- and hashes differently. Per-spin commitments would fix that and are specified NOWHERE; the gap is
-- ACCEPTED and recorded rather than narrated around. 6.9b's UI states it to the viewer.
--
-- DECISION C — THE PROJECTION IS ONE NARROW `security definer` RPC, NOT A VIEW AND NOT COLUMN GRANTS.
-- A row policy cannot hide an ARRAY ELEMENT, which is exactly what progressive release needs: the
-- gate is per-`spin_plan`-entry, not per-column. `0028`'s DECISION B chose column grants for
-- `ceremony` because THERE the gate was per-column; here it is not, so the same reasoning points the
-- other way. The precedent is `award_catalog_count` (`0023:199-206`), the tree's only other
-- anon-reachable definer, and its warning applies to `verification_bundle_read` VERBATIM:
-- ⛔⛔ "IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22" (`0023:196-198`).
-- ⚠ Under FORCE ROW LEVEL SECURITY a `security definer` function does NOT see every row unless the
-- OWNER carries `rolbypassrls` (`0027:316-328`; 6.8b's DECISION G) — "it works today because the
-- owner is `postgres`; on ownership reassignment the fix reverts to the fail-open behaviour it
-- replaced." The pgTAP suite asserts the owner attribute directly rather than relying on it silently.
--
-- DECISION D — `bundle_sha256` IS THE COLUMN; `bundle_hash` IS THE SAME VALUE'S CONTRACT NAME.
-- `SOLUTION-DESIGN:235-245` and `epics.md:1164` say `bundle_sha256`; `SPINE:223` and
-- `glossary.md:24,67` say `bundle_hash`. ONE VALUE, TWO NAMES — fixed here as the column
-- `bundle_sha256`, exactly the precedent 6.2 set for `seed_demo_sha256` ↔ `seed_hex` (`6-2:246`).
-- ⛔ Do NOT create a second field for the second name. (B8.)
--
-- DECISION E — THIS MIGRATION DOES **NOT** WIDEN `ceremony`'s COLUMN GRANT, AND THAT IS A FINDING.
-- `0028:91-92` anticipated "6.9 WIDENS it (one more column on the grant)" and
-- `0028_reveal_gating_test.sql:1076-1080` was rewritten in anticipation of
-- `grant select (bundle_sha256) on public.ceremony`. Under DECISION A that column lives on
-- `verification_bundle`, so ⭐ `ceremony`'s grant is UNTOUCHED and `0024_test`'s exact `columns_are`
-- stays green — which is POSITIVE proof that nothing was speculatively added to `ceremony`.
-- ⚠ That makes 6.8b's anticipatory guard VACUOUS for this story, so the story's mutation pass proves
-- it non-vacuous by mutating a widening grant in — for `anon` AND for `authenticated`, closing
-- `6-8b:920`'s remaining hole.
--
-- DECISION F — `spin.label` AND `spin.bytes_consumed` BECOME COLUMNS, HERE (Cuatro, 2026-08-08).
-- `0027:1025-1032` carries them on the wire and refuses to persist them: "⛔ Do NOT read them into a
-- write without moving that decision to 6.9 first." THIS IS THAT MOVE. They cannot live only in the
-- bundle, because the bundle is DERIVED FROM THE DATABASE — a field the database does not hold is a
-- field the bundle cannot re-derive once the producer's process has exited. `worker/awards` calls the
-- label "the single most load-bearing fact in a provably-fair ceremony" and `bytes_consumed` is
-- MEASURED FROM THE STREAM, never re-derived; both are exactly what a verifier re-opens.
--
-- DECISION G — THE FR-21 FLOORS (24 rounds / 20 kills) ARE NOT TOUCHED, FOR THE SEVENTH TIME
-- (Cuatro, 2026-08-08, Question 1 — "accept as measured, ship"). ⛔⛔ THIS MIGRATION THEREFORE
-- CRYPTOGRAPHICALLY COMMITS A CEREMONY IN WHICH **0 OF 28 PLAYERS CLEAR EITHER FLOOR**: twelve
-- `no_eligible_players` cards and 28 identical consolation prizes, measured independently by nine
-- stories (`rounds_played` 10-21 against a floor of 24; `kills` 1-12 against 20). After
-- `publish_bundle` commits, moving a floor costs a NEW snapshot, a NEW ceremony and a NEW commitment.
-- Recorded in the loudest terms this file allows, not narrated around.
--
-- DECISION H — `algorithm_version` IS WRITTEN HERE, AND THE LITERAL IS PINNED IN SQL.
-- `0024:200` created it as a SHELL naming its writer: "-- SHELL — Story 6.9 writes
-- 'inclusivcup-roulette-1.0.0'". `publish_bundle` writes it from the payload AFTER checking the
-- payload against the pinned literal below, so the version the ceremony records and the version the
-- hashed document declares cannot disagree. ⚠ Pinning it in SQL means a MAJOR bump needs a
-- migration — which is CORRECT and deliberate: `labels.go:34-35` calls a version bump "a deliberate,
-- ceremony-invalidating act, not a refactor". ⛔ Do not soften this into a pattern match.
--
-- DECISION I — ⭐ THE COMMITMENT IS IMMUTABLE ONCE WRITTEN, ENFORCED BY TRIGGER, NOT BY CONVENTION.
-- `service_role` needs UPDATE on this table (for `released_at`) and holds BYPASSRLS, so NO policy and
-- NO grant can stop the one writer from rewriting a published commitment — and a commitment that can
-- be rewritten is not a commitment. `assert_bundle_immutable` (section (b)) raises **IC912** on any
-- change to the six committed columns, and permits `released_at` exactly once, NULL -> value. This is
-- the update-side half of DECISION A's "the commitment is SINGULAR", and it is the reason IC912
-- exists at all.
--
-- DECISION J — `tie_ladder_exit_step`'s NULL IS SPELLED **ABSENT** IN THE BUNDLE, NEVER THE 0
-- SENTINEL (Cuatro, 2026-08-08; `deferred-work.md:307`). Go carries `LadderExitStep` as an `int`
-- whose 0 means "no ladder was walked" and TS omits the key; `worker/ceremony`'s `Payload` sends the
-- raw integer INCLUDING the sentinel and `persist_ceremony` applies `nullif(v, 0)`. AC9 gives 6.9
-- "the canonicalization half — pick ONE spelling and state it". THE SPELLING IS ABSENT, because
-- (1) the COLUMN is already NULL after `nullif` and the bundle is derived FROM THE DATABASE, so a 0
-- would be a value the source does not hold; (2) RFC-8785 hashes `0` and *absent* DIFFERENTLY, so a
-- runtime that helpfully fills the sentinel produces a different `bundle_sha256` — that must be
-- impossible by construction, not by review; (3) it matches the TS engine, which is what 6.9b's
-- verifier re-derives. The Go builder drops the key on 0; this file's projection never invents it.
--
-- DECISION K — `released_at` IS A SHELL IN 6.9a, AND THE RELEASE GATE IS A DERIVED PREDICATE.
-- Nothing in this story writes `released_at`: `reveal_spin` is the function that completes a
-- ceremony, and AC4 requires its replacement below to differ from `0028`'s by EXACTLY the
-- `bundle_not_published` guard — so it may not also stamp a column. ⭐ That is not a gap, because
-- `verification_bundle_read` derives the full release from `ceremony.state = 'complete'` and NEVER
-- from this column: a stored flag could be forged by an UPDATE, while the state machine is guarded by
-- `assert_ceremony_transition` (IC910). The column is the audit stamp of the moment the release was
-- first SERVED, and its writer is 6.9b/6.10, with the surface that serves it. ⛔ Do not gate the
-- projection on it — that would replace a guarded predicate with an unguarded one.
--
-- ════════════════════════════════════════════════════════════════════════════
-- OUT OF SCOPE — do NOT add here (each named with its owning story):
--   * NO `lib/roulette/verify.ts`, NO `Verificar la ceremonia` button, NO verify strip, NO new
--     Spanish string, NO change to `app/(viewer)/**` or `lib/i18n/es.ts` -> 6.9b. `/ceremonia` stays
--     the Story-5.7 <Placeholder>.
--   * NO wheel, NO Stage-1/Stage-2 phase copy, NO trophy shelf, NO shared-screen mirror, NO
--     `prefers-reduced-motion` choreography -> 6.10 (`0028:209-210`).
--   * NO `spin.reveal` consumer and NO `NUDGE_EVENTS` change -> 6.10 (`0028`'s DECISION F).
--   * NO end-to-end golden ceremony vector, NO `--check` automation, NO CI -> 6.11.
--   * NO production entry point for `worker/ceremony.Run`, which still has zero callers (Cuatro,
--     2026-08-08, Question 5). The QA harness is the only caller of it and of the bundle builder.
--   * NO change to `public.leaderboard` (0021) or to its 24/20 FR-21 floor literals, and NO change to
--     `lib/awards/catalog.ts` (DECISION G).
--   * NO widening of `ceremony`'s column grant (DECISION E) and NO widening of `award_catalog_count`.
--   * NO `stat_snapshot_row` grant of any kind. `0003:83-84` gives anon ZERO grant on it and
--     `0003:42` calls it "the verifier's integer-form contract" — which is precisely WHY `players`
--     lives INSIDE the bundle instead of being read from the table (B4). ⛔ Do not open it.
--   * NO late-bound demo relief for `ceremony_locked` (`deferred-work.md:372`) -> Epic 7. Under
--     DECISION B the bundle is frozen at publish, so it does not need late-bound demos; the
--     conditional that homed it "to 6.9 if the bundle turns out to need them" is DISCHARGED.
--   * NO CSRF (Epic 7, uniform across all cookie-authenticated admin POSTs).
--   * NO edit to ANY applied migration 0001-0028. `reveal_spin` and `persist_ceremony` change ONLY by
--     `create or replace` HERE, with their bodies copied forward VERBATIM and the diff pasted in the
--     story's Completion Notes.
--
-- ⚠⚠ CLEAN-APPLY NOTE (the 4.3 trap, 0013:60-72 / 0017:80-86 / 0024:173-181 / 0025:92-101 /
-- 0026:62-71 / 0027:169-178 / 0028:227-234 — READ BEFORE CHANGING ANY CHECK BELOW). An IMMEDIATE
-- VALIDATED CHECK cannot apply to a database that already holds a violating row, and
-- `supabase db reset` structurally CANNOT catch that because it rebuilds from empty. ⛔ THIS
-- MIGRATION IS THE FIRST IN EPIC 6 THAT ADDS A VALIDATED CHECK TO A **NON-EMPTY** TABLE, so the
-- argument is made per constraint rather than waved at:
--   * `verification_bundle`'s four CHECKs — the table is CREATED here. Vacuously clean.
--   * `spin_index_positive` on `spin` — `spin` is NOT empty in any database that has run a ceremony
--     (0027 is its first writer and 6.8a/6.8b's QA corpus holds 40 rows). It applies cleanly for a
--     MEASURED reason: `persist_ceremony` is the only writer of `spin_index` and it refuses any value
--     not matching `^[1-9][0-9]{0,8}$` (`0028:1473-1478`) BEFORE any write, so every persisted index
--     is >= 1. The story proves this on the real QA corpus as well as on a fresh reset.
--   * `spin_bytes_consumed_non_negative` — ⛔⛔ ITS `is null or` DISJUNCT IS LOAD-BEARING AND ITS
--     ABSENCE WOULD BREAK THE APPLY. `spin.bytes_consumed` is added NULL on every existing row, and
--     `(NULL >= 0) is true` is FALSE, not unknown — so the naive `check ((bytes_consumed >= 0) is
--     true)` that R11 asks for would refuse EVERY pre-existing row and the migration would fail to
--     apply against the QA corpus while passing a fresh reset. R11's rule ("a CHECK that can evaluate
--     NULL is SATISFIED, so write `(…) is true`") is correct in general and INVERTS here, which is
--     exactly why the disjunct is spelled out rather than assumed.
--   * The two `create or replace` functions and every GRANT/REVOKE validate no existing row.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) AC1 — `public.verification_bundle`: the document and its commitment.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ B1 — ONE DOCUMENT, HASHED ONCE. `bundle_sha256` is SHA-256 of the UTF-8 bytes in
-- `payload_canonical`, which are the RFC-8785 canonical form of `payload`. The hash is computed and
-- checked ONCE, before the first reveal. ⛔ A PREFIX PROJECTION IS A DIFFERENT DOCUMENT and does not
-- hash to it — never publish a second hash for one ceremony (see DECISION B's cost paragraph).
--
-- ⭐ B8 — `bundle_sha256` (column) IS `bundle_hash` (spine). One value, two names (DECISION D).
--
-- ⚠ `payload_canonical` AND `payload` ARE THE SAME DOCUMENT IN TWO FORMS, AND BOTH ARE NEEDED.
-- The TEXT is the exact byte sequence that was hashed — jsonb is a normalising store (it re-orders
-- keys, drops duplicates and renders numerics its own way), so re-serialising the jsonb would NOT
-- reproduce the hashed bytes and could not be used to prove the commitment. The JSONB is what the
-- projection subtracts from, because SQL cannot filter an array inside a text blob.
create table public.verification_bundle (
  id                bigint generated always as identity primary key,
  tournament_id     bigint not null references public.tournament(id) on delete cascade,   -- AD-18 scope

  -- ⭐ UNIQUE, not merely a FK: ONE bundle per ceremony. The commitment is singular or it is not a
  -- commitment (DECISION A). This is also what makes `already_published` a cheap existence test.
  ceremony_id       bigint not null references public.ceremony(id) on delete cascade,

  -- The frozen inputs the document was derived from, copied at publish so the bundle names its own
  -- provenance without a join. ⚠ `snapshot_id` is UNGRANTED (see the grant below): it is the pointer
  -- to the frozen inputs every winner is computable from.
  snapshot_id       bigint not null references public.stat_snapshot(id),
  seed_demo_sha256  text   not null,
  algorithm_version text   not null,

  bundle_sha256     text   not null,
  payload_canonical text   not null,   -- the EXACT bytes that were hashed (RFC-8785, ASCII-only)
  payload           jsonb  not null,   -- the same document, for the SQL projection

  -- ⛔⛔ NULLABLE, AND THAT IS LOAD-BEARING RATHER THAN LAX — MEASURED, NOT REASONED (Story 6.9a,
  -- Task 3's `explain (costs off)` step). This column was written `not null default now()` first, and
  -- the `explain` under `set local role anon` came back with NO FILTER NODE AT ALL:
  --     Index Scan using verification_bundle_ceremony_key on verification_bundle
  --       Index Cond: (ceremony_id = 1)
  -- The planner had proved `published_at is not null` from the NOT NULL constraint and DELETED the
  -- policy qual. ⭐ THAT MAKES `verification_bundle_viewer_read` EXACTLY EQUIVALENT TO `using (true)`
  -- — the predicate has no FALSE side, so the AC12 mutant "widen the viewer policy to using (true)"
  -- is not merely hard to kill, it is SEMANTICALLY IDENTICAL to the shipped policy and UNKILLABLE.
  -- This is 6.8b's reviewer finding one degree worse: there, every fixture ceremony happened to sit on
  -- one side of the predicate; here, no row could ever sit on the other.
  -- ⚠ So the column is nullable, a row with `published_at is null` is a STAGED bundle that anon cannot
  -- read, and the pgTAP suite puts a row on that FALSE side. Nothing in this story writes one —
  -- `publish_bundle` stamps it in the same INSERT — which is precisely why the suite has to.
  published_at      timestamptz,
  released_at       timestamptz,       -- SHELL — DECISION K names its writer

  constraint verification_bundle_ceremony_key unique (ceremony_id),

  -- ⭐ B12 — EVERY CHECK IS `(…) is true` AND IS **NAMED**. "A CHECK that can evaluate NULL is
  -- SATISFIED" (`6-8a:426-431`), and all CHECKs raise the same 23514, so the pgTAP suite asserts the
  -- NAME — a `throws_ok` on the SQLSTATE alone would prove almost nothing (the trap the 4.3 review
  -- found across three suites).
  constraint verification_bundle_sha256_hex
    check ((bundle_sha256 ~ '^[0-9a-f]{64}$') is true),
  constraint verification_bundle_seed_hex
    check ((seed_demo_sha256 ~ '^[0-9a-f]{64}$') is true),

  -- ⭐ B7 — ASCII-RESTRICTED, AND THE RESTRICTION HAS TEETH AT REST TOO. SOLUTION-DESIGN §9.5 makes
  -- the bundle ASCII-only; `publish_bundle` REFUSES a non-ASCII payload with a typed reason, and this
  -- constraint makes the violating row unrepresentable even for a direct service-key INSERT.
  -- ⚠ THE TEST IS `octet_length = length`, NOT A REGEX, AND IT IS TOTAL. A character below U+0080
  -- encodes to exactly one UTF-8 byte and every character at or above it to two or more, so the two
  -- lengths are equal IFF every character is ASCII. A regex character class would depend on the
  -- database's collation and locale; this does not.
  constraint verification_bundle_payload_ascii
    check ((octet_length(payload_canonical) = length(payload_canonical)) is true),

  -- Release can never precede publication, and an UNPUBLISHED bundle cannot be released at all.
  -- ⚠ BOTH columns are nullable, so both NULL arms are spelled out rather than left to three-valued
  -- logic: with `published_at` NULL, `released_at >= published_at` is NULL and `(NULL) is true` is
  -- FALSE — which is the direction we want here (a staged row may not carry a release stamp), but
  -- only because it is stated. R11's rule and this constraint agree; they do not always.
  constraint verification_bundle_release_after_publish
    check ((released_at is null
            or (published_at is not null and released_at >= published_at)) is true)
);

comment on table public.verification_bundle is
  'FR-27/FR-30 + AD-22 (Story 6.9a): the ONE canonical document a ceremony is verifiable against, and '
  'the commitment that binds it. payload_canonical holds the exact RFC-8785 bytes whose SHA-256 is '
  'bundle_sha256 (the spine calls that value bundle_hash — one value, two names, DECISION D); payload '
  'holds the same document as jsonb so verification_bundle_read can SUBTRACT the unrevealed parts. '
  'The commitment is published BEFORE the first reveal and the CONTENT releases progressively per '
  'spin, in full at ceremony.state = complete (DECISION B). ⛔ payload, payload_canonical, '
  'snapshot_id and seed_demo_sha256 are UNGRANTED to anon/authenticated: the commitment is readable '
  'the instant it is published, the content is not. One row per ceremony (the commitment is '
  'singular) and immutable once written (IC912).';

comment on column public.verification_bundle.bundle_sha256 is
  'AD-22''s published commitment: lowercase-hex SHA-256 of the UTF-8 bytes in payload_canonical. '
  '⛔ NOT stat_snapshot.content_sha256, whose own migration says so: "This digest proves the captured '
  'bytes are the bytes and NOTHING more; 6.9 must not inherit it as a constraint" (0024:760-762). '
  'Different input, different purpose, different recipe.';
comment on column public.verification_bundle.payload_canonical is
  'The EXACT byte sequence that was hashed — RFC-8785 (JCS) canonical JSON, ASCII-restricted. '
  '⚠ Re-serialising `payload` would NOT reproduce these bytes (jsonb is a normalising store), which '
  'is why the text form is kept rather than derived.';
comment on column public.verification_bundle.payload is
  'The same document as jsonb, so the projection can filter ARRAY ELEMENTS — which is the one thing a '
  'row policy cannot do, and the whole reason the projection is an RPC (DECISION C).';
comment on column public.verification_bundle.released_at is
  'SHELL (DECISION K): the audit stamp of the moment the FULL document was first served. Nothing in '
  'Story 6.9a writes it — reveal_spin completes the ceremony and AC4 requires its 0029 replacement to '
  'differ from 0028''s by exactly one guard. ⛔ The release gate is ceremony.state = complete, a '
  'predicate guarded by assert_ceremony_transition, NEVER this column: a stored flag can be forged by '
  'an UPDATE, a guarded state machine cannot.';

-- ── ENABLE + FORCE RLS ───────────────────────────────────────────────────────
-- FORCE is non-negotiable: `0003_audit_snapshot_test.sql`'s generic catalog guard asserts that NO
-- public base table lacks FORCE, so it now covers this table too and would fail loudly if omitted.
-- FORCE also applies the policies to the table OWNER, closing the "owner quietly reads everything"
-- gap. It does not affect BYPASSRLS roles — service_role still bypasses.
alter table public.verification_bundle enable row level security;
alter table public.verification_bundle force  row level security;

-- ⭐ TWO SEPARATE POLICIES, **NEVER** OR'd — the `0002:87-98` house form. Postgres OR's permissive
-- policies at eval time anyway, but keeping them separate means a malformed ADMIN policy can only
-- ever add admin's OWN rows; merged into `using (published_at is not null or is_admin())` an
-- admin-clause bug would leak UNPUBLISHED bundles to every viewer. 6.8b's Section E measured exactly
-- that cost, so the property has a behavioural test rather than a DDL one.
create policy verification_bundle_viewer_read on public.verification_bundle for select
  to anon, authenticated
  using (published_at is not null);

create policy verification_bundle_admin_read on public.verification_bundle for select
  to authenticated
  using ((select public.is_admin()));

-- ⛔⛔ THE VIEWER GRANT IS **COLUMN-SCOPED**, AND THAT IS NOT A STYLE CHOICE — A ROW POLICY CANNOT
-- HIDE A COLUMN (`0028:472`, R7). `verification_bundle_viewer_read` alone would publish the WHOLE
-- row, including:
--   * `payload` / `payload_canonical` — the entire document, every unrevealed spin's pool included.
--                                       Publishing either up front breaks AD-22 outright.
--   * `snapshot_id`                   — the pointer to the frozen inputs every winner is computable
--                                       from (and `stat_snapshot_row` holds ZERO anon grant, 0003:83).
--   * `seed_demo_sha256`              — already published on `ceremony` under the contract name
--                                       `seed_hex` (`0028:501`); a SECOND public copy of the same
--                                       value is a second thing to keep in agreement, for no gain.
-- ⚠ A COLUMN ADDED TO THIS TABLE LATER IS UN-GRANTED BY DEFAULT. That is FAIL-CLOSED and correct
-- (`0028:481-483`). ⛔ Do not "fix" a future 42501 on a new column by promoting this to a table-wide
-- grant — add the column to the list below, deliberately, with the story that publishes it.
-- ⚠ AND IT CHANGES HOW THIS TABLE MUST BE QUERIED OVER THE DATA API: PostgREST's default `select=*`
-- asks for EVERY column, so an anon request 42501s on the ungranted ones even though the ROW is
-- visible. THAT FAILURE IS THE GATE WORKING, NOT A BUG — any reader must name its columns.
grant select (id, tournament_id, ceremony_id, algorithm_version, bundle_sha256, published_at, released_at)
  on public.verification_bundle to anon, authenticated;

-- service_role is the sole writer (AD-2) and deliberately holds NO DELETE, matching `ceremony`'s
-- posture (`0024:253`): a commitment is not deleted. UPDATE is granted for `released_at` alone —
-- and the trigger below is what makes that true, because a grant cannot express "one column".
grant select, insert, update on public.verification_bundle to service_role;

comment on policy verification_bundle_viewer_read on public.verification_bundle is
  'AD-22 commit-then-publish (Story 6.9a, AC1): the bundle row becomes viewer-readable the moment it '
  'is published — which is BEFORE the first spin, because that is what makes it a commitment. ⛔ The '
  'ROW policy is only half the gate: a row policy cannot hide a column, so a COLUMN-LEVEL grant '
  'publishes exactly the commitment (bundle_sha256, algorithm_version, the two timestamps and the two '
  'ids) and leaves payload, payload_canonical, snapshot_id and seed_demo_sha256 UNGRANTED. The '
  'CONTENT is served only through verification_bundle_read, which subtracts every unrevealed spin.';
comment on policy verification_bundle_admin_read on public.verification_bundle is
  'Admin-only read, kept SEPARATE from the viewer policy and never OR''d into it (0002:87-98): a '
  'malformed admin clause must only ever be able to add admin''s own rows. Carries the (select …) '
  'init-plan wrap so is_admin() is evaluated once per statement, not once per row.';

-- ════════════════════════════════════════════════════════════════════════════
-- (b) DECISION I — the commitment is IMMUTABLE once written. **IC912**.
-- ════════════════════════════════════════════════════════════════════════════
-- ⛔⛔ THIS IS THE ONLY THING IN 0029 THAT RAISES, AND IT EXISTS BECAUSE NO GRANT CAN EXPRESS IT.
-- `service_role` needs UPDATE (for `released_at`, DECISION K) and carries BYPASSRLS, so neither the
-- policy above nor the column grant can stop the single writer from rewriting `payload_canonical` or
-- `bundle_sha256` after publication. A commitment that can be rewritten is not a commitment: an
-- operator who re-published a "corrected" document would leave every viewer who read the original
-- hash holding a value that no longer binds, with nothing anywhere looking wrong.
-- ⚠ THE `is distinct from` FORM PERMITS value -> THE SAME VALUE as a no-op, exactly as
-- `assert_ceremony_transition` (`0027:515-517`) and `tournament_fair_seed_write_once` (`0024:275`)
-- do, so an idempotent re-write is not an error. What is refused is value -> a DIFFERENT value.
create function public.assert_bundle_immutable() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The committed columns: the document, the commitment, and the provenance the commitment names.
  if new.ceremony_id       is distinct from old.ceremony_id
     or new.snapshot_id       is distinct from old.snapshot_id
     or new.seed_demo_sha256  is distinct from old.seed_demo_sha256
     or new.algorithm_version is distinct from old.algorithm_version
     or new.bundle_sha256     is distinct from old.bundle_sha256
     or new.payload_canonical is distinct from old.payload_canonical
     or new.payload           is distinct from old.payload
     or new.tournament_id     is distinct from old.tournament_id then
    raise exception
      using errcode = 'IC912',
            message = 'verification_bundle ' || old.id || ' for ceremony ' || old.ceremony_id ||
                      ' is a PUBLISHED COMMITMENT and is immutable (AD-22) — refusing to change it',
            hint    = 'the bundle_sha256 a viewer read before the first spin binds these exact bytes; '
                      'a corrected ceremony needs a new snapshot, a new ceremony and a new '
                      'commitment, never an edited row';
  end if;

  -- ⭐ THE TWO TIMESTAMPS ARE WRITE-ONCE, NULL -> value, RATHER THAN FROZEN OUTRIGHT — because
  -- `published_at` is nullable so the viewer policy has a FALSE side (see the column's own comment),
  -- and a STAGED row must therefore be publishable exactly once. `is distinct from` permits
  -- value -> the same value as a no-op, exactly as sections above do.
  -- ⛔ UN-PUBLISHING IS THE ATTACK THIS ARM CLOSES: setting `published_at` back to NULL would retract
  -- a commitment viewers have already read, leaving them holding a hash for a document the database
  -- now denies ever publishing.
  if old.published_at is not null and new.published_at is distinct from old.published_at then
    raise exception
      using errcode = 'IC912',
            message = 'verification_bundle ' || old.id || ' published_at is WRITE-ONCE and is already '
                      'stamped — refusing to change it',
            hint    = 'the commitment is already public; moving or clearing its publication stamp '
                      'would let a bundle claim it preceded a reveal it did not precede';
  end if;

  -- `released_at` is WRITE-ONCE for the same reason. Its writer is 6.9b/6.10 (DECISION K);
  -- un-releasing a document that has already been served in full would be a retraction, not a
  -- correction.
  if old.released_at is not null and new.released_at is distinct from old.released_at then
    raise exception
      using errcode = 'IC912',
            message = 'verification_bundle ' || old.id || ' released_at is WRITE-ONCE and is already '
                      'stamped — refusing to change it',
            hint    = 'the full document has already been served; a release cannot be taken back';
  end if;

  return new;
end;
$$;

comment on function public.assert_bundle_immutable() is
  'AD-22 by MECHANISM (Story 6.9a, DECISION I): a published commitment cannot be edited. Raises '
  'IC912 on any change to tournament_id, ceremony_id, snapshot_id, seed_demo_sha256, '
  'algorithm_version, bundle_sha256, payload_canonical or payload, and makes published_at and '
  'released_at WRITE-ONCE (NULL -> value once, never moved and never cleared) — un-publishing would '
  'retract a commitment viewers have already read. ⚠ It exists because no GRANT can express "one '
  'column": service_role needs UPDATE and has BYPASSRLS, so neither the policy nor the column grant '
  'binds anybody who can actually write here.';

-- A trigger function does not need an EXECUTE grant to FIRE, so revoking costs nothing and closes the
-- direct-call path entirely (`0027:558-563`, applied to both of that migration's trigger functions).
revoke execute on function public.assert_bundle_immutable() from public;

create trigger verification_bundle_immutable
  before update on public.verification_bundle
  for each row execute function public.assert_bundle_immutable();

comment on trigger verification_bundle_immutable on public.verification_bundle is
  'The commitment, frozen. Without it the one role that can write here (service_role, BYPASSRLS) '
  'could rewrite the hashed bytes of a bundle whose hash viewers had already read.';

-- ════════════════════════════════════════════════════════════════════════════
-- (c) AC10.1 — `ceremony.luck_weight_table` is FROZEN once the ceremony leaves `not_started`.
--     CLOSES deferred-work.md:361.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ THE ITEM, VERBATIM (`deferred-work.md:361`): "It is an INPUT every drawn byte is a pure function
-- of … editing it after a run silently changes what a re-derivation produces while `snapshot_id` and
-- `seed_demo_sha256` — THE TWO THINGS A VERIFIER CHECKS — both still match." That is the exact shape
-- of defect this whole story exists to make impossible: the published commitment would keep binding,
-- the seed would keep matching, and a verifier re-deriving Stage 1 from the bundle's `luck` key would
-- produce different weights than the ones that actually drew the ceremony.
--
-- ⚠⚠ READ `0027:99-116` (DECISION 4) BEFORE TOUCHING THIS FUNCTION. It is deliberately NOT a column
-- allowlist: `lock_ceremony`'s `on conflict do update` sets `state`, `seed_demo_sha256`,
-- `snapshot_id` AND `started_at` in one statement (`0024:815-819`), `persist_ceremony` writes
-- `spin_plan` + `state`, `reveal_spin` writes `state` + `completed_at`, and `publish_bundle` below
-- writes `algorithm_version`. All four must stay writable. The addition is ONE state-conditional
-- clause and nothing else.
--
-- ⚠ WHY `old.state <> 'not_started'` AND NOT "once locked": `0025:450` backfilled every existing row
-- (`update public.ceremony set luck_weight_table = default where luck_weight_table is null`) and the
-- column carries a DEFAULT since `0025:445`, so a `not_started` ceremony can still be re-tuned — which
-- is what SPEC:97 means by "fairness-affecting values are published in the verification bundle so
-- tuning stays reproducible". The freeze bites at the LOCK, which is the moment the inputs stop
-- moving (AD-15), not at the first spin.
--
-- ⛔ THE DIFF AGAINST `0027:476-548` IS EXACTLY ONE ADDED BLOCK (section 2b below) AND THIS COMMENT.
-- Verified by diff; the diff is pasted in the story's Completion Notes.
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

  -- ── 2b. ⭐ STORY 6.9a, AC10.1 — THE THIRD FROZEN COLUMN, AND THE ONLY CHANGE IN THIS BODY.
  -- `luck_weight_table` is Stage 1's published weight source: every byte the ceremony draws is a pure
  -- function of it (AD-14). It is NOT write-once like the two above — it is STATE-CONDITIONAL, because
  -- tuning a `not_started` ceremony is legitimate and is what SPEC:97's "tuning stays reproducible"
  -- describes. From `locked` onward the inputs have stopped moving (AD-15), so an edit here would
  -- change what a re-derivation produces while `snapshot_id` and `seed_demo_sha256` — the two things a
  -- verifier checks — both still matched. `deferred-work.md:361`, closed.
  -- ⚠ `is distinct from` is NULL-safe in both directions, which matters: a pre-0025 row could hold
  -- NULL, and `<>` would silently pass NULL -> value while this refuses it.
  --
  -- ⛔⛔ THE PREDICATE READS **BOTH** STATES — CORRECTED BY THE 6.9a CODE REVIEW. It used to key on
  -- `old.state` alone, which left one statement's worth of daylight:
  --
  --     update ceremony set state = 'locked', luck_weight_table = array[9,8,7]
  --      where id = C and state = 'not_started';
  --
  -- One legal forward step for the state machine, and `old.state = 'not_started'` for the freeze —
  -- so the weights changed AT the lock rather than before it, and the ceremony entered `locked`
  -- with inputs that had just moved. AD-15's "the inputs have stopped moving from `locked` onward"
  -- was one statement weaker than it claimed. Section E's `lives_ok` case could not catch it: it
  -- edits a ceremony that STAYS `not_started`, so the combined update was never exercised.
  -- ⚠ Both sides are required. Keying on `new.state` alone would forbid the legitimate
  -- `not_started -> not_started` tuning edit that SPEC:97 explicitly allows.
  if (old.state is distinct from 'not_started' or new.state is distinct from 'not_started')
     and new.luck_weight_table is distinct from old.luck_weight_table then
    raise exception
      using errcode = 'IC910',
            message = 'ceremony ' || old.id || ' luck_weight_table is FROZEN once the ceremony leaves '
                      'not_started (' || coalesce(old.state, '<null>') || ' -> ' ||
                      coalesce(new.state, '<null>') || ') — refusing to change it',
            hint    = 'the luck meter is a Stage-1 INPUT every drawn byte is a pure function of; '
                      'editing it after the lock changes what a re-derivation produces while '
                      'snapshot_id and seed_demo_sha256 — the two things a verifier checks — both '
                      'still match (deferred-work.md:361)';
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

-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED, AND IT HAS TO BE. `create or replace` PRESERVES the existing
-- `pg_description` entry, so `0027:550-556`'s text would have survived unchanged and would now
-- describe a function guarding one fewer column than it actually guards — precisely the stale-comment
-- class this epic's migrations are written against. This is 0027's comment with the
-- `luck_weight_table` sentence added and nothing else altered.
comment on function public.assert_ceremony_transition() is
  'AD-15/AD-13 by MECHANISM (Story 6.8a, DECISION 4 — closes deferred-work.md:277). Permits only '
  'not_started -> locked -> spinning -> complete, one step forward at a time; freezes snapshot_id '
  'and seed_demo_sha256 write-once once non-NULL; pins tournament_id. ⭐ AND (Story 6.9a, AC10.1 — '
  'closes deferred-work.md:361) freezes luck_weight_table once the ceremony leaves not_started: it is '
  'a Stage-1 input every drawn byte is a pure function of, so editing it after the lock changes what a '
  're-derivation produces while the two things a verifier checks both still match. Raises IC910. '
  '⚠ It is NOT a column allowlist: lock_ceremony (0024:815-819) legitimately sets state, '
  'seed_demo_sha256, snapshot_id and started_at in one statement, 0025 backfills luck_weight_table, '
  'persist_ceremony writes spin_plan and publish_bundle writes algorithm_version, so an allowlist of '
  'state+spin_plan would break every shipped ceremony writer.';

-- ⚠ NO trigger is re-created and NO revoke is re-issued: `create or replace` preserves both the
-- trigger binding (`ceremony_transition_valid`, `0027:565-567`) and the function's privileges
-- (`0027:563`). Re-issuing would be harmless but would imply they had been lost, which they have not.

-- ════════════════════════════════════════════════════════════════════════════
-- (d) AC10.2 — `tournament` stops publishing `fair_seed`. CLOSES deferred-work.md:370.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ THE ITEM, VERBATIM (`0028:134-137`): "⭐ HOMED TO 6.9, which builds the verifier and therefore
-- owns which column a verifier reads. The fix is a column-scoped grant on `tournament` — NOT a change
-- to 0028." This is that grant.
--
-- WHAT IS ACTUALLY BEING FIXED, PRECISELY, SO NOBODY OVER- OR UNDER-READS IT (`0028:123-133`):
--   * It is NOT a secrecy leak. `tournament.fair_seed` is SHA-256(final demo) (`0001:33`) — the SAME
--     value `lock_ceremony` copies into `ceremony.seed_demo_sha256` (`0024:198`) and the same value
--     `0028:501` deliberately publishes under the contract name `seed_hex`. A viewer reading the
--     identical hash from a second column learns nothing they are not entitled to.
--   * It IS a broken justification. 6.2's DECISION F loosened the `IC908` write-once trigger to permit
--     value -> NULL so `rollback_match` can un-crown, and justified that ONLY because "6.2 publishes
--     the seed to nobody before it" — a premise that was ALREADY FALSE when written, because
--     `0002:70` had granted `tournament` table-wide since the beginning. So today TWO public columns
--     carry the commitment and ONE OF THEM CAN BE UN-PUBLISHED: a `rollback_match` before the ceremony
--     locks makes the anon-visible `tournament.fair_seed` go NULL while `ceremony.seed_demo_sha256`
--     (once written) holds. ⭐ THIS STORY OWNS WHICH COLUMN A VERIFIER READS, and the answer is
--     `ceremony.seed_demo_sha256` — so the rollback-nullable copy stops being public.
--
-- ⛔⛔ THIS IS THE TREE'S **FIRST** `revoke … on table`. Every other revoke anywhere in
-- `supabase/migrations` is `revoke execute on function` (`0028:121-122`, measured). It is written as
-- revoke-then-grant rather than as a narrowing because PostgreSQL has no "narrow a grant" verb: a
-- table-level `grant select` and a column-level one are separate ACL entries and the table-level one
-- would keep winning.
--
-- ⛔⛔ AND THE COLUMN LIST IS THE ONE PLACE THIS MIGRATION CAN SILENTLY BREAK A SHIPPED VIEWER PAGE.
-- `tournament` has **NINE** columns and `grace_period_seconds` was added at `0015:76` — AFTER
-- `0002:70`'s grant — so a naive "copy 0001's column list" would enumerate eight, omit
-- `grace_period_seconds`, and silently kill Story 4.5's MM:SS grace countdown and the 5.7 surfaces
-- that read the tournament row. ⚠ ALL NINE ARE ENUMERATED HERE and EIGHT are granted; `fair_seed` is
-- the ONLY omission:
--   id · season_id · name · state · format_default · final_match_id · created_at ·
--   grace_period_seconds   ->  GRANTED (eight)
--   fair_seed              ->  ⛔ NOT granted (the whole point of this section)
-- The story's THE BAR run rebuilds the Next app against the LOCAL stack and proves the grace timer
-- and the 5.7 surfaces still render, because a nine-column enumeration typo has no other detector.
--
-- ⚠ A COLUMN ADDED TO `tournament` LATER IS UN-GRANTED BY DEFAULT — the same fail-closed rule
-- `0028:481-483` states for `ceremony`, restated here because this table did not have that property
-- five minutes ago. ⛔ Do not "fix" a future 42501 on a new tournament column by restoring the
-- table-wide grant; add the column to the list below, deliberately, with the story that publishes it.
-- ⚠ AND `select=*` ON `tournament` NOW 42501s FOR anon, exactly as it does for `ceremony`. Every
-- shipped reader already names its columns (proven by the Next build in THE BAR); a future one must.
revoke select on public.tournament from anon, authenticated;

grant select (id, season_id, name, state, format_default, final_match_id, created_at,
              grace_period_seconds)
  on public.tournament to anon, authenticated;

comment on column public.tournament.fair_seed is
  'AD-13 SHA-256(final demo), frozen at approval. ⛔ NOT viewer-readable since Story 6.9a (AC10.2, '
  'closes deferred-work.md:370): 0002:70 granted this table WIDE, which published a column that '
  'rollback_match can set back to NULL — a commitment that does not bind. The published commitment is '
  'ceremony.seed_demo_sha256 under the contract name seed_hex (0028:495-502), which '
  'assert_ceremony_transition makes write-once. ⛔ If a later story "simplifies" a verifier to read '
  'this column, it re-opens 6.2''s hole.';

-- ════════════════════════════════════════════════════════════════════════════
-- (e) AC10.3 / AC10.4 — `spin` gains the two provenance columns and the positivity CHECK.
--     CLOSES deferred-work.md:363 and 0028:643-653.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ DECISION F. `0027:1025-1032` carries `label` and `bytes_consumed` on the wire and refuses to
-- persist them, homing the decision here by name. They are PROVENANCE, and they cannot live only in
-- the bundle: the bundle is DERIVED FROM THE DATABASE (that is what makes it re-derivable after the
-- producer's process exits and what `verification_bundle_read` projects from), so a field the
-- database does not hold is a field the bundle cannot carry.
alter table public.spin
  add column label          text,
  add column bytes_consumed bigint;

comment on column public.spin.label is
  'FR-27 provenance (Story 6.9a, DECISION F — closes deferred-work.md:363): the PRNG domain-separation '
  'key this spin''s stream was opened with — inclusivcup/v1/stage1/spin/<S> for a main spin, '
  'inclusivcup/v1/pity for a consolation one. worker/awards calls it "the single most load-bearing '
  'fact in a provably-fair ceremony": it is what 6.9b''s browser verifier re-opens each stream by. '
  '⚠ NULLABLE, and NULL is the honest sentinel for "persisted before 0029" — persist_ceremony has '
  'carried the value on the wire since 0027 but wrote it nowhere, so rows written by 6.8a/6.8b hold '
  'no label and no back-fill can invent one.';
comment on column public.spin.bytes_consumed is
  'FR-27 provenance (Story 6.9a, DECISION F): bytes drawn from this spin''s stream, MEASURED FROM THE '
  'STREAM and never re-derived (roulette/vectors/README.md:531-535 calls it "the only externally '
  'visible proof that both runtimes walked the same stream"). ⚠ FOR A PITY SPIN THE WHOLE '
  'CONSOLATION STREAM IS ATTRIBUTED TO THE FIRST ONE AND THE REST CARRY 0 — FR-28 draws the entire '
  'reveal order from ONE stream, so there is no such thing as a per-consolation-spin byte count, and '
  'stamping each with the run total made sum(bytes_consumed) report 28 x 27 = 756 bytes for a 27-byte '
  'stream (6.8a code review). The sum over a ceremony is therefore the honest whole-ceremony figure. '
  '⚠ NULLABLE for rows persisted before 0029, exactly as label is.';

-- ⭐ AC10.4 — the CHECK `0028:643-653` recorded as owed: "the durable fix is a
-- `check (spin_index > 0) is true` on `spin`, which belongs with a migration that owns that table.
-- Recorded, not smuggled in here." This migration owns that table, so here it is.
--
-- ⚠ WHY IT MATTERS RATHER THAN BEING TIDINESS: `reveal_spin`'s IC911 density theorem is "over a
-- DISTINCT subset of the POSITIVE integers, max = count holds iff the subset is {1..count}", and
-- `0028:643-651` corrected its own header to admit that the positivity half was an ASSUMPTION, not a
-- constraint — indexes {-5, 0, 3} give count = 3 and max = 3 and the density half does not fire.
-- This is what makes the theorem sound.
--
-- ⚠ R11 (`0028:74-76`): a CHECK that can evaluate NULL is SATISFIED, so it is written `(…) is true`.
-- `spin_index` is `not null` (`0025:112`), so the wrapper is belt to that suspenders — kept because
-- the NEXT constraint on this table is the case where it genuinely inverts (see the clean-apply note).
alter table public.spin
  add constraint spin_index_positive check ((spin_index > 0) is true);

-- ⛔⛔ THE `is null or` DISJUNCT IS LOAD-BEARING — READ THE CLEAN-APPLY NOTE IN THE HEADER.
-- `bytes_consumed` is NULL on every row that existed a statement ago, and `(NULL >= 0) is true` is
-- FALSE, not unknown. The naive `check ((bytes_consumed >= 0) is true)` would therefore refuse every
-- pre-existing spin row and this migration would FAIL TO APPLY against the QA corpus while passing a
-- fresh `supabase db reset` — the 4.3 trap, arriving from the direction R11's rule does not cover.
alter table public.spin
  add constraint spin_bytes_consumed_non_negative
    check ((bytes_consumed is null or bytes_consumed >= 0) is true);

comment on constraint spin_index_positive on public.spin is
  'AC10.4 (Story 6.9a — closes 0028:643-653): spin indexes are 1-based and positive. It is what makes '
  'reveal_spin''s IC911 density theorem SOUND — max = count implies {1..count} only over a distinct '
  'subset of the POSITIVE integers, and until now nothing bounded the set below.';
comment on constraint spin_bytes_consumed_non_negative on public.spin is
  'A byte count cannot be negative. ⛔ The `is null or` disjunct is REQUIRED, not defensive: every row '
  'that predates 0029 holds NULL here, and `(NULL >= 0) is true` is FALSE — the naive form would have '
  'refused every existing row and broken the migration''s clean apply.';

-- ════════════════════════════════════════════════════════════════════════════
-- (f) AC4 — `publish_bundle`: the commitment, VALIDATED rather than trusted.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐ THE FULL HOUSE RPC FORM (`0027:600-1169` / `0028:552-903` are the shapes being copied):
-- `security invoker` + `set search_path = ''` + every reference schema-qualified · an UNLOCKED
-- existence peek that must not lock · the locks in canonical order · a re-read under the lock · EVERY
-- GUARD BEFORE ANY WRITE, each returned as a typed `{ok:false, reason:'<snake_case>', …context}` ·
-- the literal separator comment · exactly ONE audit_log row with before/after · `revoke execute …
-- from public` then `grant execute … to service_role`.
--
-- ⚠⚠ LOCK ORDER — `tournament` THEN `ceremony`, a SUBSET of `persist_ceremony`'s in the SAME RELATIVE
-- ORDER (`0027:583-589`). `lock_ceremony` takes match -> stat_row -> tournament and touches `ceremony`
-- while holding all three (`0024:429-450, 813`). ⛔ Taking `ceremony` FIRST here "because it is the
-- subject" would invert the pair against both and build the exact 40P01 ABBA deadlock 0024's
-- DECISION E exists to prevent. Do not reorder these two statements.
--
-- ⭐⭐ B9 — VALIDATED, NOT TRUSTED, AND THAT IS THE WHOLE POINT OF THIS FUNCTION EXISTING AT ALL.
-- A thin insert would let a producer bug publish a commitment that does not bind — a
-- `bundle_sha256` that is not the hash of `payload_canonical` binds NOTHING, and nobody would find
-- out until a viewer's browser said the ceremony was rigged. So this function RE-DERIVES the hash
-- from the bytes it was handed (`encode(sha256(convert_to(p_payload,'UTF8')),'hex')`), re-checks the
-- ASCII restriction, re-checks the document's shape against the DATABASE's own spin/award/player
-- counts, and re-checks `seed_hex` and `algo_version` against the frozen ceremony row. `0027`'s
-- thesis, applied to the one document whose bytes are load-bearing forever.
--
-- ⭐ THE CLOSED REFUSAL-REASON SET, DECLARED ONCE, HERE:
--     no_ceremony · ceremony_not_spinning · already_published · reveal_in_progress ·
--     snapshot_missing · seed_missing · no_spins · bundle_mismatch · non_ascii_payload ·
--     payload_shape · seed_mismatch · algo_version_mismatch · award_revealed_twice · unknown_actor
-- ⚠ The pgTAP suite reads this set out of the function's OWN `prosrc` rather than comparing it to a
-- literal copied beside it — 6.8a's review found a "closed set" test asserting "against a hand-copied
-- duplicate of itself", this project's signature defect at its seventh occurrence.
--
-- ⭐⭐ `award_revealed_twice` CLOSES `deferred-work.md:362`, AND IT CATCHES RATHER THAN NOTES.
-- `award_result_spin_award_key` is `unique (spin_id, award_id)` — PER SPIN — so the same trophy
-- decided in two spins of one ceremony is REPRESENTABLE, and `0027:136-140` homed the ceremony-wide
-- cross-check to "6.9, which hashes these bytes and would catch it in the bundle". A bundle that
-- published one award twice would hash perfectly and describe an impossible ceremony.
-- ⚠ IT IS CHECKED ON BOTH SIDES OF THE SEAM: over the DATABASE's `award_result ⋈ spin` (authoritative
-- — that is the ceremony that actually happened) AND over the payload's own `awards` array (which is
-- what gets hashed). Either alone would pass while the other was wrong.
--
-- ⚠ THE COMMITMENT MUST PRECEDE THE FIRST REVEAL, WHICH IS WHY `reveal_in_progress` IS HERE AND WHY
-- `reveal_spin` GAINS `bundle_not_published` IN SECTION (h). A commitment published AFTER an outcome
-- is known is not a commitment; the two guards are the same rule read from both ends, and either one
-- alone leaves the other order legal.
create function public.publish_bundle(
  p_ceremony_id   bigint,
  p_payload       text,
  p_bundle_sha256 text,
  p_actor         text
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  -- ⭐ DECISION H — THE PINNED ALGORITHM VERSION. `0024:200` created `ceremony.algorithm_version` as
  -- a SHELL naming this story as its writer and naming this exact literal. A MAJOR bump is "a
  -- deliberate, ceremony-invalidating act, not a refactor" (`labels.go:34-35`), so it costs a
  -- migration — deliberately. ⛔ Do not soften this into a prefix match or a regex.
  c_algo_version constant text := 'inclusivcup-roulette-1.0.0';

  v_tournament    bigint;
  v_state         text;
  v_snapshot      bigint;
  v_seed          text;
  v_algo          text;
  v_published_at  timestamptz;
  v_doc           jsonb;
  v_computed      text;
  v_spins         int;
  v_main_spins    int;
  v_revealed      int;
  v_players       int;
  v_awards        int;
  v_pity_spins    int;   -- 6.9a code review: bounds pity.reveal_order against the real pity spins
  v_bad           text;
  v_now           timestamptz;
  v_bundle_id     bigint;
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
  select c.state, c.snapshot_id, c.seed_demo_sha256, c.algorithm_version
    into v_state, v_snapshot, v_seed, v_algo
    from public.ceremony c where c.id = p_ceremony_id;

  -- ══ 2. GUARDS — every one of them before ANY write, each RETURNED with its context keys.

  -- ⛔ THE NULL RE-CHECK IS A REAL RACE, NOT A FORMALITY — `0027:654-664` measured it and `0028:597`
  -- restates it. The peek at step 1 is deliberately UNLOCKED, so the ceremony can be deleted (via its
  -- tournament, which cascades) between the peek and the lock at 1b. `perform … for update` does not
  -- raise on zero rows, so the re-read at 1c leaves v_state NULL — and `NULL <> 'spinning'` is NULL,
  -- not TRUE, so the next guard would NOT fire and control would fall through to a wrong diagnosis.
  if v_state is null then
    return jsonb_build_object('ok', false, 'reason', 'no_ceremony', 'ceremony_id', p_ceremony_id);
  end if;

  -- Only a ceremony whose run is PERSISTED and not yet finished can be committed to. `locked` means
  -- persist_ceremony has not run (there is nothing to hash); `complete` means every outcome is
  -- already public, and a commitment published then commits to nothing.
  if v_state <> 'spinning' then
    return jsonb_build_object('ok', false, 'reason', 'ceremony_not_spinning',
                              'ceremony_state', v_state, 'ceremony_id', p_ceremony_id);
  end if;

  -- ⭐ ONE BUNDLE PER CEREMONY (DECISION A). `verification_bundle_ceremony_key` would refuse the
  -- second INSERT anyway, as a 23505 with no explanation; this says what happened and when.
  -- ⚠ THE TEST IS ROW EXISTENCE, NOT `published_at is not null`, AND THE DIFFERENCE MATTERS ONCE
  -- `published_at` IS NULLABLE. A STAGED row (published_at NULL — the row the pgTAP suite puts on the
  -- viewer policy's FALSE side) still occupies this ceremony's single bundle slot, and
  -- `verification_bundle_ceremony_key` would refuse a second INSERT as a bare 23505. The refusal
  -- carries the stamp, so a NULL there tells the operator "staged, not published" rather than lying.
  select b.published_at into v_published_at
    from public.verification_bundle b where b.ceremony_id = p_ceremony_id;
  if found then
    return jsonb_build_object('ok', false, 'reason', 'already_published',
                              'ceremony_id', p_ceremony_id, 'published_at', v_published_at);
  end if;

  -- ⭐ THE COMMITMENT MUST PRECEDE THE FIRST REVEAL. See the header: this and section (h)'s
  -- `bundle_not_published` are the same rule read from both ends.
  -- ⚠ `count(*)` cannot return NULL, so the guard cannot be NULL-valued — stated because this epic has
  -- paid four times for a NULL-valued guard condition being read as FALSE.
  select count(*)::int into v_revealed
    from public.spin s
   where s.ceremony_id = p_ceremony_id and s.revealed_at is not null;
  if v_revealed > 0 then
    return jsonb_build_object('ok', false, 'reason', 'reveal_in_progress',
                              'revealed_spins', v_revealed,
                              'hint', 'a commitment published after an outcome is known is not a '
                                      'commitment (AD-22); publish before the first reveal');
  end if;

  if v_snapshot is null then
    return jsonb_build_object('ok', false, 'reason', 'snapshot_missing', 'ceremony_id', p_ceremony_id);
  end if;
  if v_seed is null then
    return jsonb_build_object('ok', false, 'reason', 'seed_missing', 'ceremony_id', p_ceremony_id);
  end if;

  select count(*)::int, count(*) filter (where s.kind = 'main')::int
    into v_spins, v_main_spins
    from public.spin s where s.ceremony_id = p_ceremony_id;
  if v_spins = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_spins', 'ceremony_id', p_ceremony_id);
  end if;

  -- ── 2b. THE BYTES THEMSELVES, before anything is parsed out of them. ───────────────────────
  -- ⭐ B7 — ASCII-RESTRICTED (SOLUTION-DESIGN §9.5).
  -- ⛔⛔ CORRECTED BY THE 6.9a CODE REVIEW. This comment used to claim the restriction is "the first
  -- constraint in this project to give teeth to `deferred-work.md:265-266`" (award `name` accepts
  -- zero-width U+200B/200E/FEFF and has no length bound). ⛔ IT IS NOT, AND IT CANNOT BE. DECISION
  -- N drops `name` from the bundle, and every field that remains is digits, snake_case identifiers,
  -- decimal strings or `inclusivcup/v1/…` labels — so NO producer-controlled value can ever be
  -- non-ASCII and this refusal is UNREACHABLE in production. It is kept as genuine defence-in-depth
  -- against a field added later, and because it is what makes `octet_length = length` a sound total
  -- ASCII test for the stored bytes; it is NOT the zero-width fix. `deferred-work.md:265-266`
  -- stays OPEN, and its guard belongs where award names reach a viewer.
  -- ⚠ `octet_length = length` is the total ASCII test — see the constraint of the same name in
  -- section (a) for why it beats a regex.
  if p_payload is null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape', 'detail', 'payload is null');
  end if;
  if octet_length(p_payload) <> length(p_payload) then
    return jsonb_build_object('ok', false, 'reason', 'non_ascii_payload',
                              'payload_chars', length(p_payload),
                              'payload_bytes', octet_length(p_payload),
                              'hint', 'the bundle is ASCII-restricted (SOLUTION-DESIGN §9.5); a '
                                      'non-ASCII award name must be corrected at its source, never '
                                      'escaped into the hashed bytes');
  end if;

  -- ⭐⭐ B9 — THE HASH IS RE-DERIVED, NEVER TRUSTED. If the caller's `bundle_sha256` is not the hash
  -- of the caller's own bytes, the commitment binds nothing.
  -- ⚠ BARE `sha256`/`encode`/`convert_to`, NOT SCHEMA-QUALIFIED, AND THAT IS CORRECT UNDER
  -- `search_path = ''`: they are pg_catalog built-ins, and pg_catalog is searched implicitly whatever
  -- the search_path says. Same call, byte for byte, as `0024:776` — ⛔ though NOT the same RECIPE:
  -- that one hashes a separator-joined rendering of the snapshot rows and `0024:760-762` says outright
  -- "6.9 must not inherit it as a constraint". Different input, different purpose.
  v_computed := encode(sha256(convert_to(p_payload, 'UTF8')), 'hex');
  if v_computed is distinct from lower(p_bundle_sha256) then
    return jsonb_build_object('ok', false, 'reason', 'bundle_mismatch',
                              'computed_sha256', v_computed,
                              'claimed_sha256', coalesce(p_bundle_sha256, '<null>'));
  end if;

  -- ── 2c. THE DOCUMENT'S SHAPE. ─────────────────────────────────────────────────────────────
  -- ⛔⛔ THE CAST IS INSIDE ITS OWN BLOCK BECAUSE A CAST IS NOT A GUARD. `'{'::jsonb` raises 22P02
  -- from inside the function whose job is to RETURN a typed reason. Nothing has been written at this
  -- point, so the sub-transaction an exception handler establishes costs only itself.
  begin
    v_doc := p_payload::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'the payload is not valid JSON');
  end;

  -- ⚠⚠ `jsonb_typeof` IS STRICT: a MISSING key yields SQL NULL, and a NULL `if` condition is FALSE,
  -- so a payload omitting a key falls through every guard that does not `coalesce`. This function
  -- validates a WHOLE DOCUMENT, which makes it the single most likely place in the tree to fail open.
  if coalesce(jsonb_typeof(v_doc), 'absent') <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'the payload is not a JSON object',
                              'payload_type', coalesce(jsonb_typeof(v_doc), 'absent'));
  end if;

  -- ⭐ EXACTLY THE SEVEN SPECCED KEYS (`SOLUTION-DESIGN:431-435` / `SPINE:222` / `epics.md:1164`),
  -- checked in BOTH directions: an unexpected key is as much a defect as a missing one, because a
  -- verifier that ignores unknown keys would hash bytes it never read.
  select string_agg(k, ',' order by k) into v_bad
    from jsonb_object_keys(v_doc) k
   where k not in ('algo_version', 'seed_hex', 'luck', 'spin_plan', 'awards', 'pity', 'players');
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'unexpected top-level keys', 'keys', v_bad);
  end if;

  select string_agg(k, ',' order by k) into v_bad
    from unnest(array['algo_version', 'seed_hex', 'luck', 'spin_plan', 'awards', 'pity', 'players']) k
   where not (v_doc ? k);
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'missing top-level keys', 'keys', v_bad);
  end if;

  -- Each key's own type. ⚠ Every `jsonb_typeof` is coalesced for the reason stated above.
  select string_agg(x.k || '=' || x.t, ',' order by x.k) into v_bad
    from (
      select 'algo_version' as k, coalesce(jsonb_typeof(v_doc -> 'algo_version'), 'absent') as t
      union all select 'seed_hex',  coalesce(jsonb_typeof(v_doc -> 'seed_hex'), 'absent')
      union all select 'luck',      coalesce(jsonb_typeof(v_doc -> 'luck'), 'absent')
      union all select 'spin_plan', coalesce(jsonb_typeof(v_doc -> 'spin_plan'), 'absent')
      union all select 'awards',    coalesce(jsonb_typeof(v_doc -> 'awards'), 'absent')
      union all select 'pity',      coalesce(jsonb_typeof(v_doc -> 'pity'), 'absent')
      union all select 'players',   coalesce(jsonb_typeof(v_doc -> 'players'), 'absent')
    ) x
   where (x.k in ('algo_version', 'seed_hex') and x.t <> 'string')
      or (x.k in ('luck', 'pity')             and x.t <> 'object')
      or (x.k in ('spin_plan', 'awards', 'players') and x.t <> 'array');
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a top-level key has the wrong JSON type', 'types', v_bad);
  end if;

  -- ⭐ THE DOCUMENT DESCRIBES **THIS** CEREMONY, COUNTED AGAINST THE DATABASE. A bundle whose
  -- `spin_plan` is short by one entry hashes perfectly and commits to a ceremony that never ran; only
  -- the database can say how many spins there actually were. `players` is counted against the FROZEN
  -- snapshot (`stat_snapshot_row`), never against a live table — the whole point of AD-19.
  select count(*)::int into v_players
    from public.stat_snapshot_row r where r.snapshot_id = v_snapshot;
  if jsonb_array_length(v_doc -> 'spin_plan') <> v_spins then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'spin_plan does not describe this ceremony''s spins',
                              'payload_spins', jsonb_array_length(v_doc -> 'spin_plan'),
                              'ceremony_spins', v_spins);
  end if;
  if jsonb_array_length(v_doc -> 'players') <> v_players then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'players does not match the frozen snapshot',
                              'payload_players', jsonb_array_length(v_doc -> 'players'),
                              'snapshot_rows', v_players);
  end if;

  -- ⭐ EVERY `spin_plan` ENTRY NAMES A REAL SPIN OF THIS CEREMONY, BY INDEX — which is also what makes
  -- `verification_bundle_read`'s `(e ->> 'spin')::int` cast safe. The text is proven integral BEFORE
  -- anything casts it (`0028:1468-1478`'s lesson: a cast is not a guard).
  select string_agg(distinct coalesce(e ->> 'spin', '<null>'), ',') into v_bad
    from jsonb_array_elements(v_doc -> 'spin_plan') e
   where coalesce(e ->> 'spin', '') !~ '^[1-9][0-9]{0,8}$';
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a spin_plan entry has no usable 1-based spin index',
                              'spins', v_bad);
  end if;

  select string_agg(distinct (e ->> 'spin'), ',') into v_bad
    from jsonb_array_elements(v_doc -> 'spin_plan') e
   where not exists (
     select 1 from public.spin s
      where s.ceremony_id = p_ceremony_id and s.spin_index = (e ->> 'spin')::int
   );
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a spin_plan entry names a spin this ceremony does not have',
                              'spins', v_bad);
  end if;

  -- ⛔⛔ EVERY SPIN NAMED **EXACTLY ONCE** — ADDED BY THE 6.9a CODE REVIEW, AND THE COUNT ABOVE DID
  -- NOT IMPLY IT. `jsonb_array_length(spin_plan) = v_spins` plus a per-entry `exists` is satisfied
  -- by FORTY COPIES OF SPIN 1: the length matches, every entry's index is a real spin of this
  -- ceremony, and the B3 type check passes on all forty. The document would publish and hash
  -- perfectly while describing one spin forty times and thirty-nine spins not at all, and
  -- `verification_bundle_read` would then serve forty identical entries as the reveals land.
  -- ⚠ The `distinct` inside `string_agg(distinct …)` above is what REPORTS offenders compactly; it
  -- is not a uniqueness test, and reading it as one is how this gap survived. The awards side had
  -- a real `group by … having count(*) > 1` from the start; the spin side had no counterpart.
  select string_agg(t.spin, ',' order by t.spin) into v_bad
    from (
      select e ->> 'spin' as spin
        from jsonb_array_elements(v_doc -> 'spin_plan') e
       group by 1 having count(*) > 1
    ) t;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a spin_plan entry is duplicated; every spin must appear exactly once',
                              'spins', v_bad);
  end if;

  -- ⭐ AND THE COVER IS TOTAL IN THE OTHER DIRECTION TOO. Uniqueness plus a matching count implies
  -- it today, but the implication is arithmetic rather than stated, and a future change to either
  -- guard would silently drop it. Asserted directly so "the document describes THIS ceremony" is
  -- proven from the database's side, not inferred from two numbers agreeing.
  select string_agg(s.spin_index::text, ',' order by s.spin_index) into v_bad
    from public.spin s
   where s.ceremony_id = p_ceremony_id
     and not exists (
       select 1 from jsonb_array_elements(v_doc -> 'spin_plan') e
        where (e ->> 'spin') = s.spin_index::text
     );
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'this ceremony has spins the spin_plan does not name',
                              'spins', v_bad);
  end if;

  -- ⛔⛔ `players` IS CHECKED BY IDENTITY, NOT ONLY BY CARDINALITY — ADDED BY THE 6.9a CODE REVIEW.
  -- The count guard above compares two integers and nothing else, so a payload carrying 28 entries
  -- with 28 steamid64s that are NOT in the frozen snapshot — or the same player 28 times — passed,
  -- published and hashed. `players` is served ungated to anon (B4), so the fabrication would be the
  -- verifier's entire view of the roster.
  select string_agg(t.sid, ',' order by t.sid) into v_bad
    from (
      select coalesce(e ->> 'steamid64', '<null>') as sid
        from jsonb_array_elements(v_doc -> 'players') e
       where not exists (
         select 1 from public.stat_snapshot_row r
          where r.snapshot_id = v_snapshot and r.steamid64 = e ->> 'steamid64'
       )
       union
      select e ->> 'steamid64'
        from jsonb_array_elements(v_doc -> 'players') e
       group by 1 having count(*) > 1
    ) t;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a players entry is not in the frozen snapshot, or is duplicated',
                              'steamid64s', left(v_bad, 400));
  end if;

  -- ⛔⛔ `awards` IS CHECKED BY IDENTITY TOO, and this one had a live consequence rather than a
  -- theoretical one: `verification_bundle_read` joins the served awards on
  -- `ar.award_id::text = (t.e ->> 'award_id')`, so a payload naming another tournament's award ids
  -- publishes cleanly and then serves ZERO awards FOREVER — a permanently unverifiable ceremony
  -- behind a valid-looking commitment. The comment above the count guard claimed "every award the
  -- ceremony decided appears EXACTLY once in the document"; the code below it compared two integers.
  select string_agg(t.aid, ',' order by t.aid) into v_bad
    from (
      select coalesce(e ->> 'award_id', '<null>') as aid
        from jsonb_array_elements(v_doc -> 'awards') e
       where not exists (
         select 1
           from public.award_result ar
           join public.spin s on s.id = ar.spin_id
          where s.ceremony_id = p_ceremony_id and ar.award_id::text = e ->> 'award_id'
       )
    ) t;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'an awards entry names an award this ceremony did not decide',
                              'award_ids', left(v_bad, 400));
  end if;

  -- ⛔⛔ THE `pity` BLOCK IS VALIDATED, NOT WAVED THROUGH — ADDED BY THE 6.9a CODE REVIEW. It
  -- previously got ONE `jsonb_typeof(...) = 'object'` test while `spin_plan` got five queries, and
  -- the projection then TRUNCATED `reveal_order` and `draws` by ordinal on the unverified
  -- assumption that position j is the j-th revealed consolation spin. Nothing tied the ordinal to
  -- `spin.spin_index` and nothing bounded the array's length, so a mis-ordered `reveal_order`
  -- published a consolation winner ahead of their own spin — the exact spoiler class AD-22 exists
  -- for, arriving through the one block with no guards on it.
  --
  -- ⚠ `draws` and `reveal_order` are DIFFERENT LENGTHS BY CONSTRUCTION and that is correct, not a
  -- bug to "fix" here: a Fisher-Yates over n winless players takes n-1 steps, so the measured
  -- corpus has 28 winners and 27 draws. Only `reveal_order` is index-aligned with the pity spins;
  -- `draws` is the stream record. Each is therefore bounded on its own terms.
  if coalesce(jsonb_typeof(v_doc -> 'pity' -> 'label'), 'absent') <> 'string'
     or coalesce(jsonb_typeof(v_doc -> 'pity' -> 'winless'), 'absent') <> 'array'
     or coalesce(jsonb_typeof(v_doc -> 'pity' -> 'reveal_order'), 'absent') <> 'array'
     or coalesce(jsonb_typeof(v_doc -> 'pity' -> 'draws'), 'absent') <> 'array'
     or coalesce(jsonb_typeof(v_doc -> 'pity' -> 'bytes_consumed'), 'absent') <> 'number' then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'pity must carry label, winless, reveal_order, draws and '
                                        'bytes_consumed with their specced types');
  end if;

  -- `reveal_order` is index-aligned with this ceremony's pity spins, so its length is the count of
  -- them — the fact the projection's `t.ord <= v_pity_revealed` slice silently depended on.
  select count(*)::int into v_pity_spins
    from public.spin s where s.ceremony_id = p_ceremony_id and s.kind = 'pity';
  if jsonb_array_length(v_doc -> 'pity' -> 'reveal_order') <> v_pity_spins then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'pity.reveal_order does not have one entry per pity spin',
                              'payload_reveal_order', jsonb_array_length(v_doc -> 'pity' -> 'reveal_order'),
                              'ceremony_pity_spins', v_pity_spins);
  end if;

  -- `reveal_order` is a PERMUTATION of `winless`: same members, no repeats. A divergent
  -- `reveal_order` leaves `draws` and `bytes_consumed` IDENTICAL (`deferred-work.md:335`), so the
  -- byte-accounting gate this epic rests on structurally cannot see it — which is precisely why it
  -- has to be checked here, on the set.
  if (select count(*) from jsonb_array_elements_text(v_doc -> 'pity' -> 'reveal_order'))
     <> (select count(distinct x) from jsonb_array_elements_text(v_doc -> 'pity' -> 'reveal_order') x)
     or exists (
       select 1 from jsonb_array_elements_text(v_doc -> 'pity' -> 'reveal_order') x
        where not ((v_doc -> 'pity' -> 'winless') ? x)
     ) then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'pity.reveal_order must be a permutation of pity.winless '
                                        '(no repeats, no member outside it)');
  end if;

  -- ⭐ B3 — STAGE-1 VERIFICATION NEEDS **NO** AWARD METADATA, and that is why these three fields are
  -- mandatory on every main spin: `pool` ids + published `weights` + `label` + the seed are together
  -- SUFFICIENT to re-check the draw. That sufficiency is what makes progressive verification possible
  -- at all (AC6/DECISION B) — without it the projection would have to serve award metadata for an
  -- unrevealed spin, which is the exact spoiler AD-22 forbids. ⛔ Do not make any of them optional.
  select string_agg(distinct (e ->> 'spin'), ',') into v_bad
    from jsonb_array_elements(v_doc -> 'spin_plan') e
   where coalesce(jsonb_typeof(e -> 'label'), 'absent') <> 'string'
      or coalesce(jsonb_typeof(e -> 'bytes_consumed'), 'absent') <> 'number'
      or (
        (e ->> 'kind') = 'main'
        and (coalesce(jsonb_typeof(e -> 'pool'), 'absent') <> 'array'
             or coalesce(jsonb_typeof(e -> 'weights'), 'absent') <> 'array'
             or coalesce(jsonb_typeof(e -> 'live'), 'absent') <> 'array')
      );
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'a spin_plan entry is missing label/bytes_consumed, or a main '
                                        'spin is missing pool/weights/live (B3: those four plus the '
                                        'seed are what make a draw checkable without metadata)',
                              'spins', v_bad);
  end if;

  -- ── 2d. THE FROZEN FACTS THE DOCUMENT CLAIMS. ─────────────────────────────────────────────
  -- ⛔ THE SEED THE PRODUCER DREW FROM MUST BE THE SEED THE CEREMONY FROZE — the same check
  -- `persist_ceremony` makes (`0028:1429-1434`), re-made here because THIS document is the one whose
  -- bytes are hashed. ⛔ AND IT IS `ceremony.seed_demo_sha256`, NEVER `tournament.fair_seed`
  -- (DECISION C of 0028, and section (d) above is what makes that unambiguous to a reader too).
  if v_doc ->> 'seed_hex' is distinct from v_seed then
    return jsonb_build_object('ok', false, 'reason', 'seed_mismatch',
                              'ceremony_seed_hex', v_seed,
                              'payload_seed_hex', coalesce(v_doc ->> 'seed_hex', '<null>'));
  end if;

  -- ⛔⛔ THE SEED'S SHAPE IS GUARDED **BEFORE** THE WRITE — ADDED BY THE 6.9a CODE REVIEW, WHICH
  -- FOUND THIS FUNCTION ABLE TO RAISE FROM INSIDE ITS OWN INSERT. `ceremony.seed_demo_sha256` is
  -- plain `text` with NO CHECK (`0024:198`; only `tournament.fair_seed` carries one), and
  -- `assert_ceremony_transition` freezes the column only once it is non-NULL — so a NULL -> garbage
  -- write, or a direct row insert (exactly what the pgTAP fixtures do), leaves a malformed seed
  -- representable. Every guard above then PASSED on it (`v_seed is not null` holds, and the payload
  -- can name the same bad seed so `seed_mismatch` agrees), the `ceremony.algorithm_version` UPDATE
  -- landed, and the INSERT raised 23514 against this migration's own `verification_bundle_seed_hex`
  -- constraint — from the function whose section header reads "EVERY GUARD BEFORE ANY WRITE, each
  -- returned as a typed {ok:false, reason}". `lib/ceremony/bundle.ts` maps the raise to
  -- `write_failed` -> 500, so the admin loses the diagnosis entirely.
  -- ⚠ Reported as `seed_mismatch` rather than a new reason: the closed set is asserted from
  -- `prosrc` by the pgTAP suite and mirrored in TypeScript, and the FACT is the same one — the
  -- ceremony's frozen seed is not a seed this bundle can commit to.
  if v_seed !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'seed_mismatch',
                              'ceremony_seed_hex', v_seed,
                              'detail', 'the ceremony''s frozen seed is not 64 lowercase hex '
                                        'characters, so it cannot be committed to');
  end if;

  -- ⭐ DECISION H — the version is checked against the PINNED literal, and against the ceremony row
  -- when that row already carries one. B10: this is `algo_version`, the ALGORITHM axis; it is NOT the
  -- label prefix's `v1` (`labels.go:34-35`), which is domain separation. Two version axes, one
  -- refusal, and conflating them would make a MAJOR bump invisible here.
  if (v_doc ->> 'algo_version') is distinct from c_algo_version
     or (v_algo is not null and v_algo is distinct from (v_doc ->> 'algo_version')) then
    return jsonb_build_object('ok', false, 'reason', 'algo_version_mismatch',
                              'payload_algo_version', coalesce(v_doc ->> 'algo_version', '<null>'),
                              'expected_algo_version', c_algo_version,
                              'ceremony_algorithm_version', coalesce(v_algo, '<null>'));
  end if;

  -- ⭐⭐ `award_revealed_twice` — CLOSES `deferred-work.md:362`. Checked on BOTH sides of the seam
  -- (see the header): the DATABASE's own results first, because that is the ceremony that happened.
  select string_agg(distinct x.aid::text, ',') into v_bad
    from (
      select ar.award_id as aid
        from public.award_result ar
        join public.spin s on s.id = ar.spin_id
       where s.ceremony_id = p_ceremony_id and ar.award_id is not null
       group by ar.award_id
      having count(*) > 1
    ) x;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'award_revealed_twice',
                              'award_ids', v_bad, 'source', 'award_result',
                              'hint', 'award_result_spin_award_key is unique (spin_id, award_id) — '
                                      'PER SPIN — so one trophy decided in two spins of one ceremony '
                                      'is representable, and a bundle would hash it perfectly '
                                      '(0027:136-140 homed this cross-check here)');
  end if;

  -- …and then over the payload's own `awards` array, which is what actually gets hashed. Either check
  -- alone would pass while the other side was wrong.
  select string_agg(distinct x.aid, ',') into v_bad
    from (
      select coalesce(e ->> 'award_id', '<null>') as aid
        from jsonb_array_elements(v_doc -> 'awards') e
       group by 1
      having count(*) > 1
    ) x;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'reason', 'award_revealed_twice',
                              'award_ids', v_bad, 'source', 'payload');
  end if;

  -- Every award the ceremony decided appears EXACTLY once in the document. `count(distinct)` on the
  -- database side, compared against an array whose duplicates were just excluded.
  select count(distinct ar.award_id)::int into v_awards
    from public.award_result ar
    join public.spin s on s.id = ar.spin_id
   where s.ceremony_id = p_ceremony_id and ar.award_id is not null;
  if jsonb_array_length(v_doc -> 'awards') <> v_awards then
    return jsonb_build_object('ok', false, 'reason', 'payload_shape',
                              'detail', 'awards does not describe this ceremony''s decided awards',
                              'payload_awards', jsonb_array_length(v_doc -> 'awards'),
                              'ceremony_awards', v_awards);
  end if;

  -- ⭐ THE ACTOR IS RESOLVED BEFORE THE WRITE, NOT DISCOVERED AT THE AUDIT INSERT — 6.8a's review
  -- fixed exactly this in `persist_ceremony`. `audit_log.actor_steamid64` is
  -- `not null references player(steamid64)` (`0003:24`), so a NULL would raise 23502 and an unknown
  -- id 23503 — after the bundle row had been inserted.
  if p_actor is null or not exists (
    select 1 from public.player p where p.steamid64 = p_actor
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_actor',
                              'actor', coalesce(p_actor, '<null>'));
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──

  -- `now()` is transaction-stable, so `published_at`, the audit row's `occurred_at` default and the
  -- value returned to the caller are all the SAME instant.
  v_now := now();

  -- ══ 3. `ceremony.algorithm_version` STOPS BEING A SHELL (DECISION H). `0024:200` has named this
  --    story as its writer since Epic 6 began. The value is the payload's, which the guard above just
  --    proved equal to the pinned literal — so the ceremony row and the hashed document cannot
  --    disagree about which algorithm drew the ceremony.
  --    ⚠ This UPDATE passes `assert_ceremony_transition` trivially: `state` is not in the SET list, so
  --    `new.state is distinct from old.state` is false and no transition is judged.
  update public.ceremony
     set algorithm_version = v_doc ->> 'algo_version'
   where id = p_ceremony_id;

  -- ══ 4. THE COMMITMENT ITSELF. B1: one document, hashed once, inserted once.
  insert into public.verification_bundle (
    tournament_id, ceremony_id, snapshot_id, seed_demo_sha256, algorithm_version,
    bundle_sha256, payload_canonical, payload, published_at
  ) values (
    v_tournament, p_ceremony_id, v_snapshot, v_seed, v_doc ->> 'algo_version',
    -- ⚠ THE COMPUTED HASH IS STORED, NOT THE CLAIMED ONE. They are equal — the guard above proved it
    -- — and storing the derived value means a future reader of this row is reading something this
    -- function computed rather than something a caller asserted.
    v_computed, p_payload, v_doc, v_now
  )
  returning id into v_bundle_id;

  -- ══ 5. EXACTLY ONE audit_log row (AD-17), with before/after in `detail`.
  -- ⚠ `'publish_bundle'` JOINS THE VOCABULARY WITH NO MIGRATION: `audit_log.action` is uncapped `text`
  -- with NO CHECK (`0003:25` is a documentation comment, not a constraint) — the same precedent
  -- `begin_grace`/`resume_match`/`run_ceremony`/`reveal_spin` took.
  -- ⚠ EVERY key below is asserted in pgTAP BY CONTENT: 6.8a's review found "the audit_log row was
  -- asserted by ZERO tests in a migration whose own comment said EVERY key below is asserted".
  insert into public.audit_log (tournament_id, actor_steamid64, action, detail)
  values (
    v_tournament,
    p_actor,
    'publish_bundle',
    jsonb_build_object(
      'before', jsonb_build_object(
                  'ceremony_state',    v_state,
                  'algorithm_version', coalesce(v_algo, '<null>'),
                  'published',         false
                ),
      'after',  jsonb_build_object(
                  'ceremony_state',    v_state,
                  'ceremony_id',       p_ceremony_id,
                  'bundle_id',         v_bundle_id,
                  'bundle_sha256',     v_computed,
                  'algorithm_version', v_doc ->> 'algo_version',
                  'seed_hex',          v_seed,
                  'snapshot_id',       v_snapshot,
                  'payload_bytes',     octet_length(p_payload),
                  'spins',             v_spins,
                  'main_spins',        v_main_spins,
                  'awards',            v_awards,
                  'players',           v_players,
                  'published_at',      v_now
                )
    )
  );

  -- ⚠ NO REALTIME EMIT, DELIBERATELY, and for the reason `0024:165-167` gives: `SPINE:230`'s
  -- vocabulary is `match.approved` / `bracket.advanced` / `spin.reveal`, event names are
  -- "server-authored, named by semantic change" and NEVER invented, and there is no name for a
  -- publication. There is also no surface to nudge — `/ceremonia` is still the 5.7 <Placeholder> until
  -- 6.9b/6.10, and AD-11 makes the commitment fully reconstructable from a published read alone.
  return jsonb_build_object(
    'ok',                true,
    'ceremony_id',       p_ceremony_id,
    'bundle_id',         v_bundle_id,
    'bundle_sha256',     v_computed,
    'algorithm_version', v_doc ->> 'algo_version',
    'payload_bytes',     octet_length(p_payload),
    'spins',             v_spins,
    'awards',            v_awards,
    'players',           v_players,
    'published_at',      v_now
  );
end;
$$;

comment on function public.publish_bundle(bigint, text, text, text) is
  'FR-27/FR-30 + AD-22/AD-6/AD-17 (Story 6.9a, AC4): publishes the ONE canonical document a ceremony '
  'is verifiable against, together with the commitment that binds it — BEFORE the first reveal, which '
  'is what makes it a commitment. ⭐ VALIDATED, NOT TRUSTED: it re-derives sha256 over the bytes it '
  'was handed and refuses bundle_mismatch, re-checks the ASCII restriction, re-checks the document''s '
  'shape and counts against the DATABASE''s own spins/awards/snapshot rows, and re-checks seed_hex and '
  'algo_version against the frozen ceremony row. Writes ceremony.algorithm_version (a SHELL since '
  '0024:200), one verification_bundle row and exactly one publish_bundle audit_log row, in ONE '
  'transaction. Business refusals are RETURNED as {ok:false, reason:...}: no_ceremony, '
  'ceremony_not_spinning, already_published, reveal_in_progress, snapshot_missing, seed_missing, '
  'no_spins, bundle_mismatch, non_ascii_payload, payload_shape, seed_mismatch, algo_version_mismatch, '
  'award_revealed_twice, unknown_actor. ⭐ award_revealed_twice closes deferred-work.md:362 — the '
  '(spin_id, award_id) UNIQUE is PER SPIN, so one trophy in two spins of a ceremony is representable '
  'and would hash perfectly.';

-- ── EXECUTE grant — the RPC is service-role-only (AD-8) ──────────────────────
-- ⚠ LOAD-BEARING, NOT DECORATION. `create function` grants EXECUTE to PUBLIC and anon/authenticated
-- INHERIT from PUBLIC, so without this REVOKE a viewer could publish a bundle straight off the Data
-- API. It is `security invoker` and a viewer holds no INSERT grant on `verification_bundle`, so the
-- write would fail anyway; but a defence that depends on a different grant check is not a defence
-- (`0028:920-928`).
revoke execute on function public.publish_bundle(bigint, text, text, text) from public;
grant  execute on function public.publish_bundle(bigint, text, text, text) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (g) AC1/AC6 + DECISION B — `verification_bundle_read`: the reveal-gated PROJECTION.
-- ════════════════════════════════════════════════════════════════════════════
-- ⭐⭐ B11 — THIS IS A NARROW READ, ONCE, AND IT IS THE SECOND ANON-REACHABLE `security definer`
-- FUNCTION IN THE TREE. `0023:196-198`'s warning applies to it VERBATIM and is quoted here because a
-- warning attached to the other function protects nobody:
--     "⛔ IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22."
-- What "widen" means HERE, concretely: returning a `spin_plan` entry, an `awards` entry or a `pity`
-- draw whose spin is not revealed. Each of those names an unrevealed outcome. ⛔ There is no
-- legitimate reason to add a parameter to this function, and a `p_full boolean default false` would
-- be exactly the widening the warning describes.
--
-- WHY A DEFINER RPC RATHER THAN A VIEW OR COLUMN GRANTS (DECISION C, stated once more at the site
-- because this is where somebody would try to "simplify" it): a row policy cannot hide an ARRAY
-- ELEMENT. The gate here is per-`spin_plan`-entry, not per-column — `0028`'s DECISION B chose column
-- grants because THERE the gate was per-column. Same house, opposite answer, for a stated reason.
--
-- ⚠⚠ AND IT DEPENDS ON THE OWNER'S `rolbypassrls`. `verification_bundle`, `spin` and `ceremony` are
-- all FORCE ROW LEVEL SECURITY, and FORCE — unlike plain ENABLE — applies RLS to the table OWNER too.
-- So `security definer` ALONE does not make this function see every row; what does is the owner
-- carrying BYPASSRLS (`0027:316-328`). On this platform migrations are applied as `postgres`, which
-- has it. ⛔ If this function is ever reassigned to an owner without BYPASSRLS it silently starts
-- serving less than it should, so the pgTAP suite asserts the owner attribute DIRECTLY.
--
-- ⭐ B2 — THE PROJECTION **SUBTRACTS**; IT NEVER BLANKS. An unrevealed spin is ABSENT from
-- `spin_plan` and its award is ABSENT from `awards`. ⛔ A `null` or `"redacted"` placeholder is a
-- DEFECT, not a nicety: it leaks cardinality-BY-POSITION (a viewer learns which spins remain and
-- WHERE THE GAPS ARE) and it invites the next reader to "fill it in". `pool` at spin 1 is
-- the ENTIRE catalog and `weights` are derived from every candidate's provisional winner, so a
-- placeholder that leaked either would hand over the whole unrevealed ceremony.
--
-- ⚠⚠ AND THE SCOPE OF THAT RULE IS NARROWER THAN IT READS — CLARIFIED BY THE 6.9a CODE REVIEW,
-- WHICH CORRECTLY POINTED OUT THAT THIS FUNCTION SERVES `total_spins` TO ANON FROM k=0 AND THE
-- PARAGRAPH ABOVE APPEARS TO FORBID IT. Both facts are real, so the decision is recorded rather
-- than left as an apparent contradiction two blocks apart:
--
--   * The rule forbids POSITIONAL cardinality — a per-spin placeholder that says "spin 7 exists and
--     is not yours yet", which tells a viewer where in the sequence the unrevealed outcomes sit.
--   * `total_spins` is a SCALAR: the ceremony's length. ⭐ CUATRO'S CALL AT THE 6.9a REVIEW
--     (2026-08-09): KEEP IT. A progress indicator needs a denominator, and the ceremony's length is
--     public by design the moment the first spin is revealed.
--
-- ⚠ THE COST, STATED RATHER THAN GLOSSED, because it IS new disclosure: before this function
-- existed the total was not anon-reachable at all (`spin_viewer_read` gates `spin` on
-- `revealed_at is not null` per `0028:253-254`, and `ceremony.spin_plan` is ungranted per
-- `0028:501`). This function is `security definer` over an owner with BYPASSRLS, so it counts ALL
-- spins including unrevealed ones. Combined with the anon-reachable award-catalog count,
-- `total_spins - main_spins` yields the number of consolation spins — i.e. how many of the named
-- players win nothing — before spin 1. Accepted, deliberately, as the price of a progress
-- denominator. ⛔ Do not read that acceptance as licence to widen anything else: it applies to this
-- one scalar and to nothing per-spin.
--
-- ⭐ B4 — `players` IS PUBLISHED IN FULL FROM THE START, AND THAT IS NOT A LEAK. It carries no award
-- identity, and `public.leaderboard` (Story 5.5) already publishes the same magnitudes to anon.
-- Knowing everyone's `knife_kills` does not tell you that an award uses it, nor its direction, floors
-- or priority. ⛔ Do NOT "harden" this into a gate: B3 depends on `players` being present, because a
-- verifier re-deriving a REVEALED spin's Stage-2 outcome needs every candidate's magnitudes, and
-- gating them per spin would leak which players a spin was about.
create function public.verification_bundle_read(p_ceremony_id bigint) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_state         text;
  v_bundle_sha    text;
  v_published_at  timestamptz;
  v_released_at   timestamptz;
  v_doc           jsonb;
  v_total         int;
  v_revealed      int;
  v_pity_total    int;
  v_pity_revealed int;
  v_plan          jsonb;
  v_awards        jsonb;
  v_pity          jsonb;
  v_out           jsonb;
begin
  -- ⚠ NO LOCK AND NO WRITE. This function is `stable` and anon-reachable; taking a lock here would let
  -- an anonymous request block a ceremony's admin, and writing would make a read forge a state.
  select c.state into v_state from public.ceremony c where c.id = p_ceremony_id;
  if not found or v_state is null then
    return jsonb_build_object('ok', false, 'reason', 'no_ceremony', 'ceremony_id', p_ceremony_id);
  end if;

  select b.bundle_sha256, b.published_at, b.released_at, b.payload
    into v_bundle_sha, v_published_at, v_released_at, v_doc
    from public.verification_bundle b
   where b.ceremony_id = p_ceremony_id and b.published_at is not null;
  if not found then
    -- ⚠ THE SAME ANSWER WHETHER THE ROW IS ABSENT OR UNPUBLISHED, DELIBERATELY. Distinguishing them
    -- would publish the fact that an admin has staged a bundle, which is a fact about an unrevealed
    -- ceremony. `already_published` on the write side is where that distinction legitimately lives.
    return jsonb_build_object('ok', false, 'reason', 'not_published', 'ceremony_id', p_ceremony_id);
  end if;

  select count(*)::int,
         count(*) filter (where s.revealed_at is not null)::int,
         count(*) filter (where s.kind = 'pity')::int,
         count(*) filter (where s.kind = 'pity' and s.revealed_at is not null)::int
    into v_total, v_revealed, v_pity_total, v_pity_revealed
    from public.spin s
   where s.ceremony_id = p_ceremony_id;

  -- ══ THE PREFACE — served from the instant the commitment exists, at every k including 0.
  -- `algo_version`, `seed_hex`, `luck` and `players` name no award and describe no outcome. The
  -- commitment (`bundle_sha256`) is here too: publishing it before the first spin is the whole point.
  v_out := jsonb_build_object(
             'ok',             true,
             'ceremony_id',    p_ceremony_id,
             'ceremony_state', v_state,
             'bundle_sha256',  v_bundle_sha,
             'published_at',   v_published_at,
             'released_at',    v_released_at,
             'complete',       (v_state = 'complete'),
             'revealed_spins', v_revealed,
             'total_spins',    v_total
           );

  -- ══ THE FULL DOCUMENT, AT COMPLETION ONLY (DECISION B, row three).
  -- ⭐ THIS IS THE ONE MOMENT THE SERVED DOCUMENT HASHES TO THE COMMITMENT. The verifier
  -- re-canonicalizes what it gets here and compares against the `bundle_sha256` it read before spin 1.
  -- ⚠ IT IS SERVED FROM `payload` (jsonb), NOT FROM `payload_canonical`, AND THAT IS SAFE FOR A
  -- STATED REASON: RFC-8785 is NORMALISING — it sorts keys and fixes number and escape forms — so any
  -- faithful representation of the same VALUE canonicalizes to the same bytes. jsonb preserves the
  -- value exactly here because the bundle contains only strings, booleans, arrays, objects and
  -- integers within the safe range (every magnitude is a decimal STRING by provenance, B5). ⛔ If a
  -- future bundle key ever carried a float or a >2^53 JSON number, this equivalence would break and
  -- the canonicalizer would refuse it anyway — which is the fail-closed direction.
  -- ⛔ The release gate is `ceremony.state`, NEVER `released_at` (DECISION K): a guarded state machine
  -- cannot be forged by an UPDATE, a stored flag can.
  if v_state = 'complete' then
    return v_out || jsonb_build_object('bundle', v_doc);
  end if;

  -- ══ THE PROGRESSIVE RELEASE — subtract, never blank (B2).
  -- Every `spin_plan` entry whose spin is revealed, in the document's own order.
  select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_plan
    from jsonb_array_elements(v_doc -> 'spin_plan') with ordinality as t(e, ord)
   where exists (
     select 1 from public.spin s
      where s.ceremony_id = p_ceremony_id
        and s.revealed_at is not null
        and s.spin_index = (t.e ->> 'spin')::int
   );

  -- ⚠ THE AWARD FILTER READS THE **DATABASE**, NOT A FIELD IN THE DOCUMENT. Which spin decided which
  -- award is a fact `award_result ⋈ spin` already holds, and deriving the gate from the document would
  -- mean the document could describe its own visibility. `award_id` is a decimal STRING in the bundle
  -- (`worker/ceremony:100-104` — "AwardID IS award.id RENDERED AS DECIMAL"), so the join casts.
  select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_awards
    from jsonb_array_elements(v_doc -> 'awards') with ordinality as t(e, ord)
   where exists (
     select 1
       from public.award_result ar
       join public.spin s on s.id = ar.spin_id
      where s.ceremony_id = p_ceremony_id
        and s.revealed_at is not null
        and ar.award_id is not null
        and ar.award_id::text = (t.e ->> 'award_id')
   );

  -- ⭐ THE PITY BLOCK IS TRUNCATED TO THE REVEALED CONSOLATIONS, NOT ALL-OR-NOTHING.
  -- FR-28 draws the WHOLE consolation order from ONE stream, so `reveal_order[j]` is the winner of the
  -- j-th consolation spin and `draws[j]` is the draw that produced it. Serving the first k of each is
  -- exactly "released progressively per spin"; serving the whole array at the FIRST consolation reveal
  -- would spoil the remaining 27.
  -- ⚠ `winless` IS SERVED WHOLE AND IS NOT A SPOILER: the consolation spins come after every main spin
  -- (the reveal axis is a dense prefix), so by the time any pity draw is visible the set of players who
  -- won nothing is already derivable from the revealed `awards`. It is an INPUT to the draw, and B3's
  -- reasoning applies — without it the revealed draws are uncheckable.
  -- ⚠ `bytes_consumed` IS WITHHELD UNTIL THE PITY PHASE IS FULLY REVEALED, and that is honesty rather
  -- than caution: it is a WHOLE-STREAM measurement (`README:531-535` — "the only externally visible
  -- proof that both runtimes walked the same stream"), so a truncated document has no honest value to
  -- put there and a partial one would be a number a verifier could not reproduce.
  --
  -- ⛔⛔ `winless` IS TRUNCATED TO THE REVEALED PREFIX — CHANGED BY THE 6.9a CODE REVIEW, AND THE
  -- ARGUMENT IT REPLACES WAS *ALMOST* RIGHT, WHICH IS WHY IT SURVIVED. The old code served
  -- `winless` WHOLE, defended as: "`winless` IS SERVED WHOLE AND IS NOT A SPOILER: the consolation
  -- spins come after every main spin, so by the time any pity draw is visible the set of players
  -- who won nothing is already derivable from the revealed `awards`."
  --
  -- That defends serving the SET. It does not defend serving the set ALONGSIDE A PROPER PREFIX OF
  -- ITS OWN PERMUTATION, and `reveal_order` is exactly that. With 28 winless players (the measured
  -- corpus), after the 27th consolation reveal an anon caller holds `winless` (28 ids) and
  -- `reveal_order` (27 ids), and the 28th — UNREVEALED — consolation winner is
  -- `winless MINUS reveal_order`: one set difference, no cleverness required.
  --
  -- ⚠ AND NO ASSERTION IN SECTION B COULD SEE IT. This function's own header defines widening as
  -- "returning a `spin_plan` entry, an `awards` entry or a `pity` draw whose spin is not revealed",
  -- and this disclosed an unrevealed OUTCOME while returning no such entry — the spoiler lived in
  -- the arithmetic between two individually-defensible fields. Cardinality-shaped tests are blind
  -- to it by construction.
  --
  -- Truncating costs a viewer the full winless roster mid-ceremony and buys back AD-22's actual
  -- guarantee. At completion the full document is released and `winless` is whole again.
  if v_pity_revealed > 0 then
    v_pity := jsonb_build_object('label', v_doc -> 'pity' -> 'label')
              || jsonb_build_object(
                   'winless',
                   coalesce((select jsonb_agg(t.e order by t.ord)
                               from jsonb_array_elements(coalesce(v_doc -> 'pity' -> 'reveal_order',
                                                                  '[]'::jsonb))
                                    with ordinality as t(e, ord)
                              where t.ord <= v_pity_revealed), '[]'::jsonb))
              || jsonb_build_object(
                   'reveal_order',
                   coalesce((select jsonb_agg(t.e order by t.ord)
                               from jsonb_array_elements(coalesce(v_doc -> 'pity' -> 'reveal_order',
                                                                  '[]'::jsonb))
                                    with ordinality as t(e, ord)
                              where t.ord <= v_pity_revealed), '[]'::jsonb))
              || jsonb_build_object(
                   'draws',
                   coalesce((select jsonb_agg(t.e order by t.ord)
                               from jsonb_array_elements(coalesce(v_doc -> 'pity' -> 'draws',
                                                                  '[]'::jsonb))
                                    with ordinality as t(e, ord)
                              where t.ord <= v_pity_revealed), '[]'::jsonb));
    if v_pity_revealed = v_pity_total then
      v_pity := v_pity || jsonb_build_object('bytes_consumed', v_doc -> 'pity' -> 'bytes_consumed');
    end if;
  end if;

  -- The preface keys are taken from the document VERBATIM so the served values are byte-comparable
  -- with the full release later — a projection that re-rendered them could disagree with the bytes the
  -- commitment binds.
  return v_out || jsonb_build_object(
    'bundle',
    jsonb_build_object(
      'algo_version', v_doc -> 'algo_version',
      'seed_hex',     v_doc -> 'seed_hex',
      'luck',         v_doc -> 'luck',
      'players',      v_doc -> 'players',
      'spin_plan',    v_plan,
      'awards',       v_awards
    )
    -- ⭐ B2 AGAIN, AT THE ONE PLACE IT IS EASIEST TO GET WRONG: with no consolation revealed, `pity` is
    -- ABSENT from the served object, not present-and-empty. An empty-but-present `pity` would announce
    -- that a consolation phase exists and how it is shaped before any of it is public.
    || case when v_pity is not null then jsonb_build_object('pity', v_pity) else '{}'::jsonb end
  );
end;
$$;

comment on function public.verification_bundle_read(bigint) is
  'AD-22 + DECISION B (Story 6.9a, AC1/AC6): the reveal-gated PROJECTION of the published bundle. '
  'Serves the commitment (bundle_sha256) and the preface (algo_version, seed_hex, luck, players) from '
  'the instant the bundle is published — before any spin — then ADDS each revealed spin''s spin_plan '
  'entry, the awards those spins decided, and the consolation draws already revealed. At '
  'ceremony.state = complete it serves the FULL document, which is the one moment a viewer can '
  're-canonicalize it and match the bundle_sha256 published before spin 1. ⭐ It SUBTRACTS, it never '
  'blanks: an unrevealed spin is ABSENT, because a placeholder leaks cardinality-by-position. '
  'security definer because anon holds no grant on verification_bundle.payload — and, exactly as '
  '0023:196-198 says of award_catalog_count, ⛔ IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22.';

-- Reachable by every client role: this is the ONLY path by which a viewer reads bundle CONTENT, and
-- the anon-facing verifier calls it through the RLS-respecting server client, never the admin one.
revoke execute on function public.verification_bundle_read(bigint) from public;
grant  execute on function public.verification_bundle_read(bigint) to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- (h) AC4 — `reveal_spin` refuses to spoil before the commitment exists.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ `0028:552-903`'s BODY, COPIED FORWARD VERBATIM, WITH EXACTLY ONE ADDITION: the
-- `bundle_not_published` typed refusal, before any write. ⛔ Do NOT edit 0028 — this is a
-- `create or replace` in THIS file, the same discipline 0028 itself followed for `persist_ceremony`
-- and for the three `ceremony_locked` RPCs. The diff of this body against 0028's is pasted in the
-- story's Completion Notes and contains only that change.
--
-- ⭐ WHY IT HAS TO EXIST: A COMMITMENT PUBLISHED **AFTER** THE FIRST REVEAL IS NOT A COMMITMENT.
-- `publish_bundle` already refuses `reveal_in_progress` — but that guard alone only closes one of the
-- two orders. Without this one, an operator could reveal spins 1..5 and only THEN publish a bundle,
-- and the published `bundle_sha256` would commit to bytes chosen with five outcomes already known.
-- Nothing downstream could tell the difference: the hash would bind, the seed would match, and the
-- document would be internally perfect. The two guards are the same rule read from both ends, and
-- either one alone leaves the other order legal.
--
-- ⚠ WHERE IT SITS IS PART OF THE FIX. It is the FIRST thing checked after the ceremony's own state,
-- BEFORE the reveal ledger is read and long before the stamp — so a refusal writes nothing, exactly
-- as every other refusal in this function does.
--
-- ⚠ AND IT ADDS A SEVENTH REASON TO A CLOSED SET THAT IS CROSS-CHECKED FROM SOURCE IN TWO PLACES:
-- `lib/ceremony/reveal.ts`'s `REVEAL_REASONS` (whose union the reveal route's `STATUS_FOR` is keyed
-- on) and `lib/ceremony/reveal.test.ts`, which reads BOTH sides from source and asserts set equality
-- in both directions. Both are updated in this story — that guard doing its job is the reason the
-- update is deliberate rather than discovered in production as an opaque 500.
create or replace function public.reveal_spin(
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
  v_published    timestamptz;   -- 6.9a: the commitment's publication stamp, or NULL
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

  -- ⭐⭐ STORY 6.9a, AC4 — THE ONLY ADDITION TO THIS BODY. THE COMMITMENT COMES FIRST OR THE REVEAL
  -- DOES NOT HAPPEN. See the section header for why `publish_bundle`'s `reveal_in_progress` is not
  -- sufficient on its own: it closes publish-after-reveal, and this closes reveal-before-publish.
  -- ⚠ IT READS `published_at`, NOT MERE ROW EXISTENCE, because `verification_bundle_viewer_read`
  -- gates on `published_at is not null` — a staged row nobody can read is not a published commitment.
  select b.published_at into v_published
    from public.verification_bundle b where b.ceremony_id = p_ceremony_id;
  if v_published is null then
    return jsonb_build_object('ok', false, 'reason', 'bundle_not_published',
                              'ceremony_id', p_ceremony_id,
                              'hint', 'publish_bundle must commit the ceremony''s canonical bytes '
                                      'BEFORE the first reveal — a commitment chosen after an outcome '
                                      'is known commits to nothing (AD-22)');
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
  -- awards from the deleted run. 0028's section (h) closes that with a `reveal_in_progress` refusal.
  -- ⛔ The lesson generalises: this pair of tests detects a BROKEN prefix, never a prefix that was
  -- legally reset out from under an audience. Do not treat it as a completeness check.
  -- ⚠ WHY `max = count` IS A SOUND PREFIX TEST HERE AND NOT IN GENERAL: `spin_ceremony_index_key
  -- unique (ceremony_id, spin_index)` (`0025:123`) makes the indexes DISTINCT, so {1,1,3} — the
  -- shape that defeats a max/count pair in `0027:724-725` — is unrepresentable. Over a distinct
  -- subset of the POSITIVE integers, max = count holds if and only if the subset is {1..count}.
  -- ⭐ AND THE POSITIVITY IS NOW A CONSTRAINT RATHER THAN AN ASSUMPTION (Story 6.9a, AC10.4):
  -- `spin_index_positive` is added in section (e) of THIS migration, which is what `0028:652-653`
  -- recorded as owed — "the durable fix is a `check (spin_index > 0) is true` on `spin`, which
  -- belongs with a migration that owns that table". The theorem above is now sound as stated.
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
  --    in 0028 resolve their visibility from this column, so this single UPDATE is what flips a spin,
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
  -- ⚠ DECISION H of 0028 — DATA, NEVER COPY. `lib/feed/model.ts:186-188` renders `detail.title` and
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

  -- ══ 5. AC6 / DECISION E of 0028 — THE LAST REVEAL COMPLETES THE CEREMONY, ATOMICALLY.
  -- ⭐ `0027:152`: "The transition trigger below ALREADY PERMITS spinning -> complete; 6.8b writes
  -- it." This is that write, and it goes through `ceremony_transition_valid` as ONE legal forward
  -- step — the trigger still refuses complete -> spinning, spinning -> locked and every skip with
  -- IC910. `completed_at` is the shell `0024:204` created and nobody wrote until 6.8b.
  -- ⭐ AND IT IS THE MOMENT THE FULL BUNDLE IS RELEASED: `verification_bundle_read` gates the full
  -- document on exactly this state (DECISION B, row three), so completing the ceremony and releasing
  -- the document a viewer can hash against the commitment are ONE act, not two. ⛔ Do not add a
  -- second write here to stamp `released_at` — that column is DECISION K's shell and this body must
  -- differ from 0028's by exactly one guard.
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
  --    tournament axis, and a viewer can now learn the ceremony id from the `ceremony` row 0028
  --    publishes, so the channel is discoverable from a published read alone (AD-11).
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
  --    consumer for this one is 6.10's, with the UI that needs it (0028's DECISION F).
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

-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED, AND IT HAS TO BE. `create or replace` PRESERVES the existing
-- `pg_description` entry, so `0028:905-918`'s text would have survived unchanged and would now list
-- six refusals for a function that has seven — precisely the stale-comment class this epic's
-- migrations are written against. This is 0028's comment with the `bundle_not_published` sentence
-- added and nothing else altered.
comment on function public.reveal_spin(bigint, int, text) is
  'FR-24/FR-30/FR-31 + AD-22/AD-6/AD-17 (Story 6.8b): reveals ONE spin of a running ceremony by '
  'stamping spin.revealed_at, which is what flips that spin, its award_results, its winners and '
  'its award into the viewer''s reach through 0028''s four reveal-gated policies. In the SAME '
  'transaction it writes the award_reveal timeline_feed row (unowned since 0017:109), exactly one '
  'reveal_spin audit_log row, and — when the spin is the ceremony''s highest index — '
  'ceremony.state = complete + completed_at, as one legal forward step through '
  'assert_ceremony_transition (DECISION E). Reveals are FORWARD-ONLY and DENSE: p_spin_index must '
  'be the lowest unrevealed index (out_of_order otherwise) and a second reveal of the same spin '
  'REFUSES with already_revealed rather than being idempotent (R9, Cuatro 2026-08-08). '
  '⭐ AND (Story 6.9a, AC4) it refuses bundle_not_published until publish_bundle has committed the '
  'ceremony''s canonical bytes: a commitment chosen after an outcome is known commits to nothing, so '
  'the two guards — this one and publish_bundle''s reveal_in_progress — are the same rule read from '
  'both ends. Business refusals are RETURNED as {ok:false, reason:...}: no_ceremony, '
  'ceremony_not_spinning, bundle_not_published, no_such_spin, already_revealed, out_of_order, '
  'unknown_actor. IC911 is RAISED only for genuine corruption — a revealed set that is not a dense '
  'prefix, which only a direct service-key UPDATE of revealed_at can produce. Emits one spin.reveal '
  'Broadcast on ceremony:<id> (SPINE:230).';

-- ⚠ NO revoke/grant is re-issued, and that is correct rather than an omission: `create or replace`
-- PRESERVES a function's existing privileges, and `0028:927-928` already revoked EXECUTE from public
-- and granted it to service_role. Re-issuing would be harmless but would imply the grants had been
-- lost, which they have not.

-- ════════════════════════════════════════════════════════════════════════════
-- (i) AC10.3 / DECISION F — `persist_ceremony` finally WRITES `label` and `bytes_consumed`.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠⚠ `0028:1293-1905`'s BODY, COPIED FORWARD VERBATIM, WITH EXACTLY TWO CHANGES, both of them the
-- same decision: (1) the `spin` INSERT now writes the two provenance columns section (e) added, and
-- (2) the payload-shape guard proves their types BEFORE the write, because a cast is not a guard.
-- ⛔ Do NOT edit 0027 or 0028. The diff of this body against 0028's is pasted in the story's
-- Completion Notes and contains only those two changes.
--
-- ⭐ THIS IS THE MOVE `0027:1032` DEMANDED: "⛔ Do NOT read them into a write without moving that
-- decision to 6.9 first." The decision is DECISION F, taken here, and the reason it had to be taken
-- somewhere is that the bundle is derived FROM THE DATABASE — the producer's process exits, and a
-- field the database does not hold is a field no later bundle can re-derive.
--
-- ⚠ IT CARRIES `0028`'s `reveal_in_progress` REFUSAL AND MUST NOT LOSE IT. That guard is why a
-- re-persist cannot un-reveal published spins while their `award_reveal` feed rows stay visible.
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

  -- ⛔⛔ reveal_in_progress — ADDED BY STORY 6.8b'S CODE REVIEW (2026-08-08).
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
  -- had happened.
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

  -- ⛔⛔ bundle_published — ADDED BY STORY 6.9a'S CODE REVIEW, AND IT CLOSES A HOLE THIS FILE
  -- PREVIOUSLY ARGUED WAS UNREACHABLE. The note that stood here said the case "is unreachable
  -- through this path, because publishing requires zero reveals and revealing requires a published
  -- bundle, so any ceremony with a bundle and no reveals can still legally be re-persisted BEFORE
  -- the first reveal — which is correct". ⛔ IT IS NOT CORRECT, and the reasoning inverts what
  -- `already_published` does. Walk it:
  --
  --   1. publish_bundle(C)          -> ok. Requires state='spinning' and ZERO reveals; both hold.
  --                                   The verification_bundle row is written and IC912 makes it
  --                                   immutable for the rest of time.
  --   2. persist_ceremony(C, …, p_replace => true)
  --                                 -> ok. `ceremony_not_locked` admits 'spinning';
  --                                    `already_persisted` is bypassed by p_replace; and
  --                                    `reveal_in_progress` CANNOT fire, because publishing
  --                                    required zero reveals in the first place. Every spin row is
  --                                    deleted and rewritten from a DIFFERENT run.
  --   3. reveal_spin(C, 1, …)       -> ok. It only checks `published_at is not null`, which it is.
  --
  -- The published `bundle_sha256` now binds a document describing spins that no longer exist.
  -- `verification_bundle_read` filters the STALE spin_plan by matching spin_index against the NEW
  -- spins, so it serves old entries labelled as new ones, and at state='complete' it serves the
  -- whole stale document as "the full bundle" that hashes to the commitment. A verifier
  -- re-deriving from it gets a ceremony that never ran — and nothing anywhere looks wrong.
  --
  -- ⚠ `already_published` does NOT save this. It refuses a SECOND publish; it does nothing about
  -- the FIRST bundle binding replacement rows. Because IC912 makes the row immutable and
  -- `already_published` blocks re-issuing a correct one, the ceremony is UNRECOVERABLE — the only
  -- exit is a new ceremony row. That asymmetry is exactly why this must be refused BEFORE the
  -- delete rather than detected afterwards.
  --
  -- ⚠ Scoped to a PUBLISHED bundle (`published_at is not null`), not to the row's existence: an
  -- unpublished draft row commits to nothing and must not block a legitimate re-persist.
  if exists (
    select 1 from public.verification_bundle vb
     where vb.ceremony_id = p_ceremony_id
       and vb.published_at is not null
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'bundle_published',
      'hint', 'this ceremony''s commitment is already published and immutable (IC912); re-persisting would leave bundle_sha256 binding spins that no longer exist. Run a new ceremony instead.'
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
  -- ⭐ STORY 6.9a: `spin_index_positive` (section (e)) now enforces the same lower bound as a
  -- CONSTRAINT, so this guard and the table agree by mechanism rather than by coincidence.
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
  --
  -- ⭐⭐ STORY 6.9a — `label` AND `bytes_consumed` JOIN THIS GUARD, AND THAT IS THE SECOND OF THIS
  -- BODY'S TWO CHANGES. They are written to columns below, so their types are proven HERE for the
  -- same reason every other cast in this function is: a cast is not a guard, and
  -- `(v_spin ->> 'bytes_consumed')::bigint` on `"lots"` raises 22P02 from the middle of the write
  -- phase, which the Go caller reports as an untyped `write_failed`.
  -- ⚠ THEY ARE **REQUIRED**, NOT OPTIONAL, AND THAT IS A DELIBERATE TIGHTENING. `worker/ceremony`'s
  -- `PayloadSpin` has carried both since 0027 with no `omitempty` (`ceremony.go:316-323`), so every
  -- payload the shipped producer can emit already has them; a payload without them was written by
  -- something that is not the producer, and DECISION F is precisely the decision that these two
  -- fields matter. ⛔ Do not soften this to `e ? 'label' and …` — an absent label would then persist
  -- as NULL and the bundle could not name the stream the spin was drawn from.
  -- ⚠ NO REASON IS ADDED TO THE CLOSED SET. `invalid_payload_shape` already exists and already
  -- carries a `fields` context key, so `worker/ceremony.PersistReasons` and every cross-check that
  -- reads it stay exactly as they are.
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
      union all
      select 'label'
        from jsonb_array_elements(v_spins) e
       where coalesce(jsonb_typeof(e -> 'label'), 'absent') is distinct from 'string'
      union all
      select 'bytes_consumed'
        from jsonb_array_elements(v_spins) e
       where coalesce(jsonb_typeof(e -> 'bytes_consumed'), 'absent') is distinct from 'number'
          or (e ->> 'bytes_consumed') !~ '^[0-9]{1,18}$'
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
  -- ⭐ STORY 6.9a, DECISION J: this `nullif` is the SEAM at which the two spellings of "no ladder"
  -- become one. The COLUMN holds NULL, the bundle spells it ABSENT, and the Go builder drops the key
  -- on 0 — so the canonical bytes can never carry a `0` that the database does not hold.
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
  -- `award_result_deciding_pair_complete` — the constraint 0027 adds — a non-numeric
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
  --
  -- ⭐⭐ STORY 6.9a, AC10.3 / DECISION F — `label` AND `bytes_consumed` ARE NOW PERSISTED, AND THIS IS
  -- THE FIRST OF THIS BODY'S TWO CHANGES. `0027:1025-1032` carried them on the wire and refused to
  -- write them, homing the decision to "6.9's verification_bundle, which owns the shape a verifier
  -- reads", and ⛔ "Do NOT read them into a write without moving that decision to 6.9 first." THIS IS
  -- THAT MOVE. Why they cannot live only in the bundle: the bundle is DERIVED FROM THE DATABASE, so a
  -- field the database does not hold is one no later re-derivation can produce once the producer's
  -- process has exited. `label` is the domain-separation key a verifier re-opens each stream by, and
  -- `bytes_consumed` is MEASURED FROM THE STREAM — `README:531-535` calls it "the only externally
  -- visible proof that both runtimes walked the same stream".
  -- ⚠ THE VALUES ARE THE PAYLOAD'S, VERBATIM, AND THAT IS THE POINT: `bytes_consumed` must be
  -- REPRODUCED, never re-derived. A writer that recomputed it would be asserting what it was supposed
  -- to be checking.
  for v_spin in select e from jsonb_array_elements(v_spins) e loop
    v_kind := v_spin ->> 'kind';

    insert into public.spin (ceremony_id, spin_index, kind, live_award_ids, revealed_at,
                             label, bytes_consumed)
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
      null,
      -- ⭐ The two provenance columns, cast safely because 2b' proved their types.
      v_spin ->> 'label',
      (v_spin ->> 'bytes_consumed')::bigint
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
  --    RETURN. `award_result_is_shared_consistent` and `award_result_winner_is_shared_consistent` are
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

-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED for the same reason section (c) and (h) re-issue theirs:
-- `create or replace` preserves `pg_description`, so `0028:1912-1926`'s text would have survived and
-- would now describe a writer that persists two fewer columns than it does. This is 0028's comment
-- with the label/bytes_consumed sentence added and nothing else altered.
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
  '⛔ AND with bundle_published once this ceremony''s commitment exists (Story 6.9a code review, '
  '2026-08-09): publishing requires ZERO reveals, so reveal_in_progress structurally cannot fire '
  'on that path — a re-persist after publish deleted and rewrote every spin the immutable '
  'bundle_sha256 describes, leaving the commitment binding a run that never happened, with '
  'already_published then blocking any correct re-issue. '
  '⭐ AND (Story 6.9a, AC10.3 / DECISION F — closes deferred-work.md:363) it now WRITES spin.label '
  'and spin.bytes_consumed, which 0027 carried on the wire and deliberately did not persist: the '
  'verification bundle is derived FROM THE DATABASE, so the stream label and the measured byte count '
  'a verifier re-opens each spin by have to be columns. Both are REQUIRED in the payload and their '
  'types are proven by invalid_payload_shape before any write. '
  'Business refusals are RETURNED as '
  '{ok:false, reason:...}; the anti-sweep UNIQUE is deliberately NOT guarded, because 0025 requires '
  'a producer bug to fail loudly rather than be handled.';

-- ⚠ NO revoke/grant is re-issued: `create or replace` preserves privileges, and `0027:1187-1188`
-- already revoked EXECUTE from public and granted it to service_role.
