---
baseline_commit: e7a5aa0fef69cc94fa7a26c1669e00a05ed4a943
---

# Story 6.8b: Reveal-gating and commitment

Status: done

> **⛔⛔ READ THIS BEFORE THE ACs. This is the story that OPENS the door, and four shipped pgTAP suites
> assert today that the door is shut.**
> [0023_award_catalog_test.sql:329-346](supabase/tests/0023_award_catalog_test.sql#L329), [0024_ceremony_lock_snapshot_test.sql:456-472](supabase/tests/0024_ceremony_lock_snapshot_test.sql#L456), [0025_ceremony_results_test.sql:148-182](supabase/tests/0025_ceremony_results_test.sql#L148) and
> ⭐ [0027_ceremony_run_test.sql:1137-1155](supabase/tests/0027_ceremony_run_test.sql#L1137) each pin the closed posture, the last one **with rows in the
> tables**. **They will redden. Retarget every one of them deliberately and say so in Completion
> Notes — deleting one silently is the failure mode**, and 6.1 named it in advance: *"6.1 ships the
> strictly-closed end state, so 6.8 is an **opening**, never a tightening"* ([6-1:71](_bmad-output/implementation-artifacts/6-1-award-catalog-and-buckets.md#L71)).
>
> ⚠ **The second thing to know:** the grant and the policy ship **together** or not at all.
> [0025:51-52](supabase/migrations/0025_ceremony_results.sql#L51): *"⛔ Story 6.8 ADDS both halves — the grant and the policy — together. It never
> has to tighten anything here."* A grant without a `revealed_at` policy publishes the **entire
> unrevealed ceremony**; a policy without a grant does nothing at all, because `42501` fires at the
> table-grant gate before RLS is ever consulted ([0025:350](supabase/migrations/0025_ceremony_results.sql#L350)).
>
> ⚠ **The third:** publish the seed from **`ceremony.seed_demo_sha256`**, never from
> `tournament.fair_seed`. See DECISION C — this is not a style preference, it is the difference
> between a commitment that binds and one that a rollback can quietly erase.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the tenth story of the epic**
Traces: **FR-24**, **FR-30** · **AD-22** (reveal-gating and commit-then-publish) · AD-7, AD-8, AD-11, AD-12, AD-17, AD-24 · SOLUTION-DESIGN **§4** and **§9.5** · `epics.md:1140-1152` **1:1**
Consumes: 6.8a's `persist_ceremony` and the 40 rows it writes · 6.2's `ceremony` row, its frozen `seed_demo_sha256` and `lock_ceremony` · 6.1's `award` catalog + `award_catalog_count` · 0027's forward-only `assert_ceremony_transition` trigger (which **already permits** `spinning → complete`) · 5.6's `timeline_feed` read surface and its already-built `award_reveal` branch
Hands to: **6.9** (`verification_bundle`, `bundle_hash`, RFC-8785, the browser verifier), **6.10** (the wheel, reduced-motion parity, `/ceremonia`), **6.11** (the end-to-end vector)

> ### Carve-out note (inherited from 6.8a — do not re-litigate it)
>
> Cuatro split Story 6.8 on 2026-08-08 ([6-8a:9-26](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L9)):
>
> - **6.8a — the ceremony RUNS and the rows EXIST.** Done. *"The access posture does not move: zero
>   `anon`/`authenticated` grants, `revealed_at` stays `NULL`, no viewer can see anything."*
> - **6.8b (this story) — the rows become VISIBLE, on the reveal axis.** *"Grants + `revealed_at`
>   policies on `award`/`spin`/`award_result`/`award_result_winner`, the `reveal_spin` RPC, the
>   `seed_hex` commitment surface, the `ceremony_locked` widening to the grace/bind RPCs, and the
>   `award_reveal` feed writer. 6.8b maps 1:1 onto `epics.md:1140-1152`."*
>
> **6.8b carries all three of the epic's ACs; 6.8a carries none of them.**
>
> ⚠ **`bundle_hash` is NOT reachable here, and that is recorded, not discovered.** Cuatro's decision
> 2026-08-08 ([sprint-status.yaml:138-142](_bmad-output/implementation-artifacts/sprint-status.yaml#L138)): *"6-8b publishes `seed_hex` and lands the shell; 6.9 computes
> and publishes `bundle_hash`. Epic AC1 will be recorded PARTIAL with the owner named."* Every
> migration header agrees — [0024:150-155](supabase/migrations/0024_ceremony_lock_snapshot.sql#L150), [0025:76-80](supabase/migrations/0025_ceremony_results.sql#L76), [0027:157-158](supabase/migrations/0027_ceremony_run.sql#L157).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

---

## Story

As a viewer,
I want the seed committed up front and award identities revealed only at their spin,
so that the bytes can't change after commitment and nothing is spoiled early.

---

## Acceptance Criteria

**AC1 — The commitment is PUBLISHED, from the write-once column, and the parts that would spoil the ceremony are not published with it.**
**Given** the commitment rule ([epics.md:1140-1142](_bmad-output/planning-artifacts/epics.md#L1140); AD-22 `ARCHITECTURE-SPINE.md:188` — *"The seed hash + `bundle_hash` are published up front as the **commitment**"*; SOLUTION-DESIGN §9.5 `:437`; and that AD-22's second gating predicate is **`ceremony.state`**, not `spin.revealed_at`),
**When** migration `0028` ships,
**Then** the `ceremony` row becomes viewer-readable through **both halves together** — a policy `ceremony_viewer_read … using (state <> 'not_started')` **and** a **column-level** `grant select (…)` naming exactly the commitment columns — exposing `state`, `seed_demo_sha256` (published under the contract name `seed_hex`), `started_at` and `completed_at`, while **`snapshot_id`, `algorithm_version`, `spin_plan` and `luck_weight_table` stay ungranted** (⭐ `spin_plan` names each spin's candidate `award` **pool**, so publishing it up front would hand a viewer the shape of every unrevealed spin — it is the *"per-spin live-category sets"* AD-22 gates by name),
**And** the published seed is read from **`ceremony.seed_demo_sha256`** — write-once by `assert_ceremony_transition` ([0027:514-554](supabase/migrations/0027_ceremony_run.sql#L514)) — **never** from `tournament.fair_seed`, whose `IC908` trigger was deliberately loosened to permit `value → NULL` so `rollback_match` can un-crown (DECISION F, [6-2:1143](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L1143), *"flag it for 6.8, which owns publication"*),
**And** `bundle_hash` is recorded **PARTIAL with 6.9 named** — this story creates no `verification_bundle` table, no `bundle_sha256`, no RFC-8785 canonicalization (see Question 1).

**AC2 — `spin` becomes visible on the reveal axis, and only on it.**
**Given** the reveal-gating rule ([epics.md:1144-1146](_bmad-output/planning-artifacts/epics.md#L1144); AD-22 `:188`; the policy sketch at [SOLUTION-DESIGN:284-285](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L284) — `create policy spin_view on spin for select using (revealed_at is not null)`),
**When** `0028` ships,
**Then** `spin` carries `grant select on public.spin to anon, authenticated` **and** two **separate, never-OR'd** policies in the [0002:87-98](supabase/migrations/0002_rls.sql#L87) house form — `spin_viewer_read … to anon, authenticated using (revealed_at is not null)` and `spin_admin_read … to authenticated using ((select public.is_admin()))` — so a viewer sees a spin, its `spin_index`, its `kind` and its `live_award_ids` **only** from the moment it is revealed, and never one row earlier. RLS stays `ENABLE`+`FORCE`; only `SELECT` is granted, never a data-writing verb.

**AC3 — `award_result` and `award_result_winner` gate through the PARENT spin, and the composite FK is what makes the cheap gate honest.**
**Given** that neither table has a `revealed_at` of its own, and that [SOLUTION-DESIGN:286](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L286) says *"gate on the parent `spin.revealed_at`"*,
**When** `0028` ships,
**Then** `award_result` gates by `exists (select 1 from public.spin s where s.id = spin_id and s.revealed_at is not null)`, and `award_result_winner` gates on its **own denormalized `spin_id`** — legitimate **only** because `0025`'s DECISION D made a child whose `spin_id` disagrees with its parent's **unrepresentable** via the composite FK `(award_result_id, spin_id) → award_result(id, spin_id)` ([0025:63-69](supabase/migrations/0025_ceremony_results.sql#L63)); **cite that at the site, because without it the shortcut is a hole**,
**And** each table gets its own separate `_admin_read` policy, and the `exists` subquery is verified to ride an existing index — `award_result_spin_award_key unique (spin_id, award_id)` ([0025:178](supabase/migrations/0025_ceremony_results.sql#L178)) and `award_result_winner_spin_key unique (spin_id, winner_entry_id)` ([0025:247](supabase/migrations/0025_ceremony_results.sql#L247)) both lead on `spin_id`, so **no new index is needed for these two — prove it with `explain`, do not assume it** (⚠ AC4's `award` gate is a different story; see Dev Notes).

> ⛔ **AC3's index clause was REFUTED by the measurement it demanded, and the AC is left standing as
> written so the record shows what was asked and what was found.** `explain (costs off)` under
> `set local role anon` shows Postgres does not probe those indexes at all: it hoists the `exists`
> into a **hashed SubPlan** over a `Seq Scan on spin`. The conclusion the AC wanted — no new index —
> is correct, but **not for the reason the AC gives**; the indexes are simply not what makes the gate
> cheap. The measured plans are pasted at the policy sites in `0028`. ⚠ The Dev Notes paragraph at
> [:325](#) ("three of the four gates ride an existing one") is wrong for the same reason and is
> corrected there. Recorded at code review 2026-08-08.

**AC4 — the `award` CATALOG opens per-award, through the awkward join, and the count RPC is not widened.**
**Given** FR-24's blurred-until-spin rule and that `award` has **no link to `spin` at all** — its only path is `award_result.award_id`, which `0026` made **nullable** for pity rows ([0026:90-91](supabase/migrations/0026_pity_award_result.sql#L90)),
**When** `0028` ships,
**Then** an `award` row becomes viewer-readable exactly when it has been decided in a revealed spin — `exists (select 1 from public.award_result ar join public.spin s on s.id = ar.spin_id where ar.award_id = award.id and s.revealed_at is not null)` — so a **pity** result (`award_id is null`) reveals no catalog award, which is correct and must be asserted,
**And** ⛔ **`award_catalog_count` is NOT widened by a single column.** [0023:196-198](supabase/migrations/0023_award_catalog.sql#L196): *"⛔ IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22 … Widening the CATALOG's viewer surface is Story 6.8's job and it does it with a reveal-gated **POLICY on the table**, not by growing this."* The count stays the only pre-reveal catalog fact, and `LockedAwards.tsx` keeps rendering from it,
**And** the accessible name of an unrevealed card is still exactly `premioBloqueado(i, n)` → `` `Premio {i} de {n} — bloqueado hasta que gire` `` ([lib/i18n/es.ts:229-231](lib/i18n/es.ts#L229)), em dash included, with **no gold** (UX-DR6/20/25).

**AC5 — `reveal_spin` is a real admin command: one spin, in published order, audited, and it nudges.**
**Given** AD-8 (*"every mutation flows through a Next.js server route that re-verifies `is_admin()` server-side, then writes via the service-role key"*), AD-17 (every event-mutating admin action writes an `audit_log` row), and that [0027:150-151](supabase/migrations/0027_ceremony_run.sql#L150) homes the RPC here by name,
**When** an admin reveals a spin,
**Then** `0028` adds `public.reveal_spin(p_ceremony_id bigint, p_spin_index int, p_actor text) returns jsonb` in the full house RPC form ([6-2:186-201](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L186)) — `security invoker`, `set search_path = ''`, unlocked existence peek, ordered locks, **every guard before any write**, typed `{ok:false, reason:'<snake_case>'}` refusals, exactly **one** `audit_log` row with before/after, `revoke execute … from public` then `grant execute … to service_role` — which stamps `revealed_at = now()` on exactly one spin,
**And** it **refuses out-of-order reveals**: `p_spin_index` must be the lowest unrevealed index of that ceremony, because UX-DR32/42 requires *"the outcome and published spin order are identical"* on both the animated and reduced-motion paths, and a reveal axis that can be walked out of order is not an order at all,
**And** it emits exactly one `spin.reveal` Broadcast via `realtime.send(...)` **from inside the transaction** on the **`ceremony:<id>`** channel — the [0013:809-830](supabase/migrations/0013_advance.sql#L809) pattern, post-commit by construction, error-swallowing untouched — using the vocabulary `SPINE:230` already fixes; ⛔ **event names are never invented** ([0024:165-167](supabase/migrations/0024_ceremony_lock_snapshot.sql#L165)),
**And** `'reveal_spin'` joins the `audit_log.action` vocabulary with **no migration needed** — `action` is uncapped `text` with no CHECK ([0003:25](supabase/migrations/0003_audit_snapshot.sql#L25)), the same precedent 4.2 and 4.3 took.

**AC6 — revealing the LAST spin completes the ceremony, atomically, and that is what "in full at completion" means mechanically.**
**Given** progressive release ([epics.md:1148-1150](_bmad-output/planning-artifacts/epics.md#L1148)) and that `0027`'s transition trigger **already permits `spinning → complete`** and says so — [0027:152](supabase/migrations/0027_ceremony_run.sql#L152): *"⭐ The transition trigger below ALREADY PERMITS `spinning → complete`; 6.8b writes it"*,
**When** `reveal_spin` reveals the highest `spin_index` of the ceremony,
**Then** the same transaction sets `ceremony.state = 'complete'` and writes `ceremony.completed_at` — the shell column `0024:204` created and nobody has written ([6-2:207-220](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L207)) — through the trigger, as **one legal forward step**, never by a second admin action (DECISION E),
**And** the pgTAP suite proves the trigger still refuses `complete → spinning`, `spinning → locked` and any skip, by the **`IC910` SQLSTATE and the named constraint**, in both directions.

**AC7 — `ceremony_locked` finally reaches the grace and bind RPCs (closes `deferred-work.md:280`).**
**Given** [deferred-work.md:280](_bmad-output/implementation-artifacts/deferred-work.md#L280) — *"`begin_match_grace`, `resume_match` and `bind_match_demo` gate on match state only and carry no ceremony guard, so after the lock they still churn match state and push `timeline_feed` entries … feed activity landing on the viewer **while the audience is watching the ceremony**, describing a bracket the frozen snapshot says is settled"* — **intended home: 6.8, it owns the judgement about what the audience may see mid-ceremony**,
**When** `0028` ships,
**Then** all three are `create or replace`d with the same `ceremony_locked` guard `mark_walkover` already carries from 6.2, refusing **before any write** with the existing typed reason,
**And** ⛔ **the diff of each replaced body against its original is pasted in Completion Notes and contains only the intended change** — the rule 6.8a followed for `assert_award_result_is_shared` and the reason its review could verify the delta was *"exactly four things and nothing else"*. ⛔ **Never edit `0001`–`0027`.**

**AC8 — the `award_reveal` feed writer, unowned across all of Epic 6 until now, ships (closes `0024:170` and `deferred-work.md:81`).**
**Given** FR-31 ([prd.md:415](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L415)) — *"An Approved Match result, a Bracket advance, and an Award reveal **each post an entry** to the feed"* — that `timeline_feed.entry_type` has carried `'award_reveal'` since [0017:109](supabase/migrations/0017_aprobar_publish.sql#L109) with **no writer**, and that the reader branch and the gold rail node are already built and tested ([lib/feed/model.ts:185-196](lib/feed/model.ts#L185), [TimelineFeed.tsx:99](app/(viewer)/components/TimelineFeed.tsx#L99), [model.test.ts:135](lib/feed/model.test.ts#L135)),
**When** `reveal_spin` succeeds,
**Then** the **same transaction** inserts exactly one `timeline_feed` row with `entry_type = 'award_reveal'` whose `detail` populates the `{title?, subtitle?}` shape [lib/feed/model.ts:128-131](lib/feed/model.ts#L128) already reads — the revealed award's name as `title`, the winner display name(s) as `subtitle` — so the entry **cannot exist before its reveal** and the progressive release is one insert, not a projection,
**And** a **pity** spin and a **zero-winner** outcome each get a defined, asserted `detail` rather than falling through to `es.award.teaserTitle` by accident (⚠ over the real corpus **every one of the 12 main spins is `no_eligible_players`** — see AC10 and Question 2; this is not a hypothetical branch),
**And** ⛔ **no new i18n string is invented for the ceremony.** `es.award.teaserTitle` / `es.award.revealAtCeremony` are the shipped fallbacks; `Verificar la ceremonia` and every wheel string are **6.9/6.10's** (AD-24 keeps them in one module and this story adds no viewer chrome).

**AC9 — the four closed-posture suites are RETARGETED, each preserving its original claim in a stronger form.**
**Given** that each was written to assert an absence this story deliberately removes,
**When** the suite is updated,
**Then** each named site moves from *"no viewer can read this"* to *"a viewer can read exactly the revealed subset and nothing else"*, keeping the same primitive (`has_table_privilege` / `has_column_privilege` / `policies_are`, never a row count over `information_schema.role_table_grants` — [0025 test:157-161](supabase/tests/0025_ceremony_results_test.sql#L157) records why: *"Supabase's project-wide default privileges hand anon/authenticated REFERENCES/TRIGGER/TRUNCATE on EVERY new public table, so a bare grant count is 3 for a table nobody granted anything on"*):
| site | today | after |
|---|---|---|
| [0023:329-346](supabase/tests/0023_award_catalog_test.sql#L329) | `policies_are(award) = {award_admin_read}`; anon/authenticated hold **no** verb | the policy set gains `award_viewer_read`; anon holds **`SELECT` only**, still no I/U/D |
| [0024:456-472](supabase/tests/0024_ceremony_lock_snapshot_test.sql#L456) | `policies_are(ceremony) = {ceremony_admin_read}`; no anon privilege at all | gains `ceremony_viewer_read`; anon holds `SELECT` on **exactly the commitment columns** and **not** on `snapshot_id` / `spin_plan` / `luck_weight_table` / `algorithm_version` |
| [0025:148-182](supabase/tests/0025_ceremony_results_test.sql#L148) | *"all three tables: NO RLS policy at all — 6.8 adds the reveal-gated read AND its grant together"* | the three named viewer policies + the three admin policies exist, `SELECT` only, FORCE intact |
| ⭐ [0027:1137-1155](supabase/tests/0027_ceremony_run_test.sql#L1137) | the AC9 triple `'false \| award.award_admin_read \| true'` **with rows present** | the new expected triple, still asserted **with rows present**, still exact-set not zero-count |
**And** [0003_audit_snapshot_test.sql](supabase/tests/0003_audit_snapshot_test.sql) Section A2's generic FORCE-guard stays **green untouched** — ⛔ do not lose `FORCE` on any table.

**AC10 — proven against the REAL corpus, by a two-sided grep whose non-vacuity is itself measured.**
**Given** the standing doctrine *"measure zeros, never narrate them"* ([epic-5-retro-2026-07-28.md:43](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L43)) and 6.8a's hard-won correction that *"a grep over an empty error page proves nothing"* — its first AD-22 sweep came back falsely clean over ~11 KB pages all rendering `No pudimos cargar el evento`, because `.env.local` points at the **remote** project,
**When** the story is signed off,
**Then** Completion Notes record, **measured on a local stack rebuilt to the 6.8a anchors** (204 rounds · 28 roster · `fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0 · 12 awards · **40 spins / 40 award_result / 28 award_result_winner**):
- a real **anon** PostgREST session against all five tables **before** any reveal — the same `42501` / empty answer 6.8a measured, now with a policy present rather than absent;
- the ceremony walked **one `reveal_spin` at a time**, printing after each call the anon-visible row counts for `spin` / `award_result` / `award_result_winner` / `award` — ⭐ the sequence must be **strictly monotone** and must equal the revealed prefix exactly, never one row more;
- ⭐ the **out-of-order refusal** exercised with a real call, and the **double-reveal** refusal, each by typed `reason`;
- the two-sided AD-22 grep over the **rendered** viewer surfaces: after `k` reveals, the revealed award names **APPEAR** and every unrevealed name, the `spin_plan`, the `snapshot_id` and the `luck_weight_table` **DO NOT** — with the **page byte sizes and a corpus-name hit count printed alongside**, so the grep is proven non-vacuous the way 6.8a's re-run was (66 KB / 37 KB, 28 distinct player names each);
- `ceremony.state` / `completed_at` after the final reveal, and the `IC910` refusal of a backward step;
- the `audit_log` rows written (one per reveal, action `reveal_spin`) and the `timeline_feed` rows written (one per reveal, `entry_type = 'award_reveal'`), both counted, not asserted.

---

## Tasks / Subtasks

> Build order: **T0 (read)** → **T1 (pin the gate semantics in comments)** → **T2 (migration `0028`)** →
> **T3 (`reveal_spin`)** → **T4 (retarget the four suites + the new pgTAP file)** → **T5 (the lib +
> route)** → **T6 (the feed writer + its Vitest half)** → **⛔ T7 (THE BAR) gates sign-off** →
> **T8 (mutation)** → **T9 (gates)**.
> ⚠ **Write the policies before the RPC.** The RPC's whole observable effect is a policy flipping a
> row into view; building it first means testing it against a gate that does not exist.

- [x] **Task 0 — Read before you write**
  - [x] ⭐ [ARCHITECTURE-SPINE.md:185-188 (AD-22)](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) **in full** — note that it names **two different predicates**: catalog metadata / live-category sets / results gate on `spin.revealed_at`, while *"the seed/snapshot are gated on `ceremony.state`"*. Then `:110-113` (**AD-7**, which enumerates the six reveal-gated tables by name), `:115-118` (AD-8), `:135-138` (AD-12 / fail-closed `is_admin()`), `:160-163` (AD-17), `:130-133` (AD-11 — *"every viewer surface is fully reconstructable from a published-state read alone"*, which is why the reveal must be a **row state**, not a broadcast), `:222-223` (the commitment paragraph), `:230` (the realtime vocabulary — `spin.reveal` is in it).
  - [x] [SOLUTION-DESIGN §4](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L264) `:264-300` — the whole RLS section, especially the reveal-gated sketch at `:283-288`. Then **§9.5** `:431-438` (bundle, commitment & reveal timing) and `:158-256` (the DDL sketch — ⚠ it is **stale**; the as-built columns are in Dev Notes below).
  - [x] ⭐ [0002_rls.sql:19-31](supabase/migrations/0002_rls.sql#L19) (`is_admin()` / `jwt_steamid64()` verbatim), **`:53-55`** (the `(select public.is_admin())` init-plan wrap — **mandatory house style**), **`:57-79`** (*"RLS is the row gate, GRANT is the table gate — need BOTH"*), and ⭐ **`:87-98`**, which names you: *"When a staged table lands (`stat_row` → Epic 3; **reveal-gated `award*`/`spin` → Epic 6**), it MUST expose staged rows with TWO SEPARATE policies, never OR'd into one … a malformed admin policy can only ever ADD admin's own rows."*
  - [x] ⭐ [0025_ceremony_results.sql:44-52](supabase/migrations/0025_ceremony_results.sql#L44) (**DECISION B in full — the standing instruction**), `:63-69` (**DECISION D**, the composite FK AC3 leans on), `:54-61` (DECISION C, the deferred `is_shared` trigger), `:126-131` / `:190-199` / `:255-261` (the table comments), `:350-360` (the grants).
  - [x] ⭐ [0027_ceremony_run.sql:148-167](supabase/migrations/0027_ceremony_run.sql#L148) — **the OUT OF SCOPE block is effectively your scope list, already written.** Then `:14-19` (*"THE ACCESS POSTURE DOES NOT MOVE"*), `:106-108` (**name every CHECK**), `:169-175` (the clean-apply trap), `:316-328` (⭐ **`security definer` under FORCE RLS depends on the owner's `BYPASSRLS`** — read this twice, see DECISION G), `:476-567` (`assert_ceremony_transition` + IC910), `:600-1169` (`persist_ceremony` end to end — the RPC shape you are copying), `:1183-1188` (the EXECUTE revoke/grant), `:1154-1157` (*"`spin.reveal` is 6.8b's to emit, per spin"*).
  - [x] [0023_award_catalog.sql:169-215](supabase/migrations/0023_award_catalog.sql#L169) — the `award` posture, `award_admin_read`, and ⭐ `:196-198`'s *"IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22"*. Then [0024_ceremony_lock_snapshot.sql:143-171](supabase/migrations/0024_ceremony_lock_snapshot.sql#L143) (its OUT OF SCOPE block, which homes the commitment surface, the realtime gap and the `award_reveal` writer to you by name), `:194-211` (the `ceremony` DDL), `:234-253` (its RLS + grants — note **no DELETE to `service_role`**).
  - [x] ⭐ [0013_advance.sql:809-845](supabase/migrations/0013_advance.sql#L809) — the **only** Broadcast pattern in the codebase, with its three ⚠ blocks: post-commit by construction, *"DO NOT 'FIX' THE ERROR SWALLOWING"*, and *"DO NOT build a second emitter"*.
  - [x] [lib/ceremony/lock.ts](lib/ceremony/lock.ts) **in full** — ⭐ **this is the named template for your typed-refusal wrapper**: a discriminated `{ok:true,…} | {ok:false, reason:<union>}`, a `Set` of trusted reasons, **fail closed** on an unrecognised `error` *or* `reason` (`:94-100`), and an ok-payload **shape check** before trusting it (`:102-115`). Then [app/api/admin/ceremony/route.ts](app/api/admin/ceremony/route.ts) (the route shape, and ⚠ `:27-29`, which already flags *"Publishing the seed and the commitment to the AUDIENCE is Story 6.8's, through a different surface"*) and [lib/admin/command-route.ts](lib/admin/command-route.ts) `:73-117` (`handleAdminCommand` — the actor is **always** `gate.steamid64`, never the body).
  - [x] [lib/feed/model.ts:110-131](lib/feed/model.ts#L110) and `:180-200` (the `award_reveal` branch and its `{title?, subtitle?}` detail contract), [lib/feed/read.ts:88-90](lib/feed/read.ts#L88) (`ceremonyUnlocked`), [lib/realtime/status.ts:24-33](lib/realtime/status.ts#L24) (`NUDGE_EVENTS` — ⚠ it lists four events on `tournament:<id>`; `spin.reveal` rides `ceremony:<id>` and its **consumer** is 6.10's, see DECISION F).
  - [x] [6-1-award-catalog-and-buckets.md:37-40](_bmad-output/implementation-artifacts/6-1-award-catalog-and-buckets.md#L37) (**AC4 — the secrecy is the absent grant, not the blur**), `:62-71` (what 0023 built and why 6.8 is *"an opening, never a tightening"*), `:242-243` (its scope boundary naming you), ⭐ `:258` (**the mock trap** — `mock-leaderboards.html:483-515` blurs the *real* names in CSS; ⛔ do not implement that), and `:508-512` (the mutation rows that will redden).
  - [x] [6-2-…md:1143](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L1143) (**DECISION F**, flagged for you by name), `:246` (*"6.2 freezes `fair_seed` and names it `seed_hex` in the server contract; it publishes nothing to anon"*), `:170-178` (the seed provenance chain), `:1045` (the AD-22 grep table you are extending).
  - [x] [6-8a-…md](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md) — its **AC9** (`:113-120`), its *"Explicitly NOT this story"* table (`:487-503`), its Completion Notes' measured posture and corpus numbers, and its **Review Findings** in full (the seven-occurrence guard-the-guards defect, the `set constraints` transaction-scope trap, the `bool_and`-over-a-filtered-set blindness).
  - [x] [deferred-work.md:280](_bmad-output/implementation-artifacts/deferred-work.md#L280) (**AC7's item, verbatim**), `:277` (why the transition trigger exists), `:333` (the `is_shared` definer fix — *"decided now, before that policy exists"*; **you are that policy**), `:361` (⚠ `luck_weight_table` stays mutable — a commitment that does not fully bind, 6.9's), `:81` (the feed-writer gap), `:265-266` (award names accept zero-width chars and have no length bound — **they become viewer-visible the moment you grant**), `:279` (`STATUS_FOR` numerics untested; you add a fifth map).
  - [x] Sweep-prove the greenfield claim before writing a line: **nothing named `reveal_spin`, `revealed_at` stamping, `award_viewer_read`, `spin_viewer_read`, `ceremony_viewer_read`, or any `award_reveal` writer exists anywhere in `supabase/`, `lib/` or `app/`.** (Confirmed at contexting — `revealed_at` appears only as a column definition, a NULL write and a comment. **Re-confirm, do not assume.**)

- [x] **Task 1 — Pin the gate semantics IN COMMENTS before implementing (AC: 1-4)**
  > Same discipline as 6.3's E1–E4 and 6.5's L1–L12. Each is a place where two honest implementers
  > reading AD-22's one paragraph build a different gate. Each gets a named comment at its site and a
  > pgTAP assertion in T4.
  - [x] **R1 — the grant and the policy are ONE change.** Never commit an intermediate state where one exists without the other. `0025:51-52`.
  - [x] **R2 — `SELECT` only, to `anon` and `authenticated`, on every one of the five tables.** No `INSERT`/`UPDATE`/`DELETE` to any client role, ever (AD-7, `0025:166-170`). The pgTAP assertion is the four-verb `bool_or` matrix, not a single-verb check.
  - [x] **R3 — two policies, never OR'd, per table.** `<t>_viewer_read` (`to anon, authenticated`) and `<t>_admin_read` (`to authenticated`). ⛔ Never `using (revealed_at is not null or public.is_admin())` — `0002:95-98` explains exactly what that costs.
  - [x] **R4 — wrap every helper call as `(select public.is_admin())`.** Init-plan hoisting; `0002:53-55`. A bare `is_admin()` in a `USING` clause is re-evaluated **per row**.
  - [x] **R5 — `award_result_winner` may gate on its OWN `spin_id` only because of `0025`'s composite FK.** Write the citation at the site. If that FK ever goes, the gate silently becomes a hole.
  - [x] **R6 — a pity result reveals NO catalog award.** `award_id is null` on pity rows (`0026:90-91`), so the `exists` in AC4 is naturally blind to them. Assert it positively rather than relying on it.
  - [x] **R7 — the commitment is COLUMN-scoped, and the un-granted set is the load-bearing half.** A row policy cannot hide a column. `snapshot_id`, `spin_plan`, `luck_weight_table`, `algorithm_version` stay ungranted. ⚠ **A column added to `ceremony` later is un-granted by default — that is fail-closed and correct; say so** so nobody "fixes" it with a table-wide grant.
  - [x] **R8 — reveal is FORWARD-ONLY and DENSE.** The lowest unrevealed `spin_index`, one at a time. `revealed_at` is never un-stamped and never back-dated. The published spin order and the reveal order are the same order (UX-DR32/42).
  - [x] **R9 — a double reveal is a typed REFUSAL, not a silent no-op.** Mirror `already_persisted` (`0027:671-680`). An admin who double-taps must learn which fact is true, and a no-op would write a second `audit_log` row or none at all — both wrong.
  - [x] **R10 — the feed row and the reveal commit together or not at all (AD-6).** One transaction. A feed entry for an unrevealed spin is the exact spoiler AD-22 exists to prevent.
  - [x] **R11 — every new CHECK is written `(… ) is true` and is NAMED.** *"A CHECK that can evaluate NULL is SATISFIED"* (`6-8a:426-431`). All CHECKs raise `23514`; pgTAP asserts the **name**.
  - [x] **R12 — no `security definer` on anything that mutates.** `security invoker` + `set search_path = ''`. Definer is reserved for anon-reachable narrow reads and the codebase has exactly one (`award_catalog_count`).

- [x] **Task 2 — Migration `0028_reveal_gating.sql`: the five gates (AC: 1, 2, 3, 4, 7)**
  - [x] House header block: file-path line, `Logical migration 0028 — reveal-gating and the commitment surface (Story 6.8b, FR-24/FR-30, AD-22)`, the ⭐ thesis paragraph, the new SQLSTATE declaration (**`IC901`–`IC910` are taken; `IC911` is yours**), lettered DECISION blocks with the deciding human + date, and an explicit **OUT OF SCOPE — do NOT add here** list naming the owning story for every deferral.
  - [x] `spin`, `award_result`, `award_result_winner`, `award`: `grant select … to anon, authenticated` **plus** `<t>_viewer_read` and `<t>_admin_read`, in the `0002:87-98` form. Keep `ENABLE`+`FORCE`.
  - [x] `ceremony`: `ceremony_viewer_read … using (state <> 'not_started')` **plus** the **column-level** `grant select (id, tournament_id, state, seed_demo_sha256, started_at, completed_at) on public.ceremony to anon, authenticated`. ⛔ **No table-wide grant on `ceremony`.**
  - [x] `comment on policy` (or a `comment on table` addendum) for each, citing AD-22 and naming what the policy deliberately does **not** expose.
  - [x] AC7: `create or replace begin_match_grace` / `resume_match` / `bind_match_demo` with the `ceremony_locked` guard, copying `mark_walkover`'s 6.2 form byte-for-byte in shape. ⛔ **`create or replace` inside `0028` — never an edit to `0015`/`0016`.**
  - [x] `explain (costs off)` a viewer-role `select` on **all four** gated tables and paste every plan. `award_result` / `award_result_winner` must ride `award_result_spin_award_key` / `award_result_winner_spin_key` (both lead on `spin_id`) — **no new index there**. ⚠ **`award` is the one gate with no index behind it**: it probes `award_result` by `award_id` and nothing indexes that column. Measure it, record the plan, and **decide in writing** whether 12-awards-over-40-results justifies an index or a sequential scan is correct. ⛔ Do not add one you have not measured.
  - [x] ⚠ **Clean-apply note** (the 4.3 trap, `0027:169-175`): a grant/policy migration adds no validated CHECK, so state explicitly that there is no clean-apply hazard here rather than leaving the section absent.

- [x] **Task 3 — `reveal_spin` (AC: 5, 6, 8)**
  - [x] Signature `public.reveal_spin(p_ceremony_id bigint, p_spin_index int, p_actor text) returns jsonb`, `security invoker`, `set search_path = ''`, every reference schema-qualified.
  - [x] Lock order: unlocked existence peek (must not lock) → `ceremony for update` → re-read under lock. ⚠ Keep it a **subset in the same relative order** as `persist_ceremony`'s and `lock_ceremony`'s, or you have built an ABBA deadlock (`0027:583-589`).
  - [x] Guards, **all before any write**, each a typed `{ok:false, reason:'<snake_case>'}`: `no_ceremony` (peek **and** the post-lock NULL re-check — `0027:663`'s pattern), `ceremony_not_spinning`, `no_such_spin`, `already_revealed`, `out_of_order` (carrying the expected index as context), `unknown_actor` (resolve `p_actor` against `player` **before** the write, `0027:985-991`).
  - [x] The literal separator comment `-- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──`.
  - [x] Writes, in one transaction: stamp `revealed_at`; insert the `award_reveal` `timeline_feed` row (AC8); if this was the highest `spin_index`, `update ceremony set state = 'complete', completed_at = now()` (AC6); insert **exactly one** `audit_log` row, `action = 'reveal_spin'`, with before/after in `detail`; `perform realtime.send(...)` for `spin.reveal` on `ceremony:<id>`.
  - [x] `revoke execute on function public.reveal_spin(bigint, int, text) from public; grant execute … to service_role;` — ⚠ `create function` grants EXECUTE to `PUBLIC` and both client roles inherit it, so **without the revoke a viewer can reveal a spin off the Data API** (`0027:1183-1188`).
  - [x] Declare the closed refusal-reason set **once**, in a comment, and mirror it in the TS lib (T5). ⚠ 6.8a's review found the Go mirror asserted *"against a hand-copied duplicate of itself"* — see T4's closed-set rule.

- [x] **Task 4 — pgTAP: `0028_reveal_gating_test.sql` + the four retargets (AC: 2, 3, 4, 9)**
  - [x] New file, house shape: `begin;` → `create extension if not exists pgtap with schema extensions;` → `set local search_path = extensions, public;` → **`select plan(N)` with a section-by-section accounting comment block above it** (⚠ 6.8a's review caught two section headers contradicting the plan block — restate the accounting in Completion Notes) → sections → `select * from finish(); rollback;`.
  - [x] Fixtures: seed as `postgres`, then drive the behavioural blocks under `set local role anon` / `authenticated` with `select set_config('request.jwt.claims', …)` for the admin/viewer matrix. Re-derive every id **by name** through a `create temporary view f as …` (`0027:161-177`), never `limit 1`.
  - [x] `create function pg_temp.probe_reveal(...) returns text` catching `exception when others`, returning `'ok'` / the reason / `'raised:'||sqlstate` — so a **raising** mutant reddens a named test instead of aborting the transaction (`6-2:139`).
  - [x] ⭐ **The core assertion is a walk, not a snapshot.** With N spins persisted and zero revealed, assert the anon-visible counts on all four tables are `0`; then reveal spins `1..N` one at a time, asserting after each that the visible count equals the revealed prefix **exactly** — one row more is as much a failure as one row fewer.
  - [x] Assert the **column** gate on `ceremony` with `has_column_privilege` in **both** directions: granted for the commitment columns, **`false` for `snapshot_id`, `spin_plan`, `luck_weight_table`, `algorithm_version`**.
  - [x] Assert a **pity** spin's reveal exposes its `award_result` and `award_result_winner` but adds **zero** `award` rows (R6).
  - [x] Assert the two-policy separation is real: with the admin policy dropped, a viewer still sees exactly the revealed set (that is the property `0002:95-98` buys).
  - [x] `reveal_spin` refusals: one named test per reason, through `pg_temp.probe_reveal`, asserting the **reason string**, not merely "some error". The `IC910` backward-transition refusals by SQLSTATE **and** constraint name.
  - [x] ⭐ **Guard the guards — the project's signature defect, at its SEVENTH occurrence** (`6-8a:909`: *"`if len(inputReachable) != 6` measures the size of a map literal written two lines above it, and nothing in the test reads `ceremony.go`"*). Every closed-set assertion here must **read its evidence** — the reason set from the function's `prosrc`, the policy set from `pg_policy`, the granted column set from `information_schema.column_privileges` — never from a literal copied beside it. Exclude degenerate fixtures; assert **exactly one** case per uniquely-claimed property.
  - [x] ⚠ **`bool_and` over a filtered set returns TRUE when a name is ABSENT** (6.8a's review). Any "all of these exist and are X" assertion must first assert the **count**.
  - [x] Retarget all four sites in AC9's table, each with a comment saying what it used to claim, what it claims now, and why the new claim is **stronger**. ⛔ Do not delete an assertion; move it.
  - [x] ⚠ **`supabase db reset` before running the suite** — every story since 6-4a leaves the QA corpus in the local DB.

- [x] **Task 5 — `lib/ceremony/reveal.ts` + `app/api/admin/ceremony/reveal/route.ts` (AC: 5)**
  - [x] Mirror [lib/ceremony/lock.ts](lib/ceremony/lock.ts) exactly: `import 'server-only'`, the discriminated result union, a `REVEAL_REASONS` `Set`, **fail closed** on an unrecognised `error` or `reason`, and an **ok-payload shape check** before trusting the reply.
  - [x] The route goes through `handleAdminCommand` — ⚠ [lib/admin/route-coverage.test.ts](lib/admin/route-coverage.test.ts) reddens if it does not. `STATUS_FOR` typed as `Record<Extract<Result,{ok:false}>['reason'], number>` so a missing reason is a **compile error**.
  - [x] ⚠ **`vitest.config.ts:17` restricts collection to `lib/**`** — a test under `app/` **silently does not run**. Colocate `lib/ceremony/reveal.test.ts`; the route's numeric `STATUS_FOR` values stay untested for the same reason every other route's are (`deferred-work.md:279`, Epic 7) — **say so, do not pretend otherwise**.
  - [x] ⛔ **No viewer UI.** `/ceremonia` stays the Story-5.7 `<Placeholder>`; the wheel, the verify strip and `Verificar la ceremonia` are 6.10/6.9's.

- [x] **Task 6 — The `award_reveal` feed writer's read-side proof (AC: 8)**
  - [x] The **writer** is SQL (T3). This task proves the round trip: a Vitest case in `lib/feed/model.test.ts` (or a colocated new file under `lib/`) that feeds a real reveal-shaped `detail` through `toCardModel` and asserts the gold node, the title/subtitle, and that a **missing** `detail` still degrades to `es.award.teaserTitle` rather than throwing (`lib/feed/model.ts:186-188`).
  - [x] Assert the pity and zero-winner `detail` shapes the RPC actually writes — ⚠ **not a hand-invented shape**; take them from the migration.
  - [x] ⛔ No new i18n key. ⛔ No change to `TimelineFeed.tsx` — the branch is already built (`:99`) and its comment says *"do NOT remove"*.

- [x] **Task 7 — ⛔ THE BAR: the real corpus, the walk, the two-sided grep (AC: 10) — this gates sign-off**
  - [x] Rebuild the local stack and the 14-demo corpus by the standing recipe (decompress `demos/*.dem.gz`; curate the payload from a throwaway Vitest file because `lib/awards/catalog.ts` is `server-only`; parse-before-seed; the `grand_final gf_order=2` bracket trick; approve only `ziivanto`; `lock_ceremony`), then run `worker/ceremony.Run` to persist. Anchors: **204 rounds · 28 roster · `fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0 · 12 awards · 40 spins / 40 award_result / 28 award_result_winner**. ⚠ `content_sha256` will differ again and that is correct.
  - [x] ⚠ **WinNAT eats DB port `54322`** — elevated `net stop winnat` / `net start winnat`. Kong can remap to host `55321` while `supabase status` still reports `54321`.
  - [x] ⭐⭐ **Build the Next app with the LOCAL `NEXT_PUBLIC_*`.** They are inlined at build time; against the remote project every page renders `No pudimos cargar el evento` at ~11 KB and **every grep comes back falsely clean**. Prove non-vacuity by printing page byte sizes and a corpus-name hit count, exactly as 6.8a's re-run did.
  - [x] Print the anon-visible matrix **before** any reveal, then after each of the 40 reveals. The two-sided grep at `k = 0`, at an intermediate `k`, and at `k = 40`.
  - [x] ⚠ **A column-level grant changes how `ceremony` must be queried.** PostgREST's default `select=*` asks for every column, so an anon request for `ceremony` will `42501` on the **ungranted** columns even though the row is visible — the read must name its columns explicitly. **That failure is the gate working, not a bug**; prove both branches (explicit columns → 200 with the commitment; `select=*` → refused) so the distinction is on the record before someone "fixes" it with a table-wide grant. Any server-side reader you write must select the granted set by name.
  - [x] Harness convention: throwaway `worker/cmd/qa68b/main.go` + a throwaway Vitest file + `_qa68b/`, **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean **while present and after removal**. ⚠ `worker/cmd/qa54` is still in the tree and still not yours to delete.
  - [x] ⚠ **`worker/ceremony.Run` is invoked from nowhere** — no CLI, no `main.go` wiring, zero importers. The harness is the only caller; do **not** wire a production entry point in this story (see Question 3).

- [x] **Task 8 — Mutation pass, before review (non-optional) (AC: 9)**
  > Epic-5 retro Action Item #3 makes a reviewer-independent mutation pass a review gate, and **every
  > prior story's own table was optimistic until it was hardened**: 6.2 reported 43/0 and the reviewer
  > found 5 survivors in 6; 6.8a's first runs had 3 SQL + 3 Go survivors, every one a real gap.
  - [x] **Control pass on unmutated source first; void the run unless it is green.** Read/write mutation files as **BYTES** (6-4a lost 12 of 18 to a CRLF round-trip). Whole-suite runners, never a `-run` filter. `NOT-APPLIED` is an outcome distinct from `killed`. Verify restoration by **SHA-256**. Record the full per-mutation table.
  - [x] Mutate and record: each `_viewer_read` policy dropped · each `_viewer_read` widened to `using (true)` · `revealed_at is not null` inverted · the two policies merged into one OR'd policy · the `exists` on `award_result` pointed at the wrong column · `award_result_winner` gated on its parent instead of its own `spin_id` (must stay green — R5 says they cannot disagree) · the `award` `exists` losing its `s.revealed_at` predicate · the `ceremony` column grant widened to the whole table · `FORCE` dropped on any table · the `out_of_order` guard removed · the `already_revealed` guard removed · `reveal_spin`'s `revoke execute … from public` removed · the `timeline_feed` insert moved outside the transaction · the `spinning → complete` write removed · `completed_at` left NULL.
  - [x] ⭐ **Record a survivor rather than papering over it**, and record any **bad mutant** of your own — 6.8a did both, and its bad mutant (an unbalanced paren that reddened everything) was *"a 'kill' that proves nothing."*

- [x] **Task 9 — Gates (AC: 10)**
  - [x] **Measure the baseline first** — ⛔ **do not quote 6.8a's table and do not quote `sprint-status.yaml`**; 6.7 quoted `1318/42` from that file when the real figure was `1322/42` and its reviewer had to re-measure. *"Baselines are measured, never quoted."*
  - [x] `npm run lint` → 0 · `npm test` → report the delta and what each new test is · `npm run build` → 0, every viewer route still `ƒ` dynamic, **`/ceremonia` still the `<Placeholder>`**, no `roulette` route · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` → **empty**.
  - [x] `python roulette/vectors/generate_vectors.py --check` → **OK on all seven, all byte-identical**, proven with `git status roulette/vectors/` **empty**. ⚠ This story owes **no new vector** — `0027:159-161`: *"`roulette/vectors/README.md` gives 6.8 no gate."*
  - [x] pgTAP: `supabase db reset` first, then the prior baseline **plus** `0028`'s file, with the four retargeted files re-counted. Restate every `plan(N)` you touched.
  - [x] `git status` + `git diff --stat` proof that `roulette/vectors/**`, `lib/roulette/**`, `worker/awards/**`, `worker/ingest|store|db|config/**` and `supabase/migrations/0001`–`0027` are **byte-untouched**, and that `0028` + its pgTAP file are the only new `supabase/**` entries. ⚠ This story **does** legitimately touch `app/**` and `lib/**` (the route and the lib) — 6.8a's byte-untouched line for those two ends here, deliberately.
  - [x] `0 CRLF` across every touched file. ⚠ `sprint-status.yaml` is CRLF natively.

---

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A — `bundle_hash` is 6.9's, and epic AC1 ships PARTIAL with the owner named.**
Recorded by Cuatro 2026-08-08 ([sprint-status.yaml:138-142](_bmad-output/implementation-artifacts/sprint-status.yaml#L138)) and consistent with every migration header ([0024:150-155](supabase/migrations/0024_ceremony_lock_snapshot.sql#L150), [0025:76-80](supabase/migrations/0025_ceremony_results.sql#L76), [0027:157-158](supabase/migrations/0027_ceremony_run.sql#L157)). `bundle_hash` is SHA-256 of the RFC-8785 canonical bundle; canonicalization, `verification_bundle` and `algo_version` are all 6.9's. **This story creates no `verification_bundle` table** — see Question 1, the one place Cuatro's wording ("lands the shell") could still go the other way.

**DECISION B — the commitment is exposed by a COLUMN-LEVEL GRANT plus a row policy, not by a view and not by a new `security definer` RPC.**
[SOLUTION-DESIGN:287](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L287) says *"`ceremony`: viewer select using (state <> 'not_started'); seed/snapshot exposed per `ceremony.state`"* and leaves the column question open — a row policy cannot hide a column. Three shapes were available: a view, a definer RPC, or column grants. **Column grants win** because they are the only shape that (i) keeps the "grant + policy together" idiom this epic's migrations mandate, (ii) is directly assertable with `has_column_privilege` in both directions, and (iii) **fails closed on a future column** — a column added to `ceremony` later is un-granted by default. A definer RPC would additionally re-open exactly the widening hazard `0023:196-198` warns about.

**DECISION C — publish `ceremony.seed_demo_sha256`, NEVER `tournament.fair_seed`.**
This is the highest-value inherited item in the story. 6.2's DECISION F deliberately loosened `IC908` to permit `value → NULL` so `rollback_match` can un-crown, and justified it *only* because *"6.2 publishes the seed to nobody before it"* — then flagged it **for 6.8, which owns publication** ([6-2:1143](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L1143)). Publishing from `ceremony.seed_demo_sha256` closes that hole **structurally**: `0027`'s `assert_ceremony_transition` makes it write-once once non-NULL ([0027:514-554](supabase/migrations/0027_ceremony_run.sql#L514)), and `ceremony_locked` already refuses rollback after the lock. Publishing from `tournament.fair_seed` would publish a column a rollback can set to NULL. **State this at the site; it is not obvious and it is not documented anywhere else.**

**DECISION D — `award_result_winner` gates on its OWN `spin_id`.**
Cheaper by one join and safe **only** because `0025`'s DECISION D made disagreement with its parent unrepresentable through the composite FK. Cite `0025:63-69` at the policy, because the shortcut and the hole are one edit apart.

**DECISION E — revealing the last spin completes the ceremony, in the same transaction.**
`0027:152` says *"the transition trigger ALREADY PERMITS `spinning → complete`; 6.8b writes it"* but does not say from where. A separate `complete_ceremony` admin action would make AD-22's *"in full at completion"* depend on an admin remembering a second button mid-ceremony — the release would silently not happen. Folding it into the final `reveal_spin` makes completion a **consequence of the last reveal**, atomic by AD-6, and leaves exactly one legal forward step through the trigger.

**DECISION F — `reveal_spin` EMITS `spin.reveal`; nothing in this story CONSUMES it.**
`0027:1154-1157` homes the emit here by name and `SPINE:230` already fixes the event name and the `ceremony:<id>` channel, so the emit is built now, in the `0013:809-845` form. But [lib/realtime/status.ts:28-33](lib/realtime/status.ts#L28)'s `NUDGE_EVENTS` is the **`tournament:<id>`** vocabulary consumed by 5.8's viewer surfaces, and there is no ceremony surface to nudge — `/ceremonia` is a `<Placeholder>`. ⛔ **Do not add `spin.reveal` to `NUDGE_EVENTS` and do not subscribe to `ceremony:<id>`** — that is 6.10's, with the UI that consumes it. `0024:165-167`'s standing rule holds: event names are never invented, and this one is not being invented.

**DECISION G — the `is_shared` deferred trigger becomes LIVE behaviour when your policy lands. Assert its dependency.**
[deferred-work.md:333](_bmad-output/implementation-artifacts/deferred-work.md#L333) says the `security invoker` → `definer` fix had to be decided *"now, before that policy exists"* — **you are that policy.** 6.8a's review then recorded ([6-8a:916](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L916)) that under `FORCE ROW LEVEL SECURITY` RLS applies to the table **owner** too, so `security definer` alone does not make `assert_award_result_is_shared` see every row — *"it works today because the owner is `postgres`; on ownership reassignment the fix reverts to the fail-open behaviour it replaced, with Section G still green."* Add one assertion that the function owner carries `rolbypassrls` (`0027:347-353` already has the primitive) **and** one that the trigger still counts the true winner set with a viewer policy present.

**DECISION H — this story ships NO viewer UI and NO new Spanish copy.**
`/ceremonia` stays the 5.7 `<Placeholder>` (6.10). `LockedAwards.tsx` keeps rendering from the count. The only viewer-visible consequence is that revealed rows become readable and one `award_reveal` feed entry appears per reveal, through a branch 5.6 already built and tested. AD-24 keeps every string in `lib/i18n/es.ts`, and every string this story could need is already there.

### The posture you are opening — the exact state of the world today

Measured by 6.8a with **rows present**:

```
rows present:                    spin=40  award_result=40  award_result_winner=28  award=12
service key over PostgREST:      200 on all four
anon         over PostgREST:     http 401, SQLSTATE 42501 on all four
authenticated over PostgREST:    http 403, SQLSTATE 42501 on all four
anon/authenticated hold ANY data verb on ANY of the four:  false
spins with revealed_at NOT NULL: 0
policy set on the four:          exactly 0023's dormant award.award_admin_read, unchanged
```

Policies and grants, per table, **as of `0027`**:

| table | policies today | anon/auth grants today | RLS |
|---|---|---|---|
| `award` | `award_admin_read` ([0023:177](supabase/migrations/0023_award_catalog.sql#L177)) | **none** | ENABLE+FORCE |
| `ceremony` | `ceremony_admin_read` ([0024:243](supabase/migrations/0024_ceremony_lock_snapshot.sql#L243)) | **none**; `service_role` has S/I/U and **no DELETE** | ENABLE+FORCE |
| `spin` | **zero** | **none** | ENABLE+FORCE |
| `award_result` | **zero** | **none** | ENABLE+FORCE |
| `award_result_winner` | **zero** | **none** | ENABLE+FORCE |

⚠ `award.award_admin_read` is **dormant** — `authenticated` holds no grant on `award`, so an admin `42501`s before RLS is consulted ([0027 test:1131-1136](supabase/tests/0027_ceremony_run_test.sql#L1131)). Granting `SELECT` to `authenticated` in this story makes it live for the first time. Assert it.

### Schema you are gating (as it stands at `0027` — the SOLUTION-DESIGN sketch is STALE)

```sql
ceremony(id, tournament_id, state, seed_demo_sha256, snapshot_id, algorithm_version,
         spin_plan jsonb, luck_weight_table int[], started_at, completed_at)
   -- state: not_started|locked|spinning|complete, forward-only via assert_ceremony_transition (IC910)
   -- seed_demo_sha256, snapshot_id: write-once once non-NULL (0027:514-554)
   -- completed_at: SHELL since 0024:204, written by nobody -> AC6
spin(id, ceremony_id, spin_index, kind, live_award_ids jsonb, revealed_at timestamptz)
   -- revealed_at: no column default; persist_ceremony writes it explicitly NULL (0027:1049-1054)
award_result(id, spin_id, award_id NULLABLE, kind, deciding_value numeric,
             deciding_num, deciding_den, outcome_kind NOT NULL, is_pity, is_shared,
             tie_ladder_exit_step int)
award_result_winner(id, award_result_id, spin_id, winner_entry_id)
award(id, tournament_id, name, bucket, class, deciding_stat, direction, secondary_stat,
      eff_num_key, eff_den_key, floor_rounds, floor_kills, priority)
```

⛔ **CORRECTED AT CODE REVIEW 2026-08-08 — THE PARAGRAPH BELOW IS THE CONTEXTING ASSUMPTION, AND THE
MEASUREMENT REFUTED IT. Read it as the question, not the answer.** `explain (costs off)` under a
viewer role shows that NONE of the three gates rides an index: Postgres hoists each `exists` into a
hashed SubPlan over a `Seq Scan on spin`, so `award_result_spin_award_key` and
`award_result_winner_spin_key` are irrelevant to these plans. The right conclusion survives — **no
index was added** — but on evidence, not on the reasoning below. The measured plans are pasted at the
policy sites in `0028`.

**Indexes — the contexting assumption was that three of the four gates ride an existing one:** `award_result_spin_award_key unique (spin_id, award_id)` ([0025:178](supabase/migrations/0025_ceremony_results.sql#L178)) and `award_result_winner_spin_key unique (spin_id, winner_entry_id)` ([0025:247](supabase/migrations/0025_ceremony_results.sql#L247)) both **lead on `spin_id`**, so AC3's two gates are covered. ⚠ **AC4's `award` gate is not.** It probes `award_result` by `award_id`, and the only index carrying `award_id` leads on `spin_id`, so it cannot serve that lookup — the whole index list is `stat_row_approved_idx`, `award_tournament_priority_idx` and the constraint-backed uniques ([0023:156](supabase/migrations/0023_award_catalog.sql#L156), [0021:143](supabase/migrations/0021_leaderboard.sql#L143)); **there is no `award_result(award_id)` index.** At 12 awards over 40 results a sequential scan is almost certainly right and an index would be noise — **but measure it with `explain (costs off)` under a viewer role and record the plan and the decision. Do not add an index you have not measured, and do not claim coverage you have not proven.**

### SQL three-valued-logic traps this epic keeps paying for

Every one of these was a real defect in a prior story. Re-read before writing a guard.

- **A CHECK that can evaluate NULL is SATISFIED.** Write every new CHECK as `(… ) is true`. And **name it** — all CHECKs raise `23514`, so pgTAP asserts the name (`0027:106-108`).
- **`string_agg` skips NULLs** and **`jsonb ? NULL` is NULL** — 6.8a's review found three payload guards failing open on exactly this. `coalesce(…, '<null>')`.
- **`jsonb_typeof` is STRICT** — a *missing* key yields NULL, and a NULL `IF` is FALSE, so a payload omitting a key falls through every guard. `coalesce(jsonb_typeof(v -> 'k'), '')`.
- **`NULL not in (…)` is NULL**, which let a vanished ceremony be misreported in 6.8a.
- **NULLs are DISTINCT in a UNIQUE** — this is what defeated `award_result_spin_award_key` once `0026` made `award_id` nullable, and it is the same nullability AC4's join must survive.
- **Postgres does not guarantee OR short-circuit evaluation** — a nested `if`/`case` is the correct form when the second arm can raise.
- **Postgres does not guarantee which of two violated CHECKs it names** — a test asserting a constraint name must break exactly one.
- ⚠ **`set constraints … immediate` is TRANSACTION-scoped, not statement-scoped.** 6.8a's own fix was wrong the first time and took the suite from 68/68 to 6 failures. Any transaction of yours that writes into `award_result`/`award_result_winner` inherits `persist_ceremony`'s normalisation contract (`0027:1005-1006`, `:1119-1125`).

### The APIs and shapes you are extending (transcribed, not remembered)

```sql
-- 0002_rls.sql:19-31 — the two helpers, verbatim
create function public.is_admin() returns boolean language sql stable set search_path = ''
as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) $$;
create function public.jwt_steamid64() returns text language sql stable set search_path = ''
as $$ select auth.jwt() -> 'app_metadata' ->> 'steamid64' $$;

-- 0002_rls.sql:87-98 — the mandated policy form, which names this story
--   create policy <t>_viewer_read on public.<t> for select to anon, authenticated
--     using (status = 'approved');
--   create policy <t>_admin_read  on public.<t> for select to authenticated
--     using ((select public.is_admin()));
```

```ts
// lib/feed/model.ts:128-131 — the detail contract your SQL writer must satisfy
interface AwardRevealDetail { title?: string; subtitle?: string }
// :186-188 — a malformed detail degrades, never throws
const title    = typeof d.title    === 'string' ? d.title    : es.award.teaserTitle;
const subtitle = typeof d.subtitle === 'string' ? d.subtitle : es.award.revealAtCeremony;
```

```
timeline_feed(tournament_id, entry_type, target_match_id, detail)   -- 0017:99-115
  entry_type check in ('match_result','bracket_advance','award_reveal')  -- 0017:109
  -- 'award_reveal' has had NO writer since 0017. You are it.
```

### Conventions that are not negotiable

- **RPC house style** (`6-2:186-201`): `security invoker` + `set search_path = ''` + every reference schema-qualified · unlocked peek first (it must not lock) · every lock in one statement in canonical `id` order · re-read under lock · **every guard before any write** · typed business refusals **RETURNED** as `{ok:false, reason, …context}` · genuine corruption **RAISES** with a custom `IC9xx` + a `hint` · the literal separator comment · exactly one `audit_log` insert with before/after · `revoke execute … from public; grant execute … to service_role;`.
- **`IC901`–`IC910` are taken. `IC911` is yours.**
- **Migrations:** `NNNN_snake_case_slug.sql`, hand-created (never `supabase migration new`, which stamps a timestamp), one migration per story, a paired `supabase/tests/NNNN_*_test.sql`. **Never edit an applied migration.** Shipped functions change only by `create or replace` in your file, and **the diff of each replaced body is pasted in Completion Notes**.
- **Admin routes:** through `handleAdminCommand` only; the actor is always `gate.steamid64`, never the body; audit is written inside the SQL, never by the route.
- **Vitest only collects `lib/**/*.test.ts`** (`vitest.config.ts:17`). `npm test` does **not** typecheck — run `npm run build` before you believe the suite.
- **Stack pinned, nothing new permitted:** Go 1.26.4 stdlib only · Node ≥20.9 · TS ^5.9 (`verbatimModuleSyntax: true` → every type-only import is `import type`) · Vitest 4.1.9 · Next.js 16.2.10 · Python 3 stdlib only. **No new npm package, no new Go module.**
- **Git:** subject line only. No body, no trailers.
- **THE BAR harness is throwaway and never committed**, with the Go gates proven clean while present *and* after removal.

### Previous story intelligence — 6.8a (`e7a5aa0`), 6.7, 6.2, 6.1

- **6.8a's review found two clusters, both TEST gaps rather than broken behaviour**, and both classes are live for you: SQL three-valued logic defeating four guards, and *"the `audit_log` row was asserted by ZERO tests in a migration whose own comment said EVERY key below is asserted in pgTAP."* ⭐ **Your `reveal_spin` writes an audit row and a feed row. Assert both, by content, from the start.**
- **The guard-the-guards defect is at its SEVENTH occurrence** and has appeared in every single story of this epic. The two reworked 6.8a tests now *read their evidence* (a `ceremony.go` source scan; the migration's own reason literals) instead of comparing a map to a copy of itself. **Copy that technique; do not invent a second design.**
- **The author's own mutation table is not proof.** 6.2 reported 43/0 and its reviewer found 5 survivors in 6. 6.8a's first runs had 3 SQL + 3 Go survivors, every one a real gap.
- **6.1 shipped the strictly-closed end state on purpose** so that this story is an opening. Its mutation rows #42/#43/#44/#52 exist to catch exactly the grant you are about to add — **retarget them, and expect them to be the first thing that reddens.**
- **6.2's AD-22 grep table** (`6-2:1045`) is the artifact AC10 extends from one-sided to two-sided.

### The measurements this story must be designed against

- ⛔ **All 12 main spins resolved `no_eligible_players`.** `0/28` players clear the FR-21 `24`/`20` floors, and 6.8a's run persisted **12 zero-winner main results + 28 pity winners**. So the ceremony this story reveals is **28 consolation prizes and zero category trophies** — every one of the 12 main reveals is a "nobody qualified" card. AC8's zero-winner `detail` branch is therefore the **common** case, not an edge case, and Question 2 escalates the product consequence.
- Byte accounting is unaffected by this story: main spins **22 bytes**, pity **27**, whole ceremony **49**. Nothing here draws a byte. If any of those move, it is a defect.

### Inherited items this story is named in

| item | source | disposition here |
|---|---|---|
| `ceremony_locked` not on grace/bind | [deferred-work.md:280](_bmad-output/implementation-artifacts/deferred-work.md#L280) | **AC7 closes it** |
| `award_reveal` feed writer, unowned across Epic 6 | [0024:170](supabase/migrations/0024_ceremony_lock_snapshot.sql#L170), `deferred-work.md:81` | **AC8 closes it** |
| DECISION F's `fair_seed` un-freeze vs publication | [6-2:1143](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L1143) | **DECISION C closes it structurally** |
| `is_shared` definer trigger's un-asserted BYPASSRLS dependency | `deferred-work.md:333`, `6-8a:916` | **DECISION G asserts it** |
| `luck_weight_table` mutable after freeze | `deferred-work.md:361` | ⚠ **NOT closed — 6.9's.** Your commitment publishes `seed_hex` while this input stays editable. Record it. |
| award `name` accepts zero-width chars, no length bound | `deferred-work.md:265-266` | ⚠ **becomes viewer-visible here.** Record it; the fix is a catalog constraint, not a policy. |
| `STATUS_FOR` numerics untested (5th map added) | `deferred-work.md:279` | ⚠ Epic 7's. Say so. |
| FR-21 floors slice (`24`/`20`) | `deferred-work.md:269`, DECISION C held five times | ⚠ **owed before Epic 6 closes** — Question 2 |

### Git intelligence — recent commits

`e7a5aa0` 6.8a code review (three-valued-logic guards + the audit row) · `a8aa4bc` 6.8a (`0027` + `persist_ceremony`, 934 lines) · `f9a2358` 6.7 pity (`0026`) · `ba894d1` 6.6 anti-sweep (`0025`) · `d551f34` 6-5b ladder vector. The shape is consistent: **one migration + its paired pgTAP file + the Go/TS halves + the story file + `sprint-status.yaml`**, subject line only, no body.

---

## Project Structure Notes

**New**
- `supabase/migrations/0028_reveal_gating.sql`
- `supabase/tests/0028_reveal_gating_test.sql`
- `lib/ceremony/reveal.ts`
- `lib/ceremony/reveal.test.ts`
- `app/api/admin/ceremony/reveal/route.ts`

**Modified**
- `supabase/tests/0023_award_catalog_test.sql` · `0024_ceremony_lock_snapshot_test.sql` · `0025_ceremony_results_test.sql` · `0027_ceremony_run_test.sql` — the four retargets (AC9)
- `lib/feed/model.test.ts` — the reveal-shaped `detail` round trip (AC8)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-8b-reveal-gating-and-commitment.md`

**Created and deleted before commit**
- `worker/cmd/qa68b/main.go`, a throwaway catalog-dump Vitest file, `_qa68b/`

**Must stay byte-untouched (prove with `git status`)**
`supabase/migrations/0001`–`0027` · `roulette/vectors/**` · `lib/roulette/**` · `worker/awards/**` · `worker/ingest|store|db|config/**` · `lib/awards/**` · `lib/i18n/**` · `app/(viewer)/**` · `lib/leaderboard/**` · `0021_leaderboard.sql` and its `24`/`20` floor literals

⚠ 6.8a's byte-untouched line for `app/**` and `lib/**` ends here, deliberately and narrowly: one new route directory and one new `lib/ceremony` module. **`app/(viewer)/**` stays untouched** — there is no viewer UI in this story.

---

## References

- [epics.md:1132-1152](_bmad-output/planning-artifacts/epics.md#L1132) — Story 6.8's three ACs, which this story carries 1:1
- [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) — **AD-22**; `:110-113` AD-7; `:115-118` AD-8; `:135-138` AD-12; `:160-163` AD-17; `:130-133` AD-11; `:222-223` the commitment; `:230` the realtime vocabulary
- [SOLUTION-DESIGN.md:264-300](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L264) — §4 RLS, incl. the reveal-gated sketch `:283-288`; `:431-438` §9.5 commitment & reveal timing
- [prd.md:345-352](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L345) FR-24 · `:397-404` FR-30 · `:415` FR-31 · `:431-444` FR-33/FR-34 · `:496-503` the cross-cutting NFRs
- [EXPERIENCE.md:29](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L29) — *"Every viewer surface is read-only"*; `:90`/`:95`/`:116` the blurred-lock; `:147-154` provably-fair; `:162-173` the choreography
- [DESIGN.md:274](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L274) blurred-lock · `:220` the gold rule · `:296` hide admin actions entirely
- [0002_rls.sql:19-98](supabase/migrations/0002_rls.sql#L19) · [0023:169-215](supabase/migrations/0023_award_catalog.sql#L169) · [0024:143-171,194-253](supabase/migrations/0024_ceremony_lock_snapshot.sql#L143) · [0025:44-80,109-260,350-360](supabase/migrations/0025_ceremony_results.sql#L44) · [0026:90-102](supabase/migrations/0026_pity_award_result.sql#L90) · [0027:148-167,476-567,600-1169,1183-1188](supabase/migrations/0027_ceremony_run.sql#L148) · [0013:809-845](supabase/migrations/0013_advance.sql#L809) · [0017:99-115](supabase/migrations/0017_aprobar_publish.sql#L99)
- [6-8a](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md) (the carve-out, AC9, Review Findings) · [6-2](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md) (DECISION F, the seed chain, the AD-22 grep) · [6-1](_bmad-output/implementation-artifacts/6-1-award-catalog-and-buckets.md) (AC4, the mock trap, the mutation rows) · [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) (`:81,265,266,269,277,279,280,333,361`)
- [epic-5-retro-2026-07-28.md:43](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L43) — *"measure zeros, never narrate them"*

**External (checked 2026-08-08):** Postgres RLS policies are OR'd when permissive, so an `AND` of two axes must live inside one `USING` or use a `RESTRICTIVE` policy — moot here, since none of the five tables carries a `status` column and reveal-state is their only viewer axis. **Say so explicitly** rather than leaving it unaddressed. Supabase's own `auth_rls_initplan` advisor flags a policy that calls an auth helper unwrapped: `(select public.is_admin())` is hoisted into an InitPlan evaluated **once per statement**, while a bare call is re-evaluated **per row** — the same idiom `0002:53-55` already mandates, and the reason this story's policies must not "simplify" it away.
Sources: [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) · [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## Questions for Cuatro

**Q1 — "6-8b publishes `seed_hex` and lands the shell." Does "the shell" mean a `verification_bundle` TABLE, or only the commitment SURFACE?**
`sprint-status.yaml:140-141` says 6.8b "lands the shell", but `0024:144`/`0024:153`/`0027:157` all home the `verification_bundle` table itself, `bundle_sha256` and `algorithm_version` to **6.9**. **Contexting took the migration headers as the more specific authority: this story creates no table and shapes the viewer-readable `ceremony` row so 6.9 widens it rather than redesigning it.** If you meant a real `verification_bundle` shell table in `0028`, say so and AC1 grows one paragraph.

**Q2 — ⛔ The ceremony you are about to make visible is twelve "nobody qualified" cards and twenty-eight consolation prizes.** The FR-21 floors (`24` rounds / `20` kills) exclude **0/28** of the measured roster, so all 12 main spins resolved `no_eligible_players`. DECISION C has held five times and `sprint-status.yaml:46` records that *"a floors slice is owed before Epic 6 closes"*. This is the story where that zero becomes something an audience watches, and **6.9 hashes these bytes**, so the slice gets more expensive after this, not cheaper. Do you want the floors slice before 6.9, or do you accept the ceremony as measured?

**Q3 — `worker/ceremony.Run` has zero callers. Who wires the production entry point?**
There is no CLI, no `worker/main.go` wiring and no route — the orchestrator is test-and-harness-only today. This story's `reveal_spin` presumes rows already exist, which is fine for the harness, but an actual event needs someone to *run* the ceremony. Contexting kept it out of scope (it is neither in `epics.md:1140-1152` nor in 6.8a's hand-off list). Is that Epic 7's, or should 6.9 take it?

**Q4 — Should `reveal_spin` be idempotent (a second call returns `ok:true`) or refuse?**
Contexting chose **refuse**, with a typed `already_revealed`, mirroring `persist_ceremony`'s `already_persisted` — so a double-tap tells the admin which fact is true and cannot write a second `audit_log`/`timeline_feed` row. AD-8 says mutations are idempotent, and 4.3 shipped an *idempotent* conditional advance, so the precedent genuinely cuts both ways. Confirm the refusal, or say "idempotent" and T3's guard changes shape.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), 2026-08-08.

### Debug Log References

Throwaway, deleted before commit: `worker/cmd/qa68b/main.go` (corpus rebuild + reveal walk),
`lib/roulette/bar-qa68b.test.ts` (curate-payload dump), `_qa68b/` (decompressed demos + rendered
pages). `worker/cmd/qa54` is still in the tree and is still not mine to delete.

### Completion Notes List

#### The four questions, answered by Cuatro before a line was written (2026-08-08)

| Q | Answer taken |
|---|---|
| Q1 "lands the shell" | **Surface only, no table.** 0028 creates no `verification_bundle`; it shapes the viewer-readable `ceremony` row so 6.9 widens it. Epic AC1 ships **PARTIAL with 6.9 named**. |
| Q2 the measured ceremony | **Accept as measured, ship 6-8b now.** The zero-winner branch is treated as the COMMON case, not an edge. The FR-21 floors slice stays owed before Epic 6 closes. |
| Q3 `worker/ceremony.Run` has no callers | **Out of scope here.** The QA harness stays its only caller; the gap is recorded, owner still open. |
| Q4 double reveal | **Refuse with `already_revealed`** (not idempotent), mirroring `already_persisted`. |

#### AC9 — the four closed-posture suites, RETARGETED (never deleted)

| site | was | now |
|---|---|---|
| `0023:329-346` | `policies_are = {award_admin_read}`; anon holds **no** verb; `select * from award` **42501s** | policy set gains `award_viewer_read`; anon holds **SELECT only**; the 42501 became **a zero-row count** — the door is open AND the gate behind it holds, which a grant-absence test could never say. +1 new pin that `award_catalog_count` was not widened. **111 → 113** |
| `0024:456-472` | `policies_are = {ceremony_admin_read}`; no anon privilege at all | gains `ceremony_viewer_read`. ⚠ **`has_table_privilege(anon,'SELECT')` STAYS FALSE — measured** — because the grant is COLUMN-scoped, so the ORIGINAL assertion would have stayed green across the whole opening. It is kept (it now pins DECISION B) and **four** join it: any-column SELECT true · the six commitment columns granted · the four secret columns NOT · no writing verb. **116 → 119** |
| `0025:148-182` | "all three tables: NO RLS policy at all"; neither role holds any of four verbs | the **exact six-policy set** (a zero-count could be kept green by deleting one and adding one); anon HAS SELECT on `spin`; the four-verb check split into writing-verbs-refused + SELECT-granted. **68 → 69** |
| ⭐ `0027:1137-1155` | the AC9 triple `'false \| award.award_admin_read \| true'` **with rows present** | a **quadruple** `'true \| false \| <the eight names> \| true'`, still with rows present, still exact-set. ⚠ Fixed a latent bug while there: the `string_agg(… order by 1)` orders by the **constant 1**, not positionally — invisible while the expected set had one element, wrong the moment it had eight. **103 → 103** |

`0003` Section A2's generic FORCE guard stayed green untouched; every table is still ENABLE+FORCE.

#### ⭐ THE BAR (T7) — measured on a local stack rebuilt to the 6.8a anchors

Every anchor reproduced **exactly**: `204 rounds · 28 roster · fair_seed = 1b3cd678…3279c · row_count 28 ·
eligible_count 0 · 12 awards · 40 spins / 40 award_result / 28 award_result_winner / 0 revealed`.
`content_sha256` differed (`661093f1…`, then `0e927ad2…` on the second rebuild) — correct, it is
wall-clock dependent.

**GATE A — the anon matrix BEFORE any reveal, with the policies PRESENT** (6.8a measured the same
zeros with the policies ABSENT; that difference is this story):
```
k=00  spin/award_result/award_result_winner/award = 0/0/0/0
commitment row, named columns : spinning | seed=1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c
the SAME row via `select *`   : REFUSED — permission denied for table ceremony (42501)
```
⭐ Both branches of DECISION B on the record: naming the granted columns returns the commitment;
`select=*` is refused. **That refusal is the gate working, not a bug.**

**GATE C — the refusals, real calls, typed reasons:**
```
out_of_order  {"reason":"out_of_order","expected_spin_index":1,"revealed_spins":0,"spin_index":40,"total_spins":40}
unknown_actor {"reason":"unknown_actor","actor":"nobody"}
no_such_spin  {"reason":"no_such_spin","spin_index":9999,"total_spins":40}
already_revealed (after k=1) {"reason":"already_revealed","revealed_at":"2026-08-08T20:57:44.430235+00:00","spin_index":1}
```

**GATE B — the walk, 40 reveals one at a time. Strictly monotone and equal to the revealed prefix at
every step.** The shape is the measured ceremony: 12 main spins each reveal one award and **zero**
winners, then 28 pity spins each reveal one winner and **zero** awards (R6 at corpus scale — the
award count sticks at 12 from k=12 onward):
```
k=01  1/1/0/1     kind=main  k=12  12/12/0/12  kind=main
k=13  13/13/1/12  kind=pity  k=40  40/40/28/12 kind=pity
```

**GATE D — completion:** `state=complete`, `completed_at=2026-08-08 20:57:44.566294+00`; the backward
step raised `IC910 … cannot move complete -> spinning`; a further reveal returned
`ceremony_not_spinning`. **40 `audit_log` rows** (`action='reveal_spin'`) and **40 `timeline_feed` rows**
(`entry_type='award_reveal'`) — counted, not asserted.

**The two-sided AD-22 grep over RENDERED pages, at k=0, k=6 and k=40**, built with the LOCAL
`NEXT_PUBLIC_*` (⚠ `.env.local` points at the REMOTE project; it was backed up outside the repo,
repointed, and restored byte-identically — SHA `BDE1461F…`). **Non-vacuity printed alongside**:

| k | bracket | ceremonia | home | leaderboards | corpus-name hits | revealed names PRESENT | unrevealed names LEAKED |
|---|---|---|---|---|---|---|---|
| 0 | 34 757 B | 11 545 B | 14 409 B | 66 826 B | 27/27 on bracket+leaderboards | 0/0 | **0/12** |
| 6 | 34 757 B | 11 545 B | 22 233 B | 66 826 B | 27/27 | **6/6** | **0/6** |
| 40 | 34 757 B | 11 545 B | 66 589 B | 66 826 B | 27/27 | **12/12** | 0/0 |

⚠ **The `27/27` denominator does not reconcile with the `28 roster` anchor, and that is unresolved
(code review 2026-08-08).** AC10 asks for the hit count *"the way 6.8a's re-run did (66 KB / 37 KB,
**28 distinct player names each**)"*, and the anchors two paragraphs above claim `28 roster ·
row_count 28` reproduced **exactly**. The table then reports 27 at every `k` with no explanation of
the missing name. ⛔ **Not re-derivable now** — the qa68b harness and `_qa68b/` are deleted, so
re-measuring means a full 14-demo corpus rebuild. The non-vacuity conclusion is unaffected (27 corpus
names appearing on a rendered page is as much proof of a live page as 28 would be), but the FIGURE is
either wrong or under-explained, and the whole point of printing it is that it be re-derivable.
**Carried to 6.11's end-to-end vector, which rebuilds the corpus anyway.**

⭐ **k=6 is the sharp one**: on the same pages, in the same request, exactly six revealed award names
appear and exactly six unrevealed ones do not. `spin_plan` (893 B), `luck_weight_table` (17 B) and the
snapshot `content_sha256` (64 B) were **absent at every k**. `/ceremonia` stayed the 5.7
`<Placeholder>` at 11 545 B throughout. Home grows 14 KB → 22 KB → 66 KB purely from `award_reveal`
feed cards — the progressive release, visible.

#### ⭐ T8 mutation pass — 20 mutations: **19 KILLED · 1 SURVIVED (by design) · 0 NOT-APPLIED**

Control pass green first; bytes not text; whole-suite runners; restore verified by SHA-256
(`AC15A8EC…`) after **every** mutation.

| # | mutation | outcome |
|---|---|---|
| M01 | `spin_viewer_read` dropped | KILLED (migration refuses to apply) |
| M02 | `spin_viewer_read` → `using (true)` | KILLED (0028×6) |
| M03 | `revealed_at is not null` INVERTED | KILLED (0028×6) |
| M04 | `award_result` gate loses `revealed_at` | KILLED (0028×1) |
| M05 | `award_result` gate on the WRONG column | KILLED (0028×4) |
| M06 | `award_result_winner` via its PARENT | **SURVIVED — required by R5** |
| M07 | `award` gate loses `s.revealed_at` | KILLED (0028×1) |
| M08 | `award_viewer_read` → `using (true)` | KILLED (0023×1, 0028×7) |
| M09 | the two `spin` policies MERGED (OR'd) | KILLED (migration refuses to apply) |
| M10 | `ceremony` column grant → table-wide | KILLED (0024×2, 0028×4) |
| M11 | FORCE dropped on `spin` | KILLED (0025×1, 0027×1, 0028×1) |
| M12 | `out_of_order` guard removed | KILLED (0028×7) |
| M13 | `already_revealed` guard removed | KILLED (0028×2) |
| M14 | `revoke execute … from public` removed | KILLED (0028×1) |
| M15 | the `timeline_feed` insert removed | KILLED (0028×8) |
| M16 | the `spinning → complete` write removed | KILLED (0028×4) |
| M17 | `completed_at` left NULL | KILLED (0028×1) |
| M18 | the IC911 dense-prefix guard defeated | KILLED (0028×4) |
| M19 | the `(select …)` init-plan wrap unwrapped | KILLED (0028×1) |
| M20 | `unknown_actor` guard removed | KILLED (0028×3) |

⛔⛔ **CODE REVIEW 2026-08-08 — THIS TABLE IS INCOMPLETE AND TWO OF ITS "KILLS" PROVE NOTHING. Both
are recorded here rather than quietly re-run, because the story's own Task 8 requires exactly that.**

- **Three `_viewer_read` policies were never mutated at all.** Task 8 says *"**each** `_viewer_read`
  policy dropped · **each** `_viewer_read` widened to `using (true)`"*. The table covers drop+widen for
  `spin` (M01, M02) and widen for `award` (M08). `award_result_viewer_read`,
  `award_result_winner_viewer_read` and — most importantly — **`ceremony_viewer_read`, the AC1
  commitment gate, appears in no mutation row whatsoever** (M10 mutates the column GRANT, not the row
  policy).
- ⛔ **M01 and M09 are bad mutants scored as kills.** Both read *"KILLED (migration refuses to
  apply)"*. The mechanical cause is `0028`'s `comment on policy spin_viewer_read …`: delete or rename
  the policy and that statement errors, `supabase db reset` fails, and **no pgTAP assertion ever
  observes the mutant**. That is the same "a dead DB scored as a result" failure mode this section
  describes two paragraphs down — the rig was hardened against it and then the matrix scored two rows
  by it anyway. By the story's own standard (*"record any bad mutant of your own"*) these are bad
  mutants, and M09 was the **only** row covering R3.
- ⭐ **M15 tested the wrong property.** It is recorded as *"the `timeline_feed` insert **removed**"*,
  which Section I's row counts kill easily. Task 8 asked for it **moved outside the transaction** —
  the R10/AD-6 atomicity property AC8 actually claims, and which no mutation in this table exercises.
  ⚠ Not closed: a single-function body cannot express "outside the transaction" as a text mutation,
  so the property is argued at the insert site (0028 section 4's second-writer block) rather than
  measured. Recorded as a limit, not as coverage.

#### ⭐⭐ The mutations the review RAN, and the one that SURVIVED (2026-08-08)

The three missing `_viewer_read` mutations were then actually run, control-first, restoring the
migration by SHA-256 after each. **One of them survived, and it was the AC1 commitment gate:**

| # | mutation | outcome |
|---|---|---|
| M21 | `award_result_viewer_read` → `using (true)` | KILLED (0028 × 6) |
| M22 | `award_result_winner_viewer_read` → `using (true)` | KILLED (0028 × 6) |
| ⛔ M23 | `ceremony_viewer_read` → `using (true)` | **SURVIVED — 84/84 green** → fixture added → **KILLED (0028 × 1)** |
| M24 | `reveal_in_progress` guard removed (`if false`) | KILLED (0028 × 1) |
| M25 | `reveal_in_progress` made unconditional (`if true`) | KILLED (0028 × 1) — the guard is SCOPED, not blanket |
| M26 | both child gates → `s.id = s.id` (uncorrelated) | KILLED (0028 × 5) |
| ⛔ M27 | the child gates' qualifier reverted to bare `spin_id` | **SURVIVED — and it CANNOT be killed. See below.** |

**M23 is the substantive find.** Every ceremony in the fixtures was `locked` or `spinning`, so
`state <> 'not_started'` was TRUE for all of them and the predicate was **behaviourally identical to
`using (true)` across the entire file**. ⛔ **A predicate with no row on its FALSE side is not being
tested** — the gate that decides whether an un-started tournament publishes its commitment had no
test at all. Fixed by adding a `not_started` ceremony fixture (`TN` / `unstarted_ceremony`) and one
assertion in Section B; the mutant now dies. This is exactly why Task 8 named *each* viewer policy.

**M27 survives and the honest statement is that no test can kill it.** A policy's `USING` clause is
stored as a RESOLVED parse tree, not text, so `where s.id = spin_id` and
`where s.id = award_result.spin_id` produce the **identical** `pg_node_tree` — both render through
`pg_get_expr` as `(s.id = award_result.spin_id)`. Measured, on this database. The qualifier's value is
therefore at the SOURCE, for the next migration that copies the policy text forward and re-resolves
it against a `spin` that has since changed — not in the catalog, which has already normalised the
distinction away. Section J asserts what the catalog CAN prove (the gate still correlates with the
outer table — M26 reddens 5 tests) and says plainly that it is not a spelling check.

**M06 survives BY DESIGN and that is the point of R5:** `0025`'s composite FK
`(award_result_id, spin_id) → award_result(id, spin_id)` makes a child's `spin_id` unable to disagree
with its parent's, so gating either way is the same gate. If that FK is ever dropped, the shortcut
becomes a hole — cited at the policy.

⛔ **THE FIRST TWO RUNS WERE VOIDED, BY MY OWN HARNESS, AND BOTH DEFECTS ARE THIS PROJECT'S SIGNATURE
ONE POINTED AT THE TEST RIG.** Run 1 reported *thirteen* survivors and run 2 *eleven*, over mutations
as blunt as `using (true)`. Causes, both found by disbelieving the result rather than by the rig:
1. **`psql` pads its result column, so every TAP line carries a LEADING SPACE.** The detector anchored
   on `^not ok` and therefore counted **zero failures always**, whatever the database did.
2. **A dead DB container prints 179 bytes to stderr** — no `not ok`, no plan mismatch — which the same
   detector scored as *green*.
The rig now demands POSITIVE EVIDENCE, exactly as the story demands of the SQL: every suite must emit
its own `1..N` line with the N its file declares, a reset must prove the DB reachable, and every
mutation must be **read back out of `pg_policy`/`prosrc`** before it may be scored — an unverifiable
mutation is `NOT-APPLIED`, never `SURVIVED`. The detector was then validated against a known-good and
a known-bad state (green → 0 failures with a plan line; `using (true)` → 6) before the run was trusted.
⚠ Two interruptions left `0028` holding a mutant (M16, then M17); both were caught by SHA-256 against
the control hash, restored, and the full suite re-proven green.

**Two REAL test defects the pass exposed, both fixed:**
- ⭐ **The walk was measuring through a gated table.** Each child count joined `spin`, which is itself
  reveal-gated, so the child counts could never exceed what `spin` already exposed — a leak in
  `award_result`'s OWN policy was structurally invisible (M05 made every `award_result` readable and
  the walk still printed `0/0/0/0`). The counts now resolve the spin ids under the privileged role and
  **join nothing**, so each count observes exactly the one policy it is about.
- ⭐ **A fixture coincidence.** `spin.id` and `award_result.id` are both identity columns starting at
  1, so a gate written `where s.id = id` picked the right spin **by accident**. The walk's spins are
  now inserted last (ids 8-11 against award_result 1-4). ⚠ Postgres resolves that unqualified `id` to
  the INNER scope — the rendered mutant was `(s.id = s.id) AND (s.revealed_at IS NOT NULL)`, i.e. "is
  ANY spin revealed" — which is why it leaked everything.
- **M04/M07 needed a source-shape assertion, and why is worth stating:** an RLS policy's subquery is
  ITSELF RLS-filtered, so `spin_viewer_read` already restricts it and the child's own `revealed_at` is
  belt to that suspenders. The doubled predicate is visible in the measured plan. **No behavioural
  test can kill those mutants** — a viewer role cannot be made to bypass `spin_viewer_read` — so
  Section J reads the predicate out of `pg_policy` instead, and says plainly that it is a shape check.

#### ⚠ A claim I made and then had to correct: the indexes

The first draft of `0028` asserted that `award_result`/`award_result_winner`'s gates "ride an existing
index" (`award_result_spin_award_key` / `award_result_winner_spin_key` both lead on `spin_id`).
`explain (costs off)` under `set local role anon` **refuted it**. Postgres does not evaluate the
`exists` per row against those indexes at all — it hoists it into a **hashed SubPlan**:
```
Seq Scan on award_result
  Filter: (ANY (spin_id = (hashed SubPlan 2).col1))
  SubPlan 2 -> Seq Scan on spin s
                 Filter: ((revealed_at IS NOT NULL) AND (revealed_at IS NOT NULL))
```
So the honest statement is: the gate costs ONE scan of `spin` per statement plus a hash probe per row,
and those indexes are simply not what makes it cheap. That is a BETTER plan than the one assumed —
but the reason had to be measured. ⛔ **No index was added**, now on evidence rather than on the
"12 awards over 40 results is small" hand-wave it started as. The doubled predicate in that filter is
the proof that a policy subquery is itself RLS-filtered.

#### AC7 — the three replaced bodies, diffed against their originals

Each differs from `0015`/`0016` by **exactly** the `v_cstate` declaration, its comment, the four-line
`ceremony_locked` guard, and the whitespace re-alignment of the existing `declare` block. Nothing else:

| function | lines added | lines removed |
|---|---|---|
| `begin_match_grace` (0015:145-208) | 11 | 2 (the two re-aligned declares) |
| `resume_match` (0015:218-263) | 10 | 1 (the one re-aligned declare) |
| `bind_match_demo` (0016:135-287) | 14 | 4 (the four re-aligned declares) |

**A FOURTH replaced body, added at code review 2026-08-08 — `persist_ceremony` (`0027:600-1169`), in
`0028` section (h).** Same discipline, and the diff was produced MECHANICALLY rather than by
transcription: the 570-line body was extracted from `0027`, the guard inserted by an exact-string
replace, and the result diffed against the extraction before it was spliced in.

| function | lines added | lines removed |
|---|---|---|
| `persist_ceremony` (0027:600-1169) | 44 | **1** (the `create` keyword itself, becoming `create or replace`) |

The 44 are: one `v_revealed int;` declaration, one 30-line comment block, and the 13-line
`reveal_in_progress` guard (a `select count(*)` and a typed refusal). **Nothing else in 570 lines
moved** — `git diff --no-index` between the extracted original and the modified copy reports exactly
`44 insertions(+), 1 deletion(-)`. ⚠ The function COMMENT is re-issued in `0028` as well, because
`create or replace` preserves `pg_description` and `0027:1171-1181`'s text would otherwise have
survived describing a function with one refusal fewer than it has.

⚠ **`bind_match_demo`'s guard sits AFTER the idempotency short-circuit, and that is deliberate** — the
one place it differs from `mark_walkover`'s ordering. `0016:174-185` requires a retry of an
already-succeeded bind not to "turn a dropped HTTP response into a permanent, misleading error"; that
branch performs NO write, so the guard still precedes every write. Asserted in Section H so it reads
as a decision, not an oversight.

#### T9 gates — every baseline MEASURED, none quoted (6.7 quoted `1318/42` when the truth was `1322/42`)

| gate | result |
|---|---|
| `npm run lint` | **0** |
| Vitest | baseline **43 files / 1375** → **44 / 1403** (+1 file, **+28**: 20 in `reveal.test.ts`, 8 in `model.test.ts`). Baseline measured by holding the new files aside and restoring `model.test.ts` from HEAD. |
| `npm run build` | **0**; every viewer route still `ƒ`; the new `ƒ /api/admin/ceremony/reveal` present; `/ceremonia` still the 5.7 `<Placeholder>`; no `roulette` route |
| Go (harness PRESENT) | `go build` / `go vet` / `go test ./... -count=1` all clean |
| Go (harness REMOVED) | re-proven clean; `gofmt -l ./worker` **empty** |
| `generate_vectors.py --check` | **OK on all seven**, `git status roulette/vectors/` empty. This story owed no new vector (`0027:159-161`) |
| pgTAP | `supabase db reset` first. Baseline **28 files / 1344** → **29 / 1426** (+82 = 76 new + 2/3/1 from the retargets). All PASS |
| `git status` | `roulette/vectors/**`, `lib/roulette/**`, `worker/**`, `lib/awards/**`, `lib/i18n/**`, `app/(viewer)/**`, `lib/leaderboard/**` and migrations `0001`–`0027` **byte-untouched**; `0028` + its pgTAP file are the only new `supabase/**` entries |
| CRLF | **0** across every touched code/test file. ⚠ Caught myself here: a bulk checkbox edit rewrote this story `.md` with CRLF endings; every other BMad story file is LF-only (6-8a and 6-7 both measure 0), so it was normalized back. `sprint-status.yaml` stays CRLF natively |

pgTAP plan accounting restated (the 6.8a review found two banners contradicting their own plan):
`0028` **plan(76)** = A 19 + B 10 + C 11 + D 6 + E 2 + F 3 + G 2 + H 5 + I 11 + J 7.

⛔ **THAT ACCOUNTING WAS ITSELF WRONG, AND THE REVIEW MEASURED IT.** Three of the file's own
per-section banners read B (7), C (12), J (6) against real counts of 10, 11 and 7, and summed to
**73** against `select plan(76)`. The suite passed, exactly as the file's header predicts a stale
banner will — the sixth story running, and the second time in two stories, that this defect appeared
in the file that names it. Section A's itemisation also read "table-wide SELECT still FALSE (5)" for
what is one assertion, so A's breakdown summed to 23. All four are reconciled, and `0024`'s header
line (`plan(97) = …` against `select plan(119)`, a staleness this story's AC9 retarget touched and
propagated 94→97 rather than fixing) is corrected too.

#### ⭐ T9 gates, RE-MEASURED after the review's 25 patches

| gate | before review | after review |
|---|---|---|
| `npm run lint` | 0 | **0** |
| Vitest | 44 files / 1403 | **44 / 1405** (+2: the `expected_spin_index` and `revealed_at` refusal-context cases in `reveal.test.ts`) |
| `npm run build` | 0 | **0**; `ƒ /api/admin/ceremony/reveal` present, `/ceremonia` still the 5.7 `<Placeholder>`, every viewer route still `ƒ`, no `roulette` route |
| pgTAP | 29 files / 1426 | **29 / 1434** (+8: `0028` **76 → 84**, the only file whose plan moved) |
| `0028` plan | plan(76), banners summing to 73 | **plan(84)** = A 19 + B 11 + C 11 + D 6 + E 4 + F 3 + G 2 + H 5 + I 11 + J 9 + K 3 — banners re-counted and reconciled to the total |
| Go | clean | `go build` / `go vet` / `go test ./... -count=1` **all clean**; `gofmt -l ./worker` **empty** |
| `generate_vectors.py --check` | OK ×7 | **OK ×7**, `git status roulette/vectors/` empty |
| CRLF | 0 | **0** across all 12 touched files |
| scope | — | `git status` on `roulette/`, `lib/roulette/`, `worker/`, `lib/awards/`, `lib/i18n/`, `app/(viewer)/`, `lib/leaderboard/` **all empty**; `supabase/migrations/` shows **only** `0028` |

**The +8 pgTAP assertions:** E +2 (the merged-viewer-policy leak, measured, and its containment by
separation — R3 previously had no behavioural test), B +1 (a `not_started` ceremony is invisible to
anon — the fixture that kills surviving mutant M23), J +2 (both child gates still correlate with the
outer table; one `v_now` feeds both stamps), K +3 (the new `reveal_in_progress` section).

#### Recorded, not closed — carried forward

- ⛔ **Epic AC1 is PARTIAL**: `seed_hex` is published, `bundle_hash` is **6.9's** (DECISION A / Q1).
- ⚠ **`ceremony.luck_weight_table` stays MUTABLE after the freeze** (`deferred-work.md:361`). This
  story publishes `seed_hex` while that outcome-affecting input is still editable. **6.9's.**
- ⚠ **Award names became viewer-visible here** and still accept zero-width characters with no length
  bound (`deferred-work.md:265-266`). The fix is a catalog constraint, not a policy.
- ⚠ **`STATUS_FOR`'s numeric values are untested** — `vitest.config.ts:17` collects only `lib/**`, so a
  test under `app/` silently does not run. Exhaustiveness IS compile-enforced via
  `Record<Extract<…,{ok:false}>['reason'], number>`. Fifth such map; Epic 7's (`deferred-work.md:279`).
- ⚠ **`worker/ceremony.Run` still has zero callers** (Q3). The harness was its only caller and is gone.
- ⛔ **The FR-21 floors slice is still owed before Epic 6 closes.** 0/28 clear the 24/20 floors, so the
  ceremony this story made visible is **12 "nobody qualified" cards and 28 consolation prizes** — the
  SIXTH story to measure that zero and move nothing (Cuatro accepted it as measured, Q2). **6.9 hashes
  these bytes**, so the slice gets more expensive after this, not cheaper.
- ⛔ **A KNOWN COPY GAP, homed to 6.10 (DECISION H).** `reveal_spin` writes DATA, never copy — award
  names and player display names — because `model.ts` renders `detail.title`/`subtitle` verbatim and
  AD-24 keeps every string in `lib/i18n/es.ts`. A pity spin has no award and a zero-winner outcome has
  no winner, so those branches deliberately omit the key and the SHIPPED fallbacks carry them. Those
  fallbacks were written for a PRE-ceremony teaser, and `TimelineFeed.tsx:107` additionally hard-codes
  a "Se revela en la ceremonia" pill on every award card. Both read wrong on an already-revealed
  consolation prize. This story may touch neither (no new i18n key; `app/(viewer)/**` byte-untouched).
  **6.10 owns the ceremony strings AND that card.**
- ⚠ `spin.reveal` is EMITTED and nothing consumes it (DECISION F). It is deliberately NOT in
  `NUDGE_EVENTS` — that list is the `tournament:<id>` vocabulary; this rides `ceremony:<id>` and its
  consumer ships with 6.10's UI.
- ⛔ **ADDED AT CODE REVIEW — the `award_reveal` feed card does not arrive live, and DECISION F's
  reasoning did not cover it.** DECISION F argued only that `/ceremonia` is a `<Placeholder>` with
  nothing to nudge. But `timeline_feed` IS a `tournament:<id>` surface that Story 5.8 already
  subscribes to and auto-refreshes (`RealtimeNudge.tsx:95-96`), and this story writes to it — so a
  viewer sitting on the feed during the ceremony sees nothing until they reload. **Accepted by Cuatro
  2026-08-08** rather than fixed: the only fix is a fifth event name, and `0024:165-167` forbids
  inventing one. **6.10's, with the UI that consumes it.** The reasoning is completed at DECISION F's
  site so the gap reads as a decision rather than an oversight.
- ⚠ **`tournament.fair_seed` is anon-readable and DECISION C's "structurally" was false** — corrected
  at `0028:1211-1221`, recorded in `deferred-work.md`, **homed to 6.9**. Not a secrecy leak (it is the
  same hash `seed_demo_sha256` holds); it is the 6.2 justification that was already untrue.
- ⚠ **AC10's `27/27` denominator vs the `28 roster` anchor is unexplained** and not re-derivable
  without a corpus rebuild. Conclusion unaffected, figure owed. **6.11's.**
- ⚠ **A `spin_index > 0` CHECK is owed.** IC911's density theorem (`max = count`) is sound only over
  positive integers, and nothing constrains `spin_index` below. The gate still holds via the prefix
  half plus `out_of_order`, but on a different argument than the one written — corrected at the site.
  **The durable fix belongs with a migration that owns `spin`.**
- ⚠ **R10/AD-6 atomicity has no mutation covering it.** Task 8 asked for the `timeline_feed` insert
  *moved outside the transaction*; a single-function body cannot express that as a text mutation, so
  the property is argued at the insert site rather than measured. Recorded as a limit, not coverage.

### File List

**New**
- `supabase/migrations/0028_reveal_gating.sql`
- `supabase/tests/0028_reveal_gating_test.sql`
- `lib/ceremony/reveal.ts`
- `lib/ceremony/reveal.test.ts`
- `app/api/admin/ceremony/reveal/route.ts`

**Modified**
- `supabase/tests/0023_award_catalog_test.sql`
- `supabase/tests/0024_ceremony_lock_snapshot_test.sql`
- `supabase/tests/0025_ceremony_results_test.sql`
- `supabase/tests/0027_ceremony_run_test.sql`
- `lib/feed/model.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-8b-reveal-gating-and-commitment.md`

**Created and deleted before commit** — `worker/cmd/qa68b/main.go`, `lib/roulette/bar-qa68b.test.ts`,
`_qa68b/`. Go gates proven clean while present AND after removal.

### Change Log

| date | change |
|---|---|
| 2026-08-08 | Migration `0028`: the reveal-gated grant+policy pair on `spin`/`award_result`/`award_result_winner`/`award`; the `ceremony` commitment surface (row policy + COLUMN-level grant); `reveal_spin` (+ `IC911`); `ceremony_locked` extended to `begin_match_grace`/`resume_match`/`bind_match_demo` (closes `deferred-work.md:280`); the `award_reveal` `timeline_feed` writer (closes `0024:170`, unowned since `0017:109`). |
| 2026-08-08 | pgTAP `0028_reveal_gating_test.sql` plan(76); AC9 retargets of `0023`/`0024`/`0025`/`0027`; `lib/ceremony/reveal.ts` + its route + 20 Vitest cases; the `award_reveal` round trip in `lib/feed/model.test.ts`. |
| 2026-08-08 | THE BAR re-run over the real 14-demo corpus: anchors reproduced, the 40-reveal walk, the two-sided grep at k=0/6/40. Mutation pass 19/20 killed (M06 survives by R5); two harness defects found and fixed; two real test defects found and fixed. |
| 2026-08-08 | **Code review, all 25 findings applied.** `persist_ceremony` `create or replace`d in `0028` section (h) with a `reveal_in_progress` guard (44/1 diff, produced mechanically); both child gates qualify their outer `spin_id`; two missing `comment on policy`; DECISION C's false "structurally" claim, IC911's positivity theorem, IC911's reachability claim, DECISION F's feed-surface reasoning and `timeline_feed`'s second-writer argument all corrected at their sites. `reveal.ts` derives its refusal union from the reason set (`as const`) and carries `expected_spin_index` / `revealed_at` through to the route's `errorBody`. pgTAP `0028` **76 → 84**: R3 gets its first behavioural test, a `not_started` fixture kills surviving mutant M23, three vacuous `count = 0` guards get their population, the column-set guard covers both roles, and Section K covers the new refusal. All banners re-counted; `0024`'s stale plan header fixed. |

### Review Findings

Code review 2026-08-08 (`bmad-code-review`, three parallel layers: Blind Hunter — diff only, no project
access; Edge Case Hunter — diff + project; Acceptance Auditor — diff + spec + context docs). All three
layers returned; none failed. 28 findings after dedup and triage: **3 decisions needed · 22 patches ·
2 deferred · 1 dismissed**.

⭐ **What the review did NOT find is worth stating**, because the story's own risk list predicted it:
the column-level `ceremony` grant names exactly the six commitment columns with no table-wide grant
anywhere; the four secret columns are ungranted and asserted in both directions; every table carries
two separate never-OR'd policies with every `is_admin()` call `(select …)`-wrapped; RLS is ENABLE+FORCE
on all five; SELECT only; `award_catalog_count` untouched; `reveal_spin`'s signature, lock order,
guard-before-write ordering, single audit row, revoke-then-grant and broadcast form all match the house
style; **AC7's three replaced bodies diff against `0015`/`0016` to exactly the claimed delta and nothing
else** (mechanically re-verified: 11/2, 10/1, 14/4, `v_cstate` + guard + re-aligned declares only);
`0001`–`0027` byte-untouched; `app/(viewer)/**` and `lib/i18n/**` byte-untouched; **the Vitest and pgTAP
baselines reconcile exactly as claimed** (44 files / 1403; 29 files / 1426 = 1344 + 76 + 2 + 3 + 1, and
the four retarget deltas 111→113, 116→119, 68→69, 103→103 all check out).

#### Decisions needed — ⭐ all three RESOLVED by Cuatro, 2026-08-08

| # | decision | Cuatro's call |
|---|---|---|
| D1 | `tournament.fair_seed` is anon-readable, so DECISION C's "closes the hole STRUCTURALLY" is false | **Correct the claim + carry forward.** Fix `0028:1211-1221` so it stops asserting a falsehood, state that `tournament.fair_seed` is separately anon-readable and rollback-nullable, record it as owed to **6.9**. No posture change here. → **patch + deferred-work entry** |
| D2 | `persist_ceremony(p_replace => true)` can wipe a revealed prefix mid-ceremony | **Guard it in `0028`.** `create or replace persist_ceremony` with a typed `reveal_in_progress` refusal when any spin of the ceremony is already revealed. → **patch** |
| D3 | the `award_reveal` feed row lands on an already-subscribed surface with no nudge | **Accept + extend DECISION F's reasoning.** The feed surface IS live and IS mutated; the nudge is deliberately deferred with 6.10's UI. No code change, no invented event name. → **patch (comment)** |

- [x] **[Review][Decision] DECISION C's "closes the hole STRUCTURALLY" is FALSE — `tournament.fair_seed` is anon-readable today, and this story neither says so nor closes it.** `0002:50` `create policy tournament_read … using (true)` plus `0002:70` `grant select on public.tournament to anon, authenticated` — a **table-wide** grant covering `fair_seed` (`0001:33`). No migration `0001`–`0028` revokes it; the only `revoke` statements in the whole tree are `revoke execute on function`. Against that, [0028:1211-1221](supabase/migrations/0028_reveal_gating.sql#L1211) states *"Publishing from `ceremony.seed_demo_sha256` closes the hole STRUCTURALLY"*, and the story repeats it at `:264` and `:400`. ⚠ **This is not a secrecy leak** — `fair_seed` is `= SHA-256(final demo)` (`0001:33`), the same value `seed_demo_sha256` holds — but 6.2's DECISION F loosened `IC908` to permit `value → NULL` and justified it *only* because *"6.2 publishes the seed to nobody before it"*, flagging it for the story that owns publication. That justification was already false and 0028 leaves it false: the rollback-nullable copy is public alongside the write-once one. **Options: (a) column-scope or revoke `tournament`'s grant in `0028` (touches 0002's posture — scope growth); (b) correct the claim at the site and record it as carried-forward to 6.9; (c) accept and record as measured.**
- [x] **[Review][Decision] `persist_ceremony(p_replace => true)` can wipe an already-revealed prefix mid-ceremony and orphan published `award_reveal` feed rows; IC911 is structurally blind to it.** `0027:666` admits `v_state in ('locked','spinning')` and `spinning` is exactly the state `reveal_spin` runs in; `0027:1011-1016` then deletes every spin (cascading `award_result`/`award_result_winner`) and rewrites `revealed_at = null`. The viewer's visible set silently retracts, but the k `timeline_feed` rows **survive** — `timeline_feed` is append-only and `timeline_view` is `using (true)` ([0017:136](supabase/migrations/0017_aprobar_publish.sql#L136)) — so anon keeps reading `detail.title`, i.e. the **award names**, for a run that no longer exists. If the new run places any of those awards in a later spin, their identity has been published **before** their reveal: the exact spoiler AD-22 and R10 exist to prevent. A re-reveal then writes a second `award_reveal` row for the same index. IC911 cannot see any of it — the post-replace revealed set is `{}` over a dense `1..N`, a valid prefix. ⚠ [0028:475-482](supabase/migrations/0028_reveal_gating.sql#L475)'s claim that a broken reveal order *"can only be produced by a direct `service_role` UPDATE"* is therefore false; `persist_ceremony` is a supported RPC reaching the same end state. Reachability is low today (`persist_ceremony` has no TS caller — Q3's gap). **Options: (a) `create or replace persist_ceremony` in `0028` with a `reveal_in_progress` typed refusal (scope growth, but 0028 already `create or replace`s three functions); (b) record as carried-forward to 6.9 and correct 0028:475-482's claim.**
- [x] **[Review][Decision] The one viewer-visible consequence this story ships has no delivery path — the `award_reveal` row lands on an ALREADY-SUBSCRIBED surface that gets no nudge.** `reveal_spin` inserts into `timeline_feed` — a `tournament:<id>` surface Story 5.8 already subscribes to and auto-refreshes ([RealtimeNudge.tsx:95-96](app/(viewer)/components/RealtimeNudge.tsx#L95)) — and emits its only Broadcast on `ceremony:<id>` ([0028:758-772](supabase/migrations/0028_reveal_gating.sql#L758)). None of the four `NUDGE_EVENTS` fires, so a viewer sitting on the feed during the ceremony sees nothing until a manual reload. **DECISION F reasoned only that *"there is no ceremony surface to nudge: `/ceremonia` is still the 5.7 `<Placeholder>`"* — it never considered that this story mutates the live FEED surface**, while `reveal.ts:40-41` simultaneously claims the feed entry as a shipped consequence. **Options: (a) accept stale-until-reload and record it explicitly (DECISION F's reasoning gets one more sentence); (b) home it to 6.10 by name in the carried-forward list; (c) emit a second Broadcast on `tournament:<id>` — ⛔ conflicts with `0024:165-167`'s "event names are never invented" unless one of the four existing names genuinely fits, which none does.**

#### Patches

- [x] [Review][Patch] Two viewer policies join on an **UNQUALIFIED** `spin_id`, and the compensating guard cannot see a mis-join [supabase/migrations/0028_reveal_gating.sql:264](supabase/migrations/0028_reveal_gating.sql#L264), [:302](supabase/migrations/0028_reveal_gating.sql#L302) — `where s.id = spin_id` binds to the outer table only because `public.spin` happens to have no column of that name. The sibling `award_viewer_read` is written correctly (`ar.award_id = award.id`), so the codebase is inconsistent on exactly the point it is most sensitive to. ⭐ **The test file already documents this exact resolution rule** at `0028_reveal_gating_test.sql:335-338` — *"which Postgres resolves to the inner scope as `s.id = s.id`, i.e. 'is ANY spin revealed'"* — as the cause of surviving mutant M05. Adding a `spin_id` column to `spin` later silently rebinds both gates to `s.id = s.spin_id` and leaks every unrevealed `award_result` and `award_result_winner`; Section J's guard only greps for `%revealed_at%` ([:968](supabase/tests/0028_reveal_gating_test.sql#L968)) and says nothing about which column the gate joins on. Fix is one qualifier each: `s.id = award_result.spin_id` / `s.id = award_result_winner.spin_id`.
- [x] [Review][Patch] `pg_temp.anon_counts` has NO exception handler — a grant regression aborts the whole suite with zero diagnosis [supabase/tests/0028_reveal_gating_test.sql:342-356](supabase/tests/0028_reveal_gating_test.sql#L342) — it does `set local role anon`, runs four counts, then `set local role postgres`, with no `exception when others`. The sibling `pg_temp.as_role` has one, and the comment three lines above at [:303-305](supabase/tests/0028_reveal_gating_test.sql#L303) states the reason: *"THE EXCEPTION HANDLER IS LOAD-BEARING TWICE OVER: it restores the role so one 42501 cannot cascade through every later section."* `anon_counts` is the helper used at five checkpoints and was given none. Drop `grant select on public.award_result to anon` and the k=0 call raises 42501, the role is never restored, and Sections C–J all fail for reasons unrelated to the mutation — making the matrix unreadable for the four most important mutants.
- [x] [Review][Patch] `REVEAL_REASONS` is `Set<string>` and the `as` cast defeats the compile-time exhaustiveness the route calls load-bearing [lib/ceremony/reveal.ts:92-99](lib/ceremony/reveal.ts#L92), [:121](lib/ceremony/reveal.ts#L121) — `new Set([...])` with no `as const` and no link to the union infers `Set<string>`, and `reason as Extract<RevealSpinResult,{ok:false}>['reason']` is unchecked. Both Vitest cross-checks force a seventh SQL reason into the **Set**; nothing forces it into the **union**. It compiles, `STATUS_FOR` (keyed on the unchanged union) has no entry, and `command-route.ts:106`'s `?? 500` ships a typed business refusal as an opaque 500 — making [route.ts:39-40](app/api/admin/ceremony/reveal/route.ts#L39)'s *"a reason with no status entry is a COMPILE error"* false on the realistic path. Fix: declare the reasons `as const` and derive the union from them, so the two cannot diverge.
- [x] [Review][Patch] Section E proves ROLE SCOPING, not policy separation — the mutant it exists to catch survives it [supabase/tests/0028_reveal_gating_test.sql:653-682](supabase/tests/0028_reveal_gating_test.sql#L653) — the section breaks `spin_admin_read` to `using (true)` and asserts anon still sees 2. But `spin_admin_read` is `to authenticated` and `anon` is not `authenticated`, so that assertion holds for **any** body of `spin_admin_read`. The merge defect R3 forbids can only live in `spin_viewer_read`, which the section never touches: ship `spin_viewer_read … using (revealed_at is not null or (select public.is_admin()))` and every assertion in the file stays green. ⚠ **Corroborated by T8**: M09 ("the two `spin` policies MERGED") is recorded as *"KILLED (migration refuses to apply)"* — killed by DDL, never observed behaviourally. The second assertion (authenticated sees 4) is genuinely valuable and should stay; add a case that merges the **viewer** policy.
- [x] [Review][Patch] Three section banners contradict the plan block — the exact 6.8a defect this file's header says it exists to catch [supabase/tests/0028_reveal_gating_test.sql:499](supabase/tests/0028_reveal_gating_test.sql#L499), [:557](supabase/tests/0028_reveal_gating_test.sql#L557), [:903](supabase/tests/0028_reveal_gating_test.sql#L903) — Section B's banner says `(7)`, actual **10**; C says `(12)`, actual **11**; J says `(6)`, actual **7**. **The banners sum to 73 against `select plan(76)`** ([:92](supabase/tests/0028_reveal_gating_test.sql#L92)) — measured, not inferred. The plan block itself is correct (19+10+11+6+2+3+2+5+11+7 = 76), so the suite passes, which is precisely the failure mode `:36-40` describes. Also: the plan block's Section-A itemisation reads `table-wide SELECT still FALSE (5)` for what is one assertion, so A's breakdown sums to 23 rather than 19. The file's own claim at `:2324-2328` — *"Every number below was derived by COUNTING the assertion calls in the section"* — does not hold for four of them.
- [x] [Review][Patch] `expected_spin_index` is promised by two headers and silently discarded [lib/ceremony/reveal.ts:62](lib/ceremony/reveal.ts#L62), [:118-124](lib/ceremony/reveal.ts#L118) — the RPC returns it, pgTAP asserts it is carried, `0028:1703-1711` says *"the expected index travels in the refusal so the admin (and 6.10's UI) learns what to press"*, and `reveal.ts:25` repeats the promise. Then the failure variant is `{ok:false; reason}` and nothing else, so the field is parsed into `RpcResult` and **never read anywhere** — dead code that is itself the evidence of intent. Same for `already_revealed`'s `revealed_at`. `handleAdminCommand` already supports exactly this via the optional `errorBody` hook ([lib/admin/command-route.ts:61-63](lib/admin/command-route.ts#L61), whose comment names rollback's `blocking` as the precedent), and this route does not use it. `lib/ceremony/reveal.test.ts` never asserts it, so nothing reddens.
- [x] [Review][Patch] Two `_admin_read` policies created in this migration have no `comment on policy`, while Task 2's checkbox for it is `[x]` [supabase/migrations/0028_reveal_gating.sql:268](supabase/migrations/0028_reveal_gating.sql#L268), [:306](supabase/migrations/0028_reveal_gating.sql#L306) — `0028` creates eight policies and carries six comments. `award_result_admin_read` and `award_result_winner_admin_read` have none, while `spin_admin_read` got one ([:226](supabase/migrations/0028_reveal_gating.sql#L226)) — so the intent that admin policies are in scope is clear. Task 2 says *"`comment on policy` … for **each**"*, and the AD-7 admin-half rationale (`0002:95-98`) is what the missing comments were to carry.
- [x] [Review][Patch] The retargeted `0023` anon read lost its failure isolation [supabase/tests/0023_award_catalog_test.sql:432](supabase/tests/0023_award_catalog_test.sql#L432) — the retarget replaced `throws_ok($$select * from public.award$$, '42501', …)`, which **cannot** abort, with a bare `select is((select count(*)::int from public.award), 0, …)` under `set local role anon` ([:418](supabase/tests/0023_award_catalog_test.sql#L418)). If the grant is absent — the R1 half the retarget exists to prove — this raises 42501 and aborts 0023's remaining assertions, including the `award_catalog_count` pair right after, instead of reddening one named line. The comment at `:428-429` argues the new form is strictly stronger; it is stronger about **behaviour** and strictly weaker about **failure isolation**, and that trade is not recorded. Route it through a probe helper the way `0028` does.
- [x] [Review][Patch] `0023`'s replaced 42501 assertion overclaims — the zero is produced by an empty dependency set, not by the gate [supabase/tests/0023_award_catalog_test.sql:428-432](supabase/tests/0023_award_catalog_test.sql#L428) — the comment claims *"a zero over a table that a moment ago 42501'd proves the door is open **AND the gate behind it holds**."* That suite's fixture has no `ceremony`, no `spin` and no `award_result` rows, so `award_viewer_read`'s `exists (… join spin … where revealed_at is not null)` is FALSE because its FROM clause is empty. Delete `and s.revealed_at is not null` from the policy and this assertion still returns 0 and stays green. It does catch `using (true)` (12 vs 0), which is the one case the comment names correctly; the broader claim is unsupported by this fixture. Either seed a revealed/unrevealed pair or narrow the comment.
- [x] [Review][Patch] Section J's exact granted-column-set guard covers `anon` only, so R7's fail-closed claim is unguarded for `authenticated` [supabase/tests/0028_reveal_gating_test.sql:923-929](supabase/tests/0028_reveal_gating_test.sql#L923) — the only assertion pinning the **exact** set filters `grantee = 'anon'`. The companion checks in Section A and in `0024` are enumerated lists, not exact sets. **6.9 is explicitly named as the story that widens this row**: a later `grant select (bundle_sha256) on public.ceremony to authenticated` leaves the anon array unchanged (green), is not in the four-secret-column list (green), and `has_any_column_privilege` is already true (green) — a column published to every signed-in user with nothing reddening, in the file whose whole subject is column-scoped publication.
- [x] [Review][Patch] Three `count(*) … = 0` guards are vacuous — satisfied by an empty match set [supabase/tests/0028_reveal_gating_test.sql:398](supabase/tests/0028_reveal_gating_test.sql#L398), [:444](supabase/tests/0028_reveal_gating_test.sql#L444), [:968](supabase/tests/0028_reveal_gating_test.sql#L968) — each counts violating rows and asserts 0, which passes when **zero rows match the `where` clause at all**. This is the same trap the story names twice and which `lib/feed/model.test.ts` and `lib/ceremony/reveal.test.ts` both correctly guard with a count precondition; none of the three SQL guards carries one. Rename `award_result_viewer_read` in a later migration and delete its `revealed_at` predicate: `:968`'s `polname in (…)` matches nothing, the count is still 0, and the guard the file calls *"the only thing that can catch its deletion (M04/M07)"* passes green.
- [x] [Review][Patch] `0024`'s plan header was edited by this diff into a still-contradictory value [supabase/tests/0024_ceremony_lock_snapshot_test.sql:41](supabase/tests/0024_ceremony_lock_snapshot_test.sql#L41) vs [:82](supabase/tests/0024_ceremony_lock_snapshot_test.sql#L82) — the diff changed `-- plan(94) = A 16 + B 9 + …` to `-- plan(97) = A 19 + B 9 + …` (sums to 97) while `select plan(119)` sits 41 lines below, reconciled only by the trailing `19+9+15+10+11+4+10+19+22 = 119` line. Section I's 22 assertions appear in the itemisation but never in the header line, so the file carries two mutually contradictory plan statements and the diff propagated the inconsistency rather than fixing it. The standing rule quoted in `0023` is *"an accounting that does not reconcile to the file is not one."*
- [x] [Review][Patch] "An authenticated non-admin sees exactly what anon sees" checks two of four tables, against a literal [supabase/tests/0028_reveal_gating_test.sql:546-554](supabase/tests/0028_reveal_gating_test.sql#L546) — the claim is an **equality between two roles' visibility**, but the assertion compares the authenticated role's `spin`/`award` counts to a hardcoded string; it never evaluates the anon side, never calls `pg_temp.anon_counts`, and never touches `award_result` or `award_result_winner`. A stray `award_result_winner_signed_in_read … to authenticated using (true)` would leak every winner of every unrevealed spin to any signed-in user and this assertion — the one whose message is *"signing in reveals nothing (AD-22)"* — would not see it. Call `anon_counts` for both roles and compare them to each other.
- [x] [Review][Patch] `0028` becomes `timeline_feed`'s second writer and `0017`'s "safe by construction" argument is now stale and uncited [supabase/migrations/0028_reveal_gating.sql:678](supabase/migrations/0028_reveal_gating.sql#L678) — [0017:127-136](supabase/migrations/0017_aprobar_publish.sql#L127) justifies `create policy timeline_view … using (true)` with *"it is SAFE BY CONSTRUCTION because a row is only ever written POST-approval, inside `approve_match` … There is no pending row to leak. So the blanket `using (true)` is correct HERE for a reason that must be written down."* The new behaviour **is** safe (the insert is inside the reveal transaction, R10), but the standing justification is now factually wrong and neither `0028` nor the story mentions `timeline_view` anywhere — exactly the stale-comment class this epic's migrations are written to prevent. Add the citation and the second-writer argument at the insert site.
- [x] [Review][Patch] Task 8's mutation list is not fully executed, and one named mutation was substituted with a weaker one [story Completion Notes:565-585] — Task 8 says *"**each** `_viewer_read` policy dropped · **each** `_viewer_read` widened to `using (true)`"*. The reported table covers drop+widen for `spin` only (M01, M02) and widen for `award` only (M08); `award_result_viewer_read`, `award_result_winner_viewer_read` and **`ceremony_viewer_read` — the AC1 commitment gate — were never dropped and never widened, and `ceremony_viewer_read` appears in no mutation row at all** (M10 mutates the column grant, not the row policy). And M15 is recorded as *"the `timeline_feed` insert **removed**"*, not *moved outside the transaction* — "removed" tests existence (Section I's row counts kill it); "moved outside the transaction" tests **R10/AD-6 atomicity**, which is the property AC8 claims and which no mutation exercises.
- [x] [Review][Patch] Two of the 19 reported kills are the "a kill that proves nothing" class and are not recorded as such [story Completion Notes:566, :574] — M01 (`spin_viewer_read` dropped) and M09 (the two policies merged) are both scored *"KILLED (migration refuses to apply)"*. The mechanical cause is [0028:220](supabase/migrations/0028_reveal_gating.sql#L220)'s `comment on policy spin_viewer_read …`: delete or rename the policy and that statement errors, `supabase db reset` fails, and **no pgTAP assertion ever observes the mutant**. That is the same "a dead DB scored as a result" failure mode the notes themselves describe at `:596-598`. The story's own standard (*"record any bad mutant of your own"*) requires these be recorded as bad mutants; scored as kills they inflate the pass, and M09 is the only mutation covering R3.
- [x] [Review][Patch] Section J's "exactly one emitter" assertion counts occurrences in `prosrc` with comments included [supabase/tests/0028_reveal_gating_test.sql:981](supabase/tests/0028_reveal_gating_test.sql#L981) — it greps `p.prosrc` for `spin\.reveal` and `ceremony:` expecting 1/1. `prosrc` includes the body's comments; it passes today only because the surrounding block happens to use backticks rather than quotes. A future comment mentioning `'spin.reveal'` makes it 2/1 and reddens a test whose message reads as an architectural violation. ⭐ The sibling reason-set assertion at [:910-921](supabase/tests/0028_reveal_gating_test.sql#L910) already strips comment lines with `where l !~ '^\s*--'` — apply the same filter here.
- [x] [Review][Patch] IC911's density proof is only sound for POSITIVE spin indexes, and no such CHECK exists [supabase/migrations/0028_reveal_gating.sql:553-556](supabase/migrations/0028_reveal_gating.sql#L553) — the comment argues *"Over a distinct subset of 1..N, max = count holds if and only if the subset is {1..count}"*, which is true for distinct integers **≥ 1**. The only constraint cited is `spin_ceremony_index_key unique (ceremony_id, spin_index)`, which enforces distinctness, not positivity, and R11 records that `0028` adds no CHECK. Indexes `{-5, 0, 3}` give `count = 3, max = 3`, so the density branch does not raise. The prefix half generally still catches the reachable cases, so this is a wrong load-bearing proof rather than an exploitable hole — state the positivity assumption, or add the CHECK.
- [x] [Review][Patch] AC3's index Then-clause is refuted by the story's own measurement, and the Dev Notes were left unamended [story AC3:80, Dev Notes:325] — AC3 says the `exists` subquery *"is verified to ride an existing index — `award_result_spin_award_key` … and `award_result_winner_spin_key` … both lead on `spin_id`"*. [0028:1348-1363](supabase/migrations/0028_reveal_gating.sql#L1348) records the measured plan as a hashed SubPlan over Seq Scans and states plainly that *"the `(spin_id, award_id)` unique index is simply **not** what makes it cheap"*. The remedial decision (no index) is correct and honestly disclosed in Completion Notes, but AC3's stated mechanism and `:325`'s *"three of the four gates ride an existing one"* are both false and still stand as written.
- [x] [Review][Patch] `completed_at = revealed_at` is near-vacuous inside a pgTAP transaction [supabase/tests/0028_reveal_gating_test.sql:628](supabase/tests/0028_reveal_gating_test.sql#L628) — `now()` is transaction-start-stable and the whole file is one transaction, so the equality is guaranteed by the harness whether or not `reveal_spin` threads `v_now` through both writes. Replacing `v_now` with bare `now()` at both sites keeps it green. Only the `is not null` half and a `clock_timestamp()`-shaped mutant are actually caught; the message's *"and it is the SAME instant as the final reveal"* claims a property of the code that is really a property of the test transaction.
- [x] [Review][Patch] AC10's non-vacuity denominator (`27/27`) does not reconcile with the corpus anchor (28 roster) [story Completion Notes:549-551 vs :506-507] — AC10 requires the corpus-name hit count *"the way 6.8a's re-run did (66 KB / 37 KB, **28 distinct player names each**)"*, and the same section claims every anchor reproduced **exactly**, including `28 roster · row_count 28`. The grep table then reports `27/27` at every `k` with no explanation of the missing name. Either the denominator or the anchor is wrong, and the whole point of the figure is that it be re-derivable.
- [x] [Review][Patch] The route's doc says "Nothing else is accepted"; `parseBody` accepts and silently ignores extras [app/api/admin/ceremony/reveal/route.ts](app/api/admin/ceremony/reveal/route.ts) — the header states *"Body: `{ ceremony_id, spin_index }`. Nothing else is accepted; the actor is always the verified session (AD-17), never the body."* `parseBody` destructures the two fields and returns a fresh object, so extra keys are dropped, not rejected. Nothing is exploitable today (`p_actor` comes from `gate.steamid64`), but it is a comment describing stricter code than exists, on a clause that is load-bearing prose for an AD-17 claim.

#### Deferred

- [x] [Review][Defer] The zero-winner card renders "Se revela en la ceremonia" TWICE, and that is the COMMON case, not the pity case [lib/feed/model.ts:188](lib/feed/model.ts#L188) + [app/(viewer)/components/TimelineFeed.tsx:107](app/(viewer)/components/TimelineFeed.tsx#L107) — deferred, owned by 6.10 (DECISION H forbids touching `app/(viewer)/**` or adding an i18n key in this story). A `no_eligible_players` main spin has `v_subtitles` NULL, so the writer omits `subtitle` by design; `toCardModel` substitutes `es.award.revealAtCeremony` **and** `AwardRevealBody` unconditionally renders the same string as a lockpill beside it — on an award that was just revealed. ⚠ **DECISION H records the copy gap but frames it as the *pity* case and does not record the doubling**, while this diff's own new Vitest case asserts exactly the state that produces it (`{kind:'main', award_count:1, winner_count:0, title:'Muralla'}` → `subtitle === es.award.revealAtCeremony`). 12/12 main spins over the measured corpus hit this branch. **DECISION H's carried-forward entry should be corrected to name it.**
- [x] [Review][Defer] `ceremony_locked`'s `<> 'not_started'` predicate keeps the three AC7 RPCs locked out PERMANENTLY once the ceremony completes [supabase/migrations/0028_reveal_gating.sql:877](supabase/migrations/0028_reveal_gating.sql#L877), [:954](supabase/migrations/0028_reveal_gating.sql#L954), [:1056](supabase/migrations/0028_reveal_gating.sql#L1056) — deferred, pre-existing and correct per spec. `reveal_spin` sets `state = 'complete'` (DECISION E) and `complete <> 'not_started'`, so the guard keeps firing forever; `ceremony.state` is forward-only through `assert_ceremony_transition` and `complete` is terminal, so no RPC in the tree can clear it. ⚠ **The predicate is byte-identical to `mark_walkover`'s 6.2 form** ([0024:2248](supabase/migrations/0024_ceremony_lock_snapshot.sql#L2248)) and to `approve_match`/`rollback_match`/`manual_resolve_match`, and AC7 mandated copying that form — so this is a **pre-existing system-wide property faithfully inherited, not a defect introduced here**. What is new is that `bind_match_demo` now joins it, and binding a demo is a data-completeness action rather than a bracket mutation: a demo uploaded the morning after the ceremony can never be bound. Every justification written at the three sites is temporal (*"while the audience is watching the ceremony"*) and none states the permanence.

#### Dismissed (1)

- The `lib/feed/model.test.ts` i18n fallback assertions compare `toCardModel`'s output to the same `es.*` constants the renderer reads, so they cannot detect a wrong or empty fallback string. Dismissed: importing `es` **is** reading evidence from source, and the alternative — hardcoding the Spanish literals in the test — duplicates the very thing the project's doctrine forbids. The gap it leaves (an empty i18n value) belongs to an i18n non-empty invariant test, not here. The assertions do retain real value: swapping `teaserTitle` and `revealAtCeremony` in `model.ts` reddens them.
