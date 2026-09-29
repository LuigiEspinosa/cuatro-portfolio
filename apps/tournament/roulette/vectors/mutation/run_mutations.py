#!/usr/bin/env python3
"""Story 6.11, AC12 — the mutation pass, as a COMMITTED RUNNER rather than a story paragraph.

═══════════════════════════════════════════════════════════════════════════════════════════════
WHY THIS FILE EXISTS AT ALL, WHEN THIS PROJECT DELETES ITS HARNESSES
═══════════════════════════════════════════════════════════════════════════════════════════════

Every previous story built a throwaway harness and deleted it before commit. Story 6.11's own rule
(Task 10) is stronger and is what broke the convention here: "the end-to-end evidence must survive
the harness's deletion". Its code review found that AC12's mutation table did NOT survive — the
11-row result lived only in prose, with no runner and no transcript, which is the same evidentiary
state `deferred-work.md:288` was raised against and which this very story is annotated as closing.

⭐ Cuatro's call at the code review (2026-08-12): COMMIT THE ARTIFACT. A mutation table nobody can
re-run is a claim; a runner anybody can re-run is a measurement. This file and `mutants.json` are
therefore deliberately exempt from the delete-the-harness convention, and that exemption is recorded
in `roulette/vectors/README.md` so the next reader does not "tidy" them away.

═══════════════════════════════════════════════════════════════════════════════════════════════
THE RULES AC12 IMPOSES, AND HOW EACH IS MET
═══════════════════════════════════════════════════════════════════════════════════════════════

1. ⛔ THE ORACLE IS THE RUNNER'S EXIT CODE, NEVER A PROSE GREP. Two runs in this epic were voided by
   a prose oracle scoring mutations against a harness that had collected ZERO tests and would have
   reported every mutant as `killed`. `_run_suite` returns the process exit code and nothing else
   decides a verdict.

2. ⛔ A CONTROL PASS RUNS FIRST AND THE RUN IS VOID UNLESS IT IS GREEN. A red baseline makes every
   `killed` meaningless — the suite was already failing.

3. ⛔ THE CONTROL MUST DESCRIBE THE SUITE ACTUALLY SHIPPED. Three separate runs in this epic were
   voided by a harness that collected 0 tests (a lowercase drive letter breaking Vitest config
   resolution, a `--reporter` that did not exist in Vitest 4, and two runs collecting `(0 test)`
   across all 54 files). `_run_suite` therefore also parses a TEST COUNT and the control refuses to
   proceed on a suite that collected none. ⚠ That parse is a SANITY CHECK on the control only — it
   is never the oracle for a verdict.

4. ⛔ WHOLE-SUITE RUNNERS. 6.11's own first attempt scored a mutant SURVIVED because it ran a
   hand-picked five-file list that omitted the suite gating it. `go test ./...` and `npx vitest run`,
   with no file filter, ever.

5. ⛔ NOT-APPLIED IS AN OUTCOME, DISTINCT FROM KILLED. An anchor that does not match its file exactly
   once has not tested anything, and reporting it as a pass is how a mutation table lies.

6. ⛔ BYTE-LEVEL IO WITH SHA-256-VERIFIED RESTORES, AND NEVER `git stash`. `core.autocrlf` is true in
   this repo with no `.gitattributes`, and a stash-based restore is what caused 6.9a's CRLF incident
   (19 files, ~19,000 line endings, `--check` reporting DRIFT). Anchors are rewritten into each
   file's OWN line-ending convention before matching, and every restore is verified by hash.

Usage:
    python roulette/vectors/mutation/run_mutations.py --verify   # anchors only, no suite runs
    python roulette/vectors/mutation/run_mutations.py --run      # the full pass, writes the transcript
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent
TABLE = HERE / "mutants.json"
TRANSCRIPT = HERE / "TRANSCRIPT.md"

KILLED = "killed"
SURVIVED = "SURVIVED"
NOT_APPLIED = "NOT-APPLIED"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _to_file_endings(text: str, data: bytes) -> bytes:
    """Rewrite an anchor into the convention the target file actually uses.

    ⛔ NOT COSMETIC. An anchor authored with LF will not match a CRLF file, and the result is a
    silent NOT-APPLIED that an inattentive runner scores as `killed`.
    """
    encoded = text.encode("utf-8")
    if b"\r\n" in data:
        encoded = encoded.replace(b"\n", b"\r\n")
    return encoded


def _run_suite(lang: str) -> tuple[int, int, str]:
    """Run a whole suite. Returns (exit_code, tests_collected, tail_of_output).

    ⛔ THE EXIT CODE IS THE ORACLE. `tests_collected` is parsed only so the CONTROL pass can refuse
    a suite that collected nothing; it never decides a mutant's verdict.
    """
    if lang == "go":
        exe = shutil.which("go")
        if exe is None:
            raise SystemExit("go is not on PATH — the run is void, not skipped")
        proc = subprocess.run(
            [exe, "test", "./...", "-count=1"],
            cwd=REPO / "worker",
            capture_output=True,
            text=True,
            # ⚠ NOT COSMETIC ON WINDOWS. Both suites print the heavy Unicode this codebase's comments
            # and test names use, and `text=True` alone decodes with the locale codec (cp1252 here),
            # which raises mid-read and takes the whole run down. Decoding explicitly as UTF-8 with
            # replacement keeps the ORACLE — the exit code — reachable no matter what was printed.
            encoding="utf-8",
            errors="replace",
        )
        collected = sum(1 for line in proc.stdout.splitlines() if line.startswith(("ok ", "--- ", "FAIL")))
    else:
        exe = shutil.which("npx")
        if exe is None:
            raise SystemExit("npx is not on PATH — the run is void, not skipped")
        proc = subprocess.run(
            [exe, "vitest", "run", "--reporter=dot"],
            cwd=REPO,
            capture_output=True,
            text=True,
            # ⚠ NOT COSMETIC ON WINDOWS. Both suites print the heavy Unicode this codebase's comments
            # and test names use, and `text=True` alone decodes with the locale codec (cp1252 here),
            # which raises mid-read and takes the whole run down. Decoding explicitly as UTF-8 with
            # replacement keeps the ORACLE — the exit code — reachable no matter what was printed.
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
        collected = 0
        for line in (proc.stdout + proc.stderr).splitlines():
            stripped = line.strip()
            if stripped.startswith("Tests "):
                for token in stripped.replace("|", " ").split():
                    if token.isdigit():
                        collected = max(collected, int(token))
    tail = "\n".join((proc.stdout + proc.stderr).splitlines()[-12:])
    return proc.returncode, collected, tail


def _load() -> list[dict]:
    return json.loads(TABLE.read_text(encoding="utf-8"))["mutants"]


def verify() -> int:
    """Anchor check only. Reports every anchor that would land NOT-APPLIED, before any suite runs."""
    bad = 0
    for m in _load():
        target = REPO / m["file"]
        if not target.exists():
            print(f"{m['id']:<4} NOT-APPLIED  missing file {m['file']}")
            bad += 1
            continue
        data = target.read_bytes()
        anchor = _to_file_endings(m["anchor"], data)
        n = data.count(anchor)
        if n != 1:
            print(f"{m['id']:<4} NOT-APPLIED  anchor matches {n} times in {m['file']} (need exactly 1)")
            bad += 1
        else:
            print(f"{m['id']:<4} ok           anchor matches exactly once in {m['file']}")
    print()
    print(f"{'ANCHORS OK' if bad == 0 else str(bad) + ' ANCHOR(S) WOULD NOT APPLY'}")
    return 1 if bad else 0


def run() -> int:
    mutants = _load()

    # ── the control pass ─────────────────────────────────────────────────────
    print("── CONTROL PASS (unmutated sources) ──")
    control: dict[str, tuple[int, int]] = {}
    for lang in ("go", "ts"):
        code, collected, tail = _run_suite(lang)
        control[lang] = (code, collected)
        print(f"  {lang}: exit={code} collected={collected}")
        if code != 0:
            print(f"⛔ THE RUN IS VOID — the {lang} control is RED before any mutation:\n{tail}")
            return 1
        if collected == 0:
            print(f"⛔ THE RUN IS VOID — the {lang} control collected ZERO tests, so every mutant "
                  f"below would score `killed` against nothing. This is the exact failure that "
                  f"voided three earlier runs in this epic.")
            return 1
    print()

    results: list[dict] = []
    for m in mutants:
        target = REPO / m["file"]
        original = target.read_bytes()
        before_hash = _sha256(original)
        anchor = _to_file_endings(m["anchor"], original)
        replacement = _to_file_endings(m["replacement"], original)

        occurrences = original.count(anchor)
        if occurrences != 1:
            print(f"{m['id']:<4} {NOT_APPLIED}  anchor matched {occurrences}x in {m['file']}")
            results.append({**m, "verdict": NOT_APPLIED,
                            "note": f"anchor matched {occurrences} times, need exactly 1"})
            continue

        target.write_bytes(original.replace(anchor, replacement))
        try:
            started = time.time()
            code, collected, tail = _run_suite(m["lang"])
            elapsed = time.time() - started
            verdict = KILLED if code != 0 else SURVIVED
            note = f"exit={code}, {collected} collected, {elapsed:.0f}s"
            if verdict == SURVIVED:
                note += " — ⛔ NO TEST NOTICED THIS EDIT"
            print(f"{m['id']:<4} {verdict:<11} {note}")
            results.append({**m, "verdict": verdict, "note": note})
        finally:
            # ⛔ RESTORE ALWAYS, AND VERIFY THE RESTORE BY HASH. A mutant left applied would poison
            # every later result and, worse, the working tree.
            target.write_bytes(original)
            after_hash = _sha256(target.read_bytes())
            if after_hash != before_hash:
                raise SystemExit(
                    f"⛔⛔ RESTORE FAILED for {m['file']}: {before_hash} -> {after_hash}. "
                    f"The working tree is dirty and the run is void."
                )

    _write_transcript(results, control)
    survivors = [r for r in results if r["verdict"] == SURVIVED]
    not_applied = [r for r in results if r["verdict"] == NOT_APPLIED]
    print()
    print(f"applied {len(results) - len(not_applied)} · killed "
          f"{sum(1 for r in results if r['verdict'] == KILLED)} · survivors {len(survivors)} · "
          f"NOT-APPLIED {len(not_applied)}")
    print(f"transcript: {TRANSCRIPT.relative_to(REPO)}")
    return 1 if survivors or not_applied else 0


def _write_transcript(results: list[dict], control: dict[str, tuple[int, int]]) -> None:
    lines = [
        "# Story 6.11 · AC12 — mutation pass transcript",
        "",
        "⚠ **Generated by `run_mutations.py`. Do not hand-edit** — re-run it instead.",
        "",
        "The oracle is the suite runner's **exit code**, never a grep of its output. `NOT-APPLIED` is",
        "reported as an outcome distinct from `killed`: an anchor that did not land tested nothing, and",
        "scoring it as a pass is how a mutation table lies.",
        "",
        "## Control pass (unmutated sources)",
        "",
        "| suite | exit | tests collected |",
        "|---|---|---|",
    ]
    for lang, (code, collected) in control.items():
        lines.append(f"| `{lang}` | {code} | {collected} |")
    lines += [
        "",
        "⭐ A control that collected **zero** tests voids the run — three separate runs in this epic",
        "were lost that way, each scoring every mutant `killed` against a suite that never ran.",
        "",
        "## Results",
        "",
        "| id | lang | verdict | file | what it breaks |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        verdict = r["verdict"]
        cell = f"**{verdict}**" if verdict != KILLED else verdict
        lines.append(f"| {r['id']} | {r['lang']} | {cell} | `{r['file']}` | {r['breaks']} |")

    survivors = [r for r in results if r["verdict"] == SURVIVED]
    not_applied = [r for r in results if r["verdict"] == NOT_APPLIED]
    lines += ["", "## Verdict", ""]
    lines.append(f"- applied: **{len(results) - len(not_applied)}** of {len(results)}")
    lines.append(f"- killed: **{sum(1 for r in results if r['verdict'] == KILLED)}**")
    lines.append(f"- survivors: **{len(survivors)}**")
    lines.append(f"- NOT-APPLIED: **{len(not_applied)}**")
    if survivors:
        lines += [
            "",
            "⛔ **SURVIVORS ARE FINDINGS, NOT FOOTNOTES.** `6-5b:138` governs each one: *a mutation that",
            "only reddens a hand-written local assertion means the VECTOR does not cover it — fix the",
            "vector, not the test.*",
            "",
        ]
        for r in survivors:
            lines.append(f"- `{r['id']}` — {r['breaks']} (`{r['file']}`)")
    if not_applied:
        lines += ["", "⚠ **NOT-APPLIED entries tested nothing and must be corrected, never dropped.**", ""]
        for r in not_applied:
            lines.append(f"- `{r['id']}` — {r.get('note', '')} (`{r['file']}`)")
    lines.append("")
    TRANSCRIPT.write_text("\n".join(lines), encoding="utf-8", newline="\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--verify", action="store_true", help="check anchors only; run no suites")
    ap.add_argument("--run", action="store_true", help="run the full pass and write the transcript")
    args = ap.parse_args()
    if args.verify:
        return verify()
    if args.run:
        return run()
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
