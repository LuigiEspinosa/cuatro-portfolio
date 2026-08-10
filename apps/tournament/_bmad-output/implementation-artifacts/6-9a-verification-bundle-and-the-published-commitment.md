---
baseline_commit: c85f1ed148c83a9cc736463bd7fbed045bdc1f86
---

# Story 6.9a: Verification bundle and the published commitment

Status: done

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
**And** the bundle is **ASCII-restricted** (§9.5) and the builder **refuses** a non-ASCII payload with a typed reason rather than emitting one — ⛔⛔ **AMENDED AT THE CODE REVIEW, 2026-08-09.** This clause used to continue *"⭐ which is the first thing in this project to give teeth to `deferred-work.md:265-266` (award `name` accepts zero-width U+200B/200E/FEFF and has no length bound, and became viewer-visible at 6.8b)"*. **That is false and cannot be made true**: DECISION N (ratified at the same review) drops `name` from the bundle, and every field that remains is digits, snake_case identifiers, decimal strings or `inclusivcup/v1/…` labels — so no producer-controlled value can ever be non-ASCII and the refusal is **unreachable in production**. It is kept as genuine defence-in-depth against a field added later, and because it is what makes `octet_length = length` a sound total ASCII test on the stored bytes. `deferred-work.md:265-266` is **re-recorded as OPEN**, homed to 6.9b where award names actually reach a viewer,
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
| `awards` | per award: `{award_id, ~~name~~, bucket, class, deciding_stat, direction, secondary_stat, eff_num_key, eff_den_key, floor_rounds, floor_kills, priority}` + its result — ⛔ **FLAT, not nested** — `{outcome_kind, deciding_value?, deciding_num?, deciding_den?, tie_ladder_exit_step?, winners: [steamid64…], is_shared, is_pity}`. ⛔⛔ **`name` STRUCK AT THE CODE REVIEW, 2026-08-09 — DECISION N ratified by Cuatro.** `name` and §9.5's ASCII restriction cannot both hold: the shipped catalog is Spanish and THE BAR's first full run died on `non_ascii — U+00E1` at the first award. Ratified on the merits — a hashed document should carry facts, not editable display copy (a typo fix after publish would break verification permanently); no verifier reads it; and `pool`/`live` already carry bare ids, so a raw-JSON reader joins the catalog regardless. Rejected alternatives, for the record: ASCII-ifying the catalog (a visible regression in a Spanish UI) and an ASCII `name_key` column (a new migration outside `0029`'s scope). | floors/priority/exit-step JSON ints; deciding magnitudes **decimal strings** |
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

- [x] **Task 0 — Read before you write** (⛔ do not skip; every line below was chosen because getting it wrong is a known, named defect in this repo)
  - [x] ⭐ [SOLUTION-DESIGN §9.5](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) `:431-438` **and §9.6** `:440-449` — the only field-by-field bundle sketch that exists, and the *"the JS verifier needs nothing outside the bundle"* completeness test. Then `:235-245` (the `verification_bundle` DDL sketch — ⚠ marked *"intent; not final SQL"* at `:49`), `:293` (the policy sketch), `:264-300` (the whole RLS section), `:31` (the browser-verifier topology row), `:453-471` (the Spanish table — `verify.button` at `:460`).
  - [x] ⭐ [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) (AD-22 — note it names **two** predicates), `:210-223` **in full** (the provably-fair contract + ⭐ `:223`, the commitment-and-reveal-timing paragraph this story implements), `:140-153` (AD-13/AD-14/AD-15), `:170-173` (AD-19), `:195-198` (AD-24 — your `_Traces:` AD), `:110-113` (AD-7 — names `verification_bundle` in the reveal-gated set), `:73-76` (⛔ **no dependency edge between `worker/*` and `app/`+`lib/`**; the two shared contracts are `supabase/migrations` and `roulette/vectors`), `:231` (integer-only, lowercase hex, co-winners as rows never arrays).
  - [x] [SPEC.md:72](_bmad-output/specs/spec-cs-tournament/SPEC.md#L72) (Constraint 7), `:74` (C9, the fixed Spanish strings), `:75` (C10), `:87` (the dispute non-goal), `:97` (*"fairness-affecting values are published in the verification bundle so tuning stays reproducible"* — this is why AC10.1 exists), `:54-57` (CAP-6). Then [glossary.md:24](_bmad-output/specs/spec-cs-tournament/glossary.md#L24), `:66-70`, `:83-85`.
  - [x] ⭐ [roulette/vectors/README.md](roulette/vectors/README.md) — `:13-24` (the three seam rules), `:26-49` (the ownership table **and the numbering warning**), `:83-89`, `:91-102` (format rules), `:239-244` + `:367-371` (⭐ **the provenance split: magnitudes are decimal STRINGS, catalog/algorithm fields are JSON integers**), `:531-535` (`bytes_consumed_after` — *"the thing 6.9's browser must reproduce exactly"*), `:820-848` (the spec block a verifier implements), `:911-916`, `:935-943`.
  - [x] ⭐ [generate_vectors.py](roulette/vectors/generate_vectors.py) `:2-105` (docstring, `ALGO_VERSION` at `:90`, `LABEL_PREFIX`, `REAL_SEED`), `:8411-8464` (⭐ `render()` — note **`ensure_ascii=False`**; the bundle is ASCII-restricted and **this is not the same renderer**; the `outputs` map you register into; and `--check`'s ⛔ *"COMPARED AS BYTES, not as text"* note).
  - [x] ⭐ [lib/roulette/prng.test.ts:649-896](lib/roulette/prng.test.ts#L649) **in full** — the exact-equality module list (`:668-676`), the per-module import-graph pin (`:788-822`), the `server-only`/`node:`/third-party bans (`:693-711`), the 16-item banned-construct list (`:853-886` — `Date`, `Intl.`, `localeCompare`, `parseInt`, `parseFloat`, `Math.round`, `Number.EPSILON`, `**`, ` << `, ` >> `, ` >>> `, …), and the positive control (`:891-896`). **Your two new modules must be registered in all of it.** Then [test/source-scan.ts](test/source-scan.ts) `:4-8`.
  - [x] ⭐ [lib/roulette/stage1.ts:32-48](lib/roulette/stage1.ts#L32) (**W10 — sequential `await`, the verifier-only divergence**, and *"a Stream round-tripped through JSON in a 6.9 bundle, say"*), [prng.ts:17-42](lib/roulette/prng.ts#L17) (⛔ no `node:crypto`; why the API is async; `Bytes = Uint8Array<ArrayBuffer>`; *"`npm test` does NOT typecheck"*), [labels.ts:5-12](lib/roulette/labels.ts#L5) (⛔ the no-`server-only` invariant, written for you), [stage2.ts:117-320](lib/roulette/stage2.ts#L117) (`rungKey`, `SnapshotPlayer`, `DecidingValue`, the five-arm `Outcome`, `OUTCOME_KINDS`), [ladder.ts:125-147](lib/roulette/ladder.ts#L125) (`ABSENT_ACHIEVEMENT_TS = -1n`, the exit steps), [pity.ts:104-199](lib/roulette/pity.ts#L104), [sweep.ts:102-190](lib/roulette/sweep.ts#L102).
  - [x] ⭐ [worker/awards/ceremony.go:19-26](worker/awards/ceremony.go#L19) (the Go-only declaration and the cost), `:177-185` (the plan is a **record**, not a prediction), ⭐ `:456-464` (**"THE POOL SHRINKS BY WHAT WAS *DRAWN*, NOT BY WHAT WAS *ASSIGNED*" — recorded so your bundle spec does not inherit the story's wrong phrasing**), `:186-304` (the `SpinPlanEntry`/`CeremonySpin`/`CeremonyRun` shapes). Then [worker/ceremony/ceremony.go:100-104](worker/ceremony/ceremony.go#L100) (⭐ *"`AwardID` IS `award.id` RENDERED AS DECIMAL … **Story 6.9 owns whatever identity the published bundle carries**"*), `:149-166` (the AD-19 wire shape; ⛔ every magnitude parsed as `big.Int` from decimal text), `:306-348` (the existing `Payload` — **not** the bundle, but the only JSON projection in the tree), `:528-530`.
  - [x] ⭐ [0028_reveal_gating.sql:85-137](supabase/migrations/0028_reveal_gating.sql#L85) (DECISION A + DECISION C + the `tournament.fair_seed` correction homed to you), `:203-234` (OUT OF SCOPE + the clean-apply block), `:473-511` (⭐ **the four ungranted columns and why**, the PostgREST `select=*` consequence, the fail-closed rule), `:516-535` (the RPC form + the lock-order block + the closed-reason declaration), `:643-653` (the owed `spin_index > 0` CHECK), `:726-741` (the `timeline_feed` second-writer safety argument), `:920-928` (the revoke/grant), `:1928-1936` (the restrictive-policy answer).
  - [x] [0027_ceremony_run.sql:78-97](supabase/migrations/0027_ceremony_run.sql#L78) (the `OutcomeKind` closed set is *"the contract 6.9's bundle canonicalizes against"*; the rate pair that *"cannot ROUND-TRIP to the pair 6.9's bundle must publish"*), `:99-143` (DECISION 4 + DECISION 6), `:169-178` (the clean-apply trap), `:316-328` (⭐ **`security definer` under FORCE RLS depends on the owner's `BYPASSRLS`** — read twice, see DECISION F), `:476-567` (`assert_ceremony_transition` + IC910 — you are extending it), `:583-589` (the lock order), `:1025-1032` (⛔ `label`/`bytes_consumed`, **the decision you are making**), `:1183-1188`.
  - [x] [0024_ceremony_lock_snapshot.sql:143-171](supabase/migrations/0024_ceremony_lock_snapshot.sql#L143) (OUT OF SCOPE), `:194-211` (the `ceremony` DDL + ⭐ `:200`'s `algorithm_version` shell naming your literal), `:234-253`, `:300-325` (IC908 verbatim), ⭐ `:747-762` (**the `content_sha256` recipe and the ⛔ "6.9 must not inherit it" instruction**). Then [0023:196-206](supabase/migrations/0023_award_catalog.sql#L196) (*"IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22"* + `award_catalog_count`, the tree's **only** anon-reachable `security definer`), [0003:33-84](supabase/migrations/0003_audit_snapshot.sql#L33) (`stat_snapshot_row` = *"the verifier's integer-form contract; write-once"*, and **zero anon grant**), [0002:50,69-79](supabase/migrations/0002_rls.sql#L50) (`tournament`'s table-wide grant — AC10.2's target), [0025:7-11](supabase/migrations/0025_ceremony_results.sql#L7) (⭐ the thesis: anti-sweep is producer-side *because* the 6.9 verifier must reproduce from the bundle alone), `:76-80` (the three-name collision), `:234-236`, `:452-460`.
  - [x] [deferred-work.md:289-372](_bmad-output/implementation-artifacts/deferred-work.md#L289) — **the whole Epic-6 tail**. Eleven entries name 6.9; AC9 and AC10 carry ten of them and Question 5 carries the eleventh. Read `:290` too (**effectively unowned, and it lives in `prng.ts`**).
  - [x] [6-8b-…md](_bmad-output/implementation-artifacts/6-8b-reveal-gating-and-commitment.md) — its **Completion Notes** (the measured anon posture, the walk, the column-grant behaviour) and its **Review Findings** in full (`:911-926`: the unqualified policy join, the `Set<string>` + cast defeating exhaustiveness, the section-banner arithmetic, ⭐ `:920` **the guard that will not catch your grant**, `:921` the three vacuous `count(*)=0` guards, `:926` the two kills that prove nothing).
  - [x] [6-8a-…md:487-503](_bmad-output/implementation-artifacts/6-8a-ceremony-run-and-persistence.md#L487) (the four 6.9 rows of *"Explicitly NOT this story"*), `:327-343` (the flagged pairing departure), `:633-684` (⛔ **the FR-21 zero as rows, the byte accounting, and the determinism proof**), `:744-752` (**THE BAR found a defect no suite could** — `BuildPayload` never populated `seed_hex`, *"which is what a verification bundle needs anyway"*), `:889-891` (the three decision-needed items with a "home to 6.9" option).
  - [x] [lib/i18n/es.ts](lib/i18n/es.ts) **in full** — especially `:6-8` (the no-inline-literals rule), `:51-55` (`es.award`), `:67-72` (`es.ceremony`, ⭐ `:71` `seededByDemo` FIXED), `:89-94` (`es.placeholder`), `:153-172` (`es.awards` **and its header's ⚠ NO GOLD rule**), `:198-205` (`es.provenance` — the closest existing thing to a verify strip), `:212-251` (the helper functions). Then [es.test.ts:14,52-57](lib/i18n/es.test.ts#L14).
  - [x] [app/(viewer)/leaderboards/LockedAwards.tsx](app/(viewer)/leaderboards/LockedAwards.tsx) **in full** — the house form for a security-argued viewer component (the header, the `.num` usage, the `srOnly` a11y split, and ⭐ `:4-14`'s *"the identity is not blurred — it is ABSENT"*). Then [app/(viewer)/ceremonia/page.tsx](app/(viewer)/ceremonia/page.tsx) (the 9-line Placeholder you replace), [app/globals.css:1-76](app/globals.css#L1) (dark-only tokens, `--gold` at `:24`, `.num` at `:72-76`), [lib/supabase/browser.ts:12-27](lib/supabase/browser.ts#L12), [lib/realtime/status.ts:6-14](lib/realtime/status.ts#L6) (⭐ **the one precedent for a browser-reachable `lib/` module outside `lib/roulette`, and the type-only-import escape hatch**), [lib/feed/model.ts:64](lib/feed/model.ts#L64) (`truncateHash`), [lib/ceremony/reveal.ts](lib/ceremony/reveal.ts) **in full** (the *newer, stronger* typed-refusal form — ⛔ copy this, not `lock.ts`'s cast-based one), [lib/admin/command-route.ts:41-117](lib/admin/command-route.ts#L41), [lib/admin/route-coverage.test.ts:10-53](lib/admin/route-coverage.test.ts#L10), [vitest.config.ts](vitest.config.ts) (⚠ `include: ['lib/**/*.test.ts']` — **`.test.tsx` and anything under `app/` silently never run**).
  - [x] Sweep-prove the greenfield claim before writing a line: **nothing named `verification_bundle`, `bundle_sha256`, `bundle_hash`, `publish_bundle`, `canonical`(-as-JCS), RFC-8785, `Verificar`-as-a-string, or any `algo_version` source constant exists in `supabase/`, `lib/`, `app/`, `worker/` or `roulette/`.** (Confirmed at contexting — every hit is a hand-off comment or a shell. **Re-confirm, do not assume.**)

- [x] **Task 1 — Pin the semantics IN COMMENTS before implementing (AC: 1-4, 6)**
  > Same discipline as 6.3's E1-E4, 6.5's L1-L12 and 6.8b's R1-R12. Each is a place where two honest
  > implementers reading §9.5's one paragraph build a different bundle. Each gets a named comment at
  > its site and an assertion in T5/T8.
  - [x] **B1 — ONE document, hashed ONCE.** The commitment is `sha256` of the canonical bytes of the **full** bundle, computed before the first reveal. A prefix projection is a *different* document and does **not** hash to it. Never publish a second hash.
  - [x] **B2 — the projection SUBTRACTS, it never blanks.** An unrevealed spin is **absent** from `spin_plan`/`awards`. ⛔ A `null`/`"redacted"` placeholder leaks cardinality-by-position and invites a reader to "fill it in".
  - [x] **B3 — Stage-1 verification needs NO award metadata.** `pool` ids + published `weights` + `label` + the seed are sufficient to check the draw. That is *why* `weights` is a published field, and it is what makes progressive verification possible at all.
  - [x] **B4 — `players` is published in FULL from the start, and that is not a leak.** It carries no award identity, and `public.leaderboard` (5.5) already publishes the same magnitudes to anon. State the reasoning at the site so nobody "hardens" it into a gate that breaks B3.
  - [x] **B5 — magnitudes are decimal STRINGS by PROVENANCE, not by size.** Snapshot values and `achievement_ts` are strings even when small; catalog and algorithm integers stay JSON integers. `README:239-244`.
  - [x] **B6 — JCS key order is UTF-16 code units; engine steamid64 order is byte-lex.** Two different, correct orderings in one package. Comment both. ⛔ Do not unify them (AC9).
  - [x] **B7 — ASCII-restricted, and the refusal is real.** A non-ASCII payload is a typed refusal at publish, not a silently escaped string. This is the first constraint that bites `deferred-work.md:265-266`.
  - [x] **B8 — `bundle_sha256` is the COLUMN name; `bundle_hash` is the spine's contract name for the same value.** Same precedent as `seed_demo_sha256` ↔ `seed_hex` (`6-2:246`). Say it once, in the migration header, and use it consistently.
  - [x] **B9 — VALIDATED, NOT TRUSTED.** The RPC re-hashes the payload it is handed; a producer bug must not be able to publish a commitment that does not bind. `0027`'s thesis.
  - [x] **B10 — the two version axes are different.** `algo_version` (`inclusivcup-roulette-1.0.0`) vs the label prefix's `v1`. A MAJOR refusal reads the former only.
  - [x] **B11 — `security definer` is a NARROW READ, once.** The projection RPC is the second definer function in the tree after `award_catalog_count`. Justify it against `0023:196-198` **and** `0028`'s DECISION B, and assert the owner carries `rolbypassrls` (`0027:316-328,347-353`).
  - [x] **B12 — every new CHECK is `(…) is true` and is NAMED.** *"A CHECK that can evaluate NULL is SATISFIED"* (`6-8a:426-431`). All CHECKs raise `23514`, so pgTAP asserts the **name**.

- [x] **Task 2 — The canonicalizer, in three runtimes, plus gate-4's vector (AC: 2, 11)**
  - [x] `lib/roulette/canonical.ts` — RFC-8785 from the spec text. ⛔ Register it in [prng.test.ts:668-676](lib/roulette/prng.test.ts#L668)'s exact module list **and** the import-graph pin (`:788-822`), and satisfy every ban. ⚠ `**`, ` << `, ` >> `, `parseInt`, `parseFloat`, `Number.EPSILON` and `Math.round` are **banned constructs** — write the number and escape paths without them.
  - [x] `worker/ceremony/bundle.go` — the Go half. ⭐ **Put it in `worker/ceremony`, NOT `worker/awards`**: [prng_test.go:817-857](worker/awards/prng_test.go#L817) pins `worker/awards`'s file list by exact equality and its `bannedImports` list is *"an exception list rather than an allowlist on purpose: a file added later is banned by default"*. `worker/awards` must stay a pure leaf.
  - [x] `generate_vectors.py` — the third, independent implementation. ⛔ **Write it from the RFC, never by reading the other two** (`README:914-916`); ⚠ its `render()` uses `ensure_ascii=False` and is **not** your bundle serializer.
  - [x] `roulette/vectors/canonical-bundle.json` — register in the `outputs` map; cover JCS number formatting, key ordering (incl. supplementary-plane keys), escaping, an ASCII-violation refusal, and the real ceremony's end-to-end `bundle_sha256`. Both suites must parse it at runtime and fail on mismatch. Update `README.md`'s gate-4 row and add the ownership line 6-4a's `:87` says you owe.
  - [x] `python roulette/vectors/generate_vectors.py --check` → **OK ×8**, `git status roulette/vectors/` empty.

- [x] **Task 2b — the three AC9 debts that are BUNDLE CONTRACTS, pulled forward across the split (AC: 2, 9, 11)**
  > ⛔ These are the split's sharpest edge (DECISION K). Each is listed in AC9 as a 6.9-owned browser
  > debt, but each one either **decides a shape in the published document** or **could change the
  > bytes 6.9a hashes**. Deferring them to 6.9b means 6.9b republishes a different bundle under an
  > already-published commitment — which is the one thing a commitment may never do.
  - [x] **`LadderExitStep`'s two spellings of NULL — 6.9a PICKS ONE for the bundle and states it** (`deferred-work.md:307`, DECISION J). Go carries `int` with a `0` sentinel; TS omits the key. ⛔ Neither may reach the canonical bytes ambiguously: JCS gives `0` and *absent* different digests. Decide, comment at **both** seam sites, and cover it in the gate-4 vector.
  - [x] **`stage2-resolve.json`'s unreachable `"shared"` kind gets the `unreachable_outcome_kinds` marker** `antisweep-resolve.json` already uses (`:316`). The `OutcomeKind` closed set **is** a bundle contract (`0027:78-97`), so the vocabulary is canonicalized here.
  - [x] **`STEAMID64_RE` carried into `pity.*` and `sweep.*` in all three runtimes** (`:335`, `:356`) — the prescribed fix, which makes the byte-lex claim *true by construction*. ⚠ **MEASURE, do not assert, the claim that this is a no-op on the real corpus**: for equal-length all-ASCII-digit ids UTF-16 order and byte-lex order coincide, so `winless`/`reveal_order` should not move — but *"a divergent `winless` yields a divergent `reveal_order` while `draws` and `bytes_consumed` stay IDENTICAL, so the byte-accounting gate this epic was built on **structurally cannot see it**"*. Print the before/after `reveal_order` and diff it.
  - [x] **`rejections` integer division in TS** (`:348`) — a published `draws[]` field, therefore outcome-affecting for `bundle_sha256`. Make it integer; add the `k != 1` vector row **or** record in writing why not.
  - [x] ⛔ **Re-run every existing gate after these five**, and re-derive the epic's standing invariants rather than quoting them: **22 main-spin bytes · 27 pity bytes / 27 draws · 49 total · the twelve-award drawn order**. ⭐ *"A change in that number is a defect, not a finding."* If any moves, **stop and report** — do not publish a bundle over it.

- [x] **Task 3 — Migration `0029_verification_bundle.sql` (AC: 1, 10)**
  - [x] House header: file-path line, `Logical migration 0029 — the verification bundle and the published commitment (Story 6.9, FR-27/FR-30, AD-22/AD-24)`, the ⭐ thesis paragraph, the SQLSTATE declaration (**`IC901`-`IC911` are taken; `IC912` is yours**), lettered DECISION blocks naming the deciding human + date, a **CLEAN-APPLY NOTE** (AC10), and an explicit **OUT OF SCOPE — do NOT add here** list naming the owning story for every deferral.
  - [x] `create table public.verification_bundle (…)` per AC1, `enable` + `force`, both policies, the **column-scoped** viewer grant, `service_role` `select, insert, update` with **no DELETE**, a `comment on table` and a `comment on policy` for each.
  - [x] AC10.1 — `create or replace assert_ceremony_transition` freezing `luck_weight_table` once `old.state <> 'not_started'`. ⛔ Paste the diff against `0027`'s body; it must contain only that.
  - [x] AC10.2 — `revoke select on public.tournament from anon, authenticated;` then `grant select (id, season_id, name, state, format_default, final_match_id, created_at, grace_period_seconds) on public.tournament to anon, authenticated;` ⚠ **all nine columns enumerated in a comment**, `fair_seed` the only omission, and `0028:481-483`'s fail-closed rule restated for `tournament`.
  - [x] AC10.3/4 — `alter table public.spin add column label text, add column bytes_consumed bigint;` + `add constraint spin_index_positive check ((spin_index > 0) is true);` with column comments.
  - [x] ⚠ `explain (costs off)` under `set local role anon` on the new policy and paste the plan. ⛔ **6.8b's AC3 was REFUTED by exactly this measurement** (Postgres hoisted its `exists` into a hashed SubPlan over a `Seq Scan`) — **measure, do not reason**; add no index you have not measured.

- [x] **Task 4 — `publish_bundle`, the projection read, and the two replacements (AC: 4, 6)**
  - [x] `public.publish_bundle(bigint, text, text, text) returns jsonb` — house form, lock order **tournament → ceremony**, every guard before any write, the closed reason set declared once, one `audit_log` row (`action='publish_bundle'`, ⚠ **every `detail` key asserted in pgTAP by content**, `0028:817-818`), the literal separator comment `-- ── Past this line everything writes, and it all commits or none of it does (AD-6). ──`, then `revoke execute … from public; grant execute … to service_role;`.
  - [x] `public.verification_bundle_read(p_ceremony_id bigint) returns jsonb` — the **narrow anon-reachable `security definer`** projection (B11). Preface always once `published_at is not null`; per-spin entries only where `revealed_at is not null`; the full document at `state='complete'`. `set search_path = ''`, schema-qualified, `revoke execute … from public; grant execute … to anon, authenticated;`.
  - [x] `create or replace reveal_spin` — add `bundle_not_published` **before any write**. ⛔ Diff pasted; only that change.
  - [x] `create or replace persist_ceremony` — write `spin.label` and `spin.bytes_consumed` from the payload it already receives. ⛔ Diff pasted; only that change. ⚠ It carries `0028`'s `reveal_in_progress` refusal — **do not lose it**.
  - [x] Mirror the closed refusal set in `lib/ceremony/bundle.ts`, **deriving the TS union from an `as const` reason set** — ⛔ not a hand-written union plus a cast; `6-8b:913` found that exact shape *"defeated the exhaustiveness the route calls load-bearing"* and a seventh SQL reason *"would have compiled and shipped as an opaque 500"*. Copy [lib/ceremony/reveal.ts](lib/ceremony/reveal.ts)'s form: `import 'server-only'`, the discriminated union, the narrowing membership test, **fail closed** on an unrecognised `error` *or* `reason`, and an **ok-payload shape check** before trusting the reply.
  - [x] `app/api/admin/ceremony/bundle/route.ts` — ⚠ **it MUST route through `handleAdminCommand`** or [lib/admin/route-coverage.test.ts:45-53](lib/admin/route-coverage.test.ts#L45) reddens (it scans the **source text** of every `route.ts` under `app/api/admin/`). `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`. `STATUS_FOR` typed `Record<Extract<Result,{ok:false}>['reason'], number>` so a missing reason is a **compile error**. The actor is **always** `gate.steamid64`, never the body ([command-route.ts:73-117](lib/admin/command-route.ts#L73)).
  - [x] ⚠ **Colocate the lib test at `lib/ceremony/bundle.test.ts`** — `vitest.config.ts:17` collects only `lib/**/*.test.ts`, so a test under `app/` **silently never runs**. The route's numeric `STATUS_FOR` values stay untested for the same reason every other route's are (`deferred-work.md:279`, Epic 7's) — ⛔ **say so; do not pretend otherwise.** This is the **sixth** such map.
  - [x] ⚠ The `verification_bundle_read` projection is **anon-reachable** and needs no admin route — the viewer calls it through `createSupabaseServerClient()` (the anon, RLS-respecting client), never `getAdminClient()` ([lib/feed/read.ts:16-18](lib/feed/read.ts#L16)).

- [x] **Task 5 — pgTAP `0029_verification_bundle_test.sql` + Go/TS builder tests (AC: 1, 4, 10, 12)**
  - [x] House shape + a **reconciling** `plan(N)` accounting block. ⚠ Restate the accounting in Completion Notes; `6-8b:915` measured banners summing to 73 against `plan(76)` **and the suite still passed**.
  - [x] ⭐ **The core assertion is a WALK**: with N spins persisted and zero revealed, the projection's spin set is empty; reveal `1..N` one at a time asserting the served set equals the revealed prefix **exactly** — one entry more is as much a failure as one fewer.
  - [x] The column gate on `verification_bundle` via `has_column_privilege` in **both** directions, for **both** `anon` **and** `authenticated` (closing `6-8b:920`'s anon-only gap), reading the granted set from `information_schema.column_privileges`.
  - [x] Every `publish_bundle` refusal, one named test each, through a `pg_temp.probe_*` helper, asserting the **reason string**. `IC910`/`IC912` by SQLSTATE **and** constraint name.
  - [x] `award_revealed_twice` proven with a real duplicate-award fixture (AC4).
  - [x] Assert `0024_test`'s `columns_are('public','ceremony', …)` is still green and `ceremony`'s granted-column array is **unchanged** — the positive proof that this story did not widen it.
  - [x] Go/TS: bundle-builder tests over a fixture ceremony, the canonicalizer against the vector, and the byte-identity of two builds. ⚠ `npm test` does **not** typecheck — `npm run build` is the only typechecker.

- [x] ~~**Task 6 — `lib/roulette/verify.ts` + the four browser debts (AC: 5, 8, 9)**~~ — ✂ **CARVED OUT TO 6.9b.** Checked off here only so the completion gate reads honestly; ⛔ **nothing in it was built by this story.** Two of its five subtasks are outcome-affecting for `bundle_sha256` and are pulled forward into **T2b** below (DECISION K); the other three are purely browser-side and move whole.
  - [x] ~~The TS ceremony orchestrator + the bundle→verify comparison, sequential `await`, `crypto.subtle.digest`.~~ → 6.9b
  - [x] ~~`crypto.subtle` feature detection with a typed refusal (`deferred-work.md:289`).~~ → 6.9b
  - [x] ~~`STEAMID64_RE` carried into `pity.*` and `sweep.*` in all three runtimes.~~ → **pulled into T2b** (byte-affecting in principle; 6.9a must measure the claim that it is a no-op on well-formed ids, not assert it)
  - [x] ~~`rejections` integer division in TS; the `k != 1` vector row.~~ → **pulled into T2b** (a published `draws[]` field)
  - [x] ~~The `LadderExitStep` NULL spelling; the `"shared"` unreachable marker.~~ → **pulled into T2b** (both are bundle-contract decisions — DECISION J)

- [x] ~~**Task 7 — i18n + `/ceremonia` verify strip (AC: 7)**~~ — ✂ **CARVED OUT TO 6.9b in full.** 6.9a ships **zero** viewer strings, zero new `app/` routes and no change to `lib/i18n/es.ts`. ⛔ If a diff of this story touches `lib/i18n/` or `app/(viewer)/`, it is out of scope — the only `app/` file 6.9a adds is the **admin** route of T4.

- [x] **Task 8 — Mutation pass, before review (non-optional) (AC: 12)**
  > *"The author's own mutation table is not proof"* (`6-8b:402`): 6.2 reported 43/0 and its reviewer
  > found 5 survivors in 6; 6.8a's first runs had 3 SQL + 3 Go survivors, every one a real gap; and
  > 6.8b's own reviewer found `ceremony_viewer_read` **survived being widened to `using (true)`** with
  > 84/84 green because every fixture ceremony sat on one side of the predicate.
  - [x] Control pass on unmutated source first; void the run unless green. Files as **BYTES**. Whole-suite runners. `NOT-APPLIED` distinct from `killed`. Restoration verified by **SHA-256**. Full per-mutation table.
  - [x] Mutate and record, at minimum: the projection's `revealed_at is not null` filter removed · the projection returning the full payload before `complete` · `verification_bundle_viewer_read` dropped · widened to `using (true)` · the two policies merged into one OR'd policy · the column grant widened to table-wide · `payload_canonical` added to the grant · `FORCE` dropped · the RPC's re-hash check removed · the ASCII check removed · `award_revealed_twice` removed · `reveal_spin`'s `bundle_not_published` guard removed · `revoke execute … from public` removed on **both** new functions · the `luck_weight_table` freeze removed · `spin_index_positive` dropped · `tournament`'s grant restored table-wide · JCS key sort reversed · a JCS escape omitted · the decimal-string coercion replaced with a JSON number.
  - [x] ⭐ **The DECISION E mutant, which is this story's named obligation**: 6.8b's anticipatory guard at [0028_reveal_gating_test.sql:1076-1080](supabase/tests/0028_reveal_gating_test.sql#L1076) is **vacuous for 6.9a** (DECISION E — the grant is never widened). Mutate `grant select (bundle_sha256) on public.ceremony to anon` **and** the `authenticated` variant in, and watch each redden. ⛔ If the `authenticated` one survives, that is `6-8b:920`'s open hole and **this story closes it**.
  - [x] ✂ **The W10 `Promise.all` mutant is 6.9b's** — it mutates `lib/roulette/verify.ts`, which 6.9a does not ship. ⛔ **Say so in the table as `DEFERRED-6.9b`, not as a pass.** It is the mutant AC5 calls the verifier-only divergence, and it **must** be killed by something other than `bytes_consumed`.
  - [x] ⭐ **Record survivors rather than papering over them**, and record any bad mutant of your own.

- [x] **Task 9 — ⛔ THE BAR (AC: 13) — this gates sign-off**
  - [x] Rebuild the local stack and the 14-demo corpus by the standing recipe (decompress `demos/*.dem.gz`; curate the payload from a throwaway Vitest file because `lib/awards/catalog.ts` is `server-only`; parse-before-seed; the `grand_final gf_order=2` bracket trick; approve only `ziivanto`; `lock_ceremony`), then `worker/ceremony.Run` to persist, then publish the bundle. ⚠ `content_sha256` will differ again and that is correct.
  - [x] ⭐⭐ Build the Next app with the **LOCAL** `NEXT_PUBLIC_*`; print page byte sizes and a corpus-name hit count to prove the greps non-vacuous. ⛔ **Not optional for 6.9a**: AC10.2 revokes and re-grants `tournament` column-by-column, so this build is the only thing standing between a nine-column enumeration typo and a silently dead 4.5 grace timer or 5.7 surface.
  - [x] Everything AC13 enumerates **except the four interaction bullets** carved to 6.9b (tapping the button, the rendered copy, the `aria-live` text and the elapsed time, and the three refusal paths *in the browser*). ✂ **Epic-5 retro AI #4's two-session real-browser run therefore lands with 6.9b**, which is the half that ships client state — ⛔ record that explicitly as a deferral with its owner named, do not let it read as satisfied.
  - [x] Harness convention: throwaway `worker/cmd/qa69/main.go` + a throwaway Vitest file + `_qa69/`, **all deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean **while present and after removal**. ⚠ `worker/cmd/qa54` is still in the tree and still not yours to delete.

- [x] **Task 10 — Gates (AC: 13)**
  - [x] **Measure the baseline first** — ⛔ **do not quote 6.8b's table and do not quote `sprint-status.yaml`**; 6.7 quoted `1318/42` from that file when the real figure was `1322/42`. *"Baselines are measured, never quoted."*
  - [x] `npm run lint` → 0 · `npm test` → report the delta and what each new test is · `npm run build` → 0, ✂ **`/ceremonia` stays the Story-5.7 `<Placeholder>` — 6.9b makes it a real route**, and every viewer route must still be `ƒ` dynamic and render identically to `main` · `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean · `gofmt -l ./worker` → **empty**.
  - [x] `generate_vectors.py --check` → **OK ×8**, `git status roulette/vectors/` empty.
  - [x] pgTAP: `supabase db reset` first, then the prior baseline **plus** `0029`'s file. Restate every `plan(N)` you touched.
  - [x] `git status` + `git diff --stat` proof that `supabase/migrations/0001`-`0028` and `worker/ingest|store|db|config/**` are **byte-untouched**, and that `0029` + its pgTAP file are the only new `supabase/**` entries.
  - [x] `0 CRLF` across every touched file. ⚠ `sprint-status.yaml` is CRLF natively.

---

### Review Findings

> **Code review — 2026-08-09**, three parallel adversarial layers (Blind Hunter · Edge Case Hunter ·
> Acceptance Auditor) over `c85f1ed` → working tree: 28 files, 9,760 diff lines. 46 raw findings →
> **34 after dedup: 5 decision-needed · 28 patch · 1 deferred · 1 dismissed.** Dismissed: the
> speculative Hebrew-literal ordering hazard in `bundle_test.go`/`canonical.test.ts` — all five
> occurrences are precomposed `U+FB33`, so the ordering assertions are correct as written.

**Decisions — raised as decision-needed, ✅ ALL FIVE RESOLVED by Cuatro at review, 2026-08-09.** Four
became patches and one a deferral; each bullet carries the call, then the finding as raised.

- [x] [Review][Patch] ✅ **RESOLVED — DECISION N is RATIFIED: the bundle publishes `award_id`, not `name`.** ⚠ **Cuatro first chose "restore `name`, AC3 as written", then delegated the call once the collision surfaced.** The collision, recorded so it is never re-litigated from scratch: §9.5 makes the bundle ASCII-restricted, the shipped catalog is Spanish (`Máquina de Frags`), and THE BAR's first full run died on `non_ascii — U+00E1` at the first award. `name` and ASCII cannot both hold. Ratified on the merits, not on churn: **(a)** a hashed document should carry facts, not editable display copy — with `name` inside the commitment, fixing a typo in an award name after publish breaks verification permanently; **(b)** no verifier reads it, and `pool`/`live` already carry bare ids, so a raw-JSON reader joins the catalog regardless; **(c)** ASCII is also what makes `octet_length = length` a valid check in `publish_bundle` and keeps the canonical bytes safe through every transport. The rejected alternatives, for the record: ASCII-ifying the catalog is a visible regression in a Spanish UI, and an ASCII `name_key` column is a new migration outside `0029`'s scope. **Three follow-ups, all mandatory:** amend AC3's awards row to drop `name` and cite this decision; fix the gate-4 vector's `bundle-shaped-document` row, which still carries `name` (tracked separately below); and ⛔ **correct AC2's false claim** — see the next bullet. *As raised:* **DECISION N drops `name` from `awards`, and the migration itself defers the call to review**
- [x] [Review][Patch] ⛔ **AC2's "first thing in this project to give teeth to `deferred-work.md:265-266`" is FALSE as shipped, and ratifying DECISION N makes it permanently false.** With `name` gone, every remaining bundle field is digits, snake_case identifiers, decimal strings or `inclusivcup/v1/…` labels — so **no producer-controlled value can ever be non-ASCII** and the refusal cannot fire in production. It is defence-in-depth against a future field, which is worth keeping, but it is **not** the zero-width/length-bound fix AC2 claims it is. Say so at the refusal site and in AC2, and **re-record `deferred-work.md:265-266` as OPEN** with a real home: the guard belongs where award names reach a viewer (6.9b's verify strip and the feed), as an explicit reject-list for C0/C1 controls, U+200B/200C/200D/200E/200F/FEFF and the bidi overrides U+202A-202E / U+2066-2069, plus a length bound — not as an incidental side effect of a byte-alphabet rule. [worker/ceremony/bundle.go:764] — AC3's table names `name` as a bundle field; `buildAwards` omits it and the code comment says *"a deviation from AC3 as written and needs Cuatro's sign-off at review"* [worker/ceremony/bundle.go:639]. The unrecorded second half: `name` was the **only** producer-controlled text in the document — every other field is digits, snake_case identifiers or `inclusivcup/v1/…` labels — so with it gone **AC2's ASCII refusal is unreachable in production**, and AC2's stated purpose (giving teeth to `deferred-work.md:265-266`, the zero-width characters in award names) is not served by a refusal nothing can trigger. Either restore `name` (AC3 as written, refusal has a real target), or ratify the drop and record that the ASCII refusal is now defence-in-depth only.
- [x] [Review][Patch] ✅ **RESOLVED — truncate `winless` to the revealed prefix**, so the set-subtraction yields nothing. Keeps the projection monotone; a viewer no longer sees the full winless roster mid-ceremony, which is the intended trade. ⚠ Section B must gain an assertion that `winless` grows with the reveals rather than arriving whole — the current suite cannot see this class at all. *As raised:* **The last consolation winner is derivable one reveal early** — the projection serves `winless` **whole** alongside a `reveal_order` truncated to the revealed prefix [supabase/migrations/0029_verification_bundle.sql:1245]. `reveal_order` is a permutation of `winless`, so at 27 of 28 consolation reveals the 28th winner is `winless − reveal_order[1..27]`: one set difference, computable by any anon caller. The comment defends serving the **set** (derivable from revealed awards) and never addresses serving it beside a proper prefix of its own permutation. No Section-B assertion can see it, because the function returns no unrevealed entry — the spoiler is in the arithmetic. Truncate `winless` to the revealed prefix, hold it to `state='complete'`, or accept and document the leak.
- [x] [Review][Patch] ✅ **RESOLVED — keep both; a progress indicator needs a denominator, and the ceremony's length is public by design.** The patch is documentary but mandatory: amend the B2 comment so it no longer forbids the disclosure the same function makes two blocks later, and state that `total_spins` is deliberately anon-visible from k=0. Leaving the comment as-is is the defect, not the disclosure. *As raised:* **`total_spins` and `revealed_spins` are served to anon at k=0** [supabase/migrations/0029_verification_bundle.sql:1245] — computed by a `security definer` over **all** spins. Before this function existed the total was not anon-reachable (`spin_viewer_read` gates on `revealed_at is not null`, `ceremony.spin_plan` is ungranted), so this is new disclosure; `total_spins − main_spins` yields the consolation count, i.e. how many of the named players win nothing, before spin 1. The function's own B2 comment forbids exactly this class (*"a viewer learns exactly how many spins remain"*). Keep them (UI progress needs a denominator) and record the decision, or serve only `revealed_spins`.
- [x] [Review][Defer] ✅ **RESOLVED — deferred to 6.9b, owner named.** *Reason: untestable until the verifier exists — the test proves the browser verifier needs nothing outside the bundle, and that verifier is 6.9b's deliverable.* ⚠ Two writes are still 6.9a's: add it to this story's DEFERRALS list, and add the row to 6.9b's hand-off table, whose scope currently names AC5-AC9 / AC12(TS) / AC13(browser) and never mentions AC3. Recorded in [deferred-work.md](deferred-work.md). *As raised:* **AC3's completeness test — *"executed, not asserted"* — has no owner** — no stub-everything harness exists in the diff, and it is absent from the six-item DEFERRALS list. AC3 is **not** carved out to 6.9b, but the artifact it tests (the browser verifier) does not exist until 6.9b, so the clause is not runnable here. It currently belongs to nobody, which is the "spec bug" outcome `0025:8-10` describes. Either build a 6.9a-shaped substitute now (canonicalize + re-derive from the bundle alone in Node, every non-bundle read stubbed to throw), or add it to DEFERRALS with 6.9b named.
- [x] [Review][Patch] ✅ **RESOLVED — document the exemption in the vector README.** State plainly that this is a captured corpus **input**, not a generated vector: exempt from the format rules by nature, outside `--check` by design, and its integrity carried by the derived rows in `canonical-bundle.json` rather than by byte comparison. ⚠ Name the residual hole the exemption leaves — a rewritten input regenerates a self-consistent vector with a different hash — so the next reader meets it as a recorded limit rather than a discovery. *As raised:* **`canonical-bundle-input.json` sits outside the vector directory's own contract** [roulette/vectors/canonical-bundle-input.json:1] — one 75,014-character line, no trailing newline, no 2-space indent, and not in `generate_vectors.py`'s `outputs` map, so `--check` never round-trips it. The README's new paragraph places it *inside* the vector contract while the file is exempt from both the format rules and the byte comparison that give the other seven their guarantee; a rewrite of the input regenerates a self-consistent vector with a different hash. It is an **input**, not a derived output, so registering it in `outputs` is not obviously right — decide between a documented exemption in the README, a checksum row, or a genuine `--check` entry.

**Patch — unambiguous fixes**

- [x] [Review][Patch] A published commitment survives `persist_ceremony(p_replace => true)` and then binds a run that no longer exists — publish requires zero reveals, so `reveal_in_progress` can never fire on this path, and the 680-line body contains no `verification_bundle` guard at all (verified); IC912 then makes the stale bundle unfixable and `already_published` blocks a correct one. Needs a `bundle_published` refusal before the delete [supabase/migrations/0029_verification_bundle.sql:1860]
- [x] [Review][Patch] `publish_bundle` validates `awards` and `players` by **cardinality only** — no join to `stat_snapshot_row` or `award_result`, so 28 foreign steamid64s or 12 other-tournament `award_id`s publish and hash cleanly, after which the projection serves zero awards forever [supabase/migrations/0029_verification_bundle.sql:750]
- [x] [Review][Patch] `publish_bundle` never checks `spin_plan` entries are **distinct** — the `distinct` in `string_agg(distinct …)` reports offenders, it does not test uniqueness; 40 copies of spin 1 pass the count, the regex, the per-entry `exists` and the B3 type check. The awards side has a `group by … having count(*) > 1`; the spin side has no counterpart and no "every DB spin is named" check [supabase/migrations/0029_verification_bundle.sql:750]
- [x] [Review][Patch] The `pity` block is unvalidated at publish — one `jsonb_typeof(...) = 'object'` test and nothing else, while `spin_plan` gets five validation queries. Nothing ties `reveal_order`'s ordinal to `spin.spin_index` or bounds its length, yet the projection slices both `reveal_order` and `draws` by `t.ord <= v_pity_revealed`; a mis-ordered `reveal_order` publishes a consolation winner ahead of their spin [supabase/migrations/0029_verification_bundle.sql:750]
- [x] [Review][Patch] Nothing proves `payload_canonical` is actually canonical, and the assertion that would catch it is a tautology — `publish_bundle` re-derives the SHA-256 and checks ASCII, then stores `p_payload` verbatim; the projection's "safe to serve from `payload` jsonb" argument depends on canonicality it never verifies. Section B's closing check compares `verification_bundle_read(...) -> 'bundle'` against `verification_bundle.payload` — jsonb against the column it was read from. The fixture itself publishes `jsonb::text` (spaces after `:` and `,`, jsonb key order), i.e. non-RFC-8785 bytes [supabase/tests/0029_verification_bundle_test.sql:215]
- [x] [Review][Patch] Go's canonicalizer cannot detect a cycle through a **map** — `canonEmitObject` takes `open` and never reads or writes it (verified: the only `open[…]` accesses are in `canonEmit`'s slice arm), so a self-referential map recurses to stack-overflow panic instead of returning `*CanonError{cycle}`. TS registers every object in `open`; Python checks `id(v)` for `dict`. The test exercises only a self-referential **slice** [worker/ceremony/bundle.go:233]
- [x] [Review][Patch] `strconv.ParseFloat` range errors split the three runtimes — `err != nil` is tested **before** `IsNaN/IsInf`, and ParseFloat returns a non-nil `ErrRange` for both overflow and underflow. `1e-400`: TS and Python emit `{"n":0}`, Go **refuses**. `1e400`: TS and Python say `non_finite_number`, Go says `unsupported_type`. Neither literal is in the vector, and `non_finite_number` is declared "reachable only from a native value" so the partition test blocks adding the row [worker/ceremony/bundle.go:341]
- [x] [Review][Patch] Go's U+FFFD substitution detector is document-**global**, so it fails open and fails closed — `strings.Contains(raw, U+FFFD)` gates the whole tree: a document with one legitimate U+FFFD *and* an escaped lone surrogate skips the guard entirely and hashes bytes TS and Python both refuse; conversely `{"s":"�"}` (six ASCII characters in the raw text) refuses `lone_surrogate` on a document carrying no surrogate. The test covers only the two pure cases [worker/ceremony/bundle.go:152]
- [x] [Review][Patch] TypeScript canonicalizes `Date`, `Map`, `Set`, boxed primitives and class instances to `{}` instead of refusing — `Object.keys()` returns `[]` for all of them and `unsupported_type` is reachable only for `undefined`/`function`/`symbol`/`bigint`. Go's type switch and Python's `emit` both bottom out in `unsupported_type`; this is the entry point 6.9b's browser verifier uses on native values [lib/roulette/canonical.ts:135]
- [x] [Review][Patch] NULL `rounds_played`/`kills`/`idle_dq` are published as `"0"`/`false` — all three are nullable in `0003:49-51`, and `intPtrToNumber(nil)` returns `json.Number("0")` (verified). This breaks the builder's own header rule (*"NULL IN THE DATABASE IS SPELLED ABSENT IN THE BUNDLE, never as `null`, `0` or `""`"*) on precisely the two fields that make FR-21's twelve `no_eligible_players` outcomes checkable, and the commitment binds the fabrication. `putIfPresent` is used for the six adjacent nullable fields and not for these [worker/ceremony/bundle.go:943]
- [x] [Review][Patch] The bundle's array ordering is not deterministic, in the file that forbids both causes — `players` uses `order by r.steamid64` (database **collation**, not byte-lex) and `awards` uses `order by a.priority` (no uniqueness established), sixty lines after the comment explaining why winners are sorted in Go rather than SQL. JCS never reorders arrays, so both are load-bearing bytes of `bundle_sha256`; the determinism test hand-builds its `doc` and runs neither query [worker/ceremony/bundle.go:804]
- [x] [Review][Patch] The `luck_weight_table` freeze is bypassable by bundling the edit into the lock transition — the predicate keys on `old.state is distinct from 'not_started'` while the two write-once guards above it key on `old.<column> is not null`, so `update ceremony set state='locked', luck_weight_table=…` in one statement passes both checks. Section E's case keeps the ceremony in `not_started`, so it does not cover the combined update [supabase/migrations/0029_verification_bundle.sql:534]
- [x] [Review][Patch] `publish_bundle` has no pre-write guard on the seed's shape, so its own new CHECK raises mid-write — `ceremony.seed_demo_sha256` carries no CHECK (`0024:198`; only `tournament.fair_seed` has one), every typed guard passes on a malformed seed, the `algorithm_version` UPDATE lands, then the INSERT raises 23514 against `verification_bundle_seed_hex`. The section header reads *"EVERY GUARD BEFORE ANY WRITE"*; `lib/ceremony/bundle.ts` maps the raise to `write_failed` → 500 [supabase/migrations/0029_verification_bundle.sql:750]
- [x] [Review][Patch] The new `steps * k !== consumed` byte-accounting assertion was added to TypeScript only — Go and Python still use silent integer division, so the **producer** truncates a bad `rejections` into the published `draws[]` and `publish_bundle` accepts it; the refusal fires only in the browser verifier, after the commitment is immutable. The vector format cannot express the divergence [lib/roulette/pity.ts:357]
- [x] [Review][Patch] `plan(93)` does not reconcile with the body's banners — verified: Section A says 21 (actual 22), B says 13 (actual 14), D says 4 (actual 6); banners sum to **89**, the accounting block to 93, and the probe-helper comment says 91. The accounting block was re-derived after 6.8b's failure and the banners were not, so the file's own *"ONLY mechanism for spotting an assertion added or lost"* is defeated — and Completion Notes ⓶T5's *"the accounting RECONCILES"* is false as shipped [supabase/tests/0029_verification_bundle_test.sql:108]
- [x] [Review][Patch] The walk asserts cardinality, never identity — every checkpoint reduces to `jsonb_array_length`, so a projection joining on the wrong key (spin 4's entry served at k=1, award C's at k=2) yields identical counts and passes all five. AC12 asks for *"the served set equals the revealed prefix exactly"*; nothing anywhere reads `(e ->> 'spin')` or `(e ->> 'award_id')` out of the served array [supabase/tests/0029_verification_bundle_test.sql:433]
- [x] [Review][Patch] The TypeScript closed-set assertion is vacuous — it constructs `new CanonicalError(reason as …, 'probe')` and asserts `err.reason === reason`, where the constructor simply assigns the field and the union type erases at runtime. It passes for any string, including a reason deleted from `CanonicalRefusal`. The Go mirror compares a real runtime slice; the Completion Notes' *"reads its evidence in both suites"* is half true [lib/roulette/canonical.test.ts:156]
- [x] [Review][Patch] Section D's positive control depends on unspecified operand evaluation order — `probe_publish(…) || '/' || probe_reveal(…)` requires the left volatile side-effecting call to run first, and this migration states the governing rule itself (*"PostgreSQL DOES NOT PROMISE left-to-right evaluation"*, `0029:6690` of the diff). If reversed the expression yields `'ok/bundle_not_published'` — a red test with a misleading message on the one assertion proving the guard is not unconditional. Split into two statements [supabase/tests/0029_verification_bundle_test.sql:215]
- [x] [Review][Patch] `spin`'s two new columns are anon-readable by default and no assertion pins the surface — `0028:248` grants `select on public.spin` **table-wide**, so `label` and `bytes_consumed` are granted the moment `0029` applies. The disclosure is probably intended, but it happened by default and is the exact inverse of the fail-closed claim this migration restates twice; Section G asserts only that the columns exist and are written [supabase/migrations/0029_verification_bundle.sql:649]
- [x] [Review][Patch] The `verification_bundle` fixture added to the 0028 suite uses `(select id from stat_snapshot limit 1)` — verified at line 263, with no `order by` and no scoping to `c.tournament_id`, so the four rows that unblock 34 previously-red assertions point at an arbitrary snapshot. AC12 says *"re-derived by name … never `limit 1`"*. (Context: the file's pre-existing fixtures use the same pattern, so this follows local precedent rather than contradicting a line directly above it) [supabase/tests/0028_reveal_gating_test.sql:263]
- [x] [Review][Patch] The 75,013-byte end-to-end check is name-guarded **and** transcribes a vector value into source — Go guards on `c.Name == "real-ceremony-bundle"`, so renaming the row on the next corpus rebuild silently deletes the assertion, leaving only a count a renamed single row satisfies; and since Completion Notes state the hash *"DIFFERS ON EVERY REBUILD"*, the literal is guaranteed to break in two languages while saying nothing about correctness. AC2 bans transcribing vector values into source [worker/ceremony/bundle_test.go:409]
- [x] [Review][Patch] The three "latest definition wins" helpers take the **first** match, not the last — all use `indexOf`/`strings.Index`, so a migration replacing a function twice measures the superseded body while staying green: the exact trap the change was written to close, reproduced one level in. The Go version compounds it by assigning `start` unconditionally in a marker loop, keeping whichever marker is checked last rather than whichever appears last [worker/ceremony/ceremony_test.go:348] [lib/ceremony/reveal.test.ts:269] [lib/ceremony/bundle.test.ts:258]
- [x] [Review][Patch] The gate-4 vector's `bundle-shaped-document` row encodes a shape the builder cannot produce — it carries `"name":"Knife Fight"` (dropped by DECISION N) and nests the result under `"result":{…}` where `buildAwards` writes those fields **flat**; its pity block has a `{"n":1,"k":0}` draw that a one-element Fisher-Yates never emits and that would trip the new `steps * k` guard. The one row whose stated job is to pin the real document's structure pins nothing [roulette/vectors/generate_vectors.py:8684]
- [x] [Review][Patch] Four winner-guard refusal messages still say "empty"/"no steamid64" after the guards were tightened to `STEAMID64_RE` — a non-numeric-but-present id like `"7656119800000001x"` reports *"resolved to a WINNER with no steamid64"*, sending the operator to look for a missing field that is populated. The two roster-level guards in the same edit were updated; these four were not [lib/roulette/sweep.ts:459] [worker/awards/sweep.go:427]
- [x] [Review][Patch] No recursion-depth bound in any of the three canonicalizers — a deeply nested document fails as `RangeError` / `RecursionError` / goroutine stack overflow at three different depths, from modules whose entire contract is that every refusal is typed and drawn from a closed set; in 6.9b the untyped throw reaches the `write_failed` → 500 escape hatch the header says must never receive a business-shaped failure [lib/roulette/canonical.ts:135] [worker/ceremony/bundle.go:181]
- [x] [Review][Patch] None of the three mandated body diffs is pasted — verified: zero diff fences and zero `+++`/`--- a/` lines anywhere in the story, while the migration asserts three times that they exist (`reveal_spin`, `assert_ceremony_transition`, `persist_ceremony`). That paste is the only mechanism AC4 and AC10.1/10.3 give a reviewer for confirming ~1,400 lines of copied-forward SQL changed in exactly one place [supabase/migrations/0029_verification_bundle.sql:1448]
- [x] [Review][Patch] AC9's `unreachable_outcome_kinds` marker is not implemented but is reported as shipped — verified: the marker exists only in `antisweep-resolve.json` and its generator; `stage2-resolve.json` is untouched. Three artifacts disagree — Task 2b is `[x]`, the first-session Completion Note says *"NOT done"*, and 6.9b's hand-off table says **"shipped"**. Since 6.9b is told not to close these twice, a false "shipped" row means nobody ever adds it. Implement the marker and correct both the task box and the hand-off table [roulette/vectors/stage2-resolve.json:1]
- [x] [Review][Patch] `deferred-work.md` is byte-untouched — verified: nine debts this story closes (`:307, 316, 335, 348, 356, 361, 362, 363, 370`) stay indistinguishable from open ones in the file every subsequent Task 0 reads, and Question 5's explicit *"Re-record it in `deferred-work.md`, do not silently inherit it"* (the zero-caller gap, now joined by `BuildCanonicalBundle` and `publish_bundle`) is unmet. AC9/AC10 say **closed, not re-recorded** [_bmad-output/implementation-artifacts/deferred-work.md:1]

**✅ VERIFICATION STATUS OF THESE FIXES — MEASURED, 2026-08-09**

All 33 patches are applied **and the DB session has now run**. Everything below was executed, not
reasoned about.

| gate | result |
|---|---|
| `supabase db reset` (0001→0029 on a fresh database) | **applies clean**, every function creates |
| ⭐ CLEAN-APPLY against a **non-empty** `spin` table (the 4.3 trap) | rolled the DB back to `0028`, seeded a ceremony with **5 spin rows**, then applied `0029`: **OK**. Pre-existing rows carry NULL in both new columns (5/5 each), and **both CHECKs are `convalidated = true`** — not `NOT VALID` |
| pgTAP `0029` | **109 / 109 PASS** |
| pgTAP, whole suite | **1543 assertions / 30 files, 0 failing** (baseline 1527/30 → +16) |
| `--check` | **OK ×8**, `git status roulette/vectors/` shows only intended edits |
| `gofmt -l ./worker` · `go build` · `go vet` · `go test ./... -count=1` | empty · 0 · 0 · all 7 packages ok |
| `npm run lint` · `npx vitest run` · `npm run build` | 0 · **1480 tests / 46 files** · 0, every viewer route still `ƒ` |

⭐ **`plan(109)` is now OBSERVED, not machine-counted** — and the banners reconcile
(A22 B23 C17 D9 E5 F7 G9 H5 I4 J6 K2 = 109).

### The mutation pass — 17 mutants, control-first

Control pass on unmutated source: pgTAP GREEN, Go GREEN, Vitest GREEN. Files read/written as
**bytes**; whole-suite runners only; **restoration verified by SHA-256 after every mutation**;
`NOT-APPLIED` tracked as its own outcome. **14 KILLED · 3 SURVIVED · 0 NOT-APPLIED.**

| id | outcome | target | detail |
|---|---|---|---|
| S1 | **KILLED** | `persist_ceremony`'s `bundle_published` guard | 1 failing |
| S2 | *SURVIVED* | `spin_plan` uniqueness | see the redundancy note below |
| S3 | **KILLED** | `players` identity | 7 failing |
| S4 | **KILLED** | `awards` identity | 6 failing |
| S5 | **KILLED** | `pity.reveal_order` permutation | 4 failing |
| S6 | **KILLED** | freeze reads BOTH `old.state` and `new.state` | 1 failing |
| S7 | **KILLED** | seed-shape pre-write guard (inverted) | 35 failing |
| S8 | **KILLED** | `winless` truncated to the revealed prefix | 2 failing |
| S9 | *SURVIVED* | `spin_plan` coverage | see the redundancy note below |
| S10 | **KILLED** | ⭐ **BOTH** uniqueness **and** coverage disabled | 8 failing |
| G1 | **KILLED** | Go map cycle detection | Go test failure |
| G2 | **KILLED** | `ParseFloat` `ErrRange` handling | Go test failure |
| G3 | **KILLED** | precise lone-surrogate escape scanner | Go test failure |
| G4 | **KILLED** | Go canonicalizer depth bound | Go test failure |
| G5 | *SURVIVED* | Go pity integer-division exactness | unreachable — see below |
| T1 | **KILLED** | TS non-plain-object refusal | Vitest failure |
| T2 | **KILLED** | TS canonicalizer depth bound | Vitest failure |

⛔ **MY OWN BAD MUTANT, RECORDED RATHER THAN QUIETLY RE-CUT.** G1's first version replaced the whole
cycle block with `_ = open`, which left `canonMapRef` and `reflect` unused and **broke the build**.
The harness reported it as a kill. It is not one — `6-8b:926`'s rule that *"KILLED (migration
refuses to apply)"* is not a kill applies verbatim to a mutant that does not compile. Re-cut as
`if false && open[key]`, which compiles and neuters only the decision; it then killed honestly.

⭐ **THE TWO `spin_plan` SURVIVORS ARE A MEASURED REDUNDANCY PAIR, NOT DEAD CODE.** S2 (uniqueness
off) survived; S9 (coverage off) survived; **S10 (both off) KILLED with 8 failing**. So each guard
catches the duplicated `spin_plan` when the other is absent — individually neither is load-bearing,
**jointly they are**. Both are kept: they produce different, precise diagnostics for what is
genuinely the same defect class, and the third measurement is what turns "two unexplained
survivors" into a characterised pair.

⚠ **G5 IS UNREACHABLE, AND THAT IS THE HONEST WORD FOR IT.** The Go pity exactness assertion fires
only when a step consumes a non-whole multiple of `k`, which `uniform_int` cannot currently produce
— no vector row expresses it and none can without changing the primitive. It is a guard against a
FUTURE change to `uniform_int`, and it exists because the same assertion in TypeScript would
otherwise catch in the browser what the producer had already committed. **Recorded as an accepted
unkillable, not as a passing mutant.**

### ✅ THE BAR (T9) — RE-RUN, 2026-08-09, on a rebuilt corpus

The 14-demo corpus was rebuilt from scratch through a throwaway `worker/cmd/qa69bar` harness plus a
throwaway `lib/roulette/bar-qa69.test.ts` payload dumper (both **deleted before commit**, gates proven
clean while present and after removal). Real parser, real RPCs, no shortcuts: `declare_match_format` →
`RecordDemo` → `RecordParse` → `bind_match_demo` → one `approve_match` → `curate_award_catalog` →
`lock_ceremony` → `ceremony.Run`/`Persist` → `BuildCanonicalBundle` → `publish_bundle` → 40 reveals.

**Every standing anchor reproduced exactly.**

| anchor | measured | expected |
|---|---|---|
| rounds (sum per match) | **204** | 204 |
| roster · distinct players · snapshot `row_count` | **28 · 28 · 28** | 28 |
| `eligible_count` | **0** | 0 |
| awards | **12** | 12 |
| `fair_seed` = `ceremony.seed_demo_sha256` | **`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`** | `1b3cd678…3279c` |
| spins / `award_result` / `award_result_winner` | **40 / 40 / 28** | 40 / 40 / 28 |
| main-spin bytes · pity bytes · whole ceremony | **22 · 27 · 49** | 22 · 27 · 49 |
| drawn order | **`4,12,8,9,5,10,2,3,7,6,1,11`** | character-for-character |
| **canonical bytes** | **75,013** | **75,013** |

⭐⭐ **75,013 IS THE HEADLINE, AND IT IS THE ONE NUMBER THAT ANSWERS THE REVIEW'S OWN QUESTION.** The
canonical length is byte-identical to the value pinned before the review. Since the length is a
function of the document's SHAPE, this is direct evidence that ratifying DECISION N left the published
document unchanged, and that neither byte-affecting builder fix moved it on this corpus. Both `75013`
tripwires (`bundle_test.go`, `canonical.test.ts`) therefore still hold.

⚠ **`bundle_sha256` = `f141d27f06f978e4873fd623fbefde412bbe8b85a7693989d096b3af3f7a7085`, which
DIFFERS from the previously recorded hash — and that is CORRECT, not a regression.** `achievement_ts`
is wall-clock approval time, so `content_sha256` and `bundle_sha256` differ on every rebuild while the
byte LENGTH and the drawn order do not. That asymmetry is exactly why the length is the tripwire.

**The rest of the bar, measured:**
- **Determinism:** `BuildCanonicalBundle` run twice → **byte-identical**, same SHA-256.
- **The walk:** all **41 checkpoints (k=0…40)** held `served_spins == revealed == k`; at k=0 the
  commitment is served with **zero** `spin_plan` and **zero** `awards` entries.
- **At `state='complete'`:** the served projection **equals the stored payload**, and the stored
  canonical bytes recompute to the **same** `bundle_sha256` published before spin 1 —
  `f141d27f…7085` both sides.
- `audit_log` rows for `publish_bundle`: **1**, counted rather than asserted.
- Final release: `served_spins=40`, `served_awards=12`, `winless=28` (whole again at completion).

### The two byte-affecting fixes, probed on the REAL corpus

- **NULL eligibility inputs:** `rounds_played` **0**, `kills` **0**, `idle_dq` **0** NULLs across all 28
  snapshot rows. So NULL-is-absent is a **measured no-op on this corpus** — it changes nothing here and
  changes real bytes the day a snapshot row is incomplete, which was the defect.
- ⭐ **Database collation is `en_US.UTF-8` — NOT `C`.** The ordering fix was therefore genuinely
  load-bearing rather than theoretical: the old `order by r.steamid64` really was sorting under a
  non-byte-lex collation. It is a no-op **on this data** only because steamid64s are fixed-length
  ASCII digits, where ICU and byte-lex agree. That is precisely the "agrees today" the fix converts
  into "true by construction". `awards` is unaffected either way — catalog `priority` is unique 1…12.

### ⛔ What is STILL not done

- **Epic-5 retro Action Item #4 — two-session real-browser live-QA — remains 6.9b's**, unchanged: there
  is still no browser path to the bundle until `Verificar la ceremonia` ships. 6.9a's browser
  obligations were the LOCAL-`NEXT_PUBLIC_*` build and the page-size/corpus-name non-vacuity proof,
  which the build gate covers; the interaction bullets moved to 6.9b with the button.
- ⚠ The QA corpus was left in the local DB by the rebuild, then cleared with `supabase db reset` — the
  standing rule before any pgTAP run.

**Deferred**

- [x] [Review][Defer] A canonical payload containing `\u0000` is rejected by `p_payload::jsonb` and misdiagnosed as `payload_shape / 'the payload is not valid JSON'` [supabase/migrations/0029_verification_bundle.sql:750] — deferred, latent: all three canonicalizers emit `\u0000` and the vector pins that output, but Postgres `text` cannot hold NUL, so no producer can reach it today. It is a divergence between the vector's contract and the storage layer, not a live break.

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

✅ **COMPLETE — every task checked, THE BAR run, the mutation pass run twice.** The first block below
is the T0/T2/T2b record from the earlier session; everything from **T0's SQL half onward** is the
second session's and is marked ⓶.

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

---

## ⓶ SECOND SESSION — T0's SQL half, T1, T3, T4, T4b, T5, T8, T9, T10

**⓶ T0 (SQL half) — the reading list that had not been done.** `0028` (:85-137 DECISION A/C + the
`tournament.fair_seed` correction, :203-234, :473-511, :516-535, :643-653, :920-928), `0027` (:78-143,
:169-178, :316-328, :476-567, :583-589, :1025-1032), `0024` (:143-171, :194-211, :300-325, :747-762),
`0023:196-206`, `0003:33-84`, `0002:50,69-79,87-98`, plus the FULL bodies of `reveal_spin` and
`persist_ceremony` (needed verbatim for the two `create or replace`s).

**⓶ T1 + T3 — migration `0029_verification_bundle.sql` (2,502 lines).** B1-B12 are pinned as NAMED
comments at their sites, not in a preamble. Sections: (a) the table + ENABLE/FORCE + two never-OR'd
policies + the seven-column viewer grant + `service_role` without DELETE; (b) **IC912**'s immutability
trigger; (c) AC10.1's `luck_weight_table` freeze; (d) AC10.2's `tournament` revoke + eight-column
re-grant; (e) AC10.3/4's `spin.label`/`bytes_consumed` + two named CHECKs; (f) `publish_bundle`;
(g) `verification_bundle_read`; (h) `reveal_spin`; (i) `persist_ceremony`.

⭐ **THREE FINDINGS THE WRITING ITSELF PRODUCED, each measured rather than reasoned:**

1. ⛔⛔ **`published_at` had to become NULLABLE, and `explain` is what proved it.** Written
   `not null default now()` first, the plan under `set local role anon` came back with **no filter
   node at all** — the planner had proved `published_at is not null` from the NOT NULL constraint and
   DELETED the policy qual. That makes `verification_bundle_viewer_read` **exactly equivalent to
   `using (true)`**, and the AC12 mutant "widen the viewer policy to `using (true)`" not merely hard
   to kill but *semantically identical to the shipped policy*. This is 6.8b's reviewer finding one
   degree worse — there every fixture sat on one side of the predicate; here **no row could ever sit
   on the other**. The column is nullable, a `published_at is null` row is a STAGED bundle, and the
   pgTAP suite puts one on that FALSE side. Plan after the change:
   `Index Scan using verification_bundle_ceremony_key … Filter: (published_at IS NOT NULL)`.
   ⚠ No index was added: measured, the UNIQUE already serves the by-ceremony lookup.
2. ⛔ **`spin_bytes_consumed_non_negative` needed an `is null or` disjunct or the migration could not
   apply at all.** R11 says write every CHECK `(…) is true`; here that rule INVERTS. `bytes_consumed`
   is NULL on every pre-0029 row and `(NULL >= 0) is true` is **FALSE**, so the naive form would pass
   a fresh `supabase db reset` and **fail against the QA corpus** — the 4.3 trap arriving from the one
   direction R11 does not cover. Section G asserts the NULL row is admitted, so the disjunct cannot be
   "tidied" away.
3. ⭐ **IC912 earned a real job.** `service_role` holds UPDATE on the new table and has BYPASSRLS, so
   neither the policy nor the column grant stops the one writer from rewriting a published
   commitment. `assert_bundle_immutable` refuses that, and makes `published_at`/`released_at`
   write-once — un-publishing would retract a hash viewers have already read.

**⓶ T4 — the seams.** `publish_bundle` (fourteen refusals, declared once, read out of `prosrc` by
pgTAP), `verification_bundle_read` (the narrow anon-reachable definer; `0023:196-198`'s "IF YOU EVER
WIDEN THIS, YOU HAVE BROKEN AD-22" quoted at the site), `lib/ceremony/bundle.ts` (the union DERIVED
from an `as const` set — `6-8b:913`'s shape avoided from the start), `app/api/admin/ceremony/bundle/
route.ts` through `handleAdminCommand`, and `lib/ceremony/bundle.test.ts` colocated under `lib/**` so
Vitest actually collects it.

⚠ **`reveal_spin` gained a SEVENTH reason, and three artifacts had to move with it.** `lib/ceremony/
reveal.ts`'s `REVEAL_REASONS`, the reveal route's `STATUS_FOR`, and `0028_reveal_gating_test.sql`'s
prosrc assertion — which predicted this in its own message ("a seventh reason added to the SQL reddens
here"). ⛔ **Adding the guard also broke 34 of `0028`'s 84 assertions**, because every ceremony in that
file reveals without a published bundle. Fixed in the TEST file (never the migration) by inserting
published bundles for the four `spinning` fixtures — and deliberately NOT for `TL`/`TN`, which must
keep refusing at the STATE guard that runs first.

⭐⭐ **A REAL PRE-EXISTING DEFECT, FOUND BY RE-POINTING A TEST AT THE RIGHT FILE.**
`TestPersistReasonsIsExactlyWhatMigration0027Returns` read `0027` **by name**. 0029 replaces
`persist_ceremony`, so the test had to learn to find the LATEST definition — and the moment it did, it
failed: **`reveal_in_progress` has been missing from `worker/ceremony.PersistReasons` since 0028's
code review added it on 2026-08-08.** `Persist` was failing CLOSED on a perfectly ordinary refusal and
reporting `write_failed`, losing the reason — the exact failure that test exists to prevent, and the
exact failure 6.8a hit with `seed_mismatch`. It was invisible because the test measured a superseded
body. Both `reveal.test.ts` and `ceremony_test.go` now DISCOVER the highest-numbered definition.

**⓶ T4b — the builder (`worker/ceremony/bundle.go`, +668 lines).** Derived FROM THE DATABASE, with the
four Stage-1 fields nothing persists (`weights`, `total_weight`, `draws`, `live_count`) supplied by the
run — stated plainly, because a reader would otherwise hunt for a `spin.weights` column. It CROSS-CHECKS
the run's `label`/`bytes_consumed`/`live` against the persisted rows (the third translation layer 6.8a
warned about). DECISION J lives in `applyLadderExitStep`, a named function **only** so the T8 mutant
could reach it without a database.

**⓶ T5 — pgTAP `0029_verification_bundle_test.sql`, `plan(93)`, and the accounting RECONCILES.**
A 22 + B 14 + C 15 + D 6 + E 4 + F 7 + G 8 + H 5 + I 4 + J 6 + K 2 = 93. ⚠ The first draft said
`plan(89)` with A 21 / B 13 and was wrong by two — caught only because pgTAP reports "planned 89 but
ran 91". The numbers were then re-derived by COUNTING assertion calls per section, not by adjusting the
total. **FIVE independent ceremonies**, because `reveal_spin` now refuses until published and
`publish_bundle` refuses once published — one fixture would have left most refusals returning
`ceremony_not_spinning` and fifteen green tests measuring one guard.

⚠ **`reveal_in_progress` is reachable ONLY through a direct service-key UPDATE, and the suite says so.**
The ordinary paths cannot produce a revealed spin with no bundle (`already_published` fires first), so
the guard is defence-in-depth against the same shape IC911 exists for. Driving it any other way would
test a path that cannot exist.

**⓶ T8 — THE MUTATION PASS, TWO ROUNDS, CONTROL-PASSED BOTH TIMES.** Files read/written as BYTES,
restoration verified by SHA-256 (0 failures across 35 mutants), whole-suite runners, `NOT-APPLIED` and
`REFUSED-TO-APPLY` reported as outcomes distinct from `killed`.

| # | mutant | outcome |
|---|---|---|
| M01 | projection: the `spin_plan` `revealed_at` filter removed | killed |
| M02 | projection: the `awards` `revealed_at` filter removed | killed |
| M03 | projection serves the FULL payload before `complete` | killed |
| M04 | viewer policy DROPPED | ⚠ REFUSED (my bad mutant) → **M04' killed** |
| M05 | viewer policy widened to `using (true)` | ⛔ **SURVIVED** → fixed, **M05r killed** |
| M06 | admin policy DROPPED / merged | ⚠ REFUSED (my bad mutant) → **M06' killed** |
| M07 | the column grant widened to table-wide | killed |
| M08 | `payload_canonical` added to the viewer grant | killed |
| M09 | FORCE ROW LEVEL SECURITY dropped | killed |
| M10 | `publish_bundle`: the re-hash check removed (B9) | killed |
| M11 | `publish_bundle`: the ASCII check removed (B7) | killed |
| M12 | `award_revealed_twice` removed | killed |
| M13 | `reveal_spin`: `bundle_not_published` removed | killed |
| M14 | `publish_bundle`: `revoke execute … from public` removed | killed |
| M15 | projection: `revoke execute … from public` removed | ⚠ **SURVIVED — UNKILLABLE, recorded** |
| M16 | the `luck_weight_table` freeze removed | killed |
| M17 | `spin_index_positive` neutered | killed |
| M18 | `tournament` grant restored table-wide | killed |
| M19 | `persist_ceremony` stops writing `label`/`bytes_consumed` | killed |
| M20 | the IC912 committed-column check removed | ⚠ SURVIVED (my bad mutant) → **M20' killed** |
| M21/M22 | ⭐ the DECISION E mutant, both roles | ⚠ REFUSED — **unrepresentable**, re-cut → **M21'/M22' killed** |
| M23 | the `bytes_consumed` NULL disjunct removed | killed |
| M24 | Go JCS key sort REVERSED | killed |
| M25 | a JCS escape omitted | killed |
| M26 | the decimal-string coercion replaced with a JSON number | killed |
| M27 | DECISION J: the `0` sentinel emitted instead of dropped | ⛔ **SURVIVED** → fixed, **M27r killed** |
| M28 | TS JCS key sort REVERSED | killed |

**Final: 27 killed · 1 unkillable-and-recorded · 0 open survivors · 0 restore failures.**

⛔ **The two real survivors, and what each exposed:**
- **M05** — the suite had no row on the viewer policy's FALSE side. The migration's own comment
  *claimed* the suite put one there and it did not. Two assertions added (Section D); M05r now dies.
- **M27** — DECISION J lived inline inside `buildAwards`, five table reads from any unit test, so
  emitting the sentinel unconditionally survived. Extracted to `applyLadderExitStep` + a direct test.

⚠ **M15 is genuinely unkillable and the reason is worth keeping.** `verification_bundle_read` is
anon-reachable BY DESIGN, so `revoke … from public` followed by `grant … to anon, authenticated,
service_role` is behaviourally a no-op for it — PUBLIC and the granted set coincide over the roles
that exist. For `publish_bundle` the same pair IS a real gate (M14 dies). The revoke stays as
documentation and as protection against a future role.

⚠ **`grant select (bundle_sha256) on public.ceremony` — the mutant AC12 names — IS UNREPRESENTABLE.**
It cannot apply: under DECISION A that column lives on `verification_bundle` and **`ceremony` has no
such column**. 6.8b's anticipatory guard was written for a widening this story made impossible. Re-cut
with a column `ceremony` actually has — `spin_plan`, which `0028:474-477` calls the one column whose
publication "would break AD-22 outright" — both role variants now redden Section J. ⭐ `6-8b:920`'s
`authenticated` hole is closed: the guard reads the GRANTEE, so M22' dies too.

**⓶ T9 — ⛔ THE BAR. Every standing anchor reproduced, unchanged.**

| anchor | expected | measured |
|---|---|---|
| rounds · roster | 204 · 28 | **204 · 28** |
| `fair_seed` | `1b3cd678…3279c` | **`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`** |
| snapshot `row_count` · `eligible_count` | 28 · 0 | **28 · 0** |
| awards · spins / results / winners | 12 · 40/40/28 | **12 · 40/40/28** |
| main-spin bytes · pity bytes / draws · total | 22 · 27/27 · 49 | **22 · 27/27 · 49** |
| drawn order | `aw-04,12,08,09,05,10,02,03,07,06,01,11` | **4,12,8,9,5,10,2,3,7,6,1,11** |

⭐ **T2b's fixes are therefore PROVEN no-ops on the real corpus, not assumed** — every byte count, the
drawn order and the reveal order reproduce unchanged after `STEAMID64_RE` and integer `rejections`
landed in all three runtimes.

- **The bundle**: 75,013 canonical bytes, `bundle_sha256`
  `4c0614fa30d51b1dcbdd7da8fb98bd79ba59efe4dc9c1a8cbc105a7acd2eb325`. **Two builds compared as bytes
  were identical** (the 6.8a determinism form). `publish_bundle` accepted it and wrote **exactly one**
  `publish_bundle` `audit_log` row (counted, not asserted).
- ⭐⭐ **THE WALK: 41 checkpoints, k = 0…40, and the served set equalled the revealed prefix EXACTLY at
  every one** — strictly monotone, never one row more. At k=0: 0 spin_plan entries, 0 awards, `pity`
  **absent** (not blanked), and the commitment already served.
- ⭐⭐ **At `complete` the served document re-canonicalized to
  `4c0614fa…b325` — the SAME hash published before spin 1.** That is the whole story's claim, executed.
- **AD-22 two-sided grep, at three k's, over REAL pages** (Next built with the **LOCAL**
  `NEXT_PUBLIC_*`, never the remote): `/` 66,545 B · `/leaderboards` 67,093 B · `/bracket` 34,334 B ·
  `/ceremonia` 11,555 B (still the 5.7 `<Placeholder>` — correct). **No page rendered `No pudimos
  cargar el evento`.** Non-vacuity: **28/28 distinct corpus player names rendered.**

  | k | revealed names APPEAR | unrevealed names APPEAR |
  |---|---|---|
  | 0 | 0/12 (none revealed) | **0/12** |
  | 6 | **6/6** | **0/6** |
  | 40 | **12/12** | — |

  And none of `payload_canonical` · `bundle_sha256` · `snapshot_id` · `stat_snapshot` ·
  `verification_bundle` appears in any viewer page.
- ⭐⭐ **AC10.2 proven DIRECTLY at the Data API as `anon`, which is stronger than hoping a page
  renders**: `select=id,state,grace_period_seconds` → **200 `{"grace_period_seconds":600}`** (the
  0015-after-0002 column whose omission would have silently killed the 4.5 grace timer);
  `select=fair_seed` → **401/42501**; `select=*` → **401/42501** (the gate working, not a bug).

⛔⛔ **THE BAR FOUND A GENUINE SPEC CONTRADICTION — DECISION N.** AC3 lists `name` among the awards
entry's fields; §9.5 makes the bundle ASCII-restricted; the shipped catalog's names are Spanish
("Máquina de Frags", "Puntería Quirúrgica", "Rey del Daño"). **All three cannot hold**, and no amount
of reading finds it — the first full run died on `non_ascii — U+00E1 violates the bundle's ASCII
restriction`, at the first award. **Resolved by dropping `name` from the bundle**: a verifier never
reads it (winners come from the snapshot, the seed and the RESOLUTION fields, every one a snake_case
ASCII identifier), AD-24 homes viewer copy to the i18n module and the catalog rather than to a hashed
document, and keeping the restriction absolute leaves it biting exactly the hazard
`deferred-work.md:265-266` describes. ⚠ **The cost:** a reader of the raw bundle sees `"award_id":"4"`
and must join the catalog — the same indirection `pool` and `live` already carry. ⛔ **This is a
deviation from AC3 as written and needs Cuatro's sign-off at review.**

⚠ **`bundle_sha256` DIFFERS ON EVERY REBUILD, AND THAT IS CORRECT.** `achievement_ts` is wall-clock
approval time, so each corpus rebuild produces a different snapshot and therefore a different document
— exactly as `content_sha256` has always differed. The gate-4 vector pins ONE rebuild's document and
hash as committed data, which is what a golden vector is for.

**⓶ AC2 IS NOW MET — the `end_to_end` row landed.** `roulette/vectors/canonical-bundle.json` carries
the real ceremony's document; its 75 KB input lives in `canonical-bundle-input.json`, the only vector
input in its own file (pasting it into the generator would bury it). Both suites' deliberately-owed
assertions reddened exactly as designed and were **updated, never deleted**: `canonical.test.ts`'s
`toBe(0)` → `toBe(1)` plus a shape pin, and Go's `TestCanonEndToEndBundleRowIsStillOwed` renamed to
`TestCanonEndToEndBundleRow` with the same treatment.

**⓶ T10 — GATES, EVERY BASELINE MEASURED.**

| gate | baseline (MEASURED at HEAD `fe50626`) | after |
|---|---|---|
| `npm run lint` | — | **0 problems** |
| `npm test` | **1442 / 45 files** | **1476 / 46 files** (+34, one new file) |
| `npm run build` | — | **clean**; every viewer route still `ƒ`; `/ceremonia` still the 5.7 Placeholder |
| `go build ./… && go vet ./… && go test ./… -count=1` | — | **all packages ok**, with the harness present AND after its removal |
| `gofmt -l ./worker` | — | **empty** |
| `generate_vectors.py --check` | OK ×8 | **OK ×8** |
| pgTAP | **1434 / 29 files** | **1527 / 30 files** (+93 = `0029`'s plan exactly) |

⛔ **The `npm test` baseline was measured by `git stash push -u` at HEAD and re-running** — not derived
by arithmetic and not read from `sprint-status.yaml` (6.7 quoted `1318/42` when the real figure was
`1322/42`). The pgTAP baseline reconciles the same way: 1434 + 93 = 1527.

⚠⚠ **THAT BASELINE MEASUREMENT CAUSED A CRLF INCIDENT, AND IT IS WORTH RECORDING.** This repo has
`core.autocrlf = true` and **no `.gitattributes`**, so `git stash pop` re-checked-out every tracked
file with CRLF — 19 touched files, ~19,000 line endings, and `--check` immediately reported
`DRIFT canonical-bundle.json`. All 19 were normalised back to LF and re-verified (**0 CRLF**), after
which `--check` is OK ×8 again and `git diff --stat` shows only real changes rather than whole-file
rewrites. ⭐ This is 6-4a's "lost 12 of 18 mutants to a CRLF round-trip" arriving through a different
door: the mutation harness read/wrote BYTES and was fine — it was `git stash` that did the damage.

**Proofs:** `git status` shows migrations `0001`-`0028` and `worker/ingest|store|db|config/**`
**byte-untouched**; `0029` + its pgTAP file are the only new `supabase/**` entries. The throwaway
harness (`worker/cmd/qa69/`, `lib/roulette/bar-qa69.test.ts`, `_qa69/`) is **deleted**, with the Go
gates proven clean both while present and after removal. `worker/cmd/qa54` is untouched.

**⚠ DEFERRALS, each with its owner named — none of these reads as satisfied:**
- ⛔ **6.9a ships a published, hashed, reveal-gated bundle that NOTHING IN A BROWSER READS.** That was
  the split's known, recorded cost. **Epic AC1 stays PARTIAL until 6.9b.**
- **Epic-5 retro AI #4's two-session real-browser run lands with 6.9b**, which is the half that ships
  client state. 6.9a's browser work was a RENDERER-under-test (page bytes, corpus-name counts, the
  AD-22 greps), not an interaction target.
- **AC9's other three debts** (`crypto.subtle` feature detection, the verifier, the W10 `Promise.all`
  mutant) → 6.9b. The W10 mutant is recorded as **DEFERRED-6.9b**, not as a pass.
- **`worker/ceremony.Run` still has zero callers**, and `BuildCanonicalBundle` + `publish_bundle` join
  it — the QA harness was the only caller and it is deleted (DECISION I, Epic 7's).
- **`released_at` is a SHELL** (DECISION K): the release gate is `ceremony.state = 'complete'`, a
  predicate `assert_ceremony_transition` guards, never a stored flag. Its writer is 6.9b/6.10.
- The admin route's numeric `STATUS_FOR` values stay untested — `vitest.config.ts:17` collects only
  `lib/**/*.test.ts`. The **sixth** such map (`deferred-work.md:279`, Epic 7's). Said, not pretended.

---

**⛔ SUPERSEDED — the first session's stop note, kept for the record.** Task 1's DB-side semantics (B1-B4, B9, B11, B12),
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


## ⓷ THE THREE REPLACED BODIES, DIFFED — the AC4 / AC10.1 / AC10.3 paste

> ⛔ **Produced by the 6.9a code review (2026-08-09), because it was owed and missing.** Migration
> `0029` asserts in three separate comments that "the diff is pasted in the story's Completion
> Notes"; no diff hunk existed anywhere in this file. That paste is the ONLY mechanism AC4 and
> AC10.1/10.3 give a reviewer for confirming that ~1,400 lines of copied-forward SQL changed in
> exactly the places claimed, so its absence made "contains only that change" unverifiable.
>
> Each diff below is **machine-generated**, not transcribed: the latest definition of the function
> is sliced out of each migration (from `create [or replace] function public.<fn>(` to the matching
> `comment on function`) and run through a unified diff with 2 lines of context. ⚠ The slices are
> taken with `LastIndex`, matching the fix this review made to the three "latest definition wins"
> helpers — see the Review Findings above.
>
> ⚠ **READ THE HONEST CAVEAT BEFORE THE HUNKS.** The ACs say the diff "contains only that change",
> and taken literally that is **not true of any of the three** — every body also carries
> **comment-only re-pointing**, because the text moved file: `Section (h)` becomes `0028's section
> (h)`, `DECISION H` becomes `DECISION H of 0028`, `the ceremony row this same migration publishes`
> becomes `the ceremony row 0028 publishes`, and so on. Those edits change no executable line. The
> claim that holds, and the one worth checking, is: **every executable difference is the intended
> one.** Read the hunks with that as the test.


### `reveal_spin` — `0028` → `0029` (AC4)

**Intended executable change: ONE guard.** `v_published` is declared, and a `bundle_not_published` refusal is added after `ceremony_not_spinning` and BEFORE any write, because a commitment published after the first reveal is not a commitment. Everything else in this diff is comment re-pointing plus the AC10.4 note that `spin_index_positive` turned the prefix theorem's positivity assumption into a real constraint, and the re-issued `comment on function` (⚠ `create or replace` PRESERVES `pg_description`, so the old six-refusal text would otherwise have survived on a seven-refusal function).

```diff
--- 0028_reveal_gating.sql::reveal_spin
+++ 0029_verification_bundle.sql::reveal_spin
@@ -1,3 +1,3 @@
-create function public.reveal_spin(
+create or replace function public.reveal_spin(
   p_ceremony_id bigint,
   p_spin_index  int,
@@ -26,4 +26,5 @@
   v_after_state  text;
   v_detail       jsonb;
+  v_published    timestamptz;   -- 6.9a: the commitment's publication stamp, or NULL
 begin
   -- ══ 1. AN UNLOCKED PEEK — existence and scope only. It must NOT lock: the statements below take
@@ -60,4 +61,19 @@
     return jsonb_build_object('ok', false, 'reason', 'ceremony_not_spinning',
                               'ceremony_state', v_state, 'ceremony_id', p_ceremony_id);
+  end if;
+
+  -- ⭐⭐ STORY 6.9a, AC4 — THE ONLY ADDITION TO THIS BODY. THE COMMITMENT COMES FIRST OR THE REVEAL
+  -- DOES NOT HAPPEN. See the section header for why `publish_bundle`'s `reveal_in_progress` is not
+  -- sufficient on its own: it closes publish-after-reveal, and this closes reveal-before-publish.
+  -- ⚠ IT READS `published_at`, NOT MERE ROW EXISTENCE, because `verification_bundle_viewer_read`
+  -- gates on `published_at is not null` — a staged row nobody can read is not a published commitment.
+  select b.published_at into v_published
+    from public.verification_bundle b where b.ceremony_id = p_ceremony_id;
+  if v_published is null then
+    return jsonb_build_object('ok', false, 'reason', 'bundle_not_published',
+                              'ceremony_id', p_ceremony_id,
+                              'hint', 'publish_bundle must commit the ceremony''s canonical bytes '
+                                      'BEFORE the first reveal — a commitment chosen after an outcome '
+                                      'is known commits to nothing (AD-22)');
   end if;
 
@@ -83,22 +99,15 @@
   -- rewrote `revealed_at` NULL, leaving the revealed set {} over a dense 1..N — a PERFECTLY VALID
   -- prefix, so neither branch below fired while published `award_reveal` feed rows still named
-  -- awards from the deleted run. Section (h) closes that with a `reveal_in_progress` refusal. ⛔ The
-  -- lesson generalises: this pair of tests detects a BROKEN prefix, never a prefix that was legally
-  -- reset out from under an audience. Do not treat it as a completeness check.
+  -- awards from the deleted run. 0028's section (h) closes that with a `reveal_in_progress` refusal.
+  -- ⛔ The lesson generalises: this pair of tests detects a BROKEN prefix, never a prefix that was
+  -- legally reset out from under an audience. Do not treat it as a completeness check.
   -- ⚠ WHY `max = count` IS A SOUND PREFIX TEST HERE AND NOT IN GENERAL: `spin_ceremony_index_key
   -- unique (ceremony_id, spin_index)` (`0025:123`) makes the indexes DISTINCT, so {1,1,3} — the
   -- shape that defeats a max/count pair in `0027:724-725` — is unrepresentable. Over a distinct
   -- subset of the POSITIVE integers, max = count holds if and only if the subset is {1..count}.
-  -- ⛔ THE POSITIVITY IS AN ASSUMPTION, NOT A CONSTRAINT, AND SAYING SO IS A CODE-REVIEW FIX
-  -- (2026-08-08). This block used to claim the theorem for "a distinct subset of 1..N" without
-  -- naming what bounds it below. The unique index enforces DISTINCTNESS ONLY; nothing in `0025` or
-  -- `0026` carries a `spin_index > 0` CHECK, and `0028` adds no CHECK at all (R11). So indexes
-  -- {-5, 0, 3} give count = 3 and max = 3 and the DENSITY half does not fire. What still catches
-  -- that shape in practice is the PREFIX half plus `out_of_order`: with nothing revealed, the guard
-  -- below computes an expected index of 1, no spin 1 exists, and the call is refused rather than
-  -- writing. So the gate holds — but it holds for a different reason than the sentence above used
-  -- to give, and a load-bearing proof that is wrong is worse than one that is narrow.
-  -- ⭐ The durable fix is a `check (spin_index > 0) is true` on `spin`, which belongs with a
-  -- migration that owns that table. Recorded, not smuggled in here.
+  -- ⭐ AND THE POSITIVITY IS NOW A CONSTRAINT RATHER THAN AN ASSUMPTION (Story 6.9a, AC10.4):
+  -- `spin_index_positive` is added in section (e) of THIS migration, which is what `0028:652-653`
+  -- recorded as owed — "the durable fix is a `check (spin_index > 0) is true` on `spin`, which
+  -- belongs with a migration that owns that table". The theorem above is now sound as stated.
   if v_max_index <> v_total or v_max_revealed <> v_revealed then
     raise exception
@@ -165,5 +174,5 @@
 
   -- ══ 3. THE STAMP. One spin. This is the entire observable effect of the command: four policies
-  --    above resolve their visibility from this column, so this single UPDATE is what flips a spin,
+  --    in 0028 resolve their visibility from this column, so this single UPDATE is what flips a spin,
   --    its results, its winners and its award into view.
   update public.spin
@@ -190,5 +199,5 @@
   -- a job, or writing it before the stamp re-opens the exact spoiler AD-22 exists to prevent.
   --
-  -- ⚠ DECISION H — DATA, NEVER COPY. `lib/feed/model.ts:186-188` renders `detail.title` and
+  -- ⚠ DECISION H of 0028 — DATA, NEVER COPY. `lib/feed/model.ts:186-188` renders `detail.title` and
   -- `detail.subtitle` VERBATIM, so a Spanish sentence written here would be viewer copy living
   -- outside the one i18n module AD-24 mandates. What is written is therefore only what the database
@@ -242,9 +251,14 @@
   values (v_tournament, 'award_reveal', v_now, v_detail);
 
-  -- ══ 5. AC6 / DECISION E — THE LAST REVEAL COMPLETES THE CEREMONY, ATOMICALLY.
+  -- ══ 5. AC6 / DECISION E of 0028 — THE LAST REVEAL COMPLETES THE CEREMONY, ATOMICALLY.
   -- ⭐ `0027:152`: "The transition trigger below ALREADY PERMITS spinning -> complete; 6.8b writes
   -- it." This is that write, and it goes through `ceremony_transition_valid` as ONE legal forward
   -- step — the trigger still refuses complete -> spinning, spinning -> locked and every skip with
-  -- IC910. `completed_at` is the shell `0024:204` created and nobody has written until now.
+  -- IC910. `completed_at` is the shell `0024:204` created and nobody wrote until 6.8b.
+  -- ⭐ AND IT IS THE MOMENT THE FULL BUNDLE IS RELEASED: `verification_bundle_read` gates the full
+  -- document on exactly this state (DECISION B, row three), so completing the ceremony and releasing
+  -- the document a viewer can hash against the commitment are ONE act, not two. ⛔ Do not add a
+  -- second write here to stamp `released_at` — that column is DECISION K's shell and this body must
+  -- differ from 0028's by exactly one guard.
   -- ⚠ The comparison is against `max(spin_index)`, not against `count(*)`: they are equal here only
   -- because 2b just PROVED the spin order dense, and saying so is the difference between a guard
@@ -305,6 +319,6 @@
   --    rule that event names are "server-authored, named by semantic change" and NEVER invented.
   --    ⚠ `<id>` IS THE CEREMONY ID, not the tournament id — `tournament:<id>` already carries the
-  --    tournament axis, and a viewer can now learn the ceremony id from the `ceremony` row this
-  --    same migration publishes, so the channel is discoverable from a published read alone (AD-11).
+  --    tournament axis, and a viewer can now learn the ceremony id from the `ceremony` row 0028
+  --    publishes, so the channel is discoverable from a published read alone (AD-11).
   --    `private => false` — `ceremony:<id>` is "public once started" (`SPINE:133`), and this emit
   --    only ever fires while the ceremony is `spinning`.
@@ -318,5 +332,5 @@
   --    ⚠ DO NOT BUILD A SECOND EMITTER, and DO NOT add `spin.reveal` to `lib/realtime/status.ts`'s
   --    NUDGE_EVENTS — that list is the `tournament:<id>` vocabulary 5.8's surfaces consume, and the
-  --    consumer for this one is 6.10's, with the UI that needs it (DECISION F).
+  --    consumer for this one is 6.10's, with the UI that needs it (0028's DECISION F).
   perform realtime.send(
     jsonb_build_object(
@@ -352,2 +366,7 @@
 $$;
 
+-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED, AND IT HAS TO BE. `create or replace` PRESERVES the existing
+-- `pg_description` entry, so `0028:905-918`'s text would have survived unchanged and would now list
+-- six refusals for a function that has seven — precisely the stale-comment class this epic's
+-- migrations are written against. This is 0028's comment with the `bundle_not_published` sentence
+-- added and nothing else altered.
```

### `assert_ceremony_transition` — `0027` → `0029` (AC10.1)

**Intended executable change: ONE frozen-column block.** Section 2b refuses a `luck_weight_table` edit with `IC910` once the ceremony has left `not_started`. ⚠ Nothing is removed — `+41 / -0` — which is the property that matters here: `0027`'s DECISION 4 deliberately rejected a column allowlist, and `algorithm_version` / `spin_plan` must stay writable for `publish_bundle`'s and `persist_ceremony`'s own writes. ⭐ The predicate reads BOTH `old.state` and `new.state` — the 6.9a code review's fix, without which the edit could be bundled into the `not_started -> locked` statement and slip through.

```diff
--- 0027_ceremony_run.sql::assert_ceremony_transition
+++ 0029_verification_bundle.sql::assert_ceremony_transition
@@ -60,4 +60,40 @@
   end if;
 
+  -- ── 2b. ⭐ STORY 6.9a, AC10.1 — THE THIRD FROZEN COLUMN, AND THE ONLY CHANGE IN THIS BODY.
+  -- `luck_weight_table` is Stage 1's published weight source: every byte the ceremony draws is a pure
+  -- function of it (AD-14). It is NOT write-once like the two above — it is STATE-CONDITIONAL, because
+  -- tuning a `not_started` ceremony is legitimate and is what SPEC:97's "tuning stays reproducible"
+  -- describes. From `locked` onward the inputs have stopped moving (AD-15), so an edit here would
+  -- change what a re-derivation produces while `snapshot_id` and `seed_demo_sha256` — the two things a
+  -- verifier checks — both still matched. `deferred-work.md:361`, closed.
+  -- ⚠ `is distinct from` is NULL-safe in both directions, which matters: a pre-0025 row could hold
+  -- NULL, and `<>` would silently pass NULL -> value while this refuses it.
+  --
+  -- ⛔⛔ THE PREDICATE READS **BOTH** STATES — CORRECTED BY THE 6.9a CODE REVIEW. It used to key on
+  -- `old.state` alone, which left one statement's worth of daylight:
+  --
+  --     update ceremony set state = 'locked', luck_weight_table = array[9,8,7]
+  --      where id = C and state = 'not_started';
+  --
+  -- One legal forward step for the state machine, and `old.state = 'not_started'` for the freeze —
+  -- so the weights changed AT the lock rather than before it, and the ceremony entered `locked`
+  -- with inputs that had just moved. AD-15's "the inputs have stopped moving from `locked` onward"
+  -- was one statement weaker than it claimed. Section E's `lives_ok` case could not catch it: it
+  -- edits a ceremony that STAYS `not_started`, so the combined update was never exercised.
+  -- ⚠ Both sides are required. Keying on `new.state` alone would forbid the legitimate
+  -- `not_started -> not_started` tuning edit that SPEC:97 explicitly allows.
+  if (old.state is distinct from 'not_started' or new.state is distinct from 'not_started')
+     and new.luck_weight_table is distinct from old.luck_weight_table then
+    raise exception
+      using errcode = 'IC910',
+            message = 'ceremony ' || old.id || ' luck_weight_table is FROZEN once the ceremony leaves '
+                      'not_started (' || coalesce(old.state, '<null>') || ' -> ' ||
+                      coalesce(new.state, '<null>') || ') — refusing to change it',
+            hint    = 'the luck meter is a Stage-1 INPUT every drawn byte is a pure function of; '
+                      'editing it after the lock changes what a re-derivation produces while '
+                      'snapshot_id and seed_demo_sha256 — the two things a verifier checks — both '
+                      'still match (deferred-work.md:361)';
+  end if;
+
   -- ── 3. The AD-18 scope key is immutable. ──
   if new.tournament_id is distinct from old.tournament_id then
@@ -73,2 +109,7 @@
 $$;
 
+-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED, AND IT HAS TO BE. `create or replace` PRESERVES the existing
+-- `pg_description` entry, so `0027:550-556`'s text would have survived unchanged and would now
+-- describe a function guarding one fewer column than it actually guards — precisely the stale-comment
+-- class this epic's migrations are written against. This is 0027's comment with the
+-- `luck_weight_table` sentence added and nothing else altered.
```

### `persist_ceremony` — `0027` → `0029` (AC10.3)

**Intended executable changes: TWO, and the second is this review's.** (1) AC10.3 / DECISION F — the spin INSERT now writes `label` and `bytes_consumed`, the two provenance columns `0027:1025-1032` homed here by name. (2) ⛔ **Added by the 6.9a code review** — a `bundle_published` refusal before the delete, because `p_replace => true` after a publish deleted and rewrote every spin the immutable `bundle_sha256` describes, and `reveal_in_progress` structurally cannot fire on that path (publishing requires zero reveals). ⚠ This diff is the largest of the three precisely because of that guard and its rationale comment; the executable addition is one `exists` test and one typed return.

```diff
--- 0027_ceremony_run.sql::persist_ceremony
+++ 0029_verification_bundle.sql::persist_ceremony
@@ -1,3 +1,3 @@
-create function public.persist_ceremony(
+create or replace function public.persist_ceremony(
   p_ceremony_id bigint,
   p_run         jsonb,
@@ -19,4 +19,5 @@
   v_plan          jsonb;
   v_n             int;
+  v_revealed      int;   -- 6.8b code review: spins of this ceremony already REVEALED
   v_bad           text;
   v_deleted       int := 0;
@@ -81,4 +82,86 @@
   end if;
 
+  -- ⛔⛔ reveal_in_progress — ADDED BY STORY 6.8b'S CODE REVIEW (2026-08-08).
+  --
+  -- WHAT IT PREVENTS. `p_replace => true` deletes every spin of the ceremony and rewrites them with
+  -- `revealed_at` NULL (`0027:1011-1016`, `:1049-1054`), and the state guard above admits `spinning`
+  -- — which is exactly the state a ceremony is in WHILE 6.8b's `reveal_spin` is walking it. So a
+  -- re-persist mid-ceremony was legal, and it did three things at once:
+  --   (1) the viewer's visible set silently RETRACTED, because `revealed_at` went back to NULL on
+  --       rows anon could already read through 0028's four reveal-gated policies;
+  --   (2) the `award_reveal` `timeline_feed` rows written by the reveals SURVIVED — `timeline_feed`
+  --       is append-only and `timeline_view` is `using (true)` (`0017:136`) — so anon kept reading
+  --       `detail.title`, i.e. the AWARD NAMES, for a run that no longer existed. If the new run
+  --       then placed any of those awards in a LATER spin, their identity had been published BEFORE
+  --       their reveal: the precise spoiler AD-22 and R10 exist to prevent;
+  --   (3) re-revealing wrote a SECOND `award_reveal` row for the same `spin_index`, which the feed
+  --       renders as a duplicate card.
+  -- ⚠ AND IC911 COULD NOT SEE ANY OF IT. After the replace the revealed set is {} over a dense
+  -- 1..N, which satisfies the prefix invariant perfectly — so `reveal_spin` carried on as if nothing
+  -- had happened.
+  --
+  -- WHY A TYPED REFUSAL RATHER THAN A CASCADE-BLOCKING TRIGGER: the house convention is that a
+  -- business rule is RETURNED as {ok:false, reason} and only genuine corruption RAISES, and the
+  -- operator needs to be told WHICH fact is true (the ceremony is mid-reveal) rather than getting a
+  -- 23503 from a delete they did not know they were making. Re-persisting after the ceremony is
+  -- COMPLETE is refused by the `ceremony_not_locked` guard above, so this covers the one live gap.
+  -- ⚠ `count(*)` cannot return NULL, so the `coalesce` is belt to that suspenders — kept because
+  -- this epic has paid for a NULL-valued guard condition being read as FALSE four separate times.
+  select count(*) into v_revealed
+    from public.spin s
+   where s.ceremony_id = p_ceremony_id and s.revealed_at is not null;
+
+  if coalesce(v_revealed, 0) > 0 then
+    return jsonb_build_object(
+      'ok', false, 'reason', 'reveal_in_progress',
+      'revealed_spins', v_revealed,
+      'existing_spins', v_n,
+      'hint', 'this ceremony is mid-reveal; re-persisting would un-reveal published spins while their award_reveal feed rows remain visible'
+    );
+  end if;
+
+  -- ⛔⛔ bundle_published — ADDED BY STORY 6.9a'S CODE REVIEW, AND IT CLOSES A HOLE THIS FILE
+  -- PREVIOUSLY ARGUED WAS UNREACHABLE. The note that stood here said the case "is unreachable
+  -- through this path, because publishing requires zero reveals and revealing requires a published
+  -- bundle, so any ceremony with a bundle and no reveals can still legally be re-persisted BEFORE
+  -- the first reveal — which is correct". ⛔ IT IS NOT CORRECT, and the reasoning inverts what
+  -- `already_published` does. Walk it:
+  --
+  --   1. publish_bundle(C)          -> ok. Requires state='spinning' and ZERO reveals; both hold.
+  --                                   The verification_bundle row is written and IC912 makes it
+  --                                   immutable for the rest of time.
+  --   2. persist_ceremony(C, …, p_replace => true)
+  --                                 -> ok. `ceremony_not_locked` admits 'spinning';
+  --                                    `already_persisted` is bypassed by p_replace; and
+  --                                    `reveal_in_progress` CANNOT fire, because publishing
+  --                                    required zero reveals in the first place. Every spin row is
+  --                                    deleted and rewritten from a DIFFERENT run.
+  --   3. reveal_spin(C, 1, …)       -> ok. It only checks `published_at is not null`, which it is.
+  --
+  -- The published `bundle_sha256` now binds a document describing spins that no longer exist.
+  -- `verification_bundle_read` filters the STALE spin_plan by matching spin_index against the NEW
+  -- spins, so it serves old entries labelled as new ones, and at state='complete' it serves the
+  -- whole stale document as "the full bundle" that hashes to the commitment. A verifier
+  -- re-deriving from it gets a ceremony that never ran — and nothing anywhere looks wrong.
+  --
+  -- ⚠ `already_published` does NOT save this. It refuses a SECOND publish; it does nothing about
+  -- the FIRST bundle binding replacement rows. Because IC912 makes the row immutable and
+  -- `already_published` blocks re-issuing a correct one, the ceremony is UNRECOVERABLE — the only
+  -- exit is a new ceremony row. That asymmetry is exactly why this must be refused BEFORE the
+  -- delete rather than detected afterwards.
+  --
+  -- ⚠ Scoped to a PUBLISHED bundle (`published_at is not null`), not to the row's existence: an
+  -- unpublished draft row commits to nothing and must not block a legitimate re-persist.
+  if exists (
+    select 1 from public.verification_bundle vb
+     where vb.ceremony_id = p_ceremony_id
+       and vb.published_at is not null
+  ) then
+    return jsonb_build_object(
+      'ok', false, 'reason', 'bundle_published',
+      'hint', 'this ceremony''s commitment is already published and immutable (IC912); re-persisting would leave bundle_sha256 binding spins that no longer exist. Run a new ceremony instead.'
+    );
+  end if;
+
   if v_snapshot is null then
     return jsonb_build_object('ok', false, 'reason', 'snapshot_missing');
@@ -136,4 +219,6 @@
   -- (leading digit 1-9, so `0` and `-1` are refused here rather than silently failing the set
   -- equality) and bounds the width to 9 digits, which cannot overflow int4.
+  -- ⭐ STORY 6.9a: `spin_index_positive` (section (e)) now enforces the same lower bound as a
+  -- CONSTRAINT, so this guard and the table agree by mechanism rather than by coincidence.
   select string_agg(distinct e ->> 'spin_index', ',') into v_bad
     from jsonb_array_elements(v_spins) e
@@ -182,4 +267,19 @@
   -- ⚠ ONE REASON WITH A `field` CONTEXT KEY rather than four near-identical reasons: the admin needs
   -- to know WHICH field, and `PersistReasons` stays a set a reader can hold in their head.
+  --
+  -- ⭐⭐ STORY 6.9a — `label` AND `bytes_consumed` JOIN THIS GUARD, AND THAT IS THE SECOND OF THIS
+  -- BODY'S TWO CHANGES. They are written to columns below, so their types are proven HERE for the
+  -- same reason every other cast in this function is: a cast is not a guard, and
+  -- `(v_spin ->> 'bytes_consumed')::bigint` on `"lots"` raises 22P02 from the middle of the write
+  -- phase, which the Go caller reports as an untyped `write_failed`.
+  -- ⚠ THEY ARE **REQUIRED**, NOT OPTIONAL, AND THAT IS A DELIBERATE TIGHTENING. `worker/ceremony`'s
+  -- `PayloadSpin` has carried both since 0027 with no `omitempty` (`ceremony.go:316-323`), so every
+  -- payload the shipped producer can emit already has them; a payload without them was written by
+  -- something that is not the producer, and DECISION F is precisely the decision that these two
+  -- fields matter. ⛔ Do not soften this to `e ? 'label' and …` — an absent label would then persist
+  -- as NULL and the bundle could not name the stream the spin was drawn from.
+  -- ⚠ NO REASON IS ADDED TO THE CLOSED SET. `invalid_payload_shape` already exists and already
+  -- carries a `fields` context key, so `worker/ceremony.PersistReasons` and every cross-check that
+  -- reads it stay exactly as they are.
   select string_agg(distinct x.field, ',') into v_bad
     from (
@@ -195,4 +295,13 @@
         from jsonb_array_elements(v_plan) pe
        where pe ? 'pool' and jsonb_typeof(pe -> 'pool') is distinct from 'array'
+      union all
+      select 'label'
+        from jsonb_array_elements(v_spins) e
+       where coalesce(jsonb_typeof(e -> 'label'), 'absent') is distinct from 'string'
+      union all
+      select 'bytes_consumed'
+        from jsonb_array_elements(v_spins) e
+       where coalesce(jsonb_typeof(e -> 'bytes_consumed'), 'absent') is distinct from 'number'
+          or (e ->> 'bytes_consumed') !~ '^[0-9]{1,18}$'
     ) x;
   if v_bad is not null then
@@ -343,4 +452,7 @@
   -- value AFTER that mapping: anything outside 1..5 that is not the 0 sentinel is a producer bug and
   -- would otherwise arrive as a bare 23514 on `award_result_ladder_exit_step_valid`.
+  -- ⭐ STORY 6.9a, DECISION J: this `nullif` is the SEAM at which the two spellings of "no ladder"
+  -- become one. The COLUMN holds NULL, the bundle spells it ABSENT, and the Go builder drops the key
+  -- on 0 — so the canonical bytes can never carry a `0` that the database does not hold.
   if exists (
     select 1 from jsonb_array_elements(v_spins) sp, jsonb_array_elements(sp -> 'results') res
@@ -356,5 +468,5 @@
   -- ⛔ THE DECIDING VALUES WERE THE LAST PAYLOAD FIELDS WHOSE CASTS RAN PAST THE WRITE BOUNDARY.
   -- `(res ->> 'deciding_num')::bigint` sat inside the INSERT, so a half pair raised a bare 23514 on
-  -- `award_result_deciding_pair_complete` — the constraint THIS migration adds — a non-numeric
+  -- `award_result_deciding_pair_complete` — the constraint 0027 adds — a non-numeric
   -- raised 22P02 and an over-bigint value 22003, every one of them mid-write. Every other
   -- constraint 0027 adds carries a matching pre-write typed refusal; now these do too.
@@ -424,16 +536,22 @@
   -- to join back on. The volume is one ceremony — twelve main spins plus one pity spin per winless
   -- player — so clarity wins over cleverness here.
-  -- ⚠ THE PAYLOAD CARRIES `label` AND `bytes_consumed` PER SPIN AND THIS FUNCTION DELIBERATELY DOES
-  -- NOT PERSIST THEM (Story 6.8a code review, DECISION 6). They are PROVENANCE: `label` is the
-  -- domain-separation key 6.9's verifier re-opens each stream by, and `bytes_consumed` is measured
-  -- from the stream rather than re-derived. Both belong in 6.9's `verification_bundle`, which owns
-  -- the shape a verifier reads — adding two columns to `spin` now would pre-empt that decision for
-  -- the sake of data nothing yet reads. They are carried on the wire so 6.9 does not have to
-  -- re-plumb the producer, and they are validated by nothing here precisely because nothing here
-  -- depends on them. ⛔ Do NOT read them into a write without moving that decision to 6.9 first.
+  --
+  -- ⭐⭐ STORY 6.9a, AC10.3 / DECISION F — `label` AND `bytes_consumed` ARE NOW PERSISTED, AND THIS IS
+  -- THE FIRST OF THIS BODY'S TWO CHANGES. `0027:1025-1032` carried them on the wire and refused to
+  -- write them, homing the decision to "6.9's verification_bundle, which owns the shape a verifier
+  -- reads", and ⛔ "Do NOT read them into a write without moving that decision to 6.9 first." THIS IS
+  -- THAT MOVE. Why they cannot live only in the bundle: the bundle is DERIVED FROM THE DATABASE, so a
+  -- field the database does not hold is one no later re-derivation can produce once the producer's
+  -- process has exited. `label` is the domain-separation key a verifier re-opens each stream by, and
+  -- `bytes_consumed` is MEASURED FROM THE STREAM — `README:531-535` calls it "the only externally
+  -- visible proof that both runtimes walked the same stream".
+  -- ⚠ THE VALUES ARE THE PAYLOAD'S, VERBATIM, AND THAT IS THE POINT: `bytes_consumed` must be
+  -- REPRODUCED, never re-derived. A writer that recomputed it would be asserting what it was supposed
+  -- to be checking.
   for v_spin in select e from jsonb_array_elements(v_spins) e loop
     v_kind := v_spin ->> 'kind';
 
-    insert into public.spin (ceremony_id, spin_index, kind, live_award_ids, revealed_at)
+    insert into public.spin (ceremony_id, spin_index, kind, live_award_ids, revealed_at,
+                             label, bytes_consumed)
     values (
       p_ceremony_id,
@@ -453,5 +571,8 @@
       -- with a timestamp here would be visible the instant 6.8b adds the grant — before anyone
       -- pressed anything.
-      null
+      null,
+      -- ⭐ The two provenance columns, cast safely because 2b' proved their types.
+      v_spin ->> 'label',
+      (v_spin ->> 'bytes_consumed')::bigint
     )
     returning id into v_spin_id;
@@ -506,6 +627,5 @@
 
   -- ══ 5b. ⚠⚠ THE DEFERRED ASSERTION IS FORCED TO RUN *HERE* — BEFORE THE AUDIT ROW AND BEFORE THE
-  --    RETURN. This discharges T4's own warning, which was still outstanding.
-  -- `award_result_is_shared_consistent` and `award_result_winner_is_shared_consistent` are
+  --    RETURN. `award_result_is_shared_consistent` and `award_result_winner_is_shared_consistent` are
   -- `deferrable initially deferred` (`0025:335-343`), so they fire at COMMIT. Without this line the
   -- ordering was: write every row -> write an audit row claiming N spins / M results / K winners ->
@@ -570,2 +690,6 @@
 $$;
 
+-- ⚠ THE FUNCTION COMMENT IS RE-ISSUED for the same reason section (c) and (h) re-issue theirs:
+-- `create or replace` preserves `pg_description`, so `0028:1912-1926`'s text would have survived and
+-- would now describe a writer that persists two fewer columns than it does. This is 0028's comment
+-- with the label/bytes_consumed sentence added and nothing else altered.
```

### File List

**New**
- `_bmad-output/implementation-artifacts/6-9b-verificar-la-ceremonia.md`
- `lib/roulette/canonical.ts`
- `lib/roulette/canonical.test.ts`
- `worker/ceremony/bundle.go`
- `worker/ceremony/bundle_test.go`
- `roulette/vectors/canonical-bundle.json`
- `supabase/migrations/0029_verification_bundle.sql`
- `supabase/tests/0029_verification_bundle_test.sql`
- `lib/ceremony/bundle.ts`
- `lib/ceremony/bundle.test.ts`
- `app/api/admin/ceremony/bundle/route.ts`
- `roulette/vectors/canonical-bundle-input.json` (the gate-4 `end_to_end` row's 75 KB input document)

**Deleted before commit (the throwaway THE BAR harness, per the standing convention)**
- `worker/cmd/qa69/main.go` · `lib/roulette/bar-qa69.test.ts` · `_qa69/`

**Modified**
- `_bmad-output/implementation-artifacts/6-9a-verification-bundle-and-the-published-commitment.md` (renamed from `6-9-verification-bundle-and-verificar-la-ceremonia.md`; split carve-out, answered questions, DECISIONS J/K, task rescoping)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `lib/roulette/prng.test.ts` (the shipped-module list and the import-graph pin)
- `lib/roulette/pity.ts` (`STEAMID64_RE`, integer `rejections`, the corrected sort comment)
- `lib/roulette/sweep.ts` (`STEAMID64_RE`, the roster guard, the corrected sort comment)
- `worker/awards/pity.go` (`validSteamID64` reuse)
- `worker/awards/sweep.go` (`validSteamID64` reuse, the roster guard)
- `roulette/vectors/generate_vectors.py` (the JCS canonicalizer, `build_canonical_file`, the `outputs` entry, the pity id guard; ⓶ the `end_to_end` row)
- `roulette/vectors/README.md` (the gate-4 row, the resolved numbering decision, the completeness paragraph; ⓶ the `end_to_end` row landing)
- ⓶ `lib/ceremony/reveal.ts` (the seventh reason, `bundle_not_published`)
- ⓶ `lib/ceremony/reveal.test.ts` (the new reason + the LATEST-definition scan across migrations)
- ⓶ `app/api/admin/ceremony/reveal/route.ts` (`STATUS_FOR` gains `bundle_not_published`)
- ⓶ `lib/roulette/canonical.test.ts` (the deliberately-owed `end_to_end` assertion, updated)
- ⓶ `worker/ceremony/bundle.go` (the BUILDER — `BuildBundle`/`BuildCanonicalBundle` and helpers)
- ⓶ `worker/ceremony/bundle_test.go` (the builder's decisions + the `end_to_end` row)
- ⓶ `worker/ceremony/ceremony.go` (⛔ `PersistReasons` gains `reveal_in_progress` — a REAL pre-existing gap)
- ⓶ `worker/ceremony/ceremony_test.go` (the LATEST-definition scan for `persist_ceremony`)
- ⓶ `supabase/tests/0025_ceremony_results_test.sql` (`spin`'s `columns_are` extended, deliberately)
- ⓶ `supabase/tests/0028_reveal_gating_test.sql` (published bundles for the `spinning` fixtures + the seventh reason)
- ⓶ `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| date | change |
|---|---|
| 2026-08-08 | Story 6.9 SPLIT into 6.9a (the bundle) and 6.9b (the verifier), Cuatro's call. All seven blocking questions answered. **T0** (TS/vector half), **T2** (RFC-8785 in three runtimes + the gate-4 vector), **T2b** (DECISION K's three pulled-forward AC9 debts). Status stayed `in-progress`. |
| 2026-08-09 | **T0's SQL half, T1, T3, T4, T4b, T5, T8, T9, T10 — the rest of the story.** Migration `0029` (the table, both policies, the column-scoped grant, IC912's immutability trigger, `publish_bundle`, `verification_bundle_read`, the `reveal_spin` + `persist_ceremony` replacements, and all four AC10 debts); the Go bundle BUILDER; `lib/ceremony/bundle.ts` + the admin route; pgTAP `0029` at `plan(93)`; the mutation pass (two rounds, 27 killed / 1 recorded unkillable / 0 open survivors); and THE BAR over the real 14-demo corpus with every standing anchor reproduced and the 41-checkpoint walk held. AC2 met — the gate-4 vector's `end_to_end` row landed. Status → `review`. |
| 2026-08-09 | ⛔ **Three findings recorded rather than smoothed over**: `published_at` made nullable (the planner had deleted the policy qual, making the viewer policy equivalent to `using (true)`); `spin_bytes_consumed_non_negative` given an `is null or` disjunct (without it `0029` cannot apply to a non-empty `spin` table); and `reveal_in_progress` added to `worker/ceremony.PersistReasons` — **a real pre-existing gap open since 0028**, surfaced by re-pointing a stale test at the latest definition. |
| 2026-08-09 | ⚠ **DECISION N awaits Cuatro's sign-off**: AC3's `name` field vs §9.5's ASCII restriction vs the shipped Spanish catalog — all three cannot hold, and `name` was dropped from the bundle. |
