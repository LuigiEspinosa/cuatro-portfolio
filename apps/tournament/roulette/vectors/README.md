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
| — FR-29 tie ladder | `ladder-resolve.json` | **Story 6.5** (+ 6-5b's coverage pass) | ✅ shipped |
| 3 — Stage-1 weighted pick | `stage1-pick.json` | **Story 6-4b** (+ 6.5's ladder rows, + 6-5b's shared-arm clamp row) | ✅ shipped |
| — FR-26 anti-sweep (≤1 trophy/player/spin) | `antisweep-resolve.json` | **Story 6.6** | ✅ shipped |
| — FR-28 pity draw (the guaranteed consolation) | `pity-draw.json` | **Story 6.7** | ✅ shipped |
| 4 — canonical JSON + `bundle_sha256` (RFC-8785) | *(not yet)* | **Story 6.9** | ⏳ |
| 5 — end-to-end ceremony vector + suite completeness | *(not yet)* | **Story 6.11** | ⏳ |

⚠ **The gate numbers in the two right-hand rows above are the REVERSE of `SOLUTION-DESIGN:441-445`,
and this is recorded rather than silently renumbered.** That document numbers gate **4** as the
end-to-end ceremony vector and gate **5** as canonicalization + `bundle_sha256`; this table has them
the other way round and has since 6.3. Both readings agree on *what* is owed and on *who* owes it —
6.9 owns canonicalization, 6.11 owns the end-to-end vector — so nothing about the build is ambiguous,
only the label. Renumbering a shipped table is 6.9's or 6.11's call to make together with the
document; Story 6.7 noted it while adding its own row and deliberately changed neither.

Stage 2 is not one of §9.6's five numbered gates because §9.6 numbers the *stream* gates and Stage 2
consumes no stream — it is pure integer arithmetic over the frozen snapshot. AD-14 requires it to be
vector-gated all the same ("includes equal-value and equal-cross-product ties"), so it sits here
between gates 2 and 3, which is also the build order §9.6 prescribes (`Stage 2 + ladder` before
`Stage 1 + anti-sweep`).

**The FR-29 ladder is not a numbered gate for the same reason, and more strongly.** It consumes no
stream *by design*: rung 5 — the shared co-winner — is the deterministic terminal rung, so the ladder
draws **zero bytes** and takes no stream parameter in any of the three implementations. The signature
is the proof, and it is what keeps Story 6-4b's measured **22-byte** twelve-spin ceremony valid: a
seeded rung would move every byte position after every resolved tie. It sits next to `stage2-resolve`
because §9.6 prescribes `Stage 2 + ladder` as one build step.

**Anti-sweep is not a numbered gate for the same reason, and the reason is the same sentence.** The
pass takes no stream parameter in any of the three implementations, because re-resolving an overflow
is Stage 2 plus the FR-29 ladder and both are pure — so it draws **zero bytes** and the signature is
the proof. It sits after `stage1-pick` because that is the build order `§9.6` prescribes
(`Stage 1 + anti-sweep` as one step, before pity). AD-14 requires it to be vector-gated all the same
(*"anti-sweep ≤1 trophy/player/spin"*), and `§9.6`'s gate 4 additionally requires the **end-to-end**
vector to exercise an anti-sweep overflow — that one is Story 6.11's; this is the **unit** vector for
the pass.

**Pity is the exception to the three paragraphs above, and the exception is the point.** It is the
one resolver in this directory that **CONSUMES STREAM BYTES**, on its own domain-separated
`inclusivcup/v1/pity` stream — so where the ladder and anti-sweep prove a property by the *absence*
of a stream parameter, `pity-draw.json` proves the mirror: every case carries a `seed_hex`, a
per-draw `n`/`k`/`rejections`/`value` sequence and a `bytes_consumed` total, and a runtime
"it consumed exactly this much" assertion around the pass is the **gate** rather than the vacuous
assertion the 6-4b review deleted. It belongs beside `stage1-pick.json` on the cryptographic side of
the split, and it sits last because that is the build order `§9.6` prescribes — the sequence ends
*"→ pity"*.

**This directory is not finished.** Gate 4 (canonicalization + `bundle_sha256`, Story 6.9) and
gate 5 (the end-to-end ceremony vector with forced ties across *every* ladder rung, an anti-sweep
overflow and a pity draw, Story 6.11) are still to come. Everything the draw itself needs — the
block function, `uniform_int`, Stage 2, the FR-29 ladder, Stage 1, anti-sweep **and pity** — is here.
(⚠ That last sentence was **false** between Stories 6.6 and 6.7: it claimed the directory held
everything the draw needs while pity — a resolver that draws bytes and is a published bundle key —
was missing entirely. Corrected by 6.7, which is what filled the hole.)

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

### `ladder-resolve.json`

```jsonc
{
  "vector": "ladder-resolve",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",                              // the FIVE rungs and the VALIDATION ORDER, in full
  "value_encoding": "…",
  "exit_steps": [1, 2, 3, 4, 5],
  "stat_vocabulary": { "volume": [ …17… ], "rate": [ …4… ] },
  "absent_achievement_ts": "-1",
  "refusal_details": ["stage2", "award", "tied", "player", "internal"],
  "refusals": [
    { "why": "…", "detail": "award", "award": {…}, "tied": […], "players": […] }
  ],
  "cases": [
    {
      "name": "rung-1-a-VOLUME-secondary-breaks-the-tie",
      "note": "prose describing what this case pins",
      "award": { "deciding_stat": "kills", "class": "volume", "direction": "max",
                 "floor_rounds": 0, "floor_kills": 0,
                 "secondary_stat": "hs_kills",       // ⭐ null / omitted / "" all mean ABSENT
                 "eff_num_key": null, "eff_den_key": null },
      "tied": ["76561198000000011", "76561198000000022"],   // byte-lex, width >= 2
      "players": [
        { "steamid64": "…", "rounds_played": "30", "kills": "20", "idle_dq": false,
          "stats_int": { "volume": {…}, "rate": {…},
                         "secondary":  { "kills": "20", "hs_pct": { "num": "9", "den": "20" } },
                         "efficiency": { "kills": { "num": "20", "den": "1" }, … } },
          "h2h": { "<opponent>": { "kills": "9", … } },
          "achievement_ts": "5000" }
      ],
      "expected": { "kind": "winner", "steamid64": "…", "ladder_exit_step": 1 }
    }
  ]
}
```

⭐ **`ladder_exit_step` is as load-bearing as the winner, and every case pins it.** A vector that
pinned only *who* won would let a ladder that reached the right player **by the wrong rung** pass —
and Story 6.8 persists the step as `award_result.tie_ladder_exit_step`, so a wrong rung ships a
false explanation to the audience.

⭐ **A ladder-resolved outcome carries NO `deciding_value`, and both suites assert that.** The tie it
resolves carries none (Stage 2's `tie` arm has no value) and the ladder never re-derives one — a
fabricated `0` would be a plausible-looking lie rendered on stage. Go leaves the struct field at its
zero value; TypeScript omits the optional key. The invariant is `deciding_value` **XOR**
`ladder_exit_step`.

⭐ **`secondary` and each `h2h[opponent]` are the SAME class-shaped union** (`volume || rate`,
0024:650 and 0024:723): a **decimal string** for a volume key and a `{num, den}` object for a rate
key. `efficiency` is uniformly `{num, den}` — a volume `v` arrives as `{v, 1}`
(`snapshot_efficiency_form`, 0024:338-370, *the one definition site*). Both loaders branch on the
**JSON shape**, never on the vocabulary: consulting the 17/4 split there would re-implement the rule
under test, so a rung that read the wrong shape would be handed a value the loader had already
coerced into the right one.

⚠ **THE RULE ABOVE IS FOR THE TWO LOADERS, NOT FOR THE THREE RESOLVERS, AND THE DISTINCTION IS THE
WHOLE POINT** *(corrected by Story 6-5b, T9d — the sentence used to read as a blanket instruction and
a loader following it literally could never emit the L5 refusal row that exists)*. A **loader**
branches on the shape because it must not pre-judge the answer. A **resolver** — `statValue` in both
runtimes and `_stat_value` in the anchor — does the opposite: it derives the key's class from the
**vocabulary** (`_class_of(key)`) and then **refuses** a value whose shape disagrees. That refusal is
L5 itself, it has a row (`the secondary block carries a {num,den} PAIR under a VOLUME key`), and a
resolver that branched on the shape instead would have nothing to refuse — it would read whatever
arrived and compare it. Shape-first in the loader, vocabulary-first in the resolver; the disagreement
between the two is the defect being caught.

⭐ **`stat_vocabulary` travels in the file** because both runtimes necessarily restate 0023's closed
set in source — `worker/awards` is a leaf that cannot read the database, and `lib/roulette` may not
import `server-only` `lib/awards/catalog.ts`. That is four restatements with nothing tying them
together; both suites pin their own constant against this block by exact equality.

⚠ **`achievement_ts` is a decimal STRING even though it comfortably fits in 2^53.** The split is by
**provenance**, not magnitude: it comes from the snapshot, so it travels as a string like every other
snapshot value. `ladder_exit_step` and the floors come from the algorithm and the catalog's bounded
`int` columns and stay JSON integers.

⚠ **`refusal_details` declares FIVE and only the first FOUR are row-representable**, and `internal`
has **TWO producers whose unreachability arguments genuinely differ**. Do not collapse them into one
sentence — a later reader who "simplifies" this against the wrong reason removes a guard that is
load-bearing for the other:

1. **Rung 3's plural strict dominator** is unreachable by **ANTISYMMETRY**: `cmp(a,b) == -cmp(b,a)`,
   so `p` beating `q` means `q` does not beat `p`, so two players can never both beat everyone.
2. **`bestSurvivors`' empty best set** is unreachable by **ACYCLICITY** — strictly weaker than
   transitivity, which the comparator genuinely does *not* have (`0/0` compares equal to everything,
   so `0/0 ~ 10/5` and `0/0 ~ 6/5` while `10/5 > 6/5`). Every non-empty set has an unbeaten member
   while the strict part is acyclic. That is the property the negative-magnitude refusals protect: a
   negative half inverts one pair's comparison without inverting the others, which is exactly how a
   3-cycle forms.

Both are **typed refusals** rather than fall-throughs (Cuatro, 2026-08-04): falling through converts
a comparator bug into a silently *shared* trophy, indistinguishable from a legitimate rung-5
bottom-out. Both ladder suites now carry the declaration in words — a `detail` nothing inspects is a
compartment, not a contract.

⚠ **The `player`/`tied` boundary is not where the four-group reading suggests.** The published order
is **six** alternating groups, because the duplicate-`players` scan is part of *building* the index
that the tied-membership check then *reads*, so it refuses as `player` **before** membership refuses
as `tied`. All three implementations always did this; the document said otherwise until Story 6-5b
amended it (Cuatro: *amend the published spec, do not move the code*). Two refusal rows hold it
there.

#### The ladder cases that carry the weight

| Case | What only it can catch |
|---|---|
| `rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS` | ⭐ **L5** — the rung branches on the **KEY's** class, not `award.class`. A `volume` award with the rate secondary `hs_pct`: an implementation branching on `award.class` reads a `{num,den}` pair as a bare integer. A also has the *smaller* numerator and *smaller* raw `hs_kills`, so a naive numerator compare picks the other player. |
| `rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS` | ⭐ that rung 2 is a ratio of **two** ratios. `utility_damage / rounds_played`: A is 300/30 = 10, B is 400/50 = 8. Comparing `eff[eff_num_key]` alone picks **B**. An efficiency case both methods agree on proves nothing — the same finding 6-4a recorded for its float search. |
| `rung-2-four-term-products-past-2-pow-53` | ⭐ **L6's arithmetic width.** Four multiplications of unbounded magnitudes per side: `(2^53+1)^2` against `(2^53+1)^2 − 1`, a difference of **one** in ~2^106. `int64` wraps, a double rounds and picks the other player, and `JSON.parse` corrupts it before any arithmetic — which is why every magnitude here is a decimal string. This is why `math/big`'s ban gains `ladder.go` where 6-4b was told not to widen it. |
| `rung-3-a-ONE-SIDED-h2h-record-is-not-comparable` | ⭐ **L8** — an absent `h2h` key is *never met*, **never a zero**, and both directions are required. A records 5 against B; B has no record of A. Reading the absent side as 0 makes A a dominator and exits at rung **3** instead of rung 4, with a different winner. |
| `rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone` | ⭐ "beats **all**", not "beats **any**", and that a skip eliminates **nobody**. A beat B, C beat B, A and C never met — a relaxed comparator finds two claimants. |
| `rung-4-the-MINUS-ONE-sentinel-must-NEVER-win` | ⭐⭐ **L9.** `-1` is the published absent sentinel *and* numerically the smallest value in the column, so a naive `min` crowns the player with **no approved rows at all** — for a rung whose whole meaning is "did it first". The guard re-derives that the naive minimum really would have picked the sentinel holder. |
| `rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5` | ⭐⭐ the `deferred-work.md:281` shape, answered. `approve_match` stamps one transaction timestamp on every row of a match, so both competitors of a 1v1 duel tie **exactly** — rung 4 provably cannot separate them, and rung 5 is what resolves it. |
| `a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5` | ⭐⭐ **L3** — each rung narrows the **survivors**, never restarting from the original tie. The player rung 1 eliminates holds the **strictly earliest** timestamp in the whole tie, so a rung 4 that re-read `tied` would crown them, at a different rung, over a player already out. |
| `rung-keys-spelled-as-explicit-JSON-null` / `-OMITTED-` / `-as-EMPTY-STRINGS` | ⭐ the **loader rule**, and what makes `stage2-resolve.json` regenerable. Three rows whose only difference is how absence is spelled, with byte-identical expected blocks — that identity *is* the assertion. `""` is in the list because Go has no nullable string: `Award.SecondaryStat` is a plain `string` whose zero value is what `encoding/json` leaves for both `null` and an omitted key, so Go cannot tell "absent" from "present and empty" and the other two must agree. |
| `rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim` / `rung-2-…-PLUS-INFINITY` | that 6-4a's **S3** semantics are inherited verbatim rather than "fixed": `0/0` ties everyone (so a rung can narrow and resolve nothing) and `n/0` with `n > 0` beats every finite value. Filtering den-0 out is the silent argmax S3 forbids. |
| `…-MALFORMED IN TWO WAYS AT ONCE` (refusal) | ⭐ **validation order is contract.** A width-1 `tied` whose award *also* names a bogus `secondary_stat`. The published order puts the **award** group before the **tied** group, so it must refuse as `award`; every other row is malformed in exactly one way and cannot see the difference. This is 6-4b's headline defect closed from the first commit rather than after a review. |

#### The rows Story 6-5b added, and the hole each one closes

Every row below exercises a path all three implementations **already had** and **no row reached**.
None of them adds behaviour; the one document that moved is the `spec` string, and it moved because
the code was right and the text was wrong.

| Case | What only it can catch |
|---|---|
| `rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms` | ⭐⭐ rung 2's **headline property**, previously untested. Every other rung-2 row names volume keys, and a volume `v` arrives as `{v, 1}` — so two of the four factors were the literal `1` and an implementation that **dropped both the `.den` and `.num` factors** was byte-identical on all 24 committed cases, the 2^53 row included. Both slots here are rate keys: `adr` 200/20 over `entry_success` 100/40 beats 300/30 over 100/30, while the both-dropped mutant compares 200/100 against 300/100 and picks the other player. |
| `rung-2-under-direction-min-picks-the-SMALLEST-ratio` | rung 2 had **no `min` row** — rungs 1, 3 and 4 each had one — so a mutation hardcoding `max` at rung 2 alone survived. The loser under `min` also holds the earlier timestamp, so a skipped rung 2 crowns them too. |
| `rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS` | **L3 at rung 2.** All four committed rung-2 rows exited *at* step 2, so `survivors = narrowed` was never read again and deleting the line reddened nothing. Here two players tie at 10 and a third is eliminated — and the eliminated one holds the strictly earliest timestamp, so dropping the narrowing crowns a player rung 2 already removed. |
| `rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung` | the **`0/0` half of S3 at rung 2**, promised by the rung-2 efficiency-pair decision and missing (only the `n/0` half existed, and the `0/0` row that did exist was at rung 1 — a different arithmetic path). It is the shipped `kills/deaths` pair's second degenerate case: a player with zero of both can never be eliminated. |
| `rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set` | ⭐⭐ rung 4's narrowing, never load-bearing before: every committed rung-4 case had `narrowed == present == survivors`. Width 3, one `-1` holder and two real ties, so the shared set must **exclude** the sentinel holder. An implementation that *skipped* rung 4 whenever it could not resolve hands a co-winner's trophy to a player with **no approved rows at all**. |
| `rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED` / `rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED` | the **early return** at rungs 1 and 2, unpinned. Falling through with a single survivor returns the *same* winner at a **fabricated** exit step, because rung 2's `best` of one is that one and rung 3's dominator loop is vacuously true. Rung 3→4 precedence was pinned; rungs 1 and 2 were not. The rung-2 row goes further: rung 3 would crown the **other** player, so it changes the winner as well as the step. |
| `rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not` | **L3 at rung 3.** No row both narrowed *and* populated `h2h`, so an implementation computing dominators over the original `tied` was byte-identical everywhere. Over the survivors A dominates and wins at step 3; over the full tie nobody does, rung 3 skips, and rung 4 crowns a third player at step 4. |
| `a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3` | there was **not one `class: rate` award** in the file, so rung 3's rate arm — where `h2h[p][q][stat]` is a `{num,den}` pair and the dominator test cross-multiplies — was never entered, although four of the twelve shipped awards are `rate`. 6/30 beats 7/40, so a naive numerator compare picks the other player. |
| `an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4` | `achievement_ts` never took `0` — the value adjacent to the sentinel — so an absent-filter written `ts <= 0` rather than `ts != -1` passed every row. |
| `an-achievement_ts-past-2-pow-53-is-compared-EXACTLY` | the provenance rule's own proof. 2^53+1 against 2^53: a `Number`-parsing verifier reads **both as 2^53**, sees them equal and bottoms out **shared at step 5** — a different outcome *kind*, not merely a different winner. |
| `a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung` | no case carried a non-tied player, so an implementation iterating the **roster** instead of the **survivors** was indistinguishable — and the roster *is* the production shape, since 0024 freezes every rostered player and 6.6 drives a reduced tie against that same full roster. |
| `ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks` | the absent-container rule had **no ladder-side row**: every player emitted all three blocks, so TypeScript's `container(undefined)` and Go's nil-map read were entered by nothing. |
| duplicate-`players` (refusal, single-defect) and the `player`-before-`tied` pair (refusal, doubly malformed) | ⭐ the guard that **corrected the published spec**. The duplicate scan is live in all three implementations and had no row anywhere, so it was deletable in every one with every gate green — and an input malformed across the boundary refuses `player`, where the old four-group text predicted `tied`. |
| `stage2`-before-`award` and `tied`-before-`player` (refusals, doubly malformed) | the two remaining **adjacent order boundaries**. ⚠ The third — the id-shape / duplicate / order checks *inside* the `tied` group — is pinned only as "all three refuse it as `tied`": a closed set of five labels has nothing finer to say, and that limit is recorded rather than papered over. |
| efficiency **absent key** and **not-a-pair** (refusals) | `efficiencyPair`'s two guards, live in all three implementations and reachable from no row. The not-a-pair row is why `efficiency` is now rendered by the same class-shaped renderer `secondary` and `h2h` use — the old renderer could not *write* the shape the guard is about. |
| award **class**, **negative floor** and **empty `deciding_stat`** (refusals) | all four clauses of the Stage-2 award surface, of which only `direction` had a row. TypeScript **transcribes** `validateAward` rather than importing it, so three of the four could have drifted from `stage2.ts` with every gate green. |
| `a-SHARED-co-winner-shelf-is-CLAMPED-to-table_max-after-the-minimum` (`stage1-pick.json`) | W8's clamp on the **shared** arm: the one shared row's co-winners sat at shelves 0 and 1, both inside the table, so the clamp was an identity there and the arm could have shipped without one — an out-of-range **panic** in Go against a silent `undefined as number` in TypeScript. |

#### The rows Story 6-5b's own CODE REVIEW added

Six boundaries no acceptance criterion had named, found by an independent edge-case pass over the
finished story and patched into it on Cuatro's call (2026-08-06) rather than split with 6.11 — 6.6
drives this ladder next and should inherit it whole. As above: **none of them changes behaviour.**
Every one is an input all three implementations already handled correctly and no row observed.

| Case | What only it can catch |
|---|---|
| `rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one` | ⭐⭐ **`n/0` under `min` existed in NO row of EITHER file.** Every zero-denominator row here *and* all four in `stage2-resolve.json` are `direction: max`, so a mutant that short-circuits "a zero denominator wins the rung" — ignoring `direction` entirely — was byte-identical on all 37 ladder and all 28 Stage-2 cases. Both runtimes *document* the behaviour and nothing exercised it. The `n/0` holder also carries the earlier timestamp, so the mutant, a hardcoded `max` and a skipped rung 2 all crown the same wrong player. On the shipped `El Inofensivo` this is the difference between the least harmful player and the most. |
| `rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through` | the two degenerate ratios had **never met in one race**. Cross-multiplication makes `n/0` and `0/0` **equal**, so neither eliminates the other and both ride to rung 5. An implementation reading them as IEEE doubles narrows to one and returns **winner at step 2** — a different outcome *kind*, winner and exit step from one comparison the file could not see. |
| `rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE` | rung 3's **conjunction**, never load-bearing for a *positive* result: every rung-3 win in the file was decided over exactly two survivors, where "dominates every other" collapses to "beats the one opponent". Over three, A beats both while B beats one — a "beats at least one" implementation finds **two** dominators and raises the plural-dominator `internal` refusal instead of crowning anybody. |
| `a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way` | **L5's mirror.** The file pinned a volume award with a rate secondary; the reverse pairing appeared nowhere, because the only `class: rate` award carried no secondary at all. A rule that holds in one direction only is not a rule. |
| `a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH` | ⭐⭐ the only row with a roster wider than the tie **exited at rung 1**, so rungs 2–5 had never run against one. Three counterfactuals on one row: validating `achievement_ts` over `players` rather than `tied` **refuses** an input the other two resolve; a roster-wide rung 3 crowns the outsider at step 3; a roster-wide rung 4 crowns them outright, because `-5` is not the sentinel and survives the absent-filter. This is the shape 6.6 produces. |
| groups **5↔6** (refusal, doubly malformed) | ⛔ the last unpinned adjacent pair, and **the only one whose wrong order is not a mislabelled refusal but a crash.** A tied member with no snapshot row *and* a present row whose `achievement_ts` is below the sentinel: membership is checked first, so it refuses `tied`. An implementation checking timestamps first dereferences an index entry that does not exist — a nil-pointer **panic** in Go and a raw `TypeError` rather than a typed `LadderError` in TypeScript. Every other boundary row distinguishes two *labels*; this one distinguishes a refusal from a crash. |
| negative **`floor_kills`** (refusal) | the other half of the Stage-2 surface's fourth clause, whose `floor_rounds` half already had a row. ⚠ The clause is a conjunction and only the **sign** half is row-representable: a non-integer floor (`1.5`) is not expressible, because both loaders type the field as an integer and it would fail to parse before any ladder code ran — the row would pin the JSON decoder, not the guard. Recorded, like the intra-`tied` ordering limit, rather than faked. |

**DECISION H** (Cuatro, 2026-08-04) is the product call here, and it answers a **named blocker**
(`deferred-work.md:281`): rung 5 — the shared co-winner — **is** the deterministic terminal rung,
satisfied by *recognising* the rung FR-29 already ends with rather than by adding a seeded one. A
seeded rung would make the ladder a stream **consumer**.

⚠ **The expectation it shipped with was MEASURED FALSE by the same story, and the correction is
recorded rather than quietly dropped** *(Story 6-5b, T9a — this paragraph used to end "shared
trophies are common")*. The **mechanism** is exactly as the blocker described: **14 of 14** duel pairs
carry a byte-identical `achievement_ts`, because `approve_match` stamps one transaction timestamp on
every row of a match (0024:898-907), so rung 4 provably cannot separate two players of one duel. The
**outcome** is unreachable on this corpus: **0 of the 5** real ties contains a duel pair — every tie
is assembled *across* matches, whose approvals are separate transactions — so rung 4 separates all
five and **0 of 12** awards end shared. The cause is structural to 1v1 wingman: a player plays one
match, so two opponents are never tied against each other on a tournament-wide total. The shared rung
stays correct, necessary and **untriggered**, which is precisely why it is gated by the rows in this
file rather than by production traffic. `EXPERIENCE.md:123` calls it "a designed outcome, never an
error state"; re-measure both numbers before quoting either for a 5v5 format.

**DECISION I** covers the three rules no spec document states — each rung **narrows** the survivors,
a NULL rung key is a deterministic **skip**, and `direction` inverts rungs 1–3 but **never** rung 4
(it is a recency rule, not a stat). All three are decided in this file and pinned by their own rows.

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
| `an-injected-ladder-RESOLVES-a-tie-that-would-otherwise-refuse` | ⭐ Story 6.5, and the row that un-halts the ceremony. The same tie that refuses one row below is resolved by the injected FR-29 ladder, and the **resolved** winner's shelf is what is looked up: B sits at shelf 1 and weighs 40, where the tie's *first* member would have weighed 100. The `ladder` key is absent on all fourteen pre-6.5 rows, which **is** the no-ladder contract. |
| `a-SHARED-co-winner-weights-at-the-MINIMUM-shelf` | ⭐⭐ Story 6.5's published co-winner rule, and the only row that can pin it. Both co-winners have **different** shelves (0 and 1), so `min` gives `table[0] = 100` and `max` would give `table[1] = 40` — a different total, a different `n` and a different drawn award. FR-26 biases toward the empty shelf, and `min` is the only aggregation that keeps a co-win from *reducing* the luck owed to the emptiest shelf in it. The guard re-derives that the shelves genuinely differ, without which the row cannot distinguish the two rules at all. |
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

### `antisweep-resolve.json`

```jsonc
{
  "vector": "antisweep-resolve",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",                              // the VALIDATION ORDER and the pass, in full
  "value_encoding": "…",
  "outcome_kinds": ["winner", "tie", "no_eligible_players", "no_awardable_value", "shared"],
  "unreachable_outcome_kinds": ["tie"],     // ⭐ the kind no assignment row may carry
  "exit_steps": [0, 1, 2, 3, 4, 5],         // 0 = no ladder ran
  "refusal_details": ["live", "stage2", "ladder", "internal"],   // ⚠ the last is NOT row-representable
  "refusals": [
    { "why": "…", "detail": "live", "defects": ["live", "stage2"], "live": […], "players": […] }
  ],
  "cases": [
    {
      "name": "a-SINGLE-OVERFLOW-re-resolves-award-2-to-the-NEXT-ELIGIBLE-player",
      "note": "prose describing what this case pins",
      "live": [ { "award_id": "aw-01", "priority": 1, "award": {…} } ],   // supplied in ANY order
      "players": [ … the same AD-19 rows `ladder-resolve.json` uses, all four blocks … ],
      "expected": {
        "results": [                        // in ASCENDING PRIORITY — the PROCESSING order
          { "award_id": "aw-02", "priority": 2, "kind": "winner",
            "steamid64": "…", "ladder_exit_step": 0,
            "swept_out": ["…"], "reresolved": true }
        ],
        "assigned": ["…", "…"]              // byte-lex; every player who won anything this spin
      }
    }
  ]
}
```

⭐ **`swept_out` and `reresolved` are as load-bearing as the winner, and both are facts about the
INPUT.** `swept_out` is every rostered player removed from *this* award's candidate set because they
were already assigned this spin — whether or not any of them would have won — and `reresolved` is
exactly `swept_out.length > 0`, i.e. *"this award's Stage 2 ran over a reduced set"*, **not** *"the
winner changed"*. The two readings diverge on every clean spin, and the `a-CLEAN-spin-…` row is the
one that shows it: awards 2 and 3 there resolve over reduced sets and crown exactly the players the
full sets would have crowned. A vector pinning only the winner would let a pass that reached the
right player **without ever removing anyone** pass every row — and the removal is the whole story.

⭐ **`ladder_exit_step` rides on EVERY row, with `0` meaning "no ladder ran".** Go carries
`LadderExitStep int` on every outcome while TypeScript omits the key (`deferred-work.md:307` tracks
that asymmetry for 6.8/6.9), so a file that also omitted it would be a **third** spelling of NULL. It
also makes the file's sharpest row expressible: an overflow whose re-resolution exits the ladder at a
**different rung** from the one the original resolution took. The `deciding_value` **XOR**
`ladder_exit_step` invariant `ladder-resolve.json` established is carried through and asserted on
every `winner` row.

⚠ **`swept_out` is what carries DECISION F.** When removal empties a later award's candidate set,
Stage 2 returns `no_eligible_players` — the *same* kind it returns when nobody cleared the FR-21
floors, and those are different facts for Story 6.7's pity draw and Story 6.8's reveal copy. A
non-empty `swept_out` on such a row is **exhaustion**; an empty one is "nobody qualified". The
distinction lives on the row rather than in a sixth `OutcomeKind`, because `outcome_kinds` is one
closed set across the engine, pinned by exact equality in both suites and in two other files here.
`unreachable_outcome_kinds` states the narrower truth as data: a **tie** never survives this pass,
because every tie goes through the ladder — and an implementation that skipped the ladder would emit
one.

⭐ **`defects` makes validation ORDER checkable in the file rather than only in prose.** Every
refusal row carries the list of defects it holds, in the order the published validation order visits
them, and `detail` must equal `defects[0]`. Two rows carry **two** entries — the doubly-malformed
rows — and the generator re-derives the second defect on its own, asserting that it independently
refuses and under a **different** label. `ladder-resolve.json`'s doubly-malformed rows carry that
fact only in their `why` string; a reader had to take it on trust. ⚠ The limit is the same one
recorded there: two defects **inside one group** (say a duplicate `award_id` and a duplicate
`priority`) both refuse as `live`, and a closed set of four labels has nothing finer to say. That is
recorded rather than faked.

#### The anti-sweep cases that carry the weight

| Case | What only it can catch |
|---|---|
| `the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY` | ⭐⭐ the configuration that actually ships. UX fixes the pacing at one award per spin, so with a single live award the `assigned` set is still empty when the only award resolves and **FR-26's cap cannot fire** — not merely "does not", but *cannot*. The row records the consequence as data; the story records it as a measured zero. |
| `a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING` | ⭐ that `reresolved` is about the INPUT. Three awards, three winners, nobody wins twice — yet awards 2 and 3 still run over reduced sets. Its guard re-derives every award's winner over the **full** roster and requires it to match. |
| `the-live-set-supplied-OUT-OF-PRIORITY-ORDER-resolves-IDENTICALLY` | the sort itself. Byte-identical inputs to the row above except the supplied order (3, 1, 2), so the expected block must be byte-identical — and that identity *is* the assertion. The supplied order is neither ascending nor descending, so it separates *no sort at all* from *sorted the wrong way*. |
| `the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy` | ⭐⭐ the DIRECTION of the sort, in `EXPERIENCE.md:169`'s own words: *"they take the higher-priority one; the other passes to the next eligible Player."* Both awards' unreduced winner is the **same** player and they are supplied largest-priority-first, so descending processing (or none at all) swaps which trophy that player keeps. |
| `a-SINGLE-OVERFLOW-…` / `a-CASCADE-…` / `TWO-DIFFERENT-players-…` | the removal, the *accumulated* assigned set, and two independent decisive removals. The cascade's guard re-derives that award 3's winner over the roster-minus-the-first-sweeper **is** award 2's re-resolved winner; without that it is two unrelated overflows. |
| `an-overflow-re-resolves-through-the-LADDER-and-EXITS-AT-A-DIFFERENT-RUNG` | ⭐⭐ that re-resolution is a **full Stage-2 re-run** and not a pop-the-winner. Over the full roster the award is a 3-way tie the ladder resolves at rung **1**; over the reduced set rung 1 cannot separate the survivors and rung **4** decides. A shortcut that popped the winner out of the old tie reaches the same player at the **wrong** rung — and 6.8 persists the rung. |
| `an-overflow-re-resolves-to-a-SHARED-outcome-…` | one award assigning **two** players at once. ⭐ Measured context: 6.5's BAR found **0 of 12** awards ending shared on the real corpus, because in 1v1 wingman two opponents are never tied against each other on a tournament-wide total — so this path is vector-only in production, exactly like the ladder's rung 5. |
| `a-CO-WINNER-of-an-EARLIER-shared-award-is-the-one-SWEPT-OUT` | ⭐⭐ *"Co-winners all count"*. The later award's unreduced winner is the **second** co-winner, so a pass that credited only `winners[0]` hands them a second trophy in one spin — the silent violation `review-data-integrity.md:175-179` names and `unique (spin_id, winner_entry_id)` backstops. |
| `EXHAUSTION-…` / `an-award-arrives-as-no_eligible_players-BEFORE-any-removal-…` | read as a **pair**: the same outcome kind with a non-empty and an empty `swept_out`. The exhaustion row's guard re-derives that the eligible set was **non-empty before** removal, without which it is indistinguishable from an award nobody qualified for. |
| `a-REDUCED-set-drops-a-max-VOLUME-awards-best-value-to-ZERO-…` | ⭐⭐ DECISION E firing on the **reduced** set, which is one of the three reasons re-resolution must be a re-run. Its guard re-derives that the best value was **non-zero before** removal. DECISION K is asserted too: the suppressed set travels and **none of it is assigned**. |
| `a-reduced-tie-of-WIDTH-1-is-NEVER-handed-to-the-ladder` | ⭐ the ladder REFUSES `tied.length < 2` (L11) and Stage 2 cannot emit such a tie — so the only way to produce one is to build it. Its guard re-derives that the unreduced outcome is a tie of width exactly **2** containing the removed player. The pop-the-winner shortcut **refuses** this row where the re-run resolves it: a different outcome *kind*, not a different winner. |
| `…MALFORMED IN TWO WAYS AT ONCE` ×2 (refusals) | ⭐ validation order is contract. One carries a duplicate **priority** over a live set that *also* holds a Stage-2-malformed award; the other a duplicate **award_id** over a players list that *also* holds a duplicate `steamid64` — the second being a genuinely plausible alternative design (validate the roster up front, since it is the same for every award). Both must refuse `live`. |

**DECISION D** (Cuatro, 2026-08-07) is the product call here: an overflow re-resolves by a **full
Stage-2 re-run over the reduced set**, never by popping the removed winner out of the previous
outcome. Neither `SOLUTION-DESIGN:426-427` nor `SPINE:220` says which, and the three reasons are each
independently sufficient — rung 3 is defined over the *remaining* set, `best` is a **set** whose
membership the removal changes, and DECISION E's zero carve-out is evaluated against the reduced
set's best value. **DECISION E'** is its companion: removal is applied to the **candidate set before
Stage 2 runs**, never to an `Outcome` afterwards, which is what makes a shared trophy containing an
already-assigned player impossible by construction rather than defensively handled.

**DECISION G** is the rule no document states and two honest implementers split on: Stage 1's luck
weighting is computed over **pre-anti-sweep** provisional winners, from the shelf frozen at spin
start — so a category's weight can be justified by a player who then does not win it. Recomputing
after each assignment would make the ceremony depend on resolution order and unverifiable from the
bundle. **Do not recompute**, and the pass therefore has no `shelf` parameter at all.

### `pity-draw.json`

```jsonc
{
  "vector": "pity-draw",
  "algo_version": "inclusivcup-roulette-1.0.0",
  "spec": "…",                              // the VALIDATION ORDER and the whole pass
  "value_encoding": "…",
  "label": "inclusivcup/v1/pity",           // ⭐ ONE label for the whole file — the domain separator
  "refusal_details": ["stream", "players", "shelf"],
  "row_representable_refusal_details": ["stream", "players", "shelf"],   // ⭐ equal, deliberately
  "refusals": [
    { "why": "…", "detail": "stream", "defects": ["stream", "players"],
      "seed_hex": "1b3c…279c",
      "label": "inclusivcup/v1/stage1/spin/1",   // OPTIONAL — the wrong-label row
      "pre_consumed": 3,                          // OPTIONAL — the already-drawn row
      "players": [ … ], "shelf": { … } }
  ],
  "cases": [
    {
      "name": "a-THREE-member-winless-set-DEMONSTRABLY-REORDERS",
      "note": "prose describing what this case pins",
      "seed_hex": "1b3c…279c",              // ⭐ PER CASE — one row runs on ff…ff to force a rejection
      "players": [ … AD-19 rows, the same shape `stage2-resolve.json` uses … ],
      "shelf": { "<steamid64>": 1 },        // ⚠ MAY BE OMITTED — an absent container is the empty one
      "expected": {
        "winless":      ["…"],              // shelf == 0 AND idle_dq == false, BYTE-LEX
        "reveal_order": ["…"],              // the seeded permutation OF THAT SET
        "draws": [ { "n": 3, "k": 1, "rejections": 0, "value": 2 } ],
        "bytes_consumed": 2
      }
    }
  ]
}
```

⭐ **`bytes_consumed` and the per-draw `n` sequence are as load-bearing as the order.** A file that
pinned only `reveal_order` would let an implementation that reaches the right permutation by a
*different* draw sequence pass every row — and 6.9's browser has to consume the same **bytes**, not
merely reach the same answer. Every case pins both, and the generator re-derives the total from the
steps (`k × (1 + rejections)` summed) so the summary cannot drift away from what it summarises.

⭐ **`winless` and `reveal_order` are two fields, never one.** The outcome is invariant and only the
order is drawn, so `reveal_order` is always a **permutation** of `winless` — same length, same
members, no additions, no drops — and the generator asserts that multiset identity on every case
before writing it. Publishing one as the other is the single most destructive thing a caller can do
with this result, and with one field it would be a typo rather than a type error.

⭐ **`n = 1` is never drawn, and that is why the loop bound is pinned by `draws` rather than by the
byte count.** `uniform_int(s, 1)` is legal and reads **zero** bytes (`minimal_k(1)` gives `k = 0`),
so an implementation that *does* call it for a one-member set is byte-identical to one that does
not. The `draws` array separates them: on the one-member row it is **empty**.

#### The pity cases that carry the weight

| Case | What only it can catch |
|---|---|
| `an-EMPTY-roster-…` / `an-ABSENT-players-and-shelf-CONTAINER-…` | AC3's zero case, in both spellings. The second row **omits both keys**, so Go's nil slice / nil map, TypeScript's `undefined` and Python's `None` all have to normalise to the empty container (P11, Cuatro's call at the 6-4b review) — and its expected block must be byte-identical to the explicit row's. |
| `a-roster-where-EVERY-player-HOLDS-a-trophy-…` | the empty winless set for a **non-empty** roster — the only one of the two empty rows that can tell a filter which works from a filter which never runs. |
| `a-ONE-member-winless-set-…` | ⭐ that a one-member set **resolves** rather than refusing, and that the loop body never runs. Zero bytes *and* an empty `draws` array; the byte count alone cannot distinguish it from an implementation that drew `n = 1`. |
| `a-TWO-member-winless-set-COSTS-ONE-BYTE-and-the-SELF-SWAP-…` | ⭐⭐ that `bytes_consumed` is load-bearing **independently of the order**. Two members is the smallest reorderable set; on this seed the single draw returns `j = i`, a legal **self-swap**, so the reveal order comes out equal to byte-lex while the draw still cost a byte. A vector pinning only `reveal_order` would accept an implementation that never drew at all. |
| `a-THREE-member-winless-set-DEMONSTRABLY-REORDERS` | the no-op shuffle. Returning `winless` as `reveal_order` is the cheapest way to satisfy the permutation invariant vacuously, and this is the smallest row that kills it. |
| `the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY` | ⭐⭐ the canonical sort. Byte-identical inputs to the row above except the **supplied order**, so the expected block must be byte-identical — and that identity *is* the assertion. Written in the same edit as the sort, because Story 6.6's mutation pass found precisely this survivor: every fixture roster there was pre-sorted, so deleting the sort reddened nothing. |
| `a-REJECTION-inside-uniform_int-is-BYTE-ACCOUNTED-…` | the rejection path, byte-accounted the way `prng-uniform-int.json` does it. Runs on the `ff…ff` seed, whose first pity byte is **255** — rejected at `n = 3`, where `limit = 255`. ⭐ The generator re-derives the counterfactual: a modulo-**biased** implementation would compute `255 mod 3 = 0` and reach a **different reveal order**, so the row discriminates on both axes rather than on the byte count alone. |
| `an-idle_dq-player-is-EXCLUDED-while-a-player-with-ZERO-approved-rows-is-INCLUDED` | ⭐⭐ AC1's inversion in one row. `idle_dq` at the snapshot layer means **fully DQ'd** — at least one approved `stat_row` and *every* one of them idle (`0024:584-589`) — so a player carrying it sits at shelf 0 and is still excluded, while beside them a player with **zero approved rows** is `false` with zero stats: winless, not disqualified, and one that 0024 says in as many words *"pity must still be able to reach"*. That same player is below both FR-21 floors, so the row is P7's too. |
| `the-winless-set-is-a-STRICT-SUBSET-in-the-MIDDLE-of-byte-lex-order` | an off-by-one in the filter, which is invisible when the winless set is a prefix or a suffix. Both ends of the byte-lex roster are held by trophy-holders. |
| `an-ABSENT-shelf-key-is-shelf-ZERO` / `an-EXPLICIT-shelf-0-…` | read as a **pair**: W8's *"an ABSENT player is shelf 0 … never an error"*, mirrored verbatim, with the two spellings producing byte-identical expected blocks. |
| `the-SHIPPED-floors-shape-…-BELOW-both-FR-21-floors` | ⛔⛔ **the configuration that actually ships.** On the real corpus **0 of 28** players clear `floor_rounds = 24` / `floor_kills = 20`, so every award resolves `no_eligible_players`, no shelf leaves 0, and the winless set is the **entire roster**. This row is that shape at reduced scale, and it is the file's strongest **P7** row: under an implementation that re-applied the floors inside pity the winless set here would be **empty** rather than everyone — the difference between FR-28 working and SM-2 being unachievable by construction. |
| `…MALFORMED IN TWO WAYS AT ONCE` ×2 (refusals) | ⭐ validation order is contract. The published order is **stream → players → shelf**, so its two *adjacent* boundaries each get a row malformed on both of its sides: a wrong-label stream over a roster that also holds a duplicate `steamid64` (must refuse `stream`), and a duplicate `steamid64` over a shelf that also holds a negative count (must refuse `players`). The generator re-derives each second defect **on its own** and requires it to refuse under a *different* label — a doubly-malformed row whose second defect turned out to be harmless would recreate 6-4b's headline blindness while looking like the fix. |

**DECISION D** (Cuatro, 2026-08-07) is the product call here, and it is the clause two honest
implementers realise differently: neither `SPINE:221` nor `§9.4:427-429` says **which** shuffle, and
*"seeded reveal order"* is satisfied by any of them while every implementation still calls itself
Fisher–Yates. The variant is **Durstenfeld descending** over the byte-lex-sorted set —
`for i = len-1 down to 1: j = uniform_int(s, i+1); swap(a[i], a[j])`, where `i == j` is a legal
self-swap. Three properties earned it: the per-step `n` is unambiguous (`i+1`, strictly decreasing),
it terminates at `i = 1` so **`n = 1` is never drawn**, and it is the form `uniform_int`'s
`[1, MaxN]` contract fits with no special case. ⛔ **The rejected alternative is recorded so the next
reader does not re-open it:** the ascending sweep `for i = 0 to len-2: j = i + uniform_int(s, len-i)`,
whose last step draws `n = 1` for zero bytes unless the bound is trimmed — an ambiguity the vector
would then have to arbitrate instead of the spec. The generator asserts the emitted `n` sequence is
exactly `len … 2`, so an ascending implementation reddens at the **anchor**, not only in the suites.

**There is deliberately no `internal` refusal detail**, and the absence is argued rather than
overlooked. `antisweep-resolve.json` declares one because `Ladder` is an **injected port** that can
hand the pass an outcome no code in the module built. Pity has no such port: every value it decides
from is either a plain input it has just validated or the return of `uniform_int`, whose `[0, n)`
contract is pinned by gate 2 in the same three implementations. A fourth label would be a
compartment rather than a contract — a value no suite could ever drive. `refusal_details` and
`row_representable_refusal_details` are therefore **equal**, and both keys are emitted so that
equality is data both suites assert rather than prose a reader must trust. The one arm no *row* can
express is `stream` with **no stream at all**; that half is driven by each runtime's own suite,
exactly as `TestStage1PickRefusesANilStream` drives Stage 1's.

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

All seven files are generated by a **third** implementation —
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
python roulette/vectors/generate_vectors.py           # regenerate all seven files
```

For `ladder-resolve.json` the anchor is arithmetic, as it is for `stage2-resolve.json`: Python's
`int` is unbounded by construction, which is exactly the property Go takes from `math/big` and
TypeScript from `BigInt`, and it is what the four-term rung-2 products need. It carries **no**
`seed_hex` and **no** byte accounting at all — the ladder is not on the cryptographic axis, because
it draws nothing.

`antisweep-resolve.json` is the same: no seed, no label, no byte accounting, because the pass takes
no stream. Its anchor is **compositional** rather than arithmetic — `resolve_spin` performs no
comparison of its own and delegates every decision to the same `resolve_stage2` and `resolve_ladder`
that produce the two files above, which is precisely the property the Go and TypeScript modules must
mirror (⛔ neither may import `math/big` / reach for `BigInt` in this pass; `prng_test.go`'s
exception list was deliberately **not** widened for `sweep.go`). ⚠ Its independence carries the same
qualification `deferred-work.md:300` and `:318` record for the two files before it, and one more:
the *algorithm* is transcribed from `SOLUTION-DESIGN §9.4` and `SPINE:220`, which together are four
sentences, while the DECISIONS below them (D, E', F, G, K) were authored in the same slice as both
runtimes and are agreed rather than independently derived. That is a weakening, not a falsification —
each decision is stated in the `spec` string and pinned by rows a wrong choice reddens — and its
home is 6.11, alongside its two predecessors.

`pity-draw.json` is back on the **cryptographic** axis, where `stage1-pick.json` is and where the
three pure passes are not: every `value`, every `rejections` count and every `bytes_consumed` comes
from the same `Stream` and `uniform_int` that produce `prng-uniform-int.json`, so a pity row is only
as trustworthy as the stream underneath it — and that stream is already independently pinned by
gates 1 and 2. Its **algorithm**, by contrast, is transcribed from two sentences (`SPINE:221` +
`§9.4:427-429`) which do not name a shuffle at all; **DECISION D** picks one, and it was authored in
the same slice as both runtimes rather than derived independently. ⚠ That is the same weakening
`deferred-work.md:300` and `:318` record for the three files before it — a weakening, not a
falsification, since the decision is stated in the `spec` string and pinned by rows a wrong choice
reddens (the anchor itself asserts the emitted `n` sequence is `len … 2`). Its home is 6.11,
alongside its predecessors.

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
