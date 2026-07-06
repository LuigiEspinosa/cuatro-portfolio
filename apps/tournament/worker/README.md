# `worker/` — CS2 demo-ingestion worker (Epic 3)

The repo's **first Go module** and first object-storage integration. It runs **off Vercel** (host:
Railway) so the 50–170 MB demo bytes bypass the ~4.5 MB Vercel request cap (SPEC Constraint 6, AD-16).
It has **no code dependency** on `app/` + `lib/` — the only coupling is the `supabase/migrations`
schema contract (the `demo` table) and the shared R2 bucket (ARCHITECTURE-SPINE.md module boundary).

**Story 3.1 scope = acquisition only** (the `Acquiring` node): get the canonical `.dem` durable in R2
and record a `demo` row. **Not** here: hashing/dedup (Story 3.2), parse → `stat_row` (Story 3.3, adds
`demoinfocs-golang`), the async job queue (Story 3.8).

## Layout

```
worker/
  main.go            serve | ingest dispatch
  config/            server-only env load (R2_*, WORKER_MATCHZY_SHARED_SECRET, DB conn) + fail-fast
  store/             DemoStore interface (AD-16) + R2 impl + in-memory fake (go test)
  db/                demo-row writer via pgx (service-role/owner direct connection) + fake recorder
  ingest/            Acquire core, zip/gzip decompress, HTTP server (matchzy + presign), CLI
```

## Build / test

```sh
go build ./...      # compile
go vet ./...        # static checks
go test ./...       # unit tests — in-memory fakes only, NO real R2 / DB
```

Unit tests never touch real R2 or Postgres: `store.FakeStore` and `db.FakeRecorder` are the injectable
seams (the Go analogue of Epic 2's `HttpPost`/`HttpGetJson` seams). Live verification against a real R2
bucket is the human live-QA gate (Story 3.1 Task 9).

## Run

Requires the server-only env vars (see repo `.env.example` lines 15/22 + 44–52 — **no net-new names**):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_S3_ENDPOINT`,
`WORKER_MATCHZY_SHARED_SECRET`, `SUPABASE_URL`, `SUPABASE_DB_PASSWORD`.

```sh
# HTTP server (MatchZy auto-upload receiver + admin presign endpoint). Listens on $PORT (default 8080).
worker serve

# CLI: ingest a local .dem (source=manual_upload).
worker ingest ./cache.dem --match 123
```

The worker's DB connection is **derived** from `SUPABASE_URL` + `SUPABASE_DB_PASSWORD` (no net-new env):
hosted `https://<ref>.supabase.co` → `db.<ref>.supabase.co:5432` (TLS); a `127.0.0.1`/`localhost`
`SUPABASE_URL` maps to the local dev stack's Postgres on `127.0.0.1:54322` (no TLS) for local verify.
It connects as the database owner, which bypasses RLS (the service-role-equivalent write path, AD-2).

## Ingest paths (all three bypass Vercel — AD-16)

1. **MatchZy auto-upload** — `POST /ingest/matchzy`. MatchZy's `matchzy_demo_upload_url` posts the
   finished demo. The worker authenticates the shared secret (constant-time), decompresses to the
   canonical `.dem`, streams it to R2, and records the row (`source='matchzy'`).
2. **Admin manual upload** — `POST /ingest/presign` mints an R2 presigned PUT URL (the worker holds the
   R2 creds; the Next.js app does not). The browser PUTs the bytes to R2 directly, then notifies the
   Next.js app `POST /api/ingest/register { match_id, storage_key }` (tiny JSON, `requireAdmin`-gated),
   which records the row (`source='manual_upload'`).
3. **CLI** — `worker ingest <path.dem> --match <id>` — same store→record core (`source='manual_upload'`).

### MatchZy wire contract (confirmed from the live docs; pin against the deployed build)

Source: <https://shobhit-pathak.github.io/MatchZy/gotv/> (fetched 2026-07-06).

- cvar `matchzy_demo_upload_url` → the worker's `/ingest/matchzy`. HTTP **POST**; body = the demo file
  (the docs say **zipped**); metadata via headers `MatchZy-FileName`, `MatchZy-MapNumber`,
  `MatchZy-MatchId`.
- The docs snapshot shows **no built-in auth-header cvar**, so the shared secret is carried by whatever
  the deployed MatchZy build supports. The receiver accepts **either** an `Authorization` header (raw
  or `Bearer <secret>`) **or** a `?token=<secret>` query param — pin the one your build sends at deploy
  (e.g. `matchzy_demo_upload_url = https://<worker>/ingest/matchzy?token=<secret>`).
- The receiver **auto-detects** the framing (gzip / zip / raw `PBDEMS2`) and stores the canonical
  `.dem` (AD-1: the retained object is the re-hashable source of truth and the fairness-seed input).
  Confirm the exact compression against the deployed MatchZy version.

## Deferred operational gate (Deploy-posture decision → Epic 7)

Built + unit-tested here; **not** yet run live: the Railway worker deploy and a rented MatchZy CS2
server proving the true auto-upload end-to-end. Story 3.1 verifies CLI + admin-presigned +
shared-secret-HTTP **locally** against a real R2 bucket (Task 9). Also deferred: R2 object-lock
hardening on `permanent_seed` (the Go-side `Delete()` retention guard is here; storage-layer object-lock
is Epic 7).
