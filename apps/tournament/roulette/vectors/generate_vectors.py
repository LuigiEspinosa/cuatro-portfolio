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

Usage:  python roulette/vectors/generate_vectors.py          # writes all three JSON files
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
    if award["class"] == "volume":
        return (a > b) - (a < b)
    an, ad = a
    bn, bd = b
    left, right = an * bd, bn * ad
    return (left > right) - (left < right)


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


def _p(sid, *, rounds, kills, idle=False, vol=None, rate=None, drop_volume=(), drop_rate=()):
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

    return {
        "steamid64": sid,
        "rounds_played": rounds,
        "kills": kills,
        "idle_dq": idle,
        "stats_int": {"volume": volume, "rate": rates},
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
        "outcome_kinds": ["winner", "tie", "no_eligible_players", "no_awardable_value"],
        "tie_reasons": ["equal_value", "equal_cross_product"],
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
