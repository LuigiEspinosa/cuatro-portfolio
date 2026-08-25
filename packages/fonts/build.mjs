// Generates `contracts/fonts.css`, the published face contract.
//
// AD-1: this generator lives in `packages/` and is never published. What it
// writes into `contracts/` is one stylesheet; the binaries beside it come from
// `packages/fonts/subset.py` through `pnpm fonts:prepare`.
//
// Node builtins only, and deliberately so. `packages/fonts` carries no
// `package.json`, because a manifest there would make it a workspace importer,
// change the lockfile, and oblige a new `COPY` line in the Docker `deps` stage
// that `docker/__tests__/deps-stage.test.ts` exists to police. See
// `ops/font-contract.md`, "Why the generator carries no manifest".
//
// This step is pure arithmetic over two committed JSON inputs plus the version
// in `packages/tokens/package.json`, so it is deterministic on any host: a CI
// runner with no Python, no browser and no font toolchain reproduces the
// published file byte for byte, which is what makes the `fonts-contract` drift
// gate meaningful.
//
//   faces.json             what was actually subset and shipped (subset.py)
//   fallback-metrics.json  what the fallbacks measure in the pinned browser
//                          image (measure.mjs)
//
// The three descriptors are derived, never hand-tuned. With `font-display: swap`
// the fallback paints first, so the published face is adjusted to the fallback
// rather than the other way round:
//
//   size-adjust      = fallback.advance / face.advance
//   ascent-override  = fallback.ascent  / (pixelSize * sizeAdjust)
//   descent-override = fallback.descent / (pixelSize * sizeAdjust)
//   line-gap-override= fallback.lineGap / (pixelSize * sizeAdjust)
//
// The overrides are divided by the size adjustment because the browser applies
// them to the size-adjusted em. `line-gap-override` is emitted only when the
// measured fallback carries a non-zero line gap; emitting `0%` unconditionally
// would be a different claim, and omitting it when the fallback has one would
// reintroduce the shift this file exists to remove.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// `CUATRO_FONTS_SOURCE` and `CUATRO_FONTS_OUTPUT` are build inputs, documented
// in `ops/font-contract.md` under "How the file is regenerated". They exist so a
// test can run this generator against a scratch tree without writing into
// `contracts/`, and they default to the real paths, so an ordinary
// `pnpm fonts:build` needs no environment at all.
//
// Either one set in a CI runner would silently redirect the build away from
// `contracts/`, leaving `git status -- contracts/` clean and the drift gate
// green on real drift. Both are pinned empty in the workflow, which this
// treats as unset, and both resolved paths are printed on every run so the job
// log says where it actually wrote.
const SOURCE_DIR = process.env.CUATRO_FONTS_SOURCE ? resolve(process.env.CUATRO_FONTS_SOURCE) : HERE;
const OUTPUT_DIR = process.env.CUATRO_FONTS_OUTPUT
  ? resolve(process.env.CUATRO_FONTS_OUTPUT)
  : join(REPO_ROOT, 'contracts');

const FACES_JSON = join(SOURCE_DIR, 'faces.json');
const METRICS_JSON = join(SOURCE_DIR, 'fallback-metrics.json');
const TOKENS_MANIFEST = join(REPO_ROOT, 'packages', 'tokens', 'package.json');
const OUTPUT_CSS = join(OUTPUT_DIR, 'fonts.css');

/** The subdirectory the faces sit in, relative to the published stylesheet. */
const FACE_DIR = 'fonts';

const asPosix = (value) => value.replace(/\\/g, '/');

const refuse = (message) => {
  throw new Error(`packages/fonts/build.mjs: ${message}`);
};

const readJson = (path, what) => {
  if (!existsSync(path)) {
    refuse(`${what} is missing at ${asPosix(path)}. Run "pnpm fonts:prepare" and "pnpm fonts:measure" first.`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return refuse(`${what} at ${asPosix(path)} is not readable JSON: ${error.message}`);
  }
};

/**
 * The single source of the contract version, and it is `packages/tokens`'s
 * rather than this package's on purpose: AD-16 has one scheduled job read
 * `Contract vX.Y.Z` out of every file in a vendored `cuatro-contracts/` folder,
 * so the three files carry one version between them. Publishing `fonts.css`
 * bumps nothing; see `ops/font-contract.md`, "Why publishing this file bumps no
 * version".
 */
const contractVersion = () => {
  const declared = JSON.parse(readFileSync(TOKENS_MANIFEST, 'utf8')).version;
  if (typeof declared !== 'string' || !/^\d+\.\d+\.\d+$/.test(declared)) {
    refuse(
      `packages/tokens/package.json declares version ${JSON.stringify(declared)}, which is not the ` +
        `exact X.Y.Z the "Contract vX.Y.Z" header must carry for AD-16 to read it.`
    );
  }
  return declared;
};

/**
 * A percentage with three decimal places and no trailing zeroes.
 *
 * Fixed precision rather than the shortest round-trip, because the published
 * file has to be reproducible from the same two inputs on any host, and because
 * three decimals on a percentage is a resolution below a thousandth of an em,
 * which no layout can see.
 */
const percent = (ratio) => {
  if (!Number.isFinite(ratio)) {
    refuse(`a derived descriptor came out as ${ratio}, which is not a number that can be published.`);
  }
  const fixed = (ratio * 100).toFixed(3).replace(/\.?0+$/, '');
  return `${fixed}%`;
};

/** `unicode-range` as the descriptor wants it: comma plus space between ranges. */
const unicodeRange = (compact) =>
  String(compact)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

/**
 * `font-weight` and `font-stretch` describe what the published face can
 * actually do, which is what the instancer left in `fvar`. A face pinned to one
 * weight declares that one number; a range declares two.
 */
const rangeDescriptor = (limit, unit) => {
  if (Array.isArray(limit)) return `${limit[0]}${unit} ${limit[1]}${unit}`;
  return `${limit}${unit}`;
};

const main = () => {
  const version = contractVersion();
  const faces = readJson(FACES_JSON, 'faces.json');
  const metrics = readJson(METRICS_JSON, 'fallback-metrics.json');

  if (!Array.isArray(faces.faces) || faces.faces.length === 0) {
    refuse(
      `faces.json at ${asPosix(FACES_JSON)} declares no faces. Refusing to publish an empty ` +
        `fonts.css over the file seven repositories vendor.`
    );
  }

  const provenance = metrics.provenance ?? {};
  const pixelSize = Number(provenance.pixelSize);
  if (!Number.isFinite(pixelSize) || pixelSize <= 0) {
    refuse(
      `fallback-metrics.json records pixelSize ${JSON.stringify(provenance.pixelSize)}, and every ` +
        `override is divided by it. Re-run "pnpm fonts:measure" in the pinned image.`
    );
  }

  const rules = [];
  let totalBytes = 0;

  for (const face of faces.faces) {
    const url = `./${FACE_DIR}/${face.file}`;

    // Matrix row "A rooted or absolute url()", checked before anything else so
    // that a face named `/fonts/x.woff2` or `https://cdn.example/x.woff2` is
    // refused for what it is rather than reported as a missing file. The whole
    // three-file split exists so a vendored folder resolves at any depth, and a
    // rooted path is the one edit that silently un-does it in seven
    // repositories with no test suite between them and a Visitor.
    if (!new RegExp(`^\\./${FACE_DIR}/[A-Za-z0-9._-]+\\.woff2$`).test(url)) {
      refuse(
        `the @font-face rule for "${face.family}" would carry url("${url}"), which is not a plain ` +
          `file name relative to fonts.css itself. Nothing was written.`
      );
    }

    // The OFL travels with the binary, so the licence it travels under is named
    // in the published rule rather than left for a reader to infer.
    if (typeof face.licence !== 'string' || face.licence.trim() === '') {
      refuse(
        `faces.json names no licence for "${face.family}", and the published rule states it. ` +
          `Re-run "pnpm fonts:prepare". Nothing was written.`
      );
    }

    const facePath = join(OUTPUT_DIR, FACE_DIR, face.file);
    const licencePath = join(OUTPUT_DIR, FACE_DIR, face.licenceFile);

    // Matrix row "A face named in the CSS is absent". The published stylesheet
    // is the one thing a vendored folder depends on, so a rule pointing at a
    // file that is not there is a refusal before anything is written rather
    // than a 404 in seven repositories.
    if (!existsSync(facePath)) {
      refuse(
        `the face ${asPosix(facePath)} named by faces.json is not on disk, so fonts.css would ` +
          `publish a rule pointing at nothing. Run "pnpm fonts:prepare". Nothing was written.`
      );
    }
    if (!existsSync(licencePath)) {
      refuse(
        `the licence ${asPosix(licencePath)} for ${face.family} is not on disk. The OFL permits ` +
          `redistribution only with the notice included, and every consumer redistributes this ` +
          `folder. Run "pnpm fonts:prepare". Nothing was written.`
      );
    }

    // The face on disk is checked against the hash `faces.json` recorded when it
    // was subset, because every metric, byte count and axis range in that file
    // describes those exact bytes. Size alone never decides it: two different
    // subsets of the same family can weigh the same.
    const observed = createHash('sha256').update(readFileSync(facePath)).digest('hex');
    if (observed !== face.sha256) {
      refuse(
        `${asPosix(facePath)} is sha256 ${observed}, but faces.json recorded ${face.sha256}. ` +
          `The metrics this file derives its overrides from describe the recorded bytes, not these. ` +
          `Nothing was written.`
      );
    }

    // Matrix row "A family missing from either input". Emitting a face with no
    // overrides is the exact defect the swap gate exists to catch, so it is
    // never published by omission.
    const measured = metrics.families?.[face.family];
    if (!measured) {
      refuse(
        `fallback-metrics.json carries no entry for "${face.family}", so its size-adjust, ` +
          `ascent-override and descent-override cannot be derived. Re-run "pnpm fonts:measure" in ` +
          `the pinned image. Nothing was written.`
      );
    }

    for (const [side, sample] of [
      ['face', measured.face],
      ['fallback', measured.fallback],
    ]) {
      for (const key of ['advance', 'ascent', 'descent']) {
        const value = Number(sample?.[key]);
        if (!Number.isFinite(value) || value <= 0) {
          refuse(
            `fallback-metrics.json records ${side}.${key} as ${JSON.stringify(sample?.[key])} for ` +
              `"${face.family}". Every descriptor is a ratio of these, so a missing or zero ` +
              `measurement would publish a nonsense override. Nothing was written.`
          );
        }
      }
    }

    const sizeAdjust = measured.fallback.advance / measured.face.advance;
    const adjustedEm = pixelSize * sizeAdjust;
    const ascentOverride = measured.fallback.ascent / adjustedEm;
    const descentOverride = measured.fallback.descent / adjustedEm;
    const lineGap = Number(measured.fallback.lineGap ?? 0);

    totalBytes += Number(face.bytes) || 0;

    const descriptors = [
      ['font-family', `"${face.family}"`],
      ['src', `url("${url}") format("woff2")`],
      ['font-weight', rangeDescriptor(face.axisLimits.wght, '')],
      ...(face.axisLimits.wdth ? [['font-stretch', rangeDescriptor(face.axisLimits.wdth, '%')]] : []),
      ['font-style', 'normal'],
      ['font-display', 'swap'],
      ['unicode-range', unicodeRange(face.unicodeRange)],
      ['size-adjust', percent(sizeAdjust)],
      ['ascent-override', percent(ascentOverride)],
      ['descent-override', percent(descentOverride)],
      ...(lineGap > 0 ? [['line-gap-override', percent(lineGap / adjustedEm)]] : []),
    ];

    const column = Math.max(...descriptors.map(([name]) => name.length)) + 2;

    rules.push(
      [
        `/* ${face.family} · ${face.role} · ${face.licence}`,
        ` * ${face.bytes} bytes, ${face.glyphs} glyphs, latin subset. Licence: ./${FACE_DIR}/${face.licenceFile}`,
        ` * Overrides tuned against ${measured.fallbackStack}`,
        ` * as that stack resolves in ${provenance.image ?? 'the pinned browser image'}.`,
        ' */',
        '@font-face {',
        ...descriptors.map(([name, value]) => `  ${`${name}:`.padEnd(column)}${value};`),
        '}',
      ].join('\n')
    );
  }

  const budget = Number(faces.budgetBytes);
  if (Number.isFinite(budget) && totalBytes > budget) {
    refuse(
      `the faces named by faces.json total ${totalBytes} bytes, above the ${budget} byte budget ` +
        `UX-DR7 fixes. Nothing was written.`
    );
  }

  const header = [
    '/* Cuatro Ecosystem, Font Faces',
    ` * Contract v${version} · latin subset · variable woff2`,
    ' * Every url() here is relative to this file, so a vendored contracts/ folder',
    ' * resolves at whatever depth it lands. Values: see tokens.css (same folder).',
    ' * A value change or an addition is a MINOR bump. A rename, including fixing a',
    ' * typo in a token name, or a removal is MAJOR.',
    ' * Each face ships with its OFL licence text beside it under ./fonts/.',
    ' * Generated from packages/fonts. Never edit this file by hand.',
    ' */',
  ];

  const css = `${[header.join('\n'), ...rules].join('\n\n')}\n`;

  // A last read of the finished text rather than of the pieces, because the
  // refusal above guards the value this generator computed and this guards the
  // file it is about to publish. Comments are stripped first: the header
  // explains the rule in prose and the words it uses would otherwise be read as
  // a rule to check.
  const declarationsOnly = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, quoted, single, bare] of declarationsOnly.matchAll(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/g
  )) {
    const target = quoted ?? single ?? bare ?? '';
    if (!target.startsWith('./')) {
      refuse(`the emitted stylesheet carries url("${target}"), which is not relative to fonts.css itself.`);
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_CSS, css, 'utf8');

  console.log(`packages/fonts: ${totalBytes} bytes of faces, budget ${budget} bytes`);
};

// Printed before the build, so a redirected run says so in the job log even when
// the build then fails.
console.log(`packages/fonts: reading  ${asPosix(FACES_JSON)}`);
console.log(`packages/fonts: reading  ${asPosix(METRICS_JSON)}`);
console.log(`packages/fonts: writing  ${asPosix(OUTPUT_CSS)}`);

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
