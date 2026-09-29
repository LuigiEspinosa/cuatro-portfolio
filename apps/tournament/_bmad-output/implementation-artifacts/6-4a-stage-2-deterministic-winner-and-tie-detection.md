---
baseline_commit: 3f7c98e5e71a8c1095a7d18b47d2274cf01157d3
---

# Story 6.4a: Stage-2 deterministic winner and tie detection

Status: done

> **Story 6.4 was contexted whole, measured at roughly 2× Story 6.3, and split by Cuatro (2026-08-04)
> into 6-4a and 6-4b** — the same call that split 4.6. The seam is forced, not cosmetic: 6-4b's Stage-1
> weight is `luck_weight_table[min(shelf[provisional_winner(a)], table_max)]` and `provisional_winner(a)`
> **is this story's resolver**, so Stage 2 has to exist first either way (SOLUTION-DESIGN §9.6 prescribes
> the same order independently).
>
> **This is the story that decides who wins.** It turns 6.2's frozen snapshot into an outcome —
> deterministically, integer-only, with no randomness and no stream — and it is where the epic's three
> inherited ⛔ measurements finally get answered with numbers.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **fourth story of the epic, first half of the split**
Traces: **FR-25** (Stage-2 half) · **AD-14** · FR-21 (floors, consumed) · AD-15 · AD-19 · SPEC Constraint 7
Consumes: 6.2's `stat_snapshot_row` (AD-19 integer form) · 6.1's `award` catalog · 6.3's `lib/roulette` module conventions
Hands to: **6-4b** (as `provisional_winner`), 6.5 (the FR-29 ladder behind this story's port), 6.8 (persistence), 6.11 (end-to-end vector)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want each live category's winner resolved deterministically from the locked snapshot,
so that the result is the same on every run and any skeptic can recompute it.

## Acceptance Criteria

**AC1 — Stage 2 is deterministic, integer-only, and reads only the frozen snapshot.**
**Given** the Stage-2 rule ([epics.md:1068](_bmad-output/planning-artifacts/epics.md#L1068); AD-14 `ARCHITECTURE-SPINE.md:148`; SOLUTION-DESIGN §9.3; AD-15 `:150-153`),
**When** a live category resolves,
**Then** eligible players (FR-21 floors: `rounds_played >= award.floor_rounds`, `kills >= award.floor_kills`, `not idle_dq`) are iterated in **byte-lex sorted decimal-SteamID64 order**, the best deciding value wins — volume by integer compare, rate by **cross-multiplication** `p.num*q.den vs q.num*p.den` — `award.direction` (`max`/`min`) inverts "best", and **every input comes from `stat_snapshot_row.stats_int`**, never from `stat_row`, never from `public.leaderboard`, and never from a pre-divided `numeric`.

**AC2 — a tie is a RETURNED OUTCOME, never a resolution, and never a silent argmax.**
**Given** AD-14's *"an **equal** deciding-stat value … is a **tie** and MUST enter the FR-29 ladder — never resolved by a silent argmax over iteration order"*,
**When** two or more eligible players share the best deciding value (equal integer, or equal cross-product),
**Then** Stage 2 returns the **full tied set** in byte-lex order together with the reason it tied — it does **not** pick the first, the last, or the lowest SteamID64 — the FR-29 ladder is an **injected port** whose 6-4a-era implementation **refuses loudly** (Go `error` / JS `throw`, naming Story 6.5), and no code path in this story can turn a tie into a winner.

**AC3 — the resolver is proven by a shared, externally-anchored vector — not by inspection.**
**Given** AD-14's *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build and includes equal-value and equal-cross-product ties"*,
**When** the build runs,
**Then** `roulette/vectors/stage2-resolve.json` carries language-neutral golden JSON covering at minimum an **equal-integer tie**, an **equal-cross-product tie**, a `direction: 'min'` case, a **zero-denominator** case, a **floors-exclude-everyone** case, and an `idle_dq` exclusion; **both** the Go suite and the Vitest suite read **that same file**; and every expected value is produced by the committed third implementation (`roulette/vectors/generate_vectors.py --check`) so the vector proves conformance to the spec rather than mutual agreement of two possibly-identical mistakes.

**AC4 — the resolver is exercised over the REAL captured snapshot, and the eligibility question is answered with numbers.**
**Given** the project's THE BAR discipline and the ⛔ findings handed to this story by name ([deferred-work.md:268-270](_bmad-output/implementation-artifacts/deferred-work.md#L268)),
**When** the story is signed off,
**Then** both runtimes are driven over the **real** captured `stat_snapshot_row` set, their outputs are diffed **mechanically**, and Completion Notes record **measured**: per award — how many players clear its floors, the winner or the typed no-winner outcome, and the tie set with its width if any; plus the roster-wide answer to *"do the `24`/`20` floors admit anybody on the real bracket shape?"* — a pass is a printed number, not a claim.

## Tasks / Subtasks

> Build order inside the story: Task 0 (read) → Task 1 (pin the edge semantics) → Task 2 (the vector seam)
> → Task 3 (first language) → Task 4 (second language) → **Task 5 (THE BAR) gates sign-off** → Task 6
> (mutation) → Task 7 (gates). **Write the vector before the second implementation** so the second one is
> written against a fixed artifact, not against the first one's source.

- [x] **Task 0 — Read before you write**
  - [x] [SOLUTION-DESIGN §9.3](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L413) (Stage 2) and **§9.6** (`:443-445`) — the build order that puts this story first, and the conformance gates.
  - [x] [ARCHITECTURE-SPINE.md:145-148 (AD-14)](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) and `:219` (Stage 2 on the Provably-Fair contract surface).
  - [x] [supabase/migrations/0024_ceremony_lock_snapshot.sql:664-737](supabase/migrations/0024_ceremony_lock_snapshot.sql#L664) — the exact `stats_int` / `h2h` / `achievement_ts` payload you read, and **`:909-923`** for the two comments that change its meaning (snapshot `idle_dq` = **fully** DQ'd; an **absent** `h2h` key is the never-met skip signal, never a zero).
  - [x] [lib/awards/catalog.ts](lib/awards/catalog.ts) + [supabase/migrations/0023_award_catalog.sql:63-156](supabase/migrations/0023_award_catalog.sql#L63) — `deciding_stat`, `class`, `direction`, `floor_rounds`, `floor_kills`, `priority`. ⭐ `award_class_key_coherent` (`0023:129-133`) is called out in its own comment as *"precisely the discriminator **6.4's Stage 2 branches on** (cross-multiply a `{num,den}` pair vs compare two integers)"* — branch on `class`, never on whether a value happens to look like a pair. The exported `MEASURED_EMPTY` / `MEASURED_DEGENERATE` / `THIN_BUT_REAL` sets are the measured record Task 5 reports against. **`secondary_stat` / `eff_num_key` / `eff_den_key` are deliberately NULL in the shipped seed** (0024 DECISION B) — 6.5's to fill, not a bug for you to fix.
  - [x] [lib/roulette/prng.ts](lib/roulette/prng.ts) — you are not consuming the stream in this story (Stage 2 has no randomness), but you **are** adding the first sibling modules to this package: read its ⛔ notes on `server-only`, `node:` and the ban list before writing `stage2.ts`.
  - [x] [lib/bracket/generate.ts](lib/bracket/generate.ts) — the house shape for a pure, injectable, exhaustively-testable decision module. Mirror the shape.
  - [x] Sweep-prove the greenfield claim before writing a line: nothing in the repo implements a Stage-2 resolver, an eligibility filter over the snapshot, or a cross-multiplying comparator. Record the sweep. (Confirmed at contexting — re-confirm, do not assume.)

- [x] **Task 1 — Pin the edge semantics IN CODE COMMENTS before implementing (AC: 1, 2)**
  > Same discipline as 6.3's E1–E4, and for the same reason: each is a place where two honest implementers
  > reading the same sentence pick a different winner. Each gets a vector row in Task 2 and a named comment
  > at its implementation site **in both languages**.
  - [x] **S1 — `direction: 'min'` inverts "best", and only "best".** Award #12 `El Inofensivo` is the catalog's only `min`. The floors are **not** inverted (DECISION C) and the tie rule is unchanged: equal is still equal.
  - [x] **S2 — the floor test is `>=`, on the snapshot's own `rounds_played` / `kills`, plus `not idle_dq`.** `floor_kills` is `0` for volume awards and `20` for rate awards; a `0` floor still runs the comparison rather than being special-cased away.
  - [x] **S3 — a zero denominator is a real, reachable input and must not divide, throw, or drop the player.** Cross-multiplication is total: with `q.den = 0` both products are still computable. Two players with `den = 0` compare **equal** and therefore **tie**. Do not "fix" this by filtering `den = 0` — a silent filter is an argmax by another name.
  - [x] **S4 — cross-multiplication must not overflow.** `num`/`den` are unbounded snapshot integers. Go: `math/big` (stdlib, allowed) or a documented `uint64`-safe bound with an explicit guard — **never** a silent wrap. TS: **`BigInt`**, never `number`. This is the highest-value divergence in the story because a wrap produces a *plausible* winner.
  - [x] **S5 — an empty eligible set is a typed outcome, not a crash and not a zero-winner.** Return `no_eligible_players`. AC4 makes this reachable **today**: 6.2 measured **0/28** eligible.
  - [x] **S6 — iteration order is byte-lex over the decimal SteamID64 *string*.** Go: `sort.Strings` (byte-wise). TS: `a < b` on the string (UTF-16 code-unit order, identical to byte order for ASCII digits) — **never** `localeCompare`, never a numeric sort, never `BigInt` ordering. The snapshot already aggregates `order by p.steamid64 collate "C"` (`0024:732`, and `:545-547` names it *"Story 6.4's Stage-2 iteration order"*), so the two must agree — assert that they do rather than assuming it.
  - [x] **S7 — "best" is computed as a SET, not a running champion.** `best = { p : no q beats p }`. A running-max loop that replaces on `>` silently keeps the first of an equal pair and **is** the argmax AC2 forbids; a loop that replaces on `>=` silently keeps the last. Compute the set, then branch on its size.

- [x] **Task 2 — The `stage2-resolve.json` vector seam (AC: 3)**
  - [x] `roulette/vectors/stage2-resolve.json` — cases of the shape
        `{ "name", "note", "award": {deciding_stat, class, direction, floor_rounds, floor_kills}, "players": [ {steamid64, stats_int, rounds_played, kills, idle_dq} ], "expected": {kind, …} }`.
  - [x] Mandatory rows: a plain volume `max`; ⭐ **a rate `max` decided ONLY by cross-multiplication** — i.e. a pair where the naive `num/den` float compare picks the *other* player (search for one and **record the search** in Completion Notes; a rate case that both methods agree on proves nothing); the `direction: 'min'` case; an **equal-integer tie**; an **equal-cross-product tie with different `{num,den}` pairs** (e.g. `3/6` vs `2/4` — a tie that a pair-equality check would miss); a **zero-denominator** pair; a floors-exclude-everyone case (`no_eligible_players`); an `idle_dq` exclusion; and a case whose player list is supplied **out of byte-lex order** so the resolver's own sort is exercised rather than the fixture's.
  - [x] Extend `roulette/vectors/generate_vectors.py` (committed by 6.3's review) to produce **and `--check`** the new file. Do **not** hand-write expected values, and do **not** add a second generator. ⛔ Never "fix" the generator by reading either implementation — it is the anchor precisely because it was written from spec text alone.
  - [x] Update the ownership table at [roulette/vectors/README.md:26-39](roulette/vectors/README.md#L26): 6.3 owns gates 1–2; **6-4a owns the Stage-2 vector**; **gate 3 (Stage-1 weighted pick) is 6-4b's** (line 34 currently reads *"not yet — Story 6.4 / 6.6 ⏳"*); 6.9 owns canonicalization; 6.11 owns the end-to-end ceremony vector.
  - [x] Vectors are **data, not code**: LF newlines, 2-space indent, stable key order, no comments-as-keys.

- [x] **Task 3 — Go producer: `worker/awards/stage2.go` (AC: 1, 2)**
  - [x] A **pure** resolver over an injected player slice: `ResolveAward(award Award, players []SnapshotPlayer, ladder Ladder) (Outcome, error)`. No DB, no `worker/store`, no `worker/db` — `worker/awards` stays the leaf 6.3 made it (`TestPackageIsALeaf` will tell you if it stops being one).
  - [x] ⭐ **The `Outcome` shape is the seam 6-4b, 6.5 and 6.8 all inherit — get it right once:**
        `{kind: winner, steamid64, deciding_value}` | `{kind: tie, tied []string, reason: equal_value | equal_cross_product}` | `{kind: no_eligible_players}`.
        ⚠ **AS SHIPPED THERE ARE FOUR KINDS, not three** (corrected by the code review, which found
        this bullet and the transcribed algorithm below still describing the pre-DECISION-E shape while
        both implementations had four): a fourth arm `{kind: no_awardable_value, tied []string}` was
        added by **DECISION E**, answered by Cuatro before Task 2 fixed the vector. Its `tied` is the
        byte-lex set that shared the suppressed zero — `len(tied)` is the width of the tie that never
        formed, and it is `1` when a lone eligible player sat at zero. **6-4b, 6.5 and 6.8 inherit the
        four-arm shape.**
        `deciding_value` is **display only** and must be typed and commented as such — `award_result.deciding_value` carries the same warning at SOLUTION-DESIGN:219 (*"display only; never an input to resolution"*).
  - [x] ⭐ **The ladder is a PORT, injected, and its 6-4a implementation refuses.** Define the interface here, ship a `RefusingLadder` returning a typed error that names Story 6.5, and make the tie path *use* it so the seam is exercised rather than merely declared.
  - [x] `worker/awards/stage2_test.go` — table-driven **and** vector-driven (`loadVector` from `../../roulette/vectors`, the 6.3 helper). Guard the loader against malformed rows: 6.3's review found the Go coverage test would **panic** on a `"n": 0` row instead of failing a named test.
  - [x] Extend `TestPackageSourceHasNoBannedConstructs` to cover the new file: no `float64`, no `math/rand`, no `time`, no `fmt.Sprintf` in the decision path.

- [x] **Task 4 — TS verifier: `lib/roulette/stage2.ts` (AC: 1, 2)**
  - [x] The mirror — same names in camelCase, same refusals, same order, same `Outcome` shape.
  - [x] ⛔ **No `import 'server-only'`.** `lib/roulette` is the one `lib/**` package that ships to the browser (6.9's *"Verificar la ceremonia"*), and `server-only` throws in a client bundle. Extend 6.3's existing source-scan pinning test rather than writing a second one — the module-list assertion is **exact-equality**, so adding the file without registering it reddens (by design).
  - [x] Comparison arithmetic in **`BigInt`** (S4). No `Math.*`, no `Number` division anywhere in the decision path.
  - [x] `lib/roulette/stage2.test.ts` — colocated under `lib/**` or [vitest.config.ts:17](vitest.config.ts#L17) **silently does not run it**. Load the vector with `readFileSync` from the repo root.

- [x] **Task 5 — ⛔ THE BAR: the real captured snapshot, both runtimes, mechanically diffed (AC: 4) — this gates sign-off**
  - [x] Bring up the local stack, run 6.2's `lock_ceremony` over the real 14-demo corpus (or read the already-captured `stat_snapshot_row` set), and export the rows as the AD-19 integer-form JSON both runtimes read.
  - [x] ⭐ **Answer the floors question with numbers, because it was handed to you by name.** [deferred-work.md:269](_bmad-output/implementation-artifacts/deferred-work.md#L269) records **0/28** players clearing `floor_rounds = 24` / `floor_kills = 20` (measured `rounds_played` min 10 / max 21), and homes the verification here: *"verify the 24/20 values against the REAL bracket shape rather than assuming it, because the assumption is currently untested and its failure mode is silent (an empty award, no error anywhere)."* Print, per award: eligible count, the outcome, and the tie set if any. **Do not change the `24`/`20` literals** — DECISION C.
  - [x] ⭐ **Measure the all-zero tie width.** [deferred-work.md:270](_bmad-output/implementation-artifacts/deferred-work.md#L270) quantified players-above-zero as `knife_kills` **1/28**, `through_smoke_kills` **2/28**, `blind_kills` **3/28**, `wallbang_kills` **7/28**. If the single knife-kill holder fails the floors, award #6 is a **27-way tie at zero**. Report the actual width per weird award — this is the evidence Question 1 needs.
  - [x] ⭐ **Report `El Inofensivo`'s inversion.** [deferred-work.md:268](_bmad-output/implementation-artifacts/deferred-work.md#L268): a kill floor on the catalog's only `min` award is anti-*qualification*. Print who it admits and who it excludes on the real corpus.
  - [x] Diff the two runtimes' full per-award output **mechanically** (write both to files, `Compare-Object`) — not by eye. Record the SHA-256 of each transcript. A mismatch is the story's headline finding, not a footnote.
  - [x] Harness convention: a throwaway `worker/cmd/qa64a/main.go` + a throwaway node script, **deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean while present *and* after removal. ⚠ `worker/cmd/qa54/` is still in the tree and is still not yours to delete; do not add a second orphan.

- [x] **Task 6 — Mutation pass, before review (non-optional)**
  > Epic-5 retro Action Item #3 makes a **reviewer-independent** mutation pass a review gate. 6.2 reported
  > 43/0 and the reviewer found 5 survivors in 6 mutations; 6.3's own first table was **invalid** because a
  > lowercase drive letter made every Vitest run fail and read as "killed". **Run a CONTROL pass on
  > unmutated source first and void the run unless it is green**, and verify restoration by **SHA-256**, not
  > `git status` — git is blind to content inside untracked directories.
  - [x] Mutate and record red/green in **both** languages: `direction` ignored (always `max`) · cross-multiply → `num/den` float compare · cross-multiply operands swapped · best-as-set → running max on `>` (keeps the first of a tie) · running max on `>=` (keeps the last) · floors `>=` → `>` · `floor_kills` ignored · `idle_dq` filter dropped · byte-lex sort → numeric sort · sort removed entirely · tie returns the first tied player instead of the set · `no_eligible_players` returns a zero-value winner · the ladder port called with the tie *swallowed* instead of propagated.
  - [x] ⭐ Every mutation must redden the **vector-driven** test, not only a hand-written local assertion. A mutation that only reddens a local test means the *vector* does not cover it — fix the vector, not the test.
  - [x] ⭐ **Add the positive control 6.3's review deferred to you.** [deferred-work.md:291](_bmad-output/implementation-artifacts/deferred-work.md#L291): three of the four TS import-ban tests currently assert over an **empty** list, because `labels.ts`/`prng.ts` have no imports. `lib/roulette/stage2.ts` brings the **first real import** in the directory. Confirm the ban tests now execute a real assertion, and pin it.

- [x] **Task 7 — Gates**
  - [x] `npm run lint` → 0 · `npm test` → **measure the baseline first** (6.3 post-review: **754 across 38 files**; measure, do not quote — 6.1 quoted stale numbers) · `npm run build` → 0, every viewer route still `ƒ` dynamic and no `roulette` route · `cd worker; go build ./... && go vet ./... && go test ./...` → clean (6.3 post-review: `awards` **116**).
  - [x] `python roulette/vectors/generate_vectors.py --check` → OK on **all three** vector files.
  - [x] pgTAP: **unchanged, 1155 across 25 files** (assuming DECISION A holds). ⚠ [deferred-work.md:293](_bmad-output/implementation-artifacts/deferred-work.md#L293) records that 6.3 could not re-measure this for want of a live stack; you will have the stack up for Task 5, so **this is the story that closes that deferral** — actually run it and paste the output.
  - [x] `git status` proof that `supabase/**`, `app/**`, `lib/awards/**`, `lib/ceremony/**`, `lib/i18n/**`, `lib/bracket/**` and `worker/ingest|store|db|config` are **byte-untouched**.

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A — this story writes NOTHING to the database *unless it proves necessary*, and then only loudly.**
**Cuatro, 2026-08-04, answering "does 6.4 write SQL?": *"If needed."*** The default therefore stands: no
migration, no RPC, no route, no RLS, no pgTAP file. The ACs are entirely algorithmic — they describe
eligibility, iteration order and comparison, and never mention a table or a transaction. `spin`,
`award_result` and `award_result_winner` carry the **AD-22 reveal axis** (Story 6.8's by name —
`ARCHITECTURE-SPINE.md:188`, `0023:20-23`, `0024:150-152`) and `award_result_winner`'s
`UNIQUE(spin_id, winner_entry_id)` is the **DB half of 6.6's anti-sweep AC**; landing them here means
shipping a reveal-gated, write-once schema *before* the guard that protects it and *before* the algorithm
that can trip its unique constraint — the "guard landed before its writer is an untested backstop"
anti-pattern (`deferred-work.md:90`). **If implementation genuinely needs SQL, `0025` is yours** — take it,
follow the conventions in the next section, and **say in Completion Notes what forced it**. What is not
acceptable is a migration appearing without that justification.

**DECISION B — the tie is returned; the ladder is an injected port that REFUSES.**
The spec assumes Stage 2 yields one player. It does not, and it must not: AD-14 *requires* an equal value
to be a tie, and 6.2's review proved the most common tie shape in a 1v1 bracket is **guaranteed** to reach
the ladder's rung 4 and fail there (`deferred-work.md:281` — a **named blocker on 6.5**). Every
self-contained fallback — first-in-byte-lex, lowest SteamID64, the running-max accident of S7 — is a
**silent argmax wearing a different hat**: it produces a plausible winner that 6.5 will later contradict,
with nothing red anywhere. Ship the loud refusal; 6.5 supplies the real ladder; 6.11 owns the forced-tie
end-to-end vector (it already says so). ⚠ **This decision is load-bearing for 6-4b**, whose Stage-1 weight
needs `shelf[provisional_winner(a)]` — a tied award has no single provisional winner, so the refusal
propagates there too. 6-4b's story records the consequence.

**DECISION C — the FR-21 floors are applied verbatim, `direction` and all, and this story does not touch the literals.**
6.1's review flagged that `El Inofensivo` (least ADR, the only `direction: 'min'` award) carries
`floor_kills = 20`, so *"for a `min` award it is anti-**qualification** — the most harmless player is the
one least likely to clear a kill floor"* (`deferred-work.md:268`), and homed the interaction here. The
floors are a deliberate value-parity duplicate between `0021:50-56` and `award.floor_*`; changing either
half silently desynchronises the leaderboard from the ceremony. **Apply them as written, measure the
consequence at Task 5, and report it.** The fix — if there is one — is a catalog or a floors decision,
not a resolver special-case.

**DECISION D — `worker/awards` stays a leaf; `lib/roulette` gains its first import.**
6.3 pinned `worker/awards` as importing nothing from `worker/ingest|store|db|config` and shipped
`TestPackageIsALeaf`. Nothing here changes that — under DECISION A there is no persistence, so the
`WAW --> WST` edge the spine draws (`ARCHITECTURE-SPINE.md:64`) stays unbuilt until the story that writes
rows. On the TS side the opposite happens: `stage2.ts` is the **first real import** in `lib/roulette`, and
`deferred-work.md:291` deferred a positive control for exactly this moment. Task 6 collects it.

### The seam you are extending — and the rule that governs it

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

`ARCHITECTURE-SPINE.md:73-76` is unchanged and still binding: *"there is **no dependency edge** between
`worker/*` and `app/`+`lib/`… The roulette **producer** (`worker/awards`) and **verifier**
(`lib/roulette`) each conform to `roulette/vectors` independently — **never to each other**."* Neither may
be "the reference implementation"; when they disagree the vector decides; when the vector is silent, add a
vector. This is why Task 2 precedes Task 4.

### The algorithm, transcribed (do not re-derive it from prose)

```
eligible(award, players) = [ p for p in players
                             if p.rounds_played >= award.floor_rounds
                            and p.kills         >= award.floor_kills
                            and not p.idle_dq ]        # iterate byte-lex on decimal steamid64

value(award, p) = p.stats_int.volume[award.deciding_stat]              if award.class == 'volume'
                = p.stats_int.rate[award.deciding_stat]  # {num,den}   if award.class == 'rate'

beats(award, p, q) = (volume) p > q                       for direction 'max';  p < q  for 'min'
                     (rate)   p.num*q.den > q.num*p.den   for direction 'max';  <      for 'min'
equal(award, p, q) = (volume) p == q
                     (rate)   p.num*q.den == q.num*p.den          # NOT (num==num and den==den)

resolve(award, players):
    validate(award)                                         # refuses BEFORE eligibility (see below)
    E = eligible(award, players)
    if E is empty:            return no_eligible_players
    best = { p in E : no q in E with beats(award, q, p) }   # a SET (S7) — never a running champion
    if class == 'volume' and direction == 'max' and value(award, best[0]) == 0:
                              return no_awardable_value(best)   # DECISION E — carries the SET
    if len(best) == 1:        return winner(best[0], value(award, best[0]))
    return tie(best, reason)                                # NEVER pick one. NEVER argmax.
```

⚠ **The two lines above marked `validate` and `no_awardable_value` were added by the code review**,
which found this "do not re-derive it from prose" block still describing the pre-DECISION-E shape
while all three implementations had moved on — the one place in the story a reader was most likely
to trust verbatim. `validate` refuses an empty `deciding_stat`, a `class` or `direction` outside its
closed set, and a negative floor, and it runs **before** eligibility so a malformed award refuses
whether or not anyone would have cleared its floors; that ordering is now shared contract in the
vector's `refusals` rather than two per-language lists.

Sources, in agreement: [SOLUTION-DESIGN.md §9.3](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L413) · [ARCHITECTURE-SPINE.md:219](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L219) · [epics.md:1068](_bmad-output/planning-artifacts/epics.md#L1068).

### The snapshot you read — the anti-reinvention map

`stat_snapshot_row` (captured by `lock_ceremony`, `0024:664-737`) is the **only** input. Per player:

| Field | Shape | Trap |
|---|---|---|
| `stats_int.volume` | 17 integer keys | `kills, deaths, assists, mvps, flash_assists, utility_damage, knife_kills, wallbang_kills, through_smoke_kills, no_scope_kills, blind_kills, entry_frags, opening_deaths, rounds_won, rounds_played, matches_played, hs_kills` — already `coalesce(NULL→0)` |
| `stats_int.rate` | `{num,den}` for `adr`, `kast_pct`, `hs_pct`, `entry_success` | **never** the pre-divided `numeric` columns; `den` can be `0` and that is **correct**, not a defect to coalesce away (`0024:690-691`) |
| `stats_int.secondary` | `volume ∥ rate` | 6.5's rung 1. Not yours. |
| `stats_int.efficiency` | every key as `{num,den}` via `snapshot_efficiency_form` | 6.5's rung 2. Not yours. |
| `h2h` | `{ "<opponent>": {volume ∪ rate} }` | ⚠ an **absent** opponent key is the *never-met* skip signal — *"never a zero, because a zero would silently become a real comparison"* (`0024:918-923`). 6.5's rung 3. |
| `achievement_ts` | epoch-ms integer, **sentinel `-1`** | 6.5's rung 4, and a **named blocker** there (`deferred-work.md:281`) |
| `rounds_played`, `kills`, `idle_dq` | your eligibility inputs | ⚠ snapshot `idle_dq` means **fully** DQ'd (≥1 approved row and *every* one idle); a rostered player with **zero** approved rows is `false` with zero stats — *"winless, not disqualified"* (`0024:909-916`) |

Rows are aggregated `order by p.steamid64 collate "C"` — that **is** AC1's byte-lex order, and `0024:545-547`
names it as *"Story 6.4's Stage-2 iteration order"*. Agree with it; do not invent a second ordering.

### Scope boundaries — hold these

**Build:** `worker/awards/stage2.go` + `stage2_test.go` · `lib/roulette/stage2.ts` + `stage2.test.ts` · `roulette/vectors/stage2-resolve.json` + the `generate_vectors.py` extension + the README ownership update · the import-ban positive control.

**Do NOT build** (each with its owner):
- **Stage 1, the weighted pick, `spin_plan`, `live_count`, gate 3** → **6-4b**. You are its dependency, not its author.
- **The FR-29 ladder** → **6.5**. You define and inject the port and ship a refusing implementation; the rungs, the secondary/efficiency keys, and the deterministic terminal rung are 6.5's — and rung 4 is a **named blocker** there, not a caveat.
- **Anti-sweep, `assigned_this_spin` removal, overflow re-resolution, `luck_weight_table`, `UNIQUE(spin_id, winner_entry_id)`** → **6.6**.
- **The pity draw** → **6.7**. `PITY_LABEL` already exists (6.3); the algorithm is not yours.
- **`spin` / `award_result` / `award_result_winner`, persistence, the reveal-gated RLS axis, `ceremony.state → 'spinning'`, the audit row, any admin route** → **6.8** (DECISION A). ⚠ Note `deferred-work.md:277` (the `ceremony.state` write-once gap) was homed to *"6.4 / 6.8"* **on the assumption 6.4 would need `UPDATE`** — under DECISION A it does not, so that item passes intact to 6.8. Say so in Completion Notes rather than leaving the box ambiguous.
- **RFC-8785 canonicalization, `bundle_sha256`, `algo_version` publication** → **6.9**. `algo_version` is fixed at `inclusivcup-roulette-1.0.0` and already corrected in the vector files by 6.3's review — carry it, do not redefine it.
- **Any UI, any wheel, any i18n string, any route.** `/ceremonia` stays the 5.7 `<Placeholder>`.
- **Any change to `public.leaderboard` or the `24`/`20` floor literals** (`0021:50-56`) — DECISION C.
- **Anything in `worker/ingest|store|db|config`** or `lib/bracket|awards|ceremony|steam|i18n`.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)); a test outside `lib/` silently does not run. Environment is `node`. **Measure the baseline before claiming a delta** — 6.3 post-review is **754 across 38 files**.
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./...`. Table-driven; `t.Errorf` over `t.Fatalf` in shared helpers so one failure does not mask the rest (`deferred-work.md:20`).
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe vector values into source.** Guard the loader against malformed rows.
- **Pinning tests** — extend 6.3's existing scans; the module-list assertion is exact-equality by design. Bans that must hold in the new modules: `server-only`, `node:`, `math/rand`, `Math.random`, `Date`, `toLocaleString`, `localeCompare`, `parseInt`, `**`, `fmt.Sprintf`, `float64`.
- **Mutation pass before review** — Task 6, non-optional, control-pass-first, restoration verified by **SHA-256**.
- **pgTAP** — untouched under DECISION A. Baseline **1155 across 25 files**; the stack is up for Task 5, so actually run it and close `deferred-work.md:293`.

### If DECISION A flips — the migration conventions you would need

Only read this if implementation forces SQL. `0025` is free. One migration per story, one pgTAP file per
migration (`supabase/tests/0025_<same_name>_test.sql`), explicit `plan(N)`. Never edit an applied
migration — copy a function body forward with `create or replace` plus the one delta. Every CHECK is
**named** (all raise 23514, so pgTAP asserts the name). RLS `enable` **and** `force`; a dormant
`<table>_admin_read … using ((select public.is_admin()))` policy; **no anon/authenticated grant of any
kind** — the reveal-gated widening is 6.8's opening to make. Access control is by **GRANT**, not policy
(`service_role` has BYPASSRLS). Functions are `security invoker` + `set search_path = ''` with
`revoke execute … from public; grant execute … to service_role;`. Every business refusal is
**RETURNED** as `{ok:false, reason, …}`, never raised — RAISE is reserved for mechanism-enforced
invariants (`IC901`–`IC908` taken; **`IC909` is next**). Guards before any write; ordered row locks in
canonical id order; exactly one `audit_log` row with `before`/`after` in `detail` (the action vocabulary is
uncapped `text` with no CHECK, so a new action needs no migration).

### Stack

Pinned and current; **nothing new is introduced or permitted**. Go `1.26.4` (`worker/go.mod`) — stdlib
only; `math/big` is stdlib and allowed for S4. Node ≥ 20.9 · TypeScript `^5.9` · Vitest `4.1.9` ·
Next.js `16.2.10`. `tsconfig` is `"target": "ES2022"` with `"lib": [… "esnext"]`, so **`BigInt` literals
are available**, and `"verbatimModuleSyntax": true` means every type-only import must be
`import type { … }`. **No new npm package and no new Go module.**

### Previous story intelligence — 6.3 (done, `3f7c98e`), 6.2 (`eed5318`), 6.1 (`01e3f5b`)

- **`npm test` does not typecheck.** 6.3's build caught a `Uint8Array<ArrayBufferLike>` vs `BufferSource`
  error that 704 green tests could not. Run `npm run build` before you believe the suite.
- **The doctrine that keeps producing findings: measure, never narrate.** 6.1 killed 3 of 12 awards by
  measuring. 6.2's review ran the clone probe AC4's own Given clause had named and found **six of
  seventeen volume keys are exact per-player clones** — so a *populated* deciding stat can still produce a
  whole-roster tie. Task 5 is that gate aimed at this resolver.
- **⚠ The author's own mutation table is not proof.** 6.2 reported 43/0; the reviewer's independent 6
  mutations produced **5 survivors**. 6.3's first table was structurally invalid and its honest re-run
  found **8 survivors** — including `x >= limit` → `x > limit` surviving the *entire* suite in both
  languages. Design Task 6 to find your equivalent; S7's running-max mutations are the obvious candidates.
- **`Object.freeze` is shallow** (6.1 shipped a "frozen" catalog of mutable entries). Deep-freeze and pin
  any constant `lib/roulette` exports.
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers.**
- **Gates at 6.3 sign-off (post-review):** lint 0 · Vitest **754 / 38 files** · build 0 · Go clean, `awards` **116** · `generate_vectors.py --check` OK · pgTAP **1155 / 25**.

### Inherited items this story is named in

| Item | Source | What 6-4a owes it |
|---|---|---|
| ⛔ **0/28 players clear the floors** | `deferred-work.md:269` (6.1 review) | Task 5 — measure against the real bracket shape; report, do not change `24`/`20` |
| **All-zero tie on the thin weird stats** | `deferred-work.md:270` (6.1 review) | Task 5 — report actual tie widths; evidence for Question 1 |
| **`El Inofensivo` `min` + kill floor** | `deferred-work.md:268` (6.1 review) | DECISION C — apply as written, measure the consequence |
| **TS import-ban tests assert over an empty list** | `deferred-work.md:291` (6.3 review) | Task 6 — add the positive control; `stage2.ts` is the first real import |
| **pgTAP 1155/25 rests on an unshown run** | `deferred-work.md:293` (6.3 review) | Task 7 — the stack is up for Task 5; actually run it |
| **`ceremony.state` immutable by convention only** | `deferred-work.md:277` (6.2 review) | Homed to *"6.4 / 6.8"* assuming 6.4 needs `UPDATE`. Under DECISION A it does not — record that it passes intact to **6.8** |
| **Epic-5 retro #3 / #5** | `epic-5-retro-2026-07-28.md:95,97` | Task 6 (author's half) and "every claim backed by printed output" |

### Git intelligence — recent commits

`3f7c98e` (6.3, PRNG + vectors) · `eed5318` (6.2, ceremony lock + snapshot) · `01e3f5b` (6.1, award catalog) · `64990db` (5.8) · `eb53260` (5.7). The arc through Epic 6: one story per layer, vectors as the shared contract, a BAR over the real seam, a mutation pass before review. 6.3 broke the "one migration per story" habit; **this story breaks it again for the same reason** — there is nothing to persist until the reveal axis exists — and keeps every other one.

## Project Structure Notes

```
worker/awards/stage2.go                       NEW   pure resolver + the ladder PORT
worker/awards/stage2_test.go                  NEW   table-driven + vector-driven
lib/roulette/stage2.ts                        NEW   mirror; NOT server-only; BigInt compare
lib/roulette/stage2.test.ts                   NEW   vector-driven
roulette/vectors/stage2-resolve.json          NEW   ties, min, zero-den, no-eligible
roulette/vectors/generate_vectors.py          UPDATE  produce + --check the new file
roulette/vectors/README.md                    UPDATE  ownership: 6-4a stage2; gate 3 → 6-4b
lib/roulette/prng.test.ts                     UPDATE  module list + the import-ban positive control
worker/awards/prng_test.go                    UPDATE  extend the banned-construct scan to stage2.go
_bmad-output/implementation-artifacts/sprint-status.yaml   UPDATE
```

No migration number is consumed under DECISION A; **`0025` stays free**. Naming follows the established
`lib/<domain>/<file>.ts` + `worker/<pkg>/<file>.go` layout. `roulette/` is already provisioned and is not
gitignored. `lib/roulette/**` must stay out of `app/` and must not acquire `server-only` — it ships to the
browser at 6.9.

## References

- Story ACs (Stage-2 half) — [epics.md:1066-1070](_bmad-output/planning-artifacts/epics.md#L1066)
- **AD-14** (deterministic, client-reproducible draw engine) — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145)
- **AD-15** (decide from the immutable snapshot) — `:150-153` · **AD-19** (integer-form contract) — `:170-173` · **AD-22** (reveal-gating, 6.8's) — `:185-188`
- **Provably-Fair contract surface** (Stage 2) — [ARCHITECTURE-SPINE.md:219](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L219)
- **The Stage-2 spec + build order + conformance gates** — [SOLUTION-DESIGN.md §9.3/§9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L413)
- **The no-edge rule** — [ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) · structural seed `:437-452`
- **FR-25** — [prd.md:354-361](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L354) · **FR-21** (floors) — `:314-321` · **FR-29** (ladder, 6.5's) — `:388-395` · SM-2 `:483` · SM-3 `:484` · SM-C1 `:493`
- *"luck is seeded and deterministic; winners are pure functions of the stat snapshot"* — [addendum.md:79-89](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md#L79)
- **Shared co-winner is a designed outcome, never an error state** — [EXPERIENCE.md:123](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L123)
- The snapshot payload you read — [0024_ceremony_lock_snapshot.sql:664-737](supabase/migrations/0024_ceremony_lock_snapshot.sql#L664); the meaning-changing comments `:909-923`; the byte-lex order note `:545-547`
- The award catalog — [0023_award_catalog.sql:63-156](supabase/migrations/0023_award_catalog.sql#L63) · [lib/awards/catalog.ts](lib/awards/catalog.ts) (the zero-value hand-off at `:132-137`)
- 6.3's primitives and conventions — [lib/roulette/prng.ts](lib/roulette/prng.ts) · [worker/awards/prng.go](worker/awards/prng.go) · [roulette/vectors/README.md](roulette/vectors/README.md)
- Prior story — [6-3-prng-core-hmac-sha256-counter-mode.md](_bmad-output/implementation-artifacts/6-3-prng-core-hmac-sha256-counter-mode.md)
- Inherited deferrals naming this story — [deferred-work.md:268-270, 277, 291, 293](_bmad-output/implementation-artifacts/deferred-work.md#L268) · the 6.5 rung-4 blocker `:281`
- Epic-5 retro Action Items #3, #5 — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95)

## Questions for Cuatro

Two remain; both have a recommendation and neither blocks Task 0/1. Answer before Task 2 fixes the vector in place.

1. **Is a deciding value of ZERO awardable?** 6.1's review measured players above zero as `knife_kills` **1/28**, `through_smoke_kills` **2/28**, `blind_kills` **3/28**. If the single knife-kill holder fails the floors, award #6 is a **27-way tie at zero** that walks the ladder to a roster-wide shared trophy. The catalog hands the question here by name — [lib/awards/catalog.ts:132-137](lib/awards/catalog.ts#L132): *"an all-zero field is a WHOLE-ROSTER TIE… **Whether a zero deciding value is awardable at all is a 6.4 / 6.5 question.**"* **Recommended: a zero deciding value is NOT awardable for a `max` volume award** — resolve to a typed no-winner outcome rather than a whole-roster co-win. Task 5 gives you the real numbers first; the engine is written either way once you decide.

2. **DECISION B — is the loud refusal on a tie the right call?** **Recommended: yes** — every alternative is a silent argmax that 6.5 will later contradict, changing the ceremony with nothing red. The cost is that the engine cannot run end-to-end until 6.5 lands, which matters only if you want a full dry run before then.

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5`) via `bmad-dev-story`, 2026-08-04. Baseline `3f7c98e`.

### Debug Log References

- Local stack: the DB container had exited (137/SIGKILL) and the volume was empty. Restarted in
  place (`docker start`), then rebuilt the corpus from the 14 real demos; `supabase db reset` before
  the pgTAP gate.
- Three harness defects were found and fixed *by their own guards* rather than by inspection, and
  each is worth carrying forward because each would otherwise have produced a confident lie:
  1. **The mutation harness silently failed to apply 12 of 18 Go mutations.** A first, aborted run
     had written `stage2.go` back through Python's `write_text`, which on Windows translates `\n` to
     `\r\n` — so every multi-line mutation anchor stopped matching. It was caught only because the
     harness reports `NOT-APPLIED` as a distinct outcome from `killed`. Fixed by reading and writing
     BYTES; the file was normalised back to LF and re-verified (`gofmt -l` clean).
  2. **The mutation harness measured a narrower thing than it claimed.** `-run TestVectorStage2Resolve`
     excluded `TestVectorStage2Refusals`, so three mutations read "vector blind" in Go while
     TypeScript killed all three from the same vector file. The two runners are now matched.
  3. **`supabase test db` failed 6/25 files on the first attempt** — every failure caused by the QA
     corpus this story had just seeded colliding with the suite's own fixtures (`0024` test 47:
     *"exactly ONE stat_snapshot exists"* → `have: 2`). Not a defect: the suite requires a clean DB.
     Re-run after `supabase db reset` → all green.

### Completion Notes List

#### The two open questions, answered by Cuatro (2026-08-04) before Task 2 fixed the vector

- **Q1 — is a deciding value of ZERO awardable? → NO, for a `max` VOLUME award.** Recorded here as
  **DECISION E**. Such an award returns a typed `no_awardable_value` rather than crowning a
  whole-roster co-win over a stat nobody scored on. **Scope is deliberately narrow:** `min` awards
  are untouched (fewest deaths is an achievement) and `rate` awards are untouched. The option to
  widen it to every `max` award was offered and declined. Both halves of the scope are pinned by
  their own vector rows (`volume-min-zero-is-awardable`, `rate-max-zero-numerator-is-awardable`), and
  mutation **M15** — widening the rule — is killed by the vector in both languages.
- **Q2 — DECISION B, the loud refusal on a tie? → YES, with no fallback ladder at all.** A
  clearly-marked dev-only fallback was offered and declined. `RefusingLadder` / `refusingLadder` is
  the only implementation either package exports.

#### DECISION A held — no SQL, and `0025` stays free

Nothing forced a migration. The ACs are entirely algorithmic and Stage 2 takes the award and the
players as arguments, so there is nothing to persist until 6.8's reveal axis exists. `supabase/**` is
proven byte-untouched below. ⚠ **`deferred-work.md:277` (`ceremony.state` write-once) passes intact
to 6.8** — it was homed to *"6.4 / 6.8"* on the assumption 6.4 would need `UPDATE`, and it does not.

#### ⛔ THE BAR (Task 5) — both runtimes over the REAL captured snapshot, mechanically diffed

The corpus was rebuilt from the 14 real `.dem.gz` through the REAL `ingest.DemoinfocsParser`, written
to `stat_row`, and captured by the REAL `lock_ceremony` RPC — so the aggregate comes from
`public.leaderboard` (AD-20's single normalization site) and is never hand-rolled. Two anchors prove
it is the same corpus 6.1/6.2 measured:

```
fair_seed = SHA-256(ziivanto-sosa.dem) = 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c
                                          ⭐ BYTE-IDENTICAL to the seed Story 6.2 froze
round counts 21+15+15+21+21+12+14+14+11+11+12+13+14+10 = 204   ⭐ 6.2's exact corpus
lock_ceremony(1, …) -> {"ok": true, "row_count": 28, "eligible_count": 0,
                        "content_sha256": "83a4077ef4d1f4f8e8c4170d01c157369e8203d4342faf921d4d024185d00c40"}
```
⚠ `content_sha256` differs from 6.2's `1a6868c8…` **correctly**: `achievement_ts` is wall-clock
approval time, so a re-ingest changes it. 6.2 recorded exactly this (`deferred-work.md:282`); the
digest is reproducible from the stored rows, never from the corpus.

**MECHANICAL DIFF — the headline.** Both runtimes wrote a 76-line transcript over 24 award
resolutions (12 shipped + 12 counterfactual). `Compare-Object` → **zero differing lines**; SHA-256 of
each file **identical**:

```
9E0E61C8B9642339CF8C8EF5F493CC31496895FB448759E5B93F6602DD3E37AE  transcript-go.txt
9E0E61C8B9642339CF8C8EF5F493CC31496895FB448759E5B93F6602DD3E37AE  transcript-ts.txt
```
Both read ONE catalog (`lib/awards/catalog.ts` via the real `toCuratePayload`) and ONE snapshot
export, so the twelve awards are not two hand-written lists.

**⛔ (a) THE FLOORS QUESTION — `deferred-work.md:269`, answered with numbers, literals untouched.**

```
rounds_played min=10 max=21 clearing_floor_rounds_24=0/28
kills         min=1  max=12 clearing_floor_kills_20=0/28
clearing BOTH floors=0/28   idle_dq=true count=0/28
```
**All twelve awards resolve to `no_eligible_players` on the real bracket shape.** The assumption is
now *tested*, and it fails: the corpus is a 28-player single round, so nobody accumulates 24 rounds.
The `24`/`20` literals were **not changed** (DECISION C) — this is a measurement handed on, not a fix.
The failure mode is exactly as predicted: silent, an empty award, no error anywhere.

**⛔ (b) THE ALL-ZERO TIE — `deferred-work.md:270`, measured, and DECISION E defuses it.**

```
thin=knife_kills          above_zero= 1 at_zero=27 outcome_if_holders_excluded=no_awardable_value would_have_tied=27
thin=through_smoke_kills  above_zero= 2 at_zero=26 outcome_if_holders_excluded=no_awardable_value would_have_tied=26
thin=blind_kills          above_zero= 3 at_zero=25 outcome_if_holders_excluded=no_awardable_value would_have_tied=25
thin=wallbang_kills       above_zero= 7 at_zero=21 outcome_if_holders_excluded=no_awardable_value would_have_tied=21
```
The 27-way tie 6.1's review predicted is **real and reproduced** — and DECISION E converts it into a
typed no-winner instead of a roster-wide trophy. Every per-key count reproduces 6.1/6.2 **exactly**
(knife 1/28 · smoke 2/28 · blind 3/28 · wallbang 7/28 · hs_kills 25/28 · utility 15/28 · the four
`MEASURED_EMPTY` keys 0/28). Nothing disagrees with a recorded measurement.

**⛔ (c) `El Inofensivo`'s inversion — `deferred-work.md:268`, printed rather than argued.**

```
adr_rank=01 player=76561198286758497 adr=329/10 kills=1 clears_floor_kills_20=false
adr_rank=02 player=76561199761222301 adr=400/11 kills=2 clears_floor_kills_20=false
adr_rank=03 player=76561198158667313 adr=518/12 kills=3 clears_floor_kills_20=false
adr_rank=04 player=76561198337771350 adr=628/14 kills=5 clears_floor_kills_20=false
adr_rank=05 player=76561199176839714 adr=683/15 kills=6 clears_floor_kills_20=false
adr_rank=24..28 (the five HIGHEST adr)                 kills=9,9,9,9,9
```
⭐ **The anti-qualification is measurable, not theoretical: the five least-harmful players hold 1, 2,
3, 5 and 6 kills while the five most-harmful all hold 9.** The kill floor is *positively correlated
with the very quality the award punishes*, so it excludes its own intended winner first. On this
corpus it admits 0/28 either way. Applied verbatim per DECISION C; the fix is a catalog or floors
decision for 6.5 / a later story, never a resolver special-case.

**(d) The counterfactual (floors forced to 0 — nothing in the repo changed).** Needed because pass (a)
returns `no_eligible_players` twelve times and therefore cannot exercise the resolver at all:

- **5 ties / 7 winners / 0 `no_awardable_value`.** Tie widths 3, 2, 3, 2, 3 — so ties are *common*, not
  exotic, which is direct evidence for 6-4b: the refusing port will fire often.
- **The refusing ladder fired on all 5 real ties** and was consulted on **none** of the 7 non-ties.
- ⭐ **A REAL-DATA EQUAL-CROSS-PRODUCT TIE WITH DIFFERENT PAIRS.** Award #03 `hs_pct` tied
  `1/1` vs `2/2` — the corpus's own instance of the vector's synthetic `3/6` vs `2/4` case. A
  `num === num && den === den` equality check misses it and silently crowns one of the two.
- **Award #06 `A Cuchillo` resolved to a WINNER at value 1** — the single knife-kill holder, once the
  floors admit them. DECISION E is therefore *not* reached at floors 0/0; it is reached only in the
  world where the holder is excluded, which (b) measures directly.

**(e) S3's zero denominator is UNREACHABLE on this corpus** — `den_zero=0/28` on all four rate keys
(`hs_pct` has `num_zero=3/28`). Recorded rather than assumed: the case is real per `0024:909-916` but
this corpus has no zero-approved-row player, so it is covered by the **vector** and by nothing else.

#### Task 6 — the mutation pass: 18 mutations × 2 languages, 0 survivors

Control-pass-first (all four runners GREEN before any mutation, or the run is void), restoration
verified by **SHA-256** against pre-run baselines because `git status` cannot see content changes it
considers untracked.

```
mutations=18  survivors=0  vector-blind=0  not-applied=0
M01 direction ignored          M07 floor_kills ignored        M13 ladder refusal SWALLOWED
M02 cross-multiply -> float    M08 idle_dq filter dropped     M14 DECISION E dropped
M03 cross-mult operands swapped M09 byte-lex -> NUMERIC sort  M15 DECISION E widened (its SCOPE)
M04 running max on `>`         M10 sort removed entirely      M16 negative denominator accepted
M05 running max on `>=`        M11 tie -> first tied player   M17 absent key reads as ZERO
M06 floors `>=` -> `>`         M12 no_eligible -> zero winner M18 duplicate steamid64 accepted
stage2.go 97340dd6fa347f3a0764b951d2b876111edd600ecfb94f2e99240f3241ec7aec  MATCHES BASELINE
stage2.ts 6ab5047aeed76b502a98fe2b5408936bdd57a55a52c4c6048f1f637bcf9f86f1  MATCHES BASELINE
```
⭐ **Every one is killed by the VECTOR-DRIVEN test in isolation, not merely by the full suite.** M13
only became vector-killable after the conformance gate was extended to drive `ResolveAward` with the
refusing ladder on *every* tie row — before that it reddened one hand-written local case, which is
precisely the "the vector does not cover it" signal the story told me to fix in the vector.

#### The 6.3 deferral this story was named in — closed differently than expected, and more strongly

`deferred-work.md:291`: three of the four TS import-ban tests assert over an **empty** list, and the
expected closure was *"6.4 will bring the first real import"*. **It did not, and that is recorded
rather than papered over:** Stage 2 shares nothing with the PRNG — no seed, no stream, no labels — so
`stage2.ts` legitimately imports nothing either, and manufacturing an import purely to make a test
non-vacuous would be the tail wagging the dog. Closed instead by proving each ban **fires** on a
violating source (`server-only`, `node:crypto`, `@supabase/supabase-js`, plus a relative-import
control so the ban is not simply refusing everything). A real import would only have shown the list
is non-empty; this shows the predicate discriminates, which is what those three tests claim. A fifth
test records that every shipped module currently imports nothing, so the day that changes it reddens
deliberately instead of drifting.

#### Design notes a reviewer should know

- **`ResolveStage2` is exported alongside `ResolveAward`.** The story named `ResolveAward(award,
  players, ladder)`; both ship. The pure stage exists because 6-4b needs the raw outcome — a tied
  award has no single `provisional_winner` and Stage 1 must SEE that rather than be handed a ladder's
  answer or a refusal it cannot inspect. The vector drives the pure stage; the ladder seam is
  exercised on every tie row on top of it.
- **The `Ladder` port returns an `Outcome`, not a winner.** What a ladder-resolved award looks like is
  6.5's design; returning the whole outcome avoids inventing a field for a story that has not made
  its decisions. Go returns `(Outcome, error)`; TS throws `LadderRefusedError` **carrying the tie on
  the error**, which is the faithful mirror of Go returning both.
- **TS models `Outcome` as a discriminated union** where Go uses a flat struct-with-kind. That makes
  "a tie that also names a winner" *unrepresentable* in TS where Go can only test for it. Both project
  onto the same vector JSON, which is the contract they actually share.
- **A new shared refusal, added to the vector rather than to one language:** a **negative denominator**
  silently inverts cross-multiplication (`a.num*b.den > b.num*a.den` is only the right test while both
  denominators are non-negative). Unreachable from a real snapshot — every half is a count and 0024
  coalesces to 0 — which is exactly why it is loud rather than trusted. `den == 0` stays legal (S3).
- **`math/big`'s package ban is SCOPED, not relaxed.** In the PRNG files `n ≤ 2^32` bounds `256^k`
  inside a `uint64` by construction, so reaching for `math/big` there would mean the bound had been
  abandoned. Stage 2's operands are unbounded snapshot magnitudes and its cross-products are their
  *product*. The ban is now an exception list (`exceptIn: ["stage2.go"]`) so a file added later is
  banned by default, and `TestScannedSourceFilesAreExactlyTheShippedModules` pins the file set so the
  exception cannot quietly widen. Four new needles were added at the same time — `big.Float`,
  `.Int64()`, `.Uint64()`, `.Float64()` — because importing `math/big` and then leaving its range is
  the same defect as never importing it.
- ⭐ **The search for a cross-multiplication-only rate case IS a finding.** Task 2 required a pair the
  naive `num/den` float compare gets *backwards*. **At or below 2^53 that is impossible:** both
  operands are exact doubles and IEEE-754 division is correctly rounded, so `a/b > c/d` implies
  `fl(a/b) ≥ fl(c/d)` — a float compare can only collapse a winner into a false tie, never swap the
  two. A real inversion therefore *requires* operands past 2^53. The vector uses
  `(2^53+1)/(2^53+2)` vs `2^53/(2^53+1)`: exactly, the first is larger (cross-products differ by ONE
  in ~2^106); as doubles, `2^53+1` rounds to `2^53` in both fractions, so the float compare picks the
  **other** player. In JavaScript the corruption happens at `JSON.parse`, before any arithmetic —
  which is why every magnitude in `stage2-resolve.json` is a decimal **string**. The coverage test
  recomputes every rate case the naive way and *asserts* that some pair disagrees, so the case cannot
  be deleted silently.
- **Byte-lex vs numeric sort needs short synthetic ids.** Every real SteamID64 is 17 digits, so the
  two orders agree on every other row in the file; only `"9"`, `"10"`, `"100"` can tell them apart.
  `validSteamID64` accepts `^[0-9]+$` rather than a 17-digit shape for that reason (and because the
  column is `text` and this is a resolver, not a SteamID64 validator).

#### Gates — measured, not quoted

| Gate | Baseline (`3f7c98e`) | This story |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | **754 / 38 files** (measured by moving 6-4a's files aside, restore SHA-256-verified) | **854 / 39 files** (+100) |
| `npm run build` | 0 | **0** — all viewer routes still `ƒ` dynamic, no `roulette` route |
| `go build ./... && go vet ./... && go test ./...` | clean, `awards` 116 | **clean, `awards` 206** (+90) |
| `generate_vectors.py --check` | OK ×2 | **OK ×3** (both 6.3 files reproduce byte-for-byte) |
| pgTAP | 1155 / 25 (unshown at 6.3) | **1155 / 25 PASS — actually run, closing `deferred-work.md:293`** |

`go build ./... && go vet ./... && go test ./...` was proven clean **with** `worker/cmd/qa64a`
present *and* after its removal. `worker/cmd/qa54` is untouched — still not mine to delete, and no
second orphan was added.

**Byte-untouched proof.** `git diff --stat HEAD -- supabase/ app/ lib/awards/ lib/ceremony/ lib/i18n/
lib/bracket/ worker/ingest/ worker/store/ worker/db/ worker/config/` → **empty**. No migration; `0025`
stays free. `/ceremonia` is still the 5.7 `<Placeholder>`.

#### Hand-offs

- **6-4b** — `provisional_winner` is `ResolveStage2` / `resolveStage2`. **Ties are common on real
  data** (5 of 12 awards in the counterfactual, widths 2–3), so the refusing port will fire often and
  Stage 1 must not invent a fallback. The `Outcome` shape is the seam; `KindTie` carries the full set.
- **6.5** — the ladder port is defined and injected in both languages; replace `RefusingLadder` /
  `refusingLadder`. The rung-4 blocker (`deferred-work.md:281`) is untouched and still named. Note the
  measured tie shapes it must actually break: two equal-integer ties of width 3, one of width 2, and
  an `equal_cross_product` tie between `1/1` and `2/2`.
- **6.8** — `deferred-work.md:277` (`ceremony.state` write-once) passes to you intact; 6.4 needed no
  `UPDATE`.
- **A floors decision is now owed by someone.** 0/28 is measured, not assumed. It is a catalog/floors
  call, not a resolver change.

### File List

**New**
- `worker/awards/stage2.go`
- `worker/awards/stage2_test.go`
- `lib/roulette/stage2.ts`
- `lib/roulette/stage2.test.ts`
- `roulette/vectors/stage2-resolve.json`

**Modified**
- `roulette/vectors/generate_vectors.py` (the Stage-2 spec implementation, 25 cases + 13 refusals, and `--check` over the third file)
- `roulette/vectors/README.md` (ownership table: 6-4a owns the Stage-2 vector, gate 3 → 6-4b; the `stage2-resolve.json` format section; the decimal-string rule; the anchoring note)
- `worker/awards/prng_test.go` (scoped the `math/big` ban, four new banned needles, the exact shipped-file-set assertion)
- `lib/roulette/prng.test.ts` (module list → `['labels.ts', 'prng.ts', 'stage2.ts']`; the import-ban positive control)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-4a-stage-2-deterministic-winner-and-tie-detection.md`

**Created and deleted before commit** (throwaway, per the established pattern; `go build`/`vet`/`test`
proven clean while present and after removal)
- `worker/cmd/qa64a/main.go` — the Task-5 capture + resolve harness
- `lib/roulette/bar-qa64a.test.ts` — the TS half of THE BAR (a Vitest file because `lib/awards/catalog.ts` is `server-only` and Vitest is the only runner with the stub alias, so it is the only way to read the SHIPPED catalog constant rather than restating it)
- `_qa64a/` — `mutate.py`, `baseline.py`, `snapshot.json`, `awards.json`, both transcripts

### Change Log

| Date | Change |
|---|---|
| 2026-08-04 | **Story 6-4a IMPLEMENTED → review.** Stage 2 ships in both languages as a pure, integer-only, randomness-free resolver over the frozen snapshot, gated by a new shared golden vector (`stage2-resolve.json`, 25 cases + 13 refusals) generated by the committed third implementation. Cuatro answered both open questions before Task 2: **DECISION E** — a `max` VOLUME award whose best value is 0 has NO winner (`min` and `rate` deliberately untouched, both halves vector-pinned); **DECISION B confirmed** — a tie returns the full byte-lex set and the injected ladder port refuses loudly naming 6.5, with no fallback. DECISION A held: no SQL, `0025` stays free, and `deferred-work.md:277` passes intact to 6.8. **THE BAR** rebuilt the real 14-demo corpus through the REAL parser and the REAL `lock_ceremony` (fair_seed byte-identical to 6.2's, 204 rounds, 28 rows) and drove both runtimes over it — **76-line transcripts, byte-identical, SHA-256 `9e0e61c8…`, zero differing lines**. It answered all three inherited ⛔ items with numbers and changed no literal: **0/28 clear either floor** so all twelve awards are `no_eligible_players` on the real bracket shape; the **27-way all-zero tie is real** and DECISION E converts it to a typed no-winner (widths 27/26/25/21); and **`El Inofensivo`'s kill floor is measurably anti-qualifying** — the five lowest-ADR players hold 1/2/3/5/6 kills while the five highest all hold 9. The counterfactual pass found ties are COMMON (5 of 12, widths 2–3) including a real-data `equal_cross_product` tie of `1/1` vs `2/2`, evidence handed to 6-4b and 6.5. Mutation pass **18 × 2 languages, 0 survivors, 0 vector-blind**, control-green-first and restoration SHA-256-verified — its own guards caught two harness defects (12 Go mutations silently not applied after a CRLF round-trip; a Go `-run` filter that excluded the refusal tests) that would otherwise have read as passes. Closed `deferred-work.md:291` more strongly than asked — `stage2.ts` legitimately has no import, so the import bans are now proven to FIRE on violating sources rather than merely made non-empty — and closed `deferred-work.md:293` by actually running pgTAP (**1155 / 25 PASS**). Gates: lint 0 · Vitest **854 / 39** (baseline **measured** at 754 / 38) · build 0 with every viewer route still `ƒ` dynamic and no `roulette` route · Go clean, `awards` **206** · `generate_vectors.py --check` OK on all three · `supabase/**`, `app/**`, `lib/awards|ceremony|i18n|bracket/**` and `worker/ingest|store|db|config` byte-untouched. |
| 2026-08-04 | **Code review — 20 patches applied, story → done.** Three parallel layers (Blind Hunter / Edge-Case Hunter / Acceptance Auditor, all Opus 5) over the working-tree diff produced 25 findings after dedup: **3 decision-needed, 17 patch, 2 deferred, 3 dismissed**. All three layers independently landed on the same headline: **the vector's own coverage guards were satisfied by rows unrelated to the property they name.** `sawFloatDivergence` was flipped by the `0/0` vs `10/5` row (the naive helper returns 0 for a zero denominator, so exact and naive "disagreed" for a reason with nothing to do with precision), which meant `rate-max-cross-multiplication-only` — the (2^53+1)/(2^53+2) row these notes call the headline finding — could be deleted with every gate green; `sawFloorBoundary` only ever looked at the ROUNDS floor while claiming to cover `>=` vs `>`; and neither suite pinned the case-name set, so five DECISION-E scope rows could vanish with all twelve flags still satisfied. All three are now fixed at the guard (eligible players + non-zero denominators; a separate `sawKillsFloorEdge`; the 28-name set pinned by exact equality in both suites). **Cuatro resolved the three decisions:** (1) DECISION E's carve-out is now recorded in **AD-14, epics.md:1070 and SOLUTION-DESIGN §9.3** — which all still said every equal value MUST enter the ladder — and `no_awardable_value` **carries the suppressed byte-lex set** so 6.5 / 6.6 / 6.7 can read the width of the tie that never formed; (2) den-0 keeps its verbatim total-order semantics and both consequences are now vector rows rather than remarks — an ELIGIBLE `0/0` player under the REAL 24/20 floors (reachable because `entry_success`'s denominator has no volume counterpart) and `n/0` with `n>0` behaving as +infinity; (3) **AD-19's "real captured snapshot" clause is scoped to 6.11's end-to-end vector**, since a stage vector needs shapes no corpus produces. The third implementation gained the `validate_award` it never had — until now its refusal surface was strictly SMALLER than both runtimes' (`direction: "highest"` silently resolved as `min`), so three refusals lived in two hand-written per-language lists; they are shared contract now. Cross-language divergences closed: Go panicked on a mixed-class compare where TS refused; Go's nil-ladder guard missed a TYPED nil; Go returned ALIASED `*big.Int`s from the caller's snapshot where TS returns immutable `bigint`; Go's refusals were untyped so the gate could only assert "some error" (now `ErrStage2`); TS threw a bare `TypeError` on a null roster where Go returned a typed outcome; the two loaders disagreed on `"+5"`; TS's conformance switch had no final arm; and Go asserted neither the tie's empty deciding value nor the deciding value under permutation. `--check` now compares BYTES — it normalised CRLF, the same round-trip that silently unapplied 12 Go mutation anchors during Task 6. Vector: **28 cases + 16 refusals** (from 25 + 13). Gates re-measured after the patches: lint **0** · Vitest **873 / 39 files** (from 854) · build **0**, every viewer route still `ƒ` dynamic and no `roulette` route · Go clean, `awards` **222** (from 206) · `generate_vectors.py --check` **OK on all three** (both 6.3 files still reproduce byte-for-byte) · `supabase/**`, `app/**`, `lib/awards|ceremony|i18n|bracket/**` and `worker/ingest|store|db|config` still **byte-untouched**; `0025` still free. Two items deferred to 6.11 (nothing automatically runs `--check`; the anchor's independence is weaker than AC3 claims — its prose is verbatim identical to both implementations). |

### Review Findings

_Code review, 2026-08-04, baseline `3f7c98e`. Three parallel layers at Opus 5 (Blind Hunter — diff only, no
project access · Edge-Case Hunter — diff + project · Acceptance Auditor — diff + spec + architecture) over
the working-tree diff. `roulette/vectors/stage2-resolve.json` (3,654 lines of generated data) was excluded
from the reviewed diff by agreement and read from the tree instead. 25 findings after dedup: 3
decision-needed, 17 patch, 2 deferred, 3 dismissed as noise. All three layers independently landed on the
same top finding (the vacuous `sawFloatDivergence` guard) and on the Python anchor's missing award
validation, and every high-severity claim below was re-verified against the source by the reviewer before
being written here._

**The headline: the coverage guards that were supposed to stop the interesting vector rows from
disappearing do not do it.** The story's own doctrine — "every mutation must redden the VECTOR-driven test"
— is sound and the mutation table is credible, but two of the twelve guards protecting the vector are
satisfied by rows unrelated to the property they name, so the 18x2 / 0-survivors result is measuring a
weaker artifact than it claims.

- [x] [Review][Patch] **DECISION E discards the tie before it is formed, and no architecture artifact records the carve-out** — ⭐ **RESOLVED (Cuatro, 2026-08-04): amend the docs AND carry the tied set.** Patch AD-14 (`ARCHITECTURE-SPINE.md:148`), `epics.md:1070` and SOLUTION-DESIGN §9.3 to record DECISION E as an explicit, named exception to *"an equal deciding-stat value MUST enter the FR-29 ladder"*, **and** add the tied set to the `no_awardable_value` outcome in all three implementations so 6.5 / 6.6 / 6.7 can still see the width of the tie that was discarded. Requires a vector regeneration (`volume-max-all-zero-no-awardable-value` gains the four tied ids) and a `--check` pass. The `algo_version` sub-call rides along: nothing is published, so `inclusivcup-roulette-1.0.0` stands — record that as the decision rather than leaving it silent. Original finding: `worker/awards/stage2.go:305` and `lib/roulette/stage2.ts:316` place the zero check BEFORE the `len(best) == 1` branch, so a `max` volume award on which N eligible players share a best value of 0 never becomes a `tie` and the tied set is discarded. The vector proves it is live: `volume-max-all-zero-no-awardable-value` has FOUR eligible players and returns `no_awardable_value`. This is exactly what Cuatro decided (Q1) and the comment says so explicitly ("a rule about the VALUE, not the tie width") — but AD-14 (`ARCHITECTURE-SPINE.md:148`), AC2, `epics.md:1070` and SOLUTION-DESIGN §9.3 all still state the un-carved-out rule *"an equal deciding-stat value is a tie and MUST enter the FR-29 ladder"*, and none was amended. Consequences: 6.5 reading AD-14 will build ladder handling for the 27-way zero tie that can now never reach it (the exact shape `deferred-work.md:270` predicted), and 6.6's anti-sweep and 6.7's pity lose the tied-set width entirely because `no_awardable_value` carries no `tied` field. Three sub-calls: (a) amend AD-14/epics/SOLUTION-DESIGN to record DECISION E, or leave the code as the only record; (b) should `no_awardable_value` carry the tied set so downstream stories can see the width; (c) `algo_version` stays `inclusivcup-roulette-1.0.0` despite `ARCHITECTURE-SPINE.md:222` requiring a MAJOR bump on any outcome-affecting change — defensible only while nothing is published, but it should be a decision rather than an oversight. [auditor]
- [x] [Review][Patch] **What a zero denominator MEANS for a rate award was never decided — only that it must not crash** — ⭐ **RESOLVED (Cuatro, 2026-08-04): keep the total-order semantics, vectorize both halves.** The arithmetic is faithful cross-multiplication and does not change; what changes is that both consequences stop being merely reachable and become pinned. Add two vector rows: an **eligible** den-0 player under a **real (non-zero) floor** — reachable because `entry_success`'s denominator has no volume counterpart, so a player can clear both floors with `entry_opportunities = 0` — and an **`n/0` with `n > 0`** case proving it beats every finite rate. Extend the S3 comment in all three implementations to state both consequences explicitly, since today it reasons only about `0/0` tying. Original finding: S3 reasoned exclusively about two `0/0` players comparing equal. Two consequences of cross-multiplication were never chosen: (a) `0/0` compares EQUAL to every value (`0*q.den = 0 = q.num*0`), so a data-less player is unbeatable and always lands in `best` — with A=`0/0`, B=`10/5`, C=`6/5` and floors 0/0, B strictly beats C, A ties both, `best = {A,B}` → tie → the refusing ladder → the whole resolution errors out. A player with no data converts a clean, unambiguous win into a ceremony-halting refusal. (b) `n/0` with `n > 0` beats EVERY finite rate at any magnitude (`1*30 = 30 > 9999*0 = 0`), and is crowned winner with `deciding_value = 1/0` — which the UI must then render. Every den-0 row in the vector uses `num = 0`, so half the legal-den-0 rule is unvectorized in all three implementations. Reachability is not theoretical: the generator's own `_p` docstring records that `entry_success`'s denominator has NO volume counterpart, so a player can clear both floors with `entry_opportunities = 0`; THE BAR measured `den_zero = 0/28` on this corpus only. Options: treat den-0 as ineligible-for-this-award (a typed exclusion, not a silent filter), keep the current total-order semantics and vectorize both halves, or define `0/0` as a distinguished bottom. [blind + edge]
- [x] [Review][Patch] **AD-19 requires the golden vector be projected from a REAL captured snapshot; `stage2-resolve.json` is entirely synthetic** — ⭐ **RESOLVED (Cuatro, 2026-08-04): scope AD-19's "real" clause to 6.11's end-to-end vector.** Amend AD-19 (`ARCHITECTURE-SPINE.md:173`) so the real-snapshot-projection requirement binds the **end-to-end ceremony vector** rather than every unit-level conformance vector, and say why: a Stage-2 resolver vector needs synthetic edge shapes no real corpus produces (operands past 2^53, zero denominators, short ids that separate byte-lex from numeric order). 6.11 already inherits `deferred-work.md:288` for the identical gap, so this consolidates rather than creates an obligation. Note in the amendment that the capture SHAPE is still tested — by 6.2's pgTAP and by 6.11 — just not here. Original finding: AD-19 (`ARCHITECTURE-SPINE.md:173`, on this story's own Traces line) reads: *"A golden conformance vector MUST be projected from a **real** captured snapshot, not a synthetic one, so the capture shape itself is tested."* The shipped file carries six volume keys (`deaths, hs_kills, kills, knife_kills, rounds_played, utility_damage`) against AD-19's seventeen, and no `secondary` / `efficiency` / `h2h` / `achievement_ts` at all. The only artifacts that touched the real capture shape — `worker/cmd/qa64a`, `lib/roulette/bar-qa64a.test.ts`, `_qa64a/` and the two transcripts hashed `9e0e61c8…` — were deleted before commit per Task 5's own instruction, so THE BAR's cross-runtime equivalence claim is ungated in the tree, repeating `deferred-work.md:288` (6.3's identical finding) rather than closing it. Options: project one real-snapshot-shaped case into the vector; formally scope AD-19's "real" requirement to 6.11's end-to-end vector only; or record an explicit, named deviation. [auditor]
- [x] [Review][Patch] The `sawFloatDivergence` coverage guard is satisfied by the zero-denominator rows, so the 2^53 cross-multiplication row it exists to protect can be deleted with every gate green [worker/awards/stage2_test.go:359, lib/roulette/stage2.test.ts:254] — `naiveFloatSign`/`naiveQuotient` return `0` when `d == 0`, so on `rate-zero-denominator-is-equal-to-everyone` (A `0/0`, B `10/5`) exact gives `0` and naive gives `-1`: they disagree for a reason that has nothing to do with precision. Delete `rate-max-cross-multiplication-only` — the `(2^53+1)/(2^53+2)` row the Completion Notes call the story's headline finding — regenerate, and both suites stay green. Fix: require the divergent pair to have both denominators non-zero, and scan the ELIGIBLE players rather than every row. [blind + edge]
- [x] [Review][Patch] Neither suite pins the vector's case-name set, so five rows can vanish while all twelve coverage flags stay green [worker/awards/stage2_test.go:137, lib/roulette/stage2.test.ts:132] — the loaders assert only `len(cases) == 0` / `toBeGreaterThan(0)`. Deleting `volume-min-zero-is-awardable`, `rate-max-zero-numerator-is-awardable`, `volume-max-single-eligible-at-zero-no-awardable-value`, `volume-max-nonzero-best-over-zeros` and `an-absent-key-on-an-INELIGIBLE-player-is-not-an-error` leaves every flag satisfied by surviving rows and `--check` reporting OK — i.e. DECISION E's entire SCOPE becomes untested, which is the one claim the code comments make about the vector. `outcome_kinds` and `tie_reasons` are already pinned by exact equality; do the same for the case names, mirroring `TestScannedSourceFilesAreExactlyTheShippedModules`. [edge]
- [x] [Review][Patch] The `sawFloorBoundary` guard only ever looks at the ROUNDS floor, and is satisfied by incidental rows [worker/awards/stage2_test.go:331, lib/roulette/stage2.test.ts:231] — the message claims it covers `>=` vs `>`, but `floor_kills` has no boundary guard at all, so editing `floors-are-inclusive-at-the-boundary`'s A from `kills=20` to `kills=25` lets `kills >= floorKills` → `>` survive the whole vector. The rounds half is also satisfiable by `rate-max-realistic-adr` and `rate-min-el-inofensivo` alone, so the row engineered for it can be deleted silently. Add a `sawKillsFloorBoundary` flag and require both. [blind + auditor]
- [x] [Review][Patch] The Python anchor has no `validate_award`, so three refusals both runtimes enforce are structurally inexpressible in the shared vector [roulette/vectors/generate_vectors.py:459, 418] — Go (`stage2.go:468-481`) and TS (`stage2.ts:478`) refuse an empty `deciding_stat`, a `direction` outside `{max,min}`, a `class` outside `{volume,rate}` and a negative floor, all BEFORE eligibility. `_beats` is `return c > 0 if award["direction"] == "max" else c < 0` — any direction that is not exactly `"max"` is silently treated as `min`, so `_award("kills","volume","highest",0,0)` yields a WINNER from the anchor and an ERROR from both runtimes; a bad class with an empty eligible set returns `no_eligible_players` from the anchor and an error from both runtimes; a negative floor resolves. `build_stage2_file` raises if a refusal row fails to refuse, so those rows CANNOT be added to `STAGE2_REFUSALS` — the refusals therefore live in two independently hand-written per-language lists, already asymmetric (TS tests a non-integer floor, Go does not), which is precisely the drift the shared refusals list was added to prevent. Fix: give the generator a `validate_award` mirroring the two runtimes' checks and ordering, then add the three refusal rows. [blind + edge + auditor]
- [x] [Review][Patch] The "total preorder" justification at the empty-best-set guard is false, and the vector file carries the counterexample [worker/awards/stage2.go:284, lib/roulette/stage2.ts:296, roulette/vectors/generate_vectors.py:474] — *"with non-negative denominators the comparator is a total preorder"* is wrong: `0/0` compares equal to everything, so indifference is not transitive (`cmp(A,B)=0`, `cmp(A,C)=0`, `cmp(B,C)=20`). The guard itself is still correct — no strict cycle is constructible over non-negative pairs — but its stated reason is the only documentation of WHY it is unreachable, and a future reader will simplify against it. The wrong sentence is verbatim in all three implementations; fix all three. [blind + auditor]
- [x] [Review][Patch] Go panics where TypeScript refuses, on the same "unreachable" mixed-class comparison [worker/awards/stage2.go:361] — TS ends `compareValues` with `throw new Stage2Error('cannot compare a volume value with a rate value')`; Go takes the class from the award and dereferences unconditionally, so a `DecidingValue{Class: ClassRate}` passed under `ClassVolume` is a nil-pointer panic that takes down the worker rather than a typed refusal. Same defect class the story already fixed once in `mustBig` ("a malformed row PANICKING the whole binary instead of failing one named test"), re-introduced in the production path. [blind]
- [x] [Review][Patch] Go's `ladder == nil` guard does not catch a typed-nil interface [worker/awards/stage2.go:220] — `var l *spyLadder; ResolveAward(award, tiedPlayers, l)` passes the guard (non-nil interface, nil value) and panics on the tie path instead of returning the documented refusal. TS's guard is structural (`typeof ladder.resolve !== 'function'`) and rejects `{}`, `null`, `undefined` and `'ladder'`, so the two guards are not equivalent at the seam 6-4b and 6.5 both inherit. `TestResolveAwardRefusesANilLadder` passes an untyped `nil` only. [edge]
- [x] [Review][Patch] A nil/null player list is a typed outcome in Go and a bare `TypeError` in TypeScript [worker/awards/stage2.go:411, lib/roulette/stage2.ts:426] — `ResolveStage2(award, nil)` returns `{Kind: no_eligible_players}`; `resolveStage2(award, null)` throws `TypeError: players is not iterable` from the spread, not a `Stage2Error`. Same asymmetry for a null element: TS dereferences `p.steamid64` before the `typeof` guard on line 433 can fire, while Go's zero-value struct reaches the typed refusal. The module's own doctrine (`stage2.ts:171-181`) is that a bare built-in throw is indistinguishable from the module's guard. [edge]
- [x] [Review][Patch] Go returns an ALIASED `*big.Int` from the caller's snapshot; TypeScript returns an immutable `bigint` [worker/awards/stage2.go:385, 405] — `decidingValue` hands back `p.Volume[stat]` / `pair.Num` / `pair.Den` by pointer, and `eligiblePlayers` copies the slice but not the values or maps. A 6.8 persistence step normalizing a value in place mutates a previously-returned Outcome retroactively, and the frozen snapshot with it. `TestResolveStage2DoesNotMutateTheCallerSlice` checks only slice ORDER. Fix: `new(big.Int).Set(v)`. Producer-only divergence — invisible to the shared vector, which is exactly the class this directory exists to catch. [blind + edge]
- [x] [Review][Patch] The TypeScript conformance gate has no final arm for an unknown outcome kind, and never asserts a no-winner outcome is residue-free [lib/roulette/stage2.test.ts:140-169] — Go ends its switch with `t.Fatalf("the vector declares an outcome kind this suite does not check: %q", …)`; TS is `if winner … else if tie …` with nothing after it, so a future fifth kind would be gated in one language only, and a `no_eligible_players` / `no_awardable_value` outcome carrying a stray `steamid64` or `tied` passes. [blind + auditor]
- [x] [Review][Patch] The Go tie branch never asserts `DecidingValue` is empty [worker/awards/stage2_test.go:171-194] — the winner branch checks for tie residue (`len(got.Tied) != 0 || got.Reason != ""`), but the tie branch checks only `got.SteamID64 != ""`. A resolver that populated `DecidingValue` from `values[best[0]]` on the tie path — leaking "the winning value" of an UNRESOLVED tie into 6.5's input — reddens nothing. TS makes it unrepresentable via the discriminated union, so this is a Go-only hole. [blind]
- [x] [Review][Patch] Go's permutation-invariance test ignores `DecidingValue`; TypeScript's `toEqual` does not [worker/awards/stage2_test.go:482] — Go compares `Kind`, `SteamID64`, `Reason` and the joined `Tied` only. A mutation making the reported deciding value depend on input order (`values[0]` instead of `values[bestIndex]` — they coincide whenever the winner is byte-lex first, which is true in several vector cases) is killed by the TS permutation test and SURVIVES the Go one. Asymmetric mutation coverage between two suites that are supposed to be mirrors. [blind]
- [x] [Review][Patch] The two vector loaders disagree on what a valid magnitude string is [worker/awards/stage2_test.go:86, lib/roulette/stage2.test.ts:86] — Go's `big.Int.SetString(s, 10)` accepts a leading `+`; the TS regex `/^-?[0-9]+$/` does not. The TS comment explicitly claims parity with Go's parser, and for `"+5"` it is Go that is the lenient one: the file loads in Go and hard-fails in TS. The guard is exactly the drift-detector that is supposed to be reachable, so make both loaders accept the same string set. [blind + edge]
- [x] [Review][Patch] Go's refusal gate asserts only "some error", so a refusal row that fails for the WRONG reason still passes [worker/awards/stage2_test.go:641] — TS asserts `toThrow(Stage2Error)`; Go has no typed error at all (every refusal is a bare `fmt.Errorf`), so `err == nil` is the only discriminator. Under a mutation that makes `validateAward` reject everything, all 13 refusal rows still pass. Add a sentinel or typed error mirroring `Stage2Error`. [edge]
- [x] [Review][Patch] `--check` normalizes line endings, so a CRLF-rewritten vector reports OK [roulette/vectors/generate_vectors.py:1188] — `path.read_text(encoding="utf-8")` opens with universal newlines and translates `\r\n` → `\n` on read, while the write path pins `newline="\n"`. On this Windows repo a checkout that rewrites `stage2-resolve.json` to CRLF compares EQUAL. This is the same CRLF round-trip class that silently unapplied 12 Go mutation anchors during Task 6 — recorded in the story's own Debug Log. Fix: `read_bytes()` vs `want.encode("utf-8")`, so "regenerate and byte-compare" is actually byte-exact. [edge]
- [x] [Review][Patch] "An absent deciding key on an INELIGIBLE player is not an error" is pinned for the volume arm only [roulette/vectors/generate_vectors.py:938] — `_p(...)` has a `drop_volume` parameter and no `drop_rate`, and every fixture materializes all four rate keys, so the "read only the eligible" property (`stage2.go:257`, `stage2.ts:274`) is proven for volume and unproven for rate. A mutation hoisting the rate-arm value read above the eligibility filter reddens nothing in either language. [edge]
- [x] [Review][Patch] The story file documents the inherited `Outcome` seam two contradictory ways [_bmad-output/implementation-artifacts/6-4a-stage-2-deterministic-winner-and-tie-detection.md:93, 203-208] — Task 3's ⭐ bullet ("the `Outcome` shape is the seam 6-4b, 6.5 and 6.8 all inherit — get it right once") enumerates exactly three kinds, and the "The algorithm, transcribed (do not re-derive it from prose)" block has no `no_awardable_value` arm either. The shipped seam has four (`stage2.go:128`, `stage2.ts:146`). Both boxes are checked `[x]`. 6-4b, 6.5 and 6.8 will context off whichever half they read first. [auditor]
- [x] [Review][Defer] Nothing automatically runs `generate_vectors.py --check` [roulette/vectors/generate_vectors.py] — deferred, pre-existing
- [x] [Review][Defer] The Python anchor's independence is weaker than AC3 claims [roulette/vectors/generate_vectors.py] — deferred, pre-existing

**Dismissed as noise (3):** `itoa` returns `""` for a negative input (`stage2.go:508`) — unreachable, its only caller is `len()`; the struct-tag realignment in `prng_test.go` — a gofmt consequence of the struct change, not stray formatting; the `6-4-two-stage-draw` → `6-4a`/`6-4b` key rename in sprint-status — verified, nothing in `_bmad-output/implementation-artifacts/**` still references the old key.


**Verified against the tree by the Acceptance Auditor, no finding:** `--check` OK on all three files · `0025` free and `supabase/**`, `app/**`, `lib/awards|ceremony|i18n|bracket/**`, `worker/ingest|store|db|config` untouched · no `qa64a`/`_qa64a` orphans, `worker/cmd/qa54` intact · `lib/roulette/stage2.ts` has zero imports (so no `server-only`, no `node:`) · `prng_test.go` pins the exact file set `{labels.go, prng.go, stage2.go}` and scopes `math/big` via `exceptIn: ["stage2.go"]` · the import-ban positive control asserts non-vacuously · all nine AC3-mandatory vector rows exist and every case and refusal is executed by both suites · S1-S7 each carry a named comment at the implementation site in both languages · every boundary the Edge-Case Hunter traced that is NOT listed above is handled correctly, including the `3/6` vs `2/4` cross-product tie, byte-lex vs numeric on `"9"/"10"/"100"`, duplicate/empty/non-digit/out-of-order ids, tie widths 2/3/whole-roster, and the ladder being consulted on every tie and no non-tie. Gate counts were re-measured AFTER the patches and are recorded in the Change Log row above, not here — the pre-patch figures (Vitest 854/39, Go `awards` 206) were correct when the auditor checked them and are simply superseded.
