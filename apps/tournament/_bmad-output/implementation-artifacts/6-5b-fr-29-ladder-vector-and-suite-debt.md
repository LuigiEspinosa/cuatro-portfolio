---
baseline_commit: 4c9cf36
---

# Story 6.5b: FR-29 ladder — close the vector and suite debt

Status: done

> **This story exists because 6.5's own review says so, in its own words.** The last line of
> [6-5-fr-29-tie-ladder.md:779](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L779):
> *"⛔ **STILL OWED — 8 patch themes plus T7, all written up above and NOT applied.** They are a scoped
> dev pass, not a review patch… **Until those land, the ladder ships with rung 2's defining property
> untested and four mutation-carrying vector rows unguarded.**"*
>
> ⚠ **Nothing here is new behaviour.** Every AC below is either a vector row, a coverage guard, a test
> assertion or a comment correction. The ONE exception is T2(e)/T5's refusal rows, which surface
> guards that are already **live in shipped code** and currently **ungated** — the story adds their
> rows, it does not add the guards.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the completion pass on the sixth story**
Traces: **FR-29** · **AD-14** · SOLUTION-DESIGN §9.6 (the vector suite gates the build) · Epic-5 retro Action Items **#3** and **#5**
Consumes: everything 6.5 shipped at `4c9cf36` — `ladder.go` / `ladder.ts` / `ladder-resolve.json` / `generate_vectors.py`'s ladder half / both ladder suites / `catalog.ts` + `catalog.test.ts`
Hands to: **6.6** (which drives `ResolveLadder` over a REDUCED set and inherits every gap left here), 6.11 (vector consolidation)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the next developer to drive the FR-29 ladder,
I want every rung, every refusal and every mutation-carrying row genuinely gated by the shared vector,
so that Story 6.6's anti-sweep can re-resolve over a reduced set on top of a ladder whose properties are proven rather than asserted.

## Acceptance Criteria

**AC1 — the published validation order matches all three implementations, and every adjacent boundary is pinned by a doubly-malformed row.**
**Given** Cuatro's decision recorded at [6-5:759](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L759) — ***"AMEND THE PUBLISHED SPEC, DO NOT MOVE THE CODE"*** — and 6-4b's headline that validation **order is contract, not taste**,
**When** `ladder-resolve.json` is regenerated,
**Then** its `spec` string and the four-group docstrings in **all three** implementations describe what the code actually does (the duplicate-`players` scan is part of building the index and refuses as **`player`** *before* the `tied` membership check, at [worker/awards/ladder.go:756-770](worker/awards/ladder.go#L756), [lib/roulette/ladder.ts:799-819](lib/roulette/ladder.ts#L799) and the anchor's `_validate_ladder`), a **single-defect duplicate-`players` refusal row** exists (that guard is deletable in all three today with every gate green), and **doubly-malformed rows** pin the three unpinned adjacent boundaries — `stage2`-before-`award`, `tied`-before-`player`, and intra-`tied` id-shape/duplicate/order. **No behaviour changes.**

**AC2 — rung 2's defining property is exercised, and rung 2 is gated to the same standard as rungs 1, 3 and 4.**
**Given** T2 ([6-5:761](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L761)) — *"Rung 2 is the least-gated rung in the ladder, and its headline property is not exercised at all"*,
**When** the ladder vector is regenerated,
**Then** it carries: **(a)** a rung-2 case whose `eff_num_key`/`eff_den_key` are **RATE** keys (`adr`, `hs_pct`, `kast_pct`, `entry_success` are all legal and none appears in an eff slot anywhere today), so the four-term product genuinely has **four non-trivial terms** — today every eff key is a volume key, `snapshot_efficiency_form` gives a volume `v` the pair `{v,1}`, two of four factors are the literal `1`, and an implementation that dropped both `.Den`/`.Num` factors is **byte-identical on all 24 cases including the 2^53 row**; **(b)** a rung-2 row under `direction: 'min'`; **(c)** a rung-2 row where `survivors = narrowed` is **load-bearing** (today all four rung-2 rows exit at step 2 with a single winner, so deleting the narrowing line reddens nothing); **(d)** the **`0/0` uneliminable** row the D1 decision promised (only the `n/0` half exists, and the existing `0/0` row is at rung 1 — a different arithmetic path); **(e)** rows for `efficiencyPair`'s absent-key and incomplete-pair refusals, which have no row in any implementation.

**AC3 — narrowing and exit-step precedence are pinned, so a wrong rung cannot ship to the audience via 6.8.**
**Given** T3 ([6-5:762](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L762)) and that 6.8 persists `award_result.tie_ladder_exit_step`,
**When** the vector is regenerated,
**Then**: **(a)** a **rung-4 case with width ≥ 3** where one survivor holds `-1` and two others tie at the earliest, so `narrowed` must **EXCLUDE the sentinel holder** from the shared set — today every rung-4 case is all-absent, or two byte-identical timestamps, or already width-2, so `narrowed == present == survivors` everywhere and an implementation that skipped rung 4 whenever it failed to resolve hands a co-winner's trophy to a player with **no approved rows at all**; **(b)** rows where **rung 1 resolves while rung 2 is configured** and where **rungs 1/2 resolve while `h2h` is populated** — falling through with a single survivor returns the SAME winner at a **FABRICATED exit step**, because rung 3's dominator loop is vacuously true for a lone survivor (rung 3→4 precedence IS pinned; rungs 1 and 2 are not); **(c)** a row where **rung 3 runs over a NARROWED set** — no row both narrows and populates `h2h`, so an implementation computing dominators over the original `tied` is byte-identical everywhere.

**AC4 — every coverage guard re-derives its own row's input property, and the four mutation-carrying rows are guarded.**
**Given** T4 ([6-5:763](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L763)) and that this is **the third occurrence of this exact defect class** in this project ([memory: coverage guards can be vacuous](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L368); 6-4a's `sawFloatDivergence`, 6-4b's three number-only guards),
**When** the guards are extended,
**Then** the four rows that are the **SOLE killer of a Task-7 mutation** each gain a `pins_inputs` guard that re-derives the property from the row's own data — `the-ladder-NEVER-re-applies-the-FR-21-floors` (re-derive `floor_rounds: 24` against the winner's `rounds_played: 10`), `rung-2-runs-over-rung-1s-SURVIVORS` (re-derive that rung 1 eliminates the best rung-2 ratio holder), `rung-4-under-direction-min-is-STILL-the-earliest` (assert `direction == min` **and** two distinct timestamps), and `stage1-pick.json`'s `a-SHARED-co-winner-weights-at-the-MINIMUM-shelf` (assert the two co-winners hold **DIFFERENT** shelves **and** that the outcome is `shared` at all — a rung 5 returning the byte-lex first yields the identical weight); the flagship `rung-2-four-term-products-past-2-pow-53` guard re-derives that the **cross products straddle a difference of one** and that a narrowed compare **flips the winner**, not merely that the operands exceed 2^53; the five further named rows with no input re-derivation gain one; the two guards reading module globals (`SHELF`, `TABLE`) read the **row's own data**; the one hardcoding `"max"` reads `c["award"]["direction"]`; and the three-absence-spellings guard is made able to fail independently of the three `pins` it duplicates.

**AC5 — both ladder suites assert the declared-refusal-detail split, and `internal` is either exercised or declared unreachable in both languages.**
**Given** T5 ([6-5:764](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L764)) — today **every `award` row, or every `player` row, could be deleted from the vector** and only "the array is non-empty" would notice,
**When** the suites are extended,
**Then** both mirror the machinery `stage1_test.go:511-524` and `stage1.test.ts:405-423` already ship — a named representable/unrepresentable split asserting **≥ 1 row per representable detail** and **ZERO rows** for the unrepresentable ones — and `internal`, which today has **no row and no unreachability declaration in either suite**, carries its declaration with **both** producers named separately (rung 3's plural dominator by **ANTISYMMETRY**, the Group-1 empty-best-set refusal by **ACYCLICITY**, which is strictly weaker).

**AC6 — the cross-language suite asymmetries are closed in both directions.**
**Given** T6 ([6-5:765](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L765)) — *"one-sided gates over a shared vector"*,
**When** the suites are levelled,
**Then** TypeScript gains what only Go asserts (the `stage2` propagation unwrap — **`ladder.ts` attaches no `cause` today**, so a TS implementation that swallowed it and threw a fresh `LadderError` passes every refusal row; a non-mutation-of-inputs test; a non-decimal `steamid64` local row so `STEAMID64_RE` is not dead to the TS suite; an out-of-vocabulary `classOfStatKey` probe; the widened `spyLadder` recording `players`), Go gains what only TypeScript asserts (`algo_version`), `OUTCOME_KINDS` is pinned in TS by **set equality** rather than `toContain('shared')`, TS's transcribed exit-step literals (`[1,2,3,4,5]`, `toBe(5)`) become module constants the vector can be pinned against, Go's port test stops comparing field-selectively (a port fabricating a `DecidingValue` survives the whole Go suite today; TS's `toEqual` catches it), and the two loaders agree on JSON `null` for `achievement_ts` / `deciding_value`.

**AC7 — `catalog.test.ts`'s clone guard states a MEASURED fact, re-measured.**
**Given** T8 ([6-5:766](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L766)) — *"narration wearing a measurement's clothes in the one test whose purpose is to pin a measurement"*,
**When** the guard is corrected,
**Then** the `kast_pct` entry is **re-measured** over the real corpus (the recorded measurement at [lib/awards/catalog.ts:163-166](lib/awards/catalog.ts#L163) says `kast_rounds == kills`, so `kast_pct` ranks identically to **`entry_success`**, not to `kills` — and `kast_pct = kast_rounds/rounds_played` **can** break a `kills` tie whenever `rounds_played` differs), the `clonesOf[a.decidingStat] ?? []` vacuity is closed (nothing asserts any award decides on `kills`/`deaths`), the clone relation is treated as **symmetric** (an award deciding on `entry_frags` with secondary `kills` passes unchallenged today), the "BOTH-OR-NEITHER" type tautology is replaced with a load-bearing assertion, and the clone table + `MEASURED_EMPTY` are applied to the **rung-2** keys as well.

**AC8 — the remaining coverage gaps are closed, each traced to its unexercised path.**
**Given** T10 ([6-5:768](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L768)),
**When** the vector and suites are extended,
**Then** each of these has a row or an assertion: a **`class: rate` award** (0 occurrences in `ladder-resolve.json` today, so a rate deciding stat at rung 3 — where `h2h[p][q][stat]` is a `{num,den}` pair and the dominator test cross-multiplies — is never read); `achievement_ts` at **`0`** (the value adjacent to the sentinel, so a `ts <= 0` absent-filter passes everything today) and **past 2^53** (so a verifier parsing it with `Number` is unpunished); the SHARED arm's **W8 clamp** (the one shared row's co-winners are shelves 0 and 1); a case carrying a **player who is not in `tied`** (so an implementation iterating the roster rather than the survivors is indistinguishable); an **absent-container** ladder row (`_render_ladder_player` always emits all three blocks, so `container(undefined)` and Go's nil-map read are never entered); TypeScript's transcribed Stage-2 award surface exercised on **all four** clauses (2 of 4 unexercised — exactly the drift the transcription note claims to guard); Stage 1's two `internal` port guards driven by a **stub `Ladder`** returning `{shared, winners: []}` and `{winner, steamid64: ""}`; a `None` guard on `stage1_weight`'s new `shared` branch `shelf` dereference (one fixture from a bare `AttributeError`); and the Go-side pinning weaknesses — the source scan made **recursive** (a subpackage hides from it today where the TS walk is recursive and says so), a positive control + non-vacuity assertion on the import bans, and a non-vacuity assertion on the `math/big` exemption list.

**AC9 — every document this story's own measurements falsified is corrected, and the mutation accounting reconciles.**
**Given** T9 ([6-5:767](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L767)) and the project rule *"measure, never narrate"* / *"a pass is a printed number, not a claim"*,
**When** the pass completes,
**Then**: **(a)** ⭐ *"SHARED TROPHIES WILL BE COMMON"* is corrected in **all four** places it is asserted — [roulette/vectors/README.md:358](roulette/vectors/README.md#L358), `generate_vectors.py:2862`, [worker/awards/ladder.go:68](worker/awards/ladder.go#L68), [lib/roulette/ladder.ts:63](lib/roulette/ladder.ts#L63) — because 6.5 MEASURED it false (0 of 5 real ties contains a duel pair; **0 of 12 awards end shared**); **(b)** `ROW_REPRESENTABLE_DETAILS`'s comment is corrected from *"nine"*/*"seven"* to the real **ten** and **eight**; **(c)** the Completion Notes' `stage1-pick.json` figure (*"489 insertions against 1 deletion"*) is replaced with a figure that matches a real measurement (`git diff --numstat` gives **1528/428**; a minimal difflib alignment gives **1101/1**) — the SUBSTANCE was verified true, only the printed number is wrong; **(d)** the README's "branch on the JSON SHAPE, never on the vocabulary" instruction is reconciled with the anchor's `_stat_value`, which branches on `_class_of(key)` — a loader following the README literally can never emit the L5 refusal row that exists; **(e)** `_stat_value`'s justification *"0024 writes all 21 keys into every block"* is corrected against every `h2h` fixture in the file, each of which writes exactly one key; **(f)** the mutation accounting is reconciled (*"ten survivors and one NOT-APPLIED"* = 11 outcomes, of which 4 gaps + 3 harness + 1 limitation = **8** are explained; *"five genuine gaps"* is claimed but only **four** rows exist in the tree); **(g)** the *"rung 5 returning the set unsorted"* mutation is recorded as a **behavioural no-op** (neither implementation sorts at rung 5, so there is no code to mutate) exactly as the two harness defects were; and **(h)** ⚠ **`T7` is reconciled** — `6-5:779` names it as still-owed but **no finding numbered T7 exists anywhere in the file**; either write it up or record that the review's numbering skipped it, and say which.

**AC10 — the gates hold, and a re-run mutation pass proves the NEW rows kill what they claim.**
**Given** Epic-5 retro Action Item **#3** (a reviewer-independent mutation pass is a review gate) and this story's whole purpose,
**When** the story is signed off,
**Then** the gates are **measured, not quoted** — `npm run lint` **0** · Vitest (6.5 post-T1 baseline **1119 across 41 files** — measure it first) · `npm run build` **0**, every viewer route still `ƒ` dynamic and no `roulette` route · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` clean (`awards` baseline **443**) · `gofmt -l ./worker` **empty** · `python roulette/vectors/generate_vectors.py --check` **OK on all five**, with `prng-block.json` and `prng-uniform-int.json` **byte-identical** and `stage2-resolve.json` **byte-identical** · pgTAP **1155 across 25 files** unchanged under DECISION A · `0025` still **free** — **and** the Task-7 mutation set is re-run with the mutations each new row claims to kill, with `NOT-APPLIED` reported as an outcome distinct from `killed`, a green control pass on unmutated source first, byte-level file IO and SHA-256 restoration. ⛔ **A new row that kills nothing is a row that proves nothing; report it as such rather than counting it.**

## Tasks / Subtasks

> Build order: Task 0 (read) → Task 1 (the anchor first, always) → Task 2 (the rows) → Task 3 (the
> guards) → Task 4 (the suites) → Task 5 (the docs) → **Task 6 (mutation) gates sign-off** → Task 7
> (gates). ⛔ **The anchor changes FIRST and the two runtimes are written against the regenerated
> file** — T1 was the most serious finding in all three of 6.5's review groups precisely because the
> patches went into the runtimes and never into `generate_vectors.py`, leaving the arbitrating
> implementation resolving inputs both runtimes refused.

- [x] **Task 0 — Read before you write**
  - [x] ⭐ [6-5-fr-29-tie-ladder.md:753-779](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L753) **in full and verbatim** — the Groups 2 & 3 findings ARE this story's spec. Every AC above is a compression of a finding written there; where they differ, **the finding wins**. Also `:725-751` (Group 1, for the three refusal paths T1 gated) and `:551-683` (Completion Notes — the measurements the doc corrections must agree with).
  - [x] [roulette/vectors/README.md](roulette/vectors/README.md) — the ownership table (`:31-39`), the representability rule (`:330-335` for the ladder, `:438-447` for Stage 1), the provenance split (`:207-212`, `:325-328`), the formatting rule (`:59-70`), and the loader table (`:597-605`).
  - [x] [roulette/vectors/generate_vectors.py](roulette/vectors/generate_vectors.py) — the ladder half `:2876-4272` (`LadderRefusal` `:2876`, `LADDER_REFUSAL_DETAILS` `:2897`, `ROW_REPRESENTABLE_LADDER_DETAILS` `:2928`, `_class_of`/`_rung_key`/`_beats_stat`/`_best_survivors`/`_stat_value`/`_validate_ladder`/`resolve_ladder`/`_efficiency_pair` `:2931-3302`, `_ladder_award` `:3316`, the three `pins_inputs` helpers `:3331`/`:3348`/`:3379`, `LADDER_CASES`+`LADDER_REFUSALS` `:3398-4211`, `_render_ladder_player` `:4225`, `build_ladder_file` `:4256`), plus `stage1_weight` `:1653-1718` and the Stage-1 rows `:1902-2609`.
  - [x] `worker/awards/ladder.go` **and** `lib/roulette/ladder.ts` in full — you are adding rows for guards that already exist. **Read the guard before you write its row**, or the row's declared `detail` will not match what actually raises.
  - [x] [worker/awards/stage1_test.go:511-524](worker/awards/stage1_test.go#L511) and [lib/roulette/stage1.test.ts:405-423](lib/roulette/stage1.test.ts#L405) — ⭐ **the representable/unrepresentable detail split machinery you are mirroring into the ladder suites (AC5). Do not invent a second design; copy this one.**
  - [x] `worker/awards/prng_test.go:787-907` and `lib/roulette/prng.test.ts:650-828` — the exact-equality pins. **This story adds NO new module**, so the file-set pins must come out **unchanged**; if one reddens you have added a file you were not asked to add.
  - [x] Re-confirm, do not assume: `git log --oneline -3` should show `4c9cf36` at HEAD and `git status` clean before you start.

- [x] **Task 1 — The anchor first (AC: 1, 2, 3, 8)**
  - [x] Extend `generate_vectors.py`'s ladder half with every new fixture and case the ACs name. ⛔ **Never "fix" the generator by reading either implementation** (README `:576-578`) — write each new case from the ACs above and from 6.5's transcribed algorithm at [6-5:242-298](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L242).
  - [x] AC1's spec-string amendment lands **here**, in the `spec` and `refusal_details` prose that `build_ladder_file` emits, and in the four-group docstrings of `_validate_ladder` — then is mirrored verbatim into `ladder.go` and `ladder.ts`. ⚠ **The `spec` string is vector bytes**: amending it forces a regeneration, so bundle it with the rows rather than doing it twice.
  - [x] For AC2(a) you need a **rate** efficiency pair. `_efficiency_form` derives every pair from non-negative counts, so use the `efficiency_force` fixture hook T1 already added (`_p(..., efficiency_force=…)`) — the same reason `secondary_force` exists.
  - [x] `--check` must be run after every regeneration, and **`prng-block.json`, `prng-uniform-int.json` and `stage2-resolve.json` must come out byte-identical.** Only `ladder-resolve.json` and `stage1-pick.json` may move, and `stage1-pick.json` only by **additions** (AC4's fourth row is a guard on an existing row — if its bytes move, say why).

- [x] **Task 2 — The rows (AC: 1, 2, 3, 8)**
  - [x] Every new case carries `ladder_exit_step` — it is pinned on **all** 24 existing cases and is as load-bearing as the winner.
  - [x] Every new refusal row carries a closed-set **`detail`**, and the generator asserts the declared `detail` matches the guard that actually raised.
  - [x] Vectors are **data**: LF newlines, 2-space indent, stable key order. Snapshot magnitudes (including `achievement_ts`) stay decimal **strings**; `ladder_exit_step`, floors, priorities and weights stay JSON **integers** — the split is by **provenance**, not magnitude (`README.md:207-212`, `:325-328`).
  - [x] ⚠ AC8's `achievement_ts` **past 2^53** row is exactly why the provenance rule exists — write it as a string and confirm both loaders read it without rounding.
  - [x] Update [roulette/vectors/README.md](roulette/vectors/README.md): the `ladder-resolve.json` "cases that carry the weight" table gains every new row, the counts in the ownership section are re-derived from the regenerated file (**do not hand-edit a count**), and AC9's four documentation corrections land.

- [x] **Task 3 — The guards (AC: 4)**
  - [x] ⭐ Rule for every guard, without exception: **re-derive the row's INPUT property from the row's own data.** A guard that checks only the numbers the row produces is satisfiable by an unrelated row — that is the defect class, and this is its third occurrence.
  - [x] Pin the **case-name set by exact equality in both suites** after the additions, and assert **exactly one** row per uniquely-claimed property.
  - [x] A guard that cannot fail for any implementation is **deleted**, not repaired (6-4b's review deleted two rather than repairing them). AC4's three-absence-spellings guard is the candidate: make it independently falsifiable or remove it and let the three `pins` carry the property.

- [x] **Task 4 — The suites (AC: 5, 6, 7, 8)**
  - [x] `worker/awards/ladder_test.go` and `lib/roulette/ladder.test.ts` — the detail split (AC5), the asymmetries (AC6), the T10 assertions (AC8).
  - [x] ⚠ TS's `stage2` propagation gate needs `ladder.ts` to attach a **`cause`** first — that is the one place AC6 touches shipped source. Attach it, name it at the site, and note that this is the minimum change that makes the gate non-vacuous.
  - [x] `lib/awards/catalog.test.ts` — AC7. ⚠ The `kast_pct` claim needs a **measurement**, not a re-argument. See Task 5's harness.
  - [x] `worker/awards/stage1_test.go` / `lib/roulette/stage1.test.ts` — AC8's stub-`Ladder` rows for Stage 1's two unreachable `internal` port guards.
  - [x] Go: `gofmt -l ./worker` must be **empty**. Table-driven; `t.Errorf` over `t.Fatalf` in shared helpers.
  - [x] Vitest: colocated under `lib/**` only ([vitest.config.ts:17](vitest.config.ts#L17)) or the file **silently does not run**.

- [x] **Task 5 — The documentation corrections, each backed by a measurement (AC: 7, 9)**
  - [x] ⭐ **`kast_pct` must be re-measured, not re-reasoned.** Probe the real corpus the way 6.1 and 6.5 did — per player, is `kast_pct` an exact rank-clone of `kills`, of `entry_success`, or of neither? Print the numbers into Completion Notes and write the guard to match what they say. If the probe needs the stack, reuse 6.5's harness convention (throwaway `worker/cmd/qa65b` + a throwaway Vitest file + `_qa65b/`, **all deleted before commit**).
  - [x] AC9(c): compute the `stage1-pick.json` figure with a stated method (`git diff --numstat` **or** a minimal difflib alignment) and print **both the number and the method**. Two honest numbers disagreeing is fine; a number matching no measurement is not.
  - [x] AC9(h): reconcile **T7**. Say plainly whether a T7 finding exists, was folded into another theme, or was a numbering slip.
  - [x] ⚠ Correct the comments **at their sites in all four files** for AC9(a) — two of the four (`ladder.go:68`, `ladder.ts:63`) are Group-1 files the first review pass missed.

- [x] **Task 6 — ⛔ Mutation pass, and it is the point of this story (AC: 10)**
  - [x] Re-run the Task-7 mutation set from 6.5 (22 mutations × both languages) **plus** one mutation per new row, chosen so the new row is its **sole killer**. Control pass on unmutated source **first** — the run is void unless it is green. Read and write mutation files as **BYTES** (a CRLF round-trip silently unapplied 12 Go anchors in 6-4a). Run the **whole** vector-driven test set, never a `-run` filter. Report `NOT-APPLIED` as an outcome distinct from `killed`. Verify restoration by **SHA-256** on all five vector files and every touched source file.
  - [x] ⭐ Specifically prove the mutations AC2–AC4 name are now killed: rung 2 dropping both `.Den`/`.Num` factors · rung 2 hardcoding `max` · rung 2's narrowing line deleted · rung 4 skipping instead of narrowing when it cannot resolve · rungs 1/2 falling through to a fabricated exit step · rung 3 computing dominators over the original `tied` · each of the four mutation-carrying rows edited in its data (the guard must redden).
  - [x] ⭐ **A mutation that only reddens a hand-written local assertion means the VECTOR does not cover it — fix the vector, not the test.**

- [x] **Task 7 — Gates (AC: 10)**
  - [x] Measure every baseline **before** the first change: `npm test`, `go test ./...`, and the five vector files' byte sizes. 6.1 quoted stale numbers; do not.
  - [x] `npm run lint` → 0 · `npm test` → report the delta and **what each new test is** · `npm run build` → 0 · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` → empty · `--check` → OK on all five with the three byte-identical files proven by `git status`.
  - [x] pgTAP: **unchanged, 1155 across 25 files** under DECISION A. Run it if the stack is up for Task 5's probe; otherwise state plainly that it rests on `supabase/**` being byte-untouched.
  - [x] `git status` + `git diff --stat` proof that `supabase/**`, `app/**`, `lib/ceremony|i18n|bracket|steam/**` and `worker/ingest|store|db|config/**` are **byte-untouched**, and that **`0025` is still free**.

## Dev Notes

### ⚠ Decisions taken at contexting

**DECISION A (carried, and it has held four times) — this story writes NOTHING to the database.**
No migration, no RPC, no route, no RLS, no pgTAP file. **`0025` stays free.** Every AC is a vector row,
a coverage guard, a test assertion or a comment.

**DECISION B — the code changes here are the MINIMUM the gates require, and each is named.**
Exactly two behaviour-adjacent edits are authorised: **(1)** attaching a `cause` to `ladder.ts`'s
`stage2` propagation so AC6's gate is non-vacuous, and **(2)** a `None`/nil guard on
`stage1_weight`'s `shared`-branch `shelf` dereference (AC8). Everything else is comments, rows,
guards and tests. ⛔ **If a new row reddens shipped source, stop.** That means the row disagrees with
the implementation, and the review's verdict was that the implementations are RIGHT and the
*documents* are wrong (AC1's decision). Report it rather than "fixing" the code to match a row you
just wrote.

**DECISION C — the anchor changes first, in the same published order, every time.** T1 is the
cautionary tale and it was this review's own doing: the Group-1 patches added guards to both
runtimes and not to `generate_vectors.py`, so the arbitrating implementation *resolved inputs both
runtimes refused* and emitted `{kind: shared, winners: [], ladder_exit_step: 5}` — the
trophy-awarded-to-nobody — as an expected value. Three-way divergence is the failure mode this
directory exists to prevent, and it is reachable in one careless patch.

**DECISION D — a refusal that cannot be a row is DECLARED unreachable, never left silent.**
`ROW_REPRESENTABLE_LADDER_DETAILS = LADDER_REFUSAL_DETAILS[:4]` and `build_ladder_file` hard-fails
any refusal row landing on `internal`. That is correct and stays. The obligation it creates is that
**every** `internal` producer is documented with its own unreachability argument — and there are now
**two**, with genuinely different arguments (antisymmetry vs acyclicity). AC5 is that obligation.

### What is NOT in scope

- **Anti-sweep, `assigned_this_spin`, overflow re-resolution, the `luck_weight_table` VALUES,
  `UNIQUE(spin_id, winner_entry_id)`** → **6.6**. This story makes the ladder 6.6 drives *trustworthy*;
  it does not build 6.6.
- **The pity draw** → 6.7. **Persistence, the reveal axis, `tie_ladder_exit_step` storage** → 6.8.
  **RFC-8785 / `bundle_sha256` / `algo_version`** → 6.9. **Any UI or i18n string** → 6.10.
  **The end-to-end ceremony vector** → 6.11.
- **The four items 6.5's review deliberately DEFERRED** ([6-5:739-743](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L739) and `:770`): the catalog's non-nullable rung-key types
  (homed to the rung-2 product decision), `LadderExitStep`'s two spellings of "none" (6.8/6.9), the
  negative shelf index (**6.6** — it owns the weight table's values), `ladder.ts` transcribing
  `validateAward` (6.11), `decidingValue` made optional (6.8), `stage2-resolve.json`'s unreachable
  `shared` kind (6.9), the W8 clamp comment (**6.6**), the anchor's independence (6.11), and the
  21-key vocabulary's missing link to `0023` (6.11). ⛔ **Do not take any of these back.** They have
  homes and the homes are recorded in `deferred-work.md`.
- **Any change to the ladder's five rungs, its rung order, its refusal semantics or its exit steps.**
  The behaviour is reviewed and correct. This story proves it; it does not revise it.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)). Environment `node`. Measure the baseline before claiming a delta (6.5 post-T1: **1119 / 41 files**).
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./... -count=1`, then **`gofmt -l ./worker` empty**. `awards` post-T1: **443**.
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe a vector value into source.** Every conformance switch keeps its final unknown-value arm. Refusals assert the **typed** error **and** the declared `detail`.
- **`npm test` does not typecheck** — run `npm run build` before you believe the suite.
- **No vacuous assertions.** If an assertion cannot fail for any implementation, delete it.
- **pgTAP** — untouched under DECISION A. Baseline **1155 / 25**.

### Stack

Unchanged and nothing new is permitted. Go `1.26.4` (`worker/go.mod`) — stdlib only; `math/big`
exempted for `stage2.go` and `ladder.go` **only**, and that exemption list is pinned by exact
equality. Node ≥ 20.9 · TypeScript `^5.9` (`verbatimModuleSyntax: true`, so every type-only import is
`import type`) · Vitest `4.1.9` · Next.js `16.2.10` · `tsconfig` target `ES2022` with `esnext` lib.
Python 3 **stdlib only** for the generator. **No new npm package, no new Go module, no new file in
`worker/awards/` or `lib/roulette/`.**

### Previous story intelligence — 6.5 (`4c9cf36`), 6-4b (`ad8b649`), 6-4a (`9ccb832`)

- ⭐ **The coverage-guard defect is now at its THIRD occurrence** and every time it looked closed. 6-4a: `sawFloatDivergence` flipped by a zero-denominator row, so the headline `(2^53+1)` case was deletable with every gate green. 6-4b: three guards checked only the numbers their row produced, reachable by other routes. 6.5: the `pins_inputs` machinery is *genuinely good* and covers 14 of 24 cases — and covers **none** of the four rows the mutation pass itself added. The pattern is that the guard is written for the rows the author was thinking about, and the load-bearing rows are added later under time pressure. **Write the guard in the same edit as the row.**
- ⭐ **A "closed set" that is not closed** — 6-4b shipped `detail` as 9 in Go, 7 in TS, 7 in the vector. 6.5 declared five and gave `internal` no row and no unreachability marker in either suite. AC5 exists because a closed set nothing inspects is a compartment, not a contract.
- ⭐ **The author's own mutation table is not proof.** 6.2 reported 43/0 → reviewer found 5 survivors in 6. 6.3's first table was structurally invalid → 8 survivors on an honest re-run. 6-4a's harness silently failed to apply 12 of 18 Go mutations after a CRLF round-trip. 6.5's first run had ten survivors and one NOT-APPLIED. **Control pass first; bytes not text; SHA-256 restoration.**
- **Cross-language divergences hide where the vector is silent.** Closed so far: Go panicking where TS refused · a typed-nil guard · aliased `*big.Int` vs immutable `bigint` · untyped Go refusals · a bare `TypeError` on a null input · two loaders disagreeing on `"+5"` · a switch with no final arm · an oversized-but-integral value refusing under two labels · `JSON.stringify` throwing on a `bigint` while building a refusal message. AC6 is the same hunt run over the **suites** instead of the source.
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers.**
- **Gates at 6.5 sign-off (post-T1):** lint 0 · Vitest **1119 / 41** · build 0 · `gofmt -l ./worker` empty · Go clean, `awards` **443** · `--check` OK ×5 · `ladder-resolve.json` 24 cases / 19 refusals · pgTAP **1155 / 25** · `0025` free.

### Git intelligence — recent commits

`4c9cf36` (6.5, the ladder + the five-rung vector) · `ad8b649` (6-4b, Stage 1 + gate 3) · `9ccb832`
(6-4a, Stage 2 + the refusing ladder port) · `3f7c98e` (6.3, PRNG + vectors) · `eed5318` (6.2,
ceremony lock + snapshot) · `01e3f5b` (6.1, award catalog). The working tree is **clean** at
`4c9cf36`; 6.5's Group-1 patches and T1 fix are all committed. This story's diff should touch
`roulette/vectors/**`, both `*_test` sets, `lib/awards/catalog.test.ts`, and — under DECISION B and
only there — two named lines of shipped source.

## Project Structure Notes

```
roulette/vectors/generate_vectors.py          UPDATE  new fixtures, cases, refusals, guards; the amended spec string
roulette/vectors/ladder-resolve.json          UPDATE  regenerated — new cases + new refusals + the spec string
roulette/vectors/stage1-pick.json             UPDATE  the co-winner row's guard (data unchanged; guard added in the generator)
roulette/vectors/README.md                    UPDATE  the weight table, the corrected counts, the four doc fixes
worker/awards/ladder_test.go                  UPDATE  detail split, Go-side asymmetries, T10 assertions, recursive scan
worker/awards/stage1_test.go                  UPDATE  stub-Ladder rows for the two internal port guards
worker/awards/prng_test.go                    UPDATE? ONLY if AC8's recursive-scan fix lives here — file-set pins must NOT move
worker/awards/ladder.go                       UPDATE  comments only (AC9a) + the amended docstring (AC1)
lib/roulette/ladder_test.ts → ladder.test.ts  UPDATE  detail split, TS-side asymmetries, set-equality OUTCOME_KINDS, exit-step constants
lib/roulette/ladder.ts                        UPDATE  DECISION B(1): attach `cause`; comments (AC9a) + docstring (AC1)
lib/roulette/stage1.test.ts                   UPDATE  stub-Ladder rows
lib/roulette/stage1.ts                        (see below — DECISION B(2) landed in the PYTHON anchor,
                                              not here; this line was stale and is corrected at the
                                              6-5b code review. `stage1.ts` DOES move, but for a
                                              different reason: the shared-arm empty-SteamID64 guard
                                              Cuatro authorised at review, which is NOT DECISION B(2).)
lib/awards/catalog.test.ts                    UPDATE  the re-measured clone guard (AC7)
_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md   UPDATE  tick the nine `[ ]` findings as applied; Status -> done
_bmad-output/implementation-artifacts/sprint-status.yaml        UPDATE
```

⛔ **No new module in `worker/awards/` or `lib/roulette/`.** Both file-set pins are exact equality and
must come out unchanged. `0025` stays free. `supabase/**`, `app/**` and `worker/ingest|store|db|config`
stay byte-untouched.

## References

- ⭐ **The spec for this story** — [6-5-fr-29-tie-ladder.md:753-779](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L753) (Groups 2 & 3 findings, verbatim) · `:725-751` (Group 1) · `:551-683` (Completion Notes, the measurements)
- **FR-29** — [prd.md:388-395](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L388) · **AD-14** — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) · the ladder on the contract surface `:219`
- **The vector suite gates the build** — [SOLUTION-DESIGN §9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L440)
- **The vector house rules** — [roulette/vectors/README.md](roulette/vectors/README.md) (`:13-24` the three rules · `:31-39` ownership · `:59-70` format · `:207-212` + `:325-328` provenance · `:330-335` + `:438-447` representability · `:576-578` never fix the anchor from an implementation · `:597-605` loaders)
- **The detail-split machinery to mirror** — [worker/awards/stage1_test.go:511-524](worker/awards/stage1_test.go#L511) · [lib/roulette/stage1.test.ts:405-423](lib/roulette/stage1.test.ts#L405)
- **Epic-5 retro Action Items #3 and #5** — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95) (both still `open` as standing review-gate steps, `:114`)
- **The deferrals that stay deferred** — [deferred-work.md:306-319](_bmad-output/implementation-artifacts/deferred-work.md#L306)

## Questions for Cuatro

Two. Neither blocks Task 0.

1. **Should this pass be gated by a fresh reviewer-independent mutation run, or is the author's
   Task-6 table enough here?** Epic-5 Action Item #3 makes a reviewer-independent pass a **review**
   gate, and this story *is* the discharge of a review — so there is a real question of whether it
   gets its own review afterwards. **Recommended: yes, a short review focused on one question only —
   "does each new row kill the mutation it claims, and does each new guard fail when its row's data
   is edited?"** That is a much narrower review than 6.5's nine layers and it is the only thing that
   distinguishes this story from a large, plausible-looking diff.
2. **AC9(h) — if `T7` turns out to be a numbering slip rather than a lost finding, is recording that
   enough?** **Recommended: yes.** A review whose numbering has a hole should say so once and move on;
   manufacturing a finding to fill the gap would be worse than the gap.

## Review Patches — APPLIED 2026-08-06

All 22 patch items (15 original + the 6 boundaries + the `shared`-arm guard) were applied.

```
npm run lint                       0
npx vitest run                     1202 across 41 files   (1183 -> 1202, +19)
npm run build                      0 errors; every viewer route ƒ dynamic; NO `roulette` route
cd worker; go build/vet/test       clean       gofmt -l ./worker   EMPTY
generate_vectors.py --check        OK on ALL FIVE
  ladder-resolve.json              37/29 -> 42/31   (+5 cases, +2 refusals)
  stage1-pick.json                 17/19, regenerated (the clamp row's `why` prose IS vector bytes)
  prng-block · prng-uniform-int · stage2-resolve   ABSENT from git status -> BYTE-IDENTICAL
CRLF in all five vectors           0 · 0 · 0 · 0 · 0
scope exclusions · 0025 · qa65b    byte-untouched · FREE · absent
```

⭐⭐ **FALSIFIABILITY PASS — 7 applications · 7 KILLED · 0 SURVIVED · 0 NOT-APPLIED.** Control pass on
unmutated source GREEN first, files read/written as **BYTES**, anchors rewritten into each file's own
line-ending convention, exact-once matching enforced, restoration verified by **SHA-256**. ⚠ The
harness's own first run reported the control RED because Vitest could not resolve its config under a
lowercase drive letter — every suite returned *0 tests*, which an exit-code-only harness would have
scored as `killed` for **every** mutation. That is 6-4a's failure mode in new clothes, caught by the
control pass rather than by the results, and it is recorded because the story's own history says the
harness is the thing that lies.

| # | Mutation | Verdict |
|---|---|---|
| R01 | the `shared`-arm empty-SteamID64 guard removed (TS) | **KILLED** by the new stub row |
| R02 | the `shared`-arm empty-SteamID64 guard removed (Go) | **KILLED** by the new stub row |
| R03 | the transcription apostrophe drift **re-introduced** | **KILLED** by the new clause-message test |
| R04 | rung 3's `internal` refusal message deleted | **KILLED** by the comment-stripped scan |
| R06 | rung 3 relaxed to "beats at least ONE" | **KILLED** by the new width-3 dominator row |
| R07 | rung 4 folded over the ROSTER, not the survivors | **KILLED** by the new non-tied row |
| R08 | `achievement_ts` validated over the ROSTER (Go) | **KILLED** by the new non-tied row |

⭐ **R03 is the one that matters most**: it re-introduces the *exact* defect the review found — the
ASCII `'` where `stage2.ts` uses U+2019 — and the replacement test catches it, where
`expect(clauses).toHaveLength(4)` could not have caught anything at all.

⚠ **THE REVIEW'S HEADLINE FINDING PROVED ITSELF DURING THE FIX.** Adding the five new cases turned
**seven** existing `claim()` predicates red on the uniqueness assertion — four in TypeScript, three in
Go — because the new rows satisfied claims meant for other rows. Every one was a claim the review had
already flagged as too weak. The `claim()` machinery caught its own blind spot the moment a row it
had not been written against arrived, which is the strongest available evidence both that the finding
was real and that the machinery is sound.

## AC10 — the FULL mutation set, RE-RUN after the review patches (2026-08-06)

⚠ **THIS IS A REBUILT HARNESS, NOT THE STORY'S ORIGINAL, AND THAT IS STATED RATHER THAN GLOSSED.**
`mutate65b.py` was scratchpad-only and is gone, so its 30 themes / 51 applications cannot be
re-executed byte for byte. What ran is an independently authored set over the same surface — every
rung, every narrowing, every refusal guard, both loaders and the Stage-1 arms, in both languages
wherever the mutation is expressible. Same protocol, every clause of which was earned by a real
failure here: control pass first, **bytes not text**, anchors rewritten into each file's own
line-ending convention, **exact-once** matching, `NOT-APPLIED` reported as an outcome distinct from
`killed`, SHA-256 restoration, and the **whole** vector-driven test set per mutation (`vitest run
lib/` + `go test ./...`), never a `-run` filter.

```
CONTROL PASS (unmutated)      vitest GREEN · go GREEN      -> the run is not void
42 applications · 38 KILLED · 4 SURVIVED · 0 NOT-APPLIED · restoration clean on every file
```

Killed, by rung: **rung 1** argmax-on-plural-best (ts+go) · narrowing deleted (ts+go) · **rung 2**
both factors dropped (ts+go) · hardcoded `max` (ts+go) · narrowing deleted (ts+go) · **rung 3**
dominators over the original tie (ts+go) · relaxed to "beats at least one" (ts) · **rung 4** sentinel
filter deleted (ts+go) · `ts <= 0` filter (ts) · inverted to LATEST (ts+go) · skip-instead-of-narrow
(ts+go) · folded over the roster (ts) · **rung 5** one winner returned (ts+go) · **validation**
duplicate-`players`, byte-lex order, width ≥ 2, both-or-neither, three negative-magnitude guards,
`achievement_ts` scoped to the roster (go) · the transcribed Stage-2 clause drifting by one character
· rung 3's `internal` message removed from the code · **Stage 1** the shared arm's empty-id,
empty-winners, W8 clamp, and `min`→`max` aggregation.

### The four survivors — reported, not counted

⛔ *A new row that kills nothing is a row that proves nothing.* None of these four is a vector gap,
and each is a different reason:

1. **`M08` — rung 3's PLURAL-dominator refusal deleted (Go + TS).** A **behavioural no-op on every
   reachable input.** This is the `internal` producer both suites already declare unreachable **by
   ANTISYMMETRY**: `compareStatValues(a,b) === -compareStatValues(b,a)`, so two players can never
   both beat everyone, so no set of INPUTS produces `|D| > 1` and there is nothing for a row to
   carry. Deleting the branch removes code that cannot execute. This is precisely the state
   DECISION D exists to name, and it is named in both languages.
2. **`M16` — the duplicate-`tied` guard deleted (TS).** A **recorded closed-set limitation, already
   documented in the vector's own refusal #23.** The byte-lex ORDER guard immediately below catches
   the same input and refuses with the **same `detail` (`tied`)**, so no row can separate them —
   verified on both shapes: adjacent (`[A, A]`, the committed row) and non-adjacent (`[A, B, A]`).
   Messages are not contract; details are, and a closed set of five labels has nothing finer to say.
   Identical in kind to `M23`'s `efficiencyPair` limitation the story already recorded.
3. **`M20` — a refusal MESSAGE edited without touching its guard.** ⭐ **This one is a DELIBERATE
   NEGATIVE CONTROL and it is supposed to survive.** Its survival is what proves the suites assert
   the **typed error and the declared `detail`** rather than string-matching prose — if it had been
   killed, the refusal gates would be pinned to wording and every message edit would be a false
   alarm. A mutation set with no expected-survivor has no way to distinguish a strict suite from a
   brittle one.

**Net: two genuine survivors, both structurally unkillable and both already declared; one control
behaving correctly.** Nothing here is a coverage hole, and no row was added to chase one.

## Review Findings

> **bmad-code-review, 2026-08-06.** Baseline `4c9cf36`, working-tree diff (15 files, 9,810/1,065),
> reviewed in ONE pass. Three parallel layers, all Opus 5, each blind to the others: **Blind Hunter**
> (diff only, no spec, no ACs), **Edge Case Hunter** (diff + project read), **Acceptance Auditor**
> (diff + spec + 6.5's findings). 25 findings after dedup.
>
> ⭐ **THE GATES ARE REAL.** Every runnable number the Completion Notes print was re-derived by the
> reviewer against the tree and every one matched: lint **0** · Vitest **1183 / 41** · build **0**
> (23 routes, only `/_not-found` static, no `roulette`) · `go build`/`vet`/`test -count=1` clean ·
> `gofmt -l ./worker` **empty** · `--check` **OK ×5** · `ladder-resolve.json` **37/29** ·
> `stage1-pick.json` **17/19** · **0 CRLF** in all five vectors · all ten excluded paths
> byte-untouched · `0025` free · `worker/cmd/qa65b` absent. Two claims remain **unverifiable from the
> tree** and are recorded as such rather than ticked: pgTAP **1155/25** (not re-run by anyone; rests on
> `supabase/**` being untouched, which IS verified) and the `awards` **499** assertion count.
>
> ⭐⭐ **THE ONE-SENTENCE VERDICT.** The story set out to close a vacuous-coverage-guard defect at its
> third occurrence. In the **anchor** it genuinely did — 37/37 `pins_inputs`, real re-derivation
> through the new helpers, arithmetic verified by hand on the flagship rows. But the **consumer
> suites' `claim()` predicates were written weaker than the anchor's guards they mirror**, and several
> narrate properties they do not assert. That is the same defect class, in a new location, introduced
> by the pass that was closing it — which makes it the **fourth** occurrence, not the third.

### Decisions taken at review (Cuatro, 2026-08-06)

**Both decision-needed findings were resolved to PATCH-HERE.** Cuatro took the wider option on each:
all six unpinned boundaries land in this story rather than being split with 6.11, and the `shared`-arm
guard is fixed here rather than homed to 6.6 — even though it is pre-existing and outside DECISION B's
authorised edit set. ⛔ **Consequence, recorded so it is not forgotten: six new vector rows and a
shipped-source change to `stage1.go`/`stage1.ts` RE-OPEN the Task-6 mutation gate and AC10.** The
mutation pass must be re-run (control-green first, bytes not text, SHA-256 restoration, `NOT-APPLIED`
reported separately) and `stage1-pick.json`'s "additions only" property re-checked, before this story
can return to `review`.

- [x] **[Review][Patch→Decision-resolved] Six ladder boundaries are unpinned by any vector row — PATCH ALL SIX HERE (option 1).** — Found independently by the Edge Case Hunter, none named by any AC, so none is a scope violation; all six are real gate holes. **(a)** `n/0` under `direction: min` exists in NO row of `ladder-resolve.json` OR `stage2-resolve.json` — all five zero-denominator rows across both files are `max`, so a mutant that short-circuits "zero denominator ⇒ this player wins" ignoring direction is byte-identical on all 37 ladder + 28 Stage-2 cases, and on `El Inofensivo` hands the trophy to the WORST ratio. **(b)** Refusal groups 5↔6 (`tied` membership before `achievement_ts`) — the only adjacent pair whose wrong order is not a mislabelled refusal but an unhandled fault: Go nil-pointer panics on `byID[sid].AchievementTS`, TS throws a raw `TypeError` instead of a `LadderError`. AC1 pinned 1↔2, 2↔3, 3↔6 and 4↔5; this is the pair with the worst failure mode and it was skipped. **(c)** `n/0` and `0/0` never meet in one rung-2 race, where cross-multiplication makes them EQUAL — an IEEE-flavoured reading narrows to one and returns a different outcome kind AND exit step, invisible everywhere. **(d)** rung 3's dominator never has to beat more than one opponent (every positive rung-3 result is over exactly 2 survivors, where "dominates every other" collapses to "beats the one"). **(e)** the L5 cross-class hazard has a row for volume-award/rate-secondary but not the reverse. **(f)** `achievement_ts` validation being scoped to tied members only is pinned by nothing — the exact shape 6.6 produces (a REDUCED tie against a full roster). ⚠ Each is one row, but together they are a second dev pass and they re-open the Task-6 mutation gate. ⭐ **RESOLVED: option 1 — all six are patched in this story.** The reviewer recommended option 2 (patch the three that change a winner or crash, home the rest); Cuatro took the wider option deliberately, on the ground that 6.6 drives this ladder next and should inherit it whole.
- [x] **[Review][Patch→Decision-resolved] The `shared` arm's per-winner empty-SteamID64 guard is missing, and both languages' comments claim it is there** `[worker/awards/stage1.go:447, lib/roulette/stage1.ts:469]` — The `winner` arm refuses `internal` on `steamid64 == ""` and its comment says *"⛔ SYMMETRIC WITH THE SHARED ARM'S EMPTY-WINNERS GUARD"*. It is not symmetric: the shared arm checks only `len(winners) == 0`. An injected `Ladder` returning `winners: ["", "…022"]` sends `""` to `shelf[""]` → the documented absent-is-shelf-0 rule → **0**, and `min` makes 0 the index for the whole co-win → `table[0] = 100`, the **heaviest** luck weight. `min` is what makes it worse than the single-winner case: one malformed id poisons the aggregate regardless of the real shelves. ⚠ **Pre-existing (6-4b), NOT caused by this diff, and `stage1.go`/`stage1.ts` are outside DECISION B's authorised edit set** — which is exactly why it needs your call rather than a silent patch. Note the near-miss: THIS story added stub-`Ladder` rows for exactly two malformed outcomes (`winners: []` and `winner`+empty id) and stopped one element short of the third. Not reachable in production today (the real ladder never emits an empty id), so this is defence-in-depth for an injected port — the same rationale the `winner` arm's guard already has. ⭐ **RESOLVED: option 1 — fixed here.** ⚠ This is a **THIRD behaviour-adjacent edit to shipped source**, beyond DECISION B's authorised two. It is authorised by Cuatro at review, 2026-08-06, and must be named as such in the Completion Notes rather than folded in silently — DECISION B's whole point is that every such edit is named.

### Patch

- [x] [Review][Patch] TS's new `internal`-producer scan reads RAW source including comments, where its Go twin strips them — a fresh one-sided gate created by this story, and Go's own comment warns against exactly this [lib/roulette/ladder.test.ts:261]
- [x] [Review][Patch] AC6's `spyLadder`-records-`players` item was never ported — `lib/roulette/stage2.test.ts` is byte-untouched by this diff and absent from the Completion Notes' own enumeration [lib/roulette/stage2.test.ts:469]
- [x] [Review][Patch] `toBe(5)` — named verbatim in AC6 — is still a literal, as are four sibling exit-step literals; the constants were applied to `ladder.ts` but not to the suite they were introduced for [lib/roulette/ladder.test.ts:452,713,831,839,1225]
- [x] [Review][Patch] The last `pins_inputs` comparing against a module-global SteamID survived — the literal-survivor-list defect AC4 names by name [roulette/vectors/generate_vectors.py:3717]
- [x] [Review][Patch] The outsider row: Go/TS claims assert only `outsiders >= 1` while their comments promise dominance (only the anchor checks it), AND the row exits at step 1 — so rungs 2-5 never see a roster wider than `tied` in ANY of the 37 cases [worker/awards/ladder_test.go:1163, lib/roulette/ladder.test.ts:712]
- [x] [Review][Patch] Both Go 2^53 claims are weaker than their TS/Python twins: the four-term row counts operands only (not the difference-of-one straddle or the float flip), the timestamp row omits the float-collapse clause TS calls "the whole claim" [worker/awards/ladder_test.go:938,1144]
- [x] [Review][Patch] The `null` `achievement_ts` test is a JavaScript tautology (`null ?? undefined`) that never calls the loader — and NO vector row carries an explicit JSON `null`, so the loader change it protects is exercised by nothing [lib/roulette/ladder.test.ts:600]
- [x] [Review][Patch] The anchor computes `expected` BEFORE `omit_blocks` strips the JSON, so the arbitrating implementation resolves a different input than Go and TS consume; its guard reads the construction directive, not the emitted row [roulette/vectors/generate_vectors.py:5223,5251,4711]
- [x] [Review][Patch] The Stage-2 transcription has ALREADY drifted and the new four-clause test cannot see it: `ladder.ts` uses `'` where `stage2.ts` uses `’`, so the `cause` is observably not the same error; clause 4's non-integer half and `floor_kills < 0` have no row [lib/roulette/ladder.ts:942 vs lib/roulette/stage2.ts:750]
- [x] [Review][Patch] `catalog.test.ts`'s "driven rather than asserted" ladder probe passes when `resolveLadder` does not throw AT ALL, and when the error is not a `LadderError` — nothing asserts a refusal happened [lib/awards/catalog.test.ts:411]
- [x] [Review][Patch] Four new Go/TS claims assert outcome shape only, where the anchor's `pins_inputs` for the same rows re-derive the counterfactual that makes the row load-bearing [lib/roulette/ladder.test.ts:932,967,978,986]
- [x] [Review][Patch] `expect(clauses).toHaveLength(4)` asserts the length of an array literal declared eleven lines above — it cannot fail under any implementation [lib/roulette/ladder.test.ts:597]
- [x] [Review][Patch] The no-mutation-of-inputs test compares steamid64 ORDERING only; an implementation that sorted an `h2h` map or replaced a `RatePair` in place passes, though the stated invariant is far broader [lib/roulette/ladder.test.ts:501]
- [x] [Review][Patch] Prose that does not reconcile, in a story whose thesis is that prose must be held to the data: `catalog.ts` says SIX `kills` ties, `ladder.ts`/README/generator say FIVE real ties, both asserted as measured from the same corpus in the same commit; and the clamp row's note says "seven trophies" where the shelves are 7 and 9 [lib/awards/catalog.ts, roulette/vectors/generate_vectors.py]
- [x] [Review][Patch] Project Structure Notes list `lib/roulette/stage1.ts UPDATE — DECISION B(2)`, but that file is byte-untouched; B(2) landed in the Python anchor. It is the one line a reader checks to answer "did shipped source move?" [_bmad-output/implementation-artifacts/6-5b-fr-29-ladder-vector-and-suite-debt.md:244]

### Deferred

- [x] [Review][Defer] Absent `secondary`/`efficiency` containers are never READ by a configured rung — only `h2h` is [lib/roulette/ladder.ts:325,361] — deferred, pre-existing
- [x] [Review][Defer] `players` supplied as a non-array refuses `player` in TS but `tied` in Go/Python — one input, two labels, at a public entry point 6.6 drives [lib/roulette/ladder.ts:851] — deferred, pre-existing
- [x] [Review][Defer] DECISION B(2) landed at the TOP of `stage1_weight`, normalising both arms rather than the `shared` branch only [roulette/vectors/generate_vectors.py:1683] — deferred, pre-existing
- [x] [Review][Defer] Rung-4 `tsOf` test-loader asymmetry: Go returns false on a missing timestamp, TS does not count it as a sentinel [worker/awards/ladder_test.go] — deferred, pre-existing

### Dismissed (4)

`prng_test.go:913`'s `strings.Contains(src.code, "func ")` positive control (speculative future `doc.go`, no failure path today) · the dead `path != "."` condition in the WalkDir `testdata` guard · the "SET EQUALITY" title over an order-sensitive `toEqual` (the assertion is STRONGER than its title, so the title is wrong in the safe direction) · the three-spellings anchor identity note (the new `written`/`rung_fields` block already closes the actionable half).

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), bmad-dev-story workflow, 2026-08-05/06.

### Debug Log References

- `worker/cmd/qa65b/` — the throwaway AC7 measurement harness (real `ingest.DemoinfocsParser` over
  all 14 `.dem.gz`). **Deleted before commit.**
- `mutate65b.py` — the throwaway Task-6 mutation harness (scratchpad only, never in the tree).
- Structural diff probe: both revisions of `ladder-resolve.json` and `stage1-pick.json` parsed and
  compared row by row, rather than trusting `git diff`'s line alignment.

### Completion Notes List

**⭐⭐ THE HEADLINE: THE REVIEW WAS RIGHT ABOUT `kast_pct`, AND IT WAS RE-MEASURED RATHER THAN
RE-ARGUED.** `catalog.test.ts` hardcoded `kast_pct` as a clone of `kills` while citing a measurement
that says the opposite. The re-run over the real 14-demo corpus (204 counted rounds, 28 distinct
SteamID64) settles it with numbers:

```
kast_rounds == kills                          28/28 players   (the recorded premise HOLDS)
kast_pct    == entry_success  EXACTLY         28/28 players   → a clone, as exact rationals
kast_pct    == kills          EXACTLY          0/28 players
kast_pct    ranks identically to kills         FALSE
entry_frags ranks identically to kills         TRUE
rounds_won  ranks identically to kills         TRUE
opening_deaths ranks identically to deaths     TRUE
6 `kills` ties in the corpus: kast_pct BREAKS 1 · entry_success breaks 1 · entry_frags breaks 0
10 `entry_success` ties:      kast_pct is CONSTANT on all 10  → degenerate there, and only there
```

The cause is arithmetic, not opinion: `kast_pct = kast_rounds / rounds_played` and `rounds_played`
differs across matches, so it CAN break a `kills` tie — which is exactly what the one width-14 tie at
`kills = 9` shows, with 7 distinct values. ⚠ `kast_pct` STAYS in `MEASURED_DEGENERATE` (that set
records "clone of something already seeded", and `entry_success` IS seeded). Only the test's table
was wrong, and the table moved. The clone relation is now **symmetric** and **non-vacuous**.

**⭐ THE ANCHOR CHANGED FIRST, AND THE PROOF IS STRUCTURAL RATHER THAN A CLAIM.** DECISION C held:
`generate_vectors.py` gained every fixture and every case before either runtime was touched, and both
runtimes were then written against the regenerated file. Parsing both revisions and comparing row by
row:

```
ladder-resolve.json   24 cases / 19 refusals  ->  37 / 29
                      pre-existing CASES changed: NONE
                      pre-existing REFUSALS changed: NONE
                      top-level keys changed: ['spec']   (and only `spec`)
stage1-pick.json      16 cases / 19 refusals  ->  17 / 19
                      pre-existing CASES changed: NONE
                      top-level keys changed: NONE       (pure ADDITION: 373 insertions, 0 deletions)
prng-block.json · prng-uniform-int.json · stage2-resolve.json   BYTE-IDENTICAL (absent from git diff)
```

**⭐ AC1 — THE PUBLISHED ORDER IS SIX GROUPS, NOT FOUR, AND THE DOCUMENT MOVED RATHER THAN THE CODE.**
Cuatro's call was *amend the published spec, do not move the code*, and the code was right: the
duplicate-`players` scan is part of BUILDING the index that the tied-membership check then READS, so
it necessarily refuses as `player` BEFORE membership refuses as `tied`. The `spec` string, the
anchor's `_validate_ladder` docstring and both runtimes' `validateLadder` docstrings now publish
`stage2 → award → tied(shape) → player(index) → tied(membership) → player(achievement_ts)`. Five new
refusal rows hold them to it, including the single-defect duplicate-`players` row — a guard that was
live in all three implementations and **deletable in every one of them with every gate green**.

⚠ **ONE LIMIT STATED PLAINLY RATHER THAN PAPERED OVER.** The third adjacent boundary AC1 names — the
id-shape / duplicate / order checks *inside* the `tied` group — is **not discriminable by a vector
row**, because all three refuse as `tied` by construction and a closed set of five labels has nothing
finer to say. The row exists and pins that all three implementations refuse it as `tied` rather than
resolving, sorting or landing in a neighbouring group; the intra-group order stays unobservable, and
that is a property of the contract rather than a gap in the coverage.

**⭐ AC2 — RUNG 2's DEFINING PROPERTY IS EXERCISED FOR THE FIRST TIME.** Every previous rung-2 row
named VOLUME keys in both slots, and `snapshot_efficiency_form` gives a volume `v` the pair `{v, 1}` —
so two of the four factors were the literal `1`, and an implementation that dropped both the `.den`
and `.num` factors was **byte-identical on all 24 committed cases, the 2^53 row included**. The new
row puts RATE keys in both slots (`adr` over `entry_success`), so all four factors are non-trivial and
the drop-both mutant picks the other player. Rung 2 also gained a `min` row, a
narrows-without-resolving row, the `0/0` uneliminable row the D1 decision promised, and rows for
`efficiencyPair`'s absent-key and not-a-pair refusals.

⚠ **THE NOT-A-PAIR ROW FORCED A RENDERER CHANGE, AND IT IS WHY THE REFUSAL HAD NO ROW ANYWHERE.**
`_render_ladder_player` emitted `efficiency` through a hand-written `{num, den}` comprehension that
would have raised on a non-pair before it could write one. It now uses `_render_class_shaped`, the
same renderer `secondary` and `h2h` already used — byte-identical on every honest row (the
regeneration proves it), and able to write the one shape the guard is about. Both test loaders were
widened to match.

**⭐ AC3 — THREE PRECEDENCE HOLES CLOSED, AND TWO OF THEM CHANGE THE WINNER, NOT ONLY THE STEP.**
Rung 4's narrowing was never load-bearing (every committed rung-4 case had `narrowed == present ==
survivors`), so an implementation that SKIPPED rung 4 whenever it could not resolve would have handed
a co-winner's trophy to a player with **no approved rows at all**. Rungs 1 and 2 never returned past a
configured later rung, so falling through returned the same winner at a **fabricated** exit step — and
in the rung-2 row, rung 3 crowns the OTHER player, so it is a different winner too. Rung 3 never ran
over a narrowed set, so computing dominators over the original `tied` was byte-identical everywhere.

**⭐ AC4 — THE COVERAGE-GUARD DEFECT AT ITS THIRD OCCURRENCE, AND WHAT WAS ACTUALLY FOUND.** Measured
rather than assumed: the four rows the review named as *unguarded* had in fact gained `pins_inputs`
guards in 6.5's own commit — the review was written against an earlier state. What was genuinely
missing, and is now fixed:

- the flagship `rung-2-four-term-products-past-2-pow-53` guard re-derived only *"the operands exceed
  2^53"*, which is true of any pair of large numbers. It now re-derives that the **cross products
  straddle a difference of exactly one** and that a **double-rounded compare flips the winner**;
- **ten of the twenty-four** cases carried no input guard at all — every one now does;
- three guards hardcoded `"max"`, `"hs_pct"`, `"kills"` or the literal survivor list `[S_A, S_B]`;
  all now read `c["award"]["direction"]` and the row's own keys through new `_by_id` / `_rung2_ratio`
  / `_rung1_best` / `_dominators_over` / `_earliest_holder` helpers;
- the `stage1-pick.json` co-winner guard read the module globals `SHELF` and `TABLE`; it now reads
  `c["shelf"]` and `c["table"]`;
- the three-absence-spellings guard **could not fail** — it compared three outcomes each row's own
  `pins` had already asserted a moment earlier. It now also asserts the three rows still spell absence
  three DIFFERENT ways, which is falsifiable and is the property the row set exists for.

**⭐ AC5/AC6 — THE CLOSED SET IS NOW INSPECTED, AND THE ONE-SIDED GATES ARE CLOSED IN BOTH
DIRECTIONS.** Both ladder suites gained the representable/unrepresentable detail split copied from
`stage1_test.go:511-524` / `stage1.test.ts:405-423` — before it, **every `award` row, or every
`player` row, could have been deleted and only "the array is non-empty" would have noticed**.
`internal` now carries its declaration in both languages with **both** producers named separately,
because their arguments genuinely differ: rung 3's plural dominator by **ANTISYMMETRY**, the empty
best set by **ACYCLICITY** (strictly weaker, and the property the negative-magnitude refusals
protect). TypeScript gained the `stage2` propagation unwrap, a non-mutation-of-inputs test, a
non-decimal `steamid64` row, a `classOfStatKey` probe over all 21 keys, `OUTCOME_KINDS` by set
equality, and exit-step **module constants** to pin the vector against; Go gained `algo_version`, and
its port test now compares the WHOLE outcome with `reflect.DeepEqual` — it was field-selective, so a
port fabricating a `DecidingValue` survived the entire Go suite while TypeScript's `toEqual` caught it.

⚠ **DECISION B, AND A THIRD EDIT NAMED RATHER THAN SMUGGLED.** The two authorised behaviour-adjacent
edits landed: `ladder.ts`'s `stage2` propagation now attaches a `Stage2Error` as its `cause` (without
it the new gate is vacuous — a TS implementation that swallowed the propagation passed every refusal
row), and `stage1_weight` in the anchor normalises a `None` shelf. The third is **not**
behaviour-adjacent and is stated for the record: `ladder.ts` gained exported `LADDER_EXIT_*`
constants, and the five call sites now use them instead of the literals `1..5`. AC6 requires them —
the TS suite had nothing for the vector to be pinned against — and they cannot change behaviour.

**⭐ AC8 — THE REMAINING GAPS, EACH TRACED TO ITS UNEXERCISED PATH.** A `class: rate` award at rung 3
(there were **zero** in the file, though four of the twelve shipped awards are `rate`);
`achievement_ts` at **0** (so a `ts <= 0` filter is finally visible) and past **2^53** (where a
`Number`-parsing verifier reads both values as 2^53, ties, and bottoms out **shared at step 5** — a
different outcome *kind*); a player who is **not in `tied`**; an **absent-container** row; all four
clauses of TypeScript's transcribed Stage-2 award surface; Stage 1's two `internal` port guards driven
by a **stub `Ladder`** in both languages, each with a well-formed control so the assertions cannot
pass over a stub that is never consulted; and the Go pinning weaknesses — the source scan is now
**recursive**, the import bans have a **positive control** and a non-vacuity assertion, and the
`math/big` exemption list is asserted non-vacuous (every exempted file must exist AND actually import
it).

**⭐ AC9 — EVERY DOCUMENT THIS STORY'S MEASUREMENTS FALSIFIED IS CORRECTED AT ITS SITE.**
*"SHARED TROPHIES WILL BE COMMON"* is corrected in **all four** places — `README.md`,
`generate_vectors.py`, `ladder.go:68` and `ladder.ts:63` — with the distinction the measurement
actually supports: the **mechanism** is real (14 of 14 duel pairs carry a byte-identical
`achievement_ts`) and the **outcome** is unreachable on this corpus (0 of 5 real ties contains a duel
pair; 0 of 12 awards end shared). `ROW_REPRESENTABLE_DETAILS`'s *"nine"/"seven"* became the real
**ten/eight**, with `assert` statements so the prose fails with the code rather than beside it. The
README's *"branch on the JSON SHAPE, never on the vocabulary"* is reconciled: that rule is for the two
**loaders**; the three **resolvers** deliberately do the opposite, and that disagreement IS L5.
`_stat_value`'s *"0024 writes all 21 keys into every block"* is corrected — the DATABASE does, the
FIXTURES write exactly one key each, and that is deliberate, because otherwise the absent-key refusal
would be unreachable from any row.

**⚠ T7 IS A NUMBERING SLIP, MEASURED NOT GUESSED.** Grepping `6-5-fr-29-tie-ladder.md` for `T7`
returns exactly **one** line — the closing paragraph that says it is still owed. The findings run
T1–T6, T8, T9, T10: nine themes with no T7 among them. Recorded once and moved past, per Cuatro's
answer to Question 2, rather than manufacturing a tenth finding to fill the hole.

**⚠ THE `stage1-pick.json` FIGURE, WITH ITS METHOD.** 6.5 printed *"489 insertions against 1
deletion"*, which matches no measurement. Two honest numbers, each with its method:
`git diff --numstat ad8b649..4c9cf36` gives **1528 / 428** (git's own alignment re-splits the JSON);
a **minimal difflib alignment** over the two revisions' lines gives **1101 insertions / 1 deletion**,
and that single deletion is `"internal"` gaining a comma for the appended `"ladder"`. The SUBSTANCE
was re-verified true. The wrong number has been removed from 6.5's notes and replaced there with both
of these.

**⭐⭐ AC10 — THE MUTATION PASS, AND ITS FIRST RUN CAUGHT THE 6-4a CRLF TRAP ON ITSELF.** 30 mutation
themes × the languages that can express them = **51 applications**. Control pass on unmutated source
GREEN before anything was touched (the run is void otherwise), every file read and written as
**BYTES**, the **whole** vector-driven test set per mutation (never a `-run` filter), and restoration
verified by **SHA-256** on all five vector files plus every touched source file — `ALL RESTORED` on
every run.

⚠ **RUN 1 REPORTED 33 OF 51 AS `NOT-APPLIED`, AND THAT IS THE HARNESS WORKING.** The files are CRLF
on disk; the multi-line anchors were written with `\n`, so they matched nothing. This is *exactly*
6-4a's failure — a harness that silently un-applied 12 of 18 Go anchors and reported them as
`killed`. Because `NOT-APPLIED` is a separate outcome here rather than folded into `killed`, the run
said so instead of lying. Run 2 rewrites each anchor into the file's own line-ending convention
before searching, and still refuses to apply anything that does not match **exactly once**.

**FINAL: 51 applications · 47 KILLED · 4 SURVIVED · 0 NOT-APPLIED.** The four survivors are **two
themes**, and neither is a vector gap. Both are reported rather than counted:

- **`M07 — rung 1 running over `tied` instead of `survivors`` (Go + TS) is a BEHAVIOURAL NO-OP.**
  `survivors` is initialised as a fresh copy of `tied` immediately above rung 1, so the two
  expressions are the same value at that point. There is no behaviour to mutate. It belongs with the
  two harness defects 6.5 reported as harness defects, not with the real mutations. ⚠ The property it
  was aiming at — L3 at rungs 2, 3 and 4 — IS killed, by `M03`, `M04` and `M06`, all of which this
  story's new rows made killable.
- **`M23 — deleting `efficiencyPair`'s ABSENT-KEY guard` (Go + TS) is a RECORDED LIMITATION, and the
  row this story added for it does NOT kill it.** Stated plainly because AC10 requires it: *a new row
  that kills nothing is a row that proves nothing.* Deleting the absent-key check leaves `pair` at
  Go's zero `RatePair{}` / TypeScript's `undefined`, and **the very next guard refuses the same input
  with the same `detail` (`player`)**. Two adjacent guards that are indistinguishable through a
  five-label closed set cannot be separated by any vector row — messages are not contract, details
  are. This is the identical shape 6.5 recorded for its class-mismatch guard, and it is a property of
  the contract rather than a coverage gap. ⭐ What the row DOES prove, and what nothing proved before
  it, is that all three implementations refuse that input as `player` rather than reading the absent
  key as a zero — which is the three-way agreement this directory exists for.

⭐ **THE SIX MUTATIONS AC2–AC4 NAME BY NAME ARE ALL KILLED, AND ALL SIX SURVIVED AT `4c9cf36`:** rung
2 dropping both the `.Den`/`.Num` factors (`M01`) · rung 2 hardcoding `max` (`M02`) · rung 2's
narrowing line deleted (`M03`) · rung 4 skipping instead of narrowing (`M04`) · rung 1 falling through
to a fabricated exit step (`M05`) · rung 3 computing dominators over the original `tied` (`M06`). Also
killed and previously invisible: the `ts <= 0` absent-filter (`M25`), the TS `stage2` propagation
swallowing its cause (`M28`), the shared-arm W8 clamp removed (`M29`), the TS exit-step constants
renumbered (`M30`), and the duplicate-`players` guard deleted (`M22`).

**⚠ A PRE-EXISTING FLAKE, MEASURED AT THE BASELINE RATHER THAN BLAMED ON THIS STORY.** Under full
`npm test` load, `prng.test.ts`'s `real-seed/spin1/i255` (and sometimes `i256`) times out at Vitest's
5 s default — those cases perform 256 sequential HMAC blocks. It was reproduced **at `4c9cf36` with
this story's changes stashed**: 1118 passed / 1119, same failure, same file. In isolation
(`npx vitest run lib/roulette/prng.test.ts`) it passes in ~2 s, and `npx vitest run lib/` — the same
41 files — passes **1183/1183**. It is an environment-timing flake, not a regression, and
`prng.test.ts`'s timeout is deliberately left untouched: it is outside this story's scope and 6.5's
recorded gate did not flag it.

**GATES (MEASURED AT SIGN-OFF, NOT QUOTED).** Every number below was printed by the command named
next to it, after the last change:

```
npm run lint                       0                       (eslint . — no output)
npx vitest run                     1183 across 41 files    (baseline MEASURED at 1119/41 → +64)
npm run build                      0 errors; every viewer route ƒ dynamic; NO `roulette` route
cd worker; go build ./...          clean
            go vet ./...           clean
            go test ./... -count=1 clean; `awards` 499 assertions (baseline MEASURED at 443 → +56)
gofmt -l ./worker                  EMPTY
generate_vectors.py --check        OK on ALL FIVE
  prng-block.json · prng-uniform-int.json · stage2-resolve.json   ABSENT from `git diff` → BYTE-IDENTICAL
  ladder-resolve.json                                             6716 / 868 (the `spec` string moves bytes)
  stage1-pick.json                                                373 / 0   → ADDITIONS ONLY
CRLF count in all five vectors     0 · 0 · 0 · 0 · 0       (vectors are DATA: LF, 2-space, stable order)
0025                               FREE
supabase/** app/** lib/{ceremony,i18n,bracket,steam}/** worker/{ingest,store,db,config}/**
                                   BYTE-UNTOUCHED (`git status --porcelain -- …` prints nothing)
worker/cmd/qa65b/                  DELETED; worker/cmd/qa54 untouched, no second orphan added
```

⚠ **pgTAP — NOT RE-RUN, AND THAT IS STATED RATHER THAN QUOTED.** DECISION A held: this story writes
nothing to the database, and `git status --porcelain -- supabase` prints **nothing**, so the 1155/25
baseline rests on `supabase/**` being byte-untouched rather than on a re-run. The local stack was not
brought up (the AC7 probe reads `.dem.gz` through the real parser and needs no database), so claiming
a green pgTAP run would have been narration.

⚠ **ONE CRLF INCIDENT, CAUGHT AND FIXED RATHER THAN SHIPPED.** Probing whether the `prng.test.ts`
timeout was pre-existing required a `git stash push` / `git stash pop` round trip, and git's
`autocrlf` restored the two regenerated vector files with **CRLF** line endings — which `--check`
immediately reported as DRIFT. Regenerating restored LF, and the counts above (`0` CRLF in all five)
are the proof. Recorded because it is the same class of hazard as 6-4a's mutation-harness defect, in
a different tool.

### File List

```
roulette/vectors/generate_vectors.py          UPDATE  13 cases + 10 refusals + 5 guard helpers; the amended
                                                      spec string and 6 docstring/comment corrections; the
                                                      class-shaped efficiency renderer + `omit_blocks`; the
                                                      shared-arm clamp Stage-1 row; `stage1_weight`'s shelf guard
roulette/vectors/ladder-resolve.json          UPDATE  regenerated — 24/19 -> 37/29 rows, `spec` amended
roulette/vectors/stage1-pick.json             UPDATE  regenerated — ADDITIONS ONLY (373/0), 16 -> 17 cases
roulette/vectors/README.md                    UPDATE  the six-group order, both `internal` producers, the four
                                                      doc corrections, and a table row per new vector row
worker/awards/ladder.go                       UPDATE  comments + the amended docstring ONLY (no behaviour)
worker/awards/ladder_test.go                  UPDATE  class-shaped + nil-preserving loader, 13 case names,
                                                      the detail split, both `internal` producers, 13 new
                                                      claims, 3 tightened claims, DeepEqual port comparison
worker/awards/stage1_test.go                  UPDATE  the stub-`Ladder` rows for the two `internal` port
                                                      guards + a control; the new Stage-1 case name
worker/awards/prng_test.go                    UPDATE  recursive source scan, positive control, non-vacuity on
                                                      the import bans and on the math/big exemption list
lib/roulette/ladder.ts                        UPDATE  DECISION B(1) the `cause`; the LADDER_EXIT_* constants;
                                                      comments + the amended docstring
lib/roulette/ladder.test.ts                   UPDATE  optional/class-shaped loader, 13 case names, the detail
                                                      split, both `internal` producers, the four AC6 gates,
                                                      the four-clause Stage-2 surface check, 13 new claims
lib/roulette/stage1.test.ts                   UPDATE  the stub-`Ladder` rows + control; the new case name
lib/awards/catalog.ts                         UPDATE  the re-measurement recorded at MEASURED_DEGENERATE
lib/awards/catalog.test.ts                    UPDATE  the re-measured SYMMETRIC clone table, the vacuity
                                                      closure, the rung-2 key rules, and the tautology
                                                      replaced by driving the SHIPPED ladder
_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md   UPDATE  nine findings ticked; T9c/T9f/T9g/T7
_bmad-output/implementation-artifacts/sprint-status.yaml        UPDATE
```

Deleted before commit (never in the tree at sign-off): `worker/cmd/qa65b/`. `worker/cmd/qa54` is
untouched and no second orphan was added.

⛔ **NOT TOUCHED, and `git status` proves it:** `supabase/**` (so `0025` is still FREE), `app/**`,
`lib/ceremony|i18n|bracket|steam/**`, `worker/ingest|store|db|config/**`.

### Change Log

| Date | Change |
|---|---|
| 2026-08-05 | Story contexted (bmad-create-story) → ready-for-dev. Baseline `4c9cf36` (6.5 implemented + Group 1 patches + T1 applied, nine findings outstanding). Carved out of 6.5 rather than folded into 6.6 so the anti-sweep story does not inherit an ungated ladder. |
| 2026-08-05 | Baselines MEASURED before the first change (6.1 quoted stale numbers; this did not): Vitest **1119 across 41 files**, `go test ./...` clean, and the five vector files' byte sizes recorded. |
| 2026-08-06 | AC7's `kast_pct` question RE-MEASURED over the real 14-demo corpus rather than re-argued (throwaway `worker/cmd/qa65b`, deleted before commit). The review was right: `kast_pct` is an exact clone of `entry_success` on 28/28 players and is NOT a rank-clone of `kills`; it breaks 1 of the corpus's 6 `kills` ties where `entry_frags` breaks 0. `catalog.test.ts`'s table moved; `MEASURED_DEGENERATE` did not. |
| 2026-08-06 | ⭐ Mutation pass, TWO RUNS. Run 1 reported **33 of 51 NOT-APPLIED** — the anchors were `\n` and the files are CRLF, which is 6-4a's exact failure mode caught by the harness instead of hidden by it. Run 2 (CRLF-aware, still exact-once) gave **47 killed · 4 SURVIVED · 0 NOT-APPLIED**, control green, SHA-256 restoration clean. The four survivors are two themes and neither is a vector gap: rung 1 over `tied` is a behavioural NO-OP (`survivors` is a fresh copy of `tied` one line above), and `efficiencyPair`'s absent-key guard is indistinguishable from the guard directly below it because both refuse the same input with the same `detail` — a recorded limitation, reported rather than counted. |
| 2026-08-06 | CODE REVIEW (bmad-code-review, 3 parallel adversarial layers, all Opus 5, baseline `4c9cf36`, ~9,810 lines). 25 findings after dedup: 2 decision-needed, 15 patch, 4 deferred, 4 dismissed. ⭐ Every gate re-derived independently and every one MATCHES the author's printed numbers (lint 0 · Vitest 1183/41 · build 0 · Go clean · gofmt empty · `--check` OK ×5 · 37/29 and 17/19 rows · 0 CRLF ×5 · scope byte-untouched · `0025` free · `qa65b` absent). AC1, AC2, AC3, AC5, AC8, AC9 MET; AC4, AC6, AC10 PARTIAL; AC7's guard MET but its measurement UNVERIFIABLE (harness deleted). The headline: this pass closed the vacuous-guard defect in the anchor and re-opened it in the two consumer suites. |
| 2026-08-06 | Implemented, ANCHOR FIRST (DECISION C): `generate_vectors.py` gained 13 cases, 10 refusals, five guard helpers and the six-group `spec` string before either runtime was touched. `ladder-resolve.json` 24/19 → **37/29** and `stage1-pick.json` 16 → **17 cases by ADDITION ONLY (373/0)**, with every pre-existing row in both files proved byte-identical by parsing both revisions. `prng-block.json`, `prng-uniform-int.json` and `stage2-resolve.json` are byte-unmoved. Both suites levelled, `catalog.test.ts`'s clone guard rewritten against the measurement, and the nine outstanding findings in 6.5's file ticked with T9c/T9f/T9g/T7 settled. Status → review. |
| 2026-08-06 | ⭐⭐ AC10 DISCHARGED — the full mutation set RE-RUN after the review patches, and the harness rebuilt rather than quoted (`mutate65b.py` was scratchpad-only and is gone, so its 51 applications cannot be re-executed byte for byte; that is stated, not glossed). 42 applications over every rung, every narrowing, every refusal guard, both loaders and the Stage-1 arms, in both languages wherever expressible: **38 KILLED · 4 SURVIVED · 0 NOT-APPLIED**, control pass green FIRST, bytes not text, anchors rewritten into each file''s own line endings, exact-once matching, whole test set per mutation, and restoration proved by `git status` clean rather than by SHA-256 alone. The four survivors are THREE reasons and no coverage hole: `M08` rung 3''s plural-dominator refusal is a behavioural no-op unreachable BY ANTISYMMETRY (the `internal` producer both suites already declare); `M16` the duplicate-`tied` guard is caught by the byte-lex ORDER guard below it with the SAME `detail`, verified on the adjacent AND non-adjacent shapes — the closed-set limitation refusal #23 already documents; and `M20` is a DELIBERATE NEGATIVE CONTROL that MUST survive, because a refusal-message edit reddening anything would mean the gates are pinned to prose rather than to the typed error and its `detail`. Story 6-5b -> done. |
