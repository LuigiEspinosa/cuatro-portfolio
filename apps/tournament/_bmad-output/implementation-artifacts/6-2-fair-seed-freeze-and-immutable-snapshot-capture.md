---
baseline_commit: 01e3f5b8a7ca4ff0abf24b7ff4a7bd6bf3c3b78f
---

# Story 6.2: fair_seed freeze and immutable snapshot capture

Status: done

> Code review 2026-08-03: all 4 decision-needed resolved, all 22 patches applied, and AC4 closed out by
> re-driving the capture over the real 14-demo corpus with an extra never-played rostered player — both
> mandated verbatim rows are now on the record. pgTAP `plan(94)` → `plan(116)`; mutation matrix re-run at
> 10 mutations / 0 survivors. Gates: lint 0 · Vitest 558 · build 0 · pgTAP 1155 across 25 files · Go clean,
> `worker/` byte-untouched. Six items deferred to `deferred-work.md`, all with a named owning story.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **second story of the epic**
Traces: **FR-27** · **AD-13 (fair)**, **AD-15**, **AD-19** (+ AD-6, AD-17, AD-18, AD-20, AD-21, AD-22, AD-23)
Closes: `deferred-work.md:55` (approve), `:49` (rollback), `:35` (manual-score) · Epic-5 retro **Action Item #1** (integer-form rate contract) + **Action Item #2** (`ceremony_locked` guard)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want the fairness seed frozen and the deciding stats captured into an immutable snapshot at ceremony-lock,
so that the draw reads a fixed, integer-form contract that cannot change after the championship is decided.

## Acceptance Criteria

**AC1 — the seed is frozen at the crowning, from the final demo, and can never be re-rolled.**
**Given** the seed rule (AD-13, `ARCHITECTURE-SPINE.md:143`; FR-27, `prd.md:371-378`),
**When** the championship-deciding demo is Approved,
**Then** `tournament.fair_seed = SHA-256(final_demo_bytes)` is frozen **inside the same `approve_match` transaction that crowns the champion** (AD-6), is the lowercase-hex `demo.demo_sha256` of the demo bound to `tournament.final_match_id`, is **structurally distinct** from `roster_entry.bracket_seed`, is exposed under the published name `seed_hex`, and is **mechanism-enforced write-once** — a second write of a different value is refused by the database, not merely avoided by the caller.

**AC2 — the ceremony lock is real, it blocks the four mutating admin actions, and the snapshot is captured write-once under it.**
**Given** the snapshot rule (AD-15, `ARCHITECTURE-SPINE.md:153`),
**When** the ceremony locks,
**Then** a single audited RPC transitions `ceremony.state` `not_started → locked` under the tournament-wide row lock, captures `stat_snapshot` / `stat_snapshot_row` in that same transaction, and from that moment `approve_match`, `rollback_match`, `manual_resolve_match` and `curate_award_catalog` each return the typed refusal `ceremony_locked` **before any write** — and the snapshot tables remain append-only for every role including `service_role` (no UPDATE/DELETE grant is added, ever).

**AC3 — the snapshot is the verifier's complete, integer-form contract.**
**Given** AD-19 (`ARCHITECTURE-SPINE.md:173`),
**When** the snapshot is written,
**Then** `stat_snapshot_row` holds, **per rostered player**: volume stats as integers; rate stats as `{num, den}` **integer pairs** (never a pre-divided `numeric`, never a float); the secondary stat; efficiency as `{num, den}`; per-opponent head-to-head deciding values; `achievement_ts` as an integer with a **published absent-sentinel**; and the eligibility inputs `rounds_played`, `kills`, `idle_dq` — and `stat_snapshot.content_sha256` is a deterministic hash of exactly those bytes.

**AC4 — the snapshot is measured, not narrated.**
**Given** the project doctrine *measure zeros, never narrate them* (Epic-5 retro; 5.2a's dead `AttackerBlind`; 6.1's clone probe),
**When** the capture is built,
**Then** a real snapshot is captured over the real 14-demo corpus and its shape and contents are **printed and recorded in Completion Notes** — per stat key: populated/empty; per player: `rounds_played`, `kills`, `idle_dq`, and **whether they clear `floor_rounds = 24` / `floor_kills = 20`**. A capture that produces zero eligible players is a **recorded finding handed to 6.4/6.5**, not a silent pass.

**AC5 — the draw reads only the snapshot.**
**Given** AD-15's "never live `stat_row`",
**When** the capture completes,
**Then** the snapshot is self-sufficient: every input Stage-2 (6.4) and the FR-29 ladder (6.5) consume is present in `stat_snapshot_row`, and no Epic-6 read path added by this story touches `stat_row` or `public.leaderboard` at draw time.

## Tasks / Subtasks

> **Order matters.** Task 1 (schema) → Task 2 (freeze) → Task 3 (capture) → Task 4 (guards) → **Task 5 (MEASURE) gates sign-off**. Do not claim AC3/AC4 from a synthetic fixture; the corpus is real and it is in [demos/](demos/).

- [x] **Task 1 — Migration `0024_ceremony_lock_snapshot.sql`: the `ceremony` table + the seed's write-once teeth (AC: 1, 2)**
  - [x] Header block in the 0023 house style: file-path line, "Logical migration 0024 — <slice> (Story 6.2, FR/AD refs)", the ⭐ thesis paragraph, the SQLSTATE declaration, and an explicit **OUT OF SCOPE — do NOT add here** list naming the owning story for every deferral (see *Scope boundaries* in Dev Notes). `0024` is the next free number (HEAD is `0023_award_catalog.sql`); **never edit an applied migration**.
  - [x] Create `ceremony` **exactly** per [SOLUTION-DESIGN.md:175-185](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L175-L185) — same column names, types, defaults, and the four-value `state` CHECK (`not_started`/`locked`/`spinning`/`complete`). `algorithm_version`, `spin_plan`, `luck_weight_table` land as **shells** (created, never written by this story) — the same shell precedent 0003 set for `stat_snapshot`. Add `unique (tournament_id)` (one ceremony per tournament in v1, AD-18 scope).
  - [x] `alter table public.ceremony add constraint ceremony_snapshot_fk foreign key (snapshot_id) references public.stat_snapshot(id);` — this exact statement is the one [0003_audit_snapshot.sql:11-12](supabase/migrations/0003_audit_snapshot.sql#L11) deferred to Epic 6 by name. It belongs **here**.
  - [x] Name every CHECK (`ceremony_state_valid`, …) — all CHECKs raise `23514`, and pgTAP asserts the **name**, not the code (the trap 4.3's review found across three suites and 6.1 re-hit).
  - [x] `ENABLE` + **`FORCE`** RLS on `ceremony`; `create policy ceremony_admin_read on public.ceremony for select to authenticated using ((select public.is_admin()));` — mirror [0003_audit_snapshot.sql:68](supabase/migrations/0003_audit_snapshot.sql#L68) byte-for-byte, `(select …)` wrapper included. **NO anon/authenticated grant** (AD-22: 6.8 later *widens* this with the reveal-gated policy; 6.2 ships the strictly-closed end state). `grant select, insert, update on public.ceremony to service_role;` — **no DELETE** (a ceremony is not deleted; 6.4/6.8 need UPDATE for `state`/`spin_plan`).
  - [x] ⭐ **`tournament.fair_seed` gets its teeth here, not in 0001.** Add `alter table public.tournament add constraint tournament_fair_seed_hex check (fair_seed is null or fair_seed ~ '^[0-9a-f]{64}$');` (the shape [review-data-integrity.md:371-379](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/reviews/review-data-integrity.md#L371) asked for and 0001 deferred). ⚠ **Clean-apply check first** (the 4.3 trap, `0017:80-86`): grep-prove nothing writes `fair_seed` today so every existing row is NULL and the immediate validated CHECK applies — `lib/bracket/generate.test.ts:343` is a live test asserting bracket generation never touches it.
  - [x] ⭐ **Write-once trigger** `tournament_fair_seed_write_once` — `before update on public.tournament for each row when (old.fair_seed is not null and new.fair_seed is distinct from old.fair_seed)` → `raise ... using errcode = 'IC908'` (next free in the reserved `IC9xx` space; `IC901`–`IC907` are taken — declare `IC908` in the header) with a `hint`. This is AD-13's *"never re-rolled"* made **mechanism-enforced**: `service_role` has BYPASSRLS so a policy cannot hold this line, and a trigger can. Trigger functions get **no** `revoke` (`0017:216-217` — not invocable, not PostgREST-exposed).
  - [x] ⚠ **The trigger must permit `NULL → value` and `value → same value`.** A rollback-then-re-approve of the final match re-runs the freeze; re-writing the *identical* hash must be a no-op, not an IC908. Pin both directions in pgTAP.

- [x] **Task 2 — Migration `0024`: freeze `fair_seed` inside `approve_match` (AC: 1)**
  - [x] `create or replace function public.approve_match(...)` in `0024` — copy the shipped body from [0017_aprobar_publish.sql:235-463](supabase/migrations/0017_aprobar_publish.sql#L235) and make **only** the two changes this story owns (the freeze + the `ceremony_locked` guard from Task 4). **Do not** edit 0017. Do not refactor, re-order, or "improve" anything else; the review will diff this against 0017 and any unexplained delta is a finding.
  - [x] **Placement is load-bearing.** The freeze goes **after** the `advance_match` call at [0017:375](supabase/migrations/0017_aprobar_publish.sql#L375) and **before** the `audit_log` insert (~`0017:409`). Reason: `advance_match` is what crowns the champion and writes `tournament.final_match_id` ([0014_grand_final_reset.sql:601-605](supabase/migrations/0014_grand_final_reset.sql#L601), whose own comment says *"AD-13's fair_seed = SHA-256(final demo) needs this to know which demo is championship-deciding"*). Freeze before the advance and `final_match_id` is still NULL.
  - [x] The freeze, in words: re-read `tournament.final_match_id` under the lock already held; **if** it is non-NULL **and** equals `p_match_id` **and** `fair_seed is null` — resolve `match.demo_id → demo.demo_sha256` and write it. Nothing else triggers a freeze. `demo_sha256` is already lowercase hex `SHA-256(canonical .dem bytes)`, computed once in Go at ingest ([worker/ingest/ingest.go:66-70](worker/ingest/ingest.go#L66)) and re-verified on every re-parse ([worker/ingest/reparse.go:52-84](worker/ingest/reparse.go#L52)). **Do not re-hash anything. Do not touch the worker.**
  - [x] ⛔ **`demo.demo_sha256` is NULLABLE** — the admin manual-upload path never hashes ([0006_demo_hash_dedup.sql:12-15](supabase/migrations/0006_demo_hash_dedup.sql#L12)), and a `manual_resolved` final has no demo at all. **Do not raise, and do not silently write NULL.** Approve must still succeed (refusing the championship approve because the seed is unavailable is a far worse failure). Record the outcome explicitly in the `approve_match` audit `detail` as `fair_seed_frozen: true|false` (+ `reason: 'demo_unhashed'|'no_demo'` when false). The **fail-closed point is the ceremony lock** (Task 3's `seed_unavailable` refusal), not the approve.
  - [x] Extend the existing `approve_match` return payload with `fair_seed_frozen boolean` (and `seed_hex` when frozen). Additive only — no existing key renamed or removed, or 4.6b's callers and pgTAP break.
  - [x] ⚠ **Grand-final reset (AD-21) needs no special case, and say so in a comment.** `final_match_id` is written by whichever of the two `gf_order` rows actually crowned the champion, so "which demo is the final one" has exactly one answer by construction. The PRD leaves this ambiguous (`prd.md:373` says only "the final (championship-deciding) Match"); `0014` resolves it. Pin the reasoning where the next reader will look.
  - [x] ⚠ **A rollback of the frozen final does NOT un-freeze the seed.** AD-13 is *"published, never re-rolled"* — the write-once trigger is what makes that true, and `rollback_match` must not clear `fair_seed`. This is deliberate and testable: roll back the final, re-approve it, assert the seed is byte-identical and no IC908 fired.

- [x] **Task 3 — Migration `0024`: `lock_ceremony()` — the lock + the capture, one transaction (AC: 2, 3, 5)**
  - [x] Signature `public.lock_ceremony(p_tournament_id bigint, p_actor text) returns jsonb`, `language plpgsql security invoker set search_path = ''`. Follow the [0023:274-530](supabase/migrations/0023_award_catalog.sql#L274) / [0017:235-463](supabase/migrations/0017_aprobar_publish.sql#L235) ordering contract **exactly**: unlocked peek → every lock in ONE statement in canonical id order → re-read under the lock → **every guard before any write**, typed refusals RETURNED never raised → the literal `-- ── Past this line everything writes … (AD-6). ──` separator → BEFORE jsonb → writes → AFTER jsonb → exactly one `audit_log` insert → return.
  - [x] **The locks** (this is the AC's "SERIALIZABLE ceremony-lock" — see the DECISION in Dev Notes): `select 1 from public.tournament where id = p_tournament_id for update;` then `perform 1 from public.match m where m.tournament_id = … order by m.id for update;` then `perform 1 from public.stat_row s join public.match m on m.id = s.match_id where m.tournament_id = … order by s.id for update;` — the canonical-id-order idiom from `0011:160` / `0013:202` / `0017:265-270` / `0023:434`. Taking the tournament lock **before** reading state also closes the known weakness that `curate_award_catalog`'s lock-free `catalog_frozen` read has.
  - [x] **Typed refusals**, every one before any write, each with context keys: `no_tournament` · `already_locked` (`ceremony.state <> 'not_started'`) · `not_bracket_live` (`tournament.state <> 'bracket_live'`) · `champion_undecided` (`final_match_id is null`) · `seed_unavailable` (`fair_seed is null` — **this is where the unhashed/manual final fails closed**) · `no_roster` (zero `roster_entry` rows) · `empty_snapshot` (zero rows would be written).
  - [x] **Writes, in order:** insert `stat_snapshot` (header) → insert `stat_snapshot_row` (one per rostered player, Task 3b) → `update stat_snapshot set content_sha256` … ⛔ **NO.** `stat_snapshot` is append-only by grant (`0003:79` grants SELECT+INSERT only) and an UPDATE would 42501. **Compute `content_sha256` first, then insert the header with it.** Build the row set into a local variable/CTE, hash it, insert the header, insert the rows. Getting this order wrong is the single most likely way this task fails.
  - [x] Then `insert into public.ceremony (tournament_id, state, seed_demo_sha256, snapshot_id, started_at) values (…, 'locked', v_fair_seed, v_snapshot_id, now())` (or `update` if a `not_started` row already exists), and `update public.tournament set state = 'ceremony'`.
  - [x] ⚠ **`tournament.state = 'ceremony'` has a live viewer consequence.** `ceremonyUnlocked()` ([lib/feed/read.ts:83-89](lib/feed/read.ts#L83)) and [lib/realtime/status.ts:44](lib/realtime/status.ts#L44) both key on it — the Ceremonia nav tab **unlocks** and the live pill flips to `final`. `/ceremonia` is still the 5.7 `<Placeholder>` and that is correct (6.10 fills it). **Verify this at THE BAR; do not assume it.**
  - [x] Exactly one `audit_log` row, `action = 'start_ceremony'` — already the enumerated vocabulary at [0003:25](supabase/migrations/0003_audit_snapshot.sql#L25), which is uncapped `text` with **no CHECK**, so **no migration widening and 0003 stays untouched**. `detail` carries before/after per AD-17: `{before:{ceremony_state, tournament_state}, after:{ceremony_state, tournament_state, snapshot_id, content_sha256, seed_hex, row_count, eligible_count}}`. **Assert every key in pgTAP** — 4.2's review found a suite asserting one key while a typo in any other would have NULLed the whole payload with tests green.
  - [x] `revoke execute on function public.lock_ceremony(bigint, text) from public; grant execute on function public.lock_ceremony(bigint, text) to service_role;`
  - [x] **No realtime emit.** SPINE:230 names `match.approved`, `bracket.advanced`, `spin.reveal` — there is no `ceremony.locked` in the specified vocabulary and event names are *"server-authored, named by semantic change"*, never invented. Record the gap in Completion Notes for 6.8/6.10.

- [x] **Task 3b — the AD-19 row shape (AC: 3, 5)** ⛔ *the contract the whole epic is built on*
  - [x] **One `stat_snapshot_row` per `roster_entry` player — not one per player with approved stats.** A rostered player with zero approved rows still gets a row, zero-filled. 6.7's pity draw enumerates *"every non-fully-DQ'd player with an empty shelf"*; if the snapshot omits players, pity structurally cannot reach them. Order the insert by **byte-lex `steamid64`** (6.4's Stage-2 iteration order, `epics.md:1070`) so the capture order and the hash are deterministic.
  - [x] **Source the aggregate from `public.leaderboard`** (AD-20: standings have exactly one normalization site; nothing hand-rolls a second aggregate) **LEFT JOINed from `roster_entry`** so zero-stat players survive. ⭐ **Select ONLY the integer columns.** The view exposes both halves; `adr`, `kast_pct`, `hs_pct`, `entry_success` are pre-divided `numeric` and AD-19 forbids them in the snapshot. The integer halves are all present — this is the measured answer to **Epic-5 retro Action Item #1**, and Task 5 must confirm it against the real capture rather than restate it:

    | AD-19 rate stat | `num` (integer) | `den` (integer) | Source |
    |---|---|---|---|
    | `adr` | `adr_damage_sum` | `rounds_played_total` | [0021:69,66](supabase/migrations/0021_leaderboard.sql#L66) |
    | `kast_pct` | `kast_rounds_sum` | `rounds_played_total` | `0021:70,66` |
    | `hs_pct` | `hs_kills_sum` | `kills_total` | `0021:71,67` |
    | `entry_success` | `entry_frags_total` | `entry_opportunities` (`entry_frags_total + opening_deaths_total`) | `0021:84,108` |

  - [x] `stats_int` jsonb shape — pin it, and pin it once:
    ```
    { "volume": { "<key>": <int>, … },                 -- every volume key in the 0023 vocabulary
      "rate":   { "<key>": {"num": <int>, "den": <int>}, … },
      "secondary": { "<key>": <int | {"num","den"}>, … },
      "efficiency": { "<key>": {"num": <int>, "den": <int>}, … } }
    ```
    ⚠ **The catalog does not tell you which secondary/efficiency keys to capture.** `award.secondary_stat` / `eff_num_key` / `eff_den_key` exist as columns (0023) but the 6.1 seed **deliberately leaves them NULL** — `SeedAward` declares no such fields because the FR-29 rungs are 6.5's decisions (6.1 Review Findings, story:85). **Therefore capture the SUPERSET**: every key in the 0023 closed-set vocabulary, in its integer form. A snapshot that captures only what today's catalog names would be silently unusable the moment 6.5 fills a rung — and the snapshot is write-once, so there is no second chance.
  - [x] `h2h` jsonb — per-opponent deciding values (AD-19 / FR-29 rung 3, `prd.md:393`: *"head-to-head result where the two tied Players met in a completed Match … deterministically skipped when they never met"*). Shape: `{ "<opponent_steamid64>": { "<stat_key>": <int | {"num","den"}>, … }, … }`, aggregated over the matches the two players **shared** (`stat_row.match_id` equal, both `status='approved'`, both `idle_dq = false`). An absent opponent key **is** "they never met" — that is the skip signal, and it must be absence, not a zero. ⚠ The whole first tournament is 1v1 wingman (confirmed by Cuatro, 2026-07-21; the same fact behind 5.2a), so every match has exactly two players and `h2h` is dense and cheap — do not build for a 5v5 shape that does not exist.
  - [x] `achievement_ts bigint` — ⛔ **there is no source column for this; see the flagged DECISION in Dev Notes.** Default pin: `min(epoch_ms(stat_row.approved_at))` over the player's contributing approved rows; **absent-sentinel `-1`** when the player has no contributing row. The sentinel value must be **stated in a column comment and in Completion Notes** — AD-19 requires it *published*, and 6.9's bundle will carry it.
  - [x] `rounds_played` = `rounds_played_total` · `kills` = `kills_total` · both `0` for a zero-stat player (never NULL — NULL propagates through every comparison and would silently drop the player, the exact `deferred-work.md:16` hazard 0021 already coalesces against).
  - [x] `idle_dq boolean` — ⚠ **its meaning changes at this layer.** On `stat_row` it is per-match; `public.leaderboard` already excludes idle matches (`0021:88`). In the snapshot it means **"fully DQ'd"**: `true` when the player has **at least one** approved `stat_row` and **every** one of them is `idle_dq = true`. A player with a mix contributes their non-idle matches and is `false`. A rostered player with zero approved rows is `false` with zero stats (they are winless, not disqualified — 6.7 must still reach them). Write this reasoning into a column comment; it is the kind of definition that gets silently inverted by the next reader.
  - [x] `content_sha256` — deterministic and stated: `sha256` over the concatenation of each row rendered as canonical text, in byte-lex `steamid64` order, using `jsonb`'s own sorted-key normalization (`stats_int::text`, `h2h::text`) plus the scalar columns in a fixed order, separated by a byte that cannot appear in the payload. Write the exact recipe in a comment. ⚠ **This is not `bundle_sha256`** — RFC-8785 canonical JSON and the published commitment hash are **Story 6.9's** (`epics.md:1164`); 6.2's hash proves the captured bytes are the bytes, nothing more. Say so in the header so 6.9 does not inherit a false constraint.

- [x] **Task 4 — Migration `0024`: the `ceremony_locked` guard on all four RPCs (AC: 2)** — closes three `deferred-work.md` debts + Epic-5 retro Action Item #2
  - [x] `create or replace function` for **`approve_match`** ([0017:74-76](supabase/migrations/0017_aprobar_publish.sql#L74)), **`rollback_match`** ([0018_rollback_match.sql:67-69](supabase/migrations/0018_rollback_match.sql#L67)), **`manual_resolve_match`** ([0019_manual_score.sql:68-70](supabase/migrations/0019_manual_score.sql#L68)) — each gets `return jsonb_build_object('ok', false, 'reason', 'ceremony_locked', 'ceremony_state', v_cstate);` **before the first write**, alongside its existing typed refusals (`not_pending` / `not_resolved` / `not_manual_resolvable`). Copy each shipped body verbatim and add only the guard (plus Task 2's freeze in `approve_match`). Never edit 0017/0018/0019.
  - [x] **`curate_award_catalog`** — [0023:269-273](supabase/migrations/0023_award_catalog.sql#L269) says in so many words that 6.2 *replaces* its `catalog_frozen` state test with the real lock. Keep the refusal **reason string `catalog_frozen`** (`lib/awards/curate.ts:51-59` has it in the trusted-reason `Set` and `app/api/admin/awards/route.ts:33-42` maps it to 409 — changing the string breaks both, plus its pgTAP Section F). Change only what it tests: `exists (select 1 from public.ceremony where tournament_id = … and state <> 'not_started')` **OR** the existing `tournament.state in ('ceremony','closed')`. Keeping both is deliberate — `tournament.state='closed'` with no ceremony row must still freeze the catalog.
  - [x] `accept_anomaly` is explicitly **NOT** in this set ([0020_command_routes.sql:46-48](supabase/migrations/0020_command_routes.sql#L46)). Do not add a guard there.
  - [x] Read the lock state **under the lock each RPC already takes**, never before it.

- [x] **Task 5 — MEASURE the capture over the real corpus (AC: 3, 4)** ⛔ *blocking gate — sign-off requires these numbers*
  - [x] Reset the local stack, ingest all 14 `.dem.gz` from [demos/](demos/) (they are gzip `.dem.gz` — decompress or stream through `worker/ingest/decompress.go`), approve them, drive a real crowning so `final_match_id` and `fair_seed` land, then call `lock_ceremony` for real.
  - [x] ⚠ **Env traps, they will recur on this box** (hit at 6.1 Task 9, and before that at 5.x): WinNAT swallows DB port 54322 → elevated `net stop winnat; net start winnat`; Kong can remap to host `55321` while `supabase status` still prints `54321`. **Never change a repo file to work around either.**
  - [x] Dump and paste into Completion Notes: (a) the frozen `fair_seed` **and** the `demo_sha256` it came from, proving they are byte-identical; (b) `stat_snapshot` header incl. `content_sha256`; (c) **at least two full `stat_snapshot_row` rows verbatim** — one populated, one zero-stat — so the AD-19 shape is on the record, not described; (d) a per-key table: which vocabulary keys are populated vs zero across the roster; (e) **per player: `rounds_played`, `kills`, `idle_dq`, `meets_round_floor`, `meets_kill_floor`**.
  - [x] ⛔ **Expect (d) and (e) to be ugly, and report them anyway.** 6.1's code review measured, on this same corpus: `rounds_played` **min 10 / max 21** against `floor_rounds = 24`, and **0/28** players reaching `floor_kills = 20` — *"all twelve awards have zero eligible players"* (`6-1-award-catalog-and-buckets.md:126`). Also thin: `knife_kills` 1/28, `through_smoke_kills` 2/28, `blind_kills` 3/28, `wallbang_kills` 7/28 (`:127`). **6.2 does not fix the floors** (they are `0021:56`'s, a deliberate value-parity duplicate this story must not touch) — 6.2's job is to prove the *capture* is faithful and hand 6.4/6.5 the measured eligibility picture. A zero-eligible capture is a **correct snapshot of a real problem**; narrating past it is the failure.
  - [x] Assert the integer-form contract **by inspection of the captured jsonb**, not by reading the SQL: no `stats_int` leaf is a non-integer number; no rate key appears as a bare scalar. This is Epic-5 retro **Action Item #1**'s success criterion.
  - [x] Any number that disagrees with the recorded 5.1/5.2/5.2a/5.3/6.1 measurements is a **finding** — stop and report it, do not average it away.

- [x] **Task 6 — `lib/ceremony/*` + `app/api/admin/ceremony/route.ts` (AC: 2)**
  - [x] Mirror `lib/awards/` exactly (`lib/<domain>/{model,read,…}.ts` + `app/api/admin/<verb>/route.ts`): `lib/ceremony/lock.ts` — `import 'server-only'` on line 1, the `RpcResult` interface, the discriminated `{ok:true,…} | {ok:false, reason: <union>}` return, a `Set` of trusted reasons, `admin.rpc(...)`, **fail-closed on `error`**, **fail-closed on an unrecognised reason**, and **ok-payload shape validation before trusting it** — copy the structure of [lib/awards/curate.ts](lib/awards/curate.ts) line for line.
  - [x] The route **must** go through `handleAdminCommand` ([lib/admin/command-route.ts](lib/admin/command-route.ts)) — [lib/admin/route-coverage.test.ts](lib/admin/route-coverage.test.ts) reddens CI for any `app/api/admin/**/route.ts` that does not (only `match/grace` is exempt), and it pins `routeFiles.length >= 11`, so adding a route is safe but removing the envelope is not. Actor is **always** `gate.steamid64`, never the body.
  - [x] `parseBody` uses the shared **`isPositiveInt`** for `tournament_id` (`Number.isInteger(1e21)` is `true` — the bare check is the gap 4.2's review found).
  - [x] `STATUS_FOR` typed as `Record<Extract<Result,{ok:false}>['reason'], number>` so a new refusal without a status is a **compile** error: `no_tournament` 404 · `already_locked` 409 · `not_bracket_live` 409 · `champion_undecided` 409 · `seed_unavailable` 409 · everything else 400.
  - [x] `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
  - [x] Vitest against a faked client (the `lib/match/*.test.ts` / `lib/awards/curate.test.ts` pattern): every argument passed through, every refusal surfaced verbatim, **no write on refusal**.
  - [x] ⛔ **No viewer surface, no i18n string, no `/ceremonia` change.** The only user-visible consequence of this story is the nav tab unlocking, which is 5.7's already-shipped behaviour reacting to `tournament.state`.

- [x] **Task 7 — pgTAP `supabase/tests/0024_ceremony_lock_snapshot_test.sql` (AC: 1, 2, 3)**
  - [x] Explicit `plan(N)` with the count **accounted for section by section in a comment block**, and the accounting restated in Completion Notes (standing project rule — 6.1's review corrected a plan comment even though the total was right).
  - [x] Sections: **(A)** `ceremony` shape, every named CHECK bites, `FORCE` RLS, no anon/authenticated grant, `ceremony_snapshot_fk` exists. **(B)** `fair_seed`: the hex CHECK rejects non-hex/wrong-length/uppercase; the write-once trigger raises **IC908** on a changed value; `NULL → value` succeeds; `value → same value` is a no-op. **(C)** `lock_ceremony` happy path — snapshot header + one row per rostered player + `ceremony.state='locked'` + `tournament.state='ceremony'`. **(D)** one test per typed refusal, each proving **nothing was written** (no `stat_snapshot`, no `ceremony` transition). **(E)** the audit row: exactly one, `action='start_ceremony'`, correct actor, **every `detail` key asserted**. **(F)** write-once teeth: as `service_role`, `update`/`delete` on `stat_snapshot` and `stat_snapshot_row` → **42501** (0003's suite already proves this; re-assert it here so 0024 cannot regress it). **(G)** the four `ceremony_locked` guards — one test each for `approve_match`, `rollback_match`, `manual_resolve_match`, `curate_award_catalog` (the last still returning `catalog_frozen`), each proving the refusal wrote nothing. **(H)** AD-19 shape assertions on a captured row: `jsonb_typeof(stats_int->'rate'->'adr') = 'object'`, `num`/`den` both integral, a zero-stat player's row exists with `rounds_played = 0`, an absent `h2h` opponent key means never-met, `achievement_ts = -1` sentinel.
  - [x] Route every refusal probe through a `pg_temp.<probe>` wrapper (the 6.1 pattern, `0023_award_catalog_test.sql:98-105`) — `exception when others then return jsonb_build_object('ok',false,'reason','RAISED','detail',sqlstate)` — so a *raising* mutant reddens the one **named** test that owns that guard and writes nothing.
  - [x] **Mutation-test the suite before review** — standing rule, and Epic-5 retro Action Item #3 makes a reviewer-independent author-side pass a gate. For **each** CHECK, **each** typed refusal, the write-once trigger, the freeze block, all four `ceremony_locked` guards, and the audit INSERT: delete it, confirm a **named** test reddens, restore. A guard whose deletion leaves the suite green is not covered. Record the full mutation table in Completion Notes. Mutations inject inside the file's own transaction — DDL is transactional, so the terminating `ROLLBACK` undoes each one; no `db reset` per mutation.

- [x] **Task 8 — THE BAR: live-QA over the real seam (AC: 1, 2)**
  - [x] Over HTTP as a **real signed-in admin**: approve the championship match → **200** with `fair_seed_frozen: true` and a 64-hex `seed_hex`; `POST /api/admin/ceremony` → **200**; re-post → **409** `already_locked`; then `POST /api/admin/approve`, `/rollback`, `/manual-score`, `/awards` → **409** each, with `ceremony_locked` (`catalog_frozen` for awards) **and the data unchanged**. Post as a non-admin / signed-out → **403**.
  - [x] As **anon over PostgREST**: `select * from ceremony`, `select * from stat_snapshot`, `select * from stat_snapshot_row` → **42501** on all three. Paste the responses. Then **`curl` the served `/leaderboards` and `/ceremonia` HTML and grep for the `seed_hex`, the `content_sha256`, and any SteamID64 from the snapshot → 0 hits.** That grep is the AD-22 proof; a screenshot is not.
  - [x] Browser: the Ceremonia nav tab is now **unlocked** and `/ceremonia` renders the 5.7 placeholder without error; the live pill reads `final`. Confirm the leaderboards and the 12 locked award cards are unchanged.
  - [x] Confirm `audit_log` holds exactly one `start_ceremony` row with the acting admin's SteamID64 and the full `detail` payload.

- [x] **Task 9 — Gates + regression net**
  - [x] `npm run lint` (**0**) · `npm test` (baseline **537**, record the new total) · `npm run build` (**0**; every viewer route stays `ƒ` dynamic, none prerendered) · full pgTAP run (baseline **1039 across 24 files**; record the new total and confirm **all 24 prior suites still green**).
  - [x] `go build ./... && go vet ./... && go test ./...` clean — and confirm `worker/` is **untouched** (this story adds no Go).
  - [x] Confirm untouched: `public.leaderboard` (0021) and its `24`/`20` floor literals · `lib/awards/catalog.ts` and the 12 seeded awards · every viewer surface except the nav tab's state-driven unlock · migrations 0001–0023 (byte-identical).
  - [x] Diff `0024`'s four `create or replace` bodies against their 0017/0018/0019/0023 originals and paste the diff — it must contain **only** the guard, and (for `approve_match`) the freeze.

## Dev Notes

### ⚠ Three decisions taken at contexting — read these before writing SQL

**DECISION A — "SERIALIZABLE ceremony-lock" ships as the codebase's pessimistic ordered row-lock, not as an isolation-level change.**
The AC (`epics.md:1026`) and AD-15 (`SPINE:153`) both say *"under a SERIALIZABLE ceremony-lock"*. Two facts make the literal reading unbuildable and undesirable: (1) `set transaction isolation level serializable` **cannot be issued inside a PL/pgSQL function**, which is already inside a transaction — and every RPC in this codebase is a PL/pgSQL function; (2) SERIALIZABLE does not *block* anything — it detects conflicts and raises `40001` on one of the transactions afterwards. What the AC actually demands is *"blocks further approves/re-parses for that tournament during capture"*, and **blocking** is exactly what `for update` gives. `SERIALIZABLE` appears **zero times** in the entire codebase; `order by id for update` is the house pattern for this at `0011:160`, `0013:202`, `0017:265-270`, `0023:434`, each with a comment calling it *"SERIALIZE on the tournament row"*. So: ordered `for update` locks **during** the capture (Task 3) + the persistent `ceremony_locked` typed refusal **after** it (Task 4). Together they satisfy AD-15's intent completely. **Record this deviation explicitly in the migration header and in Completion Notes** — do not let a reviewer discover an unexplained gap between the AC's word and the code.

**DECISION B — the snapshot captures the full vocabulary superset, not the catalog's current keys.**
`award.secondary_stat` / `eff_num_key` / `eff_den_key` exist but are NULL in the 6.1 seed, deliberately: `SeedAward` declares no such fields because the FR-29 rungs are 6.5's decisions to make (6.1 story:85, Review Findings). A snapshot keyed off *today's* catalog would be silently unusable the moment 6.5 fills a rung — and `stat_snapshot_row` is **write-once**, so there is no repair path short of a whole new ceremony. Capture every key in the 0023 closed-set vocabulary in integer form. The cost is a slightly larger jsonb; the alternative is an unrecoverable contract break two stories out.

**DECISION C — ⛔ `achievement_ts` has no true source, and this needs Cuatro's call (see Questions).**
FR-29 rung 4 is *"earliest achievement timestamp"* (`prd.md:393`) and AD-19 demands it as an integer with a published absent-sentinel. Nothing in `stat_row` carries a per-achievement time — the parser records no per-event timestamps, and the only temporal columns available are `stat_row.approved_at`, `demo.archived_at`, and match ordering by `id`. **Recommended default (build this unless Cuatro says otherwise):** `min(epoch_ms(stat_row.approved_at))` over the player's contributing approved rows, sentinel `-1`. It is deterministic, monotone, published in the bundle, and therefore fully verifiable — which is all rung 4 structurally needs from a tiebreak. It is **not** semantically "when they achieved it", and the column comment plus Completion Notes must say so plainly rather than implying a precision that does not exist. Flagging it now beats 6.5 discovering the rung is a proxy.

### The freeze path, end to end

```
tournament.final_match_id      -- written by advance_match on crowning (0014:601-605)
  → match.demo_id              -- bound by bind_match_demo (4.6a, 0016)
    → demo.demo_sha256         -- lowercase hex SHA-256 of the .dem bytes, computed in Go
                               --   at ingest (worker/ingest/ingest.go:66-70, io.TeeReader,
                               --   single pass) and re-verified on every re-parse
                               --   (worker/ingest/reparse.go:52-84)
      → tournament.fair_seed   -- frozen here, write-once (IC908), published as seed_hex
```
`fair_seed` is `text` and nullable today ([0001_core_schema.sql:33](supabase/migrations/0001_core_schema.sql#L33)) with **no CHECK, no trigger and no writer anywhere in the repo** — confirmed by sweep. `bracket_seed` is an `int` on `roster_entry` ([0004_roster.sql:30](supabase/migrations/0004_roster.sql#L30)), a seeding *position*, not a hash: AD-13's *"never reused for each other"* is already true by type, and this story keeps it that way. [lib/bracket/generate.test.ts:343](lib/bracket/generate.test.ts#L343) is a live regression asserting bracket generation never writes `fair_seed` — **it must stay green.**

### The substrate you are completing, not creating

[0003_audit_snapshot.sql](supabase/migrations/0003_audit_snapshot.sql) (Story 1.4) already created `stat_snapshot` and `stat_snapshot_row` with their exact AD-19 columns, RLS ENABLE+FORCE, admin-read policies, and — critically — **`grant select, insert` only, no UPDATE/DELETE, for `service_role` too**. `0003:73-77` spells out why: `service_role` has BYPASSRLS, so *"the no UPDATE/DELETE policy rule does NOT stop it — grants do (BYPASSRLS skips row POLICIES, never table GRANTS)"*. That is the real teeth behind AD-15's write-once, it already exists, and `supabase/tests/0003_audit_snapshot_test.sql:119-123` already proves `42501`. **6.2 writes the rows. 6.2 does not touch the grants.** If you find yourself needing an UPDATE on `stat_snapshot`, the design is wrong — recompute before inserting (Task 3's `content_sha256` ordering).

`0003:15` names this story by number: *"Snapshot CAPTURE (SERIALIZABLE ceremony-lock + INSERT population + ceremony.state gating) -> Story 6.2 (AD-15)"*. `0003:11-12` reserves the `ceremony_snapshot_fk` statement for the Epic-6 migration. Both are yours.

### RPC house style — non-negotiable idioms

Read [0023_award_catalog.sql:274-530](supabase/migrations/0023_award_catalog.sql#L274) and [0017_aprobar_publish.sql:235-463](supabase/migrations/0017_aprobar_publish.sql#L235) **in full** before writing `lock_ceremony`. The contract:

- `security invoker` + `set search_path = ''` + every reference schema-qualified. `security definer` is only for anon-reachable reads (`award_catalog_count`, `0023:199-206`).
- **Unlocked peek first** to resolve scope/existence — it must not lock, or you take a lock out of canonical order (the 4.3 `40P01` deadlock lesson).
- **Every lock in one statement, canonical `id` order.**
- **Every guard before any write.** Typed business refusals are **RETURNED** as `{ok:false, reason:'<snake_case>', …context}`; genuine corruption **RAISES** with a custom `IC9xx` SQLSTATE + a `hint`. `IC901`–`IC907` are taken; **`IC908` is yours** (the write-once trigger) — declare it in the header.
- The literal separator comment `-- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──`.
- Exactly one `audit_log` insert per accepted call, with before/after in `detail`.
- `revoke execute … from public; grant execute … to service_role;`

**jsonb traps already paid for — do not re-discover them** (all from 6.1's review):
- `jsonb_typeof` is STRICT: a *missing* key yields NULL, `NULL <> 'string'` is NULL, and a NULL `IF` is FALSE — so a payload **omitting** a key falls through every guard. Use `coalesce(jsonb_typeof(v -> 'k'), '')` (`0023:349-357`).
- jsonb preserves scale: `"priority": 1.0` passes a `::numeric` guard then raises `22P02` at a bare `::int`. Use `trunc(x::numeric)::int` (`0023:472-480`).
- Never a bare `::int` off jsonb.

### Table/columns to create — copy the spine exactly

`ceremony`, per [SOLUTION-DESIGN.md:175-185](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L175-L185) — same names, types, defaults:

```sql
create table ceremony (
  id                bigint generated always as identity primary key,
  tournament_id     bigint not null references tournament(id) on delete cascade,
  state             text not null default 'not_started'
                      check (state in ('not_started','locked','spinning','complete')),
  seed_demo_sha256  text,                 -- = tournament.fair_seed, frozen at lock (AD-13)
  snapshot_id       bigint,               -- ceremony_snapshot_fk below; immutable (AD-15)
  algorithm_version text,                 -- SHELL — 6.9 writes 'inclusivcup-roulette-1.0.0'
  spin_plan         jsonb,                -- SHELL — 6.4/6.8
  luck_weight_table int[],                -- SHELL — 6.6
  started_at timestamptz, completed_at timestamptz
);
```
Do not rename, do not add columns beyond the named CHECKs and the `unique (tournament_id)`.

### Where every AD-19 field comes from — the anti-reinvention map

| AD-19 field | Source | Note |
|---|---|---|
| volume ints | `public.leaderboard` `*_total` columns (`0021:72-85`) | already `coalesce(NULL→0)` before summing |
| rate `{num,den}` | the four integer pairs tabled in Task 3b | **never** `adr`/`kast_pct`/`hs_pct`/`entry_success` (pre-divided `numeric`) |
| secondary | same integer columns, full vocabulary superset | DECISION B |
| efficiency `{num,den}` | same integer columns | DECISION B |
| `h2h` | per-`stat_row.match_id` join, both sides approved + non-idle | absence = never met |
| `achievement_ts` | `min(epoch_ms(approved_at))`, sentinel `-1` | DECISION C — flagged |
| `rounds_played` | `rounds_played_total` | `0` not NULL |
| `kills` | `kills_total` | `0` not NULL |
| `idle_dq` | derived: all approved rows idle | meaning differs from `stat_row.idle_dq` — comment it |

`stat_row`'s full column set is at [0007_stat_row.sql:35-50](supabase/migrations/0007_stat_row.sql#L35) plus `rounds_won` (`0016:113`) and the `match_id` FK (`0010:173-181`). The 0023 deciding-stat vocabulary (`0023:63-151`) is the closed set to mirror.

### Scope boundaries — write these into the 0024 header, then hold them

**Build:** `ceremony` table + `ceremony_snapshot_fk` · `fair_seed` hex CHECK + IC908 write-once trigger + the freeze in `approve_match` · `lock_ceremony()` + the AD-19 capture · the `ceremony_locked` guard on the four RPCs · `lib/ceremony/lock.ts` + `app/api/admin/ceremony/route.ts` · pgTAP `0024`.

**Do NOT build** (each with its owner):
- `spin`, `award_result`, `award_result_winner`, `verification_bundle` tables → **6.4 / 6.5 / 6.8 / 6.9**.
- Any PRNG, HMAC, `uniform_int`, weighted pick, `luck_weight_table` population, spin plan, draw, tie ladder, anti-sweep, pity → **6.3–6.7**. `worker/awards/` and `lib/roulette/` do not exist and must not be started here.
- The **viewer-facing** seed/bundle publication, `bundle_hash`, the commitment surface, and the reveal-gated RLS axis on `award`/`spin`/`award_result` → **6.8** (`epics.md:1140-1152`). 6.2 freezes `fair_seed` and names it `seed_hex` in the server contract; it publishes nothing to anon.
- RFC-8785 canonical JSON and `bundle_sha256` → **6.9**. 6.2's `content_sha256` is a capture-integrity hash only.
- Ceremony UI, wheel, reduced-motion parity → **6.10**. `/ceremonia` stays the 5.7 `<Placeholder>`.
- Golden vectors → **6.11** (but AD-19 requires 6.11's end-to-end vector be projected from a **real** captured snapshot — Task 5's dump is the artifact it will use, so record it well).
- **Any change to `public.leaderboard` or the `24`/`20` floor literals** (`0021:50-56`). They are a deliberate value-parity duplicate of `award.floor_*`; 6.4/6.5 own the floors question.
- Any Go / worker change. The hash already exists and is already verified.
- Un-freezing `fair_seed` on rollback; a forfeit-undo path; an `award_reveal` timeline writer (still unowned across all of Epic 6 — `deferred-work.md:81`, flag it again for 6.8/6.10).

### Testing standards

- **pgTAP** — `supabase/tests/0024_ceremony_lock_snapshot_test.sql`, one file per migration, explicit `plan(N)` accounted for section-by-section. Preamble: `begin; create extension if not exists pgtap with schema extensions; set local search_path = extensions, public;`, terminating `rollback`. Role switching via `set local role anon` / `set local role postgres`; `42501` is the grant gate. Assert constraint **names**, never bare SQLSTATEs, when several CHECKs share `23514`. Fixtures: `supabase/fixtures/live-qa-seed.sql`, `supabase/fixtures/live-qa-bracket-seed.sql`. **Baseline: 1039 assertions across 24 files, all green — all 24 must stay green.**
- **Vitest** — colocated `lib/**/*.test.ts` only ([vitest.config.ts:17](vitest.config.ts#L17) — a test under `app/` silently does not run). `server-only` is stubbed at `test/stubs/server-only.ts`. **Baseline: 537 passing.**
- **Go** — `go build ./... && go vet ./... && go test ./...`. Nothing to add; prove it clean and untouched.
- **Mutation pass before review** — Task 7. Non-optional.

### Stack

Pinned and current; **nothing new is introduced or permitted by this story**. Next.js `16.2.10` · React `19.2.7` · `@supabase/supabase-js` `2.110.0` · `@supabase/ssr` `0.12.0` · Vitest `4.1.9` · Node ≥ 20.9 · Postgres 15+ (Supabase) · Go 1.26.4. `lock_ceremony` is a plain `.rpc()` on the client already in use. No new dependency.

### Previous story intelligence — Story 6.1 (done, `01e3f5b`)

- **The doctrine that produced this epic's best work:** measurement gates the build. 6.1's Task 0 killed **3 of 12 proposed awards** by measuring, and its code review then found that the *replacements* had only been argued — so the reviewer measured all 66 pairs. 6.2's Task 5 is the same gate applied to the capture.
- **The floors hazard is inherited, measured, and 6.2 must re-measure it:** `rounds_played` min 10 / max 21 vs `floor_rounds = 24`; **0/28** reach `floor_kills = 20`. In 1v1 wingman `kills ≈ rounds_won ≈ ½ rounds_played`, so 20 kills means ~40 rounds — about three matches — before a player qualifies for any rate award (`6-1…md:126`).
- **Established file layout** (mirror it): `lib/awards/{catalog,curate,read}.ts` + `.test.ts` · `app/api/admin/awards/route.ts` · `supabase/migrations/0023_*.sql` + `supabase/tests/0023_*_test.sql`.
- **`import 'server-only'` on line 1** of every server module. 6.1's review found the one file holding all twelve award identities missing it. Its honest caveat: deleting it reddens **nothing** (it is bundler-enforced), so it needs a *pinning test*, not just the import.
- **`Object.freeze` is shallow** — 6.1 shipped a "frozen" catalog whose entries were all mutable. If `lib/ceremony/` exports a constant, deep-freeze it and pin it.
- **Copy convention:** `Bajas = kills`, `Muertes = deaths` (6.1 closed `deferred-work.md:255`). No viewer copy in this story, but do not regress it.
- **Gates measured at 6.1 sign-off:** lint 0 · Vitest 537 · build 0 · pgTAP 1039 / 24 files, `plan(111)` · Go clean · mutation matrix 45 + 9, **0 survivors** · THE BAR 27/27.
- ⚠ 6.1's Dev Notes quoted stale baselines (Vitest 461, pgTAP 924+) that the story then measured as higher. **Measure the baseline before you claim a delta.**

### Git intelligence — recent commits

`01e3f5b` (6.1, awards) · `64990db` (5.8, realtime nudge) · `eb53260` (5.7, viewer surfaces) · `fb02428` (5.6, timeline feed) · `f067362` (5.5, leaderboard view). The arc is consistent: **one migration per story, never edit an applied one, `create or replace` in the new file to change a shipped function, one pgTAP file per migration, colocated Vitest, a live-QA BAR, and a mutation pass before review.** Commit subject style: `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers** (global rule).

## Project Structure Notes

```
supabase/migrations/0024_ceremony_lock_snapshot.sql   NEW   ceremony + fair_seed teeth + lock_ceremony
                                                            + 4× create-or-replace guards
supabase/tests/0024_ceremony_lock_snapshot_test.sql   NEW   pgTAP, explicit plan(N)
lib/ceremony/lock.ts                                  NEW   thin RPC wrapper (lib/awards/curate.ts shape)
lib/ceremony/lock.test.ts                             NEW   Vitest, faked client
app/api/admin/ceremony/route.ts                       NEW   through handleAdminCommand (mandatory)
_bmad-output/implementation-artifacts/sprint-status.yaml  UPDATE
```
Untouched by construction: `worker/**` · `supabase/migrations/0001`–`0023` · `public.leaderboard` · `lib/awards/**` · every viewer route · `lib/i18n/es.ts`.

Naming follows the established `lib/<domain>/{model,read,…}.ts` + `app/api/admin/<verb>/route.ts` layout and the `NNNN_snake_case_slug.sql` / `NNNN_snake_case_slug_test.sql` migration pair. `0024` is the next free number.

## References

- Story ACs — [epics.md:1012-1032](_bmad-output/planning-artifacts/epics.md#L1012-L1032)
- **AD-13** (fair seed) — [ARCHITECTURE-SPINE.md:140-143](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L140-L143)
- **AD-15** (immutable frozen snapshot) — [ARCHITECTURE-SPINE.md:150-153](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L150-L153)
- **AD-19** (integer-form contract) — [ARCHITECTURE-SPINE.md:170-173](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L170-L173)
- AD-6 (one atomic transaction) — `ARCHITECTURE-SPINE.md:105-108` · AD-17 (append-only audit) — `:160-163` · AD-20 (one normalization site) — `:175-178` · AD-22 (reveal-gating) — `:185-188`
- Ceremony schema — [SOLUTION-DESIGN.md:175-245](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L175-L245)
- **FR-27** — [prd.md:371-378](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L371-L378) · FR-29 ladder inputs — `prd.md:388-395` · FR-21 floors — `prd.md:314-321` · FR-13/FR-14 — `prd.md:240-256` · FR-15 (retention + hash) — `prd.md:258-265` · Verifiability NFR — `prd.md:502`
- Seed & PRNG mechanism — [addendum.md:79-89](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md#L79-L89)
- Snapshot substrate + append-only grants — [0003_audit_snapshot.sql](supabase/migrations/0003_audit_snapshot.sql)
- `final_match_id` crowning — [0014_grand_final_reset.sql:595-605](supabase/migrations/0014_grand_final_reset.sql#L595-L605)
- `approve_match` — [0017_aprobar_publish.sql:235-463](supabase/migrations/0017_aprobar_publish.sql#L235) · `rollback_match` — [0018_rollback_match.sql](supabase/migrations/0018_rollback_match.sql) · `manual_resolve_match` — [0019_manual_score.sql](supabase/migrations/0019_manual_score.sql)
- Leaderboard integer halves + floors — [0021_leaderboard.sql:48-131](supabase/migrations/0021_leaderboard.sql#L48-L131)
- `curate_award_catalog` + the `catalog_frozen` honest partial — [0023_award_catalog.sql:269-530](supabase/migrations/0023_award_catalog.sql#L269)
- Admin command envelope — [lib/admin/command-route.ts](lib/admin/command-route.ts) · coverage guard — [lib/admin/route-coverage.test.ts](lib/admin/route-coverage.test.ts)
- Demo hashing (Go, do not touch) — [worker/ingest/ingest.go:66-70](worker/ingest/ingest.go#L66) · re-hash verify — [worker/ingest/reparse.go:52-84](worker/ingest/reparse.go#L52)
- Deferred debts this story closes — [deferred-work.md:35](_bmad-output/implementation-artifacts/deferred-work.md#L35), [:49](_bmad-output/implementation-artifacts/deferred-work.md#L49), [:55](_bmad-output/implementation-artifacts/deferred-work.md#L55)
- Epic-5 retro Action Items #1–#3 — [epic-5-retro-2026-07-28.md:89-93](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L89)
- Prior story — [6-1-award-catalog-and-buckets.md](_bmad-output/implementation-artifacts/6-1-award-catalog-and-buckets.md)

## Questions for Cuatro

Answer before or during Task 3b — everything else can proceed in parallel.

1. **`achievement_ts` (DECISION C).** There is no real per-achievement timestamp in the data. Recommended: `min(epoch_ms(stat_row.approved_at))` with sentinel `-1`, documented as a deterministic proxy. Alternatives: earliest contributing `match.id`, or `demo.archived_at`. Any of them makes rung 4 deterministic and verifiable; none of them is genuinely "when they achieved it". OK to ship the recommendation?
2. **Does `lock_ceremony` set `tournament.state = 'ceremony'`?** Recommended yes — it is the only writer of that state anywhere, it keeps 6.1's `catalog_frozen` coherent, and it is what unlocks the Ceremonia tab. Consequence: the tab unlocks the moment the snapshot is captured, showing the 5.7 placeholder until 6.10 lands. Acceptable, or should the lock and the tab-unlock be separate admin steps?
3. **The zero-eligible-players outcome.** If Task 5 measures 0 eligible players again (very likely on the current corpus), 6.2 records it and hands it to 6.4/6.5 as planned — it does **not** touch the `24`/`20` floors. Confirm that is still the call.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`) — BMad `dev-story` workflow, 2026-08-03.

### Debug Log References

- Task-5 measurement harness: `worker/cmd/qa62/main.go` (throwaway, **deleted before commit**; `go build ./... && go vet ./... && go test ./...` clean while present and after removal). It drove the REAL `ingest.RunCLI` — the real `io.TeeReader` SHA-256, the real `ingest.DemoinfocsParser`, the real `db.PgxStatRecorder` upsert — over all 14 `.dem.gz` against the local stack. Only the object store was in-memory (`store.FakeStore`); the hash is still taken over the decompressed `.dem` bytes, which is exactly AD-13's input.
- Mutation harness: **43** mutations injected inside the pgTAP file's own transaction (DDL is transactional, so the file's terminating `ROLLBACK` undoes each one — no `db reset` per mutation).
- Live-QA harness: a Node script minting **real** Supabase sessions for an admin and a signed-in non-admin (email/password user + `app_metadata.steamid64` + `app_role` row), serialised into the `@supabase/ssr` cookie (`sb-127-auth-token`, `base64-` + base64 JSON), driving the admin routes over HTTP. Deleted after the run.
- ⚠ The dev server was pointed at the **local** stack via process-env overrides (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` / keys); `.env.local` — which points at the hosted project — was **not modified** (Next.js does not override already-set env vars).
- Env traps: **no WinNAT interference this run** — DB on 54322, API on 54321 as printed.
- ⚠ `worker/cmd/qa54/` (Story 5.4's throwaway) is still in the tree. Not 6.2's to remove — flagged for whoever next uses the per-story harness slot.

### Completion Notes List

#### The three contexting questions — answered by Cuatro, 2026-08-03

1. **`achievement_ts` (DECISION C)** — ship `min(epoch_ms(stat_row.approved_at))` with the published absent-sentinel **`-1`**, documented as a deterministic **proxy**, not a real achievement time. Built as recommended; stated in the migration's DECISION C block and in the code comment at the capture.
2. **`tournament.state = 'ceremony'`** — yes, `lock_ceremony` writes it; the lock and the Ceremonia tab-unlock are ONE admin step. Built as recommended, and the unlock was **measured** at THE BAR (below), not assumed.
3. **Zero eligible players** — record it and hand it to 6.4/6.5; do **not** touch the `24`/`20` floors. Done: the capture measured **0/28** eligible and `0021`'s floor literals are byte-identical.

#### Two decisions taken during the build (beyond the three the story pinned)

- **DECISION D — `rounds_won` is the ONE vocabulary key `public.leaderboard` does not expose.** The 0023 deciding-stat vocabulary includes `rounds_won` (`0023:93`); `0021` exposes the integer form of every other key but has no `rounds_won_total` (verified by reading `0021:62-131`). Omitting it would make the snapshot unusable the moment 6.5 names that key, with no repair path (write-once). Changing 0021 is out of scope and it is a viewer surface. So 6.2 sums it in the SAME tournament-scoped CTE that already has to touch `stat_row` for `h2h`, `achievement_ts` and the snapshot-level `idle_dq` — none of which the leaderboard can answer either — using the **same predicate** the leaderboard uses (`status='approved' and idle_dq=false`, `0021:87-88`). This is not a second standings aggregate: no rate, no floor, no normalization is recomputed. ⚠ **Seam for 6.4/6.5:** if `rounds_won` is ever wanted on a viewer board, add `rounds_won_total` to 0021 and point this at it.
- **DECISION E — the lock order is `match` → `stat_row` → `tournament`, NOT tournament-first** (the story's Task 3 suggested tournament-first). Tournament-first is a textbook **ABBA deadlock** against `approve_match`, which locks every `match` row up front (`0017:266-270`) and only LATER writes `tournament.final_match_id` from inside `advance_match` (`0014:601-605`) — approve holds match and wants tournament; a tournament-first lock_ceremony would hold tournament and want match. Unlike `generate_bracket` (`0011:163-167`, which does lock tournament first) these two **can** run concurrently: both live in `bracket_live`. The stated benefit of the tournament lock is preserved in full — `state` / `final_match_id` / `fair_seed` are still RE-READ under the lock before any guard, which is what closes the weakness `curate_award_catalog`'s lock-free `catalog_frozen` read has.

Both are written into the 0024 header where the next reader will look.

#### The AD-19 `stats_int` shape, as shipped (DECISION B — the vocabulary SUPERSET)

```
{ "volume":     { <17 volume keys>: <int> },
  "rate":       { <4 rate keys>:    {"num": <int>, "den": <int>} },
  "secondary":  volume ∪ rate  — every key in its CLASS-shaped form (rung-1 lookup, no class branching),
  "efficiency": every key in the UNIFORM {num,den} form — a volume int v becomes {"num": v, "den": 1} }
```
`secondary` and `efficiency` are **derived from** `volume`/`rate` through the one helper `public.snapshot_efficiency_form(volume, rate)`, so there is exactly one place a key can be added and the four blocks cannot drift. The uniform efficiency form is what lets an FR-29 rung-2 ratio over **any two** vocabulary keys resolve by pure integer cross-multiplication with no division and no class branch (AD-14). `h2h` uses the same flat `volume ∪ rate` form per opponent.

A `den` of **0** is captured and preserved, never coalesced away: it means "no opportunity", which the integer-only consumer resolves as undefined/ineligible. Dividing here would be the bug.

---

### ⛔ Task 5 — THE MEASUREMENT (blocking gate), over the real 14-demo corpus

Corpus: **14 demos · 28 distinct SteamID64 · 204 counted rounds**, ingested clean through the real path (`anomalous=false` on 14/14 after the roster was seeded). The championship demo was approved through the **real** `approve_match`, whose folded-in `advance_match` crowned a champion and wrote `tournament.final_match_id` — so the freeze read a value the advance had just written, not a fixture.

**(a) THE SEED — byte-identical to the real demo's hash**

```
tournament.fair_seed  1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c
demo.demo_sha256      1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c   (ziivanto-sosa.dem)
byte_identical = t · final_match_id = that match · bracket = grand_final, gf_order = 2
```
The same digest was produced by two independent ingest passes of the same file — the hash is deterministic over the demo bytes, and nothing in 6.2 re-hashes anything.

**(b) THE SNAPSHOT HEADER**

```
stat_snapshot: id=1  tournament_id=1  content_sha256=1a6868c89970269ef5424b2c3c4e3e10b6d895cf151a5a336311bbb40cefa32f  rows=28
ceremony:      state=locked  seed_demo_sha256=1b3cd678…3279c  snapshot_id=1
               algorithm_version=NULL  spin_plan=NULL  luck_weight_table=NULL   ← the three SHELLS, untouched by 6.2
tournament:    state=ceremony
```
⭐ `content_sha256` came out **byte-identical across three independent captures** (the SQL drive, and two HTTP locks at THE BAR) and matched an **independent re-computation from the stored rows** — the digest covers exactly the bytes that were written, in byte-lex `steamid64` order.

**(d) PER-KEY — populated vs zero across the 28-player roster**

| key | players > 0 | Σ total |
|---|---|---|
| `deaths` · `entry_frags` · `kills` · `opening_deaths` · `rounds_played` · `rounds_won` · `matches_played` | **28/28** | 204 / 204 / 204 / 204 / 408 / 204 / 28 |
| `hs_kills` | 25/28 | 83 |
| `utility_damage` | 15/28 | 313 |
| `wallbang_kills` | 7/28 | 8 |
| `blind_kills` | 3/28 | 4 |
| `through_smoke_kills` | 2/28 | 2 |
| `knife_kills` | 1/28 | 1 |
| `assists` · `flash_assists` · `mvps` · `no_scope_kills` | **0/28** | 0 |

Rate keys: `adr` 28/28 non-zero numerator · `entry_success` 28/28 · `kast_pct` 28/28 · `hs_pct` 25/28. **Zero players have a zero denominator** on any rate key.

⭐ **Every one of these numbers reproduces 6.1's independently-measured corpus exactly** — the four MEASURED_EMPTY keys, and `knife_kills` 1 / `through_smoke_kills` 2 / `blind_kills` 3 / `wallbang_kills` 7 (`6-1…md:127`). Nothing disagrees with a recorded 5.1/5.2/5.2a/5.3/6.1 measurement.

**(e) PER PLAYER — eligibility inputs and BOTH FR-21 floors**

All 28 rows: `idle_dq = false`, exactly **1** h2h opponent (one match each), `achievement_ts` a real epoch-ms integer.

| | roster | clear `floor_rounds=24` | clear `floor_kills=20` | eligible for a rate award |
|---|---|---|---|---|
| | 28 | **0** | **0** | **0** |

`rounds_played` **min 10 / max 21** · `kills` **min 1 / max 12** · fully-idle-DQ'd players: **0**.

⛔ **THE FINDING, RECORDED AND HANDED TO 6.4/6.5 (unchanged from 6.1, now re-measured through the snapshot itself):** applied to this corpus, **all twelve awards have zero eligible players**. 6.2 does not touch the floors — they are `0021:50-56`'s deliberate value-parity duplicate — and `eligible_count = 0` is RETURNED by the RPC and written into the `start_ceremony` audit row rather than hidden. Per Cuatro (2026-08-03) this is a recorded hand-off, not a 6.2 defect: the corpus is a 28-player first round with one match each, and bracket winners accumulate rounds. **6.4/6.5 must verify the floors against the real bracket shape before the ceremony rather than assume it.**

**(c) TWO FULL ROWS, VERBATIM** — the most-decorated player and the thinnest. Abridged here to the distinguishing parts; the full `jsonb_pretty` output of both was captured in the run (each carries all four blocks with all 17 + 4 + 21 + 21 keys).

```jsonc
// 76561199115487374 — 21 rounds, 12 kills (the corpus maximum)
{ "steamid64": "76561199115487374", "snapshot_id": 1,
  "rounds_played": 21, "kills": 12, "idle_dq": false, "achievement_ts": 1785796208298,
  "stats_int": {
    "volume":     { "kills":12, "deaths":9, "assists":0, "mvps":0, "flash_assists":0, "utility_damage":0,
                    "knife_kills":0, "wallbang_kills":0, "through_smoke_kills":0, "no_scope_kills":0,
                    "blind_kills":0, "entry_frags":12, "opening_deaths":9, "rounds_won":12,
                    "rounds_played":21, "matches_played":1, "hs_kills":5 },
    "rate":       { "adr": {"num":1473,"den":21}, "kast_pct": {"num":12,"den":21},
                    "hs_pct": {"num":5,"den":12}, "entry_success": {"num":12,"den":21} },
    "secondary":  { …volume ∪ rate, 21 keys… },
    "efficiency": { "kills": {"num":12,"den":1}, …, "adr": {"num":1473,"den":21}, … } },
  "h2h": { "76561198442864348": { …the same 21-key flat form over the shared match… } } }

// 76561198286758497 — 10 rounds, 1 kill; every weird stat zero (the thinnest row)
{ "steamid64": "76561198286758497", "rounds_played": 10, "kills": 1, "idle_dq": false,
  "achievement_ts": 1785796208273,
  "stats_int": { "volume": { "kills":1, "deaths":9, …every weird key 0… },
                 "rate":   { "adr": {"num":329,"den":10}, "hs_pct": {"num":1,"den":1}, … } },
  "h2h": { "76561199121907337": { … } } }
```

⚠ **There is no ZERO-STAT rostered player in the real corpus** — all 28 rostered players played exactly one match, so the story's "one populated, one zero-stat" pair could not both be drawn from real data. The thinnest real row is shown instead, and the zero-stat case (a row that exists, zero-filled, `achievement_ts = -1`, `h2h = {}`, `idle_dq = false`) is proven by pgTAP Section H on a genuinely winless rostered player. **The zero-fill is what 6.7's pity draw depends on.**

**THE INTEGER-FORM CONTRACT, ASSERTED BY INSPECTION OF THE CAPTURED `jsonb`** (Epic-5 retro **Action Item #1**'s success criterion — measured, not restated from the SQL):

```
volume_non_integer_leaves       0
rate_bare_scalars               0
rate_non_integer_pairs          0
efficiency_malformed            0
secondary_key_count_mismatch    0
snapshot rows missing any vocabulary key in secondary/efficiency    0   ← AC5
```

**⚠ A STRUCTURAL FINDING ABOUT THE CORPUS ITSELF (for 6.4/6.5/6.11).** The 14 demos are a **28-player single round**, and `generate_bracket` bounds the field at **8–16** (`0014:174-177`). So the corpus **cannot** produce a demo-backed grand final through a legal bracket: there is no second-round demo to be championship-deciding. Task 5 therefore drove the crowning through a `grand_final` `gf_order=2` row bound to a real demo (real bytes, real hash, real parsed stats) with the other 13 first-round matches published by the status flip `approve_match` step 1 performs. The **freeze, the crowning and the capture are all real**; the bracket topology is the fixture. Story 6.11's golden vector should be projected from a capture over a corpus that has a real final, or the limitation stated on its face.

---

---

### ⛔ AC4 RE-MEASURED AT CODE REVIEW (2026-08-03) — the two obligations the story left open

Run with a throwaway harness (`worker/cmd/qa62rev/main.go`, deleted after the run; `go build ./... && go vet
./... && go test ./...` clean while present and after removal) driving the REAL `ingest.DemoinfocsParser`
over all 14 `.dem.gz`. No database: both questions are properties of the parsed corpus that the capture then
copies faithfully. **28 player-rows over 14 demos**, matching the story's own corpus exactly.

#### 🚨 THE CLONE PROBE — AC4's own "Given" clause named it and it had never been run

**SEVEN substantive exact-clone pairs. Six of the seventeen volume keys collapse into TWO independent values:**

```
kills == entry_frags == rounds_won == kast_rounds      (identical on 28/28 rows)
deaths == opening_deaths                               (identical on 28/28 rows)
```

The story's published table (d) was suggestive — Σ`kills` = Σ`deaths` = Σ`entry_frags` = Σ`opening_deaths` =
Σ`rounds_won` = 204 — but equal **sums** are not equal **values**. They are equal values, per player, on
every row. (The remaining clone pairs are all-zero × all-zero — the four 6.1 MEASURED_EMPTY keys — and are
not interesting.)

**Ranking power per key**, the other half of the question:

| verdict | keys |
|---|---|
| ⛔ cannot rank anyone (1 distinct value) | `assists` · `mvps` · `flash_assists` · `no_scope_kills` (all zero) · **`matches_played`** (every player played exactly 1) |
| ⚠ two buckets only | `knife_kills` (1/28 > 0) · `through_smoke_kills` (2/28 > 0) |
| 3 buckets | `wallbang_kills` (7/28) · `blind_kills` (3/28) |
| genuinely ranks | `adr_damage` (28 distinct) · `utility_damage` (14) · `kills`-and-its-clones (8) · `deaths`/`opening_deaths` (8) · `rounds_played` (7) · `hs_kills` (7) |

**What this costs, concretely:**
- ⛔ **DECISION D built a bespoke hand-rolled `stat_row` aggregate — and the whole AD-20 argument around it —
  for a key that is an exact clone of `kills`.** The deviation is not wrong, but its justification was never
  weighed against the fact that the key carries no information `kills` does not.
- ⛔ **`kast_pct` is degenerate with a kills-rate**: `kast_rounds/rounds_played` ≡ `kills/rounds_played`.
  Likewise `entry_success` = `entry_frags/(entry_frags+opening_deaths)` ≡ `kills/(kills+deaths)`.
- ⛔ **FR-29 rungs that pick between any two of these are decided before they are reached.** 6.5 must not
  treat them as independent tiebreakers. Combined with the separately-recorded fact that rung 4
  (`achievement_ts`) provably ties for duel opponents, the ladder has fewer working rungs than it appears.

#### 🚨 THE PER-PLAYER ELIGIBILITY TABLE (Task 5(e) — mandated, and previously shipped only as aggregates)

All 28 rows, `idle_dq = false` on every one:

| steamid64 | demo | rounds | kills | R≥24 | K≥20 |
|---|---|---:|---:|---|---|
| 76561198158667313 | gian-paisa | 12 | 3 | ✗ | ✗ |
| 76561198286758497 | ziivanto-sosa | 10 | 1 | ✗ | ✗ |
| 76561198305828891 | legit-nieblita | 11 | 9 | ✗ | ✗ |
| 76561198337771350 | kiko-juanyar | 14 | 5 | ✗ | ✗ |
| 76561198388441171 | cuatro-luisito | 15 | 9 | ✗ | ✗ |
| 76561198403397102 | andrey-farkas | 15 | 9 | ✗ | ✗ |
| 76561198442864348 | dan-gato | 21 | 9 | ✗ | ✗ |
| 76561198715329473 | lejhone-misty | 11 | 9 | ✗ | ✗ |
| 76561198841610702 | fox-fate | 21 | 9 | ✗ | ✗ |
| 76561198847461130 | gian-paisa | 12 | 9 | ✗ | ✗ |
| 76561199094120484 | samz-mafejavela | 14 | 5 | ✗ | ✗ |
| 76561199115487374 | dan-gato | 21 | 12 | ✗ | ✗ |
| 76561199119068785 | pipedu-mariana | 12 | 9 | ✗ | ✗ |
| 76561199121907337 | ziivanto-sosa | 10 | 9 | ✗ | ✗ |
| 76561199164002328 | andrey-farkas | 15 | 6 | ✗ | ✗ |
| 76561199176839714 | cuatro-luisito | 15 | 6 | ✗ | ✗ |
| 76561199194030650 | alzate-kamurai | 21 | 9 | ✗ | ✗ |
| 76561199197635748 | samz-mafejavela | 14 | 9 | ✗ | ✗ |
| 76561199224717580 | juan-shaggy | 14 | 9 | ✗ | ✗ |
| 76561199233012783 | lejhone-misty | 11 | 2 | ✗ | ✗ |
| 76561199248100368 | pipedu-mariana | 12 | 3 | ✗ | ✗ |
| 76561199250683038 | fox-fate | 21 | 12 | ✗ | ✗ |
| 76561199404795959 | kiko-juanyar | 14 | 9 | ✗ | ✗ |
| 76561199529848048 | riquelme-ada | 13 | 9 | ✗ | ✗ |
| 76561199761222301 | legit-nieblita | 11 | 2 | ✗ | ✗ |
| 76561199834726553 | juan-shaggy | 14 | 5 | ✗ | ✗ |
| 76561199837193023 | alzate-kamurai | 21 | 12 | ✗ | ✗ |
| 76561199843959571 | riquelme-ada | 13 | 4 | ✗ | ✗ |

`rounds_played` **min 10 / max 21** · `kills` **min 1 / max 12** · clear rounds floor **0/28** · clear kills
floor **0/28** · clear BOTH **0/28** · fully-idle-DQ'd **0**.

⭐ **Every number reproduces the story's own recorded measurement and 6.1's before it** — nothing disagrees
with a recorded 5.1/5.2/5.2a/5.3/6.1 figure, which is the standing rule for this table. The zero-eligible
finding stands, re-measured independently, and the `24`/`20` floors remain untouched.

#### ✅ THE TWO FULL VERBATIM ROWS (AC4 / Task 5(c)) — RE-CAPTURED, NOTHING ELIDED

The original run could not produce a zero-stat row because all 28 corpus players played exactly one match.
The capture was therefore **re-driven over the same real 14-demo corpus with ONE extra rostered player who
never played** (`76561190000000001`) — registered, never seated, no demo, no `stat_row`. Story 6.7's pity
draw enumerates *"every non-fully-DQ'd player with an empty shelf"*, so this is exactly the row the draw
depends on, and it now exists in REAL DATA rather than only in a pgTAP fixture.

Driven through the REAL path (`ingest.RunCLI` -> real `io.TeeReader` SHA-256 -> real `DemoinfocsParser`
-> real `PgxStatRecorder` -> real `bind_match_demo` -> real `approve_match` crowning -> real
`lock_ceremony`; only the object store was in-memory):

```
ingest        14 demos, 28 stat rows, anomalous 0/14
approve       {"ok":true,"champion":14,"fair_seed_frozen":true,
               "seed_hex":"1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c"}
tournament    fair_seed = 1b3cd678...3279c   final_match_id = 14
demo          demo_sha256 = 1b3cd678...3279c  (ziivanto-sosa.dem)   <- byte-identical
lock          {"ok":true,"snapshot_id":1,"row_count":29,"eligible_count":0,
               "content_sha256":"d39ea0ca9aaaf85aea863b7ea30bd4866b1db4cfcea7d073c4d34f49e65fbe5d"}
ceremony      state=locked  snapshot_id=1     audit: exactly 1 start_ceremony row, eligible_count 0
rows          29 = 28 corpus players + 1 never-played; exactly 1 row with rounds_played=0 and kills=0
```

⭐ **The frozen seed is byte-identical to the value the story recorded** and to `ziivanto-sosa.dem`'s hash,
reproduced from a completely independent ingest. `content_sha256` differs from the story's run, correctly
and expectedly: the row set is 29 rows rather than 28, and `achievement_ts` is wall-clock approval time
(see the DECISION C limitations above — the capture is reproducible from the STORED ROWS, never from the
corpus).

**ROW 1 of 2 — POPULATED.** `76561199115487374`, 21 rounds / 12 kills (the corpus maximum). All four blocks,
all 17 + 4 + 21 + 21 keys, plus the h2h opponent. Verbatim `jsonb_pretty`, nothing removed:

```jsonc
{
    "h2h": {
        "76561198442864348": {
            "adr": {
                "den": 21,
                "num": 1473
            },
            "mvps": 0,
            "kills": 12,
            "deaths": 9,
            "hs_pct": {
                "den": 12,
                "num": 5
            },
            "assists": 0,
            "hs_kills": 5,
            "kast_pct": {
                "den": 21,
                "num": 12
            },
            "rounds_won": 12,
            "blind_kills": 0,
            "entry_frags": 12,
            "knife_kills": 0,
            "entry_success": {
                "den": 21,
                "num": 12
            },
            "flash_assists": 0,
            "rounds_played": 21,
            "matches_played": 1,
            "no_scope_kills": 0,
            "opening_deaths": 9,
            "utility_damage": 0,
            "wallbang_kills": 0,
            "through_smoke_kills": 0
        }
    },
    "kills": 12,
    "idle_dq": false,
    "stats_int": {
        "rate": {
            "adr": {
                "den": 21,
                "num": 1473
            },
            "hs_pct": {
                "den": 12,
                "num": 5
            },
            "kast_pct": {
                "den": 21,
                "num": 12
            },
            "entry_success": {
                "den": 21,
                "num": 12
            }
        },
        "volume": {
            "mvps": 0,
            "kills": 12,
            "deaths": 9,
            "assists": 0,
            "hs_kills": 5,
            "rounds_won": 12,
            "blind_kills": 0,
            "entry_frags": 12,
            "knife_kills": 0,
            "flash_assists": 0,
            "rounds_played": 21,
            "matches_played": 1,
            "no_scope_kills": 0,
            "opening_deaths": 9,
            "utility_damage": 0,
            "wallbang_kills": 0,
            "through_smoke_kills": 0
        },
        "secondary": {
            "adr": {
                "den": 21,
                "num": 1473
            },
            "mvps": 0,
            "kills": 12,
            "deaths": 9,
            "hs_pct": {
                "den": 12,
                "num": 5
            },
            "assists": 0,
            "hs_kills": 5,
            "kast_pct": {
                "den": 21,
                "num": 12
            },
            "rounds_won": 12,
            "blind_kills": 0,
            "entry_frags": 12,
            "knife_kills": 0,
            "entry_success": {
                "den": 21,
                "num": 12
            },
            "flash_assists": 0,
            "rounds_played": 21,
            "matches_played": 1,
            "no_scope_kills": 0,
            "opening_deaths": 9,
            "utility_damage": 0,
            "wallbang_kills": 0,
            "through_smoke_kills": 0
        },
        "efficiency": {
            "adr": {
                "den": 21,
                "num": 1473
            },
            "mvps": {
                "den": 1,
                "num": 0
            },
            "kills": {
                "den": 1,
                "num": 12
            },
            "deaths": {
                "den": 1,
                "num": 9
            },
            "hs_pct": {
                "den": 12,
                "num": 5
            },
            "assists": {
                "den": 1,
                "num": 0
            },
            "hs_kills": {
                "den": 1,
                "num": 5
            },
            "kast_pct": {
                "den": 21,
                "num": 12
            },
            "rounds_won": {
                "den": 1,
                "num": 12
            },
            "blind_kills": {
                "den": 1,
                "num": 0
            },
            "entry_frags": {
                "den": 1,
                "num": 12
            },
            "knife_kills": {
                "den": 1,
                "num": 0
            },
            "entry_success": {
                "den": 21,
                "num": 12
            },
            "flash_assists": {
                "den": 1,
                "num": 0
            },
            "rounds_played": {
                "den": 1,
                "num": 21
            },
            "matches_played": {
                "den": 1,
                "num": 1
            },
            "no_scope_kills": {
                "den": 1,
                "num": 0
            },
            "opening_deaths": {
                "den": 1,
                "num": 9
            },
            "utility_damage": {
                "den": 1,
                "num": 0
            },
            "wallbang_kills": {
                "den": 1,
                "num": 0
            },
            "through_smoke_kills": {
                "den": 1,
                "num": 0
            }
        }
    },
    "steamid64": "76561199115487374",
    "snapshot_id": 1,
    "rounds_played": 21,
    "achievement_ts": 1785806642242
}
```

**ROW 2 of 2 — ZERO-STAT.** `76561190000000001`, the rostered player who never played. Verbatim, nothing
removed. Note `h2h {}`, `achievement_ts -1` (the published absent-sentinel), `idle_dq false` (winless,
NOT disqualified), every volume key `0`, every rate pair `{num:0, den:0}` **preserved rather than
coalesced away** (a zero denominator means "no opportunity", which the integer-only consumer resolves as
ineligible), and `efficiency` still in the uniform `{num,den}` form so an FR-29 rung-2 ratio resolves by
integer cross-multiplication with no division and no class branch:

```jsonc
{
    "h2h": {
    },
    "kills": 0,
    "idle_dq": false,
    "stats_int": {
        "rate": {
            "adr": {
                "den": 0,
                "num": 0
            },
            "hs_pct": {
                "den": 0,
                "num": 0
            },
            "kast_pct": {
                "den": 0,
                "num": 0
            },
            "entry_success": {
                "den": 0,
                "num": 0
            }
        },
        "volume": {
            "mvps": 0,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "hs_kills": 0,
            "rounds_won": 0,
            "blind_kills": 0,
            "entry_frags": 0,
            "knife_kills": 0,
            "flash_assists": 0,
            "rounds_played": 0,
            "matches_played": 0,
            "no_scope_kills": 0,
            "opening_deaths": 0,
            "utility_damage": 0,
            "wallbang_kills": 0,
            "through_smoke_kills": 0
        },
        "secondary": {
            "adr": {
                "den": 0,
                "num": 0
            },
            "mvps": 0,
            "kills": 0,
            "deaths": 0,
            "hs_pct": {
                "den": 0,
                "num": 0
            },
            "assists": 0,
            "hs_kills": 0,
            "kast_pct": {
                "den": 0,
                "num": 0
            },
            "rounds_won": 0,
            "blind_kills": 0,
            "entry_frags": 0,
            "knife_kills": 0,
            "entry_success": {
                "den": 0,
                "num": 0
            },
            "flash_assists": 0,
            "rounds_played": 0,
            "matches_played": 0,
            "no_scope_kills": 0,
            "opening_deaths": 0,
            "utility_damage": 0,
            "wallbang_kills": 0,
            "through_smoke_kills": 0
        },
        "efficiency": {
            "adr": {
                "den": 0,
                "num": 0
            },
            "mvps": {
                "den": 1,
                "num": 0
            },
            "kills": {
                "den": 1,
                "num": 0
            },
            "deaths": {
                "den": 1,
                "num": 0
            },
            "hs_pct": {
                "den": 0,
                "num": 0
            },
            "assists": {
                "den": 1,
                "num": 0
            },
            "hs_kills": {
                "den": 1,
                "num": 0
            },
            "kast_pct": {
                "den": 0,
                "num": 0
            },
            "rounds_won": {
                "den": 1,
                "num": 0
            },
            "blind_kills": {
                "den": 1,
                "num": 0
            },
            "entry_frags": {
                "den": 1,
                "num": 0
            },
            "knife_kills": {
                "den": 1,
                "num": 0
            },
            "entry_success": {
                "den": 0,
                "num": 0
            },
            "flash_assists": {
                "den": 1,
                "num": 0
            },
            "rounds_played": {
                "den": 1,
                "num": 0
            },
            "matches_played": {
                "den": 1,
                "num": 0
            },
            "no_scope_kills": {
                "den": 1,
                "num": 0
            },
            "opening_deaths": {
                "den": 1,
                "num": 0
            },
            "utility_damage": {
                "den": 1,
                "num": 0
            },
            "wallbang_kills": {
                "den": 1,
                "num": 0
            },
            "through_smoke_kills": {
                "den": 1,
                "num": 0
            }
        }
    },
    "steamid64": "76561190000000001",
    "snapshot_id": 1,
    "rounds_played": 0,
    "achievement_ts": -1
}
```

⛔ **Visible in Row 1, and now on the record: the clone finding.** `kills` 12 = `entry_frags` 12 =
`rounds_won` 12 = `kast_pct.num` 12, and `deaths` 9 = `opening_deaths` 9 — the same collapse the clone
probe measured across all 28 rows, here inside a single captured row.

**AC4 IS NOW MET.** Both mandated rows are on the record in full, the per-player eligibility table exists, and
the clone probe has been run. ⚠ The bracket-topology limitation is unchanged and still recorded: the corpus is
a 28-player single round and `generate_bracket` bounds the field at 8-16, so the 14 matches are a fixture
topology and the 13 non-championship matches were published by status flip rather than through
`approve_match`. The demos, hashes, parsed stats, binding, championship approve, crowning, freeze and
capture are all REAL. 6.11's golden vector still needs a corpus with a genuine final (deferred-work.md).

---

### Task 7 — pgTAP + the mutation matrix

`supabase/tests/0024_ceremony_lock_snapshot_test.sql`, **`plan(94)`, all green**, accounted for section by section (restated from the file's own header):

`A 16` `ceremony` shape/CHECKs/RLS/grants · `B 9` `fair_seed` hex CHECK + IC908 · `C 15` the real crowning + freeze + lock · `D 10` every reachable refusal, each writing nothing · `E 11` the audit row, **every** `detail` key · `F 4` the write-once 42501 teeth · `G 10` the four `ceremony_locked` guards · `H 19` the AD-19 row shape incl. an independent re-hash. **16+9+15+10+11+4+10+19 = 94.**

⚠ `empty_snapshot` is a **defensive backstop with no reachable probe**: the row set is exactly one row per ACTIVE roster entry, so a zero-row build implies a zero-active roster and `no_roster` fires FIRST. The suite asserts that **guard ordering** instead — the property that makes it unreachable — so a re-order or a divergence between the row set and the roster count reddens.

**MUTATION MATRIX — 43 mutations, 0 SURVIVORS** (observed red counts, 2026-08-03; each injected into the live objects inside the pgTAP transaction and the file re-run):

| mutation | red |
|---|---|
| drop `ceremony_state_valid` / `ceremony_tournament_key` / `ceremony_snapshot_fk` | 2 · 37 · 1 |
| `ceremony` NO FORCE rls · grant anon SELECT · grant service_role DELETE | 1 · 2 · 1 |
| drop `tournament_fair_seed_hex` · drop the IC908 trigger · IC908 trigger OVER-TIGHT | 6 · 3 · **48** |
| grant UPDATE on `stat_snapshot` · grant DELETE on `stat_snapshot_row` | 2 · 18 |
| approve: FREEZE removed · **FREEZE moved BEFORE the advance** · `ceremony_locked` guard removed · seed written from a re-hash | 39 · **39** · 1 · 3 |
| rollback / manual: `ceremony_locked` guard removed | 1 · 1 |
| curate: CEREMONY half removed · TOURNAMENT-STATE half removed | 4 · 3 |
| lock: each of the six typed refusals removed | 1 · 1 · 1 · 1 · 1 · 2 |
| lock: audit insert removed · audit `action` typo · audit `after.eligible_count` key typo | 11 · 11 · 1 |
| lock: `tournament.state` write neutered · ceremony row left `not_started` · snapshot ROWS insert neutered · `snapshot_id` not linked | 1 · 2 · 18 · 1 |
| shape: LEFT JOIN → INNER (drops the winless) · rate captured PRE-DIVIDED · `achievement_ts` sentinel 0 · `idle_dq` hard-false · **`idle_dq` ANY-idle instead of ALL-idle** · `contrib` keeps idle rows · `secondary` dropped to volume-only · efficiency `den` 0 | 7 · 2 · 1 · 1 · **1** · 1 · 1 · 1 |
| hash: `h2h` dropped from the digest input · rows hashed DESC · capture order not byte-lex | 1 · 1 · 1 |

⭐ **The mutation pass found TWO REAL HOLES in the suite and both were fixed by improving the SUITE, never the mutation:**

1. **`idle_dq` ANY-idle vs ALL-idle survived with 0 red.** The fixture had no player with a *mix* of idle and live rows, so an ANY-idle reading (which would disqualify anyone who ever went AFK once) passed every assertion. Fixed by adding a genuinely mixed player (`…807`: one idle row, one live) plus two assertions — `idle_dq = false`, and that they contribute **only** the live match's numbers (the idle match is excluded from the aggregate, in lockstep with `0021:88`).
2. **An over-tight IC908 trigger aborted the whole file at the FIXTURE'S OWN approve, producing 0 named failures.** The suite failed but could not say *which rule* was gone — exactly the blindness the standing rule exists to prevent. Fixed by moving the `pg_temp` probe wrappers above the fixture and routing the fixture's own `approve_match` (and the raw first-freeze `UPDATE`) through them, so a raising mutant now reddens **48** named tests instead of aborting.

### Task 8 — THE BAR (live-QA over the real seam)

Local stack (`supabase db reset` applied 0001→0024). Driven as a **genuinely signed-in admin** over HTTP against `next dev`, never as `service_role`.

```
200  POST /api/admin/ceremony (first lock)        {"ok":true,"snapshot_id":3,
                                                   "content_sha256":"1a6868c8…fa32f",
                                                   "seed_hex":"1b3cd678…3279c",
                                                   "row_count":28,"eligible_count":0}
409  POST /api/admin/ceremony (re-post)           {"error":"already_locked"}
409  POST /api/admin/approve                      {"error":"ceremony_locked"}
409  POST /api/admin/rollback                     {"error":"ceremony_locked"}
409  POST /api/admin/manual-score                 {"error":"ceremony_locked"}
409  POST /api/admin/awards                       {"error":"catalog_frozen"}
403  POST /api/admin/ceremony  signed-in NON-admin {"error":"forbidden"}
401  POST /api/admin/ceremony  signed OUT          {"error":"forbidden"}
400  POST /api/admin/ceremony  bad body            {"error":"invalid_body"}
404  POST /api/admin/ceremony  unknown tournament  {"error":"no_tournament"}
```
…and the data did not move: 1 snapshot · 28 snapshot rows · 0 awards · grand final still `resolved` · 28 approved stat rows · exactly **1** `start_ceremony` audit row carrying the full before/after payload with the acting admin's SteamID64.

⭐ **THE BAR FOUND A REAL DEFECT — the first run returned `500 write_failed` for approve / rollback / manual-score.** The DB refusal was correct, but `lib/match/{approve,rollback,manual-score}.ts` did not have `ceremony_locked` in their trusted-reason `Set`s, so each **failed closed to an opaque 500** instead of the 409 AC2 requires. That is the guard being right in the database and wrong end-to-end. Fixed in the three libs (reason union + trusted `Set`), the three routes (`STATUS_FOR` → 409), and pinned in the three Vitest suites' refusal lists so it cannot regress silently. This is the whole reason THE BAR exists; it is recorded rather than quietly folded in.

**As anon over PostgREST:**
```
GET /rest/v1/ceremony?select=*            401  {"code":"42501", … "GRANT SELECT ON public.ceremony TO …"}
GET /rest/v1/stat_snapshot?select=*       401  {"code":"42501", …}
GET /rest/v1/stat_snapshot_row?select=*   401  {"code":"42501", …}
GET /rest/v1/award?select=*               401  {"code":"42501", …}     (6.1's posture, unchanged)
GET /rest/v1/leaderboard?select=*         200  (the intended public viewer surface, 0021:137)
GET /rest/v1/timeline_feed?select=*       200  (the intended public viewer surface, 0017:143)
```

**The AD-22 grep over the SERVED HTML** (a grep, not a screenshot):

| page | bytes | `seed_hex` | `content_sha256` | SteamID64 |
|---|---|---|---|---|
| `/` | 21 454 | **0** | **0** | **0** |
| `/leaderboards` | 52 166 | **0** | **0** | 56 |
| `/ceremonia` | 17 816 | **0** | **0** | **0** |
| `/bracket` | 47 097 | **0** | **0** | **0** |

The seed and the capture hash reach **no** viewer surface. ⚠ The 56 SteamID64 hits on `/leaderboards` are **not a 6.2 leak**: `public.leaderboard` exposes `steamid64` and `0021:137` grants SELECT on it to `anon` by design (it is what `/jugador/[steamid64]` links on). Pre-existing and intended; stated here so the number is explained rather than discovered.

**The Ceremonia nav tab unlock — MEASURED, not assumed** (the story's explicit instruction). The same page, before and after the state flip:

```
BEFORE  tournament.state='bracket_live'
  <span class="…navitem …locked" aria-disabled="true">Ceremonia<span …
AFTER   tournament.state='ceremony'
  <a class="…navitem " href="/ceremonia">Ceremonia</a>
```
`/ceremonia` renders the Story-5.7 placeholder ("Próximamente / La ceremonia llega en la próxima entrega.") without error, and the live pill reads `final`. Leaderboards and the locked award block are unchanged.

### Task 9 — Gates

| gate | baseline (6.1) | this story |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` (Vitest) | 537 | **557** (+20; 36 files) |
| `npm run build` | 0 | **0** — every viewer route stays `ƒ` dynamic, only `/_not-found` is `○` |
| pgTAP | 1039 across 24 files | **1133 across 25 files**, all 25 green (+94 = exactly the new suite) |
| `go build ./... && go vet ./... && go test ./...` | clean | **clean**, and `worker/` is byte-untouched |

**Re-measured after the code-review patches (2026-08-03):**

| gate | at 6.2 sign-off | after review patches |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` (Vitest) | 557 | **558** (+1: the `seed_stale` refusal pinned in `lock.test.ts`; 36 files) |
| `npm run build` | 0 | **0** — every viewer route still `ƒ`, only `/_not-found` is `○` |
| pgTAP | 1133 / 25 files | **1155 across 25 files**, all green — the 0024 suite goes `plan(94)` → **`plan(116)`** (+22 = Section I) |
| Go | clean | **clean**, `worker/` byte-untouched (`git status` empty) |

**Untouched, confirmed by `git status`:** `supabase/migrations/0001`–`0023` · `public.leaderboard` and its `24`/`20` floor literals · `lib/awards/**` and the 12 seeded awards · `worker/**` · every viewer route · `lib/i18n/**`.

**The four `create or replace` diffs against their originals** were generated and reviewed. They contain **only** the guard — plus, for `approve_match`, the freeze — with two explained exceptions: `approve_match` additionally extends its audit `detail` and its **additive** return payload with the seed outcome (no existing key renamed or removed), and one comment in `manual_resolve_match` was re-pointed from "`match_manual_override_audited` (above)" to "(0019)" because the trigger is defined in 0019, not in 0024.

### Deliberate gaps recorded for later stories

- **No realtime event.** `SPINE:230`'s vocabulary is `match.approved` / `bracket.advanced` / `spin.reveal`; there is no `ceremony.locked` and event names are never invented. The viewer already learns the change from `tournament.state`, which `lib/realtime/status.ts:44` keys on. **Flagged for 6.8/6.10.**
- **`award_reveal` timeline_feed writer** — still unowned across all of Epic 6 (`deferred-work.md:81`). **Flagged again for 6.8/6.10.**
- **`stat_snapshot.content_sha256` is a capture-integrity hash only.** RFC-8785 canonicalization and `bundle_sha256` are **6.9's**; 6.9 must not inherit this recipe as a constraint (said in the 0024 header too).
- **`public.leaderboard` is tournament-BLIND** (`0021:86-89` groups every approved non-idle `stat_row` by `steamid64` with no tournament predicate). In v1 there is exactly one tournament (AD-18) so it coincides with 6.2's tournament-scoped CTEs. The day a second tournament exists, **0021 must gain the scope** — do not fix it by hand-rolling the aggregate in the capture.

### File List

**New**
- `supabase/migrations/0024_ceremony_lock_snapshot.sql`
- `supabase/tests/0024_ceremony_lock_snapshot_test.sql`
- `lib/ceremony/lock.ts`
- `lib/ceremony/lock.test.ts`
- `app/api/admin/ceremony/route.ts`

**Modified** — the six files THE BAR proved were needed to make AC2's `ceremony_locked` true end to end
- `lib/match/approve.ts` · `lib/match/rollback.ts` · `lib/match/manual-score.ts` (reason union + trusted-reason `Set`)
- `app/api/admin/approve/route.ts` · `app/api/admin/rollback/route.ts` · `app/api/admin/manual-score/route.ts` (`STATUS_FOR` → 409)
- `lib/match/approve.test.ts` · `lib/match/rollback.test.ts` · `lib/match/manual-score.test.ts` (the new reason pinned in each refusal list)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md`

**Created and deleted before commit (throwaway, per the established pattern)**
- `worker/cmd/qa62/main.go` (Task 5 harness) · a Node live-QA script (Task 8)
- `worker/cmd/qa62rev/main.go` (code-review clone probe + Task 5(e) table; `go build`/`vet`/`test` clean while present and after removal)

**Also modified by the code review (2026-08-03)**
- `supabase/migrations/0024_ceremony_lock_snapshot.sql` — DECISION F (write-once binds at publication); `seed_stale`; self-explaining `seed_unavailable`; the freeze in `manual_resolve_match`; `rollback_match` un-freezes; `curate_award_catalog` GUARD 1 takes the tournament row `for update`; `mark_walkover` copied forward with the `ceremony_locked` guard; `h2h` restricted to the active roster; the `on conflict` state predicate; the three missing `comment on column` statements; dead `'no_demo'` arm removed; DECISION A's three bad citations and DECISION D's misread scope boundary corrected
- `supabase/tests/0024_ceremony_lock_snapshot_test.sql` — `plan(94)` → `plan(116)`; two blind assertions fixed; one duplicate replaced; Section I added
- `lib/ceremony/lock.ts` · `app/api/admin/ceremony/route.ts` · `lib/ceremony/lock.test.ts` — the `seed_stale` reason threaded through the union, the trusted `Set`, `STATUS_FOR` (409) and the refusal list

### Review Findings

Code review 2026-08-03 — three layers (Blind Hunter · Edge Case Hunter · Acceptance Auditor) plus a
reviewer-independent mutation pass run against a freshly reset local stack (Epic-5 retro Action Item #3).

**Independently reproduced:** `plan(94)`, 94 ok / 0 red · the four `create or replace` bodies diffed against
0017/0018/0019/0023 with **no** unexplained delta · the three `lib/match/*.ts` + three routes really do pin
`ceremony_locked` → 409 · `0021`'s `24`/`20` floor literals untouched · Vitest +20 checks out arithmetically.

**⛔ REVIEWER MUTATION PASS — 6 mutations, 5 SURVIVORS** (the story's own matrix reported 43 / 0):

| mutation | red | |
|---|---|---|
| `kast_pct` rate pair: key `den` → `den_x` | **0** | SURVIVED |
| `rounds_won` → literal `0` (DECISION D) | **0** | SURVIVED |
| `achievement_ts`: `min` → `max` (DECISION C) | **0** | SURVIVED |
| approve freeze: `v_final is distinct from p_match_id` → `false` | **0** | SURVIVED |
| `demo_unhashed` guard removed | **0** | SURVIVED |
| `contrib` keeps idle rows | 1 | caught |

#### Decisions taken at review (Cuatro, 2026-08-03) — all four resolved

1. **The ceremony dead-end** → fix the one route that discards a seed it has (`manual_resolve_match` with a bound, hashed demo), and make the refusal self-explaining. Routes with genuinely no demo (plain manual, `mark_walkover`) keep failing closed at `seed_unavailable` — that is spec-sanctioned. **No admin-settable seed**: a human hand on the fairness seed is a bigger hole than the dead-end it would close.
2. **The stale seed** → both halves: detect at the lock (`seed_stale`) *and* remove the state at source (rollback clears `fair_seed` when it un-crowns). ⭐ **This reinterprets AD-13's "published, never re-rolled" as binding at PUBLICATION, not at first write** — safe because `ceremony_locked` already refuses rollback after the lock and 6.2 publishes the seed to nobody before it. Record the reasoning in the 0024 header and flag it for 6.8, which owns publication.
3. **`achievement_ts`** → keep `min(approved_at)`. ⚠ Corrected at review: switching to `min(match.id)` would **not** fix the duel tie (both players share the match), and would publish a bracket coordinate as a timestamp. The tie is structural — no match-level column can break it. Document both limitations and hand 6.5 a named blocker.
4. **Post-lock bracket mutation** → guard `mark_walkover` here (it is the one RPC that can falsify a committed seed); record the grace + `bind_match_demo` viewer-integrity remainder for 6.8.

<details><summary>Original decision-needed findings (resolved above)</summary>

- [x] [Review][Decision] **A hand-resolved or walkover championship permanently bricks the ceremony** — `manual_resolve_match` and `mark_walkover` both call `advance_match` and can write `tournament.final_match_id`, but the freeze lives only in `approve_match`. `lock_ceremony` then returns `seed_unavailable` forever: `approve_match` needs `pending`, `rollback_match` needs `resolved`, `manual_resolve_match` needs `declared/live/pending`, and `manual_resolved` is terminal until Story 4.8. Task 2 anticipated the *demo-less* manual final and routed it here by design — it did **not** anticipate the override shape (`manual_resolve_match` with a bound, hashed championship demo and `p_override = true`), where a real seed is available and still never frozen. Options: freeze in those paths too · ship an audited `set_fair_seed` escape hatch (the write-once trigger already permits NULL→value) · accept as a recorded v1 limitation.
- [x] [Review][Decision] **A championship that changes hands publishes the wrong demo's seed, permanently** — GF1 approved → `fair_seed = sha(D_gf1)`. `rollback_match` clears `final_match_id` but deliberately keeps `fair_seed` (0024:1355-1358). The final is then re-decided the other way / the AD-21 reset GF2 crowns the other player. On that approve `v_final = p_match_id` but `v_seed is not null`, so the "already frozen" arm reports `fair_seed_frozen: true` with the **old** demo's hash. `lock_ceremony` only tests `fair_seed is null`, accepts it, and writes it into `ceremony.seed_demo_sha256` and the audit row. IC908 then makes correction impossible. The column's own contract at 0024:254-256 becomes false and 6.9's verifier gets an unexplainable mismatch. (The *re-bind* variant is correctly closed — `bind_match_demo` refuses at 0016:191-196.) Resolution interacts with the decision above.
- [x] [Review][Decision] **`achievement_ts` ties every 1v1 pair and is admin-controllable** — `approve_match` stamps `approved_at = now()` (transaction timestamp) on every stat_row of the match in one statement, so both competitors of a wingman duel get a byte-identical value. `achievement_ts = min(approved_at)` therefore **cannot discriminate** between any two players whose earliest match was against each other — precisely the pairs an FR-29 rung-3-adjacent ladder reaches rung 4 for. Separately, the value is a function of the order an admin presses Aprobar, inside a ceremony whose premise (FR-27) is that nobody could influence it. DECISION C was approved on the grounds it is "deterministic, monotone and verifiable" — all true, and orthogonal to both consequences, neither of which was known at sign-off. The discarded alternative (earliest contributing `match.id`) has neither problem.
- [x] [Review][Decision] **Post-lock bracket mutation via the unguarded RPCs** — `mark_walkover` (0015:311), `begin_match_grace`/`resume_match` (0015:161,233) and `bind_match_demo` (0016:155) gate on *match* state only; none carries a `ceremony_locked` guard or excludes `tournament.state = 'ceremony'`. After the lock, `mark_walkover` on a still-`declared` node can advance the bracket and write a **new** `final_match_id`, re-opening the finding above from a second direction. The roster is correctly still frozen (`roster_entry_assert_mutable`, 0011:81-86). The four-RPC scope was deliberate; the `final_match_id` consequence is not acknowledged anywhere. ⚠ Reachability: the AD-21 reset creates BOTH `gf_order` rows, so an unplayed `gf_order=2` row can sit in `declared` after `gf_order=1` crowned. Post-lock it would also emit `bracket.advanced` and a `timeline_feed` entry — the bracket visibly moving *during* the ceremony.

</details>

**Patches arising from the four decisions:**

- [x] [Review][Patch] Freeze `fair_seed` in `manual_resolve_match` when a bound demo carries a hash — same guard shape as approve (`final_match_id = p_match_id and fair_seed is null and demo_sha256 is not null`) [supabase/migrations/0024_ceremony_lock_snapshot.sql:1519]
- [x] [Review][Patch] Make `seed_unavailable` self-explaining — distinguish "no demo was ever bound" from "a demo is bound but unhashed" in the refusal context [supabase/migrations/0024_ceremony_lock_snapshot.sql:412-414]
- [x] [Review][Patch] Add a `seed_stale` typed refusal to `lock_ceremony` — resolve `final_match_id → demo.demo_sha256` and refuse when it diverges from `fair_seed` [supabase/migrations/0024_ceremony_lock_snapshot.sql:412]
- [x] [Review][Patch] `rollback_match` clears `fair_seed` when it un-crowns the final; IC908 loosened to permit `value → NULL`; the publication-binding rationale written into the 0024 header and flagged for 6.8 [supabase/migrations/0024_ceremony_lock_snapshot.sql:246,1350-1358]
- [x] [Review][Patch] Document `achievement_ts`'s two limitations in the column comment and Completion Notes — it cannot separate duel opponents (structural, not a source problem), and it tracks admin approval order [supabase/migrations/0024_ceremony_lock_snapshot.sql:585]
- [x] [Review][Patch] `ceremony_locked` guard on `mark_walkover` — the one unguarded RPC that can move `final_match_id` after the seed is committed [supabase/migrations/0015_walkover_grace.sql:311]

**Patches from the review layers:**

- [x] [Review][Patch] AD-19 rate-pair assertion is NULL-blind — a pair missing `num`/`den` passes the very test that names it [supabase/tests/0024_ceremony_lock_snapshot_test.sql:727-737]
- [x] [Review][Patch] Volume integer assertion misses an integral-valued pre-divided numeric (`80.0000` == `trunc(80.0000)`) [supabase/tests/0024_ceremony_lock_snapshot_test.sql:722-726]
- [x] [Review][Patch] No value assertion for `rounds_won` (DECISION D) or `achievement_ts` (DECISION C) — the two hand-rolled aggregates [supabase/tests/0024_ceremony_lock_snapshot_test.sql:713-756]
- [x] [Review][Patch] The freeze's *conditioning* is untested — the fixture makes exactly one `approve_match` call and it is the final [supabase/tests/0024_ceremony_lock_snapshot_test.sql:271-320]
- [x] [Review][Patch] No fixture demo has a NULL `demo_sha256`, so the whole `demo_unhashed` path is unexercised [supabase/tests/0024_ceremony_lock_snapshot_test.sql:301-305]
- [x] [Review][Patch] Rollback-then-re-approve is never driven through `approve_match`, though the header says it is "pinned in pgTAP in both directions" [supabase/migrations/0024_ceremony_lock_snapshot.sql:170-172]
- [x] [Review][Patch] `curate_award_catalog`'s frozen check is a TOCTOU — it shares no lock with `lock_ceremony`; take the tournament row lock before GUARD 2, and correct the false "closes the weakness" claim [supabase/migrations/0024_ceremony_lock_snapshot.sql:1704-1710]
- [x] [Review][Patch] `on conflict do update` arm has no `state = 'not_started'` predicate — a future `spinning`/`complete` writer would be silently overwritten [supabase/migrations/0024_ceremony_lock_snapshot.sql:696-700]
- [x] [Review][Patch] `h2h` keys reference opponents with no snapshot row (soft-removed roster entries survive in `contrib`) [supabase/migrations/0024_ceremony_lock_snapshot.sql:520-529]
- [x] [Review][Patch] `empty_snapshot`'s "guard-ordering" test is a verbatim duplicate of the `no_roster` test; it pads `plan(94)` by one and cannot redden independently [supabase/tests/0024_ceremony_lock_snapshot_test.sql:558,579]
- [x] [Review][Patch] `'no_demo'` is dead code — the `not_bound` refusal already returned for `demo_id is null` [supabase/migrations/0024_ceremony_lock_snapshot.sql:989]
- [x] [Review][Patch] AC4 evidence gaps — **CLOSED.** The per-player 28-row eligibility table is recorded, the clone probe has been run, and the capture was **re-driven over the real corpus with an extra never-played rostered player** so BOTH mandated `stat_snapshot_row` rows are now on the record verbatim and unabridged (29 rows captured, seed byte-identical to the story's). The `snapshot_id: 3` vs `id=1` discrepancy is moot in the re-capture (`snapshot_id=1`, one header, one ceremony row) and remains simply unexplained in the original run's notes.
- [x] [Review][Patch] The clone probe AC4's own "Given" clause names was never run — the published data shows Σ`kills` = Σ`deaths` = Σ`entry_frags` = Σ`opening_deaths` = Σ`rounds_won` = 204 and one row with `kills=entry_frags=rounds_won=12`, `deaths=opening_deaths=9`, `kast_pct` and `entry_success` the identical `{12,21}`. DECISION D built a bespoke aggregate for a key that may be an exact clone of `kills`
- [x] [Review][Patch] DECISION A's citations are wrong on three counts (SERIALIZABLE appears at 0003:15; `0011:160`/`0013:202` are single-row locks, not `order by id`; the quoted comments do not say what is claimed). The engineering call itself is endorsed [supabase/migrations/0024_ceremony_lock_snapshot.sql:187]
- [x] [Review][Patch] "`content_sha256` reproducible across three captures" overclaims — all three ran over the same rows; `achievement_ts` (wall-clock approval time) makes re-ingest reproduction impossible in principle. Record for 6.9/6.11
- [x] [Review][Patch] DECISION D is justified via a misread scope boundary — the Dev-Notes boundary is about the `24`/`20` **floors**, not about adding a summed column to 0021

- [x] [Review][Defer] `public.leaderboard` is tournament-blind while `own`/`dq`/`h2h_pair` are tournament-scoped — one write-once row mixes global and scoped values [supabase/migrations/0024_ceremony_lock_snapshot.sql:592] — deferred, pre-existing (0021)
- [x] [Review][Defer] `ceremony.state`/`snapshot_id` have no transition constraint or write-once mechanism; "immutable (AD-15)" is convention, not teeth [supabase/migrations/0024_ceremony_lock_snapshot.sql:144,199] — deferred, 6.4/6.8 need UPDATE
- [x] [Review][Defer] 6.11's golden vector cannot be projected from this capture — the bracket topology was a fixture [_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md:452] — deferred, pre-existing corpus limitation
- [x] [Review][Defer] `ceremony_locked` guards for `begin_match_grace`/`resume_match`/`bind_match_demo` — post-lock they churn match state and push `timeline_feed` entries while the audience is watching the ceremony [supabase/migrations/0015_walkover_grace.sql:161,233] — deferred by decision, **intended home: 6.8** (it owns the reveal surface and the judgement about what the audience may see mid-ceremony)
- [x] [Review][Defer] FR-29 needs a deterministic **terminal** rung — rung 4 provably ties for duel opponents and no match-level column can break it [_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md:393] — deferred by decision, **intended home: 6.5** (named blocker, not a caveat)
- [x] [Review][Defer] `STATUS_FOR` numeric values are untested across all four admin routes — `ceremony_locked: 404` would compile and ship [app/api/admin/ceremony/route.ts:37] — deferred, pre-existing pattern

#### ✅ PATCHES APPLIED (2026-08-03) — and the mutation pass RE-RUN to prove they bite

All 22 patches applied. The suite goes **`plan(94)` → `plan(116)`**; the +22 are Section I, which exists
solely because of this review. The mutation matrix was then re-run — **10 mutations, 0 survivors**, including
all five that survived before:

| mutation | before | after |
|---|---|---|
| `kast_pct` rate pair: key `den` → `den_x` | **SURVIVED** | red=1 |
| `rounds_won` → literal `0` (DECISION D) | **SURVIVED** | red=2 |
| `achievement_ts`: `min` → `max` (DECISION C) | **SURVIVED** | red=1 |
| approve freeze condition → `if false` | **SURVIVED** | red=4 |
| `demo_unhashed` guard removed | **SURVIVED** | red=1 |
| `seed_stale` guard removed | *(new)* | red=2 |
| `h2h` roster filter removed | *(new)* | red=1 |
| manual-resolution freeze removed | *(new)* | red=2 |
| `rollback_match` keeps `fair_seed` (DECISION F reverted) | *(new)* | red=1 |
| `mark_walkover` ceremony guard removed | *(new)* | red=1 |

⚠ Two fixture defects surfaced while patching, both fixed and worth recording because each would have
silently weakened a guard:
1. **TNOR's `fair_seed` was an arbitrary `repeat('f',64)`** while its `final_match_id` pointed at TCER's grand
   final. The new `seed_stale` guard fires BEFORE `no_roster`, so TNOR started refusing `seed_stale` and the
   `no_roster` probe stopped probing anything. Fixed by making the fixture's seed the final's actual hash.
2. **Two `comment on column` statements Task 3b explicitly required (`achievement_ts`'s published sentinel and
   `idle_dq`'s inverted meaning) were never written** — `stat_snapshot_row` carried no column comment anywhere
   in the repo. Both are now in 0024, plus one for `h2h`'s absence-as-skip-signal.

**Dismissed as noise (7):** the 56 SteamID64 hits on `/leaderboards` (explained, intended `0021:137` anon grant) · `lock.test.ts`'s tautological `eligible_count: 0` case (the adjacent non-zero test covers it) · `parseBody` accepting extra keys (house style) · the rollback/manual allow-path default (0018/0019's suites make 14/17 such calls, so a `coalesce(…,'locked')` mutant reddens at full-run) · missing `DISTINCT` on the roster CTE (`unique(tournament_id, steamid64)` exists, 0004:34) · bare `::int` off jsonb in the snapshot insert (values are constructed in-function from integer columns) · `entry_success`'s two denominator forms (verified equal — `0021:108`).

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Code review: 4 decision-needed, 22 patch, 6 deferred, 7 dismissed. A reviewer-independent mutation pass found **5 survivors in 6 mutations**, including the AD-19 rate-pair assertion going green on a malformed pair, and no value assertion behind either DECISION C or DECISION D. |
| 2026-08-03 | Review decisions (Cuatro): freeze in `manual_resolve_match` + self-explaining `seed_unavailable`; **DECISION F** — write-once binds at PUBLICATION, so rollback un-freezes and `lock_ceremony` gains `seed_stale`; keep `achievement_ts` but document that it provably ties duel opponents and hand 6.5 a named blocker; guard `mark_walkover`, defer the grace/bind RPCs to 6.8. |
| 2026-08-03 | All 22 patches applied. pgTAP `plan(94)` → **`plan(116)`**; mutation matrix re-run at **10 mutations / 0 survivors**. Gates: lint 0 · Vitest **558** · build 0 · pgTAP **1155 across 25 files** · Go clean, `worker/` untouched. |
| 2026-08-03 | ⛔ **Clone probe run at review (it had never been run).** Measured over the real 14-demo corpus: `kills == entry_frags == rounds_won == kast_rounds` and `deaths == opening_deaths`, exact on 28/28 rows — six of seventeen volume keys collapse to two independent values, and `matches_played` cannot rank anyone. DECISION D's bespoke aggregate captures a clone of `kills`. Handed to 6.5 as a ladder-degeneracy finding. Task 5(e)'s per-player table also produced. |
| 2026-08-03 | Story 6.2 implemented. Migration `0024`: the `ceremony` table + the `ceremony_snapshot_fk` 0003 deferred by name; `tournament.fair_seed`'s hex CHECK + the `IC908` write-once trigger; the AD-13 freeze inside `approve_match` after the `advance_match` crowning; `lock_ceremony()` capturing the AD-19 integer-form snapshot under ordered row locks; the `ceremony_locked` guard on `approve_match` / `rollback_match` / `manual_resolve_match` and the real lock behind `curate_award_catalog`'s `catalog_frozen`. Plus `lib/ceremony/lock.ts` + `app/api/admin/ceremony/route.ts` and pgTAP `plan(94)`. |
| 2026-08-03 | Two build-time decisions recorded in the migration header: **D** — `rounds_won` is summed in the capture because `public.leaderboard` does not expose it; **E** — the lock order is `match` → `stat_row` → `tournament`, not tournament-first, to avoid an ABBA deadlock with `approve_match`. |
| 2026-08-03 | Mutation pass (43 mutations, 0 survivors) found two suite holes and both were closed in the SUITE: a missing mixed idle/live player, and probe wrappers that did not cover the fixture's own `approve_match`. |
| 2026-08-03 | THE BAR found `approve` / `rollback` / `manual-score` returning **500** instead of 409 `ceremony_locked` — the three libs did not trust the new reason. Fixed across the three libs, the three routes and the three Vitest suites. |
| 2026-08-03 | Task 5 measured the capture over the real 14-demo corpus: seed byte-identical to the demo hash, `content_sha256` reproducible across three captures and an independent re-hash, integer-form contract clean on every count, and **0/28 eligible players** — recorded and handed to 6.4/6.5 with the floors untouched. |

