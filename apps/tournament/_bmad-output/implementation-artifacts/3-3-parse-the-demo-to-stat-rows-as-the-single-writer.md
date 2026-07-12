---
baseline_commit: e375b1f5df251ffc21132d3e41a206a117529cb5
---

# Story 3.3: Parse the demo to stat rows as the single writer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want the Go worker to **parse** a retained demo into normalized **per-player stat rows** as the **only** writer,
so that there is exactly one trustworthy path from demo → stats with **no client write surface**, and every parsed row is keyed and re-runnable by `(match_id, steamid64)`.

**This is the third story of Epic 3 — the first time the worker opens a `.dem`.** Story 3.1 got the bytes durable in R2 (`Acquiring`). Story 3.2 hashed + deduped them write-once (`Hashing → Deduped → AlreadyIngested`). Story 3.3 slots the **`Parsing`** node in: it imports `demoinfocs-golang/v5 v5.2.0` for the first time, creates the **`stat_row` migration slice** (the single-writer target), and wires **parse → upsert** end-to-end on the **CLI path** (`worker ingest <path.dem> --match <id>`). It stops **before** the validation/anomaly gate (Story 3.4), the Pending-visibility model (Story 3.5), and the bounded async job queue (Story 3.8).

The scope is deliberately a **thin, provable slice** of the parse pipeline, not the full stat set: 3.3's parser fills only the **minimum viable payload** — `kills`, `deaths`, `rounds_played` + identity/provenance — which proves the single-writer parse→upsert path works and feeds Story 3.4's `Σkills==Σdeaths` conservation gate. **All rich stat derivation** (assists, ADR, HS%, MVPs, flash/utility, KAST, the weird demo-only stats, entry frags/clutches, AFK/idle DQ) is **Epic 5** (Stories 5.1–5.4), exactly as the epic breakdown assigns it. The `stat_row` table is created with the **full column set** (all nullable) so Epic 5 enriches with **no further migration**.

## Acceptance Criteria

> Restated from `epics.md#Story 3.3` (lines 495–515), elaborated with the three decisions Cuatro resolved during story creation (see **Dev Notes → Resolved Decisions**). Traces: **FR-12 · AD-2, AD-3, AD-26 · SPEC Constraint 4 (single writer)**.

**AC1 — Single-writer parse → `stat_row` (AD-2).**
Stat rows are written **only** by the Go worker via the direct owner/service-role DB connection (the same `pgx` path that writes `demo`). **No** `anon`/`authenticated` role and **no** app (`app/`+`lib/`) code path can insert/update/delete `stat_row` — the table has **no** anon/authenticated grant or write policy, and the `worker/*` ↔ `app/`+`lib/` no-import boundary is unchanged (only the `supabase/migrations` schema contract couples them). The worker is now the sole writer of **both** `demo` and `stat_row`.

**AC2 — Parse produces normalized per-player rows keyed by `match_id` + SteamID64 (FR-12).**
The pinned **`demoinfocs-golang/v5 v5.2.0`** (added to `worker/go.mod` — the repo's first `demoinfocs` import) parses a Source-2 `.dem` into **one row per SteamID64** that appeared (bots/world `SteamID64 == 0` skipped, warmup skipped). Each row carries: `match_id`, `steamid64` (17-digit decimal text), `demo_id` (provenance — the parse that produced it), and the **minimum viable stat payload** `kills`, `deaths`, `rounds_played` (per Resolved Decision 1). The demo row's `parser_version` is stamped `= "demoinfocs-golang/v5 v5.2.0"` on parse (kept **nullable** per Resolved Decision 3). The parse reads the **retained R2 object** (`DemoStore.Get`), so it parses exactly the archived source-of-truth bytes (AD-1) and reuses the path Story 3.6 re-parse needs.

**AC3 — Idempotency key + upsert (AD-3, AD-26).**
The `stat_row` migration `0007` enforces `UNIQUE(match_id, steamid64)`. The worker upserts via `INSERT … ON CONFLICT (match_id, steamid64) DO UPDATE`, so a re-parse **replaces** rather than duplicates a player's row. The upsert of a match's rows + the `parser_version` stamp run in **one transaction** (the AD-3/AD-26 idempotent-parse spirit). An `AlreadyIngested` re-upload (Story 3.2 short-circuit) does **not** re-parse — its stat rows already exist from the first ingest; deliberate re-parse is Story 3.6's explicit admin action.

**AC4 — Migration `0007_stat_row.sql` + pgTAP; single-writer RLS.**
`supabase/migrations/0007_stat_row.sql` creates `stat_row` per `SOLUTION-DESIGN.md` §3 (lines 141–156) with the **full** column set (all stat columns nullable), `UNIQUE(match_id, steamid64)`, `demo_id` FK → `demo(id)`, `match_id` a plain `bigint not null` (**FK to `match` deferred to Epic 4** — no `match` table yet), `steamid64 text CHECK (~ '^[0-9]{17}$')` and **not a FK** (AD-4 unreconciled left-join). `ENABLE` + `FORCE` RLS; **admin-only** `stat_admin` SELECT policy (dormant, mirrors `demo`/`audit_log`); `grant select, insert, update, delete on stat_row to service_role` (**DELETE** granted for the Story-3.6 re-parse delete-missing); **no** anon/authenticated grant. A new `supabase/tests/0007_stat_row_test.sql` with explicit `plan(N)` (retro action #5) proves the constraint/CHECK/FK/grant matrix. `supabase test db` stays green (Files 7 → 8); the `0003` generic FORCE-guard and `canonical_steamid64_invariant_test.sql` both auto-cover `stat_row` and stay green.

**AC5 — CLI wiring end-to-end; module boundary + TS untouched (single writer proof).**
`worker ingest <path.dem> --match <id>` now, on a **fresh** (non-`AlreadyIngested`) acquire, reads the stored object back, parses it, and upserts the `stat_row` rows via the service role — the whole `Acquiring → Hashing → Deduped → Parsing` chain in one operator command (the local-verify path 3.1/3.2 QA used). The MatchZy-HTTP-triggered parse + the bounded async queue are **Story 3.8** (not built here). No TS change (`git diff lib/ app/` empty; `vitest run` stays at 110); no new `NEXT_PUBLIC_*`; no net-new env name.

### Out of scope (do NOT build here)

- **The rich stat derivation** — assists, ADR, HS%, MVPs, flash assists, utility damage, KAST (core, FR-18 → **Story 5.1**); knife/wallbang/through-smoke/no-scope/blind/molotov-HE (weird, FR-19 → **Story 5.2**); entry frags / opening duels / 1vX clutches (derived, FR-20 → **Story 5.3**); AFK/idle DQ + `idle_dq`/`idle_round_count` (FR-21 → **Story 5.4**). The columns are **created** here (nullable) but the parser leaves them NULL. 3.3 fills only `kills`, `deaths`, `rounds_played`.
- **The validation / anomaly gate** — `Σkills==Σdeaths`, non-zero-rows, roster reconciliation, `Anomalous` hold → **Story 3.4**. 3.3 writes rows unconditionally (`status` defaults to `pending`).
- **The Pending two-policy visibility model** — the viewer policy `stat_view USING (status='approved')` + the `anon`/`authenticated` SELECT grant, and the match→`Pendiente` label → **Story 3.5**. 3.3 ships admin-only visibility (like `demo`).
- **Demo-derived score + Forfeit/Bye precedence** (AD-5/AD-23) → **Story 3.7 / Epic 4** (needs the `match` table).
- **The bounded async job queue + retry/backoff + MatchZy-HTTP-triggered parse** (AD-26) → **Story 3.8**. 3.3 parses synchronously on the CLI path only.
- **Re-parse revert→reparse→republish + delete-missing SteamIDs + `parse_generation` bump** → **Stories 3.6 / 4.7**. 3.3 does the first-parse upsert only; `parse_generation` stays at its default `1`.
- **`stat_row_match_fk`** (and the still-pending `demo_match_fk`) → **Epic 4** (when `match` exists).
- **`demo_sha256 NOT NULL` + worker-side hashing of the admin manual path** → still **Epic 5** (unchanged from 3.2).

## Tasks / Subtasks

- [x] **Task 1 — Migration `0007_stat_row.sql` + pgTAP (AC1, AC3, AC4)**
  - [x] Create `supabase/migrations/0007_stat_row.sql`. Header-comment style of `0005`/`0006`: a SCOPE block (create `stat_row`, `UNIQUE(match_id, steamid64)` = the AD-3 key, single-writer RLS) and an explicit **OUT OF SCOPE** block (`stat_row_match_fk` → Epic 4; viewer `stat_view` policy + anon/authenticated grant → Story 3.5; `demo.parser_version NOT NULL` NOT enforced — set-on-parse, nullable; rich stat columns created-but-Epic-5-populated; delete-missing/`parse_generation` → 3.6).
  - [x] Table columns **exactly** per `SOLUTION-DESIGN.md` §3 L141–156 (the full set, all stat columns nullable) with the deferrals baked in: `match_id bigint not null` (**no FK** — plain `bigint`, mirroring `demo.match_id`/`tournament.final_match_id`/`audit_log.target_match_id`); `steamid64 text not null check (steamid64 ~ '^[0-9]{17}$')` **and NOT a FK** (AD-4 — the unreconciled left-join; mirrors `stat_snapshot_row.steamid64`); `demo_id bigint not null references demo(id) on delete restrict`; `status text not null default 'pending' check (status in ('pending','approved'))`; `approved_by text references player(steamid64)`; `unique (match_id, steamid64)`.
  - [x] Add the index the leaderboard/reads will use: `create index stat_row_match_idx on public.stat_row (match_id);` (the `stat_row (status)` partial index in SOLUTION-DESIGN §3 L258–260 is an Epic-5 leaderboard optimization — add there, not here).
  - [x] `alter table public.stat_row enable row level security;` **and** `alter table public.stat_row force row level security;` (FORCE is non-negotiable — the `0003` generic catalog FORCE-guard auto-covers `stat_row` and fails loudly if omitted).
  - [x] Admin-only read policy, mirroring `0005`/`0003` exactly: `create policy stat_admin on public.stat_row for select to authenticated using ((select public.is_admin()));` — dormant defense-in-depth. **No** viewer policy yet (that's Story 3.5's `stat_view`).
  - [x] Grants: `grant select, insert, update, delete on public.stat_row to service_role;` — **DELETE is granted** (unlike `demo`) because Story 3.6 re-parse deletes SteamIDs absent from a new parse. **No** anon/authenticated grant of any kind (Story 3.5 adds viewer SELECT).
  - [x] Create `supabase/tests/0007_stat_row_test.sql` with explicit `plan(N)`: table exists; FORCE on; `col_is_unique (match_id, steamid64)`; `steamid64` CHECK **rejects** a non-17-digit value (`throws_ok '23514'`) and accepts a valid one; `status` CHECK + default `'pending'`; `demo_id` NOT NULL + FK to `demo` (insert with a bad `demo_id` → `23503`); `match_id` NOT NULL and **no FK** to `match` (a `match_id` with no matching row still inserts — proves the FK is deferred); a duplicate `(match_id, steamid64)` → `23505`; `service_role` has select/insert/update/**delete**; `anon`/`authenticated` have **no** privilege; `stat_admin` policy present; **no** `stat_view` policy yet. Follow the assertion-accounting + role-switch style of `0005_demo_test.sql`/`0004_roster_test.sql`.
  - [x] Verify: `supabase db reset` applies `0001→0007` cleanly; `supabase test db` stays green and adds `0007_stat_row_test.sql` (**Files 7 → 8**). Confirm `canonical_steamid64_invariant_test.sql` (which name-drops `stat_row` at L9–11) stays green — `stat_row` keys on `steamid64`/`match_id`, never `display_name`, so it passes by construction.

- [x] **Task 2 — Add the pinned parser + the parse core (AC2)**
  - [x] `cd worker && go get github.com/markus-wa/demoinfocs-golang/v5@v5.2.0 && go mod tidy`. The **`/v5` suffix matters** (PoC/3.1 note). Pin exactly `v5.2.0` (matches the PoC `go.mod`; brings transitive deps: `golang/geo`, `golang/snappy`, `go-unassert`, `gobitread`, `godispatch`, `quickhull-go/v2`, `oklog/ulid/v2`, `pkg/errors`, `golang.org/x/exp`, `google.golang.org/protobuf`). *(Done: go.mod now requires demoinfocs-golang/v5 v5.2.0 + the exact transitive set; also bumped x/sync→0.19.0, x/text→0.34.0.)*
  - [x] `worker/ingest/parse.go`: a pinned `const ParserVersion = "demoinfocs-golang/v5 v5.2.0"` (keep in lockstep with `go.mod`); a `Parser` **interface** (`Parse(r io.Reader) (ParseResult, error)`) so `go test` injects a `FakeParser` (no real `.dem`); a `DemoinfocsParser` production impl; result types `ParseResult{ RoundsPlayed int; Players []PlayerStat }` and `PlayerStat{ SteamID64 uint64; Kills, Deaths int }`.
  - [x] `DemoinfocsParser.Parse` follows the **PoC pattern** (`_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go`): `dem.NewParser(r)`; a `get(*common.Player)` helper that **skips `nil` / `SteamID64 == 0`** (bots/world); register `events.Kill` → `Killer.kills++`, `Victim.deaths++`, **skipping `p.GameState().IsWarmupPeriod()`**; `p.ParseToEnd()`; `rounds = p.GameState().TotalRoundsPlayed()`. Assemble `Players` in a **deterministic order** (sort by SteamID64) so tests/logs are stable. **Only** kills/deaths/rounds — do **not** compute assists, ADR, headshots, or the weird/derived stats (Epic 5). Wrap parse errors (`fmt.Errorf("parse demo: %w", err)` in Parse; the CLI adds the `match %d` context).
  - [x] `FakeParser` (in `parse.go` or a test helper): returns a canned `ParseResult` (+ an `Err` seam) so the write/wiring path is unit-tested without a real demo. The **real** `DemoinfocsParser` correctness on a real `.dem` is a **live-QA** gate (Task 6), mirroring how 3.1/3.2 deferred real-R2/real-`.dem` to the human gate. Add one Go unit test that `DemoinfocsParser.Parse` on a non-`PBDEMS2`/truncated reader **errors cleanly** (the error path), so the real impl is not shipped entirely unexercised. *(Confirmed: the real parser returns a wrapped error — not a panic — on a corrupt stream.)*

- [x] **Task 3 — `stat_row` writer + the `demo_id` provenance ripple (AC1, AC3)**
  - [x] `worker/db/db.go`: add `StatRow{ MatchID int64; SteamID64 string; DemoID int64; Kills, Deaths, RoundsPlayed int }` and a `StatRecorder` interface `RecordParse(ctx, demoID int64, parserVersion string, rows []StatRow) error`. `PgxStatRecorder` (or extend `PgxRecorder`) runs **one transaction**: `update demo set parser_version=$1 where id=$2`, then for each row `insert into stat_row (match_id, steamid64, demo_id, kills, deaths, rounds_played) values (…) on conflict (match_id, steamid64) do update set kills=excluded.kills, deaths=excluded.deaths, rounds_played=excluded.rounds_played, demo_id=excluded.demo_id` (batch via `pgx.Batch` or a `copy`+upsert; `status` takes its `pending` default). Commit/rollback on error. **Do not** delete-missing SteamIDs (Story 3.6). Convert `SteamID64 uint64 → strconv.FormatUint(sid, 10)` at the call site (Task 5), not in the DB layer. *(Done: separate `PgxStatRecorder` borrowing the pool via `PgxRecorder.Pool()`; upsert via `pgx.Batch` inside the tx; empty-rows still stamps + commits.)*
  - [x] **The `demo_id` ripple:** `stat_row.demo_id` needs the `demo` row's PK. Extend `RecordDemo` to `returning id, storage_key` and add `DemoID int64` to `RecordOutcome` (both the fresh branch and the `AlreadyIngested` `select id, storage_key from demo where …` branch). Add `DemoID int64` to `ingest.AcquireResult` and set it in `Acquire`. This is the widest ripple — mirrors the 3.2 `DemoRecorder` signature change (update `PgxRecorder`, `FakeRecorder`, and every `RecordDemo`/`Acquire` test caller so `go build ./...` is clean). *(DemoID lands INSIDE `RecordOutcome`/`AcquireResult` — additive — so only the RunCLI-signature callers actually break; existing RecordDemo/Acquire callers are source-compatible.)*
  - [x] `worker/db/fake.go`: add a `FakeStatRecorder` capturing `RecordParse` calls (the `rows`, the `demoID`, the `parserVersion`) with an `Err` seam and an in-memory upsert mirror (repeat `(MatchID, SteamID64)` replaces, not appends) so tests assert idempotency. `FakeRecorder.RecordDemo` now also returns a `DemoID` (a monotonically increasing fake id) so the fresh-path parse gets a non-zero provenance id.

- [x] **Task 4 — Read the retained object back + parse it (AC2)**
  - [x] The parse consumes the **stored R2 object**, not a second tee of the request stream (`demoinfocs` is CPU-heavy and needs the whole stream; re-reading the archived bytes proves the source-of-truth object parses (AD-1) and is exactly the path Story 3.6 re-parse reuses). After a **fresh** `Acquire`, open `rc, err := store.Get(ctx, acquireResult.StorageKey)`; `defer rc.Close()`; `result, err := parser.Parse(rc)`. R2 is read-after-write consistent for new PUTs, so the just-stored object is immediately readable; `FakeStore.Get` (map-backed) is immediate too.
  - [x] On `AlreadyIngested == true`, **skip** the parse (the prior ingest already wrote the stat rows — the AD-3 short-circuit) and log it. Only a **fresh** acquire parses.

- [x] **Task 5 — Wire parse→write into the CLI path (AC5)**
  - [x] Extend `worker/ingest/cli.go` `RunCLI` to accept a `Parser` + a `StatRecorder` (injected), and after a fresh `Acquire`: `Get` the object (Task 4) → `parser.Parse` → build `[]db.StatRow` (convert each `PlayerStat.SteamID64` via `strconv.FormatUint`, stamp `MatchID` from `meta`, `DemoID` from `acquireResult.DemoID`, `RoundsPlayed` from `result.RoundsPlayed`) → `statRec.RecordParse(ctx, acquireResult.DemoID, ingest.ParserVersion, rows)`. Return a result that also reports the parsed player count + rounds. *(New `CLIResult{ AcquireResult; Parsed; Players; Rounds }` return type.)*
  - [x] `worker/main.go` `build()` + `runIngest`: construct the `DemoinfocsParser` + the `PgxStatRecorder` (reuse the same pool) and pass them to `RunCLI`. Log e.g. `parsed match %d: %d players, %d rounds -> stat_row` (and the `already_ingested=true → skipped parse` case). *(Kept `build()` unchanged; constructs both in `runIngest` sharing `rec.Pool()`.)*
  - [x] The MatchZy HTTP receiver (`server.go`) and the presign path are **unchanged** — HTTP-triggered parse is Story 3.8. (Do not add a parse call to `handleMatchZy`.) *(Verified: `git status` shows no change to `server.go`/`server_test.go`.)*

- [x] **Task 6 — Tests + green-bar (AC1–AC5)**
  - [x] `worker/ingest/parse_test.go`: `FakeParser` echoes its canned result (+ the `Err` seam); the `DemoinfocsParser` error-path test (Task 2 — the real parser returns a wrapped error, not a panic, on a corrupt stream). *(The `PlayerStat`→`StatRow` mapping is asserted in `cli_test.go` — the story stamps the conversion at the RunCLI call site, not in the parser; `DemoinfocsParser`'s skip-zero + deterministic ordering are real-`.dem` properties, so they are live-QA gates (Task 7).)*
  - [x] `worker/ingest/cli_test.go`: fresh CLI ingest (FakeStore + FakeRecorder + FakeParser + FakeStatRecorder) → object stored **and** `RecordParse` called once with the correct `demoID`, `parserVersion`, and rows (`match_id`, 17-digit `steamid64`, `demo_id`, K/D/rounds); a **re-run** (`AlreadyIngested`) → **no** second `RecordParse` (parse skipped); `parser.Err` / `statRec.Err` injection → the CLI returns the error (fail-closed, no partial claim).
  - [x] `worker/db/*_test.go`: `FakeStatRecorder` upsert-idempotency (same `(match_id, steamid64)` twice → one row, replaced); the `RecordDemo` `DemoID` return threaded through `fake_test.go`/`ingest_test.go`/`cli_test.go` (the 3.2 ripple pattern). *(`server_test.go` needed NO change — `DemoID` lands inside the additive `RecordOutcome`, so the `DemoRecorder` interface signature is unchanged; only the RunCLI-signature callers broke.)*
  - [x] Whole bar green: `cd worker && go build ./... && go vet ./... && gofmt -l .` clean; `go test ./...` all packages pass (43 test funcs, grew from 3.2's baseline). `supabase test db` green with `0007` added (**Files 8, 252 tests**). `vitest run` **unchanged at 110**; `git diff lib/ app/` **empty**; `next build` clean. No `NEXT_PUBLIC_*` leak; `lib/env.ts` untouched.

- [x] **Task 7 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy still Epic 7)** ✅ **PASSED — Cuatro, 2026-07-11 (run against the local Supabase stack + real R2 bucket; results below + in the Change Log).** Mirrors the 3.1/3.2 rhythm; the dev agent cannot run it (needs a real Source-2 `.dem` + real `R2_*` creds + the local Supabase stack). Build everything above, then Cuatro clears this to move `review → done`.
  - [x] **Prereq:** the real `cuatro-luisito.dem` (31,005,788-byte canonical `PBDEMS2`, `sha256 fd28235d…a8215e`) used in 3.1/3.2 live-QA, real `R2_*` from `.env.local`. Per the 3.1 infra finding, DB writes run against the **local** Supabase stack (`SUPABASE_URL=http://127.0.0.1:54321`); R2 is the real bucket. **A `demo` row for the QA `match_id` must exist first** — run one CLI ingest (Story 3.1/3.2 path) so `stat_row.demo_id`'s FK resolves; `match_id` has no FK so any QA id inserts.
  - [x] **CLI parse:** ✅ 2 rows — `76561198388441171` (10K/6D), `76561199176839714` (6K/10D); `demo_id=39`, `parser_version` stamped, both 17-digit, `status='pending'`; no bot/world (SteamID64==0) row. `worker ingest cuatro-luisito.dem --match 990301` → R2 object + `demo` row (`demo_sha256`, `parser_version="demoinfocs-golang/v5 v5.2.0"`) + **one `stat_row` per SteamID64** with `demo_id` set, `kills`/`deaths`/`rounds_played` populated, `status='pending'`. Confirm each `steamid64` is a **valid 17-digit** id and bots/world produced no row.
  - [x] **Conservation sanity (pre-stages Story 3.4):** ✅ Σkills 16 == Σdeaths 16 (`conserved=t`); `count(*)=2` == parsed player count (1v1 symmetry: 10/6 vs 6/10). `select sum(kills), sum(deaths) from stat_row where match_id=990301` are **equal** (the PoC showed 126==126 on its sample), and `select count(*)` matches the demo's real player count. Spot-check one player's K/D against a known reference if available.
  - [x] **Idempotency:** ✅ re-run → `already_ingested=true; parse skipped`; `stat_row` stayed 2, `demo` stayed 1, same R2 object. re-run the same command → `already_ingested=true`, **no** re-parse, `stat_row` count unchanged, R2 stays at 1 object.
  - [x] **QA cleanup:** ✅ R2 object `demos/990301/babec28649….dem` deleted (HeadObject→404); local `stat_row`+`demo` rows for 990301 cleared (0/0 verified). delete the test R2 object(s); clear the local `stat_row` + `demo` test rows.
  - [x] **Deferred to Epic 7 (unchanged):** live Railway deploy + rented MatchZy server; the worker hosted-DB IPv4/pooler gap (3.1 finding). Correctly out of scope — local-verify is exactly what Task 7 specifies.

### Review Findings

_Code review (bmad-code-review, 2026-07-11) — baseline `e375b1f`; three adversarial layers (Blind Hunter · Edge Case Hunter · Acceptance Auditor), all on Opus 4.8. Outcome: **2 decision-needed (both resolved → patched + applied), 2 deferred, 6 dismissed**. No Critical/High defects; the Acceptance Auditor confirmed AC1–AC5 satisfied and no out-of-scope leakage; the migration is column-for-column faithful to SOLUTION-DESIGN §3 and pgTAP `plan(36)` is accurate._

**Decision-needed → RESOLVED (both patched + applied 2026-07-11; Cuatro's call):**

- [x] [Review][Decision] **Non-17-digit / zero `SteamID64` fails the whole match's stat write.** The mapping site in [cli.go](worker/ingest/cli.go) does `strconv.FormatUint(pl.SteamID64, 10)` and passes it straight to the batch upsert with no length guard; the parser ([parse.go](worker/ingest/parse.go)) only skips `SteamID64 == 0`. If `demoinfocs` ever surfaces a non-zero id that isn't exactly 17 digits, the `steamid64 ~ '^[0-9]{17}$'` CHECK ([0007_stat_row.sql](supabase/migrations/0007_stat_row.sql)) throws `23514` and `RecordParse`'s single transaction rolls back **every** player's row for that match — and the demo then wedges (a re-run short-circuits as `AlreadyIngested`). Near-zero reachability (valid CS2 ids are always 17 digits), but the blast radius is the entire match. **Options:** (A) add a Go-side skip-guard mirroring the CHECK (skip + log non-17-digit ids at the mapping site, mirroring the parser's existing zero-skip); (B) accept the current fail-closed-whole-match behavior; (C) defer to Story 3.4's validation/anomaly gate. (Sources: edge+blind)
- [x] [Review][Decision] **No `recover()` around the third-party `demoinfocs` parser.** `DemoinfocsParser.Parse` ([parse.go](worker/ingest/parse.go)) relies entirely on `ParseToEnd()` **returning** an error; there is no `defer/recover`. The one real-parser test proves a single corrupt stream returns a *wrapped error*, not that all malformed `PBDEMS2` inputs do — a bit-reader panic on a crafted/corrupt demo would crash the worker instead of failing closed. CLI-only + operator-supplied in 3.3 (low blast radius), but the same `Parser` is wired to the MatchZy HTTP receiver with externally-produced bytes in Story 3.8. **Options:** (A) add a panic→wrapped-error guard in `Parse` now (cheap, and `parse.go` is new); (B) defer to Story 3.8 when the HTTP path first exposes external input. (Source: edge)

**Patches applied (2026-07-11 — Cuatro chose Option A for both; green bar re-verified: `go build`/`go vet`/`gofmt -l .`/`go test ./...` all clean):**

- **D1 (A)** — Go-side skip+log guard at the [cli.go](worker/ingest/cli.go) `RunCLI` mapping site: `len(sid) != 17` mirrors the `stat_row` `^[0-9]{17}$` CHECK (for a `uint64`, `FormatUint` emits only digits, so a 17-char string *is* that CHECK), skipping + `log.Printf`-warning any non-17-digit id so one phantom entity can't roll back the whole match's batch upsert. New `TestRunCLISkipsMalformedSteamID` proves the valid id survives and the malformed id is dropped.
- **D2 (A)** — `defer/recover` added to `DemoinfocsParser.Parse` ([parse.go](worker/ingest/parse.go), now named returns) converting a parser panic into a wrapped fail-closed error, so a crafted/corrupt demo can't crash the worker (also protects the Story-3.8 MatchZy-HTTP path that reuses this `Parser`). The existing `TestDemoinfocsParserRejectsCorruptStream` stays green; a panic-specific test is intentionally omitted (no deterministically-panicking `.dem` fixture exists — the guard is a standard defensive idiom).

**Deferred (real, out of scope for this slice — also logged in `deferred-work.md`):**

- [x] [Review][Defer] **`parser_version` UPDATE has no `RowsAffected` check** [worker/db/db.go] — silent no-op success if a zero-row parse carries a `demoID` matching no `demo` row. Unreachable in the current CLI wiring (`acq.DemoID` is always a valid fresh PK); becomes relevant with Story 3.8's async queue. → Story 3.8. (Sources: edge+blind)
- [x] [Review][Defer] **`stat_row` created only for players in a live Kill event** [worker/ingest/parse.go] — a 0-kill/0-death player gets no row, mildly inconsistent with AC2's "appeared." Matches the prescribed sketch; near-zero impact. Note for Task-7 player-count check + Story 3.4 roster reconciliation. → Story 3.4 / live-QA. (Source: auditor)

**Dismissed (6):** (1) zero-row parse commits-as-success — the non-zero-rows guard is explicitly Story 3.4's validation gate; 3.3 writes unconditionally by design. (2) First-run parse failure wedges the demo — the story Dev Notes already document this as "known, not a bug" (recovery is Story 3.6/3.8). (3) Real `DemoinfocsParser` skip/count/order/warmup logic has no unit coverage — accepted live-QA strategy (Task 7), mirroring 3.1/3.2; no real `.dem` fixture in-repo. (4) `store.Get` "absent from diff" (blind-layer artifact) — verified present at [store.go:46](worker/store/store.go#L46). (5) `player(steamid64)` FK-target validity (blind-layer artifact) — verified PK at [0001_core_schema.sql:39](supabase/migrations/0001_core_schema.sql#L39). (6) `ParserVersion`/`go.mod` hand-lockstep — nit, currently consistent (`v5.2.0`).

## Dev Notes

### Resolved Decisions (Cuatro, 2026-07-11, during story creation — build for these)

1. **⭐ Stat scope = the parser fills only the minimum viable payload (`kills`, `deaths`, `rounds_played`) + identity/provenance; the full `stat_row` DDL is created (all stat columns nullable) but the rich derivation is Epic 5.** *(Chosen over "derive the full FR-18 core set now" and over "player-set + rounds only".)*
   *Why:* the epic breakdown explicitly assigns core/weird/derived/idle derivation to **Epic 5** (Stories 5.1–5.4; `epics.md:823–901`), and Epic 3's own next story (3.4) needs `kills`/`deaths` for its `Σkills==Σdeaths` conservation gate (`epics.md:527`). So the clean seam is: 3.3 proves the **single-writer parse→upsert path** with the fundamental K/D/rounds (trivially available in the same `events.Kill` loop the PoC already ran), and Epic 5 enriches. Because the migration creates the **whole** table (like `0005` created the whole `demo` table with nullable shells), **Epic 5 needs no further migration** — it only widens the parser. "Player-set + rounds only" was rejected because it would leave 3.4's conservation gate with nothing to check until Epic 5, contradicting 3.4's stated AC. *(This decision is purely about how much parse logic lands in 3.3 vs Epic 5 — it does not change the schema.)*

2. **⭐ Parse trigger = wire parse→`stat_row` on the CLI path now; the MatchZy-HTTP-triggered parse + the bounded async queue are Story 3.8.** *(Chosen over "parse on all paths synchronously in 3.3".)*
   *Why:* Story 3.8 explicitly owns "**when an upload triggers ingestion**, parsing runs off-request … with bounded concurrency … capped retries + backoff" (`epics.md:606–626`, AD-26). 3.3 owns the parse **mechanism** (the `Parse` core + the `stat_row` writer + the migration), and the CLI (`worker ingest …`) is the operator's local-verify path — exactly how 3.1 and 3.2 live-QA actually ran. Wiring parse into the CLI proves the whole `Acquiring → … → Parsing` chain end-to-end in one command without pre-empting 3.8's queue; 3.8 then swaps the synchronous CLI call for an enqueue→bounded-worker-pool and wires the MatchZy trigger. AD-26's "never inline in a **Vercel** request" is not violated either way (the worker is Railway, not Vercel), but keeping the HTTP-trigger in 3.8 respects the epic's 3.3/3.8 boundary. *(Design detail, not a separate decision: the parse reads the **retained R2 object** back via `DemoStore.Get(storageKey)` — uniform across CLI/MatchZy/re-parse, and it proves the archived source-of-truth bytes parse (AD-1). Story 3.6 re-parse needs this exact read-back path.)*

3. **⭐ `demo.parser_version` stays NULLABLE; the worker sets it on parse (an unparsed/manual demo keeps NULL).** *(Chosen over "enforce `NOT NULL` now", which Story 3.1's notes optimistically earmarked for 3.3.)*
   *Why:* `parser_version` is a property of the **parse**, but a `demo` row legitimately exists in the **acquired-but-unparsed** state — the admin manual-upload path never parses, and once Story 3.8's async queue separates acquire from parse in time, even MatchZy rows are transiently unparsed. `NOT NULL` would reject those valid rows. This is the **identical** reasoning that kept `demo_sha256` nullable in Story 3.2 (the manual path can't set it at insert). So 3.3 stamps `parser_version` via `UPDATE demo SET parser_version=$1 WHERE id=$2` inside the parse transaction, and leaves the column nullable. *(Supersedes the 3.1 Dev-Notes line "`parser_version NOT NULL` lands in Story 3.3"; the acquired-but-unparsed state makes `NOT NULL` untenable — noted for the reviewer.)*

### Architecture patterns & invariants (must follow)

- **`Parsing` node only.** State machine `Acquiring → Hashing → Deduped → (AlreadyIngested | Parsing) → Validating → (Anomalous | Pending) → Approved` [Source: ARCHITECTURE-SPINE.md#Demo-ingest-lifecycle L277–297]. 3.1 did `Acquiring`; 3.2 did `Hashing`+`Deduped`+`AlreadyIngested`; **3.3 does `Parsing`** (per-SteamID64 rows). **Stop before `Validating`** — the conservation/roster/anomaly gate is Story 3.4.
- **AD-2 — single-writer derivation** [Source: ARCHITECTURE-SPINE.md#AD-2 L85–88]. The worker (service-role / owner connection) is the **only** writer of `demo` **and** `stat_row`; no anon/authenticated write policy or grant; the app has no stat-write path. "The worker writes rows and sets the anomaly flag; the *accept-anomaly* and *approve* decisions are admin actions on the app side" — i.e. 3.3 writes; 3.4/4.6 decide.
- **AD-3 — idempotent ingestion** [Source: ARCHITECTURE-SPINE.md#AD-3 L90–93; #Consistency-Conventions L232]. `stat_row` is `UNIQUE(match_id, steamid64)`; re-parse is `INSERT … ON CONFLICT (match_id, steamid64) DO UPDATE` (+ a delete of SteamIDs absent from the new parse — that delete is **Story 3.6**, but the DELETE grant lands here). 3.3 builds the upsert; the transactional revert→reparse→republish is 3.6.
- **AD-4 — SteamID64 is the sole canonical join key** [Source: ARCHITECTURE-SPINE.md#AD-4 L95–98]. `stat_row.steamid64` is `text CHECK (~ '^[0-9]{17}$')`, and is **NOT a FK** — "a parsed SteamID64 not in the roster lands in an 'unreconciled' list (left-join), never silently dropped." So 3.3 writes **every** parsed SteamID64 (unmatched ones included); flagging the unreconciled ones to the admin list is Story 3.4/2.6. Precedent: `stat_snapshot_row.steamid64` is already a non-FK captured value [Source: canonical_steamid64_invariant_test.sql L41–49].
- **AD-26 — off-request, bounded, pinned** [Source: ARCHITECTURE-SPINE.md#AD-26 L205–208; SOLUTION-DESIGN.md §6 L333–336]. The **pinned** parser version (`v5.2.0`) is the durability lever against Valve format churn (raw demos retained → re-parse on upgrade). The **bounded async queue + capped retries/backoff + concurrency** is Story 3.8; 3.3 parses synchronously on the CLI (parse is ~3.4 s / ~257 MB RAM per the PoC — fine one-at-a-time on Railway Hobby; bounded concurrency in 3.8 stops N concurrent parses multiplying RAM).
- **AD-7 (structural now, behavior in 3.5)** [Source: ARCHITECTURE-SPINE.md#AD-7 L110–113; SOLUTION-DESIGN.md §4 L279–281]. Every table ships `ENABLE`+`FORCE` + at least one policy in its creating migration (the `0003` catalog guard bites otherwise). 3.3 ships `FORCE` + the **admin-only** `stat_admin` policy (like `demo`); the **viewer** `stat_view USING (status='approved')` + the anon/authenticated grant — the two-policy Pending-visibility model — is **Story 3.5**. Rows are written `status='pending'` (column default) here.
- **AD-1 — parse the retained source of truth** [Source: ARCHITECTURE-SPINE.md#AD-1 L80–83]. The parse reads the archived R2 object (`DemoStore.Get`), so it parses exactly the write-once bytes 3.2 hashed. Re-parse/rollback (3.6/4.7) touch only derived `stat_row` rows; the raw demo + its hash are never altered.
- **Module boundary** [Source: ARCHITECTURE-SPINE.md#Design-Paradigm L73–76]. No code-import edge between `worker/*` and `app/`+`lib/`. 3.3 is worker-only Go + a schema migration; the TS side is untouched (`git diff lib/ app/` must be empty).

### What 3.1 / 3.2 already built (do NOT rebuild — extend)

- **`Acquire` core** — `worker/ingest/ingest.go` `Acquire(ctx, store, rec, meta, r) (AcquireResult, error)`; tees the body into a `sha256` hasher while `Put` streams to R2, records via `rec.RecordDemo`, dedups + orphan-deletes on `AlreadyIngested`. Returns `AcquireResult{ StorageKey, SHA256, AlreadyIngested }`. **3.3 adds `DemoID` to this result** (the `demo` PK, for `stat_row.demo_id` provenance) and, on the CLI path, appends the `Get→Parse→RecordParse` step after a fresh acquire. [Source: worker/ingest/ingest.go:40–96]
- **`DemoRecorder` / `RecordDemo`** — `worker/db/db.go`; `PgxRecorder.RecordDemo` does `insert … on conflict (match_id, demo_sha256) do nothing returning storage_key`. **3.3 changes `returning storage_key` → `returning id, storage_key`** and adds `DemoID` to `RecordOutcome` (both the fresh and the `AlreadyIngested` fetch branches). Add the new `StatRecorder`/`PgxStatRecorder` alongside it. [Source: worker/db/db.go:30–107]
- **`FakeRecorder`** — `worker/db/fake.go`; in-memory `(MatchID,SHA256)→firstKey` dedup mirror. **3.3 makes it also return a fake `DemoID`** and adds a sibling `FakeStatRecorder`. [Source: worker/db/fake.go]
- **`DemoStore`** — `worker/store/store.go`; `Get(ctx, key) (io.ReadCloser, error)` already exists (the 3.1 AD-1 round-trip used it) — **3.3's parse reads the object back through it**. `FakeStore.Get` is map-backed + immediate. No store change needed. [Source: worker/store/store.go:36–50]
- **`RunCLI`** — `worker/ingest/cli.go`; opens the file, `checkDemHeader` (PBDEMS2), `Acquire`. **3.3 grows its signature** to accept a `Parser` + `StatRecorder` and appends the parse step. [Source: worker/ingest/cli.go:18–41]
- **`main.go` `build()`/`runIngest`** — constructs the R2 store + `PgxRecorder`. **3.3 also constructs `DemoinfocsParser` + `PgxStatRecorder`** and threads them into `RunCLI`. [Source: worker/main.go:52–98]
- **The MatchZy receiver + presign** (`server.go`) — **untouched** (HTTP-triggered parse is 3.8). [Source: worker/ingest/server.go]

### The migration (implement in `0007`)

```sql
-- supabase/migrations/0007_stat_row.sql — Story 3.3 (parse → stat_row; AD-2 single writer, AD-3 key)
-- SCOPE: create stat_row (the single-writer derived-stats table), UNIQUE(match_id, steamid64),
--   ENABLE+FORCE RLS + admin-only stat_admin SELECT, grant select/insert/update/DELETE to service_role.
-- OUT OF SCOPE: stat_row_match_fk (Epic 4 — no match table); viewer stat_view policy + anon/authenticated
--   SELECT grant (Story 3.5); demo.parser_version NOT NULL (set-on-parse, stays nullable — Decision 3);
--   the rich stat columns are created (nullable) but populated by Epic 5 (5.1–5.4); delete-missing +
--   parse_generation bump (Story 3.6). The parser fills only kills/deaths/rounds_played + provenance.
create table stat_row (
  id            bigint generated always as identity primary key,
  match_id      bigint not null,                                  -- FK -> match(id) DEFERRED to Epic 4
  steamid64     text not null check (steamid64 ~ '^[0-9]{17}$'),  -- AD-4; NOT a FK (unreconciled left-join)
  demo_id       bigint not null references demo(id) on delete restrict,  -- provenance: the parse that produced this row
  status        text not null default 'pending' check (status in ('pending','approved')),  -- AD-7
  kills int, deaths int, assists int,
  adr_damage int, rounds_played int,                              -- ADR computed in the Epic-5 leaderboard view
  hs_kills int, mvps int, flash_assists int, utility_damage int,
  kast_rounds int,
  knife_kills int, wallbang_kills int, through_smoke_kills int, no_scope_kills int, blind_kills int,
  entry_frags int, opening_deaths int, clutches jsonb,
  idle_dq boolean not null default false, idle_round_count int,
  approved_at timestamptz, approved_by text references player(steamid64),
  unique (match_id, steamid64)                                    -- AD-3; re-parse = ON CONFLICT DO UPDATE
);
create index stat_row_match_idx on public.stat_row (match_id);
alter table public.stat_row enable row level security;
alter table public.stat_row force  row level security;
create policy stat_admin on public.stat_row for select to authenticated using ((select public.is_admin()));
grant select, insert, update, delete on public.stat_row to service_role;   -- DELETE: Story 3.6 delete-missing
-- NO anon/authenticated grant, NO viewer stat_view policy yet (Story 3.5).
```

**Landmine — the `match_id` FK is deferred, not forgotten.** `stat_row.match_id` is a plain `bigint not null` because the `match` table does not exist until Epic 4 — the same pattern as `demo.match_id` (3.1), `tournament.final_match_id` (0001), `audit_log.target_match_id` (0003). Epic 4 must add **two** FKs when `match` lands: `demo_match_fk` (still pending from 3.1/3.2) **and** `stat_row_match_fk`. The `0007` pgTAP must positively prove the absence (a `match_id` with no matching row still inserts). [Source: SOLUTION-DESIGN.md §3 L133, L143; 3-1 Dev Notes "No forward FK".]

### The parse core (adapt the PoC — reference, not copy verbatim)

The PoC (`_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go`) is the proven toolchain reference — it parsed a real 170 MB `.dem` in 3.4 s and produced correct per-SteamID64 K/D + rounds. 3.3 adapts its **kills/deaths/rounds** subset into a structured `Parser` (drop the `text/tabwriter` printing, the weird/HS/damage stats, and the weapon breakdown — those are Epic 5):

```go
// worker/ingest/parse.go (sketch)
const ParserVersion = "demoinfocs-golang/v5 v5.2.0" // keep in lockstep with worker/go.mod

type PlayerStat struct{ SteamID64 uint64; Kills, Deaths int }
type ParseResult struct{ RoundsPlayed int; Players []PlayerStat }

type Parser interface{ Parse(r io.Reader) (ParseResult, error) }
type DemoinfocsParser struct{}

func (DemoinfocsParser) Parse(r io.Reader) (ParseResult, error) {
    p := dem.NewParser(r)                       // v5/pkg/demoinfocs
    defer p.Close()
    stats := map[uint64]*PlayerStat{}
    get := func(pl *common.Player) *PlayerStat { // skip nil / SteamID64==0 (bots/world)
        if pl == nil || pl.SteamID64 == 0 { return nil }
        s := stats[pl.SteamID64]; if s == nil { s = &PlayerStat{SteamID64: pl.SteamID64}; stats[pl.SteamID64] = s }
        return s
    }
    p.RegisterEventHandler(func(e events.Kill) {
        if p.GameState().IsWarmupPeriod() { return } // PoC skips warmup
        if k := get(e.Killer); k != nil { k.Kills++ }
        if v := get(e.Victim);  v != nil { v.Deaths++ }
    })
    if err := p.ParseToEnd(); err != nil { return ParseResult{}, fmt.Errorf("parse demo: %w", err) }
    // assemble Players sorted by SteamID64 (deterministic); RoundsPlayed = p.GameState().TotalRoundsPlayed()
}
```

Imports: `dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"`, `.../pkg/demoinfocs/common`, `.../pkg/demoinfocs/events` (the `/v5` suffix matters). [Source: research L145–166 (verified demoinfocs fields), Q5 L239–303; poc main.go L59–139; poc go.mod L5.]

### The `demo_id` provenance ripple (the widest blast radius)

`stat_row.demo_id NOT NULL references demo(id)` needs the `demo` row's PK — which `Acquire`/`RecordDemo` do **not** currently return. Thread it through: `RecordDemo` → `returning id, storage_key`; `RecordOutcome{ Inserted, ExistingKey, DemoID }`; `AcquireResult{ …, DemoID }`. Update `PgxRecorder`, `FakeRecorder`, and **every** test that calls `RecordDemo`/`Acquire`/`RunCLI` (`fake_test.go`, `ingest_test.go`, `server_test.go`, `cli_test.go`) so `go build ./...` is clean. This mirrors the Story-3.2 `DemoRecorder` `error → (RecordOutcome, error)` signature change — the same "widest ripple in the worker" pattern. [Source: 3-2 Dev Notes "DemoRecorder signature change ripples"; worker/db/db.go:82–89.]

### Env / secrets

**No net-new env.** Parsing is pure compute (`demoinfocs` + stdlib); the worker already has R2 + DB config from 3.1. `ParserVersion` is a pinned **Go constant** (not env) kept in lockstep with `go.mod`. `lib/env.ts` untouched (worker-only). [Source: worker/config/config.go; 3.1 File List.]

### Source tree — where things go

```
cs-tournament/
  supabase/migrations/0007_stat_row.sql        # NEW — stat_row table (full DDL, single-writer RLS)
  supabase/tests/0007_stat_row_test.sql         # NEW — pgTAP plan(N)
  worker/go.mod, worker/go.sum                   # EDIT — add demoinfocs-golang/v5 v5.2.0 (+ transitive)
  worker/ingest/parse.go                         # NEW — Parser iface + DemoinfocsParser + FakeParser + result types
  worker/ingest/parse_test.go                    # NEW — mapping + error-path tests
  worker/db/db.go                                # EDIT — StatRow + StatRecorder + PgxStatRecorder; RecordDemo returns DemoID
  worker/db/fake.go                              # EDIT — FakeStatRecorder + FakeRecorder returns DemoID
  worker/db/fake_test.go                         # EDIT — new signatures + upsert-idempotency
  worker/ingest/ingest.go                        # EDIT — AcquireResult.DemoID
  worker/ingest/cli.go                           # EDIT — RunCLI gains Parser+StatRecorder; Get→Parse→RecordParse on fresh acquire
  worker/ingest/{ingest,cli,server}_test.go      # EDIT — thread DemoID; CLI parse + AlreadyIngested-skip cases
  worker/main.go                                 # EDIT — build DemoinfocsParser + PgxStatRecorder; log parsed counts
```
No TS change. No `demoinfocs` import outside `worker/ingest/parse.go`. [Repo recon confirms the 3.1/3.2 worker layout.]

### Testing standards

- **Go:** stdlib `testing` + `go test ./...`. Keep `Parser`, `StatRecorder`, `DemoStore`, `DemoRecorder` **injectable** (fakes) — the write/wiring path is fully unit-tested with a `FakeParser` (no real `.dem`). Add: the `PlayerStat→StatRow` mapping (SteamID64 uint64→17-digit string), upsert-idempotency, the `AlreadyIngested`-skips-parse case, and fail-closed on `parser.Err`/`statRec.Err`. One test drives the **real** `DemoinfocsParser` error path (invalid stream) so it is not shipped unexercised; its real happy-path correctness is the live-QA gate.
- **pgTAP:** explicit `plan(N)` (retro action #5); `0007` proves the table/constraint/CHECK/FK/grant matrix + FORCE + `stat_admin` present + **no** `stat_view` yet + the deferred `match` FK absent. `supabase test db` across all suites (Files 7 → 8). Confirm `canonical_steamid64_invariant_test.sql` + the `0003` FORCE-guard auto-cover `stat_row` and stay green.
- **TS:** unchanged — assert `vitest run` stays at **110** and `git diff lib/ app/` is empty (guard against accidental TS edits).
- **Green bar:** `go build`/`go vet`/`gofmt -l` clean; `go test ./...` grows; `next build` clean; `supabase test db` Files 8.

### Regression / boundary notes

- **`RecordDemo`/`AcquireResult` signature change ripples** to `PgxRecorder`, `FakeRecorder`, and every worker test — the widest blast radius (mirrors 3.2). Update all call sites so `go build ./...` is clean.
- **Do NOT** touch `lib/ingest.ts`, `app/api/ingest/register/route.ts`, or any Epic-2 TS surface — 3.3 is worker + migration only.
- **Do NOT** add a parse call to `handleMatchZy` — HTTP-triggered parse is Story 3.8. The CLI is the only parse trigger in 3.3.
- **Do NOT** compute anything beyond kills/deaths/rounds_played — assists, ADR, HS%, MVPs, weird/derived/idle are Epic 5 (Decision 1). The columns exist (nullable); leave them NULL.
- **Do NOT** validate/gate the parse (Σkills==Σdeaths, roster, non-zero, `Anomalous`) — Story 3.4. Write rows unconditionally with `status` defaulting to `pending`.
- **Railway RAM:** demoinfocs holds ~257 MB of state on a 170 MB demo (PoC). Fine one-at-a-time on the CLI; bounded concurrency (3.8) prevents N concurrent parses multiplying it. Stream from `DemoStore.Get` — do not read the whole `.dem` into a `[]byte`.
- **Failed-parse-then-re-run boundary (known, not a bug):** if a fresh acquire succeeds but the parse then fails, the `demo` row + R2 object persist (acquired, `parser_version` NULL, no `stat_row`) — do **not** delete them (AD-1 write-once). A CLI re-run of the same `.dem` hits `AlreadyIngested` and **skips** parse (Task 4), so it does **not** auto-recover. That is intentional for this slice: recovery from a `ParseFailed` demo is Story 3.8's **bounded retry** and Story 3.6's **deliberate re-parse**. Return the parse error fail-closed (no partial success claim); don't add ad-hoc retry here.

### Deferred items to (re)log at review

- **`stat_row_match_fk`** (and the still-pending `demo_match_fk`) → **Epic 4** (add both when `match` lands).
- **Rich stat derivation** (core/weird/derived/idle) → **Epic 5** (5.1–5.4); the columns are ready, no migration needed.
- **Validation/anomaly gate + unreconciled-SteamID64 flagging** → **Story 3.4** (which then unblocks Story 2.6 per the deferred-work re-sequencing).
- **Viewer `stat_view` policy + anon/authenticated SELECT grant + Pending/`Pendiente` label** → **Story 3.5**.
- **Bounded async queue + retry/backoff + MatchZy-HTTP-triggered parse** → **Story 3.8**.
- **Re-parse revert→reparse→republish + delete-missing SteamIDs + `parse_generation` bump** → **Stories 3.6 / 4.7**.
- Note the interim at review: after 3.3, only the **CLI** path parses; the MatchZy auto path stores+hashes but does not yet parse (Story 3.8). And `demo.parser_version` stays nullable (Decision 3, superseding 3.1's "NOT NULL in 3.3" note).

### References

- [Source: epics.md#Story-3.3 L495–515] — the three AC threads (single-writer / parse-to-rows / idempotency key) + traces FR-12 · AD-2, AD-3, AD-26.
- [Source: epics.md#Epic-3 L442–444; #Story-3.4 L517–537 (validation is 3.4); #Story-3.5 L539–559 (Pending is 3.5); #Story-3.8 L606–626 (async queue is 3.8)] — the epic scope + the 3.3/3.4/3.5/3.8 boundaries.
- [Source: epics.md#Epic-5 L823–901 (5.1 core / 5.2 weird / 5.3 derived / 5.4 AFK-idle)] — where the rich derivation lives (Decision 1).
- [Source: ARCHITECTURE-SPINE.md#AD-2 L85–88; #AD-3 L90–93; #AD-4 L95–98; #AD-1 L80–83; #AD-7 L110–113; #AD-26 L205–208; #ingest-state-machine L277–297; #STAT_ROW-ERD L378–386; #Consistency-Conventions L232] — invariants + the `Parsing` node + the ERD.
- [Source: SOLUTION-DESIGN.md §3 L141–156 (stat_row DDL) + L258–260 (indexes) + L133 (deferred match FK); §4 L279–281 (stat_row two-policy RLS); §6 L322–348 (ingest pipeline, parse job, AFK/idle deferred)] — the target schema + RLS + pipeline.
- [Source: prd.md FR-12 (parse demo → normalized per-player stat rows keyed by match_id + SteamID64)] — the product requirement.
- [Source: research/technical-cs2-demo-parsing-research-2026-06-29.md L145–166 (verified demoinfocs fields, SteamID64 join key), Q5 L239–303 (PoC results, conservation 126==126); poc-cs2-demo-parse/main.go L59–139 (Kill/warmup/TotalRoundsPlayed pattern); poc go.mod L5 (v5.2.0, /v5 suffix)] — the parser proof + the exact API to adapt.
- [Source: worker/ingest/ingest.go (Acquire, AcquireResult); worker/db/db.go (DemoRecorder, RecordDemo, RecordOutcome); worker/db/fake.go; worker/store/store.go (DemoStore.Get); worker/ingest/cli.go (RunCLI); worker/ingest/server.go (untouched); worker/main.go (build/runIngest); worker/config/config.go] — the exact code 3.3 edits/extends.
- [Source: supabase/migrations/0005_demo.sql + 0006_demo_hash_dedup.sql; tests/0005_demo_test.sql, 0006_demo_hash_dedup_test.sql, canonical_steamid64_invariant_test.sql (L9–11 name-drops stat_row; L41–49 the non-FK steamid64 precedent), 0003 generic FORCE-guard] — what 0007 extends + the tests it must keep green.
- [Source: 3-1-demo-acquisition-that-bypasses-vercel.md (worker baseline, forward-FK precedent, "parser_version NOT NULL lands in 3.3" — superseded by Decision 3); 3-2-hash-dedup-and-write-once-retention.md (nullable-shell reasoning, tee/streaming discipline, the DemoRecorder signature-ripple pattern)] — the acquisition/hash baseline this parse slice builds on.
- [Source: deferred-work.md — 2.6 re-sequenced to after Story 3.4 (unblocked once stat_row exists + is flagged); 3.1 live-QA IPv6/pooler infra finding (local-verify posture for Task 7)] — the downstream unblock + the live-QA infra constraint.
- [Precedents: 0005_demo.sql / 0004_roster.sql + their pgTAP (grant/constraint/policy assertion style); the Epic-2/3 injectable-seam fake pattern (`HttpPost` → `DemoStore`/`DemoRecorder` → now `Parser`/`StatRecorder`).]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code — BMad `dev-story` workflow), 2026-07-11.

### Debug Log References

- `go get github.com/markus-wa/demoinfocs-golang/v5@v5.2.0 && go mod tidy` pulled the exact PoC transitive set (`golang/geo`, `golang/snappy`, `go-unassert`, `gobitread`, `godispatch`, `quickhull-go/v2`, `oklog/ulid/v2`, `pkg/errors`, `golang.org/x/exp`, `google.golang.org/protobuf`) and bumped `golang.org/x/sync` 0.17→0.19 + `golang.org/x/text` 0.29→0.34 (demoinfocs requirement) — no other direct-dep churn.
- Verified the **real** `DemoinfocsParser.Parse` returns a *wrapped error* (not a panic) on a corrupt/truncated stream (`TestDemoinfocsParserRejectsCorruptStream`) — so no `recover` is needed and a corrupt retained object fails closed rather than crashing the worker.
- `supabase db reset` applied `0001→0007` cleanly; `supabase test db` → **Files 8, 252 tests, PASS** (the `0007` suite is `plan(36)`; `canonical_steamid64_invariant` + the `0003` generic FORCE-guard auto-cover `stat_row` and stayed green).

### Completion Notes List

**Tasks 1–6 complete; whole bar green. Task 7 (live-QA) is the pending human gate — see below.**

- **Migration `0007_stat_row.sql`** — `stat_row` with the FULL SOLUTION-DESIGN §3 column set (every stat column nullable — Epic 5 enriches with no further migration), `UNIQUE(match_id, steamid64)` (the AD-3 re-parse key), `demo_id bigint not null references demo(id)`, `match_id` a plain `bigint not null` (**match FK deferred to Epic 4**), `steamid64 text CHECK (~ 17-digit)` **non-FK** (AD-4), `ENABLE`+`FORCE` RLS, admin-only `stat_admin` SELECT (dormant), `grant … delete on stat_row to service_role` (**DELETE granted** for Story-3.6 delete-missing — unlike `demo`), no anon/authenticated grant. pgTAP `0007_stat_row_test.sql` `plan(36)` proves the constraint/CHECK/FK/grant matrix incl. the two distinctive facts (a no-match `match_id` still inserts; `service_role` CAN delete).
- **Parser** — `worker/ingest/parse.go`: `demoinfocs-golang/v5 v5.2.0` (first import), `Parser` interface + `DemoinfocsParser` (adapts the PoC's kills/deaths/rounds subset — skips nil/`SteamID64==0` + warmup, deterministic sort by SteamID64) + `FakeParser` seam + `const ParserVersion`. Fills **only** K/D/rounds — the rich FR-18/19/20/21 derivation is Epic 5.
- **Writer + `demo_id` ripple** — `StatRow` + `StatRecorder`/`PgxStatRecorder` (one-transaction `update demo set parser_version` + `INSERT … ON CONFLICT (match_id, steamid64) DO UPDATE`, via `pgx.Batch`; empty-rows still stamps + commits). `RecordDemo` now `returning id, storage_key`; `DemoID` added to `RecordOutcome` + `AcquireResult` (set in `Acquire`). Because `DemoID` is **additive** inside those structs, the `DemoRecorder` interface signature is unchanged — only the `RunCLI`-signature callers actually broke (narrower than 3.2's `RecordDemo` ripple). `FakeStatRecorder` (in-memory upsert mirror) + `FakeRecorder` monotonic `DemoID`.
- **CLI wiring** — `RunCLI` gains `Parser` + `StatRecorder` and returns `CLIResult{ AcquireResult; Parsed; Players; Rounds }`; on a fresh acquire it `store.Get`s the retained object back (AD-1) → `parser.Parse` → maps `PlayerStat`→`db.StatRow` (uint64→17-digit text at the call site) → `RecordParse`. `AlreadyIngested` **skips** the parse. `main.go` `runIngest` builds `DemoinfocsParser` + `PgxStatRecorder` (sharing `rec.Pool()`) and logs the parsed counts. `server.go` (MatchZy/presign) **untouched** — HTTP-triggered parse is Story 3.8.
- **Green bar** — Go `build`/`vet`/`gofmt` clean, `go test ./...` 43 test funcs pass; `supabase test db` Files 8 / 252; `vitest run` unchanged at 110; `git diff lib/ app/` empty; `next build` clean.
- **Reviewer note (Decision 3):** `demo.parser_version` stays **nullable**, stamped on parse via `UPDATE demo SET parser_version` — this **supersedes** Story 3.1's "`parser_version NOT NULL` lands in 3.3" note (the acquired-but-unparsed state makes NOT NULL untenable; same reasoning that kept `demo_sha256` nullable in 3.2).
- **Deferred items re-logged at review:** `stat_row_match_fk` + the still-pending `demo_match_fk` → Epic 4; rich stat derivation (core/weird/derived/idle) → Epic 5 (columns ready, no migration); validation/anomaly gate + unreconciled-SteamID64 flagging → Story 3.4 (then unblocks 2.6); viewer `stat_view` policy + anon/authenticated SELECT + Pending/`Pendiente` label → Story 3.5; bounded async queue + retry/backoff + MatchZy-HTTP-triggered parse → Story 3.8; re-parse revert→reparse→republish + delete-missing + `parse_generation` bump → Stories 3.6/4.7. Interim: only the **CLI** path parses; the MatchZy auto path still stores+hashes but does not yet parse (3.8).
- **⛔ Task 7 — live-QA (human gate, PENDING Cuatro):** the dev agent structurally cannot run it (needs the real `cuatro-luisito.dem` + real `R2_*` creds + the local Supabase stack — DB writes against `127.0.0.1:54321` per the 3.1 IPv6/pooler finding). Everything above is built + green; Cuatro clears Task 7 to move `review → done`, exactly as the 3.1/3.2 rhythm.

### File List

**New**
- `supabase/migrations/0007_stat_row.sql` — the `stat_row` table (full DDL, UNIQUE(match_id, steamid64), single-writer RLS, DELETE grant, match FK deferred).
- `supabase/tests/0007_stat_row_test.sql` — pgTAP `plan(36)`.
- `worker/ingest/parse.go` — `Parser` iface + `DemoinfocsParser` + `FakeParser` + result types + `ParserVersion`.
- `worker/ingest/parse_test.go` — FakeParser echo + the real-parser error-path test.

**Modified**
- `worker/go.mod`, `worker/go.sum` — add `demoinfocs-golang/v5 v5.2.0` + transitive set.
- `worker/db/db.go` — `StatRow` + `StatRecorder`/`PgxStatRecorder`; `RecordDemo` returns `id`; `RecordOutcome.DemoID`; `PgxRecorder.Pool()`; package doc.
- `worker/db/fake.go` — `FakeStatRecorder`; `FakeRecorder` returns a monotonic `DemoID`.
- `worker/db/fake_test.go` — FakeStatRecorder idempotency + FakeRecorder DemoID tests.
- `worker/ingest/ingest.go` — `AcquireResult.DemoID` set in `Acquire`.
- `worker/ingest/ingest_test.go` — DemoID provenance assertions.
- `worker/ingest/cli.go` — `RunCLI` gains `Parser`+`StatRecorder`; `CLIResult`; Get→Parse→RecordParse on fresh acquire; AlreadyIngested skips parse.
- `worker/ingest/cli_test.go` — new signature; parse/upsert + AlreadyIngested-skip + fail-closed tests.
- `worker/main.go` — `runIngest` builds `DemoinfocsParser` + `PgxStatRecorder` (shared pool), logs parsed counts; mode doc.

*(Process tracking, not implementation: `_bmad-output/implementation-artifacts/3-3-*.md` (this file) + `sprint-status.yaml`.)*

## Change Log

| Date       | Change |
|------------|--------|
| 2026-07-11 | **Task 7 live-QA PASS (Cuatro sign-off) `in-progress → done`.** Ran `worker ingest` on the real `cuatro-luisito.dem` (31,005,788 B, sha `fd28235d…a8215e`, decompressed from `demos/cuatro-luisito.dem.gz`) against the local Supabase stack (`127.0.0.1:54322`) + the real R2 bucket. Fresh parse → **2 players / 15 rounds**; `stat_row` = one row per 17-digit SteamID64 (`76561198388441171` 10/6, `76561199176839714` 6/10), `demo_id=39` + `parser_version="demoinfocs-golang/v5 v5.2.0"` stamped, `status='pending'`; **Σkills 16 == Σdeaths 16** (pre-stages the 3.4 conservation gate). Re-run → `already_ingested=true`, no re-parse, counts unchanged. QA cleanup done (R2 object + local rows deleted). The D1 skip-guard correctly stayed silent (all ids valid). Epic 3 (CAP-3) now **3/8 done** (3.1+3.2+3.3). |
| 2026-07-11 | Code review (bmad-code-review) `review → in-progress`. 3 adversarial layers (Blind Hunter · Edge Case Hunter · Acceptance Auditor, all Opus 4.8); no Critical/High, AC1–AC5 satisfied, no out-of-scope leakage, migration faithful to SOLUTION-DESIGN §3, pgTAP `plan(36)` accurate. 2 decision-needed resolved → **2 patches applied** (Cuatro, Option A ×2): (D1) Go-side non-17-digit `SteamID64` skip+log guard at the `RunCLI` mapping site (mirrors the `stat_row` CHECK so one phantom id no longer rolls back the whole match) + `TestRunCLISkipsMalformedSteamID`; (D2) `defer/recover` in `DemoinfocsParser.Parse` (parser panic → wrapped fail-closed error; also protects the 3.8 HTTP path). 2 deferred (`parser_version` `RowsAffected` latent → 3.8; 0K/0D-player no-row → 3.4/live-QA; both in `deferred-work.md`), 6 dismissed (incl. 2 blind-layer false alarms verified against `store.go`/`0001`). Green bar re-verified (go build/vet/gofmt/test clean). Moved to `in-progress` (patches changed code) — **Task 7 live-QA remains the pending human gate** (Cuatro; real `.dem` + `R2_*`, local-verify) → clears to `done`, per the 3.1/3.2 rhythm. |
| 2026-07-11 | Story 3.3 implemented (in-progress → review) via dev-story. Migration `0007_stat_row.sql` (stat_row full DDL, UNIQUE(match_id, steamid64), demo_id FK, match FK deferred to Epic 4, single-writer RLS + service_role DELETE grant) + pgTAP `plan(36)`. Added `demoinfocs-golang/v5 v5.2.0` (first import) + a `Parser`/`DemoinfocsParser`/`FakeParser` parse core (kills/deaths/rounds only). `StatRow`+`StatRecorder`/`PgxStatRecorder` one-transaction upsert (ON CONFLICT DO UPDATE + parser_version stamp). The `demo_id` provenance ripple: `RecordDemo` returns `id`, `DemoID` added to `RecordOutcome`+`AcquireResult` (additive → only RunCLI callers broke). `RunCLI` gains `Parser`+`StatRecorder` and returns `CLIResult`; reads the retained object back (AD-1) → parse → upsert, skipping parse on AlreadyIngested; `main.go` wires it on the CLI path (MatchZy/async stay 3.8). Green bar: Go 43 test funcs + vet/gofmt clean, `supabase test db` Files 8/252, `vitest` 110 unchanged, `git diff lib/ app/` empty, `next build` clean. `demo.parser_version` stays nullable set-on-parse (supersedes 3.1's NOT-NULL note — Decision 3). Task 7 live-QA is the pending human gate (Cuatro). |
| 2026-07-11 | Story 3.3 created (ready-for-dev). Exhaustive context engineering: epics/architecture/SOLUTION-DESIGN + 3.1/3.2 stories + the full worker source + the demo-parsing PoC analyzed. Three decisions resolved with Cuatro during creation: (1) parser fills K/D/rounds only — rich derivation is Epic 5, but the full stat_row DDL is created now; (2) parse wired on the CLI path — MatchZy-HTTP trigger + async queue are Story 3.8; (3) demo.parser_version stays nullable, set-on-parse (supersedes 3.1's NOT-NULL note). Scope = the `Parsing` node: migration 0007 (stat_row, UNIQUE(match_id, steamid64), single-writer RLS, match FK deferred to Epic 4), demoinfocs v5.2.0 parse core, the stat_row upsert writer + the demo_id provenance ripple, CLI wiring, Go+pgTAP tests. Task 7 live-QA is a pending human gate. |
