// The asset budget measurer (Story 2-2, SM-C5, EXPERIENCE.md open item O-2).
// Reads a production `.next/` and prints the markdown block that goes into
// `ops/asset-budget.md`, plus the findings.
//
// No dependencies, deliberately, for the same reason `ops/capacity-summary.mjs`
// has none: a bundle analyser would be a second thing to keep pinned and a
// second thing to trust, and `.next/` already holds every byte this needs. It is
// committed rather than run ad hoc because a measurement nobody can re-run is an
// anecdote, and the arithmetic here is what a budget gets written against.
//
// The five rules it exists to enforce:
//
//   1. The route's own prerendered HTML is the ground truth for what a document
//      references. Turbopack writes no `app-build-manifest.json`, and
//      `build-manifest.json` carries only `rootMainFiles` and `polyfillFiles`,
//      so a manifest read would report a subset and call it the total.
//   2. Attribution is by fingerprint, and every fingerprint is proved against
//      every chunk in the build rather than asserted. Turbopack minifies to
//      numeric module ids and emits no module paths, so a fingerprint is the
//      only lever, and a loose one (`gsap` matches the app's own
//      `useGsapContext`) would attribute shell code to a library.
//   3. KB is 1000 bytes and gzip is level 9, matching `ops/font-contract.md:136`
//      and `packages/fonts/subset.py`, so a figure here and a figure there mean
//      the same thing.
//   4. Nothing is estimated and nothing is left to the reader. A file that is
//      referenced and not on disk stops the run rather than being counted as
//      zero, and a route that is never served says so from
//      `.next/routes-manifest.json` rather than from a sentence somebody wrote
//      into the record by hand.
//   5. Two runs against one build print the same bytes. Nothing here reads a
//      clock, a locale or a random source: the reading is stamped with the
//      build's own timestamp and the commit, not with the time it was run.
//
// It measures and prints. It changes nothing, gates nothing, and a budget breach
// is a finding it records, not a reason to exit non-zero. Story 2-34 is the gate
// story.

import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** KB is 1000 bytes throughout, matching `ops/font-contract.md:136`. */
export const KB = 1000;

/** UX-DR7 and `EXPERIENCE.md:945`. The number that binds. */
export const NON_3D_BUDGET_BYTES = 140 * KB;

/** `EXPERIENCE.md:943`, the HTML plus critical CSS line of the same budget. */
export const HTML_AND_CSS_BUDGET_BYTES = 20 * KB;

/** `EXPERIENCE.md:944` and `packages/fonts/faces.json:3`. */
export const FONT_BUDGET_BYTES = 120 * KB;

/** `EXPERIENCE.md:946`, the estimate this story replaces with a measurement. */
export const NARRATIVE_ESTIMATE_BYTES = [300 * KB, 450 * KB];

/**
 * The libraries `EXPERIENCE.md:946` names as the narrative bundle, plus the two
 * transitive ones that carry most of the bytes those names imply
 * (`three-stdlib` under drei, `postprocessing` under
 * `@react-three/postprocessing`).
 *
 * `mark` is a literal string from the library's own source that no other source
 * in this tree produces. `webgl` marks the WebGL stack, which is what makes a
 * route a 3D route: `gsap` and `lenis` are narrative libraries too, and they are
 * on every route, which is the whole finding.
 *
 * Every mark is checked against every chunk on every run, and a mark that
 * matches nothing stops the run. See `proveFingerprints`.
 */
export const FINGERPRINTS = [
  { library: 'three', mark: 'WebGLRenderer', webgl: true },
  { library: '@react-three/fiber', mark: 'react-three-fiber', webgl: true },
  { library: '@react-three/drei', mark: 'onIncline', webgl: true },
  { library: 'three-stdlib', mark: 'OrbitControls.js encountered', webgl: true },
  { library: '@react-three/postprocessing', mark: '@react-three/postprocessing', webgl: true },
  { library: 'postprocessing', mark: 'KawaseBlurPass', webgl: true },
  { library: 'gsap', mark: 'GSAP target ', webgl: false },
  { library: 'gsap/ScrollTrigger', mark: 'scrollerProxy', webgl: false },
  { library: 'gsap/SplitText', mark: 'SplitText called before fonts loaded', webgl: false },
  { library: 'lenis', mark: 'lenisVersion', webgl: false },
];

/**
 * Marks that name a chunk carrying no narrative library, so the record can say
 * what the largest contributor to the non-3D total actually is rather than
 * quoting a content hash at the reader. These never affect classification: a
 * chunk is narrative-bearing if and only if a `FINGERPRINTS` mark hits it.
 *
 * Unlike the fingerprints above these are not required to match anything. A
 * build that stops shipping a polyfill chunk is not a defect in this tool.
 */
export const SHELL_MARKS = [
  { name: 'react-dom', mark: 'react-dom' },
  { name: 'the Next app router', mark: 'flightRouterState' },
  { name: 'core-js polyfills', mark: 'core-js' },
];

/** Thrown for a build this tool will not measure, never for a defect in it. */
export class BudgetError extends Error {}

// --- bytes -------------------------------------------------------------------

/**
 * Gzipped length at level 9, the level `packages/fonts/subset.py` uses, so a
 * font figure here and a font figure in `ops/font-contract.md:140-148` are the
 * same measurement.
 *
 * @param {Buffer|Uint8Array} bytes
 * @returns {number}
 */
export function gzipBytes(bytes) {
  return gzipSync(bytes, { level: 9 }).length;
}

/**
 * Group digits in threes, without `toLocaleString`, which answers differently
 * under a different `LANG` and would make two runs of this tool disagree.
 *
 * @param {number} value
 * @returns {string}
 */
export function group(value) {
  const negative = value < 0;
  const digits = String(Math.abs(Math.round(value)));
  let out = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) out += ',';
    out += digits[index];
  }
  return negative ? `-${out}` : out;
}

/**
 * A share of a whole, to one decimal place. Used only for margins, never to
 * decide anything.
 *
 * @param {number} part
 * @param {number} whole
 * @returns {string}
 */
export function percent(part, whole) {
  if (whole === 0) return 'n/a';
  return `${((part / whole) * 100).toFixed(1)} percent`;
}

/** The column the `ops/` records are hard-wrapped at. */
export const WRAP_COLUMNS = 100;

/**
 * Greedy word wrap, so the printed block is pasted into the record without
 * being re-flowed by hand and two runs cannot differ on where a line broke.
 * Words longer than the width get their own line rather than being cut.
 *
 * @param {string} text
 * @param {string} [indent] prefix for every line after the first
 * @param {number} [width]
 * @returns {string[]}
 */
export function wrap(text, indent = '', width = WRAP_COLUMNS) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter((word) => word !== '');
  if (words.length === 0) return [];
  const lines = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const prefix = lines.length === 0 ? '' : indent;
    if (`${prefix}${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  lines.push(line);
  return lines.map((entry, index) => (index === 0 ? entry : `${indent}${entry}`));
}

// --- paths -------------------------------------------------------------------

/**
 * Collapse `.` and `..` out of a segment list and join it with forward slashes,
 * so a path this tool prints is the same on Windows and on a runner.
 *
 * @param {string[]} segments
 * @returns {string}
 */
export function normalisePath(segments) {
  const out = [];
  for (const segment of segments.flatMap((entry) => String(entry).split(/[\\/]/))) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

/** `a\b` to `a/b`, applied to anything this tool is going to print or compare. */
const posix = (path) => String(path).split('\\').join('/');

/**
 * The path part of an href, with the query, the fragment and any percent
 * encoding removed.
 *
 * Without the decode, a document that writes `/fonts/My%20Face.woff2` resolves
 * to a file name that is not on disk and aborts the run claiming a file that
 * exists is missing, which is a refusal for the wrong reason.
 *
 * @param {string} href
 * @returns {string}
 */
export function normaliseHref(href) {
  const path = String(href).split('#')[0].split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    // A malformed escape sequence is not something to guess at. Hand back what
    // was written so the resolution below either finds the file or refuses by
    // name, rather than silently substituting a path nobody authored.
    return path;
  }
}

// --- the prerendered documents -----------------------------------------------

const TAG = /<(script|link)\b([^>]*)>/gi;
const ATTRIBUTE = /([:a-zA-Z_][-:.\w]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * The `rel` tokens that put bytes on the wire. `modulepreload` is folded into
 * `preload` because it costs the same download and keeping it separate would
 * mean a fourth arm on every arithmetic partition below for no gain.
 * `preconnect` (which fetches nothing) and `icon` are deliberately absent.
 */
const REL_KINDS = new Map([
  ['stylesheet', 'stylesheet'],
  ['preload', 'preload'],
  ['modulepreload', 'preload'],
]);

/**
 * Read one tag's attributes into a map. Names are lowercased, because the HTML
 * carries both `crossOrigin` and `noModule` in camel case and `rel` in lower.
 *
 * @param {string} source the text between the tag name and the closing bracket
 * @returns {Record<string, string>}
 */
export function parseAttributes(source) {
  const out = {};
  ATTRIBUTE.lastIndex = 0;
  let match = ATTRIBUTE.exec(source);
  while (match !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    out[match[1].toLowerCase()] = value;
    match = ATTRIBUTE.exec(source);
  }
  return out;
}

/**
 * Every asset one prerendered document references: `<script src>`, and a `<link>`
 * whose `rel` carries `stylesheet`, `preload` or `modulepreload`.
 *
 * `rel` is a space-separated token list, so `rel="preload stylesheet"` is read
 * as both. Matching the whole attribute against one word would drop such a link
 * entirely, and a dropped preload understates the wire total, which is the
 * number the budget is checked against.
 *
 * Deduplicated on the **resolved path**, not on the raw href: a chunk that is
 * both preloaded and scripted is one download, and so are `/x.woff2` and
 * `/x.woff2?v=2`. The kinds are kept so the record can say which is which.
 *
 * `noModule` is carried rather than dropped: a modern browser never fetches
 * that script, and a total that hides it cannot be checked by a reader.
 *
 * @param {string} html
 * @returns {{href: string, path: string|null, kinds: string[], noModule: boolean,
 *            as: string|null, fetchPriority: string|null}[]}
 */
export function parseDocumentReferences(html) {
  const byKey = new Map();
  TAG.lastIndex = 0;
  let match = TAG.exec(html);
  while (match !== null) {
    const tag = match[1].toLowerCase();
    const attributes = parseAttributes(match[2]);
    const rel = (attributes.rel ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token !== '');

    const kinds = [];
    let href = null;
    if (tag === 'script' && attributes.src) {
      kinds.push('script');
      href = attributes.src;
    } else if (tag === 'link' && attributes.href) {
      for (const token of rel) {
        const kind = REL_KINDS.get(token);
        if (kind && !kinds.includes(kind)) kinds.push(kind);
      }
      if (kinds.length > 0) href = attributes.href;
    }

    if (href !== null && kinds.length > 0) {
      const path = resolveReference(href);
      const key = path ?? `off-origin:${href}`;
      const existing = byKey.get(key) ?? {
        href,
        path,
        kinds: [],
        noModule: false,
        as: attributes.as ?? null,
        fetchPriority: attributes.fetchpriority ?? null,
      };
      for (const kind of kinds) if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
      if ('nomodule' in attributes) existing.noModule = true;
      if (existing.as === null && attributes.as) existing.as = attributes.as;
      if (existing.fetchPriority === null && attributes.fetchpriority) {
        existing.fetchPriority = attributes.fetchpriority;
      }
      byKey.set(key, existing);
    }
    match = TAG.exec(html);
  }

  const key = (entry) => entry.path ?? entry.href;
  return [...byKey.values()]
    .map((entry) => ({ ...entry, kinds: [...entry.kinds].sort() }))
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/**
 * Where an href a document carries lives on disk, relative to the repository
 * root. `/_next/X` is written by the build into `.next/X`; every other rooted
 * path is served from `public/`.
 *
 * A scheme, a protocol-relative href or anything not rooted at `/` answers
 * `null`: this tool measures what this build ships, and an off-origin asset is
 * not that.
 *
 * @param {string} href
 * @returns {string|null}
 */
export function resolveReference(href) {
  const path = normaliseHref(href);
  if (path === '' || path === '/') return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/_next/')) return normalisePath(['.next', path.slice('/_next/'.length)]);
  return normalisePath(['public', path.slice(1)]);
}

/**
 * The route one prerendered document answers, from its path relative to
 * `.next/server/app`. Taken from the whole relative path rather than the
 * basename, so a nested document is its own route instead of colliding with a
 * top-level one of the same name.
 *
 * @param {string} file path relative to `.next/server/app`
 * @returns {string}
 */
export function routeOf(file) {
  const stem = posix(file).replace(/\.html$/i, '');
  const segments = stem.split('/').filter((segment) => segment !== '');
  if (segments.at(-1) === 'index') segments.pop();
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

// --- chunk attribution -------------------------------------------------------

/**
 * The libraries whose fingerprints are present in one chunk's text.
 *
 * @param {string} text
 * @param {typeof FINGERPRINTS} [fingerprints]
 * @returns {string[]}
 */
export function chunkLibraries(text, fingerprints = FINGERPRINTS) {
  return fingerprints.filter((entry) => text.includes(entry.mark)).map((entry) => entry.library);
}

/**
 * What a chunk carrying no narrative library is, by the same method.
 *
 * @param {string} text
 * @param {typeof SHELL_MARKS} [marks]
 * @returns {string[]}
 */
export function chunkShellMarks(text, marks = SHELL_MARKS) {
  return marks.filter((entry) => text.includes(entry.mark)).map((entry) => entry.name);
}

/**
 * Check every fingerprint against every chunk and return the hit set, so the
 * claim that a mark discriminates is demonstrated in the record rather than
 * asserted in a comment.
 *
 * A mark that matches nothing is a defect in the table above rather than in the
 * build, and it throws: a run that quietly attributed nothing to `three` would
 * print a narrative total of zero and read like a passing budget.
 *
 * @param {{name: string, text: string}[]} chunks
 * @param {typeof FINGERPRINTS} [fingerprints]
 * @returns {{library: string, mark: string, webgl: boolean, hits: {name: string, count: number}[]}[]}
 */
export function proveFingerprints(chunks, fingerprints = FINGERPRINTS) {
  // An empty mark would make the scan below advance zero bytes per hit and never
  // terminate. It is refused rather than guarded against, because a fingerprint
  // that matches every position discriminates nothing.
  const blank = fingerprints.filter((entry) => typeof entry.mark !== 'string' || entry.mark === '');
  if (blank.length > 0) {
    throw new BudgetError(
      `the fingerprint for ${blank.map((entry) => entry.library).join(', ')} is empty. ` +
        'An empty mark matches every position in every chunk and attributes nothing.'
    );
  }

  const proof = fingerprints.map((entry) => {
    const hits = [];
    for (const chunk of chunks) {
      let count = 0;
      let at = chunk.text.indexOf(entry.mark);
      while (at !== -1) {
        count += 1;
        at = chunk.text.indexOf(entry.mark, at + entry.mark.length);
      }
      if (count > 0) hits.push({ name: chunk.name, count });
    }
    hits.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return { library: entry.library, mark: entry.mark, webgl: entry.webgl, hits };
  });

  const empty = proof.filter((entry) => entry.hits.length === 0);
  if (empty.length > 0) {
    throw new BudgetError(
      `no chunk in this build carries the fingerprint for ${empty
        .map((entry) => `${entry.library} (${JSON.stringify(entry.mark)})`)
        .join(', ')}. The fingerprint table in ops/asset-budget.mjs no longer describes the ` +
        'build, so no attribution it produces can be trusted. Fix the table, do not widen it.'
    );
  }
  return proof;
}

// --- font faces --------------------------------------------------------------

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const DECLARATION = /(--[\w-]+|font-family)\s*:\s*([^;{}]+)/g;
const URL_IN_SRC = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

/** Best format first, so a family's format list reads the same way every time. */
const FORMAT_ORDER = ['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'];

/**
 * Strip the family name of its quotes, its outer whitespace and a trailing
 * `!important`, so `"Geist"`, `Geist` and `Geist !important` are one family
 * rather than three.
 *
 * @param {string} raw
 * @returns {string}
 */
export function unquote(raw) {
  const trimmed = String(raw)
    .replace(/\s*!\s*important\s*$/i, '')
    .trim();
  if (
    trimmed.length >= 2 &&
    (trimmed[0] === '"' || trimmed[0] === "'") &&
    trimmed.at(-1) === trimmed[0]
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * The key two family names are compared on. CSS matches a family name
 * case-insensitively and collapses internal whitespace, so `"Geist Mono"` in a
 * `@font-face` and `geist  mono` in a rule are the same family and must not
 * read as a declared face nothing reaches.
 *
 * @param {string} family
 * @returns {string}
 */
export function familyKey(family) {
  return unquote(family).replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Find the `var()` calls in a value, each with its fallback arm, honouring
 * nested parentheses so `var(--a, var(--b, "Geist"))` reads as one call rather
 * than as a truncated match.
 *
 * @param {string} value
 * @returns {{start: number, end: number, name: string, fallback: string|null}[]}
 */
export function findVarCalls(value) {
  const text = String(value);
  const calls = [];
  for (let index = 0; index < text.length; index += 1) {
    if (!text.startsWith('var(', index)) continue;
    let depth = 1;
    let end = -1;
    for (let scan = index + 4; scan < text.length; scan += 1) {
      if (text[scan] === '(') depth += 1;
      else if (text[scan] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = scan;
          break;
        }
      }
    }
    if (end === -1) break;
    const inside = text.slice(index + 4, end);

    let comma = -1;
    let nested = 0;
    for (let scan = 0; scan < inside.length; scan += 1) {
      if (inside[scan] === '(') nested += 1;
      else if (inside[scan] === ')') nested -= 1;
      else if (inside[scan] === ',' && nested === 0) {
        comma = scan;
        break;
      }
    }

    const name = (comma === -1 ? inside : inside.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inside.slice(comma + 1).trim();
    if (/^--[\w-]+$/.test(name)) calls.push({ start: index, end: end + 1, name, fallback });
    index = end;
  }
  return calls;
}

/**
 * Every `@font-face` the built CSS declares, with the urls it names.
 *
 * @param {string} css
 * @returns {{family: string, urls: string[]}[]}
 */
export function parseFontFaces(css) {
  const faces = [];
  FONT_FACE.lastIndex = 0;
  let block = FONT_FACE.exec(css);
  while (block !== null) {
    const body = block[1];
    const family = /font-family\s*:\s*([^;{}]+)/.exec(body);
    if (family) {
      const urls = [];
      URL_IN_SRC.lastIndex = 0;
      let url = URL_IN_SRC.exec(body);
      while (url !== null) {
        urls.push(url[1] ?? url[2] ?? url[3] ?? '');
        url = URL_IN_SRC.exec(body);
      }
      faces.push({ family: unquote(family[1]), urls });
    }
    block = FONT_FACE.exec(css);
  }
  return faces;
}

/**
 * Every custom property the built CSS defines, and every `font-family` value it
 * uses outside a `@font-face` block. The `@font-face` blocks are removed first:
 * inside one, `font-family` is a declaration of a face, not a use of it, and
 * conflating the two makes every declared family look reachable.
 *
 * @param {string} css
 * @returns {{properties: Map<string, string>, uses: string[]}}
 */
export function parseFontUses(css) {
  const withoutFaces = css.replace(FONT_FACE, '');
  const properties = new Map();
  const uses = [];

  // Custom properties are read from the whole sheet, including inside a
  // `@font-face`, because a definition's position does not change what it holds.
  DECLARATION.lastIndex = 0;
  let declaration = DECLARATION.exec(css);
  while (declaration !== null) {
    if (declaration[1].startsWith('--')) properties.set(declaration[1], declaration[2].trim());
    declaration = DECLARATION.exec(css);
  }

  DECLARATION.lastIndex = 0;
  declaration = DECLARATION.exec(withoutFaces);
  while (declaration !== null) {
    if (declaration[1] === 'font-family') {
      uses.push(declaration[2].replace(/\s*!\s*important\s*$/i, '').trim());
    }
    declaration = DECLARATION.exec(withoutFaces);
  }

  return { properties, uses: [...new Set(uses)].sort() };
}

/** How far a `var()` chain is followed before it is reported unresolved. */
export const MAX_VAR_HOPS = 8;

/**
 * Follow `var()` through the custom properties until the value names families
 * rather than properties.
 *
 * The design's own aliases are two hops deep (`--monument-bold` holds
 * `var(--f-display)`, which holds the family), so stopping at one would report a
 * reachable face as unreachable. A property with no definition and no fallback
 * arm is returned as unresolved rather than as naming nothing: "we could not
 * tell" and "no face is reachable through it" are different claims and the
 * second is the one that would quietly justify deleting a face. A chain still
 * holding a `var()` when the hop limit runs out is unresolved for the same
 * reason.
 *
 * @param {string} value
 * @param {Map<string, string>} properties
 * @returns {{families: string[], unresolved: string[]}}
 */
export function resolveFontValue(value, properties) {
  let current = String(value).replace(/\s*!\s*important\s*$/i, '');
  const unresolved = new Set();

  for (let hop = 0; hop < MAX_VAR_HOPS; hop += 1) {
    const calls = findVarCalls(current);
    if (calls.length === 0) break;

    let next = '';
    let cursor = 0;
    let replaced = false;
    for (const call of calls) {
      next += current.slice(cursor, call.start);
      if (properties.has(call.name)) {
        next += properties.get(call.name);
        replaced = true;
      } else if (call.fallback !== null) {
        // The fallback arm is what a browser uses when the property is not
        // defined, so a face reached only through one is reached.
        next += call.fallback;
        replaced = true;
      } else {
        unresolved.add(call.name);
      }
      cursor = call.end;
    }
    next += current.slice(cursor);
    current = next;
    if (!replaced) break;
  }

  for (const call of findVarCalls(current)) unresolved.add(call.name);

  const families = current
    .split(',')
    .map((part) => unquote(part))
    .filter((part) => part !== '' && !part.includes('var('));

  return { families, unresolved: [...unresolved].sort() };
}

/**
 * Which declared families a `font-family` rule can actually reach.
 *
 * `families` is one entry per distinct family, not per `@font-face` block, and
 * every count the record prints is taken from it, so the denominator in
 * "nine of thirteen" cannot come from a different set than the numerator.
 *
 * @param {string} css
 * @returns {{faces: {family: string, urls: string[]}[],
 *            families: {family: string, blocks: number, urls: string[], reachable: boolean}[],
 *            reachable: string[], unreachable: string[], unresolved: string[],
 *            uses: {value: string, families: string[]}[]}}
 */
export function resolveFontReachability(css) {
  const faces = parseFontFaces(css);
  const { properties, uses } = parseFontUses(css);

  const reached = new Set();
  const unresolved = new Set();
  const resolvedUses = [];
  for (const use of uses) {
    const resolved = resolveFontValue(use, properties);
    for (const family of resolved.families) reached.add(familyKey(family));
    for (const name of resolved.unresolved) unresolved.add(name);
    resolvedUses.push({ value: use, families: resolved.families });
  }

  const byFamily = new Map();
  for (const face of faces) {
    const key = familyKey(face.family);
    const entry = byFamily.get(key) ?? { family: face.family, blocks: 0, urls: [], reachable: reached.has(key) };
    entry.blocks += 1;
    for (const url of face.urls) if (!entry.urls.includes(url)) entry.urls.push(url);
    byFamily.set(key, entry);
  }
  const families = [...byFamily.values()].sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));

  return {
    faces,
    families,
    reachable: families.filter((entry) => entry.reachable).map((entry) => entry.family),
    unreachable: families.filter((entry) => !entry.reachable).map((entry) => entry.family),
    unresolved: [...unresolved].sort(),
    uses: resolvedUses,
  };
}

/**
 * Where a `url()` inside a built `@font-face` could live on disk, most likely
 * first. A relative url in the built CSS is relative to the chunk that declares
 * it; a rooted one is served from `public/`; and the SCSS sources point at
 * `public/fonts/`, so a face served from there rather than hashed into the build
 * must not read as absent.
 *
 * An empty list means the url fetches no file of this build's (a `data:` URI or
 * an off-origin stylesheet), which is not a missing file.
 *
 * @param {string} url
 * @returns {string[]} candidate paths relative to the repository root
 */
export function resolveFontUrl(url) {
  const path = normaliseHref(url);
  if (path === '') return [];
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return [];
  if (path.startsWith('/')) {
    return [
      path.startsWith('/_next/')
        ? normalisePath(['.next', path.slice('/_next/'.length)])
        : normalisePath(['public', path.slice(1)]),
    ];
  }
  const name = path.split('/').pop() ?? path;
  return [
    ...new Set([
      normalisePath(['.next', 'static', 'chunks', path]),
      normalisePath(['.next', 'static', 'media', name]),
      normalisePath(['public', 'fonts', name]),
    ]),
  ];
}

// --- the source tree ---------------------------------------------------------

/** Where a component may be authored. `__tests__` is excluded everywhere. */
const SOURCE_ROOTS = ['app', 'components'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.scss', '.css'];
const MODULE_EXTENSIONS = ['.ts', '.tsx'];

/**
 * Every form that puts a module on the graph: `from '...'`, a dynamic
 * `import('...')`, and a bare side-effect `import '...'`. A barrel's
 * `export ... from '...'` matches the first arm, which is why a re-export does
 * not read as an orphan.
 */
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(?:"([^"]*)"|'([^']*)')/g;

/**
 * `app/` holds App Router entry points, which are reached by the router rather
 * than by an import, so "nothing imports it" is true of every one of them and
 * says nothing. Both orphan predicates exclude it, and they must exclude it in
 * the same way or an asset named only from a page reads as reachable by nothing.
 */
const ENTRY_ROOT = 'app/';

/** The `path:line` shape both reference finders return. */
const referrerPath = (reference) => reference.slice(0, reference.lastIndexOf(':'));

/**
 * Every file under `root/directory` whose extension is in `extensions` (all of
 * them when the list is empty), recursively, excluding any path with a
 * `__tests__` or `node_modules` segment, sorted, with POSIX separators. Sorting
 * is what makes two runs of this tool byte-identical on a filesystem that does
 * not promise an order.
 *
 * @param {string} root the repository root
 * @param {string} directory relative to it
 * @param {string[]} extensions
 * @returns {string[]} paths relative to `root`
 */
export function listFiles(root, directory, extensions) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(path);
        continue;
      }
      if (extensions.length === 0 || extensions.includes(extname(entry.name))) {
        out.push(posix(relative(root, path)));
      }
    }
  };
  walk(absolute);
  return out.sort();
}

/**
 * Where a needle appears in a set of files, as `path:line`.
 *
 * The match is bounded on both sides, so `gem.glb` does not hit a line naming
 * `gem.glb.map` and one asset whose name is a prefix of another is not reported
 * as referenced by whatever mentions the longer one.
 *
 * @param {string} root
 * @param {string[]} files paths relative to `root`
 * @param {string} needle
 * @returns {string[]}
 */
export function findReferences(root, files, needle) {
  const pattern = new RegExp(`(?<![\\w.-])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`);
  const out = [];
  for (const file of files) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (pattern.test(line)) out.push(`${file}:${index + 1}`);
    });
  }
  return out;
}

/**
 * Resolve one import specifier to a path relative to the repository root, or
 * `null` for a bare package name. `@/` is the alias `tsconfig.json` maps onto
 * the root.
 *
 * @param {string} importer path relative to root
 * @param {string} specifier
 * @returns {string|null}
 */
export function resolveSpecifier(importer, specifier) {
  if (specifier.startsWith('@/')) return normalisePath([specifier.slice(2)]);
  if (specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../')) {
    return posix(relative('.', resolve(dirname(importer), specifier)));
  }
  return null;
}

/**
 * Which files under `app/` and `components/`, tests excluded, import the given
 * module. An empty answer is the orphan finding: the module is authored, it
 * compiles, and nothing puts it on a page.
 *
 * A directory specifier resolves to that directory's `index`, so
 * `import { Gem } from '@/components/atoms/Gem'` counts as an importer of
 * `components/atoms/Gem/index.tsx`. A false orphan is the expensive direction
 * here: this predicate is what asks the Operator to consider deleting a
 * published asset.
 *
 * @param {string} root
 * @param {string[]} modules paths relative to root, without a `__tests__` segment
 * @param {string} target path relative to root
 * @returns {string[]} `path:line`
 */
export function findImporters(root, modules, target) {
  const withoutExtension = posix(target).slice(0, target.length - extname(target).length);
  const accepted = new Set([withoutExtension, posix(target)]);
  for (const extension of MODULE_EXTENSIONS) accepted.add(`${withoutExtension}${extension}`);
  if (basename(withoutExtension) === 'index') accepted.add(posix(dirname(withoutExtension)));

  const out = [];
  for (const file of modules) {
    if (file === target) continue;
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      IMPORT_SPECIFIER.lastIndex = 0;
      let match = IMPORT_SPECIFIER.exec(line);
      while (match !== null) {
        const resolved = resolveSpecifier(file, match[1] ?? match[2]);
        if (resolved !== null && accepted.has(resolved)) out.push(`${file}:${index + 1}`);
        match = IMPORT_SPECIFIER.exec(line);
      }
    });
  }
  return [...new Set(out)].sort();
}

// --- the tree this build came from -------------------------------------------

/** The directories a change to which would move a figure in this reading. */
const MEASURED_INPUTS = ['app', 'components', 'contracts', 'packages', 'public', 'next.config.js', 'package.json'];

/**
 * The commit the measured tree is at, and whether any measured input is dirty.
 *
 * Read from git rather than taken as an argument so the record cannot claim a
 * commit the reading was not taken at. Both values are properties of the tree,
 * not of the clock, so two runs against one build still agree.
 *
 * @param {string} root
 * @returns {{commit: string, dirty: string[]}}
 */
export function readProvenance(root) {
  const git = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  };
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain', '--', ...MEASURED_INPUTS]);
  return {
    commit: head === null ? 'unknown, git did not answer' : head.trim(),
    dirty:
      status === null
        ? []
        : status
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .sort(),
  };
}

// --- the model ---------------------------------------------------------------

/**
 * @typedef {{name: string, path: string, format: string, bytes: number, gzip: number}} FaceFile
 * @typedef {{family: string, blocks: number, urls: string[], reachable: boolean,
 *            files: FaceFile[], bytes: number, gzip: number, woff2: FaceFile|null}} FontFamily
 * @typedef {{faces: {family: string, urls: string[]}[], families: FontFamily[], reachable: string[],
 *            unreachable: string[], unresolved: string[],
 *            uses: {value: string, families: string[]}[]}} Fonts
 * @typedef {{library: string, mark: string, webgl: boolean,
 *            hits: {name: string, count: number}[]}} Proof
 * @typedef {{file: string, name: string, bytes: number, gzip: number, fromSource: string[],
 *            fromSibling: string[], referrers: string[], orphanedReferrers: string[],
 *            live: boolean}} Asset
 * @typedef {{buildId: string, builtAt: string, commit: string, dirty: string[], chunks: Chunk[],
 *            routes: Route[], proof: Proof[], fonts: Fonts,
 *            contractFaces: {file: string, bytes: number, gzip: number}[], assets: Asset[],
 *            orphanModules: string[]}} BuildModel
 */

/**
 * Read one build and everything the record needs to describe it.
 *
 * @param {string} root the repository root
 * @returns {BuildModel}
 */
export function collect(root) {
  const buildIdPath = join(root, '.next', 'BUILD_ID');
  if (!existsSync(buildIdPath)) {
    throw new BudgetError(
      'no production build to measure: .next/BUILD_ID is not there. Run `corepack pnpm build` first. ' +
        'A `next dev` server is not a substitute: it serves unminified modules and no chunk this tool can weigh.'
    );
  }
  const buildId = readFileSync(buildIdPath, 'utf8').trim();

  // The build's own timestamp, not the clock. A run date would make two runs
  // across midnight differ, and what the reader needs is which build this is,
  // which is a property of the build. Written to the second and in UTC, so it
  // cannot be mistaken for the local date the record was authored on.
  const builtAt = statSync(buildIdPath).mtime.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const provenance = readProvenance(root);

  // Every chunk in the build, read once, walked recursively: a chunk in a
  // subdirectory that was never fingerprinted would let a 3D route read as
  // non-3D, which is the one misclassification that moves the headline figure.
  const chunkRoot = join('.next', 'static', 'chunks');
  if (!existsSync(join(root, chunkRoot))) {
    throw new BudgetError('.next/BUILD_ID is there but .next/static/chunks is not. Re-run `corepack pnpm build`.');
  }
  const scripts = [];
  const styles = [];
  for (const path of listFiles(root, chunkRoot, ['.js', '.css'])) {
    const name = posix(relative(chunkRoot, path));
    const bytes = readFileSync(join(root, path));
    const entry = { name, path, bytes: bytes.length, gzip: gzipBytes(bytes), text: bytes.toString('utf8') };
    if (path.endsWith('.js')) scripts.push(entry);
    else styles.push(entry);
  }

  // Named before `proveFingerprints` runs, because an empty chunk directory
  // would otherwise surface as ten fingerprint failures and send the Operator
  // to fix a table that is not the problem.
  if (scripts.length === 0) {
    throw new BudgetError(
      `.next/static/chunks holds no .js file. This is an empty or partial build, not a fingerprint problem. ` +
        'Re-run `corepack pnpm build`.'
    );
  }
  if (styles.length === 0) {
    throw new BudgetError(
      '.next/static/chunks holds no .css file, so no `@font-face` can be read and every declared family would ' +
        'report as unreachable. Re-run `corepack pnpm build`.'
    );
  }

  const proof = proveFingerprints(scripts);
  const webglLibraries = new Set(FINGERPRINTS.filter((entry) => entry.webgl).map((entry) => entry.library));

  const chunks = new Map();
  for (const entry of [...scripts, ...styles]) {
    const libraries = entry.path.endsWith('.js') ? chunkLibraries(entry.text) : [];
    chunks.set(entry.path, {
      name: entry.name,
      path: entry.path,
      bytes: entry.bytes,
      gzip: entry.gzip,
      libraries,
      shell: libraries.length === 0 && entry.path.endsWith('.js') ? chunkShellMarks(entry.text) : [],
      webgl: libraries.some((library) => webglLibraries.has(library)),
      routes: [],
    });
  }

  // Which routes a request never reaches, read rather than asserted. A redirect
  // source is answered by the redirect, so its prerendered document exists and
  // is never served, and picking a "heaviest non-3D route" that no visitor can
  // load would put a figure in the record that describes nobody.
  const manifestPath = join(root, '.next', 'routes-manifest.json');
  const redirects = new Map();
  if (existsSync(manifestPath)) {
    let manifest = null;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      throw new BudgetError(
        `.next/routes-manifest.json is not readable JSON (${error instanceof Error ? error.message : String(error)}). ` +
          'Re-run `corepack pnpm build`.'
      );
    }
    for (const entry of manifest?.redirects ?? []) {
      // Only a literal source can be matched against a concrete document.
      // A parameterised source (`/:path+/`) is left out rather than guessed at.
      if (typeof entry?.source === 'string' && !entry.source.includes(':') && !entry.source.includes('*')) {
        redirects.set(entry.source, { destination: entry.destination ?? '', statusCode: entry.statusCode ?? 0 });
      }
    }
  }

  // The prerendered documents. Ground truth for what each route references, and
  // walked recursively for the same reason the chunks are.
  const appRoot = join('.next', 'server', 'app');
  const documents = listFiles(root, appRoot, ['.html']);
  if (documents.length === 0) {
    throw new BudgetError('no prerendered document under .next/server/app. Re-run `corepack pnpm build`.');
  }

  const missing = [];
  const routes = [];
  for (const path of documents) {
    const file = posix(relative(appRoot, path));
    const html = readFileSync(join(root, path));
    const references = [];
    for (const reference of parseDocumentReferences(html.toString('utf8'))) {
      if (reference.path === null) continue;
      const absolute = join(root, reference.path);
      if (!existsSync(absolute)) {
        missing.push(`${file} references ${reference.href}, which resolves to ${reference.path} and is not on disk`);
        continue;
      }
      const bytes = readFileSync(absolute);
      references.push({
        ...reference,
        bytes: bytes.length,
        gzip: gzipBytes(bytes),
        chunk: chunks.get(reference.path) ?? null,
      });
    }

    const route = routeOf(file);
    for (const reference of references) {
      if (reference.chunk && !reference.chunk.routes.includes(route)) reference.chunk.routes.push(route);
    }

    const documentGzip = gzipBytes(html);
    const sum = (predicate) => references.filter(predicate).reduce((total, entry) => total + entry.gzip, 0);
    const redirect = redirects.get(route) ?? null;
    routes.push({
      route,
      file,
      redirect,
      // A `_`-prefixed document is Next's own, not a path anybody navigates to.
      internal: route.split('/').some((segment) => segment.startsWith('_')),
      bytes: html.length,
      gzip: documentGzip,
      references,
      webgl: references.some((entry) => entry.chunk?.webgl),
      scriptGzip: sum((entry) => entry.kinds.includes('script')),
      styleGzip: sum((entry) => entry.kinds.includes('stylesheet') && !entry.kinds.includes('script')),
      preloadOnly: references.filter((entry) => entry.kinds.length === 1 && entry.kinds[0] === 'preload'),
      preloadOnlyGzip: sum((entry) => entry.kinds.length === 1 && entry.kinds[0] === 'preload'),
      fontGzip: sum((entry) => entry.as === 'font' || entry.path.startsWith('public/fonts/')),
      polyfillGzip: sum((entry) => entry.noModule),
      wireGzip: documentGzip + references.reduce((total, entry) => total + entry.gzip, 0),
    });
  }

  if (missing.length > 0) {
    throw new BudgetError(
      `a prerendered document references a file this build did not write:\n  ${missing.join('\n  ')}\n` +
        'Nothing is estimated here, so the run stops rather than counting it as zero.'
    );
  }

  for (const chunk of chunks.values()) chunk.routes.sort();

  // Fonts. The built CSS is the whole stylesheet graph as it ships, so a face
  // declared in one chunk and used from another still resolves.
  const fonts = resolveFontReachability(styles.map((entry) => entry.text).join('\n'));
  const absentFaces = [];
  fonts.families = fonts.families.map((family) => {
    const files = [];
    for (const url of family.urls) {
      const candidates = resolveFontUrl(url);
      if (candidates.length === 0) continue;
      const found = candidates.find((candidate) => existsSync(join(root, candidate)));
      if (found === undefined) {
        absentFaces.push(`${family.family} declares ${url}, which is none of ${candidates.join(', ')}`);
        continue;
      }
      const bytes = readFileSync(join(root, found));
      files.push({
        name: basename(found),
        path: found,
        format: extname(found).slice(1).toLowerCase(),
        bytes: bytes.length,
        gzip: gzipBytes(bytes),
      });
    }
    // Ordered by format rather than by hashed file name, so the Formats column
    // reads the same way for every family instead of following a content hash.
    const rank = (format) => {
      const at = FORMAT_ORDER.indexOf(format);
      return at === -1 ? FORMAT_ORDER.length : at;
    };
    files.sort((a, b) => rank(a.format) - rank(b.format) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return {
      ...family,
      files,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
      gzip: files.reduce((total, file) => total + file.gzip, 0),
      woff2: files.find((file) => file.format === 'woff2') ?? files[0] ?? null,
    };
  });

  if (absentFaces.length > 0) {
    throw new BudgetError(
      `a built @font-face names a file this build did not write:\n  ${absentFaces.join('\n  ')}\n` +
        'A face weighed as zero would understate every font figure, so the run stops instead.'
    );
  }

  // The published contract faces, re-measured from the committed binaries rather
  // than read out of `packages/fonts/faces.json`, so the record's font line and
  // that file cannot drift apart silently.
  const contractDir = join(root, 'contracts', 'fonts');
  const contractFaces = existsSync(contractDir)
    ? readdirSync(contractDir)
        .filter((file) => file.endsWith('.woff2'))
        .sort()
        .map((file) => {
          const bytes = readFileSync(join(contractDir, file));
          return { file, bytes: bytes.length, gzip: gzipBytes(bytes) };
        })
    : [];
  if (contractFaces.length === 0) {
    throw new BudgetError(
      'contracts/fonts holds no .woff2 file, so the budget font line would read as zero against ' +
        `${FONT_BUDGET_BYTES} and look like a pass. Nothing is estimated here, so the run stops instead.`
    );
  }

  // Narrative assets, and what names them.
  const sourceFiles = SOURCE_ROOTS.flatMap((directory) => listFiles(root, directory, SOURCE_EXTENSIONS));
  const moduleFiles = SOURCE_ROOTS.flatMap((directory) => listFiles(root, directory, MODULE_EXTENSIONS));
  const assetFiles = listFiles(root, join('public', 'assets', 'home'), []);
  const siblingText = assetFiles.filter((file) => ['.gltf', '.json'].includes(extname(file)));

  const importerCache = new Map();
  const isOrphanModule = (path) => {
    if (!MODULE_EXTENSIONS.includes(extname(path))) return false;
    if (path.startsWith(ENTRY_ROOT)) return false;
    if (!importerCache.has(path)) importerCache.set(path, findImporters(root, moduleFiles, path));
    return importerCache.get(path).length === 0;
  };

  const assets = assetFiles.map((file) => {
    const bytes = readFileSync(join(root, file));
    const name = basename(file);
    const fromSource = findReferences(root, sourceFiles, name);
    const fromSibling = findReferences(
      root,
      siblingText.filter((sibling) => sibling !== file),
      name
    );
    const sourceReferrers = [...new Set(fromSource.map(referrerPath))].sort();
    const orphanedReferrers = sourceReferrers.filter(isOrphanModule);
    return {
      file,
      name,
      bytes: bytes.length,
      gzip: gzipBytes(bytes),
      fromSource,
      fromSibling,
      referrers: [...fromSource, ...fromSibling],
      orphanedReferrers,
      // Live directly when some module that names it is itself reached. The
      // sibling chain is folded in below.
      live: sourceReferrers.some((path) => !orphanedReferrers.includes(path)),
    };
  });

  // Liveness is transitive: `gem_data.bin` is named only by `gem.gltf`, so it is
  // reachable exactly when that file is. Computed to a fixed point rather than
  // in one pass, because a chain of any length has to give the same answer as a
  // chain of one.
  const byFile = new Map(assets.map((asset) => [asset.file, asset]));
  for (let pass = 0; pass < assets.length; pass += 1) {
    let changed = false;
    for (const asset of assets) {
      if (asset.live) continue;
      for (const reference of asset.fromSibling) {
        const sibling = byFile.get(referrerPath(reference));
        if (sibling?.live) {
          asset.live = true;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }

  const orphanModules = moduleFiles.filter((file) => file.endsWith('.tsx')).filter(isOrphanModule).sort();

  return {
    buildId,
    builtAt,
    commit: provenance.commit,
    dirty: provenance.dirty,
    chunks: [...chunks.values()].sort((a, b) => b.gzip - a.gzip || (a.name < b.name ? -1 : 1)),
    routes,
    proof,
    fonts,
    contractFaces,
    assets,
    orphanModules,
  };
}

// --- the record --------------------------------------------------------------

const NATURE_OBSERVED = '**Observed**';
const NATURE_DERIVED = '**Derived**';
const NATURE_DECISION = '**Decision**';

/**
 * @typedef {{name: string, path: string, bytes: number, gzip: number, libraries: string[],
 *            shell: string[], webgl: boolean, routes: string[]}} Chunk
 * @typedef {{path: string, href: string, kinds: string[], noModule: boolean, as: string|null,
 *            fetchPriority: string|null, bytes: number, gzip: number, chunk: Chunk|null}} Reference
 * @typedef {{route: string, file: string, redirect: {destination: string, statusCode: number}|null,
 *            internal: boolean, bytes: number, gzip: number, references: Reference[],
 *            webgl: boolean, scriptGzip: number, styleGzip: number, preloadOnly: Reference[],
 *            preloadOnlyGzip: number, fontGzip: number, polyfillGzip: number,
 *            wireGzip: number}} Route
 * @typedef {{chunks: Chunk[], gzip: number, bytes: number, deferred: Chunk[], deferredGzip: number,
 *            heaviest3d: Route|null, onHeaviest3d: number, onWireGzip: number}} NarrativeReading
 * @typedef {{routes: Route[], served: Route[], heaviest: Route|null, measured: number,
 *            decomposed: number, decomposedTotal: number, contractGzip: number}} Non3dReading
 */

/**
 * @param {BuildModel} model
 * @returns {{narrative: NarrativeReading, non3d: Non3dReading, largest: Reference|null}}
 */
export function analyse(model) {
  const narrativeChunks = model.chunks.filter((chunk) => chunk.libraries.length > 0);
  const narrativeGzip = narrativeChunks.reduce((total, chunk) => total + chunk.gzip, 0);
  const narrativeBytes = narrativeChunks.reduce((total, chunk) => total + chunk.bytes, 0);
  const deferred = narrativeChunks.filter((chunk) => chunk.routes.length === 0);

  // The heaviest 3D route, because the build-wide total counts a library twice
  // when two route chunks each carry a copy and no single visitor pays for both.
  const heaviest3d =
    [...model.routes].filter((route) => route.webgl).sort((a, b) => b.wireGzip - a.wireGzip)[0] ?? null;
  const onHeaviest3d = heaviest3d
    ? heaviest3d.references
        .filter((reference) => reference.chunk && reference.chunk.libraries.length > 0)
        .reduce((total, reference) => total + reference.gzip, 0)
    : 0;

  const non3dRoutes = model.routes.filter((route) => !route.webgl);
  // A budget is a ceiling and a ceiling holds for the worst case, but only over
  // routes a visitor can actually load: a redirected source is answered by the
  // redirect, and a `_`-prefixed document is Next's own.
  const served = non3dRoutes.filter((route) => route.redirect === null && !route.internal);
  const pool = served.length > 0 ? served : non3dRoutes;
  const heaviest = [...pool].sort((a, b) => b.wireGzip - a.wireGzip)[0] ?? null;

  const contractGzip = model.contractFaces.reduce((total, face) => total + face.gzip, 0);
  const largest = heaviest
    ? [...heaviest.references].sort((a, b) => b.gzip - a.gzip || (a.path < b.path ? -1 : 1))[0]
    : null;

  const decomposed = heaviest ? heaviest.gzip + heaviest.styleGzip : 0;

  return {
    narrative: {
      chunks: narrativeChunks,
      gzip: narrativeGzip,
      bytes: narrativeBytes,
      deferred,
      deferredGzip: deferred.reduce((total, chunk) => total + chunk.gzip, 0),
      heaviest3d,
      onHeaviest3d,
      onWireGzip: narrativeChunks
        .filter((chunk) => chunk.routes.length > 0)
        .reduce((total, chunk) => total + chunk.gzip, 0),
    },
    non3d: {
      routes: non3dRoutes,
      served,
      heaviest,
      measured: heaviest ? heaviest.wireGzip : 0,
      decomposed,
      decomposedTotal: decomposed + contractGzip,
      contractGzip,
    },
    largest,
  };
}

/**
 * The markdown block `ops/asset-budget.md` is written from, plus the findings.
 *
 * Every figure carries a Nature marker and every table is preceded by the method
 * that produced it, because a number without a method is a claim (NFR-9).
 *
 * @param {BuildModel} model
 * @returns {string}
 */
export function render(model) {
  const { narrative, non3d, largest } = analyse(model);
  const [low, high] = NARRATIVE_ESTIMATE_BYTES;
  const out = [];

  /** One blank line, never two, so two runs cannot differ on whitespace. */
  const blank = () => {
    if (out.length > 0 && out.at(-1) !== '') out.push('');
  };
  const heading = (text) => {
    blank();
    out.push(text);
    blank();
  };
  const prose = (...parts) => {
    blank();
    out.push(...wrap(parts.join(' ')));
    blank();
  };
  /** A markdown table: header, separator, rows, and no blank line between them. */
  const table = (columns, rows) => {
    blank();
    out.push(`| ${columns.join(' | ')} |`);
    out.push(`|${columns.map(() => '---').join('|')}|`);
    out.push(...rows);
    blank();
  };
  const row = (...cells) => `| ${cells.join(' | ')} |`;
  const bullet = (text) => out.push(...wrap(`- ${text}`, '  '));

  // --- the build ---------------------------------------------------------------

  heading('## The build this reading was taken from');
  table(
    ['Property', 'Value', 'Nature'],
    [
      row('`.next/BUILD_ID`', `\`${model.buildId}\``, NATURE_OBSERVED),
      row('Build written', model.builtAt, `${NATURE_OBSERVED}, mtime of \`.next/BUILD_ID\``),
      row('Commit', `\`${model.commit}\``, `${NATURE_OBSERVED}, \`git rev-parse HEAD\``),
      row(
        'Measured inputs dirty',
        model.dirty.length === 0
          ? 'none'
          : `**${model.dirty.length}**: ${model.dirty.map((line) => `\`${line}\``).join(', ')}`,
        `${NATURE_OBSERVED}, \`git status --porcelain -- ${MEASURED_INPUTS.join(' ')}\``
      ),
      row('Prerendered documents', String(model.routes.length), NATURE_OBSERVED),
      row(
        'Chunks written',
        `${model.chunks.filter((chunk) => chunk.path.endsWith('.js')).length} \`.js\`, ` +
          `${model.chunks.filter((chunk) => chunk.path.endsWith('.css')).length} \`.css\``,
        NATURE_OBSERVED
      ),
      row(
        'Bytes in `.next/static/chunks`',
        `${group(model.chunks.reduce((total, chunk) => total + chunk.bytes, 0))} on disk, ` +
          `${group(model.chunks.reduce((total, chunk) => total + chunk.gzip, 0))} gzipped`,
        NATURE_OBSERVED
      ),
    ]
  );
  if (model.dirty.length > 0) {
    prose(
      '**A measured input is modified in the working tree, so the commit above does not describe what was',
      'weighed.** Commit or revert, rebuild, and re-run before this block is filed.'
    );
  }

  // --- the narrative bundle ----------------------------------------------------

  heading('## The narrative bundle');
  prose(
    'Every chunk in the build a narrative fingerprint hits. The whole chunk is attributed to the libraries',
    'found in it, which overstates wherever a chunk mixes narrative and shell code. That is a stated limit',
    'with a direction, and the direction is the safe one.'
  );
  table(
    ['Chunk', 'Bytes on disk', 'Bytes gzipped', 'Libraries', 'On which routes', 'Nature'],
    [
      ...narrative.chunks.map((chunk) =>
        row(
          `\`${chunk.name}\``,
          group(chunk.bytes),
          group(chunk.gzip),
          chunk.libraries.join(', '),
          chunk.routes.length === 0
            ? 'none: loaded on demand'
            : chunk.routes.map((route) => `\`${route}\``).join(', '),
          NATURE_OBSERVED
        )
      ),
      row(
        '**Total, every narrative chunk in the build**',
        `**${group(narrative.bytes)}**`,
        `**${group(narrative.gzip)}**`,
        '',
        '',
        '**Observed**'
      ),
      row(
        narrative.heaviest3d
          ? `Of that, on the heaviest 3D route \`${narrative.heaviest3d.route}\``
          : 'Of that, on a 3D route',
        '',
        group(narrative.onHeaviest3d),
        '',
        '',
        NATURE_DERIVED
      ),
      row(
        'Of that, referenced by no document and loaded on demand',
        '',
        group(narrative.deferredGzip),
        '',
        '',
        NATURE_DERIVED
      ),
      row('Estimate this replaces', '', `${group(low)} to ${group(high)}`, '', '', `${NATURE_DECISION}. \`EXPERIENCE.md:946\``),
      row(
        'Against the estimate',
        '',
        narrative.gzip > high
          ? `${group(narrative.gzip - high)} over the top of the range`
          : narrative.gzip < low
            ? `${group(low - narrative.gzip)} under the foot of the range`
            : `inside the range, ${group(high - narrative.gzip)} below the top`,
        '',
        '',
        NATURE_DERIVED
      ),
    ]
  );

  // --- the narrative assets ----------------------------------------------------

  heading('## The narrative assets');
  prose(
    'Everything under `public/assets/home/`, with the `path:line` that names it. A reference is a line in',
    '`app/` or `components/` (tests excluded) or in a sibling asset that carries the file name, matched on a',
    'word boundary so one name that is a prefix of another is not a hit. A referrer marked "imported by',
    'nothing" is a module outside `app/` that compiles and that no route reaches; liveness follows the',
    'sibling chain to a fixed point, so an asset named only by a dead asset is dead too.'
  );
  const assetBytes = model.assets.reduce((total, asset) => total + asset.bytes, 0);
  const assetGzip = model.assets.reduce((total, asset) => total + asset.gzip, 0);
  const liveBytes = model.assets.filter((asset) => asset.live).reduce((total, asset) => total + asset.bytes, 0);
  table(
    ['Asset', 'Bytes on disk', 'Bytes gzipped', 'Referenced from', 'Reached', 'Nature'],
    [
      ...model.assets.map((asset) =>
        row(
          `\`${asset.name}\``,
          group(asset.bytes),
          group(asset.gzip),
          asset.referrers.length === 0
            ? '**nothing**'
            : asset.referrers
                .map((reference) =>
                  `\`${reference}\`${asset.orphanedReferrers.includes(referrerPath(reference)) ? ', imported by nothing' : ''}`
                )
                .join('; '),
          asset.live ? 'yes' : '**no**',
          NATURE_OBSERVED
        )
      ),
      row('**Total**', `**${group(assetBytes)}**`, `**${group(assetGzip)}**`, '', '', '**Observed**'),
      row('Reachable from a module something imports', group(liveBytes), '', '', '', NATURE_DERIVED),
      row('Reachable from nothing', group(assetBytes - liveBytes), '', '', '', NATURE_DERIVED),
      row('Estimate this replaces', 'not inspected', 'not inspected', '', '', `${NATURE_DECISION}. \`EXPERIENCE.md:947\``),
    ]
  );
  if (model.orphanModules.length > 0) {
    prose(
      `Components outside \`app/\` that nothing imports: ${model.orphanModules
        .map((file) => `\`${file}\``)
        .join(', ')}. ${NATURE_OBSERVED}, by resolving every \`from '...'\`, \`import('...')\` and bare`,
      "`import '...'` specifier under `app/` and `components/` against the repository root and the `@/` alias",
      '`tsconfig.json` declares, accepting a directory specifier as its `index`. `app/` is excluded on both',
      'sides: an App Router entry point has no importer by construction.'
    );
  }

  // --- the non-3D path ---------------------------------------------------------

  heading('## The non-3D path');
  if (non3d.heaviest === null) {
    prose('Every route in this build references a chunk carrying the WebGL stack. There is no non-3D path to measure.');
  } else {
    const route = non3d.heaviest;
    const redirected = non3d.routes.filter((entry) => entry.redirect !== null);
    const internal = non3d.routes.filter((entry) => entry.redirect === null && entry.internal);
    prose(
      `A route is non-3D here when no chunk it references carries the WebGL stack. ${non3d.routes.length} of the`,
      `${model.routes.length} prerendered documents qualify, and ${non3d.served.length} of those can actually be`,
      `loaded: ${redirected.length} ${redirected.length === 1 ? 'is' : 'are'} answered by a redirect`,
      `(${redirected.map((entry) => `\`${entry.route}\``).join(', ') || 'none'}) and ${internal.length}`,
      `${internal.length === 1 ? 'is' : 'are'} Next's own document`,
      `(${internal.map((entry) => `\`${entry.route}\``).join(', ') || 'none'}), all read from`,
      '`.next/routes-manifest.json` rather than asserted here. The § Every route table below carries the same',
      `column for every route. The heaviest route a visitor can load is \`${route.route}\`, and a ceiling has to`,
      'hold for the worst case rather than the average, so that is the one measured.'
    );

    out.push('### Reading one: what the document puts on the wire');
    prose(
      'Every `<script src>` and every `<link>` whose `rel` carries `stylesheet`, `preload` or `modulepreload`,',
      'deduplicated on the resolved path and gzipped at level 9, plus the document itself.'
    );
    table(
      ['Item', 'Bytes gzipped', 'Nature'],
      [
        row(`The document itself, \`${route.file}\``, group(route.gzip), NATURE_OBSERVED),
        row('Scripts', group(route.scriptGzip), NATURE_OBSERVED),
        row('Stylesheets', group(route.styleGzip), NATURE_OBSERVED),
        row('Preloaded, not otherwise referenced', group(route.preloadOnlyGzip), NATURE_OBSERVED),
        row('**Total**', `**${group(non3d.measured)}**`, '**Observed**'),
        row('Budget', group(NON_3D_BUDGET_BYTES), `${NATURE_DECISION}. UX-DR7, \`EXPERIENCE.md:945\``),
        non3d.measured > NON_3D_BUDGET_BYTES
          ? row(
              '**Overage**',
              `**${group(non3d.measured - NON_3D_BUDGET_BYTES)}, ${percent(
                non3d.measured - NON_3D_BUDGET_BYTES,
                NON_3D_BUDGET_BYTES
              )} over**`,
              NATURE_DERIVED
            )
          : row(
              'Margin',
              `${group(NON_3D_BUDGET_BYTES - non3d.measured)}, ${percent(
                NON_3D_BUDGET_BYTES - non3d.measured,
                NON_3D_BUDGET_BYTES
              )}`,
              NATURE_DERIVED
            ),
      ]
    );

    if (route.preloadOnly.length > 0) {
      prose(
        'The preload row itemised, because a total a reader cannot check is not a measurement:'
      );
      table(
        ['Preloaded', '`as`', 'Priority', 'Bytes gzipped', 'Nature'],
        [
          ...route.preloadOnly.map((reference) =>
            row(
              `\`${reference.path}\``,
              reference.as ?? 'not stated',
              reference.fetchPriority ?? 'default',
              group(reference.gzip),
              NATURE_OBSERVED
            )
          ),
          row('**Total**', '', '', `**${group(route.preloadOnlyGzip)}**`, '**Observed**'),
        ]
      );
    }

    prose(
      `Of the whole total, ${group(route.fontGzip)} is font faces preloaded unconditionally at`,
      `\`app/layout.tsx:40-53\`, and ${group(route.polyfillGzip)} is a \`noModule\` script that no browser with`,
      'module support fetches. Both are counted: the document puts them on the wire without asking anything,',
      `and a total that quietly dropped either could not be checked by a reader. A modern browser's figure is`,
      `${group(non3d.measured - route.polyfillGzip)}.`
    );

    if (largest) {
      const chunk = largest.chunk;
      const what = chunk
        ? chunk.libraries.length > 0
          ? `carries ${chunk.libraries.join(', ')}`
          : chunk.shell.length > 0
            ? `carries ${chunk.shell.join(' and ')} and no narrative library`
            : 'carries no library this tool fingerprints'
        : 'is served from `public/`';
      prose(
        `**The single largest contributor is \`${largest.path}\` at ${group(largest.gzip)} bytes gzipped**, which`,
        `${what}. ${NATURE_OBSERVED}.`
      );
    }

    out.push("### Reading two: on the budget's own decomposition");
    prose(
      '`EXPERIENCE.md:936` decomposes the non-3D payload as HTML plus one CSS file plus three woff2 subsets, and',
      'names no JavaScript at all. Measured on those line items and nothing else:'
    );
    table(
      ['Budget line', 'Budget', 'Measured', 'Nature'],
      [
        row('HTML + critical CSS', group(HTML_AND_CSS_BUDGET_BYTES), group(non3d.decomposed), NATURE_OBSERVED),
        row(
          `Fonts: the ${model.contractFaces.length} latin subsets in \`contracts/fonts/\``,
          group(FONT_BUDGET_BYTES),
          group(non3d.contractGzip),
          `${NATURE_OBSERVED}, re-gzipped from the committed binaries`
        ),
        row('**Non-3D path total**', `**${group(NON_3D_BUDGET_BYTES)}**`, `**${group(non3d.decomposedTotal)}**`, '**Derived**'),
        non3d.decomposedTotal > NON_3D_BUDGET_BYTES
          ? row('**Overage**', '', `**${group(non3d.decomposedTotal - NON_3D_BUDGET_BYTES)}**`, NATURE_DERIVED)
          : row(
              'Margin',
              '',
              `${group(NON_3D_BUDGET_BYTES - non3d.decomposedTotal)}, ${percent(
                NON_3D_BUDGET_BYTES - non3d.decomposedTotal,
                NON_3D_BUDGET_BYTES
              )}`,
              NATURE_DERIVED
            ),
      ]
    );
    prose(
      `The two readings are ${group(Math.abs(non3d.measured - non3d.decomposedTotal))} bytes apart: the`,
      `${group(route.scriptGzip)} of JavaScript and ${group(route.preloadOnlyGzip)} of preloads the`,
      `decomposition has no line for, less the ${group(non3d.contractGzip)} of contract faces the document`,
      'itself does not reference.'
    );
  }

  // --- every route -------------------------------------------------------------

  heading('## Every route');
  table(
    ['Route', 'Document bytes', 'Gzipped on the wire', 'Carries WebGL', 'Served', 'Nature'],
    [...model.routes]
      .sort((a, b) => b.wireGzip - a.wireGzip)
      .map((entry) =>
        row(
          `\`${entry.route}\``,
          group(entry.bytes),
          group(entry.wireGzip),
          entry.webgl ? 'yes' : 'no',
          entry.redirect
            ? `**no**: ${entry.redirect.statusCode} to \`${entry.redirect.destination}\``
            : entry.internal
              ? "**no**: Next's own document"
              : 'yes',
          NATURE_OBSERVED
        )
      )
  );

  // --- the faces ---------------------------------------------------------------

  heading('## The faces the built CSS declares');
  prose(
    'A family is reached when a `font-family` declaration outside a `@font-face` block names it, directly or',
    'through a `var()` chain followed to a fixed point, matched case-insensitively and with a `!important`',
    'stripped. Declared and reached are different claims: a face no rule names is never fetched, however',
    'faithfully it is built and served. Every format each family declares is weighed, not only its woff2,',
    'because the legacy blocks declare woff and ttf beside it and this build emits all of them.'
  );
  const familyBytes = model.fonts.families.reduce((total, entry) => total + entry.bytes, 0);
  const familyGzip = model.fonts.families.reduce((total, entry) => total + entry.gzip, 0);
  const unreachedBytes = model.fonts.families
    .filter((entry) => !entry.reachable)
    .reduce((total, entry) => total + entry.bytes, 0);
  const unreachedGzip = model.fonts.families
    .filter((entry) => !entry.reachable)
    .reduce((total, entry) => total + entry.gzip, 0);
  table(
    ['Family', 'Formats', 'Bytes on disk, all formats', 'Bytes gzipped, all formats', 'Reached', 'Nature'],
    [
      ...model.fonts.families.map((entry) =>
        row(
          entry.family,
          entry.files.map((file) => file.format).join(', ') || 'none on disk',
          group(entry.bytes),
          group(entry.gzip),
          entry.reachable ? 'yes' : '**no**',
          NATURE_OBSERVED
        )
      ),
      row('**Total**', '', `**${group(familyBytes)}**`, `**${group(familyGzip)}**`, '', '**Observed**'),
      row('Of that, reached by no rule', '', group(unreachedBytes), group(unreachedGzip), '', NATURE_DERIVED),
    ]
  );
  prose(
    `${model.fonts.unreachable.length} of the ${model.fonts.families.length} families the built CSS declares`,
    'are reached by no rule. The values it declares outside a `@font-face`, and what each resolves to:'
  );
  for (const use of model.fonts.uses) {
    out.push(
      ...wrap(
        `- \`font-family: ${use.value}\` resolves to ${
          use.families.length > 0
            ? use.families.map((family) => `\`${family}\``).join(', ')
            : '**nothing this tool could resolve**'
        }`,
        '  '
      )
    );
  }
  blank();
  if (model.fonts.unresolved.length > 0) {
    prose(
      'Custom properties named by a `font-family` rule, defined nowhere in the built CSS and carrying no',
      `fallback arm: ${model.fonts.unresolved.map((name) => `\`${name}\``).join(', ')}. Reported unresolved,`,
      'never assumed to reach nothing.'
    );
  }

  // --- method ------------------------------------------------------------------

  heading('## Method');
  prose(
    `Taken against \`.next/BUILD_ID\` \`${model.buildId}\`, written by \`corepack pnpm build\` on`,
    `${model.builtAt}, at commit \`${model.commit}\`. Bytes on disk are \`stat\`. Bytes gzipped are`,
    "`zlib.gzipSync` at level 9, the level `packages/fonts/subset.py` uses, so a font figure here and a font",
    'figure in `ops/font-contract.md` are the same measurement. KB is 1000 bytes throughout.'
  );
  prose(
    "A route's assets come from its own prerendered HTML under `.next/server/app`, walked recursively, not",
    'from a manifest: Turbopack writes no `app-build-manifest.json`, and `build-manifest.json` carries only',
    '`rootMainFiles` and `polyfillFiles`, so a manifest read would report a subset and call it the total.',
    'Every `<script src>` and every `<link>` whose `rel` token list carries `stylesheet`, `preload` or',
    '`modulepreload` is resolved to a file on disk, deduplicated on that resolved path, and weighed.',
    '`rel=preconnect` and `rel=icon` are not counted: the first fetches nothing and points at `/`, the second',
    'is neither a script, a stylesheet nor a preload. A reference with no file behind it stops the run rather',
    'than being counted as zero, and so does a built `@font-face` naming a file the build did not write.'
  );
  prose(
    'Which routes are served comes from `.next/routes-manifest.json`: a literal redirect source is answered by',
    'the redirect, so its prerendered document is never fetched, and a `_`-prefixed document is Next\'s own. A',
    'parameterised redirect source is not matched against a concrete document rather than guessed at.'
  );
  prose(
    'Determinism. Nothing here reads a clock, a locale or a random source. The reading is stamped with the',
    "build's own mtime and with `git rev-parse HEAD`, both properties of what was measured rather than of when",
    'the tool ran, so two runs against one build print the same bytes even across midnight. Every listing is',
    'sorted, and digits are grouped by hand rather than by `toLocaleString`, which answers differently under a',
    'different `LANG`.'
  );

  out.push('### The fingerprints, and the proof that each discriminates');
  prose(
    'Turbopack minifies to numeric module ids and emits no module paths, so per-module attribution inside a',
    'chunk is not available and a fingerprint is the only lever. Each mark below is a literal string from its',
    "own library's source. The hit column is every chunk in this build the mark appears in, with its count,",
    'which is what makes the claim that it discriminates a demonstration rather than an assertion. A mark that',
    'matched nothing would stop the run, because an attribution that silently found no `three` would print a',
    'narrative total of zero and read like a passing budget.'
  );
  table(
    ['Library', 'Fingerprint', 'WebGL', 'Chunks it hits, with counts', 'Nature'],
    model.proof.map((entry) =>
      row(
        entry.library,
        `\`${entry.mark.replace(/\|/g, '\\|')}\``,
        entry.webgl ? 'yes' : 'no',
        entry.hits.map((hit) => `\`${hit.name}\` (${hit.count})`).join(', '),
        NATURE_OBSERVED
      )
    )
  );

  // --- findings ----------------------------------------------------------------

  heading('## Findings');
  bullet(
    `The narrative bundle is ${group(narrative.gzip)} bytes gzipped across ${narrative.chunks.length} chunks, ` +
      `against an estimate of ${group(low)} to ${group(high)}. ` +
      (narrative.gzip > high
        ? `That is ${group(narrative.gzip - high)} over the top of the range.`
        : narrative.gzip < low
          ? `That is ${group(low - narrative.gzip)} under the foot of the range.`
          : `That is inside the range, ${group(high - narrative.gzip)} below the top.`)
  );
  bullet(
    narrative.deferred.length > 0
      ? `${group(narrative.deferredGzip)} bytes of that is genuinely deferred: ${narrative.deferred
          .map((chunk) => `\`${chunk.name}\``)
          .join(', ')} is referenced by no prerendered document. The other ${group(narrative.onWireGzip)} is ` +
        'on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.'
      : 'No narrative chunk is deferred: every one of them is referenced by a prerendered document, so the ' +
        '`next/dynamic` boundaries defer nothing measurable.'
  );
  if (non3d.heaviest) {
    bullet(
      non3d.measured > NON_3D_BUDGET_BYTES
        ? `The non-3D path is over budget as measured: ${group(non3d.measured)} against ` +
          `${group(NON_3D_BUDGET_BYTES)}, ${group(non3d.measured - NON_3D_BUDGET_BYTES)} over, on route ` +
          `\`${non3d.heaviest.route}\`.` +
          (largest ? ` The largest single contributor is \`${largest.path}\` at ${group(largest.gzip)}.` : '')
        : `The non-3D path is inside budget as measured: ${group(non3d.measured)} against ` +
          `${group(NON_3D_BUDGET_BYTES)}.`
    );
    bullet(
      non3d.decomposedTotal > NON_3D_BUDGET_BYTES
        ? `On the budget's own decomposition it is also over: ${group(non3d.decomposedTotal)} against ` +
          `${group(NON_3D_BUDGET_BYTES)}.`
        : `On the budget's own decomposition it is inside: ${group(non3d.decomposedTotal)} against ` +
          `${group(NON_3D_BUDGET_BYTES)}, ${group(NON_3D_BUDGET_BYTES - non3d.decomposedTotal)} of margin. That ` +
          `decomposition has no line for the ${group(non3d.heaviest.scriptGzip)} of JavaScript or the ` +
          `${group(non3d.heaviest.preloadOnlyGzip)} of preloads the document actually carries.`
    );
  }
  if (model.fonts.unreachable.length > 0) {
    bullet(
      `${model.fonts.unreachable.length} of the ${model.fonts.families.length} families the built CSS declares ` +
        `are reached by no \`font-family\` rule, and their ${group(unreachedBytes)} bytes on disk ` +
        `(${group(unreachedGzip)} gzipped, all formats) are emitted and served regardless: ` +
        `${model.fonts.unreachable.join(', ')}.`
    );
  }
  const orphanBytes = model.assets.filter((asset) => !asset.live).reduce((total, asset) => total + asset.bytes, 0);
  if (orphanBytes > 0) {
    bullet(
      `${group(orphanBytes)} bytes under \`public/assets/home/\` are reachable from no module anything imports: ` +
        model.assets
          .filter((asset) => !asset.live)
          .map((asset) => `\`${asset.name}\``)
          .join(', ') +
        '. They are committed, they are served, and no route asks for them.'
    );
  }

  return `${out.join('\n').trim()}\n`;
}

// --- the command line --------------------------------------------------------

function usage() {
  return [
    'usage: node ops/asset-budget.mjs',
    '',
    'Reads the production build in .next/ and prints the markdown block for',
    'ops/asset-budget.md, plus the findings. Takes no arguments. Run',
    '`corepack pnpm build` first; `next dev` is not a substitute.',
  ].join('\n');
}

/**
 * @param {string[]} argv
 * @param {string} [root]
 * @returns {{ok: boolean, message: string}}
 */
export function main(argv, root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const args = argv.filter((argument) => typeof argument === 'string');
  if (args.includes('--help') || args.includes('-h')) return { ok: true, message: usage() };
  if (args.length > 0) {
    return { ok: false, message: `asset budget: this tool takes no arguments, and got ${args.join(' ')}\n\n${usage()}` };
  }

  try {
    return { ok: true, message: render(collect(root)) };
  } catch (error) {
    if (!(error instanceof BudgetError)) throw error;
    return { ok: false, message: `asset budget: ${error.message}` };
  }
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main(process.argv.slice(2));
  const stream = result.ok ? process.stdout : process.stderr;
  // `render` already ends in a newline. Adding a second would put a blank line
  // at the foot of every hashed capture.
  const text = result.message.endsWith('\n') ? result.message : `${result.message}\n`;
  stream.write(text, () => process.exit(result.ok ? 0 : 1));
}
