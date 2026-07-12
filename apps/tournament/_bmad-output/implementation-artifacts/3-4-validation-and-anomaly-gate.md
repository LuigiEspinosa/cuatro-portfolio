---
baseline_commit: 70d94bc4740ea364ca931828de9e82efceb4de92
---

# Story 3.4: Validation and anomaly gate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **admin**,
I want parsed matches that fail **conservation, non-zero-rows, or roster-reconciliation** checks **held for review** (flagged `Anomalous`, logged) instead of silently proceeding,
so that **suspect stats never auto-publish** and **every parsed SteamID64 not on the roster is surfaced**, never silently dropped.

**This is the fourth story of Epic 3 — it slots the `Validating` node into the ingest state machine.** Story 3.1 acquired the bytes (`Acquiring`), 3.2 hashed + deduped them (`Hashing → Deduped → AlreadyIngested`), 3.3 parsed them to `stat_row` (`Parsing`) writing rows **unconditionally** (`status='pending'`). Story 3.4 adds the gate that runs **after** parse and **before** anything can be published: it computes the three validation checks over the just-parsed rows, and on any failure **flags the match `Anomalous`** (persisted on the `demo` row) with machine-readable reasons, **logged, never silent**. It also ships the **unreconciled-stat-rows read surface** (the folded-in Story 2.6 data layer). It stops **before** the Pending two-policy viewer model (Story 3.5), the admin *accept-anomaly* / *Aprobar* command routes (Epic 4), and the bounded async queue + MatchZy-HTTP trigger (Story 3.8).

The scope is a **thin, provable worker+migration slice**, consistent with the rest of Epic 3: it adds the validation compute, its persistence, and the derived unreconciled view — it does **not** build any admin UI or app-side mutation surface.

## Acceptance Criteria

> Restated from `epics.md#Story 3.4` (lines 517–537), elaborated with the three decisions Cuatro resolved during story creation (see **Dev Notes → Resolved Decisions**). Traces: **FR-12 · AD-2, AD-4** (+ FR-2 for the unreconciled surface, per the FR Coverage Map `epics.md:138`).

**AC1 — The worker computes the three validation gates on every fresh parse (AD-2, FR-12).**
Immediately after a fresh parse produces the per-player rows (Story 3.3) and before the parse transaction commits, the worker computes, over exactly those rows:
1. **Conservation** — `Σkills == Σdeaths` summed across all rows of the match (every kill is exactly one death in a completed CS2 match).
2. **Non-zero stat rows** — the parse produced **≥ 1** stat row (a successful parse that yields **zero** player rows — an empty/broken/warmup-only demo — fails this gate). *(This is the literal reading of the spine's `0-stat` / SOLUTION-DESIGN's `0-stat-row`; see Resolved Decision 4.)*
3. **Roster reconciliation** — **every** `stat_row.steamid64` is present in the **active roster** (`roster_entry.status='active'`). Any parsed SteamID64 absent from the roster fails this gate, and each offending id is captured in the reason payload.
The gate runs in the worker (service-role), the single writer (AD-2) — no app code path performs it.

**AC2 — Any gate failure holds the match `Anomalous` (persisted + logged); it is not auto-published (AD-2).**
If **any** of the three gates fails, the worker **stamps the `demo` row** `validation_state='anomalous'` with `anomaly_reasons` (a machine-readable jsonb array of `{gate, detail}`) and `validated_at=now()`, **in the same transaction** that upserts the stat rows + stamps `parser_version` (all-or-nothing). The anomaly is **logged** (`warn`, never silent). If all three gates pass, the worker stamps `validation_state='pending'` (clean — not held), `anomaly_reasons=NULL`, `validated_at=now()`. **The stat rows are still written either way** (`status='pending'`; anomaly is a *hold flag* on the demo, not a write-block — SOLUTION-DESIGN §6: *"rows written, match stays Pending, admin must accept — logged"*). Nothing auto-publishes: the admin *accept-anomaly* action and the *Aprobar* publish that would advance an anomalous or clean-pending match are **out of scope here** and owned by Epic 4 (see Resolved Decision 3) — and no publish path exists in Epic 3 at all, so the "not published" guarantee holds by construction.

**AC3 — An unreconciled SteamID64 is surfaced to the admin, never silently dropped (AD-4, FR-2, Story 2.6).**
A parsed SteamID64 absent from the roster (i) has its `stat_row` **still written** (3.3 already writes every id — `steamid64` is a non-FK canonical key, AD-4), (ii) **fails the AC1 roster gate → flags the match `Anomalous`** (AC2), and (iii) **appears in the admin `unreconciled_stat_row` read surface** — a migration-created SQL view (`stat_row LEFT JOIN roster_entry` on the shared SteamID64 key) exposing `(match_id, steamid64, demo_id)` for every stat row with no active roster match. Reconciliation stays **mechanical**: adding that SteamID64 to the roster (Story 2.5's existing `adminAddPlayer` path) makes the previously-orphaned rows join automatically via the shared FK-less key — no rewrite (see Resolved Decision 2). The admin one-tap reconcile **UI** is deferred to the app-surface epic; 3.4 delivers only the **data surface**.

**AC4 — Migration `0008` + pgTAP; the schema teeth bite.**
`supabase/migrations/0008_demo_validation.sql` (a) **ALTERs `demo`** to add `validation_state text not null default 'pending' check (validation_state in ('pending','anomalous'))`, `anomaly_reasons jsonb`, `validated_at timestamptz`; and (b) creates the admin-only `unreconciled_stat_row` view (`security_invoker=on`; `grant select … to service_role` only — **no** anon/authenticated grant, mirroring `stat_row`/`demo`). **No new grant on `demo`** is needed (service_role already holds UPDATE from 0005). A new `supabase/tests/0008_demo_validation_test.sql` with explicit `plan(N)` proves the CHECK/default/nullability + the view's row logic (unrostered id appears; active-rostered id does not; a `removed` roster entry still appears) + the view's grant matrix. `supabase test db` stays green (Files 8 → 9); the `0003` generic FORCE-guard and `canonical_steamid64_invariant_test.sql` stay green.

**AC5 — Validation wired into the CLI parse path; module boundary + TS untouched.**
`worker ingest <path.dem> --match <id>` now, on a fresh acquire, runs `parse → validate → record` in one flow: it reads the active roster, computes the gates, and records the stat rows **plus** the validation outcome in one transaction. `AlreadyIngested` still short-circuits (no re-parse, no re-validate — the prior ingest already validated). The MatchZy-HTTP-triggered parse+validate and the bounded async queue remain **Story 3.8** (not wired here). No TS change (`git diff lib/ app/` empty; `vitest run` unchanged); no new `NEXT_PUBLIC_*`; no net-new env name.

### Out of scope (do NOT build here)

- **The admin *accept-anomaly* action** (`Anomalous → Pending: admin accepts, logged`) and **the *Aprobar* publish** (`Pending → Approved`) — **Epic 4** (audited admin command routes, AD-8; Aprobar is Story 4.6). 3.4 only *sets* the flag the worker owns (AD-2); the app-side *decisions* are Epic 4. (Resolved Decision 3.)
- **The Story 2.6 admin reconcile UI / one-tap linkage affordance / any client Data-API surface for the view** — the app-surface epic. 3.4 ships only the `unreconciled_stat_row` data surface + confirms linkage is mechanical (2.5's roster-add path). (Resolved Decision 2.)
- **The Pending two-policy viewer model** — the viewer `stat_view USING (status='approved')` policy + the anon/authenticated SELECT grant + the `Pendiente` label → **Story 3.5**. (Anomaly and pending/approved are orthogonal axes; both fail closed for viewers regardless.)
- **Rich stat derivation** (assists, ADR, HS%, MVPs, flash/utility, KAST, weird/derived/idle) → **Epic 5** (5.1–5.4). 3.4 validates only over `kills`/`deaths` (conservation) + row presence + steamid64 (roster) — the fields 3.3 fills.
- **The bounded async queue + retry/backoff + MatchZy-HTTP-triggered parse+validate** → **Story 3.8**. 3.4 validates synchronously on the CLI path only (same boundary 3.3 held).
- **Re-parse revert→reparse→republish** (which re-runs validation) → **Stories 3.6 / 4.7**. 3.4 validates the first parse; 3.6/3.8 reuse the same `Validate` core.
- **`match`→`tournament` scoping of the roster / unreconciled join** → **Epic 4** (when `match` links to `tournament`). v1 is single-tournament, so the active roster is the whole `roster_entry.status='active'` set (see Dev Notes → The roster read). No `match_id` FK still (Epic 4).
- **An alert-to-admin channel** (paging/`admin:<id>` notification for anomalies) → **Epic 7 ops**. 3.4 emits a structured `warn` log line — that IS the "never silent" surface for a casual event.
- **A `demo.validation_state` index** — a friends tournament is tens of matches; skip the index (note it as an optional Epic-5/ops optimization if the held-list query ever matters).

## Tasks / Subtasks

- [x] **Task 1 — Migration `0008_demo_validation.sql` + pgTAP (AC2, AC3, AC4)**
  - [x] Create `supabase/migrations/0008_demo_validation.sql`. Header-comment style of `0005`/`0006`/`0007`: a SCOPE block (ALTER `demo` for the validation-hold columns; create the `unreconciled_stat_row` view = the Story-2.6 data surface) and an explicit **OUT OF SCOPE** block (accept-anomaly / Aprobar routes → Epic 4; reconcile UI + client Data-API view access → app-surface epic; `stat_view` viewer policy → Story 3.5; `demo_match_fk`/`stat_row_match_fk` → Epic 4; match→tournament roster scoping → Epic 4).
  - [x] `alter table public.demo add column validation_state text not null default 'pending' check (validation_state in ('pending','anomalous')), add column anomaly_reasons jsonb, add column validated_at timestamptz;` — comment that `'pending'` covers BOTH "not yet validated" (`validated_at IS NULL`) and "validated + clean" (`validated_at` set), while `'anomalous'` is the held state; this is the **ingest anomaly-hold axis**, distinct from `stat_row.status`'s **publish axis** (pending/approved). **No new grant** — service_role already holds `update` on `demo` (0005). RLS unchanged (demo is already ENABLE+FORCE + admin-only read).
  - [x] `create view public.unreconciled_stat_row with (security_invoker = on) as select s.match_id, s.steamid64, s.demo_id from public.stat_row s left join public.roster_entry r on r.steamid64 = s.steamid64 and r.status = 'active' where r.id is null;` Then `grant select on public.unreconciled_stat_row to service_role;` — **no** anon/authenticated grant (admin reads it via a service-role server route, exactly like `stat_row`/`demo`; the Epic-5 admin UI consumes it that way). `security_invoker=on` makes the caller's privileges apply (service_role BYPASSRLS reads the underlying tables; anon/authenticated 42501 at the view grant gate — fail closed). Comment that the join is on `steamid64` alone because v1 is single-tournament; Epic 4 scopes it to the match's tournament when `match` links `tournament`.
  - [x] Create `supabase/tests/0008_demo_validation_test.sql` with explicit `plan(N)`, mirroring the `0007_stat_row_test.sql` role-switch + assertion-accounting style:
    - `demo.validation_state` exists, is `NOT NULL`, defaults `'pending'`; the CHECK **rejects** an out-of-set value (`throws_ok '23514'`) and **accepts** `'anomalous'`; `anomaly_reasons` is `jsonb` and nullable; `validated_at` is `timestamptz` and nullable.
    - service_role **CAN** `update demo set validation_state='anomalous', anomaly_reasons='[…]'::jsonb, validated_at=now()` (the grant is genuinely usable — the worker write path).
    - The `unreconciled_stat_row` view exists; seed one `demo` + a rostered vs. an unrostered `stat_row` (+ a `removed` roster entry) and assert: an unrostered id **appears**; an `active`-rostered id **does not**; a `removed`-roster id **still appears** (removed ≠ active). *(Seed a `season`+`tournament`+`player`+`roster_entry` fixture per the 0004/0001 FK chain; follow the seeding pattern the roster/demo tests use.)*
    - Grants: `has_table_privilege('service_role','public.unreconciled_stat_row','SELECT') = true`; `anon` and `authenticated` = `false` (fail closed).
    - `supabase db reset` applies `0001→0008` cleanly; `supabase test db` Files 8 → 9; the `0003` generic FORCE-guard + `canonical_steamid64_invariant_test.sql` stay green (views are not base tables — FORCE-guard unaffected; `demo` stays FORCE).

- [x] **Task 2 — The validation core (AC1)**
  - [x] `worker/ingest/validate.go`: a pure `Validate(result ParseResult, rows []db.StatRow, roster map[string]struct{}) db.ValidationOutcome` that computes the three gates and returns `{Anomalous bool, Reasons []db.AnomalyReason}` (see Dev Notes → The validation core for the sketch). Gates: (1) `Σkills != Σdeaths` → reason `{gate:"conservation", detail:"Σkills=… Σdeaths=… delta=…"}`; (2) `len(rows) == 0` → reason `{gate:"empty_stats", detail:"parse produced no stat rows"}`; (3) any `rows[i].SteamID64 ∉ roster` → reason `{gate:"unreconciled", detail:"<comma-joined offending 17-digit ids>"}`. `Anomalous = len(Reasons) > 0`. Deterministic reason order (conservation, empty_stats, unreconciled) and sorted offending ids so logs/tests are stable.
  - [x] Define the persisted shapes in `worker/db/db.go` (they are DB-serialized): `type AnomalyReason struct { Gate string \`json:"gate"\`; Detail string \`json:"detail"\` }` and `type ValidationOutcome struct { Anomalous bool; Reasons []AnomalyReason }`. Keeping them in `db` lets `RecordParse` marshal `Reasons` to jsonb without an ingest→db type leak in the other direction (ingest already imports db).
  - [x] Unit-test `Validate` (`worker/ingest/validate_test.go`): all-clean → `Anomalous=false`, no reasons; imbalanced K/D → conservation reason; empty rows → empty_stats reason; an id not in `roster` → unreconciled reason listing exactly that id; multiple simultaneous failures → all reasons present, deterministic order.

- [x] **Task 3 — Roster reader + the demo-validation writer (AC1, AC2)**
  - [x] `worker/db/db.go`: add a `RosterReader` interface `ActiveSteamIDs(ctx) (map[string]struct{}, error)` and `PgxRosterReader` (borrow the shared pool via `PgxRecorder.Pool()`, same pattern as `PgxStatRecorder`) running `select steamid64 from roster_entry where status = 'active'` into a set. Injectable for tests. *(v1 single-tournament: no `tournament_id` filter — see Dev Notes.)*
  - [x] Extend `StatRecorder.RecordParse` to also persist the validation outcome **in the existing parse transaction**: change the signature to `RecordParse(ctx, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error`, and change the `demo` stamp from `update demo set parser_version=$1 where id=$2` to `update demo set parser_version=$1, validation_state=$2, anomaly_reasons=$3, validated_at=now() where id=$4` where `$2 = 'anomalous'` if `val.Anomalous` else `'pending'` and `$3 =` the marshaled `val.Reasons` jsonb (**NULL** when `!val.Anomalous`, i.e. no reasons). Rows are still upserted unconditionally (unchanged from 3.3); the empty-rows branch still commits (now stamping the validation outcome — an empty parse is `anomalous` via gate 2). Keep it all-or-nothing (the existing `defer tx.Rollback`).
  - [x] `worker/db/fake.go`: add `FakeRosterReader` (a settable `map[string]struct{}` + an `Err` seam) and extend `FakeStatRecorder` to capture the `ValidationOutcome` passed to `RecordParse` (so `cli_test` asserts the flag + reasons). Update the `RecordParse` fake signature.

- [x] **Task 4 — Wire validate into the CLI parse path (AC5)**
  - [x] `worker/ingest/cli.go` `RunCLI`: add a `roster db.RosterReader` parameter. After building `rows` (the existing 3.3 mapping, incl. the D1 non-17-digit skip-guard), before `RecordParse`: `rosterSet, err := roster.ActiveSteamIDs(ctx)` (fail-closed on error — do not record a parse we couldn't validate); `val := Validate(result, rows, rosterSet)`; if `val.Anomalous` log a `warn` line naming the match + the reasons (`log.Printf("warn: match %d ANOMALOUS: %v", matchID, val.Reasons)`); call `statRec.RecordParse(ctx, acq.DemoID, ParserVersion, rows, val)`. Extend `CLIResult` with `Anomalous bool` + `Reasons []db.AnomalyReason` for the caller's log.
  - [x] `worker/main.go` `runIngest`: construct `db.NewPgxRosterReader(rec.Pool())` and pass it to `RunCLI`; log the outcome (e.g. `… -> stat_row (validation=pending)` vs `… ANOMALOUS: [conservation …]`). `build()` unchanged. The MatchZy receiver / presign (`server.go`) stays **untouched** — HTTP-triggered validate is Story 3.8.

- [x] **Task 5 — Tests + green-bar (AC1–AC5)**
  - [x] `worker/ingest/cli_test.go`: a fresh CLI ingest with a `FakeRosterReader` seeded with the parsed ids → `RecordParse` called once with `val.Anomalous=false`, `validation_state` effectively `pending`; a run where a parsed id is **absent** from the roster → `val.Anomalous=true` with an `unreconciled` reason; an imbalanced `FakeParser` result → `conservation` reason; an empty parse → `empty_stats` reason; `roster.Err` → the CLI returns the error and does **not** call `RecordParse` (fail closed); `AlreadyIngested` re-run → no parse, no validate, no `RecordParse` (unchanged 3.3 short-circuit).
  - [x] `worker/db/*_test.go`: `FakeRosterReader` behavior; `FakeStatRecorder` captures the `ValidationOutcome`; thread the new `RecordParse` signature through every caller so `go build ./...` is clean.
  - [x] Whole bar green: `cd worker && go build ./... && go vet ./... && gofmt -l .` clean; `go test ./...` all packages pass (grows from 3.3's count). `supabase test db` green with `0008` added (**Files 9**). `vitest run` **unchanged**; `git diff lib/ app/` **empty**; `next build` clean. No `NEXT_PUBLIC_*` leak; `lib/env.ts` untouched.

- [x] **Task 6 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy still Epic 7)** ✅ **SIGNED OFF (Cuatro, 2026-07-11).** Ran end-to-end vs the real `cuatro-luisito.dem` (31,005,788 B, `sha256 fd28235d…a8215e`) + real R2 + the local Supabase stack (`127.0.0.1:54322`). All scenarios PASS; QA artifacts cleaned up (R2 objects deleted + local rows/fixture cleared). Clears `review → done`.
  - [x] **Prereq — the roster fixture:** seed the standing `season`+`tournament` (open action-item #5) and a `roster_entry (status='active')` for the two QA SteamID64s (`76561198388441171`, `76561199176839714` from the 3.3 QA). Real `cuatro-luisito.dem` (31,005,788-byte `PBDEMS2`, `sha256 fd28235d…a8215e`), real `R2_*`; DB writes against the **local** Supabase stack (`127.0.0.1:54322`, per the 3.1 IPv6/pooler finding).
  - [x] **Clean parse (all gates pass):** `worker ingest cuatro-luisito.dem --match <id>` with both ids rostered → `stat_row` written (2 rows, `status='pending'`); `demo.validation_state='pending'`, `anomaly_reasons IS NULL`, `validated_at` set; `Σkills 16 == Σdeaths 16` (the 3.3 QA already showed this) so **no** conservation flag; log shows `validation=pending`.
  - [x] **Anomalous parse (roster gate):** remove one QA id from the roster (or ingest a different match id whose players are not rostered) → `demo.validation_state='anomalous'`; `anomaly_reasons` contains an `unreconciled` entry naming the missing id; the `warn` log fires; `select * from unreconciled_stat_row` **lists** that `(match_id, steamid64, demo_id)`. Re-add the id to the roster → the row disappears from the view (mechanical reconcile — no re-parse).
  - [x] **Conservation sanity:** confirm the clean match's `select sum(kills)=sum(deaths) from stat_row where match_id=<id>` holds; note that the 3.3 D1 skip-guard (a dropped non-17-digit id) would surface here as a `conservation` anomaly — the intended safety net.
  - [x] **Idempotency:** a re-run → `already_ingested=true`, no re-parse, no re-validate; `demo.validation_state` unchanged.
  - [x] **QA cleanup:** delete the test R2 object(s); clear the local `stat_row`/`demo` test rows and the QA roster fixture edits.
  - [ ] **Deferred to Epic 7 (unchanged):** live Railway deploy + rented MatchZy server; the worker hosted-DB IPv4/pooler gap (3.1 finding). Local-verify is exactly what Task 6 specifies.

### Review Findings

_Code review 2026-07-11 (bmad-code-review; 3 adversarial layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor, all Opus 4.8). The Acceptance Auditor verified **AC1–AC5 + AD-2/AD-7/fail-closed all satisfied, no scope creep**; the deliberately-deferred items are correctly absent. Findings below are correctness/quality only. 1 finding dismissed as noise (fail-closed roster-read leaving a demo persisted-but-unvalidated on a rare roster-DB blip — by-design fail-closed; recovery is the already-deferred Story 3.6/3.8 re-parse; the same fail-closed-after-acquire pattern 3.3 established)._

**Resolution (2026-07-11, Cuatro):** the conservation-gate finding is **deferred** — keep the spec-mandated `==`, verify at Task 6 live-QA (see the Defer bullet below + `deferred-work.md`). All **4 patches were applied + verified green**: worker `go build`/`vet`/`gofmt`/`test ./...` clean; `supabase test db` **Files 9 / Tests 280** PASS (was 278; +2 from P4); `git diff lib app` empty. The story stays in `review` pending the Task 6 live-QA sign-off (the documented review→done gate).

- [x] [Review][Defer] Conservation gate `Σkills != Σdeaths` false-positives on unattributed deaths — [worker/ingest/validate.go:27] The gate holds ANY match where `Σkills ≠ Σdeaths` as `anomalous`, but the 3.3 parser ([parse.go:85-95](worker/ingest/parse.go#L85-L95)) increments a killer's `Kills` only for a real account (`get()` drops nil / `SteamID64==0` = world/bot) while ALWAYS incrementing the victim's `Deaths`. So any fall / suicide / world / bomb death → `Σkills < Σdeaths` → a legitimate match is held. In CS2 `Σkills ≤ Σdeaths` always, so the gate conflates the IMPOSSIBLE direction (`Σk > Σd` = a real parse double-count) with the NORMAL direction (`Σk < Σd` = unattributed deaths). Spec AC1 mandates literal `==`, so relaxing it needs a human call. [blind+edge, confirmed vs parse.go] **→ DEFERRED (Cuatro 2026-07-11):** keep the spec-mandated `==`; verify conservation tolerance against real demos at **Task 6 live-QA** (3.3 QA showed 16==16). Relax to `Σkills > Σdeaths` (flag only the impossible over-count direction) **only if** unattributed-death imbalance proves routine on real demos. Bots would perturb both directions — another reason to decide empirically at live-QA.
- [x] [Review][Patch] `security_invoker=on` pgTAP assertion did not bite — was `reloptions like '%security_invoker%'` (matches both `on` and `off`). **✅ APPLIED 2026-07-11:** changed to a regex `~ 'security_invoker=(on|true)'` — robust to PG's on/true normalization, correctly fails on off/false [supabase/tests/0008_demo_validation_test.sql:74]
- [x] [Review][Patch] `RecordParse` persisted jsonb `null` (not SQL NULL) when `Anomalous && len(Reasons)==0`. **✅ APPLIED 2026-07-11:** guarded the marshal with `len(val.Reasons) > 0` — state flag stays authoritative, payload is a clean SQL NULL (latent; `RecordParse` is a reusable seam for 3.6/3.8) [worker/db/db.go:104]
- [x] [Review][Patch] `validate.go` doc overstated the skip-guard "safety net". **✅ APPLIED 2026-07-11:** softened to a PARTIAL net — a dropped malformed id only trips conservation if its `K≠D` [worker/ingest/validate.go:21]
- [x] [Review][Patch] pgTAP proved column nullability but not type. **✅ APPLIED 2026-07-11:** added `col_type_is` for `anomaly_reasons`=jsonb + `validated_at`=timestamptz; `plan(26)→plan(28)`, Tests 278→280 [supabase/tests/0008_demo_validation_test.sql:41]

## Dev Notes

### Resolved Decisions (Cuatro, 2026-07-11, during story creation — build for these)

1. **⭐ The `Anomalous` hold + reasons persist as three columns on `demo` (migration 0008), NOT a new table or a `stat_row.status` value.** *(Chosen over a `demo_validation` side table and over overloading `stat_row.status`.)*
   *Why:* there is **no `match` table** until Epic 4, and the end-state schema (`SOLUTION-DESIGN §3`) models the anomaly hold **nowhere** — `demo` has no state column, `stat_row.status` is `pending/approved` only, and the planned `match.state` enum is bracket-lifecycle (`declared/live/pending/resolved/…`), never `anomalous`. The `demo` row is the **per-parse ingest anchor** — one demo = one parse = one validation run — and the worker **already `UPDATE`s it** (the `parser_version` stamp, 3.3), so adding the flag there is zero new grant, zero new table, one `ALTER`. It also matches how `0005→0006→0007` evolved the *same row* (nullable shells filled as the pipeline advances). A side table is over-normalized for a casual friends event; a `stat_row.status='anomalous'` value would conflate the **match-level hold** with the **per-row publish axis** (a row is anomalous *and* pending). `validation_state ∈ {'pending','anomalous'}` (default `'pending'`) is the anomaly-hold axis; `validated_at IS NULL` distinguishes not-yet-validated from validated-clean; `stat_row.status` remains the orthogonal publish axis.

2. **⭐ Story 2.6 (unreconciled list) folds in as the DATA SURFACE ONLY — the `unreconciled_stat_row` view — not the admin reconcile UI.** *(Chosen over building the full 2.6 admin route now, and over deferring 2.6 entirely.)*
   *Why:* the open action-item (`sprint-status.yaml` epic-2 #6 / deferred-work 2026-07-06) folds 2.6 into 3.4 because 2.6 had **no data source** until `stat_row` existed (3.3) and is flagged (3.4). But the project is **backend-first** (no viewer/admin UI built in any epic yet), so the substantive, in-character deliverable is the derived **left-join surface** the admin UI will later read — `stat_row LEFT JOIN roster_entry`, admin/service-role-only, exactly the shape the 2.6 analysis established (AD-4 "unreconciled list (left-join)", `stat_row.steamid64` deliberately non-FK so unmatched ids are insertable). Reconciliation is **mechanical** — Story 2.5's `adminAddPlayer` already attaches orphaned stats via the shared FK-less join key, so no rewrite. The one-tap **UI** is squarely the app-surface epic's job. Marking 2.6 substantively satisfied by the data layer keeps 3.4 a clean worker+migration slice.

3. **⭐ The admin *accept-anomaly* action + *Aprobar* publish are OUT of scope — 3.4 is the worker half only.** *(Chosen over building a thin accept-anomaly server route now.)*
   *Why:* AD-2 (`SPINE:88`) is explicit — *"the worker writes rows and **sets the anomaly flag**; the accept-anomaly and approve decisions (FR-13) are admin actions **on the app side**, never the worker."* The state-machine edges `Anomalous → Pending: admin accepts` and `Pending → Approved: admin Aprobar` are **audited admin command routes** (AD-8), the same family as advance/forfeit/rollback — **all Epic 4** (Aprobar = Story 4.6). There is **no publish path in Epic 3 at all**, so "suspect stats never auto-publish" (AC2) holds *by construction* the moment the worker declines to auto-advance — which it never could. 3.4 delivers the durable half: compute + persist + log + surface. Epic 4's routes consume the `demo.validation_state` flag the worker sets here.

4. **Gate-2 semantics = "the parse produced ≥ 1 stat row" (empty parse → anomalous).** The spine says `0-stat`, SOLUTION-DESIGN says `0-stat-row`, the PRD says "one stat row per participating SteamID64" — the literal, defensible reading is **zero rows produced = anomalous** (a broken/empty/warmup-only demo). This is a spec detail, not a fork: build `len(rows)==0` as the gate. *(A stricter "Σkills==0 with rows present" check is plausible but implausible for a real CS2 match and would risk false positives on an odd short match — do not add it; conservation + roster already catch the realistic failure modes.)* Note the **3.3-deferred 0-kill/0-death-player** interaction: a rostered player who neither killed nor died in live rounds produces **no row** (the `get()`-in-Kill-handler sketch) — this does **not** trip any gate (they are in neither `Σkills` nor `Σdeaths`, and "not appearing" is not "unreconciled" — unreconciled is about ids that *did* produce a row but aren't rostered). Evaluate the Task-6 clean-parse player count with this in mind.

### Architecture patterns & invariants (must follow)

- **`Validating` node only.** State machine `Acquiring → Hashing → Deduped → (AlreadyIngested | Parsing) → Validating → (Anomalous | Pending) → Approved` [Source: ARCHITECTURE-SPINE.md#ingest-state-machine L277–297]. 3.1–3.3 built through `Parsing`; **3.4 does `Validating → (Anomalous | Pending)`**. The edges 3.4 owns: `Validating → Anomalous: kills!=deaths / 0-stat / unreconciled` and `Validating → Pending: checks pass`. **Stop before** `Anomalous → Pending` (admin accept) and `Pending → Approved` (Aprobar) — both Epic 4.
- **AD-2 — single-writer derivation** [Source: ARCHITECTURE-SPINE.md#AD-2 L85–88]. The worker (service-role/owner connection) is the only writer of `demo`+`stat_row` and **sets the anomaly flag**; the accept-anomaly/approve *decisions* are app-side (Epic 4). No app code path validates or writes the flag.
- **AD-4 — SteamID64 is the sole canonical join key** [Source: ARCHITECTURE-SPINE.md#AD-4 L95–98; SOLUTION-DESIGN §3 L144]. `stat_row.steamid64` is `text CHECK(~17-digit)` and **NOT a FK** — "a parsed SteamID64 not in the roster lands in an 'unreconciled' list (left-join), never silently dropped." The `unreconciled_stat_row` view **is** that left-join; the roster gate is what flags it.
- **AD-7 (orthogonal axis)** [Source: ARCHITECTURE-SPINE.md#AD-7 L110–113]. The Pending/Approved publish axis (`stat_row.status`) is Story 3.5's viewer model. `demo.validation_state` is a **separate** hold axis. An anomalous match's rows are `status='pending'` → invisible to viewers regardless once 3.5 lands; anomaly + pending both fail closed for viewers. Do not conflate the two.
- **Observability — never silent** [Source: SOLUTION-DESIGN §6 L341, ops L478]. "parse anomalies → admin alert + log; **never silent**." For this casual event the structured `warn` log line IS the surface; the paging/`admin:<id>` channel is Epic 7 ops.
- **AD-1 — validation reads only derived state** [Source: ARCHITECTURE-SPINE.md#AD-1 L80–83]. Validation is computed over the parsed rows + the roster; it never touches the raw demo bytes or its hash. Re-parse (3.6) re-runs the same `Validate` over the fresh rows.
- **Module boundary** [Source: ARCHITECTURE-SPINE.md#Design-Paradigm L73–76]. No code-import edge between `worker/*` and `app/`+`lib/`. 3.4 is worker-only Go + one migration; the TS side is untouched (`git diff lib/ app/` must be empty).
- **Single-tournament v1** [Source: AD-18; open action-item #5]. No `match`→`tournament` link exists (no `match` table), so "on the roster" = the single active `roster_entry` set. Documented forward-scope for Epic 4.

### What 3.1 / 3.2 / 3.3 already built (do NOT rebuild — extend)

- **The parse + CLI flow** — `worker/ingest/cli.go` `RunCLI(ctx, store, rec, parser, statRec, path, matchID)` already does, on a fresh acquire: `Get` the retained object → `parser.Parse` → map to `[]db.StatRow` (with the D1 non-17-digit skip-guard at `cli.go:91`) → `statRec.RecordParse`. **3.4 inserts `roster.ActiveSteamIDs` + `Validate` between the mapping and `RecordParse`, and grows `RecordParse` to carry the outcome.** [Source: worker/ingest/cli.go:33–111]
- **`PgxStatRecorder.RecordParse`** — `worker/db/db.go:162` already runs the one-transaction `update demo set parser_version=$1 where id=$2` + `ON CONFLICT (match_id, steamid64) DO UPDATE` batch upsert, committing even on empty rows. **3.4 widens the `demo` UPDATE to also set `validation_state`/`anomaly_reasons`/`validated_at`, and adds the `ValidationOutcome` param.** [Source: worker/db/db.go:134–206]
- **`PgxRecorder.Pool()`** — the shared-pool accessor `PgxStatRecorder` already borrows. **3.4's `PgxRosterReader` borrows the same pool** (identical pattern). [Source: worker/db/db.go:117–119, 143–154]
- **The `demo` table + service_role UPDATE grant** — 0005 created `demo` with `grant select, insert, update on demo to service_role`. **3.4's new columns need NO new grant** (UPDATE already covers them). demo is already ENABLE+FORCE + admin-only read — unchanged. [Source: supabase/migrations/0005_demo.sql:63]
- **`roster_entry`** — 0004 created it with `status ∈ {'active','removed'}` + `grant select … to service_role`. **3.4 reads `where status='active'`** (service_role SELECT already granted). [Source: supabase/migrations/0004_roster.sql:31–32, 75]
- **`FakeParser` / `FakeStore` / `FakeRecorder` / `FakeStatRecorder`** — the injectable seams. **3.4 adds `FakeRosterReader` + extends `FakeStatRecorder`** to capture the outcome. [Source: worker/ingest/parse.go:115; worker/db/fake.go]
- **The MatchZy receiver + presign** (`server.go`) — **untouched** (HTTP-triggered validate is 3.8). [Source: worker/ingest/server.go]

### The migration (implement in `0008`)

```sql
-- supabase/migrations/0008_demo_validation.sql — Story 3.4 (validation & anomaly gate)
-- SCOPE: (a) ALTER demo — the Validating-node hold axis: validation_state ('pending'|'anomalous'),
--   anomaly_reasons jsonb, validated_at. The worker sets these on the SAME demo row it stamps
--   parser_version (AD-2 single writer; service_role already holds UPDATE from 0005 — NO new grant).
--   (b) create the admin-only unreconciled_stat_row view = the Story-2.6 data surface (AD-4 left-join).
-- OUT OF SCOPE: accept-anomaly / Aprobar admin routes (Epic 4); reconcile UI + client Data-API view
--   access (app-surface epic); stat_view viewer policy + anon/authenticated grant (Story 3.5);
--   demo_match_fk / stat_row_match_fk + match->tournament roster scoping (Epic 4); a validation_state
--   index (tiny table — optional Epic-5/ops).

-- (a) demo: the ingest anomaly-hold axis (distinct from stat_row.status's publish axis).
--   'pending' + validated_at IS NULL  = parsed, not yet validated
--   'pending' + validated_at set       = validated & clean (may proceed toward Approved)
--   'anomalous'                        = a gate failed; held for admin accept (Epic 4), reasons in jsonb
alter table public.demo
  add column validation_state text not null default 'pending'
    check (validation_state in ('pending','anomalous')),
  add column anomaly_reasons  jsonb,
  add column validated_at      timestamptz;

-- (b) unreconciled_stat_row: every stat_row whose steamid64 is not on the ACTIVE roster (AD-4/FR-2).
--   security_invoker => the caller's grants/RLS apply. Admin reads it via a service-role server route
--   (like stat_row/demo) — NO anon/authenticated grant. v1 joins on steamid64 alone (single-tournament);
--   Epic 4 scopes to the match's tournament when match links tournament.
create view public.unreconciled_stat_row with (security_invoker = on) as
  select s.match_id, s.steamid64, s.demo_id
  from public.stat_row s
  left join public.roster_entry r
    on r.steamid64 = s.steamid64 and r.status = 'active'
  where r.id is null;
grant select on public.unreconciled_stat_row to service_role;
-- NO anon/authenticated grant (admin/worker-only until an app-surface story exposes it).
```

### The validation core (implement in `worker/ingest/validate.go`)

```go
// worker/ingest/validate.go (sketch)
// Validate computes the three AC1 gates over the just-parsed rows + the active roster set and returns the
// AD-2 anomaly outcome. Pure (no I/O): the caller reads the roster and persists the result. Deterministic
// reason order (conservation, empty_stats, unreconciled) + sorted offending ids => stable logs/tests.
func Validate(result ParseResult, rows []db.StatRow, roster map[string]struct{}) db.ValidationOutcome {
    var reasons []db.AnomalyReason

    // Gate 1 — conservation: Σkills == Σdeaths (every kill is one death in a completed match).
    var k, d int
    for _, r := range rows { k += r.Kills; d += r.Deaths }
    if k != d {
        reasons = append(reasons, db.AnomalyReason{Gate: "conservation",
            Detail: fmt.Sprintf("Σkills=%d Σdeaths=%d delta=%d", k, d, k-d)})
    }

    // Gate 2 — non-zero rows: an empty parse (0 rows) is anomalous (Resolved Decision 4).
    if len(rows) == 0 {
        reasons = append(reasons, db.AnomalyReason{Gate: "empty_stats", Detail: "parse produced no stat rows"})
    }

    // Gate 3 — roster reconciliation: every parsed SteamID64 must be on the active roster (AD-4/FR-2).
    var missing []string
    for _, r := range rows {
        if _, ok := roster[r.SteamID64]; !ok { missing = append(missing, r.SteamID64) }
    }
    if len(missing) > 0 {
        sort.Strings(missing)
        reasons = append(reasons, db.AnomalyReason{Gate: "unreconciled",
            Detail: strings.Join(missing, ",")})
    }

    return db.ValidationOutcome{Anomalous: len(reasons) > 0, Reasons: reasons}
}
```

`db.AnomalyReason{Gate, Detail}` + `db.ValidationOutcome{Anomalous, Reasons}` live in `worker/db/db.go` (they are DB-serialized). `RecordParse` marshals `val.Reasons` → jsonb (**NULL when `!val.Anomalous`**) and stamps `validation_state = 'anomalous'|'pending'` + `validated_at = now()` in the existing parse transaction.

### The roster read (single active tournament — v1)

`PgxRosterReader.ActiveSteamIDs` runs `select steamid64 from roster_entry where status = 'active'` and returns a `map[string]struct{}` set. **No `tournament_id` filter** — v1 is single-tournament (AD-18; the standing season+tournament fixture is open action-item #5) and there is **no `match`→`tournament` link** (no `match` table until Epic 4), so a match's SteamID64s can only be reconciled against the one active roster. **Forward-scope note for Epic 4:** when `match` links `tournament`, scope both the roster read and the `unreconciled_stat_row` view to the match's tournament. Fail closed: if the roster read errors, `RunCLI` returns the error and does **not** record a parse it could not validate.

### Env / secrets

**No net-new env.** Validation is pure compute + one `roster_entry` read on the existing pool; the worker already has R2 + DB config from 3.1. No new `NEXT_PUBLIC_*`; `lib/env.ts` untouched (worker-only). [Source: worker/config/config.go; 3.3 File List.]

### Source tree — where things go

```
cs-tournament/
  supabase/migrations/0008_demo_validation.sql   # NEW — ALTER demo (validation cols) + unreconciled_stat_row view
  supabase/tests/0008_demo_validation_test.sql    # NEW — pgTAP plan(N)
  worker/ingest/validate.go                        # NEW — Validate(): the three gates
  worker/ingest/validate_test.go                   # NEW — gate unit tests
  worker/db/db.go                                  # EDIT — AnomalyReason + ValidationOutcome; RosterReader + PgxRosterReader; RecordParse gains the outcome + widens the demo UPDATE
  worker/db/fake.go                                # EDIT — FakeRosterReader; FakeStatRecorder captures the outcome
  worker/db/fake_test.go                           # EDIT — new signatures + roster/outcome assertions
  worker/ingest/cli.go                             # EDIT — RunCLI gains RosterReader; read roster -> Validate -> log -> RecordParse; CLIResult.Anomalous/Reasons
  worker/ingest/cli_test.go                        # EDIT — clean / conservation / empty / unreconciled / roster-err / AlreadyIngested cases
  worker/main.go                                   # EDIT — runIngest builds PgxRosterReader; logs validation outcome
```
No TS change. No new import outside `worker/`. [Repo recon confirms the 3.3 worker layout.]

### Testing standards

- **Go:** stdlib `testing` + `go test ./...`. Keep `Parser`, `StatRecorder`, `RosterReader`, `DemoStore`, `DemoRecorder` injectable. `Validate` is pure — unit-test each gate + combinations directly (no DB). `cli_test` drives the wired path with fakes: clean, each anomaly kind, roster-read error (fail closed → no `RecordParse`), `AlreadyIngested` skip.
- **pgTAP:** explicit `plan(N)` (retro action #5). `0008` proves the `demo` column CHECK/default/nullability + service_role UPDATE usability + the view's row logic (unrostered appears / active does not / removed still appears) + the view grant matrix. `supabase test db` Files 8 → 9; `0003` FORCE-guard + `canonical_steamid64_invariant` stay green.
- **TS:** unchanged — assert `vitest run` is unchanged and `git diff lib/ app/` is empty (guard against accidental TS edits).
- **Green bar:** `go build`/`go vet`/`gofmt -l` clean; `go test ./...` grows; `next build` clean; `supabase test db` Files 9.

### Regression / boundary notes

- **`RecordParse` signature change** ripples to `PgxStatRecorder`, `FakeStatRecorder`, and every `RunCLI`/`RecordParse` test caller — update all so `go build ./...` is clean (narrower than 3.3's `demo_id` ripple: additive param).
- **Rows are still written unconditionally** (`status='pending'`) — anomaly is a *hold flag on `demo`*, not a write-block (SOLUTION-DESIGN §6). Do **not** gate the `stat_row` upsert on validation; the upsert and the flag are one transaction.
- **`AlreadyIngested` short-circuits before validate** (unchanged 3.3 flow) — a re-upload does not re-validate; the prior ingest already set the flag. Deliberate re-parse (3.6) re-runs `Validate`.
- **Do NOT** build the accept-anomaly / Aprobar routes, any admin UI, or a client Data-API path for the view — Epic 4 / app-surface epic (Resolved Decisions 2, 3).
- **Do NOT** add a `stat_view` viewer policy or an anon/authenticated grant on `stat_row`/`unreconciled_stat_row` — Story 3.5 owns the viewer model.
- **Do NOT** touch `server.go`/`handleMatchZy` — HTTP-triggered validate is Story 3.8.
- **Do NOT** compute anything beyond the three gates — no rich-stat validation (Epic 5).

### Deferred items to (re)log at review

- **Accept-anomaly + Aprobar admin command routes** (`Anomalous→Pending`, `Pending→Approved`, audited, AD-8) → **Epic 4** (Aprobar = 4.6).
- **Story 2.6 admin reconcile UI / one-tap linkage affordance / client Data-API view access** → **app-surface epic**. 3.4 marks 2.6 substantively done (data surface); flip `2-6-...` in sprint-status from `deferred` accordingly at review (or note the UI remainder).
- **match→tournament scoping** of the roster read + the `unreconciled_stat_row` view → **Epic 4** (when `match` links `tournament`).
- **Alert-to-admin channel** for anomalies (beyond the `warn` log) → **Epic 7 ops**.
- **The 3.3-deferred `parser_version` `RowsAffected` check** (`worker/db/db.go`) — still → **Story 3.8**; the `demo` UPDATE in `RecordParse` now also stamps validation, so the same optional `RowsAffected()==1` hardening applies to the widened UPDATE (still unreachable in the CLI wiring — `acq.DemoID` is a fresh PK).
- **Viewer `stat_view` policy + Pending/`Pendiente` label** → **Story 3.5** (unchanged).

### References

- [Source: epics.md#Story-3.4 L517–537] — the three AC threads (validation gates / Anomalous hold / unreconciled) + traces FR-12 · AD-2, AD-4.
- [Source: epics.md#Epic-3 L442–444; #Story-3.3 L495–515; #Story-3.5 L539–559; #Story-2.6 L422–438; FR-Coverage-Map L138 (FR-2 = 3.4), L148 (FR-12 = 3.3,3.4)] — the epic scope + the 3.3/3.4/3.5 boundaries + the 2.6 fold-in target.
- [Source: ARCHITECTURE-SPINE.md#ingest-state-machine L277–297 (Validating→Anomalous/Pending edges); #AD-2 L85–88 (worker sets the anomaly flag); #AD-4 L95–98 (unreconciled left-join); #AD-7 L110–113 (publish axis); #Consistency-Conventions L233 (anomalies flagged, never auto-published); #ERD MATCH/DEMO/STAT_ROW L359–386] — the invariants + the `Validating` node + the ERD (which models no anomaly column → Resolved Decision 1).
- [Source: SOLUTION-DESIGN.md §3 L93–156 (demo/match/stat_row DDL — match.state enum has no 'anomalous'); §6 L322–348 (ingest pipeline, State machine: "Validation gate: conservation, 0-stat-row, unreconciled → Anomalous (rows written, match stays Pending, admin must accept — logged)"); ops L478 (anomalies → alert + log, never silent)] — the authoritative validation-gate spec + the "rows written / held" model.
- [Source: prd.md FR-2 L135–142 (unreconciled stat rows list: SteamID64 + source Match, excluded until reconciled); FR-12 L219–238 (one row per SteamID64; conservation Σkills==Σdeaths); FR-13 L240–246 (staged Pending→Approved, admin-only)] — the product requirements.
- [Source: worker/ingest/cli.go:33–111 (RunCLI parse flow + the D1 skip-guard); worker/db/db.go:117–206 (Pool(), StatRow, RecordParse one-tx); worker/ingest/parse.go (ParseResult/PlayerStat); worker/ingest/ingest.go (AcquireResult); worker/main.go:82–106 (runIngest wiring); worker/db/fake.go (fakes)] — the exact code 3.4 edits/extends.
- [Source: supabase/migrations/0004_roster.sql:26–35,75 (roster_entry status + service_role SELECT); 0005_demo.sql:24–63 (demo table + service_role UPDATE grant — no new grant needed); 0007_stat_row.sql (stat_row shape); tests/0007_stat_row_test.sql (the pgTAP role-switch + assertion-accounting style to mirror); 0003 generic FORCE-guard; canonical_steamid64_invariant_test.sql] — what 0008 extends + the tests it keeps green.
- [Source: 3-3-parse-the-demo-to-stat-rows-as-the-single-writer.md (the Parsing baseline; Decision 1 K/D-only scope feeds conservation; the D1 non-17-digit skip-guard → conservation net; the deferred 0K/0D-player-no-row note → Resolved Decision 4); deferred-work.md 2026-07-06 (2.6 re-sequenced to after 3.4, unreconciled = left-join, reconcile mechanical) + 2026-07-11 (3.3 deferrals: parser_version RowsAffected → 3.8; 0K/0D player → 3.4)] — the previous-story intelligence + the folded-in 2.6 analysis.
- [Source: sprint-status.yaml action_items epic-2 #6 (fold 2.6 into 3.4), epic-2 #7 (roster-lock TOCTOU → Epic 4), epic-2 #9 (seed standing season+tournament — the Task-6 roster fixture prereq)] — the open items 3.4 touches.
- [Precedents: the Epic-2/3 injectable-seam fake pattern (`HttpPost` → `DemoStore`/`DemoRecorder`/`Parser`/`StatRecorder` → now `RosterReader`); the 0004/0005/0007 pgTAP grant/constraint/policy assertion style.]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) — bmad-dev-story workflow.

### Debug Log References

Green bar (2026-07-11, local dev, Tasks 1–5):
- `supabase db reset` — migrations `0001→0008` apply cleanly.
- `supabase test db` — **Files=9, Tests=278, Result: PASS** (`0008_demo_validation_test.sql` plan(26) green; the `0003` generic FORCE-guard + `canonical_steamid64_invariant_test.sql` stay green — a view is `relkind='v'`, not covered by the base-table FORCE-guard, and the view keys on `steamid64`, not `display_name`).
- `worker`: `go build ./...` + `go vet ./...` clean; `gofmt -l .` clean (auto-fmt'd `cli_test.go`); `go test ./...` — all packages pass (`worker`, `worker/db`, `worker/ingest`, `worker/config`, `worker/store`).
- TS untouched (worker-only story): `git diff --stat -- lib app` **empty**; `npm run test` (vitest) **11 files / 110 tests pass, unchanged**; `npm run build` (next build) compiles + TypeScript clean. No `NEXT_PUBLIC_*` / `lib/env.ts` touched.

### Completion Notes List

Implemented the `Validating → (Anomalous | Pending)` node (Tasks 1–5); **Task 6 live-QA is a PENDING human gate** (needs the real `.dem` + `R2_*` creds + a standing season/tournament/roster fixture — open action-item #9 — that the dev agent cannot run). Highlights:
- **Migration `0008`** ALTERs `demo` with the anomaly-hold axis (`validation_state ∈ {'pending','anomalous'}` default `'pending'`, `anomaly_reasons jsonb`, `validated_at`) — **no new grant** (service_role already holds UPDATE from 0005) — and creates the admin-only `unreconciled_stat_row` `security_invoker=on` view (service_role SELECT only; the Story-2.6 AD-4 left-join data surface). pgTAP proves the CHECK/default/nullability, the service_role write path, the view's row logic (unrostered appears / active-rostered does not / **removed-rostered still appears**), the grant matrix, and `security_invoker`.
- **`Validate()`** (`worker/ingest/validate.go`) — pure, three gates: conservation (Σkills==Σdeaths), empty_stats (≥1 row), unreconciled (every parsed SteamID64 on the active roster). Deterministic reason order + sorted offending ids. `db.AnomalyReason`/`db.ValidationOutcome` live in `db` (DB-serialized to jsonb).
- **Single-writer persistence** — `RecordParse` widened to stamp `validation_state`/`anomaly_reasons` (`$3::jsonb`, NULL when clean)/`validated_at=now()` on the `demo` row **in the same tx** as the stat-row upsert (all-or-nothing). Rows are written **unconditionally** — the anomaly is a hold flag, never a write-block.
- **Roster read** — `PgxRosterReader.ActiveSteamIDs` reads `roster_entry.status='active'` (no `tournament_id` filter — single-tournament v1). Injected into `RunCLI`; **fail closed** — a roster-read error returns without recording an unvalidated parse. `AlreadyIngested` still short-circuits before validate.
- **CLI/wiring** — `RunCLI` gains a `db.RosterReader` param + `CLIResult.Anomalous/Reasons`; on anomaly it logs a structured `warn` line (never silent). `main.go runIngest` constructs `NewPgxRosterReader(rec.Pool())` and logs `validation=pending` vs `ANOMALOUS (held)`. `server.go`/MatchZy untouched (HTTP-triggered validate is Story 3.8).

**Boundary discipline held:** no accept-anomaly/Aprobar routes (Epic 4), no reconcile UI / client Data-API view access (app-surface epic), no `stat_view` viewer policy (Story 3.5), no `server.go` change (Story 3.8), no rich-stat validation (Epic 5).

### File List

New:
- `supabase/migrations/0008_demo_validation.sql`
- `supabase/tests/0008_demo_validation_test.sql`
- `worker/ingest/validate.go`
- `worker/ingest/validate_test.go`

Modified:
- `worker/db/db.go` — `AnomalyReason` + `ValidationOutcome` types; `RosterReader` + `PgxRosterReader`; `RecordParse` gains the `ValidationOutcome` param and widens the `demo` UPDATE (validation_state/anomaly_reasons/validated_at); `encoding/json` import.
- `worker/db/fake.go` — `FakeRosterReader`; `FakeStatRecorder` captures the `ValidationOutcome` (new `RecordParseCall.Val`); updated `RecordParse` fake signature.
- `worker/db/fake_test.go` — threaded the new `RecordParse` signature; added `FakeStatRecorder`-captures-outcome + `FakeRosterReader` tests.
- `worker/ingest/cli.go` — `RunCLI` gains `roster db.RosterReader`; read roster → `Validate` → warn-log → widened `RecordParse`; `CLIResult.Anomalous/Reasons`.
- `worker/ingest/cli_test.go` — threaded the roster through every `RunCLI`; balanced `cannedParse` (clean baseline); added conservation / unreconciled / empty-parse / roster-read-error cases.
- `worker/main.go` — `runIngest` builds `PgxRosterReader`, passes it to `RunCLI`, logs the validation outcome.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status ready-for-dev → in-progress → review.

## Change Log

| Date       | Change |
|------------|--------|
| 2026-07-11 | Story 3.4 created (ready-for-dev). Exhaustive context engineering: epics/architecture/SOLUTION-DESIGN/PRD + the 3.1/3.2/3.3 stories + the full worker source + the 0004/0005/0007 migrations + deferred-work analyzed. **Key finding:** the architecture models the `Anomalous` state in the state machine but **nowhere in the physical schema** (no `match` table until Epic 4; `demo` has no state column; `stat_row.status` is pending/approved; the planned `match.state` enum omits 'anomalous'). Three decisions resolved with Cuatro during creation: (1) persist the anomaly hold as three columns on `demo` (migration 0008: `validation_state`/`anomaly_reasons`/`validated_at`) — not a side table, not a `stat_row.status` value; (2) fold Story 2.6 in as the **data surface only** (the `unreconciled_stat_row` view), reconcile UI deferred to the app-surface epic; (3) the admin *accept-anomaly* + *Aprobar* routes are **Epic 4** — 3.4 is the worker half (compute + persist + log + surface). Scope = the `Validating` node: migration 0008 (ALTER demo + unreconciled view), the pure `Validate()` three-gate core (Σkills==Σdeaths, ≥1 row, roster reconciliation), a `RosterReader` + the widened `RecordParse` (validation outcome in the parse transaction), CLI wiring, Go + pgTAP tests. Task 6 live-QA is a pending human gate (needs the real `.dem` + `R2_*` + a roster fixture). |
| 2026-07-11 | Story 3.4 implemented Tasks 1–5 (ready-for-dev → in-progress → review) via bmad-dev-story. Migration `0008` (ALTER demo: validation_state/anomaly_reasons/validated_at + the `unreconciled_stat_row` security_invoker view, service_role-only) + pgTAP `plan(26)`; the pure `Validate()` three-gate core (conservation / empty_stats / unreconciled) with `db.AnomalyReason`/`db.ValidationOutcome`; `RosterReader` + `PgxRosterReader` (active-roster read, fail-closed); `RecordParse` widened to stamp the validation outcome in the parse tx (rows still written unconditionally — anomaly is a hold flag); `RunCLI`/`main.go` wired (roster → Validate → warn-log → record) with `server.go` untouched. Green bar: `supabase test db` Files 9 (278 tests); `go build/vet`/`gofmt`/`go test ./...` clean; vitest 110 unchanged; `git diff lib app` empty; `next build` clean. Task 6 live-QA remains a pending human gate (Cuatro). |
| 2026-07-11 | Story 3.4 code-review via bmad-code-review (3 adversarial layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor, Opus 4.8) → stays in `review` pending Task 6 live-QA. Acceptance Auditor verified AC1–AC5 + AD-2/AD-7/fail-closed satisfied, no scope creep; no Critical/High. **1 decision-needed → deferred** (Cuatro): strict `Σkills==Σdeaths` conservation gate false-positives on unattributed deaths (fall/suicide/world/bomb → `Σk<Σd`; confirmed vs `parse.go`) — keep spec `==`, verify at Task 6 live-QA, relax to `Σk>Σd` only if imbalance proves routine (logged in `deferred-work.md`). **4 patches applied + verified green:** P1 `security_invoker` pgTAP assertion now bites (regex `~ 'security_invoker=(on\|true)'`); P2 `RecordParse` guards `json.Marshal` with `len(Reasons)>0` (SQL NULL not jsonb `null`); P3 softened the skip-guard "safety net" comment; P4 added `col_type_is` jsonb/timestamptz (`plan 26→28`). 1 dismissed (fail-closed roster-read = by-design; recovery is deferred 3.6/3.8). Re-verified post-patch: worker `go build/vet/gofmt/test ./...` clean; `supabase test db` Files 9 / **Tests 280** PASS; `git diff lib app` empty. baseline_commit 70d94bc. |
| 2026-07-11 | Story 3.4 **Task 6 live-QA SIGNED OFF (Cuatro)** → `review` → `done`. Ran the real `cuatro-luisito.dem` (31,005,788 B, sha `fd28235d…a8215e`) + real R2 + local Supabase (127.0.0.1:54322). PASS: (1) clean parse `--match 700` → `validation_state=pending`, 2 rows `pending`, `validated_at` set, `anomaly_reasons` NULL, `Σkills 16==Σdeaths 16`, `unreconciled_stat_row` empty; (2) anomalous parse `--match 701` (same demo/new match = fresh parse, one id unrostered) → `validation_state=anomalous`, `anomaly_reasons=[{unreconciled, 76561199176839714}]`, `warn` log fired, view listed `(701, …839714, demo_id)`; (3) live view reconcile — removing the id surfaced match-700's row live, re-adding cleared both, match-701's stored `anomalous` flag persisted (live view ≠ stored hold); (4) conservation 16==16 (real demo balances — backs the deferred `==` decision); (5) idempotency re-run `--match 700` → `already_ingested`, counts/state unchanged. Cleanup: both R2 objects deleted (verified GONE) + all local QA rows/fixture cleared. Story 2.6 data surface (`unreconciled_stat_row` view) confirmed working end-to-end; UI remainder stays deferred to the app-surface epic (action-item epic-2 #6). |

