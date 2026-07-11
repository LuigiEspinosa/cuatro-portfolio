-- supabase/tests/0006_demo_hash_dedup_test.sql
-- pgTAP proof for migration 0006 (Story 3.2): the AD-3 idempotency key on `demo`.
-- Proves the UNIQUE(match_id, demo_sha256) BITES (a duplicate-bytes re-upload 23505s) AND that the
-- manual path is unaffected (NULL-sha256 rows stay insertable because NULLs are distinct). Run via:
--   supabase test db
--   AC2 UNIQUE(match_id, demo_sha256) constraint exists on exactly those columns      -> Section A
--   AC2 a duplicate (match_id, demo_sha256) is rejected (23505)                        -> Section B
--   AC2 same sha256 / different match_id, and same match_id / different sha256, insert -> Section B
--   AC1 demo_sha256 stays NULLABLE; two NULL-sha256 rows for one match both insert     -> Section A + B
-- Runs inside a transaction and rolls back — no data persists. `demo.match_id` is a plain bigint with
-- NO FK (match does not exist yet), so this test needs NO fixture rows. Constraints fire for any writer,
-- so no role-switch is needed here (unlike the 0005 grant/RLS matrix). SQLSTATE 23505 = unique_violation.

begin;

-- pgTAP lives in the `extensions` schema on Supabase; put it on the search_path so
-- plan()/is()/lives_ok()/throws_ok()/col_is_unique()/col_is_null() resolve unqualified.
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(7);

-- ============================================================================
-- Section A — the constraint is shaped right (AC2) + the column stays nullable (AC1)
-- ============================================================================
select col_is_unique(
  'public', 'demo', ARRAY['match_id', 'demo_sha256'],
  'demo: a UNIQUE across exactly (match_id, demo_sha256) exists — the AD-3 idempotency key (Story 3.2)'
);
-- demo_sha256 remains NULLABLE this slice (NOT NULL is the Epic-5 end-state): the manual-upload path
-- keeps inserting NULL-sha256 rows.
select col_is_null(
  'public', 'demo', 'demo_sha256',
  'demo: demo_sha256 stays NULLABLE (Epic 5 makes it NOT NULL once the manual path is worker-hashed)'
);

-- ============================================================================
-- Section B — behavioral: the constraint bites for real hashes, NULLs stay distinct
-- ============================================================================
-- (a) a first (match_id, demo_sha256) inserts; a byte-identical re-upload (same pair) is rejected.
select lives_ok(
  $$ insert into demo (match_id, storage_key, source, demo_sha256) values (1, 'demos/1/a.dem', 'matchzy', 'sha-a') $$,
  'demo: the first (1, sha-a) worker row inserts'
);
select throws_ok(
  $$ insert into demo (match_id, storage_key, source, demo_sha256) values (1, 'demos/1/dup.dem', 'matchzy', 'sha-a') $$,
  '23505', null,
  'demo: a duplicate (match_id, demo_sha256) is rejected — the AD-3 short-circuit fires at the DB'
);
-- (b) the SAME demo_sha256 under a DIFFERENT match_id genuinely differs → inserts.
select lives_ok(
  $$ insert into demo (match_id, storage_key, source, demo_sha256) values (2, 'demos/2/a.dem', 'matchzy', 'sha-a') $$,
  'demo: the same demo_sha256 under a DIFFERENT match_id inserts (distinct idempotency key)'
);
-- (c) the SAME match_id under a DIFFERENT demo_sha256 differs → inserts.
select lives_ok(
  $$ insert into demo (match_id, storage_key, source, demo_sha256) values (1, 'demos/1/c.dem', 'matchzy', 'sha-c') $$,
  'demo: the same match_id under a DIFFERENT demo_sha256 inserts (distinct idempotency key)'
);
-- (d) two NULL-sha256 rows for the SAME match_id BOTH insert — NULLs are distinct in a UNIQUE, so the
-- admin manual-upload path (app insert, NULL sha256) is entirely unaffected by the constraint.
select lives_ok(
  $$ insert into demo (match_id, storage_key, source) values
       (3, 'demos/3/n1.dem', 'manual_upload'),
       (3, 'demos/3/n2.dem', 'manual_upload') $$,
  'demo: two NULL-sha256 rows for one match_id BOTH insert — NULLs distinct, manual path unaffected'
);

select * from finish();

rollback;
