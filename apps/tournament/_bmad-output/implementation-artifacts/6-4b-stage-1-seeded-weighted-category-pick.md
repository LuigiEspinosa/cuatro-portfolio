---
baseline_commit: 9ccb832e19671e0c6a974ed8f0796122c07427bd
---

# Story 6.4b: Stage-1 seeded weighted category pick

Status: done

> **Story 6.4 was contexted whole, measured at roughly 2× Story 6.3, and split by Cuatro (2026-08-04)
> into 6-4a and 6-4b** — the same call that split 4.6. **6-4a is done** (`9ccb832`, code-reviewed, 20
> patches applied). This is the second half, and the seam between them is forced rather than cosmetic:
> the Stage-1 weight is `luck_weight_table[min(shelf[provisional_winner(a)], table_max)]` and
> `provisional_winner(a)` **is 6-4a's resolver** (SOLUTION-DESIGN §9.6 prescribes the same order
> independently).
>
> **This is the story that decides WHICH category goes live** — and it is the first story in the epic
> that *consumes the stream*. Every byte it draws moves the position for every later spin, every later
> story, and the browser verifier. A pick that is right and a byte-count that is wrong is still a
> broken ceremony.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **fifth story of the epic, second half of the split**
Traces: **FR-25** (Stage-1 half) · **FR-26** (the luck-meter bias half) · **AD-14** · SOLUTION-DESIGN §9.2 · **§9.6 GATE 3** · SPEC Constraint 7
Consumes: 6.3's `Stream` / `UniformInt` / `Stage1Label` · **6-4a's `ResolveStage2` as `provisional_winner`** · 6.2's frozen snapshot · 6.1's catalog projection
Hands to: 6.6 (anti-sweep + `luck_weight_table` population + `assigned_this_spin`), 6.7 (pity), 6.8 (persistence, `spin.live_award_ids`, the reveal axis), 6.9 (the browser verifier), 6.11 (end-to-end vector)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want each spin's live category chosen by seeded luck that leans toward players with empty shelves,
so that the ceremony is dramatic, biased in the underdog's favour, and still reproducible byte-for-byte in my own browser.

## Acceptance Criteria

**AC1 — the weight is a pure integer function of the FROZEN shelf and the published table, and a candidate with no single provisional winner REFUSES rather than guesses.**
**Given** the Stage-1 weight rule ([epics.md:1066](_bmad-output/planning-artifacts/epics.md#L1066); AD-14 `ARCHITECTURE-SPINE.md:148`; the luck-meter surface `:218`; SOLUTION-DESIGN §9.2 `:406-411`; FR-26),
**When** a spin's candidate pool is weighted,
**Then** each candidate `a` gets `luck_weight_table[min(shelf[provisional_winner(a)], table_max)]` where `table_max = len(table) - 1`, an **empty shelf yields the heaviest weight** (index `0`), `provisional_winner(a)` is **6-4a's `ResolveStage2` over the frozen snapshot** (never a re-derivation, never `stat_row`, never `public.leaderboard`), the shelf map is **frozen at spin start** and is not recomputed between the `live_count` picks of one spin, the table is validated non-empty / strictly decreasing / all `> 0` before any draw, and a candidate whose Stage-2 outcome is a **tie** produces a **typed refusal naming Story 6.5** — never a min-shelf, byte-lex-first, or lowest-SteamID64 stand-in.

**AC2 — the pick is stream-driven, and its BYTE CONSUMPTION is part of the contract, not a side effect.**
**Given** the unbiased-draw contract (AD-14; SOLUTION-DESIGN §9.1 `:402-404`; 6.3's `roulette/vectors/prng-uniform-int.json`),
**When** `live_count` awards are picked for spin `S`,
**Then** the stream is the one 6.3 built for `inclusivcup/v1/stage1/spin/<S>` (1-based, its own counter from 0), each pick is `r = uniform_int(stream, total_weight)` followed by a cumulative walk over candidates in **ascending `award.priority`** selecting the first whose running cumulative is **strictly greater than `r`**, a `live_count > 1` spin **removes the picked candidate and re-draws against the RECOMPUTED total** (never reusing the first draw's remainder), an empty pool / `live_count < 1` / `live_count > len(pool)` are **typed refusals** rather than a short return, and both runtimes report the stream's cumulative position after every draw so "identical bytes" is an assertion rather than a claim.

**AC3 — §9.6 GATE 3 lands: the pick is proven by a shared, third-implementation-anchored vector.**
**Given** *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build"* (AD-14) and §9.6's gate 3 (*weighted pick*), which [roulette/vectors/README.md:36](roulette/vectors/README.md#L36) still records as **⏳ not yet, Story 6-4b**,
**When** the build runs,
**Then** `roulette/vectors/stage1-pick.json` carries language-neutral golden JSON covering at minimum: the **shelf→weight mapping itself** (including `min(shelf, table_max)` clamping and the empty-shelf heaviest case), a draw whose **`r` lands exactly on a cumulative boundary**, a `live_count = 2` **re-draw**, a **single-candidate** pool, a `total_weight = 1` pool (the only `n = 1`, and therefore the only **zero-byte** draw), a **candidates-supplied-out-of-priority-order** case, and a `refusals` array; **both** the Go suite and the Vitest suite read **that same file**; every expected value — pick, weight, and `bytes_consumed_after` — is produced by the committed third implementation (`roulette/vectors/generate_vectors.py --check`); and the README ownership table is updated to record gate 3 as shipped.

**AC4 — Stage 1 is exercised over the REAL seed, the REAL snapshot and the REAL catalog, and the consequence of 6-4a's measurements is answered with numbers.**
**Given** the project's THE BAR discipline and 6-4a's measured hand-off (*"ties are common on real data — 5 of 12 awards, widths 2–3"*, and *"all twelve awards resolve to `no_eligible_players` on the real bracket shape"*),
**When** the story is signed off,
**Then** both runtimes run a **full multi-spin Stage-1 sequence** over the real frozen `fair_seed` (`1b3cd678…3279c`), the real captured `stat_snapshot_row` set and the real 12-award catalog, their transcripts — picks, weights, `r`, and cumulative byte positions — are diffed **mechanically** (files + `Compare-Object` + SHA-256), and Completion Notes record **measured**: the drawn category order for the real corpus, the exact byte cost of a 12-spin ceremony, how many candidates the tie refusal fires on in the floors-0 counterfactual, and whether a ceremony can complete at all today — a pass is a printed number, not a claim.

## Tasks / Subtasks

> Build order inside the story: Task 0 (read) → Task 1 (pin the edge semantics) → Task 2 (the vector seam)
> → Task 3 (first language) → Task 4 (second language) → **Task 5 (THE BAR) gates sign-off** → Task 6
> (mutation) → Task 7 (gates). **Write the vector before the second implementation** so the second one is
> written against a fixed artifact, not against the first one's source.

- [x] **Task 0 — Read before you write**
  - [x] [SOLUTION-DESIGN §9.2](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L406) (Stage 1, six lines that carry the whole algorithm), **§9.1** (`:393-404`, the draw you consume) and **§9.6** (`:440-449`, gate 3 and the build order that puts this story after 6-4a).
  - [x] [ARCHITECTURE-SPINE.md:148 (AD-14)](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148) and **`:218`** (Stage 1 on the Provably-Fair contract surface — *"integer weights … indexed by the provisional winner's current shelf size"*), plus `:471` (the weight table and spin plan are **organizer config**, not code).
  - [x] ⭐ [worker/awards/stage2.go](worker/awards/stage2.go) and [lib/roulette/stage2.ts](lib/roulette/stage2.ts) — **the four-arm `Outcome` is your input contract.** `winner` | `tie` | `no_eligible_players` | `no_awardable_value`. `ResolveStage2` / `resolveStage2` is the pure stage and is exported **specifically for you** (`stage2.go:280-284`: *"6-4b needs the raw outcome — a tied award has no single `provisional_winner`, and Stage 1 must SEE that"*). Do **not** call `ResolveAward`/`resolveAward`: that hands your tie to the refusing ladder and you get an error you cannot inspect.
  - [x] [worker/awards/prng.go](worker/awards/prng.go) + [lib/roulette/prng.ts](lib/roulette/prng.ts) — `NewStream(seed [32]byte, label) (*Stream, error)` / `createStream(seed, label): Promise<Stream>`; `UniformInt(s, n uint64) (uint64, error)` / **`uniformInt(stream, n): Promise<number>`**; `Consumed()` / `.consumed`; `N_BOUNDS.MAX = MaxN = 2^32`. ⚠ Read the reentrancy notes (`prng.ts:88-92, 236-244`) before you write a single `await`.
  - [x] [worker/awards/labels.go:54](worker/awards/labels.go#L54) `Stage1Label(spin int) (string, error)` / [lib/roulette/labels.ts:41](lib/roulette/labels.ts#L41) `stage1Label(spin)` — **1-based**, refuses spin 0. You build the stream from this, never from a hand-written string.
  - [x] [roulette/vectors/README.md](roulette/vectors/README.md) — the whole file, but especially the ownership table (`:31-38`, gate 3 is yours), the integer-only / decimal-string rule (`:54-60`), and how each runtime loads the files (`:327-333`).
  - [x] [roulette/vectors/generate_vectors.py](roulette/vectors/generate_vectors.py) — it already has `Stream`, `uniform_int`, `resolve_stage2`, `_validate_award`, `_p(...)`, `build_stage2_file()` and a byte-comparing `--check`. You are **extending** it, not writing a second generator.
  - [x] [lib/awards/catalog.ts](lib/awards/catalog.ts) + [supabase/migrations/0023_award_catalog.sql:63-156](supabase/migrations/0023_award_catalog.sql#L63) — `priority` is `UNIQUE(tournament_id, priority)` and **that is what makes "ascending priority" a total order**. ⚠ `lib/awards/catalog.ts` is `import 'server-only'`; `lib/roulette/**` must never import it (see DECISION D).
  - [x] [supabase/migrations/0024_ceremony_lock_snapshot.sql:664-737](supabase/migrations/0024_ceremony_lock_snapshot.sql#L664) — the snapshot payload you hand to `ResolveStage2`, and `:909-923` for the two comments that change its meaning.
  - [x] Sweep-prove the greenfield claim before writing a line: nothing in the repo implements a weighted pick, a shelf lookup, a weight table or a Stage-1 selector. (Confirmed at contexting: the only files matching `stage1|weighted|shelf` are `labels.*`, the two `prng` suites and `test/source-scan.ts` — **re-confirm, do not assume.**)

- [x] **Task 1 — Pin the edge semantics IN CODE COMMENTS before implementing (AC: 1, 2)**
  > Same discipline as 6.3's E1–E4 and 6-4a's S1–S7, and for the same reason: each is a place where two
  > honest implementers reading the same sentence draw a different byte. Each gets a vector row in Task 2
  > and a named comment at its implementation site **in both languages**.
  - [x] **W1 — the shelf is FROZEN at spin start.** SOLUTION-DESIGN:411 — *"shelf is frozen at spin start for weighting"*. With `live_count > 1`, the second pick uses the **same** shelf as the first even though the first award is about to be awarded. Recomputing between picks makes the ceremony depend on resolution order and is unverifiable from the bundle. The shelf is an **injected map**, never read from a DB inside this module.
  - [x] **W2 — candidates are walked in ascending `award.priority`, and that order is TOTAL.** `UNIQUE(tournament_id, priority)` (`0023`, SOLUTION-DESIGN:172) is what guarantees no ties in the walk order. **Assert it** — a duplicate priority in the input is a refusal, not a stable-sort coin flip.
  - [x] **W3 — `r = uniform_int(stream, total_weight)`, then the first candidate whose running cumulative is STRICTLY GREATER than `r`.** ⭐ **Pin `>` vs `>=` at the site.** With weights `[3, 2]` and `r = 3`: `>` gives the second candidate (correct — `r ∈ {0,1,2}` → first, `{3,4}` → second); `>=` gives the first and silently hands it 4/5 of the probability mass. The off-by-one is invisible in the result *shape* and shifts every award. This is the story's `exact-threshold-rejection-x-equals-limit` (6.3's review found that exact class surviving the **entire suite in both languages**), so it needs a vector row whose `r` lands **exactly on a boundary**.
  - [x] **W4 — `live_count > 1` removes the picked candidate and RE-DRAWS against the recomputed total.** Never `r - cumulative`, never a second walk over the first draw's remainder. Two draws means two `uniform_int` calls and two byte movements, and the vector's `bytes_consumed_after` is what proves it.
  - [x] **W5 — there is NO single-candidate short-circuit (DECISION G).** The draw is always `uniform_int(stream, total_weight)`. A one-candidate pool of weight `100` still draws `n = 100` and still consumes a byte. `n = 1` — and therefore E1's **zero-byte** draw — arises only when `total_weight == 1` (one candidate sitting on the table's smallest entry). Both halves get their own vector row. ⚠ This **corrects** the contexting note carried in `sprint-status.yaml` ("a single-candidate pool means `n=1`"); record the correction in Completion Notes rather than silently implementing one or the other.
  - [x] **W6 — an empty pool, `live_count < 1`, `live_count > len(pool)` and a duplicate award id are TYPED REFUSALS.** Never a short return, never a clamp. A short return produces a spin with fewer live categories than the plan promised, and nothing downstream can tell that from a plan that asked for fewer.
  - [x] **W7 — validate the table BEFORE any draw: non-empty, strictly decreasing, every entry `> 0`.** A non-decreasing table inverts FR-26's bias (the luck-meter would favour the loaded shelf); a `0` entry makes a candidate unpickable while still occupying the walk. Also bound `total_weight` — `uniform_int` refuses outside `[1, 2^32]`, and [lib/roulette/prng.ts:54-58](lib/roulette/prng.ts#L54) records that the largest *real* `n` is ≈ 1200 (12 awards × weight 100), so a total anywhere near the bound means the table is wrong, not that the bound is tight. Validation runs **before** the first draw so a malformed table cannot consume bytes and then fail.
  - [x] **W8 — `table_max = len(table) - 1`, not a length**, and the index is `min(shelf_size, table_max)`. A player absent from the shelf map has shelf `0` → index `0` → **heaviest** weight; that absence is the *normal* case at the first spin, not an error.
  - [x] **W9 — a TIED provisional winner refuses; a NO-WINNER outcome weights as an empty shelf (DECISION F).** `KindTie` → typed refusal naming Story 6.5, propagated, never swallowed. `KindNoEligiblePlayers` / `KindNoAwardableValue` → **no player at all**, so no shelf, so index `0` (heaviest). These are different cases and must not be collapsed: a tie has *several* candidate shelves and choosing among them is a silent argmax; a no-winner award has *none*, which is the maximal-empty shelf FR-26 is written to favour.
  - [x] **W10 — TypeScript draws are ASYNC and the stream is NOT REENTRANT.** `uniformInt` returns a `Promise` and `prng.ts` **throws** if two draws overlap (the 6.3 review measured byte 32 never delivered and stream byte 0 injected). Stage 1 in TS is therefore `async` and must `await` each draw **sequentially** — ⛔ never `Promise.all` over the `live_count` picks, never a `.map(async …)`. Go is synchronous and cannot exhibit it, so this is a **verifier-only** divergence that would surface at 6.9 as the browser calling a correct ceremony unfair. Comment it at the site in both languages.

- [x] **Task 2 — The `stage1-pick.json` vector seam — §9.6 GATE 3 (AC: 3)**
  - [x] `roulette/vectors/stage1-pick.json` — cases of the shape
        `{ "name", "note", "seed_hex", "label", "label_source": {"kind":"stage1","spin":S}, "weight_table": [...], "live_count", "shelf": {"<steamid64>": n}, "candidates": [ {award_id, priority, award:{…}} ], "players": [ …AD-19 rows… ], "expected": { "weights": [...], "total_weight", "draws": [ {"n","r","bytes_consumed_after"} ], "live": ["<award_id>", …] } }`.
  - [x] ⭐ **`expected.weights` is as load-bearing as `expected.live`.** A vector that pins only the winner lets a wrong shelf lookup pass whenever it happens to pick the same award. Pin the computed weight per candidate, and pin `total_weight` separately so a summation bug is its own failure.
  - [x] ⭐ **`bytes_consumed_after` on every draw**, exactly as `prng-uniform-int.json` does (`README.md:143-146`) — it is the only externally visible proof that both runtimes consumed the same stream, and the only way a rejection inside `uniform_int` is observable at all.
  - [x] Mandatory rows: the **shelf→weight mapping** (a shelf of `0`, one mid-table, and one **past** `table_max` so the clamp is exercised); ⭐ **`r` exactly on a cumulative boundary** (W3); a **`live_count = 2` re-draw** (W4) whose second `n` is the *recomputed* total; a **single-candidate pool at weight > 1** (W5, consumes bytes); a **`total_weight = 1`** pool (W5, the zero-byte draw — the E1 case); **candidates supplied out of priority order** so the walk's own sort is exercised rather than the fixture's; a case where the **heaviest-weighted candidate is NOT the one drawn** (otherwise "weighted" and "argmax" are indistinguishable); and a case whose Stage-2 outcome is `no_eligible_players` for **every** candidate (the real corpus's shape — proving the ceremony still draws).
  - [x] `refusals` array (same role as `stage2-resolve.json`'s and `invalid_seed_hex`'s): a **tie** candidate (W9); an **empty pool**, `live_count = 0`, `live_count > len(pool)`, a **duplicate priority**, a **duplicate award id**, a **non-decreasing** weight table, a table containing `0`, and an **empty** table (W6/W7). ⚠ Only refusals **both languages can represent** travel in the file — `README.md:104-109` records the representability rule.
  - [x] Extend `roulette/vectors/generate_vectors.py` to produce **and `--check`** the new file, reusing its existing `Stream` / `uniform_int` / `resolve_stage2` / `_p` helpers. Do **not** hand-write expected values and do **not** add a second generator. ⛔ Never "fix" the generator by reading either implementation — it is the anchor precisely because it was written from spec text alone.
  - [x] Update [roulette/vectors/README.md:36](roulette/vectors/README.md#L36): gate 3 → **✅ shipped, Story 6-4b**; add a `stage1-pick.json` format section and a "cases that carry the weight" table in the house style; update `:46-47` ("this directory is not finished") to name only what is genuinely left (6.9 and 6.11).
  - [x] Vectors are **data, not code**: LF newlines, 2-space indent, stable key order, no comments-as-keys. Magnitudes that come from the **snapshot** stay decimal **strings**; weights, priorities, `live_count`, `n`, `r` and byte positions come from **config/PRNG** and stay JSON integers (`README.md:197-202` — the split is by provenance).

- [x] **Task 3 — Go producer: `worker/awards/stage1.go` (AC: 1, 2)**
  - [x] A **pure** selector over injected inputs. Recommended seam — get it right once, because 6.6, 6.7 and 6.8 all inherit it:
        `Stage1Input{ Candidates []Stage1Candidate; Players []SnapshotPlayer; Shelf map[string]int; Table []int; LiveCount int }`,
        `Stage1Candidate{ AwardID string; Priority int; Award Award }`,
        `func Stage1Weights(in Stage1Input) ([]int, error)` and `func Stage1Pick(s *Stream, in Stage1Input) (Stage1Result, error)`,
        `Stage1Result{ Live []string; Weights []int; TotalWeight int; Draws []Stage1Draw }` with `Stage1Draw{ N, R uint64; ConsumedAfter uint64 }`.
        `Live` is in **draw order** (that is the reveal order); 6.6 re-sorts by priority for anti-sweep — say so in a comment so nobody "fixes" it.
  - [x] Refusals are typed and wrapped in the package's existing `ErrStage2`-style sentinel. ⭐ **Add `ErrStage1`** rather than reusing `ErrStage2` — 6-4a's review found an untyped refusal surface let the vector gate assert only *"some error"*, so a mutation making validation reject everything passed every refusal row.
  - [x] `worker/awards` stays a **leaf** — no `worker/store`, `worker/db`, `worker/ingest`, `worker/config`. `TestPackageIsALeaf` will tell you if it stops being one.
  - [x] ⛔ **`math/big` is NOT needed here and must stay banned in this file.** `prng_test.go:828-832` scopes the ban with `exceptIn: ["stage2.go"]` and pins the shipped file set by exact equality; adding `stage1.go` to that set without adding it to `exceptIn` is the intended outcome. Weights, priorities and `total_weight` are small bounded ints — if you reach for `math/big` here, the table is wrong (W7).
  - [x] `worker/awards/stage1_test.go` — table-driven **and** vector-driven (`loadVector` from `../../roulette/vectors`, the 6.3/6-4a helper). Guard the loader against malformed rows and give the conformance switch a **final arm** that fails loudly on an unknown field (6-4a's review found the TS switch lacked one).
  - [x] Extend `TestScannedSourceFilesAreExactlyTheShippedModules` → `{labels.go, prng.go, stage1.go, stage2.go}` and the banned-construct scan to cover the new file: no `float64`, no `math/rand`, no `time`, no `fmt.Sprintf` in the decision path.

- [x] **Task 4 — TS verifier: `lib/roulette/stage1.ts` (AC: 1, 2)**
  - [x] The mirror — same names in camelCase, same refusals, same order, same result shape. `stage1Pick` is **`async`** (W10); `stage1Weights` is synchronous (it draws nothing).
  - [x] ⛔ **No `import 'server-only'`.** `lib/roulette` is the one `lib/**` package that ships to the browser (6.9's *"Verificar la ceremonia"*). ⛔ **No import of `lib/awards/**`** — that package IS `server-only` and importing it would poison the browser bundle; candidates arrive as plain data.
  - [x] ⭐ **`stage1.ts` brings `lib/roulette` its FIRST REAL IMPORT** (`./prng` and `./stage2`). Three consequences, all deliberate:
        (a) [lib/roulette/prng.test.ts:667](lib/roulette/prng.test.ts#L667)'s exact-equality module list must become `['labels.ts', 'prng.ts', 'stage1.ts', 'stage2.ts']`;
        (b) [prng.test.ts:745](lib/roulette/prng.test.ts#L745) *"records that every shipped module currently imports nothing"* **will redden** — its own comment says *"the day a shipped module gains a real import, this reddens, which is the moment to … update this line deliberately rather than silently"*. Update it to the measured truth and say so in Completion Notes;
        (c) the three import-ban tests (`server-only`, `node:`, third-party) finally execute **real** assertions on a real specifier list — the outcome `deferred-work.md:291` originally predicted. Keep 6-4a's positive control; it is what proves the predicate discriminates.
  - [x] `lib/roulette/stage1.test.ts` — colocated under `lib/**` or [vitest.config.ts:17](vitest.config.ts#L17) **silently does not run it**. Load the vector with `readFileSync` from the repo root.
  - [x] No `Math.*`, no `Number` division, no `**`, no `parseInt`, no `localeCompare` in the decision path.

- [x] **Task 5 — ⛔ THE BAR: the real seed, the real snapshot, the real catalog, both runtimes, mechanically diffed (AC: 4) — this gates sign-off**
  - [x] Bring up the local stack (or reuse 6-4a's captured export), and drive a **full 12-spin ceremony's worth of Stage-1 picks** with `live_count = 1` from the real `fair_seed = 1b3cd678…3279c`, one stream per spin via `Stage1Label(S)`, pool = all unrevealed awards, shelf accumulated across spins from whatever Stage 2 returns.
  - [x] ⭐ **Print the drawn category order and the byte cost.** Per spin: pool size, every candidate's weight, `total_weight`, `n`, `r`, the picked award, and `Consumed()` after. Then the total bytes a 12-spin ceremony draws. This number is what 6.9's browser must reproduce exactly; nobody has measured it yet.
  - [x] ⭐ **Answer the question 6-4a handed you.** 6-4a measured **all twelve awards → `no_eligible_players`** under the real 24/20 floors, and **5 of 12 ties** with the floors forced to 0. So run **both** passes: (a) real floors — every candidate weights as an empty shelf (W9), the shelf never fills, so record whether Stage 1 still completes 12 spins and what the drawn order is; (b) the floors-0 counterfactual (nothing in the repo changed) — record **how many candidates the tie refusal fires on, and at which spin the ceremony halts**. A halt is the correct, designed outcome under DECISION F/B; report it as evidence for 6.5, not as a bug.
  - [x] Diff the two runtimes' full transcripts **mechanically** (write both to files, `Compare-Object`) — not by eye. Record the SHA-256 of each. A mismatch is the story's headline finding, not a footnote.
  - [x] Both runtimes must read **ONE** catalog projection and **ONE** snapshot export, so the twelve awards are not two hand-written lists (6-4a's pattern: the TS half runs as a throwaway Vitest file because `lib/awards/catalog.ts` is `server-only` and Vitest is the only runner with the stub alias).
  - [x] Harness convention: a throwaway `worker/cmd/qa64b/main.go` + a throwaway `lib/roulette/bar-qa64b.test.ts` + a `_qa64b/` scratch dir, **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean while present *and* after removal. ⚠ `worker/cmd/qa54` is still in the tree and is still not yours to delete; do not add a second orphan.

- [x] **Task 6 — Mutation pass, before review (non-optional)**
  > Epic-5 retro Action Item #3 makes a **reviewer-independent** mutation pass a review gate. Every prior
  > story's own table was optimistic until it was hardened: 6.2 reported 43/0 and the reviewer found 5
  > survivors in 6; 6.3's first table was structurally invalid; 6-4a's harness silently failed to apply
  > 12 of 18 Go mutations after a CRLF round-trip and its `-run` filter excluded the refusal tests.
  > **Run a CONTROL pass on unmutated source first and void the run unless it is green**, read and write
  > mutation files as **BYTES**, run the **whole** vector-driven test set (not one `-run` filter), report
  > `NOT-APPLIED` as an outcome distinct from `killed`, and verify restoration by **SHA-256**.
  - [x] Mutate and record red/green in **both** languages: cumulative walk `>` → `>=` · walk `>=` → `>` · ascending priority → input order · ascending priority → descending · `min(shelf, table_max)` clamp dropped · `table_max` = `len(table)` instead of `len(table)-1` · absent shelf → heaviest replaced by lightest · shelf read *after* the first pick instead of frozen (W1) · re-draw replaced by remainder reuse (W4) · re-draw against the *original* total instead of the recomputed one · `n = len(pool)` instead of `total_weight` · single-candidate short-circuit added (W5) · the tie refusal swallowed → first tied player used as provisional winner (W9) · `no_eligible_players` weighted as *lightest* instead of heaviest (W9) · table validation removed (W7) · duplicate-priority guard removed (W2) · `live_count > len(pool)` clamped instead of refused (W6) · a `Promise.all` over the picks in TS (W10).
  - [x] ⭐ Every mutation must redden the **vector-driven** test, not only a hand-written local assertion. A mutation that only reddens a local test means the *vector* does not cover it — **fix the vector, not the test.**
  - [x] ⭐ **Guard the guards.** 6-4a's headline review finding was that its own coverage flags were satisfied by rows unrelated to the property they name, so the file's most valuable row could have been deleted with every gate green. Whatever coverage flags you add here (`sawExactBoundary`, `sawRedraw`, `sawZeroByteDraw`, `sawClamp`, …) must be checked against **the specific row** they claim, and **pin the case-name set by exact equality in both suites** — the fix 6-4a shipped after that finding.

- [x] **Task 7 — Gates**
  - [x] `npm run lint` → 0 · `npm test` → **measure the baseline first** (6-4a post-review: **873 across 39 files**; measure, do not quote — 6.1 quoted stale numbers) · `npm run build` → 0, every viewer route still `ƒ` dynamic and no `roulette` route · `cd worker; go build ./... && go vet ./... && go test ./...` → clean (6-4a post-review: `awards` **222**).
  - [x] `python roulette/vectors/generate_vectors.py --check` → OK on **all four** vector files (`--check` compares **bytes** since 6-4a's review; do not regress it to `read_text`).
  - [x] pgTAP: **unchanged, 1155 across 25 files** (assuming DECISION A holds). Run it if the stack is up for Task 5; otherwise state plainly that it rests on `supabase/**` being byte-untouched.
  - [x] `git status` + `git diff --stat` proof that `supabase/**`, `app/**`, `lib/awards/**`, `lib/ceremony/**`, `lib/i18n/**`, `lib/bracket/**` and `worker/ingest|store|db|config` are **byte-untouched**, and that `0025` is still free.

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A (carried from 6-4a, and it held there) — this story writes NOTHING to the database.**
No migration, no RPC, no route, no RLS, no pgTAP file. `0025` stays free. The ACs are entirely
algorithmic: Stage 1 takes the pool, the shelf, the table, `live_count` and a `*Stream` as **arguments**
and returns a result. `spin` / `spin.live_award_ids` / `ceremony.spin_plan` / `ceremony.luck_weight_table`
carry the **AD-22 reveal axis** and are **Story 6.8's**; `luck_weight_table` *population* is organizer
config (`ARCHITECTURE-SPINE.md:471`) and belongs to 6.6/6.8. Landing them here means shipping a
reveal-gated schema before the guard that protects it. ⚠ `deferred-work.md:277` (the `ceremony.state`
write-once gap) was homed to *"6.4 / 6.8"* **on the assumption 6.4 would need `UPDATE`**; 6-4a proved it
does not and passed it intact to 6.8 — **this story does not take it back.** If implementation genuinely
forces SQL, `0025` is yours: take it, follow 6-4a's recorded migration conventions, and **say in
Completion Notes what forced it**. A migration appearing without that justification is not acceptable.

**DECISION B (inherited from 6-4a, load-bearing here) — a tie has NO provisional winner, and Stage 1 refuses.**
6-4a ships `RefusingLadder` / `refusingLadder` as the only ladder either package exports, and its
hand-off says so explicitly: *"Ties are common on real data (5 of 12 awards in the counterfactual, widths
2–3), so the refusing port will fire often and Stage 1 must not invent a fallback."* Every self-contained
fallback — min shelf over the tied set, byte-lex-first, lowest SteamID64 — is a **silent argmax wearing a
different hat**: it produces a plausible weight, a plausible draw, and a plausible ceremony that 6.5 will
later contradict, **changing the drawn bytes from that spin onward with nothing red anywhere.**

**DECISION F — the tie refuses; a NO-WINNER outcome weights as an empty shelf.**
The two are different and must not be collapsed (W9). A `tie` has *several* candidate shelves and picking
among them is DECISION B's forbidden argmax → typed refusal naming Story 6.5. A `no_eligible_players` or
`no_awardable_value` outcome has *no player at all* → no shelf → index `0` → **heaviest weight**, which is
exactly what FR-26's *"empty shelf ⇒ heaviest weight"* is written to do; refusing there would make the
ceremony unrunnable on the **measured** real corpus, where 6-4a found all twelve awards resolve to
`no_eligible_players`. ⚠ This means the real corpus produces a **uniform** Stage-1 pick today (every
candidate at the heaviest weight). That is a correct consequence of a measured input, not a bug — record it.

**DECISION G — no single-candidate short-circuit; the draw is always over `total_weight`.**
The contexting analysis carried in `sprint-status.yaml` recorded W5 as *"a single-candidate pool means
`n=1`, which consumes ZERO bytes"*. That is only true if the implementation special-cases the pool size,
and **a special case is exactly the kind of unwritten rule two implementers diverge on** — 6-4a's S3
refused the same shape of "harmless" filter for the same reason. The rule here is: **always draw
`uniform_int(stream, total_weight)`**. A one-candidate pool of weight 100 draws `n = 100` and consumes a
byte; `n = 1` (and E1's zero-byte draw) arises **only** when `total_weight == 1`. Both halves get a vector
row. Say in Completion Notes that the contexting note was corrected, and why — a silent override here is
the worst outcome, because the two rules differ **only** in stream position, which is invisible until 6.9.

**DECISION C (carried) — the FR-21 floors and the `24`/`20` literals are untouched.** 6-4a measured 0/28
eligible and changed nothing (`deferred-work.md:269`). A floors/catalog decision is owed by someone; it is
not owed by this story and it must not be smuggled in as a resolver or weighting special-case.

**DECISION D — `worker/awards` stays a leaf; `lib/roulette` gains its first real import.** On the Go side
nothing changes (no persistence ⇒ the `WAW --> WST` spine edge stays unbuilt). On the TS side `stage1.ts`
imports `./prng` and `./stage2` — the first real import in the directory — which reddens one pinning test
**by design** (Task 4c) and finally makes the three import bans non-vacuous.

### The seam you are extending — and the rule that governs it

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

[ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) is unchanged and still binding: *"there is **no dependency edge** between `worker/*` and
`app/`+`lib/`… The roulette **producer** (`worker/awards`) and **verifier** (`lib/roulette`) each conform
to `roulette/vectors` independently — **never to each other**."* Neither is "the reference
implementation"; when they disagree the vector decides; when the vector is silent, add a vector. This is
why Task 2 precedes Task 4.

### The algorithm, transcribed (do not re-derive it from prose)

```
weight(a, shelf, table) =
    out = provisional_winner(a)                       # = ResolveStage2(a.award, players)
    if out.kind == tie:            REFUSE (typed, names Story 6.5)          # DECISION F
    if out.kind in {no_eligible_players, no_awardable_value}:
                                   idx = 0                                  # no player ⇒ empty shelf
    else:                          idx = min(shelf.get(out.steamid64, 0), len(table) - 1)
    return table[idx]

stage1_pick(stream, pool, players, shelf, table, live_count):
    validate(table)                    # non-empty, strictly decreasing, all > 0     (W7)
    validate(pool, live_count)         # non-empty, no dup award_id, no dup priority,
                                       # 1 <= live_count <= len(pool)                (W2, W6)
    cand   = sort(pool, key = award.priority)          # ASCENDING, total order       (W2)
    w      = [ weight(a, shelf, table) for a in cand ] # shelf FROZEN here            (W1)
    live   = []
    for _ in range(live_count):
        total = sum(w[i] for i in remaining)           # RECOMPUTED each pick         (W4)
        r     = uniform_int(stream, total)             # ALWAYS drawn; no short-circuit (W5)
        cum   = 0
        for i in remaining:                            # still ascending priority
            cum += w[i]
            if cum > r:                                # STRICTLY greater             (W3)
                live.append(cand[i].award_id); remove i from remaining; break
    return live            # in DRAW order; 6.6 re-sorts by priority for anti-sweep
```

Sources, in agreement: [SOLUTION-DESIGN §9.2](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L406) · [ARCHITECTURE-SPINE.md:218](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L218) · [epics.md:1066](_bmad-output/planning-artifacts/epics.md#L1066).

### The APIs you consume — the anti-reinvention map

| You need | Go | TypeScript | Trap |
|---|---|---|---|
| the spin's stream | `NewStream(seed [32]byte, label)` | `await createStream(seed, label)` | label from `Stage1Label(S)` / `stage1Label(S)` — **1-based**, refuses `0` |
| the seed bytes | `DecodeSeed(seedHex)` | `decodeSeedHex(seedHex)` | 64 **lowercase** hex chars, raw 32 bytes as the key — never the hex string |
| the draw | `UniformInt(s, n uint64)` | **`await uniformInt(stream, n)`** | TS is async + **non-reentrant** (W10); `n ∈ [1, 2^32]`, out of range is a programmer error, never a clamp |
| the byte position | `s.Consumed()` | `stream.consumed` | the field the vector asserts on — report it after **every** draw |
| the provisional winner | `ResolveStage2(award, players)` | `resolveStage2(award, players)` | ⛔ **not** `ResolveAward` — that consults the refusing ladder and you lose the inspectable outcome |
| the outcome shape | `Outcome{Kind, SteamID64, DecidingValue, Tied, Reason}` | discriminated union on `kind` | **four** arms; `Tied` is populated for `tie` **and** `no_awardable_value` |
| the award projection | `Award{DecidingStat, Class, Direction, FloorRounds, FloorKills}` | `Award` interface | `secondary_stat` / `eff_*_key` are deliberately absent — 6.5's |

### Scope boundaries — hold these

**Build:** `worker/awards/stage1.go` + `stage1_test.go` · `lib/roulette/stage1.ts` + `stage1.test.ts` · `roulette/vectors/stage1-pick.json` + the `generate_vectors.py` extension + the README gate-3 update · the two pinning-test file-set updates + the deliberate redden-and-update of the "imports nothing" test.

**Do NOT build** (each with its owner):
- **The FR-29 ladder** → **6.5**. You consume 6-4a's refusing port's *outcome*; you do not add rungs, and you do not add a fallback.
- **Anti-sweep, `assigned_this_spin`, overflow re-resolution, the `luck_weight_table` VALUES, `UNIQUE(spin_id, winner_entry_id)`** → **6.6**. You take the table as a parameter and validate its shape; you never seed one.
- **The pity draw and `PITY_LABEL`'s stream** → **6.7**.
- **`spin_plan` CONTENT, pool composition, "minus already-revealed" bookkeeping across spins** → **6.8**. Stage 1 receives the pool for one spin, already filtered.
- **`spin` / `award_result` / `award_result_winner`, persistence, the reveal-gated RLS axis, `ceremony.state` transitions, the audit row, any admin route** → **6.8** (DECISION A).
- **RFC-8785 canonicalization, `bundle_sha256`, `algo_version` publication** → **6.9**. `algo_version` is fixed at `inclusivcup-roulette-1.0.0`; carry it, do not redefine it, and do not bump it (nothing is published yet — 6-4a recorded that as an explicit decision).
- **Any UI, any wheel, any i18n string, any route.** `/ceremonia` stays the 5.7 `<Placeholder>`.
- **Any change to `public.leaderboard`, the `24`/`20` floor literals, `lib/awards/**`, or 6-4a's shipped Stage-2 semantics.** If Stage 1 needs something Stage 2 does not expose, say so in Completion Notes — do not edit `stage2.*` to suit the caller.
- **Anything in `worker/ingest|store|db|config`** or `lib/bracket|ceremony|steam|i18n`.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)); a test outside `lib/` silently does not run. Environment is `node`. **Measure the baseline before claiming a delta** — 6-4a post-review is **873 across 39 files**.
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./...`. Table-driven; `t.Errorf` over `t.Fatalf` in shared helpers so one failure does not mask the rest (`deferred-work.md:20`). 6-4a post-review `awards` is **222**.
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe vector values into source.** Guard the loader against malformed rows; give the conformance switch a final arm; assert refusals are the **typed** error, not merely "some error".
- **Pinning tests** — extend 6.3/6-4a's existing scans; both module-list assertions are exact-equality **by design**, so adding a file without registering it reddens. Bans that must hold in the new modules: `server-only`, `node:`, `math/rand`, `Math.random`, `Date`, `toLocaleString`, `localeCompare`, `parseInt`, `**`, `fmt.Sprintf`, `float64`, and `math/big` (**not** exempted for `stage1.go`).
- **`npm test` does not typecheck** — 6.3's build caught a type error 704 green tests could not. Run `npm run build` before you believe the suite.
- **Mutation pass before review** — Task 6, non-optional, control-pass-first, byte-level file IO, whole-suite runners, restoration verified by **SHA-256** (`git status` is structurally blind: `worker/awards`, `lib/roulette` and `roulette/` are untracked directories, so it prints `??` regardless of content).
- **pgTAP** — untouched under DECISION A. Baseline **1155 across 25 files**. ⚠ If you seed a QA corpus for Task 5, `supabase db reset` before running pgTAP: 6-4a's first attempt failed 6/25 purely because its own QA rows collided with the suite's fixtures.

### Stack

Pinned and current; **nothing new is introduced or permitted**. Go `1.26.4` (`worker/go.mod`) — stdlib
only. Node ≥ 20.9 · TypeScript `^5.9` · Vitest `4.1.9` · Next.js `16.2.10`. `tsconfig` is
`"target": "ES2022"` with `"verbatimModuleSyntax": true`, so every type-only import must be
`import type { … }`. **No new npm package and no new Go module.** Python 3 stdlib only for the generator.

### Previous story intelligence — 6-4a (`9ccb832`), 6.3 (`3f7c98e`), 6.2 (`eed5318`), 6.1 (`01e3f5b`)

- ⭐ **The single most transferable finding of 6-4a's review: a coverage guard can be satisfied by a row
  unrelated to the property it names.** All three review layers landed on it independently —
  `sawFloatDivergence` was flipped by a zero-denominator row, so the story's headline `(2^53+1)` case
  could have been **deleted with every gate green**, and neither suite pinned the case-name set. Your
  vector will have the same class of guard (W3's exact-boundary row is the one that matters most). Pin
  the **case-name set by exact equality in both suites**, and make each flag look at the specific row.
- **The author's own mutation table is not proof.** 6.2 reported 43/0 → reviewer found 5 survivors in 6.
  6.3's first table was structurally invalid → 8 survivors on an honest re-run. 6-4a's harness silently
  failed to apply 12 of 18 Go mutations after a Python `write_text` CRLF round-trip, and its `-run` filter
  excluded the refusal tests. **Read/write mutation files as bytes; run the whole suite; report
  NOT-APPLIED distinctly.**
- **Cross-language divergences hide where the vector is silent.** 6-4a's review closed eight of them —
  Go panicking where TS refused, a typed-nil guard, aliased `*big.Int` vs immutable `bigint`, untyped Go
  refusals, a bare `TypeError` on a null input, two loaders disagreeing on `"+5"`, a switch with no final
  arm. Write each guard **in both languages at the same time** and ask what input distinguishes them.
- **The `--check` byte-comparison lesson:** `read_text` normalises CRLF on Windows, so a CRLF-rewritten
  vector reported OK. It compares bytes now — do not regress it.
- **`Object.freeze` is shallow** (6.1 shipped a "frozen" catalog of mutable entries). Deep-freeze and pin
  any constant `lib/roulette` exports.
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers.**
- **Gates at 6-4a sign-off (post-review):** lint 0 · Vitest **873 / 39 files** · build 0 · Go clean, `awards` **222** · `generate_vectors.py --check` OK ×3 · pgTAP **1155 / 25** · `0025` free.

### 6-4a's measurements — the inputs this story must be designed against

| Measured on the real corpus | Value | What it means here |
|---|---|---|
| Players clearing `floor_rounds = 24` / `floor_kills = 20` | **0 / 28** | every award → `no_eligible_players` → **every candidate weights heaviest** (DECISION F) → today's Stage 1 is effectively uniform. Record it; do not "fix" it. |
| Ties with floors forced to 0 | **5 of 12 awards**, widths 2–3 | the tie refusal will fire on ~40% of candidates in the counterfactual. Expect the counterfactual ceremony to **halt**, and report where. |
| Real-data `equal_cross_product` tie | `1/1` vs `2/2` (award #03) | a tie is not exotic; it is the corpus's normal behaviour once floors admit anyone. |
| Zero-denominator on the real corpus | `0 / 28` on all four rate keys | unreachable here; covered by the vector and by nothing else. |
| `fair_seed` | `1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c` | the seed Task 5 must use, and the one already anchored in every vector file. |

### Inherited items this story is named in

| Item | Source | What 6-4b owes it |
|---|---|---|
| **§9.6 GATE 3 is unbuilt** | [roulette/vectors/README.md:36](roulette/vectors/README.md#L36) | Task 2 — ship `stage1-pick.json` and flip the ownership row |
| **Ties are common; the refusing port fires often** | 6-4a hand-off | DECISION F + Task 5(b) — measure where the ceremony halts |
| **All twelve awards have no eligible player** | `deferred-work.md:269` | DECISION F — weight as empty shelf; report that Stage 1 still runs |
| **The TS import bans finally bite** | `deferred-work.md:291` (6.3) / 6-4a's stronger closure | Task 4c — `stage1.ts` IS the first real import; update the "imports nothing" test deliberately |
| **`ceremony.state` write-once** | `deferred-work.md:277` | Not yours — 6-4a passed it to **6.8** under DECISION A. Do not take it back. |
| **Nothing automatically runs `--check`** | `deferred-work.md:299` (6-4a) | Deferred to 6.11; run it by hand at Task 7 and say so |
| **Epic-5 retro #3 / #5** | [epic-5-retro-2026-07-28.md:95,97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95) | Task 6 (author's half) and "every claim backed by printed output" |

### Git intelligence — recent commits

`9ccb832` (6-4a, Stage 2 + the refusing ladder port) · `3f7c98e` (6.3, PRNG + vectors) · `eed5318` (6.2,
ceremony lock + snapshot) · `01e3f5b` (6.1, award catalog) · `64990db` (5.8). The arc through Epic 6 is
one story per layer, vectors as the shared contract, a BAR over the real seam, a mutation pass before
review. 6.3 and 6-4a both shipped with **no migration** because there was nothing to persist until the
reveal axis exists; **this story is the third in that run** and keeps every other convention.

## Project Structure Notes

```
worker/awards/stage1.go                       NEW   pure weighted selector + typed refusals (ErrStage1)
worker/awards/stage1_test.go                  NEW   table-driven + vector-driven
lib/roulette/stage1.ts                        NEW   mirror; ASYNC pick; NOT server-only; first real import
lib/roulette/stage1.test.ts                   NEW   vector-driven
roulette/vectors/stage1-pick.json             NEW   §9.6 GATE 3 — weights, boundary r, re-draw, byte accounting
roulette/vectors/generate_vectors.py          UPDATE  produce + --check the new file
roulette/vectors/README.md                    UPDATE  gate 3 -> shipped (6-4b); format + weight-carrying-cases sections
lib/roulette/prng.test.ts                     UPDATE  module list -> 4 files; the "imports nothing" test reddens BY DESIGN
worker/awards/prng_test.go                    UPDATE  shipped file set -> 4 files; banned-construct scan covers stage1.go
_bmad-output/implementation-artifacts/sprint-status.yaml   UPDATE
```

No migration number is consumed under DECISION A; **`0025` stays free**. Naming follows the established
`lib/<domain>/<file>.ts` + `worker/<pkg>/<file>.go` layout. `lib/roulette/**` must stay out of `app/`,
must not acquire `server-only`, and must not import `lib/awards/**` — it ships to the browser at 6.9.

## References

- Story ACs (Stage-1 half) — [epics.md:1064-1066](_bmad-output/planning-artifacts/epics.md#L1064) · the Stage-2 half 6-4a shipped `:1068-1070`
- **AD-14** (deterministic, client-reproducible draw engine) — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145)
- **Stage 1 on the Provably-Fair contract surface** — [ARCHITECTURE-SPINE.md:218](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L218) · uniformity `:217` · the weight table as organizer config `:471`
- **The Stage-1 spec + the conformance gates + the build order** — [SOLUTION-DESIGN §9.2](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L406) / [§9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L440) · the PRNG you consume [§9.1](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L393)
- **The no-edge rule** — [ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73)
- **FR-25** — [prd.md:354-361](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L354) · **FR-26** (anti-sweep + luck-meter) `:363-369` · **FR-29** (ladder, 6.5's) `:388-395` · anti-sweep + pity as the accepted concentration mitigation `:451` · SM-2 `:483`
- **UX ceremony choreography + the one-award-per-spin pacing** — [EXPERIENCE.md:162-173](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L162) · the verify affordance `:153` · shared co-winner as a designed outcome, never an error state `:123`
- The vector seam and its rules — [roulette/vectors/README.md](roulette/vectors/README.md)
- 6-4a's shipped Stage 2 — [worker/awards/stage2.go](worker/awards/stage2.go) · [lib/roulette/stage2.ts](lib/roulette/stage2.ts) · 6.3's primitives — [worker/awards/prng.go](worker/awards/prng.go) · [lib/roulette/prng.ts](lib/roulette/prng.ts) · [lib/roulette/labels.ts](lib/roulette/labels.ts)
- Prior story (read its Completion Notes in full) — [6-4a-stage-2-deterministic-winner-and-tie-detection.md](_bmad-output/implementation-artifacts/6-4a-stage-2-deterministic-winner-and-tie-detection.md)
- Inherited deferrals — [deferred-work.md:268-270, 277, 291, 293, 299](_bmad-output/implementation-artifacts/deferred-work.md#L268) · the 6.5 rung-4 blocker `:281`
- Epic-5 retro Action Items #3, #5 — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95)

## Questions for Cuatro

Three. None blocks Task 0/1; answer before Task 2 fixes the vector in place.

1. ⭐ **`live_count`: build for `1`, or build parameterized for `N`?** UX fixes the pacing at **one award
   per spin** ([EXPERIENCE.md:164](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L164), `:132`), but FR-26's one-trophy-per-spin cap (`:169`) and the verifier
   both presuppose a live-category **set**, and `spin.live_award_ids` is a jsonb **array**. With
   `live_count = 1` shipped, **FR-26's cap can never fire**, 6.6's anti-sweep would guard a path the config
   never takes, and pity becomes the sole mitigation for a sweep that `prd.md:451` names anti-sweep *and*
   pity against. **Recommended: build parameterized for `live_count >= 1`, vector BOTH widths (W4's
   re-draw is only reachable at `N > 1`), let config declare `1`, and flag it so 6.6 does not discover it
   live.** The cost is one extra loop and two extra vector rows.
2. **DECISION F — is "tie refuses, no-winner weights heaviest" the right split?** **Recommended: yes.** A
   tie has several shelves and choosing one is DECISION B's silent argmax; a no-winner award has none,
   which is the maximal-empty shelf FR-26 favours. The consequence you should see coming: on the **real**
   corpus every award weights heaviest, so today's Stage 1 draws uniformly — correct, measured, and worth
   knowing before you watch it.
3. **DECISION G — no single-candidate short-circuit?** **Recommended: yes, no short-circuit** — always
   draw over `total_weight`. It contradicts a line in the contexting note carried in `sprint-status.yaml`,
   which is exactly why it is being asked rather than assumed: the two rules produce identical *picks* and
   different *stream positions*, and a stream-position divergence is invisible until 6.9's browser
   declares a correct ceremony unfair.

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5`), bmad-dev-story, baseline `9ccb832`.

### Debug Log References

Throwaway harnesses, **deleted before commit** and therefore not in the File List:
`worker/cmd/qa64b/main.go` (corpus rebuild + AD-19 capture + the Go half of the ceremony),
`lib/roulette/bar-qa64b.test.ts` (the TS half — a Vitest file because `lib/awards/catalog.ts` is
`import 'server-only'` and Vitest is the only runner with the stub alias, so it is the only way to
read the SHIPPED twelve awards rather than restate them), and `_qa64b/` (`mutate.py`,
`snapshot.json`, `awards.json`, both transcripts). `go build ./... && go vet ./... && go test ./...`
was proven clean **with** the harness present and again **after** removal. `worker/cmd/qa54` is
untouched and no second orphan was added.

### Completion Notes List

#### Cuatro answered all three open questions before Task 2 fixed the vector

1. **`live_count` is PARAMETERIZED for `N >= 1`.** The seam loops, removes the picked candidate and
   re-draws against the recomputed total; the vector carries `live_count` 1, 2 **and 4** (the whole
   pool). Config still declares 1. Had this shipped at 1, W4's re-draw would have been unreachable
   and FR-26's one-trophy-per-spin cap could never fire — 6.6 would have discovered the widening
   live, *after* 6.9's verifier existed, i.e. at the point where changing stream positions is most
   expensive.
2. **DECISION F confirmed** — a `tie` refuses (typed, naming 6.5); `no_eligible_players` /
   `no_awardable_value` have **no player, therefore no shelf, therefore index 0 = the heaviest**.
3. **DECISION G confirmed** — no single-candidate short-circuit. ⚠ **This CORRECTS the W5 line in
   this story's own contexting note** (carried in `sprint-status.yaml`), which said "a
   single-candidate pool means `n=1`, which consumes ZERO bytes". It does not: a one-candidate pool
   of weight 100 draws `n=100` and **consumes a byte**; `n=1` and the zero-byte draw arise **only**
   when `total_weight == 1`. Both halves have their own vector row, and the two rules differ *only*
   in stream position — invisible until 6.9's browser calls a correct ceremony unfair.

#### ⛔ THE BAR (Task 5) — both runtimes over the REAL corpus, mechanically diffed

The corpus was rebuilt from the 14 real `.dem.gz` through the REAL `ingest.DemoinfocsParser`,
written to `stat_row` through the REAL `RecordParse`, and captured by the REAL `lock_ceremony` RPC,
so the aggregate comes from `public.leaderboard` (AD-20's single normalization site). Three anchors
prove it is the corpus 6.1/6.2/6-4a measured:

```
round total = 204                                    ⭐ 6.2's exact corpus
roster      = 28 players
fair_seed   = 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c
              ⭐ BYTE-IDENTICAL to the seed Story 6.2 froze and every vector anchors on
lock_ceremony -> {"ok": true, "row_count": 28, "eligible_count": 0,
                  "content_sha256": "1f5f4d70e441648e01795dd5f61dc84c05a9ce0f43e486070ae13fe003a6f3ff"}
```
⚠ `content_sha256` differs from 6.2's and 6-4a's **correctly**: `achievement_ts` is wall-clock
approval time, so a re-ingest changes it (`deferred-work.md:282`).

**MECHANICAL DIFF — the headline.** Both runtimes wrote a 61-line transcript over two full passes.
`Compare-Object` → **ZERO differing lines**; SHA-256 of each file **identical**:

```
5B0E9F8D70F08B0E2D1BD25A4C6C7CB736DB68B51C74D3E083A529BF317324BC  transcript-go.txt
5B0E9F8D70F08B0E2D1BD25A4C6C7CB736DB68B51C74D3E083A529BF317324BC  transcript-ts.txt
```
Both read ONE snapshot export and ONE catalog projection (through the shipped `AWARD_CATALOG`), so
the twelve awards are not two hand-written lists.

**⭐ THE FIRST DIFF RUN FOUND A REAL DEFECT, which is what the BAR is for.** The only two lines that
differed were the ones printing the tie refusal's *text* — because Go's tie carried only a formatted
message while TypeScript's `Stage1TieError` had carried `awardId` and `tied` since it was written.
Go gained `Stage1TieError{AwardID, Tied, Reason}` (mirroring `stage2.go`'s `LadderRefusedError`), TS
gained `reason`, and the transcript now prints the **contract** rather than prose. Story 6.5 can now
read the tied set and the equality in both runtimes without parsing English.

**⛔ (a) THE REAL-FLOORS PASS — measured, and it COMPLETES.**

```
census: no_eligible_players = 12 of 12 awards
weights every spin: all candidates at 100 (the heaviest) -> Stage 1 draws UNIFORMLY today
12 spins COMPLETED, 22 BYTES drawn for the whole ceremony
drawn order: aw-04, aw-12, aw-08, aw-09, aw-05, aw-10, aw-02, aw-03, aw-07, aw-06, aw-01, aw-11
shelf after 12 spins: (empty) — nobody ever wins, so the shelf never fills
```
So the answer to *"can a ceremony complete at all today"* is **yes — Stage 1 completes all twelve
spins**, and it costs **22 bytes**. That number is what 6.9's browser must reproduce exactly and
nobody had measured it before. The uniform weighting is the **correct consequence of a measured
input** (DECISION F over 6-4a's `no_eligible_players` finding), not a bug — and it means the luck
meter has nothing to bias until the floors question is answered by whoever owns it (DECISION C: not
this story, and the `24`/`20` literals are byte-untouched).

⚠ Note `consumed=2` on the early spins and `consumed=1` on the last two: `n` between 257 and 1200
needs `k=2`, and the pool shrinking to 2 candidates drops it to `k=1`. Rejection sampling is
inherited, so a Stage-1 pick cannot assume one byte — the vector's re-draw row pins that too.

**⛔ (b) THE FLOORS-0 COUNTERFACTUAL — the tie refusal fires on 5 of 12, and the ceremony HALTS at
spin 1.**

```
census: tie = 5, winner = 7 of 12 awards
  aw-01 kills               tie, width 3
  aw-03 hs_pct              tie, width 2
  aw-04 hs_kills            tie, width 3
  aw-08 through_smoke_kills tie, width 2
  aw-11 deaths              tie, width 3
spin 01 HALT kind=tie award=aw-01 reason=equal_value tied=3, after 0 BYTES
```
**5 of 12 reproduces 6-4a's measurement exactly** (5 of 12, widths 2–3). The halt is the **designed
outcome under DECISION F/B**, reported as evidence for 6.5 rather than as a defect. ⚠ It halts
having consumed **zero bytes**, which is W7/W1 working: the weights are computed before the first
draw, so a refusal cannot leave the stream in a position that depends on the failure. Nothing in the
repo was changed to produce this pass — the floors were forced to 0 in the harness only.

#### ⭐⭐ The mutation pass found a real survivor, and the fix went into the VECTOR

**37 mutations across both languages, 0 SURVIVORS, 0 NOT-APPLIED, control green first, restoration
verified by SHA-256** — and every one is killed by the **vector-driven** test in isolation, not
merely by the full suite. Every prior story's harness defect was designed against up front: bytes
not text (6-4a's CRLF round-trip silently unapplied 12 of 18 anchors), NOT-APPLIED reported as its
own outcome, a control pass that voids the run, and whole-suite runners rather than one `-run`
filter. Two harness defects surfaced *because* of those guards and were fixed rather than mistaken
for results: `npx` is a `.cmd` shim CreateProcess cannot find by bare name, and decoding a child's
output through cp1252 crashed on Vitest's own check marks.

**The first run had ONE honest survivor: T18 — deleting the NEGATIVE-SHELF guard survived the entire
TypeScript suite.** Cause: a negative index yields `undefined`, which becomes `NaN` in the weight
sum and is refused three functions later — still a typed refusal, still the right `refusal_kind`. Go
on the same deletion **panics** on `table[-1]`. So the shared refusal row could not distinguish
*"refused by the guard that exists for exactly this"* from *"refused by accident"* or *"crashed"* —
the same class as 6-4a's untyped-refusal finding, one level deeper.

Per the story's own rule (*"a mutation the vector does not cover means fix the VECTOR, not the
test"*), the fix is a new shared field: every refusal row now carries **`detail`** from a closed
`refusal_details` set (`weight_table`, `shelf`, `pool`, `live_count`, `total_weight`, `stage2`,
`tie`), Go gained `Stage1InvalidError{Detail, Reason, Cause}` with multi-`Unwrap` (so
`errors.Is(err, ErrStage1)` *and* `errors.Is(err, ErrStage2)` both hold on a propagated refusal),
TypeScript's `Stage1Error` gained `detail`, and **the generator itself asserts that each row's
declared `detail` matches the guard that actually raised**. T18 is now killed by the vector, and all
seventeen invalid rows became specific rather than only that one.

#### Guarding the guards (6-4a's headline review finding, applied here)

The case-name set is pinned by **exact equality in both suites**, and every coverage check names
**the specific row** it claims and re-derives the property from that row's own data:
`r-lands-exactly-on-a-cumulative-boundary` is checked to still have `r == weights[0]` **and** to
draw the *second* candidate (an `r` on the boundary that still picked the first would mean `>=`),
and the suites assert that **exactly one** row sits on a boundary — so the property cannot survive
by accident if that row were deleted. The same discipline runs at the ANCHOR: `build_stage1_file`
executes each case's `pins` lambda and refuses to write the file if a row stops exhibiting the
property it was chosen for, and it asserts **no refusal row moved the stream**.

#### `lib/roulette` gained its FIRST REAL IMPORT — `deferred-work.md:291` closed as predicted

`stage1.ts` imports `./prng` and `./stage2`, so the three import-ban tests execute real assertions
over a non-empty specifier list for the first time. `prng.test.ts`'s *"every shipped module
currently imports nothing"* pin **reddened by design** — its own comment asked for exactly that —
and was replaced with the **measured** truth: the exact import graph is now pinned **per module**,
so `labels.ts` and `prng.ts` staying leaves is itself load-bearing, plus a guard-the-guard asserting
at least one module has a non-empty list (otherwise the three bans could silently go vacuous again).
6-4a's positive controls are KEPT: a non-empty list only proves the list is non-empty, whereas those
prove the predicate discriminates.

#### DECISION A held a third time

Nothing forced SQL. **`0025` stays free**, no migration, no RPC, no route, no RLS, no pgTAP file,
`supabase/**` byte-untouched, pgTAP unchanged at 1155. `deferred-work.md:277` (`ceremony.state`
write-once) **stays with 6.8** — this story did not take it back.

#### ⚠ A correction to this story's own Dev Notes

Testing standards state that *"`git status` is structurally blind: `worker/awards`, `lib/roulette`
and `roulette/` are untracked directories, so it prints `??` regardless of content"*. **Measurably
false at this baseline** — all 17 files in those directories are tracked, and `git status` correctly
reported only the five modified files. It is a real signal here, and it is what proved the three
pre-existing vector JSONs regenerated **byte-identically** (they never appeared as modified). The
mutation pass still verified restoration by SHA-256 as belt-and-braces.

#### Gates (measured, not quoted)

| Gate | Baseline (measured at `9ccb832`) | After |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | 873 / 39 files | **968 / 40 files** |
| `npm run build` | 0 | **0** — every viewer route still `ƒ` dynamic, no `roulette` route |
| `go build && go vet && go test ./...` | clean, `awards` 222 | **clean, `awards` 297** |
| `generate_vectors.py --check` | OK ×3 | **OK ×4** (the three 6.3/6-4a files byte-identical) |
| pgTAP | 1155 / 25 files | **1155 / 25 files, 0 failures** |
| `0025` | free | **free** |

Byte-untouched (empty `git status`): `supabase/**`, `app/**`, `lib/awards|ceremony|i18n|bracket/**`,
`worker/ingest|store|db|config/**`.

#### Handed to the next stories

- **6.5** — the tie refusal fires on **5 of 12** awards once floors admit anyone, and a ceremony
  **halts at spin 1** without it. `Stage1TieError` / `Stage1TieError` carry `awardId`, `tied` and
  `reason` in both runtimes so the ladder can read the tie it must resolve.
- **6.6** — `Stage1Result.Live` is in **DRAW order** (the reveal order), deliberately not sorted by
  priority; re-sort for anti-sweep rather than expecting it sorted. `Stage1Weights` is exported and
  draws **zero bytes**, so the luck meter can render weights without touching a ceremony's stream.
  The weight table's VALUES are still organizer config and were never seeded here.
- **6.8** — the pool arrives already filtered; "minus already-revealed" bookkeeping stays yours.
- **6.9** — a 12-spin ceremony at `live_count = 1` over the real corpus costs **22 bytes**. ⛔ The TS
  verifier must `await` each pick **sequentially**; a `Promise.all` is mutation T19 and it is a
  divergence Go cannot exhibit and `consumed` cannot see.
- **6.11** — nothing automatically runs `--check` (`deferred-work.md:299`); it was run by hand.

### File List

| File | Change |
|---|---|
| `worker/awards/stage1.go` | NEW — the pure weighted selector, typed refusals (`ErrStage1`, `ErrStage1Tie`, `Stage1TieError`, `Stage1InvalidError` + `Detail*`) |
| `worker/awards/stage1_test.go` | NEW — vector-driven + table-driven; case-name set pinned by exact equality |
| `worker/awards/prng_test.go` | UPDATE — shipped file set → 4 files; `math/big` exemption NOT widened to `stage1.go` |
| `lib/roulette/stage1.ts` | NEW — the mirror; `stage1Pick` is `async` and sequential (W10); NOT `server-only`; the directory's first real import |
| `lib/roulette/stage1.test.ts` | NEW — vector-driven; colocated under `lib/**` or Vitest silently would not run it |
| `lib/roulette/prng.test.ts` | UPDATE — module list → 4; the "imports nothing" pin replaced by a per-module import-graph pin + a non-vacuity guard |
| `roulette/vectors/stage1-pick.json` | NEW — §9.6 GATE 3: **14 cases + 18 refusals** (13 + 17 at implementation; the review added the two-defect `live_count`-over-a-tie row and the omitted-shelf twin), weights, boundary `r`, re-draw, byte accounting |
| `roulette/vectors/generate_vectors.py` | UPDATE — produces and `--check`s the new file; `pins` self-guards; refusal `detail` |
| `roulette/vectors/README.md` | UPDATE — gate 3 → shipped; format + weight-carrying-cases sections; `detail` documented |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE |

### Change Log

| Date | Change |
|---|---|
| 2026-08-04 | Story contexted (bmad-create-story) → ready-for-dev. Baseline `9ccb832` (6-4a done). |
| 2026-08-04 | Cuatro answered all three open questions: `live_count` parameterized for N ≥ 1; DECISION F confirmed; DECISION G confirmed (correcting the contexting note's W5 line). |
| 2026-08-04 | Implemented (bmad-dev-story) → review. §9.6 GATE 3 shipped; both runtimes mechanically diffed to an identical SHA-256 over the real corpus; 37/37 mutations killed by the vector after the survivor T18 was closed by adding `detail` to the shared refusal contract. |
| 2026-08-04 | Adversarial code review (3 parallel layers) → **done**. 1 decision + 14 patches applied, 3 dismissed. Headline: the three implementations disagreed on VALIDATION ORDER, and the anchor was the one matching the spec — a bad `live_count` over a tied pool refused as `invalid` in Python and `tie` in both shipped runtimes. Also closed: `detail` was a "closed set" that was not closed (7 vs 9, and the unknown-outcome arm named differently in each), an absent `shelf`/`players` published a ceremony in Go while the verifier refused it, two vacuous assertions, and three coverage guards that did not re-derive the property their row was chosen for. Vector 13+17 → **14+18**. Gates after: lint 0 · Vitest **977/40** · build 0 · gofmt clean · Go `awards` **300** · `--check` OK ×4 · pgTAP unchanged · `0025` free. |

### Review Findings

_Adversarial code review 2026-08-04 (fresh context, 3 parallel layers: Blind Hunter · Edge Case Hunter ·
Acceptance Auditor), baseline `9ccb832`, ~9,983 lines. **Acceptance Auditor: AC3's mandatory row list is
complete, every W1–W10 comment matches behaviour, nothing from the Do-NOT-build list leaked, `0025` free,
and the Completion Notes' numbers were independently reproduced — 22 bytes, the same 12-award drawn order,
`--check` OK ×4, Vitest 968/40, Go `awards` 297.** Every finding below was re-verified by the reviewing
agent against the source before triage. Triage: **1 decision-needed, 13 patch, 0 defer, 3 dismissed.**_

**The headline: the three implementations do not agree on validation ORDER, and the anchor is the one that
matches the spec.** `generate_vectors.py` validates `live_count` **before** weighting; Go and TypeScript
both weight **first**. On an input that is both malformed and tied, the anchor says `invalid/live_count`
and both shipped runtimes say `tie` — routing a bad spin plan into 6.5's ladder. No vector row combines two
defects, so the gate is structurally blind to it. This is the same class as 6-4a's untyped-refusal finding,
one level up: the refusal *kind* is now typed, but *which guard fires first* is not pinned.

**Decision-needed (resolved 2026-08-04 by Cuatro):**

- [x] [Review][Decision→Patch] **An absent `shelf` / `players` container: Go publishes a ceremony, TypeScript refuses, the anchor crashes** — **RESOLVED: a missing map IS the empty case.** "Absent" (Go `nil` / TS `undefined` / Python `None`) normalises to `{}` / `[]` in all three, because Go cannot idiomatically distinguish `nil` from empty and W8 already says an absent player is shelf 0. TypeScript and Python keep refusing `null` and structurally-wrong types (an array as a shelf, a non-array roster) as a guard on untrusted JSON — a state Go cannot express, documented at the site in the same style as the existing `Object.hasOwn` note, and therefore **not** vectorable. ⚠ The absent roster is normalised **inside Stage 1** (`players ?? []`), NOT by loosening `stage2.*` — the scope boundary forbids editing 6-4a's Stage-2 semantics to suit a caller. Gets a vector **case** (not a refusal row) whose `shelf` key is **omitted**, proving all three read it as the empty shelf. Now tracked as a patch below. — `validateShelf` on a nil Go map ranges zero times and returns nil, so `Stage1Input{…}` with `Shelf` omitted weights every candidate at `table[0]` and **draws a complete, publishable spin**; TypeScript's `typeof undefined !== 'object'` throws `Stage1Error('shelf')`; Python's `shelf.items()` raises `AttributeError`, which is not a `Stage1Refusal`. Identical for an omitted `Players` (Go → `no_eligible_players` for every award → a full uniform ceremony; TS → `Stage2Error` → `Stage1Error('stage2')`). This is exactly the W10-class failure the epic exists to prevent — the producer emits a ceremony the browser verifier calls unfair — and it needs a call because there are **two consistent closures**: (a) a missing map IS the empty shelf (Go cannot idiomatically distinguish `nil` from `{}`, and W8 already says an absent *player* is shelf 0), so TS accepts `undefined` while still refusing `null`/non-object; or (b) a missing map is a refusal everywhere, which costs Go an explicit nil check it would not otherwise need. Whichever wins needs a vector refusal row and a guard in all three. [worker/awards/stage1.go:537] [lib/roulette/stage1.ts:516] [roulette/vectors/generate_vectors.py:1408]

**Patch:**

- [x] [Review][Patch] `live_count` is validated AFTER weighting in Go and TypeScript, BEFORE it in the Python anchor — contradicting this story's own transcribed algorithm (`validate(pool, live_count)` precedes the weight loop) and the vector's published `spec` string; move `validateLiveCount` ahead of `stage1Weighted`/`weighted` in both runtimes and add a refusal row that carries a bad `live_count` **and** a tied candidate, which is the only row that can ever redden this [worker/awards/stage1.go:378-384] [lib/roulette/stage1.ts:366-367] [roulette/vectors/generate_vectors.py:1538-1541]
- [x] [Review][Patch] The "closed set" of refusal `detail`s is not closed and the two runtimes declare different sets — Go declares **9** constants under a comment saying the set "travels in the vector" (`DetailStream`, `DetailInternal` are extra), TypeScript's `REFUSAL_DETAILS` and the vector's `refusal_details` declare **7**, and TypeScript emits `'stream'` and `'internal'` anyway, making `Stage1Error.detail`'s JSDoc ("one of REFUSAL_DETAILS") false for two live paths [worker/awards/stage1.go:96-106] [lib/roulette/stage1.ts:181-189, 154, 359, 415]
- [x] [Review][Patch] The unreachable unknown-`Outcome`-kind arm refuses with **different details in the two runtimes** — Go `DetailInternal`, TypeScript `'stage2'` — on the one arm both files' comments say a fifth Stage-2 kind will hit; pick one and pin it in both [worker/awards/stage1.go:352] [lib/roulette/stage1.ts:343-347]
- [x] [Review][Patch] The TypeScript local refusal table asserts only `rejects.toThrow(Stage1Error)` + `consumed === 0` and never `detail`, so **two guards are mutation-invisible** — deleting `Number.isSafeInteger` from `validateShelf` (row `a fractional shelf size`) or from `validateWeightTable` (row `a fractional weight`) still throws, laundered into `total_weight` three functions later, and the test stays green. This is precisely the T18 survivor class the story closed for the *shared* rows and left open here [lib/roulette/stage1.test.ts:803-826]
- [x] [Review][Patch] `toCandidates`'s doc comment claims "**Every field the walk depends on is checked here**, so a drifted vector fails a NAMED parse rather than arriving as a plausible zero" — the body performs **zero** checks and is a pure field copy, so a row that lost `priority` arrives as `Priority: 0` and surfaces as an implementation failure, i.e. exactly the plausible zero the comment says it prevents [worker/awards/stage1_test.go:91-107]
- [x] [Review][Patch] The `Stage1Weights` "draws nothing" assertion is **tautological in both suites** — a fresh stream is opened and checked for `Consumed() == 0`, but `Stage1Weights`/`stage1Weights` take no stream parameter and cannot reach it; the assertion cannot fail for any implementation, and it opens 26 streams per run to prove nothing [worker/awards/stage1_test.go:252-263] [lib/roulette/stage1.test.ts:3924-3926]
- [x] [Review][Patch] The drain row's note claims "`expected.live` is in DRAW order … it is **deliberately NOT priority order**" but its `live` is `["aw-knife","aw-hs","aw-wallbang","aw-smoke"]` = priorities 1,2,3,4, i.e. exactly ascending priority; the property "a selector that sorted its output by priority would pass every row" is therefore carried **only** by the re-draw row, and both suites check it with an unnamed any-row scan rather than against a named row [roulette/vectors/stage1-pick.json] [worker/awards/stage1_test.go] [lib/roulette/stage1.test.ts]
- [x] [Review][Patch] Guard-the-guards gap on `the-shelf-is-frozen-across-the-picks-of-one-spin` — what makes the row discriminating is that **one player sweeps all three deciding stats** (`STAGE1_ROSTER_ONE_SWEEPER`), and nothing re-derives that; all three guards check only "weights all equal" and `300`/`200`, which any roster with real winners satisfies, so the fixture could be swapped and every gate would stay green [roulette/vectors/generate_vectors.py:1797] [worker/awards/stage1_test.go:539-547] [lib/roulette/stage1.test.ts:469-480]
- [x] [Review][Patch] Same gap on the two DECISION-F rows — `every-candidate-has-no-eligible-players-and-weights-heaviest` is guarded only by "every weight is `table[0]`", which a roster where the player simply *wins* with shelf 0 satisfies identically, so the `no_eligible_players` branch could go untested while AC3 still claims it; the row's real property (`STAGE1_ROSTER_BELOW_FLOORS` vs `floor_rounds: 24`) is checkable from its own data. Also, the `noEligible.Expected.Weights` coverage loop passes on **zero iterations** — no suite asserts its length [worker/awards/stage1_test.go:590-596, 2557-2562] [lib/roulette/stage1.test.ts:529-532]
- [x] [Review][Patch] `worker/awards/stage1_test.go` is **not gofmt-clean** — `gofmt -l ./worker` returns it and nothing else, making it the only unformatted Go file in the repo (`Refusals`/`Cases` left at the old column width when `RefusalDetails` widened the struct); `go build`/`vet`/`test` are all clean, so no gate catches it [worker/awards/stage1_test.go:69-70]
- [x] [Review][Patch] `detail` diverges three ways on an oversized-but-integral weight table — TypeScript's `Number.isSafeInteger` refuses `[2**60, 1]` as `weight_table` while Go's `[]int` and Python's `isinstance(w, int)` accept it and refuse later as `total_weight`; the shipped row uses `4294967296`, which IS a safe integer, so the divergence begins one order of magnitude above anything tested [lib/roulette/stage1.ts:527] [worker/awards/stage1.go:508]
- [x] [Review][Patch] The Python anchor **crashes rather than refuses** on malformed containers (`AttributeError` in `_validate_shelf`, `KeyError`/`TypeError` in `_validate_pool`) and has **no `picked < 0` fall-through guard** where Go and TypeScript both refuse loudly — so a broken rejection bound would write a vector whose `live` is shorter than `live_count` instead of aborting generation, and both runtimes would then look broken rather than the generator [roulette/vectors/generate_vectors.py:1408, 1423, 1568-1578]
- [x] [Review][Patch] Three smaller test/vector hardenings: TypeScript has **no stream-guard test at all** (Go has `TestStage1PickRefusesANilStream`) and its guard accepts any non-null object, so `{} as Stream` throws a bare `TypeError` instead of `Stage1Error('stream')`; `validateShelf` iterates with `Object.entries` but `weightOf` reads with `Object.hasOwn`, so a non-enumerable own property bypasses validation entirely; and the case name `total-weight-one-is-the-only-zero-byte-draw` over-claims — the drain row's fourth draw is also `n=1` with `bytes_consumed_after` unchanged — with no uniqueness assertion of the kind the boundary row correctly has [lib/roulette/stage1.ts:358, 519 vs 332] [lib/roulette/stage1.test.ts] [roulette/vectors/stage1-pick.json]

**Resolution (2026-08-04):** the [Decision] was resolved by Cuatro → *a missing map IS the empty
case*, and **all 14 resulting `patch` findings were applied**. The shipped changes:

- **Validation order realigned to the anchor** — `validateLiveCount` now runs with the other shape
  checks, before the weight loop, in `stage1.go` and `stage1.ts`. Both files' headers already
  documented that order; only the code deviated.
- **`detail` is a genuinely closed set of NINE in all three**, `stream` and `internal` included,
  with the narrower seven-value rule for what a ROW may carry enforced at the generator and pinned
  in both suites. The unknown-outcome arm now refuses as `internal` on both sides.
- **Absent containers normalised** — `undefined` → `{}` / `[]` inside Stage 1 (never by loosening
  `stage2.ts`), `null` and wrong types still refused in TS/Python as a non-vectorable guard on a
  state Go cannot express. `Stage1Input.shelf`/`.players` are now optional, which is the honest type.
- **`Number.isSafeInteger` → `Number.isInteger`** on table entries and shelf sizes, so an
  oversized-but-integral value refuses as `total_weight` in all three rather than `weight_table` in
  one. `sumWeights` still re-checks precision after every addition.
- **`validateShelf` reads with `Object.getOwnPropertyNames`**, matching `weightOf`'s `Object.hasOwn`
  — the guard and the lookup now see the same set of keys.
- **The stream guard is `instanceof Stream`**, and TypeScript has a stream-guard test at all for the
  first time (four inputs, including a Stream-shaped fake).
- **Two vacuous assertions deleted, not repaired.** The `Stage1Weights` "drew nothing" check could
  not fail in either language — the function takes no stream. A test that cannot fail reads as
  coverage; the property is enforced by the signature.
- **Guard-the-guards, second pass.** `pins_inputs` at the anchor plus matching checks in both suites
  re-derive the INPUT property of the frozen-shelf row (one sweeper) and both DECISION-F rows (the
  actual outcome kind) through the real Stage 2. The draw-order property is asserted against a
  NAMED row and asserted to be unique; the drain row's false note is corrected and its priority
  order is now pinned so the claim cannot come back.
- **`toCandidates` does what its comment promised**, strictly for cases and deliberately not for the
  refusal rows, which are malformed on purpose.
- **The anchor refuses instead of crashing** on malformed containers, and gained the `picked < 0`
  fall-through guard both runtimes already had.
- **Two new vector rows**, both of which are the only rows that can catch what they cover:
  `live-count-zero-over-a-tied-pool` (the only row malformed twice) and
  `an-omitted-shelf-key-is-the-empty-shelf` (whose `expected` is byte-identical to its empty-map
  twin — that identity is the assertion). Vector is now **14 cases + 18 refusals**.
- `stage1_test.go` is gofmt-clean; `gofmt -l ./worker` is empty. The import-graph pin is over the
  SET of imported modules, so a value/type import merge no longer reddens it spuriously.

**Mutation-verified, not merely re-run.** Four mutations applied as bytes and restored with SHA-256
confirmed: reverting the validation order reddens the new refusal row in **Go** (`an INVALID-input
refusal was reported as a tie`) and in **TypeScript** (8 failures); deleting the shelf integer guard
reddens the TypeScript table that previously passed it (3 failures). Every one is killed by the
vector-driven test, not only by a local assertion.

| Gate | Before this review | After |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | 968 / 40 files | **977 / 40 files** |
| `npm run build` | 0 | **0** — every viewer route still `ƒ`, no `roulette` route |
| `gofmt -l ./worker` | `awards/stage1_test.go` | **empty** |
| `go build && go vet && go test ./...` | clean, `awards` 297 | **clean, `awards` 300** |
| `generate_vectors.py --check` | OK ×4 | **OK ×4** (the three older files still byte-identical) |
| pgTAP | 1155 / 25 | **unchanged — `supabase/**` is byte-untouched (empty `git status`)** |
| `0025` | free | **free** |

`supabase/**`, `app/**`, `lib/awards|ceremony|i18n|bracket/**` and `worker/ingest|store|db|config/**`
remain byte-untouched. DECISION A held through the review as well.

**Dismissed as noise (3):** the forward-looking `label_source.kind === 'pity'` branch in the TS test helper (unused today, 6.7's); the Blind Hunter's inability to verify the `math/big` exemption and the `N_BOUNDS` equality (an artifact of its no-project-access constraint — the Acceptance Auditor confirmed both positively); and the observation that DECISION F leaves the FR-26 luck table inert on today's corpus (correct, measured, already recorded in Completion Notes and answered by Cuatro as question 2).
