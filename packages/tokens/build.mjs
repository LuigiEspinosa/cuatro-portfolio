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

import { readFileSync } from 'node:fs';
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

const dictionary = new StyleDictionary({
  source: [`${asPosix(SOURCE_DIR)}/*.json`],
  platforms: {
    css: {
      transforms: ['name/kebab'],
      buildPath: `${asPosix(OUTPUT_DIR)}/`,
      files: [{ destination: 'tokens.css', format: 'cuatro/tokens-css' }],
    },
  },
  log: { verbosity: 'verbose' },
});

// Printed before the build, so a redirected run says so in the job log even when
// the build then fails.
console.log(`packages/tokens: reading  ${asPosix(SOURCE_DIR)}/*.json`);
console.log(`packages/tokens: writing  ${asPosix(join(OUTPUT_DIR, 'tokens.css'))}`);

await dictionary.buildAllPlatforms();
