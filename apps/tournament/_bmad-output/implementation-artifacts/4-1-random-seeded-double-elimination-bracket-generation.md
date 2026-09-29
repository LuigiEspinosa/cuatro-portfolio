---
baseline_commit: d8c5277d6f88389a497c5ecea3fcabf69614f89c
---

# Story 4.1: Random-seeded double-elimination bracket generation

Status: done

<!-- Code review 2026-07-12: 2 decision-needed + 11 patches all applied; all gates green (pgTAP 433 /
     Vitest 170 / lint 0 / build 0 / go clean). See "Review Fixes Applied" below.
     LIVE-QA: the review RECOMMENDED re-running Task 9 (the original sign-off drove an 11-player field —
     one of the fields the review proved could never reach its Grand Final — and the demo/stat_row schema
     changed since). Cuatro WAIVED the re-run and accepted the story as done (2026-07-12). Recorded here
     so the history is honest: the automated gates passed; the Task-9 human gate was not re-executed. -->


<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **admin**,
I want to **generate a seeded double-elimination bracket from the closed roster**,
so that **the field is drawn fairly and reproducibly, with byes for odd counts.**

This is the **first story of Epic 4** (Bracket & Admin Command Routes). It lands the `match` table
(migration slice), the first **atomic admin command route** (an RPC-backed transaction — the pattern
Story 4.6 "Aprobar" will reuse), and closes two committed retro action items that were explicitly
deferred **to this exact slice**. Epic 4 status flips `backlog → in-progress` on this story.

## Acceptance Criteria

Verbatim from [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1 (lines 634-654)]:

**AC1 — seeded, reproducible draw from a closed 8–16 roster (FR-5, AD-13 bracket)**
**Given** the seeded-generation rule, **When** the admin generates the bracket from a closed roster of
8–16 players, **Then** a random `bracket_seed` is recorded and stored **separately** from the fairness
`fair_seed`, **never reused for it**.

**AC2 — double-elimination structure (FR-6)**
**Given** the double-elimination structure, **When** the bracket is generated, **Then** it maintains
**Winners, Losers, and Grand-final routing** so each loser drops to Losers until a **second loss**
eliminates them.

**AC3 — deterministic byes for non-power-of-two fields (FR-8, AD-9)**
**Given** a non-power-of-two field, **When** byes are required, **Then** byes are assigned
**deterministically by seed** and a bye **advances a player with a badge and creates no stats**.

_Traces: FR-5, FR-6, FR-8 · AD-13 (bracket), AD-9_

### Additional required outcomes (D1–D3 — derived, NOT optional)

These are not in the epic's three ACs but are **binding requirements** of this slice: the story lands
the `match` table and the first `bracket_live` writer, so it MUST leave the system consistent
end-to-end. See the workflow's rule: an implied requirement is still a requirement.

- **D1 — Close the four deferred `→ match(id)` FKs.** Four tables carry a `match_id`/`*_match_id`
  column created as a plain `bigint` with the FK deferred **"to Epic 4 / when the match table lands."**
  This IS that moment. Add all four in the match migration. [Sources: `demo` L26 + header L13 in
  [supabase/migrations/0005_demo.sql]; `stat_row` L37 + header L16-17 in
  [supabase/migrations/0007_stat_row.sql] — *"Epic 4 adds BOTH stat_row_match_fk and the pending
  demo_match_fk"*; `tournament.final_match_id` L32 in [supabase/migrations/0001_core_schema.sql];
  `audit_log.target_match_id` L26 + header L13-14 in [supabase/migrations/0003_audit_snapshot.sql].
  Retro action item **epic-3 #3** (open) mandates the demo+stat_row pair explicitly.]
- **D2 — Generation is atomic, admin-gated, audited, and single-shot.** All writes (assign
  `bracket_seed`, insert every `match` row, transition `tournament.state → bracket_live`, write the
  `audit_log` row) commit in **one transaction**; a second generate on an already-live bracket is
  rejected, not duplicated. [AD-6 atomic, AD-8 server-gated/idempotent, AD-17 audit.]
- **D3 — Close the roster-lock TOCTOU.** Once `state = 'bracket_live'`, `enrollSelf` /
  `adminAddPlayer` / `removePlayer` MUST NOT be able to commit, enforced by a **write-side DB guard**
  (not only the existing read-check). This story introduces the concurrent `bracket_live` writer that
  makes the window exploitable. [Retro **epic-2 #7** (open) + **epic-3 #3** (open); the deferral is
  homed to *"the Epic-4 bracket-generation slice"* in [_bmad-output/implementation-artifacts/deferred-work.md] (§"Deferred from: code review of 2-5", the roster-lock TOCTOU item).]

## Tasks / Subtasks

> **Recommended migration numbering:** next free is **0010**. Suggested split (two clean single-concern
> slices, matching the repo convention): `0010_match.sql` = table + FKs + RLS/grants; `0011_bracket_generation.sql`
> = the `generate_bracket` RPC + the roster-lock trigger (D3). Each gets its own pgTAP `NNNN_*_test.sql`.
> You MAY combine into one migration if you prefer — the binding requirement is that each concern is
> covered and pgTAP-proven.

- [x] **Task 1 — `match` table migration (0010) (AC2, AC3, D1)**
  - [x] Create `match` **verbatim** from [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#3 (lines 110-139)]: all columns, the `state` closed-set CHECK (`declared|awaiting_grace|live|bye|forfeit|pending|resolved|manual_resolved|rolled_back`), the `bracket` CHECK (`winners|losers|grand_final`), `score_source` CHECK (`demo_derived|admin_manual`), `unique (tournament_id, bracket, bracket_slot, coalesce(gf_order,0))`, and the `score_source_guard` CHECK (§3 L135-139).
  - [x] Add the index `match (tournament_id, bracket)` (§3 L259).
  - [x] **D1 — the four deferred inbound FKs** (add here, now that `match` exists):
    - `demo.match_id → match(id)` **ON DELETE RESTRICT** (constraint name `demo_match_fk`; §3 L133).
    - `stat_row.match_id → match(id)` **ON DELETE CASCADE** (§3 L143 — derived child).
    - `tournament.final_match_id → match(id)` **ON DELETE SET NULL** (nullable back-pointer; matches aren't hard-deleted in v1, SET NULL is the safe non-cascading choice).
    - `audit_log.target_match_id → match(id)` **ON DELETE SET NULL** — **never CASCADE** (append-only audit must never be cascade-wiped; see [_bmad-output/implementation-artifacts/deferred-work.md] §"Deferred from: code review of story-1.4", the cascade-wipe item).
  - [x] `ALTER TABLE match ENABLE + FORCE ROW LEVEL SECURITY` (non-negotiable convention; the generic FORCE-guard in `0003_audit_snapshot_test.sql` Section A2 fails loudly if omitted).
  - [x] Grants + policy per the admin/worker-only pattern (see Dev Notes §"The match table"): `grant select, insert, update on match to service_role` (**no DELETE** — matches are never hard-deleted, only state-transitioned); an admin-only `stat_admin`-style dormant SELECT policy; **no** anon/authenticated grant this slice (the Spanish viewer bracket surface is Epic 5).
  - [x] Migration header docstring in the established SCOPE / OUT-OF-SCOPE style (mirror 0005/0007 headers).

- [x] **Task 2 — pgTAP proof `0010_match_test.sql` (AC2, AC3, D1)**
  - [x] `plan(N)` exact count; run in `begin … rollback`; pgtap in `extensions` schema (mirror [supabase/tests/0004_roster_test.sql]).
  - [x] Prove: table + all CHECK constraints BITE (`throws_ok '23514'` for out-of-set `state`/`bracket`/`score_source`; the `score_source_guard` rejects `admin_manual` with a demo and no override, and `demo_derived` with `demo_id IS NULL`); the `unique(...coalesce(gf_order,0))` bites; **the four D1 FKs bite** (`throws_ok '23503'` inserting a `demo`/`stat_row` with a non-existent `match_id`); ENABLE+FORCE RLS (`relrowsecurity`/`relforcerowsecurity` = true); the exact grant matrix via `has_table_privilege` (service_role SELECT/INSERT/UPDATE = true, DELETE = **false**; anon/authenticated all false); `policies_are(...)` asserts the complete policy set.

- [x] **Task 3 — `lib/bracket/generate.ts`: pure double-elim generation (AC1, AC2, AC3)**
  - [x] Export a **pure, deterministic** function that takes the active roster entries + an injected RNG (so it is Vitest-testable with a seeded/stub RNG) and returns `{ seeds: {rosterEntryId, seed}[], matches: MatchRow[] }`.
  - [x] **Seeding (AC1):** unbiased shuffle (Fisher–Yates using `node:crypto` `randomInt`) → assign each active entry a unique `bracket_seed` position `1..N`. This is the *bracket* randomness (OS entropy) — **structurally distinct** from the Epic-6 `fair_seed` (see Dev Notes §"bracket_seed & AD-13").
  - [x] **Byes (AC3):** bracketSize = next power of two ≥ N (8→8, 9–16→16); byes = bracketSize − N assigned to the **top seeds deterministically** (a top seed with a bye gets a walkover); a bye `match` is `state='bye'`, the present player is **advanced** into its next winners slot, **no `stat_row`** is created (there is no reachable stat-write path).
  - [x] **Structure (AC2):** pre-create **all** rows — full Winners skeleton, full Losers skeleton, and the **Grand-Final row (`gf_order=1`)**. R1 competitor slots filled from seeds/byes; all later-round + all losers + GF competitor slots are **NULL** (filled later by Story 4.3 advance). `bracket_position` = human label ("Winners R1", "Losers R2", …), `bracket_slot` = the structural routing index. Two-loss elimination is **derived from bracket edges, never a stored flag** (§7 L359).
  - [x] Keep the exact losers-bracket routing/bye-placement numbering as a **deterministic module detail** (architecture explicitly permits this — §7 L354-356 + Deferred L474). It MUST be a pure function of the seed and MUST satisfy the routing invariants in Dev Notes.

- [x] **Task 4 — `lib/bracket/generate.test.ts` (Vitest) (AC1, AC2, AC3)**
  - [x] With a stubbed RNG, assert determinism (same seed ⇒ identical bracket) and the seed→position mapping.
  - [x] Power-of-two field (e.g. 8, 16): correct match counts (8-player: Winners 7, Losers 6, GF 1; 16-player: Winners 15, Losers 14, GF 1), no byes.
  - [x] Non-power-of-two (e.g. 9, 11, 13): correct bye count = bracketSize − N, byes on the top seeds, each bye is `state='bye'` + the player pre-advanced + no stat-write path.
  - [x] Boundary: reject `< 8` and `> 16` (AC1 range) — where this check lives (lib vs RPC) is your call, but it MUST be enforced.
  - [x] Routing invariants (see Dev Notes §"Bracket structure invariants").

- [x] **Task 5 — `generate_bracket` RPC + roster-lock trigger, migration 0011 (D2, D3, AC1)**
  - [x] **`generate_bracket(p_tournament_id bigint, p_bracket_seed jsonb, p_seeds jsonb, p_matches jsonb)`** (SECURITY INVOKER; `grant execute … to service_role` only — **no** anon/authenticated execute). In one transaction: `SELECT … FROM tournament WHERE id = p_tournament_id FOR UPDATE` (serialize) → assert `state = 'registration_closed'` else typed error → re-read active roster under the lock and assert its id-set equals the ids in `p_seeds` else typed error `roster_changed` (optimistic-concurrency) → `UPDATE roster_entry SET bracket_seed = …` → `INSERT` all `match` rows → `UPDATE tournament SET state='bracket_live'` → `INSERT audit_log` (`action='generate_bracket'`, `detail` = the random seed + pairings). Return a typed result.
  - [x] **D3 roster-lock trigger:** `BEFORE INSERT OR UPDATE ON roster_entry` → `SELECT state INTO … FROM tournament WHERE id = NEW.tournament_id FOR KEY SHARE` (the `FOR KEY SHARE` conflicts with generation's `FOR UPDATE`, so a roster write blocks on an in-flight generate then sees `bracket_live` and is rejected) → `RAISE EXCEPTION` (SQLSTATE you can assert, e.g. `23514`/a custom `P0001`) if `state NOT IN ('registration_open','registration_closed')`. This closes the window uniformly for enrollSelf/adminAddPlayer/removePlayer with no route changes.
  - [x] `audit_log.action='generate_bracket'` needs **no** migration (action is free `text`; already enumerated in [supabase/migrations/0003_audit_snapshot.sql:25] and AD-17).

- [x] **Task 6 — pgTAP proof `0011_bracket_generation_test.sql` (D2, D3, AC1)**
  - [x] `generate_bracket`: happy path from `registration_closed` seeds `roster_entry.bracket_seed`, inserts the expected match rows, flips state to `bracket_live`, writes the audit row — all present after one call. A **second** call now 42-errors / returns the typed "already live" refusal (single-shot). A call in a non-closed state is refused.
  - [x] **D3 trigger BITES:** with `tournament.state='bracket_live'`, a `roster_entry` INSERT and an UPDATE both `throws_ok` the trigger's SQLSTATE; with a mutable state they `lives_ok`. Role-switch as `service_role` to prove the guard bites **even the privileged writer** (BYPASSRLS does not bypass a trigger).

- [x] **Task 7 — Admin command route `app/api/admin/bracket/route.ts` (D2, AC1)**
  - [x] Mirror [app/api/admin/registration/route.ts]: `export const runtime='nodejs'; export const dynamic='force-dynamic'`; `getAdminClient()` + `createSupabaseServerClient()`; `requireAdmin(ssr, admin)` gate first (401/403 on refusal) → parse/validate body (`{ tournament_id }`) → read active roster → `lib/bracket/generate.ts` computes → `admin.rpc('generate_bracket', {...})` → map the typed RPC result to HTTP (e.g. `bad_tournament`→404, `not_closed`/`already_live`/`roster_changed`→409, `bad_field_count`→422, infra→500). JSON responses (machine surface, **no i18n** — the registration route documents this precedent at L19).

- [x] **Task 8 — Regression: roster paths still green under the new trigger (D3)**
  - [x] Run the existing Vitest + pgTAP suites. The trigger changes DB behavior for roster writes in a non-mutable state (previously a lib-level `locked` refusal; now also a DB-level rejection). Keep the existing `requireMutableTournament` read-checks in [lib/roster.ts] as **friendly early-exit UX** (a clean typed `locked` before hitting the DB); the trigger is the real teeth. Confirm `0004_roster_test.sql` and `lib/roster.test.ts` still pass (or adjust if you add trigger-interaction assertions — do not regress the green `plan(38)` baseline without accounting for it).

- [x] **Task 9 — Live-QA notes (do NOT mark AC done on unit tests alone)**
  - [x] The standing live-QA fixture ([supabase/fixtures/live-qa-seed.sql]) seeds only **2** roster players — **insufficient** for generation (AC1 floor is 8). Seed **8–16** active players for a real generation QA, then verify: `roster_entry.bracket_seed` populated 1..N, the expected `match` rows exist with correct byes, `tournament.state='bracket_live'`, one `generate_bracket` audit row, and a post-generation `adminAddPlayer`/`enrollSelf` is **rejected** by the trigger.
  - [x] **Migration-apply caveat:** the D1 FKs require existing `demo`/`stat_row` rows (if any from prior 3.x QA) to reference real `match` ids. On a DB with orphan `match_id`s the FK add will fail — run against a fresh `supabase db reset` (then re-apply the live-QA fixture), which is the intended local-QA flow.

### Review Findings

_Code review 2026-07-12 (bmad-code-review, 3 parallel layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor, all at Opus capability). Baseline `d8c5277`. **2 decision-needed, 9 patch, 3 defer, 3 dismissed.** The two headline findings were verified by EXECUTING the shipped routing functions, not by inspection._

**Decisions taken (Cuatro, 2026-07-12):** both decision-needed items are RESOLVED and become patches → **11 patches total**.
- **Decision 1 → option (a): materialize LB byes.** Cascade the bye consequence into the Losers bracket at generation — a LB match fed by a bye pre-advances its lone competitor (walkover); one fed by two byes is void. Keeps the full `2·bracketSize−2` skeleton and the row-count invariant that 4.3/4.4/Epic-5 are written against. Requires a `state` value for the void node (0010 CHECK-set touch).
- **Decision 2 → option (c): add a `matchzy_match_id` column.** The MatchZy game-server id gets its own home; `demo.match_id` becomes nullable and stays NULL (FK intact) until Story 4.6 (Aprobar) binds the demo to a real `match`. Preserves D1's intent without the column lying about what it holds, and unbreaks ingest immediately.

- [x] **[Review][Patch ← Decision 1, resolved: option (a)] Byes never propagate into the Losers bracket — every field of 9–15 generates an un-completable tournament.** All three layers found this independently; I confirmed it by running the real `generateBracket` + routing functions over every legal field size. A Winners-R1 `bye` match yields a winner but **no loser**, yet `generateBracket` emits the full `bracketSize` Losers skeleton unconditionally ([lib/bracket/generate.ts:332-336](lib/bracket/generate.ts#L332-L336)) and pre-advances only the bye winner ([lib/bracket/generate.ts:363-374](lib/bracket/generate.ts#L363-L374)). The LB slots that `winnersLoserTarget(size,1,i)` designates for a bye's non-existent loser can therefore **never be filled, by anything, ever**. Measured result — Grand Final side B is unreachable for **N = 9, 10, 11, 12, 13, 14 and 15**; only N=8 and N=16 complete. Even N=15 (a *single* bye) strands the whole LB spine (LB R1 m0 → R2 m0 → R3 m0 → R4 m0 → R5 m0 → R6 m0). This violates **AC2** directly, not just AC3: a Winners-R2 loser drops into an LB slot whose opponent can never arrive — one loss, no possible second loss, no possible advance. **Story 4.3 cannot repair it**: 4.3 advances on a *result*, and a bye match never produces one. The Task-9 live-QA used **N=11 — one of the broken fields** — and passed only because it verified the Winners side and row counts. Options: **(a)** materialize LB byes/walkovers at generation and cascade the fixpoint; **(b)** prune the unreachable LB nodes (kills the `2·bracketSize−2` row-count invariant, and 4.3/Epic-5 must handle a non-uniform skeleton); **(c)** restrict the field to powers of two (8 or 16) and drop AC3. Note the `state` CHECK set has no "void" member, which constrains (a) and (b).
- [x] **[Review][Patch ← Decision 2, resolved: option (c)] D1's `demo_match_fk` breaks demo ingest at runtime, and has no deploy path.** `demo.match_id` is `bigint not null` and has **never** held a `match.id` — every writer supplies a free-floating integer: the Go worker uses MatchZy's `MatchZy-MatchId` header ([worker/ingest/server.go:84](worker/ingest/server.go#L84)) and the CLI's `--match <id>` ([worker/ingest/cli.go:36](worker/ingest/cli.go#L36)); [lib/ingest.ts:35](lib/ingest.ts#L35) validates only "positive integer". After [0010_match.sql:91-92](supabase/migrations/0010_match.sql#L91-L92), **every demo registration now raises 23503** → [lib/ingest.ts:60](lib/ingest.ts#L60) maps it to `write_failed` → HTTP 500. The worker PUTs bytes to R2 *before* the DB insert, so each failure orphans an R2 object and MatchZy retries. The standing ingest fixture [supabase/fixtures/live-qa-seed.sql](supabase/fixtures/live-qa-seed.sql) (the Epic-3 retro's closing artifact) seeds **zero** match rows, so the documented ingest live-QA is now unrunnable. Separately the FK cannot be applied to any DB holding pre-existing demo/stat_row rows; the only documented remedy is `supabase db reset` (destroy all data), which is not a deployment path. The story acknowledged only the *apply* hazard, never the *runtime* one, and filed no deferral. Options: **(a)** make `demo.match_id` nullable + defer the FK to 4.6 (partially reverts D1); **(b)** keep the FK and add the demo→match binding now (decide who assigns a real `match.id` to a MatchZy demo); **(c)** keep the FK, add a separate `matchzy_match_id` column for the game-server id, leave `match_id` NULL until Aprobar binds it.
- [x] **[Review][Patch] `generate_bracket` never validates `p_matches` — an empty skeleton commits an unrecoverable `bracket_live` tournament** [supabase/migrations/0011_bracket_generation.sql:205-223](supabase/migrations/0011_bracket_generation.sql#L205-L223)
- [x] **[Review][Patch] The route reports the client's match count, not the database's — structurally masking the above** [app/api/admin/bracket/route.ts:80-86](app/api/admin/bracket/route.ts#L80-L86)
- [x] **[Review][Patch] The D3 trigger's `P0001` is unmapped — the TOCTOU it closes surfaces as HTTP 500 instead of 409 `locked`** [lib/roster.ts:26](lib/roster.ts#L26)
- [x] **[Review][Patch] `p_seeds`' seed VALUES are never validated — duplicate/NULL/out-of-range seeds all commit** [supabase/migrations/0011_bracket_generation.sql:195-203](supabase/migrations/0011_bracket_generation.sql#L195-L203)
- [x] **[Review][Patch] The Losers major-round crossover admits 4 avoidable early rematches in the 16-bracket** [lib/bracket/generate.ts:198-215](lib/bracket/generate.ts#L198-L215)
- [x] **[Review][Patch] The roster-lock trigger ignores `OLD.tournament_id` — a seeded entry can be moved OUT of a frozen roster** [supabase/migrations/0011_bracket_generation.sql:68-76](supabase/migrations/0011_bracket_generation.sql#L68-L76)
- [x] **[Review][Patch] `match` is missing structural CHECKs (`gf_order` domain, winner-is-a-participant, `competitor_a <> competitor_b`, competitors scoped to the tournament)** [supabase/migrations/0010_match.sql:35-56](supabase/migrations/0010_match.sql#L35-L56)
- [x] **[Review][Patch] The pgTAP + Vitest suites prove materially less than they claim** [supabase/tests/0011_bracket_generation_test.sql:153-185](supabase/tests/0011_bracket_generation_test.sql#L153-L185)
- [x] **[Review][Patch] `demo → match ON DELETE RESTRICT` makes `DELETE FROM tournament` impossible, contradicting 0010's own header and breaking the new fixture's teardown + idempotency** [supabase/migrations/0010_match.sql:32-34](supabase/migrations/0010_match.sql#L32-L34)
- [x] **[Review][Defer] `score_source_guard` permits a score with no provenance** [supabase/migrations/0010_match.sql:77-81](supabase/migrations/0010_match.sql#L77-L81) — deferred, DDL is verbatim-per-spec and no score is written until 4.6/4.8
- [x] **[Review][Defer] `pg_temp.m(slot)` test helper has no tournament scope or `LIMIT 1`** [supabase/tests/0005_demo_test.sql:38-39](supabase/tests/0005_demo_test.sql#L38-L39) — deferred, latent only; injective today because each suite seeds one tournament
- [x] **[Review][Defer] No CSRF defence on the state-mutating cookie-authenticated admin POST routes** [app/api/admin/bracket/route.ts](app/api/admin/bracket/route.ts) — deferred, pre-existing across every admin route, not introduced by 4.1

**Dismissed as noise (3):** unvalidated `p_actor_steamid64` in the RPC (service_role can already write `audit_log` directly — an in-RPC admin re-check buys nothing; `requireAdmin` is the real gate); field bounds duplicated in TS + SQL (deliberate, documented defence-in-depth, matching `ROSTER_MUTABLE_STATES`); "route authorization contract not established" (an artifact of the Blind layer's by-design lack of project access — `requireAdmin` is real and was verified by the Acceptance Auditor).

### Review Fixes Applied (2026-07-12) — all 11 patches landed

| Gate | Before review | After fixes |
|---|---|---|
| `supabase test db` | 12 files / 397 assertions | **12 files / 433 assertions — PASS** |
| `npm test` (Vitest) | 12 files / 146 tests | **12 files / 170 tests — PASS** |
| `npm run lint` | 0 | **0** |
| `npm run build` | 0 | **0** (`/api/admin/bracket` still `ƒ`) |
| `go build/vet/test ./...` + `gofmt` | (untouched) | **clean** (worker SQL re-pointed at the renamed column) |

**The two that changed the design, not just the code:**

1. **Byes now propagate through the Losers bracket (Decision 1a).** `generateBracket` walks the DAG in topological order and settles every Losers node's structural fate: `declared` (2 competitors can arrive), `bye` (a walkover — 1 can), `void` (a NEW `state`, in 0010's CHECK set — both feeders were byes, so none can). Verified by executing the shipped routing functions over **every** legal field: N=8…16 now all reach the Grand Final; before, **only 8 and 16 did**. Row-count invariant preserved (30 rows for an 11-field). The contract Story 4.3 must honour — advance straight *through* a `bye` Losers node — is documented at the top of `lib/bracket/generate.ts`.

2. **`demo`/`stat_row` `match_id` → `matchzy_match_id` (Decision 2c).** The column was RENAMED (not re-added), which carries 0006's `unique(match_id, demo_sha256)` and 0007's `unique(match_id, steamid64)` with it — a naive add-and-null would have **silently destroyed demo dedup and turned every re-parse into duplicate rows**, because NULLs are distinct in a UNIQUE. D1's four FKs now sit on a new *nullable* `match_id` that Story 4.6 (Aprobar) populates. Demo ingest works again, 0010 applies to a dirty DB, and the 0005–0009 re-fixturing became unnecessary and was reverted (which also retires the `pg_temp.m(slot)` deferral).

**The rest:** `generate_bracket` now validates its payload (`bad_skeleton` — an empty `p_matches` used to commit a live tournament with **no bracket**, unrecoverable; `bad_seeds` — a non-permutation used to commit); the route reports the DB's committed counts, not `matches.length`; the D3 trigger's `P0001` maps to `locked`/409 instead of a 500; the trigger now guards **both ends** of a tournament move; the Losers crossover is `index ^ 1` (kills 4 avoidable rematches in the 16-bracket, verified by simulation); `match` gained the `gf_order`-domain, winner-is-a-participant, distinct-competitor and tournament-scoped-competitor constraints; and the suites now assert **column values** (a broken JSONB key would have left the old 40-assertion suite fully green), persist a real `bye`/`void` row, pin the `FOR KEY SHARE`/`FOR UPDATE` modes at source level, and actually check the active-roster filter.

> ### ⚠ Task 9 (live-QA) — RE-RUN RECOMMENDED, WAIVED BY CUATRO (2026-07-12)
> The original live-QA drove an **11-player field**, which the review proved was one of the fields that
> could never reach its Grand Final; it passed only because it checked the Winners side and row counts.
> Both the generation algorithm **and** the `demo`/`stat_row` schema changed materially in the fixes, so
> that sign-off does not carry over. The review therefore recommended re-running Task 9 before `done`.
>
> **Cuatro accepted the story as done without re-running it.** Recorded plainly rather than quietly
> dropped: the automated gates (pgTAP 433 / Vitest 170 / lint / build / go) all pass and the bracket
> liveness fix is verified by executing the real routing functions across every field 8–16 — but the
> human gate was not re-executed. If a bracket is ever drawn for real and behaves oddly, start here.
>
> What a re-run should check, beyond the original list: the Losers bracket is fully populated with
> `bye`/`void` states on an 11-field; a demo ingest still succeeds after 0010 (the D1 runtime regression
> this review found); and a roster write racing a generate returns **409 `locked`**, not 500.

## Dev Notes

### Scope & boundaries — what 4.1 owns, and what it explicitly does NOT

**4.1 OWNS:** the `match` table + its four deferred inbound FKs (D1); the pure double-elim generation
algorithm (`lib/bracket/`); the first atomic admin RPC (`generate_bracket`) + its route; the
`registration_closed → bracket_live` transition; the structural-bye advance; the roster-lock TOCTOU
trigger (D3). It creates **all** match rows (Winners + Losers full skeleton + GF `gf_order=1`).

**OUT OF SCOPE — do NOT build here** (each has an owning story; building it now is scope creep):
- **Idempotent conditional advance** (`WHERE slot IS NULL OR = winner`) as a result-consequence → **Story 4.3**. 4.1 only performs the *structural-bye* advance at generation; use the same conditional shape so 4.3 generalizes cleanly.
- **Grand-final reset second row (`gf_order=2`)** + champion-slot-never-overwritten → **Story 4.4**. 4.1 creates only `gf_order=1`.
- **Format/tie-policy lock** (`format`, `tie_policy`, `format_locked=true`) → **Story 4.2**. 4.1 leaves `format_locked=false` (the DDL default); matches are created `state='declared'`.
- **Forfeit + grace timer** (`awaiting_grace`, the 10-min timer, `mark_walkover`) → **Story 4.5**. 4.1 handles only *structural* byes (no opponent because of odd count), not no-show forfeits.
- **Aprobar / demo-derived score / `state='resolved'`** → **Story 4.6** (which also absorbs deferred 3.7 + the score-derivation parser extension; retro epic-3 #4). No score is set in 4.1.
- **Rollback (4.7), manual score (4.8), the reusable audited-command-route helper (4.9).** 4.1 writes its audit row inline inside the RPC; 4.9 generalizes the helper.
- **Viewer bracket surface + Spanish copy (`Pase directo` bye badge) + realtime Broadcast nudge** → **Epic 5** (AD-11/AD-24). 4.1 sets only the structural `state='bye'`; the "badge" string is Epic-5 viewer copy [SOLUTION-DESIGN.md#10 L461]. **No** realtime emit in 4.1.
- **`tournament.fair_seed` population + write-once trigger** → Epic 6 (AD-13). 4.1 must not touch `fair_seed`.

### The `match` table (migration 0010) — grounding & the FK matrix

Full DDL is [SOLUTION-DESIGN.md#3 (lines 110-139)]; the ERD `MATCH` block is [ARCHITECTURE-SPINE.md (lines 359-367)]. Copy the columns exactly. Key facts:
- `bracket_position` is a **label** ("Winners R1"), never a running number [Consistency Conventions, SPINE L229].
- `competitor_a/b`, `winner_entry` reference `roster_entry(id)` (the seeded entry, not `player` — matches join to the roster, so a rename never orphans; AD-4).
- The `score_source_guard` CHECK is created **with the table** even though scores are set in 4.6/4.8 — it is a structural invariant (AD-5), harmless while `score_source IS NULL`.

**The convention this table must follow** (learned from 0003/0004/0005/0007 — read those headers):
- New Supabase tables get **zero** privileges by default (`config.toml auto_expose_new_tables` unset) — every grant is explicit [0004 header L63-65].
- `match` is **admin/worker-only this slice** (like `demo`/`stat_row`, NOT `roster_entry`): `grant select, insert, update on match to service_role` (**no DELETE**); a dormant admin-only SELECT policy `for select to authenticated using ((select public.is_admin()))` (the `(select …)` wrap makes `is_admin()` an init-plan — the established perf precedent); **no** anon/authenticated grant or policy. The viewer bracket read + its `status`-style two-policy model arrive in Epic 5.
- ENABLE **and** FORCE RLS (FORCE applies to the table owner too; service_role's BYPASSRLS still bypasses).

**FK ON DELETE rationale** (spine Referential-Integrity convention, SPINE L234: RESTRICT source-of-truth, CASCADE derived children): `demo→match` RESTRICT (demo is evidence/source-of-truth); `stat_row→match` CASCADE (derived child); the two nullable back-pointers (`tournament.final_match_id`, `audit_log.target_match_id`) SET NULL — audit must never cascade-lose rows.

### Bracket generation — the KEY design decision (atomic persistence)

**There is no transaction/RPC infrastructure in the app yet.** Every existing write is a single
`supabase-js` call, and `writeAudit` in [lib/roster.ts:57-70] deliberately runs **after** the primary
write (safe only because that write is idempotent). Bracket generation is **not** decomposable into
idempotent independent writes — a partial failure leaves a half-built bracket. So an **atomic
transaction is genuinely required** (AD-6 posture), and `supabase-js` cannot do multi-statement
transactions. **Recommended: a Postgres function (RPC) invoked via `admin.rpc(...)`.** No new npm
dependency; SQL functions are transactional by construction; and the same lock closes D3. **This
establishes the atomic-admin-transaction pattern that Story 4.6 (Aprobar) reuses — get it right here.**

**Recommended shape — TS computes, thin RPC persists** (aligns with the repo's two strengths: heavily
unit-tested TS logic + DB-enforced invariants):
1. Route reads the active roster (`status='active'`) and calls `lib/bracket/generate.ts` → deterministic `{seeds, matches}` + the raw random `bracket_seed` value.
2. Route calls `admin.rpc('generate_bracket', { p_tournament_id, p_bracket_seed, p_seeds, p_matches })`.
3. The RPC (one txn): `FOR UPDATE` the tournament row → assert `state='registration_closed'` → **re-read active roster under the lock and assert its id-set == the ids in `p_seeds`** (rejects `roster_changed` if a write slipped in between the route's read and the lock — optimistic concurrency) → apply `bracket_seed` → insert matches → `state='bracket_live'` → audit. Returns typed success/refusal.

**Alternative (acceptable):** do the whole thing in plpgsql (read roster + shuffle via `gen_random_bytes` + build + persist under the lock — no optimistic-concurrency dance, but the complex losers routing lives in SQL, tested only via pgTAP). Choose the hybrid unless you have a strong reason; the double-elim routing is far more testable in TS. **Flag your choice in the Dev Agent Record.**

Auth: the route's `requireAdmin` stays the authorization gate (server-side `is_admin()` re-read =
instant revoke, [lib/auth/admin-guard.ts]); the RPC is only reachable via the service-role client, so
`grant execute` to `service_role` only keeps viewers out (AD-8).

### `bracket_seed` recording & the AD-13 separation (AC1)

`roster_entry.bracket_seed` already exists as a **nullable shell** [supabase/migrations/0004_roster.sql:30] — *"populated at bracket generation (Epic 4)"*. Populate it with each active
entry's **seed position `1..N`** (the recorded draw). That is the "recorded `bracket_seed`" AC1 means,
and it is the **reproducible artifact**: the whole bracket (byes + routing) is a deterministic function
of the positions, so persisting positions is sufficient to reproduce the bracket — no tournament-level
seed column is needed. Record the **raw random draw value** in the `audit_log.detail` of the
`generate_bracket` row for traceability (AD-17), not because reproduction needs it.

**AD-13 [ARCHITECTURE-SPINE.md L140-143]:** the bracket seed and `fair_seed` are separate fields with
separate lifecycles and are **never reused for each other**. Satisfied structurally: `bracket_seed`
lives on `roster_entry` and is drawn from **OS entropy** (`node:crypto`); `fair_seed` lives on
`tournament`, equals `SHA-256(final demo)`, and is not even set until Epic 6. Do **not** derive one from
the other. (The Epic-6 fairness PRNG — HMAC-SHA256 keyed by the demo hash — is a *completely different*
mechanism from this OS-entropy bracket shuffle; don't conflate them.)

### Bracket structure invariants (what Task 4's tests must pin, AC2/AC3)

- Every non-bye player enters exactly one Winners R1 slot; every match slot maps to a unique `(bracket, bracket_slot, gf_order)` (the table UNIQUE).
- **Two-loss elimination is edge-derived** (FR-6, §7 L359): a Winners loser drops to a specific Losers slot; a Losers loser is eliminated. The routing function (Winners-slot → Losers-drop-slot, Winners/Losers-slot → next-slot) is pure and deterministic; 4.3's advance consumes it, so design the numbering with 4.3 in mind (note the forward dependency, do not build advance).
- Byes (AC3): deterministic by top seed; a bye match `state='bye'`; the byed player is placed into their next Winners slot at generation (use the `WHERE slot IS NULL OR = winner` conditional shape 4.3 will formalize); **no `stat_row`** path is reachable from a bye (AD-9).
- GF: exactly one row `gf_order=1` this story; the reset `gf_order=2` is 4.4.

### Roster-lock TOCTOU (D3) — why a trigger, and why `FOR KEY SHARE`

Current state [lib/roster.ts]: `setRegistrationOpen` (L143-154) has a real write-side `.in('state',
ROSTER_MUTABLE_STATES)` guard, but `adminAddPlayer` (L250-264) / `removePlayer` (L293-303) do a
**read-check then a separate write** with no cross-table predicate, and `enrollSelf` (L214-217) has no
state check at all (it leans on the route's earlier `resolveOpenTournament`). Until now there was **no
writer that flips `tournament.state`**, so the window was unexploitable — [deferred-work.md] §2-5 records
exactly this and homes the fix to *"the Epic-4 bracket-generation slice … when a concurrent
`bracket_live` writer first exists."* **This story is that writer.**

`supabase-js` cannot express a correlated `WHERE EXISTS (SELECT 1 FROM tournament …)` on a
`roster_entry` write, so the robust, minimal, uniform fix is a **`BEFORE INSERT OR UPDATE` trigger** on
`roster_entry` that reads `tournament.state … FOR KEY SHARE` and rejects a non-mutable state. `FOR KEY
SHARE` **conflicts** with generation's `FOR UPDATE`, so a roster write that races an in-flight generate
**blocks**, then sees the committed `bracket_live` and is rejected — the window is genuinely closed, for
all three write paths, with **no route/lib changes** and no bypass (BYPASSRLS does not skip triggers).
Keep the lib read-checks as friendly early-exit UX. This matches the repo's "the DB constraint is the
teeth" philosophy (soft-delete grant ceiling, FORCE RLS, the CHECK enums).

### Command-route pattern (Task 7) — copy this exactly

[app/api/admin/registration/route.ts] is the reference: `runtime='nodejs'` + `dynamic='force-dynamic'`
(service-role + per-request admin gate need Node APIs, never prerender); build `getAdminClient()` +
`createSupabaseServerClient()`; `requireAdmin` first; a strict `parseBody` returning `null → 400`; map a
**typed refusal union → HTTP status** via a `Record`; one `try/catch` returning JSON 500. Routes are
thin — logic lives in `lib/` (Vitest) + the RPC (pgTAP). The enroll route [app/api/roster/enroll/route.ts]
documents the "thin wrapper, no dedicated route test" precedent, so a dedicated route test is optional
if lib + pgTAP cover the behavior.

**`supabase-js` mock note for tests:** the chainable/thenable builder mock in [lib/roster.test.ts:38-76]
(`makeAdmin({table:[results]})` + `opsFor(table,method)`) covers `.from(...)` chains but **not `.rpc()`** —
extend it with an `rpc: vi.fn()` seam if you unit-test the route/orchestration.

### Testing requirements (conventions — non-negotiable)

- **pgTAP** ([supabase/tests/NNNN_<name>_test.sql], run `supabase test db`): `create extension if not exists pgtap with schema extensions; set local search_path = extensions, public;` then **`select plan(N)`** with an **exact** count (the repo keeps precise assertion-accounting — retro epic-1 habit); `begin … rollback` so nothing persists; seed a minimal fixture as `postgres` (bypasses RLS), then `set local role service_role|authenticated|anon` + `set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"…"}}', true)` to prove grants/RLS/triggers bite. SQLSTATEs: `23514` check, `23502` not-null, `23503` FK, `23505` unique, `42501` insufficient_privilege.
- **Vitest** (`npm test` → `vitest run`, config: pinned `vitest@4.1.9`): colocated `*.test.ts`; pure-logic functions with injected dependencies (RNG, clients) — mirror [lib/roster.test.ts].
- **Both layers required:** DDL/RLS/trigger/RPC ⇒ pgTAP; generation algorithm ⇒ Vitest; live-QA ⇒ the human gate (Task 9), never "unit tests pass" alone.

### Previous-story intelligence (Epics 1–3 — patterns to reuse, mistakes to avoid)

- **This is app/lib (TypeScript) work.** Epic 3 was entirely the Go worker; the last app/lib command-route work was Epic 2. Ground your patterns in Epic 2 (`requireAdmin`, service-role writes, typed refusal unions, audit writes), **not** the worker.
- **`requireAdmin` is the reusable Epic-4 primitive** — [lib/auth/admin-guard.ts:5-9] literally says *"the single reusable primitive every Epic-4 command route (advance/approve/rollback/…) will call."* Use it verbatim; do not re-implement admin gating.
- **`writeAudit` established the audit write** [lib/roster.ts:57-70]; `action` is uncapped `text`, so `generate_bracket` needs no migration. In the RPC, write the audit **inside** the transaction (an improvement over roster.ts's after-the-fact write — the RPC makes it atomic).
- **Fail-closed + typed refusals, never silent no-ops** — a 0-row guarded write returns a typed refusal ([lib/roster.ts] `setRegistrationOpen` L152-154). Apply to `generate_bracket` (e.g. `roster_changed`, `not_closed`, `already_live`).
- **Migration discipline:** header docstring with SCOPE / OUT-OF-SCOPE; the full column set up front (Epic-5 stat shells precedent); explicit grants; ENABLE+FORCE RLS; the generic FORCE-guard will catch a forgotten FORCE.
- **`display_name` is never a join key** (AD-4) — bracket/match join through `roster_entry.id` / `steamid64`, never the mutable name.

### Git intelligence (recent commits)

`d8c5277`/`72dd416`/`0bef580`/`d0dc329`/`1e34c94` — Epic 3 close-out: retro + the standing live-QA
fixture ([supabase/fixtures/live-qa-seed.sql], `0bef580`) + the worker `DATABASE_URL` full-DSN override
(`d0dc329`, worker-only). Nothing touched `app/`/`lib/`/`match`; the working tree is clean. **Nothing to
build on directly** — Story 4.1 opens a new (app/lib) surface. The fixture matters for Task 9 (but only
seeds 2 players — you must seed 8–16 for a generation QA).

### Latest tech / versions (all pinned — no upgrade, no web lookup needed)

From [package.json] + [ARCHITECTURE-SPINE.md#Stack]: Next.js **16.2.10** (App Router, Node ≥20.9),
`@supabase/supabase-js` **2.110.0**, `@supabase/ssr` **0.12.0**, TypeScript **5.9**, Vitest **4.1.9**,
Supabase Postgres **15+**, pgTAP (in `extensions`). `admin.rpc(fn, args)` is standard supabase-js 2.x.
Randomness: `node:crypto` (`randomInt`/`randomBytes`) — available because the route runs
`runtime='nodejs'`. No new dependency is required for this story.

### Project Structure Notes

New files land exactly where the spine's source tree puts them ([ARCHITECTURE-SPINE.md#Structural Seed,
lines 437-452]): `lib/bracket/` = *"double-elim routing, idempotent advance, two-loss-from-edges (AD-8)"*;
`app/api/admin/` = *"server-gated mutations"*; `supabase/migrations/` = the shared schema+RLS contract.
Expected additions: `lib/bracket/generate.ts` (+ `.test.ts`), `app/api/admin/bracket/route.ts`,
`supabase/migrations/0010_match.sql` + `0011_bracket_generation.sql`, `supabase/tests/0010_match_test.sql`
+ `0011_bracket_generation_test.sql`. No conflicts with the existing structure; `lib/bracket/` is new.
Admin routes are JSON (no i18n); the Spanish bracket viewer is Epic 5.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1 (lines 634-654)] — the three ACs + traces; #Epic 4 (630-632) — the epic owns the match + audit_log slice + FR-13/14/16 admin halves.
- [Source: SOLUTION-DESIGN.md#3 (110-139)] — `match` DDL, the four FK sites, `score_source_guard`; #7 (352-367) — bracket generation/advance/GF/bye rules; #8 (370-375) — the Aprobar txn (context for the RPC pattern 4.6 reuses).
- [Source: ARCHITECTURE-SPINE.md] — AD-6 (105-108) atomic, AD-8 (115-118) server-gated/idempotent, AD-9 (120-123) bye/forfeit zero-stats, AD-13 (140-143) seed separation, AD-17 (160-163) audit, AD-21 (180-183) GF-reset; Match-lifecycle diagram (299-317); Consistency Conventions (225-235); Stack (237-251); Structural Seed (435-452).
- [Source: supabase/migrations/0001_core_schema.sql] (tournament.state set incl. `bracket_live`, `final_match_id` deferral) · [0003_audit_snapshot.sql] (audit_log exists; `target_match_id` deferral; append-only grant model) · [0004_roster.sql] (`roster_entry.bracket_seed` shell; grant/RLS/two-policy pattern) · [0005_demo.sql] + [0007_stat_row.sql] (the demo/stat_row `→match` FK deferrals — *"Epic 4 adds BOTH"*).
- [Source: supabase/tests/0004_roster_test.sql] — the pgTAP convention (plan/role-switch/grant matrix/policies_are).
- [Source: lib/roster.ts] (roster mutations + the TOCTOU gap + `writeAudit`) · [lib/auth/admin-guard.ts] (`requireAdmin`) · [lib/supabase/admin.ts] (service-role client) · [app/api/admin/registration/route.ts] (route pattern) · [lib/roster.test.ts] (Vitest mock).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the roster-lock TOCTOU deferral (homed to this slice) + the audit-cascade-wipe note (informs `audit_log.target_match_id` SET NULL).
- Retro action items (sprint-status.yaml `action_items`): **epic-2 #7** (open — roster-lock TOCTOU in 4.1), **epic-3 #3** (open — the two `→match` FKs + the TOCTOU guard in 4.1), **epic-3 #4** (open — 4.6 absorbs 3.7, informs the OUT-OF-SCOPE boundary).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code / bmad-dev-story)

### Debug Log References

Final green baseline (all against a fresh `supabase db reset`):

| Gate | Result |
|---|---|
| `supabase test db` | **12 files, 397 assertions, PASS** (was 11 files / 300 pre-story) |
| `npm test` (Vitest) | **12 files, 146 tests, PASS** (was 110; +36 new in `lib/bracket/generate.test.ts`) |
| `npm run lint` | **exit 0** |
| `npm run build` | **exit 0**; `/api/admin/bracket` registered as `ƒ` (dynamic) |
| Live-QA (Task 9) | **PASS** — see Completion Notes |

`npx tsc --noEmit` exits 2 on **two pre-existing errors in `lib/auth/session.test.ts` (lines 40, 83 — TS2493)**.
Verified pre-existing by stashing all Story-4.1 work and re-running against baseline `d8c5277`: it exits 2
there too. Not caused by, and not touched by, this story. (`next build` is unaffected — it does not
typecheck test files. There is no `typecheck` npm script; `lint` is the configured gate.)

### Completion Notes List

**Key design decision (the story asked for this to be flagged): took the RECOMMENDED HYBRID —
TS computes, a thin RPC persists.** `lib/bracket/generate.ts` is a pure, deterministic function
(injected RNG) so the double-elim routing is exhaustively unit-testable; `generate_bracket` (0011) does
the persisting in one transaction. The plpgsql-does-everything alternative was rejected: it would put the
losers-bracket routing in SQL, testable only through pgTAP.

**What was built**
- **Task 1/2 — `match` (0010).** Full SOLUTION-DESIGN §3 column set, the AD-5 `score_source_guard`,
  ENABLE+FORCE RLS, dormant admin-only SELECT policy, `service_role` SELECT/INSERT/UPDATE and
  deliberately **no DELETE** (a match is never hard-deleted, only state-transitioned). **D1: all four
  deferred `→ match(id)` FKs closed** — `demo` RESTRICT, `stat_row` CASCADE, `tournament.final_match_id`
  + `audit_log.target_match_id` SET NULL (never CASCADE: append-only audit must not be cascade-wiped).
- **Task 3/4 — `lib/bracket/generate.ts`.** Fisher–Yates over `node:crypto.randomInt`; seed positions
  1..N into the existing `roster_entry.bracket_seed` shell; the **complete** skeleton (full Winners +
  full Losers + one GF `gf_order=1`). Routing is exported as pure functions (`winnersWinnerTarget`,
  `winnersLoserTarget`, `losersWinnerTarget`) **specifically so Story 4.3's advance consumes them rather
  than re-deriving them**.
- **Task 5/6 — `generate_bracket` RPC + the D3 trigger (0011).** Both in one migration **on purpose**:
  the RPC takes `FOR UPDATE` on the tournament row and the trigger takes `FOR KEY SHARE` on it — those
  modes conflict, and that conflict *is* the TOCTOU fix. Shipping either alone leaves the race open.
- **Task 7 — `app/api/admin/bracket/route.ts`.** Thin wrapper mirroring the registration route.

**Three findings worth carrying forward**

1. **SOLUTION-DESIGN §3 L131 is not valid Postgres.** It writes
   `unique (tournament_id, bracket, bracket_slot, coalesce(gf_order,0))` *inside* `create table`, but a
   UNIQUE **table constraint** accepts only bare column names — an expression needs a UNIQUE **INDEX**.
   Realized as `match_slot_uniq` (same semantics). This matters: a naive plain `UNIQUE(...gf_order)`
   would treat every NULL as distinct and enforce **nothing** on the ~29 non-GF rows of a real bracket.
   Pinned by an explicit assertion in `0010_match_test.sql`.

2. **The first cut of the D3 trigger MASKED a column constraint — caught by `0004_roster_test` test 10.**
   A `BEFORE ROW` trigger runs *before* NOT NULL/CHECK/FK, so guarding a NULL `tournament_id` reported
   `23503` for what is really a `23502` NOT NULL violation. Fixed by short-circuiting on NULL and letting
   the column speak; the trigger owns the *lock*, not nullability. Both behaviours are now pinned in
   `0011_bracket_generation_test.sql` so it cannot silently regress.

3. **D1's FKs broke five existing pgTAP suites, and that is the point.** `0005`–`0009` all inserted
   `demo`/`stat_row` rows with *arbitrary* `match_id` literals (444, 990, 777…) because the column was a
   free-floating `bigint`. Each fixture now seeds a real `match` parent chain, with the original literals
   resolved through a `pg_temp.m(slot)` helper so **every assertion keeps its exact grouping semantics**
   (which rows share a `match_id`, which differ). Most importantly, **`0007`'s deferred-FK canary is
   FLIPPED**: it used to `lives_ok` that a `match_id` naming no match still inserted ("proves the FK is
   DEFERRED to Epic 4"); it now `throws_ok '23503'`. Same flip discipline `0005` used when 0006 landed —
   the deferral is not quietly dropped, it is *inverted into the proof that it was honoured*.

**Live-QA (Task 9) — real generation, not unit tests.** New fixture
`supabase/fixtures/live-qa-bracket-seed.sql` seeds an **11-player** field (deliberately not a power of
two → bracketSize 16 → **5 byes**, so AC3 is actually exercised; an 8- or 16-field would silently skip
it). Drove the **real `generateAndPersistBracket`** against the running local stack over PostgREST as
`service_role` (so the RPC's service-role-only EXECUTE grant was exercised for real too). Verified in SQL:

- `tournament.state` → `bracket_live` ✅
- `roster_entry.bracket_seed` = exactly `{1..11}` on all 11 active entries ✅
- 30 match rows: **15 winners + 14 losers + 1 grand_final** ✅
- **5 byes, on exactly the top 5 seeds**, each with no opponent and `winner_entry = competitor_a` ✅
- Bye winners genuinely **pre-advanced** into Winners R2 — and W-R2 slot 9 came out with *both* sides
  filled (two byes met there), which is correct and stays `declared`; slots 8/10/11 hold one bye each and
  wait on the three real R1 matches ✅
- Exactly **one** `generate_bracket` audit row, carrying the raw draw (`algorithm`, `bye_seeds [1,2,3,4,5]`) ✅
- **Zero** `stat_row`s reachable from any bye match (AD-9) ✅
- **Single-shot:** a second generate returned `already_live` and did **not** duplicate — still 30 matches, 1 audit row ✅
- **D3 live:** post-generation `adminAddPlayer` (INSERT), `enrollSelf` (UPSERT) and `removePlayer`
  (soft-delete UPDATE) were **all three rejected** with `P0001`, executed **as `service_role`** — BYPASSRLS
  skips policies but never triggers, which is the only reason this guard is real. Roster unchanged ✅

**Two things a reviewer should know**

- **Migration-apply caveat (as the story predicted).** D1's FKs cannot be added to a DB holding
  `demo`/`stat_row` rows with orphan `match_id`s (any leftover 3.x live-QA data). `supabase db reset` is
  the intended local flow. Confirmed in practice.
- **Fixtures and pgTAP are mutually exclusive on one DB — pre-existing, not introduced here.**
  `0002_rls_test` asserts *absolute* row counts (`player = 3`, `season = 1`, `tournament = 1`,
  `app_role = 1`), so **any** persisted fixture fails it. The existing `live-qa-seed.sql` already did
  this (it also collides with `canonical_steamid64`'s player insert — that was the state of the DB at the
  start of this session). Documented in the new fixture header. **Candidate cleanup for a later story:
  scope `0002_rls_test`'s counts to its own seeded names.** Not fixed here — out of scope for 4.1.

**Retro action items closed by this story:** **epic-2 #7** (roster-lock TOCTOU → the D3 trigger) and
**epic-3 #3** (the two `→ match` FKs + the TOCTOU guard → D1 + D3). Both now `done` in sprint-status.

**Scope discipline:** no advance (4.3), no GF-reset row (4.4), no format/tie lock (4.2), no forfeit/grace
(4.5), no scores (4.6), no viewer surface or realtime (Epic 5), and `fair_seed` untouched (Epic 6).

### File List

**New**
- `supabase/migrations/0010_match.sql`
- `supabase/migrations/0011_bracket_generation.sql`
- `supabase/tests/0010_match_test.sql`
- `supabase/tests/0011_bracket_generation_test.sql`
- `supabase/fixtures/live-qa-bracket-seed.sql`
- `lib/bracket/generate.ts`
- `lib/bracket/generate.test.ts`
- `app/api/admin/bracket/route.ts`

**Modified**
- `supabase/tests/0005_demo_test.sql` — D1 match fixture; new `demo_match_fk` bite assertion (`plan(38)` → `plan(39)`)
- `supabase/tests/0006_demo_hash_dedup_test.sql` — D1 match fixture
- `supabase/tests/0007_stat_row_test.sql` — D1 match fixture; **deferred-FK canary FLIPPED** to `throws_ok '23503'`
- `supabase/tests/0008_demo_validation_test.sql` — D1 match fixture (season/tournament hoisted above Section A)
- `supabase/tests/0009_stat_pending_visibility_test.sql` — D1 match fixture
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story → `review`; retro items epic-2 #7 + epic-3 #3 → `done`
- `_bmad-output/implementation-artifacts/4-1-random-seeded-double-elimination-bracket-generation.md` — this file

## Change Log

| Date | Change |
|---|---|
| 2026-07-12 | Story 4.1 implemented. Migration 0010 lands `match` + **all four deferred `→ match(id)` FKs** (D1). Migration 0011 lands the `generate_bracket` RPC (D2 — the app's first atomic admin transaction, the pattern 4.6 reuses) + the `roster_entry` lock trigger (D3 — closes the roster TOCTOU, retro epic-2 #7 / epic-3 #3). `lib/bracket/generate.ts` = pure double-elim generation (OS-entropy Fisher–Yates, seed positions 1..N, full Winners+Losers+GF skeleton, deterministic top-seed byes). `app/api/admin/bracket/route.ts` = the admin command route. Five existing pgTAP suites re-fixtured for the new FKs; 0007's deferred-FK canary flipped. pgTAP 397 / Vitest 146 / lint 0 / build 0, plus an 11-player live-QA generation (5 byes) verified end-to-end. Status → review. |
