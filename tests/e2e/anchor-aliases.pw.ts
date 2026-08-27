import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';

/**
 * The alias layer, measured in a real browser (Story 1-18, Anchor migration step 2).
 *
 * `app/app.scss` redefines twelve of the Hub's sixteen custom properties as `var()` references
 * to token roles, and the fifteen component stylesheets go on reading the old names. That is a
 * claim about what the Hub *resolves*, and almost none of it is visible to a screenshot:
 *
 *  1. **An alias that resolves to the wrong role** paints a plausible violet either way.
 *  2. **`--accent-dim` doing two jobs.** It is ornament at eleven of its fifteen call sites and
 *     a boundary a person reads state from at the other four, so a single global alias drops the
 *     boundary uses below the 3:1 floor AD-19 asserts while looking entirely reasonable. Each of
 *     the fifteen is read on its real element here, for the property that call site declares.
 *  3. **The alias trap.** `--monument-bold` baked its weight into the family name
 *     `MonumentExtended-Bold`. A family alias cannot carry that, so `font-weight` is set by hand
 *     beside `font-family` at the four call sites **in the same commit**, and only then read.
 *     Read against a tree where the weight was not set, the weight assertion is green and
 *     meaningless (`tests/e2e/harness.ts`, and `ops/rendered-output-harness.md` § "The finding
 *     Story 1-18 inherits").
 *  4. **The base `body` rule.** `/work` never shows it, because `body#work` overrides it. Nor
 *     does `/cv`, which `next.config.js` redirects to a PDF, which is a correction to what
 *     `ops/anchor-token-adoption.md` § "A second finding" concluded by reading stylesheets
 *     rather than by rendering. The 404 surface does, and that is where the body ground and body
 *     copy are read.
 *
 * **Nothing here is restated.** The alias map is parsed out of `app/app.scss`, the roles are read
 * back in the same page, and every expected colour is put through a probe element rather than
 * written down as a literal, because a computed colour and a custom property's token stream do
 * not serialise the same way.
 *
 * Every predicate this file introduces is shown firing on a planted control, and every parsed
 * list is asserted non-empty and carrying a known member, so a case cannot pass over nothing.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here
// even though TypeScript accepts it. Same as `tests/e2e/contract-anchor.pw.ts`.
const REPO_ROOT = resolve(__dirname, '..', '..');

const APP_SCSS = readFileSync(join(REPO_ROOT, 'app', 'app.scss'), 'utf8');
const TOKENS_CSS = readFileSync(join(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');
const FONTS_CSS = readFileSync(join(REPO_ROOT, 'contracts', 'fonts.css'), 'utf8');

/**
 * Every component stylesheet on disk, by basename, with its contents.
 *
 * **The call-site tables below were pinned against themselves**, comparing their own length to a
 * literal declared beside them and reading no stylesheet at all. A sixteenth `var(--accent-dim)`
 * call site, or a fifth `var(--monument-bold)` one, was invisible to every check in this story: it
 * would silently take the ornament role, or lose its weight, with the whole suite green. This is
 * what makes the count a measurement of the tree rather than of the table.
 */
const COMPONENT_STYLESHEETS = ((): Map<string, string> => {
  const found = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.scss')) {
        // **Keyed by basename, so a repeat would overwrite rather than add.** The table rows are
        // written `basename.scss:line` and are compared against these keys, so the key has to be
        // the basename. A second stylesheet with the same name in another directory would drop
        // one file's call sites out of the count with nothing failing, which is the hole this
        // whole map exists to close, so the collision is refused rather than resolved.
        if (found.has(entry.name)) {
          throw new Error(
            `two component stylesheets are named ${entry.name}. The call-site counts below are keyed ` +
              `by basename, so one of them would be counted and the other silently dropped`
          );
        }
        found.set(entry.name, readFileSync(path, 'utf8'));
      }
    }
  };
  walk(join(REPO_ROOT, 'components'));
  return found;
})();

/**
 * How many times `name` is read as `var(--name)`, per stylesheet basename, over the whole file.
 *
 * Raw text, comments included, which is the same method the recorded count used
 * (`git grep -o -- "var(--accent-dim)" -- components`) and the same rule Story 1-17 set for the
 * consumer scan: a call site inside a comment is a call site waiting to be uncommented.
 *
 * **The fallback form counts too.** `var(--accent-dim, #fff)` reads the property exactly as the
 * bare form does, so a call site authored that way is a call site. Matching only the bare form
 * would let one escape the table and take the `:root` ornament role in silence, which is the
 * failure this counter exists to make loud. The name is still bounded, so `--accent-dimmer` does
 * not match.
 */
const callSitesOf = (name: string, sources: Map<string, string> = COMPONENT_STYLESHEETS): Map<string, number> => {
  const pattern = new RegExp(`var\\(\\s*${name}\\s*[,)]`, 'g');
  const counted = new Map<string, number>();
  for (const [file, source] of sources) {
    const hits = source.match(pattern)?.length ?? 0;
    if (hits > 0) counted.set(file, hits);
  }
  return counted;
};

/** The same counts, taken off a table whose rows are written `basename.scss:line`. */
const tabled = (rows: readonly { at: string }[]): Map<string, number> => {
  const counted = new Map<string, number>();
  for (const row of rows) {
    const file = row.at.split(':')[0];
    counted.set(file, (counted.get(file) ?? 0) + 1);
  }
  return counted;
};

const sortedEntries = (counted: Map<string, number>): [string, number][] =>
  [...counted].sort(([a], [b]) => a.localeCompare(b));

/** Every route the Hub serves. NFR-2 binds every migration step, so all seven are swept. */
const ROUTES = ['/', '/cv', '/work', '/projects', '/recommendation', '/celeste', '/api/health'] as const;

/**
 * A path the Hub does not route, which renders `app/not-found.tsx` through the same root layout
 * and the same `Body`. Two of the fifteen `--accent-dim` call sites and one `--monument-bold`
 * call site live only here.
 */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** Wide enough for the `min-width: 768px` half of `HomeLayout.scss`, which the 360 project is not. */
const WIDE_VIEWPORT = { width: 1024, height: 800 } as const;

/** The Hub declares sixteen custom properties: twelve aliased onto roles, four left as literals. */
const HUB_PROPERTY_COUNT = 16;
const ALIASED_COUNT = 12;
const LITERAL_COUNT = 4;

/** The four this story must not move, and the open question or reason that holds each. */
const LITERAL_PROPERTIES = ['--accent-glow', '--hero-height', '--confillia-normal', '--confillia-bold'] as const;

/** Exactly one of the four is a colour, so exactly one takes the colour route below. */
const LITERAL_COLOUR_COUNT = 1;

/** The two roles `--accent-dim` resolves to, one per call site. */
const ORNAMENT = '--token-accent-muted';
const BOUNDARY = '--token-border-interactive';

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

/** The Hub's sixteen, as `app/app.scss` authors them. */
const HUB = declarationsIn(/:root\s*\{([^}]*)\}/.exec(withoutComments(APP_SCSS))?.[1] ?? '');

/** Every custom property `contracts/tokens.css` puts on `:root` outside a media query. */
const CONTRACT = declarationsIn(
  /:root\s*\{([^}]*)\}/.exec(
    withoutComments(TOKENS_CSS).replace(
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{[^}]*\}\s*\}/,
      ''
    )
  )?.[1] ?? ''
);

const IS_VAR_REFERENCE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/;

/** The token role a Hub property is aliased onto, or `null` while it is authored as a literal. */
const aliasRole = (name: string): string | null => IS_VAR_REFERENCE.exec(HUB.get(name) ?? '')?.[1] ?? null;

/** The twelve aliased properties, derived from the file rather than restated. */
const ALIASES = [...HUB.keys()].filter((name) => aliasRole(name) !== null);

const normaliseQuotes = (value: string): string => value.replace(/'/g, '"');

/** The first family in a stack, unquoted. `"Bricolage Grotesque", Archivo, …` reads as one name. */
const firstFamily = (stack: string): string =>
  (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');

/**
 * The computed colour of a throwaway element painted `background-color: var(<name>)`.
 *
 * A computed `border-left-color` and a custom property's token stream do not serialise the same
 * way, so an expected role is put through a real element in the same page rather than compared
 * as text or written down as a literal.
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
 * The computed value of `property` on a **pseudo-element** of the first match for `selector`.
 *
 * `computedStyleValue` in the harness reads the element itself, and two of the fifteen
 * `--accent-dim` call sites are on `::before` (`WorkItem.scss:12` and `:126`). Rather than widen
 * the harness, this reads the pseudo-element here, with the same two rules the harness holds to:
 * it names what it was asked for in any failure, and it never returns a value that could compare
 * equal to an expectation when the thing asked for is absent.
 */
const computedPseudoValue = async (
  page: Page,
  selector: string,
  pseudo: string,
  property: string
): Promise<string> => {
  const element = page.locator(selector).first();

  try {
    await element.waitFor({ state: 'attached', timeout: 5_000 });
  } catch {
    throw new Error(
      `Alias reads: no element matches selector "${selector}" on ${page.url()}, so the computed ` +
        `value of "${property}" on "${pseudo}" could not be read.`
    );
  }

  const value = await element.evaluate(
    (node, [name, part]) => window.getComputedStyle(node, part).getPropertyValue(name),
    [property, pseudo]
  );

  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(
      `Alias reads: property "${property}" resolved to an empty string on "${selector}${pseudo}". ` +
        `An empty string is what an unknown property name yields, so it is reported rather than returned.`
    );
  }
  return trimmed;
};

/**
 * A colour rasterised to four 8-bit sRGB channels through a 1 x 1 canvas.
 *
 * The build rewrites `rgba(139, 92, 246, 0.4)` to `#8b5cf666` on the way to the browser, so a
 * text comparison against the authored literal would report a drift the pipeline did not cause.
 * The canvas is the browser's own parser, and `globalCompositeOperation = 'copy'` keeps the alpha
 * rather than compositing it away. A `fillStyle` the context cannot parse is specified to be
 * *ignored*, leaving the previous colour in place, so a sentinel write proves the assignment took
 * and an unparsed value is reported rather than swallowed.
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

  // **Thrown rather than returned.** A missing 2D context answered `no-2d-context` for every
  // input, so the drift comparison in "the four properties this story must not move" would have
  // compared two identical sentinels, found no drift, and reached its verdict over a measurement
  // that never happened. The controls at the end of that case fire only after the verdict.
  if (read.some((answer) => answer === 'no-2d-context')) {
    throw new Error(
      `Alias reads: the page gave no 2D canvas context, so none of ${values.join(', ')} was ` +
        `rasterised. A colour comparison cannot be made and is reported rather than assumed equal.`
    );
  }
  return read;
};

const PURE_BLACK = '0,0,0,255';
const PURE_WHITE = '255,255,255,255';

/**
 * One `--accent-dim` call site.
 *
 * `verdict` is the rule applied, stated so it can be falsified: a declaration is a **boundary** a
 * person reads state from when some selector repaints that same property under `:hover`,
 * `:focus-visible` or a data-state attribute, or when it is the only visual indicator of a
 * component's state. Everything else is **ornament**. The reasoning per row is in
 * `ops/anchor-token-adoption.md`.
 */
interface CallSite {
  at: string;
  route: string;
  selector: string;
  pseudo?: string;
  property: string;
  verdict: 'ornament' | 'boundary';
  /** Read in a second context at 1024 wide, because the rule only applies above 767px. */
  wide?: true;
}

/**
 * All fifteen, counted 2026-08-26 by `git grep -o -- "var(--accent-dim)" -- components`.
 *
 * Four are boundaries and eleven are ornament, which is what makes a single global alias unable
 * to pass this case.
 */
const CALL_SITES: readonly CallSite[] = [
  // A static rule beside a non-interactive label. Nothing repaints it.
  { at: 'hud-label.scss:8', route: '/work', selector: '.hud-label--left', property: 'border-left-color', verdict: 'ornament' },
  { at: 'hud-label.scss:14', route: '/', selector: '.hud-label--right', property: 'border-right-color', verdict: 'ornament' },

  // A separator between rows. The control inside carries its own hover background and focus outline.
  { at: 'WorkItem.scss:2', route: '/work', selector: '.work-item', property: 'border-bottom-color', verdict: 'ornament' },
  // `WorkItem.scss:16-18` repaints this to `var(--accent)` at `[data-open='true']`, and it is the
  // only indicator of open or closed. Read on a **closed** item, because the first entry in the
  // timeline opens on mount and its bar is already `--accent`.
  {
    at: 'WorkItem.scss:12',
    route: '/work',
    selector: ".work-item[data-open='false']",
    pseudo: '::before',
    property: 'background-color',
    verdict: 'boundary',
  },
  // A decorative `//` list marker, duplicated by nothing.
  {
    at: 'WorkItem.scss:126',
    route: '/work',
    selector: '.work-item__highlights li',
    pseudo: '::before',
    property: 'color',
    verdict: 'ornament',
  },
  // A fill.
  { at: 'WorkItem.scss:144', route: '/work', selector: '.work-item__tech li', property: 'background-color', verdict: 'ornament' },

  // `ProjectCard.scss:34-37` repaints `border-left-color` on hover. Both edges of one box read as
  // one boundary, so they take one value.
  { at: 'ProjectCard.scss:28', route: '/projects', selector: '.project-card', property: 'border-top-color', verdict: 'boundary' },
  { at: 'ProjectCard.scss:29', route: '/projects', selector: '.project-card', property: 'border-left-color', verdict: 'boundary' },
  // A fill, counter-scoped back off the card because a chip inherits from the card it sits in.
  {
    at: 'ProjectCard.scss:66',
    route: '/projects',
    selector: '.project-card__tech li',
    property: 'background-color',
    verdict: 'ornament',
  },

  // `error-page.scss:66-69` repaints `border-left-color` on hover.
  { at: 'error-page.scss:59', route: NOT_FOUND, selector: '.error-page__back', property: 'border-left-color', verdict: 'boundary' },

  // The link's hover repaints its `color`, never this rule.
  { at: 'HomeLayout.scss:121', route: '/', selector: '.nav-link', property: 'border-left-color', verdict: 'ornament' },
  {
    at: 'HomeLayout.scss:154',
    route: '/',
    selector: '.home-panel--contact .contact-container a',
    property: 'border-right-color',
    verdict: 'ornament',
    // Below 768 the same element takes `border-right: none` at `HomeLayout.scss:233`, which
    // resets the colour to `currentcolor`. This row is the desktop rule and is read where it wins.
    wide: true,
  },
  {
    at: 'HomeLayout.scss:234',
    route: '/',
    selector: '.home-panel--contact .contact-container a',
    property: 'border-left-color',
    verdict: 'ornament',
  },

  // A static section divider.
  { at: 'ProjectsHero.scss:8', route: '/projects', selector: '.projects-hero', property: 'border-bottom-color', verdict: 'ornament' },
  { at: 'WorkHero.scss:8', route: '/work', selector: '.work-hero', property: 'border-bottom-color', verdict: 'ornament' },
];

const CALL_SITE_COUNT = 15;
const BOUNDARY_COUNT = 4;

/** The four `--monument-bold` call sites, each on the route that renders it. */
const WEIGHT_SITES = [
  { at: 'glitch-text.scss:5', route: '/', selector: '.glitch-text__inner' },
  { at: 'error-page.scss:24', route: NOT_FOUND, selector: '.error-page__code' },
  { at: 'ProjectsHero.scss:19', route: '/projects', selector: '.projects-hero__heading' },
  { at: 'WorkHero.scss:19', route: '/work', selector: '.work-hero__heading' },
] as const;

const WEIGHT_SITE_COUNT = 4;

/** The weight `--monument-bold` maps onto, per `DESIGN.md` § The mapping. */
const WEIGHT_ROLE = '--w-black';

/**
 * The three `--monument-regular` call sites, and the `font-weight` each one asks for.
 *
 * `DESIGN.md` § The mapping assigns them `--f-display` plus `--w-bold`, and `app/app.scss` gets
 * there without a hand edit by relying on the variable face **clamping** a request below its
 * published range up to the range's lower bound. That is an argument, and the premise it rests on
 * is a value in `contracts/fonts.css` that a MINOR bump is free to change. Republished as
 * `400 800`, `.error-page__title` renders at 400 and `.project-card h2` at 500, two of these three
 * stop being bold, and nothing else in this story reacts: the alias comparison reads `:root`
 * token streams, `WEIGHT_SITES` never visits these selectors, and the screenshot covers neither
 * `/projects` nor the 404. So the clamp is asserted as a precondition below rather than argued.
 *
 * **No `font-weight` line is added at these three.** The acceptance criteria name four call sites
 * and these are not among them.
 */
const DISPLAY_REGULAR_SITES = [
  { at: 'WorkItem.scss:52', route: '/work', selector: '.work-item__company', requests: 500 },
  { at: 'ProjectCard.scss:40', route: '/projects', selector: '.project-card h2', requests: 500 },
  // No `font-weight` of its own, so it asks for the initial 400.
  { at: 'error-page.scss:40', route: NOT_FOUND, selector: '.error-page__title', requests: 400 },
] as const;

/**
 * The `font-weight` range `contracts/fonts.css` publishes for `family`, as `[lower, upper]`.
 *
 * A single value is read as a range of itself, which is how `Geist Mono`'s `font-weight: 400` is
 * declared.
 */
const publishedWeightRange = (family: string): [number, number] | null => {
  const faces = FONTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g);
  for (const face of faces) {
    const block = face[1];
    const declared = /font-family\s*:\s*([^;]+)/.exec(block)?.[1].trim().replace(/^["']|["']$/g, '');
    if (declared !== family) continue;
    const weight = /font-weight\s*:\s*([^;]+)/.exec(block)?.[1].trim();
    if (!weight) return null;
    const parts = weight.split(/\s+/).map(Number);
    if (parts.some(Number.isNaN)) return null;
    return [parts[0], parts[parts.length - 1]];
  }
  return null;
};

/** Navigate, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * Run `read` against `/` in a second context 1024 wide.
 *
 * The project pins 360 (AD-19's floor), and one of the fifteen call sites is a rule that only
 * applies above 767px. Opening a context is deliberate and says so, on the pattern
 * `tests/e2e/contract-anchor.pw.ts` set for its wide-viewport and no-preference reads.
 */
const inWideContext = async <T>(browser: Browser, read: (page: Page) => Promise<T>): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...WIDE_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    expect(page.viewportSize()?.width ?? 0, 'the second context is not wider than the mobile rule').toBeGreaterThan(767);
    return await read(page);
  } finally {
    await context.close();
  }
};

test('parses a real alias layer, so every case below measures something', () => {
  expect(HUB.size, 'app/app.scss no longer declares sixteen custom properties on :root').toBe(HUB_PROPERTY_COUNT);
  expect(CONTRACT.size, 'no :root block was parsed out of contracts/tokens.css').toBeGreaterThan(0);
  for (const known of ['--token-bg', '--token-text', ORNAMENT, BOUNDARY, WEIGHT_ROLE, '--f-display', '--page-pad']) {
    expect([...CONTRACT.keys()], `contracts/tokens.css no longer declares ${known}`).toContain(known);
  }

  // The partition is pinned in both halves. Twelve aliased and four literal, and the four named,
  // so an alias quietly written over one of them fails here rather than passing as twelve of
  // sixteen.
  expect(ALIASES.length, 'app/app.scss no longer aliases exactly twelve properties onto token roles').toBe(
    ALIASED_COUNT
  );
  expect(
    [...HUB.keys()].filter((name) => aliasRole(name) === null).sort(),
    'the four properties Story 1-18 must not move are not the four still authored as literals'
  ).toEqual([...LITERAL_PROPERTIES].sort());
  for (const name of ALIASES) {
    expect(
      [...CONTRACT.keys()],
      `${name} is aliased onto ${aliasRole(name)}, which contracts/tokens.css does not declare`
    ).toContain(aliasRole(name));
  }

  // The two roles `--accent-dim` splits across must differ, or the per-call-site case below
  // could be satisfied by one value and would prove nothing.
  expect(CONTRACT.get(ORNAMENT), `${ORNAMENT} and ${BOUNDARY} are declared the same`).not.toBe(CONTRACT.get(BOUNDARY));

  // The call-site table, pinned on both counts. Eleven ornament and four boundary is what makes a
  // single global alias unable to pass, and a table that lost a row would simply loop less.
  expect(CALL_SITES.length, 'the --accent-dim table no longer carries fifteen call sites').toBe(CALL_SITE_COUNT);
  expect(CALL_SITES.filter((site) => site.verdict === 'boundary').length, 'the four boundary sites moved').toBe(
    BOUNDARY_COUNT
  );
  expect(new Set(CALL_SITES.map((site) => site.at)).size, 'two rows name the same call site').toBe(CALL_SITE_COUNT);
  expect(WEIGHT_SITES.length, 'the --monument-bold table no longer carries four call sites').toBe(WEIGHT_SITE_COUNT);

  // **Both tables against the stylesheets on disk**, which is what makes the counts above a
  // measurement rather than a restatement. Compared per file so a failure names where the new call
  // site is, not just that the total moved.
  //
  // Non-empty and carrying the files the tables name, rather than pinned at a literal count of
  // stylesheets under `components/`: that literal read as though it were the fifteen consumers of
  // the Hub's properties, which is a different fifteen, and it would have to move for any
  // unrelated component added. A basename collision, which is what would actually drop call sites
  // out of these counts, is refused where the map is built.
  expect(COMPONENT_STYLESHEETS.size, 'no component stylesheet was read, so the counts below are vacuous').toBeGreaterThan(
    0
  );
  for (const named of new Set([...CALL_SITES, ...WEIGHT_SITES, ...DISPLAY_REGULAR_SITES].map((site) => site.at.split(':')[0]))) {
    expect([...COMPONENT_STYLESHEETS.keys()], `${named} is tabled below but was not read off disk`).toContain(named);
  }

  // The counter, on planted controls, before any agreement is read as good news. Two occurrences
  // in one fixture, a bounded name that does not match a longer one, a whitespace form, and the
  // fallback form, which reads the property exactly as the bare form does.
  const control = new Map([
    ['a.scss', '.x { border-left: 1px solid var(--accent-dim); background: var( --accent-dim ); }'],
    ['b.scss', '.y { color: var(--accent); border: 1px solid var(--accent-dimmer); }'],
    ['c.scss', '.z { background: var(--accent-dim, #fff); }'],
  ]);
  expect([...callSitesOf('--accent-dim', control)], 'the call-site counter no longer fires').toEqual([
    ['a.scss', 2],
    ['c.scss', 1],
  ]);
  expect([...callSitesOf('--monument-bold', control)], 'the counter matches a name it should not').toEqual([]);
  expect([...tabled([{ at: 'a.scss:1' }, { at: 'a.scss:9' }, { at: 'b.scss:3' }])]).toEqual([
    ['a.scss', 2],
    ['b.scss', 1],
  ]);

  expect(
    sortedEntries(callSitesOf('--accent-dim')),
    `the --accent-dim call sites on disk are not the fifteen this file tables. A call site missing ` +
      `from the table silently takes the :root ornament role, and if it is a boundary it falls below ` +
      `the 3:1 floor AD-19 asserts with every case here green`
  ).toEqual(sortedEntries(tabled(CALL_SITES)));

  expect(
    sortedEntries(callSitesOf('--monument-bold')),
    `the --monument-bold call sites on disk are not the four this file tables. A fifth one loses the ` +
      `weight that lived in the family name and renders at 400, which is the exact trap this story exists to close`
  ).toEqual(sortedEntries(tabled(WEIGHT_SITES)));

  expect(
    sortedEntries(callSitesOf('--monument-regular')),
    'the --monument-regular call sites on disk are not the three whose clamp this file checks'
  ).toEqual(sortedEntries(tabled(DISPLAY_REGULAR_SITES)));

  // The parsers, on planted controls, before any empty or agreeing result is read as good news.
  expect(aliasRole('--white-color'), '--white-color is no longer aliased onto a role').toBe('--token-text');
  expect(IS_VAR_REFERENCE.test('var(--token-bg)')).toBe(true);
  expect(IS_VAR_REFERENCE.test('rgba(139, 92, 246, 0.4)')).toBe(false);
  expect(IS_VAR_REFERENCE.test('var(--token-bg) 1px')).toBe(false);
  expect(firstFamily('"Bricolage Grotesque", Archivo, system-ui, sans-serif')).toBe('Bricolage Grotesque');
  expect(firstFamily("'Confillia Normal'")).toBe('Confillia Normal');
  expect(normaliseQuotes("'Confillia'")).toBe('"Confillia"');
  expect([...declarationsIn('  --a: 1px; --b: var(--c);').entries()]).toEqual([
    ['--a', '1px'],
    ['--b', 'var(--c)'],
  ]);
  expect([...declarationsIn('.btn--primary:hover { color: red; }').keys()]).toEqual([]);
});

test('every aliased Hub property resolves to exactly the token role it names', async ({ page }) => {
  await goTo(page, '/');

  // Both sides are custom property token streams read on `:root` in the same page, so this
  // comparison is exact rather than canonicalised. A role read in a different page, or a value
  // restated here as a literal, would compare against a build rewrite rather than against the
  // contract.
  const drift: string[] = [];
  let compared = 0;
  for (const name of ALIASES) {
    const role = aliasRole(name) ?? '';
    const aliased = await rootCustomPropertyValue(page, name);
    const direct = await rootCustomPropertyValue(page, role);
    compared += 1;
    if (aliased !== direct) drift.push(`${name} aliases ${role}: read "${aliased}", ${role} reads "${direct}"`);
  }

  expect(compared, 'no alias was compared').toBe(ALIASED_COUNT);
  expect(drift, `an alias no longer resolves to the role it names:\n${drift.join('\n')}`).toEqual([]);

  // The comparison, on a planted control through the same two reads. An equality that held for
  // every pair would look identical to one that could not tell two roles apart.
  expect(
    await rootCustomPropertyValue(page, '--white-color'),
    '--white-color and --token-bg resolve to the same value, so the comparison above discriminates nothing'
  ).not.toBe(await rootCustomPropertyValue(page, '--token-bg'));
});

test('the four properties this story must not move still hold their authored literals', async ({ page }) => {
  await goTo(page, '/');

  expect(LITERAL_PROPERTIES.length, 'the list of untouched properties is empty').toBe(LITERAL_COUNT);

  // Two comparison routes, because one of the four is a colour and the build rewrites colours on
  // the way to the browser. `--accent-glow` is authored `rgba(139, 92, 246, 0.4)` and arrives as
  // `#8b5cf666`, which is the same colour and a different string.
  const isColour = await page.evaluate(
    (values: string[]) => values.map((value) => CSS.supports('color', value)),
    LITERAL_PROPERTIES.map((name) => HUB.get(name) ?? '')
  );
  expect(isColour.filter(Boolean).length, 'the colour route is no longer exercised by exactly one of the four').toBe(
    LITERAL_COLOUR_COUNT
  );
  expect(isColour.filter((taken) => !taken).length, 'the text route is no longer exercised').toBe(
    LITERAL_COUNT - LITERAL_COLOUR_COUNT
  );

  const drift: string[] = [];
  for (const [index, name] of LITERAL_PROPERTIES.entries()) {
    const authored = HUB.get(name) ?? '';
    expect(authored, `app/app.scss no longer declares ${name}`).not.toBe('');
    expect(
      IS_VAR_REFERENCE.test(authored),
      `app/app.scss authors ${name} as "${authored}", a var() reference. O-11 holds --accent-glow, ` +
        `O-6 and UX-DR12 hold the two Confillia names, and the contract carries no viewport height ` +
        `for --hero-height.`
    ).toBe(false);

    const read = await rootCustomPropertyValue(page, name);
    if (isColour[index]) {
      const [expected, actual] = await rasterise(page, [authored, read]);
      expect(expected, `the canvas could not parse the authored value of ${name}`).not.toMatch(/^unparsed-by-canvas:/);
      if (expected !== actual) drift.push(`${name}: app/app.scss authors "${authored}" (${expected}), read "${read}" (${actual})`);
    } else if (normaliseQuotes(authored) !== read) {
      drift.push(`${name}: app/app.scss authors "${authored}", expected "${normaliseQuotes(authored)}", read "${read}"`);
    }
  }
  expect(drift, `a property this story must not move has drifted:\n${drift.join('\n')}`).toEqual([]);

  // The colour route, on planted controls through the same helper: two spellings of one colour
  // compare equal, a different alpha compares unequal, and a different hue compares unequal.
  //
  // **The resolution is coarser than 1/255 once alpha is involved**, and that is recorded rather
  // than papered over. The canvas stores premultiplied and `getImageData` unpremultiplies, so at
  // alpha 0.4 a channel round-trips through a step of about 1/0.4, and `#8b5cf666` and
  // `#8c5cf666` both read back as `140,92,245,102`. A rewrite that shifted a channel by one
  // 8-bit step under alpha would pass here. That is a real ceiling on this route, and it is the
  // same shape of ceiling `ops/anchor-token-adoption.md` records for the opaque colour route.
  const [equivalentA, equivalentB, otherAlpha, otherHue] = await rasterise(page, [
    'rgba(139, 92, 246, 0.4)',
    '#8b5cf666',
    '#8b5cf6ff',
    '#5b21b666',
  ]);
  expect(equivalentA, 'the colour route no longer treats two spellings of one colour as equal').toBe(equivalentB);
  expect(equivalentA, 'the colour route no longer separates two alphas').not.toBe(otherAlpha);
  expect(equivalentA, 'the colour route no longer separates two hues').not.toBe(otherHue);
  const [refused] = await rasterise(page, ['not-a-colour-at-all']);
  expect(refused, 'the canvas guard no longer reports a value it could not parse').toBe(
    'unparsed-by-canvas:not-a-colour-at-all'
  );
});

test('--accent-dim resolves to the role its call site earns, at all fifteen', async ({ page, browser }) => {
  const readSite = async (target: Page, site: CallSite, roles: Record<string, string>): Promise<string | null> => {
    const expected = roles[site.verdict === 'boundary' ? BOUNDARY : ORNAMENT];
    const actual = site.pseudo
      ? await computedPseudoValue(target, site.selector, site.pseudo, site.property)
      : await computedStyleValue(target, site.selector, site.property);
    if (actual === expected) return null;
    return (
      `${site.at} (${site.selector}${site.pseudo ?? ''}, ${site.property}) is ${site.verdict}, so it should ` +
      `read ${site.verdict === 'boundary' ? BOUNDARY : ORNAMENT} "${expected}" and read "${actual}"`
    );
  };

  const wrong: string[] = [];
  let read = 0;

  for (const route of [...new Set(CALL_SITES.filter((site) => !site.wide).map((site) => site.route))]) {
    await goTo(page, route, route === NOT_FOUND ? 404 : 200);
    const roles = await probeRoleColours(page, [ORNAMENT, BOUNDARY]);
    expect(roles[ORNAMENT], `${ORNAMENT} and ${BOUNDARY} resolve to the same colour on ${route}`).not.toBe(
      roles[BOUNDARY]
    );

    for (const site of CALL_SITES.filter((candidate) => candidate.route === route && !candidate.wide)) {
      const failure = await readSite(page, site, roles);
      read += 1;
      if (failure) wrong.push(failure);
    }
  }

  // The one row whose rule only applies above 767px, read where it wins.
  for (const site of CALL_SITES.filter((candidate) => candidate.wide)) {
    const failure = await inWideContext(browser, async (wide) => {
      await goTo(wide, site.route);
      const roles = await probeRoleColours(wide, [ORNAMENT, BOUNDARY]);
      return readSite(wide, site, roles);
    });
    read += 1;
    if (failure) wrong.push(failure);
  }

  // A selector that matched nothing throws out of `computedStyleValue` rather than being skipped,
  // so this count can only reach fifteen by reading fifteen real elements.
  expect(read, 'fewer than fifteen call sites were read').toBe(CALL_SITE_COUNT);
  expect(
    wrong,
    `a --accent-dim call site resolves to the wrong role. Ornament and boundary are two different ` +
      `jobs, and a single global alias drops the boundary uses below the 3:1 floor AD-19 asserts:\n` +
      wrong.join('\n')
  ).toEqual([]);
});

test('the pseudo-element read is a real read, not the element beside it', async ({ page }) => {
  // The planted control for `computedPseudoValue`, which two of the fifteen rows depend on. If
  // the pseudo argument were dropped, both rows would silently read the originating element
  // instead, and `.work-item` inherits the same `--accent-dim` its `::before` overrides, so the
  // ornament row would still pass and only the boundary row would fail, for an obscure reason.
  await goTo(page, '/work');

  const onElement = await computedStyleValue(page, ".work-item[data-open='false']", 'background-color');
  const onPseudo = await computedPseudoValue(page, ".work-item[data-open='false']", '::before', 'background-color');

  expect(onElement, '.work-item now paints its own background, so this control measures nothing').toBe(
    'rgba(0, 0, 0, 0)'
  );
  expect(onPseudo, 'the pseudo-element read answered the element it is attached to').not.toBe(onElement);

  // And it refuses rather than returning something comparable when asked for nothing real.
  await expect(computedPseudoValue(page, '.no-such-element-anywhere', '::before', 'color')).rejects.toThrow(
    /\.no-such-element-anywhere/
  );
  await expect(
    computedPseudoValue(page, ".work-item[data-open='false']", '::before', '--not-declared-anywhere')
  ).rejects.toThrow(/--not-declared-anywhere/);
});

test('the four --monument-bold call sites compute as the display family at its heaviest weight', async ({ page }) => {
  // **The order matters and it is the reason this case exists.** Three of the four set the family
  // alone before this story, so their computed `font-weight` was `400` and would still have been
  // `400` after an alias silently dropped the bold that lived in the family name. Story 1-18 set
  // the weight by hand at all four **first**, in the same commit, and this reads it afterwards.
  // Both are asserted: `font-family` catches an alias that retargets the family, `font-weight`
  // catches a weight set at only three of the four, and neither covers the other.
  const displayFamily = firstFamily(CONTRACT.get('--f-display') ?? '');
  expect(displayFamily, 'contracts/tokens.css declares no first family for --f-display').not.toBe('');

  const wrong: string[] = [];
  let read = 0;

  for (const route of [...new Set(WEIGHT_SITES.map((site) => site.route))]) {
    await goTo(page, route, route === NOT_FOUND ? 404 : 200);

    // The weight is sourced from the role rather than restated, and the role is asserted to be
    // the heaviest the contract publishes before it is used as an expectation.
    const expectedWeight = await rootCustomPropertyValue(page, WEIGHT_ROLE);
    expect(expectedWeight, `${WEIGHT_ROLE} no longer resolves to 800`).toBe('800');

    for (const site of WEIGHT_SITES.filter((candidate) => candidate.route === route)) {
      const family = await computedStyleValue(page, site.selector, 'font-family');
      const weight = await computedStyleValue(page, site.selector, 'font-weight');
      read += 1;

      if (firstFamily(family) !== displayFamily) {
        wrong.push(`${site.at} (${site.selector}) computes font-family "${family}", expected ${displayFamily} first`);
      }
      if (weight !== expectedWeight) {
        wrong.push(`${site.at} (${site.selector}) computes font-weight "${weight}", expected "${expectedWeight}"`);
      }
      if (/MonumentExtended/.test(family)) {
        wrong.push(`${site.at} (${site.selector}) still resolves the retired family "${family}"`);
      }
    }
  }

  expect(read, 'fewer than four --monument-bold call sites were read').toBe(WEIGHT_SITE_COUNT);
  expect(
    wrong,
    `the alias trap is open at a --monument-bold call site. A family alias carries the family and ` +
      `drops the weight that lived in the name MonumentExtended-Bold, which is invisible to a ` +
      `screenshot and to a reading of the CSS:\n${wrong.join('\n')}`
  ).toEqual([]);

  // The read, on a planted control: a call site that was never meant to be black reads lighter,
  // so a run where every weight answered 800 could not pass unnoticed.
  await goTo(page, '/work');
  expect(
    await computedStyleValue(page, '.work-item__company', 'font-weight'),
    'every element on the page computes font-weight 800, so the reads above discriminate nothing'
  ).not.toBe('800');
});

test('the display face still clamps --monument-regular up, which is a precondition rather than an argument', async ({
  page,
}) => {
  // `--monument-regular` gets no hand-set weight, and the reason `app/app.scss` gives is that its
  // three call sites request a weight below the range the display face publishes and the variable
  // face clamps them up to its lower bound. **That premise lives in `contracts/fonts.css` and a
  // MINOR bump is free to change it.** Republished as `400 800`, two of these three quietly stop
  // being bold and nothing else in this story notices. So the premise is checked here.
  const displayFamily = firstFamily(CONTRACT.get('--f-display') ?? '');
  expect(displayFamily, 'contracts/tokens.css declares no first family for --f-display').not.toBe('');

  const range = publishedWeightRange(displayFamily);
  expect(range, `contracts/fonts.css publishes no font-weight range for ${displayFamily}`).not.toBeNull();

  // The parser, on planted controls: a body family whose range differs, and a single-value
  // declaration read as a range of itself. Without these an empty parse would read as a pass.
  expect(publishedWeightRange('Geist Mono'), 'a single font-weight is not read as a range').toEqual([400, 400]);
  expect(publishedWeightRange('Geist')?.[0], 'the parser answers the same range for every family').not.toBe(
    range?.[0]
  );
  expect(publishedWeightRange('A Family Nothing Publishes'), 'the parser invents a range').toBeNull();

  const heaviestRequested = Math.max(...DISPLAY_REGULAR_SITES.map((site) => site.requests));
  expect(
    range?.[0] ?? 0,
    `${displayFamily} publishes font-weight ${range?.join(' ')}, and the heaviest weight the ` +
      `--monument-regular call sites request is ${heaviestRequested}. The mapping assigns those three ` +
      `the display family at bold and relies on the face clamping the request up to its lower bound. ` +
      `With a lower bound at or below ${heaviestRequested} the clamp stops happening and ` +
      `${DISPLAY_REGULAR_SITES.map((site) => site.at).join(', ')} render lighter than the mapping says, ` +
      `with no other case in this story reacting.`
  ).toBeGreaterThan(heaviestRequested);

  // And the family itself reaches all three, which is the other half of the same claim. The
  // weight is deliberately not asserted here: these three request 400 and 500 by design and the
  // clamp happens at rasterization, not in the computed value. No font-weight line is added to
  // these stylesheets, because the acceptance criteria name four call sites and not seven.
  const wrong: string[] = [];
  let read = 0;

  for (const route of [...new Set(DISPLAY_REGULAR_SITES.map((site) => site.route))]) {
    await goTo(page, route, route === NOT_FOUND ? 404 : 200);
    for (const site of DISPLAY_REGULAR_SITES.filter((candidate) => candidate.route === route)) {
      const family = await computedStyleValue(page, site.selector, 'font-family');
      read += 1;
      if (firstFamily(family) !== displayFamily) {
        wrong.push(`${site.at} (${site.selector}) computes font-family "${family}", expected ${displayFamily} first`);
      }
      if (/MonumentExtended/.test(family)) {
        wrong.push(`${site.at} (${site.selector}) still resolves the retired family "${family}"`);
      }
    }
  }

  expect(read, 'fewer than three --monument-regular call sites were read').toBe(DISPLAY_REGULAR_SITES.length);
  expect(wrong, `a --monument-regular call site does not resolve the display family:\n${wrong.join('\n')}`).toEqual([]);
});

test('the body ground and body copy where the base rule paints are the token roles, and neither is pure', async ({
  page,
}) => {
  // **Not `/cv`, and the reason is a finding this story made by rendering rather than by reading.**
  // Story 1-17 concluded from the stylesheets that `/cv` and `/recommendation` were the two routes
  // where the base `body` rule paints, and said so while recording that it had not rendered them
  // (`ops/anchor-token-adoption.md` § "A second finding"). They never render at all:
  // `next.config.js` redirects both, permanently, to a PDF under `/pdf/`, so a browser asked for
  // `/cv` starts a download and paints no Hub page.
  //
  // The surface that does show the base rule is the 404. `Container.tsx` sets `<body id={route}>`
  // from the stripped, hyphenated pathname, and an unrouted path's id matches none of
  // `body#work, body#projects` (`app/app.scss`), `body[id='']` (`HomeLayout.scss`) or `#celeste`
  // (`celeste.scss`), so nothing overrides `background: var(--black-color)` there.
  // `error-page.scss:7` paints its own `#0a000f` on the error container, not on `body`.
  await goTo(page, NOT_FOUND, 404);

  // The guard, saying what it actually covers. The three rules that override the base ground on
  // the other routes all paint a grid **image** as well as a colour, so an image on `body` here
  // means one of them started matching the 404's id. It does not cover a colour-only override,
  // which is why it is not the assertion this case rests on: the comparison against `--token-bg`
  // below is, and a colour-only override fails there naming both values.
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

  // And neither is pure, compared as pixels rather than as strings, because a colour can be
  // written several ways and the build writes it in one of them.
  const [groundPixel, copyPixel, blackPixel, whitePixel] = await rasterise(page, [
    background,
    colour,
    'rgb(0, 0, 0)',
    'rgb(255, 255, 255)',
  ]);
  expect(blackPixel, 'the raster control for pure black no longer holds').toBe(PURE_BLACK);
  expect(whitePixel, 'the raster control for pure white no longer holds').toBe(PURE_WHITE);
  expect(groundPixel, 'the body ground is pure black, which the contract retires').not.toBe(PURE_BLACK);
  expect(copyPixel, 'body copy is pure white, which the contract retires').not.toBe(PURE_WHITE);
});

test('every route the Hub serves still answers 2xx', async ({ page }) => {
  // NFR-2 binds every migration step, so this is measured rather than assumed.
  //
  // **`page.request` and not `page.goto`.** Two of the seven, `/cv` and `/recommendation`, are
  // permanent redirects to a PDF (`next.config.js`), so a browser asked for either starts a
  // download rather than a navigation and `page.goto` rejects with "Download is starting". The
  // request context follows the redirect and reports the status the visitor ends on, which is
  // what NFR-2 is about. That the two redirect at all is pinned below rather than absorbed,
  // because it is the fact that moved this story's body-ground read onto the 404 surface.
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

  // The two that redirect, and the five that do not, pinned as a pair so a redirect quietly added
  // or removed shows up here rather than as a puzzling download three stories later.
  const redirected = [...landedOn].filter(([route, landing]) => route !== landing).map(([route]) => route);
  expect(redirected.sort(), 'the set of routes that redirect away from the Hub has changed').toEqual([
    '/cv',
    '/recommendation',
  ]);
  for (const route of redirected) {
    expect(landedOn.get(route), `${route} no longer lands on a PDF`).toMatch(/^\/pdf\/.+\.pdf$/);
  }

  // The viewport the whole file reads at, asserted rather than assumed from the config.
  expect(page.viewportSize()).toEqual({ ...RENDERED_VIEWPORT });
});
