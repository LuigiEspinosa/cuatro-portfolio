---
baseline_commit: 74873b0d7386086d121ec8d48ad073cab722f9ba
---

# Story 5.5: Single normalized leaderboard view/RPC

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want one normalized leaderboard computed in exactly one place,
so that rankings are consistent, floor-gated, and reflect only matches actually played.

## Acceptance Criteria

> Restated and made testable from `epics.md:903-923` (Story 5.5) + AD-20, AD-9, AD-7, FR-17, FR-21, FR-22. Numbers below are the dev-agent contract.

**AC1 — One owner, one normalization site, one shape (AD-20).** A single Postgres **VIEW** `public.leaderboard` over `stat_row WHERE status='approved'` is the *only* standings aggregate in the system. It applies the FR-21 floors and rate-vs-volume classing in exactly one place. No component hand-rolls a second aggregate. It is a **plain (non-materialized) view** — NOT a materialized view, NOT an RPC/function. The leaderboard migration slice `0021_leaderboard.sql` (+ paired `0021_leaderboard_test.sql`) is created here.

**AC2 — The AD-6 "recompute" stays a correct no-op (Epic-4 Action Item #2).** Creating this view requires **zero** change to `approve_match` (`0017_aprobar_publish.sql`) or `rollback_match` (`0018_rollback_match.sql`). Because the view reads live off `status='approved'`, the Aprobar status-flip *is* the recompute and the rollback status-flip *is* the removal (DECISION E, verified at `0017:15-18,390-391` and `0018:60-62,336-337`). Do **not** add any `REFRESH MATERIALIZED VIEW` — an in-transaction refresh takes an ACCESS EXCLUSIVE lock and would violate AD-6/AD-20 (`0018:62-63`).

**AC3 — Fail-closed viewer security (AD-7).** The view is created `with (security_invoker = on)` so the caller's RLS on `stat_row` applies, AND it carries an **explicit** `where status='approved'` (correct even for admin/service_role callers who can see pending). It is reachable via PostgREST with `grant select on public.leaderboard to anon, authenticated, service_role`. It is **never** `SECURITY DEFINER` and never bypasses the base-table `stat_view` RLS policy. A `pending` stat row never appears in any leaderboard row's aggregate.

**AC4 — Rate-class normalization per opportunity (FR-22).** Rate stats are computed as `sum(numerator) / nullif(sum(denominator), 0)` cumulatively across a player's contributing matches, each exposed as numerator + denominator + computed ratio (AD-19 `{num,den}` shape):

| Rate stat | Numerator | Denominator (opportunity) |
|---|---|---|
| ADR | `sum(adr_damage)` | `sum(rounds_played)` |
| KAST% | `sum(kast_rounds)` | `sum(rounds_played)` |
| HS% | `sum(hs_kills)` | `sum(kills)` |
| Entry success | `sum(entry_frags)` | `sum(entry_frags) + sum(opening_deaths)` |

The two per-round rates (ADR, KAST) sum numerator and denominator *then* divide — never an average of per-match ratios (`SOLUTION-DESIGN.md:378-379`).

**AC5 — Volume-class as totals (FR-22).** Volume stats are cumulative totals (`sum(...)`) across a player's contributing matches: `kills`, `deaths`, `assists`, `mvps`, `flash_assists`, `utility_damage`, `knife_kills`, `wallbang_kills`, `through_smoke_kills`, `no_scope_kills`, `blind_kills`, `entry_frags`, `opening_deaths`. Each board's class ('rate' | 'volume') is derivable by the consumer; the view emits stable machine values only (no Spanish labels — AD-24).

**AC6 — Cumulative anti-farm floors (FR-21, SM-C1) — NOT per-match.** Eligibility floors are applied over the **sum** across the player's contributing approved matches, exposed as booleans:
- `meets_round_floor` = `sum(rounds_played) >= 24`
- `meets_kill_floor` = `sum(kills) >= 20` (applies to rate/HS boards only)
- `eligible_rate` = `meets_round_floor AND meets_kill_floor`

⚠ The 24-round floor is **cumulative across the tournament, never per-match**: a 1v1 wingman match is ≤~22 rounds, so a per-match ≥24 gate would disqualify *everyone* (SM-C1 inverted — the "reads 0 because these are duels" trap). The `24` and `20` are single-sourced named literals in the view, value-parity with `award.floor_rounds default 24` / `floor_kills` "20 for rate/HS" (`SOLUTION-DESIGN.md:168-169`). Do **not** create/read the Epic-6 `award.floor_*` columns or `verification_bundle` (`5-4-...md:72`).

**AC7 — idle_dq match-contributions excluded, player never blanket-banned (FR-21).** Rows with `idle_dq = true` are excluded from the aggregation entirely (they neither help nor hurt totals or floor sums — the same "matches actually played" posture as forfeit hygiene). A player whose only contributions are idle-DQ'd therefore has **no contributing rows and does not appear in the view at all** (vanishes, exactly as forfeit/bye produce zero rows in AC8 — resolved at code review 2026-07-27, not a zeroed ghost row), while their non-idle matches still count. `idle_dq` is per-match, so exclusion is per-contribution, not a per-player ban (`EXPERIENCE.md:117`, `5-4-...md:71,248`).

**AC8 — Forfeit/bye hygiene by construction (FR-17, AD-9).** Forfeits and byes produce zero `stat_row`s (no reachable stat-write path), so rates automatically normalize over matches actually played. The view needs **no** special forfeit/bye filter — `sum(rounds_played)` only spans matches that produced rows.

**AC9 — NULL-safety across pre-Epic-5 rows (deferred-work.md:9).** Every Epic-5 stat column is `coalesce`d (`NULL → 0`; `clutches NULL → '{}'::jsonb`) so rows parsed before Epic 5 / 5.3 / 5.4 do not silently drop a player through `SUM`/`ORDER BY`/`WHERE col > 0`. Every rate denominator is guarded with `nullif(..., 0)` so a 0-opportunity player yields a NULL ratio (rendered "sin datos" / ineligible upstream), never a division error.

**AC10 — Tests + suite green.** A paired pgTAP suite `supabase/tests/0021_leaderboard_test.sql` with an explicit `plan(N)` asserts, at minimum: view exists; `security_invoker=on`; `SELECT` grants for anon/authenticated/service_role; a `pending` row is excluded while an `approved` row is included; a rate ratio is arithmetically correct (sum-num/sum-den, multi-match); a below-24-cumulative-rounds player is `eligible_rate=false`; an `idle_dq` row is excluded from totals; NULL stat columns coalesce (a pre-Epic-5-shaped row does not vanish); a 0-opportunity denominator yields NULL not error. The full existing suite (`supabase test db`) stays green — remember **every pgTAP file runs against the final migrated schema** (`epic-3-retro:52`), so adding this migration must not invalidate a prior test.

## Tasks / Subtasks

- [x] **Task 1 — Author `supabase/migrations/0021_leaderboard.sql` (AC1, AC2, AC3)**
  - [x] Open with the standing SCOPE / OUT-OF-SCOPE header comment (mirror `0007`/`0008`/`0017` style). OUT-OF-SCOPE must name: no matview, no `REFRESH`, no RPC/function, no change to `approve_match`/`rollback_match`, no touch to `award.floor_*`/`verification_bundle` (Epic 6), no worker/app/`.ts` change.
  - [x] `create view public.leaderboard with (security_invoker = on) as ...` — one row per `steamid64`, cumulative across that player's contributing approved matches.
  - [x] Explicit `where status = 'approved' and idle_dq = false` on the base scan (belt-and-suspenders with RLS; AC3, AC7).
  - [x] `grant select on public.leaderboard to anon, authenticated, service_role;` (view is a public viewer surface — unlike the service_role-only `unreconciled_stat_row`).
- [x] **Task 2 — Compute the aggregate columns (AC4, AC5, AC6, AC9)**
  - [x] `group by steamid64`. Output columns (machine-stable): identity `steamid64`/`display_name`/`matches_played`/`rounds_played_total`/`kills_total`; rate triples `adr_damage_sum`+`adr`, `kast_rounds_sum`+`kast_pct`, `hs_kills_sum`+`hs_pct`, `entry_opportunities`+`entry_success`; volume totals (`deaths_total`…`opening_deaths_total`); eligibility `meets_round_floor`/`meets_kill_floor`/`eligible_rate`.
  - [x] `coalesce(col, 0)` on EVERY int stat column before summing (clutches NOT referenced — clutch board out of scope, so no jsonb coalesce needed). Guarded every rate ratio with `nullif(denominator, 0)` and cast each numerator `::numeric` (Σ of int is bigint — bigint/bigint would floor).
  - [x] Pinned `24` and `20` as named thresholds in a single-source `thresholds` CTE with the `value-parity with award.floor_rounds/floor_kills (SOLUTION-DESIGN.md:168-169); Epic-6 duplication seam` note.
- [x] **Task 3 — Add the earmarked partial index (AC1)**
  - [x] Created `create index stat_row_approved_idx on public.stat_row (steamid64) where status = 'approved';` — sized to the per-player aggregation. Distinct from `stat_row_match_idx` (matchzy_match_id) and `stat_row_bracket_match_idx` (match_id) — different column + WHERE predicate, no duplication.
- [x] **Task 4 — Verify the no-op contract, change nothing (AC2)**
  - [x] Re-read `0017_aprobar_publish.sql:390-391` and `0018_rollback_match.sql:336-337`; both already treat "recompute leaderboards" as a comment-only no-op (DECISION E). **No revision was owed — both files left untouched.**
- [x] **Task 5 — Author `supabase/tests/0021_leaderboard_test.sql` (AC10)**
  - [x] `begin; create extension … pgtap; set local search_path = extensions, public; select plan(21); … select * from finish(); rollback;`
  - [x] Seeded FK parents (demo + player) + 6 players of stat rows as `postgres` (match_id left NULL — nullable; no match/tournament seed needed). Covers: existence + `security_invoker=on`; the 3-role grant matrix; behavioral `set local role anon`/`service_role` that a `pending` row is excluded from the aggregate AND a pending-only player is invisible while an approved player aggregates; two-match ADR = Σnum/Σden AND entry_success = Σnum/Σden (both proving sum-then-divide ≠ avg-of-ratios); a <24-cumulative-round player `eligible_rate=false`; an `idle_dq=true` row absent from totals + matches_played; a NULL-stat row coalesces and still appears; a 0-opportunity denominator yields NULL not error.
- [x] **Task 6 — Gate + local live-QA**
  - [x] `supabase db reset` (applied 0001→0021 clean) then `supabase test db` — **Files=22, Tests=899, Result: PASS**; the new suite passes AND every prior suite stays green (final-schema gotcha).
  - [x] Live sanity as `anon`: view + partial index present; anon reaches the view with no `player`-join error; a rolled-back seed hand-check reproduced ADR `78.9474`=3000/38 (multi-match sum-then-divide), entry_success `0.4286`=6/14, `eligible_rate=t` for the qualified player and `meets_round_floor=f`/`eligible_rate=f` for the 15-round player. (WinNAT port-trap hit on reset — cleared by an elevated `net stop/start winnat`; see the local live-QA memory. Full-corpus aggregate deferred to the 5.6/5.7 read surfaces, which ingest+approve real demos — the pgTAP suite runs as the `anon` role against the final schema and discharges the correctness proof.)

## Dev Notes

### The single most important decision — already made: plain live VIEW
The architecture leaves "view **or** RPC" and "plain **or** materialized" open (`ARCHITECTURE-SPINE.md:178`), but the build has **already committed to a plain, always-live view** on both the write and rollback paths:
- Epic-4 retro **Action Item #2** (`epic-4-retro:98,118`) requires 5.5's leaderboard to be "a view over `status='approved'` stat_rows so 4.6b's Aprobar 'recompute' stays a correct no-op — no `approve_match` revision."
- `0017_aprobar_publish.sql:15-18` (DECISION E): "'recompute leaderboards' is a NO-OP and building anything VIOLATES AD-20 … Step (1)'s status flip IS the recompute; the leaderboard is Story 5.5's."
- `0018_rollback_match.sql:60-63,336-337`: the status flip *is* the removal; "REFRESH MATERIALIZED VIEW in-txn would violate AD-6."
- Adversarial-review option (a) — "a pure query-time projection over `stat_row` (no materialized standings; AD-6's 'recompute' reduces to 'no extra write')" (`review-adversarial.md:144-145`).
- Scale is 8–16 players / private audience — a matview is pure over-engineering here.

**Therefore: build a plain `security_invoker=on` VIEW. Do not build a matview, do not build an RPC/function, do not add REFRESH, do not touch `approve_match`/`rollback_match`.** An RPC would only be justified by a runtime parameter the view can't express — there is none (the app filters/orders/hides per board client-side off the wide per-player view). One owner, one shape.

### Current `stat_row` schema (what the view reads) — traced across 0007 → 0010 → 0016
There are **no** precomputed ratio columns — the view derives all rates. There is **no** `adr`, `hs_pct`, `kast`, `molotov_damage`, or `he_damage` column; only `adr_damage` (raw), `hs_kills`, `kast_rounds`, and aggregate `utility_damage`.

| Column | Type | Notes |
|---|---|---|
| `steamid64` | text, not null | AD-4 sole join key, `CHECK (~ '^[0-9]{17}$')`, NOT a FK |
| `status` | text, not null default 'pending' | `check in ('pending','approved')` — the AD-7 gate |
| `idle_dq` | boolean, **not null default false** | per-match; reads correctly even on pre-5.4 rows |
| `idle_round_count` | int, nullable | **NULL on pre-5.4 rows** (coalesce if referenced) |
| `rounds_played` | int, nullable | rate denominator (FR-21 cumulative floor) |
| `kills` `deaths` `assists` | int, nullable | HS% denom is `kills`; ≥20 kill floor uses `sum(kills)` |
| `adr_damage` | int, nullable | ADR numerator (overkill-capped upstream, ≤100/victim/round) |
| `hs_kills` `mvps` `flash_assists` `utility_damage` | int, nullable | HS% num; the rest volume |
| `kast_rounds` | int, nullable | KAST numerator |
| `knife_kills` `wallbang_kills` `through_smoke_kills` `no_scope_kills` `blind_kills` | int, nullable | weird-five volume; `blind_kills` is real (5.2a), `no_scope_kills` legitimately 0 on the corpus |
| `entry_frags` `opening_deaths` | int, nullable | entry-success ratio inputs (5.3, raw counts) |
| `clutches` | jsonb, nullable | `{"1":n,...}`, `'{}'` on post-5.3 rows, **NULL on pre-5.3 rows** |
| `rounds_won` | int, nullable | FR-16 (0016); not needed by the leaderboard |
| `match_id` | bigint, **nullable**, FK → `match(id)` ON DELETE CASCADE | bracket node; NULL until Aprobar binds |
| `matchzy_match_id` | bigint, not null, NO FK | external MatchZy id — **do NOT join on this** |

Join/aggregate on `stat_row` grouped by `steamid64`, filtered `status='approved' and idle_dq=false`. No join to `match` is required for correctness (forfeit/bye already produce zero rows, AD-9). `display_name` lives on `player(steamid64)` (Epic 2).

### `display_name` under security_invoker (graceful degradation, not a failure)
`LEFT JOIN public.player p on p.steamid64 = s.steamid64` for `display_name`. Under `security_invoker=on` the join runs as the caller; if `player` is not readable to `anon` (RLS/grant), the left join simply yields `display_name = NULL` — the leaderboard row still appears (no error). If a NULL name is unacceptable for the viewer surface, expose `steamid64` and resolve the name in `app/`. Do **not** add a grant/policy to `player` in this migration (out of scope). Confirm the actual `player` viewer-readability during Task 6 and record it.

### NULL is the top bug risk — coalesce everything (deferred-work.md:9)
Rows parsed before Epic 5 / 5.3 / 5.4 carry SQL `NULL` in the Epic-5 stat columns until their demo is re-parsed (this is expected, **not** a backfill). A bare `sum(col)` tolerates NULL, but `where col > 0`, `order by col`, and any ratio silently drop or mis-rank a player. Coalesce every int stat `NULL → 0` and (if referenced) `clutches NULL → '{}'::jsonb`, and `nullif(den,0)` every rate denominator. This concern is explicitly homed to this view.

### Clutch board is out of scope (award retired)
Over the all-1v1 wingman format, transition-only clutches are structurally `{}` for every player (`T:1 CT:1` on 221/221 rounds). Cuatro authorized retiring the "Don Clutch — 1vX ganados" award during 5.3 (keeping the `clutch` *bucket* for a future 5v5). **Do not invent a clutch aggregate/board now.** Only ensure `clutches` NULL-safety if you reference the column at all; the natural clutch-bucket replacement deciding-stat is entry frags / opening duels, but that is Epic-6 award-catalog work, not this view.

### Rate vs volume, exact (FR-22)
Rate boards (`por oportunidad`, hide below-floor): ADR, KAST%, HS%, entry-success — see AC4. Volume boards (`totales`, no floor hiding): the integer totals in AC5. Per-round rates sum num & den then divide; ratios (HS%, entry) divide over their own opportunity counts. Emit machine values; Spanish labels (`Tasa`/`Volumen`, `elegible`, `aún no elegible · Mín. 24 rondas`) live in the `app/` i18n module (AD-24), never in SQL.

### Eligibility flags drive the UX (UX-DR39 / `mock-leaderboards.html`)
The Tasa/Volumen surface hides below-floor players on rate boards and shows a DQ marker. The view exposes the raw inputs (`rounds_played_total`, `kills_total`, `matches_played`) and the derived booleans (`meets_round_floor`, `meets_kill_floor`, `eligible_rate`) so the app can render "elegible" / "aún no elegible · Mín. 24 rondas" / DQ states without re-deriving floors. Keep the floor logic in the view (AD-20 single site) — the app only reads the flags.

### Migration / RLS / pgTAP conventions (follow exactly)
- Sequential 4-digit slice: **`0021_leaderboard.sql`** + **`supabase/tests/0021_leaderboard_test.sql`**. Highest existing is `0020`.
- View-creation pattern to mirror: `unreconciled_stat_row` at `0008_demo_validation.sql:59-70` — `create view ... with (security_invoker = on) as ...` then explicit `grant select`. **Difference:** this view grants to `anon, authenticated, service_role` (public leaderboard), not service_role-only.
- Base RLS the view rides on: `stat_view` policy `using (status='approved')` for `anon, authenticated` (`0009:30-31`) + `grant select on stat_row to anon, authenticated` (`0009:35`); `stat_row` is ENABLE+FORCE RLS (`0007:60-61`). Views cannot carry RLS — access = the view's GRANT + `security_invoker` reaching the base-table policy.
- pgTAP: `plan(N)` exact count; seed FK parents as `postgres`; role-switch via `set local role <role>` + `select set_config('request.jwt.claims', '{"app_metadata":{"role":"...","steamid64":"..."}}', true)`; assert `security_invoker` via `pg_class.reloptions ~ 'security_invoker=(on|true)'` (`0008_demo_validation_test.sql:135-137`); `rollback` at end. Runner: `supabase test db`. Postgres 17 — `security_invoker` views available.
- **Final-schema gotcha** (`epic-3-retro:52`): every pgTAP file runs against the fully-migrated schema. Adding 0021 must not break a prior test; conversely if you needed to change a prior table you'd have to revisit its test — but this story adds only a view + index, touching no prior table's posture.

### Project Structure Notes
- New files only: `supabase/migrations/0021_leaderboard.sql`, `supabase/tests/0021_leaderboard_test.sql`. No `worker/`, no `app/`, no `lib/`, no `.ts` change — this is a pure DB slice (the read surfaces that consume it are Stories 5.6/5.7).
- No conflict with the existing structure: the only other view is `unreconciled_stat_row`; there is no prior leaderboard object of any kind (this is the first).
- Genre shift from 5.1–5.4 (Go worker) to SQL/migration — the dev conventions above come from Epics 1–2 (schema/RLS), not the worker stories.

### References
- Story 5.5 ACs: [epics.md](../planning-artifacts/epics.md) L903-923; AD-20 gloss L98; UX-DR39 L129; FR trace L153,157,158.
- AD-20 / AD-9 / AD-7 / AD-6 / AD-19 / AD-24: `_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md` L175-178, L120-123, L110-113, L105-108, L173, L195-198.
- Leaderboard design + rate formulas + floors: same dir `SOLUTION-DESIGN.md` L377-379, L141-156, L168-169, L372-375.
- FR-17/21/22 text: `_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md` L275-282, L319-320, L323-330, L534.
- No-op contract (verified): [0017_aprobar_publish.sql](../../supabase/migrations/0017_aprobar_publish.sql#L390) L15-18,390-391; [0018_rollback_match.sql](../../supabase/migrations/0018_rollback_match.sql#L336) L60-63,336-337.
- Schema: [0007_stat_row.sql](../../supabase/migrations/0007_stat_row.sql) (table + index earmark L52-54), [0010_match.sql](../../supabase/migrations/0010_match.sql) (rename + FK L173-181; match state L64-65), [0016_bind_and_score.sql](../../supabase/migrations/0016_bind_and_score.sql#L113).
- View + RLS patterns: [0008_demo_validation.sql](../../supabase/migrations/0008_demo_validation.sql#L59) L59-70; [0009_stat_pending_visibility.sql](../../supabase/migrations/0009_stat_pending_visibility.sql) L22,30-31,35; [0002_rls.sql](../../supabase/migrations/0002_rls.sql) L19-24,87-98.
- pgTAP precedent: `supabase/tests/0007_stat_row_test.sql`, `supabase/tests/0008_demo_validation_test.sql` L102-154.
- Prior-story intelligence: [5-4-anti-farm-floors-and-afk-idle-dq.md](5-4-anti-farm-floors-and-afk-idle-dq.md) L71-72,248,254-256; [5-3-derived-stat-derivation.md](5-3-derived-stat-derivation.md) L55,62,78,298; [5-2a-blind-kills-live-source-amendment.md](5-2a-blind-kills-live-source-amendment.md); `deferred-work.md` L9; Epic-4 retro action item #2 [epic-4-retro-2026-07-19.md](epic-4-retro-2026-07-19.md) L46,85,98,118.
- UX: `_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/{EXPERIENCE.md L40,88,117, DESIGN.md L268, mockups/mock-leaderboards.html}`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story, baseline `74873b0`).

### Debug Log References

- `supabase db reset` — clean apply 0001→0021 (first attempt blocked by the WinNAT port trap: port 54322 reserved inside range 54247–54346; cleared by an elevated `net stop winnat` / `net start winnat`, then re-run succeeded).
- `supabase test db` — **Files=22, Tests=899, Result: PASS** (new `0021_leaderboard_test.sql` = 21 assertions; all 20 prior suites green — final-schema gotcha respected).
- Live `anon` hand-check (rolled back): view + `stat_row_approved_idx` present; anon reachable with no `player`-join error; ADR 78.9474 = 3000/38, entry_success 0.4286 = 6/14, eligibility flags correct.

### Completion Notes List

- **The decision was pre-made and honored: a PLAIN `security_invoker=on` VIEW `public.leaderboard`** over `stat_row WHERE status='approved' AND idle_dq=false` — NOT a matview, NOT an RPC/function, NO `REFRESH` anywhere. It is the single normalization site (AD-20): FR-21 floors + FR-22 rate/volume classing computed in exactly one place.
- **AC2 no-op discharged with zero code:** re-verified `0017_aprobar_publish.sql:390-391` and `0018_rollback_match.sql:336-337` — both already treat "recompute leaderboards" as a comment-only no-op (DECISION E). Because the view reads live off `status='approved'`, the Aprobar status-flip *is* the recompute and the rollback flip *is* the removal. **Neither file was edited** (Epic-4 retro Action Item #2 discharged).
- **AC3 fail-closed + belt-and-suspenders:** `security_invoker=on` so viewers ride the 0009 `stat_view` RLS (`status='approved'`), PLUS an explicit `where status='approved'` that still excludes pending for admin/service_role callers (who CAN see pending via BYPASSRLS/stat_admin). Proven behaviorally as both `anon` and `service_role`. Never SECURITY DEFINER.
- **AC4 rates = Σnum/nullif(Σden,0), numerator `::numeric`** so bigint/bigint doesn't floor. Two multi-match proofs (ADR 3000/38 ≠ 78.89 avg; entry_success 6/14 ≠ 0.3958 avg) pin sum-then-divide, never avg-of-per-match-ratios.
- **AC6 floors are CUMULATIVE, single-sourced:** `24`/`20` live once each in a `thresholds` CTE with the Epic-6 duplication-seam note. The pgTAP + live check both prove a 15-cumulative-round player is `eligible_rate=false` even with kills over the 20 floor (the "reads 0 because these are duels" / SM-C1-inverted trap avoided).
- **AC7 idle exclusion is per-match, not a ban:** `idle_dq=true` rows are dropped from totals AND `matches_played`; a player's non-idle matches still count.
- **AC9 NULL-safety homed here:** every int stat `coalesce(...,0)` before summing so a pre-Epic-5-shaped row (Epic-5 columns SQL NULL until re-parse) does not vanish through SUM/ORDER BY/WHERE; `clutches` deliberately NOT referenced (clutch board out of scope — Don Clutch retired), so no jsonb coalesce needed. `nullif(den,0)` makes a 0-opportunity ratio NULL, never a divide error.
- **`display_name` degradation confirmed a non-issue on our corpus:** `player` grants `anon`/`authenticated` SELECT (0002:71) under RLS `using(true)` (0002:51), so the LEFT JOIN resolves the name for viewers rather than degrading to NULL. No grant/policy added to `player` (out of scope).
- **Partial index** `stat_row_approved_idx on (steamid64) where status='approved'` — the earmark at 0007:52-54/0009:24; distinct from `stat_row_match_idx` and `stat_row_bracket_match_idx`.
- Pure DB slice — **no worker/app/lib/.ts change**. The read surfaces that consume the view are Stories 5.6/5.7.

### File List

- `supabase/migrations/0021_leaderboard.sql` (new) — the `public.leaderboard` view + `stat_row_approved_idx` partial index.
- `supabase/tests/0021_leaderboard_test.sql` (new) — paired pgTAP suite, `plan(21)`.
- `_bmad-output/implementation-artifacts/5-5-single-normalized-leaderboard-view-rpc.md` (modified) — frontmatter `baseline_commit`, task checkboxes, Dev Agent Record, File List, Change Log, Status.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — story status `ready-for-dev` → `in-progress` → `review`.

## Change Log

| Date | Change |
|---|---|
| 2026-07-27 | Story 5.5 implemented: migration `0021_leaderboard.sql` (plain `security_invoker=on` view over approved+non-idle `stat_row`, FR-21 cumulative floors, FR-22 rate/volume classing, AC9 NULL-safety) + earmarked partial index; paired pgTAP `0021_leaderboard_test.sql` (21 assertions). AC2 no-op verified (no edit to `approve_match`/`rollback_match`). Gate green (`supabase test db`: 22 files / 899 tests PASS) + live `anon` hand-check. Status → review. |

| 2026-07-27 | Code review (bmad-code-review, Opus 4.8, 3 layers). No view-SQL defect; all 10 ACs satisfied. 1 decision resolved (AC7 idle-only ⇒ keep "vanish", wording aligned) + 5 test-coverage patches applied to `0021_leaderboard_test.sql` (KAST% value, kill-floor isolation + exact 24/20 boundaries, adr/kast 0-round denominator NULL, entry 0-opportunity NULL, idle-only vanish). `plan(21)`→`plan(32)`; gate re-run green: 22 files / 910 tests PASS. 8 findings dismissed (incl. the Blind Hunter's only "High" — base grants exist in 0009/0002). Status review → done. |

## Review Findings

> Code review 2026-07-27 (bmad-code-review, Opus 4.8, 3 adversarial layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 10 ACs judged satisfied by the Acceptance Auditor; no correctness defect in the view SQL. Findings below are a decision on AC7 idle-only semantics + four mutation-survivor test-coverage gaps (the suite goes green even when a guarded value is broken — exactly the blind-suite trap the mutation-test-before-review standard exists to catch).

- [x] [Review][Decision → RESOLVED: keep current behavior] AC7 idle-only player: absent vs present-and-ineligible — A player whose *only* approved contributions are `idle_dq=true` produces zero rows in `agg` (`where idle_dq=false`), so they do **not** appear in the view at all. AC7's literal prose said such a player "is `eligible_rate = false`" (implying a visible, ineligible row). **Cuatro's call (2026-07-27): keep the current "vanish" behavior** — it is consistent with AC8 forfeit/bye hygiene (AD-9 "matches actually played") and avoids an all-zeros ghost row. Follow-ups: (a) tighten AC7 wording to match — done below; (b) add a pgTAP assertion documenting the absence — see patch below.
- [x] [Review][Patch] (APPLIED 2026-07-27) Document idle-only-player absence + align AC7 wording [supabase/tests/0021_leaderboard_test.sql] — seed a player whose only approved row is `idle_dq=true` and assert they produce **zero** leaderboard rows (locks the resolved D1 behavior against regression); update AC7 prose so "idle-only ⇒ eligible_rate=false" reads "idle-only ⇒ absent (no contributing rows), same posture as forfeit/bye (AC8)".
- [x] [Review][Patch] (APPLIED 2026-07-27) `meets_kill_floor` + exact floor boundaries (=24 rounds / =20 kills) never asserted [supabase/tests/0021_leaderboard_test.sql] — `meets_kill_floor` appears in zero assertions; `eligible_rate` is only tested where the *round* floor already fails (P_B), so the kill floor is never exercised in isolation and the `>=` boundary (exactly-24, exactly-20) is never pinned. Mutating `floor_kills` to 24, or flipping `>=`→`>`, leaves the whole suite green.
- [x] [Review][Patch] (APPLIED 2026-07-27) `kast_pct` entirely unverified — value and zero-denominator [supabase/tests/0021_leaderboard_test.sql] — `kast_pct` never appears in a single assertion. A broken KAST numerator/denominator or a broken 0-round `nullif` guard ships green. (ADR, HS%, entry are checked; KAST is the one rate column with no coverage at all.)
- [x] [Review][Patch] (APPLIED 2026-07-27) `adr` zero-denominator path untested [supabase/tests/0021_leaderboard_test.sql] — the only 0-denominator assertion is `hs_pct` (P_E, kills=0). `adr`/`kast_pct` share the *rounds* denominator, which the seed never drives to 0, so the `nullif(rounds_played_total,0)` guard for a 0-round player is asserted by AC9's comment but never actually exercised.
- [x] [Review][Patch] (APPLIED 2026-07-27) `entry_success` / `entry_opportunities` zero-opportunity path untested [supabase/tests/0021_leaderboard_test.sql] — P_E has entry_frags + opening_deaths both NULL→0, so `entry_opportunities=0` and `entry_success=nullif(0,0)→NULL` is reachable but unasserted; only P_A's nonzero 6/14 is checked. A divide-by-zero regression on the entry ratio ships undetected.

**Dismissed (8, recorded for audit):** Blind Hunter's only "High" — base-table grants missing under `security_invoker` — is a **false positive**: `stat_row` SELECT is granted to anon/authenticated at 0009:35 (+ `stat_view` policy 0009:30-31) and `player` at 0002:71 (+ `player_read` 0002:51); the migration correctly does not re-grant (out of scope). Also dismissed: `_pct` columns hold 0..1 ratios not percentages (documented machine-value intent, AD-24; app owns i18n/×100); "anon never sees pending-only" count=0 is weak but the sibling `→1` assertion distinguishes a blackout; two test-comment wording nitpicks; `security_invoker` asserted structurally *and* proven behaviorally by Section C; `adr_damage`=total-damage assumption verified correct; partial-index predicate narrower than the view WHERE (planner-usable, acknowledged non-defect); `eligible_rate` bundling the kill floor is faithful to AC6 (separate booleans exposed for per-board gating).
