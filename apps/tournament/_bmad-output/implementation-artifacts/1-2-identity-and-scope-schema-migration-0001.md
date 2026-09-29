---
baseline_commit: feae7a9f35cd9707f01caa9441164f8d61d8a808
---

# Story 1.2: Identity and scope schema (migration 0001)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want the canonical identity and scope tables created with the SteamID64 domain constraint,
so that every later capability joins on one stable key under one seasons-aware scope.

## Acceptance Criteria

1. **Canonical key (AD-4).** Migration 0001 creates `player` with the SteamID64 column as Postgres `text` carrying `CHECK (steamid64 ~ '^[0-9]{17}$')` as the canonical identity (the table's primary key), **and** `display_name` as a mutable, cosmetic column that is never used as a join key.
2. **Seasons-aware scope (AD-18).** Migration 0001 creates `season` and `tournament` such that all event data scopes by `tournament_id` under a `season` (`tournament.season_id` NOT NULL → `season`), **and** no season-spanning feature, query, or UX is introduced.
3. **Role model (AD-12).** `app_role` is created carrying `role` constrained to the closed set `{admin, viewer}`, keyed `UNIQUE` on SteamID64 (primary key on `steamid64`), with **no client write policy**.
4. **Clean apply.** Applied to an empty database, migration 0001 applies cleanly with all `CHECK`/closed-set constraints in place.

_Traces: FR-2 (canonical key) · AD-4, AD-18 · NFR-Data · [Source: epics.md#Story 1.2] · [Source: SPEC.md#CAP-1 success]_

---

## Dev Notes

> **Read this whole section before writing any SQL.** It contains the exact table shapes, the precise scope boundary (what is in 0001 vs. deferred to 0002/later epics), the migration-tooling decision, and the constraint-proof test plan. The dev agent will have only this file — everything needed for a clean implementation is here.

### What this story is (and is not)

- **This is the first code/migration in the repo.** Story 1.1 was provisioning-only (Supabase/Vercel/Railway/R2 stood up + secrets). There is **no** `supabase/config.toml`, no `supabase/migrations/`, no `package.json`, no `go.mod` yet. You are creating `supabase/migrations/` and the first migration file.
- **In scope:** exactly four tables — `season`, `tournament`, `player`, `app_role` — with their `CHECK`/closed-set/PK/FK constraints, in migration `0001`. That is the entire deliverable.
- **Explicitly OUT of scope (do NOT do these here):**
  - RLS `ENABLE`/`FORCE` and any `CREATE POLICY` → **migration 0002 / Story 1.3**. Do not enable RLS or add policies in 0001. (AC #3's "no client write policy" is satisfied *by absence* — you simply create no policy; RLS enablement itself is 0002.)
  - `is_admin()` / `jwt_steamid64()` helper functions → **Story 1.3**.
  - `roster_entry` table → **Story 2.5**.
  - `demo`, `stat_row` → **Epic 3**. `match` → **Epic 4**. `audit_log`, `stat_snapshot`, `stat_snapshot_row` → **Story 1.4 / Epic 4**. `award*`, `ceremony`, `spin`, `verification_bundle` → **Epic 6**.
  - `tournament.final_match_id`'s FK to `match` (the `match` table does not exist yet) and `tournament.fair_seed`'s write-once trigger / population (AD-13, Epic 4/6). See the DDL notes below.
  - Steam login, `app_metadata` binding, session logic → **Epic 2**.

### The exact DDL (authoritative for this story)

Derived from `SOLUTION-DESIGN.md §3` (the adopted data model), scoped to the four identity/scope tables and adjusted for what exists at 0001. **Use these column definitions verbatim** unless you find a concrete apply-time error; if you deviate, document why in the Dev Agent Record.

```sql
-- supabase/migrations/0001_core_schema.sql
-- Logical migration 0001 — Identity & Scope (Story 1.2).
-- Realizes AD-4 (SteamID64 canonical key), AD-18 (seasons-aware scope), AD-12 (app_role shape).
-- Scope: identity/scope tables ONLY. RLS ENABLE+FORCE + policies + helper fns = migration 0002 (Story 1.3).
-- Later tables (roster_entry, demo, match, stat_row, audit_log, snapshot*, award*) arrive in later migrations.

-- Order matters for FKs: season -> tournament (season_id), player -> app_role (steamid64).

create table season (
  id          bigint generated always as identity primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table tournament (
  id             bigint generated always as identity primary key,
  season_id      bigint not null references season(id) on delete restrict,   -- AD-18: every event scopes under a season
  name           text not null,
  state          text not null default 'registration_open'
                 check (state in ('registration_open','registration_closed','bracket_live','ceremony','closed')),
  format_default text,
  final_match_id bigint,   -- nullable NOW; FK to match(id) is added in the Epic-4 match migration (match table does not exist yet)
  fair_seed      text,     -- nullable NOW; = SHA-256(final demo). Write-once trigger + population is AD-13 / Epic 4-6, NOT here
  created_at     timestamptz not null default now()
);

create table player (
  steamid64     text primary key check (steamid64 ~ '^[0-9]{17}$'),   -- AD-4 canonical join key; text, never bigint (JS precision)
  display_name  text not null,                                        -- MUTABLE, cosmetic, NEVER a join key
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table app_role (                          -- event-global in v1 (per-season role scoping deferred, AD-18)
  steamid64   text primary key references player(steamid64) on delete cascade,   -- PK => UNIQUE + NOT NULL: one role per player
  role        text not null check (role in ('admin','viewer')),                  -- AD-12 closed set
  granted_by  text references player(steamid64),                                 -- who granted (nullable; self-ref to player)
  granted_at  timestamptz not null default now()
);
```

**DDL rationale / guardrails:**
- **`steamid64` is `text` with a 17-digit regex CHECK — never `bigint`.** A SteamID64 overflows JS `Number` precision; `text` + `CHECK (~ '^[0-9]{17}$')` is a hard invariant across the whole system. [AD-4, SPEC Constraint]
- **`player.steamid64` is the PK** (satisfies AC #1 "canonical identity"). **`app_role.steamid64` is the PK** (satisfies AC #3 "keyed UNIQUE on SteamID64" — a PK is UNIQUE + NOT NULL). Do not add a redundant separate `UNIQUE` constraint.
- **`display_name` is `not null`** (a player always has a Steam name) **and mutable/cosmetic** — it is *never* referenced in a join or FK. This is the FR-2 rename-tolerance guarantee: renames touch only `display_name`, never the key.
- **FK `ON DELETE` per the Consistency Conventions:** `tournament.season_id → season` = `RESTRICT` (source-of-truth ref); `app_role.steamid64 → player` = `CASCADE` (derived child of a player). [ARCHITECTURE-SPINE.md#Consistency Conventions → Referential integrity]
- **`tournament` includes `format_default`, `final_match_id`, `fair_seed`** even though they serve later epics: they are nullable and forward-compatible, and `SOLUTION-DESIGN §3` places them in `0001_core_schema.sql`. Including them now avoids later `ALTER TABLE` churn. Their *behavior* (the `final_match_id` FK once `match` exists; the `fair_seed` write-once trigger) is deferred — 0001 defines them as plain nullable columns only. If you prefer strict minimalism, omitting the three forward-looking columns is defensible and still satisfies every AC — but the recommended path is to include them as above.
- **Closed-set columns are `CHECK` enums, not Postgres `enum` types** (project convention: `snake_case` + text `CHECK`). Do not create `CREATE TYPE ... AS ENUM`.
- **`snake_case` names, surrogate `bigint` identity PKs everywhere except `player`/`app_role` (`text` steamid64).** [Consistency Conventions → Naming]

### Migration tooling & file naming — DECIDED (confirmed by Cuatro 2026-06-30)

Supabase CLI **v2.109.0** is installed and the project is already **linked** (`supabase/.temp/linked-project.json` → ref `ufnumdqrhyvijreoyrxf`, project `inclusivcup`, us-east-1, free tier, Postgres 15+).

- **Filename (settled):** `supabase/migrations/0001_core_schema.sql`, matching the design contract verbatim (this story is literally "migration 0001"; `SOLUTION-DESIGN §3` names the file `0001_core_schema.sql`; the spine source tree lists `0001 core schema; 0002 RLS`). This is the **project-wide precedent** — every later migration follows sequential `0002_`, `0003_`, … Hand-create the file rather than using `supabase migration new` (which generates a `YYYYMMDDHHmmss_` timestamp prefix). `supabase db push` / `supabase db reset` apply files in lexicographic filename order and record the prefix (`0001`) as the version in `supabase_migrations.schema_migrations`.
- **Fallback:** if CLI 2.109 rejects a non-timestamp version at apply time, rename to a timestamped prefix (`<UTC timestamp>_core_schema.sql`), keep the `core_schema` name, and add a `-- logical migration 0001` header comment. Whichever you pick, **be consistent for the whole roadmap** (0002 in Story 1.3 must sort after 0001).
- **`config.toml`:** none exists. Run `supabase init` to create `supabase/config.toml` (it will not clobber the existing `.temp/`; the project stays linked). `supabase/.temp/` is gitignored; `supabase/migrations/` and `supabase/config.toml` are **not** gitignored and **should be committed** (migrations are source).
- **DB password:** `SUPABASE_DB_PASSWORD` is in the gitignored `.env.local` (documented in `.env.example`) if a direct connection is needed.

### Testing / "done" standard

Primary gate (AC #4): **the migration applies cleanly to an empty database.**
- **Preferred:** `supabase db reset` against a fresh **local** DB (`supabase start` first — requires Docker Desktop on Windows). `db reset` recreates an empty DB and replays all migrations in order, failing loudly on any SQL error. This is the truest "applies cleanly to an empty database" test.
- **If Docker is unavailable:** the linked remote project is currently empty of app tables — `supabase db push` applies 0001 there; confirm it lands as a row in `supabase_migrations.schema_migrations`. (Prefer local reset so you don't have to unwind the remote before 1.3.)
- **RLS-less window (by design, but mind it):** because RLS `ENABLE`/`FORCE` is migration 0002 (Story 1.3), tables created by 0001 alone are briefly reachable via PostgREST with the anon key. There is no app, traffic, or data yet, so the exposure is immaterial — but to avoid a live RLS-less window, prefer verifying 0001 **locally** and pushing to the remote project only together with 0002 in Story 1.3 (or immediately follow a remote 0001 push with 0002). Do not "fix" this by adding RLS to 0001 — that belongs to 1.3.

Recommended constraint-proof (evidences AC #1/#3/#4 — the story's whole point is "constraints in place"). Keep it lean (Cuatro's project = casual private-friends event, no over-engineering). A small pgTAP test at `supabase/tests/0001_core_schema_test.sql`, run via `supabase test db`, asserting the constraints actually bite:
- `player`: a 17-digit numeric `steamid64` **inserts**; a 16-digit, an 18-digit, and a non-numeric (`'7656119abc'`) each **rejected** by the CHECK.
- `app_role`: `role = 'viewer'`/`'admin'` **insert**; `role = 'superadmin'` **rejected**; a duplicate `steamid64` **rejected** (PK); an `app_role` for a non-existent `steamid64` **rejected** (FK).
- `tournament`: `state = 'registration_open'` default applies; `state = 'foo'` **rejected**; a row with `season_id` = NULL or a missing season **rejected** (NOT NULL + FK).

If pgTAP setup is disproportionate, equivalent one-off `psql` assertions captured in the Dev Agent Record are acceptable — but do prove each CHECK/closed-set rejects bad input, not just that the happy path inserts.

### Project Structure Notes

- New paths this story adds: `supabase/config.toml` (via `supabase init`), `supabase/migrations/0001_core_schema.sql`, optional `supabase/tests/0001_core_schema_test.sql`. All under the planned `supabase/migrations/` shared-contract slice. [ARCHITECTURE-SPINE.md#Structural Seed — source tree]
- No conflicts with the planned layout (`app/`, `lib/`, `worker/`, `roulette/vectors/` arrive in later epics; none are touched here).
- **Scope judgment logged for the reviewer:** `tournament.format_default`, `final_match_id`, `fair_seed` are included per `SOLUTION-DESIGN §3`'s `0001_core_schema.sql` even though they serve later epics — nullable, forward-compatible, FK/trigger deferred. This is a deliberate anti-churn choice, not scope creep; omitting them would also pass all ACs.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation & Schema — Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#3. Data model (DDL sketch) — migration 0001_core_schema.sql]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-4 — SteamID64 is the sole canonical join key]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-18 — Seasons-aware schema, no season features]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-12 — Identity & role bound server-side in app_metadata (app_role table shape)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#Consistency Conventions — Naming / Referential integrity]
- [Source: _bmad-output/specs/spec-cs-tournament/SPEC.md#CAP-1 success criterion]
- [Source: _bmad-output/specs/spec-cs-tournament/glossary.md#Data entities (ERD)]
- [Source: _bmad-output/implementation-artifacts/1-1-provision-the-single-environment-and-server-only-secrets.md — provisioning + linked project ref]

### Previous story intelligence (Story 1.1 — done)

- Supabase project `inclusivcup`, ref **`ufnumdqrhyvijreoyrxf`**, **us-east-1**, free tier, **Postgres 15+**, `supabase link` already run (`.temp/linked-project.json`). `SUPABASE_DB_PASSWORD` is in gitignored `.env.local`; var names are documented in committed `.env.example`.
- 1.1 established the secrets discipline: only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed; everything else is server-only. **This story writes no secrets and no `NEXT_PUBLIC_*` vars** — a pure SQL migration — so that discipline is not at risk here, but do not introduce any env usage.
- `.gitignore` already ignores `supabase/.temp/` and `.env*` (except `.env.example`). Your new `supabase/config.toml`, `supabase/migrations/*.sql`, and `supabase/tests/*.sql` are **not** ignored → commit them.
- 1.1 dev agent: `claude-opus-4-8` via bmad-dev-story. 1.1 was reviewed Accept-with-follow-ups → `done`; one deferred item (first-build client-bundle leak scan) is logged for Story 7.5 and is **not** relevant to 1.2.

### Git intelligence

- Baseline commit for this story: `feae7a9` (`chore(infra): provision single-env footprint…`, Story 1.1). Recent history is all planning docs + the 1.1 infra commit — **there is no prior code to inherit a pattern from.** This migration *establishes* the `supabase/migrations/` convention (naming, header-comment style, one-slice-per-story) that Stories 1.3, 1.4, and every later epic's migration will follow. Get it right and consistent.
- Suggested commit style (matches repo history): `feat(db): add identity & scope schema (migration 0001, Story 1.2)`.

### Latest tech information (verified June 2026)

- **Supabase CLI migration convention:** the CLI's *native* format is `YYYYMMDDHHmmss_name.sql`; `supabase migration new` always generates a timestamp prefix, and files apply in version (lexicographic) order, with the prefix stored as the id in `supabase_migrations.schema_migrations`. Sequential `0001_` prefixes are not the CLI default but do apply in-order via `db push`/`db reset`. This is the basis for the naming decision above (recommend `0001_`, fallback timestamp). [https://supabase.com/docs/guides/deployment/database-migrations · https://supabase.com/docs/reference/cli/introduction]
- **Postgres 15+ identity columns:** `bigint generated always as identity primary key` is standard and preferred over `serial`. Regex `CHECK (col ~ '^[0-9]{17}$')` uses POSIX matching — correct as written.

## Tasks / Subtasks

- [x] **Task 1: Initialize the migrations substrate** (AC: 4)
  - [x] Confirm no `supabase/config.toml` / `supabase/migrations/` exist yet; run `supabase init` to create `config.toml` (project stays linked to ref `ufnumdqrhyvijreoyrxf`; `.temp/` untouched).
  - [x] Create `supabase/migrations/0001_core_schema.sql` (recommended sequential name; see fallback in Dev Notes).
- [x] **Task 2: Write the four identity/scope tables** (AC: 1, 2, 3)
  - [x] `season` (id identity PK, name not null, created_at). (AC 2)
  - [x] `tournament` (id identity PK; `season_id` NOT NULL → `season` ON DELETE RESTRICT; name; `state` CHECK closed-set, default `registration_open`; `format_default`, `final_match_id` nullable no-FK, `fair_seed` nullable no-trigger; created_at). (AC 2)
  - [x] `player` (`steamid64` text PK CHECK `~ '^[0-9]{17}$'`; `display_name` not null mutable/cosmetic; `avatar_url`; created_at). (AC 1)
  - [x] `app_role` (`steamid64` text PK → `player` ON DELETE CASCADE; `role` CHECK `in ('admin','viewer')`; `granted_by` → `player`; `granted_at`). Create **no** RLS policy. (AC 3)
  - [x] Add the header comment marking this as logical migration 0001 + the explicit "RLS is 0002" scope note.
- [x] **Task 3: Verify clean apply to an empty database** (AC: 4)
  - [x] `supabase db reset` on a fresh local DB (Docker) — migration applies with zero errors; **or** `supabase db push` to the (empty) linked project and confirm the `supabase_migrations.schema_migrations` row.
- [x] **Task 4: Prove the constraints bite** (AC: 1, 3, 4)
  - [x] Add `supabase/tests/0001_core_schema_test.sql` (pgTAP) — or capture equivalent `psql` assertions in the Dev Agent Record — covering: SteamID64 regex accept/reject (16/18-digit + non-numeric), `role` closed-set reject, `state` closed-set reject, PK-uniqueness reject, FK reject. Run via `supabase test db`.
- [x] **Task 5: Commit** (AC: 1–4)
  - [x] Commit `supabase/config.toml`, `supabase/migrations/0001_core_schema.sql`, and the test file. Do **not** commit `.env.local` or `supabase/.temp/`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, `bmad-dev-story` workflow).

### Debug Log References

- `supabase init` → created `supabase/config.toml` (+ `supabase/.gitignore`). Project stayed linked to ref `ufnumdqrhyvijreoyrxf`; `supabase/.temp/` untouched.
- `supabase projects list` → remote `inclusivcup` runs **Postgres engine 17** (`17.6.1.127`). The config default `major_version = 17` already matches remote, so no config edit was needed (the Dev Notes' "15+" was conservative).
- Local verify path (Docker present): started a **DB-only** stack — `supabase start -x edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector` — so only `supabase_db_cs-tournament` runs (healthy). This keeps the by-design RLS-less window (RLS is 0002/Story 1.3) off every network surface and avoids pulling the full stack.
- AC #4 clean apply: `supabase db reset` → `Applying migration 0001_core_schema.sql...` with **zero errors** against a freshly recreated empty DB.
- Constraint proof: `supabase test db` → **19/19 pgTAP assertions pass** (`Result: PASS`). pgTAP was already installed in the local DB; the test's `create extension if not exists pgtap` is idempotent and `set local search_path = extensions, public` resolves the assertions against our `public` tables.
- Did **not** push to the remote linked project (Dev Notes guidance: avoid a live RLS-less window — remote push lands together with 0002 in Story 1.3).

### Completion Notes List

- Migration `0001_core_schema.sql` creates exactly the four identity/scope tables — `season`, `tournament`, `player`, `app_role` — with all CHECK / closed-set / PK / FK constraints. No RLS, no policies, no helper functions (all deferred to migration 0002 / Story 1.3 per scope). AC #3's "no client write policy" is satisfied **by absence**.
- **AC #1:** `player.steamid64` is a `text` PK with `CHECK (steamid64 ~ '^[0-9]{17}$')` (canonical identity); `display_name text not null` is mutable/cosmetic and never a join key.
- **AC #2:** `season` + `tournament` with `tournament.season_id bigint not null references season(id) on delete restrict`; no season-spanning feature/query/UX introduced.
- **AC #3:** `app_role.steamid64` is the PK (⇒ UNIQUE + NOT NULL, one role per player) referencing `player` ON DELETE CASCADE; `role text not null check (role in ('admin','viewer'))`.
- **AC #4:** verified via `supabase db reset` (clean apply to empty DB) + `supabase test db` (19 constraint assertions bite, not just happy-path inserts).
- Included the three forward-looking `tournament` columns (`format_default`, `final_match_id`, `fair_seed`) as plain nullable columns per `SOLUTION-DESIGN §3`'s `0001_core_schema.sql` (deliberate anti-churn; FK/trigger behavior deferred to Epic 4/6). Logged for the reviewer per the story's scope-judgment note.

### File List

- `supabase/config.toml` (new — via `supabase init`)
- `supabase/.gitignore` (new — via `supabase init`)
- `supabase/migrations/0001_core_schema.sql` (new — logical migration 0001)
- `supabase/tests/0001_core_schema_test.sql` (new — pgTAP constraint proof, 19 assertions)
- `_bmad-output/implementation-artifacts/1-2-identity-and-scope-schema-migration-0001.md` (updated — tasks, Dev Agent Record, status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated — `1-2` → `review`)

### Change Log

- 2026-06-30 — Implemented Story 1.2. Initialized the Supabase CLI substrate (`supabase init`) and added migration `0001_core_schema.sql` (identity & scope: `season`, `tournament`, `player`, `app_role` with all CHECK/closed-set/PK/FK constraints) plus a 19-assertion pgTAP constraint proof. Verified clean apply (`supabase db reset`) and constraints (`supabase test db`, 19/19 PASS). Status: ready-for-dev → in-progress → review.
- 2026-06-30 — Code review (adversarial 3-layer: Blind Hunter · Edge Case Hunter · Acceptance Auditor). Verdict: **Accept with follow-ups**. Applied 3 patches: `app_role.granted_by` → `on delete set null` (Decision 1); +6 pgTAP boundary assertions (regex whitespace/newline ×3, role case/whitespace ×2, state case ×1); +3 assertions proving the `granted_by` SET-NULL-on-grantor-delete behavior. Test plan **19 → 28**. Regex kept shape-only (Decision 2); 2 items deferred (see deferred-work.md). **Re-verify:** `supabase db reset` + `supabase test db` (expect 28/28).
- 2026-07-01 — Second-opinion code review (fresh independent adversarial 3-layer pass on the committed diff `feae7a9..9cc854b`). All 4 ACs **re-confirmed SATISFIED**, scope clean, `granted_by` deviation reconciled. One decision-needed resolved into a patch: added `UNIQUE` on `season.name` and `unique (season_id, name)` on `tournament` (+2 pgTAP assertions, test plan **28 → 30**). Empirically **refuted** a claimed HIGH (trailing-newline regex bypass) against a live PostgreSQL 18.4 cluster — Postgres ARE `$` is end-of-string only, NOT newline-anchored; the CHECK correctly rejects `E'…\n'` (0 rows). Two prior deferrals (`granted_by` audit invariant, non-empty text guards) re-confirmed still valid. **Re-verify (full):** `supabase db reset` + `supabase test db` (expect 30/30). Migration clean-apply + new UNIQUE bite already verified via standalone PG 18.4.

### Review Findings

_Code review 2026-06-30 — adversarial parallel layers (Blind Hunter · Edge Case Hunter · Acceptance Auditor). **Acceptance Auditor: all 4 ACs SATISFIED, no violations, no spec contradictions.** Overall verdict: **Accept with follow-ups** — 2 decisions, 2 optional test-hardening patches, 2 deferred, 6 dismissed as noise._

**Decision-needed (resolved 2026-06-30 by Cuatro):**

- [x] [Review][Decision→Patch] `app_role.granted_by` ON DELETE — **RESOLVED: `on delete set null`.** When a grantor player is deleted, keep the `app_role` row and null the audit pointer; removes the surprising delete-block vs. the cascading PK column. Now tracked as a patch below. [supabase/migrations/0001_core_schema.sql:47]
- [x] [Review][Decision→Dismiss] SteamID64 regex shape-only — **RESOLVED: keep `^[0-9]{17}$` as-is.** Trusted server-side Steam OpenID source (Epic 2); casual event; tightening would reject other Steam universes. Dismissed by decision. [supabase/migrations/0001_core_schema.sql:38]

**Patch:**

- [x] [Review][Patch] `app_role.granted_by` → add `on delete set null`, plus a pgTAP assertion proving a grantor-player delete nulls the pointer (and is not blocked). Resolves Decision 1. [supabase/migrations/0001_core_schema.sql:47]
- [x] [Review][Patch] Add regex-boundary assertions to the pgTAP suite — reject leading/trailing whitespace, trailing newline (`\n`), CR, tab, and Unicode digits; bump `plan()`. Postgres default `~` already rejects all of these (the "`$` allows a trailing newline" hypothesis is FALSE in default mode — empirically verified), so this proves an already-correct guard and locks it against a future pattern refactor. This migration sets the test-discipline precedent for the whole roadmap. [supabase/tests/0001_core_schema_test.sql:23-41]
- [x] [Review][Patch] Add closed-set exactness assertions — reject case/whitespace variants (`'Admin'`, `' admin'`) for `role`, and a case-variant for `tournament.state`; bump `plan()`. Rejection is correct today; a future `lower()`/`trim()` normalization could regress it silently with no test to catch it. [supabase/tests/0001_core_schema_test.sql:46]

**Deferred:**

- [x] [Review][Defer] `granted_by` audit invariant unenforced (self-grant / grant-by-non-admin) [supabase/migrations/0001_core_schema.sql:47] — deferred to Story 1.3 (authorization / `is_admin()` belongs to the RLS slice, not 0001's scope).
- [x] [Review][Defer] Optional non-empty (`char_length > 0`) guards on `display_name` / `season.name` / `tournament.name` / `avatar_url` [supabase/migrations/0001_core_schema.sql] — deferred, optional hardening (low value for a casual event; revisit if empty names surface in the UI).

**Dismissed as noise (6):** non-idempotent bare `create table` (standard forward-only Supabase migration — applied once, wrapped in a txn by `db push`/`db reset`, verified clean); test ordering/coupling nitpicks (currently correct within the pgTAP transaction via `throws_ok` savepoints); `app_role`/`tournament` FK "doesn't inherit the 17-digit format" (false — the FK to `player` transitively enforces the CHECK); pgTAP `with schema extensions` portability (verified on target Supabase PG17); `supabase/.gitignore` bare-`.env` (handled by root `.gitignore` `.env*`, matches at any depth); AC#4 runtime not re-run in the static audit (already evidenced in the Dev Agent Record — 19/19 pgTAP PASS + clean `db reset`).

### Review Findings — Second-Opinion Pass (2026-07-01)

_Independent re-review of the committed Story 1.2 diff (`feae7a9..9cc854b`, `supabase/` scope) via adversarial parallel layers (Blind Hunter · Edge Case Hunter · Acceptance Auditor). **Acceptance Auditor: all 4 ACs SATISFIED, scope respected, `granted_by` ON DELETE SET NULL deviation reconciled, `plan(28)` matches.** Outcome: **1 decision-needed, 0 patches, 2 deferred (already tracked), 2 dismissed.**_

**Decision-needed:**

- [x] [Review][Decision→Patch] No `UNIQUE` on `season.name` or `tournament(season_id, name)` — **RESOLVED (Cuatro, 2026-07-01): option (a) — add the UNIQUE constraints to migration 0001** (still local-only, tables empty → zero risk). Referential integrity was never at risk (surrogate `bigint` PKs are the real keys), but this makes lookup/display **by name** deterministic. Applied: `name text not null unique` on `season`; `unique (season_id, name)` on `tournament`; +2 pgTAP dup-name-reject assertions (`plan(28)`→`plan(30)`). **Re-verified** against a throwaway PostgreSQL 18.4 cluster: amended migration applies clean (`psql -f`, exit 0); dup season name → `23505` (`season_name_key`); dup `(season_id, name)` → `23505` (`tournament_season_id_name_key`); same tournament name under a *different* season still allowed (per-season scope confirmed). [supabase/migrations/0001_core_schema.sql — `season` / `tournament`]

**Deferred (confirmed still valid; already tracked in `deferred-work.md`, not re-logged):**

- [x] [Review][Defer] `granted_by` audit invariant unenforced (self-grant / grant-by-non-admin) [supabase/migrations/0001_core_schema.sql — `app_role.granted_by`] — deferred to Story 1.3 (RLS / `is_admin()` authorization slice). Re-confirmed by this pass.
- [x] [Review][Defer] Optional non-empty (`char_length > 0`) guards on `display_name` / `season.name` / `tournament.name` / `avatar_url` [supabase/migrations/0001_core_schema.sql] — deferred, optional hardening (low value for a casual event). Re-confirmed by this pass.

**Dismissed (2):**

- [Review][Dismiss] **[Edge Case Hunter — claimed HIGH] Trailing-newline regex hole → FALSE POSITIVE, empirically refuted.** The claim: Postgres `~` `$` matches before a trailing newline (Perl/PCRE semantics), so `E'…\n'` would be accepted by the CHECK and the trailing-newline assertion in the pgTAP suite would FAIL, making "28/28 PASS" false. **Verified against a throwaway PostgreSQL 18.4 cluster:** `E'76561197960287930\n' ~ '^[0-9]{17}$'` → `f`; the control probe `E'abc\n' ~ '^abc$'` → `f`; and a real `insert` of the trailing-newline value into a table carrying the exact CHECK is **rejected** with `check_violation` (0 rows stored). Postgres ARE default `$` is end-of-string only — it is NOT newline-anchored (that is a Perl-ism). The prior review's "empirically verified" note and the "28/28 PASS" result both stand. Middle-newline, leading-space, and trailing-space variants also correctly reject.
- [Review][Dismiss] pgTAP fixture ordering/state coupling (the `granted_by` SET-NULL block deletes player …930 near the end) — currently correct: the whole file runs in `begin … rollback`, each `throws_ok` self-rolls-back its failed sub-statement via an implicit savepoint, and …932 holds no role before its `viewer` insert. No defect; the ordering-fragility is latent-only (would only bite a future re-ordering).
