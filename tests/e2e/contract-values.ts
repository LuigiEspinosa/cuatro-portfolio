import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The contract's parsers and the value comparator, shared by every spec that reads a token value.
 *
 * This is not a spec. It is deliberately named without the `.pw.ts` suffix so Playwright's
 * `testMatch` never collects it, and it lives under `tests/e2e/`, which `vitest.config.ts`
 * excludes. Importing one spec file from another would register that file's tests under the
 * importer, so a shared module is the only sound way for two specs to use one comparator.
 *
 * It was extracted from `tests/e2e/contract-anchor.pw.ts` by Story 1-18, unchanged in behaviour,
 * so that `tests/e2e/anchor-alias.pw.ts` reuses this comparison rather than writing a second one.
 * A second comparator is the failure this extraction exists to prevent: two of them would drift,
 * and the one that drifted would be the one reporting green.
 *
 * **The compiled stylesheet is not the contract byte for byte.** Next 16's Turbopack pipeline
 * minifies the CSS it emits: `oklch(12% 0.011 288)` becomes a `#rrggbb` fallback plus a `lab()`
 * override behind `@supports (color: lab(0% 0 0))`, `120ms` becomes `.12s`, and `0.6875rem`
 * becomes `.6875rem`. Every one of those is a semantics-preserving rewrite, so what is asserted is
 * that a value still *means* what the contract declares, canonicalised through the browser's own
 * parser. The transform table is recorded in `ops/anchor-token-adoption.md`.
 *
 * **Comparator routes are not URL routes.** The comparator picks one of six typed routes per
 * value (colour, time, easing, length, family, number) plus a text route for anything carrying an
 * unresolvable `var()`.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here
// even though TypeScript accepts it.
export const REPO_ROOT = resolve(__dirname, '..', '..');
export const CONTRACTS = join(REPO_ROOT, 'contracts');

/** Read off disk rather than restated. A value written down twice is a value that can drift. */
export const TOKENS_CSS = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');
export const FONTS_CSS = readFileSync(join(CONTRACTS, 'fonts.css'), 'utf8');
export const APP_SCSS = readFileSync(join(REPO_ROOT, 'app', 'app.scss'), 'utf8');

/**
 * The counts `contracts/tokens.css` publishes at v1.0.0, pinned rather than bounded, because a
 * floor cannot see a removed name: the loop that reads each one back simply gets shorter and stays
 * green. `app/__tests__/anchor-contract.test.ts` pins the same two numbers from its own parse, so
 * a change to either has to be made in both places deliberately.
 */
export const DECLARED_COUNT = 89;
export const REDUCED_COUNT = 4;

/** Pinned on the same rule: every face loop reads this list, so a shortened one must be loud. */
export const CONTRACT_FACE_COUNT = 3;

/** The first four bytes of every woff2 file, so a 200 carrying an HTML error page is not a face. */
export const WOFF2_SIGNATURE = 'wOF2';

export const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The `--name: value` pairs in one declaration block, in source order. */
export const declarationsIn = (block: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const raw of block.split(';')) {
    const at = raw.indexOf(':');
    if (at === -1) continue;
    const name = raw.slice(0, at).trim();
    if (!name.startsWith('--')) continue;
    found.set(name, raw.slice(at + 1).trim());
  }
  return found;
};

export const normaliseQuotes = (value: string): string => value.replace(/'/g, '"');

const tokenSource = withoutComments(TOKENS_CSS);

export const REDUCED_MATCH =
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(tokenSource);
export const BASE_MATCH = /:root\s*\{([^}]*)\}/.exec(
  REDUCED_MATCH ? tokenSource.replace(REDUCED_MATCH[0], '') : tokenSource
);

/** Every custom property `contracts/tokens.css` puts on `:root` outside a media query. */
export const DECLARED = declarationsIn(BASE_MATCH ? BASE_MATCH[1] : '');

/** The four `--dur-*` values the contract redefines under `prefers-reduced-motion: reduce`. */
export const REDUCED = declarationsIn(REDUCED_MATCH ? REDUCED_MATCH[1] : '');

/**
 * The same names again, by a parser that reads the whole file flat rather than by block.
 *
 * The two fail differently: this one cannot tell the two blocks apart, and the structured one
 * above would silently truncate if a second `:root`, an `@layer` wrapper or any nested brace
 * appeared. Agreement between them is what says neither did.
 */
export const FLAT_NAMES = [...tokenSource.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map((found) => found[1]);

/**
 * Every custom property `app/app.scss` declares, which is all fifteen the Hub has.
 *
 * The `//` strip is guarded on the preceding character, exactly as
 * `app/__tests__/anchor-contract.test.ts` guards it, so a `url(https://...)` or a
 * protocol-relative `url(//host/...)` does not take the rest of its line with it.
 */
export const HUB_DECLARED = declarationsIn(
  /:root\s*\{([^}]*)\}/.exec(withoutComments(APP_SCSS).replace(/(^|[^:(])\/\/.*$/gm, '$1'))?.[1] ?? ''
);

/**
 * A declared value with its `var()` references replaced by what the contract declares them as.
 *
 * This is not a convenience. The computed value of a custom property is its token stream **after**
 * substitution, so `--token-bg`, declared `var(--c-paper)`, resolves on `:root` to `--c-paper`'s
 * own value and never to the string `var(--c-paper)`. Comparing the authored text against that
 * would report all twelve semantic roles and all three elevation steps as drifted when the
 * contract is behaving exactly as designed.
 *
 * A name the contract does not declare is left alone rather than dropped, so an unresolvable
 * reference reaches the comparison as itself and fails there instead of silently becoming empty.
 *
 * Non-convergence throws rather than returning a half-expanded string. A cycle, or a chain deeper
 * than ten, would otherwise surface as a value mismatch on some unrelated-looking property rather
 * than as what it is.
 *
 * `active` is the map the caller is comparing against, which is `DECLARED` with `REDUCED` merged
 * over it when the reduced-motion query matched. Substituting from `DECLARED` alone would resolve
 * a reference to a name the reduced-motion block redefines back to its base value and report drift
 * on a property behaving correctly.
 */
export const expandVars = (value: string, active: Map<string, string> = DECLARED): string => {
  let out = value;
  for (let depth = 0; depth < 10; depth += 1) {
    const next = out.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g, (whole, name: string) => active.get(name) ?? whole);
    if (next === out) return out;
    out = next;
  }
  throw new Error(
    `contract-values: "${value}" did not stop expanding after ten passes, so contracts/tokens.css ` +
      `carries a var() cycle or a chain deeper than this substitution follows (reached "${out}")`
  );
};

export interface FaceBlock {
  family: string;
  urls: string[];
}

/** Every `@font-face` block in `css`, with its family name unquoted and its `url()` values raw. */
export const faceBlocksIn = (css: string): FaceBlock[] => {
  const blocks: FaceBlock[] = [];
  const opener = /@font-face\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(css)) !== null) {
    let depth = 1;
    let index = opener.lastIndex;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }

    const body = css.slice(opener.lastIndex, index - 1);
    const family = /font-family\s*:\s*([^;]+)/.exec(body)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    const urls = [...body.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/g)]
      .map((found) => (found[1] ?? found[2] ?? found[3] ?? '').trim())
      .filter((url) => url !== '');

    blocks.push({ family, urls });
    opener.lastIndex = index;
  }

  return blocks;
};

/** The three families the published font contract declares, read from the contract itself. */
export const CONTRACT_FACES = faceBlocksIn(withoutComments(FONTS_CSS));
export const CONTRACT_FAMILIES = CONTRACT_FACES.map((face) => face.family);

/**
 * The first family in a font stack, unquoted.
 *
 * A computed `font-family` is the whole stack, and Chromium quotes only the members that need it,
 * so an equality against the whole string would pin a serialisation. What a consumer's adoption
 * turns on is which face is asked for first.
 */
export const firstFamily = (stack: string): string =>
  (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');

/**
 * The contract's display family, derived from `--f-display` rather than restated.
 *
 * `contracts/tokens.css` owns which face this is, and a MINOR bump is free to change it. Reading
 * it here is what lets a spec assert "the display family" without typing the name.
 */
export const DISPLAY_FAMILY = firstFamily(DECLARED.get('--f-display') ?? '');

export interface ComparisonEntry {
  name: string;
  declared: string;
  observed: string;
}

export interface ComparisonResult extends ComparisonEntry {
  route: string;
  declaredCanonical: string;
  observedCanonical: string;
  equal: boolean;
}

/** The six typed comparator routes, in the order the comparator tries them. */
export const TYPED_ROUTES = ['colour', 'time', 'easing', 'length', 'family', 'number'] as const;

/**
 * Canonicalise both sides of every pair through the browser's own parser and report whether they
 * mean the same thing.
 *
 * The route is chosen from the **declared** value's type and then required of the observed value
 * too, so a colour that arrived as a length is a disagreement rather than a silent fallthrough to
 * a string comparison. A value carrying `var()` never leaves the text route: `var()` is accepted
 * by every property, so a typed route would canonicalise both sides to the same
 * invalid-at-computed-value default and pass over nothing.
 */
export const compareInPage = (page: Page, entries: ComparisonEntry[]): Promise<ComparisonResult[]> =>
  page.evaluate((pairs: ComparisonEntry[]) => {
    const probe = document.createElement('div');
    // `transition-property: none` is not decoration. The time route sets `transition-duration`
    // on this same element, and a non-zero duration with the default `transition-property: all`
    // makes every later write to it start a transition, at which point `getComputedStyle`
    // answers with the animation's current value rather than the one just written. A control
    // caught that: `44px` and `45px` both read back as `3px`, the last length written before
    // the first duration landed, and compared equal. Pinning the property list to `none` is
    // what makes the read the value and not a frame of an animation towards it.
    probe.style.cssText =
      'position:absolute;left:-99999px;top:0;display:block;box-sizing:border-box;' +
      'font:16px/1 monospace;padding:0;border:0;transition-property:none;animation:none;';
    document.body.appendChild(probe);

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // Whitespace around commas and just inside brackets is a minifier's business, not a
    // contract's. Runs collapse to one space rather than to none, so a string such as
    // "Bricolage Grotesque" keeps the space that is part of its name.
    const collapse = (value: string): string =>
      value
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ',')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim()
        .toLowerCase();

    const throughProperty = (property: string, value: string): string => {
      probe.style.setProperty(property, '');
      probe.style.setProperty(property, value);
      return collapse(window.getComputedStyle(probe).getPropertyValue(property));
    };

    /**
     * Does the 2D context accept `value` as a fill colour?
     *
     * **This is the colour route's fail-open guard, and without it the route is unsound.**
     * `fillStyle` is specified to *ignore* a value it cannot parse, silently leaving the
     * previous colour in place. With `globalCompositeOperation = 'copy'` both sides of a pair
     * would then rasterise the same stale pixel and compare **equal**, and the control pair
     * beside them is the very shape that would go stale too, so nothing would report it. The
     * `CSS.supports` gate above does not cover this: `CSS.supports('color', x)` is the CSS
     * parser's answer and the canvas has its own.
     *
     * Two sentinels rather than one, so a value that *is* the sentinel colour, written in any
     * spelling, is not mistaken for a rejected one: an accepted value serialises the same way
     * after either sentinel, and a rejected one leaves whichever sentinel preceded it.
     */
    const canvasAccepts = (value: string): boolean => {
      if (!context) return false;
      context.fillStyle = '#010203';
      context.fillStyle = value;
      const afterFirst = context.fillStyle;
      context.fillStyle = '#040506';
      context.fillStyle = value;
      return context.fillStyle === afterFirst;
    };

    const routes: { name: string; property: string; canonical: (value: string) => string }[] = [
      {
        name: 'colour',
        property: 'color',
        canonical: (value) => {
          if (!context) return `no-canvas:${collapse(value)}`;
          // Reported rather than swallowed. An unparsed value now reaches the comparison as a
          // distinct string and fails there naming itself, instead of silently comparing equal
          // to whatever was in the context before it.
          if (!canvasAccepts(value)) return `unparsed-by-canvas:${collapse(value)}`;
          // `copy` rather than the default `source-over`, so the pixel is the colour itself
          // rather than the colour composited over whatever was there. Read back as four
          // 8-bit channels: that is the same sRGB rounding both an `oklch()` and the `lab()`
          // the minifier emits in its place go through, which is exactly the equivalence
          // being asserted. Its resolution is therefore 1/255 per channel, which the
          // near-neighbour negative control probes and the ops record states as a limit.
          context.globalCompositeOperation = 'copy';
          context.fillStyle = value;
          context.fillRect(0, 0, 1, 1);
          const data = context.getImageData(0, 0, 1, 1).data;
          return `srgb8(${data[0]},${data[1]},${data[2]},${data[3]})`;
        },
      },
      { name: 'time', property: 'transition-duration', canonical: (v) => throughProperty('transition-duration', v) },
      {
        name: 'easing',
        property: 'transition-timing-function',
        canonical: (v) => throughProperty('transition-timing-function', v),
      },
      // `outline-offset` rather than `width` or `margin-left`, for two reasons a control found
      // rather than a reader. Negative first: the contract's tracking scale is negative
      // (`--tr-display: -0.05em`) and a negative `width` is invalid, so a `width` route would
      // drop those six values to the text comparison, where `-0.05em` and the minifier's
      // `-.05em` are different strings. Then staleness: `margin-left` resolves to a **used**
      // value, and reading one back off an absolutely positioned probe returned the previous
      // length rather than the one just set. `outline-offset` computes to an absolute px length
      // at style time, with no layout involved, and resolves `vw` against the viewport, which
      // is what lets the fluid tokens be measured at a second width.
      { name: 'length', property: 'outline-offset', canonical: (v) => throughProperty('outline-offset', v) },
      { name: 'family', property: 'font-family', canonical: (v) => throughProperty('font-family', v) },
      { name: 'number', property: 'line-height', canonical: (v) => throughProperty('line-height', v) },
    ];

    const results: ComparisonResult[] = pairs.map((pair) => {
      const carriesVar = /var\(/i.test(pair.declared) || /var\(/i.test(pair.observed);
      const route = carriesVar ? undefined : routes.find((candidate) => CSS.supports(candidate.property, pair.declared));

      if (!route) {
        return {
          ...pair,
          route: carriesVar ? 'text (var)' : 'text',
          declaredCanonical: collapse(pair.declared),
          observedCanonical: collapse(pair.observed),
          equal: collapse(pair.declared) === collapse(pair.observed),
        };
      }

      if (!CSS.supports(route.property, pair.observed)) {
        return {
          ...pair,
          route: route.name,
          declaredCanonical: route.canonical(pair.declared),
          observedCanonical: `not a ${route.name}: ${collapse(pair.observed)}`,
          equal: false,
        };
      }

      const declaredCanonical = route.canonical(pair.declared);
      const observedCanonical = route.canonical(pair.observed);
      return {
        ...pair,
        route: route.name,
        declaredCanonical,
        observedCanonical,
        equal: declaredCanonical === observedCanonical,
      };
    });

    // The colour route's guard, on a planted pair, through the same predicate the route calls.
    // A real colour must be accepted and a string no colour parser takes must not, or
    // `unparsed-by-canvas` can never fire and the route is fail-open again. It rides back with
    // every call rather than living in a separate `page.evaluate`, so it is the same context,
    // the same canvas and the same function the comparison just used. The name is repeated
    // outside this callback because a module constant cannot cross into the page.
    //
    // Each side is measured **once** and both the reported value and the verdict read that one
    // measurement. Calling `canvasAccepts` again per field would mutate the shared context between
    // calls, so the evidence the failure prints and the verdict it prints it for would be two
    // different observations of a stateful thing.
    const acceptedReal = canvasAccepts('oklch(12% 0.011 288)');
    const acceptedGarbage = canvasAccepts('not-a-colour');
    results.push({
      name: 'control: the canvas reports a colour it cannot parse',
      declared: 'a real colour is accepted',
      observed: 'a string no colour parser takes is rejected',
      route: 'canvas',
      declaredCanonical: String(acceptedReal),
      observedCanonical: String(acceptedGarbage),
      equal: acceptedReal && !acceptedGarbage,
    });

    probe.remove();
    return results;
  }, entries);

/** The name `compareInPage` gives its own canvas guard. Repeated there, and asserted here. */
export const CANVAS_CONTROL_NAME = 'control: the canvas reports a colour it cannot parse';

/**
 * Assert the colour route's own guard fired on this call, then hand back the real results.
 *
 * Every call site wraps its `compareInPage` in this, because the guard is worth nothing if the one
 * place it is checked is not the place the comparison ran.
 */
export const expectCanvasControl = (results: ComparisonResult[]): ComparisonResult[] => {
  const control = results.find((result) => result.name === CANVAS_CONTROL_NAME);
  expect(control, `the comparator returned no "${CANVAS_CONTROL_NAME}", so the colour route is unguarded`).toBeTruthy();
  expect(
    control?.equal,
    // Both sides printed in the same shape, so the reader is not left working out that a `true`
    // on the right means the canvas answered `false`. Each is the raw answer the predicate gave.
    `the canvas guard did not behave: asked about a real colour it answered ` +
      `"${control?.declaredCanonical}" (want "true"), asked about a string no colour parser takes it ` +
      `answered "${control?.observedCanonical}" (want "false"). Unless both are as wanted, ` +
      `"unparsed-by-canvas" cannot fire and a value the canvas ignores compares equal to whatever was ` +
      `in the context before it`
  ).toBe(true);
  return results.filter((result) => result.name !== CANVAS_CONTROL_NAME);
};

/**
 * The fourteen controls that pin what the comparator means by equivalence.
 *
 * Seven pairs: one on each of the six typed routes and one on the `text (var)` route. Each
 * positive is a rewrite this pipeline really performs, and the negative beside it is the smallest
 * real difference of the same shape. The colour negative is a neighbour one 8-bit step away,
 * because the route rasterises to 8-bit sRGB and 1/255 per channel is its actual resolution: a
 * grossly different colour would prove nothing about where the boundary lies.
 *
 * This is not decoration. `a different length` is what caught the comparator reading a
 * transitioning value rather than the value it had just written, at which point every length in
 * the contract was comparing equal to every other length.
 */
export const COMPARATOR_CONTROLS: (ComparisonEntry & { expected: boolean })[] = [
  { name: 'control: oklch against its lab rewrite', declared: 'oklch(12% 0.011 288)', observed: 'lab(1.52265% .480853 -1.49071)', expected: true },
  { name: 'control: a colour one 8-bit step away', declared: 'oklch(12% 0.011 288)', observed: '#070509', expected: false },
  { name: 'control: ms against s', declared: '120ms', observed: '.12s', expected: true },
  { name: 'control: a different duration', declared: '120ms', observed: '121ms', expected: false },
  { name: 'control: an easing respaced', declared: 'cubic-bezier(0.16, 1, 0.3, 1)', observed: 'cubic-bezier(.16,1,.3,1)', expected: true },
  { name: 'control: a different easing', declared: 'cubic-bezier(0.16, 1, 0.3, 1)', observed: 'cubic-bezier(0.17, 1, 0.3, 1)', expected: false },
  { name: 'control: leading zero stripped', declared: '0.6875rem', observed: '.6875rem', expected: true },
  { name: 'control: a different length', declared: '44px', observed: '45px', expected: false },
  { name: 'control: a stack respaced', declared: '"Geist", ui-sans-serif, system-ui', observed: '"Geist",ui-sans-serif,system-ui', expected: true },
  { name: 'control: a different stack', declared: '"Geist", ui-sans-serif, system-ui', observed: '"Geist Mono", ui-sans-serif, system-ui', expected: false },
  { name: 'control: a trailing zero', declared: '1.6', observed: '1.60', expected: true },
  { name: 'control: a different number', declared: '600', observed: '601', expected: false },
  { name: 'control: var() spelled the same', declared: 'var(--c-paper)', observed: 'var( --c-paper )', expected: true },
  { name: 'control: a var() pointing elsewhere', declared: 'var(--c-paper)', observed: 'var(--c-ink)', expected: false },
];

/**
 * Run the fourteen controls through the comparator in the same page and the same call as `entries`,
 * assert every one of them behaved, and hand back the real results with every control stripped out.
 *
 * A comparator that silently agreed with everything, or silently disagreed with everything, cannot
 * get past this. The failure prints all fourteen outcomes rather than stopping at the first
 * surprise, so a red run says what the comparator did rather than where it first tripped.
 */
export const compareWithControls = async (
  page: Page,
  entries: ComparisonEntry[],
  label: string
): Promise<ComparisonResult[]> => {
  const results = expectCanvasControl(await compareInPage(page, [...entries, ...COMPARATOR_CONTROLS]));
  const byName = new Map(results.map((result) => [result.name, result]));

  const report = COMPARATOR_CONTROLS.map((control) => {
    const result = byName.get(control.name);
    return (
      `  ${control.name}: "${control.declared}" against "${control.observed}" -> ` +
      `${result ? (result.equal ? 'equal' : 'unequal') : 'not compared'} ` +
      `(${result?.route}: ${result?.declaredCanonical} against ${result?.observedCanonical}), ` +
      `expected ${control.expected ? 'equal' : 'unequal'}`
    );
  });
  console.log(`${label} comparator controls:\n${report.join('\n')}`);

  expect(COMPARATOR_CONTROLS.length, 'a control pair was lost, so a route is no longer probed').toBe(
    (TYPED_ROUTES.length + 1) * 2
  );
  const misbehaved = COMPARATOR_CONTROLS.filter((control) => byName.get(control.name)?.equal !== control.expected);
  expect(
    misbehaved.map((control) => control.name),
    `the comparator is not measuring equivalence:\n${report.join('\n')}`
  ).toEqual([]);

  return results.filter((result) => !result.name.startsWith('control:'));
};
