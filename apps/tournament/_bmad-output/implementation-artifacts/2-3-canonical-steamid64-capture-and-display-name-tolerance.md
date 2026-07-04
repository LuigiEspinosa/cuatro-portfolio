---
baseline_commit: 3006dbac4ab7003435f69d84685ced0522bde062
---

# Story 2.3: Canonical SteamID64 capture and display-name tolerance

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want my stats to follow my SteamID64 even if I change my Steam name,
so that renaming on Steam never detaches me from my results.

## Acceptance Criteria

**Primary ACs (verbatim from epics.md#Story-2.3, lines 371–379) — these are the contract:**

1. **(AC1 — canonical-key rule, AD-4 / FR-2)** _Given_ the canonical-key rule (AD-4, FR-2), _When_ any stat or roster record links to a player, _Then_ it joins by SteamID64 and never by `display_name`.

2. **(AC2 — display-name tolerance)** _Given_ a player changes their Steam display name, _When_ they next sign in, _Then_ `display_name` updates cosmetically and the link to their existing stats and roster entry is preserved unchanged.

**Derived ACs (implementation-level; required for a working, testable, provable slice — do not skip):**

3. **(AC3 — rename tolerance proven at the DB level)** A pgTAP assertion set proves that UPDATE-ing `player.display_name` for an existing SteamID64: (a) leaves the `steamid64` primary-key value unchanged (identity is not re-keyed or duplicated — still exactly one row for that id); (b) leaves `player.created_at` unchanged (no re-creation); (c) leaves every row that references that player by SteamID64 still attached and resolvable (today: `app_role` FK'd on `steamid64`; a `stat_snapshot_row` keyed by `steamid64` with no FK). This is the concrete "link preserved unchanged" guarantee.

4. **(AC4 — canonical-key invariant enforced for every table, not just today's)** A pgTAP catalog assertion proves that `display_name` is **never** a join key anywhere in schema `public`: `player`'s primary key is exactly `(steamid64)`; `display_name` participates in **no** PRIMARY KEY, UNIQUE constraint/index, or FOREIGN KEY (referencing or referenced) column. This makes AC1 durable — it bites for the future `roster_entry` (Story 2.5) and `stat_row` (Epic 3) the moment they are added, mirroring the Epic-1 "generic catalog guard" precedent (see Dev Notes).

5. **(AC5 — app-layer proof of the upsert)** Vitest coverage for `lib/players.ts` proves: (a) `upsertPlayer` targets the row by `onConflict: 'steamid64'` (canonical key, never `display_name`); (b) re-invoking the upsert for the **same** SteamID64 with a **different** `display_name` (and/or avatar) issues an upsert keyed on `steamid64` carrying only the cosmetic change — i.e. a rename routes to the same identity, not a new one; (c) a non-17-digit `steamid64` is refused **before** any DB call (`STEAMID64_RE` guard); (d) `fetchSteamProfile` returns the real persona on success and a safe fallback on missing key / non-200 / thrown fetch.

6. **(AC6 — re-login must not degrade a good name/avatar on a transient Steam outage) — CONFIRMED IN SCOPE (Cuatro, 2026-07-03)** On a **repeat** login where `fetchSteamProfile` cannot hydrate the profile (no `STEAM_API_KEY`, non-200, or fetch throw → it returns the `steamid64` placeholder), the upsert must **not** overwrite an already-stored real `display_name`/`avatar_url` with the placeholder. A brand-new player with an unhydratable profile still gets a row (login must succeed) with the placeholder name; an existing player keeps their last good cosmetic values. (Squarely 2.3's subject — "next sign in → `display_name` updates cosmetically" — a transient outage must not turn a good name into a 17-digit number and blank the avatar.)

7. **(AC7 — scope held; no migration; suite accounting)** No schema migration and no new tables — `player` is already correct (0001); do **not** create `roster_entry` (2.5), `stat_row` (Epic 3), the unreconciled surface (2.6), or touch role/enforcement (2.4). Any new pgTAP suite carries an explicit, correct `plan(N)` count (Epic-1 retro action item). `npm test` (Vitest) and `supabase test db` (pgTAP) both stay green. The `display_name` length/charset cap remains **deferred to Epic 5** (see [[deferred-work]]) — do not pull it in here.

## Tasks / Subtasks

- [x] **Task 1 — Prove rename tolerance + the canonical-key invariant in pgTAP (AC3, AC4, AC7)**
  - [x] Read `supabase/tests/0001_core_schema_test.sql` first — it already asserts the `steamid64` CHECK, `display_name NOT NULL`, and `app_role` PK/FK. Do **not** duplicate those; add only the NEW assertions below.
  - [x] **Rename tolerance (AC3):** insert a `player` + an `app_role` row FK'd to it (the required "link preserved" proof); capture `created_at`; `UPDATE player SET display_name = '<new name>' WHERE steamid64 = '<id>'`; then assert: the `app_role` row still resolves by that `steamid64`; `created_at` is unchanged; exactly one `player` row exists for the id; the `steamid64` value is unchanged. **Optional but ideal:** also attach a `stat_snapshot_row` carrying that same `steamid64` — its `steamid64` is intentionally **not a FK** (a captured value; PK is `(snapshot_id, steamid64)`, so it needs a parent `stat_snapshot` row first), which is the perfect demonstration that a *non-FK* stat-style row also stays attached across a rename. If you add it, mirror `supabase/tests/0003_audit_snapshot_test.sql` for the exact insert pattern into these FORCE-RLS append-only tables (role/setup dance) rather than re-deriving it. **DONE:** used a SENTINEL `created_at='2020-01-01'` (not `now()`) so "unchanged" is genuinely provable — a re-creation would reset it to the txn clock. Attached the `stat_snapshot_row` (non-FK) too; seeded as the session role (BYPASSRLS) as 0003 does, so no role dance was needed for a plain seed.
  - [x] **Canonical-key catalog guard (AC4):** assert `player`'s PK column set is exactly `{steamid64}` (e.g. `col_is_pk`/`has_pk` + a `pg_index`/`pg_constraint` check) and that no PK, UNIQUE, or FK constraint in `public` includes a column named `display_name` (query `pg_constraint` joined to `pg_attribute` over `conkey`/`confkey`). Phrase it as a forward-looking guard so a future `roster_entry`/`stat_row` that tried to key on `display_name` would fail this suite. **DONE:** `has_pk` + an `array_agg(conkey)` exact-set check (PK is exactly `{steamid64}`) + three count=0 guards: `conkey` (PK/UNIQUE/FK referencing side), `confkey` (FK referenced side), and `pg_index.indisunique` (UNIQUE index) — none may include a `display_name` column, anywhere in `public`.
  - [x] Place these in a new `supabase/tests/*_test.sql` (suggested `canonical_steamid64_invariant_test.sql`) **or** extend the 0001 suite — your call; if a new file, set its own `plan(N)`; if extending 0001, bump its `plan(30)` by the exact number of new assertions. `stat_snapshot_row` exists from migration 0003 (Story 1.4) — verify its columns before referencing it. **DONE:** new file `supabase/tests/canonical_steamid64_invariant_test.sql`, `plan(10)` (5 AC3 + 5 AC4). Verified `stat_snapshot_row` columns against 0003 (`snapshot_id`, `steamid64`, `stats_int` NOT NULL) before referencing.
  - [x] Run `supabase test db`; confirm the full suite is green with correct plan accounting (currently 120/120 across 0001+0002+0003 — your additions raise the total; report the new number). **DONE: 130/130** (was 120; +10). `Files=4, Tests=130, Result: PASS`.

- [x] **Task 2 — App-layer proof: `lib/players.test.ts` (AC5)** — NEW file (there is no test for `lib/players.ts` today)
  - [x] `upsertPlayer`: assert the Supabase call is `.from('player').upsert(<payload>, { onConflict: 'steamid64' })` with a mock client; the payload carries `steamid64` + the cosmetic fields and is keyed on `steamid64` (never `display_name`).
  - [x] Rename routing: call `upsertPlayer` twice for the same `steamid64` with two different `display_name` values; assert both calls key on `onConflict: 'steamid64'` (the rename lands on the same identity, not a new key).
  - [x] Guard: a non-17-digit `steamid64` throws **before** any `admin.from(...)` call (assert the mock was never invoked). **DONE:** parametrized (`it.each`) over too-short/too-long/non-numeric/empty; each asserts `from` was never called.
  - [x] `fetchSteamProfile`: success (injected/mocked `fetch` → real `personaname`/`avatarfull`); missing key → `{ displayName: steamid64, avatarUrl: null }`; non-200 → fallback; thrown fetch → fallback. Inject the transport (mock global `fetch` or refactor to an injectable `HttpGet` mirroring 2.1's `HttpPost` seam) so tests never hit live Steam. **DONE via the injectable seam:** added `HttpGetJson` (mirrors `HttpPost`). NOTE — the missing-key/non-200/throw cases now return **`null`** (the explicit unhydrated signal), not the old placeholder object; this is the AC6 change (see Task 3). Success + blank-persona-fallback + empty-players (→ null) covered.
  - [x] `npm test` stays green (currently 43/43; report the new total). **DONE: 58/58** (was 43; +15).

- [x] **Task 3 — Re-login placeholder-clobber guard (AC6) — CONFIRMED IN SCOPE (Cuatro, 2026-07-03)**
  - [x] Make "profile could not be hydrated" an explicit signal rather than an in-band placeholder. Recommended: `fetchSteamProfile` returns `SteamProfile | null` (`null` = unhydrated), or add a discriminator (`{ ok: false }`). Keep the login-success contract: a null/failed hydration must still let login proceed. **DONE:** `fetchSteamProfile` now returns `SteamProfile | null` (`null` = no key / non-200 / thrown / 200-with-no-player). Login still proceeds on `null`.
  - [x] In `upsertPlayer` (or the callback wiring), branch on hydration:
    - **Real profile** → current behavior: `.upsert({ steamid64, display_name, avatar_url }, { onConflict: 'steamid64' })` (updates the cosmetic fields).
    - **Unhydrated** → `.upsert({ steamid64, display_name: steamid64, avatar_url: null }, { onConflict: 'steamid64', ignoreDuplicates: true })` — this emits `ON CONFLICT DO NOTHING`, so a brand-new player still gets a placeholder row but an **existing** player's good `display_name`/`avatar_url` is never clobbered. **DONE:** branch lives in `upsertPlayer` (`profile ? … : …`).
  - [x] Update the callback wiring in `app/auth/steam/callback/route.ts` (the `upsertPlayer` effect closure calls `fetchSteamProfile` then `upsertPlayer`) to pass the hydration signal through. Keep `lib/auth/login-flow.ts`'s `LoginSideEffects.upsertPlayer(steamid64)` signature unchanged (the profile fetch stays inside the closure). **DONE:** the `null` signal threads through the closure by type (`SteamProfile | null` flows `fetchSteamProfile` → `upsertPlayer`); added a clarifying comment at the seam. `login-flow.ts`'s public interface is untouched.
  - [x] Tests: re-login with an existing player + unhydrated profile → the upsert uses `ignoreDuplicates: true` (name/avatar preserved); new player + unhydrated → placeholder row inserted; real profile → cosmetic update as before. **DONE.** (Unit level: both the existing-and new-player unhydrated cases produce the same `{ onConflict:'steamid64', ignoreDuplicates:true }` call — the DB's `ON CONFLICT DO NOTHING` differentiates insert-vs-preserve; the real-profile path uses plain `onConflict`.)
  - [x] Scope note: AC6 is confirmed in-scope (Cuatro, 2026-07-03) — build it. Keep it minimal (one `ignoreDuplicates` branch + tests); do **not** expand into the `display_name` length/charset cap, which stays Epic-5-deferred. **DONE — kept minimal;** length/charset cap NOT touched (stays Epic-5-deferred).

- [x] **Task 4 — Build + regression gate (AC7)**
  - [x] `npm run build` (`next build`) clean; no new `NEXT_PUBLIC_` secret; `/auth/steam/*` stay `ƒ` (Node runtime). Confirm no migration was added (`supabase/migrations/` unchanged — only `supabase/tests/` may gain a file). **DONE:** build compiled + TypeScript clean; `/auth/steam/callback` + `/auth/steam/login` both `ƒ`; `supabase/migrations/` unchanged (`git status` empty for that path); no `NEXT_PUBLIC_` added (`players.ts` is `server-only`).
  - [x] Confirm scope held: no `roster_entry`/`stat_row`/unreconciled/role code touched. **DONE:** only `lib/players.ts`, `app/auth/steam/callback/route.ts` (comment), and the two test files changed. No role/session/roster/stat_row code touched.

- [ ] **Task 5 — Live QA (AC2 end-to-end) — SIGN-OFF GATE (mirrors 2.1/2.2; needs a real Steam login + live Supabase)** — ⛔ **PENDING: human gate, cannot be automated by the dev agent.** Requires Cuatro's real Steam account. Left unchecked deliberately (all automated gates are green; this mirrors 2.1/2.2, where the live-QA sign-off was cleared by Cuatro after code-review, not during dev-story).
  - [ ] With Cuatro's real Steam account: log in once, then **change the Steam persona name**, then log in again. Confirm via SQL that `player` for that `steamid64` shows the **new** `display_name`, the **same** `steamid64` PK, the **same** `created_at`, and the `app_role` row (and `auth.users.app_metadata.steamid64`) are unchanged/still attached. (This is the human-observable form of AC2/AC3.)
  - [ ] (If AC6 is in scope) Sanity-check the transient-failure path if feasible (e.g. temporarily blank `STEAM_API_KEY` locally): re-login does not overwrite the stored real name with the 17-digit id.

## Dev Notes

### 🎯 Scope Boundary — 2.3 proves an invariant already largely built in 2.1 (read first)

The mechanical rename tolerance **already ships** — Story 2.1's `upsertPlayer` does `.upsert({ steamid64, display_name, avatar_url }, { onConflict: 'steamid64' })`, so a repeat login updates the cosmetic fields and keeps the `steamid64` PK. **2.3 does not re-implement that.** 2.3's job is to (1) **prove** the canonical-key invariant and rename tolerance durably (pgTAP + Vitest), and (2) close one real re-login robustness gap (AC6). Stay inside the box:

| Concern | Story | 2.3 action |
|---|---|---|
| `steamid64` is the sole join key; `display_name` never a join key; **prove** it holds for every table | **2.3** | ✅ prove (pgTAP catalog guard) |
| Rename tolerance: re-login updates `display_name` cosmetically, identity/links preserved | **2.3** | ✅ prove (pgTAP data test + Vitest) + close the placeholder-clobber gap (AC6) |
| Steam OpenID verify + service-role `player` upsert + `app_metadata.steamid64` + session mint | **2.1** | ✅ DONE — do not re-do (the upsert already exists) |
| `app_metadata.role` binding + admin allowlist bootstrap | **2.2** | ✅ DONE — do not touch |
| Role **enforcement**, revoke-invalidates-session, `granted_by` invariant | **2.4** | ❌ do not build |
| `roster_entry` table + registration window | **2.5** | ❌ **do not create** (no migration in 2.3) |
| The **unreconciled-SteamID64 list** surface (parsed id not on roster) | **2.6** | ❌ do not build — 2.3 only establishes the canonical key it relies on |
| `stat_row` (parsed stats keyed by `match_id`+`steamid64`) | **Epic 3** | ❌ do not create |
| `display_name` length/charset cap | **Epic 5** | ❌ deferred ([[deferred-work]]) |

[Source: epics.md#Story-2.3 lines 363–379; #Story-2.1 lines 317–338 (upsert already built); FR Coverage Map line 138 — FR-2 spans 1.2 (key) / 2.3 / 2.6 / 3.4.]

### ⭐ Central design decision — include AC6 (placeholder-clobber guard) or defer it?

This is 2.3's **one genuine judgment call** (like 2.2's "write `app_role` too?"). The two primary ACs are literally satisfied by 2.1's upsert + proof tests — the identity link is preserved regardless, because the join key never changes. But there is a real, on-theme robustness gap in the **re-login** path:

- `fetchSteamProfile` ([lib/players.ts:24-50](lib/players.ts)) returns `{ displayName: steamid64, avatarUrl: null }` (a placeholder) whenever the Steam Web API can't be reached (no key / non-200 / thrown fetch — all caught, so login still succeeds).
- `upsertPlayer` then writes that placeholder with `onConflict: 'steamid64'` **updating** the row → on a transient outage, an existing player's good `display_name` is overwritten with their 17-digit id and their avatar is nulled. AC2 says "next sign in → `display_name` updates **cosmetically**" — degrading a good name to a number is the opposite of a cosmetic update.

**DECISION — RESOLVED (Cuatro, 2026-07-03): include AC6.** It is cheap (a `ignoreDuplicates: true` branch = `ON CONFLICT DO NOTHING`), squarely on-theme, and prevents a visibly-bad outcome once names render on leaderboards (Epic 5). The leaner alternative (defer to Epic 5, keep 2.3 as pure invariant + tests) was considered and declined — the transient-outage name degradation is worth closing now while the upsert path is already open. Keep the fix minimal: only the placeholder-clobber branch, **not** the `display_name` length/charset cap (that stays Epic-5-deferred, [[deferred-work]]).

### 🔑 The exact code seam (do not reinvent — the upsert already exists)

`lib/players.ts` (2.1, verbatim shape):
```ts
export async function upsertPlayer(admin, steamid64, profile): Promise<void> {
  if (!STEAMID64_RE.test(steamid64)) throw new Error(`Refusing to upsert non-canonical steamid64: ${steamid64}`);
  const { error } = await admin.from('player').upsert(
    { steamid64, display_name: profile.displayName || steamid64, avatar_url: profile.avatarUrl },
    { onConflict: 'steamid64' },   // ← canonical key; on re-login this UPDATEs display_name/avatar_url, keeps the PK
  );
  if (error) throw new Error(`player upsert failed: ${error.message}`);
}
```
`created_at` is **not** in the payload, so on the conflict/UPDATE path it is untouched (rename tolerance preserves it — AC3 asserts this). The callback wires the effect ([app/auth/steam/callback/route.ts:55-58](app/auth/steam/callback/route.ts)): `fetchSteamProfile(steamid64, env.steamApiKey())` → `upsertPlayer(admin, steamid64, profile)`. `LoginSideEffects` in [lib/auth/login-flow.ts](lib/auth/login-flow.ts) exposes only `upsertPlayer(steamid64)` — the profile fetch lives inside the route closure, so AC6's hydration signal is threaded there, **not** through `login-flow.ts`'s interface.

There is **no** `lib/players.test.ts` today (2.1 tested openid/nonce/callback/login-flow but not `players.ts`) — Task 2 fills that gap.

### The canonical-key invariant 2.3 must prove (architecture, verbatim)

- **AD-4** [ARCHITECTURE-SPINE.md#L95–99]: _"SteamID64 is the sole canonical join key … **Prevents:** a Steam rename orphaning stats; precision loss corrupting the key. **Rule:** `steamid64` (Postgres `text`, `CHECK (~ '^[0-9]{17}$')`) is the only key joining `stat_row` to the roster. `display_name` is mutable and cosmetic and is **never** a join key. A parsed SteamID64 not in the roster lands in an 'unreconciled' list (left-join), never silently dropped."_
- **SOLUTION-DESIGN.md#L318–319:** _"`display_name` is synced from Steam **cosmetically only**."_
- Schema facts the invariant rests on (0001, verified on disk):
  - `player.steamid64 text primary key check (steamid64 ~ '^[0-9]{17}$')`; `display_name text not null` — _"MUTABLE, cosmetic, NEVER a join key"_ [0001_core_schema.sql:38-43].
  - `app_role.steamid64 references player(steamid64) on delete cascade` — joins by `steamid64` [0001_core_schema.sql:45-50].
  - Future (do **not** create here, but the catalog guard must protect them): `roster_entry.steamid64 references player(steamid64) on delete restrict, unique(tournament_id, steamid64)` [SOLUTION-DESIGN.md#L83-91]; `stat_row.steamid64 text not null … not FK (FR-2 unreconciled left-join), unique(match_id, steamid64)` [SOLUTION-DESIGN.md#L141-156]. **Every player linkage is by `steamid64`; none is by `display_name`.** That is exactly what AC4's catalog assertion pins.

### Why a pgTAP catalog guard (Epic-1 precedent)

Epic 1 established that invariants which must "bite for every future table" are enforced with a **generic catalog pgTAP assertion**, not just per-table data tests — e.g. Story 1.4 added a catalog `FORCE`-guard so "the convention bites for every future table, not just the current four" ([[deferred-work]], resolved-in-1.4 note). AC4 applies the same pattern to "`display_name` is never a join key": a per-table test only proves today's tables; a catalog assertion (no PK/UNIQUE/FK column named `display_name` anywhere in `public`) makes AC1 durable for `roster_entry` (2.5) and `stat_row` (Epic 3) the moment they land. Retro action item (still open): _"Keep explicit `plan(N)` assertion-accounting for every new pgTAP suite."_

### Security / correctness requirements (non-negotiable)

- **Never introduce a `display_name` join.** The whole point of AD-4 is that identity is `steamid64`-only; any lookup/join/dedup by `display_name` is a defect. The catalog guard exists to catch this in future stories.
- **Keep `steamid64` a `text` string end-to-end** — never parse to a JS `Number` (>2^53 precision loss). The guard `STEAMID64_RE = /^[0-9]{17}$/` must stay in front of every DB write (it already is).
- **Login must still succeed on a cosmetic-fetch failure** (AC2/AC6): profile hydration is best-effort; a Steam Web API outage must not block login and (AC6) must not degrade stored good values.
- **No `user_metadata`, no role work, no service-role bypass changes** — 2.3 touches only the cosmetic `player` row + tests. `app_metadata`/role stay exactly as 2.2 left them.

### Previous-story intelligence (Stories 2.1, 2.2 — both `done`, live-QA'd)

- **2.1** built `lib/players.ts` (`upsertPlayer` + `fetchSteamProfile`) and the callback wiring; live-QA confirmed a real login upserts `player` with the real persona/avatar. The `onConflict: 'steamid64'` upsert is the rename-tolerance mechanism 2.3 proves.
- **2.1 deferred** (still open, relevant): _"`display_name` from the Steam persona is written unbounded/un-length-checked"_ → **Epic 5**, do **not** fix in 2.3. Note: 2.1 also deferred a `fetchSteamProfile` avatar/name concern only as "cosmetic" — AC6 is the narrower, higher-value slice (don't clobber a good value), not the length cap.
- **2.2** extended `session.ts` for role binding and added a `server-only` Vitest stub ([test/stubs/server-only.ts] + [vitest.config.ts] alias) — this is why `lib/players.ts` (which does `import 'server-only'`) is now unit-testable without extra wiring. Tests live at `lib/**/*.test.ts` (vitest `include`), run from repo root, `@` → repo root.
- Precedents to follow: injectable effects for Vitest (mirror 2.1's `HttpPost`/`SteamVerifier` seam for the `fetch` in `fetchSteamProfile`); `import 'server-only'` stays on `players.ts`; DB `snake_case`, identifiers/comments English; any user-facing copy Spanish (none expected in 2.3).

### Git intelligence

Baseline `3006dba` (HEAD, clean tree) = Story 2.2 sign-off. Recent commits: `3006dba` (2.2 review+QA→done), `7784eca` (2.2 role binding), `6d9e3b0` (2.2 hydrate), `3b0f161` (2.1 sign-off), `42f497e` (2.1 HPP fix). The auth/identity surface (`lib/players.ts`, `lib/auth/*`, `app/auth/steam/callback/route.ts`, `supabase/tests/*`) is 2.3's working set. **No migration since 0003; 2.3 adds none** — only a `supabase/tests/*.sql` file and Vitest specs (+ AC6's small `players.ts`/callback edit if in scope). Next migration `0004_` remains earmarked for Story 2.5 (`roster_entry`).

### Project Structure Notes

- **New:** `lib/players.test.ts` (Vitest); `supabase/tests/canonical_steamid64_invariant_test.sql` (pgTAP — or extend `0001_core_schema_test.sql`).
- **Modified (only if AC6 in scope):** `lib/players.ts` (`fetchSteamProfile` returns an explicit unhydrated signal; `upsertPlayer` gains the `ignoreDuplicates` branch), `app/auth/steam/callback/route.ts` (thread the hydration signal in the effect closure).
- **Untouched:** `supabase/migrations/` (no migration), all role/session code (`lib/auth/session.ts`, `lib/auth/roles.ts`), `lib/auth/login-flow.ts`'s public interface.
- Identifiers/code/comments English; DB `snake_case`; user-facing copy Spanish (none new here).

### References

- [Source: epics.md#Story-2.3 (lines 363–379)] — user story + ACs (verbatim), `_Traces: FR-2 · AD-4 · NFR-Data_`
- [Source: epics.md line 32] — FR-2 (SteamID64 canonical join key; **tolerates Steam display-name changes without breaking the link to stats**)
- [Source: epics.md line 82] — AD-4 (sole canonical join key; `display_name` cosmetic, never a join key; unmatched → unreconciled list)
- [Source: epics.md#Story-2.6 (lines 422–438)] — the 2.3/2.6 boundary (unreconciled-list surface = 2.6; 2.3 only establishes the canonical key)
- [Source: epics.md FR Coverage Map line 138] — FR-2 spans 1.2 (key) · 2.3 · 2.6 · 3.4
- [Source: ARCHITECTURE-SPINE.md#L95–99] — AD-4 full text: "the only key joining `stat_row` to the roster… `display_name`… never a join key… Prevents a Steam rename orphaning stats"
- [Source: SOLUTION-DESIGN.md#L304–319] — identity/auth flow §5; step 3 "Upsert `player` (service-role)"; L318–319 "`display_name` is synced from Steam cosmetically only"
- [Source: SOLUTION-DESIGN.md#L83–91, #L141–156] — `roster_entry`/`stat_row` DDL (future; both join by `steamid64`, `stat_row.steamid64` intentionally not-FK) — the tables AC4's catalog guard must protect
- [Source: supabase/migrations/0001_core_schema.sql:38-50] — `player`/`app_role` DDL (verified): `steamid64` PK + 17-digit CHECK, `display_name` MUTABLE/cosmetic, `app_role` FK on `steamid64`
- [Source: supabase/tests/0001_core_schema_test.sql:18-201] — existing pgTAP (plan 30): `steamid64` CHECK, `display_name NOT NULL`, `app_role` PK/FK — 2.3 adds NEW rename-tolerance + catalog-guard assertions, does not duplicate these
- [Source: lib/players.ts:12,57-78] — `STEAMID64_RE` guard + `upsertPlayer` `onConflict: 'steamid64'` (the rename-tolerance mechanism); `fetchSteamProfile:24-50` (the placeholder fallback AC6 addresses)
- [Source: app/auth/steam/callback/route.ts:55-58] — the `upsertPlayer` effect closure (`fetchSteamProfile` → `upsertPlayer`) where AC6's signal threads
- [Source: vitest.config.ts:6-18 + test/stubs/server-only.ts] — `lib/**/*.test.ts`, `@`→root, `server-only` stub (from 2.2) enabling unit tests of `import 'server-only'` modules
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `display_name` length/charset cap = Epic 5 (do not pull in); Epic-1 generic-catalog-guard precedent (AC4 mirrors it)
- [Source: sprint-status.yaml action_items] — open retro item: explicit `plan(N)` accounting for every new pgTAP suite

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, `bmad-dev-story` workflow)

### Debug Log References

- `npx vitest run` — **58/58 passed** (7 files). Baseline was 43/43; +15 from the new `lib/players.test.ts`.
- `supabase test db` — **`Files=4, Tests=130, Result: PASS`**. Baseline was 120 (0001=30 + 0002=48 + 0003=42); +10 from the new `canonical_steamid64_invariant_test.sql` (`plan(10)`).
- `npm run build` — compiled + TypeScript clean; `/auth/steam/callback` + `/auth/steam/login` render `ƒ` (Node runtime, dynamic).
- `git status` — `supabase/migrations/` unchanged (no migration added, per AC7).

### Completion Notes List

**Scope framing.** 2.3 proves an invariant already mechanically shipped by 2.1's `upsertPlayer` (`onConflict:'steamid64'`) and adds ONE robustness fix (AC6). No new machinery beyond the AC6 branch; no migration.

**What changed (AC6 — the one real code change).**
- `lib/players.ts`: `fetchSteamProfile` now returns `SteamProfile | null` — `null` is the explicit **unhydrated** signal (no `STEAM_API_KEY`, non-200, thrown/timed-out fetch, or a 200 with no player). Previously it returned an in-band placeholder object, which `upsertPlayer` then **wrote**, degrading an existing player's good name to their 17-digit id on any transient Steam outage. `upsertPlayer` now branches: a real profile takes the normal `onConflict:'steamid64'` update; `null` takes `{ onConflict:'steamid64', ignoreDuplicates:true }` → `ON CONFLICT DO NOTHING`, so a brand-new player still gets a placeholder row but an existing player's good cosmetic values are never clobbered.
- Added an injectable `HttpGetJson` transport (mirrors 2.1's `HttpPost` seam) so `fetchSteamProfile` is unit-testable without hitting live Steam. The default transport throws on non-200 so every failure maps to the same `null`.
- `app/auth/steam/callback/route.ts`: the `null` signal threads through the existing effect closure **by type** (`SteamProfile | null` flows `fetchSteamProfile` → `upsertPlayer`); added a clarifying comment at the seam. `lib/auth/login-flow.ts`'s `LoginSideEffects.upsertPlayer(steamid64)` public interface is deliberately untouched (the profile fetch stays inside the route closure).

**Proof added (no behavior change).**
- `supabase/tests/canonical_steamid64_invariant_test.sql` (`plan(10)`): **AC3** rename tolerance — seeds a player (sentinel `created_at`), an FK'd `app_role`, and a non-FK `stat_snapshot_row` all keyed by the same steamid64; UPDATEs `display_name`; asserts exactly one row for that id, the new name, unchanged `created_at`, and that both the FK and non-FK links still resolve. **AC4** catalog guard — `player`'s PK is exactly `{steamid64}`, and NO PK/UNIQUE/FK constraint or UNIQUE index anywhere in `public` keys on `display_name` (forward-looking: bites for future `roster_entry`/`stat_row`).
- `lib/players.test.ts` (NEW, 15 tests): `upsertPlayer` keys on `onConflict:'steamid64'` with the cosmetic payload (never `display_name`); a rename routes to the same key twice; the 17-digit guard fires before any DB call (4 bad-id cases); AC6 → `ignoreDuplicates:true` placeholder call; `fetchSteamProfile` success / URL params / missing-key→null / throw→null / empty-players→null / blank-persona→steamid64 fallback.

**Design notes / precedents honored.** `steamid64` stays a `text` string end-to-end (never parsed to a JS Number). `STEAMID64_RE` guard remains in front of every DB write, including the unhydrated path. No `user_metadata`, no role/session change, no service-role bypass change — `app_metadata`/role stay exactly as 2.2 left them. The `display_name` length/charset cap remains Epic-5-deferred (NOT pulled in).

**⛔ Task 5 (live-QA sign-off) is a HUMAN gate — not performed here.** It needs Cuatro's real Steam account (login → rename Steam persona → re-login → SQL check). This mirrors 2.1/2.2, where the live-QA sign-off was cleared by Cuatro after code-review, not during dev-story. Left unchecked deliberately — all automated gates are green.

### File List

- **Modified:** `lib/players.ts` — `fetchSteamProfile` returns `SteamProfile|null` (explicit unhydrated signal) + injectable `HttpGetJson` seam; `upsertPlayer` accepts `SteamProfile|null` and gains the AC6 `ignoreDuplicates` branch.
- **Modified:** `app/auth/steam/callback/route.ts` — clarifying comment documenting the AC6 hydration signal threading through the `upsertPlayer` effect closure (no logic change; the `null` flows through by type).
- **Added:** `lib/players.test.ts` — Vitest coverage for `upsertPlayer` (AC5a/b/c + AC6) and `fetchSteamProfile` (AC5d + AC6) via the injected `HttpGetJson` transport.
- **Added:** `supabase/tests/canonical_steamid64_invariant_test.sql` — pgTAP `plan(10)`: AC3 rename tolerance + AC4 canonical-key catalog guard.
- **Modified (workflow tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 2-3 `ready-for-dev` → `in-progress` → `review`. `_bmad-output/implementation-artifacts/2-3-canonical-steamid64-capture-and-display-name-tolerance.md` — this story file (Tasks, Dev Agent Record, Change Log, Status).

## Change Log

| Date | Change |
|---|---|
| 2026-07-03 | Story 2.3 implemented via `bmad-dev-story`. AC6 placeholder-clobber guard: `fetchSteamProfile` → `SteamProfile\|null`, `upsertPlayer` `ignoreDuplicates` branch (`ON CONFLICT DO NOTHING`), injectable `HttpGetJson` seam. Proof: new pgTAP `canonical_steamid64_invariant_test.sql` (`plan(10)` — AC3 rename tolerance + AC4 catalog guard) and new `lib/players.test.ts` (15 tests). Vitest 43→58; pgTAP 120→130; `next build` clean; no migration. Status → review. Task 5 (live-QA sign-off) pending as a human gate. |
| 2026-07-03 | **Code review** (`bmad-code-review`, 3 adversarial layers — all Opus-4.8, converged on the AC6 gap). Triage: 1 decision + 2 patch + 3 defer + 6 dismissed. **Decision → Option A (Cuatro):** `fetchSteamProfile` now returns `null` on a blank/absent persona (was an id-fallback that took the UPDATE path and clobbered a stored good name) → routes to the DO-NOTHING preserve path; avatar-only partial-200 case deferred to Epic 5. **Patches applied:** P0 (Option A + softened doc comments + revised Vitest case); P1 (new DB-level AC6 behavioral proof — insert good row → placeholder upsert `on conflict do nothing` → assert `display_name`/`avatar_url` unchanged + brand-new placeholder still inserts); P2 (AC4 catalog guard extended to `EXCLUDE` constraints `contype='x'`; expression/partial-index blind spot noted as Epic-5 residual). **Verified green:** Vitest **59/59** (58→59), `supabase test db` **133/133** (`plan(10)`→`plan(13)`, 130→133), `next build` clean, `/auth/steam/*` stay `ƒ`, no migration. 4 defers → [[deferred-work]]. Status `review` → **in-progress** (code review clean; **Task 5 live-QA sign-off remains the human gate before `done`** — mirrors 2.1/2.2). |

### Review Findings — Code Review (2026-07-03)

Adversarial parallel review (3 layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor, all Opus-4.8, no shared context). All three layers completed; none failed. AC coverage per the Acceptance Auditor: **6/7 VERIFIED, AC6 PARTIAL**. From ~18 raw findings, deduplicated to **1 decision-needed, 2 patch, 3 defer, 6 dismissed**. The three layers converged independently on the AC6 partial-profile clobber (decision-needed), which raises confidence it is real.

**Decision-needed (RESOLVED — Cuatro, 2026-07-03 → Option A):**

- [x] [Review][Decision → Patch] AC6 clobber-guard has a partial-profile hole [lib/players.ts:64-71,99-107] — **RESOLVED: Option A** (treat a blank/absent persona as unhydrated → `fetchSteamProfile` returns `null` when `!player.personaname?.trim()`, routing to the DO-NOTHING preserve path; the rarer avatar-only partial-200 case is deferred to Epic 5). Converted to patch **P0** below. Original finding: a Steam **200** whose player object is present but has a blank/missing `personaname` (→ `displayName` falls back to the 17-digit `steamid64`) or a missing `avatarfull` (→ `avatarUrl: null`) returns a *truthy* `SteamProfile`, so `upsertPlayer` takes the `onConflict:'steamid64'` **UPDATE** path (not the `ignoreDuplicates` preserve path) and overwrites a stored good `display_name`/`avatar_url` — the exact outcome AC6's *intent* ("a transient outage must not turn a good name into a 17-digit number and blank the avatar") forbids. AC6's *literal* trigger list is only {no key, non-200, throw}, so the partial-200 case is a genuine scope ambiguity. **Options:** (A) treat a blank/absent persona as unhydrated (return `null` when `!personaname?.trim()`) so it routes to DO-NOTHING preserve; (B) per-field preserve — only overwrite a field with a real value (needs a read-modify-write or DB-side COALESCE, more machinery); (C) accept the narrow total-failure scope, correct the overstated "never clobbered" comment, and defer the partial case to Epic 5. _(sources: blind+edge)_

**Patch (unambiguous fixes):**

- [x] [Review][Patch] ✅ **P0 APPLIED** AC6 partial-profile name clobber (resolved from Decision → Option A) [lib/players.ts:64-71] — return `null` from `fetchSteamProfile` when the fetched player has a blank/absent `personaname` (`!player.personaname?.trim()`) so it routes to the `ignoreDuplicates` DO-NOTHING preserve path instead of overwriting a stored good name with the 17-digit id; soften the overstated "never clobbered" doc comments to match. Avatar-only partial-200 clobber deferred to Epic 5. Add a Vitest case (blank persona → `null`, not the id-fallback profile). _(from decision-needed)_
- [x] [Review][Patch] ✅ **APPLIED** AC6 preservation has no behavioral test — add DB-level proof [supabase/tests/canonical_steamid64_invariant_test.sql] / [lib/players.test.ts:88-99] — the "existing good row not clobbered" guarantee is proven only at mock/call-shape level (`opts` deep-equals `{onConflict, ignoreDuplicates:true}`); the mock returns `{error:null}` regardless, so the suite would pass even if `ignoreDuplicates` were a no-op. Add ~2 pgTAP assertions to the new suite: insert a good `player` row → re-`upsert` the placeholder with `ignoreDuplicates:true` (ON CONFLICT DO NOTHING) → assert `display_name`/`avatar_url` are unchanged; bump `plan(10)`. _(sources: blind+auditor)_
- [x] [Review][Patch] ✅ **APPLIED** AC4 catalog guard misses EXCLUDE constraints + expression/partial unique indexes [supabase/tests/canonical_steamid64_invariant_test.sql:90-127] — the guard checks `contype in ('p','u','f')` and `indisunique` over `indkey`, so an `EXCLUDE` (`contype='x'`) or an expression unique index (`create unique index … on t(lower(display_name))`, column stored in `indexprs`/`attnum=0`) keying on `display_name` slips past — exactly the forward-looking `roster_entry`/`stat_row` footgun AC4 exists to catch. Add `'x'` to the constraint contype set (trivial); the expression/partial-index detection (parse `pg_get_indexdef`) is a noted residual. _(sources: edge+auditor+blind)_

**Deferred (real, not actionable now — logged to [[deferred-work]]):**

- [x] [Review][Defer] `defaultGet` real transport never exercised by any test [lib/players.ts:29-38] — deferred, thin-glue coverage (mirrors 2.1's untested `HttpPost` default).
- [x] [Review][Defer] Unhydrated FIRST login writes a permanent 17-digit placeholder name [lib/players.ts:108-111] — deferred, accepted AC6 design consequence; heals on next healthy login, reconciliation home = Story 2.6.
- [x] [Review][Defer] `ignoreDuplicates:true` no-op indistinguishable from a real insert [lib/players.ts:108-111] — deferred, latent (benign while `player` has only the `steamid64` PK; footgun if a 2nd UNIQUE is added).
- [x] [Review][Defer] AC6 avatar-only partial-200 clobber [lib/players.ts:70] — deferred to Epic 5 (from decision Option A); a present-persona/missing-`avatarfull` 200 nulls a stored good avatar — far less severe than the name clobber, per-field preserve needs machinery not warranted here.

**Dismissed (6):** redundant `not.toHaveProperty('created_at')` / test-name oversell (intentional readability); AC3 `created_at` literal "fragility" (sentinel `2020-01-01` is sound); AC3 no pre-UPDATE control (the `NewName` assertion already guards a vacuous no-op); concurrency truthy-vs-null race (examined, benign — neither path clobbers a good value); `fetchSteamProfile` trusts `players[0]` without an echoed-`steamid` check (identity is safe — canonical key comes from verified OpenID, single-`steamids` request, cosmetic-only); `route.ts:13` "(AC6)" comment tag (pre-existing drift, outside the changed lines).
