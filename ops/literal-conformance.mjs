// The FR-17 literal-conformance gate (R8, Story 2-34). The `literal-conformance` job in
// `.github/workflows/ci.yml` runs this on every push and on every pull request to `main`.
//
// FR-17: no colour, spacing or type value in the Hub's own styling bypasses the token contract.
// `DESIGN.md` names the check that holds it R8, "a blocking CI grep: no colour, spacing or type
// literal outside `contracts/` and `_print.scss`", and AD-21 makes it blocking. It replaced Story
// 2.19's one-time hand sweep, which could not hold a property: this runs on every push.
//
// It reads every stylesheet git tracks or would track, never built CSS and never a script, and it
// refuses, in the files outside the permitted set, a colour literal anywhere, a hand-written `44px`
// anywhere, a spacing literal in a spacing property and a type literal in a type property; and in
// every file, the permitted set included, any alpha but the one allowance below.
//
// Every allowance is a named entry in the configuration below, with its reason, so a later reader
// can tell an allowance from an oversight. Comments are never read, so nothing written in a
// stylesheet silences the gate: silencing it is a reviewed edit to a list in this file.
//
// This file imports only `node:` builtins, so the job installs nothing and still reports on the run
// where `pnpm install --frozen-lockfile` fails. Nothing redirects it at runtime: no argument and no
// environment variable selects what it reads, and the root is resolved beside this module. See
// `ops/literal-conformance.md`.

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuration. Every allowance the gate makes is here, and nowhere else.
// ---------------------------------------------------------------------------

/**
 * The permitted set, exactly as Story 2.34 fixes it. A path ending in `/` covers the directory.
 * **Story 2.27 records no exception**: the aberration was dropped rather than excepted, so there is
 * no component-level entry at all, and a third entry is a reviewed edit to this list.
 */
export const PERMITTED = [
  {
    path: 'contracts/',
    reason:
      'The contract defines the values. Every literal in the estate is authored here once and ' +
      'consumed everywhere else as a role (AD-1, AD-14).',
  },
  {
    path: 'app/scss/_print.scss',
    reason:
      'Paper is genuinely white and toner genuinely black, so the print stylesheet is outside the ' +
      'contract by nature (DESIGN.md, Sequence, "Print keeps #fff and #000").',
  },
];

/**
 * The one alpha allowance, written against the palette declaration and never against the role.
 * The alpha check reads every stylesheet, the permitted set included, so this is the only alpha
 * that passes anywhere.
 */
export const ALPHA_ALLOWANCE = {
  path: 'contracts/tokens.css',
  property: '--c-scrim',
  reason:
    'The contract carries exactly one alpha and it lives on the palette entry --c-scrim; the role ' +
    '--token-scrim is a plain var() reference like every other. An allowance written against the ' +
    'role rejects contracts/tokens.css itself, because that is where the alpha sits (review finding ' +
    'HIGH-4), and a hand-written copy of the scrim value is still refused everywhere else.',
};

/**
 * The four collisions between the gate and material the redesign newly specified (review finding
 * HIGH-5), each dispositioned rather than discovered. The scopes below are what implement them.
 */
export const DISPOSITIONS = [
  {
    collision: 'opacity keyframes in the display entrance (Story 2-27)',
    verdict: 'allowed',
    reason:
      'The alpha check reads colour functions only (rgba(, hsla(, a slash alpha inside a colour ' +
      'function) and never the opacity property. A grep cannot tell an entrance from a state, so ' +
      'barring opacity for state stays a design rule held in review.',
  },
  {
    collision: 'clip-path notch geometry (Story 2-29)',
    verdict: 'allowed',
    reason:
      'The spacing check reads spacing properties only: padding, margin, gap and inset, their ' +
      'longhands and scroll variants. Polygon coordinates are shape geometry, not values on the ' +
      '--s-* scale, and so are the percentages and viewport lengths that place a panel inside a ' +
      'composition: the check counts the absolute and font-relative lengths a scale step replaces.',
  },
  {
    collision: 'the 44px hit-target literal, in every control in the estate',
    verdict: 'rejected',
    reason:
      '--tap: 44px is minted in the contract (2026-08-16), so a hand-written 44px is refused in ' +
      'every declaration, custom properties and Sass variables included, with no local-constant ' +
      'allowance: a floor hand-written in five frameworks drifts in five frameworks (review finding ' +
      'LOW-2).',
  },
  {
    collision: 'font-variation-settings axis literals, "wdth" 100 / 85 / 75 and "opsz" 48 / 24',
    verdict: 'allowed',
    reason:
      'Font-internal axis coordinates specified in DESIGN.md, Typography, not values on the --t-* ' +
      'scale, and no token exists or should. The type check reads the five scaled properties and the ' +
      'font shorthand only, so font-stretch, the same wdth axis written as a percentage, stands here too.',
  },
];

/** The properties whose values are on the spacing scale (`--s-*`, `--page-pad`). */
export const SPACING_PROPERTY =
  /^(?:(?:scroll-)?(?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|(?:grid-)?(?:row-|column-)?gap|inset(?:-(?:block|inline)(?:-(?:start|end))?)?|top|right|bottom|left)$/;

/**
 * The units a step on the spacing scale replaces: absolute and font-relative lengths. A percentage
 * or a viewport or container length is relative geometry, which the scale does not carry.
 */
export const SCALE_UNITS = [
  'px', 'rem', 'em', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh', 'rex', 'rch', 'rcap', 'ric',
  'pt', 'pc', 'in', 'cm', 'mm', 'q',
];

/** The properties whose values the contract's type roles cover (`--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`). */
export const TYPE_PROPERTIES = ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'];

/**
 * The 148 named colours of CSS Color 4. `transparent` and `currentcolor` are keywords with no hue
 * and are not among them; neither are the system colours a forced-colours rule reaches for.
 */
export const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
  'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
  'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
  'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
  'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey ' +
  'dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray ' +
  'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
  'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen ' +
  'lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey ' +
  'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
  'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
  'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive ' +
  'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred ' +
  'papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue ' +
  'saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray ' +
  'slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
  'whitesmoke yellow yellowgreen'
).split(' ');

/** At-rules whose prelude or statement carries no painted value: conditions, names and paths. */
const UNREAD_AT_RULES = new Set([
  'media', 'supports', 'container', 'keyframes', '-webkit-keyframes', 'font-face', 'layer', 'page',
  'scope', 'starting-style', 'property', 'counter-style', 'font-feature-values', 'font-palette-values',
  'use', 'forward', 'import', 'charset', 'namespace', 'extend',
]);

/** The extensions listed. `.sass` is listed so it can be refused: its indented syntax is not parsed here. */
const EXTENSIONS = ['css', 'scss', 'sass'];

// ---------------------------------------------------------------------------
// Reading a stylesheet.
// ---------------------------------------------------------------------------

/**
 * @typedef {'colour' | 'alpha' | 'tap' | 'spacing' | 'type' | 'unread' | 'syntax' | 'unreadable'} Rule
 * @typedef {{ path: string, source: string }} Stylesheet
 * @typedef {{ path: string, line: number, rule: Rule, property: string, literal: string }} Finding
 * @typedef {{ path: string, property: string }} Allowance
 * @typedef {{ outside: number, inside: number, allowed: number, findings: Finding[] }} Scan
 * @typedef {{ read: boolean, error: string | null } & Scan} Inspection
 * @typedef {{ ok: boolean, message: string }} Result
 */

const fill = (/** @type {string} */ text, /** @type {string} */ char) => text.replace(/[^\n]/g, char);

/**
 * The source with everything that is not CSS text blanked, one character for one character, so an
 * offset in the result is the same offset in the source and a finding quotes the original. Comments
 * become spaces; the insides of strings, of an unquoted `url()` and of a `#{}` interpolation become
 * `x`. Newlines survive everywhere, so lines still count.
 *
 * @param {string} source
 */
export function mask(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const pair = source.slice(i, i + 2);
    const char = source[i];
    if (pair === '/*') {
      const close = source.indexOf('*/', i + 2);
      const end = close === -1 ? n : close + 2;
      out += fill(source.slice(i, end), ' ');
      i = end;
    } else if (pair === '//') {
      // A Sass line comment. One inside a string or a `url()` never reaches this branch, because
      // both are consumed whole below before the scan gets to it.
      const close = source.indexOf('\n', i);
      const end = close === -1 ? n : close;
      out += fill(source.slice(i, end), ' ');
      i = end;
    } else if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < n && source[j] !== char && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      j = Math.min(j, n);
      const closed = source[j] === char;
      out += char + fill(source.slice(i + 1, j), 'x') + (closed ? char : '');
      i = closed ? j + 1 : j;
    } else if (pair === '#{') {
      let depth = 0;
      let j = i + 1;
      for (; j < n; j += 1) {
        if (source[j] === '{') depth += 1;
        else if (source[j] === '}' && --depth === 0) break;
      }
      const end = Math.min(j + 1, n);
      out += fill(source.slice(i, end), 'x');
      i = end;
    } else if (/^url\(/i.test(source.slice(i, i + 4)) && !/[\w-]/.test(source[i - 1] ?? '')) {
      let j = i + 4;
      while (j < n && /\s/.test(source[j])) j += 1;
      if (source[j] === '"' || source[j] === "'") {
        // Quoted: the string branch blanks it on the next pass.
        out += source.slice(i, j);
        i = j;
      } else {
        const close = source.indexOf(')', j);
        const end = close === -1 ? n : close;
        out += source.slice(i, i + 4) + fill(source.slice(i + 4, end), 'x');
        i = end;
      }
    } else {
      out += char;
      i += 1;
    }
  }
  return out;
}

/**
 * Every statement in a masked stylesheet: the text between two of `{`, `}` and `;`. One ended by
 * `{` is a block's prelude, a selector or an at-rule's condition; one ended by `;` or `}` is a
 * declaration or an at-rule carrying its own arguments.
 *
 * @param {string} masked
 */
function statements(masked) {
  /** @type {{ at: number, text: string, prelude: boolean }[]} */
  const found = [];
  let start = 0;
  for (let i = 0; i <= masked.length; i += 1) {
    const char = masked[i];
    if (i === masked.length || char === '{' || char === '}' || char === ';') {
      const text = masked.slice(start, i);
      const lead = text.search(/\S/);
      if (lead !== -1) found.push({ at: start + lead, text: text.trim(), prelude: char === '{' });
      start = i + 1;
    }
  }
  return found;
}

/**
 * The colour functions in `text`, each with its arguments read to the balancing parenthesis.
 *
 * @param {string} text
 */
function colourFunctions(text) {
  const found = [];
  for (const match of text.matchAll(/(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/gi)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')' && --depth === 0) break;
    }
    found.push({
      index: match.index ?? 0,
      length: Math.min(end + 1, text.length) - (match.index ?? 0),
      name: match[1].toLowerCase(),
      args: text.slice(open + 1, end),
    });
  }
  return found;
}

/** @param {string} args */
function topLevel(args) {
  let depth = 0;
  let slash = false;
  let commas = 0;
  for (const char of args) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && char === '/') slash = true;
    else if (depth === 0 && char === ',') commas += 1;
  }
  return { slash, commas };
}

/**
 * Every colour literal in `text`: hex, colour functions and named colours, each marked with whether
 * it carries alpha.
 *
 * @param {string} text
 */
function colourLiterals(text) {
  /** @type {{ index: number, length: number, alpha: boolean }[]} */
  const found = [];
  for (const match of text.matchAll(/#([0-9a-f]+)(?![\w-])/gi)) {
    const digits = match[1].length;
    if ([3, 4, 6, 8].includes(digits)) {
      found.push({ index: match.index ?? 0, length: match[0].length, alpha: digits === 4 || digits === 8 });
    }
  }
  for (const fn of colourFunctions(text)) {
    const { slash, commas } = topLevel(fn.args);
    const alpha =
      fn.name === 'rgba' ||
      fn.name === 'hsla' ||
      slash ||
      ((fn.name === 'rgb' || fn.name === 'hsl') && commas === 3) ||
      (fn.name === 'color-mix' && /(?<![\w-])transparent(?![\w-])/i.test(fn.args));
    found.push({ index: fn.index, length: fn.length, alpha });
  }
  const named = new Set(NAMED_COLOURS);
  // A named colour is a whole identifier: not part of a custom property, a Sass variable, a class, an
  // id or a longer hyphenated name, and not a function (`tan()` is trigonometry).
  for (const match of text.matchAll(/(?<![\w$@#.%&-])([a-z]+)(?![\w(-])/gi)) {
    if (named.has(match[1].toLowerCase())) found.push({ index: match.index ?? 0, length: match[1].length, alpha: false });
  }
  return found.sort((a, b) => a.index - b.index);
}

/**
 * Every number with a unit or a percentage in `text`. A digit inside an identifier, a custom
 * property, a Sass variable or a hex colour is not one.
 *
 * @param {string} text
 */
function dimensions(text) {
  return [...text.matchAll(/(?<![\w.#$-])([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?(?![\w-])/gi)]
    .filter((match) => match[2] !== undefined)
    .map((match) => ({
      index: match.index ?? 0,
      length: match[0].length,
      value: Number(match[1]),
      unit: match[2].toLowerCase(),
    }));
}

/**
 * What is left of a type value once its references and CSS-wide keywords are taken out. Anything
 * left is a literal the contract's type roles cover.
 *
 * @param {string} value
 */
function typeLiteral(value) {
  return value
    .replace(/!\s*important\b/gi, '')
    .replace(/--[\w-]+/g, '')
    .replace(/\$[\w-]+/g, '')
    .replace(/\bvar(?=\()/gi, '')
    .replace(/(?<![\w-])(?:inherit|initial|unset|revert-layer|revert)(?![\w-])/gi, '')
    .replace(/[\s(),]/g, '');
}

/** @param {string} path */
const permitted = (path) =>
  PERMITTED.some((entry) => (entry.path.endsWith('/') ? path.startsWith(entry.path) : path === entry.path));

/**
 * The findings for a set of stylesheets, and how much was read. Pure: no filesystem, no git.
 *
 * `allowance` defaults to the configured one and is a parameter only so a test can show what a gate
 * written against the role would do to the real contract. No caller in this file passes one.
 *
 * @param {Stylesheet[]} stylesheets
 * @param {Allowance} [allowance]
 * @returns {Scan}
 */
export function scan(stylesheets, allowance = ALPHA_ALLOWANCE) {
  /** @type {Finding[]} */
  const findings = [];
  let outside = 0;
  let inside = 0;
  let allowed = 0;

  for (const { path, source } of stylesheets) {
    const free = permitted(path);
    if (free) inside += 1;
    else outside += 1;

    if (path.toLowerCase().endsWith('.sass')) {
      findings.push({ path, line: 0, rule: 'syntax', property: '', literal: '' });
      continue;
    }

    const masked = mask(source);
    const lineAt = (/** @type {number} */ offset) => source.slice(0, offset).split('\n').length;
    const quote = (/** @type {number} */ from, /** @type {number} */ length) =>
      source.slice(from, from + length).replace(/\s+/g, ' ').trim();
    const add = (
      /** @type {Rule} */ rule,
      /** @type {string} */ property,
      /** @type {number} */ from,
      /** @type {number} */ length
    ) => findings.push({ path, line: lineAt(from), rule, property, literal: quote(from, length) });

    for (const statement of statements(masked)) {
      const atRule = /^@([\w-]+)/.exec(statement.text);
      let property = '';
      let valueAt = statement.at;
      let value = statement.text;

      if (atRule) {
        if (UNREAD_AT_RULES.has(atRule[1].toLowerCase())) continue;
        property = `@${atRule[1]}`;
        valueAt = statement.at + atRule[0].length;
        value = statement.text.slice(atRule[0].length);
      } else if (statement.prelude) {
        // A selector. `#fed` there is an id, not a colour.
        continue;
      } else {
        const declaration = /^(\$?[A-Za-z_-][\w-]*)\s*:/.exec(statement.text);
        if (!declaration) {
          add('unread', '', statement.at, Math.min(statement.text.length, 60));
          continue;
        }
        property = declaration[1];
        valueAt = statement.at + declaration[0].length;
        value = statement.text.slice(declaration[0].length);
      }

      for (const literal of colourLiterals(value)) {
        const at = valueAt + literal.index;
        if (!free) add('colour', property, at, literal.length);
        else if (literal.alpha) {
          if (path === allowance.path && property === allowance.property) allowed += 1;
          else add('alpha', property, at, literal.length);
        }
      }
      if (free) continue;

      const measured = dimensions(value);
      for (const dimension of measured) {
        if (dimension.unit === 'px' && dimension.value === 44) add('tap', property, valueAt + dimension.index, dimension.length);
      }

      const name = property.toLowerCase();
      if (!atRule && SPACING_PROPERTY.test(name)) {
        for (const dimension of measured) {
          const tap = dimension.unit === 'px' && dimension.value === 44;
          if (dimension.value !== 0 && !tap && SCALE_UNITS.includes(dimension.unit)) {
            add('spacing', property, valueAt + dimension.index, dimension.length);
          }
        }
      }
      if (!atRule && TYPE_PROPERTIES.includes(name) && typeLiteral(value) !== '') {
        const lead = value.search(/\S/);
        add('type', property, valueAt + Math.max(lead, 0), value.trim().length);
      }
    }
  }

  findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
  return { outside, inside, allowed, findings };
}

// ---------------------------------------------------------------------------
// Listing the tree.
// ---------------------------------------------------------------------------

const code = (/** @type {unknown} */ error) => {
  if (error instanceof Error && typeof (/** @type {{ code?: unknown }} */ (error).code) === 'string') {
    return String(/** @type {{ code?: unknown }} */ (error).code);
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Every stylesheet under `root` that git tracks or would track, read, and the scan of them.
 *
 * `git ls-files --cached --others --exclude-standard` is the committed tree plus whatever a commit
 * would carry. Gitignored build output, `public/contracts/` and `.next/` among it, is never a
 * stylesheet a commit carries, which is why the listing is git's rather than a directory walk.
 * `-z` with `core.quotePath=false` keeps an unusual path byte for byte, as
 * `app/__tests__/anchor-contract.test.ts` lists the tree.
 *
 * @param {string} root
 * @returns {Inspection}
 */
export function inspect(root) {
  const run = spawnSync(
    'git',
    [
      '-c', 'core.quotePath=false',
      'ls-files', '-z', '--cached', '--others', '--exclude-standard',
      '--', ...EXTENSIONS.map((extension) => `*.${extension}`),
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const empty = { outside: 0, inside: 0, allowed: 0, findings: [] };
  if (run.error) return { read: false, error: `git could not be run (${code(run.error)})`, ...empty };
  if (run.status !== 0) {
    const reason = String(run.stderr ?? '').trim().split('\n')[0] || 'no message';
    return { read: false, error: `git ls-files exited ${run.status} (${reason})`, ...empty };
  }

  const paths = [...new Set(run.stdout.split('\0').filter((path) => path !== ''))].sort();
  /** @type {Stylesheet[]} */
  const stylesheets = [];
  /** @type {Finding[]} */
  const unreadable = [];
  for (const path of paths) {
    try {
      stylesheets.push({ path, source: readFileSync(join(root, path), 'utf8') });
    } catch (error) {
      // Listed by the index and gone from the working tree: a deletion not yet staged, which no
      // build reads. Anything else that stops a read is a refusal, never a silent skip.
      if (code(error) === 'ENOENT') continue;
      unreadable.push({ path, line: 0, rule: 'unreadable', property: '', literal: code(error) });
    }
  }
  const scanned = scan(stylesheets);
  return { read: true, error: null, ...scanned, findings: [...unreadable, ...scanned.findings] };
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------

/**
 * The code points escaped in a printed path or literal: the C0 and C1 controls, and the marks that
 * reorder or break a line without being drawn (U+200E, U+200F, U+2028, U+2029, U+202A to U+202E,
 * U+2066 to U+2069). Compared as numbers, so no such character has to be written into this file.
 */
const UNPRINTABLE = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200e, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];

/** A path or literal as it is safe to print, so a stylesheet's name cannot forge a line. */
const printable = (/** @type {string} */ text) =>
  [...text]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (!UNPRINTABLE.some(([from, to]) => point >= from && point <= to)) return character;
      return point > 0xff ? `\\u${point.toString(16).padStart(4, '0')}` : `\\x${point.toString(16).padStart(2, '0')}`;
    })
    .join('');

/** @type {Record<Rule, string>} */
const REMEDY = {
  colour: 'a colour literal outside the permitted set. Name a --token-* role',
  alpha: `alpha outside the one allowance, ${ALPHA_ALLOWANCE.property} in ${ALPHA_ALLOWANCE.path}. Alpha is not a colour; a scrim consumes var(--token-scrim)`,
  tap: 'a hand-written 44px. The hit-target floor is var(--tap)',
  spacing: 'a spacing literal. Spacing is a scale: a --s-* step, or --page-pad',
  type: 'a type literal. Name the --f-*, --t-*, --w-*, --lh-* or --tr-* role',
  unread: 'a statement this gate cannot read as a declaration, so it refuses rather than skip it',
  syntax: 'Sass indented syntax, which this gate does not parse, so it refuses rather than skip it',
  unreadable: 'could not be read',
};

const FR17 = [
  '  FR-17 (R8): no colour, spacing or type literal in any stylesheet outside the permitted set,',
  `  ${PERMITTED.map((entry) => entry.path).join(' and ')}, and no alpha anywhere but`,
  `  ${ALPHA_ALLOWANCE.property} in ${ALPHA_ALLOWANCE.path}. AD-21 makes this blocking.`,
];

/** @param {string[]} detail */
const refusal = (detail) => ['literal conformance: REFUSED', ...FR17, ...detail].join('\n');

/**
 * @param {Finding} finding
 */
const describe = (finding) => {
  const where = `${printable(finding.path)}${finding.line > 0 ? `:${finding.line}` : ''}`;
  if (finding.rule === 'unreadable') return `${where}: ${REMEDY.unreadable} (${printable(finding.literal)})`;
  if (finding.rule === 'syntax') return `${where}: ${REMEDY.syntax}`;
  if (finding.rule === 'unread') return `${where}: "${printable(finding.literal)}", ${REMEDY.unread}`;
  return `${where}: ${printable(finding.property)}: ${printable(finding.literal)}, ${REMEDY[finding.rule]}`;
};

/**
 * Turn an inspection into the operator's message and the process's verdict.
 *
 * @param {Inspection} inspection
 * @returns {Result}
 */
export function report(inspection) {
  if (!inspection.read) {
    return {
      ok: false,
      message: refusal([
        `  The stylesheets could not be listed: ${printable(String(inspection.error))}.`,
        '  A gate that passes over files it never read is worse than none, so this is a refusal,',
        '  never a pass. It lists with git, from the repository root beside ops/.',
      ]),
    };
  }

  if (inspection.findings.length > 0) {
    const count = inspection.findings.length;
    return {
      ok: false,
      message: refusal([
        `  ${count} ${count === 1 ? 'finding' : 'findings'}:`,
        ...inspection.findings.map((finding) => `    ${describe(finding)}.`),
        '  The permitted set, the one alpha allowance and the four dispositions are named entries in',
        '  ops/literal-conformance.mjs, each with its reason; changing one is a reviewed edit to that',
        '  list. No comment in a stylesheet silences this gate. See ops/literal-conformance.md.',
      ]),
    };
  }

  if (inspection.outside === 0) {
    return {
      ok: false,
      message: refusal([
        '  No stylesheet outside the permitted set was read, so a pass would say nothing about the',
        '  Hub. A green run has to mean the tree was read.',
      ]),
    };
  }

  const read = inspection.outside + inspection.inside;
  return {
    ok: true,
    message:
      `literal conformance: read ${read} ${read === 1 ? 'stylesheet' : 'stylesheets'}, ` +
      `${inspection.outside} outside the permitted set ` +
      `and ${inspection.inside} inside it; no colour, spacing or type literal outside it, and ` +
      `${inspection.allowed} alpha, on ${ALPHA_ALLOWANCE.property} in ${ALPHA_ALLOWANCE.path} (FR-17, AD-21).`,
  };
}

/**
 * The whole CLI as a function. It takes nothing: the root is this module's parent directory, so no
 * caller and no environment can point the gate at a tree nobody committed.
 *
 * @returns {Result}
 */
export function main() {
  return report(inspect(fileURLToPath(new URL('..', import.meta.url))));
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    // Never answer "no" here: a guard that decides it was not invoked runs nothing and exits 0,
    // which is the gate failing open. Compare the paths as written instead.
    return resolve(a) === resolve(b);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main();
  const stream = result.ok ? process.stdout : process.stderr;
  // The verdict is recorded before anything is written: a stream torn down before its callback runs
  // never calls it, and the process would then fall off the end of this module and exit 0.
  process.exitCode = result.ok ? 0 : 1;
  // Exit from the write callback, so a pipe is flushed before the process leaves.
  stream.write(`${result.message}\n`, () => process.exit(result.ok ? 0 : 1));
}
