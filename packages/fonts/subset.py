# Prepares the three published faces in `contracts/fonts/` from the pinned
# upstream variable fonts in `packages/fonts/sources/`.
#
# Run through `packages/fonts/prepare.mjs`, which shells out to the pinned
# `uv run --with "fonttools[woff]==4.60.1" python packages/fonts/subset.py`.
# Nothing in CI runs this: it needs a Python toolchain the runners do not have,
# and the whole point of committing both the sources and the outputs is that a
# later maintainer can reproduce the step without one.
#
# AD-1: this file lives under `packages/` and is never published. What it writes
# into `contracts/` is three woff2 binaries and three licence files, all data.
#
# The order is fixed and each step exists for a reason:
#
#   1. Verify every source against `sources.json` by sha256. A source that is
#      not the pinned one makes every figure in `ops/font-contract.md` a claim
#      about a different font, so it is a refusal rather than a warning.
#   2. `varLib.instancer` with the axis limits from `sources.json`. A pinned
#      axis is dropped from `fvar` entirely; a narrowed axis keeps its range.
#      This is where nearly all of the size comes off, and the measured cost
#      table that forced the `opsz` pin is in `ops/font-contract.md`.
#   3. `pyftsubset` with the pinned unicode range and layout features, hinting
#      kept, flavour woff2.
#   4. Write `packages/fonts/faces.json`, which is what `build.mjs` reads. The
#      generator never opens a font binary.
#
# Refusals: a source hash mismatch, an empty glyph set, a family whose published
# face would leave the three-file total above the budget.

import gzip
import hashlib
import io
import json
import shutil
import sys
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
SOURCES_JSON = HERE / "sources.json"
SOURCE_DIR = HERE / "sources"
FACES_JSON = HERE / "faces.json"
OUTPUT_DIR = REPO_ROOT / "contracts" / "fonts"


def fail(message: str) -> None:
    print(f"packages/fonts/subset.py: {message}", file=sys.stderr)
    raise SystemExit(1)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def lf_bytes(path: Path) -> bytes:
    """A text file's bytes with CRLF folded to LF.

    `.gitattributes` pins LF on `contracts/**/*.txt` but says nothing about
    `packages/fonts/sources/*.txt`, and `core.autocrlf` is true on the authoring
    host, so a fresh clone there hands this script a licence with CRLF endings.
    Publishing those bytes would put a CRLF file under a rule that normalises it
    back to LF on check-in, which is how a folder that was just regenerated
    reads as drifted. Normalising here makes the published line endings a
    property of this generator rather than of whose checkout ran it. The
    upstream files ship LF, so the recorded sha256 is unaffected.
    """
    return path.read_bytes().replace(b"\r\n", b"\n")


def sha256_of_text(path: Path) -> str:
    return hashlib.sha256(lf_bytes(path)).hexdigest()


def gzipped_size(path: Path) -> int:
    """Bytes over the wire under the compression a static host actually applies.

    `mtime=0` and a fixed level make this reproducible: the default gzip header
    stamps the current time, which would move the recorded figure on every run
    and make a byte-for-byte rebuild check meaningless.
    """
    return len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))


def axis_limits_for(family: dict) -> dict:
    """`sources.json` writes a pin as a number and a range as a two-element list.

    fontTools wants a number for a pin and a tuple for a range, and getting that
    wrong silently produces a different font rather than an error, so the shapes
    are checked here rather than trusted.
    """
    limits = {}
    for axis, value in family["axisLimits"].items():
        if isinstance(value, list):
            if len(value) != 2:
                fail(
                    f'{family["family"]}: axis "{axis}" is a list of {len(value)} values in '
                    f"sources.json. A range is exactly two values, a pin is one number."
                )
            limits[axis] = (float(value[0]), float(value[1]))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            limits[axis] = float(value)
        else:
            fail(
                f'{family["family"]}: axis "{axis}" is {value!r} in sources.json, '
                f"which is neither a number (a pin) nor a two-element list (a range)."
            )
    return limits


def vertical_metrics(font: TTFont) -> dict:
    head = font["head"]
    hhea = font["hhea"]
    os2 = font["OS/2"]
    return {
        "unitsPerEm": head.unitsPerEm,
        "hheaAscender": hhea.ascent,
        "hheaDescender": hhea.descent,
        "hheaLineGap": hhea.lineGap,
        "typoAscender": os2.sTypoAscender,
        "typoDescender": os2.sTypoDescender,
        "typoLineGap": os2.sTypoLineGap,
        "winAscent": os2.usWinAscent,
        "winDescent": os2.usWinDescent,
    }


def surviving_axes(font: TTFont) -> dict:
    """What `fvar` still declares after instancing.

    A wrongly pinned axis is a value no size assertion catches, so it is
    recorded per face and the record's claim about it is checkable.
    """
    if "fvar" not in font:
        return {}
    return {
        axis.axisTag: [axis.minValue, axis.defaultValue, axis.maxValue]
        for axis in font["fvar"].axes
    }


def main() -> None:
    manifest = json.loads(SOURCES_JSON.read_text(encoding="utf-8"))
    unicode_range = manifest["unicodeRange"]
    features = manifest["layoutFeatures"]
    budget = manifest["budgetBytes"]

    # Everything is built into a scratch directory and moved into `contracts/`
    # only once every refusal has had its chance. The budget check can only run
    # after all three faces exist, and a budget failure that had already
    # overwritten two of the three published binaries would leave the folder
    # seven repositories vendor in a state no commit describes.
    staging = Path(tempfile.mkdtemp(prefix="cuatro-fonts-"))

    faces = []
    total = 0

    for family in manifest["families"]:
        source_path = SOURCE_DIR / family["source"]["file"]
        licence_path = SOURCE_DIR / family["licenceSource"]["file"]

        for path, pinned, hashed in (
            (source_path, family["source"], sha256_of),
            (licence_path, family["licenceSource"], sha256_of_text),
        ):
            if not path.exists():
                fail(
                    f"{path.relative_to(REPO_ROOT).as_posix()} is missing. It is committed on "
                    f"purpose so this step can be reproduced; restore it from "
                    f'{pinned["url"]} .'
                )
            observed = hashed(path)
            if observed != pinned["sha256"]:
                fail(
                    f"{path.relative_to(REPO_ROOT).as_posix()} is sha256 {observed}, but "
                    f'sources.json pins {pinned["sha256"]}. Refusing: every figure in '
                    f"ops/font-contract.md was measured against the pinned bytes."
                )

        # `recalcTimestamp=False` on every open and every save in this file.
        # fontTools stamps `head.modified` with the current time by default, so
        # two runs of this script from the same inputs produce two different
        # binaries, two different sha256 values and (because the stamp changes
        # what brotli sees) two different byte counts. Observed 2026-08-25
        # before this was pinned: the three faces came out 172 bytes apart
        # between consecutive runs. A published binary that changes when nothing
        # changed makes the drift gate and the recorded hashes worthless.
        font = TTFont(source_path, recalcTimestamp=False)
        limits = axis_limits_for(family)
        font = instancer.instantiateVariableFont(font, limits, updateFontNames=False, inplace=True)

        # Round-trip the instanced font through a buffer before subsetting.
        # `instantiateVariableFont` leaves `gvar` holding entries only for the
        # glyphs it actually touched, and fontTools 4.60.1's `gvar` subsetter
        # indexes that dict by every retained glyph, so subsetting the in-memory
        # font raises `KeyError` on the first unvaried glyph in the set (observed
        # 2026-08-25: `KeyError: 'uni2001'`). Compiling writes an entry for every
        # glyph, and reading it back non-lazily materialises them all, which is
        # the state the subsetter expects.
        buffer = io.BytesIO()
        font.save(buffer)
        font.close()
        buffer.seek(0)
        font = TTFont(buffer, lazy=False, recalcTimestamp=False)

        options = subset.Options()
        options.flavor = "woff2"
        # Hinting is kept deliberately, and the usual argument for dropping it
        # does not apply here. Measured 2026-08-25, `--no-hinting` moves these
        # three faces by +220, -40 and +28 bytes, because all three upstream
        # sources carry no TrueType instructions and there is nothing to strip.
        # Keeping it is free, and dropping it would be a rendering-quality
        # decision made for no gain. Both sets of figures are in
        # ops/font-contract.md.
        options.hinting = True
        options.desubroutinize = False
        options.layout_features = list(features)
        options.name_IDs = "*"
        options.name_legacy = True
        options.notdef_outline = True
        options.recalc_bounds = True
        options.drop_tables = ["DSIG"]

        subsetter = subset.Subsetter(options=options)
        unicodes = subset.parse_unicodes(unicode_range)
        subsetter.populate(unicodes=unicodes)
        subsetter.subset(font)

        glyph_count = len(font.getGlyphOrder())
        if glyph_count <= 1:
            fail(
                f'{family["family"]}: the subset left {glyph_count} glyph(s). A face with no '
                f"outlines would publish and then render nothing, so this is a refusal."
            )

        output_path = staging / family["published"]["face"]
        # `subset.Options().flavor` is read by fontTools' own CLI, not by
        # `Subsetter.subset`, so setting it there alone writes a plain TTF with a
        # `.woff2` name and no compression at all. Observed 2026-08-25: the three
        # faces came out at 204,736 bytes total, above the budget, purely because
        # of this. The flavour has to be set on the font that gets saved.
        font.flavor = "woff2"
        font.save(output_path)

        (staging / family["published"]["licence"]).write_bytes(lf_bytes(licence_path))

        size = output_path.stat().st_size
        total += size

        faces.append(
            {
                "id": family["id"],
                "family": family["family"],
                "role": family["role"],
                "licence": family["licence"],
                "repository": family["repository"],
                "sourceCommit": family["source"]["commit"],
                "file": family["published"]["face"],
                "licenceFile": family["published"]["licence"],
                "licenceSha256": sha256_of_text(staging / family["published"]["licence"]),
                "bytes": size,
                "gzipBytes": gzipped_size(output_path),
                "sha256": sha256_of(output_path),
                "glyphs": glyph_count,
                "axes": surviving_axes(font),
                "axisLimits": family["axisLimits"],
                "unicodeRange": unicode_range,
                "layoutFeatures": list(features),
                "metrics": vertical_metrics(font),
            }
        )

        font.close()

    if total > budget:
        lines = "\n".join(f'  {face["file"]}  {face["bytes"]} bytes' for face in faces)
        shutil.rmtree(staging, ignore_errors=True)
        fail(
            f"the published faces total {total} bytes, above the {budget} byte budget "
            f"UX-DR7 fixes.\n{lines}\n  total  {total} bytes\n"
            f"Widening the budget is not this step's call: narrow an axis or drop a "
            f"feature, and record the cost."
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for staged in sorted(staging.iterdir()):
        shutil.copyfile(staged, OUTPUT_DIR / staged.name)
    shutil.rmtree(staging, ignore_errors=True)

    FACES_JSON.write_text(
        json.dumps(
            {
                "$description": (
                    "Written by packages/fonts/subset.py from the pinned sources in "
                    "packages/fonts/sources.json. packages/fonts/build.mjs reads this and "
                    "packages/fonts/fallback-metrics.json and never opens a font binary, which "
                    "is what keeps pnpm fonts:build deterministic arithmetic on a runner with "
                    "no Python and no browser. Never hand-edited."
                ),
                "budgetBytes": budget,
                "totalBytes": total,
                "totalGzipBytes": sum(face["gzipBytes"] for face in faces),
                "faces": faces,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )

    for face in faces:
        print(
            f'packages/fonts: {face["file"]}  {face["bytes"]} bytes on disk, '
            f'{face["gzipBytes"]} gzipped, {face["glyphs"]} glyphs'
        )
    print(
        f"packages/fonts: total {total} bytes on disk, "
        f'{sum(face["gzipBytes"] for face in faces)} gzipped, budget {budget} bytes'
    )


if __name__ == "__main__":
    main()
