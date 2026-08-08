---
baseline_commit: f9a2358c9add3205ba91aa44b4b265a8617fdf79
---

# Story 6.8a: Ceremony run and persistence

Status: review

> **Carve-out note.** Epic 6 Story 6.8 ("Reveal-gating and commitment", `epics.md:1132-1152`) accumulated far
> more than its three ACs. Every migration from `0023` to `0026` homes work to 6.8 **by name**, and
> `deferred-work.md` homes six more items to it. Counted end to end it is 3–4× a normal story here, so
> **Cuatro split it on 2026-08-08**, following the `6-4a`/`6-4b` and `6-5`/`6-5b` precedent:
>
> - **6.8a (this story) — the ceremony RUNS and the rows EXIST.** The Go producer orchestrator, the
>   spin plan, the writer RPC, the schema invariants that make the rows honest, and the `0025`/`0026`
>   debts. **The access posture does not move**: zero `anon`/`authenticated` grants, `revealed_at` stays
>   `NULL`, no viewer can see anything. Identical to today, with rows behind it.
> - **6.8b — the rows become VISIBLE, on the reveal axis.** Grants + `revealed_at` policies on
>   `award`/`spin`/`award_result`/`award_result_winner`, the `reveal_spin` RPC, the `seed_hex`
>   commitment surface, the `ceremony_locked` widening to the grace/bind RPCs, and the `award_reveal`
>   feed writer. 6.8b maps 1:1 onto `epics.md:1140-1152`.
>
> **6.8a carries none of the epic's three ACs.** It is the precondition half: AC2 of the epic
> ("invisible until that spin's `revealed_at`") is untestable against a table that has never held a row,
> and `0025:51`'s standing instruction — *"⛔ Story 6.8 ADDS both halves — the grant and the policy —
> together"* — is honoured by 6.8b adding them together, not by 6.8a adding half of one.

---

## Story

As a platform,
I want the awards ceremony computed once from the frozen snapshot and persisted atomically as spins, results and winners,
so that there is a real, deterministic, re-derivable ceremony record for the reveal axis to gate and the verification bundle to publish.

---

## Acceptance Criteria

**AC1 — The spin plan is derived and published to the row (FR-25, AD-22, SOLUTION-DESIGN §9.2)**
**Given** `ceremony.spin_plan` is a shell created by `0024:201` and written by nobody (`0024:191-193`),
**When** the ceremony run starts,
**Then** `ceremony.spin_plan` is written as an ordered plan — one entry per main spin, each naming its
`pool` (candidate `award` ids) and its `live_count` — derived deterministically from the frozen catalog
in ascending `award.priority`, with `pool` = the catalog minus every award already assigned in an
earlier spin (`SOLUTION-DESIGN.md:407`),
**And** `ceremony.state` moves `locked → spinning` on the same transaction.

**AC2 — The producer orchestrates the five stages, deterministically and stream-correctly (AD-14, FR-25/26/28/29)**
**Given** `worker/awards` is seven leaf modules with nothing calling them in sequence,
**When** the orchestrator runs ceremony spin `S = 1..N`,
**Then** it opens a **fresh** stream per spin keyed by `Stage1Label(S)` (1-based, `labels.go:65`), calls
`Stage1Pick` → `ResolveSpin` (which internally drives `ResolveStage2` + `FR29Ladder` + the anti-sweep
pass), carries the shelf forward across spins so the luck-meter bias is cumulative, and after the last
main spin opens **one** fresh stream keyed by `PityLabel` and calls `ResolvePity` exactly once,
**And** it reports, per spin, `Stream.Consumed()` and the `Stage1Draw` list, plus `PityResult.BytesConsumed`
and `PityDraw` list for the pity stream — measured from the stream, never recomputed.

**AC3 — One transaction writes the whole ceremony, or none of it (AD-6)**
**Given** the atomicity rule,
**When** the run is persisted through the new `persist_ceremony` RPC,
**Then** `spin`, `award_result` and `award_result_winner` rows for the entire ceremony commit together or
not at all, `revealed_at` is written `NULL` on every spin, exactly one `audit_log` row is written with
before/after in `detail`, and every guard returns a typed `{ok:false, reason:'<snake_case>'}` refusal
**before** the first write.

**AC4 — Pity persists as N spins, one winner each (FR-28, 6.7 Question 2)**
**Given** 6.7's recorded answer (`6-7-pity-roulette.md:1330-1338`) that pity persists as N spins rather
than one shared spin,
**When** the pity result is persisted,
**Then** each entry of `PityResult.RevealOrder` becomes one `spin` row with `kind='pity'` and a
`spin_index` continuing the main sequence in `RevealOrder` order, carrying one `award_result` with
`award_id = NULL`, `is_pity = true`, `is_shared = false`, and exactly one `award_result_winner`,
**And** `award_result_award_or_pity` (`0026`) is satisfied by construction, not by luck.

**AC5 — `is_pity` and `spin.kind` can no longer disagree (closes `deferred-work.md:357`)**
**Given** that `0026` dropping `award_id`'s `NOT NULL` made `is_pity = true` on a `kind='main'` spin
representable, and that NULLs being DISTINCT in a UNIQUE means `award_result_spin_award_key` (`0025:178`)
no longer bounds a main spin's results **at all**,
**When** migration `0027` ships,
**Then** an `award_result` whose `is_pity` disagrees with its parent `spin.kind` is **unrepresentable** by
mechanism, and the pgTAP suite proves the refusal in **both** directions (`is_pity` on `main`, and
`not is_pity` on `pity`) by named constraint, never by bare `23514`.

**AC6 — `ceremony.state` advances by mechanism, never by convention (closes `deferred-work.md:277`)**
**Given** that `service_role` holds plain `UPDATE` on every `ceremony` column and `ceremony_state_valid`
is a membership CHECK with no transition constraint, so `update ceremony set state='not_started'`
re-opens all four `ceremony_locked` guards **and** `catalog_frozen` after capture,
**When** `0027` ships,
**Then** a transition trigger permits only `not_started → locked → spinning → complete` (each step
forward, never backward, never skipping), and `snapshot_id` and `seed_demo_sha256` are write-once once
non-NULL — enforced with a new `IC910` SQLSTATE and proven in pgTAP in both directions.

**AC7 — The outcome a row records is the outcome the producer produced**
**Given** that `award_result` today carries no outcome kind and no integer-form deciding pair, so a
zero-winner row cannot be distinguished from `no_awardable_value`, and a `rate` award's deciding value
cannot be stored without dividing,
**When** `0027` ships,
**Then** `award_result` carries `outcome_kind` (CHECK over exactly the five `OutcomeKind` values
`winner`/`tie`/`no_eligible_players`/`no_awardable_value`/`shared`, `stage2.go:226-243`) and
`deciding_num`/`deciding_den` for the integer-form rate pair,
**And** `tie_ladder_exit_step` is written `nullif(engine_value, 0)` — the `0025:162-174` ⛔⛔ callout —
so Go's `LadderExitNone = 0` and TS's omitted key land as the **same** SQL NULL (`deferred-work.md:307`).

**AC8 — A second run replaces the first atomically, and says so**
**Given** `0025:358-360` grants `DELETE` on all three tables to `service_role` explicitly for
delete-prior-on-rerun,
**When** `persist_ceremony` is called for a ceremony that already holds spins,
**Then** it refuses with a typed `reason` unless an explicit replace flag is passed; with the flag it
deletes the prior spins (cascading to results and winners) and writes the new run in the **same**
transaction, and the `audit_log` row records both the deleted and the written counts.

**AC9 — The access posture does not move (the 6.8b precondition)**
**Given** that 6.8b owns the grant and the policy together (`0025:44-52`, DECISION B),
**When** `0027` ships,
**Then** `spin`, `award_result`, `award_result_winner` and `award` still hold **zero** grants to `anon`
and `authenticated` and **zero** viewer policies, every one of them is still `ENABLE`+`FORCE`,
`revealed_at` is `NULL` on every row written, and THE BAR proves a real `anon` PostgREST session gets
`42501` on all four tables **with rows in them** — the first time that assertion has ever been made
against non-empty tables.

**AC10 — Measured over the real corpus, never narrated**
**Given** the standing doctrine (`epic-5-retro-2026-07-28.md:43`) and that this is now the **fifth**
consecutive story to meet the FR-21 zero,
**When** the orchestrator is run end to end over the 14-demo QA corpus in a throwaway harness,
**Then** Completion Notes report, as numbers re-derived in this story and not quoted from 6.7:
how many of the 12 awards resolved `winner` / `shared` / `no_eligible_players` / `no_awardable_value`,
the shelf distribution after the main spins, `|winless|`, the per-spin `bytes_consumed`, the pity
`bytes_consumed`, and the row counts written to all three tables,
**And** the run is executed **twice from the same seed** and the two persisted row sets are compared
field-by-field and shown identical — determinism proven, not asserted.

---

## Tasks / Subtasks

- [x] **T1 — Measure the baseline before writing a line (AC10)**
  - [x] Run every gate on a clean tree and **record the numbers you measure**. Do **not** quote the table
        in §Gates below, and do **not** quote `sprint-status.yaml` — `6-7-pity-roulette.md:1349-1356`
        records that the last story quoted `1318/42` from that file when the real figure was `1322/42`,
        and the reviewer had to re-measure it. That correction is itself now stale.
  - [x] `supabase db reset` **before** pgTAP — every story since 6-4a leaves the QA corpus in the local DB.
  - [x] Confirm `git status` clean and `0001`–`0026` byte-untouched at the end of the story.

- [x] **T2 — The Go producer orchestrator (AC1, AC2)**
  - [x] New file `worker/awards/ceremony.go` (+ `ceremony_test.go`). It is a **leaf**: stdlib +
        `worker/awards` only, no DB import, no `worker/db`, no `net/http`. `worker/awards` has no
        dependency edge outward and this file must not create one (AD-14, `ARCHITECTURE-SPINE.md:73-76`).
  - [x] Derive the spin plan: main spins in ascending `award.priority`; `pool[S]` = catalog minus every
        award assigned in spins `< S`; `live_count` injected as organizer config, defaulting to `1`
        (`generate_vectors.py:6298-6310` — *"UX fixes the pacing at ONE award per spin … `spin_plan` is
        organizer config that can widen without a code change"*). Do **not** hard-code `1` inside the
        engine; take it as input and validate `1 <= live_count <= |pool|`.
  - [x] Chain, per spin `S`: `NewStream(seed, Stage1Label(S))` → `Stage1Pick(stream, Stage1Input{...})`
        → `ResolveSpin(live, players, FR29Ladder{})`. `ResolveSpin` **requires** a ladder (`sweep.go:206-209`)
        — pass `FR29Ladder{}`, never `RefusingLadder{}`.
  - [x] Carry the shelf: after each spin, increment `shelf[steamid64]` for every player in
        `SpinResult.Assigned`. Stage 1's weight lookup reads that shelf (`stage1.go:213-229`), so the
        luck-meter bias is only correct if the shelf is threaded, not rebuilt.
  - [x] After the last main spin: `NewStream(seed, PityLabel)` → `ResolvePity(PityInput{Players, Shelf, Stream})`.
        The stream must be **fresh** (`Consumed() == 0`) and keyed by `PityLabel` — `pity.go:429-434`
        refuses a Stage-1 label, and that refusal is a real guard, not decoration.
  - [x] Do **not** call `uniformInt` concurrently on one stream and do **not** re-use a stream across
        spins. Each spin's stream is independent and domain-separated; that is the whole point of
        `labels.go`.
  - [x] Report byte accounting from the stream (`Stream.Consumed()`), never by re-deriving it from the
        draw list. 6.7's review found a stand-in stream publishing an invented byte count precisely
        because the guard read `label`/`consumed` but never `read`.
  - [x] **Every refusal is typed.** Reuse the established detail sets — Stage 1's 10
        (`stage1.go:96-116`), ladder's 5, sweep's 4, pity's 3 — and add a `ceremony`-level set for
        plan-shaped refusals (empty catalog, `live_count` out of range, duplicate priority, seed length).
        A refusal must cost **zero** stream bytes.

- [x] **T3 — Migration `0027` (AC5, AC6, AC7, and the `0025` debts)**
  - [x] `supabase/migrations/0027_ceremony_run.sql` + `supabase/tests/0027_ceremony_run_test.sql`.
        Header block per house style: file-path line, `Logical migration 0027 — <slice> (Story 6.8a, FR/AD refs)`,
        the ⭐ thesis paragraph, the new SQLSTATE declaration, and an explicit **OUT OF SCOPE — do NOT add
        here** list naming the owning story for every deferral. `IC901`–`IC909` are taken; **`IC910` is
        yours**.
  - [x] **Never edit `0001`–`0026`.** Change shipped functions only via `create or replace` inside `0027`,
        and paste the diff of each replaced body against its original in Completion Notes — *it must
        contain only the intended change, and any unexplained delta is a finding.*
  - [x] **AC5** — bind `award_result.is_pity` to `spin.kind`. Preferred mechanism, per
        `deferred-work.md:357`: denormalise `spin.kind` onto `award_result` and add a composite FK
        `(spin_id, kind) references spin(id, kind)` plus `check (is_pity = (kind = 'pity'))` — the same
        declarative shape `0025`'s DECISION D already used for `award_result_winner`. A row-level trigger
        is the fallback, not the first choice; `0025` chose declarative twice and this file should not
        break that.
  - [x] **AC6** — `ceremony` transition trigger raising `IC910`: forward-only through
        `not_started → locked → spinning → complete`; `snapshot_id` and `seed_demo_sha256` write-once once
        non-NULL. `0024:251` records that `4/6.8 need UPDATE for state/spin_plan` — permit exactly those
        columns to move, and nothing else.
  - [x] **AC7** — add `award_result.outcome_kind text not null` with a **named** CHECK over exactly
        `('winner','tie','no_eligible_players','no_awardable_value','shared')`, plus
        `deciding_num bigint` / `deciding_den bigint` nullable for the rate pair. Add a named CHECK
        pinning the shape: `winner`/`shared` ⇒ at least one winner row; `tie` must never be persisted
        (the ladder always resolves it — a persisted `tie` is a producer bug, so make it unrepresentable
        or refuse it in the RPC, and say which you chose and why).
  - [x] Close the three remaining `0025` debts while you are in the file — all three are homed here by
        name and none of them survive another story:
    - [x] `deferred-work.md:333` — the `is_shared` assertion trigger is `security invoker` under FORCE RLS
          with zero policies, so `if not found then return null` conflates "parent deleted" with "parent
          invisible", and `count(*)` over an RLS-filtered child set returns a filtered count. **It fails
          open.** It is safe today only because the sole writer has BYPASSRLS. 6.8b adds the viewer
          policy; decide `security definer` **now**, before that policy exists, and pin it with a pgTAP
          case that runs the trigger as a non-BYPASSRLS role.
    - [x] `deferred-work.md:334` — `award_result_winner_result_key` is subsumed by the anti-sweep UNIQUE
          and can never refuse anything (DECISION D's composite FK forces the child's `spin_id` to equal
          its parent's). Drop it or document why it stays. Also: the four `has_index` calls do not assert
          the index is UNIQUE — fix that while you are here.
    - [x] `deferred-work.md:337` — `0025`'s in-file DECISION letters A–D collide with story 6.6's
          DECISIONS A–D and mean different things. Renumber `0025`'s **in the `0027` header's
          cross-references**, not by editing `0025`.

- [x] **T4 — The `persist_ceremony` writer RPC (AC1, AC3, AC4, AC8)**
  - [x] In `0027`, following the **RPC house style verbatim** (`6-2-...md:186-201`): `security invoker` +
        `set search_path = ''` + every reference schema-qualified · **unlocked peek first** to resolve
        scope/existence (it must not lock) · every lock in **one statement, canonical `id` order** ·
        re-read under lock · **every guard before any write** · typed business refusals **RETURNED** as
        `{ok:false, reason:'<snake_case>', …context}` · genuine corruption **RAISES** with `IC910` + a
        `hint` · the literal separator comment
        `-- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──` ·
        exactly one `audit_log` insert with before/after in `detail` ·
        `revoke execute … from public; grant execute … to service_role;`
  - [x] Signature takes the producer's run as one `jsonb` payload plus the ceremony id and a `p_replace boolean`.
        The RPC **validates** the payload — it does not trust it. Guards, at minimum: ceremony exists and
        is in `locked` (or `spinning` with `p_replace`); the snapshot is present; every `award_id`
        belongs to this tournament's frozen catalog; every `steamid64` maps to a live `roster_entry`;
        `spin_index` is dense and 1-based; every `outcome_kind` is in the CHECK set; a `winner`/`shared`
        outcome carries the right winner cardinality.
  - [x] **Map, do not assume.** `steamid64 → roster_entry.id` for `winner_entry_id`; award **string** ids
        from the producer → `award.id` bigints for `live_award_ids` and `award_result.award_id`;
        `tie_ladder_exit_step` via `nullif(v, 0)`.
  - [x] `revealed_at` is written `NULL`, explicitly and visibly, with a comment saying 6.8b stamps it.
        Do not add a default.
  - [x] `p_replace` deletes prior spins for the ceremony (cascade handles the children) inside the same
        transaction, and the audit row records deleted-count and written-count.
  - [x] `ceremony.spin_plan` and `ceremony.state = 'spinning'` are written by this same RPC, so the plan
        and the rows can never disagree.
  - [x] ⚠ The `is_shared` trigger is `deferrable initially deferred` (`0025`). Multi-row winner writes
        will only be validated at COMMIT — make sure a refusal path cannot leave the transaction relying
        on a constraint that fires after your `audit_log` insert.

- [x] **T5 — The worker-side caller**
  - [x] Thin caller that loads the frozen snapshot + catalog, runs `worker/awards`'s orchestrator, and
        posts the run to `persist_ceremony` through the existing service-role client. It contains **no**
        ceremony logic — every decision lives in `worker/awards`, every write in the RPC.
  - [x] Follow `lib/ceremony/lock.ts`'s wrapper shape for the typed-refusal handling: discriminated
        `{ok:true,…} | {ok:false, reason:<union>}`, a `Set` of trusted reasons, and **fail closed** on an
        unrecognised `error` or `reason`.

- [x] **T6 — Tests, and then mutation-test them (AC5–AC9)**
  - [x] **pgTAP** `0027_ceremony_run_test.sql`: explicit `plan(N)` with the count accounted for
        section-by-section in a comment block and restated in Completion Notes. Cover, at minimum: the
        `is_pity`⇄`kind` refusal in **both** directions; every legal and every illegal `ceremony.state`
        transition; `snapshot_id`/`seed_demo_sha256` write-once; the `outcome_kind` CHECK by **name**;
        the `nullif(v,0)` mapping; `persist_ceremony`'s every typed refusal via the `pg_temp.<probe>`
        wrapper (`6-2-...md:139`) so a **raising** mutant reddens a named test instead of aborting the
        transaction; `p_replace` on and off; the `is_shared` trigger under a **non**-BYPASSRLS role.
  - [x] **AC9 negative controls**, as `set local role anon` / `authenticated` **with rows present**:
        `select` on all four tables must be `42501`, and the `policies_are()` set on all four must be
        unchanged from `0025`/`0023`. This is the assertion that proves 6.8a moved no posture.
  - [x] **Go** `ceremony_test.go`: the chain over a fixed seed; shelf threading actually changes a later
        spin's weights (assert the weights, not just that it ran); pity gets a fresh `PityLabel` stream;
        every typed refusal costs zero bytes; determinism across two runs.
  - [x] ⭐ **Guard the guards — the project's recurring defect, now at its SIXTH occurrence**, and last
        time it was inside the file whose own header mandated the fix (`6-7-pity-roulette.md:1455`: a
        `pins_inputs` of `lambda e, c: 256 % 3 != 0` — a constant ignoring both arguments — and a
        `dq_excluded` guard satisfied by a DQ'd player who *also* held a trophy, so the DQ branch could
        be deleted and it stayed green). **Every coverage flag must name the specific case it claims and
        re-derive that case's property from that case's own emitted data**, must exclude degenerate
        inputs, and must assert *exactly one* case per uniquely-claimed property. Pin the case-name set
        by exact equality.
  - [x] **No vacuous assertions.** If an assertion cannot fail for any implementation, delete it and let
        the signature carry the property (`6-7-...md:745-746`).
  - [x] **Mutation pass, non-optional, before review.** Run a **control pass on unmutated source first
        and void the run unless it is green** — 6.6 caught a lowercase-drive-letter `cwd` that way and
        6.7 caught `--reporter=basic` not existing in Vitest 4. Then, per effect: delete each CHECK, each
        typed refusal, each trigger branch, confirm a **named** test reddens, restore. Record the full
        table in Completion Notes.

- [x] **T7 — THE BAR, over the real seam (AC9, AC10)**
  - [x] Throwaway harness, never committed. Rebuild the 14-demo corpus per the recorded recipe (curate
        the payload from Vitest first, parse-before-seed, the `grand_final gf_order=2` bracket trick,
        approve only `ziivanto`), decompress `demos/*.dem.gz` first, then `lock_ceremony`, then run the
        orchestrator and `persist_ceremony` end to end.
  - [x] Real signed-in admin and non-admin sessions against the local stack; as `anon` over PostgREST,
        `select * from spin|award_result|award_result_winner|award` must return `42501` **with rows
        present**. `curl` the served viewer HTML and `grep` for `seed_hex`, `content_sha256`, any
        SteamID64, and any award name. **That grep is the AD-22 proof; a screenshot is not.**
  - [x] Run the whole thing **twice from the same seed** and diff the two persisted row sets
        field-by-field (AC10).
  - [x] Delete the harness; prove the Go gates clean **while it was present and after removal**.
  - [x] ⚠ WinNAT eats DB port `54322` — elevated `net stop winnat` / `net start winnat`. Kong can remap
        to host `55321` while `supabase status` still reports `54321`.

- [x] **T8 — Report the FR-21 zero as a number, again (AC10)**
  - [x] At the shipped `24`/`20` floors, `0 of 28` players clear either one (`rounds_played` min 10 / max
        21; `kills` max 12), so **every** main spin is expected to resolve `no_eligible_players`, every
        shelf stays `0`, and pity's input is the entire 28-player roster. **DECISION C stands and has now
        held five times — the floors and the `24`/`20` literals in `0021:56` and `lib/awards/catalog.ts`
        are UNTOUCHED.** Re-derive the numbers in this story; do not quote 6.7's.
  - [x] This is the story where that zero stops being theoretical: it is what actually gets **written to
        the database**. Report exactly what the row set looks like under it, and carry the escalation to
        Cuatro rather than absorbing it. `sprint-status.yaml:46`: *"a floors slice is owed before Epic 6
        closes."*

- [x] **T9 — Gates and record**
  - [x] `npm run lint` · `npm test` · `npm run build` (every viewer route still `ƒ` dynamic, `/ceremonia`
        still the 5.7 `<Placeholder>`, **no `roulette` route**) · `go build ./... && go vet ./... && go test -count=1 ./...`
        · `gofmt -l ./worker` empty · `python roulette/vectors/generate_vectors.py --check` — **all seven
        existing vector files byte-identical, proven with `git status`, not asserted** · `supabase test db`
        after a `db reset`.
  - [x] 0 CRLF. Every excluded path byte-untouched.

---

## Dev Notes

### The single most important thing to get right

`worker/awards` is a **pure producer with no dependency edge outward** and `lib/roulette` is its
byte-for-byte verifier (AD-14, `ARCHITECTURE-SPINE.md:73-76`). Nothing you add may make `worker/awards`
import a DB client, a config package, or `net/http`. The orchestrator is a pure function from
`(seed, catalog, snapshot, plan config)` to a run document. The RPC is the only thing that writes.

### ⚠ A deliberate, flagged departure from the pairing discipline

Stories 6.3–6.7 each shipped their module in **both** Go and TS simultaneously, with a golden vector
holding them equal. **6.8a ships the orchestrator in Go only.** The reasoning, and it is a judgement
call worth a reviewer's attention:

- The orchestrator is *producer wiring*. `lib/roulette` is the *verifier*, and it needs a ceremony
  orchestrator only when it has a published bundle to verify against — which is 6.9's deliverable.
- `roulette/vectors/README.md`'s own gate table gives 6.8 **no gate**. Gate 4 (canonical JSON +
  `bundle_sha256`) is 6.9's; gate 5 (end-to-end ceremony from a **real** captured snapshot) is 6.11's.
  Adding a synthetic chaining vector now would half-cover ground 6.11 must cover properly.
- The README's own rule cuts against shipping a mirror with no vector: *"a vector generated from one
  implementation only proves the other copies it."*

**The cost, stated plainly:** the Go orchestrator is unverified by the cross-language seam until 6.11.
This is Question 1 below. If Cuatro would rather pay for the mirror now, it is a scope addition to this
story, not a correction to it.

### The exact API you are calling (transcribed, not remembered)

```go
// per spin S = 1..N
lbl, err := awards.Stage1Label(S)                      // labels.go:65 — 1-based, no padding
st, err  := awards.NewStream(seed, lbl)                // prng.go:108 — seed is [32]byte
res, err := awards.Stage1Pick(st, awards.Stage1Input{  // stage1.go:532 → Stage1Result
    Candidates: []awards.Stage1Candidate{{AwardID, Priority, Award}},  // stage1.go:198
    Players:    []awards.SnapshotPlayer{...},           // stage2.go:149
    Shelf:      map[string]int{...},
    Table:      []int{100, 40, 16, 6, 2, 1},            // ceremony.luck_weight_table, 0025 default
    LiveCount:  1,
    Ladder:     awards.FR29Ladder{},
})
spin, err := awards.ResolveSpin(live, players, awards.FR29Ladder{})  // sweep.go:210 → SpinResult
// after the last main spin, exactly once:
pst, err := awards.NewStream(seed, awards.PityLabel)    // labels.go:53
pr,  err := awards.ResolvePity(awards.PityInput{Players, Shelf, Stream: pst})  // pity.go:264
```

Result shapes you persist from:

- `Stage1Result{Live []string, Weights []int, TotalWeight int, Draws []Stage1Draw}` — `stage1.go:268`.
  `Live` in draw order, which **is** reveal order (`0025:127-129`) → `spin.live_award_ids`.
- `SpinResult{Results []AwardAssignment, Assigned []string}` — `sweep.go:160`. `Results` is in
  **ascending priority** (processed order), `Assigned` is **byte-lex**. Persist `Results` order; feed
  `Assigned` into the shelf.
- `AwardAssignment{AwardID, Priority, Outcome, SweptOut, Reresolved}` — `sweep.go:120`. `Outcome` is
  **never** `KindTie` here — the ladder has already resolved it.
- `Outcome{Kind, SteamID64, DecidingValue, Tied, Reason, Winners, LadderExitStep}` — `stage2.go:288`.
  `Kind ∈ {winner, tie, no_eligible_players, no_awardable_value, shared}` (`stage2.go:226-243`).
  `LadderExitStep` is `0` for "no rung" (`LadderExitNone`, `stage2.go:253`) → **`nullif(v,0)`**.
- `DecidingValue{Class, Value, Num, Den}` — `stage2.go:278`. `volume` fills `Value`; `rate` fills
  `Num`/`Den`. That is why AC7 adds `deciding_num`/`deciding_den` rather than dividing.
- `PityResult{Winless, RevealOrder, Draws, BytesConsumed}` — `pity.go:205`. `Winless` is byte-lex and is
  the **invariant** outcome; `RevealOrder` is the seeded permutation and is what `spin_index` follows.

### Schema you are writing into (as it stands at `0026`)

```sql
spin(id, ceremony_id, spin_index, kind, live_award_ids jsonb, revealed_at timestamptz)
  spin_kind_valid check (kind in ('main','pity'))          -- 0025:119
  spin_ceremony_index_key unique (ceremony_id, spin_index)
award_result(id, spin_id, award_id NULLABLE, deciding_value numeric, is_pity, is_shared,
             tie_ladder_exit_step int)
  award_result_ladder_exit_step_valid check (… is null or between 1 and 5)
  award_result_spin_award_key unique (spin_id, award_id)   -- 0025:178 — NULLs are DISTINCT, see AC5
  award_result_id_spin_key   unique (id, spin_id)          -- enables the child's composite FK
  award_result_award_or_pity check (((is_pity or award_id is not null)) is true)   -- 0026
  + deferred constraint trigger asserting is_shared = (winner_count > 1), raising IC909
award_result_winner(id, award_result_id, spin_id, winner_entry_id)
  award_result_winner_result_fk foreign key (award_result_id, spin_id) references award_result(id, spin_id)
  award_result_winner_spin_key  unique (spin_id, winner_entry_id)   -- ⛔ FR-26 anti-sweep; must NEVER fire
```

⛔ **`award_result_winner_spin_key` firing is a producer bug, not a database refusal.** The anti-sweep
pass already guarantees ≤1 trophy per player per spin. If that UNIQUE ever raises, the orchestrator is
wrong — do not "handle" it, let it raise and treat it as corruption.

⛔⛔ **`tie_ladder_exit_step`: NULL means "no rung"; the engine's sentinel is integer `0`.** `0025:162-174`
states this in an explicit callout *"BECAUSE 6.8 OWNS THE WRITER AND WOULD OTHERWISE DISCOVER IT AS A 23514."*

### pgTAP file shape (mechanical — get it right first, not on the third reset)

```sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(N);          -- N accounted for section-by-section in a comment block above
-- … sections A, B, C … seed fixtures as postgres (BYPASSRLS), then
-- set local role anon|authenticated|service_role for the behavioural blocks,
-- with select set_config('request.jwt.claims', …) for the admin/viewer matrix
select * from finish();
rollback;
```

Refusal probes go through a `pg_temp.<probe>` wrapper catching `exception when others`, so a **raising**
mutant reddens a named test instead of aborting the whole transaction (`6-2-...md:139`, the 6.1 pattern).
`0002_rls_test.sql` is the copyable RLS-matrix pattern; `0003_audit_snapshot_test.sql` Section A2 holds
the generic catalog FORCE-guard that reddens loudly if any public base table loses `FORCE`.

### A CHECK that can evaluate NULL is SATISFIED

`0025`'s first `luck_weight_table_valid` accepted an empty array for exactly this reason; `0026` fixed it
by wrapping in `case … is true` (`6-7-...md:1296-1301`). Write **every** new CHECK as `(… ) is true`.
And **name every CHECK** — all CHECKs raise `23514`, and pgTAP asserts the **name**, not the code.

### Conventions that are not negotiable

- **Integer-only.** Banned across the producer: `math/rand`, `Math.random`, `Date`, `toLocaleString`,
  `localeCompare`, `parseInt`, `**`, `fmt.Sprintf` for numbers, `float64`, `.Int64()`, `.Uint64()`,
  `.Float64()`, and the 32-bit shift operators. `test/source-scan.ts` backs the "this construct must be
  ABSENT" pinning tests — extend it, don't route around it.
- **Byte-lex ordering** is the canonical order for SteamID64 sets. Go's `sort.Strings` agrees; **TS's
  `.sort()` does not** (UTF-16 code units). That defect is live in `sweep.ts` and `pity.ts` and is
  **homed to 6.9, not here** (`deferred-work.md:335,356`) — but know that the `Assigned`/`Winless`/
  `RevealOrder` order you consume is not yet *provably* byte-lex past ASCII digits. It is inert today
  because SteamID64s are ASCII. Do not "fix" it in this story and do not depend on it being fixed.
- **`security invoker`, not definer**, for anything mutating. `security definer` is reserved for
  anon-reachable narrow reads — the only one in the codebase is `award_catalog_count` (`0023:199-215`),
  and `0023:196-198` says widening it *"has broken AD-22."* The one place you *should* consider definer
  is the `is_shared` assertion trigger (T3, `deferred-work.md:333`) — that is a fail-open fix, not a
  widening.
- **Migrations**: `NNNN_snake_case_slug.sql`, hand-created (not `supabase migration new`, which stamps a
  timestamp), paired test file, one per story, never edit an applied one.
- **Vitest only runs `lib/**/*.test.ts`** (`vitest.config.ts:17`). A test file under `app/` **silently
  does not run**.

### Previous story intelligence (6.7, and the epic's standing lessons)

- **6.7 answered two questions this story consumes.** (1) A pity `award_result` carries `award_id = NULL`
  (`0026`). (2) Pity persists as **N spins, one winner each** — not one shared spin — so `RevealOrder`
  maps directly onto `spin_index` and `is_shared` stays `false` for every pity result
  (`6-7-...md:1330-1338`).
- **6.7's headline finding is your review's most likely finding too**: the coverage-guard defect, sixth
  occurrence. See T6.
- **6.7 also found**: `uniform_int` error was a typed refusal in Go and escaped **untyped** in TS and
  Python — one failure, three surfaces. The "a refusal is free" invariant is now scoped to **validation**
  refusals at all three sites. Your `ceremony`-level refusals must be typed in Go and must cost zero bytes.
- **6.7 also found**: TS and Python stream guards checked `label` and `consumed` but never `read`, so a
  structurally-shaped stand-in silently resolved a zero- or one-member set while publishing an invented
  byte count. Read the stream; do not duck-type it.
- **Measure clones, not just zeros.** A populated stat can still be an exact per-player clone
  (`kills == entry_frags == rounds_won == kast_rounds`; `deaths == opening_deaths`, both 28/28), so a
  secondary stat can be populated and still break no tie it is ever handed (`6-5-...md:421`). If you
  measure anything in T8, probe equality and ranking, not presence.
- **Baselines are measured, never quoted.** This is the rule 6.7 broke and its reviewer caught.

### Project Structure Notes

**NEW**: `worker/awards/ceremony.go`, `worker/awards/ceremony_test.go`,
`supabase/migrations/0027_ceremony_run.sql`, `supabase/tests/0027_ceremony_run_test.sql`, and the thin
worker-side caller (T5).

**UPDATE**: `test/source-scan.ts` only if you extend the banned-construct list.

**BYTE-UNTOUCHED — excluded paths, prove it with `git status`:**
`supabase/migrations/0001`–`0026` · `roulette/vectors/**` (all seven JSON files **and**
`generate_vectors.py`) · `lib/roulette/**` · `lib/awards/**` including `catalog.ts` and its 12 seeded
awards · `0021_leaderboard.sql` and its `24`/`20` floor literals · `worker/ingest|store|db|config/**` ·
`lib/bracket|steam|i18n/**` · `app/**` · `lib/leaderboard/**` · `lib/feed/**`.

**Explicitly NOT this story:**

| Deferred | Owner |
|---|---|
| Grants + reveal-gated RLS policies on `award`/`spin`/`award_result`/`award_result_winner` | **6.8b** |
| `reveal_spin` RPC, stamping `revealed_at`, `ceremony.state → complete` | **6.8b** |
| The `seed_hex` commitment surface (viewer-readable ceremony row) | **6.8b** |
| `ceremony_locked` extension to `begin_match_grace`/`resume_match`/`bind_match_demo` (`deferred-work.md:280`) | **6.8b** |
| The `award_reveal` `timeline_feed` writer (`0024:170`, unowned across all of Epic 6) | **6.8b** |
| `verification_bundle` table, `bundle_sha256`/`bundle_hash`, RFC-8785 canonicalization, `algo_version` publication | **6.9** |
| The TS ceremony orchestrator mirror (see the flagged departure above) | **6.9** |
| The `.sort()` UTF-16 → byte-lex fix in `sweep.*`/`pity.*`, all three runtimes (`deferred-work.md:335,356`) | **6.9** |
| The `decidingValue` XOR `ladder_exit_step` type-level invariant (`deferred-work.md:310`) | **6.9** |
| Any ceremony UI, the wheel, reduced-motion parity, `Ronda de consolación` i18n | **6.10** |
| Gate 5 — end-to-end ceremony vector from a **real** captured snapshot | **6.11** |
| Automating `generate_vectors.py --check` (there is no CI in this repo at all) | **6.11** |
| The FR-21 floors slice (`24`/`20`) — DECISION C, held five times | **owed before Epic 6 closes** |

### Gates

Re-measure all of these; the numbers below are 6.7's **post-review** figures recorded only so you can see
whether you moved something you did not intend to. `sprint-status.yaml`'s figures are known-stale.

| Gate | 6.7 post-review |
|---|---|
| `npm run lint` | 0 |
| `npm test` | 1374 / 43 |
| `npm run build` | 0, no `roulette` route |
| Go `awards` `--- PASS` | 647 |
| `gofmt -l ./worker` | empty |
| `generate_vectors.py --check` | OK ×7, all byte-identical |
| `supabase test db` | 1241 / 27 PASS |

### References

- `_bmad-output/planning-artifacts/epics.md:1132-1152` — Story 6.8's three ACs (all 6.8b's)
- `ARCHITECTURE-SPINE.md:185-188` (AD-22), `:140-143` (AD-13), `:150-153` (AD-15), `:170-173` (AD-19),
  `:110-113` (AD-7 two-policy, reveal-gated tables), `:73-76` (AD-14 no dependency edge), `:223`
- `SOLUTION-DESIGN.md:175-256` (ceremony schema as designed), `:283-293` (reveal RLS sketch — illustration
  only, flagged as such by 1.3's dev), `:407` (`spin_plan[S].pool minus already-revealed`), `:431-438` (§9.5)
- `supabase/migrations/0023_award_catalog.sql:156,179-215` · `0024_ceremony_lock_snapshot.sql:143-155,191-201,224-227,251`
  · `0025_ceremony_results.sql:35-55,73-75,114-130,162-174,178,195,230,243-245,258,351,358-360` · `0026_pity_award_result.sql:80-92`
- `worker/awards/labels.go:53,65` · `prng.go:33,108,124,162,207` · `stage1.go:96-116,198,213,254,268,296,532`
  · `stage2.go:63,149,226-259,278,288,344,388,435` · `ladder.go:177,238,246,267` · `sweep.go:120,160,206-210`
  · `pity.go:70,86-88,152,192,205,264,429-434`
- `deferred-work.md:269` (FR-21 zero), `:277` (AC6), `:280` (→6.8b), `:307` (AC7), `:310` (→6.9),
  `:333`, `:334`, `:337` (T3), `:356-357` (AC5 / →6.9)
- `6-7-pity-roulette.md:1296-1301,1330-1338,1349-1356,1397-1399,1455` · `6-6-anti-sweep-and-luck-meter.md:161,202`
  · `6-2-fair-seed-freeze-and-immutable-snapshot-capture.md:59,62,63,139,144,186-201` · `epic-5-retro-2026-07-28.md:43,95`
- `EXPERIENCE.md:132,164,166,169` (12 awards, one per spin) · `generate_vectors.py:6298-6310` (`live_count` is config)

### Git intelligence

`f9a2358` 6.7 pity roulette + `0026` · `ba894d1` 6.6 anti-sweep + `0025` · `26dc674`/`a1728a9` 6.5/6-5b
docs + mutation re-run · `d551f34` 6-5b ladder vector. Every one of them: one migration, one story, subject
line only, no body, no trailers. Match that.

_Traces: FR-25, FR-26, FR-28, FR-29 (persistence side) · AD-6, AD-14, AD-15, AD-19 · AD-22 (precondition only — the reveal axis itself is 6.8b's)_

---

## Questions for Cuatro

Answer these during or before `dev-story`; each one changes code, and none should be resolved by fiat.

1. **The Go-only orchestrator.** 6.3–6.7 each shipped their module in both runtimes with a golden vector
   holding them equal. 6.8a ships Go only, on the reasoning in Dev Notes: the TS side is the *verifier*
   and needs an orchestrator only when it has a bundle to verify (6.9), and `roulette/vectors/README.md`
   gives 6.8 no gate — gate 5, the end-to-end ceremony vector from a **real** snapshot, is 6.11's.
   **The cost is real:** the Go orchestrator carries no cross-language proof until 6.11. Accept, or pay
   for the TS mirror now as an addition to this story?

2. **`deciding_value` for rate awards.** AC7 adds `deciding_num`/`deciding_den` rather than dividing into
   the existing `numeric` column, because this epic has been integer-only end to end and a divided value
   cannot round-trip. The alternative is writing `num::numeric / den::numeric` (exact SQL numeric, not
   float) into `deciding_value` and letting 6.9 read the pair from the bundle instead. Two nullable
   columns, or the division?

3. **Persisting non-winner outcomes.** At the shipped FR-21 floors every main spin is expected to resolve
   `no_eligible_players`, so the honest ceremony record is twelve zero-winner `award_result` rows plus 28
   pity rows. The alternative is persisting only outcomes that produced a winner, which makes the record
   silent about *why* an award went unclaimed and leaves 6.10 with nothing to render. Story assumes
   **persist them**, which is why AC7 adds `outcome_kind`. Confirm?

4. **The FR-21 floors, fifth time of asking.** `0 of 28` clear `24`/`20`. Up to now that zero has been a
   measurement; in this story it becomes **rows in the database** — the ceremony that gets written is 28
   identical consolation prizes and zero category trophies. DECISION C (floors untouched) has held five
   times and this story does not re-open it. But `sprint-status.yaml:46` says a floors slice is owed
   before Epic 6 closes, and 6.8a is the last comfortable moment to take it before the bytes are
   persisted and 6.9 hashes them. Slice it now, or after 6.8b?

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, `dev-story` workflow), 2026-08-08.

### Answers to the four Questions for Cuatro (2026-08-08, before a line was written)

1. **Go-only orchestrator — ACCEPTED.** No TS mirror, no synthetic chaining vector. The cost is
   restated on `ceremony.go`'s package comment so a reader meets it at the file rather than in a story:
   the Go orchestrator carries **no cross-language proof until 6.11's gate 5**.
2. **`deciding_num` / `deciding_den` — TWO NULLABLE COLUMNS**, not the division. Recorded as 0027's
   DECISION 3.
3. **Persist non-winner outcomes — YES.** Which is what makes `outcome_kind` load-bearing: at the
   shipped floors the honest record is twelve zero-winner rows, and without the column they would be
   indistinguishable from `no_awardable_value`.
4. **FR-21 floors — NOT SLICED HERE.** DECISION C stands for a fifth time; the escalation is below.

### Debug Log References

- Mutation harnesses (throwaway, never in the tree): a Python driver per side. The SQL one mutates
  the LIVE database object-by-object (drop constraint / `create or replace` the function) and re-runs
  `0027_ceremony_run_test.sql`; the Go one rewrites `ceremony.go` and re-runs the whole `worker`
  module. Both run a CONTROL PASS on unmutated source first and VOID the run unless it is green.
- THE BAR harness: `worker/cmd/qa68/` — created, run, and **deleted in this same story** (the
  5.1–5.4 / 6.6 / 6.7 pattern). Go gates proven clean WITH it present and AFTER removal.
- `lib/awards/qa68dump.test.ts` — a throwaway Vitest file used only to dump the real curate payload
  from `lib/awards/catalog.ts` (which is `server-only`, so nothing else can import it). Deleted.

### Completion Notes List

#### Gates — BASELINE measured on a clean tree, then FINAL. Neither is quoted.

⚠ Per T1 the baseline was re-measured rather than read from the story's own table or from
`sprint-status.yaml`. Every baseline figure matched 6.7's post-review table exactly, so nothing had
drifted between stories.

| Gate | BASELINE (measured) | FINAL (measured) |
|---|---|---|
| `npm run lint` | 0 | 0 |
| `npm test` | 1374 / 43 files | 1374 / 43 files (unchanged — 6.8a ships no TypeScript) |
| `npm run build` | 0, every viewer route `ƒ`, **no `roulette` route** | 0, `/ceremonia` still `ƒ`, **no `roulette` route** |
| Go `worker/awards` `--- PASS` | 647 / 0 FAIL | **674** / 0 FAIL |
| Go `worker/ceremony` `--- PASS` | — (package did not exist) | **7** / 0 FAIL |
| Go whole `worker` module | — | **815** / 0 FAIL |
| `gofmt -l ./worker` | empty | empty |
| `generate_vectors.py --check` | OK ×7 | OK ×7, `git status roulette/vectors/` **empty** |
| `supabase test db` (after `db reset`) | 1241 / 27 files | **1309 / 28 files** |

`0 CRLF` across every file this story touched (`sprint-status.yaml` is CRLF natively and was already
modified at session start — not this story's doing). Every excluded path proven byte-untouched with
`git status`, and `git diff --name-only HEAD -- supabase/migrations/` names **only `0027`**.

#### ⭐ THE FR-21 ZERO, RE-DERIVED — the fifth consecutive measurement (AC10, T8, DECISION C)

Measured over the rebuilt 14-demo corpus, reading the floor predicates from `public.leaderboard`'s
**own columns** (`meets_round_floor` / `meets_kill_floor` / `eligible_rate`) rather than restating the
`24` / `20` literals — so the number would move if somebody moved a floor:

```
roster: 28 active
rounds_played_total: min 10 / max 21  -> meets_round_floor: 0 of 28
kills_total:         min  1 / max 12  -> meets_kill_floor:  0 of 28
eligible_rate (BOTH floors):                                0 of 28
lock_ceremony reported: row_count 28, eligible_count 0
```

⛔ **THIS IS THE STORY WHERE THAT ZERO BECAME ROWS IN A DATABASE.** The persisted ceremony is:

```
12 main spins + 28 pity spins = 40 spins · 40 award_result · 28 award_result_winner
outcome kinds: no_eligible_players=12 · winner=0 · shared=0 · no_awardable_value=0 · tie=0
shelf after the main spins: EMPTY — 0 players hold anything
|winless| = 28 (the entire roster)
```

**The escalation, carried to Cuatro rather than absorbed** (`sprint-status.yaml:46`: *"a floors slice
is owed before Epic 6 closes"*). The ceremony that now commits is **28 identical consolation prizes
and zero category trophies**. Twelve awards are announced and every one resolves "nobody qualified".
DECISION C was re-affirmed for this story (Question 4), and 6.9 will hash these bytes — so the floors
slice gets more expensive after 6.8b, not less.

#### ⭐ Byte accounting, measured from the stream (AC2, AC10)

```
spin  1..10  bytes=2 each      spin 11  bytes=1      spin 12  bytes=1
main-spin total = 22 bytes     pity = 27 bytes (27 draws)     whole ceremony = 49 bytes
```

⚠ The **22-byte** main-spin total reproduces Story 6.6's measured invariant exactly, from an
independently rebuilt corpus — a cross-check nobody asked for and the strongest single signal that
the chain is wired correctly.

#### ⭐⭐ AC10 determinism — PROVEN, not asserted

The whole run was executed **twice from the same frozen seed**
(`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`), the second with
`p_replace => true`:

```
producer payload identical: true (11906 bytes)
persisted row sets identical: true       (compared FIELD BY FIELD in SQL, not by row count)
persisted row-set SHA-256: a1727889d4dd16969d44274138bf9d10b7f4f07a5fae1d7883e8a37026a0b5dc
replace: deleted 40 spins, wrote 40 — in one transaction, audit row records both counts
```

#### ⭐⭐ AC9 — the posture, asserted WITH ROWS PRESENT for the first time

```
rows present:            spin=40  award_result=40  award_result_winner=28  award=12
service key over PostgREST:                    200 on all four (proof they are NOT empty)
anon         over PostgREST:  http 401, SQLSTATE 42501 on all four
authenticated over PostgREST: http 403, SQLSTATE 42501 on all four
anon/authenticated hold ANY data verb on ANY of the four: false
spins with revealed_at NOT NULL: 0
policy set on the four: exactly 0023's dormant `award.award_admin_read`, unchanged
```

**The AD-22 grep — and it is a grep, not a screenshot.** Served viewer HTML, fetched anonymously:

```
route          bytes    seed_hex  SEED  content_sha256  DIGEST  bundle_sha256  AWARD NAME  SteamID64
/              14341    no        no    no              no      no             no          —
/ceremonia     11545    no        no    no              no      no             no          no
/leaderboards  66550    no        no    no              no      no             no          —
/bracket       37406    no        no    no              no      no             no          —
```

⚠⚠ **AND THE GREP'S NON-VACUITY WAS MEASURED, WHICH CAUGHT IT BEING WRONG THE FIRST TIME.** The first
run came back "clean" across every route — over pages of ~11 KB that all rendered *"No pudimos cargar
el evento"*, because `.env.local` points at the **remote** Supabase project, not the local stack. A
grep over an empty error page proves nothing; that is the exact defect class this epic keeps paying
for. Rebuilt with the local `NEXT_PUBLIC_*` (they are inlined at build time) and re-run: the pages
grew to 66 KB / 37 KB and now render **28 distinct corpus player names each**, while still carrying no
seed, no digest and no award name. `/leaderboards` shows *"Premio 1 de 12 — bloqueado hasta que gire"*
— generic positions, never identities. `/ceremonia` is still the 5.7 `<Placeholder>`.

#### ⭐⭐ Mutation pass — control-first, per effect, 0 survivors on both sides

**SQL (migration 0027), 29 mutants — control pass GREEN, 29 killed, 0 survivors.** Every CHECK, the
composite FK, all three `assert_ceremony_transition` branches, all three `assert_award_result_is_shared`
branches (including `security definer` → `invoker`, which restores the `deferred-work.md:333` bug), all
16 `persist_ceremony` typed refusals, the `nullif(exit_step, 0)` mapping, and `revealed_at` stamped
`now()` instead of NULL.

**Go (`worker/awards/ceremony.go`), 18 mutants — control pass GREEN, 18 killed, 0 survivors.**

⚠ **THE FIRST SQL RUN HAD 3 SURVIVORS AND THE FIRST GO RUN HAD 3 — every one a REAL GAP, all six
closed with new tests rather than explained away:**

| Survivor | Why it survived | Closed by |
|---|---|---|
| `persist_ceremony` refusal `snapshot_missing` | every fixture ceremony already had a snapshot | a `locked` ceremony with `snapshot_id IS NULL` |
| `persist_ceremony` refusal `seed_missing` | every fixture ceremony already had a seed | a `locked` ceremony with `seed_demo_sha256 IS NULL` |
| `persist_ceremony` refusal `invalid_ladder_exit_step` | no payload ever carried an out-of-range rung | a payload with `tie_ladder_exit_step = 7` |
| IC909's **outcome-kind cardinality** branch | every path through the RPC is stopped by the RPC's own `winner_cardinality` guard first, so the trigger branch was unreachable *through that door* — but `service_role` holds INSERT on `award_result` directly | two tests driving the trigger DIRECTLY, by SQLSTATE and by message pattern |
| `ResolveSpin` handed `RefusingLadder{}` | the main Go fixture's dominant player never ties, so the ladder is never consulted | a three-identical-players fixture that drives FR-29 to its terminal rung 5 |
| `candidatesByID` skipping instead of refusing | the `internal` arm is not input-representable | a direct unit test on the unexported function (the `sweep.go:77-86` precedent) |

⚠ One "survivor" in the first Go run was **my own bad mutant**, not a gap: it appended `_ = liveCount`,
a no-op. Recorded rather than quietly re-rolled — a mutation matrix is only worth its weakest mutant.
Replaced with the real defect (a plan that PROMISES `in.LiveCount` while the last spin draws the
remainder), which the remainder test kills.

#### ⭐⭐ THE BAR found a defect no suite could

The first end-to-end run was refused with `seed_mismatch` on a perfectly well-formed ceremony:
**`BuildPayload` never populated `seed_hex`.** `worker/awards` proves the RUN and 0027's pgTAP proves
the WRITER — the TRANSLATION between them was covered by neither, and `worker/ceremony` had **no tests
at all**. Fixed at the source (`CeremonyRun` now carries `SeedHex` as provenance, which is what a
verification bundle needs anyway) and closed with a new 7-test `worker/ceremony/ceremony_test.go`
covering the payload shape, the pity-as-N-spins rendering, the raw exit-step sentinel, the
volume/rate split, winner cardinality, the JSON key names, and `PersistReasons`' closed set.

#### Decisions taken in 0027, each argued in the file itself

- **DECISION 1** — the `is_pity` ⇄ `spin.kind` bind is DECLARATIVE (denormalized `kind` + composite FK
  + `((is_pity = (kind='pity'))) is true`), per `deferred-work.md:357`'s stated preference and 0025's
  precedent. ⭐ It also repairs the SECOND-ORDER hole: a main-spin row is now forced to carry a
  non-NULL `award_id`, so `award_result_spin_award_key` bounds a main spin again instead of being
  defeated by NULL-distinctness.
- **DECISION 2** — a persisted `tie` is BOTH unrepresentable (its own named CHECK, separate from the
  five-value vocabulary CHECK) AND refused by the RPC with a typed reason. Task 3 asked for one or the
  other and for the choice to be stated; both, because the vocabulary and the persistence rule are
  different facts and a suite asserting constraint NAMES needs two names to tell them apart.
- **DECISION 3** — the rate pair is two integer columns, never divided (Question 2).
- **DECISION 4** — ⚠ **A DELIBERATE DIVERGENCE FROM ONE READING OF TASK 3, FLAGGED FOR THE REVIEWER.**
  Task 3 suggests the `ceremony` trigger permit "exactly `state`/`spin_plan` to move, and nothing
  else". A column allowlist that strict **breaks the only shipped ceremony writer**: `lock_ceremony`
  sets `state`, `seed_demo_sha256`, `snapshot_id` AND `started_at` in one statement (`0024:815-819`),
  `0025:450` backfills `luck_weight_table`, and it would pre-refuse 6.9's `algorithm_version` and
  6.8b's `completed_at`. So what ships is **AC6 as written** — forward-only one step at a time,
  `snapshot_id`/`seed_demo_sha256` write-once, plus `tournament_id` immutable — which is exactly
  `deferred-work.md:277`'s complaint, closed. `supabase test db` passing 1309 is the proof
  `lock_ceremony` still works.
- **DECISION 5** — `award_result_winner_result_key` STAYS (`deferred-work.md:334` permits drop-or-
  document). It can never refuse anything, but it is the index `assert_award_result_is_shared`'s
  `count(*) … where award_result_id = …` scans on every winner row of every ceremony. The real reason
  is now a `comment on constraint`, attached to the object rather than buried in a story.
- **`deferred-work.md:337`** (0025's DECISION letters colliding with story 6.6's) is closed by a
  naming table in 0027's header that refers to them as `0025-TABLES-ARE-6.6's` / `0025-NO-POLICY-YET` /
  `0025-IS-SHARED-ASSERTED` / `0025-COMPOSITE-FK`, and by 0027 never using a bare letter.

#### ⚠ Prior test files edited, and why (no applied migration was touched)

`award_result` gained two `NOT NULL` columns with **no default** — deliberately, since a wrong
`outcome_kind` would commit silently — so every prior fixture insert had to supply them.
`0025_ceremony_results_test.sql` (12 inserts) and `0026_pity_award_result_test.sql` (14 inserts) were
updated, each row given the `kind`/`outcome_kind` that MATCHES ITS OWN WINNER COUNT so the widened
IC909 rule is satisfied for the right reason. `0025`'s `columns_are` pin caught the widening, as
designed, and now names all eleven columns.

⛔ **ONE 0026 TEST WAS RETARGETED, AND THAT IS THE ONE EDIT A REVIEWER SHOULD CHECK.** Its
"flipping a legal pity row to `is_pity = false` is REFUSED" case now violates **two** CHECKs under
0027 (`award_result_award_or_pity` AND `award_result_is_pity_matches_kind`), and Postgres does not
guarantee which of two violated CHECKs it names — so the test would have been asserting a constraint
name by luck of OID order. It now clears a main-spin row's `award_id` instead, which breaks exactly
one constraint. **The original CLAIM — the guard bites on UPDATE, not only on INSERT — is preserved
unchanged; only the route to it moved.**

#### Diff of every shipped function replaced by `create or replace` (T3's requirement)

`public.assert_award_result_is_shared()` is the only pre-existing function replaced. Against
`0025:275-328`, the delta is exactly four things and nothing else:

1. `security invoker` → `security definer` (the `deferred-work.md:333` fail-open fix);
2. `set search_path = public` → `set search_path = ''` (the definer rule; every reference was already
   schema-qualified, so no body change followed);
3. the `select ar.is_shared into flag` widened to `select ar.is_shared, ar.outcome_kind into flag, okind`;
4. the new AC7 cardinality `raise`, added AFTER the unchanged `is_shared` raise — deliberately second,
   so `0025`'s pgTAP `throws_like '%is_shared is DERIVED from the winner count%'` keeps testing what it
   says it tests.

The `is_shared` branch, the `target_ids` both-parents logic, the NULL-safe `continue`, and the IC909
message/hint are **byte-identical** to 0025's.

#### pgTAP plan accounting — `plan(68)`

`A 14 + B 6 + C 12 + D 10 + E 15 + F 6 + G 4 + H 1`, restated section by section in a comment block
above `select plan(68)`. Sections A (four pre-0027 indexes asserted **UNIQUE**, closing
`deferred-work.md:334`'s `has_index` gap), G (the trigger under a **non-BYPASSRLS** role that cannot
SELECT what it wrote) and H (AC9 with rows present) are the ones worth reading first.

#### Not done / carried forward

- The TS orchestrator mirror and its vector → **6.9 / 6.11** (Question 1, accepted).
- Grants + reveal-gated policies, `reveal_spin`, `revealed_at` stamping, the `seed_hex` commitment
  surface, `ceremony_locked` on grace/bind, the `award_reveal` feed writer → **6.8b**, unchanged.
- The FR-21 floors slice → still owed before Epic 6 closes. See the escalation above; it is the one
  item in this story that is a product decision rather than an engineering one.

### File List

**NEW**
- `worker/awards/ceremony.go` — the pure producer orchestrator (AC1, AC2)
- `worker/awards/ceremony_test.go` — 16 tests / 27 subtests
- `worker/ceremony/ceremony.go` — the thin caller: load, run, post (T5)
- `worker/ceremony/ceremony_test.go` — 7 tests over `BuildPayload` and the closed reason set
- `supabase/migrations/0027_ceremony_run.sql` — the schema invariants + `persist_ceremony` (AC1, AC3–AC9)
- `supabase/tests/0027_ceremony_run_test.sql` — 68 pgTAP tests

**MODIFIED**
- `worker/awards/prng_test.go` — the scanned-file-set pin gains `ceremony.go` (and deliberately does
  NOT widen the `math/big` exemption)
- `supabase/tests/0025_ceremony_results_test.sql` — `columns_are` widened to 0027's four columns; 12
  inserts supply `kind`/`outcome_kind`
- `supabase/tests/0026_pity_award_result_test.sql` — 14 inserts supply `kind`/`outcome_kind`; one test
  retargeted (see above)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status → review
- `_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md` — this record

**CREATED AND DELETED IN THIS STORY** (never committed)
- `worker/cmd/qa68/main.go` — THE BAR harness
- `lib/awards/qa68dump.test.ts` — the curate-payload dump

**BYTE-UNTOUCHED, PROVEN WITH `git status`**
`supabase/migrations/0001`–`0026` · `roulette/vectors/**` · `lib/roulette/**` · `lib/awards/**` ·
`0021_leaderboard.sql` and its `24`/`20` literals · `worker/ingest|store|db|config/**` ·
`lib/bracket|steam|i18n/**` · `app/**` · `lib/leaderboard/**` · `lib/feed/**`

### Change Log

| Date | Change |
|---|---|
| 2026-08-08 | Story 6.8a implemented. Go orchestrator + thin caller, migration `0027` (IC910) with the `persist_ceremony` writer, 68 new pgTAP tests, 34 new Go tests. Mutation-tested per effect on both sides with a green control pass: 29/29 SQL and 18/18 Go mutants killed, 0 survivors (6 first-round survivors closed with new tests). THE BAR rebuilt the 14-demo corpus and ran the ceremony twice from one seed — identical. FR-21 zero re-derived: 0 of 28. Status → review. |
