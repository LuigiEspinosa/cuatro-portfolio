import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';

/**
 * The type swap, observed on the Hub's real routes (Story 2-20, migration step 5).
 *
 * Until this story the Hub self-hosted ten legacy faces through `app/scss/_fonts.scss` and served
 * their binaries from `public/fonts/`, and one rule reached one of them: `--confillia-normal`, at
 * the two hero panels on `/`. That alias now lands on the display role with `font-stretch: 75%`
 * set by hand at both call sites, the partial and the directory are gone, and the two preloads
 * in `app/layout.tsx` went with them (`tests/e2e/narrative.pw.ts` pins that the `/` document
 * preloads no font, against a planted preload). None of that is visible to a screenshot of
 * `/work`, which no local face ever reached, and a computed `font-family` reads the declared
 * stack whether or not the face behind it loaded (`RESTYLE-SPEC.md:648`, F-2). So five things
 * are measured here:
 *
 *  1. **The two Confillia sites** compute the display family at the narrow end of its width axis,
 *     and the alias on `:root` reads the display stack.
 *  2. **No retired family survives in the built CSS on any surface**, no request reaches
 *     `/fonts/` from any of them, and the old binary's URL answers 404.
 *  3. **The swap holds the line box still** on every element that reaches the display face, on
 *     the three surfaces that carry one: the same route is measured with every woff2 aborted and
 *     then allowed, which is what a visitor experiences under `font-display: swap`, and each
 *     element's height moves under 1%. That is what the four metric overrides in
 *     `contracts/fonts.css` guarantee (`ops/font-contract.md` § What the swap check does not
 *     cover): the line box, not the advance width, so widths are printed for the record and not
 *     asserted, and so are each element's rendered line count and height per line, which is what
 *     tells a failure that is a reflow (lines moved, line box held) from one that is a metric
 *     drift (line box moved).
 *  4. **The weight distinction is a width.** `getComputedStyle().fontWeight` answers the requested
 *     value, 400 at a `--monument-regular` site, not the 700 the variable face clamps it to, so
 *     one string planted at both display aliases is measured and the two widths differ.
 *  5. **The width axis is a width too.** `getComputedStyle().fontStretch` answers the requested
 *     `75%` whether or not the loaded face carries a `wdth` axis, so the same string at `75%` and
 *     at `100%` is measured and the two widths differ.
 *
 * Every predicate is shown firing on a control planted through the browser, touching no file.
 * The third's control is `contract-fonts.pw.ts`'s `probe.html` trick on a real route: a planted
 * family pointing at the same woff2 the display face loads, with the four override descriptors
 * stripped, whose line box does move across the swap. No screenshot is taken.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here
// even though TypeScript accepts it. Same as `tests/e2e/contract-anchor.pw.ts`.
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * The three families the contract publishes, parsed off the authored file so the "exactly these"
 * assertion below compares the built CSS against the contract and not against a list typed here.
 * Same expression as `app/__tests__/anchor-contract.test.ts`.
 */
const CONTRACT_FAMILIES = [
  ...readFileSync(join(REPO_ROOT, 'contracts', 'fonts.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;]+)/g),
].map((found) => found[1].trim().replace(/^["']|["']$/g, ''));

/** A path the Hub does not route, rendering `app/not-found.tsx` through the same root layout. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * Every surface the Hub serves, the list `tests/e2e/hit-target-floor.pw.ts` pins against `app/`.
 * The retired-family reads run on all five, because a `@font-face` re-declared in a chunk only
 * `/work` or `/cv` links would be invisible to a read taken on `/` alone.
 */
const SURFACES: readonly { route: string; status: number }[] = [
  { route: '/', status: 200 },
  { route: '/work', status: 200 },
  { route: '/cv', status: 200 },
  { route: '/celeste', status: 200 },
  { route: NOT_FOUND, status: 404 },
];

/** The one binary the layout preloaded on every route until this story, at the URL it preloaded. */
const RETIRED_BINARY = '/fonts/ConfilliaNormal-Regular.woff2';

/** One selector that reaches the display face, and how many elements it matches on its route. */
interface DisplaySite {
  readonly selector: string;
  readonly count: number;
}

/** The two Confillia call sites, `HomeLayout.scss:120` and `:152`, and how many elements each renders. */
const CONFILLIA_SITES: readonly DisplaySite[] = [
  { selector: 'a.nav-link', count: 2 },
  { selector: '.contact-container a', count: 3 },
];

/** The width both sites set by hand beside `font-family`, the narrow end of the published `75% 100%`. */
const CONFILLIA_STRETCH = '75%';

/**
 * Every element that reaches the display face, per surface, and how many of each the surface
 * renders. The three `--monument-bold` sites, the two `--monument-regular` sites and the two
 * Confillia sites, which is the whole set `tests/e2e/anchor-aliases.pw.ts` tables. `/cv` and
 * `/celeste` reach no display face and are not here.
 *
 * The count is pinned so the swap cannot be measured over an empty selection: a renamed class
 * fails here naming itself rather than shortening the loop below to nothing.
 */
const DISPLAY_ELEMENTS: readonly {
  route: string;
  status: number;
  selectors: readonly DisplaySite[];
  /** A node that must be attached before either pass is measured, where the page's layout settles after `load`. */
  settle?: string;
}[] = [
  {
    route: '/',
    status: 200,
    // `.glitch-text__inner` is the element the deleted preload's comment named. Under the
    // harness's reduced motion `GlitchText.tsx:30-33` sets it visible and never splits it, so
    // its box is a line box like the others.
    selectors: [...CONFILLIA_SITES, { selector: '.glitch-text__inner', count: 1 }],
  },
  {
    route: '/work',
    status: 200,
    selectors: [
      { selector: '.work-hero__heading', count: 1 },
      { selector: '.work-item__company', count: 4 },
    ],
    // The torus canvas mounts on demand after hydration and widens `.work-hero`'s grid column
    // from 216px to 300px at 360 (**observed 2026-09-12**: the column reads 216px at `load` and at
    // `fonts.ready`, 300px once `<canvas>` is attached), and the heading wraps differently in
    // each. A pass measured before the mount and a pass measured after would compare two layouts
    // rather than two faces, so both passes wait for the canvas.
    settle: '.work-hero__canvas-wrap canvas',
  },
  {
    route: NOT_FOUND,
    status: 404,
    selectors: [
      { selector: '.error-page__code', count: 1 },
      { selector: '.error-page__title', count: 1 },
    ],
  },
];

/** The share of an element's fallback height it may move across the swap. `ops/font-contract.md` records it. */
const HEIGHT_TOLERANCE = 0.01;

/** The `data-sample` key the planted override-stripped span is measured under. */
const PLANTED_STRIPPED = 'planted-stripped';

/** The `load()` spec for the planted face, at the size and weight the planted span is set in. */
const PLANTED_STRIPPED_SPEC = '700 24px "Planted Stripped"';

/** One string for the two axis comparisons, long enough that a per-glyph advance difference accumulates. */
const AXIS_SAMPLE = 'Luigi Espinosa, Senior Frontend Engineer, cuatro.dev';

/** Two spans at the same setting must measure the same width, or a difference between two settings is noise. */
const WIDTH_FLOOR = 0.5;

interface Geometry {
  width: number;
  height: number;
  /** Rendered lines, counted off the element's own line fragments, so a wrapped block is seen as one. */
  lines: number;
  /** `height / lines`: the line box, which is the thing the four override descriptors hold still. */
  lineBox: number;
}

/** The four figures `deltas` compares per element. Only `height` is asserted; the rest are printed. */
const AXES = ['width', 'height', 'lines', 'lineBox'] as const;
type Axis = (typeof AXES)[number];

/** One `@font-face` the document holds, as the sheet that declared it wrote it. */
interface FontFaceRule {
  family: string;
  src: string;
  weight: string;
  stretch: string;
  /** The sheet's URL, which a relative `url()` in `src` resolves against. */
  base: string;
}

/** Navigate, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * Wait for every face the document needs, including one planted a moment ago.
 *
 * A `@font-face` appended after `load` starts fetching at the next style recalc, not at the
 * append, so `document.fonts.ready` read synchronously afterwards can already be a resolved
 * promise and the measurement runs against the fallback. Asking for the planted faces by name
 * first makes the set `loading`, and `ready` then waits for all of it. A failed load (the aborted
 * pass) rejects `load()` and is what that pass is for, so the rejection is swallowed on purpose.
 */
const fontsReady = (page: Page, planted: readonly string[] = []): Promise<void> =>
  page.evaluate(async (specs: string[]) => {
    await Promise.all(specs.map((spec) => document.fonts.load(spec).then(() => undefined, () => undefined)));
    await document.fonts.ready;
  }, [...planted]);

/** The first family in a stack, unquoted. `"Bricolage Grotesque", Archivo, …` reads as one name. */
const firstFamily = (stack: string): string => (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');

/** A stylesheet planted into the page, touching no file. Same shape as `tests/e2e/premise.pw.ts`. */
const plantStyle = (page: Page, css: string): Promise<void> =>
  page.evaluate((text) => {
    const style = document.createElement('style');
    style.textContent = text;
    document.head.append(style);
  }, css);

/**
 * One `[data-sample]` span per name, all carrying `text`, appended to the body and laid out so
 * the fetch a planted face needs has started by the time the caller waits on it.
 */
const plantSpans = (page: Page, samples: readonly string[], text: string): Promise<void> =>
  page.evaluate(
    ([names, content]: [string[], string]) => {
      for (const sample of names) {
        const span = document.createElement('span');
        span.dataset.sample = sample;
        span.textContent = content;
        document.body.append(span);
        span.getBoundingClientRect();
      }
    },
    [[...samples], text] as [string[], string]
  );

/**
 * Every `@font-face` rule in `document.styleSheets`, with the count of sheets whose rules could
 * not be read. A cross-origin sheet throws on `cssRules`, and a read that silently skipped one
 * would report the contract's three over a sheet it never opened. Grouping rules (`@media`,
 * `@supports`, `@layer`) are walked, so a face declared inside one is seen.
 */
const fontFaceRules = (page: Page): Promise<{ rules: FontFaceRule[]; unreadable: number }> =>
  page.evaluate(() => {
    const rules: { family: string; src: string; weight: string; stretch: string; base: string }[] = [];
    let unreadable = 0;
    const walk = (list: CSSRuleList, base: string): void => {
      for (const rule of list) {
        if (rule instanceof CSSFontFaceRule) {
          const read = (name: string): string => rule.style.getPropertyValue(name).trim();
          rules.push({
            family: read('font-family').replace(/^["']|["']$/g, ''),
            src: read('src'),
            weight: read('font-weight'),
            stretch: read('font-stretch'),
            base,
          });
        } else if (rule instanceof CSSGroupingRule) {
          walk(rule.cssRules, base);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        unreadable += 1;
        continue;
      }
      walk(list, sheet.href ?? location.href);
    }
    return { rules, unreadable };
  });

/** Every family a `@font-face` in the document declares, through the same walk. */
const fontFaceFamilies = async (page: Page): Promise<{ families: string[]; unreadable: number }> => {
  const { rules, unreadable } = await fontFaceRules(page);
  return { families: rules.map((rule) => rule.family), unreadable };
};

/** Every resource the document fetched whose path sits under `/fonts/`, by pathname. */
const fontsPathRequests = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name, location.href).pathname)
      .filter((pathname) => pathname.startsWith('/fonts/'))
  );

/**
 * The box of every element matching each selector, keyed `selector[index]`, plus every planted
 * `[data-sample]` span keyed by its sample name. The count per selector is asserted by the caller.
 *
 * Lines are counted from a `Range` over the element's contents: one client rect per line
 * fragment, deduplicated on its top edge. A block that wraps to a different number of lines when
 * the face arrives keeps its line box and changes its height, and the two have to be told apart:
 * the overrides hold the first and cannot hold the second (`ops/font-contract.md` § What the swap
 * check does not cover).
 */
const geometryOf = (page: Page, selectors: readonly string[]): Promise<Record<string, Geometry>> =>
  page.evaluate((list: string[]) => {
    const measure = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      const lines = Math.max(1, tops.size);
      return { width: box.width, height: box.height, lines, lineBox: box.height / lines };
    };
    const found: Record<string, { width: number; height: number; lines: number; lineBox: number }> = {};
    for (const selector of list) {
      document.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
        found[`${selector}[${index}]`] = measure(element);
      });
    }
    for (const element of document.querySelectorAll<HTMLElement>('[data-sample]')) {
      found[element.dataset.sample as string] = measure(element);
    }
    return found;
  }, [...selectors]);

/**
 * `probe.html`'s trick on a real route: a family declared from the display face's own `src`, with
 * the same weight and width ranges and **none of the four metric overrides**, and one span set in
 * it over the display stack's own fallbacks, sized like the hero links. Returns the `src` it used,
 * so the caller can assert it is the display face's and not a planted literal.
 */
const plantStrippedFace = async (page: Page): Promise<string> => {
  const displayStack = await rootCustomPropertyValue(page, '--f-display');
  const displayFamily = firstFamily(displayStack);
  const fallbacks = displayStack.split(',').slice(1).join(',').trim();

  const source = (await fontFaceRules(page)).rules.find((rule) => rule.family === displayFamily);
  if (!source) throw new Error(`no @font-face in the document declares ${displayFamily}`);

  // The built chunk declares `src: url(media/<file>.woff2)` relative to itself under
  // `/_next/static/chunks/`, so a copy pasted into a `<style>` in the document would resolve
  // against the document and fetch nothing. Each `url()` is resolved against the sheet that
  // declared it, which is what the browser did for the real face.
  const src = source.src.replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/g,
    (_match, _quote, relative: string) => `url("${new URL(relative, source.base).href}")`
  );

  await plantStyle(
    page,
    `@font-face { font-family: "Planted Stripped"; src: ${src}; font-weight: ${source.weight}; ` +
      `font-stretch: ${source.stretch}; font-style: normal; font-display: swap; }\n` +
      `[data-sample="${PLANTED_STRIPPED}"] { font-family: "Planted Stripped", ${fallbacks}; font-stretch: 75%; ` +
      `font-size: 24px; line-height: normal; display: inline-block; white-space: nowrap; ` +
      `position: absolute; left: -99999px; top: 0; }`
  );
  await plantSpans(page, [PLANTED_STRIPPED], 'Luigi Espinosa');
  return src;
};

/** What one surface yielded across the swap. */
interface Swap {
  fallback: Record<string, Geometry>;
  face: Record<string, Geometry>;
  statuses: Map<string, number>;
  available: Record<string, boolean>;
  plantedSrc: string;
}

/**
 * Loads every surface twice: first all of them with every woff2 request aborted, which is what a
 * visitor sees while the face is in flight, then all of them with the requests allowed. The
 * planted override-stripped face goes in after each load so both passes carry it. Same protocol
 * as `tests/e2e/contract-fonts.pw.ts`, over the Hub's own routes.
 *
 * **All the aborted passes come first, on purpose.** A face fetched on one route's allowed pass
 * sits in the browser's memory cache, and a resource served from there never reaches
 * `page.route`, so the next route's "aborted" pass would render the face and measure the swap
 * against itself. Observed 2026-09-12: `.work-hero__heading` read 300.00 x 70.38 on one run and
 * 216.00 x 105.56, its face-pass box, on the next, with `/` measured first both times. Nothing is
 * cached until every fallback box has been read.
 */
const measureSwap = async (
  page: Page,
  surfaces: readonly { route: string; status: number; selectors: readonly DisplaySite[]; settle?: string }[]
): Promise<Map<string, Swap>> => {
  const results = new Map<string, Swap>();
  const settled = async (surface: { route: string; settle?: string }): Promise<void> => {
    if (!surface.settle) return;
    await page.locator(surface.settle).first().waitFor({ state: 'attached', timeout: 15_000 });
  };

  await page.route('**/*.woff2', (candidate) => candidate.abort());
  for (const surface of surfaces) {
    await goTo(page, surface.route, surface.status);
    await settled(surface);
    await plantStrippedFace(page);
    await fontsReady(page, [PLANTED_STRIPPED_SPEC]);
    results.set(surface.route, {
      fallback: await geometryOf(page, surface.selectors.map((site) => site.selector)),
      face: {},
      statuses: new Map(),
      available: {},
      plantedSrc: '',
    });
  }
  await page.unroute('**/*.woff2');

  let statuses = new Map<string, number>();
  const record = (response: { url: () => string; status: () => number }) => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) statuses.set(response.url(), response.status());
  };
  page.on('response', record);
  for (const surface of surfaces) {
    statuses = new Map();
    await goTo(page, `${surface.route}?faces=1`, surface.status);
    await settled(surface);
    const plantedSrc = await plantStrippedFace(page);
    await fontsReady(page, [PLANTED_STRIPPED_SPEC]);
    const available = await page.evaluate(
      (families) =>
        Object.fromEntries(
          [...families, 'Planted Stripped'].map((family) => [family, document.fonts.check(`700 16px "${family}"`)])
        ),
      CONTRACT_FAMILIES
    );
    const face = await geometryOf(page, surface.selectors.map((site) => site.selector));
    const result = results.get(surface.route);
    if (!result) throw new Error(`${surface.route} has no fallback measurement`);
    results.set(surface.route, { ...result, face, statuses, available, plantedSrc });
  }
  page.off('response', record);

  return results;
};

// The shape of `tests/e2e/contract-fonts.pw.ts:246-265`, over four axes rather than two and one
// word apart in the thrown message, so not a copy to hoist: `harness.ts` documents exactly three
// capabilities and `ops/rendered-output-harness.md:23` says so, which is the DW-22 shape.
const deltas = (
  fallback: Record<string, Geometry>,
  face: Record<string, Geometry>
): { sample: string; axis: Axis; before: number; after: number; share: number }[] => {
  const rows: { sample: string; axis: Axis; before: number; after: number; share: number }[] = [];
  for (const [sample, before] of Object.entries(fallback)) {
    const after = face[sample];
    if (!after) throw new Error(`the element "${sample}" is missing from the second measurement`);
    for (const axis of AXES) {
      rows.push({
        sample,
        axis,
        before: before[axis],
        after: after[axis],
        share: before[axis] === 0 ? Number.POSITIVE_INFINITY : Math.abs(after[axis] - before[axis]) / before[axis],
      });
    }
  }
  return rows;
};

const report = (rows: ReturnType<typeof deltas>): string =>
  rows
    .map(
      (row) =>
        `${row.sample} ${row.axis}: ${row.before.toFixed(2)} -> ${row.after.toFixed(2)} (${(row.share * 100).toFixed(2)}%)`
    )
    .join('\n');

/**
 * The same string planted at two settings of one axis, `first` and `second` being the declarations
 * each span takes, plus a twin of the second. Returns the three boxes and refuses if the display
 * face never loaded or a span does not lead with it, so the comparison is between two settings of
 * the face and not between two fallbacks.
 */
const measureAxis = async (
  page: Page,
  axis: string,
  first: string,
  second: string
): Promise<{ first: Geometry; second: Geometry; twin: Geometry; displayFamily: string }> => {
  const names = [`${axis}-first`, `${axis}-second`, `${axis}-twin`];
  await plantStyle(
    page,
    `[data-sample^="${axis}-"] { display: inline-block; white-space: nowrap; font-size: 32px; line-height: normal; ` +
      'position: absolute; left: -99999px; top: 0; }\n' +
      `[data-sample="${names[0]}"] { ${first} }\n` +
      `[data-sample="${names[1]}"] { ${second} }\n` +
      `[data-sample="${names[2]}"] { ${second} }`
  );
  await plantSpans(page, names, AXIS_SAMPLE);

  const displayFamily = firstFamily(await rootCustomPropertyValue(page, '--f-display'));
  await fontsReady(page, [`700 32px "${displayFamily}"`, `800 32px "${displayFamily}"`]);
  for (const name of names) {
    const family = await computedStyleValue(page, `[data-sample="${name}"]`, 'font-family');
    expect(firstFamily(family), `${name} does not lead with ${displayFamily}`).toBe(displayFamily);
  }
  expect(
    await page.evaluate((family) => document.fonts.check(`700 16px "${family}"`), displayFamily),
    `${displayFamily} is not available to the document, so every span below is the fallback`
  ).toBe(true);

  const boxes = await geometryOf(page, []);
  const [firstBox, secondBox, twinBox] = names.map((name) => boxes[name]);
  expect(firstBox && secondBox && twinBox, 'a planted span was not measured').toBeTruthy();
  console.log(
    `type-swap ${axis} widths: first ${firstBox.width.toFixed(2)}, second ${secondBox.width.toFixed(2)}, ` +
      `twin ${twinBox.width.toFixed(2)} (${AXIS_SAMPLE.length} characters at 32px)`
  );
  return { first: firstBox, second: secondBox, twin: twinBox, displayFamily };
};

test('parses a real contract, so every case below measures something', () => {
  expect(CONTRACT_FAMILIES.length, 'contracts/fonts.css declares no @font-face').toBe(3);
  expect(new Set(CONTRACT_FAMILIES).size, 'two published faces share a family name').toBe(3);
  expect(firstFamily('"Bricolage Grotesque", Archivo, system-ui, sans-serif')).toBe('Bricolage Grotesque');
  expect(firstFamily("'Planted Stripped'")).toBe('Planted Stripped');
  expect(SURFACES.length, 'the surface list is not the five hit-target-floor.pw.ts pins').toBe(5);
  expect(DISPLAY_ELEMENTS.flatMap((surface) => surface.selectors).length, 'no display element is tabled').toBe(7);
});

test('the two Confillia sites compute the display family at 75% width, and the alias reads the display stack', async ({
  page,
}) => {
  await goTo(page, '/');
  await fontsReady(page);

  // The alias itself, on `:root`, against the role it names, both read in the same page.
  const displayStack = await rootCustomPropertyValue(page, '--f-display');
  expect(
    await rootCustomPropertyValue(page, '--confillia-normal'),
    '--confillia-normal no longer resolves to what --f-display resolves to'
  ).toBe(displayStack);
  const displayFamily = firstFamily(displayStack);
  expect(displayFamily, '--f-display declares no first family').not.toBe('');

  // Every element at both call sites, counted per selector so a renamed class cannot pass over
  // nothing.
  const wrong: string[] = [];
  for (const site of CONFILLIA_SITES) {
    const elements = page.locator(site.selector);
    expect(await elements.count(), `${site.selector} does not match ${site.count} elements on /`).toBe(site.count);
    for (let index = 0; index < site.count; index += 1) {
      const family = await elements.nth(index).evaluate((node) => getComputedStyle(node).fontFamily);
      const stretch = await elements.nth(index).evaluate((node) => getComputedStyle(node).fontStretch);
      if (firstFamily(family) !== displayFamily) {
        wrong.push(`${site.selector}[${index}] computes font-family "${family}", expected ${displayFamily} first`);
      }
      if (stretch !== CONFILLIA_STRETCH) {
        wrong.push(`${site.selector}[${index}] computes font-stretch "${stretch}", expected ${CONFILLIA_STRETCH}`);
      }
    }
  }
  expect(
    wrong,
    `a Confillia call site does not render the display face at the narrow end of its width axis. The ` +
      `alias carries the family and font-stretch is set by hand beside it, and one of the two is off:\n${wrong.join('\n')}`
  ).toEqual([]);

  // The width read, live: the same element reports something else once a rule overrides it, so
  // `75%` twice above is a measurement and not a constant.
  await plantStyle(page, '.nav-link:first-child { font-stretch: 100% !important; }');
  expect(
    await computedStyleValue(page, 'a.nav-link', 'font-stretch'),
    'the width axis survived a rule that overrode it, so the read above is a constant'
  ).toBe('100%');
});

test('every surface declares exactly the contract faces and fetches nothing under /fonts/, and the old binary answers 404', async ({
  page,
  request,
}) => {
  // All five surfaces, because a `@font-face` re-declared in a chunk that only `/work` or `/cv`
  // links is invisible to a read taken on `/` alone.
  const wrong: string[] = [];
  for (const surface of SURFACES) {
    await goTo(page, surface.route, surface.status);
    await fontsReady(page);

    const { families, unreadable } = await fontFaceFamilies(page);
    if (unreadable > 0) wrong.push(`${surface.route}: ${unreadable} stylesheet(s) could not be read, so the family list is partial`);
    const declared = [...families].sort();
    const expected = [...CONTRACT_FAMILIES].sort();
    if (declared.join('\n') !== expected.join('\n')) {
      wrong.push(`${surface.route} declares @font-face for ${declared.join(', ')}, expected exactly ${expected.join(', ')}`);
    }

    const fetched = await fontsPathRequests(page);
    if (fetched.length > 0) wrong.push(`${surface.route} fetched under /fonts/: ${fetched.join(', ')}`);
  }
  expect(
    wrong,
    `a surface still carries a retired face, or fetches one. A retired family declared again is a binary ` +
      `the build serves for nothing:\n${wrong.join('\n')}`
  ).toEqual([]);

  const retired = await request.get(RETIRED_BINARY);
  expect(retired.status(), `${RETIRED_BINARY} is still served`).toBe(404);

  // The controls, once, on the surface the loop ended on, each through the same read: a planted
  // @font-face inside a grouping rule joins the family list, a fetch under /fonts/ joins the
  // resource entries, and a woff2 the server does serve answers 200 so the 404 above is about the
  // path and not about the file type.
  await plantStyle(page, '@supports (font-stretch: 75%) { @font-face { font-family: "Planted Family"; src: url("/fonts/planted.woff2"); } }');
  expect((await fontFaceFamilies(page)).families, 'a planted @font-face was not seen by the family read').toContain(
    'Planted Family'
  );

  // `fetch()` resolves at the headers and Resource Timing records the entry once the body is done,
  // so the body is drained and the read is polled rather than taken on the next line.
  await page.evaluate(() =>
    fetch('/fonts/planted.woff2').then(
      (response) => response.arrayBuffer().then(() => undefined),
      () => undefined
    )
  );
  await expect
    .poll(() => fontsPathRequests(page), { message: 'a fetch under /fonts/ was not seen by the resource read', timeout: 5_000 })
    .toContain('/fonts/planted.woff2');

  const published = await request.get('/contracts/fonts/bricolage-grotesque-latin.woff2');
  expect(published.status(), 'the served contract face does not answer 200, so the 404 above discriminates nothing').toBe(
    200
  );
});

test('the fallback-to-face swap holds every display element within 1% in height, and the stripped control does not', async ({
  page,
}) => {
  const breaches: string[] = [];
  let controls = 0;
  const swaps = await measureSwap(page, DISPLAY_ELEMENTS);

  for (const surface of DISPLAY_ELEMENTS) {
    const swap = swaps.get(surface.route);
    expect(swap, `${surface.route} was not measured`).toBeTruthy();
    if (!swap) continue;
    const { fallback, face, statuses, available, plantedSrc } = swap;

    // The premises. Every woff2 the allowed pass fetched answered 200, every contract family is
    // available to the document afterwards, and so is the planted one, or the "face" side of the
    // comparison is the fallback measured twice.
    expect(statuses.size, `${surface.route} fetched no woff2 on the allowed pass`).toBeGreaterThan(0);
    for (const [url, status] of statuses) expect(status, `${url} did not answer 200`).toBe(200);
    for (const family of CONTRACT_FAMILIES) {
      expect(available[family], `${family} never loaded on ${surface.route}, so the comparison measured nothing`).toBe(true);
    }
    expect(available['Planted Stripped'], 'the planted override-stripped face never loaded').toBe(true);
    expect(plantedSrc, 'the planted face does not point at a woff2').toMatch(/\.woff2/);

    // The selection, pinned per selector on the fallback pass and held equal on the face pass.
    for (const site of surface.selectors) {
      const keys = Object.keys(fallback).filter((key) => key.startsWith(`${site.selector}[`));
      expect(keys.length, `${site.selector} matched ${keys.length} elements on ${surface.route}, expected ${site.count}`).toBe(
        site.count
      );
    }
    expect(fallback[PLANTED_STRIPPED], 'the planted span was not measured on the fallback pass').toBeTruthy();
    expect(
      Object.keys(face).sort(),
      `${surface.route} measured a different element set on the two passes`
    ).toEqual(Object.keys(fallback).sort());

    const rows = deltas(fallback, face);
    console.log(`type-swap deltas on ${surface.route}:\n${report(rows)}`);

    // Height is what is asserted. The `lines` and `lineBox` rows printed above are what a failure
    // is read against: a block that wraps to one more line when the face arrives moves its
    // height by a whole line with its line box held, which is the advance width the overrides do
    // not hold (DW-82), while a line box that moved is the overrides themselves drifting.
    for (const row of rows) {
      if (row.axis !== 'height') continue;
      if (row.sample === PLANTED_STRIPPED) {
        controls += 1;
        if (row.share <= HEIGHT_TOLERANCE) {
          breaches.push(
            `${surface.route} ${row.sample} height moved only ${(row.share * 100).toFixed(2)}% across the swap, so ` +
              `the comparison cannot tell an override-stripped face from the published one`
          );
        }
        continue;
      }
      if (row.share > HEIGHT_TOLERANCE) {
        breaches.push(
          `${surface.route} ${row.sample} height moved ${(row.share * 100).toFixed(2)}% across the swap ` +
            `(${row.before.toFixed(2)} to ${row.after.toFixed(2)}), above the ${(HEIGHT_TOLERANCE * 100).toFixed(0)}% ` +
            `the four override descriptors in contracts/fonts.css are tuned to hold`
        );
      }
    }
  }

  expect(controls, 'the stripped control was not measured on every surface').toBe(DISPLAY_ELEMENTS.length);
  expect(breaches, `the swap moved a line box, or failed to move the control:\n${breaches.join('\n')}`).toEqual([]);
});

test('one string at the two display aliases measures two widths, which is the weight distinction', async ({ page }) => {
  await goTo(page, NOT_FOUND, 404);

  // Two spans, one string. The first asks nothing of the weight and inherits 400, which the
  // published `700 800` range clamps up to 700 at rasterisation; the second asks for the heaviest
  // weight the contract publishes, the way the `--monument-bold` call sites do. The twin is the
  // second again.
  const { first, second, twin } = await measureAxis(
    page,
    'weight',
    'font-family: var(--monument-regular);',
    'font-family: var(--monument-bold); font-weight: var(--w-black);'
  );

  // The requested weights, stated so the reader sees the computed value cannot carry the claim.
  expect(await computedStyleValue(page, '[data-sample="weight-first"]', 'font-weight')).toBe('400');
  expect(await computedStyleValue(page, '[data-sample="weight-second"]', 'font-weight')).toBe('800');

  expect(
    Math.abs(second.width - first.width),
    `the same string measures ${first.width.toFixed(2)} at var(--monument-regular) and ${second.width.toFixed(2)} ` +
      `at var(--monument-bold) with --w-black, so the two aliases render one weight and the distinction ` +
      `the mapping names is gone`
  ).toBeGreaterThan(WIDTH_FLOOR);

  // The control: two spans at the same weight measure the same width, so a difference above is a
  // weight and not two measurements of one thing disagreeing.
  expect(twin.width, 'two spans at the same weight measure different widths, so the read above is noise').toBe(
    second.width
  );
});

test('one string at 75% and at 100% width measures two widths, which is the width axis', async ({ page }) => {
  await goTo(page, NOT_FOUND, 404);

  // `getComputedStyle().fontStretch` answers `75%` for a face with no `wdth` axis just as it does
  // for one with, so the Confillia case above cannot tell the two apart. The advance width can:
  // the same string at the narrow end and at the default, both at the heaviest weight.
  const { first, second, twin } = await measureAxis(
    page,
    'width',
    'font-family: var(--f-display); font-weight: var(--w-black); font-stretch: 75%;',
    'font-family: var(--f-display); font-weight: var(--w-black); font-stretch: 100%;'
  );

  expect(await computedStyleValue(page, '[data-sample="width-first"]', 'font-stretch')).toBe('75%');
  expect(await computedStyleValue(page, '[data-sample="width-second"]', 'font-stretch')).toBe('100%');

  expect(
    Math.abs(second.width - first.width),
    `the same string measures ${first.width.toFixed(2)} at font-stretch 75% and ${second.width.toFixed(2)} at 100%, ` +
      `so the loaded face carries no width axis and the 75% the two Confillia sites ask for selects nothing`
  ).toBeGreaterThan(WIDTH_FLOOR);
  expect(twin.width, 'two spans at the same width measure different widths, so the read above is noise').toBe(
    second.width
  );

  // The viewport the whole file reads at, asserted rather than assumed from the config.
  expect(page.viewportSize()).toEqual({ ...RENDERED_VIEWPORT });
});
