/**
 * Source-text scanning helpers for the `lib/roulette` PINNING TESTS (Story 6.3).
 *
 * WHY A SOURCE SCAN AT ALL. Several of this module's rules are "this construct must be ABSENT":
 * no `server-only`, no `node:` import, no `Math.random`, no clock, no locale-aware formatting.
 * An absent import reddens nothing when someone adds it back, and the Vitest config aliases
 * `server-only` to a stub — so an import-based test literally cannot tell the difference between
 * a module that has the import and one that does not. The only thing that can is reading the file.
 *
 * WHY COMMENTS AND STRINGS ARE BLANKED. `prng.ts`'s doc comment explains the `node:crypto` and
 * `server-only` bans by NAME. A naive substring scan flags the documentation that explains the
 * rule — which is exactly what happened on the first run of the Go equivalent. Blanking comments
 * (and, for the code scan, string bodies) makes the scan mean "this construct is in the CODE".
 * Import specifiers are strings, so they get their own extraction pass that keeps them.
 *
 * It lives in `test/` (next to `test/stubs/server-only.ts`) rather than in `lib/roulette/`: it is
 * test support, not shipped code, and putting it under the module it scans would both muddy that
 * boundary and make the scan include itself.
 */

/**
 * Blank out comments — and optionally string/template bodies — while preserving offsets, line
 * structure and everything else. A tiny state machine rather than a regex, because a regex
 * cannot tell a `//` inside a string from the start of a comment.
 */
export function blankOut(src: string, opts: { strings: boolean }): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  // Depth of `${ … }` interpolations we are inside, innermost last. A non-empty stack means the
  // enclosing template's quote state must be restored when the interpolation closes.
  const templateStack: string[] = [];
  let braceDepth = 0;

  const keep = (ch: string) => (ch === '\n' ? '\n' : ' ');

  while (i < src.length) {
    const c = src[i] as string;
    const next = src[i + 1];

    if (quote !== null) {
      if (c === '\\') {
        out += opts.strings ? '  ' : src.slice(i, i + 2);
        i += 2;
        continue;
      }
      // ⭐ TEMPLATE INTERPOLATION IS CODE, NOT STRING. `${…}` must be scanned, not blanked.
      // The 6.3 code review found this: a backtick was treated as an ordinary quote, so
      // everything through the closing backtick was erased — and labels.ts builds every label
      // out of `${LABEL_PREFIX}/stage1/spin/${String(spin)}`. A `${spin.toLocaleString()}` was
      // therefore invisible to the ban list that is AC3's only enforcement on the TS side.
      if (quote === '`' && c === '$' && next === '{') {
        templateStack.push(quote);
        quote = null;
        braceDepth = 0;
        out += opts.strings ? '  ' : '${';
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
        out += opts.strings ? keep(c) : c;
        i += 1;
        continue;
      }
      out += opts.strings ? keep(c) : c;
      i += 1;
      continue;
    }

    // Closing an interpolation returns us to the enclosing template literal.
    if (templateStack.length > 0 && c === '}' && braceDepth === 0) {
      quote = templateStack.pop() as string;
      out += opts.strings ? ' ' : '}';
      i += 1;
      continue;
    }
    if (templateStack.length > 0 && c === '{') braceDepth += 1;
    if (templateStack.length > 0 && c === '}') braceDepth -= 1;

    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += opts.strings ? keep(c) : c;
      i += 1;
      continue;
    }

    // ⭐ REGEX LITERALS. Without this, a regex containing a quote character — /['"]/, /don't/ —
    // opens quote mode at that character and never closes it, blanking the ENTIRE REST OF THE
    // FILE so every `expect(code.includes(needle)).toBe(false)` passes vacuously. Latent when the
    // 6.3 review found it (prng.ts's /^[0-9a-f]{64}$/ has no quote chars); silent green is the
    // worst failure mode a pinning test can have, so it is closed rather than noted.
    if (c === '/' && next !== '/' && next !== '*' && regexCanStartHere(out)) {
      const end = skipRegexLiteral(src, i);
      if (end > i) {
        out += opts.strings ? ' '.repeat(end - i) : src.slice(i, end);
        i = end;
        continue;
      }
    }

    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    if (c === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += keep(src[i] as string);
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

/** Keywords after which a `/` begins a regex literal rather than a division. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do',
  'else', 'yield', 'await',
]);

/**
 * Whether a `/` at the current position starts a regex literal, judged from what came before it.
 *
 * The standard heuristic: after a value (identifier, number, `)`, `]`, `}`) a `/` is division;
 * after an operator, a punctuator or a keyword it opens a regex. Conservative by design — when
 * unsure it answers "division", which leaves the text alone rather than blanking real code.
 */
function regexCanStartHere(emitted: string): boolean {
  const before = emitted.replace(/\s+$/, '');
  if (before === '') return true;
  const last = before[before.length - 1] as string;
  if (/[)\]}]/.test(last)) return false;
  if (/[A-Za-z0-9_$]/.test(last)) {
    const word = /[A-Za-z0-9_$]+$/.exec(before)?.[0] ?? '';
    return REGEX_PRECEDING_KEYWORDS.has(word);
  }
  return true;
}

/**
 * Index just past the regex literal starting at `start`, or `start` if this is not one.
 *
 * Handles escapes and character classes, where an unescaped `/` is literal (`/[/]/`). A newline
 * before the closing delimiter means it was not a regex after all.
 */
function skipRegexLiteral(src: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i] as string;
    if (c === '\n') return start;
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      i += 1;
      while (i < src.length && /[a-z]/.test(src[i] as string)) i += 1; // flags
      return i;
    }
    i += 1;
  }
  return start;
}

/**
 * Every module specifier the file imports: static `import … from 'x'`, bare `import 'x'`,
 * `export … from 'x'`, dynamic `import('x')` and `require('x')`. Run over comment-blanked source
 * so a commented-out import is not reported.
 */
export function importSpecifiers(src: string): string[] {
  const code = blankOut(src, { strings: false });
  const specs: string[] = [];
  const patterns = [
    /\bimport\s+[^;]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^;]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) specs.push(m[1] as string);
  }
  return specs;
}
