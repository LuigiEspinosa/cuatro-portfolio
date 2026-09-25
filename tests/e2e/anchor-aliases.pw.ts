import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue } from './harness';

/**
 * The alias layer's deletion, measured in a real browser (Story 2-22, Anchor migration step 7).
 *
 * Story 1-18 wrote the layer: thirteen of the Hub's custom properties redefined in `app/app.scss` as
 * `var()` references to token roles, so the fifteen 2023 component stylesheets could go on reading the
 * old names while Epic 2 rebuilt each against the contract. This file measured that layer for four
 * weeks: every alias resolving to its role, the per-call-site boundary and ornament reads, the hand-set
 * weights a family alias could not carry, the literals it had to leave alone. Story 2-33 rebuilt the last
 * component that read an alias, which is FR-37's removal condition, and Story 2-22 deleted the layer.
 *
 * **What is measured here now is the absence, where only a browser can see it**, and the parts of the
 * old file that were never about the aliases:
 *
 *  1. **`:root` in the compiled stylesheet carries the contract's properties, and nothing else.**
 *     Every stylesheet the build writes is parsed by the browser's own CSS parser, grouping rules
 *     included, and every custom property declared on a rule that reaches the root element is
 *     collected. That is the build's word, after Sass and the minifier, which a read of
 *     `app/app.scss` cannot give: a partial, a library stylesheet or a rewrite could put a name on
 *     `:root` that no source in this repository spells. **Until 2026-09-24 it admitted
 *     `--hero-height` too**, and a second claim read that property's authored `40vh`; the Operator's
 *     ruling of that day deleted it and amended Story 2.22's criterion (DW-122).
 *  2. **The base `body` rule paints the roles it names**, on the 404 surface where nothing overrides
 *     it: the ground, the copy, the body family and the regular weight, and neither colour is pure.
 *  3. **Every route the Hub serves still answers 2xx** (NFR-2).
 *
 * `app/__tests__/anchor-contract.test.ts` is the source half: it holds `app/app.scss` to declaring no
 * custom property at all, and searches every file git tracks for the thirteen deleted names. This file
 * names none of them, and does not need to: a name outside the contract on `:root` fails here whatever
 * it is called.
 *
 * **Nothing here is restated.** The contract's names are parsed out of `contracts/tokens.css`, the
 * Hub's out of `app/app.scss`, the roles are read back in the same page, and every expected colour is
 * put through a probe element rather than written down as a literal, because a computed colour and a
 * custom property's token stream do not serialise the same way.
 *
 * Every predicate this file introduces is shown firing on a planted control, and every parsed list is
 * asserted non-empty and carrying a known member, so a case cannot pass over nothing.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here
// even though TypeScript accepts it. Same as `tests/e2e/contract-anchor.pw.ts`.
const REPO_ROOT = resolve(__dirname, '..', '..');

const APP_SCSS = readFileSync(join(REPO_ROOT, 'app', 'app.scss'), 'utf8');
const TOKENS_CSS = readFileSync(join(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/** Where Next 16 writes the built stylesheets, the directory `accessibility-floor.pw.ts` reads too. */
const CHUNK_DIR = join(REPO_ROOT, '.next', 'static', 'chunks');

/**
 * Every route the Hub serves. NFR-2 binds every migration step, so all five are swept.
 *
 * **Seven until 2026-09-07.** Story 2-14 replaced `/projects` with a 301 to `/#suite`, so the
 * route no longer answers a document of its own: left in this list it would land on `/`, fail the
 * redirect pin at the end of this file, which named exactly the PDF routes, and duplicate what
 * `tests/e2e/projects-redirect.pw.ts` asserts far more precisely.
 *
 * **Six until 2026-09-11.** Story 2-17 retired `/recommendation`, the last route in this list that
 * redirected: it answers 404 now, which the sweep below refuses, and its retirement is asserted in
 * `tests/e2e/secondary-surfaces.pw.ts`. The redirect pin at the end of this file reads empty.
 */
const ROUTES = ['/', '/cv', '/work', '/celeste', '/api/health'] as const;

/**
 * A path the Hub does not route, which renders `app/not-found.tsx` through the same root layout
 * and the same `Body`, and the surface the base rule's ground, copy, family and weight are read on
 * below. It carried two alias call sites of its own until Story 2-30 rebuilt the 404 on 2026-09-23.
 */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * The Hub declares no custom property of its own.
 *
 * **Sixteen, twelve and four until 2026-09-12**, when Story 2-20 retargeted one alias and deleted a
 * dead one. **Fifteen and two until 2026-09-23**, when Story 2-34 deleted a dead colour literal the
 * FR-17 gate refuses. **Fourteen, thirteen of them aliases, until later on 2026-09-23**, when Story
 * 2-22 deleted the thirteen. **One, `--hero-height`, until 2026-09-24**, when the Operator's ruling
 * deleted it (DW-122): nothing had read it since at least 2026-08-26. Each time the same count moved in
 * `app/__tests__/anchor-contract.test.ts` and `tests/e2e/contract-anchor.pw.ts` in the same commit.
 */
const HUB_PROPERTY_COUNT = 0;

/** The counts `contracts/tokens.css` publishes at v1.0.0, pinned as `contract-anchor.pw.ts` pins them. */
const DECLARED_COUNT = 89;
const REDUCED_COUNT = 4;

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

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

/** The Hub's own on its `:root`, as `app/app.scss` authors them: none since 2026-09-24. */
const HUB = declarationsIn(/:root\s*\{([^}]*)\}/.exec(withoutComments(APP_SCSS))?.[1] ?? '');

const REDUCED_BLOCK = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/;

/** Every custom property `contracts/tokens.css` puts on `:root` outside a media query. */
const CONTRACT = declarationsIn(
  /:root\s*\{([^}]*)\}/.exec(withoutComments(TOKENS_CSS).replace(REDUCED_BLOCK, ''))?.[1] ?? ''
);

/** The four it redefines on `:root` under `prefers-reduced-motion: reduce`. */
const CONTRACT_REDUCED = declarationsIn(REDUCED_BLOCK.exec(withoutComments(TOKENS_CSS))?.[1] ?? '');

/**
 * What `:root` may carry in the compiled stylesheet: every name the contract declares there, under
 * either block. Derived from the contract rather than typed, and from the contract alone since
 * 2026-09-24: until then the Hub's `--hero-height` was admitted too, read off `app/app.scss`, which
 * would have let a Hub name put back there through as well. Now it fails here as extra.
 */
const ROOT_ALLOWED = [...new Set([...CONTRACT.keys(), ...CONTRACT_REDUCED.keys()])].sort();

/**
 * The two names the build writes beside a `color-scheme` declaration, and nowhere else (since
 * 2026-09-24, when `app/app.scss` declared `color-scheme: dark` on the root on the Operator's ruling,
 * DW-95). Next's pipeline minifies with Lightning CSS, which polyfills `light-dark()` for the browsers
 * it targets by putting this pair of switches on the rule that declares the scheme. They are the
 * minifier's, not the contract's or the Hub's, and nothing here reads either; each is admitted only on
 * a rule that also declares `color-scheme`, read with it, so the same name anywhere else is extra.
 */
const MINIFIER_SCHEME_SWITCHES = ['--lightningcss-light', '--lightningcss-dark'] as const;

/**
 * Every stylesheet the build wrote, as text, named by its path under the chunk directory. An absent
 * or empty build throws naming the directory, so the root read never passes over nothing
 * (`accessibility-floor.pw.ts` holds its own tally to the same rule).
 */
const builtStylesheets = (directory = CHUNK_DIR): { name: string; text: string }[] => {
  if (!existsSync(directory)) {
    throw new Error(`Alias deletion: ${directory} is not there. Run corepack pnpm build first; an absent build proves nothing.`);
  }
  const found = (readdirSync(directory, { recursive: true }) as string[])
    .map((relative) => relative.replace(/\\/g, '/'))
    .filter((relative) => relative.endsWith('.css'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(directory, name), 'utf8') }));
  if (found.length === 0) {
    throw new Error(`Alias deletion: ${directory} holds no .css file, so the root read would pass over nothing.`);
  }
  return found;
};

interface RootDeclaration {
  readonly sheet: string;
  readonly selector: string;
  readonly name: string;
  /** The `color-scheme` the same rule declares, or `''`. */
  readonly scheme: string;
}

/** A root declaration the allowed set does not cover and no scheme declaration explains. */
const isExtra = (entry: RootDeclaration): boolean =>
  !ROOT_ALLOWED.includes(entry.name) &&
  !((MINIFIER_SCHEME_SWITCHES as readonly string[]).includes(entry.name) && entry.scheme !== '');

/**
 * Every custom property the given stylesheets declare on a rule that reaches the root element, and
 * every rule the walk could not read.
 *
 * Parsed in the page by the browser's own parser (`CSSStyleSheet.replaceSync`), so the minifier's
 * spelling is no obstacle, and walked through every grouping rule, because the contract's colours
 * arrive twice: once as a hex fallback, once inside `@supports (color: lab(0% 0 0))`. **A rule
 * reaches the root** when the root element matches its selector with the conditions that depend on
 * the moment taken out: a user-action state (`:hover`, `:focus` and their kin) and `:has()`, whose
 * answer depends on what the page the read happens to run on contains (`html:has(.header-container)`
 * is in the build, and `/` renders no header). So `:root`, `html`, `*`, `:root:hover` and
 * `html:has(...)` are read, and `*:not(:root)` or `html body` are not. A selector the parser refuses
 * after that falls back to whether it names `:root`.
 *
 * **What it cannot read fails closed.** The build flattens nesting, so no nested style rule is
 * expected, and a nested rule's relative selector cannot be matched against the root on its own; and a
 * constructed stylesheet drops an `@import` rather than following it, so a chunk carrying one would be
 * read without what it imports. Either is reported rather than skipped, which is the shape
 * `ops/literal-conformance.mjs` takes with a statement it cannot read.
 */
const rootDeclarations = async (
  page: Page,
  sheets: readonly { name: string; text: string }[]
): Promise<{ found: RootDeclaration[]; unread: string[] }> =>
  page.evaluate((list) => {
    const found: { sheet: string; selector: string; name: string; scheme: string }[] = [];
    const unread: string[] = [];
    const MOMENT =
      /:(?:hover|active|focus(?:-visible|-within)?|visited|target(?:-within)?)\b|:has\((?:[^()]|\([^()]*\))*\)/g;
    const reachesRoot = (selector: string): boolean => {
      try {
        return document.documentElement.matches(selector.replace(MOMENT, ''));
      } catch {
        return selector.includes(':root');
      }
    };
    const walk = (rules: CSSRuleList, sheet: string): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          if (reachesRoot(rule.selectorText)) {
            for (let index = 0; index < rule.style.length; index += 1) {
              const name = rule.style[index];
              if (name.startsWith('--')) {
                found.push({ sheet, selector: rule.selectorText, name, scheme: rule.style.getPropertyValue('color-scheme').trim() });
              }
            }
          }
          const nested = (rule as CSSStyleRule & { cssRules?: CSSRuleList }).cssRules;
          if (nested && nested.length > 0) unread.push(`${sheet}: "${rule.selectorText}" nests ${nested.length} rule(s)`);
          continue;
        }
        const children = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
        if (children) walk(children, sheet);
      }
    };
    for (const { name, text } of list) {
      if (/@import\b/i.test(text)) unread.push(`${name}: carries an @import, which a constructed stylesheet does not follow`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      walk(sheet.cssRules, name);
    }
    return { found, unread };
  }, sheets);

/**
 * The computed colour of a throwaway element painted `background-color: var(<name>)`.
 *
 * A computed `background-color` and a custom property's token stream do not serialise the same way,
 * so an expected role is put through a real element in the same page rather than compared as text or
 * written down as a literal.
 */
const probeRoleColours = async (page: Page, names: readonly string[]): Promise<Record<string, string>> => {
  const read = await page.evaluate((properties: string[]) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const answers: Record<string, string> = {};
    for (const property of properties) {
      // `cssText` rather than `style.backgroundColor = 'var(...)'`: a whole declaration block is
      // the shape a `var()` reference is unambiguously accepted in, and it is the shape
      // `tests/e2e/contract-anchor.pw.ts` already reads its probe through.
      probe.style.cssText =
        `position:absolute;left:-99999px;top:0;width:1px;height:1px;background-color:var(${property});`;
      answers[property] = window.getComputedStyle(probe).backgroundColor;
    }
    probe.remove();
    return answers;
  }, [...names]);

  // `background-color` falls back to the initial transparent when the reference does not resolve,
  // and two unresolved roles would then compare equal to each other and to nothing meaningful.
  for (const name of names) {
    expect(read[name], `var(${name}) did not resolve to a colour on the probe`).not.toBe('rgba(0, 0, 0, 0)');
  }
  return read;
};

/**
 * The computed `font-family` and `font-weight` of a throwaway element declared with each, read in the
 * same page, so the base rule's family and weight are compared against their roles and not against a
 * stack or a number typed here.
 */
const probeType = async (page: Page, family: string, weight: string): Promise<{ family: string; weight: string }> =>
  page.evaluate(
    ([declaredFamily, declaredWeight]) => {
      const probe = document.createElement('div');
      probe.style.cssText =
        `position:absolute;left:-99999px;top:0;width:1px;height:1px;` +
        `font-family:${declaredFamily};font-weight:${declaredWeight};`;
      document.body.appendChild(probe);
      const computed = window.getComputedStyle(probe);
      const read = { family: computed.fontFamily, weight: computed.fontWeight };
      probe.remove();
      return read;
    },
    [family, weight]
  );

/**
 * A colour rasterised to four 8-bit sRGB channels through a 1 x 1 canvas.
 *
 * The build rewrites colours on the way to the browser (`rgba(139, 92, 246, 0.4)` arrives as
 * `#8b5cf666`), so a text comparison against an authored literal would report a drift the pipeline
 * did not cause. The canvas is the browser's own parser, and `globalCompositeOperation = 'copy'` keeps
 * the alpha rather than compositing it away. A `fillStyle` the context cannot parse is specified to be
 * *ignored*, leaving the previous colour in place, so a sentinel write proves the assignment took and
 * an unparsed value is reported rather than swallowed.
 */
const rasterise = async (page: Page, values: readonly string[]): Promise<string[]> => {
  const read = await page.evaluate((list: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    // A sentinel for every input, so a missing context cannot answer with a value that compares
    // equal to another missing context's. It is thrown on below rather than returned.
    if (!context) return list.map(() => 'no-2d-context');

    // **Two sentinels, not one.** With a single one, any input that happens to be another
    // spelling of it (`rgb(18, 52, 86)`, `#123456ff`) leaves `fillStyle` unchanged and would be
    // reported as unparseable, which is a measurement this helper never made. A value can equal
    // one of these two, never both, so an assignment that sticks to neither is the only thing
    // reported as refused.
    const SENTINELS = ['#123456', '#654321'] as const;
    context.globalCompositeOperation = 'copy';

    return list.map((value) => {
      const refused = SENTINELS.every((sentinel) => {
        context.fillStyle = sentinel;
        context.fillStyle = value;
        return context.fillStyle === sentinel;
      });
      if (refused) return `unparsed-by-canvas:${value}`;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return `${r},${g},${b},${a}`;
    });
  }, [...values]);

  // **Thrown rather than returned.** A missing 2D context answered `no-2d-context` for every input,
  // so a comparison would have compared two identical sentinels, found no drift, and reached its
  // verdict over a measurement that never happened.
  if (read.some((answer) => answer === 'no-2d-context')) {
    throw new Error(
      `Alias deletion: the page gave no 2D canvas context, so none of ${values.join(', ')} was ` +
        `rasterised. A colour comparison cannot be made and is reported rather than assumed equal.`
    );
  }
  return read;
};

const PURE_BLACK = '0,0,0,255';
const PURE_WHITE = '255,255,255,255';

/** Navigate, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * **What left this file on 2026-09-23 with the layer it measured.** The alias map parsed out of
 * `app/app.scss` and the case reading every alias against its role on `:root`; the component
 * stylesheet map and the counter that pinned each retired alias at zero call sites on disk (the
 * search in `app/__tests__/anchor-contract.test.ts` reads every file for the names now, not only the
 * stylesheets under `components/`); and, earlier, the per-call-site boundary and ornament table, the
 * hand-set weight table, the clamp precondition, the pseudo-element read and the wide-viewport
 * context, each of which left with the last row it read and is recorded in
 * `ops/anchor-token-adoption.md` as it was taken. **And on 2026-09-24 the case that read the one
 * property the Hub kept**, `--hero-height`, against its authored `40vh` through `rootCustomPropertyValue`,
 * with the reference matcher that told a literal from a `var()`; the Operator's ruling deleted the
 * property (DW-122), and a case over an empty list would pass over nothing. Kept as a note so a later
 * reader knows each was built once and why it went.
 */
test('parses a real app.scss and a real contract, so every case below measures something', () => {
  expect(/color-scheme\s*:\s*dark/.test(withoutComments(APP_SCSS)), 'app/app.scss was not read, or lost its one :root rule').toBe(true);
  expect([...HUB.keys()], 'app/app.scss declares a custom property on :root again').toEqual([]);
  expect(HUB.size).toBe(HUB_PROPERTY_COUNT);
  expect(CONTRACT.size, 'contracts/tokens.css no longer declares 89 custom properties on :root').toBe(DECLARED_COUNT);
  expect(CONTRACT_REDUCED.size, 'the reduced-motion block no longer redefines 4 values').toBe(REDUCED_COUNT);
  for (const known of ['--token-bg', '--token-text', '--f-body', '--w-regular', '--page-pad']) {
    expect([...CONTRACT.keys()], `contracts/tokens.css no longer declares ${known}`).toContain(known);
  }
  for (const name of CONTRACT_REDUCED.keys()) {
    expect([...CONTRACT.keys()], `${name} is redefined under reduced motion but never declared`).toContain(name);
  }
  expect(ROOT_ALLOWED.length, 'the allowed root set is not the contract alone').toBe(DECLARED_COUNT);

  // The parsers, on planted controls, before any empty or agreeing result is read as good news: the
  // `:root` read finds the property the Hub declared until 2026-09-24, as it was written.
  expect([...declarationsIn(/:root\s*\{([^}]*)\}/.exec(':root {\n  --hero-height: 40vh;\n}')?.[1] ?? '').keys()]).toEqual([
    '--hero-height',
  ]);
  expect([...declarationsIn('  --a: 1px; --b: var(--c);').entries()]).toEqual([
    ['--a', '1px'],
    ['--b', 'var(--c)'],
  ]);
  expect([...declarationsIn('.btn--primary:hover { color: red; }').keys()]).toEqual([]);

  // The build read, on planted directories: an absent one and one holding no stylesheet both throw
  // naming the directory, so the root read below can never pass over nothing.
  const empty = mkdtempSync(join(tmpdir(), 'alias-deletion-'));
  try {
    expect(() => builtStylesheets(join(empty, 'absent'))).toThrow(/is not there/);
    expect(() => builtStylesheets(empty)).toThrow(/holds no \.css file/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test(':root in the compiled stylesheet carries only the contract’s properties', async ({ page }) => {
  // Story 2-22's second criterion as the Operator's ruling of 2026-09-24 amended it (DW-122: the
  // contract's properties alone, where it had read "plus `--hero-height`"), read off the build. A page
  // is needed for its parser and its root element; which route does not matter, because every
  // stylesheet is read whether this route links it or not, a chunk only another route or a dynamic
  // boundary loads included.
  await goTo(page, '/');

  const built = builtStylesheets();
  const { found, unread } = await rootDeclarations(page, built);
  expect(unread, `a built rule could not be read, so the root set below may be missing it:\n${unread.join('\n')}`).toEqual(
    []
  );

  const names = [...new Set(found.map((entry) => entry.name))].sort();
  const extra = found.filter(isExtra).map((entry) => `${entry.sheet}: "${entry.selector}" declares ${entry.name}`);

  // The minifier's pair arrives once, on the rule that declares the Hub's one scheme, and nowhere else.
  expect(
    found
      .filter((entry) => (MINIFIER_SCHEME_SWITCHES as readonly string[]).includes(entry.name))
      .map((entry) => `${entry.selector} ${entry.name} with color-scheme ${entry.scheme}`),
    'the build does not write the light-dark switches exactly once, beside color-scheme: dark'
  ).toEqual(MINIFIER_SCHEME_SWITCHES.map((name) => `:root ${name} with color-scheme dark`));
  const missing = ROOT_ALLOWED.filter((name) => !names.includes(name));

  console.log(
    `alias deletion: ${built.length} built stylesheets read, ${found.length} root declarations, ` +
      `${names.length} distinct names, in ${[...new Set(found.map((entry) => entry.sheet))].join(', ')}`
  );

  expect(
    extra,
    `the compiled stylesheet puts a custom property on :root that is not the contract's:\n${extra.join('\n')}`
  ).toEqual([]);
  expect(missing, `a name the contract declares never reaches :root in the build:\n${missing.join('\n')}`).toEqual([]);

  // The walk, on planted controls through the same function and the same parser: a plain root rule,
  // one inside a grouping rule, the root element by its type selector, a root state the page is not in
  // and a root condition this page does not meet are each collected; a rule on another element, one that
  // excludes the root, one on a descendant of it and a standard property are not; a nested style rule
  // and an `@import` are reported as unread rather than skipped.
  const planted = await rootDeclarations(page, [
    {
      name: 'planted.css',
      text:
        ':root{--planted-root:1px;color:red}' +
        '@supports (display:grid){@media (min-width:1px){:root{--planted-group:1px}}}' +
        'html{--planted-html:1px}' +
        ':root:hover{--planted-state:1px}' +
        'html:has(.a-class-this-page-does-not-render){--planted-has:1px}' +
        'body{--planted-body:1px}' +
        '.x{--planted-class:1px}' +
        '*:not(:root){--planted-not-root:1px}' +
        'html body{--planted-descendant:1px}',
    },
    { name: 'nested.css', text: '.y{color:red;& .z{--planted-nested:1px}}' },
    { name: 'import.css', text: '@import url(elsewhere.css);:root{--planted-imported:1px}' },
  ]);
  expect(planted.found.map((entry) => entry.name).sort(), 'the root walk no longer collects what it should').toEqual([
    '--planted-group',
    '--planted-has',
    '--planted-html',
    '--planted-imported',
    '--planted-root',
    '--planted-state',
  ]);
  expect(planted.unread, 'a rule the walk cannot read was skipped rather than reported').toEqual([
    'nested.css: ".y" nests 1 rule(s)',
    'import.css: carries an @import, which a constructed stylesheet does not follow',
  ]);

  // And the comparison, on a planted root set: a name outside the allowed set is extra, the property
  // the Hub declared until 2026-09-24 among them, and a contract name the build never carried is missing.
  expect(['--token-bg', '--planted-root', '--hero-height'].filter((name) => !ROOT_ALLOWED.includes(name))).toEqual([
    '--planted-root',
    '--hero-height',
  ]);

  // The minifier's switches, both ways: beside a scheme they are the build's, and without one, on the
  // same element, they are extra like any other name.
  const switches = await rootDeclarations(page, [
    {
      name: 'switches.css',
      text: ':root{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}html{--lightningcss-dark:initial}',
    },
  ]);
  expect(switches.found.filter(isExtra).map((entry) => `${entry.selector} ${entry.name}`)).toEqual(['html --lightningcss-dark']);
});

test('the base rule paints the ground, copy, family and weight it names, and neither colour is pure', async ({ page }) => {
  // **The 404, and it stopped being the only choice on 2026-09-10.** Story 1-17 concluded from the
  // stylesheets that `/cv` and `/recommendation` were the two routes where the base `body` rule
  // paints, and said so while recording that it had not rendered them
  // (`ops/anchor-token-adoption.md` § "A second finding"). Story 1-18 falsified that by navigating:
  // `next.config.js` redirected both, permanently, to a PDF under `/pdf/`, so a browser asked for
  // either started a download and painted no Hub page, and the 404 was the one surface left.
  //
  // **Story 2-16 built `/cv`**, which removes that redirect, so `body#cv` is now a second surface
  // where nothing overrides the base rule. **Story 2-17 retired `/recommendation`** on 2026-09-11,
  // so that route is the 404 document now rather than a third surface. The reading stays on the
  // 404 deliberately: it is the surface every earlier reading in this file was taken on, and
  // moving it would change what the comparison below is a re-measurement of. `tests/e2e/cv.pw.ts`
  // is where the other surface's ground is asserted.
  //
  // `Container.tsx` sets `<body id={route}>` from the stripped, hyphenated pathname, and an
  // unrouted path's id matches none of `body[id='']` (`HomeLayout.scss`) or `#celeste`
  // (`celeste.scss`), so nothing overrides the base rule there. It matched none of `body#work`
  // either, until Story 2-33 deleted that rule on 2026-09-23 and `/work` took the base rule as well.
  // `Error404.scss` paints no ground at all, so this base rule is the ground a visitor sees on the 404,
  // as `tests/e2e/error-surface.pw.ts` samples.
  //
  // **Story 2-22 repointed the rule** from the three aliases it read to the roles they resolved to,
  // and named the regular weight `DESIGN.md` § The mapping gives the body family, which the initial
  // 400 had supplied until then. The family and the weight are read here for the first time, because
  // until that story the family came through an alias the per-alias case already compared and the
  // weight came from no rule at all.
  await goTo(page, NOT_FOUND, 404);

  // The guard, saying what it actually covers. The three rules that overrode the base ground on
  // the other routes all painted a grid **image** as well as a colour, so an image on `body` here
  // meant one of them had started matching the 404's id; none is left since Story 2-33, and an image
  // here now means a new one arrived. It does not cover a colour-only override, which is why it is
  // not the assertion this case rests on: the comparison against `--token-bg` below is, and a
  // colour-only override fails there naming both values.
  expect(
    await computedStyleValue(page, 'body', 'background-image'),
    'body on the 404 surface paints a background image, so one of the grid-ground rules now matches ' +
      'it and the base rule is no longer what this case reads'
  ).toBe('none');

  const roles = await probeRoleColours(page, ['--token-bg', '--token-text']);
  expect(roles['--token-bg'], '--token-bg and --token-text resolve to the same colour').not.toBe(roles['--token-text']);

  const background = await computedStyleValue(page, 'body', 'background-color');
  const colour = await computedStyleValue(page, 'body', 'color');

  expect(background, 'the body ground where the base rule paints is not --token-bg').toBe(roles['--token-bg']);
  expect(colour, 'body copy where the base rule paints is not --token-text').toBe(roles['--token-text']);

  // The family and the weight, each against a probe declared with the role in the same page, and the
  // probe itself against a control declared with something else, so an equality cannot come from a
  // probe that ignored its declaration and inherited the body's.
  const type = await probeType(page, 'var(--f-body)', 'var(--w-regular)');
  const control = await probeType(page, 'var(--f-display)', 'var(--w-black)');
  expect(type.family, 'the body family role reads the same stack as the display role, so it discriminates nothing').not.toBe(
    control.family
  );
  expect(type.weight, 'the regular weight role reads the same number as the black one').not.toBe(control.weight);
  expect(await computedStyleValue(page, 'body', 'font-family'), 'the body family is not --f-body').toBe(type.family);
  expect(await computedStyleValue(page, 'body', 'font-weight'), 'the body weight is not --w-regular').toBe(type.weight);

  // And neither colour is pure, compared as pixels rather than as strings, because a colour can be
  // written several ways and the build writes it in one of them.
  const [groundPixel, copyPixel, blackPixel, whitePixel] = await rasterise(page, [
    background,
    colour,
    'rgb(0, 0, 0)',
    'rgb(255, 255, 255)',
  ]);
  expect(blackPixel, 'the raster control for pure black no longer holds').toBe(PURE_BLACK);
  expect(whitePixel, 'the raster control for pure white no longer holds').toBe(PURE_WHITE);
  const [refused] = await rasterise(page, ['not-a-colour-at-all']);
  expect(refused, 'the canvas guard no longer reports a value it could not parse').toBe(
    'unparsed-by-canvas:not-a-colour-at-all'
  );
  expect(groundPixel, 'the body ground is pure black, which the contract retires').not.toBe(PURE_BLACK);
  expect(copyPixel, 'body copy is pure white, which the contract retires').not.toBe(PURE_WHITE);
});

test('every route the Hub serves still answers 2xx', async ({ page }) => {
  // NFR-2 binds every migration step, so this is measured rather than assumed.
  //
  // **`page.request` and not `page.goto`.** Until 2026-09-11 one of the routes, `/recommendation`,
  // was a permanent redirect to a PDF (`next.config.js`), so a browser asked for it started a
  // download rather than a navigation and `page.goto` rejected with "Download is starting". The
  // request context follows a redirect and reports the status the visitor ends on, which is what
  // NFR-2 is about. Whether anything redirects is pinned below rather than absorbed, because a
  // redirect is the fact that moved this file's body-ground read onto the 404 surface. **`/cv`
  // redirected until 2026-09-10**, when Story 2-16 built the page behind it, and `/recommendation`
  // until Story 2-17 retired the route; the method is unchanged and only the set moved, to empty.
  const failures: string[] = [];
  const landedOn = new Map<string, string>();

  for (const route of ROUTES) {
    const response = await page.request.get(route);
    landedOn.set(route, new URL(response.url()).pathname);
    if (!response.ok()) failures.push(`${route} answered ${response.status()}`);
  }

  const notFound = await page.request.get(NOT_FOUND);
  if (notFound.status() !== 404) failures.push(`${NOT_FOUND} answered ${notFound.status()}, expected 404`);

  expect(landedOn.size, 'no route was visited').toBe(ROUTES.length);
  expect(failures, `a route stopped answering:\n${failures.join('\n')}`).toEqual([]);

  // The set of routes that redirect, pinned so a redirect quietly added or removed shows up here
  // rather than as a puzzling download three stories later.
  //
  // **This pin deliberately did not widen when Story 2-14 added a third redirect.** Operator ruling
  // of 2026-09-07: `/projects` answers a 301 that lands on `/`, which is a Hub document rather than
  // a PDF, so it would have failed the `/pdf/` assertion this pin used to carry and said nothing
  // this file is about. It left `ROUTES` instead, and `tests/e2e/projects-redirect.pw.ts` asserts
  // the status code and the `Location` header without following either.
  //
  // **It narrowed on 2026-09-10 and emptied on 2026-09-11.** Story 2-16 built `/cv` as a page, so
  // the route answers its own document and lands where it was asked; it stays in `ROUTES` and
  // stopped appearing here. Story 2-17 retired `/recommendation`, the last route that landed on a
  // PDF, and it left `ROUTES` because it answers 404 now. The pin reads `[]` and stays: it is the
  // direction this pin is allowed to move in, and a redirect added back would fail it. The loop
  // that asserted each redirected route landed under `/pdf/` went with the last member rather than
  // being left iterating nothing.
  const redirected = [...landedOn].filter(([route, landing]) => route !== landing).map(([route]) => route);
  expect(redirected.sort(), 'the set of routes that redirect away from the Hub has changed').toEqual([]);

  // The viewport the whole file reads at, asserted rather than assumed from the config.
  expect(page.viewportSize()).toEqual({ ...RENDERED_VIEWPORT });
});
