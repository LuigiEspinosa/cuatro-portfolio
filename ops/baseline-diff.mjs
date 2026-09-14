// The baseline pixel diff (Story 2-28, `ops/rendered-output-harness.md` § Regenerating the
// baseline). Reads two PNGs of the same size and prints, as one JSON object, how many pixels
// differ at all, how many differ by more than the per-pixel threshold Playwright's comparator
// applies, the largest per-pixel distance seen, and the bounding box of each set, so a render
// change the harness measures as none can still be stated as a number with its region.
//
// It exists because `toHaveScreenshot` prints a differing-pixel count only when the comparison
// fails, and a change that stays under the per-pixel threshold on every pixel it touches never
// fails: `maxDiffPixelRatio` counts only the pixels `threshold` has already called different.
// The 80,831-pixel, zero-counted change of 2026-09-14 is the case this was written for.
//
// What it recomputes, and where the reference is:
//
//   1. Playwright compares PNGs with pixelmatch, bundled into `playwright-core@1.62.1`'s
//      `lib/coreBundle.js` (`pixelmatch2` from `:6636`, called at `:7550-7552` with
//      `threshold: options.threshold ?? 0.2`). Each pixel pair is alpha-blended onto white,
//      converted to YIQ, and its distance taken as `0.5053 * dy^2 + 0.299 * di^2 + 0.1957 * dq^2`,
//      where the conversions are `y = 0.29889531 r + 0.58662247 g + 0.11448223 b`,
//      `i = 0.59597799 r - 0.27417610 g - 0.32180189 b` and
//      `q = 0.21147017 r - 0.52261711 g + 0.31114694 b` (`:6754-6790`). A pixel counts as
//      different when the distance exceeds `35215 * threshold^2` (`:6659`), which at 0.2 is
//      1408.6. The same numbers are recomputed here, so the printed "over" count is what the
//      comparator would have counted before `maxDiffPixelRatio` was applied to it. Anti-aliasing
//      detection is not reproduced: the comparator runs it by default (`includeAA: false`,
//      `:6623`, `:6666`) and drops a pixel it reads as an anti-aliased edge, so a handful of edge
//      pixels could be excluded there and counted here, which errs towards reporting a change.
//   2. `sharp`, a direct dependency, decodes both files to raw RGBA. No other dependency.
//   3. Nothing is estimated. Two files of different sizes stop the run rather than being
//      compared over the smaller, and the box of an empty set prints as null rather than as a
//      corner.
//
// It measures and prints. It changes nothing and gates nothing.
//
// Usage, from the repository root or anywhere else:
//
//   node ops/baseline-diff.mjs <a.png> <b.png>

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const sharp = require('sharp');

/** Playwright's default per-pixel `threshold`, and the YIQ distance it allows. */
const THRESHOLD = 0.2;
const MAX_DELTA = 35215 * THRESHOLD * THRESHOLD;

const rgb2y = (r, g, b) => r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
const rgb2i = (r, g, b) => r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
const rgb2q = (r, g, b) => r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
const blend = (c, alpha) => 255 + (c - 255) * alpha;

/** The YIQ distance between the pixels at byte offset `k` of two RGBA buffers, zero when equal. */
const delta = (p, q, k) => {
  let [r1, g1, b1, a1] = [p[k], p[k + 1], p[k + 2], p[k + 3]];
  let [r2, g2, b2, a2] = [q[k], q[k + 1], q[k + 2], q[k + 3]];
  if (a1 === a2 && r1 === r2 && g1 === g2 && b1 === b2) return 0;
  if (a1 < 255) {
    a1 /= 255;
    [r1, g1, b1] = [blend(r1, a1), blend(g1, a1), blend(b1, a1)];
  }
  if (a2 < 255) {
    a2 /= 255;
    [r2, g2, b2] = [blend(r2, a2), blend(g2, a2), blend(b2, a2)];
  }
  const y = rgb2y(r1, g1, b1) - rgb2y(r2, g2, b2);
  const i = rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2);
  const qq = rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2);
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * qq * qq;
};

/** A bounding box that grows by `add` and reads as null while empty. */
const box = () => {
  const b = { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };
  return {
    add(x, y) {
      b.minX = Math.min(b.minX, x);
      b.maxX = Math.max(b.maxX, x);
      b.minY = Math.min(b.minY, y);
      b.maxY = Math.max(b.maxY, y);
    },
    value: () => (b.maxX < 0 ? null : { x: [b.minX, b.maxX], y: [b.minY, b.maxY] }),
  };
};

const decode = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('usage: node ops/baseline-diff.mjs <a.png> <b.png>');
  process.exit(2);
}
const A = await decode(a);
const B = await decode(b);
if (A.width !== B.width || A.height !== B.height) {
  throw new Error(`the two files are different sizes: ${A.width}x${A.height} against ${B.width}x${B.height}`);
}

let differing = 0;
let over = 0;
let largest = 0;
const anyBox = box();
const overBox = box();
for (let y = 0; y < A.height; y += 1) {
  for (let x = 0; x < A.width; x += 1) {
    const d = delta(A.data, B.data, (y * A.width + x) * 4);
    if (d === 0) continue;
    differing += 1;
    anyBox.add(x, y);
    largest = Math.max(largest, d);
    if (d > MAX_DELTA) {
      over += 1;
      overBox.add(x, y);
    }
  }
}

const total = A.width * A.height;
console.log(
  JSON.stringify({
    size: `${A.width}x${A.height}`,
    total,
    differing,
    differingRatio: Number((differing / total).toFixed(4)),
    differingBox: anyBox.value(),
    threshold: THRESHOLD,
    thresholdDelta: Number(MAX_DELTA.toFixed(1)),
    over,
    overRatio: Number((over / total).toFixed(4)),
    overBox: overBox.value(),
    largestDelta: Number(largest.toFixed(1)),
  })
);
