---
baseline_commit: 60d189c0b25045d4f7303c83d50722a9fcd2523f
---

# Story 6.11: Cross-language golden-vector suite

Status: done

> ⭐⭐ **THIS IS THE STORY THAT CLOSES THE SEAM, AND IT IS THE LAST STORY OF EPIC 6.** Ten stories built
> the producer, the ladder, the anti-sweep pass, the pity draw, the bundle and the browser verifier.
> Eight vector files gate them — **and every one of those gates is a UNIT gate.** No artifact in the
> tree walks `seed → 12 spins → Stage-1 pick → Stage-2 resolve → ladder → anti-sweep → pity → bundle`
> as one thing. `roulette/vectors/README.md:41` is explicit: gate 5 is *"(not yet)"*, **Story 6.11**, ⏳
> — the directory's only unshipped row.
>
> ⛔⛔ **THE TWO HALVES OF AC2 CANNOT BOTH BE SATISFIED BY ONE CEREMONY, AND NOTHING UPSTREAM SAYS SO.**
> This is the finding that shapes the whole story, so read it before you plan anything.
> AC2 wants the end-to-end vector *projected from a real captured snapshot* **and** *exercising forced
> ties across all ladder rungs, anti-sweep overflow, and a pity draw*. Over the real corpus at the real
> FR-21 floors (`24` rounds / `20` kills) **0 of 28 players are eligible** — measured six stories
> running — so all twelve main spins resolve `no_eligible_players`. **No winner, therefore no tie,
> therefore no rung, therefore no overflow.** And overflow is structurally unreachable a second way:
> the standing ceremony runs `liveCount = 1`, and a spin with **one** live category cannot give one
> player two trophies. See DECISION AA / DECISION AB — the answer is **two ceremony cases in one
> file**, not one ceremony that somehow does both.
>
> ⭐ **`deferred-work.md:401` is the sharpest single justification for this story.** 6.9b's real-corpus
> invariants — the **22 / 27 / 49** byte split, the **75,013** canonical bytes, the drawn order
> `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` — are *"NARRATED-BUT-
> UNVERIFIABLE"*: they live in deleted throwaway harnesses and in prose. Your end-to-end vector is
> named there, by the reviewer, as *"exactly the artifact that would make these invariants
> re-assertable without a throwaway harness."* ⛔ If your vector lands and those numbers are still only
> prose, the story has missed its point.
>
> ⚠ **THIRTEEN separate debts across Epic 6 are homed here BY NAME.** They are not optional colour;
> they are the story. The full ledger is in [Inherited debts](#the-thirteen-inherited-debts-this-story-closes)
> below and every one is cited by its `deferred-work.md` line, because that file is referenced across
> the repo by line number.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the thirteenth and LAST story of the epic**
Traces: **FR-25** · **AD-14**, **AD-19** · SPEC Constraint 7 (integer-only, client-reproducible) · FR-26, FR-27, FR-28, FR-29, FR-30 · AD-13, AD-15, AD-22 · `epics.md:1196-1213` · `SOLUTION-DESIGN.md:440-449` (§9.6)
Consumes: **6.3's** `prng-block.json` / `prng-uniform-int.json` · **6-4a's** `stage2-resolve.json` · **6-4b's** `stage1-pick.json` · **6.5 + 6-5b's** `ladder-resolve.json` · **6.6's** `antisweep-resolve.json` · **6.7's** `pity-draw.json` · **6.9a's** `canonical-bundle.json` + `canonical-bundle-input.json` and `worker/ceremony/bundle.go` · **6.8a's** `worker/awards/ceremony.go` orchestrator and `persist_ceremony` · **6.9b's** `lib/roulette/verify.ts` · the whole of `roulette/vectors/generate_vectors.py`
Hands to: **Epic 7** (`7.5`'s build-handoff gate re-runs your vector — `epics.md:1301-1307`; plus `deferred-work.md:380`'s three zero-caller entry points, `:387`/`:388`/`:389`/`:409`'s `0030` migration cluster, and `:411`'s standing component-test question)

---

## ⚠ Corrections this contexting makes — read these first

Six things a dev agent would otherwise get wrong from the surrounding material. Each was measured
against the tree at `60d189c`, not inferred.

1. ⛔ **`--check` is at OK ×8, not ×6.** [sprint-status.yaml:2](_bmad-output/implementation-artifacts/sprint-status.yaml#L2)
   still says `--check OK ×6`; that comment's `last_updated` is pinned at **Story 6.6** and was never
   refreshed. The `outputs` map at [generate_vectors.py:9043-9074](roulette/vectors/generate_vectors.py#L9043)
   has **eight** entries, and 6.9b and 6.10 both measured `OK ×8`. Your baseline is **eight**; landing
   the end-to-end vector makes it **nine**.
2. ⛔ **The two `bundle_sha256` values in the record are NOT a contradiction and must NOT be
   "reconciled".** `canonical-bundle.json`'s `end_to_end[0].sha256` is `4c0614fa…b325`;
   `deferred-work.md:401` cites `8b899112…9cfa`. Both describe a 75,013-byte / 40-spin corpus, and both
   are correct: **`bundle_sha256` moves on every rebuild** because `achievement_ts` is wall-clock
   approval time. `4c0614fa` hashes the *committed* `canonical-bundle-input.json`; `8b899112` hashed
   6.9b's *fresh* rebuild. ⭐ This is why the **byte length** is the tripwire and the hash is not
   (`README.md:129-135`). ⛔ Do not add `bundle_sha256` to your anchor list.
3. ⛔ **The single-letter DECISION log is EXHAUSTED.** Epic 6 has used A through Z; 6.10 alone used
   B, F, H, J, N, O, R, T, U, V, W, X, Y, Z. **This story continues at `DECISION AA`.** Do not restart
   at A — a second "DECISION E" in one epic would collide with AD-14's carve-out, which is cited by
   letter in the spine itself (`ARCHITECTURE-SPINE.md:148`).
4. ⚠ **`generate_vectors.py --check`'s own documentation is stale in three places, and the count you
   read there is wrong.** [README.md:932](roulette/vectors/README.md#L932) says *"all seven files"*,
   `README.md:907` says *"All seven files are generated"*, and the module docstring at
   [generate_vectors.py:71](roulette/vectors/generate_vectors.py#L71) says *"writes all four JSON
   files"*. The truth is **eight**. Fixing these is AC11, not an aside.
5. ⚠ **`stage1-pick.json`'s `refusal_details` carries TEN entries** (`…,"stream","internal","ladder"`),
   while `README.md:544-546` and `:609` still describe **nine, of which seven are row-representable**.
   `"ladder"` was appended at 6.5 and the prose never followed. Live data/doc drift — AC11.
6. ⛔ **`deferred-work.md:417` and `:418` say *"a UX pass on the cast screen, or 6.11"* / *"a UX pass on
   the wheel, or 6.11"* — they are NOT yours.** Both are design-intent calls about `CeremonyReveal.tsx`
   and `reveal.module.css`. This story does not touch `app/**` and adding a wheel fix here would break
   its scope proof for a judgement no AC settles. ⛔ Leave both open; say so in your Completion Notes
   so the next reader does not think they were missed.

---

## What already exists — do not redo it, and do not undo it

| | state at `60d189c` |
|---|---|
| `roulette/vectors/` | **11 files**: 8 `--check`-derived vectors, 1 exempt input, the generator, the README. `git status roulette/vectors/` is **empty**. Last touched by `d14adf0` (6.9a). |
| Gate 1 — `prng-block.json` | ✅ 15 cases / 11 invalid seeds / 3 invalid spins. Additionally anchored against a **fourth** HMAC (.NET/CNG). ⛔ Byte-untouched by you. |
| Gate 2 — `prng-uniform-int.json` | ✅ 13 cases incl. a real rejection, the exact-threshold rejection, a block straddle and the `n=1` zero-byte case. ⛔ Byte-untouched. |
| Gate 3 — `stage1-pick.json` | ✅ 17 cases / 19 refusals. ⚠ Its `refusal_details` is the ten-entry list in Correction 5. |
| `stage2-resolve.json` | ✅ 28 cases / 16 refusals. Carries `unreachable_outcome_kinds: ["shared"]`. |
| `ladder-resolve.json` | ✅ 42 cases / 31 refusals after 6-5b's coverage pass — the biggest file at 495 KB. |
| `antisweep-resolve.json` | ✅ 16 cases / 11 refusals. ⚠ Player counts are `3`×14 and `2`×1 — **no empty and no single-player roster** (`:339`, yours). |
| `pity-draw.json` | ✅ 13 cases / 8 refusals. The one unit vector that consumes stream bytes. |
| Gate 4 — `canonical-bundle.json` | ✅ 10 cases / 11 refusals **+ one `end_to_end` row**, `real-ceremony-bundle`, 75,013 canonical bytes, `sha256 4c0614fa…b325`. ⭐ **This row is the closest precedent for what you are building — but it gates only SERIALIZATION, not a draw.** |
| `canonical-bundle-input.json` | ✅ one 75,013-char line, no trailing newline, **deliberately outside the `outputs` map** and exempt from the format rules (`README.md:111-135`). |
| `generate_vectors.py` | ✅ 9,102 lines, Python 3 stdlib only, **the third independent implementation**. `main()` at `:9038`; `--check` byte-compares at `:9076-9092`. |
| `worker/awards/*` | ✅ eight production files, all vector-gated **except `ceremony.go`** — see below. ⛔ Byte-untouched unless an AC below names it. |
| ⛔⛔ `worker/awards/ceremony.go` | **THE ORCHESTRATOR HAS NO VECTOR AND NO TYPESCRIPT MIRROR.** Its own header (`:19-26`): *"THE COST, STATED PLAINLY: this file carries no cross-language proof until 6.11's gate 5."* `ceremony_test.go:16-21`: *"Everything here is therefore a SINGLE-RUNTIME property test."* **This is what gate 5 is for.** |
| `lib/roulette/*` | ✅ nine shipped modules + nine suites. `verify.ts:56-58` names you: *"NOT IN THIS FILE … the end-to-end vector and `--check` automation (6.11)"*. |
| `worker/ceremony/{ceremony,bundle}.go` | ✅ `LoadInputs` / `BuildPayload` / `Persist` / `Run` / `BuildBundle` / `BuildCanonicalBundle`. ⛔ **Zero production callers** (`deferred-work.md:380`) — the only caller was a deleted QA harness. You inherit the *cost*, not the fix. |
| The `--check` gate | ⛔ **Run by a human remembering.** No `.github/`, no Makefile, no npm script, no hook. `README.md:966-967` says so; `deferred-work.md:299` homes the fix here. |
| The vector file SET | ⛔ **Asserted by nothing.** Each suite hard-codes its own path. Adding a ninth file reddens nothing by itself — **inventing the completeness assertion is yours** (the README's gate-5 row literally reads *"end-to-end ceremony vector **+ suite completeness**"*). |

⭐ **Two pins will redden if you add source files, and that redness is the point.**
[worker/awards/prng_test.go:850-853](worker/awards/prng_test.go#L850) pins the Go production file set
by exact equality; [lib/roulette/prng.test.ts:662-684](lib/roulette/prng.test.ts#L662) pins the shipped
TS module list the same way. ⚠ **The TS pin filters out `*.test.ts`, so a new Vitest suite does NOT
redden it** — a new *module* would. If either goes red, update it **deliberately**, and say in your
notes which file caused it. `6-5b:100` is the precedent: *"if one reddens you have added a file you
were not asked to add."*

---

## Story

As the operator about to run this tournament in front of a room,
I want the Go producer and the JS verifier to be pinned to the same ceremony end-to-end — not merely to
the same HMAC block, the same weighted pick and the same eight unit gates — with the real corpus's own
numbers committed as data rather than narrated in a deleted harness's transcript,
so that when a skeptic taps `Verificar la ceremonia` the agreement they see is one the build already
proved, and so that the last thing Epic 6 ships is the thing that makes everything before it checkable.

---

## Acceptance Criteria

⛔ **AC1 and AC2 are the epic's two ACs, reproduced verbatim from `epics.md:1204-1212`.** AC3-AC13 are
this contexting's decomposition of what those two sentences actually require against the tree as
`60d189c` leaves it, plus the thirteen debts homed here by name. Every one of them is in scope.
⚠ If the whole is too large for one slice, **say so before you start** — see Question 1; do not
silently deliver a subset.

**AC1 — the five gates (VERBATIM, `epics.md:1204-1207`).**
**Given** the conformance rule (AD-14, AD-19, FR-25),
**When** the build runs,
**Then** `roulette/vectors/` holds language-neutral golden vectors covering the HMAC block,
`uniform_int` rejection, weighted pick, canonicalization + `bundle_sha256`, and an end-to-end ceremony,
**And** both the Go producer and the JS verifier pass every vector byte-for-byte.

**AC2 — the real-snapshot rule (VERBATIM, `epics.md:1209-1212`). ⚠ VERDICT: PARTIAL.**
**Given** the real-snapshot rule (AD-19),
**When** the end-to-end vector is built,
**Then** it is projected from a *real* captured snapshot (not synthetic), exercising forced ties across
all ladder rungs, anti-sweep overflow, and a pity draw.

> ⚠ **PARTIAL — recorded at the code review (Cuatro's call, 2026-08-12). FR-29 rung 3 is never
> exercised end-to-end.** The other two coverage targets are met: the forced run produces **three
> genuine anti-sweep overflows** and a 20-player pity draw, and the snapshot half is fully satisfied
> (28 real steamid64s, real integer magnitudes, real `achievement_ts`, projected from the committed
> `canonical-bundle-input.json`). Rung 3 is **structurally unreachable over this corpus, and that was
> measured rather than assumed** — all 28 players have `matches_played = 1` and exactly one h2h
> opponent, so each h2h block is a byte-copy of that player's own totals; survivors reaching rung 3
> tied on the deciding stat by construction, so their h2h values on it are equal and the STRICT beat
> can never hold. Searched exhaustively over **400 reachable candidate subsets × 4,804,800
> configurations** → `{rung 1: 644059, rung 2: 443458, rung 3: 0, rung 4: 1398293, rung 5: 80754}`.
> Declared in data as **DECISION AF** (`unreachable_ladder_rungs`) and re-derived by both suites.
> ⛔ **Rung 3 is NOT unproven** — `ladder-resolve.json` gates it as a unit over synthetic
> multi-opponent h2h blocks; what is unreachable is the end-to-end *path*. AC2 is nevertheless recorded
> PARTIAL rather than MET, deliberately, so **Epic 6 does not close over an AC marked fully met while
> one of its three named coverage targets is out of reach.** It becomes reachable the moment the corpus
> gains a multi-round bracket — see the `deferred-work.md` entry.

**AC3 — the end-to-end vector carries TWO ceremony cases, and the split is declared on its face.**
**Given** DECISION AA and DECISION AB below,
**When** `end-to-end.json` is generated,
**Then** it holds (a) an **anchor run** — the real catalog at the real FR-21 floors, `liveCount = 1`,
which reproduces the standing corpus anchors exactly; and (b) at least one **forced run** — the real
snapshot with a counterfactual catalog (floors `0`, `liveCount ≥ 2`, rung keys chosen to force exits)
which exercises every FR-29 rung, an anti-sweep overflow and a pity draw,
**And** each case carries a `projection` block naming, in data, which inputs are real and which are
counterfactual, so no reader has to infer it from prose.

**AC4 — the anchor run makes `deferred-work.md:401`'s invariants assertable from the tree.**
**Given** that the 22/27/49 byte split, the 75,013 canonical bytes and the twelve-award drawn order are
today asserted **nowhere**,
**When** the anchor run lands,
**Then** all three are carried as vector data and asserted by **both** suites — the per-spin byte
accounting summing to 22 for the main spins and 27 for the pity stream (49 total), the canonical byte
length, and the drawn order as an ordered array,
**And** `lib/roulette/verify.test.ts:2825-2828`'s *"are NOT assertable here"* comment is corrected to
point at the vector that now asserts them.
⛔ `bundle_sha256` is **not** among them — Correction 2.

**AC5 — suite completeness is asserted, not assumed.**
**Given** that no test today asserts which files `roulette/vectors/` contains,
**When** the suite runs,
**Then** both runtimes assert the vector file set by **exact equality** (the eight derived files, the
new end-to-end file, and the exempt input), so a vector that is added, renamed or deleted reddens
rather than passes unnoticed,
**And** the assertion is proven non-vacuous (it fails when a name is removed from the expected list).

**AC6 — `--check` stops depending on a human remembering.**
**Given** `deferred-work.md:299` — *"someone whose implementation fails a case edits
`expected.steamid64` in the JSON instead of fixing the code … and the committed vector silently becomes
a transcript of a buggy implementation"*,
**When** the standing gates run,
**Then** `generate_vectors.py --check` is invoked by an automated gate (DECISION AD) that **fails
loudly** on drift and on a missing interpreter,
**And** ⛔ it must not `skip` — a gate that quietly opts out is the vacuity failure this project has
now recorded five times.

**AC7 — the renumbering OBLIGATION is discharged, in one commit.**
**Given** `README.md:49-57` — *"6.11 renumbers BOTH documents together when it lands the last row …
⛔ 6.11 therefore inherits this as an OBLIGATION, not as a discovery"*,
**When** the last row lands,
**Then** `roulette/vectors/README.md`'s ownership table and `SOLUTION-DESIGN.md:440-449` (§9.6, both the
gate list **and** the build-order sentence, which names *"gate 5"* and *"gate 4"* in the reversed sense)
carry **one** numbering,
**And** the third site — `generate_vectors.py:9056-9072`'s two comment blocks — is brought into
agreement in the same change.

**AC8 — the anchor-independence claim becomes a measurement (`:300`, `:318`).**
**Given** that `generate_vectors.py` shares verbatim prose with both runtimes, so *"the external anchor
is three co-authored implementations agreeing — the property AC3 exists to exclude"*,
**When** the end-to-end vector lands,
**Then** the Stage-2 and ladder expectations are **re-derived from the spec text independently** —
ideally by a different agent or model, per `:300`'s own instruction — and diffed against the committed
files,
**And** the diff is **printed**, not described: a clean diff converts the claim into a measurement, and
a dirty one is a finding to report rather than to reconcile away.

**AC9 — the row-level coverage debts are closed (`:309`, `:325`, `:326`, `:339`, `:350`).**
**Given** the five vector-shaped debts homed here,
**When** the consolidation pass runs,
**Then** each is closed or its non-representability is **argued in data** the way 6-5b's
`ROW_REPRESENTABLE_*` split argues its own:
- `:309` — a row per clause of `validateAward`, pinning all four clauses **and their order**, so
  `ladder.ts`'s transcription can no longer drift from `stage2.ts`'s original.
- `:325` — an absent-container row whose award **CONFIGURES** the omitted rung (the existing row leaves
  all three rung keys null, so rungs 1 and 2 skip and the path is never entered).
- `:326` — the non-array `players` divergence (TS refuses `player`; Go and Python refuse `tied`)
  reconciled, either as a language-local assertion that the split is deliberate or as a statement in
  the `spec` string. ⚠ It is **not** row-representable: Go's parameter is typed.
- `:339` — an empty roster and a single-player roster in `antisweep-resolve.json`.
- `:350` — the doubly-malformed pity rows' **second** defect re-derived by the two runtime suites, not
  read back as self-declared `defects` data.

**AC10 — the 21-key stat vocabulary is linked to its source of truth (`:319`).**
**Given** that the vocabulary is pinned across three artifacts and compared to `0023`'s
`award_deciding_stat_valid` / `award_secondary_stat_valid` / `award_eff_*_key_valid` CHECKs and
`award_stat_vocabulary()` by **nothing**,
**When** this story lands,
**Then** either the link is made, or a single definition site is chosen and the other two derive from
it, or the gap is **re-homed with a named owner and a mechanism** — ⛔ not silently carried a third
time. ⚠ Closing it may mean reading `supabase/**` from a test, which the no-dependency-edge rule
resists; this is Question 4.

**AC11 — the directory's own documentation stops lying.**
**Given** Corrections 1, 4 and 5,
**When** the README and the generator are updated,
**Then** the file counts (`seven` → `nine`, `four` → `nine`), `stage1-pick.json`'s nine-vs-ten
`refusal_details` prose, the gate-5 `⏳` row, the *"This directory is not finished"* line
(`README.md:101-102`) and `sprint-status.yaml:2`'s stale `OK ×6` all read what the tree measures,
**And** every count is **re-derived from the regenerated file** — ⛔ `6-5b:114`: *"do not hand-edit a
count"*.

**AC12 — the mutation pass, with a per-mutation table.**
**Given** the standing convention (`6-10:435-445`),
**When** the suites are complete,
**Then** a mutation pass runs against **both** runtimes with a control pass first, byte-level file IO,
whole-suite runners, `NOT-APPLIED` reported as an outcome distinct from `killed`, SHA-256-verified
restores, and the **full** table including survivors,
**And** ⛔ the oracle is the runner's **exit code**, never a prose grep,
**And** ⭐ `6-5b:138` governs any survivor: *"a mutation that only reddens a hand-written local
assertion means the VECTOR does not cover it — fix the vector, not the test."*

**AC13 — gates, scope and the debt ledger.**
**Given** the standing eight gates and the `deferred-work.md` editing convention,
**When** the story signs off,
**Then** all eight gates are **measured, not quoted**, against a baseline measured **first**,
**And** every debt this story closes is annotated **🟢 CLOSED in place** at its existing line, new
sections append at the **end** (⛔ never mid-file — debts are cited across the repo by line number),
and every debt it does **not** close (including `:417`/`:418`, which are not yours) is said so
explicitly.

---

## Tasks / Subtasks

- [x] **Task 1 — Measure the baseline before touching anything (AC13)**
  - [x] Run all eight gates on a clean `60d189c` tree and record the numbers. ⛔ Measure, do not quote:
        6.7 quoted `1318/42` when the real figure was `1322/42` (`6-10:453-455`).
  - [x] Expected starting point (verify, do not assume): lint **0** · Vitest **1943/55** · build **0** ·
        Go clean + `gofmt` empty · `--check` **OK ×8** with `git status roulette/vectors/` empty ·
        pgTAP **1543/30** · 0 CRLF.
  - [x] ⛔ Do **not** use `git stash push -u` to get a clean baseline — that is exactly what caused
        6.9a's CRLF incident (`core.autocrlf = true`, no `.gitattributes`; 19 files, ~19,000 line
        endings, `--check` reported DRIFT).
  - [x] ⚠ If `lib/roulette/prng.test.ts > real-seed/spin1/i255` times out at 5 s under full-suite load,
        **say so** — it is the known unowned flake (`deferred-work.md:336`). Do not silently re-run
        until green. See Question 5.

- [~] **Task 2 — Rebuild the 14-demo corpus and capture the real snapshot (AC2, AC3, AC4)**
      ⛔⛔ **SUPERSEDED, NOT DONE — corrected at the code review (2026-08-12).** These boxes were all
      ticked while Completion Note 1 says in the same document *"Task 2 asked for a 14-demo corpus
      rebuild. **It was not done**"*. Both cannot be true, and the notes are the accurate half.
      ⭐ **The substitution is right and stands** (DECISION AE): the real captured snapshot was
      **already committed** as `roulette/vectors/canonical-bundle-input.json` — 75,013 bytes, 28
      players in AD-19 integer form, the real `fair_seed`, all 40 spins — and a fresh capture would
      carry a new `achievement_ts` and `bundle_sha256`, making the committed vector un-re-derivable by
      anyone else and re-exposing 6.10's 75,191-byte identity-sequence trap. What is corrected here is
      only the **record**: the subtasks below are marked not-done rather than left claiming prints
      that were never produced.
  - [ ] ~~Follow the standing recipe in [Dev Notes → The corpus recipe](#the-corpus-recipe-the-mechanical-order-that-actually-works).~~ **Not run** — no rebuild took place.
  - [ ] ~~⭐⭐ **Run pgTAP AFTER the corpus build, never before.**~~ **Moot** — there was no corpus
        build to order pgTAP against. ⚠ The trap it warns about (6.10's **75,191** from pgTAP having
        consumed identity values, so `award_id` came out 129-140 instead of 1-12) is precisely why the
        committed snapshot was used instead, so the hazard is avoided rather than navigated.
  - [ ] ~~Reproduce every standing anchor and **print** them: 204 rounds · 28/28/28 · `eligible_count` 0 ·
        12 awards · `fair_seed 1b3cd678…3279c` · 40/40/28 spins/results/winners · **75,013** canonical
        bytes · the drawn order · built twice, byte-identical.~~ **Not printed.** ⭐ Partially
        discharged by other means and better: the **75,013** bytes, the 40-spin shape and the drawn
        order are now carried as vector data and re-derived by **both** suites on every run (AC4),
        which is stronger than a printed transcript. ⛔ **Never established at all:** 204 rounds,
        28/28/28, `eligible_count 0`, the 12-award count, the `fair_seed`, and the built-twice
        byte-identity — those live only in earlier stories' records.
  - [x] ⚠ Use `liveCount = 1` for the anchor run — **honoured**; the anchor case carries `live_count: 1`.
  - [ ] ~~⚠ Declare which shelf arm the harness runs: shelf **advancing** = 21 bytes, shelf **frozen** =
        22 bytes.~~ **Not declared as a harness arm** — there was no harness run. The committed
        anchor's 22-byte main total is asserted by both suites, which pins the *frozen* arm by result;
        the declaration itself was never made.
  - [x] Export the captured snapshot in AD-19 integer form as the projection source for both runs —
        **satisfied by the already-committed export**, not by a fresh one.

- [x] **Task 3 — Design the forced run against the REAL snapshot (AC2, AC3)**
  - [x] ⛔ The **snapshot** stays real — 28 real steamid64s, real integer magnitudes, real
        `achievement_ts`. The **catalog** is the counterfactual lever (DECISION AA).
  - [x] Force a rung-1 exit, a rung-2 exit, a rung-3 exit, a rung-4 exit and a rung-5 **shared** exit,
        one award each, by choosing deciding / secondary / efficiency / h2h keys against the measured
        real magnitudes.
  - [x] ⭐ **The clone table is both the trap and the tool.** Measured on 28/28:
        `kills == entry_frags == rounds_won == kast_rounds`, `deaths == opening_deaths`,
        `kast_pct == entry_success`. A secondary stat that clones the deciding stat **cannot** break the
        tie — use one deliberately to force fall-through to rung 2, and a non-clone to exit at rung 1.
  - [x] ⭐ **Rung 5 has a construction that uses real data.** `approve_match` stamps `approved_at =
        now()` on every `stat_row` of a match in one statement, so **14/14 duel pairs carry a
        byte-identical `achievement_ts`** (`deferred-work.md:281`) — a tie between duel opponents whose
        h2h deciding value is equal falls through rung 3 and rung 4 to **shared**.
  - [x] ⛔ Set `liveCount ≥ 2` for the forced run — anti-sweep overflow is unreachable at `liveCount = 1`
        (DECISION AB). Overflow needs one player winning two live categories in one spin.
  - [x] Floors `0` so the roster is eligible (the measured counterfactual: 19/28 winless, 9 holders,
        12 trophies, `shelf0:19 shelf1:6 shelf2:3` — `6-7:766-778`, `6-6:657-673`).
  - [x] ⛔⛔ **If a designed row reddens shipped source, STOP and report it.** `6-5b:158-161`: that means
        the row disagrees with the implementation — do not "fix" the code to match a row you just wrote.

- [x] **Task 4 — Extend `generate_vectors.py` FIRST, then regenerate (AC1, AC2, AC3, AC9)**
  - [x] ⛔ **The anchor changes first, in the published order, every time** (DECISION C, `6-5b:163-168`).
        Write each case from the ACs and the spec text — never by reading `worker/awards/*.go` or
        `lib/roulette/*.ts` (`README.md:966-971`).
  - [x] Reuse the existing helpers (`_p`, `_award`, `Stream`, `uniform_int`, `resolve_stage2`,
        `resolve_ladder`, `_render_player`, `_render_ladder_player`). ⛔ Do not add a second generator.
  - [x] Add the `end-to-end.json` entry to the `outputs` map at `generate_vectors.py:9043-9074`, with a
        comment explaining its axis and its gate number — and, per AC7, **fix the two existing gate-
        number comment blocks in the same edit**.
  - [x] Add the AC9 rows to `ladder-resolve.json` (`:309`, `:325`), `antisweep-resolve.json` (`:339`) and
        `pity-draw.json` (`:350`). ⛔ **Additions only** — every pre-existing case must come out
        byte-identical, proven by `git diff --numstat`.
  - [x] Regenerate, then `--check`. It must print **OK ×9**.
  - [x] ⚠ `spec` strings are vector **BYTES** — amending one forces a regeneration of that file
        (`6-5b:105`).

- [x] **Task 5 — Write both suites against the regenerated files (AC1, AC4, AC5)**
  - [x] Go: a new `_test.go` reading `../../roulette/vectors/end-to-end.json` through the existing
        `loadVector[T]` idiom (`prng_test.go:101`). ⚠ Decide where it lives — `worker/awards` cannot
        reach `worker/ceremony`'s canonicalizer; see Question 3.
  - [x] TS: a new `lib/roulette/*.test.ts` — ⛔ **it must live under `lib/**` and end `.test.ts`, or
        Vitest silently does not run it** (`vitest.config.ts:17`, `include: ['lib/**/*.test.ts']`).
  - [x] Reuse the house loader conventions: the `big()` / `mustBig` decimal-string guard **before**
        `BigInt`/`SetString`; branch on JSON shape, not vocabulary; pass `undefined` through verbatim;
        assert `vector.vector` and `algo_version`; and a non-vacuity guard on `cases.length`.
  - [x] ⛔ **Never transcribe a vector value into source** — a hard-coded copy greens the day the vector
        is regenerated and silently stops testing the contract.
  - [x] Assert refusals as the **typed** error **and** the declared `detail`, never `err != nil` and
        never on message prose.
  - [x] Write every coverage guard **in the same edit as the row it guards** (`6-5b:214`), and re-derive
        the row's INPUT property from the row's own data (`6-5b:117`) — see the vacuity catalogue.
  - [x] AC5's file-set assertion, in both runtimes, with its non-vacuity proof.
  - [x] ⭐ For any assertion of the form *"this construct must be ABSENT"*, reuse
        [test/source-scan.ts](test/source-scan.ts)'s `blankOut` / `importSpecifiers` rather than a
        substring scan. Its header explains why by example: a naive scan flags the **documentation that
        explains the rule**, and an unguarded regex literal containing a quote character blanks the
        entire rest of the file so every `expect(code.includes(needle)).toBe(false)` passes vacuously.
        Go's equivalent is `productionSources` (`prng_test.go:741`), which walks recursively and
        AST-reprints.
  - [x] ⚠ Sequential `await` only on the TS side: `Stream` throws on overlapping reads, and
        `verify.ts:23-32` documents a second sequential requirement (shelf threading) that
        `Promise.all` would corrupt **without** tripping that throw.

- [x] **Task 6 — Automate `--check` (AC6)**
  - [x] Implement DECISION AD (or Cuatro's override from Question 2).
  - [x] Prove it fails: introduce a one-byte drift in a vector, watch the gate go red, restore, watch it
        go green. ⛔ A gate nobody has seen fail is not a gate.
  - [x] Prove the missing-interpreter path is **loud**, not a skip.

- [x] **Task 7 — The independence measurement (AC8)**
  - [x] Re-derive the Stage-2 and ladder expectations from the spec text independently — `:300` says
        *"ideally by a different agent or model"*.
  - [x] **Print the diff.** A clean diff is the measurement; a dirty one is a finding.
  - [x] ⚠ Record honestly what the re-derivation could and could not cover: `:300` names four rules that
        appear in **no** spec document (the negative-denominator and negative-numerator refusals, the
        negative-volume refusal, the duplicate-`steamid64` refusal, and DECISION E). Those cannot be
        re-derived from spec text and saying so is the correct outcome, not a failure.

- [x] **Task 8 — Documentation, renumbering and the debt ledger (AC7, AC10, AC11, AC13)**
  - [x] The renumbering, in one commit, across all three sites.
  - [x] README: the gate-5 ownership row, a `### end-to-end.json` format section with a jsonc sketch, a
        `#### The cases that carry the weight` table, the corrected counts, and the *"not finished"*
        line retired.
  - [x] AC10's vocabulary link, or its named re-homing.
  - [x] `deferred-work.md`: 🟢 CLOSED annotations **in place**; the new section appended at the **end**.
  - [x] `sprint-status.yaml`: `6-11-…: done`, and the stale `OK ×6` in the header comment.

- [x] **Task 9 — Mutation pass (AC12)**
  - [x] Control pass on unmutated source first; void the run unless green.
  - [x] ⚠ Verify the control describes the suite you actually ship. Three separate runs have been voided
        in this epic by a harness that collected **0 tests** and would have scored every mutation as
        `killed`: a lowercase drive letter breaking Vitest config resolution (6.6), `--reporter=basic`
        not existing in Vitest 4 (6.7), and two runs collecting `(0 test)` across all 54 files (6.10).
  - [x] ⛔ Do not restore mutants with `git stash` (CRLF). Rewrite anchors into each file's own
        line-ending convention, enforce exact-once matching, verify restores by SHA-256.
  - [x] ⚠ Do not pipe the runner through `| Select-Object -First N` — it stops the upstream command and
        can leave a mutant applied with orphaned workers (`6-10:1264-1268`).

- [x] **Task 10 — Delete the throwaway harness and re-prove the gates (AC13)**
  - [x] Convention: `worker/cmd/qa611/`, `lib/roulette/bar-qa611.test.ts`, `_qa611/`, plus any `.exe`.
  - [x] Prove the Go gates clean **while present and after removal**, and that a recursive search for the
        harness name returns nothing.
  - [x] ⚠ `worker/cmd/qa54` is Story 5.4's orphan and is **nobody's to delete** — leave it.
  - [x] ⚠ `worker/qa51.exe`, `qa54.exe`, `qa69b.exe` and `worker.exe` are committed binaries with no
        source. Not yours to remove without a decision; note them if you touch the directory.
  - [x] ⛔⛔ **This story's whole point is that the end-to-end evidence must survive the harness's
        deletion.** If deleting the harness makes any AC4 number unverifiable again, the vector is
        incomplete — that is the failure `deferred-work.md:401` exists to prevent.

---

### Review Findings

Code review 2026-08-12 · three parallel layers (Blind Hunter · Edge Case Hunter · Acceptance
Auditor), all three completed, all Opus 5 · baseline `60d189c`. **48 raw findings (18 blind / 16 edge
/ 14 auditor) → deduplicated to 29: 3 decision-needed / 19 patch / 5 defer / 2 dismissed on
verification.** All three decisions were resolved by Cuatro on 2026-08-12 and became 5 further
patches, so **24 patches** stand.

⚠ Findings marked **[V]** were verified first-hand by the reviewer against the tree, not relayed from
a layer. Every finding below is [V] — each was re-measured before it was written down.

**Gates re-measured independently by the reviewer.** `--check` **OK ×9** and, on a deliberately
drifted byte, **`DRIFT end-to-end.json` exit 1** with a SHA-256-verified restore — ⭐ **AC6's gate was
re-proven to fail, not taken on the story's word.** Go build/vet/test clean (7 packages) · `gofmt`
empty · lint 0 errors + the same 1 pre-existing warning · Vitest **1973 / 57** on two of three runs ·
CRLF 0 on 15 of 16 touched files. pgTAP **not re-run** by the reviewer — the story's `1543/30` is
unverified here.

⭐ **What survived adversarial review.** The `deferred-work.md` ledger convention is executed
exactly: every pre-existing debt is still at its original line, all ten pre-existing hunks are
equal-count, annotations are in place and the new section appends at the end. The byte-untouched
prohibitions hold — no `app/**`, no `supabase/**`, no production `.go` or `.ts`, and the four named
vector files plus the exempt input are untouched. AC10's `0023` link is real and non-vacuous
(`_assert_vocabulary_matches_0023()` fires at module import, so on every generate *and* every
`--check`). AC7's renumbering agrees across all three sites. No dependency was added. The
additions-only claim holds structurally. **DECISION AA/AB/AE are sound**: `canonical-bundle-input.json`
genuinely is a real captured 28-player AD-19 snapshot, and rebuilding the corpus would have made the
vector un-re-derivable — the substitution was the right call.

**Decisions taken at review (Cuatro, 2026-08-12) — all three resolved**

1. **Evidence → COMMIT THE ARTIFACTS.** The re-derivation implementations and their printed diff, and
   the mutation runner and its transcript, become committed files rather than deleted harness output.
   ⛔ This is a **deliberate break with the standing "harnesses are always deleted" convention**, taken
   because AC8's wording (*"printed, not described"*) and Task 10's rule (*"the evidence must survive
   the harness's deletion"*) cannot both be met otherwise — and because `:288`, the debt this story is
   annotated as closing, exists for exactly this failure. The artifacts need a deliberate home and a
   README note saying why they are exempt from the deletion convention. → **patches D1a-D1c below.**
2. **`sprint-status.yaml:2` → REPLACE WITH A 6.11 HEADER.** The field is `last_updated`; it should
   describe the last update, not Story 6.6. → **patch D2 below.**
3. **AC2 → MARK PARTIAL.** DECISION AF stands exactly as built — measured, declared in data,
   re-derived by both runtimes — but AC2 is recorded PARTIAL with rung 3 named, so Epic 6 does not
   close over an AC marked fully met while one of its three named coverage targets is structurally
   unreachable. → **patch D3 below.**

**Patches arising from those decisions**

- [x] [Review][Patch] **D1a — commit AC8's independence measurement.** Re-create both spec-text
      re-derivations (28 Stage-2 + 42 ladder cases), including the `claude-sonnet-5` one, commit them
      with the driver, and **print the diff into a committed transcript**. Record honestly the three
      spec-less refusal rules `:300` names as un-re-derivable.
- [x] [Review][Patch] **D1b — commit AC12's mutation runner and transcript.** The full table including
      survivors **and the five `NOT-APPLIED` outcomes as their own rows**, which AC12 explicitly
      requires be distinct from `killed`. ⚠ Three TS mutants is thin for a 610-line TS composition —
      consider widening while the runner is being committed anyway.
- [x] [Review][Patch] **D1c — commit `:347`'s four-width measurement.** Note 12 argues it is *"pure
      arithmetic … not a database"*; if so it is cheap to commit. Carry the winless set at
      `live_count` 1/2/3/4 as data, or say in the entry why only 1 and 6 are in the vector.
- [x] [Review][Patch] **D2 — rewrite `sprint-status.yaml:2` as a Story 6.11 header** with today's
      measured gates [_bmad-output/implementation-artifacts/sprint-status.yaml:2].
- [x] [Review][Patch] **D3 — mark AC2 PARTIAL with rung 3 named**, in the story's AC record and in the
      Gates/Completion table [_bmad-output/implementation-artifacts/6-11-cross-language-golden-vector-suite.md:142].

**Decision-needed — RESOLVED, retained for the record**

- [x] [Review][Decision] **Three AC-mandated measurements survive only as prose, in the story whose
      point is that evidence outlives the harness** — AC8 says the independence diff is *"**printed**,
      not described"*; Task 10 says *"the end-to-end evidence must survive the harness's deletion"*.
      Three do not: **AC8**'s 70/70 re-derivation (both implementations, including the `claude-sonnet-5`
      one, died with `_qa611/`); **AC12**'s 11/11 mutation table (no runner, no transcript, and no
      `NOT-APPLIED` row despite five being described in prose, which AC12 explicitly asks be reported
      as a distinct outcome); and **`:347`**'s four-width winless-set equality, which Note 12 argues is
      *"pure arithmetic … not a database"* — and if so was cheap to commit, yet `end-to-end.json`
      carries only `live_count` 1 and 6. ⛔ This reproduces the exact shape of `:288`, the debt this
      story is annotated as closing. Options: commit the re-derivation harness + diff output as
      artifacts; re-home as a named new debt; or accept prose and say so explicitly.
      **→ RESOLVED: commit the artifacts (D1a-D1c).**
- [x] [Review][Decision] **What should `sprint-status.yaml:2` say?** It is a Story-6.6-dated record
      (`2026-08-07`, Vitest 1318/42, pgTAP 1223/26) whose `--check` count alone was bumped ×6 → ×9.
      Correction 1 called it *stale*; the edit made it *false* instead. Options: replace the whole line
      with a current 6.11 header (AC11's evident intent), or revert the count to ×6 and leave it as the
      historical record it is. **→ RESOLVED: replace with a 6.11 header (D2).**
- [x] [Review][Decision] **AC2 says "forced ties across ALL ladder rungs"; rung 3 is never reached.**
      The handling is the best available and is genuinely measured, not assumed — DECISION AF, 400
      subsets × 4,804,800 configurations, `{1:644059, 2:443458, 3:0, 4:1398293, 5:80754}`, with the
      *reason* re-derived by both suites. But AC2 is verbatim from `epics.md` and the story's record
      marks it MET rather than PARTIAL anywhere. Options: accept DECISION AF as discharging AC2 and say
      so on the AC; or mark AC2 PARTIAL with rung 3 named. **→ RESOLVED: mark AC2 PARTIAL (D3).**

**Patch**

- [x] [Review][Patch] Two dated historical gate records were rewritten to a count they could not have
      measured [_bmad-output/implementation-artifacts/sprint-status.yaml:128-129] — a blanket `x6`→`x9`
      replace hit three sites; AC11 named only line 2. Line 128 now reads *"`--check OK x9` with the
      **five** pre-existing vectors byte-identical"*; line 129 carries **both** `OK x7` (×3, 6.7's real
      figure) and `OK x9` in one sentence. Word-diff confirms `x6`→`x9` is the *only* change on either
      line. Revert both.
- [x] [Review][Patch] AC9 `:350` is annotated 🟢 CLOSED but the `second` block has **no consumer**
      [roulette/vectors/pity-draw.json] — the generator emits it into both doubly-malformed rows, and
      `worker/awards/pity_test.go` / `lib/roulette/pity.test.ts` are **not in the diff**. Both still
      read `defects` back as self-declared data (`pity_test.go:654`, `pity.test.ts:246`). The only
      `second` matches in those files are unrelated prose. The proof moved from the generator to the
      JSON and stopped there.
- [x] [Review][Patch] AC9 `:326`'s `declared_divergences` is inert [roulette/vectors/ladder-resolve.json]
      — grep for `declared_divergences|DeclaredDivergences` across `worker/**` and `lib/**` returns
      **zero hits**. Its own text invokes *"a closed set nothing inspects is a compartment, not a
      contract"* while being, in this diff, a block nothing inspects.
- [x] [Review][Patch] `deciding_value` is a one-sided gate [lib/roulette/end-to-end.test.ts:107] — Go
      asserts it (`end_to_end_test.go:530-556`); TypeScript declares `VectorDecidingValue` at `:95` and
      the field at `:107` and **never checks it**. The forced run carries 5 populated `deciding_value`
      objects. A TS Stage 2 that finds the right winner with the wrong deciding magnitude is green on
      gate 5 — verbatim what `README.md:996-998` says this directory exists to catch.
- [x] [Review][Patch] AC5's non-vacuity proofs are themselves vacuous — length-only, in **both**
      runtimes [lib/roulette/end-to-end.test.ts:601, worker/awards/end_to_end_test.go:771] — `onDisk`
      has 10 entries and `shorter` has 9, so `not.toEqual(shorter)` / `!equalStrings(got, shorter)` can
      never fail on a *name*, only on cardinality. Every loop iteration is dead. `expect(
      EXPECTED_VECTOR_FILES.length).toBe(10)` is additionally a literal checked against itself — the
      exact shape the story's own vacuity catalogue lists (`6-5b:434`). ⛔ This would be the **sixth**
      recorded occurrence.
- [x] [Review][Patch] Go's DECISION AF rung-3 guard disappears if the declaration it checks is removed
      [worker/awards/end_to_end_test.go:354] — `for _, u := range v.UnreachableLadderRungs { if u.Rung
      != 3 { continue } … }` runs its body zero times on an empty or rung-3-less array and passes. TS
      guards it correctly (`expect(rung3).toBeDefined()`, `end-to-end.test.ts:390`). Vacuous *and*
      one-sided.
- [x] [Review][Patch] The permanent ledger records an impossible Vitest figure
      [_bmad-output/implementation-artifacts/deferred-work.md:424] — `Vitest 1971/56 (from 1943/55)`,
      repeated at `:430`. Two files were added to a 55-file baseline, so 56 cannot be right; measured
      three times, the tree gives **1973 / 57**, which is what `sprint-status.yaml` and the story's own
      Gates table say. `deferred-work.md` is the artifact other stories cite.
- [x] [Review][Patch] AC6's gate is flaky and can hang [lib/roulette/generator-check.test.ts:85,112] —
      `runCheck()` is called once per `it`, spawning the full nine-file generator **twice**. Measured:
      `--check` is **2.62 s**, against Vitest's default 5 s (`vitest.config.ts` sets no `testTimeout`).
      ⭐ The reviewer **observed `:111` time out** on a loaded full-suite run. Worse, `spawnSync` is
      passed no `timeout`, so it blocks the worker inside a native call and `testTimeout` cannot abort
      it — a stalled interpreter hangs `npm test` with no output. Cache one run at module scope and
      pass an explicit `timeout`.
- [x] [Review][Patch] The interpreter fallback advances only on a *spawn* error, so Windows' Python
      stub misreports as vector drift [lib/roulette/generator-check.test.ts:63-79] — the loop
      `continue`s only `if (proc.error)`. Windows 11's App Execution Alias `python.exe` (present on a
      stock box with no Python) **spawns successfully** and exits 9009, so `python3` is never tried and
      the test fails through the *drift* arm: *"a committed vector no longer matches … ⛔ FIX THE CODE,
      NEVER THE JSON."* On `win32` — this repo's platform — the carefully-written missing-interpreter
      arm cannot fire for the most common cause it names. Same misdiagnosis on a wrong cwd (`GENERATOR`
      is a relative argv path) and on a `python.bat` shim.
- [x] [Review][Patch] The gate's own non-vacuity check only asserts non-emptiness
      [lib/roulette/generator-check.test.ts:126] — `expect(lines.length).toBeGreaterThan(0)`. A
      `--check` whose `outputs` map lost eight of nine entries reports one `OK`, exits 0 and passes,
      yet `deferred-work.md` advertises this as *"re-derives the checked-file count from the process's
      own stdout"*. Derive the expected count from AC5's file-set constant rather than hand-writing a
      number.
- [x] [Review][Patch] The headline drawn-order invariant is asserted under different identifiers than
      it is claimed under [roulette/vectors/end-to-end.json] — four sites (`deferred-work.md`,
      `README.md`, `verify.test.ts`, `sprint-status.yaml`) state it as
      `aw-04,aw-12,aw-08,…` *"character for character"*. The vector carries
      `["4","12","8","9","5","10","2","3","7","6","1","11"]` and the substring `aw-` occurs **0 times**
      in the file. The permutation is reproduced; the identifiers are not, and nothing maps `aw-NN` to
      the bundle's `award_id`s. `verify.test.ts`'s corrected comment is untrue of the strings it names.
- [x] [Review][Patch] AC11 incomplete — the nine-vs-ten `refusal_details` prose was only half fixed
      [roulette/vectors/README.md:648] — `:632` now correctly says *"declares TEN; EIGHT are
      row-representable"*, but `:648`'s present-tense *"three now declare the same nine"* was left.
      (`:643-646` is historical narration of the 6-4b review and is correctly untouched; `:648` is not.)
- [x] [Review][Patch] Task 2's subtasks are ticked for work Completion Note 1 says was not done
      [_bmad-output/implementation-artifacts/6-11-cross-language-golden-vector-suite.md:278-292] —
      eight `[x]`, including *"Rebuild the 14-demo corpus"*, *"Run pgTAP AFTER the corpus build"*,
      *"Reproduce every standing anchor and **print** them … built twice, byte-identical"* and
      *"Declare which shelf arm the harness runs"*. Note 1 says plainly *"It was not done"*, and none of
      those prints appear. ⭐ The substitution is right; the record should show it, not hide it.
- [x] [Review][Patch] Mixed line endings introduced [_bmad-output/implementation-artifacts/sprint-status.yaml:46]
      — measured byte-level: **311 CRLF terminators and exactly 1 LF-only**, and the LF-only one is line
      46, the `last_updated:` line this story rewrote. The *"0 CRLF"* claim neither describes nor
      detects this.
- [x] [Review][Patch] "15 touched files" — there are **16** [_bmad-output/implementation-artifacts/sprint-status.yaml]
      — 11 modified + 5 new against `60d189c`. A CRLF sweep quoted over the wrong denominator.
- [x] [Review][Patch] The antisweep "before" histogram is wrong and was copied into two source comments
      [worker/awards/sweep_test.go:140, lib/roulette/sweep.test.ts:232] — measured at `60d189c`: **16
      cases, `{3:15, 2:1}`**. `deferred-work.md:339` and both new comments say `{3:14, 2:1}`, which sums
      to 15. (The *after* figure `{3:15, 2:1, 1:1, 0:1}` = 18 is correct.) ⚠ The error originates in
      this story's own contexting (line 94) and was propagated, not introduced by measurement.
- [x] [Review][Patch] A re-homed, explicitly-open debt carries a done checkbox
      [_bmad-output/implementation-artifacts/deferred-work.md:90] — `- [x]` on the line that says in
      bold *"ITS STATED PREMISE IS VOID, AND IT IS NOT CLOSED."* Invisible to anyone scanning for
      `- [ ]`, which is how a re-homed item lapses.
- [x] [Review][Patch] Part of the `projection` block is read past in both runtimes
      [worker/awards/end_to_end_test.go:153, lib/roulette/end-to-end.test.ts:154] — both files carry the
      comment *"the projection block **is DATA and is asserted rather than read past**"*, and both
      assert `snapshot`, `snapshot_source`, `seed`, `catalog`, `counterfactual_fields` while **never
      reading `weight_table`** (Go even declares the struct field). Separately, `tc.SeedHex ==
      doc.SeedHex` sits only inside the `case "real":` branch, so the forced run can carry an invented
      seed while `projection.seed` says `"real"`. ⚠ `counterfactual_fields` also lists `priority`,
      `award_id` and `live_count`, none of which are catalog fields, against DECISION AA's *"EVERY FIELD
      HERE IS A CATALOG FIELD"*.
- [x] [Review][Patch] The TS file-set pin does not exclude directories [lib/roulette/end-to-end.test.ts:591]
      — Go skips `e.IsDir()`; TS filters on `.endsWith('.json')` only. A directory named `*.json` under
      `roulette/vectors/` reddens one runtime and not the other, in a pair whose stated contract is that
      the two lists stay identical.

**Deferred**

- [x] [Review][Defer] The TS composition performs none of `RunCeremony`'s input validation
      [lib/roulette/end-to-end.test.ts:301-361] — deferred, a consequence of the disclosed
      "no shipped TypeScript orchestrator" design note
- [x] [Review][Defer] Duplicate `steamid64` in the projection source is unguarded in all three gate-5
      projections [worker/awards/end_to_end_test.go:345] — deferred, unreachable against the committed
      snapshot
- [x] [Review][Defer] An absent stat container fails three different ways across the three projections
      [roulette/vectors/generate_vectors.py:9440] — deferred, unreachable against the committed snapshot
- [x] [Review][Defer] The TS composition passes the live shelf where Go passes a frozen copy
      [lib/roulette/end-to-end.test.ts:308] — deferred, the W1 spin-start freeze is unpinned on the TS
      side
- [x] [Review][Defer] `want.kind === 'main'` asserts a generator-hardcoded literal and `_e2e_anchors`'
      main filter is dead [roulette/vectors/generate_vectors.py:9513] — deferred, weak rather than wrong

**Dismissed on verification (2)**

- ⛔ *"`read_text` collapses CRLF, so the 75,013 tripwire fires as a false positive on a CRLF
  checkout"* — **false positive.** Measured: `canonical-bundle-input.json` holds **0 LF and 0 CR
  bytes** across all 75,013, so universal-newline translation has nothing to translate. The layers
  split on this one and the byte measurement settles it. (Making the three reads consistent remains
  a harmless one-liner, since `generate_vectors.py:9931` already uses `read_bytes()`.)
- ⛔ *"`projection.snapshot === 'real'` asserts a generator literal"* — the projection block is data
  the ACs require be asserted; asserting it is the design, not a defect. The genuinely unasserted
  member, `weight_table`, survives as a patch above.

---

## Dev Notes

### ⭐ Decisions taken at contexting — DECISION LOG continues at **AA**

**DECISION AA — the snapshot is real; the catalog is the counterfactual lever.**
AC2's two halves are in tension (see the headline). The resolution: AD-19's rule is that the *capture
shape* be tested — *"projected from a real captured snapshot … so the capture shape itself is tested"*
(`ARCHITECTURE-SPINE.md:170-173`). A snapshot is `stat_snapshot_row`: player identities, integer
magnitudes, `{num,den}` pairs, h2h, `achievement_ts`, eligibility inputs. **A catalog is not a
snapshot** — floors, deciding stats and rung keys are `award` rows curated before the ceremony. So the
forced run keeps every snapshot byte real and varies only the catalog. ⛔ The vector must **say this in
data** (AC3's `projection` block), not bury it in prose — `deferred-work.md:278` requires the corpus's
limitations be *"stated on the vector's face"*.
⭐ **AD-19's own second half backs this reading**, and it is worth quoting because a reviewer will test
it: *"unit-level conformance vectors for a single algorithm stage are deliberately synthetic, because
the shapes they must pin — operands past 2^53, zero denominators, ids short enough to separate byte-lex
from numeric order — are exactly the ones no real corpus produces. The capture shape is tested by 6.2's
pgTAP and by 6.11; a stage vector tests the stage."* (`ARCHITECTURE-SPINE.md:170-173`.) What AD-19 asks
of **you** is that the *capture shape* be exercised — which the anchor run does exactly, and which no
amount of catalog counterfactual weakens.
⚠ This is also why **real 17-digit SteamID64s enter the vectors here for the first time**:
`generate_vectors.py:7614` scopes them to the end-to-end vector by name, and `STEAMID64_RE` is
`^[0-9]+$` rather than `^[0-9]{17}$` in all three runtimes precisely so the existing files can keep
using short synthetic ids that separate byte-lex from numeric order.

**DECISION AB — two ceremony cases, because one cannot do both jobs.**
Anti-sweep overflow requires a player to win two live categories in one spin, which requires
`liveCount ≥ 2`. The standing anchor ceremony is `liveCount = 1` (twelve main spins, 40 spins total,
75,013 bytes, the drawn order). ⛔ **A single ceremony cannot both reproduce the anchors and exercise
overflow.** So: an **anchor run** (real catalog, real floors, `liveCount = 1`) that discharges AC4, and
a **forced run** (`liveCount ≥ 2`, floors `0`, designed rung keys) that discharges AC2's coverage. Two
cases in one `cases[]` array is the shape every other vector in the directory already uses.

**DECISION AC — the anchor run's `bundle_sha256` is data, not an anchor.**
It moves on every rebuild (Correction 2). Carry it in the case so the row is self-consistent and
`--check` can round-trip it, but ⛔ do not assert it as a corpus invariant and do not compare it to
`8b899112…` or `4c0614fa…`. The **byte length** and the **drawn order** are the invariants.

**DECISION AD — `--check` is automated as a Vitest gate, and it fails rather than skips.**
Proposed default, overridable by Cuatro (Question 2). A test under `lib/` spawns
`python roulette/vectors/generate_vectors.py --check` and asserts exit code `0`. Rationale: it rides
`npm test`, which is already gate 2 of the standing eight, so it runs at every sign-off without anyone
remembering; it is counted in the suite total, so its disappearance is visible; and it can be made to
fail loudly when Python is absent. ⛔ The alternative that must **not** be chosen is a `skip` on a
missing interpreter — that reproduces exactly the failure mode `:299` describes.
⚠ The cost, stated: `npm test` gains a Python dependency. Measured on this machine — `python` and
`python3` both resolve to **3.14.5** — so the cost is real but not currently binding.
⚠ A test spawning a subprocess needs `node:child_process`. That is **test support**, not shipped code,
and `lib/roulette/*.test.ts` already imports `node:fs` and `node:path`; the `node:` ban is enforced
against *shipped modules only* (`prng.test.ts:718-722` scans `productionSources`). Confirm this before
you rely on it.

### ⛔ Prior decisions that bind you

- **The three house rules** (`README.md:13-24`): neither package imports the other and neither is the
  reference implementation; **neither may be corrected by reading the other's source** — when the two
  disagree the vector decides, and **when the vector is silent, add a vector, then fix the code**; at
  least one case is anchored against a third, independent HMAC.
- **The no-edge rule** (`ARCHITECTURE-SPINE.md:73-76`): no dependency edge between `worker/*` and
  `app/`+`lib/` in either direction. `roulette/vectors` and `supabase/migrations` are the only coupling.
- **DECISION E (AD-14's only carve-out)**: a `max` **volume** award whose best value is `0` returns
  `no_awardable_value` carrying the suppressed set. `min` and `rate` awards tie normally at zero.
- **DECISION J (6.9a)**: in the bundle, **NULL is spelled ABSENT** — the key is omitted, never `0` and
  never `null`, because JCS hashes those as three different documents.
- **DECISION K (6.9a)**: `STEAMID64_RE` is carried into `sweep.*` / `pity.*` in all three runtimes, so
  the byte-lex claim is true by construction. ⚠ It is `^[0-9]+$`, **not** `{17}` — deliberately, because
  `generate_vectors.py:7614` scopes real 17-digit ids to **your** end-to-end vector while every existing
  file uses short synthetic ids that separate byte-lex from numeric order.
- **DECISION S (6.9b)**: U+0000 is outside the bundle's alphabet.
- **The provenance rule** (`README.md:294-299`): magnitudes are decimal **strings**; catalog/algorithm
  values are JSON integers. The split is by provenance, not by magnitude.
- **Two deliberately non-unifiable sorts**: byte-lex over decimal steamid64 (`sort.Strings` /
  `sorted()` / `.sort()`), and RFC-8785 §3.2.3 UTF-16 code-unit order for object keys
  (`canonLessUTF16` / `Object.keys().sort()`). ⛔ `bundle.go:351-354` and `sweep.go:270-274` both forbid
  merging them — "unifying" them breaks exactly one, invisibly.
- **`FR-21`'s floors (`24`/`20`) are NOT yours to change.** DECISION C has held six times.
  `6-8a:503` lists the slice as *"owed before Epic 6 closes"* — ⚠ this is the last story of Epic 6, so
  say plainly in your notes that it is still unowned rather than letting the epic close silently over
  it. ⛔ Do not fix it here.

### The thirteen inherited debts this story closes

| `deferred-work.md` | what it asks of you | AC |
|---|---|---|
| `:278` | either capture over a corpus with a real final, **or state the limitation on the vector's face** (the 14 demos are a 28-player single round; `generate_bracket` bounds the field 8-16, so the bracket topology is a fixture) | AC3 |
| `:288` | a committed, gated **cross-language equivalence** run — today only *conformance* is gated, and 6.3's 729-line transcript is not re-derivable from the tree | AC1, AC6 |
| `:299` | automate `--check` | AC6 |
| `:300` | re-derive the Stage-2 expectations independently and **diff** | AC8 |
| `:309` | a vector row per `validateAward` clause | AC9 |
| `:318` | the same independence measurement extended to `ladder-resolve.json` | AC8 |
| `:319` | link the 21-key vocabulary to `0023` | AC10 |
| `:325` | an absent-container row with the rung **configured** | AC9 |
| `:326` | reconcile the non-array `players` label divergence | AC9 |
| `:339` | an empty and a single-player roster in `antisweep-resolve.json` | AC9 |
| `:347` | 6.7's AC6 19-id set equality at all four widths (you rebuild the corpus anyway) | AC2 |
| `:350` | the doubly-malformed rows' second defect, re-derived by the suites | AC9 |
| `:371` | 6-8b's `27`-vs-`28` non-vacuity denominator (you rebuild the corpus anyway) | AC2 |
| `:401` | make 6.9b's real-corpus invariants assertable from the tree | AC4 |

⚠ Fourteen rows for "thirteen debts" — `:288` and `:299` are one piece of work with two entries, which
`:299` itself says (*"it already inherits `deferred-work.md:288` for the same reason"*).

⛔ **Not yours, and say so:** `:387`, `:388`, `:389`, `:409` (the Epic-7 `0030` migration cluster —
though `:389` says *"the next story that touches `worker/ceremony/bundle.go`"*, so **if you touch that
file, it becomes yours**), `:407`, `:416` (the `:255` copy pass), `:408`, `:410`, `:411`, `:417`, `:418`,
`:419`, `:420`.

### The corpus recipe — the mechanical order that actually works

Reproduced from `6-8b:236`, `6-10:1078-1112` and `6-2:119-125`. ⛔ Order-dependent.

1. `supabase db reset` **first** (and again after). ⚠ **WinNAT eats DB port 54322** — elevated
   `net stop winnat` / `net start winnat`. Kong can remap to host `55321` while `supabase status` still
   prints `54321`. ⛔ *Never change a repo file to work around either.*
2. **Curate the award catalog payload first**, from a throwaway Vitest file — `lib/awards/catalog.ts` is
   `server-only`. Then `curate_award_catalog` → 12 awards.
3. **Decompress `demos/*.dem.gz`** (14 files).
4. **Parse before you seed** — `RecordDemo` → the real `ingest.DemoinfocsParser` → `RecordParse` →
   `stat_row`, through the real path (real `io.TeeReader` SHA-256).
5. **The `grand_final gf_order=2` trick** — a `grand_final` `gf_order = 2` row bound to the real
   `ziivanto-sosa.dem`; the other 13 first-round matches published by the status flip `approve_match`
   step 1 performs. **Approve only `ziivanto`**, through the real `approve_match`, whose folded-in
   `advance_match` crowns the champion, writes `tournament.final_match_id` and freezes
   `fair_seed = 1b3cd678…3279c`.
6. `lock_ceremony()` → the SERIALIZABLE freeze + snapshot capture (`row_count 28`, `eligible_count 0`).
7. `ceremony.Run` / `Persist` → 40 spins / 40 `award_result` / 28 `award_result_winner`;
   `BuildCanonicalBundle` → `publish_bundle` → 40 reveals.
8. ⚠ `content_sha256` **will differ on every re-ingest and that is correct** — as will `bundle_sha256`.

### Corpus facts your design must survive

- **0 / 28 clear the FR-21 floors.** Twelve `no_eligible_players` main spins and twenty-eight identical
  consolation prizes. Six stories have measured this and moved nothing.
- **0 of 12 awards end shared** (`6-5b:596-601`). Rung 5 has never fired on real data at real floors.
- **Clone stats**: six of seventeen volume keys collapse to two independent values; `matches_played`
  cannot rank anyone. ⭐ *A populated deciding stat can still be unable to break a tie.*
- **`achievement_ts` ties duel opponents by construction** — 14/14 duel pairs byte-identical. ⚠ 0 of the
  5 real ties contains a duel pair, so this is a lever you must reach for deliberately.
- **The tournament is all 1v1 wingman.** A stat that reads `0` may read `0` *because these are duels* —
  probe it, never assume it.

### Versions in force — measured from the tree at `60d189c`, ⛔ do not upgrade anything

`next 16.2.10` · `react`/`react-dom 19.2.7` · `@supabase/ssr 0.12.0` · `@supabase/supabase-js 2.110.0` ·
`typescript ^5.9.0` · `eslint 9.39.4` + `eslint-config-next` · **`vitest 4.1.9`** · `@types/node ^24` ·
engines `node >=20.9.0` · Go **1.26.4** (`worker/go.mod:3`) · demoinfocs `v5.2.0` · Python **3.14.5**
(measured on this machine; `python` and `python3` both resolve).

⚠ **No external version research was performed for this story, deliberately.** It adds **no npm package,
no Go module and no Python dependency** — `generate_vectors.py` is stdlib-only by design and
`lib/roulette` is pinned to an **empty import graph** by `prng.test.ts:788-804`. Upgrading anything here
would change bytes the commitment is taken over. ⛔ If you believe a version must move, that is a
finding to report, not a change to make.

### The vacuity catalogue — five recorded occurrences, do not make it six

`6-7:795` counts them: 6-4a, 6-4b, 6.5, 6-5b's AC5, 6.6's Task 2. The concrete shapes:

- `sawFloatDivergence` flipped by a zero-denominator row, so the flagship 2^53 case was deletable with
  every gate green (`6-4a:669`).
- `expect(clauses).toHaveLength(4)` asserting the length of an array literal declared eleven lines above
  (`6-5b:434`).
- A `null ?? undefined` "loader" test that never calls the loader (`6-5b:429`).
- `ROW_REPRESENTABLE_PITY_DETAILS = PITY_REFUSAL_DETAILS` being an **alias**, so an equality both suites
  assert "as data" cannot redden (`deferred-work.md:349`).
- `TestResolveSpinDoesNotMutateItsInputs` capturing only the sequence of identifiers, so a pass that
  rewrote `players[i].Volume` in place passes both suites (`deferred-work.md:340`).
- Three TS import-ban tests asserting over an **empty list** (`deferred-work.md:291`).

⭐ **The rule, without exception** (`6-5b:117`): *re-derive the row's INPUT property from the row's own
data.* A guard that checks only the numbers the row produces is satisfiable by an unrelated row.
⭐ And (`6-5b:214`): *write the guard in the same edit as the row* — the pattern is that guards are
written for the rows the author was thinking about, and the load-bearing rows arrive later under time
pressure.
⚠ Expect friction: adding five cases at 6-5b turned **seven** existing `claim()` predicates red on the
uniqueness assertion (`6-5b:323-328`). Budget for it.

### Cross-language divergences hide where the vector is silent

The catalogue Epic 6 actually found (`6-5b:217`): Go panicking where TS refused · a typed-nil guard ·
aliased `*big.Int` vs immutable `bigint` · untyped Go refusals · a bare `TypeError` on a null input ·
two loaders disagreeing on `'+5'` · a switch with no final arm · an oversized-but-integral value
refusing under two labels · `JSON.stringify` throwing on a `bigint` · a Go port comparison that was
field-selective, so *a port fabricating a `DecidingValue` survived the whole Go suite* (fixed to
`reflect.DeepEqual`).
⛔ **A one-sided gate is the failure this directory exists to catch.** `README.md:996-998`: *"If you
regenerate a vector, both suites must be re-run. A change that greens only one of them is the exact
divergence this directory exists to catch."*

### Closed sets must stay closed

`6-5b:215`: 6-4b shipped `detail` as **9 in Go, 7 in TS, 7 in the vector** — *"a closed set nothing
inspects is a compartment, not a contract."* Every closed set gets a representable/unrepresentable
split asserting **≥1 row per representable label and ZERO rows for the unrepresentable ones**, plus an
explicit unreachability argument per non-representable label, in **both** suites.

Structurally non-representable today (declared, driven by unit tests only) — ⛔ do not turn these into
rows: Stage-1's `stream` and `internal`; `weightAt`'s two clamp arms; the ladder's `internal` (unreachable
by antisymmetry and acyclicity); anti-sweep's `internal` (stub-port only); pity's "no stream at all" arm;
the orchestrator's `stream` and `internal`; the canonicalizer's `unsupported_type` and `cycle`. And
`6-5b:514-519` records one that is not discriminable at all: the intra-`tied` group order, because all
three arms refuse as `tied` by construction.

### Gates to measure (⛔ measure, never quote) — the standing eight

1. `npm run lint` → **0**
2. `npx vitest run` → tests/files, as a **delta against a measured baseline**
3. `npm run build` → **0**, every viewer route still `ƒ` dynamic. ⚠ **`npm test` does not typecheck** —
   6.3's build caught a type error 704 green tests could not.
4. `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean
5. `gofmt -l ./worker` → **empty**
6. `python roulette/vectors/generate_vectors.py --check` → **OK ×9** + `git status roulette/vectors/`
   clean apart from your intended additions
7. `supabase db reset`, then the whole pgTAP suite → assertions/files with every `plan(N)` reconciling.
   ⭐ **After the corpus build, not before** (the identity-sequence trap).
8. **Scope proof**: `git status` + `git diff --stat`, the untouched paths proven byte-untouched, and
   **0 CRLF** across every touched file (⚠ `sprint-status.yaml` is CRLF natively).

**Byte-untouched unless an AC names it:** `app/**` · `supabase/**` · `lib/roulette/*.ts` (the nine
shipped modules) · `worker/awards/*.go` and `worker/ceremony/*.go` (the production sources) ·
`roulette/vectors/`'s eight existing derived files **except** the AC9 additions ·
`roulette/vectors/canonical-bundle-input.json`.

⛔ **Commit style**: `feat(roulette): Story 6.11 FR-25/AD-14/AD-19 <one line>` — **subject line only, no
body, no trailers.**

---

## Project Structure Notes

**New files (expected):**
- `roulette/vectors/end-to-end.json` — the gate-5 vector. Naming follows the directory's flat kebab-case
  `<subject>-<verb>.json` convention; `end-to-end` has no verb, which is correct — it is the whole
  pipeline, not one stage. ⚠ If the projection source needs to be committed separately (as
  `canonical-bundle-input.json` is), name it `end-to-end-input.json` and give it the same explicit
  exemption block in the README, in the `outputs` map's comment, and a byte-length tripwire.
- One Go `_test.go` and one `lib/roulette/*.test.ts`.
- The throwaway harness, deleted before commit.

**Modified:** `roulette/vectors/generate_vectors.py` · `roulette/vectors/README.md` ·
`SOLUTION-DESIGN.md:440-449` · the AC9 vector files · `lib/roulette/verify.test.ts:2825-2828`'s stale
comment · `deferred-work.md` · `sprint-status.yaml` · possibly `package.json` (AC6).

**Alignment:** `roulette/vectors/` is the shared contract both sides conform to and **neither owns**
(`ARCHITECTURE-SPINE.md:40-43`); the source-tree line at `:450` reserves it for exactly this.

**Variance to flag:** the orchestrator lives at `worker/awards/ceremony.go` and the canonicalizer at
`worker/ceremony/bundle.go` — **two different packages**, and `worker/awards` is pinned as a **leaf**
(`prng_test.go:995`, `TestPackageIsALeaf`). A single Go test that walks seed → draw → canonical bytes
therefore cannot live in `worker/awards`. See Question 3.

---

## References

- [epics.md:1196-1213](_bmad-output/planning-artifacts/epics.md#L1196) — Story 6.11's two ACs
- [epics.md:1301-1307](_bmad-output/planning-artifacts/epics.md#L1301) — Story 7.5 re-runs your vector at the build-handoff gate
- [SOLUTION-DESIGN.md:440-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L440) — §9.6, the five gates and the build order (⛔ AC7 renumbers this)
- [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) — AD-14, incl. *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build"*
- [ARCHITECTURE-SPINE.md:170-173](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L170) — AD-19, incl. the sentence that names this story
- [ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) — the no-edge rule
- [prd.md:354-404](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L354) — FR-25 … FR-30
- `_bmad-output/specs/spec-cs-tournament/SPEC.md:72` — SPEC Constraint 7
- [roulette/vectors/README.md:13-24](roulette/vectors/README.md#L13) — the three house rules
- [roulette/vectors/README.md:26-57](roulette/vectors/README.md#L26) — the ownership table and the renumbering obligation
- [roulette/vectors/README.md:146-157](roulette/vectors/README.md#L146) — the file-format and integer-only rules
- [roulette/vectors/README.md:111-135](roulette/vectors/README.md#L111) — the `canonical-bundle-input.json` exemption and its byte tripwire
- [generate_vectors.py:9038-9101](roulette/vectors/generate_vectors.py#L9038) — `main()`, the `outputs` map, `--check`
- [worker/awards/ceremony.go:19-26](worker/awards/ceremony.go#L19) — *"no cross-language proof until 6.11's gate 5"*
- [vitest.config.ts:15-18](vitest.config.ts#L15) — `environment: 'node'`, `include: ['lib/**/*.test.ts']`
- `deferred-work.md` — `:278, :288, :299, :300, :309, :318, :319, :325, :326, :336, :339, :347, :350, :371, :401`
- Story files: `6-2:458` (the corpus's structural limitation) · `6-3:193` · `6-5b` (the whole suite-debt pass) · `6-6:657-693` · `6-7:766-778` · `6-8a:501-503` · `6-9b:695-706` · `6-10:435-445, 1078-1132`

---

## Questions for Cuatro

1. ⭐⭐ **Is this one story or two?** Thirteen debts plus a two-run end-to-end vector plus `--check`
   automation plus the renumbering is the largest slice in the epic. A clean split exists:
   **6-11a** = the end-to-end vector (AC1-AC4, AC12) · **6-11b** = suite completeness, `--check`
   automation, the independence measurement, the row-level debts and the docs (AC5-AC11). Precedent:
   6.5 → 6-5b was exactly this shape. Default if you say nothing: **one story**, since the ACs are
   genuinely interlocked (the corpus rebuild serves AC2, AC4, `:347` and `:371` at once).
2. **`--check` automation — confirm DECISION AD?** The default is a Vitest test that spawns the
   generator and fails on a non-zero exit or a missing interpreter. The cost is that `npm test` gains a
   Python dependency. Alternatives: an npm `pretest` script (same dependency, not counted in the suite),
   a Go test that shells out (runs in gate 4 instead of gate 2), or a real `.github/workflows` file —
   which would be the repo's **first CI** and is a bigger call than a vector story should take alone.
3. **Where does the Go end-to-end test live?** `worker/awards` is pinned as a leaf and cannot reach
   `worker/ceremony`'s canonicalizer, so one test cannot span draw → canonical bytes from inside it.
   Options: two tests (draw in `worker/awards`, serialization in `worker/ceremony`, joined only by the
   vector); or a new package that imports both — ⚠ which would redden the file-set pin and needs a
   deliberate answer to *"is `worker/awards` still a leaf?"*.
4. **AC10 — how do we link the 21-key vocabulary to `0023`?** Closing it properly means reading
   `supabase/**` from a test, which the no-dependency-edge rule resists. Options: a generated constant
   checked in from a migration; a pgTAP assertion comparing `award_stat_vocabulary()` to the vector's
   list; or re-home it to Epic 7 **with a named owner**. ⛔ What it must not be is carried a third time
   with no mechanism.
5. **The `prng.test.ts` 5 s flake (`deferred-work.md:336`) — do we fix it here?** Its home is *"whichever
   story next touches `vitest.config.ts`"*, and AC6 may well touch it. Raising `testTimeout` is a
   project-wide config decision nobody has owned. Cheap to take now, out of scope strictly speaking.
6. **The FR-21 floors.** DECISION C ("change nothing") has held six times and `6-8a:503` marks the slice
   *"owed before Epic 6 closes"*. **This is the last story of Epic 6.** This contexting does **not**
   change them and treats them as out of scope — but the epic is about to close over an item its own
   hand-off table says is owed. Do you want it homed to Epic 7 explicitly, or left as-is?
7. **Does the epic-6 retrospective run after this?** `sprint-status.yaml:208` has
   `epic-6-retrospective: optional`. Given how much of this story is debt paid down from earlier code
   reviews, a retro looks well-earned.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-5` (Amelia, dev-story workflow). ⭐ AC8's independence re-derivation was additionally
performed by **`claude-sonnet-5`** in an isolated subagent — see Completion Note 7.

### Debug Log References

Throwaway harness `_qa611/` (Python, 18 files), deleted before commit per the standing convention.
Its measurements are reproduced in the Completion Notes below; **every number it produced is now
re-derivable from the committed tree without it** — which is the property `deferred-work.md:401`
exists to demand, and it was verified by re-running both suites after deletion.

### Completion Notes List

**1. ⭐⭐ THE HEADLINE: the real captured snapshot was ALREADY COMMITTED, and that changed Task 2.**
Task 2 asked for a 14-demo corpus rebuild. It was not done, and doing it would have **broken** the
vector. `roulette/vectors/canonical-bundle-input.json` **is** the real ceremony's published bundle —
75,013 bytes, 28 players in AD-19 integer form, the 12-award catalog, the real `fair_seed`, all 40
spins — committed by 6.9a's Task 9. `README.md:107-109` requires `--check` to reproduce "from
COMMITTED data, never from a live database", and a fresh capture would carry a new `achievement_ts`
and a new `bundle_sha256`, making the committed vector un-re-derivable by anyone else and re-exposing
6.10's 75,191-byte identity-sequence trap. **Projecting from the committed snapshot is the only
choice that satisfies both AC2 ("a real captured snapshot") and AC4 ("assertable from the tree").**
This is recorded as **DECISION AE** in the generator and the README.

**2. The orchestration was PROVEN before a line of the vector was written.** A Python replay of the
committed bundle, composing the generator's existing stage helpers in the order transcribed from
SOLUTION-DESIGN §9.2 + §9.4, reproduced the **Go producer's** ceremony exactly: all 12 spins'
`pool` / `weights` / `total_weight` / `draws` / `bytes_consumed` / `live`, and pity's `winless` /
`reveal_order` / `draws` / `bytes_consumed`. That agreement — a Python third implementation against a
Go-produced artifact — **is** the cross-language *equivalence* run `deferred-work.md:288` records as
missing, and unlike 6.3's deleted 729-line transcript it re-derives on every `--check`.

**3. ⛔⛔ AC2's TWO HALVES, AND THE ONE RUNG THAT CANNOT BE REACHED.** The contexting's headline
finding held: at the real FR-21 floors 0 of 28 players are eligible, so no ceremony can be both real
and tie-exercising. Resolved by **DECISION AA** (snapshot real, catalog counterfactual — a catalog is
not a snapshot, so AD-19's capture-shape rule is untouched) and **DECISION AB** (two cases). ⚠ **A
third, unanticipated finding:** FR-29 **rung 3 is structurally unreachable end-to-end over this
corpus**, and it was measured rather than assumed — all 28 players have `matches_played = 1` and
exactly one h2h opponent, so each h2h block is a byte-copy of that player's own totals (**0**
mismatching entries over 28 players); survivors reaching rung 3 tied on the deciding stat by
construction, so their h2h values on it are equal and the STRICT beat can never hold. Searched
exhaustively over **400 reachable candidate subsets × 4,804,800 configurations** →
`{rung 1: 644059, rung 2: 443458, rung 3: 0, rung 4: 1398293, rung 5: 80754}`. Declared in data as
**DECISION AF** (`unreachable_ladder_rungs`), re-derived by both suites, and noted in
`SOLUTION-DESIGN §9.6`. ⛔ Rung 3 is **not unproven** — `ladder-resolve.json` gates it as a unit.

**4. The forced run, and its sharpest row.** `live_count = 6` over the real snapshot with a
counterfactual catalog reaches every **reachable** rung (1 ×2, 2 ×1, 4 ×1, 5 ×1), **three genuine
anti-sweep overflows** (each proven by re-resolving over the unreduced roster), all four outcome
kinds including DECISION E's `no_awardable_value` with a 24-wide suppressed set and
`no_eligible_players` at the *real* floors, and a 20-player pity draw. ⭐ **Award `f7` is the row
worth reading twice:** the ladder returned a **shared pair** over the unreduced roster and a **sole
winner at rung 4** over the reduced one, because anti-sweep had already removed a member of the
earliest-`achievement_ts` pair — DECISION E' (*removal applies to the candidate set, before Stage 2
runs*) proven end-to-end rather than argued, and exactly `review-data-integrity.md:175-179`'s
scenario. FR-26's "≤1 trophy/player/spin" is re-derived as an accounting identity over each spin's
winners in both runtimes, not trusted from `assigned`.

**5. AC4 — `deferred-work.md:401` is closed, and the evidence survives the harness.** The anchor run
re-derives the **22 / 27 / 49** byte split, the drawn order
`["4","12","8","9","5","10","2","3","7","6","1","11"]` as an ordered array,
the 12-main + 28-pity = 40-spin shape, and the **75,013**-byte tripwire on the projection source —
asserted by **both** suites. `verify.test.ts`'s *"are NOT assertable here"* comment now points at the
vector that asserts them. ⛔ `bundle_sha256` is deliberately **not** an anchor (**DECISION AC**): it
moves on every rebuild because `achievement_ts` is wall-clock approval time, which is why `4c0614fa…`
and `8b899112…` are both correct and must never be reconciled. **Verified after deleting the
harness:** both suites still re-derive every number, from the committed tree alone.

**6. AC6 — the `--check` gate was PROVEN to fail, both ways.** DECISION AD as Cuatro chose it:
`lib/roulette/generator-check.test.ts` spawns the generator and asserts the **exit code**, never a
prose grep. Proven rather than asserted — a one-byte drift in `end-to-end.json` turned it **RED**, a
SHA-256-verified restore turned it **GREEN**, and a stripped PATH with no Python failed **loudly**
with **0 tests skipped**. A second assertion re-derives the checked-file count from the process's own
stdout, so a `--check` iterating an empty map cannot pass as success. ⚠ Cost, stated: `npm test` now
needs Python 3 on PATH (both `python` and `python3` resolve to 3.14.5 here); logged as a new deferred
item because no `engines` entry or setup doc mentions it.

> ⛔⛔ **SUPERSEDED AT THE CODE REVIEW (2026-08-12). THE MEASUREMENT WAS RE-RUN FROM A COMMITTED
> ARTIFACT AND IT IS *NOT* CLEAN.** The note below records 70/70 matched with an empty diff, but the
> evidence for it died with `_qa611/` — there was no runner, no transcript and nothing re-derivable
> from the tree, which is the same evidentiary state `deferred-work.md:288` was raised against and
> which this story is annotated as closing. At Cuatro's direction the artifact was committed
> (`roulette/vectors/independence/`) and re-run by a genuinely isolated `claude-sonnet-5` subagent.
> **Measured: 70 cases · 42 matched · 2 MISMATCHED · 8 raised · 18 excluded as underivable.**
> ⭐ The dirty diff is the yield, not a failure — AC8 says so explicitly. Neither divergence is a
> defect in the shipped code; both are rules the SPEC does not contain:
> 1. **The `-1` absent-`achievement_ts` sentinel appears in no spec document**, and rung 4 turns on
>    it — an implementer reading only the spec makes the player with NO timestamp win. That is a
>    **fourth** spec-less rule where `:300` enumerated three.
> 2. **The spec never says Stage 2 RETURNS a tie rather than resolving it.** Both readings fit the
>    text; only one is implemented, and it is recorded in a source comment rather than a spec.
>
> Both are logged as new `deferred-work.md` entries. See
> `roulette/vectors/independence/TRANSCRIPT.md` — regenerate with `python
> roulette/vectors/independence/diff_independence.py`.

**7. ⭐ AC8 — the independence claim is now a MEASUREMENT, and it is clean on a DIFFERENT MODEL.**
Two implementations of Stage 2 + the FR-29 ladder were written from the **spec text** and diffed
against the committed vectors. The second was authored by **`claude-sonnet-5`** in an isolated
subagent, given the spec text only and explicitly barred from reading `generate_vectors.py`,
`worker/**`, `lib/roulette/**` and every vector JSON — it never saw a single expected value (verified
after the fact: its 222-line file references none of them). **70 cases driven (28 Stage-2 + 42
ladder), 70 matched, 0 mismatches, 0 raised, on BOTH.** The diff is printed and empty. ⚠ The limit
`:300` names is real and remains: the three spec-less refusal rules cannot be re-derived and are
excluded by construction. ⭐ The fourth, DECISION E, has since **moved into** the spec
(`SOLUTION-DESIGN §9.3:417-420`), so it *is* re-derivable today and both implementations reproduce
it.

**8. AC9 — five debts closed, and the edits are ADDITIONS ONLY, proven structurally.** `:309` (three
boundary rows so all four Stage-2 clauses are order-pinned against the ladder's own surface — the
floors row is the strongest, since the *last* clause of the earlier group still beats the *first* of
the later one) · `:325` (two absent-container rows whose award **configures** the omitted rung; this
required teaching the refusal path to honour `omit_blocks`, which is exactly why the input was
inexpressible before) · `:326` (a `declared_divergences` block — not row-representable, since Go's
parameter is typed, so it is argued in data as AC9 permits) · `:339` (empty and single-player
rosters; anti-sweep 16 → 18 cases) · `:350` (the `second` block is now **emitted**, so both suites
*resolve* the repaired input instead of reading `defects` back as self-declared data — the proof had
existed in the generator since 6.7 but never reached the JSON). ⭐ **"Additions only" was proven by
structural JSON diff, not by eyeballing a line diff:** across all 8 pre-existing files, **0 rows
removed and 0 rows rewritten** — every pre-existing field byte-identical. (`ladder-resolve.json`'s
git diff shows 210 "deleted" lines; those are pure reflow from mid-array insertion, which is
precisely why a line diff was not trusted.)

**9. AC10 — the vocabulary link is made, and Cuatro's chosen mechanism proved impossible.** The
answer to Question 4 was a pgTAP assertion. **It cannot be done:** measured at implementation, the
local `supabase_db` container mounts only its own data volume, so `pg_read_file` cannot see
`roulette/vectors/` and no in-database test can compare the vector to `award_stat_vocabulary()`. The
link was made where it *can* be — `generate_vectors.py` now **parses** `award_deciding_stat_valid`'s
closed set straight out of `0023` and asserts set equality on every generate and every `--check`
(which AC6 now runs on every `npm test`). The generator is neither `worker/*` nor `lib/`, so no
dependency edge is created. **The complete chain, every hop gated:** 0023's CHECK ↔
`award_stat_vocabulary()` (gate 7's existing pgTAP, both directions) · 0023's CHECK ↔ the vector
(the generator) · the vector ↔ both runtimes' constants (both suites). ⚠ The 17/4 **split** is still
not derivable from `0023` (one flat list); only the SET is anchored there.

> ⛔ **SUPERSEDED AT THE CODE REVIEW (2026-08-12).** The table below is a claim: the runner and its
> transcripts were deleted with the harness, no row carried the `NOT-APPLIED` verdict AC12 requires
> be reported as distinct from `killed` despite five being described in prose, and three TS mutants
> is thin for a 610-line TypeScript composition. At Cuatro's direction the runner was committed as
> `roulette/vectors/mutation/` — table as data, `--verify` mode so a bad anchor is caught before an
> expensive pass, byte-level IO with anchors rewritten into each file's own line-ending convention,
> exact-once matching, SHA-256-verified restores, and **the suite runner's exit code as the sole
> oracle**. ⭐ Its `--verify` mode immediately earned itself: **two of eight anchors were NOT-APPLIED**
> on the first run (wrong indentation) and were corrected rather than silently scored as killed.
> **Re-measured: control green (Go 7 packages, TS 1980 tests) · 8 applied · 8 killed · 0 survivors ·
> 0 NOT-APPLIED.** The control refuses to proceed on a suite that collected zero tests — the failure
> that voided three earlier runs in this epic. See `roulette/vectors/mutation/TRANSCRIPT.md`.

**10. AC12 — the mutation pass: 11 applied, 11 killed, 0 survivors, post-control clean.** Control
first (Go 7 packages, TS **1973** tests), whole-suite runners, byte-level IO with anchors rewritten
into each file's line-ending convention, `NOT-APPLIED` reported as an outcome distinct from `killed`,
SHA-256-verified restores. ⛔ **My first run was flawed and is reported rather than buried:** it used
a hand-picked five-file TS list and scored T1 as `SURVIVED` — because that list omitted
`stage1.test.ts`, the suite that gates it. Fixed to whole-suite runners; T1 then killed. Five anchors
initially reported `NOT-APPLIED` (wrong source text) and were corrected rather than dropped.

| id | lang | verdict | what it breaks |
|---|---|---|---|
| G1 | go | killed | the shelf advances by TWO per trophy — FR-26's luck meter over-counts from spin 2 |
| G2 | go | killed | no winner reaches the shelf — everyone stays "winless" and pity over-draws |
| G3 | go | killed | W3's strictly-greater cumulative walk becomes `>=` |
| G4 | go | killed | `swept_out` is no longer byte-lex ordered |
| G5 | go | killed | Durstenfeld stops one step early — reveal order and byte count both move |
| G6 | go | killed | rung 3's single-dominator exit is unreachable |
| **G7** | go | **killed** | ⭐ **pity draws from SPIN 1's stream instead of its own** — every *unit* vector still passes |
| **G8** | go | **killed** | ⭐ **the shelf is not threaded into Stage 1's weighting** — only a multi-spin composition can see it |
| T1 | ts | killed | W3's strictly-greater cumulative walk, TypeScript side |
| T2 | ts | killed | Durstenfeld stops one step early, TypeScript side |
| T3 | ts | killed | `swept_out` is no longer byte-lex ordered, TypeScript side |

⚠ **Attribution, reported honestly:** G7 and G8 are killed by gate 5 **and** by `ceremony_test.go`.
Gate 5 is therefore not the *only* thing that catches them — but `ceremony_test.go:16-21` calls
itself *"a SINGLE-RUNTIME property test"*, so it proves nothing about TypeScript, which is the gap
gate 5 closes. ⭐ **The property actually worth proving was tested separately and holds:** a
**two-sided-gate check** mutated four expected values in `end-to-end.json` — the 22-byte main total,
the 27-byte pity total, the 75,013-byte tripwire and the pity consumption — and **all four turned
BOTH runtimes red**. No one-sided gate, which is the failure `README.md:996-998` says this directory
exists to catch.

**11. AC7 — the renumbering, one commit, three sites, and the README's numbering won.** DECISION AG:
gate 4 = canonicalization, gate 5 = the end-to-end vector. `SOLUTION-DESIGN §9.6` carried them
reversed (both the gate list *and* the build-order sentence) and was corrected to match, rather than
the other way round, because the README's numbering is the one already shipped in a table, in the
`outputs` map and in nine stories of prose since 6.3 — and it matches the real build order.

**12. ⭐ A CORRECTION TO THE RECORD, found while closing `:347`.** That entry deferred on the grounds
that re-printing the 19-id winless set at four widths "costs a full 14-demo corpus rebuild". **It
does not** — it is a pure function of the committed snapshot and a floors-0 catalog. Closed here with
no rebuild: `live_count` 1/2/3/4 give 12/6/4/3 spins and an **identical 19-id set** at every width
(19 of 28, a strict subset, so not the trivial "everybody"/"nobody"), reproducing 6.7's width-1
numbers exactly. ⛔⛔ **But the entry's own reasoning was FALSE:** it argued the sets were
"near-certainly identical" *because the recorded shelf distributions were identical across widths* —
they are **not**. Widths 3 and 4 give `shelf0:19 shelf1:7 shelf2:1 shelf3:1`, not `shelf1:6 shelf2:3`.
The same 19 players win nothing while the trophies distribute differently among the 9 who do. The AC
was right to demand the SET rather than accept the inference.

**13. ⛔ WHAT THIS STORY DID NOT CLOSE, said explicitly (AC13).** All six are recorded as a new
section appended at the **end** of `deferred-work.md`:
- **`:417` / `:418`** — offered *"or 6.11"* and **declined deliberately**. Both are design-intent
  calls about `CeremonyReveal.tsx` / `reveal.module.css` that no AC settles, and this story touches
  no file under `app/**` at all.
- **`:371`** — **re-homed, its premise void.** It was homed here because "6.11 rebuilds the corpus
  anyway"; 6.11 deliberately does not (see Note 1). Unlike its sibling `:347` this genuinely needs the
  stack — it greps 28 player **names** on a rendered page, and names are not in the bundle at all.
  Re-homed to the next story that stands up the full stack. ⚠ Likeliest explanation recorded for the
  next owner: two players share a display name, making **27 distinct names** correct and the "28
  distinct player names" anchor the figure that is wrong. Unverified.
- **⛔ The FR-21 floors slice** — `6-8a:503` marks it *"owed before Epic 6 closes"*. **This was the
  last story of Epic 6 and it did not do it.** DECISION C has now held seven times. Re-homed to
  **Epic 7 explicitly** at Cuatro's direction (Question 6) rather than allowed to lapse with the epic.
  It is a product decision — are 24/20 right for a 28-player single-round wingman tournament? — and it
  must be made before a real audience watches this ceremony.
- **`:336`** (the `prng.test.ts` 5 s flake) — not this story's by its own rule (*"whichever story next
  touches `vitest.config.ts`"*), and 6.11 did not. ⚠ Measured: it did **not** fire on any of the ~12
  full-suite runs this session.
- **`:389`** — stays not-mine: it names *"the next story that touches `worker/ceremony/bundle.go`"*,
  and this story added a new `_test.go` beside it without touching that file.
- **No shipped TypeScript orchestrator** — the composition lives in `end-to-end.test.ts`, deliberately
  (`lib/roulette` is the verifier; a producer-side `ceremony.ts` would ship a module no route imports
  and redden the shipped-module pin). Recorded as a design note with its cost stated.

**14. Two case-name pins reddened, both updated deliberately.** `sweep_test.go`'s `sweepCaseNames`
and `sweep.test.ts`'s expected list both pin the anti-sweep case set by exact equality, and `:339`'s
two new rows turned both red — which is the pin working. Updated **having read the rows**, never by
deleting the assertion, with the reason recorded at each site. ⚠ Neither file-set pin
(`prng_test.go:850-853`, `prng.test.ts:662-684`) reddened: this story adds only `*_test.go` and
`*.test.ts`, and both pins scope to production sources.

**15. Versions: nothing moved.** No npm package, no Go module, no Python dependency added.
`lib/roulette`'s empty import graph is intact; `generate_vectors.py` remains stdlib-only.

### File List

**New:**
- `roulette/vectors/end-to-end.json` — gate 5's vector (48,158 bytes, 2 cases)
- `worker/awards/end_to_end_test.go` — gate 5, the draw half + AC5's file-set pin
- `worker/ceremony/end_to_end_test.go` — gate 5, the serialization half (the two-package join)
- `lib/roulette/end-to-end.test.ts` — gate 5, the verifier half + AC5's file-set pin
- `lib/roulette/generator-check.test.ts` — AC6's automated `--check` gate

**Modified:**
- `roulette/vectors/generate_vectors.py` — gate 5's section, `run_ceremony`, the projection, the
  forced catalog, the `outputs` entry, AC9's rows, AC10's 0023 vocabulary link, AC7's comment blocks,
  AC11's docstring count
- `roulette/vectors/ladder-resolve.json` — `:309` ×3, `:325` ×2, `:326`'s `declared_divergences`
- `roulette/vectors/antisweep-resolve.json` — `:339` ×2
- `roulette/vectors/pity-draw.json` — `:350`'s emitted `second` blocks
- `roulette/vectors/README.md` — AC7's renumbering, the gate-5 ownership row, the
  `### end-to-end.json` format section with its jsonc sketch and case table, AC11's counts, the
  *"not finished"* line retired
- `_bmad-output/planning-artifacts/architecture/.../SOLUTION-DESIGN.md` — §9.6 renumbered (AC7)
- `lib/roulette/verify.test.ts` — the *"NOT assertable here"* comment corrected (AC4)
- `lib/roulette/sweep.test.ts` · `worker/awards/sweep_test.go` — the two case-name pins (`:339`)
- `_bmad-output/implementation-artifacts/deferred-work.md` — 12 🟢 CLOSED + 1 🔵 RE-HOMED in place,
  new section appended at the end
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Byte-untouched (verified):** `app/**` · `supabase/**` · all nine shipped `lib/roulette/*.ts`
modules · **every** production `.go` file under `worker/**` · `canonical-bundle-input.json` ·
`prng-block.json` · `prng-uniform-int.json` · `stage2-resolve.json` · `stage1-pick.json` ·
`canonical-bundle.json`. **0 CRLF** across all 15 touched files.

### Change Log

| date | change |
|---|---|
| 2026-08-12 | Story 6.11 implemented. Gate 5 (`end-to-end.json`) shipped with an anchor run and a forced run, both projected from the committed real snapshot (DECISION AA/AB/AE). `--check` automated as a Vitest gate and proven to fail on drift and on a missing interpreter (AC6/DECISION AD). Independence measured clean 70/70 on two implementations including a different model (AC8). Thirteen inherited debts closed, one re-homed. Gate numbering settled across three sites (AC7/DECISION AG). FR-29 rung 3 declared unreachable end-to-end with its measurement (DECISION AF). Mutation pass 11/11 killed, plus a two-sided-gate check. |

### Gates — RE-MEASURED at the code review, after all 24 patches (2026-08-12)

⭐ Every figure below was measured by the reviewer against the tree, not carried over.

| gate | story claimed | after the review's patches |
|---|---|---|
| 1 `npm run lint` | 0 errors (1 warning) | **0 errors**, same 1 pre-existing warning (`reduced-motion.test.ts:241`, untouched) |
| 2 `npx vitest run` | 1973 / 57 | **1980 / 57**, all passing (+7 from the review's new consumers and guards) |
| 3 `npm run build` | 0 | **0**, every viewer route still `ƒ` dynamic ⭐ *and this is the gate that matters — Vitest does not typecheck* |
| 4 Go build/vet/test | clean | **clean**, 7 packages, exit 0 |
| 5 `gofmt -l ./worker` | empty | **empty** |
| 6 `--check` | OK ×9 | **OK ×9**, and **PROVEN TO FAIL**: a deliberate one-byte drift printed `DRIFT end-to-end.json` / exit 1, restored SHA-256-verified. The missing-interpreter path was proven **loud** on a stripped PATH, with **0 skips**. |
| 7 pgTAP | 1543 / 30 | ⚠ **NOT re-run by the reviewer — unverified.** No pgTAP file was touched by the story or by this review, but the number is carried, not measured. |
| 8 scope + CRLF | — | Every changed `.go`/`.ts` is a **test** file; **no production source**, no `app/**`, no `supabase/**`, and `canonical-bundle-input.json` + the four named vectors byte-untouched. **0 CRLF** across all 27 touched files except `sprint-status.yaml`, which is natively CRLF. |

⚠ **One CRLF incident, caught and fixed.** An edit converted `lib/roulette/ladder.test.ts` wholesale to
CRLF (1,793 line endings). `git diff --numstat` stayed `53 / 0` because `core.autocrlf` normalises on
comparison — so **git would not have shown it**, and the byte-level sweep is what caught it. Converted
back to LF and the suite re-run (208 passing). ⭐ This is exactly why gate 8 measures raw bytes rather
than trusting `git diff`, and it is the third time this repo has been bitten by `core.autocrlf` with
no `.gitattributes`.

### Gates — as measured by the story, before the code review

| gate | baseline `60d189c` | after |
|---|---|---|
| 1 `npm run lint` | 0 errors (1 pre-existing warning) | **0 errors** (same 1 warning, untouched) |
| 2 `npx vitest run` | 1943 / 55 | **1973 / 57** (+30 tests, +2 files) |
| 3 `npm run build` | 0, all viewer routes `ƒ` | **0**, all 6 viewer routes still `ƒ` |
| 4 Go build/vet/test | clean | **clean** (7 packages ok) |
| 5 `gofmt -l ./worker` | empty | **empty** |
| 6 `--check` | OK ×8 | **OK ×9** |
| 7 pgTAP | 1543 / 30 PASS | **1543 / 30 PASS** (re-run on a fresh reset) |
| 8 scope + CRLF | — | production sources byte-untouched; **0 CRLF** across 15 touched files |
