-- supabase/migrations/0005_demo.sql
-- Logical migration 0005 — Demo acquisition slice (Story 3.1).
-- Realizes the `Acquiring` node of the ingest state machine (AD-16): a `demo` row records where the
-- raw 50–170 MB .dem lives in object storage (opaque storage_backend/storage_key) plus acquisition
-- metadata. The bytes bypass Vercel (SPEC Constraint 6) — this table only records the acquisition.
--
-- SCOPE (whole deliverable): create the `demo` table per SOLUTION-DESIGN §3 (lines 93–108) with
--   `demo_sha256` and `parser_version` as NULLABLE SHELLS; ENABLE+FORCE RLS; an admin-only SELECT
--   policy (dormant, mirrors audit_log 0003); and `grant select, insert, update on demo to
--   service_role` (deliberately NO DELETE = the write-once retention ceiling). demo is admin/worker-
--   only: NO anon/authenticated grant or policy (mirror audit_log, NOT roster_entry).
-- OUT OF SCOPE — do NOT add here:
--   * demo_match_fk (Epic 4): `match` does not exist yet, so `match_id` is a plain `bigint not null`
--     with NO forward FK — mirrors 0001 tournament.final_match_id / 0003 audit_log.target_match_id.
--   * UNIQUE(match_id, demo_sha256) + `demo_sha256 NOT NULL` (Story 3.2): dedup/write-once is 3.2's.
--     In 3.1 demo_sha256 stays NULL (hashing is 3.2), so a retry may create a duplicate NULL-sha256
--     acquisition row — acceptable and documented; 3.2's hash+UNIQUE resolves it. Do NOT add UNIQUE.
--   * `parser_version NOT NULL` (Story 3.3): parsing is 3.3; parser_version stays a NULL shell here.
--   * object-lock / permanent_seed delete-proofing hardening (AD-16 storage layer) -> Epic 7. The
--     Go-side Delete() retention guard lives in the worker; the DB teeth here is the absent DELETE grant.
--   * any parse -> stat_row write (Story 3.3) or async parse-job enqueue (Story 3.8).

-- ── demo (AD-16) — the acquisition record; one row per retained .dem ─────────
create table demo (
  id               bigint generated always as identity primary key,
  match_id         bigint not null,                 -- FK -> match(id) DEFERRED to Epic 4 (no match table yet); plain bigint like tournament.final_match_id
  demo_sha256      text,                            -- SHELL: Story 3.2 sets the value + NOT NULL + UNIQUE(match_id, demo_sha256)
  storage_backend  text not null default 'r2'
                     check (storage_backend in ('r2','supabase')),                 -- AD-16 opaque backend id (R2 primary; supabase deferred)
  storage_key      text not null,                                                  -- opaque object key (AD-16); callers never parse it
  size_bytes       bigint,                                                         -- nullable: the manual presigned path registers without a size (browser PUT direct to R2)
  source           text not null check (source in ('matchzy','manual_upload')),    -- which ingest path acquired it
  retention_class  text not null default 'event_archive'
                     check (retention_class in ('event_archive','permanent_seed')), -- AD-16 (permanent_seed => keep forever / delete-proofed)
  delete_after     timestamptz,                                                     -- NULL = keep forever (permanent_seed => NULL); Story 3.2/Epic 7 own GC
  parser_version   text,                                                            -- SHELL: Story 3.3 sets the value + NOT NULL
  parse_generation int not null default 1,                                          -- bumps on re-parse (Story 3.6)
  archived_at      timestamptz not null default now()
);

-- ── ENABLE + FORCE RLS (the AD-7 convention 0002/0003/0004 established) ──────
-- FORCE is non-negotiable: the generic catalog FORCE-guard in the 0003 test (lines 54–60) asserts NO
-- public base table may have FORCE off, so it now covers `demo` too and fails loudly here if omitted.
-- FORCE does not affect BYPASSRLS roles — service_role (and a direct owner/worker connection) bypass.
alter table demo enable row level security;
alter table demo force  row level security;

-- ── Admin-only SELECT (no viewer policy) — mirrors audit_log (0003), not roster_entry ─
-- demo is admin/worker-only: admins read it via SERVER routes with the service key, never the client
-- Data API. Like audit_log, `demo` gets NO anon/authenticated base grant, so this admin-read policy is
-- DORMANT defense-in-depth (even a valid admin claim 42501s at the table-grant gate before RLS runs).
-- The (select …) wrap makes is_admin() an init-plan (evaluated once per statement) — the perf precedent.
create policy demo_admin_read on public.demo for select to authenticated using ((select public.is_admin()));

-- ── Grants — the single writer + the write-once ceiling live HERE ────────────
-- service_role is the sole writer (AD-2). It has BYPASSRLS, so the "no DELETE policy" rule does NOT
-- stop it — the GRANT does (BYPASSRLS skips row POLICIES, never table GRANTS). It gets SELECT+INSERT
-- +UPDATE: INSERT records the acquisition; UPDATE lets Story 3.2/3.3 backfill demo_sha256/parser_version
-- and bump parse_generation on re-parse. Deliberately NO DELETE — retention is write-once; GC is governed
-- by storage-layer object-lock + delete_after (Epic 7), never a table DELETE. The absent DELETE grant is
-- the teeth (the same append-only-by-grant lesson as 0003's audit/snapshot); the 0005 pgTAP proves the
-- service_role DELETE 42501s. Identity PK (generated always as identity) needs NO separate sequence grant.
grant select, insert, update on public.demo to service_role;

-- ── Writes/reads for anon/authenticated (fail-closed) ───────────────────────
-- Deliberately NO policy and NO grant of any kind for anon/authenticated on `demo`: no read (admin-only),
-- no write (single-writer). Doubly fail-closed, by construction — mirrors audit_log/stat_snapshot (0003).
