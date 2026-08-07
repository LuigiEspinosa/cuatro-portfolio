#!/usr/bin/env python3
"""Generate the golden vectors from the spec — a THIRD implementation.

WHY THIS FILE IS COMMITTED. Every expected value in `prng-block.json`,
`prng-uniform-int.json` and `stage2-resolve.json` is produced here, by an implementation
that is neither Go's `crypto/hmac`/`math/big` nor the browser's SubtleCrypto/BigInt. That
is what makes the vectors an external anchor rather than a transcript of one of the two
implementations under test (AD-14: "a cross-language golden-vector suite gates the build").

The 6.3 code review found that leaving this script out of the repository made a deleted
file the de facto reference: if it had a bug, Go and TypeScript would conform to it
identically and every gate would stay green. It is committed so the reference is
auditable, re-runnable, and extensible by 6.11.

THIS FILE IS WRITTEN FROM THE SPEC TEXT ONLY. Do not "fix" it by reading
`worker/awards/prng.go` or `lib/roulette/prng.ts` — that would destroy the whole point.
The spec it implements, transcribed from SOLUTION-DESIGN §9.1 / ARCHITECTURE-SPINE:215-217:

    seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
    block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # 32 bytes, i from 0
    stream(L)   = block(0,L) || block(1,L) || block(2,L) || …           # left-to-right

    uniform_int(stream, n):
        k     = minimal integer with 256^k >= n        # n = 1 -> k = 0 (DECISION A)
        limit = 256^k - (256^k mod n)
        loop:
            x = big-endian integer from the next k bytes of stream   # bytes are CONSUMED
            if x >= limit: continue                                  # rejected bytes are GONE
            return x mod n

    labels: "inclusivcup/v1/stage1/spin/<S>"   S = 1,2,3,…  (decimal, no padding)
            "inclusivcup/v1/pity"

STAGE 2 (Story 6-4a), transcribed from SOLUTION-DESIGN §9.3 / ARCHITECTURE-SPINE:148,219
/ epics.md:1068. No randomness, no stream, integer-only:

    eligible(award, players) = [ p for p in players sorted BYTE-LEX on the decimal
                                 steamid64 STRING
                                 if p.rounds_played >= award.floor_rounds
                                and p.kills         >= award.floor_kills
                                and not p.idle_dq ]

    value(award, p) = p.stats_int.volume[award.deciding_stat]             class 'volume'
                    = p.stats_int.rate[award.deciding_stat]  # {num,den}  class 'rate'

    cmp(award, p, q) = (volume) sign(p - q)
                       (rate)   sign(p.num*q.den - q.num*p.den)   # NOT (num,den) equality
    beats(award, p, q) = cmp > 0 for direction 'max';  cmp < 0 for 'min'

    resolve(award, players):
        E = eligible(award, players)
        if E is empty:                      return no_eligible_players
        best = { p in E : no q in E with beats(award, q, p) }   # a SET, never a champion
        if class == 'volume' and direction == 'max' and value(best[0]) == 0:
                                            return no_awardable_value      # DECISION E
        if len(best) == 1:                  return winner(best[0], value(best[0]))
        return tie(best, equal_value if class == 'volume' else equal_cross_product)

DECISION E (Cuatro, 2026-08-04) is a PRODUCT rule, not a spec transcription: a `max`
VOLUME award whose best deciding value is 0 has no winner at all, rather than crowning a
whole-roster co-win over a stat nobody scored on. `min` awards and `rate` awards are
deliberately untouched — a minimal ADR of 0 is a legitimate win. It is written here
because the vector is the shared contract; both runtimes must implement it identically.

STAGE 1 (Story 6-4b), transcribed from SOLUTION-DESIGN §9.2 / ARCHITECTURE-SPINE:218 /
epics.md:1066. This is the first stage that CONSUMES the stream, so the byte accounting
below is contract rather than a side effect — see the section comment above
`stage1_pick`, which carries the full transcription and the two product decisions
(DECISION F, DECISION G) it turns on.

Usage:  python roulette/vectors/generate_vectors.py          # writes all four JSON files
        python roulette/vectors/generate_vectors.py --check  # verify, write nothing

`--check` is the mode a CI job or a reviewer wants: it regenerates in memory and diffs
against what is committed, exiting non-zero on any drift.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent

ALGO_VERSION = "inclusivcup-roulette-1.0.0"
GENERATED_BY = (
    "roulette/vectors/generate_vectors.py — python stdlib hmac+hashlib, a THIRD "
    "implementation written from the spec text, neither Go's crypto/hmac nor the "
    "browser's SubtleCrypto"
)

LABEL_PREFIX = "inclusivcup/v1"
PITY_LABEL = f"{LABEL_PREFIX}/pity"

REAL_SEED = "1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c"
ZERO_SEED = "00" * 32
FF_SEED = "ff" * 32

N_MIN = 1
N_MAX = 2**32


# ── the primitives, from the spec ─────────────────────────────────────────────


def stage1_label(spin: int) -> str:
    if not isinstance(spin, int) or isinstance(spin, bool) or spin < 1:
        raise ValueError(f"stage1 spin must be an integer >= 1 (1-based), got {spin!r}")
    return f"{LABEL_PREFIX}/stage1/spin/{spin}"


def label_from_source(src: dict) -> str:
    if src["kind"] == "pity":
        return PITY_LABEL
    if src["kind"] == "stage1":
        return stage1_label(src["spin"])
    raise ValueError(f"unknown label kind {src['kind']!r}")


def decode_seed(seed_hex: str) -> bytes:
    if len(seed_hex) != 64 or any(c not in "0123456789abcdef" for c in seed_hex):
        raise ValueError("seed_hex must match ^[0-9a-f]{64}$")
    return bytes.fromhex(seed_hex)


def block_msg(label: str, i: int) -> bytes:
    """utf8(label) || LE64(i) — LE64 is the ONLY little-endian construct in the engine."""
    return label.encode("utf-8") + i.to_bytes(8, "little")


def block(seed: bytes, label: str, i: int) -> bytes:
    return hmac.new(seed, block_msg(label, i), hashlib.sha256).digest()


class Stream:
    """block_0 || block_1 || … for one label, consumed left-to-right."""

    def __init__(self, seed: bytes, label: str) -> None:
        self.seed = seed
        self.label = label
        self.pos = 0

    def read(self, k: int) -> bytes:
        out = bytearray()
        for _ in range(k):
            b = block(self.seed, self.label, self.pos // 32)
            out.append(b[self.pos % 32])
            self.pos += 1
        return bytes(out)


def minimal_k(n: int) -> tuple[int, int]:
    """Smallest k with 256^k >= n. n = 1 -> k = 0 (DECISION A): reads NOTHING."""
    k, space = 0, 1
    while space < n:
        space *= 256
        k += 1
    return k, space


def uniform_int(stream: Stream, n: int) -> int:
    if not isinstance(n, int) or isinstance(n, bool) or n < N_MIN or n > N_MAX:
        raise ValueError(f"n must be an integer in [{N_MIN}, {N_MAX}], got {n!r}")
    k, space = minimal_k(n)
    limit = space - (space % n)
    while True:
        x = int.from_bytes(stream.read(k), "big")  # BIG-endian assembly
        if x >= limit:
            continue  # rejected: those k bytes are GONE
        return x % n


# ── the case manifest — INPUTS only; every expected value below is computed ────

BLOCK_CASES: list[dict] = [
    {"name": "real-seed/spin1/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 0},
    {"name": "real-seed/spin1/i1", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 1},
    {"name": "real-seed/spin1/i2", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 2},
    {"name": "real-seed/spin12/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 12}, "i": 0},
    {"name": "real-seed/spin12/i1", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 12}, "i": 1},
    {"name": "real-seed/pity/i0", "seed": REAL_SEED, "src": {"kind": "pity"}, "i": 0},
    {"name": "real-seed/pity/i1", "seed": REAL_SEED, "src": {"kind": "pity"}, "i": 1},
    {"name": "real-seed/spin2/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 2}, "i": 0},
    {"name": "real-seed/spin8/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 8}, "i": 0},
    {"name": "real-seed/spin10/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 10}, "i": 0},
    {"name": "real-seed/spin11/i0", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 11}, "i": 0},
    {"name": "zero-seed/spin1/i0", "seed": ZERO_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 0},
    {"name": "ff-seed/pity/i0", "seed": FF_SEED, "src": {"kind": "pity"}, "i": 0},
    {"name": "real-seed/spin1/i255", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 255},
    {"name": "real-seed/spin1/i256", "seed": REAL_SEED, "src": {"kind": "stage1", "spin": 1}, "i": 256},
]

# Seed shapes BOTH runtimes must refuse (E4). Each `why` describes what is ACTUALLY in
# the string — the 6.3 review found two entries whose text described an input the file
# did not contain.
INVALID_SEED_HEX: list[dict] = [
    {"why": "uppercase hex", "seed_hex": REAL_SEED.upper()},
    {"why": "mixed case", "seed_hex": "1B3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c"},
    {"why": "0x prefix (66 chars — refused on length)", "seed_hex": "0x" + REAL_SEED},
    {
        "why": "0x prefix truncated to 64 chars — refused on CHARSET, not length",
        "seed_hex": "0x" + REAL_SEED[2:],
    },
    {"why": "leading space (65 chars — refused on length)", "seed_hex": " " + REAL_SEED},
    {
        "why": "leading space, truncated to 64 chars — refused on CHARSET, not length",
        "seed_hex": " " + REAL_SEED[1:],
    },
    {"why": "31 bytes (62 chars)", "seed_hex": REAL_SEED[:62]},
    {"why": "33 bytes (66 chars)", "seed_hex": REAL_SEED + "ab"},
    {"why": "trailing newline", "seed_hex": REAL_SEED + "\n"},
    {"why": "non-hex character", "seed_hex": REAL_SEED[:63] + "g"},
    {"why": "empty", "seed_hex": ""},
]

# Stage-1 spins BOTH runtimes must refuse. Only values both languages can represent
# travel here — a non-integer spin is unrepresentable in Go's `int` parameter, so those
# stay per-suite runtime assertions (the same split the n bounds use).
INVALID_STAGE1_SPIN: list[dict] = [
    {"why": "spin 0 — labels are 1-based, there is no spin 0", "spin": 0},
    {"why": "negative spin", "spin": -1},
    {"why": "negative spin (beyond the ceremony's range)", "spin": -12},
]

UNIFORM_CASES: list[dict] = [
    {
        "name": "plain-accept-n6",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 1},
        "ns": [6] * 8,
        "note": "n=6 -> k=1, limit=252. Eight successive draws; each consumes exactly 1 byte unless rejected.",
    },
    {
        "name": "real-rejection-n200",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 1},
        "ns": [200] * 12,
        "note": (
            "n=200 -> k=1, limit=200: x in [200,255] is REJECTED (56/256 = 21.9% per byte). Draw #2 "
            "rejected at least once — proven by bytes_consumed_after minus the previous row exceeding "
            "k=1. A rejection CONSUMES its bytes and draws fresh ones."
        ),
    },
    {
        "name": "exact-threshold-rejection-x-equals-limit",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 9},
        "ns": [200] * 25,
        "note": (
            "n=200 -> k=1, limit=200. Draw #1 reads the byte 0xc8 = 200, which is EXACTLY the threshold. "
            "The rule is `reject while x >= limit`, so it is REJECTED and fresh bytes are drawn. An "
            "implementation using `x > limit` accepts it instead and returns 200 mod 200 = 0 while "
            "consuming one byte fewer — the whole ceremony diverges from there. Every other rejection in "
            "this file has x strictly greater than limit and cannot tell the two apart."
        ),
    },
    {
        "name": "block-boundary-straddle",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 1},
        "ns": [6] + [257] * 40,
        "note": (
            "One k=1 draw (n=6) sets the stream to an ODD position, then k=2 draws (n=257). A draw STARTS "
            "at byte 31 — it takes byte 31 of block_0 and byte 0 of block_1 — and a later draw starts at "
            "byte 63, straddling block_1 into block_2. Cumulative position passes 32 and 64, so the "
            "counter i advances 0 -> 1 -> 2."
        ),
    },
    {
        "name": "e1-n1-consumes-zero-bytes",
        "seed": REAL_SEED,
        "src": {"kind": "pity"},
        "ns": [6, 1, 1, 1, 6, 1, 6],
        "note": (
            "DECISION A: minimal k with 256^k >= 1 is k=0, so n=1 reads NOTHING and returns 0. "
            "bytes_consumed_after is UNCHANGED across every n=1 row. An implementation that loops from "
            "k=1 returns the same ANSWER (0) and a different STREAM POSITION — invisible in the result, "
            "fatal from the next draw onward."
        ),
    },
    {
        "name": "k-boundary-n256",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 4},
        "ns": [256] * 6,
        "note": "n=256 -> k=1, 256^1 mod 256 = 0 so limit = 256: this draw can NEVER reject. Result is the raw byte.",
    },
    {
        "name": "k-boundary-n257",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 5},
        "ns": [257] * 6,
        "note": "n=257 -> k=2 (256^1 = 256 < 257). limit = 65536 - (65536 mod 257) = 65535. Two bytes, BIG-endian.",
    },
    {
        "name": "k-boundary-n255",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 6},
        "ns": [255] * 6,
        "note": "n=255 -> k=1, limit = 256 - (256 mod 255) = 255: x=255 rejects.",
    },
    {
        "name": "k3-n65537-and-n16777216",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 8},
        "ns": [65537, 16777216, 65537, 16777216, 65537, 65537],
        "note": (
            "THE k=3 WIDTH, which no other case reaches — the 6.3 review found k=3 was never exercised "
            "end-to-end in either language. n=65537 -> k=3 (256^2 = 65536 < 65537), limit = 16777216 - "
            "(16777216 mod 65537) = 16711935, so a rejection is possible (0.39% per draw). n=2^24 -> k=3 "
            "with 256^3 mod 2^24 = 0, so limit = 2^24 and it can never reject. Three bytes assembled "
            "BIG-endian; an implementation that assembles little-endian at k=3 diverges here and nowhere else."
        ),
    },
    {
        "name": "n-upper-bound-2pow32",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 7},
        "ns": [2**32] * 3,
        "note": (
            "DECISION C upper bound. n=2^32 -> k=4, 256^4 mod 2^32 = 0 so limit = 2^32: never rejects. Four "
            "bytes assembled BIG-endian. n=0, n=2^32+1 and non-integer n are runtime-error assertions in "
            "each suite, not vector rows."
        ),
    },
    {
        "name": "k4-lower-edge-n16777217",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 11},
        "ns": [16777217, 16777217, 16777217, 16777217],
        "note": (
            "The LOWER edge of k=4: n = 2^24 + 1 is one past the largest k=3 value, so minimal-k must step "
            "to 4. An off-by-one in the `while space < n` loop picks k=3 here and silently reads one byte "
            "fewer for every draw. limit = 2^32 - (2^32 mod 16777217) = 4294966912."
        ),
    },
    {
        "name": "mixed-n-continuity",
        "seed": REAL_SEED,
        "src": {"kind": "stage1", "spin": 3},
        "ns": [12, 1, 200, 257, 6, 2**32, 1, 12, 256],
        "note": "Mixed widths on ONE stream: k goes 1,0,1,2,1,4,0,1,1. Proves the position accounting, not one draw.",
    },
    {
        "name": "pity-stream-n12",
        "seed": REAL_SEED,
        "src": {"kind": "pity"},
        "ns": [12] * 12,
        "note": "The pity stream is INDEPENDENT of every stage1 stream and also starts at counter 0.",
    },
]


# ── Stage 2 (Story 6-4a): the primitives, from the spec ───────────────────────
#
# Written from the transcription in this file's docstring. Do NOT "fix" anything below by
# reading worker/awards/stage2.go or lib/roulette/stage2.ts — this is the third
# implementation precisely because it was written from the spec text alone.

STEAMID64_RE = re.compile(r"[0-9]+")

RATE_STAT_KEYS = ("adr", "hs_pct", "kast_pct", "entry_success")

# The 17 VOLUME keys, transcribed from 0023's `award_deciding_stat_valid` CHECK (0023:89-96) and
# from the `parts` CTE that materialises them (0024:667-683). Together with RATE_STAT_KEYS they are
# the 21-key vocabulary the three FR-29 rung columns are constrained to (0023:98-115).
#
# ⭐ THE SPLIT IS WHAT MAKES A KEY'S CLASS DERIVABLE, which is FR-29 rung 1's whole arithmetic
# question (L5): `secondary` is `volume || rate`, so `secondary[k]` is an INT for a volume key and a
# {num, den} PAIR for a rate key — INDEPENDENTLY of the class of the award's DECIDING stat.
VOLUME_STAT_KEYS = (
    "kills", "deaths", "assists", "mvps", "flash_assists", "utility_damage",
    "knife_kills", "wallbang_kills", "through_smoke_kills", "no_scope_kills", "blind_kills",
    "entry_frags", "opening_deaths", "rounds_won", "rounds_played", "matches_played", "hs_kills",
)

STAT_VOCABULARY = VOLUME_STAT_KEYS + RATE_STAT_KEYS

# The PUBLISHED ABSENT SENTINEL for `achievement_ts` (0024:704, 898-907). Story 6.5's L9 exists
# because it is numerically the SMALLEST value in the column: a naive `min` over rung 4 crowns the
# player with NO APPROVED ROWS AT ALL, for a rung whose entire meaning is "did it first".
ABSENT_TS = -1


class Stage2Refusal(Exception):
    """A programmer/data error BOTH runtimes must refuse loudly — never a business outcome."""


def _validate_award(award: dict) -> None:
    """The AWARD is validated before eligibility is computed.

    ⭐ ADDED BY THE 6-4a CODE REVIEW, and the reason is worth keeping. Without it this
    anchor's refusal surface was strictly SMALLER than the two implementations it is supposed
    to arbitrate: `_beats` treated any direction that was not exactly "max" as "min", an
    out-of-enum class was noticed only later inside `_deciding_value` (so an award with a bad
    class over a field nobody cleared returned `no_eligible_players` instead of refusing), and
    a negative floor resolved happily. Because `build_stage2_file` raises when a refusal row
    fails to refuse, those three rows were INEXPRESSIBLE in the shared file — so they lived in
    two independently hand-written per-language lists, which is the exact asymmetry the shared
    `refusals` array exists to prevent, and the lists had already drifted.

    Validation happens BEFORE `_eligible` on purpose: the ORDER is part of the contract. An
    award that is malformed refuses regardless of whether anyone would have cleared its floors.
    """
    if not isinstance(award["deciding_stat"], str) or award["deciding_stat"] == "":
        raise Stage2Refusal("award.deciding_stat must be a non-empty string")
    if award["class"] not in ("volume", "rate"):
        raise Stage2Refusal(
            f"unknown award class {award['class']!r} — 0023 constrains it to volume|rate"
        )
    if award["direction"] not in ("max", "min"):
        raise Stage2Refusal(
            f"unknown award direction {award['direction']!r} — 0023 constrains it to max|min"
        )
    for key in ("floor_rounds", "floor_kills"):
        value = award[key]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise Stage2Refusal(
                f"{key} must be a non-negative integer — 0023's award_floors_non_negative"
            )


def _deciding_value(award: dict, p: dict):
    """The deciding value, branched on award.CLASS — never on what a value happens to look like.

    `award_class_key_coherent` (0023:129-133) names this branch as "precisely the
    discriminator 6.4's Stage 2 branches on". A key that is ABSENT is a refusal, never a
    zero: a zero would silently become a real comparison (the same doctrine 0024:918-923
    applies to an absent h2h opponent).
    """
    key = award["deciding_stat"]
    if award["class"] == "volume":
        table = p["stats_int"]["volume"]
        if key not in table:
            raise Stage2Refusal(f"volume key {key!r} absent from stats_int.volume")
        value = table[key]
        if value < 0:
            raise Stage2Refusal(f"volume {key!r} is negative ({value}) — every volume stat is a count")
        return value
    if award["class"] == "rate":
        table = p["stats_int"]["rate"]
        if key not in table:
            raise Stage2Refusal(f"rate key {key!r} absent from stats_int.rate")
        pair = table[key]
        # ⛔ A NEGATIVE DENOMINATOR SILENTLY INVERTS THE COMPARISON. `p.num*q.den > q.num*p.den`
        # is the right test only while both denominators are non-negative; with one negative the
        # inequality flips and the resolver returns a plausible, wrong winner with nothing to
        # notice. Every rate half is a count (0021:66-71,84,108) and 0024 coalesces to 0, so this
        # is unreachable from a real snapshot — which is exactly why it must be loud rather than
        # trusted. `den == 0` stays legal (S3); only a NEGATIVE is refused.
        if pair["num"] < 0 or pair["den"] < 0:
            raise Stage2Refusal(f"rate {key!r} has a negative half ({pair['num']}/{pair['den']})")
        return (pair["num"], pair["den"])
    raise Stage2Refusal(f"unknown award class {award['class']!r}")


def _cmp_stat(klass: str, a, b) -> int:
    """The class-shaped compare, taking the CLASS rather than the award.

    ⭐ SPLIT OUT BY STORY 6.5 AND SHARED WITH THE LADDER — a behaviour-neutral refactor whose
    byte-identical regeneration of `stage2-resolve.json` is the proof. FR-29's rungs 1, 2 and 3
    ask exactly the question `_cmp` asks, over exactly this shape, and a second copy of the
    cross-multiplication would be a second place to get S3's zero-denominator semantics wrong —
    which is precisely the drift the anchor exists to arbitrate, not to exhibit.

    ⚠ It takes a CLASS, not an award, for two reasons the ladder makes concrete: rung 1 branches on
    the KEY's class rather than the award's (L5), and rung 2 compares a COMPUTED ratio that belongs
    to no award's class at all.
    """
    if klass == "volume":
        return (a > b) - (a < b)
    an, ad = a
    bn, bd = b
    left, right = an * bd, bn * ad
    return (left > right) - (left < right)


def _cmp(award: dict, a, b) -> int:
    """sign(a - b) for a volume pair; sign(a.num*b.den - b.num*a.den) for a rate pair.

    S3 — cross-multiplication is TOTAL: a `den` of 0 still multiplies. It is never divided,
    never thrown on, and never filtered away (a silent filter is an argmax by another name).

    ⚠ S3 HAS TWO CONSEQUENCES THE ORIGINAL NOTE DID NOT STATE, both surfaced by the 6-4a code
    review and both now pinned by their own vector rows rather than left to be discovered:
      1. `0/0` compares EQUAL to every pair (`0*q.den == q.num*0 == 0`), so a player with no
         data is unbeatable and always lands in `best` — turning what would have been a clean
         win into a tie, and therefore into the ladder's refusal. See
         `rate-zero-denominator-is-equal-to-everyone` and, under REAL floors,
         `rate-zero-denominator-clears-a-real-floor`.
      2. `n/0` with `n > 0` BEATS every finite rate at any magnitude (`n*q.den > q.num*0 == 0`),
         i.e. it behaves as +infinity and is crowned outright. See
         `rate-max-positive-numerator-over-zero-beats-every-finite-rate`.
    Both follow from applying the formula verbatim and are reported rather than patched around;
    the alternative — excluding den-0 players — is the silent filter S3 forbids.

    S4 — Python ints are unbounded, which is the property Go gets from math/big and
    TypeScript from BigInt. A wrapped product yields a PLAUSIBLE winner, so it must not wrap.
    """
    return _cmp_stat(award["class"], a, b)


def _beats(award: dict, a, b) -> bool:
    """S1 — `direction` inverts "best", and ONLY "best". Floors and equality are unchanged.

    ⚠ The `else` arm is "min" BY CONSTRUCTION, not by fallthrough: `_validate_award` has
    already pinned `direction` to the closed set. Before that guard existed this line silently
    resolved `direction: "highest"` as a min award and crowned a winner, where both runtimes
    refuse — see the note on `_validate_award`.
    """
    c = _cmp(award, a, b)
    return c > 0 if award["direction"] == "max" else c < 0


def _eligible(award: dict, players: list) -> list:
    """FR-21 floors over the byte-lex-ordered roster.

    S6 — the order is byte-lex on the decimal steamid64 STRING, matching the snapshot's own
    `order by p.steamid64 collate "C"` (0024:732). It is NOT a numeric order: "10" sorts
    before "9".
    S2 — the floor test is `>=` on the snapshot's own rounds_played / kills, plus `not
    idle_dq`. A `floor_kills` of 0 still runs the comparison.
    """
    seen = set()
    for p in players:
        sid = p["steamid64"]
        if not STEAMID64_RE.fullmatch(sid):
            raise Stage2Refusal(f"steamid64 must be a non-empty decimal string, got {sid!r}")
        if sid in seen:
            raise Stage2Refusal(f"duplicate steamid64 {sid!r} — a snapshot holds one row per player")
        seen.add(sid)
        # The eligibility inputs are read for EVERY player, so they are validated for every
        # player. The deciding magnitudes are validated where they are read, which is only for
        # the eligible ones — a player out of the race is never consulted.
        if p["rounds_played"] < 0 or p["kills"] < 0:
            raise Stage2Refusal(
                f"negative eligibility input for {sid!r}: rounds_played={p['rounds_played']} "
                f"kills={p['kills']} — both are counts and 0024 coalesces them to 0"
            )
    ordered = sorted(players, key=lambda p: p["steamid64"].encode("utf-8"))
    return [
        p
        for p in ordered
        if p["rounds_played"] >= award["floor_rounds"]
        and p["kills"] >= award["floor_kills"]
        and not p["idle_dq"]
    ]


def resolve_stage2(award: dict, players: list) -> dict:
    """The Stage-2 outcome. Pure, integer-only, no randomness, no stream."""
    _validate_award(award)

    eligible = _eligible(award, players)
    if not eligible:
        # S5 — a typed outcome, not a crash and not a zero-winner. 6.2 measured 0/28.
        return {"kind": "no_eligible_players"}

    # Every ELIGIBLE player's value is read up front, so a missing key refuses even when the
    # player would have lost. An ineligible player is never read — they are not in the race.
    valued = [(p, _deciding_value(award, p)) for p in eligible]

    # S7 — "best" is computed as a SET. A running champion replaced on `>` silently keeps the
    # first of an equal pair and IS the argmax AD-14 forbids; `>=` silently keeps the last.
    best = [p for p, v in valued if not any(_beats(award, w, v) for _, w in valued)]
    if not best:
        # Unreachable: `_cmp` is TOTAL — every pair is comparable — and over non-negative pairs
        # its STRICT part is acyclic, so a maximal element always exists.
        #
        # ⚠ It is NOT a total preorder, and the 6-4a review corrected this comment for saying so.
        # 0/0 cross-multiplies to 0 against EVERY pair, so indifference is not transitive:
        # 0/0 ~ 10/5 and 0/0 ~ 6/5 while 10/5 > 6/5 (the `rate-zero-denominator-is-equal-to-
        # everyone` case is the counterexample, in this very file). The guard holds because of
        # acyclicity, not transitivity — a future reader must not "simplify" against the wrong
        # reason. Loud rather than silent if acyclicity ever stops being true.
        raise Stage2Refusal("empty best set — the comparator's strict part is not acyclic")

    best_value = _deciding_value(award, best[0])

    # DECISION E — see the docstring. Deliberately scoped to `max` VOLUME awards.
    #
    # ⭐ IT CARRIES THE SUPPRESSED SET (6-4a code review, Cuatro's call). The zero check runs
    # BEFORE the |best| branch, so without this the tie that would have formed was discarded
    # entirely and 6.5 / 6.6 / 6.7 could not see how wide it was — the 27-way zero tie
    # deferred-work.md:270 predicted would arrive as a bare kind. `tied` is the full byte-lex
    # set that shared the suppressed value; its LENGTH is that width, and it is 1 when a lone
    # eligible player sat at zero (which is still no winner — the rule is about the VALUE, not
    # the width).
    if award["class"] == "volume" and award["direction"] == "max" and best_value == 0:
        return {
            "kind": "no_awardable_value",
            "tied": [p["steamid64"] for p in best],
        }

    if len(best) == 1:
        return {
            "kind": "winner",
            "steamid64": best[0]["steamid64"],
            "deciding_value": _render_value(award, best_value),
        }
    # AC2 — the FULL tied set, in byte-lex order, with the reason. Never the first, never the
    # last, never the lowest SteamID64.
    return {
        "kind": "tie",
        "tied": [p["steamid64"] for p in best],
        "reason": "equal_value" if award["class"] == "volume" else "equal_cross_product",
    }


# ── Stage 2: the case manifest — INPUTS only; every expected value is computed ─


def _render_value(award: dict, v) -> dict:
    """`deciding_value` is DISPLAY ONLY and never an input to resolution (SOLUTION-DESIGN:219)."""
    if award["class"] == "volume":
        return {"class": "volume", "value": str(v)}
    return {"class": "rate", "num": str(v[0]), "den": str(v[1])}


def _award(deciding_stat: str, klass: str, direction: str, floor_rounds: int, floor_kills: int) -> dict:
    return {
        "deciding_stat": deciding_stat,
        "class": klass,
        "direction": direction,
        "floor_rounds": floor_rounds,
        "floor_kills": floor_kills,
    }


def _efficiency_form(volume: dict, rates: dict) -> dict:
    """AD-19's efficiency block, transcribed from `snapshot_efficiency_form` (0024:352-364).

    Every key in the UNIFORM {num, den} form: a volume int `v` becomes {v, 1}, a rate key keeps
    its natural pair. That uniformity is what lets an FR-29 rung-2 ratio over any two vocabulary
    keys resolve by integer cross-multiplication with no class branching and no division.

    ⭐ DERIVED, NEVER HAND-WRITTEN. 0024 calls this "the ONE definition site — do not restate the
    shape at a call site", and a fixture that restated it could drift from the database while every
    gate stayed green.
    """
    out = {k: (v, 1) for k, v in volume.items()}
    out.update({k: (v["num"], v["den"]) for k, v in rates.items()})
    return out


def _class_shaped(volume: dict, rates: dict) -> dict:
    """AD-19's `secondary` block and the inner shape of `h2h`: `volume || rate` (0024:650, 723).

    Every key in its CLASS-SHAPED form — a bare integer for a volume key, a `{num, den}` pair for a
    rate key — which is why the ladder's rung 1 must branch on the KEY's class and never on
    `award.class` (L5): the secondary key can cross classes with the deciding one.
    """
    out = dict(volume)
    out.update({k: (v["num"], v["den"]) for k, v in rates.items()})
    return out


def _p(sid, *, rounds, kills, idle=False, vol=None, rate=None, drop_volume=(), drop_rate=(),
       h2h=None, ts=None, drop_h2h_keys=(), secondary_force=None, efficiency_force=None):
    """One snapshot player.

    Every player carries DECOY keys in both tables. A resolver that reads the wrong key must
    produce a different answer rather than coincidentally the right one — with a single-key
    fixture a wrong-key read is indistinguishable from a correct one.

    The fixture is also held to the REAL snapshot's internal coherence (0024:667-708): the
    top-level `kills`/`rounds_played` eligibility inputs and their volume entries come from
    the same `public.leaderboard` columns, `adr`/`kast_pct` are denominated in rounds_played
    and `hs_pct` in kills. `entry_success`'s denominator (entry_opportunities) has no volume
    counterpart and is therefore free.
    """
    volume = {
        "deaths": 0,
        "hs_kills": 0,
        "kills": kills,
        "knife_kills": 0,
        "rounds_played": rounds,
        "utility_damage": 0,
    }
    volume.update(vol or {})
    volume["kills"] = kills
    volume["rounds_played"] = rounds
    for key in drop_volume:
        volume.pop(key, None)

    rates = {
        "adr": {"num": 0, "den": rounds},
        "entry_success": {"num": 0, "den": rounds},
        "hs_pct": {"num": volume.get("hs_kills", 0), "den": kills},
        "kast_pct": {"num": 0, "den": rounds},
    }
    for key, (num, den) in (rate or {}).items():
        rates[key] = {"num": num, "den": den}

    assert rates["adr"]["den"] == rounds, "adr is denominated in rounds_played (0021:69,66)"
    assert rates["kast_pct"]["den"] == rounds, "kast_pct is denominated in rounds_played"
    assert rates["hs_pct"]["den"] == kills, "hs_pct is denominated in kills (0021:71,67)"
    if "hs_kills" in volume:
        assert rates["hs_pct"]["num"] == volume["hs_kills"], "hs_pct's numerator IS hs_kills"

    # ⭐ Dropped AFTER the coherence asserts, so removing a key never weakens them. `drop_rate`
    # is the rate-arm twin of `drop_volume`, added by the 6-4a code review: every fixture
    # materialised all four rate keys, so "an absent deciding key on an INELIGIBLE player is not
    # an error" was pinned for the volume branch and unproven for the rate branch — a mutation
    # hoisting the rate-arm value read above the eligibility filter reddened nothing.
    for key in drop_rate:
        rates.pop(key, None)

    # ── The four AD-19 blocks Story 6.5 reads (0024:716-737). ────────────────────────────────────
    #
    # ⭐ `secondary` AND `efficiency` ARE DERIVED FROM `volume`/`rate` HERE, exactly as 0024 derives
    # them, and derived AFTER the drops so a key removed from `volume` is absent from every block
    # that quotes it — which is what the database does. Hand-writing them would let a fixture
    # present a `secondary` block that no real snapshot could produce, and the ladder's rung-1
    # cases would then be testing an input shape that does not exist.
    #
    # ⚠ Only the keys a case actually materialises appear, exactly as `stats_int.volume` already
    # works here. A real snapshot writes all 21; a fixture writes what its case needs, and a
    # `secondary_stat` naming a key it did not materialise is the "absent from the player's
    # secondary block" refusal below.
    secondary = _class_shaped(volume, rates)
    efficiency = _efficiency_form(volume, rates)

    # ⛔ `secondary_force` OVERWRITES a derived entry with a DELIBERATELY WRONG-CLASS shape — a
    # `{num,den}` pair under a volume key, or a bare integer under a rate key. No real snapshot can
    # produce it (0024 derives the block from `volume || rate`), which is exactly why the refusal
    # that catches it needs a row: without one, L5's class check guards a state nothing exercises and
    # deleting it reddens nothing. The Story-6.5 mutation pass measured that survivor.
    for key, forced in (secondary_force or {}).items():
        secondary[key] = forced

    # ⛔ `efficiency_force` is the same instrument for the EFFICIENCY block, and it exists for the
    # same reason: the negative-magnitude refusals that guard rung 2's four-term product cannot be
    # reached through `_efficiency_form`, which derives every pair from non-negative counts. Without
    # it the guard protects a state no row exercises. (Added at the Groups-2/3 code review.)
    for key, forced in (efficiency_force or {}).items():
        efficiency[key] = forced

    # `h2h` is `{opponent: {deciding-key: value}}`, and the inner block is the SAME class-shaped
    # union `secondary` is (0024:650). Values arrive as an int for a volume key or a (num, den)
    # tuple for a rate key — the case says what it needs and nothing else is invented, because an
    # ABSENT OPPONENT KEY is the never-met SKIP signal (0024:918-923) and an absent STAT key inside
    # a present opponent block is a corrupt row, so the two must stay distinguishable.
    h2h_block: dict = {}
    for opp, entries in (h2h or {}).items():
        block = dict(entries)
        for key in drop_h2h_keys:
            block.pop(key, None)
        h2h_block[opp] = block

    # ⚠ NEVER NULL in the snapshot (0024:706), so the fixture default is the PUBLISHED ABSENT
    # SENTINEL rather than `None`. `-1` is numerically the smallest value in the column, which is
    # the whole reason rung 4 filters before it minimises (L9).
    achievement_ts = ABSENT_TS if ts is None else ts

    return {
        "steamid64": sid,
        "rounds_played": rounds,
        "kills": kills,
        "idle_dq": idle,
        "stats_int": {
            "volume": volume,
            "rate": rates,
            "secondary": secondary,
            "efficiency": efficiency,
        },
        "h2h": h2h_block,
        "achievement_ts": achievement_ts,
    }


# Real-length ids. ⚠ Every SteamID64 is 17 digits, so byte-lex and numeric order AGREE on
# these — which is exactly why `byte-lex-is-a-string-order` below uses short synthetic ids.
S_A = "76561198000000011"
S_B = "76561198000000022"
S_C = "76561198000000033"
S_D = "76561198000000044"

# 2^53 — the largest integer a IEEE-754 double represents exactly. Used only by the
# cross-multiplication-only case; see its note.
TWO53 = 9007199254740992

STAGE2_CASES: list[dict] = [
    {
        "name": "volume-max-plain",
        "note": (
            "The ordinary shape: a volume `max` award decided by an integer compare. The decoy "
            "keys are adversarial on purpose — B leads on `kills` and `hs_kills` while A leads "
            "on the deciding `knife_kills`, so a resolver reading the wrong volume key crowns "
            "the wrong player instead of coincidentally the right one."
        ),
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=12, vol={"knife_kills": 4, "hs_kills": 3}),
            _p(S_B, rounds=30, kills=25, vol={"knife_kills": 2, "hs_kills": 9}),
            _p(S_C, rounds=30, kills=18, vol={"knife_kills": 1, "hs_kills": 5}),
        ],
    },
    {
        "name": "volume-max-equal-integer-tie",
        "note": (
            "AD-14's equal-INTEGER tie. A and C both hold 7; B holds 6. The answer is the full "
            "tied set with reason `equal_value` — never the first of the pair (a running max on "
            "`>`), never the last (`>=`), never the lowest SteamID64."
        ),
        "award": _award("wallbang_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"wallbang_kills": 7}),
            _p(S_B, rounds=30, kills=20, vol={"wallbang_kills": 6}),
            _p(S_C, rounds=30, kills=20, vol={"wallbang_kills": 7}),
        ],
    },
    {
        "name": "volume-max-three-way-tie",
        "note": (
            "Tie WIDTH is part of the outcome: three of four players share the best value. A "
            "resolver that returned a pair would pass a two-player tie case and fail here."
        ),
        "award": _award("utility_damage", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 313}),
            _p(S_B, rounds=30, kills=20, vol={"utility_damage": 313}),
            _p(S_C, rounds=30, kills=20, vol={"utility_damage": 12}),
            _p(S_D, rounds=30, kills=20, vol={"utility_damage": 313}),
        ],
    },
    {
        "name": "volume-min-plain",
        "note": (
            "S1 — `direction: 'min'` inverts BEST and only best. C holds the FEWEST deaths and "
            "wins; the floors are not inverted and equality is unchanged."
        ),
        "award": _award("deaths", "volume", "min", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 14}),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 22}),
            _p(S_C, rounds=30, kills=20, vol={"deaths": 9}),
        ],
    },
    {
        "name": "volume-min-equal-integer-tie",
        "note": "S1 — a `min` award ties on equality exactly as a `max` award does.",
        "award": _award("deaths", "volume", "min", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 9}),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 22}),
            _p(S_C, rounds=30, kills=20, vol={"deaths": 9}),
        ],
    },
    {
        "name": "rate-max-realistic-adr",
        "note": (
            "The ordinary rate shape, with the real catalog's floors for a rate award "
            "(`Rey del Daño`: 24 rounds, 20 kills). B's 2600/26 = 100.0 beats A's 2400/25 = 96.0 "
            "and C's 2350/24 ≈ 97.9. Cross-multiplication and a float compare agree here — which "
            "is precisely why this case alone proves nothing about the arithmetic."
        ),
        "award": _award("adr", "rate", "max", 24, 20),
        "players": [
            _p(S_A, rounds=25, kills=21, rate={"adr": (2400, 25)}),
            _p(S_B, rounds=26, kills=22, rate={"adr": (2600, 26)}),
            _p(S_C, rounds=24, kills=20, rate={"adr": (2350, 24)}),
        ],
    },
    {
        "name": "rate-max-cross-multiplication-only",
        "note": (
            "⭐ THE CASE THAT ONLY EXACT INTEGER ARITHMETIC GETS RIGHT, and the search for it is "
            "recorded here because the search itself is the finding: with operands at or below "
            "2^53 an inversion is IMPOSSIBLE. Both operands are then exact doubles and IEEE-754 "
            "division is correctly rounded, so a/b > c/d implies fl(a/b) >= fl(c/d) — a float "
            "compare can only collapse a winner into a tie, never swap the two. Producing a real "
            "inversion therefore REQUIRES operands past 2^53, where the values themselves round. "
            "A = (2^53+1)/(2^53+2), B = 2^53/(2^53+1). Exactly, A > B: cross-multiplying gives "
            "A.num*B.den = (2^53+1)^2 and B.num*A.den = (2^53+1)^2 - 1, a difference of ONE in "
            "~2^106. As doubles, 2^53+1 rounds to 2^53 (ties-to-even) in BOTH fractions, so "
            "fl(A) = 2^53/(2^53+2) < 1 while fl(B) = 2^53/2^53 = 1.0 — the float compare picks B, "
            "the other player. In JavaScript the corruption happens at JSON.parse, before any "
            "arithmetic, which is why every magnitude in this file is a decimal STRING. The "
            "magnitudes are synthetic: no real snapshot reaches them. The ARITHMETIC WIDTH they "
            "pin is not synthetic, and a wrapped or rounded product yields a PLAUSIBLE winner."
        ),
        "award": _award("entry_success", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, rate={"entry_success": (TWO53 + 1, TWO53 + 2)}),
            _p(S_B, rounds=30, kills=20, rate={"entry_success": (TWO53, TWO53 + 1)}),
        ],
    },
    {
        "name": "rate-max-equal-cross-product-different-pairs",
        "note": (
            "AD-14's equal-CROSS-PRODUCT tie. A is 3/6 and C is 2/4 — the same value carried by "
            "DIFFERENT pairs, so a `num == num and den == den` equality check misses it entirely "
            "and silently crowns whichever the loop happened to hold. The reason is "
            "`equal_cross_product`, not `equal_value`."
        ),
        "award": _award("entry_success", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=6, kills=3, rate={"entry_success": (3, 6)}),
            _p(S_B, rounds=8, kills=2, rate={"entry_success": (3, 8)}),
            _p(S_C, rounds=4, kills=2, rate={"entry_success": (2, 4)}),
        ],
    },
    {
        "name": "rate-min-el-inofensivo",
        "note": (
            "Award #12 `El Inofensivo` reproduced verbatim — the catalog's ONLY `direction: 'min'` "
            "award and the only consumer of the direction column. Note DECISION C in action: the "
            "`floor_kills = 20` is applied as written even though a kill floor on a min award is "
            "anti-QUALIFICATION (deferred-work.md:268). C is the least harmful of those who "
            "cleared it; the genuinely harmless player below is excluded by the floor, not by ADR."
        ),
        "award": _award("adr", "rate", "min", 24, 20),
        "players": [
            _p(S_A, rounds=25, kills=21, rate={"adr": (2400, 25)}),
            _p(S_B, rounds=26, kills=22, rate={"adr": (1560, 26)}),
            _p(S_C, rounds=24, kills=20, rate={"adr": (960, 24)}),
            _p(S_D, rounds=24, kills=8, rate={"adr": (120, 24)}),
        ],
    },
    {
        "name": "rate-min-equal-cross-product-tie",
        "note": "S1 — a `min` rate award ties on an equal cross product exactly as `max` does.",
        "award": _award("adr", "rate", "min", 0, 0),
        "players": [
            _p(S_A, rounds=10, kills=5, rate={"adr": (700, 10)}),
            _p(S_B, rounds=20, kills=5, rate={"adr": (1400, 20)}),
            _p(S_C, rounds=10, kills=5, rate={"adr": (900, 10)}),
        ],
    },
    {
        "name": "rate-zero-denominator-pair-ties",
        "note": (
            "S3 — a zero denominator is REAL and reachable: a rostered player with zero approved "
            "rows is `idle_dq = false` with zero stats (0024:909-916), so `adr` is 0/0. Two such "
            "players cross-multiply to 0 vs 0 and therefore TIE. Nothing divides, nothing throws, "
            "and neither player is filtered out — a silent den-0 filter is an argmax by another "
            "name."
        ),
        "award": _award("adr", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=0, kills=0, rate={"adr": (0, 0)}),
            _p(S_B, rounds=0, kills=0, rate={"adr": (0, 0)}),
        ],
    },
    {
        "name": "rate-zero-denominator-is-equal-to-everyone",
        "note": (
            "⭐ THE CONSEQUENCE OF APPLYING THE FORMULA VERBATIM, recorded rather than patched "
            "around. A 0/0 player cross-multiplies to 0 against EVERY opponent, so they are equal "
            "to all of them: A(0/0) ties B(10/5) even though B beats C(6/5) outright. `best` is "
            "therefore {A, B} — a tie, loudly, into the ladder. Special-casing 0/0 out of the "
            "race would be exactly the silent filter S3 forbids, so the outcome is reported."
        ),
        "award": _award("adr", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=0, kills=0, rate={"adr": (0, 0)}),
            _p(S_B, rounds=5, kills=3, rate={"adr": (10, 5)}),
            _p(S_C, rounds=5, kills=3, rate={"adr": (6, 5)}),
        ],
    },
    {
        "name": "rate-zero-denominator-clears-a-real-floor",
        "note": (
            "⭐ S3'S FIRST CONSEQUENCE, UNDER THE CATALOG'S OWN FLOORS. The two den-0 cases above "
            "both sit at rounds_played = 0 and so are excluded by any non-zero floor — which "
            "left the whole 0/0-ties-everyone behaviour reachable only where the floors are 0/0. "
            "It is NOT: `entry_success`'s denominator is entry_opportunities, which has no volume "
            "counterpart and is therefore free of the snapshot's internal coherence (0024:667-708), "
            "so A clears 24 rounds and 20 kills comfortably while holding 0/0. A then ties B AND "
            "C even though B beats C outright, `best` is {A, B}, and an award that had an "
            "unambiguous winner becomes a tie that the refusing ladder turns into a hard failure. "
            "This is the shape 6.5 must be designed against, so it is a vector row rather than a "
            "remark."
        ),
        "award": _award("entry_success", "rate", "max", 24, 20),
        "players": [
            _p(S_A, rounds=30, kills=25, rate={"entry_success": (0, 0)}),
            _p(S_B, rounds=30, kills=25, rate={"entry_success": (3, 10)}),
            _p(S_C, rounds=30, kills=25, rate={"entry_success": (2, 10)}),
        ],
    },
    {
        "name": "rate-max-positive-numerator-over-zero-beats-every-finite-rate",
        "note": (
            "⭐ S3'S SECOND CONSEQUENCE, and the half no row covered before the 6-4a review: every "
            "den-0 fixture used num = 0, so only the 0/0-is-equal-to-everything behaviour was "
            "pinned. With n > 0 the same formula makes n/0 behave as +INFINITY — 1*30 = 30 beats "
            "9999*0 = 0 — so A wins outright over a player with three orders of magnitude more "
            "production, and `deciding_value` is rendered as 1/0 for the UI to display. Verbatim "
            "cross-multiplication, no special case, reported rather than patched: filtering den-0 "
            "out of the race is the silent argmax S3 forbids."
        ),
        "award": _award("entry_success", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, rate={"entry_success": (1, 0)}),
            _p(S_B, rounds=30, kills=20, rate={"entry_success": (9999, 30)}),
            _p(S_C, rounds=30, kills=20, rate={"entry_success": (5000, 30)}),
        ],
    },
    {
        "name": "floors-exclude-everyone",
        "note": (
            "S5 — `no_eligible_players`, a typed outcome rather than a crash or a zero-winner. "
            "This is the SHIPPED catalog's floor pair (24 rounds / 20 kills) over the shape 6.2 "
            "measured on the real corpus: rounds_played min 10 / max 21, 0/28 clearing either "
            "floor (deferred-work.md:269). It is reachable TODAY, not hypothetically."
        ),
        "award": _award("adr", "rate", "max", 24, 20),
        "players": [
            _p(S_A, rounds=21, kills=13, rate={"adr": (1900, 21)}),
            _p(S_B, rounds=10, kills=6, rate={"adr": (900, 10)}),
            _p(S_C, rounds=18, kills=19, rate={"adr": (1700, 18)}),
        ],
    },
    {
        "name": "floors-are-inclusive-at-the-boundary",
        "note": (
            "S2 — the test is `>=`, on BOTH floors. A sits EXACTLY on 24/20 and is eligible; B is "
            "one round short with kills to spare; C has the rounds and is one kill short. An "
            "off-by-one to `>` empties the field and turns this into `no_eligible_players`, which "
            "is precisely the mutation that survived the entire suite in both languages at 6.3."
        ),
        "award": _award("adr", "rate", "max", 24, 20),
        "players": [
            _p(S_A, rounds=24, kills=20, rate={"adr": (1200, 24)}),
            _p(S_B, rounds=23, kills=30, rate={"adr": (2300, 23)}),
            _p(S_C, rounds=24, kills=19, rate={"adr": (2400, 24)}),
        ],
    },
    {
        "name": "floor-kills-zero-still-compares",
        "note": (
            "S2 — `floor_kills = 0` is the VOLUME awards' real value and must still run the "
            "comparison rather than being special-cased away. A player with zero kills clears it "
            "and here actually wins the award."
        ),
        "award": _award("utility_damage", "volume", "max", 10, 0),
        "players": [
            _p(S_A, rounds=12, kills=0, vol={"utility_damage": 240}),
            _p(S_B, rounds=12, kills=9, vol={"utility_damage": 60}),
        ],
    },
    {
        "name": "idle-dq-excluded",
        "note": (
            "The idle-DQ'd player holds the best value and must not win. ⚠ SNAPSHOT semantics: "
            "`idle_dq` here means FULLY DQ'd — at least one approved row and EVERY one of them "
            "idle (0024:909-916) — not the per-match reading of `stat_row.idle_dq`."
        ),
        "award": _award("hs_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=40, idle=True, vol={"hs_kills": 30}),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 11}),
            _p(S_C, rounds=30, kills=20, vol={"hs_kills": 8}),
        ],
    },
    {
        "name": "idle-dq-leaves-nobody-eligible",
        "note": (
            "Dropping the `idle_dq` filter turns this into a winner instead of "
            "`no_eligible_players` — the one shape where the filter is the ONLY thing standing "
            "between a DQ'd player and a trophy."
        ),
        "award": _award("hs_kills", "volume", "max", 24, 0),
        "players": [
            _p(S_A, rounds=30, kills=40, idle=True, vol={"hs_kills": 30}),
            _p(S_B, rounds=12, kills=6, vol={"hs_kills": 4}),
        ],
    },
    {
        "name": "players-supplied-out-of-byte-lex-order",
        "note": (
            "The fixture hands the players in DESCENDING id order, so the returned tied set can "
            "only be ascending if the resolver sorted them itself. Removing the sort entirely "
            "reverses the tied array here."
        ),
        "award": _award("blind_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_D, rounds=30, kills=20, vol={"blind_kills": 3}),
            _p(S_C, rounds=30, kills=20, vol={"blind_kills": 3}),
            _p(S_B, rounds=30, kills=20, vol={"blind_kills": 1}),
            _p(S_A, rounds=30, kills=20, vol={"blind_kills": 3}),
        ],
    },
    {
        "name": "byte-lex-is-a-string-order-not-a-numeric-one",
        "note": (
            "⭐ THE ONLY CASE THAT CAN TELL THE TWO SORTS APART, and the ids are short on purpose. "
            "Every real SteamID64 is 17 digits, so byte-lex and numeric order AGREE on all of "
            "them and a numeric-sort mutation is invisible across the rest of this file. On "
            "\"9\", \"10\", \"100\" byte-lex gives 10, 100, 9 while a numeric sort gives 9, 10, "
            "100. The snapshot aggregates `order by p.steamid64 collate \"C\"` (0024:732), which "
            "is byte-wise for the same reason, so the resolver must agree with it — and "
            "`localeCompare` must never appear."
        ),
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [
            _p("9", rounds=30, kills=20, vol={"knife_kills": 5}),
            _p("100", rounds=30, kills=20, vol={"knife_kills": 5}),
            _p("10", rounds=30, kills=20, vol={"knife_kills": 5}),
        ],
    },
    {
        "name": "volume-max-all-zero-no-awardable-value",
        "note": (
            "⭐ DECISION E, over the exact shape 6.1's review measured: `knife_kills` is non-zero "
            "for 1 of 28 players, so if that player misses the floors award #6 is a whole-roster "
            "tie AT ZERO (deferred-work.md:270). Rather than walk four players to a shared trophy "
            "for a stat nobody scored on, a `max` volume award whose best value is 0 has NO "
            "winner. Note the decoys are non-zero: it is the DECIDING key that is zero."
        ),
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 9}),
            _p(S_B, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 4}),
            _p(S_C, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 7}),
            _p(S_D, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 2}),
        ],
    },
    {
        "name": "volume-max-single-eligible-at-zero-no-awardable-value",
        "note": (
            "DECISION E is a rule about the VALUE, not about the tie width: one lone eligible "
            "player sitting at zero still yields no winner. A resolver that applied the rule only "
            "when |best| > 1 would crown this player."
        ),
        "award": _award("through_smoke_kills", "volume", "max", 24, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"through_smoke_kills": 0}),
            _p(S_B, rounds=12, kills=20, vol={"through_smoke_kills": 6}),
        ],
    },
    {
        "name": "volume-max-nonzero-best-over-zeros",
        "note": (
            "The control for DECISION E: zeros BELOW the best value change nothing. Only a best "
            "value of zero suppresses the award."
        ),
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"knife_kills": 0}),
            _p(S_B, rounds=30, kills=20, vol={"knife_kills": 1}),
            _p(S_C, rounds=30, kills=20, vol={"knife_kills": 0}),
        ],
    },
    {
        "name": "volume-min-zero-is-awardable",
        "note": (
            "DECISION E's SCOPE, half one: it is deliberately confined to `max`. Fewest deaths is "
            "an achievement, so a `min` volume award whose best value is 0 has a real winner. "
            "Widening the rule to every direction would redden exactly this case."
        ),
        "award": _award("deaths", "volume", "min", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 0}),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 5}),
        ],
    },
    {
        "name": "rate-max-zero-numerator-is-awardable",
        "note": (
            "DECISION E's SCOPE, half two: it is deliberately confined to VOLUME. A rate award "
            "whose best value is 0/n stays a real outcome — here both players are at 0/n, so the "
            "answer is an ordinary equal-cross-product TIE and not `no_awardable_value`. "
            "Widening the rule to rate awards would redden exactly this case."
        ),
        "award": _award("hs_pct", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 0}),
            _p(S_B, rounds=30, kills=25, vol={"hs_kills": 0}),
        ],
    },
    {
        "name": "an-absent-key-on-an-INELIGIBLE-player-is-not-an-error",
        "note": (
            "The mirror of the refusals below: a missing deciding key refuses only for a player "
            "who is actually in the race. B fails the round floor, so their absent "
            "`knife_kills` entry is never read. This is what keeps the refusal a real signal "
            "rather than a tripwire on rows nobody consults."
        ),
        "award": _award("knife_kills", "volume", "max", 24, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"knife_kills": 2}),
            _p(S_B, rounds=10, kills=20, drop_volume=("knife_kills",)),
        ],
    },
    {
        "name": "an-absent-RATE-key-on-an-INELIGIBLE-player-is-not-an-error",
        "note": (
            "The RATE arm of the row above, added by the 6-4a code review. Every fixture "
            "materialised all four rate keys, so 'the deciding magnitudes are read only for the "
            "eligible' was proven for volume and merely asserted for rate — a mutation hoisting "
            "the rate-arm value read above the eligibility filter reddened nothing in either "
            "language. B fails the round floor, so their missing `entry_success` pair is never "
            "consulted."
        ),
        "award": _award("entry_success", "rate", "max", 24, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, rate={"entry_success": (4, 10)}),
            _p(S_B, rounds=10, kills=20, drop_rate=("entry_success",)),
        ],
    },
]

# Inputs BOTH runtimes must REFUSE. These are not outcome rows — a refusal has no expected
# winner — but they are still shared contract, so the two suites cannot drift into two
# independently hand-written lists. The 6.3 review found exactly that asymmetry costing a
# surviving mutation, which is why `invalid_seed_hex` and `invalid_stage1_spin` exist.
STAGE2_REFUSALS: list[dict] = [
    {
        "why": "the deciding volume key is absent from an ELIGIBLE player's stats_int.volume",
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, drop_volume=("knife_kills",)),
            _p(S_B, rounds=30, kills=20, vol={"knife_kills": 1}),
        ],
    },
    {
        "why": "the deciding rate key is absent from stats_int.rate",
        "award": _award("no_such_rate", "rate", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    {
        "why": "class 'rate' with a VOLUME deciding stat — the key is not in the rate table",
        "award": _award("kills", "rate", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    {
        "why": "class 'volume' with a RATE deciding stat — the key is not in the volume table",
        "award": _award("adr", "volume", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    {
        "why": "an award class outside the closed set {volume, rate}",
        "award": _award("kills", "ratio", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    # ⭐ The three rows below could not exist before the 6-4a review added `_validate_award` to
    # this file. Both runtimes already refused all three, but this anchor did not — an unknown
    # direction resolved silently as `min`, a negative floor resolved, and an empty deciding_stat
    # refused only by accident via the absent-key path — so `build_stage2_file`'s "a refusal row
    # must actually refuse" guard rejected them and the refusals lived in two hand-written
    # per-language lists instead. They are shared contract now.
    {
        "why": "an award direction outside the closed set {max, min}",
        "award": _award("kills", "volume", "highest", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20),
            _p(S_B, rounds=30, kills=25),
        ],
    },
    {
        "why": "a negative floor_rounds",
        "award": _award("kills", "volume", "max", -1, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    {
        "why": "an empty deciding_stat",
        "award": _award("", "volume", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20)],
    },
    {
        "why": "two players share a steamid64 — a snapshot holds one row per player",
        "award": _award("kills", "volume", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20),
            _p(S_A, rounds=30, kills=25),
        ],
    },
    {
        "why": "steamid64 is not a decimal string",
        "award": _award("kills", "volume", "max", 0, 0),
        "players": [_p("7656119800000001x", rounds=30, kills=20)],
    },
    {
        "why": "steamid64 is empty",
        "award": _award("kills", "volume", "max", 0, 0),
        "players": [_p("", rounds=30, kills=20)],
    },
    {
        "why": "rounds_played is negative",
        "award": _award("kills", "volume", "max", 0, 0),
        "players": [_p(S_A, rounds=-1, kills=20)],
    },
    {
        "why": "kills is negative",
        "award": _award("kills", "volume", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=-20)],
    },
    {
        "why": "the deciding VOLUME magnitude is negative",
        "award": _award("knife_kills", "volume", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20, vol={"knife_kills": -1})],
    },
    {
        "why": "a rate DENOMINATOR is negative — it would silently invert the cross-multiplication",
        "award": _award("entry_success", "rate", "max", 0, 0),
        "players": [
            _p(S_A, rounds=30, kills=20, rate={"entry_success": (5, -10)}),
            _p(S_B, rounds=30, kills=20, rate={"entry_success": (1, 10)}),
        ],
    },
    {
        "why": "a rate NUMERATOR is negative",
        "award": _award("entry_success", "rate", "max", 0, 0),
        "players": [_p(S_A, rounds=30, kills=20, rate={"entry_success": (-5, 10)})],
    },
]


def _render_player(p: dict) -> dict:
    """Snapshot magnitudes are DECIMAL STRINGS; see the file-format note in README.md."""
    return {
        "steamid64": p["steamid64"],
        "rounds_played": str(p["rounds_played"]),
        "kills": str(p["kills"]),
        "idle_dq": p["idle_dq"],
        "stats_int": {
            "volume": {k: str(v) for k, v in sorted(p["stats_int"]["volume"].items())},
            "rate": {
                k: {"num": str(v["num"]), "den": str(v["den"])}
                for k, v in sorted(p["stats_int"]["rate"].items())
            },
        },
    }


def build_stage2_file() -> dict:
    cases = []
    for c in STAGE2_CASES:
        cases.append(
            {
                "name": c["name"],
                "note": c["note"],
                "award": c["award"],
                "players": [_render_player(p) for p in c["players"]],
                "expected": resolve_stage2(c["award"], c["players"]),
            }
        )

    refusals = []
    for r in STAGE2_REFUSALS:
        try:
            got = resolve_stage2(r["award"], r["players"])
        except Stage2Refusal:
            pass
        else:
            raise SystemExit(f"refusal row {r['why']!r} did NOT refuse — it returned {got!r}")
        refusals.append(
            {
                "why": r["why"],
                "award": r["award"],
                "players": [_render_player(p) for p in r["players"]],
            }
        )

    return {
        "vector": "stage2-resolve",
        "algo_version": ALGO_VERSION,
        "spec": (
            "the award is validated FIRST (deciding_stat non-empty; class in {volume, rate}; "
            "direction in {max, min}; both floors non-negative integers) and refuses before "
            "eligibility is computed; eligible = players with rounds_played >= floor_rounds and "
            "kills >= floor_kills and not idle_dq, iterated byte-lex on the decimal steamid64 "
            "STRING; value = stats_int.volume[deciding_stat] (class volume) or "
            "stats_int.rate[deciding_stat] {num,den} (class rate); cmp = sign(p - q) for volume "
            "and sign(p.num*q.den - q.num*p.den) for rate; beats = cmp > 0 for direction max, "
            "cmp < 0 for min; best = the SET of players nobody beats; empty eligible set -> "
            "no_eligible_players; a max VOLUME award whose best value is 0 -> no_awardable_value "
            "CARRYING `tied`, the full byte-lex set that shared that zero (length 1 when a lone "
            "eligible player sat at zero); |best| == 1 -> winner; otherwise -> tie over the full "
            "byte-lex-ordered set with reason equal_value (volume) or equal_cross_product (rate)"
        ),
        "value_encoding": (
            "Every SNAPSHOT magnitude — steamid64, rounds_played, kills, each stats_int.volume "
            "entry and each stats_int.rate num/den — is a DECIMAL STRING, because they are "
            "unbounded integers (AD-19) and JSON.parse silently rounds anything past 2^53: the "
            "cross-multiplication-only case is corrupted at PARSE time if written as a JSON "
            "number. Every AWARD field is a JSON integer, because floor_rounds and floor_kills "
            "come from bounded `int` columns (0023:74-75)."
        ),
        "generated_by": GENERATED_BY,
        # ⭐ `shared` IS APPENDED BY STORY 6.5 AND IT IS THE ONLY CHANGED BYTE-RANGE IN THIS FILE.
        # The FR-29 ladder's fifth arm is something an award can conclude, so it belongs in the
        # closed set both runtimes pin themselves against — but the PURE stage can never produce it
        # (it resolves no tie), which is asserted separately over every case below. Appending rather
        # than inserting is what keeps the diff to these bytes.
        "outcome_kinds": ["winner", "tie", "no_eligible_players", "no_awardable_value", "shared"],
        "tie_reasons": ["equal_value", "equal_cross_product"],
        "refusals": refusals,
        "cases": cases,
    }


# ── Stage 1 (Story 6-4b): the seeded weighted live-category pick ──────────────
#
# Transcribed from SOLUTION-DESIGN §9.2 / ARCHITECTURE-SPINE:218 / epics.md:1066. Unlike
# Stage 2 this stage CONSUMES THE STREAM, so its byte accounting is contract rather than a
# side effect: every draw below records `bytes_consumed_after`, exactly as the uniform_int
# vector does, because that is the only externally visible proof that both runtimes walked
# the same stream — and the only way a rejection inside uniform_int is observable at all.
#
#     weight(a, players, shelf, table):
#         out = resolve_stage2(a.award, players)          # the provisional winner
#         if out.kind == tie:            REFUSE (typed, names Story 6.5)        # W9
#         if out.kind in {no_eligible_players, no_awardable_value}:
#                                        idx = 0          # no player => empty shelf => heaviest
#         else:                          idx = min(shelf.get(out.steamid64, 0), len(table) - 1)
#         return table[idx]
#
#     stage1_pick(stream, candidates, players, shelf, table, live_count):
#         validate(table)         # non-empty, strictly decreasing, every entry > 0      W7
#         validate(shelf)         # every size a NON-NEGATIVE integer                    W8
#         validate(candidates, live_count)
#                                 # non-empty pool, no duplicate award_id, no duplicate
#                                 # priority, every priority >= 1, 1 <= live_count <= |pool|
#                                                                                     W2, W6
#         cand = sort(candidates, key = priority)          # ASCENDING, a TOTAL order    W2
#         w    = [ weight(c) for c in cand ]               # the shelf is FROZEN here    W1
#         live = []
#         for _ in range(live_count):
#             total = sum(w[i] for i in remaining)         # RECOMPUTED each pick        W4
#             r     = uniform_int(stream, total)           # ALWAYS drawn; no short-circuit W5
#             cum   = 0
#             for i in remaining:                          # still ascending priority
#                 cum += w[i]
#                 if cum > r:                              # STRICTLY greater            W3
#                     live.append(cand[i].award_id); remove i; break
#         return live                                      # in DRAW order
#
# DECISION F (Cuatro, 2026-08-04) is a PRODUCT rule, not a spec transcription, and it is the
# one place two honest implementers would diverge on more than a byte: a `tie` has SEVERAL
# candidate shelves and choosing among them is the silent argmax AD-14 forbids, so it refuses
# naming Story 6.5; a `no_eligible_players` / `no_awardable_value` outcome has NO player at
# all, therefore no shelf, therefore index 0 — the heaviest weight, which is exactly what
# FR-26's "empty shelf => heaviest" is written to produce. Collapsing the two is a silent
# argmax on one side and an unrunnable ceremony on the other: Story 6-4a MEASURED all twelve
# real awards resolving to `no_eligible_players`.
#
# DECISION G (Cuatro, 2026-08-04): there is NO single-candidate short-circuit. The draw is
# ALWAYS uniform_int(stream, total_weight), so a one-candidate pool of weight 100 draws n=100
# and CONSUMES a byte; n = 1 — and therefore the zero-byte draw — arises ONLY when
# total_weight == 1. The two rules produce identical PICKS and different STREAM POSITIONS,
# which is invisible until the browser verifier calls a correct ceremony unfair. Both halves
# have their own case below.


class Stage1Refusal(Exception):
    """A programmer/data error BOTH runtimes must refuse loudly — never a business outcome.

    ⭐ IT NAMES WHICH INPUT WAS REJECTED (`detail`), and that is shared contract rather than
    decoration. Story 6-4b's mutation pass found the reason: deleting the NEGATIVE-SHELF guard
    left every gate green in TypeScript, because a negative index yields `undefined`, which
    becomes `NaN` in the weight sum and is refused three functions later — a `Stage1Error` all
    the same. Go, meanwhile, PANICS on `table[-1]`. So with `refusal_kind` alone the shared row
    could not tell "refused by the guard that exists for this" from "refused by accident, or by
    a crash". `detail` makes the two distinguishable in both languages, and it sharpens all
    seventeen invalid rows rather than only that one.

    This is the same lesson 6-4a learned one level up (an untyped refusal let a mutation that
    rejected EVERYTHING pass every row), applied one level deeper.
    """

    def __init__(self, detail: str, message: str) -> None:
        super().__init__(f"[{detail}] {message}")
        self.detail = detail


# The closed set of things a Stage-1 refusal can be ABOUT. Both runtimes must agree on it, so it
# travels in the vector alongside the rows.
REFUSAL_DETAILS = (
    "weight_table",   # W7 — the published luck table's shape
    "shelf",          # W8 — a shelf size
    "pool",           # W2/W6 — the candidate pool's shape
    "live_count",     # W6 — how many awards the spin asked for
    "total_weight",   # the sum left uniform_int's [1, 2^32]
    "stage2",         # a Stage-2 refusal propagated rather than swallowed
    "tie",            # W9 — which is `refusal_kind: tie`, not an invalid input
    "stream",         # no stream was supplied at all
    "internal",       # an invariant the implementation believes unreachable
    # ⭐ Story 6.5: the INJECTED FR-29 ladder ran and REFUSED. Its own label, not `tie` and not
    # `stage2` — the three mean genuinely different things to a caller: `tie` is "no ladder was
    # injected, so this seam is unfilled", `stage2` is "the award or the snapshot is malformed", and
    # this is "the ladder ran and refused". 6-4b's headline was a closed set that was not closed;
    # reusing an existing label to avoid growing the set would be the same defect chosen
    # deliberately. APPENDED, so `stage1-pick.json`'s existing rows stay byte-identical.
    "ladder",
)

# ⚠ THE LAST TWO ARE DECLARED BUT NOT ROW-REPRESENTABLE, and the distinction is the point. A row
# is a set of INPUTS; "no stream was supplied" and "an invariant broke" are not inputs, so no row
# can produce them — but both are reachable in both runtimes, which made a "closed set" that was
# not closed. The 6-4b code review found all three ways that went wrong: Go declared nine while
# TypeScript and this file declared seven, TypeScript threw 'stream'/'internal' anyway while its
# own JSDoc promised one of the seven, and the unreachable unknown-outcome arm refused as
# `internal` in Go and `stage2` in TypeScript — one input, two values, in the field this file
# calls shared contract. All three now declare the same TEN — the nine 6-4b settled on plus Story
# 6.5's appended `ladder` — `refusal_details` carries all ten so the suites can pin the set, and a
# ROW may still only carry EIGHT of them (the first seven, plus `ladder`).
#
# ⚠ THE NUMBERS ABOVE WERE "NINE" AND "SEVEN" UNTIL STORY 6-5b RE-COUNTED THEM. They were correct
# when written and were falsified by the very commit that cites 6-4b's stale-cardinality defect as
# the reason the comment exists. Counted, not asserted: `len(REFUSAL_DETAILS)` is 10 and
# `len(ROW_REPRESENTABLE_DETAILS)` is 8, and the assertion below makes the prose fail with the code
# rather than beside it.
ROW_REPRESENTABLE_DETAILS = REFUSAL_DETAILS[:7] + ("ladder",)

assert len(REFUSAL_DETAILS) == 10, "the comment above says TEN; count them"
assert len(ROW_REPRESENTABLE_DETAILS) == 8, "the comment above says EIGHT; count them"


class Stage1TieRefusal(Stage1Refusal):
    """W9 — a TIED provisional winner has no single shelf to look up.

    Its own subclass, not a message, because the two refusal kinds mean different things to
    the caller: an invalid input is a bug to fix, while a tie is the FR-29 seam Story 6.5
    fills. The vector carries `refusal_kind` so both runtimes must keep them distinguishable
    rather than collapsing every refusal into "some error".
    """

    def __init__(self, message: str) -> None:
        super().__init__("tie", message)


def _validate_weight_table(table) -> None:
    """W7 — the table is validated BEFORE any draw, so a malformed table cannot consume bytes.

    Non-empty, STRICTLY DECREASING, every entry > 0. Each clause earns its place:
      * a non-decreasing table INVERTS FR-26's bias — the luck meter would favour the loaded
        shelf, which is the opposite of the underdog rule the whole feature exists for;
      * a `0` entry makes a candidate unpickable while it still occupies the cumulative walk,
        so the pool silently shrinks without any refusal;
      * an empty table has no index 0 to give the empty shelf.
    """
    if not isinstance(table, list) or not table:
        raise Stage1Refusal("weight_table", "luck_weight_table must be a non-empty list")
    prev = None
    for w in table:
        if isinstance(w, bool) or not isinstance(w, int):
            raise Stage1Refusal("weight_table", f"luck_weight_table entries must be integers, got {w!r}")
        if w <= 0:
            raise Stage1Refusal(
                "weight_table",
                f"luck_weight_table entries must be > 0, got {w} — a non-positive weight makes a "
                "candidate unpickable while it still occupies the cumulative walk"
            )
        if prev is not None and w >= prev:
            raise Stage1Refusal(
                "weight_table",
                f"luck_weight_table must be STRICTLY DECREASING, got {prev} then {w} — a "
                "non-decreasing table inverts FR-26's bias toward the empty shelf"
            )
        prev = w


def _validate_shelf(shelf) -> None:
    """W8 — a shelf size is a NON-NEGATIVE integer; absent means 0, which is the normal case.

    A NEGATIVE size is refused rather than trusted because it is silently plausible in every
    language and differently wrong in each: Python and Ruby index from the END of the table
    (handing the LIGHTEST weight to the emptiest shelf, FR-26 exactly backwards), Go panics,
    and JavaScript yields `undefined`. Three behaviours, no error, one contract.

    An ABSENT shelf is the EMPTY shelf (Cuatro, 2026-08-04, resolving the 6-4b code review).
    Go cannot tell a nil map from an empty one, so `None` must mean here what nil means there
    or the anchor would arbitrate against the producer. A non-mapping is still a refusal —
    this used to raise a bare `AttributeError`, which is not a `Stage1Refusal`, so the
    generator would have died with a traceback instead of emitting a row.
    """
    if shelf is None:
        return
    if not isinstance(shelf, dict):
        raise Stage1Refusal(
            "shelf", f"shelf must be a mapping of steamid64 to a trophy count, got {shelf!r}"
        )
    for sid, size in shelf.items():
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise Stage1Refusal(
                "shelf", f"shelf[{sid!r}] must be a non-negative integer, got {size!r}"
            )


def _validate_pool(candidates) -> None:
    """W2 / W6 — the pool's own shape, and why every clause is a refusal and not a repair.

    W2: the walk order is ascending `priority`, and `UNIQUE(tournament_id, priority)`
    (0023:150) is the ONLY reason that order is total. A duplicate priority is therefore a
    refusal, not a stable-sort coin flip — two implementations would break the tie differently
    and the whole cumulative walk would shift. `priority > 0` mirrors 0023:139.

    W6: an empty pool, `live_count < 1` and `live_count > |pool|` are refusals rather than a
    short return or a clamp. A short return produces a spin with FEWER live categories than
    the plan promised, and nothing downstream can distinguish that from a plan that asked for
    fewer.
    """
    if not isinstance(candidates, list) or not candidates:
        raise Stage1Refusal(
            "pool",
            "the candidate pool is empty — a spin with nothing to draw is a refusal, never a "
            "short return"
        )
    seen_ids: set = set()
    seen_priorities: set = set()
    for c in candidates:
        # A malformed candidate used to raise a bare KeyError/TypeError here. That is not a
        # `Stage1Refusal`, so the generator aborted with a traceback rather than the deliberate
        # diagnostics it uses everywhere else — and the anchor's refusal surface has to be the
        # SHARED one, since it is what arbitrates between the two runtimes.
        if not isinstance(c, dict) or "award_id" not in c or "priority" not in c:
            raise Stage1Refusal(
                "pool", f"each candidate must be a mapping with award_id and priority, got {c!r}"
            )
        aid = c["award_id"]
        if not isinstance(aid, str) or aid == "":
            raise Stage1Refusal("pool", f"award_id must be a non-empty string, got {aid!r}")
        if aid in seen_ids:
            raise Stage1Refusal(
                "pool",
                f"duplicate award_id {aid!r} — one award appears at most once in a spin's pool"
            )
        seen_ids.add(aid)
        prio = c["priority"]
        if isinstance(prio, bool) or not isinstance(prio, int) or prio < 1:
            raise Stage1Refusal(
                "pool",
                f"priority must be a positive integer — 0023's award_priority_positive, got {prio!r}"
            )
        if prio in seen_priorities:
            raise Stage1Refusal(
                "pool",
                f"duplicate priority {prio} — UNIQUE(tournament_id, priority) is what makes "
                "ascending priority a TOTAL order, so a duplicate is a refusal rather than a "
                "stable-sort coin flip"
            )
        seen_priorities.add(prio)


def _validate_live_count(live_count, pool_size: int) -> None:
    """W6 — split from `_validate_pool` so all three implementations share one surface.

    The pool's own shape is checked by anything that WEIGHTS a pool; `live_count` is checked
    only by what DRAWS from it. Keeping the two separate is what lets `stage1_weights` be a
    public, side-effect-free entry point in both runtimes without inventing a `live_count` it
    does not use — and without the two ending up with different refusal surfaces, which is the
    asymmetry the shared `refusals` array exists to prevent.
    """
    if isinstance(live_count, bool) or not isinstance(live_count, int) or live_count < 1:
        raise Stage1Refusal("live_count", f"live_count must be an integer >= 1, got {live_count!r}")
    if live_count > pool_size:
        raise Stage1Refusal(
            "live_count",
            f"live_count {live_count} exceeds the {pool_size}-candidate pool — never a "
            "clamp: a clamped spin reveals fewer categories than the spin plan promised"
        )


def stage1_weight(award: dict, players: list, shelf: dict, table: list, ladder: bool = False) -> int:
    """The integer weight of ONE candidate — DECISION F lives here.

    `provisional_winner` is Stage 2's RAW outcome (`resolve_stage2`), never `resolve_award`:
    the refusing ladder would turn a tie into an error this function cannot inspect, and Stage
    1 must SEE the tie in order to refuse for the right reason.

    ⭐ STORY 6.5 — `ladder` IS OPTIONAL, AND OPTIONAL IS THE WHOLE DESIGN. With it False, this
    behaves EXACTLY as 6-4b shipped it (a tie is a typed refusal naming Story 6.5), which is what
    keeps all eighteen of gate 3's refusal rows valid and every existing row in this file
    byte-identical. With it True, the FR-29 ladder resolves the tie and the RESOLVED winner's shelf
    is what indexes the table.

    ⛔ THE LADDER DRAWS NOTHING (L1), so wiring it in here cannot move the stream — which is what
    lets W7's "validate before any draw" and the whole byte accounting survive the change.
    """
    # ⚠ AN ABSENT SHELF IS THE EMPTY SHELF, NORMALISED HERE AS WELL AS AT THE TWO CALLERS (Story
    # 6-5b, AC8). `stage1_weights` and `stage1_pick` both normalise before calling in, so this was
    # unreachable through them — but this function is PUBLIC and the `shared` branch added by 6.5
    # dereferences `shelf` one line before the single-winner branch does, so a direct caller passing
    # `None` got a bare `AttributeError` out of the anchor instead of the typed refusal both runtimes
    # produce. One fixture away, and the anchor is the implementation that arbitrates disagreements.
    shelf = {} if shelf is None else shelf
    try:
        out = resolve_stage2(award, players)
    except Stage2Refusal as err:
        # A Stage-2 refusal PROPAGATES rather than being swallowed into a weight — and it is
        # re-labelled `stage2` so both runtimes report WHERE it came from. Treating an
        # unresolvable award as a zero, or as the heaviest weight, would let a malformed catalog
        # draw a whole ceremony.
        raise Stage1Refusal("stage2", str(err)) from err

    # ⭐ STORY 6.5 — the OPTIONAL ladder resolves the tie before anything below reads the outcome.
    if out["kind"] == "tie" and ladder:
        try:
            out = resolve_ladder(award, out["tied"], players)
        except LadderRefusal as err:
            # PROPAGATED under its OWN label: "the ladder ran and refused" is a different fact from
            # "no ladder was injected" (`tie`) and from "the award or the snapshot is malformed"
            # (`stage2`).
            raise Stage1Refusal("ladder", f"the FR-29 ladder refused the tie: {err}") from err

    if out["kind"] == "shared":
        # ⭐⭐ THE PUBLISHED CO-WINNER RULE: **THE MINIMUM SHELF ACROSS THE CO-WINNERS** (Cuatro,
        # 2026-08-04). FR-26 biases toward the empty shelf, and `min` is the only aggregation that
        # keeps a co-win from REDUCING the luck owed to the emptiest shelf in it — with `max`, a
        # player holding nothing who shares with a player holding four is weighted as if they held
        # four, which is FR-26 running backwards for exactly the players it exists to protect.
        #
        # ⚠ NOT 6-4b's forbidden "min shelf over the TIED set": there the weighter would have been
        # inventing a winner; here the ladder already decided, deterministically and with zero bytes
        # drawn, and this only aggregates the shelves of players who genuinely share the award.
        #
        # W8 — the clamp comes AFTER the minimum.
        #
        # ⚠ THE TWO `internal` GUARDS BOTH RUNTIMES CARRY ON THIS ARM ARE STRUCTURALLY UNREACHABLE
        # HERE, AND THAT IS DECLARED RATHER THAN LEFT SILENT (DECISION D). Go and TypeScript refuse
        # `internal` on an empty `winners` slice and — since the Story 6-5b code review — on any
        # co-winner with an EMPTY steamid64, because their `Ladder` is an INJECTED PORT that can
        # hand them an outcome no code in the package built. This anchor's `ladder` parameter is a
        # BOOL, not a port: `out` here can only have come from `resolve_ladder` a few lines above,
        # which returns `winners` straight out of a `tied` set `_validate_ladder` has already
        # proved non-empty and free of empty ids. There is no injection seam, so there is no state
        # to guard — adding the checks would be dead code asserting something the type of the
        # parameter already gives. ⛔ If `ladder` ever becomes a callable here, BOTH guards must
        # arrive with it, or the anchor will resolve an input both runtimes refuse — which is
        # exactly the divergence DECISION C exists to prevent.
        idx = min(shelf.get(sid, 0) for sid in out["winners"])
        return table[min(idx, len(table) - 1)]

    if out["kind"] == "tie":
        raise Stage1TieRefusal(
            f"the provisional winner of {award['deciding_stat']!r} is a {len(out['tied'])}-way "
            f"{out['reason']} tie, so it has no single shelf to look up — resolving it is Story "
            "6.5's FR-29 ladder. Stage 1 will not pick one: min-shelf-over-the-tied-set, "
            "byte-lex-first and lowest-SteamID64 are all a silent argmax that 6.5 would later "
            "contradict, changing the drawn bytes from this spin onward"
        )
    if out["kind"] in ("no_eligible_players", "no_awardable_value"):
        # DECISION F — no player at all, so no shelf, so the maximal EMPTY shelf: index 0.
        idx = 0
    else:
        # W8 — `table_max` is len(table) - 1, NOT a length, and an absent player is shelf 0
        # (the normal case at the first spin, never an error).
        idx = min(shelf.get(out["steamid64"], 0), len(table) - 1)
    return table[idx]


def stage1_weights(candidates: list, players: list, shelf: dict, table: list, ladder: bool = False):
    """The candidates in ASCENDING priority order, and their weights aligned to that order.

    ⭐ The returned weights are indexed by the SORTED order, not by the order the caller
    supplied — which is what makes the `candidates-supplied-out-of-priority-order` case
    load-bearing rather than decorative.
    """
    # An ABSENT container is the EMPTY one, matching Go's nil map / nil slice. See
    # `_validate_shelf`.
    shelf = {} if shelf is None else shelf
    players = [] if players is None else players
    _validate_weight_table(table)
    _validate_shelf(shelf)
    _validate_pool(candidates)
    ordered = sorted(candidates, key=lambda c: c["priority"])
    return ordered, [stage1_weight(c["award"], players, shelf, table, ladder) for c in ordered]


def stage1_pick(stream: Stream, candidates: list, players: list, shelf: dict, table: list,
                live_count: int, ladder: bool = False) -> dict:
    """The stream-driven weighted pick. Every byte it moves is part of the contract.

    ⭐ VALIDATION ORDER IS PART OF THE CONTRACT. `live_count` is checked with the other shape
    checks, BEFORE the weight loop, because that is where this story's transcribed algorithm
    and the `spec` string below put it. The 6-4b code review found both shipped runtimes
    weighting first, so an input that was malformed in two ways at once — a bad `live_count`
    over a tied pool — refused as `invalid`/`live_count` here and as `tie` there, which routes
    a broken spin plan into Story 6.5's ladder. The `live-count-zero-over-a-tied-pool` refusal
    row is the only row that carries two defects and therefore the only one that can redden it.
    """
    shelf = {} if shelf is None else shelf
    players = [] if players is None else players
    _validate_weight_table(table)
    _validate_shelf(shelf)
    _validate_pool(candidates)
    _validate_live_count(live_count, len(candidates))

    # W1 — THE SHELF IS FROZEN AT SPIN START. The weights are computed ONCE, before the first
    # draw, and are not recomputed between the `live_count` picks of one spin even though the
    # first pick's award is about to be awarded. Recomputing would make the ceremony depend on
    # resolution order and would be unverifiable from the published bundle.
    ordered, weights = stage1_weights(candidates, players, shelf, table, ladder)

    remaining = list(range(len(ordered)))
    draws: list[dict] = []
    live: list[str] = []
    for _ in range(live_count):
        # W4 — the total is RECOMPUTED over the remaining candidates for every pick. Never
        # `r - cumulative`, never a second walk over the first draw's remainder: two picks are
        # two uniform_int calls and two byte movements, and `bytes_consumed_after` is what
        # proves it.
        total = sum(weights[i] for i in remaining)
        if total < N_MIN or total > N_MAX:
            raise Stage1Refusal(
                "total_weight",
                f"total_weight {total} is outside uniform_int's [{N_MIN}, {N_MAX}] — the largest "
                "REAL total is about 1200 (12 awards x weight 100), so a total near the bound "
                "means the weight table is wrong, not that the bound is tight"
            )
        # W5 / DECISION G — ALWAYS drawn. No single-candidate short-circuit.
        r = uniform_int(stream, total)
        draws.append({"n": total, "r": r, "bytes_consumed_after": stream.pos})
        cum = 0
        picked = -1
        for i in list(remaining):
            cum += weights[i]
            # W3 — STRICTLY greater. With weights [3, 2] and r = 3, `>` gives the second
            # candidate (correct: r in {0,1,2} -> first, {3,4} -> second) while `>=` gives the
            # first and silently hands it 4/5 of the probability mass. The off-by-one is
            # invisible in the result SHAPE and shifts every award from here on.
            if cum > r:
                picked = i
                live.append(ordered[i]["award_id"])
                remaining.remove(i)
                break
        if picked < 0:
            # Unreachable: r < total = the sum of the remaining weights, so the cumulative
            # necessarily exceeds it on some candidate. LOUD rather than silent, because both
            # shipped runtimes refuse here and this anchor used to fall through — which would
            # have written a vector whose `live` was SHORTER than `live_count` while `draws`
            # was full length. Go and TypeScript would then both refuse the row, and the
            # failure would read as "both runtimes are broken" rather than "the generator is".
            raise Stage1Refusal(
                "internal",
                f"the cumulative walk selected nothing for r={r} over total {total} — "
                "uniform_int's range broke"
            )
    return {
        "weights": weights,
        # The WHOLE pool's total, pinned separately from each draw's `n` so a summation bug is
        # its own failure rather than hiding inside a draw that happened to land the same way.
        "total_weight": sum(weights),
        "draws": draws,
        "live": live,
    }


# ── Stage 1: the case manifest — INPUTS only; every expected value is computed ─


def _c(award_id: str, priority: int, award: dict) -> dict:
    return {"award_id": award_id, "priority": priority, "award": award}


# SOLUTION-DESIGN §9.2's own example table. table_max = 5.
TABLE = [100, 40, 16, 6, 2, 1]

# The Stage-1 roster: four players, each the OUTRIGHT leader on a different deciding stat, so
# a candidate's provisional winner is a function of its `deciding_stat` and nothing else. A
# resolver that read the wrong key, or that ignored `direction`, lands on a different player
# and therefore a different weight — never coincidentally the right one.
#
#   knife_kills -> A   hs_kills -> B   wallbang_kills -> C   through_smoke_kills -> D
#   adr (rate)  -> C   deaths (min)   -> D
STAGE1_ROSTER: list[dict] = [
    _p(S_A, rounds=30, kills=20,
       vol={"knife_kills": 4, "hs_kills": 1, "wallbang_kills": 1, "through_smoke_kills": 1, "deaths": 20},
       rate={"adr": (600, 30)}),
    _p(S_B, rounds=30, kills=20,
       vol={"knife_kills": 2, "hs_kills": 9, "wallbang_kills": 2, "through_smoke_kills": 2, "deaths": 15},
       rate={"adr": (900, 30)}),
    _p(S_C, rounds=30, kills=20,
       vol={"knife_kills": 1, "hs_kills": 5, "wallbang_kills": 7, "through_smoke_kills": 3, "deaths": 10},
       rate={"adr": (1200, 30)}),
    _p(S_D, rounds=30, kills=20,
       vol={"knife_kills": 0, "hs_kills": 2, "wallbang_kills": 3, "through_smoke_kills": 8, "deaths": 5},
       rate={"adr": (300, 30)}),
]

# The shelf as it stands mid-ceremony. A is ABSENT (the normal shape at the first spin), D is
# PAST table_max so the clamp is exercised.
#   A absent -> 0 -> idx 0 -> 100      B 1 -> idx 1 -> 40
#   C 2      -> idx 2 -> 16            D 9 -> min(9, 5) -> idx 5 -> 1
SHELF = {S_B: 1, S_C: 2, S_D: 9}

AW_KNIFE = _c("aw-knife", 1, _award("knife_kills", "volume", "max", 0, 0))
AW_HS = _c("aw-hs", 2, _award("hs_kills", "volume", "max", 0, 0))
AW_WALLBANG = _c("aw-wallbang", 3, _award("wallbang_kills", "volume", "max", 0, 0))
AW_SMOKE = _c("aw-smoke", 4, _award("through_smoke_kills", "volume", "max", 0, 0))

# A roster where ONE player sweeps every deciding stat, so all three candidates weight
# identically — the shape that makes a recomputed shelf visible in `draws[1].n`.
STAGE1_ROSTER_ONE_SWEEPER: list[dict] = [
    _p(S_A, rounds=30, kills=20, vol={"knife_kills": 4, "wallbang_kills": 7, "through_smoke_kills": 8}),
    _p(S_B, rounds=30, kills=20, vol={"knife_kills": 1, "wallbang_kills": 2, "through_smoke_kills": 3}),
    _p(S_C, rounds=30, kills=20, vol={"knife_kills": 0, "wallbang_kills": 1, "through_smoke_kills": 1}),
]

# The 6.2/6-4a-measured real shape: rounds_played min 10 / max 21 against floor_rounds 24, so
# NOBODY clears the floors and every award resolves to `no_eligible_players`.
STAGE1_ROSTER_BELOW_FLOORS: list[dict] = [
    _p(S_A, rounds=21, kills=13, vol={"knife_kills": 1, "hs_kills": 4, "wallbang_kills": 2}),
    _p(S_B, rounds=10, kills=6, vol={"knife_kills": 0, "hs_kills": 2, "wallbang_kills": 1}),
    _p(S_C, rounds=18, kills=19, vol={"knife_kills": 0, "hs_kills": 7, "wallbang_kills": 3}),
]

# Nobody scored a knife kill, so a `max` volume award on it is DECISION E's
# `no_awardable_value` — which DECISION F weights as an empty shelf, not as a refusal.
STAGE1_ROSTER_ZERO_KNIFE: list[dict] = [
    _p(S_A, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 1}),
    _p(S_B, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 9}),
    _p(S_C, rounds=30, kills=20, vol={"knife_kills": 0, "hs_kills": 5}),
]

# Two players tied on the deciding stat: there is no single provisional winner, so no shelf.
STAGE1_ROSTER_TIED: list[dict] = [
    _p(S_A, rounds=30, kills=20, vol={"knife_kills": 7}),
    _p(S_B, rounds=30, kills=20, vol={"knife_kills": 7}),
    _p(S_C, rounds=30, kills=20, vol={"knife_kills": 3}),
]

# ⭐ THE SAME TIE, WITH REAL TIMESTAMPS, so the injected FR-29 ladder resolves it to a SINGLE winner
# at rung 4 instead of bottoming out at rung 5. `STAGE1_ROSTER_TIED` above carries the absent
# sentinel for everyone (the `_p` default), so it SHARES — the two rosters are what make the
# single-winner and the shared-co-winner Stage-1 rows distinguishable.
STAGE1_ROSTER_TIED_WITH_TS: list[dict] = [
    _p(S_A, rounds=30, kills=20, vol={"knife_kills": 7}, ts=5000),
    _p(S_B, rounds=30, kills=20, vol={"knife_kills": 7}, ts=1000),
    _p(S_C, rounds=30, kills=20, vol={"knife_kills": 3}, ts=9000),
]

STAGE1_CASES: list[dict] = [
    {
        "name": "shelf-to-weight-mapping-with-clamp-and-empty-shelf",
        "note": (
            "The weight rule itself, over all four of its branches at once: A is ABSENT from "
            "the shelf map (shelf 0 -> index 0 -> the HEAVIEST weight, which is the normal "
            "shape at the first spin and never an error), B sits mid-table at 1, C at 2, and D "
            "at 9 — PAST table_max — so `min(shelf, len(table) - 1)` clamps D to the last entry "
            "instead of indexing off the end. ⭐ `expected.weights` is as load-bearing as "
            "`expected.live` here: a vector that pinned only the winner would let a wrong shelf "
            "lookup pass on every spin where it happened to draw the same award."
        ),
        "src": {"kind": "stage1", "spin": 3},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: e["weights"] == [100, 40, 16, 1] and e["total_weight"] == 157,
    },
    {
        "name": "heaviest-weighted-candidate-is-not-the-one-drawn",
        "note": (
            "⭐ WITHOUT THIS ROW, 'weighted pick' AND 'argmax over the weights' ARE "
            "INDISTINGUISHABLE. The same four candidates, on a spin whose first draw lands at "
            "r >= 100 — past the heaviest candidate's whole share — so the award that is drawn "
            "is NOT the one holding the largest weight. An implementation that skipped the "
            "stream entirely and returned the maximum-weight candidate passes every other case "
            "in this file and fails here."
        ),
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: e["draws"][0]["r"] >= e["weights"][0] and e["live"] != ["aw-knife"],
    },
    {
        "name": "candidates-supplied-out-of-priority-order",
        "note": (
            "W2 — byte-identical to `heaviest-weighted-candidate-is-not-the-one-drawn` in every "
            "input EXCEPT the order the candidates are handed in, which is DESCENDING priority "
            "here. The expected weights, total, draw and pick are therefore identical: the "
            "resolver must do its own ascending-priority sort rather than inherit the fixture's "
            "order. It is not cosmetic — walking the supplied order would accumulate "
            "1, 17, 57, 157 instead of 100, 140, 156, 157, so the same `r` selects a different "
            "award."
        ),
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_SMOKE, AW_WALLBANG, AW_HS, AW_KNIFE],
        "pins": lambda e: e["weights"] == [100, 40, 16, 1],
    },
    {
        "name": "r-lands-exactly-on-a-cumulative-boundary",
        "note": (
            "⭐⭐ THE HIGHEST-VALUE ROW IN THIS FILE — W3's `cum > r` versus `cum >= r`. The "
            "table is [3, 2]: A is absent from the shelf (weight 3) and B sits at 1 (weight 2), "
            "so total_weight is 5 and the cumulative boundary after the first candidate is "
            "EXACTLY 3. This spin's first draw returns r = 3. The rule is `the first candidate "
            "whose running cumulative is STRICTLY GREATER than r`, so 3 > 3 is false and the "
            "SECOND candidate is drawn — which is correct, because r in {0,1,2} is the first "
            "candidate's share and {3,4} is the second's. An implementation using `>=` picks the "
            "FIRST and silently hands it 4/5 of the probability mass. The result SHAPE is "
            "identical either way, and every other draw in this file has r strictly inside a "
            "candidate's span and cannot tell the two apart. This is the same off-by-one class "
            "`exact-threshold-rejection-x-equals-limit` pins for uniform_int, which the 6.3 "
            "mutation pass found surviving the ENTIRE suite in BOTH languages."
        ),
        "src": {"kind": "stage1", "spin": 2},
        "table": [3, 2],
        "shelf": {S_B: 1},
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS],
        "pins": lambda e: (
            e["weights"] == [3, 2]
            and e["total_weight"] == 5
            and e["draws"][0]["r"] == e["weights"][0]
            and e["live"] == ["aw-hs"]
        ),
    },
    {
        "name": "live-count-2-redraws-against-the-recomputed-total",
        "note": (
            "W4 — a `live_count > 1` spin REMOVES the candidate it picked and draws again "
            "against the RECOMPUTED total, never against the first draw's remainder and never "
            "against the original total. Three candidates weigh 100/40/16, so the first draw is "
            "over n = 156 and the second over 156 minus whatever was removed. `draws[1].n` is "
            "the assertion: reusing the remainder consumes no second draw at all, and re-drawing "
            "against the original total leaves n unchanged. Two picks means two uniform_int "
            "calls and two byte movements, which `bytes_consumed_after` records. ⚠ The first "
            "draw here also REJECTS inside uniform_int (n = 156 -> k = 1, limit 156), so "
            "bytes_consumed_after advances by more than one byte — a Stage-1 draw inherits "
            "rejection sampling and must not assume one byte per pick."
        ),
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 2,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG],
        "pins": lambda e: (
            len(e["draws"]) == 2
            and e["draws"][0]["n"] == 156
            and e["draws"][1]["n"] != e["draws"][0]["n"]
            and e["draws"][1]["n"] == 156 - e["weights"][["aw-knife", "aw-hs", "aw-wallbang"].index(e["live"][0])]
            and len(set(e["live"])) == 2
            # ⭐ THIS ROW IS THE ONLY ONE WHOSE DRAW ORDER DIFFERS FROM PRIORITY ORDER, so it is
            # the only row that can catch a selector which sorted its output. The drain row's
            # note used to claim the same property and does not have it (its draw order IS
            # 1,2,3,4) — the 6-4b review caught that, so the property is asserted here, by name,
            # rather than by an any-row scan that could silently go vacuous.
            and e["live"] == ["aw-hs", "aw-knife"]
            and e["draws"][0]["bytes_consumed_after"] > 1
        ),
    },
    {
        "name": "the-shelf-is-frozen-across-the-picks-of-one-spin",
        "note": (
            "⭐ W1 — the shelf is frozen at SPIN start, not at PICK start (SOLUTION-DESIGN:411). "
            "One player is the provisional winner of all three candidates and holds an empty "
            "shelf, so every weight is the heaviest and the first draw is over n = 300. Because "
            "the shelf is frozen, the second draw is over n = 200. An implementation that "
            "credited the first pick to its winner before the second pick would reweight the two "
            "survivors from 100 to 40 and draw over n = 80 instead — a different byte count and "
            "a different ceremony, from a rule nothing else in this file constrains. Recomputing "
            "would also make the ceremony depend on resolution order, which is unverifiable from "
            "the published bundle."
        ),
        "src": {"kind": "stage1", "spin": 5},
        "table": TABLE,
        "shelf": {},
        "live_count": 2,
        "players": STAGE1_ROSTER_ONE_SWEEPER,
        "candidates": [AW_KNIFE, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: (
            e["weights"] == [100, 100, 100]
            and e["draws"][0]["n"] == 300
            and e["draws"][1]["n"] == 200
        ),
        # ⭐ THE PROPERTY THAT MAKES THIS ROW DISCRIMINATE IS AN INPUT PROPERTY, so it has to be
        # re-derived from the INPUTS. The 6-4b code review found that all three guards checked
        # only "weights all equal" and 300/200 — which ANY roster with real winners satisfies —
        # so `STAGE1_ROSTER_ONE_SWEEPER` could have been swapped for a roster where each
        # candidate has a DIFFERENT winner and every gate would have stayed green while the row
        # silently stopped killing the recomputed-shelf mutation. It only discriminates because
        # ONE player wins ALL THREE candidates: crediting the first pick to its winner then
        # reweights the two survivors from 100 to 40. That is what is asserted here.
        "pins_inputs": lambda e, c: (
            all(
                resolve_stage2(x["award"], c["players"])["kind"] == "winner"
                for x in c["candidates"]
            )
            and len(
                {
                    resolve_stage2(x["award"], c["players"])["steamid64"]
                    for x in c["candidates"]
                }
            ) == 1
        ),
    },
    {
        "name": "single-candidate-pool-still-draws-and-consumes-a-byte",
        "note": (
            "DECISION G, half one. A one-candidate pool is NOT short-circuited: the draw is "
            "always uniform_int(stream, total_weight), and here total_weight is 100, so n = 100, "
            "k = 1 and the stream MOVES. The pick is a foregone conclusion; the byte is not. An "
            "implementation that special-cased |pool| == 1 returns the same award and leaves the "
            "stream one byte behind, and every subsequent spin in that ceremony then diverges — "
            "invisibly, until the browser verifier disagrees."
        ),
        "src": {"kind": "stage1", "spin": 6},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
        "pins": lambda e: (
            e["weights"] == [100]
            and e["draws"][0]["n"] == 100
            and e["draws"][0]["bytes_consumed_after"] >= 1
            and e["live"] == ["aw-knife"]
        ),
    },
    {
        "name": "total-weight-one-is-the-only-zero-byte-draw",
        "note": (
            "DECISION G, half two, and the E1 path. `n = 1` arises ONLY when total_weight is 1 — "
            "one candidate whose provisional winner sits at or past table_max, on the table's "
            "smallest entry. minimal k with 256^k >= 1 is k = 0, so this draw reads NOTHING and "
            "bytes_consumed_after stays 0. Read together with the row above, the pair pins "
            "DECISION G exactly: the zero-byte draw is a property of the WEIGHT, never of the "
            "pool SIZE."
        ),
        "src": {"kind": "stage1", "spin": 7},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_SMOKE],
        "pins": lambda e: (
            e["weights"] == [1]
            and e["draws"][0]["n"] == 1
            and e["draws"][0]["r"] == 0
            and e["draws"][0]["bytes_consumed_after"] == 0
        ),
    },
    {
        "name": "every-candidate-has-no-eligible-players-and-weights-heaviest",
        "note": (
            "⭐ DECISION F OVER THE MEASURED REAL CORPUS. Story 6-4a measured all twelve real "
            "awards resolving to `no_eligible_players` under the shipped 24/20 floors "
            "(rounds_played min 10 / max 21), so this is TODAY's shape, not a hypothetical. A "
            "no-winner outcome has no player, therefore no shelf, therefore index 0 — the "
            "HEAVIEST weight, which is exactly what FR-26's 'empty shelf => heaviest' is written "
            "to produce. Every candidate weighs the same, so Stage 1 on the real corpus draws "
            "UNIFORMLY: a correct consequence of a measured input rather than a bug. Refusing "
            "here instead would make the ceremony unrunnable today. Note the shelf map is "
            "supplied and deliberately NOT consulted — there is no winner to look up."
        ),
        "src": {"kind": "stage1", "spin": 4},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER_BELOW_FLOORS,
        "candidates": [
            _c("aw-knife", 1, _award("knife_kills", "volume", "max", 24, 20)),
            _c("aw-hs", 2, _award("hs_kills", "volume", "max", 24, 20)),
            _c("aw-wallbang", 3, _award("wallbang_kills", "volume", "max", 24, 20)),
        ],
        "pins": lambda e: e["weights"] == [100, 100, 100] and e["total_weight"] == 300,
        # ⭐ RE-DERIVE THE OUTCOME KIND THIS ROW IS NAMED FOR. "every weight is table[0]" is also
        # true of a roster whose players simply WIN with an empty shelf, so without this the
        # `no_eligible_players` branch could go untested while AC3 still claimed it covered.
        "pins_inputs": lambda e, c: all(
            resolve_stage2(x["award"], c["players"])["kind"] == "no_eligible_players"
            for x in c["candidates"]
        ),
    },
    {
        "name": "no-awardable-value-weights-as-an-empty-shelf",
        "note": (
            "DECISION F's other no-winner arm, kept distinct from the row above because they "
            "arrive by different routes: here players ARE eligible, but the best deciding value "
            "is 0 on a `max` volume award, so DECISION E returns `no_awardable_value` carrying "
            "the suppressed set. That outcome still has no single winner and therefore no shelf, "
            "so it weighs heaviest — while the second candidate resolves normally to a player "
            "who already holds one trophy and weighs 40. An implementation that refused on "
            "`no_awardable_value`, or that tried to read a shelf for the suppressed set, "
            "diverges here and nowhere else."
        ),
        "src": {"kind": "stage1", "spin": 8},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER_ZERO_KNIFE,
        "candidates": [AW_KNIFE, AW_HS],
        "pins": lambda e: e["weights"] == [100, 40],
        # Same reasoning as the row above: `[100, 40]` is satisfiable without any
        # `no_awardable_value` outcome ever occurring, so the KIND is re-derived here.
        "pins_inputs": lambda e, c: (
            resolve_stage2(c["candidates"][0]["award"], c["players"])["kind"]
            == "no_awardable_value"
            and resolve_stage2(c["candidates"][1]["award"], c["players"])["kind"] == "winner"
        ),
    },
    {
        "name": "min-and-rate-candidates-resolve-through-the-real-stage-2",
        "note": (
            "The provisional winner really is Stage 2's outcome, over both of the branches the "
            "catalog actually uses: a `min` VOLUME award (fewest deaths -> D, who sits past "
            "table_max and weighs 1) and a `rate` award compared by cross-multiplication "
            "(highest ADR -> C, who sits at shelf 2 and weighs 16), alongside an ordinary `max` "
            "volume award (-> A, absent from the shelf, weight 100). An implementation that "
            "re-derived the winner itself — reading `stat_row`, or ignoring `direction`, or "
            "dividing the rate pair — lands on a different player and therefore a different "
            "weight for two of these three."
        ),
        "src": {"kind": "stage1", "spin": 9},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [
            AW_KNIFE,
            _c("aw-adr", 5, _award("adr", "rate", "max", 0, 0)),
            _c("aw-deaths", 6, _award("deaths", "volume", "min", 0, 0)),
        ],
        "pins": lambda e: e["weights"] == [100, 16, 1] and e["total_weight"] == 117,
    },
    {
        "name": "an-absent-shelf-map-is-shelf-zero-for-everyone",
        "note": (
            "W8 — the FIRST spin of every ceremony: nobody holds anything, the shelf map is "
            "EMPTY, and an absent player is shelf 0 rather than a lookup failure. All four "
            "candidates therefore weigh the heaviest entry and the draw is uniform over 400. "
            "Read against `shelf-to-weight-mapping-with-clamp-and-empty-shelf`, which uses the "
            "same pool and the same players, this isolates the shelf as the only input that "
            "changed."
        ),
        "src": {"kind": "stage1", "spin": 10},
        "table": TABLE,
        "shelf": {},
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: e["weights"] == [100, 100, 100, 100] and e["total_weight"] == 400,
    },
    {
        "name": "an-omitted-shelf-key-is-the-empty-shelf",
        "note": (
            "⭐ THE TWIN OF `an-absent-shelf-map-is-shelf-zero-for-everyone`, and the only "
            "difference is that this row has NO `shelf` KEY AT ALL rather than an empty object. "
            "Its expected block is therefore byte-identical to its twin's, and that identity IS "
            "the assertion: an absent container is the EMPTY container, in all three "
            "implementations. The 6-4b code review found the seam disagreeing here — Go's nil "
            "map ranged zero times and PUBLISHED a ceremony, TypeScript's `typeof undefined !== "
            "'object'` REFUSED it, and this generator raised a bare AttributeError — so a "
            "correctly produced ceremony would have been called unfair by the verifier, which is "
            "the exact W10-class divergence the vector seam exists to catch. Go cannot tell nil "
            "from empty without a pointer and W8 already says an absent PLAYER is shelf 0, so "
            "'absent is empty' is the rule the other two were brought to (Cuatro, 2026-08-04). "
            "⚠ `null` and structurally-wrong shelves are still refused by TypeScript and Python "
            "and are deliberately NOT vectorable: Go cannot express them."
        ),
        "src": {"kind": "stage1", "spin": 10},
        "table": TABLE,
        # None means OMIT the key entirely — see build_stage1_file.
        "shelf": None,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: e["weights"] == [100, 100, 100, 100] and e["total_weight"] == 400,
    },
    {
        "name": "live-count-equal-to-the-whole-pool-drains-it-in-draw-order",
        "note": (
            "The upper edge of W6's `1 <= live_count <= |pool|`: drawing the entire pool is "
            "LEGAL, and the last pick is the one whose total_weight has shrunk to a single "
            "candidate's weight — which is where a re-draw that reused the previous remainder, "
            "or that kept drawing against the original total, finally produces an out-of-range "
            "index rather than a plausible answer. `expected.live` is in DRAW order, which is "
            "the reveal order, and 6.6 re-sorts by priority for anti-sweep rather than expecting "
            "this to be sorted. ⚠ THIS ROW'S DRAW ORDER HAPPENS TO EQUAL PRIORITY ORDER "
            "(1, 2, 3, 4), so it does NOT discriminate draw order from a selector that sorted "
            "its output — an earlier version of this note claimed it did, and the 6-4b code "
            "review caught the claim. The row that carries that property is "
            "`live-count-2-redraws-against-the-recomputed-total`, whose live is "
            "[aw-hs, aw-knife]; its `pins` and both suites now assert it BY NAME."
        ),
        "src": {"kind": "stage1", "spin": 11},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 4,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS, AW_WALLBANG, AW_SMOKE],
        "pins": lambda e: (
            len(e["draws"]) == 4
            and len(set(e["live"])) == 4
            and e["draws"][3]["n"] == e["total_weight"] - sum(
                e["weights"][["aw-knife", "aw-hs", "aw-wallbang", "aw-smoke"].index(a)] for a in e["live"][:3]
            )
        ),
    },
    # ── APPENDED BY STORY 6.5 (Task 5b). Everything above is byte-identical. ───────────────────
    {
        "name": "an-injected-ladder-RESOLVES-a-tie-that-would-otherwise-refuse",
        "note": (
            "⭐ THE ROW THAT UN-HALTS THE CEREMONY. `aw-knife` has a two-way `equal_value` "
            "provisional winner, which without a ladder is a TYPED REFUSAL naming Story 6.5 (the "
            "`refusals` row below it is still there and still correct — that is the NO-LADDER "
            "contract). With the FR-29 ladder injected the tie is genuinely resolved: rungs 1 and 2 "
            "are skipped (no rung keys), rung 3 skips (no h2h), and rung 4 gives it to B, whose "
            "1000 beats A's 5000. B sits at shelf 1, so the candidate weighs 40 rather than the "
            "heaviest 100 — which is what proves the RESOLVED winner's shelf is the one being "
            "looked up, not the tie's first member (A, absent from the shelf, would weigh 100). ⛔ "
            "THE LADDER DRAWS NOTHING, so every byte position in this row is what it would have "
            "been if the tie had never formed."
        ),
        "src": {"kind": "stage1", "spin": 2},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "ladder": True,
        "players": STAGE1_ROSTER_TIED_WITH_TS,
        "candidates": [AW_KNIFE, AW_HS],
        "pins": lambda e: e["weights"] == [40, 100] and e["total_weight"] == 140,
        # ⭐ RE-DERIVE THE INPUT PROPERTY. `[40, 100]` is producible by any roster whose first
        # candidate is won outright by a shelf-1 player, so without this the row could stop
        # exercising the ladder entirely and every gate would stay green. The checks are: Stage 2
        # really does TIE on the first candidate, the ladder really does resolve it to a SINGLE
        # winner, and that winner is NOT the first member of the tied set (so "the tie's first" and
        # "the ladder's answer" are distinguishable here).
        "pins_inputs": lambda e, c: (
            resolve_stage2(c["candidates"][0]["award"], c["players"])["kind"] == "tie"
            and resolve_ladder(
                c["candidates"][0]["award"],
                resolve_stage2(c["candidates"][0]["award"], c["players"])["tied"],
                c["players"],
            )["kind"] == "winner"
            and resolve_ladder(
                c["candidates"][0]["award"],
                resolve_stage2(c["candidates"][0]["award"], c["players"])["tied"],
                c["players"],
            )["steamid64"]
            != resolve_stage2(c["candidates"][0]["award"], c["players"])["tied"][0]
        ),
    },
    {
        "name": "a-SHARED-co-winner-weights-at-the-MINIMUM-shelf",
        "note": (
            "⭐⭐ THE PUBLISHED CO-WINNER RULE, AND THE ONLY ROW THAT CAN PIN IT. The same tie, over "
            "a roster where every `achievement_ts` is the ABSENT SENTINEL — so rung 4 skips and the "
            "ladder bottoms out at rung 5 with A and B SHARING the award. They hold DIFFERENT "
            "shelves: A is absent from the map (shelf 0) and B sits at 1. The rule is the MINIMUM, "
            "so the candidate weighs table[0] = 100; the MAXIMUM would give table[1] = 40 and a "
            "different total, a different `n` and a different drawn award. FR-26 biases toward the "
            "empty shelf, and `min` is the only aggregation that keeps a co-win from REDUCING the "
            "luck owed to the emptiest shelf in it — with `max`, a player holding nothing who "
            "shares with a player holding four is weighted as if they held four. ⚠ This is NOT "
            "6-4b's forbidden `min shelf over the tied set` fallback: there the WEIGHTER would have "
            "been inventing a winner, and here the LADDER has already decided, deterministically "
            "and with zero bytes drawn."
        ),
        "src": {"kind": "stage1", "spin": 3},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "ladder": True,
        "players": STAGE1_ROSTER_TIED,
        "candidates": [AW_KNIFE, AW_HS],
        "pins": lambda e: e["weights"] == [100, 100] and e["total_weight"] == 200,
        # ⭐ GUARD THE GUARD, AND THIS ONE MATTERS MORE THAN MOST: `[100, 100]` is what ANY pair of
        # empty-shelf winners produces, so the numbers alone say nothing about the aggregation. The
        # checks re-derive that the outcome really is SHARED, that the co-winners hold DIFFERENT
        # shelves, and that `min` and `max` would therefore give DIFFERENT weights — without which
        # the row cannot distinguish the two rules at all.
        # ⭐ IT READS `c["shelf"]` AND `c["table"]`, NOT THE MODULE GLOBALS (Story 6-5b, T4). Reading
        # `SHELF`/`TABLE` meant the guard described the module rather than the row: a row given its
        # own shelf map would have been checked against somebody else's.
        "pins_inputs": lambda e, c: (
            (lambda shared: (
                shared["kind"] == "shared"
                and len(shared["winners"]) >= 2
                and len({c["shelf"].get(w, 0) for w in shared["winners"]}) > 1
                and c["table"][min(
                    min(c["shelf"].get(w, 0) for w in shared["winners"]), len(c["table"]) - 1
                )]
                != c["table"][min(
                    max(c["shelf"].get(w, 0) for w in shared["winners"]), len(c["table"]) - 1
                )]
                and e["weights"][0] == c["table"][min(
                    min(c["shelf"].get(w, 0) for w in shared["winners"]), len(c["table"]) - 1
                )]
            ))(
                resolve_ladder(
                    c["candidates"][0]["award"],
                    resolve_stage2(c["candidates"][0]["award"], c["players"])["tied"],
                    c["players"],
                )
            )
        ),
    },
    {
        "name": "a-SHARED-co-winner-shelf-is-CLAMPED-to-table_max-after-the-minimum",
        "note": (
            "⭐ W8's CLAMP ON THE SHARED ARM, which no row exercised: the one shared row's co-winners "
            "sit at shelves 0 and 1, both comfortably inside the table, so `min(idx, len(table)-1)` "
            "was an identity there and the shared arm could have shipped WITHOUT a clamp at all — an "
            "index-out-of-range PANIC in Go and a silent `undefined as number` in TypeScript, which "
            "is the same one-input-two-failure-kinds split 6-4b's review recorded for the single- "
            "winner arm. The same tie, over a shelf where BOTH co-winners are past table_max: A at 7 "
            "and B at 9. The minimum is 7, the clamp brings it to 5, and the candidate weighs "
            "table[5] = 1 — the LIGHTEST weight, which is the right answer: two players carrying "
            "SEVEN and NINE trophies are exactly who FR-26 exists to damp, and the pair weighs as "
            "the EMPTIER of them (7) before the clamp, never as the fuller. ⚠ THE CLAMP COMES "
            "AFTER THE MINIMUM, and this row cannot tell the two orders apart (the clamp is "
            "monotone, so clamp(min(S)) == min(clamp(S))) — that distinction is recorded as having "
            "no observable difference rather than pinned by a row that cannot pin it."
        ),
        "src": {"kind": "stage1", "spin": 4},
        "table": TABLE,
        "shelf": {S_A: 7, S_B: 9},
        "live_count": 1,
        "ladder": True,
        "players": STAGE1_ROSTER_TIED,
        "candidates": [AW_KNIFE, AW_HS],
        "pins": lambda e: e["weights"] == [1, 100] and e["total_weight"] == 101,
        # ⭐ RE-DERIVE THE CLAMP FROM THE ROW'S OWN DATA: the outcome really is SHARED, EVERY
        # co-winner's shelf is strictly past the table's last index (so the clamp is not an identity
        # for any of them), and the emitted weight is the table's LAST entry.
        "pins_inputs": lambda e, c: (
            (lambda shared: (
                shared["kind"] == "shared"
                and len(shared["winners"]) >= 2
                and all(c["shelf"].get(w, 0) > len(c["table"]) - 1 for w in shared["winners"])
                and e["weights"][0] == c["table"][-1]
            ))(
                resolve_ladder(
                    c["candidates"][0]["award"],
                    resolve_stage2(c["candidates"][0]["award"], c["players"])["tied"],
                    c["players"],
                )
            )
        ),
    },
]

# Inputs BOTH runtimes must REFUSE, and — like `stage2-resolve.json`'s list — they travel in
# the vector rather than in two hand-written per-language lists. Only refusals both languages
# can REPRESENT appear here (README.md:104-109): a non-integer `live_count` or a fractional
# weight is unrepresentable in Go's `int`, so those stay per-suite runtime assertions.
#
# ⭐ `refusal_kind` distinguishes the TIE from every invalid input. They are different things
# to the caller: an invalid input is a bug to fix, a tie is the FR-29 seam Story 6.5 fills.
# Collapsing them — or asserting only "some error" — is precisely what let a 6-4a mutation
# that made validation reject EVERYTHING pass every refusal row.
STAGE1_REFUSALS: list[dict] = [
    {
        "why": "the provisional winner is a TIE, which has no single shelf — Story 6.5's FR-29 ladder",
        "refusal_kind": "tie",
        "detail": "tie",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER_TIED,
        "candidates": [AW_KNIFE, AW_HS],
    },
    {
        "why": (
            "live_count = 0 over a pool whose first candidate TIES — the ONLY row carrying two "
            "defects at once, and therefore the only row that pins VALIDATION ORDER. The 6-4b "
            "code review found Go and TypeScript weighting first and refusing as `tie` here, "
            "while this anchor validated live_count first and refused as `invalid`/`live_count`. "
            "One input, two refusal KINDS — and a caller routing on refusal_kind hands a "
            "malformed spin plan to Story 6.5's ladder. The story's transcribed algorithm and "
            "this file's `spec` string both put `1 <= live_count <= |pool|` in the POOL group, "
            "before the weight loop, so the runtimes were brought here rather than the reverse. "
            "Every other row is malformed in exactly one way and cannot see the difference."
        ),
        "refusal_kind": "invalid",
        "detail": "live_count",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 0,
        "players": STAGE1_ROSTER_TIED,
        "candidates": [AW_KNIFE, AW_HS],
    },
    {
        "why": "a malformed award — Stage 2's own refusal PROPAGATES rather than being swallowed into a weight",
        "refusal_kind": "invalid",
        "detail": "stage2",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [_c("aw-bad", 1, _award("knife_kills", "ratio", "max", 0, 0))],
    },
    {
        "why": "the deciding key is absent from an ELIGIBLE player — Stage 2 refuses and Stage 1 must not weight it as a zero",
        "refusal_kind": "invalid",
        "detail": "stage2",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": [
            _p(S_A, rounds=30, kills=20, drop_volume=("knife_kills",)),
            _p(S_B, rounds=30, kills=20, vol={"knife_kills": 1}),
        ],
        "candidates": [AW_KNIFE],
    },
    {
        "why": "an EMPTY candidate pool — never a short return",
        "refusal_kind": "invalid",
        "detail": "pool",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [],
    },
    {
        "why": "live_count = 0 — a spin that reveals nothing is a refusal, not a no-op",
        "refusal_kind": "invalid",
        "detail": "live_count",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 0,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS],
    },
    {
        "why": "a NEGATIVE live_count",
        "refusal_kind": "invalid",
        "detail": "live_count",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": -1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS],
    },
    {
        "why": "live_count exceeds the pool — never a clamp, or the spin reveals fewer categories than the plan promised",
        "refusal_kind": "invalid",
        "detail": "live_count",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 3,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS],
    },
    {
        "why": "a duplicate award_id in the pool",
        "refusal_kind": "invalid",
        "detail": "pool",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, _c("aw-knife", 2, _award("hs_kills", "volume", "max", 0, 0))],
    },
    {
        "why": "a duplicate priority — UNIQUE(tournament_id, priority) is what makes the walk order TOTAL",
        "refusal_kind": "invalid",
        "detail": "pool",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, _c("aw-hs", 1, _award("hs_kills", "volume", "max", 0, 0))],
    },
    {
        "why": "a non-positive priority — 0023's award_priority_positive",
        "refusal_kind": "invalid",
        "detail": "pool",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [_c("aw-knife", 0, _award("knife_kills", "volume", "max", 0, 0))],
    },
    {
        "why": "an EMPTY weight table — there is no index 0 to give the empty shelf",
        "refusal_kind": "invalid",
        "detail": "weight_table",
        "src": {"kind": "stage1", "spin": 1},
        "table": [],
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "a weight table containing 0 — a candidate that cannot be picked while it still occupies the walk",
        "refusal_kind": "invalid",
        "detail": "weight_table",
        "src": {"kind": "stage1", "spin": 1},
        "table": [100, 40, 0],
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "a weight table that is not STRICTLY decreasing (two equal adjacent entries)",
        "refusal_kind": "invalid",
        "detail": "weight_table",
        "src": {"kind": "stage1", "spin": 1},
        "table": [100, 40, 40, 6],
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "an INCREASING weight table — it would invert FR-26's bias and favour the loaded shelf",
        "refusal_kind": "invalid",
        "detail": "weight_table",
        "src": {"kind": "stage1", "spin": 1},
        "table": [1, 2, 3],
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "a NEGATIVE weight-table entry — strictly decreasing yet not all > 0, so the two clauses are independent",
        "refusal_kind": "invalid",
        "detail": "weight_table",
        "src": {"kind": "stage1", "spin": 1},
        "table": [100, 40, -5],
        "shelf": SHELF,
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "a NEGATIVE shelf size — it indexes from the END of the table in some languages and is out of range in others",
        "refusal_kind": "invalid",
        "detail": "shelf",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": {S_A: -1},
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE],
    },
    {
        "why": "total_weight above uniform_int's 2^32 bound — the table is wrong, not the bound tight",
        "refusal_kind": "invalid",
        "detail": "total_weight",
        "src": {"kind": "stage1", "spin": 1},
        "table": [4294967296, 1],
        "shelf": {},
        "live_count": 1,
        "players": STAGE1_ROSTER,
        "candidates": [AW_KNIFE, AW_HS],
    },
    # ── APPENDED BY STORY 6.5 (Task 5b). Everything above is byte-identical. ───────────────────
    {
        "why": (
            "an INJECTED ladder that REFUSES — a bogus secondary_stat on a tied award. Its own "
            "`detail`, not `tie` and not `stage2`: the three mean genuinely different things to a "
            "caller, and 6-4b's headline was a closed set that was not closed"
        ),
        "refusal_kind": "invalid",
        "detail": "ladder",
        "src": {"kind": "stage1", "spin": 1},
        "table": TABLE,
        "shelf": SHELF,
        "live_count": 1,
        "ladder": True,
        "players": STAGE1_ROSTER_TIED,
        # ⚠ Built inline rather than through `_ladder_award`, which is defined further down with the
        # rest of the ladder section: this list is evaluated at import time and would NameError.
        "candidates": [
            _c("aw-knife", 1, {
                **_award("knife_kills", "volume", "max", 0, 0),
                "secondary_stat": "not_a_stat",
                "eff_num_key": None,
                "eff_den_key": None,
            }),
        ],
    },
]


def _render_candidate(c: dict) -> dict:
    """`priority` and every weight stay JSON INTEGERS — see the value_encoding note.

    The split is by PROVENANCE, exactly as in `stage2-resolve.json`: snapshot magnitudes are
    unbounded (AD-19) and travel as decimal strings, while priorities, weights, live_count,
    shelf sizes, `n`, `r` and byte positions come from the award catalog, the organizer's
    published config and the PRNG — all bounded, all safely JSON integers.
    """
    return {"award_id": c["award_id"], "priority": c["priority"], "award": c["award"]}


def build_stage1_file() -> dict:
    cases = []
    for c in STAGE1_CASES:
        label = label_from_source(c["src"])
        stream = Stream(decode_seed(REAL_SEED), label)
        expected = stage1_pick(
            stream, c["candidates"], c["players"], c["shelf"], c["table"], c["live_count"],
            c.get("ladder", False),
        )
        # ⭐ THE ANCHOR GUARDS ITS OWN CASES. Every row above declares, as executable code, the
        # property it was CHOSEN for — that r lands exactly on a boundary, that the re-draw's n
        # really is recomputed, that the zero-byte draw really consumes zero. Those properties
        # depend on the real seed's bytes, so a future edit to a spin number or a weight could
        # silently turn the file's most valuable row into an ordinary one with every gate still
        # green. That is the 6-4a review's headline finding (a coverage guard satisfied by a row
        # unrelated to the property it names) closed at the source rather than only in the two
        # suites.
        if not c["pins"](expected):
            raise SystemExit(
                f"case {c['name']!r} no longer exhibits the property it was chosen for: {expected!r}"
            )
        # ⭐ THE SECOND HALF OF GUARDING THE GUARDS. `pins` sees only the OUTPUT, and the 6-4b
        # code review found three rows whose discriminating property lives in the INPUT — one
        # player sweeping every candidate, an outcome kind of `no_eligible_players`,
        # `no_awardable_value` — so their fixtures could be swapped for ones that produce the
        # same numbers by a different route and every gate would stay green. `pins_inputs` gets
        # the whole case and re-derives the property through the real Stage 2.
        if "pins_inputs" in c and not c["pins_inputs"](expected, c):
            raise SystemExit(
                f"case {c['name']!r} no longer exhibits the INPUT property it was chosen for — "
                "its fixture has drifted and the row no longer tests what its name claims"
            )
        row = {
            "name": c["name"],
            "note": c["note"],
            "seed_hex": REAL_SEED,
            "label": label,
            "label_source": c["src"],
            "weight_table": c["table"],
        }
        # ⭐ A `shelf` of None means the key is OMITTED from the row entirely — the input shape
        # that proves "an absent container is the empty container" in all three runtimes. It has
        # to be an absence rather than an empty object, because an empty object is exactly what
        # it must be shown to be EQUIVALENT to.
        if c["shelf"] is not None:
            row["shelf"] = {k: c["shelf"][k] for k in sorted(c["shelf"])}
        # ⭐ THE KEY IS OMITTED WHEN NO LADDER IS INJECTED, and that is what keeps every pre-6.5 row
        # BYTE-IDENTICAL. It is also the honest encoding: an absent `ladder` key IS the no-ladder
        # contract, which is exactly the state all fourteen original cases are in.
        if c.get("ladder", False):
            row["ladder"] = True
        cases.append(
            {
                **row,
                "live_count": c["live_count"],
                "candidates": [_render_candidate(x) for x in c["candidates"]],
                # ⭐ A LADDER ROW CARRIES THE FOUR FR-29 BLOCKS; a no-ladder row does not, and that
                # asymmetry is deliberate rather than untidy. The ladder reads `secondary`,
                # `efficiency`, `h2h` and `achievement_ts`, so a row that INJECTS one has to carry
                # them or neither runtime could reproduce its weights — while emitting them on the
                # fourteen pre-6.5 rows would rewrite every one of them for data no code path
                # reads. The rule is "the row carries what its own case consumes", and it is what
                # keeps this file's diff to pure additions.
                "players": [
                    (_render_ladder_player(p) if c.get("ladder", False) else _render_player(p))
                    for p in c["players"]
                ],
                "expected": expected,
            }
        )

    refusals = []
    for r in STAGE1_REFUSALS:
        label = label_from_source(r["src"])
        stream = Stream(decode_seed(REAL_SEED), label)
        try:
            got = stage1_pick(
                stream, r["candidates"], r["players"], r["shelf"], r["table"], r["live_count"],
                r.get("ladder", False),
            )
        except Stage1TieRefusal as err:
            kind, detail = "tie", err.detail
        except Stage1Refusal as err:
            kind, detail = "invalid", err.detail
        else:
            raise SystemExit(f"refusal row {r['why']!r} did NOT refuse — it returned {got!r}")
        if kind != r["refusal_kind"]:
            raise SystemExit(
                f"refusal row {r['why']!r} refused as {kind!r}, declared {r['refusal_kind']!r}"
            )
        # ⭐ THE ROW DECLARES WHICH INPUT IT IS ABOUT, and the anchor checks that the refusal
        # really came from that guard. Without this a row could keep passing while being refused
        # by something else entirely three functions downstream — which is exactly the survivor
        # Story 6-4b's mutation pass found (see the note on Stage1Refusal).
        if detail != r["detail"]:
            raise SystemExit(
                f"refusal row {r['why']!r} refused on {detail!r}, declared {r['detail']!r}"
            )
        # ⛔ The NARROWER set: a row is a set of inputs, so it can never legitimately land on
        # `stream` or `internal`. If one does, the row is not testing what it claims.
        if detail not in ROW_REPRESENTABLE_DETAILS:
            raise SystemExit(
                f"refusal row {r['why']!r} used a detail no row can represent: {detail!r}"
            )
        # ⛔ A REFUSAL MUST NOT HAVE MOVED THE STREAM. W7's "validate before any draw" is only
        # meaningful if it is checked: a malformed table that consumed a byte and then failed
        # would leave the ceremony's stream position depending on the failure, and a retry after
        # fixing the config would produce a different ceremony. Every refusal above is reachable
        # before the first uniform_int call, and this is what keeps that true.
        if stream.pos != 0:
            raise SystemExit(
                f"refusal row {r['why']!r} consumed {stream.pos} byte(s) before refusing — "
                "validation must run BEFORE the first draw"
            )
        row = {
            "why": r["why"],
            "refusal_kind": r["refusal_kind"],
            "detail": r["detail"],
            "seed_hex": REAL_SEED,
            "label": label,
            "label_source": r["src"],
            "weight_table": r["table"],
            "shelf": {k: r["shelf"][k] for k in sorted(r["shelf"])},
            "live_count": r["live_count"],
        }
        if r.get("ladder", False):
            row["ladder"] = True
        refusals.append(
            {
                **row,
                "candidates": [_render_candidate(x) for x in r["candidates"]],
                "players": [
                    (_render_ladder_player(p) if r.get("ladder", False) else _render_player(p))
                    for p in r["players"]
                ],
            }
        )

    return {
        "vector": "stage1-pick",
        "algo_version": ALGO_VERSION,
        "spec": (
            "the weight table is validated FIRST (non-empty, strictly decreasing, every entry > "
            "0), then the shelf (every size a non-negative integer), then the pool (non-empty, "
            "no duplicate award_id, no duplicate priority, every priority >= 1, "
            "1 <= live_count <= |pool|) — all BEFORE any byte is drawn; candidates are then "
            "sorted ASCENDING by award.priority and each is weighted as "
            "luck_weight_table[min(shelf[provisional_winner], len(table) - 1)] where "
            "provisional_winner is Stage 2's raw outcome over the frozen snapshot, a TIE outcome "
            "refuses (Story 6.5) and a no_eligible_players / no_awardable_value outcome has no "
            "player and therefore weights at index 0 (the heaviest); the shelf is FROZEN at this "
            "point and is not recomputed between the picks of one spin; then live_count times: "
            "total = the sum of the REMAINING weights, r = uniform_int(stream, total), and the "
            "first remaining candidate in ascending priority whose running cumulative is STRICTLY "
            "GREATER than r is picked and removed; live is returned in DRAW order"
        ),
        "value_encoding": (
            "Every SNAPSHOT magnitude is a DECIMAL STRING (AD-19 makes them unbounded and "
            "JSON.parse silently rounds past 2^53), exactly as in stage2-resolve.json. Every "
            "weight, priority, shelf size, live_count, n, r and byte position is a JSON INTEGER: "
            "they come from the award catalog's bounded int columns (0023:74-76), from the "
            "organizer's published luck weight table, or from the PRNG, whose n is bounded by "
            "2^32. The split is by PROVENANCE, not by taste."
        ),
        "generated_by": GENERATED_BY,
        "refusal_kinds": ["tie", "invalid"],
        # ⭐ APPENDED BY STORY 6.5. When a row carries `"ladder": true`, an FR-29 ladder is INJECTED
        # and a tie is genuinely resolved instead of refusing; when the key is ABSENT — as it is on
        # every one of the fourteen pre-6.5 cases and eighteen pre-6.5 refusals — Stage 1 behaves
        # exactly as Story 6-4b shipped it. That optionality is what keeps the no-ladder refusal
        # path alive and every existing row in this file byte-identical.
        "ladder_rule": (
            "an injected FR-29 ladder resolves a `tie` provisional winner before the shelf is read, "
            "and it draws ZERO stream bytes, so no byte position in this file depends on whether "
            "one was injected. A `winner` the ladder produced indexes the table by that player's "
            "shelf, exactly as an untied winner does. A `shared` outcome has SEVERAL shelves and "
            "the published aggregation is the MINIMUM across the co-winners, clamped to "
            "len(table) - 1 AFTERWARDS — FR-26 biases toward the empty shelf, and min is the only "
            "aggregation that keeps a co-win from REDUCING the luck owed to the emptiest shelf in "
            "it. A ladder that REFUSES propagates as refusal_kind `invalid` with detail `ladder`, "
            "which is distinct from `tie` (no ladder was injected) and from `stage2` (the award or "
            "the snapshot is malformed)"
        ),
        "refusal_details": list(REFUSAL_DETAILS),
        "refusals": refusals,
        "cases": cases,
    }


# ── The FR-29 tie ladder (Story 6.5) ──────────────────────────────────────────
#
# Transcribed from FR-29 (prd.md:388-395), AD-14 (ARCHITECTURE-SPINE:148), the Provably-Fair
# contract surface (:219), SOLUTION-DESIGN §9.3 (:421-423) and epics.md:1084-1088. Those four
# sources agree on the rung ORDER and on nothing else; everything below that they do not state is
# DECISION I / DECISION H (Cuatro, 2026-08-04) and is written here because the vector is the shared
# contract:
#
#     ABSENT_TS = -1                       # 0024:704, the PUBLISHED absent sentinel
#
#     value(key, block) = block[key]       # int   if key in VOLUME_STAT_KEYS  (17)
#                       = {num, den}       # pair  if key in RATE_STAT_KEYS    (4)
#                                          # otherwise: REFUSE                       L5
#
#     beats(dir, a, b)  = cmp(a, b) > 0 for 'max';  < 0 for 'min'
#     best(S, dir, f)   = { p in S : no q in S with beats(dir, f(q), f(p)) }   # a SET
#
#     ladder(award, tied, players):
#         validate(award, tied, players)                                       # order below
#         S = tied                                        # byte-lex, |S| >= 2
#
#         if award.secondary_stat is not NULL:                                 # L2 SKIP
#             S1 = best(S, dir, p -> value(secondary_stat, p.secondary))
#             if |S1| == 1: return winner(S1[0], 1)
#             S = S1                                                           # L3 NARROW
#
#         if award.eff_num_key is not NULL and award.eff_den_key is not NULL:   # L2 SKIP
#             ratio(p) = { num: p.eff[nk].num * p.eff[dk].den,                  # L6
#                          den: p.eff[nk].den * p.eff[dk].num }
#             S2 = best(S, dir, ratio)
#             if |S2| == 1: return winner(S2[0], 2)
#             S = S2
#
#         D = { p in S : for every q in S, q != p:
#                            p.h2h has q and q.h2h has p                        # L8, BOTH ways
#                        and beats(dir, value(deciding_stat, p.h2h[q]),
#                                       value(deciding_stat, q.h2h[p])) }
#         if |D| == 1: return winner(D[0], 3)
#         if |D| >  1: REFUSE internal   # a strict dominator cannot be plural   # L7
#         # |D| == 0 -> SKIP, S unchanged (nobody was eliminated)
#
#         P = [ p in S : p.achievement_ts != ABSENT_TS ]                        # L9
#         if P is non-empty:
#             m  = min(p.achievement_ts for p in P)       # NEVER inverted       # L4
#             S4 = [ p in P : p.achievement_ts == m ]
#             if |S4| == 1: return winner(S4[0], 4)
#             S = S4
#         # every survivor absent -> SKIP with S unchanged
#
#         return shared(S in byte-lex order, exit_step = 5)   # TERMINAL, no PRNG   L10, DECISION H
#
# ⛔ THE LADDER TAKES NO STREAM AND DRAWS ZERO BYTES (L1), and the signature is the proof in all
# three implementations. DECISION H: rung 5 — the shared co-winner — IS the deterministic terminal
# rung deferred-work.md:281 asked for; it is satisfied by RECOGNISING the rung already in FR-29
# rather than by adding a seeded one. A seeded rung would make the ladder a stream CONSUMER, moving
# every byte position after it and invalidating 6-4b's measured 22-byte ceremony and everything
# 6.9's browser reproduces.
#
# ⚠ THE EXPECTATION THIS DECISION SHIPPED WITH WAS MEASURED FALSE BY THE SAME STORY (6-5b, T9a —
# this used to read "SHARED TROPHIES WILL BE COMMON"). The MECHANISM holds: 14 of 14 duel pairs
# carry a BYTE-IDENTICAL achievement_ts, so rung 4 provably cannot separate two players of one duel.
# The OUTCOME does not: 0 of the 5 real ties contains a duel pair — every tie is assembled ACROSS
# matches, whose approvals are separate transactions — so rung 4 separates all five and 0 of 12
# awards end SHARED. The shared rung is correct, necessary and UNTRIGGERED on this corpus, which is
# exactly why it is gated by rows here rather than by production traffic.
#
# ⛔ DECISION K: DECISION E's `no_awardable_value` carve-out is UPSTREAM and stays upstream. A `max`
# volume award whose best value is 0 never becomes a tie and therefore never reaches this function
# — the 27-way zero tie is READ (its width) and never resolved.


class LadderRefusal(Exception):
    """A programmer/data error BOTH runtimes must refuse loudly — never a business outcome.

    ⭐ IT NAMES WHICH INPUT IT IS ABOUT (`detail`), from a closed set declared ONCE, here, and
    carried in the vector. Story 6-4b shipped a "closed set" that was not closed — nine constants in
    Go against seven in TypeScript and seven here, with TypeScript emitting the missing two anyway —
    so the field the vector calls shared contract held one value in one runtime and another in the
    next. Declaring it in the anchor and having both runtimes pin themselves against the file is the
    fix, applied from this module's first commit rather than after a review.
    """

    def __init__(self, detail: str, message: str) -> None:
        super().__init__(f"[{detail}] {message}")
        self.detail = detail


# The closed set of things an FR-29 ladder refusal can be ABOUT, listed in the ORDER the three
# implementations check them. ⭐ THE ORDER IS CONTRACT, NOT TASTE — 6-4b's headline finding was
# three implementations disagreeing about whether `live_count` was validated before or after
# weighting, invisible because no row was malformed twice. The `two-defects-*` refusal row below is
# the only row that can redden a regression of this one.
LADDER_REFUSAL_DETAILS = (
    "stage2",    # the Stage-2 award surface refused; propagated, never swallowed
    "award",     # a rung key outside the 21-key vocabulary, or a HALF-CONFIGURED efficiency pair
    "tied",      # the tied set's own shape: width < 2, a duplicate, out of byte-lex order, unknown id
    "player",    # a snapshot row the ladder must read is malformed or missing a key it needs
    "internal",  # an invariant the implementation believes unreachable (rung 3's plural dominator)
)

# ⚠ `internal` IS DECLARED AND IS NOT ROW-REPRESENTABLE, exactly as `stage1-pick.json`'s `stream`
# and `internal` are. A row is a set of INPUTS, and "an invariant broke" is not an input — so the
# non-representability is structural, not a coverage gap, and `build_ladder_file` hard-fails any
# refusal row that lands here rather than letting one be written by accident.
#
# ⭐ THERE ARE **TWO** PRODUCERS, AND THEIR UNREACHABILITY ARGUMENTS ARE DIFFERENT. Do not collapse
# them into one sentence — a later reader who "simplifies" this against the wrong reason removes a
# guard that is load-bearing for the other:
#
#   1. RUNG 3'S PLURAL DOMINATOR (|D| > 1) is unreachable by ANTISYMMETRY: `cmp(a,b) == -cmp(b,a)`,
#      so `p` beating `q` means `q` does not beat `p`, so two players can never both beat everyone.
#      It must be a loud typed refusal (Cuatro's call on Question 4) rather than a fall-through:
#      falling through converts a comparator bug into a silently SHARED trophy, indistinguishable
#      from a legitimate rung-5 bottom-out.
#   2. `_best_survivors`' EMPTY BEST SET is unreachable by ACYCLICITY — a strictly weaker property
#      than transitivity, which the comparator genuinely does NOT have (`0/0` compares equal to
#      everything, so `0/0 ~ 10/5` and `0/0 ~ 6/5` while `10/5 > 6/5`). Every non-empty set has an
#      unbeaten member while the strict part is acyclic. Added at the Groups-2/3 code review to
#      match both runtimes; without it an empty set reaches rung 5 as a trophy awarded to nobody.
#
# ⚠ ACYCLICITY IS WHAT THE NEGATIVE-MAGNITUDE REFUSALS IN `_stat_value` / `_efficiency_pair`
# PROTECT. A negative half inverts one pair's comparison without inverting the others, which is
# exactly how a 3-cycle forms. The two guards are one mechanism described at two sites.
ROW_REPRESENTABLE_LADDER_DETAILS = LADDER_REFUSAL_DETAILS[:4]


def _class_of(key: str):
    """A stat key's CLASS, derived from the 17/4 vocabulary split — never from `award.class`.

    ⭐ L5, AND IT IS THE HIGHEST-VALUE LINE IN RUNG 1. `secondary` is `volume || rate` (0024:723),
    so `secondary[k]` is an INT for a volume key and a `{num,den}` PAIR for a rate key —
    INDEPENDENTLY of what class the DECIDING stat is. An award of class `volume` may perfectly well
    name `hs_pct` as its secondary, and an implementation that branched on `award.class` would read
    a rate pair as an integer for every award whose secondary crosses classes.
    """
    if key in VOLUME_STAT_KEYS:
        return "volume"
    if key in RATE_STAT_KEYS:
        return "rate"
    return None


def _rung_key(value):
    """The ONE normalisation of a nullable rung key: absent is `None`, `null` AND `''`.

    ⭐ THE EMPTY STRING IS IN THE LIST BECAUSE THE PRODUCER FORCES IT. Go has no nullable string, so
    `Award.SecondaryStat` is a plain `string` whose zero value `""` is what `encoding/json` leaves
    behind for BOTH a JSON `null` and an OMITTED key. Go therefore cannot distinguish "absent" from
    "present and empty" — so if the other two runtimes treated `''` as a present-but-invalid key,
    the seam would disagree on an input neither would report. Same resolution as 6-4b's absent
    container, and the vector carries all three spellings as CASES with byte-identical expected
    blocks rather than as a remark.
    """
    if value is None or value == "":
        return None
    return value


def _beats_stat(direction: str, a, b) -> bool:
    """`beats` over two CLASS-SHAPED values, taking the direction alone.

    ⚠ IT TAKES A DIRECTION, NOT AN AWARD, and that is deliberate: rung 4 must NEVER be inverted
    (L4 — "earliest" is a recency rule, not a stat, and inverting it would mean "the latest
    achievement wins" for one award in twelve), and rung 2 compares a COMPUTED ratio belonging to no
    award's class. Passing the whole award would invite both mistakes.

    ⚠ S3's ZERO-DENOMINATOR SEMANTICS ARE INHERITED VERBATIM from `_cmp_stat`: cross-multiplication
    stays total, `0/0` compares EQUAL to everything, and `n/0` with `n > 0` beats every finite value.
    Story 6-4a's review made both halves vector rows; this rung must agree with them rather than
    "fix" them, so the ladder gets its own rows for both instead of a special case.
    """
    ka, va = a
    kb, vb = b
    if ka != kb:
        # Unreachable: every value inside one rung is read through ONE key, so they share a class.
        raise LadderRefusal("internal", "cannot compare a volume value with a rate value")
    c = _cmp_stat(ka, va, vb)
    return c > 0 if direction == "max" else c < 0


def _best_survivors(survivors: list, direction: str, valuef) -> list:
    """`best` as a SET over the survivors, preserving their byte-lex order.

    ⭐ A SET, NEVER A CHAMPION — the same S7 rule Stage 2 obeys, for the same reason: a running
    champion replaced on `>` silently keeps the first of an equal pair and IS the argmax AD-14
    forbids, and on `>=` it silently keeps the last.
    """
    values = {sid: valuef(sid) for sid in survivors}
    best = [
        p for p in survivors
        if not any(_beats_stat(direction, values[q], values[p]) for q in survivors)
    ]
    # ⛔ AN EMPTY BEST SET IS A REFUSAL, NEVER A SILENT NARROWING — the same guard `_resolve_stage2`
    # carries, for the same reason and with the same caveat: it holds because of ACYCLICITY, not
    # transitivity (`0/0` is equal to everything, so the relation is NOT transitive and that is
    # fine). Every non-empty set has an unbeaten member while the strict part is acyclic.
    # ⭐ Without it the emptiness propagates to rung 5 and `resolve_ladder` emits
    # `{"kind": "shared", "winners": []}` — a trophy awarded to NOBODY, published as an expected
    # value in the file both runtimes conform to.
    # (Added at the Groups-2/3 code review, 2026-08-04, for the same reason as `_stat_value`'s sign
    # check: both runtimes gained it at the Group-1 review and this anchor did not.)
    # ⚠ IT REFUSES AS `internal`, WHICH IS NOT ROW-REPRESENTABLE — see the note on
    # ROW_REPRESENTABLE_LADDER_DETAILS. That is correct and deliberate, not an oversight: "the
    # comparator is broken" is not an INPUT, so no row can carry it. It is reachable only from a
    # broken comparator, exactly like rung 3's plural dominator.
    if not best:
        raise LadderRefusal(
            "internal",
            f"empty best set over {len(survivors)} survivors — the comparator's strict part is "
            "not acyclic"
        )
    return best


def _stat_value(key: str, block: dict, where: str):
    """One CLASS-SHAPED value out of a `secondary` or `h2h[opp]` block.

    An ABSENT key is a REFUSAL, never a zero — the same doctrine 0024:918-923 states for an absent
    h2h OPPONENT, applied one level in. ⚠ The two absences mean different things and must stay
    distinguishable: an absent OPPONENT is "they never met" (a skip); an absent STAT KEY inside a
    present opponent block is a CORRUPT ROW, because the DATABASE writes all 21 keys into every
    block it writes at all (0024:667-683's `parts` CTE materialises the whole vocabulary).

    ⚠ THE FIXTURES IN THIS FILE DO NOT, AND THAT IS DELIBERATE RATHER THAN A CONTRADICTION (Story
    6-5b, T9e — the sentence above used to cite the fixtures as though they demonstrated the rule).
    Every `h2h` block written below carries exactly ONE key: the case says what it needs and nothing
    else is invented, precisely so that "the key this award reads is missing" stays an expressible
    INPUT. A fixture that mirrored the database would make this refusal unreachable from any row,
    which is the state the row for it exists to prevent.
    """
    klass = _class_of(key)
    if klass is None:
        raise LadderRefusal("award", f"{where}: {key!r} is not one of the 21 vocabulary keys")
    if key not in block:
        raise LadderRefusal(
            "player",
            f"{where}: key {key!r} is absent — an absent key is a refusal, never a zero"
        )
    # ⛔ NEGATIVE MAGNITUDES ARE REFUSED, exactly as `_deciding_value` refuses them on the Stage-2
    # side and for the identical reason stated there: cross-multiplication `a.num*b.den >
    # b.num*a.den` is the right test only while both denominators are non-negative, and one negative
    # SILENTLY INVERTS the comparison — the ladder then returns a plausible, wrong survivor with
    # nothing red anywhere. ⚠ S3's ZERO semantics are inherited verbatim (`_beats_stat`); only a
    # NEGATIVE is refused. Every one of these is a `coalesce`d count in 0024, so it is unreachable
    # from a real snapshot — which is precisely why Stage 2 keeps its own copy loud rather than
    # trusting the producer, and why the ladder, reading THREE blocks Stage 2 never touches, needs
    # its own. (Added at the Groups-2/3 code review, 2026-08-04: both runtimes had gained this guard
    # at the Group-1 review and THIS FILE HAD NOT, so the anchor RESOLVED inputs both of them
    # REFUSED — a three-way divergence in the one implementation that arbitrates disagreements.)
    v = block[key]
    if klass == "volume":
        if isinstance(v, tuple):
            raise LadderRefusal(
                "player", f"{where}: volume key {key!r} carries a rate pair {v!r}"
            )
        if v < 0:
            raise LadderRefusal(
                "player", f"{where}: volume key {key!r} is negative — every volume stat is a count"
            )
        return ("volume", v)
    if not isinstance(v, tuple):
        raise LadderRefusal("player", f"{where}: rate key {key!r} carries a bare integer {v!r}")
    if v[0] < 0 or v[1] < 0:
        raise LadderRefusal(
            "player", f"{where}: rate key {key!r} has a negative half — both halves are counts"
        )
    return ("rate", v)


def _validate_ladder(award: dict, tied, players: list) -> dict:
    """Validate in the PUBLISHED order and return the steamid64 -> player index.

    ⭐ THE ORDER IS PUBLISHED IN THE VECTOR'S `spec` STRING AND PINNED BY ROWS MALFORMED TWICE.
    Story 6-4b's headline was three implementations disagreeing on validation order with no row
    malformed twice to expose it, so the gate was structurally blind. There are SIX groups, not
    four, and the `detail` labels ALTERNATE — which is the correction Story 6-5b makes after the
    Groups-2/3 review measured the published four-group order to be contradicted by all three
    implementations (Cuatro's call: AMEND THE PUBLISHED SPEC, DO NOT MOVE THE CODE):

        1. `stage2`  — the award's Stage-2 surface, re-run because `resolve_ladder` is a PUBLIC
                       entry point Story 6.6 drives directly over a REDUCED set, without a
                       preceding Stage-2 call to have checked it.
        2. `award`   — the ladder's own award surface: `deciding_stat` and each non-absent rung key
                       must be in the 21-key vocabulary (rung 3 needs the deciding key's CLASS), and
                       the efficiency pair is BOTH-OR-NEITHER.
        3. `tied`    — the tied set's OWN SHAPE ONLY: width >= 2, every id a decimal string, no
                       duplicate, strictly ascending byte-lex. Nothing here reads `players`.
        4. `player`  — BUILDING THE INDEX over `players`: no duplicate steamid64, one row per player.
        5. `tied`    — MEMBERSHIP: every tied member has a matching row in the index just built.
        6. `player`  — `achievement_ts` for every TIED player.

    ⭐⭐ GROUPS 4 AND 5 ARE THE CORRECTION, AND THEY ARE WHY THIS IS SIX GROUPS RATHER THAN FOUR.
    The duplicate-`players` scan is part of BUILDING the index, so it necessarily runs before the
    membership check that reads the index — and it refuses as `player`. An input carrying BOTH a
    duplicate `players` row AND a tied member with no row therefore refuses `player`, not `tied`,
    in all three implementations. The old four-group text said the opposite. The code is right and
    the document was wrong; both are now the same document.

    ⚠ WHY `achievement_ts` IS VALIDATED UP FRONT RATHER THAN AT RUNG 4. It is NEVER NULL in the
    snapshot (0024:706), so a value below the sentinel is a CORRUPT SNAPSHOT rather than a
    rung-specific concern — and a ladder that only noticed corruption when it happened to descend
    that far would report the same snapshot as fine or broken depending on how the tie broke. The
    per-key BLOCK lookups stay lazy, at the rung that reads them, mirroring Stage 2's own split
    between eligibility inputs (checked for everyone) and deciding magnitudes (checked where read).
    """
    try:
        _validate_award(award)
    except Stage2Refusal as err:
        # PROPAGATED, never swallowed, and re-labelled so both runtimes report WHERE it came from.
        raise LadderRefusal("stage2", str(err)) from err

    if _class_of(award["deciding_stat"]) is None:
        raise LadderRefusal(
            "award",
            f"deciding_stat {award['deciding_stat']!r} is not one of the 21 vocabulary keys — rung "
            "3 reads h2h[opp][deciding_stat] through the KEY's class, so membership is what makes "
            "the read decidable at all"
        )
    for field in ("secondary_stat", "eff_num_key", "eff_den_key"):
        key = _rung_key(award.get(field))
        if key is not None and _class_of(key) is None:
            raise LadderRefusal(
                "award", f"{field} {key!r} is not one of the 21 vocabulary keys (0023:98-115)"
            )
    num_key = _rung_key(award.get("eff_num_key"))
    den_key = _rung_key(award.get("eff_den_key"))
    if (num_key is None) != (den_key is None):
        # L2 — BOTH OR NEITHER. One without the other is a HALF-CONFIGURED rung, which is a
        # refusal rather than a skip: a skip means "this award declines rung 2", and half a ratio
        # means somebody edited the catalog and stopped.
        raise LadderRefusal(
            "award",
            "eff_num_key and eff_den_key are both-or-neither — one without the other is a "
            "half-configured rung, not a skip"
        )

    if not isinstance(tied, list) or len(tied) < 2:
        # L11 — Stage 2 only produces a tie at width >= 2, so anything narrower means the CALLER is
        # broken. A ladder that "resolved" a width-1 set would crown a player nobody tied with.
        raise LadderRefusal(
            "tied",
            f"a tied set has width >= 2, got {len(tied) if isinstance(tied, list) else tied!r} — "
            "Stage 2 never produces a narrower one, so this is a broken caller"
        )
    seen: set = set()
    previous = None
    for sid in tied:
        if not isinstance(sid, str) or not STEAMID64_RE.fullmatch(sid):
            raise LadderRefusal("tied", f"steamid64 must be a decimal string, got {sid!r}")
        if sid in seen:
            raise LadderRefusal("tied", f"duplicate steamid64 {sid!r} in the tied set")
        seen.add(sid)
        if previous is not None and sid.encode("utf-8") <= previous.encode("utf-8"):
            # The tied set arrives in the byte-lex order Stage 2 produced it in (0024:732's
            # `collate "C"`), and rung 5 must return that order. Sorting it here would HIDE a
            # caller that had reordered it, and the shared set's order is published output.
            raise LadderRefusal(
                "tied",
                f"the tied set must be in strictly ascending byte-lex order, got {previous!r} then "
                f"{sid!r}"
            )
        previous = sid

    by_id: dict = {}
    for p in players or []:
        sid = p["steamid64"]
        if sid in by_id:
            raise LadderRefusal("player", f"duplicate steamid64 {sid!r} — one row per player")
        by_id[sid] = p
    for sid in tied:
        if sid not in by_id:
            raise LadderRefusal(
                "tied", f"tied member {sid!r} has no matching snapshot row"
            )

    for sid in tied:
        ts = by_id[sid].get("achievement_ts")
        if isinstance(ts, bool) or not isinstance(ts, int):
            raise LadderRefusal(
                "player",
                f"{sid}: achievement_ts is absent or not an integer — 0024:706 makes it NEVER NULL, "
                f"with {ABSENT_TS} as the published absent sentinel"
            )
        if ts < ABSENT_TS:
            raise LadderRefusal(
                "player",
                f"{sid}: achievement_ts {ts} is below the published absent sentinel {ABSENT_TS}"
            )
    return by_id


def resolve_ladder(award: dict, tied: list, players: list) -> dict:
    """The FR-29 ladder. Pure, integer-only, and it draws NOTHING (L1)."""
    by_id = _validate_ladder(award, tied, players)
    direction = award["direction"]
    survivors = list(tied)

    # ── RUNG 1 — the secondary stat ───────────────────────────────────────────────────────────
    secondary_key = _rung_key(award.get("secondary_stat"))
    if secondary_key is not None:  # L2 — a NULL key is a deterministic SKIP, never a refusal
        narrowed = _best_survivors(
            survivors,
            direction,
            lambda sid: _stat_value(
                secondary_key,
                by_id[sid]["stats_int"].get("secondary") or {},
                f"{sid}.secondary",
            ),
        )
        if len(narrowed) == 1:
            return _ladder_winner(narrowed[0], 1)
        survivors = narrowed  # L3 — NARROW; the next rung runs over these, never over `tied`

    # ── RUNG 2 — the efficiency ratio, a RATIO OF TWO RATIOS ──────────────────────────────────
    num_key = _rung_key(award.get("eff_num_key"))
    den_key = _rung_key(award.get("eff_den_key"))
    if num_key is not None and den_key is not None:  # L2 — both NULL is a SKIP (both-or-neither)
        def ratio(sid: str):
            # L6 — `efficiency[k]` is ALWAYS {num, den} (`snapshot_efficiency_form`: a volume `v`
            # becomes {v, 1}), so the ratio of two of them is FOUR MULTIPLICATIONS of unbounded
            # snapshot magnitudes per side. Python's int is unbounded by construction, which is
            # exactly the property Go takes from math/big and TypeScript from BigInt; int64 or a
            # double yields a PLAUSIBLE winner.
            block = by_id[sid]["stats_int"].get("efficiency") or {}
            n = _efficiency_pair(block, num_key, f"{sid}.efficiency")
            d = _efficiency_pair(block, den_key, f"{sid}.efficiency")
            return ("rate", (n[0] * d[1], n[1] * d[0]))

        narrowed = _best_survivors(survivors, direction, ratio)
        if len(narrowed) == 1:
            return _ladder_winner(narrowed[0], 2)
        survivors = narrowed

    # ── RUNG 3 — the head-to-head STRICT dominator over the REMAINING set ──────────────────────
    dominators = []
    for p in survivors:
        p_h2h = by_id[p].get("h2h") or {}
        dominates = True
        for q in survivors:
            if q == p:
                continue
            q_h2h = by_id[q].get("h2h") or {}
            # L8 — BOTH DIRECTIONS MUST EXIST. `h2h[p][q]` holds P's stats over the matches p and q
            # shared, so a comparison needs both halves; one present and one absent is still "not
            # comparable". An ABSENT opponent key is the NEVER-MET signal and DISQUALIFIES p as a
            # dominator — it is never a zero, "because a zero would silently become a real
            # comparison" (0024:920-923, verbatim).
            if q not in p_h2h or p not in q_h2h:
                dominates = False
                break
            mine = _stat_value(award["deciding_stat"], p_h2h[q], f"{p}.h2h[{q}]")
            theirs = _stat_value(award["deciding_stat"], q_h2h[p], f"{q}.h2h[{p}]")
            # L7 — STRICT. `p` must BEAT `q`, not merely not-lose to them.
            if not _beats_stat(direction, mine, theirs):
                dominates = False
                break
        if dominates:
            dominators.append(p)
    if len(dominators) == 1:
        return _ladder_winner(dominators[0], 3)
    if len(dominators) > 1:
        raise LadderRefusal(
            "internal",
            f"rung 3 computed {len(dominators)} strict dominators, which is impossible over an "
            "antisymmetric comparator — the comparator is broken"
        )
    # |D| == 0 -> SKIP. `survivors` is UNCHANGED: nobody was eliminated, because failing to
    # dominate is not losing.

    # ── RUNG 4 — the earliest achievement_ts; the SENTINEL NEVER WINS ──────────────────────────
    # L9 — filter the absents BEFORE minimising. `-1` is numerically the SMALLEST value in the
    # column, so a naive `min` crowns the player with NO APPROVED ROWS AT ALL — the worst possible
    # outcome for a rung whose whole meaning is "did it first".
    present = [sid for sid in survivors if by_id[sid]["achievement_ts"] != ABSENT_TS]
    if present:
        # L4 — ALWAYS the earliest, NEVER inverted by `direction`. Rung 4 is a recency rule, not a
        # stat: inverting it would mean "the latest achievement wins" for the catalog's one `min`
        # award.
        earliest = min(by_id[sid]["achievement_ts"] for sid in present)
        narrowed = [sid for sid in present if by_id[sid]["achievement_ts"] == earliest]
        if len(narrowed) == 1:
            return _ladder_winner(narrowed[0], 4)
        survivors = narrowed
    # every survivor absent -> SKIP with `survivors` unchanged

    # ── RUNG 5 — the shared co-winner. TERMINAL. NO PRNG. (L10 / DECISION H) ───────────────────
    # The FULL surviving set, in the byte-lex order it has carried since `tied`. EXPERIENCE.md:123
    # calls this "a designed outcome, never an error state".
    return {"kind": "shared", "winners": list(survivors), "ladder_exit_step": 5}


def _efficiency_pair(block: dict, key: str, where: str):
    """One `{num, den}` out of the efficiency block. Uniform — there is no class branch here."""
    if _class_of(key) is None:
        raise LadderRefusal("award", f"{where}: {key!r} is not one of the 21 vocabulary keys")
    if key not in block:
        raise LadderRefusal(
            "player", f"{where}: key {key!r} is absent — an absent key is a refusal, never a zero"
        )
    pair = block[key]
    if not isinstance(pair, tuple):
        raise LadderRefusal(
            "player",
            f"{where}: efficiency[{key!r}] must be a {{num, den}} pair — `snapshot_efficiency_form` "
            "gives EVERY key that shape, a volume `v` as {v, 1}"
        )
    # ⛔ NEGATIVE HALVES ARE REFUSED — see the note in `_stat_value`. It matters MORE here: rung 2
    # multiplies FOUR of these halves together, so a single negative flips the sense of the whole
    # four-term product and makes the "beats" relation CYCLIC rather than merely wrong — which is
    # what lets `_best_survivors` return the empty set below.
    if pair[0] < 0 or pair[1] < 0:
        raise LadderRefusal(
            "player", f"{where}: efficiency[{key!r}] has a negative half — both halves are counts"
        )
    return pair


def _ladder_winner(sid: str, step: int) -> dict:
    """A ladder-resolved single winner.

    ⚠ NO `deciding_value`, DELIBERATELY. The tie this ladder resolves carries none (Stage 2's tie
    arm has no value), and L12 forbids re-deriving one: the ladder reads the tied set as given and
    never re-reads the deciding magnitudes. Story 6.8, which persists `award_result`, has the
    snapshot and can render it there.
    """
    return {"kind": "winner", "steamid64": sid, "ladder_exit_step": step}


# ── the ladder case manifest — INPUTS only; every expected value is computed ───


def _ladder_award(deciding_stat, klass, direction, *, secondary=None, eff_num=None, eff_den=None,
                  floor_rounds=0, floor_kills=0) -> dict:
    """One award as the ladder reads it: the Stage-2 five plus the three FR-29 rung keys.

    The three rung keys are written EXPLICITLY, as JSON `null` when absent, because absence is the
    normal state (all twelve shipped awards) and a reader must be able to see that it was decided
    rather than forgotten. The `rung-keys-omitted-entirely` case is the one row that leaves them out.
    """
    award = _award(deciding_stat, klass, direction, floor_rounds, floor_kills)
    award["secondary_stat"] = secondary
    award["eff_num_key"] = eff_num
    award["eff_den_key"] = eff_den
    return award


def _naive_single_pair_pick(case: dict):
    """The NAIVE rung-2: compare `efficiency[eff_num_key]` alone and ignore the denominator key.

    Used only by a `pins_inputs` guard, and it exists because an efficiency case both methods agree
    on proves NOTHING — exactly as Story 6-4a's `(2^53+1)` search proved for the float compare. If
    this ever stops disagreeing with the real rung 2, the row has silently become ordinary.
    """
    by_id = {p["steamid64"]: p for p in case["players"]}
    key = case["award"]["eff_num_key"]
    best = _best_survivors(
        case["tied"],
        case["award"]["direction"],
        lambda sid: ("rate", by_id[sid]["stats_int"]["efficiency"][key]),
    )
    return best


def _by_id(case: dict) -> dict:
    """The case's own steamid64 -> player index. Added by Story 6-5b so every guard below reads THE
    ROW'S OWN DATA rather than a hardcoded id, a hardcoded key or a module global."""
    return {p["steamid64"]: p for p in case["players"]}


def _rung2_ratio(case: dict, sid: str):
    """The FOUR-TERM rung-2 ratio for one player, derived from the CASE's own award keys.

    ⭐ IT TAKES THE KEYS FROM `case["award"]`, NEVER FROM A LITERAL. The Groups-2/3 review's T4
    finding was that guards read module globals and hardcoded names, so a fixture could drift to
    different keys while the guard kept checking the old ones and stayed green.
    """
    eff = _by_id(case)[sid]["stats_int"]["efficiency"]
    num_key = _rung_key(case["award"].get("eff_num_key"))
    den_key = _rung_key(case["award"].get("eff_den_key"))
    n = eff[num_key]
    d = eff[den_key]
    return (n[0] * d[1], n[1] * d[0])


def _rung2_best(case: dict, direction: str | None = None) -> list:
    """`best` at rung 2 over the case's FULL tied set, under the row's own direction unless one is
    named — the counterfactual a `direction`-hardcoding mutation would produce."""
    return _best_survivors(
        case["tied"],
        case["award"]["direction"] if direction is None else direction,
        lambda sid: ("rate", _rung2_ratio(case, sid)),
    )


def _rung1_best(case: dict) -> list:
    """`best` at rung 1 over the case's FULL tied set, on the row's own `secondary_stat`."""
    key = _rung_key(case["award"].get("secondary_stat"))
    return _best_survivors(
        case["tied"],
        case["award"]["direction"],
        lambda sid: _stat_value(key, _by_id(case)[sid]["stats_int"]["secondary"], "guard"),
    )


def _dominators_over(case: dict, survivors: list) -> list:
    """Rung 3's strict dominators over an ARBITRARY survivor set — so a guard can state what rung 3
    would have said over the ORIGINAL tie as well as over the narrowed one."""
    by_id = _by_id(case)
    out = []
    for p in survivors:
        p_h2h = by_id[p].get("h2h") or {}
        dominates = True
        for q in survivors:
            if q == p:
                continue
            q_h2h = by_id[q].get("h2h") or {}
            if q not in p_h2h or p not in q_h2h:
                dominates = False
                break
            if not _beats_stat(
                case["award"]["direction"],
                _stat_value(case["award"]["deciding_stat"], p_h2h[q], "guard"),
                _stat_value(case["award"]["deciding_stat"], q_h2h[p], "guard"),
            ):
                dominates = False
                break
        if dominates:
            out.append(p)
    return out


def _earliest_holder(case: dict, among: list | None = None) -> str:
    """Who holds the strictly earliest `achievement_ts` — the NAIVE rung 4, sentinel included, which
    is the counterfactual half of every rung-4 guard."""
    by_id = _by_id(case)
    pool = case["tied"] if among is None else among
    return min(pool, key=lambda sid: by_id[sid]["achievement_ts"])


def _no_player_beats_all(case: dict) -> bool:
    """Re-derive rung 3's `|D| == 0` from the row's OWN data.

    ⭐ GUARD THE GUARD. Story 6-4a's and 6-4b's shared headline was a coverage flag satisfied by a
    row unrelated to the property it names. "The outcome exited at rung 4" is equally true of a row
    where rung 3 was never configured to discriminate, so the INPUT property is re-derived here.
    """
    by_id = {p["steamid64"]: p for p in case["players"]}
    tied = case["tied"]
    for p in tied:
        p_h2h = by_id[p].get("h2h") or {}
        beats_all = True
        for q in tied:
            if q == p:
                continue
            q_h2h = by_id[q].get("h2h") or {}
            if q not in p_h2h or p not in q_h2h:
                beats_all = False
                break
            if not _beats_stat(
                case["award"]["direction"],
                _stat_value(case["award"]["deciding_stat"], p_h2h[q], "guard"),
                _stat_value(case["award"]["deciding_stat"], q_h2h[p], "guard"),
            ):
                beats_all = False
                break
        if beats_all:
            return False
    return True


def _has_one_sided_h2h(case: dict) -> bool:
    """Re-derive that some pair records exactly ONE direction — the L8 shape."""
    by_id = {p["steamid64"]: p for p in case["players"]}
    tied = case["tied"]
    for p in tied:
        for q in tied:
            if p == q:
                continue
            has_p = q in (by_id[p].get("h2h") or {})
            has_q = p in (by_id[q].get("h2h") or {})
            if has_p != has_q:
                return True
    return False


TS_DUEL = 1754300000000  # a plausible epoch-ms approve_match stamp; shared BYTE-IDENTICALLY below

LADDER_CASES: list[dict] = [
    {
        "name": "rung-1-a-VOLUME-secondary-breaks-the-tie",
        "note": (
            "The ordinary rung-1 shape. Both players hold 20 kills — a real `equal_value` tie — and "
            "the award names `hs_kills` as its secondary. A holds 9 to B's 4 and wins at EXIT STEP "
            "1. ⭐ `ladder_exit_step` is as load-bearing as the winner: a ladder that reached A by "
            "the wrong rung would pass a winner-only assertion, and Story 6.8 persists the step as "
            "`award_result.tie_ladder_exit_step`, so a wrong rung ships a false explanation to the "
            "audience."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=5000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=1000),
        ],
        # B holds the EARLIER timestamp, so a ladder that skipped rung 1 lands on the other player.
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THE ORDINARY SHAPE AND ITS COUNTERFACTUAL (Story 6-5b — this row carried no
        # input guard at all): the secondary is a VOLUME key (this is the volume arm; the row below
        # it is the rate arm), rung 1 resolves outright, and the LOSER holds the strictly earliest
        # timestamp — so a ladder that skipped rung 1 provably lands on the other player.
        "pins_inputs": lambda e, c: (
            _class_of(_rung_key(c["award"]["secondary_stat"])) == "volume"
            and _rung1_best(c) == [e["steamid64"]]
            and _earliest_holder(c) != e["steamid64"]
        ),
    },
    {
        "name": "rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS",
        "note": (
            "⭐ L5 — RUNG 1 BRANCHES ON THE KEY'S CLASS, NEVER ON `award.class`. This award's class "
            "is `volume` (deciding stat `utility_damage`, both players at 313) while its secondary "
            "is the RATE key `hs_pct`, so `secondary['hs_pct']` is a {num, den} PAIR inside a "
            "volume award. An implementation that branched on `award.class` reads that pair as a "
            "bare integer and either crashes or compares nonsense. A is 6/20 and B is 7/25: "
            "6*25 = 150 beats 7*20 = 140, so A wins even though B has the larger NUMERATOR and the "
            "larger raw hs_kills — a naive numerator compare picks B."
        ),
        "award": _ladder_award("utility_damage", "volume", "max", secondary="hs_pct"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 313, "hs_kills": 6}, ts=5000),
            _p(S_B, rounds=30, kills=25, vol={"utility_damage": 313, "hs_kills": 7}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THE CROSS-CLASS PROPERTY FROM THE ROW'S OWN DATA: the award is `volume` and
        # the secondary key is `rate`. Without this the fixture could drift to a same-class
        # secondary and the row would silently stop testing L5 while still producing winner/1.
        "pins_inputs": lambda e, c: (
            c["award"]["class"] == "volume"
            and _class_of(c["award"]["secondary_stat"]) == "rate"
        ),
    },
    {
        "name": "rung-1-direction-min-inverts-the-secondary",
        "note": (
            "L4's first half — `direction` inverts rungs 1, 2 and 3. A `min` award (fewest deaths, "
            "the shape `El Inofensivo` gives the catalog) tied at 10 deaths each, broken on "
            "`opening_deaths`: A's 4 is FEWER than B's 7, so A wins at rung 1. An implementation "
            "that ignored `direction` here crowns B."
        ),
        "award": _ladder_award("deaths", "volume", "min", secondary="opening_deaths"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 10, "opening_deaths": 4}, ts=5000),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 10, "opening_deaths": 7}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THE DIRECTION AND ITS COUNTERFACTUAL (Story 6-5b): the award really is `min`,
        # and the SAME rung under `max` crowns the other player — without which "somebody won at
        # rung 1" is all this row says, which is true of four rows.
        "pins_inputs": lambda e, c: (
            c["award"]["direction"] == "min"
            and _best_survivors(
                c["tied"], "max",
                lambda sid: _stat_value(
                    _rung_key(c["award"]["secondary_stat"]),
                    _by_id(c)[sid]["stats_int"]["secondary"], "guard",
                ),
            ) == [sid for sid in c["tied"] if sid != e["steamid64"]]
        ),
    },
    {
        "name": "rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim",
        "note": (
            "⭐ S3 CARRIED INTO RUNG 1, VERBATIM RATHER THAN PATCHED AROUND. A has zero kills, so "
            "their `hs_pct` is 0/0 — a REAL, reachable snapshot shape (0024:909-916: a rostered "
            "player with no approved rows is `idle_dq = false` with zero stats). 0/0 "
            "cross-multiplies to 0 against EVERY pair, so A is equal to B (5/20) and to C (3/20) "
            "even though B beats C outright. Rung 1 therefore narrows to {A, B} and RESOLVES "
            "NOTHING — the ladder falls through to rung 4, where A's earlier timestamp wins. An "
            "implementation that filtered zero denominators out of the race — the silent argmax S3 "
            "forbids — would exit at rung 1 with B instead."
        ),
        "award": _ladder_award("utility_damage", "volume", "max", secondary="hs_pct"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=0, vol={"utility_damage": 313, "hs_kills": 0}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"utility_damage": 313, "hs_kills": 5}, ts=4000),
            _p(S_C, rounds=30, kills=20, vol={"utility_damage": 313, "hs_kills": 3}, ts=9000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # Re-derive BOTH input properties: somebody genuinely carries a 0 denominator, and the
        # eliminated player is a real loser rather than an accident of ordering.
        # ⭐ EVERY NAME COMES FROM THE ROW (Story 6-5b). It used to hardcode `"hs_pct"`, the literal
        # direction `"max"` and the literal survivor list `[S_A, S_B]` — three module-level facts a
        # fixture edit can move out from under a guard that keeps checking the old ones.
        "pins_inputs": lambda e, c: (
            any(
                isinstance(
                    _by_id(c)[sid]["stats_int"]["secondary"][
                        _rung_key(c["award"]["secondary_stat"])
                    ], tuple
                )
                and _by_id(c)[sid]["stats_int"]["secondary"][
                    _rung_key(c["award"]["secondary_stat"])
                ][1] == 0
                for sid in c["tied"]
            )
            and 1 < len(_rung1_best(c)) < len(c["tied"])
            and e["steamid64"] in _rung1_best(c)
        ),
    },
    {
        "name": "rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS",
        "note": (
            "⭐ THE ROW RUNG 2 EXISTS FOR, and the search for it is recorded because the search is "
            "the finding: an efficiency case both methods agree on proves nothing (exactly as 6-4a "
            "recorded for its `(2^53+1)` float search). Rung 2 is a RATIO OF TWO RATIOS — "
            "`eff[num_key] / eff[den_key]` — not a comparison of `eff[num_key]` alone. Here "
            "`eff_num_key = utility_damage` and `eff_den_key = rounds_played`: A is 300 over 30 "
            "rounds (10.0) and B is 400 over 50 (8.0). The NAIVE single-pair compare looks only at "
            "`utility_damage` and picks B (400 > 300); the real rung picks A. Both are volume keys, "
            "so `snapshot_efficiency_form` delivers them as {300, 1} and {30, 1} — which is exactly "
            "why the rung needs no class branch."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 300}, ts=9000),
            _p(S_B, rounds=50, kills=20, vol={"utility_damage": 400}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE THE DIVERGENCE. If a future edit made the naive compare agree, this row would
        # still produce winner/2 and would silently stop being the row it is named for.
        # ⚠ THE COMPARISON IS AGAINST THE ROW'S OWN OUTCOME, NEVER AGAINST A MODULE GLOBAL. It read
        # `== [S_B]` until the Story 6-5b code review: the property is "the naive compare picks
        # somebody ELSE", so a fixture whose tied set moved off `S_B` kept a green guard describing
        # an id the row no longer contained. This was the last surviving instance of T4's
        # hardcoded-literal defect class in the ladder block.
        "pins_inputs": lambda e, c: (
            _naive_single_pair_pick(c) != [e["steamid64"]]
            and len(_naive_single_pair_pick(c)) == 1
            and _naive_single_pair_pick(c)[0] in c["tied"]
        ),
    },
    {
        "name": "rung-2-four-term-products-past-2-pow-53",
        "note": (
            "⭐ L6's ARITHMETIC WIDTH. Rung 2 multiplies FOUR unbounded snapshot magnitudes per "
            "side, so `int64` wraps and a double rounds. A's ratio is (2^53+1)/(2^53+2) and B's is "
            "2^53/(2^53+1); cross-multiplying gives (2^53+1)^2 against (2^53+1)^2 - 1, a difference "
            "of ONE in ~2^106, so A wins EXACTLY. As doubles both numerators round to 2^53, giving "
            "fl(A) < 1 and fl(B) = 1.0 — a float compare picks B, the other player. In JavaScript "
            "the corruption happens at JSON.parse, before any arithmetic runs, which is why every "
            "magnitude in this file is a decimal STRING. This is why `math/big`'s package ban gains "
            "`ladder.go` where Story 6-4b was deliberately told NOT to widen it for `stage1.go`: "
            "the difference is the arithmetic, not the convenience."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=TWO53 + 2, kills=20, vol={"utility_damage": TWO53 + 1}, ts=9000),
            _p(S_B, rounds=TWO53 + 1, kills=20, vol={"utility_damage": TWO53}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐⭐ THE FLAGSHIP GUARD, AND IT WAS THE WEAKEST ONE IN THE FILE. It re-derived only that the
        # operands exceed 2^53 — true of any pair of large numbers, and satisfiable by a row where
        # the two ratios differ by a mile. What makes THIS row the arithmetic-width row is that the
        # CROSS PRODUCTS STRADDLE A DIFFERENCE OF EXACTLY ONE (so nothing narrower than exact integer
        # arithmetic can separate them) and that a DOUBLE-ROUNDED compare FLIPS THE WINNER (so the
        # row genuinely punishes float64 rather than merely being large). Its sibling rung-2 row had
        # exactly that re-derivation and the higher-value row got the weaker guard.
        # (Strengthened by Story 6-5b, T4.)
        "pins_inputs": lambda e, c: (
            all(_rung2_ratio(c, sid)[0] >= TWO53 for sid in c["tied"])
            and (lambda a, b: abs(a[0] * b[1] - b[0] * a[1]) == 1)(
                _rung2_ratio(c, c["tied"][0]), _rung2_ratio(c, c["tied"][1])
            )
            and (lambda winner, loser: (
                float(winner[0]) / float(winner[1]) <= float(loser[0]) / float(loser[1])
            ))(
                _rung2_ratio(c, e["steamid64"]),
                _rung2_ratio(c, next(s for s in c["tied"] if s != e["steamid64"])),
            )
        ),
    },
    {
        "name": "rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY",
        "note": (
            "S3's OTHER half, at rung 2. A scored 5 knife kills over 0 utility damage, so their "
            "ratio is 5/0 — `n/0` with `n > 0`, which the verbatim cross-multiplication makes "
            "+INFINITY: 5*10 = 50 beats 3*0 = 0 and 4*0 = 0. A wins outright at rung 2 over players "
            "with real production. Nothing divides, nothing throws, and nobody is filtered out. "
            "6-4a's review made this an explicit Stage-2 vector row; rung 2 must agree with it "
            "rather than 'fix' it here."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="knife_kills", eff_den="utility_damage"
        ),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"knife_kills": 5, "utility_damage": 0}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"knife_kills": 3, "utility_damage": 10}, ts=1000),
            _p(S_C, rounds=30, kills=20, vol={"knife_kills": 4, "utility_damage": 10}, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐ RE-DERIVED FROM THE ROW'S OWN AWARD RATHER THAN FROM HARDCODED NAMES (Story 6-5b): the
        # WINNER's computed four-term ratio is genuinely `n/0` with n > 0 — not merely "somebody has
        # a zero somewhere", which is equally true of the `0/0` row and would have let two rows claim
        # one property. `n/0` beats every finite value while `0/0` ties everything: opposite halves
        # of S3, each needing its own row.
        "pins_inputs": lambda e, c: (
            _rung2_ratio(c, e["steamid64"])[0] > 0
            and _rung2_ratio(c, e["steamid64"])[1] == 0
        ),
    },
    {
        "name": "rung-2-is-SKIPPED-when-both-efficiency-keys-are-NULL",
        "note": (
            "L2 — a NULL rung key is a deterministic SKIP, never a refusal and never a zero. Rung 1 "
            "IS configured here and narrows nothing (both players hold 5 hs_kills), rung 2 is "
            "skipped because both efficiency keys are NULL, rung 3 is skipped because neither "
            "player has an h2h record, and rung 4 decides. The efficiency block is fully "
            "materialised, so an implementation that treated a NULL key as the empty-string key — "
            "or as the value 0 — would run a rung this award declines."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 5}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 5}, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE SKIP (Story 6-5b): BOTH efficiency keys are absent, rung 1 IS configured
        # and narrows NOTHING (so the row cannot be confused with a rung-1 decision), and the
        # efficiency block is nevertheless FULLY MATERIALISED — which is the whole point: an
        # implementation that treated a NULL key as the empty-string key, or as 0, would find real
        # data waiting for it and run a rung this award declines.
        "pins_inputs": lambda e, c: (
            _rung_key(c["award"]["eff_num_key"]) is None
            and _rung_key(c["award"]["eff_den_key"]) is None
            and _rung_key(c["award"]["secondary_stat"]) is not None
            and _rung1_best(c) == list(c["tied"])
            and all(_by_id(c)[sid]["stats_int"]["efficiency"] for sid in c["tied"])
        ),
    },
    {
        "name": "rung-1-is-SKIPPED-when-secondary_stat-is-NULL",
        "note": (
            "L2's other half. `hs_kills` differs sharply between the two players (9 against 4), so "
            "a ladder that ran rung 1 anyway — on a defaulted key, or by treating NULL as 'use the "
            "deciding stat' — would exit at step 1 with A. With the key NULL the rung does not run "
            "at all, and B's earlier timestamp wins at rung 4 instead. Different winner AND "
            "different exit step."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=5000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE SKIP AND ITS COUNTERFACTUAL (Story 6-5b): `secondary_stat` is absent, and
        # SOME vocabulary key present in the players' `secondary` blocks would, if rung 1 had run on
        # it, crown the OTHER player. ⚠ The key is SEARCHED FOR rather than named, because with no
        # `secondary_stat` on the award there is nothing to derive it from — naming a literal here is
        # exactly the defect this pass is closing, so the guard asks the weaker, honest question:
        # "is there any key at all on which the skipped rung would have disagreed?" A row where every
        # key agreed with rung 4 proves nothing about the skip.
        "pins_inputs": lambda e, c: (
            _rung_key(c["award"]["secondary_stat"]) is None
            and any(
                _best_survivors(
                    c["tied"], c["award"]["direction"],
                    lambda sid, k=key: _stat_value(
                        k, _by_id(c)[sid]["stats_int"]["secondary"], "guard"
                    ),
                ) == [sid for sid in c["tied"] if sid != e["steamid64"]]
                for key in sorted(_by_id(c)[c["tied"][0]]["stats_int"]["secondary"])
                if all(
                    key in _by_id(c)[sid]["stats_int"]["secondary"] for sid in c["tied"]
                )
            )
        ),
    },
    {
        "name": "rung-3-a-strict-dominator-wins",
        "note": (
            "The ordinary rung-3 shape. The two players met, both directions are recorded, and A "
            "took 9 kills off B against B's 3 — so A STRICTLY dominates the remaining set and wins "
            "at exit step 3. B holds the earlier timestamp, so a ladder that skipped rung 3 lands "
            "on the other player at rung 4."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, h2h={S_B: {"kills": 9}}, ts=9000),
            _p(S_B, rounds=30, kills=20, h2h={S_A: {"kills": 3}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 3},
        # ⭐ RE-DERIVE THE ORDINARY RUNG-3 SHAPE AND ITS COUNTERFACTUAL (Story 6-5b): the record is
        # COMPLETE in both directions (so this is not the one-sided row), there is EXACTLY ONE strict
        # dominator and it is the winner, and the LOSER holds the earlier timestamp — so a ladder
        # that skipped rung 3 lands on the other player.
        "pins_inputs": lambda e, c: (
            not _has_one_sided_h2h(c)
            and _dominators_over(c, list(c["tied"])) == [e["steamid64"]]
            and _earliest_holder(c) != e["steamid64"]
        ),
    },
    {
        "name": "rung-3-direction-min-inverts-the-head-to-head",
        "note": (
            "L4 again, at rung 3. A `min` award over `deaths`: in their shared matches A died 2 "
            "times and B died 8, so A dominates BECAUSE the value is lower. An implementation that "
            "ignored `direction` at this rung crowns B — the same defect, a different rung, and one "
            "the rung-1 `min` row cannot catch."
        ),
        "award": _ladder_award("deaths", "volume", "min"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 10}, h2h={S_B: {"deaths": 2}}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 10}, h2h={S_A: {"deaths": 8}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 3},
        # ⭐ RE-DERIVE THE DIRECTION AND ITS COUNTERFACTUAL (Story 6-5b): the award really is `min`,
        # and the SAME head-to-head under `max` makes the OTHER player the dominator — which is the
        # only thing that distinguishes this row from the ordinary rung-3 one above it.
        "pins_inputs": lambda e, c: (
            c["award"]["direction"] == "min"
            and _dominators_over(c, list(c["tied"])) == [e["steamid64"]]
            and _dominators_over(
                {**c, "award": {**c["award"], "direction": "max"}}, list(c["tied"])
            ) == [sid for sid in c["tied"] if sid != e["steamid64"]]
        ),
    },
    {
        "name": "rung-3-a-ONE-SIDED-h2h-record-is-not-comparable",
        "note": (
            "⭐ L8, AND THE ROW THAT KILLS 'AN ABSENT h2h KEY IS A ZERO'. A records 5 kills against "
            "B; B has NO record of A at all. `h2h[p][q]` holds P's OWN stats over the shared "
            "matches, so a comparison needs both halves — one present and one absent is still 'not "
            "comparable', and A is therefore NOT a dominator. Rung 3 skips and rung 4 gives it to "
            "B. An implementation that read the absent side as 0 makes A's 5 beat B's 0 and exits "
            "at step 3 with A; so does one that required only the claimant's own direction. Both "
            "produce a different winner AND a different exit step."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, h2h={S_B: {"kills": 5}}, ts=9000),
            _p(S_B, rounds=30, kills=20, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 4},
        "pins_inputs": lambda e, c: _has_one_sided_h2h(c) and _no_player_beats_all(c),
    },
    {
        "name": "rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone",
        "note": (
            "⭐ 'BEATS ALL', NOT 'BEATS ANY'. A beat B in their shared matches, and C beat B in "
            "theirs — but A and C NEVER MET, so neither can dominate the whole remaining set and "
            "rung 3 skips. A ladder relaxed to 'beats at least one opponent' would find TWO "
            "dominators (A and C) and either crown one of them or hit the plural-dominator refusal; "
            "either way it diverges here. ⚠ The skip must NOT eliminate anyone — failing to "
            "dominate is not losing — so all three survivors reach rung 4, where C's timestamp is "
            "the earliest."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, h2h={S_B: {"kills": 9}}, ts=9000),
            _p(S_B, rounds=30, kills=20, h2h={S_A: {"kills": 3}, S_C: {"kills": 2}}, ts=7000),
            _p(S_C, rounds=30, kills=20, h2h={S_B: {"kills": 8}}, ts=4000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_C, "ladder_exit_step": 4},
        # Re-derive |D| == 0 from the row's own h2h maps, and that a 'beats ANY' reading really
        # would find more than one claimant — otherwise the row is not the row its name claims.
        # ⭐ THE DIRECTION AND THE DECIDING KEY NOW COME FROM THE ROW'S AWARD (Story 6-5b); both were
        # hardcoded to `"max"` / `"kills"`, so this guard could not have noticed a `min` fixture.
        "pins_inputs": lambda e, c: (
            _no_player_beats_all(c)
            and len([
                p for p in c["tied"]
                if any(
                    q in (_by_id(c)[p].get("h2h") or {})
                    and p in (_by_id(c)[q].get("h2h") or {})
                    and _beats_stat(
                        c["award"]["direction"],
                        _stat_value(c["award"]["deciding_stat"], _by_id(c)[p]["h2h"][q], "guard"),
                        _stat_value(c["award"]["deciding_stat"], _by_id(c)[q]["h2h"][p], "guard"),
                    )
                    for q in c["tied"] if q != p
                )
            ]) > 1
        ),
    },
    {
        "name": "rung-4-the-earliest-achievement_ts-wins",
        "note": (
            "The ordinary rung-4 shape, and the one the real 1v1 corpus reaches most often: no rung "
            "key is configured, nobody has an h2h record, and the earliest `min(approved_at)` "
            "decides. B at 1000 beats C at 2000 and A at 3000. ⚠ `achievement_ts` is a DOCUMENTED "
            "PROXY — admin approval order, not a demo tick (deferred-work.md:282)."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=3000),
            _p(S_B, rounds=30, kills=20, ts=1000),
            _p(S_C, rounds=30, kills=20, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE ORDINARY RUNG-4 SHAPE (Story 6-5b), and make it EXCLUSIVE of the three
        # special rung-4 rows: every timestamp is DISTINCT and STRICTLY POSITIVE (so no sentinel, no
        # zero, no byte-identical pair), and the winner is the minimum. This is the row that says
        # "the plain earliest wins" and nothing else in the file should be able to claim it.
        "pins_inputs": lambda e, c: (
            len({_by_id(c)[sid]["achievement_ts"] for sid in c["tied"]}) == len(c["tied"])
            and all(_by_id(c)[sid]["achievement_ts"] > 0 for sid in c["tied"])
            and all(_by_id(c)[sid]["achievement_ts"] < TWO53 for sid in c["tied"])
            and _earliest_holder(c) == e["steamid64"]
        ),
    },
    {
        "name": "rung-4-the-MINUS-ONE-sentinel-must-NEVER-win",
        "note": (
            "⭐⭐ L9, AND THE HIGHEST-VALUE ROW FOR RUNG 4. `-1` is the PUBLISHED ABSENT SENTINEL "
            "(0024:704) and it is NUMERICALLY THE SMALLEST VALUE IN THE COLUMN, so a naive `min` "
            "crowns the player with NO APPROVED ROWS AT ALL — the worst possible outcome for a rung "
            "whose entire meaning is 'did it first'. A carries -1; B carries a real 5000. The "
            "absents are filtered BEFORE the minimum, so B wins. Dropping the filter gives A."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=ABSENT_TS),
            _p(S_B, rounds=30, kills=20, ts=5000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE INPUT PROPERTY AND THE COUNTERFACTUAL: the row genuinely contains a -1,
        # the winner is NOT the -1 holder, and the naive `min` really would have picked the -1
        # holder. "Somebody won at rung 4" is true of half this file.
        "pins_inputs": lambda e, c: (
            any(p["achievement_ts"] == ABSENT_TS for p in c["players"])
            and {p["steamid64"]: p for p in c["players"]}[e["steamid64"]]["achievement_ts"]
            != ABSENT_TS
            and min(c["players"], key=lambda p: p["achievement_ts"])["steamid64"] != e["steamid64"]
        ),
    },
    {
        "name": "rung-4-when-EVERY-survivor-is-absent-the-rung-skips-to-rung-5",
        "note": (
            "L9's other half: with every survivor carrying the sentinel there is nothing to "
            "minimise, so rung 4 SKIPS — it does not refuse, it does not crash on an empty "
            "minimum, and it does not narrow. All three survivors reach rung 5 and SHARE the "
            "trophy. This is the shape a ceremony over a roster with unapproved matches produces."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=ABSENT_TS),
            _p(S_B, rounds=30, kills=20, ts=ABSENT_TS),
            _p(S_C, rounds=30, kills=20, ts=ABSENT_TS),
        ],
        "pins": lambda e: e == {
            "kind": "shared", "winners": [S_A, S_B, S_C], "ladder_exit_step": 5
        },
        "pins_inputs": lambda e, c: all(p["achievement_ts"] == ABSENT_TS for p in c["players"]),
    },
    {
        "name": "rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5",
        "note": (
            "⭐⭐ THE `deferred-work.md:281` SHAPE, ANSWERED. `approve_match` stamps the TRANSACTION "
            "timestamp on every stat_row of a match at once, so both competitors of a 1v1 duel "
            "carry EXACTLY the same `min(approved_at)` — rung 4 provably cannot separate them, and "
            "no match-level column can (0024:898-907 says so in the column comment). The blocker "
            "asked for 'a deterministic TERMINAL rung'; DECISION H answers it by RECOGNISING the "
            "one FR-29 already has. Rung 4 narrows to both and rung 5 SHARES the trophy at exit "
            "step 5 — a designed outcome, never an error state (EXPERIENCE.md:123), reached with "
            "ZERO bytes drawn."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=TS_DUEL),
            _p(S_B, rounds=30, kills=20, ts=TS_DUEL),
        ],
        "pins": lambda e: e == {"kind": "shared", "winners": [S_A, S_B], "ladder_exit_step": 5},
        "pins_inputs": lambda e, c: (
            len({p["achievement_ts"] for p in c["players"]}) == 1
            and c["players"][0]["achievement_ts"] != ABSENT_TS
        ),
    },
    {
        "name": "a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5",
        "note": (
            "⭐⭐ THE L3 ROW — 'each rung NARROWS the SURVIVORS; it never restarts from the original "
            "tie'. Three players tie on kills. Rung 1 (`hs_kills`) eliminates C, who holds 4 to A "
            "and B's 9. Rungs 2 and 3 are not configured. At rung 4 A and B share a BYTE-IDENTICAL "
            "timestamp, so the ladder bottoms out and SHARES between them. ⭐ C's timestamp is the "
            "EARLIEST IN THE WHOLE TIE — so a ladder that re-read the original tied set at rung 4 "
            "instead of rung 1's survivors would crown C outright, at a different rung, over a "
            "player rung 1 had already eliminated. That is a vote, not a ladder."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=TS_DUEL),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 9}, ts=TS_DUEL),
            _p(S_C, rounds=30, kills=20, vol={"hs_kills": 4}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "shared", "winners": [S_A, S_B], "ladder_exit_step": 5},
        # ⭐ RE-DERIVE THE COUNTERFACTUAL: the ELIMINATED player must hold the strictly earliest
        # timestamp, or a rung-4-restarts-from-`tied` regression would produce the same answer and
        # this row would silently stop being the L3 row.
        # ⭐ AND THAT TIMESTAMP MUST BE REAL, NOT THE SENTINEL (Story 6-5b). Without this clause the
        # rung-4 narrowing row — whose excluded player holds `-1`, numerically the smallest value in
        # the column — ALSO satisfies the property, and two rows claiming one property is exactly the
        # migration the uniqueness check exists to stop.
        "pins_inputs": lambda e, c: (
            (lambda eliminated: (
                len(eliminated) == 1
                and _earliest_holder(c) == eliminated[0]
                and _by_id(c)[eliminated[0]]["achievement_ts"] != ABSENT_TS
            ))([sid for sid in c["tied"] if sid not in e["winners"]])
        ),
    },
    {
        "name": "rung-2-runs-over-rung-1s-SURVIVORS-so-the-ORDER-of-the-rungs-decides",
        "note": (
            "⭐⭐ ADDED BY STORY 6.5's MUTATION PASS, which measured that SWAPPING RUNGS 1 AND 2 "
            "SURVIVED THE ENTIRE SUITE — because every other rung-2 row leaves `secondary_stat` NULL "
            "and every rung-1 row leaves both efficiency keys NULL, so no row could see the order at "
            "all. This is the only row where BOTH are configured. Rung 1 (`hs_kills`) eliminates C, "
            "who holds 4 to A and B's 9 — and C has BY FAR the best rung-2 ratio (900 utility damage "
            "over 30 rounds = 30, against A's 10 and B's 5). So: run the rungs in order and A wins at "
            "EXIT STEP 2; run rung 2 first, or let rung 2 re-read the ORIGINAL tied set instead of "
            "rung 1's survivors, and C wins instead. A different winner AND a different exit step, "
            "from a rule nothing else in this file constrains."
        ),
        "award": _ladder_award(
            "kills", "volume", "max",
            secondary="hs_kills", eff_num="utility_damage", eff_den="rounds_played",
        ),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9, "utility_damage": 300}, ts=9000),
            _p(S_B, rounds=40, kills=20, vol={"hs_kills": 9, "utility_damage": 200}, ts=8000),
            _p(S_C, rounds=30, kills=20, vol={"hs_kills": 4, "utility_damage": 900}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE THE COUNTERFACTUALS: the player rung 1 ELIMINATES must be the one rung 2 would
        # have crowned over the FULL tie, or the row cannot see the order at all — and that same
        # player must hold the earliest timestamp, so a rung-4 fallthrough would land on them too.
        # ⭐ THE ELIMINATED PLAYER IS NOW DERIVED, NOT NAMED (Story 6-5b): it used to compare against
        # the literal `[S_C]` with the keys and the direction hardcoded, so a fixture that renamed or
        # re-keyed the row would have kept a green guard over data it no longer described.
        "pins_inputs": lambda e, c: (
            (lambda eliminated: (
                len(eliminated) == 1
                and _rung2_best(c) == eliminated
                and _earliest_holder(c) == eliminated[0]
            ))([sid for sid in c["tied"] if sid not in _rung1_best(c)])
        ),
    },
    {
        "name": "rung-4-under-direction-min-is-STILL-the-earliest",
        "note": (
            "⭐ ADDED BY STORY 6.5's MUTATION PASS, which measured that APPLYING `direction` TO RUNG 4 "
            "SURVIVED THE ENTIRE SUITE — every other `min` row resolved at rung 1 or rung 3, so no "
            "row ever reached rung 4 under `min` with two distinct timestamps. L4 says rung 4 is a "
            "RECENCY rule and is NEVER inverted: 'earliest' means earliest for a `min` award exactly "
            "as it does for a `max` one, because inverting it would mean 'the latest achievement "
            "wins' for the catalog's one `min` award (`El Inofensivo`) and for no other. A at 1000 "
            "wins; an implementation that inverted the rung crowns B at 5000."
        ),
        "award": _ladder_award("deaths", "volume", "min"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 10}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 10}, ts=5000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        "pins_inputs": lambda e, c: (
            c["award"]["direction"] == "min"
            and min(c["players"], key=lambda p: p["achievement_ts"])["steamid64"] == e["steamid64"]
            and len({p["achievement_ts"] for p in c["players"]}) == 2
        ),
    },
    {
        "name": "the-ladder-NEVER-re-applies-the-FR-21-floors",
        "note": (
            "⭐ ADDED BY STORY 6.5's MUTATION PASS, which measured that MAKING THE LADDER RE-FILTER "
            "ON THE FLOORS SURVIVED THE ENTIRE SUITE — every other row carries `floor_rounds: 0`, so "
            "re-applying them filtered nobody. L12: Stage 2 has ALREADY applied the FR-21 floors and "
            "`idle_dq`; re-applying them here could EMPTY the tied set, and the ladder reads the set "
            "AS GIVEN. This award carries the catalog's real 24-round floor while A sits at 10 rounds "
            "— a player Stage 2 would never have admitted, handed to the ladder anyway. A holds the "
            "earlier timestamp and MUST still win at rung 4; a ladder that re-filtered would drop "
            "them and crown B."
        ),
        "award": _ladder_award("kills", "volume", "max", floor_rounds=24, floor_kills=20),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=10, kills=6, vol={"kills": 6}, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=5000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # Re-derive that the winner really would FAIL the award's own floors — without which the row
        # is an ordinary rung-4 case.
        "pins_inputs": lambda e, c: (
            c["award"]["floor_rounds"] > 0
            and {p["steamid64"]: p for p in c["players"]}[e["steamid64"]]["rounds_played"]
            < c["award"]["floor_rounds"]
        ),
    },
    {
        "name": "rung-keys-spelled-as-explicit-JSON-null",
        "note": (
            "The first of three rows that differ ONLY in how ABSENCE is spelled. Here all three rung "
            "keys are explicit JSON `null`, which is what the `award` table's nullable columns "
            "actually hold (0023:71-73) and what every award in the shipped catalog carries."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THIS ROW'S SPELLING (Story 6-5b). The identity check in `build_ladder_file`
        # compares the three rows' outcomes; only these three guards say WHICH spelling each row
        # carries, so an edit that collapsed all three onto `null` reddens here first.
        "pins_inputs": lambda e, c: (
            not c.get("omit_rung_keys", False)
            and all(
                c["award"][f] is None
                for f in ("secondary_stat", "eff_num_key", "eff_den_key")
            )
        ),
    },
    {
        "name": "rung-keys-OMITTED-from-the-award-object-entirely",
        "note": (
            "⭐ THE LOADER RULE, AND THE ROW THAT MAKES `stage2-resolve.json` REGENERABLE. Its award "
            "object has NO `secondary_stat`, `eff_num_key` or `eff_den_key` key at all, and its "
            "expected block is BYTE-IDENTICAL to the `null` row above — that identity IS the "
            "assertion. Every award object in `stage2-resolve.json` is exactly this shape, so "
            "'absent key => absent rung' is what lets that file regenerate with `outcome_kinds` as "
            "its only changed bytes. An implementation whose loader turned an absent key into the "
            "EMPTY STRING and then treated `''` as a present-but-invalid key would refuse here."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "omit_rung_keys": True,
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THIS ROW'S SPELLING (Story 6-5b): the keys are OMITTED from the emitted award
        # object, which is the only one of the three spellings that is a RENDERING decision rather
        # than a value.
        "pins_inputs": lambda e, c: c.get("omit_rung_keys", False) is True,
    },
    {
        "name": "rung-keys-spelled-as-EMPTY-STRINGS",
        "note": (
            "⭐ THE THIRD SPELLING, AND THE PRODUCER IS WHY IT EXISTS. Go has no nullable string, so "
            "`Award.SecondaryStat` is a plain `string` whose ZERO VALUE is `\"\"` — which is what "
            "`encoding/json` leaves behind for both a JSON `null` and an omitted key. Go therefore "
            "cannot distinguish 'absent' from 'present and empty', so if the verifier or this "
            "anchor treated `''` as a present-but-invalid key the seam would disagree on an input "
            "NEITHER runtime would report. Same resolution as 6-4b's absent container, and the "
            "expected block is byte-identical to the other two spellings."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="", eff_num="", eff_den=""),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THIS ROW'S SPELLING (Story 6-5b): all three keys are the EMPTY STRING, the
        # spelling Go's `string` zero value forces on the seam.
        "pins_inputs": lambda e, c: (
            not c.get("omit_rung_keys", False)
            and all(
                c["award"][f] == ""
                for f in ("secondary_stat", "eff_num_key", "eff_den_key")
            )
        ),
    },
    # ── APPENDED BY STORY 6-5b. Everything above is byte-identical apart from the amended `spec`. ──
    #
    # ⛔ THESE ROWS ADD NO BEHAVIOUR. Every one of them exercises a path all three implementations
    # ALREADY have and no row reached. Where a row disagreed with shipped source the review's verdict
    # stands — the implementations are right and the documents were wrong — so the document moved.
    {
        "name": "rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms",
        "note": (
            "⭐⭐ THE ROW RUNG 2's HEADLINE PROPERTY WAS MISSING. Every other rung-2 row in this file "
            "names VOLUME keys in both efficiency slots, and `snapshot_efficiency_form` gives a "
            "volume `v` the pair {v, 1} — so two of the four factors are the literal integer 1 and "
            "the ratio collapses to {num.num, den.num}. An implementation that DROPPED both the "
            "`.den` and `.num` factors entirely — the single most plausible L6 mistake, and one the "
            "README invites by saying 'a volume v arrives as {v, 1}' — was BYTE-IDENTICAL on all 24 "
            "committed cases including the 2^53 row. Here both slots are RATE keys, so all four "
            "factors are genuinely non-trivial: A is adr 200/20 over entry_success 100/40, giving "
            "(200*40)/(20*100) = 4; B is 300/30 over 100/30, giving (300*30)/(30*100) = 3. A wins "
            "at EXIT STEP 2. ⭐ The both-dropped mutant compares eff[num].num alone against "
            "eff[den].num — 200/100 = 2 against 300/100 = 3 — and picks B. A different winner, from "
            "the one arithmetic rule rung 2 exists for."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="adr", eff_den="entry_success"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=20, kills=20,
               rate={"adr": (200, 20), "entry_success": (100, 40)}, ts=9000),
            _p(S_B, rounds=30, kills=20,
               rate={"adr": (300, 30), "entry_success": (100, 30)}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE ALL THREE INPUT PROPERTIES: both eff keys really are RATE keys, NO factor of
        # the four-term product is the trivial 1 on any player, and the both-dropped mutant really
        # does pick the other player. Without the middle clause a future edit to a volume key would
        # leave the row producing winner/2 while silently ceasing to be this row.
        "pins_inputs": lambda e, c: (
            _class_of(c["award"]["eff_num_key"]) == "rate"
            and _class_of(c["award"]["eff_den_key"]) == "rate"
            and all(
                _by_id(c)[sid]["stats_int"]["efficiency"][k][i] > 1
                for sid in c["tied"]
                for k in (c["award"]["eff_num_key"], c["award"]["eff_den_key"])
                for i in (0, 1)
            )
            and _best_survivors(
                c["tied"], c["award"]["direction"],
                lambda sid: ("rate", (
                    _by_id(c)[sid]["stats_int"]["efficiency"][c["award"]["eff_num_key"]][0],
                    _by_id(c)[sid]["stats_int"]["efficiency"][c["award"]["eff_den_key"]][0],
                )),
            ) != [e["steamid64"]]
        ),
    },
    {
        "name": "rung-2-under-direction-min-picks-the-SMALLEST-ratio",
        "note": (
            "L4 at rung 2 — the rung this file had no `min` row for. Rungs 1, 3 and 4 each have one; "
            "rung 2 did not, so a mutation that hardcoded `max` at rung 2 alone survived every gate. "
            "A `min` award (fewest deaths, `El Inofensivo`'s shape) tied at 10 deaths each: A is 300 "
            "utility damage over 30 rounds = 10, B is 400 over 50 = 8. Under `min` the SMALLER ratio "
            "wins, so B takes it at EXIT STEP 2. ⭐ A holds the EARLIER timestamp AND the larger "
            "ratio, so both a hardcoded `max` and a skipped rung 2 crown A instead — a different "
            "winner either way."
        ),
        "award": _ladder_award(
            "deaths", "volume", "min", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 10, "utility_damage": 300}, ts=1000),
            _p(S_B, rounds=50, kills=20, vol={"deaths": 10, "utility_damage": 400}, ts=5000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE THE DIRECTION AND ITS COUNTERFACTUAL from the row's own data: the award really
        # is `min`, and running the SAME rung under `max` really does crown somebody else.
        "pins_inputs": lambda e, c: (
            c["award"]["direction"] == "min"
            and _rung2_best(c, "max") == [sid for sid in c["tied"] if sid != e["steamid64"]]
        ),
    },
    {
        "name": "rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS",
        "note": (
            "⭐ L3 AT RUNG 2, and it had no row. All four committed rung-2 rows exit AT step 2 with a "
            "single winner, so `survivors = narrowed` was never read again — deleting the line, or "
            "letting rung 4 restart from the original tie, reddened nothing. Here rung 2 narrows and "
            "resolves NOTHING: A is 300/30 = 10 and B is 200/20 = 10, exactly equal, while C is "
            "150/30 = 5 and is ELIMINATED. Rung 3 skips (no h2h) and rung 4 decides between the two "
            "SURVIVORS, where A's 5000 beats B's 8000. ⭐ C holds 1000 — the strictly earliest "
            "timestamp in the whole tie — so a ladder that dropped the narrowing crowns C, a player "
            "rung 2 had already eliminated."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 300}, ts=5000),
            _p(S_B, rounds=20, kills=20, vol={"utility_damage": 200}, ts=8000),
            _p(S_C, rounds=30, kills=20, vol={"utility_damage": 150}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THAT RUNG 2 GENUINELY NARROWS AND GENUINELY FAILS TO RESOLVE, and that the
        # player it eliminates holds the strictly earliest timestamp — without which a
        # narrowing-deleted regression produces the same answer and the row proves nothing.
        "pins_inputs": lambda e, c: (
            1 < len(_rung2_best(c)) < len(c["tied"])
            and _earliest_holder(c) not in _rung2_best(c)
        ),
    },
    {
        "name": "rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung",
        "note": (
            "⭐ THE `0/0` HALF OF S3 AT RUNG 2, promised by the rung-2 efficiency-pair decision "
            "(Cuatro, Group-1 code review) and missing: only the `n/0` half had a row, and the `0/0` "
            "row that existed was at rung 1, a different arithmetic path. A holds ZERO blind kills "
            "over ZERO wallbangs, so their four-term ratio is (0*1)/(1*0) = 0/0 — which "
            "cross-multiplies to 0 against EVERY pair and is therefore EQUAL to everything. A cannot "
            "be eliminated at rung 2 no matter how good the others are: B (5/10) beats C (3/10) "
            "outright, so C IS eliminated, but A rides through on a ratio nobody can beat. Rung 4 "
            "then gives it to A at 1000. ⭐ This is exactly the shipped `kills/deaths` pair's second "
            "degenerate case — a player with 0 kills and 0 deaths — and it is accepted and "
            "documented rather than engineered away. An implementation that filtered zero "
            "denominators out of the race (the silent argmax S3 forbids) crowns B instead."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="blind_kills", eff_den="wallbang_kills"
        ),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"blind_kills": 0, "wallbang_kills": 0}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"blind_kills": 5, "wallbang_kills": 10}, ts=2000),
            _p(S_C, rounds=30, kills=20, vol={"blind_kills": 3, "wallbang_kills": 10}, ts=9000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE ALL THREE: somebody's COMPUTED four-term ratio really is 0/0 (not merely a zero
        # denominator on one half), that player really does survive the rung, and the rung really
        # does eliminate somebody else — so the row is neither vacuous nor a duplicate of the `n/0`
        # row above it.
        "pins_inputs": lambda e, c: (
            any(_rung2_ratio(c, sid) == (0, 0) for sid in c["tied"])
            and all(
                sid in _rung2_best(c)
                for sid in c["tied"] if _rung2_ratio(c, sid) == (0, 0)
            )
            and len(_rung2_best(c)) < len(c["tied"])
        ),
    },
    {
        "name": "rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set",
        "note": (
            "⭐⭐ RUNG 4's NARROWING WAS NEVER LOAD-BEARING. Every committed rung-4 case is all-absent, "
            "or two byte-identical timestamps, or already width-2 — in all of them `narrowed` equals "
            "`present` equals `survivors`, so an implementation that SKIPPED rung 4 whenever it "
            "failed to resolve was byte-identical everywhere. Here the tie is width 3: A carries the "
            "`-1` sentinel while B and C tie at a real 1000. Rung 4 filters A out, minimises over "
            "{B, C}, narrows to {B, C} — and rung 5 shares between THOSE TWO. ⛔ The skip-instead-of- "
            "narrow implementation shares between ALL THREE, handing a co-winner's trophy to a "
            "player with NO APPROVED ROWS AT ALL. That is the exact L9 failure the sentinel row "
            "pins one rung earlier, arriving through the rung-5 door instead."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=ABSENT_TS),
            _p(S_B, rounds=30, kills=20, ts=1000),
            _p(S_C, rounds=30, kills=20, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "shared", "winners": [S_B, S_C], "ladder_exit_step": 5},
        # ⭐ RE-DERIVE THE NARROWING AND ITS COUNTERFACTUAL: exactly one tied member holds the
        # sentinel, that member is NOT a co-winner, and the co-winners are a PROPER subset of the tie
        # that is still plural — the shape a rung that skipped instead of narrowing cannot produce.
        "pins_inputs": lambda e, c: (
            len(c["tied"]) >= 3
            and len([p for p in c["players"] if p["achievement_ts"] == ABSENT_TS]) == 1
            and all(
                p["steamid64"] not in e["winners"]
                for p in c["players"] if p["achievement_ts"] == ABSENT_TS
            )
            and 2 <= len(e["winners"]) < len(c["tied"])
        ),
    },
    {
        "name": "rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED",
        "note": (
            "⭐ THE EARLY RETURN AT RUNG 1 WAS UNPINNED. No committed row had rung 1 resolve while a "
            "later rung was configured, so falling THROUGH a resolved rung 1 was invisible: with a "
            "single survivor rung 2's `best` is that survivor and rung 3's dominator loop is "
            "VACUOUSLY TRUE, so the ladder returns the SAME winner at a FABRICATED exit step. Story "
            "6.8 persists that step as `award_result.tie_ladder_exit_step`, so the audience is told "
            "the wrong reason. Here rung 1 (`hs_kills` 9 against 4) resolves to A at EXIT STEP 1 "
            "while BOTH efficiency keys are configured AND both players carry h2h records. Falling "
            "through gives A at step 2, or at step 3 — right player, wrong story. ⚠ B's rung-2 ratio "
            "(900/30) is nine times A's and B wins the head-to-head 7 to 1, so nothing here is "
            "coincidental agreement."
        ),
        "award": _ladder_award(
            "kills", "volume", "max",
            secondary="hs_kills", eff_num="utility_damage", eff_den="rounds_played",
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9, "utility_damage": 100},
               h2h={S_B: {"kills": 1}}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4, "utility_damage": 900},
               h2h={S_A: {"kills": 7}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THAT THE LATER RUNGS ARE GENUINELY CONFIGURED AND GENUINELY DISAGREE: rung 2
        # would have crowned the other player, and so would rung 3. A row where they agreed could
        # not see the early return at all.
        "pins_inputs": lambda e, c: (
            e["ladder_exit_step"] == 1
            and _rung_key(c["award"].get("eff_num_key")) is not None
            and _rung_key(c["award"].get("eff_den_key")) is not None
            and _rung2_best(c) == [sid for sid in c["tied"] if sid != e["steamid64"]]
            and _dominators_over(c, list(c["tied"]))
            == [sid for sid in c["tied"] if sid != e["steamid64"]]
        ),
    },
    {
        "name": "rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED",
        "note": (
            "⭐ THE SAME UNPINNED EARLY RETURN, ONE RUNG DOWN, and this one changes the WINNER as "
            "well as the step. Rung 2 resolves (A is 300/30 = 10 against B's 400/50 = 8) and returns "
            "at EXIT STEP 2 — but both players carry a full two-way h2h record in which B beats A 7 "
            "to 1. An implementation that ran rung 3 before rung 2, or that fell through a resolved "
            "rung 2, finds B the strict dominator and returns B at step 3. Rung 3->4 precedence was "
            "already pinned; rungs 1 and 2 were not, and this is the row that makes rung 2's return "
            "observable at all."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 300},
               h2h={S_B: {"kills": 1}}, ts=9000),
            _p(S_B, rounds=50, kills=20, vol={"utility_damage": 400},
               h2h={S_A: {"kills": 7}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE THAT RUNG 3 WOULD HAVE CROWNED THE OTHER PLAYER: both directions of the h2h
        # record exist and the OTHER player is the strict dominator over the full tie.
        "pins_inputs": lambda e, c: (
            e["ladder_exit_step"] == 2
            and not _has_one_sided_h2h(c)
            and _dominators_over(c, list(c["tied"]))
            == [sid for sid in c["tied"] if sid != e["steamid64"]]
        ),
    },
    {
        "name": "rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not",
        "note": (
            "⭐⭐ L3 AT RUNG 3, and NO committed row both narrowed AND populated h2h — so an "
            "implementation computing dominators over the ORIGINAL `tied` was byte-identical on "
            "every case in the file. Rung 1 (`hs_kills`) eliminates C, who holds 4 to A and B's 9. "
            "Over the SURVIVORS {A, B} the record is complete and A takes 9 to B's 3, so A is the "
            "strict dominator and wins at EXIT STEP 3. Over the FULL tie A is NOT a dominator — A "
            "and C never met, and L8 makes 'never met' disqualifying rather than a zero — so |D| is "
            "0, rung 3 skips, and rung 4 crowns C at 500. ⭐ A DIFFERENT WINNER AND A DIFFERENT EXIT "
            "STEP, from the one rule (`each rung narrows the survivors`) that no other row can see "
            "at this rung."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9},
               h2h={S_B: {"kills": 9}}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 9},
               h2h={S_A: {"kills": 3}, S_C: {"kills": 2}}, ts=1000),
            _p(S_C, rounds=30, kills=20, vol={"hs_kills": 4},
               h2h={S_B: {"kills": 8}}, ts=500),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 3},
        # ⭐ RE-DERIVE BOTH HALVES: rung 1 narrows to a plural PROPER subset, and over the FULL tie
        # nobody dominates — so the dominator this row produces exists only because rung 3 ran over
        # the survivors. `_no_player_beats_all` is computed over `tied`, which is exactly the
        # counterfactual.
        "pins_inputs": lambda e, c: (
            1 < len(_rung1_best(c)) < len(c["tied"])
            and _dominators_over(c, _rung1_best(c)) == [e["steamid64"]]
            and _dominators_over(c, list(c["tied"])) == []
        ),
    },
    {
        "name": "a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3",
        "note": (
            "⭐ NOT ONE `class: rate` AWARD EXISTED IN THIS FILE — zero occurrences — so rung 3's "
            "rate arm, where `h2h[p][q][deciding_stat]` is a {num, den} PAIR and the dominator test "
            "CROSS-MULTIPLIES, was never entered by any row. Four of the twelve shipped awards are "
            "`rate`. Here both players tie at hs_pct 6/20 and their head-to-head records are pairs: "
            "A took 6 headshots of 30 kills against B, B took 7 of 40 against A. 6*40 = 240 beats "
            "7*30 = 210, so A strictly dominates and wins at EXIT STEP 3 — even though B has the "
            "LARGER NUMERATOR, so a naive numerator compare picks B. ⚠ B also holds the earlier "
            "timestamp, so an implementation that skipped rung 3 for a rate award lands on B too."
        ),
        "award": _ladder_award("hs_pct", "rate", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 6},
               h2h={S_B: {"hs_pct": (6, 30)}}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 6},
               h2h={S_A: {"hs_pct": (7, 40)}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 3},
        # ⭐ RE-DERIVE THAT THE ROW IS GENUINELY THE RATE ARM: the award's class is `rate`, the
        # deciding key's OWN class is `rate` (L5 — they are allowed to differ, so both are checked),
        # every h2h value really is a PAIR, and the naive numerator compare picks the other player.
        "pins_inputs": lambda e, c: (
            c["award"]["class"] == "rate"
            and _class_of(c["award"]["deciding_stat"]) == "rate"
            and all(
                isinstance(block[c["award"]["deciding_stat"]], tuple)
                for sid in c["tied"] for block in (_by_id(c)[sid].get("h2h") or {}).values()
            )
            and max(
                c["tied"],
                key=lambda sid: _by_id(c)[sid]["h2h"][
                    next(q for q in c["tied"] if q != sid)
                ][c["award"]["deciding_stat"]][0],
            ) != e["steamid64"]
        ),
    },
    {
        "name": "an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4",
        "note": (
            "⭐ THE VALUE ADJACENT TO THE SENTINEL, and it had no row. `achievement_ts` never took `0` "
            "anywhere in this file, so an implementation whose absent-filter was `ts <= 0` rather "
            "than `ts != -1` passed EVERY case — the sentinel is -1 and every other row's timestamps "
            "are comfortably positive. Here A carries a real `0` (the Unix epoch, which 0024 permits: "
            "the column is NEVER NULL and -1 is the ONLY absent value) and B carries 5000. A is the "
            "earliest, so A wins at EXIT STEP 4. A `ts <= 0` filter drops A and crowns B."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=0),
            _p(S_B, rounds=30, kills=20, ts=5000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE INPUT: somebody genuinely holds exactly 0, nobody holds the sentinel (so
        # the row is about 0 and not about -1), and the 0-holder is the winner.
        "pins_inputs": lambda e, c: (
            any(p["achievement_ts"] == 0 for p in c["players"])
            and all(p["achievement_ts"] != ABSENT_TS for p in c["players"])
            and {p["steamid64"]: p for p in c["players"]}[e["steamid64"]]["achievement_ts"] == 0
        ),
    },
    {
        "name": "an-achievement_ts-past-2-pow-53-is-compared-EXACTLY",
        "note": (
            "⭐ THE PROVENANCE RULE'S OWN PROOF, and the reason `achievement_ts` travels as a decimal "
            "STRING even though today's values sit comfortably inside 2^53. A holds 2^53+1 and B "
            "holds 2^53 — a difference of ONE. B is the earlier, so B wins at EXIT STEP 4. ⛔ A "
            "verifier that read the column with `Number` gets 2^53 for BOTH (2^53+1 is not "
            "representable as a double and rounds down), sees them EQUAL, narrows to both and "
            "bottoms out SHARED at step 5 — a different outcome KIND, not merely a different winner. "
            "In JavaScript the corruption happens at `JSON.parse`, before any comparison runs, which "
            "is precisely why the split is by provenance and not by magnitude."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=TWO53 + 1),
            _p(S_B, rounds=30, kills=20, ts=TWO53),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THE COUNTERFACTUAL, NOT MERELY THE MAGNITUDE: every timestamp is past 2^53 AND
        # the two are INDISTINGUISHABLE as float64, so a `Number`-parsing verifier provably cannot
        # reproduce this row. "Both are large" would be satisfied by any oversized pair.
        "pins_inputs": lambda e, c: (
            all(p["achievement_ts"] >= TWO53 for p in c["players"])
            and len({p["achievement_ts"] for p in c["players"]}) == len(c["players"])
            and len({float(p["achievement_ts"]) for p in c["players"]}) == 1
        ),
    },
    {
        "name": "a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung",
        "note": (
            "⭐ NO CASE CARRIED A NON-TIED PLAYER, so an implementation that iterated the ROSTER "
            "instead of the SURVIVORS was indistinguishable from a correct one on every row in the "
            "file. The snapshot is the whole roster — 0024 freezes every rostered player, and 6.6 "
            "will drive this ladder over a REDUCED tie against that same full roster — so this is "
            "the ordinary production shape, not an exotic one. C is in `players` and NOT in `tied`, "
            "and C is built to win on every axis: 99 hs_kills against A's 9, and timestamp 1, the "
            "strictly earliest. Rung 1 runs over {A, B} alone and gives it to A at EXIT STEP 1. A "
            "roster-iterating ladder crowns C — a player who never tied with anybody."
        ),
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=5000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=9000),
            _p(S_C, rounds=30, kills=20, vol={"hs_kills": 99}, ts=1),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THAT THE INTRUDER IS BOTH PRESENT AND DOMINANT: some player row is outside
        # `tied`, and that player would have won BOTH the rung it is excluded from and the last rung.
        # A non-tied player who lost anyway would make this row indistinguishable from an ordinary one.
        "pins_inputs": lambda e, c: (
            (lambda outsiders, key: (
                len(outsiders) >= 1
                and all(
                    p["stats_int"]["secondary"][key]
                    > max(_by_id(c)[sid]["stats_int"]["secondary"][key] for sid in c["tied"])
                    and p["achievement_ts"]
                    < min(_by_id(c)[sid]["achievement_ts"] for sid in c["tied"])
                    for p in outsiders
                )
            ))(
                [p for p in c["players"] if p["steamid64"] not in c["tied"]],
                _rung_key(c["award"].get("secondary_stat")),
            )
        ),
    },
    {
        "name": "ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks",
        "note": (
            "⭐ THE ABSENT-CONTAINER RULE HAD NO LADDER-SIDE ROW. `stage1-pick.json` treats an absent "
            "container as load-bearing and this file emitted all three blocks on every player, so "
            "TypeScript's `container(undefined)` and Go's nil-map read were entered by NOTHING. An "
            "ABSENT CONTAINER IS THE EMPTY CONTAINER (Cuatro, 2026-08-04): Go's "
            "`map[string]StatValue` cannot tell a nil map from an empty one, so `undefined` must "
            "mean here what nil means there or the producer and the verifier disagree about an input "
            "NEITHER would report. A's `secondary`, `efficiency` and `h2h` keys are all OMITTED from "
            "the JSON. No rung key is configured, so rungs 1 and 2 skip; rung 3 reads A's absent h2h "
            "as empty and skips; rung 4 gives it to A at 1000. ⚠ A refusal here would be WRONG — the "
            "row exists to prove the absence RESOLVES rather than that it refuses."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "omit_blocks": {S_A: ("secondary", "efficiency", "h2h")},
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE THAT THE OMISSION IS REAL AND COMPLETE, from the row's own declaration: a TIED
        # member has ALL THREE blocks omitted. Two of three would leave one container untested while
        # the row still produced winner/4.
        "pins_inputs": lambda e, c: (
            any(
                sid in c["tied"] and set(blocks) == {"secondary", "efficiency", "h2h"}
                for sid, blocks in c.get("omit_blocks", {}).items()
            )
        ),
    },
    # ── Added at the Story 6-5b CODE REVIEW (2026-08-06). ─────────────────────────────────────────
    #
    # ⭐ SIX BOUNDARIES THE STORY'S OWN ACs DID NOT NAME, found by an independent edge-case pass and
    # patched here on Cuatro's call (option 1: all six land in this story rather than being split
    # with 6.11, because 6.6 drives this ladder next and should inherit it whole). Three of them
    # change a WINNER or CRASH; three close gates that could not fail. None of them changes
    # behaviour — every one is an input the shipped code already handles correctly and nothing
    # observed.
    {
        "name": "rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one",
        "note": (
            "⭐⭐ `n/0` UNDER `min` EXISTED IN NO ROW OF EITHER VECTOR FILE. Every zero-denominator "
            "row in `ladder-resolve.json` AND all four in `stage2-resolve.json` are `direction: "
            "max`, so a mutant that short-circuits 'a zero denominator wins the rung' — ignoring "
            "`direction` entirely — was BYTE-IDENTICAL on all 37 ladder cases and all 28 Stage-2 "
            "cases. Both runtimes DOCUMENT the behaviour ('a survivor with 0 deaths loses to "
            "everyone on `El Inofensivo`') and nothing exercised it. S3 makes `n/0` with `n > 0` "
            "beat every finite value, so under `min` it LOSES to every finite value. A is 5 blind "
            "kills over ZERO wallbangs — the +infinity shape — and B is 8 over 10. Under `min` B "
            "wins at EXIT STEP 2. ⛔ A holds BOTH the +infinity ratio AND the earlier timestamp, so "
            "the zero-denominator-wins mutant, a hardcoded `max`, and a skipped rung 2 ALL crown A "
            "instead. On the shipped `El Inofensivo` this is the difference between the least "
            "harmful player and the most."
        ),
        "award": _ladder_award(
            "deaths", "volume", "min", eff_num="blind_kills", eff_den="wallbang_kills"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20,
               vol={"deaths": 10, "blind_kills": 5, "wallbang_kills": 0}, ts=1000),
            _p(S_B, rounds=30, kills=20,
               vol={"deaths": 10, "blind_kills": 8, "wallbang_kills": 10}, ts=9000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_B, "ladder_exit_step": 2},
        # ⭐ RE-DERIVE THE SHAPE AND ITS COUNTERFACTUAL: the award really is `min`, exactly one tied
        # member's COMPUTED four-term ratio really is `n/0` with a positive numerator, that member
        # wins the SAME rung outright under `max`, and the actual winner is somebody else. Checking
        # only "a denominator is zero" would be satisfied by any row with a zero half anywhere.
        "pins_inputs": lambda e, c: (
            (lambda inf: (
                len(inf) == 1
                and c["award"]["direction"] == "min"
                and _rung2_best(c, "max") == inf
                and e["steamid64"] not in inf
            ))([
                sid for sid in c["tied"]
                if _rung2_ratio(c, sid)[1] == 0 and _rung2_ratio(c, sid)[0] > 0
            ])
        ),
    },
    {
        "name": "rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through",
        "note": (
            "⭐⭐ THE TWO DEGENERATE RATIOS NEVER MET IN ONE RACE. The `n/0` row and the `0/0` row "
            "are disjoint — neither carries the other's shape — so nothing pinned what S3 says "
            "happens when they are compared: cross-multiplication gives `5*0 - 0*0 = 0`, so they "
            "are EQUAL and NEITHER eliminates the other. A is 5 blind kills over ZERO wallbangs "
            "(+infinity), B is ZERO over ZERO (equal to everything), C is 3 over 10 (finite). Rung "
            "2 eliminates C alone and narrows to {A, B}; rung 3 skips; rung 4 finds A and B "
            "byte-identical at 1000 and narrows to both; rung 5 SHARES between them at EXIT STEP "
            "5. ⛔ An implementation reading these as IEEE doubles — where `+inf > NaN` is false but "
            "`NaN` loses every comparison — narrows to {A} and returns WINNER A AT STEP 2. That is "
            "a different outcome KIND, a different winner and a different exit step, from one "
            "comparison the file could not see."
        ),
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="blind_kills", eff_den="wallbang_kills"
        ),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"blind_kills": 5, "wallbang_kills": 0}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"blind_kills": 0, "wallbang_kills": 0}, ts=1000),
            _p(S_C, rounds=30, kills=20, vol={"blind_kills": 3, "wallbang_kills": 10}, ts=9000),
        ],
        "pins": lambda e: e == {"kind": "shared", "winners": [S_A, S_B], "ladder_exit_step": 5},
        # ⭐ RE-DERIVE THAT BOTH DEGENERATE SHAPES ARE PRESENT, DISTINCT, AND MUTUALLY UNBEATABLE
        # under the row's OWN comparator and direction — and that the rung still eliminates
        # somebody, so the row is not the vacuous "nobody was eliminated" case.
        "pins_inputs": lambda e, c: (
            (lambda inf, zoz: (
                len(inf) == 1 and len(zoz) == 1
                and not _beats_stat(c["award"]["direction"],
                                    ("rate", _rung2_ratio(c, inf[0])),
                                    ("rate", _rung2_ratio(c, zoz[0])))
                and not _beats_stat(c["award"]["direction"],
                                    ("rate", _rung2_ratio(c, zoz[0])),
                                    ("rate", _rung2_ratio(c, inf[0])))
                and set(_rung2_best(c)) == {inf[0], zoz[0]}
                and len(_rung2_best(c)) < len(c["tied"])
            ))(
                [s for s in c["tied"]
                 if _rung2_ratio(c, s)[1] == 0 and _rung2_ratio(c, s)[0] > 0],
                [s for s in c["tied"] if _rung2_ratio(c, s) == (0, 0)],
            )
        ),
    },
    {
        "name": "rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE",
        "note": (
            "⭐ RUNG 3's CONJUNCTION WAS NEVER LOAD-BEARING FOR A POSITIVE RESULT. Every rung-3 WIN "
            "in this file is decided over exactly TWO survivors, where 'dominates every other' "
            "collapses to 'beats the one opponent' — so the loop across opponents could have "
            "returned on its first success and nothing would have reddened. The only width-3 "
            "rung-3 row is the `|D| == 0` case. Here the record is COMPLETE among all three: A "
            "beats B (9 to 3) AND C (8 to 2), while B beats C (7 to 4) but loses to A. A is the "
            "only strict dominator and wins at EXIT STEP 3. ⛔ A 'beats at least one opponent' "
            "implementation finds TWO dominators — A and B — and raises the plural-dominator "
            "`internal` refusal instead of crowning anybody. ⚠ C holds the earliest timestamp, so "
            "an implementation that skipped rung 3 crowns C at rung 4: a different winner too."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B, S_C],
        "players": [
            _p(S_A, rounds=30, kills=20,
               h2h={S_B: {"kills": 9}, S_C: {"kills": 8}}, ts=9000),
            _p(S_B, rounds=30, kills=20,
               h2h={S_A: {"kills": 3}, S_C: {"kills": 7}}, ts=5000),
            _p(S_C, rounds=30, kills=20,
               h2h={S_A: {"kills": 2}, S_B: {"kills": 4}}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 3},
        # ⭐ RE-DERIVE THAT THE CONJUNCTION IS WHAT DECIDES: the tie is at least width 3, the h2h
        # record is COMPLETE in both directions for every ordered pair (so no result rests on L8's
        # never-met skip), the winner strictly beats AT LEAST TWO opponents, and some OTHER member
        # beats at least one without dominating — which is precisely what makes "beats one" and
        # "beats all" different predicates on this row.
        "pins_inputs": lambda e, c: (
            (lambda beats: (
                len(c["tied"]) >= 3
                and all(
                    q in (_by_id(c)[p].get("h2h") or {})
                    for p in c["tied"] for q in c["tied"] if p != q
                )
                and _dominators_over(c, list(c["tied"])) == [e["steamid64"]]
                and len(beats(e["steamid64"])) >= 2
                and any(
                    0 < len(beats(p)) < len(c["tied"]) - 1
                    for p in c["tied"] if p != e["steamid64"]
                )
            ))(
                lambda p: [
                    q for q in c["tied"]
                    if q != p and _beats_stat(
                        c["award"]["direction"],
                        _stat_value(c["award"]["deciding_stat"],
                                    _by_id(c)[p]["h2h"][q], "guard"),
                        _stat_value(c["award"]["deciding_stat"],
                                    _by_id(c)[q]["h2h"][p], "guard"),
                    )
                ]
            )
        ),
    },
    {
        "name": "a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way",
        "note": (
            "⭐ THE MIRROR OF L5, AND ONLY ONE DIRECTION HAD A ROW. The file pins a VOLUME award "
            "with a RATE secondary; the reverse pairing — a `class: rate` award whose "
            "`secondary_stat` is a VOLUME key — appeared nowhere, because the file's only "
            "`class: rate` award carries no secondary at all. L5's rule is that the SHAPE is "
            "decided by the KEY's class, never by the AWARD's, and it has to hold in both "
            "directions or it is not a rule. The award is `hs_pct` (rate) and the secondary is "
            "`hs_kills` (volume, a bare integer): A holds 9 to B's 4 and wins at EXIT STEP 1. ⛔ An "
            "implementation branching on `award.class` reads a bare integer as a {num, den} pair — "
            "a nil `.Num` in Go and two `undefined` halves in TypeScript, neither of which is the "
            "class-mismatch refusal it should be. ⚠ B holds the earlier timestamp, so falling "
            "through crowns B."
        ),
        "award": _ladder_award("hs_pct", "rate", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, ts=9000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=1000),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 1},
        # ⭐ RE-DERIVE THAT THE CLASSES GENUINELY DISAGREE AND THAT THE KEY's CLASS IS THE ONE THAT
        # DECIDES: the award's class is `rate`, the secondary KEY's class is `volume`, the two
        # differ, every value actually read at rung 1 really is a bare integer rather than a pair,
        # and the winner is not the earliest-timestamp holder (so falling through is observable).
        "pins_inputs": lambda e, c: (
            (lambda key: (
                c["award"]["class"] == "rate"
                and _class_of(key) == "volume"
                and _class_of(key) != c["award"]["class"]
                and all(
                    isinstance(_by_id(c)[sid]["stats_int"]["secondary"][key], int)
                    and not isinstance(_by_id(c)[sid]["stats_int"]["secondary"][key], bool)
                    for sid in c["tied"]
                )
                and _earliest_holder(c) != e["steamid64"]
            ))(_rung_key(c["award"].get("secondary_stat")))
        ),
    },
    {
        "name": "a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH",
        "note": (
            "⭐⭐ THE ONLY ROW WITH A ROSTER WIDER THAN THE TIE EXITS AT RUNG 1, so rungs 2, 3, 4 and "
            "5 had never once run against a roster that contained somebody outside `tied`. That is "
            "the ORDINARY production shape — 0024 freezes the whole roster and 6.6 drives this "
            "ladder over a REDUCED tie against it — and it is the shape three separate mistakes "
            "hide in. C is in `players`, not in `tied`, and is built to win by every route "
            "simultaneously: an `achievement_ts` of -5 (BELOW the published sentinel), and an h2h "
            "record that strictly dominates both tied players. Correct behaviour reads NONE of it: "
            "rungs 1 and 2 are unconfigured, rung 3 finds A and B level at 5 apiece over the "
            "SURVIVORS and skips, and rung 4 gives it to A at 5000 — EXIT STEP 4. ⛔ THREE "
            "COUNTERFACTUALS ON ONE ROW: an implementation validating `achievement_ts` over "
            "`players` rather than over `tied` REFUSES `player` on an input the other two resolve; "
            "one computing rung-3 dominators over the roster crowns C at step 3; one folding rung "
            "4's minimum over the roster crowns C outright, because -5 is not the sentinel and so "
            "survives the absent-filter."
        ),
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20,
               h2h={S_B: {"kills": 5}, S_C: {"kills": 1}}, ts=5000),
            _p(S_B, rounds=30, kills=20,
               h2h={S_A: {"kills": 5}, S_C: {"kills": 1}}, ts=9000),
            _p(S_C, rounds=30, kills=20,
               h2h={S_A: {"kills": 9}, S_B: {"kills": 9}}, ts=-5),
        ],
        "pins": lambda e: e == {"kind": "winner", "steamid64": S_A, "ladder_exit_step": 4},
        # ⭐ RE-DERIVE ALL THREE COUNTERFACTUALS, not merely that an outsider exists. The outsider's
        # timestamp is BELOW the sentinel (so a roster-wide validation must refuse), the outsider is
        # the sole dominator over the ROSTER while nobody dominates over the TIE (so a roster-wide
        # rung 3 must crown them), the outsider is strictly earlier than every tied member (so a
        # roster-wide rung 4 must crown them), and the actual winner is a tied member.
        "pins_inputs": lambda e, c: (
            (lambda out: (
                len(out) == 1
                and all(p["achievement_ts"] < ABSENT_TS for p in out)
                and _dominators_over(c, [p["steamid64"] for p in c["players"]])
                == [p["steamid64"] for p in out]
                and _dominators_over(c, list(c["tied"])) == []
                and all(
                    p["achievement_ts"]
                    < min(_by_id(c)[sid]["achievement_ts"] for sid in c["tied"])
                    for p in out
                )
                and e["steamid64"] in c["tied"]
            ))([p for p in c["players"] if p["steamid64"] not in c["tied"]])
        ),
    },
]

# Inputs BOTH runtimes must REFUSE. Same doctrine as the other three files: a refusal has no
# expected winner, but it is still shared contract and must not live in two hand-written per-language
# lists. Every row declares the `detail` it is about, and the generator asserts that the guard which
# ACTUALLY raised is the one the row names.
LADDER_REFUSALS: list[dict] = [
    {
        "why": (
            "⭐ MALFORMED IN TWO WAYS AT ONCE — a width-1 tied set whose award ALSO names a bogus "
            "secondary_stat — and therefore the ONLY row that pins VALIDATION ORDER. Story 6-4b's "
            "headline was three implementations disagreeing about order with no row malformed twice "
            "to expose it, so the gate was structurally blind. The published order puts the AWARD "
            "group before the TIED group, so this must refuse as `award`; an implementation that "
            "checked the tied set first refuses as `tied` and reddens here and nowhere else."
        ),
        "detail": "award",
        "award": _ladder_award("kills", "volume", "max", secondary="not_a_stat"),
        "tied": [S_A],
        "players": [_p(S_A, rounds=30, kills=20, ts=1000)],
    },
    {
        "why": "a secondary_stat outside the 21-key vocabulary (0023:98-103's closed set)",
        "detail": "award",
        "award": _ladder_award("kills", "volume", "max", secondary="not_a_stat"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "eff_num_key set with eff_den_key NULL — L2's HALF-CONFIGURED rung. A skip means the "
            "award declines rung 2; half a ratio means somebody edited the catalog and stopped, "
            "which is a refusal rather than a silent skip"
        ),
        "detail": "award",
        "award": _ladder_award("kills", "volume", "max", eff_num="utility_damage"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": "eff_den_key set with eff_num_key NULL — the OTHER half, so the rule is symmetric",
        "detail": "award",
        "award": _ladder_award("kills", "volume", "max", eff_den="rounds_played"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "a deciding_stat outside the vocabulary — rung 3 reads h2h[opp][deciding_stat] through "
            "the KEY's class, so membership is what makes that read decidable at all"
        ),
        "detail": "award",
        "award": _ladder_award("not_a_stat", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "an award direction outside {max, min} — Stage 2's OWN guard, PROPAGATED rather than "
            "swallowed, because resolve_ladder is a public entry point Story 6.6 drives directly "
            "over a REDUCED set with no preceding Stage-2 call to have checked it"
        ),
        "detail": "stage2",
        "award": _ladder_award("kills", "volume", "highest"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": "a tied set of width 1 — L11: Stage 2 never produces one, so the caller is broken",
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A],
        "players": [_p(S_A, rounds=30, kills=20, ts=1000)],
    },
    {
        "why": "a tied set of width 0 — the same rule at its other edge",
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [],
        "players": [_p(S_A, rounds=30, kills=20, ts=1000)],
    },
    {
        "why": "a DUPLICATE steamid64 in the tied set — a tie holds each player at most once",
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_A],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "the tied set is NOT in byte-lex order — Stage 2 produces it sorted (0024:732's "
            "`collate \"C\"`) and rung 5 must RETURN that order, so sorting it here would hide a "
            "caller that had reordered it and the shared set's published order would depend on the "
            "caller"
        ),
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_B, S_A],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": "a tied member with NO matching snapshot row — the ladder cannot read a player it was not given",
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [_p(S_A, rounds=30, kills=20, ts=1000)],
    },
    {
        "why": (
            "the secondary_stat names a vocabulary key that is ABSENT from the player's `secondary` "
            "block — an absent key is a refusal, never a zero, because a zero would silently become "
            "a real comparison (0024:918-923)"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max", secondary="blind_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "an h2h block that HAS the opponent but is MISSING the deciding stat key — distinct "
            "from a never-met SKIP: 0024 writes all 21 keys into every block it writes at all, so a "
            "present-but-partial block is a corrupt row"
        ),
        "detail": "player",
        "award": _ladder_award("deaths", "volume", "min"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"deaths": 10},
               h2h={S_B: {"deaths": 2}}, drop_h2h_keys=("deaths",), ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"deaths": 10}, h2h={S_A: {"deaths": 8}}, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ the `secondary` block carries a {num,den} PAIR under a VOLUME key — L5's class check, "
            "which Story 6.5's mutation pass measured as guarding a state NO ROW EXERCISED. A real "
            "snapshot cannot produce it (0024 derives the block from `volume || rate`), so without "
            "this row the guard could be deleted with every gate green — and deleting it is exactly "
            "what an implementation that branched on `award.class` instead of the KEY's class would "
            "effectively do"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9},
               secondary_force={"hs_kills": (9, 20)}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ a NEGATIVE VOLUME magnitude in the `secondary` block — every volume stat is a COUNT, "
            "and a negative one silently inverts the comparison rather than failing, so the ladder "
            "would return a plausible, WRONG survivor with nothing red anywhere. The same guard "
            "Stage 2 carries on the DECIDING value (`_deciding_value`), applied to the three blocks "
            "Stage 2 never touches. ⚠ Unreachable from a real 0024 snapshot (every one of these is "
            "a `coalesce`d count) — which is exactly why it needs a row: the Groups-2/3 code review "
            "found this guard present in Go and TypeScript and ABSENT from this generator, so the "
            "anchor RESOLVED an input both runtimes REFUSED"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max", secondary="hs_kills"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9},
               secondary_force={"hs_kills": -5}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ a NEGATIVE HALF in a RATE `secondary` — the denominator case, which is the one that "
            "matters: `p.num*q.den > q.num*p.den` is the right test only while both denominators are "
            "non-negative, and with one negative the inequality flips for that pair ALONE. A zero "
            "denominator stays LEGAL (S3, inherited verbatim); only a negative is refused"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max", secondary="hs_pct"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"hs_kills": 9}, rate={"hs_pct": (9, 20)},
               secondary_force={"hs_pct": (9, -20)}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"hs_kills": 4}, rate={"hs_pct": (4, 20)}, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ a NEGATIVE HALF in the EFFICIENCY block — it matters MORE at rung 2 than at rung 1, "
            "because rung 2 multiplies FOUR halves together, so one negative flips the sense of the "
            "whole four-term product and makes the `beats` relation CYCLIC rather than merely wrong. "
            "A cyclic relation is what lets `_best_survivors` return the EMPTY set, which reaches "
            "rung 5 as a SHARED trophy awarded to NOBODY — the reason the empty-best-set refusal "
            "exists, and the reason this row does"
        ),
        "detail": "player",
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 300},
               efficiency_force={"utility_damage": (300, -1)}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"utility_damage": 400}, ts=2000),
        ],
    },
    {
        "why": (
            "an achievement_ts BELOW the published absent sentinel -1 — 0024:706 makes the column "
            "NEVER NULL, so anything under the sentinel is a corrupt snapshot"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=-2),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "an OMITTED achievement_ts — a SCALAR, not a container, so the 'absent is the empty "
            "case' rule does not apply: Go's nil *big.Int read as 0 would be an epoch of 1970 and "
            "would win rung 4 outright"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "omit_achievement_ts": [S_A],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    # ── APPENDED BY STORY 6-5b ─────────────────────────────────────────────────────────────────
    #
    # ⛔ NOT ONE OF THESE ADDS A GUARD. Every one of them is a row for a guard that is ALREADY LIVE
    # in all three implementations and was reachable by NO row — which is the same hole 6-4a measured
    # ("the gate can only assert *some* error") arriving one level down, at "the gate cannot assert
    # this guard exists at all".
    {
        "why": (
            "⭐ A DUPLICATE steamid64 in `players` — a snapshot holds ONE ROW PER PLAYER. This guard "
            "is live in all three implementations and had NO ROW ANYWHERE, so it was deletable in "
            "every one of them with `--check` OK and both suites green. It matters because the index "
            "it protects is what every rung reads through: a second row for the same player silently "
            "SHADOWS the first, so which of two contradictory stat blocks decides the award would "
            "depend on iteration order"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
            _p(S_A, rounds=30, kills=99, ts=3000),
        ],
    },
    {
        "why": (
            "⭐⭐ MALFORMED ACROSS THE `player`/`tied` BOUNDARY, AND IT IS THE ROW THAT CORRECTED THE "
            "PUBLISHED SPEC. `players` carries a DUPLICATE row for A *and* the tied member B has no "
            "row at all. The old four-group spec put the whole `tied` group before the whole "
            "`player` group, so it predicted `tied`; all three implementations refuse `player`, "
            "because the duplicate scan is part of BUILDING the index that the membership check then "
            "READS — it cannot run after it. Cuatro's call at the Groups-2/3 review was AMEND THE "
            "PUBLISHED SPEC, DO NOT MOVE THE CODE, so the spec string now publishes six alternating "
            "groups and this row is what holds it to them"
        ),
        "detail": "player",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_A, rounds=30, kills=99, ts=3000),
        ],
    },
    {
        "why": (
            "⭐ MALFORMED ACROSS THE `stage2`/`award` BOUNDARY — an award direction outside {max, min} "
            "(the Stage-2 surface) whose `secondary_stat` is ALSO outside the 21-key vocabulary (the "
            "ladder's own surface). The published order runs the Stage-2 surface FIRST, so this must "
            "refuse `stage2`; an implementation that checked its own award group first refuses "
            "`award` and reddens here and nowhere else. Before this row the two groups were adjacent "
            "and unpinned"
        ),
        "detail": "stage2",
        "award": _ladder_award("kills", "volume", "highest", secondary="not_a_stat"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ MALFORMED ACROSS THE `tied`/`player` BOUNDARY — the tied set is out of byte-lex order "
            "(the tied group) AND a tied player's achievement_ts is below the published sentinel "
            "(the last player group). The tied set's own SHAPE is validated before any player row is "
            "read, so this must refuse `tied`; an implementation that walked the players first "
            "refuses `player`. The two groups were adjacent and unpinned"
        ),
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_B, S_A],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=-2),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ MALFORMED THREE TIMES INSIDE THE `tied` GROUP — `2x` is not a decimal string, it "
            "appears TWICE, and it sorts BEFORE the entry preceding it. All three implementations "
            "check id-shape, then duplicate, then order, and refuse the first. ⚠ STATED PLAINLY: the "
            "`detail` alone CANNOT discriminate these three, because all three are `tied` by "
            "construction — a closed set of five labels has nothing finer to say. What this row DOES "
            "pin is that all three implementations REFUSE this input as `tied` rather than one of "
            "them resolving it, sorting it, or landing in a neighbouring group. The intra-group "
            "ORDER remains unobservable from a vector row, and that is a property of the contract "
            "rather than a gap in it"
        ),
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_B, "2x", "2x"],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ AN EFFICIENCY KEY ABSENT FROM THE PLAYER'S BLOCK — `efficiency_pair`'s absent-key "
            "refusal, which is live in all three implementations and had no row in any of them. "
            "`mvps` is a perfectly legal vocabulary key (so the AWARD group passes) that this "
            "fixture never materialises, and an absent key is a REFUSAL, never a zero: read as zero "
            "it would make the rung-2 numerator 0 for everyone and silently tie the whole field"
        ),
        "detail": "player",
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="mvps", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "⭐ AN EFFICIENCY ENTRY THAT IS NOT A {num, den} PAIR — `efficiency_pair`'s "
            "incomplete-pair refusal, live in all three implementations and unreachable from every "
            "committed row because the renderer could not WRITE the shape. `snapshot_efficiency_form` "
            "gives EVERY key that shape (a volume `v` as {v, 1}), so a bare magnitude here means the "
            "producer skipped the one definition site — and rung 2 multiplies four halves, so a "
            "missing half is not a smaller number, it is no comparison at all"
        ),
        "detail": "player",
        "award": _ladder_award(
            "kills", "volume", "max", eff_num="utility_damage", eff_den="rounds_played"
        ),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, vol={"utility_damage": 300},
               efficiency_force={"utility_damage": 300}, ts=1000),
            _p(S_B, rounds=30, kills=20, vol={"utility_damage": 400}, ts=2000),
        ],
    },
    {
        "why": (
            "an award CLASS outside {volume, rate} — the Stage-2 surface's second clause, propagated "
            "as `stage2`. ⭐ Added because TypeScript TRANSCRIBES `validateAward` instead of calling "
            "it (`ladder.ts`'s stated trade), and only ONE of the four transcribed clauses had a row "
            "— so three of them could drift from `stage2.ts` with every gate green. All four now "
            "have one"
        ),
        "detail": "stage2",
        "award": _ladder_award("kills", "speed", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "a NEGATIVE floor_rounds — the Stage-2 surface's fourth clause (0023's "
            "`award_floors_non_negative`), propagated as `stage2`. ⚠ The ladder never APPLIES a "
            "floor (L12), and that is exactly why the clause needs a row: a validation the resolver "
            "does not otherwise use is the easiest kind to delete by accident"
        ),
        "detail": "stage2",
        "award": _ladder_award("kills", "volume", "max", floor_rounds=-1),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    {
        "why": (
            "an EMPTY deciding_stat — the Stage-2 surface's first clause, propagated as `stage2`. It "
            "must refuse HERE rather than at the ladder's own vocabulary check one group later, "
            "because `\"\"` is also how Go spells an ABSENT rung key: an implementation that reached "
            "the vocabulary check first would report the same input as `award`"
        ),
        "detail": "stage2",
        "award": _ladder_award("", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
    # ── Added at the Story 6-5b CODE REVIEW (2026-08-06). ─────────────────────────────────────────
    {
        "why": (
            "⭐⭐ MALFORMED ACROSS THE MEMBERSHIP BOUNDARY — GROUPS 5 AND 6, the last adjacent pair "
            "left unpinned after this story pinned 1↔2, 2↔3, 3↔6 and 4↔5. The tied member B has NO "
            "snapshot row (group 5, `tied`) and the row that IS present carries an achievement_ts "
            "of -2, below the published sentinel (group 6, `player`). Membership is checked before "
            "any timestamp is read, so this must refuse `tied`. ⛔ THIS IS THE ONE BOUNDARY WHOSE "
            "WRONG ORDER IS NOT A MISLABELLED REFUSAL BUT AN UNHANDLED FAULT. Every other "
            "doubly-malformed row here distinguishes two LABELS; this one distinguishes a refusal "
            "from a CRASH. An implementation that validated timestamps before membership walks "
            "`tied` and dereferences the index entry for B, which does not exist — a nil-pointer "
            "panic in Go and a raw `TypeError` rather than a typed `LadderError` in TypeScript. "
            "Neither is a refusal any caller can handle, and 6.6 drives this entry point directly"
        ),
        "detail": "tied",
        "award": _ladder_award("kills", "volume", "max"),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=-2),
        ],
    },
    {
        "why": (
            "a NEGATIVE floor_kills — the OTHER half of the Stage-2 surface's fourth clause, whose "
            "`floor_rounds` half already had a row. ⚠ STATED PLAINLY, because the clause is a "
            "conjunction and only PART of it is row-representable: the clause also rejects "
            "NON-INTEGER floors, and a JSON `1.5` is NOT expressible here — both loaders type the "
            "field as an integer, so a fractional value fails to parse before any ladder code runs "
            "and the row would pin the JSON decoder rather than the guard. The sign half is "
            "representable and is now pinned on both fields; the integrality half is unreachable "
            "from a vector row, exactly like the intra-`tied` ordering above"
        ),
        "detail": "stage2",
        "award": _ladder_award("kills", "volume", "max", floor_kills=-1),
        "tied": [S_A, S_B],
        "players": [
            _p(S_A, rounds=30, kills=20, ts=1000),
            _p(S_B, rounds=30, kills=20, ts=2000),
        ],
    },
]


def _render_class_shaped(block: dict) -> dict:
    """A class-shaped block: a volume key as a decimal STRING, a rate key as {num, den} strings."""
    out: dict = {}
    for key in sorted(block):
        value = block[key]
        if isinstance(value, tuple):
            out[key] = {"num": str(value[0]), "den": str(value[1])}
        else:
            out[key] = str(value)
    return out


def _render_ladder_player(p: dict, *, omit_ts: bool = False, omit_blocks: tuple = ()) -> dict:
    """One snapshot row with all four FR-29 blocks.

    ⚠ EVERY SNAPSHOT MAGNITUDE IS A DECIMAL STRING, `achievement_ts` INCLUDED. The split is by
    PROVENANCE and not by magnitude (README.md:197-202): `achievement_ts` is epoch-MILLISECONDS and
    sits comfortably inside 2^53 today, but it comes from the snapshot, so it travels as a string
    like every other snapshot value. `ladder_exit_step` and the floors come from the algorithm and
    the catalog's bounded `int` columns and stay JSON integers.

    ⭐ `efficiency` IS RENDERED BY THE SAME CLASS-SHAPED RENDERER `secondary` AND `h2h` USE, added by
    Story 6-5b. Every real efficiency entry is a `{num, den}` pair (`snapshot_efficiency_form` gives
    a volume `v` the pair `{v, 1}`), so on every honest row this emits exactly what the hand-written
    dict comprehension emitted — the regeneration proves it. What it BUYS is that an
    `efficiency_force`d NON-PAIR can be written at all: `efficiency_pair`'s "incomplete {num,den}
    pair" refusal exists in all three implementations and had NO ROW anywhere, because the old
    renderer would have raised on `v[0]` before it could emit one. A bare decimal string is the
    shape both loaders read as "not a pair", which is the state the guard is about.

    ⭐ `omit_blocks` OMITS A WHOLE BLOCK FROM THE JSON, which is the ABSENT-CONTAINER rule's only
    ladder-side row. `stage1-pick.json` treats an absent container as load-bearing and this file did
    not: every row emitted all three blocks, so `container(undefined)` in TypeScript and Go's nil-map
    read were entered by NOTHING. An absent container is the EMPTY container (Cuatro, 2026-08-04) —
    Go cannot tell a nil map from an empty one, so the other two runtimes must agree.
    """
    row = _render_player(p)
    row["stats_int"]["secondary"] = _render_class_shaped(p["stats_int"]["secondary"])
    row["stats_int"]["efficiency"] = _render_class_shaped(p["stats_int"]["efficiency"])
    row["h2h"] = {
        opp: _render_class_shaped(block) for opp, block in sorted(p["h2h"].items())
    }
    for block in omit_blocks:
        if block == "h2h":
            row.pop("h2h", None)
        else:
            row["stats_int"].pop(block, None)
    if not omit_ts:
        row["achievement_ts"] = str(p["achievement_ts"])
    return row


def _render_ladder_award(award: dict, *, omit_rung_keys: bool = False) -> dict:
    out = dict(award)
    if omit_rung_keys:
        for field in ("secondary_stat", "eff_num_key", "eff_den_key"):
            out.pop(field, None)
    return out


LADDER_OMITTABLE_BLOCKS = ("secondary", "efficiency", "h2h")


def _ladder_players(c: dict) -> list:
    """The case's players AS THE CONSUMERS WILL RECEIVE THEM — `omit_blocks` already applied.

    ⭐⭐ THE ANCHOR MUST RESOLVE THE INPUT IT PUBLISHES, NOT THE ONE IT HELD IN MEMORY. Added at the
    Story 6-5b code review, which found `expected` being computed from the FULL in-memory fixture
    while `omit_blocks` stripped the blocks on the way into the JSON — so the implementation this
    directory calls "the one that arbitrates disagreements" was resolving a DIFFERENT input than Go
    and TypeScript consume, on the one row whose entire subject is the absent-container rule.

    It happened to be harmless: that row's award configures no rung key, so rungs 1 and 2 skip and
    the omitted blocks are never read — which is exactly why nothing caught it. Set a
    `secondary_stat` on it and Python would have resolved rung 1 from the in-memory block and
    emitted `winner/1` while both runtimes read an absent block and refused `player`, committing an
    `expected` no consumer could reproduce with `--check` clean. That is DECISION C's failure mode
    (a three-way divergence reachable in one careless edit) arriving through the renderer instead of
    through a patch.
    """
    omit = c.get("omit_blocks", {})
    if not omit:
        return c["players"]
    known = {p["steamid64"] for p in c["players"]}
    for sid, blocks in omit.items():
        # ⛔ A TYPO'D BLOCK NAME OMITS NOTHING AND THE OLD GUARD READ THE DECLARATION, so
        # `omit_blocks={S_A: ("secondry",)}` would have left the row fully populated and every gate
        # green. Both the id and each block name are checked against the closed set here.
        if sid not in known:
            raise SystemExit(f"omit_blocks names {sid!r}, which is not a player in this case")
        for block in blocks:
            if block not in LADDER_OMITTABLE_BLOCKS:
                raise SystemExit(
                    f"omit_blocks names {block!r}; the omittable blocks are "
                    f"{LADDER_OMITTABLE_BLOCKS}"
                )
    out = []
    for p in c["players"]:
        blocks = omit.get(p["steamid64"], ())
        if not blocks:
            out.append(p)
            continue
        # Mirrors `_render_ladder_player`'s omission EXACTLY — `h2h` is a top-level key and the
        # other two live under `stats_int`. Copied rather than mutated: `LADDER_CASES` is module
        # state and a later case reading a stripped fixture would be a silent cross-row dependency.
        q = dict(p)
        q["stats_int"] = dict(p["stats_int"])
        for block in blocks:
            if block == "h2h":
                q.pop("h2h", None)
            else:
                q["stats_int"].pop(block, None)
        out.append(q)
    return out


def build_ladder_file() -> dict:
    cases = []
    for c in LADDER_CASES:
        expected = resolve_ladder(c["award"], c["tied"], _ladder_players(c))
        # ⭐ THE ANCHOR GUARDS ITS OWN CASES, exactly as `build_stage1_file` does. Every row declares
        # as EXECUTABLE CODE the property it was chosen for, so an edit that turned the file's most
        # valuable row into an ordinary one fails here rather than passing every gate.
        if not c["pins"](expected):
            raise SystemExit(
                f"ladder case {c['name']!r} no longer exhibits the property it was chosen for: "
                f"{expected!r}"
            )
        # ⭐ AND THE SECOND HALF: `pins` sees only the OUTPUT, and the recurring finding across 6-4a
        # and 6-4b is a coverage guard satisfied by a row unrelated to the property it names.
        # `pins_inputs` re-derives the INPUT property — that a -1 is genuinely present and does not
        # win, that no player beats all, that the naive rung-2 compare really does disagree.
        if "pins_inputs" in c and not c["pins_inputs"](expected, c):
            raise SystemExit(
                f"ladder case {c['name']!r} no longer exhibits the INPUT property it was chosen "
                "for — its fixture has drifted and the row no longer tests what its name claims"
            )
        rendered = [
            _render_ladder_player(
                p, omit_blocks=c.get("omit_blocks", {}).get(p["steamid64"], ())
            )
            for p in c["players"]
        ]
        # ⭐ GUARD THE GUARD, ON THE EMITTED BYTES RATHER THAN ON THE DIRECTIVE. The row's own
        # `pins_inputs` can only see `omit_blocks`, which is a construction instruction — if
        # `_render_ladder_player` ever stopped honouring it, the guard would stay green over a row
        # that now emits all three blocks and the absent-container rule would be unexercised again.
        # This asserts the property on the OUTPUT: every declared omission is genuinely absent from
        # the JSON, and every block NOT declared is genuinely present.
        by_sid = {r["steamid64"]: r for r in rendered}
        for sid, blocks in c.get("omit_blocks", {}).items():
            row = by_sid[sid]
            for block in LADDER_OMITTABLE_BLOCKS:
                present = block in row if block == "h2h" else block in row["stats_int"]
                if present == (block in blocks):
                    raise SystemExit(
                        f"ladder case {c['name']!r}: block {block!r} on {sid} is "
                        f"{'present' if present else 'absent'} in the rendered row but "
                        f"{'omitted' if block in blocks else 'kept'} by `omit_blocks` — the "
                        "renderer and the declaration disagree"
                    )
        cases.append(
            {
                "name": c["name"],
                "note": c["note"],
                "award": _render_ladder_award(
                    c["award"], omit_rung_keys=c.get("omit_rung_keys", False)
                ),
                "tied": c["tied"],
                "players": rendered,
                "expected": expected,
            }
        )

    # ⭐ THE THREE SPELLINGS OF ABSENCE MUST PRODUCE BYTE-IDENTICAL EXPECTED BLOCKS, and that
    # identity IS the assertion. Checked here rather than only in the two suites, because it is the
    # property that lets `stage2-resolve.json` — whose award objects carry none of the three keys —
    # regenerate unchanged.
    spelling_names = (
        "rung-keys-spelled-as-explicit-JSON-null",
        "rung-keys-OMITTED-from-the-award-object-entirely",
        "rung-keys-spelled-as-EMPTY-STRINGS",
    )
    spellings = [c for c in cases if c["name"] in spelling_names]
    if len(spellings) != 3 or any(c["expected"] != spellings[0]["expected"] for c in spellings):
        raise SystemExit(
            "the three spellings of an absent rung key no longer agree — `null`, an omitted key and "
            f"an empty string must be indistinguishable: {[c['expected'] for c in spellings]!r}"
        )
    # ⭐ GUARD THE GUARD, AND MAKE IT INDEPENDENTLY FALSIFIABLE. The identity check above CANNOT FAIL
    # while the three rows' own `pins` hold — each already asserts the exact expected block, so the
    # comparison is a restatement of three assertions that ran a moment earlier. What it does NOT
    # check, and what the whole row set is for, is that the three rows still spell absence THREE
    # DIFFERENT WAYS: an edit that made all three carry `null` leaves every `pins` green, leaves the
    # identity green, and silently deletes the loader rule from the file. (Story 6-5b; the same
    # clause both suites already carry separately, brought into the anchor so the arbitrating
    # implementation enforces it too.)
    written = {c["name"]: c["award"] for c in spellings}
    explicit_null = written[spelling_names[0]]
    omitted = written[spelling_names[1]]
    empty = written[spelling_names[2]]
    rung_fields = ("secondary_stat", "eff_num_key", "eff_den_key")
    if (
        any(explicit_null.get(f, "sentinel") is not None for f in rung_fields)
        or any(f in omitted for f in rung_fields)
        or any(empty.get(f, "sentinel") != "" for f in rung_fields)
    ):
        raise SystemExit(
            "the three absence rows no longer spell absence three DIFFERENT ways — the identity "
            "check above is satisfied by three identical rows and would prove nothing: "
            f"{written!r}"
        )

    refusals = []
    for r in LADDER_REFUSALS:
        omit_ts = set(r.get("omit_achievement_ts", ()))
        players = [
            {**p, "achievement_ts": None} if p["steamid64"] in omit_ts else p
            for p in r["players"]
        ]
        try:
            got = resolve_ladder(r["award"], r["tied"], players)
        except LadderRefusal as err:
            detail = err.detail
        else:
            raise SystemExit(f"ladder refusal row {r['why']!r} did NOT refuse — it returned {got!r}")
        if detail != r["detail"]:
            raise SystemExit(
                f"ladder refusal row {r['why']!r} refused on {detail!r}, declared {r['detail']!r}"
            )
        # ⛔ THE NARROWER SET: a row is a set of INPUTS, so it can never legitimately land on
        # `internal` — rung 3's antisymmetric comparator makes a plural dominator unreachable from
        # any input at all. A row that got there is not testing what it claims.
        if detail not in ROW_REPRESENTABLE_LADDER_DETAILS:
            raise SystemExit(
                f"ladder refusal row {r['why']!r} used a detail no row can represent: {detail!r}"
            )
        refusals.append(
            {
                "why": r["why"],
                "detail": r["detail"],
                "award": _render_ladder_award(r["award"]),
                "tied": r["tied"],
                "players": [
                    _render_ladder_player(p, omit_ts=p["steamid64"] in omit_ts)
                    for p in r["players"]
                ],
            }
        )

    return {
        "vector": "ladder-resolve",
        "algo_version": ALGO_VERSION,
        "spec": (
            "the FR-29 tie ladder draws ZERO stream bytes and takes no stream in any runtime. "
            "VALIDATION ORDER, which is contract, and it is SIX groups whose details ALTERNATE: "
            "(1) the award's Stage-2 surface, propagated as detail `stage2`; (2) the ladder's own "
            "award surface as detail `award` — deciding_stat and every non-absent rung key must be "
            "one of the 21 vocabulary keys, and eff_num_key and eff_den_key are BOTH-OR-NEITHER; "
            "(3) the tied set's OWN SHAPE as detail `tied` — width >= 2, every id a decimal "
            "string, no duplicate, strictly ascending byte-lex, reading nothing from players; "
            "(4) BUILDING THE PLAYER INDEX as detail `player` — a duplicate steamid64 in players "
            "is refused here, and this group runs BEFORE the membership check below because the "
            "membership check reads the index this one builds; (5) MEMBERSHIP as detail `tied` — "
            "every tied member has a matching snapshot row; (6) every "
            "TIED player's achievement_ts as detail `player` — an integer >= -1, never absent. A "
            "rung key is ABSENT when it is null, omitted or the empty string, and an absent key is "
            "a deterministic SKIP, never a refusal and never a zero. Then, over survivors that each "
            "rung NARROWS (never over the original tied set): RUNG 1, if secondary_stat is present, "
            "best(survivors) on stats_int.secondary[secondary_stat] — a bare integer for a volume "
            "key and a {num,den} pair for a rate key, branched on the KEY's class and never on "
            "award.class; RUNG 2, if both efficiency keys are present, best(survivors) on the ratio "
            "{num: eff[num_key].num * eff[den_key].den, den: eff[num_key].den * eff[den_key].num} "
            "where eff[k] is uniformly {num,den} and a volume v is {v,1}; RUNG 3, the STRICT "
            "dominator over the remaining set — p wins iff for every other remaining q both "
            "h2h[p][q] and h2h[q][p] EXIST and p's deciding value beats q's, an absent opponent key "
            "meaning never-met and disqualifying p rather than reading as zero, |D| == 0 SKIPPING "
            "without eliminating anyone and |D| > 1 being an internal refusal; RUNG 4, the EARLIEST "
            "achievement_ts among survivors whose value is not the absent sentinel -1, never "
            "inverted by direction, skipping entirely when every survivor is absent; RUNG 5, "
            "TERMINAL: the full surviving set in byte-lex order as a SHARED outcome. best(S) is the "
            "SET of survivors nobody beats; beats is cmp > 0 for direction max and cmp < 0 for min; "
            "cmp is sign(a - b) for a volume value and sign(a.num*b.den - b.num*a.den) for a rate "
            "value, with a zero denominator kept total exactly as Stage 2 keeps it. direction "
            "inverts rungs 1, 2 and 3 and NEVER rung 4. A resolved award carries "
            "ladder_exit_step 1..4 with its winner, or 5 with its shared winners; it carries no "
            "deciding_value, because the tie it resolves carries none and the ladder never "
            "re-derives one"
        ),
        "value_encoding": (
            "Every SNAPSHOT magnitude is a DECIMAL STRING — steamid64, rounds_played, kills, every "
            "stats_int entry across all four blocks, every h2h value and achievement_ts — because "
            "AD-19 makes them unbounded integers and JSON.parse silently rounds anything past 2^53: "
            "the rung-2 four-term-product case is corrupted at PARSE time if written as a JSON "
            "number. achievement_ts is epoch-MILLISECONDS and sits well inside 2^53 today, and it "
            "is still a string, because the rule is PROVENANCE and not magnitude. Every AWARD field "
            "and ladder_exit_step stay JSON integers/strings from the catalog and the algorithm."
        ),
        "generated_by": GENERATED_BY,
        "exit_steps": [1, 2, 3, 4, 5],
        # ⭐ THE 17/4 VOCABULARY SPLIT TRAVELS IN THE VECTOR, and it is not decoration. Rung 1 must
        # derive a key's CLASS from the key itself (L5), and `worker/awards` is a LEAF that cannot
        # read 0023's CHECK — so both runtimes necessarily restate the split in source. That would
        # make FOUR restatements (0023's CHECKs, `award_stat_vocabulary()`, the two runtimes) with
        # nothing tying them together, which is precisely the drift `refusal_details` exists to
        # prevent one level up. Both suites pin their own constant against this list by exact
        # equality, so a key added on one side alone reddens.
        "stat_vocabulary": {
            "volume": list(VOLUME_STAT_KEYS),
            "rate": list(RATE_STAT_KEYS),
        },
        "absent_achievement_ts": str(ABSENT_TS),
        "refusal_details": list(LADDER_REFUSAL_DETAILS),
        "refusals": refusals,
        "cases": cases,
    }


# ── rendering ─────────────────────────────────────────────────────────────────


def build_block_file() -> dict:
    cases = []
    for c in BLOCK_CASES:
        label = label_from_source(c["src"])
        seed = decode_seed(c["seed"])
        cases.append(
            {
                "name": c["name"],
                "seed_hex": c["seed"],
                "label": label,
                "label_source": c["src"],
                "i": c["i"],
                "msg_hex": block_msg(label, c["i"]).hex(),
                "block_hex": block(seed, label, c["i"]).hex(),
            }
        )
    return {
        "vector": "prng-block",
        "algo_version": ALGO_VERSION,
        "spec": "block_i(label) = HMAC_SHA256(key = seed (raw 32 bytes), msg = utf8(label) || LE64(i))",
        "generated_by": GENERATED_BY,
        "invalid_seed_hex": INVALID_SEED_HEX,
        "invalid_stage1_spin": INVALID_STAGE1_SPIN,
        "cases": cases,
    }


def build_uniform_file() -> dict:
    cases = []
    for c in UNIFORM_CASES:
        label = label_from_source(c["src"])
        stream = Stream(decode_seed(c["seed"]), label)
        draws = []
        for n in c["ns"]:
            result = uniform_int(stream, n)
            draws.append({"n": n, "result": result, "bytes_consumed_after": stream.pos})
        cases.append(
            {
                "name": c["name"],
                "seed_hex": c["seed"],
                "label": label,
                "label_source": c["src"],
                "note": c["note"],
                "draws": draws,
            }
        )
    return {
        "vector": "prng-uniform-int",
        "algo_version": ALGO_VERSION,
        "spec": (
            "k = minimal int with 256^k >= n (n=1 -> k=0); limit = 256^k - (256^k mod n); x = big-endian "
            "of the next k stream bytes, CONSUMED; while x >= limit draw k fresh bytes; return x mod n"
        ),
        "n_bounds": {"min": N_MIN, "max": N_MAX},
        "generated_by": GENERATED_BY,
        "cases": cases,
    }


def render(obj: dict) -> str:
    """2-space indent, LF newlines, trailing newline — data, not code."""
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="verify committed files match; write nothing")
    args = ap.parse_args()

    outputs = {
        HERE / "prng-block.json": render(build_block_file()),
        HERE / "prng-uniform-int.json": render(build_uniform_file()),
        HERE / "stage2-resolve.json": render(build_stage2_file()),
        HERE / "stage1-pick.json": render(build_stage1_file()),
        HERE / "ladder-resolve.json": render(build_ladder_file()),
    }

    if args.check:
        drift = 0
        for path, want in outputs.items():
            # ⛔ COMPARED AS BYTES, not as text. `read_text` opens with universal newlines and
            # silently translates CRLF to LF on read, while the write path pins newline="\n" —
            # so on this Windows repo a checkout (or an editor) that rewrote a vector to CRLF
            # compared EQUAL and `--check` printed OK. That is the same CRLF round-trip that
            # silently unapplied 12 Go mutation anchors during this story's Task 6. "Regenerate
            # and byte-compare" now actually compares bytes.
            have = path.read_bytes() if path.exists() else b""
            status = "OK  " if have == want.encode("utf-8") else "DRIFT"
            if have != want.encode("utf-8"):
                drift += 1
            print(f"{status} {path.name}")
        if drift:
            print(f"\n{drift} file(s) differ from what the generator produces.", file=sys.stderr)
        return 1 if drift else 0

    for path, text in outputs.items():
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
