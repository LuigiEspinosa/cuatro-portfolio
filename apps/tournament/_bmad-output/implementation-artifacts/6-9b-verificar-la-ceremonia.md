---
baseline_commit: PENDING — set by dev-story when 6.9b starts; 6.9a's commit is the true baseline
---

# Story 6.9b: "Verificar la ceremonia" — the browser verifier

Status: backlog

> **✂ SPLIT CARVE-OUT — decided by Cuatro on 2026-08-08, at the start of 6.9's dev-story.**
> Story 6.9 as contexted was two stories' worth, on the same evidence the epic has already split
> three times (6.4→6.4a/6.4b, 6.5→6.5/6.5b, 6.8→6.8a/6.8b). The cut is the one 6.9's Tasks were
> already grouped for, **between T5 and T6**:
>
> | | scope | ACs |
> |---|---|---|
> | **6.9a — the BUNDLE** ([6-9a-verification-bundle-and-the-published-commitment.md](6-9a-verification-bundle-and-the-published-commitment.md)) | canonicalizer ×3, `verification_bundle` + `publish_bundle` + the projection RPC, the commitment, gate-4 vector, the four DB debts | AC1-AC4, AC10-AC13 (SQL/corpus half) |
> | **6.9b — the VERIFIER** (this file) | TS ceremony orchestrator, `Verificar la ceremonia`, the verify strip, i18n, the remaining browser debts | AC5-AC9, AC12 (TS half), AC13 (browser half) |
>
> ⛔ **READ 6.9a's DEV NOTES BEFORE THIS FILE.** DECISIONS A-K live there and every one of them is
> binding on you. In particular **DECISION B** (one document, hashed once, served as a reveal-gated
> projection) is the contract you verify against, and **DECISION K** records which AC9 debts 6.9a
> already closed so you do not close them twice or, worse, "fix" them back.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the eleventh story of the epic, second half**
Traces: **FR-27**, **FR-30** (the verifier half) · **AD-24** (Spanish-UI invariant) · AD-22, AD-11, AD-19 · SOLUTION-DESIGN **§9.5**/**§9.6** · SPEC **Constraint 7**, **C9** · `epics.md:1154-1175` (AC5-AC9 and the Spanish-UI half of `:1171-1175`)
Consumes: **6.9a's** `verification_bundle`, `publish_bundle`, `verification_bundle_read` projection, `lib/roulette/canonical.ts`, `worker/ceremony/bundle.go` and the `canonical-bundle.json` gate-4 vector · 6.3-6.7's seven `lib/roulette` modules · 6.8b's reveal gating
Hands to: **6.10** (the wheel, reduced-motion parity, the persistent verify-strip inside the reveal choreography, the shared-screen mirror), **6.11** (gate 5, the end-to-end vector from a real snapshot, `--check` automation)

---

## What 6.9a already did — do not redo it, and do not undo it

| | state after 6.9a |
|---|---|
| `verification_bundle` table, RLS, the column-scoped viewer grant | shipped in `0029` |
| `publish_bundle` (validated-not-trusted, the closed refusal set) | shipped |
| `verification_bundle_read` — the reveal-gated `security definer` projection | shipped; **this is the read you call** |
| `reveal_spin`'s `bundle_not_published` guard · `persist_ceremony` writing `spin.label`/`bytes_consumed` | shipped |
| `lib/roulette/canonical.ts` (RFC-8785) + its three `prng.test.ts` pin registrations | shipped |
| the gate-4 vector `roulette/vectors/canonical-bundle.json` | shipped, `--check` OK ×8 |
| **AC9's `LadderExitStep` NULL spelling** | ⭐ **DECIDED: the key is ABSENT when no ladder was walked** (6.9a DECISION J). ⛔ Do not reintroduce the `0` sentinel |
| **AC9's `stage2-resolve.json` `unreachable_outcome_kinds` marker** | shipped |
| **AC9's `STEAMID64_RE` in `pity.*`/`sweep.*`, all three runtimes** | shipped, with the no-op-on-real-corpus claim **measured** |
| **AC9's `rejections` integer division in TS** | shipped |
| the FR-21 floors (`24`/`20`) | ⛔ **UNCHANGED and now cryptographically committed.** 0 of 28 clear either floor; twelve `no_eligible_players` cards and 28 identical consolation prizes |

**Still yours from AC9:** `crypto.subtle` dereferenced with no feature detection (`deferred-work.md:289`)
— the only one of the five that cannot touch a hashed byte, which is exactly why it was safe to defer.

---

## Story

As a skeptical viewer,
I want to tap **Verificar la ceremonia** and have my own browser recompute the ceremony from the
published bundle alone,
so that I can confirm every revealed outcome myself — and so the system can never compute an
unrevealed winner even for me.

---

## Acceptance Criteria

⛔ **AC5-AC9 are reproduced VERBATIM from the contexted Story 6.9.** They were carved out of 6.9a
unaltered; the numbering is deliberately preserved so that `epics.md:1154-1175`, 6.9a's file and this
file all refer to the same AC by the same number. **AC1-AC4, AC10 and AC11 belong to 6.9a** — read
them there as context, and ⛔ do not re-implement them.

**AC5 — the TypeScript ceremony orchestrator exists, and the browser reproduces the ceremony from the bundle alone.**
See Story 6.9's contexted text, carried here in full when 6.9b is contexted. Kernel: a new
`lib/roulette/verify.ts` re-derives, **from the bundle alone**, `decodeSeedHex` → per spin
`createStream(seed, stage1Label(S))` → `stage1Pick` → `resolveSpin(live, players, fr29Ladder)` →
shelf threading → `createStream(seed, PITY_LABEL)` → `resolvePity`, and compares every published
field. ⛔⛔ **The picks are `await`ed SEQUENTIALLY** ([stage1.ts:32-40](lib/roulette/stage1.ts#L32),
W10 — *"a **VERIFIER-ONLY divergence that would surface at 6.9 as the browser declaring a correctly
produced ceremony unfair**"*). The reproduction is checked against the invariants **6.9a re-derived**:
main-spin **22 bytes**, pity **27 bytes / 27 draws**, whole ceremony **49 bytes**, drawn order
`aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`. ⚠ `bytes_consumed` is
**REPRODUCED, never re-derived**.

**AC6 — the verifier can never compute a winner for an unrevealed spin, and that is proven by construction, not by policy.**
6.9a's `verification_bundle_read` already subtracts unrevealed spins (proven by its pgTAP walk and
mutation pass); **your half is that the client cannot compensate** — it must refuse, visibly, rather
than partially verify, and it must never request the un-served keys. ⚠ **The honest limitation is
stated in the UI and in Completion Notes**: before completion a viewer can confirm every *revealed*
outcome but **cannot** bind the served prefix to `bundle_sha256`, because a prefix is a different
document (6.9a's answer to Question 3 — the gap was accepted deliberately). **Measure it; do not
narrate around it.**

**AC7 — the verify strip and `Verificar la ceremonia` ship on `/ceremonia`, in Spanish, from the one i18n module, in blue.**
Verbatim from Story 6.9. Kernel: the Story-5.7 `<Placeholder>` is replaced; the strip carries the
**already-shipped** `es.ceremony.seededByDemo` (⛔ never retype a `// FIXED` string), the
`SHA-256 <hash>` truncated with the existing `truncateHash()` and wrapped in `.num`, and a button
labelled exactly `Verificar la ceremonia` in `accent-live` **blue, never gold**. Every new string is a
new key under a **new sibling key `es.verify`** — ⚠ **not** under `es.awards`. The five
verification-outcome strings exist in **no planning artifact — you are authoring them**: matched ·
mismatched · unsupported MAJOR `algo_version` · not-yet-revealed · Web-Crypto-unavailable. Announced
via `srOnly` + `aria-live="polite"` `role="status"`. ⛔ NO wheel, NO phase copy, NO trophy shelf, NO
shared-screen mirror, NO `prefers-reduced-motion` choreography (all 6.10's) and ⛔ **no in-app dispute
affordance** (a designed non-feature).

**AC8 — an unimplemented MAJOR `algo_version` is a refusal, not a guess.**
Verbatim from Story 6.9. ⚠ **6.9a wrote `ceremony.algorithm_version` for the first time** and
canonicalizes `algo_version` into `bundle_sha256`; check whether it also exported the constant AC8
says does not exist, and if it did **consume that one** rather than authoring a second. ⛔ Do not
conflate the two version axes (the label prefix's `v1` is domain separation, not `algo_version`), and
⛔ `6-3:192` stands — no `algo_version` logic in `prng.ts`.

**AC9 — the remaining `lib/roulette` browser debt homed here is CLOSED, not re-recorded.**
✂ **Four of the five were closed by 6.9a** (DECISION K — three were bundle contracts or
byte-affecting, and deferring them would have meant republishing under a live commitment). **One
remains, and it becomes reachable the moment this story ships the package to a browser:**
`crypto.subtle` dereferenced with **no feature detection** in the one module built for the browser
([deferred-work.md:289](_bmad-output/implementation-artifacts/deferred-work.md#L289), `prng.ts:137,180`)
— it is `undefined` in any non-secure context, so the button *"fails as `TypeError: Cannot read
properties of undefined` from inside `read()` rather than as a typed refusal"* → **a named, typed
refusal plus the Spanish copy from AC7**.
**And** ⛔ **the byte-lex `.sort()` fix (6.9a) and the JCS key-sort (`canonical.ts`) are OPPOSITE
requirements in one package.** JCS sorts object keys by **UTF-16 code units** (RFC-8785 §3.2.3) —
JS-native and correct. The engine sorts **steamid64 arrays byte-lex**. 6.9a commented both at both
sites; ⛔ **do not unify them.**

**AC12 — pgTAP, mutation, and the closed-set discipline this project has failed seven times.** (TS half)
6.9a carried the SQL half. **Yours is the TypeScript/browser half**, under the same rules: every
closed-set assertion **reads its evidence** (the vector file, the module list, the reason set derived
from an `as const`) — ⛔ never a literal copied beside it; the mutation pass runs a **control pass on
unmutated source first**, reads/writes files as **BYTES**, uses whole-suite runners, reports
`NOT-APPLIED` distinct from `killed`, verifies restoration by **SHA-256**, and records the **full**
per-mutation table **including survivors and your own bad mutants**.
⭐ **The mutant 6.9a explicitly deferred to you and recorded as `DEFERRED-6.9b`, not as a pass:**
sequential `await` replaced with `Promise.all` in `verify.ts` — the W10 mutant, which **must** be
killed by something other than `bytes_consumed`.

**AC13 — ⛔ THE BAR: proven in a REAL browser.** (browser half)
6.9a proved the corpus half — the bundle built, canonicalized, hashed and published; the anon
projection walked across all 40 reveals; the local-`NEXT_PUBLIC_*` build with page byte sizes and a
corpus-name hit count; the two-sided AD-22 grep at `k=0`, an intermediate `k` and `k=40`. **Yours are
the four interaction bullets it could not reach:**
- ⭐ **a real browser, two sessions**, over the local build (Epic-5 retro Action Item #4 — ⛔ **this
  is where that action item actually comes due**; 6.9a recorded it as deferred with your name on it):
  `Verificar la ceremonia` tapped **mid-ceremony and at completion**, with the rendered result copy,
  the announced `aria-live` text, and **the elapsed time**;
- ⭐ the **full-bundle release** at `state='complete'` re-canonicalized **in the browser** and matching
  the `bundle_sha256` published before spin 1;
- the three refusal paths exercised **in the browser**: unknown MAJOR `algo_version`, a tampered
  bundle byte, and `crypto.subtle` absent;
- ⚠ **the performance budget 6.9a authored: under 2 s on a mid-range phone** for the 49-byte,
  28-player, 12-award ceremony. No budget exists in any artifact — 6.9a chose this one and could not
  measure it. **Measure it and report the number.** If it is missed, that is a finding, not a
  rounding error.

⚠ **Rebuilding the corpus:** the standing anchors are **204 rounds · 28 roster ·
`fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0 · 12 awards · 40 spins / 40
award_result / 28 award_result_winner**, and `supabase db reset` comes first (every story since 6-4a
leaves the QA corpus in the DB). ⚠ WinNAT eats port `54322` — elevated `net stop winnat` /
`net start winnat`; Kong can remap to host `55321` while `supabase status` still says `54321`.

---

## Tasks / Subtasks

> ⛔ **This story is NOT contexted.** The ACs above are the carved-out contract, and 6.9a's Dev Notes
> carry the decisions — but the file-by-file reading list, the traps section and the transcribed
> APIs still have to be built for this half. **Run `create-story` (or `validate-create-story`) against
> this file before `dev-story`**, exactly as every other story in this epic did.

- [ ] **Task 0 — Re-read, against the tree as 6.9a left it**
  - [ ] 6.9a's **Completion Notes in full** — especially the measured bundle bytes, the published
        `bundle_sha256`, the projection walk, and whatever the mutation pass recorded as a survivor.
  - [ ] ⭐ [lib/roulette/prng.test.ts:649-896](lib/roulette/prng.test.ts#L649) **in full** — 6.9a
        registered `canonical.ts` in the exact-equality module list, the per-module import-graph pin
        and the banned-construct scan. **`verify.ts` must be registered in all three**, and it will
        redden them **by design** until it is.
  - [ ] ⭐ [lib/roulette/stage1.ts:32-48](lib/roulette/stage1.ts#L32) (W10) · [prng.ts:17-42](lib/roulette/prng.ts#L17)
        (⛔ no `node:crypto`; why the API is async; `Bytes = Uint8Array<ArrayBuffer>`) ·
        [labels.ts:5-12](lib/roulette/labels.ts#L5) · [stage2.ts:117-320](lib/roulette/stage2.ts#L117) ·
        [ladder.ts:125-147](lib/roulette/ladder.ts#L125) · [pity.ts:104-199](lib/roulette/pity.ts#L104) ·
        [sweep.ts:102-190](lib/roulette/sweep.ts#L102) — **all as 6.9a's T2b left them.**
  - [ ] [lib/i18n/es.ts](lib/i18n/es.ts) in full (⭐ `:6-8` no inline literals, `:71` `seededByDemo`
        FIXED, `:153-172` `es.awards` and its ⚠ NO GOLD rule) · [es.test.ts:14,52-57](lib/i18n/es.test.ts#L14)
        (⚠ `AWARD_IDENTITY_STRINGS` — why `es.verify` must be a **sibling**, not a child).
  - [ ] [app/(viewer)/leaderboards/LockedAwards.tsx](app/(viewer)/leaderboards/LockedAwards.tsx) in
        full (the house form for a security-argued viewer component) ·
        [app/(viewer)/ceremonia/page.tsx](app/(viewer)/ceremonia/page.tsx) (the Placeholder you
        replace) · [app/globals.css:1-76](app/globals.css#L1) (`--gold` at `:24`, `.num` at `:72-76`) ·
        [lib/realtime/status.ts:6-14](lib/realtime/status.ts#L6) (the one precedent for a
        browser-reachable `lib/` module outside `lib/roulette`) ·
        [lib/feed/model.ts:64](lib/feed/model.ts#L64) (`truncateHash` — ⛔ do not write a second one) ·
        [vitest.config.ts](vitest.config.ts) (⚠ `include: ['lib/**/*.test.ts']` — **`.test.tsx` and
        anything under `app/` silently never run**).
  - [ ] [EXPERIENCE.md:56-75,94,133,140-154](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L56)
        (the voice you author the five strings in) · [DESIGN.md:147-154,236,273](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L147)
        · `epics.md:110-131` (every UX-DR) · [SOLUTION-DESIGN:453-471](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L453)
        (the Spanish table — `verify.button` at `:460`).
  - [ ] ⚠ **Re-read the UX-mock caveat**: the mock HTML mixes wrong nav labels and inline admin
        controls. Trust `EXPERIENCE.md`/the spine and **FR-34 (viewers are read-only)**, not the mock.
- [ ] **Task 1 — `lib/roulette/verify.ts` + the `crypto.subtle` debt (AC: 5, 8, 9)**
- [ ] **Task 2 — i18n `es.verify` + the `/ceremonia` verify strip (AC: 7)**
- [ ] **Task 3 — Vitest coverage + the three pin registrations (AC: 12)**
- [ ] **Task 4 — Mutation pass, including the W10 `Promise.all` mutant (AC: 12)**
- [ ] **Task 5 — ⛔ THE BAR: two-session real-browser run (AC: 13) — gates sign-off**
- [ ] **Task 6 — Gates** (⛔ measure the baseline, do not quote 6.9a's table or `sprint-status.yaml`;
      6.7 quoted `1318/42` when the real figure was `1322/42`. *"Baselines are measured, never quoted."*)

---

## Dev Notes

### ⛔ Read 6.9a's Dev Notes first — DECISIONS A-K are binding here

The ones that most directly constrain this story:

- **DECISION B** — one document, hashed once, served as a reveal-gated projection that **subtracts**
  unrevealed spins rather than blanking them. The release schedule table is the contract you verify
  against. ⛔ A `"redacted"` placeholder is a defect; if you ever see one, it is a bug in 6.9a's
  projection, not something to render.
- **DECISION J** — `tie_ladder_exit_step` is **absent**, never `0`, in the bundle. Your comparison is
  `undefined === undefined`, not a special case.
- **DECISION K** — which AC9 debts are already closed, and why deferring them would have meant
  republishing a document under a live commitment.
- **DECISION H** — no realtime consumer and no `NUDGE_EVENTS` change. `spin.reveal` is emitted on
  `ceremony:<id>` and consumed by nobody; ⛔ do not subscribe here (that is 6.10's, with the UI that
  consumes it). The verify surface must be **fully reconstructable from a published read alone**
  (AD-11) — which is what makes a missing nudge a UX gap and not a correctness gap.
- **The answer to Question 3** — the mid-ceremony prefix cannot bind to `bundle_sha256`, the gap was
  accepted deliberately, and **AC6 requires you to say so in the UI**.
- **The answer to Question 7** — 2 s on a mid-range phone. 6.9a authored it; you measure it.

### TypeScript / browser traps (carried from Story 6.9's contexting — all still live)

- **`npm test` does NOT typecheck.** Only `npm run build` does ([prng.ts:37](lib/roulette/prng.ts#L37)).
- **`Bytes = Uint8Array<ArrayBuffer>`** is required for anything reaching WebCrypto; the default
  `ArrayBufferLike` includes `SharedArrayBuffer` and `BufferSource` rejects it. `npm test` will not
  catch it.
- **`crypto.subtle.digest` is async** ⇒ the whole verify path is a Promise. **A React component
  cannot compute it at render time.**
- **No jsdom, no RTL, no `.test.tsx` collection, nothing under `app/` is collected.** Component
  behaviour is proven by **live-QA only** — which is why AC13's two-session browser run is a gate and
  not a nicety.
- **`prng.test.ts > real-seed/spin1/i255` times out at 5000 ms under full-suite load**
  (`deferred-work.md:336`, unowned) — *"`npm test` is not reliably green on this machine."* If you hit
  it, **say so; do not silently re-run until green.**
- ⚠ **`Number`-parsing a magnitude reads both sides as 2^53, ties, and bottoms out `shared` at step 5**
  (`6-5b:587`). Every magnitude crosses the JSON boundary as a **string** and becomes a `bigint`,
  never a `number`.
- ⛔ **No new npm package.** `lib/roulette` is banned from third-party imports outright.

### The PRNG spec the browser reimplements (`roulette/vectors/README.md:820-848`)

```
seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # LE64 is the ONLY LE construct
uniform_int(stream, n): k = minimal k with 256^k >= n; limit = 256^k - (256^k mod n)
                        x = big-endian int of next k bytes (CONSUMED); if x >= limit retry; return x mod n
labels: "inclusivcup/v1/stage1/spin/<S>"  (S = 1,2,3…, decimal, no padding) · "inclusivcup/v1/pity"
```

### References

- [6-9a-verification-bundle-and-the-published-commitment.md](6-9a-verification-bundle-and-the-published-commitment.md) — ⛔ **DECISIONS A-K, the answered questions, and the measured Completion Notes**
- [epics.md:1154-1175](_bmad-output/planning-artifacts/epics.md#L1154) · `:110-131` (every UX-DR)
- [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) (AD-22) · `:195-198` (AD-24) · `:210-223`
- [SOLUTION-DESIGN.md:431-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) · `:453-471`
- [SPEC.md:72,74,87,97](_bmad-output/specs/spec-cs-tournament/SPEC.md#L72) · [glossary.md:24,66-70](_bmad-output/specs/spec-cs-tournament/glossary.md#L24)
- [deferred-work.md:289](_bmad-output/implementation-artifacts/deferred-work.md#L289) — the one AC9 debt still open here
- [epic-5-retro-2026-07-28.md:43,89-99](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L43) — ⭐ Action Item #4 comes due in **this** story

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
