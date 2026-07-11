---
baseline_commit: 71b8652cf1a16d45c16f130216bb8721f995a69a
---

# Story 3.2: Hash, dedup, and write-once retention

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want every demo the worker acquires to be **hashed**, **deduplicated**, and retained **write-once**,
so that the raw `.dem` is an immutable, re-hashable source of truth and a re-uploaded identical demo short-circuits to the prior result instead of writing duplicate rows or re-parsing.

**This is the second story of Epic 3.** Story 3.1 stood up the worker and got the bytes durable in R2 with a **partial** acquisition row (`demo_sha256` NULL). Story 3.2 slots the **`Hashing → Deduped → (AlreadyIngested | new)`** span of the ingest state machine into that existing store→record core: compute the SHA-256 **while** the bytes stream to R2 (single pass, no re-download, no extra buffering), record it, and enforce `UNIQUE(match_id, demo_sha256)` so a duplicate upload is a no-op. It stops **before** `Parsing` — no `demoinfocs`, no `stat_row`, no job queue (Stories 3.3 / 3.8).

## Acceptance Criteria

> Restated from `epics.md#Story 3.2` (lines 472–493), elaborated with the two central decisions resolved by Cuatro during story creation (see **Dev Notes → Resolved Decisions**). Traces: **FR-15 · AD-1, AD-3**.

**AC1 — Hash + write-once retention (AD-1, FR-15).**
When a demo is acquired on a **worker-driven path** (MatchZy auto-upload, CLI), the worker computes its **SHA-256** over the exact canonical `.dem` bytes it stores, stores the raw `.dem` **write-once**, and records the hash on the `demo` row together with `retention_class` (defaulting to `event_archive`, already recorded since 3.1). The stored raw demo **re-hashes byte-for-byte** to the recorded `demo_sha256` (the AD-1 round-trip, now proven over the *recorded* hash, not just byte-equality). Write-once is already structural from 3.1 (no DELETE grant on `demo`; the Go-side `Delete()` refuses `permanent_seed`); this story adds the hash that makes the retained object *identifiable and verifiable*.

**AC2 — Idempotency key (AD-3).**
`demo` enforces `UNIQUE(match_id, demo_sha256)` via a new migration `0006`. Two rows sharing `(match_id, demo_sha256)` are rejected (`23505`); the same demo hash under a *different* `match_id`, and the same `match_id` under a *different* hash, both remain insertable.

**AC3 — `AlreadyIngested` short-circuit (AD-3, AD-26).**
When a demo whose `(match_id, demo_sha256)` **already exists** is re-acquired on a worker path, ingestion **short-circuits to the prior result**: it writes **no duplicate `demo` row**, does not re-parse (parse is 3.3 anyway), and the redundant just-uploaded object is not left as permanent waste. The path returns the prior row's outcome (e.g. its `storage_key`), signalled to the caller (MatchZy receiver returns `already_ingested: true`; the CLI logs it).

**AC4 — Migration `0006` + pgTAP; the `0005` canary is flipped.**
`supabase/migrations/0006_demo_hash_dedup.sql` adds `UNIQUE(match_id, demo_sha256)` to `demo` (see the **Resolved Decisions** below for why `demo_sha256` stays **nullable** in this slice). A **new** `supabase/tests/0006_demo_hash_dedup_test.sql` with an explicit `plan(N)` (retro action #5) proves the constraint bites and that NULL-sha256 rows (the manual path) still insert. **Critically, `supabase/tests/0005_demo_test.sql` must be updated**: its deliberate "premature-dedup canary" at lines 78–84 — a `lives_ok` inserting two rows sharing `(match_id, demo_sha256)` — is designed to start failing the day this constraint lands, so it must flip to a `throws_ok('23505', …)`. `supabase test db` stays green with the new file added.

**AC5 — Single-writer + module boundary unchanged (AD-2).**
Hashing and dedup live entirely in the Go worker; the worker is still the only writer of the hashed `demo` rows (service-role / owner connection). The `worker/*` ↔ `app/`+`lib/` boundary is unchanged (no code import edge; only the `supabase/migrations` schema contract). The admin manual-upload path's app-side insert (`lib/ingest.recordManualUpload`) is **untouched** in this slice (it keeps recording a NULL-sha256 row; its hashing is deferred — see Resolved Decisions). No new `NEXT_PUBLIC_*`, no new env names.

### Out of scope (do NOT build here)

- **Parse → `stat_row`** (demoinfocs, per-SteamID64 rows) → **Story 3.3**. This story still does **not** import `demoinfocs-golang`. `parser_version` stays a NULL shell.
- **`demo_sha256 NOT NULL` + worker-side hashing of the admin manual-upload path** → deferred to **Epic 5** (the admin-upload UI slice, where the browser→R2→worker-hash flow is actually built). See Resolved Decision 1. This story keeps `demo_sha256` nullable so the manual path's app insert is unaffected.
- **Bounded async job queue / retry-backoff** (AD-26) → **Story 3.8**. Hashing is done synchronously inside the acquire path here.
- **`permanent_seed` selection + R2 object-lock / `delete_after` GC** (AD-16 storage-layer delete-proofing) → the fairness-seed choice is **Epic 6**, object-lock hardening is **Epic 7** (`epics.md:1230`). This story leaves `retention_class` at its `event_archive` default and adds no GC.
- **`match` table + `demo_match_fk`** → Epic 4. `demo.match_id` stays a plain `bigint not null`.
- **Re-parse `parse_generation` bump / rollback** → Stories 3.6 / 4.7.

## Tasks / Subtasks

- [x] **Task 1 — Migration `0006_demo_hash_dedup.sql` + flip the `0005` canary + new pgTAP (AC2, AC4)**
  - [x] Create `supabase/migrations/0006_demo_hash_dedup.sql`. Header-comment style of `0003`/`0004`/`0005`: a SCOPE block (add `UNIQUE(match_id, demo_sha256)` — the AD-3 idempotency key) and an explicit **OUT OF SCOPE** block (`demo_sha256 NOT NULL` deferred to Epic 5 with manual-path worker-hashing; no `demo_match_fk`; no object-lock; no `parser_version NOT NULL`).
  - [x] `alter table public.demo add constraint demo_match_sha256_uniq unique (match_id, demo_sha256);` — keep `demo_sha256` **nullable** (Resolved Decision 1). Note in the comment: Postgres treats NULLs as distinct, so un-hashed manual-path rows (NULL sha256) are unaffected by the UNIQUE; the worker paths set a real hash so their `(match_id, sha256)` genuinely dedups.
  - [x] **Update `supabase/tests/0005_demo_test.sql`** — flip the premature-dedup canary. The `lives_ok` inserting two rows `(9, …, 'dupsha'), (9, …, 'dupsha')` is now a `throws_ok($$ … $$, '23505', null, 'demo: UNIQUE(match_id, demo_sha256) now rejects a duplicate (match_id, sha256) — Story 3.2')`. Assertion count unchanged (one throws_ok replaces one lives_ok), so `plan(38)` holds — verified green. The NULL-shell assertions and minimal `(match_id, storage_key, source)` inserts are intact.
  - [x] Create `supabase/tests/0006_demo_hash_dedup_test.sql` with explicit `plan(7)`: `col_is_unique` on `(match_id, demo_sha256)`; `col_is_null` on `demo_sha256` (stays nullable); (a) first `(1, sha-a)` inserts + a duplicate → `23505`; (b) same `demo_sha256`, different `match_id` → inserts; (c) same `match_id`, different `demo_sha256` → inserts; (d) two NULL-sha256 rows for the same `match_id` **both insert** (`lives_ok`) — proves the manual path is unaffected (NULLs distinct). No role-switch (constraints fire for any writer).
  - [x] Verify: `supabase db reset` applies `0001→0006` cleanly; `supabase test db` stays green and adds `0006_demo_hash_dedup_test.sql` (Files 6 → 7, Tests → 216). ✅

- [x] **Task 2 — Compute the SHA-256 while streaming (single pass), in the acquire core (AC1)**
  - [x] In `worker/ingest/ingest.go` `Acquire`, the body is teed into a `crypto/sha256` hasher **as `Put` streams it to R2** via `io.TeeReader(counter, hasher)` — no re-download, no full-body buffering. The counter is ordered INSIDE the tee so it still sees the true `.dem` length while the hasher sees exactly the stored bytes. After `Put`, `hex.EncodeToString(hasher.Sum(nil))` is the SHA-256 of exactly the stored bytes (AD-1).
  - [x] Introduced `AcquireResult{ StorageKey, SHA256 string; AlreadyIngested bool }`; `Acquire` returns it (not a widened tuple). HTTP + CLI callers both consume the `AlreadyIngested` signal.
  - [x] Store-**before**-record ordering from 3.1 preserved. The hash is known only after the stream, so dedup happens at the **record** step (Task 3), not before the upload — single-pass tee per Resolved Decision 2.

- [x] **Task 3 — Dedup at the DB writer + `AlreadyIngested` short-circuit (AC2, AC3)**
  - [x] `worker/db/db.go`: added `SHA256 string` to `DemoRow`. `PgxRecorder.RecordDemo` now inserts `demo_sha256` with `on conflict (match_id, demo_sha256) do nothing returning storage_key`. The `DemoRecorder` interface returns `(RecordOutcome{ Inserted bool; ExistingKey string }, error)`: a returned key → `Inserted=true`; `pgx.ErrNoRows` (zero rows) → conflict → `select storage_key … where match_id=$1 and demo_sha256=$2` fetches the prior key → `Inserted=false, ExistingKey=…`. The AD-3 short-circuit at the write boundary.
  - [x] On `Inserted=false`, `Acquire` calls `DemoStore.Delete(ctx, key, "event_archive", false)` on the just-uploaded object (byte-identical to the retained prior one; guard permits `event_archive` — the **first** real `Delete` caller) and returns `AlreadyIngested=true` with the *prior* `storage_key`. A delete failure is logged and tolerated (DB already has no duplicate row; Epic-7 GC is the backstop).
  - [x] `worker/db/fake.go`: `FakeRecorder` mirrors the dedup in-memory via a `seen map[(MatchID,SHA256)] → firstKey`; a repeat returns `Inserted=false` + the first key. A NULL/empty SHA256 never dedups (NULLs distinct). `Err` injection seam preserved.
  - [x] `lib/ingest.recordManualUpload` (NULL sha256) is **untouched** — `git diff lib/ app/` is empty. Manual rows don't dedup (NULLs distinct), the accepted interim (Resolved Decision 1).

- [x] **Task 4 — Signal `AlreadyIngested` on the worker paths (AC3)**
  - [x] `worker/ingest/server.go` `handleMatchZy`: success returns `{"ok": true, "storage_key": <key>, "already_ingested": <bool>}`. An identical re-upload returns `200` + `already_ingested: true` + the prior key (idempotent retry). The 3.1 body-cap (`http.MaxBytesReader`) + decompressed ceiling are unchanged.
  - [x] `worker/ingest/cli.go` `RunCLI` returns `AcquireResult`; `worker/main.go` `runIngest` logs `ingested %s -> %s (already_ingested=%t)` so an operator re-running the CLI sees the short-circuit.
  - [x] The admin manual path (`/ingest/presign` → browser PUT → `/api/ingest/register`) is unchanged — no hash, no dedup, no short-circuit (Resolved Decision 1).

- [x] **Task 5 — Tests, round-trip over the recorded hash, and green-bar (AC1, AC2, AC3, AC5)**
  - [x] `worker/store/store_test.go`: new `TestPutTeeHashRoundTrip` — `Put` a fixture through `io.TeeReader` (the acquire pattern), capture the computed sha256, `Get` it back, re-hash, and assert the re-hash equals the **recorded** sha256. Proves the AD-1 round-trip over the recorded hash.
  - [x] `worker/ingest/ingest_test.go`: fresh demo → `AlreadyIngested=false`, object stored, row + result carry the correct sha256 (`TestAcquireStoresThenRecords`); a second identical `Acquire` → `AlreadyIngested=true`, prior key, **no** second row, redundant object deleted (`FakeStore.Len()` stays 1, prior object retained) (`TestAcquireDedupSecondIsAlreadyIngested`); same-bytes/different-match → two rows/objects (`TestAcquireDifferentMatchNoFalseDedup`).
  - [x] `worker/ingest/server_test.go` asserts the MatchZy handler emits `already_ingested` (fresh `false`; re-POST `true` + no dup row + object deleted); `cli_test.go` asserts a re-run reports `already_ingested`. `fake_test.go` updated for the new signature + dedup/NULL cases. `go build ./...` + `go test ./...` clean.
  - [x] Whole bar green: `go build ./...`, `go vet ./...`, `gofmt -l` clean; `go test ./...` all 5 packages pass. `vitest run` unchanged at **110**; `git diff lib/ app/` **empty**; `next build` clean. `supabase test db` green with `0005` updated + `0006` added (Files=7, Tests=216).
  - [x] No `NEXT_PUBLIC_*` leak; `lib/env.ts` untouched (worker-only hash; empty `lib/` diff confirms it).

- [ ] **Task 6 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy deferred to Epic 7)** ⛔ **PENDING (Cuatro).** Mirrors the 3.1 rhythm — the dev agent cannot run it.
  - [ ] **Prereq:** the same real Source-2 `.dem` used in 3.1 live-QA (`demos/cuatro-luisito.dem`, `PBDEMS2`, 31,005,788 bytes) + real `R2_*` creds. Note the 3.1 infra finding: the worker's hosted-DB DSN is IPv6-only with no Supavisor-pooler path, so DB writes run against the **local** Supabase stack on an IPv4-only host (R2 is the real bucket) — logged in `deferred-work.md`, not a 3.2 blocker.
  - [ ] **CLI:** `worker ingest <path.dem> --match <id>` → object in R2 + `demo` row with a **non-NULL `demo_sha256`**; re-download the R2 object via `aws s3api` and confirm its SHA-256 **equals the recorded `demo_sha256`** (AD-1, live). Run the **same** command again → `already_ingested=true`, **no second `demo` row**, and R2 did not gain a second object for that hash.
  - [ ] **MatchZy HTTP:** POST the `.dem.gz` to `/ingest/matchzy?token=…` → gzip auto-decompressed, hashed, stored, `demo` row with the sha256 of the **decompressed canonical** `.dem`. Re-POST the identical body → `200 {"already_ingested": true}`, no duplicate row. Wrong token → `401`, nothing stored (fail-closed, from 3.1).
  - [ ] Confirm `demo_sha256` is a lowercase 64-hex string and matches `sha256sum` of the local canonical `.dem`.
  - [ ] **QA cleanup:** delete the test R2 objects; local rows are disposable.
  - [ ] **Deferred to Epic 7:** live Railway deploy + rented MatchZy server (unchanged from 3.1); the worker hosted-DB IPv4/pooler gap.

### Review Findings

Code review (`bmad-code-review`, 2026-07-11). Three adversarial layers — Blind Hunter (diff-only), Edge Case Hunter (diff + repo read), Acceptance Auditor (diff + spec). Outcome: **0 decision-needed, 2 patch, 0 defer, 1 dismissed.** No correctness bugs and no unhandled edge cases were found; AC1–AC5 and both Resolved Decisions were verified met, with no scope breach.

- [x] [Review][Patch] Use a named `RetentionEventArchive` constant instead of the bare `"event_archive"` literal at the orphan-delete site [worker/ingest/ingest.go:92] — mirrors the existing `RetentionPermanentSeed` pattern (worker/store/store.go:24); behavior unchanged (`guardDelete` only blocks `permanent_seed`). Pure magic-string cleanup. _(Acceptance Auditor AA-1)_ **Applied 2026-07-11** — added `store.RetentionEventArchive`, used at the delete site + the `store_test.go` guard test.
- [x] [Review][Patch] Add one end-to-end AC1 round-trip test — `Acquire → Get(storageKey) → re-hash == recorded DemoRow.SHA256` in a single assertion [worker/ingest/ingest_test.go] — today the invariant is proven transitively across `TestPutTeeHashRoundTrip` (store-level, tee-local hash) + `TestAcquireStoresThenRecords` (recorded == sum256(body), stored == body), not end-to-end over the recorded row hash. _(Acceptance Auditor AA-2)_ **Applied 2026-07-11** — added `TestAcquireRecordedHashRoundTrip`; `go build`/`vet`/`gofmt`/`test` all green.

Dismissed (1): [Review][Dismiss] Blind Hunter BH-1 — _"the flipped `0005` canary asserts a `0006` constraint."_ False positive: `supabase test db` applies all migrations then runs every `tests/*.sql` file against the fully-migrated schema (no per-revision isolation), so the "partial migration" scenario cannot occur in this toolchain; the in-place flip is exactly what AC4 mandates (a deliberate premature-dedup canary), it is redundantly proven in the `0006` suite, and the suggested restructure would violate AC4 + change `plan(38)`. Verified correct by both context-having layers.

## Dev Notes

### Resolved Decisions (Cuatro, 2026-07-10, during story creation — build for these)

1. **⭐ `demo_sha256` scope = add `UNIQUE(match_id, demo_sha256)` but keep the column NULLABLE this slice; hash only the two worker-driven paths (MatchZy + CLI). Defer `demo_sha256 NOT NULL` and worker-side hashing of the admin manual-upload path to Epic 5.** *(Chosen over "enforce NOT NULL now + re-plumb the manual path through the worker".)*
   *Why:* the epics AC (L487) and AD-3 literally require only `UNIQUE(match_id, sha256)`; `NOT NULL` is the SOLUTION-DESIGN §3 *end-state*, not a 3.2 AC. The blocker for `NOT NULL` is the **admin manual path**: its bytes go browser → R2 directly and the *app* (`lib/ingest.recordManualUpload`) inserts the row — the app **never sees the bytes**, so it cannot compute a hash, and the app holds **no R2 creds** by design (the bypass-Vercel invariant), so it cannot read the object to hash it either. Making `demo_sha256 NOT NULL` now would force re-plumbing the manual path so the **worker** hashes the R2 object (a new app→worker call + the shared-secret trust-boundary work already deferred to Epic 5, `deferred-work.md` W1/W2). That is exactly the Epic-5 admin-upload-UI slice. Keeping the column nullable means: worker paths (MatchZy is the **primary** v1 path per SOLUTION-DESIGN §6) get full hash+dedup now; the rare manual fallback keeps its 3.1 NULL-sha256 app insert unchanged (NULLs are distinct under the UNIQUE, so it neither dedups nor breaks). This also keeps the `0005` test's NULL-shell + minimal-insert assertions valid (only the dedup canary flips), and leaves `lib/ingest.ts` + the register route **untouched** — a tight, in-scope slice. *(Alternative — Option A: enforce `NOT NULL` now + route manual-path hashing through the worker, which would also resolve the 3.1 AD-2 "app writes a demo row" nuance, at the cost of pulling Epic-5 upload plumbing forward and rewriting every `0005`-test insert.)*

2. **⭐ Hashing mechanics = single-pass `io.TeeReader` into a `sha256` hasher while `Put` streams to R2; keep 3.1's opaque random storage key; on `AlreadyIngested`, delete the redundant just-uploaded object.** *(Chosen over content-addressed keys via a spool-then-hash temp file.)*
   *Why:* 3.1 deliberately streams the 50–170 MB body without buffering (Railway Hobby RAM). Teeing the reader into the hasher costs **zero extra memory or disk** and **one pass** — the hash is ready the instant `Put` finishes, and it is provably the hash of exactly the bytes stored (AD-1). Dedup then happens at the DB (`ON CONFLICT (match_id, demo_sha256) DO NOTHING`); a conflict means the just-uploaded object is a byte-identical duplicate, so deleting it (retention guard permits `event_archive`) keeps R2 clean and the *prior* object authoritative (write-once = first copy wins). *(Alternative — Option B: content-addressed key `demos/<match_id>/<sha256>.dem` by spooling the decompressed `.dem` to a temp file, hashing, then `Put`ting to the content key — idempotent by construction, no orphan, but spools 50–170 MB to disk on **every** ingest and abandons 3.1's "keys are opaque, not content-addressed" contract. Not worth the per-ingest disk cost for a rare duplicate.)*

### Architecture patterns & invariants (must follow)

- **`Hashing → Deduped → (AlreadyIngested | new)` span only.** State machine `Acquiring → Hashing → Deduped → (AlreadyIngested | Parsing) → …` [Source: ARCHITECTURE-SPINE.md#Demo-ingest-lifecycle L277–297]. 3.1 did `Acquiring`; 3.2 does `Hashing`+`Deduped`+`AlreadyIngested`. **Stop before `Parsing`** (Story 3.3).
- **AD-1 — immutable, re-hashable source of truth** [Source: ARCHITECTURE-SPINE.md#AD-1 L80–83]. Every `.dem` retained write-once, identified by `(match_id, sha256)`, re-hashable byte-for-byte to its stored value. Hash the **canonical `.dem`** (3.1 already decompresses MatchZy's zip/gzip before storing) — the hash is over the `.dem`, and it is also the fairness seed `SHA-256(final_demo_bytes)` consumed by Epic 6.
- **AD-3 — idempotent ingestion** [Source: ARCHITECTURE-SPINE.md#AD-3 L90–93]. `demo` is `UNIQUE(match_id, sha256)`; a duplicate-bytes upload **short-circuits to the prior result**. (`stat_row UNIQUE(match_id, steamid64)` + re-parse upsert are Story 3.3/3.6, not here.)
- **AD-2 — single-writer** [Source: ARCHITECTURE-SPINE.md#AD-2 L85–88]. The worker (service-role / owner connection) writes the hashed `demo` rows. No anon/authenticated write. The 3.1 AD-2 nuance (the app's manual-path insert) is **unchanged** here and its resolution rides to Epic 5 with Resolved Decision 1.
- **AD-16 — bytes bypass Vercel; write-once retention** [Source: ARCHITECTURE-SPINE.md#AD-16 L155–158]. `retention_class='permanent_seed'` demos have `delete_after=NULL` and storage-layer object-lock — but *selecting* the permanent seed is Epic 6 and object-lock is Epic 7. 3.2 leaves `retention_class` at `event_archive` and only reads/records it (already default since 3.1). The DB write-once teeth (no DELETE grant) already exist in `0005`.
- **AD-26 — off-request, but hashing is cheap + synchronous here** [Source: ARCHITECTURE-SPINE.md#AD-26 L205–208]. The bounded async **parse** queue is Story 3.8; hashing is an O(bytes) streaming pass done inline in the acquire path (no parse compute), so it does not need the queue.
- **Module boundary** [Source: ARCHITECTURE-SPINE.md#Design-Paradigm L73–76]. No code-import edge between `worker/*` and `app/`+`lib/`. 3.2 is worker-only + a schema migration; the TS side is untouched.

### What 3.1 already built (do NOT rebuild — extend)

- `demo` table (migration `0005_demo.sql`): `demo_sha256 text` **nullable**, no UNIQUE; `retention_class` default `event_archive`; ENABLE+FORCE RLS; `grant select,insert,update` to service_role, **NO delete** (write-once ceiling already in place). [Source: supabase/migrations/0005_demo.sql]
- `worker/ingest/ingest.go` `Acquire(ctx, store, rec, meta, r)` — the store→record core with a `countingReader` for streamed size; returns `(key, error)`. **This is where the tee-hash slots in.** [Source: worker/ingest/ingest.go:37–64]
- `worker/db/db.go` `DemoRecorder.RecordDemo(ctx, DemoRow) error` + `PgxRecorder` (plain `insert into demo (match_id, storage_backend, storage_key, size_bytes, source)`) — **change the signature + add ON CONFLICT here.** [Source: worker/db/db.go:26–69]
- `worker/store/store.go` `DemoStore` (`Backend/Put/PresignPut/Get/Delete`) + `NewStorageKey` (opaque random) + `guardDelete`. The AD-1 round-trip (`Put`→`Get`→re-hash) is already tested on `FakeStore`. **`Delete` gains its first real caller (orphan cleanup).** [Source: worker/store/store.go, store/fake.go, store/r2.go]
- MatchZy receiver / presign / CLI (`server.go`, `cli.go`, `main.go`) — the size/bomb caps (`http.MaxBytesReader` + decompressed ceiling) and gzip/zip/raw framing all stay. **Only the success-response shape changes** (add `already_ingested`). [Source: worker/ingest/server.go, cli.go; worker/main.go]

### The migration (implement in `0006`)

```sql
-- supabase/migrations/0006_demo_hash_dedup.sql — Story 3.2 (AD-3 idempotency key)
-- SCOPE: add UNIQUE(match_id, demo_sha256) to `demo` — a duplicate-bytes re-upload dedups.
-- OUT OF SCOPE: `demo_sha256 NOT NULL` (Epic 5, with worker-side hashing of the manual-upload path);
--   demo_match_fk (Epic 4); object-lock / permanent_seed delete-proofing (Epic 7); parser_version NOT NULL (3.3).
alter table public.demo
  add constraint demo_match_sha256_uniq unique (match_id, demo_sha256);
-- demo_sha256 stays NULLABLE this slice: NULLs are distinct in a UNIQUE, so the admin manual-upload
-- path's NULL-sha256 rows (app insert, Story 3.1) are unaffected; the worker paths set a real hash and
-- genuinely dedup. [SOLUTION-DESIGN.md §3 L107 end-state = `unique (match_id, demo_sha256)`; NOT NULL there is the Epic-5 end-state.]
```

**Regression landmine — the `0005` canary:** `supabase/tests/0005_demo_test.sql:78–84` intentionally `lives_ok`s two rows sharing `(9, …, 'dupsha')` with the comment *"This one statement 23505s the day 3.2 adds the constraint — a canary for premature dedup."* Once `0006` lands, that `lives_ok` **fails**. Flip it to `throws_ok(…, '23505', …)`. This is the single most likely miss in this story — the pgTAP suite runs against the *fully-migrated* schema, so a `0005` assertion written for the pre-0006 world breaks. [Source: supabase/tests/0005_demo_test.sql:78–84]

### Env / secrets

No net-new env. Hashing needs only `crypto/sha256` (stdlib). The worker already has R2 + DB config from 3.1. `lib/env.ts` untouched (no worker→TS crossover). [Source: worker/config/config.go; 3.1 File List.]

### Source tree — where things go

```
cs-tournament/
  supabase/migrations/0006_demo_hash_dedup.sql       # NEW — UNIQUE(match_id, demo_sha256)
  supabase/tests/0006_demo_hash_dedup_test.sql        # NEW — pgTAP plan(N)
  supabase/tests/0005_demo_test.sql                   # EDIT — flip the premature-dedup canary
  worker/ingest/ingest.go                             # EDIT — tee-hash in Acquire + AcquireResult + orphan-delete
  worker/db/db.go                                     # EDIT — DemoRow.SHA256 + ON CONFLICT + outcome return
  worker/db/fake.go                                   # EDIT — in-memory dedup mirror
  worker/ingest/server.go                             # EDIT — emit already_ingested
  worker/ingest/cli.go, worker/main.go                # EDIT — surface already_ingested in the CLI log
  worker/store/store_test.go                          # EDIT — round-trip re-hash == recorded sha256
  worker/ingest/{ingest,server,cli}_test.go, worker/db/fake_test.go   # EDIT — new signatures + dedup cases
```
No new Go deps (`crypto/sha256`/`io` are stdlib). No `demoinfocs`. No TS change. [Repo recon confirms the 3.1 worker layout.]

### Testing standards

- **Go:** stdlib `testing` + `go test ./...`; keep `DemoStore`/`DemoRecorder` injectable (fakes) — no real R2/DB in unit tests. Add the dedup + orphan-delete cases. Round-trip proves `Get`→re-hash == the recorded `demo_sha256`.
- **pgTAP:** explicit `plan(N)` (retro action #5); `0006` proves the UNIQUE bites and NULL rows still insert; **update `0005`** (flip the canary). `supabase test db` across all suites.
- **TS:** unchanged — assert `vitest run` stays at 110 and `git diff lib/ app/` is empty (guard against accidental TS edits).
- **Green bar:** `go build`/`go vet`/`gofmt -l` clean; `go test ./...` grows from 28/29; `next build` clean; `supabase test db` Files 6 → 7.

### Regression / boundary notes

- **DemoRecorder signature change ripples** to `PgxRecorder`, `FakeRecorder`, and every test that calls `RecordDemo`/`Acquire`/`RunCLI` and inspects `Recorded()`. Update all call sites so `go build ./...` is clean — this is the widest blast radius in the worker.
- Do **not** touch `lib/ingest.ts`, `app/api/ingest/register/route.ts`, or any Epic-2 TS surface — the manual path stays NULL-sha256 by decision.
- Keep 3.1's streaming discipline: no full-body buffering; the tee adds a `sha256.Hash` (a few KB of state), nothing more. The zip path still spools the *compressed* body to a temp file (3.1) — the decompressed `.dem` still streams through the tee.
- Keep the 3.1 size/bomb caps (`http.MaxBytesReader` + decompressed ceiling) on the MatchZy path.

### Deferred items to (re)log at review

- `demo_sha256 NOT NULL` + worker-side hashing of the admin manual-upload path → **Epic 5** (admin-upload UI). Records against `deferred-work.md` W1/W2 (presign trust-boundary + unverified `storage_key`) — the same slice resolves all three.
- `permanent_seed` selection (Epic 6) + R2 object-lock / `delete_after` GC (Epic 7) — still deferred; 3.2 only records the default `event_archive`.
- Per Resolved Decision 1 (nullable), note the interim at review: manual-path uploads are un-hashed and un-deduped until Epic 5 — acceptable (manual is the rare fallback; MatchZy auto is primary).

### References

- [Source: epics.md#Story-3.2 L472–493] — the three AC threads (hash+retain / UNIQUE / AlreadyIngested) + traces FR-15 · AD-1, AD-3.
- [Source: epics.md#Epic-3 L442–444; #Story-3.3 L495–515 (the next slice's boundary — parse/stat_row is NOT here)] — epic scope + the 3.2/3.3 line.
- [Source: ARCHITECTURE-SPINE.md#AD-1 L80–83; #AD-3 L90–93; #AD-2 L85–88; #AD-16 L155–158; #AD-26 L205–208; #ingest-state-machine L277–297] — invariants + the lifecycle span.
- [Source: SOLUTION-DESIGN.md §3 L93–108 (demo DDL end-state, `unique (match_id, demo_sha256)` + `demo_sha256 not null`); §6 L322–343 (MatchZy = primary path; the pipeline)] — the target schema + why the manual path is the fallback.
- [Source: prd.md FR-15 (raw demo retention + SHA-256 hash = source of truth + fairness seed)] — the product requirement.
- [Source: supabase/migrations/0005_demo.sql; supabase/tests/0005_demo_test.sql:78–84 (the canary)] — what 0006 extends + the test to flip.
- [Source: worker/ingest/ingest.go; worker/db/db.go; worker/db/fake.go; worker/store/store.go + fake.go + r2.go; worker/ingest/server.go + cli.go; worker/main.go] — the exact code 3.2 edits.
- [Source: 3-1-demo-acquisition-that-bypasses-vercel.md (Dev Notes, Completion Notes, Review Findings)] — the acquisition baseline + the dismissed "Delete guard unwired" (#7) and "store-before-record orphan" (#1) findings 3.2 now touches.
- [Source: deferred-work.md — story-3.1 W1/W2 (presign secret boundary; unverified storage_key), 3.1 live-QA infra finding (IPv6/pooler)] — the Epic-5/7 homes for the deferred manual-path + deploy work.
- [Precedents: 0003_audit_snapshot.sql / 0004_roster.sql + their pgTAP (grant/constraint assertion style); the Epic-2 injectable-seam test pattern the Go fakes mirror.]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / bmad-dev-story)

### Debug Log References

- Local Supabase stack: Docker Desktop was down; started it, then `supabase stop && supabase start` (the known 3.1 port-54322 recovery). `supabase db reset` applied `0001→0006` cleanly.
- `supabase test db` → Files=7, Tests=216, **PASS** (was Files=6; `0006` adds `plan(7)`, `0005` canary flipped in place so its `plan(38)` is unchanged).
- `go test ./...` → all 5 packages pass (`worker`, `config`, `db`, `ingest`, `store`); `go vet` + `gofmt -l` clean; `go build ./...` OK.
- `vitest run` → 110 passed (unchanged). `next build` clean. `git diff lib/ app/` empty (no TS change).

### Completion Notes List

- **AC1 (hash + write-once):** `Acquire` tees the streamed body into a `crypto/sha256` hasher in the same single pass that `Put` streams to R2 (`io.TeeReader(counter, hasher)`) — zero extra memory/disk, no re-download. `hex.EncodeToString(hasher.Sum(nil))` is the SHA-256 of exactly the stored bytes. Proven end-to-end by the new `TestPutTeeHashRoundTrip` (Get → re-hash == the recorded sha256), i.e. the AD-1 round-trip now over the *recorded* hash.
- **AC2 (idempotency key):** migration `0006_demo_hash_dedup.sql` adds `constraint demo_match_sha256_uniq unique (match_id, demo_sha256)`; `demo_sha256` stays **nullable** (Resolved Decision 1). pgTAP `0006` proves the constraint shape + that a duplicate `(match_id, sha256)` 23505s, distinct match/sha combos insert, and NULL-sha256 rows are unaffected.
- **AC3 (`AlreadyIngested` short-circuit):** `PgxRecorder.RecordDemo` uses `on conflict (match_id, demo_sha256) do nothing returning storage_key`; zero rows (`pgx.ErrNoRows`) → fetch the prior key → `Inserted=false`. `Acquire` then deletes the redundant just-uploaded object (`DemoStore.Delete` with `event_archive` — its first real caller) and returns the prior key with `AlreadyIngested=true`. MatchZy returns `already_ingested: true` (200, idempotent retry); the CLI logs it.
- **AC4 (migration + pgTAP + flipped canary):** `0005` canary flipped from `lives_ok` → `throws_ok('23505')` in place (assertion count unchanged, `plan(38)` holds); new `0006_demo_hash_dedup_test.sql` `plan(7)`; `supabase test db` Files 6 → 7.
- **AC5 (single-writer + boundary unchanged):** all hashing/dedup is worker-only Go; the worker remains the sole writer of hashed rows. `worker/*` ↔ `app/`+`lib/` boundary intact — `git diff lib/ app/` is empty; `lib/ingest.recordManualUpload` (NULL sha256) untouched; no new env / no `NEXT_PUBLIC_*`.
- **DemoRecorder signature ripple** (the widest blast radius) handled: interface `error` → `(RecordOutcome, error)`; `PgxRecorder`, `FakeRecorder`, and every test caller (`fake_test.go`, `ingest_test.go`, `server_test.go`, `cli_test.go`) updated.
- **Deferred (re-log at review):** `demo_sha256 NOT NULL` + worker-side hashing of the admin manual-upload path → **Epic 5** (with `deferred-work.md` W1/W2); `permanent_seed` selection (Epic 6) + object-lock/`delete_after` GC (Epic 7). Manual-path uploads stay un-hashed/un-deduped until Epic 5 (accepted — manual is the rare fallback; MatchZy is primary).
- **Task 6 (live-QA) is a PENDING human gate** ⛔ — mirrors the 3.1 rhythm; the dev agent cannot run it (needs a real Source-2 `.dem` + real `R2_*` creds). Left unchecked deliberately.

### File List

**New**
- `supabase/migrations/0006_demo_hash_dedup.sql` — `UNIQUE(match_id, demo_sha256)` (AD-3 idempotency key)
- `supabase/tests/0006_demo_hash_dedup_test.sql` — pgTAP `plan(7)`

**Modified**
- `supabase/tests/0005_demo_test.sql` — flipped the premature-dedup canary (`lives_ok` → `throws_ok('23505')`)
- `worker/ingest/ingest.go` — tee-hash in `Acquire` + `AcquireResult` + orphan-delete on `AlreadyIngested`
- `worker/db/db.go` — `DemoRow.SHA256` + `RecordOutcome` + `ON CONFLICT` dedup return
- `worker/db/fake.go` — in-memory dedup mirror (seen `(MatchID,SHA256)` → first key)
- `worker/ingest/server.go` — MatchZy emits `already_ingested`
- `worker/ingest/cli.go` — `RunCLI` returns `AcquireResult`
- `worker/main.go` — CLI logs `already_ingested`
- `worker/store/store_test.go` — round-trip re-hash == recorded sha256
- `worker/ingest/ingest_test.go` — dedup + orphan-delete + no-false-dedup cases; recorded-hash assertion
- `worker/ingest/server_test.go` — `already_ingested` field + re-POST dedup case
- `worker/ingest/cli_test.go` — new return shape + re-run short-circuit case
- `worker/db/fake_test.go` — new signature + dedup / NULL-distinct cases

## Change Log

| Date       | Change                                                                                                  |
|------------|---------------------------------------------------------------------------------------------------------|
| 2026-07-11 | Story 3.2 implemented: migration `0006` adds `UNIQUE(match_id, demo_sha256)`; worker computes SHA-256 while streaming (single-pass tee), dedups at the DB writer (`ON CONFLICT DO NOTHING`), short-circuits an identical re-upload (`AlreadyIngested` + orphan-delete). `0005` canary flipped. Green: Go 5 pkgs, pgTAP Files=7/Tests=216, Vitest 110, next build. Status → review (Task 6 live-QA is a pending human gate). |
| 2026-07-11 | Code review (`bmad-code-review`, 3 adversarial layers): 0 decision-needed, 2 patch (both **applied** — `RetentionEventArchive` named constant at the orphan-delete site + a new end-to-end AC1 recorded-hash round-trip test), 0 defer, 1 dismissed (Blind Hunter BH-1 — false positive re: the flipped `0005` canary). No correctness bugs, no unhandled edge cases; AC1–AC5 + both Resolved Decisions verified met. Green after patches: `go build`/`vet`/`gofmt`/`test`. Status review → in-progress (code review clean; Task 6 live-QA sign-off remains the pending human gate before `done`). |
