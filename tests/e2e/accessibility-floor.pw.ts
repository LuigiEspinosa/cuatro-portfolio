import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The Hub's focus standard, DOM-order traversal, depth tells, z-levels, type floor and autoplay,
 * measured in a real browser on every route the Hub serves (Story 2-26, AD-19).
 *
 * **What this file asserts, and where each claim comes from.**
 *
 *  1. **The ring, A-1** (`EXPERIENCE.md:711-722`, `RESTYLE-SPEC.md:322-352` § 4). Every
 *     interactive element on every route paints `--stroke-focus` solid `--token-focus` at
 *     `--focus-offset` when reached by Tab, with `:focus-visible` matched and no transition
 *     naming `outline` or `all`; paints nothing under the mouse, hovered or clicked; and the ring
 *     contrasts at least 3:1 against the ground it sits over. The three token grounds are each
 *     read at least once, a control planted and labelled where no shipped element sits on one.
 *     Focus and hover are different tokens, so a keyboard visitor can tell them apart.
 *  2. **Traversal in DOM order** (`EXPERIENCE.md:739`). Tab from `body` visits exactly the
 *     visible tabbables in document order, the next Tab leaves the document, and no `tabindex`
 *     computes above zero. On the animated door `.skip-control` is a stop and paints the ring.
 *  3. **The built CSS** (`epics.md:3053-3061`, UX-DR44). Every `z-index:<number>`, `box-shadow`,
 *     `text-shadow` and `*-gradient(` occurrence in `.next/static/chunks/*.css` is claimed by a
 *     ledger row and every row is claimed back, tallied per value, property or function. The
 *     `--z-*` names come from `contracts/tokens.css`, and an empty build throws rather than
 *     passing over nothing.
 *  4. **The type floor, A-11 and A-12** (`epics.md:3042-3051`, `DESIGN.md:461-502`). Nothing
 *     visible computes under `--t-3xs`; no paragraph under `--t-2xs`, the labels `DESIGN.md`
 *     places on `<p>` at the smallest step excepted by name; none of the six prose selectors
 *     under `--t-sm`; nothing italic; no weight above the family's published range except what
 *     the ledger carries; and no stylesheet sets `font-size` in `px`.
 *  5. **Autoplay, A-16** (`EXPERIENCE.md:775`). No `video`, `audio`, `marquee`, refresh meta or
 *     `[autoplay]` on any route.
 *
 * **The 2-8 mechanism, restated** (`ops/known-violations.md:389-409`, Operator ruling of
 * 2026-09-13). The sweep is universal; the known breaches are carried in `EXEMPTIONS` below, a
 * dated ledger that can only shrink, held equal in both directions to the table in
 * `ops/hub-accessibility-pass.md` by `ops/__tests__/hub-accessibility-pass.test.ts`. Every row
 * names a `Story n-n` on the board that is not `done`; a repaired row left behind fails as stale.
 * Nothing here fixes anything: a breach owned by a redesign story is a row or a recorded finding.
 *
 * **Every threshold is read off the contract on the page, never typed.** `--stroke-focus`,
 * `--token-focus`, `--focus-offset`, `--t-3xs`, `--t-2xs` and `--t-sm` are resolved through a
 * probe element in the running page, and the `--z-*` names are parsed out of
 * `contracts/tokens.css`. The agreement suite scans this file for a hand-written threshold the
 * way `ops/__tests__/hit-target-floor.test.ts` scans for a hand-written floor.
 *
 * **Copied, not imported.** `routesOnDisk`, `INTERACTIVE`, the visibility rule, `settle`,
 * `tabTo`, `probeComputed` and `focused` are the shapes `tests/e2e/hit-target-floor.pw.ts`,
 * `cv.pw.ts`, `secondary-surfaces.pw.ts` and `front-door.pw.ts` already carry. A `.pw.ts`
 * imported by another registers its tests twice, and `ops/__tests__/hit-target-floor.test.ts`
 * pins `routesOnDisk` in that spec's own text, so each spec keeps its own copy.
 *
 * **No screenshot is taken.** `tests/e2e/rendered-output.pw.ts` pins one committed PNG, and this
 * file writes no snapshot directory.
 *
 * Every predicate introduced here is shown firing on a planted control, injected into one page
 * through the browser or driven with fabricated input, so it touches no file.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`. Same as `tests/e2e/hit-target-floor.pw.ts:61`.
const REPO_ROOT = resolve(__dirname, '..', '..');

/** A path the Hub does not route, which renders `app/not-found.tsx` through the root layout. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** The routes the Hub serves that render no Hub markup at all, same list as the 2-8 sweep. */
const NON_HUB_ROUTES = ['/api/health'] as const;

/** The entrance the home surface animates, and the selector the settle waits on. */
const ENTRANCE_SELECTOR = '.nav-link, .contact-container a';

/** The contract files the thresholds and the family ranges are read from. */
const TOKENS_CSS = join(REPO_ROOT, 'contracts', 'tokens.css');
const FONTS_CSS = join(REPO_ROOT, 'contracts', 'fonts.css');

/** Where Next 16 writes the built stylesheets. Never `.next/static/css/`. */
const CHUNK_DIR = join('.next', 'static', 'chunks');

/** The attribute the traversal tags each visible tabbable with, in DOM order, so a stop is named by index. */
const TAG = 'data-cuatro-a11y';

/**
 * What counts as an interactive element. Verbatim from `tests/e2e/hit-target-floor.pw.ts:166-191`.
 */
const INTERACTIVE = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * The six selectors `DESIGN.md` classifies as prose, which the body floor `--t-sm` binds.
 *
 * Prose is not derivable from markup, so this is `DESIGN.md`'s classification and not a tag
 * test: `:470` "Body floor. No prose sets smaller", `:489` the measure on descriptions and lede.
 */
const PROSE_SELECTORS = [
  '.premise__lede',
  '.cv-intro__lede',
  '.suite-directory__description',
  '.work-item__description',
  '.work-item__highlights li',
  '.error-page__sub',
] as const;

/**
 * The `<p>` elements `DESIGN.md` places at the smallest step by name, and which the paragraph
 * floor therefore does not bind.
 *
 * `DESIGN.md:467` reserves `--t-3xs` for labels and never prose, and the Suite Directory marks
 * four of its labels up as `<p>`: the count (`:490` binds `tabular-nums` to every count), the tech
 * array (`:660`), the Status mark (`:637`) and the Family group's label (`:667`). Each is a label
 * by the design's own classification, so each is named here with the line that places it, rather
 * than the floor being read as "every `<p>`" and failing the design as shipped. Each selector is
 * asserted to match on some route, so an entry cannot outlive the element it excuses.
 */
const LABEL_PARAGRAPHS = [
  { selector: '.suite-directory__count', at: 'DESIGN.md:467,490' },
  { selector: '.suite-directory__tech', at: 'DESIGN.md:660' },
  { selector: '.suite-directory__status', at: 'DESIGN.md:637' },
  { selector: '.suite-directory__family-name', at: 'DESIGN.md:667' },
] as const;

/**
 * The one shape an exemption's `source` may take: a path, then the line or lines the breach sits
 * on. `ops/__tests__/hub-accessibility-pass.test.ts` reads this literal back out of this file.
 */
const SOURCE_SHAPE = /^[\w./-]+\.(tsx|scss):\d+(-\d+)?(,\d+)*$/;

/**
 * One breach the Hub ships today, of one of three kinds.
 *
 * `check` says which sweep the row belongs to and what `match` means there: for `z-index` the
 * literal value as written in the built CSS; for `depth` the property (`box-shadow`,
 * `text-shadow`) or gradient function (`linear-gradient`, `radial-gradient`,
 * `repeating-linear-gradient`, `conic-gradient`) as written; for `weight` a selector whose
 * elements compute a `font-weight` above their family's published range. `count` is an
 * expectation: the sweep tallies occurrences per `match` and holds the sum of the rows' counts
 * equal to it in both directions, so a repaired site with its row left behind fails as stale and
 * no row can be vacuous. `closedBy` is the story whose redesign owns the file.
 */
interface Exemption {
  readonly id: string;
  readonly check: 'z-index' | 'depth' | 'weight';
  readonly match: string;
  readonly count: number;
  readonly source: string;
  readonly closedBy: string;
}

/**
 * The ledger. Held equal to the table in `ops/hub-accessibility-pass.md` in both directions by
 * `ops/__tests__/hub-accessibility-pass.test.ts`, so neither file is the only reader of the other.
 *
 * Every count was read off this sweep's own failure output in
 * `mcr.microsoft.com/playwright:v1.62.1-noble`, never computed from a census of the source.
 */
const EXEMPTIONS: readonly Exemption[] = [
  {
    id: 'z-home-overlay',
    check: 'z-index',
    match: '20',
    count: 1,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:28',
    closedBy: 'Story 2-29',
  },
  {
    id: 'z-home-panel',
    check: 'z-index',
    match: '5',
    count: 1,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:39',
    closedBy: 'Story 2-29',
  },
  {
    id: 'z-home-gem',
    check: 'z-index',
    match: '3',
    count: 1,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:181',
    closedBy: 'Story 2-29',
  },
  {
    id: 'z-scanline',
    check: 'z-index',
    match: '10',
    count: 1,
    source: 'components/atoms/ScanlineOverlay/ScanlineOverlay.scss:4',
    closedBy: 'Story 2-28',
  },
  {
    id: 'z-work-hero',
    check: 'z-index',
    match: '2',
    count: 2,
    source: 'components/organisms/WorkHero/WorkHero.scss:15,40',
    closedBy: 'Story 2-33',
  },
  {
    id: 'z-error-content',
    check: 'z-index',
    match: '2',
    count: 1,
    source: 'components/organisms/ErrorPage/error-page.scss:19',
    closedBy: 'Story 2-30',
  },
  {
    id: 'shadow-glitch-loop',
    check: 'depth',
    match: 'text-shadow',
    count: 7,
    source: 'components/molecules/GlitchText/glitch-text.scss:26-68',
    closedBy: 'Story 2-27',
  },
  {
    id: 'gradient-work-ground',
    check: 'depth',
    match: 'linear-gradient',
    count: 2,
    source: 'app/app.scss:136-137',
    closedBy: 'Story 2-33',
  },
  {
    id: 'gradient-home-ground',
    check: 'depth',
    match: 'linear-gradient',
    count: 2,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:11-12',
    closedBy: 'Story 2-29',
  },
  {
    id: 'gradient-error-ground',
    check: 'depth',
    match: 'linear-gradient',
    count: 2,
    source: 'components/organisms/ErrorPage/error-page.scss:9-10',
    closedBy: 'Story 2-30',
  },
  {
    id: 'gradient-scanline-vignette',
    check: 'depth',
    match: 'radial-gradient',
    count: 1,
    source: 'components/atoms/ScanlineOverlay/ScanlineOverlay.scss:6',
    closedBy: 'Story 2-28',
  },
  {
    id: 'gradient-scanline-lines',
    check: 'depth',
    match: 'repeating-linear-gradient',
    count: 1,
    source: 'components/atoms/ScanlineOverlay/ScanlineOverlay.scss:12-18',
    closedBy: 'Story 2-28',
  },
  {
    id: 'weight-work-initiative',
    check: 'weight',
    match: '.work-item__initiative',
    count: 2,
    source: 'components/atoms/WorkItem/WorkItem.scss:85',
    closedBy: 'Story 2-31',
  },
];

/** The four depth properties and functions the built-CSS sweep counts, as written in minified CSS. */
const DEPTH_PROPERTIES = ['box-shadow', 'text-shadow'] as const;
const DEPTH_FUNCTIONS = ['linear-gradient', 'radial-gradient', 'repeating-linear-gradient', 'conic-gradient'] as const;

/** The WCAG 2.1 non-text contrast floor the ring is held to (1.4.11). */
const RING_CONTRAST_FLOOR = 3;

/** Sub-pixel slack on a font-size comparison alone, never on the floor's identity. */
const SIZE_SLACK = 0.01;

// ---------------------------------------------------------------------------
// Navigation, settling, and the route set
// ---------------------------------------------------------------------------

/** Navigate, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * Every route `app/` actually serves, derived from the filesystem rather than restated. Same
 * walk as `tests/e2e/hit-target-floor.pw.ts:365-389`.
 */
const routesOnDisk = (directory: string, prefix = '', found: string[] = []): string[] => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name.startsWith('_')) continue;
      if (/[[\]]/.test(entry.name)) {
        throw new Error(
          `Accessibility floor: app/${prefix}/${entry.name} is a dynamic segment, so it has no single ` +
            `URL this sweep can visit. Teach this walk the concrete paths rather than leaving a route unswept.`
        );
      }
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
      routesOnDisk(join(directory, entry.name), `${prefix}${segment}`, found);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name === 'not-found.tsx') {
      found.push(NOT_FOUND);
      continue;
    }
    if (/^(page|route)\.(tsx|ts|jsx|js)$/.test(entry.name)) found.push(prefix === '' ? '/' : prefix);
  }
  found.sort();
  return found;
};

interface Surface {
  readonly route: string;
  readonly status: number;
  readonly entrance: boolean;
}

/**
 * Every Hub surface, derived: the routes on disk less the declared non-Hub ones. The 404 stand-in
 * answers 404 and the home surface is the one with an animated entrance.
 */
const SURFACES: readonly Surface[] = routesOnDisk(join(REPO_ROOT, 'app'))
  .filter((route) => !(NON_HUB_ROUTES as readonly string[]).includes(route))
  .map((route) => ({ route, status: route === NOT_FOUND ? 404 : 200, entrance: route === '/' }));

/** Wait for fonts, then for the home entrance to settle. Same as `hit-target-floor.pw.ts:405-441`. */
const settle = async (page: Page, surface: Surface): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  if (surface.entrance) {
    const animated = await page.locator(ENTRANCE_SELECTOR).count();
    expect(
      animated,
      `Accessibility floor: "${surface.route}" declares an animated entrance and "${ENTRANCE_SELECTOR}" ` +
        `matches nothing on it, so the settle below would wait on an empty NodeList and return at once.`
    ).toBeGreaterThan(0);
  }

  try {
    await page.waitForFunction(
      (selector: string) =>
        [...document.querySelectorAll(selector)].every((node) => window.getComputedStyle(node).opacity === '1'),
      ENTRANCE_SELECTOR,
      { timeout: 15_000 }
    );
  } catch (error) {
    throw new Error(
      `Accessibility floor: the wait for the entrance on "${surface.route}" did not resolve. ` +
        `Underlying failure: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * The computed value of one property, resolved by laying out a probe. Same shape as
 * `tests/e2e/cv.pw.ts:101-112`: a custom property's computed value is its declared token stream,
 * so a threshold is read as what it resolves to, never parsed.
 */
const probeComputed = (page: Page, declaration: string, property: string): Promise<string> =>
  page.evaluate(
    ([css, name]) => {
      const probe = document.createElement('div');
      probe.setAttribute('style', `position:absolute;left:-99999px;top:0;width:1px;height:1px;${css}`);
      document.body.append(probe);
      const read = window.getComputedStyle(probe).getPropertyValue(name);
      probe.remove();
      return read;
    },
    [declaration, property] as const
  );

/** A pixel length off a probe, refused when it is not one. */
const pxOf = (value: string, what: string): number => {
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(value.trim());
  if (!match) throw new Error(`Accessibility floor: ${what} resolved to "${value}", which is not a pixel length`);
  return Number(match[1]);
};

/**
 * Move focus forward with the keyboard until `locator` holds it, or give up and say so.
 * `locator.focus()` never matches `:focus-visible` (`tests/e2e/cv.pw.ts:169-172`).
 */
const tabTo = async (page: Page, locator: Locator, limit = 40): Promise<boolean> => {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((node) => node === document.activeElement)) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// The ring, the traversal and the grounds
// ---------------------------------------------------------------------------

/** What every threshold the ring is held to resolves to on this page, read once per route. */
interface RingContract {
  readonly width: string;
  readonly colour: string;
  readonly offset: string;
  readonly hover: string;
  readonly accent: string;
  /** Each of the three token grounds, rasterised to `r,g,b,a`. */
  readonly grounds: Readonly<Record<string, string>>;
}

const GROUND_TOKENS = ['--token-bg', '--token-bg-raised', '--token-bg-raised-2'] as const;

/**
 * Rasterise colours to sRGB through a 1 by 1 canvas, with two sentinels so an unparsed value is
 * reported rather than read as the previous one (`tests/e2e/anchor-aliases.pw.ts:293-336`).
 */
const rasterise = async (page: Page, values: readonly string[]): Promise<string[]> => {
  const read = await page.evaluate((list: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return list.map(() => 'no-2d-context');
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
  const broken = read.filter((answer) => answer === 'no-2d-context' || answer.startsWith('unparsed-by-canvas:'));
  if (broken.length > 0) {
    throw new Error(`Accessibility floor: a colour could not be rasterised to sRGB: ${broken.join(', ')}`);
  }
  return read;
};

const ringContract = async (page: Page): Promise<RingContract> => {
  const [width, colour, offset, hover, accent, ...groundRaw] = await Promise.all([
    probeComputed(page, 'outline:var(--stroke-focus) solid red;', 'outline-width'),
    probeComputed(page, 'color:var(--token-focus);', 'color'),
    probeComputed(page, 'outline-offset:var(--focus-offset);', 'outline-offset'),
    probeComputed(page, 'color:var(--token-accent-hover);', 'color'),
    probeComputed(page, 'color:var(--token-accent);', 'color'),
    ...GROUND_TOKENS.map((token) => probeComputed(page, `background-color:var(${token});`, 'background-color')),
  ]);
  for (const [name, value] of [
    ['--stroke-focus', width],
    ['--token-focus', colour],
    ['--focus-offset', offset],
  ] as const) {
    expect(value.trim(), `${name} resolved to nothing on ${page.url()}, so the ring has no contract to be read against`).not.toBe('');
  }
  pxOf(width, '--stroke-focus');
  pxOf(offset, '--focus-offset');
  const rasterised = await rasterise(page, groundRaw);
  const grounds: Record<string, string> = {};
  GROUND_TOKENS.forEach((token, index) => {
    grounds[token] = rasterised[index];
  });
  return { width, colour, offset, hover, accent, grounds };
};

/** WCAG 2.1 relative luminance of an `r,g,b,a` string, refusing anything not opaque. */
const luminance = (rgba: string): number => {
  const [r, g, b, a] = rgba.split(',').map(Number);
  if (a !== 255) throw new Error(`Accessibility floor: "${rgba}" is not opaque, so its luminance is against nothing`);
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** The contrast ratio between two `r,g,b,a` strings. */
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** One tabbable, tagged in DOM order, before any key is pressed. */
interface Tabbable {
  readonly index: number;
  readonly at: string;
  readonly text: string;
}

/**
 * Tag every visible tabbable in DOM order and answer the list, plus every `[tabindex]` that
 * computes above zero. Visible is the 2-8 rule (`hit-target-floor.pw.ts:548-556`); tabbable is
 * `INTERACTIVE` less `[tabindex="-1"]`.
 */
const tagTabbables = async (page: Page): Promise<{ tabbables: Tabbable[]; positives: string[] }> =>
  page.evaluate(
    ({ selector, tag }) => {
      const path = (node: Element): string => {
        const parts: string[] = [];
        let current: Element | null = node;
        while (current && current !== document.documentElement) {
          let part = current.tagName.toLowerCase();
          if (current.id) part += `#${current.id}`;
          const classes = [...current.classList].filter((name) => name !== 'glitch').join('.');
          if (classes) part += `.${classes}`;
          const parent: Element | null = current.parentElement;
          if (parent) {
            const tagName = current.tagName;
            const siblings = [...parent.children].filter((child) => child.tagName === tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          parts.unshift(part);
          current = current.parentElement;
        }
        return parts.join(' > ');
      };
      const hidden = (node: Element): boolean => {
        if (node.closest('[aria-hidden="true"]')) return true;
        if (node.closest('[hidden]')) return true;
        if (node.getClientRects().length === 0) return true;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return true;
        if (window.getComputedStyle(node).visibility === 'hidden') return true;
        return false;
      };
      for (const stale of document.querySelectorAll(`[${tag}]`)) stale.removeAttribute(tag);
      const tabbables: { index: number; at: string; text: string }[] = [];
      for (const node of document.querySelectorAll(selector)) {
        if (hidden(node) || node.getAttribute('tabindex') === '-1') continue;
        const index = tabbables.length;
        node.setAttribute(tag, String(index));
        tabbables.push({ index, at: path(node), text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) });
      }
      const positives = [...document.querySelectorAll('[tabindex]')]
        .filter((node) => (node as HTMLElement).tabIndex > 0)
        .map((node) => `${path(node)} (tabindex=${node.getAttribute('tabindex')})`);
      return { tabbables, positives };
    },
    { selector: INTERACTIVE, tag: TAG }
  );

/** What one Tab stop read: which tagged element holds focus, the ring quartet, and the ground under it. */
interface Stop {
  readonly index: number | null;
  readonly at: string;
  readonly text: string;
  readonly outlineStyle: string;
  readonly outlineWidth: string;
  readonly outlineColor: string;
  readonly outlineOffset: string;
  readonly transitionProperty: string;
  /**
   * Read beside the property, because the initial value of `transition-property` is `all` on
   * every element and only a duration above zero makes it a transition
   * (`ops/cs-tracker-accessibility-probe.mjs:599-620`).
   */
  readonly transitionDuration: string;
  readonly focusVisible: boolean;
  /** The first painted colour walking from the parent upward, and any image met on the way. */
  readonly groundColour: string;
  readonly groundImage: string;
  readonly groundAt: string;
}

const readStop = (page: Page): Promise<Stop> =>
  page.evaluate((tag) => {
    const active = document.activeElement;
    const path = (node: Element): string => {
      const parts: string[] = [];
      let current: Element | null = node;
      while (current && current !== document.documentElement) {
        let part = current.tagName.toLowerCase();
        if (current.id) part += `#${current.id}`;
        const classes = [...current.classList].filter((name) => name !== 'glitch').join('.');
        if (classes) part += `.${classes}`;
        const parent: Element | null = current.parentElement;
        if (parent) {
          const tagName = current.tagName;
          const siblings = [...parent.children].filter((child) => child.tagName === tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    if (!active || active === document.body) {
      return {
        index: null,
        at: active ? 'body' : '(nothing)',
        text: '',
        outlineStyle: '',
        outlineWidth: '',
        outlineColor: '',
        outlineOffset: '',
        transitionProperty: '',
        transitionDuration: '',
        focusVisible: false,
        groundColour: '',
        groundImage: '',
        groundAt: '',
      };
    }
    const style = window.getComputedStyle(active);
    const painted = (colour: string): boolean => {
      const match = /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(colour);
      if (match) return match[1] === undefined || Number.parseFloat(match[1]) > 0;
      // `lab()`, `oklch()`, `color()`: opaque unless an alpha follows a slash.
      const alpha = /\/\s*([\d.]+%?)\s*\)$/.exec(colour);
      return alpha === null || Number.parseFloat(alpha[1]) > 0;
    };
    let groundColour = '';
    let groundImage = '';
    let groundAt = '';
    for (let node = active.parentElement; node !== null; node = node.parentElement) {
      const ancestor = window.getComputedStyle(node);
      if (groundImage === '' && ancestor.backgroundImage !== 'none') groundImage = `${path(node)}: ${ancestor.backgroundImage.slice(0, 60)}`;
      if (painted(ancestor.backgroundColor)) {
        groundColour = ancestor.backgroundColor;
        groundAt = path(node);
        break;
      }
    }
    const raw = active.getAttribute(tag);
    return {
      index: raw === null ? null : Number(raw),
      at: path(active),
      text: (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      focusVisible: active.matches(':focus-visible'),
      groundColour,
      groundImage,
      groundAt,
    };
  }, TAG);

/** The longest entry of a computed `transition-duration` list, in milliseconds. */
const longestDurationMs = (value: string): number =>
  Math.max(
    0,
    ...value.split(',').map((part) => {
      const match = /^\s*([0-9.]+)(ms|s)\s*$/.exec(part);
      if (!match) return 0;
      return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
    })
  );

/**
 * Whether a ring is transitioned: `transition-property` names `outline`, any `outline-*` or
 * `all`, **over a duration above zero**. The initial value of `transition-property` is `all` on
 * every element, so the property alone names nothing; it is the pair that animates.
 */
const transitionsOutline = (property: string, duration: string): boolean =>
  property
    .split(',')
    .map((part) => part.trim())
    .some((part) => part === 'all' || part === 'outline' || part.startsWith('outline-')) && longestDurationMs(duration) > 0;

/**
 * The ring verdict on one stop. Pure, so the planted controls can drive it.
 */
const ringFindings = (route: string, stop: Stop, contract: RingContract): string[] => {
  const where = `${route}: ${stop.at} ("${stop.text}")`;
  const values =
    `outline-style ${stop.outlineStyle}, outline-width ${stop.outlineWidth}, outline-color ${stop.outlineColor}, ` +
    `outline-offset ${stop.outlineOffset}, transition-property "${stop.transitionProperty}" over "${stop.transitionDuration}"`;
  const found: string[] = [];
  if (!stop.focusVisible) found.push(`${where} holds focus after Tab and does not match :focus-visible; ${values}`);
  if (stop.outlineStyle !== 'solid') found.push(`${where} paints no solid ring under Tab; ${values}`);
  if (stop.outlineWidth !== contract.width) found.push(`${where} ring is not --stroke-focus (${contract.width}) wide; ${values}`);
  if (stop.outlineColor !== contract.colour) found.push(`${where} ring is not painted in --token-focus (${contract.colour}); ${values}`);
  if (stop.outlineOffset !== contract.offset) found.push(`${where} ring is not at --focus-offset (${contract.offset}); ${values}`);
  if (transitionsOutline(stop.transitionProperty, stop.transitionDuration)) found.push(`${where} transitions its outline; ${values}`);
  return found;
};

/**
 * The traversal verdict: the stops Tab visited against the DOM-ordered tabbables, what the extra
 * Tab landed on, and every positive `tabindex`. Pure, driven by fabricated sequences below.
 */
const traversalVerdict = (
  route: string,
  expected: readonly Tabbable[],
  observed: readonly Stop[],
  afterLast: Stop,
  positives: readonly string[]
): string[] => {
  const found: string[] = [];
  const diverged = expected.findIndex((tabbable, position) => observed[position]?.index !== tabbable.index);
  if (diverged !== -1) {
    const landed = observed[diverged];
    found.push(
      `${route}: Tab number ${diverged + 1} landed on ${landed ? `${landed.at} ("${landed.text}")` : 'nothing'} ` +
        `where DOM order puts ${expected[diverged].at} ("${expected[diverged].text}")`
    );
  }
  if (afterLast.index !== null && afterLast.index !== 0) {
    found.push(
      `${route}: Tab number ${expected.length + 1} stayed inside the document on ${afterLast.at} rather than ` +
        `leaving it or wrapping to the first stop`
    );
  }
  for (const positive of positives) found.push(`${route}: ${positive} computes a positive tabindex, which reorders the traversal`);
  return found;
};

/** Where focus is, and what the focused element measures. Same as `tests/e2e/front-door.pw.ts:1258-1275`. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const box = active.getBoundingClientRect();
    return {
      tag: active.tagName,
      className: active.className,
      text: (active.textContent ?? '').replace(/\s+/g, ' ').trim(),
      top: box.top,
      height: box.height,
      focusVisible: active.matches(':focus-visible'),
      outlineStyle: window.getComputedStyle(active).outlineStyle,
    };
  });

// ---------------------------------------------------------------------------
// The built CSS
// ---------------------------------------------------------------------------

/**
 * Every built stylesheet under `directory`, as text. Throws naming the directory on an empty or
 * absent build, so the tally never passes vacuously (`ops/asset-budget.mjs:993-998`).
 */
const builtStyles = (directory = join(REPO_ROOT, CHUNK_DIR)): { name: string; text: string }[] => {
  if (!existsSync(directory)) {
    throw new Error(`Accessibility floor: ${directory} is not there. Run corepack pnpm build first; an absent build proves nothing.`);
  }
  const found: { name: string; text: string }[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css')) found.push({ name: path.slice(directory.length + 1), text: readFileSync(path, 'utf8') });
    }
  };
  walk(directory);
  if (found.length === 0) {
    throw new Error(`Accessibility floor: ${directory} holds no .css file, so the z-index and depth tally would pass over nothing.`);
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
};

/** The `--z-*` names the contract declares, parsed off `contracts/tokens.css` rather than typed. */
const contractLayers = (): string[] => {
  const source = readFileSync(TOKENS_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const names = [...source.matchAll(/(?:^|[;{])\s*(--z-[a-z0-9-]+)\s*:/gm)].map((found) => found[1]);
  if (names.length === 0) throw new Error('Accessibility floor: contracts/tokens.css declares no --z-* name');
  return names;
};

/**
 * The tally of z-index literals and depth tells over the built CSS, against the ledger.
 *
 * Pure over its inputs. Every occurrence is claimed by rows sharing its `match`; the rows' counts
 * sum to what was observed; a row whose match nothing carries is stale; a `var(--z-*)` is never
 * counted, and one naming a layer the contract does not declare is a defect of its own.
 */
const tally = (
  styles: readonly { name: string; text: string }[],
  ledger: readonly Exemption[],
  layers: readonly string[]
): { unlisted: string[]; stale: string[]; mismatched: string[]; unknownLayers: string[]; observed: Map<string, number> } => {
  const observed = new Map<string, number>();
  const bump = (key: string): void => {
    observed.set(key, (observed.get(key) ?? 0) + 1);
  };
  const unknownLayers: string[] = [];
  for (const { name, text } of styles) {
    for (const found of text.matchAll(/z-index:\s*(-?\d+)/g)) bump(`z-index=${found[1]}`);
    for (const found of text.matchAll(/z-index:\s*var\((--z-[a-z0-9-]+)\)/g)) {
      if (!layers.includes(found[1])) unknownLayers.push(`${name} reads z-index: var(${found[1]}), which contracts/tokens.css does not declare`);
    }
    for (const property of DEPTH_PROPERTIES) {
      for (const found of text.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:`, 'g'))) bump(`depth=${property}`);
    }
    for (const fn of DEPTH_FUNCTIONS) {
      for (const found of text.matchAll(new RegExp(`(?<![\\w-])${fn}\\s*\\(`, 'g'))) bump(`depth=${fn}`);
    }
  }
  const claimed = new Map<string, number>();
  for (const row of ledger) {
    if (row.check === 'weight') continue;
    const key = `${row.check}=${row.match}`;
    claimed.set(key, (claimed.get(key) ?? 0) + row.count);
  }
  const unlisted: string[] = [];
  const stale: string[] = [];
  const mismatched: string[] = [];
  for (const [key, count] of [...observed].sort()) {
    if (!claimed.has(key)) unlisted.push(`${key} occurs ${count} time(s) in the built CSS and no ledger row claims it`);
  }
  for (const [key, sum] of [...claimed].sort()) {
    const count = observed.get(key) ?? 0;
    const rows = ledger.filter((row) => `${row.check}=${row.match}` === key).map((row) => `"${row.id}"`);
    if (count === 0) stale.push(`${rows.join(' and ')} claim ${key} and the built CSS carries none: the row is stale, delete it here and in ops/hub-accessibility-pass.md`);
    else if (count !== sum) mismatched.push(`${rows.join(' and ')} claim ${sum} occurrence(s) of ${key} and the built CSS carries ${count}`);
  }
  return { unlisted, stale, mismatched, unknownLayers, observed };
};

// ---------------------------------------------------------------------------
// The type floor
// ---------------------------------------------------------------------------

/** One visible element carrying its own text, as read on the page. */
interface TextRead {
  readonly at: string;
  readonly tag: string;
  readonly text: string;
  readonly fontSize: number;
  readonly fontStyle: string;
  readonly fontWeight: number;
  readonly family: string;
  readonly prose: boolean;
  /** The `LABEL_PARAGRAPHS` selector this element matches, if any. */
  readonly label: string | null;
  /** The ledger rows whose selector this element matches. */
  readonly matchedIds: readonly string[];
}

/** Every visible element with a direct non-whitespace text node, outside `aria-hidden` subtrees. */
const readText = (page: Page, ledger: readonly Exemption[]): Promise<TextRead[]> =>
  page.evaluate(
    ({ prose, labels, rows }) => {
      const path = (node: Element): string => {
        const parts: string[] = [];
        let current: Element | null = node;
        while (current && current !== document.documentElement) {
          let part = current.tagName.toLowerCase();
          if (current.id) part += `#${current.id}`;
          const classes = [...current.classList].filter((name) => name !== 'glitch').join('.');
          if (classes) part += `.${classes}`;
          const parent: Element | null = current.parentElement;
          if (parent) {
            const tagName = current.tagName;
            const siblings = [...parent.children].filter((child) => child.tagName === tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          parts.unshift(part);
          current = current.parentElement;
        }
        return parts.join(' > ');
      };
      const hidden = (node: Element): boolean => {
        if (node.closest('[aria-hidden="true"]')) return true;
        if (node.closest('[hidden]')) return true;
        if (node.getClientRects().length === 0) return true;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return true;
        if (window.getComputedStyle(node).visibility === 'hidden') return true;
        return false;
      };
      const out: TextRead[] = [];
      for (const node of document.querySelectorAll('body *')) {
        if (node.closest('script, style, noscript, template')) continue;
        const own = [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '');
        if (!own || hidden(node)) continue;
        const style = window.getComputedStyle(node);
        const family = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        out.push({
          at: path(node),
          tag: node.tagName.toLowerCase(),
          text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          fontSize: Number.parseFloat(style.fontSize),
          fontStyle: style.fontStyle,
          fontWeight: Number.parseFloat(style.fontWeight),
          family,
          prose: prose.some((selector) => node.matches(selector)),
          label: labels.find((selector) => node.matches(selector)) ?? null,
          matchedIds: rows.filter((row) => node.matches(row.match)).map((row) => row.id),
        });
      }
      return out;
    },
    {
      prose: [...PROSE_SELECTORS],
      labels: LABEL_PARAGRAPHS.map((entry) => entry.selector),
      rows: ledger.filter((row) => row.check === 'weight').map((row) => ({ id: row.id, match: row.match })),
    }
  );

/** The `font-weight` range `contracts/fonts.css` publishes for `family`, or null when it is not a contract face. */
const publishedWeightRange = (family: string, fontsCss: string): [number, number] | null => {
  for (const face of fontsCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const declared = /font-family\s*:\s*([^;]+)/.exec(face[1])?.[1].trim().replace(/^["']|["']$/g, '');
    if (declared !== family) continue;
    const weight = /font-weight\s*:\s*([^;]+)/.exec(face[1])?.[1].trim();
    if (!weight) return null;
    const parts = weight.split(/\s+/).map(Number);
    if (parts.some(Number.isNaN)) return null;
    return [parts[0], parts[parts.length - 1]];
  }
  return null;
};

/** The type thresholds, resolved on the page. */
interface TypeFloor {
  readonly t3xs: number;
  readonly t2xs: number;
  readonly tSm: number;
}

const typeFloor = async (page: Page): Promise<TypeFloor> => ({
  t3xs: pxOf(await probeComputed(page, 'font-size:var(--t-3xs);', 'font-size'), '--t-3xs'),
  t2xs: pxOf(await probeComputed(page, 'font-size:var(--t-2xs);', 'font-size'), '--t-2xs'),
  tSm: pxOf(await probeComputed(page, 'font-size:var(--t-sm);', 'font-size'), '--t-sm'),
});

interface TypeVerdict {
  readonly findings: string[];
  /** Elements whose family the contract does not publish, listed rather than judged on weight. */
  readonly offContract: string[];
  /** Synthesised weights, per ledger row id, plus the ones no row claims. */
  readonly synthesised: Map<string, number>;
  readonly unclaimed: string[];
}

/**
 * The type verdict on one route. Pure, so a fabricated read can drive it.
 */
const typeVerdict = (
  route: string,
  reads: readonly TextRead[],
  floor: TypeFloor,
  fontsCss: string,
  ledger: readonly Exemption[]
): TypeVerdict => {
  const findings: string[] = [];
  const offContract: string[] = [];
  const synthesised = new Map<string, number>();
  const unclaimed: string[] = [];
  for (const read of reads) {
    const where = `${route}: ${read.at} ("${read.text}")`;
    if (read.fontSize < floor.t3xs - SIZE_SLACK) {
      findings.push(`${where} computes font-size ${read.fontSize}px, under --t-3xs (${floor.t3xs}px), which nothing may go below`);
    }
    if (read.tag === 'p' && read.label === null && read.fontSize < floor.t2xs - SIZE_SLACK) {
      findings.push(`${where} is a paragraph at ${read.fontSize}px, under --t-2xs (${floor.t2xs}px)`);
    }
    if (read.prose && read.fontSize < floor.tSm - SIZE_SLACK) {
      findings.push(`${where} is prose at ${read.fontSize}px, under the --t-sm body floor (${floor.tSm}px)`);
    }
    if (read.fontStyle === 'italic' || read.fontStyle.startsWith('oblique')) {
      findings.push(`${where} computes font-style ${read.fontStyle}, and no face in the contract has an italic`);
    }
    const range = publishedWeightRange(read.family, fontsCss);
    if (range === null) {
      offContract.push(`${where} is set in "${read.family}", which contracts/fonts.css does not publish`);
      continue;
    }
    if (read.fontWeight > range[1]) {
      const rows = ledger.filter((row) => row.check === 'weight' && read.matchedIds.includes(row.id));
      if (rows.length === 0) {
        unclaimed.push(`${where} asks "${read.family}" for weight ${read.fontWeight}, above its published ${range[0]} ${range[1]}, and no ledger row claims it`);
      }
      for (const row of rows) synthesised.set(row.id, (synthesised.get(row.id) ?? 0) + 1);
    }
  }
  return { findings, offContract, synthesised, unclaimed };
};

/** Every `font-size` under `app/` and `components/` whose value carries `px`, by path and line. */
const pxFontSizes = (): string[] => {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path);
        continue;
      }
      if (!entry.name.endsWith('.scss')) continue;
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');
      source.split('\n').forEach((line, index) => {
        if (/font-size\s*:[^;]*\d(px)\b/.test(line)) found.push(`${path.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')}:${index + 1} ${line.trim()}`);
      });
    }
  };
  for (const root of ['app', 'components']) walk(join(REPO_ROOT, root));
  return found;
};

// ---------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------

test.describe('the accessibility floor', () => {
  test('sweeps every route app/ serves, and the ledger is well formed before anything is measured', () => {
    const onDisk = routesOnDisk(join(REPO_ROOT, 'app'));
    expect(onDisk.length, 'no route was derived from app/, so the sweep below is over nothing').toBeGreaterThan(0);
    expect(onDisk, 'the derived route set no longer carries the home route').toContain('/');
    expect(onDisk, 'the derived route set no longer carries the 404 surface').toContain(NOT_FOUND);
    expect(onDisk, 'the walk no longer finds a route handler').toContain('/api/health');
    expect(SURFACES.map((surface) => surface.route)).toEqual(onDisk.filter((route) => route !== '/api/health'));
    expect(SURFACES.length, 'fewer than two Hub surfaces, so the sweep is not universal').toBeGreaterThan(1);

    expect(EXEMPTIONS.length, 'the ledger is empty, so the tally exempts nothing').toBeGreaterThan(0);
    expect(new Set(EXEMPTIONS.map((row) => row.id)).size, 'two rows share an id').toBe(EXEMPTIONS.length);
    for (const row of EXEMPTIONS) {
      expect(row.closedBy, `"${row.id}" names no closing story`).toMatch(/^Story \d+-\d+$/);
      expect(row.source, `"${row.id}" does not match SOURCE_SHAPE`).toMatch(SOURCE_SHAPE);
      expect(row.count, `"${row.id}" claims no occurrence`).toBeGreaterThan(0);
      expect(existsSync(join(REPO_ROOT, row.source.split(':')[0])), `"${row.id}" names ${row.source}, which is not on disk`).toBe(true);
      if (row.check === 'z-index') expect(row.match, `"${row.id}" is a z-index row whose match is not an integer`).toMatch(/^-?\d+$/);
      if (row.check === 'depth') {
        expect([...DEPTH_PROPERTIES, ...DEPTH_FUNCTIONS] as readonly string[], `"${row.id}" names a depth tell this sweep does not count`).toContain(row.match);
      }
    }
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx:7')).toBe(true);
    expect(SOURCE_SHAPE.test('app/app.scss:118-121')).toBe(true);
    expect(SOURCE_SHAPE.test('components/organisms/WorkHero/WorkHero.scss:15,40')).toBe(true);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx')).toBe(false);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/logo.css:7')).toBe(false);
  });

  test('every interactive element on every route paints the ring under Tab, in DOM order, on a contrasting ground, and nothing under the mouse', async ({
    page,
  }) => {
    const ring: string[] = [];
    const traversal: string[] = [];
    const contrast: string[] = [];
    const mouse: string[] = [];
    const summary: string[] = [];
    /** Per token ground, the first element read on it. */
    const groundsRead = new Map<string, string>();
    const otherGrounds: string[] = [];
    let stopsRead = 0;
    let hoveredInRun = 0;
    let linksClicked = 0;
    let buttonsClicked = 0;

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);
      expect(page.viewportSize(), `${surface.route} was not measured at the pinned viewport`).toEqual({ ...RENDERED_VIEWPORT });

      const contract = await ringContract(page);
      // Focus and hover are different tokens, on every route, or a keyboard visitor cannot tell them apart.
      const [focusRgb, hoverRgb, accentRgb] = await rasterise(page, [contract.colour, contract.hover, contract.accent]);
      for (const [pair, a, b] of [
        ['--token-focus and --token-accent-hover', focusRgb, hoverRgb],
        ['--token-focus and --token-accent', focusRgb, accentRgb],
        ['--token-accent-hover and --token-accent', hoverRgb, accentRgb],
      ] as const) {
        expect(a, `${surface.route}: ${pair} compute to the same colour, so focus and hover are one signal`).not.toBe(b);
      }

      const { tabbables, positives } = await tagTabbables(page);
      const stops: Stop[] = [];
      for (let index = 0; index < tabbables.length; index += 1) {
        await page.keyboard.press('Tab');
        stops.push(await readStop(page));
      }
      await page.keyboard.press('Tab');
      const afterLast = await readStop(page);
      traversal.push(...traversalVerdict(surface.route, tabbables, stops, afterLast, positives));

      for (const stop of stops) {
        if (stop.index === null) continue;
        stopsRead += 1;
        ring.push(...ringFindings(surface.route, stop, contract));
        if (stop.groundColour === '') {
          contrast.push(`${surface.route}: ${stop.at} sits over nothing painted between it and the root`);
          continue;
        }
        const [ringRgb, groundRgb] = await rasterise(page, [stop.outlineColor, stop.groundColour]);
        const token = GROUND_TOKENS.find((name) => contract.grounds[name] === groundRgb) ?? null;
        const measured = ratio(ringRgb, groundRgb);
        const reading =
          `${surface.route} ${stop.at} on ${stop.groundColour} [${groundRgb}] at ${stop.groundAt}` +
          (token ? ` (${token})` : ' (none of the three token grounds)') +
          (stop.groundImage ? `, beneath an image at ${stop.groundImage}` : '') +
          `: ${measured.toFixed(2)}:1`;
        if (token && !groundsRead.has(token)) groundsRead.set(token, reading);
        if (!token && !otherGrounds.some((line) => line.startsWith(`${surface.route} `) && line.includes(stop.groundColour))) otherGrounds.push(reading);
        if (measured < RING_CONTRAST_FLOOR) {
          contrast.push(`${reading}: the ring contrasts ${measured.toFixed(2)}:1, under the ${RING_CONTRAST_FLOOR}:1 non-text floor`);
        }
      }

      summary.push(
        `${surface.route}: ${tabbables.length} tabbables, ${stops.filter((stop) => stop.index !== null).length} stops read, ` +
          `${positives.length} positive tabindex; ring ${contract.width} solid ${contract.colour} [${focusRgb}] at ${contract.offset}` +
          (stops[0] ? `, first stop transition-property "${stops[0].transitionProperty}" over "${stops[0].transitionDuration}"` : '')
      );

      // The mouse, on every element: hovered, no ring. An element the pointer cannot reach at all is
      // recorded as such and has to be the skip-link, which is parked above the viewport by design.
      const unreachable: string[] = [];
      let hovered = 0;
      for (const tabbable of tabbables) {
        const target = page.locator(`[${TAG}="${tabbable.index}"]`);
        await target.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
        const box = await target.boundingBox();
        const inside =
          box !== null &&
          box.x + box.width / 2 >= 0 &&
          box.x + box.width / 2 <= RENDERED_VIEWPORT.width &&
          box.y + box.height / 2 >= 0 &&
          box.y + box.height / 2 <= RENDERED_VIEWPORT.height;
        if (!box || !inside) {
          unreachable.push(tabbable.at);
          continue;
        }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const read = await target.evaluate((node) => ({
          hover: node.matches(':hover'),
          outlineStyle: window.getComputedStyle(node).outlineStyle,
        }));
        hovered += 1;
        if (!read.hover) mouse.push(`${surface.route}: ${tabbable.at} did not match :hover with the pointer over it, so the hover reading below it is of nothing`);
        if (read.outlineStyle !== 'none') mouse.push(`${surface.route}: ${tabbable.at} paints outline-style ${read.outlineStyle} under the pointer`);
      }
      await page.mouse.move(0, 0);
      expect(
        unreachable.filter((at) => !at.endsWith('a.skip-link')),
        `${surface.route}: an element the pointer could not be put over is not the skip-link`
      ).toEqual([]);
      hoveredInRun += hovered;
      // `/celeste` renders zero visible controls by design (`tests/e2e/secondary-surfaces.pw.ts`),
      // so a route with no tabbable has nothing to hover or click and the two claims are made on
      // the run as a whole below rather than per route.
      if (tabbables.length === 0) continue;
      expect(hovered, `${surface.route}: nothing was hovered, so the mouse half of the ring claim is over nothing`).toBeGreaterThan(0);

      // One click per route on a link, navigation prevented at the capture phase, and on a button
      // where one exists: focus lands by mouse, `:focus-visible` does not match, nothing is painted.
      await page.evaluate(() => {
        document.addEventListener('click', (event) => event.preventDefault(), true);
      });
      const clickable = await page.evaluate(
        ({ tag, selector }) =>
          [...document.querySelectorAll(`[${tag}]`)]
            .filter((node) => node.matches(selector) && !node.classList.contains('skip-link'))
            .map((node) => node.getAttribute(tag))
            .slice(0, 1),
        { tag: TAG, selector: 'a[href]' }
      );
      const buttons = await page.evaluate(
        ({ tag, selector }) =>
          [...document.querySelectorAll(`[${tag}]`)].filter((node) => node.matches(selector)).map((node) => node.getAttribute(tag)).slice(0, 1),
        { tag: TAG, selector: 'button' }
      );
      expect(clickable.length, `${surface.route} carries no link to click, so the click half of the claim is over nothing`).toBe(1);
      const before = new URL(page.url()).pathname;
      for (const index of [...clickable, ...buttons]) {
        const target = page.locator(`[${TAG}="${index}"]`);
        await target.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
        const box = await target.boundingBox();
        expect(box, `${surface.route}: the element to click has no box`).not.toBeNull();
        if (!box) continue;
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const landed = await page.evaluate(
          ({ wanted, tag }) => {
            const active = document.activeElement;
            return {
              isTarget: active?.getAttribute(tag) === wanted,
              focusVisible: active?.matches(':focus-visible') ?? false,
              outlineStyle: active ? window.getComputedStyle(active).outlineStyle : '',
              at: active?.tagName.toLowerCase() ?? '(nothing)',
            };
          },
          { wanted: index, tag: TAG }
        );
        const clicked = await target.evaluate((node) => node.tagName.toLowerCase());
        if (!landed.isTarget) mouse.push(`${surface.route}: a click on the ${clicked} left focus on ${landed.at} rather than on it, so the click reading is of something else`);
        if (landed.focusVisible) mouse.push(`${surface.route}: the ${clicked} matches :focus-visible after a mouse click`);
        if (landed.outlineStyle !== 'none') mouse.push(`${surface.route}: the ${clicked} paints outline-style ${landed.outlineStyle} after a mouse click`);
        clicked === 'button' ? (buttonsClicked += 1) : (linksClicked += 1);
      }
      expect(new URL(page.url()).pathname, `${surface.route}: the prevented click navigated anyway`).toBe(before);
    }
    expect(hoveredInRun, 'nothing was hovered on any route, so the mouse half of the ring claim is over nothing').toBeGreaterThan(0);
    expect(linksClicked, 'no link was clicked on any route').toBeGreaterThan(0);
    expect(buttonsClicked, 'no button was clicked on any route, and the timeline renders four').toBeGreaterThan(0);

    // A ground no shipped element sits on is read on a planted control, labelled as such, so the
    // ring's visibility is known on all three (`ops/cs-tracker-accessibility-probe.mjs:1062-1095`).
    const planted: string[] = [];
    for (const token of GROUND_TOKENS) {
      if (groundsRead.has(token)) continue;
      await goTo(page, NOT_FOUND, 404);
      await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
      const contract = await ringContract(page);
      await page.evaluate((ground) => {
        const wrap = document.createElement('div');
        wrap.setAttribute('data-cuatro-planted', ground);
        wrap.style.cssText = `background-color: var(${ground}); padding: 16px;`;
        const link = document.createElement('a');
        link.href = '#planted-ground';
        link.id = 'planted-ground-control';
        link.textContent = 'planted control';
        wrap.append(link);
        document.body.append(wrap);
      }, token);
      const control = page.locator('#planted-ground-control');
      expect(await tabTo(page, control), `the control planted on ${token} was never reached by Tab`).toBe(true);
      await tagTabbables(page);
      const stop = await readStop(page);
      ring.push(...ringFindings(`${NOT_FOUND} (planted on ${token})`, stop, contract));
      const [ringRgb, groundRgb] = await rasterise(page, [stop.outlineColor, stop.groundColour]);
      expect(groundRgb, `the planted wrapper does not paint ${token}`).toBe(contract.grounds[token]);
      const measured = ratio(ringRgb, groundRgb);
      const reading = `${NOT_FOUND} a#planted-ground-control on ${stop.groundColour} (${token}) [planted]`;
      groundsRead.set(token, reading);
      planted.push(`${token}: ${measured.toFixed(2)}:1 on a planted control`);
      if (measured < RING_CONTRAST_FLOOR) contrast.push(`${reading}: the ring contrasts ${measured.toFixed(2)}:1, under the ${RING_CONTRAST_FLOOR}:1 floor`);
    }

    console.log(
      `accessibility-floor: ${summary.join('; ')}\n` +
        `grounds: ${GROUND_TOKENS.map((token) => `${token} -> ${groundsRead.get(token) ?? '(unread)'}`).join('\n  ')}\n` +
        `other grounds: ${otherGrounds.join('; ') || 'none'}\n` +
        `planted: ${planted.join('; ') || 'none'}`
    );

    expect(stopsRead, 'no Tab stop was read on any route, so every claim below is over nothing').toBeGreaterThan(0);
    expect(traversal, `Tab does not traverse the visible tabbables in DOM order:\n${traversal.join('\n')}\n\n${summary.join('\n')}`).toEqual([]);
    expect(ring, `A-1: an interactive element does not paint the standard ring under Tab:\n${ring.join('\n')}\n\n${summary.join('\n')}`).toEqual([]);
    expect(contrast, `A-1: the ring does not clear ${RING_CONTRAST_FLOOR}:1 against a ground it sits on:\n${contrast.join('\n')}`).toEqual([]);
    expect(mouse, `the mouse paints a ring, or a click was read on the wrong element:\n${mouse.join('\n')}`).toEqual([]);
    for (const token of GROUND_TOKENS) {
      expect(groundsRead.get(token), `${token} was read on no element, shipped or planted`).toBeDefined();
    }
  });

  test('the skip control on the animated door is a Tab stop and paints the ring', async ({ browser }) => {
    // The project runs `reducedMotion: 'reduce'`, the non-3D door, where `HomeLayout` renders no
    // skip control at all. The control exists on the default door only, so it is read on a context
    // that has not asked for reduced motion, the way `tests/e2e/front-door.pw.ts:259-275` opens it.
    const context = await browser.newContext({
      viewport: { ...RENDERED_VIEWPORT },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    try {
      const page = await context.newPage();
      await goTo(page, '/');
      await expect
        .poll(() => page.evaluate(() => document.querySelector('.skip-control') !== null), {
          timeout: 20_000,
          message: 'the animated door rendered no .skip-control, so the case has nothing to read',
        })
        .toBe(true);
      const contract = await ringContract(page);
      const control = page.locator('.skip-control');
      expect(await tabTo(page, control, 10), 'the skip control is not among the first ten Tab stops on the animated door').toBe(true);
      await tagTabbables(page);
      const stop = await readStop(page);
      expect(stop.at, 'the focused element is not the skip control').toContain('skip-control');
      expect(ringFindings('/ (animated door)', stop, contract), 'the skip control does not paint the standard ring').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('every z-index literal, shadow and gradient in the built CSS is claimed by a ledger row, and every row is claimed back', () => {
    const styles = builtStyles();
    const layers = contractLayers();
    expect(layers.length, 'the contract declares no layer, so the z-index sweep has no names').toBeGreaterThan(0);
    const verdict = tally(styles, EXEMPTIONS, layers);
    console.log(
      `accessibility-floor: ${styles.length} built stylesheets, ${layers.length} contract layers (${layers.join(', ')}), ` +
        `observed ${[...verdict.observed].map(([key, count]) => `${key} x${count}`).join(', ') || 'nothing'}`
    );
    expect(verdict.unknownLayers, 'the built CSS reads a layer the contract does not declare').toEqual([]);
    expect(verdict.unlisted, `a z-index literal or depth tell ships that no ledger row claims:\n${verdict.unlisted.join('\n')}`).toEqual([]);
    expect(verdict.stale, `a ledger row claims what the built CSS no longer carries:\n${verdict.stale.join('\n')}`).toEqual([]);
    expect(verdict.mismatched, `a ledger row's count is not what the built CSS carries:\n${verdict.mismatched.join('\n')}`).toEqual([]);
    // At least one literal and one tell were observed, or the two agreeing lists are empty ones.
    expect(verdict.observed.size, 'the tally observed nothing, so agreement with the ledger means nothing').toBeGreaterThan(0);
  });

  test('every visible text on every route clears the type floor, and nothing autoplays', async ({ page }) => {
    const fontsCss = readFileSync(FONTS_CSS, 'utf8');
    const findings: string[] = [];
    const unclaimed: string[] = [];
    const offContract = new Set<string>();
    const autoplay: string[] = [];
    const synthesised = new Map<string, number>();
    const labelsSeen = new Set<string>();
    let elementsRead = 0;
    let floor: TypeFloor | null = null;

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);
      const routeFloor = await typeFloor(page);
      if (floor === null) floor = routeFloor;
      expect(routeFloor, `the type scale resolves differently on ${surface.route}`).toEqual(floor);

      const reads = await readText(page, EXEMPTIONS);
      elementsRead += reads.length;
      for (const read of reads) if (read.label !== null && read.tag === 'p') labelsSeen.add(read.label);
      const verdict = typeVerdict(surface.route, reads, floor, fontsCss, EXEMPTIONS);
      findings.push(...verdict.findings);
      unclaimed.push(...verdict.unclaimed);
      for (const line of verdict.offContract) offContract.add(line.replace(/ \("[^"]*"\)/, ''));
      for (const [id, count] of verdict.synthesised) synthesised.set(id, (synthesised.get(id) ?? 0) + count);

      autoplay.push(
        ...(await page.evaluate(() =>
          [...document.querySelectorAll('video, audio, marquee, meta[http-equiv="refresh" i], [autoplay]')].map(
            (node) => `${window.location.pathname}: ${node.outerHTML.slice(0, 80)}`
          )
        ))
      );
    }

    console.log(
      `accessibility-floor: ${elementsRead} text elements read; off-contract families:\n  ${[...offContract].join('\n  ') || 'none'}\n` +
        `synthesised weights: ${[...synthesised].map(([id, count]) => `${id} x${count}`).join(', ') || 'none'}`
    );

    expect(elementsRead, 'no text element was read on any route, so the floor is asserted over nothing').toBeGreaterThan(0);
    expect(findings, `A-11, A-12 or DR45: a visible text is under the floor, italic, or otherwise off the scale:\n${findings.join('\n')}`).toEqual([]);
    expect(unclaimed, `a synthesised weight ships that no ledger row claims:\n${unclaimed.join('\n')}`).toEqual([]);

    // The weight rows, both directions: a row that matched nothing is stale, and a count that moved is a count to move in both files.
    const drift: string[] = [];
    for (const row of EXEMPTIONS.filter((entry) => entry.check === 'weight')) {
      const count = synthesised.get(row.id) ?? 0;
      if (count === 0) drift.push(`"${row.id}" (${row.match}) matched no synthesised weight on any route: the row is stale, delete it here and in ops/hub-accessibility-pass.md`);
      else if (count !== row.count) drift.push(`"${row.id}" (${row.match}) covers ${count} synthesised weights across the routes and the ledger says ${row.count}`);
    }
    expect(drift, `the weight ledger no longer describes what the sweep read:\n${drift.join('\n')}`).toEqual([]);

    // The label exception cannot outlive the elements it excuses.
    for (const entry of LABEL_PARAGRAPHS) {
      expect(labelsSeen.has(entry.selector), `${entry.selector} (${entry.at}) matched no visible paragraph on any route, so its exception is dead weight`).toBe(true);
    }

    expect(autoplay, `A-16: something autoplays or auto-advances:\n${autoplay.join('\n')}`).toEqual([]);
    // The autoplay selector, on a planted control, so an empty result is a measurement.
    await page.setContent('<html><body><p>x</p><video autoplay muted></video><meta http-equiv="Refresh" content="5"></body></html>');
    expect(
      await page.evaluate(() => document.querySelectorAll('video, audio, marquee, meta[http-equiv="refresh" i], [autoplay]').length),
      'the autoplay selector matched neither a planted video nor a planted refresh'
    ).toBe(2);
  });

  test('no stylesheet under app/ or components/ sets font-size in px', () => {
    const written = pxFontSizes();
    expect(written, `A-12: type is sized in px, so it does not respect the reader's font size:\n${written.join('\n')}`).toEqual([]);
    // The scan, on planted lines, so an empty result is a measurement rather than a regex that stopped matching.
    const scan = (line: string): boolean => /font-size\s*:[^;]*\d(px)\b/.test(line);
    expect(scan('  font-size: 12px;')).toBe(true);
    expect(scan('  font-size: clamp(1rem, 2vw, 18px);')).toBe(true);
    expect(scan('  font-size: var(--t-sm);')).toBe(false);
    expect(scan('  font-size: 12pt;')).toBe(false);
    expect(scan('  padding: 12px;')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // The planted controls. Every predicate above, seen firing.
  // -------------------------------------------------------------------------

  test('with the ring taken off, the sweep names every element on the route with the five values', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    const contract = await ringContract(page);
    await page.addStyleTag({ content: ':focus-visible { outline: none !important; transition: outline 200ms !important; }' });
    const { tabbables } = await tagTabbables(page);
    expect(tabbables.length, 'the 404 carries no tabbable, so nothing can be named').toBeGreaterThan(0);
    const named: string[] = [];
    for (let index = 0; index < tabbables.length; index += 1) {
      await page.keyboard.press('Tab');
      const stop = await readStop(page);
      const found = ringFindings(NOT_FOUND, stop, contract);
      expect(found.some((line) => /paints no solid ring/.test(line)), `${stop.at} was not reported for the missing ring`).toBe(true);
      expect(found.some((line) => /transitions its outline/.test(line)), `${stop.at} was not reported for the planted transition`).toBe(true);
      for (const line of found) {
        expect(line).toContain(NOT_FOUND);
        expect(line).toContain(stop.at);
        expect(line).toMatch(/outline-style .*outline-width .*outline-color .*outline-offset .*transition-property/);
      }
      named.push(stop.at);
    }
    expect(new Set(named).size, 'the control did not name every element on the route').toBe(tabbables.length);
  });

  test('a planted positive tabindex fails the traversal, naming it', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    await page.evaluate(() => {
      const planted = document.createElement('a');
      planted.href = '#';
      planted.id = 'planted-positive-tabindex';
      planted.setAttribute('tabindex', '1');
      planted.textContent = 'planted';
      document.body.append(planted);
    });
    const { tabbables, positives } = await tagTabbables(page);
    expect(positives, 'the planted tabindex was not read as positive').toHaveLength(1);
    const stops: Stop[] = [];
    for (let index = 0; index < tabbables.length; index += 1) {
      await page.keyboard.press('Tab');
      stops.push(await readStop(page));
    }
    await page.keyboard.press('Tab');
    const verdict = traversalVerdict(NOT_FOUND, tabbables, stops, await readStop(page), positives);
    expect(verdict.some((line) => /planted-positive-tabindex.*positive tabindex/.test(line)), `the positive tabindex was not named:\n${verdict.join('\n')}`).toBe(true);
    expect(verdict.some((line) => /Tab number 1 landed on .*a#planted-positive-tabindex/.test(line)), `the reordered first stop was not named:\n${verdict.join('\n')}`).toBe(true);

    // And the pure verdict, on fabricated sequences, in each direction it can fail.
    const a: Tabbable = { index: 0, at: 'body > a.first', text: 'first' };
    const b: Tabbable = { index: 1, at: 'body > a.second', text: 'second' };
    const stopFor = (tabbable: Tabbable | null): Stop => ({
      index: tabbable?.index ?? null,
      at: tabbable?.at ?? 'body',
      text: tabbable?.text ?? '',
      outlineStyle: 'solid',
      outlineWidth: '',
      outlineColor: '',
      outlineOffset: '',
      transitionProperty: 'all',
      transitionDuration: '0s',
      focusVisible: true,
      groundColour: '',
      groundImage: '',
      groundAt: '',
    });
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(null), [])).toEqual([]);
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(a), [])).toEqual([]);
    expect(traversalVerdict('/x', [a, b], [stopFor(b), stopFor(a)], stopFor(null), [])[0]).toMatch(/Tab number 1 landed on body > a.second/);
    expect(traversalVerdict('/x', [a, b], [stopFor(a)], stopFor(null), [])[0]).toMatch(/Tab number 2 landed on nothing/);
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(b), [])[0]).toMatch(/Tab number 3 stayed inside the document/);
    expect(traversalVerdict('/x', [a], [stopFor(a)], stopFor(null), ['body > a.third (tabindex=2)'])[0]).toMatch(/positive tabindex/);
  });

  test('the tally names an unlisted value, a stale row and a count that moved, on fabricated CSS', () => {
    const rows: Exemption[] = [
      { id: 'z-one', check: 'z-index', match: '20', count: 1, source: 'components/x/X.scss:1', closedBy: 'Story 9-99' },
      { id: 'shadow-one', check: 'depth', match: 'box-shadow', count: 2, source: 'components/x/X.scss:2', closedBy: 'Story 9-99' },
      { id: 'weight-one', check: 'weight', match: '.x', count: 1, source: 'components/x/X.scss:3', closedBy: 'Story 9-99' },
    ];
    const layers = ['--z-raised', '--z-sticky'];
    const css = (text: string) => [{ name: 'planted.css', text }];

    const healthy = tally(css('.a{z-index:20}.b{box-shadow:0 0 1px red}.c{box-shadow:none;z-index:var(--z-sticky)}'), rows, layers);
    expect(healthy.unlisted).toEqual([]);
    expect(healthy.stale).toEqual([]);
    expect(healthy.mismatched).toEqual([]);
    expect(healthy.unknownLayers).toEqual([]);
    expect([...healthy.observed]).toEqual([
      ['z-index=20', 1],
      ['depth=box-shadow', 2],
    ]);

    const unlisted = tally(css('.a{z-index:20}.b{box-shadow:0 0 1px red;box-shadow:none}.d{z-index:7;background:radial-gradient(red,blue)}'), rows, layers);
    expect(unlisted.unlisted).toEqual([
      'depth=radial-gradient occurs 1 time(s) in the built CSS and no ledger row claims it',
      'z-index=7 occurs 1 time(s) in the built CSS and no ledger row claims it',
    ]);

    const stale = tally(css('.b{box-shadow:0 0 1px red;box-shadow:none}'), rows, layers);
    expect(stale.stale).toEqual(['"z-one" claim z-index=20 and the built CSS carries none: the row is stale, delete it here and in ops/hub-accessibility-pass.md']);

    const moved = tally(css('.a{z-index:20}.b{box-shadow:0 0 1px red}'), rows, layers);
    expect(moved.mismatched).toEqual(['"shadow-one" claim 2 occurrence(s) of depth=box-shadow and the built CSS carries 1']);

    // Two rows sharing a match sum their counts; `var(--z-*)` is never a literal; a layer the
    // contract does not declare is named; `repeating-linear-gradient(` is not a `linear-gradient(`.
    const shared: Exemption[] = [
      { ...rows[0], id: 'z-a', count: 2 },
      { ...rows[0], id: 'z-b', count: 1 },
    ];
    expect(tally(css('.a{z-index:20}.b{z-index:20}.c{z-index:20}'), shared, layers).mismatched).toEqual([]);
    expect(tally(css('.a{z-index:20}.b{z-index:20}'), shared, layers).mismatched).toEqual([
      '"z-a" and "z-b" claim 3 occurrence(s) of z-index=20 and the built CSS carries 2',
    ]);
    expect(tally(css('.a{z-index:var(--z-tooltip)}'), [], layers).unknownLayers).toEqual([
      'planted.css reads z-index: var(--z-tooltip), which contracts/tokens.css does not declare',
    ]);
    expect([...tally(css('.a{background:repeating-linear-gradient(red,blue)}'), [], layers).observed]).toEqual([['depth=repeating-linear-gradient', 1]]);

    // And nothing observed makes every z-index and depth row stale; the weight row is not this tally's.
    expect(tally([], rows, layers).stale.length, 'an empty stylesheet list did not make every row stale').toBe(2);
  });

  test('an empty or absent build throws naming the directory, never passing over nothing', () => {
    // The real build is read by the tally above. The two refusals are exercised on directories
    // this case makes: one that holds no `.css`, and one that is not there at all.
    const empty = mkdtempSync(join(tmpdir(), 'accessibility-floor-empty-'));
    try {
      writeFileSync(join(empty, 'chunk.js'), '');
      expect(() => builtStyles(empty)).toThrow(/holds no \.css file/);
      expect(() => builtStyles(empty)).toThrow(empty);
      const absent = join(empty, 'not-there');
      expect(() => builtStyles(absent)).toThrow(/is not there/);
      // And a directory holding one stylesheet is read whole, subdirectories included.
      mkdirSync(join(empty, 'nested'));
      writeFileSync(join(empty, 'nested', 'one.css'), '.a{z-index:1}');
      expect(builtStyles(empty).map((style) => style.text)).toEqual(['.a{z-index:1}']);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test('a planted text under the floor, an italic and a synthesised weight are named by the type sweep', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    const floor = await typeFloor(page);
    const fontsCss = readFileSync(FONTS_CSS, 'utf8');
    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.id = 'planted-type';
      wrap.innerHTML =
        '<p id="planted-under-floor" style="font-size:calc(var(--t-3xs) - 1px)">under the floor</p>' +
        '<p id="planted-small-paragraph" style="font-size:calc(var(--t-2xs) - 1px)">small paragraph</p>' +
        '<p id="planted-small-prose" class="error-page__sub" style="font-size:calc(var(--t-sm) - 1px)">small prose</p>' +
        '<span id="planted-italic" style="font-style:italic">italic</span>' +
        '<span id="planted-bold-mono" style="font-family:var(--f-mono);font-weight:700">bold mono</span>' +
        '<span id="planted-off-contract" style="font-family:Papyrus, fantasy;font-weight:900">off contract</span>';
      document.body.append(wrap);
    });
    const reads = await readText(page, EXEMPTIONS);
    const verdict = typeVerdict(NOT_FOUND, reads, floor, fontsCss, EXEMPTIONS);
    const about = (id: string) => verdict.findings.filter((line) => line.includes(`#${id}`));
    expect(about('planted-under-floor').some((line) => /under --t-3xs/.test(line)), `the planted text under the floor was not named:\n${verdict.findings.join('\n')}`).toBe(true);
    expect(about('planted-small-paragraph').some((line) => /under --t-2xs/.test(line)), 'the planted small paragraph was not named').toBe(true);
    expect(about('planted-small-prose').some((line) => /under the --t-sm body floor/.test(line)), 'the planted small prose was not named').toBe(true);
    expect(about('planted-italic').some((line) => /font-style italic/.test(line)), 'the planted italic was not named').toBe(true);
    expect(verdict.unclaimed.some((line) => /planted-bold-mono.*above its published/.test(line)), 'the planted synthesised weight was not named').toBe(true);
    expect(verdict.offContract.some((line) => /planted-off-contract.*"Papyrus"/.test(line)), 'the off-contract family was not listed').toBe(true);
    expect(verdict.findings.filter((line) => /planted-off-contract/.test(line)), 'an off-contract family was judged on weight').toEqual([]);

    // The shipped surface underneath still reads clean, so the plants did not pass by disturbing it.
    expect(verdict.findings.filter((line) => !line.includes('#planted-')), 'the 404 itself carries a type finding').toEqual([]);

    // And the aria-hidden arm: the same plants inside a hidden subtree are never read.
    await page.evaluate(() => document.getElementById('planted-type')?.setAttribute('aria-hidden', 'true'));
    const hidden = await readText(page, EXEMPTIONS);
    expect(hidden.filter((read) => read.at.includes('#planted-')), 'a text inside an aria-hidden subtree was read').toEqual([]);

    // The weight-range parser, on the contract's own faces and a planted one.
    expect(publishedWeightRange('Geist Mono', fontsCss)).toEqual([400, 400]);
    expect(publishedWeightRange('Bricolage Grotesque', fontsCss)).toEqual([700, 800]);
    expect(publishedWeightRange('Papyrus', fontsCss)).toBeNull();
    expect(publishedWeightRange('Planted', '@font-face { font-family: "Planted"; font-weight: 100 900; }')).toEqual([100, 900]);
  });
});
