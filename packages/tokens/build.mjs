// Generates `contracts/tokens.css`, the published token contract.
//
// AD-1: this generator lives in `packages/` and is never published. Nothing it
// writes into `contracts/` is executable, and nothing under `contracts/` is
// hand-edited: this file is the only thing that writes it.
//
// The property set, every value, the section order and the reduced-motion block
// come from `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`
// section `tokens.css`. `packages/tokens/__tests__/tokens-contract.test.ts` asserts
// the published file against that block name by name and value by value, so a
// value edited here and not there fails the unit gate.
//
// Two deliberate choices, both recorded in `ops/token-contract.md`:
//
//   1. Source values are CSS strings inside DTCG structure, not DTCG structured
//      types. A spike against Style Dictionary 5.5.2 showed a structured `color`
//      comes out of `color/css` as a hex or an `rgba()`, which discards the
//      authored OKLCH; a structured `duration` renders `[object Object]`; and
//      `clamp()` and `cubic-bezier()` have no structured DTCG representation at
//      all. Strings survive byte-exactly.
//   2. Group keys are the emitted prefixes (`c`, `token`, `t`, ...), so
//      `name/kebab` alone produces the exact custom-property names with no
//      rename transform to review and nothing to drift.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT` are build inputs, documented
// in `ops/token-contract.md` under "How the file is regenerated". They exist so a
// test can run this generator against a scratch source tree without writing into
// `contracts/`, and they default to the real paths, so an ordinary
// `pnpm tokens:build` needs no environment at all.
//
// Either one set in a CI runner would silently redirect the build away from
// `contracts/`, leaving `git status -- contracts/` clean and the drift gate green
// on real drift. The generator therefore prints both resolved paths on every run,
// so the job log says where it actually wrote rather than where it was assumed to.
const SOURCE_DIR = process.env.CUATRO_TOKENS_SOURCE
  ? resolve(process.env.CUATRO_TOKENS_SOURCE)
  : join(HERE, 'tokens');
const OUTPUT_DIR = process.env.CUATRO_TOKENS_OUTPUT
  ? resolve(process.env.CUATRO_TOKENS_OUTPUT)
  : join(REPO_ROOT, 'contracts');

// The Tailwind adapter's translation table. It sits beside the source directory
// rather than inside it, because the source glob is `tokens/*.json` and a map
// file in there would be read as tokens. Resolving it from `SOURCE_DIR` rather
// than from `HERE` means a scratch run through `CUATRO_TOKENS_SOURCE` picks up
// the scratch tree's own map, so the generator has two build inputs and not
// three.
const THEME_MAP_PATH = join(SOURCE_DIR, '..', 'theme-map.json');

/** Style Dictionary joins `buildPath` and `destination` as plain strings. */
const asPosix = (value) => value.replace(/\\/g, '/');

/**
 * The single source of the contract version. AD-16 has a scheduled job read
 * `Contract vX.Y.Z` out of every Satellite's vendored copy, so a version that is
 * not exactly three dot-separated numbers breaks that check estate-wide rather
 * than here. A missing `version` would otherwise publish `Contract vundefined`,
 * and a prerelease would publish something the job cannot parse.
 */
const VERSION = (() => {
  const declared = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).version;
  if (typeof declared !== 'string' || !/^\d+\.\d+\.\d+$/.test(declared)) {
    throw new Error(
      `packages/tokens/build.mjs: packages/tokens/package.json declares version ${JSON.stringify(declared)}, ` +
        `which is not the exact X.Y.Z the "Contract vX.Y.Z" header must carry for AD-16 to read it.`
    );
  }
  return declared;
})();

// `DESIGN.md` section order, verbatim. A section can carry more than one group:
// `--page-pad` sits in the space section, `--focus-offset` in the stroke
// section, and the easings beside the durations, exactly as the design block
// has them.
const SECTIONS = [
  { title: 'colour: palette', groups: ['c'] },
  { title: 'colour: semantic roles (consume these)', groups: ['token'] },
  { title: 'type: families', groups: ['f'] },
  { title: 'type: scale (1.25 from 16px)', groups: ['t'] },
  { title: 'type: weight', groups: ['w'] },
  { title: 'type: line-height', groups: ['lh'] },
  { title: 'type: tracking', groups: ['tr'] },
  { title: 'measure', groups: ['measure'] },
  { title: 'space (4pt base)', groups: ['s', 'page-pad'] },
  { title: 'hit target', groups: ['tap'] },
  { title: 'shape', groups: ['r'] },
  { title: 'stroke', groups: ['stroke', 'focus-offset'] },
  { title: 'elevation (lightness, not shadow)', groups: ['elev'] },
  { title: 'motion', groups: ['dur', 'ease'] },
  { title: 'layer', groups: ['z'] },
];

/** The group whose members the reduced-motion block collapses. */
const MOTION_DURATION_GROUP = 'dur';
const REDUCED_MOTION_VALUE = '1ms';

/** Every section comment is padded to this column, as in `DESIGN.md`. */
const SECTION_COMMENT_WIDTH = 64;

const sectionOf = new Map();
SECTIONS.forEach((section, sectionIndex) => {
  section.groups.forEach((group, groupIndex) => {
    if (sectionOf.has(group)) {
      throw new Error(`packages/tokens/build.mjs: group "${group}" is mapped to two sections.`);
    }
    sectionOf.set(group, { sectionIndex, groupIndex });
  });
});

const sectionComment = (title) => {
  const fill = Math.max(2, SECTION_COMMENT_WIDTH - 8 - title.length - 1 - 3);
  return `  /* ── ${title} ${'─'.repeat(fill)} */`;
};

/**
 * A token's group key is the first path segment, which for the four ungrouped
 * tokens is the token itself. A key with no section is a build failure rather
 * than a token quietly emitted into an arbitrary position or dropped.
 */
const placementOf = (token) => {
  const group = token.path[0];
  const placement = sectionOf.get(group);
  if (!placement) {
    throw new Error(
      `packages/tokens/build.mjs: token group "${group}" (from --${token.name}) has no section. ` +
        `Add it to SECTIONS in packages/tokens/build.mjs, in the position DESIGN.md gives it.`
    );
  }
  return placement;
};

const REFERENCE = /\{([^{}]+)\}/g;

/**
 * `outputReferences`: an alias is published as the `var()` the design authored,
 * not as the palette value it happens to resolve to today. AD-14 depends on the
 * role layer being a reference, so flattening it here would publish a contract
 * the design did not write.
 */
const publishedValue = (token, nameByPath) => {
  const authored = String(token.original.$value ?? token.original.value);
  const resolved = authored.replace(REFERENCE, (_whole, path) => {
    const target = nameByPath.get(path.trim());
    if (!target) {
      throw new Error(
        `packages/tokens/build.mjs: --${token.name} references "{${path}}", which is not a token in this dictionary.`
      );
    }
    return `var(--${target})`;
  });
  // The same refusal `commentLines` makes for a `$description`, for the value.
  // A value carrying `;` or a brace ends the declaration early and emits the
  // rest of itself as CSS the design never wrote, and a comment delimiter closes
  // an adjacent generated comment. The published file goes to seven
  // repositories, so the generator refuses rather than letting the shape test
  // downstream decide whether it noticed.
  if (/[;{}]|\/\*|\*\/|\n/.test(resolved)) {
    throw new Error(
      `packages/tokens/build.mjs: the value of --${token.name} contains a CSS delimiter (${JSON.stringify(resolved)}), ` +
        `which would end the declaration early and emit the rest of itself into the published contract.`
    );
  }
  return resolved;
};

/** A one-line description trails the declaration; a multi-line one sits above it. */
const commentLines = (description, indent, name) => {
  // A description carrying a comment delimiter closes the generated comment early
  // and injects its own prose into the published contract as CSS.
  if (description.includes('*/') || description.includes('/*')) {
    throw new Error(
      `packages/tokens/build.mjs: the $description on --${name} contains a CSS comment delimiter, ` +
        `which would close the generated comment early and inject prose into the published contract.`
    );
  }
  const lines = description.split('\n');
  if (lines.length === 1) return { above: [], trailing: `/* ${lines[0]} */` };
  const above = lines.map((line, index) => {
    const prefix = index === 0 ? `${indent}/* ` : `${indent}   `;
    const suffix = index === lines.length - 1 ? ' */' : '';
    return `${prefix}${line}${suffix}`;
  });
  return { above, trailing: '' };
};

/** One block of declarations, values aligned to the longest name in the block. */
const declarations = (entries, indent) => {
  const column = indent.length + 2 + Math.max(...entries.map(([name]) => name.length)) + 2;
  const lines = [];
  for (const [name, value, description] of entries) {
    const { above, trailing } = description ? commentLines(description, indent, name) : { above: [], trailing: '' };
    lines.push(...above);
    const declaration = `${indent}--${name}:`.padEnd(column) + `${value};`;
    lines.push(trailing ? `${declaration}   ${trailing}` : declaration);
  }
  return lines;
};

StyleDictionary.registerFormat({
  name: 'cuatro/tokens-css',
  format: ({ dictionary }) => {
    // A moved or emptied source directory makes the glob match nothing, and Style
    // Dictionary is content to write the result. Publishing an empty `:root` over
    // the contract seven repositories vendor is the worst thing this generator
    // could do quietly, so it refuses instead.
    if (dictionary.allTokens.length === 0) {
      throw new Error(
        `packages/tokens/build.mjs: no tokens were read from ${asPosix(SOURCE_DIR)}. ` +
          `Refusing to publish an empty contract over contracts/tokens.css.`
      );
    }

    const nameByPath = new Map(dictionary.allTokens.map((token) => [token.path.join('.'), token.name]));

    const ordered = dictionary.allTokens
      .map((token, index) => ({ token, index, placement: placementOf(token) }))
      .sort(
        (left, right) =>
          left.placement.sectionIndex - right.placement.sectionIndex ||
          left.placement.groupIndex - right.placement.groupIndex ||
          left.index - right.index
      );

    const lines = [
      '/* Cuatro Ecosystem, Design Tokens',
      ` * Contract v${VERSION} · dark only · anchor hue 288`,
      ' * Values only. Font files: see fonts.css (same folder).',
      ' * A value change or an addition is a MINOR bump. A rename, including fixing a',
      ' * typo in a token name, or a removal is MAJOR.',
      ' * Generated from packages/tokens. Never edit this file by hand.',
      ' */',
      ':root {',
    ];

    SECTIONS.forEach((section, sectionIndex) => {
      const members = ordered.filter((entry) => entry.placement.sectionIndex === sectionIndex);
      if (members.length === 0) return;
      if (lines[lines.length - 1] !== ':root {') lines.push('');
      lines.push(sectionComment(section.title));
      lines.push(
        ...declarations(
          members.map(({ token }) => [
            token.name,
            publishedValue(token, nameByPath),
            token.$description ?? token.description ?? token.original.$description,
          ]),
          '  '
        )
      );
    });

    lines.push('}');

    // Derived from the `dur` group rather than hand-written, so a duration added
    // to the source cannot be left out of the reduced-motion contract.
    //
    // An empty group is a refusal rather than an omission. Reduced-motion
    // compliance is the one behaviour the token layer federates, and a source
    // that no longer has durations would otherwise publish a contract missing
    // the whole `@media` block with an exit code of 0.
    const durations = ordered.filter(({ token }) => token.path[0] === MOTION_DURATION_GROUP);
    if (durations.length === 0) {
      throw new Error(
        `packages/tokens/build.mjs: no tokens in the "${MOTION_DURATION_GROUP}" group, so the ` +
          `@media (prefers-reduced-motion: reduce) block would be published empty. Refusing.`
      );
    }
    lines.push('');
    lines.push('@media (prefers-reduced-motion: reduce) {');
    lines.push('  :root {');
    lines.push(...declarations(durations.map(({ token }) => [token.name, REDUCED_MOTION_VALUE]), '    '));
    lines.push('  }');
    lines.push('}');

    return `${lines.join('\n')}\n`;
  },
});

// ---------------------------------------------------------------------------
// `contracts/tailwind.css`, the generated `@theme inline` adapter (Story 1-13).
//
// A plain `:root` file of custom properties mints zero utility classes in
// Tailwind v4 (`DESIGN.md:1058-1066`), so the four Tailwind consumers would
// import the contract and still have no `bg-accent`. This adapter is what turns
// the role layer into utilities, and it is emitted from the same dictionary that
// publishes `tokens.css`, so a renamed token fails this build rather than
// shipping an adapter that silently resolves to nothing.
// ---------------------------------------------------------------------------

/**
 * The theme namespaces Tailwind v4 actually reads. A key outside them is not a
 * typo the compiler complains about: it is accepted, stored, and mints nothing,
 * which is the silent failure this generator exists to make loud.
 *
 * `--ease-*` is listed because Tailwind does theme it. The contract's own
 * easings are still not mapped, and they fail one refusal later, on the
 * self-reference rule, which is the accurate reason. See `ops/tailwind-adapter.md`.
 */
const TAILWIND_NAMESPACES = [
  '--color-',
  '--font-',
  '--font-weight-',
  '--text-',
  '--tracking-',
  '--leading-',
  '--breakpoint-',
  '--container-',
  '--spacing-',
  '--radius-',
  '--shadow-',
  '--inset-shadow-',
  '--drop-shadow-',
  '--text-shadow-',
  '--blur-',
  '--perspective-',
  '--aspect-',
  '--ease-',
  '--animate-',
];

/** The raw palette is never consumed outside `contracts/` (AD-14). */
const PALETTE_PREFIX = '--c-';

/** Anything a custom property name may carry here. Deliberately narrow. */
const CUSTOM_PROPERTY = /^--[A-Za-z0-9][A-Za-z0-9_-]*$/;

const refuseAdapter = (message) => {
  throw new Error(`packages/tokens/build.mjs: ${message}`);
};

/**
 * The map as data, structurally checked. Every refusal names the key it is about
 * and the file it came from, because the person reading it is editing that file.
 */
const readThemeMap = () => {
  const where = asPosix(THEME_MAP_PATH);
  if (!existsSync(THEME_MAP_PATH)) {
    refuseAdapter(
      `the Tailwind theme map is missing at ${where}. contracts/tailwind.css is generated from it, ` +
        `so nothing was published.`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(THEME_MAP_PATH, 'utf8'));
  } catch (error) {
    return refuseAdapter(`the Tailwind theme map at ${where} is not readable JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed.sections)) {
    refuseAdapter(`the Tailwind theme map at ${where} declares no "sections" array. Nothing was published.`);
  }
  return { where, sections: parsed.sections };
};

/**
 * Every row of the adapter's half of the I/O matrix. Returns the sections with
 * their entries in map order.
 *
 * `allTokens` is the dictionary this same run is about to publish, which is the
 * point: the map is validated against the contract it adapts, not against a
 * snapshot of it, so a renamed token fails this build rather than shipping an
 * adapter that silently resolves to nothing.
 *
 * Every message ends "Nothing was published", and that is a fact about Style
 * Dictionary rather than a hope: `buildPlatform` formats every file in the
 * platform before it writes any of them, so a throw in either format leaves the
 * output directory untouched. Verified 2026-08-25 against 5.5.2 by running this
 * generator with a corrupted map into an empty scratch directory and observing
 * it still empty afterwards.
 */
const validateThemeMap = ({ where, sections }, allTokens) => {
  const declared = new Set(allTokens.map((token) => `--${token.name}`));
  const seen = new Map();
  const validated = [];

  for (const [index, section] of sections.entries()) {
    if (typeof section?.title !== 'string' || section.title.trim() === '') {
      refuseAdapter(`section ${index} in ${where} carries no title. Nothing was published.`);
    }
    if (section.title.includes('/*') || section.title.includes('*/')) {
      refuseAdapter(
        `the section title ${JSON.stringify(section.title)} in ${where} carries a CSS comment ` +
          `delimiter, which would close the generated comment early. Nothing was published.`
      );
    }
    if (!Array.isArray(section.entries) || section.entries.length === 0) {
      refuseAdapter(`the section "${section.title}" in ${where} names no entries. Nothing was published.`);
    }

    for (const entry of section.entries) {
      const { key, token } = entry ?? {};

      // A name that is not a plain custom property is refused before it can be
      // read as anything else: a value carrying `;`, a brace or a comment
      // delimiter would end its declaration early and emit the rest of itself
      // into a file seven repositories vendor.
      for (const [what, name] of [
        ['key', key],
        ['token', token],
      ]) {
        if (typeof name !== 'string' || !CUSTOM_PROPERTY.test(name)) {
          refuseAdapter(
            `an entry in section "${section.title}" of ${where} declares ${what} ` +
              `${JSON.stringify(name)}, which is not a custom property name of the form --name. ` +
              `Nothing was published.`
          );
        }
      }

      // Matrix row "A key in an unknown namespace". `--colour-bg` is accepted by
      // Tailwind, stored, and mints nothing at all, silently.
      if (!TAILWIND_NAMESPACES.some((namespace) => key.startsWith(namespace) && key.length > namespace.length)) {
        refuseAdapter(
          `the theme key ${key} in ${where} is in a namespace Tailwind v4 does not theme, so it ` +
            `would mint no utility at all and report nothing. Permitted namespaces are ` +
            `${TAILWIND_NAMESPACES.join(', ')}. Nothing was published.`
        );
      }

      // Matrix row "A mapping is a cycle". AD-14: `--color-bg: var(--color-bg)`
      // survives only by cascade accident and resolves to `transparent` the
      // moment a bundler flattens the imports, with no error anywhere.
      if (key === token) {
        refuseAdapter(
          `the theme key ${key} in ${where} reads var(${token}), the same name on both sides of the ` +
            `var(). AD-14 forbids it: a self-reference resolves to transparent once a bundler ` +
            `flattens the imports, silently. Nothing was published.`
        );
      }

      // Matrix row "A mapping reads the raw palette". The semantic role layer is
      // the only thing a consumer reads (AD-14).
      if (token.startsWith(PALETTE_PREFIX)) {
        refuseAdapter(
          `the theme key ${key} in ${where} reads ${token}, which is the raw --c-* palette. AD-14 ` +
            `keeps the palette inside contracts/: the semantic role layer is the only thing a ` +
            `consumer reads. Nothing was published.`
        );
      }

      // Matrix row "A mapping names a token that is gone". Validated against the
      // dictionary this run is publishing, so a renamed token fails the build
      // rather than shipping an adapter that resolves to nothing.
      if (!declared.has(token)) {
        refuseAdapter(
          `the theme key ${key} in ${where} reads ${token}, which is not a token this dictionary ` +
            `publishes into contracts/tokens.css. Nothing was published.`
        );
      }

      if (seen.has(key)) {
        refuseAdapter(
          `the theme key ${key} appears twice in ${where}, first reading ${seen.get(key)} and then ` +
            `${token}. One of the two would be discarded silently. Nothing was published.`
        );
      }
      seen.set(key, token);
      validated.push({ section: section.title, key, token });
    }
  }

  // Matrix row "An empty map". Publishing an empty `@theme` block is publishing
  // an adapter that mints nothing, which is the exact state this file exists to
  // end.
  if (validated.length === 0) {
    refuseAdapter(
      `the Tailwind theme map at ${where} declares no mappings, so the @theme inline block would be ` +
        `published empty and mint no utility at all. Nothing was published.`
    );
  }

  return validated;
};

StyleDictionary.registerFormat({
  name: 'cuatro/tailwind-css',
  format: ({ dictionary }) => {
    const mappings = validateThemeMap(readThemeMap(), dictionary.allTokens);

    const lines = [
      '/* Cuatro Ecosystem, Tailwind v4 Adapter',
      ` * Contract v${VERSION} · generated @theme inline · dark only`,
      ' * The single entry point for a Tailwind v4 consumer. Import order is fixed:',
      ' * tailwindcss, then tokens.css, then fonts.css, then the theme block.',
      ' * fonts.css is REQUIRED here: an adapter pulling in only tokens.css hands the',
      ' * cluster three named families with no @font-face for any of them.',
      ' * inline is MANDATORY, not stylistic: without it a var() resolves where the',
      ' * theme variable is defined rather than where it is used, and it fails silently.',
      ' * Compile this file into the same folder it sits in, or the faces 404: the',
      ' * url()s fonts.css declares are copied through unrebased. See ops/tailwind-adapter.md.',
      ' * A value change or an addition is a MINOR bump. A rename, including fixing a',
      ' * typo in a token name, or a removal is MAJOR.',
      ' * Generated from packages/tokens. Never edit this file by hand.',
      ' */',
      '@import "tailwindcss";',
      '@import "./tokens.css";',
      '@import "./fonts.css";',
      '',
      '@theme inline {',
    ];

    // Grouped in map order, one comment per section, values aligned within the
    // section exactly as `tokens.css` aligns its own.
    const grouped = [];
    for (const mapping of mappings) {
      const last = grouped[grouped.length - 1];
      if (last && last.title === mapping.section) last.entries.push(mapping);
      else grouped.push({ title: mapping.section, entries: [mapping] });
    }

    grouped.forEach((group, index) => {
      if (index > 0) lines.push('');
      lines.push(sectionComment(group.title));
      lines.push(...declarations(group.entries.map((entry) => [entry.key.slice(2), `var(${entry.token})`]), '  '));
    });

    lines.push('}');

    return `${lines.join('\n')}\n`;
  },
});

const dictionary = new StyleDictionary({
  source: [`${asPosix(SOURCE_DIR)}/*.json`],
  platforms: {
    css: {
      transforms: ['name/kebab'],
      buildPath: `${asPosix(OUTPUT_DIR)}/`,
      files: [
        { destination: 'tokens.css', format: 'cuatro/tokens-css' },
        { destination: 'tailwind.css', format: 'cuatro/tailwind-css' },
      ],
    },
  },
  log: { verbosity: 'verbose' },
});

// Printed before the build, so a redirected run says so in the job log even when
// the build then fails.
console.log(`packages/tokens: reading  ${asPosix(SOURCE_DIR)}/*.json`);
console.log(`packages/tokens: reading  ${asPosix(THEME_MAP_PATH)}`);
console.log(`packages/tokens: writing  ${asPosix(join(OUTPUT_DIR, 'tokens.css'))}`);
console.log(`packages/tokens: writing  ${asPosix(join(OUTPUT_DIR, 'tailwind.css'))}`);

await dictionary.buildAllPlatforms();
