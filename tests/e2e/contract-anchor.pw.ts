import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';

/**
 * The Anchor consumes the published contract (Story 1-17, Anchor migration step 1).
 *
 * `app/scss/_index.scss` loads `contracts/tokens.css` and `contracts/fonts.css`, and nothing
 * in the Hub reads a single name from either. This file is the browser half of proving both
 * halves of that sentence at once: the contract is really in the stylesheet graph, and the
 * render did not move.
 *
 * Four things a unit test over the source text cannot establish, and this can:
 *
 *  1. **That the contract inlined rather than deferring.** The rule that decides it is `@use`
 *     against `@import`, not the extension: **observed 2026-08-26** against Dart Sass 1.98.0,
 *     `@use './t'` and `@use './t.css'` both inline a plain CSS file and emit identical output,
 *     a bare `@import './t'` also inlines it, and only `@import './t.css'` passes through as a
 *     runtime `@import`. `app/__tests__/anchor-contract.test.ts` pins the rule at source; this
 *     file measures the consequence, by requiring the contract's own declarations to appear in
 *     a stylesheet the page links and no `@import` to survive anywhere in one.
 *  2. **That the face URLs survive the build.** `contracts/fonts.css` carries
 *     `url("./fonts/<file>.woff2")` relative to itself. Whether Next's SCSS pipeline rewrites
 *     those correctly is a claim about a build pipeline, so it is measured: the emitted URL is
 *     fetched, and its status, its length and its `wOF2` signature are asserted.
 *     `document.fonts.check` cannot do this job, because it answers `true` for a family with no
 *     matching `@font-face` rule at all (`tests/e2e/contract-serving.pw.ts:28-35`), and a
 *     computed `font-family` read passes identically when every face has 404'd
 *     (`RESTYLE-SPEC.md:648`).
 *  3. **That the Hub's own values did not move.** Read in the browser, and compared against
 *     `app/app.scss` itself rather than against a literal restated here.
 *  4. **That the values still mean what the contract declares.** See below.
 *
 * **The compiled stylesheet is not the contract byte for byte, and this file measures the
 * difference rather than assuming it away.** Next 16's Turbopack pipeline minifies the CSS it
 * emits: `oklch(12% 0.011 288)` becomes a `#rrggbb` fallback plus a `lab()` override behind
 * `@supports (color: lab(0% 0 0))`, `120ms` becomes `.12s`, and `0.6875rem` becomes
 * `.6875rem`. Every one of those is a semantics-preserving rewrite, so the assertion below is
 * that each declared value still *means* what the contract declares, canonicalised through the
 * browser's own parser. The transform table is recorded in `ops/anchor-token-adoption.md`.
 *
 * **Comparator routes are not URL routes.** The comparator picks one of six typed routes per
 * value (colour, time, easing, length, family, number) plus a text route for anything carrying
 * an unresolvable `var()`. Every browser assertion in this file is made against one URL,
 * `/work`, except where a second browser context is opened deliberately and says why.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time
// here even though TypeScript accepts it.
const REPO_ROOT = resolve(__dirname, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');

/** Read off disk rather than restated. A value written here twice is a value that can drift. */
const TOKENS_CSS = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');
const FONTS_CSS = readFileSync(join(CONTRACTS, 'fonts.css'), 'utf8');
const APP_SCSS = readFileSync(join(REPO_ROOT, 'app', 'app.scss'), 'utf8');

/** The only URL any assertion in this file visits. */
const ROUTE = '/work';

/**
 * The counts `contracts/tokens.css` publishes at v1.0.0, pinned rather than bounded, because a
 * floor cannot see a removed name: the loop that reads each one back simply gets shorter and
 * stays green. `app/__tests__/anchor-contract.test.ts` pins the same two numbers from its own
 * parse, so a change to either has to be made in both places deliberately.
 */
const DECLARED_COUNT = 89;
const REDUCED_COUNT = 4;

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The `--name: value` pairs in one declaration block, in source order. */
const declarationsIn = (block: string): Map<string, string> => {
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

const source = withoutComments(TOKENS_CSS);

const REDUCED_MATCH = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(
  source
);
const BASE_MATCH = /:root\s*\{([^}]*)\}/.exec(REDUCED_MATCH ? source.replace(REDUCED_MATCH[0], '') : source);

/** Every custom property `contracts/tokens.css` puts on `:root` outside a media query. */
const DECLARED = declarationsIn(BASE_MATCH ? BASE_MATCH[1] : '');

/** The four `--dur-*` values the contract redefines under `prefers-reduced-motion: reduce`. */
const REDUCED = declarationsIn(REDUCED_MATCH ? REDUCED_MATCH[1] : '');

/**
 * The same names again, by a parser that reads the whole file flat rather than by block.
 *
 * The two fail differently: this one cannot tell the two blocks apart, and the structured one
 * above would silently truncate if a second `:root`, an `@layer` wrapper or any nested brace
 * appeared. Agreement between them is what says neither did.
 */
const FLAT_NAMES = [...source.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map((found) => found[1]);

/**
 * Every custom property `app/app.scss` declares, which is all sixteen the Hub has.
 *
 * The `//` strip is guarded on the preceding character, exactly as
 * `app/__tests__/anchor-contract.test.ts` guards it, so a `url(https://...)` or a
 * protocol-relative `url(//host/...)` does not take the rest of its line with it. The two halves
 * parse the same file and had drifted to two different rules here.
 */
const HUB_DECLARED = declarationsIn(
  /:root\s*\{([^}]*)\}/.exec(withoutComments(APP_SCSS).replace(/(^|[^:(])\/\/.*$/gm, '$1'))?.[1] ?? ''
);

/**
 * The four pre-change values this story probes, named here and **valued from `app/app.scss`**
 * rather than restated. Sass normalises the single quotes that file authors to double quotes on
 * the way out, which is why the comparison normalises quotes and why that is an observation
 * about the pipeline rather than an unexplained literal. **Observed 2026-08-26**, and the same
 * pair is recorded at `ops/rendered-output-harness.md:317-318`.
 */
const PRE_CHANGE_NAMES = ['--white-color', '--black-color', '--accent', '--monument-bold'] as const;

const normaliseQuotes = (value: string): string => value.replace(/'/g, '"');

/**
 * The token role a Hub property is aliased onto, or `null` while it is authored as a literal.
 *
 * Added by Story 1-18, the alias layer. Before it, every one of the Hub's sixteen was a literal
 * and the comparison below was against the text `app/app.scss` authors. Twelve of them are now
 * `var()` references, and the computed value of a custom property is its token stream **after**
 * substitution, so what `:root` answers for an aliased name is the role's value and never the
 * string `var(--token-text)`. The comparison therefore reads the role in the same page instead.
 */
const aliasRole = (name: string): string | null =>
  /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(HUB_DECLARED.get(name) ?? '')?.[1] ?? null;

/**
 * The computed colour of a throwaway element painted `background-color: var(<name>)`.
 *
 * A computed colour and a custom property's token stream do not serialise the same way, so a
 * role that is going to be compared against a computed `color` or `background-color` is put
 * through a real element in the same page rather than compared as text.
 */
const probeRoleColours = async (page: Page, names: readonly string[]): Promise<Record<string, string>> => {
  const read = await page.evaluate((properties: string[]) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const answers: Record<string, string> = {};
    for (const property of properties) {
      probe.style.cssText =
        `position:absolute;left:-99999px;top:0;width:1px;height:1px;background-color:var(${property});`;
      answers[property] = window.getComputedStyle(probe).backgroundColor;
    }
    probe.remove();
    return answers;
  }, [...names]);

  // `background-color` falls back to the initial transparent when the reference does not
  // resolve, and two unresolved roles would then compare equal to each other. Reported here
  // rather than returned.
  for (const name of names) {
    expect(read[name], `var(${name}) did not resolve to a colour on the probe`).not.toBe('rgba(0, 0, 0, 0)');
  }
  return read;
};

/**
 * A declared value with its `var()` references replaced by what the contract declares them as.
 *
 * This is not a convenience. The computed value of a custom property is its token stream
 * **after** substitution, so `--token-bg`, declared `var(--c-paper)`, resolves on `:root` to
 * `--c-paper`'s own value and never to the string `var(--c-paper)`. Comparing the authored text
 * against that would report all twelve semantic roles and all three elevation steps as drifted
 * when the contract is behaving exactly as designed.
 *
 * A name the contract does not declare is left alone rather than dropped, so an unresolvable
 * reference reaches the comparison as itself and fails there instead of silently becoming empty.
 *
 * Non-convergence throws rather than returning a half-expanded string. A cycle, or a chain
 * deeper than ten, would otherwise surface as a value mismatch on some unrelated-looking
 * property rather than as what it is.
 *
 * `active` is the map the caller is comparing against, which is `DECLARED` with `REDUCED` merged
 * over it when the reduced-motion query matched. Substituting from `DECLARED` alone would resolve
 * a reference to a name the reduced-motion block redefines back to its base value and report drift
 * on a property behaving correctly. Nothing exercises that today, because the four reduced values
 * are literal `1ms`, and that is exactly why it has to be right before something does.
 */
const expandVars = (value: string, active: Map<string, string> = DECLARED): string => {
  let out = value;
  for (let depth = 0; depth < 10; depth += 1) {
    const next = out.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g, (whole, name: string) => active.get(name) ?? whole);
    if (next === out) return out;
    out = next;
  }
  throw new Error(
    `contract-anchor: "${value}" did not stop expanding after ten passes, so contracts/tokens.css ` +
      `carries a var() cycle or a chain deeper than this substitution follows (reached "${out}")`
  );
};

/**
 * Three names from three different scales, spelled out so a parser that silently returned a
 * short list cannot satisfy the loop below. `--tap` earns its place twice: it is the one
 * length in the contract authored as a physical-size guarantee.
 */
const KNOWN_MEMBERS = ['--token-bg', '--f-body', '--tap'] as const;

/** The two fluid tokens, and the width at which their middle term is the winning one. */
const FLUID_NAMES = ['--t-display', '--page-pad'] as const;

/**
 * 600 rather than the harness's 360. At 360 the `9vw` in `--t-display` is 32.4px and the `5vw`
 * in `--page-pad` is 18px, and both lose to their minimum term, so the fluid middle term is
 * inert and a rewrite of it would compare equal to anything. At 600 both middle terms win.
 */
const FLUID_VIEWPORT = { width: 600, height: 800 } as const;

/** Names only the contract declares, so finding one in a stylesheet is evidence of the inlining. */
const CONTRACT_MARKERS = ['--c-paper', '--token-scrim'] as const;

/** The first four bytes of every woff2 file, so a 200 carrying an HTML error page is not a face. */
const WOFF2_SIGNATURE = 'wOF2';

/**
 * Every runtime `@import` in `css`. Named rather than inlined, so the planted control beside the
 * assertion calls the same function the assertion calls: an absence check whose matcher stopped
 * firing reads exactly like a clean build.
 *
 * `\s*` rather than `\s+`, and the distinction is the whole value of the check. This matcher runs
 * over **minified** build output, where `@import"/x.css";` with no separating space is the ordinary
 * emission and the spaced form is the unlikely one. Requiring the space would have let the exact
 * failure this assertion exists to catch pass unseen, with both planted controls green because both
 * were written spaced. `loadsIn` in `app/__tests__/anchor-contract.test.ts` already reads `\s*` for
 * the same reason on the source side; the two halves now agree.
 */
const importsIn = (css: string): string[] => [...css.matchAll(/@import\s*[^;]+;/g)].map((found) => found[0]);

interface FaceBlock {
  family: string;
  urls: string[];
}

/** Every `@font-face` block in `css`, with its family name unquoted and its `url()` values raw. */
const faceBlocksIn = (css: string): FaceBlock[] => {
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
const CONTRACT_FACES = faceBlocksIn(withoutComments(FONTS_CSS));
const CONTRACT_FAMILIES = CONTRACT_FACES.map((face) => face.family);

/**
 * Pinned, on the same rule as the 89 and the 4. Every face assertion in this file loops over
 * `CONTRACT_FAMILIES`, so a contract that dropped to one face would shorten all of them and stay
 * green while the record still claimed three. The story's own matrix names the number.
 */
const CONTRACT_FACE_COUNT = 3;

interface ComparisonEntry {
  name: string;
  declared: string;
  observed: string;
}

interface ComparisonResult extends ComparisonEntry {
  route: string;
  declaredCanonical: string;
  observedCanonical: string;
  equal: boolean;
}

/** The six typed comparator routes, in the order the comparator tries them. */
const TYPED_ROUTES = ['colour', 'time', 'easing', 'length', 'family', 'number'] as const;

/**
 * Canonicalise both sides of every pair through the browser's own parser and report whether
 * they mean the same thing.
 *
 * The route is chosen from the **declared** value's type and then required of the observed
 * value too, so a colour that arrived as a length is a disagreement rather than a silent
 * fallthrough to a string comparison. A value carrying `var()` never leaves the text route:
 * `var()` is accepted by every property, so a typed route would canonicalise both sides to the
 * same invalid-at-computed-value default and pass over nothing.
 */
const compareInPage = (page: Page, entries: ComparisonEntry[]): Promise<ComparisonResult[]> =>
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
          // near-neighbour negative control below probes and the ops record states as a limit.
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
const CANVAS_CONTROL_NAME = 'control: the canvas reports a colour it cannot parse';

/**
 * Assert the colour route's own guard fired on this call, then hand back the real results.
 *
 * Every call site wraps its `compareInPage` in this, because the guard is worth nothing if the
 * one place it is checked is not the place the comparison ran.
 */
const expectCanvasControl = (results: ComparisonResult[]): ComparisonResult[] => {
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
 * A context matching the one `playwright.config.ts` builds, with the named overrides applied.
 *
 * Used twice, and only where the project's own settings are the thing under test: once with
 * `reducedMotion: 'no-preference'`, because the project pins `reduce` and the contract's four
 * base `--dur-*` values are otherwise never compared to anything, and once at a wider viewport,
 * because the two `clamp()` tokens are pinned to their minimum term at 360.
 */
const inContext = async <T>(
  browser: Browser,
  baseURL: string | undefined,
  overrides: { reducedMotion?: 'reduce' | 'no-preference'; viewport?: { width: number; height: number } },
  use: (page: Page) => Promise<T>
): Promise<T> => {
  if (!baseURL) throw new Error('contract-anchor: playwright.config.ts provided no baseURL, so no server was started.');
  const context = await browser.newContext({
    baseURL,
    viewport: { ...RENDERED_VIEWPORT, ...(overrides.viewport ?? {}) },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: overrides.reducedMotion ?? 'reduce',
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(ROUTE, { waitUntil: 'load' });
    expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);
    return await use(page);
  } finally {
    await context.close();
  }
};

test('the token contract declares a real list of names', () => {
  // Every loop in this file is driven by this list. A parser that returned nothing, or that
  // returned two entries because the file's shape changed, would make the rest of the suite
  // green over almost nothing, so the list is asserted before it is used.
  expect(BASE_MATCH, `no :root block was parsed out of ${join(CONTRACTS, 'tokens.css')}`).not.toBeNull();
  expect(REDUCED_MATCH, 'no prefers-reduced-motion block was parsed out of contracts/tokens.css').not.toBeNull();

  // Pinned, not bounded. A removed name shortens every loop below and would otherwise pass in
  // silence, which is the one way this file can be green while the contract has lost a role.
  expect(DECLARED.size, 'contracts/tokens.css no longer declares 89 custom properties on :root').toBe(DECLARED_COUNT);
  expect(REDUCED.size, 'the reduced-motion block no longer redefines 4 values').toBe(REDUCED_COUNT);

  // The structured parse against the flat one. They truncate differently, so agreement is
  // evidence that neither did.
  expect(
    [...new Set(FLAT_NAMES)].sort(),
    'the flat and the structured parse of contracts/tokens.css disagree, so one of them truncated'
  ).toEqual([...DECLARED.keys()].sort());
  expect(FLAT_NAMES.length, 'contracts/tokens.css does not carry 93 declarations in total').toBe(
    DECLARED_COUNT + REDUCED_COUNT
  );

  for (const name of KNOWN_MEMBERS) {
    expect([...DECLARED.keys()], `contracts/tokens.css no longer declares ${name}`).toContain(name);
  }
  for (const name of FLUID_NAMES) {
    expect([...DECLARED.keys()], `contracts/tokens.css no longer declares ${name}`).toContain(name);
    expect(DECLARED.get(name), `${name} is no longer a clamp(), so the wide-viewport case measures nothing`).toMatch(
      /clamp\(/
    );
  }
  for (const [name, value] of DECLARED) {
    expect(value, `${name} parsed to an empty value`).not.toBe('');
  }
  for (const [name, value] of REDUCED) {
    expect(value, `${name} parsed to an empty value under reduced motion`).not.toBe('');
    expect([...DECLARED.keys()], `${name} is redefined under reduced motion but never declared`).toContain(name);
  }

  // The substitution the value comparison depends on, against a name the contract declares and
  // a name it does not. Without the first the semantic layer compares against the wrong side;
  // without the second an unresolvable reference would vanish rather than fail.
  expect(expandVars('var(--c-paper)')).toBe(DECLARED.get('--c-paper'));
  expect(expandVars('var(--not-a-name-in-the-contract)')).toBe('var(--not-a-name-in-the-contract)');
  expect(expandVars('44px')).toBe('44px');

  // The role-through-palette case, with the palette entry **read from the role** rather than
  // named here. Which entry `--token-bg` points at is the contract's business and a MINOR bump
  // is free to change it; that a role resolves through to whatever it points at is this story's.
  const roleTarget = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(DECLARED.get('--token-bg') ?? '');
  expect(roleTarget, '--token-bg is no longer a single var() reference, so this case measures nothing').not.toBeNull();
  expect(expandVars('var(--token-bg)')).toBe(DECLARED.get(roleTarget?.[1] ?? ''));
  expect(expandVars('var(--token-bg)'), '--token-bg still carries a var() after substitution').not.toMatch(/var\(/);

  // The Hub's own sixteen, read from `app/app.scss` so the pre-change expectations below are
  // not literals restated here. `app/__tests__/anchor-contract.test.ts` holds the count and the
  // no-collision claim; this is the part this file depends on.
  expect(HUB_DECLARED.size, 'app/app.scss no longer declares sixteen custom properties').toBe(16);
  for (const name of PRE_CHANGE_NAMES) {
    expect([...HUB_DECLARED.keys()], `app/app.scss no longer declares ${name}`).toContain(name);
    expect([...DECLARED.keys()], `${name} is now declared by the contract as well as by the Hub`).not.toContain(name);

    // **Story 1-18 aliased all four onto token roles.** The role each one names is read off
    // `app/app.scss` and checked against the contract here, so the comparison further down is
    // against a role the contract really declares rather than against a name a retarget invented.
    const role = aliasRole(name);
    expect(
      role,
      `app/app.scss authors ${name} as "${HUB_DECLARED.get(name)}" rather than as a var() reference to a role`
    ).toBeTruthy();
    expect([...DECLARED.keys()], `${name} is aliased onto ${role}, which the contract does not declare`).toContain(
      role
    );
  }

  // The quote normalisation is not inert. Before Story 1-18 this was measured on the four names
  // above, which were single-quoted family literals; they are `var()` references now, so it is
  // measured over everything `app/app.scss` declares. `--confillia-normal` and `--confillia-bold`
  // are the two that story deliberately left as single-quoted literals, pending O-6 and UX-DR12.
  expect(
    [...HUB_DECLARED.values()].some((value) => normaliseQuotes(value) !== value),
    'nothing in app/app.scss is single-quoted, so the quote normalisation is untested'
  ).toBe(true);
  expect(normaliseQuotes("'Confillia Normal'"), 'the quote normaliser no longer fires').toBe('"Confillia Normal"');

  // The font half of the contract, on the same rule as the counts above: **pinned** at three,
  // not bounded. Every face assertion in this file loops over `CONTRACT_FAMILIES`, so a contract
  // that dropped to one face would shorten all of them and stay green.
  expect(CONTRACT_FAMILIES.length, 'contracts/fonts.css no longer declares three @font-face blocks').toBe(
    CONTRACT_FACE_COUNT
  );
  expect(new Set(CONTRACT_FAMILIES).size, 'two published faces share a family name').toBe(CONTRACT_FACE_COUNT);
  for (const face of CONTRACT_FACES) {
    expect(face.family, 'a published @font-face declares no family').not.toBe('');
    expect(face.urls.length, `${face.family} declares no url()`).toBeGreaterThan(0);
  }
});

test('every custom property the token contract declares resolves on :root in the browser', async ({ page }) => {
  const response = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);

  // The harness runs with `reducedMotion: 'reduce'` (`playwright.config.ts:79`), so the four
  // `--dur-*` values the contract redefines under that query are the ones that resolve here.
  // Read from the browser rather than assumed from the config, so the expectation follows the
  // context the test actually ran in. The base four are measured by the next case, in a context
  // opened for exactly that reason.
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const expected = new Map(DECLARED);
  if (reduced) for (const [name, value] of REDUCED) expected.set(name, value);

  const entries: ComparisonEntry[] = [];
  let substituted = 0;
  for (const [name, declared] of expected) {
    const resolved = expandVars(declared, expected);
    if (resolved !== declared) substituted += 1;
    // Throws naming the property when it is absent or empty, which is the whole reason the
    // read goes through the harness rather than through `getPropertyValue` directly.
    entries.push({ name, declared: resolved, observed: await rootCustomPropertyValue(page, name) });
  }

  // The count, not just the loop. An `expected` map that shrank would otherwise pass over
  // whatever was left.
  expect(entries.length, 'fewer properties were read than the contract declares').toBe(expected.size);
  expect(entries.length).toBe(DECLARED_COUNT);

  // The substitution really ran. The contract's whole shape is a raw palette consumed only by a
  // semantic layer, so a run in which nothing was substituted is a run comparing the wrong side.
  expect(substituted, 'no declared value carried a var() reference, so the substitution did nothing').toBeGreaterThan(
    10
  );

  /**
   * Controls, run through the same comparator in the same page and in the same call. Seven
   * pairs of them, fourteen in all: one pair on each of the six typed routes and one on the
   * `text (var)` route.
   *
   * **Neither text route is meant to be reached by a contract value**, and the case asserts
   * below that neither is. They differ in what reaching them would mean, which is why one
   * carries a control and the other does not. `text (var)` is a **failure** route: a value
   * arrives there when the substitution did not resolve, so its control is a claim about what
   * the comparator does with the failure, and that is worth pinning. The plain `text` route is
   * unreachable rather than merely unused, since a value with no `var()` and no typed route
   * would have to be a shape CSS has no property for, so a control there would be a claim about
   * the comparator alone.
   *
   * A fifteenth control rides back from inside `compareInPage` itself: `expectCanvasControl`
   * asserts the colour route's own fail-open guard fired on this call.
   *
   * Each positive is a rewrite this pipeline really performs, and the negative beside it is the
   * smallest real difference of the same shape. The colour negative is a neighbour one 8-bit
   * step away, because the route rasterises to 8-bit sRGB and 1/255 per channel is its actual
   * resolution: a grossly different colour would prove nothing about where the boundary lies.
   *
   * This is not decoration. The `a different length` control is what caught the comparator
   * reading a transitioning value rather than the value it had just written, at which point
   * every length in the contract was comparing equal to every other length.
   */
  const CONTROLS: (ComparisonEntry & { expected: boolean })[] = [
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

  const results = expectCanvasControl(await compareInPage(page, [...entries, ...CONTROLS]));
  const byName = new Map(results.map((result) => [result.name, result]));

  // Every control's outcome is printed before any of them is asserted, so a red run says what
  // the comparator did on all fourteen rather than stopping at the first surprise.
  const controlReport = CONTROLS.map((control) => {
    const result = byName.get(control.name);
    return (
      `  ${control.name}: "${control.declared}" against "${control.observed}" -> ` +
      `${result ? (result.equal ? 'equal' : 'unequal') : 'not compared'} ` +
      `(${result?.route}: ${result?.declaredCanonical} against ${result?.observedCanonical}), ` +
      `expected ${control.expected ? 'equal' : 'unequal'}`
    );
  });
  console.log(`contract-anchor comparator controls:\n${controlReport.join('\n')}`);

  expect(CONTROLS.length, 'a control pair was lost, so a route is no longer probed').toBe((TYPED_ROUTES.length + 1) * 2);
  const misbehaved = CONTROLS.filter((control) => byName.get(control.name)?.equal !== control.expected);
  expect(
    misbehaved.map((control) => control.name),
    `the comparator is not measuring equivalence:\n${controlReport.join('\n')}`
  ).toEqual([]);

  const compared = results.filter((result) => !result.name.startsWith('control:'));
  const wrong = compared.filter((result) => !result.equal);

  // Each of the six typed routes is exercised by at least one real token, so a route that
  // silently stopped matching would take its values to the text comparison and be caught here
  // rather than pass as an unchanged string.
  const exercised = new Set(compared.map((result) => result.route));
  for (const route of TYPED_ROUTES) {
    expect(
      [...exercised],
      `no custom property was compared through the ${route} route, so its control proves nothing`
    ).toContain(route);
  }

  // And the other direction, which the loop above cannot see. A whole scale could drop to the
  // uncontrolled string comparison while one surviving value kept its route in `exercised`. No
  // contract value belongs on either text route once `var()` has been substituted: the plain
  // one carries no control by design, and reaching `text (var)` means the substitution failed.
  expect(
    compared.filter((result) => result.route.startsWith('text')).map((result) => `${result.name} (${result.route})`),
    'a contract value fell through to a string comparison instead of a typed route, where a rewrite ' +
      'of it would read as drift and a real drift would read as a rewrite'
  ).toEqual([]);

  // Logged so `ops/anchor-token-adoption.md` can quote a run rather than assert one. Only the
  // names the pipeline rewrote, because the other forty-odd are unchanged and saying so once
  // is more use than printing them.
  const rewritten = compared.filter(
    (result) => result.equal && result.declared.replace(/\s+/g, ' ').trim() !== result.observed.replace(/\s+/g, ' ').trim()
  );
  console.log(
    `contract-anchor: ${compared.length} custom properties on :root, ${rewritten.length} rewritten by the ` +
      `build and equivalent:\n` +
      rewritten.map((r) => `  ${r.name}: "${r.declared}" -> "${r.observed}" (${r.route})`).join('\n')
  );

  expect(
    wrong.map(
      (result) =>
        `${result.name}: contracts/tokens.css declares "${expected.get(result.name)}" ` +
        `(substituted: "${result.declared}") but :root resolves "${result.observed}" ` +
        `(${result.route}: ${result.declaredCanonical} against ${result.observedCanonical})`
    ),
    'the contract reached :root carrying values it does not declare'
  ).toEqual([]);

  // The read answers about the contract rather than about everything. A name the contract does
  // not declare must throw, or the loop above proves nothing.
  await expect(rootCustomPropertyValue(page, '--a-name-the-contract-does-not-declare')).rejects.toThrow(
    /not declared on :root/
  );
});

test('the four base motion durations resolve where reduced motion is not preferred', async ({ browser, baseURL }) => {
  // `playwright.config.ts:79` pins `reducedMotion: 'reduce'` on the single project, so the case
  // above only ever compares `1ms` against `1ms` for these four and the contract's base motion
  // scale is never measured at all. This context is opened for exactly that, and closes after.
  const declared: [string, string][] = [...REDUCED.keys()].map((name) => [name, DECLARED.get(name) ?? '']);
  expect(declared.length, 'the reduced-motion block names nothing, so there is nothing to measure here').toBe(
    REDUCED_COUNT
  );

  const { entries, results, preference } = await inContext(
    browser,
    baseURL,
    { reducedMotion: 'no-preference' },
    async (page) => {
      const matched = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const read: ComparisonEntry[] = [];
      for (const [name, value] of declared) {
        read.push({ name, declared: value, observed: await rootCustomPropertyValue(page, name) });
      }
      return { entries: read, results: expectCanvasControl(await compareInPage(page, read)), preference: matched };
    }
  );

  // The context really is the other one. Without this the case could run under `reduce` and
  // compare `1ms` against `1ms` exactly as the case above already does.
  expect(preference, 'the second context still prefers reduced motion, so it measures the same thing').toBe(false);
  for (const entry of entries) {
    expect(
      entry.observed,
      `${entry.name} still resolves to the reduced-motion value, so the media query did not lift`
    ).not.toBe(REDUCED.get(entry.name));
  }

  const wrong = results.filter((result) => !result.equal);
  console.log(
    `contract-anchor base motion scale:\n` +
      results.map((r) => `  ${r.name}: "${r.declared}" -> "${r.observed}" (${r.route})`).join('\n')
  );
  expect(
    wrong.map((r) => `${r.name}: declared "${r.declared}" but :root resolves "${r.observed}"`),
    'a base motion duration reached :root carrying a value the contract does not declare'
  ).toEqual([]);
  for (const result of results) {
    expect(result.route, `${result.name} was not compared as a time`).toBe('time');
  }
});

test('the fluid tokens resolve their middle term at a width where it wins', async ({ browser, baseURL }) => {
  const declared = FLUID_NAMES.map((name) => ({ name, value: DECLARED.get(name) ?? '' }));

  const read = async (viewport: { width: number; height: number }) =>
    inContext(browser, baseURL, { viewport }, async (page) => {
      const entries: ComparisonEntry[] = [];
      for (const { name, value } of declared) {
        entries.push({ name, declared: value, observed: await rootCustomPropertyValue(page, name) });
      }
      // A control pair whose middle terms differ. At 360 both clamp to their minimum and the
      // pair is equal, which is the blind spot this case exists to close; at 600 the middle
      // terms win and the pair must be reported unequal.
      entries.push({
        name: 'control: a different fluid middle term',
        declared: 'clamp(2.25rem, 9vw, 4.5rem)',
        observed: 'clamp(2.25rem, 8vw, 4.5rem)',
      });
      return expectCanvasControl(await compareInPage(page, entries));
    });

  const atNarrow = new Map((await read(RENDERED_VIEWPORT)).map((result) => [result.name, result]));
  const atWide = new Map((await read(FLUID_VIEWPORT)).map((result) => [result.name, result]));

  for (const { name } of declared) {
    const narrow = atNarrow.get(name);
    const wide = atWide.get(name);
    expect(narrow?.equal, `${name} does not resolve to its declared value at ${RENDERED_VIEWPORT.width}px`).toBe(true);
    expect(wide?.equal, `${name} does not resolve to its declared value at ${FLUID_VIEWPORT.width}px`).toBe(true);
    expect(wide?.route, `${name} was not compared as a length`).toBe('length');

    // The middle term is live at the wider width. Without this the wide reading could be the
    // same clamped minimum and the case would add nothing.
    expect(
      wide?.declaredCanonical,
      `${name} canonicalises to ${wide?.declaredCanonical} at both widths, so its fluid middle term ` +
        `is inert and a rewrite of it would compare equal`
    ).not.toBe(narrow?.declaredCanonical);
  }

  const control = 'control: a different fluid middle term';
  console.log(
    `contract-anchor fluid tokens:\n` +
      [...declared.map(({ name }) => name), control]
        .map(
          (name) =>
            `  ${name}: ${RENDERED_VIEWPORT.width}px ${atNarrow.get(name)?.declaredCanonical} against ` +
            `${atNarrow.get(name)?.observedCanonical}, ${FLUID_VIEWPORT.width}px ` +
            `${atWide.get(name)?.declaredCanonical} against ${atWide.get(name)?.observedCanonical}`
        )
        .join('\n')
  );

  expect(
    atNarrow.get(control)?.equal,
    'two clamp() values with different middle terms already differ at 360px, so the wide reading below ' +
      'is not measuring the middle term'
  ).toBe(true);
  expect(
    atWide.get(control)?.equal,
    `two clamp() values with different middle terms compare equal at ${FLUID_VIEWPORT.width}px, so the ` +
      `comparator is not reading the middle term there either`
  ).toBe(false);
});

test('the compiled stylesheet carries the contract faces and every face URL answers 200', async ({ page, request }) => {
  const response = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')].map((link) => link.href)
  );
  expect(hrefs.length, `${ROUTE} linked no stylesheet at all, so nothing below is measuring the build`).toBeGreaterThan(
    0
  );

  // A runtime `@import` is the failure mode `@use` exists to avoid: the contract would be
  // fetched by the browser from a URL nothing in this repository emits. Asserted over the
  // stylesheets the page actually links, not over the source.
  const found: { family: string; url: string; from: string }[] = [];
  const imports: string[] = [];
  const markers = new Map<string, string[]>();

  for (const href of hrefs) {
    const sheet = await request.get(href);
    expect(sheet.status(), `${href} did not answer 200`).toBe(200);
    const css = await sheet.text();

    for (const raw of importsIn(css)) imports.push(`${href}: ${raw}`);

    // The token half, inlined. The value comparison reads computed styles, which would pass
    // whatever route the names arrived by; this is the evidence that they arrived in a
    // stylesheet the page links, from the contract, as text.
    for (const marker of CONTRACT_MARKERS) {
      if (css.includes(`${marker}:`)) markers.set(marker, [...(markers.get(marker) ?? []), href]);
    }

    for (const block of faceBlocksIn(css)) {
      if (!CONTRACT_FAMILIES.includes(block.family)) continue;
      for (const url of block.urls) found.push({ family: block.family, url, from: href });
    }
  }

  // The matcher, on planted positive controls, before the empty result is read as good news.
  // The unspaced form is listed first because it is the one minified output actually emits, and
  // because the matcher used to require the space and so could not see it.
  expect(
    importsIn('@font-face{}@import url("/x.css");.a{color:red}'),
    'the @import matcher no longer fires, so the empty result below means nothing'
  ).toEqual(['@import url("/x.css");']);
  expect(
    importsIn('.a{color:red}@import"/x.css";.b{color:blue}').length,
    'the @import matcher missed the unspaced form a minifier emits, which is the form most likely to appear'
  ).toBe(1);
  expect(importsIn(`@import'/x.css';`).length, 'the @import matcher missed the unspaced single-quoted form').toBe(1);
  expect(importsIn(`@import '../../contracts/tokens.css';`).length, 'the @import matcher missed a quoted form').toBe(1);

  expect(imports, 'the compiled stylesheet leaves an @import for the browser to resolve').toEqual([]);

  for (const marker of CONTRACT_MARKERS) {
    const carrying = markers.get(marker) ?? [];
    expect(
      carrying.length,
      `${marker} is declared only by contracts/tokens.css and appears in no stylesheet ${ROUTE} links ` +
        `(${hrefs.join(', ')}). The token contract is not inlined into the build.`
    ).toBeGreaterThan(0);
    // Pinned at one, on the same rule as every other count in this story. Two stylesheets both
    // carrying the contract would mean the 89 declarations and the three `@font-face` blocks ship
    // twice, which is a payload defect the "is it inlined at all" check above cannot see.
    expect(
      carrying,
      `${marker} appears in more than one stylesheet ${ROUTE} links, so the contract is inlined twice`
    ).toHaveLength(1);
  }

  // "Not wired" and "wired and broken" are different findings and are reported as such. A
  // stylesheet carrying no contract face at all means the Sass load did not land, and saying
  // "a font URL 404'd" about that would send the next reader to the wrong place.
  expect(
    found.length,
    `no @font-face for any of ${CONTRACT_FAMILIES.join(', ')} appears in any stylesheet ${ROUTE} links ` +
      `(${hrefs.join(', ')}). The contract is not wired into the stylesheet graph.`
  ).toBeGreaterThan(0);

  for (const family of CONTRACT_FAMILIES) {
    expect(
      found.map((entry) => entry.family),
      `${family} is declared in contracts/fonts.css but appears in no stylesheet ${ROUTE} links`
    ).toContain(family);
  }

  const observed: string[] = [];
  const broken: string[] = [];

  for (const entry of found) {
    const absolute = new URL(entry.url, entry.from).toString();
    const face = await request.get(absolute);
    const body = await face.body();
    const signature = body.subarray(0, 4).toString('latin1');
    const type = (face.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    observed.push(`${face.status()} ${body.length} ${type || '(none)'} ${signature} ${entry.family} ${absolute}`);

    if (face.status() !== 200) broken.push(`${entry.family}: ${absolute} answered HTTP ${face.status()}, not 200`);
    else if (body.length === 0) broken.push(`${entry.family}: ${absolute} answered 200 with a zero-length body`);
    // A 200 with a body is what an error page is too. The four-byte signature is what makes
    // this a check that a font arrived, which is the whole stated reason the check exists.
    else if (signature !== WOFF2_SIGNATURE) {
      broken.push(
        `${entry.family}: ${absolute} answered 200 with ${body.length} bytes beginning "${signature}", ` +
          `not "${WOFF2_SIGNATURE}", so what was served is not a woff2`
      );
    } else if (type !== 'font/woff2') {
      broken.push(`${entry.family}: ${absolute} was served as "${type || '(no content-type)'}", not font/woff2`);
    }
  }

  console.log(`contract-anchor face requests:\n${observed.join('\n')}`);

  expect(broken, `a contract face does not resolve from the built Hub:\n${broken.join('\n')}`).toEqual([]);

  // Reaching the document's font set is a different claim from appearing in a stylesheet the
  // page fetched, and both are asserted because neither covers the other: text found in a
  // response body proves the bytes arrived, and `document.fonts` proves the browser parsed
  // them into real `@font-face` rules on this page.
  //
  // **Not `document.fonts.check`, and the reason changed with Story 1-18.** The reason used to be
  // that nothing in the Hub set a contract family on anything, so an unused face was never
  // downloaded and `check` correctly answered `false`. **That is no longer true**: the alias layer
  // points `--font-regular`, `--font-bold`, `--monument-regular`, `--monument-bold` and
  // `--font-mono` at `--f-body`, `--f-display` and `--f-mono`, so all three published families are
  // now used and all three load on this route.
  //
  // The check here is still **declaration**, and the load status is still logged rather than
  // asserted, but for a different reason: which faces a given route happens to rasterise is a
  // property of that route's content, not of the wiring this case is about, and pinning it here
  // would make an unrelated content change fail a wiring assertion. What is asserted is that every
  // published family reached `document.fonts` at all. `tests/e2e/contract-serving.pw.ts` is where
  // availability is asserted, on a fixture that uses the families, and at each face's own weight,
  // because `Bricolage Grotesque` publishes `font-weight: 700 800` and a bare
  // `16px "Bricolage Grotesque"` asks about a weight no published face declares.
  // `tests/e2e/anchor-aliases.pw.ts` is where the families are asserted to reach real call sites.
  const declaredToDocument = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family.replace(/^["']|["']$/g, ''), status: face.status }))
  );
  console.log(
    `contract-anchor faces in document.fonts:\n` +
      declaredToDocument
        .filter((face) => CONTRACT_FAMILIES.includes(face.family))
        .map((face) => `  ${face.family}: ${face.status}`)
        .join('\n')
  );
  for (const family of CONTRACT_FAMILIES) {
    expect(
      declaredToDocument.map((face) => face.family),
      `${family} is in a stylesheet ${ROUTE} links but never reached document.fonts`
    ).toContain(family);
  }
});

test('the Hub renders the token roles its alias layer maps its own names onto', async ({ page }) => {
  const onWork = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(onWork?.status(), `${ROUTE} did not answer 200`).toBe(200);

  // **What changed here, and which story changed it.** This case was
  // `the Hub renders the values it rendered before the contract was wired in`, and it asserted
  // that these same reads still answered pure white and pure black, because Story 1-17 wired the
  // contract in and consumed nothing. **Story 1-18 wrote the alias layer**: `--white-color` is
  // now `var(--token-text)` and `--black-color` is `var(--token-bg)`, so pure white and pure
  // black are retired from the system. The reads are the same reads. What moved is the expected
  // value, and it is sourced from the role in this same page rather than restated as a literal.

  const roles = await probeRoleColours(page, ['--token-text', '--token-bg']);

  // The two roles must differ, or every comparison below could be satisfied by one colour.
  expect(roles['--token-text'], '--token-text and --token-bg resolve to the same colour').not.toBe(roles['--token-bg']);

  // `body` takes its colour from `--white-color`, which is `--token-text` now. `body#work`
  // (`app/app.scss`) still paints its own background over `background: var(--black-color)` at a
  // higher specificity, and that `#0a000f` literal belongs to UX-DR10 and the Epic 2 redesign
  // rather than to this step, so it is asserted unmoved.
  expect(await computedStyleValue(page, 'body', 'color'), 'body no longer paints --token-text').toBe(
    roles['--token-text']
  );
  expect(await computedStyleValue(page, 'body', 'background-color')).toBe('rgb(10, 0, 15)');

  // Each of the four against the role it names, read on `:root` in the same page. Both sides are
  // custom property token streams here, so this comparison is exact rather than canonicalised,
  // and it fails naming the property, the role and both values.
  const drift: string[] = [];
  for (const name of PRE_CHANGE_NAMES) {
    const role = aliasRole(name);
    expect(role, `app/app.scss no longer aliases ${name} onto a token role`).toBeTruthy();
    const aliased = await rootCustomPropertyValue(page, name);
    const direct = await rootCustomPropertyValue(page, role ?? '');
    if (aliased !== direct) {
      drift.push(`${name} aliases ${role}: ${name} reads "${aliased}", ${role} reads "${direct}"`);
    }
  }
  expect(drift, `an alias no longer resolves to the role it names:\n${drift.join('\n')}`).toEqual([]);

  // `--black-color` is read on a probe rather than on `body`, because **the base `body`
  // background is not visible on `/work`**, the one URL this file visits:
  // `body#work` and `body#projects` override it (`app/app.scss:53-55`), `body[id='']` overrides
  // it for `/` (`components/organisms/HomeLayout/HomeLayout.scss:1-2`) and `#celeste` overrides
  // it for `/celeste` (`components/organisms/Celeste/celeste.scss:1-2`).
  //
  // **Corrected by Story 1-18.** This comment used to say the base rule is visible on `/cv` and
  // `/recommendation`, whose `body#cv` and `body#recommendation` match none of those rules. Those
  // two routes never render: `next.config.js` redirects both, permanently, to a PDF, so a browser
  // asked for either starts a download. The claim came from
  // `ops/anchor-token-adoption.md` § "A second finding", which reached it by reading stylesheets
  // and said so, and Story 1-18 falsified it by navigating. **The one surface where the base rule
  // paints is the 404**, which `app/not-found.tsx` renders through the same root layout and the
  // same `Body`, and whose stripped id matches none of the three rules above.
  //
  // That surface is not visited here and is not captured by the screenshot baseline, so this probe
  // is not a convenience: it is the only place in **this file** where the value it paints is
  // observed at all. `tests/e2e/anchor-aliases.pw.ts` reads the real `body` on the 404 surface,
  // and the probe is kept rather than replaced because the two answer different questions: a probe
  // on `/work` is what fails if the alias stops resolving anywhere.
  const used = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;left:-99999px;top:0;width:1px;height:1px;' +
      'background-color:var(--black-color);color:var(--white-color);';
    document.body.appendChild(probe);
    const computed = window.getComputedStyle(probe);
    const read = { background: computed.backgroundColor, color: computed.color };
    probe.remove();
    return read;
  });
  expect(used.background, 'var(--black-color) no longer resolves to what --token-bg resolves to').toBe(
    roles['--token-bg']
  );
  expect(used.color, 'var(--white-color) no longer resolves to what --token-text resolves to').toBe(
    roles['--token-text']
  );

  // The inversion stated as its own claim rather than left implicit in the two above. Story 1-17
  // asserted these were pure black and pure white; retiring both is what Story 1-18 is for.
  expect(used.background, 'pure black is retired from the system').not.toBe('rgb(0, 0, 0)');
  expect(used.color, 'pure white is retired from the system').not.toBe('rgb(255, 255, 255)');

  // None of the Hub's sixteen is a contract name, which is why the render can be identical by
  // construction rather than by luck. `app/__tests__/anchor-contract.test.ts` is the
  // authoritative check with both counts pinned; this asserts the same thing where the values
  // were just read, so neither half can drift alone.
  const collisions = [...HUB_DECLARED.keys()].filter((name) => DECLARED.has(name));
  expect(collisions, `the contract and app/app.scss declare the same custom property`).toEqual([]);
  expect([...HUB_DECLARED.keys(), '--tap'].filter((name) => DECLARED.has(name))).toEqual(['--tap']);
});
