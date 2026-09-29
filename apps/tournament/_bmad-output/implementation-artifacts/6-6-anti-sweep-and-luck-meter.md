---
baseline_commit: 4c9cf36
---

# Story 6.6: Anti-sweep and luck-meter

Status: done

> **⛔⛔ READ THIS BEFORE THE ACs. The cap this story builds CANNOT FIRE at the shipped configuration,
> and 6-4b flagged it by name so you would not discover it live.**
> [6-4b:383-390](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md#L383): *"UX fixes the pacing at **one award per spin** ([EXPERIENCE.md:164](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L164), `:132`)… With `live_count = 1` shipped, **FR-26's cap can never fire**, 6.6's anti-sweep would guard a
> path the config never takes, and pity becomes the sole mitigation for a sweep that `prd.md:451`
> names anti-sweep *and* pity against."* Cuatro's answer was to **parameterize for `N ≥ 1` and flag
> it**, which 6-4b did — `Stage1Pick` loops, and `stage1-pick.json` carries `live_count` 1, 2 **and 4**.
> So the seam is ready and the ceremony is not. **AC5 must MEASURE the consequence and report it as a
> number, not resolve it by fiat** — the pacing is a UX decision (Question 1), never a resolver's.
>
> ⚠ **The second thing to know:** `spin`, `award_result` and `award_result_winner` **do not exist**
> ([0024:144](supabase/migrations/0024_ceremony_lock_snapshot.sql#L144)), so AC2's `UNIQUE(spin_id, winner_entry_id)` has no table to sit on. That conflict is
> real, it is resolved by **DECISION A** below, and it is Question 2.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the seventh story of the epic**
Traces: **FR-26** · **AD-14** (`anti-sweep ≤1 trophy/player/spin`) · SOLUTION-DESIGN **§9.4** and **§9.2** · `review-data-integrity.md` **M1**
Consumes: 6-4b's `Stage1Pick` / `Stage1Weights` / `Stage1Result.Live` (**DRAW order**) · 6-4a's `ResolveStage2` / `Outcome` / DECISION E's suppressed set · **6.5's `ResolveLadder(award, tied, players)`, which was designed for exactly this caller** · 6.2's `ceremony.luck_weight_table` **SHELL**
Hands to: 6.7 (pity reads the shelf this fills and the winless set this leaves), 6.8 (persistence, the reveal axis, `spin_plan` content, the RLS widening), 6.9 (the browser verifier + the `luck` bundle key), 6.10 (`Un trofeo por giro` / `anti-barrida` presentation), 6.11 (the end-to-end vector must exercise **an anti-sweep overflow**, [SOLUTION-DESIGN:443](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L443))

⚠ **Sequencing:** [6-5b](_bmad-output/implementation-artifacts/6-5b-fr-29-ladder-vector-and-suite-debt.md) closes nine outstanding findings against the ladder this story drives. Prefer to
land 6-5b first. If you are told to start here anyway, **read 6-5b's AC2 and AC3 before you trust a
rung** — rung 2's defining property and rung 4's narrowing are currently untested.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want at most one trophy per player per spin with luck biased toward empty shelves,
so that no single player hoovers a spin and players with nothing yet get spotlight.

## Acceptance Criteria

**AC1 — live awards are processed in ASCENDING PRIORITY, an assigned player is removed from every LATER candidate set, and the overflow re-resolves through the FR-29 ladder.**
**Given** the anti-sweep rule ([epics.md:1100-1102](_bmad-output/planning-artifacts/epics.md#L1100); FR-26 [prd.md:363-369](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L363); AD-14 `ARCHITECTURE-SPINE.md:148`; the contract surface `:220`; SOLUTION-DESIGN §9.4 `:425-427`),
**When** a spin's live award set is resolved,
**Then** a pure, **zero-stream** pass sorts the live awards by **ascending `award.priority`** — never by `Stage1Result.Live`'s **draw** order, which is the reveal order and is deliberately unsorted ([worker/awards/stage1.go:269-274](worker/awards/stage1.go#L269), [lib/roulette/stage1.ts:166-173](lib/roulette/stage1.ts#L166)) — resolves each award over the **candidate set minus every player already assigned this spin**, adds **all** winners of each award to that set (*"Co-winners all count"*, [SOLUTION-DESIGN:427](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427)), and returns per award: the outcome, the players it swept out, and whether it was re-resolved. **Removal is applied to the CANDIDATE SET before Stage 2 runs — never to an `Outcome` after the fact** (DECISION E'), so a `shared` outcome can never contain an already-assigned player by construction, which is the hazard `review-data-integrity.md:175-179` names.

**AC2 — the cap is enforced at the DATABASE level by `UNIQUE(spin_id, winner_entry_id)`.**
**Given** the DB-enforcement rule ([epics.md:1104-1106](_bmad-output/planning-artifacts/epics.md#L1104); AD-14 via `ARCHITECTURE-SPINE.md:234`; `review-data-integrity.md` **M1**),
**When** winners are written,
**Then** migration **`0025`** creates `spin`, `award_result` and `award_result_winner` exactly as [SOLUTION-DESIGN:205-233](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L205) declares them, carrying the **denormalized `award_result_winner.spin_id`** whose only purpose is `unique (spin_id, winner_entry_id)`, plus M1's two companion fixes — `is_shared` **asserted** against `count(award_result_winner) > 1` rather than left to drift, and a stated **delete-prior-on-rerun** contract so a re-run cannot accumulate rows into a hard insert failure — and a pgTAP file proves the constraint **rejects a second trophy for one player in one spin** and **permits** the same player in a different spin. ⚠ **Tables only.** No RLS policy (absence is admin-only, exactly the [0024:250-253](supabase/migrations/0024_ceremony_lock_snapshot.sql#L250) precedent), no writer RPC, no `revealed_at` gating logic, no `spin_plan` content — **6.8 WIDENS this; it never re-creates it.**

**AC3 — the luck-meter's VALUES ship, MEASURED, and the empty shelf provably draws the heaviest weight.**
**Given** the luck-meter bias ([epics.md:1108-1110](_bmad-output/planning-artifacts/epics.md#L1108); FR-26 [prd.md:365](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L365) — *"a **hidden** luck-meter"*; SOLUTION-DESIGN §9.2 `:406-411`) and that 6-4b shipped the **lookup** while explicitly leaving the **VALUES** to this story ([worker/awards/stage1.go:224-227](worker/awards/stage1.go#L224) — *"Its VALUES are organizer config… and belong to 6.6/6.8; this file validates its SHAPE and never seeds one"*),
**When** the table ships,
**Then** `ceremony.luck_weight_table` — a **SHELL since 0024, annotated `-- SHELL — Story 6.6`** ([0024:202](supabase/migrations/0024_ceremony_lock_snapshot.sql#L202)) — is populated with **strictly-decreasing positive integers, heaviest first**, the choice is **measured against the real corpus** rather than narrated (how large does a shelf actually get across 12 awards and 28 players? which table entries are reachable at all? what does the bias do to the drawn order?), a named test proves **shelf 0 ⇒ `table[0]` ⇒ the heaviest weight** and that the weight is **strictly monotone non-increasing** in shelf size, and the two inherited defects against this indexing are closed: [deferred-work.md:308](_bmad-output/implementation-artifacts/deferred-work.md#L308) (**a negative shelf index panics in Go and returns `undefined as number` in TypeScript** — 6-4b's W8 clamp is one-sided) and [deferred-work.md:317](_bmad-output/implementation-artifacts/deferred-work.md#L317) (the *"clamp AFTER the minimum"* comment asserts a distinction with no observable difference). ⛔ **No UI.** The luck-meter is *hidden* by FR-26 and by [EXPERIENCE.md:167](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L167); `Stage1Weights` is already exported and draws zero bytes so a future surface can render it. Any rendering is **6.10's**.

**AC4 — the anti-sweep pass draws ZERO stream bytes, and the signature is the proof.**
**Given** 6-4b's measured byte accounting (a 12-spin ceremony at `live_count = 1` over the real corpus costs **exactly 22 bytes**) and that Stage 2 and the FR-29 ladder are both pure,
**When** the pass runs, however many re-resolutions it performs,
**Then** it takes **no `Stream` parameter in either language** — the same discipline `stage2.go:339-343` and the ladder's L1 use, and for the same reason: a runtime `Consumed()` assertion around a function that takes no stream is **vacuous** and 6-4b deleted exactly that assertion — the TS entry point is **SYNCHRONOUS** (unlike `stage1Pick`), and `lib/roulette/prng.test.ts`'s per-module import-graph pin shows the new module does **not** import `./prng`. A stream import here would move every byte position after it and invalidate everything 6.9's browser reproduces.

**AC5 — the pass is proven by a shared, third-implementation-anchored vector that reaches every anti-sweep path, including the ones the shipped config never takes.**
**Given** AD-14's *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build"* and the house rules at [roulette/vectors/README.md](roulette/vectors/README.md),
**When** the build runs,
**Then** the golden JSON carries, at minimum: a **clean spin** where no player wins twice (the cap is inert); a **single overflow** where the ascending-priority winner of award 1 would also win award 2 and the second re-resolves to a different player; a **cascade** where the re-resolved winner of award 2 would also have won award 3; an overflow whose re-resolution **lands on a TIE and goes through the ladder**, exiting at a rung the original resolution did not; an overflow whose re-resolution produces a **`shared`** outcome (so several players are assigned at once); an overflow where a **co-winner from an earlier award** is the one removed; **exhaustion** — every eligible player for a later award already assigned (DECISION F); an award whose reduced set changes a `max` **volume** award's best value to `0`, re-triggering **DECISION E**'s `no_awardable_value` carve-out on the reduced set; a **width-1 reduced tie** (the ladder REFUSES `len(tied) < 2`, so this pass must handle it, [ladder.go:726](worker/awards/ladder.go#L726)); an award reaching the pass as `no_eligible_players` **before** any removal; and a `refusals` array with closed-set `detail` values including ⭐ **one row malformed in TWO ways at once** so the validation order is observable — 6-4b's headline defect was invisible for exactly that reason. Every expected value is produced by the committed third implementation (`generate_vectors.py --check`, **byte** comparison), **both** suites read that same file, and the README ownership table gains the row.

**AC6 — the anti-sweep is exercised over the REAL corpus, and the `live_count = 1` consequence is reported as a number.**
**Given** the project's THE BAR discipline, Epic-5 retro Action Item #5 (*"every claim backed by printed output"*) and the keep-doing agreement ***"measure zeros, never narrate them"***,
**When** the story is signed off,
**Then** both runtimes run a full ceremony over the **real** frozen `fair_seed` (`1b3cd678…3279c`), the **real** captured `stat_snapshot_row` set and the **real** 12-award catalog, their transcripts are diffed **mechanically** (files + `Compare-Object` + SHA-256), and Completion Notes record **measured**: ⭐ **how many times the cap fires at `live_count = 1` (the expected answer is ZERO — print it, do not assume it)**; the same run at `live_count = 2`, `3` and `4` with the cap-fire count, the overflow count, the re-resolution depth and **the exact byte cost at each width**; ⭐ **the real-floors 12-spin ceremony must remain byte-for-byte 22 bytes and its drawn order character-for-character 6-4b's `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`** — the anti-sweep pass draws nothing, so a change in either is a **defect, not a finding**; the floors-0 counterfactual (the only configuration where anyone is eligible — **0/28 clear the shipped 24/20 floors**) with the same numbers; the final shelf distribution and the **winless set 6.7 will inherit**; and, for the chosen weight table, which entries were **reachable at all**.

## Tasks / Subtasks

> Build order: Task 0 (read) → Task 1 (pin the edge semantics) → Task 2 (the vector seam) → Task 3
> (first language) → Task 4 (second language) → Task 5 (the weight table, measured) → Task 6 (the
> migration) → **Task 7 (THE BAR) gates sign-off** → Task 8 (mutation) → Task 9 (gates).
> **Write the vector before the second implementation** so the second one is written against a fixed
> artifact, not against the first one's source. ⛔ **The anchor changes FIRST and in the same
> published order** — 6.5's T1 was a three-way divergence created by patching two runtimes and not
> the arbitrating third.

- [x] **Task 0 — Read before you write**
  - [x] [SOLUTION-DESIGN §9.4](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L425) (`:425-429` — **the entire normative anti-sweep spec is three sentences**), **§9.2** (`:406-411` — Stage 1 and the frozen shelf), **§9.6** (`:440-449` — gate 4 must exercise *"an anti-sweep overflow"*; the build order puts `Stage 1 + anti-sweep` before pity).
  - [x] [ARCHITECTURE-SPINE.md:148 (AD-14)](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148) — ⭐ read the DECISION E clause to its end: the suppressed set travels *"so the width of the tie that did not form stays readable to the ladder (6.5), **anti-sweep (6.6)** and pity (6.7)"*. **`:218`** (Stage 1 luck), **`:220`** (anti-sweep, verbatim: *"Live awards processed in ascending `priority`; a player already awarded this spin is removed from later candidate sets, so overflow re-resolves to the next-eligible player"*), **`:221`** (pity — **not yours**), **`:234`** (the `UNIQUE` is DB-enforced), **`:392`/`:406`** (the ERD's two anti-sweep annotations).
  - [x] ⭐ [reviews/review-data-integrity.md:158-191](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/reviews/review-data-integrity.md#L158) — **M1 in full.** Its three sub-findings are AC2's content: `is_shared` drift, the missing DB uniqueness, and *"a shared co-winner trophy can itself violate anti-sweep silently"*. Its `:388-389` note is also load-bearing: `award.priority` must be `UNIQUE NOT NULL` *"or the anti-sweep 'ascending priority' iteration is non-deterministic when two awards share a priority"* — `0023` already enforces it; **confirm, do not assume.**
  - [x] ⭐ [worker/awards/stage1.go](worker/awards/stage1.go) **:198-251** (`Stage1Candidate`, `Stage1Input` — the shelf's W1 freeze, the table's ownership note, the optional `Ladder`), **:254-280** (`Stage1Draw`, `Stage1Result` — ⚠ **`Live` is in DRAW order and `:269-274` names you by number**), **:287-299** (`Stage1Weights` — *"so 6.6's luck meter can render the weights it is about to bias without consuming a byte of a ceremony's stream"*), **:316-375** (`stage1Weighted` — where `ordered` is built by ascending priority), **:377-498** (`stage1Weight` — DECISION F's no-winner arm, the MIN-shelf co-winner rule, **the one-sided W8 clamp at `:460` and `:487` that `deferred-work.md:308` is about**), **:512-604** (`Stage1Pick`), **:649-690** (`validateWeightTable`), **:96-131** (the **ten** `Detail*` values and the note that only **eight** are row-representable). Mirror in [lib/roulette/stage1.ts](lib/roulette/stage1.ts) **:99-149**, **:166-173**, **:287-300**, **:318-360**, **:378-536**, **:545-613**, **:218-235**, **:660-707**.
  - [x] ⭐ [worker/awards/ladder.go:246-261](worker/awards/ladder.go#L246) and [lib/roulette/ladder.ts:254-269](lib/roulette/ladder.ts#L254) — **`ResolveLadder(award, tied, players)` / `resolveLadder` was designed for you**: *"IT TAKES AN EXPLICIT `tied` RATHER THAN AN Outcome… 6.6's anti-sweep re-resolves an award over a REDUCED set after the original winner is removed, and building a fake tie Outcome to do that would be inventing a Stage-2 result that Stage 2 never produced."* ⚠ Then read `ladder.go:653-662` (validation order: `stage2` is re-run **because you are a public entry point with no preceding Stage-2 call**) and the **width-1 refusal** at `:726`.
  - [x] [worker/awards/stage2.go](worker/awards/stage2.go) **:95-130** (`Award`), **:149-200** (`SnapshotPlayer`), **:223-260** (`OutcomeKind` — the closed **five**; `LadderExit*`), **:288-317** (`Outcome`'s flat five arms), **:344-346** (the `Ladder` port — **no stream, the signature is the proof**), **:388-433** (`ResolveAward` + `ladderIsNil`'s typed-nil guard), **:435-540** (`ResolveStage2`, and **where DECISION E's zero carve-out fires**), **:678-745** (`eligiblePlayers` — the FR-21 floor filter you must NOT duplicate). Mirror in [lib/roulette/stage2.ts](lib/roulette/stage2.ts) **:51-149**, **:251-330**, **:377-455**, **:660-728**.
  - [x] [supabase/migrations/0024_ceremony_lock_snapshot.sql:144-153](supabase/migrations/0024_ceremony_lock_snapshot.sql#L144) (what 0024 deliberately did NOT build and whose it is), **`:191-204`** (⭐ **`luck_weight_table int[], -- SHELL — Story 6.6`** and the shell precedent: *"the table shape arrives once so a later story widens behaviour, never the schema"*), **`:223-253`** (the ceremony comment + the **no-grant-to-anon/authenticated** admin-only pattern AC2 copies). Then [0023_award_catalog.sql](supabase/migrations/0023_award_catalog.sql) for `award.priority`'s `UNIQUE` and the closed-set CHECK conventions your new tables must follow.
  - [x] [roulette/vectors/README.md](roulette/vectors/README.md) — the ownership table (`:31-39` — ⭐ **there is no 6.6 row; you add it**), the "not finished" line (`:54-57` — it does not name you either), the format rule (`:59-70`), the provenance split (`:207-212`, `:325-328`), the representability rule (`:330-335`, `:438-447`), the three hard rules (`:13-24`), and the loader table (`:597-605`).
  - [x] [roulette/vectors/generate_vectors.py](roulette/vectors/generate_vectors.py) — `main()`'s `outputs` dict at **`:4480-4486`** (⭐ **one line registers a new file; `--check` and the write path both iterate it**), `render` `:4470-4472`, the Stage-1 half `:1653-1752` (`stage1_weight` with DECISION F + the MIN rule + the clamp, `stage1_weights`, `stage1_pick` — and the *"VALIDATION ORDER IS PART OF THE CONTRACT"* docstring), the fixtures `:1821-1900` (⭐ **`TABLE = [100, 40, 16, 6, 2, 1]` at `:1826` — "SOLUTION-DESIGN §9.2's own example table, table_max = 5"**, `SHELF` at `:1854`, and **`STAGE1_ROSTER_ONE_SWEEPER` at `:1863` — the sweeper roster already exists**), the row assembly `:2655-2692` (the two absence-is-an-input rules), the header block `:2761-2809`, and 6.5's **append banners** at `:2271` / `:2583` (the pattern for extending a file you do not own).
  - [x] [6-4b-stage-1-seeded-weighted-category-pick.md](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md) — its **Questions** `:383-400` (the `live_count` question and DECISIONS F and G), its **Handed to the next stories** `:590-603` (⭐ the three sentences addressed to you), and its W1–W10 edge pins.
  - [x] [6-5-fr-29-tie-ladder.md](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md) Completion Notes `:551-683` — especially the measured **0 of 12 awards end shared**, the five real ties and their exit rungs, and the `deciding_value` **XOR** `ladder_exit_step` invariant. Then `:753-779` — **what 6-5b owes and you inherit if it has not landed.**
  - [x] [deferred-work.md:308](_bmad-output/implementation-artifacts/deferred-work.md#L308) and **`:317`** in full — the only two items in the entire file homed to this story, both *"6.6 owns its VALUES"*. Also `:269` (**0/28 clear the floors** — the measurement that makes THE BAR need a counterfactual) and `:270` (the 27-way zero tie DECISION E suppresses).
  - [x] [EXPERIENCE.md:169](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L169) — *"**One-trophy cap.** 'un trofeo por giro.' If a Player would win two live categories in one Spin, they take the **higher-priority** one; the other passes to the next eligible Player (FR-26)."* ⭐ **This is the clearest statement of the rule in any artifact and it is the UX spine's.** Also `:167` (the luck-meter is **hidden**), `:229`, and `mockups/mock-ceremony.html:764-783` (the only anti-sweep copy that exists: `Un trofeo por giro` / `anti-barrida — Theo queda fuera del premio 8.` + the trophy shelf) — ⛔ **presentation is 6.10's; read it so your data shape can serve it, build none of it.**
  - [x] Sweep-prove the greenfield claim before writing a line: **nothing named `assigned_this_spin`, `assignedThisSpin`, `assigned`, `sweep`, `antiSweep`, `overflow` (as a business concept) or `pity` exists anywhere in `worker/awards/` or `lib/roulette/`.** (Confirmed at contexting. **Re-confirm, do not assume.**)

- [x] **Task 1 — Pin the edge semantics IN CODE COMMENTS before implementing (AC: 1, 4)**
  > Same discipline as 6.3's E1–E4, 6-4a's S1–S7, 6-4b's W1–W10 and 6.5's L1–L12, and for the same
  > reason: each is a place where two honest implementers reading the same three-sentence spec crown
  > a different player. Each gets a vector row in Task 2 and a named comment at its implementation
  > site **in both languages**.
  - [x] **A1 — the pass takes NO stream and draws ZERO bytes.** The signature is the proof (AC4). ⛔ Do not add a `*Stream` parameter "for the overflow" — re-resolution is Stage 2 + the ladder, and both are pure. A runtime `Consumed()` assertion around a function with no stream parameter is **vacuous**; 6-4b deleted exactly that assertion.
  - [x] **A2 — ASCENDING `priority` is the processing order, and `Stage1Result.Live` is NOT in it.** `Live` is **draw** order because that is the reveal order (`stage1.go:269-274` says so and names you). Sort a **copy**; never mutate the caller's slice. ⚠ `award.priority` is `UNIQUE` per tournament (`0023`), which is what makes the sort a **total** order — `review-data-integrity.md:388-389` says a duplicate priority makes the iteration non-deterministic. **Refuse a duplicate priority in the live set** rather than relying on a stable sort.
  - [x] **A3 — removal is applied to the CANDIDATE SET, BEFORE Stage 2 runs.** Never to an `Outcome` afterwards. This is the whole of DECISION E'. Post-hoc removal is what creates `review-data-integrity.md:175-179`'s hazard (a `shared` set containing an already-awarded player) and it also produces a winner who is not the best of the set they actually competed in.
  - [x] **A4 — overflow re-resolution is a FULL Stage-2 re-run over the reduced set, never a "pop the winner".** ⭐ The reasons are three and each is independently sufficient: (i) the ladder's rung 3 is defined as *"a strict dominator over the **remaining set**"*, and the remaining set changed; (ii) `best` is a **SET**, so removing one member can change which players are tied and therefore which rung resolves them; (iii) DECISION E's zero carve-out is evaluated against the reduced set's best value, which may now be `0`. A pop-the-winner shortcut is correct only when the original outcome was a lone `winner` with no tie behind it, and distinguishing that case is more code than re-running.
  - [x] **A5 — every winner counts, including every co-winner.** *"Co-winners all count"* (`SOLUTION-DESIGN:427`). A `shared` outcome assigns **all** of its `winners`. This is also what makes the DB `UNIQUE(spin_id, winner_entry_id)` the correct backstop shape.
  - [x] **A6 — `no_eligible_players` and `no_awardable_value` assign NOBODY, and neither is a refusal.** They pass through with an empty winner set and the `assigned` set is unchanged. ⭐ **DECISION K (carried from 6.5): read the suppressed `Tied` width, never resolve it.** A pass that "helpfully" resolves a `no_awardable_value` re-crowns the 27-way zero tie DECISION E exists to suppress.
  - [x] **A7 — EXHAUSTION is a first-class outcome, not a refusal and not a lie.** When removal empties the eligible set, `ResolveStage2` naturally returns `no_eligible_players` — ⚠ **which is indistinguishable from "nobody cleared the FR-21 floors", and those two facts differ for 6.7's pity, for 6.8's reveal copy and for anyone reading the bundle.** Carry the distinction on the **result row** (e.g. a `swept_out []string` that is non-empty, or an explicit reason), **not** as a sixth `OutcomeKind` — `OUTCOME_KINDS` is pinned by exact equality in both suites and widening it is a cross-cutting change this story has no mandate for. See DECISION F.
  - [x] **A8 — a reduced TIE of width 1 is YOURS to handle, because the ladder REFUSES it.** `validateLadder` refuses `len(tied) < 2` (L11, `ladder.go:726`, detail `tied`). But `ResolveStage2` cannot emit a width-1 tie either — so the only way you see one is if you construct it. **Do not construct it:** re-run Stage 2 over the reduced players and let it decide `winner` / `tie` / `no_eligible_players` naturally. The vector row exists to prove you never hand the ladder a width-1 set.
  - [x] **A9 — the pass NEVER re-applies the FR-21 floors and never re-derives a deciding value.** `eligiblePlayers` already applies them inside `ResolveStage2`; you reduce the **player list**, and Stage 2 filters it. Re-filtering is the mutation 6.5 had to add a vector row to kill, one layer down.
  - [x] **A10 — the pass NEVER touches the shelf, and never feeds back into Stage-1 weights.** ⭐ The shelf is **frozen at spin start** (W1, `SOLUTION-DESIGN:411`) and Stage 1's provisional winners are computed **before** any anti-sweep removal, so **the luck weighting can be justified by a player who then does not win the award.** That is intended — it is what keeps Stage 1 a pure function of the frozen shelf and therefore reproducible from the bundle — and it is nowhere stated in any document, so **state it at the site.** Advancing the shelf across spins is the caller's job (and 6.7 reads the result).
  - [x] **A11 — typed refusals with a CLOSED, genuinely closed, detail set declared ONCE in the vector.** Mirror `Stage1InvalidError` / `LadderInvalidError`. 6-4b shipped a "closed set" that was 9 / 7 / 7 across three implementations; 6.5 shipped one whose fifth value no suite inspected. **Declare the vocabulary in the vector, have all three read it, and assert ≥1 row per representable value and ZERO rows for the unrepresentable ones** — the machinery is at [worker/awards/stage1_test.go:511-524](worker/awards/stage1_test.go#L511) and [lib/roulette/stage1.test.ts:405-423](lib/roulette/stage1.test.ts#L405). Copy it; do not invent a second design.
  - [x] **A12 — a Stage-2 or ladder refusal PROPAGATES under its own label, never swallowed into an outcome.** Three distinct facts, three distinct details: the award/snapshot is malformed (`stage2`), the ladder ran and refused (`ladder`), the live set's own shape is wrong (`live`). 6-4b's `stage1.go:390-415` is the exact precedent.
  - [x] **A13 — VALIDATION ORDER IS CONTRACT.** Decide it once, publish it in the vector's `spec` string, mirror it in all three implementations, and include ⭐ **one row malformed in TWO ways at once** so a reordering is observable. 6-4b's headline was three implementations disagreeing on order with no row able to see it; 6.5 shipped the same class again.

- [x] **Task 2 — The vector seam (AC: 5)**
  - [x] ⭐ **Decide the file, and say why in Completion Notes.** Two shapes have precedent: a **new file** registered by one line in `main()`'s `outputs` dict ([generate_vectors.py:4480-4486](roulette/vectors/generate_vectors.py#L4480)) — the `stage2-resolve.json` / `ladder-resolve.json` pattern — or **appended rows** to `stage1-pick.json` under a banner, the pattern 6.5 used (`:2271`, `:2583`). **Recommended: a NEW file** (`antisweep-resolve.json`), because this is a distinct resolution pass with its own inputs (a *set* of live awards) and `stage1-pick.json` is already 198 KB; also because anti-sweep, like Stage 2 and the ladder, **consumes no stream** and therefore is not one of §9.6's numbered *stream* gates — give the README row the same rationale note Stage 2 and the ladder carry.
  - [x] Case shape, following the house style: `{ "name", "note", "live": [{award_id, priority, award:{…}}], "players": [ …AD-19 rows… ], "expected": { "results": [ {award_id, priority, kind, steamid64 | winners | tied, ladder_exit_step, swept_out, reresolved} ], "assigned": ["<steamid64>", …] } }`.
  - [x] ⭐ **`swept_out` and `reresolved` are as load-bearing as the winner.** A vector that pins only who won lets a pass that reaches the right player **without ever removing anyone** pass every row — and the whole story is the removal. Pin them on **every** result.
  - [x] Mandatory rows — every one named in AC5, plus: a live set supplied **out of priority order** (so the sort is load-bearing rather than decorative — ⚠ 6-4b's own note at `generate_vectors.py:2249-2250` warns that a row whose draw order *coincidentally* equals priority order discriminates nothing); a spin where the **highest-priority** award is the one that overflows; a spin where **two different** players are swept out by two different awards; and an overflow where the removed player was a **co-winner** of the earlier award.
  - [x] `refusals` array with the closed-set `detail` per row and the generator asserting the declared `detail` matches the guard that actually raised: a **duplicate `award_id`** in the live set; a **duplicate `priority`** (A2); an **empty** live set; a live award whose `award` surface fails Stage-2 validation (`stage2`); a snapshot the ladder refuses (`ladder`); a `players` list with a duplicate `steamid64`; and ⭐ **one row malformed in two ways at once** (A13).
  - [x] ⭐ **Guard the guards** — the project's own recurring defect, now at its **third** occurrence ([6-5:763](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L763)). Every coverage flag must name the **specific row** it claims and **re-derive that row's property from its own data**: the cascade row's guard must re-derive that award 3's original winner was award 2's re-resolved winner; the exhaustion row's guard must re-derive that the eligible set was **non-empty before** removal; the DECISION-E-on-the-reduced-set row's guard must re-derive that the best value was **non-zero before** removal. Pin the **case-name set by exact equality in both suites**, use `pins` / `pins_inputs` at the anchor, and assert **exactly one** row per uniquely-claimed property.
  - [x] Extend `generate_vectors.py` to produce **and `--check`** the new file, reusing its existing helpers (`_p`, `_award`, `resolve_stage2`, `resolve_ladder`, `_render_player`, `_render_ladder_player`). ⛔ **Do not hand-write expected values, do not add a second generator, and never "fix" the generator by reading either implementation** (`README.md:576-578`).
  - [x] Update [roulette/vectors/README.md](roulette/vectors/README.md): the ownership row, a format section, a "cases that carry the weight" table in the house style, and `:54-57`'s "still to come" line updated to name only 6.9 and 6.11.
  - [x] Vectors are **data, not code**: LF newlines, 2-space indent, stable key order. Snapshot magnitudes stay decimal **strings**; priorities, weights, `live_count` and `ladder_exit_step` stay JSON **integers** — the split is by **provenance** (`README.md:207-212`).
  - [x] `--check` must be **OK on all five existing files** afterwards, with `prng-block.json`, `prng-uniform-int.json`, `stage2-resolve.json` and `ladder-resolve.json` **byte-identical**. `stage1-pick.json` may move only if Task 5's weight-table decision changes its fixture — and if it does, **say so and prove the diff is what you intended**.

- [x] **Task 3 — Go producer: `worker/awards/sweep.go` (AC: 1, 4)**
  - [x] A **pure** pass over injected inputs. Recommended seam:
        `func ResolveSpin(live []Stage1Candidate, players []SnapshotPlayer, ladder Ladder) (SpinResult, error)`
        with `SpinResult{ Results []AwardAssignment; Assigned []string }` and
        `AwardAssignment{ AwardID string; Priority int; Outcome Outcome; SweptOut []string; Reresolved bool }`.
        ⭐ **Reuse `Stage1Candidate`** (`stage1.go:198`) rather than declaring a near-identical type — two near-identical shapes is how the two runtimes drift, and 6.5 said the same thing about `StatValue`.
  - [x] `Assigned` is returned in **byte-lex order**, the same order Stage 2 iterates and rung 5 returns. `SweptOut` is per award, in byte-lex order.
  - [x] Typed refusals: a new `ErrSweep` sentinel with `SweepInvalidError{Detail, Reason, Cause}` mirroring `Stage1InvalidError` (`stage1.go:134-155`), `Unwrap() []error` returning `{ErrSweep}` or `{ErrSweep, Cause}` so `errors.Is` reaches both. Declare the `Detail*` closed set **once** and make it genuinely closed.
  - [x] `worker/awards` stays a **LEAF** — no `worker/store`, `worker/db`, `worker/ingest`, `worker/config`. `TestPackageIsALeaf` (`prng_test.go:898-907`) will tell you if it stops being one.
  - [x] `worker/awards/sweep_test.go` — table-driven **and** vector-driven (`loadVector` from `../../roulette/vectors`). Guard the loader against malformed rows; give every conformance switch a **final arm** that fails loudly on an unknown value; assert refusals are the **typed** error **and** the declared `detail`, never merely "some error".
  - [x] ⚠ **`worker/awards/prng_test.go` will redden and that is its job.** The shipped file set at `:809` is an **exact equality** — `{labels.go, ladder.go, prng.go, stage1.go, stage2.go}` becomes six. ⛔ **Do NOT add `sweep.go` to the `math/big` `exceptIn` list at `:847-851`.** This pass does no arithmetic of its own — it delegates every comparison to `ResolveStage2` and `ResolveLadder`, which hold the exemption for a reason. Say so at the site, the way 6-4b said it about `stage1.go`.
  - [x] Banned constructs apply in full: no `float64`, no `math/rand`, no `time`, no `crypto/rand`, no `os`, no `fmt.Sprintf` in the decision path, no `.Int64()`/`.Uint64()`/`.Float64()`.
  - [x] Run `gofmt -l ./worker` — it must be **empty**.

- [x] **Task 4 — TS verifier: `lib/roulette/sweep.ts` (AC: 1, 4)**
  - [x] The mirror — same names in camelCase, same refusals, same `detail` values, same processing order, same result shape. **`resolveSpin` is SYNCHRONOUS** (it draws nothing — A1), unlike `stage1Pick`.
  - [x] ⛔ **No `import 'server-only'`**, ⛔ **no import of `lib/awards/**`** (it is `server-only` and would poison the browser bundle — the award projection arrives as plain data), ⛔ no `node:` import, ⛔ **no `./prng` import** (AC4 — the import-graph pin is the proof).
  - [x] ⚠ **`lib/roulette/prng.test.ts` reddens in three places and each must be updated deliberately:** the module list at `:668-674` (exact equality, five → six), the per-module import-graph pin at `:774-788` (`'sweep.ts': ['./ladder', './stage2']` or whatever it actually imports — **and the absence of `'./prng'` is the load-bearing half**), and the non-vacuity pin at `:794-797` (`['ladder.ts', 'stage1.ts']` → plus `sweep.ts`).
  - [x] `lib/roulette/sweep.test.ts` — colocated under `lib/**` or [vitest.config.ts:17](vitest.config.ts#L17) **silently does not run it**. Load the vector with `readFileSync` from the repo root.
  - [x] ⚠ Normalise **absent containers** the way 6-4b's review resolved it: `undefined` → `{}` / `[]` **inside this module** (a missing container IS the empty case, because Go cannot idiomatically distinguish `nil` from empty), while `null` and structurally-wrong types stay refused in TS/Python as a deliberately **non-vectorable** guard. Do **not** loosen `stage1.*` / `stage2.*` / `ladder.*` to suit this caller.
  - [x] Add per-row `detail` assertions from the start. 6-4b's TS local table asserted only `toThrow(Stage1Error)` and left two guards mutation-invisible.

- [x] **Task 5 — The luck weight table's VALUES, MEASURED (AC: 3)**
  - [x] ⭐ **Measure before you choose.** Over the real corpus and the real 12-award catalog, print: the shelf distribution after a full ceremony at each `live_count` width; the **maximum shelf any player reaches**; and therefore **which entries of a candidate table are reachable at all**. SOLUTION-DESIGN §9.2's own example is `[100, 40, 16, 6, 2, 1]` (`table_max = 5`) and it is already the vector fixture (`generate_vectors.py:1826`). ⚠ With 12 awards and 28 players a shelf of 5 requires one player winning five trophies — **say whether that is reachable, with the number.** A table whose tail is unreachable is not wrong, but shipping it while calling it measured would be narration.
  - [x] Publish the chosen values as a named constant with the derivation **at the site**, and write the `ceremony.luck_weight_table` population path. ⚠ **`0024` created the column as a SHELL for you** — writing a value into an existing column needs **no migration**. If you find yourself reaching for DDL here, stop: that is AC2's migration, not this task's.
  - [x] ⭐ Close [deferred-work.md:308](_bmad-output/implementation-artifacts/deferred-work.md#L308): the W8 clamp is **one-sided** (`if index > tableMax`) in both runtimes, so a negative shelf entry — or an empty `table` making `tableMax = -1` — panics in Go and yields `undefined as number` in TypeScript. **Two failure kinds for one input**, in a pair of runtimes whose whole contract is identical behaviour. `validateShelf` already refuses a negative size and `validateWeightTable` already refuses an empty table, so the fix is a **defensive clamp on the low side plus a typed refusal**, in both languages, with a vector row if it is representable (⚠ it may not be — a negative shelf is refused upstream; if so, **declare it non-row-representable** the way `internal` is, rather than leaving it silent).
  - [x] ⭐ Close [deferred-work.md:317](_bmad-output/implementation-artifacts/deferred-work.md#L317): the *"clamp AFTER the minimum"* comment at `stage1.go:458-462` / `stage1.ts:461-463` / `generate_vectors.py:1699-1701` asserts a distinction with **no observable difference** (`min(x, tableMax)` is monotone, so `clamp(min(S)) == min(clamp(S))` for all inputs). Rewrite it so it stops reading as a pinned invariant — it currently devalues the genuinely load-bearing `min`-vs-`max` rule three lines above it. ⚠ Its `generate_vectors.py:437-439` citation is **stale**; the live site is `:1699-1701`.
  - [x] A named test proving **shelf 0 ⇒ `table[0]` ⇒ heaviest** and that weight is **monotone non-increasing** in shelf size, in both languages. ⚠ Make it re-derive the property from the table it is handed, not from a transcribed literal.

- [x] **Task 6 — Migration `0025` (AC: 2)**
  - [x] `spin`, `award_result`, `award_result_winner` exactly as [SOLUTION-DESIGN:205-233](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L205) declares them, following 6-4a's recorded migration conventions and 0023/0024's house style (closed-set CHECKs, `on delete` declared on every FK, `comment on table`, the ⚠-block header saying what this migration deliberately does **not** build and whose it is).
  - [x] ⭐ The point of the migration: **`unique (spin_id, winner_entry_id)` on `award_result_winner`**, which is why that table carries a denormalized `spin_id`. Add the FK-consistency check `review-data-integrity.md:187-189` asks for, so a row's `spin_id` cannot disagree with its `award_result`'s.
  - [x] M1's two companions: **`is_shared` asserted** against the winner count (a deferred constraint or a trigger — or drop the column and compute on read, and say which you chose and why), and the **delete-prior-on-rerun** contract stated in the table comment (`:190-191`) — with `UNIQUE(spin_id, winner_entry_id)` in place, a re-run without delete-prior **hard-fails on insert**, so the contract is not optional documentation.
  - [x] Grants: `service_role` only, following [0024:250-253](supabase/migrations/0024_ceremony_lock_snapshot.sql#L250). ⛔ **No RLS policy and no grant to `anon`/`authenticated`** — admin-only by absence is exactly what 0024 did for `ceremony`, and the reveal-gated axis is **6.8's WIDENING**. Say so in the comment so 6.8 does not think it must tighten something.
  - [x] A pgTAP file proving: the constraint rejects a second trophy for one player in one spin; it permits the same player in a **different** spin; the FK cascades match the declared `on delete`; `is_shared` cannot drift; and the closed-set CHECKs hold. ⚠ **`supabase db reset` before running the suite** — 6-4a's first attempt failed 6/25 purely because its own QA rows collided with the suite's fixtures.
  - [x] ⛔ **Nothing writes a `spin` row in this story.** The tables land empty. If that feels wrong, re-read Question 2 — it is the trade DECISION A takes deliberately.

- [x] **Task 7 — ⛔ THE BAR: the real corpus, both runtimes, mechanically diffed (AC: 6) — this gates sign-off**
  - [x] Bring up the local stack (or reuse 6.5's captured export) and rebuild the corpus the same way: 14 real `.dem.gz` → the REAL `ingest.DemoinfocsParser` → `stat_row` via the REAL `RecordParse` → the REAL `bind_match_demo` / `approve_match` → the REAL `lock_ceremony`. Anchors that prove it is the same corpus: **204 rounds · 28 roster · `fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0**. ⚠ `content_sha256` will differ again and that is **correct** (`achievement_ts` is wall-clock approval time).
  - [x] ⭐⭐ **Answer the `live_count` question with data.** Run the full 12-spin ceremony at `live_count = 1` and print **how many times the cap fires** (expected: zero — print the zero, do not narrate it), then at widths 2, 3 and 4 printing per width: the cap-fire count, the overflow count, the maximum re-resolution depth, how many overflows reached the **ladder**, how many produced a **`shared`** outcome, how many hit **exhaustion**, and the **exact byte cost**. ⚠ At the real floors **0/28 players are eligible**, so run the floors-0 counterfactual too (harness only — **DECISION C: the 24/20 literals are untouched**), exactly as 6-4b and 6.5 did.
  - [x] ⭐ **The invariant that must not move:** the real-floors 12-spin ceremony stays byte-for-byte **22 bytes** with the anti-sweep pass wired in, and its drawn order stays character-for-character `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`. **A change in either is a defect, not a finding** — the pass draws nothing.
  - [x] Print the final **shelf distribution** and the **winless set**, and hand both to 6.7 by name. That set is pity's entire input.
  - [x] Diff the two runtimes' full transcripts **mechanically** (write both to files, `Compare-Object`, record each SHA-256) — not by eye. A mismatch is the story's headline finding, not a footnote.
  - [x] Both runtimes must read **ONE** catalog projection and **ONE** snapshot export (6-4a/6-4b/6.5's pattern: the TS half runs as a throwaway Vitest file, because `lib/awards/catalog.ts` is `import 'server-only'` and Vitest is the only runner with the stub alias).
  - [x] Harness convention: throwaway `worker/cmd/qa66/main.go` + `lib/roulette/bar-qa66.test.ts` + `_qa66/`, **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean while present *and* after removal. ⚠ `worker/cmd/qa54` is still in the tree and still not yours to delete; do not add a second orphan.

- [x] **Task 8 — Mutation pass, before review (non-optional) (AC: 5)**
  > Epic-5 retro Action Item #3 makes a reviewer-independent mutation pass a review gate, and **every
  > prior story's own table was optimistic until it was hardened**: 6.2 reported 43/0 and the reviewer
  > found 5 survivors in 6; 6.3's first table was structurally invalid; 6-4a's harness silently failed
  > to apply 12 of 18 Go mutations after a CRLF round-trip; 6-4b left one honest survivor fixed **in
  > the vector**; 6.5's first run had **ten survivors and one NOT-APPLIED**.
  - [x] **Run a CONTROL pass on unmutated source first and void the run unless it is green.** Read and write mutation files as **BYTES**. Run the **whole** vector-driven test set, never a `-run` filter. Report `NOT-APPLIED` as an outcome distinct from `killed`. Verify restoration by **SHA-256**.
  - [x] Mutate and record red/green in **both** languages: processing order changed from ascending to descending priority · the sort removed entirely (relying on `Live`'s draw order) · removal applied to the Outcome instead of the candidate set (A3) · a `shared` outcome assigning only its first winner (A5) · re-resolution replaced by pop-the-winner (A4) · re-resolution skipping the ladder · the assigned set reset between awards · the assigned set carried **across** spins · `no_eligible_players` / `no_awardable_value` assigning their `Tied` set (A6) · exhaustion refusing instead of resolving (A7) · the floors re-applied inside the pass (A9) · the shelf mutated (A10) · `swept_out` reported empty · `reresolved` always false · the duplicate-priority guard removed (A2) · a `Stream` parameter threaded through (A1 — must fail to compile or redden the import-graph pin) · the weight table's low-side clamp removed (Task 5) · shelf-0 mapped to `table[len-1]` instead of `table[0]` (AC3).
  - [x] ⭐ Every mutation must redden the **vector-driven** test, not only a hand-written local assertion. **A mutation that only reddens a local test means the vector does not cover it — fix the vector, not the test.**

- [x] **Task 9 — Gates (AC: 6)**
  - [x] **Measure the baseline first** — `npm test` and `go test ./...` before any change. 6.1 quoted stale numbers; do not. (6.5 post-T1: Vitest **1119 across 41 files**; Go `awards` **443**; pgTAP **1155 across 25 files**. If 6-5b landed first, re-measure — they will have moved.)
  - [x] `npm run lint` → 0 · `npm test` → report the delta and what each new test is · `npm run build` → 0, every viewer route still `ƒ` dynamic and **no `roulette` route** · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` → **empty**.
  - [x] `python roulette/vectors/generate_vectors.py --check` → OK on **all six**, with `prng-block.json`, `prng-uniform-int.json`, `stage2-resolve.json` and `ladder-resolve.json` **byte-identical** (prove it with `git status`, not by assertion).
  - [x] pgTAP: the previous baseline **plus** Task 6's new file. `supabase db reset` first.
  - [x] `git status` + `git diff --stat` proof that `app/**`, `lib/awards/**`, `lib/ceremony|i18n|bracket|steam/**` and `worker/ingest|store|db|config/**` are **byte-untouched**, and that the only `supabase/**` change is the new `0025` + its pgTAP file.

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A — this story DOES write to the database, and it is the first Epic-6 story since 6.2 to do so. `0025` is yours.**
This reverses the "DECISION A" carried by 6.3, 6-4a, 6-4b and 6.5, and the reason is that **AC2 is
undischargeable otherwise**: `UNIQUE(spin_id, winner_entry_id)` needs `award_result_winner`, which
needs `award_result`, which needs `spin` — and none of the three exists. The documents genuinely
conflict: [0024:144](supabase/migrations/0024_ceremony_lock_snapshot.sql#L144) homes those tables to *"6.4 / 6.5 / 6.8 / 6.9"*, while 6-4b's and 6.5's scope
boundaries both home **the constraint** to 6.6. The resolution takes the **shell precedent 0024 set
in its own words** — *"the table shape arrives once so a later story widens behaviour, never the
schema"* ([0024:191-193](supabase/migrations/0024_ceremony_lock_snapshot.sql#L191)): **6.6 lands the table shape plus the anti-sweep constraint; 6.8 widens it
with the reveal-gated RLS axis, the commitment surface and the writer.** Scope it tightly — tables,
constraints, grants, comments, pgTAP. **No policy, no RPC, no writer, no `spin_plan` content.** See
Question 2; this is the one decision that could still go the other way, and if it does, AC2 moves
wholesale to 6.8 and this story becomes algorithm-only.

**DECISION B — anti-sweep is a PURE PRODUCER-SIDE pass; the UNIQUE constraint is a backstop that must never fire.**
The removal loop lives in `worker/awards` + `lib/roulette` because the **verifier must reproduce it
from the bundle alone** ([SOLUTION-DESIGN:448-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L448) — *"The JS verifier needs **nothing** outside the bundle;
if it does, the bundle is incomplete (a spec bug)"*). A trigger-enforced anti-sweep would be
unreproducible in a browser. The DB constraint exists because `review-data-integrity.md:169-174`
measured that *"a producer bug (or a re-run that doesn't clean prior rows) could award the same
player two trophies in one spin… with nothing in the schema to catch it"* — it is a **second line**,
never the first.

**DECISION C (carried, and it has held four times) — the FR-21 floors and the `24`/`20` literals are UNTOUCHED.**
6-4a measured 0/28 eligible and changed nothing; 6-4b measured it again; 6.5 measured it again. A
floors decision is owed by someone ([deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269)) and it is **still** not owed by this story.
It is why THE BAR needs the floors-0 counterfactual to exercise anything at all.

**DECISION D — overflow re-resolution is a FULL Stage-2 re-run over the reduced set.**
Not a pop-the-winner. A4 gives three independently-sufficient reasons. Neither `SOLUTION-DESIGN:426-427`
nor `SPINE:220` says which, so this is decided here, written at the implementation site in both
languages, and pinned by its own vector rows.

**DECISION E' — removal is applied to the CANDIDATE SET before Stage 2 runs, never to an `Outcome` after it.**
This is what makes `review-data-integrity.md:175-179` structurally impossible rather than
defensively handled: *"if a tie bottoms out to a shared trophy (FR-29.5) including player P, and P
already won a higher-priority award this spin, the anti-sweep rule must remove P from the *shared*
set too."* If P was never in the candidate set, no shared set can contain P. The alternative — trim
the winners afterwards — would leave `ladder_exit_step = 5` on a sole winner, which is a lie 6.8
renders on stage.

**DECISION F — EXHAUSTION reuses `no_eligible_players` and carries its distinction on the RESULT ROW, not as a sixth `OutcomeKind`.**
`OUTCOME_KINDS` is pinned by exact equality in both suites and in the vector; widening it is a
cross-cutting change with consequences in `stage2-resolve.json`, `ladder-resolve.json` and both
conformance switches, and this story has no mandate for it (6.5 widened it once, deliberately, and
that widening is still an open `deferred-work.md:316` item at 6.9). ⚠ **But the distinction is real
and must survive**: "nobody cleared the floors" and "everyone was already assigned this spin" differ
for 6.7's pity and for 6.8's reveal copy. Carry it on the assignment row (a non-empty `swept_out`, or
an explicit reason field), name it at the site, and vector it.

**DECISION G — Stage-1 weighting is computed on PRE-anti-sweep provisional winners, and that is intended.**
The shelf is frozen at spin start (W1) and Stage 1's `provisional_winner(a)` is `ResolveStage2`'s raw
outcome — computed before any removal. So a category's luck weight can be justified by a player who
then does not win it. **Nothing in any document acknowledges this**, and two honest implementers will
split on it: one recomputes weights after each assignment (making the ceremony depend on resolution
order and unverifiable from the bundle), one does not. Decided here: **do not recompute.** State it
at the site in both languages.

**DECISION H — the luck-meter is HIDDEN and this story builds NO UI.**
FR-26 (`prd.md:369`): *"The luck-meter weighting… **is not shown to Players during the event**."*
`EXPERIENCE.md:167`: *"the **hidden** Anti-sweep luck-meter"*. There is no `{components.luck-meter}`,
no `medidor` string anywhere in the repo, and `/ceremonia` is still 5.7's `<Placeholder>`. AC3 is
discharged by shipping **measured values** and proving the bias, not by rendering it. Whether the
luck-meter state is revealed *after* the event is still an open mechanism detail
(`prds/…/addendum.md:89`) and is not this story's to close.

**DECISION K (carried from 6.5) — DECISION E's carve-out is upstream and stays upstream.**
A `max` volume award whose best value is `0` returns `no_awardable_value` carrying the suppressed set
so *"the width of the tie that did not form stays readable to the ladder (6.5), **anti-sweep (6.6)**
and pity (6.7)"* (AD-14). **Read the width, do not resolve it.** ⚠ And note the live wrinkle A4(iii)
names: after removal, an award that had a non-zero best can *newly* qualify for the carve-out. That
is `ResolveStage2` doing its job on the reduced set — let it.

### The seam you are extending — and the rule that governs it

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

[ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) is unchanged and still binding: *"there is **no dependency edge** between `worker/*` and
`app/`+`lib/`… The roulette **producer** (`worker/awards`) and **verifier** (`lib/roulette`) each
conform to `roulette/vectors` independently — **never to each other**."* Neither is the reference
implementation; when they disagree the vector decides; when the vector is silent, add a vector. This
is why Task 2 precedes Task 4.

### The algorithm, transcribed (do not re-derive it from prose)

The entire normative spec is **nine lines** across two documents (`SPINE:218,220` +
`SOLUTION-DESIGN:406-411, 425-427`). Everything below that is not in those nine lines is a DECISION
taken above.

```
resolve_spin(live, players, ladder):
    validate(live)                          # non-empty, no dup award_id, no dup priority   (A2, A13)
    ordered  = sort(live, by ascending award.priority)      # a COPY; never mutate the caller (A2)
    assigned = {}                                           # the assigned_this_spin set
    results  = []

    for a in ordered:
        # ── REMOVAL happens HERE, on the candidate set, BEFORE resolution              (A3, E')
        reduced   = [ p for p in players if p.steamid64 not in assigned ]
        swept_out = [ p.steamid64 for p in players if p.steamid64 in assigned ]

        # ── FULL Stage-2 re-run over the reduced set — never a pop                     (A4, D)
        #    ResolveStage2 applies the FR-21 floors itself; do NOT re-apply them        (A9)
        out = ResolveStage2(a.award, reduced)

        # ── a TIE goes through the FR-29 ladder over the REDUCED tied set              (A8)
        if out.kind == 'tie':
            out = ResolveLadder(a.award, out.tied, reduced)   # width >= 2 guaranteed by Stage 2

        # ── every winner counts, co-winners included                                   (A5)
        winners = out.winners        if out.kind == 'shared' else \
                  [out.steamid64]    if out.kind == 'winner' else \
                  []                 # no_eligible_players / no_awardable_value assign NOBODY (A6)

        assigned |= set(winners)
        results.append({ award_id: a.award_id, priority: a.priority, outcome: out,
                         swept_out: swept_out, reresolved: len(swept_out) > 0 })

    return { results: results, assigned: sorted(assigned) }   # byte-lex
```

⛔ **No stream, no clock, no randomness, no I/O** (A1). ⛔ **The shelf is not read and not written**
here (A10). ⛔ **Nothing re-applies the floors, re-derives a deciding value, or resolves a
`no_awardable_value`** (A6, A9, DECISION K).

### The APIs you consume — the anti-reinvention map

| You need | Go | TypeScript | Trap |
|---|---|---|---|
| the live set for a spin | `Stage1Result.Live []string` | `Stage1Result.live` | ⚠ **DRAW order, not priority order** — `stage1.go:269-274` names you |
| the candidate shape | `Stage1Candidate{AwardID, Priority, Award}` | `Stage1Candidate` | ⭐ **Reuse it.** A near-identical second type is how the runtimes drift |
| the deterministic winner | `ResolveStage2(award, players)` | `resolveStage2(award, players)` | Applies the FR-21 floors itself. It does **not** call the ladder |
| the tie resolution | ⭐ `ResolveLadder(award, tied, players)` | `resolveLadder(award, tied, players)` | **Designed for you.** Takes a bare `tied`; refuses `len(tied) < 2`; re-runs the award's Stage-2 validation because you are a public entry point |
| the full single-award path | `ResolveAward(award, players, ladder)` | `resolveAward(award, players, ladder)` | Its nil-ladder guard catches a **typed** nil (`ladderIsNil`) — mirror that property if you accept an injected ladder |
| the outcome | `Outcome{Kind, SteamID64, Winners, Tied, LadderExitStep, …}` (flat) | a five-arm discriminated union | ⚠ Go is one flat struct, TS is a union — a Go arm read without checking `Kind` reads a zero value, not a compile error |
| the suppressed zero set | `Outcome{Kind: KindNoAwardableValue, Tied}` | `{kind:'no_awardable_value', tied}` | DECISION K — **read** the width, never resolve it |
| the weights (zero bytes) | `Stage1Weights(in)` | `stage1Weights(input)` | Exported **for you**; consults no `LiveCount` and draws nothing |
| the weight table's shape | `validateWeightTable(table)` | `validateWeightTable` | Non-empty, all > 0, strictly decreasing. **Its VALUES are yours** |
| a refusal | `Stage1InvalidError{Detail, Reason, Cause}` + `Unwrap() []error` | `Stage1Error` | The precedent for `SweepInvalidError`. Copy the `Unwrap` shape so `errors.Is` reaches both sentinel and cause |
| the detail-split test machinery | `stage1_test.go:511-524` | `stage1.test.ts:405-423` | ⭐ Copy it. The ladder suites did not, and 6-5b's AC5 is the bill |

### Scope boundaries — hold these

**Build:** `worker/awards/sweep.go` + `sweep_test.go` · `lib/roulette/sweep.ts` + `sweep.test.ts` ·
`roulette/vectors/antisweep-resolve.json` + the `generate_vectors.py` extension + the README
ownership row · the **two pinning-suite updates** (`prng_test.go`'s file set, `prng.test.ts`'s module
list + import graph + non-vacuity pin) · the measured `luck_weight_table` VALUES and the two
`deferred-work` clamp fixes in `stage1.*` + the anchor · migration **`0025`** + its pgTAP file.

**Do NOT build** (each with its owner):
- **The pity draw, the winless sweep, `PITY_LABEL`'s stream, the consolation award** → **6.7**. You *fill* the shelf pity reads and *report* the winless set; you do not draw it.
- **`spin` / `award_result` / `award_result_winner` WRITES, `spin.live_award_ids` content, `spin_plan` content and shape, the reveal-gated RLS axis, `revealed_at` policies, `ceremony.state` transitions, the commitment surface, the audit row, any admin route** → **6.8**. You land the table *shape* and the *constraint* (DECISION A); nothing in this story inserts a row.
- **RFC-8785 canonicalization, `bundle_sha256`, the `luck` bundle key's shape, `algo_version` publication** → **6.9**. ⚠ Note the collision and leave it: the column is `ceremony.luck_weight_table`, the spine calls it `luck.weight_table`, the bundle key is `luck` — three names for one parameter, and the bundle key is **outcome-affecting for `bundle_sha256`**. **Record it; do not canonicalize it.**
- **Any UI, any wheel, the trophy shelf, `Un trofeo por giro` / `anti-barrida`, any i18n string, any route.** `/ceremonia` stays the 5.7 `<Placeholder>`. There is **no ceremony i18n namespace yet** and creating one is 6.10's.
- **The end-to-end ceremony vector with an anti-sweep overflow** → **6.11** (`SOLUTION-DESIGN §9.6` gate 4 says so by name). Yours is the *unit* vector for the pass.
- **Any change to 6-4a's Stage-2 resolution semantics** (the eligibility filter, best-as-set, DECISION E's carve-out), **6-4b's Stage-1 draw arithmetic or byte accounting**, or **6.5's ladder rungs, rung order, refusal semantics or exit steps.** Widening a type is not changing a semantic — if the pass needs Stage 2 or the ladder to *decide* differently, **stop and say so in Completion Notes.**
- **The FR-21 floors, the `24`/`20` literals, `public.leaderboard`** (DECISION C) · **anything in `worker/ingest|store|db|config`** or `lib/bracket|ceremony|steam|i18n`.
- **The nine findings 6-5b owns.** If 6-5b has not landed, note what you are building on; do not fix it here.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)); a test outside `lib/` **silently does not run**. Environment `node`. **Measure the baseline before claiming a delta.**
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./... -count=1`, then **`gofmt -l ./worker` must be empty** (`stage1_test.go` was the only unformatted Go file in the repo at 6-4b's review and no gate caught it). Table-driven; `t.Errorf` over `t.Fatalf` in shared helpers.
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe a vector value into source.** Guard the loader against malformed rows; give every conformance switch a **final arm**; assert refusals are the **typed** error **and** the declared `detail`.
- **Pinning tests** — three exact-equality assertions redden when you add a module and that is their purpose: `prng_test.go:809` (Go file set), `prng.test.ts:668-674` (module list), `prng.test.ts:774-788` (per-module import graph) plus `:794-797` (non-vacuity). Bans that must hold in the new modules: `server-only`, `node:`, `math/rand`, `Math.random`, `Date`, `toLocaleString`, `localeCompare`, `parseInt`, `**`, `fmt.Sprintf`, `float64`, and the 32-bit shift operators. ⛔ **`math/big` stays banned in `sweep.*`** — this pass delegates all arithmetic.
- **No vacuous assertions.** 6-4b **deleted** two rather than repairing them. If an assertion cannot fail for any implementation, delete it and let the signature carry the property.
- **`npm test` does not typecheck** — 6.3's build caught a type error 704 green tests could not. Run `npm run build` before you believe the suite.
- **Mutation pass before review** — Task 8, non-optional, control-pass-first, byte-level file IO, whole-suite runners, restoration verified by **SHA-256**. `git status` is **not** blind here: every file in `worker/awards`, `lib/roulette` and `roulette/` is tracked, and `git status` is what proves an unchanged vector regenerated byte-identically. Use both.
- **pgTAP** — a new file under Task 6. `supabase db reset` before running the suite.

### Stack

Pinned and current; **nothing new is introduced or permitted**. Go `1.26.4` (`worker/go.mod`) —
stdlib only. Node ≥ 20.9 · TypeScript `^5.9` (`verbatimModuleSyntax: true`, so every type-only import
is `import type`) · Vitest `4.1.9` · Next.js `16.2.10` · `tsconfig` target `ES2022` with `esnext` lib.
Postgres via Supabase local; pgTAP for DB tests. Python 3 **stdlib only** for the generator.
**No new npm package and no new Go module.**

### Previous story intelligence — 6.5 (`4c9cf36`), 6-4b (`ad8b649`), 6-4a (`9ccb832`), 6.3, 6.2, 6.1

- ⭐⭐ **The single most valuable thing 6.5 measured for you: `0 of 12 awards end SHARED` on the real corpus**, and the reason is structural — every player plays one match, so two players of one duel are never tied against each other on a tournament-wide total. Your `shared`-outcome anti-sweep paths are therefore **vector-only** in production, exactly like the ladder's rung 5. That is not a reason to build them weakly; it is a reason to say so with a number.
- ⭐ **The coverage-guard defect is at its THIRD occurrence.** 6-4a: `sawFloatDivergence` flipped by an unrelated row. 6-4b: three guards checked only the numbers their rows produced. 6.5: excellent `pins_inputs` machinery that covered **none** of the four rows the mutation pass itself added — the rows that were the sole killer of a mutation. The pattern is that guards get written for the rows the author was thinking about and the load-bearing rows arrive later. **Write the guard in the same edit as the row.**
- ⭐ **A "closed set" that is not closed.** 6-4b: `detail` declared 9 / 7 / 7 across three implementations, with TypeScript emitting the missing two anyway. 6.5: five declared, `internal` inspected by nothing. **Declare your vocabulary once, in the vector, and have all three read it.**
- ⭐ **Validation ORDER is contract, not taste.** 6-4b's headline: three implementations disagreed on whether `live_count` was validated before or after weighting, and **no row was malformed in two ways at once**, so the gate was structurally blind. 6.5 shipped the same class again and its fix is still owed to 6-5b. **Decide the order, publish it in the `spec` string, and write the doubly-malformed row.**
- ⭐ **T1 — the anchor is the thing that diverges.** 6.5's Group-1 patches added guards to both runtimes and not to `generate_vectors.py`; the arbitrating third implementation then **resolved inputs both runtimes refused** and emitted a trophy awarded to nobody as an expected value. **Anchor first, same published order, every time.**
- **An ABSENT container is the EMPTY case.** Cuatro's call at 6-4b's review: Go `nil` / TS `undefined` / Python `None` all normalise to `{}` / `[]` **inside** the module, while `null` and structurally-wrong types stay refused in TS/Python as a non-vectorable guard.
- **Go must not alias the caller's `*big.Int`** (6-4a). Your pass returns only strings, ints and Outcomes, so the hazard should not arise — confirm it does not.
- **`Object.freeze` is shallow** (6.1 shipped a "frozen" catalog of mutable entries). Deep-freeze any constant `lib/roulette` export.
- **The author's own mutation table is not proof** — 6.2 (43/0 → 5 survivors in 6), 6.3 (invalid table → 8 survivors), 6-4a (12 of 18 silently NOT-APPLIED after a CRLF round-trip), 6-4b (one honest survivor, fixed in the vector), 6.5 (ten survivors and one NOT-APPLIED on the first run).
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers.**
- **Gates at 6.5 sign-off (post-T1):** lint 0 · Vitest **1119 / 41** · build 0 · `gofmt -l ./worker` empty · Go clean, `awards` **443** · `--check` OK ×5 · pgTAP **1155 / 25** · `0025` free.

### The measurements this story must be designed against

| Measured on the real corpus | Value | What it means here |
|---|---|---|
| Players clearing the `24`/`20` floors | **0 / 28** | every award is `no_eligible_players` at the real floors, so the cap is unreachable without the floors-0 counterfactual (DECISION C: change nothing) |
| `live_count` at the shipped pacing | **1** (UX: *"one award per Spin"*) | ⛔ **FR-26's cap can NEVER fire.** 6-4b flagged it by name; AC6 must print the zero |
| Real-floors 12-spin ceremony | **completes, exactly 22 bytes**, order `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` | must be **unchanged** — the pass draws nothing. A change is a defect |
| Floors-0 ties (6-4b, reproduced by 6.5) | **5 of 12 awards** — `aw-01` kills w3 · `aw-03` hs_pct w2 · `aw-04` hs_kills w3 · `aw-08` through_smoke w2 · `aw-11` deaths w3 | the ties your reduced sets will re-resolve |
| Floors-0 ladder outcome (6.5) | with the rung keys filled, **all five exit at rung 1**; **12 single winners, 0 shared** | your `shared` anti-sweep paths are vector-only in production — **say so with the number** |
| Duel pairs sharing `achievement_ts` | **14 of 14 byte-identical**, but **0 of 5 real ties contains a duel pair** | the mechanism is real, the outcome unreachable on a one-match-per-player corpus |
| Exact per-player clones | `entry_frags`/`rounds_won`/`kast_rounds` **== `kills`** 28/28 · `opening_deaths` **== `deaths`** 28/28 | a reduced set can still tie on a clone stat — do not assume removal breaks a tie |
| `fair_seed` | `1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c` | the seed Task 7 must use, already anchored in every vector file |
| Corpus anchors | **204 rounds · 28 roster · row_count 28 · eligible_count 0** | prove you rebuilt the same corpus |

### Inherited items this story is named in

| Item | Source | What 6.6 owes it |
|---|---|---|
| ⭐ **A negative shelf index panics in Go and returns `undefined as number` in TypeScript** | [deferred-work.md:308](_bmad-output/implementation-artifacts/deferred-work.md#L308) — *"the next story that touches the `luck_weight_table` indexing (6.6 owns its VALUES)"* | Task 5 — close it in both languages, with a row or a declared non-representability |
| ⭐ **The W8 "clamp AFTER the minimum" comment asserts a distinction with no observable difference** | [deferred-work.md:317](_bmad-output/implementation-artifacts/deferred-work.md#L317) — same home | Task 5 — rewrite it. ⚠ Its `generate_vectors.py:437-439` citation is **stale**; the live site is `:1699-1701` |
| **M1 — anti-sweep accounting is under-constrained; `is_shared` can drift; a shared trophy can violate anti-sweep silently** | [review-data-integrity.md:158-191](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/reviews/review-data-integrity.md#L158) | AC2 + DECISION E' — all three sub-findings |
| **`award.priority` must be UNIQUE or the ascending-priority iteration is non-deterministic** | `review-data-integrity.md:388-389` | A2 — `0023` enforces it; **confirm**, and refuse a duplicate priority in the live set anyway |
| **`no_awardable_value` carries the suppressed set so anti-sweep can read the tie width** | AD-14 (`SPINE:148`), `README.md:250` | DECISION K — read it, never resolve it |
| **`live_count = 1` makes the cap unreachable** | [6-4b:383-390](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md#L383) | AC6 + Question 1 — **measure and report**, do not resolve by fiat |
| **The floors exclude the entire measured roster (0/28)** | `deferred-work.md:269` | DECISION C — not yours. THE BAR uses the counterfactual |
| **Nothing automatically runs `--check`** | `deferred-work.md:299` | Deferred to 6.11; run it by hand at Task 9 and say so |
| **The anchor's independence is weaker than claimed** | `deferred-work.md:300`, `:318` | Applies to your new file too — write the generator from the **spec text and this story's transcribed algorithm**, not from your first implementation, and **say which you did** |
| **Epic-5 retro #3 / #5** | [epic-5-retro-2026-07-28.md:95,97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95) | Task 8 (author's half) and "every claim backed by printed output" |

### Git intelligence — recent commits

`4c9cf36` (6.5, the FR-29 ladder + the five-rung vector) · `ad8b649` (6-4b, Stage 1 + gate 3) ·
`9ccb832` (6-4a, Stage 2 + the refusing ladder port) · `3f7c98e` (6.3, PRNG + vectors) · `eed5318`
(6.2, ceremony lock + snapshot) · `01e3f5b` (6.1, award catalog). The arc through Epic 6 is one story
per layer, vectors as the shared contract, a BAR over the real seam, a mutation pass before review,
and **no migration since 0024** because there was nothing to persist. This story ends that run
(DECISION A) — so the migration conventions matter here for the first time in five stories: re-read
6-4a's recorded ones and 0023/0024's house style before writing `0025`.

## Project Structure Notes

```
worker/awards/sweep.go                        NEW      the pure ascending-priority pass, ErrSweep, zero stream
worker/awards/sweep_test.go                   NEW      vector-driven + table-driven; case-name set pinned
worker/awards/stage1.go                       UPDATE   the low-side clamp fix + the corrected W8 comment (Task 5)
worker/awards/stage1_test.go                  UPDATE   the shelf-0-is-heaviest / monotonicity guards
worker/awards/prng_test.go                    UPDATE   shipped file set -> 6. ⛔ math/big exceptIn NOT widened
lib/roulette/sweep.ts                         NEW      the mirror; SYNCHRONOUS; NOT server-only; no ./prng import
lib/roulette/sweep.test.ts                    NEW      vector-driven; per-row `detail` assertions from the start
lib/roulette/stage1.ts                        UPDATE   the mirror clamp fix + comment
lib/roulette/stage1.test.ts                   UPDATE   the mirror guards
lib/roulette/prng.test.ts                     UPDATE   module list -> 6; import graph gains sweep.ts; non-vacuity pin
roulette/vectors/antisweep-resolve.json       NEW      clean spin, overflow, cascade, ladder overflow, shared, exhaustion, DECISION E on the reduced set, refusals
roulette/vectors/generate_vectors.py          UPDATE   build_antisweep_file + one line in main()'s outputs dict; the clamp mirror
roulette/vectors/README.md                    UPDATE   ownership row + format section + weight table + the "still to come" line
supabase/migrations/0025_ceremony_results.sql NEW      spin + award_result + award_result_winner + UNIQUE(spin_id, winner_entry_id) + is_shared assertion
supabase/tests/<nnnn>_ceremony_results.sql    NEW      pgTAP: the constraint bites, cross-spin is permitted, is_shared cannot drift
_bmad-output/implementation-artifacts/sprint-status.yaml   UPDATE
```

⛔ `roulette/vectors/stage1-pick.json`, `stage2-resolve.json`, `ladder-resolve.json`,
`prng-block.json` and `prng-uniform-int.json` must come out **byte-identical** unless Task 5's
decision moves a `stage1-pick.json` fixture — in which case **say so and prove the diff**. Naming
follows the established `lib/<domain>/<file>.ts` + `worker/<pkg>/<file>.go` layout.
`lib/roulette/**` must stay out of `app/`, must not acquire `server-only`, and must not import
`lib/awards/**` — it ships to the browser at 6.9.

## References

- Story ACs — [epics.md:1092-1112](_bmad-output/planning-artifacts/epics.md#L1092) · the Stage-1 half 6-4b shipped `:1064-1066` · the ladder 6.5 shipped `:1082-1088` · pity `:1122-1128` (6.7) · reveal-gating `:1140-1150` (6.8) · the end-to-end vector `:1209-1211` (6.11)
- **FR-26** (verbatim, with both testable consequences) — [prd.md:363-369](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L363) · **FR-25** `:354-361` · **FR-29** `:388-395` · **FR-21** (floors) `:314-321` · the glossary entry `:113` · the non-goal that leans on anti-sweep `:451`
- **AD-14** (the two-stage draw, the anti-sweep clause, DECISION E's carve-out **naming 6.6**) — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) · the Provably-Fair contract surface **`:218` (Stage 1 luck)**, **`:220` (anti-sweep)**, `:221` (pity), `:222` (the bundle) · the DB-enforcement line `:234` · the ERD annotations `:392`, `:406` · **AD-19** `:170-173` · **AD-22** `:185-188` · **AD-15** `:150-153`
- **The mechanism spec** — [SOLUTION-DESIGN §9.2](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L406) (Stage 1 + the frozen shelf) · **[§9.4](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L425) (the whole anti-sweep spec — three sentences)** · [§9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L440) (gate 4 exercises an anti-sweep overflow — 6.11's) · **the DDL you must follow `:205-233`** · the index `:260` · the reveal-gating policies 6.8 adds `:283-288`
- ⭐ **M1 — anti-sweep accounting** — [review-data-integrity.md:158-191](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/reviews/review-data-integrity.md#L158) · the priority-uniqueness note `:388-389` · the summary row `:413`
- **The no-edge rule** — [ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73)
- **UX** — [EXPERIENCE.md:169](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L169) (⭐ the one-trophy cap in the spine's own words) · `:167` (the luck-meter is **hidden**) · `:162-173` (the ceremony choreography) · `:229` · `:123` (shared co-winner, a designed outcome) · `:29`/`:134` (viewers are read-only; the banned list) · `mockups/mock-ceremony.html:764-783` (the only anti-sweep copy + the trophy shelf — **6.10's**)
- **The shipped seam** — [worker/awards/stage1.go](worker/awards/stage1.go) · [lib/roulette/stage1.ts](lib/roulette/stage1.ts) · [worker/awards/stage2.go](worker/awards/stage2.go) · [lib/roulette/stage2.ts](lib/roulette/stage2.ts) · [worker/awards/ladder.go](worker/awards/ladder.go) · [lib/roulette/ladder.ts](lib/roulette/ladder.ts)
- **The vector seam and its rules** — [roulette/vectors/README.md](roulette/vectors/README.md) · [generate_vectors.py](roulette/vectors/generate_vectors.py) (`main()`'s `outputs` dict `:4480-4486`)
- **The schema you extend** — [0024_ceremony_lock_snapshot.sql:191-253](supabase/migrations/0024_ceremony_lock_snapshot.sql#L191) (the `luck_weight_table` SHELL + the admin-only-by-absence pattern) · [0023_award_catalog.sql](supabase/migrations/0023_award_catalog.sql) (`award.priority` UNIQUE; the CHECK conventions)
- **Prior stories (read their Completion Notes in full)** — [6.5](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md) · [6-4b](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md) · [6-4a](_bmad-output/implementation-artifacts/6-4a-stage-2-deterministic-winner-and-tie-detection.md) · **[6-5b](_bmad-output/implementation-artifacts/6-5b-fr-29-ladder-vector-and-suite-debt.md) (what the ladder still owes)**
- **Inherited deferrals** — [deferred-work.md:269, 270, 299, 300, 308, 317, 318](_bmad-output/implementation-artifacts/deferred-work.md#L269)
- **Epic-5 retro Action Items #3, #5** — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95)

## Questions for Cuatro

Four. None blocks Task 0/1; answer before Task 2 fixes the vector in place.

1. ⭐⭐ **`live_count` stays at 1 — so FR-26's cap is dead code at the shipped pacing. Is that the intended
   ship state?** UX fixed the pacing at *"un premio por giro"* (`EXPERIENCE.md:164`, `:132`, `.memlog.md:7`
   — *"one award per Spin… many short spins; maximal per-reveal suspense"*), and at `live_count = 1` a
   player cannot win two awards in one spin, so the removal never removes anyone. 6-4b saw this coming and
   parameterized the seam for `N ≥ 1` rather than resolving it. **Recommended: ship the cap at
   `live_count = 1` anyway, and record the consequence as a measured number.** Three reasons: (a) it is a
   published fairness rule and the verifier must reproduce it whatever the width; (b) `spin_plan` is
   organizer config (OQ-7) that can change without a code change, and a cap that only appears when the
   config changes is a cap nobody has tested; (c) 6.11's end-to-end vector is *required* to exercise an
   anti-sweep overflow (`SOLUTION-DESIGN:443`), so the path must exist and be gated regardless. ⚠ **The
   consequence to see coming: on this corpus the cap fires ZERO times and pity is the only live mitigation
   for concentration.** If you would rather the cap actually fire, the lever is the **spin plan** (a wider
   `live_count` for some spins), and that is a UX/pacing decision — not something a resolver should take.
2. ⭐ **Does this story take migration `0025` and land `spin` / `award_result` / `award_result_winner`, or
   does AC2 move wholesale to 6.8?** AC2 as written requires a DB constraint on a table that does not
   exist, and the documents conflict about whose the table is (`0024:144` says 6.4/6.5/6.8/6.9; 6-4b's and
   6.5's scope boundaries say the *constraint* is 6.6's). **Recommended: take `0025` — tables, constraints,
   grants, comments and pgTAP only, no policy and no writer** — following 0024's own shell precedent
   (*"the table shape arrives once so a later story widens behaviour, never the schema"*), which is what
   makes AC2 literally true and pgTAP-testable here. The alternative is defensible: leave the DDL entirely
   to 6.8, discharge AC2 as a runtime refusal plus a quoted hand-off, and accept that the story ships with
   one of its three ACs deferred. **The cost of the recommendation is a table nothing writes to until
   6.8**; the cost of the alternative is an AC that cannot be proven.
3. **`luck_weight_table` VALUES: adopt SOLUTION-DESIGN §9.2's own `[100, 40, 16, 6, 2, 1]`, or size it to
   the measured shelf distribution?** The example table is already the vector fixture
   (`generate_vectors.py:1826`) and gives `table_max = 5`. **Recommended: adopt it, and publish the
   measurement that says which entries are reachable** — with 12 awards, 28 players and one trophy per
   spin, a shelf of 5 needs one player winning five trophies, which is exactly the sweep FR-26 exists to
   dampen. A table whose tail is unreachable is fine; shipping it while calling it measured is not. The
   alternative is a shorter table sized to the real ceiling, which is more honest about the config and
   changes the drawn bytes of every future ceremony.
4. **Exhaustion: is `no_eligible_players` + a non-empty `swept_out` the right encoding, or does it want its
   own name?** When anti-sweep empties a later award's candidate set, `ResolveStage2` returns
   `no_eligible_players` — indistinguishable from "nobody cleared the FR-21 floors", and the two differ for
   6.7's pity and 6.8's reveal copy. **Recommended: encode the distinction on the assignment ROW, not as a
   sixth `OutcomeKind`** — `OUTCOME_KINDS` is pinned by exact equality in both suites and in two vector
   files, 6.5's one deliberate widening is still an open item at 6.9 (`deferred-work.md:316`), and this
   story has no mandate for a cross-cutting vocabulary change. The alternative (a `swept_out_entirely`
   kind) reads better downstream and costs a coordinated change across four artifacts.

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5`), via `bmad-dev-story`.

### Debug Log References

- Corpus rebuild + THE BAR: throwaway `worker/cmd/qa66` (`roster` / `ingest` / `export` / `bar`),
  `lib/roulette/bar-qa66.test.ts`, `lib/awards/qa66-payload.test.ts`, `_qa66/` (fixture.sql,
  publish.sql, curate.sql, the decompressed demos, `bundle.json`, both transcripts) — **all deleted
  before commit**, with `go build ./... && go vet ./... && go test ./...` and `gofmt -l ./worker`
  proven clean while present *and* after removal.
- **REBUILT 2026-08-07** to discharge the review's re-measure decision, from nothing (the first
  harness was gone): `worker/cmd/qa66/main.go` with two subcommands — `build` (14 real `.dem.gz` →
  the REAL `ingest.DemoinfocsParser` → `db.RecordDemo` + the REAL `ingest.Validate` + the REAL
  `db.RecordParse` → the REAL `declare_match_format` / `bind_match_demo` → the REAL `approve_match`
  crowning → the REAL `curate_award_catalog` → the REAL `lock_ceremony`, then the two exports) and
  `bar` (the fourteen-configuration ceremony matrix) — plus `lib/roulette/bar-qa66.test.ts`, which
  both writes the REAL `toCuratePayload()` for the builder and runs the verifier-side matrix, and
  `_qa66/` (`curate-payload.json`, `catalog.json`, `snapshot.json`, both transcripts). **All three
  deleted before commit**, with the Go gates measured clean **while present** (`build` 0 · `vet` 0 ·
  `test ./...` ok · `awards` 607 · `gofmt -l ./worker` empty) **and again after removal** (identical:
  0 · 0 · ok · 607 · empty). Vitest 1320/43 while present → **1318/42** after removal, the exact
  inherited number. ⚠ `worker/cmd/qa54` was left untouched, and no second orphan was added.
- Mutation harness: a scratchpad Python runner (control-pass-first, byte-level file IO, whole-suite
  runners, SHA-256 restoration). Not committed — it is a process artifact, and the matrix below is
  its output.

### Completion Notes List

**CUATRO ANSWERED ALL FOUR QUESTIONS BEFORE TASK 2 FIXED THE VECTOR**, each with the recommendation:
ship the cap at `live_count = 1` and record the consequence as a measured number; take migration
`0025` (tables + constraints + grants + comments + pgTAP, no policy and no writer); adopt
SOLUTION-DESIGN §9.2's own `[100, 40, 16, 6, 2, 1]` and publish the reachability measurement; encode
exhaustion on the assignment ROW rather than as a sixth `OutcomeKind`.

⭐⭐ **THE HEADLINE — THE CAP FIRES ZERO TIMES AT THE SHIPPED CONFIGURATION, AND THE ZERO IS PRINTED
RATHER THAN ARGUED.** Over the real corpus at the shipped `live_count = 1`, the twelve-spin ceremony
runs the anti-sweep pass on every spin and the cap fires **0** times — not "did not happen to fire"
but **cannot**: with one live award the `assigned` set is still empty when that award resolves, so
no removal is possible in principle. `swept_out` is empty on all twelve rows and `reresolved` is
false on all twelve. That is 6-4b's flagged consequence, measured. The vector carries it as a row
(`the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY`) so the fact is gated rather than narrated.

⭐⭐ **THE INVARIANT DID NOT MOVE.** The real-floors twelve-spin ceremony is byte-for-byte **22
bytes** with the anti-sweep pass wired in, and its drawn order is character-for-character 6-4b's and
6.5's: `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`. The pass draws
nothing, and the signature is the proof — `ResolveSpin` / `resolveSpin` take no stream, the TS entry
point is SYNCHRONOUS, and `prng.test.ts`'s per-module import graph pins that `sweep.ts` does **not**
import `./prng`.

**THE FULL MEASURED MATRIX** (both runtimes, one shared export, transcripts diffed mechanically):

| floors | `live_count` | bytes | cap fired | awards over a reduced set | max swept out | via the ladder | shared | exhaustions | max shelf | winless |
|---|---|---|---|---|---|---|---|---|---|---|
| real 24/20 | 1 | **22** | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 28 / 28 |
| real 24/20 | 2 | 22 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 28 / 28 |
| real 24/20 | 3 | 22 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 28 / 28 |
| real 24/20 | 4 | 23 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 28 / 28 |
| floors-0 | 1 | 21 | **0** | 0 | 0 | 0 | 0 | 0 | 2 | 19 / 28 |
| floors-0 | 2 | 22 | **0** | 6 | 1 | 2 | 0 | 0 | 2 | 19 / 28 |
| floors-0 | 3 | 23 | **1** | 8 | 2 | 4 | 0 | 0 | 3 | 19 / 28 |
| floors-0 | 4 | 21 | **1** | 9 | 3 | 4 | 0 | 0 | 3 | 19 / 28 |

⚠ **"Cap fired" is measured against the COUNTERFACTUAL, not inferred from `swept_out`.** The harness
re-resolves each overflowing award over the FULL roster through the real Stage 2 and the real ladder
and counts only the awards whose winner would have been an already-assigned player. Those are
different facts, and the difference is exactly what the `a-CLEAN-spin-REMOVES-players-from-later-
races-and-CHANGES-NOTHING` vector row exists to pin: at floors-0 / `live_count = 2`, **six** awards
resolved over a reduced set and **none** of them changed hands.

⭐ **AT THE REAL FLOORS NOTHING IS REDUCED AT ALL, AND THE REASON IS UPSTREAM.** 0 of 28 players
clear 24/20 (measured again — the fourth story in a row), so every award is `no_eligible_players`,
which assigns nobody, so `assigned` never grows and no later candidate set is ever reduced — at ANY
width. The cap is unreachable on this corpus for two independent reasons, and only the floors-0
counterfactual exercises it at all. **DECISION C held: the `24` / `20` literals are untouched.**

⭐ **THE WEIGHT TABLE'S REACHABILITY, AS ASKED.** The maximum shelf any player reaches across the
whole matrix is **3** (and only **2** at the shipped `live_count = 1`), so of
`[100, 40, 16, 6, 2, 1]` the entries at indices **0–3** (`100, 40, 16, 6`) are reachable on this
corpus and the entries at indices **4 and 5** (`2` and `1`) are **NOT**. That is not a defect — the
table is organizer config and `table_max = 5` describes a player sweeping five trophies, which is
precisely the concentration FR-26 exists to dampen — but shipping it while calling it measured
without this number would have been narration. The values now live in ONE place,
`ceremony.luck_weight_table`, as `0025`'s column default under a shape CHECK; neither runtime seeds
one, which is why both suites' monotonicity guards re-derive the property from the table they are
handed rather than from a transcribed literal.

⭐ **THE WINLESS SET STORY 6.7 INHERITS.** At the **real floors** it is the ENTIRE roster — 28 of 28
— because nobody wins anything, so pity's input is everyone. At floors-0 it is **19 of 28**, and
⭐ **identical across all four widths**: anti-sweep changes WHICH award a player wins, never WHETHER
they win at all on this corpus. The 19 ids are in the transcript; the shelf distributions are
`shelf0:19 shelf1:6 shelf2:3` at width 1 and `shelf0:19 shelf1:7 shelf2:1 shelf3:1` at widths 3–4.

⭐ **0 SHARED OUTCOMES AND 0 EXHAUSTIONS ANYWHERE IN THE MATRIX**, which reproduces 6.5's measured
`0 of 12 awards end shared` and its structural reason (a player plays one match, so two opponents are
never tied against each other on a tournament-wide total). Both paths are therefore **vector-only in
production**, exactly like the ladder's rung 5 — a reason to state the number, not a reason to gate
them weakly, and both have dedicated rows with `pins_inputs` guards.

**THE CROSS-RUNTIME DIFF IS MECHANICAL AND IT MATCHED.** Both runtimes read ONE catalog projection
and ONE snapshot export (`_qa66/bundle.json`), wrote transcripts to files, and the two are
**138 lines, byte-identical**: `Compare-Object` returned nothing and both files hash to SHA-256
`90ab4481feef809c5f1ebec32590d9c9ca096df6441645d346232f7701101db8`. Corpus anchors proving it is the
same corpus: **204 rounds · 28 roster · 28 distinct players · `fair_seed =
1b3cd678…3279c` (frozen by the REAL `approve_match` → `advance_match` crowning, `fair_seed_frozen:
true`) · `row_count 28` · `eligible_count 0` · 12 awards curated through the REAL
`curate_award_catalog`**. `content_sha256` is `bf155b38…af69f` and differs from prior stories, which
is **correct** (`achievement_ts` is wall-clock approval time).

⚠ **THE BRACKET TOPOLOGY IS STILL A FIXTURE, AS IT WAS AT 6.2.** The corpus is a 28-player single
round and `generate_bracket` bounds the field at 8–16, so the harness drove the crowning through a
`grand_final` `gf_order = 2` row bound to the real `ziivanto-sosa` demo and published the other 13 by
the status flip — Story 6.2's own recorded recipe (`deferred-work.md:278`). The parse, the hashes,
the freeze and the capture arithmetic are all REAL; only the bracket shape is not, and that is
6.11's to close.

---

#### ▶ THE qa66 REBUILD — EVERY NUMBER ABOVE RE-DERIVED FROM SCRATCH (2026-08-07)

The review's second decision item was *"re-create the harness and re-measure"*, because the four
AC3/AC6 numbers below rested on a harness deleted by design. It was rebuilt from nothing —
`worker/cmd/qa66` (`build` / `bar`) + `lib/roulette/bar-qa66.test.ts` + `_qa66/`, all deleted again
before commit — and the corpus was re-ingested end to end. **Nothing in the matrix above moved.**

⭐⭐ **THE INVARIANT HELD.** The real-floors twelve-spin ceremony re-measured at **exactly 22 bytes**
with drawn order `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` —
character-for-character 6-4b's, 6.5's and this story's. Every one of the eight matrix rows reproduced
its byte count, cap-fired count, reduced-award count, max-swept, ladder count, shared count,
exhaustion count, max shelf and winless cardinality **exactly**. The corpus anchors reproduced too:
**204 rounds · 28 roster · 28 distinct players · `fair_seed = 1b3cd678…3279c` (frozen by the REAL
`approve_match`, `fair_seed_frozen: true`) · `row_count 28` · `eligible_count 0` · 12 awards** through
the REAL `curate_award_catalog`. `content_sha256` came out `f5a9ca6e…e94061`, which **differs** from
the first run's `bf155b38…af69f` and is **correct** — `achievement_ts` is wall-clock approval time.
Both runtimes read ONE catalog projection and ONE snapshot export; the two 702-line transcripts are
**byte-identical** — `Compare-Object` returned **0** differing lines and both hash to SHA-256
`4BB13C99B1E3C2EE2FF3652967F6AAD69DA1B9A457920BC71D767553392C982D`.

⭐ **1. THE 19 WINLESS IDS, BY NAME — STORY 6.7'S ENTIRE INPUT.** At floors-0, `live_count = 1`
(byte-lex order, the order rung 5 and Stage 2 both use). ⚠ At the **real** floors the winless set is
the whole roster, 28 of 28, because nobody wins anything — so pity's production input today is
*everyone*, and this list is the counterfactual 6.7 should design against.

```
76561198337771350  76561198388441171  76561198442864348  76561198715329473
76561198847461130  76561199094120484  76561199119068785  76561199164002328
76561199176839714  76561199194030650  76561199224717580  76561199233012783
76561199248100368  76561199250683038  76561199404795959  76561199529848048
76561199834726553  76561199837193023  76561199843959571
```

The nine holders, for completeness: **2 trophies** — `76561198403397102` (aw-04, aw-08),
`76561199121907337` (aw-09, aw-05), `76561198305828891` (aw-07, aw-02); **1 trophy** —
`76561199761222301`, `76561199115487374`, `76561198158667313`, `76561199197635748`,
`76561198841610702`, `76561198286758497`. 9 holders · 12 trophies · 19 winless = 28. ✅

⭐⭐ **2. THE 21-VS-22 BYTE DISCREPANCY IS RECONCILED, AND IT IS A HARNESS DIFFERENCE, NOT A DEFECT.**
The hypothesis was right and the harness now measures **both arms on one run**, changing exactly one
axis:

| floors-0, `live_count = 1` | bytes | drawn order |
|---|---|---|
| shelf **ADVANCES** across spins (6.6's harness) | **21** | `aw-04,aw-03,aw-01,aw-10,aw-09,aw-06,aw-05,aw-11,aw-07,aw-12,aw-08,aw-02` |
| shelf **FROZEN** at 0 (6.5's harness) | **22** | `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` |

⭐ **The mechanism is exact and arithmetic, not hand-waved.** With the shelf frozen every award weighs
`table[0] = 100`, so the per-spin totals are `1200, 1100, … 200, 100`; `uniform_int` needs `k = 2`
while the total exceeds 256 and `k = 1` below it, giving `10×2 + 2×1 = 22`. When the shelf advances,
a previous winner's next award weighs `table[1] = 40`, so by **spin 10** the remaining total is
**180** rather than 300 — under 256 — and that spin drops to **1** byte. That single spin is the
whole difference. ⭐ And the frozen-shelf floors-0 run reproduces the **real-floors drawn order
character-for-character**, which is the same fact from the other side: with every weight at
`table[0]` the two configurations are the same draw. **No code in this story moved a byte; 6.5's and
6.6's harnesses simply differed in whether the caller advanced the shelf, which neither declared.**
The anti-sweep pass draws nothing either way.

⭐ **3. AC3's THIRD MEASUREMENT — WHAT THE BIAS DOES TO THE DRAWN ORDER.** Run at floors-0 with the
shipped `[100, 40, 16, 6, 2, 1]` and again with a **flat** one-entry table `[1]`, which turns FR-26's
bias off (`validateWeightTable` accepts it — "strictly decreasing" is vacuous over one subscript —
and `weightAt` then clamps every shelf to index 0). ⚠ `0025`'s CHECK requires **≥ 2** entries, so the
flat table is engine-legal and DB-illegal: that is exactly the one-entry hole the review patch closed.

| width | shipped table — drawn order | flat table — drawn order | bytes shipped / flat |
|---|---|---|---|
| 1 | `aw-04,aw-03,aw-01,aw-10,aw-09,aw-06,aw-05,aw-11,aw-07,aw-12,aw-08,aw-02` | `aw-02,aw-12,aw-06,aw-10,aw-05,aw-09,aw-03,aw-08,aw-01,aw-07,aw-04,aw-11` | 21 / 11 |
| 2 | `aw-04,aw-07,aw-10,aw-06,aw-12,aw-08,aw-05,aw-11,aw-03,aw-01,aw-09,aw-02` | `aw-02,aw-11,aw-10,aw-04,aw-07,aw-03,aw-05,aw-08,aw-12,aw-09,aw-01,aw-06` | 22 / 11 |
| 3 | `aw-04,aw-07,aw-03,aw-06,aw-01,aw-12,aw-05,aw-09,aw-11,aw-10,aw-02,aw-08` | `aw-02,aw-11,aw-04,aw-12,aw-05,aw-06,aw-01,aw-07,aw-09,aw-08,aw-03,aw-10` | 23 / 11 |
| 4 | `aw-04,aw-07,aw-03,aw-10,aw-01,aw-06,aw-08,aw-11,aw-12,aw-09,aw-05,aw-02` | `aw-02,aw-11,aw-04,aw-07,aw-05,aw-12,aw-01,aw-10,aw-03,aw-09,aw-06,aw-08` | 11 at every width |

The bias moves the reveal order at **every** width, and the flat table costs a flat 11 bytes because
a 12-award pool of weight 1 each totals 12 (`k = 1`) and the last spin's total of 1 draws **zero**
bytes (E1). ⚠ At width 4 the flat table also changes the winless SET, 18 rather than 19 — the only
row in the whole matrix where it moves. ⛔ **The real-floors order cannot show any of this**: every
award is `no_eligible_players`, every weight is `table[0] = 100` on every spin (printed in the
transcript), so the bias is provably inert there.

⭐ **4. REACHABILITY, WITH BOTH CONFIGURATIONS LABELLED — the earlier "indices 0–3" was the
counterfactual, not the shipped config.**

| configuration | max shelf reached | entries of `[100, 40, 16, 6, 2, 1]` reachable |
|---|---|---|
| **SHIPPED (real 24/20 floors), all four widths** | **0** | index **0** only — **five of six entries unreachable** |
| floors-0 counterfactual, widths 1–2 | 2 | indices 0–2 |
| floors-0 counterfactual, widths 3–4 | 3 | indices 0–3 |

At the shipped configuration the luck meter is doubly inert: nobody is eligible, so nobody wins, so
no shelf ever leaves 0 and `weightAt` returns `table[0]` for every award of every spin. **That is not
a defect** — the table is organizer config and its tail describes a concentration this corpus cannot
produce — but "indices 0–3 are reachable" is a floors-0 statement and is now labelled as one.

⭐ **5. WIDTH 2'S SHELF DISTRIBUTION — the one gap in the eight-row matrix.** All four floors-0 widths:

| width | shelf distribution | max shelf | winless |
|---|---|---|---|
| 1 | `shelf0:19 shelf1:6 shelf2:3` | 2 | 19 |
| **2** | **`shelf0:19 shelf1:6 shelf2:3`** | **2** | **19** |
| 3 | `shelf0:19 shelf1:7 shelf2:1 shelf3:1` | 3 | 19 |
| 4 | `shelf0:19 shelf1:7 shelf2:1 shelf3:1` | 3 | 19 |

Real floors, all four widths: `shelf0:28`, max shelf 0, winless 28.

⭐ **A BONUS THE COUNTERFACTUAL SETTLED: THE CAP REDIRECTS EXACTLY ONE TROPHY ON THIS CORPUS, AND IT
IS ALWAYS THE SAME ONE.** Both cap firings (floors-0, widths 3 and 4) are `aw-09` *Justicia Ciega*
(`blind_kills`): at those widths `aw-05` and `aw-09` land in the **same** spin and both would have
gone to `76561199121907337`, so `aw-09` re-resolves to `76561198403397102`. At widths 1 and 2 those
two awards never share a spin, so nothing is redirected — which is why width 2 shows **six** reduced
candidate sets and **zero** cap firings. ⚠ **And the cap is per-SPIN, which has a consequence 6.7
should see**: at width 4 `76561198403397102` still ends with **three** trophies (aw-04, aw-08, aw-09)
because they fall in three different spins. Anti-sweep bounds concentration *within* a spin and does
nothing across spins — that is pity's job, by design.

⚠ **Two facts recorded rather than buried.** (1) The five real ties reproduced exactly, all exiting at
**rung 1**, with 6.5's recorded winners byte-identical: `aw-01 → …115487374`, `aw-03 → …761222301`,
`aw-04 → …403397102`, `aw-08 → …403397102`, `aw-11 → …841610702`; **12 single winners, 0 shared**.
Two independent harnesses over two independent ingests of the same demos now agree on all five.
(2) The rebuild left the QA corpus in the local database, which would have collided with the pgTAP
fixtures (6-4a's recorded lesson — its first attempt failed 6/25 for exactly that reason). ✅ **Cleared
the same day**: `supabase db reset` re-applied all 25 migrations from scratch onto an empty database
(`tournament` / `demo` / `stat_row` / `award` / `ceremony` / `stat_snapshot` / `spin` all verified at
**0 rows**), and the pgTAP suite was then re-run — **26 files, 1223 tests, `Result: PASS`**, matching
the review session's number exactly. The suite has now been green twice, on two independently reset
stacks, against the same patched `0025`.

---

⚠⚠ **CORRECTION (code review, 2026-08-07) — "BY CONSTRUCTION" WAS TRUE OF THE SHIPPED LADDER ONLY,
AND IT IS NOW TRUE OUTRIGHT.** AC1, DECISION E' and `0025`'s own thesis comment all claimed that a
`shared` outcome containing an already-assigned player is *structurally impossible*. That held for
every outcome the pass BUILDS — removal is applied to the candidate set before Stage 2 runs, so
`ResolveStage2` cannot return a player outside `reduced`. It did **not** hold across the injected
`Ladder` port: `spinWinners` vetted the port's returned winners only for **emptiness**, so a ladder
other than the shipped `FR29Ladder` — 6.9's browser verifier, a stub, any third party — could return
a well-formed id that was already assigned, or on no roster row at all, and one player would hold two
trophies in one spin. The guards checked weaker properties than the load-bearing one, and
`TestResolveSpinNeverAwardsOnePlayerTwiceInOneSpin` ran only over `FR29Ladder`.

**Closed both ways, per Cuatro's call (option c):** every winner is now checked for membership in
`reduced` — one test that carries both facts, since `reduced` is exactly `players` minus `assigned` —
before anything enters the assigned set, in **both** languages, under detail `internal`; a `shared`
outcome listing the same player twice is refused for the same reason (`assigned` is a map/Set and
would dedupe it silently, so the violation would surface only at 6.8 as two `award_result_winner`
rows); TypeScript additionally gained the **omitted-field** shapes Go got free from its zero values
(`undefined === ''` is false, so `{kind:'winner'}` with no id used to pass, and `{kind:'shared'}` with
no `winners` threw a bare `TypeError` outside the closed detail set). Five new stub-port rows drive
them in each suite. The DB `UNIQUE(spin_id, winner_entry_id)` remains the **second** line; this is now
genuinely the first.

**DECISION D AND E' ARE THE TWO PRODUCT CALLS THIS STORY MADE.** Neither `SOLUTION-DESIGN:426-427`
nor `SPINE:220` says whether an overflow re-resolves by a full Stage-2 re-run or by popping the
removed winner, so it is decided here (a **full re-run**), written at both implementation sites, and
pinned by three rows whose properties are each independently sufficient: rung 3 is defined over the
REMAINING set, `best` is a SET whose membership the removal changes, and DECISION E's zero carve-out
is evaluated against the reduced set's best value. **E'** is its companion — removal is applied to
the CANDIDATE SET before Stage 2 runs, never to an `Outcome` afterwards — which makes
`review-data-integrity.md:175-179`'s hazard structurally impossible rather than defensively handled.

**MIGRATION 0025 LANDED, AND ITS OWN pgTAP SUITE FOUND A REAL DEFECT IN IT.** The first draft's
`luck_weight_table_valid` was a chain of `and`s over `array_ndims` / `array_length`, both of which
return **NULL** for `array[]::int[]` — so the whole conjunction was NULL, and a CHECK whose
expression is NULL is **satisfied**. The one shape most obviously fatal to FR-26 (no index 0 to give
the empty shelf) was the one shape the guard let through, and it looked completely correct. Fixed as
a total `case` plus an `is true` wrapper on the constraint, so a future NULL-propagating edit fails
closed rather than open. Also in `0025`: `unique (spin_id, winner_entry_id)` (M1.2), the COMPOSITE
FK to `award_result (id, spin_id)` that makes a disagreeing denormalized `spin_id` unrepresentable
(M1's FK-consistency ask, declaratively rather than by trigger), a DEFERRED constraint trigger
asserting `is_shared = (winner count > 1)` from both tables under new SQLSTATE **IC909** (M1.1), and
the delete-prior-on-rerun contract stated in the table comment — which the suite exercises as a round
trip rather than quoting.

⚠ **CORRECTION (code review, 2026-08-07): "all thirteen cases" below is wrong — it was FOURTEEN.**
The vector shipped 16 cases and this paragraph says the mutation pass added 2 of them, so the count
before those two was 14, not 13. The reasoning and both fixes are unaffected; the arithmetic was the
only number in the mutation account checkable against the tree, and it did not check out.

**⭐⭐ THE MUTATION PASS FOUND TWO REAL VECTOR HOLES, AND THE VECTOR WAS FIXED — NOT THE TESTS.** The
first run was **33 KILLED / 5 SURVIVED / 1 NOT-APPLIED**. Three of those five were one defect each:

1. **`swept_out` returned UNSORTED survived** — every roster in the file was declared already in
   byte-lex order, so the sort was an identity on all thirteen cases and deleting it was
   byte-identical. Closed by a new row, `the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING`,
   which is the cascade spin over the same roster supplied in REVERSE and whose expected block must
   be byte-identical to the cascade's (the anchor asserts that identity, and asserts the two rows
   genuinely differ in supplied order so the identity is not a row compared with itself).
2. **Re-applying an eligibility filter inside the pass survived** — every fixture gave all players
   20 kills and 30 rounds, so a pass that quietly filtered its candidate set on any plausible
   predicate produced identical output. Closed by a new row,
   `a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY`, where the winner of award 1 has **zero
   kills** and wins outright on `knife_kills` at floors 0/0 — which is exactly the shape Story 6.1
   measured for the weird-stat awards.
3. **One NOT-APPLIED** was a harness defect, not a dead mutant: the anchor `if len(table) == 0 {`
   matched twice in `stage1.go`. Re-anchored and re-run.

The re-run is **39 applications: 37 KILLED / 2 SURVIVED / 0 NOT-APPLIED**, control pass green in both
languages, restoration verified by SHA-256 on all four mutated files.

⚠⚠ **CORRECTION (code review, 2026-08-07) — THE EQUIVALENT-MUTANT PROOF'S PREMISE WAS FALSE, AND THE
WHOLE `2 SURVIVED` LINE RESTED ON IT.** The argument as published was: *"the ladder reads `byID[sid]`
only for `sid` in its survivors, survivors ⊆ tied, and `tied` came out of `ResolveStage2(award,
reduced)` — so tied ⊆ reduced ⊆ players and both calls index the same entries."* That premise is
**not true**: [`validateLadder` (`ladder.go:782-790`)](worker/awards/ladder.go#L782) iterates **every
row of `players`** to build the index and refuses on any duplicate `steamid64` it finds there. So a
duplicate row belonging to an already-assigned player is **visible** to the ladder when it is handed
`players` and **invisible** when it is handed `reduced` — the two arguments are not interchangeable
as a matter of what the ladder reads.

⭐ **The conclusion survives, via a step the argument never made:** `eligiblePlayers`
(`stage2.go:684-694`) scans the WHOLE roster for duplicates before it filters, and it runs inside the
`ResolveStage2(award, reduced)` call on the **first** award — whose candidate set is the unreduced
roster, because `assigned` is still empty. Any duplicate therefore refuses at award 1 and no input
carrying one ever reaches the ladder call. Given a duplicate-free roster, tied ⊆ reduced ⊆ players
and both calls index the same entries. **Equivalent on every input that can get there, and only on
those.** The corrected reasoning now sits at both implementation sites; the code still passes
`reduced`, and L12 is why. ⚠ The lesson: an equivalent-mutant declaration is evidence-by-argument
rather than evidence-by-test, so the argument itself has to be reviewed as carefully as a test would
be — this one asserted a property of a callee that the callee does not have.

⚠ **AND THE 39 RECONCILED AGAINST TASK 8's LIST OF 18** (asked for at code review, because an
aggregate with no per-mutation table is exactly what went wrong in five prior stories). Of the 18
named mutation kinds × 2 languages = 36, **two kinds have no expressible site in the shipped design,
and that is the design being correct rather than a gap**: *"the assigned set carried ACROSS spins"* —
`ResolveSpin` / `resolveSpin` handle ONE spin and `assigned` is a function-local map/Set, so there is
no cross-spin state to corrupt without first inventing a package-level variable; and *"the shelf
mutated (A10)"* — neither entry point takes a shelf parameter at all, which is precisely what A10
asserts. That leaves 16 kinds × 2 = 32 language-paired applications, plus the 7 single-site
applications against `generate_vectors.py` and the two `stage1.*` clamp sites (the weight-table
low-side clamp and the shelf-0 → `table[len-1]` inversion, which have one site per implementation
rather than a Go/TS pair) = **39**. That is the mapping; it is recorded here so `0 NOT-APPLIED` is
auditable rather than asserted.

⚠ **THE CONTROL PASS EARNED ITS PLACE ON THE FIRST RUN.** It came back RED for a reason that had
nothing to do with the source: the runner's `cwd` used a lowercase drive letter, Vitest's `include`
globs then failed to match `lib/roulette/*.test.ts`, and the files were collected as NON-test modules
with `Cannot read properties of undefined (reading 'config')`. Without the control pass that would
have been reported as "every TypeScript mutation killed".

**BOTH INHERITED `deferred-work.md` ITEMS ARE CLOSED.** `:308` (a negative shelf index panics in Go,
yields `undefined as number` in TypeScript and indexes from the END in Python — three behaviours,
one contract) is closed by `weightAt` / `_weight_at`, a single indexing site guarded on BOTH sides
that REFUSES rather than silently clamping to `table[0]`, in all three implementations, with a typed
`shelf` / `weight_table` detail and a positive control in each suite. Neither arm is
row-representable (both are refused by a guard that runs first), and that is **declared** rather than
faked. `:317` (the "clamp AFTER the minimum" comment asserting a distinction with no observable
difference) is closed by making the question unaskable: with exactly one clamp at exactly one site,
the ordering is not a rule anybody can violate, and the comment now says so instead of pretending to
pin an invariant.

**A2's "CONFIRM, DO NOT ASSUME" IS CONFIRMED**: `award.priority` is `UNIQUE (tournament_id, priority)`
at `0023:150` (`award_tournament_priority_key`, DEFERRABLE), read in the migration rather than taken
on trust — and the pass refuses a duplicate priority in the live set anyway rather than relying on a
stable sort, with its own refusal row.

**THE GREENFIELD CLAIM WAS RE-CONFIRMED, NOT ASSUMED**: nothing named `assigned_this_spin`,
`assignedThisSpin`, `assigned`, `sweep`, `antiSweep`, `overflow` (as a business concept) or `pity`
existed in `worker/awards/` or `lib/roulette/` before this story — only 6.3's `PityLabel` and the
forward-references 6-4a/6-4b/6.5 wrote **to** this story by name.

**GATES.** Baselines measured BEFORE any change: lint 0 · Vitest **1202 / 41** · Go `awards` **517**
· `gofmt -l ./worker` empty · `--check` OK ×5 · pgTAP **1155 / 25**. After:

| Gate | Result |
|---|---|
| `npm run lint` | **0** |
| `npm test` | **1302 / 42** (+100 tests, +1 file) |
| `npm run build` | **0**, every viewer route still `ƒ` dynamic, **no `roulette` route** |
| `go build ./... && go vet ./... && go test ./... -count=1` | clean; `awards` **602** (+85) |
| `gofmt -l ./worker` | **empty** |
| `python roulette/vectors/generate_vectors.py --check` | **OK ×6**; the five pre-existing files **byte-identical**, proven by `git status` showing only `generate_vectors.py` modified under `roulette/` |
| pgTAP (`supabase db reset` first) | **1218 / 26** (+63, +1 file) |
| scope | all ten excluded paths **byte-untouched** (`git status --porcelain` over `app/`, `lib/awards|ceremony|i18n|bracket|steam/`, `worker/ingest|store|db|config/` returns nothing); the only `supabase/**` change is `0025` + its pgTAP file |
| CRLF | **0** across all 18 touched files — two picked up CRLF from a PowerShell write and were normalised, which is 6-4a's exact round-trip hazard caught before commit |

⚠ **WHAT THIS STORY DID NOT BUILD, AND WHO OWNS IT.** Nothing writes a row to `spin`,
`award_result` or `award_result_winner` — they land empty, by DECISION A, and 6.8 supplies the writer,
the reveal-gated RLS axis and the grant together. No pity draw (6.7 reads the winless set above by
name). No canonicalization and no `luck` bundle key (6.9 — ⚠ and the three-names collision is
RECORDED and left alone: the column is `ceremony.luck_weight_table`, the spine says
`luck.weight_table`, the bundle key is `luck`, and the key is outcome-affecting for
`bundle_sha256`). No UI, no i18n string, no route — `/ceremonia` is still 5.7's `<Placeholder>`. The
end-to-end ceremony vector with an anti-sweep overflow is 6.11's; this is the **unit** vector for the
pass.

### File List

| File | Change |
|---|---|
| `worker/awards/sweep.go` | NEW — the pure ascending-priority pass, `ErrSweep` + `SweepInvalidError`, four closed-set details, zero stream |
| `worker/awards/sweep_test.go` | NEW — vector-driven + local rows; case-name set pinned; the `internal` port guards driven by a stub |
| `worker/awards/stage1.go` | UPDATE — `weightAt`'s two-sided guard (`deferred-work.md:308`) + the rewritten W8 clamp comment (`:317`) |
| `worker/awards/stage1_test.go` | UPDATE — shelf-0-is-heaviest / monotonicity over three tables, and both `weightAt` arms with a positive control |
| `worker/awards/prng_test.go` | UPDATE — shipped file set → 6. ⛔ the `math/big` `exceptIn` list was **NOT** widened |
| `lib/roulette/sweep.ts` | NEW — the mirror; SYNCHRONOUS; not `server-only`; no `./prng` import |
| `lib/roulette/sweep.test.ts` | NEW — vector-driven, per-row `detail` assertions from the start, stub-port `internal` rows |
| `lib/roulette/stage1.ts` | UPDATE — the mirror `weightAt` + the rewritten comment |
| `lib/roulette/stage1.test.ts` | UPDATE — the mirror guards |
| `lib/roulette/prng.test.ts` | UPDATE — module list → 6, import graph gains `sweep.ts` (⭐ **without** `./prng`), non-vacuity pin |
| `roulette/vectors/antisweep-resolve.json` | NEW — 16 cases / 10 refusals (2 of them doubly malformed) |
| `roulette/vectors/generate_vectors.py` | UPDATE — `resolve_spin` + `build_antisweep_file` + one line in `main()`'s `outputs`; `_weight_at`; `OUTCOME_KINDS` hoisted to one definition site; the FR-26 bias asserted in the anchor too |
| `roulette/vectors/README.md` | UPDATE — ownership row, format section, the cases-that-carry-the-weight table, DECISIONS D/E'/G, the anchoring note |
| `supabase/migrations/0025_ceremony_results.sql` | NEW — `spin` + `award_result` + `award_result_winner` + `unique (spin_id, winner_entry_id)` + the composite FK + the `is_shared` trigger (IC909) + the `luck_weight_table` default, CHECK and backfill |
| `supabase/tests/0025_ceremony_results_test.sql` | NEW — pgTAP `plan(63)`: the constraint bites, cross-spin is permitted, `spin_id` cannot disagree, `is_shared` cannot drift, the weight table's shape |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE — the two items homed to this story (`:308` the negative shelf index, `:317` the "clamp AFTER the minimum" comment) marked ✅ CLOSED BY STORY 6.6 with how each was closed |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE |
| `_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md` | UPDATE — this record |

### Change Log

| Date | Change |
|---|---|
| 2026-08-05 | Story contexted (bmad-create-story) → ready-for-dev. Baseline `4c9cf36` (6.5 implemented, its review debt carved into 6-5b). |
| 2026-08-07 | Implemented → review. All four Questions answered with the recommendation before the vector was fixed. Anchor first (`generate_vectors.py`), then the vector, then Go, then TypeScript. Migration `0025` taken (DECISION A). THE BAR: 138-line transcript byte-identical across both runtimes, SHA-256 `90ab4481…1db8`; the 22-byte / drawn-order invariant unmoved; the cap measured firing **zero** times at `live_count = 1`. Mutation: 39 applications, **37 KILLED / 2 SURVIVED / 0 NOT-APPLIED** after two real vector holes were closed **in the vector**; the two survivors are proven equivalent. Gates: lint 0 · Vitest 1302/42 · build 0 · Go clean (`awards` 602) · gofmt empty · `--check` OK ×6 with five files byte-identical · pgTAP 1218/26 · scope byte-untouched. |
| 2026-08-07 | Independent re-verification of the completion record against the working tree, in a fresh session. Re-ran and REPRODUCED: lint **0** · Vitest **1302 / 42** · `npm run build` **0** (every viewer route still `ƒ`, no `roulette` route) · `go build`/`go vet`/`go test ./... -count=1` clean with `awards` **602** · `gofmt -l ./worker` **empty** · `generate_vectors.py --check` **OK ×6**. One real gap found and fixed: `deferred-work.md` was modified by this story (the `:308` / `:317` closures) but was **missing from the File List** — now listed. ⚠ pgTAP was **not** re-run this session (it needs `supabase db reset` against the local stack); its 1218/26 stands on the implementation session's record alone. |
| 2026-08-07 | **Code review** (bmad-code-review, three parallel adversarial layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor). Gates re-run independently and all reproduced (see the table above). **4 decision-needed · 21 patch · 10 defer · 3 dismissed.** Findings below. |
| 2026-08-07 | **Review patches APPLIED** — all 21 patch findings plus the three code-side decisions, in the story's own anchor-first order. Headline: the injected `Ladder` port could violate the one-trophy cap and AC1 claimed it could not "by construction" — now guarded in both runtimes with 5 new stub rows each, and the claim scoped to what it covers. Also: the equivalent-mutant proof's premise was **false** (the ladder scans the whole roster) and is rewritten with the reason that holds; a third doubly-malformed vector row pins the previously-unobservable `stage2`→`ladder` boundary; the `is_shared` trigger now re-checks the SOURCE parent on a move. Gates: lint **0** · Vitest **1318/42** (+16) · build **0** · Go `awards` **607** (+5) · gofmt empty · `--check` **OK ×6** with five byte-identical · scope untouched · **0 CRLF in every committed blob**. ⛔ pgTAP NOT re-run and the qa66 re-measurement NOT done — Docker's engine service needs elevation. AC3/AC6 stay PARTIAL. |
| 2026-08-07 | ✅ **qa66 REBUILT AND THE RE-MEASUREMENT RUN — the last outstanding item, discharged; Status → `done`.** The throwaway harness (`worker/cmd/qa66` `build`/`bar` + `lib/roulette/bar-qa66.test.ts` + `_qa66/`) was recreated from nothing and the corpus re-ingested end to end through the REAL parser / `RecordParse` / `declare_match_format` / `bind_match_demo` / `approve_match` crowning / `curate_award_catalog` / `lock_ceremony`. ⛔ **The invariant did not move: 22 bytes, drawn order character-for-character**, and **every one of the eight matrix rows reproduced exactly**, so the matrix is now re-derived rather than recorded. All five deliverables printed: the **19 winless ids by name** (6.7's input); the **21-vs-22 discrepancy reconciled as an undeclared harness difference** (shelf advancing 21 / frozen 22, with the spin-10 `k=2 → k=1` arithmetic); the **bias-vs-flat drawn order at all four widths**; **reachability labelled per configuration** (index 0 only at the shipped floors); and **width 2's shelf distribution**. Bonus from the counterfactual: the cap redirects exactly **one** trophy on this corpus (`aw-09`, widths 3–4 only) and is per-SPIN, so a player still holds three at width 4. Transcripts **byte-identical** across runtimes (`Compare-Object` 0 lines, SHA-256 `4BB13C99…392C982D`). Harness **deleted**, with the Go gates proven clean while present *and* after removal (build 0 · vet 0 · `awards` **607** · gofmt empty, identical both times) and Vitest back to **1318/42**. `qa54` untouched. **AC3 and AC6 → MET.** ✅ The stack was then put back: `supabase db reset` (25 migrations from scratch, every corpus table verified at 0 rows) followed by a full pgTAP re-run — **26 files / 1223 tests / `Result: PASS`**, reproducing the review session's number on an independently reset stack. **Nothing outstanding, nothing left dirty.** |

### Review Findings — Code Review (2026-08-07)

Three blind, parallel layers over the full diff (5,679 reviewed lines + the 10,989-line generated
vector, interrogated structurally). Gates re-run independently by the reviewer and **all reproduced**:
lint 0 · Vitest 1302/42 · build 0 · Go `awards` 602 PASS / 0 FAIL · `gofmt` empty · `--check` OK ×6
with the five pre-existing vector files byte-identical · all ten excluded scope paths untouched.
pgTAP was **not** re-run (needs `supabase db reset`), so 1218/26 remains unverified.

⭐ **Two layers converged independently on five findings** (the TS refusal gate, the unasserted
`exit_steps`, the validation-order prefix, `weightAt`'s `NaN` arm, and the injected-port guards),
which is the strongest signal in the set.

#### Decision needed — ALL FOUR RESOLVED BY CUATRO, 2026-08-07 (each with the recommendation)

- [ ] **[Review][Decision] The injected `Ladder` port can violate the one-trophy cap, and AC1 claims it cannot "by construction".** `spinWinners` checks the port's returned winner only for **emptiness** — never for membership in `reduced`, nor for absence from `assigned` ([sweep.go:356-381](worker/awards/sweep.go#L356), [sweep.ts:348-376](lib/roulette/sweep.ts#L348)). A `Ladder` other than the shipped `FR29Ladder` — 6.9's verifier, a stub, any third party — can return an already-assigned player and one player holds two trophies in one spin, the single invariant this story exists to guarantee; at 6.8 that becomes the `unique (spin_id, winner_entry_id)` 23505 the migration says "MUST NEVER FIRE". The stub tables drive wrong-kind / empty-winners / empty-id and never a **non-member** winner, and `TestResolveSpinNeverAwardsOnePlayerTwiceInOneSpin` runs only over `FR29Ladder`. **Options:** (a) add the membership guard in both languages plus a stub row; (b) declare the port trusted and soften AC1 / DECISION E' / the migration's "impossible by construction" comment to "for the shipped ladder"; (c) both. → ⭐ **CUATRO'S CALL: (c) BOTH.** Add the membership guard in both languages plus a stub row that drives it, **and** reword AC1 / DECISION E' / the migration comment so the by-construction guarantee is scoped to the candidate-set path with the port guarded explicitly. Closes the hole and makes the record true.
- [x] ✅ **DISCHARGED 2026-08-07 — the harness was rebuilt and all four were measured.** See the Completion Notes' *"▶ THE qa66 REBUILD"* block: the 19 winless ids are printed by name, the 21-vs-22 discrepancy is reconciled as an **undeclared harness difference** (shelf advancing vs frozen — printed both ways on one run, with the spin-10 arithmetic that produces it), the bias-vs-flat drawn order is printed at all four widths, and reachability is labelled per configuration (**index 0 only** at the shipped floors; 0–3 in the floors-0 counterfactual). Width 2's shelf distribution is `shelf0:19 shelf1:6 shelf2:3`. ⛔ **The 22-byte invariant and the drawn order did not move.** **[Review][Decision] Four AC3/AC6 measurements cannot be re-derived — the `qa66` harness was deleted.** (i) The floors-0 `live_count = 1` row records **21 bytes**, but 6.5 recorded the same configuration completing *"all 12 spins at exactly 22 bytes"* ([6-5:566-567](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L566)) — unreconciled, and the anti-sweep pass draws nothing, so no code in this story explains it (most likely an undeclared harness difference: 6.6 advances the shelf across spins, which changes Stage-1 weights and therefore the draws). (ii) The winless **19 ids** — *"pity's entire input"*, which Task 7 says to hand to 6.7 **by name** — exist only in the deleted `_qa66/` transcript; only the cardinality survives. (iii) AC3's third named measurement, *"what does the bias do to the drawn order?"*, is never printed for any floors-0 width. (iv) Reachability is stated as indices **0–3** without noting that is the floors-0 counterfactual; at the shipped config the matrix's own `max shelf 0` means only index **0** is reachable. Also: width 2's shelf distribution is omitted. **Options:** re-create the harness and re-measure, or accept and record the gap explicitly. → ⭐ **CUATRO'S CALL: RE-CREATE THE HARNESS AND RE-MEASURE.** Print all four missing numbers, reconcile the 21-vs-22 byte discrepancy against 6.5's record, and capture the **19 winless ids** by name — 6.7 is blocked on that set either way. Same throwaway convention as before (`worker/cmd/qa66` + `lib/roulette/bar-qa66.test.ts` + `_qa66/`, all deleted before commit, gates proven clean while present *and* after removal).
- [ ] **[Review][Decision] `tie_ladder_exit_step` CHECK rejects `0`, the engine's own "no ladder ran" value.** [0025:157](supabase/migrations/0025_ceremony_results.sql#L157) is `check (tie_ladder_exit_step is null or tie_ladder_exit_step between 1 and 5)`, while both runtimes carry `LadderExitNone = 0` and 30 of the vector's 36 result rows have `"ladder_exit_step": 0`. The column comment says NULL means "no ladder was involved", so the mapping is *implied* but the required `0 → NULL` writer contract is stated nowhere, and this is a **fourth** spelling of "no rung" in a repo that already flags the three-spelling asymmetry (`deferred-work.md:307`). **Options:** (a) state the `0 → NULL` contract explicitly for 6.8; (b) widen the CHECK to `between 0 and 5`; (c) leave it to 6.8. → ⭐ **CUATRO'S CALL: (a) STATE THE `0 → NULL` CONTRACT.** NULL stays the SQL spelling of "no rung" — the schema is right — and the required mapping goes into the column comment explicitly so 6.8's writer cannot miss it. **No schema change.**
- [ ] **[Review][Decision] The mutation record is aggregate-only, and `0 NOT-APPLIED` is unauditable.** Completion Notes give three counts (37 KILLED / 2 SURVIVED / 0 NOT-APPLIED) and no per-mutation table — the first story in the epic not to publish one, in a story whose own Task 8 preamble lists five prior runs whose *aggregate* numbers were optimistic (6-4a: 12 of 18 silently NOT-APPLIED). Two of Task 8's 18 named mutations have no expressible site in the shipped design (*"the assigned set carried across spins"* — `assigned` is a function-local map; *"the shelf mutated"* — the pass has no shelf parameter, which is A10's point), so 18 × 2 = 36 does not reconcile with 39 applications. **Options:** publish the per-mutation table (needs the harness), or record why the aggregate stands and which two mutations were structurally inapplicable. → ⭐ **CUATRO'S CALL: RECORD THE RECONCILIATION, NO RE-RUN.** Write down which two of Task 8's 18 mutations were structurally inapplicable and why — no cross-spin state to corrupt (`assigned` is a function-local map) and no shelf parameter to mutate (A10 is exactly that) — and how the 39 applications map to the list. Makes the aggregate auditable without rebuilding the mutation harness.

#### Patch

- [ ] [Review][Patch] TS refusal gate has no `ladder` arm and no exhaustiveness default; Go has `default: t.Fatalf` [lib/roulette/sweep.test.ts:425-427] — the vector's single `ladder` row never has its propagated `cause` asserted, and a fifth `detail` would pass silently on TS while failing loudly on Go
- [ ] [Review][Patch] `exit_steps`, `algo_version` and `spec` are declared in both suites and asserted by neither [worker/awards/sweep_test.go:78, lib/roulette/sweep.test.ts:99] — `exit_steps` declares `[0,1,2,3,4,5]`; only `{0, 4, 5}` occur in any row. Contrast `ladder_test.go:438-443`, which does pin it by exact equality
- [ ] [Review][Patch] TS asserts only the **presence** of `deciding_value`, never its magnitude; Go compares class and `big.Int.Cmp` [lib/roulette/sweep.test.ts] — a TS implementation returning the right winner with a fabricated deciding value passes every shared row, and that number is what 6.8 renders on stage as the reason the winner won
- [ ] [Review][Patch] Four pinned case names get no guard-the-guard, including **both** rows the mutation pass added [worker/awards/sweep_test.go, lib/roulette/sweep.test.ts] — `the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING`, `a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY`, `TWO-DIFFERENT-players-are-swept-out-of-TWO-DIFFERENT-awards`, `a-SINGLE-OVERFLOW-…`. Both rows are non-degenerate today (roster `033,022,011`; kills `0,20,20`) but nothing re-derives it, so a regeneration could silently degrade them. This is the coverage-guard defect at its **fourth** occurrence
- [ ] [Review][Patch] `assert_award_result_is_shared` checks only `NEW.award_result_id` on UPDATE [supabase/migrations/0025_ceremony_results.sql:256] — moving a co-winner row to another parent leaves the **source** parent with `is_shared = true` and one winner. IC909 never fires; this is the M1(1) drift the trigger exists to close. Check both `OLD` and `NEW` when they differ, and add a move-a-winner pgTAP case
- [ ] [Review][Patch] Both doubly-malformed refusal rows pin the **same** `live`→`stage2` boundary, so the `stage2`→`ladder` order is unobservable [roulette/vectors/antisweep-resolve.json] — and the guard's own message claims "one row per adjacent boundary it claims to pin" while the code checks `doubles >= 2`. Add a `stage2`+`ladder` row, or make the guard assert distinct boundary pairs
- [ ] [Review][Patch] TS validates the roster **before** the live set, contradicting the `spec` string it publishes [lib/roulette/sweep.ts:224-227] — `resolveSpin([], null, ladder)` throws `stage2`; the published order says the live set is validated first, in full. Move the `Array.isArray` guard below `validateLive`
- [ ] [Review][Patch] `players: null` resolves in Go and Python and refuses in TypeScript, and the comment claims it is not expressible [lib/roulette/sweep.ts:219-227] — `"players": null` is plainly a JSON input; Go decodes a nil slice and Python maps `None → []`, both of which resolve. Either make it row-representable and vector it, or correct the claim
- [ ] [Review][Patch] The equivalent-mutant proof's premise is **false** [worker/awards/sweep.go:281-292 + the `sweep.ts` mirror] — it says the ladder reads `byID[sid]` *"only for `sid` in its SURVIVORS"*, but [ladder.go:782-790](worker/awards/ladder.go#L782) iterates **every row of `players`** and refuses on any duplicate found there, so `players` and `reduced` are not interchangeable as a matter of what the ladder reads. The conclusion likely still holds — via `eligiblePlayers`' whole-roster duplicate scan refusing at the first award — but that step is never made, and the mutation matrix's `2 SURVIVED` rests entirely on this argument
- [ ] [Review][Patch] *"`OUTCOME_KINDS` is pinned … in two other vector files"* is false — there is exactly **one** other [worker/awards/sweep.go:145, lib/roulette/sweep.ts:128, generate_vectors.py:5944 and :6587, roulette/vectors/README.md:657] — only `stage2-resolve.json` carries `outcome_kinds`. `:6587` is the exhaustion case's `note`, so the false claim ships **as data inside `antisweep-resolve.json`** and fixing it requires regenerating the vector. DECISION F's "cross-cutting change across four artifacts" is inflated by one
- [ ] [Review][Patch] *"all thirteen cases"* does not reconcile — the vector ships **16** cases and the same paragraph says the mutation pass added **2**, so the pre-mutation count was **14** [Completion Notes, the mutation account]
- [ ] [Review][Patch] TS port guards miss the omitted-field shape they exist for [lib/roulette/sweep.ts:355, :364] — `{kind:'winner'}` with no `steamid64`: `undefined === ''` is false, so `[undefined]` enters `assigned`; `{kind:'shared'}` with no `winners`: `.length` throws a raw `TypeError`, not a `SweepError`, bypassing the closed `detail` set entirely. Go's zero values make omitted and empty the same input, so the Go stub table (`Winners` omitted) and the TS one (`winners: []`) only *look* like mirrors
- [ ] [Review][Patch] A `shared` outcome with **duplicate** winners passes both guards [worker/awards/sweep.go:375, lib/roulette/sweep.ts:370] — only `sid == ""` is rejected. `assigned` dedupes, but `Outcome.Winners` keeps both and 6.8 writes two `award_result_winner` rows for one player. `eligiblePlayers` has exactly this duplicate guard at `stage2.go:684-694`
- [ ] [Review][Patch] `weightAt` returns `undefined as number` for a `NaN` or fractional index [lib/roulette/stage1.ts:760-778] — `NaN < 0` and `NaN > tableMax` are both false. **Unreachable** through `stage1Weights`/`stage1Pick` (`validateShelf` uses `Number.isInteger`, [stage1.ts:802](lib/roulette/stage1.ts#L802)), so this is a defensive gap on an exported function — but the negative arm was guarded for exactly the "silently plausible, differently wrong per language" reason that applies equally here, and Go's `int` parameter makes the split TS-only
- [ ] [Review][Patch] `has_check('public', 'ceremony', …)` cannot fail [supabase/tests/0025_ceremony_results_test.sql:459] — it asserts the table has *at least one* CHECK, and `ceremony` is a pre-existing 0024 table. Dropping `ceremony_luck_weight_table_valid` entirely leaves it green. Delete it or name the constraint
- [ ] [Review][Patch] Two `23503` delete tests assert no constraint name, violating the file's own header rule [supabase/tests/0025_ceremony_results_test.sql:428-435] — the header says *"Every negative test below asserts the CONSTRAINT NAME in the message"*, and the composite-FK test at `:286-288` does. These two pass `null`, so a `23503` from any other FK satisfies them
- [ ] [Review][Patch] Section E's "positive control" writes nothing and can therefore fire no trigger events [supabase/tests/0025_ceremony_results_test.sql] — `set constraints all deferred; set constraints all immediate;` in a `do` block fires *pending* events; a constraint trigger does not re-validate existing rows. If the queue is empty it passes having asserted nothing, which defeats the one control that exists to prove the trigger is not refusing everything
- [ ] [Review][Patch] `limit 1` without `ORDER BY` after a second ceremony row is inserted [supabase/tests/0025_ceremony_results_test.sql, Section G] — by then the table holds the backfilled T6 row and the DEFAULT-populated T7 row, so the assertion titled *"the backfilled value is the shipped table"* may be reading the DEFAULT row. It passes only because both mechanisms write the same six integers, i.e. it cannot distinguish the two things it asserts. Same for the `f` view's `(select id from ceremony limit 1)`
- [ ] [Review][Patch] `SweptOut[0]` is indexed after a **non-fatal** `Errorf` [worker/awards/sweep_test.go:3410-3428] — nothing asserts `len(SweptOut) > 0` in between, so a vector edit that empties it turns a clean failure into an index-out-of-range panic that takes down the package binary
- [ ] [Review][Patch] `validateLive` drops `validatePool`'s "every candidate must be an object" arm while claiming to mirror it clause for clause [lib/roulette/sweep.ts:420-458, worker/awards/sweep.go:404] — a `null` element makes TS report the misleading `award_id must be a non-empty string`, and Python's `_validate_live` raises an **uncaught `AttributeError`** instead of a `SweepRefusal`, so the anchor crashes where the runtimes refuse
- [ ] [Review][Patch] A one-entry weight table is accepted everywhere and makes FR-26's bias inert [supabase/migrations/0025_ceremony_results.sql:351-361, generate_vectors.py, lib/roulette/stage1.test.ts] — `array[100]` satisfies the strictly-decreasing predicate **vacuously** (only one subscript), all three `validateWeightTable`s accept it, and `weightAt` then clamps every shelf to index 0. The new monotonicity properties would catch it but are only driven with `[100,40,16,6,2,1]`, `[9,4,1]`, `[2,1]`. Related untested CHECK branches: `array_ndims <> 1` (a 2-D array is **accepted** if that branch is removed), `array_lower <> 1`, and the `v is null` half of the element check

#### Deferred

- [x] [Review][Defer] `assert_award_result_is_shared` is `security invoker` under `FORCE ROW LEVEL SECURITY` with zero policies [supabase/migrations/0025_ceremony_results.sql:243-245] — deferred to **6.8**, which adds the grant and the reveal-gated policy together
- [x] [Review][Defer] `award_result_winner_result_key` is subsumed by `unique (spin_id, winner_entry_id)` and can never be the constraint that refuses [supabase/migrations/0025_ceremony_results.sql:230] — deferred, cosmetic; the four `has_index` calls also never assert the indexes are UNIQUE
- [x] [Review][Defer] TS `.sort()` is UTF-16 code-unit order, not byte-lex, and the comment states the equivalence as a definition [lib/roulette/sweep.ts:~4047] — deferred, latent; steamid64s are ASCII digits so nothing diverges today
- [x] [Review][Defer] `lib/roulette/prng.test.ts > real-seed/spin1/i255` times out at 5000 ms under full-suite load, passing in 3.28 s alone — deferred, **pre-existing** (a PRNG conformance test over a byte-identical vector), but it means `npm test` is not reliably green on this machine
- [x] [Review][Defer] `0025` re-uses DECISION letters A–D with meanings different from the story's DECISIONS A–D [supabase/migrations/0025_ceremony_results.sql] — deferred, documentation coherence; `0025`'s "DECISION C" is `is_shared`, the story's is the FR-21 floors
- [x] [Review][Defer] `array_length(t, 1) < 1` is unreachable in `luck_weight_table_valid` [supabase/migrations/0025_ceremony_results.sql:~384] — deferred; every empty array is already rejected by the `array_ndims` branch, but the pgTAP suite credits it with a refusal it does not perform
- [x] [Review][Defer] No vector case carries an empty or single-player roster [roulette/vectors/antisweep-resolve.json] — deferred; player counts are `3` ×14 and `2` ×1, so "an absent container is the empty container" is never resolved through the shared seam
- [x] [Review][Defer] `TestResolveSpinDoesNotMutateItsInputs` verifies **reordering** only, not mutation of row contents [worker/awards/sweep_test.go:3703-3739] — deferred; a pass that rewrote `players[i].Volume` in place passes both suites
- [x] [Review][Defer] `pg_get_expr` string-pins a deparsed expression eight lines after the file argues against string pins [supabase/tests/0025_ceremony_results_test.sql:461-465] — deferred; the rendered form depends on `search_path` and server version
- [x] [Review][Defer] Task 2's mandatory row *"a spin where the **highest-priority** award is the one that overflows"* is unsatisfiable as written — deferred, record-keeping only; higher priority is the **lower** number, so that award is processed first with `assigned` empty and can never overflow. The shipped `the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy` is the correct substitute, ticked without noting the substitution

#### Review patches — APPLIED 2026-08-07

All 21 `patch` findings plus the three code-side decisions were applied in the story's own build
order: **anchor first**, then the vector, then Go, then TypeScript, then the migration, then pgTAP.

| Area | What changed |
|---|---|
| `generate_vectors.py` (anchor) | `_validate_live` gained `_validate_pool`'s missing "must be a mapping" arm (it raised a bare `AttributeError` on a `null` element — the anchor crashed where both runtimes refuse) · a **third doubly-malformed refusal row** pinning `stage2`→`ladder` · the `doubly_malformed >= 2` COUNT guard replaced by a **boundary-PAIR** guard that requires a row per adjacent boundary · the "two other vector files" claim corrected to one, including the copy shipped as a `note` inside the JSON · an explicit assertion that a one-entry table passes the SHAPE validator and fails the BIAS assertion, so the engine/DB split is a stated rule |
| `antisweep-resolve.json` | regenerated: **16 cases / 11 refusals**, `live` ×7 · `stage2` ×3 · `ladder` ×1, and the doubly-malformed rows now pin `live→stage2` ×2 **and** `stage2→ladder` ×1. The five pre-existing vectors regenerated **byte-identical** |
| `sweep.go` / `sweep.ts` | ⭐ **the port membership guard** — every winner must be in the candidate set the award competed over, which carries both "already assigned" and "not on the roster" in one test · duplicate co-winners refused · TS gained the **omitted-field** shapes Go got free from zero values · TS's roster guard **moved below `validateLive`** (it violated the published order) · the `players: null` comment corrected — it claimed the input was inexpressible when it is · `validateLive` gained the object-type arm · the **equivalent-mutant proof rewritten** with the reason that actually holds |
| `stage1.ts` | `weightAt` now refuses any non-integer index — `NaN < 0` and `NaN > tableMax` are both false, so `NaN` fell into `table[NaN]` → `undefined as number`, the exact failure the function was written to close, surviving inside it |
| `sweep_test.go` / `sweep.test.ts` | `algo_version`, `exit_steps` and `spec` **asserted** (decoded by both suites, asserted by neither) · TS refusal gate rebuilt as a switch with a `ladder` arm and a loud `default` · TS `deciding_value` now compared by **magnitude**, not presence · **guard-the-guards for the four unguarded case names**, including both rows the mutation pass added · `SweptOut[0]` indexed only after a fatal length check · **5 new stub-port rows** per suite driving the membership and duplicate guards |
| `0025_ceremony_results.sql` | `is_shared` trigger checks **both** `OLD` and `NEW` parents on UPDATE (moving a co-winner left the source drifted — the M1(1) failure it exists to close) · the **`0 → NULL` writer contract** for `tie_ladder_exit_step` stated explicitly for 6.8 · `luck_weight_table_valid` requires **≥ 2 entries** (a one-entry table satisfies "strictly decreasing" vacuously and turns FR-26's bias off silently) · the two inline FKs **named** so the suite can assert names · the "by construction" claim scoped to what it actually covers |
| `0025_ceremony_results_test.sql` | `has_check` (which could not fail) replaced by a by-name assertion · the two `23503` tests now assert **constraint names**, per the file's own header rule · Section E's positive control now **writes**, so it fires the trigger instead of relying on a possibly-empty event queue · `limit 1` scoped to T6 by name — it was ambiguous the moment Section G inserts T7's ceremony · ⭐ a **move-a-winner** IC909 case · **4 new CHECK-branch cases** (one-entry · 2-D array · non-1-based subscripts · NULL entry), two of which I traced as **accepted** if their branch were removed · `plan(63)` → **`plan(68)`** |

**GATES AFTER THE PATCHES** (all re-run; deltas against the pre-review baseline):

| Gate | Before | After |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | 1302 / 42 | **1318 / 42** (+16) |
| `npm run build` | 0 | **0**, every viewer route `ƒ`, no `roulette` route |
| `go build` / `go vet` / `go test ./...` | clean | **clean** |
| Go `awards` | 602 | **607** (+5) |
| `gofmt -l ./worker` | empty | **empty** |
| `--check` | OK ×6 | **OK ×6**, five pre-existing files byte-identical (`git status` under `roulette/` shows only `README.md` + `generate_vectors.py`) |
| Scope (10 paths) | untouched | **untouched** |
| CRLF | 0 | **0 in every committed blob** — measured on raw bytes through `git hash-object`; the two working-tree files showing CRLF are `core.autocrlf=true` on checkout and normalise to LF on commit |
| pgTAP | 1218 / 26 (unverified) | ✅ **1223 / 26 — RUN AND GREEN** after `supabase db reset` (+5, exactly `plan(63) → plan(68)`) |

✅ **pgTAP RAN AND PASSED AGAINST THE PATCHED MIGRATION — 1223 tests / 26 files, `Result: PASS`**
(`supabase db reset` first, so `0025` applied from scratch with every patch in it). The delta on the
implementation session's 1218 is **exactly +5**, matching `plan(63) → plan(68)`; pgTAP fails loudly on
a plan mismatch, so that arithmetic is now confirmed rather than asserted. The run independently
verifies three patches that could not be checked any other way: the **two-parent `is_shared`
trigger** (moving a co-winner now raises IC909 — it silently drifted before), the **two newly-named
FKs** and their exact violation messages, and all four **new CHECK-branch cases** including the
`>= 2` one-entry rule. ⚠ Getting here needed a repair first: the earlier machine crash had left
`~/.docker/daemon.json` and `~/.docker/windows-daemon.json` as **all-zero byte blocks** (NTFS
allocated, never flushed), which is why Docker refused to start with `invalid character '\x00'`. Both
replaced with valid JSON; a sweep confirmed **no project file took the same damage**.

##### ▶ THE qa66 REBUILD — DISCHARGED 2026-08-07. NOTHING IS OWED.

The last outstanding item — decision 2's re-measurement — **ran**. The harness was rebuilt from
nothing, the corpus was re-ingested end to end through the real path, and all five deliverables are
printed in the Completion Notes' *"▶ THE qa66 REBUILD"* block. **AC3 and AC6 are MET.**

| # | Deliverable | Result |
|---|---|---|
| 1 | The 19 winless ids at floors-0, **by name** (6.7's blocking input) | ✅ printed, byte-lex, plus the 9 holders and the 9 + 12 + 19 = 28 reconciliation |
| 2 | The 21-vs-22 byte cost, reconciled against 6.5 | ✅ **an undeclared HARNESS difference, not a defect** — shelf advancing **21**, shelf frozen **22**, both measured on one run, with the spin-10 arithmetic (total 180 < 256 ⇒ `k = 1`) that produces it |
| 3 | What the bias does to the drawn order | ✅ shipped vs flat `[1]` table at all four widths; the order moves at every width, flat costs a flat 11 bytes |
| 4 | Reachability, per configuration | ✅ **index 0 only** at the shipped floors (five of six entries unreachable); 0–2 at floors-0 widths 1–2; 0–3 at widths 3–4 |
| 5 | Width 2's shelf distribution | ✅ `shelf0:19 shelf1:6 shelf2:3`, max shelf 2, winless 19 |

⛔ **THE INVARIANT DID NOT MOVE.** Real floors, 12 spins: **22 bytes**, drawn order
`aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` — character-for-character.
Every one of the eight matrix rows reproduced exactly, so the whole table is now **re-derived** rather
than recorded from a deleted harness. Both 702-line transcripts are byte-identical (`Compare-Object`
**0** differing lines; SHA-256 `4BB13C99…392C982D` on both). Corpus anchors all reproduced, including
`fair_seed = 1b3cd678…3279c`; `content_sha256` differs, correctly.

✅ **AND THE STACK WAS PUT BACK, NOT LEFT DIRTY.** The rebuild put the QA corpus into the local
database, so `supabase db reset` was run afterwards (all 25 migrations re-applied from scratch; every
corpus table verified at 0 rows) and the pgTAP suite re-run on the clean stack: **26 files, 1223 tests,
`Result: PASS`** — the review session's number, reproduced. **Nothing is owed and nothing is left
dirty.**

#### Dismissed as noise (3)

The Blind Hunter's three "context I could not obtain" items all resolve on inspection: `validateShelf`
does reject non-integers (`Number.isInteger`, [stage1.ts:802](lib/roulette/stage1.ts#L802)); `ladderIsNil` is the sanctioned
typed-nil guard `stage2.go:407-428` that `ResolveAward` uses; and the coverage helper's use of bare
`ResolveLadder` rather than the injected port is deliberate, since it computes counterfactuals.
