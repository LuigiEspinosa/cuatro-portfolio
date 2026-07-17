---
baseline_commit: 13dc05f9577a1d5df32d7e426780cc8e500de2a6
---

# Story 4.6b: "Aprobar" atomic publish (publish side of FR-13)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **⚠ SEQUENCED AFTER [Story 4.6a](4-6a-bind-demo-to-match-and-demo-derived-score.md) — DO NOT START THIS FIRST.** 4.6a lands `stat_row.rounds_won` (the derived score) and `bind_match_demo` (which sets `match.demo_id` and reaches `state='pending'`). **This story's AC1 has no reachable precondition without it**: nothing else can produce `pending`, and `score_source_guard` (`0010:124-128`) forbids `score_source='demo_derived'` unless `match.demo_id` is already set — which only 4.6a's bind does.
> **SPLIT NOTE (Cuatro, 2026-07-16).** Story 4.6 was contexted whole, measured ~2-3x any prior story, and split. 4.6b keeps the **original 4.6 scope and all three epic ACs verbatim**; 4.6a took the absorbed Story-3.7 half. ⚠ **Naming deviation:** `4-6a`/`4-6b` break sprint-status's `number-number-name` key pattern — deliberate, flagged not accidental.

## Story

As an admin,
I want a single "Aprobar" action to publish stats, set the score, advance the bracket, post the feed entry, and recompute leaderboards atomically,
so that one tap produces consistent published truth with no half-applied state.

## Acceptance Criteria

**AC1 — the atomic transaction (AD-6, FR-13).**
**Given** the atomic-transaction rule, **When** the admin taps `Aprobar` on a `Pending` match, **Then** in ONE DB transaction: stat rows flip to `status='approved'` (`Aprobado`), the match `score_source='demo_derived'` and state becomes `Resolved`, the bracket advances (idempotent), a timeline feed entry is posted, and affected leaderboards are recomputed.

**AC2 — post-commit emit (AD-6, AD-11).**
**Given** the post-commit-emit rule, **When** the transaction commits, **Then** the realtime event is emitted only after commit (never mid-transaction).

**AC3 — the feed-post ownership split (FR-31).**
**Given** the feed-post ownership split, **When** Aprobar runs, **Then** posting the feed entry is part of this transaction; the feed *read* surface is owned by Epic 5 (Story 5.6).

_Traces: FR-13 (publish), FR-31 (post) · AD-6, AD-5_

**AC1's FOURTH CLAUSE, missing from the epic AC but real.** FR-13's third consequence (`prd.md:247`) — *"Approval is Admin-only (FR-4) and **recorded with who approved and when**"* — is absent from `epics.md:749-761`, but the columns ship (`stat_row.approved_by`/`approved_at`, `0007:48`) and the UX renders it (`mock-admin.html:449`: *"Por **Mara** · hace 0:51"*). Treat it as part of AC1.

---

## THE ONE-PARAGRAPH HEADLINE

**These three ACs read as pure integration, and two of the four effects are not integration at all.** Step (3), the advance, genuinely is — `advance_match` ships, and its `p_emit` parameter was added **for this caller by name** (`0013:826-830`). But step (4) posts to **`timeline_feed`, a table that does not exist and that nobody ever designed**: the string appears **exactly once** in the entire repository (`SOLUTION-DESIGN.md:374`, prose, inside a step list), with no DDL, no ERD entity, no columns, no RLS. Story 5.6 disclaims the write and points here; 5.5 claims only the *leaderboard* slice; Epic 4's declared slice is *"the `match` and `audit_log` migration slice"*. **No story creates it**, and no reviewer caught that, because the rubric marks FR-31 ✅ against AD-6/AD-11 — which govern **atomicity and realtime**, never the feed's *data shape*. Step (4)'s other half, *"recompute leaderboards"*, is the opposite problem: **a no-op you must not build**, because AD-20 resolved adversarial H3 by choosing *"one SQL view or RPC over `status='approved'` rows"*, and H3's own text says that means *"AD-6's 'recompute' reduces to 'no extra write'"* — the status flip **is** the recompute. Underneath all of it sits the one hard correctness point three reviews left here by name: **`advance_match` RETURNS `{ok:false}` — it does not raise — so an Aprobar that commits anyway ships a resolved, scored match with no advance**, the exact partial state the two-pass design exists to prevent.

---

## Developer Context — READ THIS BEFORE YOU TOUCH ANYTHING

### What already exists (do NOT rebuild it)

1. **`advance_match` is complete and takes `p_emit`** — the live definition is `0014_grand_final_reset.sql:357-364` (0015 does not touch it): `advance_match(p_match_id bigint, p_actor_steamid64 text, p_emit boolean default true)`. **`p_emit` exists for you specifically** (`0013:826-830`): *"When Story 4.6's Aprobar calls this INSIDE its own transaction it may fold the advance into its single `match.approved` message and pass `p_emit => false`. ⚠ DO NOT BUILD A SECOND EMITTER ANYWHERE."* **You are the first caller to use it.** 4.5 deliberately takes the opposite branch (`0015:271-272`) — correct for a forfeit, wrong for an Aprobar.
2. **`mark_walkover` (`0015:280-415`) is your template.** Same problem, solved once, code-reviewed clean: the canonical lock, the `{ok:false}` → RAISE, the audit row, the forwarding return. Copy its shape exactly.
3. **4.6a already bound the demo and reached `pending`** — `match.demo_id`, `demo.match_id`, `stat_row.match_id` are populated, and `stat_row.rounds_won` carries the derived tally. **Do not re-derive or re-bind.** Your job is the seat mapping + the publish.
4. **The AD-23 terminal guard ships** (`match_terminal_state_guard`, `0015:108-126`, `IC901`) — an Aprobar on a committed `bye`/`forfeit`/`void` is **already refused for free**. You owe the *other* half (DECISION G).
5. **`audit_log.action = 'approve'` is already the enumerated vocabulary** (`0003:25`, `SOLUTION-DESIGN:251`, AD-17 `SPINE:163`) — `action` is uncapped `text` with **no CHECK**. No migration.
6. **`match_format_audited` will NOT fire for you** — `0012:219` says so **by name**: its `WHEN` clause fires only on format-column changes, *"keeping it a no-op for 4.6 (`score_*`)"*. Verify, do not re-touch.
7. **The lib+route pattern is established** by 4.2/4.5. Mirror `lib/match/walkover.ts` + `app/api/admin/match/walkover/route.ts` exactly.

### The hand-offs prior reviews left this story, BY NAME (in `deferred-work.md`)

1. **⭐⭐ THE LOAD-BEARING ONE — `{ok:false}` does NOT roll back the CALLER (`deferred-work.md:145`).** Written *about you*, verbatim: *"if Story 4.6's Aprobar writes the score/demo/state, calls `advance_match`, receives `slot_taken`, and **commits anyway**, the result is a resolved match with a score and no advance."* 4.5 solved it by raising `IC902`. **Mint `IC903` and RAISE.** Do NOT change `advance_match` to raise — `0015:381`: *"4.6 depends on its RETURN semantics."*
2. **AD-23's guard is ASYMMETRIC (`deferred-work.md:11`) — intended home: this story.** ⚠ **Do NOT fix it the obvious way** — see DECISION G; that breaks Story 4.7.
3. **`score_source_guard` permits a score with NO provenance (`deferred-work.md:127`) — intended home: this story.** `score_a=16, score_b=14, score_source=NULL` passes today (the `score_source is null` disjunct short-circuits TRUE). ⚠ The deferral's citation `[0010:77-81]` is **stale** — it is at **`0010:124-128`**. ⚠ **No existing test covers that shape**, so tightening reddens nothing — you must add the assertion.
4. **`approved_by` becomes anon-readable the moment you write it (`deferred-work.md:96`).** `0009:35` grants `select` on `stat_row` to `anon, authenticated` **column-blind**, and `stat_view` exposes every `status='approved'` row. Deferred on "nothing is exposed today" — **you make it live.** Accepted for this casual private group; note it, do not re-litigate.
5. **`advance_match`'s five bare `P0001`s (`deferred-work.md:147`) are Story 4.9's**, not yours. Leave them.
6. **AD-17 asks for before/after and the sibling `advance` row has none (`deferred-work.md:149`).** You have a clean one — carry it.
7. **⭐⭐ NEW, FROM 4-6a's CODE REVIEW (2026-07-16) — A BINDING EXISTING DOES NOT MEAN IT IS VALID. Two items, one guard.** 4-6a binds `(match, demo)` on the admin's say-so; **nothing** verifies the demo has anything to do with the match. Both were homed HERE by name, and both are nearly free at the point where you resolve the seats — do them together, in Task 2's guard list:
   - **(a) The demo's players may not BE the match's competitors** (`deferred-work.md`, *"`bind_match_demo` does NOT verify that the demo's players ARE the match's competitors"*). Found at 4-6a's live-QA BAR: the random draw separated the demo's two real duelists and binding their demo to an unrelated match was **accepted**. You map `stat_row.rounds_won` onto `score_a`/`score_b` *via the seats*, so if the demo's ids are not the seats you have no answer — your `bad_score` guard catches the wholly-unrelated case, but **not a partial/superset overlap**. Assert `every stat_row.steamid64 ∈ {seat_a.steamid64, seat_b.steamid64}` and refuse.
   - **(b) The stat rows may not belong to `match.demo_id` at all** (`deferred-work.md`, the re-homed *"delete-missing is scoped by `match_id`, not `demo_id`"* item — retired from "dormant under AD-18" by 4-6a's own D5 fixture). A re-upload legitimately creates a second `demo` row sharing one `matchzy_match_id` (`0006`'s key is `unique(matchzy_match_id, demo_sha256)`), and `upsertStatRows` conflicts on `(matchzy_match_id, steamid64)` with `demo_id = excluded.demo_id` — so a re-parse can leave `match.demo_id = D_a` while every `stat_row.demo_id = D_b`, or (via `RecordReparse`'s delete, scoped by the EXTERNAL id) wipe a bound match's rows entirely. **This is exactly what data-integrity M5 (`review-data-integrity.md:285-314`) asks for and 4-6a's migration explicitly hands you**: assert `stat_row.demo_id = match.demo_id` **at approve time**. It costs one predicate and closes both a 3.6 item and M5.
   - ⚠ **Do NOT assume `rounds_won` is populated, either.** It is nullable, and every row parsed before 0016 has it NULL — 4-6a's `no_stats` guard counts row EXISTENCE, never the tally (deferred here by Cuatro at 4-6a's review). Your `bad_score` guard is the thing that catches it; make sure it tests for NULL, not just for a missing row.

### The mechanism, precisely — every ordering constraint below is load-bearing

1. **The canonical lock, UP FRONT, before the first write.** `advance_match` locks the whole bracket in one statement in `id` order (`0014:392-400`) — that is what makes a deadlock impossible *by construction* (the 4.3 review reproduced `40P01` against the old code). Write the match row first and you lock it **out of** that order and can deadlock a concurrent advance. `mark_walkover` solves it at `0015:297-317`: unlocked peek for `tournament_id` → the **byte-identical** `order by m.id for update` → read under the lock. Copy it. (`0013:562`'s *"DO NOT reintroduce a `for update` that runs BEFORE this one"* concerns locks **inside** `advance_match`; the same canonical lock taken by a caller is correct and is the shipped 4.5 pattern.)
2. **Flip the state BEFORE advancing.** `advance_match`'s result gate (`0014:414-425`) accepts **only** `state in ('bye','forfeit','resolved','manual_resolved')` **and** `winner_entry is not null`. It **refuses `pending` by name** — `0013:515-520`: *"advancing a Pending match is PRECISELY the 'advance racing the publish' the whole decision exists to prevent."* So: write `state='resolved'` + `winner_entry` + the score, **then** call `advance_match`.
3. **`score_source_guard` needs the demo already bound.** `demo_derived` REQUIRES `demo_id is not null` (`0010:124-128`) — 4.6a's bind is what satisfies it. If `demo_id` is NULL you are approving an unbound match: refuse, don't bind.
4. **One emit, after commit, by construction.** Call `advance_match(..., p_emit => false)` and emit exactly one `realtime.send(..., 'match.approved', 'tournament:<id>', false)` yourself. `realtime.send` writes a row in *your* transaction that Realtime ships off the replication slot only on commit — the emit **cannot outrun its own commit** (`0013:809-819`). That is AD-6's *"after commit only"*, satisfied structurally, not by ordering.

---

## Tasks / Subtasks

### Task 0 — Re-read the load-bearing code before editing (do not skip) (AC: all)
- [ ] `0014_grand_final_reset.sql:357-652` — `advance_match` end to end: the signature + `p_emit` (`:357-364`), the canonical lock (`:392-400`), the **result gate** (`:414-425`), the loser drop (`:430`), the AD-21 GF-1 conditional (`:436-445`), the pass-1/pass-2 boundary (`:575` — *"Past this line everything writes"*), `final_match_id` on a crown (`:601-605`), the return shape (`:648-650`), and every `{ok:false}` reason (`:389,411,418,424,538-541,551-554`).
- [ ] `0015_walkover_grace.sql:280-415` — `mark_walkover` **in full**. Your template. Especially the lock header (`:274-296`), the three-step opening (`:297-317`), the `{ok:false}`→`IC902` RAISE (`:372-387`), the audit row (`:393-405`), the forwarding return (`:407-413`).
- [ ] `0013_advance.sql:809-851` — the post-commit-by-construction rationale and the **exact `realtime.send` shape** to mirror.
- [ ] `0010_match.sql:46-128` — the `match` column set + `score_source_guard` (`:124-128`).
- [ ] `lib/match/walkover.ts` + `app/api/admin/match/walkover/route.ts` end to end — the lib (discriminated union → `Set` of reasons → SQLSTATE consts → fail closed) and route (`requireAdmin` → `parseBody`/`isPositiveInt` → `STATUS_FOR`) shapes.
- [ ] **Story 4.6a's shipped `0016`** — `bind_match_demo`'s guards and what `pending` means when you receive it. Do not duplicate its refusals.
- [ ] `ARCHITECTURE-SPINE.md:299-317` + `SOLUTION-DESIGN.md:370-383` (§8). **Confirm for yourself:** `Pending → Resolved: Aprobar`, and **`Resolved → Pending: rollback`** — `resolved` is deliberately **NOT** terminal.

### Task 1 — Schema: the feed + the two guards (migration `0017_aprobar_publish.sql`) (AC: 1, 3)
- [ ] New `supabase/migrations/0017_aprobar_publish.sql`. Header in the house style: the ONE concern, SCOPE, OUT-OF-SCOPE (each with its owning story), and the SQLSTATE table.
- [ ] **⭐ CREATE `timeline_feed`** (DECISION C). **No shell to inherit** — the first table since Epic 1 with no prior art. The name is the one thing that IS specified (`SOLUTION-DESIGN.md:374`).
  ```sql
  create table timeline_feed (
    id            bigint generated always as identity primary key,  -- ⭐ ALSO the deterministic ordering key
    tournament_id bigint not null references tournament(id) on delete cascade,  -- AD-18
    entry_type    text not null check (entry_type in ('match_result','bracket_advance','award_reveal')),  -- FR-31's three
    occurred_at   timestamptz not null default now(),
    target_match_id bigint references match(id) on delete set null,  -- never CASCADE (0010:189-194)
    detail        jsonb not null
  );
  create index timeline_feed_tournament_idx on public.timeline_feed (tournament_id, id desc);  -- the newest-first read (5.6)
  ```
  - **⚠ `id` is the ordering key, NOT `occurred_at`.** An atomic Aprobar stamps every entry with the same `now()`, so `occurred_at` alone renders **nondeterministically**. The UX demands *"Newest-first"* (`EXPERIENCE.md:85,109`); the mock fakes a 2-minute gap (`mock-home.html:568` vs `:580`) that one transaction **cannot** produce. Order by `id desc`.
  - **⚠ ENABLE + FORCE RLS or you break the *0003* suite, not your own.** `0003_audit_snapshot_test.sql` Section A2 asserts **no public base table may have FORCE off** (cited at `0005:42-43`, `0007:57-58`, `0010:204-205`).
  - **An EXPLICIT viewer policy is mandatory** (AD-7 `SPINE:113`: *"No status-less table is left ungated"*; data-integrity **H2** names status-less child tables as the leak class). `timeline_feed` has no `status` — it is **safe by construction because a row is only ever written post-approval** (FR-31 `prd.md:417`: *"The feed reflects only Approved events; Pending Ingestion does not post"*). So `create policy timeline_view on public.timeline_feed for select to anon, authenticated using (true);` — **and write that reasoning into the migration**, because a bare `using (true)` with no justification is exactly what H2 warns about.
  - Grants: `grant select on public.timeline_feed to anon, authenticated;` + `grant select, insert on public.timeline_feed to service_role;` — **deliberately NO UPDATE/DELETE**: append-only like `audit_log` (`0003:68,78-84`). A rollback (4.7) posts a **correcting** entry; it never edits history.
- [ ] **Tighten `score_source_guard`** (hand-off #3). Drop + re-add with the missing conjunct `and (score_a is null) = (score_source is null)`. ⚠ Keep AD-5's three disjuncts **verbatim** — you are ADDING a conjunct, not rewriting AD-5. ⚠ **CLEAN-APPLY NOTE required** (the 4.3 trap, `0013:60-72`): an immediate validated CHECK cannot apply to a DB holding violating rows, and **`supabase db reset` structurally cannot catch it**. Verify by grep that nothing writes a score today and state it (`0015:65-67`'s counter-precedent wording).
- [ ] **⭐ Extend the AD-23 guard — SURGICALLY (DECISION G, hand-off #2).** `create or replace` `match_terminal_state_guard()` (`0015:108-122`), adding a second rule with a **new distinct SQLSTATE `IC904`**:
  ```
  if old.state in ('resolved','manual_resolved') and new.state in ('bye','forfeit','void') then raise … IC904
  ```
  - ⚠⚠ **DO NOT add `resolved` to the existing terminal list.** The lifecycle (`SPINE:312`) has **`Resolved --> Pending: rollback [AD-8]`** and FR-14 (`prd.md:255`) says rollback returns a match *"to Pending or unparsed"*. Adding `resolved` to `old.state in ('bye','forfeit','void')` would **block Story 4.7 entirely** — the **exact** shape of the trap the 4.3 review already caught once (*"a naive write-once trigger would BLOCK 4.7, which must legitimately un-seat competitors"*, `deferred-work.md:144`). AD-23's claim is that `Resolved` and `Forfeit` **cannot coexist** — a claim about **those two states**, not about immutability.
  - Keep 4.5's existing rule byte-identical. This closes `deferred-work.md:11` and makes AD-23 true **by construction in both directions**.

### Task 2 — `approve_match`: the atomic Aprobar (same migration) (AC: 1, 2)
- [ ] **`approve_match(p_match_id bigint, p_actor_steamid64 text) returns jsonb`** — the §8 transaction as a **reusable RPC, not route-local logic** (DECISION J).
- [ ] **Open exactly as `mark_walkover` does** (`0015:297-317`): unlocked peek for `tournament_id` → the **byte-identical** `order by m.id for update` whole-bracket lock → read the source under the lock.
- [ ] Guards, all before any write, typed refusals RETURNED: `bad_match`; `not_pending` (state is not `pending` — this is what makes 4.6a's bind mandatory); `not_bound` (`demo_id is null` — refuse, do NOT bind here); `bad_score` (a `stat_row.rounds_won` missing **or NULL** for either competitor — ⚠ `rounds_won` is nullable and every row parsed before 0016 has it NULL, so test for NULL, not merely for an absent row); **`tied`** (`score_a = score_b` — DECISION K).
- [ ] ⭐⭐ **TWO MORE GUARDS, ADDED BY 4-6a's CODE REVIEW (2026-07-16) — see hand-off #7. A BINDING EXISTING DOES NOT MEAN IT IS VALID.** 4-6a binds on the admin's say-so and verifies nothing about the demo's relationship to the match; both gaps were homed here BY NAME and both are nearly free once you have resolved the seats:
  - **`wrong_demo`** — every `stat_row.steamid64` for this demo must be one of the two seats' `steamid64`. Found LIVE at 4-6a's BAR: binding a demo to a match between two *other people* was accepted. Your seat mapping has no answer in that case; `bad_score` catches the wholly-unrelated demo but **not a partial/superset overlap**.
  - **`demo_mismatch`** — ⭐ **the data-integrity M5 assertion** (`review-data-integrity.md:285-314`), which 4-6a's migration explicitly hands you: `stat_row.demo_id = match.demo_id` for every row you are about to approve. A re-upload legitimately creates a second `demo` sharing one `matchzy_match_id` (`0006`: `unique(matchzy_match_id, demo_sha256)`), and `upsertStatRows` conflicts on `(matchzy_match_id, steamid64)` setting `demo_id = excluded.demo_id` — so a re-parse can leave `match.demo_id = D_a` while every `stat_row.demo_id = D_b`, i.e. **a score derived from one demo while the evidence link names another**. One predicate closes both this and the re-homed 3.6 delete-missing item.
- [ ] **The §8 steps, in this order** (`SOLUTION-DESIGN.md:372-375`):
  1. **`stat_row.status='approved'`** for the match — plus `approved_at = now()`, `approved_by = p_actor_steamid64` (AC1's fourth clause). Scope by `match_id` (4.6a's bind is what made that possible).
  2. **The score + state.** Map `competitor_a`/`competitor_b` → `roster_entry.steamid64` (`0004:29`) → `stat_row.rounds_won` → `score_a`/`score_b`. Set `score_source='demo_derived'`, `winner_entry` = the higher tally's entry, `state='resolved'`. ⚠ `demo_id` is already set by 4.6a — `score_source_guard` needs it.
  3. **`v_adv := public.advance_match(p_match_id, p_actor_steamid64, false);`** — ⭐ `p_emit => false` (AD-11). **Then honor `{ok:false}`:**
     ```sql
     if not coalesce((v_adv->>'ok')::boolean, false) then
       raise exception 'approve_match: advance refused (%) — the whole publish is rolled back so a resolved, scored match never commits without its advance (AD-6/AD-8)', coalesce(v_adv->>'reason','unknown')
         using errcode = 'IC903', hint = '…';
     end if;
     ```
     Hand-off #1. **Mint `IC903`** — `IC901`/`IC902` are taken (`0015:37-42`); **never bare `P0001`**.
  4. **One `timeline_feed` row**, `entry_type='match_result'` (DECISION D). `detail` carries what the feed card renders (`mock-home.html:577-591` + the aria-live string `EXPERIENCE.md:145` — *"Resultado aprobado: Dex venció a Theo 16-13"*): `{winner_entry, loser_entry, score_a, score_b, bracket_position, demo_sha256}`. **Do NOT build a leaderboard refresh** — DECISION E.
- [ ] **The audit row** (AD-17, `action='approve'` — already enumerated, no migration). ⭐ **Carry a real before/after** (hand-off #6): `{before:{state,score_source,score_a,score_b}, after:{…}, stat_rows_approved:N}`.
- [ ] **⭐ The single emit (AC2).** After the writes, one `realtime.send(payload, 'match.approved', 'tournament:' || v_tid, false)` — mirror `0013:839-851`. The event name **`match.approved` is specified** (`SPINE:230`), not invented.
- [ ] Return `{ok:true, stat_rows_approved, score_a, score_b, winner_entry, advanced: v_adv->'advanced', champion: v_adv->'champion'}` (mirror `0015:407-413`).
- [ ] Service-role-only EXECUTE grant.

### Task 3 — lib `lib/match/approve.ts` (AC: 1, 2)
- [ ] New `lib/match/approve.ts` — mirror `lib/match/walkover.ts` exactly: `import 'server-only'`, injected `admin: SupabaseClient` first arg, the "THIS FILE IS UX, NOT TEETH" header, a discriminated-union result, a `Set` of the RPC's typed reasons, named SQLSTATE consts, **validate the ok-payload's shape before trusting it**, **fail closed** (`write_failed`) on an unrecognized reason.
- [ ] SQLSTATE map: **`IC903` → `advance_refused`**, **`IC904` → `terminal`**, **`23514` → `format_not_declared`**. ⚠ Do NOT map `P0001` (`format.ts`'s) or `IC901`/`IC902` (`walkover.ts`'s).
- [ ] `lib/match/approve.test.ts` (Vitest) — payload shape (`p_*` names), every typed reason, each SQLSTATE branch, `P0001` NOT hijacked, fail-closed on unknown.

### Task 4 — route `app/api/admin/approve/route.ts` (AC: 1)
- [ ] **The path is specified: `POST /api/admin/approve`** (`SOLUTION-DESIGN.md:372`). ⚠ It sits at `api/admin/`, **not** under `api/admin/match/` like 4.2/4.5/4.6a. Follow the spec.
- [ ] Mirror `app/api/admin/match/walkover/route.ts`: `runtime='nodejs'`, `dynamic='force-dynamic'`, `getAdminClient` + `createSupabaseServerClient` + `requireAdmin`, `parseBody` with `isPositiveInt` (keep the `MAX_SAFE_INTEGER` bound — `Number.isInteger(1e21)` is `true`), and `STATUS_FOR: Record<Extract<TResult,{ok:false}>['reason'], number>` (**the `Extract<>` typing is load-bearing** — a reason with no status entry must be a compile error).
- [ ] Statuses (the shipped convention): `bad_match` → **404**; `not_pending`/`not_bound`/`advance_refused`/`terminal`/`format_not_declared`/`tied` → **409**; `bad_score` → **422**; `write_failed` → **500**. Actor is **always** `gate.steamid64`, never from the body. JSON only, **no i18n** (Epic 5 owns Spanish); CSRF stays deferred to Epic 7 uniformly.

### Task 5 — pgTAP: new `0017` suite (AC: 1, 2, 3) — with EXACT `plan(N)`
- [ ] **New `supabase/tests/0017_aprobar_publish_test.sql`.** Mirror `0015_walkover_grace_test.sql`: the header mapping each AC → lettered sections, the `pg_temp` helper set (`tid`/`re`/`seeds`/`mid`/`comp`/`audit_ct`/`audit_all`/`matches8` — **reuse the golden snapshot, never hand-derive edges**), `plan(N)` with per-section arithmetic, `finish(); rollback;`. Fixtures need a real `player` for the audit FK (`0003:24`), a generated bracket, a demo, `stat_row`s with `rounds_won`, and a **bound, `pending`** match (drive 4.6a's `bind_match_demo` to get there — do not hand-build the state).
- [ ] Cover, with exact plan accounting:
  - **AC1 the atomic publish (flagship):** every `stat_row` → `approved` **plus `approved_at`/`approved_by` stamped**; `score_a`/`score_b` = the `rounds_won` tallies **mapped to the right seats** — assert seat orientation explicitly, **a transposed score is the bug this catches**; `score_source='demo_derived'`; `state='resolved'`; the winner **ARRIVED** at the destination seat (assert the seat, not just `advanced`'s count — the 4.3 lesson, `deferred-work.md:141`); exactly ONE `timeline_feed` row with the right `entry_type` + `detail`; TWO audit rows (`approve` + `advance`), the `approve` row carrying a real before/after.
  - **AC2 the emit:** exactly ONE `realtime.messages` row for the Aprobar, event `match.approved`, topic `tournament:<id>` — and **ZERO** `bracket.advanced` (proving `p_emit => false` worked). ⚠ Create the day-partition the suite needs, as `0013` does (`deferred-work.md:146` — `realtime.send` swallows its own errors).
  - **AC3 the feed:** the row's shape; and that `anon` can SELECT it (the policy) while `service_role` **cannot** UPDATE or DELETE it (the append-only grant ceiling — the `0003` precedent).
  - **AD-23 both ways:** Aprobar on a committed `forfeit` → refused **`IC901`** (free, from 4.5); `update match set state='forfeit'` on a `resolved` row → refused **`IC904`** (your half); ⭐ **`resolved → pending` still ALLOWED** (`lives_ok`) — **this is the assertion that proves you did not break Story 4.7.**
  - **`score_source_guard`:** `throws_ok` that `score_a=16, score_b=14, score_source=null` is now **REFUSED** (23514). ⚠ This assertion does not exist today — hand-off #3.
  - **`tied`** → refused, nothing written. **`not_pending`** / **`not_bound`** → refused.
  - **⭐⭐ THE `{ok:false}` ROLLBACK:** engineer a `slot_taken` (a destination seat held by a DIFFERENT player), call `approve_match`, assert it RAISES `IC903` **and** the match is still `pending` with NO score, NO approved `stat_row`, NO `timeline_feed` row, NO audit rows. The whole publish rolled back. **The single most important assertion in the suite.**
- [ ] **⭐ MUTATION-TEST EACH OF THE FOUR EFFECTS INDEPENDENTLY** (`deferred-work.md:141`: 4.3 mutation-tested AC1 and **shipped the identical hole on AC2** — deleting the result gate left all 79 assertions green). **A four-effect story has four ways to be blind:**
  - Remove the `stat_row` status flip → RED. · Remove the score write → RED. · Remove the `timeline_feed` insert → RED. · Swallow the `{ok:false}` RAISE → RED. · Neuter the `IC904` rule → RED. · Flip `p_emit => false` to `true` → the "zero `bracket.advanced`" assertion → RED. · **Transpose `score_a`/`score_b` → RED.**
  - A green suite after any mutation is a blind suite — **fix the test, not the mutation.**

### Task 6 — Regression sweep (AC: all)
- [ ] Full `supabase db reset` + `supabase test db`. Baseline is **4.6a's total** (659 + 4.6a's delta); account for every delta. ⚠ **Predicted regressions:** the tightened `score_source_guard` may redden `0010_match_test.sql:280-322`'s score fixtures and `0012_format_lock_test.sql:343`; the extended terminal guard may redden any fixture leaving `resolved`. **Fix the FIXTURE from real behavior, never the guard** — the standing 4.1/4.2/4.3/4.5 lesson. Keep every `plan(N)` exact.
- [ ] `npm test` (Vitest), `npm run lint` → 0, `npm run build` → 0 (the new route must register). Worker `go build ./... && go vet ./...` → 0 — and re-confirm **BY GREP** it touches no `match`/feed surface: `grep -riE '(from|into|update)\s+match\b|advance_match|score_a|score_b|timeline_feed' worker/` → **0**.

### Task 7 — THE BAR: live-QA a real Aprobar over the production seam (AC: 1, 2, 3)
- [ ] `supabase db reset` + re-apply `supabase/fixtures/live-qa-bracket-seed.sql`. Ingest a **real demo** from `demos/` through the real worker and bind it via 4.6a, so the score is genuinely demo-derived.
- [ ] Drive over the **supabase-js → PostgREST → RPC** seam (not just in-DB):
  1. Confirm a pre-bind Aprobar is refused `not_pending`.
  2. `approve_match` → one tap: stat rows `approved` + `approved_by`/`approved_at` stamped; `score_a`/`score_b` **match the real demo's final round tally, in the right seats**; `state='resolved'`; the winner advanced; exactly one `timeline_feed` row.
  3. **AC2 live:** a real **ANON WebSocket** subscriber receives exactly ONE `match.approved` on `tournament:<id>` — and **NO** `bracket.advanced` (proving `p_emit => false` over the real relay). Verify `realtime.messages` too.
  4. **AC3 live:** an **anon** client can read the feed row; `service_role` cannot UPDATE/DELETE it.
  5. **AD-23 live:** flip the resolved match to `forfeit` as `service_role` → refused (`IC904`); Aprobar a committed forfeit → refused (`IC901`).
  6. Prove the rollback live if feasible: engineer a `slot_taken` → `IC903`, match still `pending`, nothing published (or accept the pgTAP proof — the seam is proven by the succeeding paths).
- [ ] **Report the leaderboard no-op honestly:** there is no leaderboard to check (Story 5.5 owns it). State that in the Completion Notes rather than claiming a recompute you did not do.

---

## DECISIONS (made in-story; overrule at review — the 4.1/4.2/4.3/4.4/4.5 pattern)

**DECISION C — create `timeline_feed` with an `entry_type` discriminator covering all three FR-31 types.** RECOMMENDED (confirmed by Cuatro 2026-07-16). The table **does not exist and was never designed** — one prose mention (`SOLUTION-DESIGN.md:374`), no DDL, no ERD entity; and no reviewer probed it (the rubric marks FR-31 ✅ against AD-6/AD-11, which govern only atomicity and realtime). 4.6b is the **only feed writer in the entire 51-story plan** (`epics.md:167`), so the entry-type model must be general enough for all three FR-31 types (`match_result`, `bracket_advance`, `award_reveal`) even though this story writes one. ⚠ This is **unbudgeted schema design inside a story whose ACs read as integration** — the single biggest reason 4.6 was split.

**DECISION D — ONE `match_result` entry per Aprobar; `bracket_advance` is provisioned but NOT written here.** RECOMMENDED (confirmed by Cuatro 2026-07-16). §8 (`:374`) says *"append `timeline_feed` **entry**"* (singular) and the epic AC says *"a timeline feed **entry** is posted"* (singular) — the ACs are the contract. ⚠ But **FR-31 (`prd.md:415`) requires an entry per bracket advance too**, and the mock renders two cards (a blue advance + a green result, `mock-home.html:565-591`). The honest reason to defer: a `bracket_advance` entry must **also** cover 4.3's cascades and 4.5's forfeit/bye advances — paths this story does not own and which shipped **before the table existed** — so it should land uniformly in one place. **Log a `deferred-work.md` entry naming a home.** The `id`-ordering key (Task 1) is what makes a future two-entry render deterministic.

**DECISION E — "recompute leaderboards" is a NO-OP. Build NOTHING.** RECOMMENDED, and building anything would **violate AD-20**. AD-20 (`SPINE:175-178`) exists to resolve adversarial **H3**, which offered exactly two options and whose own text says option (a) means *"AD-6's 'recompute' reduces to 'no extra write'"* (`review-adversarial.md:145-147`). The spine picked (a): *"one SQL view or RPC over `status='approved'` rows"* (`SPINE:178`, `SOLUTION-DESIGN:377`). So **step (1)'s status flip IS the recompute** — the view reads approved rows, so standings change atomically on commit. Three independent confirmations: **the leaderboard does not exist** (grep-verified) and Story 5.5 owns its slice (`epics.md:913`) in a *later epic*; `0009:22` says so by name; and `REFRESH MATERIALIZED VIEW` inside the txn takes an `ACCESS EXCLUSIVE` lock (the `CONCURRENTLY` variant **cannot run in a transaction block at all**), colliding with AD-6's one-transaction rule and the ~2 s budget. ⚠ Residual doc tension, flag not fix: AD-20:178 and §8:374 both say *"materialization"* — vocabulary from the branch the spine did **not** pick. If 5.5 later chooses a matview, **5.5** owns wiring its refresh in. Precedent: 4.5's AC1 was likewise a *proof obligation*, not new code.

**DECISION F — emit ONE `match.approved`; pass `p_emit => false`.** RECOMMENDED, essentially forced. The event name is **specified, not invented** (`SPINE:230` lists `match.approved` first, distinct from `bracket.advanced`), and `p_emit` was added for this caller by name (`0013:826-830`). AD-11 (`SPINE:133`): *"One Broadcast carries the semantic change so the four effects of AD-6 stay atomic on the wire."* Two broadcasts would put AD-6's atomic effects on the wire as two observable steps.

**DECISION G — extend the AD-23 guard with a NEW rule (`IC904`); do NOT add `resolved` to the terminal set.** RECOMMENDED — **this is the trap in the deferral.** `deferred-work.md:11` homes the fix here, and the obvious fix (add `resolved` to `old.state in ('bye','forfeit','void')`) would **break Story 4.7**, because `Resolved → Pending: rollback` is in the lifecycle (`SPINE:312`) and FR-14 (`prd.md:255`). AD-23's actual claim is that `Resolved` and `Forfeit` **cannot coexist** — about those two states, not about immutability. So block `resolved|manual_resolved → bye|forfeit|void` and **explicitly allow** `resolved → pending`, with a `lives_ok` pinning it so a future "helpful" tightening goes RED. Same shape as the trap the 4.3 review caught (`deferred-work.md:144`).

**DECISION J — Aprobar is a reusable RPC (`approve_match`), not route-local logic.** RECOMMENDED — a hard constraint, not a preference. AD-3 (`SPINE:93`): *"Re-parsing an Approved match runs the entire revert→reparse→republish as a **single transaction**"* — the resolution of data-integrity **H1** (`review-data-integrity.md:46-78`). If the Aprobar transaction lives in TypeScript, Story 3.6/4.7's re-parse-republish is **unimplementable**. It must also be callable from inside another transaction, exactly as `advance_match` is from `mark_walkover`.

**DECISION K — a tied score is REFUSED (`tied`), not resolved.** RECOMMENDED (confirmed by Cuatro 2026-07-16). `match.tie_policy` is declared and locked by 4.2 (`ot_mr3`/`ot_mr3_unlimited`/`draw` — `lib/match/format.ts:40`), but **interpreting** it is nobody's story: a real overtime is already in the demo's round tally, so a genuine tie means `tie_policy='draw'`, and a draw has **no `winner_entry`** — which `advance_match`'s gate (`0014:423-425`) refuses anyway. A draw genuinely cannot advance a double-elim bracket. Refusing loudly surfaces the real problem; crowning arbitrarily hides it.

---

## Dev Notes

### Architecture constraints (cited)
- **AD-6** (`ARCHITECTURE-SPINE.md:105-108`): *"approving a match's stats publishes the rows, sets the demo-derived score, advances the bracket, posts the feed entry, and recomputes affected leaderboards in **one DB transaction**. The realtime emit fires **only after** that transaction commits."* **Prevents** (`:107`): *"a half-applied publish… a realtime event announcing uncommitted state."*
- **§8** (`SOLUTION-DESIGN.md:370-375`) — the only ordered statement of the transaction, verbatim: *"**`POST /api/admin/approve` (one DB transaction):** (1) `stat_row.status='approved'` for the match; (2) `match.score_source='demo_derived'`, `score`, `state='resolved'`; (3) idempotent bracket advance; (4) append `timeline_feed` entry + refresh the single leaderboard materialization (AD-20). **After commit only**, emit one Broadcast on `tournament:<id>` carrying the semantic change."*
- **AD-11** (`:130-133`) + the event vocabulary (`:230`): channels `tournament:<id>` (public) / `ceremony:<id>` / `admin:<id>`; events *"named by semantic change (`match.approved`, `bracket.advanced`, …), emitted post-commit only"*. *"One Broadcast carries the semantic change so the four effects of AD-6 stay atomic on the wire."*
- **AD-5** (`:100-103`): *"`match.score_source ∈ {demo_derived, admin_manual}` is the single discriminator. When a demo exists, `demo_derived` is the score of record."*
- **AD-23** (`:190-193`): *"`Resolved` (demo) and `Forfeit` (admin) cannot coexist; the `match` row is the single arbiter and its **transition guards** prevent two writers landing both."*
- **AD-2** (`:85-88`): *"the ***accept-anomaly* and *approve* decisions (FR-13) are admin actions on the app side, never the worker**"* — this authorizes 4.6b to write `stat_row.status` (closes adversarial H12).
- **AD-3** (`:90-93`) → DECISION J. **AD-7** (`:110-113`): *"No status-less table is left ungated"* → the feed's explicit policy. **AD-8** (`:115-118`): advance is *"a consequence of a result (Aprobar / Forfeit / Bye)… never an independent button that races publish."*
- **AD-17** (`:160-163`): `approve` is **enumerated**; the row carries actor + timestamp + **before/after**. **AD-18** (`:165-168`) → the feed's `tournament_id`. **AD-20** (`:175-178`) → DECISION E. **AD-24** (`:195-198`): `approved → Aprobado` is **Epic-5 i18n** — 4.6b ships data, not labels. ⚠ Note `Resolved` has **no Spanish rendering anywhere**; the pill renders `Aprobado`.
- **Match lifecycle** (`:299-317`): `Pending → Resolved: Aprobar` · **`Resolved → Pending: rollback`** — `resolved` is **not** terminal.
- **FR-13** (`prd.md:240-247`), **FR-31** (`:410-417`), **FR-16** (`:267-273`), **FR-14** (`:249-256`).
- **UX** (`EXPERIENCE.md:96,111,145,159-160`): `{components.approve-button}` is *"one action, three consequences"*; *"**The line between 'the Admin sees it' and 'everyone sees it' is the Aprobar action.**"* **All UI is Epic 5.**

### Current-state facts you must preserve (regressions to avoid)
- **`advance_match` RETURNS typed refusals; it does not raise** (`0014:389,411,418,424,538-541,551-554`). Do NOT change that contract. RAISE in *your* function (`IC903`).
- **Every `{ok:false}` return sits in pass 1, BEFORE `0014:575`'s *"Past this line everything writes"*** — so a refused advance has written nothing and your RAISE unwinds only your own writes. Verified at the 4.5 review; this is why the pattern is safe.
- **The canonical lock order is the deadlock fix** (`0014:392-400`, `0013:556-562`). Take the byte-identical lock up front (`0015:297-317`) or reproduce the 4.3 `40P01`.
- **`match_place_competitor` seats a `bye` destination with `state` unchanged** — your extended guard must not block it (`0015:95`'s discriminator: `new.state is distinct from old.state`).
- **`match` has NO DELETE grant** (`0010:227`); `stat_row`'s worker upsert must stay `status`-free (`db.go:172-175,245`).
- **`audit_log.actor_steamid64` is NOT NULL with an FK to `player`** (`0003:24`).
- **Data-integrity M5** (`review-data-integrity.md:285-314`) wants `stat_row.demo_id` asserted equal to `match.demo_id` **at approve time** — you are approve time. Cheap assertion; consider it.

### Migration hygiene
- Slot is **`0017_aprobar_publish.sql`** (4.6a takes 0016); test **`supabase/tests/0017_aprobar_publish_test.sql`**.
- SQLSTATEs: `IC901` (terminal, 4.5) · `IC902` (walkover advance-refused, 4.5) · **`IC903`** (approve advance-refused, yours) · **`IC904`** (the AD-23 `resolved→forfeit` half, yours). **Never bare `P0001`** (`deferred-work.md:127`).
- `audit_log.action = 'approve'` is already enumerated (`0003:25`) — **no migration**. **Do not edit 0003.**
- New RPC = a NEW function — issue `revoke … from public; grant … to service_role;` explicitly (`0012:480-487`). `match_terminal_state_guard()` is `create or replace` (a `returns trigger` function needs no grant, `0012:248-251`).
- ⚠ **CLEAN-APPLY NOTE required** for the tightened `score_source_guard` (the 4.3 trap, `0013:60-72`).

### Scope boundaries (do NOT do these here)
- **No score derivation, no parser change, no `bind_match_demo`** — all **4.6a's**. If `demo_id` is NULL, refuse `not_bound`; do not bind.
- **No leaderboard anything** (DECISION E; Story 5.5 owns the slice). **No feed READ surface / UI / i18n** (Story 5.6 / Epic 5).
- **No `declared → live`** (unowned → Epic-5 console). **No accept-anomaly route** (orphaned — 4.6a flags it).
- **No rollback / un-advance / `Deshacer`** (Story 4.7). ⚠ The mock renders an undo link (`mock-admin.html:467`) that exists in **no spine and no AC** — it is 4.7's rollback surfaced as a one-tap; explicitly exclude it.
- **No manual score / `manual_override`** (4.8 — and do NOT touch `manual_override`; it is AD-5's score-source flag read by `score_source_guard`).
- **No changes to `advance_match` / `generate_bracket` / `mark_walkover`** — call, don't rewrite. **No shared command-route helper** (4.9, which owns `advance_match`'s five bare `P0001`s). **No CSRF** (Epic 7).
- **No ceremony-lock gate.** ⚠ AD-15 (`SPINE:153`) requires the ceremony lock to *"block further approves"*, and data-integrity **M3** (`:251-253`) wants `tournament.ceremony_locked_at` checked **by Aprobar**. `ceremony` does not exist until Epic 6 — **Story 6.2 must add the check to whatever `approve_match` you ship.** Flag the seam; do not build it.

### Project Structure Notes
- Migration `supabase/migrations/0017_aprobar_publish.sql` + `supabase/tests/0017_aprobar_publish_test.sql`.
- Lib `lib/match/approve.ts` (+ `.test.ts`) — mirror `lib/match/walkover.ts`. Route **`app/api/admin/approve/route.ts`** — the spec'd path (`SOLUTION-DESIGN:372`), **NOT** under `api/admin/match/`.
- Schema: ONE new table (`timeline_feed`), one CHECK tightened, one trigger function extended, one new RPC. No worker change.

### Testing standards
- **pgTAP** with EXACT `plan(N)` accounting (standing since Epic 1). Baseline = 4.6a's totals (pgTAP was **659**/16 files, Vitest **233** before 4.6a); lint 0; build 0; worker clean.
- **Mutation-test each of the four effects INDEPENDENTLY** (Task 5). `deferred-work.md:141`: 4.3 mutation-tested AC1 and shipped the identical hole on AC2 — deleting the result gate left all 79 assertions green. **A four-effect story has four ways to be blind.**
- **THE BAR (Task 7):** a real Aprobar over the live seam from a **real demo**, the score matching the demo's actual round tally **in the right seats**, exactly one `match.approved` and **zero** `bracket.advanced` on a real anon socket, an anon client reading the feed row, both AD-23 directions refused live, and the `{ok:false}` rollback proven.

### References
- [Source: ARCHITECTURE-SPINE.md] AD-2 (`:85-88`); AD-3 (`:90-93`); AD-5 (`:100-103`); AD-6 (`:105-108`); AD-7 (`:110-113`); AD-8 (`:115-118`); AD-11 (`:130-133`); AD-15 (`:150-153`); AD-17 (`:160-163`); AD-18 (`:165-168`); AD-20 (`:175-178`); AD-23 (`:190-193`); AD-24 (`:195-198`); event vocabulary (`:230`); **Match lifecycle (`:299-317`)**
- [Source: SOLUTION-DESIGN.md] **§8 the Aprobar txn (`:370-375`)**; leaderboards = one view/RPC (`:377-379`); realtime channels (`:381-383`); match DDL + score_source_guard (`:110-139`); `stat_row.approved_at/by` (`:154`); audit action vocabulary (`:251`)
- [Source: prd.md] FR-13 (`:240-247`, esp. `:247` who/when); FR-14 (`:249-256`); FR-16 (`:267-273`); FR-31 (`:410-417`); ~2 s is an unconfirmed `[ASSUMPTION]` (`:498,526-530`)
- [Source: EXPERIENCE.md] `{components.approve-button}` (`:96`); Pending→Approved (`:111`); feed-card (`:85`); aria-live (`:145`); approved-only + the Aprobar line (`:159-160`); Flow 2 (`:205-213`)
- [Source: epics.md] Story 4.6 (`:741-761`); FR map (`:149,167`); Story 5.5 owns the leaderboard slice (`:913`); Story 5.6 disclaims the post (`:941-943`)
- [Source: supabase/migrations/0010_match.sql] match DDL (`:46-103`); **score_source_guard (`:124-128`)**; SET NULL not CASCADE on the back-pointers (`:189-198`); no-DELETE grant (`:227`)
- [Source: supabase/migrations/0013_advance.sql] the canonical-lock rationale (`:556-562`); **`p_emit`'s purpose (`:826-830`)**; post-commit-by-construction (`:809-819`); **the emit shape (`:839-851`)**; why `pending` matters most (`:515-520`); the CLEAN-APPLY trap (`:60-72`)
- [Source: supabase/migrations/0014_grand_final_reset.sql] signature (`:357-364`); canonical lock (`:392-400`); **result gate (`:414-425`)**; write boundary (`:575`); return shape (`:648-650`)
- [Source: supabase/migrations/0015_walkover_grace.sql] **`mark_walkover` — the template (`:280-415`)**; lock header (`:274-296`); the three-step opening (`:297-317`); the `{ok:false}`→IC902 RAISE (`:372-387`); audit row (`:393-405`); the SQLSTATE convention (`:37-42`); the terminal guard (`:108-126`)
- [Source: supabase/migrations/0012_format_lock.sql] 23514 (`:123-126`); `match_format_audited` is a no-op for 4.6 (`:219`); the grant block (`:480-487`)
- [Source: supabase/migrations/0009_stat_pending_visibility.sql] `stat_view` + the column-blind anon grant (`:30-35`); the leaderboard is 5.5's (`:22`); [0003] audit_log + the append-only grant ceiling (`:20-30,68,78-84`); [0007] `approved_at`/`approved_by` shells (`:48`)
- [Source: lib/match/walkover.ts] the lib shape; [app/api/admin/match/walkover/route.ts] the route shape; [lib/match/format.ts] the `P0001` note (`:102-106`), the tie catalog (`:40`)
- [Source: deferred-work.md] the hand-offs homed here — `{ok:false}` caller rollback (`:145`), AD-23 asymmetry (`:11`), `score_source_guard` (`:127`), the 23514 map (`:136`), `approved_by` anon exposure (`:96`), AD-17 before/after (`:149`); the mutation-blindness lesson (`:141`); the realtime partition trap (`:146`); the 4.7-blocking-trap precedent (`:144`)
- [Source: review-adversarial.md] **H3 — "recompute leaderboards" names no owner (`:115-150`, esp. `:144-150`)**; H8 → AD-23 (`:311-345`); H12 → AD-2 (`:436-464`)
- [Source: review-data-integrity.md] **H1 — re-parse must re-run the whole AD-6 txn (`:46-78`)**; H2 — status-less tables leak (`:82-118`); M3 — ceremony-lock must reject Aprobar (`:226-258`); M5 — `stat_row.demo_id` vs `match.demo_id` at approve time (`:285-314`)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
