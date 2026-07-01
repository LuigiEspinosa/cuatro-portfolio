---
baseline_commit: 4010b51987acb8e9ae3176ebbd93cf4c8a9cb40a
---

# Story 1.4: Append-only audit and snapshot convention

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the audit and snapshot tables to be append-only by construction,
so that the admin action trail and ceremony snapshots cannot be rewritten after the fact.

## Acceptance Criteria

1. **Append-only tables created as substrate (AD-17, AD-15/AD-19 shells).** Migration 0003 creates `audit_log`, `stat_snapshot`, and `stat_snapshot_row` with the exact column contracts from `SOLUTION-DESIGN §3`. Each grants **only** `SELECT, INSERT` to `service_role` and **no** UPDATE and **no** DELETE — **neither a policy nor a grant** — so the tables are append-only by construction *even for the sole (service-role) writer*. (BYPASSRLS means the "no UPDATE/DELETE policy" rule alone would not bind service_role; withholding the UPDATE/DELETE **grant** is what makes it truly append-only — see Dev Notes.)

2. **ENABLE + FORCE RLS; admin-only read; no viewer/client access (AD-7, AD-17).** All three tables get both `ENABLE` and `FORCE ROW LEVEL SECURITY`. Each gets a **separate** admin-only SELECT policy `using ((select public.is_admin()))` (never OR'd with anything). There is **no** viewer SELECT policy and **no** `anon`/`authenticated` grant of any kind — admin surfaces read these via server routes with the service key, exactly like `app_role` (the policy is dormant defense-in-depth). No INSERT/UPDATE/DELETE policy for `anon`/`authenticated` anywhere. The snapshot tables are admin-only until reveal is handled in Epic 6 — they are **never** viewer-reveal-gated (the reveal axis lives on `award*`/`spin`, not on the snapshot).

3. **No forward-dependency breakage; the full substrate set applies cleanly (CAP-1 success).** 0003 introduces **no** FK to a not-yet-existing table: `audit_log.target_match_id` is a plain nullable `bigint` with **no** FK to `match` (deferred to Epic 4, mirroring `0001`'s `tournament.final_match_id`), and the `ceremony.snapshot_id` FK is **not** added here (`ceremony` is Epic 6). Applied to an empty database, `0001 → 0002 → 0003` apply with zero errors and the database satisfies the CAP-1 success criterion (every table `ENABLE`+`FORCE`; `audit_log` + snapshot tables append-only with no UPDATE/DELETE policy; no secret via `NEXT_PUBLIC_*` — trivially true, this story writes no env).

4. **Convention generalized + provably bites (framework guard).** A pgTAP suite (`supabase/tests/0003_audit_snapshot_test.sql`) proves the framework bites: all three tables `ENABLE`+`FORCE`; exactly the intended admin-only SELECT policy and **no write policy** on each; `service_role` **can INSERT but cannot UPDATE or DELETE** (append-only); `authenticated` viewer, `anon`, **and even an authenticated admin (via the Data API)** cannot SELECT (fail-closed / dormant policy); plus a **generic catalog guard** asserting that **no base table in `public` has `relforcerowsecurity = false`** (so any future table that forgets `FORCE` fails loudly — the deferred Story 1.3 item, homed here). The 0001 (30) and 0002 (48) suites stay green.

_Traces: AD-17 · AD-15, AD-19 (snapshot substrate shells) · NFR-Security, NFR-Data · [Source: epics.md#Story 1.4] · [Source: SPEC.md#CAP-1 success] · [Source: SOLUTION-DESIGN.md#3. Data model] · [Source: SOLUTION-DESIGN.md#4. RLS policies]_

---

## Dev Notes

> **Read this whole section before writing any SQL.** The single most important thing to get right: **all three tables (`audit_log`, `stat_snapshot`, `stat_snapshot_row`) are created in THIS migration (0003) as write-once substrate.** Epic 6's intro ("Adds the ceremony schema slice … `stat_snapshot`, `stat_snapshot_row` …") reads like Epic 6 *creates* them — **it does not.** Epic 6 / Story 6.2 adds the *capture behavior* (the SERIALIZABLE ceremony-lock, the INSERT that populates rows, `ceremony.state` gating) and the `ceremony` table (whose `snapshot_id` FK then points at the `stat_snapshot` this story already created). CAP-1's success bar explicitly requires "`audit_log` and snapshot tables are append-only (no UPDATE/DELETE policy)" — that bar is met **here**. The dev agent will have only this file; everything needed is below.

### What this story is (and is not)

- **This is migration 0003, layered on 0001 + 0002.** At apply time the database contains exactly the four identity/scope tables (`season`, `tournament`, `player`, `app_role`) + the RLS framework + helpers `is_admin()`/`jwt_steamid64()` from 0002. This story adds the three append-only tables and completes CAP-1.
- **In scope (the entire deliverable):**
  1. Create `audit_log`, `stat_snapshot`, `stat_snapshot_row` with the exact `SOLUTION-DESIGN §3` columns (reproduced verbatim in the DDL block below).
  2. The `audit_log (tournament_id, occurred_at)` index (from the design's index list).
  3. `ENABLE` + `FORCE ROW LEVEL SECURITY` on all three.
  4. A separate admin-only SELECT policy on each (`using ((select public.is_admin()))`), reusing the 0002 helper. No viewer policy.
  5. Grants: `service_role` gets **`SELECT, INSERT` only** (no UPDATE/DELETE) on all three; **no** `anon`/`authenticated` grant.
  6. A pgTAP suite proving all of the above bites, **including** the generic catalog `FORCE`-guard.
- **Explicitly OUT of scope (do NOT do these here):**
  - **The `ceremony.snapshot_id` FK.** The design shows `alter table ceremony add constraint ceremony_snapshot_fk foreign key (snapshot_id) references stat_snapshot(id);` — **`ceremony` does not exist at 0003.** Adding it here fails to apply (`relation "ceremony" does not exist`). `stat_snapshot` is created **first** (substrate); the `ceremony` migration in Epic 6 adds that FK back to it. This is the #1 way to break the apply.
  - **A FK on `audit_log.target_match_id`.** `match` (Epic 4) does not exist. Leave `target_match_id` a plain nullable `bigint`, exactly as `0001` left `tournament.final_match_id` FK-less. Its FK to `match(id)` arrives in the Epic-4 migration.
  - **Snapshot *capture* logic.** The SERIALIZABLE ceremony-lock, the INSERT that populates `stat_snapshot`/`stat_snapshot_row`, and `ceremony.state` gating are **Story 6.2 (AD-15)**. This story creates only the write-once table *shells* + the append-only mechanism; it inserts **no** snapshot rows and adds **no** capture trigger/function.
  - **Reveal-gating (AD-22)** for `award*`/`spin`/`verification_bundle` → Epic 6. Note snapshot tables are **not** reveal-gated (admin-only, full stop).
  - **The `granted_by` admin-only / no-self-grant invariant** — re-homed to **Story 2.4** (the grant/revoke server route). RLS/CHECK/trigger cannot enforce it (service-role writes bypass RLS). **Do NOT add a CHECK or trigger for it here.** [Source: deferred-work.md]
  - **Any change to 0001 or 0002.** They are `done` and green; do not edit them. The generic `FORCE`-guard goes in the **0003** test (it will cover all seven tables that exist after 0003).

### The exact DDL (authoritative for this story)

Columns are copied **verbatim** from `SOLUTION-DESIGN §3` (the DDL sketch at lines 187–203 + 247–255). The RLS/grant realization follows the 0002 precedent for admin-only tables (`app_role`). **Use these definitions unless you hit a concrete apply-time error;** if you deviate, document why in the Dev Agent Record.

```sql
-- supabase/migrations/0003_audit_snapshot.sql
-- Logical migration 0003 — Append-only audit + snapshot convention (Story 1.4).
-- Realizes AD-17 (append-only audit_log) and creates the AD-15/AD-19 snapshot substrate
-- (stat_snapshot, stat_snapshot_row) as write-once table shells. Completes the CAP-1 substrate:
-- audit_log + snapshot tables are append-only (NO UPDATE/DELETE — neither policy NOR grant).
--
-- SCOPE (whole deliverable): create the three tables with their SOLUTION-DESIGN §3 columns,
--   the audit_log index, ENABLE+FORCE RLS, an admin-only SELECT policy on each, and
--   service_role SELECT+INSERT grants (NO update/delete). Establishes the append-only convention.
-- OUT OF SCOPE — do NOT add here (a FK to a non-existent table fails to apply):
--   * ceremony (Epic 6): do NOT add `alter table ceremony add constraint ceremony_snapshot_fk ...`.
--     stat_snapshot is created FIRST (substrate); ceremony.snapshot_id's FK to it is added in Epic 6.
--   * match (Epic 4): audit_log.target_match_id stays a plain nullable bigint with NO FK yet
--     (mirrors 0001's tournament.final_match_id deferral). Its FK to match(id) arrives in Epic 4.
--   * Snapshot CAPTURE (SERIALIZABLE ceremony-lock + INSERT population + ceremony.state gating) -> Story 6.2 (AD-15).
--   * award*/spin/verification_bundle reveal-gating (AD-22) -> Epic 6.
--   * The granted_by admin-only / no-self-grant invariant -> Story 2.4 server route (RLS can't enforce it;
--     service-role writes bypass RLS). Do NOT add a CHECK/trigger here.

-- ── audit_log (AD-17) — append-only by construction ─────────────────────────
create table audit_log (
  id              bigint generated always as identity primary key,
  tournament_id   bigint not null references tournament(id) on delete cascade,   -- AD-18 scope
  actor_steamid64 text   not null references player(steamid64),                  -- who acted; NO ACTION on delete keeps the trail intact
  action          text   not null,   -- generate_bracket|advance|mark_walkover|approve|reparse|rollback|declare_format|start_ceremony|grant_role
  target_match_id bigint,            -- nullable; FK to match(id) DEFERRED to Epic 4 (match does not exist yet)
  detail          jsonb,             -- before/after (AD-17)
  occurred_at     timestamptz not null default now()
);
create index audit_log_tournament_occurred on audit_log (tournament_id, occurred_at);

-- ── stat_snapshot (AD-15) — write-once snapshot header ──────────────────────
create table stat_snapshot (
  id             bigint generated always as identity primary key,
  tournament_id  bigint not null references tournament(id) on delete cascade,
  taken_at       timestamptz not null default now(),
  content_sha256 text not null
);
-- NOTE: ceremony.snapshot_id's FK to stat_snapshot(id) is added by the Epic-6 ceremony migration,
-- NOT here — `ceremony` does not exist at 0003.

-- ── stat_snapshot_row (AD-19) — the verifier's integer-form contract; write-once ─
create table stat_snapshot_row (
  snapshot_id    bigint not null references stat_snapshot(id) on delete cascade,
  steamid64      text   not null,
  stats_int      jsonb  not null,   -- volume ints; rate {num,den}; secondary; efficiency {num,den} (AD-19)
  h2h            jsonb,             -- per-opponent deciding values
  achievement_ts bigint,            -- integer tick/epoch-ms; published absent-sentinel if absent (AD-19)
  rounds_played  int,
  kills          int,
  idle_dq        boolean,
  primary key (snapshot_id, steamid64)
);

-- ── ENABLE + FORCE RLS on all three (the AD-7 convention 0002 established) ───
alter table audit_log         enable row level security;
alter table audit_log         force  row level security;
alter table stat_snapshot     enable row level security;
alter table stat_snapshot     force  row level security;
alter table stat_snapshot_row enable row level security;
alter table stat_snapshot_row force  row level security;

-- ── Admin-only SELECT (no viewer policy) — mirrors app_role (0002) ──────────
-- Admin surfaces read these via SERVER routes with the service key, NOT the client Data API.
-- Like app_role, these tables get NO anon/authenticated grant, so this admin-read policy is
-- DORMANT defense-in-depth (a viewer OR an admin 42501s at the table-grant gate before RLS runs).
-- The (select …) wrap makes is_admin() an init-plan (evaluated once per statement) — roadmap perf precedent.
create policy audit_admin_read    on audit_log         for select to authenticated using ((select public.is_admin()));
create policy snapshot_admin_read on stat_snapshot     for select to authenticated using ((select public.is_admin()));
create policy snaprow_admin_read  on stat_snapshot_row for select to authenticated using ((select public.is_admin()));

-- ── Grants — append-only mechanism lives HERE, not (only) in policy absence ──
-- service_role is the sole writer (AD-2/AD-17). It has BYPASSRLS, so the "no UPDATE/DELETE policy"
-- rule does NOT stop it — grants do (BYPASSRLS skips row POLICIES, never table GRANTS). Granting only
-- SELECT+INSERT (and deliberately NOT update/delete) makes these tables append-only for the privileged
-- writer too — the real teeth behind AD-17's "append-only by absence". Identity PKs (generated always
-- as identity) need NO separate sequence grant. NO anon/authenticated grant at all (admin-only).
grant select, insert on audit_log         to service_role;
grant select, insert on stat_snapshot     to service_role;
grant select, insert on stat_snapshot_row to service_role;

-- ── Writes/reads for anon/authenticated (fail-closed) ───────────────────────
-- Deliberately NO policy and NO grant of any kind for anon/authenticated on the three tables:
-- no read (admin-only), no write (append-only + admin-only). Doubly fail-closed, by construction.
```

**DDL rationale / guardrails:**
- **Append-only is enforced at the GRANT layer, not just policy absence — this is the load-bearing subtlety of the whole story.** `service_role` has `BYPASSRLS`, so "no UPDATE/DELETE *policy*" (AD-17's literal wording) does **not** stop it from updating/deleting. The teeth are the **grant**: `grant select, insert … to service_role` with **no** `update`/`delete`. This is the exact mechanism the data-integrity review demanded ("service-role INSERT only … no UPDATE/DELETE policy thereafter … without it the service-role could overwrite a snapshot row and the reproducible result silently drifts"). It is a *correct application* of append-only to append-only tables — **not** a contradiction of 0002's grant convention (0002 gave full DML to `service_role` on `season`/`tournament`/`player`/`app_role` because those are *mutable* reference tables; these three are *append-only*, so they get INSERT-not-UPDATE/DELETE). [Source: reviews/review-data-integrity.md:233-246 · ARCHITECTURE-SPINE.md#AD-17]
- **Admin-only SELECT policy is dormant by design (mirrors `app_role`).** Because these tables have no `authenticated` SELECT grant, even a valid admin claim `42501`s at the grant gate before RLS is consulted — the `is_admin()` USING clause is never reached. That is intended: admins read audit/snapshot data via **server routes with the service key** (Epic 4/6), never the client Data API. The policy is kept as forward-precedent + defense-in-depth (matching 0002's `app_role_admin_read` and its 2026-07-01 review resolution: "keep the policy + document the dormancy with a test"). Add the documenting test (see Testing). [Source: 1-3 story#Review Findings — the dormancy patch]
- **`(select public.is_admin())` init-plan wrap** — functionally identical to a bare call; the subquery triggers an init-plan so the JWT is decoded once per statement, not per row. Immaterial on these small admin tables but keeps the roadmap precedent consistent (it matters on `stat_row`, Epic 3). [Source: 0002_rls.sql:55]
- **`stat_snapshot_row` has a composite natural PK `(snapshot_id, steamid64)`** — no surrogate `id`, no sequence. `snapshot_id` cascades on delete of its parent `stat_snapshot`. This PK also serves the only lookup pattern (rows of a snapshot).
- **`audit_log.actor_steamid64 references player(steamid64)` with no ON DELETE clause** = `NO ACTION` (≈ RESTRICT): you cannot delete a player who has audit rows, which is the right posture for a tamper-evident trail (don't lose the actor). Keep the sketch's default; do **not** add `on delete set null`/`cascade` here. `tournament_id … on delete cascade` matches the sketch (tournaments are not deleted in v1).
- **`detail jsonb` carries the before/after** (AD-17). `stats_int`/`h2h` are `jsonb` holding the AD-19 integer-form contract. Do not split them into columns — the design keeps them `jsonb` so the offline verifier consumes the exact captured shape.
- **Why create the *full* AD-19 columns now (not a minimal shell):** the architecture review states "*the migration that defines `stat_snapshot_row` is the shared contract*", and CAP-1 success wants the snapshot tables append-only *now*. Creating the full column set here means Epic 6 / Story 6.2 only writes INSERTs (no `ALTER TABLE` schema churn). This is the recommended default; see the flagged note for Cuatro if a leaner shell is preferred. [Source: reviews/review-adversarial.md#AD-19]

### Migration tooling & file naming — follow the 0001/0002 precedent

Established in Stories 1.2/1.3 (do not re-decide): Supabase CLI **v2.109.0**, project **linked** (ref `ufnumdqrhyvijreoyrxf`, project `inclusivcup`, us-east-1, free tier, **Postgres engine 17** `17.6.1.127`). `supabase/config.toml` already exists (`major_version = 17`).

- **Filename:** `supabase/migrations/0003_audit_snapshot.sql` — the next sequential logical migration. Hand-create it (do **not** use `supabase migration new`, which emits a timestamp prefix). It sorts lexicographically after `0002_rls.sql`, so `db reset`/`db push` replay 0001 → 0002 → 0003. Add the header comment marking it "logical migration 0003" + the OUT-OF-SCOPE note (already in the DDL block above). *(The ARCHITECTURE-SPINE source-tree note only spells out "0001 core schema; 0002 RLS" — 0003 is the roadmap's continuation of that same per-story-migration sequence, established by 1.2→0001 and 1.3→0002 and named "migration 0003" in the Story 1.3 out-of-scope note and deferred-work.md.)*
- **Test file:** `supabase/tests/0003_audit_snapshot_test.sql` (pgTAP), run via `supabase test db`. Reuse the proven harness verbatim: `begin; create extension if not exists pgtap with schema extensions; set local search_path = extensions, public; select plan(N); … select * from finish(); rollback;`.
- **`auth.jwt()` / `is_admin()` dependency — verify on the Supabase stack, NOT bare Postgres.** 0003's policies call `public.is_admin()` (from 0002), which reads `auth.jwt()`. Those are Supabase-provided (seeded by `db reset`). Verify via `supabase db reset` + `supabase test db` only — a throwaway vanilla Postgres cluster lacks `auth.jwt()` and the `anon`/`authenticated`/`service_role` roles.

### Testing / "done" standard

Primary gate (AC #3): **0001 → 0002 → 0003 apply cleanly to a fresh DB** — `supabase db reset` (Docker-backed local, DB-only stack as in 1.2/1.3) replays all three with zero errors. Then the pgTAP suite proves the framework bites. Keep it proportionate (casual private-friends event) but cover every AC. Suggested `supabase/tests/0003_audit_snapshot_test.sql` assertions — **recount and set `plan(N)` to match exactly** (the 1.3 review flagged a mis-set plan; count carefully):

- **Section A — structural `ENABLE`+`FORCE` (AC #2):** for each of `audit_log`, `stat_snapshot`, `stat_snapshot_row`, assert `relrowsecurity` **and** `relforcerowsecurity` are `true` in `pg_class`. **6 assertions.**
- **Section A2 — generic catalog `FORCE`-guard (AC #4, the deferred 1.3 item):** one assertion that **no** base table in `public` has `relforcerowsecurity = false` — e.g. `is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relforcerowsecurity = false), 0, 'every public base table FORCEs RLS')`. This now covers all seven tables and fails loudly if any future migration forgets `FORCE`. **1 assertion.**
- **Section B — policy shape (AC #2, no write policy):** `policies_are('public','audit_log', ARRAY['audit_admin_read'])` (+ the two snapshot equivalents) proves each table has **exactly** the one admin-read policy and **no** write policy. `policy_cmd_is(...,'SELECT')` for each. **~6 assertions.**
- **Section C — append-only at the grant layer (AC #1) — the distinctive proof:** `has_table_privilege('service_role','public.audit_log','INSERT')` = `true` and `…,'UPDATE')` = `false` and `…,'DELETE')` = `false`, for each of the three tables. (This is what makes them append-only for the privileged writer.) Also `has_table_privilege('authenticated','public.audit_log','SELECT')` = `false` per table (admin-only). **~12 assertions** (trim to the highest-value cells if you prefer; keep at least INSERT-true + UPDATE-false + DELETE-false on `audit_log` and one snapshot table).
- **Section D — behavioral (AC #1, #2) — the money tests** (switch role with `set local role service_role|authenticated|anon`; `set local role postgres` back between blocks so pgTAP runs privileged; seed a `tournament` + `player` as `postgres` first):
  - As `service_role`: `insert into audit_log (...) lives_ok`; `insert into stat_snapshot (...) lives_ok`; `insert into stat_snapshot_row (...) lives_ok` (use the id from the snapshot insert); then `update audit_log …` **throws `42501`**, `delete from audit_log …` **throws `42501`**, and `update stat_snapshot_row …` / `delete from stat_snapshot …` **throw `42501`** (append-only bites even for the writer).
  - As `authenticated` (viewer claim): `select count(*) from audit_log` / `stat_snapshot` / `stat_snapshot_row` each **throws `42501`** (admin-only, no grant); `insert into audit_log …` **throws `42501`**.
  - As `authenticated` (admin claim): `select count(*) from audit_log` **also throws `42501`** — documents the dormant policy (the 1.3 pattern).
  - As `anon`: `select count(*) from audit_log` **throws `42501`**.
- **Regression:** `supabase db reset` (clean apply) + `supabase test db` — expect **0001: 30/30**, **0002: 48/48**, plus 0003's `N`. Record the total in the Dev Agent Record (as 1.2/1.3 did).

If pgTAP role-switching proves fiddly for a slice, Sections A/A2/B/C (structural + policy-shape + grant-privilege) are the guaranteed-robust core and alone evidence ACs #1–#4; Section D is the convincing behavioral complement — include it if it runs clean.

### Optional: land 0003 on the remote (coordinate with Cuatro — outward-facing)

Story 1.2/1.3 deliberately deferred the remote push (`supabase db push`) pending Cuatro's go-ahead; the linked remote (`ufnumdqrhyvijreoyrxf`) is still empty. When Cuatro is ready, `supabase db push` lands 0001 + 0002 + 0003 together (all RLS-on, so no RLS-less window); confirm all three rows in `supabase_migrations.schema_migrations`. **This is an outward-facing action on the production project — confirm before pushing.** Local `db reset` + `test db` is the story's actual gate and is sufficient for "done."

### Project Structure Notes

- New paths this story adds: `supabase/migrations/0003_audit_snapshot.sql`, `supabase/tests/0003_audit_snapshot_test.sql`. Both under the `supabase/migrations/` + `supabase/tests/` shared-contract slice — **commit them**. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- No conflicts with the planned layout (`app/`, `lib/`, `worker/`, `roulette/` arrive in later epics; none touched here). This story writes **no** secrets and no `NEXT_PUBLIC_*` vars — pure SQL — so 1.1's secrets discipline is not at risk; introduce no env usage.
- **Scope judgments logged for the reviewer** (see the flagged notes below): (a) all three tables are created here as substrate (Epic 6 adds only capture behavior + `ceremony`); (b) `service_role` gets INSERT-not-UPDATE/DELETE to make append-only bite at the grant layer; (c) the admin-read SELECT policy is intentionally dormant, mirroring `app_role`; (d) the full AD-19 columns are created now rather than a leaner shell.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Append-only audit and snapshot convention]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation & Schema — success bar]
- [Source: _bmad-output/specs/spec-cs-tournament/SPEC.md#CAP-1 success — audit_log + snapshot tables append-only (no UPDATE/DELETE policy)]
- [Source: SOLUTION-DESIGN.md#3. Data model (DDL sketch) — audit_log:247-255, stat_snapshot:187-193, stat_snapshot_row:195-203]
- [Source: SOLUTION-DESIGN.md#4. RLS policies (migration 0002) — audit_admin/snaprow_admin + "no update/delete policy => append-only/write-once (AD-15,17)":290-296]
- [Source: ARCHITECTURE-SPINE.md#AD-17 — Append-only audit log; INSERT to service-role only; no UPDATE/DELETE policy]
- [Source: ARCHITECTURE-SPINE.md#AD-15 — Ceremony decides from an immutable frozen snapshot; write-once; captured under SERIALIZABLE lock (capture = Story 6.2)]
- [Source: ARCHITECTURE-SPINE.md#AD-19 — Snapshot is the verifier's complete integer-form contract (stat_snapshot_row shape)]
- [Source: ARCHITECTURE-SPINE.md#AD-22 — Reveal-gating is award*/spin, NOT the snapshot; snapshot is admin-only]
- [Source: reviews/review-data-integrity.md:233-246 — immutability must use audit_log's mechanism: service-role INSERT only, no UPDATE/DELETE]
- [Source: supabase/migrations/0001_core_schema.sql — the tables audit_log/stat_snapshot FK into (tournament, player); the FK-deferral precedent (final_match_id)]
- [Source: supabase/migrations/0002_rls.sql — helper functions, ENABLE/FORCE + admin-only-policy + grant conventions this story reuses]
- [Source: supabase/tests/0002_rls_test.sql — pgTAP harness + role-switch + policies_are/policy_cmd_is patterns to reuse]
- [Source: _bmad-output/implementation-artifacts/1-3-fail-closed-rls-framework-and-helper-functions-migration-0002.md — precedent + dormancy resolution + deferred catalog-guard]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — catalog FORCE-guard homed here; granted_by invariant re-homed to Story 2.4 (out of scope here)]

### Previous story intelligence (Story 1.3 — done)

- **The tables 0003 FKs into already exist (0001):** `tournament(id bigint identity)`, `player(steamid64 text PK)`. `audit_log`/`stat_snapshot` reference them cleanly. `match` does **not** exist → keep `target_match_id` FK-less (the exact precedent 0001 set with `tournament.final_match_id`).
- **The 0002 grant lesson (pivotal):** this project runs the **always-revoked** Data-API default (`config.toml` `auto_expose_new_tables` unset), so a newly `postgres`-created table starts with **zero** privileges for `anon`/`authenticated`/`service_role`. Every migration must add its own explicit grants. For these three append-only tables that means: `service_role` → `SELECT, INSERT` (no UPDATE/DELETE); `anon`/`authenticated` → **nothing**. Do not assume Supabase auto-grants anything.
- **`service_role` INSERT into an identity-PK table needs no explicit sequence grant** (verified in 1.3's debug log) — `generated always as identity` is fine with a bare `grant insert`.
- **pgTAP harness that works locally (reuse verbatim):** `create extension if not exists pgtap with schema extensions; set local search_path = extensions, public;` then `plan()/is()/ok()/lives_ok()/throws_ok()/policies_are()/policy_cmd_is()/has_table_privilege()` resolve unqualified against `public`, all inside `begin … rollback`. Role-switch with `set local role …`; `set local role postgres` back between blocks.
- **Local verify path (Docker present):** 1.2/1.3 ran a **DB-only** stack (`supabase start -x edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector`). Excluding `gotrue` does **not** remove `auth.jwt()` (present after `db reset`), so `is_admin()`-dependent policy tests still work DB-only.
- **The dormant-admin-policy pattern is settled:** 0002's `app_role_admin_read` is dormant (no `authenticated` grant), kept as defense-in-depth, and its dormancy is asserted by a test. Do the identical thing for the three admin-only tables here.
- **Set the plan(N) correctly.** The 1.3 review wasted a cycle on a mis-counted `plan()`; recount your assertions and match `plan(N)` exactly.
- 1.1/1.2/1.3 dev agent: `claude-opus-4-8` via `bmad-dev-story`.

### Git intelligence

- **Baseline commit:** `4010b51` (`docs(deferred): re-home granted_by invariant to Story 2.4`). The 1.3 review patches are **committed** (`9f17169` hardened the 0002 suite to 48/48; `4010b51` re-homed the `granted_by` item). Working tree is clean; `supabase test db` was last recorded at **78/78** (0001 30 + 0002 48).
- **0003 is the third code slice** and completes CAP-1. It **reuses** the 0002 framework precedents (helper calls, ENABLE/FORCE style, admin-only-policy + init-plan wrap, explicit-grant convention) and **extends** them with the append-only grant refinement (INSERT-not-UPDATE/DELETE). Match the existing style exactly.
- **Suggested commit style** (matches repo history): `feat(db): append-only audit_log + write-once snapshot substrate (migration 0003, Story 1.4)`.

### Latest tech information (verified via Story 1.3, July 2026 — stack is locked, no new external research required)

- **Postgres 17 (remote engine 17.6.1):** `generated always as identity`, composite PKs, `jsonb`, `alter table … force row level security`, and `create policy … to <role> using (…)` are all standard. `FORCE` affects the table owner but **not** `BYPASSRLS` roles (`service_role`) or superusers — which is exactly why append-only must be enforced by **withholding the grant**, not by policy.
- **Supabase RLS/grant model:** RLS is the **row** gate; `GRANT` is the **table** gate — a role needs **both** to act. `BYPASSRLS` (service_role) skips row policies but **never** table grants. So `grant select, insert … to service_role` (no update/delete) is a hard append-only ceiling for the writer. [Source: 0002 debug log + Supabase RLS docs]
- **`is_admin()` / `jwt_steamid64()`** are `STABLE`, read only from `auth.jwt() -> 'app_metadata'`, and already exist from 0002 — reuse them; do **not** redefine.

## Tasks / Subtasks

- [x] **Task 1: Create the migration file** (AC: 1–3)
  - [x] Hand-create `supabase/migrations/0003_audit_snapshot.sql` (sequential name; sorts after `0002_rls.sql`).
  - [x] Add the header comment: "logical migration 0003" + the explicit OUT-OF-SCOPE note (no `ceremony` FK; no `match` FK on `target_match_id`; no capture logic; no `granted_by` CHECK/trigger).
- [x] **Task 2: Create the three tables** (AC: 1, 3)
  - [x] `audit_log` with the exact columns above; `target_match_id` a plain nullable `bigint` (no FK); add the `audit_log (tournament_id, occurred_at)` index.
  - [x] `stat_snapshot` (id, tournament_id FK cascade, taken_at, content_sha256). Do **not** add the `ceremony.snapshot_id` FK.
  - [x] `stat_snapshot_row` with composite PK `(snapshot_id, steamid64)`, `stats_int jsonb not null`, `h2h jsonb`, `achievement_ts bigint`, `rounds_played int`, `kills int`, `idle_dq boolean`.
- [x] **Task 3: ENABLE + FORCE RLS on all three** (AC: 2)
  - [x] `audit_log`, `stat_snapshot`, `stat_snapshot_row` — each `enable` **and** `force row level security`.
- [x] **Task 4: Admin-only SELECT policies + grants (append-only)** (AC: 1, 2)
  - [x] One admin-read policy per table: `for select to authenticated using ((select public.is_admin()))`. No viewer policy; no OR'd policy.
  - [x] `grant select, insert on {audit_log, stat_snapshot, stat_snapshot_row} to service_role;` — **no** UPDATE/DELETE grant (append-only), **no** `anon`/`authenticated` grant.
  - [x] Create **no** INSERT/UPDATE/DELETE policy for any role. Add **no** `granted_by` CHECK/trigger.
- [x] **Task 5: pgTAP proof** (AC: 1, 2, 4)
  - [x] Add `supabase/tests/0003_audit_snapshot_test.sql`: Section A (ENABLE/FORCE ×3), Section A2 (generic "no public base table has FORCE=false" catalog guard), Section B (`policies_are`/`policy_cmd_is`, no write policy), Section C (`has_table_privilege` — service_role INSERT true / UPDATE+DELETE false; authenticated SELECT false), Section D (behavioral: service_role insert lives / update+delete 42501; viewer+anon+admin select 42501). Reuse 1.2/1.3's harness. Recount and set `plan(N)` exactly.
- [x] **Task 6: Verify clean apply + tests** (AC: 3, 4)
  - [x] `supabase db reset` (Docker, DB-only stack) — 0001 → 0002 → 0003 apply with zero errors.
  - [x] `supabase test db` — all green; confirm **0001 30/30**, **0002 48/48**, **0003 38/38** (total **116**). Recorded in the Dev Agent Record.
  - [ ] *(Optional, confirm with Cuatro first — outward-facing)* `supabase db push` to land 0001 + 0002 + 0003 on the linked remote; confirm three rows in `supabase_migrations.schema_migrations`. **DEFERRED — pending Cuatro's go-ahead (outward-facing; not required for "done").**
- [x] **Task 7: Commit** (AC: 1–4)
  - [x] Commit `supabase/migrations/0003_audit_snapshot.sql` + `supabase/tests/0003_audit_snapshot_test.sql`. Do **not** commit `.env.local` / `supabase/.temp/`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (via `bmad-dev-story`)

### Debug Log References

- `supabase status` — DB-only stack confirmed running (DB at `127.0.0.1:54322`; all other services stopped — same DB-only posture as Stories 1.2/1.3). Supabase CLI **2.109.0**, Docker **29.6.1**.
- `supabase db reset` — clean replay `0001 → 0002 → 0003`, **zero errors** (AC #3). The `WARN: no files matched pattern: supabase/seed.sql` is benign (no seed file — same as 1.2/1.3).
- `supabase test db` — `Files=3, Tests=116, Result: PASS`. Per-suite: **0001 30/30**, **0002 48/48** (both unchanged/green), **0003 38/38**.
- Red→green note: for a pure-SQL migration slice the pgTAP suite is the executable spec — it references `audit_log`/`stat_snapshot`/`stat_snapshot_row` (and role/grant behavior) that do not exist until 0003 applies, so it is red pre-migration and green only once the migration is correct. Verified via the single `db reset` + `test db` gate (the 1.2/1.3 precedent).
- `plan(38)` accounting (recounted per the 1.3 mis-count lesson): Section A = 6 (ENABLE/FORCE ×3), A2 = 1 (generic catalog FORCE-guard), B = 6 (`policies_are`×3 + `policy_cmd_is`×3), C = 12 (`has_table_privilege`: service_role INSERT-true/UPDATE-false/DELETE-false ×3 = 9, + authenticated SELECT-false ×3 = 3), D = 13 (service_role 3 `lives_ok` inserts + 4 `throws_ok` update/delete; viewer 3 read + 1 insert `throws_ok`; admin 1; anon 1). Total **38** — matches the observed 38/38.

### Completion Notes List

- **AC #1 (append-only by construction).** All three tables grant `service_role` **only `SELECT, INSERT`** (no UPDATE/DELETE, and no policy either). Behavioral proof (Section D): as `service_role`, the three INSERTs `lives_ok` while UPDATE/DELETE on `audit_log`/`stat_snapshot`/`stat_snapshot_row` throw `42501` — append-only bites even for the BYPASSRLS writer. Grant-layer proof (Section C): `has_table_privilege(service_role, …, 'UPDATE'/'DELETE') = false`.
- **AC #2 (ENABLE+FORCE, admin-only read, no viewer/client access).** All three `ENABLE`+`FORCE` (Section A). Exactly one admin-only SELECT policy per table (`policies_are` — no write/viewer policy; `policy_cmd_is = SELECT`). No `anon`/`authenticated` grant → policy is dormant defense-in-depth: authenticated viewer, authenticated **admin**, and anon all `42501` on SELECT (Section D), documenting the dormancy exactly as the 0002 `app_role` review resolved.
- **AC #3 (clean apply / CAP-1 substrate).** `db reset` replays `0001 → 0002 → 0003` with zero errors. No forward FK to a non-existent table: `audit_log.target_match_id` is a plain nullable `bigint` (no `match` FK — Epic 4); no `ceremony.snapshot_id` FK added (`ceremony` is Epic 6). No env/secret written.
- **AC #4 (convention generalized + provably bites).** Section A2 adds the generic catalog guard: `count(public base tables with relforcerowsecurity=false) = 0` — now covers all seven post-0003 tables and fails loudly if any future migration forgets `FORCE` (the deferred Story 1.3 item, homed here). 0001 (30) + 0002 (48) stay green.
- **Fidelity to the authoritative DDL.** The migration uses the story's `SOLUTION-DESIGN §3` DDL block verbatim (bare-name `create table`, matching 0001's style); `public.`-qualified `regclass`/`has_table_privilege` casts stay in the test, matching 0002. No deviation from the authoritative definitions; no `ceremony`/`match` FK, no capture logic, no `granted_by` CHECK/trigger (all correctly out of scope).
- **Optional remote push deferred.** Task 6's `supabase db push` subtask is intentionally left unchecked — outward-facing on the live `inclusivcup` project (`ufnumdqrhyvijreoyrxf`), deferred pending Cuatro's go-ahead. Local `db reset` + `test db` is the story's "done" gate and passed. Flagged-decision answers (Questions 1–4) were all implemented per the story's recommended readings.

### File List

- `supabase/migrations/0003_audit_snapshot.sql` (new) — migration 0003: `audit_log` + `stat_snapshot` + `stat_snapshot_row`, index, ENABLE/FORCE RLS, admin-only SELECT policies, append-only `service_role` SELECT+INSERT grants.
- `supabase/tests/0003_audit_snapshot_test.sql` (new) — pgTAP suite (`plan(38)`) proving the append-only convention bites (Sections A/A2/B/C/D).
- `_bmad-output/implementation-artifacts/1-4-append-only-audit-and-snapshot-convention.md` (modified) — Tasks/Subtasks checked, Dev Agent Record, File List, Change Log, Status → review.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `1-4` → `in-progress` → `review`; `last_updated` bumped.

---

## Change Log

- 2026-07-01 — Story 1.4 implemented (migration 0003). Created append-only `audit_log` + write-once `stat_snapshot`/`stat_snapshot_row` substrate (SOLUTION-DESIGN §3 columns), ENABLE+FORCE RLS, dormant admin-only SELECT policies, and append-only `service_role` SELECT+INSERT grants (no UPDATE/DELETE). Added pgTAP suite `0003_audit_snapshot_test.sql` (38 assertions incl. the generic catalog FORCE-guard). `db reset` clean; `test db` **116/116** (0001 30 + 0002 48 + 0003 38). CAP-1 substrate complete. Status → review. (agent: claude-opus-4-8 via bmad-dev-story)

---

## Questions / decisions flagged for Cuatro (resolve during dev or review)

1. **All three tables created now vs. splitting snapshot to Epic 6.** This story creates `stat_snapshot`/`stat_snapshot_row` with their **full AD-19 columns** as write-once substrate here (0003), leaving only the *capture* (SERIALIZABLE lock + INSERT) to Story 6.2. This is the recommended reading of CAP-1's success bar and the architecture ("the migration that defines `stat_snapshot_row` is the shared contract"). If you'd rather create only `audit_log` now and defer the snapshot tables wholesale to Epic 6, that diverges from CAP-1's "snapshot tables are append-only" success line — flag it before dev if so.
2. **Append-only via grant (`service_role` gets INSERT, not UPDATE/DELETE).** This is stricter than 0002's full-DML grant and is the real teeth behind AD-17 (BYPASSRLS makes policy-absence insufficient for the writer). Recommended and consistent with the data-integrity review — confirm you're comfortable making it the convention for all future append-only tables.
3. **Admin-read policy is dormant** (no `authenticated` grant → admins read via server/service-role, like `app_role`). Kept as defense-in-depth + documented by a test, exactly as the 0002 review resolved. Say the word if you'd prefer no SELECT policy at all on these three.
4. **Remote push** (`supabase db push`) stays deferred pending your go-ahead (outward-facing). Local `db reset` + `test db` is the "done" gate.
