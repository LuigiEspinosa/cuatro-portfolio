---
baseline_commit: d14adf037b2baaf2daccce692e143ca638d1abe6
---

# Story 6.9b: "Verificar la ceremonia" — the browser verifier

Status: done

> ✅ **DONE 2026-08-11 — code review applied in full, and THE BAR's browser half run against the
> patched build.**
> All 4 decision-needed and all 16 patch findings were resolved and applied. Gates re-measured after
> the patches: lint **0** · Vitest **1694/50** · build **0** · Go **8 packages** clean (while the
> throwaway harness was present AND after removal) · gofmt **empty** · `--check` **OK ×8** · pgTAP
> **1543/30 PASS** on a freshly reset DB · scope byte-untouched · **0 CRLF**.
> AC13's four interaction bullets: **three MET** in real Chrome (Completion Note 11b).
>
> ⚠ **ONE ITEM WAS CLOSED ON A PROXY, NOT ON THE MEASUREMENT THE AC ASKS FOR — say so plainly.** The
> **2 s budget on a mid-range phone** was never measured on a physical device. It was measured as a
> **CPU-throttled proxy** (6× → **137.7 ms** median, ~14× headroom; 4× → 77.6 ms, 10× → 336 ms), and
> **Cuatro accepted that proxy and closed the story on it (2026-08-11)**. ⛔ That is a deliberate,
> recorded substitution — not a measurement that happened. The real-device number is **re-homed to
> 6.10's live-QA**, which ships the wheel and the reduced-motion parity and needs a physical phone
> anyway; it stays open in `deferred-work.md` rather than disappearing with this story's sign-off.

> **✂ SPLIT CARVE-OUT — decided by Cuatro on 2026-08-08, at the start of 6.9's dev-story.**
> Story 6.9 as contexted was two stories' worth, on the same evidence the epic has already split
> three times (6.4→6.4a/6.4b, 6.5→6.5/6.5b, 6.8→6.8a/6.8b). The cut is the one 6.9's Tasks were
> already grouped for, **between T5 and T6**:
>
> | | scope | ACs |
> |---|---|---|
> | **6.9a — the BUNDLE** ([6-9a-verification-bundle-and-the-published-commitment.md](6-9a-verification-bundle-and-the-published-commitment.md)) | canonicalizer ×3, `verification_bundle` + `publish_bundle` + the projection RPC, the commitment, gate-4 vector, the four DB debts | AC1-AC4, AC10-AC13 (SQL/corpus half) |
> | **6.9b — the VERIFIER** (this file) | TS ceremony orchestrator, `Verificar la ceremonia`, the verify strip, i18n, the remaining browser debts | AC5-AC9, AC3's completeness clause, AC12 (TS half), AC13 (browser half) |
>
> ⛔ **READ 6.9a's DEV NOTES BEFORE THIS FILE.** DECISIONS A-N live there and every one of them is
> binding on you. In particular **DECISION B** (one document, hashed once, served as a reveal-gated
> projection) is the contract you verify against, and **DECISION K** records which AC9 debts 6.9a
> already closed so you do not close them twice or, worse, "fix" them back.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **the eleventh story of the epic, second half**
Traces: **FR-27**, **FR-30** (the verifier half) · **AD-24** (Spanish-UI invariant) · AD-22, AD-11, AD-19 · SOLUTION-DESIGN **§9.5**/**§9.6** · SPEC **Constraint 7** (`SPEC.md:72`), **C9** (`SPEC.md:74`) · `epics.md:1160-1175`
Consumes: **6.9a's** `verification_bundle`, `publish_bundle`, `verification_bundle_read` projection, `lib/roulette/canonical.ts`, `worker/ceremony/bundle.go` and the `canonical-bundle.json` gate-4 vector · 6.3-6.7's seven `lib/roulette` modules · 6.8b's reveal gating and its anon column grant on `ceremony`
Hands to: **6.10** (the wheel, reduced-motion parity, the persistent verify-strip inside the reveal choreography, the shared-screen mirror), **6.11** (gate 5, the end-to-end vector from a real snapshot, `--check` automation)

---

## ⚠ Corrections this contexting made to the carve-out stub — read these first

The stub carried five inherited errors. They are fixed below and repeated here so nobody restores them.

1. ⛔ **`crypto.subtle` is NOT at `prng.ts:137,180`.** Those line numbers come from `deferred-work.md:289`
   and were stale before 6.9a. **MEASURED (grep over `lib/`, 2026-08-09): there are THREE production
   dereference sites, not two** — [prng.ts:201](lib/roulette/prng.ts#L201) (`crypto.subtle.sign`),
   [prng.ts:279](lib/roulette/prng.ts#L279) (`crypto.subtle.importKey`) and
   [canonical.ts:390](lib/roulette/canonical.ts#L390) (`crypto.subtle.digest`). `prng.ts:137` is a blank
   line in a JSDoc; `:180` is inside the `consumed` getter's JSDoc. **Your feature detection must cover
   the digest site too** — it is the one the verify button reaches first.
2. ⚠ **`deferred-work.md:289` is checkboxed `- [x]` while its own text says
   "🟡 STILL OPEN after Story 6.9a — CONFIRMED, not overlooked … Home: 6.9b, its AC9."** The checkbox
   in that file does not mean "closed"; the annotation governs. Do not read the box.
3. ⚠ **`deferred-work.md:335` (the `sweep.ts` byte-lex `.sort()` debt) is 🟢 CLOSED by 6.9a.** The stub's
   AC9 prose could be read as leaving it open. It is closed.
4. ⛔ **FIVE `deferred-work.md` bullets are homed to 6.9b, not two.** The stub named only `:265-266` and
   `:289`. The full set is **`:265`, `:266`, `:289`, `:378`, `:379`** — see *The five debts that are
   yours* below. `:378` in particular was nobody's until 6.9a's review, and it changes your refusal
   taxonomy.
5. ⛔ **`deferred-work.md` is NOT byte-append-only, and you MUST edit it.** 6.9a was told to close its
   inherited debts there and did not; that failure is itself recorded at `deferred-work.md:376`
   (*"`deferred-work.md` was byte-untouched by 6.9a … that is tracked as a patch finding"*). Debts are
   closed by an **in-place bold annotation** appended to the bullet (`**🟢 CLOSED by Story 6.9b, AC9.**`),
   never by ticking the box and never by deletion. New sections append at the **end** — ⛔ do not insert
   mid-file, because debts are cited across the repo **by line number**.

---

## What 6.9a already did — do not redo it, and do not undo it

| | state after 6.9a (`d14adf0`) |
|---|---|
| `verification_bundle` table, RLS, the column-scoped viewer grant | shipped in `0029` |
| `publish_bundle` (validated-not-trusted, the closed 14-reason refusal set) | shipped |
| `verification_bundle_read` — the reveal-gated `security definer` projection | shipped; **this is the read you call** |
| `reveal_spin`'s `bundle_not_published` guard · `persist_ceremony` writing `spin.label`/`bytes_consumed` | shipped |
| `lib/roulette/canonical.ts` (RFC-8785 + `canonicalSha256Hex`) + its `prng.test.ts` pin registrations | shipped |
| the gate-4 vector `roulette/vectors/canonical-bundle.json` | shipped, `--check` OK ×8 |
| **AC9's `LadderExitStep` NULL spelling** | ⭐ **DECIDED: the key is ABSENT when no ladder was walked** (DECISION J). ⛔ Do not reintroduce the `0` sentinel |
| **AC9's `stage2-resolve.json` `unreachable_outcome_kinds` marker** | shipped — ⛔ **but only after 6.9a's code review caught it was NOT.** Three artifacts, three answers, no code. Recorded because you are told not to close debts twice — a false "shipped" meant nobody would ever have added it |
| **AC9's `STEAMID64_RE` in `pity.*`/`sweep.*`, all three runtimes** | shipped, no-op-on-real-corpus claim **measured** · closes `deferred-work.md:335` |
| **AC9's `rejections` integer division in TS** | shipped |
| the FR-21 floors (`24`/`20`) | ⛔ **UNCHANGED and now cryptographically committed.** 0 of 28 clear either floor; twelve `no_eligible_players` cards and 28 identical consolation prizes |
| ⛔⛔ **AC3's completeness test** — *"the browser verifier is proven to run with EVERY non-bundle read stubbed to throw"* | **NOT shipped, and it is now YOURS** (`6-9a:427`, deferred by Cuatro, reason: *untestable until the verifier exists*). ⭐ Fold it into **AC5's** harness. ⚠ `SOLUTION-DESIGN:448-449` is the standard — *"The JS verifier needs **nothing** outside the bundle; if it does, the bundle is incomplete (a spec bug)"* — so a failure here is a **BUNDLE defect to escalate**, not a stub to loosen |
| ⛔ **`crypto.subtle` feature detection** (`deferred-work.md:289`) | **NOT shipped and correctly so** — unreachable until your button ships, live the moment it does. Your AC9 |
| ⚠ **`deferred-work.md:265-266` — zero-width / unbounded award `name`** | **RE-OPENED by 6.9a's code review.** DECISION N drops `name` from the bundle, so the ASCII refusal is unreachable in production and never gave this teeth. The guard belongs where names reach a viewer — **your verify strip and the feed** |
| **W10 `Promise.all` mutant** | recorded as **`DEFERRED-6.9b`, not as a pass** (`6-9a:393`, `:1285-1286`) |
| **Epic-5 retro Action Item #4** | recorded as deferred **with your name on it** (`6-9a:1281-1282`) |

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
unaltered; the numbering is deliberately preserved so that `epics.md:1160-1175`, 6.9a's file and this
file all refer to the same AC by the same number. **AC1-AC4, AC10 and AC11 belong to 6.9a** — read
them there as context, and ⛔ do not re-implement them.

**AC5 — the TypeScript ceremony orchestrator exists, and the browser reproduces the ceremony from the bundle alone.**
**Given** that [worker/awards/ceremony.go:19-26] states the gap in the file itself — *"GO ONLY, AND THE
ABSENCE OF A TYPESCRIPT MIRROR IS DELIBERATE … a verifier needs an orchestrator only once it has a
published bundle to verify against"* — and [6-8a:497] homes the mirror to 6.9,
**When** `Verificar la ceremonia` runs,
**Then** a new `lib/roulette/verify.ts` re-derives, **from the bundle alone**: `decodeSeedHex` → per spin
`createStream(seed, stage1Label(S))` → `stage1Pick` → `resolveSpin(live, players, fr29Ladder)` →
shelf threading → `createStream(seed, PITY_LABEL)` → `resolvePity`, and compares every published field,
**And** ⛔⛔ **the picks are `await`ed SEQUENTIALLY** ([stage1.ts:32-40](lib/roulette/stage1.ts#L32), W10 —
*"a **VERIFIER-ONLY divergence that would surface at 6.9 as the browser declaring a correctly produced
ceremony unfair**"*),
**And** the reproduction is checked against the invariants 6.9a **re-derived on the real corpus**:
main-spin **22 bytes**, pity **27 bytes / 27 draws**, whole ceremony **49 bytes**, drawn order
`aw-04,aw-12,aw-08,aw-09,aw-05,aw-10,aw-02,aw-03,aw-07,aw-06,aw-01,aw-11`,
**And** ⚠ `bytes_consumed` is **REPRODUCED, never re-derived**,
**And** ⭐ **AC3's completeness clause, inherited:** the verifier is **proven to run with every
non-bundle read stubbed to throw**, and Completion Notes name what that proved.

**AC6 — the verifier can never compute a winner for an unrevealed spin, and that is proven by construction, not by policy.**
6.9a's `verification_bundle_read` already subtracts unrevealed spins (proven by its pgTAP walk and
mutation pass); **your half is that the client cannot compensate** — it must refuse, visibly, rather
than partially verify, and it must never request the un-served keys. ⚠ **The honest limitation is
stated in the UI and in Completion Notes**: before completion a viewer can confirm every *revealed*
outcome but **cannot** bind the served prefix to `bundle_sha256`, because a prefix is a different
document (6.9a's answer to Question 3 — the gap was accepted deliberately). **Measure it; do not
narrate around it.**

**AC7 — the verify strip and `Verificar la ceremonia` ship on `/ceremonia`, in Spanish, from the one i18n module, in blue.**
The Story-5.7 `<Placeholder>` is replaced; the strip carries the **already-shipped**
`es.ceremony.seededByDemo` (⛔ never retype a `// FIXED` string), the `SHA-256 <hash>` truncated with
the existing `truncateHash()` and wrapped in `.num`, and a button labelled exactly
`Verificar la ceremonia` in `accent-live` **blue, never gold**. Every new string is a new key under a
**new sibling key `es.verify`** — ⚠ **not** under `es.awards`. The five verification-outcome strings
exist in **no planning artifact — you are authoring them**: matched · mismatched · unsupported MAJOR
`algo_version` · not-yet-revealed · Web-Crypto-unavailable. Announced via `srOnly` +
`aria-live="polite"` `role="status"`. ⛔ NO wheel, NO phase copy, NO trophy shelf, NO shared-screen
mirror, NO `prefers-reduced-motion` choreography (all 6.10's) and ⛔ **no in-app dispute affordance**
(a designed non-feature, `SPEC.md:87`). ⭐ **UX-DR32 is CRITICAL and you must dispose of it explicitly:**
6.9b's affordance has no motion to reduce — **say so in Completion Notes** rather than leaving the rule
looking unaddressed.

**AC8 — an unimplemented MAJOR `algo_version` is a refusal, not a guess.**
The verifier parses `<name>-<major>.<minor>.<patch>`, compares against a **real exported constant**, and
**refuses with a typed reason and Spanish copy** on an unknown MAJOR, an unknown name, or an
unparseable string. ⚠ **MEASURED at 6.9a (`:963`): there is still NO exported TypeScript constant** —
`inclusivcup-roulette-1.0.0` exists as `generate_vectors.py:90`, `worker/ceremony/bundle.go:534`
(`BundleAlgoVersion`), `0029:779` (`c_algo_version`), and asserted literals in both suites. **AC8's
premise holds: you author the TS constant.** ⛔ Do not conflate the two version axes (the label
prefix's `v1` is domain separation, not `algo_version`), and ⛔ `6-3:192` stands — no `algo_version`
logic in `prng.ts`.

**AC9 — the remaining `lib/roulette` browser debt homed here is CLOSED, not re-recorded.**
✂ **Four of the five were closed by 6.9a** (DECISION K). **One remains, and it becomes reachable the
moment this story ships the package to a browser:** `crypto.subtle` dereferenced with **no feature
detection** ([deferred-work.md:289](_bmad-output/implementation-artifacts/deferred-work.md#L289)) —
it is `undefined` in any non-secure context, so the button *"fails as `TypeError: Cannot read
properties of undefined` … rather than as a typed refusal"* → **a named, typed refusal plus the
Spanish copy from AC7**. ⚠ The real sites are `prng.ts:201`, `prng.ts:279` and `canonical.ts:390` (see
Corrections above), and **6.9a explicitly homed the check to the button, not to the engine**
([canonical.ts:383-386](lib/roulette/canonical.ts#L383)).
**And** ⛔ **the JCS key-sort (`canonical.ts`) and the byte-lex steamid64 sort (`pity.ts`/`sweep.ts`) are
OPPOSITE requirements in one package.** Both are correct. ⛔ **Do not unify them.**
**And** ⚠ **`deferred-work.md:265-266` is yours now**: a reject-list for C0/C1 controls,
U+200B/200C/200D/200E/200F/FEFF and the bidi overrides U+202A-202E / U+2066-2069, plus a length bound,
**at the point where a name reaches a viewer**.
**And** ⚠ **`deferred-work.md:378` is yours too, and it belongs in the refusal taxonomy, not the UI**:
a canonical payload containing `\u0000` passes the ASCII check and the SHA-256 re-derivation and then
dies in `p_payload::jsonb` as 22P05, which `publish_bundle`'s `when others` handler misreports as
`payload_shape / 'the payload is not valid JSON'`. All three canonicalizers emit the six-character
escape and the `string-escaping` vector pins it, so the document is valid RFC-8785 **and** valid
RFC-8259 — Postgres `text` simply cannot hold NUL. It is **unreachable in production** (no value read
out of the database can carry U+0000 into the builder), and it was deferred here precisely because
*"both [fixes] want the browser verifier — which will canonicalize untrusted served bytes — to exist
first."* ⭐ **Your obligation is the verifier half only: decide, in writing, whether U+0000 is inside
the bundle's alphabet, and make your own refusal say so.** ⛔ Do **not** open `0029` to narrow the SQL
handler — that is a migration this story does not own (see Questions).

### The five debts that are yours

| line | debt | what closing it means here |
|---|---|---|
| `:265` | `~ '[^[:space:]]'` accepts zero-width / format characters | the viewer-side reject-list (AC9) |
| `:266` | `name` unbounded, near-duplicates pass | the length bound, folded into the same guard. ⚠ `:266` carries **no** `Intended home:` field of its own — it travels with `:265`'s annotation |
| `:289` | `crypto.subtle` no feature detection | AC9's typed refusal at the button |
| `:378` | `\u0000` misdiagnosed as `payload_shape` | your refusal taxonomy + a written alphabet decision |
| `:379` | AC3's completeness test was owned by nobody | folded into AC5's harness |

⚠ **Adjacent, and NOT yours — do not fix them, but know they exist:**
`deferred-work.md:369` (the zero-winner feed card renders *"Se revela en la ceremonia"* **twice**, and
0/28 players clearing the floors makes it the ceremony's **dominant** card) is **6.10's** — it will be
visibly wrong on the page your strip sits beside, and that is expected. `deferred-work.md:119`
(`display_name` written unbounded and un-charset-checked) is the same hazard class as your reject-list
but homed to viewer-surface hardening; ⛔ resist widening scope into it.

**AC12 — pgTAP, mutation, and the closed-set discipline this project has failed eight times.** (TS half)
6.9a carried the SQL half. **Yours is the TypeScript/browser half**, under the same rules: every
closed-set assertion **reads its evidence** — ⛔ never a literal copied beside it; the mutation pass runs
a **control pass on unmutated source first**, reads/writes files as **BYTES**, uses whole-suite runners,
reports `NOT-APPLIED` distinct from `killed`, verifies restoration by **SHA-256**, and records the
**full** per-mutation table **including survivors and your own bad mutants**.
⭐ **The mutant 6.9a explicitly deferred to you and recorded as `DEFERRED-6.9b`:** sequential `await`
replaced with `Promise.all` in `verify.ts` — the W10 mutant, which **must** be killed by something other
than `bytes_consumed`. ⚠ **See the Dev Note "What the W10 mutant actually is" — the obvious cut is not
the real one.**

**AC13 — ⛔ THE BAR: proven in a REAL browser.** (browser half)
6.9a proved the corpus half. **Yours are the four interaction bullets it could not reach:**
- ⭐ **a real browser, two sessions**, over the local build (Epic-5 retro Action Item #4 — ⛔ **this is
  where that action item comes due**): `Verificar la ceremonia` tapped **mid-ceremony and at
  completion**, with the rendered result copy, the announced `aria-live` text, and **the elapsed time**;
- ⭐ the **full-bundle release** at `state='complete'` re-canonicalized **in the browser** and matching
  the `bundle_sha256` published before spin 1;
- the three refusal paths exercised **in the browser**: unknown MAJOR `algo_version`, a tampered bundle
  byte, and `crypto.subtle` absent — ⚠ **see the Dev Note: `localhost` IS a secure context, so the
  third cannot be reproduced by simply running the dev server**;
- ⚠ **the performance budget 6.9a authored: under 2 s on a mid-range phone** for the 49-byte,
  28-player, 12-award ceremony. **Measure it and report the number.** If it is missed, that is a
  finding, not a rounding error.

⚠ **Rebuilding the corpus:** the standing anchors are **204 rounds · 28 roster ·
`fair_seed = 1b3cd678…3279c` · row_count 28 · eligible_count 0 · 12 awards · 40 spins / 40
award_result / 28 award_result_winner · canonical bytes 75,013**, and `supabase db reset` comes first.

---

## Tasks / Subtasks

- [x] **Task 0 — Re-read, against the tree as 6.9a left it**
  - [x] 6.9a's **Completion Notes in full** (`6-9a:944-1311`) — the measured bundle bytes, the published
        `bundle_sha256`, the 41-checkpoint projection walk, and the two mutation tables.
  - [x] ⭐ [lib/roulette/prng.test.ts:644-1008](lib/roulette/prng.test.ts#L644) **in full** — the three
        pins. **`verify.ts` must be registered**, and it will redden them **by design** until it is.
  - [x] ⭐ [stage1.ts:32-48](lib/roulette/stage1.ts#L32) (W10) · [prng.ts:17-42](lib/roulette/prng.ts#L17)
        · [prng.ts:218-258](lib/roulette/prng.ts#L218) (the reentrancy guard) ·
        [labels.ts](lib/roulette/labels.ts) (whole) · [stage2.ts:251-330](lib/roulette/stage2.ts#L251) ·
        [ladder.ts:125-147](lib/roulette/ladder.ts#L125) · [pity.ts:396-460](lib/roulette/pity.ts#L396) ·
        [sweep.ts:193-212](lib/roulette/sweep.ts#L193) · [canonical.ts:19-50](lib/roulette/canonical.ts#L19).
  - [x] [supabase/migrations/0029_verification_bundle.sql:1441-1638](supabase/migrations/0029_verification_bundle.sql#L1441)
        — the projection you call, end to end. · `0028:494-502` (the anon `ceremony` grant).
  - [x] [lib/i18n/es.ts](lib/i18n/es.ts) in full (⭐ `:6-8` no inline literals, `:71` `seededByDemo`
        FIXED, `:153-172` `es.awards` and its ⚠ NO GOLD rule, `:202-205` `provenance`) ·
        [es.test.ts](lib/i18n/es.test.ts) in full (⚠ `:14` + `:52-57` — why `es.verify` must be a **sibling**).
  - [x] [LockedAwards.tsx](app/(viewer)/leaderboards/LockedAwards.tsx) in full (the house form for a
        security-argued viewer component) · [ceremonia/page.tsx](app/(viewer)/ceremonia/page.tsx) ·
        [globals.css](app/globals.css) (`--gold` `:24`, `.num` `:72-76`, `--blue` `:23`) ·
        [lib/realtime/status.ts:1-45](lib/realtime/status.ts#L1) (the browser-reachable `lib/` precedent) ·
        [lib/feed/model.ts:63-67](lib/feed/model.ts#L63) (`truncateHash` — ⛔ do not write a second) ·
        [lib/awards/read.ts:19-53](lib/awards/read.ts#L19) (the house anon-RPC reader shape) ·
        [vitest.config.ts](vitest.config.ts).
  - [x] [EXPERIENCE.md:54-75,94,133,140-154](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L54)
        (the voice you author the five strings in — especially the Do/Don't table at `:58-73`) ·
        [DESIGN.md:147-154,236,273](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md#L147)
        · `epics.md:110-131` (every UX-DR) · SOLUTION-DESIGN `:453-471` (`verify.button` at `:460`).
  - [x] ⚠ **Re-read the UX-mock caveat**: the mock HTML mixes wrong nav labels and inline admin
        controls. Trust `EXPERIENCE.md`/the spine and **FR-34 (viewers are read-only)**, not the mock.
- [x] **Task 1 — `lib/roulette/verify.ts` (AC: 5, 8)**
  - [x] Declare the bundle's parse types locally (there is **no** TS type for the bundle anywhere).
  - [x] Export `ALGO_VERSION` + the parse/compare of `<name>-<major>.<minor>.<patch>` (AC8).
  - [x] Export the outcome/refusal closed set as a runtime `as const` — AC12 asserts against it.
  - [x] Re-derive per AC5, sequentially, threading the shelf yourself (A10/P6 — nothing does it for you).
  - [x] ⛔ Relative imports only; no `server-only`; no `node:`; no third-party; no banned construct.
- [x] **Task 2 — the `crypto.subtle` feature detection + the name-sanitiser (AC: 9)**
  - [x] A typed, named refusal at the button covering all three deref sites, with AC7's Spanish copy.
        ⚠ Guard `globalThis.crypto?.subtle` (and/or `isSecureContext`) **before** any engine call — ⛔ do
        not add the guard inside `prng.ts`/`canonical.ts`: 6.9a homed it to the button on purpose, and
        `prng.test.ts:909-914` asserts the literal substrings `crypto.subtle.importKey` /
        `crypto.subtle.sign` still appear in `prng.ts`.
  - [x] The `deferred-work.md:265-266` reject-list + length bound where a name reaches a viewer.
  - [x] The `deferred-work.md:378` alphabet decision, written into the verifier's refusal taxonomy.
  - [x] ⛔ Annotate **all five** entries (`:265`, `:266`, `:289`, `:378`, `:379`) CLOSED **in place**, in
        the house form `**🟢 CLOSED by Story 6.9b, AC9.**` — never by ticking the box, never by deletion.
        ⚠ 6.9a's failure to do exactly this is a recorded finding (`deferred-work.md:376`); do not repeat it.
- [x] **Task 3 — the read: `lib/ceremony/verification.ts` (AC: 5, 6)**
  - [x] `import 'server-only'` at line 1; `(client: SupabaseClient, ceremonyId: number)`; the
        `{ ok: true, … } | { ok: false, reason }` union; `console.error('[fnName] …')`; **fail closed**.
  - [x] Model the RPC's own two-member refusal set (`no_ceremony`, `not_published`) plus the house
        `read_failed`, derived from an `as const` — ⛔ not a hand-written union.
  - [x] **Shape-validate the envelope before trusting it** (the `lib/ceremony/bundle.ts:193-206` pattern).
  - [x] Resolve the ceremony via the anon `ceremony` grant and carry `seed_demo_sha256` for DECISION B.
- [x] **Task 4 — i18n `es.verify` + the `/ceremonia` verify strip (AC: 7)**
  - [x] `es.verify` as a **top-level sibling** between `es.ts:205` and `} as const;`, with the JSDoc,
        the NO-GOLD clause and `// FIXED — do not paraphrase` on `Verificar la ceremonia`.
  - [x] The five outcome strings, authored in the `EXPERIENCE.md:58-73` voice (⚠ Question 2).
  - [x] `app/(viewer)/ceremonia/ceremonia.module.css` — `.srOnly` copied from `feed.module.css:302`;
        chrome `var(--blue)`, hash `var(--tm)`, solid-blue button; ⛔ **zero `var(--gold)`**.
  - [x] The `'use client'` island: the button, the async verify call, the always-rendered
        `aria-live="polite"` `role="status"` region, and the AC6 limitation line.
  - [x] `page.tsx` keeps `force-dynamic`, becomes `async`, uses `currentTournament()` — ⚠ decide the
        fate of `<Placeholder>` / `es.placeholder.ceremony` (Question 4).
  - [x] Add `es.test.ts` coverage: composition, U+2014 if used, ⛔ **do not touch `AWARD_IDENTITY_STRINGS`**.
- [x] **Task 5 — Vitest coverage + the three pin registrations (AC: 12, and AC5's completeness clause)**
  - [x] `lib/roulette/verify.test.ts` (⛔ under `lib/**` or it silently never runs).
  - [x] The three `prng.test.ts` pins — **including the deliberate rewrite of the "exactly the two
        stream consumers" test name and its comment**.
  - [x] ⭐ **AC3's completeness harness**: the AC5 run with every non-bundle read stubbed to throw.
        A failure is a **bundle defect to escalate**, not a stub to loosen.
  - [x] Non-vacuity assertion before every `it.each` — `it.each([])` is zero tests and a green run.
- [x] **Task 6 — Mutation pass, before review, non-optional (AC: 12)**
  - [x] Control pass first · files as BYTES · whole-suite runners · SHA-256 restore checks ·
        `NOT-APPLIED` distinct from `killed` · the full table incl. survivors and your own bad mutants.
  - [x] ⭐ The W10 `Promise.all` mutant — read *"What the W10 mutant actually is"* first; it needs a
        **synthetic shelf fixture**, and a corpus-only run will likely let it survive.
  - [x] ⛔ Do not use `git stash` to restore mutants (CRLF).
- [x] **Task 7 — ⛔ THE BAR: two-session real-browser run (AC: 13) — gates sign-off** — ⚠ **DONE 2026-08-11 EXCEPT the mid-range-phone number** (see Completion Note 11b)
  - [x] Corpus rebuild to the standing anchors; local-`NEXT_PUBLIC_*` build; the four interaction
        bullets; the LAN-origin trick for the `crypto.subtle`-absent path. ⭐ Three of the four
        interaction bullets are MET in real Chrome, driven over CDP with zero npm packages (Node 24's
        global `WebSocket`). 🟡 The 2 s budget is measured only as a **CPU-throttled proxy**
        (6× → 137.7 ms); the real mid-range phone is still owed and stays open in `deferred-work.md`.
  - [x] Delete the throwaway harness; Go gates clean while present **and** after removal.
- [x] **Task 8 — Gates** (⛔ measure the baseline first; do not quote 6.9a's table or `sprint-status.yaml`;
      6.7 quoted `1318/42` when the real figure was `1322/42`. *"Baselines are measured, never quoted."*)
  - [x] All eight gates below, plus the scope proof and `0 CRLF`.
  - [x] ⭐ Call out explicitly that `/ceremonia` is **no longer** the 5.7 Placeholder — that assertion
        inverts with this story and must not read as a regression.

### Review Findings

Code review 2026-08-11 — three parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor),
plus a reviewer-independent mutation pass and an independent re-measurement of all eight gates.

⭐ **Gates re-measured by the reviewer, not quoted:** lint **0** · Vitest **1665 / 50** · build **0**
(TypeScript clean, every viewer route `ƒ`, no `roulette` route) · Go **8 packages** clean · `gofmt`
**empty** · `--check` **OK ×8** with `roulette/vectors/` git-clean · scope byte-untouched · **0 CRLF**
across all 15 touched files. Every figure in the story's gate table is corroborated exactly.
⚠ Gate 7 (pgTAP) was NOT re-run — it requires `supabase db reset`, which would destroy local state;
the story adds no pgTAP, so it is taken as reported rather than verified.

⭐ **Reviewer-independent mutation pass** (Epic-5 retro Action Item: *"each story's review runs at
least one mutation the author did not author"*). Control pass green (1665) before, post-control green
(1665) after; files read/written as BYTES; whole-suite runner; oracle is vitest's EXIT CODE; every
restoration verified by SHA-256; no `git stash`. **R1** *(`mainSpinsChecked` forced to 0)* — killed, 5
failures. **R2** *(the award-outcome counter never advances)* — killed, 4 failures. **R3**
*(published `live_count` replaced by `entry.live.length`)* — ⛔ **SURVIVED**, 1665/1665 still green.
**R4** *(the length bound off by one)* — killed, 3 failures. R3 is the survivor that matters and is
folded into `[Review][Patch]` #2 below.

- [x] [Review][Decision] **At `k = 0` the verifier reports a positive verdict having re-derived nothing** — ⛔⛔ **THE HEADLINE, AND IT IS PROVEN, NOT ARGUED.** All three layers found it independently and a reviewer probe confirmed it empirically: `verifyCeremony` with `spin_plan: []` / `awards: []` returns `outcome: 'not_yet_revealed'`, `mainSpinsChecked: 0`, `awardOutcomesChecked: 0`, `pityDrawsChecked: 0`, `reason: undefined`. `verification_bundle_read` serves the success preface from the instant of publication (`0029`, `coalesce(…, '[]'::jsonb)`) and `page.tsx:57-66` renders the strip as soon as `read.ok`, so the window between `publish_bundle` and spin 1 is real and reachable. `VerifyStrip` renders only `VERIFY_COPY[report.outcome]`, so a skeptical viewer is told *"Hasta aquí cuadra: cada premio ya revelado sale igual al rehacerlo"* over zero re-derivations. This is the exact shape `verification.ts` warns against in its own header (*"a verification that checked nothing while looking exactly like one that checked everything"*) and it inverts the project's *"measure zeros, never narrate them"* rule. `verify.test.ts:931`'s `PARTIALS = [1, 2, 3]` deliberately starts at 1, so nothing reddens. **The fix is a copy decision, not a mechanical one** — a sixth outcome, reusing `es.verify.unavailable`, or gating the strip in `page.tsx` — and AC7's five strings were approved verbatim by Cuatro, so the call is yours. ⭐ **RESOLVED (Cuatro, 2026-08-11): GATE THE STRIP IN `page.tsx`.** When `revealed_spins === 0`, render the nothing-to-verify state instead of the strip — no new string, the approved five are untouched, and `verify.ts` does not change. ⚠ `revealedSpins` is already carried by `verification.ts:185` and currently DISCARDED by `page.tsx`; the fix is to thread it. Pairs with the `es.verify.unavailable` decision below. [lib/roulette/verify.ts:1108, app/(viewer)/ceremonia/page.tsx:57-66]
- [x] [Review][Decision] **`VIEWER_TEXT_MAX = 80` was calibrated on single award names but is applied to `' · '`-joined aggregates** — all three layers. `reveal_spin` writes `title = string_agg(a.name, ' · ' order by a.priority)` over every award the spin decided and `subtitle = string_agg(pl.display_name, ' · ')` over every winner (`0028:757-768`; the migration's own comment: *"A SPIN MAY DECIDE MORE THAN ONE AWARD"*). The bound's stated justification is *"the twelve shipped award names are 8-22 characters"* — four aggregated names is ~97 code points, three Steam display names ~102. ⚠ Worse than length: **U+200D is the emoji ZWJ**, ubiquitous in Steam display names, so one co-winner with a family emoji sends the whole subtitle to the fallback. On refusal the card renders *"Se revela en la ceremonia"* — **an already-revealed award telling the viewer it has not been revealed**, which also aggravates `deferred-work.md:369` (6.10's). Fail-closed, but the closed state lies. ⚠ Invisible on the current corpus only because 0/28 clear the floors, so `winner_count = 0` and the key is omitted anyway. **Decide the shape:** raise the bound, judge each `' · '` element separately, or exclude `subtitle`. ⭐ **RESOLVED (Cuatro, 2026-08-11): JUDGE EACH `' · '` ELEMENT.** Split on the separator and run the guard per name, refusing only when an element fails. This keeps the 80 bound meaning what it was calibrated to mean (per name, not per aggregate) and stops one emoji-ZWJ co-winner from blanking a whole subtitle. ⛔ The guard still REJECTS rather than strips — a refused element must not be silently dropped from the join, since that would misreport who won. [lib/i18n/safe-text.ts:37, lib/feed/model.ts:105-106]
- [x] [Review][Decision] **The nothing-to-verify state renders Story-5.7 coming-soon copy for live states, and `es.verify.unavailable` is wired to the wrong element** — `page.tsx:41/47/55` returns `<Placeholder body={es.placeholder.ceremony} />` for *no tournament*, *no ceremony*, *`not_published`* **and** `read_failed`. That string is *"La ceremonia llega en la próxima entrega."* (`es.ts:93`). Between `lock_ceremony` and `publish_bundle` — a window `page.tsx`'s own comment names — a live tournament tells viewers the ceremony ships in a future release; on a transport error it says the same. Meanwhile the string authored for exactly this state, `es.verify.unavailable` = *"Todavía no hay nada publicado que verificar."*, whose JSDoc reads *"Shown instead of the strip when there is no published bundle to verify yet"*, is never used for it. ⚠ Cuatro's Q4 answer was *"keep them"*, not *"use coming-soon copy for a live state"*. ⭐ **RESOLVED (Cuatro, 2026-08-11): USE `es.verify.unavailable` THERE.** Pass it as the `Placeholder` body for the ceremony-exists-but-nothing-published states (`not_published`, `read_failed`, and the k=0 gate decided above); keep `es.placeholder.ceremony` for genuinely no-tournament / no-ceremony. The string is then used for its documented purpose and stops being wired only into the hash line. [app/(viewer)/ceremonia/page.tsx:41]
- [x] [Review][Decision] **The mid-ceremony copy overstates what was verified, and `full` is discarded by the island** — AC6 requires the honest limitation in the UI. Mid-ceremony the entire Stage-1 draw block is behind `if (input.complete)`, so `weights`, `draws`, `total_weight`, `bytes_consumed` and *which award was drawn* are never re-derived — only `stage1Label` and the Stage-2/ladder outcomes are. But `es.verify.notYetRevealed` says *"cada premio ya revelado **sale igual al rehacerlo**"* (reads as full reproduction) and `es.verify.midCeremonyLimit` names **only** the hash-binding gap. The report carries `full: false` to distinguish exactly this and `VerifyStrip` renders only `report.outcome`. DECISION R is well argued in prose; the half a viewer needs never reaches the screen. ⭐ **RESOLVED (Cuatro, 2026-08-11): EXTEND `es.verify.midCeremonyLimit`.** Amend the one limitation line to name BOTH gaps — the draw itself (weights, `draws`, which award was drawn) is re-derived only at completion, AND a prefix cannot bind to the published hash. One string edit, on the line already written for this job; `es.verify.notYetRevealed` stays as approved. [lib/i18n/es.ts:234, :243-244]
- [x] [Review][Patch] At `complete`, an absent `pity` block silently skips the ENTIRE consolation verification — `if (input.complete && bundle.pity !== undefined)` has no `else`, and `pitySpins` can hold 28 entries while `bundle.pity` is `undefined`. The hash does not save it: `publish_bundle` derives `bundle_sha256` from the payload it is handed, so a document that never carried `pity` hashes correctly and reports `matched` with `pityDrawsChecked: 0`. Mirror the pool completeness boundary at `:989-998` and refuse `bundle_shape`. [lib/roulette/verify.ts:1057]
- [x] [Review][Patch] Structural coverage is trusted from the document rather than asserted — ⭐ **mutant R3 SURVIVED the whole suite**, proving `live_count` is never independently verified. Also unasserted: `spin` uniqueness (a duplicated main-spin entry is processed twice mid-ceremony, double-advancing the shelf), every `awards` entry being reached by some spin (`awardOutcomesChecked` is never compared to `bundle.awards.length`), and pool progression (`pool(n+1) === pool(n) \ live(n)`). Each doctored document verifies as `matched` today. [lib/roulette/verify.ts:942-945, :986, :1029-1039]
- [x] [Review][Patch] The length bound runs AFTER the whole string is materialised, and the doc comment claims the opposite — `const points = [...raw];` allocates one array slot per code point before `points.length > VIEWER_TEXT_MAX` is evaluated, while `:78-79` states *"the length bound stays ahead of the walk so a multi-MB string is refused in one comparison instead of being scanned."* Guard `raw.length > VIEWER_TEXT_MAX * 2` first — UTF-16 units are always ≥ code points, so it can never refuse a string the code-point bound would accept. [lib/i18n/safe-text.ts:84-85]
- [x] [Review][Patch] A refused hash renders label-plus-error as one sentence, and the guard inspects only 13 characters — `{es.verify.hashLabel} {safeViewerText(truncateHash(bundleSha256), es.verify.unavailable)}` renders `SHA-256 Todavía no hay nada publicado que verificar.` for a bundle that demonstrably IS published, in a `.num` tabular span, beside a live button that will still verify against that hash. Separately, `truncateHash` runs BEFORE the guard, so a bidi override past byte 8 is discarded before it is ever inspected — which makes the comment calling this the *"load-bearing"* application of the reject-list overstated. Suppress the label (and the button) as a unit, and guard before truncating. [app/(viewer)/ceremonia/VerifyStrip.tsx:113]
- [x] [Review][Patch] `containsNul` reports "too deeply nested" as "contains U+0000" — `if (depth > 256) return true;` shares a sentinel with the found-a-NUL path, so a deeply nested document is refused as `nul_in_document` with a detail asserting a character that is not present. `canonicalize` has a distinct typed `max_depth_exceeded` for this, and V2 pre-empts it. Two causes collapsed onto one name, on the one code path whose whole purpose is naming causes precisely. [lib/roulette/verify.ts:414]
- [x] [Review][Patch] `bundle` is the only ok-payload field whose type is never checked, and the reader's shape checks are weaker than the rest of the tree — every sibling gets `typeof`; `result.bundle` gets only `!== undefined && !== null`, so a JSON scalar or array passes and the viewer is told *"No coincide"* (the ceremony does not match itself) where the reader's own fail-closed doctrine wants `read_failed`. Also `bundle_sha256` is only checked non-empty, never `^[0-9a-f]{64}$`, and `ceremony_id`/`revealed_spins`/`total_spins` accept `NaN`, `Infinity`, fractions and negatives where the engine uses `Number.isSafeInteger`. [lib/ceremony/verification.ts:149-156]
- [x] [Review][Patch] `spin` is validated as a safe integer but not as `>= 1`, so a malformed document field is reported as an engine refusal — `intOf` accepts `0` and negatives; `stage1Label` then throws a bare `RangeError`, which lands in the `engine_refused` arm instead of `bundle_shape`, the reason that exists for exactly this. [lib/roulette/verify.ts:634, :984]
- [x] [Review][Patch] `drawOrder` is a verbatim copy of the published `live` whenever `full === false`, contradicting its own doc comment — the comment asserts *"IT IS THE RE-DERIVED ONE, NOT A COPY OF `live`"*, and that holds only on the `complete` path where `expectSame([...picked.live], [...entry.live], …)` ran. Mid-ceremony `stage1Pick` never runs, so pinning `drawOrder` asserts the document equals itself. Derive it only when `full`, or omit it. [lib/roulette/verify.ts:1040]
- [x] [Review][Patch] `checkViewerText` reports non-string input as `blank` — the closed set has five members and none means "not a string"; `blank` is defined in-module as *"nothing visible and nothing forbidden"*. `safeViewerText` masks it, but `checkViewerText` is exported and the reason is wrong for any non-string caller. [lib/i18n/safe-text.ts:82]
- [x] [Review][Patch] `disabled={busy}` drops keyboard focus for the duration of the verify — Chrome/Edge move focus to `<body>` when the focused element becomes disabled, so a keyboard or screen-reader user is returned to the top of the document with no focus on the control they just used. `role="status"` still announces the outcome. Add `aria-busy` and restore focus, or keep the button enabled and no-op while busy. [app/(viewer)/ceremonia/VerifyStrip.tsx:116]
- [x] [Review][Patch] The AC6 Proxy test asserts less than its name claims — *"never touches an unrevealed spin, an unrevealed award or the withheld pity block"*: the Proxy traps only the top-level `'pity'` key, and unrevealed spins and awards are absent from the projected document entirely, so two thirds of the name are unasserted. Also `Object.hasOwn` triggers the `getOwnPropertyDescriptor` trap, not the `has` trap the test defines, so `touched` can never contain `'has:pity'`. ⚠ This is the "coverage guards can be vacuous" pattern. [lib/roulette/verify.test.ts]
- [x] [Review][Patch] One tamper row's expected reason is fixture-order dependent — *"an award that the pool names but the document does not describe"* expects `bundle_shape`, but the `entry.live` → `byId` mapping (which throws `outcome_divergence`) runs before the `entry.pool` mapping. It passes by luck of the draw, not by construction. [lib/roulette/verify.test.ts]
- [x] [Review][Patch] The mutation table's control pass does not match the shipped suite — Completion Note 7 records *"Control pass green (1659) before, post-control green (1665) after"*; the shipped tree measures **1665**. Six tests were added after the control, so the 33-mutant table describes an earlier source/suite state. By the story's own rule that a mutant judged by an unsound oracle is not a kill, a table whose control does not match the delivered suite is weaker evidence than it reads as. Re-run or annotate. [6-9b-verificar-la-ceremonia.md]
- [x] [Review][Patch] `deferred-work.md:379`'s annotation misstates the harness and drops the mandated `, AC9` — it claims the AC3 harness traps *"`fetch`, `XMLHttpRequest`, `WebSocket`, **`navigator`**, `localStorage`, …"*, but the code deliberately EXCLUDES `navigator` (with `process` and `location`) and asserts that exclusion by name. Completion Note 8 gets this right; the durable record does not. The same bullet reads `**🟢 CLOSED by Story 6.9b (2026-08-10), …**`, dropping the `, AC9` that `:265`, `:266` and `:378` all carry. [_bmad-output/implementation-artifacts/deferred-work.md:379]
- [x] [Review][Patch] The required explicit decision on `es.provenance.seedPublished` was never recorded — Dev Notes `:498-499` demanded *"reuse it or consciously don't, but do not add a third spelling"*. No Completion Note records the call. [_bmad-output/implementation-artifacts/6-9b-verificar-la-ceremonia.md]
- [x] [Review][Patch] Two stale fixture comments — `ROSTER` is described as `[steamid64, kills, deaths, assists, headshots]` but has six columns, and the `AWARDS` header says *"Four awards … three go to `1001` and one to `1004`"* while `AWARDS` has five entries (the fifth was added so M32/M33 would die). [lib/roulette/verify.test.ts]
#### Post-review — every patch APPLIED, and the gates re-measured after them

All 20 patch findings and all four resolved decisions were applied on 2026-08-11. ⛔ Gates re-measured
after the patches, never carried over from the pre-review run:

| gate | before review | after the patches | |
|---|---|---|---|
| 1 · `npm run lint` | 0 | **0** | ✅ |
| 2 · `npx vitest run` | 1665 / 50 | **1694 / 50** (+29 tests, same files) | ✅ |
| 3 · `npm run build` | 0 | **0**, TypeScript clean, every viewer route `ƒ`, no `roulette` route | ✅ |
| 4 · Go build/vet/test | 8 packages clean | **8 packages clean** | ✅ |
| 5 · `gofmt -l ./worker` | empty | **empty** | ✅ |
| 6 · `--check` | OK ×8 | **OK ×8**, `roulette/vectors/` git-clean | ✅ |
| 8 · scope + CRLF | clean | `supabase/**`, `worker/**`, `roulette/vectors/**` **byte-untouched**; **0 CRLF** across all 17 touched files | ✅ |

⚠ **Gate 7 (pgTAP) was NOT re-run by the review** — it requires `supabase db reset`, which would
destroy local state, and neither the story nor these patches add or alter any pgTAP. It is carried
as reported, not as verified.

⭐⭐ **THE BUILD CAUGHT WHAT THE SUITE COULD NOT, EXACTLY AS THE DEV NOTES WARNED.** The first cut of
the `verification.ts` shape patch factored its numeric checks into a `(v: unknown) => boolean`
helper, which does not NARROW — so the envelope build stopped type-checking. `npx vitest run` stayed
green at 1694 through it; only `npm run build` failed. The Dev Notes' *"`npm test` does NOT
typecheck"* trap is live and was paid once here, recorded rather than smoothed over.

⭐ **THE R3 MUTANT IS NOW EQUIVALENT BY CONSTRUCTION, WHICH IS THE RIGHT OUTCOME AND NOT A MISS.**
Re-run against the patched tree it still SURVIVES (1694/1694 green, restore SHA-256 verified) — and it
must. The new guard refuses any document where `live.length !== live_count` BEFORE `stage1Pick` is
reached, so at that call site the two expressions are provably equal and substituting one for the
other cannot change behaviour. It went from *surviving because the field was never verified* to
*equivalent because it now is*. The underlying defect is killed by the tamper row **"a live_count that
disagrees with its own live array"**, which refuses with `draw_divergence`.

⚠ **One consequence named rather than buried:** the per-element text guard fixes the LENGTH half of
the aggregate problem, but a character refusal still refuses the whole joined string — dropping an
element would misreport who won, and rewriting it is the "strips rather than rejects" failure the
module forbids. **U+200D is the emoji ZWJ and is common in Steam display names**, so one co-winner
with a family-emoji name still sends the whole subtitle to the fallback. Widening the reject-list is
a story, not a commit (`deferred-work.md:265` declares it a closed set); rendering winners as separate
elements is 6.10's feed-card surface.

- [x] [Review][Defer] AC5's real-corpus invariants are asserted nowhere in the tree, and THE BAR's evidence is unverifiable by construction [lib/roulette/verify.test.ts:2825-2828] — deferred, pre-existing. `verify.test.ts` states plainly that the 22/27/49 byte split and the `aw-04,aw-12,…` order *"are NOT assertable here"*; the only record is Completion Note 11's table, produced by `worker/cmd/qa69b` + `bar-qa69b.test.ts`, both deleted by the standing convention. So the 75,013 canonical bytes, the `8b899112…` `bundle_sha256`, the 105,011 B page, the 5.5 ms median and the whole 33-mutant table are NARRATED-BUT-UNVERIFIABLE at review time. This is the accepted cost of the delete-the-harness convention rather than a defect of this story, and it already travels with AC13's four open browser bullets.

---

## Dev Notes

### ⚠ Decisions taken at contexting — read these before writing code

⛔ **These continue 6.9a's alphabet at O and are NOT a second A/B/C.** 6.9a's DECISIONS run A-N, and
this project has already paid for reused decision letters once — `deferred-work.md:337` records
migration `0025` re-using A-D with different meanings, so *"a reader arriving from the story reads the
opposite subject."* When you cite a letter, say whose.

**DECISION O — the page reads server-side; the browser does the CRYPTO.**
`/ceremonia` stays a Server Component with `export const dynamic = 'force-dynamic'`, resolves the
ceremony through the anon client, calls `verification_bundle_read` from a new **server-only** reader
`lib/ceremony/verification.ts` (the [lib/awards/read.ts](lib/awards/read.ts) shape), and passes the
envelope as props into a `'use client'` island that owns the button and runs `verify.ts` on tap.
*Why:* there is **no browser `.rpc()` anywhere in this tree** (measured: zero `.rpc(` under `app/`), the
house rule is `createSupabaseServerClient()` for viewer reads, and a server read makes the tapped
verification **pure compute** — which is what the 2 s budget should measure, not a network round-trip.
⚠ **Consequence to MEASURE, not assume:** the bundle rides down in the RSC payload, so `/ceremonia`
grows from 6.9a's measured **11,555 B** to roughly **11.5 KB + the served bundle** (75,013 canonical
bytes at completion). Report the real number in THE BAR. If it is unacceptable, the alternative is the
first browser `.rpc()` via `createSupabaseBrowserClient()` — see Questions.

**DECISION P — the seed is cross-checked, because it can be.**
`0028:501` grants anon `select (id, tournament_id, state, seed_demo_sha256, started_at, completed_at)
on public.ceremony`. That is exactly what **6.9a's DECISION B** release-schedule row 1 promises a
viewer can check — *"`seed_hex` matches `ceremony.seed_demo_sha256`"* — so **do it**, and surface a
mismatch as a refusal. It costs one column on a read you are already making.

**DECISION Q — `verify.ts` carries NO Spanish and NO React.**
The third-party import ban ([prng.test.ts:716-721](lib/roulette/prng.test.ts#L716)) asserts every
specifier `startsWith('.')`, so `verify.ts` **cannot** import `@/lib/i18n/es`. It returns typed
machine reasons; the island maps them to `es.verify.*`. This is not a style preference — an aliased
import reddens the ban.

### ⛔ 6.9a's decisions that bind you

- **DECISION B** — one document, hashed once, served as a reveal-gated projection that **subtracts**
  unrevealed spins rather than blanking them. ⛔ A `"redacted"` placeholder is a defect; if you ever
  see one, it is a bug in the projection, not something to render.
- **DECISION J** — `tie_ladder_exit_step` is **absent**, never `0`. Your comparison is
  `undefined === undefined`, not a special case.
- **DECISION K** — which AC9 debts are already closed, and why deferring them would have meant
  republishing under a live commitment.
- **DECISION H (story)** — no realtime consumer, no `NUDGE_EVENTS` change. `spin.reveal` is emitted on
  `ceremony:<id>` and consumed by nobody; ⛔ do not subscribe here (6.10's). The verify surface must be
  **fully reconstructable from a published read alone** (AD-11).
- **DECISION N** — the bundle publishes `award_id`, **never `name`**. ⛔ Do not look for `name` in the
  bundle; join the catalog if you ever need one (and you do not, for verification).
- **Question 3's answer** — the mid-ceremony prefix cannot bind to `bundle_sha256`; AC6 requires you
  to say so in the UI.
- **Question 7's answer** — 2 s on a mid-range phone. 6.9a authored it; you measure it.

### ⭐ The bundle, transcribed (not remembered)

Seven top-level keys, enforced in both directions by `publish_bundle` (`0029:936-968`):
`algo_version, seed_hex, luck, spin_plan, awards, pity, players`.

**Types are provenance-driven and are the single easiest thing to get wrong:**

| STRING (decimal) | JSON NUMBER | boolean |
|---|---|---|
| `award_id`, every `pool[]`/`live[]`/`winners[]`/`winless[]`/`reveal_order[]` element, `steamid64`, and **every `players` magnitude** (`rounds_played`, `kills`, `achievement_ts`, every `volume`/`rate`/`secondary`/`efficiency`/`h2h` value) | `spin`, `bytes_consumed`, `live_count`, `weights[]`, `total_weight`, `floor_rounds`, `floor_kills`, `priority`, `tie_ladder_exit_step`, and every `draws` field (`n`, `r`, `consumed_after`, `k`, `rejections`, `value`) | `idle_dq`, `is_shared`, `is_pity` |

⛔ **Every decimal string becomes a `bigint` via `BigInt(s)`, never `Number(s)`.** `6-5b:587` measured
what `Number`-parsing does: both sides read as 2^53, tie, and bottom out `shared` at ladder step 5.

**Keys that can be ABSENT** (and absent is not zero): `tie_ladder_exit_step`, `secondary_stat`,
`eff_num_key`, `eff_den_key`, `deciding_value`, `deciding_num`, `deciding_den`, `rounds_played`,
`kills`, `idle_dq`, and the whole `pity` object mid-ceremony. ⭐ `achievement_ts` is the **one
deliberate exception — always present**, with `"-1"` as the absent sentinel (`ABSENT_ACHIEVEMENT_TS`
= `-1n`, [ladder.ts:125](lib/roulette/ladder.ts#L125)).

⭐ **A `pity` `spin_plan` entry carries ONLY the four common fields** (`spin`, `kind`, `label`,
`bytes_consumed`) — no `pool`, no `weights`. That is not an omission: FR-28 draws the whole
consolation order from one stream. Pity spin **13** carries `bytes_consumed: 27`; spins 14-40 carry `0`.

### ⭐ The projection envelope, transcribed (`0029:1441-1638`)

`public.verification_bundle_read(p_ceremony_id bigint) returns jsonb` — `stable`, `security definer`,
`set search_path = ''`. **anon holds EXECUTE.** One parameter; ⛔ `0029:1391-1393` forbids adding another.

Refusals: `{"ok":false,"reason":"no_ceremony"|"not_published","ceremony_id":n}` — a **two-member closed
set**. Success preface, at every `k` **including 0**: `ok, ceremony_id, ceremony_state, bundle_sha256,
published_at, released_at, complete, revealed_spins, total_spins, bundle`.

- **At `ceremony_state === 'complete'`:** `bundle` is the **full document**. ⭐ This is the **only**
  moment `canonicalSha256Hex(canonicalize(bundle, { asciiOnly: true })) === bundle_sha256` may be
  asserted. ⚠ It is served from `payload` (jsonb), **not** the stored canonical bytes — RFC-8785 is
  normalising, which is what makes that safe. **Re-canonicalize; do not expect byte-preservation.**
- **Mid-ceremony:** `bundle` is `{ algo_version, seed_hex, luck, players, spin_plan, awards }` plus
  `pity` **only if at least one consolation spin is revealed** — absent entirely otherwise
  (`0029:1621-1624`: an empty-but-present `pity` would announce the phase exists).
- ⚠ **Mid-ceremony `pity.winless` is TRUNCATED to the revealed prefix and is therefore IDENTICAL to
  `pity.reveal_order`** (`0029:1580-1606`), and **`pity.bytes_consumed` is WITHHELD** until every pity
  spin is revealed. ⛔ Do not assert on either mid-flight; the full `winless` arrives only at `complete`.
- `players` is served **in full from k=0** (B3/B4). ⛔ Do not "harden" it — Stage-2 re-derivation needs it.

### ⭐ The engine API you compose (all signatures transcribed)

There is **no `lib/roulette/index.ts`** — import each module relatively.

```ts
decodeSeedHex(seedHex: string): Bytes                    // sync; ^[0-9a-f]{64}$ or TypeError
createStream(seed: Bytes, label: string): Promise<Stream>// async; per-spin, starts at counter 0
stage1Label(spin: number): string                        // 1-based, no padding
PITY_LABEL: 'inclusivcup/v1/pity'
stage1Pick(stream: Stream, input: Stage1Input): Promise<Stage1Result>   // async; MUTATES stream
resolveSpin(live, players, ladder): SpinResult           // SYNC; ladder REQUIRED; no shelf param
fr29Ladder: Ladder                                        // SYNC, zero bytes
resolvePity(input: PityInput): Promise<PityResult>       // async; MUTATES input.stream
canonicalize(value, { asciiOnly: true }): string          // sync
canonicalSha256Hex(canonical: string): Promise<string>    // async; lowercase hex
```

⛔ **`Stream` is exported but NOT constructible** — `createStream` only; `stage1Pick` guards
`stream instanceof Stream`, so a structurally-faked stream is refused.
⛔ **`resolvePity` enforces four preconditions**: structurally a stream · `typeof stream.read ===
'function'` · `stream.label === PITY_LABEL` exactly · **`stream.consumed === 0`** (a fresh stream).
⭐ **The shelf is yours.** `resolveSpin` neither reads nor writes it (A10) and `resolvePity` only reads
it (P6) — **you** accumulate `SpinResult.assigned` across the twelve spins into a
`Record<string, number>`. Nothing in the package does this, and nothing will catch you doing it wrong.

### ⛔⛔ What the W10 mutant actually is — the obvious cut is NOT the real one

AC12 mandates a `Promise.all` mutant in `verify.ts` killed by something other than `bytes_consumed`.
**Think before you cut it.** `verify.ts` opens a **fresh stream per spin**, so `Promise.all` across
spins does **not** overlap reads on one stream and will **not** trip
[prng.ts:239-244](lib/roulette/prng.ts#L239)'s reentrancy throw. What it breaks is **shelf threading**:
spin *N*'s weights are indexed by the shelf accumulated from spins 1..*N*-1, so running the spins
concurrently computes every spin's weights against an incomplete shelf. The kill therefore comes from
a **divergent drawn order / divergent `weights`**, not from a thrown error and not from `bytes_consumed`
— which is exactly why AC12 words it the way it does.
⚠ On the real corpus every main spin resolves `no_eligible_players`, so the shelf stays empty and the
mutant may well **SURVIVE against corpus data**. Kill it with a **synthetic fixture that actually puts
a trophy on a shelf**, and if you cannot, report it as a survivor with that analysis — ⛔ do not quietly
re-cut it into something easier.

### The three pins in `prng.test.ts` — the exact edits

1. **The exact-equality module list**, [prng.test.ts:677-686](lib/roulette/prng.test.ts#L677) — insert
   `'verify.ts',` after `'sweep.ts',` (alphabetical). Extend the rationale comment at `:666-676`; every
   prior story did.
2. **The import-graph pin**, [prng.test.ts:786-840](lib/roulette/prng.test.ts#L786) — add a
   `'verify.ts': [...]` row **with a house-style comment saying what its presence and absence protect**.
   The pin is over the deduplicated, sorted **set** of specifiers.
   - Also [**:848**](lib/roulette/prng.test.ts#L848) — `withImports` gains `'verify.ts'`.
   - Also ⛔ [**:860-865**](lib/roulette/prng.test.ts#L860) — *"exactly the two stream consumers import
     `./prng`"* becomes **three**. **Rewrite the test NAME and the `:851-859` comment deliberately**, not
     just the array: `verify.ts` importing `./prng` is correct and load-bearing (it needs
     `decodeSeedHex`/`createStream`). `:765-768` records this exact ritual as the house procedure.
3. **The 16-item banned-construct scan**, [prng.test.ts:871-904](lib/roulette/prng.test.ts#L871) —
   `it.each(shipped)`, so `verify.ts` enrolls **with no edit**. ⚠ Needles are raw substrings over
   comment-and-string-blanked source: `Date` matches any identifier containing it, `**` matches any
   exponent, and `parseInt`/`localeCompare`/`Intl.`/`Math.round`/`parseFloat` are banned outright.
   ⛔ If a needle fires, **change the code, not the rule** (`:885-887`).

⭐ Registering `canonical.ts` reddened exactly **2 of 210** `prng.test.ts` tests. Yours will do the same.

### "Reads its evidence" — the pattern, concretely

[canonical.test.ts:216-219](lib/roulette/canonical.test.ts#L219) is the template:

```ts
expect([...CANONICAL_REFUSALS]).toEqual(vector.refusal_reasons);   // runtime vs runtime
```

Export your closed set from `verify.ts` as a runtime `readonly [...]`/`as const` and assert it against a
runtime-derived counterpart. ⛔ A literal array copied beside the assertion is the defect this project
has now shipped **eight** times (`canonical.test.ts:213`). ⚠ Also: every `it.each(...)` needs a
non-vacuity assertion first — `it.each([])` reports **zero tests and a green run**
(`canonical.test.ts:79-84`).

### i18n and the strip — house form

- **Insert `es.verify` as a top-level sibling**, between [es.ts:205](lib/i18n/es.ts#L205) and
  `} as const;`. ⛔ **Not** under `es.awards`: [es.test.ts:52-57](lib/i18n/es.test.ts#L52) runs
  `JSON.stringify(es.awards)` and substring-scans it for `AWARD_IDENTITY_STRINGS`
  (`'Máquina de Frags'`, `'El Más Generoso'`, `'A Cuchillo'`, `'kills'`, `'deaths'`, `'skill'`) —
  **which sweeps KEY NAMES as well as values**. A sibling is outside the scan, correctly, because
  verify copy is not AD-22-scoped.
- Ordering is **surface adjacency**, not alphabetical. 2-space indent, single quotes, trailing commas,
  blank line before the group, a `/** … */` JSDoc naming the story + AC and carrying the NO-GOLD clause.
- ⛔ **Reuse `es.ceremony.seededByDemo`** ([es.ts:71](lib/i18n/es.ts#L71), `// FIXED — do not paraphrase`).
  ⚠ `es.provenance.seedPublished` (`:204`, `'semilla publicada'`) already exists and is **rendered
  nowhere** — reuse it or consciously don't, but do not add a third spelling.
- ⛔ `SHA-256` is a string in the i18n module, not an inline literal in the TSX (`es.ts:6-8` admits no
  exception).
- **Voice:** author the five strings from [EXPERIENCE.md:58-73](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L58)'s
  Do/Don't table — `"Verificar la ceremonia"`, never `"Más info sobre la equidad"`. Sentence case,
  playful and competitive, never corporate cheer.
- **Colour:** `accent-live` **does not exist as a CSS token** — it is the design-system name for
  `#2F81F7`, which in code is `var(--blue)` ([globals.css:23](app/globals.css#L23)). `--gold` is `:24`
  and is **forbidden here**. Hash ink is `var(--tm)`. There is **no solid-blue button anywhere in the
  viewer yet** — yours is the first; say so in its comment (`DESIGN.md:275` specifies the form: solid
  `accent-live` fill, dark ink, `{rounded.sm}` = `var(--r-sm)`).
- **Hash:** `truncateHash()` from `@/lib/feed/model` (browser-safe — `model.ts` has no `server-only`),
  wrapped in the **global** `num` class as a bare string: ``className={`${styles.hash} num`}``.
- **Live region:** always rendered, empty-string when idle, first child of the wrapper:
  `<div className={styles.srOnly} aria-live="polite" role="status">{… : ''}</div>`. ⚠ `srOnly` is
  **per-CSS-module and not global** — copy the 10 declarations from `feed.module.css:302` into a new
  `app/(viewer)/ceremonia/ceremonia.module.css` with a `(mirrors feed.module.css:302)` comment.
- ⚠ Replacing `<Placeholder>` orphans it and `es.placeholder.ceremony` — decide explicitly.

### TypeScript / browser traps (all still live)

- **`npm test` does NOT typecheck.** There is **no typecheck script**; only `npm run build` does.
- **`Bytes = Uint8Array<ArrayBuffer>`** is required for anything reaching WebCrypto; the default
  `ArrayBufferLike` includes `SharedArrayBuffer` and `BufferSource` rejects it. `npm test` will not
  catch it.
- **`crypto.subtle.digest` is async** ⇒ the whole verify path is a Promise. **A React component cannot
  compute it at render time** — hence the island + tap.
- **No jsdom, no RTL, no `.test.tsx` collection, nothing under `app/` is collected.**
  `vitest.config.ts:17` is `include: ['lib/**/*.test.ts']` and `environment: 'node'`. A component test
  written as `app/(viewer)/ceremonia/*.test.tsx` would be **doubly invisible**. Put your suite at
  `lib/roulette/verify.test.ts`; component behaviour is proven by **live-QA only**, which is why AC13
  is a gate.
- ⚠ **`prng.test.ts > real-seed/spin1/i255` times out at 5000 ms under full-suite load**
  (`deferred-work.md:336`, unowned) — *"`npm test` is not reliably green on this machine."* If you hit
  it, **say so; do not silently re-run until green.**
- ⛔ **No new npm package.** `lib/roulette` is banned from third-party imports outright.
- ⚠ **CRLF.** `core.autocrlf = true` and there is **no `.gitattributes`**; 6.9a's `git stash pop`
  re-checked-out 19 files as CRLF and tripped `--check`. ⛔ Do not use `git stash` around the mutation
  pass.

### ⚠ `localhost` is a SECURE CONTEXT — AC13's third refusal path needs a plan

`crypto.subtle` is `undefined` only in **non-secure contexts**, and `http://localhost` / `127.0.0.1`
**are** secure contexts by specification. So running `npm run build && npm start` and browsing to
`localhost:3000` will **never** exercise the Web-Crypto-unavailable path. To prove it in a real browser,
serve the local build over the LAN and open it as `http://<host-ip>:3000` from the phone — that is a
non-secure origin and `crypto.subtle` really is `undefined` there. ⭐ This also makes the two-session
run more realistic (a phone plus a desktop), so plan it once for both bullets.

### Mutation discipline (AC12) — the rules, verbatim in force

Control pass on unmutated source **first** (void the run unless green) · files read/written as **BYTES**
· **whole-suite runners**, never a `-run`/`-t` filter · `NOT-APPLIED` reported as an outcome distinct
from `killed` · restoration verified by **SHA-256** · the **full** per-mutation table including
survivors and your own bad mutants. ⚠ *"KILLED (build refuses to compile)"* is **not a kill**
(`6-8b:926`, and 6.9a's G1 recorded exactly that against itself).

### THE BAR — the standing shape

Rebuild the corpus from nothing through the **real** parser and the **real** RPCs
(`declare_match_format` → `RecordDemo` → `RecordParse` → `bind_match_demo` → one `approve_match` →
`curate_award_catalog` → `lock_ceremony` → `ceremony.Run`/`Persist` → `BuildCanonicalBundle` →
`publish_bundle` → 40 reveals), reproduce every standing anchor, run the story's own gate, then
**delete the throwaway harness** (by convention `worker/cmd/qa69b/`, `lib/roulette/bar-qa69b.test.ts`,
`_qa69b/`) and prove the Go gates clean **both while it is present and after removal**.
⚠ `supabase db reset` comes first — every story since 6-4a leaves the QA corpus in the DB, and the
reset is also the standing rule *after* the rebuild. ⚠ **WinNAT eats port `54322`** — elevated
`net stop winnat` / `net start winnat`; Kong can remap to host `55321` while `supabase status` still
says `54321`. ⛔ **Never change a repo file to work around either.**

⭐⭐ **The local-`NEXT_PUBLIC_*` build is not optional, and it is the step that has failed before.**
`.env.local` points at the **REMOTE** project and `NEXT_PUBLIC_*` are **inlined at build time**, so a
remote-built run renders `No pudimos cargar el evento` at ~11 KB on every page and **every grep comes
back falsely clean** (measured at 6.8a). The procedure:

1. Back up `.env.local` **outside the repo** and record its SHA-256.
2. Repoint `NEXT_PUBLIC_SUPABASE_URL` at the local Kong (`http://127.0.0.1:55321`, or `:54321` if not
   remapped — diagnose by the `ECONNREFUSED` symptom, ⛔ not by `supabase status`) and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` at the local anon key.
3. `npm run build` then `npm run start`. ⛔ `next dev` will not do — AC13 says *"over the local build"*.
4. **Print page byte sizes and a distinct-corpus-name hit count** as the non-vacuity proof. A grep over
   an empty error page proves nothing.
5. Restore `.env.local` **byte-identically** and verify by SHA.

⚠ **Your story inverts a line every prior story asserted.** Since 6.8a, every gate table has read
*"`/ceremonia` still the 5.7 `<Placeholder>`"* at ~11,545 B. **That assertion is now false by design** —
call it out explicitly in the gate table so a reviewer reads it as intended, not as a regression.
⚠ 6.9a proved AC10.2 **directly at the Data API as `anon`** rather than hoping a page rendered; if you
need to prove a grant, prefer that stronger form.

### Gates to measure (⛔ measure, never quote) — the standing eight

1. `npm run lint` → **0**
2. `npx vitest run` → tests/files, as a **delta against a measured baseline**
3. `npm run build` → **0**, every viewer route still `ƒ` dynamic, no `roulette` route, and ⭐
   `/ceremonia` **no longer** the 5.7 Placeholder (see THE BAR — this line inverts with your story)
4. `cd worker; go build ./... && go vet ./... && go test ./... -count=1` → clean
5. `gofmt -l ./worker` → **empty**
6. `python roulette/vectors/generate_vectors.py --check` → **OK ×8** + `git status roulette/vectors/`
   **empty**. ⚠ This story owes **no new vector** — gate 5 is 6.11's.
7. `supabase db reset`, then pgTAP whole suite → assertions/files with every `plan(N)` reconciling.
   ⚠ You add **no** pgTAP, so this should come back **unchanged**; report it anyway.
8. **Scope proof:** `git status` + `git diff --stat` showing `supabase/**`, `worker/**` and
   `roulette/vectors/**` are **byte-untouched**, and **`0 CRLF`** across every touched file
   (⚠ `sprint-status.yaml` is CRLF natively).

⛔ **Measure the baseline FIRST**, at HEAD, before you change anything. For orientation only, 6.9a's
last measured figures were lint 0 · Vitest **1480/46** · pgTAP **1543/30** · `--check` OK ×8 · Go 7
packages. ⚠ **The usual way to measure a Vitest baseline — `git stash push -u`, run, `git stash pop` —
is exactly what caused 6.9a's CRLF incident** (`core.autocrlf = true`, no `.gitattributes`: 19 files,
~19,000 line endings, and `--check` reported `DRIFT canonical-bundle.json`). Measure the baseline
before you start editing instead, or budget for the re-normalisation.

---

## Project Structure Notes

**New**
- `lib/roulette/verify.ts` · `lib/roulette/verify.test.ts`
- `lib/ceremony/verification.ts` (+ `.test.ts`) — the server-only anon reader for
  `verification_bundle_read`, in the `lib/awards/read.ts` shape
- `app/(viewer)/ceremonia/VerifyStrip.tsx` (the `'use client'` island) ·
  `app/(viewer)/ceremonia/ceremonia.module.css`

**Modified**
- `app/(viewer)/ceremonia/page.tsx` (the `<Placeholder>` goes) · `lib/i18n/es.ts` · `lib/i18n/es.test.ts`
- `lib/roulette/prng.test.ts` (all three pins — see the exact edits above)
- `_bmad-output/implementation-artifacts/deferred-work.md` — ⛔ **mandatory**: `:265`, `:266`, `:289`,
  `:378`, `:379` annotated CLOSED in place, plus a new append-at-the-end section for anything this
  story defers
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (⚠ CRLF natively)

**Deleted before commit** (standing convention) — `worker/cmd/qa69b/`, `lib/roulette/bar-qa69b.test.ts`,
`_qa69b/`, with the Go gates proven clean while present and after removal.

**Commit** — subject line only, no body, no trailers:
`feat(ceremony): Story 6.9b FR-27/FR-30/AD-24 the browser verifier, Verificar la ceremonia and the verify strip`

⛔ **Do not touch:** `worker/**` (nothing in this story is Go), `supabase/migrations/**` (0029 is
shipped and its commitment is immutable), `roulette/vectors/**` (no new vector is owed — gate 5 is
6.11's), `lib/roulette/canonical.ts`, `lib/ceremony/bundle.ts` (`server-only`, admin write path).

---

## References

- [6-9a-verification-bundle-and-the-published-commitment.md](6-9a-verification-bundle-and-the-published-commitment.md) — ⛔ **DECISIONS A-N, the seven answered questions, the measured Completion Notes**
- [epics.md:1154-1175](_bmad-output/planning-artifacts/epics.md#L1154) · `:110-131` (every UX-DR) · `:1177-1213` (6.10/6.11 — what is NOT yours)
- [ARCHITECTURE-SPINE.md:185-188](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L185) (AD-22) · `:195-198` (AD-24) · `:130-133` (AD-11) · `:210-223`
- [SOLUTION-DESIGN.md:431-449](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L431) (§9.5/§9.6) · `:453-471` (the Spanish table; `verify.button` at `:460`)
- [SPEC.md:72,74,87](_bmad-output/specs/spec-cs-tournament/SPEC.md#L72) · [glossary.md:24,66-70](_bmad-output/specs/spec-cs-tournament/glossary.md#L24)
- [0029_verification_bundle.sql:1441-1638](supabase/migrations/0029_verification_bundle.sql#L1441) (the projection) · [0028_reveal_gating.sql:494-502](supabase/migrations/0028_reveal_gating.sql#L494) (the anon `ceremony` grant)
- [deferred-work.md:265](_bmad-output/implementation-artifacts/deferred-work.md#L265) · `:266` · [:289](_bmad-output/implementation-artifacts/deferred-work.md#L289) · [:378](_bmad-output/implementation-artifacts/deferred-work.md#L378) · [:379](_bmad-output/implementation-artifacts/deferred-work.md#L379) — **the five open here** · `:336` (the unowned flake) · `:376` (6.9a's unmet close obligation) · `:369` (6.10's doubled card, adjacent) · `:119` (`display_name`, adjacent)
- [epic-5-retro-2026-07-28.md:96](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L96) — ⭐ Action Item #4 comes due in **this** story

---

## Questions for Cuatro

1. **DECISION O — server read, or the first browser `.rpc()`?** Contexting chose the server read (house
   pattern; the tap becomes pure compute, which is what the 2 s budget should measure). The cost is
   that the served bundle rides down in the RSC payload — `/ceremonia` grows from 11,555 B to that plus
   up to ~75 KB at completion. If you would rather keep the page small and let the island fetch on tap,
   say so before Task 3; it is a small change then and a rewrite later.
2. **The five outcome strings are yours to approve.** No planning artifact contains them. The dev will
   author matched · mismatched · unsupported-MAJOR · not-yet-revealed · Web-Crypto-unavailable in the
   `EXPERIENCE.md:58-73` voice. Do you want to see them before they land, or approve at review?
3. **The honest mid-ceremony limitation (AC6) must appear in the UI.** How blunt? The dev's default is
   one quiet line under the strip stating that a mid-ceremony check confirms revealed spins but cannot
   yet bind to the published hash — visible, not buried, not alarming.
4. **`es.placeholder.ceremony` and `<Placeholder>` become orphans.** Delete both, or leave them (other
   `es.placeholder.*` keys are already unused)? Default: leave them, and say so in Completion Notes.
5. **`deferred-work.md:378` — does the SQL half travel with it?** The verifier half (declare whether
   U+0000 is inside the bundle's alphabet, and refuse accordingly) is unambiguously 6.9b's. The other
   half — narrowing `publish_bundle`'s `when others` handler so 22P05 stops being reported as
   `payload_shape` — needs a **migration `0030`**, which no AC in this story authorises and which would
   be the first migration written after a live commitment. Default: **verifier half only**, and
   re-record the SQL half against Epic 7. Say if you want `0030` in scope instead.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), via the BMad `dev-story` workflow.

### Debug Log References

- Baseline measured at `d14adf0` BEFORE any edit (never quoted): lint **0** · Vitest **1480 / 46** ·
  build **0** · Go **8 packages** clean · gofmt **empty** · `--check` **OK ×8** with
  `roulette/vectors/` git-clean.
- Mutation harness, control + post-control passes, and the full per-mutation table: run twice, the
  first run VOIDED and re-run after its oracle was found unsound (see Completion Note 6).
- THE BAR: `worker/cmd/qa69b` + `lib/roulette/bar-qa69b.test.ts` + `_qa69b/` — all three DELETED
  before commit; Go gates proven clean while present AND after removal.

### Completion Notes List

#### 1. What shipped

`lib/roulette/verify.ts` is the browser's ceremony orchestrator — the TypeScript mirror
`worker/awards/ceremony.go:19-26` says was deliberately absent until a bundle existed to verify
against. It re-derives the ceremony from the published document alone (`decodeSeedHex` → per-spin
`createStream(seed, stage1Label(S))` → `stage1Pick` → `resolveSpin` → shelf threading →
`createStream(seed, PITY_LABEL)` → `resolvePity`) and compares every published field, then binds the
commitment by re-canonicalizing and hashing. It carries **no Spanish and no React** (DECISION Q — the
third-party import ban makes that structural, not stylistic); the `'use client'` island maps its five
typed machine outcomes to `es.verify.*`.

#### 2. ⭐ DECISION R — mid-ceremony verifies the OUTCOMES, not the DRAW, and never binds the hash

This is the story's one genuinely new design decision and it is not what the AC's first reading
suggests. The two halves of a spin separate cleanly:

- **Stage 2 + anti-sweep + the FR-29 ladder** need only a spin's LIVE awards and the roster, and a
  spin's awards are revealed WITH the spin — so every revealed outcome is fully re-derivable at every
  `k`. That is exactly what AC6 says a viewer can confirm before completion, and it is measured.
- **Stage 1's weights** are computed over the whole POOL, which names awards that have NOT been
  revealed and whose metadata the projection correctly refuses to serve (AD-22). ⛔ There is no honest
  way to re-derive the draw from a served prefix, and both dishonest ways — assuming an unrevealed
  award weighs the heaviest, or reading the published `weights` back as though they had been
  re-derived — are precisely the "the client compensates" failure AC6 forbids. So it is not attempted.
- `bundle_sha256` binds ONE document; a prefix is a DIFFERENT document (6.9a's answer to Question 3).

⚠ **I shipped this wrong first and the tests caught it.** The initial `verify.ts` built candidates
from `entry.pool` unconditionally, which made the verifier refuse a perfectly correct mid-ceremony
document for the crime of being reveal-gated. Mutant **M31** now pins the fix (14 failures when
reverted).

#### 3. ⭐ DECISION S — U+0000 is OUTSIDE the bundle's alphabet (`deferred-work.md:378`, verifier half)

The verifier walks the served document for U+0000 BEFORE canonicalizing and refuses under its own
reason `nul_in_document`, rather than inheriting `publish_bundle`'s misdiagnosis of 22P05 as
`payload_shape`. The argument is fail-closed: a bundle carrying U+0000 could never have been
published (PostgreSQL `text` cannot hold NUL), so one arriving at a browser did not come from
`publish_bundle`. ⛔ The SQL half does NOT travel with it (Cuatro's call) — re-recorded against Epic 7.

#### 4. AC6's honest limitation is in the UI, not narrated around it

`es.verify.midCeremonyLimit` renders under the strip **before** the tap as well as after — a viewer
deciding whether to trust a mid-ceremony check needs it then, not once the answer is on screen — and
disappears at `complete`, where it stops being true. Measured on the real corpus: at k=0/6/12/20 the
verifier returns `not_yet_revealed` with `hashBound=false` and the revealed-prefix counts exact.

#### 5. ⭐ UX-DR32 (reduced motion — CRITICAL), disposed of explicitly

**6.9b's affordance has no motion to reduce.** There is no wheel, no flip, no transition and no
`@keyframes` anywhere in `ceremonia.module.css`; the button swaps its label and a live region gains
text. The rule binds 6.10's wheel and flip. Satisfied by construction is a different thing from
ignored, which is why it is written down rather than left looking unaddressed.

#### 6. ⛔⛔ The mutation pass's FIRST RUN WAS VOID, and the reason is worth more than the table

The harness decided "green" with `$out -notmatch 'failed'` over vitest's prose — and this project's
own test NAMES contain `read_failed` / `write_failed`. It reported kills that had not happened and
test counts belonging to partially-collected runs. **`6-8b:926`'s rule that a mutant which does not
compile is not a kill has a sibling: a mutant judged by a broken oracle is not a kill either.** The
oracle is now vitest's exit code. Both runs are recorded; only the second is evidence.

⚠ **And the first run surfaced a real defect in MY OWN test, not in the source.** The AC3 completeness
harness stubbed `process` — and Vitest's reporter reads `process` from a timer, so the trap fired
inside the framework and the suite went INTERMITTENTLY red with an error that looked exactly like the
unowned `prng.test.ts` timeout flake (`deferred-work.md:336`). `process`, `navigator` and `location`
are now excluded BY NAME with the reason, and covered instead by a source scan that is strictly
stronger. The suite ran green four consecutive times before the pass was re-run.

#### 7. The mutation table — 33 mutants + 2 declared equivalents, 31 killed, 2 analysed survivors, 0 NOT-APPLIED

Control pass green (1659) before, post-control green (1665) after; every file read/written as BYTES;
whole-suite runners throughout; restoration verified by SHA-256 after every mutant; ⛔ no `git stash`
anywhere near it.

⚠ **CORRECTION FROM THE CODE REVIEW (2026-08-11) — THE CONTROL DOES NOT MATCH THE DELIVERED SUITE.**
The control pass ran at **1659** and the shipped tree measured **1665**: six tests were added after
the control, so the 33-mutant table below describes an EARLIER source and suite state than the one
handed to review. It is not void — the post-control at 1665 shows the tree was green on both sides —
but by this story's own rule that a mutant judged by an unsound oracle is not a kill, a table whose
control does not match the delivered suite is weaker evidence than it reads as. Recorded rather than
quietly re-run, and the review's own independent pass (below) exercised the shipped tree directly.

| id | outcome | failing tests | mutation |
|---|---|---|---|
| **M01** | **killed** | 7 | ⭐ **W10 — the sequential per-spin loop becomes `Promise.all`** |
| M02 | killed | 7 | the shelf never advances |
| M03 | killed | 7 | the shelf advances by 0 |
| M04 | killed | 12 | the spins are processed in DESCENDING order |
| M05 | killed | 1 | AC9 — the WebCrypto guard never fires |
| M06 | killed | 3 | AC8 — an unknown MAJOR is accepted |
| M07 | killed | 1 | AC8 — an unknown algorithm NAME is accepted |
| M08 | killed | 1 | DECISION S — the U+0000 guard never fires |
| M09 | killed | 1 | DECISION P — the seed cross-check never fires |
| M10 | killed | 14 | `expectSame` never reports a divergence |
| M11 | killed | 1 | the commitment comparison never fires |
| M12 | killed | 3 | `bigOf` accepts a padded/empty magnitude (`BigInt` trims) |
| M13 | killed | 1 | DECISION J — a published `0` exit step reads as "no ladder" |
| M14 | killed | 2 | an absent `rounds_played`/`kills`/`idle_dq` is tolerated |
| **M15** | **SURVIVED** | — | the pity stream position is not cross-checked — **equivalent by construction, analysed below** |
| M16 | killed | 1 | the pity spins need not name the pity stream |
| M17 | killed | 1 | the per-spin pity costs need not total the phase cost |
| M18 | killed | 5 | AC6 — the full chain runs mid-ceremony too |
| **M19** | **SURVIVED** | — | the `'tie'` arm returns `[]` — **unreachable arm, analysed below** |
| M20 | killed | 1 | a refusal is rendered as a PASS (`envelope_shape` → `matched`) |
| M21 | killed | 1 | the per-spin domain separator is unchecked |
| M22 | killed | 1 | a duplicated `award_id` is accepted |
| M23 | killed | 3 | AC9 — U+FEFF drops off the zero-width reject-list |
| M24 | killed | 2 | AC9 — the bidi range is one short (U+202E survives) |
| M25 | killed | 1 | AC9 — the length bound counts UTF-16 units, not code points |
| M26 | killed | 2 | AC9 — the C1 half of the control range is dropped |
| M27 | killed | 2 | `complete` is not cross-checked against `ceremony_state` |
| M28 | killed | 1 | an empty `bundle_sha256` is accepted as a commitment |
| M29 | killed | 2 | an unrecognised RPC refusal is passed through |
| M30 | killed | 2 | AC9 — the blank check runs BEFORE the character walk |
| M31 | killed | 14 | the live set is built from the POOL (the bug I shipped first) |
| M32 | killed | 2 | the deciding-value comparison is dropped |
| M33 | killed | 1 | only the `deciding_num` half of the pair is compared |
| E01 | SURVIVED *(declared equivalent)* | — | the NUL-walk depth bound 256 → 512 |
| E02 | SURVIVED *(declared equivalent)* | — | `mainSpinsChecked` from a re-filter rather than `ordered.length` |

⭐⭐ **THE W10 MUTANT IS THE HEADLINE, AND THE STORY'S WARNING WAS EXACTLY RIGHT.** `verify.ts` opens a
FRESH stream per spin, so `Promise.all` never trips `prng.ts:239-244`'s reentrancy throw and never
changes `bytes_consumed`. What it corrupts is **shelf threading**: spin N's weights are indexed by the
shelf from spins 1..N-1, so concurrent spins weigh every one against an incomplete shelf, and the kill
comes from a **divergent drawn order and divergent `weights`**. ⚠ On the real corpus 0 of 28 players
clear the FR-21 floors, so the shelf stays EMPTY and this mutant would have SURVIVED a corpus-only
run. `verify.test.ts`'s fixture is built for it: floors of 0, five awards whose winners **overlap**
(one player takes three) and a weight table with distinct entries, so the shelf reaches `table[2]` and
shelf damage moves real bytes.

⚠ **My first fixture got this backwards and the non-vacuity assertion caught it.** Four awards with
four DISTINCT winners grows the shelf every spin and STILL never changes a weight, because each
remaining award's provisional winner is a different player holding nothing. The overlap is the point.

⚠ **Three more of my own mistakes, recorded rather than smoothed over:** (i) `project()` in the test
`filter`ed the fixture, which returns a new array of the SAME objects — one tamper test mutated the
shared document and three later tests failed with a divergence that had nothing to do with them;
(ii) M32/M33 survived because the fixture had no `rate` award, so `deciding_num`/`deciding_den` were
never populated — a fifth award was added and both then died; (iii) `verify-copy.ts` closed its own
JSDoc early by quoting a glob containing `*` followed by `/`, and every suite importing it failed
with a syntax error.

**The two survivors, characterised rather than re-cut:**

- **M15** — `verify.ts` asserts both `drawn.bytesConsumed` and `stream.consumed` against
  `pity.bytes_consumed`. The verifier CONSTRUCTS that stream itself with `createStream` and hands it
  straight to `resolvePity`, so on the shipped path the two cannot disagree. The second assertion is
  defence-in-depth against 6.7's measured "structurally faked stream reporting an invented byte
  count", which this call path cannot reach. **EQUIVALENT BY CONSTRUCTION; kept.**
- **M19** — `resolveSpin` routes every tie through the injected ladder, which returns `winner` or
  `shared`; the vector declares `tie` as `unreachable_outcome_kinds` and both suites assert zero rows
  carry it. **UNREACHABLE ARM; kept loud** — falling through would publish an empty winners list for
  an award that TIED, which reads to a viewer as "nobody qualified".

#### 8. AC3's completeness clause (inherited from `deferred-work.md:379`) — MEASURED

The full complete-ceremony re-derivation runs with `fetch`, `XMLHttpRequest`, `WebSocket`,
`EventSource`, `localStorage`, `sessionStorage`, `indexedDB`, `document` and `window` all trapped to
THROW on any access, over a FROZEN envelope, and passes. The traps are proven to fire (a stub nobody
reaches proves nothing). ⚠ `crypto` is deliberately not trapped — WebCrypto is the capability the
verification IS, not a read it performs. **What that proved: the browser verifier needs nothing
outside the bundle**, which is SOLUTION-DESIGN:448-449's standard, so no bundle defect had to be
escalated.

#### 9. AC9 — the five inherited debts, closed in place

All five (`:265`, `:266`, `:289`, `:378`, `:379`) are annotated `🟢 CLOSED by Story 6.9b` **in place**
in `deferred-work.md`, never by ticking a box and never by deletion, and the file's existing line
numbers are unchanged (the new section appends at the end). ⚠ 6.9a's failure to do exactly this is a
recorded finding at `:376`; it is not repeated.

⚠ **The `:289` line numbers were stale and missed the site that matters.** `prng.ts:137` is a blank
line in a JSDoc and `:180` is inside a getter's JSDoc; the three real dereferences are `prng.ts:201`
(`sign`), `prng.ts:279` (`importKey`) and **`canonical.ts:390` (`digest`)** — and the digest is what
the button reaches FIRST on a complete ceremony. `webCryptoAvailable()` probes all three BY NAME
rather than inferring them from `crypto.subtle` being an object; three of the six AC9 refusal rows
exist for exactly that distinction.

⚠ **Where `:265-266` actually bites, stated plainly.** The award name does **not** reach 6.9b's own
strip — DECISION N drops `name` from the bundle and the wheel/trophy shelf are 6.10's — so the
load-bearing application is `lib/feed/model.ts`'s `award_reveal` card, where `reveal_spin` puts the
name in front of a viewer. The strip's own use is over the **SHA-256**, where a bidi override can
visually reverse a hash. The guard REJECTS rather than strips, because removing U+200E from `A<ZWJ>B`
yields `AB`, which may be a different real name.

#### 10. Questions 1-5, answered by Cuatro mid-story

1. **DECISION O — server read.** Kept. ⚠ **The page-size consequence, MEASURED not assumed:**
   `/ceremonia` served **105,011 B** from the local production build against a complete ceremony
   (6.9a measured the 5.7 placeholder at 11,555 B). The served document rides down in the RSC payload
   as predicted; the escaped JSON is larger than the 75,013 canonical bytes.
2. **The five outcome strings** — drafted, shown, and approved verbatim before landing.
3. **The AC6 limitation line** — one quiet, always-visible line under the strip (the stated default).
4. **`<Placeholder>` and `es.placeholder.ceremony`** — KEPT, and they are no longer orphans: the
   placeholder is now the honest *nothing-to-verify* state (no tournament, no ceremony, or no
   published bundle). Stated here rather than left to be rediscovered.
5. **`deferred-work.md:378`** — verifier half only; the SQL half re-recorded against Epic 7.

#### 11b. ⭐⭐ THE BAR (AC13) — THE BROWSER HALF, RUN 2026-08-11 AFTER THE CODE REVIEW

⛔ **Run against the PATCHED build, not the pre-review one** — the review changed the strip, the
`page.tsx` gate and the mid-ceremony copy, so the earlier run would not have covered them.

**How the browser half became reachable at all.** The story recorded these four bullets as needing a
device this repo cannot drive (*"no browser automation; devDependencies are `@types/*`, eslint,
typescript, vitest"*). That is true of the repo and false of the machine: **Node 24 exposes a global
`WebSocket`**, so real Chrome is drivable over the DevTools Protocol with **zero npm packages** — which
matters, because *"⛔ No new npm package"* is a hard constraint here. The driver lived in the
scratchpad, never in the tree.

**The corpus was rebuilt from nothing** through the real parser and the real RPCs. Every standing
anchor reproduced **exactly**:

| anchor | measured | expected |
|---|---|---|
| rounds (sum per match) | **204** | 204 |
| roster · distinct · snapshot rows | **28 · 28 · 28** | 28 |
| `eligible_count` | **0** | 0 |
| awards | **12** | 12 |
| `fair_seed` | **`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`** | `1b3cd678…3279c` |
| spins / `award_result` / `award_result_winner` | **40 / 40 / 28** | 40 / 40 / 28 |
| **canonical bytes** | **75,013** | **75,013** |
| determinism (built twice) | **byte-identical, same SHA** | — |

⚠ `bundle_sha256` = `83d232e82cae9b11985cb0aca67b0e1daf6f66e74bd39d472d577854ac0d86e8`, which differs
from every prior run — **correct, not a regression**: `achievement_ts` is wall-clock approval time, so
the hash moves on every rebuild while the byte LENGTH and the drawn order do not. That asymmetry is
exactly why the length is the tripwire.

**⭐⭐ THE REVIEW'S HEADLINE FIX, CONFIRMED LIVE.** At `k=0` — bundle published, zero spins revealed,
the real window between `publish_bundle` and spin 1 — `/ceremonia` served **11,801 B** carrying
*"Todavía no hay nada publicado que verificar"* and **no strip, no button, no hash**, and ⛔ **no
*"próxima entrega"*** either. Both the k=0 gate and the `es.verify.unavailable` rewiring are proven on
a real production build. Before the patch this state rendered the full strip and a button that
answered *"Hasta aquí cuadra…"* over zero re-derivations.

**The four interaction bullets:**

| bullet | verdict | measured |
|---|---|---|
| two sessions, tapped mid-ceremony AND at completion, with the rendered copy, the announced `aria-live` text and the elapsed time | ✅ **MET** | see below |
| the full bundle re-canonicalized IN THE BROWSER matching `bundle_sha256` | ✅ **MET** | *"Coincide. Tu navegador rehizo la ceremonia entera…"*, 27.7 ms |
| the three refusal paths exercised in the browser | ✅ **MET** | all three, real Spanish copy |
| **2 s on a mid-range phone** | 🟡 **PROXY ONLY** | 6× CPU throttle → **137.7 ms** median; the real device is still owed |

- **Mid-ceremony (k=6), real Chrome, real tap:** announced *"Hasta aquí cuadra: cada premio ya revelado
  sale igual al rehacerlo. El resto se comprueba cuando termine la ceremonia."* in **10 ms**. The live
  region is the **first child** with `role="status" aria-live="polite"`, empty before the tap. The
  amended limitation line renders and names **both** gaps. Page **96,550 B**.
- **At completion:** *"Coincide. Tu navegador rehizo la ceremonia entera y salió exactamente lo mismo
  que se publicó."* in **27.7 ms**; the limitation line correctly **disappears**. Page **105,051 B**
  (6.9a measured the 5.7 placeholder at 11,555 B).
- **Two concurrent sessions** over the same ceremony agreed on both outcome and hash (`83d232e8…86e8`).
  ⭐ **Epic-5 retro Action Item #4 (two-session real-browser live-QA) COMES DUE AND IS MET HERE.**
- ⭐ **Focus is not dropped.** `focusStillOnButton: true` after every tap — the review's `aria-busy`
  fix measured in a real browser, which is the only place the old `disabled` behaviour was visible.
- **The three refusals, against the REAL served document:** unknown MAJOR → *"Esta ceremonia se corrió
  con una versión del algoritmo que esta página no sabe rehacer."*; a tampered player magnitude →
  *"No coincide. Lo que se publicó no es lo que sale al rehacerlo aquí."*; and **`crypto.subtle`
  absent over the LAN origin `http://192.168.0.253:3000`** (`isSecureContext: false`,
  `typeof crypto.subtle === 'undefined'`) → *"Tu navegador no expone Web Crypto en esta dirección…"*
  — ⭐ **a TYPED refusal, not a `TypeError`**, which is precisely what `deferred-work.md:289` asked for
  and the one path `localhost` can never exercise. The document was restored and the hash re-bound
  after each tamper.

⭐⭐ **AN UNPLANNED CONFIRMATION WORTH RECORDING: `assert_bundle_immutable` REFUSED EVERY TAMPER.** The
first attempt to doctor the published payload was rejected by the trigger — *"is a PUBLISHED COMMITMENT
and is immutable (AD-22)"*. The refusal paths could only be exercised by disabling that trigger to
simulate a compromised store, which is the threat model the verifier exists for; it was re-armed
afterwards and **re-verified as refusing**. AD-22 is load-bearing in fact, not only in principle.

**⚠ The phone budget, stated honestly.** A CPU-throttled desktop is **not** a mid-range phone, and this
is recorded as a proxy rather than banked as met (Cuatro's call). Median of three runs at completion —
the full chain including the hash bind:

| CPU throttle | median | vs the 2 s budget |
|---|---|---|
| 1× | 11.7 ms | pass |
| 4× | 77.6 ms | pass |
| **6×** | **137.7 ms** | **pass, ~14× headroom** |
| 10× | 336.3 ms | pass |
| 20× | 1,725.8 ms | pass (one run of three hit 2,161 ms) |

A mid-range phone is commonly modelled at 4–6× desktop, where this lands at 78–138 ms. The budget
looks comfortably met, but **the real-device number is still owed**.

⭐ **RESOLUTION (Cuatro, 2026-08-11): the proxy is ACCEPTED and the story closes on it.** ⛔ Recorded as
a substitution rather than a measurement — no physical device was ever used, and this note exists so
nobody later reads *"AC13 met"* as *"a phone was timed"*. The real-device measurement is **re-homed to
6.10's live-QA** (which ships the wheel and the `prefers-reduced-motion` parity and therefore needs a
physical phone regardless) and remains open in `deferred-work.md`. ⚠ If it ever comes back over 2 s on
real hardware, the finding belongs to FR-27's budget, not to 6.10 — the compute being timed is
`verify.ts`, which this story owns.

**Gate 7, finally closed.** `supabase db reset` then the whole pgTAP suite: **1543 / 30, `Result: PASS`
— UNCHANGED**, exactly as reported. The review could not run it earlier without destroying local state.

**Teardown:** `worker/cmd/qa69b/`, `lib/roulette/bar-qa69b.test.ts` and `_qa69b/` all DELETED; Go gates
proven clean **while present and after removal**; the QA `qa69b_backup` table dropped; `supabase db
reset` run again so the corpus is not left behind; `git status` clean. ⚠ **`.env.local` was NEVER
EDITED** — the shell env beat it, and its SHA-256 is byte-identical before and after
(`BDE1461F…21CC`).

#### 12. `es.provenance.seedPublished` — the decision the Dev Notes required, recorded (added at code review)

Dev Notes `:498-499` demanded this be disposed of explicitly — *"reuse it or consciously don't, but do
not add a third spelling"* — and no Completion Note carried it. **DECIDED: consciously NOT reused.**
`es.provenance.seedPublished` (`'semilla publicada'`) is a fragment, not a sentence, and the strip's
provenance slot is already filled by the FIXED `es.ceremony.seededByDemo` (*"Sembrado por el demo
final · reproducible"*), which AC7 mandates verbatim. Using both would put two provenance claims in
one strip; using `seedPublished` instead would paraphrase a `// FIXED` string. ⛔ **No third spelling
was added** — that is the part of the instruction that actually binds — and `seedPublished` stays
rendered nowhere, exactly as 6.9b found it.

#### 11. ⛔ THE BAR (AC13) — PARTIAL, and exactly which part

**The corpus was rebuilt from nothing** through the real parser and the real RPCs
(`declare_match_format` → `RecordDemo` → `RecordParse` → `bind_match_demo` → one `approve_match` →
`curate_award_catalog` → `lock_ceremony` → `ceremony.Run`/`Persist` → `BuildCanonicalBundle` →
`publish_bundle` → 40 reveals). **Every standing anchor reproduced exactly:**

| anchor | measured | expected |
|---|---|---|
| rounds (sum per match) | **204** | 204 |
| roster · distinct · snapshot rows | **28 · 28 · 28** | 28 |
| `eligible_count` | **0** | 0 |
| awards | **12** | 12 |
| `fair_seed` | **`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`** | `1b3cd678…3279c` |
| spins / `award_result` / `award_result_winner` | **40 / 40 / 28** | 40 / 40 / 28 |
| **canonical bytes** | **75,013** | **75,013** |
| determinism (built twice) | **byte-identical, same SHA** | — |

⚠ `bundle_sha256` = `8b899112763d8c54d3ce56e2f0f5417363906f928314a85161b2cbd56fee9cfa`, which DIFFERS
from 6.9a's — and that is CORRECT, not a regression: `achievement_ts` is wall-clock approval time, so
the hash differs on every rebuild while the byte LENGTH and the drawn order do not. That asymmetry is
exactly why the length is the tripwire.

**AC5's real-corpus invariants, re-derived by the shipped `verify.ts` (not copied from the document):**

- outcome **`matched`**, commitment **bound**, 12 main spins / 12 award outcomes / 27 pity draws
- drawn order **`4,12,8,9,5,10,2,3,7,6,1,11`** — character-for-character
- main-spin bytes **22 total** (per spin 2 and 1) · pity **27** · **whole ceremony 49**
- ⚠ **"main-spin 22 bytes" is the TOTAL across the twelve spins, not a per-spin figure.** My first
  assertion read it as per-spin and failed. `uniformInt` reads `minimalK(n)` bytes, so a 12-candidate
  pool needs 2 and the later smaller pools need 1.

**Served from a local-`NEXT_PUBLIC_*` production build** (`npm run build && npm run start`, shell env
beating `.env.local`, which was backed up outside the repo and verified **byte-identical** afterwards
by SHA-256 — it was never edited):

| route | bytes | distinct corpus names | markers |
|---|---|---|---|
| `/` | 66,893 | 27 | — |
| `/bracket` | 34,887 | 27 | — |
| `/leaderboards` | 67,102 | 27 | `seededByDemo` |
| **`/ceremonia`** | **105,011** | 0 | **`Verificar la ceremonia`, `SHA-256`, `seededByDemo`, NO placeholder** |

⭐ **`/ceremonia` IS NO LONGER THE 5.7 `<Placeholder>`, AND THAT INVERTS A LINE EVERY GATE TABLE SINCE
6.8a HAS ASSERTED.** It is by design, not a regression. The rendered strip carries the always-present
`aria-live="polite" role="status"` region as its FIRST child, the shield, the FIXED
`Sembrado por el demo final · reproducible`, `SHA-256 8b899112…9cfa` in `.hash num`, and
`<button type="button">Verificar la ceremonia</button>`.

**The refusal paths, exercised against the REAL document:** unknown MAJOR → `unsupported_algo_version`
/ `algo_version_unsupported_major`; a single tampered digit on one player's `rounds_played` →
`mismatched` / `hash_divergence`.

⛔⛔ **WHAT IS NOT MET, NAMED PRECISELY.** The four INTERACTION bullets need a real browser and a
physical phone, and this repo has no browser automation (devDependencies are `@types/*`, eslint,
typescript, vitest). **Outstanding:** the two-session run with the rendered result copy and the
announced `aria-live` text; the browser-side re-canonicalization at completion; the
`crypto.subtle`-absent path over a **LAN origin** (⚠ `localhost` IS a secure context — it cannot be
reproduced on the dev server); and **the 2 s budget on a mid-range phone**. The pure-compute median
measured **5.5 ms** across five runs on this desktop — a LOWER BOUND, and explicitly **not** the
number AC13 asks for. Cuatro asked for and approved this split mid-story. Recorded as an open item at
the end of `deferred-work.md`, and **Epic-5 retro Action Item #4 therefore does NOT come due here** —
it moves with those bullets.

⚠ **Two harness bugs worth recording, both mine, both found only by running it:** `approve_match`
returned `wrong_demo` because I seated competitors round-robin instead of pairing each match with its
OWN demo's two players (guard 2c: "if the demo is between other people, the seat mapping has no
answer"); and `stat_snapshot` has no `row_count`/`eligible_count` columns — they are values
`lock_ceremony` REPORTS.

#### 12. Gates — MEASURED, never quoted

⛔ The baseline was measured at `d14adf0` **before any edit**, not read out of 6.9a's table or
`sprint-status.yaml`. `6.7` quoted `1318/42` when the real figure was `1322/42`; baselines are
measured, never quoted. ⚠ The usual `git stash push -u` route is what caused 6.9a's CRLF incident, so
it was not used anywhere in this story.

| gate | baseline (`d14adf0`) | after 6.9b | verdict |
|---|---|---|---|
| 1 · `npm run lint` | 0 | **0** | ✅ |
| 2 · `npx vitest run` | 1480 / 46 | **1665 / 50** (+185 tests, +4 files) | ✅ |
| 3 · `npm run build` | 0 | **0**, every viewer route still `ƒ`, **no `roulette` route** | ✅ |
| 3b · `/ceremonia` | the 5.7 Placeholder | ⭐ **no longer the Placeholder — this line INVERTS by design** | ✅ |
| 4 · Go build/vet/test | 8 packages clean | **8 packages clean** (and clean with the harness present) | ✅ |
| 5 · `gofmt -l ./worker` | empty | **empty** | ✅ |
| 6 · `--check` | OK ×8, vectors git-clean | **OK ×8**, `git status roulette/vectors/` **empty** | ✅ |
| 7 · pgTAP (after `db reset`) | — | **1543 / 30 — UNCHANGED**, `Result: PASS` (this story adds no pgTAP) | ✅ |
| 8 · scope proof | — | `supabase/**`, `worker/**`, `roulette/vectors/**` **byte-untouched**; **0 CRLF** across every touched file | ✅ |

⚠ **On CRLF:** every file this story authored or edited is **CRLF=0**. `sprint-status.yaml` is
**CRLF=312 / LF=0** and was CRLF natively — that is preserved, not introduced. The large diffs on the
story file and `sprint-status.yaml` are the CONTEXTING session's uncommitted changes plus this
story's, not line-ending noise: `git diff --numstat --ignore-cr-at-eol` returns identical counts.

⚠ **This story adds NO vector** — gate 5 (the end-to-end vector) is 6.11's, and `roulette/vectors/` is
byte-untouched.

### File List

**New**
- `lib/roulette/verify.ts` — the browser ceremony orchestrator (AC5/AC6/AC8/AC9)
- `lib/roulette/verify.test.ts` — the engine-produced fixture, the tamper matrix, AC3's completeness harness
- `lib/ceremony/verification.ts` — the `server-only` anon reader for `verification_bundle_read` + the DECISION-P ceremony read
- `lib/ceremony/verification.test.ts`
- `lib/i18n/safe-text.ts` — the viewer-surface reject-list + length bound (AC9, `deferred-work.md:265-266`)
- `lib/i18n/safe-text.test.ts`
- `lib/i18n/verify-copy.ts` — the outcome → Spanish map, in `lib/` so Vitest can gate its exhaustiveness
- `lib/i18n/verify-copy.test.ts`
- `app/(viewer)/ceremonia/VerifyStrip.tsx` — the `'use client'` island
- `app/(viewer)/ceremonia/ceremonia.module.css`

**Modified**
- `app/(viewer)/ceremonia/page.tsx` — the Server Component read; `<Placeholder>` becomes the nothing-to-verify state
- `lib/i18n/es.ts` — the new top-level `es.verify` sibling
- `lib/i18n/es.test.ts` — the placement/scan/voice assertions
- `lib/feed/model.ts` — `safeViewerText` over the `award_reveal` title/subtitle
- `lib/roulette/prng.test.ts` — the three pins (module list, import graph, the rewritten stream-reacher split)
- `_bmad-output/implementation-artifacts/deferred-work.md` — five debts CLOSED in place + a new section at the end
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-9b-verificar-la-ceremonia.md`

**Deleted before commit** (standing convention; Go gates proven clean while present and after removal)
- `worker/cmd/qa69b/`, `lib/roulette/bar-qa69b.test.ts`, `_qa69b/`

**⛔ Byte-untouched, as required:** `supabase/**`, `worker/**`, `roulette/vectors/**`,
`lib/roulette/canonical.ts`, `lib/ceremony/bundle.ts`.

### Change Log

| date | change |
|---|---|
| 2026-08-10 | Story 6.9b implemented: `lib/roulette/verify.ts`, `lib/ceremony/verification.ts`, `lib/i18n/safe-text.ts`, `lib/i18n/verify-copy.ts`, the `/ceremonia` verify strip and `es.verify`. |
| 2026-08-10 | AC9 — five inherited debts (`:265`, `:266`, `:289`, `:378`, `:379`) annotated CLOSED in place in `deferred-work.md`. |
| 2026-08-10 | AC12 — mutation pass: 33 mutants + 2 declared equivalents, 31 killed, 2 analysed survivors, 0 NOT-APPLIED. First run VOIDED for an unsound oracle and re-run. |
| 2026-08-10 | AC13 — corpus rebuilt through the real parser and RPCs; every standing anchor reproduced including 75,013 canonical bytes and the `4,12,8,9,5,10,2,3,7,6,1,11` drawn order. The four browser-interaction bullets remain OPEN (Cuatro's call, recorded in `deferred-work.md`). |
| 2026-08-10 | Gates measured against a freshly measured baseline: lint 0 · Vitest 1665/50 · build 0 · Go clean · gofmt empty · `--check` OK ×8 · pgTAP 1543/30 unchanged · scope byte-untouched · 0 CRLF. |
