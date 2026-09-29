---
baseline_commit: eed53186406902dee553b942a6eb3ed775dc483f
---

# Story 6.3: PRNG core (HMAC-SHA256 counter-mode)

Status: done

> **This is the first story in the project with no SQL.** No migration, no RPC, no RLS, no pgTAP file.
> It builds the two halves of the cross-language seam — the Go **producer** primitive (`worker/awards`)
> and the browser **verifier** primitive (`lib/roulette`) — plus the shared golden vectors that are the
> only thing standing between them and eight stories of undetected divergence.

Epic: 6 — Awards Roulette — Producer & Verifier (CAP-6) · **third story of the epic**
Traces: **FR-25** · **AD-14** · SPEC Constraint 7 (integer-only, client-reproducible) · SM-3
Consumes: `tournament.fair_seed` (frozen by 6.2, `seed_hex`) — read-only, this story writes nothing to the database
Hands to: 6.4 (Stage-1 weighted pick, Stage-2), 6.6 (luck-meter), 6.7 (pity stream), 6.9 (bundle), 6.11 (vector suite)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform,
I want a deterministic integer-only PRNG keyed by the seed,
so that the Go producer and the JS verifier consume identical bytes for every decision.

## Acceptance Criteria

**AC1 — the block function and its domain-separated labels are exact, in both runtimes.**
**Given** the PRNG rule (AD-14, `ARCHITECTURE-SPINE.md:216`; FR-25, `prd.md:354-361`; SOLUTION-DESIGN §9.1),
**When** a decision draws randomness,
**Then** `block_i(label) = HMAC_SHA256(key = seed (raw 32 bytes), msg = utf8(label) || LE64(i))` — the key is the **raw 32 decoded bytes**, never the 64-char hex string; `LE64` is an 8-byte **little-endian** counter starting at `i = 0` and is the **only** little-endian construct in the whole engine; blocks are 32 bytes consumed **left-to-right**; and the labels are the exact per-decision domain separators `inclusivcup/v1/stage1/spin/<S>` (S 1-based decimal, no padding) and `inclusivcup/v1/pity`, each stream independent and starting at counter 0.

**AC2 — `uniform_int` is unbiased and both runtimes reject on identical thresholds, consuming identical bytes.**
**Given** the unbiased-draw rule (AD-14, `ARCHITECTURE-SPINE.md:217`),
**When** `uniform_int(stream, n)` is drawn,
**Then** it takes the minimal `k` with `256^k ≥ n`, assembles those `k` bytes **big-endian** into `x`, rejects while `x ≥ limit` where `limit = 256^k − (256^k mod n)`, and returns `x mod n` — and a rejection **consumes** its `k` bytes and draws `k` fresh ones, so the two runtimes are byte-position-identical after every draw, including draws that straddle a 32-byte block boundary.

**AC3 — integer-only, locale-free, in both languages.**
**Given** the integer-only constraint (AD-14; SPEC Constraint 7),
**When** any decision arithmetic runs,
**Then** it uses integers only — no `float`/`number`-with-fraction anywhere in the draw path, no `Math.random`, no `Date`, no locale-dependent formatting or comparison (`toLocaleString`, `localeCompare`, `strings.Title`, collation-dependent sorts), and no language-specific RNG (`math/rand`, `Math.random`, `node:crypto.randomInt`).

**AC4 — the two implementations are proven to agree by a shared, externally-anchored artifact — not by inspection.**
**Given** AD-14's *"a cross-language golden-vector suite (`roulette/vectors/`) gates the build"* and the project doctrine *measure, never narrate*,
**When** the build runs,
**Then** `roulette/vectors/` holds language-neutral golden JSON for the block function and for `uniform_int` (including at least one **real rejection**, at least one **block-boundary straddle**, and the `k`-boundary cases), **both** the Go suite and the Vitest suite read **those same files** and pass every case, and at least one block case is anchored against a **third, independent HMAC implementation** (not Go's and not the browser's) so the vector proves conformance to the spec rather than mutual agreement of two possibly-identical mistakes.

**AC5 — the primitives are exercised over the real frozen seed, not a synthetic one.**
**Given** the project's THE BAR discipline (every prior story proved itself over the real seam),
**When** the story is signed off,
**Then** both runtimes are driven over the **real** `tournament.fair_seed` frozen by 6.2 (`1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c`) across the labels the ceremony will actually use, their outputs are compared **byte-for-byte**, and the comparison is **printed and recorded in Completion Notes** — a pass is a measured number, not a claim.

## Tasks / Subtasks

> **Order matters.** Task 0 (read) → Task 1 (pin the edge semantics) → Task 2 (vectors seam) → Task 3 (Go) →
> Task 4 (JS) → **Task 5 (cross-language BAR) gates sign-off** → Task 6 (mutation) → Task 7 (gates).
> Build Go first and JS second — or the reverse — but **write the vectors before the second implementation**
> so the second one is written *against a fixed artifact*, not against the first one's source.

- [x] **Task 0 — Read before you write (30 minutes that prevent the whole failure class)**
  - [x] [SOLUTION-DESIGN.md §9.1 + §9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L393) — the byte-level spec and the build-order it prescribes (primitives first, gates 1–2).
  - [x] [ARCHITECTURE-SPINE.md:145-148 (AD-14)](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145) and `:215-217` (the Provably-Fair contract surface).
  - [x] [lib/bracket/generate.ts:1-60](lib/bracket/generate.ts#L1) — the house shape for a **pure, injectable, exhaustively-testable** decision module. Mirror the shape; **do not** mirror its randomness source (`node:crypto.randomInt` is OS entropy for the *bracket* draw — AD-13 keeps the two seeds structurally distinct, and this story must never touch `bracket_seed` or `randomInt`).
  - [x] [lib/steam/nonce.ts](lib/steam/nonce.ts) — the only existing HMAC in the repo (`node:crypto.createHmac`). It is **server-only** and stays that way; `lib/roulette` must **not** copy it (see DECISION B).
  - [x] [worker/ingest/parse.go](worker/ingest/parse.go) + [worker/ingest/validate.go](worker/ingest/validate.go) — the Go house style for a pure function + its table-driven test.
  - [x] Sweep-prove the greenfield claim before writing a line: `worker/awards/` and `lib/roulette/` and `roulette/vectors/` **do not exist**; nothing in the repo implements HMAC-counter-mode, `uniform_int`, or a weighted pick. Record the sweep. (Confirmed at contexting — re-confirm, do not assume.)

- [x] **Task 1 — Pin the four edge semantics IN CODE COMMENTS before implementing (AC: 1, 2, 3)**
  > Every one of these is a place where two honest implementers reading the same spec sentence land on different bytes. Each gets a golden-vector case in Task 2 and a named comment at its implementation site.
  - [x] **E1 — `n = 1` consumes ZERO bytes.** Minimal `k` with `256^k ≥ 1` is `k = 0`: no bytes are read, the result is `0`. (DECISION A — see Dev Notes. A degenerate choice consumes no entropy, which is also the semantically right answer for a one-candidate weighted pick.)
  - [x] **E2 — `n` is bounded `1 ≤ n ≤ 2^32`.** Out-of-range `n` (including `0`, negative, and non-integer) is a **programmer error**: Go returns an `error` / JS throws. It is never a silent clamp and never a typed business refusal — no user input reaches this function. (DECISION C.)
  - [x] **E3 — reads straddle block boundaries.** The stream is a **byte** stream over the concatenation `block_0 || block_1 || …`; a `k`-byte read that begins at byte 31 takes byte 31 of block 0 and byte 0 of block 1. Rejected draws consume their bytes and are never "put back".
  - [x] **E4 — the seed key is exactly 32 bytes.** Decoding accepts **only** 64 lowercase hex chars (`^[0-9a-f]{64}$` — the same shape 6.2's `tournament_fair_seed_hex` CHECK enforces at the database). Uppercase hex, a `0x` prefix, whitespace, or any other length is an error, not a best-effort decode. A 31-byte key silently produces a perfectly valid-looking, completely different stream.

- [x] **Task 2 — The `roulette/vectors/` seam and the two primitive vectors (AC: 4)**
  - [x] Create `roulette/vectors/README.md`: what a vector file is, the exact JSON schema, the **integer-only / hex-string** rule (no floats, no big integers as JSON numbers), how each runtime loads them, and an explicit ownership line — *6.3 owns `prng-block.json` and `prng-uniform-int.json`; the weighted-pick, canonicalization/`bundle_sha256` and end-to-end ceremony vectors are **6.11's** (SOLUTION-DESIGN §9.6 gates 3–5).*
  - [x] `roulette/vectors/prng-block.json` — cases of the shape:
        `{ "name", "seed_hex", "label", "i", "msg_hex", "block_hex" }`.
        ⭐ `msg_hex` is the **exact HMAC message** (`utf8(label) || LE64(i)`) and both implementations must assert they construct it — that makes the `label || LE64` construction directly testable instead of hiding inside the digest. Cover: `i = 0`; `i = 1` (the counter really advances); both real labels; `stage1/spin/1` and `stage1/spin/12` (the decimal formatting, no padding); and the real 6.2 seed.
  - [x] `roulette/vectors/prng-uniform-int.json` — a **sequence** shape, because a single draw cannot test stream continuity:
        `{ "name", "seed_hex", "label", "draws": [ { "n", "result", "bytes_consumed_after" } ] }`
        where `bytes_consumed_after` is the stream's cumulative byte position after that draw. Mandatory cases:
        - a plain accept (`n = 6`, `k = 1`);
        - ⭐ **a real rejection** — pick `n` with a large `256^k mod n` so a rejection is likely and *search* the label/counter space until you have one; `n = 200` rejects `x ∈ [200, 255]`, i.e. 56/256 ≈ 22% per byte, so it appears within the first few draws. Prove it is a rejection by `bytes_consumed_after − previous > k`. **Record the search** in Completion Notes (which label, how many draws) — do not hand-write the expected numbers;
        - ⭐ **a block-boundary straddle** — enough draws to push the cumulative position past 32 and past 64, so `i` advances to 1 and 2;
        - **E1**: `n = 1` → `result = 0`, `bytes_consumed_after` unchanged;
        - **the `k` boundaries**: `n = 256` (`k = 1`, `limit = 256`, can never reject) and `n = 257` (`k = 2`);
        - `n = 2^32` (`k = 4`, the E2 upper bound, accepted) — the rejected `n = 2^32 + 1` / `n = 0` cases are **runtime-error assertions in each suite**, not vector rows.
  - [x] ⭐ **Anchor the vector outside both implementations (AC4).** At least one `prng-block.json` case must have its `block_hex` independently reproduced by a third HMAC — e.g. `openssl dgst -sha256 -mac HMAC -macopt hexkey:<seed_hex>` over the `msg_hex` bytes, or a three-line Python `hmac`/`hashlib` snippet. **Paste the command and its output verbatim into Completion Notes.** Without this, a vector generated from implementation A only proves implementation B copies A — it proves nothing about the spec.
  - [x] Vectors are **data, not code**: no comments-as-keys, no trailing commas, LF newlines, 2-space indent, and a stable key order so a diff is readable.

- [x] **Task 3 — Go producer primitives: `worker/awards/` (AC: 1, 2, 3, 4)**
  - [x] `worker/awards/labels.go` — `Stage1Label(spin int) (string, error)` and the `PityLabel` constant. `spin` must be a positive integer (1-based); format with `strconv.Itoa`, never `fmt.Sprintf` with a width/flag and never anything locale-aware. Package doc comment states the seam: *this package is the roulette **producer**; it conforms to `roulette/vectors/`, never to `lib/roulette`* (SPINE:73-76).
  - [x] `worker/awards/prng.go`:
        - `DecodeSeed(seedHex string) ([32]byte, error)` — E4.
        - `NewStream(seed [32]byte, label string) *Stream` — counter starts at 0, block cache empty.
        - `(*Stream) Read(k int) ([]byte, error)` (or an internal `nextByte`) — materializes `block_i` on demand via `crypto/hmac` + `crypto/sha256`, consumes left-to-right, straddles block boundaries (E3).
        - `(*Stream) Consumed() uint64` — the cumulative byte position. ⭐ **This exists so "identical byte consumption" is *testable*.** It is not decorative; without it AC2 cannot be asserted at all.
        - `UniformInt(s *Stream, n uint64) (uint64, error)` — E1, E2, minimal-`k`, big-endian assembly, `limit` rejection.
  - [x] `worker/awards/prng_test.go` + `labels_test.go` — table-driven, and the conformance test **loads `../../roulette/vectors/*.json`** (Go tests run with cwd = package dir). Do **not** duplicate the vector values as Go literals; a hard-coded copy drifts silently the day the vector is regenerated.
  - [x] Non-negotiables: **no `math/rand`** anywhere in the package (assert it in the test by scanning the package source, as 6.1's `server-only` pinning test taught — an import that only *should* be absent needs a test, because deleting it reddens nothing). No `float64`. No `time`. No `fmt.Sprintf("%v")` over a number in the decision path.
  - [x] `worker/awards` must import **nothing** from `worker/ingest`, `worker/store` or `worker/db` — it is a leaf. The producer wiring (which reads the snapshot and writes results) is 6.4+; this story ships the primitive and its tests only.

- [x] **Task 4 — JS verifier primitives: `lib/roulette/` (AC: 1, 2, 3, 4)**
  - [x] ⛔ **`lib/roulette/*` must NOT carry `import 'server-only'`** — it is the first client-reachable module in `lib/`, and every prior `lib/**` module is server-only. `server-only` throws in a client bundle: adding it out of habit breaks *"Verificar la ceremonia"* in 6.9 and the failure will not appear until then. See DECISION D. Ship a **pinning test** that reads the source files and asserts the string `server-only` is absent (the Vitest alias stubs the module, so a plain import test proves nothing).
  - [x] ⛔ **Use `crypto.subtle`, never `node:crypto`.** `lib/steam/nonce.ts`'s `createHmac` is the wrong model here: `node:crypto` does not exist in a browser, and — worse — a test that exercises `createHmac` while the browser runs SubtleCrypto is testing a *different implementation than the one that ships*. Node ≥ 20 exposes the same global `crypto.subtle` under Vitest's `node` environment, so one code path serves both. See DECISION B.
  - [x] `lib/roulette/labels.ts` — mirror of `labels.go`, same names in camelCase (`stage1Label`, `PITY_LABEL`), same validation, `String(spin)` (never `toLocaleString`).
  - [x] `lib/roulette/prng.ts`:
        - `decodeSeedHex(seedHex: string): Uint8Array` — E4, throws on anything else.
        - `async function createStream(seed: Uint8Array, label: string): Promise<Stream>` — imports the HMAC key **once** via `crypto.subtle.importKey('raw', seed, {name:'HMAC', hash:'SHA-256'}, false, ['sign'])` and holds the `CryptoKey`; re-importing per block is correct but wasteful.
        - `Stream` with `async read(k: number): Promise<Uint8Array>` and a synchronous `consumed` getter. **The API is async by construction** (SubtleCrypto is Promise-based) — do not fake sync with a pre-materialized buffer of guessed length; 6.4/6.6/6.7 will `await` it.
        - `async function uniformInt(stream: Stream, n: number): Promise<number>` — E1, E2.
        - LE64: `new DataView(buf).setBigUint64(0, BigInt(i), true)` — exact, and the `true` is the little-endian flag (the only one in the engine).
        - Big-endian assembly: accumulate into a **`BigInt`**, compare against a `BigInt` `limit`, and return `Number(x % BigInt(n))`. With `n ≤ 2^32` the result is always a safe integer; the BigInt keeps the *assembly* exact regardless. Never `parseInt`, never `**` on floats, never bit-shifts (`<<` is 32-bit and would silently corrupt `k = 4`).
  - [x] `lib/roulette/prng.test.ts` + `labels.test.ts` — colocated under `lib/**` or **Vitest does not run them** ([vitest.config.ts:17](vitest.config.ts#L17)). Load the vectors with `readFileSync` from the repo root (`npm test` runs with cwd = repo root). Same rule as Go: read the file, never re-type the values.
  - [x] Non-negotiables: no `Math.random`, no `Date`, no `toLocaleString`/`localeCompare`, no `node:` import of any kind in `lib/roulette/**`. Pin each by source scan in the pinning test.

- [x] **Task 5 — ⛔ THE BAR: the two runtimes, the real seed, byte-for-byte (AC: 5) — this gates sign-off**
  - [x] Drive **both** implementations over the real frozen seed `1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c` (6.2's measured `tournament.fair_seed`, byte-identical to `demo.demo_sha256` of `ziivanto-sosa.dem`) across every label the ceremony will use — `inclusivcup/v1/stage1/spin/1` … `/12` and `inclusivcup/v1/pity`.
  - [x] For each label print: `block_0` and `block_1` hex; the first 40 successive `uniformInt(n = 200)` draws with the running `consumed` counter; the first 12 draws at `n = 12`; and the E1/`n = 1` no-op.
  - [x] **Diff the two outputs mechanically** (write both to files and compare) — not by eye. Record the comparison result and a representative excerpt in Completion Notes. A mismatch is the story's headline finding, not a footnote.
  - [x] Harness convention: a throwaway `worker/cmd/qa63/main.go` + a throwaway node script, **deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean while present *and* after removal. ⚠ `worker/cmd/qa54/` (Story 5.4's) is still in the tree — 6.2 flagged it and it is still not yours to delete; just do not add a second orphan.

- [x] **Task 6 — Mutation pass, before review (non-optional)**
  > Epic-5 retro Action Item #3 makes a **reviewer-independent** mutation pass a review gate. 6.2's own table reported 43/0 and the reviewer then found **5 survivors in 6 mutations**. Your table is the floor, not the proof.
  - [x] Mutate and record red/green for each, in **both** languages where the effect exists:
        LE64 → BE64 · counter starts at 1 instead of 0 · key = `seed_hex` string instead of raw bytes · big-endian assembly → little-endian · `limit` → `256^k` (bias restored, rejection disabled) · `x ≥ limit` → `x > limit` · minimal `k` → `k+1` · label `v1` → `v2` · `stage1/spin/<S>` 1-based → 0-based · rejection *re-reads the same bytes* instead of fresh ones · `n = 1` consumes 1 byte instead of 0 · seed decode accepts a 31-byte key.
  - [x] ⭐ Every mutation must redden **the vector-driven test**, not only a hand-written local assertion. A mutation that only reddens a local test means the *vector* does not cover it — fix the vector, not the test.

- [x] **Task 7 — Gates**
  - [x] `npm run lint` → 0 · `npm test` → **≥ 558** (the 6.2 post-review baseline; measure it first, do not quote it — 6.1 quoted stale numbers and 6.2's Dev Notes flagged it) · `npm run build` → 0, every viewer route still `ƒ` dynamic · `cd worker; go build ./... && go vet ./... && go test ./...` → clean.
  - [x] pgTAP: **unchanged, 1155 across 25 files, all green.** This story adds no migration and no test file; re-run the suite to prove it is untouched, and say so explicitly.
  - [x] `git status` proof that `supabase/**`, `app/**`, `lib/awards/**`, `lib/ceremony/**`, `lib/i18n/**` and `worker/ingest|store|db|config` are **byte-untouched**.

## Dev Notes

### ⚠ Four decisions taken at contexting — read these before writing code

**DECISION A — `uniform_int(stream, 1)` consumes ZERO bytes.**
The spec sentence is *"minimal `k` with `256^k ≥ n`"* (`SOLUTION-DESIGN:402`, `SPINE:217`). Read literally, `n = 1` gives `k = 0`: read nothing, return 0. An implementer who instead writes `for k := 1; ...` gets `k = 1`, consumes a byte, and returns 0 — the same *answer*, a different *stream position*, and therefore a different ceremony from the next draw onward. This is the highest-value divergence in the story precisely because it is invisible in the result. **Ship the literal reading (`k = 0`, zero bytes), comment it at the implementation site in both languages, and give it a golden-vector row.** If Cuatro prefers the `k ≥ 1` convention instead, the only change is the constant — the vector and the comment do the rest.

**DECISION B — the JS API is `async` and uses `crypto.subtle`; the Go API is sync and uses `crypto/hmac`.**
The verifier ships to a **browser** (`SPINE:41`, SOLUTION-DESIGN:31 *"Browser verifier · pure re-verifier"*), where the only HMAC is `crypto.subtle.sign`, which returns a Promise. Three consequences: (1) `Stream.read` and `uniformInt` are `async` — 6.4/6.6/6.7 will `await` them, so export the shape they need now rather than making them re-wrap it; (2) `node:crypto.createHmac` is **banned** in `lib/roulette` even though it would work under Vitest — a suite that greens a code path the browser never runs is the exact "verification narrative" failure Epic-5 retro Action Item #5 was written for; (3) no new dependency: Node ≥ 20.9 (`package.json` engines) exposes the same global `crypto.subtle`, so one implementation serves the test and the browser. **Do not hand-roll SHA-256 in JS to get a sync API.**

**DECISION C — `n` is bounded to `[1, 2^32]` and out-of-range is an error.**
Nothing in the engine needs more: the largest real `n` is a Stage-1 total weight (≤ 12 awards × the heaviest weight `100` = 1200) or a candidate count (≤ 16 players). The bound buys exactness for free — `k ≤ 4`, so Go's `uint64` never overflows `256^k` and JS's BigInt path has a trivially safe `Number` return — and it removes the entire `k = 8` / `256^8 = 2^64` overflow class that would otherwise need a special case in Go and a different one in JS. It changes **no reachable outcome**; it converts an unreachable overflow into a loud error. Declare the bound in both doc comments and in `roulette/vectors/README.md` so 6.9's published algorithm description carries it.

**DECISION D — `lib/roulette` is the first `lib/` module that is NOT `server-only`.**
Every existing `lib/**` module opens with `import 'server-only'` (6.1's review found the one file that had forgotten it). Habit will put it here too, and it will be **wrong**: `server-only` throws when a module is pulled into a client bundle, which is exactly what 6.9's *"Verificar la ceremonia"* button does. The failure is deferred to 6.9 and will look like a build error in someone else's story. Guard it the way 6.1 learned to guard `server-only`'s *presence*: a **pinning test that scans the source text**, because the Vitest alias stubs the module and an import-based test cannot tell the difference.

### The seam you are building — and the rule that governs it

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

`SPINE:73-76` is explicit: *"there is **no dependency edge** between `worker/*` and `app/`+`lib/`… The roulette **producer** (`worker/awards`) and **verifier** (`lib/roulette`) each conform to `roulette/vectors` independently — **never to each other**."* Practically: neither package may import the other (impossible anyway — different languages), neither may be "the reference implementation", and **neither may be corrected by reading the other's source**. When they disagree, the vector decides; when the vector is silent, add a vector.

This is why Task 2 comes before Task 4. Writing implementation B while looking at implementation A produces two copies of A's bug, and the golden vector — generated from A — then confirms it.

### The byte-level spec, transcribed (do not re-derive it from prose)

```
seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # 32 bytes, i from 0
stream(L)   = block(0,L) || block(1,L) || block(2,L) || …           # consumed left-to-right

uniform_int(stream, n):
    k     = minimal integer with 256^k >= n        # n=1 -> k=0 (DECISION A)
    limit = 256^k - (256^k mod n)
    loop:
        x = big-endian integer from the next k bytes of stream     # bytes are CONSUMED
        if x >= limit: continue                                    # rejected bytes are GONE
        return x mod n

labels: "inclusivcup/v1/stage1/spin/<S>"   S = 1,2,3,…  (decimal, no padding)
        "inclusivcup/v1/pity"
```

Sources, in agreement: [SOLUTION-DESIGN.md:393-404](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L393) · [ARCHITECTURE-SPINE.md:215-217](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L215) · [epics.md:1040-1054](_bmad-output/planning-artifacts/epics.md#L1040).

### Scope boundaries — hold these

**Build:** `roulette/vectors/{README.md,prng-block.json,prng-uniform-int.json}` · `worker/awards/{labels,prng}.go` + tests · `lib/roulette/{labels,prng}.ts` + tests.

**Do NOT build** (each with its owner):
- **Weighted pick / `luck_weight_table`** → SOLUTION-DESIGN §9.6 gate 3, owned by **6.4/6.6**. It *consumes* `uniform_int`; it is not a primitive. Adding it here means shipping a Stage-1 mechanism before the shelf state it weights on exists.
- **Stage-1 / Stage-2 / the FR-29 ladder / anti-sweep / pity draw** → **6.4, 6.5, 6.6, 6.7**. `PITY_LABEL` is defined here (it is a label, not a draw); the pity *algorithm* is 6.7's.
- **RFC-8785 canonical JSON, `bundle_sha256`, `algo_version` publication** → **6.9**. Do not add a canonicalizer, and do not put `algo_version` logic in `prng.ts` — the vector files may *carry* the version string as data, that is all.
- **The end-to-end ceremony vector, the weighted-pick vector, the canonicalization vector** → **6.11**. Say so in `roulette/vectors/README.md` so the next author does not assume the directory is finished.
- **Any database change** — no migration, no RPC, no RLS, no `supabase/**` edit, no pgTAP file. This story reads `seed_hex` as a *string literal in a test harness*; it does not query the database.
- **Any UI, any i18n string, any route.** `/ceremonia` stays the 5.7 `<Placeholder>`.
- **Anything in `worker/ingest|store|db|config`** or `lib/bracket|awards|ceremony|steam`. In particular: do not "unify" `lib/steam/nonce.ts`'s HMAC with this one — they are different primitives with different runtimes and different threat models.

### Testing standards

- **Vitest** — colocated `lib/**/*.test.ts` **only** ([vitest.config.ts:17](vitest.config.ts#L17)); a test outside `lib/` silently does not run. Environment is `node`, so `crypto.subtle` is the Node 20 WebCrypto global — the same API the browser gives you. `@` aliases the repo root. **Measure the baseline (`npm test`) before claiming a delta**; the 6.2 post-review figure is **558 across 36 files**.
- **Go** — `cd worker; go build ./... && go vet ./... && go test ./...`. Table-driven tests, `t.Errorf` over `t.Fatalf` in shared helpers so one failure does not mask the rest (the `assertDerivedStats` lesson, `deferred-work.md:20`).
- **Vector-driven conformance** — both suites parse the JSON at runtime. **Never transcribe vector values into source.**
- **Pinning tests** — for every "this must be absent" rule (`server-only`, `node:`, `math/rand`, `Math.random`, `Date`, `toLocaleString`), a test that scans the module source. An absent import reddens nothing when deleted; that is exactly why 6.1's review demanded pinning tests.
- **Mutation pass before review** — Task 6, non-optional, and every mutation must redden the *vector-driven* test.
- **pgTAP** — untouched. Baseline **1155 across 25 files**; re-run and state it.

### Stack

Pinned and current; **nothing new is introduced or permitted**. Go `1.26.4` (`worker/go.mod`) with stdlib `crypto/hmac` + `crypto/sha256` + `encoding/hex` + `encoding/binary` only. Node ≥ 20.9 · TypeScript `^5.9` · Vitest `4.1.9` · Next.js `16.2.10`. Browser side: WebCrypto `SubtleCrypto.sign('HMAC')` with SHA-256 — universally available in every browser this event will see, no polyfill, no dependency. **No new npm package and no new Go module. If you reach for one, stop — the whole point of HMAC-SHA256 is that both runtimes already have it.**

### Previous story intelligence — 6.2 (done, `eed5318`) and 6.1 (done, `01e3f5b`)

- **The doctrine that keeps producing findings: measure, never narrate.** 6.1 killed 3 of 12 awards by measuring. 6.2's review ran the clone probe *AC4's own Given clause had named and nobody had run* and found six of seventeen volume keys are exact clones. Task 5 is the same gate applied to the two runtimes.
- **⚠ The author's own mutation table is not proof.** 6.2 reported 43 mutations / 0 survivors; the reviewer's independent 6 mutations produced **5 survivors**, including both aggregates the story itself had flagged as riskiest. Assume your table has the same hole and design Task 6 to find it — that is what the "must redden the *vector* test" rule is for.
- **The seed you will use is real and already measured.** `fair_seed = 1b3cd678…3279c`, reproduced byte-identically from a from-scratch re-ingest of `ziivanto-sosa.dem` at 6.2's review. It is the correct input for Task 5 and it costs nothing to use.
- **6.2's DECISION F is live and matters to you later, not now:** `fair_seed` is write-once **at publication**, and `rollback_match` clears it when it un-crowns a final. Your primitives take the seed as an argument and hold no state, so nothing here is affected — but do not build any cache keyed on "the seed never changes".
- **`Object.freeze` is shallow** (6.1 shipped a "frozen" catalog of mutable entries). If `lib/roulette` exports a constant (label strings, the `n` bound), deep-freeze it and pin it.
- **Commit style:** `feat(<scope>): Story X.Y FR-nn/AD-nn <one line>` — **subject line only, no body, no trailers.**
- **Gates at 6.2 sign-off (post-review):** lint 0 · Vitest 558 · build 0 · pgTAP 1155 / 25 files · Go clean.

### Epic-5 retro action items this story carries

- **#3 — reviewer-independent mutation pass at review.** Task 6 is the author's half; the review must add its own.
- **#5 — verification-narrative honesty check.** Every claim in Completion Notes must be backed by printed output. AC4's external anchor and AC5's mechanical diff exist so there is something to point at.

### Git intelligence — recent commits

`eed5318` (6.2, ceremony lock + snapshot) · `01e3f5b` (6.1, award catalog) · `64990db` (5.8) · `eb53260` (5.7) · `fb02428` (5.6). The arc: one migration per story, one pgTAP file per migration, colocated Vitest, a live-QA BAR over the real seam, a mutation pass before review. **This story breaks exactly one of those habits — it has no migration and no pgTAP — and keeps every other one.** The BAR's shape changes (cross-language byte diff instead of HTTP over a live stack); its role does not.

## Project Structure Notes

```
roulette/vectors/README.md                NEW   the shared-contract seam + schema + ownership
roulette/vectors/prng-block.json          NEW   gate 1 (SOLUTION-DESIGN §9.6)
roulette/vectors/prng-uniform-int.json    NEW   gate 2, incl. rejection + block straddle
worker/awards/labels.go                   NEW   domain-separation labels (producer side)
worker/awards/labels_test.go              NEW
worker/awards/prng.go                     NEW   DecodeSeed · Stream · Consumed · UniformInt
worker/awards/prng_test.go                NEW   table-driven + vector-driven
lib/roulette/labels.ts                    NEW   mirror (camelCase), NOT server-only
lib/roulette/labels.test.ts               NEW
lib/roulette/prng.ts                      NEW   SubtleCrypto, async, BigInt assembly
lib/roulette/prng.test.ts                 NEW   vector-driven + the pinning scans
_bmad-output/implementation-artifacts/sprint-status.yaml   UPDATE
```

`roulette/` is a **new top-level directory**, provisioned by name in the spine's structural seed (`ARCHITECTURE-SPINE.md:450`) and by SOLUTION-DESIGN §9.6. It is deliberately **not** under `lib/` or `worker/` — it is owned by neither side. Confirmed at contexting: [.gitignore](.gitignore) does **not** exclude it (so the vectors commit), and it sits outside `app/` so `next build` will not treat the JSON as a route — prove the latter with the build gate anyway.

Two `tsconfig.json` facts that will bite otherwise: `"target": "ES2022"` + `"lib": [… "esnext"]` means **BigInt literals (`1n`) and `DataView.setBigUint64` are available** — no downlevel workaround needed; and `"verbatimModuleSyntax": true` means every type-only import must be `import type { … }` or the build fails.

Naming follows the established `lib/<domain>/{model,read,…}.ts` + `worker/<pkg>/<file>.go` layout. No migration number is consumed by this story; `0025` stays free for 6.4.

## References

- Story ACs — [epics.md:1034-1054](_bmad-output/planning-artifacts/epics.md#L1034)
- **AD-14** (deterministic, client-reproducible draw engine) — [ARCHITECTURE-SPINE.md:145-148](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L145)
- **Provably-Fair contract surface** (seed · stream PRNG · uniformity) — [ARCHITECTURE-SPINE.md:210-224](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L210)
- **The byte-level spec + build order + conformance gates** — [SOLUTION-DESIGN.md §9.1/§9.6](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L393)
- **The no-edge rule between `worker/*` and `lib/`** — [ARCHITECTURE-SPINE.md:73-76](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L73) · structural seed — `:440-452`
- **FR-25** (two-stage draw) — [prd.md:354-361](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L354) · FR-26 — `:363-369` · FR-27 (seed) — `:371-378` · FR-29 (ladder) — `:388-394` · SM-3 — `:484`
- Seed & PRNG mechanism rationale — [addendum.md:79-89](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md#L79)
- Pure-module house shape (and the seed AD-13 keeps distinct) — [lib/bracket/generate.ts:1-60](lib/bracket/generate.ts#L1)
- The repo's only other HMAC (server-only — the anti-pattern here) — [lib/steam/nonce.ts](lib/steam/nonce.ts)
- Vitest include rule — [vitest.config.ts:17](vitest.config.ts#L17)
- Prior story — [6-2-fair-seed-freeze-and-immutable-snapshot-capture.md](_bmad-output/implementation-artifacts/6-2-fair-seed-freeze-and-immutable-snapshot-capture.md) (the real seed is at `:375`)
- Epic-5 retro Action Items #3, #5 — [epic-5-retro-2026-07-28.md:95-97](_bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md#L95)
- Deferred items relevant to Epic 6's later stories — [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md)

## Questions for Cuatro

All four have a recommendation; none blocks Task 0/1. Answer before Task 2 fixes the vectors in place.

1. **Does 6.3 create `roulette/vectors/`, or does 6.11 own the whole directory?** 6.2's scope note said *"Golden vectors → 6.11"*, and 6.11's AC does own the **suite**. **Recommended: 6.3 creates the directory and the two *primitive* vectors (gates 1–2), 6.11 owns gates 3–5 and the suite's completeness.** Reason: AD-14 says the vectors *gate the build*, and SOLUTION-DESIGN §9.6's build order literally starts *"primitives (gate 1–2)"*. Building a Go implementation and a JS implementation in one story with no shared artifact means the first real check of their agreement is eight stories away — and the fix at that point is archaeology. The cost is two small JSON files.
2. **`uniform_int(stream, 1)` — zero bytes (DECISION A) or one byte?** **Recommended: zero** (the literal minimal-`k` reading; a degenerate choice consumes no entropy). Either is defensible; only the *unpinned* version is dangerous.
3. **The `n ≤ 2^32` bound (DECISION C).** Defensive, unreachable in practice (largest real `n` ≈ 1200), and it deletes an overflow class that would otherwise need two different special cases. **Recommended: yes**, documented in the published algorithm description.
4. **Should the Stage-1 weighted pick ship here too** (SOLUTION-DESIGN §9.6 gate 3)? **Recommended: no.** It is not a primitive — it needs the shelf state and the `luck_weight_table`, both of which are 6.6's, and 6.3's ACs do not mention it. Flagged only because §9.6 lists it adjacent to gates 1–2.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Amelia / dev-story workflow)

### Debug Log References

- Vitest baseline **measured before any edit**: `558 passed (558)` across `36` files — matches the 6.2 post-review figure quoted in Dev Notes.
- Greenfield sweep re-confirmed at Task 0: `worker/awards/`, `lib/roulette/`, `roulette/` all **ABSENT**; a repo-wide case-insensitive grep for `hmac|uniform_int|counter-mode` hit only `lib/steam/nonce.ts` + `lib/steam/callback.ts` (Steam OpenID CSRF nonce, server-only) and planning documents. Nothing implemented HMAC counter-mode, `uniform_int` or a weighted pick.
- Cuatro answered the four open questions at kickoff, all as recommended: 6.3 owns gates 1–2; DECISION A = **zero bytes**; DECISION C = **bounded `[1, 2^32]` + error**; Stage-1 weighted pick **stays in 6.4/6.6**.
- Two self-inflicted test failures worth recording, both fixed by hardening the *test*, not the rule:
  1. Go `TestPackageSourceHasNoBannedConstructs` flagged `labels.go` for `float64` — it was matching the doc comment that *explains* the ban. Replaced substring scanning with `go/parser` + `go/printer` so the scan runs over comment-free source and over the parsed import list.
  2. The same trap on the JS side (`prng.ts` names `node:crypto` and `server-only` in its ⛔ notes). Fixed with a small state machine (`test/source-scan.ts`) that blanks comments — and, for the code scan, string bodies — while keeping import specifiers intact for the import scan. The blanker has its own tests, because if it silently stopped blanking every ban above would pass vacuously.

### Completion Notes List

#### AC4 — the vectors are anchored OUTSIDE both implementations

Both vector files were **generated by a third implementation**: Python 3.14.5 stdlib `hmac` + `hashlib`, written from the transcribed spec, never from Go's or the browser's source. Case `real-seed/spin1/i0` is additionally reproducible from a **fourth**, unrelated HMAC (.NET/CNG). Verbatim:

```
$ python -c "import hmac,hashlib;k=bytes.fromhex('1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c');m=bytes.fromhex('696e636c757369766375702f76312f7374616765312f7370696e2f310000000000000000');print(hmac.new(k,m,hashlib.sha256).hexdigest())"
a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f

PS> [System.BitConverter]::ToString([System.Security.Cryptography.HMACSHA256]::new($key).ComputeHash($msg)).Replace('-','').ToLower()
a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f
```

`prng-block.json`'s `real-seed/spin1/i0.block_hex` is `a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f` — the same value from two implementations that are neither of the two under test. (`openssl` is not installed on this machine; .NET/CNG is the substitute and is equally independent.)

**The rejection search, recorded as required.** Searching `inclusivcup/v1/stage1/spin/<S>` from S=1 for a rejection within the first 12 draws of `n = 200` (limit 200, so `x ∈ [200,255]` rejects, 56/256 ≈ 21.9% per byte) hit on the **first label tried**, `spin/1`, at **draw #2**. Per-draw byte deltas for that case: `[1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1]` — draws #2 and #4 each burned 2 bytes for a 1-byte draw, which is a rejection made visible. Nothing was hand-written; the expected numbers come from the generator.

Final vector contents: **13 block cases + 9 invalid-seed shapes**, **11 uniform_int cases / 135 draws**.

#### AC5 — THE BAR: the two runtimes over the REAL frozen seed, diffed mechanically

Both implementations were driven over `tournament.fair_seed = 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c` (6.2's measured value) across **all 13 ceremony labels** (`stage1/spin/1` … `/12` and `pity`), printing per label: `block_0`, `block_1`, 40 successive `uniformInt(200)` draws with the running `consumed`, 12 draws at `n = 12`, and the E1 `n = 1` no-op. Transcripts were written to files and compared with `Compare-Object` — **not by eye**.

```
=== SHA-256, final code ===
bar2-go.txt   0AC84C1B3C1513F9A9168B8D2B241C5ACF8F81706407334F7B8A858088CC1881
bar2-js.txt   0AC84C1B3C1513F9A9168B8D2B241C5ACF8F81706407334F7B8A858088CC1881
bar2-py.txt   0AC84C1B3C1513F9A9168B8D2B241C5ACF8F81706407334F7B8A858088CC1881
=== mechanical diffs ===
Go vs JS : IDENTICAL (0 differing lines)
Go vs Py : IDENTICAL (0 differing lines)
lines    : 729
```

The third (Python) transcript was added beyond the AC: the agreement is a **triangle**, not a pair, so "two possibly-identical mistakes" is ruled out at the ceremony level too. Representative excerpt (identical in all three):

```
SEED 1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c
LABEL inclusivcup/v1/stage1/spin/1
block_0 a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f
block_1 3565d58c0d3cf6cf741fcfe1252e65023e1df200707cd90dc68162544295daf7
n200 1 169 1
n200 2 122 3        <- consumed jumped 1 -> 3: a REAL rejection, visible in the BAR itself
n200 3 166 4
...
n12 12 5 66         <- the position has crossed 32 and 64, so i advanced 0 -> 1 -> 2
n1 0 consumed_before=66 consumed_after=66    <- E1: zero bytes
```

#### Task 6 — the mutation pass, and what it actually found

The first run of the harness reported **every JS mutation killed**. That was false. The harness passed `cwd` with a lowercase drive letter (`c:\…`); Vitest then failed to load the test file at all (`TypeError: Cannot read properties of undefined (reading 'config')`) and returned non-zero for *every* invocation — which the harness read as "the mutation was killed". Two mutations were re-checked by hand, both survived, and the whole JS column was thrown away. The harness now runs a **CONTROL pass on unmutated source first** and declares the run void unless all four commands are green; it also kills the whole process tree on timeout (killing only the `cmd.exe` wrapper left the M10 infinite-loop worker spinning and it starved every later run).

**Honest first table — 24 mutations, 8 survivors:**

| Mutation | Go | JS | |
|---|---|---|---|
| M6 `x >= limit` → `x > limit` | **SURVIVED (even the full suite)** | **SURVIVED (even the full suite)** | ⛔ |
| M8 label `v1` → `v2` | SURVIVED the vector test | SURVIVED the vector test | ⛔ |
| M9 stage1 spin 1-based → 0-based | SURVIVED the vector test | SURVIVED the vector test | ⛔ |
| M12 seed decode accepts a 31-byte key | SURVIVED the vector test | SURVIVED the vector test | ⛔ |
| M1–M5, M7, M10, M11 | killed | killed | ✅ |

**All three holes were fixed in the VECTOR, not in a local assertion** (the story's rule):

1. **M6** — every rejection in the file had `x` *strictly* above `limit`, so the off-by-one was invisible. Added the case `exact-threshold-rejection-x-equals-limit`: a searched draw whose `x` is **exactly** `limit` (`n = 200`, byte `0xc8`). Under `x > limit` that draw is accepted instead of rejected, changing both the result and the byte position. `TestVectorCoversTheHardCases` / its Vitest twin now replay the raw bytes of every draw and **fail if no such draw exists**, so the case cannot be quietly deleted.
2. **M8 / M9** — every conformance case read `label` straight out of the file, so the label *generator* was never exercised by the vector. Added `label_source` (`{"kind":"pity"}` / `{"kind":"stage1","spin":N}`) to every case; both suites now rebuild the label with their own `Stage1Label`/`stage1Label` and compare against the vector's string. Expected values still come from the file, so this stays vector-driven.
3. **M12** — the vector carried only valid seeds. Added `invalid_seed_hex` (9 shapes) to `prng-block.json`; both suites assert each is refused. These are **not draw rows** — a refusal has no expected stream — but they are now shared contract instead of two independently hand-written lists. *(The `n` bounds were deliberately left as per-suite runtime assertions, per the story's explicit instruction. Flagging the `invalid_seed_hex` addition for the reviewer: it is an extension beyond the Task 2 schema, made because the mutation pass proved the gap real.)*

**Re-run after the fixes — 24 mutations, 0 survivors, control green, all four files verified byte-restored:**

```
CONTROL (unmutated source, all must be green):
  go vector    green      js vector    green
  go full      green      js full      green
...
24 mutations, 0 survived the VECTOR-DRIVEN test

RESTORE OK       worker\awards\prng.go        RESTORE OK       lib\roulette\prng.ts
RESTORE OK       worker\awards\labels.go      RESTORE OK       lib\roulette\labels.ts
```

Every one of the 12 mutations now reddens the **vector-driven** test in **both** languages, which was the bar Task 6 set.

#### One real defect the gates caught that the tests could not

`npm test` does **not** typecheck. `npm run build` failed on `lib/roulette/prng.ts:172` — since TypeScript 5.7 `Uint8Array` is generic over its backing buffer and defaults to `ArrayBufferLike`, which includes `SharedArrayBuffer`, and WebCrypto's `BufferSource` rejects it. Fixed by introducing an exported `Bytes = Uint8Array<ArrayBuffer>` and typing every array that reaches `crypto.subtle`. Worth carrying forward to 6.4/6.6/6.9: **a green Vitest run says nothing about types in this repo.**

#### Deviations from the planned file list

- **`test/source-scan.ts` is new and not in Project Structure Notes.** The pinning tests need to scan module source with comments (and, for the code scan, string bodies) blanked. It was first written as `lib/roulette/source-scan.ts`, then moved to `test/` next to `test/stubs/server-only.ts`: it is test support, not shipped code, and leaving it under `lib/roulette` both muddied that boundary and made the scan include itself. The pinning test now asserts the scanned set is **exactly** `['labels.ts', 'prng.ts']`, so a future module cannot slip in unscanned.
- `roulette/vectors/*.json` carry three fields beyond the Task 2 schema: `label_source`, `invalid_seed_hex` and a per-case `note`. The first two exist because the mutation pass proved the gap; the `note` is prose describing what each case pins, and is what a 6.11 author will read first.

#### Scope held

No migration, no RPC, no RLS, no pgTAP file, no UI, no i18n string, no route. No weighted pick, no Stage-1/Stage-2 ladder, no pity algorithm (`PityLabel` is defined; the draw is 6.7's), no RFC-8785 canonicalizer, no `bundle_sha256`. `worker/awards` imports nothing from `worker/ingest|store|db|config` (asserted over the parsed import list by `TestPackageIsALeaf`). No new npm package and no new Go module. `0025` stays free for 6.4. The throwaway harnesses (`worker/cmd/qa63/main.go`, `lib/roulette/bar-qa63.test.ts`) were **deleted before commit**, with `go build ./... && go vet ./... && go test ./...` proven clean both while present and after removal; `worker/cmd/qa54/` was left alone.

#### Gates (all measured, none quoted)

| Gate | Baseline (6.2) | Now |
|---|---|---|
| `npm run lint` | 0 | **0** |
| `npm test` | 558 / 36 files | **704 / 38 files** (+146) |
| `npm run build` | 0 | **0** — every viewer route still `ƒ` dynamic (`/`, `/bracket`, `/ceremonia`, `/jugador/[steamid64]`, `/leaderboards`); `roulette/` did not become a route |
| `cd worker; go build ./... && go vet ./... && go test ./...` | clean | **clean** (`awards` adds 96 passing tests/subtests) |
| pgTAP | 1155 / 25 files | **1155 / 25 files — PASS, byte-unchanged.** This story adds no migration and no test file; the suite was re-run to prove it is untouched, and it is. |

`git status --porcelain` proof that the forbidden trees are byte-untouched — the only entries in the whole repo are the three new directories plus the story and sprint files:

```
 M _bmad-output/implementation-artifacts/sprint-status.yaml
?? _bmad-output/implementation-artifacts/6-3-prng-core-hmac-sha256-counter-mode.md
?? lib/roulette/
?? roulette/
?? worker/awards/

supabase/  app/  lib/awards/  lib/ceremony/  lib/i18n/
worker/ingest/  worker/store/  worker/db/  worker/config/
lib/bracket/  lib/steam/                                  → all untouched
```

#### For the reviewer

Per Epic-5 retro Action Item #3, this table is the **author's half only**. The highest-value places to aim an independent mutation pass: the `exact-threshold` case (delete it and check the coverage assertion really fires), `label_source` (drop the field and confirm the suites fail loudly rather than skipping), and the block cache in both `Stream` implementations (it is the one piece of state neither the vectors nor THE BAR were designed to attack directly).

### File List

**New — the shared contract**
- `roulette/vectors/README.md`
- `roulette/vectors/prng-block.json`
- `roulette/vectors/prng-uniform-int.json`

**New — Go producer**
- `worker/awards/labels.go`
- `worker/awards/labels_test.go`
- `worker/awards/prng.go`
- `worker/awards/prng_test.go`

**New — browser verifier**
- `lib/roulette/labels.ts`
- `lib/roulette/labels.test.ts`
- `lib/roulette/prng.ts`
- `lib/roulette/prng.test.ts`

**New — test support**
- `test/source-scan.ts`

**New — added by the code review (2026-08-04)**
- `roulette/vectors/generate_vectors.py` — the third implementation that produces both vector files, committed so the reference is auditable rather than a deleted script

**Modified**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-3-prng-core-hmac-sha256-counter-mode.md`

**Created then deleted before commit (THE BAR harnesses)**
- `worker/cmd/qa63/main.go`
- `lib/roulette/bar-qa63.test.ts`

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Story 6.3 implemented. `roulette/vectors/` seam created with the two primitive vectors (gates 1–2), generated by an independent Python implementation and anchored against a fourth HMAC (.NET/CNG). Go producer `worker/awards` and browser verifier `lib/roulette` built independently against those files. THE BAR: both runtimes (plus Python) produce a byte-identical 729-line transcript over the real 6.2 frozen seed across all 13 ceremony labels, SHA-256 `0AC84C1B…CC1881`, diffed mechanically. |
| 2026-08-03 | Mutation pass: first table was invalid (a lowercase-drive-letter `cwd` made every Vitest invocation fail, reading as "all killed"); harness given a control pass and process-tree kill. Honest table found **8 survivors** — `x >= limit` → `x > limit` survived even the full suite in both languages. Fixed in the vector: added the `exact-threshold-rejection-x-equals-limit` case, `label_source` on every case, and `invalid_seed_hex`. Re-run: **24 mutations, 0 survivors**. |
| 2026-08-03 | `npm run build` caught a TypeScript-5.7 `Uint8Array<ArrayBufferLike>` vs `BufferSource` error that the (non-typechecking) Vitest run could not; added the exported `Bytes` alias. Gates: lint 0 · Vitest 704/38 · build 0 · Go clean · pgTAP 1155/25 unchanged. |

### Review Findings

_Baseline `eed5318`; 3 parallel layers (Blind Hunter + Edge-Case Hunter + Acceptance Auditor, all Opus 5) over the working-tree diff (~3,050 lines, ~1,016 of them vector JSON), plus a **reviewer-independent mutation pass** (12 mutations, aimed at the three targets the author named plus vector integrity)._

**Gates re-measured independently and all match the author's claims exactly:** lint 0 · Vitest **704 / 38 files** · build 0 with `/`, `/bracket`, `/ceremonia`, `/jugador/[steamid64]`, `/leaderboards` all still `ƒ` and no `roulette` route · Go build/vet/test clean, `awards` = 96. `git status` scope is exactly as claimed.

**AC verdicts: AC1 MET · AC2 MET · AC4 MET · AC5 MET · AC3 PARTIAL.** All 13 `prng-block.json` cases and all 11 uniform cases / 135 draws were recomputed from the spec by an independent implementation — 0 mismatches on `result` or `bytes_consumed_after`. The AC4 external anchor is real and was re-run verbatim. Both suites genuinely read the shared files; no vector value is transcribed into either source.

**Reviewer-independent mutation pass — 12 mutations, 2 survivors, 0 files left dirty (verified by hash against pre-run backups, since `git status` is blind to content inside untracked directories).** All three of the author's named blind spots held: deleting the `exact-threshold` case reddens both suites, `label_source`/`invalid_seed_hex` fail loudly rather than skipping, and the block-cache index check is covered in both languages. Byte-flipping the anchored `block_hex`, `x >= limit` → `x > limit`, case-insensitive seed decode, and round-vs-floor block indexing were all killed.

- [x] [Review][Decision → PATCH] ✅ **DECISION (Cuatro, 2026-08-04): throw on concurrent use.** Detect an overlapping `read`/`uniformInt` on the same `Stream` and throw — consistent with E2/E4 doctrine that a programmer error is a loud refusal. Serialising was rejected because it would let a forgotten `await` silently produce a different-but-valid-looking ceremony ordering, which is the exact invisible-divergence class this story exists to prevent. **The TS `Stream` is async-reentrancy-unsafe, and `consumed` — the property the whole vector suite is built on — cannot detect it.** `[lib/roulette/prng.ts:159-163]` — `read()` computes the block index from `#pos` *before* `await this.#block(...)` and reads the byte offset from `#pos` *after* it, and `#pos` is read-modify-written across the await. **Measured** on the real frozen seed: after `read(30)`, two concurrent `read(4)` returned `de11f26e`/`7b537ef2` where the true bytes 30-37 are `de7b92537ef2f26e` — byte 32 never delivered, stream byte 0 injected — and `consumed` was **38 in both the correct and the corrupt run**. Three concurrent `uniformInt(n=12)` gave `[3,5,4]` vs the sequential `[3,2,11]`, again with identical `consumed`. A forgotten `await` does the same. Go cannot exhibit this (synchronous, and `prng.go:73` documents the restriction); the TS mirror carries no warning, no guard and no test, and DECISION B's whole premise is that 6.4/6.6/6.7 will `await` this API. Not a present-day AC2 failure — today's only callers are sequential — but the symptom lands in 6.9 as the verifier declaring a correctly-produced ceremony unfair. **Options: (a) serialise internally on a promise chain (`#tail = #tail.then(...)`); (b) snapshot `#pos` synchronously before any await; (c) detect overlap and throw; (d) document only and leave it to 6.4.** Each has different consequences for the API 6.4/6.6/6.7 inherit, which is why this is a decision and not a patch.
- [x] [Review][Decision → PATCH] ✅ **DECISION (Cuatro, 2026-08-04): correct it now to `inclusivcup-roulette-1.0.0`** per SOLUTION-DESIGN:389 / epics.md:1164, in both vector files. **Both vector files declare `"algo_version": "inclusivcup/v1"` — the label prefix, not the algo version.** `[roulette/vectors/prng-block.json:3; prng-uniform-int.json:3]` — `SOLUTION-DESIGN.md:389` and `epics.md:1164` both fix `algo_version = inclusivcup-roulette-1.0.0`, `epics.md:1172` gates client refusal on its **MAJOR**, and the architecture's own adversarial review (`review-adversarial.md:406`) says *"the golden-vector suite is keyed by `algo_version`"*. Neither suite asserts the field, so it is inert today — but it is the shared contract's own key, seeded with the wrong value on the directory's first commit, and 6.9 (which publishes it) and 6.11 (which keys the suite on it) will read this directory first. **Options: correct it to `inclusivcup-roulette-1.0.0` now; leave it for 6.9 to define; or drop the field until its owner ships.**
- [x] [Review][Decision → PATCH] ✅ **DECISION (Cuatro, 2026-08-04): commit the generator** under `roulette/vectors/` as data-generation tooling, so the de facto reference is auditable and regenerable and 6.11 can extend rather than reconstruct it. **The Python generator that produced every vector value is not committed.** `[roulette/vectors/prng-block.json:5]` — `generated_by` is free-text prose naming an uncommitted script. Exactly one case (`real-seed/spin1/i0`) is externally anchored; the other 12 block cases and all 135 draws rest solely on that program. If it had a bug, Go and TS would conform to it identically and every gate would stay green. For a directory whose stated rule is *"neither implementation is the reference"*, the de facto reference is a deleted file. **Options: commit it under `roulette/vectors/` as data-generation tooling; anchor more cases externally instead; or accept and document.**
- [x] [Review][Decision → PATCH] ✅ **DECISION (Cuatro, 2026-08-04): give `NewStream` an error return** to match the TS guard. 6.4 has not been written, so the API churn is free now and expensive later. ⚠ Note this is the *narrow* option — it does NOT close the measured non-UTF-8/lone-surrogate label divergence, which remains its own patch item below. **Go `NewStream` accepts an empty label; TS `createStream` refuses it.** `[worker/awards/prng.go:89-91]` vs `[lib/roulette/prng.ts:177]` — **measured**: Go `NewStream(seed, "")` returns a usable stream (`676828e8…`), TS throws `TypeError`. Both produce the *same* bytes for that label, so the disagreement is purely about acceptance: the producer would happily draw a whole ceremony from an accidentally-empty label (an unchecked map lookup in 6.4) that the verifier cannot even open. **Options: give `NewStream` an error return (API churn 6.4 inherits); validate via a separate constructor; or relax the TS guard to match Go.**
- [x] [Review][Patch] `Stream`'s constructor is exported and unguarded — E4 is reachable through the module's own public API; **measured**: `new Stream(<31-byte key>, PITY_LABEL)` accepted, yielding a valid-looking, completely different stream `[lib/roulette/prng.ts:90,104]`
- [x] [Review][Patch] `blankOut` blanks template-literal interpolations, so the AC3 ban scan is blind exactly where labels are built — `` `${spin.toLocaleString()}` `` would be invisible `[test/source-scan.ts:54]`
- [x] [Review][Patch] `blankOut` has no regex-literal state; one regex containing a quote char blanks the rest of the file and every ban passes vacuously — latent today, and the failure mode is silent green `[test/source-scan.ts:61]`
- [x] [Review][Patch] DECISION B's positive half is unpinned — the `node:`/third-party bans would all still pass a hand-rolled pure-TS SHA-256, which is precisely what the decision forbids `[lib/roulette/prng.test.ts:481-492]`
- [x] [Review][Patch] Go's ban list omits `fmt.Sprintf` — the exact construct `labels.go:48-50` justifies `strconv.Itoa` against; a later `fmt.Sprintf("%02d", spin)` yields `/spin/01`, a different stream that "would still look correct" `[worker/awards/prng_test.go:664]`
- [x] [Review][Patch] The module-list pinning scan is non-recursive, so a future `lib/roulette/sub/x.ts` slips in unscanned for `server-only`/`node:` despite the exact-equality assertion `[lib/roulette/prng.test.ts:456]`
- [x] [Review][Patch] The straddle coverage guard tests whether a *draw's total span* crosses a 32-byte boundary, not whether any single `k`-byte read does — a rejection sequence at bytes 30/31/32 satisfies it with no straddling read `[lib/roulette/prng.test.ts:267; worker/awards/prng_test.go:329]`
- [x] [Review][Patch] A non-UTF-8 / lone-surrogate label produces two different streams — **measured**: Go writes the bytes verbatim (`9e671492…`), TS's `TextEncoder` substitutes `EF BF BD` (`d61f6c62…`); neither entry point validates the label `[worker/awards/prng.go:120; lib/roulette/prng.ts:107]`
- [x] [Review][Patch] `stage1Label` emits exponential notation for spin ≥ 1e21 — **measured** `.../spin/1e+21`; `Number.isInteger(1e21)` is `true` so the guard passes, and Go's `strconv.Itoa` never does this `[lib/roulette/labels.ts:37]`
- [x] [Review][Patch] TS `minimalK` is untested and the coverage test asserts against its own duplicate `kAndSpace`, so a bug in the shipped function cannot fail it; `k = 3` is never exercised end-to-end in either language `[lib/roulette/prng.ts:199; lib/roulette/prng.test.ts:237]`
- [x] [Review][Patch] `Stream.label` is writable at runtime (`readonly` is erased) — the reported label can lie about the bytes drawn, while Go's `Label()` over an unexported field cannot `[lib/roulette/prng.ts:91]`
- [x] [Review][Patch] The `Number.isInteger(n)` guard is untested — **measured survivor R10**: deleting it passes the full 146-test suite, because `BigInt(1.5)` throws the same `RangeError` the test asserts `[lib/roulette/prng.test.ts:313]`
- [x] [Review][Patch] Label refusals (spin 0/negative) are per-suite assertions while seed refusals were promoted to shared contract as `invalid_seed_hex` — **measured survivor R12**: relaxing `Stage1Label`'s bound survives the vector gate (killed only by the full Go suite) `[roulette/vectors/prng-block.json]`
- [x] [Review][Patch] The coverage tests do unvalidated arithmetic on vector-supplied `n` before anything range-checks it — a malformed `"n": 0` row panics the Go test binary instead of failing a named test, and `bytes_consumed_after` underflows `uint64` if non-monotonic `[worker/awards/prng_test.go:315]`
- [x] [Review][Patch] Go's block-vector test calls the unexported `s.block(i)` directly while its comment claims it exercises "the block INDEXING" — so on the Go side no block index above 1 is ever reached through `Read`; the `i=255`/`i=256` cases are verified in TS only `[worker/awards/prng_test.go:124]`
- [x] [Review][Patch] `Read(k)`/`read(k)` have no upper bound in either language — **measured**: Go `Read(1<<40)` and TS `read(2**31)` both failed to return within the timeout, in modules whose doctrine is that every programmer error is loud `[worker/awards/prng.go:137; lib/roulette/prng.ts:154]`
- [x] [Review][Patch] Spins 8 and 11 appear in no vector case — 10 of the 12 Stage-1 ceremony labels carry a committed cross-language expected value `[roulette/vectors/]`
- [x] [Review][Patch] The ban lists are inconsistent with the code they guard: `Math.round` is banned as evidence "a fraction reached the draw path" while `Math.floor(#pos / BLOCK_BYTES)` performs exactly that division, and `parseInt`/`**` are omitted though Task 4 names both and the module uses both `[lib/roulette/prng.test.ts:499-511]`
- [x] [Review][Patch] The README's `prng-uniform-int` schema example prints fabricated results (`71`/`88`) under the live case name `real-rejection-n200`, whose actual first draws are `169`/`122` `[roulette/vectors/README.md:109-116]`
- [x] [Review][Patch] `labels.ts` says its source scan is pinned by `labels.test.ts`; the scan actually lives in `prng.test.ts:474` and `labels.test.ts` has none `[lib/roulette/labels.ts:9]`
- [x] [Review][Patch] Two `invalid_seed_hex` entries are mislabelled — the "0x prefix" and "leading space" cases are 64 chars with the first characters *replaced*, not prefixed, so the `why` text describes an input that is not in the file `[roulette/vectors/prng-block.json:20,33]`
- [x] [Review][Patch] `N_BOUNDS` is documented as "deep-frozen because `Object.freeze` is shallow" but the code calls `Object.freeze` once — correct only because every leaf happens to be a primitive `[lib/roulette/prng.ts:48]`
- [x] [Review][Defer] THE BAR's transcript is not reproducible from the committed tree `[6-3 story:315]` — deferred, per Task 5's own instruction
- [x] [Review][Defer] `crypto.subtle` is dereferenced with no feature detection in the one module built for the browser `[lib/roulette/prng.ts:137,180]` — deferred, 6.9 owns the browser surface
- [x] [Review][Defer] A rejected `subtle.sign` leaves the stream partially consumed with no way to observe or repair it `[lib/roulette/prng.ts:154-165]` — deferred, depends on the reentrancy decision above
- [x] [Review][Defer] Three of the four TS import-ban tests currently assert over an empty list `[lib/roulette/prng.test.ts:474-492]` — deferred, forward-looking guards
- [x] [Review][Defer] TS `#pos` loses precision past 2^53 and neither language handles counter overflow at 2^64 `[lib/roulette/prng.ts:94]` — deferred, unreachable
- [x] [Review][Defer] pgTAP 1155/25 is the one gate resting entirely on an unshown run `[6-3 story:399]` — deferred, needs a live stack

### Review Patches Applied (2026-08-04)

All 4 decisions and all 22 patch findings were applied. The 6 deferrals are recorded in
`deferred-work.md` and were not touched.

**Gates after the patches — every number measured, none quoted:**

| Gate | 6.2 baseline | 6.3 as authored | After review patches |
|---|---|---|---|
| `npm run lint` | 0 | 0 | **0** |
| `npm test` | 558 / 36 files | 704 / 38 files | **754 / 38 files** (+50) |
| `npm run build` | 0 | 0 | **0** — `/`, `/bracket`, `/ceremonia`, `/jugador/[steamid64]`, `/leaderboards` all still `ƒ`; only `/_not-found` is `○`; no `roulette` route |
| `cd worker; go build/vet/test ./...` | clean | clean, `awards` 96 | **clean, `awards` 116** (+20) |
| `python roulette/vectors/generate_vectors.py --check` | — | — | **OK both files** |
| pgTAP | 1155 / 25 | 1155 / 25 | **unchanged — no migration, no test file, `supabase/**` byte-untouched** |

**⭐ The vectors are now re-derivable, and that re-derivation re-validated them.** `generate_vectors.py`
(D3) was written from the spec text and reproduced **every pre-existing value byte-for-byte** — all 13
block cases and all 135 draws — before adding the new ones. That is a fourth independent confirmation
of the committed data, on top of the author's Python and .NET/CNG anchors.

**Vector growth:** 13 → **15** block cases (spins 8 and 11, previously uncovered) · 11 → **13** uniform
cases, 135 → **145** draws (`k = 3`, reached by nothing before; and the lower edge of `k = 4`) ·
`invalid_seed_hex` 9 → **11** with the `why` text corrected to match the actual content ·
**`invalid_stage1_spin` added** so label refusals are shared contract, not two hand-written lists.

**Post-patch mutation pass — 21 mutations, 0 survivors, control green, 0 files left dirty.**
Restoration was verified by SHA-256 against pre-run backups, not by `git status`: `worker/awards/`,
`lib/roulette/` and `roulette/` are untracked directories, so git reports `??` regardless of content
and is blind to a mutated file left behind.

- **The 12 original mutations were re-run as a regression set — all killed**, including the two that
  had survived before the patches: `R10` (dropping `Number.isInteger(n)`, which had survived the
  *entire* 146-test suite because `BigInt(1.5)` throws the same `RangeError` the test asserted) and
  `R12` (relaxing `Stage1Label`'s 1-based bound, which had survived the vector gate).
- **9 new mutations aimed at the guards this review added — all killed.** Two of them survived the
  first run and each exposed a real gap, closed rather than papered over:
  - `N2` (delete the whole-draw reentrancy claim) survived because the per-read guard already caught
    every overlap the tests created. The one case it *cannot* see is `n = 1`: `k = 0` means `read(0)`'s
    loop body never runs, so the function never reaches an `await` and the per-read flag is set and
    cleared inside a single microtask. A test on that path now pins the two guards independently.
  - `N6` (drop the spin upper bound) survived because the label tests stopped at spin 1000, far below
    the 1e21 threshold where `String()` turns exponential.
- One reported "survivor" in the first run, `N9`, was a **harness bug, not a code gap**: the anchor was
  written in a double-quoted PowerShell string, where a backtick is the escape character, so the
  backtick in the TypeScript source never matched. Recorded because a mutation harness that silently
  fails to apply its mutation reads as "the code is fine" — the same class of error the author's own
  first run hit with the lowercase drive letter.

**Two patches changed shipped behaviour beyond adding a guard**, both to make an existing rule
enforceable rather than to weaken it: `decodeSeedHex` now decodes nibble-by-nibble instead of via
`Number.parseInt`, and `N_BOUNDS.MAX` is the literal `4294967296` instead of `2 ** 32` — so `parseInt`
and `**` could be added to the ban list Task 4 already named. The bit-shift bans are spaced (`' << '`)
because TypeScript's generic syntax closes with a bare `>>` and an unspaced needle false-positives on
`Readonly<Record<string, number>>`.

**API changes** (no consumer exists yet — 6.4 is the first): `NewStream` returns `(*Stream, error)`;
`Stream`'s TS constructor requires a module-private brand; `Stream.label` is a getter over a private
field; `minimalK` is exported for its own test; `MaxReadBytes` / `MAX_READ_BYTES` cap a single read.
