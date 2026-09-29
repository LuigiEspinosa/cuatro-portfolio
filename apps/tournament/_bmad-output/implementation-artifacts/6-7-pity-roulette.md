---
baseline_commit: ba894d1
---

# Story 6.7: Pity roulette

Status: done

> **⛔⛔ READ THIS BEFORE THE ACs. At the SHIPPED configuration pity does not "catch the few players
> the spins left behind" — it hands a consolation award to ALL 28 players, and it is the ONLY award
> anybody receives.**
> 6.6's qa66 rebuild measured it directly (2026-08-07, re-derived from the real corpus): **0 of 28
> players clear the FR-21 floors (24/20)**, so every one of the twelve awards resolves
> `no_eligible_players`, nobody wins anything, every shelf stays at 0, and pity's input is the
> **entire roster, 28 of 28** ([6-6:606-610](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L606),
> [:738](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L738)). This is the **fourth story in a row** to measure
> that same zero ([deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269)).
> **AC6 must report it as a number and Question 3 must carry it to Cuatro. Do NOT resolve it by fiat**
> — whether "everyone gets a consolation and nothing else" is an acceptable ceremony, or whether the
> `24`/`20` literals have become a ceremony **blocker** that 6.7 must escalate rather than absorb, is
> a product call. ⛔ **DECISION C stands: the floors and the literals are UNTOUCHED** (`0021:56`).
>
> ⚠ **The second thing to know:** the counterfactual pity was designed against is **19 of 28**, at
> floors-0, and those 19 steamid64s are listed **BY NAME** in
> [6-6:657-673](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L657) with the 9 + 12 + 19 = 28 reconciliation. That
> list is this story's entire designed-against input. Transcribe it into the harness; never re-derive
> it by eye.
>
> ⚠ **The third thing to know:** unlike 6.5's ladder and 6.6's anti-sweep, **pity DRAWS BYTES.** The
> whole discipline inverts. Where 6.6's AC4 was *"it takes no stream and the signature is the proof"*,
> yours is *"it takes a stream, the byte cost is measured and pinned, and the Stage-1 stream is
> provably unmoved."*

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the eighth story of the epic, and the LAST
resolver before the persistence/reveal stories**
Traces: **FR-28** ([prd.md:380-386](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L380)) · **AD-14** ([ARCHITECTURE-SPINE.md:148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148) and **`:221`** — *the whole normative pity rule is ONE
sentence*) · **SM-2** ([prd.md:483](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L483) — *"zero Players finish with no shot at a prize"*) · SOLUTION-DESIGN
**§9.4** ([:425-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L425)), **§9.5** ([:433](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L433) — `pity` is a published bundle key) · [epics.md:1114-1130](_bmad-output/planning-artifacts/epics.md#L1114)
Consumes: 6.3's `PityLabel` / `PITY_LABEL`, `NewStream` / `createStream`, `UniformInt` / `uniformInt`
· 6.6's `ResolveSpin` / `resolveSpin` **result** (the shelf the caller advanced, and the winless set it
leaves) · 6-4a's `SnapshotPlayer` (⭐ **`IdleDQ` is the SNAPSHOT sense — see AC1**) · 6-4b's
`Stage1Input.Shelf` **shape** ([stage1.go:217-222](worker/awards/stage1.go#L217))
Hands to: 6.8 (persistence — the pity `spin` row(s), `award_result.is_pity`, the reveal axis), 6.9
(the `pity` bundle key, [SOLUTION-DESIGN:433](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L433) — outcome-affecting for `bundle_sha256`), 6.10 (`ronda de
consolación` / `Nadie se va con las manos vacías`, [EXPERIENCE.md:70](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L70), `:171`), 6.11 (§9.6 gate 4's
end-to-end vector must exercise *"a pity draw"*, [SOLUTION-DESIGN:443-444](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L443))

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer who won nothing in the main spins,
I want a guaranteed consolation draw,
so that nobody finishes the ceremony empty-handed.

## Acceptance Criteria

**AC1 — the WINLESS SET is `shelf == 0` AND not-fully-DQ'd, and the second half has a precise, easy-to-invert meaning that must be pinned in code.**
**Given** the pity rule ([epics.md:1122-1124](_bmad-output/planning-artifacts/epics.md#L1122); FR-28 [prd.md:385](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L385) — *"every registered Player who was
**not fully AFK/idle-DQ'd**"*; [SPINE:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221); [SOLUTION-DESIGN:427-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427)),
**When** the winless set is computed,
**Then** it is every rostered player in the injected snapshot with `shelf == 0` **and** `IdleDQ ==
false`, returned in **byte-lex** SteamID64 order (the order Stage 2 iterates and rung 5 returns), and
⭐ **the two facts of `idle_dq` are pinned in a named comment at the site in both runtimes**: at
snapshot layer it means **FULLY DQ'd** — *"true iff the player has AT LEAST ONE approved stat_row and
EVERY one of them is idle"* — and **a rostered player with ZERO approved rows is `false` with zero
stats: winless, NOT disqualified, and pity must reach them** ([0024:584-589](supabase/migrations/0024_ceremony_lock_snapshot.sql#L584), restated on
`SnapshotPlayer.IdleDQ` at [stage2.go:153](worker/awards/stage2.go#L153) and [stage2.ts:141](lib/roulette/stage2.ts#L141)). ⚠ **An ABSENT shelf key is
shelf 0**, exactly as W8 defines it for Stage 1 ([stage1.go:220-221](worker/awards/stage1.go#L220)) — the normal shape, never an
error. ⛔ The DQ filter is **measured-inert today (0 fully-DQ'd players in the corpus)** — AC6 prints
that zero; do not narrate it, and do not delete the filter because it never fires.

**AC2 — the draw is a SEEDED SHUFFLE whose OUTCOME is invariant, and the shuffle algorithm is pinned to one exact variant with its byte cost stated.**
**Given** [SPINE:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221) and [§9.4:427-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427) — *"seeded **reveal order** via the pity stream; the
**outcome** — everyone winless gets one — is **invariant**"* — and [epics.md:1126-1128](_bmad-output/planning-artifacts/epics.md#L1126),
**When** pity runs,
**Then** the set of winners is **exactly** the winless set (a permutation of it: same length, same
members, no additions, no drops — assert it as a multiset identity, not by spot-check), and the
**reveal order** is a permutation of it produced by **one named, published shuffle** over
`uniform_int` on the `PityLabel` stream, whose per-step `n` sequence and total byte cost are recorded
in the result and pinned by the vector. ⭐ **"Seeded but invariant" is exactly the clause two honest
implementers realise differently** — the variant (Durstenfeld descending vs the ascending sweep), the
loop bounds, and whether index `i` is swapped with itself all change the permutation while every
implementation still calls itself Fisher–Yates. **Decide ONE, transcribe it in the vector's `spec`
string, and mirror it in all three implementations.** See DECISION D and Question 2.

**AC3 — the ZERO and ONE cases are first-class, and both draw ZERO bytes.**
**Given** that a zero-length and a one-length shuffle are where seeded-order code diverges, and that
the shipped-floors case (28 of 28) is the opposite extreme,
**When** the winless set is empty, or has exactly one member,
**Then** pity **runs and returns normally** — `{winners: [], reveal_order: []}` and
`{winners:[x], reveal_order:[x]}` — it is **not a refusal**, **not an error**, and **not a skip that
the caller has to special-case; and it consumes ZERO stream bytes in both cases**, which is a
measurable property the vector pins with an explicit `bytes_consumed: 0`. ⚠ `uniform_int(s, 1)` is
legal and reads **zero** bytes (`minimalK(1)` gives `k = 0`, `limit = 1`, [prng.go:187-230](worker/awards/prng.go#L187)), so an
implementation that *does* call it for `n = 1` is byte-identical to one that does not — **which is
precisely why the loop bound has to be pinned by the vector rather than by the byte count.**

**AC4 — pity draws from its OWN domain-separated stream, and Stage 1's measured 22 bytes are PROVABLY unmoved.**
**Given** [SPINE:216](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L216) (*"each spin's stream is independent (starts at counter 0)"*) and 6.3's
`PityLabel = inclusivcup/v1/pity` ([labels.go:42](worker/awards/labels.go#L42), [labels.ts:24](lib/roulette/labels.ts#L24)),
**When** pity draws,
**Then** it takes a stream **keyed by `PityLabel` and only `PityLabel`**, starting at counter 0,
constructed by the CALLER and passed in (the same injection discipline `Stage1Pick` uses), and ⭐ **the
real-floors 12-spin Stage-1 ceremony still costs byte-for-byte 22 bytes with drawn order
character-for-character `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`** —
a change in either is a **DEFECT, not a finding**, because pity's stream is independent by
construction. ⚠ **The import-graph pin inverts here**: where `sweep.ts`'s ABSENCE of `./prng` was
load-bearing (6.6 AC4), `pity.ts` **MUST** import `./prng`, and its TS entry point is therefore
**`async`** like `stage1Pick` and unlike `resolveSpin` — `uniformInt` returns a `Promise`
([prng.ts:328](lib/roulette/prng.ts#L328)). ⭐ [prng.test.ts:789-796](lib/roulette/prng.test.ts#L789) spells out, in six lines, exactly why
`sweep.ts`'s **absence** of `./prng` is load-bearing — **your entry must say the mirror of it.** Update
that file's three pins deliberately, and say which half of each is the load-bearing one.

**AC5 — the pass is proven by a shared, third-implementation-anchored vector reaching every representable path.**
**Given** AD-14's *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build"* and
the house rules at [roulette/vectors/README.md:13-24](roulette/vectors/README.md#L13),
**When** the build runs,
**Then** the golden JSON carries, at minimum: the **empty** winless set (AC3); a **one-member** set
(AC3); a **two-member** set (the smallest set where the shuffle can actually reorder — and a row where
it demonstrably **does** reorder, so a no-op shuffle is killed); a set large enough to force a
**rejection** inside `uniform_int` (so the rejection path is byte-accounted here too, the way
`prng-uniform-int.json` does it); a set whose members are supplied **out of byte-lex order** (so the
canonical sort is load-bearing, ⚠ 6.6's mutation pass found exactly this survivor because every
fixture roster was pre-sorted, [6-6:816-821](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L816)); a roster where a
player has **`idle_dq = true` and shelf 0** (excluded) sitting beside one with **shelf 0 and zero
approved rows** (included) — the AC1 inversion, in one row; a roster where **everyone** holds a trophy
(winless set empty **for a non-empty roster** — distinct from the empty-roster row); a roster where
**nobody** holds a trophy (the shipped-floors shape, all-winless); an **absent** shelf key beside an
explicit `0`, with byte-identical expected blocks (the absence-is-the-empty-case rule); and a
`refusals` array with a **closed, genuinely closed** `detail` set including a duplicate `steamid64`, a
negative shelf count, a shelf key naming a player not on the roster, and ⭐ **one row malformed in TWO
ways at once** so validation order is observable. Every expected value is produced by the committed
third implementation (`generate_vectors.py --check`, **byte** comparison), **both** suites read that
same file, and the README ownership table gains the row.

**AC6 — the draw is exercised over the REAL corpus in both runtimes, and the shipped-floors consequence is reported as a number.**
**Given** THE BAR discipline, Epic-5 retro Action Item #5 (*"every claim backed by printed output"*)
and ***"measure zeros, never narrate them"***,
**When** the story is signed off,
**Then** both runtimes run the full ceremony **plus pity** over the real frozen `fair_seed`
(`1b3cd678…3279c`), the real captured `stat_snapshot_row` set and the real 12-award catalog, their
transcripts are diffed **mechanically** (files + `Compare-Object` + SHA-256), and Completion Notes
record **measured**: ⭐⭐ **the winless cardinality at the SHIPPED floors (expected 28 of 28 — print
it) and the fact that a consolation award is then the only award anybody holds**; the same at
floors-0 (expected **19 of 28**, and ⭐ **the 19 ids reproduced against
[6-6:663-667](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L663) by set equality, printed**, at all four
`live_count` widths); ⭐ **the exact pity byte cost at each cardinality (0, 1, 19, 28), including how
many `uniform_int` rejections occurred**; the reveal order at each; **how many players are excluded by
the DQ filter (expected ZERO — print the zero)**; and ⭐ **the Stage-1 invariant re-measured: 22 bytes,
that drawn order, character-for-character**.

**AC7 — `worker/awards/labels.go:41`'s FR-26 mislabel is corrected, and FR-28 stops being absent from the seam.**
**Given** that FR-26 is anti-sweep + the luck meter and **FR-28** is pity,
**When** the trace is read from the code,
**Then** [labels.go:41](worker/awards/labels.go#L41) — *"the pity ALGORITHM (**FR-26's** pity roulette) is Story 6.7's"* — names
**FR-28**, and the TypeScript mirror ([labels.ts:22](lib/roulette/labels.ts#L22)), which today names **no FR at all**, gains
the same trace so the two sides say the same thing. ⚠ **MEASURED, and it corrects the contexting
brief:** the mislabel is at **ONE** site, not two, and the string `FR-28` currently appears **ZERO**
times across `worker/awards/*.go`, `lib/roulette/*.ts`, `generate_vectors.py` and
`roulette/vectors/README.md` — this story is what introduces it. Re-run that grep and report both
counts rather than trusting this sentence.

## Tasks / Subtasks

> Build order: Task 0 (read) → **Questions answered** → Task 1 (pin the edge semantics) → Task 2 (the
> vector seam) → Task 3 (first language) → Task 4 (second language) → Task 5 (the labels + docs) →
> **Task 6 (THE BAR) gates sign-off** → Task 7 (mutation) → Task 8 (gates).
> **Write the vector before the second implementation** so the second is written against a fixed
> artifact, not against the first one's source. ⛔ **The anchor changes FIRST and in the same published
> order** — 6.5's T1 was a three-way divergence created by patching two runtimes and not the
> arbitrating third.

- [x] **Task 0 — Read before you write**
  - [x] [SOLUTION-DESIGN §9.4](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L425) (`:425-429` — anti-sweep AND pity in five sentences; **pity is the last two**),
        **§9.1** (`:400-404` — the labels and `uniform_int`'s exact rejection rule), **§9.5** (`:431-438`
        — ⭐ **`pity` is one of the seven published bundle keys**, so its SHAPE is outcome-affecting for
        6.9's `bundle_sha256`), **§9.6** (`:440-449` — gate 4 must exercise *"a pity draw"*; the build
        order ends *"→ pity (gate 4)"*).
  - [x] [ARCHITECTURE-SPINE.md:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221) — ⭐ **the ENTIRE normative pity rule, one sentence**, read to its
        end. **`:148`** (AD-14, and the DECISION E clause naming **pity (6.7)** by number — see
        DECISION K'), **`:216`** (stream independence), **`:222`** (the bundle keys), **`:234`** (the DB
        `UNIQUE`), **`:185-188`** (AD-22 — the reveal axis is **6.8's**).
  - [x] [prd.md:380-386](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L380) (FR-28 verbatim, **both** testable consequences), **`:483`** (SM-2 — *"zero
        Players finish with no shot at a prize"*, the metric this story validates), **`:451`** (the
        non-goal that leans on pity: *"Anti-sweep and pity remain the accepted mitigation for award
        concentration"*), **`:115`** (the glossary entry).
  - [x] ⭐⭐ [6-6-anti-sweep-and-luck-meter.md](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md) Completion Notes **in full**, and especially
        **`:606-610`** (the winless set 6.7 inherits — 28/28 shipped, 19/28 floors-0, identical at all
        four widths), **`:637-673`** (▶ THE qa66 REBUILD — the **19 ids by name**, the 9 holders, the
        9 + 12 + 19 = 28 reconciliation), **`:675-693`** (the shelf-advancing-vs-frozen 21-vs-22
        reconciliation — ⚠ **your harness must DECLARE which arm it runs**, because 6.5's and 6.6's
        differed and neither said so), **`:740-748`** (⭐ *"the cap is per-SPIN … Anti-sweep bounds
        concentration WITHIN a spin and does nothing across spins — **that is pity's job, by design**"*),
        **`:571-580`** (the eight-row matrix), **`:729-738`** (the shelf distributions).
  - [x] ⭐ [worker/awards/sweep.go](worker/awards/sweep.go) **:198-209** (A10 — *"advancing the shelf across spins is the
        CALLER's job; Story 6.7's pity reads the result"*), **:119-157** (`AwardAssignment` — ⭐ the
        `SweptOut` DECISION F note says the exhaustion/no-qualifier distinction *"differ[s] for Story
        6.7's pity draw"*), **:159-173** (`SpinResult.Assigned`, byte-lex). Mirror in
        [lib/roulette/sweep.ts](lib/roulette/sweep.ts) **:36-44**, **:102-141**, **:142-160**.
  - [x] [worker/awards/stage2.go:149-200](worker/awards/stage2.go#L149) (`SnapshotPlayer` — the type you consume;
        ⭐ **`IdleDQ` at `:153`**), **:223-260** (`OutcomeKind` — the closed five you must NOT widen).
        Mirror at [lib/roulette/stage2.ts:51-149](lib/roulette/stage2.ts#L51) (⭐ **`:141` restates the AC1 rule verbatim**).
  - [x] [worker/awards/prng.go:196-230](worker/awards/prng.go#L196) (`UniformInt` — the rejection rule, **E2's `[1, MaxN]`
        bound**, and that `n = 1` reads **zero** bytes), **:108-135** (`NewStream`, `Consumed`),
        [worker/awards/labels.go:26-43](worker/awards/labels.go#L26) (the domain-separation contract and ⚠ **the FR-26 mislabel at
        `:41`**). Mirror at [lib/roulette/prng.ts:328](lib/roulette/prng.ts#L328) (⚠ **`uniformInt` is `async`**), **:60-65**
        (`N_BOUNDS`), [lib/roulette/labels.ts:18-24](lib/roulette/labels.ts#L18).
  - [x] [worker/awards/stage1.go:210-251](worker/awards/stage1.go#L210) — ⭐ **`Stage1Input.Shelf map[string]int` at `:217-222`
        is the shelf shape you REUSE**, including W8's *"an ABSENT player is shelf 0 … never an error"*.
        Two near-identical shapes is how the two runtimes drift; 6.5 said it about `StatValue` and 6.6
        said it about `Stage1Candidate`.
  - [x] ⭐ [supabase/migrations/0025_ceremony_results.sql](supabase/migrations/0025_ceremony_results.sql) — **the whole constraint set, before you
        design any write shape.** `:109-124` (`spin`, ⭐ **`spin_kind_valid check (kind in ('main',
        'pity'))` at `:119`** and `spin_ceremony_index_key unique (ceremony_id, spin_index)` at `:123`),
        `:139-185` (`award_result` — ⭐ **`is_pity` at `:153`**, ⭐⭐ **`award_result_spin_award_key
        unique (spin_id, award_id)` at `:178`**, the `award_id` **NOT NULL** FK `on delete restrict` at
        `:146-147`, and the `tie_ladder_exit_step` **`0 → NULL`** writer contract at `:162-176`),
        `:204-248` (`award_result_winner` — ⭐⭐ **`award_result_winner_spin_key unique (spin_id,
        winner_entry_id)` at `:247`**, and ⚠ **`winner_entry_id` references `roster_entry(id)`, NOT a
        steamid64** — the id↔entry mapping is 6.8's writer, but your output shape has to make it
        possible), `:263-343` (the deferred IC909 trigger asserting `is_shared = (winner count > 1)`),
        `:71-90` (the OUT OF SCOPE block, ⭐ **`:81-82`: *"NO pity `spin` row content and NO consolation
        award → 6.7. `spin.kind` admits 'pity' because SOLUTION-DESIGN:209 declares the closed set;
        nothing writes one here."***).
  - [x] ⭐ [supabase/migrations/0023_award_catalog.sql](supabase/migrations/0023_award_catalog.sql) — the `award` table `:63-152` (the closed-set
        CHECKs at `:79-89`, `award_tournament_priority_key unique … deferrable` at `:150`) and ⭐⭐
        **`curate_award_catalog`'s DELETE-MISSING at `:448-453`: *"the payload IS the catalog, so an
        award the payload omits is retired"*.** Then [lib/awards/catalog.test.ts:33-34](lib/awards/catalog.test.ts#L33) (**exactly 12**)
        and `:56-58` (**priorities exactly 1..12, each once**). ⛔ **These three facts together are why
        Question 1 exists and why you must not invent an answer to it.**
  - [x] [supabase/migrations/0024_ceremony_lock_snapshot.sql:584-589](supabase/migrations/0024_ceremony_lock_snapshot.sql#L584) — ⭐ **the `idle_dq` snapshot
        sense, verbatim, ending *"they are winless, not disqualified, and 6.7's pity draw must still be
        able to reach them"*.** This is AC1's whole content and the one document that addresses this
        story directly.
  - [x] [roulette/vectors/README.md](roulette/vectors/README.md) — the three hard rules (`:13-24`), the ownership table
        (`:31-40` — ⭐ **there is no 6.7 row; you add it**), ⚠ **`:64-67`'s "not finished" line, which
        says *"Everything the draw itself needs … is here"* and names only 6.9 and 6.11 — that sentence
        is WRONG today because pity is missing; fix it as part of your row**, the format rule
        (`:69-81`), the representability rule, the `antisweep-resolve.json` section (`:601-703`) as
        your structural model, and the loader table (`:807-812`).
  - [x] [roulette/vectors/generate_vectors.py](roulette/vectors/generate_vectors.py) — ⭐ `main()`'s `outputs` dict at **`:7306-7315`**
        (**one line registers a new file; `--check` and the write path both iterate it**), `render` at
        `:7296-7298`, and the **byte**-comparison `--check` at `:7317-7333` with its CRLF warning.
        Reuse the existing `_p` / `_award` / `_render_player` helpers rather than adding new ones.
  - [x] [EXPERIENCE.md:171](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L171) (*"**Pity round.** After all 12, every Player still holding zero
        Awards enters the **ronda de consolación** — a separate, seeded, guaranteed draw (FR-28).
        'Nadie se va con las manos vacías.'"*), `:70` (⭐ **the two exact Spanish strings — 6.10's to
        render, yours to leave alone**), `:119`, `:164`, `:180` (⭐ *"The Pity round is **not**
        'everyone's a winner' consolation … a promise of spotlight, not a pity-pat"* — the framing
        Question 3 has to be answered against), `:230-231`, `:42`, `:47`. ⛔ **Read it so your data
        shape can serve it; build none of it.**
  - [x] Sweep-prove the greenfield claim before writing a line: **nothing named `pity`, `Pity`,
        `winless`, `consolation` or `consolación` exists as a business concept anywhere in
        `worker/awards/` or `lib/roulette/`** — only 6.3's `PityLabel` / `PITY_LABEL` and their tests,
        plus the forward-references 6-4a/6-4b/6.5/6.6 wrote **to** this story by name. (Confirmed at
        contexting: 6.3's label + tests, and one comment line each in `stage1.*`, `stage2.*`,
        `ladder.*`, `sweep.*`. **Re-confirm, do not assume.**)

- [x] **Task 1 — Pin the edge semantics IN CODE COMMENTS before implementing (AC: 1, 2, 3, 4)**
  > Same discipline as 6.3's E1–E4, 6-4a's S1–S7, 6-4b's W1–W10, 6.5's L1–L12 and 6.6's A1–A13, and
  > for the same reason: each is a place where two honest implementers reading the same one-sentence
  > spec produce a different ceremony. Each gets a vector row in Task 2 and a named comment at its
  > implementation site **in both languages**.
  - [x] **P1 — pity TAKES A STREAM and the byte cost is part of the contract.** The inverse of 6.6's
        A1. State at the site that the stream MUST be keyed by `PityLabel` and MUST be fresh (counter
        0), that the caller constructs it, and that a `Consumed()` assertion here is **not** vacuous —
        it is the gate. Record per-draw accounting in the result the way `Stage1Draw` does
        ([stage1.go:253-257](worker/awards/stage1.go#L253)).
  - [x] **P2 — the OUTCOME is invariant; only the ORDER is seeded.** The winner set is the winless set,
        full stop. ⛔ There is no selection, no elimination, no weighting and no luck meter in pity —
        a "draw" here is a **permutation**, not a lottery. Say it, because "pity roulette" reads like a
        lottery and FR-28's own name invites the wrong implementation.
  - [x] **P3 — the shuffle variant is PINNED, not "Fisher–Yates".** Name the exact loop, its bounds,
        its direction, and its `n` per step, in a comment that a reader can execute by hand. See
        DECISION D. ⚠ The two common variants consume the same *number* of draws over the same `n`
        multiset in some formulations and different ones in others — **do not reason about which; pin
        one and let the vector arbitrate.**
  - [x] **P4 — byte-lex canonical order FIRST, then shuffle.** The input set is sorted before the
        first draw, in every implementation, or the seeded permutation depends on the caller's
        iteration order and the ceremony stops being reproducible from the bundle. ⭐ 6.6's mutation
        pass found the twin of this defect surviving because every fixture roster was already sorted
        ([6-6:816-821](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L816)) — **write the out-of-order vector row in
        the same edit as the sort.**
  - [x] **P5 — `n = 0` and `n = 1` resolve, they do not refuse** (AC3), and both cost zero bytes.
  - [x] **P6 — the shelf is READ, never written, and an absent key is 0.** Mirror W8's rule verbatim.
        Refuse a **negative** count (the two-sided guard 6.6 installed on `weightAt` is the precedent —
        [deferred-work.md:308](_bmad-output/implementation-artifacts/deferred-work.md#L308) is closed and this is the same class).
  - [x] **P7 — the FR-21 floors are NEVER consulted.** ⭐⭐ **This is the single most important
        semantic in the story and it is easy to get backwards.** Pity's eligibility is *"not fully
        DQ'd"*, **not** *"cleared the floors"* — a player who missed the floors won nothing precisely
        *because* of them, and re-applying them in pity would exclude the very people FR-28 exists for
        and make SM-2 unachievable by construction. Note what is ABSENT from the implementation: no
        `RoundsPlayed` read, no `Kills` read, no `eligiblePlayers` call, no `Award` parameter at all.
  - [x] **P8 — pity does NOT read DECISION E's suppressed `Tied` set.** See DECISION K'. State the
        reasoning at the site, because [SPINE:148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148) names pity as a reader and a future maintainer
        will otherwise "restore" it.
  - [x] **P9 — typed refusals with a CLOSED, genuinely closed `detail` set declared ONCE in the
        vector.** Mirror `SweepInvalidError` ([sweep.go:88-117](worker/awards/sweep.go#L88)) exactly: sentinel + `Unwrap() []error`
        + the four-value pattern, with `internal` declared **non-row-representable** rather than left
        silent ([sweep.go:57-86](worker/awards/sweep.go#L57) is the model paragraph, and
        [stage1_test.go:505-530](worker/awards/stage1_test.go#L505) /
        [stage1.test.ts:533-553](lib/roulette/stage1.test.ts#L533) are the assertions). 6-4b
        shipped 9/7/7 across three implementations; 6.5 shipped one nobody inspected; 6.6 finally got
        it right — **copy 6.6, do not invent a third design.**
  - [x] **P10 — VALIDATION ORDER IS CONTRACT.** Decide it once, publish it in the vector's `spec`
        string, mirror it in all three implementations, and include ⭐ **one row malformed in TWO ways
        at once** so a reordering is observable. This has now been the headline of two reviews.
  - [x] **P11 — an ABSENT container is the EMPTY container.** Go `nil` / TS `undefined` / Python `None`
        all normalise to `{}` / `[]` **inside** the module; `null` and structurally-wrong types stay
        refused in TS/Python as a deliberately non-vectorable guard. Cuatro's call at 6-4b's review;
        do **not** loosen `stage1.*` / `stage2.*` / `ladder.*` / `sweep.*` to suit this caller.

- [x] **Task 2 — The vector seam (AC: 5)** ⚠ *gated on Questions 1–3 being answered*
  - [x] ⭐ **A NEW file, `roulette/vectors/pity-draw.json`**, registered by **one line** in `main()`'s
        `outputs` dict ([generate_vectors.py:7306-7315](roulette/vectors/generate_vectors.py#L7306)) — the `stage2-resolve` / `ladder-resolve` /
        `antisweep-resolve` pattern. Say why in Completion Notes. ⚠ Unlike those three, **pity IS a
        stream consumer**, so its README section must say the opposite of theirs: it belongs beside
        `stage1-pick.json` on the stream side of the split, and `§9.6`'s build order ends *"→ pity"*.
  - [x] Case shape, following the house style: `{ "name", "note", "players": [ …AD-19 rows… ],
        "shelf": {"<steamid64>": <int>, …}, "expected": { "winless": ["<steamid64>", …],
        "reveal_order": ["<steamid64>", …], "draws": [{"n": <int>, "k": <int>, "rejections": <int>,
        "value": <int>}], "bytes_consumed": <int> } }`, plus a top-level `seed_hex`, the `spec` string,
        and the declared `refusal_details` / `row_representable_refusal_details` split.
  - [x] ⭐ **`bytes_consumed` and the per-draw `n` sequence are as load-bearing as the order.** A
        vector that pinned only `reveal_order` lets an implementation that reaches the right
        permutation by a *different* draw sequence pass every row — and 6.9's browser has to consume
        the same bytes, not merely reach the same answer. **Pin them on every case.**
  - [x] Mandatory rows — every one named in AC5, plus: two rows whose **only** difference is an absent
        shelf key vs an explicit `0`, with **byte-identical** expected blocks (the identity IS the
        assertion — 6.5's `stage2-resolve.json` absence-spelling trio is the model,
        [README.md:389](roulette/vectors/README.md#L389)); and a row where the winless set is a
        strict subset of the roster in the **middle** of byte-lex order, so an off-by-one in the
        filter is visible.
  - [x] ⭐ **Guard the guards** — the project's own recurring defect, now at its **fifth** occurrence
        (6.6's Task 2 and 6-5b's AC5 are the two most recent; the standing rule is that a "some case exercises X" guard can be satisfied by a degenerate row, so exclude degenerate inputs, scope the probe, and pin the case-name set).
        Every coverage flag must name the **specific row** it claims and **re-derive that row's
        property from its own data**: the rejection row's guard must re-derive that `256 mod n != 0`
        *and* that a rejection actually occurred in the expected draws; the reorder row's guard must
        re-derive that `reveal_order != winless`; the out-of-order row's guard must re-derive that the
        **supplied** order differs from byte-lex **and** that its expected block is byte-identical to
        the sorted twin's. Pin the **case-name set by exact equality in both suites**, use
        `pins` / `pins_inputs` at the anchor, and assert **exactly one** row per uniquely-claimed
        property.
  - [x] ⛔ **Do not hand-write expected values, do not add a second generator, and never "fix" the
        generator by reading either implementation.** Write the anchor from **the spec text and this
        story's transcribed algorithm**, and **say which you did** — [deferred-work.md:300](_bmad-output/implementation-artifacts/deferred-work.md#L300)
        and `:318` are the standing findings that this claim has been weaker than stated twice.
  - [x] Update [roulette/vectors/README.md](roulette/vectors/README.md): the ownership row, a format section, a "cases that
        carry the weight" table in the house style, and ⚠ **`:64-67`'s "still to come" line — which
        currently claims the directory holds everything the draw needs. It does not, and after this
        story it does.** ⚠ **Also RECORD, do not silently renumber:** the README's gate numbering at
        `:39-40` (4 = canonicalization/6.9, 5 = end-to-end/6.11) is the **reverse** of
        [SOLUTION-DESIGN:441-445](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L441) (4 = end-to-end, 5 = canonicalization). Note it where you add
        your row; renumbering a shipped table is 6.9/6.11's call, not yours.
  - [x] Vectors are **data, not code**: LF newlines, 2-space indent, stable key order. SteamID64s stay
        decimal **strings**; `n`, `k`, `rejections`, `value`, `bytes_consumed` and shelf counts stay
        JSON **integers** — the split is by **provenance** ([README.md:74-81](roulette/vectors/README.md#L74)).
  - [x] `--check` must be **OK on all six existing files** afterwards, with every one of
        `prng-block.json`, `prng-uniform-int.json`, `stage2-resolve.json`, `ladder-resolve.json`,
        `stage1-pick.json` and `antisweep-resolve.json` **byte-identical** — prove it with
        `git status`, not by assertion.

- [x] **Task 3 — Go producer: `worker/awards/pity.go` (AC: 1, 2, 3, 4)**
  - [x] A pass over injected inputs. Recommended seam:
        `func ResolvePity(in PityInput) (PityResult, error)` with
        `PityInput{ Players []SnapshotPlayer; Shelf map[string]int; Stream *Stream }` and
        `PityResult{ Winless []string; RevealOrder []string; Draws []PityDraw }`.
        ⭐ **Reuse `SnapshotPlayer` and `Stage1Input.Shelf`'s `map[string]int`** rather than declaring
        near-identical types. ⭐ **Take a struct, not four positional parameters** — `Stage1Input` is
        the precedent and a positional `(players, shelf, stream)` is three same-shaped arguments a
        caller can transpose.
  - [x] `Winless` and `RevealOrder` are **byte-lex** and **the seeded permutation** respectively —
        two fields, never one, so a caller cannot accidentally publish the canonical order as the
        reveal order (or vice versa). Both are returned even when empty (`[]`, never `nil`-as-absent
        in the JSON the harness prints).
  - [x] Typed refusals: `ErrPity` sentinel + `PityInvalidError{Detail, Reason, Cause}` with
        `Unwrap() []error`, mirroring [sweep.go:50-117](worker/awards/sweep.go#L50). Declare the `Detail*` closed set **once** and
        make it genuinely closed.
  - [x] `worker/awards` stays a **LEAF** — no `worker/store`, `worker/db`, `worker/ingest`,
        `worker/config`. `TestPackageIsALeaf` ([prng_test.go:976](worker/awards/prng_test.go#L976)) will tell you if it stops
        being one.
  - [x] `worker/awards/pity_test.go` — table-driven **and** vector-driven (`loadVector` from
        `../../roulette/vectors`). Guard the loader against malformed rows; give every conformance
        switch a **final arm** that fails loudly on an unknown value; assert refusals are the **typed**
        error **and** the declared `detail`, never merely "some error".
  - [x] ⚠ **`worker/awards/prng_test.go` will redden and that is its job.** The shipped file set at
        [`:834`](worker/awards/prng_test.go#L834) is an **exact equality** —
        `{labels.go, ladder.go, prng.go, stage1.go, stage2.go, sweep.go}` becomes seven. ⛔ **Do NOT add
        `pity.go` to the `math/big` `exceptIn` list** ([`:845-885`](worker/awards/prng_test.go#L845), today
        `{stage2.go, ladder.go}`) — pity does no magnitude arithmetic; it indexes and swaps. Say so at
        the site, the way 6.6 said it about `sweep.go`.
  - [x] Banned constructs apply in full: no `float64`, no `math/rand`, no `time`, no `crypto/rand`,
        no `os`, no `fmt.Sprintf` in the decision path, no `.Int64()`/`.Uint64()`/`.Float64()`.
  - [x] Run `gofmt -l ./worker` — it must be **empty**.

- [x] **Task 4 — TS verifier: `lib/roulette/pity.ts` (AC: 1, 2, 3, 4)**
  - [x] The mirror — same names in camelCase, same refusals, same `detail` values, same order, same
        result shape. ⚠⚠ **`resolvePity` is `async`** (it awaits `uniformInt`), unlike 6.6's
        `resolveSpin` and like `stage1Pick`. A synchronous signature here is not a style choice; it is
        impossible.
  - [x] ⛔ **No `import 'server-only'`**, ⛔ **no import of `lib/awards/**`**, ⛔ no `node:` import.
        ✅ **`./prng` IS imported and that presence is load-bearing** — the inverse of `sweep.ts`.
  - [x] ⚠ **[lib/roulette/prng.test.ts](lib/roulette/prng.test.ts) reddens in three places and each must be updated
        deliberately:** the module list at [`:662-676`](lib/roulette/prng.test.ts#L662) (exact
        equality, six → seven), the per-module import-graph map ending at
        [`:803-804`](lib/roulette/prng.test.ts#L803) (add `'pity.ts': [...]` — whatever it
        **actually** imports; ⭐ **the PRESENCE of `'./prng'` is the load-bearing half here**, the exact
        inverse of the six-line justification at [`:789-796`](lib/roulette/prng.test.ts#L789)),
        and the non-vacuity pin at [`:810-813`](lib/roulette/prng.test.ts#L810)
        (`['ladder.ts', 'stage1.ts', 'sweep.ts']` → plus `pity.ts`).
  - [x] `lib/roulette/pity.test.ts` — colocated under `lib/**` or [vitest.config.ts:17](vitest.config.ts#L17) **silently
        does not run it**. Load the vector with `readFileSync` from the repo root.
  - [x] Add per-row `detail` assertions from the start. Deep-freeze any exported constant
        (`Object.freeze` is shallow — 6.1 shipped a "frozen" catalog of mutable entries).

- [x] **Task 5 — The FR-28 trace and the documentation debts (AC: 7)**
  - [x] [labels.go:41](worker/awards/labels.go#L41): `FR-26` → **`FR-28`**. Add the same trace to [labels.ts:22](lib/roulette/labels.ts#L22),
        which names no FR today. ⛔ Change nothing else in either file — `PityLabel`'s **value** is
        6.3's and moving one byte of it invalidates every ceremony.
  - [x] Re-run and **report** the two greps AC7 names (the FR-26-near-pity count, and the FR-28 count
        across the four seam artifacts) before and after.
  - [x] The README edits Task 2 lists, including the `:64-67` correction and the recorded gate-number
        discrepancy.

- [x] **Task 6 — ⛔ THE BAR: the real corpus, both runtimes, mechanically diffed (AC: 1, 6) — this gates sign-off**
  - [x] Rebuild the corpus the same way 6.6 did: 14 real `.dem.gz` → the REAL `ingest.DemoinfocsParser`
        → `stat_row` via the REAL `RecordParse` → the REAL `declare_match_format` / `bind_match_demo` /
        `approve_match` crowning → the REAL `curate_award_catalog` → the REAL `lock_ceremony`. Anchors
        that prove it is the same corpus: **204 rounds · 28 roster · 28 distinct players ·
        `fair_seed = 1b3cd678…3279c` · `row_count 28` · `eligible_count 0` · 12 awards**. ⚠
        `content_sha256` will differ again and that is **correct** (`achievement_ts` is wall-clock
        approval time). ⚠ The sequencing traps are real and are **not in the tree** (the harnesses are
                always deleted) — follow 6.6's Debug Log References and Story 6.2's recorded recipe
        ([deferred-work.md:278](_bmad-output/implementation-artifacts/deferred-work.md#L278)) step for
        step: curate the payload FIRST, parse before you seed, and drive the crowning through the
        `grand_final` `gf_order = 2` fixture with the other 13 matches published by the status flip.
  - [x] ⭐⭐ **Run the full 12-spin ceremony THEN pity, and print, per configuration:** the winless
        cardinality, the **winless ids**, the DQ-excluded count, the reveal order, the per-draw `n`
        sequence, the rejection count and the **exact byte cost**. Configurations: the **shipped** real
        24/20 floors at `live_count = 1` (expected winless **28/28**, DQ-excluded **0**), and the
        floors-0 counterfactual at widths **1, 2, 3 and 4** (expected winless **19/28 at all four**).
        ⛔ **DECISION C: floors-0 is harness-only; the `24`/`20` literals are untouched.**
  - [x] ⭐ **Reproduce 6.6's 19 ids by SET EQUALITY against
        [6-6:663-667](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L663), printed** — not by eye, not by count. A
        mismatch is the story's headline finding, not a footnote.
  - [x] ⭐ **DECLARE which shelf arm the harness runs** (advancing across spins vs frozen). 6.5's and
        6.6's harnesses differed on exactly this and neither declared it, which cost a whole review
        item to reconcile ([6-6:675-693](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L675)). Pity **requires** the
        advancing arm to have any input at all, so say so and print the shelf distribution you got.
  - [x] ⭐ **The invariant that must not move:** the real-floors 12-spin Stage-1 ceremony stays
        byte-for-byte **22 bytes**, drawn order character-for-character
        `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`. Pity uses its own
        domain-separated stream, so **a change there is a DEFECT, not a finding.**
  - [x] Diff the two runtimes' full transcripts **mechanically** (write both to files,
        `Compare-Object`, record each SHA-256) — not by eye. Both runtimes read **ONE** catalog
        projection and **ONE** snapshot export (the TS half runs as a throwaway Vitest file, because
        `lib/awards/catalog.ts` is `import 'server-only'` and Vitest is the only runner with the stub
        alias).
  - [x] Harness convention: throwaway `worker/cmd/qa67` + `lib/roulette/bar-qa67.test.ts` + `_qa67/`,
        **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` and
        `gofmt -l ./worker` proven clean **while present** *and* **after removal**. ⚠ `worker/cmd/qa54`
        is in the tree and is **not yours to delete**; do not add a second orphan. ⚠ A rebuild leaves
        the QA corpus in the local DB — **`supabase db reset` before pgTAP** (6-4a's first attempt
        failed 6/25 for exactly that reason; 6.6 hit it too).

- [x] **Task 7 — Mutation pass, before review (non-optional) (AC: 5)**
  > Epic-5 retro Action Item #3 makes a reviewer-independent mutation pass a review gate, and **every
  > prior story's own table was optimistic until it was hardened** — 6.2 (43/0 → 5 survivors in 6),
  > 6.3 (structurally invalid table), 6-4a (12 of 18 silently NOT-APPLIED after a CRLF round-trip),
  > 6-4b (one honest survivor), 6.5 (ten survivors + one NOT-APPLIED), 6.6 (5 survivors + one
  > NOT-APPLIED on the first run, and **two real vector holes**). See the standing rule that a green suite AFTER mutation is the only evidence a guard is real.
  - [x] **Run a CONTROL pass on unmutated source first and void the run unless it is green.** ⚠ 6.6's
        control pass came back RED for a lowercase-drive-letter `cwd` that made Vitest collect
        `lib/roulette/*.test.ts` as non-test modules — without it, "every TypeScript mutation killed"
        would have shipped. Read and write mutation files as **BYTES**. Run the **whole** vector-driven
        test set, never a `-run` filter. Report `NOT-APPLIED` as an outcome distinct from `killed`.
        Verify restoration by **SHA-256**.
  - [x] Mutate and record red/green in **both** languages: the byte-lex sort removed (P4) · the sort
        moved to AFTER the shuffle · the shuffle loop direction reversed (P3) · the loop bound
        off-by-one at each end · `uniform_int`'s `n` off by one per step · the self-swap included /
        excluded · the DQ filter inverted (AC1) · the DQ filter removed · the shelf test changed from
        `== 0` to `<= 0` and to `< 1` on a negative count (P6) · an absent shelf key treated as a
        refusal instead of 0 · the FR-21 floors applied inside pity (P7) · `n = 0` refusing instead of
        resolving (AC3) · `n = 1` refusing · `RevealOrder` returned as `Winless` (the invariant made
        vacuous) · `Winless` returned as `RevealOrder` · a winner dropped from the outcome · a winner
        duplicated · the stream label changed from `PityLabel` to a Stage-1 label (AC4) · the stream
        re-created mid-draw (counter reset) · the per-draw accounting under-reported by one.
  - [x] ⭐ Every mutation must redden the **vector-driven** test, not only a hand-written local
        assertion. **A mutation that only reddens a local test means the vector does not cover it —
        fix the vector, not the test.**
  - [x] ⭐⭐ **Publish the PER-MUTATION table** — mutation, language, site, outcome. 6.6 was pulled up
        at review for an aggregate-only record, and its `39` had to be reconciled against Task 8's list
        of 18 after the fact. Reconcile yours **in the same edit**, and name any mutation kind with **no
        expressible site** as design-correctness rather than a gap.

- [x] **Task 8 — Gates (AC: 6)**
  - [x] **Measure the baseline first** — `npm test` and `go test ./...` before any change. 6.1 quoted
        stale numbers; do not. (Expected at `ba894d1`: lint 0 · Vitest **1318 / 42** · build 0 · Go
        `awards` **607** · `gofmt` empty · `--check` OK ×6 · pgTAP **1223 / 26**. ⚠ These are the
        post-review, post-rebuild numbers from `sprint-status.yaml`; 6.6's own gate table records the
        pre-patch **1302 / 42**, **602**, **1218 / 26**. **Re-measure; do not quote either.**)
  - [x] `npm run lint` → 0 · `npm test` → report the delta and what each new test is · `npm run build`
        → 0, every viewer route still `ƒ` dynamic and **no `roulette` route** · `cd worker;
        go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` →
        **empty**.
  - [x] `python roulette/vectors/generate_vectors.py --check` → **OK ×7**, with all six pre-existing
        files **byte-identical** (prove it with `git status`, not by assertion).
  - [x] pgTAP: the previous baseline, unchanged, unless Question 1's answer forces a `0026`.
        **`supabase db reset` first** — the Task 6 rebuild leaves the QA corpus behind.
  - [x] `git status` + `git diff --stat` proof that `app/**`, `lib/awards|ceremony|i18n|bracket|steam/**`
        and `worker/ingest|store|db|config/**` are **byte-untouched**, and that `supabase/**` is
        untouched unless Question 1 says otherwise.
  - [x] CRLF check across every touched file — **0**. Two of 6.6's 18 files picked up CRLF from a
        PowerShell write and were normalised before commit; it is 6-4a's exact round-trip hazard.

### Review Findings

> bmad-code-review, 2026-08-07, three parallel layers (Blind Hunter · Edge Case Hunter · Acceptance
> Auditor) against baseline `ba894d1`. 28 raw findings → 6 dismissed on verification, 22 kept.
> ⭐ **The gates hold.** lint 0 · Vitest 1365/43 · build 0 · Go `awards` 641 · `gofmt` empty ·
> `--check` OK ×7 with the six pre-existing files byte-identical · every excluded path
> byte-untouched — all independently re-measured by the auditor. AC1–AC5 and AC7 are **MET**; AC6 is
> **PARTIAL** (see D2). Nothing below is a wrong-ceremony defect on the shipped corpus; the two
> decisions and the three HIGH patches are about **guards that cannot fail** and **cross-runtime
> surfaces that are not the same shape**.

**Decisions — RESOLVED 2026-08-07 (Cuatro delegated both to the reviewer)**

Both resolved to **defer**, and the reasoning is the same in each case: the fix belongs to a story that
owns the whole surface, and taking it here would either split a pair of sibling modules or pin
behaviour a later story is likely to constrain.

- [x] [Review][Decision→Defer] **TypeScript's `.sort()` is UTF-16 code-unit order, not byte-lex — and the comment claims it is "by definition"** — [pity.ts:241-246](lib/roulette/pity.ts#L241). ⚠ **SECOND OCCURRENCE:** 6.6's review found the identical defect in `sweep.ts` and deferred it to **6.9** ("when `lib/roulette` ships to the browser and the byte-lex claim becomes load-bearing for the verifier"). **Resolution: option (a) — correct the comment now, defer the guard to 6.9 with `sweep.ts`, and strengthen that deferral to name both modules and the concrete fix.** Option (b) — adding `stage2.ts`'s `STEAMID64_RE` here — was rejected because this story is forbidden from touching `sweep.ts` (Scope boundaries: *"Any change to … 6.6's anti-sweep pass, its result shape"*), so it would leave two sibling modules in one directory making **different** guarantees about the same field, which 6.9 would have to reconcile anyway. Option (c) was rejected because a non-ASCII vector row would enshrine as legal an input the DB forbids (`^[0-9]{17}$`). → the comment fix is now a patch item below.
- [x] [Review][Decision→Defer] **`is_pity = true` on a `kind='main'` spin is newly representable, and unconstrained** — [0026_pity_award_result.sql:80-92](supabase/migrations/0026_pity_award_result.sql#L80). **Resolution: option (b) — home the invariant to 6.8, recorded in `deferred-work.md` with the concrete mechanism.** An `0027` here is premature: `award_result` is **unwritable until 6.8** (0025's own table comment says nothing writes a row until then, and this story adds no writer), so there is no live exposure, and Cuatro authorised exactly one migration for this slice. 6.8 writes both `spin.kind = 'pity'` and `is_pity` and is the only story that can decide the pairing with the real write shape in front of it. ⛔ Option (c) was deliberately **rejected**: a pgTAP row blessing the state as legal would pin behaviour 6.8 is likely to constrain, and would then have to be deleted.

**Patches**

- [x] [Review][Patch] MEDIUM — the byte-lex claim is stated as a definition and is false for TypeScript; restate it honestly in all three runtimes, matching [stage2.ts:707-716](lib/roulette/stage2.ts#L707)'s hedged phrasing (*"identical to byte order **for ASCII digits**"*) and pointing at the 6.9 deferral [pity.ts:241](lib/roulette/pity.ts#L241), [pity.go:~300](worker/awards/pity.go), [generate_vectors.py:~7480](roulette/vectors/generate_vectors.py)

- [x] [Review][Patch] HIGH — `uniformInt`'s error is wrapped into a typed refusal in Go but escapes untyped in TypeScript and Python [pity.ts:286](lib/roulette/pity.ts#L286), [generate_vectors.py:7495](roulette/vectors/generate_vectors.py#L7495), cf. [pity.go:352-362](worker/awards/pity.go#L352)
- [x] [Review][Patch] HIGH — the "a refusal must not cost bytes" invariant is overstated: the Go `PityDetailStream` arm returns **after** the stream advanced, and both suites only iterate pre-draw vector refusals [pity.go:352-362](worker/awards/pity.go#L352), [pity_test.go](worker/awards/pity_test.go)
- [x] [Review][Patch] HIGH — the rejection row's `pins_inputs` is a constant expression that ignores both arguments and hard-codes `3`: `lambda e, c: 256 % 3 != 0` [generate_vectors.py:7677](roulette/vectors/generate_vectors.py#L7677)
- [x] [Review][Patch] HIGH — the `dq_excluded` coverage guard is satisfiable by a degenerate row: a DQ'd player who *also* holds a trophy satisfies it, so the DQ branch could be deleted and the guard stays green [generate_vectors.py:8057-8065](roulette/vectors/generate_vectors.py#L8057)
- [x] [Review][Patch] MEDIUM — the TS/Python stream guard is duck-typed and never checks `read`: a `{label, consumed}` literal **resolves silently** for ≤1 winless (reporting fabricated `bytesConsumed`) and throws a bare `TypeError` outside `PityError` for ≥2 [pity.ts:331-344](lib/roulette/pity.ts#L331)
- [x] [Review][Patch] MEDIUM — the Vitest baseline and delta in the gate table are wrong: claimed `1318 / 42` and `+47`, measured **`1322 / 42` and `+43`**; `pity.test.ts` is **42** tests, not 43 [6-7-pity-roulette.md:1299](_bmad-output/implementation-artifacts/6-7-pity-roulette.md#L1299)
- [x] [Review][Patch] MEDIUM — `TestResolvePityTakesNoAwardAndNoOutcome` is a vacuous assertion and its justifying comment is wrong Go semantics (a **keyed** composite literal does not break when a field is added) [pity_test.go:555-566](worker/awards/pity_test.go#L555)
- [x] [Review][Patch] MEDIUM — the Go suite carries **none** of the row-specific coverage guards the anchor and the TS suite carry; delete the out-of-order row and only the case-name list reddens [pity_test.go](worker/awards/pity_test.go)
- [x] [Review][Patch] MEDIUM — P7's `sub_floor` guard is a nameless `>= 2` lower bound where every sibling is an exact-count-plus-name pin, on the story's most dangerous semantic [generate_vectors.py:8077](roulette/vectors/generate_vectors.py#L8077)
- [x] [Review][Patch] MEDIUM — Section D's *"TWO pity results coexist in ONE spin"* inserts **one** row and silently depends on Section B's insert 60 lines earlier; nothing asserts `award_result_spin_award_key` still bites for a non-NULL `award_id` [0026_pity_award_result_test.sql:181-184](supabase/tests/0026_pity_award_result_test.sql#L181)
- [x] [Review][Patch] LOW — the IC909 test passes `null` in the message slot, contradicting the file's own header rule that every negative test asserts the constraint name [0026_pity_award_result_test.sql:201](supabase/tests/0026_pity_award_result_test.sql#L201)
- [x] [Review][Patch] LOW — five validation arms in TS/Python are exercised by nothing (non-array `players`, non-object roster element, non-boolean `idle_dq`, non-integer shelf count, empty-string shelf key) — the same "compartment rather than contract" standard the story uses to reject `internal` [pity.ts:384-470](lib/roulette/pity.ts#L384)
- [x] [Review][Patch] LOW — `pityRefuse`'s *"Every return in this file goes through it"* is false: the `UniformInt` arm builds `&PityInvalidError{...}` inline because `pityRefuse` has no `Cause` parameter [pity.go:135-139](worker/awards/pity.go#L135)
- [x] [Review][Patch] LOW — `PityError`'s `cause` constructor option is dead; no call site passes it (it mirrors the Go arm TypeScript does not implement) [pity.ts:~90](lib/roulette/pity.ts)
- [x] [Review][Patch] LOW — the generator comment calls the pity vector *"gate 4"*, a **third** reading of a number this same change deliberately declined to renumber (README says 4 = 6.9; SOLUTION-DESIGN says 4 = 6.11) [generate_vectors.py:7460](roulette/vectors/generate_vectors.py#L7460)
- [x] [Review][Patch] LOW — migration comment *"The constraint STRICTLY WIDENS what is legal"* is inverted (a CHECK only narrows; the `drop not null` widens), and the statement-ordering rationale is backwards [0026_pity_award_result.sql:69-74](supabase/migrations/0026_pity_award_result.sql#L69)
- [x] [Review][Patch] LOW — `PityResult.Draws` is documented as always non-nil but only `Winless` and `RevealOrder` are asserted; a refactor to `var draws []PityDraw` emits `null` into the bundle with the suite green [pity_test.go:564](worker/awards/pity_test.go#L564)
- [x] [Review][Patch] LOW — `strings.Join(x, ",")` slice comparisons are not injective (`["a,b"]` == `["a","b"]`); `slices.Equal` costs nothing [pity_test.go:522-527](worker/awards/pity_test.go#L522)
- [x] [Review][Patch] LOW — two pgTAP `pg_constraint` lookups are not scoped by `conrelid` where the third one three lines away is [0026_pity_award_result_test.sql:103](supabase/tests/0026_pity_award_result_test.sql#L103), `:163`

**Deferred**

- [x] [Review][Defer] AC6's 19-id set equality is printed at `live_count = 1` only, where AC6 asked for **all four widths** [6-7-pity-roulette.md:982-990](_bmad-output/implementation-artifacts/6-7-pity-roulette.md#L982) — deferred; the cardinality and shelf distributions ARE recorded at all four widths and are identical, and the qa67 harness is deleted, so re-printing costs a full corpus rebuild
- [x] [Review][Defer] `rejections` uses float division in TS (`consumed / k - 1`) and integer division in Go/Python, and **no vector row has `k != 1`** [pity.ts:292](lib/roulette/pity.ts#L292), [pity.go:371](worker/awards/pity.go#L371) — deferred; `consumed` is always an exact multiple of `k` by the primitive's contract so no divergence is reachable, and `k > 1` needs a 257-member winless set which a 28-player tournament cannot produce
- [x] [Review][Defer] `ROW_REPRESENTABLE_PITY_DETAILS = PITY_REFUSAL_DETAILS` is an alias, so the equality both suites "assert as data" cannot redden [generate_vectors.py:371](roulette/vectors/generate_vectors.py#L371) — deferred; the equality is the *intended* design (no `internal` label) and the assertion documents it, but it is unfalsifiable by construction
- [x] [Review][Defer] the doubly-malformed rows' **second** defect is re-derived only by the anchor; both runtime suites read `defects` as self-declared data [pity_test.go:689-707](worker/awards/pity_test.go#L689) — deferred; [generate_vectors.py:8103-8127](roulette/vectors/generate_vectors.py#L8103) does independently prove each second defect refuses under a different label, and nothing runs `--check` automatically ([deferred-work.md:299](_bmad-output/implementation-artifacts/deferred-work.md#L299), homed to 6.11)

**Dismissed on verification (6)** — recorded so they are not re-raised: the rejection row's name *"CHANGES the reveal order"* (the anchor's counterfactual guard at `generate_vectors.py:8036-8056` re-derives exactly that claim against a modulo-biased mutant) · `players: null` resolving in Go/Python but refusing in TS (P11 explicitly sanctions the split, and the comment's *"the other two runtimes"* is correct) · `minimalK(BigInt(n))` vs `uniformInt(stream, n)` (`npm run build` is 0, so there is no type error) · P9's four-value `internal` pattern (the deviation **is** argued and flagged at `:1080-1089`) · the rejection being forced by the seed rather than by set size (disclosed at `:1028-1030`; the path is genuinely exercised and byte-accounted) · the migration's *"unrepresentable"* thesis vs the one-directional pairing (the column comment and pgTAP B4 both state the design explicitly).

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A (carried, and now the norm) — this story writes NO database rows and, on the recommended answer to Question 1, ships NO migration.**
`0025` already admits pity in both places it needs to: `spin.kind` is `check (kind in ('main',
'pity'))` ([0025:119](supabase/migrations/0025_ceremony_results.sql#L119)) and `award_result.is_pity` is `boolean not null default false`
([0025:153](supabase/migrations/0025_ceremony_results.sql#L153)). `0025:81-82` homes the pity row's **content** to this story and its **writer** to
6.8. So the resolver ships here and the INSERT ships at 6.8. ⚠ **The one thing that could force a
`0026` is Question 1** — the consolation award's identity — because `award_result.award_id` is
`not null` with an FK to `award`. Do not pre-empt it.

**DECISION B — pity is a PURE PRODUCER-SIDE pass over injected inputs, exactly like every resolver before it.**
The verifier must reproduce it from the bundle alone ([SOLUTION-DESIGN:448-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L448) — *"The JS verifier
needs **nothing** outside the bundle; if it does, the bundle is incomplete (a spec bug)"*), which is
also why `pity` is a published bundle key ([§9.5:433](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L433)). No database read, no clock, no ambient
config.

**DECISION C (carried, and it has now held FIVE times) — the FR-21 floors and the `24`/`20` literals are UNTOUCHED.**
6-4a measured 0/28 eligible and changed nothing; 6-4b, 6.5 and 6.6 each measured it again.
[deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269) is the standing record and a floors decision is owed by
**someone**. ⚠ It is not owed by this story either — **but this is the first story where the
consequence is not merely "the mechanism is inert", it is "the ceremony hands out exactly 28
consolation prizes and nothing else".** That escalation is Question 3's whole content. **Measure it,
carry it, do not resolve it.**

**DECISION D — the shuffle is ONE named variant, pinned at three sites, and the choice is Question 2's to confirm.**
Neither [SPINE:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221) nor [§9.4:427-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427) says which shuffle, and *"seeded reveal order"* is
satisfied by any of them. **Recommended: Durstenfeld descending over the byte-lex-sorted set** —
`for i = len-1 down to 1: j = uniform_int(stream, i+1); swap(a[i], a[j])` — because it is the variant
whose per-step `n` is unambiguous (`i+1`, strictly decreasing), it terminates at `i = 1` so `n = 1` is
never drawn (making the byte accounting a clean function of the set size), and it is the form
`uniform_int(stream, n)`'s `[1, MaxN]` contract fits without a special case. **Whatever is chosen, the
alternative must be written down as rejected**, or the next implementer will read "Fisher–Yates" and
pick the other one.

**DECISION E' (carried from 6.6, inverted) — pity's stream membership is the load-bearing fact, where anti-sweep's was its absence.**
6.6's AC4 proved a property by the *absence* of a `Stream` parameter and the *absence* of a `./prng`
import. Yours proves the mirror: the parameter is present, the import is present, the TS entry point
is `async`, and the byte count is asserted. ⭐ **The two are the same discipline, and confusing them is
how a reviewer gets a vacuous assertion**: `Consumed()` around a function that cannot reach a stream
is vacuous (6-4b deleted exactly that assertion); `Consumed()` around **this** function is the gate.

**DECISION F' (carried from 6.6) — read `SweptOut`, do not re-derive exhaustion.**
6.6 carried the exhaustion-vs-nobody-qualified distinction on the assignment row *specifically for
you* ([sweep.go:140-147](worker/awards/sweep.go#L140)). ⚠ **But it does not change who is winless** — both facts leave the
player with shelf 0 and both put them in pity. It matters for 6.8's reveal copy, not for pity's input.
**Do not branch on it. Say at the site that you deliberately do not.**

**DECISION G (carried from 6.6, and it is what makes your input exist) — advancing the shelf across spins is the CALLER's job.**
`ResolveSpin` deliberately never touches the shelf (A10, [sweep.go:198-209](worker/awards/sweep.go#L198)). Pity **reads the
result**. So the harness — and, at 6.8, the real caller — accumulates `SpinResult.Assigned` across the
twelve spins into the shelf map, and pity consumes it. ⛔ **Pity does not run the spins and must not
be given a `Stage1Result`.** Its input is the shelf, the snapshot and its own stream, and nothing else.

**DECISION K' (carried from 6.5/6.6, and now RESOLVED for pity) — pity does NOT read DECISION E's suppressed `Tied` set.**
[SPINE:148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148) says the `no_awardable_value` outcome carries `Tied` *"so the width of the tie that
did not form stays readable to the ladder (6.5), anti-sweep (6.6) and **pity (6.7)**"*. **Decided here:
readable is not the same as read.** A suppressed player did **not** win, so their shelf is unchanged,
so the shelf **already** places them in the winless set — reading `Tied` would be redundant at best and
double-counting at worst, and it would couple pity to a Stage-2 arm it has no other reason to know
about. The width remains available to 6.8's reveal copy and 6.9's bundle, which is where it earns its
keep. ⭐ **State this at the site in both languages**, because the spine names pity as a reader and a
future maintainer will otherwise "restore" a dependency that was deliberately not built.

### The seam you are extending — and the rule that governs it

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

[ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) is unchanged and still binding: *"there is **no dependency edge**
between `worker/*` and `app/`+`lib/`… The roulette **producer** (`worker/awards`) and **verifier**
(`lib/roulette`) each conform to `roulette/vectors` independently — **never to each other**."* Neither
is the reference implementation; when they disagree the vector decides; when the vector is silent, add
a vector. This is why Task 2 precedes Task 4.

### The algorithm, transcribed (do not re-derive it from prose)

The entire normative spec is **two sentences** ([SPINE:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221) + [§9.4:427-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427)).
Everything below that is not in those two sentences is a DECISION taken above or a Question below.

```
resolve_pity(players, shelf, stream):
    validate(players, shelf)               # dup steamid64, negative count, unknown key   (P6, P9, P10)

    # ── the WINLESS SET. shelf == 0 AND not fully DQ'd. Absent key == 0.        (AC1, P6)
    #    ⛔ NO FR-21 floors here — never                                          (P7)
    #    ⛔ NO read of Outcome.Tied                                    (DECISION K')
    winless = sorted([ p.steamid64 for p in players
                       if shelf.get(p.steamid64, 0) == 0 and not p.idle_dq ])   # byte-lex  (P4)

    # ── the SEEDED REVEAL ORDER. The OUTCOME is invariant; only this is drawn.  (AC2, P2)
    order = copy(winless)
    for i = len(order) - 1 down to 1:                    # DECISION D — Durstenfeld, descending
        j = uniform_int(stream, i + 1)                   #   n = i+1, strictly decreasing; n never 1
        swap(order[i], order[j])                         #   i == j is a legal self-swap

    return { winners: winless, reveal_order: order, draws: …, bytes: stream.Consumed() }
```

⛔ **No floors, no weighting, no elimination, no ladder, no shelf write, no clock, no I/O.**
⛔ **`len(winless) <= 1` ⇒ the loop body never runs ⇒ ZERO draws and ZERO bytes** (AC3) — and it is a
normal return, never a refusal.
⭐ **The byte cost is a pure function of `len(winless)` plus rejections**: each step draws `k = 1` for
`n <= 256`, so a 19-member set costs **18 bytes plus one byte per rejection**, and a rejection occurs
when the drawn byte is `>= 256 - (256 mod n)`. **Print the measured total; do not compute it here.**

### The APIs you consume — the anti-reinvention map

| You need | Go | TypeScript | Trap |
|---|---|---|---|
| the pity stream label | `PityLabel` | `PITY_LABEL` | ⛔ **6.3's, and its VALUE is frozen.** Only the comment's FR trace changes (AC7) |
| the stream | `NewStream(seed, PityLabel)` | `await createStream(seed, PITY_LABEL)` | Starts at counter 0; **construct it in the CALLER**, pass it in |
| the draw | `UniformInt(s, n)` | `await uniformInt(stream, n)` | ⚠ **TS is `async` — your entry point must be too.** `n` is bounded `[1, MaxN]` (E2); `n = 1` reads **zero** bytes |
| the byte assertion | `s.Consumed()` | `stream.consumed` | ⭐ **NOT vacuous here** — this is the gate, unlike 6.6's |
| the snapshot row | `SnapshotPlayer` | the TS mirror | ⭐ **Reuse it.** ⚠ `IdleDQ` is the SNAPSHOT (fully-DQ'd) sense — [stage2.go:153](worker/awards/stage2.go#L153), [stage2.ts:141](lib/roulette/stage2.ts#L141) |
| the shelf | `map[string]int` (`Stage1Input.Shelf`) | the same shape | ⭐ **Reuse the shape.** Absent key == 0 (W8). Refuse a negative |
| what the spins left | `SpinResult.Assigned` (byte-lex) | `SpinResult.assigned` | ⛔ **You consume the SHELF the caller built from these, not these** (DECISION G) |
| a refusal | `SweepInvalidError{Detail, Reason, Cause}` + `Unwrap() []error` | `SweepError` + `SWEEP_REFUSAL_DETAILS` | ⭐ The precedent to COPY ([sweep.go:50-117](worker/awards/sweep.go#L50), [sweep.ts:56-101](lib/roulette/sweep.ts#L56)). Do not invent a third design |
| the detail-split test machinery | `sweep_test.go` / [stage1_test.go:505-530](worker/awards/stage1_test.go#L505) | `sweep.test.ts` / [stage1.test.ts:533-553](lib/roulette/stage1.test.ts#L533) | ⭐ Copy it. The ladder suites did not, and 6-5b's AC5 was the bill |

### Scope boundaries — hold these

**Build:** `worker/awards/pity.go` + `pity_test.go` · `lib/roulette/pity.ts` + `pity.test.ts` ·
`roulette/vectors/pity-draw.json` + the `generate_vectors.py` extension + the README ownership row and
its `:64-67` correction · the **two pinning-suite updates** (`prng_test.go`'s file set, `prng.test.ts`'s
module list + import graph + non-vacuity pin) · the `labels.go` / `labels.ts` FR-28 trace.

**Do NOT build** (each with its owner):
- **Every WRITE**: the pity `spin` row(s), `spin.kind = 'pity'`, `spin_index`, `award_result` with
  `is_pity = true`, `award_result_winner`, the `steamid64 → roster_entry.id` mapping, the
  `tie_ladder_exit_step` `0 → NULL` mapping, the reveal-gated RLS axis, `revealed_at`,
  `ceremony.state` transitions, any admin route, any audit row → **6.8**. ⚠ **You DECIDE and RECORD
  the target write shape (Question 2) because it constrains your output type; you do not implement it.**
- **RFC-8785 canonicalization, `bundle_sha256`, the `pity` bundle key's SHAPE, `algo_version`** →
  **6.9**. ⚠ Note the collision and leave it: `pity` is a published bundle key
  ([§9.5:433](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L433)) and is **outcome-affecting for `bundle_sha256`** — **record your result shape
  for 6.9; do not canonicalize it.**
- **Any UI, any wheel, the trophy shelf, `ronda de consolación`, `Nadie se va con las manos vacías`,
  `Premio de consolación para los que no ganaron`, any i18n string, any route** → **6.10**.
  `/ceremonia` stays 5.7's `<Placeholder>`; there is **no ceremony i18n namespace yet** and creating
  one is 6.10's.
- **The end-to-end ceremony vector with a pity draw** → **6.11** ([§9.6:443-444](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L443) says so by name).
  Yours is the **unit** vector for the pass.
- **Any change to** 6-4a's Stage-2 semantics · 6-4b's Stage-1 draw arithmetic or byte accounting ·
  6.5's ladder rungs or exit steps · **6.6's anti-sweep pass, its result shape, `0025` or the luck
  weight table's values**. Widening a type is not changing a semantic — if pity needs one of them to
  *decide* differently, **stop and say so in Completion Notes.**
- **The FR-21 floors, the `24`/`20` literals, `public.leaderboard`** (DECISION C) · **`lib/awards/**`**
  (⚠ including `catalog.ts` — which is exactly why Question 1 cannot be answered inside this story) ·
  **anything in `worker/ingest|store|db|config`** or `lib/bracket|ceremony|steam|i18n` · **`app/**`**.
- **The ten items deferred from 6.6's review** ([deferred-work.md:333-342](_bmad-output/implementation-artifacts/deferred-work.md#L333)). None is
  homed here; note what you build on, fix none of it.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)); a test outside `lib/`
  **silently does not run**. Environment `node`. **Measure the baseline before claiming a delta.**
  ⚠ [deferred-work.md:336](_bmad-output/implementation-artifacts/deferred-work.md#L336) records a **pre-existing** flaky 5 s timeout on
  `prng.test.ts > real-seed/spin1/i255` under full-suite load — if you hit it, it is not yours; report
  it, do not chase it.
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./... -count=1`, then
  **`gofmt -l ./worker` must be empty**. Table-driven; `t.Errorf` over `t.Fatalf` in shared helpers.
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe a vector
  value into source.** Guard the loader against malformed rows; give every conformance switch a
  **final arm**; assert refusals are the **typed** error **and** the declared `detail`.
- **Pinning tests** — three exact-equality assertions redden when you add a module and that is their
  purpose: `prng_test.go:834` (Go file set, six → seven), `prng.test.ts:662-676` (module list),
  `prng.test.ts:788-804` (per-module import graph) plus `:810-813` (non-vacuity). Bans that must hold
  in the new modules: `server-only`, `node:`, `math/rand`, `Math.random`, `Date`, `toLocaleString`,
  `localeCompare`, `parseInt`, `**`, `fmt.Sprintf`, `float64`, and the 32-bit shift operators.
  ⛔ **`math/big` stays banned in `pity.*`** — it does no magnitude arithmetic.
- **No vacuous assertions.** 6-4b **deleted** two rather than repairing them. If an assertion cannot
  fail for any implementation, delete it and let the signature carry the property.
- **`npm test` does not typecheck** — 6.3's build caught a type error 704 green tests could not. Run
  `npm run build` before you believe the suite.
- **Mutation pass before review** — Task 7, non-optional, control-pass-first, byte-level file IO,
  whole-suite runners, restoration verified by **SHA-256**, and a **per-mutation table**.
- **pgTAP** — unchanged unless Question 1 forces a `0026`. **`supabase db reset` before running it**,
  because Task 6 leaves the QA corpus in the local DB.

### Stack

Pinned and current; **nothing new is introduced or permitted**. Go `1.26.4` (`worker/go.mod`) —
stdlib only. Node ≥ 20.9 · TypeScript `^5.9` (`verbatimModuleSyntax: true`, so every type-only import
is `import type`) · Vitest `4.1.9` · Next.js `16.2.10` · `tsconfig` target `ES2022` with `esnext` lib.
Postgres via Supabase local; pgTAP for DB tests. Python 3 **stdlib only** for the generator.
**No new npm package and no new Go module.**

### The measurements this story must be designed against

| Measured on the real corpus | Value | What it means here |
|---|---|---|
| ⭐⭐ Winless set at the **SHIPPED** 24/20 floors | **28 / 28** — the whole roster, at every width | pity's production input is **everyone**, and a consolation award is the **only** award anybody holds. Question 3 |
| ⭐ Winless set at floors-0 (the counterfactual) | **19 / 28**, **identical at widths 1, 2, 3, 4** | the 19 ids are at [6-6:663-667](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L663). Anti-sweep changes *which* award a player wins, never *whether* |
| The reconciliation | **9 holders · 12 trophies · 19 winless = 28** ✅ | reproduce it, printed |
| Players clearing the 24/20 floors | **0 / 28** (fourth story in a row) | every award is `no_eligible_players`; DECISION C: change nothing |
| Fully-DQ'd players in the corpus | **0** | AC1's DQ filter is **measured-inert**. Print the zero; keep the filter |
| Shelf distribution, floors-0 | `shelf0:19 shelf1:6 shelf2:3` (widths 1–2) · `shelf0:19 shelf1:7 shelf2:1 shelf3:1` (widths 3–4) | shelf0's cardinality **is** the winless count — the cross-check |
| Shelf distribution, real floors | `shelf0:28`, max shelf **0** | the degenerate case, all four widths |
| ⭐ Anti-sweep is **per-spin only** | at width 4 one player still ends with **3** trophies (three different spins) | *"Anti-sweep bounds concentration within a spin and does nothing across spins — that is pity's job, by design"* ([6-6:745-748](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L745)) |
| Real-floors 12-spin Stage-1 ceremony | **22 bytes**, order `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` | must be **unchanged** — pity's stream is independent. A change is a **defect** |
| ⚠ The 21-vs-22 floors-0 discrepancy | an **undeclared harness difference** (shelf advancing 21 / frozen 22), not a defect | **declare which arm your harness runs** ([6-6:675-693](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L675)) |
| `fair_seed` | `1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c` | already anchored in every vector file |
| Corpus anchors | **204 rounds · 28 roster · 28 distinct players · row_count 28 · eligible_count 0 · 12 awards** | prove you rebuilt the same corpus |
| `uniform_int` cost at `n <= 256` | `k = 1` per draw; `n = 1` costs **0** | an 19-member shuffle is **18 bytes + rejections**. **Measure, do not assume** |

### Inherited items this story is named in

| Item | Source | What 6.7 owes it |
|---|---|---|
| ⭐ **`idle_dq` at snapshot layer means FULLY DQ'd; zero approved rows is winless, not DQ'd, "and 6.7's pity draw must still be able to reach them"** | [0024:584-589](supabase/migrations/0024_ceremony_lock_snapshot.sql#L584), restated at [stage2.ts:141](lib/roulette/stage2.ts#L141) | AC1 — pin both facts in code, with a vector row that inverts cleanly |
| ⭐ **`spin.kind` admits `'pity'` and `award_result.is_pity` exists; "nothing writes one here" → 6.7** | [0025:81-82](supabase/migrations/0025_ceremony_results.sql#L81), `:119`, `:153` | DECISION A + Question 2 — decide the write shape, implement none of it |
| ⭐ **The winless set and the 19 ids by name** | [6-6:606-610](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L606), `:657-673` | AC6 — reproduce by **set equality**, printed |
| **Advancing the shelf across spins is the caller's job; "6.7's pity reads the result"** | [sweep.go:198-209](worker/awards/sweep.go#L198) | DECISION G — consume the shelf, never the spins |
| **The exhaustion / nobody-qualified distinction "differ[s] for Story 6.7's pity draw"** | [sweep.go:140-147](worker/awards/sweep.go#L140) | DECISION F' — read it, deliberately do not branch on it, say so |
| **`no_awardable_value` carries the suppressed set so pity can read the tie width** | AD-14 ([SPINE:148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L148)) | DECISION K' — **resolved: do not read it**, and say why at the site |
| ⛔ **The floors exclude the entire measured roster (0/28)** | [deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269) | DECISION C + **Question 3** — the escalation, not the fix |
| **`pity` is a published bundle key, outcome-affecting for `bundle_sha256`** | [§9.5:433](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L433), [SPINE:222](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L222) | Record the result shape for 6.9; canonicalize nothing |
| **§9.6 gate 4 must exercise "a pity draw"** | [SOLUTION-DESIGN:443-444](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L443) | 6.11's — yours is the **unit** vector |
| **Nothing automatically runs `--check`** | [deferred-work.md:299](_bmad-output/implementation-artifacts/deferred-work.md#L299) | Deferred to 6.11; run it by hand at Task 8 and say so |
| **The anchor's independence is weaker than claimed** | [deferred-work.md:300](_bmad-output/implementation-artifacts/deferred-work.md#L300), `:318` | Applies to your new file too — write the generator from the **spec text and the transcribed algorithm above**, and **say which you did** |
| **The coverage-guard defect, now at its fifth occurrence** | 6-4a, 6-4b, [6.5](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L763), 6-5b's AC5, [6.6's Task 2](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L122) | Task 2 — write the guard in the **same edit** as the row |
| **Epic-5 retro #3 / #5** | [epic-5-retro-2026-07-28.md:95,97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95) | Task 7 and "every claim backed by printed output" |

### Previous story intelligence — 6.6 (`ba894d1`), 6.5 (`4c9cf36`), 6-4b, 6-4a, 6.3, 6.2, 6.1

- ⭐⭐ **6.6's headline is your premise:** the anti-sweep cap fires **0** times at the shipped
  `live_count = 1`, and *"pity is the only live mitigation for concentration"* — measured, printed,
  and carried into a vector row rather than argued.
- ⭐ **A "by construction" claim survives only as far as the ports it does not own.** 6.6's AC1 claimed
  a shared outcome could never contain an already-assigned player *by construction*; true of every
  outcome the pass **built**, false across the injected `Ladder` port, and the review caught it. **Pity
  has no injected port** — but it does take an injected `Stream`, and *"the stream is fresh and keyed
  by `PityLabel`"* is a claim about a caller, not a construction. **Check it; do not assert it.**
- ⭐ **An equivalent-mutant declaration is evidence-by-argument, and the argument must be reviewed like
  a test.** 6.6's survived review only after its premise was found false and replaced by a different
  step that happens to hold ([6-6:834-853](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L834)). If you declare a
  mutant equivalent, write the argument out and attack it yourself first.
- ⭐ **The mutation pass found two real VECTOR holes, and the vector was fixed — not the tests.** Both
  were "every fixture happened to be in the convenient shape": every roster pre-sorted (killing the
  sort mutation's visibility) and every player above the floors (killing the re-filter mutation's).
  ⚠ **Both twins exist in your story** — P4's sort and P7's floors. Write those two rows first.
- ⭐ **A CHECK whose expression is NULL is SATISFIED.** 0025's first `luck_weight_table_valid` accepted
  an empty table because `array_ndims` returns NULL for `array[]::int[]`. If Question 1 forces a
  `0026`, write guards as a **total `case`** with an `is true` wrapper.
- **The coverage-guard defect and the not-really-closed `detail` set** are both at their fifth
  occurrence across this epic. 6.6 is the first story that closed them properly — **copy 6.6's
  machinery verbatim**.
- **An ABSENT container is the EMPTY case** (Cuatro, 6-4b review): Go `nil` / TS `undefined` / Python
  `None` normalise inside the module; `null` and wrong types stay refused.
- **`Object.freeze` is shallow** (6.1 shipped a "frozen" catalog of mutable entries).
- **The author's own mutation table is not proof** — every story in this epic proved that again.
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body,
  no trailers.**
- **Gates at 6.6 sign-off:** lint 0 · Vitest **1318 / 42** · build 0 · `gofmt` empty · Go `awards`
  **607** · `--check` OK ×6 · pgTAP **1223 / 26**.

### Git intelligence — recent commits

`ba894d1` (6.6, anti-sweep + luck-meter + `0025`) · `26dc674` / `a1728a9` / `d551f34` (6.5 / 6-5b docs
+ ladder debt) · `4c9cf36` (6.5, the FR-29 ladder) · `ad8b649` (6-4b, Stage 1 + gate 3) · `9ccb832`
(6-4a, Stage 2) · `3f7c98e` (6.3, PRNG + vectors) · `eed5318` (6.2) · `01e3f5b` (6.1). ⚠ **Baseline
correction:** the contexting brief describes the baseline as *"18 uncommitted files — 6.6 is not
committed yet"*. **6.6 IS committed, at `ba894d1`, and the working tree is clean.** Build on
`ba894d1`. The arc through Epic 6 is one story per layer, vectors as the shared contract, a BAR over
the real seam, a mutation pass before review; `0025` was the first migration since `0024` and this
story adds none unless Question 1 says otherwise.

## Project Structure Notes

```
worker/awards/pity.go                     NEW      the winless set + the seeded shuffle; ErrPity; TAKES a stream
worker/awards/pity_test.go                NEW      vector-driven + table-driven; case-name set pinned
worker/awards/labels.go                   UPDATE   :41 FR-26 -> FR-28 (comment only; the VALUE is frozen)
worker/awards/prng_test.go                UPDATE   shipped file set -> 7. ⛔ math/big exceptIn NOT widened
lib/roulette/pity.ts                      NEW      the mirror; ⚠ ASYNC; not server-only; ✅ DOES import ./prng
lib/roulette/pity.test.ts                 NEW      vector-driven; per-row `detail` assertions from the start
lib/roulette/labels.ts                    UPDATE   :22 gains the FR-28 trace it never had
lib/roulette/prng.test.ts                 UPDATE   module list -> 7; import graph gains pity.ts WITH ./prng; non-vacuity pin
roulette/vectors/pity-draw.json           NEW      empty / one / two / reorder / rejection / out-of-order / DQ-inversion / all-winless / absent-shelf-key / refusals
roulette/vectors/generate_vectors.py      UPDATE   build_pity_file + one line in main()'s outputs dict
roulette/vectors/README.md                UPDATE   ownership row + format section + cases table + the :64-67 correction + the recorded gate-number discrepancy
_bmad-output/implementation-artifacts/sprint-status.yaml   UPDATE
```

⛔ All six existing `roulette/vectors/*.json` files must come out **byte-identical** — prove it with
`git status`. Naming follows the established `lib/<domain>/<file>.ts` + `worker/<pkg>/<file>.go`
layout. `lib/roulette/**` must stay out of `app/`, must not acquire `server-only`, and must not import
`lib/awards/**` — it ships to the browser at 6.9. **No `supabase/**` change unless Question 1 forces
`0026`.**

## References

- Story ACs — [epics.md:1114-1130](_bmad-output/planning-artifacts/epics.md#L1114) · the anti-sweep 6.6 shipped `:1092-1112` · reveal-gating `:1132-1147` (6.8) · the bundle `:1154+` (6.9) · the end-to-end vector `:1196+` (6.11)
- **FR-28** (verbatim, both testable consequences) — [prd.md:380-386](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L380) · **SM-2** `:483` · **SM-C1** `:493` (the counter-metric: *"spreading the fun must not reward gaming"*) · the non-goal `:451` · the glossary `:115` · FR-26 `:363-369` · FR-21 `:314-321`
- **AD-14** — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) · the Provably-Fair contract surface **`:221` (pity, the whole rule)**, `:216` (stream independence), `:218`, `:220`, `:222` (the bundle keys) · the DB line `:234` · **AD-22** `:185-188` · **AD-19** `:170-173` · **AD-15** `:150-153`
- **The mechanism spec** — [SOLUTION-DESIGN §9.1](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L400) (labels + `uniform_int`) · **[§9.4:427-429](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L427) (the whole pity spec — two sentences)** · **[§9.5:431-438](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) (`pity` is a published bundle key)** · [§9.6:440-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L440) (gate 4 exercises a pity draw; the build order ends *"→ pity"*) · the DDL `:205-233`
- **The schema that already admits you** — [0025_ceremony_results.sql](supabase/migrations/0025_ceremony_results.sql) (`:119` `spin.kind`, `:153` `is_pity`, `:178` and `:247` the two UNIQUEs, `:146-147` the `award_id` FK, `:81-82` the pity out-of-scope note) · [0024:584-589](supabase/migrations/0024_ceremony_lock_snapshot.sql#L584) (the `idle_dq` sense) · [0023_award_catalog.sql](supabase/migrations/0023_award_catalog.sql) (`:63-152` the `award` table, `:150` the priority UNIQUE, `:448-453` DELETE-MISSING) · [0021:56](supabase/migrations/0021_leaderboard.sql#L56) (the untouched `24`/`20`)
- **The shipped seam** — [worker/awards/pity's neighbours](worker/awards/) : [labels.go](worker/awards/labels.go) · [prng.go](worker/awards/prng.go) · [stage2.go](worker/awards/stage2.go) · [stage1.go](worker/awards/stage1.go) · [sweep.go](worker/awards/sweep.go) — and their [lib/roulette](lib/roulette/) mirrors
- **The vector seam and its rules** — [roulette/vectors/README.md](roulette/vectors/README.md) (`:13-24` the three rules, `:26-40` ownership, `:64-67` the line you correct, `:601-703` `antisweep-resolve.json` as your model, `:807-812` the loaders) · [generate_vectors.py:7301-7333](roulette/vectors/generate_vectors.py#L7301)
- **UX** — [EXPERIENCE.md:171](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L171) (the pity round in the spine's own words) · `:70` (the two exact Spanish strings) · `:119`, `:164`, `:180` (⭐ *"a promise of spotlight, not a pity-pat"*), `:230-231`, `:42`, `:47` · `mockups/mock-ceremony.html` (the pity teaser — **6.10's**). ⚠ The mock HTML diverges from the spine (wrong nav labels, inline admin controls): trust EXPERIENCE.md and the spine over the mock
- **Prior stories (read their Completion Notes in full)** — **[6.6](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md)** · [6.5](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md) · [6-5b](_bmad-output/implementation-artifacts/6-5b-fr-29-ladder-vector-and-suite-debt.md) · [6-4b](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md) · [6-4a](_bmad-output/implementation-artifacts/6-4a-stage-2-deterministic-winner-and-tie-detection.md) · [6.3](_bmad-output/implementation-artifacts/6-3-prng-core-hmac-sha256-counter-mode.md)
- **Inherited deferrals** — [deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269), `:299`, `:300`, `:318`, `:333-342`
- **Epic-5 retro Action Items #3, #5** — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95)

## Questions for Cuatro

Three. None blocks Task 0 or Task 1; **all three must be answered before Task 2 fixes the vector in
place**, and Question 1 additionally gates whether this story ships a migration at all.

1. ⭐⭐ **Where does the consolation award come from?** `award_result.award_id` is `not null` with an FK
   to `award` `on delete restrict` ([0025:146-147](supabase/migrations/0025_ceremony_results.sql#L146)), so a pity result must point at a **real
   catalog row** — but the shipped catalog is **exactly 12**, `curate_award_catalog` **deletes any
   award the payload omits** ([0023:448-453](supabase/migrations/0023_award_catalog.sql#L448)), `award.priority` is UNIQUE, and
   [catalog.test.ts:33-34](lib/awards/catalog.test.ts#L33) / `:56-58` pin twelve distinct names at priorities exactly 1..12.
   The three candidate shapes and their real costs:
   **(a) a 13th catalog award.** Requires editing `lib/awards/catalog.ts` — an **excluded path** for
   this story — and it must satisfy `award_bucket_valid`, `award_class_valid` and
   `award_deciding_stat_valid` ([0023:79-89](supabase/migrations/0023_award_catalog.sql#L79)), which a consolation prize has no honest values for:
   it has no deciding stat and belongs to no bucket. It would also be spun by Stage 1 unless the spin
   plan excludes it.
   **(b) `award_id` becomes nullable, guarded by `check (is_pity or award_id is not null)`.** A
   `0026` amending a migration that shipped four days ago; honest about the shape (a pity result has
   no category), and it makes the "which award?" question unrepresentable rather than answered wrong.
   **(c) a catalog-independent row** — a separate `pity_award` table or a reserved sentinel row that
   `curate_award_catalog` is taught to leave alone.
   ⚠ **There is a second-order trap in all three:** once a pity `award_result` exists, `on delete
   restrict` means a later re-curate that drops that award **hard-fails**. **Recommended: (b)**, as
   the smallest change that keeps the catalog exactly 12 and the excluded path untouched — but this is
   a schema-and-product decision, not a resolver detail, and I have deliberately not taken it.

2. ⭐ **One pity `spin` row per winner, or ONE pity spin holding all of them?** ⚠ `0025`'s constraint
   set materially bounds this and the two shapes are not equivalent:
   **One spin, N winners** — `award_result_spin_award_key unique (spin_id, award_id)`
   ([0025:178](supabase/migrations/0025_ceremony_results.sql#L178)) means one award appears **once** per spin, so N pity winners on one consolation
   award in one spin must be a **single `award_result` with N `award_result_winner` rows** — which the
   IC909 trigger then forces to `is_shared = true`. On today's data that is a **19-way (or 28-way)
   "shared" consolation**, which is representable but is almost certainly not what the UX means by a
   trophy.
   **N spins, one winner each** — distinct `spin_index`, each with its own `award_result`,
   `is_shared = false`, and `award_result_winner_spin_key unique (spin_id, winner_entry_id)`
   ([0025:247](supabase/migrations/0025_ceremony_results.sql#L247)) satisfied trivially. It also matches *"seeded **reveal ORDER**"*
   ([SPINE:221](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L221)) **literally** — an order only means anything if the reveals are sequential —
   while still reading to the audience as the one *"ronda de consolación"* the UX describes
   ([EXPERIENCE.md:171](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L171)).
   **Recommended: N spins, one winner each.** ⛔ **6.8 writes them either way** — but the answer
   decides whether this story's result type is *"a set plus an order"* or *"a set plus a shared
   flag"*, so it cannot be deferred past Task 2. **And whichever is chosen, record WHY.**
   ⚠ Bundled with it: **the shuffle variant** (DECISION D). The recommendation is Durstenfeld
   descending, `n = i+1`; confirm or replace it, because it is outcome-affecting for every future
   ceremony and for 6.9's `bundle_sha256`.

3. ⛔⛔ **At the shipped configuration, pity is not a safety net — it is the entire prize distribution.
   Is that an acceptable ship state, or have the FR-21 floors become a ceremony BLOCKER?**
   Measured, four stories running: **0 of 28 players clear `floor_rounds = 24` / `floor_kills = 20`**,
   so all twelve awards resolve `no_eligible_players`, no shelf leaves 0, and **all 28 players enter
   pity**. The ceremony then hands out 28 identical consolation prizes and zero category trophies. ⚠
   That satisfies **SM-2** ("zero Players finish with no shot at a prize") **literally while defeating
   it in spirit**, and it directly contradicts the UX's own framing of the pity round as *"a promise of
   spotlight, not a pity-pat"* ([EXPERIENCE.md:180](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L180)) and the awards' thesis of *"strength in what
   others ignore"*. The standing record is [deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269), whose 6.1
   decision was *"bracket winners accumulate rounds across subsequent matches and are expected to clear
   the floors well before the ceremony"* — an assumption that has now been **measured false four times**
   on the only corpus that exists.
   ⚠ **Context that matters:** the first tournament is all 1v1 wingman
   (confirmed by Cuatro 2026-07-21; the same fact behind Story 5.2a, restated at
   [0024:599-601](supabase/migrations/0024_ceremony_lock_snapshot.sql#L599)), where `kills ≈ ½ rounds_played`, so `floor_kills = 20` implies
   roughly **three matches** before a player qualifies for **any** rate award.
   **I am not recommending a value** — the lever is `0021:56` and `lib/awards/catalog.ts`, both
   excluded here by DECISION C, and a floors change alters every published byte of the ceremony.
   **What this story owes you is the number and the escalation; what it needs from you is a decision
   about whether 6.7 ships against the degenerate configuration, or whether the floors are re-opened as
   their own slice before Epic 6 closes.**

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5`), bmad-dev-story, 2026-08-07, baseline `ba894d1`.

### Debug Log References

- **Corpus rebuild + THE BAR:** throwaway `worker/cmd/qa67/main.go` (`build` / `bar`),
  `lib/roulette/bar-qa67.test.ts`, `lib/awards/qa67-payload.test.ts` and `_qa67/`
  (`curate-payload.json`, `bundle.json`, `go-transcript.txt`, `ts-transcript.txt`) — **all deleted
  before commit**, with the Go gates proven clean **while present** (`build` 0 · `vet` 0 ·
  `test ./...` ok · `awards` **641** · `gofmt -l ./worker` empty) **and again after removal**
  (identical: 0 · 0 · ok · **641** · empty). ⚠ `worker/cmd/qa54` was left untouched and no second
  orphan was added.
- **Four sequencing traps hit and recorded**, none of them in the tree because the harnesses always
  are not: (1) `demo.source` is a closed set of `('matchzy','manual_upload')` — `'cli'` is refused;
  (2) the teardown cannot be a hand-ordered DELETE chain, because `tournament.final_match_id →
  match`, `match.demo_id → demo` and `demo.match_id → match` form a cycle and `score_source_guard`
  refuses the intermediate rows a nulling-out pass creates — `truncate … restart identity cascade`
  is the tool; (3) `public.leaderboard` has no `rounds_played` column to probe the floors with, so
  the FR-21 measurement is taken over `stat_snapshot_row`, which is the frozen surface the ceremony
  actually resolves from; (4) `stat_snapshot_row.stats_int` carries JSON **numbers**, not the
  decimal strings the vector files use, so both harness halves decode number-or-string identically.
- **Mutation harness:** two scratchpad Python runners (control-pass-first, byte-level file IO,
  whole-suite runners, restoration verified by SHA-256) — the main pass and a **survivor
  adjudication** pass. Not committed; they are process artifacts and the tables below are their
  output.
- ⭐ **The control pass earned its keep on the first run.** It came back **RED** because
  `--reporter=basic` does not exist in Vitest 4 — every TypeScript mutation would have "passed"
  against a runner that never started. That is the second story running in which the control pass
  caught a broken runner rather than a broken guard (6.6's was a lowercase-drive-letter `cwd`).

### Completion Notes List

**CUATRO ANSWERED ALL FOUR QUESTIONS BEFORE TASK 2 FIXED THE VECTOR**, each with the recommendation:
migration `0026` makes `award_result.award_id` nullable under `check ((is_pity or award_id is not
null) is true)`; pity persists as **N spins, one winner each**, so this story's result type is *a set
plus an order*; the shuffle is **Durstenfeld descending** with the ascending sweep recorded as
rejected; and 6.7 **ships against the degenerate floors configuration and escalates rather than
fixes it** (DECISION C holds — the `24`/`20` literals are byte-untouched).

---

#### ⛔⛔ THE HEADLINE — AT THE SHIPPED CONFIGURATION PITY IS NOT A SAFETY NET, IT IS THE ENTIRE PRIZE DISTRIBUTION, AND THE NUMBER IS PRINTED

Measured over the rebuilt real corpus, at the **shipped** FR-21 floors and the shipped
`live_count = 1`:

```
clears 24/20  0 of 28
rounds_played min 10 / max 21  (floor 24)
kills         min 1 / max 12  (floor 20)
shelf distribution    shelf0:28
winless cardinality   28 of 28
```

**Not one player is within reach of either floor** — the highest `rounds_played` on the whole roster
is 21 against a floor of 24, and the highest `kills` is 12 against a floor of 20. So all twelve
awards resolve `no_eligible_players`, no shelf ever leaves 0, and pity's input is the **entire
roster**: the ceremony hands out 28 identical consolation prizes and **zero category trophies**.
That satisfies **SM-2** (*"zero Players finish with no shot at a prize"*) **literally while defeating
it in spirit**, and it contradicts the UX's own framing of the pity round as *"a promise of
spotlight, not a pity-pat"* ([EXPERIENCE.md:180](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L180)).

⚠ **This is the FOURTH story in a row to measure the same zero** ([deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269)),
and it is the first where the consequence is not *"the mechanism is inert"* but *"the ceremony's
entire output is one repeated prize"*. **Cuatro's decision (2026-08-07): 6.7 ships the resolver and
carries the escalation; the floors are not re-opened here.** The lever is `0021:56` and
`lib/awards/catalog.ts`, both excluded by DECISION C, and a floors change alters every published byte
of the ceremony. **The number is now on the record with the roster's actual ranges beside it, which
is what a floors decision needs and did not have before.**

---

⭐⭐ **THE STAGE-1 INVARIANT DID NOT MOVE.** The real-floors twelve-spin ceremony re-measured at
**exactly 22 bytes** with drawn order character-for-character 6-4b's, 6.5's and 6.6's:

```
aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11
```

Pity draws on its **own** domain-separated `inclusivcup/v1/pity` stream, so this was never in
question by construction — but "by construction" is exactly the claim 6.6's review found holding
only for the shipped composition, so it is **measured** rather than asserted, and the TS half
asserts it as a test rather than only printing it.

⭐⭐ **6.6's NINETEEN WINLESS IDS REPRODUCED BY SET EQUALITY, PRINTED.** At floors-0,
`live_count = 1`:

```
--- 6.6's 19 winless ids, by SET EQUALITY (floors-0, live_count=1) ---
6.6 recorded  19 ids
6.7 measured  19 ids
SET EQUAL     true
```

Not by count and not by eye — the nineteen ids were transcribed from
[6-6:663-667](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L663) into both
harness halves and compared as sets. A mismatch would have been this story's headline finding.

⭐ **THE FULL MEASURED MATRIX** (both runtimes, ONE catalog projection and ONE snapshot export,
transcripts diffed mechanically). ⚠ **THE SHELF ARM IS DECLARED: ADVANCING** — the caller
accumulates `SpinResult.Assigned` across the twelve spins into the shelf map (DECISION G). 6.5's and
6.6's harnesses differed on exactly this and neither said so; pity **requires** the advancing arm to
have any input at all.

| configuration | Stage-1 bytes | cap fired | shelf distribution | winless | DQ-excluded | pity bytes | pity `n` sequence | rejections |
|---|---|---|---|---|---|---|---|---|
| **SHIPPED 24/20, `live_count=1`** | **22** | 0 | `shelf0:28` | **28 / 28** | **0** | **27** | 28,27,…,2 | 0 |
| floors-0, `live_count=1` | 21 | 0 | `shelf0:19 shelf1:6 shelf2:3` | **19 / 28** | 0 | 18 | 19,18,…,2 | 0 |
| floors-0, `live_count=2` | 22 | 6 | `shelf0:19 shelf1:6 shelf2:3` | **19 / 28** | 0 | 18 | 19,18,…,2 | 0 |
| floors-0, `live_count=3` | 23 | 8 | `shelf0:19 shelf1:7 shelf2:1 shelf3:1` | **19 / 28** | 0 | 18 | 19,18,…,2 | 0 |
| floors-0, `live_count=4` | 21 | 9 | `shelf0:19 shelf1:7 shelf2:1 shelf3:1` | **19 / 28** | 0 | 18 | 19,18,…,2 | 0 |

Every shelf distribution and every winless cardinality reproduces
[6-6:729-738](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L729) exactly,
and the floors-0 `live_count = 1` Stage-1 cost of **21** bytes reproduces 6.6's **advancing**-arm
measurement (the 21-vs-22 reconciliation at
[6-6:675-693](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L675)) — which
is itself evidence that this harness runs the arm it declares.

⭐ **THE EXACT PITY BYTE COST AT EACH CARDINALITY, MEASURED — NOT COMPUTED:**

```
cardinality  0 ->  0 bytes, 0 draws, 0 rejections
cardinality  1 ->  0 bytes, 0 draws, 0 rejections
cardinality 19 -> 18 bytes, 18 draws, 0 rejections
cardinality 28 -> 27 bytes, 27 draws, 0 rejections
```

`len - 1` draws of one byte each, and **zero rejections anywhere on the real corpus** — for `n` in
`[2, 28]` the rejection probability per step is `(256 mod n)/256`, and none of the 45 real draws
landed in a rejection window. ⚠ That is precisely why the rejection path is exercised by a **vector**
row on the `ff…ff` seed rather than by the corpus: the shipped seed does not reject until a
31-member set.

⭐ **MEASURE ZEROS, NEVER NARRATE THEM — the two this story owes:**
- **Fully-DQ'd players in the corpus: 0 of 28.** AC1's DQ filter is **measured-inert**. The filter
  stays — it is FR-28's only stated exclusion, and a corpus where somebody idles a whole tournament
  is one approved demo away — and the vector carries the inversion as a row so the branch is gated
  rather than merely present.
- **`uniform_int` rejections over the whole real ceremony: 0.** Recorded so the vector row that
  forces one is understood as coverage the corpus cannot provide.

⭐ **THE CROSS-RUNTIME DIFF IS MECHANICAL AND IT MATCHED.** Both runtimes read ONE catalog
projection and ONE snapshot export (`_qa67/bundle.json`), wrote transcripts to files, and the two are
**93 lines, byte-identical**: `Compare-Object` returned **0** differing lines and both files hash to
SHA-256 `DCB13ACAF147085A6E23BEABD0A1FED65FEA9C8AB3CC475ED3C79CEB181FF7D1`.

**Corpus anchors proving it is the same corpus:** **204 rounds · 28 roster · 28 distinct players ·
`fair_seed = 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`** (frozen by the REAL
`approve_match` → `advance_match` crowning, `"fair_seed_frozen": true`) **· `row_count 28` ·
`eligible_count 0` · 12 awards** curated through the REAL `curate_award_catalog`. `content_sha256`
came out `26109ffb…a8866f` and **differs** from every prior story's, which is **correct** —
`achievement_ts` is wall-clock approval time.

⚠ **THE BRACKET TOPOLOGY IS STILL A FIXTURE, AS IT WAS AT 6.2.** 28 players in one round and
`generate_bracket` bounds the field at 8–16, so the crowning was driven through a `grand_final`
`gf_order = 2` row bound to the real `ziivanto-sosa` demo with the other 13 published by the status
flip — Story 6.2's own recorded recipe. The parse, the hashes, the freeze and the capture arithmetic
are all REAL; only the bracket shape is not, and that is 6.11's to close
([deferred-work.md:278](_bmad-output/implementation-artifacts/deferred-work.md#L278)).

---

#### ▶ THE DESIGN DECISIONS, AND WHAT EACH ONE COST

⭐ **DECISION D — the shuffle is Durstenfeld DESCENDING, and the alternative is written down as
rejected.** Neither `SPINE:221` nor `§9.4:427-429` names a shuffle, and *"seeded reveal order"* is
satisfied by any of them — two honest implementers produce two different ceremonies while both
correctly calling their work Fisher–Yates. The variant is pinned at **four** sites (the vector's
`spec` string, `pity.go`, `pity.ts`, and the generator's `resolve_pity` docstring) and the anchor
**asserts the emitted `n` sequence is exactly `len … 2`**, so an ascending-sweep implementation
reddens at the anchor and not only in the two suites. The rejected alternative —
`for i = 0 to len-2: j = i + uniform_int(s, len-i)` — is recorded in all four places so the next
reader does not re-open it.

⭐ **DECISION K' RESOLVED: pity does NOT read the suppressed `Tied` set.** `SPINE:148` names pity as
a reader, so a future maintainer will come to "restore" the dependency. **Readable is not the same as
read**: a suppressed player did not win, so their shelf is unchanged, so the shelf **already** places
them in the winless set. Reading it would be redundant at best and double-counting at worst. Stated
at the site in both languages, and made structural — `prng.test.ts`'s import graph pins that `pity.ts`
imports **no `./stage1` and no `./ladder`**, so the dependency cannot be added quietly.

⭐ **THERE IS DELIBERATELY NO `internal` REFUSAL DETAIL, AND THE ABSENCE IS ARGUED.** `sweep.*`
declares one because `Ladder` is an **injected port** that can hand it an outcome no code in the
module built. Pity has no such port: every value it decides from is a plain input it has just
validated, or the return of `uniform_int`, whose `[0, n)` contract is pinned by gate 2 in the same
three implementations. A fourth label would be a **compartment rather than a contract** — one no
suite could ever drive, which is the defect `stage1.go:118-131` records under another name.
Consequently `refusal_details` and `row_representable_refusal_details` are **equal**, both keys are
emitted, and both suites assert the equality as **data**. The multiset identity between `winless` and
`revealOrder` — AC2's *"assert it as a multiset identity, not by spot-check"* — is therefore a **test**
over every case in all three implementations rather than a runtime refusal nothing can reach.

⭐ **THE DISCIPLINE INVERTED FROM 6.6, EXACTLY AS THE STORY PREDICTED.** Anti-sweep proves a property
by an **absence** (no stream parameter, no `./prng` import, a synchronous entry point); pity proves
the mirror by a **presence**. `resolvePity` is `async`, `./prng` **is** imported, and
`prng.test.ts`'s per-module graph now carries a **new** pin that states the property directly rather
than leaving it implicit in seven per-module lists:

```ts
it('exactly the two stream consumers import ./prng', () => { … expect(consumers).toEqual(['pity.ts', 'stage1.ts']); });
```

A `./prng` import appearing in `ladder.ts` or `sweep.ts` would move every byte position after every
resolved tie; one **disappearing** from `pity.ts` would silently unseed the consolation round. Both
halves now redden.

⭐ **AC4's TWO CLAIMS ABOUT THE CALLER ARE CHECKED, NOT ASSERTED.** *"The stream is fresh and keyed by
`PityLabel`"* is a claim about a **caller**, not a construction — the lesson 6.6's review paid for. So
`ResolvePity` refuses a stream whose `Label()` is not `PityLabel` and one whose `Consumed()` is not 0,
and **both arms are vector rows** (the refusal rows carry an optional `label` and an optional
`pre_consumed`). That is what makes AC4 gated rather than narrated.

⭐ **THE TWO ROWS 6.6's MUTATION PASS SAID TO WRITE FIRST WERE WRITTEN FIRST.** Its two real vector
holes were both *"every fixture happened to be in the convenient shape"* — every roster pre-sorted
(killing the sort mutation's visibility) and every player above the floors (killing the re-filter
mutation's). Both twins exist here and both were written in the **same edit** as the code they guard:
`the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY` and
`the-SHIPPED-floors-shape-…-BELOW-both-FR-21-floors`. The mutation pass confirms it: **M01/T01** (sort
removed) and **M16/T16** (the real 24/20 floors applied inside pity) are both **KILLED by the
vector-driven test**.

---

#### ▶ THE MUTATION PASS — 61 RUNS, PER-MUTATION, RECONCILED IN THIS EDIT

**Control pass first, and it went RED**, voiding the run until the runner was fixed:
`--reporter=basic` does not exist in Vitest 4, so every TypeScript mutation would have "passed"
against a Vitest that never started. Fixed, re-run, green — with a **non-vacuity check on the
collection itself**, not merely on the exit code. Files read and written as **BYTES**; the **whole**
vector-driven suite run each time (`go test ./awards/ -count=1`, `vitest run lib/roulette/`), never a
`-run` filter; restoration verified by **SHA-256** after every single mutation; `NOT-APPLIED`
reported as an outcome distinct from `killed`.

**55 mutations · 49 KILLED · 6 SURVIVED · 0 NOT-APPLIED**, plus **6 adjudication controls, all
KILLED** — 61 runs in total.

| # | lang | site | outcome | reddened (Go names) |
|---|---|---|---|---|
| M01 / T01 | go / ts | **P4** the byte-lex sort REMOVED | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M02 / T02 | go / ts | **P4** the sort moved to AFTER the shuffle | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M03 / T03 | go / ts | **P3** the shuffle loop direction REVERSED | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M04 / T04 | go / ts | **P3** loop bound off-by-one at the TOP (`len-2`) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M05 / T05 | go / ts | **P3** loop bound off-by-one at the BOTTOM (`i >= 0`) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M06 / T06 | go / ts | `uniform_int`'s `n` off by one (`n-1`, the Sattolo form) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M07 / T07 | go / ts | `uniform_int`'s `n` off by one (`n+1`) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| **M08 / T08** | go / ts | the self-swap EXCLUDED (`if j != i` guard) | **SURVIVED ×2 — EQUIVALENT** | see adjudication below |
| M09 / T09 | go / ts | **AC1** the DQ filter INVERTED | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M10 / T10 | go / ts | **AC1** the DQ filter REMOVED | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| **M11 / T11** | go / ts | **P6** the shelf test `== 0` → `<= 0` | **SURVIVED ×2 — EQUIVALENT** | see adjudication below |
| **M12 / T12** | go / ts | **P6** the shelf test `== 0` → `< 1` | **SURVIVED ×2 — EQUIVALENT** | see adjudication below |
| M13 / T13 | go / ts | **P6** a negative shelf ACCEPTED (the refusal removed) | KILLED ×2 | `TestResolvePityRefusesTheVectorsRefusals`, `…LeavesTheStreamUntouched…` |
| M14 / T14 | go / ts | **P6** an ABSENT shelf key becomes a REFUSAL instead of 0 | KILLED ×2 | `…MatchesTheVector`, `…IsAPermutationNeverALottery`, `…ReadsNeitherTheFloors…` |
| M15 / T15 | go / ts | **P7** an eligibility magnitude CONSULTED (`rounds_played != 0`) | KILLED ×2 | `…MatchesTheVector`, `…ReadsNeitherTheFloors…` |
| M16 / T16 | go / ts | **P7** the REAL FR-21 floors (24/20) applied inside pity | KILLED ×2 | `…MatchesTheVector`, `…ReadsNeitherTheFloors…` (Go also trips the `math/big` import ban — the second line, recorded as such) |
| M17 / T17 | go / ts | **AC3** `n = 0` REFUSES instead of resolving | KILLED ×2 | `…MatchesTheVector`, `…IsAPermutation…`, `…ReadsNeitherTheFloors…` |
| M18 / T18 | go / ts | **AC3** `n = 1` REFUSES instead of resolving | KILLED ×2 | `…MatchesTheVector`, `…IsAPermutation…`, `…ReadsNeitherTheFloors…` |
| M19 / T19 | go / ts | `RevealOrder` returned as `Winless` (the invariant made vacuous) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M20 / T20 | go / ts | `Winless` returned as `RevealOrder` (the shuffle discarded) | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M21 / T21 | go / ts | a winner DROPPED from the outcome | KILLED ×2 | `…MatchesTheVector`, `…IsAPermutationNeverALottery` |
| M22 / T22 | go / ts | a winner DUPLICATED in the reveal order | KILLED ×2 | `…MatchesTheVector`, `…IsAPermutationNeverALottery` |
| M23 / T23 | go / ts | **AC4** the `PityLabel` guard accepts a Stage-1 label | KILLED ×2 | `…RefusesTheVectorsRefusals`, `…LeavesTheStreamUntouched…` |
| M24 / T24 | go / ts | **AC4** the fresh-stream (counter 0) guard removed | KILLED ×2 | `…RefusesTheVectorsRefusals`, `…LeavesTheStreamUntouched…` |
| M25 | go | the stream RE-CREATED mid-draw (counter reset every step) | KILLED | `TestResolvePityMatchesTheVector` |
| — | ts | *(the same kind)* | **NO EXPRESSIBLE SITE — design-correctness** | see below |
| M26 / T25 | go / ts | the per-draw accounting UNDER-REPORTED by one | KILLED ×2 | `TestResolvePityMatchesTheVector` |
| M27 / T26 | go / ts | **P9** a duplicate `steamid64` ACCEPTED | KILLED ×2 | `…RefusesTheVectorsRefusals`, `…LeavesTheStreamUntouched…` |
| M28 / T27 | go / ts | **P10** validation ORDER: the shelf checked BEFORE the players | KILLED ×2 | `TestResolvePityRefusesTheVectorsRefusals` |

**⭐ RECONCILIATION AGAINST TASK 7's LIST, IN THIS SAME EDIT** (6.6 was pulled up at review for an
aggregate-only record whose `39` had to be reconciled after the fact). Task 7 names **20** mutation
kinds; every one has a row above: the sort removed (M01/T01) · the sort moved after the shuffle
(M02/T02) · direction reversed (M03/T03) · the bound off-by-one at each end (M04+M05 / T04+T05) ·
`n` off by one per step (M06+M07 / T06+T07) · the self-swap included/excluded (M08/T08 for the
guarded form, **and M06/T06 for the structural form** — `n = i` is the Sattolo variant that excludes
the self-swap by never drawing `j == i`, and it is KILLED) · the DQ filter inverted (M09/T09) ·
removed (M10/T10) · the shelf test `<= 0` and `< 1` (M11+M12 / T11+T12) · an absent shelf key as a
refusal (M14/T14) · the floors applied inside pity (M15+M16 / T15+T16) · `n = 0` refusing (M17/T17) ·
`n = 1` refusing (M18/T18) · `RevealOrder` as `Winless` (M19/T19) · `Winless` as `RevealOrder`
(M20/T20) · a winner dropped (M21/T21) · duplicated (M22/T22) · the label changed (M23/T23) · the
stream re-created mid-draw (M25, Go) · the accounting under-reported (M26/T25). **Five kinds were
added beyond the list**: the negative-shelf refusal itself (M13/T13), the fresh-stream guard
(M24/T24), the duplicate-`steamid64` refusal (M27/T26), the validation ORDER (M28/T27) and the weaker
P7 form (M15/T15).

**⚠ ONE KIND HAS NO EXPRESSIBLE SITE IN TYPESCRIPT, AND THAT IS DESIGN-CORRECTNESS RATHER THAN A
GAP.** *"The stream re-created mid-draw"* is expressible in Go because `pity.go` sits in package
`awards` and can reach `Stream`'s unexported `seed` / `label` fields. In TypeScript it cannot be
written at all: `Stream`'s constructor is **brand-guarded** (`createStream` is the only way in), it
requires a **seed**, and `pity.ts` never holds one — the module receives an opened stream and nothing
else. The verifier structurally cannot reset the counter. Recorded rather than silently omitted.

**⭐⭐ THE SIX SURVIVORS ARE ADJUDICATED, AND THE ARGUMENT IS ATTACKED RATHER THAN ASSERTED.** Story
6.6's equivalent-mutant declaration survived review only after its premise was found **false** and
replaced, so the failure mode an equivalence claim hides — **dead code**, where every mutation of an
unreached site "survives" — was tested for directly. Six controls, every one **KILLED**:

| control | site | outcome | what it proves |
|---|---|---|---|
| C1 / C2 | the shelf comparison `== 0` → `== 1` | KILLED ×2 | the comparison site is **LIVE**, so M11/M12/T11/T12 survive by equivalence and not because nothing reaches them |
| C3 / C4 | the swap DELETED entirely | KILLED ×2 | the swap site is **LIVE**, so M08/T08 survive by equivalence and not because nothing reaches them |
| C5 / C6 | the negative-shelf guard removed **AND** the comparison widened to `<= 0` | KILLED ×2 | the guard is what makes the widening unobservable — remove it and the pair reddens |

- **M08 / T08 — the self-swap guard is a PROVABLE no-op.** `order[i], order[j] = order[j], order[i]`
  with `i == j` evaluates its right-hand side and assigns `order[i] = order[i]`; the TypeScript
  three-statement form does the same. Guarding it changes neither the permutation nor the byte
  count, because the draw has **already happened** before the swap. Equivalent by inspection, and
  C3/C4 prove the site is live. ⭐ The mutation that IS meaningful at that site — the Sattolo form
  `n = i`, which excludes `j == i` **structurally** and therefore changes both the permutation and
  the byte accounting — is **M06/T06, and it is KILLED**.
- **M11 / M12 / T11 / T12 — `<= 0` and `< 1` are equivalent to `== 0` on every REACHABLE input.**
  They differ only for a **negative** shelf count, and `validatePityShelf` **refuses** a negative
  count before the winless computation runs. Attacking the argument: could a negative value reach
  the comparison another way? Every shelf key is validated (the validator iterates all of them in
  sorted order) and an unknown key is itself refused, while an **absent** key yields `0` in both
  runtimes — never a negative. So no. The claim's load-bearing premise is *"the guard runs first and
  is real"*, and that premise is independently killed twice: **M13/T13** (removing the guard is
  KILLED) and **C5/C6** (removing the guard *and* widening is KILLED).

⭐ **EVERY MUTATION THAT WAS KILLED WAS KILLED BY A VECTOR-DRIVEN TEST**, not by a hand-written local
assertion — the Go column above names them. That was the standing rule's whole point: a mutation that
reddens only a local test means the vector does not cover it, and the fix is the vector.

---

#### ▶ AC7 — THE FR-28 TRACE, WITH BOTH GREPS RE-RUN AND REPORTED

The contexting brief's claim was **re-derived rather than trusted**, and it held: the mislabel was at
**ONE** site, not two.

| grep | before | after |
|---|---|---|
| `FR-26` on a line mentioning pity, across `worker/awards/*.go` + `lib/roulette/*.ts` | **1** (`labels.go:41`) | **0** |
| `FR-28` across `worker/awards/*.go`, `lib/roulette/*.ts`, `generate_vectors.py`, `roulette/vectors/README.md` | **0** | **32** |

`labels.go`'s trace now reads FR-28 and says why the correction was needed; `labels.ts`, which named
**no** FR at all, gained the same trace so the two halves of the seam make the same claim about the
same constant. ⛔ **`PityLabel` / `PITY_LABEL`'s VALUE is byte-unchanged** — it is the HMAC message
prefix for every consolation draw ever published, and both files now say so at the site.

---

#### ▶ MIGRATION `0026` — WHAT QUESTION 1's ANSWER COST

`award_result.award_id` becomes **nullable**, guarded by
`check (((is_pity or award_id is not null)) is true)`. ⭐ **The `is true` wrapper is not decoration**:
a CHECK whose expression evaluates to NULL is **SATISFIED**, which is exactly how 0025's first
`luck_weight_table_valid` accepted an empty table. Today neither operand can be NULL, so the wrapper
changes nothing about what is accepted — it exists so that the day somebody makes `is_pity` nullable,
this fails **loudly** instead of silently admitting every row. The pgTAP suite asserts the wrapper is
really in `pg_get_constraintdef`.

**The clean-apply trap is discharged on two independent grounds** (`0025:92-101`'s lesson): the table
is **empty everywhere** — 0025 declared in its own comment that nothing writes a row until 6.8, and
this story adds no writer — **and** the CHECK is satisfied by every row the OLD schema could have
held, since `award_id` was NOT NULL and the disjunction is therefore true regardless of `is_pity`.
The constraint **strictly widens** what is legal.

⭐ **It also defuses a second-order trap rather than inheriting one.** Under the rejected shapes (a
13th catalog award, or a reserved sentinel row), once a pity `award_result` existed a later
re-curate that dropped that award would **hard-fail** on `on delete restrict`. With `award_id` NULL
on every pity row there is no reference to restrict, so the ceremony's consolation results and the
catalog's lifecycle stop being coupled at all.

⚠ **The converse is deliberately left unconstrained** — a pity row carrying a real `award_id` stays
representable, because naming the consolation prize is a product decision 6.10 may yet take and a
biconditional here would pre-empt it. What the CHECK forbids is the case that is **always** wrong: a
non-pity result with no award. Recorded in the column comment and exercised by a pgTAP row.

**pgTAP Section D proves 0025's guarantees still bite over a NULL `award_id`**, which is a real
behaviour change rather than an assumption: NULLs are **DISTINCT** in a UNIQUE, so
`award_result_spin_award_key` no longer collapses two pity results in one spin — exactly what
Question 2's answer (N spins, one winner each) needs — while IC909 and
`award_result_winner_spin_key` both still fire.

---

#### ▶ QUESTION 2's ANSWER, RECORDED WITH ITS REASONING (the write shape 6.8 inherits)

**N pity spins, one winner each.** Recorded here because it constrains this story's output type and
because 6.8 writes it either way. **Why:** it matches *"seeded reveal **ORDER**"* (`SPINE:221`)
**literally** — an order only means anything if the reveals are sequential — and it keeps
`is_shared = false`, which the alternative cannot. One spin holding all of them would, under
`unique (spin_id, award_id)`, force **one** `award_result` with N `award_result_winner` rows, which
the IC909 trigger then forces to `is_shared = true`: on today's data a **28-way "shared"**
consolation, representable but almost certainly not what the UX means by a trophy. ⛔ **The
consequence for this story's type is that `PityResult` is *a set plus an order* — `Winless` and
`RevealOrder` as two fields, never one** — and `RevealOrder` is what 6.8 maps to `spin_index`.

⭐ **RECORDED FOR 6.9:** `pity` is a published bundle key (`§9.5:433`) and is therefore
**outcome-affecting for `bundle_sha256`**. The result shape 6.9 must canonicalize is
`{winless: [steamid64…], reveal_order: [steamid64…], draws: [{n, k, rejections, value}…],
bytes_consumed: int}`. **Nothing here canonicalizes it.**

---

#### ▶ GATES

⚠⚠ **THE VITEST BASELINE IN THIS TABLE WAS WRONG AND IS CORRECTED (6.7 code review).** The row
claimed a baseline of `1318 / 42` and a delta of `+47`. `1318` is byte-for-byte the stale figure from
`sprint-status.yaml` — **the one number Task 8 explicitly forbade quoting** (*"Measure the baseline
first … 6.1 quoted stale numbers; do not"*). The reviewer re-measured it: the real baseline is
**`1322 / 42`**, so the story's own delta was `+43`, not `+47`. The `+4` gap is exactly the **four
assertions** added inside pre-existing `it` blocks in `prng.test.ts`, which were counted as four
*tests*; `git diff` shows `prng.test.ts` adds exactly **one** new `it(...)`. The **after** numbers
were correct as printed. ⭐ The Go side reconciled perfectly and needed no correction.

| gate | baseline (`ba894d1`) | as shipped for review | after the code-review patches |
|---|---|---|---|
| `npm run lint` | 0 | 0 | **0** |
| `npm test` | **1322 / 42** ⚠ *(was mis-stated as 1318 / 42)* | 1365 / 43 | **1374 / 43** (+52 on baseline, +1 file) |
| `npm run build` | 0 | 0 | **0** — every viewer route still `ƒ` dynamic, `/ceremonia` included, and **no `roulette` route** |
| `go build ./... && go vet ./... && go test ./... -count=1` | clean | clean | **clean** |
| Go `awards` `--- PASS` | 607 | 641 | **647** (+6 review guards) |
| `gofmt -l ./worker` | empty | empty | **empty** |
| `generate_vectors.py --check` | OK ×6 | OK ×7 | **OK ×7**, all six pre-existing files **byte-identical**, and ⭐ **`pity-draw.json` byte-identical too** — every review patch to the anchor changed GUARDS, never emitted data (proven by `git status`) |
| pgTAP | 1223 / 26 | 1239 / 27 *(claimed, unverified at review)* | ⭐ **1241 / 27 PASS — EXECUTED and verified** (+2 review assertions) |

⭐ **pgTAP was actually RUN this time.** Both the author's and the reviewer's passes left it
unverified because it needs a live stack; the patch pass executed `supabase test db` against the
running local stack and it came back **`Files=27, Tests=1241, Result: PASS`** — no reset was needed,
so the claimed `1239` is now confirmed as a real number plus the two assertions this review added.

**The 52 new Vitest tests over baseline** are `pity.test.ts` (**51**: the 13-case conformance sweep,
the 8 refusal rows, the closed-set and label pins, the four no-stream arms, the nine property tests,
and ⭐ the **9 added by this review** — the read-less stand-in, its three cardinality arms and the
five previously-undriven validation arms) plus 1 new `it` in `prng.test.ts` (the stream-consumer
split). **The 40 new Go tests** are `pity_test.go`'s vector-driven conformance (13 subtests), its 8
refusal subtests, 13 named property/pinning tests, and ⭐ the **6 row-specific coverage guards this
review added**.

**Scope proof:** `git status` shows `app/**`, `lib/awards|ceremony|i18n|bracket|steam/**`,
`worker/ingest|store|db|config/**` and `supabase/migrations/0021_leaderboard.sql` **byte-untouched**;
`supabase/**` changes are `0026` and its pgTAP file only, which Question 1's answer authorised.
**CRLF check:** every file this story wrote is bare LF (0 CRLF); `roulette/vectors/README.md` is
uniform CRLF with **0** bare LF — its pre-existing working-copy state under this repo's
`core.autocrlf=true`, which git stores as LF. **No file has mixed endings.**

---

#### ▶ WHAT IS OWED, AND TO WHOM

- ⛔⛔ **The FR-21 floors.** Measured for the fourth time, now with the roster's ranges beside the
  zero (max 21 rounds vs a floor of 24; max 12 kills vs a floor of 20). Ships as-is by Cuatro's
  decision; the escalation is this story's headline. **Home: a floors slice before Epic 6 closes, or
  an explicit decision to ship the degenerate ceremony.**
- **The pity WRITE** — the `spin` rows (`kind = 'pity'`, one per winner, `spin_index` from
  `RevealOrder`), `award_result` with `is_pity = true` and `award_id = NULL`, `award_result_winner`,
  the `steamid64 → roster_entry.id` mapping and the reveal axis → **6.8**.
- **Canonicalization of the `pity` bundle key** and `bundle_sha256` → **6.9**. Shape recorded above.
- **`ronda de consolación` / `Nadie se va con las manos vacías`** and every i18n string → **6.10**.
  `/ceremonia` is still 5.7's `<Placeholder>` and there is still no ceremony i18n namespace.
- **§9.6 gate 4's end-to-end vector exercising a pity draw** → **6.11**. This story's is the **unit**
  vector.
- **The recorded gate-number discrepancy** between `roulette/vectors/README.md:39-40` and
  `SOLUTION-DESIGN:441-445` (4 and 5 are swapped). Noted beside the new ownership row and
  deliberately **not** renumbered → **6.9 / 6.11**, together with the document.
- **The anchor's independence** carries the same qualification `deferred-work.md:300` and `:318`
  record: `pity-draw.json`'s byte accounting comes from the cryptographic anchor already pinned by
  gates 1–2, but its **algorithm** is transcribed from two spec sentences plus DECISION D, which was
  authored in this slice. ⭐ **Stated plainly: the generator was written from the spec text and this
  story's transcribed algorithm, never by reading either runtime.** Home: **6.11**.

### File List

**New**

- `worker/awards/pity.go` — the Go producer: the winless set, the Durstenfeld-descending seeded
  shuffle, `ErrPity` + `PityInvalidError`, the three-label closed set, P1–P11 pinned at their sites
- `worker/awards/pity_test.go` — vector-driven + table-driven; the case-name set pinned by exact
  equality; the nil-stream arm the vector cannot express
- `lib/roulette/pity.ts` — the TS verifier mirror; **`async`**; imports `./labels`, `./prng`,
  `./stage2`; not `server-only`
- `lib/roulette/pity.test.ts` — vector-driven with per-row `detail` assertions from the start
- `roulette/vectors/pity-draw.json` — 13 cases + 8 refusal rows, generated by the third
  implementation
- `supabase/migrations/0026_pity_award_result.sql` — `award_id` nullable +
  `award_result_award_or_pity`
- `supabase/tests/0026_pity_award_result_test.sql` — `plan(18)` (shipped at `plan(16)`; the code
  review added Section D's missing negative control and IC909's message-pattern assertion)

**Modified**

- `worker/awards/labels.go` — `:41` FR-26 → **FR-28** + the frozen-value note (comment only)
- `lib/roulette/labels.ts` — gained the FR-28 trace it never had (comment only)
- `worker/awards/prng_test.go` — the shipped file set 6 → **7**; ⛔ the `math/big` `exceptIn` list
  deliberately **NOT** widened, with the argument at the site
- `lib/roulette/prng.test.ts` — the module list 6 → 7, the per-module import graph gains
  `'pity.ts': ['./labels', './prng', './stage2']`, the non-vacuity pin gains `pity.ts`, and a **new**
  pin states the stream-consumer split directly
- `roulette/vectors/generate_vectors.py` — `resolve_pity` + the three validators + the fixtures +
  `build_pity_file`, and one line in `main()`'s `outputs` dict
- `roulette/vectors/README.md` — the ownership row, the `pity-draw.json` format section, the
  cases-that-carry-the-weight table, the anchoring paragraph, the `:64-67` correction and the
  recorded gate-number discrepancy
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Created and DELETED before commit** (the throwaway harness): `worker/cmd/qa67/main.go`,
`lib/roulette/bar-qa67.test.ts`, `lib/awards/qa67-payload.test.ts`, `_qa67/`.

### Change Log

| Date | Change |
|---|---|
| 2026-08-07 | **Story 6.7 CODE-REVIEWED → `done`** (bmad-code-review, three parallel layers — Blind Hunter / Edge Case Hunter / Acceptance Auditor, all Opus 5; baseline `ba894d1`). 28 raw findings → **2 decision-needed · 20 patch · 4 deferred · 6 dismissed on verification**. Cuatro delegated both decisions to the reviewer; **both resolved to DEFER with owners and mechanisms recorded**, and **every patch was applied**. ⭐ **AC1–AC5 and AC7 MET, AC6 PARTIAL**, and every runnable gate was independently re-derived by the auditor and MATCHED — with **one exception now corrected**: the Vitest baseline was quoted as `1318 / 42` (the stale `sprint-status.yaml` figure Task 8 explicitly forbade quoting); the measured baseline is **`1322 / 42`**, so the shipped delta was `+43`, not `+47`. **HEADLINE FINDING — the project's recurring coverage-guard defect at its SIXTH occurrence, inside the file whose own header mandates the fix:** the rejection row's `pins_inputs` was `lambda e, c: 256 % 3 != 0`, a constant that ignores both arguments and hard-codes the `3`, sitting 250 lines above the contract requiring *"every row re-derives the INPUT property its name claims — that 256 mod n really is non-zero"*; and the `dq_excluded` guard was satisfied by a DQ'd player who ALSO held a trophy, so the DQ branch could be deleted and it stayed green. Both now re-derive from the row's own emitted data. **SECOND:** `uniformInt`'s error was wrapped into a typed refusal in Go and escaped untyped in TypeScript and Python — the same primitive failure producing three different observable surfaces, only one carrying a `detail` from the closed set — and it is also **the one refusal in the module that costs bytes**, so the suites' *"a refusal leaves the stream untouched"* invariant is now explicitly scoped to VALIDATION refusals at all three sites rather than silently over-claimed. **THIRD:** the TS/Python stream guards were duck-typed on `label`/`consumed` and never checked `read` — the two fields the pass merely REPORTS, not the one it USES — so a `{label, consumed}` stand-in **silently RESOLVED** a zero- or one-member set while publishing an invented byte count, and died with a bare `TypeError` at 2+. Also: the Go suite carried **none** of the row-specific coverage guards the anchor and the TS suite carried (6 added); `TestResolvePityTakesNoAwardAndNoOutcome` was vacuous and its justification was wrong Go semantics (a KEYED composite literal does not break when a field is added — replaced with an unkeyed-literal compile-time pin plus a reflective field-set assertion); P7's `sub_floor` guard was a nameless `>= 2` lower bound on the story's most dangerous semantic (now pinned by name); five TS and eight Python validation arms were driven by nothing, the exact standard the module uses to REJECT an `internal` label (all now driven); pgTAP Section D's *"TWO pity results coexist"* inserted ONE row and depended on Section B sixty lines earlier, with **no negative control that `award_result_spin_award_key` still bites over a non-NULL award_id** — the whole section passed against a schema with the index dropped. **Both DEFERRED decisions:** ⚠ the `.sort()` UTF-16 defect is at its **SECOND occurrence** (6.6 deferred the `sweep.ts` twin to 6.9, and this story is scope-barred from `sweep.*`, so fixing only pity would split sibling guarantees) — the false *"byte-lex by definition"* claim was corrected in all three runtimes and the guard homed to **6.9, both modules**; and `is_pity = true` on a `kind='main'` spin, which 0026 made representable and nothing constrains, homed to **6.8** with the mechanism recorded (no `0027`, and deliberately **no pgTAP row blessing the state**). ⭐⭐ **pgTAP was EXECUTED for the first time across both review passes** — `Files=27, Tests=1241, Result: PASS` — confirming the previously-unverified `1239` plus this review's two assertions. **GATES AFTER: lint 0 · Vitest 1374 / 43 · build 0 (every viewer route still `ƒ`, no `roulette` route) · Go `awards` 647 · `gofmt` empty · `--check` OK ×7 with all six pre-existing vectors AND `pity-draw.json` byte-identical (every anchor patch touched guards, never emitted data) · pgTAP 1241 / 27 PASS · every excluded path byte-untouched · 0 CRLF.** |
| 2026-08-07 | **Story 6.7 IMPLEMENTED** (bmad-dev-story, Opus 5, baseline `ba894d1`) → `review`. FR-28's pity draw ships in all three implementations against a new `roulette/vectors/pity-draw.json`. Cuatro answered all four Questions before Task 2 fixed the vector: `0026` makes `award_result.award_id` nullable under an `is true`-wrapped CHECK; pity persists as N spins with one winner each, so the result type is a set plus an order; the shuffle is Durstenfeld descending with the ascending sweep recorded as rejected; and the story ships against the degenerate floors configuration and escalates rather than fixes it. THE BAR rebuilt the 14-demo corpus end to end through the REAL pipeline and ran the ceremony **plus pity** in both runtimes over ONE catalog projection and ONE snapshot export — 93-line transcripts **byte-identical** (`Compare-Object` 0 lines, one SHA-256). The Stage-1 invariant did NOT move (22 bytes, drawn order character-for-character) and 6.6's 19 winless ids reproduced by **set equality**. The headline is measured, not argued: at the shipped floors **0 of 28** players clear 24/20 (max 21 rounds, max 12 kills), so the winless set is the ENTIRE roster and a consolation prize is the only award anybody receives. AC7's two greps re-run and reported (FR-26-near-pity 1 → 0; FR-28 0 → 32). Mutation pass: 55 mutations, **49 killed, 6 survived, 0 NOT-APPLIED**, plus 6 adjudication controls all killed — the six survivors are three equivalence classes whose sites are proven LIVE. Gates: lint 0 · Vitest **1365 / 43** · build 0 · Go `awards` **641** · `gofmt` empty · `--check` **OK ×7** with all six pre-existing files byte-identical · pgTAP **1239 / 27** PASS on a freshly reset stack. Harness deleted with the Go gates proven clean while present and after removal. |
