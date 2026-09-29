"""Independent re-derivation of Stage 2 (deterministic winner) and the FR-29
award-tie ladder, written from specification text only, for a cross-language
conformance audit.

Sources read (and ONLY these):
  - SOLUTION-DESIGN.md, section 9 ("Provably-fair engine (full spec)"),
    specifically 9.1-9.3 and the "RENUMBERED BY STORY 6.11" / rung-3
    unreachability notes attached to 9.3/9.6.
  - prd.md, FR-21 (anti-farm thresholds & AFK/idle DQ), FR-25 (two-stage
    draw), FR-26 (anti-sweep), FR-29 (award-tie ladder).
  - ARCHITECTURE-SPINE.md, AD-14 (deterministic/reproducible draw engine,
    including DECISION E) and AD-19 (the snapshot's integer-form contract),
    plus the "Provably-Fair & Verification" prose block that restates
    Stage 2 and the ladder.

No other file in the repository was opened, read, grepped, or listed while
writing this module. Anything the above documents did not settle is listed
in UNDERIVABLE below rather than guessed.
"""

UNDERIVABLE: list[str] = [
    "The exact composition rule for building the rung-2 efficiency ratio "
    "from an award's eff_num_key/eff_den_key pair (which stats_int "
    "sub-block to read, and how two separate keys combine into a single "
    "{num, den} pair) is not stated anywhere in the readable spec text -- "
    "only 'efficiency (cross-multiply)' and 'better rate/efficiency "
    "(fewer opportunities used)' appear, with no field-composition rule.",

    "The concrete integer value of the 'published absent-sentinel' for "
    "achievement_ts (AD-19: 'an integer ... with a published "
    "absent-sentinel') is never given in the readable spec text, so rung 4 "
    "cannot special-case an absent timestamp; it is compared as a plain "
    "integer like any other value.",

    "Whether FR-29 rung 1 (secondary stat) and the ratio-value half of "
    "rung 2 (efficiency) use the award's own max/min 'direction', or some "
    "independent sense of 'better', is not stated -- the spec only says "
    "'better secondary relevant stat' / 'better rate/efficiency' without "
    "defining 'better' independently of the award's declared direction.",

    "FR-21's prose ('A Player is eligible for a rate-class or comedy "
    "(\"worst\") Award only if they meet the floor...') reads as if the "
    "rounds/kills floor is scoped to rate/worst Awards specifically, "
    "leaving open whether a plain max-volume 'skill' Award is meant to "
    "carry a nonzero rounds floor at all. This is moot for this "
    "implementation because the award input already supplies resolved "
    "floor_rounds/floor_kills per award, but the general rule itself is "
    "not derivable from the read text.",

    "Whether a rate value with denominator 0 gets any special-cased "
    "comparison treatment is not stated anywhere in the readable spec "
    "(FR-21/22/29, AD-14/19, and SS9.3 all state the cross-multiply rule "
    "with no zero-denominator carve-out). This implementation applies the "
    "literal cross-multiply formula unconditionally, which has the side "
    "effect that a {num:0, den:0} pair cross-multiplies to 0 against any "
    "opponent's value and therefore compares as equal to everything under "
    "the stated formula -- the spec neither confirms nor rules out this "
    "degenerate behavior.",

    "resolve_ladder's contract for malformed/edge-case input (an empty "
    "tied set, or a tied steamid64 absent from `players`) is not addressed "
    "by the spec; ValueError is raised here as defensive hygiene, not "
    "because the spec names these as refusal cases.",
]


def _cmp_int(a: int, b: int) -> int:
    return (a > b) - (a < b)


def _cmp_rate(a: dict, b: dict) -> int:
    # SS9.3 / AD-14: "rate = cross-multiply p.num*q.den vs q.num*p.den".
    # Applied literally, with no special-casing for a zero denominator --
    # see UNDERIVABLE.
    lhs = a["num"] * b["den"]
    rhs = b["num"] * a["den"]
    return (lhs > rhs) - (lhs < rhs)


def _extract_primary(player: dict, cls: str, stat: str) -> tuple:
    if cls == "volume":
        return ("int", player["stats_int"]["volume"][stat])
    return ("frac", player["stats_int"]["rate"][stat])


def _get_secondary_value(player: dict, stat_name):
    if stat_name is None:
        return None
    block = player.get("stats_int", {}).get("secondary", {})
    vol = block.get("volume")
    if isinstance(vol, dict) and stat_name in vol:
        return ("int", vol[stat_name])
    rate = block.get("rate")
    if isinstance(rate, dict) and stat_name in rate:
        return ("frac", rate[stat_name])
    return None


def _get_efficiency_pair(player: dict, eff_num_key, eff_den_key):
    if eff_num_key is None or eff_den_key is None:
        return None
    eff = player.get("stats_int", {}).get("efficiency", {})
    if eff_num_key not in eff or eff_den_key not in eff:
        return None
    return {"num": eff[eff_num_key]["num"], "den": eff[eff_den_key]["den"]}


def _get_h2h_value(player: dict, opponent_steamid: str, cls: str, stat: str):
    h2h = player.get("h2h", {})
    block = h2h.get(opponent_steamid)
    if not isinstance(block, dict):
        return None
    sub = block.get(cls)
    if not isinstance(sub, dict) or stat not in sub:
        return None
    return sub[stat]


def _narrow_by(cands: list, players_by_id: dict, get_value_fn, direction: str):
    """Narrow `cands` to the subset achieving the best value of get_value_fn.

    Returns None if the rung does not apply at all (any candidate's value is
    missing, or the tied set mixes int/frac shapes for the same stat).
    Otherwise returns the (possibly still >1) narrowed, byte-lex sorted list.
    """
    values = {}
    for c in cands:
        v = get_value_fn(players_by_id[c])
        if v is None:
            return None
        values[c] = v

    kinds = {v[0] for v in values.values()}
    if len(kinds) != 1:
        return None
    kind = kinds.pop()
    cmp_fn = _cmp_int if kind == "int" else _cmp_rate

    best_val = None
    for c in cands:
        v = values[c][1]
        if best_val is None:
            best_val = v
        else:
            c_cmp = cmp_fn(v, best_val)
            if (direction == "max" and c_cmp > 0) or (direction == "min" and c_cmp < 0):
                best_val = v

    return sorted(c for c in cands if cmp_fn(values[c][1], best_val) == 0)


def _rung2_efficiency(cands: list, players_by_id: dict, eff_num_key, eff_den_key, direction: str):
    """FR-29 rung 2: 'better rate/efficiency (fewer opportunities used)'.

    Read as: narrow by the cross-multiplied ratio value first (per the
    award's direction); if that leaves more than one candidate, break the
    remaining tie by the parenthetical -- smaller denominator (fewer
    opportunities used) wins.
    """
    if eff_num_key is None or eff_den_key is None:
        return None

    pairs = {}
    for c in cands:
        pair = _get_efficiency_pair(players_by_id[c], eff_num_key, eff_den_key)
        if pair is None:
            return None
        pairs[c] = pair

    best_val = None
    for c in cands:
        v = pairs[c]
        if best_val is None:
            best_val = v
        else:
            c_cmp = _cmp_rate(v, best_val)
            if (direction == "max" and c_cmp > 0) or (direction == "min" and c_cmp < 0):
                best_val = v

    narrowed = sorted(c for c in cands if _cmp_rate(pairs[c], best_val) == 0)
    if len(narrowed) <= 1:
        return narrowed

    min_den = min(pairs[c]["den"] for c in narrowed)
    return sorted(c for c in narrowed if pairs[c]["den"] == min_den)


def _find_h2h_dominator(cands: list, players_by_id: dict, cls: str, stat: str, direction: str):
    """FR-29 rung 3 / SS9.3: 'head-to-head (a strict dominator over the
    remaining set, else skip)'.

    A dominator is a single candidate who, against every other remaining
    candidate, has an h2h deciding-stat value that is STRICTLY better (per
    the award's direction) than that opponent's h2h value against them --
    and both directions of that h2h pairing must be present (SS9.3 /
    FR-29: "deterministically skipped when they never met"). Domination is
    asymmetric, so at most one candidate can satisfy this.
    """
    cmp_fn = _cmp_int if cls == "volume" else _cmp_rate

    for c in cands:
        dominates_all = True
        for o in cands:
            if o == c:
                continue
            c_val = _get_h2h_value(players_by_id[c], o, cls, stat)
            o_val = _get_h2h_value(players_by_id[o], c, cls, stat)
            if c_val is None or o_val is None:
                dominates_all = False
                break
            c_cmp = cmp_fn(c_val, o_val)
            is_better = c_cmp > 0 if direction == "max" else c_cmp < 0
            if not is_better:
                dominates_all = False
                break
        if dominates_all:
            return c
    return None


def resolve_stage2(award: dict, players: list[dict]) -> dict:
    """Return the Stage-2 outcome for one award over a roster.

    Eligibility (FR-21 / SS9.3): rounds_played >= award.floor_rounds AND
    kills >= award.floor_kills AND not idle_dq. Best deciding-stat value:
    volume = integer compare; rate = cross-multiply. An equal value (or
    equal cross-product) is a tie and enters the FR-29 ladder -- never a
    silent argmax (AD-14). DECISION E (AD-14 / SS9.3): the single carve-out
    is a `max` `volume` award whose best value is 0 -- it returns
    `no_awardable_value` carrying the suppressed byte-lex tied set, and
    never reaches the ladder. `min` awards and `rate` awards tie at zero
    like any other value.
    """
    cls = award.get("class")
    direction = award.get("direction")
    deciding_stat = award.get("deciding_stat")

    if cls not in ("volume", "rate"):
        raise ValueError(f"invalid award class: {cls!r}")
    if direction not in ("max", "min"):
        raise ValueError(f"invalid award direction: {direction!r}")
    if not deciding_stat:
        raise ValueError("award.deciding_stat is required")

    floor_rounds = award["floor_rounds"]
    floor_kills = award["floor_kills"]

    eligible = [
        p for p in players
        if p["rounds_played"] >= floor_rounds
        and p["kills"] >= floor_kills
        and not p["idle_dq"]
    ]
    # SS9.3: "candidates iterated in players_sorted order (byte-lex on
    # decimal SteamID64)".
    eligible_sorted = sorted(eligible, key=lambda p: p["steamid64"])

    if not eligible_sorted:
        return {"kind": "no_eligible_players", "steamid64": None, "tied": [], "ladder_exit_step": 0}

    values = {p["steamid64"]: _extract_primary(p, cls, deciding_stat) for p in eligible_sorted}
    cmp_fn = _cmp_int if cls == "volume" else _cmp_rate

    best_val = None
    for p in eligible_sorted:
        v = values[p["steamid64"]][1]
        if best_val is None:
            best_val = v
        else:
            c_cmp = cmp_fn(v, best_val)
            if (direction == "max" and c_cmp > 0) or (direction == "min" and c_cmp < 0):
                best_val = v

    tied = sorted(
        p["steamid64"] for p in eligible_sorted
        if cmp_fn(values[p["steamid64"]][1], best_val) == 0
    )

    if cls == "volume" and direction == "max" and best_val == 0:
        return {"kind": "no_awardable_value", "steamid64": None, "tied": tied, "ladder_exit_step": 0}

    if len(tied) == 1:
        return {"kind": "winner", "steamid64": tied[0], "tied": None, "ladder_exit_step": 0}

    return resolve_ladder(award, tied, players)


def resolve_ladder(award: dict, tied: list[str], players: list[dict]) -> dict:
    """Apply the FR-29 tie ladder to an already-tied set.

    Five rungs, applied in order, each narrowing (never widening) the tied
    set; a rung that cannot compare (missing data) or cannot separate the
    set is skipped and the set carries forward unchanged:
      1. secondary stat (better value, per the award's direction)
      2. efficiency (cross-multiplied ratio, then fewer opportunities used
         -- smaller denominator -- as the within-rung tiebreak)
      3. head-to-head: a strict dominator over the remaining set, else skip
      4. earliest achievement_ts (integer)
      5. shared co-winner (terminal -- FR-29: "A bottomed-out tie is
         recorded as a shared co-winner Award for all tied Players.")
    """
    if not isinstance(tied, list) or len(tied) == 0:
        raise ValueError("resolve_ladder requires a non-empty tied set")

    direction = award.get("direction")
    if direction not in ("max", "min"):
        raise ValueError(f"invalid award direction: {direction!r}")

    players_by_id = {p["steamid64"]: p for p in players}
    for sid in tied:
        if sid not in players_by_id:
            raise ValueError(f"tied steamid64 {sid!r} not found in players")

    remaining = sorted(tied)
    if len(remaining) == 1:
        return {"kind": "winner", "steamid64": remaining[0], "tied": None, "ladder_exit_step": 0}

    # Rung 1: secondary stat.
    secondary_stat = award.get("secondary_stat")
    narrowed1 = _narrow_by(remaining, players_by_id, lambda p: _get_secondary_value(p, secondary_stat), direction)
    if narrowed1 is not None:
        if len(narrowed1) == 1:
            return {"kind": "winner", "steamid64": narrowed1[0], "tied": None, "ladder_exit_step": 1}
        remaining = narrowed1

    # Rung 2: efficiency.
    eff_num_key = award.get("eff_num_key")
    eff_den_key = award.get("eff_den_key")
    narrowed2 = _rung2_efficiency(remaining, players_by_id, eff_num_key, eff_den_key, direction)
    if narrowed2 is not None:
        if len(narrowed2) == 1:
            return {"kind": "winner", "steamid64": narrowed2[0], "tied": None, "ladder_exit_step": 2}
        remaining = narrowed2

    # Rung 3: head-to-head strict dominator.
    cls = award["class"]
    deciding_stat = award["deciding_stat"]
    dominator = _find_h2h_dominator(remaining, players_by_id, cls, deciding_stat, direction)
    if dominator is not None:
        return {"kind": "winner", "steamid64": dominator, "tied": None, "ladder_exit_step": 3}

    # Rung 4: earliest achievement_ts.
    ts_values = {sid: players_by_id[sid]["achievement_ts"] for sid in remaining}
    best_ts = min(ts_values.values())
    narrowed4 = sorted(sid for sid in remaining if ts_values[sid] == best_ts)
    if len(narrowed4) == 1:
        return {"kind": "winner", "steamid64": narrowed4[0], "tied": None, "ladder_exit_step": 4}
    remaining = narrowed4

    # Rung 5: shared co-winner (terminal).
    return {"kind": "shared", "steamid64": None, "tied": sorted(remaining), "ladder_exit_step": 5}
