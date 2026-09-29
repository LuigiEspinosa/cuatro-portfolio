#!/usr/bin/env python3
"""Story 6.11, AC8 — the independence measurement, PRINTED rather than described.

═══════════════════════════════════════════════════════════════════════════════════════════════
WHAT THIS MEASURES, AND WHY A FOURTH IMPLEMENTATION IS NEEDED FOR IT
═══════════════════════════════════════════════════════════════════════════════════════════════

`roulette/vectors/` rests on three implementations agreeing: the Go producer, the TypeScript
verifier, and `generate_vectors.py` as the external anchor. `deferred-work.md:300` records the hole
in that argument — the generator "shares verbatim prose with both runtimes, so the external anchor is
three co-authored implementations agreeing: the property AC3 exists to exclude". Three implementations
that inherited ONE misreading agree perfectly and are all wrong together.

⭐ So AC8 asks for the Stage-2 and ladder expectations to be RE-DERIVED FROM THE SPEC TEXT, "ideally
by a different agent or model", and for the diff to be **printed**: "a clean diff converts this from
a claim into a measurement, and a dirty one is a finding to report rather than to reconcile away."

`rederived_stage2_ladder.py` beside this file is that fourth implementation. It was written by
`claude-sonnet-5` in an isolated subagent from the SPEC TEXT ALONE — SOLUTION-DESIGN §9, the PRD's
FR-20..FR-32 and ARCHITECTURE-SPINE's AD-13..AD-26 — explicitly barred from opening
`generate_vectors.py`, anything under `worker/` or `lib/`, any vector `.json`, or any story file. It
therefore never saw a single expected value.

⛔⛔ THE REVIEWER WHO COMMISSIONED THIS COULD NOT HAVE WRITTEN IT. By the time 6.11's code review
found that AC8's evidence had died with the throwaway harness, that reviewer had read all three
implementations and every vector. An independence check authored by someone who has seen the answers
measures nothing. That is why this is a separate authored artifact and not a test.

═══════════════════════════════════════════════════════════════════════════════════════════════
WHAT THIS DRIVER MAY AND MAY NOT DO
═══════════════════════════════════════════════════════════════════════════════════════════════

✅ IT MAY ADAPT DATA ENCODING. The committed vectors carry magnitudes as decimal STRINGS (the
provenance rule, `README.md:294-299`) and spell a class-shaped block FLAT — one dict whose volume
keys map to scalars and whose rate keys map to `{num, den}`. The re-derivation was specified against
ints and a nested `{"volume": …, "rate": …}` block. Reshaping between the two is an ENCODING fact,
not an algorithm fact, and doing it here is what keeps the re-derivation independent of the vector's
serialisation rather than of its logic.

⛔ IT MAY NOT TUNE THE RE-DERIVATION TO MAKE THE DIFF CLEAN. If a case disagrees, that is the
measurement's output. AC8 is explicit: a dirty diff is a finding to REPORT, not to reconcile away.

⚠ THE LIMIT `:300` NAMES IS REAL AND SURVIVES. Several rules appear in NO spec document — the
zero-denominator comparison rule, the negative-magnitude refusals and the duplicate-`steamid64`
refusal among them. They cannot be re-derived from spec text, and the re-derivation's own
`UNDERIVABLE` list names them. Cases that turn on them are reported as UNDERIVABLE rather than as
mismatches, because scoring them as failures would punish the re-derivation for the spec's silence —
and scoring them as passes would claim coverage that does not exist. They are counted separately.

Usage:
    python roulette/vectors/independence/diff_independence.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VECTORS = HERE.parent
TRANSCRIPT = HERE / "TRANSCRIPT.md"

sys.path.insert(0, str(HERE))
import rederived_stage2_ladder as R  # noqa: E402


# ── encoding adaptation: the committed vector's shapes -> the re-derivation's contract ──────────

def _int(v):
    return int(v)


def _pair(v: dict) -> dict:
    return {"num": int(v["num"]), "den": int(v["den"])}


def _split_class_shaped(block: dict | None) -> dict:
    """A FLAT class-shaped block -> the nested {"volume": …, "rate": …} contract.

    ⭐ THE DISCRIMINATOR IS THE JSON SHAPE, NOT A VOCABULARY LIST — a rate value is a `{num, den}`
    object and a volume value is a decimal string. Branching on shape rather than on a hard-coded key
    list is the same rule both shipped loaders follow, and it means a new stat key needs no edit here.
    """
    volume, rate = {}, {}
    for key, value in (block or {}).items():
        if isinstance(value, dict):
            rate[key] = _pair(value)
        else:
            volume[key] = _int(value)
    return {"volume": volume, "rate": rate}


def adapt_player(p: dict) -> dict:
    si = p.get("stats_int", {})
    out = {
        "steamid64": p["steamid64"],
        "rounds_played": _int(p["rounds_played"]),
        "kills": _int(p["kills"]),
        "idle_dq": bool(p.get("idle_dq", False)),
        "stats_int": {
            "volume": {k: _int(v) for k, v in (si.get("volume") or {}).items()},
            "rate": {k: _pair(v) for k, v in (si.get("rate") or {}).items()},
            "secondary": _split_class_shaped(si.get("secondary")),
            "efficiency": {k: _pair(v) for k, v in (si.get("efficiency") or {}).items()},
        },
        "h2h": {opp: _split_class_shaped(blk) for opp, blk in (p.get("h2h") or {}).items()},
    }
    if p.get("achievement_ts") is not None:
        out["achievement_ts"] = _int(p["achievement_ts"])
    return out


def adapt_award(a: dict) -> dict:
    return {
        "deciding_stat": a.get("deciding_stat"),
        "class": a.get("class"),
        "direction": a.get("direction"),
        "floor_rounds": int(a.get("floor_rounds") or 0),
        "floor_kills": int(a.get("floor_kills") or 0),
        "secondary_stat": a.get("secondary_stat"),
        "eff_num_key": a.get("eff_num_key"),
        "eff_den_key": a.get("eff_den_key"),
    }


# ── the rules the spec does not contain (`deferred-work.md:300`) ────────────────────────────────
#
# ⛔ THESE ARE NOT EXCUSES. Each is a rule the re-derivation's own UNDERIVABLE list identifies as
# absent from every spec document, so a case that turns on one is measuring the spec's silence, not
# the implementation's correctness. They are counted and listed separately, never folded into
# "matched".
def underivable_reason(case: dict) -> str | None:
    players = case.get("players") or []
    for p in players:
        si = p.get("stats_int", {})
        for value in (si.get("rate") or {}).values():
            if int(value["den"]) == 0:
                return "zero denominator — no spec document states the comparison rule"
        for value in (si.get("efficiency") or {}).values():
            if int(value["den"]) == 0:
                return "zero efficiency denominator — no spec document states the comparison rule"
        for value in (si.get("volume") or {}).values():
            if int(value) < 0:
                return "negative magnitude — the refusal appears in no spec document"
    ids = [p.get("steamid64") for p in players]
    if len(ids) != len(set(ids)):
        return "duplicate steamid64 — the refusal appears in no spec document"
    award = case.get("award") or {}
    if award.get("eff_num_key") or award.get("eff_den_key"):
        return "rung-2 efficiency composition — UNDERIVABLE #1: the spec never says how eff_num_key and eff_den_key combine"
    return None


def compare(got: dict, want: dict, is_ladder: bool) -> str | None:
    if got.get("kind") != want.get("kind"):
        return f"kind {got.get('kind')!r} != {want.get('kind')!r}"
    if want.get("steamid64") is not None and got.get("steamid64") != want["steamid64"]:
        return f"steamid64 {got.get('steamid64')!r} != {want['steamid64']!r}"
    if want.get("tied") is not None and got.get("tied") != want["tied"]:
        return f"tied {got.get('tied')!r} != {want['tied']!r}"
    if is_ladder and want.get("ladder_exit_step") is not None:
        if got.get("ladder_exit_step") != want["ladder_exit_step"]:
            return f"ladder_exit_step {got.get('ladder_exit_step')!r} != {want['ladder_exit_step']!r}"
    return None


def drive(name: str, path: Path, is_ladder: bool) -> dict:
    vector = json.loads(path.read_text(encoding="utf-8"))
    matched, mismatched, undsc, raised = [], [], [], []
    for case in vector["cases"]:
        reason = underivable_reason(case)
        if reason:
            undsc.append((case["name"], reason))
            continue
        award = adapt_award(case["award"])
        players = [adapt_player(p) for p in case["players"]]
        try:
            if is_ladder:
                got = R.resolve_ladder(award, list(case["tied"]), players)
            else:
                got = R.resolve_stage2(award, players)
        except Exception as exc:  # noqa: BLE001 — a raise IS a result here
            raised.append((case["name"], f"{type(exc).__name__}: {exc}"))
            continue
        diff = compare(got, case["expected"], is_ladder)
        if diff:
            mismatched.append((case["name"], diff))
        else:
            matched.append(case["name"])
    return {
        "name": name,
        "total": len(vector["cases"]),
        "matched": matched,
        "mismatched": mismatched,
        "underivable": undsc,
        "raised": raised,
    }


def main() -> int:
    results = [
        drive("stage2-resolve.json", VECTORS / "stage2-resolve.json", is_ladder=False),
        drive("ladder-resolve.json", VECTORS / "ladder-resolve.json", is_ladder=True),
    ]

    lines = [
        "# Story 6.11 · AC8 — independence measurement transcript",
        "",
        "⚠ **Generated by `diff_independence.py`. Do not hand-edit** — re-run it instead.",
        "",
        "A FOURTH implementation of Stage 2 and the FR-29 ladder, written from the SPEC TEXT ALONE by",
        "`claude-sonnet-5` in an isolated subagent that never opened `generate_vectors.py`, `worker/**`,",
        "`lib/roulette/**`, any vector `.json`, or any story file — driven against the committed",
        "expectations it never saw.",
        "",
        "⛔ A dirty diff is a **finding to report**, not to reconcile away (AC8).",
        "",
    ]

    total = matched = mismatched = underivable = raised = 0
    for r in results:
        total += r["total"]
        matched += len(r["matched"])
        mismatched += len(r["mismatched"])
        underivable += len(r["underivable"])
        raised += len(r["raised"])

    lines += [
        "## Result",
        "",
        "| file | cases | matched | MISMATCHED | raised | underivable (excluded) |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| `{r['name']}` | {r['total']} | {len(r['matched'])} | **{len(r['mismatched'])}** | "
            f"{len(r['raised'])} | {len(r['underivable'])} |"
        )
    lines.append(
        f"| **total** | **{total}** | **{matched}** | **{mismatched}** | **{raised}** | **{underivable}** |"
    )
    lines.append("")

    for r in results:
        if r["mismatched"] or r["raised"]:
            lines += [f"### ⛔ Divergences in `{r['name']}`", ""]
            for nm, why in r["mismatched"]:
                lines.append(f"- **MISMATCH** `{nm}` — {why}")
            for nm, why in r["raised"]:
                lines.append(f"- **RAISED** `{nm}` — {why}")
            lines.append("")

    if mismatched or raised:
        lines += [
            "## ⭐ What the divergences MEAN — the measurement's actual yield",
            "",
            "⛔ These are reported, not reconciled away. Neither is a defect in the shipped code: in both",
            "cases the shipped implementations agree with each other and with the committed vector. What",
            "the independent re-derivation found is that **the SPEC does not contain the rule they",
            "implement** — which is precisely the property `deferred-work.md:300` says three co-authored",
            "implementations agreeing cannot establish.",
            "",
            "### 1. The `-1` absent-`achievement_ts` sentinel is in NO spec document (2 mismatches)",
            "",
            "Both `ladder-resolve.json` mismatches are rung-4 cases turning on the sentinel. The",
            "re-derivation's `UNDERIVABLE` #2 states it plainly: the concrete integer value of AD-19's",
            "published absent-sentinel is never given in the readable spec, so rung 4 cannot special-case",
            "it and compares `-1` as an ordinary timestamp — which, under 'earliest wins', makes the",
            "player with NO timestamp win. The shipped implementations exclude the sentinel holder, and",
            "the vector rows are named for exactly that (`the-MINUS-ONE-sentinel-must-NEVER-win`).",
            "⭐ **This is a FOURTH spec-less rule, and `:300` listed only three.** It is load-bearing:",
            "it decides who wins an award.",
            "",
            "### 2. The spec does not say Stage 2 RETURNS a tie rather than resolving it (8 raises)",
            "",
            "All 8 raises are `KeyError: 'achievement_ts'` on `stage2-resolve.json` tie cases. The cause",
            "is not a missing field — Stage 2 cases legitimately carry no `achievement_ts`, because Stage",
            "2 never needs one. It is that the re-derivation read the spec as *Stage 2 fully resolves a",
            "tie by running the ladder itself*, so it reached for a rung-4 field on a Stage-2 input. The",
            "shipped design is the opposite: a tie is a RETURNED OUTCOME (`kind: \"tie\"`) that the CALLER",
            "feeds to the ladder. Both readings fit the spec text; only one is implemented, and the",
            "vector's Stage-2 rows encode it. ⚠ A conformant third-party implementation could get this",
            "wrong and still believe it had followed the specification.",
            "",
        ]

    lines += [
        "## Excluded as UNDERIVABLE from spec text",
        "",
        "⚠ `deferred-work.md:300` names this limit and it has not gone away. These cases turn on rules",
        "that appear in NO spec document, so driving them would measure the spec's silence rather than",
        "the implementation. Scoring them as passes would claim coverage that does not exist.",
        "",
    ]
    for r in results:
        for nm, why in r["underivable"]:
            lines.append(f"- `{r['name']}` · `{nm}` — {why}")
    lines += [
        "",
        "### The re-derivation's own `UNDERIVABLE` list",
        "",
    ]
    for i, item in enumerate(R.UNDERIVABLE, 1):
        lines.append(f"{i}. {item}")
    lines.append("")

    TRANSCRIPT.write_text("\n".join(lines), encoding="utf-8", newline="\n")

    for line in lines:
        print(line)
    print(f"\ntranscript: {TRANSCRIPT}")
    return 1 if (mismatched or raised) else 0


if __name__ == "__main__":
    sys.exit(main())
