---
baseline_commit: 6e8eddc
---

<!-- baseline note: contexted 2026-07-19 against 6e8eddc (Story 4.8 manual score override merged + done — manual_resolve_match, the match_manual_override_audited trigger, and lib/match/manual-score.ts all land at HEAD; pgTAP baseline 843, Vitest 322). Migration slot for THIS story is 0020; test 0020_command_routes_test.sql. This is the LAST story of Epic 4 — the audit-and-gating COMPLETENESS story. Its two epic ACs are, read naively, already TRUE per-route (every admin route re-verifies is_admin(); every match-mutating RPC writes an audit_log row; audit_log itself shipped in 0003/Story 1.4). So this story is NOT "build audit_log" — it is: (1) prove the two guarantees hold as SETS, not just per-route; (2) close the ONE genuinely-missing audit row (grant_role, explicitly deferred here at roles/route.ts:90-93); (3) build the ONE genuinely-missing audited route (accept-anomaly, Story 3.4 AC2, orphaned since Epic 3); (4) consolidate the audited-command-route boilerplate into one structural gate (the promise at bracket/route.ts:19); (5) correct the AD-17 / epics.md:812 route enumeration. -->

# Story 4.9: Server-gated, audited command routes

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **⚠ READ THIS FIRST — THIS STORY IS NOT WHAT ITS TITLE LOOKS LIKE.** The epic ACs say *"every admin command route re-verifies `is_admin()` server-side and writes via the service role"* and *"the `audit_log` migration slice is created here."* **Both are already TRUE at HEAD** and have been since Epic 1–2. `audit_log` shipped in **migration 0003** (Story 1.4). Every route under `app/api/admin/**` already calls `requireAdmin` (0011–0019 established the pattern). Every *match-mutating* RPC already writes an `audit_log` row. So a story that merely restated the ACs would ship **nothing**. The real, load-bearing work — the work the codebase has been routing HERE by name for eight stories — is to turn the two guarantees from *"true per-route, unverified as a set"* into a **proven invariant**, close the **one** genuinely-missing audit row (`grant_role`), build the **one** genuinely-missing audited route (**accept-anomaly**), and consolidate the boilerplate into **one structural gate** so *"no action can bypass authorization"* is enforced in a single place instead of copy-pasted eleven times.

## Story

As an operator,
I want every admin mutation to re-verify admin server-side and write an append-only audit row — enforced as a provable invariant across the *whole* admin surface, not route by route,
so that there is a complete, tamper-evident trail and no action can bypass authorization.

## Acceptance Criteria

Verbatim from [epics.md#Story 4.9 (lines 803-819)]. Traces: **FR-33 · AD-8, AD-17**.

**AC1 — the server-gated rule (AD-8, FR-33).**
**Given** the server-gated rule, **When** any admin command route runs (generate bracket, advance, mark walkover, approve, re-parse, rollback, declare format, start ceremony, grant role — **and, corrected here, bind, manual-score, and accept-anomaly**), **Then** it re-verifies `is_admin()` server-side and writes via the service role; viewers cannot invoke it. **This story proves it as a SET:** no route under `app/api/admin/**` reaches a write without passing `requireAdmin`, and every admin-mutating RPC grants EXECUTE to `service_role` only (`anon`/`authenticated` = false).

**AC2 — the audit rule (AD-17).**
**Given** the audit rule, **When** any mutating admin action commits, **Then** it writes an `audit_log` row with actor SteamID64, timestamp, and before/after detail; the `audit_log` migration slice exists (0003) **with no UPDATE/DELETE policy — re-confirmed here**. **This story closes the coverage gap:** `grant_role` — named by AD-17, deferred to this story at `roles/route.ts:90-93` — writes its audit row here, and the AD-17 action vocabulary is enumerated and each action's audit-write is accounted for.

### What "already TRUE" means, precisely (do NOT rebuild any of this)

- **AC1 server-gating, per route:** all 11 routes at HEAD (`roles`, `registration`, `roster`, `bracket`, `match/format`, `match/walkover`, `match/grace`, `match/bind`, `approve`, `rollback`, `manual-score`) open with `getAdminClient()` + `createSupabaseServerClient()` + `requireAdmin(ssr, admin)` → 403 on failure, before any write. `requireAdmin` (`lib/auth/admin-guard.ts`) re-reads the authoritative `app_role` table (Option A — instant revoke), never trusting the JWT claim.
- **AC1 service-role-only writes, per RPC:** every command RPC ends with `revoke execute … from public; grant execute … to service_role;` (`0017:456-463`, `0018`, `0019`, etc.). `service_role` has BYPASSRLS; the grant is the second lock.
- **AC2 audit_log table:** `0003_audit_snapshot.sql` — `audit_log` with `actor_steamid64 NOT NULL` (FK to `player`), `action text NOT NULL`, `target_match_id` (FK to `match(id)` added in `0010:198`), `detail jsonb` (before/after), `occurred_at`. Append-only by **grant absence** (`grant select, insert … to service_role` only — no update/delete) **and** policy absence. The `audit_log_target_match` partial index exists (`0012:81-82`).
- **AC2 audit rows, per match-mutating RPC:** `generate_bracket` (0011), `declare_match_format` (0012), `advance_match` (0013/0014), `mark_walkover`/`begin_match_grace`/`resume_match` (0015), `bind_match_demo`/`begin_grace` (0016), `approve_match` (0017), `rollback_match` (0018), `manual_resolve_match` (0019) all `insert into audit_log`.

**The two genuine gaps AC2 leaves open at HEAD:** (1) `grant_role` writes NO audit row (deferred here, and it collides with `audit_log.tournament_id NOT NULL` because a role change is event-global — AD-18); (2) the **accept-anomaly** admin action (Story 3.4 AC2) has no route at all, so its required "logged" audit row does not exist. Both are closed here.

---

## THE ONE-PARAGRAPH HEADLINE

**Story 4.9 adds no new match mechanic — it makes the two Epic-4 guarantees STRUCTURAL and COMPLETE.** Four concrete deliverables: **(1)** a **shared audited-command-route helper** (`lib/admin/command-route.ts`) that every admin POST route routes through — one place that re-verifies `is_admin()`, parses the body, maps typed refusals to HTTP status, and shapes errors — so AC1's *"no action can bypass authorization"* is enforced **once**, not copy-pasted; a **guardrail test** then proves no route under `app/api/admin/**` reaches a handler without it. This folds in the deferred `bracket/route.ts:52` unbounded-integer 400-gap by exporting one shared `isPositiveInt`. **(2)** the **`grant_role` audit row** — closing AD-17's one un-logged action, which forces a small honest schema decision: `audit_log.tournament_id` is `NOT NULL`, but a role grant is event-global, so this story **drops that NOT NULL** (DECISION B) and writes the row. **(3)** the **accept-anomaly audited route** (`POST /api/admin/accept-anomaly`) — the `Anomalous → Pending` admin decision Story 3.4 AC2 requires and 0008 explicitly deferred to *"Epic 4 (audited admin routes, AD-8)"*, orphaned ever since; a small `accept_anomaly` RPC flips `demo.validation_state` and writes an `accept_anomaly` audit row, unblocking `bind_match_demo` (which refuses `anomalous` demos). **(4)** a **catalog-level invariant guard** (pgTAP) that asserts the whole admin-mutating-RPC set is `service_role`-only EXECUTE — the AC1 grant matrix as a SET, the analogue of the 1.3→1.4 RLS-FORCE catalog guard. Everything else the codebase homed at "4.9" is a **DECISION to defer** (the manual/forfeit undo forward-tools; `advance_match`'s five bare `P0001`s; CSRF) — see DECISIONS E–H and the questions at the end.

---

## Developer Context — READ THIS BEFORE YOU TOUCH ANYTHING

### What already exists (do NOT rebuild it)

1. **The route boilerplate is identical across all 11 routes** — your helper's raw material. Read `app/api/admin/approve/route.ts` and `app/api/admin/bracket/route.ts` **side by side**: they differ only in (a) the lib function called, (b) the `STATUS_FOR` map, (c) the body shape, (d) the success payload. Everything else — `getAdminClient()` → `createSupabaseServerClient()` → `requireAdmin` gate → `request.json()` try/catch → `parseBody` → 403/400/`invalid_json` shapes → the outer `try/catch` → `{ error: reason }, { status: STATUS_FOR[reason] }` → the `console.error('[api/admin/…] request failed', err)` → 500 → the `runtime='nodejs'`/`dynamic='force-dynamic'` exports — is byte-repeated. **That repetition IS the AC1 risk:** eleven copies of the gate is eleven chances for one to drift open. Consolidating them into one gate is the strongest form of *"no action can bypass authorization."*
2. **`requireAdmin` is the gate primitive — do NOT touch it** (`lib/auth/admin-guard.ts`). It is already the single reusable authorization primitive (Story 2.4, Option A instant-revoke). Your helper *calls* it; it does not replace or wrap its logic. Both clients are injected — keep that shape so the helper stays unit-testable.
3. **`isPositiveInt` already exists, correctly, in `approve/route.ts:51-52`** — `typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER`. `bracket/route.ts:52` has the **buggy** form (`typeof … === 'number' && Number.isInteger(…)` with **no range cap**) — the exact `deferred-work.md` item ("`app/api/admin/bracket/route.ts:52` has the same unbounded-integer gap … intended home: Story 4.9"). Export ONE `isPositiveInt` from the helper module and both are fixed at once.
4. **`audit_log` is done and append-only** (`0003_audit_snapshot.sql`) — `service_role` holds `select, insert` only (no update/delete grant), no update/delete policy, admin-only read policy. **Do NOT weaken this.** Your only schema touch to `audit_log` is DECISION B (drop `tournament_id`'s NOT NULL) — a *widening* that leaves append-only intact.
5. **The lib-writes-a-typed-refusal pattern is universal** (`lib/match/approve.ts`, `rollback.ts`, `manual-score.ts`): `import 'server-only'`, injected `admin` client first arg, a discriminated union result, a `Set` of the RPC's typed reasons, named SQLSTATE consts for RAISEd codes, validate-the-ok-shape, fail-closed to `write_failed` on an unrecognized reason. **Mirror it exactly** for `accept-anomaly`.
6. **`setRole` is where the `grant_role` audit row belongs** (`lib/auth/roles.ts`) — it already performs the durable `app_role` upsert via the injected service-role client. The route (`roles/route.ts:90-93`) explicitly says the audit row is *"DEFERRED to Story 4.9 … app_role.granted_by / granted_at is the interim durable record. Do NOT write audit_log here."* This story lifts that deferral. The row is written **in `setRole`**, right after the `app_role` write, on the same service-role client.
7. **`demo.validation_state` is the accept-anomaly axis** (`0008:40-44`) — `('pending'|'anomalous')`, plus `anomaly_reasons jsonb`, `validated_at`. Accept-anomaly is exactly `anomalous → pending`. `0008:17-20` OUT-OF-SCOPE note assigns it by name: *"the admin accept-anomaly (`Anomalous → Pending`) … command routes — Epic 4 (audited admin routes, AD-8)."* `bind_match_demo` (4.6a) refuses an `anomalous` demo (`demo.validation_state` and `stat_row.status` are orthogonal, `0008:32`), so accept-anomaly is the missing unblock step: anomalous demo → **admin accepts (logged)** → `pending` → now bindable → bind → `pending` match → approve.
8. **`audit_log.action` is uncapped `text` with no CHECK** (`0003:25`) — `accept_anomaly` and `grant_role` extend the vocabulary with **NO migration** (the `bind_demo`/`begin_grace` precedent, `0016`). Do NOT edit 0003's `action` column. The enumerated comment at `0003:25` already lists `grant_role`; add `accept_anomaly` to that comment for legibility (a comment-only edit is fine — it does not alter applied DDL semantics; alternatively note it in the 0020 header).

### The hand-off prior work left THIS story, BY NAME (in `deferred-work.md`)

1. **`bracket/route.ts:52` unbounded-integer 400-gap → the shared `isPositiveInt`** (4.2 review, `deferred-work.md`: *"a shared `isPositiveInt`/body-parse helper — most naturally Story 4.9, which already owns de-duplicating this boilerplate across every admin route"*). **Closed by DELIVERABLE 1** (the helper exports one validator).
2. **Story 4.9's route list omits `manual-score`** (4.8 dev-story, `deferred-work.md`) and **omits `accept-anomaly`** (4.6 create-story, `deferred-work.md`: *"Story 4.9's route list … omits it … its route list should be corrected to include it"*). **Closed by DELIVERABLE 5** (the AD-17/epics enumeration correction) + DELIVERABLE 3 (accept-anomaly is actually built).
3. **The accept-anomaly (`Anomalous → Pending`) route is ORPHANED between Epic 3 and Epic 4** (4.6 create-story, `deferred-work.md`; Story 3.4 AC2 `epics.md:531`). **Closed by DELIVERABLE 3.** ⚠ Two traps the mock carries, flagged there and DEFERRED here (DECISION G): the admin mock renders an *enabled* `Aprobar` beside the anomaly banner (a state the two-step gate says can't exist pre-accept — do not honour it), and a *second* override branch that sets `idle_dq` (FR-21 / Story 5.4 territory — **not** part of accept-anomaly).
4. **`grant_role` writes no audit row** (`roles/route.ts:90-93`, explicit) — **closed by DELIVERABLE 2** + DECISION B.

### What the codebase homed at "4.9" that this story DEFERS (see DECISIONS E–H)

- **The manual-resolution undo + the forfeit undo forward-tools** (`deferred-work.md`, 4.7/4.8 dev-story + 4.7 code-review) — *"most naturally Story 4.9 OR a small Epic-4 follow-up."* These are substantial NEW `rollback_match`-family RPC work, not audit/gating hardening. **DECISION E: defer** to a dedicated Epic-4 follow-up slice (or the Epic-4 retro's call) — folding them here re-creates the exact size problem that split Story 4.6.
- **`advance_match`'s five bare `P0001` raises** (`deferred-work.md`, 4.3/4.5 review) — *"4.9's shared command-route helper maps SQLSTATEs centrally."* `advance_match` has **no direct route or lib caller** (it is only called *inside* approve/walkover/manual RPCs, which already convert its `{ok:false}` to their own distinct codes). Its bare-`P0001` paths are genuine bracket corruption that legitimately 500. **DECISION F: defer / minimal** — the central-map claim presumes a caller that does not exist; giving them a distinct SQLSTATE is low-value churn today.
- **The competitor-column audited write-once seam** (`deferred-work.md`, 4.3 review: *"Story 4.7, with 4.9 as the sibling"*) — 4.7 shipped the AD-8 allowlist-flag approach instead. **DECISION H: closed-elsewhere / defer.**
- **CSRF on the cookie-authenticated admin POSTs** (`deferred-work.md`, 4.1 review) — *"fix it once, uniformly, for all admin routes … Epic 7."* Out of scope by standing decision.

### The four deliverables, precisely

**DELIVERABLE 1 — the shared audited-command-route helper (`lib/admin/command-route.ts`) + the AC1 guardrail test.**
- A helper that encapsulates the whole POST envelope. Recommended shape (DECISION A):
  ```
  handleAdminCommand<TBody, TResult extends { ok: boolean }>(request, {
    parseBody:   (raw: unknown) => TBody | null,   // → 400 invalid_body on null
    run:         (admin, gate, body) => Promise<TResult>,  // gate.steamid64 is the actor
    statusFor:   Record<string, number>,           // refusal-reason → HTTP status
    ok:          (result) => object,               // success JSON payload
  }): Promise<NextResponse>
  ```
  It performs, in order: construct `getAdminClient()` + `createSupabaseServerClient()`; `requireAdmin` → 403 on `!ok`; `request.json()` in a try/catch → 400 `invalid_json`; `parseBody` → 400 `invalid_body`; `run(admin, gate, body)`; on `!result.ok` → `{ error: result.reason }` at `statusFor[result.reason]`; on ok → `ok(result)`; all inside one outer try/catch → `console.error('[api/admin/…]', err)` + 500 `internal_error`. Export a shared `isPositiveInt` (the correct capped form) from this module.
- Migrate the **single-POST** routes to the helper: `bracket`, `match/format`, `match/walkover`, `match/bind`, `approve`, `rollback`, `manual-score`, `roles`, `registration`, `roster`, and the new `accept-anomaly`. **`match/grace` is a documented exception** — it is dual-verb (POST begin-grace + DELETE resume, `grace/route.ts`); keep it hand-written (or add a helper overload only if it stays trivial — DECISION A's overrule note). The actor is **always** `gate.steamid64`, never the body, in every migrated route.
- **The AC1 guardrail (a Vitest test, `lib/admin/command-route.test.ts` + a route-coverage test):** (a) unit-test the helper's every branch (403 non-admin, 400 invalid_json, 400 invalid_body, refusal→status mapping, ok payload, 500 on a thrown `run`); (b) a **structural coverage test** that globs `app/api/admin/**/route.ts` and asserts every file imports the helper (or, for `grace`, calls `requireAdmin`) — so a future route that forgets the gate FAILS CI. This is AC1-as-a-set: the analogue of the `0002`/`0003` catalog FORCE-guard, in the TS layer.

**DELIVERABLE 2 — the `grant_role` audit row (in `setRole`) + DECISION B (drop `audit_log.tournament_id` NOT NULL).**
- In migration `0020`, `alter table audit_log alter column tournament_id drop not null` — role grants are event-global (AD-18); pinning them to a tournament would misrepresent them and break the moment a second tournament exists. This is a *widening*; every existing row keeps its `tournament_id`; grants/policies/append-only are untouched. Add a column comment recording *why* it is now nullable (event-global admin actions: `grant_role`).
- In `lib/auth/roles.ts` `setRole`, after the durable `app_role` upsert succeeds, `insert into audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)` `values (null, actingAdmin, 'grant_role', null, {before, after})` via the injected service-role client, where `before/after` capture the target's prior and new role. **Non-atomic with the `app_role` write (acceptable):** `app_role.granted_by`/`granted_at` remains the durable source of truth (the row already lands first); the audit insert is the append-only *log*, and a failure logs + does not roll back the grant (the grant is idempotent and re-runnable). Delete the `roles/route.ts:90-93` "DEFERRED to Story 4.9" comment and replace with a one-line "audit row written in setRole (0020/4.9)".
- **⚠ FK note:** `audit_log.actor_steamid64` is `NOT NULL` with an FK to `player` (`0003:24`) — the acting admin is a real player, so this holds. `target_match_id` stays NULL (a role grant targets no match).

**DELIVERABLE 3 — the accept-anomaly audited route (RPC + lib + route).**
- **Migration `0020`: `accept_anomaly(p_demo_id bigint, p_actor_steamid64 text) returns jsonb`** — `language plpgsql`, `security invoker`, `set search_path = ''`. Guards (all before any write, typed refusals RETURNED, the 0016/0017 convention): `bad_demo` (no such demo); `not_anomalous` (`demo.validation_state <> 'anomalous'` — nothing to accept). On success: `update demo set validation_state='pending', validated_at = now() where id = p_demo_id`; write the audit row `insert into audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)` — `action='accept_anomaly'`, `target_match_id = NULL` (an anomalous demo is not yet bound to a match), `detail = {demo_id, before:{validation_state:'anomalous'}, after:{validation_state:'pending'}, anomaly_reasons}`. `tournament_id`: the demo carries no direct `tournament_id` (it links via `matchzy_match_id`/`match`), and an unbound anomalous demo has no match → **use the same event-global NULL** DECISION B just enabled (or, if the demo *is* resolvable to a tournament via a bound match, use it; an unbound demo is the common case — NULL is correct). Return `{ok:true, demo_id, validation_state:'pending'}`. **Service-role-only EXECUTE grant** (`revoke … from public; grant … to service_role;`).
- **`lib/admin/accept-anomaly.ts`** (+ `.test.ts`) — mirror `lib/match/rollback.ts`: `import 'server-only'`, injected `admin`, discriminated union, reasons `bad_demo | not_anomalous | write_failed`, fail-closed, ok-shape validation.
- **`app/api/admin/accept-anomaly/route.ts`** — thin, via the DELIVERABLE-1 helper. Body `{ demo_id }` (validate with the shared `isPositiveInt`). `statusFor`: `bad_demo → 404`, `not_anomalous → 409`, `write_failed → 500`. Actor = `gate.steamid64`.
- **⚠ SCOPE (DECISION G):** accept-anomaly flips **only** `demo.validation_state`. It does NOT touch `stat_row.status`, does NOT set `idle_dq` (the mock's second override branch — FR-21/Story 5.4), does NOT auto-bind or auto-approve. It makes the demo *bindable*; the admin then binds (4.6a) and approves (4.6b) through the existing path.

**DELIVERABLE 4 — the AC1/AC2 catalog invariant guard (pgTAP, `0020` suite).**
- **AC1 grant matrix as a SET:** for **every** admin-mutating RPC — `generate_bracket`, `declare_match_format`, `advance_match`, `mark_walkover`, `begin_match_grace`, `resume_match`, `bind_match_demo`, `begin_grace`, `approve_match`, `rollback_match`, `manual_resolve_match`, **`accept_anomaly`** — assert `has_function_privilege('service_role', …, 'EXECUTE') = true` AND `has_function_privilege('anon', …) = false` AND `has_function_privilege('authenticated', …) = false`. One row per function; a NEW command RPC that forgets its revoke reddens. (Enumerate by name — a catalog sweep over *all* functions would sweep in helpers like the trigger guards; the enumerated list IS the AD-17/AD-8 command surface, and keeping it in the test is the point.)
- **AC2 append-only re-confirmation:** assert `audit_log` still has NO update/delete grant to any of `service_role`/`anon`/`authenticated`, and NO update/delete policy — the AD-17 teeth, re-proven after the `tournament_id` widening.
- **DELIVERABLE 3 behaviour:** an `anomalous` demo → `accept_anomaly` → `validation_state='pending'`, `validated_at` set, ONE `accept_anomaly` audit row with a real before/after; a second `accept_anomaly` on the now-`pending` demo → `not_anomalous`; a non-existent demo → `bad_demo`. **Mutation-proof:** delete the audit insert → the audit-row assertion reddens; skip the `not_anomalous` guard → the second-call assertion reddens.
- **DELIVERABLE 2 behaviour:** a raw `insert into audit_log(tournament_id, …) values (null, …)` now SUCCEEDS (the NOT NULL is gone) — the enabling assertion for the event-global `grant_role` row. (The `grant_role` row itself is written by `setRole` in the TS layer and covered by `roles.test.ts`; the pgTAP proves the *schema* permits it.)

---

## Tasks / Subtasks

### Task 0 — Re-read the load-bearing code before editing (do not skip) (AC: all)
- [x] `app/api/admin/approve/route.ts` **and** `app/api/admin/bracket/route.ts` side by side — the byte-repeated envelope your helper extracts, and the `isPositiveInt` inconsistency (approve has the capped form; bracket:52 does not).
- [x] `app/api/admin/roles/route.ts:90-93` — the explicit *"grant_role audit deferred to Story 4.9"* note + the `tournament_id NOT NULL` / event-global tension; `lib/auth/roles.ts` `setRole` — where the durable `app_role` write happens (the audit row's home).
- [x] `lib/auth/admin-guard.ts` — `requireAdmin` end to end (the gate primitive your helper calls; do NOT modify it).
- [x] `supabase/migrations/0003_audit_snapshot.sql` — `audit_log` shape, the append-only grant/policy posture (`:72-84`), the `action` vocabulary comment (`:25`), `tournament_id NOT NULL` (`:23`), the `target_match_id` FK-deferral note (now satisfied at `0010:198`).
- [x] `supabase/migrations/0008_demo_validation.sql:31-44` — `demo.validation_state ('pending'|'anomalous')` + the `:17-20` OUT-OF-SCOPE note homing accept-anomaly to Epic 4; `epics.md:531` (Story 3.4 AC2 — *"an admin must explicitly accept the anomaly (logged) to advance it to Pending"*).
- [x] `supabase/migrations/0016_bind_and_score.sql` — `bind_match_demo` refuses an `anomalous` demo (why accept-anomaly is the unblock step); its typed-refusal guard shapes to mirror.
- [x] `lib/match/rollback.ts` (+ `.test.ts`) — the lib shape `accept-anomaly.ts` mirrors (simplest sibling: no lock, no advance, one flip + one audit row).
- [x] `ARCHITECTURE-SPINE.md:115-118` (AD-8), `:160-163` (AD-17 — **the enumerated action list**), `:165-168` (AD-18 — role is event-global); `deferred-work.md` — every item homed at "4.9" (enumerated in Developer Context above) so you close the ones in scope and consciously defer the rest.

### Task 1 — the shared helper `lib/admin/command-route.ts` + `isPositiveInt` (AC: 1)
- [x] New `lib/admin/command-route.ts` — `import 'server-only'`; `handleAdminCommand` per DELIVERABLE 1's signature; export the capped `isPositiveInt`. The helper OWNS the gate order, the two 400 shapes, the refusal→status mapping, and the outer 500 try/catch. Actor is threaded as `gate.steamid64` into `run`.
- [x] `lib/admin/command-route.test.ts` (Vitest) — every branch: 403 (non-admin via a stub `requireAdmin`), 400 `invalid_json`, 400 `invalid_body`, a refusal → its mapped status, ok → the `ok()` payload, a thrown `run` → 500 `internal_error`. Inject stub clients (mirror `admin-guard.test.ts`).

### Task 2 — migrate the single-POST routes to the helper (AC: 1)
- [x] Rewrite `bracket`, `match/format`, `match/walkover`, `match/bind`, `approve`, `rollback`, `manual-score`, `roles`, `registration`, `roster` as thin definitions over `handleAdminCommand` (keep each route's `runtime`/`dynamic` exports, its `STATUS_FOR`, its `parseBody`, its lib call, its success payload). **`bracket`'s `parseBody` now uses the shared `isPositiveInt`** — closing the unbounded-int gap. **Do NOT change any route's external contract** (paths, status codes, body shape, success JSON) — this is a refactor, proven green by the existing route/lib tests.
- [x] `match/grace` stays hand-written (dual-verb POST/DELETE) — add a comment marking it the documented helper exception, and confirm it still calls `requireAdmin` on BOTH verbs.
- [x] The **AC1 structural coverage test** (`app/api/admin/__tests__/gated.test.ts` or similar): glob `app/api/admin/**/route.ts`, assert each references `handleAdminCommand` OR (for `grace`) `requireAdmin`. A new ungated route reddens CI.

### Task 3 — migration `0020_command_routes.sql`: drop the NOT NULL + `accept_anomaly` RPC (AC: 1, 2)
- [x] New `supabase/migrations/0020_command_routes.sql`. Header in the house style (the concern; SCOPE; OUT-OF-SCOPE each with its owning story; the SQLSTATE/action-vocabulary note).
- [x] `alter table public.audit_log alter column tournament_id drop not null;` + a column comment: *"nullable since 0020: event-global admin actions (grant_role, and an unbound-demo accept_anomaly) have no single tournament (AD-18)."* Re-confirm NO change to grants/policies (append-only intact).
- [x] `accept_anomaly(p_demo_id bigint, p_actor_steamid64 text) returns jsonb` per DELIVERABLE 3 — guards `bad_demo`/`not_anomalous`, the `validation_state` flip + `validated_at`, the `accept_anomaly` audit row (event-global NULL `tournament_id`, `target_match_id` NULL, real before/after), `return {ok:true, …}`. `security invoker`, `set search_path=''`.
- [x] **Service-role-only EXECUTE grant** — `revoke execute … from public; grant execute … to service_role;`.

### Task 4 — lib + route for accept-anomaly, and the `grant_role` audit row (AC: 1, 2)
- [x] `lib/admin/accept-anomaly.ts` (+ `.test.ts`) — mirror `lib/match/rollback.ts`; reasons `bad_demo | not_anomalous | write_failed`; fail-closed; ok-shape validation.
- [x] `app/api/admin/accept-anomaly/route.ts` — thin, via `handleAdminCommand`; body `{ demo_id }` (shared `isPositiveInt`); `statusFor` `{bad_demo:404, not_anomalous:409, write_failed:500}`; actor = `gate.steamid64`.
- [x] `lib/auth/roles.ts` `setRole` — after the `app_role` upsert, insert the `grant_role` audit row (event-global NULL `tournament_id`, real before/after role). Update `lib/auth/roles.test.ts` to assert the audit insert (payload shape + that it uses the acting admin as actor). Remove the `roles/route.ts:90-93` deferral comment.

### Task 5 — pgTAP: new `0020` suite (AC: 1, 2) — with EXACT `plan(N)`
- [x] New `supabase/tests/0020_command_routes_test.sql`. Header mapping each AC → lettered sections; `plan(N)` with exact per-section arithmetic; `finish(); rollback;`.
- [x] **Section A — AC1 grant matrix as a SET:** `has_function_privilege` for `service_role`=true, `anon`/`authenticated`=false, over the enumerated command-RPC list (DELIVERABLE 4). Include `accept_anomaly`.
- [x] **Section B — AC2 append-only re-confirmed:** `audit_log` has no update/delete grant to any role and no update/delete policy, AFTER the `tournament_id` widening; and the widening itself — a raw `insert into audit_log(tournament_id=null, …)` succeeds (the enabler for event-global rows).
- [x] **Section C — accept_anomaly behaviour:** anomalous demo → success (`validation_state='pending'`, `validated_at` set, ONE `accept_anomaly` audit row w/ real before/after); second call → `not_anomalous`; missing demo → `bad_demo`. **Mutation-proof** each effect independently (drop the audit insert → C's audit assertion RED; skip `not_anomalous` → the idempotence assertion RED; skip the flip → the state assertion RED).
- [x] **Section D — grant_role schema enablement:** the NOT NULL is gone (`is_nullable` on `audit_log.tournament_id` = YES) so the `setRole` event-global row is insertable. (The row's *content* is proven in `roles.test.ts`.)
- [x] **⭐ MUTATION-TEST EACH EFFECT INDEPENDENTLY** (standing lesson): record observed counts (as 0017/0018/0019 headers do). A green suite after any mutation is blind — fix the test, not the mutation.

### Task 6 — DELIVERABLE 5: correct the AD-17 / epics route enumeration (AC: 1, 2)
- [x] Add `accept_anomaly` to the `audit_log.action` vocabulary comment (`0003:25` is applied — do NOT edit it; instead note the extended vocabulary in the `0020` header and, if desired, in a fresh comment). Record in the story Completion Notes the full audited-admin-action set as SHIPPED: `generate_bracket, declare_format, advance, mark_walkover, begin_grace, resume, bind_demo, approve, rollback, manual_score, grant_role, accept_anomaly` — and that **re-parse has NO admin web route** (it is worker/CLI-driven, Story 3.6; AD-17 lists "re-parse" as an *action*, satisfied by the worker's audit path, not a Next.js route). Flag the `epics.md:812` list's omissions (`manual-score`, `accept-anomaly`) rather than editing planning artifacts unless Cuatro asks.

### Task 7 — Regression sweep (AC: all)
- [x] Full `supabase db reset` + `supabase test db`. Baseline is HEAD's total (`0019` left it at **843**; add your `0020` delta exactly). ⚠ **Predicted regressions: none** — dropping a NOT NULL is a widening; the new RPC + grants add rows; no existing constraint/trigger/fixture shifts. Re-confirm the `audit_log` fixtures across `0011`–`0019` stay green (they all insert with a non-null `tournament_id`, unaffected by the widening).
- [x] `npm test` (Vitest baseline **322**), `npm run lint` → 0, `npm run build` → 0 (the new `accept-anomaly` route registers; all migrated routes still build). Worker `go build ./... && go vet ./...` → 0 — and re-confirm **BY GREP** the worker touches no `audit_log`/route surface it should not: `grep -riE 'audit_log|accept_anomaly|validation_state' worker/` → only the existing `validation_state` writer (0008/Story 3.4), NOTHING new.

### Task 8 — THE BAR: live-QA the two new audited actions over the production seam (AC: 1, 2)
- [x] `supabase db reset` + re-apply the live-QA fixtures.
- [x] **Accept-anomaly live** over supabase-js → PostgREST → RPC: an `anomalous` demo → `accept_anomaly` → `validation_state='pending'`, ONE `accept_anomaly` audit row; then `bind_match_demo` on it SUCCEEDS (previously refused) — proving the unblock. A second `accept_anomaly` → `not_anomalous`.
- [x] **Accept-anomaly route gate live:** `POST /api/admin/accept-anomaly` as a NON-admin → 403 (the helper's gate bites); as admin → 200. Confirm the actor in the audit row is the authenticated admin, never the body.
- [x] **grant_role audit live:** `POST /api/admin/roles` granting/revoking → an event-global `grant_role` audit row (`tournament_id IS NULL`) with the acting admin + before/after role; confirm `app_role.granted_by/granted_at` still lands (the durable record).
- [x] **AC1 set live (spot-check):** pick two migrated routes (e.g. `approve`, `bracket`) and confirm a non-admin gets 403 and the `bracket` unbounded-int (`{tournament_id: 1e21}`) now returns **400**, not 500.

---

## DECISIONS (made in-story; overrule at review — the 4.1–4.8 pattern)

**DECISION A — ⭐ introduce the shared `handleAdminCommand` helper and migrate the 10 single-POST routes to it; `match/grace` stays hand-written.** RECOMMENDED. This is the literal deliverable the codebase named (*"Story 4.9 generalizes the audited-command-route boilerplate"*, `bracket/route.ts:19`) and the strongest form of AC1: one structural gate instead of eleven copies. The refactor changes NO external contract, so it is proven green by the existing route/lib tests plus the new coverage test. ⚠ **Overrule path:** if Cuatro considers refactoring eleven working routes unwarranted churn for a casual event, the minimal alternative is to keep the routes as-is and ship ONLY (a) the shared `isPositiveInt` applied to `bracket/route.ts:52`, and (b) the AC1 structural coverage test asserting every route calls `requireAdmin`. That still proves AC1-as-a-set and closes the unbounded-int gap, at the cost of leaving the boilerplate duplicated. **This is the story's biggest scope lever — see Question 1.**

**DECISION B — drop `audit_log.tournament_id`'s NOT NULL so `grant_role` (event-global) can be logged.** RECOMMENDED. AD-17 names `grant_role` as an audited action; AD-18 makes role event-global; the two collide against `0003:23`'s NOT NULL. Dropping it is a *widening* (append-only, grants, policies all intact; every existing row keeps its value). ⚠ **Overrule path:** for a casual friends event, `app_role.granted_by`/`granted_at` already durably records who granted what and when, so Cuatro may deem the `audit_log` row redundant and prefer to DOCUMENT the AD-17 divergence (grant_role's trail lives in `app_role`, not `audit_log`) with **no migration and no `setRole` change**. Recommended is the small honest schema fix that satisfies AD-17 literally. **See Question 2.**

**DECISION C — the `grant_role` audit row is written in `setRole` (TS), non-atomically after the `app_role` write.** RECOMMENDED. There is no `grant_role` RPC (setRole uses the Data API), so a single-transaction insert would require inventing one; the `app_role` write is already the durable source of truth (and lands first), so the audit insert is best-effort logging — a failure logs and does not roll back an idempotent grant. ⚠ Overrule path: wrap grant + audit in a small `grant_role` RPC for atomicity if the trail must be transactional — heavier than the casual-event threat model warrants.

**DECISION D — accept-anomaly flips ONLY `demo.validation_state` (`anomalous → pending`); it does not bind, approve, or set `idle_dq`.** RECOMMENDED and forced by scope. Story 3.4 AC2 is exactly *"advance it to Pending"*; binding is 4.6a, approving is 4.6b, and `idle_dq` is FR-21/Story 5.4. The mock's enabled-`Aprobar`-beside-the-banner and its second `idle_dq` override branch are NOT honoured here (they are the traps `deferred-work.md` flagged). ⚠ Overrule path: none recommended — widening accept-anomaly would smuggle unspecced admin actions into the audit-completeness story.

**DECISION E — DEFER the manual-resolution undo + the forfeit undo forward-tools to a dedicated Epic-4 follow-up (or the Epic-4 retro's call).** RECOMMENDED. These are substantial NEW `rollback_match`-family RPCs (widen the state guard + target-state mapping + un-seat dependent advances), not audit/gating hardening — a different concern the epic ACs do not cover. Folding them here re-creates the size problem that split Story 4.6. ⚠ Overrule path: if Cuatro wants a mis-entered manual score / a forfeit undoable NOW, the cheapest correct form is widening `rollback_match`'s state guard — its own slice, sized like 4.7. **See Question 3.**

**DECISION F — DEFER `advance_match`'s five bare `P0001` distinct-SQLSTATE change.** RECOMMENDED. `advance_match` has no direct route/lib caller (only internal RPC callers, which already convert its `{ok:false}` to distinct codes); its bare-`P0001` paths are genuine bracket corruption that legitimately 500. The "4.9's central map" rationale presumes a direct caller that does not exist. ⚠ Overrule path: give them a distinct custom SQLSTATE class if a future direct `advance` route lands (none is planned in Epic 4).

**DECISION G — the accept-anomaly mock traps (enabled Aprobar pre-accept; the `idle_dq` second branch) are NOT built.** RECOMMENDED — recorded so they are a conscious non-decision, not an oversight (they are Story 5.4 / the Epic-5 admin console's concern).

**DECISION H — the competitor-column audited write-once seam is treated as closed by Story 4.7's AD-8 allowlist-flag approach; not rebuilt here.** RECOMMENDED. 4.7 shipped the un-advance path with the allowlist flag rather than a write-once trigger; a second mechanism now would be redundant. ⚠ Overrule path: revisit only if a direct `match`-seating writer outside the RPCs ever appears.

---

## Dev Notes

### Architecture constraints (cited)
- **AD-8** (`ARCHITECTURE-SPINE.md:115-118`): *"every mutation flows through a Next.js server route that re-verifies `is_admin()` server-side, then writes via the service-role key."* → AC1. The helper (DECISION A) makes this a single gate; the coverage test proves no route bypasses it; the pgTAP grant matrix proves the second lock (service-role-only EXECUTE) holds as a set.
- **AD-17** (`:160-163`): *"every event-mutating admin action (generate bracket, advance, mark W.O., approve, re-parse, rollback, declare format, start ceremony, grant role) writes an `audit_log` row (actor SteamID64, timestamp, before/after). The table grants INSERT to service-role only and has no UPDATE/DELETE policy."* → AC2. Every match-mutating action already complies; this story closes `grant_role` (DELIVERABLE 2) and adds `accept_anomaly` (DELIVERABLE 3), and re-proves the append-only teeth after the `tournament_id` widening.
- **AD-18** (`:165-168`): *"Role in `app_role` is event-global in v1."* → the `tournament_id` NOT NULL tension DECISION B resolves.
- **Story 3.4 AC2** (`epics.md:531`): *"an admin must explicitly accept the anomaly (logged) to advance it to Pending."* → DELIVERABLE 3, and the reason `bind_match_demo`'s `anomalous` refusal needs an unblock step.
- **FR-33** (`prd.md:431-433`): admin-gated mutations + the audit trail — the FR this story's two ACs realize as a proven invariant.

### Current-state facts you must preserve (regressions to avoid)
- **`requireAdmin` is Option A (instant revoke) — do NOT change its logic** (`admin-guard.ts`). The helper calls it; it re-reads `app_role` per action.
- **`audit_log` is append-only by grant absence, not just policy absence** (`0003:72-84`) — `service_role` holds `select, insert` only. DECISION B's `drop not null` must NOT add any update/delete grant or policy. Re-prove this in pgTAP Section B.
- **`audit_log.actor_steamid64` is NOT NULL + FK to `player`** (`0003:24`) — every audit row (incl. `grant_role`, `accept_anomaly`) passes the acting admin's real steamid64.
- **`demo.validation_state` and `stat_row.status` are orthogonal axes** (`0008:32`) — accept-anomaly touches ONLY `validation_state`; it must not flip any `stat_row.status`.
- **Route external contracts are frozen** — the DECISION-A refactor changes internals only; every path, status code, body shape, and success payload stays identical (proven by the existing route/lib tests staying green).
- **`match/grace` is dual-verb** (`grace/route.ts` POST + DELETE) — it stays hand-written; both verbs keep their `requireAdmin` call.

### Scope boundaries (do NOT do these here)
- **No manual/forfeit undo forward-tools** (DECISION E — a dedicated Epic-4 follow-up).
- **No `advance_match` SQLSTATE churn** (DECISION F).
- **No competitor-column write-once trigger** (DECISION H — 4.7's approach stands).
- **No CSRF** (`deferred-work.md`, 4.1 review — Epic 7, uniform across all admin routes).
- **No accept-anomaly bind/approve/`idle_dq`** (DECISION G — accept-anomaly is the single `validation_state` flip).
- **No ceremony-lock guards** — `start_ceremony`/`ceremony_locked` do not exist until Epic 6; the AD-17 list's "start ceremony" is Story 6.x's audited action, not this story's (flag the seam, do not build it). The deferred ceremony-lock guards on approve/rollback/manual-score remain Story 6.2's (`deferred-work.md`).
- **No editing applied migrations** (0003 etc.) — the `action` vocabulary is uncapped `text`; extend it with no migration.
- **No worker change** — accept-anomaly and grant_role are app-side; the worker still owns setting `validation_state='anomalous'` (0008/Story 3.4).

### Project Structure Notes
- Migration `supabase/migrations/0020_command_routes.sql` + test `supabase/tests/0020_command_routes_test.sql`.
- New: `lib/admin/command-route.ts` (+ `.test.ts`), `lib/admin/accept-anomaly.ts` (+ `.test.ts`), `app/api/admin/accept-anomaly/route.ts`, `app/api/admin/__tests__/gated.test.ts` (the structural coverage test).
- Touched: all 10 single-POST routes (migrated to the helper), `lib/auth/roles.ts` (+ `.test.ts`) (grant_role audit row), `app/api/admin/roles/route.ts` (deferral comment removed).
- Schema: **one widening (`audit_log.tournament_id` nullable) + one new RPC + grants, no new table/column.** No worker change.

### Testing standards
- **pgTAP** with EXACT `plan(N)` accounting (standing since Epic 1). Run `supabase test db` once first to capture HEAD's live baseline (`0019` left it at 843); add the `0020` delta exactly.
- **Vitest** baseline 322 — the helper, accept-anomaly lib, roles-audit, and coverage tests add to it.
- **Mutation-test each effect INDEPENDENTLY** (Task 5) — the accept_anomaly flip, its audit row, its idempotence guard, and the grant-matrix set are each a way to be blind.
- **THE BAR (Task 8):** both new audited actions over the live seam (accept-anomaly unblocking a real bind; the event-global grant_role row), the helper's gate biting a non-admin live on a migrated route, and the bracket unbounded-int now returning 400.

### References
- [Source: ARCHITECTURE-SPINE.md] **AD-8 (`:115-118`)**, **AD-17 (`:160-163`) — the enumerated action list**, AD-18 (`:165-168`) — role event-global
- [Source: prd.md] FR-33 admin-gated + audit trail (`:431-433`)
- [Source: epics.md] **Story 4.9 (`:803-819`)**; **Story 3.4 AC2 (`:531`) — accept-anomaly "advance to Pending, logged"**; the route list to correct (`:812`)
- [Source: supabase/migrations/0003_audit_snapshot.sql] `audit_log` shape + append-only grant/policy posture (`:72-84`); `action` vocabulary (`:25`); `tournament_id NOT NULL` (`:23`); `actor_steamid64` FK (`:24`)
- [Source: supabase/migrations/0008_demo_validation.sql] `demo.validation_state` axis (`:31-44`); the accept-anomaly OUT-OF-SCOPE→Epic-4 note (`:17-20`); the orthogonality note (`:32`)
- [Source: supabase/migrations/0010_match.sql:198] the `audit_log_target_match_fk` (the 0003 FK-deferral, now satisfied)
- [Source: supabase/migrations/0016_bind_and_score.sql] `bind_match_demo`'s `anomalous` refusal (why accept-anomaly unblocks it) + its typed-refusal guard shapes
- [Source: app/api/admin/approve/route.ts + bracket/route.ts] the byte-repeated envelope the helper extracts; the correct `isPositiveInt` (approve:51-52) vs the unbounded gap (bracket:52); the `4.9 generalizes the boilerplate` note (bracket:19)
- [Source: app/api/admin/roles/route.ts:90-93] the explicit *"grant_role audit deferred to Story 4.9"* note + the `tournament_id` tension; [lib/auth/roles.ts] `setRole` (the audit row's home)
- [Source: lib/auth/admin-guard.ts] `requireAdmin` — the gate primitive (do not modify)
- [Source: lib/match/rollback.ts] the lib shape `accept-anomaly.ts` mirrors; [lib/match/approve.ts] the SQLSTATE-const + reason-Set + ok-shape-validation convention
- [Source: deferred-work.md] every item homed at "4.9": the `bracket:52` unbounded-int (4.2 review), the accept-anomaly orphan (4.6 create-story), the route-list omissions (4.6/4.8), the manual/forfeit undo (4.7/4.8 — DECISION E), `advance_match`'s bare `P0001`s (4.3/4.5 — DECISION F), the competitor-column seam (4.3 — DECISION H), CSRF (4.1 — out of scope)

---

## Questions for Cuatro (surfaced at the end, per the workflow — answer before or at review)

1. **Scope lever (DECISION A):** ship the full `handleAdminCommand` refactor of all 10 single-POST routes (recommended — makes AC1 a single structural gate), or the **minimal** alternative (shared `isPositiveInt` on `bracket:52` + the AC1 coverage test only, routes left duplicated)? The full refactor is higher-value but touches eleven working files.
2. **grant_role audit (DECISION B):** write the event-global `audit_log` row by dropping `audit_log.tournament_id`'s NOT NULL (recommended — satisfies AD-17 literally), or accept `app_role.granted_by/granted_at` as the record and just DOCUMENT the AD-17 divergence (no migration, no code)?
3. **Undo forward-tools (DECISION E):** confirm DEFER of the manual-resolution undo + forfeit undo to a dedicated Epic-4 follow-up / retro call — or pull one of them into this story now? (Recommended: defer; they are a distinct concern the epic ACs don't cover, and each is ~a 4.7-sized slice.)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story, 2026-07-19, baseline 6e8eddc).

### Debug Log References

- **oxc parse error at first run** — `**/route.ts` inside a `/** … */` JSDoc contains `*/`, which prematurely CLOSED the block comment, so the rest of the file parsed as code (`` `Number.isInteger(1e21)` `` read as a template literal → "Expected a semicolon"). Fixed by rewording the three affected comments (`lib/admin/command-route.ts`, `lib/admin/route-coverage.test.ts`) to avoid the `**/` sequence. A subtle lesson worth keeping: never write a `**/glob` inside a block comment.
- **Env trap (memory: local-live-qa-env-traps)** — the live-QA driver got `ECONNREFUSED 127.0.0.1:54321`; Kong is remapped to host **55321** while `supabase status` still prints 54321. Pointed the driver at 55321. (No WinNAT/54322 incident this session.)
- **pgTAP Section D→B reorder** — the schema `col_is_null` check read GREEN under the "re-add NOT NULL" mutation when it ran AFTER B6's caught null-insert failure (stale catalog snapshot within the same transaction after a subtransaction rollback). Verified the assertion is sound in isolation (goes `not ok` under NOT NULL), then moved it BEFORE B6 (as B5) so both halves of the widening redden cleanly under the mutation.

### Completion Notes List

**What shipped (all four deliverables + DECISIONS as recommended, confirmed by Cuatro up front):**
- **DELIVERABLE 1 (DECISION A — full refactor):** `lib/admin/command-route.ts` — `handleAdminCommand<TBody,TResult>` encapsulates the whole POST envelope (gate → json-parse → parseBody → run → refusal-status map → 500 boundary) + exports the range-capped `isPositiveInt`. All **10 single-POST routes** migrated to it as thin definitions (bracket, match/format, match/walkover, match/bind, approve, rollback, manual-score, roles, registration, roster). `match/grace` stays hand-written (dual-verb, documented exception). NO external contract changed (proven by the existing route/lib tests staying green + the build). The AC1 guardrail: `lib/admin/command-route.test.ts` (11 helper-branch tests + isPositiveInt) and `lib/admin/route-coverage.test.ts` (static source scan asserting every `app/api/admin/**` route.ts references the helper, or `requireAdmin` for grace — a new ungated route reddens CI).
  - ⚠ **`bracket` got the `isPositiveInt` fix** (the named deferred-work item): `{tournament_id: 1e21}` is now a clean **400**, not a 22003→500. **registration + roster** carry the identical latent gap but keep their bare `Number.isInteger(tournament_id)` validators — Story 4.9 scoped the fix to `bracket` and froze every other route's external contract (switching them would flip `tournament_id ≤ 0` from 404→400). Flagged in each file + here for a follow-up if Cuatro wants uniformity.
- **DELIVERABLE 2 (DECISION B — drop NOT NULL + write the row):** migration `0020` drops `audit_log.tournament_id`'s NOT NULL (a widening — append-only grants/policies untouched); `setRole` (`lib/auth/roles.ts`) now writes the event-global `grant_role` audit row (tournament_id NULL, actor = acting admin, real before/after via a prior-role pre-read) — non-atomic after the durable `app_role` write (a failure logs, does not roll back the idempotent grant). `roles/route.ts`'s "DEFERRED to 4.9" comment removed. `lib/auth/roles.test.ts` extended (+5) to assert the audit insert shape, the prior-role capture, that a failed upsert writes NO audit row, and that a failed audit insert does not fail the grant.
- **DELIVERABLE 3 (accept-anomaly):** `accept_anomaly(bigint,text)` RPC in `0020` (security invoker, service-role-only EXECUTE) — guards `bad_demo`/`not_anomalous`, flips `demo.validation_state` anomalous→pending + stamps `validated_at`, writes one event-global `accept_anomaly` audit row. `lib/admin/accept-anomaly.ts` (mirrors rollback.ts) + `lib/admin/accept-anomaly.test.ts` (+8) + `app/api/admin/accept-anomaly/route.ts` (thin, via the helper). Flips ONLY `validation_state` (DECISION D/G — no bind/approve/idle_dq).
- **DELIVERABLE 4 (catalog invariant guard):** `supabase/tests/0020_command_routes_test.sql`, plan(35): Section A the grant matrix as a SET over all 11 command RPCs + accept_anomaly (service_role-only EXECUTE); Section B append-only re-confirmed after the widening + the event-global insert; Section C accept_anomaly behaviour. **Mutation-tested BY EXECUTION** (5 mutations, all reddened correctly, restored clean — see the suite header's ledger).
- **DELIVERABLE 5 (enumeration correction):** the SHIPPED audited-admin-action set is recorded in the 0020 header (`generate_bracket, declare_format, advance, mark_walkover, begin_grace, resume, bind_demo, approve, rollback, manual_score, grant_role, accept_anomaly`) — and **re-parse has NO admin web route** (worker/CLI-driven, Story 3.6; its audit trail is on the worker path). ⚠ **The story's DELIVERABLE-4 list named a phantom `begin_grace` alongside `begin_match_grace`; no such function exists** — the grace RPCs are `begin_match_grace` + `resume_match` (0015). Corrected in the pgTAP enumeration. `epics.md:812`'s list omits `manual-score` + `accept-anomaly`; flagged here, planning artifacts NOT edited (per the story — awaiting Cuatro).

**DEFERRED as recommended (Cuatro confirmed up front):** DECISION E (manual/forfeit UNDO forward-tools → a dedicated Epic-4 follow-up / retro call), DECISION F (advance_match's five bare P0001 — no direct caller), DECISION H (competitor-column seam — 4.7's AD-8 flag stands), CSRF (Epic 7). ⚠ **Story 6.2 still owes the `ceremony_locked` guard to approve/rollback/manual-score** (AD-15) — unchanged by this story.

**Gates (all green, verified by execution 2026-07-19):**
- **pgTAP 878 PASS** (843 baseline → +35 from 0020; ZERO regressions across all 21 suites). Mutation-verified: neuter accept_anomaly REVOKE → test 22 RED; re-add NOT NULL → tests 27+28 RED; grant UPDATE on audit_log → test 23 RED; drop accept_anomaly audit insert → tests 31/32/34 RED; skip not_anomalous guard → tests 33/34 RED. Baseline + each restore clean.
- **Vitest 362 PASS** (322 baseline → +40). **lint 0. build 0** (the `/api/admin/accept-anomaly` route registers; all migrated routes build — TypeScript inference on `handleAdminCommand` holds). **Worker go build/vet 0**, grep-clean (only the existing Story-3.4 `validation_state` writer; no new audit_log/route/accept_anomaly surface).
- **🏆 THE BAR — 11/11 LIVE** over supabase-js → PostgREST → RPC (real Kong on host 55321): anon `accept_anomaly` REFUSED (the service-role-only EXECUTE second lock bites live); `bind_match_demo` on the anomalous demo → `anomalous`; `accept_anomaly` → pending + validated_at + exactly ONE event-global audit row (actor=admin, tournament_id/target_match_id NULL, before/after anomalous→pending); **⭐ `bind_match_demo` then SUCCEEDS → `pending` (the UNBLOCK — the previously-refused bind now works)**; a second accept → `not_anomalous`; a non-existent demo → `bad_demo`; a service_role event-global `grant_role` audit row (tournament_id NULL) inserts over PostgREST (DELIVERABLE 2's schema enablement live); anon CANNOT insert into audit_log (append-only + admin-only, fail-closed).
  - ⚠ **NOT driven over live HTTP:** the Next.js route gate (403 non-admin) and the `bracket` `{1e21}`→400 over an authenticated-admin browser session — no live authenticated-admin HTTP harness is automatable here (requireAdmin needs a verified Steam session cookie). Those are proven by the helper's unit tests (403 / invalid_json / invalid_body / refusal-status / 500 branches all covered in `command-route.test.ts`; isPositiveInt(1e21)=false pinned) + the route-coverage structural test + the build registering the route. The RPC/DB/seam layer — where AC1's second lock and AC2's audit actually live — was proven live AND adversarially (anon refused), which is where the real teeth are.

### File List

**New:**
- `lib/admin/command-route.ts` — the shared `handleAdminCommand` envelope + `isPositiveInt`.
- `lib/admin/command-route.test.ts` — helper branch tests + isPositiveInt (Vitest).
- `lib/admin/route-coverage.test.ts` — the AC1 structural coverage test (Vitest).
- `lib/admin/accept-anomaly.ts` — the accept-anomaly lib (mirrors rollback.ts).
- `lib/admin/accept-anomaly.test.ts` — accept-anomaly lib tests (Vitest).
- `app/api/admin/accept-anomaly/route.ts` — the accept-anomaly route (thin, via the helper).
- `supabase/migrations/0020_command_routes.sql` — drop tournament_id NOT NULL + accept_anomaly RPC + grants.
- `supabase/tests/0020_command_routes_test.sql` — the AC1/AC2 catalog invariant + accept_anomaly suite (plan 35).

**Modified:**
- `app/api/admin/approve/route.ts`, `bracket/route.ts`, `manual-score/route.ts`, `match/bind/route.ts`, `match/format/route.ts`, `match/walkover/route.ts`, `registration/route.ts`, `roles/route.ts`, `rollback/route.ts`, `roster/route.ts` — migrated to `handleAdminCommand` (bracket also gets the `isPositiveInt` unbounded-int fix; roles' deferral comment removed).
- `app/api/admin/match/grace/route.ts` — documented-exception comment (stays hand-written, dual-verb).
- `lib/auth/roles.ts` — `setRole` writes the `grant_role` audit row (DELIVERABLE 2 / DECISION B).
- `lib/auth/roles.test.ts` — asserts the grant_role audit row (+5 tests).

### Change Log

- 2026-07-19 — Story 4.9 implemented (bmad-dev-story, baseline 6e8eddc): the audit-and-gating COMPLETENESS slice. Shared `handleAdminCommand` helper + all 10 single-POST routes migrated (AC1 as one structural gate + a coverage test); the `grant_role` event-global audit row via a widened `audit_log.tournament_id` (migration 0020); the orphaned `accept_anomaly` audited route (RPC + lib + route, unblocking bind); a pgTAP grant-matrix + append-only + accept_anomaly suite (plan 35, mutation-verified). Gates: pgTAP 878, Vitest 362, lint/build 0, worker clean; THE BAR 11/11 live over the seam. Status → review. DECISIONS A/B/E confirmed by Cuatro up front; C/D/F/G/H stand as recommended; 3 open questions in the story now resolved (A/B/E).
