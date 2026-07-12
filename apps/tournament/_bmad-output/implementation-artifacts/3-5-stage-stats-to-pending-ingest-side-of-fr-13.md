---
baseline_commit: a3b53b4f5a787f50112ba27e6dbcce4f12039385
---

# Story 3.5: Stage stats to Pending (ingest side of FR-13)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **admin**,
I want parsed stats to land in a **Pending** state visible only to me — with **viewers structurally unable to read anything but Approved rows** —,
so that **nothing reaches viewers until I approve it** and the "the admin sees it / everyone sees it" line is enforced by the database, not by application code.

**This is the fifth story of Epic 3 — it turns ON the viewer-facing half of the AD-7 two-policy Pending model on `stat_row`.** Stories 3.1–3.4 built the ingest pipeline through `Validating`: 3.3 already writes every parsed row with `status='pending'` (the column default) and 3.4 added the anomaly gate. Today `stat_row` is **admin/worker-only** — it has RLS `FORCE` + a **dormant** `stat_admin` (`is_admin()`) SELECT policy, but **no anon/authenticated grant at all**, so every client read fails closed at the grant gate. Story 3.5 adds the two missing pieces that make the publish axis (`stat_row.status`) actually mean something to a reader: the **live viewer policy `stat_view USING (status='approved')`** and the **anon/authenticated SELECT grant** that makes it (and the dormant admin policy) reachable. After 3.5, a viewer who queries `stat_row` sees only Approved rows; an admin sees Pending too — enforced at the row level, by construction.

The scope is the **thinnest provable slice in Epic 3: one migration + its pgTAP proof, plus the mandatory regression update to the 0007 test that 0009 invalidates.** There is **no Go worker code and no TypeScript/app code** — the rows already land `pending`, and the publish (**Aprobar**) action that flips them to `approved` is **Story 4.6** (Epic 4). It stops before the admin ingest-queue UI and the leaderboard view (Epic 5), the Realtime publication (Epic 5), and any approval write (Epic 4).

## Acceptance Criteria

> Restated from `epics.md#Story 3.5` (lines 539–559), elaborated with the design decisions resolved during story creation (see **Dev Notes → Key design decisions**). Traces: **FR-13 (ingest) · AD-7**.

**AC1 — Parsed stats land `Pending`; the match's Pending-ness is the derived aggregate of its rows (FR-13, AD-7).**
Every fresh parse writes its `stat_row` rows with `status='pending'` — this is **already true** (migration 0007 defaults `status` to `'pending'`; `RecordParse` omits `status` on INSERT and preserves it on `ON CONFLICT DO UPDATE` — [worker/db/db.go:223-229]). Story 3.5 adds **no worker code** for this AC; it holds by construction. The "**match enters the `Pending` state labeled `Pendiente`**" clause of the epic AC has **no schema home in Epic 3**: there is no `match` table until Epic 4, so a match's Pending-ness is the **aggregate** of its stat rows' `status` (all `pending` ⇒ the match is Pending), and `Pendiente` is a Spanish **display label** (`SOLUTION-DESIGN §7`: `status.pending → "Pendiente"`), an Epic-5 viewer/admin-console concern. Do **not** invent a `match.state`/`match_status` column or a label constant here (see Resolved Decision 2).

**AC2 — The AD-7 two-policy model goes LIVE on `stat_row`: a viewer policy + the reachability grant, kept as two SEPARATE policies.**
Migration `0009` adds:
1. `create policy stat_view on public.stat_row for select to anon, authenticated using (status = 'approved');` — the **viewer** policy, with **no `is_admin()` escape hatch** in its `USING` clause (AD-7).
2. `grant select on public.stat_row to anon, authenticated;` — the base-table SELECT grant that makes `stat_view` (and the already-present, until-now-dormant `stat_admin`) reachable. Writes stay single-writer (no anon/authenticated write grant or policy — unchanged).
The **admin** half — `stat_admin USING ((select public.is_admin()))` — **already exists** from migration 0007; 3.5 does not recreate it. The two remain **separate permissive policies, never merged into one `USING (status='approved' OR is_admin())`** (AD-7): Postgres OR's them at eval time (approved-for-everyone ∪ everything-for-admin), but keeping them separate means a malformed admin policy can only ever **add admin's own rows**, never widen the viewer's approved-only set.

**AC3 — Viewers read Approved-only; Pending rows are invisible to them; admins see both (the row-level teeth).**
With RLS `FORCE` + the two policies + the grant:
- **anon** and **authenticated non-admin** (no `role=admin` claim) reading `stat_row` see **only** `status='approved'` rows; `status='pending'` rows are filtered out by RLS (not merely by convention).
- **authenticated admin** (`is_admin()` true) sees **both** `pending` and `approved` rows (via the `stat_admin` policy OR'd with `stat_view`).
- No client can write `stat_row` (no write grant/policy — fail closed, unchanged).

**AC4 — Migration `0009` + pgTAP prove the teeth bite; the invalidated `0007` test assertions are corrected so the whole suite stays green.**
`supabase/migrations/0009_stat_pending_visibility.sql` (purely additive: one policy + one grant, no `ALTER` of existing objects). A new `supabase/tests/0009_stat_pending_visibility_test.sql` with explicit `plan(N)` proves: the exact policy set is now `{stat_admin, stat_view}`; `stat_view` is a SELECT policy to `{anon, authenticated}` whose `USING` references `status` and **not** `is_admin` (the never-OR'd guarantee); the grant matrix (`anon`+`authenticated` now hold SELECT; still no INSERT/UPDATE/DELETE; `service_role` unchanged); and the **behavioral** row-level filtering (seed one `approved` + one `pending` row; as `anon`/`authenticated`-viewer see only the approved row, as `authenticated`-admin see both). **Because `supabase test db` runs every test against the fully-migrated (0001→0009) schema, `0009` INVALIDATES three assertions in `0007_stat_row_test.sql`** (`policies_are(ARRAY['stat_admin'])`; `anon`/`authenticated` SELECT `= false`; the Section-D `42501` "cannot read" blocks). Story 3.5 **must** update those (see Task 2) so the suite passes. `supabase test db` Files **9 → 10**; the `0003` generic FORCE-guard + `canonical_steamid64_invariant_test.sql` + all other suites stay green.

**AC5 — Boundary: no worker/app/TS change; Aprobar (publish) is explicitly Story 4.6.**
No Go worker code (`git diff worker/` empty), no TypeScript (`git diff lib/ app/` empty; `vitest run` unchanged), no new env / `NEXT_PUBLIC_*`. The **publish** side of the dual-owned FR-13 — flipping `status → 'approved'`, stamping `approved_at`/`approved_by` (columns already exist in 0007), advancing the bracket, posting the feed, recomputing leaderboards, all in one transaction (AD-6) — is **out of scope here and owned by Story 4.6** (`Aprobar`). 3.5 writes **no approval**.

### Out of scope (do NOT build here)

- **The `Aprobar` publish action** (`Pending → Approved`: `status='approved'` + `approved_at`/`approved_by` + advance bracket + post feed + recompute leaderboards, one DB transaction) — **Story 4.6** (AD-6, AD-8). 3.5 makes Pending invisible to viewers; it never approves.
- **Any Go worker change.** Rows already land `status='pending'` (0007 default; `RecordParse` preserves it). This migration is the entire 3.5 deliverable. Do not add a redundant explicit `status='pending'` write.
- **A `match.state`/`match_status` column or the `Pendiente`/`Aprobado` Spanish labels.** No `match` table until Epic 4; the match's Pending-ness is derived from `stat_row.status`, and the label map (`SOLUTION-DESIGN §7`) is Epic-5 viewer/admin-console i18n. (Resolved Decision 2.)
- **The leaderboard view/RPC over `status='approved'`** (AD-20) — **Story 5.5**. 3.5 is the base-table RLS teeth the leaderboard view later reads through.
- **Adding `stat_row` to a Supabase Realtime publication** (the ~2 s viewer nudge) — **Epic 5** (Story 5.8). The viewer policy governs Realtime reads too, but the publication config is not 3.5's.
- **The admin ingest-queue UI** ("parsed Pending stats, eyeball score, **Aprobar**", `EXPERIENCE.md:44`) — the app-surface epic. 3.5 delivers only the DB visibility model the UI later reads.
- **The `stat_row (status)` partial index** — an Epic-5 leaderboard optimization (`SOLUTION-DESIGN §3`); a friends tournament is tens of matches. Not here.
- **Any change to `demo.validation_state` (the anomaly axis, 3.4).** Anomaly (`demo`) and publish (`stat_row.status`) are **orthogonal** axes; both fail closed for viewers. 3.5 touches only the publish axis.

## Tasks / Subtasks

- [x] **Task 1 — Migration `0009_stat_pending_visibility.sql` (AC1, AC2, AC3)**
  - [x] Create `supabase/migrations/0009_stat_pending_visibility.sql`. Header-comment style of `0005`/`0007`/`0008`: a SCOPE block (add the LIVE `stat_view` viewer policy + the anon/authenticated SELECT grant = the two-policy Pending model going live) and an explicit **OUT OF SCOPE** block (Aprobar publish → Story 4.6; no worker/app code — rows already land pending; no `match.state`/`Pendiente` label → Epic 4/Epic 5; leaderboard view → Story 5.5; Realtime publication → Epic 5; `stat_row(status)` index → Epic 5).
  - [x] `create policy stat_view on public.stat_row for select to anon, authenticated using (status = 'approved');` — **no** `is_admin()` in the `USING` clause (AD-7). No `(select …)` init-plan wrap is needed (the qual is a plain column compare, not a function call — unlike `stat_admin`).
  - [x] `grant select on public.stat_row to anon, authenticated;` — SELECT only. Comment that this is the reachability grant: until now `stat_row` had **no** anon/authenticated grant (0007), so both `stat_view` and the dormant `stat_admin` were unreachable (every client read `42501`'d at the grant gate before RLS ran). Writes stay single-writer — **no** write grant/policy added.
  - [x] Do **not** recreate or `ALTER` `stat_admin` (it exists from 0007), do **not** touch `stat_row`'s columns/RLS-enable/FORCE (all set in 0007), and add **no** new grant to `service_role` (it already holds SELECT/INSERT/UPDATE/DELETE). The migration is exactly one `create policy` + one `grant`.
  - [x] `supabase db reset` applies `0001→0009` cleanly. **(Verified: all 9 migrations applied clean, 0009 last.)**

- [x] **Task 2 — Update `0007_stat_row_test.sql` for the post-0009 world (AC4 — the regression fix; do NOT skip)**
  - [x] `supabase test db` runs every test file against the **fully-migrated** schema, so `0009` makes three `0007` assertions false. Fix them **in place** so `0007` stays a true, green "table structure + single-writer grant" proof and `0009` owns the viewer-model proof:
    - [x] `policies_are('public','stat_row', ARRAY['stat_admin'], …)` ([0007_stat_row_test.sql:94-98]) → `ARRAY['stat_admin','stat_view']` (comment: "`stat_view` added by 0009"). Keep/duplicate `policy_cmd_is('public','stat_row','stat_admin','SELECT', …)`; the `stat_view` cmd/roles assertions live in the 0009 test.
    - [x] `has_table_privilege('anon','public.stat_row','SELECT')` and `has_table_privilege('authenticated','public.stat_row','SELECT')` ([0007_stat_row_test.sql:108,112]) → flip both expected values `false → true` and reword ("granted by 0009's viewer model"). Leave the anon/authenticated INSERT/UPDATE/DELETE = `false` assertions untouched (writes are still fail-closed).
    - [x] The **Section-D behavioral** blocks that assert `42501` "cannot read" for the authenticated viewer, authenticated admin, and anon now **would not throw** (the grant exists) — **removed** them from 0007 and replaced with a one-line comment pointing to `0009_stat_pending_visibility_test.sql` for the row-level visibility proof. Kept the `service_role` write-path block and the authenticated-viewer **INSERT** `42501` block — both unchanged by 0009.
    - [x] Recount and update `0007`'s `plan(36)` → `plan(33)` (removed the 3 read-`42501` blocks; the two flipped grant values and the policy-set change do not alter the count).
  - [x] Re-run `supabase test db`: `0007` green again against the 0001→0009 schema.

- [x] **Task 3 — pgTAP `0009_stat_pending_visibility_test.sql` (AC2, AC3, AC4)**
  - [x] Create `supabase/tests/0009_stat_pending_visibility_test.sql` with explicit `plan(23)`, mirroring the `0007`/`0008` role-switch + `set_config('request.jwt.claims', …)` + assertion-accounting style. Seed (as `postgres`, BYPASSRLS, before any role switch) **one `demo`** FK parent, then **two `stat_row`s** sharing a `match_id`: one `status='approved'`, one `status='pending'` (default, via a separate INSERT). `stat_row.demo_id` is a FK → `demo`; `match_id` is a plain bigint (no FK) — mirrors the 0007 seeding.
  - [x] **Policy set + shape:** `policies_are('public','stat_row', ARRAY['stat_admin','stat_view'], …)`; `policy_cmd_is('public','stat_row','stat_view','SELECT', …)`; assert `stat_view` applies to `{anon, authenticated}` (`roles @> {anon,authenticated}`) and its `USING` expression references `approved` (`qual ~ 'approved'`) but **not** `is_admin` (`qual !~ 'is_admin'` — the AD-7 never-OR'd guarantee).
  - [x] **Grant matrix:** `has_table_privilege('anon','public.stat_row','SELECT') = true`; `has_table_privilege('authenticated','public.stat_row','SELECT') = true`; both `INSERT/UPDATE/DELETE = false`; `service_role SELECT/INSERT/UPDATE/DELETE = true` (unchanged).
  - [x] **Behavioral — the money tests (AC3):**
    - `set local role anon;` (no JWT claims ⇒ `is_admin()` = false) → `select count(*) from stat_row` returns **1** (approved only); pending count is **0** and the visible `steamid64` is the approved `…930`.
    - `set local role authenticated;` + viewer claim → count **1** (approved-only; `is_admin()` false).
    - `set local role authenticated;` + admin claim → count **2** (admin sees pending + approved via `stat_admin`), pending count **1**.
    - `set local role postgres;` between blocks (the 0007/0008 pattern).
  - [x] `supabase test db` Files **9 → 10**; the `0003` generic FORCE-guard, `canonical_steamid64_invariant_test.sql`, and all other suites stay green. **(Verified: Files=10, Tests=300, all pass.)**

- [x] **Task 4 — Green bar + boundary discipline (AC1–AC5)**
  - [x] `supabase db reset` (0001→0009 clean) and `supabase test db` — **Files 10**, all green (0007 updated → plan(33), 0009 new → plan(23)).
  - [x] **DB-only proof:** `git diff --stat -- worker/` **empty**; `git diff --stat -- lib app` **empty**; `vitest run` unchanged (11 files / 110 tests pass); `next build` clean. No `NEXT_PUBLIC_*`; `lib/env.ts` untouched.
  - [x] Confirmed no `stat_admin` recreation, no `stat_row` column/RLS change, no `service_role` grant change, no approval write, no `match`/label artifact. Migration is exactly one `create policy` + one `grant`.

- [x] **Task 5 — Live-QA sign-off (human gate; Deploy-posture = local verify, live Railway/MatchZy still Epic 7)**
  - [x] **Prereq / rows:** seeded a real `demo` + one `approved` + one `pending` `stat_row` against the running local Supabase (`127.0.0.1:54322`) inside a rolled-back transaction. *(Substituted a direct-SQL seed for the full `worker ingest` run: the worker path was already live-QA'd in 3.3/3.4 and RLS is agnostic to how rows are written; the operational `season`+`tournament`+`roster_entry` fixture — open action-item #5 — plus a real `worker ingest` remains the human sign-off exercise at review→done, per the 3.3/3.4 precedent.)*
  - [x] **Viewer sees approved-only:** as `anon` (and as `authenticated` non-admin viewer) `select * from stat_row` returned **only** the approved row; the `pending` row was **absent** — invisible, enforced by RLS. ✓
  - [x] **Admin sees pending:** as an `authenticated` session with `app_metadata.role='admin'` (`is_admin()` true) the read returned **both** the pending and approved rows. ✓
  - [x] **Write still fail-closed:** an `anon` `insert` on `stat_row` raised `42501` (`permission denied for table stat_row`); no write grant/policy exists (authenticated-write `42501` is additionally proven in 0007/0009 pgTAP). ✓
  - [x] **QA cleanup:** the whole live-QA ran inside a transaction that `rollback`'d — no `stat_row`/`demo` test rows persist. ✓
  - [x] **Deferred to Epic 7 (unchanged):** live Railway deploy + rented MatchZy; the hosted-DB IPv4/pooler gap (3.1 finding). Local-verify is exactly what Task 5 specifies.

## Review Findings

_Code review 2026-07-12 (baseline `a3b53b4`; layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor, all Opus 4.8). **Clean review** — AC1–AC5 + the full out-of-scope list PASS (Acceptance Auditor: fully compliant); both `plan()` counts reconcile arithmetically (0009 `plan(23)`, 0007 `plan(33)`). No `decision-needed`, no `patch`. 7 findings dismissed as noise: the Blind Hunter's top "anon evaluates `stat_admin` qual → could throw" is a false positive — `stat_admin` is `for select to authenticated` only ([0007_stat_row.sql:69](../../supabase/migrations/0007_stat_row.sql#L69)), so an anon read never evaluates it, and the green run empirically returns `anon count=1`; is_admin() robustness, RLS-enable-implicit, `roles @>` containment, and `steamid64` type were all dismissed against the shipped schema; the "`'...'` placeholder descriptions" finding was an artifact of the diff summarization (the real test files carry full descriptive messages). Two low-severity items deferred (below)._

- [x] [Review][Defer] Column-blind `grant select` exposes `approved_by`/internal columns to anon on approved rows [supabase/migrations/0009_stat_pending_visibility.sql:35] — deferred, real but not actionable now (`approved_by`/`approved_at` are null until Story 4.6; spec prescribes the table-wide grant; casual-event privacy posture).
- [x] [Review][Defer] `create policy stat_view` is non-idempotent (no `drop … if exists`) — a mid-migration re-apply errors `42710` instead of no-op'ing [supabase/migrations/0009_stat_pending_visibility.sql:30] — deferred, pre-existing repo-wide convention (matches 0002/0007), not introduced by this change.

## Dev Notes

### Key design decisions (resolved during story creation, 2026-07-11 — Cuatro to confirm at review; build for these)

1. **⭐ Story 3.5 is a DB-only slice — migration `0009` (the `stat_view` viewer policy + the anon/authenticated SELECT grant) + pgTAP — with NO Go worker or TypeScript/app code.** *(Chosen over adding a redundant explicit `status='pending'` worker write, and over pulling any admin/viewer UI forward.)*
   *Why:* the only two things standing between today's state and FR-13's ingest half are the **viewer policy** and the **reachability grant** — everything else already exists. 3.3 already writes `status='pending'` (0007's column default; `RecordParse` [worker/db/db.go:223-229] omits `status` on INSERT and preserves it on `ON CONFLICT DO UPDATE`), so AC1's "rows written Pending" holds by construction — adding an explicit `status='pending'` write would be redundant and would risk clobbering an approved row on a future re-parse (that concern is Story 3.6's `revert→reparse→republish`). There is no viewer/admin UI in any epic yet (backend-first, exactly as 3.4 folded 2.6 to a data surface only). So the substantive, in-character deliverable is the **row-level RLS teeth** the future UI + leaderboard view will read through — one `create policy` + one `grant`, plus the mandatory regression fix to the 0007 test.

2. **⭐ The "match enters the `Pending` state labeled `Pendiente`" clause has NO schema home in Epic 3 — it is the derived aggregate of `stat_row.status`, and `Pendiente` is an Epic-5 viewer label. Do NOT add a `match.state` column or a label constant.** *(Chosen over inventing a `match`/`match_status` artifact to represent the match-level Pending state.)*
   *Why:* this is the direct analogue of the 3.4 finding that `Anomalous` had nowhere to live (3.4 put `validation_state` on `demo`). But here there is nothing to persist: there is **no `match` table until Epic 4** (`stat_row.match_id` is a plain bigint, no FK — [0007_stat_row.sql:37]), and a match's Pending-ness is fully recoverable as "all of this match's `stat_row`s have `status='pending'`" (`SOLUTION-DESIGN §6`: *"rows written, match stays Pending"*). The planned `match.state` enum is the bracket lifecycle (`declared/live/pending/resolved/…`, Epic 4), not the publish axis. `Pendiente`/`Aprobado` are Spanish **display labels** (`SOLUTION-DESIGN §7` label map: `status.pending → "Pendiente"`), rendered by the Epic-5 admin ingest queue / viewer surfaces. Inventing either here would be schema/vocabulary the roadmap models elsewhere — over-engineering for a casual event, guaranteed rework at Epic 4/5.

3. **⭐ The viewer policy is named `stat_view`, `to anon, authenticated`, `using (status='approved')`; kept SEPARATE from the existing `stat_admin` (`is_admin()`) policy, never OR'd.** *(Naming chosen to match the shipped sibling + the spec, over the generic `<t>_viewer_read` template.)*
   *Why:* `SOLUTION-DESIGN §4` (L279-281) and the `0007` hand-off comment both name it **`stat_view`**, and migration 0007 already shipped the admin half as **`stat_admin`** (not `stat_admin_read`), so `stat_view` keeps the pair consistent. The generic 0002 template used `<t>_viewer_read`/`<t>_admin_read`, but matching the already-shipped `stat_admin` wins. AD-7's **two-separate-policies, never-`OR`'d** rule is the crux: two permissive policies are OR'd by Postgres at eval time (giving approved-for-all ∪ everything-for-admin), but authoring them separately means a bug in the admin policy can only ever **add** admin's own rows — it can never leak unapproved rows into the viewer's set. Merging into `using (status='approved' or is_admin())` would make an admin-clause bug fail **open**. This is the exact precedent 0002 established for staged tables ([0002_rls.sql:87-98]).

**⚠️ Headline risk — the `0007` test regression (Task 2).** The single biggest way this story goes wrong is forgetting that `0009` changes `stat_row`'s grant/policy posture, which makes `0007_stat_row_test.sql`'s "admin/worker-only until 3.5" assertions **false** — and every pgTAP file runs against the fully-migrated schema. If Task 2 is skipped, `supabase test db` goes red on `0007` (a duplicate-policy `policies_are` mismatch, two flipped grant assertions, and three `throws_ok '42501'` blocks that no longer throw). The 0007 test author wrote those assertions as point-in-time truths explicitly annotated "*until Story 3.5*" — this story is the one that must retire them.

### Architecture patterns & invariants (must follow)

- **AD-7 — viewers read approved-only, at the row level** [Source: ARCHITECTURE-SPINE.md#AD-7 L110-113; SOLUTION-DESIGN §4 L279-281]. RLS `FORCE`; viewer policy `USING (status='approved')` with **no** admin escape hatch; admin Pending visibility a **separate** `USING (is_admin())` policy; **two policies, never one OR'd policy, so a malformed admin policy fails closed**. This is the invariant 3.5 makes live on `stat_row`.
- **The two-policy convention** [Source: 0002_rls.sql:87-98]. Story 1.3 established the exact template for staged tables: `create policy <t>_viewer_read … using (status='approved')` + `create policy <t>_admin_read … using ((select is_admin()))`, separate. 3.5 is the first table to actually go live under it (`stat_view` + the pre-existing `stat_admin`).
- **The publish axis is orthogonal to the anomaly axis** [Source: 3.4 story Dev Notes; ARCHITECTURE-SPINE.md#AD-7]. `stat_row.status ∈ {pending, approved}` is the **publish** axis (3.5's viewer model). `demo.validation_state ∈ {pending, anomalous}` is the **anomaly-hold** axis (3.4). An anomalous match's rows are still `status='pending'` ⇒ invisible to viewers regardless once 3.5 lands. Do not conflate them; 3.5 touches only `stat_row.status`.
- **AD-6 — Aprobar is one atomic transaction** [Source: ARCHITECTURE-SPINE.md#AD-6 L105-108; SOLUTION-DESIGN §6 L372]. Approving flips `status='approved'`, sets the demo-derived score, advances the bracket, posts the feed, and recomputes leaderboards in **one DB transaction**, realtime-emit only post-commit. That whole action is **Story 4.6** — 3.5 writes no approval and adds no publish path (there is none in Epic 3, so "nothing reaches viewers until approved" holds by construction).
- **AD-8 — mutations are server-gated, admin-only** [Source: ARCHITECTURE-SPINE.md#AD-8 L115-118]. The approval is an audited admin command route (Epic 4), never a client write. 3.5 adds **no** write grant/policy for anon/authenticated (reads only).
- **Single-writer + module boundary** [Source: ARCHITECTURE-SPINE.md#AD-2; #Design-Paradigm]. `stat_row` is written solely by the worker (service-role/owner, BYPASSRLS). 3.5 adds no writer and no code — it is a migration + tests only; `git diff worker/ lib/ app/` must be empty.
- **Single-tournament v1** [Source: AD-18]. The viewer policy is a pure `status='approved'` row predicate — no tournament scoping needed (and none exists until Epic 4's `match`→`tournament` link). Forward-scope: Epic 5's leaderboard view/RPC (Story 5.5) reads through this policy.

### What 0007 / 3.3 already built (do NOT rebuild — extend)

- **`stat_row.status`** — `text not null default 'pending' check (status in ('pending','approved'))` [Source: 0007_stat_row.sql:40]. The publish axis + its closed-set CHECK already exist. 3.5 adds no column.
- **`stat_admin` policy** — `create policy stat_admin on public.stat_row for select to authenticated using ((select public.is_admin()))` [Source: 0007_stat_row.sql:69]. The admin half already exists (dormant only because no grant reaches it). 3.5 does **not** recreate it; the new grant activates it.
- **RLS ENABLE + FORCE** on `stat_row` [Source: 0007_stat_row.sql:60-61]. Already set. 3.5 adds no RLS toggle.
- **`service_role` grants** — `grant select, insert, update, delete on public.stat_row to service_role` [Source: 0007_stat_row.sql:77]. Unchanged. 3.5 adds only the anon/authenticated SELECT grant.
- **`approved_at`/`approved_by` columns** — `approved_at timestamptz, approved_by text references player(steamid64)` [Source: 0007_stat_row.sql:48]. Already created as shells; **set at Story 4.6 approval**, not here.
- **The worker parse/record path** — `RecordParse` writes rows with the `pending` default and preserves `status` on re-upsert [Source: worker/db/db.go:212-231]. No change.
- **The pgTAP role-switch + JWT-claim simulation pattern** — `set local role {service_role|authenticated|anon|postgres}` + `select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin","steamid64":"…"}}', true)` to drive `is_admin()`; `has_table_privilege`, `policies_are`, `policy_cmd_is`, `throws_ok '42501'` [Source: 0007_stat_row_test.sql:117-160]. 0009's test reuses this verbatim.

### The migration (implement in `0009`)

```sql
-- supabase/migrations/0009_stat_pending_visibility.sql — Story 3.5 (stage stats to Pending, ingest side of FR-13)
-- SCOPE: turn ON the viewer-facing half of the AD-7 two-policy Pending model on stat_row —
--   (a) the LIVE viewer policy  stat_view USING (status='approved')  for anon + authenticated;
--   (b) the anon/authenticated SELECT *grant* that makes it (and the dormant 0007 stat_admin policy)
--       reachable. Until now stat_row had NO anon/authenticated grant, so every client read 42501'd at
--       the grant gate before RLS ran (admin/worker-only). Rows ALREADY land status='pending' (0007
--       default; RecordParse preserves it) — there is NO worker/app code in this story.
--   Two SEPARATE permissive policies, never OR'd (AD-7): Postgres ORs them (approved-for-all ∪
--   everything-for-admin), but keeping them separate means a malformed admin policy can only ADD
--   admin's own rows, never widen the viewer's approved-only set.
-- OUT OF SCOPE — do NOT add here:
--   * the Aprobar publish (status->'approved', approved_at/approved_by, advance bracket, post feed,
--     recompute leaderboards, one tx) — Story 4.6 (AD-6/AD-8). 3.5 writes NO approval.
--   * a match.state column / the Pendiente|Aprobado Spanish labels — no match table until Epic 4; the
--     match's Pending-ness is the derived aggregate of stat_row.status; the label map is Epic-5 i18n.
--   * a leaderboard view/RPC over status='approved' (AD-20) — Story 5.5. 3.5 is the base-table RLS teeth.
--   * adding stat_row to a Realtime publication (viewer ~2s nudge) — Epic 5 (Story 5.8).
--   * the stat_row(status) partial index (Epic-5 leaderboard optimization).
--   * recreating stat_admin / altering stat_row columns/RLS/service_role grants — all set in 0007.

-- (a) LIVE viewer policy: viewers (anon + authenticated) see ONLY approved rows. NO is_admin() escape
--     hatch here (AD-7) — admin Pending visibility is the SEPARATE stat_admin policy (0007). No
--     (select …) init-plan wrap needed: the qual is a plain column compare, not a function call.
create policy stat_view on public.stat_row for select to anon, authenticated
  using (status = 'approved');

-- (b) the base-table SELECT grant that makes stat_view (and the dormant stat_admin) reachable. SELECT
--     ONLY — writes stay single-writer (no anon/authenticated write grant or policy; unchanged from 0007).
grant select on public.stat_row to anon, authenticated;
```

### The `0007` test edits (implement in Task 2)

Three assertions in `supabase/tests/0007_stat_row_test.sql` are invalidated by `0009` and must be corrected (the file runs against the 0001→0009 schema):

1. **[0007_stat_row_test.sql:94-98]** `policies_are(… ARRAY['stat_admin'] …)` → `ARRAY['stat_admin','stat_view']` (the viewer policy now exists). Reword the message ("`stat_view` added by 0009").
2. **[0007_stat_row_test.sql:108,112]** `has_table_privilege('anon'…'SELECT') = false` and `has_table_privilege('authenticated'…'SELECT') = false` → both `true` (granted by 0009). Leave the INSERT/UPDATE/DELETE `= false` lines as-is.
3. **[0007_stat_row_test.sql:138-141, 150-153, 156-159]** the Section-D `throws_ok('… select count(*) …','42501')` blocks for the authenticated **viewer read**, authenticated **admin read**, and **anon read** — these no longer throw (the grant exists). **Remove** them and leave a comment pointing to `0009_stat_pending_visibility_test.sql` for the row-level visibility proof. **Keep** the `service_role` write block [:123-133] and the authenticated-viewer **INSERT** `42501` block [:142-144] (writes are still fail-closed — unchanged).

Then update `plan(36)` to the new exact count and re-run `supabase test db` (0007 green again).

### Env / secrets

**No net-new env.** 3.5 is a migration + pgTAP only — no worker/app code, no runtime config, no `NEXT_PUBLIC_*`, `lib/env.ts` untouched. [Source: 3.4 Env / secrets; worker/config/config.go.]

### Source tree — where things go

```
cs-tournament/
  supabase/migrations/0009_stat_pending_visibility.sql   # NEW — stat_view viewer policy + anon/authenticated SELECT grant
  supabase/tests/0009_stat_pending_visibility_test.sql    # NEW — pgTAP plan(N): policy set, grant matrix, row-level visibility
  supabase/tests/0007_stat_row_test.sql                   # EDIT — correct the 3 assertions 0009 invalidates (Task 2); recount plan(N)
```
No worker change. No TS change. No new file outside `supabase/`. [Repo recon: migrations end at 0008, tests end at 0008 — 0009 is the next number.]

### Testing standards

- **pgTAP:** explicit `plan(N)` (retro action #5 — exact accounting). `0009` proves the policy set `{stat_admin, stat_view}`, `stat_view`'s cmd/roles/`USING` (references `status`, not `is_admin` — the never-OR'd guarantee), the grant matrix, and the **behavioral** row-level filtering (anon/viewer see approved-only; admin sees both) via the `set local role` + `set_config('request.jwt.claims', …)` pattern. `supabase test db` Files **9 → 10**; `0003` FORCE-guard + `canonical_steamid64_invariant` + all suites stay green (a policy/grant is not a base-table FORCE change).
- **Regression (mandatory):** `0007_stat_row_test.sql` updated so it stays true+green against the post-0009 schema (Task 2). This is part of the green bar, not optional.
- **DB-only guard:** `git diff --stat -- worker/` and `git diff --stat -- lib app` must both be **empty**; `vitest run` unchanged; `next build` clean. These assert the story added zero code — a red flag if any is non-empty.
- **Green bar:** `supabase db reset` (0001→0009 clean) + `supabase test db` **Files 10** all green.

### Regression / boundary notes

- **The 0007 test regression is the #1 risk** — see Task 2 + the headline-risk note above. Do not ship 0009 without it.
- **Do NOT** write an explicit `status='pending'` in the worker — rows already default to pending, and an explicit write would risk a future re-parse clobbering an approved row (that's Story 3.6's `revert→reparse→republish` concern, not 3.5's).
- **Do NOT** recreate `stat_admin`, toggle `stat_row` RLS/FORCE, change its columns, or re-grant `service_role` — all set in 0007; 0009 is one policy + one grant.
- **Do NOT** add any anon/authenticated **write** grant or policy — reads only; the single-writer invariant is unchanged.
- **Do NOT** build the Aprobar route, approval writes (`status='approved'`, `approved_at`, `approved_by`), the admin ingest UI, the leaderboard view, or a Realtime publication — Epic 4 / Epic 5.
- **Do NOT** invent a `match.state`/`match_status` column or a `Pendiente` label constant — derived aggregate + Epic-5 i18n (Resolved Decision 2).
- **Do NOT** touch `demo.validation_state` (the orthogonal anomaly axis) or `server.go`.

### Deferred items to (re)log at review

- **The `Aprobar` publish** (`Pending → Approved`: `status='approved'` + `approved_at`/`approved_by` + advance/feed/leaderboard recompute, one tx, audited) → **Story 4.6** (AD-6, AD-8).
- **The admin ingest-queue UI + the `Pendiente`/`Aprobado` labels** → the app-surface / viewer epic (Epic 5). 3.5 ships the DB visibility model it reads through.
- **The leaderboard view/RPC over `status='approved'`** (AD-20) → **Story 5.5**.
- **Adding `stat_row` to a Realtime publication** (the ~2 s viewer nudge) → **Epic 5** (Story 5.8).
- **match→tournament scoping** of any future stat read → **Epic 4** (when `match` links `tournament`; irrelevant to the pure `status='approved'` viewer predicate).
- **The `stat_row (status)` partial index** → Epic-5 leaderboard optimization.

### References

- [Source: epics.md#Story-3.5 L539-559] — the three AC threads (rows land Pending / two-policy RLS invisibility / Aprobar out-of-scope→4.6) + traces FR-13 (ingest) · AD-7.
- [Source: epics.md#Epic-3 L442-444 (ingest owns the FR-13 ingest half); #Story-3.4 L517-537 (the boundary — 3.4 deferred the viewer model to 3.5); #Story-4.6 L741-761 (Aprobar = the publish half); FR-Coverage-Map L149 (FR-13 = 3.5 stage · 4.6 publish)] — the epic scope + the 3.4/3.5/4.6 split.
- [Source: ARCHITECTURE-SPINE.md#AD-7 L110-113 (viewers approved-only, two policies never OR'd, FORCE); #AD-6 L105-108 (Aprobar one atomic tx → 4.6); #AD-8 L115-118 (server-gated admin mutations → Epic 4); #ingest-state-machine L277-297 (the Pending node); #AD-2 (single writer)] — the invariants 3.5 realizes + the boundary it stops at.
- [Source: SOLUTION-DESIGN.md §3 L146,154 (stat_row.status closed-set + approved_at/approved_by shells); §4 L264-297 (the two-SEPARATE-policies stat_view/stat_admin block + "never OR'd (AD-7)"); §6 L339-343 ("rows written, match stays Pending"), L372 (approve = one tx = 4.6); §7 L459-460 (status.pending→"Pendiente", status.approved→"Aprobado" label map — Epic-5 i18n)] — the authoritative policy DDL + the derived-Pending model + the label origin.
- [Source: prd.md FR-13 L240-247 (staged Pending→Approved: parsed stats land Pending, visible to admin, excluded from public leaderboards/awards/bracket; approval admin-only, recorded who+when = 4.6); glossary L99 (Pending/Approved definitions)] — the product requirement + its ingest/publish split.
- [Source: supabase/migrations/0007_stat_row.sql:18-19 (the explicit "Story 3.5 adds the LIVE viewer policy stat_view + the anon/authenticated SELECT grant" hand-off), :40 (status default), :60-61 (RLS ENABLE+FORCE), :69 (stat_admin already exists), :77 (service_role grants), :48 (approved_at/approved_by shells)] — what 3.5 extends and must NOT rebuild.
- [Source: supabase/tests/0007_stat_row_test.sql:94-98 (policies_are ARRAY['stat_admin']), :108,:112 (anon/authenticated SELECT=false), :138-159 (Section-D 42501 "cannot read" blocks), :117-160 (the role-switch + set_config JWT-claim pattern to reuse)] — the assertions Task 2 corrects + the pgTAP pattern 0009 mirrors.
- [Source: supabase/migrations/0002_rls.sql:87-98 (the two-policy never-OR'd convention template Story 1.3 established); tests/0002_rls_test.sql (the is_admin()/anon/authenticated policy-behavior precedent)] — the framework precedent 3.5 is the first table to make live.
- [Source: worker/db/db.go:212-231 (RecordParse: INSERT omits status ⇒ pending default; ON CONFLICT DO UPDATE preserves status ⇒ no worker change needed)] — the evidence AC1 holds by construction.
- [Source: EXPERIENCE.md:44 (admin Ingest queue: parsed Pending stats + Aprobar → Epic 5 UI), :111 ("Parsed stats land Pendiente, visible only to the Admin … Viewers never see Pending")] — the UX confirming the visibility model + that the queue UI is a later surface.
- [Source: 3-4-validation-and-anomaly-gate.md (the immediate predecessor: the orthogonal-axes framing, the "backend-first ⇒ DB surface only" precedent, the Task-6 live-QA fixture + local-Supabase 127.0.0.1:54322 pattern); deferred-work.md] — previous-story intelligence.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `supabase db reset` — all 9 migrations (0001→0009) applied clean; 0009 last.
- `supabase test db` — first run FAILED only on the new 0009 test: `ERROR: VALUES lists must all be the same length` (the seed mixed a 4-column `status='approved'` row with a 3-column default-`pending` row in one multi-row `VALUES`). Fix: split into two `INSERT`s so the pending row genuinely takes the `status` default. Re-run: **Files=10, Tests=300, Result: PASS** (0007 → plan(33), 0009 → plan(23)).
- `vitest run` — 11 files / 110 tests pass (unchanged; guards against accidental TS edits).
- `npm run build` (`next build`) — compiled + TypeScript clean.
- Live-QA `psql` (rolled-back tx, real approved+pending rows): anon → 1 row (approved-only); auth viewer → 1; auth admin → 2 (sees pending); anon insert → `42501`.

### Completion Notes List

- **DB-only slice, exactly as scoped.** Whole deliverable = migration `0009` (one `create policy stat_view` + one `grant select … to anon, authenticated`) + its pgTAP proof + the mandatory `0007`-test regression fix. Zero Go/TS code (`git diff worker/ lib app` empty).
- **AC1** holds by construction — rows already land `status='pending'` (0007 default; `RecordParse` preserves it). No worker write added (an explicit `status='pending'` write was deliberately NOT added — it would risk clobbering an approved row on a future 3.6 re-parse).
- **AC2/AC3** — the AD-7 two-policy model is now live on `stat_row`: `stat_view USING (status='approved')` (no `is_admin()` escape hatch) kept SEPARATE from the pre-existing `stat_admin USING (is_admin())`; the anon/authenticated SELECT grant makes both reachable. Proven behaviorally (0009 test + live psql): viewer/anon see approved-only, admin sees pending too, writes still `42501`.
- **AC4 — the headline regression fix (Task 2).** `0009` invalidates three `0007` assertions (`policies_are` set, anon/authenticated SELECT-grant expectations, the Section-D `42501` "cannot read" blocks). Corrected in place: `policies_are` → `{stat_admin, stat_view}`; the two SELECT-grant expectations flipped `false→true`; the three read-`42501` blocks removed (grant now exists) and pointed to the 0009 test; kept the `service_role` write block + the authenticated-viewer INSERT-`42501` block (writes unchanged); `plan(36)→plan(33)`; header comments reworded so 0007 stays a truthful "structure + single-writer" proof.
- **AC5 — boundary held.** No Aprobar/approval write (Story 4.6), no `match.state`/`Pendiente` artifact (derived aggregate + Epic-5 i18n), no leaderboard view (5.5), no Realtime publication (5.8), no `stat_row(status)` index (Epic 5), no `service_role`/RLS/column change.
- **Task 5 note:** the substantive RLS-teeth live-QA was performed via `psql` on the running local DB with real approved+pending rows (rolled back — no residue). The full `worker ingest` run against the operational `season`+`tournament`+`roster_entry` fixture (open action-item #5) remains the human sign-off exercise at review→done, consistent with how 3.3/3.4 reached `done` (dev → code-review + live-QA sign-off). RLS is agnostic to how the rows were written, so the teeth are fully demonstrated.

### File List

- `supabase/migrations/0009_stat_pending_visibility.sql` — NEW: `stat_view` viewer policy (`USING status='approved'`, to anon+authenticated) + anon/authenticated SELECT grant.
- `supabase/tests/0009_stat_pending_visibility_test.sql` — NEW: pgTAP `plan(23)` — policy set/shape (never-OR'd guarantee), grant matrix, behavioral row-level visibility (viewer approved-only / admin sees pending).
- `supabase/tests/0007_stat_row_test.sql` — EDIT: corrected the 3 assertions 0009 invalidates + header/inline comments; `plan(36)→plan(33)`.
- `_bmad-output/implementation-artifacts/3-5-stage-stats-to-pending-ingest-side-of-fr-13.md` — story tracking (Tasks, Dev Agent Record, File List, Change Log, Status).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status `ready-for-dev → in-progress → review`; `last_updated`.

## Change Log

| Date       | Change |
|------------|--------|
| 2026-07-12 | Story 3.5 implemented → **review** (bmad-dev-story). Migration `0009_stat_pending_visibility.sql` (NEW): `stat_view` viewer policy `USING (status='approved')` for anon+authenticated + the anon/authenticated SELECT grant — the AD-7 two-policy Pending model now LIVE on `stat_row`, kept SEPARATE from the pre-existing `stat_admin` (never OR'd). New pgTAP `0009_stat_pending_visibility_test.sql` `plan(23)` (policy set/shape + grant matrix + behavioral viewer-approved-only / admin-sees-pending). Mandatory regression fix to `0007_stat_row_test.sql`: `policies_are`→`{stat_admin,stat_view}`, anon/authenticated SELECT expectations `false→true`, removed the 3 read-`42501` blocks (grant now exists) → pointer to 0009 test, `plan(36)→plan(33)`. **Green bar:** `supabase test db` Files=10 / Tests=300 all pass; `vitest run` 110 pass; `next build` clean; `git diff worker/ lib app` empty (DB-only). Live-QA (psql, rolled-back, real approved+pending rows): viewer/anon approved-only, admin sees pending, anon write `42501`. baseline a3b53b4. |
| 2026-07-11 | Story 3.5 created (ready-for-dev). Exhaustive context engineering: epics.md#Story-3.5 + the AD-7 source (SPINE + SOLUTION-DESIGN §4) + PRD FR-13 + the 3.3/3.4 stories + the full current DB posture (migrations 0002/0004/0005/0007/0008 + their pgTAP) + the worker `RecordParse` path + the UX visibility model. **Key findings:** (1) `stat_row` already has the `status` column (default `pending`), RLS FORCE, and a **dormant** `stat_admin` (`is_admin()`) policy — but **no anon/authenticated grant**, so it is admin/worker-only today; 3.5's whole job is the LIVE `stat_view USING (status='approved')` viewer policy + the anon/authenticated SELECT grant (the two-policy AD-7 model going live). (2) The worker **already writes `status='pending'`** (0007 default; `RecordParse` preserves it), so AC1 holds by construction ⇒ **no Go/TS code** — 3.5 is a **DB-only slice** (one migration + pgTAP). (3) The "match Pending state / `Pendiente` label" has **no schema home** in Epic 3 (no `match` table until Epic 4) — it is the derived aggregate of `stat_row.status` + an Epic-5 label; do not invent a column. (4) **Headline regression:** because `supabase test db` runs every test against the fully-migrated schema, `0009` invalidates three `0007_stat_row_test.sql` assertions (`policies_are`, anon/authenticated SELECT grants, the Section-D `42501` reads) — Story 3.5 **must** correct them (Task 2). Aprobar (publish half of FR-13) is **Story 4.6**. baseline_commit a3b53b4. |
