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
 *     `[tabindex="-1"]` landmarks the two skips move focus to ring on keyboard activation: since
 *     2026-09-24 every route carries one `main#main`, every route with a visible header reaches it
 *     from a skip link its first Tab lands on, and its ring is the one inset exception, whole.
 *  2. **Traversal in DOM order** (`EXPERIENCE.md:739`). Tab from `body` visits exactly the
 *     tabbables in document order, the next Tab leaves the document or wraps, no `tabindex`
 *     computes above zero, and no focusable sits inside an `aria-hidden` subtree. On the animated
 *     door `.skip-control` is a stop and paints the ring.
 *  3. **The built CSS** (`epics.md:3053-3061`, UX-DR44). Every `z-index:<number>`, `box-shadow`,
 *     `text-shadow` and `*-gradient(` occurrence in `.next/static/chunks/*.css`, and since
 *     2026-09-24 every `url(` outside `@font-face` (DW-102), is claimed by a ledger row and every
 *     row is claimed back, tallied per value, property or function. The `--z-*` names come from
 *     `contracts/tokens.css`, and an empty build throws rather than passing over nothing.
 *  4. **The type floor, A-11 and A-12** (`epics.md:3042-3051`, `DESIGN.md:461-502`). Nothing
 *     visible, generated text included, computes under `--t-3xs`; no paragraph under `--t-2xs`,
 *     the labels `DESIGN.md` places on `<p>` at the smallest step excepted by name; none of the
 *     six prose selectors under `--t-sm`; nothing italic; no weight above the family's published
 *     range except what the ledger carries; no stylesheet sets `font-size` or `font` in `px`; and
 *     no `:focus-visible` rule outside `app/app.scss`, nor any there but the global one, the
 *     landmark's and, since 2026-09-25, the landmark's layer above the hero (DW-127), declares an
 *     `outline`.
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

/**
 * The one deliberate exception to `RESTYLE-SPEC.md` § 4 verbatim (Operator ruling 2026-09-24, F-20):
 * the skip link's target, `<main>`, is as wide as the document, so its ring is drawn inside its box,
 * in the same file and from the same roles. Nothing else may declare an outline.
 */
const LANDMARK_RING_SELECTOR = 'main:focus-visible';

/**
 * The second (Operator ruling 2026-09-25, DW-127): the same inset ring drawn again on a positioned
 * layer over the landmark, because on `/`'s default door at 768 and wider the hero's canvas and scrim
 * are positioned inside `<main>` and paint over its outline. Same file, same roles.
 */
const LANDMARK_LAYER_SELECTOR = 'main:focus-visible::after';

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
 *
 * **Empty since 2026-09-23, and KV-6 retired with it.** The instrument stays: a z-index literal, a
 * depth tell, a clipped ring, a synthesised weight or a route off the one-heading rule that no row
 * claims fails exactly as before, and a row added back has to be a dated Operator ruling in both files.
 */
const EXEMPTIONS: readonly Exemption[] = [
  // **`z-work-hero` and `gradient-work-ground` left on 2026-09-23 with Story 2-33**, the ledger's
  // last two rows. `WorkHero.scss` was rebuilt against the contract with no `z-index` at all (its two
  // `2`s stacked the text and the canvas over a scrim Story 2-28 had already removed), and
  // `app/app.scss`'s `body#work` rule, the cybercore ground under its two-gradient grid, was deleted
  // with the `/work` surface's rebuild; the built CSS carries neither tell since.
  //
  // **`clip-skip-link` left on 2026-09-23 with Story 2-32**, the ledger's last `clip` row. The
  // skip-link was parked at the viewport's corner, so its revealed ring lost its top and left sides
  // past the edge; it is parked one ring-reach inside the corner now, and the sweep reads the ring
  // whole, which reported the row stale.
];

/** The four depth properties and functions the built-CSS sweep counts, as written in minified CSS. */
const DEPTH_PROPERTIES = ['box-shadow', 'text-shadow'] as const;
const DEPTH_FUNCTIONS = ['linear-gradient', 'radial-gradient', 'repeating-linear-gradient', 'conic-gradient'] as const;

/**
 * The seventh tell, counted apart because it is legitimate in one place (DW-102, Operator ruling
 * 2026-09-24). A `url(` in built CSS is either a face's `src`, inside `@font-face`, or a painted image:
 * the grain Story 2-28 deleted came back that way, and no gradient or shadow count sees it. So every
 * `url(` outside an `@font-face` block is counted, and zero is expected.
 */
const DEPTH_URL = 'url' as const;

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
      // `scrollWidth` and `scrollHeight` are whole pixels, so a box ending on a fractional pixel at the
      // document's end read a hundredth past it, which mattered once a ring could reach zero (the
      // landmark's inset, F-20, first read on 2026-09-24 as "0.02px past" on `/cv`). The root element's
      // own box is not rounded, and the larger of the two is the document's extent.
      const root = document.documentElement.getBoundingClientRect();
      const width = fixed ? window.innerWidth : Math.max(document.documentElement.scrollWidth, root.width);
      const height = fixed ? window.innerHeight : Math.max(document.documentElement.scrollHeight, root.height);
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
 * The ring verdict on one stop. Pure, so the planted controls can drive it. `offset` is
 * `--focus-offset` everywhere but on the landmark, whose inset is the one exception (F-20).
 */
const ringFindings = (
  route: string,
  stop: Stop,
  contract: RingContract,
  offset: { readonly value: string; readonly as: string } = { value: contract.offset, as: '--focus-offset' }
): string[] => {
  const where = `${route}: ${stop.at} ("${stop.text}")`;
  const values =
    `outline-style ${stop.outlineStyle}, outline-width ${stop.outlineWidth}, outline-color ${stop.outlineColor}, ` +
    `outline-offset ${stop.outlineOffset}, transition-property "${stop.transitionProperty}" over "${stop.transitionDuration}"`;
  const found: string[] = [];
  if (!stop.focusVisible) found.push(`${where} holds focus after Tab and does not match :focus-visible; ${values}`);
  if (stop.outlineStyle !== 'solid') found.push(`${where} paints no solid ring under Tab; ${values}`);
  if (stop.outlineWidth !== contract.width) found.push(`${where} ring is not --stroke-focus (${contract.width}) wide; ${values}`);
  if (stop.outlineColor !== contract.colour) found.push(`${where} ring is not painted in --token-focus (${contract.colour}); ${values}`);
  if (stop.outlineOffset !== offset.value) found.push(`${where} ring is not at ${offset.as} (${offset.value}); ${values}`);
  if (transitionsOutline(stop.transitionProperty, stop.transitionDuration)) found.push(`${where} transitions its outline; ${values}`);
  return found;
};

/**
 * The landmark's verdict after Enter on a skip link (DW-43, F-20): focus on `main#main`, the standard
 * ring but for its offset, which is the stroke's own width inward, and no side clipped, so the whole
 * ring is inside the box on every route. `inset` is read through a probe, never typed.
 */
const landmarkFindings = (route: string, stop: Stop, contract: RingContract, inset: string): string[] => [
  ...(stop.at.endsWith('main#main') ? [] : [`${route}: focus is on ${stop.at}, not main#main`]),
  ...ringFindings(route, stop, contract, { value: inset, as: 'the landmark inset, -1 times --stroke-focus' }),
  ...stop.clipped.map((side) => `${route}: ${stop.at} ring is clipped, ${side}`),
];

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
    // A face's `src` is the one `url(` that belongs here; the block is cut out before counting.
    const outsideFaces = text.replace(/@font-face\s*\{[^}]*\}/g, '');
    for (const found of outsideFaces.matchAll(new RegExp(`(?<![\\w-])${DEPTH_URL}\\s*\\(`, 'g'))) bump(`depth=${DEPTH_URL}`);
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
 * brace. **One exception since 2026-09-24**, the landmark's inset ring beside the global rule in the
 * same file (F-20), which is `LANDMARK_RING_SELECTOR` there and nowhere else, and **a second since
 * 2026-09-25**, the same ring on a layer above the hero, `LANDMARK_LAYER_SELECTOR` (DW-127).
 */
const ringRulesOutsideTheGlobal = (sheets: readonly [string, string][] = stylesheets()): string[] =>
  sheets.flatMap(([path, source]) =>
    [...withoutComments(source).matchAll(/([^{};]*:focus-visible[^{;]*)\{([^{}]*)\}/g)]
      .filter((rule) => /(?<![\w-])outline(?:-[a-z]+)?\s*:/.test(rule[2]))
      .map((rule) => [path, rule[1].trim()] as const)
      .filter(
        ([at, selector]) =>
          !(at === RING_FILE && (selector === RING_SELECTOR || selector === LANDMARK_RING_SELECTOR || selector === LANDMARK_LAYER_SELECTOR))
      )
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

    // **The ledger is empty since Story 2-33**, which is a reading rather than a hole: every sweep below
    // still fails on an unclaimed tell, and each tally is shown firing on a planted one. The checks on a
    // row's shape run over whatever rows there are, so a row written back is checked on arrival.
    expect(EXEMPTIONS, 'a row is back in the ledger KV-6 retired on 2026-09-23').toEqual([]);
    expect(new Set(EXEMPTIONS.map((row) => row.id)).size, 'two rows share an id').toBe(EXEMPTIONS.length);
    for (const row of EXEMPTIONS) {
      expect(row.closedBy, `"${row.id}" names no closing story`).toMatch(/^Story \d+-\d+$/);
      expect(row.source, `"${row.id}" does not match SOURCE_SHAPE`).toMatch(SOURCE_SHAPE);
      expect(row.count, `"${row.id}" claims no occurrence`).toBeGreaterThan(0);
      expect(existsSync(join(REPO_ROOT, row.source.split(':')[0])), `"${row.id}" names ${row.source}, which is not on disk`).toBe(true);
      if (row.check === 'z-index') expect(row.match, `"${row.id}" is a z-index row whose match is not an integer`).toMatch(/^-?\d+$/);
      if (row.check === 'depth') {
        expect([...DEPTH_PROPERTIES, ...DEPTH_FUNCTIONS, DEPTH_URL] as readonly string[], `"${row.id}" names a depth tell this sweep does not count`).toContain(row.match);
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
    //
    // **Every route since 2026-09-24** (Operator ruling, DW-43, DW-71, F-13 and F-20). Each carries
    // exactly one `main#main`; each with a visible header carries the skip link as the header's first
    // child, and `/` carries it alone, so the first Tab lands on it everywhere a control shows; and
    // `/celeste`, whose header is hidden, shows none. The landmark's ring is inset, and whole.
    const found: string[] = [];
    const readings: string[] = [];
    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);
      const landmarks = await page.locator('main').evaluateAll((nodes: Element[]) => nodes.map((node) => `main#${node.id} tabindex=${node.getAttribute('tabindex')}`));
      if (landmarks.join(', ') !== 'main#main tabindex=-1') found.push(`${surface.route} carries [${landmarks.join(', ')}], not one main#main at tabindex -1`);
      const skips = await page.locator('.skip-link').evaluateAll((nodes: Element[]) => nodes.map((node) => node.getClientRects().length > 0));
      if (surface.route === '/celeste') {
        if (skips.some((shown) => shown)) found.push('/celeste displays a skip link, where the page shows no control');
        continue;
      }
      if (skips.length !== 1 || !skips[0]) {
        found.push(`${surface.route} renders ${skips.length} skip link(s), ${skips.filter((shown) => shown).length} displayed, not one`);
        continue;
      }
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.className ?? '(nothing)');
      if (first !== 'skip-link') {
        found.push(`${surface.route}: the first Tab lands on "${first}", not the skip link`);
        continue;
      }
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), { message: `${surface.route}: Enter on the skip link did not move focus to main#main` }).toBe('main');
      const contract = await ringContract(page);
      const inset = await probeComputed(page, 'outline-offset:calc(-1 * var(--stroke-focus));', 'outline-offset');
      const landmark = await readStop(page);
      found.push(...landmarkFindings(surface.route, landmark, contract, inset));
      readings.push(`${surface.route} main#main after Enter: focus-visible ${landmark.focusVisible}, ${landmark.outlineWidth} ${landmark.outlineStyle} at ${landmark.outlineOffset}, clipped [${landmark.clipped.join('; ')}]`);
    }
    console.log(`accessibility-floor: ${readings.join('; ')}`);
    expect(found, `A-6 and A-1 on the landmark:\n${found.join('\n')}`).toEqual([]);
    expect(readings.length, 'no route put focus on its landmark, so the read above is over nothing').toBe(SURFACES.length - 1);

    // **The control**, on `/work`: the standard offset put back on the landmark is named twice, as the
    // offset and as the sides the document's edge takes, which is F-20 as it was.
    await goTo(page, '/work');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe('main');
    await page.addStyleTag({ content: 'main:focus-visible { outline-offset: var(--focus-offset) !important; }' });
    const contract = await ringContract(page);
    const inset = await probeComputed(page, 'outline-offset:calc(-1 * var(--stroke-focus));', 'outline-offset');
    const planted = landmarkFindings('/work (planted)', await readStop(page), contract, inset);
    expect(planted.some((line) => line.includes('ring is not at the landmark inset')), `the offset was not named:\n${planted.join('\n')}`).toBe(true);
    expect(planted.some((line) => /ring is clipped, (left|right) by the document edge/.test(line)), `the clipped sides were not named:\n${planted.join('\n')}`).toBe(true);

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
        `accessibility-floor: h2#suite after Enter: focus-visible ${heading.focusVisible}, ` +
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
    // still where the name is read. A route off the rule is a ledger row. The 404, which rendered
    // its numeral and title as paragraphs, was carried by `heading-404` until Story 2-30 rebuilt it
    // on 2026-09-23 with the display entrance as its one `<h1>` and deleted the row: no route is
    // off the rule now, and the planted second heading below is what keeps the count a measurement.
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

    // **Nothing to claim since Story 2-33**, so the vacuity guard reads what the sweep did see rather
    // than what it tallied. Until then at least one literal and one tell were observed, which is what
    // kept two agreeing empty lists from meaning nothing; now the built CSS carries none, so the guard
    // is that the scan read real stylesheets that set layers (every `z-index` written as a contract
    // layer, which the tally passes over), and that the same tally, handed the 2023 hero's shapes and
    // the `/work` grid, reports each of them unlisted against this ledger.
    const layered = styles.reduce((sum, { text }) => sum + [...text.matchAll(/(?<![\w-])z-index:\s*var\(--z-/g)].length, 0);
    expect(layered, 'the built CSS read here sets no z-index through a contract layer, so it is not the built CSS').toBeGreaterThan(0);
    expect(verdict.observed.size, 'the built CSS carries a tell a ledger row claims, where KV-6 retired on an empty ledger').toBe(0);
    const planted = tally(
      [{ name: 'planted.css', text: '.work-hero__text{z-index:2}body#work{background-image:linear-gradient(red,blue),linear-gradient(90deg,red,blue)}' }],
      EXEMPTIONS,
      layers
    );
    expect(planted.unlisted, 'the tally does not report a planted literal and a planted grid').toEqual([
      'depth=linear-gradient occurs 2 time(s) in the built CSS and no ledger row claims it',
      'z-index=2 occurs 1 time(s) in the built CSS and no ledger row claims it',
    ]);

    // **The `url(` tell (DW-102).** The build's faces carry their `url(` inside `@font-face`, so the
    // real read passes over them, and a planted grain is seen beside a planted face that is not.
    const faceUrls = styles.reduce((sum, { text }) => sum + [...text.matchAll(/(?<![\w-])url\s*\(/g)].length, 0);
    expect(faceUrls, 'the built CSS carries no url( at all, so the face exclusion below is untested on it').toBeGreaterThan(0);
    const grain = tally(
      [
        {
          name: 'planted.css',
          text:
            '@font-face{font-family:Planted;src:url(./planted.woff2) format("woff2")}' +
            '.work-hero::after{background-image:url("data:image/svg+xml;utf8,<svg/>")}.grain{background:url(grain.png) repeat}',
        },
      ],
      EXEMPTIONS,
      layers
    );
    expect(grain.unlisted, 'the tally does not report two planted url() grounds, or counts the face').toEqual([
      'depth=url occurs 2 time(s) in the built CSS and no ledger row claims it',
    ]);
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
    expect(
      ringRulesOutsideTheGlobal([[RING_FILE, `${LANDMARK_RING_SELECTOR} { outline-offset: 0; }`]]),
      'the landmark exception was reported in the one file allowed it'
    ).toEqual([]);
    const fabricated: [string, string][] = [
      ['components/x/X.scss', '.x {\n  color: red;\n  &:focus-visible {\n    outline: 1px solid var(--token-accent);\n  }\n}\n.y:focus-visible { outline-color: red; }\n.z:focus-visible { transform: none; }'],
      [RING_FILE, '.scoped:focus-visible { outline: none; }'],
      ['components/x/Y.scss', `${LANDMARK_RING_SELECTOR} { outline-offset: 0; }`],
    ];
    expect(ringRulesOutsideTheGlobal(fabricated)).toEqual([
      `components/x/X.scss: "&:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
      `components/x/X.scss: ".y:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
      `${RING_FILE}: ".scoped:focus-visible" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
      `components/x/Y.scss: "${LANDMARK_RING_SELECTOR}" declares an outline, and the ring is painted once, by "${RING_SELECTOR}" in ${RING_FILE}`,
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

/**
 * The scrim's composited-contrast guarantee, sampled rather than trusted (Story 2-29, DW-101).
 *
 * `epics.md:3254-3261` gives the contrast table for the five roles over `--token-scrim`, worst case
 * over a pure white backdrop, and asks for the guarantee to be verified by screenshotting the
 * composited surface, sampling the rendered ground beneath the text and computing the ratio by
 * hand, never by trusting the table. Story 2-28 built the layer and removed both of its call sites,
 * so until Story 2-29 placed it across the home canvas there was no composited surface to sample.
 *
 * **Read at 1024, not at DW-101's stated 360.** Below 768 `HomeLayout.scss` stacks the hero into a
 * flex column, the gem becomes a static item between the name and the nav, and the mobile block
 * hides the scrim because no text overlays imagery there. At 360 there is therefore nothing
 * composited to sample; 1024 is the narrowest width at which the panels sit over the canvas.
 */
const SCRIM_VIEWPORT = { width: 1024, height: 800 } as const;

/**
 * The five roles `epics.md:3254-3256` tables over the scrim, each with the ratio published there
 * and the WCAG 2.1 floor it has to clear: 4.5:1 for text (1.4.3), 3:1 for the ring, which is
 * non-text contrast (1.4.11).
 */
const SCRIM_ROLES = [
  { role: '--token-text', tabled: 13.51, floor: 4.5 },
  { role: '--token-focus', tabled: 9.02, floor: 3 },
  { role: '--token-accent-hover', tabled: 6.94, floor: 4.5 },
  { role: '--token-text-secondary', tabled: 5.41, floor: 4.5 },
  { role: '--token-accent', tabled: 4.77, floor: 4.5 },
] as const;

/**
 * The corner panels, every one of which sits over the canvas at this width. Three since the
 * readout panel's removal (Operator ruling 2026-09-24, DW-110).
 */
const SCRIM_PANELS = ['.home-panel--name', '.home-panel--nav', '.home-panel--contact'] as const;

/** A box in CSS pixels, which is image pixels too at `deviceScaleFactor: 1`. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What one sampled box answered: its ground, and how much of the box that ground covers. */
interface Sample {
  readonly modal: string;
  readonly share: number;
  readonly pixels: number;
  /** The smallest Euclidean distance from any pixel in the box to each probe colour, in order. */
  readonly nearest: number[];
}

/**
 * Sample a screenshot inside the page, through a canvas, so no image decoder is added for this.
 *
 * The ground beneath the text is read as the **modal** colour of a panel's box: the glyphs cover a
 * minority of it, so the most common colour is what they are read against. `nearest` carries how
 * close the box comes to each probe colour, which is what says whether the text painted at all.
 */
const sampleBoxes = async (page: Page, shot: Buffer, boxes: readonly Box[], probes: readonly string[]): Promise<Sample[]> =>
  page.evaluate(
    async ({ dataUrl, boxes, probes }: { dataUrl: string; boxes: Box[]; probes: number[][] }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context for the screenshot');
      context.drawImage(image, 0, 0);

      return boxes.map((box) => {
        const x = Math.max(0, Math.round(box.x));
        const y = Math.max(0, Math.round(box.y));
        const width = Math.max(1, Math.min(Math.round(box.width), canvas.width - x));
        const height = Math.max(1, Math.min(Math.round(box.height), canvas.height - y));
        const { data } = context.getImageData(x, y, width, height);
        const counts = new Map<string, number>();
        const nearest = probes.map(() => Number.POSITIVE_INFINITY);
        for (let index = 0; index < data.length; index += 4) {
          const [r, g, b, a] = [data[index], data[index + 1], data[index + 2], data[index + 3]];
          const key = `${r},${g},${b},${a}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          probes.forEach((probe, slot) => {
            const distance = Math.hypot(r - probe[0], g - probe[1], b - probe[2]);
            if (distance < nearest[slot]) nearest[slot] = distance;
          });
        }
        const [modal, hits] = [...counts].sort((one, two) => two[1] - one[1])[0];
        return { modal, share: hits / (width * height), pixels: width * height, nearest };
      });
    },
    {
      dataUrl: `data:image/png;base64,${shot.toString('base64')}`,
      boxes: boxes.map((box) => ({ ...box })),
      probes: probes.map((probe) => probe.split(',').slice(0, 3).map(Number)),
    }
  );

test.describe('the scrim over the home canvas', () => {
  test('sits genuinely beneath every role, sampled off the composited surface (DW-101)', async ({ browser }) => {
    // The default door, because the project's context asks for reduced motion and that door renders
    // no canvas at all. The same shape `tests/e2e/front-door.pw.ts:259-275` uses.
    const context = await browser.newContext({
      // `colorScheme: 'light'` is `playwright.config.ts:79`'s value, carried here rather than
      // dropped so this context differs from the project's in the two ways it means to and in no
      // other: the viewport and the motion preference. The contract is dark only and declares no
      // `color-scheme`, so the scheme changes nothing the sampling reads, and pinning it is what
      // keeps that a statement rather than an assumption (RESTYLE-SPEC F-11, filed as DW-95).
      viewport: { ...SCRIM_VIEWPORT },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    try {
      const page = await context.newPage();
      await goTo(page, '/');
      await expect
        .poll(() => page.evaluate(() => document.querySelector('.home-gem .scanline-overlay') !== null), {
          timeout: 20_000,
          message: 'the default door rendered no scrim inside .home-gem, so there is no composited surface to sample',
        })
        .toBe(true);
      await settle(page, { route: '/', status: 200, entrance: true });

      // **The z-level trap, resolved by where the header is rather than by what it is painted on.**
      // `Header.tsx:18` renders no band on `/`, only the skip link, so the sticky header is not in the
      // document at all and cannot be a `--z-sticky` element over a `--z-raised` scrim. Read off the
      // DOM, and the scrim's own placement is then read off the composited pixels below rather than
      // off any `z-index` value.
      expect(
        await page.evaluate(() => document.querySelectorAll('.header-container').length),
        'a sticky header renders on `/`, so it sits above the scrim and computes against the imagery'
      ).toBe(0);

      const boxes = await page.evaluate(
        (selectors: string[]) =>
          selectors.map((selector) => {
            const node = document.querySelector(selector);
            if (!node) throw new Error(`${selector} is not on the page`);
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          }),
        [...SCRIM_PANELS]
      );
      for (const [index, box] of boxes.entries()) {
        expect(box.width * box.height, `${SCRIM_PANELS[index]} has no box, so nothing can be sampled inside it`).toBeGreaterThan(0);
      }

      // Every panel really is over the canvas, or the sample below would be of the page ground.
      const gem = await page.evaluate(() => {
        const node = document.querySelector('.home-gem');
        if (!node) throw new Error('.home-gem is not on the page');
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      });
      for (const [index, box] of boxes.entries()) {
        const inside = box.x >= gem.x && box.y >= gem.y && box.x + box.width <= gem.x + gem.width && box.y + box.height <= gem.y + gem.height;
        expect(inside, `${SCRIM_PANELS[index]} is not inside the canvas box, so it overlays no imagery`).toBe(true);
      }

      const roleValues = await Promise.all(SCRIM_ROLES.map(({ role }) => rootCustomPropertyValue(page, role)));
      const roleRgba = await rasterise(page, roleValues);

      // **The proof that the layer is genuinely between the imagery and the text, taken by
      // sampling.** The scrim is repainted an unmistakable colour and the surface screenshotted
      // again: beneath every panel the ground becomes that colour, which says the scrim covers the
      // imagery there, and the panel's own text is still painted over it, which says the panel is
      // above the scrim rather than under it. Neither half reads a `z-index`, and neither depends
      // on what the WebGL canvas happens to draw.
      const MARKER = '255,0,255';
      const planted = await page.addStyleTag({ content: '.scanline-overlay { background-color: rgb(255, 0, 255) !important; }' });
      const marked = await sampleBoxes(page, await page.screenshot(), boxes, [...roleRgba, `${MARKER},255`]);
      await planted.evaluate((node) => (node as Element).remove());

      const notCovered = marked
        .map((sample, index) => `${SCRIM_PANELS[index]} reads ${sample.modal} at ${(sample.share * 100).toFixed(1)}% of its box`)
        .filter((_, index) => !marked[index].modal.startsWith(`${MARKER},`));
      expect(
        notCovered,
        `the repainted scrim is not the ground beneath a panel's text, so the layer is not genuinely between the imagery and ` +
          `that panel:\n${notCovered.join('\n')}`
      ).toEqual([]);

      // **Each panel paints its own text over the marker, or that panel is under the layer rather
      // than above it.** Read per panel since 2026-09-21: it was `overMarker.length > 0` until the
      // Step-04 review pointed out that three of the four could be buried or blank and it would
      // still pass.
      //
      // **No panel is exempt, and that was measured rather than assumed.** `.home-panel--sys` was
      // exempted when this went per panel, on the guess that its `HudLabel` is the smallest type on
      // the surface and might be antialiased short of the probe distance on every pixel. The run
      // said otherwise: all four panels read a nearest distance of **0.0**, an exact hit on one of
      // the five roles, two of them reaching that panel through Story 1-18 aliases then. So
      // the set below is empty and stays empty unless a measurement puts something in it; the
      // distances are printed on every run so the question is answered by the log rather than by
      // this comment.
      //
      // **Still empty since 2026-09-23, and a measurement nearly put `.home-panel--sys` back.** Story
      // 2-31 folded `HudLabel` into the Plate mark, so the readout was set at `--t-3xs`, and in the
      // pinned image its glyphs came no closer than **13.1** to any of the five roles, one past the
      // threshold. The mark's hairline was probed as well, rather than exempting the panel.
      // **The probe left with the panel on 2026-09-24** (Operator ruling, DW-110): the three panels
      // that remain paint body and display type, which read an exact hit on a role, so the read is
      // text's alone again.
      const EXEMPT_FROM_MARKER = new Set<string>();
      const nearestPerPanel = marked.map((sample, index) => ({
        panel: SCRIM_PANELS[index],
        nearest: Math.min(...sample.nearest.slice(0, SCRIM_ROLES.length)),
      }));
      console.log(
        `accessibility-floor: over the repainted scrim, ` +
          `${nearestPerPanel.map((read) => `${read.panel} nearest ${read.nearest.toFixed(1)}`).join('; ')}`
      );
      const buried = nearestPerPanel
        .filter((read) => !EXEMPT_FROM_MARKER.has(read.panel) && read.nearest > 12)
        .map((read) => `${read.panel} comes no closer than ${read.nearest.toFixed(1)} to any of the five roles`);
      expect(
        buried,
        `a panel painted no role colour over the repainted scrim, so its text is beneath the layer rather than above ` +
          `it:\n${buried.join('\n')}`
      ).toEqual([]);

      // The real composite, and the five ratios computed from the sampled sRGB rather than typed.
      const served = await sampleBoxes(page, await page.screenshot(), boxes, roleRgba);
      const grounds = served.map((sample) => sample.modal);
      for (const [index, ground] of grounds.entries()) {
        expect(ground.endsWith(',255'), `${SCRIM_PANELS[index]} sampled a ground that is not opaque: ${ground}`).toBe(true);
      }

      const readings: string[] = [];
      const under: string[] = [];
      SCRIM_ROLES.forEach(({ role, tabled, floor }, slot) => {
        const measured = Math.min(...grounds.map((ground) => ratio(roleRgba[slot], ground)));
        readings.push(`${role} ${measured.toFixed(2)}:1 measured against the table's ${tabled.toFixed(2)}:1, floor ${floor}:1`);
        if (measured < floor) under.push(`${role} contrasts ${measured.toFixed(2)}:1 against the sampled ground, under its ${floor}:1 floor`);
      });
      expect(under, `a role does not clear its own floor over the scrim as composited:\n${under.join('\n')}`).toEqual([]);

      console.log(
        `accessibility-floor: the scrim at ${SCRIM_VIEWPORT.width}x${SCRIM_VIEWPORT.height}, default door. Grounds sampled ` +
          `${grounds.map((ground, index) => `${SCRIM_PANELS[index]} ${ground} (${(served[index].share * 100).toFixed(1)}% of ${served[index].pixels}px)`).join('; ')}. ` +
          `Ratios: ${readings.join('; ')}`
      );
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// The muted-accent ornaments, generated content since DW-113.
// ---------------------------------------------------------------------------

/**
 * Every `aria-hidden` ornament set in the muted accent, by route: the home surface's three Japanese
 * lines and the framework band's names, and `/work`'s subordinate line.
 *
 * **Why they are generated content** (Operator ruling 2026-09-24, DW-113). axe scores colour contrast
 * on any element with a text node of its own, `aria-hidden` or not, and these are `--token-accent-muted`
 * at 2.74:1, which the design allows as ornament. As text they failed Lighthouse's `color-contrast`
 * on `/` and `/work`, leaving each route one hundredth over the gate and the audit blind to a real
 * regression. Each is now an empty span whose string is its `data-ornament`, painted by `::before`.
 */
const ORNAMENTS = [
  { route: '/', selector: '.home-role__jp' },
  { route: '/', selector: '.home-nav-jp' },
  { route: '/', selector: '.home-contact-jp' },
  { route: '/', selector: '.premise__framework' },
  { route: '/work', selector: '.plate-mark__sub' },
] as const;

/** What each element under one selector is: its own text, its string, its hiding, what `::before` paints. */
const ornamentReads = (page: Page, selector: string) =>
  page.evaluate(
    (target) =>
      [...document.querySelectorAll<HTMLElement>(target)].map((node) => {
        const own = getComputedStyle(node);
        const before = getComputedStyle(node, '::before');
        return {
          at: window.cuatroA11y.path(node),
          ornament: node.getAttribute('data-ornament') ?? '',
          textNodes: [...node.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '').length,
          hidden: node.closest('[aria-hidden="true"]') !== null,
          // Blink resolves `attr()` in `content` to the attribute's string when it computes the style,
          // so this is the string the pseudo-element paints, serialised as a CSS string.
          painted: before.content,
          inherits:
            before.color === own.color &&
            before.fontFamily === own.fontFamily &&
            before.fontSize === own.fontSize &&
            before.letterSpacing === own.letterSpacing,
        };
      }),
    selector
  );

/** Everything wrong with one read. A function, so the plants below drive the same judgement. */
const ornamentFindings = (reads: Awaited<ReturnType<typeof ornamentReads>>): string[] =>
  reads.flatMap((read) => [
    ...(read.ornament === '' ? [`${read.at} carries no data-ornament`] : []),
    ...(read.textNodes > 0 ? [`${read.at} carries its string as text, which axe scores`] : []),
    ...(!read.hidden ? [`${read.at} is not hidden from assistive technology`] : []),
    ...(read.painted !== JSON.stringify(read.ornament) ? [`${read.at} paints ${read.painted} where its attribute says ${JSON.stringify(read.ornament)}`] : []),
    ...(!read.inherits ? [`${read.at} paints its ::before in a colour or type other than its own`] : []),
  ]);

test.describe('the muted-accent ornaments are generated content (DW-113)', () => {
  test('each is an empty, hidden element that paints its string in its own colour and type', async ({ page }) => {
    const found: string[] = [];
    const counted: string[] = [];
    for (const route of [...new Set(ORNAMENTS.map((ornament) => ornament.route))]) {
      await goTo(page, route);
      await settle(page, { route, status: 200, entrance: route === '/' });
      for (const { selector } of ORNAMENTS.filter((ornament) => ornament.route === route)) {
        const reads = await ornamentReads(page, selector);
        if (reads.length === 0) found.push(`${route}: ${selector} matches nothing, so the fixture moved rather than the claim`);
        counted.push(`${route} ${selector} ${reads.length}`);
        found.push(...ornamentFindings(reads));
      }
    }
    console.log(`accessibility-floor: ornaments read ${counted.join('; ')}`);
    expect(found, `an ornament is page text again, or paints nothing:\n${found.join('\n')}`).toEqual([]);
  });

  test('and that read fires on an ornament set as text, painting nothing, or exposed', async ({ page }) => {
    // The controls, planted into the real elements: the same judgement has to name each.
    await goTo(page, '/');
    await settle(page, { route: '/', status: 200, entrance: true });
    await page.evaluate(() => {
      const role = document.querySelector('.home-role__jp');
      if (role) role.textContent = 'text';
      document.querySelector('.home-contact-jp')?.removeAttribute('aria-hidden');
    });
    await page.addStyleTag({ content: '.home-nav-jp::before { content: none !important; }' });
    const found = [
      ...ornamentFindings(await ornamentReads(page, '.home-role__jp')),
      ...ornamentFindings(await ornamentReads(page, '.home-nav-jp')),
      ...ornamentFindings(await ornamentReads(page, '.home-contact-jp')),
    ];
    expect(found.some((line) => line.includes('home-role__jp') && line.includes('as text')), 'text set into an ornament was not named').toBe(true);
    expect(found.some((line) => line.includes('home-nav-jp') && line.includes('paints none')), 'an ornament painting nothing was not named').toBe(true);
    expect(found.some((line) => line.includes('home-contact-jp') && line.includes('not hidden')), 'an exposed ornament was not named').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The landmark's ring is painted above the hero (DW-127)
// ---------------------------------------------------------------------------

/**
 * Where the landmark's ring is read off the screen after Enter on the skip link: one pixel inside
 * its top, left and right edges, the middle of a ring `--stroke-focus` wide drawn inset by its own
 * width. The top is read at the middle of the viewport's width; the sides at the middle of the part
 * of the landmark in the viewport.
 */
const landmarkEdgeSamples = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main#main');
    if (!main) throw new Error('main#main is not on the page');
    const box = main.getBoundingClientRect();
    const top = Math.max(box.top, 0);
    const bottom = Math.min(box.bottom, window.innerHeight);
    const middle = (top + bottom) / 2;
    return [
      { side: 'top', x: box.left + box.width / 2, y: box.top + 1, width: 1, height: 1 },
      { side: 'left', x: box.left + 1, y: middle, width: 1, height: 1 },
      { side: 'right', x: box.right - 2, y: middle, width: 1, height: 1 },
    ];
  });

/** How far a sampled pixel may sit from the focus colour and still be the ring, per channel in Euclidean terms. */
const RING_TOLERANCE = 12;

test.describe('the landmark ring is painted above the hero (DW-127)', () => {
  const CASES = [
    { route: '/', width: 1280, height: 800 },
    { route: '/', width: 360, height: 800 },
    { route: '/work', width: 1280, height: 800 },
  ] as const;

  for (const { route, width, height } of CASES) {
    test(`after Enter on the skip link at ${width} on ${route}, a pixel just inside the top, left and right edges of main#main is the focus colour`, async ({
      browser,
    }) => {
      // Operator ruling 2026-09-25 (DW-127): on `/`'s default door at 768 and wider the hero's canvas
      // and scrim are positioned inside `<main>` and paint over its outline, so the same ring is drawn
      // again on a positioned layer above them, `main:focus-visible::after`. Read as a raster, never
      // as geometry: the geometry was whole all along. The default door, since the project's context
      // asks for reduced motion and that door renders no canvas.
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: 'no-preference',
      });
      try {
        const page = await context.newPage();
        await goTo(page, route);
        const surface = { route, status: 200, entrance: route === '/' };
        if (route === '/' && width >= 768) {
          await expect
            .poll(() => page.evaluate(() => document.querySelector('.home-gem .scanline-overlay') !== null), {
              timeout: 20_000,
              message: 'the default door rendered no scrim, so nothing covers the landmark and this case proves nothing',
            })
            .toBe(true);
        }
        await settle(page, surface);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.className ?? ''), 'the first Tab did not land on the skip link').toBe('skip-link');
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), { message: 'Enter on the skip link did not focus main#main' }).toBe('main');

        const [focusRgba] = await rasterise(page, [await rootCustomPropertyValue(page, '--token-focus')]);
        const samples = await landmarkEdgeSamples(page);
        const read = await sampleBoxes(page, await page.screenshot(), samples, [focusRgba]);
        const readings = samples.map((sample, index) => `${sample.side} ${read[index].modal} (${read[index].nearest[0].toFixed(1)} from ${focusRgba})`);
        console.log(`accessibility-floor: ${route} at ${width}, main#main's edges after Enter: ${readings.join('; ')}`);
        expect(
          samples.filter((_, index) => read[index].nearest[0] > RING_TOLERANCE).map((sample, index) => `${sample.side}: ${readings[index]}`),
          `on ${route} at ${width} an edge of the focused landmark does not show the ring`
        ).toEqual([]);

        // **The control**, at 1280 on `/`: the layer taken off, the hero paints over the landmark's own
        // outline again, and the same read names the three sides. That is DW-127 as it was, and it is
        // what proves the pixel read can see a ring the geometry says is there.
        if (route === '/' && width >= 768) {
          await page.addStyleTag({ content: 'main:focus-visible::after { content: none !important; }' });
          const bare = await sampleBoxes(page, await page.screenshot(), samples, [focusRgba]);
          expect(
            bare.filter((sample) => sample.nearest[0] > RING_TOLERANCE).length,
            `with the layer taken off the hero did not cover the ring on any side (${bare.map((sample) => sample.modal).join('; ')}), so the read above proves nothing`
          ).toBe(3);
        }
      } finally {
        await context.close();
      }
    });
  }
});
