# `roulette/vectors/` — the cross-language golden-vector seam

```
worker/awards/     (Go, producer)  ─┐
                                    ├─→  roulette/vectors/   ←── the ONLY shared contract
lib/roulette/      (TS, verifier)  ─┘
```

`ARCHITECTURE-SPINE.md:73-76` is explicit: there is **no dependency edge** between `worker/*` and
`app/`+`lib/`. The roulette **producer** (`worker/awards`) and **verifier** (`lib/roulette`) each
conform to the files in this directory *independently* — **never to each other**.

Three rules follow, and they are the whole point of the directory:

1. Neither package may import the other, and neither is "the reference implementation".
2. **Neither may be corrected by reading the other's source.** When the two disagree, the vector
   decides. When the vector is silent, add a vector — then fix the code.
3. A vector generated *from* one implementation only proves the other copies it. So at least one
   case is anchored against a **third, independent HMAC** (see [Anchoring](#anchoring) below).

AD-14 requires these vectors to **gate the build**: both the Go suite (`go test ./...`) and the
Vitest suite (`npm test`) parse these exact files at runtime and fail on any mismatch. **Never
transcribe a vector value into source** — a hard-coded copy drifts silently the day the vector
is regenerated.

## Ownership

`SOLUTION-DESIGN.md §9.6` orders the conformance gates. This directory is built up across several
stories:

| Gate | File | Owner | Status |
|---|---|---|---|
| 1 — block function | `prng-block.json` | **Story 6.3** | ✅ shipped |
| 2 — `uniform_int` | `prng-uniform-int.json` | **Story 6.3** | ✅ shipped |
| — Stage-2 deterministic winner + tie detection | `stage2-resolve.json` | **Story 6-4a** | ✅ shipped |
| 3 — Stage-1 weighted pick | `stage1-pick.json` | **Story 6-4b** | ✅ shipped |
| 4 — canonical JSON + `bundle_sha256` (RFC-8785) | *(not yet)* | **Story 6.9** | ⏳ |
| 5 — end-to-end ceremony vector + suite completeness | *(not yet)* | **Story 6.11** | ⏳ |

Stage 2 is not one of §9.6's five numbered gates because §9.6 numbers the *stream* gates and Stage 2
consumes no stream — it is pure integer arithmetic over the frozen snapshot. AD-14 requires it to be
vector-gated all the same ("includes equal-value and equal-cross-product ties"), so it sits here
between gates 2 and 3, which is also the build order §9.6 prescribes (`Stage 2 + ladder` before
`Stage 1 + anti-sweep`).

**This directory is not finished.** Gate 4 (canonicalization + `bundle_sha256`, Story 6.9) and
gate 5 (the end-to-end ceremony vector, Story 6.11) are still to come. Everything the two-stage
draw itself needs — the block function, `uniform_int`, Stage 2 and Stage 1 — is here.

## File format

Vectors are **data, not code**: LF newlines, 2-space indent, no comments-as-keys, no trailing
commas, stable key order so a diff is readable.

**The integer-only / hex-string rule.** Every byte string is a lowercase hex string, never an
array of numbers and never base64. Every number that appears as a JSON number is an exact
integer within IEEE-754 safe range (`n ≤ 2^32`, positions and counters far below). **No floats,
and no big integer is ever written as a JSON number** — if a value could exceed 2^53 it is
carried as hex, or (in `stage2-resolve.json`, where the values are magnitudes rather than bytes)
as a **decimal string**. This is what lets Go's `encoding/json` and JS's `JSON.parse` read the
same file without either one silently rounding.

### `prng-block.json`

```jsonc
{
  "vector": "prng-block",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "block_i(label) = HMAC_SHA256(key = seed (raw 32 bytes), msg = utf8(label) || LE64(i))",
  "generated_by": "…",
  "invalid_seed_hex": [                     // seed shapes BOTH runtimes must REFUSE (E4)
    { "why": "31 bytes (62 chars)", "seed_hex": "1b3c…79" }
  ],
  "invalid_stage1_spin": [                  // spins BOTH runtimes must REFUSE
    { "why": "spin 0 — labels are 1-based, there is no spin 0", "spin": 0 }
  ],
  "cases": [
    {
      "name":      "real-seed/spin1/i0",    // stable, human-readable case id
      "seed_hex":  "1b3c…279c",             // 64 LOWERCASE hex chars; the key is the 32 DECODED bytes
      "label":     "inclusivcup/v1/stage1/spin/1",
      "label_source": { "kind": "stage1", "spin": 1 },   // how the label is BUILT
      "i":         0,                       // the block counter, from 0
      "msg_hex":   "696e…0000",             // the EXACT HMAC message: utf8(label) || LE64(i)
      "block_hex": "a9fb…bf1f"              // the 32-byte HMAC output
    }
  ]
}
```

⭐ `label_source` (`{"kind":"pity"}` or `{"kind":"stage1","spin":N}`) makes the label GENERATOR
part of the contract, not just the label string. Both suites rebuild `label` from it with their
own `Stage1Label`/`stage1Label` and compare. Without it a suite only ever *consumes* `label` as
an opaque string — and the 6.3 mutation pass proved that gap real: bumping the `v1` prefix and
making the spin 0-based **both passed the vector-driven test** until this field existed.

⭐ `invalid_seed_hex` carries the seed shapes both runtimes must refuse. These are **not draw
rows** — a refusal has no expected stream — but they are still part of the shared contract, so
the two suites cannot drift into two independently hand-written lists. Same finding: "seed decode
accepts a 31-byte key" survived the vector-driven test in both languages before this list existed.
⭐ `invalid_stage1_spin` does the same for the **label generator's** refusals, added by the 6.3
code review: a reviewer-independent mutation relaxing `Stage1Label`'s 1-based lower bound survived
the vector-driven test in Go (it was caught only by that suite's own local test). Seed refusals
were already shared contract; label refusals were not, and the asymmetry had no justification.
Only spins **both languages can represent** travel here — a non-integer spin is unrepresentable in
Go's `int` parameter.

The `n` bounds are deliberately *not* mirrored this way, for the same representability reason: a
fractional or `NaN` `n` cannot be written as a JSON integer without breaking the integer-only rule
above, so out-of-range `n` stays a runtime-error assertion inside each suite.

⭐ `msg_hex` is present so the `utf8(label) || LE64(i)` construction is **directly testable**
instead of hiding inside the digest. Both suites assert they build `msg_hex` byte-for-byte
*before* they check `block_hex`. Without it, a little-endian/big-endian counter mistake and a
key-encoding mistake are indistinguishable — both just produce "wrong digest".

`LE64` is an 8-byte **little-endian** counter and is the **only** little-endian construct in the
entire engine. Everything else — notably `uniform_int`'s byte assembly — is big-endian.

### `prng-uniform-int.json`

```jsonc
{
  "vector": "prng-uniform-int",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",
  "n_bounds": { "min": 1, "max": 4294967296 },
  "cases": [
    {
      "name":  "real-rejection-n200",                  // these ARE that case's first two draws
      "seed_hex": "1b3c…279c",
      "label": "inclusivcup/v1/stage1/spin/1",
      "label_source": { "kind": "stage1", "spin": 1 },
      "note":  "prose describing what this case pins",
      "draws": [
        { "n": 200, "result": 169, "bytes_consumed_after": 1 },
        { "n": 200, "result": 122, "bytes_consumed_after": 3 }   // delta 2 > k=1 ⇒ a REJECTION happened
      ]
    }
  ]
}
```

A case is a **sequence**, not a single draw, because a single draw cannot test stream continuity.
`bytes_consumed_after` is the stream's **cumulative** byte position after that draw — it is the
field that makes "both runtimes consume identical bytes" an assertion rather than a claim, and it
is the only way a rejection is visible from outside (`bytes_consumed_after − previous > k`).

### The cases that carry the weight

Both suites assert these are *present*, not merely that the file parses — a vector whose
interesting rows quietly disappeared would still pass every conformance check:

| Case | What only it can catch |
|---|---|
| `real-rejection-n200` | that a rejection **consumes** its bytes and draws fresh ones |
| `exact-threshold-rejection-x-equals-limit` | ⭐ `x >= limit` vs `x > limit`. Every other rejection has `x` strictly above `limit` and cannot tell the two apart. The 6.3 mutation pass found this off-by-one surviving the **entire suite** in **both** languages before this case existed. |
| `block-boundary-straddle` | E3 — a `k`-byte read beginning at byte 31 or 63 |
| `e1-n1-consumes-zero-bytes` | E1 — the zero-byte draw, invisible in the result |
| `n-upper-bound-2pow32` | `k = 4`, the E2 ceiling |
| `k-boundary-n256` / `n257` / `n255` | the `k` transitions and the never-rejects / always-rejects limits |
| `k3-n65537-and-n16777216` | ⭐ the **`k = 3`** width. The 6.3 code review found `k = 3` was reached by no case in either language, so a three-byte assembly bug — including big-endian/little-endian at that width alone — was caught by nothing. |
| `k4-lower-edge-n16777217` | the *lower* edge of `k = 4` (`2^24 + 1`). An off-by-one in `while space < n` picks `k = 3` here and reads one byte too few on every draw. |

### `stage2-resolve.json`

```jsonc
{
  "vector": "stage2-resolve",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",
  "value_encoding": "…",                    // why magnitudes are decimal STRINGS — see below
  "outcome_kinds": ["winner", "tie", "no_eligible_players", "no_awardable_value"],
  "tie_reasons":   ["equal_value", "equal_cross_product"],
  "refusals": [                             // inputs BOTH runtimes must REFUSE
    { "why": "two players share a steamid64 …", "award": {…}, "players": […] }
  ],
  "cases": [
    {
      "name": "rate-max-equal-cross-product-different-pairs",
      "note": "prose describing what this case pins",
      "award":   { "deciding_stat": "entry_success", "class": "rate",
                   "direction": "max", "floor_rounds": 0, "floor_kills": 0 },
      "players": [
        { "steamid64": "76561198000000011",
          "rounds_played": "6", "kills": "3", "idle_dq": false,
          "stats_int": { "volume": { "kills": "3", … },
                         "rate":   { "entry_success": { "num": "3", "den": "6" }, … } } }
      ],
      "expected": { "kind": "tie",
                    "tied": ["76561198000000011", "76561198000000033"],
                    "reason": "equal_cross_product" }
    }
  ]
}
```

⭐ **Magnitudes are decimal STRINGS; award fields are JSON integers.** The split is by
*provenance*, not by taste: `steamid64`, `rounds_played`, `kills` and every `stats_int` entry come
from the **snapshot**, where AD-19 makes them unbounded integers — and `JSON.parse` silently
rounds anything past 2^53, so the cross-multiplication case below would be corrupted *at parse
time* if written as a JSON number. `floor_rounds` and `floor_kills` come from the **award
catalog**, whose columns are bounded `int` (`0023:74-75`), so they stay JSON integers.

⭐ **Every player carries decoy keys in both tables.** With a single-key fixture, a resolver that
read the wrong deciding stat would be indistinguishable from a correct one. The decoys are
adversarial where it matters — in `volume-max-plain` the leader on `kills` and `hs_kills` is *not*
the leader on the deciding `knife_kills`.

⭐ `refusals` carries the inputs both runtimes must reject, for the same reason
`invalid_seed_hex` and `invalid_stage1_spin` exist: a refusal has no expected winner, but it is
still shared contract, and the 6.3 review measured a mutation surviving precisely because one
side's refusals were hand-written locally instead of travelling in the vector.

#### The Stage-2 cases that carry the weight

| Case | What only it can catch |
|---|---|
| `rate-max-cross-multiplication-only` | ⭐ that the comparison is **exact integer** arithmetic. At or below 2^53 an inversion is *impossible* (both operands are exact doubles and IEEE division is correctly rounded, so `a/b > c/d ⇒ fl(a/b) ≥ fl(c/d)`) — so the case is built at `2^53+1`, where a float compare picks the **other** player and `Number`/`float64` corrupts the input before any arithmetic runs. |
| `rate-max-equal-cross-product-different-pairs` | `3/6` vs `2/4` — an equality check written as `num == num && den == den` misses it and silently crowns whichever the loop held. |
| `byte-lex-is-a-string-order-not-a-numeric-one` | ⭐ byte-lex vs numeric sort. Every real SteamID64 is 17 digits, so the two orders agree on every *other* case in the file; only the short synthetic ids `"9"`, `"10"`, `"100"` can tell them apart. |
| `players-supplied-out-of-byte-lex-order` | that the resolver sorts, rather than inheriting the fixture's order. |
| `floors-are-inclusive-at-the-boundary` | `>=` vs `>` on **both** floors — the exact off-by-one that survived the whole suite in both languages at 6.3. |
| `rate-zero-denominator-is-equal-to-everyone` | that a `0/0` player is neither divided by, thrown on, nor filtered out — and the tie that applying the formula verbatim therefore produces. |
| `rate-zero-denominator-clears-a-real-floor` | ⭐ added by the 6-4a code review. Every other den-0 row sits at `rounds_played = 0` and is excluded by any non-zero floor, which left the whole 0/0-ties-everyone behaviour reachable only at floors `0/0`. `entry_success`'s denominator has no volume counterpart, so a den-0 player clears **24/20** — and an award with an unambiguous winner becomes a tie the refusing ladder turns into a hard failure. The shape 6.5 must be designed against. |
| `rate-max-positive-numerator-over-zero-beats-every-finite-rate` | ⭐ added by the 6-4a code review: the *other* half of legal den-0, which no row covered because every den-0 fixture used `num = 0`. With `n > 0` the same formula makes `n/0` behave as **+infinity** — `1/0` beats `9999/30` — and `deciding_value` is rendered as `1/0`. |
| `an-absent-RATE-key-on-an-INELIGIBLE-player-is-not-an-error` | ⭐ added by the 6-4a code review: the rate twin of the volume row below it. Every fixture materialised all four rate keys, so "the deciding magnitudes are read only for the eligible" was proven for volume and merely asserted for rate. |
| `volume-max-all-zero-no-awardable-value` | DECISION E, over the shape 6.1 measured (`knife_kills` non-zero for 1 of 28 players). |
| `volume-min-zero-is-awardable` / `rate-max-zero-numerator-is-awardable` | DECISION E's **scope** — widening it beyond `max` volume awards reddens these two. |
| `volume-max-three-way-tie` | tie **width**: a resolver returning a pair passes every 2-way case and fails here. |
| `idle-dq-leaves-nobody-eligible` | the one shape where the `idle_dq` filter is all that stands between a DQ'd player and a trophy. |

**DECISION E** (Cuatro, 2026-08-04) is the one rule here that is a *product* call rather than a
transcription of SOLUTION-DESIGN §9.3: a `max` **volume** award whose best deciding value is `0`
has **no winner** (`no_awardable_value`) instead of crowning a whole-roster co-win over a stat
nobody scored on. `min` awards and `rate` awards are deliberately untouched. It lives in the
vector because both runtimes must implement it identically.

⚠ **`no_awardable_value` carries `tied`**, added by the 6-4a code review. The zero check runs
*before* the `|best| == 1` branch, so the tie that would have formed never becomes a `tie`
outcome — and without the set travelling on the outcome, 6.5 / 6.6 / 6.7 receive a bare kind and
cannot see how wide it was. `tied.length` **is** that width, and it is `1` when a lone eligible
player sat at zero (still no winner: the rule is about the value, not the width). The
corresponding carve-out is recorded in **AD-14** — before that amendment the architecture said
every equal deciding value MUST enter the FR-29 ladder, which this rule contradicts.

⚠ **The refusal list covers the award itself.** `direction` outside `{max, min}`, a negative
floor and an empty `deciding_stat` became shared rows only when the 6-4a code review gave
`generate_vectors.py` a `validate_award` of its own. Until then the anchor's refusal surface was
*smaller* than both implementations' — an unknown direction resolved silently as `min` — so
`build_stage2_file`'s "a refusal row must actually refuse" guard rejected those rows and they
lived in two hand-written per-language lists, the exact asymmetry this array exists to prevent.

### `stage1-pick.json`

```jsonc
{
  "vector": "stage1-pick",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",
  "value_encoding": "…",                    // integers vs decimal strings, split by PROVENANCE
  "refusal_kinds":   ["tie", "invalid"],
  "refusal_details": ["weight_table", "shelf", "pool", "live_count",
                      "total_weight", "stage2", "tie",
                      "stream", "internal"],   // ⚠ the last two: declared, NOT row-representable
  "refusals": [                             // inputs BOTH runtimes must REFUSE
    { "why": "…", "refusal_kind": "tie", "detail": "tie",
      "seed_hex": "1b3c…279c", "label": "…",
      "label_source": {…}, "weight_table": […], "shelf": {…}, "live_count": 1,
      "candidates": […], "players": […] }
  ],
  "cases": [
    {
      "name": "r-lands-exactly-on-a-cumulative-boundary",
      "note": "prose describing what this case pins",
      "seed_hex": "1b3c…279c",
      "label": "inclusivcup/v1/stage1/spin/2",
      "label_source": { "kind": "stage1", "spin": 2 },
      "weight_table": [3, 2],                          // organizer config: strictly decreasing, all > 0
      "shelf":        { "76561198000000022": 1 },      // trophies held, FROZEN at spin start
      "live_count":   1,
      "candidates": [                                  // supplied in ANY order; the walk sorts
        { "award_id": "aw-knife", "priority": 1,
          "award": { "deciding_stat": "knife_kills", "class": "volume",
                     "direction": "max", "floor_rounds": 0, "floor_kills": 0 } }
      ],
      "players": [ … the same AD-19 rows `stage2-resolve.json` uses … ],
      "expected": {
        "weights":      [3, 2],                        // ⭐ aligned to ASCENDING PRIORITY, not to input order
        "total_weight": 5,                             // the WHOLE pool, pinned separately from each draw
        "draws":        [ { "n": 5, "r": 3, "bytes_consumed_after": 1 } ],
        "live":         ["aw-hs"]                      // in DRAW order — that is the reveal order
      }
    }
  ]
}
```

⭐ **`expected.weights` is as load-bearing as `expected.live`.** A vector that pinned only the
winner would let a wrong shelf lookup pass on every spin where it happened to draw the same
award anyway. The weights are pinned per candidate **in ascending-priority order**, and
`total_weight` separately so a summation bug is its own failure rather than hiding inside a
draw that landed the same way.

⭐ **`bytes_consumed_after` rides on every draw**, exactly as in `prng-uniform-int.json`. Stage 1
is the first stage that consumes the stream, so its byte accounting is *contract*, not a side
effect: it is the only externally visible proof that both runtimes walked the same stream, the
only way a rejection inside `uniform_int` is observable at all, and the thing 6.9's browser must
reproduce exactly.

⭐ **`refusal_kind` separates the tie from every invalid input.** They mean different things to
the caller: an invalid input is a bug to fix, a tie is the FR-29 seam Story 6.5 fills. Asserting
merely "some error" is what let a 6-4a mutation that made validation reject *everything* pass
every refusal row, so both runtimes must keep the two distinguishable — Go by a distinct
sentinel, TypeScript by a distinct error subclass.

⭐⭐ **`detail` names WHICH INPUT the row is about**, from the closed `refusal_details` set, and it
exists because Story 6-4b's mutation pass measured the cost of its absence. Deleting the
**negative-shelf guard** left every gate **green** in TypeScript: a negative index there yields
`undefined`, which becomes `NaN` in the weight sum and is refused three functions later — still a
typed refusal, still the right `refusal_kind`. Go, on the same deletion, **panics** on `table[-1]`.
So `refusal_kind` alone could not distinguish *"refused by the guard that exists for exactly
this"* from *"refused by accident"* or *"crashed"*. With `detail`, each of the eighteen rows is
about the guard it names — and the generator itself asserts that the row's declared `detail`
matches the guard that actually raised. It is 6-4a's untyped-refusal lesson applied one level
deeper.

⚠ **`refusal_details` declares NINE; only the first SEVEN are row-representable.** A row is a set
of *inputs*, and `stream` ("no stream was supplied") and `internal` ("an invariant broke") are not
inputs — no row can produce them. But both are reachable in both runtimes, so omitting them made a
"closed set" that was not closed: the 6-4b code review found Go declaring nine while TypeScript and
this file declared seven, TypeScript throwing `'stream'`/`'internal'` anyway while its own JSDoc
promised one of the seven, and the unreachable unknown-outcome arm refusing as `internal` in Go and
`stage2` in TypeScript — one input, two values, in the field this file calls shared contract. All
three now declare the same nine, both suites pin the set, and the generator **refuses to write a
row** whose `detail` is one of the two no set of inputs can reach. The unrepresentable pair is
covered by each runtime's own stream-guard test instead.

⭐ **`live-count-zero-over-a-tied-pool` is the only row malformed in TWO ways**, and it exists
because validation *order* is contract. The 6-4b review found Go and TypeScript weighting before
checking `live_count` and therefore refusing as `tie`, while this anchor checked `live_count` first
and refused as `invalid`. One input, two refusal **kinds** — and a caller routing on `refusal_kind`
hands a malformed spin plan to Story 6.5's ladder. Every other row is malformed in exactly one way
and cannot see the difference.

⚠ **The generator guards its own cases.** Every case above declares, as executable code, the
property it was *chosen* for — that `r` lands exactly on a boundary, that the re-draw's `n`
really is recomputed, that the zero-byte draw really consumes zero. Those properties depend on
the real seed's bytes, so an edit to a spin number or a weight could otherwise turn the file's
most valuable row into an ordinary one with every gate still green. `build_stage1_file` also
asserts that **no refusal moved the stream**, which is what makes "validate before any draw"
checked rather than claimed.

⭐ **Three rows also declare an INPUT property (`pins_inputs`), because `pins` only sees the
output.** The 6-4b code review found the frozen-shelf row and both DECISION-F rows guarded solely
by the numbers they produce — and those numbers are reachable by other routes. `[100, 100, 100]`
with totals `300`/`200` is produced by *any* roster with real winners, so the frozen-shelf row only
kills the recomputed-shelf mutation because **one player sweeps every candidate**; "every weight is
`table[0]`" is equally true of a roster whose players simply *win* with an empty shelf, so the
`no_eligible_players` row could have stopped exercising the branch it is named for. `pins_inputs`
re-derives the outcome kind and the sweeper through the real `resolve_stage2`, and **both suites do
the same check** — the fixture can no longer drift into a row that produces the right numbers for
the wrong reason.

#### The Stage-1 cases that carry the weight

| Case | What only it can catch |
|---|---|
| `r-lands-exactly-on-a-cumulative-boundary` | ⭐⭐ `cum > r` vs `cum >= r`. Weights `[3, 2]`, `r = 3` — exactly the first candidate's cumulative. `>` picks the second (correct: `r ∈ {0,1,2}` is the first's share, `{3,4}` the second's); `>=` picks the first and silently hands it 4/5 of the probability mass. The result *shape* is identical, and every other draw in the file has `r` strictly inside a span. Same off-by-one class as `exact-threshold-rejection-x-equals-limit`, which the 6.3 mutation pass found surviving the **entire suite in both languages**. |
| `heaviest-weighted-candidate-is-not-the-one-drawn` | ⭐ that the pick is **stream-driven** at all. Without it, "weighted pick" and "argmax over the weights" are indistinguishable — an implementation that never touched the stream would pass everything else. |
| `shelf-to-weight-mapping-with-clamp-and-empty-shelf` | the weight rule over all four branches at once: absent (⇒ shelf 0 ⇒ **heaviest**), mid-table, and a shelf **past** `table_max` so `min(shelf, len(table) − 1)` clamps instead of indexing off the end. |
| `the-shelf-is-frozen-across-the-picks-of-one-spin` | ⭐ W1. One player wins all three candidates from an empty shelf, so the first draw is over `n = 300` and the second over **200**. Crediting the first pick before the second reweights the survivors and draws over `80` — a different byte count, from a rule nothing else constrains. |
| `live-count-2-redraws-against-the-recomputed-total` | W4. `draws[1].n` is `156 − (the removed weight)`. Reusing the first draw's remainder consumes no second draw; re-drawing against the *original* total leaves `n` unchanged. Its first draw also **rejects** inside `uniform_int`, so a Stage-1 pick cannot assume one byte. |
| `single-candidate-pool-still-draws-and-consumes-a-byte` | DECISION G. A one-candidate pool of weight 100 draws `n = 100` and **moves the stream**. Special-casing `|pool| == 1` returns the same award one byte behind, and every later spin diverges invisibly. |
| `total-weight-one-is-the-only-zero-byte-draw` | DECISION G's other half + E1. `n = 1` ⇒ `k = 0` ⇒ **zero bytes**. Read as a pair with the row above, the two pin that the zero-byte draw is a property of the **weight**, never of the pool **size**. |
| `candidates-supplied-out-of-priority-order` | W2 — byte-identical inputs to the not-heaviest row *except* the supplied order, so the expected output is identical too. Walking the supplied order accumulates `1, 17, 57, 157` instead of `100, 140, 156, 157` and the same `r` selects a different award. |
| `every-candidate-has-no-eligible-players-and-weights-heaviest` | ⭐ DECISION F over the **measured** corpus: 6-4a found all twelve real awards at `no_eligible_players`, so today's Stage 1 draws **uniformly**. Refusing there instead would make the ceremony unrunnable. |
| `no-awardable-value-weights-as-an-empty-shelf` | DECISION F's other no-winner arm, reached by a different route (players *are* eligible; DECISION E suppressed the value). Refusing on it, or reading a shelf for the suppressed set, diverges here and nowhere else. |
| `min-and-rate-candidates-resolve-through-the-real-stage-2` | that `provisional_winner` is genuinely Stage 2's outcome — over a `min` volume award and a cross-multiplied `rate` award, where re-deriving the winner lands on a different player and therefore a different weight. |
| `an-absent-shelf-map-is-shelf-zero-for-everyone` | W8 — the **first spin** of every ceremony. Same pool and players as the mapping row, so the shelf is the only input that changed. |
| `an-omitted-shelf-key-is-the-empty-shelf` | ⭐ its twin, with **no `shelf` key at all**; its `expected` block is byte-identical, and that identity *is* the assertion. The 6-4b review found the seam disagreeing here — Go's nil map ranged zero times and **published a ceremony**, TypeScript refused it, and this generator raised a bare `AttributeError` — so a correctly produced ceremony would have been called unfair by the verifier. Go cannot tell nil from empty without a pointer, so "absent is empty" is the rule the other two were brought to. `null` and structurally-wrong shelves are still refused by TypeScript and Python and are deliberately **not** vectorable: Go cannot express them. |
| `live-count-equal-to-the-whole-pool-drains-it-in-draw-order` | W6's upper edge. Draining the pool is legal, and the final pick is where a re-draw against a stale total finally produces an out-of-range index rather than a plausible answer. ⚠ Its draw order happens to *equal* priority order (1, 2, 3, 4), so it does **not** discriminate draw order from a sorted output — an earlier note claimed it did. The row that carries that property is the `live_count = 2` re-draw, and both suites now assert it **by name** and assert it is the only one. |

**DECISION F** and **DECISION G** (Cuatro, 2026-08-04) are the two rules here that are *product*
calls rather than transcriptions of SOLUTION-DESIGN §9.2. **F:** a `tie` provisional winner has
several candidate shelves, and choosing among them is the silent argmax AD-14 forbids — so it
**refuses**, naming Story 6.5; a `no_eligible_players` / `no_awardable_value` outcome has **no
player at all**, therefore no shelf, therefore index 0 — the heaviest weight, which is exactly
what FR-26's *"empty shelf ⇒ heaviest"* is written to produce. Collapsing the two is a silent
argmax on one side and an unrunnable ceremony on the other. **G:** there is **no
single-candidate short-circuit** — the draw is always `uniform_int(stream, total_weight)`. The
two rules produce identical *picks* and different *stream positions*, which is invisible until
the browser verifier declares a correct ceremony unfair.

## The spec these files encode

```
seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # 32 bytes, i from 0
stream(L)   = block(0,L) || block(1,L) || block(2,L) || …           # consumed left-to-right

uniform_int(stream, n):
    k     = minimal integer with 256^k >= n        # n=1 -> k=0  (zero bytes read)
    limit = 256^k - (256^k mod n)
    loop:
        x = big-endian integer from the next k bytes of stream     # bytes are CONSUMED
        if x >= limit: continue                                    # rejected bytes are GONE
        return x mod n

labels: "inclusivcup/v1/stage1/spin/<S>"   S = 1,2,3,…  (decimal, no padding)
        "inclusivcup/v1/pity"
```

Each label is an independent stream and each starts at counter `i = 0`.

### The four edge semantics the vectors pin

| | Rule | Why it needs a vector |
|---|---|---|
| **E1** | `n = 1` consumes **zero** bytes (`k = 0`, result `0`). | An implementer looping from `k = 1` returns the same *answer* and a different *stream position*. Invisible in the result, fatal from the next draw onward. |
| **E2** | `n` is bounded `1 ≤ n ≤ 2^32`. Out of range is a **programmer error** (Go returns `error`, JS throws) — never a clamp, never a business refusal. | The bound keeps `k ≤ 4`, so Go's `uint64` never overflows `256^k` and JS's BigInt path always returns a safe `Number`. It deletes the `256^8 = 2^64` overflow class that would otherwise need two different special cases. No user input reaches this function; the largest real `n` is ≈ 1200. |
| **E3** | Reads straddle block boundaries. The stream is a **byte** stream over `block_0 \|\| block_1 \|\| …`; a `k`-byte read beginning at byte 31 takes byte 31 of block 0 and byte 0 of block 1. Rejected bytes are consumed and never put back. | Two honest implementers land on different bytes here. |
| **E4** | The seed key is exactly 32 bytes, decoded from **64 lowercase hex chars** (`^[0-9a-f]{64}$` — the same shape `tournament_fair_seed_hex` enforces at the database). Uppercase, `0x`, whitespace or any other length is an error, not a best-effort decode. | A 31-byte key silently produces a perfectly valid-looking, completely different stream. |

## Anchoring

All four files are generated by a **third** implementation —
[`generate_vectors.py`](generate_vectors.py), Python 3 stdlib `hmac` + `hashlib` plus Python's
own unbounded integers, written from the spec above — so they are neither Go's output nor the
browser's. The block cases are additionally reproducible from a **fourth**, unrelated HMAC
(.NET/CNG via PowerShell).

For `stage2-resolve.json` the anchor is arithmetic rather than cryptographic: Python's `int` is
unbounded by construction, which is exactly the property Go takes from `math/big` and TypeScript
from `BigInt`. A generator that quietly used floats would disagree with both implementations on
`rate-max-cross-multiplication-only` rather than agreeing with them by accident.

`stage1-pick.json` is anchored on **both** axes at once: its weights come from the arithmetic
anchor (through the same `resolve_stage2` that produces `stage2-resolve.json`) while every `r`
and every `bytes_consumed_after` comes from the cryptographic one (the same `Stream` and
`uniform_int` that produce `prng-uniform-int.json`). That is why its cases run on the **real**
frozen seed rather than a synthetic one: a Stage-1 row is only as trustworthy as the stream
underneath it, and that stream is already independently pinned by gates 1 and 2.

**The generator is committed, and that is deliberate.** The 6.3 code review found that leaving it
out made a *deleted file* the de facto reference: 12 of 13 block cases and every draw rested on a
script nobody could re-run, so a bug in it would have been inherited identically by both
implementations with every gate still green. Committed, it is auditable and re-runnable:

```bash
python roulette/vectors/generate_vectors.py --check   # verify committed files, write nothing
python roulette/vectors/generate_vectors.py           # regenerate all four files
```

⚠ Nothing runs `--check` automatically — this repo has no CI (`deferred-work.md:299`, deferred to
6.11). It is a manual gate, run at every story's sign-off.

⛔ **Never "fix" the generator by reading `worker/awards/prng.go` or `lib/roulette/prng.ts`.** It is
the third implementation precisely because it was written from the spec text alone; correcting it
against either implementation collapses the anchor and leaves you with two copies of one opinion.

Anyone can re-check case `real-seed/spin1/i0` without running the generator at all:

```bash
python -c "import hmac,hashlib;k=bytes.fromhex('1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c');m=bytes.fromhex('696e636c757369766375702f76312f7374616765312f7370696e2f310000000000000000');print(hmac.new(k,m,hashlib.sha256).hexdigest())"
# a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f
```

```powershell
$key = [byte[]] -split ('1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c' -replace '..', '0x$& ')
$msg = [byte[]] -split ('696e636c757369766375702f76312f7374616765312f7370696e2f310000000000000000' -replace '..', '0x$& ')
[System.BitConverter]::ToString([System.Security.Cryptography.HMACSHA256]::new($key).ComputeHash($msg)).Replace('-','').ToLower()
# a9fb7aa6dbad259345c7ad8f1e3162a8cc27fb2f144038533c88d5e7e5d4bf1f
```

Note the seed used throughout is the **real** frozen `tournament.fair_seed`
(`1b3cd678…3279c`, Story 6.2), not a synthetic one.

## How each runtime loads them

| | Path | cwd |
|---|---|---|
| Go | `../../roulette/vectors/*.json` | `go test` runs with cwd = the package dir (`worker/awards`) |
| Vitest | `roulette/vectors/*.json` via `readFileSync` | `npm test` runs with cwd = the repo root |

If you regenerate a vector, **both** suites must be re-run. A change that greens only one of them
is the exact divergence this directory exists to catch.
