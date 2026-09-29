-- supabase/migrations/0006_demo_hash_dedup.sql
-- Logical migration 0006 — Hash, dedup & write-once retention slice (Story 3.2).
-- Realizes the `Hashing → Deduped → (AlreadyIngested | new)` span of the ingest state machine (AD-3):
-- the worker computes SHA-256 over the exact canonical .dem it stores (Story 3.2, Go side) and records
-- it on the `demo` row; this migration adds the idempotency key so a byte-identical re-upload dedups
-- to the prior row instead of writing a duplicate.
--
-- SCOPE (whole deliverable): add `UNIQUE(match_id, demo_sha256)` to `demo` — the AD-3 idempotency key.
--   A duplicate-bytes re-upload on a worker path (MatchZy / CLI) now 23505s at this constraint, which the
--   Go writer catches (ON CONFLICT DO NOTHING) and short-circuits to the prior result.
-- OUT OF SCOPE — do NOT add here:
--   * `demo_sha256 NOT NULL` (Epic 5): the SOLUTION-DESIGN §3 end-state, blocked on the admin manual-upload
--     path — its bytes go browser→R2 and the *app* inserts the row (never sees the bytes, holds no R2 creds),
--     so it cannot hash. Making sha256 NOT NULL now would force re-plumbing the manual path through the
--     worker (the Epic-5 admin-upload UI slice). demo_sha256 STAYS NULLABLE this slice.
--   * demo_match_fk (Epic 4): `match` still does not exist; `match_id` stays a plain `bigint not null`.
--   * object-lock / permanent_seed delete-proofing (Epic 7); `parser_version NOT NULL` (Story 3.3).

-- ── The AD-3 idempotency key ────────────────────────────────────────────────
-- Postgres treats NULLs as DISTINCT in a UNIQUE, so the admin manual-upload path's NULL-sha256 rows
-- (app insert, Story 3.1) are UNAFFECTED — they neither dedup nor break. The two worker paths set a real
-- hash, so their (match_id, demo_sha256) genuinely dedups: a re-uploaded identical demo hits this
-- constraint and short-circuits to the prior row. [SOLUTION-DESIGN.md §3 end-state = unique (match_id,
-- demo_sha256); the NOT NULL there is the Epic-5 end-state, deferred above.]
alter table public.demo
  add constraint demo_match_sha256_uniq unique (match_id, demo_sha256);
