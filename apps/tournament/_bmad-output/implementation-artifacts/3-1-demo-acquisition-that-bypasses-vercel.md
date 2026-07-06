---
baseline_commit: 1915c625bf60e740c1fda2ee3c9f0e7338a67082
---

# Story 3.1: Demo acquisition that bypasses Vercel

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- 2026-07-06: code-review DONE (bmad-code-review) → review→in-progress; 1 review patch applied (ingest size/bomb caps), 4 defers logged, 10 dismissed, all 7 ACs PASS. ⛔ Task 9 live-QA sign-off (Cuatro) still pending before → done. -->

## Status

`in-progress` — code-review clean (1 patch applied); Task 9 live-QA sign-off (human gate, Cuatro) pending → then `done`.

## Story

As a platform,
I want demo bytes to reach the Go worker / Cloudflare R2 without passing through a Vercel function,
so that large (50–170 MB) demos are never blocked by the ~4.5 MB request cap and arrive reliably from every source (MatchZy, admin manual upload, local CLI).

**This is the first story of Epic 3 — the big pivot.** It stands up the repo's **first Go code** (the `worker/` module), the **first object-storage integration** (Cloudflare R2 via the `DemoStore` abstraction), and the **first multi-language layout**. None of Epic 2's TypeScript/auth/RLS machinery is reused inside the worker. Scope is deliberately narrow: **acquisition only** — the `Acquiring` node of the ingest state machine (`Acquiring → Hashing → Deduped → …`). Hashing/dedup is Story 3.2, parse→`stat_row` is Story 3.3, the async job queue is Story 3.8.

## Acceptance Criteria

> Restated from `epics.md#Story 3.1` (lines 446–470), elaborated with the three central decisions resolved by Cuatro during story creation (see **Dev Notes → Resolved Decisions**). Traces: **FR-11 · AD-16, AD-25 · SPEC Constraint 6 (demo bypasses Vercel)**.

**AC1 — MatchZy auto-upload (FR-11, AD-16).**
MatchZy's `matchzy_demo_upload_url` POSTs a finished match's demo body plus its metadata headers to the Go worker's HTTP ingest endpoint over **shared-secret** authentication; the worker stores the canonical `.dem` to R2 via `DemoStore`. The bytes **never** transit a Next.js route. Built and unit-tested; the **live CS2-server end-to-end** run (rented MatchZy server) is a deferred operational gate (Deploy-posture decision → Epic 7).

**AC2 — Admin manual fallback (FR-11).**
An admin uploads a demo from the browser via a **worker-issued R2 presigned multipart/PUT URL** (bytes go browser → R2, bypassing Vercel); only a small `POST /api/ingest/register {match_id, storage_key}` JSON notify (well under the 4.5 MB cap) touches the Next.js app. That route is `requireAdmin`-gated and records the demo acquisition row via the service role.

**AC3 — CLI fallback.**
The operator runs the same Go binary in CLI mode on a local `.dem` (`worker ingest <path.dem> --match <id>`); it uploads to R2 and records the demo row via the service role. Identical store→record core as the other paths.

**AC4 — Storage abstraction (AD-16).**
A `DemoStore` Go interface (R2 primary; an in-memory fake for `go test`; the Supabase-Storage backend **deferred**, DemoStore-impls decision) hides the backend so the DB records only opaque `(storage_backend, storage_key)` + acquisition metadata. A stored object re-hashes **byte-for-byte** to its bytes (AD-1 round-trip test). `demo_sha256` and `parser_version` are **nullable shells** in this story, populated by Story 3.2 (hash) and Story 3.3 (parse).

**AC5 — Bypass invariant (SPEC Constraint 6 / AD-16 / AD-25).**
On all three paths the 50–170 MB demo body never passes through a Vercel/Next.js function — only small JSON notifies do. No R2 / worker / MatchZy secret is exposed via a `NEXT_PUBLIC_*` variable or a client bundle (AD-25). The Vercel body cap (~4.5 MB) vs demo size (50–170 MB) is the non-negotiable driver.

**AC6 — Schema slice (migration 0005, Demo-table decision = create now with nullable shells).**
`supabase/migrations/0005_demo.sql` creates the `demo` table per `SOLUTION-DESIGN.md` §3 (lines 93–108): `id` identity PK; `match_id bigint not null` with **FK deferred to Epic 4** (no `match` table yet); `demo_sha256 text` **nullable shell**; `storage_backend text not null default 'r2' check (… in ('r2','supabase'))`; `storage_key text not null`; `size_bytes bigint`; `source text not null check (… in ('matchzy','manual_upload'))`; `retention_class text not null default 'event_archive' check (… in ('event_archive','permanent_seed'))`; `delete_after timestamptz`; `parser_version text` **nullable shell**; `parse_generation int not null default 1`; `archived_at timestamptz not null default now()`. ENABLE + FORCE RLS; admin-only SELECT policy (dormant, mirrors `audit_log`); `grant select, insert, update on demo to service_role` (**NO delete** = write-once retention ceiling); **no** anon/authenticated grant or policy. `UNIQUE(match_id, demo_sha256)` + `demo_sha256 NOT NULL` are **deferred to Story 3.2**. New pgTAP `supabase/tests/0005_demo_test.sql` with an explicit `plan(N)` (retro action #5).

**AC7 — Single-writer + module boundary (AD-2, dependency rule).**
Every `demo` write uses the service role; no anon/authenticated grant or policy permits a client write. The new `worker/` Go module has **no code dependency** on `app/` + `lib/` (and vice-versa) — the only coupling is the `supabase/migrations` schema contract (`ARCHITECTURE-SPINE.md:73`). All new secrets are server-only.

### Out of scope (do NOT build here)

- **Hashing / dedup / write-once retention** (SHA-256, `UNIQUE(match_id, sha256)` dedup short-circuit, `retention_class` semantics, object-lock) → **Story 3.2**. This story leaves `demo_sha256` NULL.
- **Parse → `stat_row`** (demoinfocs, per-SteamID64 rows, conservation/anomaly checks, AFK/idle) → **Story 3.3**. This story does **not** import `demoinfocs-golang` and leaves `parser_version` NULL.
- **Bounded async job queue + retry/backoff** (AD-26) → **Story 3.8**. "Enqueue a parse job" is out of scope; 3.1 records the acquisition and stops.
- **Score derivation / Forfeit-Bye precedence** (AD-5/AD-23) → Stories 3.7/Epic 4.
- **`match` table + `demo_match_fk`** → Epic 4. `demo.match_id` is a plain `bigint not null`, no FK.
- **Admin Ingest/upload UI** → backend-first, deferred to Epic 5 (no app shell yet; no UX surface is even specified for demo upload — see Dev Notes).
- **Live Railway deploy + rented MatchZy CS2 server** → deferred operational gate (Deploy-posture decision).

## Tasks / Subtasks

- [x] **Task 1 — Migration `0005_demo.sql` + pgTAP (AC4, AC6, AC7)**
  - [x] Create `supabase/migrations/0005_demo.sql`. Copy the header-comment style of `0003`/`0004`: a SCOPE block and an explicit **OUT OF SCOPE** block (no `demo_match_fk`; no `UNIQUE(match_id,sha256)`/`sha256 NOT NULL` — those are 3.2; no `parser_version NOT NULL` — that's 3.3; no viewer read).
  - [x] Table columns exactly per AC6 (SOLUTION-DESIGN §3 L93–108), with `demo_sha256` and `parser_version` as **nullable** shells and `match_id` FK deferred (plain `bigint not null`, mirroring `0001` `tournament.final_match_id` / `0003` `audit_log.target_match_id`).
  - [x] `alter table demo enable row level security;` **and** `alter table demo force row level security;` (FORCE is non-negotiable — the generic catalog FORCE-guard in `0003`'s test lines 54–60 auto-covers `demo` and fails loudly if omitted).
  - [x] Admin-only read policy, mirroring `0003` exactly: `create policy demo_admin_read on public.demo for select to authenticated using ((select public.is_admin()));` — dormant defense-in-depth (no base grant for anon/authenticated). **No** viewer policy (demo is admin/worker-only, like `audit_log`).
  - [x] Grants: `grant select, insert, update on public.demo to service_role;` — **NO delete** (write-once retention ceiling; storage-layer object-lock + `delete_after` govern GC, never a table DELETE). UPDATE is granted because Story 3.2/3.3 backfill `demo_sha256`/`parser_version` and `parse_generation` bumps on re-parse. **No** anon/authenticated grant of any kind.
  - [x] `supabase/tests/0005_demo_test.sql` with explicit `plan(N)`: assert table exists; FORCE on; `service_role` has select/insert/update and **42501 on delete**; anon/authenticated have **no** privilege; the three CHECK constraints (`storage_backend`, `source`, `retention_class`) reject bad values and accept the enum values; `match_id` NOT NULL; `demo_sha256`/`parser_version` are nullable; `demo_admin_read` policy present; no `UNIQUE(match_id, demo_sha256)` yet (it is a 3.2 assertion). Follow the assertion-accounting style of `0004_roster_test.sql`.
  - [x] Verify: `supabase db reset` applies 0001→0005 cleanly; `supabase test db` stays green and adds the new file (currently 171 across 5 files → 6 files). **DONE: `db reset` applied 0001→0005 clean; `supabase test db` → Files=6, Tests=209, PASS (`0005_demo_test.sql` plan(38)).**

- [x] **Task 2 — Go worker module scaffold + first multi-language layout (AC7)**
  - [x] Create top-level `worker/` Go module (per `ARCHITECTURE-SPINE.md:446` source tree). `worker/go.mod`: `go 1.26.x`; a clean module path (e.g. `module cs-tournament/worker`). **Do NOT add `demoinfocs-golang` yet** — it is unused until Story 3.3; keeping it out of `go.mod` keeps the module honest. 3.1's deps are `aws-sdk-go-v2` (S3/R2 + presign), a Postgres driver (`jackc/pgx/v5`), and stdlib. **DONE: `module cs-tournament/worker`, `go 1.26.4`; deps aws-sdk-go-v2 v1.42.1 (+s3/credentials/manager) + pgx/v5 v5.10.0; NO demoinfocs.**
  - [x] `worker/main.go` dispatches two modes from args/env: `serve` (HTTP ingest server, for MatchZy + admin presign/register) and `ingest <path.dem> --match <id>` (CLI). Keep `main` thin; put logic in packages. **DONE: `main.go` dispatches serve|ingest; `parseIngestArgs` accepts `--match` in any position (path-first or flag-first); logic lives in config/store/db/ingest.**
  - [x] `worker/config` (or similar): load server-only env — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_S3_ENDPOINT`, `WORKER_MATCHZY_SHARED_SECRET`, and the Supabase DB connection (`SUPABASE_DB_PASSWORD` — the `.env.example` comment already earmarks it for "direct worker DB access"). Fail fast on a missing required var. **These env vars already exist as stubs in `.env.example`** (lines 44–52) — no net-new env names; just consume them. **DONE: `worker/config/config.go` fail-fast Load(); DB DSN derived from SUPABASE_URL+SUPABASE_DB_PASSWORD (hosted `db.<ref>.supabase.co` / local `127.0.0.1:54322`); no net-new env.**
  - [x] `worker/README.md`: build (`go build ./...`), run modes, `go test ./...`, and a note that live Railway deploy + a rented MatchZy CS2 server are the deferred operational gate. Add `worker/` build artifacts to `.gitignore`. **DONE: `worker/README.md` + `.gitignore` Go section.**
  - [x] Confirm `next build` / Vitest are unaffected (the Go module is a separate root; there is no `go.work`, no workspace change to `package.json`). **DONE: no `go.work`, no `package.json` change; `next build` clean + Vitest 110 green.**

- [x] **Task 3 — `worker/store` DemoStore interface + R2 impl + in-memory fake (AC4, AC5)**
  - [x] Define the `DemoStore` interface. Contract (from AD-16 — the exact Go signature is the dev's to write): a `Put(ctx, key, r io.Reader, size int64) error` that streams bytes to the backend; a `PresignPut`/`PresignMultipart(ctx, key, …) (url…, error)` for the admin browser upload; a `Get(ctx, key) (io.ReadCloser, error)` for the AD-1 re-hash round-trip; and a **retention-guarded** `Delete(ctx, key) error`. All keys are **opaque**; the interface returns/records `(storage_backend, storage_key)` and never leaks R2 specifics to callers. **DONE: `store/store.go` `DemoStore` = Backend/Put/PresignPut/Get/Delete(ctx,key,retentionClass,force); opaque keys.**
  - [x] R2 implementation via `aws-sdk-go-v2` S3 client pointed at R2: endpoint `R2_S3_ENDPOINT` (`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`), region `auto`, static creds from `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, bucket `R2_BUCKET`. Use `s3.NewPresignClient` for presigned PUT/multipart. **Verify against the installed `aws-sdk-go-v2` version** — presign API and R2 multipart quirks (R2 supports S3 multipart; presigned multipart requires per-part presigns or a presigned single PUT for ≤5 GB, which covers 50–170 MB) — pick presigned single PUT if multipart adds complexity; the AC says "presigned multipart" but a presigned PUT satisfies the bypass-Vercel intent for this size. Document the choice. **DONE: `store/r2.go` — `s3.New(Options{Region:auto, BaseEndpoint, UsePathStyle})`; server-side `Put` uses `manager.Uploader` (robust streaming of a non-seekable 50–170 MB body); admin path uses a single presigned PUT (`PresignPutObject` + `WithPresignExpires`), the simpler choice per Task 3 — documented in the file + README.**
  - [x] `Delete()` must be **retention-guarded**: refuse (or require an explicit override) when the object's `retention_class='permanent_seed'`. AD-16 is explicit that permanent-seed delete-proofing is enforced at the storage layer (R2 object-lock) **plus** a DB guard — **not** the Go `Delete()` alone. In 3.1, implement the Go-side guard (refuse permanent_seed) and leave object-lock hardening to Epic 7 (note it). **DONE: shared `guardDelete` (both R2 + fake) → `ErrPermanentSeedProtected` unless force; object-lock hardening noted as Epic-7 deferred.**
  - [x] Storage-key scheme: opaque, match-scoped, unique per upload (sha256 is unknown at acquisition, so the key is **not** content-addressed here) — e.g. `demos/<match_id>/<random-or-ulid>.dem`. Keep it opaque; 3.2/3.3 do not depend on its structure. **DONE: `NewStorageKey` = `demos/<match_id>/<16 crypto/rand hex>.dem` (stdlib, no ULID dep).**
  - [x] In-memory fake `DemoStore` (map-backed) for `go test` — mirrors the TS injectable-seam pattern (`HttpPost`/`HttpGetJson` in Epic 2). No test hits real R2. **DONE: `store/fake.go` `FakeStore` (map-backed, mutex, reports r2 backend); round-trip test proves AD-1.**

- [x] **Task 4 — Worker demo-row writer via service role (AC2, AC3, AC7)**
  - [x] `worker/store` (or a small `worker/db` package): a function that inserts a `demo` acquisition row `(match_id, storage_backend='r2', storage_key, size_bytes, source)` with `retention_class` defaulting to `event_archive`; `demo_sha256`/`parser_version` left NULL (shells). Connect via `pgx` using the Supabase Postgres connection string (built from `SUPABASE_URL` host + `SUPABASE_DB_PASSWORD`) — a direct DB connection bypasses RLS as the owner/service role. Do **not** write `stat_row` (does not exist; Story 3.3). **DONE: `worker/db/db.go` `DemoRecorder` interface + `PgxRecorder` (pgxpool INSERT into `demo`; 0 size → NULL); NEVER writes stat_row.**
  - [x] Keep the insert idempotent-friendly for later: 3.2 adds `UNIQUE(match_id, sha256)`; here a retry may create a duplicate NULL-sha256 acquisition row (there is no dedup yet — acceptable, documented; 3.2's hash+UNIQUE resolves it). Do not attempt dedup in 3.1. **DONE: no dedup in 3.1 (documented in `db.go` + `ingest.go`); 3.2's hash+UNIQUE reconciles duplicate NULL-sha256 rows.**

- [x] **Task 5 — MatchZy auto-upload receiver (AC1, AC5)**
  - [x] **Confirm the MatchZy wire contract against the deployed MatchZy version first** (build-time task). The live docs (`https://shobhit-pathak.github.io/MatchZy/gotv/`) specify: cvar `matchzy_demo_upload_url`; HTTP **POST**; the body is the **zipped demo file** (raw binary body, not multipart); metadata via **headers** `MatchZy-FileName`, `MatchZy-MapNumber`, `MatchZy-MatchId`. **The docs snapshot shows NO built-in auth-header cvar** — so pin how the shared secret is carried against the actual MatchZy build: prefer a configurable upload header if the version supports one (e.g. `matchzy_demo_upload_header_key`/`_value`), else carry the secret in the URL path/query (`matchzy_demo_upload_url = https://<worker>/ingest/matchzy?token=<secret>`). Document the confirmed contract in the worker README. **DONE: receiver accepts BOTH an `Authorization` header (raw or `Bearer`) AND a `?token=` query param (pin at deploy); contract documented in `worker/README.md`. Live re-confirm vs deployed MatchZy build = Epic-7 gate.**
  - [x] `serve`-mode HTTP handler `POST /ingest/matchzy`: authenticate the shared secret with a **constant-time compare** against `WORKER_MATCHZY_SHARED_SECRET` (reject missing/wrong → 401/403, logged). Read `MatchZy-MatchId` (→ `match_id`), `MatchZy-FileName`, `MatchZy-MapNumber`. **DONE: `server.go` `handleMatchZy` — `crypto/subtle.ConstantTimeCompare`, empty secret fails closed, 401 logged; parses `MatchZy-MatchId`.**
  - [x] **Decompress the zipped body to the canonical `.dem`** before storing (AD-1: the retained object must be the raw `.dem` — it is the re-hashable source of truth **and** the fairness seed `SHA-256(final_demo_bytes)`; the seed is over the `.dem`, not the zip). Stream — do not buffer the full 50–170 MB in memory (Railway Hobby RAM is limited; PoC parse used ~257 MB). Confirm the compression (zip vs gzip) against the MatchZy version. **DONE: `decompress.go` auto-detects framing by magic — gzip (streamed), zip (compressed body spooled to a temp FILE not RAM, entry streamed), raw PBDEMS2 passthrough; the decompressed 50–170 MB never fully buffers in memory.**
  - [x] Stream the `.dem` to R2 via `DemoStore.Put`, then insert the demo row (Task 4, `source='matchzy'`). **DONE: `Acquire` store→record core (store BEFORE record → no row points at a missing object); a counting reader records the streamed size.**
  - [x] Unit-test with a fake `DemoStore`: valid secret + zipped body → object stored + row shape correct; missing/wrong secret → rejected, no store; header parsing. **Live CS2-server E2E is deferred** (Deploy-posture decision) — see Task 8. **DONE: `server_test.go` — Bearer + token-query happy paths, bad/missing secret → 401 (nothing stored/recorded), missing match-id → 400; `decompress_test.go` gzip/zip/raw/unknown.**

- [x] **Task 6 — Admin manual presigned-upload path + `/api/ingest/register` route (AC2, AC5)**
  - [x] `serve`-mode HTTP handler `POST /ingest/presign` (admin/shared-secret gated): given a `match_id`, mint a worker-generated R2 presigned upload URL (the worker holds R2 creds; the Next.js app does **not** — `lib/env.ts` has no R2 getters, keep it that way). Return the presigned URL + the `storage_key`. **DONE: `server.go` `handlePresign` (shared-secret gated) → `{url, storage_key}`; `lib/env.ts` UNTOUCHED (git diff empty, no R2 getters).**
  - [x] Next.js route `app/api/ingest/register/route.ts` — **thin wrapper over `lib/`**, mirroring the `app/api/admin/roster/route.ts` shape exactly: `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`; get `getAdminClient()` (service-role) + `createSupabaseServerClient()` (SSR); `requireAdmin(ssr, admin)` → 403 on `!ok`; validate JSON body `{match_id, storage_key}` (`invalid_json`/`invalid_body` → 400); insert the demo acquisition row via service-role (`source='manual_upload'`); typed `{ ok, reason }` → HTTP status; try/catch → controlled 500. Body is tiny JSON (well under 4.5 MB) — the only thing that touches Vercel; the bytes already went browser → R2. **DONE: route mirrors `admin/roster/route.ts` exactly; `next build` → `/api/ingest/register` = ƒ (Node/dynamic).**
  - [x] Put the domain logic in a new `lib/ingest.ts` (injectable seam + typed-result, mirroring `lib/roster.ts`) so the route stays thin and unit-testable. **Note (AD-2 nuance, flag for code-review):** this is the one place the *app* writes a `demo` row (via service role), an explicit consequence of the "create table now + register inserts the row" decision. It writes only the acquisition record, never `stat_row`; the AD-2 structural teeth (no anon/authenticated grant) hold; the worker remains the sole writer of derived stats. When the async queue lands (3.8), this may migrate to enqueue→worker-writes. **DONE: `lib/ingest.ts` `parseRegisterBody` + `recordManualUpload` (injectable service-role client, typed refusal); AD-2 nuance documented in the module header for review.**
  - [x] Route it at `/api/ingest/register` (not under `/api/admin/`, per SOLUTION-DESIGN §6 L330), but keep it `requireAdmin`-gated. **DONE: routed at `/api/ingest/register`, `requireAdmin`-gated.**
  - [x] Unit-test the route + `lib/ingest.ts` like `roster.test.ts`: requireAdmin gate (non-admin → 403, no write), body validation, service-role insert shape. **DONE: `lib/ingest.test.ts` (+6) — `parseRegisterBody` matrix + `recordManualUpload` insert-shape/write_failed. (requireAdmin gate is proven in `admin-guard.test.ts` and reused verbatim, per the roster precedent where the route stays thin/untested by vitest.)**

- [x] **Task 7 — CLI fallback mode (AC3)**
  - [x] `worker ingest <path.dem> --match <id>`: read the local `.dem`, upload to R2 via `DemoStore.Put`, insert the demo row via service role (`source='manual_upload'`). Same store→record core as the HTTP paths. **DONE: `ingest/cli.go` `RunCLI` streams the file → `Acquire` (same core), `source='manual_upload'`, size from `os.Stat`.**
  - [x] Optional lightweight acquisition sanity check: reject a file whose header is not the Source-2 `PBDEMS2` magic (CS:GO Source-1 `HL2DEMO` is unsupported — PoC README L15–16). Cheap guard against a wrong-format upload; note it is not a parse. **DONE: `checkDemHeader` reads+rewinds, rejects non-PBDEMS2 (noted: not a parse).**
  - [x] Unit-test with the fake `DemoStore` + a tiny fixture. **DONE: `cli_test.go` — happy path (stored+recorded, size=file size), non-PBDEMS2 rejected (nothing stored), missing `--match` rejected.**

- [x] **Task 8 — Tests, round-trip verification, and green-bar (AC4, AC5, AC7)**
  - [x] Go tests (`go test ./...` under `worker/`): DemoStore **round-trip** (Put → Get → re-hash equals input bytes, AD-1); shared-secret auth (allow correct, reject missing/wrong); zip decompress; CLI path; in-memory fake covers all. No real-R2 dependency in `go test`. **DONE: `go test ./...` = 28 PASS across 5 packages; round-trip re-hash (store_test), auth + gzip/zip/raw (server/decompress tests), CLI (cli_test); fakes only, no real R2/DB. `go build`/`go vet`/`gofmt -l` clean.**
  - [x] TS tests (`vitest run`): the `/api/ingest/register` route + `lib/ingest.ts` (requireAdmin, body validation, insert). Confirm the current suite stays green (Vitest 104 baseline) and grows. **DONE: Vitest 104 → 110 (+6 `lib/ingest.test.ts`).**
  - [x] Confirm **no `NEXT_PUBLIC_*`** leak of any R2/worker/MatchZy secret; `lib/env.ts` gains no R2 getters (worker-side only). If any of these were ever read in TS, they must also be added to `FORBIDDEN_PUBLIC_MIRRORS` — but they should not be. **DONE: leak scan found 0 real leaks (only the protective `FORBIDDEN_PUBLIC_MIRRORS` entry); `lib/env.ts` untouched (git diff empty).**
  - [x] `next build` clean; `supabase test db` green with `0005` added. **DONE: `next build` clean (`/api/ingest/register` = ƒ); `supabase test db` Files=6 Tests=209 PASS.**

- [ ] **Task 9 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy deferred)** ⛔ **PENDING human sign-off (Cuatro) — the dev agent cannot run this: it needs real `R2_*` creds, a real Source-2 `.dem`, and a seeded season+tournament row. Mirrors the 2.1–2.5 rhythm (dev-story → code-review → Cuatro clears live-QA → `done`). All AGENT-buildable tasks (1–8) are complete + green.**
  - [ ] **Prereq:** a seeded standing season + tournament row exists (retro action item — operational one-time SQL, not `seed.sql`), and a real `.dem` file (a `cache.dem`-style Source-2 demo; the PoC used one).
  - [ ] Run the worker locally against the **real R2 bucket** (real `R2_*` creds). Verify each path lands the object in R2 and inserts a `demo` row (opaque backend/key, `size_bytes`, correct `source`, `sha256`/`parser_version` NULL):
    - **CLI:** `worker ingest ./cache.dem --match <id>` → object in R2 + demo row (`source='manual_upload'`), and the stored object re-hashes byte-for-byte.
    - **Shared-secret HTTP (simulating MatchZy):** `curl -X POST` with the secret header + a zipped `.dem` body + `MatchZy-MatchId` → decompressed `.dem` in R2 + demo row (`source='matchzy'`); wrong/missing secret → rejected.
    - **Admin presigned:** obtain a presigned URL from the worker, `curl -T ./cache.dem <url>` (browser-equivalent), then `POST /api/ingest/register {match_id, storage_key}` as an admin → demo row (`source='manual_upload'`); a non-admin `register` → 403.
  - [ ] Confirm **no demo bytes ever hit a Next.js route** (only the tiny JSON `register` did).
  - [ ] **Deferred to operational gate (Epic 7):** live Railway worker deploy + a rented MatchZy CS2 server proving the true auto-upload end-to-end. Note it; do not block 3.1 on it.

## Dev Notes

### Resolved Decisions (Cuatro, during story creation — build for these)

1. **Demo table = create migration `0005_demo.sql` now, with nullable shells.** `demo_sha256` and `parser_version` are nullable in 0005; `UNIQUE(match_id, demo_sha256)` + `sha256 NOT NULL` land in **Story 3.2**; `parser_version NOT NULL` lands in **Story 3.3**; `demo_match_fk` lands in **Epic 4**. The `register`/CLI/MatchZy paths insert a **partial** acquisition row. (Chosen over "defer the whole table to 3.2".)
2. **Deploy posture = build all three paths, verify locally against real R2, defer live Railway + MatchZy server** to an operational gate (Epic 7). Live-QA (Task 9) verifies CLI + admin-presigned + shared-secret-HTTP locally; the MatchZy auto path is built + unit-tested only. Mirrors Story 2.1 (prod domain deferred to Epic 7, local dev worked).
3. **DemoStore backends = R2 impl + in-memory fake (tests) only; defer the Supabase-Storage impl.** The interface stays swap-ready (AD-16) but only R2 (primary) is built (Supabase needs a paid tier for 50–170 MB files; YAGNI).

### Architecture patterns & invariants (must follow)

- **`Acquiring` node only.** State machine `Acquiring → Hashing → Deduped → (AlreadyIngested | Parsing) → Validating → (Anomalous | Pending) → Approved` [Source: ARCHITECTURE-SPINE.md#Demo-ingest-lifecycle L277–297]. 3.1 = `Acquiring` (bytes durable in R2 / local file). Stop before hashing.
- **AD-16 — bytes bypass Vercel; storage is an abstraction** [Source: ARCHITECTURE-SPINE.md#AD-16 L155–158; SOLUTION-DESIGN.md#6 L322–333]. Three ingest paths, DB records only opaque `(storage_backend, storage_key)` + hash. `DemoStore` R2-primary, Supabase-swappable.
- **AD-2 — single-writer** [Source: ARCHITECTURE-SPINE.md#AD-2 L85–88]. The worker (service role) is the only writer of `demo`/`stat_row`; no anon/authenticated write policy or grant; the app has no *stat*-write path. (See the flagged nuance in Task 6 for the manual-path acquisition-record insert.)
- **AD-25 — server-only secrets, single environment** [Source: ARCHITECTURE-SPINE.md#AD-25 L200–203]. Supabase service-role key, R2 write creds, worker↔MatchZy shared secret live only in server env (Railway/Vercel), never `NEXT_PUBLIC_*`. R2 raw demos are the DR source of truth (object-lock on `permanent_seed`).
- **AD-1 — immutable source of truth** [Source: ARCHITECTURE-SPINE.md#AD-1 L80–83]. The retained `.dem` is re-hashable byte-for-byte (the AD-1 round-trip test in Task 8). Store the **canonical `.dem`** (decompress MatchZy's zip), because the fairness seed is `SHA-256(final_demo_bytes)` over the `.dem`.
- **AD-26 — async, off-request** [Source: ARCHITECTURE-SPINE.md#AD-26 L205–208]. Never parse inline in a Vercel request. The full bounded/retriable queue is Story 3.8; 3.1 does the store + record synchronously and stops (no parse, no queue).
- **Module boundary** [Source: ARCHITECTURE-SPINE.md#Design-Paradigm L73–76]. **No code dependency edge** between `worker/*` and `app/`+`lib/`. The only coupling is `supabase/migrations` (the schema contract). The `/api/ingest/register` route touching R2-uploaded objects is a runtime relationship via the shared DB + R2, not a code import.

### The `demo` table DDL (SOLUTION-DESIGN §3, L93–108) — implement in 0005 with shells

```sql
create table demo (
  id               bigint generated always as identity primary key,
  match_id         bigint not null,                 -- FK -> match(id) DEFERRED to Epic 4 (no match table yet)
  demo_sha256      text,                            -- SHELL: Story 3.2 sets value + NOT NULL + UNIQUE(match_id,demo_sha256)
  storage_backend  text not null default 'r2'
                     check (storage_backend in ('r2','supabase')),   -- AD-16
  storage_key      text not null,                   -- opaque (AD-16)
  size_bytes       bigint,
  source           text not null check (source in ('matchzy','manual_upload')),
  retention_class  text not null default 'event_archive'
                     check (retention_class in ('event_archive','permanent_seed')),   -- AD-16
  delete_after     timestamptz,                     -- NULL = keep forever (permanent_seed => NULL)
  parser_version   text,                            -- SHELL: Story 3.3 sets value + NOT NULL
  parse_generation int not null default 1,          -- bumps on re-parse (Story 3.6)
  archived_at      timestamptz not null default now()
);
```
Then ENABLE+FORCE RLS, the `demo_admin_read` policy, and `grant select, insert, update on public.demo to service_role;` — mirror `0003_audit_snapshot.sql` (admin-only, dormant policy) but **add UPDATE** (0003's audit/snapshot are append-only select+insert; `demo` needs UPDATE for the 3.2/3.3 backfills + re-parse `parse_generation` bump). **NO delete grant.** [Precedents: `0003_audit_snapshot.sql:56–80`, `0004_roster.sql:37–75`.]

### MatchZy upload contract (confirmed from live docs — pin against the deployed version)

- cvar `matchzy_demo_upload_url` → the worker endpoint. HTTP **POST**, body = **zipped** demo (raw binary). Metadata **headers**: `MatchZy-FileName`, `MatchZy-MapNumber`, `MatchZy-MatchId`. [Source: https://shobhit-pathak.github.io/MatchZy/gotv/ (fetched 2026-07-06).]
- The fetched docs snapshot shows **no auth-header cvar** — so the worker↔MatchZy shared secret must be carried by whatever the deployed MatchZy build supports (a configurable upload header if present, else a secret URL path/query segment). Confirm and document.
- The worker must **decompress** to the canonical `.dem`, and **stream** (not buffer) the 50–170 MB body.

### Cloudflare R2 (S3-compatible) — Go side

- SDK: `aws-sdk-go-v2` (S3 client + `PresignClient`). Endpoint `R2_S3_ENDPOINT` (`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`), region `auto`, static creds, bucket `R2_BUCKET`. Free egress. One bucket in v1 (AD-25). [Source: ARCHITECTURE-SPINE.md#Stack L247; SOLUTION-DESIGN.md#6 L327–330.]
- Presigned PUT is sufficient for ≤5 GB objects (covers 50–170 MB); use presigned multipart only if you specifically want resumable parts. Verify the exact presign API against the installed SDK version.

### Env / secrets (already stubbed — consume, don't invent)

`.env.example` already defines (lines 44–52): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_S3_ENDPOINT`, `WORKER_MATCHZY_SHARED_SECRET`; plus `SUPABASE_DB_PASSWORD` (comment: "migrations… and direct worker DB access"). **No net-new env names.** These are worker-side — do **not** add getters to `lib/env.ts` (TS) or to `FORBIDDEN_PUBLIC_MIRRORS` unless TS ever reads them (it should not). Host labeled Railway.

### Source tree — where things go

```
cs-tournament/
  app/api/ingest/register/route.ts   # NEW — thin requireAdmin route (manual-path notify); mirrors app/api/admin/roster/route.ts
  lib/ingest.ts (+ .test.ts)         # NEW — register domain logic (typed result, injectable), mirrors lib/roster.ts
  supabase/migrations/0005_demo.sql  # NEW — demo table (shells)
  supabase/tests/0005_demo_test.sql  # NEW — pgTAP plan(N)
  worker/                            # NEW Go module — the repo's first Go code (ARCHITECTURE-SPINE.md:446)
    go.mod                           # go 1.26.x; aws-sdk-go-v2 + pgx/v5 (NOT demoinfocs yet)
    main.go                          # serve (HTTP) | ingest (CLI) dispatch
    config/                          # env load (R2_*, WORKER_MATCHZY_SHARED_SECRET, DB conn)
    store/                           # DemoStore interface + R2 impl + in-memory fake (AD-16)
    ingest/ (or handlers)            # /ingest/matchzy, /ingest/presign, CLI, demo-row writer
    README.md
```
No `go.work`, no `package.json` workspace change — `worker/` is a standalone module root alongside the TS app. [Repo recon: no existing Go code except the throwaway PoC at `_bmad-output/.../poc-cs2-demo-parse/`.]

### Testing standards

- **Go:** stdlib `testing` + `go test ./...`. Make `DemoStore` and the DB writer injectable (interfaces) so tests use an in-memory fake — the Go analogue of Epic 2's `HttpPost`/`HttpGetJson` seams. No real R2/DB in unit tests.
- **TS:** `vitest run` (baseline 104 passing). New: `lib/ingest.ts` + the route, following `lib/roster.test.ts` (requireAdmin gate, body validation, typed-result→status).
- **pgTAP:** explicit `plan(N)` (retro action #5, standing convention); `supabase test db` across all `.sql` suites. Follow `0004_roster_test.sql`'s grant-matrix + policy assertions.
- **Round-trip (AD-1):** store → get → re-hash equals the input bytes.

### PoC to build on (reference, not reused verbatim)

`_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/` — a **parse** spike (belongs to Story 3.3), not acquisition. But it fixes the toolchain the worker adopts: `go 1.26.4`, `github.com/markus-wa/demoinfocs-golang/v5 v5.2.0` (the `/v5` suffix matters), SteamID64-keyed output, `PBDEMS2` Source-2 header check. Parse ~3.4 s / ~257 MB RAM on a 170 MB demo. [Source: poc README; go.mod.] 3.1 borrows only the module/version discipline and the `PBDEMS2` header check; it does **not** import `demoinfocs`.

### Project Structure Notes

- **First multi-language layout.** No precedent for Go in this repo — 3.1 sets the convention (top-level `worker/` module). Keep it isolated: the TS build/test/lint (`next build`, `vitest`, `eslint .`) must be unaffected; the Go build/test is `go build`/`go test` under `worker/`.
- **Migration numbering:** next is `0005` (0001 core, 0002 RLS, 0003 audit/snapshot, 0004 roster). FORCE RLS is auto-enforced by the `0003` generic catalog guard — a table missing FORCE fails the suite.
- **No forward FK** (established: `tournament.final_match_id`, `audit_log.target_match_id`) — `demo.match_id` is a plain `bigint not null`; `demo_match_fk` is Epic 4's.
- **No admin UI:** the UX docs specify an Ingest **approval** console + Evidence view (Epic 5), but **no demo-upload UI** at all — so 3.1's manual fallback is a pure backend path (worker presign + `register` route + CLI), an even clearer deferral than Story 2.5's. [Source: EXPERIENCE.md:44,48,207; DESIGN.md:170,276.]

### Regression / boundary notes

- Do not touch `lib/auth/*`, `lib/roster.ts`, `lib/players.ts`, `session.ts`, `env.ts` public interfaces (Epic 2 surfaces). The only TS additions are `lib/ingest.ts` + `app/api/ingest/register/route.ts`.
- Reuse `requireAdmin` (`lib/auth/admin-guard.ts`), `getAdminClient()` (`lib/supabase/admin.ts`), `createSupabaseServerClient()` (`lib/supabase/server.ts`) verbatim — do not reinvent auth/service-role plumbing.
- `demo` is admin/worker-only: **no viewer read** (unlike `roster_entry`). Mirror `audit_log`, not `roster_entry`, for the policy/grant shape (but add UPDATE).

### Deferred items already logged / to log

- Object-lock hardening on `permanent_seed` (AD-16 storage-layer delete-proof) → Epic 7. 3.1 does the Go-side `Delete()` guard only.
- Audit_log write for the admin manual upload (FR-33/AD-17): deferred — the demo isn't bound to a `match`/`tournament` until Epic 4 (audit_log.tournament_id is NOT NULL; same class as Story 2.4's grant_role audit → 4.9). Note it; do not force a synthetic tournament binding in 3.1.
- Story 2.6 (unreconciled list) still folds in after Story 3.4 (retro action #1) — unrelated to 3.1.

### References

- [Source: epics.md#Story-3.1 L446–470] — the four AC threads + traces.
- [Source: epics.md#Epic-3 L184–186, L442–444] — epic objectives, FRs (FR-11..16), ADs (AD-1,2,3,5,16,23,26).
- [Source: ARCHITECTURE-SPINE.md#AD-16 L155–158; #AD-25 L200–203; #AD-2 L85–88; #AD-1 L80–83; #AD-26 L205–208] — invariants.
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed L256–273 (topology), L277–297 (ingest state machine), L435–452 (source tree); #Stack L244–248] — worker/R2/Railway/Go decisions.
- [Source: ARCHITECTURE-SPINE.md#Core-entities L368–377] — demo ERD.
- [Source: SOLUTION-DESIGN.md#3 L93–108 (demo DDL, L133 deferred FK); #6 L322–336 (ingest triggers/job model)] — the DDL + the three-trigger pipeline + `/api/ingest/register`.
- [Source: prd.md FR-11 L222–230, FR-15 L258–265, FR-16 L267–273; §9 L509–511 (the three caps); SM-5 L489] — product requirements + the 4.5 MB/50 MB/retention constraints.
- [Source: prds/.../addendum.md L16–23 (demoinfocs v5.2.0), L27–32 (caps), L48 (hosting)] — pinned parser + hosting options.
- [Source: research/technical-cs2-demo-parsing-research-2026-06-29.md Q1 L72–76 (matchzy cvars), Q4 L185–197 (Vercel/Supabase caps), L213–224 (hosting)] — MatchZy config + worker hosting.
- [Source: https://shobhit-pathak.github.io/MatchZy/gotv/ (fetched 2026-07-06)] — the confirmed MatchZy upload wire contract (POST, zipped body, `MatchZy-*` headers).
- [Precedents: supabase/migrations/0003_audit_snapshot.sql (admin-only policy+grant), 0004_roster.sql (two-policy, grants), 0004_roster_test.sql (pgTAP style); app/api/admin/roster/route.ts (thin route shape); lib/roster.ts (typed-result domain logic).]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

- `supabase db reset` applied 0001→0005 cleanly; `supabase test db` → **Files=6, Tests=209, PASS** (was 171 across 5 files; `0005_demo_test.sql` adds `plan(38)`). The 0003 generic catalog FORCE-guard now also covers `demo`.
- `go mod tidy` resolved: aws-sdk-go-v2 v1.42.1 (+ credentials v1.19.27, feature/s3/manager v1.22.31, service/s3 v1.105.0), jackc/pgx/v5 v5.10.0. **No demoinfocs** (not until Story 3.3).
- `go build ./...` / `go vet ./...` / `go test ./... -count=1` → **28 test functions PASS** across 5 packages (worker, config, db, ingest, store). `gofmt -l worker` clean.
- Vitest 104 → **110** (+6 `lib/ingest.test.ts`). `next build` clean — `/api/ingest/register` renders **ƒ (Dynamic)**. `eslint .` clean.
- NEXT_PUBLIC leak scan: 0 real leaks (only the protective `FORBIDDEN_PUBLIC_MIRRORS` entry). `git diff lib/env.ts` empty (untouched — no R2 getters, as required).

### Completion Notes List

- **Scope = the `Acquiring` node only.** Built all three ingest paths (MatchZy auto-upload, admin presigned + `/api/ingest/register`, local CLI); each stores the canonical `.dem` to R2 via `DemoStore` and records a partial `demo` acquisition row (`demo_sha256`/`parser_version` NULL shells). NO hashing (3.2), NO parse/`stat_row` (3.3), NO async queue (3.8), NO `demoinfocs` import.
- **Built for the 3 resolved decisions:** (1) migration `0005_demo.sql` created now with nullable shells; (2) all three paths built + locally verifiable, live Railway/MatchZy deferred (Task 9/Epic 7); (3) `DemoStore` = R2 impl + in-memory fake only (Supabase-Storage deferred).
- **AC1** MatchZy receiver: `POST /ingest/matchzy`, constant-time shared-secret auth (Authorization header **or** `?token=`, pinned at deploy), framing auto-detect (gzip streamed / zip spooled-to-temp-file / raw PBDEMS2), stream to R2, record `source='matchzy'`. Live CS2 E2E deferred.
- **AC2** Admin path: worker `POST /ingest/presign` mints a single presigned PUT URL (worker holds R2 creds; the app does not); `app/api/ingest/register/route.ts` (`requireAdmin`-gated, thin, mirrors `admin/roster/route.ts`) records the row via `lib/ingest.ts`.
- **AC3** CLI: `worker ingest <path.dem> --match <id>` (flag accepted in any position), PBDEMS2 header guard, same store→record core, `source='manual_upload'`.
- **AC4** `DemoStore` interface (Backend/Put/PresignPut/Get/Delete) + R2 impl + map-backed fake; opaque `demos/<match_id>/<rand>.dem` keys; AD-1 round-trip (Put→Get→re-hash) proven on the fake.
- **AC5** Bypass invariant: the 50–170 MB bytes reach the Go worker or R2 directly on every path; only the tiny `{match_id,storage_key}` JSON notify touches Next.js. No R2/worker/MatchZy secret is NEXT_PUBLIC; `lib/env.ts` gains no R2 getters.
- **AC6** `0005_demo.sql` per SOLUTION-DESIGN §3 (shells) + ENABLE/FORCE RLS + dormant `demo_admin_read` (mirrors `audit_log`) + `grant select,insert,update` to service_role (NO delete) + pgTAP `plan(38)`. NO `UNIQUE(match_id,demo_sha256)`, NO `match` FK.
- **AC7** Single-writer + module boundary: every `demo` write is service-role (no anon/authenticated grant/policy — pgTAP proves the fail-closed matrix); `worker/*` has NO code import of `app/`+`lib/` (or vice-versa) — only the shared DB schema + R2 bucket couple them. All new secrets are server-only.
- **AD-2 nuance flagged for code-review:** `lib/ingest.recordManualUpload` is the one place the *app* writes a `demo` row (acquisition metadata only, never `stat_row`); documented in the `lib/ingest.ts` header. The worker remains the sole writer of derived stats.
- **Retention guard (AD-16):** the Go-side `Delete()` refuses `permanent_seed` unless `force` (`ErrPermanentSeedProtected`); storage-layer object-lock hardening is noted as Epic-7-deferred.
- **Streaming discipline:** `Acquire` never buffers the whole body; the zip path spools the *compressed* body to a temp file (disk, not RAM) so the decompressed 50–170 MB never fully lands in memory; a counting reader records the streamed size.
- **DB connection** derived from `SUPABASE_URL` + `SUPABASE_DB_PASSWORD` (no net-new env): hosted `db.<ref>.supabase.co:5432` / local `127.0.0.1:54322`.
- **⛔ Task 9 (live-QA sign-off) is a PENDING human gate** — it needs real `R2_*` creds, a real Source-2 `.dem`, and a seeded season+tournament row; the dev agent cannot run it. Mirrors the 2.1–2.5 rhythm (dev-story → code-review → Cuatro clears live-QA → `done`).
- **No regressions:** `lib/auth/*`, `lib/roster.ts`, `lib/players.ts`, `session.ts`, `env.ts` untouched; the only TS additions are `lib/ingest.ts` + `app/api/ingest/register/route.ts` (+ test).

### File List

**New — migration + pgTAP (Task 1)**
- `supabase/migrations/0005_demo.sql`
- `supabase/tests/0005_demo_test.sql`

**New — Go worker module (Tasks 2–7)**
- `worker/go.mod`, `worker/go.sum`
- `worker/main.go`, `worker/main_test.go`
- `worker/README.md`
- `worker/config/config.go`, `worker/config/config_test.go`
- `worker/store/store.go`, `worker/store/r2.go`, `worker/store/fake.go`, `worker/store/store_test.go`
- `worker/db/db.go`, `worker/db/fake.go`, `worker/db/fake_test.go`
- `worker/ingest/ingest.go`, `worker/ingest/decompress.go`, `worker/ingest/server.go`, `worker/ingest/cli.go`
- `worker/ingest/ingest_test.go`, `worker/ingest/decompress_test.go`, `worker/ingest/server_test.go`, `worker/ingest/cli_test.go`

**New — TS (Task 6)**
- `lib/ingest.ts`, `lib/ingest.test.ts`
- `app/api/ingest/register/route.ts`

**Modified**
- `.gitignore` (Go worker build-artifact ignores)
- `_bmad-output/implementation-artifacts/3-1-demo-acquisition-that-bypasses-vercel.md` (this story: `baseline_commit` frontmatter, task checkboxes, Dev Agent Record, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`3-1` status flip)

### Change Log

| Date       | Change |
|------------|--------|
| 2026-07-06 | Story 3.1 implemented (Acquiring node): migration `0005_demo.sql` (shells) + pgTAP `plan(38)`; first Go worker module (`worker/`, `go 1.26.4`, aws-sdk-go-v2 + pgx/v5) with `DemoStore` (R2 + fake), pgx demo-row writer, MatchZy receiver, admin presign, CLI; `lib/ingest.ts` + `/api/ingest/register` route. Green: Go 28 tests, pgTAP Files=6/209, Vitest 110, `next build` clean, lint clean. Status → review (Task 9 live-QA is a pending human gate). |
| 2026-07-06 | Code-review (`bmad-code-review`, 3 adversarial Opus-4.8 layers; all 7 ACs PASS). 1 patch applied — ingest size/decompression-bomb caps: `http.MaxBytesReader` on the MatchZy request body + an erroring `newLimitedReadCloser(300 MiB)` ceiling on the decompressed stream in `decompressToDem` (+ `TestLimitedReadCloserErrorsPastCap`). Go tests 28→29 PASS; `gofmt`/`build`/`vet` clean. 4 defers logged to deferred-work.md, 10 dismissed. Status → in-progress (Task 9 live-QA still a pending human gate → then done). |

## Review Findings

_Code review 2026-07-06 (`bmad-code-review`; 3 adversarial Opus-4.8 layers — Blind Hunter / Edge Case Hunter / Acceptance Auditor; none failed). **Acceptance Auditor: all 7 ACs PASS** — DDL exact vs SOLUTION-DESIGN §3, `plan(38)`=38, module boundary holds, no scope creep, `demoinfocs` not imported. RLS/grants (FORCE, admin-only dormant SELECT, `select/insert/update` NO delete, no anon/authenticated grant) independently re-verified. Severity is calibrated to the private-tournament threat model: every ingest endpoint is **shared-secret** or **`requireAdmin`** gated and feeds from the operator's own MatchZy server — there is no public/anonymous attack surface. Triage: **1 decision-needed → resolved (patch applied), 4 defer, 10 dismissed.**_

### Decision Needed → Resolved (patch applied 2026-07-06)

- [x] [Review][Decision→Patch] **Ingest size / decompression-bomb caps** — The MatchZy receiver streamed the auto-detected (gzip/zip/raw) body to R2 with **no `http.MaxBytesReader`** and no decompressed-size ceiling; the zip path spooled the whole compressed body to a temp file via an uncapped `io.Copy`. A holder of `WORKER_MATCHZY_SHARED_SECRET` — or a buggy/misconfigured MatchZy build — could write an unbounded object to R2 (cost) or fill the worker's disk. Not public-exploitable. **Decision (Cuatro, 2026-07-06): apply a minimal cap now (Option 1).** **Applied:** `http.MaxBytesReader(w, r.Body, maxDemoBytes)` in `handleMatchZy` caps the raw/compressed request body (protects the zip-spool disk + the raw object size), and `decompressToDem` now wraps its output in `newLimitedReadCloser(dem, maxDemoBytes)` — an erroring ceiling on the **decompressed** stream. Unlike `io.LimitReader` (which silently truncates at the cap and would store a truncated demo as "complete"), it returns `errUploadTooLarge` past the cap, so a gzip/zip bomb **aborts** the acquisition. Cap = **300 MiB** (≫ the 170 MB max demo). Regression test `TestLimitedReadCloserErrorsPastCap` added (at-cap passes; one byte over fails). The presign `ContentLength` condition is left to Epic 5 (its browser consumer isn't built). `[worker/ingest/server.go:82; worker/ingest/decompress.go:34-90]` — **GREEN:** `gofmt`/`go build`/`go vet` clean; `go test ./...` **28→29 PASS**.

### Deferred (logged to deferred-work.md)

- [x] [Review][Defer] **Presign shares the MatchZy shared secret across two trust boundaries** `[worker/ingest/server.go:113]` — deferred to Epic 5 (admin-upload UI). `/ingest/presign` uses the same `WORKER_MATCHZY_SHARED_SECRET` as the MatchZy receiver; when the browser consumer is built, decide an app-side `requireAdmin` proxy (secret stays server-side) vs a separate presign secret. Not exploitable now — no browser consumer is built in this slice.
- [x] [Review][Defer] **`/api/ingest/register` trusts an unverified client-supplied `storage_key`** `[lib/ingest.ts:32; app/api/ingest/register/route.ts:47]` — deferred to Epic 5. `parseRegisterBody` only checks non-empty; a mismatched/never-uploaded key → orphan/mismatched row, and a browser PUT that never registers → orphan object. Admin-gated (operator-trusted); verifying needs an R2 HEAD (app has no R2 creds by design) or binding the key to the presign — design work for the Epic 5 flow.
- [x] [Review][Defer] **Shared secret carried in `?token=` query is logged** `[worker/ingest/server.go:47]` — deferred to Epic 7 (deploy hardening). Deliberate fallback (MatchZy docs show no auth-header cvar); prefer the `Authorization` header carrier at deploy if the build supports it, rotate if logs are exposed.
- [x] [Review][Defer] **MatchZy gzip/zip paths don't re-validate the decompressed content is a `PBDEMS2` .dem (the CLI does)** `[worker/ingest/decompress.go:42,78]` — deferred (optional consistency guard). 3.2 hashing / 3.3 parsing catch non-demos downstream; cheap to add a decompressed-magic peek mirroring `checkDemHeader`.

### Dismissed (10 — verified noise / documented-intentional / handled)

1. **Store-before-record orphan + retry duplication** `[worker/ingest/ingest.go:33-36]` — documented intentional; store-before-record guarantees no row points at nothing; 3.2's hash+UNIQUE reconciles duplicate NULL-sha256 rows.
2. **`size_bytes` 0 → NULL conflation** `[worker/db/db.go:21; supabase/migrations/0005_demo.sql:31]` — column is nullable by design; "0 ⇒ unknown size ⇒ NULL" is documented; immaterial at acquisition.
3. **Zero-byte / tiny-junk demo stored** — requires the secret; a truly empty body already 400s at framing detection; 3.2 hashing catches junk.
4. **`Authorization` vs `?token=` precedence** `[worker/ingest/server.go:45]` — fails **closed** (denies, never bypasses); the carrier is pinned to one at deploy.
5. **`NewStorageKey` 128-bit collision → overwrite + dup row** `[worker/store/store.go:50]` — astronomically improbable; `UNIQUE` is deferred to Story 3.2 by design.
6. **`handlePresign` JSON trailing-garbage tolerance** `[worker/ingest/server.go:119]` — no wrong outcome; the `match_id<=0` guard handles the real case.
7. **`Delete()` retention guard not wired into a call path** `[worker/store/r2.go:87]` — by design; GC is Epic 7; AC4 only requires the guard to exist (it does + is tested).
8. **MatchZy-FileName / MapNumber headers ignored** `[worker/ingest/server.go:73]` — no column for them; opaque key; immaterial to acquisition.
9. **`Put` ignores the advisory `size` param** `[worker/store/r2.go:50]` — intentional per the interface doc (streams a non-seekable body via multipart).
10. **`size_bytes` reflects post-decompression streamed length** `[worker/ingest/ingest.go:45]` — correct behavior (the canonical `.dem` size, matching AD-1).
