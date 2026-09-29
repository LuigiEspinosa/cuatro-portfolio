---
baseline_commit: 64990db57b868cf3da382d4864b39b488530eed4
---

# Story 6.1: Award catalog and buckets

Status: done

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **first story of the epic**
Traces: **FR-24** · **AD-22** (+ AD-17, AD-18, AD-24, UX-DR20/25, UX-DR6/8)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to curate the award catalog before the ceremony,
so that each award has a bucket, class, deciding stat, and floor, and stays hidden until its spin.

## Acceptance Criteria

**AC1 — the catalog exists, and every award is fully specified.**
**Given** the catalog rule (FR-24, SOLUTION-DESIGN.md:158-173),
**When** the admin curates awards before the ceremony,
**Then** each `award` row carries a **bucket** (`skill` / `clutch` / `weird` / `comedy` → Habilidad / Clutch / Rarezas del demo / Comedia), a **class** (`rate` / `volume` → Tasa / Volumen), a **deciding stat**, and an **eligibility floor** (`floor_rounds` / `floor_kills`) — each constrained to a closed set at the DB layer, so an award that names a stat the system cannot resolve is **unrepresentable**, not merely unlikely.

**AC2 — curation is admin-only, audited, and idempotent.**
**Given** AD-8 + AD-17,
**When** the catalog is written,
**Then** it goes through one server-gated admin command route that re-verifies `is_admin()`, writes exactly one append-only `audit_log` row per accepted call (actor = the verified session, never the body), refuses every malformed payload with a **typed refusal that has written nothing**, and is **idempotent** — re-sending the same catalog produces the same 12 rows and no duplicate.

**AC3 — the catalog is measured before it is seeded (no empty awards).**
**Given** the project doctrine *measure zeros, never narrate them* (Epic-5 retro; born of 5.2a's dead `AttackerBlind` and the Don Clutch retirement),
**When** the 12-award seed catalog is chosen,
**Then** **every** seeded award's deciding stat is demonstrated **populated on real demo data** before it is seeded, and the measurement (per stat: total, non-zero player count) is recorded in Completion Notes. A stat that measures empty **does not get an award**, regardless of how good the award name is.

**AC4 — a non-admin cannot obtain award identities at all.**
**Given** the blurred-until-spin rule (AD-22, FR-24, UX-DR20/25),
**When** a non-admin views the catalog surface,
**Then** each unrevealed award renders as `Premio X de 12 — bloqueado hasta que gire` behind a blur with **no gold**, **and** the award's name / bucket / class / deciding stat / floors / id **never reach the client at all** — the secrecy is the absence of a viewer read grant, not the CSS blur (AD-22 exists precisely to prevent "CSS blur being the only secrecy"). The only catalog fact a viewer may learn is the **count**.

## Tasks / Subtasks

> Order matters: **Task 0 (measure) gates Task 5 (seed)**. Do not write the catalog constant before you have the numbers.

- [x] **Task 0 — MEASURE the candidate deciding stats over the real demos (AC: 3)** ⛔ *blocking gate*
  - [x] Write a throwaway Go probe under `worker/cmd/qa61/` (the `qa51`/`qa52`/`qa53` precedent — **throwaway, deleted after sign-off, not in the File List**) that drives the real `ingest.DemoinfocsParser` over all 14 `.dem.gz` in [demos/](demos/) (streamed via gunzip — see `worker/ingest/decompress.go`).
  - [x] Print a table, per candidate stat key: **Σ total**, **# players with a non-zero value**, **# demos with any non-zero value**. Cover every key in the vocabulary table below — including the ones expected to be zero.
  - [x] **Do not conclude from the format.** Print the numbers. A zero explained by "these are 1v1 duels" is exactly the reasoning that shipped a dead column in 5.2 and cost the 5.2a amendment.
  - [x] Cross-check against the already-measured baseline (Dev Notes → *Measured stat inventory*). A number that disagrees with the recorded 5.1/5.2/5.2a/5.3 measurements is a **finding** — stop and report it, do not average it away.
  - [x] Record the full table verbatim in Completion Notes. This table is AC3's evidence.

- [x] **Task 1 — Migration `0023_award_catalog.sql`: the `award` table (AC: 1)**
  - [x] Create `award` **exactly** per [SOLUTION-DESIGN.md:158-173](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L158-L173) — same column names, same types, same defaults, same two UNIQUEs. Do not rename, do not add columns beyond the constraints below.
  - [x] `bucket check (bucket in ('skill','clutch','weird','comedy'))` · `class check (class in ('rate','volume'))` · `direction default 'max' check (direction in ('max','min'))`.
  - [x] **Closed-set `deciding_stat`** — `check (deciding_stat in (…))` over the full vocabulary (Dev Notes → *The deciding-stat vocabulary*). Same closed set (nullable) for `secondary_stat`, `eff_num_key`, `eff_den_key`. Spine convention: *"Closed-set text columns are CHECK-constrained enums"* (SPINE:234).
  - [x] **Class↔key coherence CHECK** — a `rate` award's `deciding_stat` must be one of the four rate keys; a `volume` award's must be a volume key. This is what makes `class` honest rather than decorative, and it is what 6.4's Stage-2 branch (cross-multiply vs integer compare) will read.
  - [x] **Non-blank name**, using `~ '[^[:space:]]'` — **NOT `btrim(name) <> ''`**. `btrim` trims spaces only, so a TAB passes it; that exact bug shipped in 4.2 and was caught at review ([0012_format_lock.sql](supabase/migrations/0012_format_lock.sql)). Also `check (priority > 0)` and non-negative floors.
  - [x] ⭐ **`unique (tournament_id, priority)` must be `DEFERRABLE INITIALLY DEFERRED`.** A re-curation that **swaps** two awards' priorities is an ordinary edit and it is the first thing anyone will do; against an immediate unique index the intermediate state violates and the whole call 500s. Deferring makes the *end state* the thing checked. Pin both directions in pgTAP (a swap succeeds in one statement; a genuine duplicate still fails **at COMMIT**).
  - [x] Index `award (tournament_id, priority)` (SOLUTION-DESIGN.md:260).

- [x] **Task 2 — Migration `0023`: RLS + grants = the AD-22 teeth (AC: 4)**
  - [x] `ENABLE` + **`FORCE`** row level security (the generic catalog guard in `0003_audit_snapshot_test.sql` Section A2 asserts *no* public base table lacks `FORCE` — a missing `FORCE` reddens an existing suite, by design).
  - [x] `create policy award_admin_read on award for select to authenticated using ((select public.is_admin()));` — mirror the `audit_admin_read` form at [0003_audit_snapshot.sql:68](supabase/migrations/0003_audit_snapshot.sql#L68) exactly (the `(select …)` wrapper is the initplan-caching form used project-wide).
  - [x] **NO `anon` / `authenticated` grant of any kind on `award`.** This is the AC4 mechanism: a viewer 42501s at the table-grant gate before RLS is even consulted — the same posture as `audit_log` / `app_role` / `stat_snapshot*` ([0003:83-84](supabase/migrations/0003_audit_snapshot.sql#L83)).
  - [x] `grant select, insert, update, delete on award to service_role;` (identity PK ⇒ no separate sequence grant — 0003:77).
  - [x] ⚠ Write the header note that 6.8 **widens** this later: when `spin` exists, 6.8 adds the reveal-gated viewer policy keyed on `spin.revealed_at`. 6.1 ships the strictly-closed end state, so 6.8 is an opening, never a tightening.

- [x] **Task 3 — Migration `0023`: `award_catalog_count()` — the one fact a viewer may learn (AC: 4)**
  - [x] `create function public.award_catalog_count(p_tournament_id bigint) returns int language sql stable security definer` returning `count(*)` for that tournament — **and nothing else**. Mirror the `security definer` preamble (incl. `search_path`) of the existing RPCs in [0017_aprobar_publish.sql](supabase/migrations/0017_aprobar_publish.sql) / [0019_manual_score.sql](supabase/migrations/0019_manual_score.sql) byte-for-byte; do not invent a new preamble.
  - [x] `grant execute` to `anon, authenticated, service_role`. It is `security definer` **because** the caller has no grant on `award` — that is the point, and the function's body must therefore never select a non-count column. Say so in the comment.
  - [x] pgTAP: as `anon`, `select * from award` → **42501**, while `award_catalog_count(t)` → `12`. That pair *is* AC4 at the DB layer.

- [x] **Task 4 — Migration `0023`: `curate_award_catalog` RPC (AC: 1, 2)**
  - [x] Signature: `curate_award_catalog(p_tournament_id bigint, p_actor text, p_awards jsonb) returns jsonb`. Declarative **replace-the-whole-catalog** semantics (upsert on `(tournament_id, name)` + delete-missing) — the same shape as re-parse (SPINE:232), which is what makes AC2's idempotency true by construction.
  - [x] **Every guard runs BEFORE any write or any row lock** (the 4.2 lesson: a doomed call must not lock rows and only then refuse). Typed refusals are **RETURNED** as `{ok:false, reason}`, never raised — the 0016/0017/0020 convention. Reasons: `no_tournament` · `catalog_frozen` · `empty_catalog` · `too_many_awards` (cap 64) · `duplicate_name` · `duplicate_priority` · `invalid_award` (bad bucket/class/key/floor/blank name/class↔key mismatch).
  - [x] `catalog_frozen` ⇐ `tournament.state in ('ceremony','closed')`. ⚠ This is the **honest partial** of AD-15: the real ceremony-lock guard needs the `ceremony` table, which does not exist until 6.2. Do **not** invent a `ceremony_locked` column here; state in the header that 6.2 replaces this state test with the real lock (retro Action Item #2).
  - [x] Exactly one `audit_log` row per accepted call: `action = 'curate_awards'`. ⚠ `audit_log.action` is **uncapped `text` with no CHECK** ([0003:25](supabase/migrations/0003_audit_snapshot.sql#L25)) — the 0015/0016/0020 precedent means **no migration widening is needed**. `detail` carries before/after (`{before:{count,awards:[…]}, after:{count,awards:[…]}}`, AD-17). **Assert every key of the `detail` payload in pgTAP** — 4.2's review found a suite that asserted one key while a typo in any other would have NULLed the whole payload with the tests green.
  - [x] `grant execute` to `service_role` only.

- [x] **Task 5 — `lib/awards/catalog.ts`: the 12-award seed catalog, one definition site (AC: 1, 3)**
  - [x] A typed, frozen constant of 12 entries — the single source of truth for the seed payload (the route posts it; nothing re-derives it). Start from the proposed 12 in Dev Notes → *The proposed catalog*, **amended by Task 0's measurements** and by Cuatro's naming sign-off (Questions, below).
  - [x] Copy convention (closes a standing item, [deferred-work.md:255](_bmad-output/implementation-artifacts/deferred-work.md#L255)): **Bajas = kills, Muertes = deaths**, per the 5.7 review patch. The mock's "habilidad · volumen · muertes" for a *kills* award is the ambiguity this story is the home for — do not copy it forward.
  - [x] Vitest (`lib/awards/catalog.test.ts`), asserting on the constant itself: exactly 12 entries · priorities are exactly `1..12` · names unique and non-blank · every `deciding_stat`/~~`secondary_stat`/`eff_*_key`~~ in the vocabulary · class↔key coherence · rate awards carry `floor_kills = 20`, volume awards `0` · `floor_rounds = 24` everywhere · **no entry names a stat in the MEASURED-EMPTY list** (assert against an explicit exported `MEASURED_EMPTY` set, so a future "let's add a clutch award" reddens a test instead of shipping an unwinnable award).
    - ⚠ **Amended at the code review:** the `secondary_stat` / `eff_*_key` half of this bullet is **not implemented and cannot be** — `SeedAward` declares no such fields, because `toCuratePayload` deliberately omits the FR-29 tiebreak rungs (they are Story 6.5's, and seeding a rung the ladder does not yet read would invent a contract for a story that has not made its decisions). The reasoning was in a code comment while this box claimed an assertion that does not exist. The vocabulary IS now pinned — across the TS/SQL boundary and over **all four** CHECK constraints, not just `deciding_stat` (see Review Findings).

- [x] **Task 6 — `lib/awards/curate.ts` + `app/api/admin/awards/route.ts` (AC: 2)**
  - [x] The lib command returns the standard discriminated `{ok:true,…} | {ok:false, reason}`; the route goes through **`handleAdminCommand`** ([lib/admin/command-route.ts](lib/admin/command-route.ts)). This is **mandatory** — `lib/admin/route-coverage.test.ts` reddens CI for any `app/api/admin/**/route.ts` that does not (only `match/grace` is exempted).
  - [x] `parseBody` validates the payload shape and uses the shared **`isPositiveInt`** for `tournament_id` (range-capped — `Number.isInteger(1e21)` is `true`; the bare check is the gap 4.2's review found).
  - [x] `statusFor`: `no_tournament` 404 · `catalog_frozen` 409 · everything else 400. Keep the `Record<Extract<…,{ok:false}>['reason'], number>` call-site typing so a new refusal without a status is a **compile** error.
  - [x] Vitest for the lib against a faked client (the `lib/match/*.test.ts` pattern): payload passed through argument-by-argument, each refusal surfaced verbatim, no write on refusal.

- [x] **Task 7 — Viewer: the locked "Posiciones de premios" block (AC: 4)**
  - [x] `lib/awards/read.ts` → `fetchAwardCatalogCount(client, tournamentId)` — **anon** `createSupabaseServerClient()` only (never `getAdminClient`), one `.rpc('award_catalog_count')`, returns `{ok:true,count}` / `{ok:false,reason:'read_failed'}` (the `fetchLeaderboard` shape). Resolve the tournament through the existing cached [app/(viewer)/current-tournament.ts](<app/(viewer)/current-tournament.ts>) — do not add a second resolver.
  - [x] A server component rendering `count` locked rows above the boards on [/leaderboards](<app/(viewer)/leaderboards/page.tsx>) (mock order: locked awards → eligibility → boards, `mock-leaderboards.html:476-515`). Render it **regardless** of whether the boards are empty — it is independent of stats. If `count === 0` **or** the read fails, render **nothing** (never `Premio 1 de 0`).
  - [x] ⛔ **The component receives a number. Nothing else.** No award row, no name, no id, no bucket, no `select` against `award` anywhere in `app/` or `lib/` outside the admin path. AC4 is a data-flow property first and a CSS property second.
  - [x] Accessible name of each locked card is **exactly** `Premio {i} de {n} — bloqueado hasta que gire` (em dash, AC4 verbatim); the visual may split it across the two spans the mock uses. Numerals use the `.num` tabular class (UX-DR8/34 — "Premio 7 de 12" is called out by name at DESIGN.md:236).
  - [x] **No gold** anywhere in this block: blur `7px` + lock glyph, bucket/label ink in `--ink-muted` ([DESIGN.md:155-159, 274](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L155-L159)). Gold is reserved for reveals/winners/champion (UX-DR6) — a locked card carrying gold is a defect, and the cover line reuses the already-fixed `es.ceremony.seededByDemo`.
  - [x] All copy through `lib/i18n/es.ts` (AD-24 — viewer components carry **no** inline literals). Add an `awards:` block; reuse `es.ceremony.seededByDemo` rather than re-typing the fixed string.

- [x] **Task 8 — pgTAP `supabase/tests/0023_award_catalog_test.sql` (AC: 1, 2, 4)**
  - [x] Explicit `plan(N)` with the count accounted for in Completion Notes (standing project rule).
  - [x] Sections: (A) table shape + every CHECK bites, one `throws_ok` per constraint — ⚠ **all ten-ish CHECKs raise `23514`, so a `throws_ok` on the code alone proves almost nothing**; assert the constraint **name** or use a distinguishing probe (the trap 4.3's review found across three suites). (B) `FORCE` + no anon/authenticated grant + admin policy. (C) `award_catalog_count` as `anon` returns the count while `select * from award` 42501s. (D) `curate_award_catalog` happy path (12 rows), idempotent re-run (still 12, no duplicates), the **priority swap** (deferrable UNIQUE), delete-missing, and one test per typed refusal proving **nothing was written**. (E) the audit row: exists, one per call, correct actor, and **every** `detail` key asserted. (F) `catalog_frozen` on `state='ceremony'`.
  - [x] **Mutation-test the suite before review** (standing rule, and Epic-5 retro Action Item #3 makes a reviewer-independent pass a gate): for each CHECK, each guard, and the audit INSERT — delete it, confirm a **named** test reddens, restore. A guard whose deletion leaves the suite green is not covered. Record the mutation table in Completion Notes.

- [x] **Task 9 — THE BAR: live-QA over the real seam (AC: 2, 3, 4)**
  - [x] Apply the migration to the local stack (`supabase db reset`). ⚠ **Env trap, will recur on this box:** WinNAT swallows DB port 54322 → fix with an elevated `net stop winnat; net start winnat`; Kong can remap to host `55321` while `supabase status` still prints `54321`. Never change a repo file to work around either.
  - [x] Drive `POST /api/admin/awards` over HTTP as a **real signed-in admin**: seed the 12 → **200**; re-post identical → **200**, still 12 rows, no duplicate; post a swapped-priority pair → **200** (this is the deferrable-UNIQUE proof over the real seam); post a duplicate priority → **400** `duplicate_priority` **and the catalog is unchanged**; post as a non-admin / signed-out → **403**; flip `tournament.state='ceremony'` → **409** `catalog_frozen`.
  - [x] As **anon over PostgREST**: `select * from award` → 42501, and `rpc/award_catalog_count` → `12`. Paste both responses.
  - [x] Browser `/leaderboards`: 12 locked cards, correct counter text, no gold. Then **`curl` the served HTML and grep it for each of the 12 award names, each bucket value, and each deciding-stat key → 0 hits.** Paste the grep output. That grep is AC4's real proof; the screenshot is not.
  - [x] Confirm `audit_log` holds exactly the expected `curate_awards` rows with the acting admin's SteamID64.

- [x] **Task 10 — Gates + regression net**
  - [x] `npm run lint` (0) · `npm test` (baseline **461**, record the new total) · `npm run build` (viewer routes stay `ƒ` dynamic, none prerendered) · full pgTAP run (baseline **924+ across 23 files**, record the new total and confirm **all 23 prior suites still green**).
  - [x] `go build ./... && go vet ./...` clean if `worker/cmd/qa61` exists at any point; **delete the probe** before the final commit and confirm it is absent from the File List.
  - [x] Confirm untouched: `public.leaderboard` (0021), `approve_match` / `rollback_match` / `manual_resolve_match`, every worker package, `/ceremonia`.

### Review Findings

Code review 2026-08-03 (bmad-code-review, baseline `64990db`, three layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor). 2 decision-needed · 11 patch · 6 deferred · 2 dismissed as noise.

⚠ **Scope calibration that applies to the whole list:** `app/api/admin/awards/route.ts` posts the server-side constant and does **not** accept a catalog from the body, so the malformed-payload defects below are **not reachable over HTTP**. They are defects in `curate_award_catalog`'s published RPC contract — which 6.2+ will call, and whose own header claims every malformed payload gets a typed refusal.

- [x] [Review][Decision] **RESOLVED — the three replacement awards ARE clone-free, measured not argued.** The reviewer rebuilt an independent throwaway probe (`worker/cmd/qa61rank`, deleted after the run; `go build`/`go vet` clean before and after) that aggregates per SteamID64 **across all 14 demos** — the fold `public.leaderboard` (0021) performs — and ranks all twelve seeded awards against each other using **exact integer cross-multiplication** for rate keys (never a float, AD-14/AD-19). Result over all **66 pairs: ZERO rank identically.** `hs_kills` == `kills` on only 2/28 players and ranks distinctly (7 distinct values, its own winner set); `utility_damage` == `adr_damage` on 0/28; `adr` max/min are inverses by construction. Two pairs (#2/#7 and #5/#9) coincidentally share *this corpus's* winner while ranking differently — chance, not structure. ⭐ **Methodology check:** the same probe independently reproduced every clone Task 0 condemned — `entry_frags`/`rounds_won`/`kast_rounds` == `kills` on **28/28**, `opening_deaths` == `deaths` on **28/28** — so it demonstrably finds clones when they exist. Cuatro's replacement call is confirmed correct and AC3's narrated gap is now measured. Dismissed as a defect.
- [x] [Review][Defer] **`El Inofensivo` (least ADR) carries `floor_kills = 20`, excluding the least-harmful players by construction** [lib/awards/catalog.ts] — the floor is applied by `class` (rate ⇒ 20) with no regard for `direction`, and #12 is the catalog's only `min` award. For a `max` rate award a kill floor is anti-farm; for a `min` award it is anti-*qualification*. The code conforms to Task 5 as written, so this is a product call, not a spec violation. **Reason deferred (Cuatro, 2026-08-03):** `direction='min'` ladder/tie handling is already recorded as 6.4/6.5's first-class problem — the floor interaction belongs in that same specified case, not in a seed-constant patch here.
- [x] [Review][Defer] ⛔ **NEW — the declared floors exclude the ENTIRE measured roster: 0/28 players clear either one** [supabase/migrations/0021_leaderboard.sql:50-52, lib/awards/catalog.ts] — measured by the reviewer's probe: `rounds_played` per player is **min 10 / max 21** against `floor_rounds = 24`, and **0/28** players reach `floor_kills = 20`. Applied to the corpus as it stands, all twelve awards have **zero eligible players** — a catalog where every category has no possible winner, which is exactly the failure AC3 exists to prevent, reached from a direction the story never checked: not an empty stat, but an unclearable floor. ⚠ Format-specific compounding: in 1v1 wingman `kills ≈ rounds_won ≈ ½ rounds_played` (the same structural identity Task 0 measured), so `floor_kills = 20` means ~40 rounds played — about three matches — before a player qualifies for **any rate award**. In 5v5 one match clears it. Not a 6.1 defect: the floors are 0021's and 6.1 correctly treats them as a value-parity duplicate it must not touch. **Reason deferred (Cuatro, 2026-08-03):** the corpus is a 28-player first round with one match each; bracket winners accumulate rounds and are expected to clear the floors. 6.4/6.5 must verify the floors against the real bracket shape before the ceremony rather than assume it.
- [x] [Review][Defer] **The all-zero-tie hazard, now quantified** [lib/awards/catalog.ts `THIN_BUT_REAL`] — the story recorded this qualitatively; the reviewer's probe measured it tournament-wide: players above zero are `knife_kills` **1/28**, `through_smoke_kills` **2/28**, `blind_kills` **3/28**, `wallbang_kills` **7/28**. If the single knife-kill holder fails the floors, that award is a **27-way tie at zero** walking the FR-29 ladder to a shared trophy for the whole roster. **Reason deferred (Cuatro, 2026-08-03):** already the story's own recorded 6.4/6.5 consequence ("is a zero deciding value awardable at all?"); these numbers are the evidence 6.4/6.5 should meet it with.
- [x] [Review][Patch] An award object that OMITS `name` or `priority` falls through EVERY guard and raises 23502 instead of returning a typed refusal [supabase/migrations/0023_award_catalog.sql:339,378]
- [x] [Review][Patch] An integral JSON float (`"priority": 1.0`) passes the numeric guard and then raises 22P02 at the `::int` cast [supabase/migrations/0023_award_catalog.sql:381-382,453-455]
- [x] [Review][Patch] `lib/awards/catalog.ts` — the file holding all 12 award identities — lacks `import 'server-only'` that both its siblings carry [lib/awards/catalog.ts:1]
- [x] [Review][Patch] `award_stat_vocabulary()` ships with the default PUBLIC EXECUTE grant; both sibling functions get an explicit revoke/grant pair [supabase/migrations/0023_award_catalog.sql:227]
- [x] [Review][Patch] `categoriasSelladas(1)` renders `1 categorías selladas.` — no singular form exists and a 1-award catalog is a legal curation [lib/i18n/es.ts:233]
- [x] [Review][Patch] TypeScript `STAT_VOCABULARY` is an unpinned third restatement of the closed set; nothing compares it to the SQL CHECK [lib/awards/catalog.ts:60]
- [x] [Review][Patch] `THIN_BUT_REAL` is exported and documented as the 6.4/6.5 hand-off anchor, but no test imports it — emptying it reddens nothing [lib/awards/catalog.ts:132]
- [x] [Review][Patch] The entire `.lockcover` is `aria-hidden`, so AT users never receive the cover title, the sealed count, or the provenance line [app/(viewer)/leaderboards/LockedAwards.tsx:68]
- [x] [Review][Patch] `Object.isFrozen(AWARD_CATALOG)` is shallow — every award object stays mutable, so the test's stated property ("no runtime mutator") is false [lib/awards/catalog.ts, lib/awards/catalog.test.ts]
- [x] [Review][Patch] The count read has no upper bound, so a catalog written outside the RPC renders unbounded `<li>` nodes on the public viewer page [lib/awards/read.ts:37, app/(viewer)/leaderboards/LockedAwards.tsx:29]
- [x] [Review][Patch] Story doc overclaims in three places: the `plan(104)` accounting (A1 is 18 not 19, vocabulary parity is 5 not 4 — the errors cancel), a Task-5 `secondary_stat`/`eff_*_key` assertion that cannot exist because `SeedAward` has no such fields, and the undocumented widening of the Dev Notes vocabulary from 16 to 17 volume keys by `hs_kills` [story:427, story:84, story:158]
- [x] [Review][Defer] `award_tournament_priority_idx` duplicates the index the UNIQUE constraint already builds [supabase/migrations/0023_award_catalog.sql] — deferred, spec-mandated by Task 1 / SOLUTION-DESIGN.md:260
- [x] [Review][Defer] `catalog_frozen` is a denylist read with no lock — a future `tournament.state` is permitted by default, and a concurrent transition to `ceremony` can slip past [supabase/migrations/0023_award_catalog.sql:415] — deferred, 6.2 replaces this with the real ceremony lock
- [x] [Review][Defer] Two concurrent curations of an EMPTY catalog serialize on nothing (`for update` locks zero rows) and can collide at COMMIT on the deferred UNIQUE → opaque 500 [supabase/migrations/0023_award_catalog.sql:415] — deferred, single-admin tournament
- [x] [Review][Defer] `~ '[^[:space:]]'` accepts zero-width and format characters (U+200B/U+FEFF), so a blank-looking award name is storable [supabase/migrations/0023_award_catalog.sql:138,339] — deferred, one codepoint class beyond the 4.2 bug this guard was written for
- [x] [Review][Defer] `name` has no length bound, and names differing only by case or trailing whitespace both pass the dup check and the UNIQUE [supabase/migrations/0023_award_catalog.sql:142,402] — deferred, admin posts a server-side constant
- [x] [Review][Defer] pgTAP Section D's bucket/direction/floor assertions name catalog properties but test their own hand-written fixture [supabase/tests/0023_award_catalog_test.sql] — deferred, the shipped catalog's four-bucket property IS asserted in catalog.test.ts

#### Review patches applied — 2026-08-03

All 11 patch findings fixed and **mutation-tested by the reviewer**: every fix was reverted in place and confirmed to redden a **named** test, then restored. 9 mutations, **0 survivors**.

| Mutation (the fix, reverted) | Verdict |
|---|---|
| revert `coalesce` on the `name` type guard | RED #91 |
| revert `coalesce` on the `priority` type guard | RED #92 |
| revert `trunc(…::numeric)::int` on the writes | RED #109, #110, #111 |
| `grant execute on award_stat_vocabulary to anon` | RED #50 |
| drop `hs_kills` from `award_secondary_stat_valid` only | RED — *the constraint pgTAP never pinned; the new cross-boundary test catches it* |
| shallow freeze (drop the per-element `Object.freeze`) | RED ×3 (incl. the MEASURED_EMPTY guard) |
| revert the singular/plural branch | RED |
| drop the count cap | RED ×3 |
| empty `THIN_BUT_REAL` | RED |
| **drop `import 'server-only'` from catalog.ts** | **SURVIVED on the first pass** — `server-only` throws only when a *client* component imports it, so the bundler is the enforcement and no runtime test can exercise it. Recorded rather than hidden, then pinned with a source-level assertion; re-mutated → RED. |

⭐ Two fixes were verified against the **running database**, not merely via a green test: an award omitting `name` now returns `{"ok":false,"detail":"name","reason":"invalid_award"}` and one omitting `priority` returns `…"detail":"priority"…` — both previously fell through every guard to a 23502.

**Gates after the patches:** lint **0** · Vitest **537** (was 512; +25 — the cross-TS/SQL vocabulary pin, `THIN_BUT_REAL`, the deep-freeze pair, the server-only pin, the count cap, and a new `lib/i18n/es.test.ts`) · build **0**, every viewer route still `ƒ` · pgTAP **1039 across 24 files**, `plan(111)`, all 23 prior suites green · `go build ./... && go vet ./...` clean, `worker/` untouched.

**Files changed by the review:** `supabase/migrations/0023_award_catalog.sql` · `supabase/tests/0023_award_catalog_test.sql` · `lib/awards/catalog.ts` · `lib/awards/catalog.test.ts` · `lib/awards/read.ts` · `lib/awards/read.test.ts` · `lib/i18n/es.ts` · `app/(viewer)/leaderboards/LockedAwards.tsx` · **NEW** `lib/i18n/es.test.ts`

## Dev Notes

### The one central decision: **the catalog is measured before it is seeded**

Epic 5's defining lesson — *measure zeros, never narrate them* — was learned twice, expensively, and this story is where it either holds or does not. An award is a **promise that a stat can be won**. Seeding an award over a stat that is structurally empty in the current format produces a category with **no possible winner and no error anywhere to reveal it** (5.2a's exact words), and the failure only surfaces on stage, at the ceremony, in front of everyone.

Two precedents, both already paid for:

- **5.2a** — `blind_kills` shipped off `events.Kill.AttackerBlind`, measured 0, and the zero was accepted as "proven by mode" (*1v1 duels have no teammates to flash you*). The premise was **false** — in a 1v1 the enemy flashes you and you kill them anyway. A probe found **4 genuinely-blind kills** (strongest: an M4A4 kill with 2.13 s of flash remaining) all reporting `AttackerBlind = false`. One column, one amendment story, one near-miss on a comedy award with no winner.
- **Don Clutch (5.3)** — ⛔ **binding decision, Cuatro, 2026-07-21: retired from the seed catalog and must not be re-added while the format is 1v1.** FR-20's clutch rule is a **transition** (a player must go from a team with ≥2 alive to sole survivor); in 1v1 wingman the victim's team goes 1 → 0, never → 1. Proven **structurally**: `T:1 CT:1` on **221/221** rounds of all 14 demos ⇒ `clutches` is `{}` for every player of every match. **What was retired is the award, not the bucket** — `clutch` stays in the CHECK (SOLUTION-DESIGN:162 / SPINE:389) and in FR-24, and the parser derivation is correct and would fill itself in a 5v5.

⚠ **The open consequence this story must close:** with Don Clutch gone the `clutch` bucket has **no award**, so the catalog demonstrates 3 of 4 buckets. sprint-status.yaml's note on this story says the fix is *"a premio whose deciding stat does fill in the current format (natural candidate: entry frags / opening duels — 204 duels measured over 204 rounds). **Decidir al sembrar el catálogo**"* — i.e. **here**. See *The proposed catalog* and the Questions at the end.

### Measured stat inventory (14 real 1v1-wingman demos, `demos/*.dem.gz`)

This is the recorded state of the evidence *before* Task 0. Task 0 re-measures and either confirms it or reports a discrepancy as a finding.

| Stat | Column | Measured | Verdict for the catalog |
|---|---|---|---|
| kills / deaths / rounds_played | `kills`,`deaths`,`rounds_played` | populated; `Σkills == Σdeaths` on 14/14 | ✅ safe |
| ADR | `adr_damage` / `rounds_played` | ADR 32.9–94.5 across players | ✅ safe |
| HS% | `hs_kills` / `kills` | populated, `hs_kills ≤ kills` | ✅ safe |
| utility damage | `utility_damage` | verified live (`HE 30 + Incendiary 3 = 33`) | ✅ safe |
| rounds won | `rounds_won` | populated (4.6a) | ✅ safe |
| entry frags / opening deaths | `entry_frags`,`opening_deaths` | **Σ204 each over 204 counted rounds**, 221 freeze-ends | ✅ safe — the healthiest signal in the set |
| wallbang | `wallbang_kills` | **8** | ⚠ thin but real |
| blind | `blind_kills` | **4** (after 5.2a; was 0 on the dead field) | ⚠ thin but real |
| through-smoke | `through_smoke_kills` | **2** | ⚠ very thin |
| knife | `knife_kills` | **1** (15 raw − 14 in the discarded pre-match round) | ⚠ very thin |
| KAST | `kast_rounds` | populated but **`KAST == kills`** in 1v1 (killer survives → K, victim can't be traded) | ⚠ degenerate — a KAST award is a near-clone of a kills-rate award |
| no-scope | `no_scope_kills` | **0** — but only **16 scoped-weapon kills of 218**; an ordinary 0-of-16 sample, *not* a dead field | ⛔ **MEASURED_EMPTY** — do not seed |
| assists / flash assists | `assists`,`flash_assists` | **0** — no teammates in 1v1 | ⛔ **MEASURED_EMPTY** |
| MVPs | `mvps` | **0** — a raw diagnostic counted `RoundMVPAnnouncement total = 0`; the mode emits none | ⛔ **MEASURED_EMPTY** |
| 1vX clutches | `clutches` | **`{}` for everyone**, proven structurally (`T:1 CT:1` ×221) | ⛔ **MEASURED_EMPTY** — Don Clutch, retired |

⚠ **Downstream hazard to record, not to fix here:** with knife = 1 and smoke = 2 tournament-wide, it is entirely likely that **every eligible player sits at 0** for those awards. Stage 2 picks the *best* value, so an all-zero field is a **whole-roster tie** that walks the FR-29 ladder to a shared trophy for everyone. That is a **6.4 / 6.5** question (is a zero deciding value awardable at all?). 6.1's job is to (a) keep those awards' floors honest and (b) **write this consequence down** so 6.4/6.5 meet it as a specified case instead of discovering it live.

### The deciding-stat vocabulary (the CHECK's closed set)

Every key resolves to a real `stat_row` column or a real `public.leaderboard` expression (0021). 6.2's snapshot carries these in AD-19 integer form (`{num, den}` for rates), and 6.4's Stage 2 reads them. A typo must be a constraint violation, not a silent unwinnable award.

**Volume keys** (integer totals): `kills` · `deaths` · `assists` · `mvps` · `flash_assists` · `utility_damage` · `knife_kills` · `wallbang_kills` · `through_smoke_kills` · `no_scope_kills` · `blind_kills` · `entry_frags` · `opening_deaths` · `rounds_won` · `rounds_played` · `matches_played` · **`hs_kills`** ⬅ *added during implementation (17 volume keys, 21 total), implied by the approved `Cabeza de Martillo` replacement but never recorded here — noted at the code review so the shipped CHECK reconciles against this table.*

**Rate keys** (`{num, den}` integer pairs — never a float, AD-14/AD-19): `adr` (`adr_damage`/`rounds_played`) · `hs_pct` (`hs_kills`/`kills`) · `kast_pct` (`kast_rounds`/`rounds_played`) · `entry_success` (`entry_frags`/(`entry_frags`+`opening_deaths`))

The vocabulary is deliberately a **superset** of what gets seeded — it includes the measured-empty keys, because the format could change and the schema should not need a migration when it does. The **seed catalog** is where the measurement bites (Task 5's `MEASURED_EMPTY` assertion), not the CHECK.

### The proposed catalog (starting point — amend with Task 0's numbers, then get Cuatro's sign-off)

`floor_rounds = 24` for all; `floor_kills = 20` for rate awards, `0` for volume (SOLUTION-DESIGN:168-169).

| # | Bucket | Class | Name (proposed) | Deciding stat | Note |
|---|---|---|---|---|---|
| 1 | skill | volume | Máquina de Frags | `kills` | the mock's name (mock-leaderboards.html:486) |
| 2 | skill | rate | Rey del Daño | `adr` | |
| 3 | skill | rate | Puntería Quirúrgica | `hs_pct` | |
| 4 | skill | volume | Fábrica de Rondas | `rounds_won` | |
| 5 | **clutch** | volume | Primera Sangre | `entry_frags` | ⭐ the Don Clutch replacement |
| 6 | **clutch** | rate | Rey del Duelo | `entry_success` | ⭐ 204 duels measured |
| 7 | weird | volume | A Cuchillo | `knife_kills` | mock name; thin data |
| 8 | weird | volume | Atraviesa-muros | `wallbang_kills` | label matches `es.player.weird.wallbang` |
| 9 | weird | volume | Fantasma del Humo | `through_smoke_kills` | thin data |
| 10 | weird | volume | Justicia Ciega | `blind_kills` | the award 5.2a exists to keep alive |
| 11 | comedy | volume | El Más Generoso | `deaths` | mock name (`:500`); **Muertes**, not Bajas |
| 12 | comedy | volume | El Primero en Caer | `opening_deaths` | |

Deliberately **absent**: anything over `no_scope_kills`, `assists`, `flash_assists`, `mvps`, `clutches` (measured empty), and `kast_pct` (degenerate in 1v1 — it would rank identically to a kills-rate award).

### Scope boundaries — do NOT build these here

Each has an owning story. Building it early is the failure mode this list exists to prevent.

- ⛔ **No `ceremony`, `spin`, `stat_snapshot`, `stat_snapshot_row`, `award_result`, `award_result_winner`, `verification_bundle` tables** — 6.2 / 6.4 / 6.8 / 6.9. `award` is the *only* new table.
- ⛔ **No reveal-gating on `spin.revealed_at`** (6.8). It is not deferred out of laziness — `spin` **does not exist**. 6.1 ships the strictly-closed posture (no viewer grant at all), which is *stronger*; 6.8 opens it per-spin.
- ⛔ **No `seed_hex` / `bundle_hash` / commitment publication** (6.8), no PRNG / weights / `spin_plan` / `luck_weight_table` (6.3/6.4/6.6), no draw, no ladder, no pity.
- ⛔ **No ceremony UI, wheel, flip, or reveal animation** (6.10). `/ceremonia` stays the 5.7 `Placeholder` — do not touch it.
- ⛔ **No admin console UI.** None exists in this repo (Epic 4 shipped routes, not pages) and no Epic-6 story adds one. 6.1 ships route + lib + the seed constant; curation is driven over HTTP.
- ⛔ **No `ceremony_locked` guard on `approve_match` / `rollback_match` / `manual_resolve_match`** — that is **6.2**, first-class (Epic-5 retro Action Item #2, carried from Epic-4 #3, seam already flagged at [0020_command_routes.sql:46-48](supabase/migrations/0020_command_routes.sql#L46-L48)).
- ⛔ **No change to `public.leaderboard`, and the view must not read `award.floor_*`.** [0021_leaderboard.sql:50-52](supabase/migrations/0021_leaderboard.sql#L50-L52) declares the 24/20 literals a **value-parity duplication seam** with `award.floor_rounds`/`floor_kills`. Keep the values in lockstep; do **not** "fix" the duplication by pointing the view at the catalog — AD-20 gives the floors one definition site and 0021 is it.
- ⛔ **No worker / Go change** (beyond the throwaway `qa61` probe, deleted before commit). No `award_reveal` feed writer — see below.
- ⛔ **No CSRF** (Epic 7, uniform across all cookie-authenticated admin POSTs).

### Inherited items this story touches

- ✅ **Closes** [deferred-work.md:255](_bmad-output/implementation-artifacts/deferred-work.md#L255) — the award-copy ambiguity (`muertes` used for *both* the kills award and the most-deaths comedy award, so a screen-reader user cannot tell them apart). Its stated home is "an Epic 6/7 award-copy pass"; naming the 12 awards **is** that pass. Convention, already applied in 5.7: **Bajas = kills · Muertes = deaths**.
- ⚠ **Flag only, do not build** — [deferred-work.md:81](_bmad-output/implementation-artifacts/deferred-work.md#L81): *"Award reveals are in the same position: no Epic-6 story mentions the feed, yet FR-31 and the gold rail token both require a reveal entry."* `feed_entry.entry_type` already provisions `award_reveal` (4.6b) and `es.award.*` already carries the teaser copy (5.6) — but **nothing writes it**. Record it in Completion Notes for 6.8/6.10; it is not 6.1's (nothing is revealed yet).

### The mock diverges from the spine — trust the spine

[mock-leaderboards.html:483-515](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/mockups/mock-leaderboards.html#L483-L515) renders the locked block with the **real award names visibly blurred** ("Máquina de Frags", "El Más Generoso", "A Cuchillo" behind `filter: blur(4.5px)`). ⛔ **Do not implement that.** A CSS blur over real text is exactly the failure AD-22 names: *"prevents … CSS blur being the only secrecy."* View-source, DevTools, or a screen reader all defeat it instantly. The mock demonstrates the *visual language*; the **data contract** is the spine's. Render generic `Premio X de N` rows from the count alone. (Same class of divergence as the mock's nav labels and inline admin controls — a known, recorded pattern.)

Two more mock details worth keeping (they are visual, not data): the section header `Posiciones de premios` + `SE DESBLOQUEA EN LA CEREMONIA` (`:477-481`), and the cover line `Posiciones de premios ocultas hasta la ceremonia` / `{n} categorías selladas.` + the gold-free `Sembrado por el demo final · reproducible` (`:510-514`).

### Existing code you are extending (read these before writing)

| File | State today | What 6.1 changes |
|---|---|---|
| [lib/admin/command-route.ts](lib/admin/command-route.ts) | the ONE audited-command envelope (4.9) | **call it** — a new admin route that does not is a CI failure (`route-coverage.test.ts`) |
| [lib/i18n/es.ts](lib/i18n/es.ts) | the single Spanish module; `ceremony.seededByDemo` + `award.*` teaser already exist | **add** an `awards:` block; **reuse** the fixed strings, never retype them |
| [app/(viewer)/leaderboards/page.tsx](<app/(viewer)/leaderboards/page.tsx>) | anon read → `LeaderboardBoards`; header comment literally says *"Awards (the blurred 'Posiciones de premios' block) are Epic 6 — NOT built here"* | **render the locked block above the boards**; keep `force-dynamic`; update that comment |
| [lib/leaderboard/read.ts](lib/leaderboard/read.ts) | the `(client)`-taking read shape + `{ok:…}` snapshot | **mirror it** in `lib/awards/read.ts` — do not invent a new read shape |
| [app/(viewer)/current-tournament.ts](<app/(viewer)/current-tournament.ts>) | React `cache()`d per-request resolver (5.6 review patch) | **use it**; a second resolver = a second read per request |
| [supabase/migrations/0003_audit_snapshot.sql](supabase/migrations/0003_audit_snapshot.sql) | the append-only + admin-only-read + no-viewer-grant pattern | **copy the posture** for `award` |
| [app/(viewer)/ceremonia/page.tsx](<app/(viewer)/ceremonia/page.tsx>) | 5.7 `Placeholder` stub | **untouched** (6.10) |

### Testing standards

- **pgTAP** — one file per migration, `supabase/tests/0023_award_catalog_test.sql`, explicit `plan(N)` accounted for in Completion Notes. Baseline: **924+ assertions across 23 files, all green**; all 23 must stay green.
- **Vitest** — colocated `*.test.ts`. Baseline **461 passing**.
- **Mutation testing is a pre-review gate, not a nicety** (standing rule + retro Action Item #3): per effect, delete/invert it, confirm a **named** test reddens, restore. Author-side tables have repeatedly missed survivors that reviewers caught (5.2, 5.5, 5.7) — expect the reviewer to run their own.
- **THE BAR** — automated gates plus a live drive over the real seam is the sign-off, every story since Epic 3.
- ⚠ **`throws_ok` on SQLSTATE alone is weak here.** Every CHECK on `award` raises `23514`; 4.3's review found three suites where that made tests pass for the wrong reason. Assert the constraint name or use a probe that only the intended constraint can trip.

### Latest tech notes

Stack is pinned and current; **nothing new is introduced by this story**. Next.js `16.2.10` · React `19.2.7` · `@supabase/supabase-js` `2.110.0` · `@supabase/ssr` `0.12.0` · Vitest `4.1.9` · Node ≥ 20.9. Postgres 15+ (Supabase). No new dependency is needed or permitted — `award_catalog_count` is a plain `.rpc()` call on the client already in use, and the catalog constant is plain TypeScript.

Two Postgres specifics this story leans on, both stable and long-standing (not new API surface):
- **`DEFERRABLE INITIALLY DEFERRED` unique constraints** — must be declared as a table **constraint** (`unique (…) deferrable initially deferred`), not via `create unique index`; a deferred violation surfaces **at COMMIT**, which changes how the pgTAP negative test must be written.
- **`security definer` + `search_path`** — mirror the existing RPC preamble exactly; a `security definer` function with a loose `search_path` is the standard privilege-escalation shape, and this one is reachable by `anon` by design.

## Project Structure Notes

New files (all additive; naming follows the established `lib/<domain>/{model,read,…}.ts` + `app/api/admin/<verb>/route.ts` layout):

```
supabase/migrations/0023_award_catalog.sql      NEW   table + RLS/grants + count fn + curate RPC
supabase/tests/0023_award_catalog_test.sql      NEW   pgTAP, explicit plan(N)
lib/awards/catalog.ts                           NEW   the 12-award seed constant (one definition site)
lib/awards/catalog.test.ts                      NEW
lib/awards/curate.ts                            NEW   the admin command (faked-client testable)
lib/awards/curate.test.ts                       NEW
lib/awards/read.ts                              NEW   anon count read (mirrors lib/leaderboard/read.ts)
lib/awards/read.test.ts                         NEW
app/api/admin/awards/route.ts                   NEW   via handleAdminCommand
app/(viewer)/leaderboards/LockedAwards.tsx      NEW   server component; receives a number
app/(viewer)/leaderboards/leaderboards.module.css  UPDATE  blurred-lock styles (7px, no gold)
app/(viewer)/leaderboards/page.tsx              UPDATE  render the block; refresh the stale comment
lib/i18n/es.ts                                  UPDATE  + es.awards.*
worker/cmd/qa61/main.go                         THROWAWAY — deleted before commit, NOT in the File List
```

No variance from the unified structure. Migration number `0023` is the next free logical number (HEAD is `0022_match_viewer_read.sql`); **never edit an applied migration** (0003 stays untouched even though its `action` comment is now four migrations stale).

## References

- Story + ACs: [epics.md:994-1010](_bmad-output/planning-artifacts/epics.md#L994-L1010) · epic frame [epics.md:990-992](_bmad-output/planning-artifacts/epics.md#L990-L992)
- FR-24: [epics.md:54](_bmad-output/planning-artifacts/epics.md#L54) · FR coverage map (FR-24 → 6.1, 6.8) [epics.md:160](_bmad-output/planning-artifacts/epics.md#L160)
- AD-22 reveal-gating + commit-then-publish: [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185-L188)
- AD-17 append-only audit: [ARCHITECTURE-SPINE.md:163](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L163) · AD-24 Spanish invariant: [:195-198](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L195-L198)
- Conventions (closed-set CHECKs, `award.priority` UNIQUE, FK `ON DELETE`): [ARCHITECTURE-SPINE.md:229-235](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L229-L235)
- `award` DDL: [SOLUTION-DESIGN.md:158-173](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L158-L173) · reveal-gated RLS sketch [:283-296](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L283-L296) · indexes [:260](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L260)
- UX: award-card + blurred-lock [EXPERIENCE.md:90-95](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L90-L95) · blurred-until-ceremony [:116](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L116) · admin catalog surface [:46](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L46) · tokens [DESIGN.md:155-159, 269-274](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L155-L159) · tabular numerals [DESIGN.md:236](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L236)
- Don Clutch retirement (binding): sprint-status.yaml `6-1-award-catalog-and-buckets` note · [5-3-derived-stat-derivation.md:406-409, 458-468](_bmad-output/implementation-artifacts/5-3-derived-stat-derivation.md#L406-L409)
- Measured stat evidence: [5-1-core-stat-derivation.md:89-92, 206](_bmad-output/implementation-artifacts/5-1-core-stat-derivation.md#L89-L92) · [5-2-weird-demo-only-stat-derivation.md:261-265](_bmad-output/implementation-artifacts/5-2-weird-demo-only-stat-derivation.md#L261-L265) · [5-2a-blind-kills-live-source-amendment.md:83-93](_bmad-output/implementation-artifacts/5-2a-blind-kills-live-source-amendment.md#L83-L93)
- Epic-5 retro (doctrine + Action Items #2/#3/#5, Epic-6 readiness): [epic-5-retro-2026-07-28.md](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md)
- Inherited deferrals: [deferred-work.md:81](_bmad-output/implementation-artifacts/deferred-work.md#L81) (no `award_reveal` feed writer — flag) · [:255](_bmad-output/implementation-artifacts/deferred-work.md#L255) (award-copy ambiguity — close)

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`) — bmad-dev-story, 2026-08-03. Baseline commit `64990db`.

### Debug Log References

- Task 0 probe: `worker/cmd/qa61/main.go` (throwaway, **deleted before commit**; `go build ./... && go vet ./...` clean while present and after removal).
- Mutation harness: 45 mutations injected inside the pgTAP file's own transaction (DDL is transactional, so the file's terminating `ROLLBACK` undoes each one — no `db reset` per mutation).
- Live-QA harness: a Node script minting a **real** Supabase session for an admin and a viewer (email/password user + `app_metadata.steamid64` + `app_role` row), serialised into the `@supabase/ssr` cookie (`sb-127-auth-token`, `base64-` + base64url JSON), driving `POST /api/admin/awards` over HTTP. Deleted after the run.
- ⚠ The dev server was pointed at the **local** stack via process-env overrides (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`/keys); `.env.local` — which points at the hosted project — was **not modified** (Next.js does not override already-set env vars).

### Completion Notes List

#### ⭐ Task 0 — THE MEASUREMENT (AC3's evidence). Recorded verbatim.

Corpus: **14 demos · 204 counted rounds · 28 stat rows · 28 distinct SteamID64**. `Σkills == Σdeaths` on **14/14** demos.

```
=== VOLUME KEYS (integer totals) ===
key                       Σ total   players != 0   demos != 0    verdict
-------------------------------------------------------------------------
kills                         204       28 / 28            14  POPULATED
deaths                        204       28 / 28            14  POPULATED
assists                         0        0 / 28             0 *** EMPTY ***
mvps                            0        0 / 28             0 *** EMPTY ***
flash_assists                   0        0 / 28             0 *** EMPTY ***
utility_damage                313       15 / 28            12  POPULATED
knife_kills                     1        1 / 28             1  POPULATED
wallbang_kills                  8        7 / 28             7  POPULATED
through_smoke_kills             2        2 / 28             2  POPULATED
no_scope_kills                  0        0 / 28             0 *** EMPTY ***
blind_kills                     4        3 / 28             3  POPULATED
entry_frags                   204       28 / 28            14  POPULATED
opening_deaths                204       28 / 28            14  POPULATED
rounds_won                    204       28 / 28            14  POPULATED
rounds_played                 408       28 / 28            14  POPULATED
matches_played                 28       28 / 28            14  POPULATED
adr_damage                  25923       28 / 28            14  POPULATED
hs_kills                       83       25 / 28            14  POPULATED
kast_rounds                   204       28 / 28            14  POPULATED
clutches (retired)              0        0 / 28             0 *** EMPTY ***

=== RATE KEYS ({num, den} integer pairs — never a float) ===
key              num/den                          Σ num      Σ den  players num!=0   verdict
adr              adr_damage / rounds_played        25923        408      28 / 28    POPULATED
hs_pct           hs_kills / kills                     83        204      25 / 28    POPULATED
kast_pct         kast_rounds / rounds_played         204        408      28 / 28    POPULATED
entry_success    entry_frags / (entry+opening)       204        408      28 / 28    POPULATED
```

**Cross-check against the recorded 5.1/5.2/5.2a/5.3 baseline: NO DISCREPANCY.** Every previously-recorded number
reproduces exactly — entry/opening Σ204 each over 204 rounds, wallbang 8, blind 4 (the post-5.2a live source),
through-smoke 2, knife 1, no-scope 0, assists/flash/mvps 0, `clutches` `{}` for everyone. `utility_damage` had
only ever been spot-verified live (`HE 30 + Incendiary 3 = 33`); it is now properly measured at **Σ313 over
15/28 players in 12/14 demos** — populated, and it earns an award (#10).

#### ⛔⛔ THE TASK-0 FINDING — four proposed deciding stats are EXACT per-player CLONES

The probe measured more than "is it populated", because *populated* is necessary but not sufficient. A **clone
probe** and a **ranking probe** were added after the first pass:

```
=== CLONE PROBE: per-player exact equality (28 players) ===
  entry_frags        == kills            on 28 / 28 players   *** EXACT CLONE ***
  rounds_won         == kills            on 28 / 28 players   *** EXACT CLONE ***
  kast_rounds        == kills            on 28 / 28 players   *** EXACT CLONE ***
  opening_deaths     == deaths           on 28 / 28 players   *** EXACT CLONE ***
  kills + deaths     == rounds_played    on 28 / 28 players   *** EXACT CLONE ***
  hs_kills           == kills            on  2 / 28 players   distinct

=== RANKING PROBE — identical-ORDERING pairs (a shared winner every single time) ===
  *** kills            and rounds_won       rank IDENTICALLY
  *** kills            and entry_frags      rank IDENTICALLY
  *** rounds_won       and entry_frags      rank IDENTICALLY
  *** deaths           and opening_deaths   rank IDENTICALLY
  *** kast_pct         and entry_success    rank IDENTICALLY
```

**Cause, measured rather than argued:** in 1v1 wingman every round is ONE duel between the only two players, so
that single kill *is* the round's opening duel, *wins* the round, and *earns* the killer their KAST round.

**Consequence:** the story's proposed catalog would have shipped **three pairs of awards with a
guaranteed-identical winner** — #4 `Fábrica de Rondas` (`rounds_won`) and #5 `Primera Sangre` (`entry_frags`)
are clones of #1 `Máquina de Frags`; #12 `El Primero en Caer` (`opening_deaths`) is a clone of #11 `El Más
Generoso`. The ceremony would have crowned the same person three times **by construction**, and Story 6.6's
anti-sweep would have been damping a rigged catalog. Note this includes **the proposed Don Clutch replacement**.

**Cuatro's decision, 2026-08-03:** drop the three clones and replace them with measured, distinct axes —
`hs_kills` (volume headshots), `utility_damage`, and `adr` with `direction='min'`. All 12 seeded awards now rank
distinctly from one another; the clone keys stay in the CHECK **vocabulary** (a 5v5 separates them immediately)
and are barred only from the **seed**, enforced by the exported `MEASURED_DEGENERATE` set + a named Vitest.

#### The shipped catalog (12) — buckets skill 4 · clutch 1 · weird 5 · comedy 2

| # | Bucket | Class | Name | Deciding stat | Dir | floor_kills |
|---|---|---|---|---|---|---|
| 1 | skill | volume | Máquina de Frags | `kills` | max | 0 |
| 2 | skill | rate | Rey del Daño | `adr` | max | 20 |
| 3 | skill | rate | Puntería Quirúrgica | `hs_pct` | max | 20 |
| 4 | skill | volume | Cabeza de Martillo | `hs_kills` | max | 0 |
| 5 | **clutch** | rate | **Rey del Duelo** | `entry_success` | max | 20 | ⭐ the Don Clutch replacement |
| 6 | weird | volume | A Cuchillo | `knife_kills` | max | 0 |
| 7 | weird | volume | Atraviesa-muros | `wallbang_kills` | max | 0 |
| 8 | weird | volume | Fantasma del Humo | `through_smoke_kills` | max | 0 |
| 9 | weird | volume | Justicia Ciega | `blind_kills` | max | 0 |
| 10 | weird | volume | Manos de Piedra | `utility_damage` | max | 0 |
| 11 | comedy | volume | El Más Generoso | `deaths` | max | 0 |
| 12 | comedy | rate | El Inofensivo | `adr` | **min** | 20 |

`floor_rounds = 24` on all twelve. Deliberately absent: `no_scope_kills`/`assists`/`flash_assists`/`mvps`
(MEASURED_EMPTY), `clutches` (not a vocabulary key; Don Clutch stays retired), and
`kast_pct`/`rounds_won`/`entry_frags`/`opening_deaths` (MEASURED_DEGENERATE).

#### ⚠ Consequences RECORDED for later stories, not fixed here

1. **The all-zero-tie hazard (→ 6.4 / 6.5).** Tournament-wide the thin weird stats are knife **1**, smoke **2**,
   blind **4**, wallbang **8**. It is likely that *every eligible player sits at 0* for the thinnest. Stage 2
   picks the **best** value, so an all-zero field is a **whole-roster tie** that walks the FR-29 ladder to a
   shared trophy for everyone. **Is a zero deciding value awardable at all?** 6.4/6.5 must meet this as a
   specified case. Encoded as the exported `THIN_BUT_REAL` set in `lib/awards/catalog.ts`.
2. **`direction='min'` now has a real consumer.** Award #12 is the first and only `min` award. 6.4's Stage 2 and
   6.5's ladder must handle minimisation (and its ties) from their first line of code, not as an afterthought.
3. **No `award_reveal` feed writer exists anywhere in Epic 6** (carried from deferred-work.md:81).
   `feed_entry.entry_type` already provisions `award_reveal` (4.6b) and `es.award.*` already carries the teaser
   copy (5.6) — but **nothing writes it**. Flagged for **6.8 / 6.10**; not 6.1's (nothing is revealed yet).
4. **`catalog_frozen` is an HONEST PARTIAL of AD-15.** It tests `tournament.state in ('ceremony','closed')`
   because the `ceremony` table does not exist until **6.2**, which must replace this state test with the real
   lock (retro Action Item #2). No `ceremony_locked` column was invented here.
5. ✅ **Closes deferred-work.md:255** (the award-copy ambiguity: `muertes` used for BOTH the kills award and the
   most-deaths comedy award). `SeedAward.statLabel` is now the single definition site of the convention
   **Bajas = kills · Muertes = deaths**, pinned by three named Vitest cases. It is server-side only and
   deliberately NOT part of the curate payload (AD-22).

#### Two design defects the tests found (both fixed)

1. **`award_class_key_coherent` subsumed `award_class_valid`.** Written as a disjunction of the two legal cases
   (`(class='rate' and …) or (class='volume' and …)`), an out-of-enum class tripped *coherence*, leaving
   `award_class_valid` **untrippable** and its pgTAP test passing for the wrong constraint — exactly the
   overlapping-23514 trap the 4.3 review names, caught here only because the suite asserts constraint **names**.
   Rewritten as two implications so each constraint has exactly one responsibility and each is independently
   reachable by a probe.
2. **The pgTAP suite could not NAME which guard was missing.** During the mutation pass, deleting an RPC guard
   made the table's own CHECK *raise*, which aborted the whole psql transaction — the suite failed, but **no
   named test printed `not ok`**. Every refusal probe now routes through a `pg_temp.curate()` wrapper that turns
   a raise into the value `RAISED`, so a missing guard reddens the ONE named test that owns it (and, because the
   wrapper's `EXCEPTION` block runs in a subtransaction, a raising mutant still writes nothing — which keeps the
   "no refusal wrote anything" assertion honest rather than accidentally true).

#### pgTAP plan accounting — `plan(111)` (was `plan(104)`; +7 at the code review)

A **37** (shape 8 · CHECKs 18 · UNIQUEs 6 · vocabulary parity 5) + B **8** (RLS/grants) + C **11** (the AD-22 pair
+ both functions' posture + `award_stat_vocabulary`'s grants) + D **37** (happy path 6 · idempotency 3 · swap 3 ·
delete-missing 4 · 20 typed refusals · 1 "nothing was written") + E **10** (the audit row, every `detail` key) +
F **5** (`catalog_frozen`) + G **3** (integral JSON decimals accepted, not 22P02'd).

⚠ The A breakdown originally read `CHECKs 19 · parity 4`. The two errors cancelled, so the section total (37) and
`plan(104)` were both correct and nothing reddened — corrected at the code review because the standing rule is
that the plan be *accounted for*, and an accounting that does not reconcile to the file is not one.

#### Mutation table — 45 mutations, **0 survivors**, every one reddens a NAMED test

| Mutation | Verdict (failing test #s) |
|---|---|
| drop CHECK `award_bucket_valid` | RED #11 |
| drop CHECK `award_class_valid` | RED #12 |
| drop CHECK `award_direction_valid` | RED #13 |
| drop CHECK `award_deciding_stat_valid` | RED #14, #35 |
| drop CHECK `award_secondary_stat_valid` | RED #15 |
| drop CHECK `award_eff_num_key_valid` | RED #16 |
| drop CHECK `award_eff_den_key_valid` | RED #17 |
| drop CHECK `award_class_key_coherent` | RED #19, #20 |
| drop CHECK `award_name_not_blank` | RED #22, #23 |
| **`award_name_not_blank` → `btrim(name) <> ''`** (the 4.2 bug) | RED #22 |
| drop CHECK `award_priority_positive` | RED #24 |
| drop CHECK `award_floors_non_negative` | RED #25, #26 |
| drop UNIQUE `award_tournament_name_key` | RED (30 tests) |
| **UNIQUE priority `DEFERRABLE` → immediate** | RED #29, #30, #31, #32, #64, #65, #66, #90 |
| drop UNIQUE priority entirely | RED #30 |
| drop index `award_tournament_priority_idx` | RED #7 |
| RLS `NO FORCE` | RED #39 |
| RLS disabled | RED #38 |
| drop policy `award_admin_read` | RED #40, #41 |
| **`grant select on award to anon`** | RED #42, #44, #52 |
| **`grant select on award to authenticated`** | RED #43, #44 |
| revoke `award_catalog_count` from anon | RED #47 |
| expose `curate_award_catalog` to anon | RED #48 |
| `award_catalog_count` security definer → invoker | RED #50 |
| drop a key from `award_stat_vocabulary()` | RED (22 tests) |
| guard `no_tournament` | RED #71 |
| guard `catalog_frozen` | RED #100, #101, #102, #103 |
| guard `empty_catalog` (null/non-array) | RED #73, #74 (+8) |
| guard `empty_catalog` (length 0) | RED #72 (+8) |
| guard `too_many_awards` | RED #75 (+7) |
| guard `duplicate_name` | RED #76 |
| guard `duplicate_priority` | RED #77 (+7) |
| guard `invalid_award/name` | RED #78 |
| guard `invalid_award/bucket` | RED #79 |
| guard `invalid_award/class` | RED #80 |
| guard `invalid_award/deciding_stat` | RED #81 |
| guard `invalid_award/class_key_mismatch` | RED #82 |
| guard `invalid_award/direction` | RED #83 |
| guard `invalid_award/priority` (type) | RED #84 |
| guard `invalid_award/priority` (range) | RED #85 |
| guard `invalid_award/floors` | RED #86 |
| guard `invalid_award/secondary_stat` | RED #87 |
| remove the `audit_log` INSERT | RED #90–#99 |
| remove delete-missing | RED #67, #68, #69, #70, #93, #95 |
| audit actor hard-coded instead of `p_actor` | RED #92 |

#### THE BAR — Task 9 live QA, **27/27 checks passed** over the real seam

Local stack (`supabase db reset` applied 0001→0023; **no WinNAT interference this run** — DB on 54322, API on
54321 as printed). Driven as a **genuinely signed-in admin** over HTTP, not as service_role.

| Probe | Result |
|---|---|
| `POST /api/admin/awards` seed 12 | **200** `{"ok":true,"count":12,"before_count":0}` · 12 rows |
| identical re-post (idempotency) | **200** `{"count":12,"before_count":12}` · still 12 rows, names unique, no duplicate |
| swapped priority pair | **accepted** — `Máquina de Frags` → priority 2, `Rey del Daño` → priority 1 (the DEFERRABLE UNIQUE over the real seam; an immediate index would have 500'd) |
| duplicate priority | `{"ok":false,"reason":"duplicate_priority","priority":1}` · **catalog byte-identical afterwards** |
| signed-in **non-admin** | **403** `{"error":"forbidden"}` |
| **signed-out** | **401** `{"error":"forbidden"}` — see the note below |
| malformed `tournament_id` | **400** `invalid_body` |
| unknown tournament | **404** `no_tournament` |
| `state='ceremony'` | **409** `catalog_frozen` |
| anon `GET /rest/v1/award?select=*` | **HTTP 401** `{"code":"42501", "message":"permission denied for table award", "hint":"Grant the required privileges … GRANT SELECT ON public.award TO anon;"}` |
| anon `POST /rest/v1/rpc/award_catalog_count` | **HTTP 200** → `12` |
| `audit_log` | **exactly 3 new `curate_awards` rows** (2 accepted HTTP seeds + 1 accepted swap); the **6 refused calls wrote none**; every row's actor = `76561198388441171` (the acting admin's SteamID64); `detail.before.count` / `detail.after.count` present |

**⭐ AC4's real proof — the served-HTML grep.** `/leaderboards` HTML (41 903 bytes) was fetched and grepped for
**all 12 award names + all 12 buckets + all 12 classes + all 12 deciding-stat keys** → **0 hits**. It renders
12 locked cards (`Premio 1 de 12` … `Premio 12 de 12`, no 13th), the exact accessible name
`Premio 7 de 12 — bloqueado hasta que gire` (em dash), `12 categorías selladas.`, the reused fixed line
`Sembrado por el demo final · reproducible`, and **zero gold tokens** anywhere in the page.

⚠ **One story bullet was imprecise, not a defect.** Task 9 expects "non-admin / signed-out → **403**". The
shipped 4.9 envelope passes `requireAdmin`'s status straight through: **401** for *no session*, **403** for an
*authenticated non-admin*. Both refuse before any read or write. This is pre-existing Story-2.4 behaviour and
the correct HTTP semantic; 6.1 does not change it.

⚠ The visual check was done by asserting the **served HTML** (card count, counter text, accessible name, absence
of every gold token) rather than by a screenshot — which is the ordering the story itself specifies ("that grep
is AC4's real proof; the screenshot is not").

#### Task 10 gates

| Gate | Baseline | Now |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | 462 | **512** (+50: catalog 23 · curate 17 · read 10) |
| `npm run build` | 0 | **0** — every viewer route still `ƒ` dynamic, nothing prerendered but `/_not-found` |
| pgTAP | 928 across 23 files | **1032 across 24 files** — `plan(104)` new, **all 23 prior suites still green** |
| `go build ./... && go vet ./...` | clean | **clean** (with `qa61` present and after its removal); `go test ./...` all packages ok |

⚠ The story's Dev Notes quote a Vitest baseline of **461** and pgTAP **924+**; the measured baselines at
`64990db` are **462** and **928**. Recorded rather than reconciled — the deltas above are the real numbers.

**Confirmed untouched** (`git diff --stat` empty): `public.leaderboard` (0021) and its 24/20 floor literals,
`approve_match` / `rollback_match` / `manual_resolve_match` (0017/0018/0019), every `worker/` package, and
`/ceremonia` (still the 5.7 `Placeholder`). The throwaway `worker/cmd/qa61` was deleted before commit and is
**not** in the File List.

### File List

**New**
- `supabase/migrations/0023_award_catalog.sql`
- `supabase/tests/0023_award_catalog_test.sql`
- `lib/awards/catalog.ts`
- `lib/awards/catalog.test.ts`
- `lib/awards/curate.ts`
- `lib/awards/curate.test.ts`
- `lib/awards/read.ts`
- `lib/awards/read.test.ts`
- `app/api/admin/awards/route.ts`
- `app/(viewer)/leaderboards/LockedAwards.tsx`
- `lib/i18n/es.test.ts` *(added at the code review — the pluralization + AC4 accessible-name contract had no test)*

**Modified**
- `app/(viewer)/leaderboards/page.tsx`
- `app/(viewer)/leaderboards/leaderboards.module.css`
- `lib/i18n/es.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-1-award-catalog-and-buckets.md`

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Story created (bmad-create-story). Epic 6 flipped `backlog → in-progress`. Status → ready-for-dev. |
| 2026-08-03 | Implemented (bmad-dev-story, baseline `64990db`). Migration 0023: `award` + 11 named CHECKs + the DEFERRABLE priority UNIQUE + ENABLE/FORCE RLS with **no** anon/authenticated grant + `award_catalog_count()` + the audited idempotent `curate_award_catalog()`. Plus `lib/awards/*`, the admin route through the 4.9 envelope, and the count-only locked-awards block on `/leaderboards`. |
| 2026-08-03 | **Task 0 finding (AC3):** `entry_frags`/`rounds_won` ≡ `kills` and `opening_deaths` ≡ `deaths` on **28/28 players**; `kast_pct` ≡ `entry_success`. Three proposed awards — including the Don Clutch replacement — would have had guaranteed-duplicate winners. Cuatro's call: dropped and replaced with `hs_kills`, `utility_damage` and `adr` `direction='min'`. Encoded as `MEASURED_DEGENERATE` + named Vitest. |
| 2026-08-03 | `award_class_key_coherent` rewritten as two implications — the disjunctive form made `award_class_valid` untrippable (found by asserting constraint **names**). pgTAP refusal probes routed through `pg_temp.curate()` so a missing guard reddens a **named** test (found by the mutation pass). |
| 2026-08-03 | Gates: lint 0 · Vitest **512** · build 0 (viewer routes stay `ƒ`) · pgTAP **1032 / 24 files** (all 23 prior suites green) · Go clean. Mutation matrix **45 mutations, 0 survivors**. THE BAR **27/27** over the real seam. Status → review. |
| 2026-08-03 | **Code review (bmad-code-review, 3 parallel layers).** 2 decision-needed · 11 patch · 9 defer · 3 dismissed. ⭐ **AC3's open gap closed by measurement:** a reviewer probe ranked all **66 pairs** of the twelve seeded awards tournament-wide (exact integer cross-multiplication) — **zero rank identically**, so the three replacement keys are confirmed clone-free; the same probe reproduced every clone Task 0 condemned (28/28), which is what makes that verdict trustworthy. ⛔ **New finding, deferred by Cuatro to 6.4/6.5:** the declared floors exclude the **entire measured roster** — `rounds_played` is min 10 / max 21 vs `floor_rounds=24`, and **0/28** players reach `floor_kills=20`, so on today's data all twelve awards have zero eligible players. Not a 6.1 defect (the floors are 0021's), but the winnability assumption is untested. All 11 patches applied and mutation-tested (9 mutations, 0 survivors — one survivor found, recorded, then pinned). Gates: lint 0 · Vitest **537** · build 0 · pgTAP **1039 / 24 files**, `plan(111)` · Go clean. Status → done. |

