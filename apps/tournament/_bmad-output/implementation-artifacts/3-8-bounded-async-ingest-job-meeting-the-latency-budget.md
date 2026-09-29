---
baseline_commit: 479bde7e40200fb5edf75a931088672f01b2c8eb
---

# Story 3.8: Bounded async ingest job meeting the latency budget

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want the MatchZy demo upload to **kick off parsing as a bounded, retriable async job that runs OFF the HTTP request** — the receiver stores the bytes and returns `200` immediately, a background worker pool (bounded concurrency, pinned parser) then parses → validates → upserts the `stat_row`s, retrying a `ParseFailed` with capped attempts + backoff and raising a **never-silent** admin alert on exhaustion,
so that **large demos parse within the SM-5 budget (P50 < 5 min, P95 < 15 min, demo-landed → stats-visible), a slow parse never blocks (or times out) the upload request, and a genuinely broken parse surfaces to me instead of silently stalling.**

**This is the eighth and final ingest-side story of Epic 3 — it closes the loop the receiver has left open since Story 3.1.** Today [`handleMatchZy`](../../worker/ingest/server.go#L67-L104) does the *Acquiring* node only: it decompresses → `Acquire` (store to R2 + record the `demo` row) → returns `200` — and then **stops**. The `demo` row exists but **no `stat_row` is ever produced** from the HTTP path; the parse core (`Get` → `Parse` → map → validate → `RecordParse`) lives only in the **CLI** path ([`RunCLI` tail, cli.go:68-130](../../worker/ingest/cli.go#L68-L130)), which an operator runs by hand. Both the receiver and the parse core already carry the hand-off in their own comments: `handleMatchZy`/`ingest.go` say "NO job queue (Story 3.8)", `RunCLI` says "the MatchZy-HTTP-triggered parse + the bounded async queue are Story 3.8 (not wired here)", and `parse.go`'s panic-recover says "the SAME Parser is wired to the MatchZy HTTP receiver in Story 3.8, where the .dem bytes are externally produced." **3.8 wires that parse core to the receiver as a bounded async job** and adds the retry/backoff + admin-alert-on-exhaustion around it.

The scope again mirrors 3.6: **a WORKER-ONLY slice — Go code + Go tests, NO migration and NO app/TS change** (`git diff --stat -- supabase/ app/ lib/` must be **empty**). There is deliberately **no jobs/queue table**: the queue is an **in-process, ephemeral** channel + bounded worker pool (`0005_demo.sql:21` calls it an "async parse-job enqueue (Story 3.8)"; `0007_stat_row.sql:21` calls the enqueued row "a **transiently**-queued MatchZy row once Story 3.8" — *transiently* is the tell). The demo bytes are already durable in R2 after `Acquire`, so a job lost to a worker restart is **recoverable by re-driving** (`worker ingest`/`reparse`, or the durable recovery sweep that is **Story 7.4**) — the raw demo is the source of truth, all derived state is re-derivable (AD-1, SOLUTION-DESIGN §11 DR). `golang.org/x/sync` (semaphore/errgroup) is already a dependency — no net-new module.

It stops before the **operational hardening** half of AD-26, which is **Story 7.4 (Epic 7, "Ingest recovery hardening")**: wiring the alert to the **real `admin:<id>` realtime channel** (the AD-11 Broadcast topology does not exist until Epic 5), **event-time tuning** of the concurrency/attempts/backoff knobs, the **durable recovery** of acquired-but-unparsed demos across a worker restart/crash, and the **rehearsed recovery path** (Story 7.3). 3.8 builds the **mechanism**; 7.4 hardens and operationalizes it. See **Dev Notes → The 3.8 ↔ 7.4 boundary**.

## Acceptance Criteria

> Restated from `epics.md#Story 3.8` (lines 606–626), elaborated with the design decisions resolved during story creation (see **Dev Notes → Key design decisions**). Traces: **FR-11 · AD-26 · NFR-Perf, NFR-Reliability**.

**AC1 — A MatchZy upload triggers parsing as an async job that runs OFF the request, with bounded concurrency and the pinned parser (AD-26, FR-11).**
`handleMatchZy` keeps its store-and-record behavior, then **enqueues a parse job** carrying the fresh acquire's `{matchID, storageKey, demoID}` and returns `200` **immediately** (never blocking the response on the ~3.4 s parse — the request path stays fast so MatchZy's upload does not time out). A **fresh** acquire enqueues; an `AlreadyIngested` re-upload does **not** (its rows already exist — AD-3, exactly as `RunCLI` skips the parse on `AlreadyIngested`). The job is drained by an **in-process worker pool** with **bounded concurrency** (a semaphore / fixed worker count — default small, since a CS2 parse is CPU/RAM-heavy and matches arrive roughly one at a time) using the **pinned** `demoinfocs-golang v5.2.0` (`ParserVersion` constant, unchanged). The parse job runs the **same core as the CLI** — `Get` the retained object → `Parse` → 17-digit-guard map → `Validate` against the active roster → `RecordParse` (status-preserving upsert) — reused, not reimplemented (recommended: extract `RunCLI`'s parse tail into a shared `parseAndRecord` both call).

**AC2 — A `ParseFailed` retries with capped attempts + backoff against the pinned version; on exhaustion it raises a never-silent admin alert (AD-26, NFR-Reliability).**
When the parse core returns an error (`ParseFailed` — a corrupt/format-churned demo; the `parse.go` panic-recover already turns a parser panic into an error, so the job never crashes the process), the job **retries with a capped number of attempts and backoff** (e.g. exponential from a base delay) against the **same pinned** parser version (a version *upgrade* to recover from Valve format churn is a deliberate operator action, **not** an automatic bump). On **exhaustion** of the attempt cap, the job raises an **admin alert** through an injectable **`Alerter` seam** (logging default now; the real `admin:<id>` Broadcast is Story 7.4 / Epic 5) **and** logs a structured line — **never failing silently** (SOLUTION-DESIGN §11 Observability: "`ParseFailed` + parse anomalies → `admin:<id>` alert + log; never silent"). A **retriable** attempt and a **terminal** (post-cap) failure are distinguishable in the logs. A validation **anomaly** (Story 3.4) is **not** a `ParseFailed` — the rows are still upserted and the match is *held*, not retried (an anomaly is a successful parse with a failed gate).

**AC3 — The design meets the SM-5 latency budget: demo-landed → stats-visible P50 < 5 min, P95 < 15 min (SM-5, NFR-Perf).**
Because the parse runs **off-request** (the upload returns as soon as bytes are durable in R2) and the parse itself is **~3.4 s** (PoC-measured), the end-to-end `demo-landed → stat_row-visible` latency is dominated by **upload + queue depth**, both of which the bounded pool keeps well inside the budget for a v1 single-tournament load (matches complete minutes apart, not concurrently). The job **records the landing → visible elapsed** (a log line / timing field) so the budget is *observable*. The story satisfies AC3 **by construction + instrumentation**; the actual **P50/P95 percentile validation under real MatchZy load** is an **Epic 7 / Story 7.4 ops concern** (there is no metrics backend or live Railway deploy in Epic 3 — deploy posture stays "local verify", see Story 3.6 Task 6).

**AC4 — Worker-only slice; the ops-hardening half of AD-26 is explicitly out of scope (boundary discipline).**
`git diff --stat -- supabase/ app/ lib/` is **empty** (no migration — the queue is in-process/transient, no jobs table; no app/TS change). `vitest run` and `next build` are unchanged. The whole deliverable is `worker/` Go code + Go tests. Explicitly **NOT** built here (→ **Story 7.4 / Epic 7**): the real `admin:<id>` realtime-channel alert wiring (needs the AD-11 Broadcast topology from **Epic 5**); event-time **tuning** of the concurrency/attempts/backoff values; **durable recovery** of an acquired-but-unparsed demo after a worker restart/crash (the queue is intentionally ephemeral in 3.8); the rehearsed DR recovery path (**Story 7.3**). Also out of scope: any `Aprobar`/publish, bracket/feed/leaderboard side-effect (**Epic 4**), and the demo-derived **score** (**deferred Story 3.7 → Epic 4**).

## Out of scope (do NOT build here)

- **A jobs/queue DB table, a persisted `ParseFailed`/attempt-count column, or any migration.** The queue is **in-process + ephemeral** by design (0005/0007 call it "transiently-queued"); recovery of a lost/orphaned job is **Story 7.4** (durable sweep of acquired-but-unparsed demos) — not a 3.8 schema. `git diff --stat -- supabase/` must be **empty**.
- **The real `admin:<id>` realtime-channel alert** — the AD-11 Broadcast topology (`admin:<id>` private channel) is **Epic 5**; wiring the alert to it + the operator-facing surface is **Story 7.4**. 3.8 raises the alert through a **logging `Alerter` seam** designed to be the injection point 7.4 swaps the real channel into.
- **Durable recovery / restart survival of the queue** (re-driving acquired-but-unparsed demos after a crash, an orphan sweep, a dead-letter store) — **Story 7.4** (ops slice). 3.8's guarantee is bounded + retriable *within a process lifetime*; the raw demo in R2 is the durability backstop.
- **Event-time tuning** of `maxConcurrentParses` / attempt cap / backoff base — **Story 7.4** ("when the worker is configured for the event"). 3.8 ships sensible **defaults** (recommended: as package constants; env-overridability, if any, is deferred to 7.4).
- **Wiring the Next.js `/api/ingest/register` manual path to auto-CALL the parse trigger** — that path is a different process (Vercel) and wiring it would touch `app/`+`lib/` (breaking the worker-only-slice discipline). 3.8 **does** add the worker-side **`POST /ingest/parse {match_id}`** shared-secret endpoint as the trigger seam (Resolved Decision 3, confirmed), but making the register route *call* it is **deferred**. The manual path already records the `demo` row; its parse is driven by the operator (`worker ingest` or a direct `POST /ingest/parse`) until the register route is wired in a later story.
- **The `Aprobar` publish / `Approved` state**, the bracket-advance/feed/leaderboard republish, rollback — **Epic 4** (no `match`/bracket table). 3.8 stops at `status='pending'` stat rows (Story 3.5), exactly as `RunCLI` does.
- **The demo-derived score** (FR-16 ingest side) — **deferred Story 3.7 → Epic 4 (Story 4.6)**; no `match.score*` column exists. 3.8 writes no score.
- **Bumping `demoinfocs-golang`** — stays pinned `v5.2.0` (a version upgrade is a deliberate operator recovery action, never automatic in the retry loop).

## Tasks / Subtasks

- [x] **Task 1 — Extract the shared parse core `parseAndRecord` (AC1)**
  - [x] Factor `RunCLI`'s fresh-acquire parse tail ([cli.go:68-130](../../worker/ingest/cli.go#L68-L130): `Get` retained object → `parser.Parse` → 17-digit-guard map to `[]db.StatRow` stamping `acq.DemoID` → `roster.ActiveSteamIDs` + `Validate` (fail-closed on roster-read error) → `RecordParse(demoID, ParserVersion, rows, val)`) into a reusable function, e.g. `parseAndRecord(ctx, s store.DemoStore, parser Parser, statRec db.StatRecorder, roster db.RosterReader, matchID, demoID int64, storageKey string) (parseOutcome, error)` returning players/rounds/anomaly. `RunCLI` then calls it (behavior + `CLIResult` unchanged — its existing tests stay green). The async job calls the **same** function with the AcquireResult's `{DemoID, StorageKey}` from the HTTP path. **No parse logic is duplicated.**
  - [x] Keep the fail-closed semantics verbatim: a roster-read error returns an error (do NOT record a parse you could not validate); an anomaly is NOT an error (rows upserted, `demo.validation_state='anomalous'`, warn logged).

- [x] **Task 2 — The bounded in-process job runner + `Alerter` seam (AC1, AC2)**
  - [x] Add a `Job` value (`{MatchID, DemoID int64; StorageKey string}`) and a bounded worker-pool runner in `worker/ingest` (recommended new file `worker/ingest/jobs.go`): a buffered channel + N worker goroutines (or a `golang.org/x/sync/semaphore`) with `maxConcurrentParses` (default small — recommend **2**; a CS2 parse is CPU/RAM-heavy). Expose `Enqueue(Job)` (non-blocking submit) and a lifecycle (`Start(ctx)` / graceful `Close`/drain on shutdown). Each worker calls `parseAndRecord` (Task 1) with retry (Task 3).
  - [x] Add an injectable **`Alerter` interface** (`AlertParseFailed(matchID int64, attempts int, err error)` — the exact shape is the dev's call) with a **logging default** (`LogAlerter`). This is the seam Story 7.4 wires the real `admin:<id>` Broadcast into. The runner holds an `Alerter`; the default never silent (structured log line naming match + attempts + terminal error).
  - [x] Record **landing → visible elapsed** per job (a timer around enqueue→`RecordParse`-committed; log it). This is the AC3 observability proxy.

- [x] **Task 3 — Capped-retry with backoff on `ParseFailed` (AC2)**
  - [x] In the worker loop, on a `parseAndRecord` error: retry up to `maxParseAttempts` (recommend **3**) with **backoff** (recommend exponential from a base, e.g. `base * 2^(attempt-1)`, base ~ a few seconds — small enough to stay inside SM-5). Retry against the **same pinned** `ParserVersion` (no bump). Distinguish a **retriable attempt** (log `attempt k/N, retrying in Δ`) from **terminal exhaustion** (log + `Alerter.AlertParseFailed`).
  - [x] Do **not** retry a validation **anomaly** — `parseAndRecord` returns success (nil error) with `anomalous=true` for a failed gate; the rows are already upserted and the match held. Only a real parse/read/record **error** enters the retry loop. (A roster-read error IS an error → it will retry and can exhaust → alert; that is acceptable fail-closed behavior — the parse is not recorded until the roster read succeeds.)
  - [x] Respect `ctx` cancellation between backoff sleeps (a shutdown must not hang on a long backoff).

- [x] **Task 4 — Wire the runner into `serve`; enqueue from `handleMatchZy` (AC1, AC4)**
  - [x] Extend `Server` ([server.go:22-26](../../worker/ingest/server.go#L22-L26)) with the parse dependencies it lacks today — `Parser`, `db.StatRecorder`, `db.RosterReader` — and a reference to the job runner (or an `Enqueue` func). Construct them in `runServe` ([main.go:74-88](../../worker/main.go#L74-L88)) from the shared pool exactly as `runIngest` does (`DemoinfocsParser{}`, `db.NewPgxStatRecorder(rec.Pool())`, `db.NewPgxRosterReader(rec.Pool())`), start the runner, and defer its drain/close. **Design choice:** the parse deps live on the `Runner` (which encapsulates them), and `Server` holds the `Enqueuer` interface + a `db.DemoReader` — cleaner than duplicating `Parser`/`StatRecorder`/`RosterReader` on both `Server` and `Runner`; `runServe` builds the deps and hands them to `NewRunner`.
  - [x] In `handleMatchZy`, **after** a successful `Acquire`: if `res.AlreadyIngested` is **false**, `Enqueue(Job{matchID, res.DemoID, res.StorageKey})` **then** write the `200` (the response is not blocked on the parse). If `AlreadyIngested` is **true**, do NOT enqueue (unchanged behavior — the JSON body already reports `already_ingested:true`). Keep the response body shape backward-compatible (existing `server_test.go` asserts `ok`/`storage_key`/`already_ingested`).
  - [x] (Resolved Decision 3 — **confirmed in scope**) Add a `POST /ingest/parse` route (shared-secret gated via the same `authOK`, body `{match_id}`) that looks up the demo of record (reuse `db.PgxDemoReader.DemoForMatch` → `{DemoID, StorageKey}`) and enqueues a job — the manual/re-parse trigger seam. Returns `202 Accepted` (job enqueued) or `404` when no retained demo exists for the match. **Wiring the Next.js register route to call it stays out of scope** (deferred — keeps `git diff app/ lib/` empty); this endpoint just gives the manual path (and future re-parse-via-HTTP) a worker-side home. Reuse `db.NewPgxDemoReader(rec.Pool())` in `runServe` (as `runReparse` already does at [main.go:139](../../worker/main.go#L139)); add a test asserting enqueue-on-known-match and `404`-on-unknown.

- [x] **Task 5 — Go tests: async enqueue, retry/backoff, alert-on-exhaustion, no-enqueue-on-dedup (AC1–AC3)**
  - [x] `handleMatchZy` enqueues on a fresh acquire and **returns 200 without waiting for the parse** — a `blockingParser` (still held when the 200 arrives) proves the response is off-request; then the released job's `RecordParse` is asserted with the right `demoID`/rows/pinned version (`TestMatchZyParsesOffRequest`). A `recordingEnqueuer` covers the pure enqueue-shape assertion (`TestMatchZyHappyPathBearer`). `newTestServer()` extended to wire an `Enqueuer`.
  - [x] **No enqueue on `AlreadyIngested`** — a re-POST of an identical demo enqueues **no** job (exactly one job across two POSTs — `TestMatchZyReUploadIsAlreadyIngested`).
  - [x] **Retry + backoff + alert** (runner-level unit test, no HTTP): `flakyParser` + `FakeAlerter` + an injected fast `sleep` recorder — exhaustion drives exactly `maxParseAttempts` calls, records the `base, 2×base` backoffs, and exactly ONE terminal alert (`TestRunnerRetriesToExhaustionThenAlerts`); fail-once-then-succeed → `RecordParse` + no alert (`TestRunnerRetryThenSucceedNoAlert`); an anomaly (clean parse, failed gate) → one upsert, no retry, no alert (`TestRunnerAnomalyIsNotRetried`); ctx-cancel-during-backoff aborts without alert (`TestRunnerCtxCancelDuringBackoffAborts`); bounded concurrency proven at exactly 2 (`TestRunnerBoundedConcurrency`).
  - [x] `parseAndRecord` parity: `TestParseAndRecordParity` + `TestParseAndRecordRosterErrorFailsClosed` (direct units over the shared core), and RunCLI's existing `cli_test.go` cases stay green (behavior-preserving refactor).
  - [x] `go test ./...` + `go vet ./...` in `worker/` green (incl. `go test -race ./ingest/`); `demoinfocs-golang` stays pinned `v5.2.0` (no `go.mod` bump — empty `git diff worker/go.mod`).

- [x] **Task 6 — Green bar + boundary discipline (AC1–AC4)**
  - [x] `go build ./...` + `go test ./...` in `worker/` pass. `git diff --stat -- supabase/ app/ lib/` **empty** (worker-only slice; no migration). `vitest run` unchanged (110 passed). `next build` / `supabase test db` (Files=10) are structurally unaffected — the `app/`/`lib/`/`supabase/` diff is empty (Go-only slice; the 3.6 mirror precedent), and `supabase test db` runs at Task-7 live-QA.
  - [x] Confirm: no jobs/queue table, no new migration; no `admin:<id>` realtime wiring (log `Alerter` only); no app/TS change; the parse job writes only `status='pending'` stat rows via `RecordParse` (which omits `status`; no `Aprobar`/score/bracket); `demoinfocs` still `v5.2.0`; the `serve` graceful-shutdown drains in-flight jobs (`Runner.Close` closes `quit` → workers drain the buffered channel then exit; `runServe` defers `runner.Close`).

- [x] **Task 7 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy still Epic 7)** — *EXECUTED 2026-07-12 against local Supabase (`127.0.0.1:54322`) + real R2 (`inclusivcup-demos`). All scenarios below PASSED; evidence in **Dev Agent Record → Live-QA Results**. Status flip to `done` awaits Cuatro's sign-off.*
  - [x] **Prereq / fixture:** ran `worker serve` locally against local Supabase (`127.0.0.1:54322`) + real R2. Ran core scenarios against the empty roster (the story-blessed `unreconciled` hold, orthogonal to the async mechanics); additionally seeded a season/tournament/roster fixture with the two real duelist ids to prove the clean path on re-parse.
  - [x] **Async happy path:** `POST /ingest/matchzy` (real gzip demo). Request returned **200 while 0 `stat_row`s existed** (parse ran OFF-request); the 2 rows landed ~1.5 s later; `demo.validation_state` stamped; `parser_version = demoinfocs-golang/v5 v5.2.0` (pinned). Landing→visible log line confirmed: `[parse-job] match 9001 parsed ... in 2.17s (landing->visible; attempt 1/3)`.
  - [x] **Idempotent re-POST:** identical re-POST → `already_ingested:true`, same `storage_key`; `demo` rows stayed 1, `stat_row` stayed 2, exactly **one** R2 object (redundant re-upload cleaned up), and **only one** `[parse-job]` line — the re-POST enqueued nothing (AD-3).
  - [x] **`POST /ingest/parse` (Story-3.8 endpoint):** `{match_id:9001}` → **202** and a real re-parse that flipped `validation_state` **anomalous → pending** (reconciled against the seeded roster); `{match_id:999999}` → **404** (the `db.ErrNoDemo` path from the review patch). *(Not in the original Task-7 list; added to exercise the new endpoint live.)*
  - [x] **ParseFailed retry + alert:** corrupt demo (`PBDEMS2` + garbage) → fresh `200`, then bounded retry: `attempt 1/3 (retry 3s) → attempt 2/3 (retry 6s) → ParseFailed TERMINALLY after 3/3` + **exactly one** `ALERT: match 9002 parse FAILED after 3 attempts — never silent`; **0 `stat_row`** written. Backoff timing exactly `3s, 6s` (base·2^(n-1)). Bounded, no infinite loop.
  - [x] **Bounded concurrency:** three near-simultaneous fresh POSTs (9003/9004/9005) all returned `200` and all landed 2 rows; the pool drained the burst with queue-wait visible in the elapsed (1.5 s vs 4–5 s). Exact ≤2 bound is unit-proven (`TestRunnerBoundedConcurrency`).
  - [x] **QA cleanup:** deleted all seeded `demo`/`stat_row` + fixture rows (DB back to baseline, all counts 0) and all 5 R2 test objects (`demos/900*` → `None`).
  - [ ] **Deferred to Epic 7 (unchanged):** live Railway deploy + rented MatchZy; the hosted-DB IPv4/pooler gap (3.1 finding); the P50/P95 percentile validation under real load; the real `admin:<id>` alert wiring + durable recovery (**Story 7.4**). Local-verify is exactly what Task 7 specifies.

## Dev Notes

### Key design decisions (resolved during story creation, 2026-07-12 — Cuatro to confirm at review; build for these)

1. **⭐ Story 3.8 is a WORKER-ONLY slice with an IN-PROCESS, EPHEMERAL queue — Go code + Go tests, NO migration and NO app/TS change** (the same shape as 3.6). There is **no jobs/queue table**: the demo bytes are durable in R2 the instant `Acquire` returns, so the queue only needs to hold `{matchID, demoID, storageKey}` in memory long enough to parse. The migrations themselves reserve this exact framing — `0005_demo.sql:21` "async parse-**job enqueue** (Story 3.8)", `0007_stat_row.sql:21` "a **transiently-queued** MatchZy row once Story 3.8". *(Chosen over a DB-backed jobs table + a poller — that is heavier than a v1 single-tournament needs, would require a migration, and duplicates the durability R2 already provides. Recovery of a job lost to a restart is **Story 7.4**'s durable sweep, backed by the retained demo.)*
   *Why:* AD-26 says "async job **off the upload trigger**"; the trigger (`handleMatchZy`) lands **in the worker process**, so an in-process channel + bounded worker pool is the most direct realization. `golang.org/x/sync` (semaphore/errgroup) is already a dependency. The DR story (SOLUTION-DESIGN §11) is explicit that "all derived DB state is re-derivable by re-parse" — so an ephemeral queue is safe: the worst case (worker dies mid-queue) leaves an acquired-but-unparsed demo that 7.4 re-drives.

2. **⭐ The "admin alert" is an injectable `Alerter` seam with a logging default — the real `admin:<id>` Broadcast is Story 7.4 / Epic 5.** The AD-11 realtime channel topology (`admin:<id>` private channel) does **not exist** until Epic 5 (Leaderboards & realtime). So 3.8 raises the never-silent alert through an `Alerter` interface whose default logs a structured line; 7.4 (which explicitly owns "an alert is raised to the `admin:<id>` channel and logged") swaps in the real Broadcast. *(Chosen over inventing a realtime channel here — that is Epic 5 substrate and would be guaranteed rework; and over "just log it" with no seam — a bare log gives 7.4 no clean injection point.)* This is the direct analogue of 3.4 (anomaly = SET + log the hold flag; the admin accept-anomaly UI is Epic 4) and 3.5 (stage to Pending; the viewer/admin realtime surfaces are Epic 5).
   *Why:* SOLUTION-DESIGN §11 pairs "`ParseFailed` + parse anomalies → `admin:<id>` alert + **log**; never silent" — the *log* half is buildable now, the *`admin:<id>`* half is not. The seam makes 3.8's mechanism complete and 7.4's wiring a drop-in.

3. **⭐ 3.8 wires the MatchZy AUTO path (the primary v1 trigger, which lands in the worker); the manual `/api/ingest/register` path's auto-parse-trigger is DEFERRED to keep the slice worker-only.** The MatchZy handler is in-process, so it enqueues directly. The manual path lands in the **Next.js** process (`app/api/ingest/register/route.ts` records the `demo` row only — no parse) and is a **different process** from the Go worker; auto-triggering its parse would require either the route to call a worker endpoint (touches `app/`+`lib/`) or a DB poller (a jobs table). **Confirmed by Cuatro (2026-07-12):** 3.8 **adds** a worker-side `POST /ingest/parse {match_id}` shared-secret endpoint (reusing `PgxDemoReader.DemoForMatch` to resolve the storage key) as the **trigger seam** for the manual path and future re-parse-via-HTTP — but **wiring the register route to call it stays out of scope** (the register route stays as-is; the manual demo is parsed by the operator via `worker ingest` or a direct `POST /ingest/parse` until wired). *(Chosen over wiring the route now — that breaks the `git diff app/ lib/` empty discipline 3.6 established and pulls Vercel-side work into an ingest-worker story.)*

4. **⭐ AC3 (SM-5 latency) is met BY CONSTRUCTION + instrumentation, not by a load test.** Parse is ~3.4 s (PoC), it runs off-request, and v1 is a single tournament (matches minutes apart). So `landing → visible` is dominated by upload + queue depth, both trivially inside P50<5min / P95<15min for this load. 3.8 makes it **observable** (log the elapsed); the **percentile validation under real MatchZy load** needs a live Railway deploy + metrics that only exist in **Epic 7** (deploy posture stays "local verify"). *(Chosen over building a metrics backend / load harness in Epic 3 — premature; the budget owner is 7.4 ops.)*

**⚠️ Headline risk — the retry loop must be BOUNDED and must not conflate anomaly with failure.** The two ways this story goes wrong: (a) an **unbounded** `ParseFailed → Parsing` retry loop (AD-26 names this exact anti-pattern: "**Prevents:** an unbounded `ParseFailed → Parsing` retry loop") — the attempt cap + `ctx`-aware backoff are non-negotiable; and (b) treating a **validation anomaly as a `ParseFailed`** and retrying it — an anomaly is a *successful parse with a failed gate* (rows ARE upserted, `demo.validation_state='anomalous'`, match held), so `parseAndRecord` must return it as **success with `anomalous=true`**, NOT an error, and the retry loop must only fire on a genuine parse/read/record error. Retrying an anomaly would re-upsert identical rows forever and never alert correctly.

### The 3.8 ↔ 7.4 boundary (both trace AD-26 — read this)

AD-26 is dual-owned, exactly like FR-13/14 were split across epics. **3.8 (Epic 3, ingest) = the mechanism; 7.4 (Epic 7, ops hardening) = operationalize + harden it.** Concretely:

| Concern | Story 3.8 (build now) | Story 7.4 (Epic 7) |
| --- | --- | --- |
| Bounded async job off the trigger | ✅ in-process pool, MatchZy enqueue | tune worker count for the event |
| Pinned parser `v5.2.0` | ✅ `ParserVersion` const, no bump in retry | verify pinning at event config |
| Capped `ParseFailed` retry + backoff | ✅ the loop + defaults | tune attempts/backoff for the event |
| Never-silent alert | ✅ `Alerter` seam + logging default | wire the real **`admin:<id>`** Broadcast (needs Epic 5) + operator surface |
| SM-5 P50/P95 | ✅ off-request + elapsed instrumentation | validate percentiles under real load |
| Recovery of acquired-but-unparsed demos | ❌ (ephemeral queue; R2 is the backstop) | ✅ durable recovery sweep + rehearsed DR (7.3) |

3.8's `Alerter` seam and defaults are **designed to be the injection/tuning points** 7.4 uses — no rework, a clean hand-off. [Source: [epics.md#Story-7.4 L1271-1287](../../_bmad-output/planning-artifacts/epics.md#L1271-L1287); [#AD-26 L104](../../_bmad-output/planning-artifacts/epics.md#L104).]

### Architecture patterns & invariants (must follow)

- **AD-26 — ingestion is an idempotent, bounded, async job meeting SM-5** [Source: [ARCHITECTURE-SPINE.md#AD-26 L205-208](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L205-L208)]. "ingestion runs as an async job **off the upload trigger** (never inline in a Vercel request), with a **pinned** parser version, **bounded** retriable `ParseFailed` (capped attempts + backoff), and bounded concurrency. The SM-5 budget (P50 < 5 min, P95 < 15 min, demo-landed → stats-visible) is the end-to-end target; parse compute is ~seconds (PoC 3.4 s), so upload + queue depth dominate." **Prevents:** parse work blocking a request path; an unbounded `ParseFailed → Parsing` retry loop; the latency budget being unowned. This AC is the literal spec of AC1/AC2/AC3.
- **Job model (AD-26)** [Source: [SOLUTION-DESIGN.md §6 L333-336](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md)]. "Async job off the trigger (never inline in a request). Bounded concurrency; `ParseFailed` retried with capped attempts + backoff against the **pinned** parser version. SM-5 budget … parse is ~3.4s, so upload + queue depth dominate." The MatchZy-auto trigger flow: "Worker streams the body straight to R2, **then enqueues a parse job**" ([§6 L325-326](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md)).
- **Ingest state machine — the `ParseFailed` self-loop** [Source: [ARCHITECTURE-SPINE.md#ingest-lifecycle L284-289](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L284-L289)]. `Deduped → Parsing: new demo`; `Parsing → ParseFailed: parser error / format churn`; `ParseFailed → Parsing: re-parse (pinned version)`; `Parsing → Validating → (Anomalous | Pending)`. 3.8 realizes the `Parsing`/`ParseFailed`/retry edges as the async job; the `Validating→Anomalous|Pending` half is Story 3.4/3.5 (reused unchanged via `parseAndRecord`).
- **AD-1 / DR — the demo is the durable source of truth; derived state is re-derivable** [Source: [SOLUTION-DESIGN.md §11 L479-482](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md)]. "R2 raw demos are the durable source of truth … all derived DB state is re-derivable by re-parse." This is **why** an ephemeral in-process queue is safe (a lost job → an acquired-but-unparsed demo → 7.4 re-drives).
- **AD-2 — single-writer derivation** [Source: [ARCHITECTURE-SPINE.md#AD-2 L85-88](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L85-L88)]. The async job still writes `demo` + `stat_row` only via the worker's service-role pool. No app/anon/authenticated write path. `git diff app/ lib/` empty.
- **AD-3 — idempotent ingestion** [Source: [ARCHITECTURE-SPINE.md#AD-3 L90-93](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L90-L93)]. An `AlreadyIngested` re-POST enqueues no job (rows already exist); a retried parse re-upserts by `UNIQUE(match_id, steamid64)` (never duplicates) — so even a job that runs twice is safe.
- **Observability — never silent** [Source: [SOLUTION-DESIGN.md §11 L478](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md); [ARCHITECTURE-SPINE.md#AD-26]]. "`ParseFailed` + parse anomalies → `admin:<id>` alert + log; never silent." 3.8 delivers the **log** half + the `Alerter` seam; 7.4 wires `admin:<id>`.

### What 3.1–3.6 already built (do NOT rebuild — reuse/extend)

- **`handleMatchZy` — the receiver that stops at Acquire** [Source: [server.go:67-104](../../worker/ingest/server.go#L67-L104)]. Auth → decompress (capped) → `Acquire` → `200`. 3.8 inserts the **enqueue** between `Acquire` success and the `200` (fresh acquire only). The `res AcquireResult` already carries `{StorageKey, DemoID, AlreadyIngested}` — the job needs nothing more; **no DB lookup** required for the MatchZy path.
- **The parse core in `RunCLI`** [Source: [cli.go:68-130](../../worker/ingest/cli.go#L68-L130)]. `Get` retained object → `Parse` → 17-digit-guard map → `Validate` (fail-closed roster read) → `RecordParse` (status-preserving upsert, omits `status`). Extract this into `parseAndRecord` (Task 1) and call it from BOTH `RunCLI` and the async worker — do not reimplement. `RecordParse` [db.go RecordParse] preserves `status` and stamps `parser_version`/validation on the demo in one tx (Story 3.3/3.4/3.5).
- **`DemoinfocsParser` + `ParserVersion` + panic-recover** [Source: [parse.go:13-16,55-65](../../worker/ingest/parse.go#L13-L16)]. The pinned `v5.2.0`; a parser **panic is already recovered into an error** — so the async job's retry loop sees a normal error (the recover comment even says "the SAME Parser is wired to the MatchZy HTTP receiver in Story 3.8"). Reuse verbatim; do not bump the pin.
- **`Validate` + the anomaly outcome** [Source: [validate.go](../../worker/ingest/validate.go); cli.go:107-119]. Reused inside `parseAndRecord`. An anomaly is `val.Anomalous=true` (rows still upserted) — **not** a `ParseFailed`.
- **The injectable-seam pattern** — `DemoStore`/`DemoRecorder`/`StatRecorder`/`RosterReader`/`DemoReader` interfaces + `Fake*` [Source: [fake.go](../../worker/db/fake.go); [store/fake.go](../../worker/store/fake.go); [parse.go:114 FakeParser](../../worker/ingest/parse.go#L114)]. The new `Alerter` follows the same shape (interface + `LogAlerter` default + `FakeAlerter` for tests). The runner is testable via a synchronizable hook.
- **`runServe` construction** [Source: [main.go:74-88](../../worker/main.go#L74-L88)]. Builds `Server{Store, Recorder, Secret}` from `build(ctx)`. 3.8 adds `Parser`/`StatRecorder`/`RosterReader`/runner from the same shared `rec.Pool()` (as `runIngest` does at [main.go:103-105](../../worker/main.go#L103-L105)) and starts+drains the runner.
- **`PgxDemoReader.DemoForMatch`** [Source: [db.go PgxDemoReader (Story 3.6)]; [reparse.go:47](../../worker/ingest/reparse.go#L47)]. If the optional `POST /ingest/parse` endpoint (Resolved Decision 3) is built, it resolves `{DemoID, StorageKey}` from a `match_id` the same way `RunReparse` does.

### Recommended shape (guidance, not prescription)

```go
// worker/ingest/jobs.go (NEW)
type Job struct{ MatchID, DemoID int64; StorageKey string }

type Alerter interface { AlertParseFailed(matchID int64, attempts int, err error) }
type LogAlerter struct{}
func (LogAlerter) AlertParseFailed(m int64, n int, err error) {
    log.Printf("ALERT: match %d parse FAILED after %d attempts (never silent; admin:<id> wiring = Story 7.4): %v", m, n, err)
}

type Runner struct { /* ch chan Job; sem/workers; alerter Alerter; parse deps; cfg */ }
func (r *Runner) Enqueue(j Job) { /* non-blocking submit */ }
func (r *Runner) Start(ctx context.Context) { /* N workers draining ch */ }
func (r *Runner) work(ctx context.Context, j Job) {
    for attempt := 1; attempt <= r.maxAttempts; attempt++ {
        _, err := parseAndRecord(ctx, r.store, r.parser, r.statRec, r.roster, j.MatchID, j.DemoID, j.StorageKey)
        if err == nil { return }              // success (incl. anomaly = success)
        if attempt == r.maxAttempts {         // exhausted
            r.alerter.AlertParseFailed(j.MatchID, attempt, err); return
        }
        select { case <-ctx.Done(): return; case <-time.After(backoff(attempt)): } // ctx-aware
    }
}
```
*(The dev owns the exact API; the load-bearing invariants are: enqueue-after-Acquire-fresh-only, off-request 200, bounded concurrency, capped ctx-aware retry, anomaly≠failure, alert-on-exhaustion, no migration/app change.)*

### Env / secrets

**No net-new required env.** 3.8 reuses the worker's existing config (`serve` mode already requires `WORKER_MATCHZY_SHARED_SECRET` + R2 + derived `DatabaseURL`). The concurrency/attempt/backoff knobs ship as **package-constant defaults** (env-overridability, if any, is deferred to 7.4's event tuning); `lib/env.ts` / `NEXT_PUBLIC_*` untouched. [Source: [config.go](../../worker/config/config.go); Story 3.6 Env / secrets.]

### Source tree — where things go

```
cs-tournament/
  worker/ingest/jobs.go        # NEW  — Runner (bounded pool) + Job + Alerter/LogAlerter + retry/backoff
  worker/ingest/jobs_test.go   # NEW  — retry/backoff/exhaustion+alert, anomaly≠retry, bounded-concurrency
  worker/ingest/cli.go         # EDIT — extract parse tail into parseAndRecord; RunCLI calls it (behavior unchanged)
  worker/ingest/server.go      # EDIT — Server gains Parser/StatRecorder/RosterReader + Enqueue; handleMatchZy enqueues (fresh only); optional POST /ingest/parse
  worker/ingest/server_test.go # EDIT — async enqueue asserts 200-then-parse; no-enqueue-on-AlreadyIngested; extend newTestServer()
  worker/main.go               # EDIT — runServe builds parse deps + starts/drains the Runner
```
No migration. No TS change. No file outside `worker/`. [Repo recon: migrations end at 0009 (Story 3.5); 3.8 adds none — the queue is in-process.]

### Testing standards

- **Go unit tests (fakes, no real DB — the worker-test convention):** the async enqueue + off-request `200` (synchronizable runner), no-enqueue-on-`AlreadyIngested`, capped retry + backoff + exactly-one terminal alert (`FakeParser{Err}` + `FakeAlerter`), retry-then-succeed (no alert), anomaly-is-not-retried, and `parseAndRecord` parity with pre-refactor `RunCLI`. Keep backoff tests **fast** (inject a fake sleep/clock or assert attempt counts — don't actually sleep seconds). `go test ./...` + `go vet ./...` green; `demoinfocs v5.2.0` unchanged.
- **The real end-to-end async path** (HTTP receiver → off-request parse → `stat_row` visible; corrupt-demo retry+alert; bounded concurrency) is proven at **live-QA** against local Supabase + real R2 (Task 7), exactly as 3.3/3.4/3.6's real SQL/parse were validated (the worker suite has no real-DB/real-parser harness; fakes cover orchestration, live-QA covers the real parse + timing).
- **Worker-only guard:** `git diff --stat -- supabase/ app/ lib/` must be **empty**; `vitest run` unchanged; `next build` clean; `supabase test db` unchanged (Files=10 — no migration/test added). A non-empty diff in those trees means scope leaked.

### Regression / boundary notes

- **The retry loop MUST be bounded + `ctx`-aware** (headline risk (a)) — cap attempts, back off between them, and abort the backoff on `ctx.Done()` so shutdown doesn't hang. AD-26 explicitly prevents "an unbounded `ParseFailed → Parsing` retry loop."
- **An anomaly is NOT a `ParseFailed`** (headline risk (b)) — `parseAndRecord` returns success + `anomalous=true` (rows upserted, match held); only a real parse/read/record error retries. Do not re-upsert-forever a held match.
- **Enqueue only on a FRESH acquire** — an `AlreadyIngested` re-POST already has its rows (AD-3); enqueuing would re-parse needlessly. Mirror `RunCLI`'s `AlreadyIngested` short-circuit.
- **The `200` must not wait for the parse** — enqueue is non-blocking, the response returns as soon as bytes are durable. Blocking the response on a ~3.4 s (or retrying) parse would defeat AC1/AC3 and risk a MatchZy upload timeout.
- **Do NOT add a migration / jobs table / persisted attempt column** — the queue is in-process/transient; durable recovery is Story 7.4.
- **Do NOT wire the real `admin:<id>` realtime channel** — log `Alerter` only (Epic 5 substrate / Story 7.4).
- **Do NOT touch `app/` or `lib/`** — keep the manual-path parse trigger to a worker-side seam (optional `POST /ingest/parse`); wiring the Next.js register route is deferred.
- **Do NOT build** `Aprobar`/publish, bracket/feed/leaderboard, the demo-derived score (deferred 3.7→4.6), or bump `demoinfocs`.
- **Graceful shutdown** — drain in-flight jobs on `serve` stop (or explicitly document the accepted loss; either is fine — R2 + Story 7.4 is the recovery backstop). Don't leave a goroutine leak.

### Deferred items to (re)log at review

- **The real `admin:<id>` alert wiring + operator surface** → **Story 7.4** (needs Epic 5 realtime). 3.8 ships the `Alerter` seam + log default.
- **Event-time tuning** of concurrency/attempts/backoff + pinning verification → **Story 7.4** ("when the worker is configured for the event").
- **Durable recovery** of acquired-but-unparsed demos across restart/crash + rehearsed DR path → **Story 7.4 / Story 7.3**.
- **P50/P95 percentile validation under real MatchZy load** → **Epic 7** (needs live Railway + metrics).
- **Wiring the Next.js `/api/ingest/register` manual path to auto-enqueue** → deferred (Cuatro to confirm; the worker-side trigger seam may land in 3.8, the app wiring later).
- **`Aprobar`/publish, bracket/feed/leaderboard republish** → **Epic 4**. **Demo-derived score** → **deferred Story 3.7 → Story 4.6**.

### References

- [Source: [epics.md#Story-3.8 L606-626](../../_bmad-output/planning-artifacts/epics.md#L606-L626)] — the three AC threads (off-request bounded parse w/ pinned version; `ParseFailed` capped-retry+backoff + admin-alert-on-exhaustion never-silent; SM-5 P50<5min/P95<15min) + traces FR-11 · AD-26 · NFR-Perf, NFR-Reliability.
- [Source: [epics.md#Epic-3 L442-444](../../_bmad-output/planning-artifacts/epics.md#L442-L444) (Epic 3 owns the ingest half); [#AD-26 L104](../../_bmad-output/planning-artifacts/epics.md#L104) (the bounded-async-job invariant); [#Story-7.4 L1271-1287](../../_bmad-output/planning-artifacts/epics.md#L1271-L1287) (the ops-hardening half of AD-26 — the 3.8↔7.4 split)] — epic scope + the dual-ownership boundary.
- [Source: [ARCHITECTURE-SPINE.md#AD-26 L205-208](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L205-L208) (async off-trigger, pinned, bounded retry, bounded concurrency, SM-5; prevents unbounded retry loop); #ingest-lifecycle L284-289 (the Parsing/ParseFailed/retry edges); #AD-2 L85-88 (single writer); #AD-3 L90-93 (idempotent — dedup skips enqueue, retry re-upserts safely)] — the invariants 3.8 realizes.
- [Source: [SOLUTION-DESIGN.md §6 L325-336](../../_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md) (MatchZy "streams to R2, then enqueues a parse job"; the Job model — bounded concurrency, capped retry+backoff, pinned, SM-5, parse ~3.4s so upload+queue dominate); §11 L471-482 (Operations — `ParseFailed`+anomalies → `admin:<id>` alert + log never silent; DR: R2 is durable truth, derived state re-derivable; parser pinning)] — the authoritative job model + observability + why an ephemeral queue is safe.
- [Source: [worker/ingest/server.go:67-104](../../worker/ingest/server.go#L67-L104) (`handleMatchZy` — the receiver that stops at Acquire; "NO job queue (Story 3.8)"); :22-35 (`Server` struct + `Routes`)] — the enqueue insertion point + what `Server` must gain.
- [Source: [worker/ingest/cli.go:68-130](../../worker/ingest/cli.go#L68-L130) (`RunCLI`'s parse tail to extract into `parseAndRecord`: Get→Parse→17-digit-guard map→Validate(fail-closed)→RecordParse; :33-35 "MatchZy-HTTP-triggered parse + bounded async queue are Story 3.8 (not wired here)")] — the parse core the async job reuses.
- [Source: [worker/ingest/parse.go:13-16](../../worker/ingest/parse.go#L13-L16) (`ParserVersion` pinned v5.2.0 — keep in lockstep w/ go.mod, do NOT bump); :55-65 (panic-recover → error, "the SAME Parser is wired to the MatchZy HTTP receiver in Story 3.8")] — the pinned parser + why a bad demo fails closed as an error the retry loop can handle.
- [Source: [worker/main.go:74-88](../../worker/main.go#L74-L88) (`runServe` build); :103-105 (`runIngest` builds Parser/StatRecorder/RosterReader from the shared `rec.Pool()`)] — how to construct the parse deps + runner in serve mode.
- [Source: [worker/db/fake.go](../../worker/db/fake.go) (FakeStatRecorder/FakeRosterReader/FakeDemoReader seams); [worker/store/fake.go:50 FakeStore.Get](../../worker/store/fake.go#L50); [worker/ingest/parse.go:114 FakeParser](../../worker/ingest/parse.go#L114) (Err seam); [worker/ingest/server_test.go:18 newTestServer](../../worker/ingest/server_test.go#L18)] — the test seams + harness the async tests extend (add `FakeAlerter`).
- [Source: [supabase/migrations/0005_demo.sql:21](../../supabase/migrations/0005_demo.sql#L21) ("async parse-job enqueue (Story 3.8)"); [0007_stat_row.sql:21](../../supabase/migrations/0007_stat_row.sql#L21) ("a transiently-queued MatchZy row once Story 3.8")] — the schema comments confirming an in-process/transient queue (no migration).
- [Source: [3-6-re-parse-a-retained-demo-ingest-side-of-fr-14.md](./3-6-re-parse-a-retained-demo-ingest-side-of-fr-14.md) (the worker-only-slice discipline, the `git diff supabase/ app/ lib/` empty guard, the local-Supabase-127.0.0.1:54322 + real-R2 live-QA pattern, the seam/fake conventions, deploy-posture=local-verify with Railway/MatchZy → Epic 7); [[demos-folder-location]] (QA `.dem.gz` in `demos/`, gunzip before an ingest)] — previous-story intelligence + the live-QA fixture source.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow) — 2026-07-12.

### Debug Log References

- `go build ./...` + `go test ./...` (worker) — green.
- `go test -race ./ingest/` — green (the concurrent `Runner` is race-clean).
- `go vet ./...` (worker) — clean.
- `npm run test` (vitest) — 11 files / 110 tests passed (unchanged; worker-only slice).
- `git diff --stat -- supabase/ app/ lib/` — **empty** (boundary discipline verified).
- `git diff -- worker/go.mod` — empty (`demoinfocs-golang/v5 v5.2.0` still pinned; no bump).

### Completion Notes List

**What was built (Tasks 1–6 — the mechanism):**
- **Shared parse core (`parseAndRecord`, cli.go):** extracted `RunCLI`'s fresh-acquire parse tail (Get retained object → Parse → 17-digit-guard map → Validate fail-closed → RecordParse) into one reusable function returning a `parseOutcome{Players, Rounds, Anomalous, Reasons}`. `RunCLI` now calls it (behavior + `CLIResult` unchanged — all `cli_test.go` cases stay green). The async job calls the SAME function — **no parse logic duplicated.** Fail-closed semantics preserved verbatim (roster-read error → error; anomaly → success with `Anomalous=true`, NOT an error).
- **Bounded in-process Runner (`jobs.go`, NEW):** a buffered channel drained by `maxConcurrentParses=2` worker goroutines; `Enqueue` is non-blocking (the HTTP 200 never waits on the parse), `Start(ctx)`/`Close()` lifecycle with a graceful drain of buffered jobs on shutdown. Package-constant defaults (`maxParseAttempts=3`, `backoffBase=3s`, queue buffer 64) — event-time tuning is Story 7.4.
- **`Alerter` seam + `LogAlerter` default:** the never-silent injection point; `LogAlerter` logs a structured terminal line. Story 7.4 swaps the real `admin:<id>` Broadcast in — no rework.
- **Capped ctx-aware retry/backoff:** on a genuine parse/read/record error, retry to the cap with exponential backoff (`base·2^(attempt-1)`), aborting the backoff on `ctx.Done()`; on exhaustion raise exactly one alert + log. A validation **anomaly is never retried** (headline risk (b)); the loop is **bounded** (headline risk (a)).
- **AC3 instrumentation:** each successful job logs the landing→visible elapsed (`enqueuedAt`→RecordParse-committed) — the SM-5 budget made observable by construction.
- **Wiring:** `handleMatchZy` enqueues a `Job{matchID, DemoID, StorageKey}` **only on a fresh acquire** (AlreadyIngested enqueues nothing — AD-3), then returns 200. New **`POST /ingest/parse {match_id}`** shared-secret endpoint resolves the retained demo (`DemoReader.DemoForMatch`) and enqueues → 202, or 404 when no demo exists (the manual/re-parse trigger seam; wiring the Next.js register route to call it stays deferred). `runServe` builds the parse deps from the shared pool, `NewRunner(...).Start(ctx)`, and `defer runner.Close()`.

**Design deviation (noted for review):** the parse dependencies (`Parser`/`StatRecorder`/`RosterReader`) live on the **`Runner`**, and `Server` holds the `Enqueuer` interface + a `db.DemoReader` — rather than putting the parse deps on `Server` too (the story allowed "a reference to the job runner (or an `Enqueue` func)"). This avoids duplicating deps across `Server` and `Runner`; functionally identical, cleaner ownership.

**Boundary confirmations:** no jobs/queue table, no migration; log `Alerter` only (no `admin:<id>` realtime); no `app/`/`lib/`/`supabase/` change; parse writes only `status='pending'` rows (RecordParse omits `status`); `demoinfocs` still `v5.2.0`; graceful drain on `Close`.

**Task 7 (live-QA) is the human sign-off gate** — deferred to the review pass per the 3.6 precedent (dev ships the buildable/testable slice; live-QA against local Supabase + real R2 + a real demo, the corrupt-demo retry/alert path, and idempotent re-POST are run by the human before → done). `next build` and `supabase test db` (Files=10) are structurally unaffected by this Go-only slice (empty app/lib/supabase diff) and confirmed at live-QA.

**Deferred-to-review (unchanged from the story's Deferred list):** real `admin:<id>` alert wiring + operator surface → Story 7.4; event-time tuning of concurrency/attempts/backoff → 7.4; durable restart recovery of acquired-but-unparsed demos → 7.4; P50/P95 percentile validation under real load → Epic 7; wiring the Next.js register route to call `POST /ingest/parse` → deferred.

### File List

- `worker/ingest/cli.go` — EDIT: extracted `parseAndRecord` + `parseOutcome`; `RunCLI` now calls the shared core (behavior-preserving).
- `worker/ingest/jobs.go` — NEW: `Job`, `Enqueuer`, `Alerter`/`LogAlerter`, `Runner` (bounded pool + Start/Close/drain), capped ctx-aware retry/backoff, `ctxSleep`, elapsed instrumentation.
- `worker/ingest/jobs_test.go` — NEW: `FakeAlerter`, retry-to-exhaustion+alert, retry-then-succeed, anomaly-not-retried, ctx-cancel-during-backoff, bounded-concurrency, `parseAndRecord` parity + roster-error fail-closed.
- `worker/ingest/server.go` — EDIT: `Server` gains `Enqueuer` + `Demos db.DemoReader`; `handleMatchZy` enqueues on fresh acquire; new `handleParse` (`POST /ingest/parse`) + `parseRequest`.
- `worker/ingest/server_test.go` — EDIT: `newTestServer` wires an `Enqueuer` (+ `recordingEnqueuer`); enqueue-on-fresh / no-enqueue-on-dedup assertions; `TestMatchZyParsesOffRequest` (off-request 200 via `blockingParser`); four `POST /ingest/parse` tests.
- `worker/main.go` — EDIT: `runServe` builds the parse deps + `Runner`, starts it, defers `Close`, wires `Server.Enqueuer` + `Server.Demos`; log line lists the new route.

### Change Log

- 2026-07-12 — Story 3.8 implemented (Tasks 1–6): bounded in-process async parse-job Runner off the MatchZy receiver — fresh-acquire enqueue + off-request 200, shared `parseAndRecord` core (reused by CLI + async job), capped ctx-aware retry/backoff on ParseFailed with a never-silent `Alerter` seam (LogAlerter default) on exhaustion, AC3 landing→visible elapsed instrumentation, and a `POST /ingest/parse` manual/re-parse trigger seam. Worker-only slice (no migration, no app/TS change); `demoinfocs` pinned `v5.2.0`. Status → review; Task 7 live-QA is the human sign-off gate.

### Live-QA Results (2026-07-12)

Executed by the review agent against **local Supabase** (`127.0.0.1:54322`, PostgreSQL 17.6, migrations 0001–0009 applied) + **real R2** (`inclusivcup-demos`), worker built from the patched tree, real 1v1 QA demos from `demos/*.dem.gz`. All async mechanics validated; DB + R2 returned to baseline after.

| Scenario | Result | Evidence |
| --- | --- | --- |
| **Async happy path — off-request** | ✅ | `POST /ingest/matchzy` (match 9001) → `200`; `stat_row(9001)=0` *immediately* after the 200, `=2` ~1.5 s later. `demo.validation_state='anomalous'` (empty roster), `parser_version='demoinfocs-golang/v5 v5.2.0'`. Log: `[parse-job] match 9001 parsed but HELD anomalous (...) in 2.17s (landing->visible; attempt 1/3)`. |
| **AC3 instrumentation** | ✅ | landing→visible elapsed logged per job; upload (~9 s for 31 MB) dominated, parse ~2 s off-request — exactly AC3's model. |
| **Idempotent re-POST (AD-3)** | ✅ | re-POST → `already_ingested:true`, same key; `demo`=1, `stat_row`=2 (stable), R2 objects under `demos/9001/`=1 (redundant upload cleaned up); **only one** `[parse-job]` line across both POSTs (no 2nd enqueue). |
| **`POST /ingest/parse` (new endpoint)** | ✅ | known match → `202 {"enqueued":true}`, re-parse flipped `validation_state` **anomalous→pending** vs the seeded roster; unknown match → **404** (exercises the `db.ErrNoDemo` review patch). |
| **ParseFailed retry + never-silent alert** | ✅ | corrupt `PBDEMS2`+garbage (match 9002) → fresh `200`; `attempt 1/3 retry 3s → attempt 2/3 retry 6s → ParseFailed TERMINALLY after 3/3` + **exactly one** `ALERT: match 9002 parse FAILED after 3 attempts — never silent`; `stat_row(9002)=0`. Backoff `3s,6s` = base·2^(n-1). Bounded. |
| **Bounded concurrency** | ✅ | 3 near-simultaneous fresh POSTs (9003/9004/9005) → all `200`, all landed 2 rows; pool drained the burst (elapsed 1.5 s vs 4–5 s = queue-wait behind 2 workers). Exact ≤2 unit-proven (`TestRunnerBoundedConcurrency`). |
| **Cleanup** | ✅ | all QA `demo`/`stat_row`/fixture rows deleted (DB baseline: all counts 0); 5 R2 objects deleted (`demos/900*` → `None`). |

**Not run (unchanged deferrals → Epic 7 / Story 7.4):** live Railway + rented MatchZy; P50/P95 percentiles under real load; the real `admin:<id>` Broadcast wiring + durable restart recovery.

## Review Findings

`bmad-code-review` (2026-07-12, 3 layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor — all ran, none failed). Verified green locally: `go build`/`go vet`/`go test ./...` clean, `go test -race -count=1` clean (fresh, 2.5 s), boundary discipline confirmed (`git diff supabase/ app/ lib/` empty, `worker/go.mod` unchanged — parser stays pinned `v5.2.0`). **No AC violations; all four ACs met and evidenced. No HIGH/MEDIUM correctness bugs.** All findings below are LOW-severity robustness/quality polish.

**Resolution (2026-07-12):** all 4 patches applied; defer logged to deferred-work.md. Re-verified green: `go build`/`go vet`/`go test -count=1 ./...` clean, `go test -race -count=1` clean, boundary still empty (`supabase/ app/ lib/`, `go.mod`). Two new tests added: `TestRunnerPanicRecoveredAndAlerts` (patch 2) + `TestParseEndpoint500OnLookupFault` (patch 3).

- [x] [Review][Patch] ✅ FIXED — `Enqueue` overflow spawns an unbounded goroutine that can leak + silently drop a job on shutdown [worker/ingest/jobs.go:126-128] — when the buffered channel (cap 64) is full, `Enqueue` does `go func(){ r.ch <- j }()`; if `Close()` drains and both workers exit while that goroutine is still blocked on the send, it leaks forever and the job vanishes with no log — the exact "don't leave a goroutine leak" case the story's Regression note names, and it is silent (against the never-silent ethos). Effectively unreachable at v1 load (matches minutes apart, buffer 64) but latent. Fix: on overflow, log-and-drop (never-silent; R2 + Story 7.4 is the durable backstop) or `select` on `r.quit`/`r.ctx.Done()` in the overflow send so shutdown can't strand it. [blind+edge]
- [x] [Review][Patch] ✅ FIXED — Worker goroutines have no per-job panic recover — a panic *outside* the parser crashes the whole process [worker/ingest/jobs.go:181-216] — `DemoinfocsParser.Parse` recovers its own panics (parse.go), but a panic in `s.Get` / `RecordParse` / `ActiveSteamIDs` inside a worker goroutine is unrecovered → the Go runtime terminates the entire worker process, defeating parse.go's stated "fail CLOSED … rather than crashing the worker process" guarantee end-to-end. Low likelihood (these paths return errors, not panics) but defense-in-depth: wrap `work()`'s body in a `recover()` that logs + treats the panic as a terminal failure (optionally routing it through the `Alerter`). [blind+edge]
- [x] [Review][Patch] ✅ FIXED — `POST /ingest/parse` returns 404 for ANY `DemoForMatch` error, masking a transient DB fault as "no demo" [worker/ingest/server.go:143-150] — `PgxDemoReader.DemoForMatch` already distinguishes `pgx.ErrNoRows` from an infra error (db.go:420-430), but `handleParse` collapses both to `404 no retained demo for match`. An operator hitting the seam during a DB blip sees a client-error 404 instead of a 500, hiding the real fault. Fix: add a db sentinel (e.g. `db.ErrNoDemo`) for the no-rows case and map only that → 404, else → 500. [blind]
- [x] [Review][Patch] ✅ FIXED — Stale test comment references a non-existent `newAsyncTestServer` [worker/ingest/server_test.go:25] — the off-request path is exercised by `TestMatchZyParsesOffRequest`, which builds the `Server` inline (server_test.go:269-280); there is no `newAsyncTestServer`. Trivial doc fix (correct or drop the reference). [edge]
- [x] [Review][Defer] `serve` graceful-drain (`defer runner.Close()`) is unreachable on a normal shutdown signal [worker/main.go:94-98] — deferred, pre-existing. `http.ListenAndServe` blocks and only returns on error, so on SIGTERM/Ctrl-C the deferred `Close()` never runs and in-flight/buffered jobs are not drained — weaker than Task 6's "the serve graceful-shutdown drains in-flight jobs" wording. The story's own Regression note explicitly blesses the accepted loss ("or explicitly document the accepted loss; either is fine — R2 + Story 7.4 is the recovery backstop"), and genuine graceful shutdown needs `signal.NotifyContext` + `http.Server.Shutdown`, an ops concern adjacent to Story 7.4. Pre-existing (the worker has never had signal handling). [edge]

**Dismissed as noise (2):** (1) `POST /ingest/parse` enqueues the async `parseAndRecord` job (upsert-only `RecordParse`: no delete-missing, no `parse_generation` bump) rather than `RunReparse` semantics — this matches the story's stated design (the endpoint "enqueues a job"); for the same retained demo the player set is identical so delete-missing is moot and the generation bump is a `worker reparse` nicety. The "re-parse trigger" naming slightly oversells it, but behavior is correct per spec. (2) `work()`'s elapsed proxy reads `j.enqueuedAt`, which is zero only when `work()` is called directly in unit tests (never via `Enqueue`) — production always stamps it at enqueue; log-only, no runtime impact.
