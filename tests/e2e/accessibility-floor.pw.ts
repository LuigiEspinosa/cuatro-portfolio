import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * The Hub's focus standard, DOM-order traversal, depth tells, z-levels, type floor, headings and
 * autoplay, measured in a real browser on every route the Hub serves (Story 2-26, AD-19).
 *
 * **What this file asserts, and where each claim comes from.**
 *
 *  1. **The ring, A-1** (`EXPERIENCE.md:711-722`, `RESTYLE-SPEC.md:322-352` § 4). Every
 *     interactive element on every route paints `--stroke-focus` solid `--token-focus` at
 *     `--focus-offset` when reached by Tab, with `:focus-visible` matched and no transition
 *     naming `outline` or `all` over a duration above zero; paints nothing under the mouse,
 *     hovered or clicked; contrasts at least 3:1 against the ground it sits over; and is not
 *     clipped by an ancestor's `clip-path` or `overflow`, nor by the viewport's edge, within the
 *     ring's reach. The three token grounds are each read at least once, a control planted and
 *     labelled where no shipped element sits on one. Focus and hover are different tokens. The
 *     `[tabindex="-1"]` landmarks the two skips move focus to ring on keyboard activation.
 *  2. **Traversal in DOM order** (`EXPERIENCE.md:739`). Tab from `body` visits exactly the
 *     tabbables in document order, the next Tab leaves the document or wraps, no `tabindex`
 *     computes above zero, and no focusable sits inside an `aria-hidden` subtree. On the animated
 *     door `.skip-control` is a stop and paints the ring.
 *  3. **The built CSS** (`epics.md:3053-3061`, UX-DR44). Every `z-index:<number>`, `box-shadow`,
 *     `text-shadow` and `*-gradient(` occurrence in `.next/static/chunks/*.css` is claimed by a
 *     ledger row and every row is claimed back, tallied per value, property or function. The
 *     `--z-*` names come from `contracts/tokens.css`, and an empty build throws rather than
 *     passing over nothing.
 *  4. **The type floor, A-11 and A-12** (`epics.md:3042-3051`, `DESIGN.md:461-502`). Nothing
 *     visible, generated text included, computes under `--t-3xs`; no paragraph under `--t-2xs`,
 *     the labels `DESIGN.md` places on `<p>` at the smallest step excepted by name; none of the
 *     six prose selectors under `--t-sm`; nothing italic; no weight above the family's published
 *     range except what the ledger carries; no stylesheet sets `font-size` or `font` in `px`; and
 *     no `:focus-visible` rule outside `app/app.scss` declares an `outline`.
 *  5. **One level-1 heading per document, A-7** (`EXPERIENCE.md:766`), read off the accessibility
 *     tree rather than the markup. Until Story 2-27 that was what told the home route's
 *     `GlitchText` wrapper, which carried the role, from its hidden `<h1>`; the heading is a real
 *     `<h1>` named by its own text now, and the tree is still the honest place to count.
 *  6. **Autoplay, A-16** (`EXPERIENCE.md:775`). No `video`, `audio`, `marquee`, refresh meta or
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
 * `tabTo` and `probeComputed` are the shapes `tests/e2e/hit-target-floor.pw.ts`, `cv.pw.ts` and
 * `secondary-surfaces.pw.ts` already carry. A `.pw.ts` imported by another registers its tests
 * twice, and `ops/__tests__/hit-target-floor.test.ts` pins `routesOnDisk` in that spec's own
 * text, so each spec keeps its own copy.
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

/** The one file allowed to declare the ring, and the one selector it may declare it on. */
const RING_FILE = 'app/app.scss';
const RING_SELECTOR = ':focus-visible';

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
 * floor therefore does not bind (Operator ruling of 2026-09-13, the spec's matrix row).
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
 * One breach the Hub ships today, of one of five kinds.
 *
 * `check` says which sweep the row belongs to and what `match` means there: for `z-index` the
 * literal value as written in the built CSS; for `depth` the property (`box-shadow`,
 * `text-shadow`) or gradient function (`linear-gradient`, `radial-gradient`,
 * `repeating-linear-gradient`, `conic-gradient`) as written; for `weight` a selector whose
 * elements compute a `font-weight` above their family's published range; for `clip` a selector
 * whose elements' ring is clipped by an ancestor or the viewport within its reach; for `heading`
 * a route whose accessibility tree carries a number of level-1 headings other than one. `count` is
 * an expectation: the sweep tallies occurrences per `match` and holds the sum of the rows' counts
 * equal to it in both directions, so a repaired site with its row left behind fails as stale and
 * no row can be vacuous. `closedBy` is the story whose redesign owns the file.
 */
interface Exemption {
  readonly id: string;
  readonly check: 'z-index' | 'depth' | 'weight' | 'clip' | 'heading';
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
  {
    id: 'clip-home-nav',
    check: 'clip',
    match: 'a.nav-link',
    count: 2,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:62',
    closedBy: 'Story 2-29',
  },
  {
    id: 'clip-home-contact',
    check: 'clip',
    match: '.contact-container a',
    count: 3,
    source: 'components/organisms/HomeLayout/HomeLayout.scss:69',
    closedBy: 'Story 2-29',
  },
  {
    id: 'clip-skip-link',
    check: 'clip',
    match: 'a.skip-link',
    count: 1,
    source: 'components/atoms/SkipLink/SkipLink.scss:33-34',
    closedBy: 'Story 2-32',
  },
  {
    id: 'heading-404',
    check: 'heading',
    match: '/a-route-that-does-not-exist',
    count: 1,
    source: 'components/organisms/ErrorPage/Error404.tsx:62-68',
    closedBy: 'Story 2-30',
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

/** The two in-page helpers every `evaluate` below reads, installed once per page by `goTo`. */
declare global {
  interface Window {
    cuatroA11y: {
      /** A stable, readable selector path for one element. */
      path: (node: Element) => string;
      /** The 2-8 visibility rule (`hit-target-floor.pw.ts:548-556`): removed from the tree, or no box. */
      hidden: (node: Element) => boolean;
    };
  }
}

const armed = new WeakSet<Page>();

/** Navigate, with the in-page helpers installed, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  if (!armed.has(page)) {
    armed.add(page);
    await page.addInitScript(() => {
      window.cuatroA11y = {
        path: (node) => {
          const parts: string[] = [];
          let current: Element | null = node;
          while (current && current !== document.documentElement) {
            let part = current.tagName.toLowerCase();
            if (current.id) part += `#${current.id}`;
            const classes = [...current.classList].join('.');
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
        },
        hidden: (node) => {
          if (node.closest('[aria-hidden="true"]')) return true;
          if (node.closest('[hidden]')) return true;
          if (node.getClientRects().length === 0) return true;
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return true;
          if (window.getComputedStyle(node).visibility === 'hidden') return true;
          return false;
        },
      };
    });
  }
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

/** Every file under `directory` with one of `extensions`, recursively, `__tests__` and `node_modules` left out. */
const filesUnder = (directory: string, extensions: readonly string[]): string[] =>
  (readdirSync(directory, { recursive: true }) as string[])
    .map((relative) => relative.replace(/\\/g, '/'))
    .filter((relative) => extensions.some((extension) => relative.endsWith(extension)))
    .filter((relative) => !relative.split('/').some((segment) => segment === '__tests__' || segment === 'node_modules'))
    .sort();

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
  const match = /^(-?[0-9]+(?:\.[0-9]+)?)px$/.exec(value.trim());
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

/** The four roles the ring rule names, each asserted declared on `:root` before any ring is read. */
const RING_ROLES = ['--stroke-focus', '--token-focus', '--focus-offset', '--r-hair'] as const;

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
  // The four roles, declared on `:root` before anything is resolved through them. A probe and an
  // element agree on `0px` for an undeclared offset, so "resolved to nothing" would never fire
  // below; the harness throws naming the role when it is not declared at all.
  for (const role of RING_ROLES) await rootCustomPropertyValue(page, role);
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
  expect(pxOf(width, '--stroke-focus'), '--stroke-focus resolves to no width, so no ring could be painted').toBeGreaterThan(0);
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
 * Tag every tabbable in DOM order and answer the list, plus every `[tabindex]` that computes above
 * zero and every focusable that sits inside an `aria-hidden` subtree.
 *
 * Tabbable is `INTERACTIVE` less what Tab cannot reach: a negative `tabIndex`, a `:disabled`
 * control, an `[inert]` subtree, and the box-less arms of the 2-8 visibility rule. An element
 * inside an `aria-hidden` subtree **is** reachable, so it stays in the expected order and is named
 * as its own finding: focus lands on something the accessibility tree does not have.
 */
const tagTabbables = async (page: Page): Promise<{ tabbables: Tabbable[]; positives: string[]; ariaHidden: string[] }> =>
  page.evaluate(
    ({ selector, tag }) => {
      const { path, hidden } = window.cuatroA11y;
      for (const stale of document.querySelectorAll(`[${tag}]`)) stale.removeAttribute(tag);
      const tabbables: { index: number; at: string; text: string }[] = [];
      const ariaHidden: string[] = [];
      for (const node of document.querySelectorAll(selector)) {
        if ((node as HTMLElement).tabIndex < 0 || node.matches(':disabled') || node.closest('[inert]')) continue;
        const boxless =
          node.closest('[hidden]') ||
          node.getClientRects().length === 0 ||
          window.getComputedStyle(node).visibility === 'hidden' ||
          (() => {
            const rect = node.getBoundingClientRect();
            return rect.width === 0 || rect.height === 0;
          })();
        if (boxless) continue;
        if (node.closest('[aria-hidden="true"]')) ariaHidden.push(path(node));
        const index = tabbables.length;
        node.setAttribute(tag, String(index));
        tabbables.push({ index, at: path(node), text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) });
      }
      const positives = [...document.querySelectorAll('[tabindex]')]
        .filter((node) => (node as HTMLElement).tabIndex > 0 && !hidden(node))
        .map((node) => `${path(node)} (tabindex=${node.getAttribute('tabindex')})`);
      return { tabbables, positives, ariaHidden };
    },
    { selector: INTERACTIVE, tag: TAG }
  );

/** What one Tab stop read: which tagged element holds focus, the ring quartet, the ground under it, and what clips it. */
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
  /**
   * Every side on which the ring cannot paint whole: an ancestor whose `clip-path` is not `none`
   * or whose `overflow` on that axis is not `visible`, with its clipping box within the ring's
   * reach (`outline-offset` plus `outline-width`) of the element's box, or the document's own edge
   * that close. Named `side by ancestor` or `side by the viewport`.
   */
  readonly clipped: readonly string[];
  /** The ids of the `clip` ledger rows whose selector this element matches. */
  readonly clipRowIds: readonly string[];
}

const EMPTY_STOP: Stop = {
  index: null,
  at: '(nothing)',
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
  clipped: [],
  clipRowIds: [],
};

const readStop = async (page: Page, ledger: readonly Exemption[] = EXEMPTIONS): Promise<Stop> => {
  const read = await page.evaluate(
    ({ tag, clipRows }) => {
      const { path } = window.cuatroA11y;
      const active = document.activeElement;
      if (!active) return null;
      if (active === document.body) return 'body';
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

      // What clips the ring. The reach is the offset plus the stroke, read off the element itself.
      const px = (value: string): number => Number.parseFloat(value) || 0;
      const reach = px(style.outlineOffset) + px(style.outlineWidth);
      const box = active.getBoundingClientRect();
      const clipped: string[] = [];
      for (let node = active.parentElement; node !== null; node = node.parentElement) {
        // `html` and `body` hand their overflow to the viewport, which the edge read below covers.
        if (node === document.body || node === document.documentElement) continue;
        const ancestor = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        // `clip-path` clips to the border box by default; `overflow` clips to the padding box.
        const clipsAll = ancestor.clipPath !== 'none';
        const clipsX = ancestor.overflowX !== 'visible';
        const clipsY = ancestor.overflowY !== 'visible';
        if (!clipsAll && !clipsX && !clipsY) continue;
        const inset = clipsAll
          ? { top: 0, right: 0, bottom: 0, left: 0 }
          : { top: px(ancestor.borderTopWidth), right: px(ancestor.borderRightWidth), bottom: px(ancestor.borderBottomWidth), left: px(ancestor.borderLeftWidth) };
        const sides: [string, number, boolean][] = [
          ['top', box.top - (rect.top + inset.top), clipsAll || clipsY],
          ['bottom', rect.bottom - inset.bottom - box.bottom, clipsAll || clipsY],
          ['left', box.left - (rect.left + inset.left), clipsAll || clipsX],
          ['right', rect.right - inset.right - box.right, clipsAll || clipsX],
        ];
        for (const [side, distance, clips] of sides) {
          if (clips && distance < reach) clipped.push(`${side} by ${path(node)} (${clipsAll ? `clip-path ${ancestor.clipPath.slice(0, 40)}` : `overflow ${ancestor.overflow}`}, ${distance.toFixed(2)}px of ${reach}px)`);
        }
      }
      // The document's own edge. A fixed element is measured against the viewport; anything else
      // against the document, because a ring past the viewport's edge on a page that can still
      // scroll is not clipped, only out of view.
      const fixed = style.position === 'fixed';
      const scrollX = fixed ? 0 : window.scrollX;
      const scrollY = fixed ? 0 : window.scrollY;
      const width = fixed ? window.innerWidth : document.documentElement.scrollWidth;
      const height = fixed ? window.innerHeight : document.documentElement.scrollHeight;
      const edges: [string, number][] = [
        ['top', box.top + scrollY],
        ['left', box.left + scrollX],
        ['bottom', height - (box.bottom + scrollY)],
        ['right', width - (box.right + scrollX)],
      ];
      for (const [side, distance] of edges) {
        if (distance < reach) clipped.push(`${side} by the ${fixed ? 'viewport' : 'document'} edge (${distance.toFixed(2)}px of ${reach}px)`);
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
        clipped,
        clipRowIds: clipRows.filter((row) => active.matches(row.match)).map((row) => row.id),
      };
    },
    { tag: TAG, clipRows: ledger.filter((row) => row.check === 'clip').map((row) => ({ id: row.id, match: row.match })) }
  );
  if (read === null) return EMPTY_STOP;
  if (read === 'body') return { ...EMPTY_STOP, at: 'body' };
  return read;
};

/**
 * Whether a ring is transitioned: some entry of `transition-property` names `outline`, any
 * `outline-*` or `all` **and its own duration is above zero**. Each property is paired with the
 * duration at its index, the durations list repeating when it is shorter, which is how CSS pairs
 * them. The initial value of `transition-property` is `all` over `0s`, which animates nothing.
 */
const transitionsOutline = (property: string, duration: string): boolean => {
  const durations = duration.split(',').map((part) => {
    const match = /^\s*([0-9.]+)(ms|s)\s*$/.exec(part);
    return match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : 0;
  });
  if (durations.length === 0) return false;
  return property
    .split(',')
    .map((part) => part.trim())
    .some((part, index) => (part === 'all' || part === 'outline' || part.startsWith('outline-')) && durations[index % durations.length] > 0);
};

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
 * Tab landed on, every positive `tabindex`, and every focusable inside an `aria-hidden` subtree.
 * Pure, driven by fabricated sequences below.
 */
const traversalVerdict = (
  route: string,
  expected: readonly Tabbable[],
  observed: readonly Stop[],
  afterLast: Stop,
  positives: readonly string[],
  ariaHidden: readonly string[] = []
): string[] => {
  const found: string[] = [];
  for (const at of ariaHidden) found.push(`${route}: ${at} is reachable by Tab and sits inside an aria-hidden subtree, so focus lands on something the accessibility tree does not have`);
  const diverged = expected.findIndex((tabbable, position) => observed[position]?.index !== tabbable.index);
  if (diverged !== -1) {
    const landed = observed[diverged];
    found.push(
      `${route}: Tab number ${diverged + 1} landed on ${landed ? `${landed.at} ("${landed.text}")` : 'nothing'} ` +
        `where DOM order puts ${expected[diverged].at} ("${expected[diverged].text}")`
    );
  }
  const left = afterLast.index === null ? afterLast.at === 'body' || afterLast.at === '(nothing)' : afterLast.index === 0;
  if (!left) {
    found.push(
      `${route}: Tab number ${expected.length + 1} stayed inside the document on ${afterLast.at}` +
        (afterLast.index === null ? ', a focusable nothing tagged, ' : ' ') +
        `rather than leaving it or wrapping to the first stop`
    );
  }
  for (const positive of positives) found.push(`${route}: ${positive} computes a positive tabindex, which reorders the traversal`);
  return found;
};

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
  const found = filesUnder(directory, ['.css']).map((name) => ({ name, text: readFileSync(join(directory, name), 'utf8') }));
  if (found.length === 0) {
    throw new Error(`Accessibility floor: ${directory} holds no .css file, so the z-index and depth tally would pass over nothing.`);
  }
  return found;
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
 * sum to what was observed; a row whose match nothing carries is stale. A `z-index` written as
 * `var(--z-*)` names a contract layer and is never counted; one written as `var()` of anything
 * else is an unlisted value, because it resolves to no named level. A vendor-prefixed gradient
 * counts as the function it prefixes.
 */
const tally = (
  styles: readonly { name: string; text: string }[],
  ledger: readonly Exemption[],
  layers: readonly string[]
): { unlisted: string[]; stale: string[]; mismatched: string[]; observed: Map<string, number> } => {
  const observed = new Map<string, number>();
  const bump = (key: string): void => {
    observed.set(key, (observed.get(key) ?? 0) + 1);
  };
  for (const { text } of styles) {
    for (const found of text.matchAll(/(?<![\w-])z-index:\s*(-?\d+)/g)) bump(`z-index=${found[1]}`);
    for (const found of text.matchAll(/(?<![\w-])z-index:\s*var\((--[\w-]+)/g)) {
      if (!layers.includes(found[1])) bump(`z-index=var(${found[1]})`);
    }
    for (const property of DEPTH_PROPERTIES) {
      for (const found of text.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:`, 'g'))) bump(`depth=${property}`);
    }
    for (const fn of DEPTH_FUNCTIONS) {
      for (const found of text.matchAll(new RegExp(`(?<![\\w-])(?:-webkit-|-moz-)?${fn}\\s*\\(`, 'g'))) bump(`depth=${fn}`);
    }
  }
  const claimed = new Map<string, number>();
  for (const row of ledger) {
    if (row.check !== 'z-index' && row.check !== 'depth') continue;
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
  return { unlisted, stale, mismatched, observed };
};

/**
 * The per-selector or per-route tallies (`weight`, `clip`, `heading`) against their rows, in both
 * directions: an occurrence no row claims, a row nothing matched, and a count that moved.
 */
const tallyRows = (
  check: Exemption['check'],
  hits: ReadonlyMap<string, number>,
  unclaimed: readonly string[],
  ledger: readonly Exemption[]
): string[] => {
  const drift = [...unclaimed];
  for (const row of ledger.filter((entry) => entry.check === check)) {
    const count = hits.get(row.id) ?? 0;
    if (count === 0) drift.push(`"${row.id}" (${row.match}) matched nothing on any route: the row is stale, delete it here and in ops/hub-accessibility-pass.md`);
    else if (count !== row.count) drift.push(`"${row.id}" (${row.match}) covers ${count} across the routes and the ledger says ${row.count}`);
  }
  return drift;
};

// ---------------------------------------------------------------------------
// The type floor
// ---------------------------------------------------------------------------

/** One visible element, or generated pseudo-element, carrying its own text, as read on the page. */
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

/**
 * Every visible element with a direct non-whitespace text node, outside `aria-hidden` subtrees,
 * and every `::before` or `::after` whose computed `content` is a non-blank string, labelled with
 * the pseudo and read with the pseudo's own computed style.
 */
const readText = (page: Page, ledger: readonly Exemption[]): Promise<TextRead[]> =>
  page.evaluate(
    ({ prose, labels, rows }) => {
      const { path, hidden } = window.cuatroA11y;
      const generated = (content: string): boolean => {
        if (content === 'none' || content === 'normal' || content === '') return false;
        const quoted = /^"(.*)"$/.exec(content) ?? /^'(.*)'$/.exec(content);
        return quoted ? quoted[1].trim() !== '' : true;
      };
      const out: TextRead[] = [];
      for (const node of document.querySelectorAll('body *')) {
        if (node.closest('script, style, noscript, template') || hidden(node)) continue;
        const own = [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '');
        const reads: [string, CSSStyleDeclaration, string][] = [];
        if (own) reads.push([path(node), window.getComputedStyle(node), (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)]);
        for (const pseudo of ['::before', '::after'] as const) {
          const style = window.getComputedStyle(node, pseudo);
          if (generated(style.content)) reads.push([`${path(node)}${pseudo}`, style, style.content.slice(0, 40)]);
        }
        for (const [at, style, text] of reads) {
          out.push({
            at,
            tag: node.tagName.toLowerCase(),
            text,
            fontSize: Number.parseFloat(style.fontSize),
            fontStyle: style.fontStyle,
            fontWeight: Number.parseFloat(style.fontWeight),
            family: style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''),
            prose: at.indexOf('::') === -1 && prose.some((selector) => node.matches(selector)),
            label: at.indexOf('::') === -1 ? (labels.find((selector) => node.matches(selector)) ?? null) : null,
            matchedIds: rows.filter((row) => node.matches(row.match)).map((row) => row.id),
          });
        }
      }
      return out;
    },
    {
      prose: [...PROSE_SELECTORS],
      labels: LABEL_PARAGRAPHS.map((entry) => entry.selector),
      rows: ledger.filter((row) => row.check === 'weight').map((row) => ({ id: row.id, match: row.match })),
    }
  );

/**
 * The `font-weight` range `contracts/fonts.css` publishes for `family`, every `@font-face` block
 * of that family merged into one range, or null when it is not a contract face.
 */
const publishedWeightRange = (family: string, fontsCss: string): [number, number] | null => {
  let range: [number, number] | null = null;
  for (const face of fontsCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const declared = /font-family\s*:\s*([^;]+)/.exec(face[1])?.[1].trim().replace(/^["']|["']$/g, '');
    if (declared !== family) continue;
    const weight = /font-weight\s*:\s*([^;]+)/.exec(face[1])?.[1].trim();
    const parts = weight ? weight.split(/\s+/).map(Number) : [400];
    if (parts.some(Number.isNaN)) continue;
    const [low, high] = [Math.min(...parts), Math.max(...parts)];
    range = range === null ? [low, high] : [Math.min(range[0], low), Math.max(range[1], high)];
  }
  return range;
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
    if (read.tag === 'p' && read.at.indexOf('::') === -1 && read.label === null && read.fontSize < floor.t2xs - SIZE_SLACK) {
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

/** A stylesheet's text with Sass and CSS comments removed, so a discussion of a rule is never read as the rule. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

/** A `font-size`, or a `font` shorthand, whose value carries a `px` length. */
const PX_TYPE = /(?<![\w-])font(?:-size)?\s*:[^;]*\d(px)\b/;

/** Every stylesheet under `app/` and `components/`, as `[repository-relative path, text]`. */
const stylesheets = (): [string, string][] =>
  (['app', 'components'] as const).flatMap((root) =>
    filesUnder(join(REPO_ROOT, root), ['.scss']).map((relative): [string, string] => [`${root}/${relative}`, readFileSync(join(REPO_ROOT, root, relative), 'utf8')])
  );

/** Every `font-size` or `font` under `app/` and `components/` whose value carries `px`, by path and line. */
const pxFontSizes = (sheets: readonly [string, string][] = stylesheets()): string[] =>
  sheets.flatMap(([path, source]) =>
    withoutComments(source)
      .split('\n')
      .map((line, index) => (PX_TYPE.test(line) ? `${path}:${index + 1} ${line.trim()}` : null))
      .filter((line): line is string => line !== null)
  );

/**
 * Every `:focus-visible` rule that declares an `outline`, other than the global rule: the ring is
 * painted once, in `app/app.scss`, on the bare `:focus-visible` selector, and a second declaration
 * anywhere under `app/` or `components/` is the nine-rules shape this story deleted coming back.
 * Sass nesting (`&:focus-visible { ... }`) is read the same way, by the selector text before the
 * brace.
 */
const ringRulesOutsideTheGlobal = (sheets: readonly [string, string][] = stylesheets()): string[] =>
  sheets.flatMap(([path, source]) =>
    [...withoutComments(source).matchAll(/([^{};]*:focus-visible[^{;]*)\{([^{}]*)\}/g)]
      .filter((rule) => /(?<![\w-])outline(?:-[a-z]+)?\s*:/.test(rule[2]))
      .map((rule) => [path, rule[1].trim()] as const)
      .filter(([at, selector]) => !(at === RING_FILE && selector === RING_SELECTOR))
      .map(([at, selector]) => `${at}: "${selector}" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`)
  );

/** The accessible level-1 headings on the open page, by name, off the accessibility tree. */
const levelOneHeadings = (page: Page): Promise<string[]> =>
  page.getByRole('heading', { level: 1 }).evaluateAll((nodes: Element[]) => nodes.map((node) => (node.getAttribute('aria-label') ?? node.textContent ?? '').replace(/\s+/g, ' ').trim()));

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
      if (row.check === 'heading') expect(SURFACES.map((surface) => surface.route), `"${row.id}" names a route this sweep does not visit`).toContain(row.match);
    }
    // Every selector row parses, through the browser's own parser, before anything matches against it.
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx:7')).toBe(true);
    expect(SOURCE_SHAPE.test('app/app.scss:118-121')).toBe(true);
    expect(SOURCE_SHAPE.test('components/organisms/WorkHero/WorkHero.scss:15,40')).toBe(true);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx')).toBe(false);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/logo.css:7')).toBe(false);
  });

  test('every interactive element on every route paints the ring under Tab, whole, in DOM order, on a contrasting ground, and nothing under the mouse', async ({
    page,
  }) => {
    const ring: string[] = [];
    const traversal: string[] = [];
    const contrast: string[] = [];
    const mouse: string[] = [];
    const summary: string[] = [];
    const clippedStops: string[] = [];
    const clipHits = new Map<string, number>();
    const clipUnclaimed: string[] = [];
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

      const { tabbables, positives, ariaHidden } = await tagTabbables(page);
      const stops: Stop[] = [];
      for (let index = 0; index < tabbables.length; index += 1) {
        await page.keyboard.press('Tab');
        stops.push(await readStop(page));
      }
      await page.keyboard.press('Tab');
      const afterLast = await readStop(page);
      traversal.push(...traversalVerdict(surface.route, tabbables, stops, afterLast, positives, ariaHidden));

      for (const stop of stops) {
        if (stop.index === null) continue;
        stopsRead += 1;
        ring.push(...ringFindings(surface.route, stop, contract));
        if (stop.clipped.length > 0) {
          clippedStops.push(`${surface.route} ${stop.at}: ${stop.clipped.join('; ')}`);
          if (stop.clipRowIds.length === 0) clipUnclaimed.push(`${surface.route}: ${stop.at} ("${stop.text}") has its ring clipped (${stop.clipped.join('; ')}) and no ledger row claims it`);
          for (const id of stop.clipRowIds) clipHits.set(id, (clipHits.get(id) ?? 0) + 1);
        }
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
          `${positives.length} positive tabindex, ${ariaHidden.length} inside aria-hidden; ring ${contract.width} solid ${contract.colour} [${focusRgb}] at ${contract.offset}` +
          (stops[0] ? `, first stop transition-property "${stops[0].transitionProperty}" over "${stops[0].transitionDuration}"` : '')
      );

      // The trigger's ring, which was inset before this story and paints outside now, over the
      // article's accent bar and towards the next row. Read, logged for the record, not asserted.
      if (surface.route === '/work') {
        const trigger = await page.evaluate(() => {
          const button = document.querySelector('button.work-item__header');
          const article = button?.closest('article.work-item');
          if (!button || !article) return null;
          const bar = window.getComputedStyle(article, '::before');
          return {
            button: button.getBoundingClientRect().toJSON(),
            article: article.getBoundingClientRect().toJSON(),
            barWidth: bar.width,
            barLeft: bar.left,
            outlineOffset: window.getComputedStyle(button).outlineOffset,
          };
        });
        summary.push(`/work trigger: ${JSON.stringify(trigger)}`);
      }

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
      const toClick = await page.evaluate(
        (tag) => {
          const tagged = [...document.querySelectorAll(`[${tag}]`)];
          const first = (selector: string): string | null =>
            tagged.find((node) => node.matches(selector) && !node.classList.contains('skip-link'))?.getAttribute(tag) ?? null;
          return { link: first('a[href]'), button: first('button') };
        },
        TAG
      );
      expect(toClick.link, `${surface.route} carries no link to click, so the click half of the claim is over nothing`).not.toBeNull();
      const before = new URL(page.url()).pathname;
      for (const index of [toClick.link, toClick.button].filter((found): found is string => found !== null)) {
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
        `planted: ${planted.join('; ') || 'none'}\n` +
        `clipped stops (${clippedStops.length}):\n  ${clippedStops.join('\n  ') || 'none'}\n` +
        `clip rows: ${[...clipHits].map(([id, count]) => `${id} x${count}`).join(', ') || 'none'}`
    );

    expect(stopsRead, 'no Tab stop was read on any route, so every claim below is over nothing').toBeGreaterThan(0);
    expect(traversal, `Tab does not traverse the visible tabbables in DOM order:\n${traversal.join('\n')}\n\n${summary.join('\n')}`).toEqual([]);
    expect(ring, `A-1: an interactive element does not paint the standard ring under Tab:\n${ring.join('\n')}\n\n${summary.join('\n')}`).toEqual([]);
    expect(contrast, `A-1: the ring does not clear ${RING_CONTRAST_FLOOR}:1 against a ground it sits on:\n${contrast.join('\n')}`).toEqual([]);
    const clipDrift = tallyRows('clip', clipHits, clipUnclaimed, EXEMPTIONS);
    expect(clipDrift, `A-1: a ring is clipped within its reach and the clip ledger does not describe it:\n${clipDrift.join('\n')}`).toEqual([]);
    expect(mouse, `the mouse paints a ring, or a click was read on the wrong element:\n${mouse.join('\n')}`).toEqual([]);
    for (const token of GROUND_TOKENS) {
      expect(groundsRead.get(token), `${token} was read on no element, shipped or planted`).toBeDefined();
    }
  });

  test('the landmarks the two skips move focus to ring on keyboard activation', async ({ page, browser }) => {
    // Both targets carry `tabindex="-1"` and are never Tab stops, so the sweep above never reads
    // them; a keyboard visitor lands on them through Enter, which is where A-1's visible indicator
    // matters most: it is the only sign of where focus went. The global rule paints on them, and
    // `outline: none` on either is forbidden by the story.
    await goTo(page, '/');
    await settle(page, { route: '/', status: 200, entrance: true });
    const contract = await ringContract(page);
    expect(await tabTo(page, page.locator('.skip-link'), 3), 'the skip-link is not among the first three Tab stops').toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), { message: 'Enter on the skip-link did not move focus to main#main' }).toBe('main');
    const landmark = await readStop(page);
    expect(landmark.at, 'focus is not on the main landmark').toContain('main#main');
    expect(ringFindings('/ (after Enter on the skip-link)', landmark, contract), 'the main landmark does not paint the standard ring when the skip-link puts focus on it').toEqual([]);

    // The skip control, on the animated door, moves focus to the Directory heading the same way.
    const context = await browser.newContext({ viewport: { ...RENDERED_VIEWPORT }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
    try {
      const door = await context.newPage();
      await goTo(door, '/');
      await expect.poll(() => door.evaluate(() => document.querySelector('.skip-control') !== null), { timeout: 20_000 }).toBe(true);
      const doorContract = await ringContract(door);
      expect(await tabTo(door, door.locator('.skip-control'), 10), 'the skip control is not among the first ten Tab stops on the animated door').toBe(true);
      await door.keyboard.press('Enter');
      await expect.poll(() => door.evaluate(() => document.activeElement?.id ?? ''), { message: 'Enter on the skip control did not move focus to h2#suite' }).toBe('suite');
      const heading = await readStop(door);
      expect(heading.at, 'focus is not on the Directory heading').toContain('h2#suite');
      expect(ringFindings('/ (after Enter on the skip control)', heading, doorContract), 'the Directory heading does not paint the standard ring when the skip control puts focus on it').toEqual([]);
      console.log(
        `accessibility-floor: main#main after Enter: focus-visible ${landmark.focusVisible}, ${landmark.outlineWidth} ${landmark.outlineStyle} at ` +
          `${landmark.outlineOffset}, clipped [${landmark.clipped.join('; ')}]; h2#suite after Enter: focus-visible ${heading.focusVisible}, ` +
          `${heading.outlineWidth} ${heading.outlineStyle} at ${heading.outlineOffset}, clipped [${heading.clipped.join('; ')}]`
      );
    } finally {
      await context.close();
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
      expect(stop.clipped, 'the skip control paints a clipped ring on the animated door').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('every route carries exactly one accessible level-1 heading, and the home route names it', async ({ page }) => {
    // A-7, read off the accessibility tree. Until Story 2-27 that was what told the `GlitchText`
    // wrapper, which carried the role on `/`, from its `aria-hidden` `<h1>`, which no markup count
    // could tell apart; the heading is a real `<h1>` named by its own text now, and the tree is
    // still where the name is read. A route off the rule is a ledger row, so the 404, which renders
    // its numeral and title as paragraphs, is carried by `heading-404` until Story 2-30 rebuilds it.
    const hits = new Map<string, number>();
    const unclaimed: string[] = [];
    const readings: string[] = [];
    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);
      const headings = await levelOneHeadings(page);
      readings.push(`${surface.route}: ${headings.length} [${headings.join(' | ')}]`);
      if (surface.route === '/') expect(headings, 'the home route does not name its heading Luigi Espinosa').toEqual(['Luigi Espinosa']);
      if (headings.length === 1) continue;
      const rows = EXEMPTIONS.filter((row) => row.check === 'heading' && row.match === surface.route);
      if (rows.length === 0) unclaimed.push(`${surface.route} carries ${headings.length} accessible level-1 headings (${headings.join(' | ')}) and no ledger row claims it`);
      for (const row of rows) hits.set(row.id, (hits.get(row.id) ?? 0) + 1);
    }
    console.log(`accessibility-floor: level-1 headings: ${readings.join('; ')}`);
    const drift = tallyRows('heading', hits, unclaimed, EXEMPTIONS);
    expect(drift, `A-7: a route does not carry exactly one accessible level-1 heading:\n${drift.join('\n')}`).toEqual([]);

    // A second level-1 heading planted on `/cv` is seen, so a count of one is a measurement.
    await goTo(page, '/cv');
    await page.evaluate(() => {
      const planted = document.createElement('div');
      planted.setAttribute('role', 'heading');
      planted.setAttribute('aria-level', '1');
      planted.textContent = 'planted heading';
      document.body.append(planted);
    });
    expect(await levelOneHeadings(page), 'the planted second heading was not seen').toHaveLength(2);
    expect(tallyRows('heading', new Map(), ['/cv carries 2 accessible level-1 headings'], EXEMPTIONS).some((line) => line.startsWith('/cv carries 2'))).toBe(true);
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
    let generatedRead = 0;
    let floor: TypeFloor | null = null;

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);
      const routeFloor = await typeFloor(page);
      if (floor === null) floor = routeFloor;
      expect(routeFloor, `the type scale resolves differently on ${surface.route}`).toEqual(floor);

      const reads = await readText(page, EXEMPTIONS);
      elementsRead += reads.length;
      generatedRead += reads.filter((read) => read.at.includes('::')).length;
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
      `accessibility-floor: ${elementsRead} text reads (${generatedRead} generated); off-contract families:\n  ${[...offContract].join('\n  ') || 'none'}\n` +
        `synthesised weights: ${[...synthesised].map(([id, count]) => `${id} x${count}`).join(', ') || 'none'}`
    );

    expect(elementsRead, 'no text element was read on any route, so the floor is asserted over nothing').toBeGreaterThan(0);
    expect(generatedRead, 'no generated text was read on any route, and the timeline marks every highlight with one').toBeGreaterThan(0);
    expect(findings, `A-11, A-12 or DR45: a visible text is under the floor, italic, or otherwise off the scale:\n${findings.join('\n')}`).toEqual([]);
    const drift = tallyRows('weight', synthesised, unclaimed, EXEMPTIONS);
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

  test('no stylesheet under app/ or components/ sets type in px, and none but app/app.scss paints a ring', () => {
    const sheets = stylesheets();
    expect(sheets.length, 'no stylesheet was read under app/ or components/').toBeGreaterThan(10);
    expect(sheets.map(([path]) => path), 'the scan did not read the file that carries the ring').toContain(RING_FILE);

    const written = pxFontSizes(sheets);
    expect(written, `A-12: type is sized in px, so it does not respect the reader's font size:\n${written.join('\n')}`).toEqual([]);
    // The scan, on planted lines, so an empty result is a measurement rather than a regex that stopped matching.
    expect(PX_TYPE.test('  font-size: 12px;')).toBe(true);
    expect(PX_TYPE.test('  font-size: clamp(1rem, 2vw, 18px);')).toBe(true);
    expect(PX_TYPE.test('  font: 700 12px/1.4 sans-serif;')).toBe(true);
    expect(PX_TYPE.test('  font-size: var(--t-sm);')).toBe(false);
    expect(PX_TYPE.test('  font-size: 12pt;')).toBe(false);
    expect(PX_TYPE.test('  font-family: Geist;')).toBe(false);
    expect(PX_TYPE.test('  padding: 12px;')).toBe(false);
    expect(pxFontSizes([['components/x/X.scss', '.a { font: 12px/1 x; }\n.b { font-size: 1rem; }']])).toEqual(['components/x/X.scss:1 .a { font: 12px/1 x; }']);

    const rings = ringRulesOutsideTheGlobal(sheets);
    expect(rings, `a :focus-visible rule other than the global one declares an outline, which is the nine-rules shape this story deleted:\n${rings.join('\n')}`).toEqual([]);
    expect(ringRulesOutsideTheGlobal([[RING_FILE, `${RING_SELECTOR} { outline: 1px solid red; }`]]), 'the global rule itself was reported').toEqual([]);
    const fabricated: [string, string][] = [
      ['components/x/X.scss', '.x {\n  color: red;\n  &:focus-visible {\n    outline: 1px solid var(--accent);\n  }\n}\n.y:focus-visible { outline-color: red; }\n.z:focus-visible { transform: none; }'],
      [RING_FILE, '.scoped:focus-visible { outline: none; }'],
    ];
    expect(ringRulesOutsideTheGlobal(fabricated)).toEqual([
      `components/x/X.scss: "&:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
      `components/x/X.scss: ".y:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
      `${RING_FILE}: ".scoped:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
    ]);
  });

  // -------------------------------------------------------------------------
  // The planted controls. Every predicate above, seen firing.
  // -------------------------------------------------------------------------

  test('with the ring taken off, the sweep names every element on the route with the five values', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    const contract = await ringContract(page);
    await page.addStyleTag({ content: ':focus-visible { outline: none !important; transition: color 1ms, outline 200ms !important; }' });
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

    // The transition pairing, on fabricated lists: it is the outline's own duration that counts.
    expect(transitionsOutline('all', '0s')).toBe(false);
    expect(transitionsOutline('color, outline', '0.2s, 0s'), 'a positive duration on another property was read as the outline animating').toBe(false);
    expect(transitionsOutline('color, outline', '0s, 0.2s')).toBe(true);
    expect(transitionsOutline('outline-color, color', '150ms')).toBe(true);
    expect(transitionsOutline('color, background, outline', '0s, 0.2s'), 'the durations list did not repeat by index').toBe(false);
    expect(transitionsOutline('color, background, outline', '0.2s, 0s')).toBe(true);
    expect(transitionsOutline('all', '0.3s')).toBe(true);
  });

  test('a ring clipped by a clip-path ancestor and by the document edge is named, side by side', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.id = 'planted-clip';
      wrap.setAttribute('style', 'clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); padding: 0 0 0 40px; margin: 40px; width: 200px;');
      const link = document.createElement('a');
      link.href = '#planted';
      link.id = 'planted-clipped-link';
      link.textContent = 'clipped';
      // Block-level, so the link fills the wrapper's content box and sits flush with its top,
      // right and bottom edges; the padding keeps its left edge clear of the clip.
      link.setAttribute('style', 'display:flex;height:40px;');
      wrap.append(link);
      document.body.append(wrap);
      const edge = document.createElement('a');
      edge.href = '#edge';
      edge.id = 'planted-edge-link';
      edge.textContent = 'edge';
      edge.setAttribute('style', 'position:fixed;top:0;left:0;display:inline-flex;height:40px;');
      document.body.append(edge);
    });
    const clipped = page.locator('#planted-clipped-link');
    expect(await tabTo(page, clipped), 'the planted clipped link was never reached').toBe(true);
    const clippedStop = await readStop(page);
    expect(clippedStop.at).toContain('a#planted-clipped-link');
    for (const side of ['top', 'right', 'bottom']) {
      expect(clippedStop.clipped.some((line) => line.startsWith(`${side} by `) && line.includes('div#planted-clip') && line.includes('clip-path')), `the ${side} side clipped by the wrapper was not named:\n${clippedStop.clipped.join('\n')}`).toBe(true);
    }
    expect(clippedStop.clipped.some((line) => line.startsWith('left by ') && line.includes('div#planted-clip')), 'the padded left side was reported as clipped').toBe(false);
    expect(clippedStop.clipRowIds, 'the planted link matched a real clip row').toEqual([]);

    const edge = page.locator('#planted-edge-link');
    expect(await tabTo(page, edge), 'the planted edge link was never reached').toBe(true);
    const edgeStop = await readStop(page);
    expect(edgeStop.clipped.some((line) => line.startsWith('top by the viewport edge')), `the top viewport edge was not named:\n${edgeStop.clipped.join('\n')}`).toBe(true);
    expect(edgeStop.clipped.some((line) => line.startsWith('left by the viewport edge')), 'the left viewport edge was not named').toBe(true);
    expect(edgeStop.clipped.filter((line) => /^(right|bottom) by/.test(line)), 'a far side was reported as clipped').toEqual([]);

    // A stop with a clipped ring and no row is unclaimed; a clip row nothing matched is stale.
    const drift = tallyRows('clip', new Map(), ['planted unclaimed'], [{ id: 'clip-ghost', check: 'clip', match: '.ghost', count: 1, source: 'components/x/X.scss:1', closedBy: 'Story 9-99' }]);
    expect(drift).toEqual(['planted unclaimed', '"clip-ghost" (.ghost) matched nothing on any route: the row is stale, delete it here and in ops/hub-accessibility-pass.md']);
    expect(tallyRows('clip', new Map([['clip-ghost', 3]]), [], [{ id: 'clip-ghost', check: 'clip', match: '.ghost', count: 2, source: 'components/x/X.scss:1', closedBy: 'Story 9-99' }])).toEqual([
      '"clip-ghost" (.ghost) covers 3 across the routes and the ledger says 2',
    ]);
  });

  test('a planted positive tabindex, an aria-hidden focusable and an untagged landing fail the traversal, naming each', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    await page.evaluate(() => {
      const planted = document.createElement('a');
      planted.href = '#';
      planted.id = 'planted-positive-tabindex';
      planted.setAttribute('tabindex', '1');
      planted.textContent = 'planted';
      document.body.append(planted);
      const hiddenWrap = document.createElement('div');
      hiddenWrap.setAttribute('aria-hidden', 'true');
      hiddenWrap.innerHTML = '<a href="#hidden" id="planted-aria-hidden-link">hidden link</a>';
      document.body.append(hiddenWrap);
      const disabled = document.createElement('button');
      disabled.id = 'planted-disabled';
      disabled.disabled = true;
      disabled.textContent = 'disabled';
      document.body.append(disabled);
      const inert = document.createElement('div');
      inert.setAttribute('inert', '');
      inert.innerHTML = '<a href="#inert" id="planted-inert-link">inert link</a>';
      document.body.append(inert);
    });
    const { tabbables, positives, ariaHidden } = await tagTabbables(page);
    expect(positives, 'the planted tabindex was not read as positive').toHaveLength(1);
    expect(ariaHidden, 'the planted aria-hidden link was not read as reachable inside a hidden subtree').toEqual([expect.stringContaining('a#planted-aria-hidden-link')]);
    expect(tabbables.map((tabbable) => tabbable.at).filter((at) => /planted-(disabled|inert-link)/.test(at)), 'a disabled or inert control was expected as a Tab stop').toEqual([]);
    expect(tabbables.some((tabbable) => tabbable.at.includes('a#planted-aria-hidden-link')), 'the aria-hidden link left the expected order although Tab reaches it').toBe(true);
    const stops: Stop[] = [];
    for (let index = 0; index < tabbables.length; index += 1) {
      await page.keyboard.press('Tab');
      stops.push(await readStop(page));
    }
    await page.keyboard.press('Tab');
    const verdict = traversalVerdict(NOT_FOUND, tabbables, stops, await readStop(page), positives, ariaHidden);
    expect(verdict.some((line) => /planted-positive-tabindex.*positive tabindex/.test(line)), `the positive tabindex was not named:\n${verdict.join('\n')}`).toBe(true);
    expect(verdict.some((line) => /Tab number 1 landed on .*a#planted-positive-tabindex/.test(line)), `the reordered first stop was not named:\n${verdict.join('\n')}`).toBe(true);
    expect(verdict.some((line) => /planted-aria-hidden-link is reachable by Tab and sits inside an aria-hidden subtree/.test(line)), `the aria-hidden focusable was not named:\n${verdict.join('\n')}`).toBe(true);

    // And the pure verdict, on fabricated sequences, in each direction it can fail.
    const a: Tabbable = { index: 0, at: 'body > a.first', text: 'first' };
    const b: Tabbable = { index: 1, at: 'body > a.second', text: 'second' };
    const stopFor = (tabbable: Tabbable | null): Stop => ({ ...EMPTY_STOP, index: tabbable?.index ?? null, at: tabbable?.at ?? 'body', text: tabbable?.text ?? '', outlineStyle: 'solid', focusVisible: true });
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(null), [])).toEqual([]);
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], EMPTY_STOP, [])).toEqual([]);
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(a), [])).toEqual([]);
    expect(traversalVerdict('/x', [a, b], [stopFor(b), stopFor(a)], stopFor(null), [])[0]).toMatch(/Tab number 1 landed on body > a.second/);
    expect(traversalVerdict('/x', [a, b], [stopFor(a)], stopFor(null), [])[0]).toMatch(/Tab number 2 landed on nothing/);
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], stopFor(b), [])[0]).toMatch(/Tab number 3 stayed inside the document/);
    // An untagged focusable, an iframe or a focusable scroller, is a landing, not a departure.
    expect(traversalVerdict('/x', [a, b], [stopFor(a), stopFor(b)], { ...EMPTY_STOP, at: 'body > iframe' }, [])[0]).toMatch(/Tab number 3 stayed inside the document on body > iframe, a focusable nothing tagged/);
    expect(traversalVerdict('/x', [a], [stopFor(a)], stopFor(null), ['body > a.third (tabindex=2)'])[0]).toMatch(/positive tabindex/);
    expect(traversalVerdict('/x', [a], [stopFor(a)], stopFor(null), [], ['body > div > a.hidden'])[0]).toMatch(/a.hidden is reachable by Tab and sits inside an aria-hidden subtree/);
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

    // Two rows sharing a match sum their counts; a custom property named like the property is not
    // a z-index; a `var()` that is no contract layer is an unlisted value; a vendor prefix counts
    // as the function it prefixes; `repeating-linear-gradient(` is not a `linear-gradient(`.
    const shared: Exemption[] = [
      { ...rows[0], id: 'z-a', count: 2 },
      { ...rows[0], id: 'z-b', count: 1 },
    ];
    expect(tally(css('.a{z-index:20}.b{z-index:20}.c{z-index:20}'), shared, layers).mismatched).toEqual([]);
    expect(tally(css('.a{z-index:20}.b{z-index:20}'), shared, layers).mismatched).toEqual([
      '"z-a" and "z-b" claim 3 occurrence(s) of z-index=20 and the built CSS carries 2',
    ]);
    expect([...tally(css(':root{--foo-z-index:3}.a{z-index:var(--z-raised)}'), [], layers).observed]).toEqual([]);
    expect(tally(css('.a{z-index:var(--z-tooltip)}.b{z-index:var(--depth, 4)}'), [], layers).unlisted).toEqual([
      'z-index=var(--depth) occurs 1 time(s) in the built CSS and no ledger row claims it',
      'z-index=var(--z-tooltip) occurs 1 time(s) in the built CSS and no ledger row claims it',
    ]);
    expect([...tally(css('.a{background:repeating-linear-gradient(red,blue)}.b{background:-webkit-linear-gradient(red,blue);background:-moz-radial-gradient(red,blue)}'), [], layers).observed]).toEqual([
      ['depth=linear-gradient', 1],
      ['depth=radial-gradient', 1],
      ['depth=repeating-linear-gradient', 1],
    ]);

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

  test('a planted text under the floor, an italic, a synthesised weight and a small pseudo-element are named by the type sweep', async ({ page }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, status: 404, entrance: false });
    const floor = await typeFloor(page);
    const fontsCss = readFileSync(FONTS_CSS, 'utf8');
    await page.addStyleTag({ content: '#planted-generated::before { content: "//"; font-size: calc(var(--t-3xs) - 1px); } #planted-blank::after { content: " "; font-size: 1px; }' });
    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.id = 'planted-type';
      wrap.innerHTML =
        '<p id="planted-under-floor" style="font-size:calc(var(--t-3xs) - 1px)">under the floor</p>' +
        '<p id="planted-small-paragraph" style="font-size:calc(var(--t-2xs) - 1px)">small paragraph</p>' +
        '<p id="planted-small-prose" class="error-page__sub" style="font-size:calc(var(--t-sm) - 1px)">small prose</p>' +
        '<span id="planted-italic" style="font-style:italic">italic</span>' +
        '<span id="planted-bold-mono" style="font-family:var(--f-mono);font-weight:700">bold mono</span>' +
        '<span id="planted-off-contract" style="font-family:Papyrus, fantasy;font-weight:900">off contract</span>' +
        '<span id="planted-generated">marked</span>' +
        '<span id="planted-blank">blank pseudo</span>';
      document.body.append(wrap);
    });
    const reads = await readText(page, EXEMPTIONS);
    const verdict = typeVerdict(NOT_FOUND, reads, floor, fontsCss, EXEMPTIONS);
    const about = (id: string) => verdict.findings.filter((line) => line.includes(`#${id}`));
    expect(about('planted-under-floor').some((line) => /under --t-3xs/.test(line)), `the planted text under the floor was not named:\n${verdict.findings.join('\n')}`).toBe(true);
    expect(about('planted-small-paragraph').some((line) => /under --t-2xs/.test(line)), 'the planted small paragraph was not named').toBe(true);
    expect(about('planted-small-prose').some((line) => /under the --t-sm body floor/.test(line)), 'the planted small prose was not named').toBe(true);
    expect(about('planted-italic').some((line) => /font-style italic/.test(line)), 'the planted italic was not named').toBe(true);
    expect(verdict.findings.some((line) => /planted-generated[^ ]*::before .*under --t-3xs/.test(line)), `the planted small ::before was not named:\n${verdict.findings.join('\n')}`).toBe(true);
    expect(reads.filter((read) => read.at.includes('planted-blank::after')), 'a blank pseudo-element was read as text').toEqual([]);
    expect(verdict.unclaimed.some((line) => /planted-bold-mono.*above its published/.test(line)), 'the planted synthesised weight was not named').toBe(true);
    expect(verdict.offContract.some((line) => /planted-off-contract.*"Papyrus"/.test(line)), 'the off-contract family was not listed').toBe(true);
    expect(verdict.findings.filter((line) => /planted-off-contract/.test(line)), 'an off-contract family was judged on weight').toEqual([]);

    // The shipped surface underneath still reads clean, so the plants did not pass by disturbing it.
    expect(verdict.findings.filter((line) => !line.includes('#planted-')), 'the 404 itself carries a type finding').toEqual([]);

    // And the aria-hidden arm: the same plants inside a hidden subtree are never read.
    await page.evaluate(() => document.getElementById('planted-type')?.setAttribute('aria-hidden', 'true'));
    const hidden = await readText(page, EXEMPTIONS);
    expect(hidden.filter((read) => read.at.includes('#planted-')), 'a text inside an aria-hidden subtree was read').toEqual([]);

    // The weight-range parser, on the contract's own faces, a planted one, and a family published
    // in two blocks, which merge into one range.
    expect(publishedWeightRange('Geist Mono', fontsCss)).toEqual([400, 400]);
    expect(publishedWeightRange('Bricolage Grotesque', fontsCss)).toEqual([700, 800]);
    expect(publishedWeightRange('Papyrus', fontsCss)).toBeNull();
    expect(publishedWeightRange('Planted', '@font-face { font-family: "Planted"; font-weight: 100 900; }')).toEqual([100, 900]);
    expect(publishedWeightRange('Split', '@font-face { font-family: "Split"; font-weight: 400; } @font-face { font-family: "Split"; font-weight: 700; }')).toEqual([400, 700]);
    expect(publishedWeightRange('Bare', '@font-face { font-family: "Bare"; src: url(x); }'), 'a face with no font-weight is the initial 400').toEqual([400, 400]);
  });
});
