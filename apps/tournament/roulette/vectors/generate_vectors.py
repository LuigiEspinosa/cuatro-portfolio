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
)

# ⚠ THE LAST TWO ARE DECLARED BUT NOT ROW-REPRESENTABLE, and the distinction is the point. A row
# is a set of INPUTS; "no stream was supplied" and "an invariant broke" are not inputs, so no row
# can produce them — but both are reachable in both runtimes, which made a "closed set" that was
# not closed. The 6-4b code review found all three ways that went wrong: Go declared nine while
# TypeScript and this file declared seven, TypeScript threw 'stream'/'internal' anyway while its
# own JSDoc promised one of the seven, and the unreachable unknown-outcome arm refused as
# `internal` in Go and `stage2` in TypeScript — one input, two values, in the field this file
# calls shared contract. All three now declare the same nine; `refusal_details` carries all nine
# so the suites can pin the set; and a ROW may still only carry these seven.
ROW_REPRESENTABLE_DETAILS = REFUSAL_DETAILS[:7]


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


def stage1_weight(award: dict, players: list, shelf: dict, table: list) -> int:
    """The integer weight of ONE candidate — DECISION F lives here.

    `provisional_winner` is Stage 2's RAW outcome (`resolve_stage2`), never `resolve_award`:
    the refusing ladder would turn a tie into an error this function cannot inspect, and Stage
    1 must SEE the tie in order to refuse for the right reason.
    """
    try:
        out = resolve_stage2(award, players)
    except Stage2Refusal as err:
        # A Stage-2 refusal PROPAGATES rather than being swallowed into a weight — and it is
        # re-labelled `stage2` so both runtimes report WHERE it came from. Treating an
        # unresolvable award as a zero, or as the heaviest weight, would let a malformed catalog
        # draw a whole ceremony.
        raise Stage1Refusal("stage2", str(err)) from err
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


def stage1_weights(candidates: list, players: list, shelf: dict, table: list):
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
    return ordered, [stage1_weight(c["award"], players, shelf, table) for c in ordered]


def stage1_pick(stream: Stream, candidates: list, players: list, shelf: dict, table: list, live_count: int) -> dict:
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
    ordered, weights = stage1_weights(candidates, players, shelf, table)

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
            stream, c["candidates"], c["players"], c["shelf"], c["table"], c["live_count"]
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
        cases.append(
            {
                **row,
                "live_count": c["live_count"],
                "candidates": [_render_candidate(x) for x in c["candidates"]],
                "players": [_render_player(p) for p in c["players"]],
                "expected": expected,
            }
        )

    refusals = []
    for r in STAGE1_REFUSALS:
        label = label_from_source(r["src"])
        stream = Stream(decode_seed(REAL_SEED), label)
        try:
            got = stage1_pick(
                stream, r["candidates"], r["players"], r["shelf"], r["table"], r["live_count"]
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
        refusals.append(
            {
                "why": r["why"],
                "refusal_kind": r["refusal_kind"],
                "detail": r["detail"],
                "seed_hex": REAL_SEED,
                "label": label,
                "label_source": r["src"],
                "weight_table": r["table"],
                "shelf": {k: r["shelf"][k] for k in sorted(r["shelf"])},
                "live_count": r["live_count"],
                "candidates": [_render_candidate(x) for x in r["candidates"]],
                "players": [_render_player(p) for p in r["players"]],
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
        "refusal_details": list(REFUSAL_DETAILS),
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
