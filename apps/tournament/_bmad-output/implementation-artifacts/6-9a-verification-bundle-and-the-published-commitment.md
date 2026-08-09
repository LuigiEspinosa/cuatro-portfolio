---
baseline_commit: c85f1ed148c83a9cc736463bd7fbed045bdc1f86
---

# Story 6.9a: Verification bundle and the published commitment

Status: in-progress

> **✂ SPLIT CARVE-OUT — decided by Cuatro on 2026-08-08, at the start of dev-story, on the
> recommendation block that used to sit here.** Story 6.9 as contexted was two stories' worth on the
> same evidence the epic has already split three times (6.4→6.4a/6.4b, 6.5→6.5/6.5b, 6.8→6.8a/6.8b),
> and *"split a story rather than ship a monster"* is a keep-doing agreement in every retro. The cut
> is the one the Tasks were already grouped for — **between T5 and T6**:
>
> | | scope | ACs | artifacts |
> |---|---|---|---|
> | **6.9a — the BUNDLE** (this file) | canonicalizer (3 runtimes), `verification_bundle` + `publish_bundle` + the projection RPC, the commitment, gate-4 vector, the four DB debts | AC1-AC4, AC10, AC11, AC12, AC13 (SQL/corpus half) | `0029`, `worker/ceremony/bundle.go`, `lib/roulette/canonical.ts`, `roulette/vectors/canonical-bundle.json`, `lib/ceremony/bundle.ts` |
> | **6.9b — the VERIFIER** ([6-9b-verificar-la-ceremonia.md](6-9b-verificar-la-ceremonia.md)) | TS ceremony orchestrator, `Verificar la ceremonia`, the verify strip, i18n, the four `lib/roulette` browser debts | AC5-AC9, AC12 (TS half), AC13 (browser half) | `lib/roulette/verify.ts`, `app/(viewer)/ceremonia/**`, `lib/i18n/es.ts` |
>
> **AC5-AC9 have been MOVED to 6-9b verbatim, not deleted** — a pointer stub stands in their place
> below so the numbering does not shift and nobody reads a gap as a dropped requirement. AC12 and
> AC13 are **carried by both** and scoped in each file to the surface that story actually ships.
>
> ⚠ **The one thing the split costs, stated plainly:** between 6.9a and 6.9b the tree holds a
> published, hashed, reveal-gated bundle that **nothing in a browser reads**. `worker/ceremony.Run`
> already has zero callers (DECISION I) and `publish_bundle` joins it. That is a known, recorded
> incompleteness for the length of one story, not a defect — but ⛔ **6.9a is not "done" in any user
> sense until 6.9b lands**, and epic AC1's PARTIAL stays PARTIAL until then.

> **⛔⛔ READ THIS BEFORE THE ACs — THE ONE THING THAT WILL SINK THIS STORY IF YOU GET IT WRONG.**
>
> The AC says the bundle contains `spin_plan`, `awards` and `players`, and publishes `bundle_sha256`
> **up front**. `0028:474-477` says publishing `spin_plan` up front *"would break AD-22 outright"*
> because it names every unrevealed spin's candidate pool. **Both are true.** The reconciliation is
> [SOLUTION-DESIGN:436-438](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L436) and [SPINE:223](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L223): **the HASH commits at ceremony start; the CONTENT
> releases progressively per spin and in full at completion.** One document, hashed once; a
> reveal-gated **projection** of it is what a viewer can read before completion. See **DECISION B**
> — this is the story's central decision and everything else hangs off it.
>
> ⚠ **The second thing:** `0025:8-10` quoting `SOLUTION-DESIGN:448-449` — *"the JS verifier needs
> NOTHING outside the bundle; if it does, the bundle is incomplete (a spec bug)."* That is a
> **completeness test you must actually run**, not a slogan. If your verifier reaches for
> `stat_snapshot_row` (anon holds **zero** grant on it, `0003:83-84`) or for `ceremony.spin_plan`
> (ungranted, `0028:501`), the bundle is wrong — not the grant.
>
> ⚠ **The third:** ⛔ **`stat_snapshot.content_sha256` is NOT `bundle_sha256` and you must not
> inherit its recipe.** [0024:760-762](supabase/migrations/0024_ceremony_lock_snapshot.sql#L760) says so in the file that computes it: *"This digest proves the
> captured bytes are the bytes and NOTHING more; 6.9 must not inherit it as a constraint."*
>
> ⚠ **The fourth:** ⛔ **`lib/roulette` ships to a BROWSER for the first time in this story.** Seven
> source files say so by name ([labels.ts:5-11](lib/roulette/labels.ts#L5) — *"6.9's 'Verificar la ceremonia' button pulls
> it into the browser bundle"*). Every ban that package carries — no `server-only`, no `node:`,
> **no third-party import at all**, no `Date`/`Intl`/`localeCompare`/`parseInt`/`**`/`<<` — becomes
> load-bearing here, and [prng.test.ts:668-676](lib/roulette/prng.test.ts#L668) pins the shipped-module list **by exact equality**,
> so a new module reddens it *by design* until you register it.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the eleventh story of the epic**, first half
Traces: **FR-27**, **FR-30** (the producer half) · AD-13, AD-14, AD-15, AD-19, AD-22, AD-7, AD-8, AD-17 · SOLUTION-DESIGN **§9.5** and **§9.6** · SPEC **Constraint 7** · `epics.md:1154-1175` (AC1-AC4, AC10-AC13) — ⚠ **AD-24 and the Spanish-UI half of `epics.md:1171-1175` are 6.9b's**, this story ships no viewer string
Consumes: 6.8b's reveal-gated posture (`0028`) and `reveal_spin` · 6.8a's `persist_ceremony` and the 40 rows it writes · 6.2's `lock_ceremony`, `ceremony.seed_demo_sha256`, `stat_snapshot`/`stat_snapshot_row` · 6.3-6.7's seven `lib/roulette` modules and seven golden vectors · 6.6's `luck_weight_table` · 6.1's `award` catalog
Hands to: **6.9b** (the TS orchestrator, `Verificar la ceremonia`, the verify strip, the four browser debts), **6.10** (the wheel, reduced-motion parity, the persistent verify-strip inside the reveal choreography, the shared-screen mirror), **6.11** (gate 5, the end-to-end vector from a real snapshot, `--check` automation)

---

## ✅ The seven questions, ANSWERED — Cuatro, 2026-08-08, before the first line of code

These were carried as *"answer before dev; each changes what gets built"*. They are answered; the
Questions section at the foot of this file is kept only as the record of what was asked.

1. **FR-21 floors (`24` rounds / `20` kills) — ACCEPT AS MEASURED, ship.** Asked for the third time,
   answered the same way as 6.8b's Q2. ⛔ **This story therefore cryptographically commits a ceremony
   in which 0 of 28 players clear either floor**: twelve `no_eligible_players` cards and 28 identical
   consolation prizes, measured independently by nine stories (`rounds_played` 10-21 vs a floor of
   24; `kills` 1-12 vs 20). After `publish_bundle` runs, moving the floors costs a new snapshot, a new
   ceremony and a new commitment. Recorded, not narrated around — see DECISION G.
2. **Split — YES.** 6.9a (this file, T0-T5) and 6.9b. See the carve-out block above.
3. **Mid-ceremony prefix commitment — NOT added; the gap is ACCEPTED and documented.** Between
   `published_at` and `state='complete'` a viewer cannot bind the served prefix to `bundle_sha256`,
   because a prefix is a different document. That is what §9.5's timing sentence describes; per-spin
   hashes are specified nowhere and would be new design. ⚠ The cost is stated in Completion Notes
   here and must be stated **in the UI** by 6.9b (its AC6).
4. **The gate-number swap (`README` ↔ `SOLUTION-DESIGN:441-445`) — RESOLVED, in writing, this way:**
   **6.9a adds its row under the README's existing numbering as gate 4, and 6.11 renumbers both
   documents together when it lands the last row.** Noting it a third time was not an option; this is
   a decision, and 6.11's story must carry it as an obligation, not a discovery.
5. **`worker/ceremony.Run`'s zero callers — stays open, Epic 7's.** `publish_bundle` and the bundle
   builder join it: the QA harness is the only caller and it gets deleted. ⛔ No production entry
   point is built here (DECISION I). Re-record it in `deferred-work.md`, do not silently inherit it.
6. **`deferred-work.md:372` (`ceremony_locked` blocking a late `bind_match_demo`) — confirmed Epic 7's.**
   Its home was *"Epic 7, or 6.9 if the verification bundle turns out to need late-bound demos"*.
   Under DECISION B the bundle is frozen at publish, so it does **not** need them. The conditional is
   discharged.
7. **Client-side verification performance budget — 2 s on a mid-range phone** for the 49-byte,
   28-player, 12-award ceremony. No budget exists in any artifact (measured); this story authors one.
   ⚠ 6.9a cannot measure it — there is no browser path until 6.9b. **6.9a's obligation is to record
   the number as the bar 6.9b must hit**; the measurement is 6.9b's AC13.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

---

## Story

As a skeptical viewer,
I want the ceremony published as one canonical, hashed document whose commitment is fixed before the
first spin and whose contents are released only as spins are revealed,
so that there is something to recompute against — and so the system can never serve me an unrevealed
winner even if it wanted to.

⚠ **The recomputation itself is 6.9b's.** 6.9a's deliverable is the *artifact and its access posture*:
the canonical bytes, the commitment that binds them, the reveal-gated projection that serves them, and
the proof — by pgTAP walk and by mutation — that the projection can never run ahead of the reveals.

---

## Acceptance Criteria

**AC1 — `verification_bundle` exists, carries the canonical bytes, and the row is gated on publication.**
**Given** the specced DDL at [SOLUTION-DESIGN:235-245](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L235) (marked *"intent; not final SQL"*, `:49`), the policy sketch at `SOLUTION-DESIGN:293` (`verification_bundle: public select using (published_at is not null)`), and that **five migrations home this table to 6.9 by name** ([0023:34](supabase/migrations/0023_award_catalog.sql#L34), [0024:144](supabase/migrations/0024_ceremony_lock_snapshot.sql#L144), [0025:76](supabase/migrations/0025_ceremony_results.sql#L76), [0026:49](supabase/migrations/0026_pity_award_result.sql#L49), [0027:157](supabase/migrations/0027_ceremony_run.sql#L157), and [0028:90](supabase/migrations/0028_reveal_gating.sql#L90) — *"⛔ THIS MIGRATION CREATES NO `verification_bundle` TABLE"*),
**When** migration `0029` ships,
**Then** `public.verification_bundle` is created with `id`, `tournament_id`, `ceremony_id` (**unique**), `snapshot_id`, `seed_demo_sha256`, `algorithm_version`, `bundle_sha256`, **`payload_canonical text`** (the exact canonical bytes that were hashed), **`payload jsonb`** (the same document, for the SQL projection), `published_at`, `released_at`,
**And** it is `enable` + `force row level security` with **two separate, never-OR'd** policies in the [0002:87-98](supabase/migrations/0002_rls.sql#L87) house form — `verification_bundle_viewer_read … to anon, authenticated using (published_at is not null)` and `verification_bundle_admin_read … to authenticated using ((select public.is_admin()))`,
**And** the viewer grant is **COLUMN-scoped** — `grant select (id, tournament_id, ceremony_id, algorithm_version, bundle_sha256, published_at, released_at) on public.verification_bundle to anon, authenticated` — so ⛔ **`payload_canonical`, `payload`, `snapshot_id` and `seed_demo_sha256` stay UNGRANTED**: the commitment is readable the instant it is published, the *content* is not (DECISION B), and `0028:481-483`'s fail-closed rule (*"a column added later is un-granted by default … ⛔ do not 'fix' a future 42501 with a table-wide grant"*) is restated at the site,
**And** `service_role` holds `select, insert, update` and **no DELETE**, matching `ceremony`'s posture ([0024:253](supabase/migrations/0024_ceremony_lock_snapshot.sql#L253)).

**AC2 — the RFC-8785 canonicalizer exists in all three runtimes, is the SAME function, and is proven by a golden vector — not by reading each other.**
**Given** that **zero canonicalization code exists anywhere in this repo** (measured: `JSON.stringify` appears only inside error-message construction; Go has one incidental `json.Marshal` sorted-key note at `worker/db/db.go:377`), that `lib/roulette` is **banned from every third-party import** ([prng.test.ts:706-711](lib/roulette/prng.test.ts#L706) — *"Relative only"*), and the three seam rules ([roulette/vectors/README.md:13-24](roulette/vectors/README.md#L13) — *"Neither may be corrected by reading the other's source. When the two disagree, the vector decides"*),
**When** the canonicalizer ships,
**Then** `lib/roulette/canonical.ts`, `worker/ceremony/bundle.go` and `roulette/vectors/generate_vectors.py` each implement RFC-8785 (JCS) **from the spec text**: recursive key sort **by UTF-16 code units** (⭐ RFC-8785 §3.2.3 specifies exactly that — **JS `.sort()` is CORRECT here and must not be "fixed" to byte-lex; say so at the site**, because AC9 changes `.sort()` semantics 40 lines away in the same package), JSON-number serialisation restricted to the ES6 `Number::toString` subset, `\u` escaping per §3.2.2.2, no insignificant whitespace, UTF-8 output,
**And** the bundle is **ASCII-restricted** (§9.5) and the builder **refuses** a non-ASCII payload with a typed reason rather than emitting one — ⭐ which is the first thing in this project to give teeth to `deferred-work.md:265-266` (*award `name` accepts zero-width U+200B/200E/FEFF and has no length bound, and became viewer-visible at 6.8b*),
**And** a **new eighth golden vector** `roulette/vectors/canonical-bundle.json` is added — registered in `generate_vectors.py`'s `outputs` map (`:8421-8441`), parsed at runtime by **both** the Go suite and Vitest, covering: RFC-8785's own torture cases (number formatting incl. `1e+30`/`5e-324` refusal-or-form, key ordering across ` `-adjacent and supplementary-plane keys, escaping), an ASCII-violation refusal, and **an end-to-end `bundle_sha256` over the REAL ceremony's bundle** carried as data,
**And** ⛔ **never transcribe a vector value into source** ([README:83](roulette/vectors/README.md#L83)) and ⛔ **never "fix" the generator by reading the Go or TS implementation** ([README:914-916](roulette/vectors/README.md#L914)).

**AC3 — the bundle's content is exactly the seven specced keys, in integer form, and it is COMPLETE — the verifier needs nothing outside it.**
**Given** [SOLUTION-DESIGN:431-435](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) / `SPINE:222` / `epics.md:1164`, AD-19's integer-form contract, and the provenance split rule ([README:239-244](roulette/vectors/README.md#L239) — *"Magnitudes are decimal STRINGS; award fields are JSON integers … the split is by provenance, not by taste"*),
**When** the bundle is built,
**Then** its top-level keys are exactly `{algo_version, seed_hex, luck, spin_plan, awards, pity, players}` and:
| key | content | integer form |
|---|---|---|
| `algo_version` | `inclusivcup-roulette-1.0.0`, read from `ceremony.algorithm_version` which **this story is the first to write** ([0024:200](supabase/migrations/0024_ceremony_lock_snapshot.sql#L200): `-- SHELL — Story 6.9 writes 'inclusivcup-roulette-1.0.0'`) | string |
| `seed_hex` | `ceremony.seed_demo_sha256`, lowercase 64-hex — ⛔ **NEVER `tournament.fair_seed`** (DECISION C at `0028:104-114`) | string |
| `luck` | `{weight_table: [int…]}` from `ceremony.luck_weight_table` — ⭐ **resolve the three-name collision here and nowhere else** (`0025:76-80`: the column is `luck_weight_table`, the spine calls it `luck.weight_table`, the bundle key is `luck`) | JSON ints (bounded `int[]`) |
| `spin_plan` | per spin: `{spin, kind, label, live_count, pool: [award_id…], live: [award_id…], weights: [int…], total_weight, draws: [{n, r, consumed_after}…], bytes_consumed}` | JSON ints |
| `awards` | per award: `{award_id, name, bucket, class, deciding_stat, direction, secondary_stat, eff_num_key, eff_den_key, floor_rounds, floor_kills, priority}` + its result `{outcome_kind, deciding_value?, deciding_num?, deciding_den?, tie_ladder_exit_step?, winners: [steamid64…], is_shared, is_pity}` | floors/priority/exit-step JSON ints; deciding magnitudes **decimal strings** |
| `pity` | `{label, winless: [steamid64…], reveal_order: [steamid64…], draws: [{n,k,rejections,value}…], bytes_consumed}` — the shape 6.7 recorded for you at [6-7:1340-1343](_bmad-output/implementation-artifacts/6-7-pity-roulette.md#L1340) | JSON ints |
| `players` | the AD-19 integer-form snapshot per `stat_snapshot_row`: volume ints, rate `{num,den}`, `secondary`, `efficiency {num,den}`, `h2h`, `achievement_ts` **with the published absent-sentinel `-1`** ([6-2:108](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L108)), and eligibility inputs `rounds_played`/`kills`/`idle_dq` | **every magnitude a decimal string**; `achievement_ts` a decimal string too (provenance, not size — `README:367-371`) |
**And** every SteamID64 is a decimal **string** (already true in all three runtimes — `0001:39` `text`, Go `string`, TS `string`; **the only risk is a serializer that coerces**, so assert it),
**And** ⭐ **`spin.label` and `spin.bytes_consumed` are carried** — [deferred-work.md:363](_bmad-output/implementation-artifacts/deferred-work.md#L363) and [0027:1025-1032](supabase/migrations/0027_ceremony_run.sql#L1025) home them here by name (*"`label` is the domain-separation key 6.9's verifier re-opens each stream by … ⛔ Do NOT read them into a write without moving that decision to 6.9 first"* — **you are that move**, see AC10),
**And** the **completeness test is executed, not asserted**: the browser verifier is proven to run with **every** non-bundle read stubbed to throw, and Completion Notes name what that proved.

**AC4 — the commitment is published up front, validated not trusted, and `reveal_spin` refuses to spoil before it exists.**
**Given** AD-22 (*"The seed hash + `bundle_hash` are published up front as the commitment"*, `SPINE:223`), AD-8, AD-17, and the house RPC form ([0028:516-522](supabase/migrations/0028_reveal_gating.sql#L516)),
**When** an admin publishes the bundle,
**Then** `0029` adds `public.publish_bundle(p_ceremony_id bigint, p_payload text, p_bundle_sha256 text, p_actor text) returns jsonb` in the full house form — `security invoker`, `set search_path = ''`, unlocked peek → **`tournament` then `ceremony`** locks (⛔ **never `ceremony` first**, `0027:583-589`/`0028:524-528`: that is the 40P01 ABBA deadlock), every guard before any write, typed `{ok:false, reason:'<snake_case>'}` refusals, one `audit_log` row `action='publish_bundle'` with before/after, `revoke execute … from public` then `grant execute … to service_role`,
**And** it is **VALIDATED, NOT TRUSTED** (the `0027` thesis): the RPC recomputes `encode(sha256(convert_to(p_payload,'UTF8')),'hex')` and refuses `bundle_mismatch` if it differs from `p_bundle_sha256`; it refuses `non_ascii_payload`; it refuses if `seed_hex`/`algo_version` in the payload disagree with the frozen `ceremony` row,
**And** the closed refusal set — `no_ceremony` · `ceremony_not_spinning` · `already_published` · `reveal_in_progress` · `snapshot_missing` · `seed_missing` · `no_spins` · `bundle_mismatch` · `non_ascii_payload` · `payload_shape` · `seed_mismatch` · `algo_version_mismatch` · **`award_revealed_twice`** · `unknown_actor` — is declared **once**, in a comment, and the pgTAP suite reads it out of the function's own `prosrc` (⛔ never a literal copied beside it — AC12),
**And** ⭐ **`award_revealed_twice` closes [deferred-work.md:362](_bmad-output/implementation-artifacts/deferred-work.md#L362)**: `award_result_spin_award_key` is `unique (spin_id, award_id)` i.e. **per spin**, so the same trophy in two spins of one ceremony is representable; `0027:138-140` homed the cross-check to *"6.9, which hashes these bytes and would catch it in the bundle"* — **catch it, do not merely note it**,
**And** `reveal_spin` is `create or replace`d in `0029` to add a `bundle_not_published` refusal **before any write**, because a commitment published *after* the first reveal is not a commitment — ⛔ **the diff of the replaced body against `0028`'s is pasted in Completion Notes and contains only that change** (the rule 6.8a and 6.8b both followed; ⛔ **never edit `0001`-`0028`**).

---

> ## ⛔⛔ AC5 — AC9 ARE CARVED OUT TO 6.9b — DO NOT IMPLEMENT THEM HERE
>
> They are reproduced below **verbatim and unaltered**, for one reason only: they are the contract
> 6.9a's bundle must be *buildable against*, and a builder written without reading them will publish
> a document the verifier cannot consume. **Read them. Do not build them.**
>
> Their home is [6-9b-verificar-la-ceremonia.md](6-9b-verificar-la-ceremonia.md), which owns
> `lib/roulette/verify.ts`, `lib/roulette/canonical`'s browser registration beyond 6.9a's own module,
> `app/(viewer)/ceremonia/**`, `lib/i18n/es.ts`, and the four `lib/roulette` browser debts of AC9.
>
> ⚠ **The one AC9 item 6.9a MUST NOT defer** is the `LadderExitStep` NULL-spelling row: AC9 itself
> assigns 6.9 *"the **canonicalization** half — pick ONE spelling for the bundle and state it"*, and
> that spelling is a property of the published document, not of the verifier. **6.9a picks it** (see
> DECISION J); 6.9b consumes it. The same is true of `stage2-resolve.json`'s `unreachable_outcome_kinds`
> marker: the `OutcomeKind` closed set **is** a bundle contract, so the marker lands here.
> The other three AC9 debts — `crypto.subtle` feature detection, the `.sort()` byte-lex fix in
> `pity.*`/`sweep.*`, and `rejections`' float division — are 6.9b's, ⛔ **except** that the `.sort()`
> fix and the `rejections` fix are **outcome-affecting for `bundle_sha256`** and therefore change the
> bytes 6.9a hashes. **They must land before the corpus bundle of AC13 is published, or 6.9b will
> republish a different document.** See DECISION K — this is the split's sharpest edge.

**AC5 — the TypeScript ceremony orchestrator exists, and the browser reproduces the ceremony from the bundle alone.**
**Given** that [worker/awards/ceremony.go:19-26](worker/awards/ceremony.go#L19) states the gap in the file itself — *"GO ONLY, AND THE ABSENCE OF A TYPESCRIPT MIRROR IS DELIBERATE … a verifier needs an orchestrator only once it has a published bundle to verify against — **which is 6.9's deliverable** … THE COST, STATED PLAINLY: this file carries no cross-language proof until 6.11's gate 5"* — and [6-8a:497](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L497) homes the mirror to **6.9**,
**When** `Verificar la ceremonia` runs,
**Then** a new `lib/roulette/verify.ts` re-derives, **from the bundle alone**: `decodeSeedHex` → per spin `createStream(seed, stage1Label(S))` → `stage1Pick` → `resolveSpin(live, players, fr29Ladder)` → shelf threading → `createStream(seed, PITY_LABEL)` → `resolvePity`, and compares every published field,
**And** ⛔⛔ **the picks are `await`ed SEQUENTIALLY** — [stage1.ts:32-40](lib/roulette/stage1.ts#L32) W10, verbatim: *"NEVER `Promise.all` over the `liveCount` picks … two concurrent `read(4)` delivered de11f26e / 7b537ef2 where the true bytes are de7b92537ef2f26e … and `consumed` was IDENTICAL in the correct and the corrupt run … a **VERIFIER-ONLY divergence that would surface at 6.9 as the browser declaring a correctly produced ceremony unfair**"*,
**And** the reproduction is checked against the numbers 6.4b/6.5/6.6/6.7/6.8a **all measured on the real corpus**: main-spin total **22 bytes** (spins 1-10 = 2 bytes each, 11 and 12 = 1 each), pity **27 bytes / 27 draws**, whole ceremony **49 bytes**, drawn order `aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11` — ⭐ *"a change in that number is a defect, not a finding"* ([6-5:419](_bmad-output/implementation-artifacts/6-5-fr-29-tie-ladder.md#L419)),
**And** ⚠ **`bytes_consumed` is REPRODUCED, never re-derived** ([README:531-535](roulette/vectors/README.md#L531): *"the only externally visible proof that both runtimes walked the same stream … and the thing 6.9's browser must reproduce exactly"*).

**AC6 — the verifier can never compute a winner for an unrevealed spin, and that is proven by construction, not by policy.**
**Given** AD-22 (`SPINE:188`, `:223`) and DECISION B's release schedule,
**When** the ceremony is mid-flight at `k` reveals,
**Then** the served projection carries the **preface** (`algo_version`, `seed_hex`, `luck`, `players`) plus **only** the `spin_plan`/`awards`/`pity` entries whose spin has `revealed_at is not null`, and the verifier can therefore check, for spins `1..k`: the **Stage-1 draw** (stream → `uniform_int` → `live`, from `pool` ids + published `weights` + `label` alone — **no award metadata, no snapshot, zero spoiler**), and the **Stage-2/ladder/anti-sweep outcome** of the revealed award(s),
**And** ⭐ the un-served spins are **absent, not blanked** — an unrevealed spin has no `pool`, no `weights`, no `label`; ⛔ **a "redacted" placeholder is a defect**, because `pool` at spin 1 is the entire catalog and `weights` are derived from every candidate's provisional winner,
**And** the **full** bundle — the one whose canonical bytes hash to the committed `bundle_sha256` — is served only at `ceremony.state = 'complete'`, at which point the verifier additionally re-canonicalizes it and confirms the hash **matches the commitment published before the first spin**,
**And** ⚠ **the honest limitation is stated in the UI and in Completion Notes**: before completion a viewer can confirm every *revealed* outcome but **cannot** bind the served prefix to `bundle_sha256`, because a prefix is a different document. That is what *"released progressively per spin + in full at completion — verify confirms, never spoils"* buys and costs. **Measure it; do not narrate around it** (`epic-5-retro:43`).

**AC7 — the verify strip and `Verificar la ceremonia` ship on `/ceremonia`, in Spanish, from the one i18n module, in blue.**
**Given** AD-24, UX-DR13/14 (`epics.md:122` — *fixed load-bearing strings verbatim*), UX-DR24/27/48 (`epics.md:125` — *"persistent verify-strip with seed caption + `Verificar la ceremonia` (blue, not gold); evidence block is read-only, no in-app raise-dispute button"*), [DESIGN.md:273](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L273) and [EXPERIENCE.md:94](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L94),
**When** a viewer opens `/ceremonia`,
**Then** the Story-5.7 `<Placeholder>` is replaced by a page carrying the **verify-strip**: shield + the **already-shipped** `es.ceremony.seededByDemo` (`'Sembrado por el demo final · reproducible'`, [lib/i18n/es.ts:71](lib/i18n/es.ts#L71), marked `// FIXED — do not paraphrase` — ⛔ **never retype it**), the `SHA-256 <hash>` in `ink-muted` **truncated with the existing `truncateHash()`** ([lib/feed/model.ts:64](lib/feed/model.ts#L64) — ⛔ do not write a second truncator) and wrapped in `.num` (tabular numerals are a hard rule, `DESIGN.md:236` names *"demo hashes"* explicitly), and a button whose label is exactly **`Verificar la ceremonia`** in `accent-live` **blue, never gold** (UX-DR6/7 — gold is reveals/winners/champion only),
**And** every new string is a **new key in `lib/i18n/es.ts`** (AD-24, one module; `es.ts:6-8`: *"viewer components carry NO inline string literals"*) — and ⛔ **none of these five verification-outcome strings exists in any planning artifact, so you are authoring them**: matched · mismatched · unsupported MAJOR `algo_version` · not-yet-revealed · Web-Crypto-unavailable. Author them in the `EXPERIENCE.md:56-75` voice (*"Verificar la ceremonia"*, not *"Más info sobre la equidad"*) under a **new sibling key `es.verify`** — ⚠ **not** under `es.awards`, whose `es.test.ts:14` `AWARD_IDENTITY_STRINGS` guard would then bind it,
**And** the result is announced accessibly (UX-DR37) via the house `srOnly` + `aria-live="polite"` `role="status"` pattern — ⚠ `srOnly` is defined in **three CSS modules and is not global**, so a new surface needs its own copy,
**And** ⛔ **NO wheel, NO Stage-1/Stage-2 phase copy, NO trophy shelf, NO shared-screen mirror, NO `prefers-reduced-motion` choreography** — all 6.10's (`0028:209-210`). 6.9's affordance has no motion to reduce; **say so explicitly** rather than leaving the CRITICAL UX-DR32 rule looking unaddressed,
**And** ⛔ **no in-app dispute affordance** anywhere on or beside the strip (`SPEC.md:87`, a designed non-feature).

**AC8 — an unimplemented MAJOR `algo_version` is a refusal, not a guess.**
**Given** `epics.md:1171-1173` and [glossary.md:68](_bmad-output/specs/spec-cs-tournament/glossary.md#L68) (*"a MAJOR bump signals an outcome-affecting change; a client refuses to 'verify' a MAJOR it does not implement"*),
**When** the verifier reads `algo_version` from the bundle,
**Then** it parses `<name>-<major>.<minor>.<patch>`, compares against a **real exported constant** — ⚠ **there is none today**: `inclusivcup-roulette-1.0.0` exists only as `generate_vectors.py:90`'s `ALGO_VERSION`, a shell-column comment, and **eleven asserted literals** across both suites ([ladder_test.go:454-456](worker/awards/ladder_test.go#L454): *"`algo_version` WAS ASSERTED ONLY BY THE TYPESCRIPT SUITE … It is the field 6.9 canonicalizes into `bundle_sha256`"*) — and **refuses with a typed reason and Spanish copy** on an unknown MAJOR, an unknown name, or an unparseable string,
**And** ⛔ **do not conflate the two version axes**: the label prefix's `v1` ([labels.go:34-35](worker/awards/labels.go#L34) — *"bumping it is a deliberate, ceremony-invalidating act, not a refactor"*) is domain separation, **not** `algo_version`; ⛔ and `6-3:192` stands — *"do not put `algo_version` logic in `prng.ts`"*.

**AC9 — the four `lib/roulette` browser debts homed here are CLOSED, not re-recorded.**
**Given** that each names 6.9 as its home and each becomes reachable **the moment this story ships the package to a browser**,
**When** the verifier lands,
**Then**:
| debt | source | the fix, as prescribed |
|---|---|---|
| `crypto.subtle` dereferenced with **no feature detection**, in the one module built for the browser | [deferred-work.md:289](_bmad-output/implementation-artifacts/deferred-work.md#L289) (`prng.ts:137,180`) | it is `undefined` in any non-secure context, so the button *"fails as `TypeError: Cannot read properties of undefined` from inside `read()` rather than as a typed refusal"* → a named, typed refusal **plus** the Spanish copy from AC7 |
| ⭐⭐ **TS `.sort()` is UTF-16, not byte-lex** — `sweep.ts` **and** `pity.ts` | [deferred-work.md:335](_bmad-output/implementation-artifacts/deferred-work.md#L335), [:356](_bmad-output/implementation-artifacts/deferred-work.md#L356) | *"⭐ The concrete fix: carry `stage2.ts`'s `STEAMID64_RE` into `pity.*` and `sweep.*` **in all three runtimes**, which makes the byte-lex claim true by construction"* — ⚠ *"a divergent `winless` yields a divergent `reveal_order` while `draws` and `bytes_consumed` stay IDENTICAL — so the byte-accounting gate this epic was built on **structurally cannot see it**"* |
| `rejections` uses **float division** in TS, integer in Go/Python; no vector row has `k != 1` | [deferred-work.md:348](_bmad-output/implementation-artifacts/deferred-work.md#L348) | `rejections` is a published `draws[]` field → outcome-affecting for `bundle_sha256`. Make it integer in TS; add the `k != 1` vector row **or** record in writing why not |
| `LadderExitStep` spells "none" **two ways** across the seam (Go `int` with `0`; TS omits the key) | [deferred-work.md:307](_bmad-output/implementation-artifacts/deferred-work.md#L307) | *"any serialization comparison must special-case the two spellings of NULL"* — 6.9 owns the **canonicalization** half: pick ONE spelling for the bundle and state it |
| `stage2-resolve.json` declares `"shared"`, a kind its own stage cannot produce, with no unreachable marker | [deferred-work.md:316](_bmad-output/implementation-artifacts/deferred-work.md#L316) | *"The right home is where the kind vocabulary is canonicalized"* — the `OutcomeKind` closed set **is** a bundle contract; add the `unreachable_outcome_kinds` marker `antisweep-resolve.json` already uses |
**And** ⛔ **the `.sort()` fix and AC2's JCS key-sort are OPPOSITE requirements 40 lines apart.** JCS sorts object keys by **UTF-16 code units** (RFC-8785 §3.2.3) — JS-native and correct. The engine sorts **steamid64 arrays byte-lex**. **Comment both, at both sites**, or the next reader "unifies" them and breaks one.

> ## ⛔ END OF THE CARVED-OUT BLOCK — AC10 onward is 6.9a's again

---

**AC10 — the four DATABASE debts homed here are CLOSED, and each one is a one-line change with a real failure mode.**
**Given** `sprint-status.yaml:46`'s consolidated hand-off and `0028`'s own OUT OF SCOPE block,
**When** `0029` ships,
**Then**:
1. ⭐ **`ceremony.luck_weight_table` is FROZEN once the ceremony leaves `not_started`** — [deferred-work.md:361](_bmad-output/implementation-artifacts/deferred-work.md#L361): *"It is an INPUT every drawn byte is a pure function of … editing it after a run silently changes what a re-derivation produces while `snapshot_id` and `seed_demo_sha256` — **the two things a verifier checks** — both still match."* The mechanism is `assert_ceremony_transition`'s frozen-column section ([0027:514-554](supabase/migrations/0027_ceremony_run.sql#L514)), `create or replace`d with a **state-conditional** clause + `IC910`. ⚠ Read [0027:99-116](supabase/migrations/0027_ceremony_run.sql#L99) (DECISION 4) first: it is deliberately **not** a column allowlist, and `algorithm_version`/`spin_plan` must stay writable for *your own* writes.
2. **`tournament.fair_seed` gets a column-scoped grant** — [deferred-work.md:370](_bmad-output/implementation-artifacts/deferred-work.md#L370) and [0028:134-137](supabase/migrations/0028_reveal_gating.sql#L134): *"⭐ HOMED TO 6.9, which builds the verifier and therefore owns which column a verifier reads. **The fix is a column-scoped grant on `tournament` — NOT a change to 0028.**"* ⚠ Two live hazards: (a) this is the tree's **first `revoke … on table`** (only `revoke execute on function` exists today, `0028:121-122`); (b) `tournament` has **nine** columns and `grace_period_seconds` was added at `0015:75-76`, *after* `0002`'s grant — a naive "copy `0001`'s list" **silently breaks the 4.5 grace timer and the 5.7 surfaces**. Enumerate all nine, grant eight, prove the viewer pages still render.
3. **`spin` gains `label text` and `bytes_consumed bigint`** (nullable, with the sentinel documented) and `persist_ceremony` is `create or replace`d to write them — `0027:1025-1032` says *"⛔ Do NOT read them into a write without moving that decision to 6.9 first."* ⛔ **Paste the diff** of the replaced body; it must contain only that change.
4. **`spin` gains `check (spin_index > 0) is true`, NAMED** — `0028:643-653`: *"the durable fix … belongs with a migration that owns that table"*, and `IC911`'s density theorem is *"sound only over positive integers"*. R11 (`0028:74-76`): a CHECK that can evaluate NULL is **satisfied** — write it `(…) is true`.
**And** ⚠ **a CLEAN-APPLY NOTE is mandatory** ([0028:227-229](supabase/migrations/0028_reveal_gating.sql#L227): a missing one *"reads as an oversight"*): `0029` adds validated CHECKs and new columns to **non-empty** tables in any database that has run a ceremony — that is the 4.3 trap every Epic-6 header carries. Prove `0029` applies both on a fresh `supabase db reset` **and** against the QA corpus.

**AC11 — the vector gate is added, the ownership table is updated, and the numbering contradiction is handled deliberately.**
**Given** [README.md:26-49](roulette/vectors/README.md#L26)'s ownership table (*gate 4 — canonical JSON + `bundle_sha256` (RFC-8785) | Story **6.9** | ⏳*) and its recorded warning that *"the gate numbers in the two right-hand rows are the REVERSE of `SOLUTION-DESIGN:441-445` … **Renumbering a shipped table is 6.9's or 6.11's call to make together with the document**"*,
**When** the gate lands,
**Then** the README's gate-4 row flips to ✅ with the new file named, the format rules (`README:91-102`) are obeyed byte-for-byte (LF, 2-space, stable key order, **no float, no big integer as a JSON number**), and `python roulette/vectors/generate_vectors.py --check` reports **OK on all eight** with `git status roulette/vectors/` **empty**,
**And** the numbering contradiction is resolved **explicitly, in writing, one way or the other** — ⛔ noting it a third time is not a resolution (6.7 noted it, 6.8a noted it). See Question 4,
**And** ⚠ **nothing runs `--check` automatically** — this repo has **no CI at all** ([README:911-912](roulette/vectors/README.md#L911), `deferred-work.md:299`, homed to 6.11). It is a manual gate; run it and paste the output.

**AC12 — pgTAP, mutation, and the closed-set discipline this project has failed seven times.**
**Given** Epic-5 retro Action Item #3 (a reviewer-independent mutation pass is a **review gate**) and the project's signature defect,
**When** the suite ships,
**Then** `supabase/tests/0029_<slug>_test.sql` follows the house shape exactly — `begin;` → extension → `set local search_path` → **a `plan(N)` accounting block whose per-section counts RECONCILE to the body's banners** → sections → `finish(); rollback;` — with fixtures re-derived **by name** through `create temporary view f` (never `limit 1`), a row on the **FALSE side of every predicate**, and `pg_temp.probe_*` helpers so a RAISING mutant reddens one named test instead of aborting the transaction,
**And** ⭐ **every closed-set assertion READS ITS EVIDENCE** — the refusal set from the function's `prosrc`, the policy set from `pg_policy`, the granted column set from `information_schema.column_privileges` — ⛔ **never from a literal copied beside it** ([6-8a:909](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L909), the seventh occurrence: *"`if len(inputReachable) != 6` measures the size of a map literal written two lines above it"*),
**And** ⚠ **`bool_and` over a filtered set returns TRUE when a name is ABSENT** — every "all of these are X" assertion asserts the **count** first; and a `count(*) = 0` guard is vacuous when zero rows match the `where` clause at all (`6-8b:921`),
**And** ⛔ **[0028_reveal_gating_test.sql:1076-1080](supabase/tests/0028_reveal_gating_test.sql#L1076) was written FOR you and names you**: *"6.9 is named, in this very migration, as the story that widens this row. A later `grant select (bundle_sha256) on public.ceremony to authenticated` left the anon array untouched (green) … The grantee is now part of the asserted value."* ⭐ **This story does NOT widen `ceremony`'s grant** (DECISION E) — so **prove the guard is non-vacuous** by mutating a widening grant in and watching it redden, and close `6-8b:920`'s remaining anon-only gap for `authenticated` too,
**And** ⚠ **[0024_ceremony_lock_snapshot_test.sql:430-435](supabase/tests/0024_ceremony_lock_snapshot_test.sql#L430)'s `columns_are` on `ceremony` is EXACT** — *"a renamed, dropped or SPECULATIVELY ADDED column reddens here"*. It must stay green, which is a positive proof that `bundle_sha256` did **not** land on `ceremony`,
**And** the mutation pass runs a **control pass on unmutated source first** (void the run unless green), reads/writes mutation files as **BYTES** (6-4a lost 12 of 18 to a CRLF round-trip), uses whole-suite runners never a `-run` filter, reports `NOT-APPLIED` as an outcome distinct from `killed`, verifies restoration by **SHA-256**, and records the **full** per-mutation table including **survivors and your own bad mutants** — *"a mutation matrix is only worth its weakest mutant"* ([6-8a:991-995](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L991)); ⚠ and *"KILLED (migration refuses to apply)"* is **not a kill** (`6-8b:926`).

**AC13 — ⛔ THE BAR: proven over the REAL corpus, with the grep's non-vacuity measured.**

> **✂ Split scoping — read before you plan the harness.** AC13 is carried by **both** halves.
> **6.9a owns every bullet below except the four that require a browser to interact with**: tapping
> `Verificar la ceremonia`, the rendered result copy, the announced `aria-live` text and the elapsed
> time, and the three refusal paths exercised *in the browser*. Those move to 6.9b with the button.
> ⛔ **6.9a does NOT get to skip the Next build.** AC10.2 revokes and re-grants `tournament`
> column-by-column — the single most likely way this story silently breaks a viewer page — so the
> LOCAL-`NEXT_PUBLIC_*` build, the page byte sizes and the corpus-name hit count are **6.9a's**, and
> they are what proves the AD-22 grep non-vacuous *and* proves the grant did not break 4.5's grace
> timer or 5.7's surfaces. The browser here is a **renderer under test**, not an interaction target.
**Given** *"measure zeros, never narrate them"* ([epic-5-retro:43](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L43)), 6.8a's hard-won correction that *"a grep over an empty error page proves nothing"*, and Epic-5 retro Action Item #4 — **two-session browser live-QA is the bar for any client-state story**, and this story ships a button,
**When** the story is signed off,
**Then** Completion Notes record, measured on a local stack rebuilt to the standing anchors (**204 rounds · 28 roster · `fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0 · 12 awards · 40 spins / 40 award_result / 28 award_result_winner**):
- the bundle **built, canonicalized, hashed and published**, with its byte length, its `bundle_sha256`, and the **same run repeated** producing byte-identical canonical bytes (the 6.8a determinism form: two runs, compared as bytes, one SHA-256);
- the anon-visible projection **before any reveal**, after **each** of the 40 reveals, and at completion — the served spin set must be **strictly monotone and equal the revealed prefix exactly, never one row more**;
- ⭐ the **full-bundle release** at `state='complete'` re-canonicalized in the browser and **matching the `bundle_sha256` published before spin 1**;
- ⭐ **a real browser**, two sessions, over the local build: `Verificar la ceremonia` tapped mid-ceremony and at completion, with the rendered result copy, the announced `aria-live` text, and the elapsed time (⚠ **no performance budget exists anywhere in the PRD/SPEC/UX** — you are choosing it; state the number);
- the three refusal paths exercised in the browser: unknown MAJOR `algo_version`, a tampered bundle byte, and `crypto.subtle` absent;
- ⭐⭐ **Build the Next app with the LOCAL `NEXT_PUBLIC_*`** — they are inlined at build time; against the remote project every page renders `No pudimos cargar el evento` at ~11 KB and **every grep comes back falsely clean** (6.8a's first sweep did exactly this). Prove non-vacuity by printing **page byte sizes and a corpus-name hit count** (6.8a's re-run: 66 KB / 37 KB, 28 distinct player names each);
- the two-sided AD-22 grep at `k=0`, an intermediate `k` and `k=40`: revealed award names **APPEAR**; every unrevealed name, the un-served `spin_plan` entries, `snapshot_id` and the un-released `payload` **DO NOT**;
- the `audit_log` row for `publish_bundle` **counted, not asserted**;
- ⚠ **`supabase db reset` before the pgTAP run** (every story since 6-4a leaves the QA corpus in the DB) and ⚠ **WinNAT eats port `54322`** — elevated `net stop winnat` / `net start winnat`; Kong can remap to host `55321` while `supabase status` still says `54321`.

---

## Tasks / Subtasks

> **✂ The split line is between T5 and T6, and it has been taken.** 6.9a's build order is:
> **T0 (read)** → **T1 (pin the semantics in comments)** → **T2 (canonicalizer ×3 + gate-4 vector)** →
> **T3 (migration `0029`)** → **T4 (`publish_bundle` + the projection RPC + the `reveal_spin` /
> `persist_ceremony` replacements)** → **T5 (pgTAP + Go/TS bundle-builder tests)** →
> **T8 (mutation)** → **⛔ T9 (THE BAR) gates sign-off** → **T10 (gates)**.
> ⛔ **T6 and T7 are 6.9b's and are struck through below, kept in place so the numbering holds.**
> ⚠ **Write the canonicalizer before anything that hashes.** It is the only component with a
> language-neutral contract, and `SOLUTION-DESIGN:446-449` puts it second in the build order for
> exactly that reason.

- [ ] **Task 0 — Read before you write** (⛔ do not skip; every line below was chosen because getting it wrong is a known, named defect in this repo)
  - [ ] ⭐ [SOLUTION-DESIGN §9.5](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) `:431-438` **and §9.6** `:440-449` — the only field-by-field bundle sketch that exists, and the *"the JS verifier needs nothing outside the bundle"* completeness test. Then `:235-245` (the `verification_bundle` DDL sketch — ⚠ marked *"intent; not final SQL"* at `:49`), `:293` (the policy sketch), `:264-300` (the whole RLS section), `:31` (the browser-verifier topology row), `:453-471` (the Spanish table — `verify.button` at `:460`).
  - [ ] ⭐ [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) (AD-22 — note it names **two** predicates), `:210-223` **in full** (the provably-fair contract + ⭐ `:223`, the commitment-and-reveal-timing paragraph this story implements), `:140-153` (AD-13/AD-14/AD-15), `:170-173` (AD-19), `:195-198` (AD-24 — your `_Traces:` AD), `:110-113` (AD-7 — names `verification_bundle` in the reveal-gated set), `:73-76` (⛔ **no dependency edge between `worker/*` and `app/`+`lib/`**; the two shared contracts are `supabase/migrations` and `roulette/vectors`), `:231` (integer-only, lowercase hex, co-winners as rows never arrays).
  - [ ] [SPEC.md:72](_bmad-output/specs/spec-cs-tournament/SPEC.md#L72) (Constraint 7), `:74` (C9, the fixed Spanish strings), `:75` (C10), `:87` (the dispute non-goal), `:97` (*"fairness-affecting values are published in the verification bundle so tuning stays reproducible"* — this is why AC10.1 exists), `:54-57` (CAP-6). Then [glossary.md:24](_bmad-output/specs/spec-cs-tournament/glossary.md#L24), `:66-70`, `:83-85`.
  - [ ] ⭐ [roulette/vectors/README.md](roulette/vectors/README.md) — `:13-24` (the three seam rules), `:26-49` (the ownership table **and the numbering warning**), `:83-89`, `:91-102` (format rules), `:239-244` + `:367-371` (⭐ **the provenance split: magnitudes are decimal STRINGS, catalog/algorithm fields are JSON integers**), `:531-535` (`bytes_consumed_after` — *"the thing 6.9's browser must reproduce exactly"*), `:820-848` (the spec block a verifier implements), `:911-916`, `:935-943`.
  - [ ] ⭐ [generate_vectors.py](roulette/vectors/generate_vectors.py) `:2-105` (docstring, `ALGO_VERSION` at `:90`, `LABEL_PREFIX`, `REAL_SEED`), `:8411-8464` (⭐ `render()` — note **`ensure_ascii=False`**; the bundle is ASCII-restricted and **this is not the same renderer**; the `outputs` map you register into; and `--check`'s ⛔ *"COMPARED AS BYTES, not as text"* note).
  - [ ] ⭐ [lib/roulette/prng.test.ts:649-896](lib/roulette/prng.test.ts#L649) **in full** — the exact-equality module list (`:668-676`), the per-module import-graph pin (`:788-822`), the `server-only`/`node:`/third-party bans (`:693-711`), the 16-item banned-construct list (`:853-886` — `Date`, `Intl.`, `localeCompare`, `parseInt`, `parseFloat`, `Math.round`, `Number.EPSILON`, `**`, ` << `, ` >> `, ` >>> `, …), and the positive control (`:891-896`). **Your two new modules must be registered in all of it.** Then [test/source-scan.ts](test/source-scan.ts) `:4-8`.
  - [ ] ⭐ [lib/roulette/stage1.ts:32-48](lib/roulette/stage1.ts#L32) (**W10 — sequential `await`, the verifier-only divergence**, and *"a Stream round-tripped through JSON in a 6.9 bundle, say"*), [prng.ts:17-42](lib/roulette/prng.ts#L17) (⛔ no `node:crypto`; why the API is async; `Bytes = Uint8Array<ArrayBuffer>`; *"`npm test` does NOT typecheck"*), [labels.ts:5-12](lib/roulette/labels.ts#L5) (⛔ the no-`server-only` invariant, written for you), [stage2.ts:117-320](lib/roulette/stage2.ts#L117) (`rungKey`, `SnapshotPlayer`, `DecidingValue`, the five-arm `Outcome`, `OUTCOME_KINDS`), [ladder.ts:125-147](lib/roulette/ladder.ts#L125) (`ABSENT_ACHIEVEMENT_TS = -1n`, the exit steps), [pity.ts:104-199](lib/roulette/pity.ts#L104), [sweep.ts:102-190](lib/roulette/sweep.ts#L102).
  - [ ] ⭐ [worker/awards/ceremony.go:19-26](worker/awards/ceremony.go#L19) (the Go-only declaration and the cost), `:177-185` (the plan is a **record**, not a prediction), ⭐ `:456-464` (**"THE POOL SHRINKS BY WHAT WAS *DRAWN*, NOT BY WHAT WAS *ASSIGNED*" — recorded so your bundle spec does not inherit the story's wrong phrasing**), `:186-304` (the `SpinPlanEntry`/`CeremonySpin`/`CeremonyRun` shapes). Then [worker/ceremony/ceremony.go:100-104](worker/ceremony/ceremony.go#L100) (⭐ *"`AwardID` IS `award.id` RENDERED AS DECIMAL … **Story 6.9 owns whatever identity the published bundle carries**"*), `:149-166` (the AD-19 wire shape; ⛔ every magnitude parsed as `big.Int` from decimal text), `:306-348` (the existing `Payload` — **not** the bundle, but the only JSON projection in the tree), `:528-530`.
  - [ ] ⭐ [0028_reveal_gating.sql:85-137](supabase/migrations/0028_reveal_gating.sql#L85) (DECISION A + DECISION C + the `tournament.fair_seed` correction homed to you), `:203-234` (OUT OF SCOPE + the clean-apply block), `:473-511` (⭐ **the four ungranted columns and why**, the PostgREST `select=*` consequence, the fail-closed rule), `:516-535` (the RPC form + the lock-order block + the closed-reason declaration), `:643-653` (the owed `spin_index > 0` CHECK), `:726-741` (the `timeline_feed` second-writer safety argument), `:920-928` (the revoke/grant), `:1928-1936` (the restrictive-policy answer).
  - [ ] [0027_ceremony_run.sql:78-97](supabase/migrations/0027_ceremony_run.sql#L78) (the `OutcomeKind` closed set is *"the contract 6.9's bundle canonicalizes against"*; the rate pair that *"cannot ROUND-TRIP to the pair 6.9's bundle must publish"*), `:99-143` (DECISION 4 + DECISION 6), `:169-178` (the clean-apply trap), `:316-328` (⭐ **`security definer` under FORCE RLS depends on the owner's `BYPASSRLS`** — read twice, see DECISION F), `:476-567` (`assert_ceremony_transition` + IC910 — you are extending it), `:583-589` (the lock order), `:1025-1032` (⛔ `label`/`bytes_consumed`, **the decision you are making**), `:1183-1188`.
  - [ ] [0024_ceremony_lock_snapshot.sql:143-171](supabase/migrations/0024_ceremony_lock_snapshot.sql#L143) (OUT OF SCOPE), `:194-211` (the `ceremony` DDL + ⭐ `:200`'s `algorithm_version` shell naming your literal), `:234-253`, `:300-325` (IC908 verbatim), ⭐ `:747-762` (**the `content_sha256` recipe and the ⛔ "6.9 must not inherit it" instruction**). Then [0023:196-206](supabase/migrations/0023_award_catalog.sql#L196) (*"IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22"* + `award_catalog_count`, the tree's **only** anon-reachable `security definer`), [0003:33-84](supabase/migrations/0003_audit_snapshot.sql#L33) (`stat_snapshot_row` = *"the verifier's integer-form contract; write-once"*, and **zero anon grant**), [0002:50,69-79](supabase/migrations/0002_rls.sql#L50) (`tournament`'s table-wide grant — AC10.2's target), [0025:7-11](supabase/migrations/0025_ceremony_results.sql#L7) (⭐ the thesis: anti-sweep is producer-side *because* the 6.9 verifier must reproduce from the bundle alone), `:76-80` (the three-name collision), `:234-236`, `:452-460`.
  - [ ] [deferred-work.md:289-372](_bmad-output/implementation-artifacts/deferred-work.md#L289) — **the whole Epic-6 tail**. Eleven entries name 6.9; AC9 and AC10 carry ten of them and Question 5 carries the eleventh. Read `:290` too (**effectively unowned, and it lives in `prng.ts`**).
  - [ ] [6-8b-…md](_bmad-output/implementation-artifacts/6-8b-reveal-gating-and-commitment.md) — its **Completion Notes** (the measured anon posture, the walk, the column-grant behaviour) and its **Review Findings** in full (`:911-926`: the unqualified policy join, the `Set<string>` + cast defeating exhaustiveness, the section-banner arithmetic, ⭐ `:920` **the guard that will not catch your grant**, `:921` the three vacuous `count(*)=0` guards, `:926` the two kills that prove nothing).
  - [ ] [6-8a-…md:487-503](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L487) (the four 6.9 rows of *"Explicitly NOT this story"*), `:327-343` (the flagged pairing departure), `:633-684` (⛔ **the FR-21 zero as rows, the byte accounting, and the determinism proof**), `:744-752` (**THE BAR found a defect no suite could** — `BuildPayload` never populated `seed_hex`, *"which is what a verification bundle needs anyway"*), `:889-891` (the three decision-needed items with a "home to 6.9" option).
  - [ ] [lib/i18n/es.ts](lib/i18n/es.ts) **in full** — especially `:6-8` (the no-inline-literals rule), `:51-55` (`es.award`), `:67-72` (`es.ceremony`, ⭐ `:71` `seededByDemo` FIXED), `:89-94` (`es.placeholder`), `:153-172` (`es.awards` **and its header's ⚠ NO GOLD rule**), `:198-205` (`es.provenance` — the closest existing thing to a verify strip), `:212-251` (the helper functions). Then [es.test.ts:14,52-57](lib/i18n/es.test.ts#L14).
  - [ ] [app/(viewer)/leaderboards/LockedAwards.tsx](app/(viewer)/leaderboards/LockedAwards.tsx) **in full** — the house form for a security-argued viewer component (the header, the `.num` usage, the `srOnly` a11y split, and ⭐ `:4-14`'s *"the identity is not blurred — it is ABSENT"*). Then [app/(viewer)/ceremonia/page.tsx](app/(viewer)/ceremonia/page.tsx) (the 9-line Placeholder you replace), [app/globals.css:1-76](app/globals.css#L1) (dark-only tokens, `--gold` at `:24`, `.num` at `:72-76`), [lib/supabase/browser.ts:12-27](lib/supabase/browser.ts#L12), [lib/realtime/status.ts:6-14](lib/realtime/status.ts#L6) (⭐ **the one precedent for a browser-reachable `lib/` module outside `lib/roulette`, and the type-only-import escape hatch**), [lib/feed/model.ts:64](lib/feed/model.ts#L64) (`truncateHash`), [lib/ceremony/reveal.ts](lib/ceremony/reveal.ts) **in full** (the *newer, stronger* typed-refusal form — ⛔ copy this, not `lock.ts`'s cast-based one), [lib/admin/command-route.ts:41-117](lib/admin/command-route.ts#L41), [lib/admin/route-coverage.test.ts:10-53](lib/admin/route-coverage.test.ts#L10), [vitest.config.ts](vitest.config.ts) (⚠ `include: ['lib/**/*.test.ts']` — **`.test.tsx` and anything under `app/` silently never run**).
  - [ ] Sweep-prove the greenfield claim before writing a line: **nothing named `verification_bundle`, `bundle_sha256`, `bundle_hash`, `publish_bundle`, `canonical`(-as-JCS), RFC-8785, `Verificar`-as-a-string, or any `algo_version` source constant exists in `supabase/`, `lib/`, `app/`, `worker/` or `roulette/`.** (Confirmed at contexting — every hit is a hand-off comment or a shell. **Re-confirm, do not assume.**)

- [ ] **Task 1 — Pin the semantics IN COMMENTS before implementing (AC: 1-4, 6)**
  > Same discipline as 6.3's E1-E4, 6.5's L1-L12 and 6.8b's R1-R12. Each is a place where two honest
  > implementers reading §9.5's one paragraph build a different bundle. Each gets a named comment at
  > its site and an assertion in T5/T8.
  - [ ] **B1 — ONE document, hashed ONCE.** The commitment is `sha256` of the canonical bytes of the **full** bundle, computed before the first reveal. A prefix projection is a *different* document and does **not** hash to it. Never publish a second hash.
  - [ ] **B2 — the projection SUBTRACTS, it never blanks.** An unrevealed spin is **absent** from `spin_plan`/`awards`. ⛔ A `null`/`"redacted"` placeholder leaks cardinality-by-position and invites a reader to "fill it in".
  - [ ] **B3 — Stage-1 verification needs NO award metadata.** `pool` ids + published `weights` + `label` + the seed are sufficient to check the draw. That is *why* `weights` is a published field, and it is what makes progressive verification possible at all.
  - [ ] **B4 — `players` is published in FULL from the start, and that is not a leak.** It carries no award identity, and `public.leaderboard` (5.5) already publishes the same magnitudes to anon. State the reasoning at the site so nobody "hardens" it into a gate that breaks B3.
  - [ ] **B5 — magnitudes are decimal STRINGS by PROVENANCE, not by size.** Snapshot values and `achievement_ts` are strings even when small; catalog and algorithm integers stay JSON integers. `README:239-244`.
  - [ ] **B6 — JCS key order is UTF-16 code units; engine steamid64 order is byte-lex.** Two different, correct orderings in one package. Comment both. ⛔ Do not unify them (AC9).
  - [ ] **B7 — ASCII-restricted, and the refusal is real.** A non-ASCII payload is a typed refusal at publish, not a silently escaped string. This is the first constraint that bites `deferred-work.md:265-266`.
  - [ ] **B8 — `bundle_sha256` is the COLUMN name; `bundle_hash` is the spine's contract name for the same value.** Same precedent as `seed_demo_sha256` ↔ `seed_hex` (`6-2:246`). Say it once, in the migration header, and use it consistently.
  - [ ] **B9 — VALIDATED, NOT TRUSTED.** The RPC re-hashes the payload it is handed; a producer bug must not be able to publish a commitment that does not bind. `0027`'s thesis.
  - [ ] **B10 — the two version axes are different.** `algo_version` (`inclusivcup-roulette-1.0.0`) vs the label prefix's `v1`. A MAJOR refusal reads the former only.
  - [ ] **B11 — `security definer` is a NARROW READ, once.** The projection RPC is the second definer function in the tree after `award_catalog_count`. Justify it against `0023:196-198` **and** `0028`'s DECISION B, and assert the owner carries `rolbypassrls` (`0027:316-328,347-353`).
  - [ ] **B12 — every new CHECK is `(…) is true` and is NAMED.** *"A CHECK that can evaluate NULL is SATISFIED"* (`6-8a:426-431`). All CHECKs raise `23514`, so pgTAP asserts the **name**.

- [ ] **Task 2 — The canonicalizer, in three runtimes, plus gate-4's vector (AC: 2, 11)**
  - [ ] `lib/roulette/canonical.ts` — RFC-8785 from the spec text. ⛔ Register it in [prng.test.ts:668-676](lib/roulette/prng.test.ts#L668)'s exact module list **and** the import-graph pin (`:788-822`), and satisfy every ban. ⚠ `**`, ` << `, ` >> `, `parseInt`, `parseFloat`, `Number.EPSILON` and `Math.round` are **banned constructs** — write the number and escape paths without them.
  - [ ] `worker/ceremony/bundle.go` — the Go half. ⭐ **Put it in `worker/ceremony`, NOT `worker/awards`**: [prng_test.go:817-857](worker/awards/prng_test.go#L817) pins `worker/awards`'s file list by exact equality and its `bannedImports` list is *"an exception list rather than an allowlist on purpose: a file added later is banned by default"*. `worker/awards` must stay a pure leaf.
  - [ ] `generate_vectors.py` — the third, independent implementation. ⛔ **Write it from the RFC, never by reading the other two** (`README:914-916`); ⚠ its `render()` uses `ensure_ascii=False` and is **not** your bundle serializer.
  - [ ] `roulette/vectors/canonical-bundle.json` — register in the `outputs` map; cover JCS number formatting, key ordering (incl. supplementary-plane keys), escaping, an ASCII-violation refusal, and the real ceremony's end-to-end `bundle_sha256`. Both suites must parse it at runtime and fail on mismatch. Update `README.md`'s gate-4 row and add the ownership line 6-4a's `:87` says you owe.
  - [ ] `python roulette/vectors/generate_vectors.py --check` → **OK ×8**, `git status roulette/vectors/` empty.

- [ ] **Task 2b — the three AC9 debts that are BUNDLE CONTRACTS, pulled forward across the split (AC: 2, 9, 11)**
  > ⛔ These are the split's sharpest edge (DECISION K). Each is listed in AC9 as a 6.9-owned browser
  > debt, but each one either **decides a shape in the published document** or **could change the
  > bytes 6.9a hashes**. Deferring them to 6.9b means 6.9b republishes a different bundle under an
  > already-published commitment — which is the one thing a commitment may never do.
  - [ ] **`LadderExitStep`'s two spellings of NULL — 6.9a PICKS ONE for the bundle and states it** (`deferred-work.md:307`, DECISION J). Go carries `int` with a `0` sentinel; TS omits the key. ⛔ Neither may reach the canonical bytes ambiguously: JCS gives `0` and *absent* different digests. Decide, comment at **both** seam sites, and cover it in the gate-4 vector.
  - [ ] **`stage2-resolve.json`'s unreachable `"shared"` kind gets the `unreachable_outcome_kinds` marker** `antisweep-resolve.json` already uses (`:316`). The `OutcomeKind` closed set **is** a bundle contract (`0027:78-97`), so the vocabulary is canonicalized here.
  - [ ] **`STEAMID64_RE` carried into `pity.*` and `sweep.*` in all three runtimes** (`:335`, `:356`) — the prescribed fix, which makes the byte-lex claim *true by construction*. ⚠ **MEASURE, do not assert, the claim that this is a no-op on the real corpus**: for equal-length all-ASCII-digit ids UTF-16 order and byte-lex order coincide, so `winless`/`reveal_order` should not move — but *"a divergent `winless` yields a divergent `reveal_order` while `draws` and `bytes_consumed` stay IDENTICAL, so the byte-accounting gate this epic was built on **structurally cannot see it**"*. Print the before/after `reveal_order` and diff it.
  - [ ] **`rejections` integer division in TS** (`:348`) — a published `draws[]` field, therefore outcome-affecting for `bundle_sha256`. Make it integer; add the `k != 1` vector row **or** record in writing why not.
  - [ ] ⛔ **Re-run every existing gate after these five**, and re-derive the epic's standing invariants rather than quoting them: **22 main-spin bytes · 27 pity bytes / 27 draws · 49 total · the twelve-award drawn order**. ⭐ *"A change in that number is a defect, not a finding."* If any moves, **stop and report** — do not publish a bundle over it.

- [ ] **Task 3 — Migration `0029_verification_bundle.sql` (AC: 1, 10)**
  - [ ] House header: file-path line, `Logical migration 0029 — the verification bundle and the published commitment (Story 6.9, FR-27/FR-30, AD-22/AD-24)`, the ⭐ thesis paragraph, the SQLSTATE declaration (**`IC901`-`IC911` are taken; `IC912` is yours**), lettered DECISION blocks naming the deciding human + date, a **CLEAN-APPLY NOTE** (AC10), and an explicit **OUT OF SCOPE — do NOT add here** list naming the owning story for every deferral.
  - [ ] `create table public.verification_bundle (…)` per AC1, `enable` + `force`, both policies, the **column-scoped** viewer grant, `service_role` `select, insert, update` with **no DELETE**, a `comment on table` and a `comment on policy` for each.
  - [ ] AC10.1 — `create or replace assert_ceremony_transition` freezing `luck_weight_table` once `old.state <> 'not_started'`. ⛔ Paste the diff against `0027`'s body; it must contain only that.
  - [ ] AC10.2 — `revoke select on public.tournament from anon, authenticated;` then `grant select (id, season_id, name, state, format_default, final_match_id, created_at, grace_period_seconds) on public.tournament to anon, authenticated;` ⚠ **all nine columns enumerated in a comment**, `fair_seed` the only omission, and `0028:481-483`'s fail-closed rule restated for `tournament`.
  - [ ] AC10.3/4 — `alter table public.spin add column label text, add column bytes_consumed bigint;` + `add constraint spin_index_positive check ((spin_index > 0) is true);` with column comments.
  - [ ] ⚠ `explain (costs off)` under `set local role anon` on the new policy and paste the plan. ⛔ **6.8b's AC3 was REFUTED by exactly this measurement** (Postgres hoisted its `exists` into a hashed SubPlan over a `Seq Scan`) — **measure, do not reason**; add no index you have not measured.

- [ ] **Task 4 — `publish_bundle`, the projection read, and the two replacements (AC: 4, 6)**
  - [ ] `public.publish_bundle(bigint, text, text, text) returns jsonb` — house form, lock order **tournament → ceremony**, every guard before any write, the closed reason set declared once, one `audit_log` row (`action='publish_bundle'`, ⚠ **every `detail` key asserted in pgTAP by content**, `0028:817-818`), the literal separator comment `-- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──`, then `revoke execute … from public; grant execute … to service_role;`.
  - [ ] `public.verification_bundle_read(p_ceremony_id bigint) returns jsonb` — the **narrow anon-reachable `security definer`** projection (B11). Preface always once `published_at is not null`; per-spin entries only where `revealed_at is not null`; the full document at `state='complete'`. `set search_path = ''`, schema-qualified, `revoke execute … from public; grant execute … to anon, authenticated;`.
  - [ ] `create or replace reveal_spin` — add `bundle_not_published` **before any write**. ⛔ Diff pasted; only that change.
  - [ ] `create or replace persist_ceremony` — write `spin.label` and `spin.bytes_consumed` from the payload it already receives. ⛔ Diff pasted; only that change. ⚠ It carries `0028`'s `reveal_in_progress` refusal — **do not lose it**.
  - [ ] Mirror the closed refusal set in `lib/ceremony/bundle.ts`, **deriving the TS union from an `as const` reason set** — ⛔ not a hand-written union plus a cast; `6-8b:913` found that exact shape *"defeated the exhaustiveness the route calls load-bearing"* and a seventh SQL reason *"would have compiled and shipped as an opaque 500"*. Copy [lib/ceremony/reveal.ts](lib/ceremony/reveal.ts)'s form: `import 'server-only'`, the discriminated union, the narrowing membership test, **fail closed** on an unrecognised `error` *or* `reason`, and an **ok-payload shape check** before trusting the reply.
  - [ ] `app/api/admin/ceremony/bundle/route.ts` — ⚠ **it MUST route through `handleAdminCommand`** or [lib/admin/route-coverage.test.ts:45-53](lib/admin/route-coverage.test.ts#L45) reddens (it scans the **source text** of every `route.ts` under `app/api/admin/`). `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`. `STATUS_FOR` typed `Record<Extract<Result,{ok:false}>['reason'], number>` so a missing reason is a **compile error**. The actor is **always** `gate.steamid64`, never the body ([command-route.ts:73-117](lib/admin/command-route.ts#L73)).
  - [ ] ⚠ **Colocate the lib test at `lib/ceremony/bundle.test.ts`** — `vitest.config.ts:17` collects only `lib/**/*.test.ts`, so a test under `app/` **silently never runs**. The route's numeric `STATUS_FOR` values stay untested for the same reason every other route's are (`deferred-work.md:279`, Epic 7's) — ⛔ **say so; do not pretend otherwise.** This is the **sixth** such map.
  - [ ] ⚠ The `verification_bundle_read` projection is **anon-reachable** and needs no admin route — the viewer calls it through `createSupabaseServerClient()` (the anon, RLS-respecting client), never `getAdminClient()` ([lib/feed/read.ts:16-18](lib/feed/read.ts#L16)).

- [ ] **Task 5 — pgTAP `0029_verification_bundle_test.sql` + Go/TS builder tests (AC: 1, 4, 10, 12)**
  - [ ] House shape + a **reconciling** `plan(N)` accounting block. ⚠ Restate the accounting in Completion Notes; `6-8b:915` measured banners summing to 73 against `plan(76)` **and the suite still passed**.
  - [ ] ⭐ **The core assertion is a WALK**: with N spins persisted and zero revealed, the projection's spin set is empty; reveal `1..N` one at a time asserting the served set equals the revealed prefix **exactly** — one entry more is as much a failure as one fewer.
  - [ ] The column gate on `verification_bundle` via `has_column_privilege` in **both** directions, for **both** `anon` **and** `authenticated` (closing `6-8b:920`'s anon-only gap), reading the granted set from `information_schema.column_privileges`.
  - [ ] Every `publish_bundle` refusal, one named test each, through a `pg_temp.probe_*` helper, asserting the **reason string**. `IC910`/`IC912` by SQLSTATE **and** constraint name.
  - [ ] `award_revealed_twice` proven with a real duplicate-award fixture (AC4).
  - [ ] Assert `0024_test`'s `columns_are('public','ceremony', …)` is still green and `ceremony`'s granted-column array is **unchanged** — the positive proof that this story did not widen it.
  - [ ] Go/TS: bundle-builder tests over a fixture ceremony, the canonicalizer against the vector, and the byte-identity of two builds. ⚠ `npm test` does **not** typecheck — `npm run build` is the only typechecker.

- [x] ~~**Task 6 — `lib/roulette/verify.ts` + the four browser debts (AC: 5, 8, 9)**~~ — ✂ **CARVED OUT TO 6.9b.** Checked off here only so the completion gate reads honestly; ⛔ **nothing in it was built by this story.** Two of its five subtasks are outcome-affecting for `bundle_sha256` and are pulled forward into **T2b** below (DECISION K); the other three are purely browser-side and move whole.
  - [x] ~~The TS ceremony orchestrator + the bundle→verify comparison, sequential `await`, `crypto.subtle.digest`.~~ → 6.9b
  - [x] ~~`crypto.subtle` feature detection with a typed refusal (`deferred-work.md:289`).~~ → 6.9b
  - [x] ~~`STEAMID64_RE` carried into `pity.*` and `sweep.*` in all three runtimes.~~ → **pulled into T2b** (byte-affecting in principle; 6.9a must measure the claim that it is a no-op on well-formed ids, not assert it)
  - [x] ~~`rejections` integer division in TS; the `k != 1` vector row.~~ → **pulled into T2b** (a published `draws[]` field)
  - [x] ~~The `LadderExitStep` NULL spelling; the `"shared"` unreachable marker.~~ → **pulled into T2b** (both are bundle-contract decisions — DECISION J)

- [x] ~~**Task 7 — i18n + `/ceremonia` verify strip (AC: 7)**~~ — ✂ **CARVED OUT TO 6.9b in full.** 6.9a ships **zero** viewer strings, zero new `app/` routes and no change to `lib/i18n/es.ts`. ⛔ If a diff of this story touches `lib/i18n/` or `app/(viewer)/`, it is out of scope — the only `app/` file 6.9a adds is the **admin** route of T4.

- [ ] **Task 8 — Mutation pass, before review (non-optional) (AC: 12)**
  > *"The author's own mutation table is not proof"* (`6-8b:402`): 6.2 reported 43/0 and its reviewer
  > found 5 survivors in 6; 6.8a's first runs had 3 SQL + 3 Go survivors, every one a real gap; and
  > 6.8b's own reviewer found `ceremony_viewer_read` **survived being widened to `using (true)`** with
  > 84/84 green because every fixture ceremony sat on one side of the predicate.
  - [ ] Control pass on unmutated source first; void the run unless green. Files as **BYTES**. Whole-suite runners. `NOT-APPLIED` distinct from `killed`. Restoration verified by **SHA-256**. Full per-mutation table.
  - [ ] Mutate and record, at minimum: the projection's `revealed_at is not null` filter removed · the projection returning the full payload before `complete` · `verification_bundle_viewer_read` dropped · widened to `using (true)` · the two policies merged into one OR'd policy · the column grant widened to table-wide · `payload_canonical` added to the grant · `FORCE` dropped · the RPC's re-hash check removed · the ASCII check removed · `award_revealed_twice` removed · `reveal_spin`'s `bundle_not_published` guard removed · `revoke execute … from public` removed on **both** new functions · the `luck_weight_table` freeze removed · `spin_index_positive` dropped · `tournament`'s grant restored table-wide · JCS key sort reversed · a JCS escape omitted · the decimal-string coercion replaced with a JSON number.
  - [ ] ⭐ **The DECISION E mutant, which is this story's named obligation**: 6.8b's anticipatory guard at [0028_reveal_gating_test.sql:1076-1080](supabase/tests/0028_reveal_gating_test.sql#L1076) is **vacuous for 6.9a** (DECISION E — the grant is never widened). Mutate `grant select (bundle_sha256) on public.ceremony to anon` **and** the `authenticated` variant in, and watch each redden. ⛔ If the `authenticated` one survives, that is `6-8b:920`'s open hole and **this story closes it**.
  - [ ] ✂ **The W10 `Promise.all` mutant is 6.9b's** — it mutates `lib/roulette/verify.ts`, which 6.9a does not ship. ⛔ **Say so in the table as `DEFERRED-6.9b`, not as a pass.** It is the mutant AC5 calls the verifier-only divergence, and it **must** be killed by something other than `bytes_consumed`.
  - [ ] ⭐ **Record survivors rather than papering over them**, and record any bad mutant of your own.

- [ ] **Task 9 — ⛔ THE BAR (AC: 13) — this gates sign-off**
  - [ ] Rebuild the local stack and the 14-demo corpus by the standing recipe (decompress `demos/*.dem.gz`; curate the payload from a throwaway Vitest file because `lib/awards/catalog.ts` is `server-only`; parse-before-seed; the `grand_final gf_order=2` bracket trick; approve only `ziivanto`; `lock_ceremony`), then `worker/ceremony.Run` to persist, then publish the bundle. ⚠ `content_sha256` will differ again and that is correct.
  - [ ] ⭐⭐ Build the Next app with the **LOCAL** `NEXT_PUBLIC_*`; print page byte sizes and a corpus-name hit count to prove the greps non-vacuous. ⛔ **Not optional for 6.9a**: AC10.2 revokes and re-grants `tournament` column-by-column, so this build is the only thing standing between a nine-column enumeration typo and a silently dead 4.5 grace timer or 5.7 surface.
  - [ ] Everything AC13 enumerates **except the four interaction bullets** carved to 6.9b (tapping the button, the rendered copy, the `aria-live` text and the elapsed time, and the three refusal paths *in the browser*). ✂ **Epic-5 retro AI #4's two-session real-browser run therefore lands with 6.9b**, which is the half that ships client state — ⛔ record that explicitly as a deferral with its owner named, do not let it read as satisfied.
  - [ ] Harness convention: throwaway `worker/cmd/qa69/main.go` + a throwaway Vitest file + `_qa69/`, **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean **while present and after removal**. ⚠ `worker/cmd/qa54` is still in the tree and still not yours to delete.

- [ ] **Task 10 — Gates (AC: 13)**
  - [ ] **Measure the baseline first** — ⛔ **do not quote 6.8b's table and do not quote `sprint-status.yaml`**; 6.7 quoted `1318/42` from that file when the real figure was `1322/42`. *"Baselines are measured, never quoted."*
  - [ ] `npm run lint` → 0 · `npm test` → report the delta and what each new test is · `npm run build` → 0, ✂ **`/ceremonia` stays the Story-5.7 `<Placeholder>` — 6.9b makes it a real route**, and every viewer route must still be `ƒ` dynamic and render identically to `main` · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` → **empty**.
  - [ ] `generate_vectors.py --check` → **OK ×8**, `git status roulette/vectors/` empty.
  - [ ] pgTAP: `supabase db reset` first, then the prior baseline **plus** `0029`'s file. Restate every `plan(N)` you touched.
  - [ ] `git status` + `git diff --stat` proof that `supabase/migrations/0001`-`0028` and `worker/ingest|store|db|config/**` are **byte-untouched**, and that `0029` + its pgTAP file are the only new `supabase/**` entries.
  - [ ] `0 CRLF` across every touched file. ⚠ `sprint-status.yaml` is CRLF natively.

---

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

**DECISION A — the bundle table is created HERE, from the `SOLUTION-DESIGN:235-245` sketch, adapted.**
Six migrations home it to 6.9 and `0028:90` says outright *"⛔ THIS MIGRATION CREATES NO `verification_bundle` TABLE."* The sketch is marked *"intent; not final SQL"* (`:49`); the adaptations are: `ceremony_id` gains a **UNIQUE** (one bundle per ceremony — the commitment is singular or it is not a commitment), `payload_canonical text` + `payload jsonb` are added (the sketch has neither, and without the bytes there is nothing to serve), `published_url` is **dropped** (nothing in this build serves a static asset; there is no `public/` directory and no storage read anywhere in the tree), and `released_at` is added for DECISION B's full release.

**DECISION B — ⭐⭐ THE CENTRAL DECISION: one document, hashed once, served as a reveal-gated projection.**
This is the reconciliation the ⛔ block at the top demands, and it is the only reading under which
*all three* of the following are simultaneously true: the AC's *"the bundle contains `spin_plan` …
and `bundle_sha256` published"*, `0028:474-477`'s *"publishing `spin_plan` up front would break
AD-22 outright"*, and `SPINE:223`'s *"released progressively per spin, in full at ceremony
completion — so 'Verificar la ceremonia' confirms revealed outcomes and the finished ceremony but
can never compute an unrevealed winner."*

The release schedule, stated once:

| when | served | what a viewer can verify |
|---|---|---|
| `published_at` set, 0 reveals | `bundle_sha256`, `algo_version`, `seed_hex`, `luck`, `players` | the commitment exists and binds; `seed_hex` matches `ceremony.seed_demo_sha256` |
| after reveal *k* | + `spin_plan[1..k]`, `awards` for the awards decided in those spins, `pity` if its spin is revealed | the Stage-1 **draw** of spins 1..k (from `pool` ids + `weights` + `label` alone — **no metadata, no spoiler**), and the Stage-2/ladder/anti-sweep outcome of each revealed award |
| `ceremony.state = 'complete'` | the **full** document | re-canonicalize → `sha256` → **must equal the `bundle_sha256` published before spin 1** |

⚠ **The cost, stated plainly** (the 6.8a form): between publication and completion a viewer cannot
bind the served prefix to the commitment, because a prefix is a different document and hashes
differently. Per-spin commitments would fix that and **are not specified anywhere** — see Question 3.

**Why `players` ships in full from the start:** it carries no award identity, and `public.leaderboard`
(Story 5.5) already publishes the same magnitudes to `anon`. Knowing everyone's `knife_kills` does
not tell you that an award uses it, nor its direction, floors or priority. ⛔ Do not "harden" this
into a gate — B3 depends on it.

**DECISION C — the projection is served by ONE narrow `security definer` RPC, not by a view and not by column grants.**
A row policy cannot hide an **array element**, which is what progressive release needs: the gate is
per-`spin_plan`-entry, not per-column. `0028`'s DECISION B chose column grants for `ceremony` because
the gate there *was* per-column; here it is not, so the same reasoning points the other way. The
precedent is `award_catalog_count` ([0023:199-206](supabase/migrations/0023_award_catalog.sql#L199)), the tree's only anon-reachable definer, and
`0023:196-198`'s *"IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22"* applies to yours verbatim —
**quote it at your function**. ⚠ Under `FORCE ROW LEVEL SECURITY` a `security definer` function does
**not** see every row unless the owner carries `rolbypassrls` ([0027:316-328](supabase/migrations/0027_ceremony_run.sql#L316); 6.8b's DECISION G):
*"it works today because the owner is `postgres`; on ownership reassignment the fix reverts to the
fail-open behaviour it replaced."* **Assert the owner's `rolbypassrls`** — `0027:347-353` has the
primitive.

**DECISION D — `bundle_sha256` is the column; `bundle_hash` is the same value's contract name.**
`SOLUTION-DESIGN:235-245` and `epics.md:1164` say `bundle_sha256`; `SPINE:223` and `glossary.md:24,67`
say `bundle_hash`. They are one value. Fix `bundle_sha256` as the column and state the equivalence
once, exactly as 6.2 did for `seed_demo_sha256` ↔ `seed_hex` (`6-2:246`). ⛔ Do not create two fields.

**DECISION E — this story does NOT widen `ceremony`'s column grant, and that is a finding, not an omission.**
`0028:91-92` anticipated *"6.9 WIDENS it (one more column on the grant)"* and
[0028_reveal_gating_test.sql:1076-1080](supabase/tests/0028_reveal_gating_test.sql#L1076) was rewritten in anticipation of
`grant select (bundle_sha256) on public.ceremony`. Under DECISION A that column lives on
`verification_bundle`, so **`ceremony`'s grant is untouched** and `0024_test`'s exact `columns_are`
stays green — which is *positive* proof. ⚠ That makes 6.8b's anticipatory guard **vacuous for this
story**, so AC12 requires you to prove it non-vacuous by mutating a widening grant in, and to close
`6-8b:920`'s remaining hole (the guard covers `anon` only; a grant to `authenticated` is still
invisible to it).

**DECISION F — `spin.label` and `spin.bytes_consumed` become COLUMNS, here.**
`deferred-work.md:363` homes them to *"6.9's `verification_bundle`"* and `0027:1025-1032` says
*"⛔ Do NOT read them into a write without moving that decision to 6.9 first."* They cannot live only
in the bundle: the bundle is **derived from the database**, so a field the database does not hold is
a field the bundle cannot re-derive after the producer's process exits. `worker/awards` calls the
label *"the single most load-bearing fact in a provably-fair ceremony"* and `bytes_consumed` is
*"MEASURED FROM THE STREAM"*, not re-derived — both are exactly what a verifier re-opens. Columns it
is; `persist_ceremony` writes them from the payload it **already receives**.

**DECISION G — the FR-21 floors are NOT touched, for the seventh time, and this is the last cheap moment.**
`24`/`20` stay. But record it in the loudest terms the file allows: **0 of 28 players clear either
floor**, measured independently by 6.1's review, 6.2, 6-4a, 6-4b, 6.5, 6.6, 6.7, 6.8a and 6.8b —
`rounds_played` min 10 / max 21 against a floor of 24; `kills` min 1 / max 12 against 20. Every one
of the twelve main spins resolves `no_eligible_players`; the ceremony is **twelve nobody-qualified
cards and 28 identical consolation prizes**. ⛔ **This story cryptographically commits those bytes.**
After `publish_bundle`, changing the floors means a new ceremony, a new snapshot and a new
commitment. See Question 1 — it is asked for the third time and it gets more expensive, not less.

**DECISION H — no realtime consumer, no `NUDGE_EVENTS` change.**
`spin.reveal` is emitted on `ceremony:<id>` and consumed by nobody (6.8b's DECISION F). ⛔ Do not
subscribe here and do not add it to [lib/realtime/status.ts:28-33](lib/realtime/status.ts#L28)'s `tournament:<id>` vocabulary —
that is 6.10's, with the UI that consumes it. The verify surface must be *fully reconstructable from
a published read alone* (AD-11), which is what makes a missing nudge a UX gap and not a correctness
gap.

**DECISION I — `worker/ceremony.Run` still has zero callers, and 6.9 does not wire one.**
6.8b's Q3 left the owner open. The bundle builder is invoked the same way `Run` is: from the QA
harness. ⛔ Do not build a production entry point here; record the gap again. See Question 5.

**DECISION J — `tie_ladder_exit_step`'s NULL is spelled ABSENT in the bundle, and the sentinel dies at the canonicalizer's door.**
`deferred-work.md:307` records the seam defect: Go carries `LadderExitStep` as an `int` whose `0`
means "no ladder was walked", TS omits the key entirely, and `worker/ceremony`'s `Payload` sends
*"THE ENGINE'S RAW INTEGER, INCLUDING THE 0 SENTINEL"* with the RPC applying `nullif(v, 0)`. AC9 gives
6.9 *"the **canonicalization** half — pick ONE spelling for the bundle and state it."* **The spelling
is: the key is ABSENT when no ladder was walked.** Three reasons, in order of weight: (1) the DB
column is already `NULL` after `nullif`, and the bundle is derived **from the database** (DECISION F's
argument), so absent is the faithful projection and `0` would be a value the source does not hold;
(2) JCS hashes `0` and *absent* differently, so a runtime that "helpfully" fills the sentinel produces
a different `bundle_sha256` — this must be impossible by construction, not by review; (3) it matches
the TS engine, which is what 6.9b's verifier re-derives, so the comparison is `undefined === undefined`
rather than a special case. ⛔ **The Go builder must therefore drop the key on `0`, and that is the one
place in this story where a Go zero value is load-bearing** — comment it at the site, because Go's
`omitempty` would do the right thing here for the wrong reason and break the day the sentinel changes.

**DECISION K — ⭐ the split's sharpest edge: three AC9 debts are pulled FORWARD into 6.9a (T2b).**
AC9's five browser debts all name 6.9. Splitting the story naively would leave all five with 6.9b —
and three of them would then change, *after* the commitment is published, either the shape or the
bytes of the document the commitment binds. **A commitment that can be republished is not a
commitment.** So: `LadderExitStep`'s spelling (DECISION J) and `stage2-resolve.json`'s
`unreachable_outcome_kinds` marker are **bundle contracts** and land here; `rejections`' float
division lands here because `rejections` is a published `draws[]` field; the `STEAMID64_RE` fix lands
here because a divergent `winless` yields a divergent `reveal_order` **while `draws` and
`bytes_consumed` stay identical**, so the epic's whole byte-accounting gate is structurally blind to
it. ⚠ **The expectation — which T2b must MEASURE and not assert — is that the last two are no-ops on
the real corpus**: for equal-length, all-ASCII-digit steamid64s, UTF-16 code-unit order and byte-lex
order coincide, and no shipped vector row has `k != 1`. If that expectation holds, the fixes are
by-construction guarantees and the 22/27/49-byte invariants and the twelve-award drawn order do not
move. **If any of them moves, stop and report — do not publish a bundle over it.**
Only `crypto.subtle` feature detection and the verifier itself are safe to defer, because neither can
touch a byte that is hashed. ⛔ Do not "simplify" this by moving T2b back to 6.9b.

### The posture you are opening — the exact state of the world today

| table | anon/auth grant | policies | RLS |
|---|---|---|---|
| `ceremony` | `select (id, tournament_id, state, seed_demo_sha256, started_at, completed_at)` — **column-scoped** ([0028:501](supabase/migrations/0028_reveal_gating.sql#L501)) | `ceremony_admin_read`, `ceremony_viewer_read … using (state <> 'not_started')` | ENABLE+FORCE |
| `spin` | `select` | `spin_viewer_read … using (revealed_at is not null)`, `spin_admin_read` | ENABLE+FORCE |
| `award_result` | `select` | viewer gates via `exists(… spin s … revealed_at is not null)`, admin | ENABLE+FORCE |
| `award_result_winner` | `select` | viewer gates on its **own** `spin_id` (legal only via `0025`'s composite FK), admin | ENABLE+FORCE |
| `award` | `select` | viewer gates via `award_result ⋈ spin`, admin | ENABLE+FORCE |
| `tournament` | **`select` TABLE-WIDE** ([0002:70](supabase/migrations/0002_rls.sql#L70)) — ⛔ **including `fair_seed`; AC10.2** | `tournament_read … using (true)` | ENABLE+FORCE |
| `stat_snapshot`, `stat_snapshot_row`, `audit_log` | **none** ([0003:83-84](supabase/migrations/0003_audit_snapshot.sql#L83)) | admin-read only | ENABLE+FORCE |
| `timeline_feed` | `select` | `timeline_view … using (true)` | ENABLE+FORCE |
| `verification_bundle` | **does not exist** | — | — |

⚠ **`stat_snapshot_row` holds zero anon grant and `0003:42` calls it *"the verifier's integer-form
contract"*.** Those two facts together are the whole argument for `players` living **inside** the
bundle rather than being read from the table. ⛔ Do not open `stat_snapshot_row`.

### Schema you are extending (as it stands at `0028`)

```sql
ceremony(id, tournament_id, state, seed_demo_sha256, snapshot_id, algorithm_version,
         spin_plan jsonb, luck_weight_table int[], started_at, completed_at)
   -- state: not_started|locked|spinning|complete, forward-only via assert_ceremony_transition (IC910)
   -- seed_demo_sha256, snapshot_id: write-once once non-NULL (0027:514-554)
   -- algorithm_version: SHELL since 0024:200 -> THIS STORY WRITES IT
   -- luck_weight_table: default [100,40,16,6,2,1] (0025:444); MUTABLE AFTER FREEZE -> AC10.1
spin(id, ceremony_id, spin_index, kind, live_award_ids jsonb, revealed_at)
   -- unique (ceremony_id, spin_index); unique (id, kind) as a composite-FK target
   -- NO spin_index > 0 CHECK -> AC10.4 · NO label / bytes_consumed -> AC10.3
award_result(id, spin_id, award_id NULLABLE, kind, deciding_value numeric, deciding_num,
             deciding_den, outcome_kind NOT NULL, is_pity, is_shared, tie_ladder_exit_step)
   -- unique (spin_id, award_id) — PER SPIN, so the same trophy twice in one ceremony is
   -- representable -> AC4's award_revealed_twice
award_result_winner(id, award_result_id, spin_id, winner_entry_id)
award(id, tournament_id, name, bucket, class, deciding_stat, direction, secondary_stat,
      eff_num_key, eff_den_key, floor_rounds, floor_kills, priority)
stat_snapshot(id, tournament_id, taken_at, content_sha256)   -- content_sha256 is NOT bundle_sha256
stat_snapshot_row(snapshot_id, steamid64, stats_int jsonb, h2h jsonb, achievement_ts bigint,
                  rounds_played, kills, idle_dq)              -- AD-19 integer form; sentinel -1
tournament(id, season_id, name, state, format_default, final_match_id, fair_seed, created_at,
           grace_period_seconds)                              -- NINE columns; AC10.2 grants EIGHT
```

### SQL three-valued-logic traps this epic keeps paying for

Every one was a real defect in a prior story. Re-read before writing a guard.

- **A CHECK that can evaluate NULL is SATISFIED.** `(… ) is true`, and **name it** (`0027:106-108`).
- **`string_agg` skips NULLs** and **`jsonb ? NULL` is NULL** — three of 6.8a's payload guards failed open on exactly this. `coalesce(…, '<null>')`.
- **`jsonb_typeof` is STRICT** — a *missing* key yields NULL, and a NULL `IF` is FALSE, so a payload omitting a key falls through every guard. `coalesce(jsonb_typeof(v -> 'k'), '')`. ⚠ **Your RPC validates a whole document**; this is the single most likely place for it to fail open.
- **`NULL not in (…)` is NULL.**
- **NULLs are DISTINCT in a UNIQUE** — what defeated `award_result_spin_award_key` once `0026` made `award_id` nullable, and the same nullability your `award_revealed_twice` check must survive.
- **Postgres does not guarantee OR short-circuit evaluation** — a nested `if`/`case` is correct when the second arm can raise.
- **Postgres does not guarantee which of two violated CHECKs it names** — a test asserting a constraint name must break exactly one.
- ⚠ **`set constraints … immediate` is TRANSACTION-scoped, not statement-scoped.** 6.8a's own fix got this wrong first time and took its suite from 68/68 to 6 failures.

### TypeScript / browser traps specific to this story

- **`npm test` does NOT typecheck.** Only `npm run build` does ([prng.ts:37](lib/roulette/prng.ts#L37)) — and `6-3:380` says to carry that forward *"to 6.4/6.6/6.9"* by name.
- **`Bytes = Uint8Array<ArrayBuffer>`** is required for anything reaching WebCrypto; the default `ArrayBufferLike` includes `SharedArrayBuffer` and `BufferSource` rejects it. `npm test` will not catch it.
- **`crypto.subtle.digest` is async** ⇒ the whole verify path is a Promise. A React component cannot compute it at render time.
- **No jsdom, no RTL, no `.test.tsx` collection, nothing under `app/` is collected.** Component behaviour is proven by **live-QA only** — which is why AC13's two-session browser run is a gate and not a nicety.
- **`prng.test.ts > real-seed/spin1/i255` times out at 5000 ms under full-suite load** (`deferred-work.md:336`, unowned) — *"`npm test` is not reliably green on this machine."* If you hit it, say so; do not silently re-run until green.
- ⚠ **`Number`-parsing a magnitude reads both sides as 2^53, ties, and bottoms out `shared` at step 5** (`6-5b:587`). Every magnitude crosses the JSON boundary as a **string** and becomes a `bigint`, never a `number`.

### The APIs and shapes you are extending (transcribed, not remembered)

```ts
// lib/roulette/stage2.ts:143 — what `players` must deserialize INTO
interface SnapshotPlayer { steamid64: string; roundsPlayed: bigint; kills: bigint; idleDq: boolean;
  volume: Readonly<Record<string, bigint>>; rate: Readonly<Record<string, RatePair>>;
  secondary?; efficiency?; h2h?; achievementTs? }          // absent container === empty container
// lib/roulette/stage1.ts:152/165 — what `spin_plan[]` must reproduce
interface Stage1Draw   { n: number; r: number; consumedAfter: number }
interface Stage1Result { live: readonly string[]; weights: readonly number[];
                         totalWeight: number; draws: readonly Stage1Draw[] }
// lib/roulette/pity.ts:104/144 — the `pity` key's shape, recorded for you at 6-7:1340
interface PityDraw   { n: number; k: number; rejections: number; value: number }
interface PityResult { winless: readonly string[]; revealOrder: readonly string[];
                       draws: readonly PityDraw[]; bytesConsumed: number }
```
```go
// worker/awards/ceremony.go:186/207/249 — the Go run the bundle projects
type SpinPlanEntry struct { Spin int; Pool []string; LiveCount int }
type CeremonySpin  struct { Spin int; Label string; Plan SpinPlanEntry
                            ShelfAtStart map[string]int; Stage1 Stage1Result
                            Result SpinResult; Consumed uint64 }
type CeremonyRun   struct { SeedHex string; Plan []SpinPlanEntry; Spins []CeremonySpin
                            Shelf map[string]int; PityLabel string; Pity PityResult }
```
⚠ **`worker/awards` structs carry NO JSON tags at all.** The only JSON-tagged mirror in the tree is
`worker/ceremony`'s `Payload` (`:306-335`) — the *persistence* wire format, **not** the bundle.
A bundle serializer is entirely new code. Note the one thing `Payload` already gets right and you
must keep: every magnitude is a decimal `*string` and `tie_ladder_exit_step` is *"SENT AS THE
ENGINE'S RAW INTEGER, INCLUDING THE 0 SENTINEL"* with the RPC applying `nullif(v, 0)` — which is
exactly the two-spellings-of-NULL problem AC9 asks you to canonicalize.

The PRNG spec the browser reimplements (`README:820-848`, transcribed):
```
seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # LE64 is the ONLY LE construct
uniform_int(stream, n): k = minimal k with 256^k >= n; limit = 256^k - (256^k mod n)
                        x = big-endian int of next k bytes (CONSUMED); if x >= limit retry; return x mod n
labels: "inclusivcup/v1/stage1/spin/<S>"  (S = 1,2,3…, decimal, no padding) · "inclusivcup/v1/pity"
```

### Previous story intelligence — what 6.8a and 6.8b learned that changes how you work

- **THE BAR finds what no suite can.** 6.8a's harness found `BuildPayload` never populated `seed_hex`: *"`worker/awards` proves the RUN and `0027`'s pgTAP proves the WRITER — the TRANSLATION between them was covered by neither."* Your bundle builder is a **third** translation layer. Budget for the same class of defect.
- **A grep over an empty page proves nothing.** 6.8a's first AD-22 sweep came back falsely clean over ~11 KB pages all rendering `No pudimos cargar el evento`, because `.env.local` points at the **remote** project and `NEXT_PUBLIC_*` are inlined at build time.
- **The author's own mutation table is optimistic, every time.** 6.8b's reviewer found `ceremony_viewer_read` — the AC1 commitment gate — **survived being widened to `using (true)`** with 84/84 green, because every fixture ceremony was `locked` or `spinning`, so the predicate had no row on its FALSE side. **Put a row on the false side of every predicate you write.**
- **Two policies that are never OR'd need a BEHAVIOURAL test, not a DDL one.** 6.8b's Section E broke the *admin* policy and asserted anon was unaffected — which holds for any body of it. The merge it forbids can only live in the **viewer** policy.
- **The project's signature defect is at its seventh occurrence and it is always a closed set.** Read the evidence: `prosrc`, `pg_policy`, `information_schema.column_privileges`, the vector file. Never a literal beside the assertion.
- **A survivor recorded honestly beats a kill that proves nothing.** 6.8b recorded one unkillable mutant *and why*: a policy `USING` clause is a resolved parse tree, so qualified and unqualified `spin_id` produce the identical node tree.
- **6.8b re-derived every gate number and they all reconciled** — the first story of the epic whose printed figures survived re-measurement unchanged. That is the bar for your Completion Notes.

### Git intelligence — the five most recent commits

`c85f1ed` 6.8b (reveal-gating + commitment, `0028`, `reveal_spin`) · `e7a5aa0` 6.8a code review
(three-valued-logic guards closed, audit row asserted) · `a8aa4bc` 6.8a (`0027`, `persist_ceremony`)
· `f9a2358` 6.7 (`0026`, pity) · `ba894d1` 6.6 (`0025`, anti-sweep + luck meter).
**Pattern to follow:** one migration per story, hand-numbered, paired pgTAP file, subject-line-only
commits, and a separate follow-up commit when a code review lands patches.

### Latest tech — versions and the two facts that matter

Next.js **16.2.10** · React **19.2.7** · TypeScript **^5.9** (`strict`, `verbatimModuleSyntax`,
`isolatedModules`, target ES2022, `lib: [dom, dom.iterable, esnext]`) · Vitest **4.1.9**
(`environment: 'node'`, `include: ['lib/**/*.test.ts']`) · `@supabase/supabase-js` **2.110.0** /
`@supabase/ssr` **0.12.0** · Node **≥20.9** · Go **1.26.4, stdlib only** · Python 3 stdlib only ·
`demoinfocs-golang v5.2.0` (pinned, not yours).

1. ⛔ **No new npm package and no new Go module.** `lib/roulette` is banned from third-party imports
   outright, so RFC-8785 is **hand-written in three runtimes**. There is no `json-canonicalize` here
   and there will not be.
2. **Web Crypto is the only hash primitive on the browser side.** `crypto.subtle.digest('SHA-256', …)`
   — never `node:crypto.createHash`, never hand-rolled ([prng.ts:20-25](lib/roulette/prng.ts#L20); `prng.test.ts:888-896` exists
   precisely because *"a hand-rolled pure-TS SHA-256 would satisfy all of them and still green every
   vector"*). Node ≥20.9 exposes the same global under Vitest's `node` environment, so one code path
   serves both the test and the browser.

### Project Structure Notes

✂ **Scoped to 6.9a.** The 6.9b column is listed so a reviewer can see what is deliberately absent.

- **New files (6.9a):** `supabase/migrations/0029_verification_bundle.sql`, `supabase/tests/0029_verification_bundle_test.sql`, `lib/roulette/canonical.ts` (+ `.test.ts`), `lib/ceremony/bundle.ts` (+ `.test.ts`), `app/api/admin/ceremony/bundle/route.ts`, `worker/ceremony/bundle.go` (+ `_test.go`), `roulette/vectors/canonical-bundle.json`.
- **Modified (6.9a):** `lib/roulette/{pity,sweep}.ts` (T2b's `STEAMID64_RE` + `rejections`), `lib/roulette/prng.test.ts` (the three pins — `canonical.ts` only), `worker/awards/{pity,sweep}.go`, `roulette/vectors/{generate_vectors.py,README.md,stage2-resolve.json,pity-draw.json?}`.
- ✂ **Deferred to 6.9b:** `lib/roulette/verify.ts` (+ `.test.ts`), `app/(viewer)/ceremonia/` components + CSS module, `app/(viewer)/ceremonia/page.tsx`, `lib/i18n/es.ts`. ⛔ **6.9a must not touch any of them.**
- **⛔ Byte-untouched:** `supabase/migrations/0001`-`0028`, `worker/ingest|store|db|config/**`, `supabase/tests/0001`-`0022`.
- **Variance from the architecture's directory sketch, stated deliberately:** the Go canonicalizer lands in `worker/ceremony/`, not `worker/awards/`, so `worker/awards` stays the pure leaf its `TestPackageIsALeaf` and exact-file-list pins require. The cross-language contract is the **vector**, not the package path (`SPINE:73-76`).

### Project context reference

There is no `project-context.md` in this repo (checked at contexting; the `persistent_facts` glob
resolves to nothing). The durable conventions live in the artifacts cited throughout: `SPEC.md`'s
constraints, `ARCHITECTURE-SPINE.md`'s ADs, `SOLUTION-DESIGN.md`'s §4/§9, `roulette/vectors/README.md`'s
seam rules, and the per-story files in `_bmad-output/implementation-artifacts/`.

### References

- [epics.md:1154-1175](_bmad-output/planning-artifacts/epics.md#L1154) — Story 6.9's ACs, 1:1 · `:110-131` — every UX-DR
- [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) (AD-22) · `:195-198` (AD-24) · `:210-223` (provably-fair contract + commitment timing)
- [SOLUTION-DESIGN.md:431-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) (§9.5/§9.6) · `:235-245` (the DDL sketch) · `:293` · `:453-471` (the Spanish table)
- [prd.md:371-378](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L371) (FR-27) · `:397-404` (FR-30) · `:484` (SM-3)
- [SPEC.md:72](_bmad-output/specs/spec-cs-tournament/SPEC.md#L72) (Constraint 7) · `:74` (C9) · `:97` · `:54-57` (CAP-6) · [glossary.md:24,66-70,83-85](_bmad-output/specs/spec-cs-tournament/glossary.md#L24)
- [EXPERIENCE.md:94,133,140-143,147-154](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L94) · [DESIGN.md:147-154,236,273](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L147)
- [roulette/vectors/README.md:13-102,239-244,367-371,531-535,820-848,911-916](roulette/vectors/README.md#L13)
- [0028_reveal_gating.sql:85-137,203-234,473-535,643-653,920-928](supabase/migrations/0028_reveal_gating.sql#L85) · [0027:78-143,169-178,316-328,476-567,583-589,1025-1032](supabase/migrations/0027_ceremony_run.sql#L78) · [0024:143-171,194-211,300-325,747-762](supabase/migrations/0024_ceremony_lock_snapshot.sql#L143) · [0025:7-11,76-80,234-236,452-460](supabase/migrations/0025_ceremony_results.sql#L7) · [0023:33-38,196-206](supabase/migrations/0023_award_catalog.sql#L33) · [0003:33-84](supabase/migrations/0003_audit_snapshot.sql#L33) · [0002:50,69-79,87-98](supabase/migrations/0002_rls.sql#L50)
- [deferred-work.md:289,307,316,335,348,356,361,362,363,370,372](_bmad-output/implementation-artifacts/deferred-work.md#L289) — the eleven items homed here
- [6-8b-…md](_bmad-output/implementation-artifacts/6-8b-reveal-gating-and-commitment.md) · [6-8a-…md:487-503,633-684,744-752,889-891,907-995](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L487) · [6-7:1340-1343](_bmad-output/implementation-artifacts/6-7-pity-roulette.md#L1340) · [6-6:350,554-633](_bmad-output/implementation-artifacts/6-6-anti-sweep-and-luck-meter.md#L350) · [6-4b:319-321,476-483,592-603](_bmad-output/implementation-artifacts/6-4b-stage-1-seeded-weighted-category-pick.md#L319) · [6-2:108-111,244-247,412-418,1143,1150,1181](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md#L108)
- [epic-5-retro-2026-07-28.md:43,89-99](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L43) · [epic-4-retro-2026-07-19.md:97,104](_bmad-output/implementation-artifacts/epic-4-retro-2026-07-19.md#L97)

---

## ~~Questions for Cuatro~~ — ✅ ALL SEVEN ANSWERED 2026-08-08, see the answers block near the top

> Kept verbatim as the record of what was asked and what the cost of each answer was. ⛔ **Do not
> re-litigate them here**; the binding answers are the numbered block above, and the ones that became
> code are DECISIONS A-K.

1. ⛔⛔ **The FR-21 floors, asked for the third time and the last cheap time.** `24`/`20` exclude the
   entire measured roster — **0 of 28**, now measured by nine independent stories. The ceremony this
   story **cryptographically commits** is twelve `no_eligible_players` cards and 28 identical
   consolation prizes. After `publish_bundle` runs, moving the floors means a new snapshot, a new
   ceremony and a new commitment. 6.8b's Q2 answer was *"accept as measured, ship 6-8b now"* — does
   that still hold now that the bytes get hashed, or does a floors slice land before 6.9?

2. **Split the story?** See the recommendation block at the top. 6.9a = the bundle (T0-T5); 6.9b =
   the verifier (T6-T9). My recommendation is **yes** — this is larger than 6.8 was when you split it.

3. **Is a mid-ceremony prefix commitment needed?** DECISION B's honest cost is that between
   publication and completion a viewer cannot bind the served prefix to `bundle_sha256`. Nothing in
   the artifacts specifies per-spin commitments. Accept the gap (my recommendation — it is what
   §9.5's timing sentence describes), or add per-spin hashes to the bundle?

4. **The `roulette/vectors/README.md` ↔ `SOLUTION-DESIGN:441-445` gate-number swap.** Noted by 6.7,
   noted again by 6.8a, unfixed. 6.9 or 6.11 owns the renumbering *"together with the document"*.
   My recommendation: **6.9 adds its row under the README's existing numbering (gate 4) and 6.11
   renumbers both documents together with the last row** — but say so, because noting it a third
   time is not a resolution.

5. **`worker/ceremony.Run` still has zero callers** (6.8b's Q3, still open) and `publish_bundle` will
   have the same problem — the QA harness is the only caller and it gets deleted. Epic 7's, or does
   6.9 wire a CLI? DECISION I assumes **not**.

6. **`deferred-work.md:372`** — `ceremony_locked`'s `<> 'not_started'` permanently blocks
   `bind_match_demo` after the ceremony completes, so a demo uploaded the morning after can never be
   bound. Its home is *"Epic 7, **or 6.9 if the verification bundle turns out to need late-bound
   demos**"*. Under DECISION B the bundle is frozen at publish, so it does **not** need them —
   confirming that leaves it Epic 7's.

7. **A client-side verification performance budget does not exist in any artifact** (measured — the
   only latency numbers anywhere are SM-5 and the ~2 s realtime target). 6.9 has to choose one for a
   phone. Is "under 2 s on a mid-range phone for the 49-byte, 28-player ceremony" the right bar?

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), BMad `dev-story` workflow, 2026-08-08.

### Debug Log References

- Greenfield sweep: `git grep` over `supabase lib app worker roulette` for 13 identifiers.
- Vector gate: `python roulette/vectors/generate_vectors.py --check` → **OK ×8**.
- Suites: `npx vitest run lib/roulette` · `npm test` · `npm run build` · `go build/vet/test ./...` · `gofmt -l ./worker`.

### Completion Notes List

⚠ **THIS STORY IS PARTIALLY COMPLETE AND IS NOT READY FOR REVIEW.** What is recorded below is
finished and gated; everything from Task 3 onward is **not started**. The status stays `in-progress`.

**The split (decided before any code).** Story 6.9 was cut into 6.9a (this file, the bundle) and
[6-9b](6-9b-verificar-la-ceremonia.md) (the verifier), on Cuatro's call, following the 6-4a/6-4b,
6-5/6-5b and 6-8a/6-8b precedent. All seven of the story's blocking questions were answered first
and are recorded in the answers block near the top. ⭐ The split produced one finding nobody had
written down — **DECISION K**: three of AC9's five "browser" debts either decide a shape in the
published document or change the bytes 6.9a hashes, so leaving them with 6.9b would have meant
republishing a different document under a live commitment. They were pulled forward into **T2b**.

**T0 — the greenfield claim, RE-CONFIRMED rather than assumed.** `publish_bundle` → **0 hits**.
Every hit for `canonical`/`Canonical` (139) is an unrelated sense of the word (canonical bracket
order, canonical demo bytes, `canonical_steamid64_invariant_test.sql`) or a hand-off comment — no
JCS implementation existed. `algo_version` exists only as `generate_vectors.py:90`, the `0024:200`
shell comment, one pgTAP fixture literal and **9** asserted literals across the two suites; there is
still **no exported source constant** (AC8's premise holds, and AC8 is 6.9b's).

**T2 — the canonicalizer, in three runtimes, proven by the vector and not by reading each other.**
- `lib/roulette/canonical.ts`, `worker/ceremony/bundle.go` and `generate_vectors.py`'s
  `jcs_canonicalize` each implement RFC-8785 from the spec text. The Go half went in
  `worker/ceremony` — **measured first**: that package carries no file-list pin and no
  `bannedImports` list, unlike `worker/awards`, so nothing is being worked around.
- ⭐ **RFC-8785 §3.2.3's own example reproduces character-for-character in all three**, including
  the load-bearing pair: `😀` (U+1F600) sorts **before** `דּ` (U+FB33). That is UTF-16 code-unit
  order and the **reverse** of code-point order, so it is positive proof that JS's bare `.sort()` is
  correct here while Go and Python had to do real work (`utf16.Encode`, `encode('utf-16-be')`).
- ⛔ **DECISION L, recorded at all three sites:** numbers are restricted to **safe integers**;
  `1e+30` and `5e-324` are **typed refusals**, not serialized forms, because SPEC C7 makes the
  engine integer-only and every magnitude is a decimal string by provenance. Within the accepted
  subset the three agree *by construction* — all parse JSON numbers as IEEE-754 binary64.
- ⚠ **ONE REAL CROSS-RUNTIME DIVERGENCE FOUND AND CLOSED**, which is exactly what a golden vector is
  for: Go's `encoding/json` **silently substitutes U+FFFD for an unpaired surrogate at parse time**,
  so on `{"s":"\ud800"}` TS and Python refuse `lone_surrogate` while a naive Go build would succeed
  and hash a document containing a character that was never in the source. `CanonicalizeJSON`
  detects the substitution; `TestCanonGoDecoderSubstitutionIsCaught` proves **both** the premise and
  the fix, and also proves the safety net (under the bundle's always-on ASCII restriction all three
  refuse either way).
- `roulette/vectors/canonical-bundle.json` — **10 cases + 9 refusals**, parsed at runtime by both
  suites. Covers the RFC's sorting example, whitespace-insignificance, the seven short escapes plus
  `\u00xx` lowercase and the U+007F boundary, literal non-ASCII, JS's integer-like-key quirk, the
  safe-integer boundary **from both sides** (2^53-1 accepted / 2^53 refused), booleans+null, a
  bundle-shaped document, and refusals for `1e+30`, `5e-324`, `1.5`, 2^53, a steamid64-sized JSON
  number, non-ASCII in a **value and a key**, and both surrogate halves.
- ⭐ The closed refusal set **reads its evidence in both suites**: the declared set comes from the
  vector, and the exercised rows plus the `unreachable_refusal_reasons` marker are asserted to
  **partition** it — so a reason that is neither exercised nor declared unreachable fails. The three
  unreachable-from-JSON reasons (`non_finite_number`, `unsupported_type`, `cycle`) are then driven
  from **native** values, so the marker cannot be read as "dead code".
- ⭐ **The three `prng.test.ts` pins reddened by design and that redness was used as evidence.**
  Registering `canonical.ts` failed exactly 2 of 210 tests (the exact-equality module list and the
  import-graph pin) while the `server-only`, `node:`, third-party and 16-item banned-construct scans
  were **already green for the new module** — proving they had really run against it rather than
  passing vacuously. Both pins were then updated deliberately, with the reason written at the site.

**AC11 — the gate-number contradiction is RESOLVED, in writing.** 6.7 noted it, 6.8a noted it again;
noting it a third time was not an option. **6.9a adds its row under the README's existing numbering
as gate 4, and 6.11 renumbers both documents together when it lands the last row** — recorded in
`README.md` and beside the new `outputs` entry, and carried into 6.9b/6.11 as an obligation.

**T2b — the pulled-forward AC9 debts (DECISION K), landed in all three runtimes in ONE edit.**
- `deferred-work.md:335` + `:356` — `STEAMID64_RE` carried into `pity.*` **and** `sweep.*` in TS, Go
  and Python. 6.7 deliberately deferred rather than half-fix, because two sibling modules
  guaranteeing different things about one field is worse than both guaranteeing nothing. Go **reuses
  `stage2.go:773`'s `validSteamID64`** rather than restating it. The byte-lex claim at every
  `.sort()`/`sort.Strings` is now **true by construction** (on `[0-9]+` all three orderings
  coincide), and the comment at `sweep.ts:279` that asserted this "by definition" — which was
  **false** — is corrected.
- `deferred-work.md:348` — `rejections` is integer in TS now (`Math.floor` + an **exactness guard**
  that raises a typed refusal if `consumed` is not a whole multiple of `k`, rather than letting
  `Math.floor` silently absorb a byte-accounting bug).
- ⭐ **THE NO-OP CLAIM WAS MEASURED, NOT ASSERTED**, which is what DECISION K required: after all
  three runtimes changed, `--check` reports **OK ×8 with zero vector drift**, `lib/roulette` is
  846/846, and the whole Go suite is green — so every vector-gated byte count, drawn order and
  reveal order reproduces unchanged. ⚠ The *corpus-level* invariants (22 / 27 / 49 bytes and the
  twelve-award drawn order) are **not** re-derived yet: they come from the real corpus, which is
  Task 9's, and Task 9 has not run.
- ⚠ **Two T2b subtasks are NOT done:** `stage2-resolve.json`'s `unreachable_outcome_kinds` marker
  (`deferred-work.md:316`) is not added, and **DECISION J** (`tie_ladder_exit_step` is spelled
  **ABSENT**, never `0`) is decided and written into the gate-4 vector's bundle-shaped row but is
  **not yet enforced by a builder**, because the builder does not exist yet.

**Gates — measured on this machine, at this commit. ⛔ Nothing here is quoted from a prior story.**

| gate | baseline (measured) | now |
|---|---|---|
| `npm run lint` | — | **0 problems** |
| `npm test` | **1409 / 44 files** | **1442 / 45 files** (+33, one new file: `canonical.test.ts`) |
| `npm run build` | — | **clean**; `/ceremonia` still `ƒ` dynamic (6.9a ships no viewer change) |
| `go build ./... && go vet ./... && go test ./... -count=1` | — | **all packages ok** |
| `gofmt -l ./worker` | — | **empty** |
| `generate_vectors.py --check` | OK ×7 | **OK ×8** |

⚠ The `npm test` baseline was **measured directly** (by temporarily setting `canonical.test.ts`
aside and re-running), not derived by arithmetic and not read from `sprint-status.yaml` — 6.7 quoted
`1318/42` from that file when the real figure was `1322/42`.

**⛔ NOT STARTED — the majority of this story.** Task 1's DB-side semantics (B1-B4, B9, B11, B12),
**Task 3** (migration `0029`: the table, RLS, both policies, the column-scoped grant, and all four
DB debts — the `luck_weight_table` freeze, `tournament`'s column-scoped grant, `spin.label` /
`spin.bytes_consumed`, and `spin_index_positive`), **Task 4** (`publish_bundle`,
`verification_bundle_read`, the `reveal_spin` and `persist_ceremony` replacements,
`lib/ceremony/bundle.ts`, the admin route), **Task 5** (pgTAP + the Go/TS bundle-builder tests),
**Task 8** (the mutation pass), **Task 9** (THE BAR) and **Task 10**'s remaining gates. The bundle
BUILDER itself does not exist: `worker/ceremony/bundle.go` currently carries only the canonicalizer.

⚠ **Consequences of stopping here, stated plainly.** No bundle has been built, canonicalized,
hashed or published; `verification_bundle` does not exist; the AD-22 posture is **unchanged** from
6.8b; the gate-4 vector's `end_to_end` row is still empty and **AC2 is therefore not met** (both
suites assert that emptiness deliberately, so it reddens the moment Task 9 fills it); and
`tournament.fair_seed` is still table-wide readable by `anon`. The only shipped behaviour change is
the T2b tightening of steamid64 validation in the engine, which is proven no-op on all vector data.

### File List

**New**
- `_bmad-output/implementation-artifacts/6-9b-verificar-la-ceremonia.md`
- `lib/roulette/canonical.ts`
- `lib/roulette/canonical.test.ts`
- `worker/ceremony/bundle.go`
- `worker/ceremony/bundle_test.go`
- `roulette/vectors/canonical-bundle.json`

**Modified**
- `_bmad-output/implementation-artifacts/6-9a-verification-bundle-and-the-published-commitment.md` (renamed from `6-9-verification-bundle-and-verificar-la-ceremonia.md`; split carve-out, answered questions, DECISIONS J/K, task rescoping)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `lib/roulette/prng.test.ts` (the shipped-module list and the import-graph pin)
- `lib/roulette/pity.ts` (`STEAMID64_RE`, integer `rejections`, the corrected sort comment)
- `lib/roulette/sweep.ts` (`STEAMID64_RE`, the roster guard, the corrected sort comment)
- `worker/awards/pity.go` (`validSteamID64` reuse)
- `worker/awards/sweep.go` (`validSteamID64` reuse, the roster guard)
- `roulette/vectors/generate_vectors.py` (the JCS canonicalizer, `build_canonical_file`, the `outputs` entry, the pity id guard)
- `roulette/vectors/README.md` (the gate-4 row, the resolved numbering decision, the completeness paragraph)
